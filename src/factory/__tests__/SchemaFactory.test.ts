import { SchemaFactory } from '../SchemaFactory'

test('Create a registry and add types and resolvers', () => {
  const registry = new SchemaFactory()
  registry.add(`
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

  registry.add(`
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
  const schema = registry.getSchema()
  expect(schema.getType('Query')).toBeTruthy()
})
