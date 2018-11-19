# ngx-diagram
Angular 6 HTML+SVG based diagram editor component

### Looks like this (with elkjs)

![](peek-ngx-diagram-editor.gif)

### Usage

Place your div node into a template as:
```
<ngx-diagram #diagram (connected)="connected($event)" (clicked)="created($event)" (selected)="selected($event)">
    <ng-template let-node="node">
    
    <div>{{node|json}} <!-- This is your div box as a node -->
    </div>
    
    </ng-template>
</ngx-diagram>
 ```
 
The example component is then:
```

export class AppComponent {
    @ViewChild('diagram') diagram: NgxDiagramComponent;
    selection = [];

    ngOnInit() {

        this.diagram.addData([{id:'1'},{id:'2'}], [{source: '1', target: '2'}]);
        
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


```