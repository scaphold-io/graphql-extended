# graphql-ext

An extension of graphql-js that adds useful functionality for production graphql deployments.

# Features

## Query Reducers

It is often useful to be able to do some sort of analysis on a query before it executes. For example,
you might want to measure query complexity so that you can reject overly complicated queries.

This library exposes a `QueryReducer` interface that when implemented can be passed to the `execute`
function. A query reducer defines `reduceField` which is called for each field selected in the
query as well as `reduceCtx` which takes the results of the previous reducers and merges them into
the GraphQL context.

This is an example of a ComplexityReducer that counts a complexity of 1 for each field requested
in the query.

```javascript
import { QueryReducer } from 'graphql-ext'

export default class ComplexityReducer implements QueryReducer<number, Object> {

  public initial: number

  constructor() {
    this.initial = 0
  }

  public reduceField(parent: number, child: number): number {
    const estimate = 1 + child
    return parent + estimate
  }

  public reduceScalar(): number {
    return 0
  }

  public reduceEnum(): number {
    return 0
  }

  public reduceCtx(acc: number, ctx: Object): Object {
    return {
      ...ctx,
      complexity: acc,
    }
  }
}
```

You can provide this reducer to the `execute` function. The execute function will run the reducer
and the `reduceCtx` method will make the result of `6` available to your reducers through
`ctx.complexity`.

```javascript
import { execute } from 'graphql-ext'
execute({
  schema: built,
  document: parse(`
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
  `),
  queryReducers: [ new ComplexityReducer() ],
})
```

# Developing

This project is written in [Typescript](https://www.typescriptlang.org/) and requires the typescript compiler to build.

To develop this project locally clone & build the project.

1. `mkdir graphql-ext && cd graphql-ext`
2. `git clone https://github.com/scaphold/graphql-ext.git .`
3. `npm install`
4. `npm run buildw`

This will start the typescript compiler and will watch for changes. If you want to build one time run `npm run build`

## Thanks

Thanks to [Scaphold.io](https://scaphold.io) for sponsoring this work :)

# License

The MIT License (MIT)

Copyright (c) 2017 Scaphold

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
