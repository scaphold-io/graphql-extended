import { Location, TokenKind } from 'graphql/language'
import { leadingSpaces } from './leadingSpaces'

/**
 * Given an ast node, returns its string description based on a contiguous
 * block full-line of comments preceding it.
 */
export function getDescription(node: { loc?: Location }): string | undefined {
  const loc = node.loc
  if (!loc) {
    return
  }
  const comments = []
  let minSpaces: number | undefined = undefined
  let token = loc.startToken.prev
  while (
    token &&
    token.kind === TokenKind.COMMENT &&
    token.next && token.prev &&
    token.line + 1 === token.next.line &&
    token.line !== token.prev.line
  ) {
    const value = String(token.value)
    const spaces = leadingSpaces(value)
    if (minSpaces === undefined || spaces < minSpaces) {
      minSpaces = spaces
    }
    comments.push(value)
    token = token.prev
  }
  return comments
    .reverse()
    .map(comment => comment.slice(minSpaces))
    .join('\n')
}
