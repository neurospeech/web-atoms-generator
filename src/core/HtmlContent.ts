import { AtomEvaluator } from "../atom-evaluator";
import { ICompiledPath } from "./ICompiledPath";

export class HtmlContent {
    public static processTwoWayBinding(v: string, events: string): ICompiledPath {
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
    public static escapeLambda(v: string): string {
        v = v.trim();
        //         if (v.startsWith("()=>") || v.startsWith("() =>") || v.startsWith("=>")) {
        //             v = v.replace("()=>", "");
        //             v = v.replace("() =>", "");
        //             v = v.replace("=>", "");
        //             return `function(){
        //     return ${v};
        // }`;
        //         }
        return v;
    }
    public static processOneWayBinding(v: string): ICompiledPath {
        v = v.substr(1, v.length - 2);
        v = HtmlContent.escapeLambda(v);
        const vx = AtomEvaluator.instance.parse(v);
        v = "";
        const plist: string = vx.path.map((p, i) => `v${i + 1}`).join(",");
        v += ` ${JSON.stringify(vx.path)}, false , (${plist}) => ${vx.original}`;
        return {
            expression: v,
            pathList: vx.path
        };
    }
    public static processOneTimeBinding(v: string): string {
        let original = v;
        v = v.substr(1, v.length - 2);
        v = HtmlContent.escapeLambda(v);
        const vx = AtomEvaluator.instance.parse(v);
        v = vx.original;
        for (let i: number = 0; i < vx.path.length; i++) {
            const p: string[] = vx.path[i];
            const start: string = "this";
            v = v.replace(`v${i + 1}`, `this.${p.join(".")}`);
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
