import { parse } from 'graphql'
import { execute } from '../../execution/execute'
import { Suffixer } from '../../middleware/Suffixer'
import { SchemaFactory } from '../../factory/SchemaFactory'

test('Build simple schema and execute with ResolverTimer', () => {
  const spec = `
  type Query {
    getString: String
    getNonNullString: String
  }
  `
  const factory = new SchemaFactory()
  factory.extendWithSpec(spec, {
    Query: {
      getString: () => 'getString',
      getNonNullString: () => 'getNonNullString',
    },
  })
  const query = `
  query Test {
    getString
    getNonNullString
  }
  `

  execute({
    schema: factory.getSchema(),
    document: parse(query),
    middleware: [ new Suffixer(' hello'), new Suffixer(' world') ],
  }).then(res => {
    expect(res.data).toMatchObject({
      getString: 'getString world hello',
      getNonNullString: 'getNonNullString world hello',
    })
  })
})
