#!/usr/bin/node
const Base = require("./index");
const LangServer = require("vscode-languageserver");
const unified = require("unified");

const ALL_SETTINGS = {
	"remark-english": {
		use: [
			["#retext-profanities"],
			["#retext-simple"],
		],
	},
	"remark-parse": {
		use: [
			["#remark-retext", "#parse-latin"],
		],
		retextWith: {
			setting: "remark-english",
			use: ["#remark-retext", "#parse-latin"],
		}
	},
};

function stringify() {
	this.Compiler = () => "";
}

const [parser, settings] = process.argv.slice(2)
	.find(_ => _.startsWith("--parser="))
	|> (_ => {
		if (!_) {
			throw new Error("Supply '--parser=X' where X is the name of parser you want to use; such as \"retext-latin\" or \"remarked\"");
		}

		return _;
	})
	|> (_ => _.slice("--parser=".length))
	|> (name => {
		let it = require(name);
		if (!it.Parser) {
			throw new Error(
				`The parser you have supplied (${name}) is not a valid unifiedJS parser.\n`
				+ "The module needs to have a \"Parser\" method as described here: "
				+ "https://github.com/unifiedjs/unified#processorparser"
			);
		}

		return [ it, ALL_SETTINGS[name] ];
	});


//const connection = LangServer.createConnection(LangServer.ProposedFeatures.all);
//const documents = new LangServer.TextDocuments();
//
//let server = new Base(connection, documents, unified);
//server.setProcessor(server.createProcessor(settings));
//server.configureWith(change => settings);
//server.start();
//
//server.validate({
//	document: {
//		getText: () => "hello world, you are looking a little shit today."
//	}
//})
//	.then(x => {
//		console.log("success")
//		console.log(x)
//	})
//	.catch(err => {
//		console.log("ERR")
//		console.log(err)
//	})

const TXT = [
	"Title",
	"======",
	"This is *italic* and this is _bold_",
	"hello you *little* *fucking* shit",
	"how are you today?"
].join("\n");

const print = prefix => x => console.log(prefix, x);

unified()
	.use(parser)
	.use(require("remark-retext"), require("parse-latin"))
	.use(require("retext-profanities"))
	.use(stringify)
	.process(TXT)
	.then(print("success"), print("fail"));
