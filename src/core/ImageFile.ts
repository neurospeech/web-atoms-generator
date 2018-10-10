import { existsSync, PathLike, readFileSync, statSync, writeFileSync } from "fs";
import { format, parse, ParsedPath } from "path";
import { IMarkupComponent, IMarkupFile } from "../imarkup-file";

export class ImageFile implements IMarkupFile {

    public nodes: IMarkupComponent[] = [];

    public get currentTime(): number {
        if (!existsSync(this.file)) {
            return -1;
        }
        return statSync(this.file).mtime.getTime();
    }

    public packageContent: any;
    public lastTime: number;
    private path: ParsedPath;

    /**
     *
     */
    constructor(public readonly file: string) {
        this.path = parse(file);
    }

    public compile(packageContent: any): void {
        try {
            this.packageContent = packageContent;
            const content = readFileSync(this.file);
            this.lastTime = this.currentTime;
            this.createSync(content);
            this.createAsync(content);
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
        }
    }

    private createSync(content: Buffer): void {
        const p = parse(this.file);
        p.name = this.toPascalCase(p.name) + "DataUrl";
        p.ext = ".ts";
        p.base = p.name + p.ext;

        let mimeType: string = "image/jpeg";
        switch (this.path.ext) {
            case ".png":
                mimeType = "image/png";
                break;
                case ".gif":
                mimeType = "image/gif";
                break;
                case ".svg":
                mimeType = "image/svg+xml";
                break;
        }

        const b64 = content.toString("base64");

        const b: string[] = b64.match(/(.{1,80})/g);
        const s = `// tslint:disable
import WebImage from "web-atoms-core/dist/core/WebImage";

const base64 = ${b.map((str) => JSON.stringify(str)).join("+\r\n\t\t")};

export default new WebImage(\`data:${mimeType};base64,\${base64}\`);
`;
        const fileName = format(p);
        // tslint:disable-next-line:no-console
        writeFileSync(`${fileName}`, s, "utf8");
    }

    private createAsync(content: Buffer): void {
        const p = parse(this.file);
        p.name = this.toPascalCase(p.name);

        const n = this.file.split("\\").join("/").split("/");
        if (n[0] === "src") {
            n[0] = "dist";
        }

        const s = `// tslint:disable
import WebImage from "web-atoms-core/dist/core/WebImage";
declare UMD: any;
export default new WebImage(UMD.resolvePath("${this.packageContent.name}/${n.join("/")}"));
                `;

        p.name = p.name;
        p.ext = ".ts";
        p.base = p.name + p.ext;
        const fileName = format(p);
        writeFileSync(`${fileName}`, s, "utf8");
    }

    private toPascalCase(text: string): string {
        return text.split("-").reduce( (pv, t) => (t[0].toUpperCase() + t.substr(1)), "");
    }
}
