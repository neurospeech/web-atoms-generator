export interface ISourceLineInfo {
    line: number;
    start: number;
    length: number;
}

declare type ISourceLines = ISourceLineInfo[];

export default ISourceLines;
