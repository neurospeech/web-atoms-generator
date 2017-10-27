import { AtomEvaluator, CompiledMethod } from "./atom-evaluator";

export type HtmlNode = {
	startIndex?: number,
	type?: string,
	data?: string,
	tag?: string,
	name?: string,
	attribs?: any,
	children?: Array<HtmlNode>
};

export class HtmlContent {
	static processTwoWayBinding(v: string): string {
		v = v.substr(2,v.length-3);

		if(v.startsWith("$")) {
			v = v.substr(1);
		}

		var plist:string[] = v.split(".");

		v = ` ${JSON.stringify(plist)}, 1 `;

		return v;
	}

	static escapeLambda(v:string):string {

		v = v.trim();

		if(v.startsWith("()=>") || v.startsWith("() =>") || v.startsWith("=>")) {
			v = v.replace("()=>","");
			v = v.replace("() =>","");
			v = v.replace("=>","");
			return `function(){
				return ${v};
			}`;
		}

		return v;
	}

	static processOneWayBinding(v: string): string {
		v = v.substr(1,v.length-2);

		v = HtmlContent.escapeLambda(v);

		var vx:CompiledMethod = AtomEvaluator.instance.parse(v);

		v = "";

		var plist:string = vx.path.map((p,i)=> `v${i+1}` ).join(",");

		v += ` ${JSON.stringify(vx.path)}, 0, function(${plist}) { return ${vx.original}; }`;

		return v;
	}

	static processOneTimeBinding(v: string): string {
		v = v.substr(1,v.length-2);

		v = HtmlContent.escapeLambda(v);

		var vx:CompiledMethod = AtomEvaluator.instance.parse(v);

		v = vx.original;

		for(var i:number=0; i<vx.path.length;i++) {
			var p:string[] = vx.path[i];
			var start:string = "this";
			v = v.replace(`v${i+1}`, `Atom.get(this,"${p.join(".")}")`  );
		}

		return v;
	}

	static camelCase(text:string): string {
		if(text.startsWith("atom-")) {
			text = text.substr(5);
		}

		return text.split("-").map((v,i)=> {
			if(i) {
				v = v.charAt(0).toUpperCase() + v.substr(1);
			}
			return v;
		}).join("");
	}

	static formLayoutNode(a:HtmlNode): HtmlNode {


		var cl1: HtmlNode[] = a.children.filter(c=>c.type === "tag").map( c => {

			var fieldAttributes = {
				"class":"atom-field"
			};


			var aa = c.attribs || {};

			var label = aa["atom-label"] || "";
			if(label) {
				delete aa["atom-label"];
			}

			var isRequired = aa["atom-required"];

			if(isRequired) {
				delete aa["atom-required"];
			} else {
				isRequired = "";
			}



			if(isRequired.endsWith("}") || isRequired.endsWith("]")) {
				var last = isRequired.substr(isRequired.length-1);
				isRequired = isRequired.substr(0,isRequired.length-1) + " ? '*' : 'false'" + last;
			}

			if(/true/i.test(isRequired)) {
				isRequired = "*";
			}

			var error:string = aa["atom-error"] || "";
			if(error) {
				delete aa["atom-error"];
			}

			var fieldVisible:string = aa["atom-field-visible"] ||
				aa["field-visible"] ||
				aa["atom-field-visibility"] ||
				aa["field-visibility"];
			if(fieldVisible) {
				delete aa["atom-field-visible"];
				delete aa["field-visible"];
				delete aa["atom-field-visibility"];
				delete aa["field-visibility"];

				fieldVisible = fieldVisible.trim();

				if(fieldVisible.startsWith("{")) {
					fieldVisible = fieldVisible.substr(1,fieldVisible.length-2);
					fieldVisible = `{ ${fieldVisible} ? '' : 'none' }`;
				}

				if(fieldVisible.startsWith("[")) {
					fieldVisible = fieldVisible.substr(1,fieldVisible.length-2);
					fieldVisible = `[ ${fieldVisible} ? '' : 'none' ]`;
				}

				fieldAttributes["style-display"] = fieldVisible;
			}

			var errorAttribs = {
				"class":"atom-error",
				"atom-text": error
			};

			var errorStyle = "";
			if(error) {
				if(error.endsWith("}") || error.endsWith("]")) {
					var last:any = error.substr(error.length-1);
					errorStyle = error.substr(0,error.length-1) + " ? '' : 'none'" + last;
					errorAttribs["style-display"] = errorStyle;
				}
			}



			var cl = [
				{ 
					name: "label",
					type:"tag",
					attribs:{
						"atom-text": label,
						"class":"atom-label"
					},
					children:[]
				},
				{
					name:"span",
					type:"tag",
					attribs:{
						"class":"atom-required",
						"atom-text": isRequired
					},
					children:[]
				},
				c,
				{
					name: "div",
					type:"tag",
					attribs:errorAttribs,
					children:[]
				}
			];



			return {
				name:"div",
				type:"tag",
				attribs:fieldAttributes,
				children:cl
			};

		});

		var formAttribs:any = a.attribs || {};
		// tslint:disable-next-line:no-string-literal
		var fc:string = formAttribs["class"];
		if(fc) {
			// tslint:disable-next-line:no-string-literal
			formAttribs["class"] = "atom-form " + fc;
		} else {
			// tslint:disable-next-line:no-string-literal
			formAttribs["class"] = "atom-form";
		}

		return { 
			name:"div",
			type:"tag",
			attribs:formAttribs,
			children: cl1
		} ;
	}


}