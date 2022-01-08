import {createUnifiedLanguageServer} from '../index.js'

createUnifiedLanguageServer({
  processorName: 'remark',
  processorSpecifier: 'remark',
  plugins: ['./one-error.js']
})
