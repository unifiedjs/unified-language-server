retext-language-server
======================

A [Language-server-protocol](https://langserver.org) for [retext](https://github.com/retextjs/retext).

![gif demo](https://media.giphy.com/media/46huoybWBhbMCi8M5Q/giphy.gif)

# Installation

First, install the server

```
yarn global add retext-language-server
#OR
npm install -g retext-language-server
```

Next, configure the client (your text editor) to use `retext-language-server --stdio` for `text` files.  

For NeoVim I do:

```
let g:LanguageClient_serverCommands = {
\ 'text': ['~/.yarn/bin/retext-language-server', '--stdio'],
\ }
```

### Configuration

*retext-language-server* is compatible with [all retext plugins](https://github.com/retextjs/retext/blob/master/doc/plugins.md).

The default configuration is:

```json
{
	"plugins": [
		["profanities"],
		["spell", "require://dictionary-en-gb"],
	]
}
```

Which means `retext-profanities` and `retext-spell` plugins are used. `retext-spell` is given an option: the npm module named `dictionary-en-gb`.npmjs.com/package/dictionary-en-gb).


If you want to use two plugins named `retext-xyz` and `retext-abc` then use the settings:

```json
{
	"plugins": [
		["xyz"],
		["abc"]
	]
}
```

If you want to pass options to a plugin, give it as the second argument after the name of the plugin. In the example below an object is passed, but it could have been a list, a text or a number.

```json
{
	"plugins": [
		["xyz"],
		["abc", {
			"anOption": "something",
			"x": false,
			"y": 5,
			"z": "require://name-of-an-npm-module-to-require",
			"k": "file:///absolute/path/to/file/to/read"
		}]
	]
}
```

There are 2 special cases:

* `"require://"`: if a value starts with "require://" then the module with that name will be `require`d and passed as the argument.

   `require://a` will perform `require("a")` and use its value.

* `"file://"`: if a value starts with "file://" then the file at that absolute path will be read

   `file:///home/aecepoglu/file1.json` uses the file at `/home/aecepoglu/file1.json` *(note that it is `file:///...` and not `file://`. In the latter case relative paths would be used.)*


##### Sample server settings for NeoVim:

.vim/settings.json:

```json
{
	"retext-language-server": {
		"plugins": [
			["profanities"],
			["simplify"],
			["redundand-acronyms"],
			["equality", {
				"ignore": ["special"]
			}],
			["spell", "require://dictionary-en-gb"]
		]
	}
}
```

### Relevant links

* [A introduction to unified (the basis for retext)](https://unified.js.org/#guides)
* [retext github page](https://github.com/retextjs/retext)
* [dictionaries](https://github.com/wooorm/dictionaries) to use with [retext-spell](https://github.com/retextjs/retext-spell)
