import {createUnifiedLanguageServer} from '../index.js'

createUnifiedLanguageServer({
  plugins: ['remark-parse', 'remark-stringify', './one-error.js']
})
