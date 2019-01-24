import { XmlElement, XmlNode } from "xmldoc";
import { ArrayHelper } from "../ArrayHelper";
import { HtmlContent } from "../core/HtmlContent";

export class WAXComponent {

    public attributes: WAXAttribute[];

    public lastId: number = 1;

    public imports: {[key: string]: string} = {};

    public xmlNS: {[key: string]: string} = {};

    public controlImports: string[] = [];

    public properties: string[] = [];

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
                            this.setAttribute(
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
                        iterator.name = "atom:AtomObjectCreator";
                        iterator.attr = iterator.attr || {};
                        iterator.attr.Type = name;
                        this.element.attr = this.element.attr || {};
                        this.element.attr["xmlns:atom"] = "clr-namespace:WebAtoms;assembly=WebAtoms";
                        if (!this.controlImports.find((s) => s === name)) {
                            this.controlImports.push(name);
                        }
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
                    this.setAttribute(name, key, element);
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
        let name: string = e.attr ? e.attr.name || e.attr.Name || e.attr["x:Name"] : null;
        if (name) {
            return name;
        }
        name = `e${this.lastId++}`;
        e.attr = e.attr || {};
        if (e.name === "atom:AtomObjectCreator") {
            e.attr.Name = name;
        } else {
            e.attr["x:Name"] = name;
        }
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

    public setAttribute(parentName: string, name: string, value: string, template?: boolean): void {
        this.attributes.push(new WAXAttribute( this.parent === null ? "this" : this.name,
            parentName, name, value, template));
    }

    public toString(): string {

        const attributes = this.attributes.sort(
            (l, r) => l.parentName.localeCompare(r.parentName));

        const attributeGroups = ArrayHelper.groupBy(attributes, (a) => a.parentName)
            .map((a) => `
            const ${a.key} = this.find("${a.key}");
            ${a.values.join("\r\n")}
`);

        const classContent = `class ${this.name} extends AtomXFControl {

                ${this.properties.join("\r\n")}

                protected create(): void {
                    super.create();

                    this.element = this.createControl("${this.resolveName(this.element.name)}");

                    ${this.controlImports.map((s) =>
                        `this.setImport(this.element,"${s}",() => new ${s}(this.app));`).join("\r\n")}

                    this.loadXaml(\`${this.element.toStringWithIndent("\t")}\`);

                    ${attributeGroups.join("\r\n")}
                }
            }

            ${this.children.join("\r\n")}
        `;

        if (this.template) {
            return `
// template
function ${this.name}_Creator(__creator: any): any {
    return ${classContent};
}`;
        }

        const imports: string[] = [];
        for (const key in this.imports) {
            if (this.imports.hasOwnProperty(key)) {
                const element = this.imports[key];
                imports.push(`import ${key} from \"${element}\";`);
            }
        }

        return `

        ${imports.join("\r\n")}

        export default ${classContent}`;
    }
}

export class WAXAttribute {

    constructor(
        public id: string,
        public parentName: string,
        public name: string,
        public value: string,
        public template: boolean
    ) {

    }

    public toString(): string {

        if (this.template) {
            return `
            ${this.id}.setTemplate(${this.parentName}, "${this.name}", ${this.value});
            `;
        }

        const name = this.name;

        // do the bindings...
        if ((this.value.startsWith("{{") ||  this.value.startsWith("${")) && this.value.endsWith("}")) {
            this.value = this.value.substr(1);
            const v = HtmlContent.processOneTimeBinding(this.value);
            if (/^(viewmodel|localviewmodel)$/i.test(name)) {
                return `
                ${this.id}.setLocalValue(${this.parentName}, "${name}", ${HtmlContent.removeBrackets(v)});`;
                }
            if (v === this.value) {
                const sv = v.substr(1, v.length - 2);
                return `
                ${this.id}.setPrimitiveValue(${this.parentName}, "${name}", ${sv});`;
            }
            return `
            ${this.id}.runAfterInit( () =>
            ${this.id}.setLocalValue(${this.parentName}, "${name}", ${v}) );`;
        }

        if (this.value.startsWith("[") && this.value.endsWith("]")) {
            const v = HtmlContent.processOneWayBinding(this.value);
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ", __creator" : "";
            return `
            ${this.id}.bind(${this.parentName}, "${name}", ${v.expression} ${startsWithThis});`;
        }

        if (this.value.startsWith("$[") && this.value.endsWith("]")) {
            const v = HtmlContent.processTwoWayBinding(this.value, "true");
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
            return `
            ${this.id}.bind(${this.parentName}, "${name}", ${v.expression} ${startsWithThis});`;
        }

        // if (this.value.startsWith("^[") && this.value.endsWith("]")) {
        //     const v = HtmlContent.processTwoWayBinding(this.value, `["change", "keyup", "keydown", "blur"]`);
        //     const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
        //     return `
        //     ${this.atomParent.id}.bind(${this.parent.eid}, "${name}", ${v.expression} ${startsWithThis});`;
        // }

        return `
        ${this.id}.setLocalValue(${this.parentName}, "${this.name}", ${this.value});
        `;
    }
}
