import { QueryReducer } from '../execution/QueryReducer'

export default class ComplexityReducer implements QueryReducer<number, Object> {

  public initial: number

  constructor() {
    this.initial = 0
  }

  public reduceField(parent: number, child: number): number {
    const estimate = 1 + child
    return parent + estimate
  }

  public reduceScalar(): number {
    return 0
  }

  public reduceEnum(): number {
    return 0
  }

  public reduceCtx(acc: number, ctx: Object): Object {
    return {
      ...ctx,
      complexity: acc,
    }
  }
}