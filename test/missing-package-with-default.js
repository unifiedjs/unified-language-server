import {remark} from 'remark'
import {createUnifiedLanguageServer} from 'unified-language-server'

createUnifiedLanguageServer({
  configurationSection: 'xxx-missing-yyy',
  processorName: 'xxx-missing-yyy',
  // @ts-expect-error This will be ok when we update to remark 15.
  defaultProcessor: remark
})
