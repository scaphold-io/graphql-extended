/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 *
 *  This file is a typescript translation of the one found in graphql-js. It has also
 *  been modified with excess functionality but used the above as a starting point.
 */

import { forEach, isCollection } from 'iterall'

import { GraphQLError, locatedError } from 'graphql/error'
import find from '../jsutils/find'
import invariant from '../jsutils/invariant'
import isNullish from '../jsutils/isNullish'
import { typeFromAST } from 'graphql/utilities/typeFromAST'
import * as Kind from 'graphql/language/kinds'
import { getVariableValues, getArgumentValues } from './values'
import {
  GraphQLSchema,
  GraphQLType,
  GraphQLLeafType,
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLResolveInfo,
  ResponsePath,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInterfaceType,
  GraphQLUnionType,
  isAbstractType,
  GraphQLOutputType,
} from 'graphql/type'
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from 'graphql/type/introspection'
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from 'graphql/type/directives'
import {
  DirectiveNode,
  DocumentNode,
  OperationDefinitionNode,
  SelectionSetNode,
  FieldNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
} from 'graphql/language/ast'

import { QueryReducer } from './queryReducer'
import { Middleware } from '../middleware/Middleware'
import { ExecutionContext } from './ExecutionContext'
import { GraphQLExtResolveInfo } from './GraphQLExtResolveInfo'

/**
 * Terminology
 *
 * "Definitions" are the generic name for top-level statements in the document.
 * Examples of this include:
 * 1) Operations (such as a query)
 * 2) Fragments
 *
 * "Operations" are a generic name for requests in the document.
 * Examples of this include:
 * 1) query,
 * 2) mutation
 *
 * "Selections" are the definitions that can appear legally and at
 * single level of the query. These include:
 * 1) field references e.g "a"
 * 2) fragment "spreads" e.g. "...c"
 * 3) inline fragment "spreads" e.g. "...on Type { a }"
 */

/**
 * The result of GraphQL execution.
 *
 *   - `data` is the result of a successful execution of the query.
 *   - `errors` is included when any errors occurred as a non-empty array.
 */
export type ExecutionResult = {
  data?: {[key: string]: mixed} | null;
  errors?: Array<GraphQLError>;
}

/**
 * All information needed for middleware to function
 */
type MiddlewareContext = {
  middleware: Array<Middleware<mixed, mixed, mixed>>;
  middlewareValues: Array<mixed>;
}

type ExecutionConfig = {
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: {[key: string]: mixed},
  operationName?: string,
  queryReducers?: Array<QueryReducer<mixed, mixed>>,
  middleware?: Array<Middleware<mixed, mixed, mixed>>,
}

