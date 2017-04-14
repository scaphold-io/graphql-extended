import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLFieldConfigMap,
  GraphQLIsTypeOfFn,
} from 'graphql/type'

import invariant from '../jsutils/invariant'

import { GraphQLDecorator } from './decorator'

function resolveThunk<T>(thunk: Thunk<T>): T {
  return typeof thunk === 'function' ? thunk() : thunk
}

interface GraphQLObjectTypeConfig<TSource, TContext> {

  name: string

  interfaces?: Thunk<Array<GraphQLInterfaceType>>

  directives?: Thunk<Array<GraphQLDecorator>>

  fields: Thunk<GraphQLFieldConfigMap<TSource, TContext>>

  isTypeOf?: GraphQLIsTypeOfFn<TSource, TContext>

  description?: string

  isIntrospection?: boolean

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
export class GraphQLObjectTypeExt extends GraphQLObjectType {

  private _typeConfig: GraphQLObjectTypeConfig<mixed, mixed>

  private _directives: Array<GraphQLDecorator>

  constructor(config: GraphQLObjectTypeConfig<mixed, mixed>) {
    super(config)
  }

  public getDirectives(): Array<GraphQLDecorator> {
    return this._directives || (this._directives =
      defineDirectives(this, this._typeConfig.directives)
    )
  }
}

function defineDirectives(
  type: GraphQLObjectType,
  directivesThunk?: Thunk<Array<GraphQLDecorator>>,
): Array<GraphQLDecorator> {
  if (!directivesThunk) { return [] }
  const directives = resolveThunk(directivesThunk)
  if (!directives) { return [] }
  invariant(
    Array.isArray(directives),
    `${type.name} directives must be an Array or a function which returns ` +
    'an Array.',
  )
  directives.forEach(directive => {
    invariant(
      directive instanceof GraphQLDecorator,
      `${type.name} expects directive values, it cannot` +
      `have directives: ${String(directive)}.`,
    )
  })
  return directives
}
