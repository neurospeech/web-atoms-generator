import { PathLike } from "fs";

export interface IMarkupFile {
    currentTime: number;
    lastTime: number;
    file: PathLike;

    nodes: IMarkupComponent[];

    compile(): void;

}

export interface IMarkupComponent {
    baseType?: string;
    name?: string;
    nsNamespace?: string;

    generated: string;
}
