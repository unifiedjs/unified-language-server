/**
 * @typedef {import('unist').Point} Point
 * @typedef {import('unist').Position} UnistPosition
 * @typedef {import('vfile-message').VFileMessage} VFileMessage
 * @typedef {import('vscode-languageserver').Connection} Connection
 * @typedef {Pick<
 *   import('unified-engine').Options,
 *   'ignoreName' | 'packageField' | 'pluginPrefix' | 'plugins' | 'rcName'
 * >} Options
 */

import {PassThrough} from 'node:stream'
import {URL, pathToFileURL} from 'node:url'

import {unified} from 'unified'
import {engine} from 'unified-engine'
import {VFile} from 'vfile'
import {
  createConnection,
  CodeAction,
  CodeActionKind,
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
 * @param {Point} point
 * @returns {Position}
 */
function unistPointToLspPosition(point) {
  return Position.create(point.line - 1, point.column - 1)
}

/**
 * @param {Point|null|undefined} point
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
 * @param {UnistPosition|null|undefined} position
 * @returns {Range}
 */
function unistLocationToLspRange(position) {
  if (position) {
    if (isValidUnistPoint(position.start)) {
      if (isValidUnistPoint(position.end)) {
        return Range.create(
          unistPointToLspPosition(position.start),
          unistPointToLspPosition(position.end)
        )
      }

      const start = unistPointToLspPosition(position.start)
      return Range.create(start, start)
    }

    if (isValidUnistPoint(position.end)) {
      const end = unistPointToLspPosition(position.end)
      return Range.create(end, end)
    }
  }

  return Range.create(0, 0, 0, 0)
}

/**
 * Convert a vfile message to a language server protocol diagnostic.
 *
 * @param {VFileMessage} message
 * @returns {Diagnostic}
 */
function vfileMessageToDiagnostic(message) {
  const diagnostic = Diagnostic.create(
    unistLocationToLspRange(message.position),
    message.reason,
    message.fatal === true
      ? DiagnosticSeverity.Error
      : message.fatal === false
      ? DiagnosticSeverity.Warning
      : DiagnosticSeverity.Information,
    message.ruleId || undefined,
    message.source || undefined
  )
  if (message.url) {
    diagnostic.codeDescription = {href: message.url}
  }

  if (message.expected) {
    diagnostic.data = {
      expected: message.expected
    }
  }

  return diagnostic
}

/**
 * Convert language server protocol text document to a vfile.
 *
 * @param {TextDocument} document
 * @returns {VFile}
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
 * @param {Connection} connection
 * @param {TextDocuments<TextDocument>} documents
 * @param {Options} options
 */
export function configureUnifiedLanguageServer(
  connection,
  documents,
  {ignoreName, packageField, pluginPrefix, plugins, rcName}
) {
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
          ignoreName,
          packageField,
          pluginPrefix,
          plugins,
          processor: unified(),
          quiet: false,
          rcName,
          silentlyIgnore: true,
          streamError: new PassThrough(),
          streamOut: new PassThrough()
        },
        (error, code, context) => {
          // An error never occur and can’t be reproduced. Thus us ab internal
          // error in unified-engine. If a plugin throws, it’s reported as a
          // vfile message.
          /* c8 ignore start */
          if (error) {
            reject(error)
          } else {
            resolve((context && context.files) || [])
          }
          /* c8 ignore end */
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
          vfileMessageToDiagnostic(message)
        )
      })
    }
  }

  connection.onInitialize(() => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentFormattingProvider: true,
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix],
        resolveProvider: true
      }
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

  documents.onDidChangeContent((event) => {
    checkDocuments(event.document)
  })

  documents.onDidClose((event) => {
    const {uri, version} = event.document
    connection.sendDiagnostics({
      uri,
      version,
      diagnostics: []
    })
  })

  connection.onDidChangeWatchedFiles(() => {
    checkDocuments(...documents.all())
  })

  connection.onCodeAction((event) => {
    /** @type {CodeAction[]} */
    const codeActions = []

    const document = documents.get(event.textDocument.uri)
    if (!document) {
      return
    }

    const text = document.getText()

    for (const diagnostic of event.context.diagnostics) {
      const {data} = diagnostic
      if (typeof data !== 'object' || !data) {
        continue
      }

      const {expected} = /** @type {{expected?: string[]}} */ (data)

      if (!Array.isArray(expected)) {
        continue
      }

      const {end, start} = diagnostic.range
      const actual = text.slice(
        document.offsetAt(start),
        document.offsetAt(end)
      )

      for (const replacement of expected) {
        codeActions.push(
          CodeAction.create(
            replacement
              ? start.line === end.line && start.character === end.character
                ? 'Insert `' + replacement + '`'
                : 'Replace `' + actual + '` with `' + replacement + '`'
              : 'Remove `' + actual + '`',
            {
              changes: {
                [document.uri]: [
                  TextEdit.replace(diagnostic.range, replacement)
                ]
              }
            },
            CodeActionKind.QuickFix
          )
        )
      }
    }

    return codeActions
  })
}

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
