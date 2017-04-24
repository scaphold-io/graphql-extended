import { parse } from 'graphql'
import { buildASTSchema } from '../../utilities/buildASTSchema'
import { execute } from '../../execution/execute'
import { ResolverTimer } from '../../middleware/ResolverTimer'

test('Build simple schema and execute with ResolverTimer', () => {
  const spec = `
  type Droid {
    id: ID!
      @relation(kind: HasMany)

    serialNumber: String!
  }

  type Pet {
    name: String!
    age: Int!
  }

  type Query {
    droid(id: ID!): Droid
    pets(limit: Int): [Pet]
  }
  `
  const parsed = parse(spec)
  const built = buildASTSchema(parsed)
  const query = `
  query Test {
    droid(id: "1000") {
      id
      serialNumber
    }

    pets(limit: 20) {
      name
      age
    }
  }
  `

  execute({
    schema: built,
    document: parse(query),
    middleware: [ new ResolverTimer(
      (totalRuntime, _resTimer) => {
        expect(totalRuntime).toBeGreaterThan(1)
      },
      'micro',
    ) ],
  })
})
