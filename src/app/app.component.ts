import {Component, ViewChild} from '@angular/core';
import {NgxDiagramComponent} from 'ngx-diagram';


function id() {
    return '' + Math.random().toString(36).substr(2, 9);
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    @ViewChild('diagram') diagram: NgxDiagramComponent;
    selection = [];

    ngOnInit() {

        const externalNodes = [];
        for (let i = 0; i < 10; i++) {
            const idl = id();
            externalNodes.push({id: idl});
            this.diagram.addNodeTo({id: idl}, (Math.random() - 0.5) * 1000, (Math.random() - 0.5) * 1000);

        }
        const externalLinks = [];
        externalNodes.forEach(source => {
            for (let i = 0; i < 1; i++) {
                const target = externalNodes[Math.floor(Math.random() * externalNodes.length)];
                externalLinks.push({source: source.id, target: target.id});
            }
        });


        this.diagram.addData([], externalLinks);
    }

    connected(connection) {
        if (connection.source.id !== connection.target.id) {
            this.diagram.addData([], [{source: connection.source.id, target: connection.target.id}]);
        }
    }

    created(creation) {
        this.diagram.addNodeTo({id: id()}, creation.x, creation.y);
    }

    selected(selection) {
        this.selection = selection;
    }

}
