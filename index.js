import {
  createConnection,
  ProposedFeatures,
  TextDocuments
} from 'vscode-languageserver/node.js'
import {TextDocument} from 'vscode-languageserver-textdocument'
import {configureUnifiedLanguageServer} from './server.js'

/**
 * @typedef {Pick<
 *   import('unified-engine').Options,
 *   'ignoreName' | 'packageField' | 'pluginPrefix' | 'plugins' | 'rcName'
 * > & {
 *   defaultSource?: string
 * }} UnifiedLanguageServerOptions
 */

/**
 * @param {UnifiedLanguageServerOptions} options
 */
export function createUnifiedLanguageServer(options) {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)

  configureUnifiedLanguageServer(connection, documents, options)

  documents.listen(connection)
  connection.listen()
}
