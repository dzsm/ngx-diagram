import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {NgxDiagramComponent} from './ngx-diagram.component';
import {MouseWheelDirective} from "./mouse-wheel.directive";

@NgModule({
    imports: [CommonModule],
    declarations: [NgxDiagramComponent, MouseWheelDirective],
    exports: [NgxDiagramComponent]
})
export class NgxDiagramModule {
}
