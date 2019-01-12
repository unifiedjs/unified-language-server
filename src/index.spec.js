const Base = require("./index");

const connection = {
	onInitialize: () => {},
	sendDiagnostics: obj => {
		console.log(obj);
	},
	console: {log: console.log}
};

const documents = {
	onDidChangeContent: () => {}
};

const x = new Base(connection, documents, require("retext"));
x.setProcessor(x.createProcessor({
	plugins: [
		["retext-profanities"]
	]
}));

const TEXT = "When I say shit, it should give a profanity error";

const print = prefix => _ => console.log(prefix, _);

x.validate({document: {getText: () => TEXT}})
	.then(print("success"), print("error"));
