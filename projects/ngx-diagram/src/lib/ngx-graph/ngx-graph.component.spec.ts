import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {NgxGraphComponent} from './ngx-graph.component';

describe('NgxDiagramSimpleComponent', () => {
    let component: NgxGraphComponent;
    let fixture: ComponentFixture<NgxGraphComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [NgxGraphComponent]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(NgxGraphComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
