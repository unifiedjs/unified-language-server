/**
 * @typedef {import('node:child_process').ExecException & {stdout: string, stderr: string}} ExecError
 */

import assert from 'node:assert'
import {Buffer} from 'node:buffer'
import process from 'node:process'
import {PassThrough} from 'node:stream'
import {URL, fileURLToPath} from 'node:url'
import {promisify} from 'node:util'
import {execa} from 'execa'
import test from 'tape'

import * as exports from 'unified-language-server'

const sleep = promisify(setTimeout)

const delay = process.platform === 'win32' ? 1000 : 400
const timeout = 10_000

test('exports', (t) => {
  t.equal(typeof exports.createUnifiedLanguageServer, 'function')

  t.end()
})

test('`initialize`', async (t) => {
  const stdin = new PassThrough()
  const promise = execa('node', ['remark.js', '--stdio'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 1, 'should emit messages')
    const parameters = messages[0].result

    t.deepEqual(
      parameters,
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
  }

  t.end()
})

test('`initialize` workspace capabilities', async (t) => {
  const stdin = new PassThrough()
  const promise = execa('node', ['remark.js', '--stdio'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {workspace: {workspaceFolders: true}},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 1, 'should emit messages')
    const parameters = messages[0].result

    t.deepEqual(
      parameters,
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
  }

  t.end()
})

test('`textDocument/didOpen`, `textDocument/didClose` (and diagnostics)', async (t) => {
  const stdin = new PassThrough()
  const promise = execa('node', ['remark-with-warnings.js', '--stdio'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('lsp.md', import.meta.url).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didClose',
      /** @type {import('vscode-languageserver').DidCloseTextDocumentParams} */
      params: {textDocument: {uri: new URL('lsp.md', import.meta.url).href}}
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 3, 'should emit messages')
    const open =
      /** @type {import('vscode-languageserver').PublishDiagnosticsParams} */ (
        messages[1].params
      )
    const close =
      /** @type {import('vscode-languageserver').PublishDiagnosticsParams} */ (
        messages[2].params
      )

    t.deepEqual(
      open.diagnostics,
      [
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
      ],
      'should emit diagnostics on `textDocument/didOpen`'
    )

    t.deepEqual(
      close.diagnostics,
      [],
      'should emit empty diagnostics on `textDocument/didClose`'
    )
  }

  t.end()
})

test('uninstalled processor so `window/showMessageRequest`', async (t) => {
  const stdin = new PassThrough()
  const promise = execa('node', ['missing-package.js', '--stdio'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('lsp.md', import.meta.url).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 2, 'should emit messages')
    const parameters = messages[1].params

    t.deepEqual(
      parameters,
      {
        type: 3,
        message:
          'Cannot turn on language server without `xxx-missing-yyy` locally. Run `npm install xxx-missing-yyy` to enable it',
        actions: []
      },
      'should emit a `window/showMessageRequest` when the processor can’t be found locally'
    )
  }

  t.end()
})

test('uninstalled processor w/ `defaultProcessor`', async (t) => {
  const stdin = new PassThrough()
  const promise = execa(
    'node',
    ['missing-package-with-default.js', '--stdio'],
    {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      input: stdin,
      timeout
    }
  )

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('lsp.md', import.meta.url).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 3, 'should emit messages')

    const parameters =
      /** @type {import('vscode-languageserver').LogMessageParams} */ (
        messages[1].params
      )

    t.deepEqual(
      cleanStack(parameters.message, 2).replace(
        /(imported from )[^\r\n]+/,
        '$1zzz'
      ),
      "Cannot find `xxx-missing-yyy` locally but using `defaultProcessor`, original error:\nError [ERR_MODULE_NOT_FOUND]: Cannot find package 'xxx-missing-yyy' imported from zzz",
      'should work w/ `defaultProcessor`'
    )
  }

  t.end()
})

