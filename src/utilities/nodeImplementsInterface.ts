import {
  TypeDefinitionNode,
} from 'graphql'
import {
  OBJECT_TYPE_DEFINITION,
} from 'graphql/language/kinds'

export function nodeImplementsInterface(
  node: TypeDefinitionNode,
  interfaceName: string,
): boolean  {
  if (node.kind === OBJECT_TYPE_DEFINITION) {
    const interfaces = node.interfaces || []
    return Boolean(interfaces.find(i => i.name.value === interfaceName))
  }
  return false
}
