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
    IPoint, IVector, Vector, IRectangle, IPort, IDimension, INode, ILink, IInternalNode, IInternalLink,
} from '../ngx-diagram.models';

import {NgxDiagramPath} from '../ngx-diagram.path';
import {NgxDiagramLayout} from "../ngx-diagram-layout";

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
    _matrix: IMatrix;
    _matrixSVG: string;
    _matrixCSS: string;

    // MODE SELECT: Selecting with a rectangle
    _MODE_SELECT = 4;
    _modeSelectStart: IPoint;
    _modeSelectRect: IRectangle;

    _mode = this._MODE_NONE;

    _links = new Map<string, IInternalLink>();
    _nodes = new Map<string, IInternalNode>();

    _linkIdsToUpdateLinkPath = new Set<string>();

    _diagramPath: any;
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
        this._diagramPath = new NgxDiagramPath();
        this._diagramLayout = new NgxDiagramLayout(this._nodes, this._links, this._linkIdsToUpdateLinkPath);

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
        if (this._updateLinkPaths()) {
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
            x: Math.random() * 1000, y: Math.random() * 1000,
            h: 0, w: 0,

            ports: new Map<string, IPort>([['SOURCE', {x: 1, y: 0.5}], ['TARGET', {x: 0, y: 0.5}]]), // todo: originate from externalNode if possible
            links: new Set<string>(),

            selected: false,
            external: externalNode
        }
    }


    _linkDefaultId(externalLink: ILink): string {
        const sourcePort = externalLink.sourcePort ? externalLink.sourcePort : '';
        const targetPort = externalLink.targetPort ? externalLink.targetPort : '';
        const id = externalLink.id || (externalLink.source + sourcePort + externalLink.target + targetPort);
        return id;
    }

    _newLink(externalLink: ILink): IInternalLink {

        const sourcePort = externalLink.sourcePort ? externalLink.sourcePort : 'SOURCE';
        const targetPort = externalLink.targetPort ? externalLink.targetPort : 'TARGET';
        const id = externalLink.id || (externalLink.source + sourcePort + externalLink.target + targetPort);

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

    _addNewNode(externalNode: INode): IInternalNode {
        const internalNode = this._newNode(externalNode);
        this._nodes.set(internalNode.id, internalNode);
        return internalNode;
    }

    _addNewLink(externalLink: ILink): IInternalLink {

        const internalLink = this._newLink(externalLink);

        this._links.set(internalLink.id, internalLink);

        const source = this._nodes.get(externalLink.source);
        source.links.add(internalLink.id);
        const target = this._nodes.get(externalLink.target);
        target.links.add(internalLink.id);

        this._linkIdsToUpdateLinkPath.add(internalLink.id);

        return internalLink;
    }

    _deleteLink(link: IInternalLink): void {

        const source = this._nodes.get(link.source);
        source.links.delete(link.id);

        const target = this._nodes.get(link.target);
        target.links.delete(link.id);

        this._links.delete(link.id);
        this._linkIdsToUpdateLinkPath.delete(link.id);

    }

    _deleteLinkById(linkId: string): void {

        const link = this._links.get(linkId);
        this._deleteLink(link);

    }

    _deleteNode(node: IInternalNode): void {

        node.links.forEach(linkId => {
            this._deleteLinkById(linkId);
        });

        this._nodes.delete(node.id);

    }

    _deleteNodeById(nodeId: string): void {

        const node = this._nodes.get(nodeId);
        this._deleteNode(node);

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
                this._linkIdsToUpdateLinkPath.add(linkId);
            });

        }

    }

    _updatePositionBy(nodeId: string, d: IVector) {

        const node = this._nodes.get(nodeId);
        node.x += d.x;
        node.y += d.y;

        node.links.forEach(linkId => {
            this._linkIdsToUpdateLinkPath.add(linkId);
        });

    }

    _linkPath(source: IInternalNode, sourcePort: string, target: IInternalNode, targetPort: string): Array<IPoint> {

        const rs = source.ports.get(sourcePort);
        const rt = target.ports.get(targetPort);

        const ps = {x: source.x + source.w * rs.x, y: source.y + source.h * rs.y};
        const pt = {x: target.x + target.w * rt.x, y: target.y + target.h * rt.y};


        const path = this._diagramPath.find({x: ps.x + 25, y: ps.y}, {
            x: pt.x - 25,
            y: pt.y
        }, this._nodes.values());

        return [ps, ...path, pt];

    }

    _halfLinkPath(source: IInternalNode, sourcePort: string, pt: IPoint): Array<IPoint> {

        const rs = source.ports.get(sourcePort);

        const ps = {x: source.x + source.w * rs.x, y: source.y + source.h * rs.y};

        return [ps, {x: ps.x + 25, y: ps.y}, pt];

    }

    _updateLinkPaths(): boolean {

        if (this._linkIdsToUpdateLinkPath.size > 0) {

            this._linkIdsToUpdateLinkPath.forEach(linkId => {

                const link = this._links.get(linkId);

                const source = this._nodes.get(link.source);
                const target = this._nodes.get(link.target);

                link.path = this._linkPath(source, link.sourcePort, target, link.targetPort);

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
        const sourcePort = this._modeLinkPort;
        const pt = this._eventPoint(event); // target point

        this._modeLinkPath = this._halfLinkPath(source, sourcePort, pt);

    }

    whileLinkOn(event: MouseEvent, id: string, port: string) {

        if (this._modeLinkNodeId !== id) {

            const source = this._nodes.get(this._modeLinkNodeId);
            const sourcePort = this._modeLinkPort;
            const target = this._nodes.get(id);
            const targetPort = port;

            this._modeLinkPath = this._linkPath(source, sourcePort, target, targetPort);

        }

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
            this.startLink(event, id, 'SOURCE');
        } else {
            this.startDrag(event, id);
        }

    }

    onNodeMouseMove(event: MouseEvent, id: string): void {

        if (this._mode === this._MODE_LINK) {

            this.whileLinkOn(event, id, 'TARGET');

            event.stopPropagation();
            event.preventDefault();

        }

    }

    onNodeMouseUp(event: MouseEvent, id: string): void {

        if (this._mode === this._MODE_LINK) {
            this.endLink(event, id, 'TARGET');

        }

    }

    onPortMouseDown(event: MouseEvent, id: string, port: string): void {

        this.startLink(event, id, port);

        event.stopPropagation();
        event.preventDefault();

    }

    onPortMouseMove(event: MouseEvent, id: string, port: string): void {

        if (this._mode === this._MODE_LINK) {

            this.whileLinkOn(event, id, port);

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


    // API

    updateNodes(externalNodes: Array<INode>) {

        const externalNodeIdSet = new Set(externalNodes.map(node => node.id));

        const nodeIdsToDelete = Array.from(this._nodes.keys()).filter(id => !externalNodeIdSet.has(id));

        nodeIdsToDelete.forEach(id => {
            this._deleteNodeById(id);
        });

        externalNodes.forEach(node => {
            const internal = this._nodes.get(node.id);

            if (internal) {
                if (deepEqual(node.ports, internal.external.ports)) {
                    internal.external = node;
                } else {
                    this._deleteNode(internal);
                    this._addNewNode(node);
                }
            } else {
                this._addNewNode(node);
            }

        });

    }

    updateLinks(externalLinks: Array<ILink>) {

        const externalLinkIdSet = new Set(externalLinks.map(link => {
            const sourcePort = link.sourcePort ? link.sourcePort : 'SOURCE';
            const targetPort = link.targetPort ? link.targetPort : 'TARGET';
            const id = link.id || (link.source + sourcePort + link.target + targetPort);
            return id;
        }));

        const linkIdsToDelete = Array.from(this._links.keys()).filter(id => !externalLinkIdSet.has(id));

        linkIdsToDelete.forEach(id => {
            this._deleteLinkById(id);
        });

        externalLinks.forEach(link => {

            const sourcePort = link.sourcePort ? link.sourcePort : 'SOURCE';
            const targetPort = link.targetPort ? link.targetPort : 'TARGET';
            const id = link.id || (link.source + sourcePort + link.target + targetPort);

            if (this._links.has(id)) { // todo: future conflict between internal key vs external id
                this._links.get(id).external = link; // todo: what about ports ?
            } else {
                this._addNewLink(link);
            }

        });

    }

    mergeNodes(externalNodes: Array<INode>) {

        externalNodes.forEach(node => {
            const internal = this._nodes.get(node.id);

            if (internal) {
                if (deepEqual(node.ports, internal.external.ports)) {
                    internal.external = node;
                } else {
                    this._deleteNode(internal);
                    this._addNewNode(node);
                }
            } else {
                this._addNewNode(node);
            }

        });

    }

    mergeLinks(externalLinks: Array<ILink>) {

        externalLinks.forEach(link => {

            const sourcePort = link.sourcePort ? link.sourcePort : 'SOURCE';
            const targetPort = link.targetPort ? link.targetPort : 'TARGET';
            const id = link.id || (link.source + sourcePort + link.target + targetPort);

            if (this._links.has(id)) { // todo: future conflict between internal key vs external id
                this._links.get(id).external = link; // todo: what about ports ?
            } else {
                this._addNewLink(link);
            }

        });


    }

    moveNodeTo(nodeId: string, x: number, y: number) {

        const node = this._nodes.get(nodeId);

        node.x = x;
        node.y = y;

        node.links.forEach(linkId => {
            this._linkIdsToUpdateLinkPath.add(linkId);
        });

    }

    async autoLayout() {
        return this._diagramLayout.applyAutoLayout().then(() => {
            if (this._updateLinkPaths()) {
                // console.log('autoLayout');
                this.changeDetectorRef.detectChanges();
            }
        });
    }

    redraw() {
        this.changeDetectorRef.detectChanges();
    }


    // depreciated:

    addNodeTo(externalNode: INode, x: number, y: number) {
        const internalNode = this._addNewNode(externalNode);
        internalNode.x = x;
        internalNode.y = y;
    }

    addData(externalNodes: Array<INode>, externalLinks: Array<ILink>) {

        externalNodes.forEach(node => {
            this._addNewNode(node);
        });

        externalLinks.forEach(link => {
            this._addNewLink(link);
        });

    }


}

