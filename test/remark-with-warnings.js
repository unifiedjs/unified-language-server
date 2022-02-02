import {createUnifiedLanguageServer} from '../index.js'

createUnifiedLanguageServer({
  processorName: 'remark',
  processorSpecifier: 'remark',
  // This is resolved from the directory containing package.json
  plugins: ['./test/lots-of-warnings.js']
})
