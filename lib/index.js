/**
 * @typedef {import('vfile-message').VFileMessage} VFileMessage
 * @typedef {import('unified-engine').Options} EngineOptions
 * @typedef {Pick<
 *   EngineOptions,
 *   | 'ignoreName'
 *   | 'packageField'
 *   | 'pluginPrefix'
 *   | 'plugins'
 *   | 'rcName'
 * >} EngineFields
 *
 * @typedef LanguageServerFields
 * @property {string} processorName
 *   The package ID of the expected processor (example: `'remark'`).
 *   Will be loaded from the local workspace.
 * @property {string} [processorSpecifier='default']
 *   The specifier to get the processor on the resolved module.
 *   For example, remark uses the specifier `remark` to expose its processor and
 *   a default export can be requested by passing `'default'` (the default).
 * @property {EngineOptions['processor']} [defaultProcessor]
 *   Optional fallback processor to use if `processorName` can’t be found
 *   locally in `node_modules`.
 *   This can be used to ship a processor with your package, to be used if no
 *   processor is found locally.
 *   If this isn’t passed, a warning is shown if `processorName` can’t be found.
 * @property {string} [configurationSection]
 *   This option will be used to give the client a hint of which configuration
 *   section to use.
 *   For example VSCode extensions use this to pick only settings that use this
 *   as a prefix in order to prevent conflicts and reduce the amount of data
 *   sent to the language server.
 *
 * @typedef {EngineFields & LanguageServerFields} Options
 *
 * @typedef UnifiedLanguageServerSettings
 * @property {boolean} requireConfig
 */

import path from 'node:path'
import {PassThrough} from 'node:stream'
import {fileURLToPath} from 'node:url'
import {findUp, pathExists} from 'find-up'
import {loadPlugin} from 'load-plugin'
import {engine} from 'unified-engine'
import {fromPosition} from 'unist-util-lsp'
import {VFile} from 'vfile'
import {
  createConnection,
  CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  Position,
  ProposedFeatures,
  Range,
  TextDocuments,
  TextDocumentSyncKind,
  TextEdit
} from 'vscode-languageserver/node.js'
import {TextDocument} from 'vscode-languageserver-textdocument'

/**
 * Convert a vfile message to a language server protocol diagnostic.
 *
 * @param {VFileMessage} message
 * @returns {Diagnostic}
 */
function vfileMessageToDiagnostic(message) {
  const diagnostic = Diagnostic.create(
    message.position
      ? fromPosition(message.position)
      : Range.create(0, 0, 0, 0),
    String(message.stack || message.reason),
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
    // type-coverage:ignore-next-line
    diagnostic.data = {
      expected: message.expected
    }
  }

  if (message.note) {
    diagnostic.message += '\n' + message.note
  }

  return diagnostic
}

/**
 * Convert language server protocol text document to a vfile.
 *
 * @param {TextDocument} document
 * @param {string} cwd
 * @returns {VFile}
 */
function lspDocumentToVfile(document, cwd) {
  return new VFile({
    cwd,
    path: new URL(document.uri),
    value: document.getText(),
    data: {lspDocumentUri: document.uri}
  })
}

/**
 * Create a language server for a unified ecosystem.
 *
 * @param {Options} options
 *   Configuration for `unified-engine` and the language server.
 */
