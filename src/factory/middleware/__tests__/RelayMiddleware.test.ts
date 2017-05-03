import { SchemaFactory } from '../../SchemaFactory'
import { RelayMiddleware } from '../RelayMiddleware'
import {
  GraphQLObjectType,
} from 'graphql'

test('Create a factory w/ relay middleware and check for transformations', () => {

  const relayMiddleware = new RelayMiddleware(v => (v && v['name']) ? 'User' : 'Post')

  const factory = new SchemaFactory({
    middleware: relayMiddleware,
  })

  factory.extendWithSpec(`
    type Post implements Node {
      id: ID!
      title: String!
      author: User
    }
    type User implements Node {
      id: ID!
      name: String!
      posts: [Post]
    }
    type Query {
      users: [User]
    }
  `, {
    User: {
      id: () => 1,
      name: () => 'Michael',
      posts: () => ([{ id: 1, title: 'GraphQL Rox' }]),
    },
  })

  const schema = factory.getSchema()

  // We're the referenced connection & edge types created?
  expect(schema.getType('PostConnection')).toBeTruthy()
  expect(schema.getType('PostEdge')).toBeTruthy()
  expect(schema.getType('UserConnection')).toBeTruthy()
  expect(schema.getType('UserEdge')).toBeTruthy()
  expect(schema.getType('Cursor')).toBeTruthy()

  // Was the Query.users array of Node types replaced with the Connection?
  const userField = (schema.getType('Query') as GraphQLObjectType).getFields()['users']
  expect(userField.type).toEqual(schema.getType('UserConnection'))
})
