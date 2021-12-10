import {URL, pathToFileURL} from 'node:url'

import {unified} from 'unified'
import {engine} from 'unified-engine'
import {VFile} from 'vfile'
import {
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  Position,
  ProposedFeatures,
  Range,
  TextDocuments,
  TextDocumentSyncKind,
  TextEdit
} from 'vscode-languageserver/node.js'
import {TextDocument} from 'vscode-languageserver-textdocument'

/**
 * Convert a unist point to a language server protocol position.
 *
 * @param {import('unist').Point} point
 * @returns {Position}
 */
function unistPointToLSPPosition(point) {
  return Position.create(point.line - 1, point.column - 1)
}

/**
 * Convert a unist position to a language server protocol range.
 *
 * If no position is given, a range is returned  which represents the beginning
 * of the document.
 *
 * @param {import('unist').Position?} position
 * @returns {Range}
 */
function unistLocationToLSPRange(position) {
  if (!position) {
    return Range.create(0, 0, 0, 0)
  }

  const start = unistPointToLSPPosition(position.start)

  return Range.create(
    start,
    // Fall back to start if the end position contains null values
    position.end.line && position.end.column
      ? unistPointToLSPPosition(position.end)
      : start
  )
}

/**
 * Convert a vfile message to a language server protocol diagnostic.
 *
 * @param {import('vfile-message').VFileMessage} message
 * @param {string|undefined} defaultSource
 * @returns {Diagnostic}
 */
function vfileMessageToDiagnostic(message, defaultSource) {
  const diagnostic = Diagnostic.create(
    unistLocationToLSPRange(message.position),
    message.reason,
    message.fatal ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    message.ruleId || undefined,
    message.source || defaultSource
  )
  if (message.url) {
    diagnostic.codeDescription = {href: message.url}
  }

  return diagnostic
}

/**
 * Convert language server protocol text document to a vfile.
 *
 * @param {TextDocument} document
 * @returns {import('vfile').VFile}
 */
function lspDocumentToVfile(document) {
  return new VFile({
    // VFile expects a file path or file URL object, but LSP provides a file URI
    // as a string.
    path: new URL(document.uri),
    value: document.getText()
  })
}

/**
 * @param {import('vscode-languageserver').Connection} connection
 * @param {TextDocuments<TextDocument>} documents
 * @param {import('unified-engine').Options['plugins']} plugins
 * @param {string} prefix
 */
function initUnifiedLanguageServer(connection, documents, prefix, plugins) {
  /**
   * Process various LSP text documents using unified and send back the
   * resulting messages as diagnostics.
   *
   * @param {TextDocument[]} textDocuments
   * @param {boolean} alwaysStringify
   * @returns {Promise<VFile[]>}
   */
  function processDocuments(textDocuments, alwaysStringify = false) {
    return new Promise((resolve, reject) => {
      engine(
        {
          alwaysStringify,
          files: textDocuments.map((document) => lspDocumentToVfile(document)),
          ignoreName: '.' + prefix + 'ignore',
          packageField: prefix + 'Config',
          pluginPrefix: prefix,
          plugins,
          processor: unified(),
          rcName: '.' + prefix + 'rc',
          silentlyIgnore: true
        },
        (error, code, context) => {
          if (error) {
            reject(error)
          } else {
            resolve(context?.files ?? [])
          }
        }
      )
    })
  }

  /**
   * Process various LSP text documents using unified and send back the
   * resulting messages as diagnostics.
   *
   * @param {TextDocument[]} textDocuments
   */
  async function checkDocuments(...textDocuments) {
    const files = await processDocuments(textDocuments)

    for (const file of files) {
      connection.sendDiagnostics({
        // VFile uses a file path, but LSP expects a file URL as a string.
        uri: String(pathToFileURL(file.path)),
        diagnostics: file.messages.map((message) =>
          vfileMessageToDiagnostic(message, prefix)
        )
      })
    }
  }

  connection.onInitialize(() => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentFormattingProvider: true
    }
  }))

  connection.onDocumentFormatting(async ({textDocument: {uri}}) => {
    const document = documents.get(uri)
    if (!document) {
      return
    }

    const [file] = await processDocuments([document], true)
    const result = String(file)
    const text = document.getText()
    if (result === text) {
      return
    }

    const start = Position.create(0, 0)
    const end = document.positionAt(text.length)

    return [TextEdit.replace(Range.create(start, end), result)]
  })

  documents.onDidChangeContent(({document}) => {
    checkDocuments(document)
  })

  connection.onDidChangeConfiguration(() => {
    checkDocuments(...documents.all())
  })
}

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

initUnifiedLanguageServer(connection, documents, 'remark', [
  'remark-parse',
  'remark-stringify'
])

documents.listen(connection)
connection.listen()
