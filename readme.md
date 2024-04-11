# unified-language-server

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]
[![Sponsors][sponsors-badge]][collective]
[![Backers][backers-badge]][collective]
[![Chat][chat-badge]][chat]

Create a **[language server][]** based on **[unified][]** ecosystems.

## Contents

* [What is this?](#what-is-this)
* [When should I use this?](#when-should-i-use-this)
* [Install](#install)
* [Use](#use)
* [API](#api)
  * [`createUnifiedLanguageServer(options)`](#createunifiedlanguageserveroptions)
* [Examples](#examples)
* [Types](#types)
* [Language Server features](#language-server-features)
  * [Watching files](#watching-files)
  * [Requests](#requests)
  * [Configuration](#configuration)
* [Compatibility](#compatibility)
* [Related](#related)
* [Contribute](#contribute)
* [License](#license)

## What is this?

This package exports a function which can be used to create a
[language server][] based on [unified][] processors.
It can do the following:

* format documents based on a unified processor
* validate documents based on a unified processor
* support configuration files (such as `.remarkrc`) using
  [`unified-engine`][unified-engine]

**unified** is a project that validates and transforms content with abstract
syntax trees (ASTs).
**unified-engine** is an engine to process multiple files with unified using
configuration files.
**language server** is a standardized language independent way for creating
editor integrations.

## When should I use this?

This package is useful when you want to create a language server for an existing
unified ecosystem.
Ideally this should follow the same rules as a CLI for this ecosystem created
using [`unified-args`][unified-args].
The resulting package may then be used to create plugins for this ecosystem for
various editors.

## Install

This package is [ESM only][].
In Node.js (version 16.0+), install with [npm][]:

```sh
npm install unified-language-server
```

## Use

Let’s say you want to create a language server for [remark][].

Create a file names `package.json` with the following content:

```json
{
  "name": "remark-language-server",
  "version": "1.0.0",
  "bin": "./index.js",
  "type": "module",
  "dependencies": {
    "remark": "^14.0.0",
    "unified-language-server": "^1.0.0"
  }
}
```

Then create `index.js` with the following content:

```js
import {remark} from 'remark'
import {createUnifiedLanguageServer} from 'unified-language-server'

process.title = 'remark-language-server'

createUnifiedLanguageServer({
  ignoreName: '.remarkignore',
  packageField: 'remarkConfig',
  pluginPrefix: 'remark',
  rcName: '.remarkrc',
  processorName: 'remark',
  processorSpecifier: 'remark',
  defaultProcessor: remark
})
```

That’s all there is to it.
You have just created a language server for remark.

## API

### `createUnifiedLanguageServer(options)`

Create a language server for a unified ecosystem.

##### `options`

Configuration for `unified-engine` and the language server.

###### `options.processorName`

The package ID of the expected processor (`string`, required, example:
`'remark'`).
Will be loaded from the local workspace.

###### `options.processorSpecifier`

The specifier to get the processor on the resolved module (`string`, optional,
default: `'default'`).
For example, remark uses the specifier `remark` to expose its processor and
a default export can be requested by passing `'default'` (the default).

###### `options.defaultProcessor`

Optional fallback processor to use if `processorName` can’t be found
locally in `node_modules` ([`Unified`][unified], optional).
This can be used to ship a processor with your package, to be used if no
processor is found locally.
If this isn’t passed, a warning is shown if `processorName` can’t be found.

###### `options.ignoreName`

Name of ignore files to load (`string`, optional).

###### `options.packageField`

Property at which configuration can be found in package.json files (`string`,
optional).

###### `options.pluginPrefix`

Optional prefix to use when searching for plugins (`string`, optional).

###### `options.plugins`

Plugins to use by default (`Array|Object`, optional).

###### `options.rcName`

Name of configuration files to load (`string`, optional).

## Examples

For examples, see the following projects:

* `redot-language-server`
  (coming soon)
* `rehype-language-server`
  (coming soon)
* [`remark-language-server`](https://github.com/remarkjs/remark-language-server)

## Types

This package is fully typed with [TypeScript][].
It exports an `Options` type, which specifies the interface of the accepted
options.

## Language Server features

### Watching files

Clients should watch the `unified-engine`
[config files][unified-engine-configuration] and notify the language server if a
change was made.

### Requests

Language servers created using this package implement the following language
server features:

* `textDocument/codeAction`
  — the language server implements code actions based on the `expected` field
  on reported messages.
  A code action can either insert, replace, or delete text based on the range
  of the message and the expected value.
* `textDocument/didChange`
  — when a document is changed by the client, the language server processes it
  using a unified pipeline.
  Any messages collected are published to the client using
  `textDocument/publishDiagnostics`.
* `textDocument/didClose`
  — when a document is closed by the client, the language server resets
  diagnostics by publishing an empty array using
  `textDocument/publishDiagnostics`.
* `textDocument/didOpen`
  — when a document is opened by the client, the language server processes it
  using a unified pipeline.
  Any messages collected are published to the client using
  `textDocument/publishDiagnostics`.
* `textDocument/formatting`
  — when document formatting is requested by the client, the language server
  processes it using a unified pipeline.
  The stringified result is returned.
* `workspace/didChangeWatchedFiles` and `workspace/didChangeWorkspaceFolders`
  — when the client signals a watched file or workspace has changed, the
  language server processes all open files using a unified pipeline.
  Any messages collected are published to the client using
  `textDocument/publishDiagnostics`.

### Configuration

* `requireConfig` (default: `false`)
  — If true, files will only be checked if a configuration file is present.

## Compatibility

Projects maintained by the unified collective are compatible with all maintained
versions of Node.js.
As of now, that is Node.js 16.0+.
Our projects sometimes work with older versions, but this is not guaranteed.

This project uses [`vscode-languageserver`][vscode-languageserver] 7, which
implements language server protocol 3.17.0.
It should work anywhere where LSP 3.6.0 or later is implemented.

## Related

* [`unified`](https://github.com/unifiedjs/unified)
  — create pipeline for working with syntax trees
* [`unified-args`](https://github.com/unifiedjs/unified-args)
  — create a CLI for a unified pipeline

## Contribute

See [`contributing.md`][contributing] in [`unifiedjs/.github`][health] for ways
to get started.
See [`support.md`][support] for ways to get help.

This project has a [code of conduct][coc].
By interacting with this repository, organization, or community you agree to
abide by its terms.

## License

[MIT][license] © [@aecepoglu][author]

<!-- Definitions -->

[build-badge]: https://github.com/unifiedjs/unified-language-server/workflows/main/badge.svg

[build]: https://github.com/unifiedjs/unified-language-server/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/unifiedjs/unified-language-server.svg

[coverage]: https://codecov.io/github/unifiedjs/unified-language-server

[downloads-badge]: https://img.shields.io/npm/dm/unified-language-server.svg

[downloads]: https://www.npmjs.com/package/unified-language-server

[esm only]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

[size-badge]: https://img.shields.io/bundlephobia/minzip/unified-language-server.svg

[size]: https://bundlephobia.com/result?p=unified-language-server

[sponsors-badge]: https://opencollective.com/unified/sponsors/badge.svg

[backers-badge]: https://opencollective.com/unified/backers/badge.svg

[collective]: https://opencollective.com/unified

[chat-badge]: https://img.shields.io/badge/chat-discussions-success.svg

[chat]: https://github.com/unifiedjs/rehype/discussions

[npm]: https://docs.npmjs.com/cli/install

[health]: https://github.com/unifiedjs/.github

[contributing]: https://github.com/unifiedjs/.github/blob/HEAD/contributing.md

[support]: https://github.com/unifiedjs/.github/blob/HEAD/support.md

[coc]: https://github.com/unifiedjs/.github/blob/HEAD/code-of-conduct.md

[language server]: https://microsoft.github.io/language-server-protocol/

[license]: license

[author]: https://github.com/aecepoglu

[typescript]: https://www.typescriptlang.org

[unified]: https://github.com/unifiedjs/unified

[remark]: https://github.com/remarkjs/remark

[unified-args]: https://github.com/unifiedjs/unified-args

[unified-engine]: https://github.com/unifiedjs/unified-engine

[unified-engine-configuration]: https://github.com/unifiedjs/unified-engine/blob/main/readme.md#implicit-configuration

[vscode-languageserver]: https://github.com/microsoft/vscode-languageserver-node/tree/main/server
