import * as path from 'path'
import { pageWith } from 'page-with'
import { ExecutionResult, buildSchema, graphql } from 'graphql'
import { HttpServer } from '@open-draft/test-server/http'
import { SetupWorkerApi } from 'msw'
import { gql } from '../support/graphql'

declare namespace window {
  export const dispatchGraphQLQuery: (uri: string) => Promise<ExecutionResult>
  export const msw: {
    registration: SetupWorkerApi['start']
  }
}

let httpServer: HttpServer

beforeAll(async () => {
  // This test server simulates a production GraphQL server
  // and uses a hard-coded `rootValue` to resolve queries
  // against the schema.
  httpServer = new HttpServer((app) => {
    app.post('/graphql', async (req, res) => {
      const result = await graphql({
        schema: buildSchema(gql`
          type User {
            firstName: String!
            lastName: String!
          }

          type Query {
            user: User!
          }
        `),
        source: req.body.query,
        rootValue: {
          user: {
            firstName: 'John',
            lastName: 'Maverick',
          },
        },
      })

      return res.status(200).json(result)
    })
  })
  await httpServer.listen()
})

afterAll(async () => {
  await httpServer.close()
})

function createRuntime() {
  return pageWith({
    example: path.join(__dirname, 'response-patching.mocks.ts'),
  })
}

test('patches a GraphQL response', async () => {
  const runtime = await createRuntime()
  const endpointUrl = httpServer.http.url('/graphql')

  await runtime.page.evaluate(() => {
    return window.msw.registration
  })

  const res = await runtime.page.evaluate(
    ([url]) => {
      return window.dispatchGraphQLQuery(url)
    },
    [endpointUrl],
  )

  expect(res.errors).toBeUndefined()
  expect(res.data).toHaveProperty('user', {
    firstName: 'Christian',
    lastName: 'Maverick',
  })
})
