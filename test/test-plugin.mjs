/**
 * @type import('unified').Plugin
 */
export default function unifiedTestPlugin() {
  this.Parser = () => ({type: 'root'})
  this.Compiler = () => 'Formatted output\n'

  return (ast, file) => {
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
  }
}
