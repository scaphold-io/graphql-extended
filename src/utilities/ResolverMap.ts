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

export type FieldResolverMap = {[fieldName: string]: GraphQLFieldResolver<{} | string | number | boolean | undefined | null, {} | string | number | boolean | undefined | null>}

export type ScalarResolver<TInternal, TExternal> = {
  serialize: (value: {} | string | number | boolean | undefined | null) => TExternal | null;
  parseValue?: (value: {} | string | number | boolean | undefined | null) => TInternal | null;
  parseLiteral?: (valueAST: ValueNode) => TInternal | null;
}

export type ScalarResolverMap<TInternal, TExternal> = {
  [scalarName: string]: ScalarResolver<TInternal, TExternal>,
}
