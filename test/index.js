/**
 * @typedef {import('vscode-languageserver').ProtocolConnection} ProtocolConnection
 */

import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import test from 'tape'
import {
  createProtocolConnection,
  CodeActionRequest,
  DidChangeWorkspaceFoldersNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  DocumentFormattingRequest,
  LogMessageNotification,
  InitializeRequest,
  IPCMessageReader,
  IPCMessageWriter,
  PublishDiagnosticsNotification,
  ShowMessageRequest
} from 'vscode-languageserver/node.js'

test('`initialize`', async (t) => {
  const connection = startLanguageServer(t, 'remark.js')
  const initializeResponse = await connection.sendRequest(
    InitializeRequest.type,
    {
      processId: null,
      rootUri: null,
      capabilities: {},
      workspaceFolders: null
    }
  )

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
  const connection = startLanguageServer(t, 'remark.js')

  const initializeResponse = await connection.sendRequest(
    InitializeRequest.type,
    {
      processId: null,
      rootUri: null,
      capabilities: {workspace: {workspaceFolders: true}},
      workspaceFolders: null
    }
  )

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
  const connection = startLanguageServer(t, 'remark-with-warnings.js')
  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })
  const uri = new URL('lsp.md', import.meta.url).href

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
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

  const closeDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidCloseTextDocumentNotification.type, {
    textDocument: {uri}
  })
  const closeDiagnostics = await closeDiagnosticsPromise

  t.deepEqual(
    closeDiagnostics,
    {uri, version: 1, diagnostics: []},
    'should emit empty diagnostics on `textDocument/didClose`'
  )
})

test('uninstalled processor so `window/showMessageRequest`', async (t) => {
  const connection = startLanguageServer(t, 'missing-package.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const messageRequestPromise = createOnRequestPromise(
    connection,
    ShowMessageRequest.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('lsp.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
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
  const connection = startLanguageServer(t, 'missing-package-with-default.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const logPromise = createOnNotificationPromise(
    connection,
    LogMessageNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('lsp.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
  const log = await logPromise

  t.deepEqual(
    cleanStack(log.message, 2).replace(/(imported from )[^\r\n]+/, '$1zzz'),
    "Cannot find `xxx-missing-yyy` locally but using `defaultProcessor`, original error:\nError: Cannot find package 'xxx-missing-yyy' imported from zzz",
    'should work w/ `defaultProcessor`'
  )
})

test('`textDocument/formatting`', async (t) => {
  const connection = startLanguageServer(t, 'remark.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('bad.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '   #   hi  \n'
    }
  })

  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('good.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi\n'
    }
  })

  const resultBad = await connection.sendRequest(
    DocumentFormattingRequest.type,
    {
      textDocument: {uri: new URL('bad.md', import.meta.url).href},
      options: {tabSize: 2, insertSpaces: true}
    }
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

  const resultGood = await connection.sendRequest(
    DocumentFormattingRequest.type,
    {
      textDocument: {uri: new URL('good.md', import.meta.url).href},
      options: {tabSize: 2, insertSpaces: true}
    }
  )
  t.deepEqual(
    resultGood,
    null,
    'should format good documents on `textDocument/formatting`'
  )

  const resultUnknown = await connection.sendRequest(
    DocumentFormattingRequest.type,
    {
      textDocument: {uri: new URL('unknown.md', import.meta.url).href},
      options: {tabSize: 2, insertSpaces: true}
    }
  )
  t.deepEqual(
    resultUnknown,
    null,
    'should ignore unsynchronized documents on `textDocument/formatting`'
  )

  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('../../outside.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '   #   hi  \n'
    }
  })

  const resultOutside = await connection.sendRequest(
    DocumentFormattingRequest.type,
    {
      textDocument: {
        uri: new URL('../../outside.md', import.meta.url).href
      },
      options: {tabSize: 2, insertSpaces: true}
    }
  )
  t.deepEqual(
    resultOutside,
    null,
    'should ignore documents outside of workspace on `textDocument/formatting`'
  )
})

