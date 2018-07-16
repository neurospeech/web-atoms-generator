import { existsSync, PathLike, readFileSync, statSync, writeFileSync } from "fs";
import { DomHandler, Parser } from "htmlparser2";
import { dirname, parse, sep } from "path";
import { AtomEvaluator, CompiledMethod } from "../atom-evaluator";
import { GeneratorContext } from "../generator-context";
import { IHtmlNode } from "../html-node";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";
import { IWAConfig } from "../types";
import { DefaultImports } from "./DefaultImports";

export enum Binding {
    None,
    OneTime,
    OneWay,
    TwoWay
}

export class WANode {

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

export class WAAttribute extends WANode {

    public binding: Binding = Binding.None;

    public value: string;

    public template: string;

    public toString(): string {

        let name = this.name;

        if (/^atom\-/i.test(name)) {
            name = name.substring(5);
        }

        name = name.split("-").map(
            (a, i) => (i ? a.charAt(0).toUpperCase() : a.charAt(0).toLowerCase())  + a.substr(1) ).join("");

        if (name === "defaultStyle") {
            return `
            ${this.atomParent.id}.defaultControlStyle = ${this.value};
            `;
        }

        if (this.template) {
            return `
        ${this.atomParent.id}.${name} = ${this.template}Creator(this);
            `;
        }

        if (this.value.startsWith("{") && this.value.endsWith("}")) {
            const v = HtmlContent.processOneTimeBinding(this.value);
            if (v === this.value) {
                const sv = v.substr(1, v.length - 2);
                return `
                ${this.atomParent.id}.setPrimitiveValue(${this.parent.eid}, "${name}", ${sv});`;
            }
            if (/^(viewmodel|localviewmodel)$/i.test(name)) {
                return `
                ${this.atomParent.id}.${name} = ${v};`;
                }
            return `
            ${this.atomParent.id}.runAfterInit( () =>
            ${this.atomParent.id}.setLocalValue(${this.parent.eid}, "${name}", ${v}) );`;
        }

        if (this.value.startsWith("[") && this.value.endsWith("]")) {
            const v = HtmlContent.processOneWayBinding(this.value);
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ", __creator" : "";
            return `
            ${this.atomParent.id}.bind(${this.parent.eid}, "${name}", ${v.expression} ${startsWithThis});`;
        }

        if (this.value.startsWith("$[") && this.value.endsWith("]")) {
            const v = HtmlContent.processTwoWayBinding(this.value, "true");
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
            return `
            ${this.atomParent.id}.bind(${this.parent.eid}, "${name}", ${v.expression} ${startsWithThis});`;
        }

        if (this.value.startsWith("^[") && this.value.endsWith("]")) {
            const v = HtmlContent.processTwoWayBinding(this.value, `["change", "keyup", "keydown", "blur"]`);
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
            return `
            ${this.atomParent.id}.bind(${this.parent.eid}, "${name}", ${v.expression} ${startsWithThis});`;
        }

        /**
         * setPrimitiveValue will defer setLocalValue if it is to be set on control property, otherwise
         * it will set element attribute directly, this is done to fill element attributes quickly
         * for attributes such as class, row, column etc
         */
        return `
        ${this.atomParent.id}.setPrimitiveValue(${this.parent.eid}, "${name}", ${JSON.stringify(this.value)} );
        `;
    }

}

export class WAElement extends WANode {

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

