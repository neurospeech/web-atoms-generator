import { IMarkupFile } from "./imarkup-file";
export declare enum Mode {
    None = "",
    Core = "Core"
}
export declare class ComponentGenerator {
    nsNamesapce: string;
    emitDeclaration: boolean;
    mode: Mode;
    loadFiles(folder: string): void;
    outFile: string;
    folder: string;
    files: Array<IMarkupFile>;
    constructor(folder: string, outFile?: string, mode?: Mode, nsNamespace?: string, emitDeclaration?: boolean);
    compile(): void;
    createDirectories(fn: string): void;
    watch(): void;
    last: any;
    postCompile(): void;
}
