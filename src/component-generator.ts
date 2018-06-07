import * as fs from "fs";
import * as path from "path";
import { CoreHtmlFile } from "./core/core-html-file";
import { HtmlFile } from "./http-file";
import { IMarkupComponent, IMarkupFile } from "./imarkup-file";
import { IWAConfig, Mode } from "./types";
import { XamlFile } from "./xaml/xaml-file";



export class ComponentGenerator {

	nsNamesapce: string;

	emitDeclaration: boolean;

	mode: Mode = Mode.None;

	loadFiles(folder: string): void {

		// scan all html files...
		for (var file of fs.readdirSync(folder)) {

			var fullName: string = path.join(folder, file);
			var s: fs.Stats = fs.statSync(fullName);
			if (s.isDirectory()) {
				this.loadFiles(fullName);
			} else {
				const isHtml = /\.html$/i.test(fullName);
				const isXml = /\.(xml|xaml)$/i.test(fullName);
				if (isHtml || isXml) {

					if (this.files.findIndex(x => x.file === fullName) !== -1) {
						continue;
					}

					if (this.mode == Mode.None) {
						this.files.push(new HtmlFile(fullName, this.nsNamesapce));
					} else {
						if (isXml) {
							this.files.push(new XamlFile(fullName, this.config));
						} else {
							this.files.push(new CoreHtmlFile(fullName, this.config));
						}
					}
				}
			}
		}
	}

	outFile: string;

	folder: string;

	files: Array<IMarkupFile>;



	constructor(private config: IWAConfig) {
		this.folder = config.srcFolder;
		this.outFile = config.outFile;
		this.nsNamesapce = config.namespace;
		this.mode = config.mode;

		if (config.emitDeclaration !== undefined) {
			this.emitDeclaration = config.emitDeclaration;
		} else {
			this.emitDeclaration = true;
		}

		this.files = [];


		this.watch();
		this.compile();
		console.log(`${(new Date()).toLocaleTimeString()} - Compilation complete. Watching for file changes.`);
		console.log("    ");

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

	compile(): void {

		this.loadFiles(this.folder);

		// if(this.mode == Mode.Core){
		// 	this.compileCore();			
		// 	return;
		// }


		var deletedFiles: Array<IMarkupFile> = [];

		var nodes: Array<IMarkupComponent> = [];

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

		var result: string = "";

		var declarations: string = "";

		var mock: string = "";

		for (var node of nodes) {

			if (node.nsNamespace) {
				var nsStart: string = "window";
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
			} else {
				declarations += `declare class ${node.name} {  }\r\n`;
				mock += `var ${node.name} = {}; `;
			}
		}


		this.createDirectories(this.outFile);

		fs.writeFileSync(this.outFile, result);
		var now: Date = new Date();

		if (this.emitDeclaration) {
			fs.writeFileSync(`${this.outFile}.d.ts`, declarations);
			fs.writeFileSync(`${this.outFile}.mock.js`, mock);
		}
	}

	createDirectories(fn: string): void {
		var dirName: string = path.dirname(fn);
		if (!fs.existsSync(dirName)) {
			var parent: string = path.dirname(dirName);
			if (!fs.existsSync(parent)) {
				this.createDirectories(parent);
			}
			fs.mkdirSync(dirName);
		}
	}

	watch(): void {
		fs.watch(this.folder, { recursive: true }, (event, file) => {
			this.postCompile();
		});
	}

	last: any;

	postCompile(): void {
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



function parseFolder(folder: string): void {

	var dirs: Array<string> = [];

	for (var file of fs.readdirSync(folder)) {
		var fullName: string = path.join(folder, file);
		var stat: fs.Stats = fs.statSync(fullName);
		if (stat.isDirectory()) {
			dirs.push(fullName);
		} else {
			if (/^waconfig\.json$/i.test(file)) {
				var config: IWAConfig = JSON.parse(fs.readFileSync(fullName, "utf8"));

				config.srcFolder = path.join(folder, config.srcFolder);
				config.outFile = path.join(folder, config.outFile);

				config.namespace = config.namespace || "";

				var cc: ComponentGenerator = new ComponentGenerator(config);
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