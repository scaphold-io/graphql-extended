import {
  GraphQLExtResolveInfo,
} from '../execution/GraphQLExtResolveInfo'
import {
  ExecutionContext,
} from '../execution/ExecutionContext'

// export type MiddlewareValue = {} | string | number | boolean | undefined | null
// export type FieldValue = {} | string | number | boolean | undefined | null

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

  /**
   * Run for each field directly before field resolution.
   *
   * @return Returns a tuple containing a FieldValue and an optional resolution value.
   * If beforeField returns a second value in the tuple, that is the result of the
   * execution. This is convenient for cache checking for example.
   */
  beforeField?(
    mVal: MiddlewareValue,
    eCtx: ExecutionContext,
    mCtx: ResolverContext<Ctx>,
  ): FieldValue

  /**
   * Run for each field directly after field resolution.
   *
   * Returning a value from this method will change the output for the resolution
   */
  afterField?(
    // The accumulator for this middleware invocation
    mVal: MiddlewareValue,

    // The value returned by beforeField for this field
    fVal: FieldValue,

    // The value returned from the fields resolver
    value: {} | string | number | boolean | undefined | null,

    // The execution context
    eCtx: ExecutionContext,

    // All information you might want for the field
    mCtx: ResolverContext<Ctx>,
  ): {} | string | number | boolean | undefined | null
}

export interface ResolverContext<Ctx> {
  source: {} | string | number | boolean | undefined | null,
  args: {} | string | number | boolean | undefined | null,
  context: Ctx,
  info: GraphQLExtResolveInfo,
}
