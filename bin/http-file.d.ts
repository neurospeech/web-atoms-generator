import { HtmlComponent } from "./html-component";
import { IMarkupFile } from "./imarkup-file";
export declare class HtmlFile implements IMarkupFile {
    nsNamespace: string;
    file: string;
    lastTime: number;
    nodes: Array<HtmlComponent>;
    readonly currentTime: number;
    constructor(file: string, nsNamespace: string);
    compile(): void;
    pascalCase(s: string): string;
    compileNodes(html: string, less: string, name: string): void;
}