/**
 * Implements the "Evaluating requests" section of the GraphQL specification.
 *
 * Returns a Promise that will eventually be resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function execute({
  schema,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  queryReducers,
  middleware,
}: ExecutionConfig): Promise<ExecutionResult> {
  invariant(schema, 'Must provide schema')
  invariant(document, 'Must provide document')
  invariant(
    schema instanceof GraphQLSchema,
    'Schema must be an instance of GraphQLSchema. Also ensure that there are ' +
    'not multiple versions of GraphQL installed in your node_modules directory.',
  )

  // Variables, if provided, must be an object.
  invariant(
    !variableValues || typeof variableValues === 'object',
    'Variables must be provided as an Object where each property is a ' +
    'variable value. Perhaps look to see if an unparsed JSON string ' +
    'was provided.',
  )

  // If a valid context cannot be created due to incorrect arguments,
  // this will throw an error.
  const context = buildExecutionContext(
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
  )

  // If there is middleware create the context.
  const middlewareContext = buildMiddlewareContext(context, middleware)

  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.'
  let ctx: ExecutionContext
  return new Promise(resolve => {
    resolve(reduceQueryIfNeeded(queryReducers, context))
  }).then((c: ExecutionContext) => new Promise(resolve => {
    ctx = c
    resolve(executeOperation(c, c.operation, rootValue, middlewareContext))
  })).then(undefined, error => {
    // Errors from sub-fields of a NonNull type may propagate to the top level,
    // at which point we still log the error and null the parent field, which
    // in this case is the entire response.
    ctx.errors.push(error)
    return null
  }).then(data => {
    runAfterQueryware(ctx, middlewareContext)
    if (!ctx.errors.length) {
      return { data }
    }
    return { data, errors: ctx.errors }
  })
}

function reduceQueryIfNeeded(
  queryReducers: Array<QueryReducer<mixed, mixed>> = [],
  context: ExecutionContext,
): Promise<ExecutionContext> {
  // If there are no reducers, don't bother walking the query
  if (queryReducers.length) {
    return reduceQuery(queryReducers, context)
  } else {
    return Promise.resolve(context)
  }
}

function reduceQuery(
  queryReducers: Array<QueryReducer<mixed, mixed>> = [],
  exeContext: ExecutionContext,
): Promise<ExecutionContext> {

  const type = getOperationRootType(exeContext.schema, exeContext.operation)
  const fields = collectFields(
    exeContext,
    type,
    exeContext.operation.selectionSet,
    Object.create(null),
    Object.create(null),
  )

  const initialValues = queryReducers.map(r => r.initial)

  /**
   * Kick off the top level
   */
  const finalResults = Object.keys(fields).reduce(
    (acc, fieldName) => {
      const fieldNodes = fields[fieldName]
      const fieldPath = addPath(undefined, fieldName)

      const fieldNode = fieldNodes[0]
      const fname = fieldNode.name.value

      const fieldDef = getFieldDef(exeContext.schema, type, fname)

      if (!fieldDef) {
        return acc
      }

      const childReduced = reduceType(
          exeContext,
          fieldPath,
          fieldDef.type,
          fieldNode.selectionSet!,
          queryReducers,
          [ ...initialValues ])

      for (let ind = 0; ind < queryReducers.length; ind++) {

        const reducer = queryReducers[ind]

        const returnType = fieldDef.type

        // The resolve function's optional third argument is a context value that
        // is provided to every resolve function within an execution. It is commonly
        // used to represent an authenticated user, or request-specific caches.
        const context = exeContext.contextValue

        // The resolve function's optional fourth argument is a collection of
        // information about the current execution state.
        const info: GraphQLExtResolveInfo = {
          field: fieldDef,
          fieldName,
          fieldNodes,
          returnType,
          parentType: type,
          path: fieldPath,
          schema: exeContext.schema,
          fragments: exeContext.fragments,
          rootValue: exeContext.rootValue,
          operation: exeContext.operation,
          variableValues: exeContext.variableValues,
        }

        acc[ind] = reducer.reduceField(acc[ind], childReduced[ind], context, info)
      }
      return acc
    },
    [ ...initialValues ],
  )

  /**
   * Reduce context
   */
  return queryReducers.reduce((acc, reducer, i) => {
    const ai = finalResults[i]
    return acc.then(ctx => Promise.resolve(reducer.reduceCtx(ai, ctx)))
  }, Promise.resolve(exeContext.contextValue)).then(ctx => ({
    ...exeContext,
    contextValue: ctx,
  }))
}

function reduceType(
  exeContext: ExecutionContext,
  path: ResponsePath,
  type: GraphQLOutputType,
  selection: SelectionSetNode,
  queryReducers: Array<QueryReducer<mixed, mixed>>,
  reductions: Array<mixed>,
): Array<mixed> {
  if (type instanceof GraphQLObjectType) {
    const innerfields = collectFields(
      exeContext,
      type,
      selection,
      Object.create(null),
      Object.create(null),
    )
    return Object.keys(innerfields).reduce(
      (acc, fieldName) => {
        const fieldNodes = innerfields[fieldName]
        const fieldPath = addPath(path, fieldName)

        const fieldNode = fieldNodes[0]
        const fname = fieldNode.name.value

        const fieldDef = getFieldDef(exeContext.schema, type, fname)

        if (!fieldDef) {
          return acc
        }

        const childReduced = reduceType(
          exeContext,
          fieldPath,
          fieldDef.type,
          fieldNode.selectionSet!,
          queryReducers,
          [ ...reductions ])

        const returnType = fieldDef.type

        for (let ind = 0; ind < queryReducers.length; ind++) {

          const reducer = queryReducers[ind]

          // The resolve function's optional third argument is a context value that
          // is provided to every resolve function within an execution. It is commonly
          // used to represent an authenticated user, or request-specific caches.
          const context = exeContext.contextValue

          // The resolve function's optional fourth argument is a collection of
          // information about the current execution state.
          const info: GraphQLResolveInfo = {
            fieldName,
            fieldNodes,
            returnType,
            parentType: type,
            path: fieldPath,
            schema: exeContext.schema,
            fragments: exeContext.fragments,
            rootValue: exeContext.rootValue,
            operation: exeContext.operation,
            variableValues: exeContext.variableValues,
          }

          acc[ind] = reducer.reduceField(acc[ind], childReduced[ind], context, info)
        }
        return acc
      },
      reductions,
    )
  } else if (type instanceof GraphQLScalarType) {
    return queryReducers.map(
      (reducer, i) => reducer.reduceScalar(path, reductions[i], exeContext.contextValue),
    )
  } else if (type instanceof GraphQLEnumType) {
    return queryReducers.map(
      (reducer, i) => reducer.reduceEnum(path, reductions[i], exeContext.contextValue),
    )
  } else if (type instanceof GraphQLNonNull) {
    return reduceType(exeContext, path, type.ofType, selection, queryReducers, reductions)
  } else if (type instanceof GraphQLList) {
    return reduceType(exeContext, path, type.ofType, selection, queryReducers, reductions)
  }
  return reductions
}

