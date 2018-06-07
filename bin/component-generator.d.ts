/// <reference types="node" />
import * as fs from "fs";
import { IMarkupFile } from "./imarkup-file";
import { IWAConfig, Mode } from "./types";
export declare class ComponentGenerator {
    private config;
    nsNamesapce: string;
    emitDeclaration: boolean;
    mode: Mode;
    loadFiles(folder: string): void;
    outFile: string;
    folder: string;
    files: Array<IMarkupFile>;
    constructor(config: IWAConfig);
    compile(): void;
    createDirectories(fn: string): void;
    watcher: fs.FSWatcher;
    watch(): void;
    last: any;
    postCompile(): void;
}
