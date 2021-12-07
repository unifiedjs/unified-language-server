const {readFileSync} = require('fs')
const LangServer = require('vscode-languageserver')
const {
  Diagnostic,
  Position,
  TextDocumentSyncKind
} = require('vscode-languageserver')

// ConvertPosition :: VFilePosition -> Position
const convertPosition = ({line, column}) =>
  Position.create(line - 1, column - 1)

const parsePlugins = (object) =>
  typeof object === 'undefined'
    ? object
    : JSON.parse(JSON.stringify(object), (k, v) => {
        if (typeof v !== 'string') {
          return v
        }

        if (v.startsWith('#')) {
          return require(v.slice('#'.length))
        }

        if (v.startsWith('//')) {
          return readFileSync(v.slice('//'.length), 'utf8')
        }

        return v.trim()
      })

class UnifiedLangServerBase {
  constructor(connection, documents, processor0) {
    this._connection = connection
    this._documents = documents
    this._processor0 = processor0
    this._processor = processor0

    connection.onInitialize((_capabilities) => ({
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full
      }
    }))

    documents.onDidChangeContent((_) => this.validate(_))
  }

  setProcessor(x) {
    this._processor = x

    return this
  }

  configureWith(f) {
    // TODO check if client supports configuration?
    this._connection.onDidChangeConfiguration((change) => {
      try {
        this.setProcessor(this.createProcessor(f(change)))

        for (const document of this._documents.all()) {
          this.validate({document})
        }
      } catch (error) {
        this.log(error)
      }
    })

    return this
  }

  // Sets some callbacks and listening to the connection
  start() {
    this._documents.listen(this._connection)
    this._connection.listen()
  }

  createProcessor(settings) {
    const processor = this._processor0()
    for (const [plugin, options] of parsePlugins(settings.plugins)) {
      processor.use(plugin, options)
    }

    return processor
  }

  // {document: TextDocument}
  validate({document}) {
    return this._processor
      .process(document.getText())
      .then((vfile) =>
        vfile.messages
          .map((message) =>
            Diagnostic.create(
              {
                start: convertPosition(message.location.start),
                end: convertPosition(message.location.end)
              },
              message.reason,
              LangServer.DiagnosticSeverity.Hint,
              message.actual,
              message.source
            )
          )
          .sort((_) => _.range.start.line)
      )
      .then((diagnostics) => {
        this._connection.sendDiagnostics({
          uri: document.uri,
          diagnostics
        })

        return diagnostics
      })
      .catch(this.log)
  }

  log(x) {
    this._connection.console.log(x.toString ? x.toString() : JSON.stringify(x))
  }
}

module.exports = UnifiedLangServerBase
