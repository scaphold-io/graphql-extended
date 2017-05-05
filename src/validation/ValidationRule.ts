/*
 * @Author: michael.paris
 * @Date: 2017-05-05 01:56:39
 * @Last Modified by: michael.paris
 * @Last Modified time: 2017-05-05 03:19:02
 */

import {
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLUnionType,
  GraphQLInterfaceType,
  GraphQLScalarType,
  GraphQLInputObjectType,
} from 'graphql'

export interface ValidationRule {

  /**
   * Called for every field in the schema.
   */
  validateObject?(_object: GraphQLObjectType): Error | false

  /**
   * Interfaces
   */
  validateInterface?(_interface: GraphQLInterfaceType): Error | false

  /**
   * Enum
   */
  validateEnum?(_enum: GraphQLEnumType): Error | false

  /**
   * Union
   */
  validateUnion?(_union: GraphQLUnionType): Error | false

  /**
   * Scalar
   */
  validateScalar?(_scalar: GraphQLScalarType): Error | false

  /**
   * Input
   */
  validateInput?(_inp: GraphQLInputObjectType): Error | false

}
