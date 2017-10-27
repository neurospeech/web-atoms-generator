import { HtmlNode } from "./html-content";
export declare class TagInitializerList {
    component: string;
    tags: Array<TagInitializer>;
    constructor(name: string);
    toScript(): string;
}
export declare class TagInitializer {
    inits: Array<string>;
    constructor(inits: Array<string>);
    toScript(): string;
}
export declare class HtmlComponent {
    baseType: string;
    name: string;
    nsNamespace: string;
    generated: string;
    generatedStyle: string;
    constructor(node: HtmlNode, nsNamespace: string, name?: string, less?: string);
    mapNode(a: HtmlNode, tags: TagInitializerList, children?: Array<any>): string[];
    parseNode(node: HtmlNode, name?: string): string;
    compileLess(): void;
}
