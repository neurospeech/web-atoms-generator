import { CoreHtmlComponent } from "./CoreHtmlComponent";

import { GeneratorContext } from "../generator-context";
import { IHtmlNode } from "../html-node";
import { Binding } from "./Binding";
import { CoreHtmlFile } from "./CoreHtmlFile";
import { HtmlContent } from "./HtmlContent";
import IDisposable from "./IDisposable";
import IndentedWriter from "./IndentedWriter";

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

    public write(iw: IndentedWriter): void {
        // do nothing
    }

}

export class WAAttribute extends WANode {

    public binding: Binding = Binding.None;

    public value: string;

    public template: string;

    public write(iw: IndentedWriter): void {

        let name = this.name;

        if (/^atom\-/i.test(name)) {
            name = name.substring(5);
        }

        const aid = this.atomParent.id;

        name = name.split("-").map(
            (a, i) => (i ? a.charAt(0).toUpperCase() : a.charAt(0).toLowerCase())  + a.substr(1) ).join("");

        if (this.value.startsWith("{") && this.value.endsWith("}")) {

            if (/^event/i.test(name)) {
                iw.writeLine(`${name}={Bind.event(${HtmlContent.toEvent(this.value)})}`);
            } else {
                const v = HtmlContent.removeBrackets(HtmlContent.processOneTimeBinding(this.value, "x"));
                iw.writeLine(`${name}={Bind.oneTime((x) => ${v})}`);
            }
            return;
        }

        if (this.value.startsWith("[") && this.value.endsWith("]")) {
            const v =  HtmlContent.processTwoWayBindingTSX(this.value);
            iw.writeLine(`${name}={Bind.oneWay((x) => ${v})}`);
            return;
        }

        if (this.value.startsWith("$[") && this.value.endsWith("]")) {
            const v =  HtmlContent.processTwoWayBindingTSX(this.value);
            iw.writeLine(`${name}={Bind.twoWays((x) => ${v})}`);

            // const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
            // iw.writeLine(
            //     `${aid}.bind(${this.parent.eid}, "${name}", ${v.expression} ${startsWithThis});`);
            return;
        }

        if (this.value.startsWith("^[") && this.value.endsWith("]")) {
            const v = HtmlContent.processTwoWayBinding(this.value, `["change", "keyup", "keydown", "blur"]`);
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
            iw.writeLine(
                `${aid}.bind(${this.parent.eid}, "${name}", ${v.expression} ${startsWithThis});`);
            return;
        }

        iw.writeLine(`${name}="${this.value}"`);

    }

}

export class WAElement extends WANode {

    public static tid: number = 1;

    public attributes: WAAttribute[] = [];

    public children: WAElement[] = [];

    public presenterParent: { name: string, parent: WAComponent };

    public id: string;
    defaultStyle: any;

    public get eid(): string {
        if (this instanceof WAComponent) {
            return `${this.id}.element`;
        }
        return this.id;
    }

