import * as antlr4 from 'antlr4';
window.antlr4 = antlr4;

import { tptp_v7_0_0_0Lexer as Lexer } from '../../TPTP-ANTLR4-Grammar/tptp_v7_0_0_0Lexer';
import { tptp_v7_0_0_0Parser as Parser } from '../../TPTP-ANTLR4-Grammar/tptp_v7_0_0_0Parser';
import { tptp_v7_0_0_0Listener as Listener } from '../../TPTP-ANTLR4-Grammar/tptp_v7_0_0_0Listener';

function stripParens(formula){
	return formula.replace(/\s+/g,'').replace(/[()]/g, '');
}

function getNodeShape(node) {
	let shapeMap = {
		axiom: "invtriangle",
		conjecture: "house",
		negated_conjecture: "invhouse",
		plain: "ellipse"
	}
	if (stripParens(node.formula) == "$false") {
		return "box";
	}
	return shapeMap[node.role];
}

function getNodeColor(node) {
	let colorMap = {
		thf: "blue",
		tff: "orange",
		tcf: "black",
		fof: "green",
		cnf: "red"
	}
	return colorMap[node.type];
}

function scaleFromInterestingness(interestingness) {
	interestingness = +interestingness;
	let defaultSize = 1;
	if ([-1, undefined].includes(interestingness)) {
		return defaultSize;
	}
	else {
		return 0.5 * (1 + interestingness) + 0.5;
	}
}

window.scaleFromInterestingness = scaleFromInterestingness;




// helper function for extracting recursive parent information:
function getParentsFromSource(source, node){

	let dag = source.dag_source();
	let sources = source.sources();
	if (sources !== null){
		for(let s of sources){
			getParentsFromSource(s, node);
		}
	}
	else if (dag === null){
		return
	}

	if (dag.inference_record()) {
		let inference_record = dag.inference_record();
		node.inference_record = inference_record.getText();
		let parent_list = inference_record.inference_parents().parent_list().parent_info();

		for (let i = 0; i < parent_list.length; i++) {
			let p = parent_list[i];
			let ps = p.source();

			if (ps.dag_source()){
				if (ps.dag_source().name()){
					node.parents.push(ps.getText());
				}
				else{
					try{
						let sources = [];
						let parents = ps.dag_source().inference_record().inference_parents().parent_list().parent_info();
						sources = parents.map(x => x.source());
						
						for(let s of sources){
							getParentsFromSource(s, node);
						}
					}catch{
						console.log(`failed to parse dag source: ${ps.dag_source().getText()}`);
					}
				}
			}
			else if(ps.sources()){
				let sources = ps.sources().source();
				for(let s of sources){
					getParentsFromSource(s, node);
				}
			}
			else{
				console.log(`${node.name} has source ${source}`);
			}
		}

	} else if (dag.name()) {
		node.parents.push(dag.name().getText());
	}
}


// this class exists to format the relevant parts of the parse tree for ease of use.
// It makes it JSON. To see the schema, look at the "process" method.
class Formatter extends Listener {

	constructor() {
		super();
		this.node_map = {};
	}

	enterThf_annotated(ctx) {
		this.process(ctx, "thf");
	}

	enterTff_annotated(ctx) {
		this.process(ctx, "tff");
	}

	enterTcf_annotated(ctx) {
		this.process(ctx, "tcf");
	}

	enterFof_annotated(ctx) {
		this.process(ctx, "fof");
	}

	enterCnf_annotated(ctx) {
		this.process(ctx, "cnf");
		window.ctx = ctx;
	}

	process(ctx, type) {
		let role = ctx.formula_role().getText();
		
		if(!["conjecture", "negated_conjecture", "axiom", "plain"].includes(role)){
			console.log(`"${role}" role not shown for "${ctx.name().getText()}"`);
			return;
		}

		let node = {
			name: ctx.name().getText(),
			type: type,
			role: role,
			formula: ctx[`${type}_formula`]().getText(),
			parents: [],
			inference_record: "",
			info: {},
			tptp: ctx.parentCtx.parentCtx.getText()
		};

		// try to get node info...(contains interestingness)
		try {
			let info = ctx.annotations().optional_info().useful_info().info_items().getText().split(",");
			let infoObj = {};
			for (let s of info) {
				let [key, value] = s.split("(");
				value = value.substring(0, value.length - 1);
				infoObj[key] = value;
			}
			node.info = infoObj;
		} catch (e) {
			// console.log(`"${node.name}" has no info (or we failed getting it)`)
		}

		// try to get source...(contains parents)
		try {
			let source = ctx.annotations().source();
			getParentsFromSource(source, node);
		}
		catch (e) {
			console.log(`"${node.name}" has no sources (or we failed getting them).`)
		}

		this.node_map[node.name] = node;
	}

}