test('`workspace/didChangeWatchedFiles`', async (t) => {
  const connection = startLanguageServer(t, 'remark.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('a.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
  await openDiagnosticsPromise

  const changeWatchDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification('workspace/didChangeWatchedFiles', {changes: []})
  const changeWatchDiagnostics = await changeWatchDiagnosticsPromise

  t.deepEqual(
    changeWatchDiagnostics,
    {uri: new URL('a.md', import.meta.url).href, version: 1, diagnostics: []},
    'should emit diagnostics for registered files on any `workspace/didChangeWatchedFiles`'
  )
})

test('`initialize`, `textDocument/didOpen` (and a broken plugin)', async (t) => {
  const connection = startLanguageServer(t, 'remark-with-error.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('lsp.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
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
  const connection = startLanguageServer(t, 'code-actions.js')
  const uri = new URL('lsp.md', import.meta.url).href

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri,
      languageId: 'markdown',
      version: 1,
      text: 'actual content'
    }
  })
  const openDiagnostics = await openDiagnosticsPromise

  const codeActions = await connection.sendRequest(CodeActionRequest.type, {
    textDocument: {uri},
    range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
    context: {
      diagnostics: openDiagnostics.diagnostics
    }
  })

  t.deepEqual(
    codeActions,
    [
      {
        title: 'Insert `insert me`',
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: {line: 0, character: 0},
                  end: {line: 0, character: 0}
                },
                newText: 'insert me'
              }
            ]
          }
        },
        kind: 'quickfix',
        isPreferred: true
      },
      {
        title: 'Replace `actual` with `replacement`',
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: {line: 0, character: 0},
                  end: {line: 0, character: 6}
                },
                newText: 'replacement'
              }
            ]
          }
        },
        kind: 'quickfix',
        isPreferred: true
      },
      {
        title: 'Remove `actual`',
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: {line: 0, character: 0},
                  end: {line: 0, character: 6}
                },
                newText: ''
              }
            ]
          }
        },
        kind: 'quickfix',
        isPreferred: true
      },
      {
        title: 'Replace `actual` with `alternative a`',
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: {line: 0, character: 0},
                  end: {line: 0, character: 6}
                },
                newText: 'alternative a'
              }
            ]
          }
        },
        kind: 'quickfix'
      },
      {
        title: 'Replace `actual` with `alternative b`',
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: {line: 0, character: 0},
                  end: {line: 0, character: 6}
                },
                newText: 'alternative b'
              }
            ]
          }
        },
        kind: 'quickfix'
      }
    ],
    'should emit quick fixes on a `textDocument/codeAction`'
  )

  const closedCodeActions = await connection.sendRequest(
    CodeActionRequest.type,
    {
      textDocument: {uri: new URL('closed.md', import.meta.url).href},
      range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
      context: {diagnostics: []}
    }
  )
  t.equal(
    closedCodeActions,
    null,
    'should not emit quick fixes for unsynchronized documents'
  )
})

test('`initialize` w/ nothing (finds closest `package.json`)', async (t) => {
  const cwd = new URL('..', import.meta.url)
  const connection = startLanguageServer(
    t,
    'remark-with-cwd.js',
    fileURLToPath(cwd)
  )

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('folder-with-package-json/folder/file.md', import.meta.url)
        .href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
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

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('folder-with-git/folder/file.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
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

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: cwd.href,
    capabilities: {},
    workspaceFolders: []
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('lsp.md', cwd).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
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

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: [
      {uri: processCwd.href, name: ''}, // Farthest
      {uri: otherCwd.href, name: ''} // Nearest
    ]
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('lsp.md', otherCwd).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
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

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {workspace: {workspaceFolders: true}},
    workspaceFolders: [{uri: processCwd.href, name: ''}]
  })

  connection.sendNotification('initialized', {})

  const otherCwd = new URL('folder/', processCwd)

  const openDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('lsp.md', otherCwd).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
  const openDiagnostics = await openDiagnosticsPromise
  t.equal(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(processCwd).slice(0, -1)
  )

  const didAddDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidChangeWorkspaceFoldersNotification.type, {
    event: {added: [{uri: otherCwd.href, name: ''}], removed: []}
  })
  const didAddDiagnostics = await didAddDiagnosticsPromise
  t.equal(
    didAddDiagnostics.diagnostics[0].message,
    fileURLToPath(otherCwd).slice(0, -1)
  )

  const didRemoveDiagnosticsPromise = createOnNotificationPromise(
    connection,
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidChangeWorkspaceFoldersNotification.type, {
    event: {added: [], removed: [{uri: otherCwd.href, name: ''}]}
  })
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
 * @param cwd The cwd to use for the process relative to this test file.
 * @returns a jsonrpc connection.
 */
function startLanguageServer(t, serverFilePath, cwd = '.') {
  const proc = spawn(
    'node',
    [
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        serverFilePath
      ),
      '--node-ipc'
    ],
    {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), cwd),
      stdio: [null, 'inherit', 'inherit', 'ipc']
    }
  )
  const connection = createProtocolConnection(
    new IPCMessageReader(proc),
    new IPCMessageWriter(proc)
  )
  t.teardown(() => {
    connection.end()
    proc.kill()
  })
  connection.listen()
  return connection
}

/**
 * Wait for an event type to be omitted.
 *
 * @template ReturnType
 * @param {ProtocolConnection} connection
 * @param {import('vscode-languageserver').NotificationType<ReturnType>} type
 * @returns {Promise<ReturnType>}
 */
async function createOnNotificationPromise(connection, type) {
  return new Promise((resolve) => {
    const disposable = connection.onNotification(type, (result) => {
      disposable.dispose()
      setTimeout(() => resolve(result), 0)
    })
  })
}

/**
 * Wait for a request to be sent from the server to the client.
 *
 * @template Params
 * @param {ProtocolConnection} connection
 * @param {import('vscode-languageserver').RequestType<Params, any, any>} type
 * @returns {Promise<Params>}
 */
async function createOnRequestPromise(connection, type) {
  return new Promise((resolve) => {
    const disposable = connection.onRequest(type, (result) => {
      disposable.dispose()
      resolve(result)
    })
  })
}
