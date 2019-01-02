retext-language-server
======================

A [Language-server-protocol](https://langserver.org) implementation of [retext](TODO)

# Installation

First, install the server

```
yarn global add retext-language-server
#OR
npm install -g retext-language-server
```

Next, configure the client (your text editor) to use `retext-language-server --stdio`.  

### configuration for NeoVim

TODO

`"plugins"` is a list of retext compatible plugins. Any of [the plugins listed by retext](https://github.com/retextjs/retext/blob/master/doc/plugins.md) would do.

    // .vim/settings.json
    {
    	"retext-language-server": {
    		"plugins": [
    			["profanities"],
    			["simplify"],
    			["redundand-acronyms"],
    			["equality", {
    				"ignore": ["birth-defect"]
    			}],
    			["spell"]
    		]
    	}
    }

### Useful links

* https://unified.js.org/#guides
