const test = require('tape') // TODO try 'ava' instead
const unified = require('unified')
const {
  TextDocumentSyncKind,
  DiagnosticSeverity
} = require('vscode-languageserver-protocol')
const {spy} = require('sinon')
const VMessage = require('vfile-message')

const parser = require('retext-english')
const Base = require('./index.js')

function compiler() {
  this.Compiler = () => "compiler's output"
}

const messagePushingAttacher = (vMessage) => () => (tree, file) => {
  file.messages.push(vMessage)
}

const textProcessor = unified().use(parser).use(compiler).freeze()

const createMockConnection = () => ({
  console: {
    log: spy()
  },
  listen: spy(),
  onInitialize: spy(),
  onDidChangeConfiguration: spy(),
  sendDiagnostics: spy()
})
const createMockDocuments = (docs) => ({
  all: () => docs || [],
  listen: spy(),
  onDidChangeContent: spy()
})
const createMockDocument = (txt, props) =>
  Object.assign(props || {}, {
    getText: () => txt
  })

const waitUntilCalled = (spy, timeout) =>
  new Promise((resolve, reject) => {
    timeout = timeout || 1000
    let timePassed = 0

    const timer = setInterval(() => {
      timePassed += 200
      if (timePassed > timeout) {
        clearInterval(timer)
        reject(new Error("waited for the spy to be called but it wasn't"))
      } else if (spy.called) {
        clearInterval(timer)
        resolve()
      }
    }, 200)
  })

test('the constructor', (t) => {
  t.plan(3)

  const connection = createMockConnection()
  const documents = createMockDocuments()

  new Base(connection, documents, textProcessor)

  t.ok(connection.listen.notCalled, "listen() shouldn't be done implicitly")
  t.ok(documents.listen.notCalled, "listen() shouldn't be done implicitly")

  t.deepEqual(
    connection.onInitialize.firstCall.args[0](/* client capabilities */),
    {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full
      }
    },
    'server must report correct capabilities'
  )
})

test('setProcessor()', async (t) => {
  t.plan(2)

  const plugin1 = messagePushingAttacher(
    new VMessage(
      'msg one',
      {
        start: {line: 1, column: 5},
        end: {line: 2, column: 10}
      },
      'attacher1:rule1'
    )
  )
  const plugin2 = messagePushingAttacher(
    new VMessage(
      'msg two',
      {
        start: {line: 3, column: 6},
        end: {line: 4, column: 8}
      },
      'attacher2:rule1'
    )
  )

  const processor1 = textProcessor().use(plugin1)
  const processor2 = textProcessor().use(plugin2)

  const base = new Base(
    createMockConnection(),
    createMockDocuments(),
    processor1
  )

  const doc = {
    document: createMockDocument('', {uri: 'uri-01'})
  }

  t.deepEqual(await base.validate(doc), [
    {
      range: {
        start: {line: 0, character: 4},
        end: {line: 1, character: 9}
      },
      message: 'msg one',
      severity: DiagnosticSeverity.Hint,
      source: 'attacher1'
    }
  ])

  base.setProcessor(processor2)

  t.deepEqual(await base.validate(doc), [
    {
      range: {
        start: {line: 2, character: 5},
        end: {line: 3, character: 7}
      },
      message: 'msg two',
      severity: DiagnosticSeverity.Hint,
      source: 'attacher2'
    }
  ])
})

test('createProcessor()', (t) => {
  const connection = createMockConnection()
  const documents = createMockDocuments()
  const TEXT = [
    'spellinggg misstakes alll overr',
    'and carrot is spelled correctly but my personal dictionary dislikes it'
  ].join('\n')

  const base = new Base(connection, documents, textProcessor)

  for (const [description] of [
    ['empty settings', {}],
    [
      'nonexistent modules',
      {
        plugins: [['#some-unknown-module-by-aecepoglu']]
      }
    ],
    [
      'nonexistent file',
      {
        plugins: [['//i-bet-this-file-doesnt-exist.txt']]
      }
    ]
  ]) {
    t.test(description, (st) => {
      st.plan(1)
      st.throws(() => {
        base.createProcessor({})
      }, `error thrown for ${description}`)
    })
  }

  t.test("defining modules with '#'", async (st) => {
    st.plan(1)

    const myProcessor = base.createProcessor({
      plugins: [['#retext-spell', '#dictionary-en-gb']]
    })

    const abc = await myProcessor.process(TEXT)
    st.deepEqual(
      abc.messages.map((_) => _.actual),
      ['spellinggg', 'misstakes', 'alll', 'overr']
    )
  })

  t.skip("defining files with '//'", async (st) => {
    st.plan(1)

    const myProcessor = base.createProcessor({
      plugins: [
        [
          '#retext-spell',
          {
            dictionary: '#dictionary-en-gb',
            personal: '//./sample-dict.txt'
          }
        ]
      ]
    })

    const abc = await myProcessor.process(TEXT)
    st.deepEqual(
      abc.messages.map((_) => _.actual),
      ['spellinggg', 'misstakes', 'alll', 'overr', 'carrot']
    )
  })
})

test('start() listens to connections', (t) => {
  t.plan(2)

  const connection = createMockConnection()
  const documents = createMockDocuments()

  const base = new Base(connection, documents, textProcessor)

  base.start()

  t.ok(connection.listen.called)
  t.ok(documents.listen.calledWith(connection))
})

test('configureWith() is used to listen to changes in settings and updating the processor with them', async (t) => {
  t.plan(1)

  const connection = createMockConnection()
  const documents = createMockDocuments([
    createMockDocument('text with a spellingg mistake', {uri: 'uri-01'}),
    createMockDocument('proper text.', {uri: 'uri-02'})
  ])

  new Base(connection, documents, textProcessor).configureWith(
    (settings) => settings.some.obscure.path
  )

  connection.onDidChangeConfiguration.args[0][0]({
    some: {
      obscure: {
        path: {
          plugins: [['#retext-spell', '#dictionary-en-gb']]
        }
      }
    }
  })

  await waitUntilCalled(connection.sendDiagnostics)

  t.deepEqual(
    connection.sendDiagnostics.args.sort((_) => _.uri),
    [
      [
        {
          uri: 'uri-01',
          diagnostics: [
            {
              range: {
                start: {line: 0, character: 12},
                end: {line: 0, character: 12 + 'spellingg'.length}
              },
              message:
                '`spellingg` is misspelt; did you mean `spelling`, `spellings`?',
              severity: DiagnosticSeverity.Hint,
              code: 'spellingg',
              source: 'retext-spell'
            }
          ]
        }
      ],
      [
        {
          uri: 'uri-02',
          diagnostics: []
        }
      ]
    ],
    'diagnostics must be sent for all documents'
  )
})

test('the cb given to configureWith() throws an error', (t) => {
  t.plan(2)

  const connection = createMockConnection()
  const documents = createMockDocuments([
    createMockDocument('text with a spellingg mistake', {uri: 'uri-01'}),
    createMockDocument('proper text.', {uri: 'uri-02'})
  ])

  new Base(connection, documents, textProcessor).configureWith(() => {
    throw new Error('the error thrown by the configuration filter function')
  })

  t.doesNotThrow(() => {
    connection.onDidChangeConfiguration.args[0][0]('settings from the client')
  })

  t.ok(
    connection.console.log.calledWith(
      'Error: the error thrown by the configuration filter function'
    ),
    'error must be logged'
  )
})
