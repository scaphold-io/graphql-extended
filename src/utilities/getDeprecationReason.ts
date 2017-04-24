import {
  GraphQLDeprecatedDirective,
} from 'graphql/type'
import {
  DirectiveNode,
} from 'graphql/language'
import find from '../jsutils/find'
import { getArgumentValues } from '../execution/values'

/**
 * Given a collection of directives, returns the string value for the
 * deprecation reason.
 */
export function getDeprecationReason(
  directives?: Array<DirectiveNode>,
): string | undefined {
  const deprecatedAST = directives && find(
    directives,
    directive => directive.name.value === GraphQLDeprecatedDirective.name,
  )
  if (!deprecatedAST) {
    return
  }
  const { reason } = getArgumentValues(
    GraphQLDeprecatedDirective,
    deprecatedAST,
  )
  return reason as string
}
