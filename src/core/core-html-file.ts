import { PathLike, readFileSync } from "fs";
import { DomHandler, Parser } from "htmlparser2";
import { parse } from "path";
import { AtomEvaluator, CompiledMethod } from "../atom-evaluator";
import { IHtmlNode } from "../html-node";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";
import { IWAConfig } from "../types";

export class CoreHtmlFile implements IMarkupFile {

    public currentTime: number;
    public lastTime: number;
    // public file: PathLike;
    public nodes: CoreHtmlComponent[] = [];

    constructor(public file: PathLike, private config: IWAConfig) {

    }

    public compile(): void {
        const content = readFileSync(this.file, { encoding: "utf-8" });

        this.compileContent(content);
    }

    public compileContent(content: string): void {
        const handler = new DomHandler( (error, dom) => {
            if (error) {
                // tslint:disable-next-line:no-console
                console.error(error);
            }
        }, { withStartIndices: true });

        const parser = new Parser(handler);
        parser.write(content);
        parser.end();

        this.processNodes(handler.dom as IHtmlNode[]);
    }

    public processNodes(nodes: IHtmlNode[]): void {
        // root node must be single..

        const roots = nodes.filter( (x) => x.type && x.type === "tag");
        if (roots.length > 1) {
            throw new Error("Only single top level root allowed");
        }

        const root = new CoreHtmlComponent();
        root.root = roots[0];

        this.nodes.push(root);

        const pname = parse(this.file.toString());

        root.name = pname.name.split("-").map( (s) => s.charAt(0).toUpperCase() + s.substr(1)).join("");
        root.config = this.config;
        root.generateCode();

    }

}

class HtmlContent {

    public static processTwoWayBinding(v: string): string {
        v = v.substr(2, v.length - 3);

        if (v.startsWith("$")) {
            v = v.substr(1);
        }

        const plist = v.split(".");

        v = ` ${JSON.stringify(plist)}, 1 `;

        return v;
    }

    public static escapeLambda(v: string): string {

        v = v.trim();

        if (v.startsWith("()=>") || v.startsWith("() =>") || v.startsWith("=>")) {
            v = v.replace("()=>", "");
            v = v.replace("() =>", "");
            v = v.replace("=>", "");
            return `function(){
    return ${v};
}`;
        }

        return v;
    }

    public static processOneWayBinding(v: string): string {
        v = v.substr(1, v.length - 2);

        v = HtmlContent.escapeLambda(v);

        const vx = AtomEvaluator.instance.parse(v);

        v = "";

        const plist: string = vx.path.map((p, i) => `v${i + 1}`).join(",");

        v += ` ${JSON.stringify(vx.path)}, false , (${plist}) => ${vx.original}`;

        return v;
    }

    public static processOneTimeBinding(v: string): string {
        v = v.substr(1, v.length - 2);

        v = HtmlContent.escapeLambda(v);

        const vx = AtomEvaluator.instance.parse(v);

        v = vx.original;

        for (let i: number = 0; i < vx.path.length; i++) {
            const p: string[] = vx.path[i];
            const start: string = "this";
            v = v.replace(`v${i + 1}`, `Atom.get(this,"${p.join(".")}")`);
        }

        return v;
    }

    public static camelCase(text: string): string {
        if (text.startsWith("atom-")) {
            text = text.substr(5);
        }

        return text.split("-").map((v, i) => {
            if (i) {
                v = v.charAt(0).toUpperCase() + v.substr(1);
            }
            return v;
        }).join("");
    }
}

export class CoreHtmlComponent implements IMarkupComponent {

    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string = "// tslint:disable\r\n";
    public config: IWAConfig;

    public root: IHtmlNode;

    private index: number = 1;

    private imports: {[key: string]: { prefix?: string, name?: string, import?: string }} = {};

    private importNameIndex = 1;

