import {
  GraphQLSchema,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  GraphQLError,
} from 'graphql'

/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
export type ExecutionContext = {
  schema: GraphQLSchema;
  fragments: {[key: string]: FragmentDefinitionNode};
  rootValue: {} | string | number | boolean | undefined | null;
  contextValue: {} | string | number | boolean | undefined | null;
  operation: OperationDefinitionNode;
  variableValues: {[key: string]: {} | string | number | boolean | undefined | null};
  errors: Array<GraphQLError>;
}
