import {
  ObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  EnumTypeDefinitionNode,
  UnionTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  GraphQLSchema,
} from 'graphql'
import {
  GraphQLFieldConfigExt,
} from '../type/object'
import { SchemaFactory } from './SchemaFactory'

/**
 * Middleware is useful for manipulating how the SchemaFactory creates a schema.
 * Usage:
 *  - Provide a class that extends the FactoryMiddleware class to the SchemaFactory.
 *  - This is implemented as a class instead of an interface so that it can default
 *    middleware methods to the identity function.
 */
export class FactoryMiddleware {

  /**
   * This is called directly before the schema attempts to build and
   * provides an opportunity for any excess setup.
   * For example, you might add any default types, interfaces, etc.
   * @param _factory The factory instance calling the middleware
   */
  public beforeBuild(_factory: SchemaFactory): void { return }

  /**
   * This is called directly after the schema is built and
   * provides an opportunity for any last second changes.
   * @param schema The GraphQL schema
   */
  public afterBuild(schema: GraphQLSchema): GraphQLSchema { return schema }

  /**
   * Allows you to wrap an object type field. Useful for wrapping resolvers
   * @param field The field config. This field may already contain a resolver that was pulled
   *        from the factories resolver cache. You can choose to override or compose them.
   */
  public wrapObjectField(
    _factory: SchemaFactory,
    _definition: ObjectTypeDefinitionNode,
    field: GraphQLFieldConfigExt<mixed, mixed>,
  ): GraphQLFieldConfigExt<mixed, mixed> {
    return field
  }

  /**
   * Allows you to wrap an interface type field.
   * @param field The field config. This field may already contain a resolver that was pulled
   *        from the factories resolver cache. You can choose to override or compose them.
   */
  public wrapInterfaceField(
    _factory: SchemaFactory,
    _definition: InterfaceTypeDefinitionNode,
    field: GraphQLFieldConfigExt<mixed, mixed>,
  ): GraphQLFieldConfigExt<mixed, mixed> {
    return field
  }

  /**
   * Executed before the schema is built. This is useful for manipulating the
   * AST nodes before they are converted into GraphQL types. Middleware is
   * restricted to work on AST nodes instead of types. This is because type members
   * are often thunks and it can introduce problems to try to resolve them out of order.
   *
   * @param nodeMap And ImmutableJS Map containing the AST definition nodes.
   * @return The augmented nodeMap
   */
  public wrapObjectNode(
    _factory: SchemaFactory,
    definition: ObjectTypeDefinitionNode,
  ): ObjectTypeDefinitionNode {
    return definition
  }

  /**
   * Wrap an interface or interact with the factory.
   */
  public wrapInterfaceNode(
    _factory: SchemaFactory,
    definition: InterfaceTypeDefinitionNode,
  ): InterfaceTypeDefinitionNode {
    return definition
  }

  /**
   * Wrap an enum or interact with the factory.
   */
  public wrapEnumNode(
    _factory: SchemaFactory,
    definition: EnumTypeDefinitionNode,
  ): EnumTypeDefinitionNode {
    return definition
  }

  /**
   * Wrap an union or interact with the factory.
   */
  public wrapUnionNode(
    _factory: SchemaFactory,
    definition: UnionTypeDefinitionNode,
  ): UnionTypeDefinitionNode {
    return definition
  }

  /**
   * Wrap an scalar or interact with the factory.
   */
  public wrapScalarNode(
    _factory: SchemaFactory,
    definition: ScalarTypeDefinitionNode,
  ): ScalarTypeDefinitionNode {
    return definition
  }

  /**
   * Wrap an input or interact with the factory.
   */
  public wrapInputNode(
    _factory: SchemaFactory,
    definition: InputObjectTypeDefinitionNode,
  ): InputObjectTypeDefinitionNode {
    return definition
  }
}
