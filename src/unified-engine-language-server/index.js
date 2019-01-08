const {readFileSync} = require("fs");
const LangServer = require("vscode-languageserver");
const {
	Diagnostic,
	Position,
	//TextDocument,
} = require("vscode-languageserver-types");

// convertPosition :: VFilePosition -> Position
const convertPosition = ({line, column}) => Position.create(line - 1, column - 1);

const parsePluginOptions = obj => {

	return typeof(obj) !== "undefined"
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
}

class UnifiedEngineLangServerBase {
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
			this.connection.console.log("CONFIG CHANGED");
			this.connection.console.log(JSON.stringify(f(change)));
			this.setProcessor(this.createProcessor(f(change)));

			this.connection.console.log("NUMBER OF FILES:" + this.documents.all().length);

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
		this.connection.console.log("             ")
		this.connection.console.log("             ")
		this.connection.console.log("             ")
		this.connection.console.log("VALIDATING!!!")
		this.connection.console.log("             ")
		this.connection.console.log("             ")
		this.connection.console.log("             ")
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

module.exports = UnifiedEngineLangServerBase;
