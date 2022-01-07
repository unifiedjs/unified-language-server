import {createUnifiedLanguageServer} from '../index.js'

createUnifiedLanguageServer({
  processorName: 'remark',
  processorSpecifier: 'remark',
  plugins: ['./lots-of-warnings.js']
})