        try {

            this.processTagName(element);


            if (element.attribs) {
                const defaultStyle = element.attribs["default-style"] || element.attribs.defaultStyle;
                if (defaultStyle) {
                    this.setAttribute("defaultStyle", defaultStyle);
                }
            }

            for (const key in this.element.attribs) {
                if (this.element.attribs.hasOwnProperty(key)) {
                    const item = this.element.attribs[key];

                    if (/^((atom\-type)|((atom-)?template)|(default\-style)|(defaultStyle))/i.test(key)) {
                        continue;
                    }

                    if (key === "atom-component") {
                        // tslint:disable-next-line:no-console
                        console.warn(`atom-component is no longer needed, it will be ignored`);
                        continue;
                    }

                    if (key === "atom-presenter" || key === "presenter") {
                        this.presenterParent = {
                            name: item,
                            parent: this.atomParent
                        };
                        continue;
                    }

                    if (key === "atom-properties" || key === "properties") {
                        // tslint:disable-next-line:no-eval
                        const propertyList = (item as string)
                            .split(",")
                            .map((s) => {
                                const sv = s.split(":");
                                const k = sv[0];
                                const v = sv[1] || null;
                                return { key: k, value: v };
                            });
                        ((this as any) as WAComponent).properties = propertyList;
                        continue;
                    }

                    this.setAttribute(key, item);
                }
            }

            if (!this.element.children) {
                return;
            }
            for (const iterator of this.element.children) {
                if (iterator) {
                    this.parseNode(iterator);
                }
            }
        } catch (er) {
            const en = element.startIndex || 0;
            let cn = 0;
            const ln = GeneratorContext.instance.fileLines.findIndex( (x) => en < x );
            const sln = GeneratorContext.instance.fileLines[ln - 1];
            cn = en - sln;
            const errorText = `${er.message}`.split("\n").join(" ").split("\r").join("");
            // tslint:disable-next-line:no-console
            console.error(`${GeneratorContext.instance.fileName}(${ln},${cn}): error TS0001: ${errorText}.`);
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

        const tt = e.attribs ? (e.attribs.template || e.attribs["atom-template"]) : null;

        if (tt) {

            const np = this.namedParent;
            const ap = this.atomParent;

            const tn = `${np.name}_${tt}_${ap.templates.length + 1}`;

            const tc = new WAComponent(this, e, tn);
            np.templates.push(tc);

            ap.setAttribute(tt, null, tn);
            return;
        }

        this.processTagName(e);

        const at = e.attribs ? e.attribs["atom-type"] : null;
        if (at) {
            const ac = new WAComponent(this, e, "", at);
            this.addChild(ac);
        } else {
            this.addChild(new WAElement(this, e));
        }
    }

