# stateslang-js

A javascript implementation of the Amazon States Language

See the official Amazon docs here: https://docs.aws.amazon.com/step-functions/latest/dg/awl-ref.html

# Introduction

Welcome to stateslang-js! This library was designed to execute state machines described by the Amazon States Language. Amazon created the States Language in order to coordinate the components of distributed applications and microservices via AWS step functions. This library takes their awesome work and provides a run-time so that you can create these powerful workflows on your own.

## Back to the fundamentals

A **State Machine** is a mathematical model of computation. Programming is messy enough as it is and having a mathematical model through which we can reason about our applications is a very powerful ability. This library encourages you to think about your applications as composable units (or states) with easily understood upstream and downstream workflows. It encourages functional programming styles & immutability to remove hard to debug issues resulting from side-effects.

# Developing

This project is written in [Typescript](https://www.typescriptlang.org/) and requires the typescript compiler to build.

To develop this project locally clone & build the project.

1. `mkdir stateslang-js && cd stateslang-js`
2. `git clone https://github.com/mlp5ab/stateslang-js.git .`
3. `npm install`
4. `npm run buildw`

This will start the typescript compiler and will watch for changes. If you want to build one time run `npm run build`

## Thanks

Thanks to [Scaphold.io](https://scaphold.io) for sponsoring this work :)

# License

The MIT License (MIT)

Copyright (c) 2017 Michael Paris

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

