export interface IMatrix {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

export interface IVector {
    x: number;
    y: number;
}

export namespace Vector {

    export function add(a: IVector, b: IVector): IVector {
        return {x: a.x + b.x, y: a.y + b.y};
    }

    export function subtract(a: IVector, b: IVector): IVector {
        return {x: a.x - b.x, y: a.y - b.y};
    }

    export function dot(a: IVector, b: IVector): number {
        return a.x * b.x + a.y * b.y;
    }

    export function copy(a: IVector): IVector {
        return {x: a.x, y: a.y};
    }

    export function norm(a: IVector): number {
        return Math.sqrt(a.x * a.x + a.y * a.y);
    }

    export function mult(a: IVector, scalar: number): IVector {
        return {x: scalar * a.x, y: scalar * a.y};
    }

    export function distance(a: IVector, b: IVector) {
        return norm(subtract(a, b));
    }

    export function unit(a: IVector): IVector {
        return mult(a, 1.0 / norm(a));
    }

    export function mid(a: IVector, b: IVector, scalar: number) {
        return {x: scalar * (a.x + b.x), y: scalar * (a.y + b.y)};
    }

}

export interface IPoint {
    x: number;
    y: number;
}

export interface ISurfacePoint extends IPoint {
    nx: number;
    ny: number;
    a: number;
}

export namespace SurfacePoint {

    export function optimalSPToSP(sourceSPs: Array<ISurfacePoint>, targetSPs: Array<ISurfacePoint>) {

        let max = -Infinity;

        let choice = null;

        for (const s of sourceSPs) {
            for (const t of targetSPs) {

                const dx = t.x - s.x;
                const dy = t.y - s.y;

                const d = Math.sqrt(dx * dx + dy * dy);

                const a = dx * s.nx + dy * s.ny;
                const b = -dx * t.nx - dy * t.ny;

                const c = (a * s.a + b * t.a) / d;

                if (c > max) {
                    max = c;
                    choice = {s, t, d};
                }

            }
        }

        return choice;

    }

    export function optimalSPToP(sourcePoints: Array<ISurfacePoint>, p: IPoint) {

        let max = -Infinity;

        let choice = null;

        for (const s of sourcePoints) {

            const dx = p.x - s.x;
            const dy = p.y - s.y;

            const d = Math.sqrt(dx * dx + dy * dy);

            const a = dx * s.nx + dy * s.ny;

            const c = (a * s.a) / d;

            if (c > max) {
                max = c;
                choice = {s, d};
            }

        }

        return choice;

    }

    export function pathSPToSP(s: ISurfacePoint, t: ISurfacePoint) {

        const d = Vector.subtract(t, s);

        if (Vector.dot({x: s.nx, y: s.ny}, {x: -t.nx, y: -t.ny}) < 0.25) { // corner

            const sx = Math.abs(d.x);
            const sy = Math.abs((d.y));

            return [
                {x: s.x, y: s.y},
                {x: s.x + s.nx * sx, y: s.y + s.ny * sy},
                {x: t.x, y: t.y},
            ];

        } else {

            const sx = Math.abs(d.x / 2);
            const sy = Math.abs((d.y / 2));

            return [
                {x: s.x, y: s.y},
                {x: s.x + s.nx * sx, y: s.y + s.ny * sy},
                {x: t.x + t.nx * sx, y: t.y + t.ny * sy},
                {x: t.x, y: t.y},
            ];

        }

    }

    export function pathSPToP(s: ISurfacePoint, p: IPoint) {

        const d = Vector.subtract(p, s);

        const sx = Math.abs(d.x);
        const sy = Math.abs((d.y));

        return [
            {x: s.x, y: s.y},
            {x: s.x + s.nx * sx, y: s.y + s.ny * sy},
            {x: p.x, y: p.y},
        ];

    }

}

export interface IRectangle extends IPoint {
    w: number;
    h: number;
}

export namespace Rectangle {

    export function cornersToTLBR(a: IPoint, b: IPoint): IRectangle {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.max(a.x, b.x) - x;
        const h = Math.max(a.y, b.y) - y;
        return {x, y, w, h};
    }

    function midSPs(r: IRectangle): Array<ISurfacePoint> {
        return [
            {x: r.x, y: r.y + 0.5 * r.h, nx: -1, ny: 0, a: r.h},
            {x: r.x + 0.5 * r.w, y: r.y, nx: 0, ny: -1, a: r.w},
            {x: r.x + r.w, y: r.y + 0.5 * r.h, nx: 1, ny: 0, a: r.h},
            {x: r.x + 0.5 * r.w, y: r.y + r.h, nx: 0, ny: 1, a: r.w}
        ];
    }

    export function pathRectToRect(sr: IRectangle, tr: IRectangle) {
        const {s, t} = SurfacePoint.optimalSPToSP(midSPs(sr), midSPs(tr));
        return SurfacePoint.pathSPToSP(s, t);
    }

    export function pathRectToPoint(sr: IRectangle, p: IPoint) {
        const {s} = SurfacePoint.optimalSPToP(midSPs(sr), p);
        return SurfacePoint.pathSPToP(s, p);
    }

}

export interface IPort {
    x: number;
    y: number;
}


export interface IDimension {
    h: number;
    w: number;
}


export interface INode {
    id: string;
    ports?: any;
}

export interface ILink {
    id?: string;

    source: string;
    sourcePort?: string;
    target: string;
    targetPort?: string;
}


export interface IInternalNode {
    id: string;

    x: number;
    y: number;
    h: number;
    w: number;

    ports: Map<string, IPort>;
    links: Set<string>;

    selected: boolean;

    external: INode;
}

export interface IInternalLink {
    id: string;

    source: string;
    sourcePort: string;
    target: string;
    targetPort: string;

    path: Array<IPoint>;

    external: ILink;
}

