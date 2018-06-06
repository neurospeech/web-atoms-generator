import { PathLike, readFileSync } from "fs";
import { DomHandler, Parser } from "htmlparser2";
import { IHtmlNode } from "../html-node";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";

export class CoreHtmlFile implements IMarkupFile {

    public currentTime: number;
    public lastTime: number;
    public file: PathLike;
    public nodes: CoreHtmlComponent[] = [];

    constructor(private fileName: string, private nsNamespace: string) {

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

        root.generateCode();

    }

}

export class CoreHtmlComponent implements IMarkupComponent {

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

    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string = "// tslint:disable\r\n";

    public root: IHtmlNode;

    private index: number = 1;

    public generateCode(): void {
        this.writeLine(`import { AtomControl } from "web-atoms-core/bin/controls/atom-control";

        export class ${this.name} extends ${this.baseType || "AtomControl"} {

            public create(): void {
                this.element = document.createElement("${this.root.name}");

                ${this.generateChildren(this.root, "this", "this.element")};
            }
        }

        `);
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

            const at = iterator.attribs["atom-type"];
            if (at) {
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

            this.generateChildren(iterator, controlName, itemName);

        }
        return text;
    }

    public generateAttribute(key: string, value: string, itemName: string, controlName: string): string {
        let text: string = "\r\n";
        key = CoreHtmlComponent.camelCase(key);
        value = value.trim();

        // one time binding
        if (value.startsWith("{") && value.endsWith("}")) {
            text += `${controlName}.setLocalValue(${itemName}, "${key}", ${value});`;
        }

        if (value.startsWith("[") && value.endsWith("]")) {
            text += `${controlName}.bind(${itemName}, "${key}", ${value});`;
        }

        return text;
    }

    public writeLine(line?: string): void {
        this.generated += (line || "") + "\r\n";
    }

}
