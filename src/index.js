#!/usr/bin/node
const LangServer = require("vscode-languageserver");
const retext = require("retext");

const then = (...fs) => x => x.then(...fs);

const DEFAULT_SETTINGS = {
	plugins: [
		["profanities"],
		["spell", {}],
	],
};

const locationToPosition = ({line, column}) => ({line: line - 1, character: column - 1});

const setupRetext = settings => 
	(settings.plugins.length >= 1
		? settings.plugins
		: DEFAULT_SETTINGS.plugins
	).map(x => {
		console.log(x);
		return x;
	}).reduce(
		(retext_, [name, options]) => retext_.use(require("retext-" + name), options),
		retext()
	);

const connection = LangServer.createConnection(LangServer.ProposedFeatures.all);
const documents = new LangServer.TextDocuments();

let myretext = setupRetext(DEFAULT_SETTINGS);

myretext.process("hello world").then(console.log).catch(console.log)

const validate = change =>
	myretext.process(
		change.document.getText()
	)
	.then(vfile =>
		vfile.messages
			.map(msg => ({
				severity: LangServer.DiagnosticSeverity.Hint,
				range: {
					start: locationToPosition(msg.location.start),
					end: locationToPosition(msg.location.end),
				},
				message: msg.reason,
				code: msg.actual,
				source: msg.source,
			}))
	)
	.then(diagnostics => connection.sendDiagnostics({
		uri: change.document.uri,
		diagnostics,
	}))
	.catch(connection.console.log);

connection.onInitialize(_clientCapabilities => ({
	capabilities: {
		textDocumentSync: documents.syncKind,
	}
}));

connection.onDidChangeConfiguration(change => {
	myretext = setupRetext(
		change.settings.retextLanguageServer
		|| DEFAULT_SETTINGS
	);

	documents.all().forEach(document => validate({document}))
});

documents.onDidChangeContent(validate);

documents.listen(connection);
connection.listen();
