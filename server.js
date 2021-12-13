import {PassThrough} from 'node:stream'
import {URL, pathToFileURL} from 'node:url'

import {unified} from 'unified'
import {engine} from 'unified-engine'
import {VFile} from 'vfile'
import {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
  TextDocumentSyncKind,
  TextEdit
} from 'vscode-languageserver/node.js'

const streamOut = new PassThrough()

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
 * @param {import('unist').Point?} point
 * @returns {boolean}
 */
function isValidUnistPoint(point) {
  return Boolean(
    point && Number.isInteger(point.line) && Number.isInteger(point.column)
  )
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
  if (position) {
    if (isValidUnistPoint(position.start)) {
      if (isValidUnistPoint(position.end)) {
        return Range.create(
          unistPointToLSPPosition(position.start),
          unistPointToLSPPosition(position.end)
        )
      }

      const start = unistPointToLSPPosition(position.start)
      return Range.create(start, start)
    }

    if (isValidUnistPoint(position.end)) {
      const end = unistPointToLSPPosition(position.end)
      return Range.create(end, end)
    }
  }

  return Range.create(0, 0, 0, 0)
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
    message.fatal === true
      ? DiagnosticSeverity.Error
      : message.fatal === false
      ? DiagnosticSeverity.Warning
      : DiagnosticSeverity.Information,
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
 * @param {import('vscode-languageserver').TextDocument} document
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
 * @param {import('vscode-languageserver').TextDocuments<import('vscode-languageserver-textdocument').TextDocument>} documents
 * @param {import('./index.js').UnifiedLanguageServerOptions} options
 */
export function configureUnifiedLanguageServer(
  connection,
  documents,
  {ignoreName, packageField, pluginPrefix, plugins, rcName, defaultSource}
) {
  /**
   * Process various LSP text documents using unified and send back the
   * resulting messages as diagnostics.
   *
   * @param {import('vscode-languageserver').TextDocument[]} textDocuments
   * @param {boolean} alwaysStringify
   * @returns {Promise<VFile[]>}
   */
  function processDocuments(textDocuments, alwaysStringify = false) {
    return new Promise((resolve, reject) => {
      engine(
        {
          alwaysStringify,
          files: textDocuments.map((document) => lspDocumentToVfile(document)),
          ignoreName,
          packageField,
          pluginPrefix,
          plugins,
          processor: unified(),
          quiet: false,
          rcName,
          silentlyIgnore: true,
          streamError: streamOut,
          streamOut
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
   * @param {import('vscode-languageserver').TextDocument[]} textDocuments
   */
  async function checkDocuments(...textDocuments) {
    const documentVersions = new Map(
      textDocuments.map((document) => [document.uri, document.version])
    )
    const files = await processDocuments(textDocuments)

    for (const file of files) {
      // VFile uses a file path, but LSP expects a file URL as a string.
      const uri = String(pathToFileURL(file.path))
      connection.sendDiagnostics({
        uri,
        version: documentVersions.get(uri),
        diagnostics: file.messages.map((message) =>
          vfileMessageToDiagnostic(message, defaultSource)
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

  documents.onDidClose(({document: {uri, version}}) => {
    connection.sendDiagnostics({
      uri,
      version,
      diagnostics: []
    })
  })
}
