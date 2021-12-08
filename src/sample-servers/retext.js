#!/usr/bin/node

const LangServer = require('vscode-languageserver')
const retext = require('retext')

const Base = require('../unified-language-server/index.js')

const DEFAULT_SETTINGS = {
  plugins: [['#retext-profanities'], ['#retext-spell', '#dictionary-en-gb']]
}

const connection = LangServer.createConnection(LangServer.ProposedFeatures.all)
const documents = new LangServer.TextDocuments()

const server = new Base(connection, documents, retext)
server.setProcessor(server.createProcessor(DEFAULT_SETTINGS))
server.configureWith(
  (change) => change.settings['retext-language-server'] || DEFAULT_SETTINGS
)
server.start()
