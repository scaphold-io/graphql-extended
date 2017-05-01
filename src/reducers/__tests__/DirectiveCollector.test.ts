import DirectiveCollector from '../DirectiveCollector'
import { parse } from 'graphql'
import { execute } from '../../execution/execute'
import { buildASTSchema } from '../../utilities/buildASTSchema'

test('Should collect all engaged directives for the query', () => {
  const spec = `
  type Query {
    posts: [Post]
      @relation(kind: HasMany)
  }
  type Post {
    title: String
      @relation(kind: HasMany)
  }
  `
  const schema = buildASTSchema(parse(spec), {
    Query: {
      posts: (_s, _a, ctx) => {
        expect(ctx!['_directives']).toMatchObject(['relation', 'relation'])
      },
    },
  })
  const query = `
  query Test {
    posts {
      title
    }
  }
  `

  const directiveCollector = new DirectiveCollector<string>(
    (directive) => directive.name,
    (acc, ctx) => ({ ...ctx, _directives: acc }),
  )

  execute({
    schema,
    document: parse(query),
    queryReducers: [ directiveCollector ],
  }).then(result => {
    const errors = result.errors || []
    expect(errors).toHaveLength(0)
  })
})
