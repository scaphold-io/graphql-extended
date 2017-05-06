import invariant from '../jsutils/invariant'
import keyValMap from '../jsutils/keyValMap'
import { valueFromAST } from 'graphql/utilities/valueFromAST'
import { getArgumentValues } from '../execution/values'
import { getDescription, getDeprecationReason } from '../utilities'
import {
  TypeResolverMap,
  FieldResolverMap,
  ScalarResolverMap,
} from '../utilities/ResolverMap'
import {
  FactoryMiddleware,
} from './FactoryMiddleware'

import { Map } from 'immutable'

import {
  GraphQLFieldResolver,
  parse,
  Kind,
} from 'graphql'

import {
  LIST_TYPE,
  NON_NULL_TYPE,
  SCALAR_TYPE_DEFINITION,
  OBJECT_TYPE_DEFINITION,
  INTERFACE_TYPE_DEFINITION,
  ENUM_TYPE_DEFINITION,
  UNION_TYPE_DEFINITION,
  INPUT_OBJECT_TYPE_DEFINITION,
  SCHEMA_DEFINITION,
  DIRECTIVE_DEFINITION,
  TYPE_EXTENSION_DEFINITION,
} from 'graphql/language/kinds'

import {
  DirectiveNode,
  TypeNode,
  NamedTypeNode,
  SchemaDefinitionNode,
  TypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  DirectiveDefinitionNode,
  FieldDefinitionNode,
} from 'graphql/language/ast'

import { GraphQLSchema } from 'graphql/type/schema'

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
} from 'graphql/type/scalars'

import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  isInputType,
  isOutputType,
  GraphQLTypeResolver,
} from 'graphql/type/definition'

import { GraphQLObjectTypeExt } from '../type/object'

import {
  GraphQLType,
  GraphQLNamedType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLInputFieldConfigMap,
  GraphQLFieldConfigArgumentMap,
} from 'graphql/type/definition'

