import * as less from "less";
import * as deasync from "deasync";
import { HtmlNode, HtmlContent } from "./html-content";
import { GeneratorContext } from "./generator-context";

export class TagInitializerList {
	component:string;
	tags: Array<TagInitializer> = [];

	constructor(name:string) {
		this.component = name;
	}

	toScript():string {
		return this.tags.map((tag,i) => {
			return `this.${this.component}_t${i} = function(e) {
					${tag.toScript()}
				};`;
		}).join("\r\n\t\t");
	}
}

export class TagInitializer {
	inits:Array<string>;

	constructor(inits:Array<string>) {
		this.inits = inits;
	}

	toScript():string {
		return this.inits.join("\r\n\t\t\t");
	}
}

export class HtmlComponent {

	baseType:string = null;
	name:string = null;
	nsNamespace:string = null;
	generated:string = null;
	generatedStyle: string = "";

	constructor(
		node:HtmlNode,
		nsNamespace:string,
		name?:string,
		less?:string) {

		this.nsNamespace = nsNamespace;
		if(less) {
			this.generatedStyle = less;
		}
		this.name = name;
		this.parseNode(node,name);
	}

	mapNode(a:HtmlNode,tags:TagInitializerList, children?:Array<any>): string[] {

		var original:HtmlNode = a;

		// debugger;

		if( /style/i.test(a.name)) {
			// debugger;
			this.generatedStyle += a.children.map(x => x.data).join("\r\n");
			this.generatedStyle += "\r\n";
			return;
		}

		if(/br/i.test(a.name)) {
			return;
		}

		if(a.name === "form-layout") {
			// console.log(`converting form layout with ${a.children.length} children`);
			a = HtmlContent.formLayoutNode(a);
			// console.log(`converting form layout to ${a.children.length} children`);

		}



		var r:any = [a.name];

		var ca:any = {};

		// debugger;
		// if(!a.children) {
		// 	return r;
		// }

		var aa:any = a.attribs || {};

		var inits:Array<string> = [];

		if(aa) {
			for(var key in aa) {
				if(!aa.hasOwnProperty(key)) {
				continue;
				}

				try {

					var ckey:string = HtmlContent.camelCase(key);

					var v:string = (aa[key] as string).trim();

					if(!v) {
						continue;
					}

					if(key === "data-atom-init") {
						inits.push(`WebAtoms.PageSetup.${v}(e);`);
						continue;
					}

					if(v.startsWith("{") && v.endsWith("}")) {
						// one time binding...
						if(/^viewmodel$/i.test(ckey)) {
							inits.push(`this.setLocalValue('${ckey}',${HtmlContent.processOneTimeBinding(v)},e, true);`);
						} else {
							inits.push(`this.setLocalValue('${ckey}',${HtmlContent.processOneTimeBinding(v)},e);`);
						}
						continue;
					}

					if(v.startsWith("[") && v.endsWith("]")) {
						// one way binding...
						inits.push(`this.bind(e,'${ckey}',${HtmlContent.processOneWayBinding(v)});`);
						continue;
					}
					if(v.startsWith("$[") && v.endsWith("]")) {
						// two way binding...
						inits.push(`this.bind(e,'${ckey}',${HtmlContent.processTwoWayBinding(v)});`);
						continue;
					}
					if(v.startsWith("^[") && v.endsWith("]")) {
						// two way binding...
						inits.push(`this.bind(e,'${ckey}',${HtmlContent.processTwoWayBinding(v)},null,"keyup,keydown,keypress,blur,click");`);
						continue;
					}

					if(/autofocus/i.test(key)) {
						inits.push(`window.WebAtoms.dispatcher.callLater(
							function() {
								e.focus();
							});`);
						continue;
					}

					if(/^atom\-/i.test(key) && key !== "atom-type" && key !== "atom-template" && key !== "atom-presenter") {
						inits.push(`this.setLocalValue('${ckey}',${ JSON.stringify(v) })`);
						continue;
					}

					ca[key] = aa[key];
				} catch(er) {
					// debugger;
					var en:number = a.startIndex || 0;
					var cn:number = 0;
					var ln:number = GeneratorContext.instance.fileLines.findIndex( x => en < x );
					var sln:number = GeneratorContext.instance.fileLines[ln-1];
					cn = en - sln;
					var errorText:string = `${er.message}`.split("\n").join(" ").split("\r").join("");
					console.log(`${GeneratorContext.instance.fileName}(${ln},${cn}): error TS0001: ${errorText}.`);
				}
			}

			if(children) {
				inits.push(`var oldInit = AtomUI.attr(e,'base-data-atom-init');
					if(oldInit){
						(window.WebAtoms.PageSetup[oldInit]).call(this,e);
					}
				`);
			}

			if(inits.length) {
				ca["data-atom-init"] = `${tags.component}_t${tags.tags.length}`;
				tags.tags.push(new TagInitializer(inits));
			}

			r.push(ca);
		}

		var text:string = a.children.filter(f=>f.type === "text" && f.data.trim() ).map(f=>f.data).join("");
		if(text) {
			ca["atom-text"] = text.trim();
		}

		var processedChildren: Array<string[]> = a.children
			.filter(f=> /tag|style/i.test(f.type))
			.map((n)=> this.mapNode(n,tags))
			.filter(n => n);

		if(children) {
			for(var child of processedChildren) {
				children.push(child);
			}
		} else {
			for(var cx of processedChildren) {
				r.push(cx);
			}
		}
		return r;
	}


