import invariant from '../jsutils/invariant'
import {
  GraphQLDirective,
  DirectiveLocation,
  DirectiveLocationEnum,
  GraphQLNonNull,
  GraphQLEnumType,
} from 'graphql/type'

/**
 * A decorator is directive specified on the schema.
 */
export type GraphQLDirectiveValueConfig = {
  name: string;
  description?: string;
  args: {
    [name: string]: mixed;
  },
  location: DirectiveLocationEnum;
}
export class GraphQLDirectiveValue {

  public name: string

  public args: {
    [name: string]: mixed;
  }

  public location: DirectiveLocationEnum

  constructor(config: GraphQLDirectiveValueConfig) {
    invariant(config.name, 'Directive values must be named')
    this.name = config.name
    this.args = config.args || {}
    this.location = config.location
  }

  public get(key: string): mixed {
    return this.args[key]
  }
}

/**
 * Used to declare element of a GraphQL schema as a relation.
 */
export const RelationKind = {
  HAS_MANY: 'HAS_MANY',
  HAS_ONE: 'HAS_ONE',
  BELONGS_TO: 'BELONGS_TO',
  BELONGS_TO_MANY: 'BELONGS_TO_MANY',
}
const RelationKindEnum = new GraphQLEnumType({
  name: 'SQLRelationDirectiveKind',
  description: 'Possible values for SQLRelationDirective',
  values: {
    HasMany: {},
    HasOne: {},
    BelongsTo: {},
    BelongsToMany: {},
  },
})
export const GraphQLRelationDirective = new GraphQLDirective({
  name: 'relation',
  description:
    'Marks an element of a GraphQL schema as no longer supported.',
  locations: [
    DirectiveLocation.FIELD_DEFINITION,
  ],
  args: {
    kind: {
      type: new GraphQLNonNull(RelationKindEnum),
      description:
        'Explains the kind of the relation. A relation is either HasOne, HasMany' +
        'BelongsTo, or BelongsToMany.',
    },
  },
})