test('`textDocument/formatting`', async (t) => {
  const stdin = new PassThrough()

  const promise = execa('node', ['remark.js', '--stdio'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('bad.md', import.meta.url).href,
          languageId: 'markdown',
          version: 1,
          text: '   #   hi  \n'
        }
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('good.md', import.meta.url).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi\n'
        }
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/formatting',
      id: 1,
      /** @type {import('vscode-languageserver').DocumentFormattingParams} */
      params: {
        textDocument: {uri: new URL('bad.md', import.meta.url).href},
        options: {tabSize: 2, insertSpaces: true}
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/formatting',
      id: 2,
      /** @type {import('vscode-languageserver').DocumentFormattingParams} */
      params: {
        textDocument: {uri: new URL('good.md', import.meta.url).href},
        options: {tabSize: 2, insertSpaces: true}
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 5, 'should emit messages')
    // First two are empty diagnostics.
    // Third and fourth are the bad/good reformatting.
    t.deepEqual(
      messages[3].result,
      [
        {
          range: {start: {line: 0, character: 0}, end: {line: 1, character: 0}},
          newText: '# hi\n'
        }
      ],
      'should format bad documents on `textDocument/formatting`'
    )
    t.deepEqual(
      messages[4].result,
      null,
      'should format good documents on `textDocument/formatting`'
    )
  }

  t.end()
})

