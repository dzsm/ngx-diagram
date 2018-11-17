import {
    AfterContentChecked,
    AfterContentInit, AfterViewChecked, AfterViewInit, ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component, ContentChild,
    ElementRef, EventEmitter, HostListener, OnChanges, OnDestroy,
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


import {
    IMatrix,
    Rectangle,
    IPoint, IVector, Vector, IRectangle, IPort, IDimension, INode, ILink, IInternalNode, IInternalLink,
} from './ngx-diagram.models';


@Component({
    selector: 'ngx-diagram',
    templateUrl: './ngx-diagram.component.html',
    styleUrls: ['./ngx-diagram.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxDiagramComponent implements OnInit, AfterViewInit,
    AfterContentInit, AfterViewChecked, AfterContentChecked, OnChanges, OnDestroy {

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
    _modeLinkPort: string;
    _modeLinkPath = [];

    // MODE PAN: Panning
    _MODE_PAN = 3;
    _matrix: IMatrix = identity();
    _matrixSVG: string;
    _matrixCSS: string;

    // MODE SELECT: Selecting with a rectangle
    _MODE_SELECT = 4;
    _modeSelectStart: IPoint;
    _modeSelectRect: IRectangle;

    _mode = this._MODE_NONE;

    _links = new Map<string, IInternalLink>();
    _nodes = new Map<string, IInternalNode>();

    _linkIdsToUpdate = new Set<string>();

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

    }

    ngOnInit() {
        // console.log('ngOnInit');

    }

    ngOnChanges(changes: SimpleChanges) {
        // console.log('ngOnChanges', changes);
    }

    ngAfterContentInit() {
        // console.log('ngAfterContentInit');

    }

    ngAfterContentChecked() {
        // console.log('ngAfterContentChecked');

    }

    ngAfterViewInit() {
        // console.log('ngAfterViewInit');
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
        if (this._updateLinks()) {
            // console.log('detectChanges');
            this.changeDetectorRef.detectChanges();
        }
        this.changeDetectorRef.reattach();

    }

    ngOnDestroy() {
        // console.log('ngOnDestroy');

    }


    _newNode(externalNode: INode): IInternalNode {

        return {
            id: externalNode.id,
            x: Math.random() * 300, y: Math.random() * 300,
            h: 0, w: 0,

            ports: new Map<string, IPort>([['SOURCE', {x: 1, y: 0.5}], ['TARGET', {x: 0, y: 0.5}]]), // todo: originate from externalNode if possible
            links: new Set<string>(),

            selected: false,
            external: externalNode
        }
    }

    _newLink(externalLink: ILink): IInternalLink {

        const sourcePort = externalLink.sourcePort ? externalLink.sourcePort : 'SOURCE';
        const targetPort = externalLink.targetPort ? externalLink.targetPort : 'TARGET';
        const id = externalLink.id || externalLink.source + sourcePort + externalLink.target + targetPort;

        return {

            id: id,

            sourcePort: sourcePort,
            targetPort: targetPort,
            source: externalLink.source,
            target: externalLink.target,
            path: [],

            external: externalLink
        };

    }

    addData(externalNodes: Array<INode>, externalLinks: Array<ILink>) {

        externalNodes.forEach(node => {
            const internalNode = this._newNode(node);
            this._nodes.set(internalNode.id, internalNode);
        });


        externalLinks.forEach(link => {
            const internalLink = this._newLink(link);

            this._links.set(internalLink.id, internalLink);

            const source = this._nodes.get(link.source);
            source.links.add(internalLink.id);
            const target = this._nodes.get(link.target);
            target.links.add(internalLink.id);

            this._linkIdsToUpdate.add(internalLink.id);
        });

    }

    _deleteLink(linkId: string) {

        const link = this._links.get(linkId);

        const source = this._nodes.get(link.source);
        source.links.delete(linkId);

        const target = this._nodes.get(link.target);
        target.links.delete(linkId);

        this._links.delete(linkId);
        this._linkIdsToUpdate.delete(linkId);

    }

    updateNodes(externalNodes: Array<INode>) {

        const externalNodeIdSet = new Set();

        externalNodes.forEach(node => {

            externalNodeIdSet.add(node.id);

            if (this._nodes.has(node.id)) { // todo: future conflict between internal key vs external id
                this._nodes.get(node.id).external = node; // todo: what about ports ?
            } else {
                const internalNode = this._newNode(node);
                this._nodes.set(internalNode.id, internalNode);
            }

        });

        const scheduleToDelete = [];
        this._nodes.forEach(node => {

            if (!externalNodeIdSet.has(node.id)) {

                node.links.forEach(linkId => {
                    this._deleteLink(linkId);
                });

                scheduleToDelete.push(node.id);

            }

        });

        scheduleToDelete.forEach(id => this._nodes.delete(id));

        this.changeDetectorRef.detectChanges();


    }


    addNodeTo(externalNode: INode, x: number, y: number) {
        const internalNode = this._newNode(externalNode);
        internalNode.x = x;
        internalNode.y = y;
        this._nodes.set(internalNode.id, internalNode);
    }

    _updateDimension(nodeId: string, d: IDimension) {

        const node = this._nodes.get(nodeId);

        if (node) { // queryList is not updating when node from _nodes has deleted

            if (node.h === d.h && node.w === d.w) {
                return;
            }

            node.h = d.h;
            node.w = d.w;

            node.links.forEach(linkId => {
                this._linkIdsToUpdate.add(linkId);
            });

        }

    }

    _updatePositionBy(nodeId: string, d: IVector) {

        const node = this._nodes.get(nodeId);
        node.x += d.x;
        node.y += d.y;

        node.links.forEach(linkId => {
            this._linkIdsToUpdate.add(linkId);
        });

    }

    _updateLinks() {

        if (this._linkIdsToUpdate.size > 0) {

            this._linkIdsToUpdate.forEach(linkId => {

                const link = this._links.get(linkId);

                const source = this._nodes.get(link.source);
                const target = this._nodes.get(link.target);

                const rs = source.ports.get(link.sourcePort);
                const rt = target.ports.get(link.targetPort);

                const ps = {x: source.x + source.w * rs.x, y: source.y + source.h * rs.y};
                const pt = {x: target.x + target.w * rt.x, y: target.y + target.h * rt.y};

                link.path = [ps, {x: ps.x + 30, y: ps.y}, {x: pt.x - 30, y: pt.y}, pt];
            });

            this._linkIdsToUpdate.clear();

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

        this._nodes.forEach((node) => {
            const c = {x: node.x + 0.5 * node.w, y: node.y + 0.5 * node.h};
            node.selected = r.x <= c.x && c.x <= r.x + r.w && r.y <= c.y && c.y <= r.y + r.h;
            if (node.selected) {
                selectionList.push(node.external);
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
    startLink(event: MouseEvent, id: string, port: string) {
        this._mode = this._MODE_LINK;
        this._modeLinkNodeId = id;
        this._modeLinkPort = port;

    }

    whileLink(event: MouseEvent) {

        const source = this._nodes.get(this._modeLinkNodeId);

        const rs = source.ports.get(this._modeLinkPort);

        const ps = {x: source.x + source.w * rs.x, y: source.y + source.h * rs.y};
        const pt = this._eventPoint(event);

        this._modeLinkPath = [ps, {x: ps.x + 30, y: ps.y}, pt];

    }

    endLink(event: MouseEvent, id: string, port: string) {


        this.connected.emit({
            source: this._nodes.get(this._modeLinkNodeId).external,
            sourcePort: this._modeLinkPort,
            target: this._nodes.get(id).external,
            targetPort: port
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
    zoomWheel(event: MouseEvent, f: number): void {

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
            this.startLink(event, id, 'SOURCE');
        } else {
            this.startDrag(event, id);
        }

    }

    onNodeMouseMove(event: MouseEvent, id: string): void {

        if (this._mode === this._MODE_LINK) {

            // special case
            if (this._modeLinkNodeId !== id) {

                const source = this._nodes.get(this._modeLinkNodeId);
                const target = this._nodes.get(id);

                const rs = source.ports.get('SOURCE');
                const rt = target.ports.get('TARGET');

                const ps = {x: source.x + source.w * rs.x, y: source.y + source.h * rs.y};
                const pt = {x: target.x + target.w * rt.x, y: target.y + target.h * rt.y};

                this._modeLinkPath = [ps, {x: ps.x + 30, y: ps.y}, {x: pt.x - 30, y: pt.y}, pt];

            }

            event.stopPropagation();
            event.preventDefault();

        }

    }

    onNodeMouseUp(event: MouseEvent, id: string): void {

        if (this._mode === this._MODE_LINK) {
            this.endLink(event, id, 'TARGET');
        } else if (this._mode === this._MODE_SELECT) {

        }

    }

    onPortMouseDown(event: MouseEvent, id: string, port: string): void {

        this.startLink(event, id, port);

        event.stopPropagation();
        event.preventDefault();

    }

    onPortMouseMove(event: MouseEvent, id: string, port: string): void {

        if (this._mode === this._MODE_LINK) {

            // special case
            if (this._modeLinkNodeId !== id) {

                const source = this._nodes.get(this._modeLinkNodeId);
                const target = this._nodes.get(id);

                const rs = source.ports.get(this._modeLinkPort);
                const rt = target.ports.get(port);

                const ps = {x: source.x + source.w * rs.x, y: source.y + source.h * rs.y};
                const pt = {x: target.x + target.w * rt.x, y: target.y + target.h * rt.y};

                this._modeLinkPath = [ps, {x: ps.x + 30, y: ps.y}, {x: pt.x - 30, y: pt.y}, pt];

            }

            event.stopPropagation();
            event.preventDefault();

        }

    }

    onPortMouseUp(event: MouseEvent, id: string, port: string): void {

        if (this._mode === this._MODE_LINK) {
            this.endLink(event, id, port);
        } else if (this._mode === this._MODE_SELECT) {

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

}
