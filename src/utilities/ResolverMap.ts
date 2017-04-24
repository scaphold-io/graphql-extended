import {
  GraphQLFieldResolver,
} from 'graphql'

/**
 * For each object type
 */
export type TypeResolverMap<TSource, TContext> = {
  [typeName: string]: {
    [fieldName: string]: GraphQLFieldResolver<TSource, TContext>;
  };
}

export type FieldResolverMap = {[fieldName: string]: GraphQLFieldResolver<mixed, mixed>}
