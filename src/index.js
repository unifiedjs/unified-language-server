const LangServer = require("vscode-languageserver");
const retext = require("retext");

const One = require("./unified-engine-language-server");

const DEFAULT_SETTINGS = {
	plugins: [
		["retext-profanities"],
		["retext-spell", "require://dictionary-en-gb"],
	],
};

const connection = LangServer.createConnection(LangServer.ProposedFeatures.all);
const documents = new LangServer.TextDocuments();

let one = new One(
	connection,
	documents,
	retext
);
one.setProcessor(one.createProcessor(DEFAULT_SETTINGS));
one.configureWith(change => 
	change.settings["retext-language-server"] || DEFAULT_SETTINGS
);
one.start();
