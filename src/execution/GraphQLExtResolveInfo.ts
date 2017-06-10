import {
  GraphQLResolveInfo,
  GraphQLField,
} from 'graphql'

export interface GraphQLExtResolveInfo extends GraphQLResolveInfo {
  field: GraphQLField<{} | string | number | boolean | undefined | null, {} | string | number | boolean | undefined | null>
}
