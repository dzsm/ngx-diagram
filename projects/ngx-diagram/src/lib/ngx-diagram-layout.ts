import ELK from 'elkjs/lib/elk.bundled.js';
import {IGraph, IInternalLink, IInternalNode} from './ngx-diagram.models';


export class NgxDiagramLayout {

    elk = new ELK();
    autoLayoutAlgorithms = [];

    constructor(private _nodesRef: Map<string, IInternalNode>, private _linksRef: Map<string, IInternalLink>, private _linkIdsToUpdateLinkPathRef: Set<string>) {
        this.elk.knownLayoutAlgorithms().then(r => {
            this.autoLayoutAlgorithms = r;
        });
    }


    applyAutoLayout(autoLayoutAlgorithm = this.autoLayoutAlgorithms[3]) {

        const graph = {
            id: 'root',
            /*layoutOptions: {
              'org.eclipse.elk.stress.fixed': false,
              'elk.algorithm': autoLayoutAlgorithm.id, 'elk.layered.spacing.nodeNodeBetweenLayers': 40
            },*/
            children: Array.from(this._nodesRef.values()).map(node => ({id: node.id, width: node.w, height: node.h})),
            edges: Array.from(this._linksRef.values()).map(edge => ({
                id: edge.id,
                sources: [edge.source],
                targets: [edge.target]
            }))
        };

        return this.elk.layout(graph, {
            layoutOptions: {
                // 'org.eclipse.elk.layered.mergeEdges': true,
                'elk.algorithm': autoLayoutAlgorithm.id,
                'elk.layered.spacing.nodeNodeBetweenLayers': 75,
                'elk.spacing.componentComponent': 75,
                'elk.spacing.nodeNode': 50
            }
        })
            .then(g => {
                /*
                console.log(g);
                this._internalEdges.forEach((edge) => {
                  const e = g.edges.find(item => item.id === edge.internalId);

                  edge.points = [];
                  if (e.sections) {
                    e.sections.forEach(section => {
                      edge.points.push(section.startPoint);
                      if (section.bendPoints) {
                        edge.points.push(...section.bendPoints);
                      }
                      edge.points.push(section.endPoint);
                    });
                  }
                });
        */

                g.children.forEach(newNode => {
                    const node = this._nodesRef.get(newNode.id);

                    if (node.x === newNode.x && node.y === newNode.y) {
                        return;
                    }

                    node.x = newNode.x;
                    node.y = newNode.y;

                    node.links.forEach(linkId => {
                        this._linkIdsToUpdateLinkPathRef.add(linkId);
                    });

                });

            })
            .catch(console.error);


    }

}

export class NgxDiagramLayout2 {

    elk = new ELK();
    autoLayoutAlgorithms = [];

    constructor(private _graph: IGraph, private _linkIdsToUpdateLinkPathRef: Set<string>) {
        this.elk.knownLayoutAlgorithms().then(r => {
            this.autoLayoutAlgorithms = r;
        });
    }


    applyAutoLayout(autoLayoutAlgorithm = this.autoLayoutAlgorithms[3]) {

        const graph = {
            id: 'root',
            /*layoutOptions: {
              'org.eclipse.elk.stress.fixed': false,
              'elk.algorithm': autoLayoutAlgorithm.id, 'elk.layered.spacing.nodeNodeBetweenLayers': 40
            },*/
            children: Object.values(this._graph.v).map(node => ({id: node._id, width: node._w, height: node._h})),
            edges: Object.values(this._graph.e).map(edge => ({
                id: edge._id,
                sources: [edge._s],
                targets: [edge._t]
            }))
        };

        return this.elk.layout(graph, {
            layoutOptions: {
                'org.eclipse.elk.layered.mergeEdges': false,
                'elk.algorithm': autoLayoutAlgorithm.id,
                'elk.layered.spacing.nodeNodeBetweenLayers': 75,
                'elk.spacing.componentComponent': 75,
                'elk.spacing.nodeNode': 50
            }
        })
            .then(g => {

                //console.log(g);
                Object.values(this._graph.e).forEach((edge) => {
                    const e = g.edges.find(item => item.id === edge._id);

                    edge._p = [];
                    if (e.sections) {
                        e.sections.forEach(section => {
                            edge._p.push(section.startPoint);
                            if (section.bendPoints) {
                                edge._p.push(...section.bendPoints);
                            }
                            edge._p.push(section.endPoint);
                        });
                    }

                    this._graph.e[edge._id] = edge;

                    //this._linkIdsToUpdateLinkPathRef.add(edge._id);
                });


                g.children.forEach(newNode => {
                    const node = this._graph.v[newNode.id];

                    if (node._x === newNode.x && node._y === newNode.y) {
                        return;
                    }

                    node._x = newNode.x;
                    node._y = newNode.y;

                    node._s.forEach(linkId => {
                        // this._linkIdsToUpdateLinkPathRef.add(linkId);
                    });

                    node._t.forEach(linkId => {
                        // this._linkIdsToUpdateLinkPathRef.add(linkId);
                    });


                });

            })
            .catch(console.error);


    }

}
