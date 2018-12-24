import { existsSync, readFileSync, writeFileSync } from "fs";

export default class FileApi {

    public static writeSync(path: string, content: string): void {
        if (existsSync(path)) {
            const existing = readFileSync(path, "utf8");
            if (existing === content) {
                return;
            }
            if (this.flat(existing) === this.flat(content)) {
                return;
            }
        }
        writeFileSync(path, content, "utf8");
    }

    private static flat(content: string): string {
        return content
            .split("\n")
            .map((s) => s.trimRight())
            .join("\n");
    }
}
