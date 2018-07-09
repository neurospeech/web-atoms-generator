"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable
const fs = require("fs");
const path = require("path");
const core_html_file_1 = require("./core/core-html-file");
const http_file_1 = require("./http-file");
const types_1 = require("./types");
const xaml_file_1 = require("./xaml/xaml-file");
const ImageFile_1 = require("./core/ImageFile");
const html_content_1 = require("./html-content");
class ComponentGenerator {
    constructor(config) {
        this.config = config;
        this.mode = types_1.Mode.None;
        this.folder = config.srcFolder;
        this.outFile = config.outFile;
        this.nsNamesapce = config.namespace;
        this.mode = config.mode;
        this.outFolder = config.outFolder;
        if (config.emitDeclaration !== undefined) {
            this.emitDeclaration = config.emitDeclaration;
        }
        else {
            if (!/core/i.test(this.mode)) {
                this.emitDeclaration = true;
            }
        }
        this.files = [];
        this.watch();
        this.compile();
        console.log(`${(new Date()).toLocaleTimeString()} - Compilation complete. Watching for file changes.`);
        console.log("    ");
    }
    loadFiles(folder) {
        // scan all html files...
        for (var file of fs.readdirSync(folder)) {
            var fullName = path.join(folder, file);
            var s = fs.statSync(fullName);
            if (s.isDirectory()) {
                this.loadFiles(fullName);
            }
            else {
                if (/core/i.test(this.mode)) {
                    if (/\.(jpg|png|gif|svg)$/.test(fullName)) {
                        if (this.files.findIndex(x => x.file === fullName) !== -1) {
                            continue;
                        }
                        this.files.push(new ImageFile_1.ImageFile(fullName));
                        continue;
                    }
                }
                const isHtml = /\.html$/i.test(fullName);
                const isXml = /\.(xml|xaml)$/i.test(fullName);
                if (isHtml || isXml) {
                    // console.log(fullName);
                    if (this.files.findIndex(x => x.file === fullName) !== -1) {
                        continue;
                    }
                    if (this.mode == types_1.Mode.None) {
                        this.files.push(new http_file_1.HtmlFile(fullName, this.nsNamesapce));
                    }
                    else {
                        if (isXml) {
                            this.files.push(new xaml_file_1.XamlFile(fullName, this.config));
                        }
                        else {
                            this.files.push(new core_html_file_1.CoreHtmlFile(fullName, this.config));
                        }
                    }
                }
            }
        }
    }
    // compileCore(): void {
    // 	for(var file of this.files) {
    // 		if(file.currentTime !== file.lastTime) {
    // 			if(!fs.existsSync(file.file)) {
    // 				fs.unlinkSync(`${file.file}.generated.ts`);
    // 			}
    // 			// console.log(`Generating ${file.file}`);
    // 			file.compile();
    // 		}
    // 	}
    // }
    compile() {
        this.loadFiles(this.folder);
        // if (this.outFolder && /core/i.test(this.mode)) {
        // 	this.createDirectories(this.outFolder);
        // 	if (!fs.existsSync(this.outFolder)) {
        // 		fs.mkdirSync(this.outFolder);
        // 	}
        // }
        // if(this.mode == Mode.Core){
        // 	this.compileCore();			
        // 	return;
        // }
        var deletedFiles = [];
        var nodes = [];
        for (var file of this.files) {
            if (file.currentTime !== file.lastTime) {
                if (!fs.existsSync(file.file)) {
                    deletedFiles.push(file);
                    continue;
                }
                // console.log(`Generating ${file.file}`);
                file.compile();
            }
            for (var n of file.nodes) {
                nodes.push(n);
            }
        }
        if (/core/i.test(this.mode)) {
            let packageFolder = this.folder;
            while (true) {
                if (fs.existsSync(path.join(packageFolder, "package.json"))) {
                    break;
                }
                packageFolder = path.dirname(packageFolder);
                continue;
            }
            const packageContent = JSON.parse(fs.readFileSync(path.join(packageFolder, "package.json"), {
                encoding: "utf8",
                flag: "r"
            }));
            // write ModuleFiles
            const content = `// tslint:disable
			declare var UMD: any;
			UMD = UMD || { resolvePath: (v) => v };
			export const ModuleFiles = {
				files: ${this.writeNames(this.files, packageContent.name)}
			}
`;
            fs.writeFileSync(this.folder + "/ModuleFiles.ts", content, "utf8");
            console.log(`Modules written to ${this.folder}/ModuleFiles.ts`);
            return;
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
    replacePlatformName(name) {
        const last = name[name.length - 1];
        if (!/\.(xml|xaml|html|htm)$/i.test(last)) {
            return name;
        }
        name[0] = "bin";
        const platformFolder = name[1];
        if (/^(web|xf|wpf)$/i.test(platformFolder)) {
            name[1] = "{platform}";
        }
        const pp = path.parse(last);
        name[name.length - 1] = pp.name;
        return name;
    }
    writeNames(f, packageName) {
        const fileNames = f.map((fx) => this.replacePlatformName(fx.file.toString().split(path.sep)));
        const root = {};
        for (const iterator of fileNames) {
            let start = root;
            let parent = root;
            let last = "";
            for (const segment of iterator) {
                const name = this.toSafeName(segment);
                parent = start;
                last = name;
                if (name === "{platform}") {
                    start = parent;
                }
                else {
                    start = start[name] = (start[name] || {});
                }
            }
            delete parent[last];
            const fileName = parent[last] = packageName + "/" + iterator.join("/");
            if (/(\.(jpg|gif|jpeg|svg|png))$/.test(fileName)) {
                parent[last] = "~(" + fileName + ")~";
            }
        }
        // move "bin" to root...
        const bin = root["bin"];
        if (bin) {
            delete root["bin"];
            this.merge(bin, root);
        }
        const content = JSON.stringify(root, undefined, 2);
        return content.replace("\"~(", "UMD.resolvePath(\"").replace(")~\"", "\")");
    }
    merge(src, dest) {
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                const element = src[key];
                if (typeof element === "object") {
                    const dchild = dest[key] || (dest[key] = {});
                    this.merge(element, dchild);
                }
                else {
                    dest[key] = element;
                }
            }
        }
    }
    toSafeName(name) {
        return html_content_1.HtmlContent.camelCase(name.replace(".", "_"));
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
        this.watcher = fs.watch(this.folder, { recursive: true }, (event, file) => {
            this.postCompile();
        });
    }
    postCompile() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
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
            this.watch();
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
                if (config.outFile) {
                    config.outFile = path.join(folder, config.outFile);
                }
                config.namespace = config.namespace || "";
                var cc = new ComponentGenerator(config);
                return;
            }
        }
    }
    for (var dir of dirs) {
        parseFolder(dir);
    }
}
if (process && process.argv) {
    // if (process.argv[2] !== undefined) {
    // 	if (process.argv[3]) {
    // 		var cc: ComponentGenerator = new ComponentGenerator(process.argv[2], process.argv[3]);
    // 	} else {
    // 		parseFolder(process.argv[2]);
    // 	}
    // } else {
    parseFolder(".");
    // }
}
//# sourceMappingURL=component-generator.js.map