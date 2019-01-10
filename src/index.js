#!/usr/bin/node

const LangServer = require("vscode-languageserver");
const retext = require("retext");

const Base = require("./unified-engine-language-server");

const DEFAULT_SETTINGS = {
	plugins: [
		["retext-profanities"],
		["retext-spell", "require://dictionary-en-gb"],
	],
};

const connection = LangServer.createConnection(LangServer.ProposedFeatures.all);
const documents = new LangServer.TextDocuments();

let server = new Base(connection, documents, retext);
server.setProcessor(server.createProcessor(DEFAULT_SETTINGS));
server.configureWith(change => 
	change.settings["retext-language-server"] || DEFAULT_SETTINGS
);
server.start();
