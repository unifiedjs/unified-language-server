/**
 * @typedef {import('node:child_process').ExecException & {stdout: string, stderr: string}} ExecError
 * @typedef {import('vscode-jsonrpc').MessageConnection} MessageConnection
 * @typedef {import('vscode-languageserver').CodeAction} CodeAction
 * @typedef {import('vscode-languageserver').CodeActionParams} CodeActionParams
 * @typedef {import('vscode-languageserver').DidChangeWorkspaceFoldersParams} DidChangeWorkspaceFoldersParams
 * @typedef {import('vscode-languageserver').DidCloseTextDocumentParams} DidCloseTextDocumentParams
 * @typedef {import('vscode-languageserver').DidOpenTextDocumentParams} DidOpenTextDocumentParams
 * @typedef {import('vscode-languageserver').DocumentFormattingParams} DocumentFormattingParams
 * @typedef {import('vscode-languageserver').InitializeParams} InitializeParams
 * @typedef {import('vscode-languageserver').InitializeResult<never>} InitializeResult
 * @typedef {import('vscode-languageserver').InitializedParams} InitializedParams
 * @typedef {import('vscode-languageserver').LogMessageParams} LogMessageParams
 * @typedef {import('vscode-languageserver').PublishDiagnosticsParams} PublishDiagnosticsParams
 * @typedef {import('vscode-languageserver').ShowMessageRequestParams} ShowMessageRequestParams
 * @typedef {import('vscode-languageserver').TextEdit} TextEdit
 */

import {promises as fs} from 'node:fs'
import {spawn} from 'node:child_process'
import path from 'node:path'
import {URL, fileURLToPath} from 'node:url'
import test from 'tape'

import * as exports from 'unified-language-server'
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter
} from 'vscode-jsonrpc/node.js'

test('exports', (t) => {
  t.equal(typeof exports.createUnifiedLanguageServer, 'function')

  t.end()
})

test('`initialize`', async (t) => {
  const connection = startLanguageServer(t, 'remark.js', '.')
  const initializeResponse = await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  t.deepEqual(
    initializeResponse,
    {
      capabilities: {
        textDocumentSync: 1,
        documentFormattingProvider: true,
        codeActionProvider: {
          codeActionKinds: ['quickfix'],
          resolveProvider: true
        }
      }
    },
    'should emit an introduction on `initialize`'
  )
})

test('`initialize` workspace capabilities', async (t) => {
  const connection = startLanguageServer(t, 'remark.js', '.')

  const initializeResponse = await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {workspace: {workspaceFolders: true}},
    workspaceFolders: null
  })

  t.deepEqual(
    initializeResponse,
    {
      capabilities: {
        textDocumentSync: 1,
        documentFormattingProvider: true,
        codeActionProvider: {
          codeActionKinds: ['quickfix'],
          resolveProvider: true
        },
        workspace: {
          workspaceFolders: {supported: true, changeNotifications: true}
        }
      }
    },
    'should emit an introduction on `initialize`'
  )
})

