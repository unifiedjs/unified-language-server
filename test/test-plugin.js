/**
 * @typedef {object} UnifiedTestPluginOptions
 * @property {'plugin' | 'transformer'} [error]
 */

/**
 * @type import('unified').Plugin<[UnifiedTestPluginOptions]>
 */
export default function unifiedTestPlugin({error} = {}) {
  this.Parser = () => ({type: 'root'})
  this.Compiler = () => 'Formatted output\n'

  if (error === 'plugin') {
    throw new Error('Plugin error')
  }

  return (ast, file) => {
    if (error === 'transformer') {
      throw new Error('Transformer error')
    }

    const value = String(file)
    if (value.includes('no position')) {
      file.message('no position')
    }

    if (value.includes('no end')) {
      file.message('no end', {line: 1, column: 1})
    }

    if (value.includes('start end')) {
      file.message('start end', {
        start: {line: 1, column: 1},
        end: {line: 2, column: 10}
      })
    }

    if (value.includes('no start')) {
      file.message('no start', {
        // @ts-expect-error Some plugins report this. The language server should
        // handle it.
        start: {line: null, column: null},
        end: {line: 2, column: 10}
      })
    }

    if (value.includes('fatal true')) {
      const message = file.message('fatal true')
      message.fatal = true
    }

    if (value.includes('fatal unknown')) {
      const message = file.message('fatal unknown')
      message.fatal = null
    }

    if (value.includes('has ruleId')) {
      const message = file.message('has ruleId')
      message.ruleId = 'test-rule'
    }

    if (value.includes('has source')) {
      const message = file.message('has source')
      message.source = 'test-source'
    }

    if (value.includes('has url')) {
      const message = file.message('has url')
      message.url = 'https://example.com'
    }

    if (value.includes('expected')) {
      const message = file.message('expected')
      message.expected = ['suggestion']
    }

    if (value.includes('has error')) {
      throw new Error('Test error')
    }
  }
}
