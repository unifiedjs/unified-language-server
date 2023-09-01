import {createUnifiedLanguageServer} from 'unified-language-server'

createUnifiedLanguageServer({
  configurationSection: 'remark',
  processorName: 'remark',
  processorSpecifier: 'remark',
  // This is resolved from the directory containing package.json
  plugins: ['./test/one-error.js']
})
