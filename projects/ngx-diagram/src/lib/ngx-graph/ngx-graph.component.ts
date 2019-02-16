import {
    AfterContentChecked,
    AfterContentInit, AfterViewChecked, AfterViewInit, ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component, ContentChild,
    ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy,
    OnInit, Output,
    QueryList,
    SimpleChanges, TemplateRef, ViewChild,
    ViewChildren
} from '@angular/core';

import {
    identity,
    scale,
    toSVG,
    toCSS,
    transform,
    translate,
    inverse,
    applyToPoint
} from 'transformation-matrix';

//import * as deepEqual from 'fast-deep-equal';
import {deepEqual} from 'fast-equals';

import {
    IMatrix,
    Rectangle,
    IPoint,
    IVector,
    Vector,
    IRectangle,
    IPort,
    IDimension,
    INode,
    ILink,
    IInternalNode,
    IInternalLink,
    IGraph,
    IVertex,
    IEdge,
} from '../ngx-diagram.models';
import {NgxDiagramLayout2} from "../ngx-diagram-layout";

//import {NgxDiagramPath} from '../ngx-diagram.path';
//import {NgxDiagramLayout} from "../ngx-diagram-layout";

function id() {
    return '' + Math.random().toString(36).substr(2, 9);
}

/**
 * Returns a deep copy of the object
 */
function deepCopy(oldObj: any) {
    var newObj = oldObj;
    if (oldObj && typeof oldObj === "object") {
        newObj = Object.prototype.toString.call(oldObj) === "[object Array]" ? [] : {};
        for (var i in oldObj) {
            newObj[i] = deepCopy(oldObj[i]);
        }
    }
    return newObj;
}

