"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const htmlparser2_1 = require("htmlparser2");
const fs = require("fs");
const path = require("path");
const html_component_1 = require("./html-component");
const generator_context_1 = require("./generator-context");
class HtmlFile {
    get currentTime() {
        return fs.statSync(this.file).mtime.getTime();
    }
    constructor(file, nsNamespace) {
        this.file = file;
        this.nsNamespace = nsNamespace;
        this.lastTime = 0;
    }
    compile() {
        generator_context_1.GeneratorContext.instance.fileName = this.file.split("\\").join("/");
        var html = fs.readFileSync(this.file, "utf8");
        var dirName = path.dirname(this.file);
        var p = path.parse(this.file);
        var less = "";
        var lessName = `${dirName}${path.sep}${p.name}.less`;
        if (fs.existsSync(lessName)) {
            less = fs.readFileSync(lessName, "utf8");
            // console.log(`$$ Found Less file ${lessName}`);
        }
        var lastLength = 0;
        generator_context_1.GeneratorContext.instance.fileLines = html.split("\n").map(x => {
            var n = lastLength;
            lastLength += x.length + 1;
            return n;
        });
        this.compileNodes(html, less, this.pascalCase(p.name));
        this.lastTime = this.currentTime;
    }
    pascalCase(s) {
        if (!s) {
            return "";
        }
        var str = s.replace(/-([a-z])/ig, (all, letter) => letter.toUpperCase());
        return str.slice(0, 1).toUpperCase() + str.slice(1);
    }
    compileNodes(html, less, name) {
        this.nodes = [];
        var handler = new htmlparser2_1.DomHandler((error, dom) => {
            if (error) {
                console.error(error);
            }
        }, { withStartIndices: true });
        var parser = new htmlparser2_1.Parser(handler);
        parser.write(html);
        parser.end();
        // debugger;
        for (var node of handler.dom) {
            var cn = new html_component_1.HtmlComponent(node, this.nsNamespace, name, less);
            if (cn.generated) {
                this.nodes.push(cn);
                less = null;
            }
        }
    }
}
exports.HtmlFile = HtmlFile;
//# sourceMappingURL=http-file.js.map