    constructor(
        p: WAElement,
        protected element: IHtmlNode,
        name?: string
    ) {
        super(p, name);

        try {

            this.processTagName(element);

            for (const key in this.element.attribs) {
                if (this.element.attribs.hasOwnProperty(key)) {
                    const item = this.element.attribs[key];

                    if (/default\-style|defaultStyle/i.test(key)) {
                        this.defaultStyle = item;
                        continue;
                    }

                    if (/(viewModel|view\-model)$/i.test(key)) {
                        this[HtmlContent.camelCase(key)] = HtmlContent.removeBrackets(item);
                        continue;
                    }

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

                    if (key === "@properties") {
                        const wa = ((this as any) as WAComponent);
                        const sl = (item as string).split(",");
                        const pl = sl.map((s) =>  {
                            const sv = s.split(":");
                            const k = sv[0];
                            const tv = sv[1];
                            let v: any;
                            let t: any;
                            if (tv) {
                                const tvs = tv.split("=");
                                t = tvs[0];
                                v = tvs[1];
                            }
                            return { key: k, type: t, value: v, v2: true  };
                        });
                        wa.properties = pl;
                        continue;
                    }

                    if (key === "@inject" || key === "inject" || key === "atom-inject") {
                        const wa = ((this as any) as WAComponent);
                        const sl = (item as string).split(",");
                        const pl = sl.map((s) =>  {
                            const sv = s.split(":");
                            const k = sv[0];
                            const tv = sv[1];
                            let v: any;
                            let t: any;
                            if (tv) {
                                const tvs = tv.split("=");
                                t = tvs[0];
                                v = tvs[1];
                            }
                            return { key: k.trim(), type: t, value: v, v2: true  };
                        });
                        wa.injects = pl;
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
                    if (key === "atom-presenters" || key === "presenters") {
                        // tslint:disable-next-line:no-eval
                        const propertyList = (item as string)
                            .split(",")
                            .map((s) => {
                                const sv = s.split(":");
                                const k = sv[0];
                                const v = sv[1];
                                return { key: k, value: v };
                            });
                        ((this as any) as WAComponent).presenters = propertyList;
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

    public writePresenter(iw: IndentedWriter): void {
        if (! this.presenterParent) {
            return;
        }

        iw.writeLine("");
        iw.writeLine(`${this.presenterParent.parent.id}.${this.presenterParent.name} = ${this.id};`);
    }

    public writeAttributes(iw: IndentedWriter): void {
        for (const attribute of this.attributes) {
            attribute.write(iw);
        }

        // if (iw.pending.length) {
        //     iw.writeLine(`${this.atomParent.id}.runAfterInit( () => {`);
        //     iw.writeInNewBlock( () => {
        //         for (const iterator of iw.pending) {
        //             iw.writeLine(iterator);
        //         }
        //     });
        //     iw.writeLine("});");
        //     iw.pending.length = 0;
        // }
    }

    public writeChildren(iw: IndentedWriter): void {
        for (const iterator of this.children) {
            iterator.write(iw);
        }
    }

    public write(iw: IndentedWriter): void {

        try {
            iw.writeLine(`<${this.element.name}`);
            this.writeAttributes(iw);
            iw.writeLine(">");

            this.writeChildren(iw);

            iw.writeLine(`</${this.element.name}>`);

        } catch (e) {
            this.coreHtmlFile.reportError(this.element, e);
        }

    }
}

export class WATextElement extends WAElement {
    constructor(p: WAElement, e: IHtmlNode) {
        super(p, e);
    }

    public write(iw: IndentedWriter): void {
        iw.writeLine(this.element.data);
    }
}

export class WAComment extends WAElement {
    public write(iw: IndentedWriter): void {
        const comment = (this.element.data || "")
            .toString()
            .split("\n")
            .map((s) => `// ${s}`)
            .join("\n");

        iw.writeLine(`// ${this.id}\r\n${comment}`);
    }
}

export class WAComponent extends WAElement {

    public ids: number = 1;

    public export: boolean = false;

    public properties: Array<{ key: string, value: string, type?: string, v2?: boolean }>;

    public presenters: Array<{ key: string, value: string }>;

    public injects: Array<{ key: string, type: string}>;
    viewModel: any;
    localViewModel: any;

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

    public write(iw: IndentedWriter): void {
        try {
            if (this.name) {
                if (this.export) {
                    this.writeNamedComponent(iw);
                } else {
                    iw.writeInNewBrackets(`function ${this.name}Creator(__creator)`, () => {
                        this.writeNamedComponent(iw);
                    });
                }
            } else {
                this.writeComponent(iw);
            }
        } catch (e) {
            this.coreHtmlFile.reportError(this.element, e);
        }
    }

    public writeNamedComponent(iw: IndentedWriter): void {

        const e = this.export ? "export default" : "return";

        // write class...
        iw.writeInNewBrackets( `${e} class ${this.name} extends ${this.baseType}`, () => {

            // write injects
            if (this.injects) {
                for (const iterator of this.injects) {
                    iw.writeLine("");
                    iw.writeLine(`protected ${iterator.key}: ${iterator.type };`);
                }
            }

            if (this.properties) {
                for (const iterator of this.properties) {
                    iw.writeLine("");
                    iw.writeLine(`@BindableProperty`);
                    const type = iterator.type || "any";
                    const init = "";
                    iw.writeLine(`public ${iterator.key}: ${type} ${init};`);
                }
            }

            if (this.presenters) {
                for (const iterator of this.presenters) {
                    iw.writeLine("");
                    iw.writeLine(`public ${iterator.key}: HTMLElement;`);
                }
            }

            iw.writeLine("");
            iw.writeInNewBrackets(`public create(): void`, () => {

                // initialize injects
                if (this.injects) {
                    iw.writeLine("");
                    for (const iterator of this.injects) {
                        iw.writeLine(`this.${iterator.key} = this.app.resolve(${iterator.type});`);
                    }
                }

                if (this.viewModel) {
                    iw.writeLine(`this.viewModel = ${this.viewModel};`);
                }
                if (this.localViewModel) {
                    iw.writeLine(`this.localViewModel = ${this.localViewModel};`);
                }

                // initialize non v2 properties...
                if (this.properties) {
                    for (const iterator of this.properties) {
                        if (iterator.v2) {
                            if (iterator.value) {
                                iw.writeLine("");
                                iw.writeLine(`this.${iterator.key} = ${iterator.value};`);
                            }
                            continue;
                        }
                        if (iterator.value === undefined) {
                            continue;
                        }
                        iw.writeLine("");
                        iw.writeLine(`this.${iterator.key} = ${iterator.value};`);
                    }
                }

                // write presenter...
                this.writePresenter(iw);

                this.writeAttributes(iw);

                for (const iterator of this.children) {
                    iterator.write(iw);
                }
            });

        });

    }

    public writeComponent(iw: IndentedWriter): void {

        iw.writeLine("this.render(");
        iw.writeLine(`<${this.element.name}`);
        const d = iw.indent();

        this.writePresenter(iw);

        for (const iterator of this.attributes) {
            iterator.write(iw);
        }

        iw.writeLine(">");

        for (const iterator of this.children) {
            iterator.write(iw);
        }

        if (d) {
            d.dispose();
        }

        iw.writeLine(`</${this.element.name}>`);
        iw.writeLine(");");

    }
}
