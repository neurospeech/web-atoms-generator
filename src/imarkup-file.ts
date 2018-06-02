import { PathLike } from "fs";

export interface IMarkupFile {
    currentTime: number;
    lastTime: number;
    file: PathLike;

    compile(): void;

    nodes: Array<IMarkupComponent>;
}

export interface IMarkupComponent {
    baseType: string;
    name: string;
    nsNamespace: string;

    generated: string;
}