test('`textDocument/didOpen`, `textDocument/didClose` (and diagnostics)', async (t) => {
  const connection = startLanguageServer(t, 'remark-with-warnings.js', '.')
  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })
  const uri = new URL('lsp.md', import.meta.url).href

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const openDiagnostics = await openDiagnosticsPromise

  t.deepEqual(
    openDiagnostics,
    {
      uri,
      version: 1,
      diagnostics: [
        {
          range: {start: {line: 0, character: 0}, end: {line: 0, character: 4}},
          message: 'info',
          severity: 3
        },
        {
          range: {start: {line: 0, character: 0}, end: {line: 0, character: 4}},
          message: 'warning',
          severity: 2
        },
        {
          range: {start: {line: 0, character: 2}, end: {line: 0, character: 4}},
          message: 'error',
          severity: 1,
          code: 'a',
          source: 'b',
          codeDescription: {href: 'd'},
          data: {expected: ['hello']}
        },
        {
          range: {start: {line: 1, character: 2}, end: {line: 1, character: 3}},
          message: 'node',
          severity: 2
        },
        {
          range: {start: {line: 1, character: 2}, end: {line: 1, character: 3}},
          message: 'position',
          severity: 2
        },
        {
          range: {start: {line: 1, character: 2}, end: {line: 1, character: 2}},
          message: 'point',
          severity: 2
        },
        {
          range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
          message: 'nothing',
          severity: 2
        },
        {
          range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
          message: 'note\nThese are some additional notes',
          severity: 2
        }
      ]
    },
    'should emit diagnostics on `textDocument/didOpen`'
  )

  const closeDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didClose',
    /** @type {DidCloseTextDocumentParams} */
    ({textDocument: {uri, version: 1}})
  )
  const closeDiagnostics = await closeDiagnosticsPromise

  t.deepEqual(
    closeDiagnostics,
    {uri, version: 1, diagnostics: []},
    'should emit empty diagnostics on `textDocument/didClose`'
  )
})

test('uninstalled processor so `window/showMessageRequest`', async (t) => {
  const connection = startLanguageServer(t, 'missing-package.js', '.')

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const messageRequestPromise = createMessageRequestPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('lsp.md', import.meta.url).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const messageRequest = await messageRequestPromise

  t.deepEqual(
    messageRequest,
    {
      type: 3,
      message:
        'Cannot turn on language server without `xxx-missing-yyy` locally. Run `npm install xxx-missing-yyy` to enable it',
      actions: []
    },
    'should emit a `window/showMessageRequest` when the processor can’t be found locally'
  )
})

test('uninstalled processor w/ `defaultProcessor`', async (t) => {
  const connection = startLanguageServer(
    t,
    'missing-package-with-default.js',
    '.'
  )

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const logPromise = createLogPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('lsp.md', import.meta.url).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const log = await logPromise

  t.deepEqual(
    cleanStack(log.message, 2).replace(/(imported from )[^\r\n]+/, '$1zzz'),
    "Cannot find `xxx-missing-yyy` locally but using `defaultProcessor`, original error:\nError [ERR_MODULE_NOT_FOUND]: Cannot find package 'xxx-missing-yyy' imported from zzz",
    'should work w/ `defaultProcessor`'
  )
})

test('`textDocument/formatting`', async (t) => {
  const connection = startLanguageServer(t, 'remark.js', '.')

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('bad.md', import.meta.url).href,
        languageId: 'markdown',
        version: 1,
        text: '   #   hi  \n'
      }
    })
  )

  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('good.md', import.meta.url).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi\n'
      }
    })
  )

  /** @type {TextEdit} */
  const resultBad = await connection.sendRequest(
    'textDocument/formatting',
    /** @type {DocumentFormattingParams} */
    ({
      textDocument: {uri: new URL('bad.md', import.meta.url).href},
      options: {tabSize: 2, insertSpaces: true}
    })
  )
  t.deepEqual(
    resultBad,
    [
      {
        range: {start: {line: 0, character: 0}, end: {line: 1, character: 0}},
        newText: '# hi\n'
      }
    ],
    'should format bad documents on `textDocument/formatting`'
  )

  /** @type {null} */
  const resultGood = await connection.sendRequest(
    'textDocument/formatting',
    /** @type {DocumentFormattingParams} */
    ({
      textDocument: {uri: new URL('good.md', import.meta.url).href},
      options: {tabSize: 2, insertSpaces: true}
    })
  )
  t.deepEqual(
    resultGood,
    null,
    'should format good documents on `textDocument/formatting`'
  )

  /** @type {null} */
  const resultUnknown = await connection.sendRequest(
    'textDocument/formatting',
    /** @type {DocumentFormattingParams} */
    ({
      textDocument: {uri: new URL('unknown.md', import.meta.url).href},
      options: {tabSize: 2, insertSpaces: true}
    })
  )
  t.deepEqual(
    resultUnknown,
    null,
    'should ignore unsynchronized documents on `textDocument/formatting`'
  )
})