    public processTagName(e: IHtmlNode): void {
        const name = e.name;
        if (name && name.charAt(0).toUpperCase() === name.charAt(0)) {
            // since first character is upper case, it is a component...
            const tokens = name.split(".");
            e.attribs["atom-type"] = tokens[0];
            e.name = (tokens[1] || "null").toLowerCase();
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
        ${ this.parent instanceof WAComponent ?
            `${this.parent.id}.append(${this.id})` : `${this.parent.eid}.appendChild(${this.id})` };
        ${this.attributes.join("\r\n")}
        ${this.children.join("\r\n")}`;

    }
}

export class WATextElement extends WAElement {
    constructor(p: WAElement, e: IHtmlNode) {
        super(p, e);
    }

    public toString(): string {
        return `
        const ${this.id} = document.createTextNode(${JSON.stringify(this.element.data)});
        ${this.presenterToString}
        ${this.parent.eid}.appendChild(${this.id});`;
    }
}

export class WAComponent extends WAElement {

    public ids: number = 1;

    public export: boolean = false;

    public properties: Array<{ key: string, value: string }>;

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

            const at = element.attribs ? element.attribs["atom-type"] : "";
            if (at) {
                this.baseType = at;
            }
        }
    }

    public resolveNames(e: CoreHtmlComponent): void {
        super.resolveNames(e);

        if (this.name) {
            if (!this.baseType) {
                this.baseType = "AtomControl";
            }
        }

        if (this.baseType) {
            this.baseType = e.resolve(this.baseType);
        }

        for (const item of this.templates) {
            item.resolveNames(e);
        }
    }

    public toString(): string {

        if (this.name) {

            this.properties = this.properties || [];
            const propList = this.properties.map( (s) => `
            @BindableProperty
            public ${s.key}: any;
            ` ).join("");

            const initList = this.properties.map( (s) => `
                this.${s.key} = ${s.value};
            `).join(";");

            const classContent = ` class ${this.name} extends ${this.baseType} {

                ${propList}

                public create(): void {
                    super.create();

                    ${this.export ? "const __creator = this" : ` `};

                    ${initList}

                    ${this.element.name === "null" ?
                        "" :
                        `this.element = document.createElement("${this.element.name}");`}
                    ${this.presenterToString}
                    ${this.children.join("\r\n")}
                    ${this.attributes.join("\r\n")}
                }
            }

            ${this.templates.join("\r\n")}

            `;

            if (this.export) {
                return `export default ${classContent}`;
            }

            return `function ${this.name}Creator(__creator){
                return ${classContent}
            }`;
        } else {

            const elementName = this.element.name === "null" ? "" : `, document.createElement("${this.element.name}")`;

            return `
            const ${this.id} = new ${this.baseType}(this.app${elementName});
            ${this.presenterToString}
            ${this.children.join("\r\n")}
            ${this.attributes.join("\r\n")}
            ${this.parent.atomParent.id}.append(${this.id});
`;
        }

    }
}

export interface IImportDefinition {
    prefix?: string;
    name?: string;
    import?: string ;
}

export interface IImportDefinitions {
    [key: string]: IImportDefinition;
}

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

            // if (existsSync(fname)) {

            // }
            writeFileSync(fname, importStatement + root.generated );
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

export class CoreHtmlComponent implements IMarkupComponent {

    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string = "// tslint:disable\r\n";
    public config: IWAConfig;

    public root: WAComponent;

    private index: number = 1;

    constructor(private file: CoreHtmlFile) {
        this.file.imports.BindableProperty = {
            name: "BindableProperty",
            import: "web-atoms-core/bin/core/BindableProperty"
        };
    }

    public resolve(name: string): string {

        if (DefaultImports.indexOf(name) !== -1) {
            if (!this.file.imports[name]) {
                this.file.imports[name] = { name, import: `web-atoms-core/bin/web/controls/${name}` };
            }
        }

        // const tokens = name.split(":");
        // if (tokens.length === 1) {
        //     return name;
        // }
        // const prefix = tokens[0];
        // name = tokens[1];

        // const p = `i${this.file.importNameIndex++}`;

        // const im = this.file.imports[name] || (this.file.imports[name] = { prefix: `${p}`, name: `${p}_${name}` });
        // if (!im.import) {
        //     im.import = this.config.imports[prefix];
        //     if (!im.import.endsWith("/")) {
        //         im.import += "/";
        //     }
        //     im.import += name;
        // }
        return name;
    }

    public generateCode(): void {

        // let us resolve all names...
        this.root.resolveNames(this);

        this.generated = this.root.toString();

    }

    public writeLine(line?: string): void {
        this.generated += (line || "") + "\r\n";
    }

}
type PathList = string[];

interface ICompiledPath {
    expression: string;
    pathList: PathList[];
}

class HtmlContent {

    public static processTwoWayBinding(v: string, events: string): ICompiledPath {
        v = v.substr(2, v.length - 3);

        if (v.startsWith("$")) {
            v = v.substr(1);
        }

        const plist = v.split(".");

        v = ` [${JSON.stringify(plist)}], ${events} `;

        return {
            expression: v,
            pathList: [plist]
        };
    }

    public static escapeLambda(v: string): string {

        v = v.trim();

//         if (v.startsWith("()=>") || v.startsWith("() =>") || v.startsWith("=>")) {
//             v = v.replace("()=>", "");
//             v = v.replace("() =>", "");
//             v = v.replace("=>", "");
//             return `function(){
//     return ${v};
// }`;
//         }

        return v;
    }

    public static processOneWayBinding(v: string): ICompiledPath {
        v = v.substr(1, v.length - 2);

        v = HtmlContent.escapeLambda(v);

        const vx = AtomEvaluator.instance.parse(v);

        v = "";

        const plist: string = vx.path.map((p, i) => `v${i + 1}`).join(",");

        v += ` ${JSON.stringify(vx.path)}, false , (${plist}) => ${vx.original}`;

        return {
            expression: v,
            pathList: vx.path
        };
    }

    public static processOneTimeBinding(v: string): string {
        let original = v;
        v = v.substr(1, v.length - 2);

        v = HtmlContent.escapeLambda(v);

        const vx = AtomEvaluator.instance.parse(v);

        v = vx.original;

        for (let i: number = 0; i < vx.path.length; i++) {
            const p: string[] = vx.path[i];
            const start: string = "this";
            v = v.replace(`v${i + 1}`, `this.${p.join(".")}`);
            original = null;
        }

        return original || v;
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
