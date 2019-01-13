const {readFileSync} = require("fs");
const LangServer = require("vscode-languageserver");
const {
	Diagnostic,
	Position,
	//TextDocument,
	TextDocumentSyncKind,
} = require("vscode-languageserver-protocol");

// convertPosition :: VFilePosition -> Position
const convertPosition = ({line, column}) => Position.create(line - 1, column - 1);

const parsePlugins = obj =>
	typeof(obj) !== "undefined"
		? JSON.parse(JSON.stringify(obj), (k, v) => {
			if (typeof(v) == "string") {
				if (v.startsWith("#")) {
					return require(v.slice("#".length));
				} else if (v.startsWith("//")) {
					return readFileSync(v.slice("//".length));
				} else {
					return v.trim();
				}
			}

			return v;
		})
		: obj;

class UnifiedLangServerBase {
	constructor(connection, documents, processor0) {
		this._connection = connection;
		this._documents = documents;
		this._processor0 = processor0;
		this._processor = processor0;

		connection.onInitialize(_capabilities => ({
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Full,
			}
		}));

		documents.onDidChangeContent(_ => this.validate(_));
	}

	setProcessor(x) {
		this._processor = x;

		return this;
	}

	configureWith(f) {
		//TODO check if client supports configuration?
		this._connection.onDidChangeConfiguration(change => {
			this.setProcessor(this.createProcessor(f(change)));

			this._documents.all().forEach(d => this.validate({document: d}))
		});

		return this;
	}

	// sets some callbacks and listening to the connection
	start() {
		this._documents.listen(this._connection);
		this._connection.listen();
	}

	createProcessor(settings) {
		return parsePlugins(settings.plugins).reduce(
			(it, [name, options]) => it.use(name, options),
			this._processor0()
		);
	}

	// {document: TextDocument}
	validate({document}) {
		return this._processor.process(
			document.getText()
		)
			.then(vfile =>
				vfile.messages
					.map(msg => Diagnostic.create(
						/*range*/ {
							start: convertPosition(msg.location.start),
							end: convertPosition(msg.location.end),
						},
						/* message */ msg.reason,
						/* severity */ LangServer.DiagnosticSeverity.Hint,
						/* code */ msg.actual,
						/* source */ msg.source
					))
					.sort(_ => _.range.start.line)
			)
			.then(diagnostics => {
				this._connection.sendDiagnostics({
					uri: document.uri,
					diagnostics,
				});

				return diagnostics;
			})
			.catch(this._connection.console.log);
	}
}

module.exports = UnifiedLangServerBase;
