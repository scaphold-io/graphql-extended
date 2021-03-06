import {
  GraphQLFieldResolver,
} from 'graphql'

import {
  ValueNode,
} from 'graphql/language/ast'

/**
 * For each object type
 */
export type TypeResolverMap<TSource, TContext> = {
  [typeName: string]: {
    [fieldName: string]: GraphQLFieldResolver<TSource, TContext>;
  };
}

export type FieldResolverMap = {[fieldName: string]: GraphQLFieldResolver<mixed, mixed>}

export type ScalarResolver<TInternal, TExternal> = {
  serialize: (value: mixed) => TExternal | null;
  parseValue?: (value: mixed) => TInternal | null;
  parseLiteral?: (valueAST: ValueNode) => TInternal | null;
}

export type ScalarResolverMap<TInternal, TExternal> = {
  [scalarName: string]: ScalarResolver<TInternal, TExternal>,
}
