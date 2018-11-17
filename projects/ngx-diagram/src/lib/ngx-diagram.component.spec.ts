import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {NgxDiagramComponent} from './ngx-diagram.component';

describe('NgxDiagramComponent', () => {
    let component: NgxDiagramComponent;
    let fixture: ComponentFixture<NgxDiagramComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [NgxDiagramComponent]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(NgxDiagramComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
