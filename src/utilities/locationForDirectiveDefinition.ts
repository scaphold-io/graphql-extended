/*
 * @Author: michael.paris
 * @Date: 2017-05-07 23:05:55
 * @Last Modified by: michael.paris
 * @Last Modified time: 2017-05-07 23:22:58
 */

import {
  GraphQLDirective,
  DirectiveLocationEnum,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  SchemaDefinitionNode,
  InterfaceTypeDefinitionNode,
  EnumTypeDefinitionNode,
  UnionTypeDefinitionNode,
  DirectiveLocation,
} from 'graphql'

function assertValidLocation(directive: GraphQLDirective, term: string): boolean {
  for (let s of directive.locations) {
    if (s === term) {
      return true
    }
  }
  throw new Error(
    `Invalid directive location: @${directive.name} found on definition of kind ` +
    `'${term}'. Expecting [ ${directive.locations.join(', ')} ].`,
  )
}

export function locationForDirectiveDefinition(
  directive: GraphQLDirective,
  def: ObjectTypeDefinitionNode | FieldDefinitionNode | SchemaDefinitionNode |
    InterfaceTypeDefinitionNode | EnumTypeDefinitionNode | UnionTypeDefinitionNode,
): DirectiveLocationEnum {
  switch (def.kind) {
    case 'ObjectTypeDefinition':
      assertValidLocation(directive, DirectiveLocation.OBJECT)
      return DirectiveLocation.OBJECT
    case 'FieldDefinition':
      assertValidLocation(directive, DirectiveLocation.FIELD_DEFINITION)
      return DirectiveLocation.FIELD_DEFINITION
    case 'SchemaDefinition':
      assertValidLocation(directive, DirectiveLocation.SCHEMA)
      return DirectiveLocation.SCHEMA
    case 'InterfaceTypeDefinition':
      assertValidLocation(directive, DirectiveLocation.INTERFACE)
      return DirectiveLocation.INTERFACE
    case 'EnumTypeDefinition':
      assertValidLocation(directive, DirectiveLocation.ENUM)
      return DirectiveLocation.ENUM
    case 'UnionTypeDefinition':
      assertValidLocation(directive, DirectiveLocation.UNION)
      return DirectiveLocation.UNION
    default:
    throw new Error('Invalid definition for directive.')
  }
}
