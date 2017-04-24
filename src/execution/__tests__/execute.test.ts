import { parse, ExecutionResult } from 'graphql'
import { buildASTSchema } from '../../utilities/buildASTSchema'
import { execute } from '../../execution/execute'
import ComplexityReducer from '../../reducers/ComplexityReducer'

test('Build simple schema and execute with ComplexityReducer', () => {
  const spec = `
  type Droid {
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
  const built = buildASTSchema(parsed, {
    Query: {
      droid: () => ({ id: '1000', serialNumber: 'ABC' }),
      pets: () => {
        return [
          { name: 'Buddy', age: 17 },
          { name: 'Lucky', age: 18 },
        ]
      },
    },
  })
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
    queryReducers: [ new ComplexityReducer() ],
  }).then((result: ExecutionResult) => {
    expect(result).toMatchObject({
      data: {
        droid: { id: '1000', serialNumber: 'ABC' },
        pets: [
          { name: 'Buddy', age: 17 },
          { name: 'Lucky', age: 18 },
        ],
      },
    })
  })
})
