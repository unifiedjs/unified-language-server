/** @type {import('unified').Plugin<Array<void>, import('mdast').Root>} */
export default function oneError() {
  throw new Error('Whoops!')
}
