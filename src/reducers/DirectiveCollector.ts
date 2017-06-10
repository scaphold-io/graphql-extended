import { QueryReducer } from '../execution/QueryReducer'
import { GraphQLDirectiveValue } from '../type/directives'
import {
  GraphQLExtResolveInfo,
} from '../execution/GraphQLExtResolveInfo'
import {
  GraphQLFieldExt,
} from '../type/object'

export default class DirectiveCollector<ReducedDirective> implements QueryReducer<Array<ReducedDirective>, Object> {

  public initial: Array<ReducedDirective>

  constructor(
    private handleDirective: (directive: GraphQLDirectiveValue) => ReducedDirective,
    private reduceContext: (acc: Array<ReducedDirective>, ctx: Object) => Object,
  ) {
    this.initial = []
  }

  public reduceField(
    parent: Array<ReducedDirective>,
    child: Array<ReducedDirective>,
    _ctx: {} | string | number | boolean | undefined | null,
    info: GraphQLExtResolveInfo,
  ): Array<ReducedDirective> {
    const reduced = (info.field as GraphQLFieldExt<{} | string | number | boolean | undefined | null, {} | string | number | boolean | undefined | null>).directives.map(
      directive => this.handleDirective(directive),
    )
    return [...parent, ...reduced, ...child]
  }

  public reduceScalar(): Array<ReducedDirective> {
    return []
  }

  public reduceEnum(): Array<ReducedDirective> {
    return []
  }

  public reduceCtx(acc: Array<ReducedDirective>, ctx: Object): Object {
    return this.reduceContext(acc, ctx)
  }
}
