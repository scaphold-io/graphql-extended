import {
  GraphQLOutputType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql'

export function implementsInterface(
  type: GraphQLOutputType,
  interfaceName: string,
): boolean  {
  if (type instanceof GraphQLList) {
    return implementsInterface(type.ofType, interfaceName)
  } else if (type instanceof GraphQLNonNull) {
    return implementsInterface(type.ofType, interfaceName)
  } else if (type instanceof GraphQLObjectType) {
    return Boolean(type.getInterfaces().find(i => i.name === interfaceName))
  }
  return false
}