/**
 * Given a ResponsePath (found in the `path` entry in the information provided
 * as the last argument to a field resolver), return an Array of the path keys.
 */
export function responsePathAsArray(
  path: ResponsePath,
): Array<string | number> {
  const flattened = []
  let curr = path
  while (curr) {
    flattened.push(curr.key)
    curr = curr.prev
  }
  return flattened.reverse()
}

function addPath(prev: ResponsePath, key: string | number): { prev: ResponsePath, key: string | number } {
  return { prev, key }
}

/**
 * Builds the middleware context
 */
function buildMiddlewareContext(
  exeContext: ExecutionContext,
  middleware: Array<Middleware<mixed, mixed, mixed>> = [],
): MiddlewareContext {
  // All middleware must have a beforeQuery method to initialize the query value
  const validMiddleware = middleware.reduce(
    (acc, midd) => ((midd && typeof midd.beforeQuery  === 'function') ? [...acc, midd] : acc),
    [] as Array<Middleware<mixed, mixed, mixed>>,
  )
  const middlewareValues = validMiddleware.map(
    midd => midd.beforeQuery(exeContext),
  )
  return {
    middleware: validMiddleware,
    middlewareValues,
  }
}

function runAfterQueryware(
  exeContext: ExecutionContext,
  middlewareContext: MiddlewareContext,
) {
  try {
    for (let i = 0; i < middlewareContext.middleware.length; i++) {
      const midd = middlewareContext.middleware[i]
      if (typeof midd.afterQuery === 'function') {
        midd.afterQuery(middlewareContext.middlewareValues[i], exeContext)
      }
    }
  } catch (e) {
    exeContext.errors.push(e)
  }
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 */
function buildExecutionContext(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue: mixed,
  contextValue: mixed,
  rawVariableValues: {[key: string]: mixed} | undefined,
  operationName: string | undefined,
): ExecutionContext {
  const errors: Array<GraphQLError> = []
  let operation: OperationDefinitionNode | undefined = undefined
  const fragments: {[name: string]: FragmentDefinitionNode} = Object.create(null)
  document.definitions.forEach(definition => {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (!operationName && operation) {
          throw new GraphQLError(
            'Must provide operation name if query contains multiple operations.',
          )
        }
        if (!operationName ||
            definition.name && definition.name.value === operationName) {
          operation = definition
        }
        break
      case Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition
        break
      default: throw new GraphQLError(
        `GraphQL cannot execute a request containing a ${definition.kind}.`,
        [ definition ],
      )
    }
  })
  if (!operation) {
    if (operationName) {
      throw new GraphQLError(`Unknown operation named "${operationName}".`)
    } else {
      throw new GraphQLError('Must provide an operation.')
    }
  }
  const variableValues = getVariableValues(
    schema,
    (operation as OperationDefinitionNode).variableDefinitions || [],
    rawVariableValues || {},
  )

  return {
    schema,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues,
    errors,
  }
}

