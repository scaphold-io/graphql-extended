import { Middleware, ResolverContext } from './Middleware'
import { ExecutionContext } from '../execution/ExecutionContext'

type FieldTimerTimeUnit = 'milli' | 'micro' | 'nano'

export class ResolverTimer implements Middleware<Map<string, number>, number, mixed> {

  constructor(
    private logger: (
      totalRunTime: number,
      resolverDurationMap: Map<string, number>,
    ) => mixed | void,
    private timeUnit: FieldTimerTimeUnit = 'milli',
  ) {}

  public beforeQuery(): Map<string, number> {
    const contextmap = new Map()
    contextmap.set('__START__', this.getTime())
    return contextmap
  }

  public beforeField(): number {
    return this.getTime()
  }

  public afterField(
    mVal: Map<string, number>,
    fValue: number,
    _value: mixed,
    _eCtx: ExecutionContext,
    mCtx: ResolverContext<mixed>,
  ): undefined {
    mVal.set(
      `${mCtx.info.parentType.name}.${mCtx.info.fieldName}`,
      this.getTime() - fValue,
    )
    return
  }

  public afterQuery(mVal: Map<string, number>): void {
    const totalRuntime = this.getTime() - (mVal.get('__START__') as number)
    mVal.delete('__START__')
    this.logger(totalRuntime, mVal)
  }

  private getTime(): number {
    const hrTime = process.hrtime()
    switch (this.timeUnit) {
      case 'milli': return hrTime[0] * 1000 + hrTime[1] / 1000000
      case 'micro': return hrTime[0] * 1000000 + hrTime[1] / 1000
      case 'nano': return hrTime[0] * 1000000000 + hrTime[1]
      default: return hrTime[0] * 1000000000 + hrTime[1]
    }
  }
}
