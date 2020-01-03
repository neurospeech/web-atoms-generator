export interface IHtmlNode {

    startIndex?: number;
    type?: string;
    data?: string;
    tag?: string;
    name?: string;
    attribs?: any;
    children?: IHtmlNode[];
    parent?: IHtmlNode;

}
