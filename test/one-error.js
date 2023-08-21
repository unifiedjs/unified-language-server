/** @type {import('unified').Plugin<[], import('mdast').Root>} */
export default function oneError() {
  throw new Error('Whoops!')
}
