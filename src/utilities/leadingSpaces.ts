// Count the number of spaces on the starting side of a string.
export function leadingSpaces(str: string): number {
  let i = 0
  for (; i < str.length; i++) {
    if (str[i] !== ' ') {
      break
    }
  }
  return i
}