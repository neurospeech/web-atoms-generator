import { HtmlComponent } from "./html-component";
export declare class HtmlFile {
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
