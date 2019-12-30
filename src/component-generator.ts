// tslint:disable
import * as fs from "fs";
import * as path from "path";
import { Binding } from "./core/Binding";
// import { HtmlFile } from "./http-file";
import { IMarkupComponent, IMarkupFile } from "./imarkup-file";
import { IWAConfig, Mode } from "./types";
import { XamlFile } from "./xaml/xaml-file";
import { ImageFile } from "./core/ImageFile";
import { CoreHtmlFile } from "./core/CoreHtmlFile";
import FileApi from "./FileApi";
import { HtmlContent } from "./core/HtmlContent";


export class ComponentGenerator {

	mode: Mode = Mode.None;

	private loadFiles(folder: string): void {

		// scan all html files...
		for (var file of fs.readdirSync(folder)) {
			var fullName: string = path.join(folder, file);
			var s: fs.Stats = fs.statSync(fullName);
			if (s.isDirectory()) {
				this.loadFiles(fullName);
			} else {

				if (/core/i.test(this.mode)) {
					if(/\.(jpg|png|gif|svg|json)$/.test(fullName)) {
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
						// this.files.push(new HtmlFile(fullName, this.nsNamesapce));
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
		this.mode = config.mode;
		this.outFolder = config.outFolder;

		this.files = [];


		// this.watch();
		this.compile();
		console.log(`${(new Date()).toLocaleTimeString()} - Compilation complete. Watching for file changes.`);
		console.log("    ");

	}

	public compile(): void {

		this.loadFiles(this.folder);

		var deletedFiles: Array<IMarkupFile> = [];

		var nodes: Array<IMarkupComponent> = [];

		let packageContent: any = null;

		let packageFolder = this.folder;

		while(true) {
			if (fs.existsSync(path.join(packageFolder, "package.json"))) {
				break;
			}
			packageFolder = path.dirname(packageFolder);
			continue;
		}

		packageContent = JSON.parse(fs.readFileSync(path.join(packageFolder, "package.json"), {
			encoding: "utf8",
			flag: "r"
		}));

		for (var file of this.files) {
			if (file.currentTime !== file.lastTime) {

				if (!fs.existsSync(file.file)) {
					deletedFiles.push(file);
					continue;
				}

				// console.log(`Generating ${file.file}`);
				file.compile(packageContent);
			}
			for (var n of file.nodes) {
				nodes.push(n);
			}
		}

		// write ModuleFiles
		const content = `// tslint:disable
		declare var UMD: any;
		UMD = UMD || { resolvePath: (v) => v };
		export const ModuleFiles =
			${this.writeNames(this.files, packageContent.name)}
`;

		// FileApi.writeSync(this.folder + "/ModuleFiles.ts", content);

		// console.log(`Modules written to ${this.folder}/ModuleFiles.ts`);

		return;
	}

	private replacePlatformName(name: string[]): string[] {
		const last = name[name.length-1];
		if( !/\.(xml|xaml|html|htm)$/i.test(last)) {
			return name;
		}
		name[0] = "dist";
		const platformFolder = name[1];
		if (/^(web|xf|wpf)$/i.test(platformFolder)) {
			name[1] = "{platform}";
		}
		const pp = path.parse(last);
		name[name.length-1] = pp.name;
		return name;
	}

	private writeNames(f: IMarkupFile[], packageName: string ): string {
		const fileNames = f.map( (fx) => this.replacePlatformName(fx.file.toString().split(path.sep)) );
		const root = {};
		for (const iterator of fileNames) {
			let start = root;
			let parent = root;
			let last: string = "";
			for (const segment of iterator) {
				const name = this.toSafeName(segment);
				parent = start;
				last = name;

				if (name === "{platform}") {
					start = parent;
				} else {
					start = start[name] = (start[name] || {});
				}
			}
			delete parent[last];
			const fileName = parent[last] = packageName + "/" + iterator.join("/");

			if (/(\.(jpg|gif|jpeg|svg|png))$/.test(fileName)) {
				parent[last] = "~(" + fileName + ")~";
			}
		}

		// move "dist" to root...
		const bin = root["dist"];
		if (bin) {
			delete root["dist"];
			this.merge(bin, root);
		}


		const content = JSON.stringify(root, undefined, 2);
		return content.replace(/\"\~\(/g, "UMD.resolvePath(\"").replace(/\)\~\"/g, "\")");
	}

	private merge(src: any, dest: any): void {
		for (const key in src) {
			if (src.hasOwnProperty(key)) {
				const element = src[key];
				if (typeof element === "object") {
					const dchild = dest[key] || (dest[key] = {});
					this.merge(element,dchild);
				} else {
					dest[key] = element;
				}
			}
		}

	}

	private toSafeName(name: string): string {
		return HtmlContent.camelCase(name.replace(".","_")) ;
	}

	// private createDirectories(fn: string): void {
	// 	var dirName: string = path.dirname(fn);
	// 	if (!fs.existsSync(dirName)) {
	// 		var parent: string = path.dirname(dirName);
	// 		if (!fs.existsSync(parent)) {
	// 			this.createDirectories(parent);
	// 		}
	// 		fs.mkdirSync(dirName);
	// 	}
	// }

	watcher: fs.FSWatcher;

	private watch(): void {
		this.watcher = fs.watch(this.folder, { recursive: true }, (event, file) => {
			this.postCompile();
		});
	}

	last: any;

	private postCompile(): void {
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