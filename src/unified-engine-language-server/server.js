const base = require("./index");

const ABC = process.argv.slice(2)
	.filter(x => x.startsWith("--base="))
	.map(x => x.slice("--base=".length))
	[0] ||;

if (ABC === undefined) {
	throw new Error("Supply '--base=X' where X is the name of processor you want to use; such as \"retext\" or \"remarked\"");
}

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
}

const DEFAULT_SETTINGS = ALL_DEFAULT_SETTINGS[ABC] || {
	plugins: [],
};

if (ALL_DEFAULT_SETTINGS[ABC] === undefined) {
	console.warn(`I don't have configurations for ${ABC}.`);
}

const connection = LangServer.createConnection(LangServer.ProposedFeatures.all);
const documents = new LangServer.TextDocuments();

let one = new One(connection, documents, require(ABC));
one.setProcessor(one.createProcessor(DEFAULT_SETTINGS));
one.configureWith(change => change.settings["unified-engine-language-server"] || DEFAULT_SETTINGS);
one.start();