/**
 * Implements the "Evaluating operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
  operation: OperationDefinitionNode,
  rootValue: mixed,
  middlewareContext: MiddlewareContext,
): Promise<{[key: string]: mixed}> | {[key: string]: mixed} {
  const type = getOperationRootType(exeContext.schema, operation)
  const fields = collectFields(
    exeContext,
    type,
    operation.selectionSet,
    Object.create(null),
    Object.create(null),
  )

  const path = undefined

  if (operation.operation === 'mutation') {
    return executeFieldsSerially(exeContext, type, rootValue, path, fields, middlewareContext)
  }
  return executeFields(exeContext, type, rootValue, path, fields, middlewareContext)
}

/**
 * Extracts the root type of the operation from the schema.
 */
function getOperationRootType(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode,
): GraphQLObjectType {
  switch (operation.operation) {
    case 'query':
      return schema.getQueryType()
    case 'mutation':
      const mutationType = schema.getMutationType()
      if (!mutationType) {
        throw new GraphQLError(
          'Schema is not configured for mutations',
          [ operation ],
        )
      }
      return mutationType
    case 'subscription':
      const subscriptionType = schema.getSubscriptionType()
      if (!subscriptionType) {
        throw new GraphQLError(
          'Schema is not configured for subscriptions',
          [ operation ],
        )
      }
      return subscriptionType
    default:
      throw new GraphQLError(
        'Can only execute queries, mutations and subscriptions',
        [ operation ],
      )
  }
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: ResponsePath,
  fields: {[key: string]: Array<FieldNode>},
  middlewareContext: MiddlewareContext,
): Promise<{[key: string]: mixed}> {
  return Object.keys(fields).reduce(
    (prevPromise, responseName) => prevPromise.then(results => {
      const fieldNodes = fields[responseName]
      const fieldPath = addPath(path, responseName)
      const result = resolveField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
        middlewareContext,
      )
      if (result === undefined) {
        return results
      }
      const promise = getPromise(result)
      if (promise) {
        return promise.then(resolvedResult => {
          results[responseName] = resolvedResult
          return results
        })
      }
      results[responseName] = result
      return results
    }),
    Promise.resolve({}),
  )
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "read" mode.
 */
function executeFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: ResponsePath,
  fields: {[key: string]: Array<FieldNode>},
  middlewareContext: MiddlewareContext,
): MaybePromise<{[key: string]: mixed}> {
  let containsPromise = false

  const finalResults = Object.keys(fields).reduce(
    (results, responseName) => {
      const fieldNodes = fields[responseName]
      const fieldPath = addPath(path, responseName)
      const result = resolveField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
        middlewareContext,
      )
      if (result === undefined) {
        return results
      }
      results[responseName] = result
      if (getPromise(result)) {
        containsPromise = true
      }
      return results
    },
    {},
  )

  // If there are no promises, we can just return the object
  if (!containsPromise) {
    return finalResults
  }

  // Otherwise, results is a map from field name to the result
  // of resolving that field, which is possibly a promise. Return
  // a promise that will return this same map, but with any
  // promises replaced with the values they resolved to.
  return promiseForObject(finalResults)
}

/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns and Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 */
function collectFields(
  exeContext: ExecutionContext,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: {[key: string]: Array<FieldNode>},
  visitedFragmentNames: {[key: string]: boolean},
): {[key: string]: Array<FieldNode>} {
  for (let selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD:
        if (!shouldIncludeNode(exeContext, selection.directives)) {
          continue
        }
        const name = getFieldEntryKey(selection)
        if (!fields[name]) {
          fields[name] = []
        }
        fields[name].push(selection)
        break
      case Kind.INLINE_FRAGMENT:
        if (!shouldIncludeNode(exeContext, selection.directives) ||
            !doesFragmentConditionMatch(exeContext, selection, runtimeType)) {
          continue
        }
        collectFields(
          exeContext,
          runtimeType,
          selection.selectionSet,
          fields,
          visitedFragmentNames,
        )
        break
      case Kind.FRAGMENT_SPREAD:
        const fragName = selection.name.value
        if (visitedFragmentNames[fragName] ||
            !shouldIncludeNode(exeContext, selection.directives)) {
          continue
        }
        visitedFragmentNames[fragName] = true
        const fragment = exeContext.fragments[fragName]
        if (!fragment ||
            !doesFragmentConditionMatch(exeContext, fragment, runtimeType)) {
          continue
        }
        collectFields(
          exeContext,
          runtimeType,
          fragment.selectionSet,
          fields,
          visitedFragmentNames,
        )
        break
      default:
        break
    }
  }
  return fields
}

