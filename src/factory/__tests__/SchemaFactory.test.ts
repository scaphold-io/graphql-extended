import { SchemaFactory } from '../SchemaFactory'

test('Create a registry and add types and resolvers', () => {
  const factory = new SchemaFactory()
  factory.extendWithSpec(`

  # Specifies am alias for the SQL table that backs this type
  directive @sqlTable(name: String) on OBJECT
  directive @sqlTable2(name: String) on FIELD_DEFINITION

  type Query @sqlTable {
    user: User
    posts: [Post]
  }
  schema {
    query: Query
  }
  type User {
    id: ID!
    name: String!
  }
  `, {
    Query: {
      user: () => ({ id: 1, name: 'Hello, world' }),
    },
  })

  factory.extendWithSpec(`
  enum PostType { image video text }
  type Post {
    id: ID!
    type: PostType
  }
  extend type User {
    extension: String
  }
  `, {
    Post: {
      id: () => 1,
    },
  })
  const schema = factory.getSchema()
  expect(schema.getType('Query')).toBeTruthy()
})
