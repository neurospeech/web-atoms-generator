import { existsSync, PathLike, readFileSync, statSync} from "fs";
import { DomHandler, Parser } from "htmlparser2";
import { parse, sep } from "path";
import FileApi from "../FileApi";
import { IHtmlNode } from "../html-node";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";
import { IWAConfig } from "../types";
import { CoreHtmlComponent } from "./CoreHtmlComponent";
import { IImportDefinitions } from "./IImportDefinitions";
import ISourceLines from "./ISourceLines";
import { ReplaceTilt } from "./ReplaceTilt";
import { WAComponent } from "./WAComponents";

export class CoreHtmlFile implements IMarkupFile {

    public get currentTime(): number {
        if (!existsSync(this.file)) {
            return -1;
        }
        return statSync(this.file).mtime.getTime();
    }

    public lastTime: number;
    // public file: PathLike;
    public nodes: IMarkupComponent[] = [];

    public imports: IImportDefinitions = {};
    public importNameIndex = 1;

    public content: string;

    private mFileLines: ISourceLines = null;
    public get fileLines(): ISourceLines {
        if (!this.mFileLines) {
            // tslint:disable-next-line: no-var-keyword
            var last: number = 0;
            const nl = this.content.split("\n").map((x, i) => {
                const n = last;
                last += x.length + 1;
                return {
                    line: i,
                    start: n,
                    length: x.length + 1
                };
            });
            this.mFileLines = nl;
        }
        return this.mFileLines;
    }

    constructor(public file: PathLike, private config: IWAConfig) {

    }

    public reportError(element: IHtmlNode, er: Error): void {
        const en = element.startIndex || 0;
        let cn = 0;
        const lines = this.fileLines;
        const ln = lines.find( (x) => x.start + x.length < en ) || lines[0];
        cn = en - ln.start;
        const errorText = `${er.message}`.split("\n").join(" ").split("\r").join("");
        const fn = this.file.toString().split("\\").join("/");
        // tslint:disable-next-line:no-console
        console.error(`${fn}(${ln.line},${cn}): error TS0001: ${errorText}.`);
    }

    public compile(packageContent: any): void {

        try {

            this.nodes.length = 0;

            const content = readFileSync(this.file, { encoding: "utf-8" });

            this.content = content;

            this.compileContent(content);
            this.lastTime = this.currentTime;

            let importStatement: string = "// tslint:disable\r\n";
            for (const key in this.imports) {
                if (this.imports.hasOwnProperty(key)) {
                    const element = this.imports[key];
                    if (element.prefix) {
                        importStatement += `import * as ${element.prefix} from "${element.import}";\r\n`;
                    } else {
                        importStatement += `import {${element.name}} from "${element.import}";\r\n`;
                    }
                }
            }

            // root.generated = importStatement;

            const root = this.nodes[0] as CoreHtmlComponent;

            const p = parse(this.file.toString());

            const fname = p.dir + sep + root.name + ".ts";

            let generatedText: string = importStatement + root.generated;

            generatedText = ReplaceTilt.replace(generatedText, p.dir);

            // generatedText += `\n//# sourceMappingUrl=${root.name}.ts.map`;
            FileApi.writeSync(fname, generatedText);
            // FileApi.writeSync(fname + ".map", JSON.stringify(root.sourceMap));
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
        }

    }

    public compileContent(content: string): void {

        const handler = new DomHandler( (error, dom) => {
            if (error) {
                // tslint:disable-next-line:no-console
                console.error(error);
            }
        }, { withStartIndices: true });

        const parser = new Parser(handler, {
            lowerCaseTags: false
        });
        parser.write(content);
        parser.end();

        this.processNodes(handler.dom as IHtmlNode[]);
    }

    public processNodes(nodes: IHtmlNode[]): void {
        // root node must be single..

        const script = nodes.find( (x) => x.type === "script");

        nodes = nodes.filter( (x) => x !== script);

        const roots = nodes.filter( (x) => x.type && x.type === "tag");
        if (roots.length > 1) {
            throw new Error(`Error: Only single top level root allowed - ${this.file}`);
        }

        const pname = parse(this.file.toString());

        const name = pname.name.split("-").map( (s) => s.charAt(0).toUpperCase() + s.substr(1)).join("");

        this.imports.BindableProperty = {
            name: "BindableProperty",
            import: "web-atoms-core/dist/core/BindableProperty"
        };

        const root = new CoreHtmlComponent(this, roots[0], name, "AtomControl");
        // root.root = new WAComponent(this, roots[0], name, "AtomControl") ;
        root.name = name;
        root.export = true;

        this.nodes.push(root);

        root.config = this.config;
        if (script) {
            root.generated = (script.data || script.children.map((s) => s.data).join("\r\n") ) + "\r\n";
        }

        const p = parse(this.file as string);

        root.generateCode(p.base, this.fileLines);

    }

}