// must be a higher order function so it can take in s as input...
function nodeToGV(s) {
	return function (node) {
		if(node.children.length == 0 && node.parents.length == 0){
			return
		}

		s.push(`${node.name} [
			fixedsize=true,
			label="${node.graphviz.invis ? "" : node.name}",
			${node.graphviz.invis ? "style=invis," : ""}
			shape=${node.graphviz.invis ? "point" : node.graphviz.shape},
			color="${node.graphviz.color}",
			fillcolor="${node.graphviz.fillcolor}",
			width="${node.graphviz.width}",
			height="${node.graphviz.height}",
			penwidth="3.0"
		]`);
		let arrowOrNot = node.graphviz.invis ? " [dir=none] " : "";
		node.parents.forEach(function (p) { s.push(p + " -> " + node.name + arrowOrNot); });
	}
}



// nodes is a JSON object where the keys are node names.
// and the values are the JSON objects of the nodes.
let proofToGV = function (nodes) {

	// A higher order function which returns a function from
	// a node to whether or not that node should be in the top row of that type.
	function isTopRow(type) {
		return function (node) {
			return node.parents.every(function (parentName) {
				let parent = nodes[parentName];
				if (parent === undefined) {
					return false;
				}

				let parentType = nodes[parentName].type;
				return (parentType != type || top_row.includes(parent));
			});
		}
	}

	let list = Object.values(nodes);

	// will become string segments of the "dot" file graphviz file.
	let s = [];

	let top_row = list.filter(e => e.parents.length == 0);
	let others = list.filter(e => e.parents.length != 0);

	let ns = {}; // namespace for simplifying redundant ops on thf/tff/tcf/fof/cnf...
	let langs = ["thf", "tff", "tcf", "fof", "cnf"];

	for(let lang of langs){
		ns[lang] = others.filter(e => e.type == lang);
		ns[`top_${lang}`] = ns[lang].filter(isTopRow(lang));
	}

	s.push("digraph G {");
	s.push("node [style=filled];");
	s.push("newrank=\"true\"");


	//begin Top Row...
	s.push("subgraph clusterAxioms {");
	s.push("pencolor=transparent");
	top_row.forEach(nodeToGV(s));
	s.push("{rank=same; " + top_row.map((e) => e.name).join(' ') + "}");
	s.push("}");
	//end Top Row

	for(let lang of langs){
		s.push(`subgraph cluster${lang}s {`);
		s.push(`pencolor=transparent`);
		ns[lang].forEach(nodeToGV(s));
		s.push(`{rank=same; ` + ns[`top_${lang}`].map((e) => e.name).join(' ') + `}`);
		s.push(`}`);
	}

	s.push("}");
	return s.join('\n');
}


let parseProof = function (proofText) {
	let chars = new antlr4.InputStream(proofText);
	let lexer = new Lexer(chars);
	let tokens = new antlr4.CommonTokenStream(lexer);
	let parser = new Parser(tokens);
	// parser.removeErrorListeners();
	parser.buildParseTrees = true;

	let formatter = new Formatter();

	let tree;
	console.log("Beginning parsing...");
	while ((tree = parser.tptp_input())) {
		if (tree.getText() == "<EOF>") break;
		antlr4.tree.ParseTreeWalker.DEFAULT.walk(formatter, tree);
	}
	console.log("Finished parsing!")

	let nm = formatter.node_map;

	// post-processing of node-map. 
	for (let name of Object.keys(nm)) {
		let node = nm[name];

		node.graphviz = {
			shape: getNodeShape(node),
			color: getNodeColor(node),
			fillcolor: "grey",
		};

		if (node.info['interesting'] !== undefined) {
			node.graphviz.width = scaleFromInterestingness(node.info.interesting);
			node.graphviz.height = scaleFromInterestingness(node.info.interesting);
		}

		if (node.children === undefined) {
			node.children = [];
		}

		let parentsCopy = Array.from(node['parents']);
		for (let parentName of parentsCopy) {
			if (parentName in nm) {
				if (nm[parentName]["children"] === undefined) {
					nm[parentName]["children"] = [name]
				}
				else {
					nm[parentName]["children"].push(name);
				}
			}
			else {
				console.log(`Error: ${parentName} was a parentNode of ${node["name"]}, but is not in the map!`);
				// remove the parent.
				while(node['parents'].includes(parentName)){
					console.log(`Removing ${parentName} from ${node.name}'s parents`);
					let location = node['parents'].indexOf(parentName);
					node['parents'].splice(location, 1);
				}
			}
		}
	}

	return nm;
}


export { parseProof, proofToGV };