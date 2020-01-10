import { XmlElement, XmlNode } from "xmldoc";
import { ArrayHelper } from "../ArrayHelper";
import { HtmlContent } from "../core/HtmlContent";
import IDisposable from "../core/IDisposable";
import IndentedWriter from "../core/IndentedWriter";

export class WAXComponent {

    public attributes: Array<[string, string]>;

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
        this.children = [];
        this.attributes = [];

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

        if (e.name.includes(":")) {

            const t = e.name.split(":");
            if (/^wa$/i.test(t[0])) {
                e.name = `${t[0].toUpperCase()}.${t[1]}`;
            }
        } else {
            e.name = "XF." + e.name;
        }

        if (e.name === "WA.AtomImage") {
            e.name = "XF.Image";
            e.attr.Url = e.attr.SourceUrl;
            delete e.attr.SourceUrl;
        }

        if (e.name === "pages:PopupPage") {
            e.name = "RgPluginsPopup.PopupPage";
        }

        if (e.name.startsWith("AtomComboBox:AtomComboBox")) {
            e.name = e.name.replace("AtomComboBox:AtomComboBox", "AtomComboBox");
        }

        const removeChildren: Array<{ parent: XmlElement, child: XmlElement }> = [];
        for (const iterator of e.children) {
            if (iterator.type === "element") {
                if (iterator.name === "DataTemplate") {
                    removeChildren.push({ parent: e, child: iterator });
                    continue;
                }
                this.process(iterator);
            }
        }

        for (const iterator of removeChildren) {
            const fc = iterator.child.children.filter((x) => x.type === "element")[0];
            iterator.parent.children = iterator.parent.children.map((c) => c === iterator.child ? fc : c );
            this.process(fc as XmlElement);
        }

        if (!e.attr) {
            return;
        }

        const removeAttributes: string[] = [];

        const changed = {};

        // convert every name to camel case

        // tslint:disable-next-line: forin
        for (const key in e.attr) {
            if (/^xmlns\:/.test(key) || key === "xmlns") {
                removeAttributes.push(key);
                continue;
            }

            if (e.attr.hasOwnProperty(key)) {
                const element = (e.attr[key] || "").trim();
                if ( key.indexOf(".") !== -1 || ((element.startsWith("${")
                    || element.startsWith("{{")
                        ) && element.endsWith("}"))
                    || (element.startsWith("[") && element.endsWith("]"))
                    || (element.startsWith("$[") && element.endsWith("]"))
                ) {
                    // const name = this.setName(e);
                    // this.setAttribute(e, key, key, element);
                    // removeAttributes.push(key);

                    // transform...
                    e.attr[key] = this.transform(e, key, element);
                }

                removeAttributes.push(key);
                if (e.attr[key]) {
                    const cn =
                        key.indexOf(".") === -1
                        ? (
                            key.indexOf(":") === -1 ? key.charAt(0).toLowerCase() + key.substr(1) :
                            key.split(":").map((a, i) => i === 0 ? a.toUpperCase() : a).join(".")
                            )
                        : key;
                    changed[cn] = e.attr[key];
                }
            }
        }

        for (const iterator of removeAttributes) {
            delete e.attr[iterator];
        }

