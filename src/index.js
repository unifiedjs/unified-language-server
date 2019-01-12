const {readFileSync} = require("fs");
const LangServer = require("vscode-languageserver");
const {
	Diagnostic,
	Position,
	//TextDocument,
} = require("vscode-languageserver-types");

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
		this.connection = connection;
		this.documents = documents;
		this.processor0 = processor0;
		this.processor = processor0;

		connection.onInitialize(_capabilities => {
			return {
				capabilities: {
					textDocumentSync: this.documents.syncKind,
				}
			};

		});

		documents.onDidChangeContent(this.validate.bind(this));
	}

	setProcessor(x) {
		this.processor = x;

		return this;
	}

	configureWith(f) {
		//TODO check if client supports configuration?
		this.connection.onDidChangeConfiguration(change => {
			this.setProcessor(this.createProcessor(f(change)));

			this.documents.all().forEach(d => this.validate({document: d}))
		});

		return this;
	}

	// sets some callbacks and listening to the connection
	start() {
		this.documents.listen(this.connection);
		this.connection.listen();
	}

	createProcessor(settings) {
		return parsePlugins(settings.plugins).reduce(
			(it, [name, options]) => it.use(name, options),
			this.processor0
		);
	}

	// {document: TextDocument}
	validate({document}) {
		return this.processor.process(
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
			)
			.then(diagnostics => {
				this.connection.sendDiagnostics({
					uri: document.uri,
					diagnostics,
				});

				return diagnostics;
			})
			.catch(this.connection.console.log);
	}
}

module.exports = UnifiedLangServerBase;
