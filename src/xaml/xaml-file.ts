import { PathLike, readFileSync, statSync } from "fs";
import { XmlDocument, XmlElement } from "xmldoc";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";
import { IWAConfig } from "../types";

export class XamlComponent implements IMarkupComponent {
    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string;
}

export class XamlFile implements IMarkupFile {

    public lastTime: number;
    public file: PathLike;
    public nodes: XamlComponent[];
    public get currentTime(): number {
        return statSync(this.file).mtime.getTime();
    }

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
    }
}