test('`workspace/didChangeWatchedFiles`', async (t) => {
  const connection = startLanguageServer(t, 'remark.js', '.')

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('a.md', import.meta.url).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  await openDiagnosticsPromise

  const changeWatchDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification('workspace/didChangeWatchedFiles', {changes: []})
  const changeWatchDiagnostics = await changeWatchDiagnosticsPromise

  t.deepEqual(
    changeWatchDiagnostics,
    {uri: new URL('a.md', import.meta.url).href, version: 1, diagnostics: []},
    'should emit diagnostics for registered files on any `workspace/didChangeWatchedFiles`'
  )
})

test('`initialize`, `textDocument/didOpen` (and a broken plugin)', async (t) => {
  const connection = startLanguageServer(t, 'remark-with-error.js', '.')

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('lsp.md', import.meta.url).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const openDiagnostics = await openDiagnosticsPromise

  t.deepEqual(
    openDiagnostics.diagnostics.map(({message, ...rest}) => ({
      message: cleanStack(message, 3),
      ...rest
    })),
    [
      {
        message:
          'Error: Whoops!\n    at Function.oneError (one-error.js:1:1)\n    at Function.freeze (index.js:1:1)',
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        severity: 1
      }
    ],
    'should show stack traces on crashes'
  )
})

test('`textDocument/codeAction` (and diagnostics)', async (t) => {
  const connection = startLanguageServer(t, 'remark.js', '.')
  const uri = new URL('lsp.md', import.meta.url).href

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri,
        languageId: 'markdown',
        version: 1,
        text: '## hello'
      }
    })
  )
  await openDiagnosticsPromise

  /** @type {CodeAction} */
  const codeActions = await connection.sendRequest(
    'textDocument/codeAction',
    /** @type {CodeActionParams} */
    ({
      textDocument: {uri},
      range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
      context: {
        diagnostics: [
          // Coverage for warnings w/o `data` (which means a message w/o `expected`).
          {
            message: 'warning',
            severity: 2,
            range: {
              start: {line: 0, character: 3},
              end: {line: 0, character: 0}
            }
          },
          {
            message: 'warning',
            severity: 2,
            data: {},
            range: {
              start: {line: 0, character: 3},
              end: {line: 0, character: 8}
            }
          },
          // Replacement:
          {
            message: 'warning',
            severity: 2,
            data: {expected: ['Hello']},
            range: {
              start: {line: 0, character: 3},
              end: {line: 0, character: 8}
            }
          },
          // Insertion (start and end in the same place):
          {
            message: 'warning',
            severity: 2,
            data: {expected: ['!']},
            range: {
              start: {line: 0, character: 8},
              end: {line: 0, character: 8}
            }
          },
          // Deletion (empty `expected`):
          {
            message: 'warning',
            severity: 2,
            data: {expected: ['']},
            range: {
              start: {line: 0, character: 1},
              end: {line: 0, character: 2}
            }
          }
        ]
      }
    })
  )

  t.deepEqual(
    codeActions,
    [
      {
        title: 'Replace `hello` with `Hello`',
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: {line: 0, character: 3},
                  end: {line: 0, character: 8}
                },
                newText: 'Hello'
              }
            ]
          }
        },
        kind: 'quickfix'
      },
      {
        title: 'Insert `!`',
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: {line: 0, character: 8},
                  end: {line: 0, character: 8}
                },
                newText: '!'
              }
            ]
          }
        },
        kind: 'quickfix'
      },
      {
        title: 'Remove `#`',
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: {line: 0, character: 1},
                  end: {line: 0, character: 2}
                },
                newText: ''
              }
            ]
          }
        },
        kind: 'quickfix'
      }
    ],
    'should emit quick fixes on a `textDocument/codeAction`'
  )
})

