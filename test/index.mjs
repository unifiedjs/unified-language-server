import {pathToFileURL} from 'node:url'

import {spy, stub} from 'sinon'
import test from 'tape'
import {
  DiagnosticSeverity,
  Position,
  Range,
  TextDocuments,
  TextDocumentSyncKind,
  TextEdit
} from 'vscode-languageserver/node.js'
import {TextDocument} from 'vscode-languageserver-textdocument'

import {configureUnifiedLanguageServer} from '../server.mjs'

/**
 * @returns {import('vscode-languageserver').Connection}
 */
function createMockConnection() {
  return {
    // @ts-expect-error The connection is missing here, which is ok for testing.
    console: {
      error: spy(),
      info: spy(),
      log: spy(),
      warn: spy()
    },
    listen: spy(),
    onInitialize: spy(),
    onDidChangeConfiguration: spy(),
    onDocumentFormatting: spy(),
    sendDiagnostics: stub()
  }
}

/**
 * @param {string} uri
 * @param {string} text
 * @returns {Promise<import('vscode-languageserver').PublishDiagnosticsParams>}
 */
function getDiagnostic(uri, text) {
  const connection = createMockConnection()
  const documents = new TextDocuments(TextDocument)
  const diagnosticsPromise = new Promise((resolve) => {
    const sendDiagnostics = /** @type import('sinon').SinonStub */ (
      connection.sendDiagnostics
    )
    sendDiagnostics.callsFake(resolve)
  })
  const onDidChangeContent = spy()
  Object.defineProperty(documents, 'onDidChangeContent', {
    value: onDidChangeContent
  })

  configureUnifiedLanguageServer(connection, documents, {
    plugins: ['./test/test-plugin.mjs']
  })

  onDidChangeContent.firstCall.firstArg({
    document: TextDocument.create(uri, 'text', 0, text)
  })

  return diagnosticsPromise
}

test('onInitialize', (t) => {
  const connection = createMockConnection()
  const documents = new TextDocuments(TextDocument)

  configureUnifiedLanguageServer(connection, documents, {})

  const initialize = /** @type import('sinon').SinonSpy */ (
    connection.onInitialize
  ).firstCall.firstArg
  const result = initialize()

  t.deepEquals(result, {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentFormattingProvider: true
    }
  })

  t.end()
})

test('onDocumentFormatting different', async (t) => {
  const connection = createMockConnection()
  const documents = new TextDocuments(TextDocument)
  const uri = String(pathToFileURL('test.md'))
  const get = stub(documents, 'get').returns(
    TextDocument.create(uri, 'markdown', 0, '#   Hello world!')
  )

  configureUnifiedLanguageServer(connection, documents, {
    plugins: ['remark-parse', 'remark-stringify']
  })

  const formatDocument = /** @type import('sinon').SinonSpy */ (
    connection.onDocumentFormatting
  ).firstCall.firstArg
  const result = await formatDocument({textDocument: {uri}})

  t.deepEquals(get.firstCall.args, [uri])
  t.deepEquals(result, [
    TextEdit.replace(
      Range.create(Position.create(0, 0), Position.create(0, 16)),
      '# Hello world!\n'
    )
  ])

  t.end()
})

test('onDocumentFormatting not found', async (t) => {
  const connection = createMockConnection()
  const documents = new TextDocuments(TextDocument)
  const uri = String(pathToFileURL('test.md'))

  configureUnifiedLanguageServer(connection, documents, {
    plugins: ['remark-parse', 'remark-stringify']
  })

  const formatDocument = /** @type import('sinon').SinonSpy */ (
    connection.onDocumentFormatting
  ).firstCall.firstArg
  const result = await formatDocument({textDocument: {uri}})

  t.deepEquals(result, undefined)

  t.end()
})

test('onDocumentFormatting equal', async (t) => {
  const connection = createMockConnection()
  const documents = new TextDocuments(TextDocument)
  const uri = String(pathToFileURL('test.md'))
  stub(documents, 'get').returns(
    TextDocument.create(uri, 'markdown', 0, '# Hello world!\n')
  )

  configureUnifiedLanguageServer(connection, documents, {
    plugins: ['remark-parse', 'remark-stringify']
  })

  const formatDocument = /** @type import('sinon').SinonSpy */ (
    connection.onDocumentFormatting
  ).firstCall.firstArg
  const result = await formatDocument({textDocument: {uri}})

  t.deepEquals(result, undefined)

  t.end()
})

test('onDidChangeContent no position', async (t) => {
  const uri = String(pathToFileURL('test.md'))
  const diagnostics = await getDiagnostic(uri, 'no position')

  t.deepEquals(diagnostics, {
    uri,
    version: 0,
    diagnostics: [
      {
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        message: 'no position',
        severity: DiagnosticSeverity.Warning
      }
    ]
  })

  t.end()
})

test('onDidChangeContent no end', async (t) => {
  const uri = String(pathToFileURL('test.md'))
  const diagnostics = await getDiagnostic(uri, 'no end')

  t.deepEquals(diagnostics, {
    uri,
    version: 0,
    diagnostics: [
      {
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        message: 'no end',
        severity: DiagnosticSeverity.Warning
      }
    ]
  })

  t.end()
})