/**
 * Determines if a field should be included based on the @include and @skip
 * directives, where @skip has higher precidence than @include.
 */
function shouldIncludeNode(
  exeContext: ExecutionContext,
  directives: Array<DirectiveNode> = [],
): boolean {
  const skipNode = directives && find(
    directives,
    directive => directive.name.value === GraphQLSkipDirective.name,
  )
  if (skipNode) {
    const { if: skipIf } = getArgumentValues(
      GraphQLSkipDirective,
      skipNode,
      exeContext.variableValues,
    )
    if (skipIf === true) {
      return false
    }
  }

  const includeNode = directives && find(
    directives,
    directive => directive.name.value === GraphQLIncludeDirective.name,
  )
  if (includeNode) {
    const { if: includeIf } = getArgumentValues(
      GraphQLIncludeDirective,
      includeNode,
      exeContext.variableValues,
    )
    if (includeIf === false) {
      return false
    }
  }

  return true
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  exeContext: ExecutionContext,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLObjectType,
): boolean {
  const typeConditionNode = fragment.typeCondition
  if (!typeConditionNode) {
    return true
  }
  const conditionalType = typeFromAST(exeContext.schema, typeConditionNode)
  if (conditionalType === type) {
    return true
  }
  if (isAbstractType(conditionalType)) {
    const abstractType = conditionalType
    return exeContext.schema.isPossibleType(abstractType, type)
  }
  return false
}

/**
 * This function transforms a JS object `{[key: string]: Promise<T>}` into
 * a `Promise<{[key: string]: T}>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
function promiseForObject<T>(
  object: {[key: string]: Promise<T>},
): Promise<{[key: string]: T}> {
  const keys = Object.keys(object)
  const valuesAndPromises = keys.map(name => object[name])
  return Promise.all(valuesAndPromises).then(
    values => values.reduce((resolvedObject, value, i) => {
      resolvedObject[keys[i]] = value
      return resolvedObject
    }, {}),
  )
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value
}

/**
 * Resolves the field on the given source object. In particular, this
 * figures out the value that the field returns by calling its resolve function,
 * then calls completeValue to complete promises, serialize scalars, or execute
 * the sub-selection-set for objects.
 */
function resolveField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: mixed,
  fieldNodes: Array<FieldNode>,
  path: ResponsePath,
  middlewareContext: MiddlewareContext,
): mixed {
  const fieldNode = fieldNodes[0]
  const fieldName = fieldNode.name.value

  const fieldDef = getFieldDef(exeContext.schema, parentType, fieldName)
  if (!fieldDef) {
    return
  }

  const returnType = fieldDef.type
  const resolveFn = fieldDef.resolve || defaultFieldResolver

  // The resolve function's optional third argument is a context value that
  // is provided to every resolve function within an execution. It is commonly
  // used to represent an authenticated user, or request-specific caches.
  const context = exeContext.contextValue

  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  const info: GraphQLExtResolveInfo = {
    field: fieldDef,
    fieldName,
    fieldNodes,
    returnType,
    parentType,
    path,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  }

  // Get the resolve function, regardless of if its result is normal
  // or abrupt (error).
  const result = resolveOrError(
    exeContext,
    fieldDef,
    fieldNode,
    resolveFn,
    source,
    context,
    info,
    middlewareContext,
  )

  return completeValueCatchingError(
    exeContext,
    returnType,
    fieldNodes,
    info,
    path,
    result,
    middlewareContext,
  )
}

