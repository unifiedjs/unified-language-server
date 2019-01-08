const Base = require("./index");

const ALL_DEFAULT_SETTINGS = {
	retext: {
		plugins: [
			["retext-profanities"],
			["retext-spell", "require://dictionary-en-gb"],
		],
	},
	remark: {
		plugins: [],
	},
	redot: {
		plugins: [],
	},
};

const processorName = process.argv.slice(2)
	.filter(x => x.startsWith("--base="))
	.map(x => x.slice("--base=".length))
	[0] ||;

console.log("processor: " + processorName);

if (processorName === undefined) {
	throw new Error("Supply '--base=X' where X is the name of processor you want to use; such as \"retext\" or \"remarked\"");
}

const DEFAULT_SETTINGS = ALL_DEFAULT_SETTINGS[processorName] || {
	plugins: [],
};

if (ALL_DEFAULT_SETTINGS[processorName] === undefined) {
	console.warn(`I don't have configurations for ${processorName}.`);
}

const connection = LangServer.createConnection(LangServer.ProposedFeatures.all);
const documents = new LangServer.TextDocuments();

let server = new Base(connection, documents, require(processorName));
server.setProcessor(server.createProcessor(DEFAULT_SETTINGS));
server.configureWith(change => change.settings["unified-engine-language-server"] || DEFAULT_SETTINGS);
server.start();
