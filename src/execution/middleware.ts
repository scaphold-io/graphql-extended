import {
  DocumentNode,
} from 'graphql'

type QueryVal = mixed

export interface Middleware<Ctx> {
  beforeQuery(context: MiddlewareContext<Ctx>): QueryVal
  afterQuery(queryVal: QueryVal, context: MiddlewareContext<Ctx>): void
}

export interface BeforeFieldMiddleware<Ctx> {
  beforeField(queryVal: QueryVal, mctx: MiddlewareContext<Ctx>, ctx: Ctx): QueryVal
}

export interface AfterFieldMiddleware<Ctx> {
  afterField(queryVal: QueryVal, mctx: MiddlewareContext<Ctx>, ctx: Ctx): QueryVal
}

interface MiddlewareContext<Ctx> {
  ctx: Ctx
  queryAst: DocumentNode
  operationName: string | null
}
