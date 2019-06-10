import IDisposable from "./IDisposable";

import { RawSourceMap, SourceMapGenerator } from "source-map";
import { IHtmlNode } from "../html-node";
import ISourceLines, { ISourceLineInfo } from "./ISourceLines";

export default class IndentedWriter {

    public readonly pending: string[] = [];

    private content: string[] = [];

    private sourceMapGenerator: SourceMapGenerator;

    public get sourceMap(): RawSourceMap {
        return this.sourceMapGenerator.toJSON();
    }

    constructor(
        private source: string,
        private lineIndexes: ISourceLines,
        private indentText: string = "\t") {
        this.sourceMapGenerator = new SourceMapGenerator();
    }

    public writeLine(
        lines: string,
        nodeInfo?: IHtmlNode
    ): void {
        if (lines === undefined || lines === null) {
            return;
        }
        // let position: ISourceLineInfo = null;
        // if (nodeInfo) {
        //     const start = nodeInfo.startIndex;
        //     if (start) {
        //         const l = this.lineIndexes.find((x) => x.start + x.length < start);
        //         if (l) {
        //             position = {
        //                 line: l.line,
        //                 start: l.start,
        //                 length: start - l.start
        //             };
        //         }
        //     }
        // }
        for (const iterator of lines.split("\n")) {
            // if (position) {
            //     this.sourceMapGenerator.addMapping({
            //         source: this.source,
            //         generated: {
            //             line: this.content.length,
            //             column: 0
            //         },
            //         original: {
            //             line: position.line,
            //             column: position.length > 0 ? position.length : 0
            //         }
            //     });
            // }
            this.content.push(`${this.indentText}${iterator}`);
        }
    }

    public writeLineDeferred(
        lines: string
    ): void {
        if (lines === undefined || lines === null) {
            return;
        }
        // this.pending.push(lines);
        // this.writeLine(lines);
    }

    public indent(): IDisposable {
        const i = this.indentText;
        this.indentText = this.indentText + i[0];
        return {
            dispose: () => {
                this.indentText = i;
            }
        };
    }

    public writeInNewBlock(fx: (writer: IndentedWriter) => void): void {
        const i = this.indent();
        fx(this);
        i.dispose();
    }

    public writeInNewBrackets(
        startLine: string,
        fx: (writer: IndentedWriter) => void): void {
        const i = this.indent();
        this.writeLine(`${startLine} {`);
        fx(this);
        this.writeLine("}");
        i.dispose();
    }

    public toString(): string {
        return this.content.join("\n");
    }

}
