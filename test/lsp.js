import {createUnifiedLanguageServer} from '../index.js'

createUnifiedLanguageServer({
  plugins: [
    'remark-parse',
    'remark-stringify',
    () => (tree, file) => {
      file.info('info', tree)
      file.message('warning', tree.children[0])
      Object.assign(
        file.message('error', tree.children[0].children[0]),
        {fatal: true, ruleId: 'a', source: 'b', url: 'd', actual: 'hi', expected: ['hello']}
      )

      file.message('node', {
        type: 'a',
        position: {start: {line: 2, column: 3}, end: {line: 2, column: 4}}
      })
      file.message('position', {start: {line: 2, column: 3}, end: {line: 2, column: 4}})
      file.message('point', {line: 2, column: 3})
      file.message('nothing')
    }
  ]
})