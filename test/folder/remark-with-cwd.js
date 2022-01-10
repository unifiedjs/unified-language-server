import {createUnifiedLanguageServer} from '../../index.js'

createUnifiedLanguageServer({
  processorName: 'remark',
  processorSpecifier: 'remark',
  plugins: [warn]
})

/** @type {import('unified').Plugin<Array<void>>} */
function warn() {
  return (_, file) => {
    file.message(file.cwd)
  }
}