        e.attr = { ... changed };

    }

    public transform(e: XmlElement, key: string, value: string) {
        if (value.startsWith("$[")) {
            // two way binding...
            value = HtmlContent.processTwoWayBindingTSX(value);
            return `{Bind.twoWays(${value})}`;
        }
        if (value.startsWith("${") || value.startsWith("{{")) {

            if (this.element === e && /viewModel/.test(key)) {
                let i = value.indexOf("(");
                value = value.substr(i + 1);
                i = value.indexOf(")");
                value = value.substr(0, i);
                this.attributes.push([key, value]);
                return "";
            }

            if (/^event/i.test(key)) {
                value = HtmlContent.toEvent(value.substr(1));
                return `{Bind.event(${value})}`;
            }
            value = HtmlContent.processTwoWayBindingTSX(value);
            return `{Bind.oneTime(${value})}`;
        }
        if (value.startsWith("[")) {
            // two way binding...
            value = HtmlContent.processTwoWayBindingTSX(value);
            return `{Bind.oneWay(${value})}`;
        }
        return value;
    }

    public getFirstElement(e: XmlElement): XmlElement {
        for (const iterator of e.children) {
            if (iterator.type === "element") {
                return iterator;
            }
        }
        return null;
    }

    public write(iw: IndentedWriter): void {

        const controlImports = this.controlImports.map((s) => {
            return `const ${s.name} = new ${s.type}(this.app);\r\nthis.${s.name} = ${s.name}.element;`;
        });

        let d: IDisposable = null;

        let prefix = "";

        let setFilePath = false;

        if (this.template) {
            d = iw.beginBrackets(`function ${this.name}_Creator(__creator: any): any`);
            prefix = "return ";
        } else {

            iw.writeLine("// tslint:disable");

            iw.writeLine(`import { AtomXFControl } from "@web-atoms/core/dist/xf/controls/AtomXFControl";`);
            iw.writeLine(`import { AtomBridge } from "@web-atoms/core/dist/core/AtomBridge";`);
            iw.writeLine(`import XF from "@web-atoms/xf-controls/dist/controls/XF";`);
            iw.writeLine(`import X from "@web-atoms/xf-controls/dist/controls/X";`);
            iw.writeLine(`import * as WA from "@web-atoms/xf-controls/dist/controls/WA";`);
            iw.writeLine(`import AtomComboBox from "@web-atoms/xf-controls/dist/AtomComboBox";`);
            iw.writeLine(`import * as RgPluginsPopup from "@web-atoms/xf-controls/dist/controls/RgPluginsPopup";`);
            iw.writeLine(`import XNode from "@web-atoms/core/dist/core/XNode";`);
            iw.writeLine(`import Bind from "@web-atoms/core/dist/core/Bind";`);
            iw.writeLine(`declare var bridge: any;`);
            for (const key in this.imports) {
                if (this.imports.hasOwnProperty(key)) {
                    const element = this.imports[key];
                    iw.writeLine(`import ${key} from \"${element}\";`);
                }
            }

            prefix = "export default ";
            setFilePath = true;
        }

        // create class....
        iw.writeInNewBrackets(`${prefix}class ${this.name} extends AtomXFControl`, () => {

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

            for (const iterator of this.attributes) {
                const [name, value] = iterator;
                iw.writeLine("");
                iw.writeLine(`public ${name}: ${value};`);
            }

            if (this.element.name !== "null") {
                iw.writeLine("");
                iw.writeInNewBrackets("constructor(app: any, e?: any)", () => {
                    iw.writeLine(
                        `super(app, e || bridge.create(${this.element.name}));`);
                });
            }

            // write create...
            iw.writeInNewBrackets(`protected create(): void `, () => {

                iw.writeLine("");
                iw.writeLine("super.create();");

                for (const iterator of this.injects) {
                    iw.writeLine("");
                    iw.writeLine(`this.${iterator.key} = this.app.resolve(${iterator.type});`);
                }

                for (const iterator of this.attributes) {
                    const [name, value] = iterator;
                    iw.writeLine("");
                    iw.writeLine(`this.${name} = this.resolve(${value});`);
                }

                for (const iterator of controlImports) {
                    iw.writeLine("");
                    iw.writeLine(iterator);
                }

                iw.writeLine("");
                let xml = this.element.toStringWithIndent("\t");
                xml = xml.replace(/\"\{/gi, "{");
                xml = xml.replace(/\}\"/gi, "}");
                xml = xml.replace(/\&gt\;/gi, ">");
                xml = xml.replace(/(?<a>[a-z]+\:[a-z]+)\=(?<b>\"[^\"]+\")/gmi, "{ ...  $1($2) }");
                xml = xml.replace(/(?<a>[a-z]+\.[a-z]+)\=\"(?<b>[^\"]+)\"/gmi, "{ ...  XF.$1($2) }");
                xml = xml.replace(/(?<a>\<\!\-\-)(?<b>(.)+)(?<c>\-\-\>)/gm, "{ /*  $2 */}");
                xml = xml.replace(/(?<a>\{StaticResource)(?<b>[^\}]+)(?<c>\})/gm,
                "{Bind.oneTime(() => this.staticResource(\"$2\"))}");
                iw.writeLine(`this.render(${xml});`);

                // for (const iterator of attributeGroups) {
                //     iw.writeLine("");
                //     if (!iterator.key.startsWith("this.")) {
                //         iw.writeLine(`const ${iterator.key} = this.find("${iterator.key}");`);
                //     }
                //     for (const child of iterator.values) {
                //         child.write(iw);
                //     }
                // }

            });

        });

        // write children...
        for (const iterator of this.children) {
            iterator.write(iw);
        }

        if (d) {
            iw.writeLine(";");
            d.dispose();
        }

    }
}
