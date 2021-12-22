/**
 * @typedef {Pick<
 *   import('unified-engine').Options,
 *   'ignoreName' | 'packageField' | 'pluginPrefix' | 'plugins' | 'rcName'
 * >} Options
 */

import {
  createConnection,
  ProposedFeatures,
  TextDocuments
} from 'vscode-languageserver/node.js'
import {TextDocument} from 'vscode-languageserver-textdocument'
import {configureUnifiedLanguageServer} from './lib/server.js'

/**
 * Create a language server for a unified ecosystem.
 *
 * @param {Options} options
 *   Configuration for `unified-engine` and the language server.
 */
export function createUnifiedLanguageServer(options) {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)

  configureUnifiedLanguageServer(connection, documents, options)

  documents.listen(connection)
  connection.listen()
}
