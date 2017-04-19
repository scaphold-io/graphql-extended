import { parse } from 'graphql'
import { buildASTSchema } from '../../utilities/buildASTSchema'
import { execute } from '../../execution/execute'
import ComplexityReducer from '../../reducers/ComplexityReducer'

test('Parse and build object with directives', () => {
  const spec = `
  type User {
    id: ID!
      @relation(kind: HasOne)

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
  query GetUserAndPosts {
    user {
      id
      username
    }

    posts(limit: 20) {
      name
      age
    }
  }
  `

  execute({
    schema: built,
    document: parse(query),
    queryReducers: [ new ComplexityReducer() ],
  })
})
