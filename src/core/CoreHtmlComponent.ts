import { IHtmlNode } from "../html-node";
import { IMarkupComponent } from "../imarkup-file";
import { IWAConfig } from "../types";
import { CoreHtmlFile } from "./CoreHtmlFile";
import { DefaultImports } from "./DefaultImports";
import { WAComponent, WAElement } from "./WAComponents";

export class CoreHtmlComponent
    extends WAComponent
    implements IMarkupComponent {
    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string = "// tslint:disable\r\n";
    public config: IWAConfig;
    // public root: WAComponent;
    private index: number = 1;
    constructor(
        public readonly file: CoreHtmlFile,
        element: IHtmlNode,
        name: string,
        baseType: string) {
        super(null, element, name, baseType);
        // this.root = this.children[0] as WAComponent;
    }
    public resolve(name: string): string {
        if (DefaultImports.indexOf(name) !== -1) {
            if (!this.file.imports[name]) {
                this.file.imports[name] = { name, import: `web-atoms-core/dist/web/controls/${name}` };
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
        this.resolveNames(this);
        this.generated = this.toString();
    }
    public writeLine(line?: string): void {
        this.generated += (line || "") + "\r\n";
    }
}
