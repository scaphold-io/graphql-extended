import { parse, GraphQLSchema } from 'graphql'
import { buildASTSchema } from '../../utilities/buildASTSchema'

test('Parse and build object with directives', () => {
  const spec = `
  type Droid {
    id: ID!
      @relation(kind: HasOne)

    serialNumber: String!
  }

  type Query {
    droid(id: ID!): Droid
  }
  `
  const parsed = parse(spec)
  const built = buildASTSchema(parsed)
  expect(built).toBeInstanceOf(GraphQLSchema)
})
