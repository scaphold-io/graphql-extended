import {
  GraphQLResolveInfo,
  GraphQLField,
} from 'graphql'

export interface GraphQLExtResolveInfo extends GraphQLResolveInfo {
  field: GraphQLField<mixed, mixed>
}
