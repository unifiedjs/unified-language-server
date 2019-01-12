# Unified-Language-Server

A [language server](http://langserver.org) for text.

[!demo gif](https://media.giphy.com/media/8BlBVMzDbmGY6ORBeL/giphy.gif)

It supports all formats [Unified.JS](https://unified.js.org) can understand:

- plain text
- markdown
- HTML
- and [other syntax](https://github.com/unifiedjs/awesome#syntaxes)

And it provides:

- prose and syntax checking
- formatting *(in progress)*

## Install

```bash
yarn global add unified-language-server
# OR
npm install -g unified-language-server
```

And configure your text editor to use:

- `unified-language-server --parser=retext-english --stdio` for `text`
- `unified-language-server --parser=remark-parse --stdio` for `markdown`

### For NeoVim

```vim
"inside .vimrc
let g:LanguageClient_serverCommands = {
\ 'text': ['unified-language-server', '--parser=retext-english', '--stdio'],
\ 'markdown': ['unified-language-server', '--parser=remark-parse', '--stdio'],
\ }
```

And you're ready to go!  

## Configuration

The server has default configurations for `remark-parse`(for  markdown) and `remark-english`(for text):

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

So, for a markdown file:

1. because we launched it with `--parser=remark-parse`, it finds the setting with the same name
2. applies all the plugins:
  1. `remark-preset-lint-markdown-style-guide` checks for markdown usage
  2. `remark-retext` extracts the texts from markdown
  3. `retext-profanities` about usage of profanity words
  4. `retext-spell` does spellcheck

More detail on configuration is available at [CONFIGURATION.md](CONFIGURATION.md)

## Contributing

To contribute, please:

- Report any and all issues that you have
- In your issues make sure to mention:
  - what version of the server you are running
  - your configurations (if you have any)

