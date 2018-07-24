import { IMarkupComponent } from "../imarkup-file";
import { IWAConfig } from "../types";
import { CoreHtmlFile } from "./CoreHtmlFile";
import { DefaultImports } from "./DefaultImports";
import { WAComponent } from "./WAComponents";

export class CoreHtmlComponent implements IMarkupComponent {
    public baseType: string;
    public name: string;
    public nsNamespace: string;
    public generated: string = "// tslint:disable\r\n";
    public config: IWAConfig;
    public root: WAComponent;
    private index: number = 1;
    constructor(private file: CoreHtmlFile) {
        this.file.imports.BindableProperty = {
            name: "BindableProperty",
            import: "web-atoms-core/dist/core/BindableProperty"
        };
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
        this.root.resolveNames(this);
        this.generated = this.root.toString();
    }
    public writeLine(line?: string): void {
        this.generated += (line || "") + "\r\n";
    }
}
