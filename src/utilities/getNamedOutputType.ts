import {
  GraphQLOutputType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
} from 'graphql'

export type GraphQLNamedOutputType =
  GraphQLScalarType |
  GraphQLObjectType |
  GraphQLInterfaceType |
  GraphQLUnionType |
  GraphQLEnumType

/**
 * Given a GraphQLOutputType returns the underlying Object, Scalar, Union, Interface, or Enum.
 * @param type
 */
export function getNamedOutputType(
  type: GraphQLOutputType,
): GraphQLNamedOutputType  {
  if (type instanceof GraphQLList) {
    return getNamedOutputType(type.ofType)
  } else if (type instanceof GraphQLNonNull) {
    return getNamedOutputType(type.ofType)
  }
  return type
}
