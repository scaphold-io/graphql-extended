/**
 * @flow
 */

import { parse } from 'graphql'

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLNamedType,
  GraphQLDirective,
} from 'graphql/type'

import { extendSchema } from 'graphql/utilities'

type GraphQLSchemaExtConfig = {
  query: GraphQLObjectType;
  mutation?: GraphQLObjectType;
  subscription?: GraphQLObjectType;
  types?: Array<GraphQLNamedType>;
  directives?: Array<GraphQLDirective>;
}

/**
 * The schemata is an extension of a GraphQLSchema that includes extra
 * functionality to merge schemas, manage directives, and more.
 *
 * Schemata Definition
 *
 * A Schema is created by supplying the root types of each type of operation,
 * query and mutation (optional). A schema definition is then supplied to the
 * validator and executor.
 *
 * Example:
 *
 *     const MyAppSchema = new GraphQLSchema({
 *       query: MyAppQueryRootType,
 *       mutation: MyAppMutationRootType,
 *     })
 *
 * Note: If an array of `directives` are provided to GraphQLSchema, that will be
 * the exact list of directives represented and allowed. If `directives` is not
 * provided then a default set of the specified directives (e.g. @include and
 * @skip) will be used. If you wish to provide *additional* directives to these
 * specified directives, you must explicitly declare them. Example:
 *
 *     const MyAppSchema = new GraphQLSchema({
 *       ...
 *       directives: specifiedDirectives.concat([ myCustomDirective ]),
 *     })
 *
 */
export class GraphQLSchemaExt extends GraphQLSchema {

  constructor(config: GraphQLSchemaExtConfig) {
    super(config)
  }

  public extend(spec: string): void {
    const mergedSchema = extendSchema(this, parse(spec))
    Object.assign(this, mergedSchema)
  }
}
