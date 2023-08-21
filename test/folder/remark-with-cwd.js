import {createUnifiedLanguageServer} from 'unified-language-server'

createUnifiedLanguageServer({
  configurationSection: 'remark',
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