export function createUnifiedLanguageServer({
  configurationSection,
  ignoreName,
  packageField,
  pluginPrefix,
  plugins,
  processorName,
  processorSpecifier = 'default',
  defaultProcessor,
  rcName
}) {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)
  /** @type {Set<string>} */
  const workspaces = new Set()
  /** @type {UnifiedLanguageServerSettings} */
  const globalSettings = {requireConfig: false}
  /** @type {Map<string, Promise<UnifiedLanguageServerSettings>>} */
  const documentSettings = new Map()
  let hasWorkspaceFolderCapability = false
  let hasConfigurationCapability = false

  /**
   * @param {string} scopeUri
   * @returns {Promise<UnifiedLanguageServerSettings>}
   */
  async function getDocumentSettings(scopeUri) {
    if (!hasConfigurationCapability) {
      return globalSettings
    }

    let result = documentSettings.get(scopeUri)
    if (!result) {
      result = connection.workspace
        .getConfiguration({scopeUri, section: configurationSection})
        .then((raw) => ({requireConfig: Boolean(raw.requireConfig)}))
      documentSettings.set(scopeUri, result)
    }

    return result
  }

  /**
   * @param {string} cwd
   * @param {VFile[]} files
   * @param {boolean} alwaysStringify
   * @param {boolean} ignoreUnconfigured
   * @returns {Promise<VFile[]>}
   */
  async function processWorkspace(
    cwd,
    files,
    alwaysStringify,
    ignoreUnconfigured
  ) {
    /** @type {EngineOptions['processor']} */
    let processor

    try {
      processor = /** @type {EngineOptions['processor']} */ (
        await loadPlugin(processorName, {
          cwd,
          key: processorSpecifier
        })
      )
    } catch (error) {
      const exception = /** @type {NodeJS.ErrnoException} */ (error)

      // Pass other funky errors through.
      /* c8 ignore next 3 */
      if (exception.code !== 'ERR_MODULE_NOT_FOUND') {
        throw error
      }

      if (!defaultProcessor) {
        connection.window.showInformationMessage(
          'Cannot turn on language server without `' +
            processorName +
            '` locally. Run `npm install ' +
            processorName +
            '` to enable it'
        )
        return []
      }

      connection.console.log(
        'Cannot find `' +
          processorName +
          '` locally but using `defaultProcessor`, original error:\n' +
          exception.stack
      )

      processor = defaultProcessor
    }

    return new Promise((resolve, reject) => {
      engine(
        {
          alwaysStringify,
          cwd,
          files,
          ignoreName,
          ignoreUnconfigured,
          packageField,
          pluginPrefix,
          plugins,
          processor,
          quiet: false,
          rcName,
          silentlyIgnore: true,
          streamError: new PassThrough(),
          streamOut: new PassThrough()
        },
        (error, _, context) => {
          // An error never occured and can’t be reproduced. This is an internal
          // error in unified-engine. If a plugin throws, it’s reported as a
          // vfile message.
          /* c8 ignore start */
          if (error) {
            reject(error)
          } else {
            resolve((context && context.files) || [])
          }
        }
      )
    })
  }
  /* c8 ignore stop */

  /**
   * Process various LSP text documents using unified and send back the
   * resulting messages as diagnostics.
   *
   * @param {TextDocument[]} textDocuments
   * @param {boolean} alwaysStringify
   * @returns {Promise<VFile[]>}
   */
  async function processDocuments(textDocuments, alwaysStringify = false) {
    // LSP uses `file:` URLs (hrefs), `unified-engine` expects a paths.
    // `process.cwd()` does not add a final slash, but `file:` URLs often do.
    const workspacesAsPaths = [...workspaces]
      .map((d) => d.replace(/[/\\]?$/, ''))
      // Sort the longest (closest to the file) first.
      .sort((a, b) => b.length - a.length)
    /** @type {Map<string, Array<VFile>>} */
    const workspacePathToFiles = new Map()
    /** @type {Map<string, Array<VFile>>} */
    const workspacePathToFilesRequireConfig = new Map()

    await Promise.all(
      textDocuments.map(async (textDocument) => {
        /** @type {string | undefined} */
        let cwd
        if (workspaces.size === 0) {
          cwd = await findUp(
            async (dir) => {
              const pkgExists = await pathExists(path.join(dir, 'package.json'))
              if (pkgExists) {
                return dir
              }

              const gitExists = await pathExists(path.join(dir, '.git'))
              if (gitExists) {
                return dir
              }
            },
            {
              cwd: path.dirname(fileURLToPath(textDocument.uri)),
              type: 'directory'
            }
          )
        } else {
          // Because the workspaces are sorted longest to shortest, the first
          // match is closest to the file.
          const ancestor = workspacesAsPaths.find((d) =>
            textDocument.uri.startsWith(d + '/')
          )
          if (ancestor) {
            cwd = fileURLToPath(ancestor)
          }
        }

        if (!cwd) return

        const configuration = await getDocumentSettings(textDocument.uri)

        const file = lspDocumentToVfile(textDocument, cwd)

        if (configuration.requireConfig) {
          const files = workspacePathToFilesRequireConfig.get(cwd) || []
          workspacePathToFilesRequireConfig.set(cwd, [...files, file])
        } else {
          const files = workspacePathToFiles.get(cwd) || []
          workspacePathToFiles.set(cwd, [...files, file])
        }
      })
    )

    /** @type {Array<Promise<Array<VFile>>>} */
    const promises = []

    for (const [cwd, files] of workspacePathToFiles) {
      promises.push(processWorkspace(cwd, files, alwaysStringify, false))
    }

    for (const [cwd, files] of workspacePathToFilesRequireConfig) {
      promises.push(processWorkspace(cwd, files, alwaysStringify, true))
    }

    const listsOfFiles = await Promise.all(promises)
    return listsOfFiles.flat()
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
      // All the vfiles we create have a `lspDocumentUri`.
      const uri = /** @type {string} */ (file.data.lspDocumentUri)

      connection.sendDiagnostics({
        uri,
        version: documentVersions.get(uri),
        diagnostics: file.messages.map((message) =>
          vfileMessageToDiagnostic(message)
        )
      })
    }
  }

  connection.onInitialize((event) => {
    if (event.workspaceFolders) {
      for (const workspace of event.workspaceFolders) {
        workspaces.add(workspace.uri)
      }
    }

    if (workspaces.size === 0 && event.rootUri) {
      workspaces.add(event.rootUri)
    }

    hasConfigurationCapability = Boolean(
      event.capabilities.workspace && event.capabilities.workspace.configuration
    )
    hasWorkspaceFolderCapability = Boolean(
      event.capabilities.workspace &&
        event.capabilities.workspace.workspaceFolders
    )

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        documentFormattingProvider: true,
        codeActionProvider: {
          codeActionKinds: [CodeActionKind.QuickFix],
          resolveProvider: true
        },
        workspace: hasWorkspaceFolderCapability
          ? {workspaceFolders: {supported: true, changeNotifications: true}}
          : undefined
      }
    }
  })

  connection.onInitialized(() => {
    if (hasConfigurationCapability) {
      connection.client.register(DidChangeConfigurationNotification.type)
    }

    if (hasWorkspaceFolderCapability) {
      connection.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const workspace of event.removed) {
          workspaces.delete(workspace.uri)
        }

        for (const workspace of event.added) {
          workspaces.add(workspace.uri)
        }

        checkDocuments(...documents.all())
      })
    }
  })

  connection.onDocumentFormatting(async (event) => {
    const document = documents.get(event.textDocument.uri)

    // This might happen if a client calls this function without synchronizing
    // the document first.
    if (!document) {
      return
    }

    const [file] = await processDocuments([document], true)

    if (!file) {
      return
    }

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

  // Send empty diagnostics for closed files.
  documents.onDidClose((event) => {
    const {uri, version} = event.document
    connection.sendDiagnostics({
      uri,
      version,
      diagnostics: []
    })
    documentSettings.delete(uri)
  })

  // Check everything again if the file system watched by the client changes.
  connection.onDidChangeWatchedFiles(() => {
    checkDocuments(...documents.all())
  })

  connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
      // Reset all cached document settings
      documentSettings.clear()
    } else {
      globalSettings.requireConfig = Boolean(change.settings.requireConfig)
    }

    // Revalidate all open text documents
    checkDocuments(...documents.all())
  })

  connection.onCodeAction((event) => {
    /** @type {CodeAction[]} */
    const codeActions = []

    const document = documents.get(event.textDocument.uri)

    // This might happen if a client calls this function without synchronizing
    // the document first.
    if (!document) {
      return
    }

    for (const diagnostic of event.context.diagnostics) {
      // type-coverage:ignore-next-line
      const data = /** @type {{expected?: unknown[]}} */ (diagnostic.data)
      if (typeof data !== 'object' || !data) {
        continue
      }

      const {expected} = data

      if (!Array.isArray(expected)) {
        continue
      }

      const {end, start} = diagnostic.range
      const actual = document.getText(diagnostic.range)

      for (const replacement of expected) {
        if (typeof replacement !== 'string') {
          continue
        }

        const codeAction = CodeAction.create(
          replacement
            ? start.line === end.line && start.character === end.character
              ? 'Insert `' + replacement + '`'
              : 'Replace `' + actual + '` with `' + replacement + '`'
            : 'Remove `' + actual + '`',
          {
            changes: {
              [document.uri]: [TextEdit.replace(diagnostic.range, replacement)]
            }
          },
          CodeActionKind.QuickFix
        )

        if (expected.length === 1) {
          codeAction.isPreferred = true
        }

        codeActions.push(codeAction)
      }
    }

    return codeActions
  })

  documents.listen(connection)
  connection.listen()
}
