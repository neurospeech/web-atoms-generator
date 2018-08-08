import * as fs from "fs";
import * as path from "path";

export class ReplaceTilt {

    public static replace(content: string, filePath: string): string {
        const regex = /\"\~([^\"]+)\"/gi;

        return content.replace(regex, (m: string) => {

            m = m.substr(2, m.length - 3);
            if (m.startsWith("/")) {
                m = m.substr(1);
            }
            let r: string = path.relative(filePath, m);
            if (path.sep === "\\") {
                r = r.replace(/\\/g, (s) => "/");
            }
            if (! /\./.test(r)) {
                r = `./${r}`;
            }
            return `"${r}"`;
        });
    }

}
