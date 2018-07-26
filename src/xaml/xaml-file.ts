import { existsSync, PathLike, readFileSync, statSync } from "fs";
import { XmlDocument, XmlElement } from "xmldoc";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";
import { IWAConfig } from "../types";
import { WAXComponent } from "./WAXComponent";

export class XamlComponent implements IMarkupComponent {
    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string;
}

export class XamlFile implements IMarkupFile {

    public file: PathLike;
    public nodes: XamlComponent[];
    public get currentTime(): number {
        if (!existsSync(this.file)) {
            return -1;
        }
        return statSync(this.file).mtime.getTime();
    }

    public lastTime: number;

    public nsMap: {[key: string]: string} = {};

    constructor(private fileName: string, private config: IWAConfig) {

    }
    public compile(): void {
        const content = readFileSync(this.file, { encoding: "utf-8" });

        this.compileContent(content);

        this.lastTime = this.currentTime;
    }

    public compileContent(content: string): void {
        const doc = new XmlDocument(content);

        for (const key in doc.attr) {
            if (doc.attr.hasOwnProperty(key)) {
                if (/^xmlns\:/.test(key)) {
                    const n = key.substr(6);
                    const v = doc.attr[key];
                    this.nsMap[key] = v;
                }
            }
        }

        // remove all bindings...
        const wa = new WAXComponent(doc, "Root", []);

        // tslint:disable-next-line:no-console
        console.log(wa.toString());

        for (const iterator of wa.children) {
            // tslint:disable-next-line:no-console
            console.log(iterator.toString());
        }
    }

}
