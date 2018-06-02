import { IMarkupFile, IMarkupComponent } from "../imarkup-file";
import { PathLike } from "fs";

export class CoreHtmlFile implements IMarkupFile {
    currentTime: number;
    lastTime: number;
    file: PathLike;
    compile(): void {
        throw new Error("Method not implemented.");
    }
    nodes: CoreHtmlComponent[];

    constructor(private fileName: string, private nsNamespace: string){

    }
}

export class CoreHtmlComponent implements IMarkupComponent {
    baseType: string;
    name: string;
    nsNamespace: string;
    generated: string;
}