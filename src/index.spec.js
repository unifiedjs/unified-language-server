const Base = require("./index");
const Test = require("tape");
const unified = require("unified");
const {
	TextDocumentSyncKind,
	DiagnosticSeverity,
} = require("vscode-languageserver-protocol");
const {spy} = require("sinon");

const parser = require("retext-english");
function compiler() {
	this.Compiler = () => "compiler's output";
}

const processor = unified()
	.use(parser)
	.use(compiler)
	.freeze();

const createMockConnection = () => ({
	console: {
		log: spy()
	},
	listen: spy(),
	onInitialize: spy(),
	onDidChangeConfiguration: spy(),
	sendDiagnostics: spy(),
});
const createMockDocuments = (docs) => ({
	all: () => docs || [],
	listen: spy(),
	onDidChangeContent: spy(),
});
const createMockDocument = (txt, props) =>
	Object.assign(
		props || {},
		{
			getText: () => txt,
		}
	);

const waitUntilCalled = (spy, timeout) => new Promise((resolve, reject) => {
	timeout = timeout || 1000;
	let timePassed = 0;

	let timer = setInterval(() => {
		timePassed += 200;
		if (timePassed > timeout) {
			clearInterval(timer);
			reject("waited for the spy to be called but it wasn't");
		} else if (spy.called) {
			clearInterval(timer);
			resolve();
		}
	}, 200);
});

Test("the constructor", t => {
	t.plan(3);

	let connection = createMockConnection();
	let documents = createMockDocuments();

	let base = new Base(connection, documents, processor);

	t.ok(connection.listen.notCalled, "listen() shouldn't be done implicitly");
	t.ok(documents.listen.notCalled, "listen() shouldn't be done implicitly");

	t.deepEqual(
		connection.onInitialize.firstCall.args[0] (/*client capabilities*/),
		{
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Full,
			},
		},
		"server must report correct capabilities"
	);
});

Test.skip("setProcess()", async t => {
	t.plan(2);
	/* TODO
	 * the process methods need to return vfiles that have messages
	 */
	const p1 = {process: () => Promise.resolve("p1 resolution")};
	const p2 = {process: () => Promise.resolve("p2 resolution")};

	let base = new Base(
		createMockConnection(),
		createMockDocuments(),
		p1
	);

	t.equal(
		await(base.validate({document: createMockDocument("")})),
		"p1 resolution"
	);

	base.setProcessor(p2);

	t.equal(
		await(base.validate({document: createMockDocument("")})),
		"p2 resolution"
	);
});

Test.skip("createProcessor()", t => {
	// given settings, does it create a unified processor?
	// does it recognize plugins and their options?
	// does it parse "#module" syntax and "//file" syntax
});

Test("start() listens to connections", t => {
	t.plan(2);

	let connection = createMockConnection();
	let documents = createMockDocuments();

	let base = new Base(connection, documents, processor);
	
	base.start();

	t.ok(connection.listen.called);
	t.ok(documents.listen.calledWith(connection));
});

Test("configureWith() is used to listen to changes in settings and updating the processor with them", async t => {
	t.plan(1);

	let connection = createMockConnection();
	let documents = createMockDocuments([
		createMockDocument("text with a spellingg mistake", {uri: "uri-01"}),
		createMockDocument("proper text.", {uri: "uri-02"}),
	]);

	let base = new Base(connection, documents, processor)
		.configureWith(settings => settings.some.obscure.path);

	connection.onDidChangeConfiguration.args[0][0] ({some: {obscure: {path:
		{
			plugins: [
				["#retext-spell", "#dictionary-en-gb"],
			]
		}
	}}});

	await(waitUntilCalled(connection.sendDiagnostics));

	t.deepEqual(
		connection.sendDiagnostics.args.sort(_ => _.uri),
		[
			[{
				uri: "uri-01",
				diagnostics: [{
					range: {
						start: { line: 0, character: 12, },
						end: { line: 0, character: 12 + "spellingg".length, },
					},
					message: "`spellingg` is misspelt; did you mean `spelling`, `spellings`?",
					severity: DiagnosticSeverity.Hint,
					code: "spellingg",
					source: "retext-spell",
				}]
			}],
			[{
				uri: "uri-02",
				diagnostics: []
			}]
		],
		"diagnostics must be sent for all documents"
	);
});

Test("the cb given to configureWith() throws an error", t => {
	t.plan(2);

	let connection = createMockConnection();
	let documents = createMockDocuments([
		createMockDocument("text with a spellingg mistake", {uri: "uri-01"}),
		createMockDocument("proper text.", {uri: "uri-02"}),
	]);

	let base = new Base(connection, documents, processor)
		.configureWith(() => {
			throw new Error("the error thrown by the configuration filter function");
		});

	t.doesNotThrow(() => {
		connection.onDidChangeConfiguration.args[0][0] ("settings from the client");
	});

	t.ok(
		connection.console.log.calledWith(
			"the error thrown by the configuration filter function"
		),
		"error must be logged"
	);
});
