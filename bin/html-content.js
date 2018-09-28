"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const atom_evaluator_1 = require("./atom-evaluator");
class HtmlContent {
    static processTwoWayBinding(v) {
        v = v.substr(2, v.length - 3);
        if (v.startsWith("$")) {
            v = v.substr(1);
        }
        var plist = v.split(".");
        v = ` ${JSON.stringify(plist)}, 1 `;
        return v;
    }
    static escapeLambda(v) {
        v = v.trim();
        if (v.startsWith("()=>") || v.startsWith("() =>") || v.startsWith("=>")) {
            v = v.replace("()=>", "");
            v = v.replace("() =>", "");
            v = v.replace("=>", "");
            return `function(){
				return ${v};
			}`;
        }
        return v;
    }
    static processOneWayBinding(v) {
        v = v.substr(1, v.length - 2);
        v = HtmlContent.escapeLambda(v);
        var vx = atom_evaluator_1.AtomEvaluator.instance.parse(v);
        v = "";
        var plist = vx.path.map((p, i) => `v${i + 1}`).join(",");
        v += ` ${JSON.stringify(vx.path)}, 0, function(${plist}) { return ${vx.original}; }`;
        return v;
    }
    static processOneTimeBinding(v) {
        v = v.substr(1, v.length - 2);
        v = HtmlContent.escapeLambda(v);
        var vx = atom_evaluator_1.AtomEvaluator.instance.parse(v);
        v = vx.original;
        for (var i = 0; i < vx.path.length; i++) {
            var p = vx.path[i];
            var start = "this";
            v = v.replace(`v${i + 1}`, `Atom.get(this,"${p.join(".")}")`);
        }
        return v;
    }
    static camelCase(text) {
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
    static formLayoutNode(a) {
        var cl1 = a.children.filter(c => c.type === "tag").map(c => {
            var fieldAttributes = {
                "class": "atom-field"
            };
            var aa = c.attribs || {};
            var label = aa["atom-label"] || "";
            if (label) {
                delete aa["atom-label"];
            }
            var isRequired = aa["atom-required"];
            if (isRequired) {
                delete aa["atom-required"];
            }
            else {
                isRequired = "";
            }
            if (isRequired.endsWith("}") || isRequired.endsWith("]")) {
                var last = isRequired.substr(isRequired.length - 1);
                isRequired = isRequired.substr(0, isRequired.length - 1) + " ? '*' : 'false'" + last;
            }
            if (/true/i.test(isRequired)) {
                isRequired = "*";
            }
            var error = aa["atom-error"] || "";
            if (error) {
                delete aa["atom-error"];
            }
            var fieldVisible = aa["atom-field-visible"] ||
                aa["field-visible"] ||
                aa["atom-field-visibility"] ||
                aa["field-visibility"];
            if (fieldVisible) {
                delete aa["atom-field-visible"];
                delete aa["field-visible"];
                delete aa["atom-field-visibility"];
                delete aa["field-visibility"];
                fieldVisible = fieldVisible.trim();
                if (fieldVisible.startsWith("{")) {
                    fieldVisible = fieldVisible.substr(1, fieldVisible.length - 2);
                    fieldVisible = `{ ${fieldVisible} ? '' : 'none' }`;
                }
                if (fieldVisible.startsWith("[")) {
                    fieldVisible = fieldVisible.substr(1, fieldVisible.length - 2);
                    fieldVisible = `[ ${fieldVisible} ? '' : 'none' ]`;
                }
                fieldAttributes["style-display"] = fieldVisible;
            }
            var errorAttribs = {
                "class": "atom-error",
                "atom-text": error
            };
            var errorStyle = "";
            if (error) {
                if (error.endsWith("}") || error.endsWith("]")) {
                    var last = error.substr(error.length - 1);
                    errorStyle = error.substr(0, error.length - 1) + " ? '' : 'none'" + last;
                    errorAttribs["style-display"] = errorStyle;
                }
            }
            var cl = [
                {
                    name: "label",
                    type: "tag",
                    attribs: {
                        "atom-text": label,
                        "class": "atom-label"
                    },
                    children: []
                },
                {
                    name: "span",
                    type: "tag",
                    attribs: {
                        "class": "atom-required",
                        "atom-text": isRequired
                    },
                    children: []
                },
                c,
                {
                    name: "div",
                    type: "tag",
                    attribs: errorAttribs,
                    children: []
                }
            ];
            return {
                name: "div",
                type: "tag",
                attribs: fieldAttributes,
                children: cl
            };
        });
        var formAttribs = a.attribs || {};
        // tslint:disable-next-line:no-string-literal
        var fc = formAttribs["class"];
        if (fc) {
            // tslint:disable-next-line:no-string-literal
            formAttribs["class"] = "atom-form " + fc;
        }
        else {
            // tslint:disable-next-line:no-string-literal
            formAttribs["class"] = "atom-form";
        }
        return {
            name: "div",
            type: "tag",
            attribs: formAttribs,
            children: cl1
        };
    }
}
exports.HtmlContent = HtmlContent;
//# sourceMappingURL=html-content.js.map