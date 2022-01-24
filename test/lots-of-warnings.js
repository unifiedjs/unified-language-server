import assert from 'node:assert'

/** @type {import('unified').Plugin<Array<void>, import('mdast').Root>} */
export default function lotsOfWarnings() {
  return (tree, file) => {
    // This tiny plugins expects running on a `# heading`.
    assert(tree.type === 'root', 'expected `root`')
    const head = tree.children[0]
    assert(head.type === 'heading', 'expected `heading`')
    const headHead = head.children[0]
    assert(headHead.type === 'text', 'expected `text`')

    file.info('info', tree)
    file.message('warning', head)
    Object.assign(file.message('error', headHead), {
      fatal: true,
      ruleId: 'a',
      source: 'b',
      url: 'd',
      actual: 'hi',
      expected: ['hello']
    })
    file.message('node', {
      type: 'a',
      position: {start: {line: 2, column: 3}, end: {line: 2, column: 4}}
    })
    file.message('position', {
      start: {line: 2, column: 3},
      end: {line: 2, column: 4}
    })
    file.message('point', {line: 2, column: 3})
    file.message('nothing')
    Object.assign(file.message('note'), {
      note: 'These are some additional notes'
    })
  }
}
