/**
 * @typedef {import('vscode-languageserver').ConfigurationParams} ConfigurationParams
 * @typedef {import('vscode-languageserver').ProtocolConnection} ProtocolConnection
 * @typedef {import('../lib/index.js').UnifiedLanguageServerSettings} UnifiedLanguageServerSettings
 */

import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import {afterEach, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {
  createProtocolConnection,
  CodeActionRequest,
  ConfigurationRequest,
  DidChangeConfigurationNotification,
  DidChangeWorkspaceFoldersNotification,
  DidChangeWatchedFilesNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  DocumentFormattingRequest,
  LogMessageNotification,
  InitializedNotification,
  InitializeRequest,
  IPCMessageReader,
  IPCMessageWriter,
  PublishDiagnosticsNotification,
  RegistrationRequest,
  ShowMessageRequest
} from 'vscode-languageserver/node.js'

/** @type {ProtocolConnection} */
let connection

afterEach(() => {
  connection.dispose()
})

test('`initialize`', async () => {
  startLanguageServer('remark.js')
  const initializeResponse = await connection.sendRequest(
    InitializeRequest.type,
    {
      processId: null,
      rootUri: null,
      capabilities: {},
      workspaceFolders: null
    }
  )

  assert.deepEqual(
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

test('`initialize` workspace capabilities', async () => {
  startLanguageServer('remark.js')

  const initializeResponse = await connection.sendRequest(
    InitializeRequest.type,
    {
      processId: null,
      rootUri: null,
      capabilities: {workspace: {workspaceFolders: true}},
      workspaceFolders: null
    }
  )

  assert.deepEqual(
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

test('`textDocument/didOpen`, `textDocument/didClose` (and diagnostics)', async () => {
  startLanguageServer('remark-with-warnings.js')
  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })
  const uri = new URL('lsp.md', import.meta.url).href

  const openDiagnosticsPromise = createOnNotificationPromise(
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

  assert.deepEqual(
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
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidCloseTextDocumentNotification.type, {
    textDocument: {uri}
  })
  const closeDiagnostics = await closeDiagnosticsPromise

  assert.deepEqual(
    closeDiagnostics,
    {uri, version: 1, diagnostics: []},
    'should emit empty diagnostics on `textDocument/didClose`'
  )
})

test('workspace configuration `requireConfig`', async () => {
  startLanguageServer('remark-with-warnings.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {
      workspace: {configuration: true}
    },
    workspaceFolders: null
  })
  await new Promise((resolve) => {
    connection.onRequest(RegistrationRequest.type, resolve)
    connection.sendNotification(InitializedNotification.type, {})
  })

  /** @type {ConfigurationParams | undefined} */
  let configRequest
  let requireConfig = false
  connection.onRequest(ConfigurationRequest.type, (request) => {
    configRequest = request
    return [{requireConfig}]
  })
  const uri = new URL('lsp.md', import.meta.url).href

  const openDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {uri, languageId: 'markdown', version: 1, text: '# hi'}
  })
  const openDiagnostics = await openDiagnosticsPromise
  assert.notEqual(
    openDiagnostics.diagnostics.length,
    0,
    'should emit diagnostics on `textDocument/didOpen`'
  )
  assert.deepEqual(
    configRequest,
    {items: [{scopeUri: uri, section: 'remark'}]},
    'should request configurations for the open file'
  )

  configRequest = undefined
  const cachedOpenDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {uri, languageId: 'markdown', version: 1, text: '# hi'}
  })
  await cachedOpenDiagnosticsPromise
  assert.equal(
    configRequest,
    undefined,
    'should cache workspace configurations'
  )

  const closeDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidCloseTextDocumentNotification.type, {
    textDocument: {uri}
  })
  await closeDiagnosticsPromise
  const reopenDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {uri, languageId: 'markdown', version: 1, text: '# hi'}
  })
  await reopenDiagnosticsPromise
  assert.deepEqual(
    configRequest,
    {items: [{scopeUri: uri, section: 'remark'}]},
    'should clear the cache if the file is opened'
  )

  configRequest = undefined
  const changeConfigurationDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  requireConfig = true
  connection.sendNotification(DidChangeConfigurationNotification.type, {
    settings: {}
  })
  const changeConfigurationDiagnostics =
    await changeConfigurationDiagnosticsPromise
  assert.deepEqual(
    configRequest,
    {items: [{scopeUri: uri, section: 'remark'}]},
    'should clear the cache if the configuration changed'
  )
  assert.deepEqual(
    {uri, version: 1, diagnostics: []},
    changeConfigurationDiagnostics,
    'should not emit diagnostics if requireConfig is false'
  )
})