// Isolates the "ReturnOrAbrupt" behavior to not de-opt the `resolveField`
// function. Returns the result of resolveFn or the abrupt-return Error object.
function resolveOrError<TSource, TContext>(
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<TSource, TContext>,
  fieldNode: FieldNode,
  resolveFn: GraphQLFieldResolver<TSource, TContext>,
  source: TSource,
  context: TContext,
  info: GraphQLExtResolveInfo,
  middlewareContext: MiddlewareContext,
): Error | mixed {
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      fieldDef,
      fieldNode,
      exeContext.variableValues,
    )

    const resolverArgs = {
      source,
      args,
      context,
      info,
    }

    // Run before middleware and keep track of the field values for each middleware.
    const beforeFieldMiddleware = middlewareContext.middleware.map(
      (midd, i) => midd.beforeField ?
        midd.beforeField(middlewareContext.middlewareValues[i], exeContext, resolverArgs) :
        null,
    )

    // Reduces all afterField middlewares into a single promise containing the final result
    // for the field.
    const runAfterware = (value: mixed): MaybePromise<mixed> => {
      // If there are no middleware functions then don't bother running this.
      if (middlewareContext.middleware.length === 0) {
        return value
      }
      /**
       * Reduces right to left for pipelining middleware effect
       */
      return middlewareContext.middleware.reduceRight((acc, mid, i) => {
        const fieldVal = beforeFieldMiddleware[i]
        if (mid && (typeof mid.afterField === 'function')) {
          return acc.then(v =>
            Promise.resolve(
              mid.afterField!(
                middlewareContext.middlewareValues[i],
                fieldVal,
                v,
                exeContext,
                resolverArgs,
              ),
            ).then(
              // If afterField returned a value then propogate that on
              // to the next middlware function in the composition.
              // If no value was returned then propogate the previous value.
              middlewareVal => middlewareVal ? middlewareVal : v,
            ),
          )
        }
        return acc
      }, Promise.resolve(value))
    }

    const result = resolveFn(source, args, context, info)

    return runAfterware(result)
  } catch (error) {
    // Sometimes a non-error is thrown, wrap it as an Error for a
    // consistent interface.
    return error instanceof Error ? error : new Error(error)
  }
}

// This is a small wrapper around completeValue which detects and logs errors
// in the execution context.
function completeValueCatchingError(
  exeContext: ExecutionContext,
  returnType: GraphQLType,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
  path: ResponsePath,
  result: mixed,
  middlewareContext: MiddlewareContext,
): mixed {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (returnType instanceof GraphQLNonNull) {
    return completeValueWithLocatedError(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      middlewareContext,
    )
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  try {
    const completed = completeValueWithLocatedError(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      middlewareContext,
    )
    const promise = getPromise(completed)
    if (promise) {
      // If `completeValueWithLocatedError` returned a rejected promise, log
      // the rejection error and resolve to null.
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return promise.then(undefined, error => {
        exeContext.errors.push(error)
        return Promise.resolve(null)
      })
    }
    return completed
  } catch (error) {
    // If `completeValueWithLocatedError` returned abruptly (threw an error),
    // log the error and return null.
    exeContext.errors.push(error)
    return null
  }
}

// This is a small wrapper around completeValue which annotates errors with
// location information.
function completeValueWithLocatedError(
  exeContext: ExecutionContext,
  returnType: GraphQLType,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
  path: ResponsePath,
  result: mixed,
  middlewareContext: MiddlewareContext,
): mixed {
  try {
    const completed = completeValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      middlewareContext,
    )
    const promise = getPromise(completed)
    if (promise) {
      return promise.then(
        undefined,
        error => Promise.reject(
          locatedError(error, fieldNodes, responsePathAsArray(path)),
        ),
      )
    }
    return completed
  } catch (error) {
    throw locatedError(error, fieldNodes, responsePathAsArray(path))
  }
}

/**
 * Implements the instructions for completeValue as defined in the
 * "Field entries" section of the spec.
 *
 * If the field type is Non-Null, then this recursively completes the value
 * for the inner type. It throws a field error if that completion returns null,
 * as per the "Nullability" section of the spec.
 *
 * If the field type is a List, then this recursively completes the value
 * for the inner type on each item in the list.
 *
 * If the field type is a Scalar or Enum, ensures the completed value is a legal
 * value of the type by calling the `serialize` method of GraphQL type
 * definition.
 *
 * If the field is an abstract type, determine the runtime type of the value
 * and then complete based on that type
 *
 * Otherwise, the field type expects a sub-selection set, and will complete the
 * value by evaluating all sub-selections.
 */
