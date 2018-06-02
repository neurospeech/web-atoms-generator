import { IMarkupFile, IMarkupComponent } from "../imarkup-file";
import { PathLike, readFileSync } from "fs";
import { XmlDocument, XmlElement } from "xmldoc";

export class XamlComponent implements IMarkupComponent {
    baseType: string;
    name: string;
    nsNamespace: string;
    generated: string;
}

export class XamlFile implements IMarkupFile {
    currentTime: number;
    lastTime: number;
    file: PathLike;
    nodes: XamlComponent[];

    nsMap: {[key: string]: string} = {};

    constructor(private fileName: string, private nsNamespace: string){

    }
    compile(): void {
        const content = readFileSync(this.file, { encoding: "utf-8" });

        this.compileContent(content);
        
    }

    compileContent(content: string): void {
        var doc = new XmlDocument(content);

        for(const key in doc.attr) {
            if(doc.attr.hasOwnProperty(key)) {
                if (/^xmlns\:/.test(key)) {
                    const n = key.substr(6);
                    const v = doc.attr[key];
                    this.nsMap[key] = v;
                }
            }
        }
    }
}

