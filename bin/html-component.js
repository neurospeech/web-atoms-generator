"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const less = require("less");
const deasync = require("deasync");
const html_content_1 = require("./html-content");
const generator_context_1 = require("./generator-context");
class TagInitializerList {
    constructor(name) {
        this.tags = [];
        this.component = name;
    }
    toScript() {
        return this.tags.map((tag, i) => {
            return `this.${this.component}_t${i} = function(e) {
					${tag.toScript()}
				};`;
        }).join("\r\n\t\t");
    }
}
exports.TagInitializerList = TagInitializerList;
class TagInitializer {
    constructor(inits) {
        this.inits = inits;
    }
    toScript() {
        return this.inits.join("\r\n\t\t\t");
    }
}
exports.TagInitializer = TagInitializer;
class HtmlComponent {
    constructor(node, nsNamespace, name, less) {
        this.baseType = null;
        this.name = null;
        this.nsNamespace = null;
        this.generated = null;
        this.generatedStyle = "";
        this.nsNamespace = nsNamespace;
        if (less) {
            this.generatedStyle = less;
        }
        this.name = name;
        this.parseNode(node, name);
    }
    mapNode(a, tags, children) {
        var original = a;
        // debugger;
        if (/style/i.test(a.name)) {
            // debugger;
            this.generatedStyle += a.children.map(x => x.data).join("\r\n");
            this.generatedStyle += "\r\n";
            return;
        }
        if (a.name === "form-layout") {
            // console.log(`converting form layout with ${a.children.length} children`);
            a = html_content_1.HtmlContent.formLayoutNode(a);
            // console.log(`converting form layout to ${a.children.length} children`);
        }
        var r = [a.name];
        var ca = {};
        // debugger;
        if (!a.children) {
            return r;
        }
        var aa = a.attribs || {};
        var inits = [];
        if (aa) {
            for (var key in aa) {
                if (!aa.hasOwnProperty(key)) {
                    continue;
                }
                try {
                    var ckey = html_content_1.HtmlContent.camelCase(key);
                    var v = aa[key].trim();
                    if (!v) {
                        continue;
                    }
                    if (key === "data-atom-init") {
                        inits.push(`WebAtoms.PageSetup.${v}(e);`);
                        continue;
                    }
                    if (v.startsWith("{") && v.endsWith("}")) {
                        // one time binding...
                        if (/^viewmodel$/i.test(ckey)) {
                            inits.push(`this.setLocalValue('${ckey}',${html_content_1.HtmlContent.processOneTimeBinding(v)},e, true);`);
                        }
                        else {
                            inits.push(`this.setLocalValue('${ckey}',${html_content_1.HtmlContent.processOneTimeBinding(v)},e);`);
                        }
                        continue;
                    }
                    if (v.startsWith("[") && v.endsWith("]")) {
                        // one way binding...
                        inits.push(`this.bind(e,'${ckey}',${html_content_1.HtmlContent.processOneWayBinding(v)});`);
                        continue;
                    }
                    if (v.startsWith("$[") && v.endsWith("]")) {
                        // two way binding...
                        inits.push(`this.bind(e,'${ckey}',${html_content_1.HtmlContent.processTwoWayBinding(v)});`);
                        continue;
                    }
                    if (v.startsWith("^[") && v.endsWith("]")) {
                        // two way binding...
                        inits.push(`this.bind(e,'${ckey}',${html_content_1.HtmlContent.processTwoWayBinding(v)},null,"keyup,keydown,keypress,blur,click");`);
                        continue;
                    }
                    if (/autofocus/i.test(key)) {
                        inits.push(`window.WebAtoms.dispatcher.callLater(
							function() {
								e.focus();
							});`);
                        continue;
                    }
                    ca[key] = aa[key];
                }
                catch (er) {
                    // debugger;
                    var en = a.startIndex || 0;
                    var cn = 0;
                    var ln = generator_context_1.GeneratorContext.instance.fileLines.findIndex(x => en < x);
                    var sln = generator_context_1.GeneratorContext.instance.fileLines[ln - 1];
                    cn = en - sln;
                    var errorText = `${er.message}`.split("\n").join(" ").split("\r").join("");
                    console.log(`${generator_context_1.GeneratorContext.instance.fileName}(${ln},${cn}): error TS0001: ${errorText}.`);
                }
            }
            if (children) {
                inits.push(`var oldInit = AtomUI.attr(e,'base-data-atom-init');
					if(oldInit){
						(window.WebAtoms.PageSetup[oldInit]).call(this,e);
					}
				`);
            }
            if (inits.length) {
                ca["data-atom-init"] = `${tags.component}_t${tags.tags.length}`;
                tags.tags.push(new TagInitializer(inits));
            }
            r.push(ca);
        }
        var text = a.children.filter(f => f.type === "text" && f.data.trim()).map(f => f.data).join("");
        if (text) {
            ca["atom-text"] = text.trim();
        }
        var processedChildren = a.children
            .filter(f => /tag|style/i.test(f.type))
            .map((n) => this.mapNode(n, tags))
            .filter(n => n);
        if (children) {
            for (var child of processedChildren) {
                children.push(child);
            }
        }
        else {
            for (var cx of processedChildren) {
                r.push(cx);
            }
        }
        return r;
    }
    parseNode(node, name) {
        if (node.type !== "tag") {
            return "";
        }
        var result = "";
        var type = "WebAtoms.AtomControl";
        var props = "";
        if (node.attribs) {
            name = node.attribs["atom-component"] || name;
            this.name = name;
            delete node.attribs["atom-component"];
            if (node.attribs["atom-type"]) {
                type = node.attribs["atom-type"];
                delete node.attribs["atom-type"];
                if (type.startsWith("Atom")) {
                    type = "WebAtoms." + type;
                }
            }
            if (node.attribs["atom-properties"]) {
                props = node.attribs["atom-properties"];
                delete node.attribs["atom-properties"];
            }
        }
        else {
            if (!name) {
                return;
            }
        }
        this.baseType = type;
        var tags = new TagInitializerList(name);
        var rootChildren = [];
        var rootNode = this.mapNode(node, tags, rootChildren)[1];
        var startScript = "";
        for (var key in rootNode) {
            if (!rootNode.hasOwnProperty(key)) {
                continue;
            }
            var value = rootNode[key];
            if (key === "data-atom-init") {
                startScript += `
					var oldInit = AtomUI.attr(e,'data-atom-init');
					if(oldInit){
						AtomUI.attr(e, 'base-data-atom-init',oldInit);
					};
					AtomUI.attr(e, 'data-atom-init','${value}');
				`;
            }
            else {
                var ck = key;
                if (/class/i.test(ck)) {
                    ck = "atom-class";
                }
                startScript += ` if(!AtomUI.attr(e,'${ck}')) AtomUI.attr(e, '${ck}', '${value}' );\r\n\t\t`;
            }
        }
        result = JSON.stringify(rootChildren, undefined, 2);
        name = `${this.nsNamespace + "." || ""}${name}`;
        var style = "";
        if (this.generatedStyle) {
            this.compileLess();
            style += `
				(function(d){
					var css = ${JSON.stringify(this.generatedStyle)};
					var head = d.head || d.getElementsByTagName('head')[0];
					var style = d.createElement('style');
					style.type = 'text/css';
					style.id = "component_style_${(this.nsNamespace ? this.nsNamespace + "_" : "")}${this.name}";
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
    compileLess() {
        try {
            var finished = false;
            var lessSync = deasync((r) => {
                less.render(this.generatedStyle, (e, o) => {
                    this.generatedStyle = o.css;
                    finished = true;
                    r();
                });
            });
            lessSync();
        }
        catch (er) {
            console.error(er);
        }
    }
}
exports.HtmlComponent = HtmlComponent;
//# sourceMappingURL=html-component.js.map