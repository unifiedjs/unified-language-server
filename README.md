  [What is this?](#what-is-this)
 *   [When should I use this?](#when-should-i-use-this)
 *   [Install](#install)
 *   [Use](#use)
 *   [API](#api)
     *   [`createUnifiedLanguageServer(options)`](#createunifiedlanguageserveroptions)
 *   [Examples](#examples)
 *   [Types](#types)
 *   [Language Server features](#language-server-features)
     *   [Watching files](#watching-files)
     *   [Requests](#requests)
     *   [Configuration](#configuration)
 *   [Compatibility](#compatibility)
 *   [Related](#related)
 *   [Contribute](#contribute)
 *   [License](#license)
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
 
 *   format documents based on a unified processor
 *   validate documents based on a unified processor
 *   support configuration files (such as `.remarkrc`) using
     [`unified-engine`][unified-engine]
 * format documents based on a unified processor
 * validate documents based on a unified processor
 * support configuration files (such as `.remarkrc`) using
   [`unified-engine`][unified-engine]
 
 **unified** is a project that validates and transforms content with abstract
 syntax trees (ASTs).
 @@ -58,7 +58,7 @@ various editors.
 
 ## Install
 
 This package is [ESM only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c).
 This package is [ESM only][].
 In Node.js (version 16.0+), install with [npm][]:
 
 ```sh
 @@ -162,11 +162,11 @@ Name of configuration files to load (`string`, optional).
 
 For examples, see the following projects:
 
 *   `redot-language-server`
     (coming soon)
 *   `rehype-language-server`
     (coming soon)
 *   [`remark-language-server`](https://github.com/remarkjs/remark-language-server)
 * `redot-language-server`
   (coming soon)
 * `rehype-language-server`
   (coming soon)
 * [`remark-language-server`](https://github.com/remarkjs/remark-language-server)
 
 ## Types
 
 @@ -187,39 +187,39 @@ change was made.
 Language servers created using this package implement the following language
 server features:
 
 *   `textDocument/codeAction`
     — the language server implements code actions based on the `expected` field
     on reported messages.
     A code action can either insert, replace, or delete text based on the range
     of the message and the expected value.
 *   `textDocument/didChange`
     — when a document is changed by the client, the language server processes it
     using a unified pipeline.
     Any messages collected are published to the client using
     `textDocument/publishDiagnostics`.
 *   `textDocument/didClose`
     — when a document is closed by the client, the language server resets
     diagnostics by publishing an empty array using
     `textDocument/publishDiagnostics`.
 *   `textDocument/didOpen`
     — when a document is opened by the client, the language server processes it
     using a unified pipeline.
     Any messages collected are published to the client using
     `textDocument/publishDiagnostics`.
 *   `textDocument/formatting`
     — when document formatting is requested by the client, the language server
     processes it using a unified pipeline.
     The stringified result is returned.
 *   `workspace/didChangeWatchedFiles` and `workspace/didChangeWorkspaceFolders`
     — when the client signals a watched file or workspace has changed, the
     language server processes all open files using a unified pipeline.
     Any messages collected are published to the client using
     `textDocument/publishDiagnostics`.
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
 
 *   `requireConfig` (default: `false`)
     — If true, files will only be checked if a configuration file is present.
 * `requireConfig` (default: `false`)
   — If true, files will only be checked if a configuration file is present.
 
 ## Compatibility
 
 @@ -234,10 +234,10 @@ It should work anywhere where LSP 3.6.0 or later is implemented.
 
 ## Related
 
 *   [`unified`](https://github.com/unifiedjs/unified)
     — create pipeline for working with syntax trees
 *   [`unified-args`](https://github.com/unifiedjs/unified-args)
     — create a CLI for a unified pipeline
 * [`unified`](https://github.com/unifiedjs/unified)
   — create pipeline for working with syntax trees
 * [`unified-args`](https://github.com/unifiedjs/unified-args)
   — create a CLI for a unified pipeline
 
 ## Contribute
 
 @@ -267,6 +267,8 @@ abide by its terms.
 
 [downloads]: https://www.npmjs.com/package/unified-language-server
 
 [esm only]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c
 
 [size-badge]: https://img.shields.io/bundlephobia/minzip/unified-language-server.svg
 
 [size]: https://bundlephobia.com/result?p=unified-language-server
