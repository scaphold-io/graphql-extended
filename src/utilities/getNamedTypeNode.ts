/*
 * @Author: michael.paris
 * @Date: 2017-05-07 16:07:48
 * @Last Modified by: michael.paris
 * @Last Modified time: 2017-05-07 16:08:35
 */
import {
  TypeNode,
  NamedTypeNode,
} from 'graphql'
import {
  LIST_TYPE,
  NON_NULL_TYPE,
} from 'graphql/language/kinds'

export function getNamedTypeNode(typeNode: TypeNode): NamedTypeNode {
  let namedType = typeNode
  while (namedType.kind === LIST_TYPE || namedType.kind === NON_NULL_TYPE) {
    namedType = namedType.type
  }
  return namedType
}