import {
  GraphQLDirective,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from 'graphql/type/directives'

import {
  GraphQLFieldConfigMapExt,
  GraphQLFieldConfigExt,
} from '../type/object'

import {
  __Schema,
  __Directive,
  __DirectiveLocation,
  __Type,
  __Field,
  __InputValue,
  __EnumValue,
  __TypeKind,
} from 'graphql/type/introspection'

import {
  GraphQLDirectiveValue,
} from '../type/directives'

const DEFAULT_DIRECTIVES = {
  deprecated: GraphQLDeprecatedDirective,
  include: GraphQLIncludeDirective,
  skip: GraphQLSkipDirective,
}

function buildWrappedType(
  innerType: GraphQLType,
  inputTypeNode: TypeNode,
): GraphQLType {
  if (inputTypeNode.kind === LIST_TYPE) {
    return new GraphQLList(buildWrappedType(innerType, inputTypeNode.type))
  }
  if (inputTypeNode.kind === NON_NULL_TYPE) {
    const wrappedType = buildWrappedType(innerType, inputTypeNode.type)
    invariant(!(wrappedType instanceof GraphQLNonNull), 'No nesting nonnull.')
    return new GraphQLNonNull(wrappedType)
  }
  return innerType
}

function getNamedTypeNode(typeNode: TypeNode): NamedTypeNode {
  let namedType = typeNode
  while (namedType.kind === LIST_TYPE || namedType.kind === NON_NULL_TYPE) {
    namedType = namedType.type
  }
  return namedType
}

function keywordForDefinitionKind(kind: string): string {
  switch (kind) {
    case SCALAR_TYPE_DEFINITION:
      return 'scalar'
    case OBJECT_TYPE_DEFINITION:
      return 'object'
    case INTERFACE_TYPE_DEFINITION:
      return 'scalar'
    case ENUM_TYPE_DEFINITION:
      return 'enum'
    case UNION_TYPE_DEFINITION:
      return 'union'
    case INPUT_OBJECT_TYPE_DEFINITION:
      return 'input'
    default:
      return 'unknown'
  }
}

function keywordForTypeKind(type: GraphQLNamedType): string {
  if (type instanceof GraphQLObjectType) {
    return 'object'
  } else if (type instanceof GraphQLScalarType) {
    return 'scalar'
  } else if (type instanceof GraphQLInterfaceType) {
    return 'interface'
  } else if (type instanceof GraphQLEnumType) {
    return 'enum'
  } else if (type instanceof GraphQLUnionType) {
    return 'union'
  } else if (type instanceof GraphQLInputObjectType) {
    return 'input'
  }
  return 'unknown'
}

export interface SchemaFactoryConfig {
  middleware?: FactoryMiddleware,
  onResolverCollision?: (oldFn: FieldResolverMap, newFn: FieldResolverMap, key: string) => FieldResolverMap,
  onTypeCollision?: (oldType: GraphQLNamedType, newType: GraphQLNamedType, key: string) => GraphQLNamedType
}
/**
 * A base class that handles managing and building GraphQL schemas
 */
export class SchemaFactory {

  protected schemaDef: SchemaDefinitionNode | null

  protected typeMap: Map<string, GraphQLNamedType>

  protected nodeMap: Map<string, TypeDefinitionNode>

  protected resolverMap: Map<string, FieldResolverMap>

  protected typeResolverMap: Map<string, GraphQLTypeResolver<mixed, mixed>>

  protected directiveMap: Map<string, GraphQLDirective>

  protected scalarResolvers: Map<string, ScalarResolverMap<mixed, mixed>>

  private config: SchemaFactoryConfig

  private middleware: FactoryMiddleware

  constructor(config: SchemaFactoryConfig = {}) {
    this.config = config
    this.middleware = config.middleware ? config.middleware : new FactoryMiddleware()
    this.nodeMap = Map<string, TypeDefinitionNode>()
    this.typeResolverMap = Map<string, GraphQLTypeResolver<mixed, mixed>>()
    this.typeMap = Map<string, GraphQLNamedType>({
      String: GraphQLString,
      Int: GraphQLInt,
      Float: GraphQLFloat,
      Boolean: GraphQLBoolean,
      ID: GraphQLID,
      __Schema,
      __Directive,
      __DirectiveLocation,
      __Type,
      __Field,
      __InputValue,
      __EnumValue,
      __TypeKind,
    })
    this.schemaDef = null
    this.directiveMap = Map<string, GraphQLDirective>(DEFAULT_DIRECTIVES)
    this.resolverMap = Map<string, FieldResolverMap>()
    this.middleware.onInit(this)
  }

  /**
   * Public API
   */

  private buildSchema(): GraphQLSchema {

    // Initialize the middleware.
    this.middleware.beforeBuild(this)

    let queryTypeName: string | null = null
    let mutationTypeName: string | null = null
    let subscriptionTypeName: string | null = null
    if (this.schemaDef) {
      this.schemaDef.operationTypes.forEach(operationType => {
        const typeName = operationType.type.name.value
        if (operationType.operation === 'query') {
          if (queryTypeName) {
            throw new Error('Must provide only one query type in schema.')
          }
          if (!this.nodeMap.get(typeName)) {
            throw new Error(
              `Specified query type "${typeName}" not found in document.`,
            )
          }
          queryTypeName = typeName
        } else if (operationType.operation === 'mutation') {
          if (mutationTypeName) {
            throw new Error('Must provide only one mutation type in schema.')
          }
          if (!this.nodeMap.get(typeName)) {
            throw new Error(
              `Specified mutation type "${typeName}" not found in document.`,
            )
          }
          mutationTypeName = typeName
        } else if (operationType.operation === 'subscription') {
          if (subscriptionTypeName) {
            throw new Error('Must provide only one subscription type in schema.')
          }
          if (!this.nodeMap.get(typeName)) {
            throw new Error(
              `Specified subscription type "${typeName}" not found in document.`,
            )
          }
          subscriptionTypeName = typeName
        }
      })
    } else {
      if (this.nodeMap.has('Query') || this.typeMap.has('Query')) {
        queryTypeName = 'Query'
      }
      if (this.nodeMap.has('Mutation') || this.typeMap.has('Mutation')) {
        mutationTypeName = 'Mutation'
      }
      if (this.nodeMap.has('Subscription') || this.typeMap.has('Subscription')) {
        subscriptionTypeName = 'Subscription'
      }
    }

    if (!queryTypeName) {
      throw new Error(
        'Must provide schema definition with query type or a type named Query.',
      )
    }

    const types = this.nodeMap.valueSeq().map(def => this.typeDefNamed(def!.name.value)).toArray()

    let directives = this.directiveMap.toArray()

    return this.middleware.afterBuild(
      new GraphQLSchema({
        query: this.getObjectTypeNamed(queryTypeName),
        mutation: mutationTypeName ?
          this.getObjectTypeNamed(mutationTypeName) :
          undefined,
        subscription: subscriptionTypeName ?
          this.getObjectTypeNamed(subscriptionTypeName) :
          undefined,
        types,
        directives,
      }),
    )
  }

  public getSchema(): GraphQLSchema {
    return this.buildSchema()
  }

  public getType(name: string): GraphQLNamedType {
    return this.typeDefNamed(name)
  }

  public hasType(name: string): boolean {
    return this.typeMap.has(name)
  }

  public hasDefinition(name: string): boolean {
    return this.nodeMap.has(name)
  }

  /**
   * Getters
   */
  get nodes(): Array<TypeDefinitionNode> {
    return this.nodeMap.valueSeq().toArray()
  }

  get types(): Array<GraphQLNamedType> {
    return this.typeMap.valueSeq().toArray()
  }

  /**
   * Add resolvers to the resolver map. These resolvers will get merged into types
   * when you call getSchema().
   */
  public addResolveFunctionsToSchema(resolvers: TypeResolverMap<mixed, mixed> = {}): SchemaFactory {
    this.resolverMap = this.resolverMap.mergeWith((oldVal, newVal, key: string) => {
      // You can provide a custom handler for managing collisions, but by default we merge resolvers.
      if (oldVal && newVal) {
        if (this.config.onResolverCollision) {
          return this.config.onResolverCollision(oldVal, newVal, key)
        }
        return {
          ...oldVal,
          ...newVal,
        }
      }
      return newVal as FieldResolverMap
    }, resolvers)
    return this
  }

  /**
   * Add a single object type to the schema.
   * @param spec A single type declaration as GraphQL schema IDL
   * @param resolvers An object with field names for keys and GraphQLFieldResolver functions as values.
   */
  public createType(spec: string, resolvers: FieldResolverMap = {}): SchemaFactory {
    const def = parse(spec)
    invariant(
      def && def.definitions.length === 1,
      'Factory.createType expects exactly one definition',
    )
    const definition = def.definitions[0]
    invariant(
      definition.kind === Kind.OBJECT_TYPE_DEFINITION,
      `Factory.createType expects a single definition of kind ${Kind.OBJECT_TYPE_DEFINITION}`,
    )
    const objectDef: ObjectTypeDefinitionNode = (definition as ObjectTypeDefinitionNode)
    this.assertIsNewType(objectDef.name.value)
    this.nodeMap = this.nodeMap.set(
      objectDef.name.value,
      objectDef,
    )
    this.resolverMap = this.resolverMap.set(
      objectDef.name.value,
      resolvers,
    )
    return this
  }

  /**
   * Add a single interface type to the schema.
   * @param spec A single type declaration as GraphQL schema IDL
   * @param resolveType A GraphQLTypeResolver for the interface
   */
  public createInterface(
    spec: string,
    resolveType: GraphQLTypeResolver<mixed, mixed>,
  ): SchemaFactory {
    const def = parse(spec)
    invariant(
      def && def.definitions.length === 1,
      'Factory.createInterface expects exactly one definition',
    )
    const definition = def.definitions[0]
    invariant(
      definition.kind === Kind.INTERFACE_TYPE_DEFINITION,
      `Factory.createInterface expects a single definition of kind ${Kind.INTERFACE_TYPE_DEFINITION}`,
    )
    const iDef: InterfaceTypeDefinitionNode = (definition as InterfaceTypeDefinitionNode)
    this.assertIsNewType(iDef.name.value)
    this.nodeMap = this.nodeMap.set(
      iDef.name.value,
      iDef,
    )
    this.typeResolverMap = this.typeResolverMap.set(
      iDef.name.value,
      resolveType,
    )
    return this
  }

  /**
   * Add a single enum type to the schema.
   * @param spec A single type declaration as GraphQL schema IDL
   */
  public createEnum(
    spec: string,
  ): SchemaFactory {
    const def = parse(spec)
    invariant(
      def && def.definitions.length === 1,
      'Factory.createEnum expects exactly one definition',
    )
    const definition = def.definitions[0]
    invariant(
      definition.kind === Kind.ENUM_TYPE_DEFINITION,
      `Factory.createEnum expects a single definition of kind ${Kind.ENUM_TYPE_DEFINITION}`,
    )
    const eDef: EnumTypeDefinitionNode = (definition as EnumTypeDefinitionNode)
    this.assertIsNewType(eDef.name.value)
    this.nodeMap = this.nodeMap.set(
      eDef.name.value,
      eDef,
    )
    return this
  }

  /**
   * Add a single union type to the schema.
   * @param spec A single type declaration as GraphQL schema IDL
   * @param resolveType A GraphQLTypeResolver for the union
   */
  public createUnion(
    spec: string,
    resolveType: GraphQLTypeResolver<mixed, mixed>,
  ): SchemaFactory {
    const def = parse(spec)
    invariant(
      def && def.definitions.length === 1,
      'Factory.createEnum expects exactly one definition',
    )
    const definition = def.definitions[0]
    invariant(
      definition.kind === Kind.ENUM_TYPE_DEFINITION,
      `Factory.createEnum expects a single definition of kind ${Kind.ENUM_TYPE_DEFINITION}`,
    )
    const uDef: EnumTypeDefinitionNode = (definition as EnumTypeDefinitionNode)
    this.assertIsNewType(uDef.name.value)
    this.nodeMap = this.nodeMap.set(
      uDef.name.value,
      uDef,
    )
    this.typeResolverMap = this.typeResolverMap.set(
      uDef.name.value,
      resolveType,
    )
    return this
  }

  /**
   * Extends the factories type cache with prebuilt GraphQL types.
   * @param types
   */
  public extendWithTypes(types: Array<GraphQLNamedType>): SchemaFactory {
    const that = this
    const keyedByName = keyValMap(
      types,
      type => type.name,
      type => type,
    )
    this.typeMap = this.typeMap.mergeWith((oldType, newType, key) => {
      // You can provide a custom handler for managing collisions, but by default it is not allowed.
      if (that.config.onTypeCollision && oldType && newType && key) {
        return that.config.onTypeCollision(oldType, newType, key)
      }
      throw new Error(
        `A type with name ${key} already exists. ` +
        'You can extend this type using the extend keyword with Factory.extendWithSpec()',
      )
    }, keyedByName)
    return that
  }

  /**
   * Append a GraphQL IDL document to the factory. Any type collisions are resolved
   * via the schema's CollisionResolver.
   *
   * @param spec A GraphQL document string containing the new schema elements
   */
  public extendWithSpec(spec: string, resolvers: TypeResolverMap<mixed, mixed> = {}): SchemaFactory {
    const def = parse(spec)
    if (!def) {
      throw new Error('GraphQL spec must have atleast one definition')
    }

    def.definitions.forEach(d => {
      switch (d.kind) {
        case SCHEMA_DEFINITION:
          if (this.schemaDef) {
            throw new Error('Must provide only one schema definition.')
          }
          this.schemaDef = d as SchemaDefinitionNode
          break
        case SCALAR_TYPE_DEFINITION:
        case OBJECT_TYPE_DEFINITION:
        case INTERFACE_TYPE_DEFINITION:
        case ENUM_TYPE_DEFINITION:
        case UNION_TYPE_DEFINITION:
        case INPUT_OBJECT_TYPE_DEFINITION:
          this.nodeMap = this.nodeMap.set(
            (d as TypeDefinitionNode).name.value, d as TypeDefinitionNode,
          )
          break
        case DIRECTIVE_DEFINITION:
          this.directiveMap = this.directiveMap.set(
            (d as DirectiveDefinitionNode).name.value, this.getDirective(d),
          )
          break
        case TYPE_EXTENSION_DEFINITION:
          // TODO: Should extend the document
          break
        default:
          break
      }
    })
    this.addResolveFunctionsToSchema(resolvers)
    return this
  }

  /**
   * Checks both the type cache and node cache for the existence of a type. If that type exists error.
   * @param name The name of the type.
   */
  private assertIsNewType(name: string): void {
    if (this.nodeMap.has(name)) {
      const keyword = keywordForDefinitionKind(this.nodeMap.get(name).kind)
      throw new Error(
        `A ${keyword} with name ${name} already exists. ` +
        `You can extend this ${keyword} using the extend keyword with Factory.extendWithSpec()`,
      )
    } else if (this.typeMap.has(name)) {
      const tKeyword = keywordForTypeKind(this.typeMap.get(name))
      throw new Error(
        `A ${tKeyword} with name ${name} already exists. ` +
        `You can extend this ${tKeyword} using the extend keyword with Factory.extendWithSpec()`,
      )
    }
  }

  /**
   * Protected API
   * @param directiveNode
   */
  protected getDirective(
    directiveNode: DirectiveDefinitionNode,
  ): GraphQLDirective {
    return new GraphQLDirective({
      name: directiveNode.name.value,
      description: getDescription(directiveNode),
      locations: directiveNode.locations.map(
        node => node.value,
      ),
      args: directiveNode.arguments && this.makeInputValues(directiveNode.arguments) as GraphQLFieldConfigArgumentMap,
    })
  }

  protected getObjectTypeNamed(name: string): GraphQLObjectType {
    const type = this.typeDefNamed(name)
    invariant(
      type instanceof GraphQLObjectType,
      'AST must provide object type.',
    )
    return type as GraphQLObjectType
  }

  protected getObjectType(typeNode: TypeDefinitionNode): GraphQLObjectType {
    const type = this.typeDefNamed(typeNode.name.value)
    invariant(
      type instanceof GraphQLObjectType,
      'AST must provide object type.',
    )
    return type as GraphQLObjectType
  }

  protected produceType(typeNode: TypeNode): GraphQLType {
    const typeName = getNamedTypeNode(typeNode).name.value
    const typeDef = this.typeDefNamed(typeName)
    return buildWrappedType(typeDef, typeNode)
  }

  protected produceInputType(typeNode: TypeNode): GraphQLInputType {
    const type = this.produceType(typeNode)
    invariant(isInputType(type), 'Expected Input type.')
    return type as GraphQLInputType
  }

  protected produceOutputType(typeNode: TypeNode): GraphQLOutputType {
    const type = this.produceType(typeNode)
    invariant(isOutputType(type), 'Expected Output type.')
    return type as GraphQLOutputType
  }

  protected produceObjectType(typeNode: TypeNode): GraphQLObjectType {
    const type = this.produceType(typeNode)
    invariant(type instanceof GraphQLObjectType, 'Expected Object type.')
    return type as GraphQLObjectType
  }

  protected produceInterfaceType(typeNode: TypeNode): GraphQLInterfaceType {
    const type = this.produceType(typeNode)
    invariant(type instanceof GraphQLInterfaceType, 'Expected Interface type.')
    return type as GraphQLInterfaceType
  }

  protected produceDirectiveValue(directiveNode: DirectiveNode): GraphQLDirectiveValue {
    const directive = this.directiveMap.get(directiveNode.name.value)
    return new GraphQLDirectiveValue({
      name: directiveNode.name.value,
      args: getArgumentValues(directive, directiveNode),
    })
  }

  protected typeDefNamed(typeName: string): GraphQLNamedType {
    if (this.typeMap.has(typeName)) {
      return this.typeMap.get(typeName)
    }

    if (!this.nodeMap.has(typeName)) {
      throw new Error(`Type "${typeName}" not found in document.`)
    }

    const innerTypeDef = this.makeSchemaDef(this.nodeMap.get(typeName))
    if (!innerTypeDef) {
      throw new Error(`Nothing constructed for "${typeName}".`)
    }
    this.typeMap = this.typeMap.set(typeName, innerTypeDef)
    return innerTypeDef
  }

  protected makeSchemaDef(def: TypeDefinitionNode): GraphQLObjectType | GraphQLInterfaceType | GraphQLEnumType | GraphQLUnionType | GraphQLInputObjectType | GraphQLScalarType {
    if (!def) {
      throw new Error('def must be defined')
    }
    // Create types from AST nodes. This is where factory middleware wraps nodes.
    switch (def.kind) {
      case OBJECT_TYPE_DEFINITION:
        return this.makeTypeDef(
          this.middleware.wrapObjectNode(this, def),
        )
      case INTERFACE_TYPE_DEFINITION:
        return this.makeInterfaceDef(
          this.middleware.wrapInterfaceNode(this, def),
        )
      case ENUM_TYPE_DEFINITION:
        return this.makeEnumDef(
          this.middleware.wrapEnumNode(this, def),
        )
      case UNION_TYPE_DEFINITION:
        return this.makeUnionDef(
          this.middleware.wrapUnionNode(this, def),
        )
      case SCALAR_TYPE_DEFINITION:
        return this.makeScalarDef(
          this.middleware.wrapScalarNode(this, def),
        )
      case INPUT_OBJECT_TYPE_DEFINITION:
        return this.makeInputObjectDef(
          this.middleware.wrapInputNode(this, def),
        )
      default:
        throw new Error(`Type kind "${def}" not supported.`)
    }
  }

  protected makeTypeDef(def: ObjectTypeDefinitionNode): GraphQLObjectType {
    const typeName = def.name.value
    return this.middleware.wrapObjectType(
      this,
      def,
      new GraphQLObjectTypeExt({
        name: typeName,
        description: getDescription(def),
        fields: () => this.makeObjectFieldDefMap(def),
        interfaces: () => this.makeImplementedInterfaces(def),
        directives: () => this.makeDirectiveValues(def),
      }),
    )
  }

  protected getResolver(
    type: ObjectTypeDefinitionNode,
    field: FieldDefinitionNode,
  ): GraphQLFieldResolver<mixed, mixed> | undefined {
    const fieldResolver = this.resolverMap.getIn([type.name.value, field.name.value])
    if (fieldResolver) {
      return fieldResolver
    }
    // If no resolver is defined return undefined
    return
  }

  protected makeObjectFieldDefMap(
    def: ObjectTypeDefinitionNode,
  ): GraphQLFieldConfigMapExt<mixed, mixed> {
    return keyValMap<FieldDefinitionNode, GraphQLFieldConfigExt<mixed, mixed>> (
      def.fields,
      field => field.name.value,
      field => (
        this.middleware.wrapObjectField(
          this,
          def,
          {
            type: this.produceOutputType(field.type),
            description: getDescription(field),
            args: this.makeInputValues(field.arguments) as GraphQLFieldConfigArgumentMap,
            deprecationReason: getDeprecationReason(field.directives),
            directives: this.makeDirectiveValues(field),
            resolve: this.getResolver(def, field),
          },
        )
      ),
    )
  }

  protected makeInterfaceFieldDefMap(
    def: InterfaceTypeDefinitionNode,
  ): GraphQLFieldConfigMapExt<mixed, mixed> {
    return keyValMap<FieldDefinitionNode, GraphQLFieldConfigExt<mixed, mixed>> (
      def.fields,
      field => field.name.value,
      field => (
        this.middleware.wrapInterfaceField(
          this,
          def,
          {
            type: this.produceOutputType(field.type),
            description: getDescription(field),
            args: this.makeInputValues(field.arguments) as GraphQLFieldConfigArgumentMap,
            deprecationReason: getDeprecationReason(field.directives),
            directives: this.makeDirectiveValues(field),
          },
        )
      ),
    )
  }

  protected makeImplementedInterfaces(def: ObjectTypeDefinitionNode): Array<GraphQLInterfaceType> {
    return def.interfaces ?
      def.interfaces.map(iface => this.produceInterfaceType(iface)) :
      []
  }

  protected makeDirectiveValues(def: ObjectTypeDefinitionNode | FieldDefinitionNode): Array<GraphQLDirectiveValue> {
    return def.directives ?
      def.directives.map(dir => this.produceDirectiveValue(dir)) :
      []
  }

  protected makeInputValues(values: Array<InputValueDefinitionNode>): { [name: string]: mixed } {
    return keyValMap(
      values,
      value => value.name.value,
      value => {
        const type = this.produceInputType(value.type)
        return {
          type,
          description: getDescription(value),
          defaultValue: valueFromAST(value.defaultValue!, type),
        }
      },
    )
  }

  protected makeInterfaceDef(def: InterfaceTypeDefinitionNode): GraphQLInterfaceType {
    const typeName = def.name.value
    return this.middleware.wrapInterfaceType(
      this,
      def,
      new GraphQLInterfaceType({
        name: typeName,
        description: getDescription(def),
        fields: () => this.makeInterfaceFieldDefMap(def),
        resolveType: cannotExecuteSchema,
      }),
    )
  }

  protected makeEnumDef(def: EnumTypeDefinitionNode): GraphQLEnumType {
    return this.middleware.wrapEnumType(
      this,
      def,
      new GraphQLEnumType({
        name: def.name.value,
        description: getDescription(def),
        values: keyValMap(
          def.values,
          enumValue => enumValue.name.value,
          enumValue => ({
            description: getDescription(enumValue),
            deprecationReason: getDeprecationReason(enumValue.directives),
          }),
        ),
      }),
    )
  }

  protected makeUnionDef(def: UnionTypeDefinitionNode): GraphQLUnionType {
    return this.middleware.wrapUnionType(
      this,
      def,
      new GraphQLUnionType({
        name: def.name.value,
        description: getDescription(def),
        types: def.types.map(t => this.produceObjectType(t)),
        resolveType: cannotExecuteSchema,
      }),
    )
  }

  protected makeScalarDef(def: ScalarTypeDefinitionNode): GraphQLScalarType {
    return this.middleware.wrapScalarType(
      this,
      def,
      new GraphQLScalarType({
        name: def.name.value,
        description: getDescription(def),
        serialize: () => null,
        // Note: validation calls the parse functions to determine if a
        // literal value is correct. Returning null would cause use of custom
        // scalars to always fail validation. Returning false causes them to
        // always pass validation.
        parseValue: () => false,
        parseLiteral: () => false,
      }),
    )
  }

  protected makeInputObjectDef(def: InputObjectTypeDefinitionNode): GraphQLInputObjectType {
    return this.middleware.wrapInputType(
      this,
      def,
      new GraphQLInputObjectType({
        name: def.name.value,
        description: getDescription(def),
        fields: () => this.makeInputValues(def.fields) as GraphQLInputFieldConfigMap,
      }),
    )
  }

}

const cannotExecuteSchema: GraphQLTypeResolver<mixed, mixed> = () => {
  throw new Error(
    'Generated Schema cannot use Interface or Union types for execution.',
  )
}