    public resolve(name: string): string {
        if (name === "AtomControl") {
            return name;
        }
        const tokens = name.split(":");
        if (tokens.length === 1) {
            return name;
        }
        const prefix = tokens[0];
        name = tokens[1];

        const p = `i${this.importNameIndex++}`;

        const im = this.imports[name] || (this.imports[name] = { prefix: `${p}`, name: `${p}_${name}` });
        if (!im.import) {
            im.import = this.config.imports[prefix];
            if (!im.import.endsWith("/")) {
                im.import += "/";
            }
            im.import += name;
        }
        return im.name;
    }

    public generateCode(): void {

        this.imports.AtomControl = { name: "AtomControl", import: "web-atoms-core/bin/controls/AtomControl"};

        // resolve base type..
        this.baseType = this.resolve(this.baseType || "AtomControl");

        this.writeLine(`
        export class ${this.name} extends ${this.baseType} {

            public create(): void {
                this.element = document.createElement("${this.root.name}");

                ${this.generateChildren(this.root, "this", "this.element")};
            }
        }

        `);

        let importStatement: string = "";
        for (const key in this.imports) {
            if (this.imports.hasOwnProperty(key)) {
                const element = this.imports[key];
                if (element.prefix) {
                    importStatement += `import * as ${element.prefix} from "${element.import}"\r\n`;
                } else {
                    importStatement += `import ${element.name} from "${element.import}"\r\n`;
                }
            }
        }

        this.generated = "// tslint:disable\r\n"
        + importStatement
        + this.generated;
    }

    public generateChildren(parent: IHtmlNode, controlName: string, elementName: string): string {
        let text: string = "";
        if (!parent.children) {
            return text;
        }
        const parentName = controlName;
        for (const iterator of parent.children) {

            text += "\r\n";

            let itemName = `e${this.index++}`;
            if (iterator.type === "text") {
                text += ` const ${itemName} = document.createTextNode(${JSON.stringify(iterator.data)});
                ${elementName}.appendChild(${itemName});`;
                continue;
            }

            if (iterator.type === "comment") {
                text += ` const ${itemName} = document.createCommentNode(${JSON.stringify(iterator.data)});
                ${elementName}.appendChild(${itemName});`;
                continue;
            }

            if (iterator.type !== "tag") {
                throw new Error(`Node ${iterator.type} not supported`);
            }

            let at = iterator.attribs["atom-type"];
            if (at) {

                at = this.resolve(at);

                text += ` const ${itemName} = new ${at} (document.createElement("${iterator.name}"));
                ${parentName}.append(${itemName});
                `;
                controlName = itemName;
                itemName = `${controlName}.element`;
            } else {
                text += ` const ${itemName} = document.createElement("${iterator.name}");
                ${parentName}.append(${itemName});`;
            }

            for (const key in iterator.attribs) {
                if (iterator.attribs.hasOwnProperty(key)) {
                    const value = iterator.attribs[key];
                    text += this.generateAttribute(key, value, itemName, controlName);
                }
            }

            text += this.generateChildren(iterator, controlName, itemName);

        }
        return text;
    }

    public generateAttribute(key: string, value: string, itemName: string, controlName: string): string {
        let text: string = "\r\n";
        key = HtmlContent.camelCase(key);
        value = value.trim();

        // one time binding
        if (value.startsWith("{") && value.endsWith("}")) {
            value = HtmlContent.processOneTimeBinding(value);
            text += `${controlName}.setLocalValue(${itemName}, "${key}", ${value});`;
            return text;
        }

        if (value.startsWith("[") && value.endsWith("]")) {
            value = HtmlContent.processOneWayBinding(value);
            text += `${controlName}.bind(${itemName}, "${key}", ${value});`;
            return text;
        }

        if (value.startsWith("$[") && value.endsWith("]")) {
            value = HtmlContent.processTwoWayBinding(value);
            text += `${controlName}.bind(${itemName}, "${key}", ${value});`;
            return text;
        }

        text += `${controlName}.setLocalValue(${itemName}, "${key}", "${value}");`;

        return text;
    }

    public writeLine(line?: string): void {
        this.generated += (line || "") + "\r\n";
    }

}
