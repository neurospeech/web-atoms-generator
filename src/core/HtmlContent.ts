import { AtomEvaluator } from "../atom-evaluator";
import { ICompiledPath } from "./ICompiledPath";

export class HtmlContent {

    public static toCamelCase(text: string): string {
        return text.charAt(0).toLowerCase() + text.substr(1);
    }

    public static removeBrackets(text: string): string {
        text = text.trim();
        if (text.startsWith("{") || text.startsWith("[")) {
            text = text.substr(1);
        }
        if (text.endsWith("]") || text.endsWith("}")) {
            text = text.substr(0, text.length - 1);
        }
        return text;
    }

    public static processTwoWayBindingTSX(text: string): string {
        let isTwoWays = false;
        if (/^(\$|\^)/.test(text)) {
            text = text.substr(1);
            if (text.startsWith("[")) {
                isTwoWays = true;
            }
        }
        text = HtmlContent.removeBrackets(text).trim();

        if (isTwoWays) {
            if (!text.startsWith("$")) {
                text = "$" + text;
            }
        }

        if (text.startsWith("{")) {
            text = `(${text})`;
        }
        text = text.replace(/(?<a>\$)(?<b>[a-z]+)/gi, "x.$2").replace(/x\.this\./g, "this.");
        if (/x\./.test(text)) {
            return `(x) => ${text}`;
        }
        return `() => ${text}`;
    }

    public static processTwoWayBinding(v: string, events: string = "change"): ICompiledPath {
        v = v.substr(2, v.length - 3);
        if (v.startsWith("$")) {
            v = v.substr(1);
        }
        const plist = v.split(".");
        v = ` [${JSON.stringify(plist)}], ${events} `;
        return {
            expression: v,
            pathList: [plist]
        };
    }

    public static processOneWayBinding(v: string): ICompiledPath {
        v = v.substr(1, v.length - 2);
        const vx = AtomEvaluator.instance.parse(v);
        v = "";
        const plist: string = vx.path.map((p, i) => `v${i + 1}`).join(",");
        if (plist === "v1" && vx.original.trim() === "(v1)") {
            v += ` ${JSON.stringify(vx.path)}, false , null`;
        } else {
            v += ` ${JSON.stringify(vx.path)}, false , (${plist}) => ${vx.original}`;
        }
        return {
            expression: v,
            pathList: vx.path
        };
    }

    public static toEvent(text: string): string {
        const v = HtmlContent.removeBrackets(HtmlContent.processOneTimeBinding(text, "x")).trim().substr(1);
        if (v.startsWith(")")) {
            return `(x${v}`;
        }
        return `(x, e${v.substr(1)}`;
    }

    public static processOneTimeBinding(v: string, start: string = "this"): string {
        let original = v;
        v = v.substr(1, v.length - 2);
        const vx = AtomEvaluator.instance.parse(v);
        v = vx.original;
        for (let i: number = 0; i < vx.path.length; i++) {
            const p: string[] = vx.path[i];
            const pr = p.reduce((pv, x) =>
                (!pv.v.length)
                    ? { v: [`${start}.${x}`], t: `${start}.${x}` }
                    : {
                            v: `${pv.v.join(".")}.${x}`.split("."), t:
                            `(${pv.t}) ? ${pv.v.join(".")}.${x} : undefined`
                    } , { v: [], t: "" });
            v = v.replace(`v${i + 1}`, `${pr.t}`);
            original = null;
        }
        return original || v;
    }
    public static camelCase(text: string): string {
        if (text.startsWith("atom-")) {
            text = text.substr(5);
        }
        return text.split("-").map((v, i) => {
            if (i) {
                v = v.charAt(0).toUpperCase() + v.substr(1);
            }
            return v;
        }).join("");
    }
}
