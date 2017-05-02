# graphql-extended

An extension of graphql-js that adds useful functionality for production graphql servers.

# Features

- [Schema Factory](#schema-factory): Use schema lang to reliably build schemas spread across many files.

- [Factory Middleware](#factory-middleware): Automate schema build tasks.

  - [Relay Middleware](#relay-middleware): Turn simple schemas into Relay compliant ones.

- [Query Reducers](#query-reducers): Dynamically collect information on queries.

  - [Complexity Reducer](#complexity-reducer): Measure query complexity

- [Query Middleware](#query-middleware): Regularly execute code at query time.

  - [Resolver Timer Middleware](#resolver-timer-middleware): Measure query complexity

## Schema Factory

The schema factory provides a powerful abstraction on top of graphql-js that simplfies managing and building complex schemas. The factory is backed by immutable data structures and provides helpful methods to create GraphQL schemas from schema language.

The factory can also help you break up your schemas across different files. Here is an example of the factory at work.

```javascript
// factory.ts
const factory = new SchemaFactory()
export default factory

// types/User.ts
import factory from '../factory'
factory.extendWithSpec(`
type Query {
  user: User
  posts: [Post]
}
`, {
  Query: {
    user: (_source, _args, ctx) => ctx.db.User.getLoggedIn(),
  },
})

// types/Post.ts
import factory from '../factory'
factory.extendWithSpec(`
enum PostType { Image Text Video }

type Post {
  id: ID!
  type: PostType!
  title: String
  url: String

}
`)

// types/User.ts
import factory from '../factory'
factory.extendWithSpec(`
type User {
  id: ID!
  username: String!
  password: String!
  createdAt: DateTime
  lastLogin: DateTime
}
`)

// app.ts
import factory from './factory'
import 'types/User'
import 'types/Post'
const schema = factory.getSchema()
```

## Factory Middleware

Just like it is useful to have middleware that runs within the time frame of a query execution,
it is also useful to be able to apply middleware at the schema generation phase. For example, you
might find that you have a lot of common structures that are used all over a schema with only
very slight differences. You will see this very often if you are building a Relay compliant
GraphQL schema. In Relay, you will create Connection & Edge types for many base types in your schema.

Example:

A simple schema without Relay style connections might look like this.

```graphql
type User {
  id: ID!
  name: String!
}

type Post {
  id: ID!
  title: String!
}

type Query {
  users: [User]
  posts: [Post]
}
```

And this same conceptual schema with Relay style connections would look like this.

```graphql
type User {
  id: ID!
  name: String!
}

type UserEdge {
  node: User
  cursor: Cursor
}

type UserConnection {
  edges: [UserEdge]
  pageInfo: PageInfo
}

type Post {
  id: ID!
  title: String!
}

type PostEdge {
  node: Post
  cursor: Cursor
}

type PostConnection {
  edges: [PostEdge]
  pageInfo: PageInfo
}

type PageInfo {
  hasNextPage: Boolean
  hasPreviousPage: Boolean
}

type Query {
  users: UserConnection
  posts: PostConnection
}
```

As you can see this can be extremely verbose. To help with this, the SchemaFactory takes
an optional FactoryMiddleware instance in its config that can help automate these tasks.

### Relay Middleware

This library comes with a RelayMiddlware class that you can immediately use to turn simple
GraphQL schemas into Relay complaint ones. The code below will automatically convert the
schema document in to the Relay compliant schema demonstrated above.

```javascript
// The RelayMiddleware takes a function that resolves the node interface.
const relayMiddleware = new RelayMiddleware(v => (v && v['name']) ? 'User' : 'Post')
const factory = new SchemaFactory({
  middleware: relayMiddleware,
})

factory.extendWithSpec(`
  type User {
    id: ID!
    name: String!
  }

  type Post {
    id: ID!
    title: String!
  }

  type Query {
    users: [User]
    posts: [Post]
  }
`)

const schema = factory.getSchema()
```

## Query Reducers

It is often useful to be able to do some sort of analysis on a query before it executes. For example,
you might want to measure query complexity so that you can reject overly complicated queries.

This library exposes a `QueryReducer` interface that when implemented can be passed to the `execute`
function. A query reducer defines `reduceField` which is called for each field selected in the
query as well as `reduceCtx` which takes the results of the previous reducers and merges them into
the GraphQL context.

### Complexity Reducer

This is an example of a ComplexityReducer that counts a complexity of 1 for each field requested
in the query.

```javascript
import { QueryReducer } from 'graphql-extended'

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
import { execute } from 'graphql-extended'
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

## Query Middleware

Middleware lets you easily add custom logic that will be run within the lifecycle of a
GraphQL query execution. The `Middleware` interface found in `execution/middleware.ts` defines four methods:

- `beforeQuery`

  - Run before a query is executed. This is responsible for providing a context object (or `MiddlewareValue`) that is specific to this middleware instance. E.G. this query might return a `new Map()` that can be manipulated & used by future calls to `beforeField`, `afterField`, and `afterQuery`

- `afterQuery`

  - Run after a query finishes executing. This serves as a convenient hook for consuming or logging information from the `MiddlewareValue` or other execution information.


- `beforeField`

  - Run after `field.resolve` for each field selected in the query. Any value returned from
  this method serves as a context (or `FieldValue`) for this specific field. The return
  value of this method is passed to `afterField` along with other execution information.

- `afterField`

  - Run after `field.resolve` for each field selected in the query. Any values returned from
  this method will overwrite the result of the field resolver. If multiple `Middleware` implementations are passed to `execute` then the results of `afterField` are composed together such that the output of the first `afterField` is passed on as the input value to the next `afterField`.

  ### Resolver Timer Middleware

  This middleware tracks the run time of each field resolver function. This is found in `middleware/ResolverTimer`

  ```javascript
  import { Middleware, ResolverContext } from 'graphql-extended/execution/middleware'
  import { ExecutionContext } from 'graphql-extended/execution/ExecutionContext'

  type FieldTimerTimeUnit = 'milli' | 'micro' | 'nano'

  export class ResolverTimer implements Middleware<Map<string, number>, number, mixed> {

    constructor(
      private logger: (
        totalRunTime: number,
        resolverDurationMap: Map<string, number>,
      ) => mixed | void,
      private timeUnit: FieldTimerTimeUnit = 'milli',
    ) {}

    /**
    * Returns a Map that acts as our Middleware's accumulator/context
    */
    public beforeQuery(): Map<string, number> {
      const contextmap = new Map()
      contextmap.set('__START__', this.getTime())
      return contextmap
    }

    /**
    * Returns the timestamp when a field starts to be executed.
    */
    public beforeField(): number {
      return this.getTime()
    }

    /**
    * Calculates the time since the field started resolution and updates MiddlewareValue
    */
    public afterField(
      mVal: Map<string, number>,
      fValue: number,
      _value: mixed,
      _eCtx: ExecutionContext,
      mCtx: ResolverContext<mixed>,
    ): undefined {
      mVal.set(
        `${mCtx.info.parentType.name}.${mCtx.info.fieldName}`,
        this.getTime() - fValue,
      )
      return
    }

    /**
    * Calculates the total query runtime and calls out to the user defined logger function.
    */
    public afterQuery(mVal: Map<string, number>): void {
      const totalRuntime = this.getTime() - (mVal.get('__START__') as number)
      mVal.delete('__START__')
      this.logger(totalRuntime, mVal)
    }

    private getTime(): number {
      const hrTime = process.hrtime()
      switch (this.timeUnit) {
        case 'milli': return hrTime[0] * 1000 + hrTime[1] / 1000000
        case 'micro': return hrTime[0] * 1000000 + hrTime[1] / 1000
        case 'nano': return hrTime[0] * 1000000000 + hrTime[1]
        default: return hrTime[0] * 1000000000 + hrTime[1]
      }
    }
  }
  ```

# Developing

This project is written in [Typescript](https://www.typescriptlang.org/) and requires the typescript compiler to build.

To develop this project locally clone & build the project.

1. `mkdir graphql-extended && cd graphql-extended`
2. `git clone https://github.com/scaphold/graphql-extended.git .`
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
