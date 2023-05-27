import {createUnifiedLanguageServer} from 'unified-language-server'

createUnifiedLanguageServer({
  processorName: 'remark',
  processorSpecifier: 'remark',
  plugins: [warn]
})

/** @type {import('unified').Plugin<[]>} */
function warn() {
  return (_, file) => {
    file.message(file.cwd)
  }
}
