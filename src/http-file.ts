import {DomHandler,Parser} from "htmlparser2";
import * as fs from "fs";
import * as path from "path";
import { HtmlComponent } from "./html-component";
import { GeneratorContext } from "./generator-context";

export class HtmlFile {

	nsNamespace: string;

	file: string;
	lastTime: number;

	nodes:Array<HtmlComponent>;

	get currentTime(): number {
		return fs.statSync(this.file).mtime.getTime();
	}


	constructor(file:string,nsNamespace:string) {
		this.file = file;
		this.nsNamespace = nsNamespace;

		this.lastTime = 0;

	}

	compile(): void {


		GeneratorContext.instance.fileName = this.file.split("\\").join("/");


		var html:string  = fs.readFileSync(this.file,"utf8");

		var dirName:string = path.dirname(this.file);
		var p: path.ParsedPath = path.parse(this.file);

		var less: string = "";

		var lessName: string = `${dirName}${path.sep}${p.name}.less`;
		if(fs.existsSync(lessName)) {
			less = fs.readFileSync(lessName, "utf8");
			// console.log(`$$ Found Less file ${lessName}`);
		}


		var lastLength:number = 0;
		GeneratorContext.instance.fileLines = html.split("\n").map(x => {
			var n: number = lastLength;
			lastLength += x.length + 1;
			return n ;
		});


		this.compileNodes(html,less, this.pascalCase(p.name) );
		this.lastTime = this.currentTime;
	}

	pascalCase(s:string): string {
		if(!s) {
			return "";
		}
		var str:string = s.replace(/-([a-z])/ig,
			(all:string, letter:string): string =>  letter.toUpperCase());
		return str.slice(0, 1).toUpperCase() + str.slice(1);
	}

	compileNodes(html:string, less: string, name: string):void {
		this.nodes = [];
		var handler:DomHandler = new DomHandler( (error, dom) => {
			if (error) {
				console.error(error);
			}
		}, { withStartIndices: true });

		var parser:Parser = new Parser(handler);
		parser.write(html);
		parser.end();

		// debugger;

		for(var node of handler.dom) {
			var cn:HtmlComponent = new HtmlComponent(node,this.nsNamespace, name,  less);
			if(cn.generated) {
				this.nodes.push(cn);
				less = null;
			}
		}
	}

}