test('`workspace/didChangeWatchedFiles`', async (t) => {
  const stdin = new PassThrough()
  const promise = execa('node', ['remark.js', '--stdio'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('a.md', import.meta.url).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'workspace/didChangeWatchedFiles',
      /** @type {import('vscode-languageserver').DidChangeWatchedFilesParams} */
      params: {
        changes: [
          {uri: new URL('a.md', import.meta.url).href, type: 1},
          {uri: new URL('b.md', import.meta.url).href, type: 2},
          {uri: new URL('c.md', import.meta.url).href, type: 3}
        ]
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 3, 'should emit messages')
    t.deepEqual(
      messages[1].params,
      messages[2].params,
      'should emit diagnostics for registered files on any `workspace/didChangeWatchedFiles`'
    )
  }

  t.end()
})

test('`initialize`, `textDocument/didOpen` (and a broken plugin)', async (t) => {
  const stdin = new PassThrough()
  const promise = execa('node', ['remark-with-error.js', '--stdio'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('lsp.md', import.meta.url).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 2, 'should emit messages')
    const parameters =
      /** @type {import('vscode-languageserver').PublishDiagnosticsParams} */ (
        messages[1].params
      )

    t.deepEqual(
      parameters.diagnostics.map(({message, ...rest}) => ({
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
  }

  t.end()
})

test('`textDocument/codeAction` (and diagnostics)', async (t) => {
  const uri = new URL('lsp.md', import.meta.url).href
  const stdin = new PassThrough()

  const promise = execa('node', ['remark.js', '--stdio'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri,
          languageId: 'markdown',
          version: 1,
          text: '## hello'
        }
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/codeAction',
      id: 1,
      /** @type {import('vscode-languageserver').CodeActionParams} */
      params: {
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
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)

    t.deepEqual(
      messages,
      [
        {
          jsonrpc: '2.0',
          id: 0,
          result: {
            capabilities: {
              textDocumentSync: 1,
              documentFormattingProvider: true,
              codeActionProvider: {
                codeActionKinds: ['quickfix'],
                resolveProvider: true
              }
            }
          }
        },
        {
          jsonrpc: '2.0',
          method: 'textDocument/publishDiagnostics',
          params: {uri, version: 1, diagnostics: []}
        },
        {
          jsonrpc: '2.0',
          id: 1,
          result: [
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
          ]
        }
      ],
      'should emit quick fixes on a `textDocument/codeAction`'
    )
  }

  t.end()
})

test('`initialize` w/ nothing', async (t) => {
  const stdin = new PassThrough()
  const cwd = new URL('..', import.meta.url)
  const promise = execa('node', ['./test/remark-with-cwd.js', '--stdio'], {
    cwd: fileURLToPath(cwd),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: null
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('lsp.md', import.meta.url).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 2, 'should emit messages')
    const parameters =
      /** @type {import('vscode-languageserver').PublishDiagnosticsParams} */ (
        messages[1].params
      )
    const info = parameters.diagnostics[0]
    t.ok(info, 'should emit the cwd')
    t.deepEqual(
      info.message,
      fileURLToPath(cwd).slice(0, -1),
      'should default to a `cwd` of `process.cwd()`'
    )
  }

  t.end()
})

test('`initialize` w/ `rootUri`', async (t) => {
  const stdin = new PassThrough()
  const cwd = new URL('./folder/', import.meta.url)
  const processCwd = new URL('..', cwd)
  const promise = execa('node', ['folder/remark-with-cwd.js', '--stdio'], {
    cwd: fileURLToPath(processCwd),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: cwd.href,
        capabilities: {},
        workspaceFolders: []
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('lsp.md', cwd).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 2, 'should emit messages')
    const parameters =
      /** @type {import('vscode-languageserver').PublishDiagnosticsParams} */ (
        messages[1].params
      )
    const info = parameters.diagnostics[0]
    t.ok(info, 'should emit the cwd')
    t.deepEqual(
      info.message,
      fileURLToPath(cwd).slice(0, -1),
      'should use `rootUri`'
    )
  }

  t.end()
})

test('`initialize` w/ `workspaceFolders`', async (t) => {
  const stdin = new PassThrough()
  const processCwd = new URL('.', import.meta.url)
  const promise = execa('node', ['remark-with-cwd.js', '--stdio'], {
    cwd: fileURLToPath(processCwd),
    input: stdin,
    timeout
  })

  const otherCwd = new URL('./folder/', processCwd)

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {},
        workspaceFolders: [
          {uri: processCwd.href, name: ''}, // Farthest
          {uri: otherCwd.href, name: ''} // Nearest
        ]
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('lsp.md', otherCwd).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.equal(messages.length, 2, 'should emit messages')
    const parameters =
      /** @type {import('vscode-languageserver').PublishDiagnosticsParams} */ (
        messages[1].params
      )
    const info = parameters.diagnostics[0]
    t.ok(info, 'should emit the cwd')
    t.deepEqual(
      info.message,
      fileURLToPath(otherCwd).slice(0, -1),
      'should use `workspaceFolders`'
    )
  }

  t.end()
})

test('`workspace/didChangeWorkspaceFolders`', async (t) => {
  const stdin = new PassThrough()
  const processCwd = new URL('.', import.meta.url)
  const promise = execa('node', ['remark-with-cwd.js', '--stdio'], {
    cwd: fileURLToPath(processCwd),
    input: stdin,
    timeout
  })

  stdin.write(
    toMessage({
      method: 'initialize',
      id: 0,
      /** @type {import('vscode-languageserver').InitializeParams} */
      params: {
        processId: null,
        rootUri: null,
        capabilities: {workspace: {workspaceFolders: true}},
        workspaceFolders: [{uri: processCwd.href, name: ''}]
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'initialized',
      /** @type {import('vscode-languageserver').InitializedParams} */
      params: {}
    })
  )

  await sleep(delay)

  const otherCwd = new URL('./folder/', processCwd)

  stdin.write(
    toMessage({
      method: 'textDocument/didOpen',
      /** @type {import('vscode-languageserver').DidOpenTextDocumentParams} */
      params: {
        textDocument: {
          uri: new URL('lsp.md', otherCwd).href,
          languageId: 'markdown',
          version: 1,
          text: '# hi'
        }
      }
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'workspace/didChangeWorkspaceFolders',
      /** @type {import('vscode-languageserver').DidChangeWorkspaceFoldersParams} */
      params: {event: {added: [{uri: otherCwd.href, name: ''}], removed: []}}
    })
  )

  await sleep(delay)

  stdin.write(
    toMessage({
      method: 'workspace/didChangeWorkspaceFolders',
      /** @type {import('vscode-languageserver').DidChangeWorkspaceFoldersParams} */
      params: {
        event: {added: [], removed: [{uri: otherCwd.href, name: ''}]}
      }
    })
  )

  await sleep(delay)

  assert(promise.stdout)
  promise.stdout.on('data', () => setImmediate(() => stdin.end()))

  try {
    await promise
    t.fail('should reject')
  } catch (error) {
    const exception = /** @type {ExecError} */ (error)
    const messages = fromMessages(exception.stdout)
    t.deepEqual(
      messages
        .filter((d) => d.method === 'textDocument/publishDiagnostics')
        .flatMap((d) => {
          const parameters =
            /** @type {import('vscode-languageserver').PublishDiagnosticsParams} */ (
              d.params
            )
          return parameters.diagnostics
        })
        .map((d) => d.message),
      [
        fileURLToPath(processCwd).slice(0, -1),
        fileURLToPath(otherCwd).slice(0, -1),
        fileURLToPath(processCwd).slice(0, -1)
      ],
      'should support `workspaceFolders`'
    )
  }

  t.end()
})

/**
 * @param {string} data
 * @returns {Array<Record<string, unknown>>}
 */
function fromMessages(data) {
  return data
    .replace(/\r?\n/g, '\n')
    .split(/Content-Length: \d+\n{2}/g)
    .filter(Boolean)
    .map((d) => JSON.parse(d))
}

/**
 * @param {unknown} data
 */
function toMessage(data) {
  const content = Buffer.from(JSON.stringify(data))
  return Buffer.concat([
    Buffer.from('Content-Length: ' + content.length + '\r\n\r\n'),
    content
  ])
}

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
