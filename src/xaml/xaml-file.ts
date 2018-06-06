import { PathLike, readFileSync } from "fs";
import { XmlDocument, XmlElement } from "xmldoc";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";

export class XamlComponent implements IMarkupComponent {
    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string;
}

export class XamlFile implements IMarkupFile {
    public currentTime: number;
    public lastTime: number;
    public file: PathLike;
    public nodes: XamlComponent[];

    public nsMap: {[key: string]: string} = {};

    constructor(private fileName: string, private nsNamespace: string) {

    }
    public compile(): void {
        const content = readFileSync(this.file, { encoding: "utf-8" });

        this.compileContent(content);

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
