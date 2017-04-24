import {
  GraphQLResolveInfo,
} from 'graphql'

export function Identity(source: mixed, _a: mixed, _c: mixed, info: GraphQLResolveInfo): mixed {
  return source ? source[info.fieldName] : null
}
