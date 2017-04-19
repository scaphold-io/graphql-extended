import {
  GraphQLResolveInfo,
  ResponsePath,
} from 'graphql'

export interface QueryReducer<Acc, Ctx> {

  initial: Acc

  reduceField(parentAcc: Acc, childAcc: Acc, ctx: Ctx, info: GraphQLResolveInfo): Acc

  reduceScalar(path: ResponsePath, acc: Acc, ctx: Ctx): Acc

  reduceEnum(path: ResponsePath, acc: Acc, ctx: Ctx): Acc

  reduceCtx(acc: Acc, ctx: Ctx): Ctx
}