test('`initialize` w/ nothing (finds closest `package.json`)', async (t) => {
  const cwd = new URL('..', import.meta.url)
  const connection = startLanguageServer(
    t,
    'remark-with-cwd.js',
    fileURLToPath(cwd)
  )

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('folder-with-package-json/folder/file.md', import.meta.url)
          .href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const openDiagnostics = await openDiagnosticsPromise

  t.deepEqual(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(new URL('folder-with-package-json', import.meta.url).href),
    'should default to a `cwd` of the parent folder of the closest `package.json`'
  )
})

test('`initialize` w/ nothing (find closest `.git`)', async (t) => {
  const cwd = new URL('..', import.meta.url)
  const connection = startLanguageServer(
    t,
    'remark-with-cwd.js',
    fileURLToPath(cwd)
  )
  await fs.mkdir(new URL('folder-with-git/.git', import.meta.url), {
    recursive: true
  })

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('folder-with-git/folder/file.md', import.meta.url).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const openDiagnostics = await openDiagnosticsPromise

  t.deepEqual(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(new URL('folder-with-git', import.meta.url).href),
    'should default to a `cwd` of the parent folder of the closest `.git`'
  )
})

test('`initialize` w/ `rootUri`', async (t) => {
  const cwd = new URL('folder/', import.meta.url)
  const processCwd = new URL('..', cwd)
  const connection = startLanguageServer(
    t,
    'remark-with-cwd.js',
    fileURLToPath(processCwd)
  )

  await initialize(connection, {
    processId: null,
    rootUri: cwd.href,
    capabilities: {},
    workspaceFolders: []
  })

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('lsp.md', cwd).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const openDiagnostics = await openDiagnosticsPromise

  t.deepEqual(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(cwd).slice(0, -1),
    'should use `rootUri`'
  )
})

test('`initialize` w/ `workspaceFolders`', async (t) => {
  const processCwd = new URL('.', import.meta.url)
  const connection = startLanguageServer(
    t,
    'remark-with-cwd.js',
    fileURLToPath(processCwd)
  )

  const otherCwd = new URL('folder/', processCwd)

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: [
      {uri: processCwd.href, name: ''}, // Farthest
      {uri: otherCwd.href, name: ''} // Nearest
    ]
  })

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('lsp.md', otherCwd).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const openDiagnostics = await openDiagnosticsPromise

  t.deepEqual(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(otherCwd).slice(0, -1),
    'should use `workspaceFolders`'
  )
})

test('`workspace/didChangeWorkspaceFolders`', async (t) => {
  t.timeoutAfter(3_600_000)
  const processCwd = new URL('.', import.meta.url)

  const connection = startLanguageServer(
    t,
    'remark-with-cwd.js',
    fileURLToPath(processCwd)
  )

  await initialize(connection, {
    processId: null,
    rootUri: null,
    capabilities: {workspace: {workspaceFolders: true}},
    workspaceFolders: [{uri: processCwd.href, name: ''}]
  })

  await new Promise((resolve) => {
    connection.onRequest('client/registerCapability', resolve)
    connection.sendNotification('initialized', {})
  })

  const otherCwd = new URL('./folder/', processCwd)

  const openDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'textDocument/didOpen',
    /** @type {DidOpenTextDocumentParams} */
    ({
      textDocument: {
        uri: new URL('lsp.md', otherCwd).href,
        languageId: 'markdown',
        version: 1,
        text: '# hi'
      }
    })
  )
  const openDiagnostics = await openDiagnosticsPromise
  t.equal(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(processCwd).slice(0, -1)
  )

  const didAddDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'workspace/didChangeWorkspaceFolders',
    /** @type {DidChangeWorkspaceFoldersParams} */
    ({event: {added: [{uri: otherCwd.href, name: ''}], removed: []}})
  )
  const didAddDiagnostics = await didAddDiagnosticsPromise
  t.equal(
    didAddDiagnostics.diagnostics[0].message,
    fileURLToPath(otherCwd).slice(0, -1)
  )

  const didRemoveDiagnosticsPromise = createDiagnosticsPromise(connection)
  connection.sendNotification(
    'workspace/didChangeWorkspaceFolders',
    /** @type {DidChangeWorkspaceFoldersParams} */
    ({event: {added: [], removed: [{uri: otherCwd.href, name: ''}]}})
  )
  const didRemoveDiagnostics = await didRemoveDiagnosticsPromise
  t.equal(
    didRemoveDiagnostics.diagnostics[0].message,
    fileURLToPath(processCwd).slice(0, -1)
  )
})

