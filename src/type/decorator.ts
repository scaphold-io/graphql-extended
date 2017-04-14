import invariant from '../jsutils/invariant'

/**
 * A decorator is directive specified on the schema.
 */
type GraphQLDecoratorValueConfig = {
  name: string;
  args: {
    [name: string]: mixed;
  }
}
export class GraphQLDecorator {

  public name: string

  public args: {
    [name: string]: mixed;
  }

  constructor(config: GraphQLDecoratorValueConfig) {
    invariant(config.name, 'Directive values must be named')
    this.name = config.name
    this.args = config.args || {}
  }

  public get(key: string): mixed {
    return this.args[key]
  }
}
