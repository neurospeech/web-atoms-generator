"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AtomEvaluator {
    constructor() {
        this.ecache = {};
        this.becache = {};
    }
    parse(txt) {
        // http://jsfiddle.net/A3vg6/44/ (recommended)
        // http://jsfiddle.net/A3vg6/45/ (working)
        // http://jsfiddle.net/A3vg6/51/ (including $ sign)
        let be = this.becache[txt];
        if (be) {
            return be;
        }
        var regex = /(?:(\$)(window|localViewModel|viewModel|data|owner|this))(?:\.[a-zA-Z_][a-zA-Z_0-9]*(\()?)*/gi;
        var keywords = /(window|localViewModel|viewModel|data|this|owner)/gi;
        var path = [];
        var vars = [];
        var found = {};
        var ms = txt.replace(regex, (match) => {
            var original = match;
            var nv = "v" + (path.length + 1);
            if (match.indexOf("$owner.") === 0) {
                match = match.substr(7);
            }
            else {
                if (match.indexOf("owner.") === 0) {
                    match = match.substr(6);
                }
                else {
                    match = match.substr(1);
                }
            }
            // let this be there...
            // if (match.indexOf("$this.") === 0) {
            // 	match = match.substr(6);
            // }
            var matches = match.split(".");
            var trail = "";
            matches = matches.filter(m => {
                if (!m.endsWith("(")) {
                    return true;
                }
                trail = "." + m;
                return false;
            });
            if (matches.length > 0) {
                path.push(matches);
                vars.push(nv);
            }
            else {
                return original;
            }
            return "(" + nv + ")" + trail;
        });
        var method = "return " + ms + ";";
        var methodString = method;
        try {
            method = this.compile(vars, method);
        }
        catch (e) {
            // throw new Error("Error executing \n" + methodString + "\nOriginal: " + txt + "\r\n" + e);
            throw new Error(`${e.message} in "${txt}"`);
        }
        be = {
            length: vars.length,
            method: method,
            path: path,
            original: ms
        };
        this.becache[txt] = be;
        return be;
    }
    compile(vars, method) {
        var k = vars.join("-") + ":" + method;
        var e = this.ecache[k];
        if (e) {
            return e;
        }
        vars.push("Atom");
        vars.push("AtomPromise");
        vars.push("$x");
        e = new Function(method);
        this.ecache[k] = e;
        return e;
    }
}
AtomEvaluator.instance = new AtomEvaluator();
exports.AtomEvaluator = AtomEvaluator;
//# sourceMappingURL=atom-evaluator.js.map