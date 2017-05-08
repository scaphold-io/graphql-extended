import {
  GraphQLObjectType,
  GraphQLObjectTypeConfig,
  GraphQLFieldConfig,
  GraphQLField,
} from 'graphql/type'
import {
  GraphQLDirectiveValue,
} from './directives'

import invariant from '../jsutils/invariant'

// import { assertValidName } from 'graphql/utilities/assertValidName'

// function isPlainObj(obj: mixed) {
//   return obj && typeof obj === 'object' && !Array.isArray(obj);
// }

// // If a resolver is defined, it must be a function.
// function isValidResolver(resolver: any): boolean {
//   return (resolver == null || typeof resolver === 'function');
// }

function resolveThunk<T>(thunk: Thunk<T>): T {
  return typeof thunk === 'function' ? thunk() : thunk
}

export interface GraphQLObjectTypeConfigExt<TSource, TContext>
  extends GraphQLObjectTypeConfig<TSource, TContext> {

  directives?: Thunk<Array<GraphQLDirectiveValue>>,

  [prop: string]: mixed,

}

export interface GraphQLFieldConfigMapExt<TSource, TContext> {
  [fieldName: string]: GraphQLFieldConfigExt<TSource, TContext>
}

export interface GraphQLFieldConfigExt<TSource, TContext>
  extends GraphQLFieldConfig<TSource, TContext> {

  directives: Array<GraphQLDirectiveValue>

  [prop: string]: mixed,

}

export interface GraphQLFieldExt<TSource, TContext>
  extends GraphQLField<TSource, TContext> {

  directives: Array<GraphQLDirectiveValue>

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
 *       directives: specifiedDecorators.concat([ myCustomDirective ]),
 *     })
 *
 */
export class GraphQLObjectTypeExt extends GraphQLObjectType {

  private _typeConfig: GraphQLObjectTypeConfigExt<mixed, mixed>

  private _directives: Array<GraphQLDirectiveValue>

  // private _fields: GraphQLFieldMap<mixed, mixed>

  constructor(config: GraphQLObjectTypeConfigExt<mixed, mixed>) {
    super(config)
  }

  // public getFields(): GraphQLFieldMap<mixed, mixed> {
  //   return this._fields || (this._fields =
  //     defineFieldMap(this, this._typeConfig.fields)
  //   )
  // }

  get config(): GraphQLObjectTypeConfigExt<mixed, mixed> {
    return this._typeConfig
  }

  public getDirectives(): Array<GraphQLDirectiveValue> {
    return this._directives || (this._directives =
      defineDirectives(this, this._typeConfig.directives)
    )
  }

  public extendConfig(extra: Object = {}): void {
    this._typeConfig = {
      ...this._typeConfig,
      ...extra,
    }
  }
}

function defineDirectives(
  type: GraphQLObjectType,
  directivesThunk?: Thunk<Array<GraphQLDirectiveValue>>,
): Array<GraphQLDirectiveValue> {
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
      directive instanceof GraphQLDirectiveValue,
      `${type.name} expects directive values, it cannot ` +
      `have directives: ${String(directive)}.`,
    )
  })
  return directives
}
