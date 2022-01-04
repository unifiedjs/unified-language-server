import {createUnifiedLanguageServer} from '../index.js'

createUnifiedLanguageServer({
  plugins: ['remark-parse', 'remark-stringify', './lots-of-warnings.js']
})
