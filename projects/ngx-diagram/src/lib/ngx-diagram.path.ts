/*

Based on https://github.com/qiao/PathFinding.js by modifying to count turns and penalize

MIT License

© 2011-2012 Xueqiao Xu <xueqiaoxu@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

import Heap from 'heap'
import {IPoint, IRectangle} from "./ngx-diagram.models";

const DiagonalMovement = {
    Always: 1,
    Never: 2,
    IfAtMostOneObstacle: 3,
    OnlyWhenNoObstacles: 4
};

export class Node {
    constructor(public x, public y, public walkable = true) {
    }
}

export class Grid {
    nodes: Array<Array<Node>>;

    constructor(public width, public height) {

        this.nodes = new Array<Array<Node>>(height);

        for (let i = 0; i < height; ++i) {
            this.nodes[i] = new Array<Node>(width);
            for (let j = 0; j < width; ++j) {
                this.nodes[i][j] = new Node(j, i);
            }
        }

    }

    getNodeAt(x, y) {
        return this.nodes[y][x];
    };

    isWalkableAt(x, y) {
        return this.isInside(x, y) && this.nodes[y][x].walkable;
    };

    isInside(x, y) {
        return (x >= 0 && x < this.width) && (y >= 0 && y < this.height);
    };


    setWalkableAt(x, y, walkable) {
        this.nodes[y][x].walkable = walkable;
    };

    /**
     * Get the neighbors of the given node.
     *
     *     offsets      diagonalOffsets:
     *  +---+---+---+    +---+---+---+
     *  |   | 0 |   |    | 0 |   | 1 |
     *  +---+---+---+    +---+---+---+
     *  | 3 |   | 1 |    |   |   |   |
     *  +---+---+---+    +---+---+---+
     *  |   | 2 |   |    | 3 |   | 2 |
     *  +---+---+---+    +---+---+---+
     *
     *  When allowDiagonal is true, if offsets[i] is valid, then
     *  diagonalOffsets[i] and
     *  diagonalOffsets[(i + 1) % 4] is valid.
     */
    getNeighbors(node, diagonalMovement) {
        var x = node.x,
            y = node.y,
            neighbors = [],
            s0 = false, d0 = false,
            s1 = false, d1 = false,
            s2 = false, d2 = false,
            s3 = false, d3 = false,
            nodes = this.nodes;

        // ↑
        if (this.isWalkableAt(x, y - 1)) {
            neighbors.push(nodes[y - 1][x]);
            s0 = true;
        }
        // →
        if (this.isWalkableAt(x + 1, y)) {
            neighbors.push(nodes[y][x + 1]);
            s1 = true;
        }
        // ↓
        if (this.isWalkableAt(x, y + 1)) {
            neighbors.push(nodes[y + 1][x]);
            s2 = true;
        }
        // ←
        if (this.isWalkableAt(x - 1, y)) {
            neighbors.push(nodes[y][x - 1]);
            s3 = true;
        }

        if (diagonalMovement === DiagonalMovement.Never) {
            return neighbors;
        }

        if (diagonalMovement === DiagonalMovement.OnlyWhenNoObstacles) {
            d0 = s3 && s0;
            d1 = s0 && s1;
            d2 = s1 && s2;
            d3 = s2 && s3;
        } else if (diagonalMovement === DiagonalMovement.IfAtMostOneObstacle) {
            d0 = s3 || s0;
            d1 = s0 || s1;
            d2 = s1 || s2;
            d3 = s2 || s3;
        } else if (diagonalMovement === DiagonalMovement.Always) {
            d0 = true;
            d1 = true;
            d2 = true;
            d3 = true;
        } else {
            throw new Error('Incorrect value of diagonalMovement');
        }

        // ↖
        if (d0 && this.isWalkableAt(x - 1, y - 1)) {
            neighbors.push(nodes[y - 1][x - 1]);
        }
        // ↗
        if (d1 && this.isWalkableAt(x + 1, y - 1)) {
            neighbors.push(nodes[y - 1][x + 1]);
        }
        // ↘
        if (d2 && this.isWalkableAt(x + 1, y + 1)) {
            neighbors.push(nodes[y + 1][x + 1]);
        }
        // ↙
        if (d3 && this.isWalkableAt(x - 1, y + 1)) {
            neighbors.push(nodes[y + 1][x - 1]);
        }

        return neighbors;
    };


    clone() {
        var i, j,

            width = this.width,
            height = this.height,
            thisNodes = this.nodes,

            newGrid = new Grid(width, height),
            newNodes = new Array(height);

        for (i = 0; i < height; ++i) {
            newNodes[i] = new Array(width);
            for (j = 0; j < width; ++j) {
                newNodes[i][j] = new Node(j, i, thisNodes[i][j].walkable);
            }
        }

        newGrid.nodes = newNodes;

        return newGrid;
    };

    static backtrace(node) {
        var path = [[node.x, node.y]];
        while (node.parent) {
            node = node.parent;
            path.push([node.x, node.y]);
        }
        return path.reverse();
    }

    static biBacktrace(nodeA, nodeB) {
        var pathA = this.backtrace(nodeA),
            pathB = this.backtrace(nodeB);
        return pathA.concat(pathB.reverse());
    }

    static pathLength(path) {
        var i, sum = 0, a, b, dx, dy;
        for (i = 1; i < path.length; ++i) {
            a = path[i - 1];
            b = path[i];
            dx = a[0] - b[0];
            dy = a[1] - b[1];
            sum += Math.sqrt(dx * dx + dy * dy);
        }
        return sum;
    }

    static compressPath(path) {

        // nothing to compress
        if (path.length < 3) {
            return path;
        }

        var compressed = [],
            sx = path[0][0], // start x
            sy = path[0][1], // start y
            px = path[1][0], // second point x
            py = path[1][1], // second point y
            dx = px - sx, // direction between the two points
            dy = py - sy, // direction between the two points
            lx, ly,
            ldx, ldy,
            sq, i;

        // normalize the direction
        sq = Math.sqrt(dx * dx + dy * dy);
        dx /= sq;
        dy /= sq;

        // start the new path
        compressed.push([sx, sy]);

        for (i = 2; i < path.length; i++) {

            // store the last point
            lx = px;
            ly = py;

            // store the last direction
            ldx = dx;
            ldy = dy;

            // next point
            px = path[i][0];
            py = path[i][1];

            // next direction
            dx = px - lx;
            dy = py - ly;

            // normalize
            sq = Math.sqrt(dx * dx + dy * dy);
            dx /= sq;
            dy /= sq;

            // if the direction has changed, store the point
            if (dx !== ldx || dy !== ldy) {
                compressed.push([lx, ly]);
            }
        }

        // store the last point
        compressed.push([px, py]);

        return compressed;
    }
}

