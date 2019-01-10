#!/usr/bin/node
const Base = require("./index");
const LangServer = require("vscode-languageserver");
const unified = require("unified");

const ALL_SETTINGS = {
	"remark-english": {
		plugins: [
			["#retext-profanities"],
		],
	},
	"remark-parse": {
		plugins: [
			["#remark-retext", "#parse-latin"],
		],
		retextWith: {
			setting: "remark-english",
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

const getArg = (prefix, isOptional) =>
	process.argv.slice(2).find(_ => _.startsWith(prefix))
	|> (_ => {
		if (_) {
			return _.slice(prefix.length);
		} else if (isOptional) {
			return undefined;
		} else {
			throw new Error("Supply '--parser=X' where X is the name of parser you want to use; such as \"retext-latin\" or \"remarked\"");
		}
	});

const populateRetexts = settings =>
	mapObj(settings, ({ retextWith, plugins, ...rest }) => ({
		plugins: [
			...plugins,
			...(retextWith
					? [
						retextWith.mutator,
						...settings[retextWith.setting].plugins,
					]
					: []
			)
		],
		...rest,
	}));

const validateSettings = settings =>
	mapObj(settings, ({retextWith, plugins, ...rest}, name) => {
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
	
		if (retextWith !== undefined) {
			if (typeof(retextWith) != "object") {
				//TODO make error more verbose
				throw new Error("retextWith must be undefined or an object with 2 fields: \"setting\" and \"mutator\".");
			}
			if (settings[retextWith.setting] === undefined) {
				throw new Error(
					"retextWith.setting should be the name of an entry in your settings. Candidates are: "
					+ withCommas(Object.keys(settings))
				);
			}
			if (!Array.isArray(settings[retextWith.mutator]) !== true) {
				throw new Error("retextWith.mutator should be a plugin definition (like those in \"plugins\"");
			}
		}

		return {retextWith, plugins};
	});


const parserName = getArg("--parser=")
const processor0 = require(parserName)
	|> (_ => {
		if (_.Parser === undefined) {
			throw new Error(
				`The parser you have supplied (${parserName}) is not a valid unifiedJS parser.\n`
				+ "The module needs to have a \"Parser\" method as described here: "
				+ "https://github.com/unifiedjs/unified#processorparser"
			);
		} else {
			return _;
		}
	})
	|> (_ => unified().use(_).use(stringify).freeze());
const SETTINGS = ALL_SETTINGS
	|> validateSettings
	|> populateRetexts
	|> (_ => _[parserName]);

const connection = LangServer.createConnection(LangServer.ProposedFeatures.all);
const documents = new LangServer.TextDocuments();

let server = new Base(connection, documents, processor0());
server.setProcessor(server.createProcessor(SETTINGS));
server.configureWith(change =>
	change.settings
	|> validateSettings
	|> appendRetexts
	|> (_ => _[parserName])
);
server.start();
