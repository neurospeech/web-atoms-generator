import { XmlElement, XmlNode } from "xmldoc";
import { ArrayHelper } from "../ArrayHelper";
import { HtmlContent } from "../core/HtmlContent";

export class WAXComponent {

    public attributes: WAXAttribute[];

    public lastId: number = 1;

    public imports: {[key: string]: string} = {};

    constructor(
        public element: XmlElement,
        public name: string,
        public children: WAXComponent[],
        public template: boolean = false
    ) {
        this.attributes = [];
        this.children = [];

        const removeAttributes: string[] = [];

        // process namespaces...
        const attrs = element.attr;
        for (const key in attrs) {
            if (attrs.hasOwnProperty(key)) {
                const value = attrs[key];
                if (/^xmlns\:/i.test(key)) {
                    removeAttributes.push(key);
                    const ns = key.substr(6);
                    if (value.startsWith("js-import-def:")) {
                        this.imports[ns] = value.split(":")[1];
                    } else if (value.startsWith("js-import:")) {
                        this.imports[ns] = `{${value.split(":")[1]}}`;
                    }
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
                                true);
                            const child = new WAXComponent(
                                this.getFirstElement(first), className, this.children, true);
                            this.children.push(child);
                            continue;
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
        let name: string = e.attr ? e.attr.name || e.attr["x:Name"] : null;
        if (name) {
            return name;
        }
        name = `e${this.lastId++}`;
        e.attr = e.attr || {};
        e.attr["x:Name"] = name;
        return name;
    }

    public setAttribute(parentName: string, name: string, value: string, template?: boolean): void {
        this.attributes.push(new WAXAttribute(parentName, name, value, template));
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

                protected create(): void {
                    super.create();

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
        public parentName: string,
        public name: string,
        public value: string,
        public template: boolean
    ) {

    }

    public toString(): string {

        if (this.template) {
            return `
            this.setTemplate(${this.parentName}, "${this.name}", ${this.value});
            `;
        }

        const name = this.name;

        // do the bindings...
        if ((this.value.startsWith("{{") ||  this.value.startsWith("${")) && this.value.endsWith("}")) {
            this.value = this.value.substr(1);
            const v = HtmlContent.processOneTimeBinding(this.value);
            if (/^(viewmodel|localviewmodel)$/i.test(name)) {
                return `
                this.setLocalValue(${this.parentName}, "${name}", ${HtmlContent.removeBrackets(v)});`;
                }
            if (v === this.value) {
                const sv = v.substr(1, v.length - 2);
                return `
                this.setPrimitiveValue(${this.parentName}, "${name}", ${sv});`;
            }
            return `
            this.runAfterInit( () =>
            this.setLocalValue(${this.parentName}, "${name}", ${v}) );`;
        }

        if (this.value.startsWith("[") && this.value.endsWith("]")) {
            const v = HtmlContent.processOneWayBinding(this.value);
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ", __creator" : "";
            return `
            this.bind(${this.parentName}, "${name}", ${v.expression} ${startsWithThis});`;
        }

        if (this.value.startsWith("$[") && this.value.endsWith("]")) {
            const v = HtmlContent.processTwoWayBinding(this.value, "true");
            const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
            return `
            this.bind(${this.parentName}, "${name}", ${v.expression} ${startsWithThis});`;
        }

        // if (this.value.startsWith("^[") && this.value.endsWith("]")) {
        //     const v = HtmlContent.processTwoWayBinding(this.value, `["change", "keyup", "keydown", "blur"]`);
        //     const startsWithThis = v.pathList.findIndex( (p) => p[0] === "this" ) !== -1 ? ",null, __creator" : "";
        //     return `
        //     ${this.atomParent.id}.bind(${this.parent.eid}, "${name}", ${v.expression} ${startsWithThis});`;
        // }

        return `
        this.setLocalValue(${this.parentName}, "${this.name}", ${this.value});
        `;
    }
}