namespace Heuristic {

    export function manhattan(dx, dy) {
        return dx + dy;
    }

    export function euclidean(dx, dy) {
        return Math.sqrt(dx * dx + dy * dy);
    }

    export function octile(dx, dy) {
        var F = Math.SQRT2 - 1;
        return (dx < dy) ? F * dx + dy : F * dy + dx;
    }

    export function chebyshev(dx, dy) {
        return Math.max(dx, dy);
    }

}

class AStarFinder {

    allowDiagonal: any;
    diagonalMovement: any;
    dontCrossCorners: any;
    heuristic: any;
    weight: any;

    constructor(opt) {

        opt = opt || {};
        this.allowDiagonal = opt.allowDiagonal;
        this.dontCrossCorners = opt.dontCrossCorners;
        this.heuristic = opt.heuristic || Heuristic.manhattan;
        this.weight = opt.weight || 1;
        this.diagonalMovement = opt.diagonalMovement;

        if (!this.diagonalMovement) {
            if (!this.allowDiagonal) {
                this.diagonalMovement = DiagonalMovement.Never;
            } else {
                if (this.dontCrossCorners) {
                    this.diagonalMovement = DiagonalMovement.OnlyWhenNoObstacles;
                } else {
                    this.diagonalMovement = DiagonalMovement.IfAtMostOneObstacle;
                }
            }
        }

        // When diagonal movement is allowed the manhattan heuristic is not
        //admissible. It should be octile instead
        if (this.diagonalMovement === DiagonalMovement.Never) {
            this.heuristic = opt.heuristic || Heuristic.manhattan;
        } else {
            this.heuristic = opt.heuristic || Heuristic.octile;
        }

    }

