import {createUnifiedLanguageServer} from 'unified-language-server'

createUnifiedLanguageServer({
  configurationSection: 'remark',
  processorName: 'remark',
  processorSpecifier: 'remark'
})
