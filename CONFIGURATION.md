# Configuration

The default settings are **roughly**[(see the exact configuration)](#default-settings) equal to:

```json
{
	"retext-english": {
		"plugins": [
			["#retext-profanities"],
			["#retext-spell", "#dictionary-en-gb"]
		],
	},
	"remark-parse": {
		"plugins": [
			["#remark-preset-lint-markdown-style-guide"]
			["#remark-retext", "#parse-latin"],
			["#retext-profanities"],
			["#retext-spell", "#dictionary-en-gb"]
		]
	}
}
```

Your text editors (if they are [LSP clients](https://langserver.org/)) can be configured to override these settings.

## Configuration for text editors

### For NeoVim

```vim
"inside .vimrc
let g:LanguageClient_settingsPath = "/home/aecepoglu/.settings.json"
```

and the file `/home/aecepoglu/.settings.json` would be:

```json
{
	"unified-language-server": {
		"retext-english": {
			"plugins": [
				...
			]
		},
		"remark-parse": {
			"plugins": [
				...
			]
		}
	}
}
```

### For other editors

(TODO)

--------------------

## Re-Using Settings

If I wanted to use `retext-redundant-acronyms`, `retext-overuse`, `retext-intensify` and `retext-repeated-words` plugins for my text files and markdown files, I would do:

```json
{
	"unified-language-server": {
		"retext-english": {
			"plugins": [
				["#retext-redundant-acronyms"],
				["#retext-overuse"],
				["#retext-intensify"],
				["#retext-repeated-words"],
				["#retext-spell", "#dictionary-en-gb"]
			]
		},
		"remark-parse": {
			"plugins": [
				["#remark-preset-lint-markdown-style-guide"],
				["#remark-retext", "#parse-latin"],
				["#retext-redundant-acronyms"],
				["#retext-overuse"],
				["#retext-intensify"],
				["#retext-repeated-words"],
				["#retext-spell", "#dictionary-en-gb"]
			]
		}
	}
}
```

*BUT*, I (as a sane person) want my markdown rules to just follow my `retext-english` rules. I could enable that with:

```json
{
	"unified-language-server": {
		"retext-english": {
			"plugins": [
				["#retext-redundant-acronyms"],
				["#retext-overuse"],
				["#retext-intensify"],
				["#retext-repeated-words"],
				["#retext-spell", "#dictionary-en-gb"]
			]
		},
		"remark-parse": {
			"plugins": [
				["#remark-preset-lint-markdown-style-guide"]
			],
			"checkTextWith": {
				"setting": "retext-english",
				"mutator": ["#remark-retext", "#parse-latin"]
			}
		}
	}
}
```

And in fact, this is how the default configuration actually is:

## Default Settings

```json
{
	"unified-language-server": {
		"retext-english": {
			"plugins": [
				["#retext-spell", "#dictionary-en-gb"]
			]
		},
		"remark-parse": {
			"plugins": [
				["#remark-preset-lint-markdown-style-guide"]
			],
			"checkTextWith": {
				"setting": "retext-english",
				"mutator": ["#remark-retext", "#parse-latin"]
			}
		},
	}
}
```

## Applying Settings Partially

When you omit any of the parsers in your configuration the default configuration will be used in its place.

If are happy with what `remark-parse` does but you want `remark-english` to be different, you could:

```json
{
	"unified-language-server": {
		"retext-english": {
			"plugins": [
				["#retext-repeated-words"],
				["#retext-spell", "#dictionary-en-gb"]
			]
		}
	}
}
```

# The Format

(TODO)

We rely entirely on [UnifiedJS parsers and processors](https://github.com/unifiedjs/unified#list-of-processors).

The command line `--parser` option is used to parse the data.

If a string value starts with `#`, then the module with that name will be required.

If a string value starts with `//`, then the file with that path will be read.
