import {
  GraphQLExtResolveInfo,
} from '../execution/GraphQLExtResolveInfo'
import {
  ExecutionContext,
} from '../execution/ExecutionContext'

// export type MiddlewareValue = mixed
// export type FieldValue = mixed

export interface Middleware<MiddlewareValue, FieldValue, Ctx> {

  /**
   * Runs immediately before a query is executed. Returns a MiddlewareValue that serves as
   * context for this specific middleware function.
   */
  beforeQuery(context: ExecutionContext): MiddlewareValue

  /**
   * Runs immediately after a query is executed. mVal contains the middleware value
   * accumulated by this middleware.
   */
  afterQuery?(mVal: MiddlewareValue, mctx: ExecutionContext): void

  beforeField?(
    mVal: MiddlewareValue,
    eCtx: ExecutionContext,
    mCtx: ResolverContext<Ctx>,
  ): FieldValue

  /**
   * Is provided the middleware wide accumulator, the field accumulator,
   * the resolved value, and all context.
   *
   * Returning a value from this method will change the output for the resolution
   */
  afterField?(
    // The accumulator for this middleware invocation
    mVal: MiddlewareValue,

    // The value returned by beforeField for this field
    fVal: FieldValue,

    // The value returned from the fields resolver
    value: mixed,

    // The execution context
    eCtx: ExecutionContext,

    // All information you might want for the field
    mCtx: ResolverContext<Ctx>,
  ): mixed
}

// export interface BeforeFieldMiddleware<Ctx> {

// }

// export interface AfterFieldMiddleware<Ctx> {

// }

export interface ResolverContext<Ctx> {
  source: mixed,
  args: mixed,
  context: Ctx,
  info: GraphQLExtResolveInfo,
}