	parseNode(node:HtmlNode, name?: string): string {
		if(node.type !== "tag") {
			return "";
		}
		var result:string = "";

		var type:string = "WebAtoms.AtomControl";

		var props:string = "";

		if(node.attribs) {

			name = node.attribs["atom-component"] || name;
			this.name = name;
			delete node.attribs["atom-component"];

			if(node.attribs["atom-type"]) {
				type = node.attribs["atom-type"];
				delete node.attribs["atom-type"];

				if(type.startsWith("Atom")) {
					type = "WebAtoms." + type;
				}
			}

			if(node.attribs["atom-properties"]) {
				props = node.attribs["atom-properties"];
				delete node.attribs["atom-properties"];
			}
		} else {
			if(!name) {
				return;
			}
		}

		this.baseType = type;

		var tags:TagInitializerList = new TagInitializerList(name);

		var rootChildren:any = [];
		var rootNode:any = this.mapNode(node,tags, rootChildren)[1] as any;

		var startScript:string = "";

		for(var key in rootNode) {
			if(!rootNode.hasOwnProperty(key)) { continue; }
			var value:any = rootNode[key];

			if(key === "data-atom-init") {
				startScript += `
					var oldInit = AtomUI.attr(e,'data-atom-init');
					if(oldInit){
						AtomUI.attr(e, 'base-data-atom-init',oldInit);
					};
					AtomUI.attr(e, 'data-atom-init','${value}');
				`;
			} else {
				var ck:string = key;
				if(/class/i.test(ck)) {
					ck = "atom-class";
				}
				startScript += ` if(!AtomUI.attr(e,'${ck}')) AtomUI.attr(e, '${ck}', '${value}' );\r\n\t\t`;
			}

		}

		result = JSON.stringify( rootChildren, undefined,2);

		name = `${this.nsNamespace + "." || ""}${name}`;

		var style:string = "";

		if(this.generatedStyle) {

			this.compileLess();

			style += `
				(function(d){
					var css = ${ JSON.stringify(this.generatedStyle) };
					var head = d.head || d.getElementsByTagName('head')[0];
					var style = d.createElement('style');
					style.type = 'text/css';
					style.id = "component_style_${ (this.nsNamespace ? this.nsNamespace +"_" : "") }${this.name}";
					if(style.styleSheet){
						style.styleSheet.cssText = css;
					}else{
						style.appendChild(d.createTextNode(css));
					}
					head.appendChild(style);
				})(document);
			`;
		}

		this.generated = style + `
			window.${name} = (function(window,baseType){

			window.Templates.jsonML["${name}.template"] =
				${result};

			(function(window,WebAtoms){
				${tags.toScript()}
			}).call(WebAtoms.PageSetup,window,WebAtoms);

			return classCreatorEx({
				name: "${name}",
				base: baseType,
				start: function(e){
					${startScript}
				},
				methods:{
					setLocalValue: window.__atomSetLocalValue(baseType)
				},
				properties:{
					${props}
				}
			})
		})(window, ${type}.prototype);\r\n`;

	}

	compileLess(): void {
		try {
		var finished:boolean = false;
		var lessSync:any = deasync((r) => {
			less.render(this.generatedStyle, (e,o) => {
				this.generatedStyle = o.css;
				finished = true;
				r();
			});
		});

		lessSync();
		} catch(er) {
			console.error(er);
		}

	}

}