test('global configuration `requireConfig`', async (t) => {
  startLanguageServer('remark-with-warnings.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const uri = new URL('lsp.md', import.meta.url).href

  const openDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {uri, languageId: 'markdown', version: 1, text: '# hi'}
  })
  const openDiagnostics = await openDiagnosticsPromise
  assert.notEqual(
    openDiagnostics.diagnostics.length,
    0,
    'should emit diagnostics on `textDocument/didOpen`'
  )

  const changeConfigurationDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidChangeConfigurationNotification.type, {
    settings: {requireConfig: true}
  })
  const changeConfigurationDiagnostics =
    await changeConfigurationDiagnosticsPromise
  assert.deepEqual(
    {uri, version: 1, diagnostics: []},
    changeConfigurationDiagnostics,
    'should emit empty diagnostics if requireConfig is true without config'
  )

  const rcPath = new URL('.testremarkrc.json', import.meta.url)
  t.after(() => fs.rm(rcPath, {force: true}))
  await fs.writeFile(rcPath, '{}\n')
  const watchedFileDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidChangeWatchedFilesNotification.type, {
    changes: []
  })
  const watchedFileDiagnostics = await watchedFileDiagnosticsPromise
  assert.equal(
    0,
    watchedFileDiagnostics.diagnostics.length,
    'should emit diagnostics if requireConfig is true with config'
  )
})

