import { SchemaFactory } from '../SchemaFactory'

test('Create a registry and add types and resolvers', () => {
  const factory = new SchemaFactory()
  factory.extendWithSpec(`
  type Query {
    get: String
    t: NewType
  }
  schema {
    query: Query
  }
  `, {
    Query: {
      get: () => 'Hello, world',
    },
  })

  factory.extendWithSpec(`
  enum FakeEnum { a b c }
  type NewType {
    id: ID!
    e: FakeEnum
  }
  `, {
    NewType: {
      id: () => 1,
    },
  })
  const schema = factory.getSchema()
  expect(schema.getType('Query')).toBeTruthy()
})
