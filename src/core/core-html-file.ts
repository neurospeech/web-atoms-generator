import { PathLike, readFileSync } from "fs";
import { DomHandler, Parser } from "htmlparser2";
import { AtomEvaluator, CompiledMethod } from "../atom-evaluator";
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

export class CoreHtmlComponent implements IMarkupComponent {

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

            text += this.generateChildren(iterator, controlName, itemName);

        }
        return text;
    }

    public generateAttribute(key: string, value: string, itemName: string, controlName: string): string {
        let text: string = "\r\n";
        key = HtmlContent.camelCase(key);
        value = value.trim();

        // one time binding
        if (value.startsWith("{") && value.endsWith("}")) {
            value = HtmlContent.processOneTimeBinding(value);
            text += `${controlName}.setLocalValue(${itemName}, "${key}", ${value});`;
        }

        if (value.startsWith("[") && value.endsWith("]")) {
            value = HtmlContent.processOneWayBinding(value);
            text += `${controlName}.bind(${itemName}, "${key}", ${value});`;
        }

        return text;
    }

    public writeLine(line?: string): void {
        this.generated += (line || "") + "\r\n";
    }

}
