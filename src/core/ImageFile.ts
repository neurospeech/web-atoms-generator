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

    public lastTime: number;
    private path: ParsedPath;

    /**
     *
     */
    constructor(public readonly file: string) {
        this.path = parse(file);
    }

    public compile(): void {
        try {
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
        const p = this.clone(this.path);
        p.name = this.toPascalCase(p.name);
        p.ext = ".ts";

        let mimeType: string = "image/jpeg";
        switch (this.path.ext) {
            case ".png":
                mimeType = "image/png";
                break;
                case ".gif":
                mimeType = "image/gif";
                break;
                case ".svg":
                mimeType = "image/svg";
                break;
        }

        const b64 = content.toString("base64");

        const b: string[] = b64.match(/(.{1,80})/g);
        const s = `

        declare var SystemJS: any;

        export class ${p.name} {

            private static get contentUrl(): string {
                return ${b.join("+\r\n\t\t")};
            }

            public static url(): string {
                return \`data:${mimeType};base64,\${${p.name}.contentUrl}\`;
            }
        }
        `;
        const fileName = format(p);
        // tslint:disable-next-line:no-console
        console.log(`Writing ${fileName}`);
        writeFileSync(`${fileName}`, s, "utf8");
    }

    private createAsync(content: Buffer): void {
        const p = this.clone(this.path);
        p.name = this.toPascalCase(p.name) + "Async";
        p.ext = ".ts";

        const s = `

        declare var SystemJS: any;

        export class ${p.name}Async {

            public static url(): Promise<string> {
                return new Promise(
                    (resolve, reject) => {
                        SystemJS.import("${p.name}")
                            .then((m) => {
                                resolve(m[${p.name}].url());
                            }).catch((r) => {
                                reject(r);
                            });
                    }
                );
            }
        }
        `;
        const fileName = format(p);
        writeFileSync(`${fileName}`, s, "utf8");
    }

    private toPascalCase(text: string): string {
        return text.split("-").reduce( (pv, t) => (t[0].toUpperCase() + t.substr(1)), "");
    }

    private clone(p: ParsedPath): any {
        return JSON.parse(JSON.stringify(p));
    }
}