    findPath = function (startX, startY, endX, endY, grid) {
        var openList = new Heap(function (nodeA, nodeB) {
                return nodeA.f - nodeB.f;
            }),
            startNode = grid.getNodeAt(startX, startY),
            endNode = grid.getNodeAt(endX, endY),
            heuristic = this.heuristic,
            diagonalMovement = this.diagonalMovement,
            weight = this.weight,
            abs = Math.abs, SQRT2 = Math.SQRT2,
            node, neighbors, neighbor, i, l, x, y, ng;

        // set the `g` and `f` value of the start node to be 0
        startNode.g = 0;
        startNode.f = 0;

        startNode.dx = 0;  ///new
        startNode.dy = 0;  ///new

        // push the start node into the open list
        openList.push(startNode);
        startNode.opened = true;

        // while the open list is not empty
        while (!openList.empty()) {
            // pop the position of node which has the minimum `f` value.
            node = openList.pop();
            node.closed = true;

            // if reached the end position, construct the path and return it
            if (node === endNode) {
                return Grid.backtrace(endNode);
            }

            // get neigbours of the current node
            neighbors = grid.getNeighbors(node, diagonalMovement);
            for (i = 0, l = neighbors.length; i < l; ++i) {
                neighbor = neighbors[i];

                if (neighbor.closed) {
                    continue;
                }

                x = neighbor.x;
                y = neighbor.y;

                const dx = x - node.x;
                const dy = y - node.y;

                const turnCost = grid.width * grid.height * (abs(node.dx - dx) + abs(node.dy - dy));
                // get the distance between current node and the neighbor
                // and calculate the next g score
                ng = node.g + ((x - node.x === 0 || y - node.y === 0) ? 1 : SQRT2) + turnCost;

                // check if the neighbor has not been inspected yet, or
                // can be reached with smaller cost from the current node
                if (!neighbor.opened || ng < neighbor.g) {
                    neighbor.g = ng;
                    neighbor.h = neighbor.h || weight * heuristic(abs(x - endX) * 1.1, abs(y - endY));
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = node;

                    neighbor.dx = dx;
                    neighbor.dy = dy;

                    if (!neighbor.opened) {
                        openList.push(neighbor);
                        neighbor.opened = true;
                    } else {
                        // the neighbor can be reached with smaller cost.
                        // Since its f value has been updated, we have to
                        // update its position in the open list
                        openList.updateItem(neighbor);
                    }
                }
            } // end for each neighbor
        } // end while not open list empty

        // fail to find the path
        return [];
    };


}

export class NgxDiagramPath {

    grid: any;

    world = {x: -5000, y: -5000, h: 10000, w: 10000};
    gridSize = {x: 500, y: 500};

    constructor() {
    }

    find(s: IPoint, t: IPoint, rectangles: IterableIterator<IRectangle>) {

        const min = {x: Math.min(s.x, t.x), y: Math.min(s.y, t.y)};
        const max = {x: Math.max(s.x, t.x), y: Math.max(s.y, t.y)};

        const d = {x: t.x - s.x, y: t.y - s.y};
        const da = {x: Math.max(Math.abs(d.x), Math.abs(d.y), 25), y: Math.max(Math.abs(d.y), Math.abs(d.x), 25)};

        const gh = 25; // approximate grid spacing
        const dag = {x: Math.round(da.x / gh), y: Math.round(da.y / gh)};
        const ghg = {x: da.x / dag.x, y: da.y / dag.y};

        this.gridSize = ghg;
        this.world = {
            x: min.x - 5 * this.gridSize.x,
            y: min.y - 5 * this.gridSize.y,
            w: max.x - min.x + 10 * this.gridSize.x,
            h: max.y - min.y + 10 * this.gridSize.y
        };

        this.grid = new Grid(Math.round(this.world.w / this.gridSize.x + 1), Math.round(this.world.h / this.gridSize.y + 1));

        const toGrid = (p) => ({
            x: Math.round((p.x - this.world.x) / this.gridSize.x),
            y: Math.round((p.y - this.world.y) / this.gridSize.y)
        });

        Array.from(rectangles).forEach(rect => {
            const tl = toGrid({
                x: Math.max(rect.x - 5, this.world.x),
                y: Math.max(rect.y - 5, this.world.y)
            });
            const br = toGrid({
                x: Math.min(rect.x + rect.w + 5, this.world.x + this.world.w),
                y: Math.min(rect.y + rect.h + 5, this.world.y + this.world.h)
            });

            for (let ix = tl.x; ix <= br.x; ix++) {
                for (let iy = tl.y; iy <= br.y; iy++) {
                    this.grid.setWalkableAt(ix, iy, false);
                }
            }
        });

        const sg = toGrid(s);
        const tg = toGrid(t);

        //console.log(pathfinding);
        const finder = new AStarFinder({
            allowDiagonal: false,
            diagonalMovement: DiagonalMovement.Never
            // dontCrossCorners: true
        });
        const path = finder.findPath(sg.x, sg.y, tg.x, tg.y, this.grid);
        //const newPath = path.length > 3 ? pathfinding.Util.smoothenPath(this.grid, path) : path;

        this.grid = null;

        return path.map(p => ({x: p[0] * this.gridSize.x + this.world.x, y: p[1] * this.gridSize.y + this.world.y}));

    }


}
