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

*   [What is this?](#what-is-this)
*   [When should I use this?](#when-should-i-use-this)
*   [Install](#install)
*   [Use](#use)
*   [API](#api)
    *   [`createUnifiedLanguageServer(options)`](#createunifiedlanguageserveroptions)
*   [Examples](#examples)
*   [Types](#types)
*   [Compatibility](#compatibility)
*   [Related](#related)
*   [Contribute](#contribute)
*   [License](#license)

## What is this?

This package exports a function which can be used to create a
[language server][] based on [unified][] processors.
It can do the following:

*   format documents based on a unified processor
*   validate documents based on a unified processor
*   support configuration files using [unified-engine][]

**unified** is a project that validates and transforms content with abstract
syntax trees (ASTs).
**unified-engine** is a project that can apply configure ecosystems based on
unified on a workspace using configuration files.
**language server** is a standardized language independant way for creating
editor integrations.

## When should I use this?

This package is useful when you want to create a language server for an existing
unified ecosystem.
Ideally this should follow the same rules as a CLI for this ecosystem created
using [unified-args][].
The resulting package may then be used to create plugins for this ecosystem for
various editors.

## Install

This package is [ESM only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c).
In Node.js (version 12.20+, 14.14+, or 16.0+), install with [npm][]:

```sh
npm install unified-language-server
```

## Use

Let’s say you want to create a language server for \[remark]\[].

Create a file names `package.json` with the following content:

```json
{
  "name": "remark-language-server",
  "version": "1.0.0",
  "bin": "./index.js",
  "type": "module",
  "dependencies": {
    "unified-language-server"
  }
}
```

Then create `index.js` with the following content:

```js
import {createUnifiedLanguageServer} from 'unified-language-server'

process.title = 'remark-language-server'

createUnifiedLanguageServer({
  ignoreName: '.remarkignore',
  packageField: 'remarkConfig',
  pluginPrefix: 'remark',
  plugins: ['remark-parse', 'remark-stringify'],
  rcName: '.remarkrc'
})
```

That’s all there is to it.
You have just created a language server for remark.

## API

### `createUnifiedLanguageServer(options)`

Create a language server for a unified ecosystem.

##### `options`

Configuration for `unified-engine` and the language server.

###### `options.defaultSource`

Default source used for diagnostics (`string`, optional)

###### `options.ignoreName`

Name of ignore files to load (`string`, optional)

###### `options.packageField`

Property at which configuration can be found in package.json files (`string`,
optional)

###### `options.pluginPrefix`

Optional prefix to use when searching for plugins (`string`, optional)

###### `options.plugins`

Plugins to use by default (`Array|Object`, optional)

Typically this contains 2 plugins named `*-parse` and `*-stringify`.

###### `options.rcName`

Name of configuration files to load (`string`, optional)

## Examples

For examples, see the following projects:

*   \[`redot-language-server`]\[]
*   \[`rehype-language-server`]\[]
*   \[`remark-language-server`]\[]

## Types

This package is fully typed with [TypeScript][].
It exports an `Options` type, which specifies the interface of the accepted
options.

## Compatibility

Projects maintained by the unified collective are compatible with all maintained
versions of Node.js.
As of now, that is Node.js 12.20+, 14.14+, and 16.0+.
Our projects sometimes work with older versions, but this is not guaranteed.

This plugin works with `unified` version 10+.

## Related

*   \[`unified`]\[]
    — create pipeline for working with syntax trees
*   \[`unified-args`]\[]
    — create a CLI for a unified pipeline

## Contribute

See [`contributing.md`][contributing] in [`unified/.github`][health] for ways
to get started.
See [`support.md`][support] for ways to get help.

This project has a [code of conduct][coc].
By interacting with this repository, organization, or community you agree to
abide by its terms.

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://github.com/rehypejs/rehype-format/workflows/main/badge.svg

[build]: https://github.com/rehypejs/rehype-format/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/rehypejs/rehype-format.svg

[coverage]: https://codecov.io/github/rehypejs/rehype-format

[downloads-badge]: https://img.shields.io/npm/dm/rehype-format.svg

[downloads]: https://www.npmjs.com/package/rehype-format

[size-badge]: https://img.shields.io/bundlephobia/minzip/rehype-format.svg

[size]: https://bundlephobia.com/result?p=rehype-format

[sponsors-badge]: https://opencollective.com/unified/sponsors/badge.svg

[backers-badge]: https://opencollective.com/unified/backers/badge.svg

[collective]: https://opencollective.com/unified

[chat-badge]: https://img.shields.io/badge/chat-discussions-success.svg

[chat]: https://github.com/rehypejs/rehype/discussions

[npm]: https://docs.npmjs.com/cli/install

[health]: https://github.com/rehypejs/.github

[contributing]: https://github.com/rehypejs/.github/blob/HEAD/contributing.md

[support]: https://github.com/rehypejs/.github/blob/HEAD/support.md

[coc]: https://github.com/rehypejs/.github/blob/HEAD/code-of-conduct.md

[language server]: https://microsoft.github.io/language-server-protocol/

[license]: LICENSE.txt

[author]: https://wooorm.com

[typescript]: https://www.typescriptlang.org

[unified]: https://github.com/unifiedjs/unified

[unified-args]: https://github.com/unifiedjs/unified-args

[unified-engine]: https://github.com/unifiedjs/unified-engine