test('onDidChangeContent start end', async (t) => {
  const uri = String(pathToFileURL('test.md'))
  const diagnostics = await getDiagnostic(uri, 'start end')

  t.deepEquals(diagnostics, {
    uri,
    version: 0,
    diagnostics: [
      {
        range: {start: {line: 0, character: 0}, end: {line: 1, character: 9}},
        message: 'start end',
        severity: DiagnosticSeverity.Warning
      }
    ]
  })

  t.end()
})

test('onDidChangeContent fatal true', async (t) => {
  const uri = String(pathToFileURL('test.md'))
  const diagnostics = await getDiagnostic(uri, 'fatal true')

  t.deepEquals(diagnostics, {
    uri,
    version: 0,
    diagnostics: [
      {
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        message: 'fatal true',
        severity: DiagnosticSeverity.Error
      }
    ]
  })

  t.end()
})

test('onDidChangeContent fatal unknown', async (t) => {
  const uri = String(pathToFileURL('test.md'))
  const diagnostics = await getDiagnostic(uri, 'fatal unknown')

  t.deepEquals(diagnostics, {
    uri,
    version: 0,
    diagnostics: [
      {
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        message: 'fatal unknown',
        severity: DiagnosticSeverity.Information
      }
    ]
  })

  t.end()
})

test('onDidChangeContent has ruleId', async (t) => {
  const uri = String(pathToFileURL('test.md'))
  const diagnostics = await getDiagnostic(uri, 'has ruleId')

  t.deepEquals(diagnostics, {
    uri,
    version: 0,
    diagnostics: [
      {
        code: 'test-rule',
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        message: 'has ruleId',
        severity: DiagnosticSeverity.Warning
      }
    ]
  })

  t.end()
})

test('onDidChangeContent has source', async (t) => {
  const uri = String(pathToFileURL('test.md'))
  const diagnostics = await getDiagnostic(uri, 'has source')

  t.deepEquals(diagnostics, {
    uri,
    version: 0,
    diagnostics: [
      {
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        message: 'has source',
        source: 'test-source',
        severity: DiagnosticSeverity.Warning
      }
    ]
  })

  t.end()
})

// test('onDidChangeConfiguration', async (t) => {
//   const connection = createMockConnection()
//   const documents = new TextDocuments(TextDocument)
//   const diagnosticsPromise = new Promise((resolve) => {
//     const sendDiagnostics = /** @type import('sinon').SinonStub */ (
//       connection.sendDiagnostics
//     )
//     sendDiagnostics.callsFake(() => {
//       if (sendDiagnostics.callCount === 2) {
//         resolve([
//           sendDiagnostics.firstCall.firstArg,
//           sendDiagnostics.lastCall.firstArg
//         ])
//       }
//     })
//   })
//   const uri1 = String(pathToFileURL('test1.md'))
//   const uri2 = String(pathToFileURL('test2.md'))

//   Object.defineProperty(documents, 'all', {
//     value: () => [
//       TextDocument.create(uri1, 'text', 0, 'has ruleId'),
//       TextDocument.create(uri2, 'text', 0, 'has source')
//     ]
//   })

//   configureUnifiedLanguageServer(connection, documents, {
//     plugins: ['./test/test-plugin.mjs']
//   })

//   const onDidChangeConfiguration = /** @type import('sinon').SinonSpy */ (
//     connection.onDidChangeConfiguration
//   )
//   onDidChangeConfiguration.firstCall.firstArg()
//   const diagnostics = await diagnosticsPromise

//   t.deepEquals(diagnostics, [
//     {
//       uri: uri1,
//       version: 0,
//       diagnostics: [
//         {
//           range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
//           message: 'has ruleId',
//           code: 'test-rule',
//           severity: DiagnosticSeverity.Warning
//         }
//       ]
//     },
//     {
//       uri: uri2,
//       version: 0,
//       diagnostics: [
//         {
//           range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
//           message: 'has source',
//           source: 'test-source',
//           severity: DiagnosticSeverity.Warning
//         }
//       ]
//     }
//   ])

//   t.end()
// })

test('onDidClose', async (t) => {
  const connection = createMockConnection()
  const documents = new TextDocuments(TextDocument)
  const uri = String(pathToFileURL('test.md'))
  const diagnosticsPromise = new Promise((resolve) => {
    const sendDiagnostics = /** @type import('sinon').SinonStub */ (
      connection.sendDiagnostics
    )
    sendDiagnostics.callsFake(resolve)
  })
  const onDidClose = spy()
  Object.defineProperty(documents, 'onDidClose', {
    value: onDidClose
  })

  configureUnifiedLanguageServer(connection, documents, {
    plugins: ['./test/test-plugin.mjs']
  })

  onDidClose.firstCall.firstArg({
    document: TextDocument.create(uri, 'text', 0, '')
  })

  const diagnostics = await diagnosticsPromise

  t.deepEquals(diagnostics, {
    uri,
    version: 0,
    diagnostics: []
  })

  t.end()
})
