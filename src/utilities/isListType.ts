import {
  GraphQLOutputType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql'

export function isListType(
  type: GraphQLOutputType,
): boolean  {
  if (type instanceof GraphQLList) {
    return true
  } else if (type instanceof GraphQLNonNull) {
    return isListType(type.ofType)
  }
  return false
}
