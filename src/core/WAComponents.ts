import { CoreHtmlComponent } from "./CoreHtmlComponent";

import { GeneratorContext } from "../generator-context";
import { IHtmlNode } from "../html-node";
import { Binding } from "./Binding";
import { CoreHtmlFile } from "./CoreHtmlFile";
import { HtmlContent } from "./HtmlContent";

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

    public get coreHtmlFile(): CoreHtmlFile {
        if (this instanceof CoreHtmlComponent) {
            return this.file;
        }
        return this.parent.coreHtmlFile;
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

        if (name === "defaultStyle" || name === "defaultControlStyle") {
            return `
            ${this.atomParent.id}.defaultControlStyle = ${ HtmlContent.removeBrackets(this.value)};
            `;
        }

        if (this.template) {
            return `
        ${this.atomParent.id}.${name} = ${this.template}Creator(this);
            `;
        }

        if (this.value.startsWith("{") && this.value.endsWith("}")) {
            const v = HtmlContent.processOneTimeBinding(this.value);
            if (/^(viewmodel|localviewmodel|controlstyle)$/i.test(name)) {
                return `
                ${this.atomParent.id}.${name} = ${HtmlContent.removeBrackets(v)};`;
                }
            if (v === this.value) {
                const sv = v.substr(1, v.length - 2);
                if (name === "styleClass" && v.includes(".controlStyle.")) {
                    return `
                    this.runAfterInit(() => {
                        ${this.atomParent.id}.setPrimitiveValue(${this.parent.eid}, "styleClass", ${sv});
                    });
                    `;
                }
                return `
                ${this.atomParent.id}.setPrimitiveValue(${this.parent.eid}, "${name}", ${sv});`;
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

    public static tid: number = 1;

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
            this.coreHtmlFile.reportError(this.element, er);
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

        if (e.type === "comment") {
            this.addChild(new WAComment(this, e));
            return;
        }

        if (e.type === "text") {

            // remove empty lines...
            const text = (e.data || "")
                .split("\n")
                .filter((s) => s.trim());
            if (text.length) {
                this.addChild(new WATextElement(this, e));
            }
            return;
        }

        const tt = e.attribs ? (e.attribs.template || e.attribs["atom-template"]) : null;

        if (tt) {

            const np = this.namedParent;
            const ap = this.atomParent;

            const tn = `${np.name}_${tt}_${ap.templates.length + 1}_${WAElement.tid++}`;

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

        try {
            return `
            const ${this.id} = document.createElement("${this.element.name}");
            ${this.presenterToString}
            ${ this.parent instanceof WAComponent ?
                `${this.parent.id}.append(${this.id})` : `${this.parent.eid}.appendChild(${this.id})` };
            ${this.attributes.join("\r\n")}
            ${this.children.join("\r\n")}`;
        } catch (e) {
            this.coreHtmlFile.reportError(this.element, e);
        }

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

export class WAComment extends WAElement {
    public toString(): string {
        const comment = (this.element.data || "")
            .toString()
            .split("\n")
            .map((s) => `// ${s}`)
            .join("\n");

        return `// ${this.id}\r\n${comment}`;
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

        // // tslint:disable-next-line:no-debugger
        // debugger;
        if (this.baseType) {
            this.baseType = e.resolve(this.baseType);
        }

        for (const item of this.templates) {
            item.resolveNames(e);
        }
    }

    public toString(): string {

        try {

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
                    ${this.attributes.join("\r\n")}
                    ${this.children.join("\r\n")}
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
            ${ this.parent instanceof WAComponent ?
                `${this.parent.id}.append(${this.id})` : `${this.parent.eid}.appendChild(${this.eid})` };
`;
        }
    } catch (e) {
        this.coreHtmlFile.reportError(this.element, e);
    }

    }
}