test('uninstalled processor so `window/showMessageRequest`', async () => {
  startLanguageServer('missing-package.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const messageRequestPromise = createOnRequestPromise(ShowMessageRequest.type)
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('lsp.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
  const messageRequest = await messageRequestPromise

  assert.deepEqual(
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

test('uninstalled processor w/ `defaultProcessor`', async () => {
  startLanguageServer('missing-package-with-default.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const logPromise = createOnNotificationPromise(LogMessageNotification.type)
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: new URL('lsp.md', import.meta.url).href,
      languageId: 'markdown',
      version: 1,
      text: '# hi'
    }
  })
  const log = await logPromise

  assert.deepEqual(
    cleanStack(log.message, 2).replace(/(imported from )[^\r\n]+/, '$1zzz'),
    "Cannot find `xxx-missing-yyy` locally but using `defaultProcessor`, original error:\nError: Cannot find package 'xxx-missing-yyy' imported from zzz",
    'should work w/ `defaultProcessor`'
  )
})

test('`textDocument/formatting`', async () => {
  startLanguageServer('remark.js')

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
  assert.deepEqual(
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
  assert.deepEqual(
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
  assert.deepEqual(
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
  assert.deepEqual(
    resultOutside,
    null,
    'should ignore documents outside of workspace on `textDocument/formatting`'
  )
})

test('`workspace/didChangeWatchedFiles`', async () => {
  startLanguageServer('remark.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
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
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification('workspace/didChangeWatchedFiles', {changes: []})
  const changeWatchDiagnostics = await changeWatchDiagnosticsPromise

  assert.deepEqual(
    changeWatchDiagnostics,
    {uri: new URL('a.md', import.meta.url).href, version: 1, diagnostics: []},
    'should emit diagnostics for registered files on any `workspace/didChangeWatchedFiles`'
  )
})

test('`initialize`, `textDocument/didOpen` (and a broken plugin)', async () => {
  startLanguageServer('remark-with-error.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
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

  assert.deepEqual(
    openDiagnostics.diagnostics.map(({message, ...rest}) => ({
      message: cleanStack(message, 3),
      ...rest
    })),
    [
      {
        message:
          'Cannot process file\n' +
          'Error: Whoops!\n' +
          '    at Function.oneError (one-error.js:1:1)',
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        severity: 1
      }
    ],
    'should show stack traces on crashes'
  )
})

test('`textDocument/codeAction` (and diagnostics)', async () => {
  startLanguageServer('code-actions.js')
  const uri = new URL('lsp.md', import.meta.url).href

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
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

  assert.deepEqual(
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
  assert.equal(
    closedCodeActions,
    null,
    'should not emit quick fixes for unsynchronized documents'
  )
})

test('`initialize` w/ nothing (finds closest `package.json`)', async () => {
  startLanguageServer('remark-with-cwd.js', '../')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
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

  assert.deepEqual(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(new URL('folder-with-package-json', import.meta.url).href),
    'should default to a `cwd` of the parent folder of the closest `package.json`'
  )
})

test('`initialize` w/ nothing (find closest `.git`)', async () => {
  startLanguageServer('remark-with-cwd.js', '../')
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

  assert.deepEqual(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(new URL('folder-with-git', import.meta.url).href),
    'should default to a `cwd` of the parent folder of the closest `.git`'
  )
})

test('`initialize` w/ `rootUri`', async () => {
  const cwd = new URL('folder/', import.meta.url)
  startLanguageServer('remark-with-cwd.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: cwd.href,
    capabilities: {},
    workspaceFolders: []
  })

  const openDiagnosticsPromise = createOnNotificationPromise(
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

  assert.deepEqual(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(cwd).slice(0, -1),
    'should use `rootUri`'
  )
})

test('`initialize` w/ `workspaceFolders`', async () => {
  const processCwd = new URL('./', import.meta.url)
  startLanguageServer('remark-with-cwd.js')

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

  assert.deepEqual(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(otherCwd).slice(0, -1),
    'should use `workspaceFolders`'
  )
})

test('`workspace/didChangeWorkspaceFolders`', async () => {
  const processCwd = new URL('./', import.meta.url)

  startLanguageServer('remark-with-cwd.js')

  await connection.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {workspace: {workspaceFolders: true}},
    workspaceFolders: [{uri: processCwd.href, name: ''}]
  })

  connection.sendNotification('initialized', {})

  const otherCwd = new URL('folder/', processCwd)

  const openDiagnosticsPromise = createOnNotificationPromise(
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
  assert.equal(
    openDiagnostics.diagnostics[0].message,
    fileURLToPath(processCwd).slice(0, -1)
  )

  const didAddDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidChangeWorkspaceFoldersNotification.type, {
    event: {added: [{uri: otherCwd.href, name: ''}], removed: []}
  })
  const didAddDiagnostics = await didAddDiagnosticsPromise
  assert.equal(
    didAddDiagnostics.diagnostics[0].message,
    fileURLToPath(otherCwd).slice(0, -1)
  )

  const didRemoveDiagnosticsPromise = createOnNotificationPromise(
    PublishDiagnosticsNotification.type
  )
  connection.sendNotification(DidChangeWorkspaceFoldersNotification.type, {
    event: {added: [], removed: [{uri: otherCwd.href, name: ''}]}
  })
  const didRemoveDiagnostics = await didRemoveDiagnosticsPromise
  assert.equal(
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
    .replaceAll(/\(.+\//g, '(')
    .replaceAll(/\d+:\d+/g, '1:1')
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
 * @param {string} serverFilePath The path to the language server relative to
 * this test file.
 * @param cwd The cwd to use for the process relative to this test file.
 */
function startLanguageServer(serverFilePath, cwd = './') {
  const proc = spawn(
    'node',
    [fileURLToPath(new URL(serverFilePath, import.meta.url)), '--node-ipc'],
    {
      cwd: new URL(cwd, import.meta.url),
      stdio: [null, 'inherit', 'inherit', 'ipc']
    }
  )
  connection = createProtocolConnection(
    new IPCMessageReader(proc),
    new IPCMessageWriter(proc)
  )
  connection.onDispose(() => {
    proc.kill()
  })
  connection.listen()
}

/**
 * Wait for an event type to be omitted.
 *
 * @template ReturnType
 * @param {import('vscode-languageserver').NotificationType<ReturnType>} type
 * @returns {Promise<ReturnType>}
 */
async function createOnNotificationPromise(type) {
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
 * @param {import('vscode-languageserver').RequestType<Params, any, any>} type
 * @returns {Promise<Params>}
 */
async function createOnRequestPromise(type) {
  return new Promise((resolve) => {
    const disposable = connection.onRequest(type, (result) => {
      disposable.dispose()
      resolve(result)
    })
  })
}