function completeValue(
  exeContext: ExecutionContext,
  returnType: GraphQLType,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
  path: ResponsePath,
  result: mixed,
  middlewareContext: MiddlewareContext,
): mixed {
  // If result is a Promise, apply-lift over completeValue.
  const promise = getPromise(result)
  if (promise) {
    return promise.then(
      resolved => completeValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        resolved,
        middlewareContext,
      ),
    )
  }

  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (returnType instanceof GraphQLNonNull) {
    const completed = completeValue(
      exeContext,
      returnType.ofType,
      fieldNodes,
      info,
      path,
      result,
      middlewareContext,
    )
    if (completed === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${
          info.parentType.name}.${info.fieldName}.`,
      )
    }
    return completed
  }

  // If result value is null-ish (null, undefined, or NaN) then return null.
  if (isNullish(result)) {
    return null
  }

  // If field type is List, complete each item in the list with the inner type
  if (returnType instanceof GraphQLList) {
    return completeListValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      middlewareContext,
    )
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (returnType instanceof GraphQLScalarType ||
      returnType instanceof GraphQLEnumType) {
    return completeLeafValue(returnType, result)
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (returnType instanceof GraphQLInterfaceType ||
      returnType instanceof GraphQLUnionType) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      middlewareContext,
    )
  }

  // If field type is Object, execute and complete all sub-selections.
  if (returnType instanceof GraphQLObjectType) {
    return completeObjectValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      middlewareContext,
    )
  }

  // Not reachable. All possible output types have been considered.
  throw new Error(
    `Cannot complete value of unexpected type "${String(returnType)}".`,
  )
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnType: GraphQLList<GraphQLType>,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
  path: ResponsePath,
  result: mixed,
  middlewareContext: MiddlewareContext,
): mixed {
  invariant(
    isCollection(result),
    `Expected Iterable, but did not find one for field ${
      info.parentType.name}.${info.fieldName}.`,
  )

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  const itemType = returnType.ofType
  let containsPromise = false
  const completedResults: Array<mixed> = []
  forEach(result as Array<mixed>, (item, index) => {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const fieldPath = addPath(path, index)
    const completedItem = completeValueCatchingError(
      exeContext,
      itemType,
      fieldNodes,
      info,
      fieldPath,
      item,
      middlewareContext,
    )

    if (!containsPromise && getPromise(completedItem)) {
      containsPromise = true
    }
    completedResults.push(completedItem)
  })

  return containsPromise ? Promise.all(completedResults) : completedResults
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(
  returnType: GraphQLLeafType,
  result: mixed,
): mixed {
  invariant(returnType.serialize, 'Missing serialize method on type')
  const serializedResult = returnType.serialize(result)
  if (isNullish(serializedResult)) {
    throw new Error(
      `Expected a value of type "${String(returnType)}" but ` +
      `received: ${String(result)}`,
    )
  }
  return serializedResult
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
  path: ResponsePath,
  result: mixed,
  middlewareContext: MiddlewareContext,
): mixed {
  const runtimeType = returnType.resolveType ?
    returnType.resolveType(result, exeContext.contextValue, info) :
    defaultResolveTypeFn(result, exeContext.contextValue, info, returnType)

  const promise = getPromise(runtimeType)
  if (promise) {
    return promise.then(resolvedRuntimeType =>
      completeObjectValue(
        exeContext,
        ensureValidRuntimeType(
          resolvedRuntimeType,
          exeContext,
          returnType,
          fieldNodes,
          info,
          result,
        ),
        fieldNodes,
        info,
        path,
        result,
        middlewareContext,
      ),
    )
  }

  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(
      runtimeType as (string | GraphQLObjectType),
      exeContext,
      returnType,
      fieldNodes,
      info,
      result,
    ),
    fieldNodes,
    info,
    path,
    result,
    middlewareContext,
  )
}

function ensureValidRuntimeType(
  runtimeTypeOrName: GraphQLObjectType | string,
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
  result: mixed,
): GraphQLObjectType {
  const runtimeType = typeof runtimeTypeOrName === 'string' ?
    exeContext.schema.getType(runtimeTypeOrName) :
    runtimeTypeOrName

  if (!(runtimeType instanceof GraphQLObjectType)) {
    throw new GraphQLError(
      `Abstract type ${returnType.name} must resolve to an Object type at ` +
      `runtime for field ${info.parentType.name}.${info.fieldName} with ` +
      `value "${String(result)}", received "${String(runtimeType)}".`,
      fieldNodes,
    )
  }

  if (!exeContext.schema.isPossibleType(returnType, runtimeType)) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type ` +
      `for "${returnType.name}".`,
      fieldNodes,
    )
  }

  return runtimeType
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
  path: ResponsePath,
  result: mixed,
  middlewareContext: MiddlewareContext,
): mixed {
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf) {
    const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info)

    const promise = getPromise(isTypeOf)
    if (promise) {
      return promise.then(isTypeOfResult => {
        if (!isTypeOfResult) {
          throw invalidReturnTypeError(returnType, result, fieldNodes)
        }
        return collectAndExecuteSubfields(
          exeContext,
          returnType,
          fieldNodes,
          info,
          path,
          result,
          middlewareContext,
        )
      })
    }

    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldNodes)
    }
  }

  return collectAndExecuteSubfields(
    exeContext,
    returnType,
    fieldNodes,
    info,
    path,
    result,
    middlewareContext,
  )
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: mixed,
  fieldNodes: Array<FieldNode>,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${String(result)}.`,
    fieldNodes,
  )
}

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldNodes: Array<FieldNode>,
  _info: GraphQLResolveInfo,
  path: ResponsePath,
  result: mixed,
  middlewareContext: MiddlewareContext,
): mixed {
  // Collect sub-fields to execute to complete this value.
  let subFieldNodes = Object.create(null)
  const visitedFragmentNames = Object.create(null)
  for (let node of fieldNodes) {
    const selectionSet = node.selectionSet
    if (selectionSet) {
      subFieldNodes = collectFields(
        exeContext,
        returnType,
        selectionSet,
        subFieldNodes,
        visitedFragmentNames,
      )
    }
  }

  return executeFields(exeContext, returnType, result, path, subFieldNodes, middlewareContext)
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which tests each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
function defaultResolveTypeFn(
  value: mixed,
  context: mixed,
  info: GraphQLResolveInfo,
  abstractType: GraphQLAbstractType,
): MaybePromise<GraphQLObjectType> | undefined {
  const possibleTypes = info.schema.getPossibleTypes(abstractType)
  const promisedIsTypeOfResults = []

  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i]

    if (type.isTypeOf) {
      const isTypeOfResult = type.isTypeOf(value, context, info)

      const promise = getPromise(isTypeOfResult)
      if (promise) {
        promisedIsTypeOfResults[i] = promise
      } else if (isTypeOfResult) {
        return type
      }
    }
  }

  if (promisedIsTypeOfResults.length) {
    return Promise.all(promisedIsTypeOfResults).then(isTypeOfResults => {
      for (let i = 0; i < isTypeOfResults.length; i++) {
        if (isTypeOfResults[i]) {
          return possibleTypes[i]
        }
      }
    })
  }
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context.
 */
export const defaultFieldResolver: GraphQLFieldResolver<mixed, mixed> =
  (source, args, context, info) => {
    // ensure source is a value for which property access is acceptable.
    if (source && (typeof source === 'object' || typeof source === 'function')) {
      const property = source[info.fieldName]
      if (typeof property === 'function') {
        return source[info.fieldName](args, context, info)
      }
      return property
    }
  }

/**
 * Only returns the value if it acts like a Promise, i.e. has a "then" function,
 * otherwise returns void.
 */
function getPromise<T>(value: Promise<T> | mixed): Promise<T> | void {
  if (typeof value === 'object' &&
      value !== null &&
      typeof value['then'] === 'function'
  ) {
    return value as Promise<T>
  }
}

/**
 * This method looks up the field on the given type defintion.
 * It has special casing for the two introspection fields, __schema
 * and __typename. __typename is special because it can always be
 * queried as a field, even in situations where no other fields
 * are allowed, like on a Union. __schema could get automatically
 * added to the query type, but that would require mutating type
 * definitions, which would cause issues.
 */
function getFieldDef(
  schema: GraphQLSchema,
  parentType: GraphQLObjectType,
  fieldName: string,
): GraphQLField<mixed, mixed> {
  if (fieldName === SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
    return SchemaMetaFieldDef
  } else if (fieldName === TypeMetaFieldDef.name &&
             schema.getQueryType() === parentType) {
    return TypeMetaFieldDef
  } else if (fieldName === TypeNameMetaFieldDef.name) {
    return TypeNameMetaFieldDef
  }
  return parentType.getFields()[fieldName]
}
