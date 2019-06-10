import IDisposable from "./IDisposable";

export default class IndentedWriter {

    public readonly pending: string[] = [];

    private content: string[] = [];

    constructor(private indentText: string = "\t") {
    }

    public writeLine(
        lines: string
    ): void {
        if (lines === undefined || lines === null) {
            return;
        }
        for (const iterator of lines.split("\n")) {
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
        this.writeLine(lines);
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
