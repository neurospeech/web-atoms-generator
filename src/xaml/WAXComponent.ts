import { XmlElement, XmlNode } from "xmldoc";
import { ArrayHelper } from "../ArrayHelper";
import { HtmlContent } from "../core/HtmlContent";
import IDisposable from "../core/IDisposable";
import IndentedWriter from "../core/IndentedWriter";

export class WAXComponent {

    public attributes: WAXAttribute[];

    public lastId: number = 1;

    public imports: {[key: string]: string} = {};

    public xmlNS: {[key: string]: string} = {};

    public controlImports: Array<{ type: string, name: string }> = [];

    public properties: Array<{ key: string, value: string, type?: string, v2?: boolean }> = [];

    public presenters: Array<{ key: string, value: string }>;

    public injects: Array<{ key: string, type: string}> = [];

    constructor(
        public element: XmlElement,
        public name: string,
        public children: WAXComponent[],
        public template: boolean = false,
        public parent: WAXComponent = null
    ) {
        this.attributes = [];
        this.children = [];

        const removeAttributes: string[] = [];

        if (this.parent != null) {
            const pa = this.parent.element.attr;
            const ea = this.element.attr || (this.element.attr = {});
            for (const key in pa) {
                if (pa.hasOwnProperty(key)) {
                    const value = pa[key];
                    if (key.startsWith("xmlns:") || key === "xmlns") {
                        ea[key] = value;
                    }
                }
            }
        }

        // process namespaces...
        const attrs = element.attr;
        for (const key in attrs) {
            if (attrs.hasOwnProperty(key)) {
                const value = attrs[key];
                if (/^xmlns\:/i.test(key) || key === "xmlns") {
                    const ns = key.includes(":") ? key.split(":")[1] :  "__default";
                    if (value.startsWith("js-import-def:")) {
                        removeAttributes.push(key);
                        this.imports[ns] = value.split(":")[1];
                        continue;
                    }
                    if (value.startsWith("js-import:")) {
                        removeAttributes.push(key);
                        this.imports[`{${ns}}`] = value.split(":")[1];
                        continue;
                    }
                    this.xmlNS[ns] = value;
                    continue;
                }
            }
        }

        for (const iterator of removeAttributes) {
            delete attrs[iterator];
        }

        this.process(element);
    }

    public process(e: XmlElement): void {

        const removeChildren: Array<{ parent: XmlElement, child: XmlElement }> = [];
        for (const iterator of e.children) {
            if (iterator.type === "element") {
                if (iterator.name.includes(".")) {
                    const first = this.getFirstElement(iterator);
                    if (first) {
                        if (first.name === "DataTemplate") {
                            removeChildren.push({ parent: e, child: iterator });
                            const name = this.setName(e);
                            const className = `${this.name}_${name}`;
                            const tokens = iterator.name.split(".");
                            this.setAttribute(e,
                                name,
                                tokens[1],
                                `() => new (${className}_Creator(this))(this.app)`,
                                name[0] !== name[0].toLowerCase());
                            const child = new WAXComponent(
                                this.getFirstElement(first), className, this.children, true, this);
                            this.children.push(child);
                            continue;
                        }
                    }
                }

                if (iterator.name.includes(":")) {

                    const name = iterator.name.split(":")[0];
                    const ns = this.imports[name];
                    if (ns) {

                        const contorlName = "m" + (this.controlImports.find((s) => s.name === name) ?
                            name + this.controlImports.length :
                            name);

                        this.controlImports.push({ type: name, name: contorlName });

                        iterator.name = "atom:AtomObjectInjector";
                        iterator.attr = iterator.attr || {};
                        iterator.attr.Name = contorlName;
                        this.element.attr = this.element.attr || {};
                        this.element.attr["xmlns:atom"] = "clr-namespace:WebAtoms;assembly=WebAtoms";
                    }

                }

                this.process(iterator);
            }
        }

        for (const iterator of removeChildren) {
            const index = iterator.parent.children.indexOf(iterator.child);
            iterator.parent.children.splice(index, 1);
        }

        if (!e.attr) {
            return;
        }

        const removeAttributes: string[] = [];
        for (const key in e.attr) {
            if (/^xmlns\:/.test(key) || key === "xmlns") {
                continue;
            }
            if (e.attr.hasOwnProperty(key)) {
                const element = (e.attr[key] || "").trim();
                if (((element.startsWith("${")
                    || element.startsWith("{{")
                        ) && element.endsWith("}"))
                    || (element.startsWith("[") && element.endsWith("]"))
                    || (element.startsWith("$[") && element.endsWith("]"))
                ) {
                    const name = this.setName(e);
                    this.setAttribute(e, name, key, element);
                    removeAttributes.push(key);
                }
            }
        }

        for (const iterator of removeAttributes) {
            delete e.attr[iterator];
        }

    }

    public getFirstElement(e: XmlElement): XmlElement {
        for (const iterator of e.children) {
            if (iterator.type === "element") {
                return iterator;
            }
        }
        return null;
    }

    public setName(e: XmlElement): string {
        let name: string = e.attr ? (e.attr.name || e.attr.Name || e.attr["x:Name"]) : null;
        if (name) {
            return name;
        }
        name = `e${this.lastId++}`;
        e.attr = e.attr || {};
        e.attr["x:Name"] = name;
        return name;
    }

