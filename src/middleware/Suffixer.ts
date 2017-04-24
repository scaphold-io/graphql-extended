import { Middleware, ResolverContext } from './Middleware'
import { ExecutionContext } from '../execution/ExecutionContext'
import { GraphQLScalarType } from 'graphql/type'

export class Suffixer implements Middleware<Map<string, number>, number, mixed> {

  constructor(
    private suffix: string,
  ) {}

  public beforeQuery(): Map<string, number> {
    return new Map<string, number>()
  }

  public afterField(
    _mVal: Map<string, number>,
    _fValue: number,
    value: mixed,
    _eCtx: ExecutionContext,
    mCtx: ResolverContext<mixed>,
  ): string | undefined {
    const returnType = mCtx.info.returnType
    if (
      returnType instanceof GraphQLScalarType &&
      returnType.name === 'String'
    ) {
      return `${value}${this.suffix}`
    }
    return
  }
}
