"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_file_1 = require("./http-file");
const fs = require("fs");
const path = require("path");
class ComponentGenerator {
    loadFiles(folder) {
        // scan all html files...
        for (var file of fs.readdirSync(folder)) {
            var fullName = path.join(folder, file);
            var s = fs.statSync(fullName);
            if (s.isDirectory()) {
                this.loadFiles(fullName);
            }
            else {
                if (/\.html$/i.test(fullName)) {
                    if (this.files.findIndex(x => x.file === fullName) !== -1) {
                        continue;
                    }
                    this.files.push(new http_file_1.HtmlFile(fullName, this.nsNamesapce));
                }
            }
        }
    }
    constructor(folder, outFile, nsNamespace, emitDeclaration) {
        this.folder = folder;
        this.outFile = outFile;
        this.nsNamesapce = nsNamespace;
        if (emitDeclaration !== undefined) {
            this.emitDeclaration = emitDeclaration;
        }
        else {
            this.emitDeclaration = true;
        }
        this.files = [];
        this.watch();
        this.compile();
        console.log(`${(new Date()).toLocaleTimeString()} - Compilation complete. Watching for file changes.`);
        console.log("    ");
    }
    compile() {
        this.loadFiles(this.folder);
        var deletedFiles = [];
        var nodes = [];
        for (var file of this.files) {
            if (file.currentTime !== file.lastTime) {
                if (!fs.existsSync(file.file)) {
                    deletedFiles.push(file);
                }
                // console.log(`Generating ${file.file}`);
                file.compile();
            }
            for (var n of file.nodes) {
                nodes.push(n);
            }
        }
        // sort by baseType...
        nodes = nodes.sort((a, b) => {
            if (a.baseType === b.name) {
                return -1;
            }
            return 0;
        });
        for (var fx of deletedFiles) {
            this.files = this.files.filter(x => x.file === fx.file);
        }
        var result = "";
        var declarations = "";
        var mock = "";
        for (var node of nodes) {
            if (node.nsNamespace) {
                var nsStart = "window";
                for (var ns of node.nsNamespace.split(".")) {
                    result += `if(!${nsStart}['${ns}']){
						${nsStart}['${ns}'] = {};
					}`;
                    nsStart += "." + ns;
                }
            }
            result += "\r\n";
            result += node.generated;
            if (node.nsNamespace) {
                declarations += `declare namespace ${node.nsNamespace}{    class ${node.name} extends WebAtoms.AtomControl { }   }\r\n`;
                // mock += `namespace ${node.nsNamespace} { export  class ${node.name} {}  }`;
                mock += ` var ${node.nsNamespace} = ${node.nsNamespace} || {}; `;
                mock += ` ${node.nsNamespace}.${node.name} = {}; `;
            }
            else {
                declarations += `declare class ${node.name} {  }\r\n`;
                mock += `var ${node.name} = {}; `;
            }
        }
        this.createDirectories(this.outFile);
        fs.writeFileSync(this.outFile, result);
        var now = new Date();
        if (this.emitDeclaration) {
            fs.writeFileSync(`${this.outFile}.d.ts`, declarations);
            fs.writeFileSync(`${this.outFile}.mock.js`, mock);
        }
    }
    createDirectories(fn) {
        var dirName = path.dirname(fn);
        if (!fs.existsSync(dirName)) {
            var parent = path.dirname(dirName);
            if (!fs.existsSync(parent)) {
                this.createDirectories(parent);
            }
            fs.mkdirSync(dirName);
        }
    }
    watch() {
        fs.watch(this.folder, { recursive: true }, (event, file) => {
            this.postCompile();
        });
    }
    postCompile() {
        if (this.last) {
            clearTimeout(this.last);
        }
        this.last = setTimeout(() => {
            this.last = 0;
            console.log("    ");
            console.log(`${(new Date()).toLocaleTimeString()} - File change detected. Starting incremental compilation...`);
            console.log("     ");
            this.compile();
            console.log("     ");
            console.log(`${(new Date()).toLocaleTimeString()} - Compilation complete. Watching for file changes.`);
        }, 100);
    }
}
exports.ComponentGenerator = ComponentGenerator;
function parseFolder(folder) {
    var dirs = [];
    for (var file of fs.readdirSync(folder)) {
        var fullName = path.join(folder, file);
        var stat = fs.statSync(fullName);
        if (stat.isDirectory()) {
            dirs.push(fullName);
        }
        else {
            if (/^waconfig\.json$/i.test(file)) {
                var config = JSON.parse(fs.readFileSync(fullName, "utf8"));
                config.srcFolder = path.join(folder, config.srcFolder);
                config.outFile = path.join(folder, config.outFile);
                var cc = new ComponentGenerator(config.srcFolder, config.outFile, config.namespace || "", config.emitDeclaration);
                return;
            }
        }
    }
    for (var dir of dirs) {
        parseFolder(dir);
    }
}
if (process && process.argv) {
    if (process.argv[2] !== undefined) {
        if (process.argv[3]) {
            var cc = new ComponentGenerator(process.argv[2], process.argv[3]);
        }
        else {
            parseFolder(process.argv[2]);
        }
    }
    else {
        parseFolder(".");
    }
}
//# sourceMappingURL=component-generator.js.map