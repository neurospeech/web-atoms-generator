import { XmlElement, XmlNode } from "xmldoc";
import { ArrayHelper } from "../ArrayHelper";

export class WAXComponent {

    public attributes: WAXAttribute[];

    constructor(
        public element: XmlElement,
        public name: string,
        public children: WAXComponent[],
        public template: boolean = false
    ) {
        this.attributes = [];
        this.children = [];
        this.process(element);
    }

    public process(e: XmlElement): void {
        if (e.attr) {
            const deleteAttributes: string[] = [];
            for (const key in e.attr) {
                if (e.attr.hasOwnProperty(key)) {
                    const element = e.attr[key];
                    if (element.startsWith("@{") && element.endsWith("}")) {
                        // one time binding...
                        deleteAttributes.push(key);
                    }
                }
            }
            for (const iterator of deleteAttributes) {
                delete e.attr[iterator];
            }
        }

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
                            this.setAttribute(name, tokens[1] , `${className}_Creator(this)`);
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
                if ((element.startsWith("@{") && element.endsWith("}"))
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
        name = `e${this.children.length + 1}`;
        e.attr = e.attr || {};
        e.attr["x:Name"] = name;
        return name;
    }

    public setAttribute(parentName: string, name: string, value: string): void {
        this.attributes.push(new WAXAttribute(parentName, name, value));
    }

    public toString(): string {

        const attributes = this.attributes.sort(
            (l, r) => l.parentName.localeCompare(r.parentName));

        const attributeGroups = ArrayHelper.groupBy(attributes, (a) => a.parentName)
            .map((a) => `
            const ${a.key} = this.find("${a.key}");
            ${a.values.join(";\r\n")}
`);

        const classContent = `class ${this.name} extends AtomXControl {

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
        return "export default " + classContent;
    }
}

export class WAXAttribute {

    constructor(
        public parentName: string,
        public name: string,
        public value: string
    ) {

    }

    public toString(): string {

        return `
        this.setLocalValue(${this.parentName}, "${this.name}", ${this.value});
        `;
    }
}
