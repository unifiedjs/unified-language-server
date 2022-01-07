import {remark} from 'remark'
import {createUnifiedLanguageServer} from '../index.js'

createUnifiedLanguageServer({
  processorName: 'xxx-missing-yyy',
  defaultProcessor: remark
})
