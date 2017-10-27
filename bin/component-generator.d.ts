import { HtmlFile } from "./http-file";
export declare class ComponentGenerator {
    nsNamesapce: string;
    emitDeclaration: boolean;
    loadFiles(folder: string): void;
    outFile: string;
    folder: string;
    files: Array<HtmlFile>;
    constructor(folder: string, outFile?: string, nsNamespace?: string, emitDeclaration?: boolean);
    compile(): void;
    createDirectories(fn: string): void;
    watch(): void;
    last: any;
    postCompile(): void;
}
