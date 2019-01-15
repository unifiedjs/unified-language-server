const Base = require("./index");
const Test = require("tape"); //TODO try 'ava' instead
const unified = require("unified");
const {
	TextDocumentSyncKind,
	DiagnosticSeverity,
} = require("vscode-languageserver-protocol");
const {spy} = require("sinon");
const VMessage = require("vfile-message");

const parser = require("retext-english");
function compiler() {
	this.Compiler = () => "compiler's output";
}
const msgPushingAttacher = vMsg => options => (tree, file) => {
	file.messages.push(vMsg);
};

const textProcessor = unified()
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

	let base = new Base(connection, documents, textProcessor);

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

Test("setProcessor()", async t => {
	t.plan(2);

	const plugin1 = msgPushingAttacher(new VMessage(
		"msg one",
		{
			start: {line: 1, column: 5},
			end: {line: 2, column: 10},
		},
		"attacher1:rule1"
	));
	const plugin2 = msgPushingAttacher(new VMessage(
		"msg two",
		{
			start: {line: 3, column: 6},
			end: {line: 4, column: 8},
		},
		"attacher2:rule1"
	));

	const processor1 = textProcessor().use(plugin1);
	const processor2 = textProcessor().use(plugin2);

	let base = new Base(
		createMockConnection(),
		createMockDocuments(),
		processor1
	);

	let doc = {
		document: createMockDocument("", {uri: "uri-01"})
	};

	t.deepEqual(
		await(base.validate(doc)),
		[{
			range: {
				start: { line: 0, character: 4 },
				end: { line: 1, character: 9 },
			},
			message: "msg one",
			severity: DiagnosticSeverity.Hint,
			source: "attacher1",
		}],
	);

	base.setProcessor(processor2);

	t.deepEqual(
		await(base.validate(doc)),
		[{
			range: {
				start: { line: 2, character: 5 },
				end: { line: 3, character: 7 },
			},
			message: "msg two",
			severity: DiagnosticSeverity.Hint,
			source: "attacher2",
		}],
	);
});

Test("createProcessor()", t => {
	let connection = createMockConnection();
	let documents = createMockDocuments();
	let TEXT = [
		"spellinggg misstakes alll overr",
		"and carrot is spelled correctly but my personal dictionary dislikes it",
	].join("\n");

	let base = new Base(connection, documents, textProcessor);

	[
		["empty settings", {}],
		["nonexistent modules", {
			plugins: [
				["#some-unknown-module-by-aecepoglu"]
			]
		}],
		["nonexistent file", {
			plugins: [
				["//i-bet-this-file-doesnt-exist.txt"]
			]
		}]
	].forEach(([description, settings]) => {
		t.test(description, st => {
			st.plan(1);
			st.throws(() => {
				base.createProcessor({});
			}, `error thrown for ${description}`);
		});
	});

	t.test("defining modules with '#'", async st => {
		st.plan(1);

		let myProcessor = base.createProcessor({
			plugins: [
				["#retext-spell", "#dictionary-en-gb"]
			]
		});

		let abc = await(myProcessor.process(TEXT))
		st.deepEqual(
			abc
				.messages
				.map(_ => _.actual),
			["spellinggg", "misstakes", "alll", "overr"]
		);
	});

	t.test("defining files with '//'", async st => {
		st.plan(1);

		let myProcessor = base.createProcessor({
			plugins: [
				["#retext-spell", {
					dictionary: "#dictionary-en-gb",
					personal: "//./sample-dict.txt",
				}]
			]
		});

		let abc = await(myProcessor.process(TEXT))
		st.deepEqual(
			abc
				.messages
				.map(_ => _.actual),
			["spellinggg", "misstakes", "alll", "overr", "carrot"]
		);
	});
});

Test("start() listens to connections", t => {
	t.plan(2);

	let connection = createMockConnection();
	let documents = createMockDocuments();

	let base = new Base(connection, documents, textProcessor);
	
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

	let base = new Base(connection, documents, textProcessor)
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

	let base = new Base(connection, documents, textProcessor)
		.configureWith(() => {
			throw new Error("the error thrown by the configuration filter function");
		});

	t.doesNotThrow(() => {
		connection.onDidChangeConfiguration.args[0][0] ("settings from the client");
	});

	t.ok(
		connection.console.log.calledWith(
			"Error: the error thrown by the configuration filter function"
		),
		"error must be logged"
	);
});
