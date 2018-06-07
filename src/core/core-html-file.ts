import { PathLike, readFileSync } from "fs";
import { DomHandler, Parser } from "htmlparser2";
import { parse } from "path";
import { AtomEvaluator, CompiledMethod } from "../atom-evaluator";
import { IHtmlNode } from "../html-node";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";
import { IWAConfig } from "../types";


enum Binding {
    None,
    OneTime,
    OneWay,
    TwoWay
}

class WANode {

    public get atomParent(): WAComponent {
        if (this instanceof WAComponent) {
            return this as WAComponent;
        }
        return this.parent.atomParent;
    }

    public get namedParent(): WAComponent {
        if (this instanceof WAComponent) {
            const p = this as WAComponent;
            if (p.name) {
                return p;
            }
        }
        return this.parent.namedParent;
    }

    constructor(public parent: WAElement, public name?: string) {
    }

}

class WAAttribute extends WANode {

    public binding: Binding = Binding.None;

    public value: string;

    public template: string;

    public toString(): string {

        if (this.template) {
            return `
        ${this.atomParent.id}.${this.name} = ${this.template};
            `;
        }

        if (this.value.startsWith("{") && this.value.endsWith("}")) {
            const v = HtmlContent.processOneTimeBinding(this.value);
            return `
            ${this.atomParent.id}.setLocalValue(${this.parent.eid}, "${this.name}", Atom.get(${v}) );`;
        }

        if (this.value.startsWith("[") && this.value.endsWith("]")) {
            const v = HtmlContent.processOneWayBinding(this.value);
            return `
            ${this.atomParent.id}.bind(${this.parent.eid}, "${this.name}", ${v});`;
        }

        return `
        ${this.atomParent.id}.setLocalValue(${this.parent.eid}, "${this.name}", ${JSON.stringify(this.value)});
        `;
    }

}

class WAElement extends WANode {

    public attributes: WAAttribute[] = [];

    public children: WAElement[] = [];

    public presenterParent: { name: string, parent: WAComponent };

    public id: string;

    public get eid(): string {
        if (this instanceof WAComponent) {
            return `${this.id}.element`;
        }
        return this.id;
    }

    public get presenterToString(): string {
        if (! this.presenterParent) {
            return "";
        }

        return `
        ${this.presenterParent.parent.id}.${this.presenterParent.name} = ${this.id};`;
    }

    constructor(p: WAElement, protected element: IHtmlNode, name?: string) {
        super(p, name);

        for (const key in this.element.attribs) {
            if (this.element.attribs.hasOwnProperty(key)) {
                const item = this.element.attribs[key];

                if (key === "atom-type" || key === "atom-template") {
                    continue;
                }

                if (key === "atom-presenter") {
                    this.presenterParent = {
                        name: item,
                        parent: this.atomParent
                    };
                    continue;
                }

                this.setAttribute(key, item);
            }
        }

        if (!this.element.children) {
            return;
        }
        for (const iterator of this.element.children) {
            this.parseNode(iterator);
        }

    }

    public addChild(child: WAElement): void {
        this.children.push(child);
        child.parent = this;
    }

    public setAttribute(name: string, value: string, tn?: string): void {
        const a = new WAAttribute(this, name);
        // a.binding = binding;
        a.name = name;
        a.value = value;
        a.template = tn;
        this.attributes.push(a);
    }

    public parseNode(e: IHtmlNode): void {

        if (e.type === "text") {
            this.addChild(new WATextElement(this, e));
            return;
        }

        const tt = e.attribs ? e.attribs["atom-template"] : null;

        if (tt) {

            const np = this.namedParent;
            const ap = this.atomParent;

            const tn = `${np.name}_${tt}_${ap.templates.length + 1}`;

            const tc = new WAComponent(this, e, tn);
            np.templates.push(tc);

            ap.setAttribute(tt, null, tn);
            return;
        }

        const at = e.attribs ? e.attribs["atom-type"] : null;
        if (at) {
            const ac = new WAComponent(this, e, "", at);
            this.addChild(ac);
        } else {
            this.addChild(new WAElement(this, e));
        }
    }

    public resolveNames(c: CoreHtmlComponent) {

        if (!this.id) {
            this.id = `e${this.namedParent.ids++}`;
        }

        for (const iterator of this.children) {
            iterator.resolveNames(c);
        }
    }

    public toString(): string {

        return `
        const ${this.id} = document.createElement("${this.element.name}");
        ${this.presenterToString}
        ${this.atomParent.id}.appendChild(${this.id});
        ${this.attributes.join("\r\n")}`;

    }
}

class WATextElement extends WAElement {
    constructor(p: WAElement, e: IHtmlNode) {
        super(p, e);
    }

    public toString(): string {
        return `
        const ${this.id} = document.createTextNode(${JSON.stringify(this.element.data)});
        ${this.presenterToString}
        ${this.atomParent.id}.appendChild(${this.id});`;
    }
}

class WAComponent extends WAElement {

    public ids: number = 1;

    public export: boolean = false;

    public get templates() {
        return this.mTemplates || (this.mTemplates = []);
    }
    private mTemplates: WAComponent[];

    constructor(
        p: WAElement,
        protected element: IHtmlNode,
        public name: string,
        public baseType?: string) {
        super(p, element, name);

        if (this.name) {
            this.id = "this";
        }
    }

    public resolveNames(e: CoreHtmlComponent): void {
        super.resolveNames(e);

        if (this.baseType) {
            this.baseType = e.resolve(this.baseType);
        }

        for (const item of this.templates) {
            item.resolveNames(e);
        }
    }

    public toString(): string {

        if (this.name) {
            return `
    ${this.export ? "export" : ""} class ${this.name} extends ${this.baseType || "AtomControl"} {

        public create(): void {
            super.create();

            this.element = document.createElement("${this.element.name}");
            ${this.presenterToString}
            ${this.children.join("\r\n")}
            ${this.attributes.join("\r\n")}
        }
    }

    ${this.templates.join("\r\n")}

            `;
        } else {
            return `
            const ${this.id} = new ${this.baseType}(document.createElement("${this.element.name}"));
            ${this.presenterToString}
            ${this.children.join("\r\n")}
            ${this.attributes.join("\r\n")}
            ${this.parent.atomParent.id}.appendChild(${this.id});
`;
        }

    }
}

export class CoreHtmlFile implements IMarkupFile {

    public currentTime: number;
    public lastTime: number;
    // public file: PathLike;
    public nodes: CoreHtmlComponent[] = [];

    private imports: {[key: string]: { prefix?: string, name?: string, import?: string }} = {};

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

        const pname = parse(this.file.toString());

        const name = pname.name.split("-").map( (s) => s.charAt(0).toUpperCase() + s.substr(1)).join("");

        const root = new CoreHtmlComponent();
        root.root = new WAComponent(null, roots[0], name) ;

        this.nodes.push(root);

        root.config = this.config;
        root.generateCode();

    }

}

export class CoreHtmlComponent implements IMarkupComponent {

    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string = "// tslint:disable\r\n";
    public config: IWAConfig;

    public root: WAComponent;

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
        // let us resolve all names...
        this.root.resolveNames(this);

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

        this.generated = importStatement + "\r\n" +
        this.root.toString();

    }

    public writeLine(line?: string): void {
        this.generated += (line || "") + "\r\n";
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
