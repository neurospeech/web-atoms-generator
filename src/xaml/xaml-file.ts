import { existsSync, PathLike, readFileSync, statSync } from "fs";
import { parse, sep } from "path";
import { XmlDocument, XmlElement } from "xmldoc";
import IndentedWriter from "../core/IndentedWriter";
import { ReplaceTilt } from "../core/ReplaceTilt";
import FileApi from "../FileApi";
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

    public nodes: IMarkupComponent[] = [];
    public get currentTime(): number {
        if (!existsSync(this.file)) {
            return -1;
        }
        return statSync(this.file).mtime.getTime();
    }

    public lastTime: number;

    public nsMap: {[key: string]: string} = {};

    constructor(public file: PathLike, private config: IWAConfig) {

    }
    public compile(): void {
        try {
            const content = readFileSync(this.file, { encoding: "utf-8" });

            let generated = this.compileContent(content);

            const p = parse(this.file.toString());

            const fname = p.dir + sep + p.name + ".ts";

            generated = ReplaceTilt.replace(generated, p.dir);

            FileApi.writeSync(fname, generated);

        } catch (e) {
            // tslint:disable-next-line:no-console
            console.error(`File ${this.file} failed to compile\r\n${e}`);
        }

        this.lastTime = this.currentTime;
    }

    public compileContent(content: string): string {
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

        // // tslint:disable-next-line:no-console
        // console.log(wa.toString());

        // for (const iterator of wa.children) {
        //     // tslint:disable-next-line:no-console
        //     console.log(iterator.toString());
        // }

        const iw = new IndentedWriter(content, null, "\t");

        wa.write(iw);

        return iw.toString();
    }

}
