// tslint:disable
import * as fs from "fs";
import * as path from "path";
import { CoreHtmlFile } from "./core/core-html-file";
import { HtmlFile } from "./http-file";
import { IMarkupComponent, IMarkupFile } from "./imarkup-file";
import { IWAConfig, Mode } from "./types";
import { XamlFile } from "./xaml/xaml-file";
import { ImageFile } from "./core/ImageFile";
import { HtmlContent } from "./html-content";

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

				if (/core/i.test(this.mode)) {
					if(/\.(jpg|png|gif|svg)$/.test(fullName)) {
						if (this.files.findIndex(x => x.file === fullName) !== -1) {
							continue;
						}
						this.files.push(new ImageFile(fullName));
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

	outFolder: string;

	folder: string;

	files: Array<IMarkupFile>;



	constructor(private config: IWAConfig) {
		this.folder = config.srcFolder;
		this.outFile = config.outFile;
		this.nsNamesapce = config.namespace;
		this.mode = config.mode;
		this.outFolder = config.outFolder;

		if (config.emitDeclaration !== undefined) {
			this.emitDeclaration = config.emitDeclaration;
		} else {
			if(!/core/i.test(this.mode)) {
				this.emitDeclaration = true;
			}
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


		var deletedFiles: Array<IMarkupFile> = [];

		var nodes: Array<IMarkupComponent> = [];

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

		if(/core/i.test(this.mode)) {

			let packageFolder = this.folder;

			while(true) {
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

	writeNames(f: IMarkupFile[], packageName: string ): string {
		const fileNames = f.map( (fx) => fx.file.toString().split(path.sep) );
		const root = {};
		for (const iterator of fileNames) {
			let start = root;
			let parent = root;
			let last: string = "";
			iterator[0] = "bin";
			for (const segment of iterator) {
				const name = this.toSafeName(segment);
				parent = start;
				last = segment;
				start = start[name] = (start[name] || {});
			}
			delete parent[last];
			const pp = path.parse(last);
			if (/\.(xml|xaml|html|htm)$/i.test(last)) {
				iterator[iterator.length-1] = pp.name;
			}
			last = pp.name;
			const fileName = parent[last] = packageName + "/" + iterator.join("/");
		}

		// merge all platforms...
		for (const key in root) {
			if (root.hasOwnProperty(key)) {
				const element = root[key];
				if (/^(web|xf|wpf)$/i.test(key)) {
					// merge values back in root...
					for (const pkey in element) {
						if (element.hasOwnProperty(pkey)) {
							const pvalue = element[pkey];
							root[pkey] = pvalue;
						}
					}
					delete root[key];
				}
			}
		}

		return JSON.stringify(root["bin"], undefined, 2);
	}

	toSafeName(name: string): string {
		return HtmlContent.camelCase(name) ;
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

	watcher: fs.FSWatcher;

	watch(): void {
		this.watcher = fs.watch(this.folder, { recursive: true }, (event, file) => {
			this.postCompile();
		});
	}

	last: any;

	postCompile(): void {
		if(this.watcher) {
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
				if(config.outFile) {
					config.outFile = path.join(folder, config.outFile);
				}
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