/**
 * @param {string} stack
 * @param {number} max
 * @returns {string}
 */
function cleanStack(stack, max) {
  return stack
    .replace(/\(.+\//g, '(')
    .replace(/\d+:\d+/g, '1:1')
    .split('\n')
    .slice(0, max)
    .join('\n')
}

/**
 * Start a language server.
 *
 * It will be cleaned up automatically.
 *
 * Any `window/logMessage` events emitted by the language server will be logged
 * to the console.
 *
 * @param {test.Test} t The test context to use for cleanup.
 * @param {string} serverFilePath The path to the language server relative to
 * this test file.
 * @param {string} cwd The cwd to use for the process relative to this test
 * file.
 * @returns a jsonrpc connection.
 */
function startLanguageServer(t, serverFilePath, cwd) {
  const proc = spawn(
    'node',
    [
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        serverFilePath
      ),
      '--stdio'
    ],
    {cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), cwd)}
  )
  const connection = createMessageConnection(
    new StreamMessageReader(proc.stdout),
    new StreamMessageWriter(proc.stdin)
  )
  t.teardown(() => {
    connection.end()
  })
  connection.onNotification(
    'window/logMessage',
    /**
     * @param {LogMessageParams} message
     */
    ({message}) => {
      console.dir(message)
    }
  )
  connection.listen()
  return connection
}

/**
 * Initialize a language server in a type-safe manner.
 *
 * @param {MessageConnection} connection
 * @param {InitializeParams} parameters
 * @returns {Promise<InitializeResult>}
 */
async function initialize(connection, parameters) {
  return connection.sendRequest('initialize', parameters)
}

/**
 * Wait for an event name to be omitted.
 *
 * @param {MessageConnection} connection
 * @param {string} name
 * @returns {Promise<any>}
 */
async function createNotificationPromise(connection, name) {
  return new Promise((resolve) => {
    const disposable = connection.onNotification(
      name,
      /**
       * @param result {unknown}
       */
      (result) => {
        disposable.dispose()
        setTimeout(() => resolve(result), 0)
      }
    )
  })
}

/**
 * Wait for a diagnostic to be omitted.
 *
 * @param {MessageConnection} connection
 * @returns {Promise<PublishDiagnosticsParams>}
 */
async function createDiagnosticsPromise(connection) {
  return createNotificationPromise(
    connection,
    'textDocument/publishDiagnostics'
  )
}

/**
 * Wait for a diagnostic to be omitted.
 *
 * @param {MessageConnection} connection
 * @returns {Promise<LogMessageParams>}
 */
async function createLogPromise(connection) {
  return createNotificationPromise(connection, 'window/logMessage')
}

/**
 * Wait for a show message request to be omitted.
 *
 * @param {MessageConnection} connection
 * @returns {Promise<ShowMessageRequestParams>}
 */
async function createMessageRequestPromise(connection) {
  return new Promise((resolve) => {
    const disposable = connection.onRequest(
      'window/showMessageRequest',
      /**
       * @param result {ShowMessageRequestParams}
       */
      (result) => {
        disposable.dispose()
        setTimeout(() => resolve(result), 0)
      }
    )
  })
}
