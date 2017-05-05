/*
 * @Author: michael.paris
 * @Date: 2017-05-05 02:32:52
 * @Last Modified by: michael.paris
 * @Last Modified time: 2017-05-05 03:30:52
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLUnionType,
  GraphQLInterfaceType,
  GraphQLScalarType,
  GraphQLType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql'
import {
  ValidationRule,
} from './ValidationRule'

export function validateSchema(
  schema: GraphQLSchema,
  rules: Array<ValidationRule>,
): Array<Error> {

  return Object.keys(schema.getTypeMap()).reduce((acc, typeName) => {
    const type = schema.getType(typeName)
    const typeErrors = validateType(type)
    return [ ...acc, ...typeErrors ]
  }, [] as Array<Error>)

  function validateType(type: GraphQLType): Array<Error> {
    if (type instanceof GraphQLList) {
      return validateType(type.ofType)
    } else if (type instanceof GraphQLNonNull) {
      return validateType(type.ofType)
    } else if (type instanceof GraphQLObjectType) {
      return validateObject(type)
    } else if (type instanceof GraphQLInterfaceType) {
      return validateInterface(type)
    } else if (type instanceof GraphQLEnumType) {
      return validateEnum(type)
    } else if (type instanceof GraphQLUnionType) {
      return validateUnion(type)
    } else if (type instanceof GraphQLScalarType) {
      return validateScalar(type)
    } else if (type instanceof GraphQLInputObjectType) {
      return validateInput(type)
    }
    return []
  }

  function validateObject(type: GraphQLObjectType): Array<Error> {
    return rules.reduce((acc, rule) => {
      if (rule.validateObject) {
        const error = rule.validateObject(type)
        return error ? [ ...acc, error ] : acc
      }
      return acc
    }, [] as Array<Error>)
  }

  function validateInterface(intface: GraphQLInterfaceType): Array<Error> {
    return rules.reduce((acc, rule) => {
      if (rule.validateInterface) {
        const error = rule.validateInterface(intface)
        return error ? [ ...acc, error ] : acc
      }
      return acc
    }, [] as Array<Error>)
  }

  function validateUnion(union: GraphQLUnionType): Array<Error> {
    return rules.reduce((acc, rule) => {
      if (rule.validateUnion) {
        const error = rule.validateUnion(union)
        return error ? [ ...acc, error ] : acc
      }
      return acc
    }, [] as Array<Error>)
  }

  function validateEnum(enm: GraphQLEnumType): Array<Error> {
    return rules.reduce((acc, rule) => {
      if (rule.validateEnum) {
        const error = rule.validateEnum(enm)
        return error ? [ ...acc, error ] : acc
      }
      return acc
    }, [] as Array<Error>)
  }

  function validateScalar(sc: GraphQLScalarType): Array<Error> {
    return rules.reduce((acc, rule) => {
      if (rule.validateScalar) {
        const error = rule.validateScalar(sc)
        return error ? [ ...acc, error ] : acc
      }
      return acc
    }, [] as Array<Error>)
  }

  function validateInput(inp: GraphQLInputObjectType): Array<Error> {
    return rules.reduce((acc, rule) => {
      if (rule.validateInput) {
        const error = rule.validateInput(inp)
        return error ? [ ...acc, error ] : acc
      }
      return acc
    }, [] as Array<Error>)
  }
}
