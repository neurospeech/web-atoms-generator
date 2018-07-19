import { existsSync, PathLike, readFileSync, statSync, writeFileSync } from "fs";
import { DomHandler, Parser } from "htmlparser2";
import { parse, sep } from "path";
import { IHtmlNode } from "../html-node";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";
import { IWAConfig } from "../types";
import { CoreHtmlComponent } from "./CoreHtmlComponent";
import { IImportDefinitions } from "./IImportDefinitions";
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

    constructor(public file: PathLike, private config: IWAConfig) {

    }

    public compile(): void {

        try {

            this.nodes.length = 0;

            const content = readFileSync(this.file, { encoding: "utf-8" });

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

            const root = this.nodes[0];

            const p = parse(this.file.toString());

            const fname = p.dir + sep + root.name + ".ts";

            let generatedText: string = importStatement + root.generated;

            generatedText = ReplaceTilt.replace(generatedText, p.dir);

            // if (existsSync(fname)) {

            // }
            writeFileSync(fname, generatedText );
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
            throw new Error("Only single top level root allowed");
        }

        const pname = parse(this.file.toString());

        const name = pname.name.split("-").map( (s) => s.charAt(0).toUpperCase() + s.substr(1)).join("");

        const root = new CoreHtmlComponent(this);
        root.root = new WAComponent(null, roots[0], name, "AtomControl") ;
        root.name = name;
        root.root.export = true;

        this.nodes.push(root);

        root.config = this.config;
        root.generateCode();

        if (script) {
            root.generated = (script.data || script.children.map((s) => s.data).join("\r\n") ) + "\r\n"
                + root.generated;
        }
    }

}
