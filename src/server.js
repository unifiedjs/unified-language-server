#!/usr/bin/node
const Base = require("./index");
const LangServer = require("vscode-languageserver");
const unified = require("unified");

const ALL_SETTINGS = {
	"retext-english": {
		plugins: [
			["#retext-profanities"],
			["#retext-spell", "#dictionary-en-gb"]
		],
	},
	"remark-parse": {
		plugins: [
			["#remark-preset-lint-markdown-style-guide"]
		],
		checkTextWith: {
			setting: "retext-english",
			mutator: ["#remark-retext", "#parse-latin"],
		}
	},
};

function stringify() {
	this.Compiler = () => "";
}

const withCommas = list => list.map(x => `"${x}"`).join(", ");

const mapObj = (obj, f) =>
	Object.keys(obj).reduce(
		(acc, k) => ({
			[k]: f(obj[k], k),
			...acc
		}),
		{}
	);

const getArg = (prefix, isOptional) => {
	let arg = process.argv.slice(2).find(_ => _.startsWith(prefix));

	if (_) {
		return _.slice(prefix.length);
	} else if (isOptional) {
		return undefined;
	} else {
		throw new Error(
			"Supply '--parser=X' where X is the name of parser you want to use;"
			+ " such as \"retext-latin\" or \"remarked\""
		);
	}
};

const populateTextPlugins = settings =>
	mapObj(settings, ({ checkTextWith, plugins, ...rest }) => ({
		plugins: [
			...plugins,
			...(checkTextWith
				? [
					checkTextWith.mutator,
					...settings[checkTextWith.setting].plugins,
				]
				: []
			)
		],
		...rest,
	}));

const validateSettings = settings =>
	mapObj(settings, ({checkTextWith, plugins, ...rest}, name) => {
		if (Object.keys(rest).length > 0) {
			console.warn(
				"The keys: "
				+ withCommas(Object.keys(rest))
				+ " are not supported"
			);
		}
	
		if (!Array.isArray(plugins)) {
			throw new Error(`${name}.plugins should be a list`);
		}
		if (!plugins.every(Array.isArray)) {
			throw new Error(`every item in ${name}.plugins should be a list.`);
		}
	
		if (checkTextWith !== undefined) {
			if (typeof(checkTextWith) != "object") {
				//TODO make error more verbose
				throw new Error(
					"checkTextWith must be undefined or an object with 2 fields:"
					+ "\"setting\" and \"mutator\"."
				);
			}
			if (settings[checkTextWith.setting] === undefined) {
				throw new Error(
					"checkTextWith.setting should be the name of an entry in your settings."
					+ " Candidates are: "
					+ withCommas(Object.keys(settings))
				);
			}
			if (!Array.isArray(settings[checkTextWith.mutator]) !== true) {
				throw new Error(
					"checkTextWith.mutator should be a plugin definition"
					+ " (like those in \"plugins\")"
				);
			}
		}

		return {checkTextWith, plugins};
	});

const validateAndProcessSettings = s => {
	let resp = (
		populateTextPlugins(
			validateSettings(
				Object.assign({}, ALL_SETTINGS, s)
			)
		)
	)[parserName]

	if (resp) {
		return resp;
	} else {
		throw new Error(`I don't know what the settings for ${parserName} is`);
	}
};

const parserName = getArg("--parser=")
const processor0 = (function() {
	let parser = require(parserName);

	if (parser.Parser === undefined) {
		throw new Error(
			`The parser you have supplied (${parserName}) is not a valid unifiedJS parser.\n`
			+ "The module needs to have a \"Parser\" method as described here: "
			+ "https://github.com/unifiedjs/unified#processorparser"
		);
	}

	return unified()
		.use(parser)
		.use(stringify)
		.freeze();
})();

const connection = LangServer.createConnection(LangServer.ProposedFeatures.all);
const documents = new LangServer.TextDocuments();

let server = new Base(connection, documents, processor0());
server.setProcessor(
	server.createProcessor(
		validateAndProcessSettings(undefined)
	)
);
server.configureWith(change =>
	validateAndProcessSettings(
		change.settings["unified-language-server"]
	)
);
server.start();
