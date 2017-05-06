import {
  FactoryMiddleware,
} from '../FactoryMiddleware'
import {
  GraphQLFieldConfigExt,
} from '../../type/object'
import { SchemaFactory } from '../SchemaFactory'
import {
  ObjectTypeDefinitionNode,
  GraphQLTypeResolver,
  GraphQLScalarType,
  Kind,
  FieldDefinitionNode,
} from 'graphql'
import {
  implementsInterface,
  getNamedOutputType,
  GraphQLNamedOutputType,
  isListType,
} from '../../utilities'

export const GraphQLCursor = new GraphQLScalarType({
  name: 'Cursor',
  description:
    'The `Cursor` scalar type represents an opaque pointer to an object in a ' +
    'sequence, represented as UTF-8 ' +
    'character sequences.',
  serialize: String,
  parseValue: String,
  parseLiteral(ast): mixed {
    return ast.kind === Kind.STRING ? ast.value : null
  },
})

function connectionSpec(def: ObjectTypeDefinitionNode): string {
  const edgeName = `${def.name.value}Edge`
  const connectionName = `${def.name.value}Connection`
  return `
    # Connection wrapper for the ${def.name.value} named type
    type ${connectionName} {
      edges: [${edgeName}]
      pageInfo: PageInfo
    }

    # Connection edge wrapper for the ${def.name.value} named type
    type ${edgeName} {
      node: ${def.name.value}
      cursor: Cursor
    }
  `
}

/**
 * Creates Connection & Edge types for all Node implementing types. This middleware
 * also provides the Node interface, Cursor scalar type, etc.
 */
export class RelayMiddleware extends FactoryMiddleware {

  constructor(
    private resolveNode: GraphQLTypeResolver<mixed, mixed>,
  ) { super() }

  /**
   * Add the Node interface and PageInfo and Cursor types
   */
  public beforeBuild(factory: SchemaFactory): void {
    factory.extendWithTypes([GraphQLCursor])
    factory.createInterface(`
      # The Node interface denotes a distinct entity in the schema. Types that implement
      # the Node interface abide by the Relay connection spec are receive Connection & Edge types.
      interface Node {
        id: ID!
      }
    `, this.resolveNode)
    factory.extendWithSpec(`
      # The PageInfo object contains information about a Relay connection.
      type PageInfo {
        hasPreviousPage: Boolean!
        hasNextPage: Boolean!
        startCursor: Cursor
        endCursor: Cursor
      }
    `)
  }

  /**
   * If the type implements Node then create connection types for it.
   */
  public wrapObjectNode(
    factory: SchemaFactory,
    definition: ObjectTypeDefinitionNode,
  ): ObjectTypeDefinitionNode {
    const interfaces = definition.interfaces || []
    if (interfaces.find(i => i.name.value === 'Node')) {
      factory.extendWithSpec(connectionSpec(definition))
    }
    return definition
  }

  /**
   * For each field with a Node implementing type or a wrapper of a Node implementing type
   * such as NonNull or List replace the field with a connection
   */
  public wrapObjectField(
    factory: SchemaFactory,
    _definition: ObjectTypeDefinitionNode,
    _fieldDef: FieldDefinitionNode,
    field: GraphQLFieldConfigExt<mixed, mixed>,
  ): GraphQLFieldConfigExt<mixed, mixed> {
    if (
      isListType(field.type) &&
      implementsInterface(field.type, 'Node')
    ) {
      const namedType = getNamedOutputType(field.type)
      const connectionType = factory.getType(`${namedType.name}Connection`) as GraphQLNamedOutputType
      return {
        ...field,
        type: connectionType,
      }
    }
    return field
  }
}
