const {readFileSync} = require("fs");
const LangServer = require("vscode-languageserver");
const {
	Diagnostic,
	Position,
	//TextDocument,
} = require("vscode-languageserver-types");

// convertPosition :: VFilePosition -> Position
const convertPosition = ({line, column}) => Position.create(line - 1, column - 1);

const parsePluginOptions = obj => 
	typeof(obj) !== "undefined"
		? JSON.parse(JSON.stringify(obj), (k, v) => {
			if (typeof(v) == "string") {
				if (v.startsWith("require://")) {
					return require(v.slice("require://".length));
				} else if (v.startsWith("file://")) {
					return readFileSync(v.slice("file://".length));
				}
			}

			return v;
		})
		: obj;

class One {
	constructor(connection, documents, processor0) {
		this.connection = connection;
		this.documents = documents;
		this.processor0 = processor0;
		this.processor = processor0;

		this.connection.onInitialize(_capabilities => ({
			capabilities: {
				textDocumentSync: this.documents.syncKind,
			},
		}));

		this.documents.onDidChangeConcent(this.validate);
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
		this.documents.listen(connection);
		this.connection.listen();
	}

	createProcessor(settings) {
		let plugins = (settings.plugins.length >= 1
			? settings.plugins
			: []
		);

		return plugins.reduce(
			(it, [name, options]) => it.use(require(name), parsePluginOptions(options)),
			this.processor0()
		);
	}

	// {document: TextDocument}
	validate({document}) {
		this.processor.process(
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
						/* code */ code: msg.actual,
						/* source */ source: msg.source
					))
			)
			.then(diagnostics => this.connection.sendDiagnostics({
				uri: document.uri,
				diagnostics,
			}))
			.catch(this.connection.console.log);
	}
}

module.exports = One;