    public resolveName(name: string): string {
        if (this.parent) {
            return this.parent.resolveName(name);
        }
        let ns: string = null;
        if (name.includes(":")) {
            const tokens = name.split(":");
            ns = tokens[0];
            name = tokens[1];
        } else {
            ns = "__default";
        }

        ns = this.xmlNS[ns];

        if (!ns) {
            // tslint:disable-next-line:no-console
            console.error(`Failed to resolve ${name} with ${JSON.stringify(this.xmlNS, undefined, 2)}`);
            return name;
        }

        if (ns === "http://xamarin.com/schemas/2014/forms") {
            return `Xamarin.Forms.${name}`;
        }
        ns = ns.split(":")[1];
        ns = ns.split(";")[0];
        return `${ns}.${name}`;
    }

    public setAttribute(
        e: XmlElement,
        elementName: string,
        attributeName: string,
        value: string,
        template?: boolean): void {
        this.attributes.push(new WAXAttribute(
            e,
            (e && e.attr.Name) || "this",
            (e && e.attr.Name) ? `this.${elementName}` : elementName,
            attributeName,
            value,
            template));
    }

    public write(iw: IndentedWriter): void {

        const attributes = this.attributes.sort(
            (l, r) => l.elementName.localeCompare(r.elementName));

        const attributeGroups = ArrayHelper
            .groupBy(attributes, (a) => a.elementName);

        const controlImports = this.controlImports.map((s) => {
            return `const ${s.name} = new ${s.type}(this.app);\r\nthis.${s.name} = ${s.name}.element;`;
        });

        let d: IDisposable = null;

        if (this.template) {
            d = iw.beginBrackets(`function ${this.name}_Creator(__creator: any): any`);
            iw.writeLine("return ");
        } else {

            iw.writeLine("// tslint:disable");

            iw.writeLine(`import { AtomXFControl } from "web-atoms-core/dist/xf/controls/AtomXFControl";`);
            for (const key in this.imports) {
                if (this.imports.hasOwnProperty(key)) {
                    const element = this.imports[key];
                    iw.writeLine(`import ${key} from \"${element}\";`);
                }
            }
            iw.writeLine("export default ");
        }

        // create class....
        iw.writeInNewBrackets(`class ${this.name} extends AtomXFControl`, () => {

            for (const iterator of this.controlImports) {
                iw.writeLine("");
                iw.writeLine(`public ${iterator.name};`);
            }

            for (const iterator of this.properties) {
                iw.writeLine("");
                iw.writeLine(`public ${iterator.key}: ${iterator.type};`);
            }

            for (const iterator of this.injects) {
                iw.writeLine("");
                iw.writeLine(`public ${iterator.key}: ${iterator.type};`);
            }

            // write create...
            iw.writeInNewBrackets(`protected create(): void `, () => {

                iw.writeLine("");
                iw.writeLine("super.create();");

                for (const iterator of this.injects) {
                    iw.writeLine("");
                    iw.writeLine(`this.${iterator.key} = this.app.resolve(${iterator.type});`);
                }

                iw.writeLine("");
                iw.writeLine(`this.element = this.createControl("${this.resolveName(this.element.name)}");`);

                for (const iterator of controlImports) {
                    iw.writeLine("");
                    iw.writeLine(iterator);
                }

                iw.writeLine("");
                iw.writeLine(`this.loadXaml(\`${this.element.toStringWithIndent("\t")}\`);`);

                for (const iterator of attributeGroups) {
                    iw.writeLine("");
                    iw.writeLine(`const ${iterator.key} = this.find("${iterator.key}");`);
                    for (const child of iterator.values) {
                        child.write(iw);
                    }
                }

            });

        });

        if (d) {
            iw.writeLine(";");
            d.dispose();
        }

    }
}

export class WAXAttribute {

    constructor(
        public e: XmlElement,
        public id: string,
        public elementName: string,
        public attributeName: string,
        public value: string,
        public template: boolean
    ) {

    }

    public write(iw: IndentedWriter): void {

        if (this.template) {
            iw.writeLine(`${this.id}.setTemplate(${this.elementName}, "${this.attributeName}", ${this.value});`);
            return;
        }

        const attributeName = this.attributeName;

        // do the bindings...
        if ((this.value.startsWith("{{") ||  this.value.startsWith("${")) && this.value.endsWith("}")) {
            this.value = this.value.substr(1);
            const v = HtmlContent.processOneTimeBinding(this.value);
            if (/^(viewmodel|localviewmodel)$/i.test(attributeName)) {
                // tslint:disable-next-line: max-line-length
                iw.writeLine(`${this.id}.setLocalValue(${this.elementName}, "${attributeName}", ${HtmlContent.removeBrackets(v)});`);
                return;
            }
            if (v === this.value) {
                const sv = v.substr(1, v.length - 2);
                iw.writeLine(`${this.id}.setPrimitiveValue(${this.elementName}, "${attributeName}", ${sv});`);
                return;
            }
            // tslint:disable-next-line: max-line-length
            iw.writeLine(`${this.id}.runAfterInit( () => ${this.id}.setLocalValue(${this.elementName}, "${attributeName}", ${v}) );`);
            return;
        }

        if (this.value.startsWith("[") && this.value.endsWith("]")) {
            const v = HtmlContent.processOneWayBinding(this.value);
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ", __creator" : "";
            iw.writeLine(
                `${this.id}.bind(${this.elementName}, "${attributeName}", ${v.expression} ${startsWithThis});`);
            return;
        }

        if (this.value.startsWith("$[") && this.value.endsWith("]")) {
            const v = HtmlContent.processTwoWayBinding(this.value, "true");
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
            iw.writeLine(
                `${this.id}.bind(${this.elementName}, "${attributeName}", ${v.expression} ${startsWithThis});`);
            return;
        }

        iw.writeLine(`${this.id}.setLocalValue(${this.elementName}, "${this.attributeName}", ${this.value});`);
    }
}
