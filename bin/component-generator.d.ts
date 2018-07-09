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
    outFolder: string;
    folder: string;
    files: Array<IMarkupFile>;
    constructor(config: IWAConfig);
    compile(): void;
    replacePlatformName(name: string[]): string[];
    writeNames(f: IMarkupFile[], packageName: string): string;
    merge(src: any, dest: any): void;
    toSafeName(name: string): string;
    createDirectories(fn: string): void;
    watcher: fs.FSWatcher;
    watch(): void;
    last: any;
    postCompile(): void;
}
