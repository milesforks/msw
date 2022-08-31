import * as path from 'path'
import { pageWith } from 'page-with'
import { HttpServer } from '@open-draft/test-server/http'

let server: HttpServer

beforeAll(async () => {
  server = new HttpServer((app) => {
    app.get('/posts', (req, res) => {
      return res.status(204).end()
    })
  })
  await server.listen()
})

afterAll(async () => {
  await server.close()
})

test('handles a 204 status response without Response instance exceptions', async () => {
  const runtime = await pageWith({
    example: path.resolve(__dirname, 'basic.mocks.ts'),
  })
  let pageError: Error

  runtime.page.on('pageerror', (error) => {
    pageError = error
  })

  const res = await runtime.request(server.http.url('/posts'))

  // There must be no such exception:
  // Failed to construct 'Response': Response with null body status cannot have body
  expect(pageError).toBeUndefined()
  expect(res.status()).toBe(204)
})
