export declare type HtmlNode = {
    startIndex?: number;
    type?: string;
    data?: string;
    tag?: string;
    name?: string;
    attribs?: any;
    children?: Array<HtmlNode>;
};
export declare class HtmlContent {
    static processTwoWayBinding(v: string): string;
    static escapeLambda(v: string): string;
    static processOneWayBinding(v: string): string;
    static processOneTimeBinding(v: string): string;
    static camelCase(text: string): string;
    static formLayoutNode(a: HtmlNode): HtmlNode;
}
