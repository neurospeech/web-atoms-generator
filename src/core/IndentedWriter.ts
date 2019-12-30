import IDisposable from "./IDisposable";

import { isWorker } from "cluster";
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
        private indentText: string = "",
        private indentChar: string = "\t") {
        this.sourceMapGenerator = new SourceMapGenerator();
    }

    public write(line: string) {
        this.content.push(line);
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
            this.content.push(iterator);
            this.content.push("\r\n" + this.indentText);
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
        this.indentText = this.indentText + this.indentChar;
        const it = this.indentText;
        this.changeLast(i, it);
        return {
            dispose: () => {

                this.changeLast(it, i);

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
        this.writeLine(`${startLine} {`);
        const i = this.indent();
        fx(this);
        i.dispose();
        this.writeLine("}");
    }

    public beginBrackets(prefix?: string): IDisposable {
        prefix = prefix ? `${prefix} {` : "{";
        this.writeLine(prefix);
        const d = this.indent();

        return {
            dispose: () => {
                d.dispose();
                this.writeLine("}");
            }
        };
    }

    public toString(): string {
        return this.content.join("").split("\r\n").map((x) => x.trim() ? x : "").join("\r\n");
    }

    private changeLast(check: string, replace: string) {
        const last = this.content.length - 1;
        if (last >= 0) {
            const line = this.content[last];
            if (line.endsWith(check)) {
                this.content[last] = line.substr(0, line.length - check.length - 1) + replace;
            }
        }

    }

}
