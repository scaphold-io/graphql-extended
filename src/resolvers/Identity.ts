import {
  GraphQLResolveInfo,
} from 'graphql'

export function Identity(source: {} | string | number | boolean | undefined | null, _a: {} | string | number | boolean | undefined | null, _c: {} | string | number | boolean | undefined | null, info: GraphQLResolveInfo): {} | string | number | boolean | undefined | null {
  return source ? source[info.fieldName] : null
}