@Component({
    selector: 'ngx-diagram-simple',
    templateUrl: './ngx-graph.component.html',
    styleUrls: ['./ngx-graph.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxGraphComponent implements AfterViewChecked {

    _MIN_ZOOM = 0.1;
    _MAX_ZOOM = 5;
    _ZOOM_IN = 1.1;
    _ZOOM_OUT = 0.9;

    // MODE NONE: Does nothing
    _MODE_NONE = 0;

    // MODE DRAG: Drags an object and moves all selected objects with it
    _MODE_DRAG = 1;
    _modeDragNodeId: string;

    // MODE LINK: Connecting two objects
    _MODE_LINK = 2;
    _modeLinkNodeId: string;
    _modeLinkPath = [];

    // MODE PAN: Panning
    _MODE_PAN = 3;
    _matrix: IMatrix;
    _matrixSVG: string;
    _matrixCSS: string;

    // MODE SELECT: Selecting with a rectangle
    _MODE_SELECT = 4;
    _modeSelectStart: IPoint;
    _modeSelectRect: IRectangle;

    _mode = this._MODE_NONE;

    _graph: IGraph = {v: {}, e: {}};

    _linkIdsToUpdateLinkPath = new Set<string>();

    //_diagramPath: any;
    _diagramLayout: any;

    @ContentChild(TemplateRef) templateRef: TemplateRef<any>;

    @ViewChild('divLayerRef') divLayerRef: ElementRef;
    @ViewChildren('nodeElementRefs') nodeElementRefs: QueryList<any>;

    @Output() connected = new EventEmitter<any>();
    @Output() clicked = new EventEmitter<any>();
    @Output() selected = new EventEmitter<any>();

    _eventPoint(event: MouseEvent): IPoint {

        // Determines client coordinates relative to the editor component
        const rect = this.divLayerRef.nativeElement.getBoundingClientRect();
        const relativeClientX = event.clientX - rect.left;
        const relativeClientY = event.clientY - rect.top;

        // Transforms the coordinate to world coordinate (in the SVG/DIV world)
        return applyToPoint(inverse(this._matrix), {x: relativeClientX, y: relativeClientY});

    }

    _eventMovement(event: MouseEvent): IVector {
        const _DEVICE_PIXEL_RATIO = window.devicePixelRatio;
        return {
            x: event.movementX / this._matrix.a / _DEVICE_PIXEL_RATIO,
            y: event.movementY / this._matrix.a / _DEVICE_PIXEL_RATIO
        };
    }

    constructor(private changeDetectorRef: ChangeDetectorRef) {
        // console.log('constructor');
        this._matrix = identity();
        //this._diagramPath = new NgxDiagramPath();
        this._diagramLayout = new NgxDiagramLayout2(this._graph, this._linkIdsToUpdateLinkPath);

    }

    ngOnInit() {
        // console.log('ngOnInit');

    }

    ngOnChanges(changes: SimpleChanges) {
        // console.log('ngOnChanges', changes);
    }

    ngAfterViewChecked() {
        // console.log('ngAfterViewChecked');

        this.changeDetectorRef.detach();
        this.nodeElementRefs.forEach((item) => {
            this._updateDimension(item.nativeElement.id, {
                h: item.nativeElement.offsetHeight,
                w: item.nativeElement.offsetWidth
            });
        });
        if (this._updateLinkPaths()) {
            // console.log('detectChanges');
            this.changeDetectorRef.detectChanges();
        }
        this.changeDetectorRef.reattach();

    }

    //
    _updateDimension(nodeId: string, d: IDimension) {

        const node = this._graph.v[nodeId];

        if (node) { // queryList is not updating when node from _nodes has deleted

            if (node._h === d.h && node._w === d.w) {
                return;
            }

            node._h = d.h;
            node._w = d.w;


            node._s.forEach(linkId => {
                this._linkIdsToUpdateLinkPath.add(linkId);
            });

            node._t.forEach(linkId => {
                this._linkIdsToUpdateLinkPath.add(linkId);
            });

        }

    }

///
    _updatePositionBy(nodeId: string, d: IVector) {

        const node = this._graph.v[nodeId];

        node._x += d.x;
        node._y += d.y;

        node._s.forEach(linkId => {
            this._linkIdsToUpdateLinkPath.add(linkId);
        });

        node._t.forEach(linkId => {
            this._linkIdsToUpdateLinkPath.add(linkId);
        });

    }

    //
    _linkPath(source: IVertex, target: IVertex): Array<IPoint> {

        const ps = {x: source._x + source._w * 1.0, y: source._y + source._h * 0.5};
        const pt = {x: target._x + target._w * 0.0, y: target._y + target._h * 0.5};

        //const path = this._diagramPath.find({x: ps.x + 25, y: ps.y}, {
        //    x: pt.x - 25,
        //    y: pt.y
        //}, this._nodes.values());

        return [ps, {x: ps.x + 25, y: ps.y}, {x: pt.x - 25, y: pt.y}, pt];

    }

    //
    _halfLinkPath(source: IVertex, pt: IPoint): Array<IPoint> {

        const ps = {x: source._x + source._w * 1.0, y: source._y + source._h * 0.5};

        return [ps, {x: ps.x + 25, y: ps.y}, {x: pt.x - 25, y: pt.y}, pt];

    }

    _updateLinkPaths(): boolean {

        if (this._linkIdsToUpdateLinkPath.size > 0) {

            this._linkIdsToUpdateLinkPath.forEach(linkId => {

                const e = this._graph.e[linkId];

                const source = this._graph.v[e._s];
                const target = this._graph.v[e._t];

                e._p = this._linkPath(source, target);

            });

            this._linkIdsToUpdateLinkPath.clear();

            return true;

        }

        return false;

    }

    _d(points: Array<IPoint>): string {
        if (points.length > 0) {
            let d = `M ${points[0].x} ${points[0].y}`;
            for (var i = 1; i < points.length; i++) {
                d += `L ${points[i].x} ${points[i].y}`;
            }
            return d;
        }
        return ''
    }


    //
    // SELECTION
    //
    startSelect(event: MouseEvent) {
        this._mode = this._MODE_SELECT;
        this._modeSelectStart = this._eventPoint(event);
        this._modeSelectRect = Rectangle.cornersToTLBR(this._modeSelectStart, this._modeSelectStart);
    }

    whileSelect(event: MouseEvent) {
        this._modeSelectRect = Rectangle.cornersToTLBR(this._modeSelectStart, this._eventPoint(event));
    }

    endSelect(event: MouseEvent) {

        const r = Rectangle.cornersToTLBR(this._modeSelectStart, this._eventPoint(event));

        const selectionList = [];

        Object.values(this._graph.v).forEach((node) => {
            const c = {x: node._x + 0.5 * node._w, y: node._y + 0.5 * node._h};
            node._m = r.x <= c.x && c.x <= r.x + r.w && r.y <= c.y && c.y <= r.y + r.h;
            if (node._m) {
                selectionList.push(node);
            }
        });

        this.selected.emit(selectionList);

        this._mode = this._MODE_NONE;

    }

    //
    // DRAGGING
    //
    startDrag(event: MouseEvent, id: string) {
        this._mode = this._MODE_DRAG;
        this._modeDragNodeId = id;

    }

    whileDrag(event: MouseEvent) {
        const movement = this._eventMovement(event);
        this._updatePositionBy(this._modeDragNodeId, movement);

    }

    endDrag(event: MouseEvent) {
        this._mode = this._MODE_NONE;
        //this.graphEditorService.applyAutoLayout();
    }

    //
    // LINKING
    //
    startLink(event: MouseEvent, id: string) {
        this._mode = this._MODE_LINK;
        this._modeLinkNodeId = id;
    }

    whileLink(event: MouseEvent) {

        const source = this._graph.v[this._modeLinkNodeId];
        const pt = this._eventPoint(event); // target point

        this._modeLinkPath = this._halfLinkPath(source, pt);

    }

    whileLinkOn(event: MouseEvent, id: string) {

        if (this._modeLinkNodeId !== id) {

            const source = this._graph.v[this._modeLinkNodeId];
            const target = this._graph.v[id];

            this._modeLinkPath = this._linkPath(source, target);

        }

    }

    endLink(event: MouseEvent, id: string) {

        this.connected.emit({
            source: this._graph.v[this._modeLinkNodeId],
            target: this._graph.v[id],
        });
        this._mode = this._MODE_NONE;
        this._modeLinkPath = [];
    }

    //
    // PANNING
    //
    startPan(event: MouseEvent) {
        this._mode = this._MODE_PAN;
    }

    whilePan(event: MouseEvent): void {

        const movement = this._eventMovement(event);

        this._matrix = transform(
            this._matrix,
            translate(movement.x, movement.y)
        );

        this._matrixSVG = toSVG(this._matrix);
        this._matrixCSS = toCSS(this._matrix);
    }

    endPan(event: MouseEvent) {
        this._mode = this._MODE_NONE;
    }

    //
    // ZOOMING
    //
    mouseWheelUpOrDown(event: MouseEvent, f: number): void {

        if (this._MIN_ZOOM <= this._matrix.a * f && this._matrix.a * f <= this._MAX_ZOOM) {

            const p = this._eventPoint(event);

            this._matrix = transform(
                this._matrix,
                translate(p.x, p.y),
                scale(f, f),
                translate(-p.x, -p.y)
            );

            this._matrixSVG = toSVG(this._matrix);
            this._matrixCSS = toCSS(this._matrix);

        }

    }


    //
    // EVENT BINDINGS
    //
    onAreaMouseDown(event: MouseEvent): void {

        // console.log(this._eventPoint(event));
        if (event.ctrlKey) {
            this.clicked.emit(this._eventPoint(event));
        } else if (event.shiftKey) {
            this.startSelect(event);
        } else {
            this.startPan(event);
        }

    }

    onNodeMouseDown(event: MouseEvent, id: string): void {

        if (event.ctrlKey) {
            this.startLink(event, id);
        } else {
            this.startDrag(event, id);
        }

    }

    onNodeMouseMove(event: MouseEvent, id: string): void {

        if (this._mode === this._MODE_LINK) {

            this.whileLinkOn(event, id);

            event.stopPropagation();
            event.preventDefault();

        }

    }

    onNodeMouseUp(event: MouseEvent, id: string): void {

        if (this._mode === this._MODE_LINK) {
            this.endLink(event, id);

        }

    }

    @HostListener('window:mousemove', ['$event'])
    onWindowMouseMove(event: MouseEvent): void {

        if (this._mode === this._MODE_PAN) {
            this.whilePan(event);
        } else if (this._mode === this._MODE_DRAG) {
            this.whileDrag(event);
        } else if (this._mode === this._MODE_LINK) {
            this.whileLink(event);
        } else if (this._mode === this._MODE_SELECT) {
            this.whileSelect(event);
        }

    }


    @HostListener('window:mouseup', ['$event'])
    onWindowMouseUp(event: MouseEvent): void {

        if (this._mode === this._MODE_SELECT) {
            this.endSelect(event);
        } else if (this._mode === this._MODE_DRAG) {
            this.endDrag(event);
        } else if (this._mode === this._MODE_PAN) {
            this.endPan(event);
        }

        this._mode = this._MODE_NONE;
        this._modeLinkPath = [];

    }

    setGraph(g: IGraph) {
        this._graph = deepCopy(g);
        //this.changeDetectorRef.detectChanges();
    }

    getGraph() {
        return deepCopy(this._graph);
    }

    newNode(v: any) {

        v._id = v._id || id();
        v._x = v._x || 0;
        v._y = v._y || 0;
        v._m = v._m || false;

        v._s = [];
        v._t = [];

        v._h = v._h || 0;
        v._w = v._w || 0;

        this._graph.v[v._id] = v;


        // this.changeDetectorRef.detectChanges();

        return v;
    }

    newLink(s: IVertex, t: IVertex, e: any) {

        e._id = s._id + t._id;

        if (!this._graph.e[e._id]) {

            e._p = [];

            e._s = s._id;
            e._t = t._id;

            this._graph.e[e._id] = e;
            this._graph.v[s._id]._s.push(e._id);
            this._graph.v[t._id]._t.push(e._id);

            //this.changeDetectorRef.detectChanges();

            this._linkIdsToUpdateLinkPath.add(e._id);

            return e;
        }

    }

    delLink(e: IEdge) {

        //console.log(e);
        this._graph.v[e._s]._s = this._graph.v[e._s]._s.filter(item => item !== e._id);
        this._graph.v[e._t]._t = this._graph.v[e._t]._t.filter(item => item !== e._id);

        delete this._graph.e[e._id];

        //this.changeDetectorRef.detectChanges();

    }

    delNode(v: IVertex) {

        v._s.forEach(id => {
            this.delLink(this._graph.e[id])
        });

        v._t.forEach(id => {
            this.delLink(this._graph.e[id])
        });

        delete this._graph.v[v._id];

        //this.changeDetectorRef.detectChanges();

    }


    deleteSelected(selection) {
        selection.forEach(v => this.delNode(v));
    }

    deleteLinksBetweenSelected(selection) {

        const se = new Set([].concat(...selection.map(v => v._s)));
        const te = new Set([].concat(...selection.map(v => v._t)));

        const el = new Set(Array.from(se).filter(x => te.has(x)));

        Array.from(el).forEach(e => this.delLink(this._graph.e[e]));

    }

    redraw() {
        this.changeDetectorRef.detectChanges();
    }

    async autoLayout() {
        return this._diagramLayout.applyAutoLayout();
    }


}

