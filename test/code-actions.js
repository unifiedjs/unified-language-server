import {createUnifiedLanguageServer} from '../index.js'

createUnifiedLanguageServer({
  processorName: 'remark',
  processorSpecifier: 'remark',
  plugins: [warn]
})

/** @type {import('unified').Plugin<Array<void>>} */
function warn() {
  return (_, file) => {
    // Insert
    file.message('', {line: 1, column: 1}).expected = ['insert me']

    // Replace
    file.message('', {
      start: {line: 1, column: 1},
      end: {line: 1, column: 7}
    }).expected = ['replacement']

    // Delete
    file.message('', {
      start: {line: 1, column: 1},
      end: {line: 1, column: 7}
    }).expected = ['']

    // Insert
    file.message('', {
      start: {line: 1, column: 1},
      end: {line: 1, column: 7}
    }).expected = ['alternative a', 'alternative b']

    // @ts-expect-error We are deliberately testing invalid types here, because
    // the expected field used to be untyped for a long time.
    file.message('', {line: 1, column: 1}).expected = 'insert me'
    // @ts-expect-error
    file.message('', {line: 1, column: 1}).expected = [12]
    file.message('', {line: 1, column: 1})
  }
}
