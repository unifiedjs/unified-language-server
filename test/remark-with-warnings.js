import {createUnifiedLanguageServer} from 'unified-language-server'

createUnifiedLanguageServer({
  processorName: 'remark',
  processorSpecifier: 'remark',
  // This is resolved from the directory containing package.json
  plugins: ['./test/lots-of-warnings.js']
})
