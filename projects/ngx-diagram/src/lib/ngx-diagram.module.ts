import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {NgxDiagramComponent} from './ngx-diagram/ngx-diagram.component';
import {NgxGraphComponent} from './ngx-graph/ngx-graph.component';
import {MouseWheelDirective} from "./mouse-wheel.directive";

@NgModule({
    imports: [CommonModule],
    declarations: [NgxDiagramComponent, MouseWheelDirective, NgxGraphComponent],
    exports: [NgxDiagramComponent, NgxGraphComponent]
})
export class NgxDiagramModule {
}
