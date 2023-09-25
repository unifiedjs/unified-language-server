import {createUnifiedLanguageServer} from 'unified-language-server'

createUnifiedLanguageServer({
  configurationSection: 'remark',
  processorName: 'remark',
  processorSpecifier: 'remark',
  rcName: 'testremark',
  // This is resolved from the directory containing package.json
  plugins: ['./test/lots-of-warnings.js']
})
