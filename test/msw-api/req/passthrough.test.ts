/**
 * @jest-environment jsdom
 */
import * as path from 'path'
import { pageWith } from 'page-with'
import { rest, SetupWorkerApi } from 'msw'
import { HttpServer } from '@open-draft/test-server/http'

declare namespace window {
  export const msw: {
    worker: SetupWorkerApi
    rest: typeof rest
  }
}

interface ResponseBody {
  name: string
}

function prepareRuntime() {
  warnDeveloperInDebugModeThatTestsAreExpectedToFail()
  return pageWith({
    example: path.resolve(__dirname, 'passthrough.mocks.ts'),
  })
}

let httpServer: HttpServer

beforeAll(async () => {
  httpServer = new HttpServer((app) => {
    app.post<never, ResponseBody>('/user', (req, res) => {
      res.json({ name: 'John' })
    })
  })
  await httpServer.listen()
})

afterAll(async () => {
  await httpServer.close()
})

it('performs request as-is when returning "req.passthrough" call in the resolver', async () => {
  const runtime = await prepareRuntime()
  const endpointUrl = httpServer.http.url('/user')

  await runtime.page.evaluate((endpointUrl) => {
    const { worker, rest } = window.msw
    worker.use(
      rest.post<never, ResponseBody>(endpointUrl, (req) => {
        return req.passthrough()
      }),
    )
  }, endpointUrl)

  const res = await runtime.request(endpointUrl, { method: 'POST' })
  const headers = await res.allHeaders()
  const json = await res.json()

  expect(json).toEqual<ResponseBody>({
    name: 'John',
  })
  expect(headers).toHaveProperty('x-powered-by', 'Express')
  expect(runtime.consoleSpy.get('warning')).toBeUndefined()
})

it('does not allow fall-through when returning "req.passthrough" call in the resolver', async () => {
  const runtime = await prepareRuntime()
  const endpointUrl = httpServer.http.url('/user')

  await runtime.page.evaluate((endpointUrl) => {
    const { worker, rest } = window.msw
    worker.use(
      rest.post<never, ResponseBody>(endpointUrl, (req) => {
        return req.passthrough()
      }),
      rest.post<never, ResponseBody>(endpointUrl, (req, res, ctx) => {
        return res(ctx.json({ name: 'Kate' }))
      }),
    )
  }, endpointUrl)

  const res = await runtime.request(endpointUrl, { method: 'POST' })
  const headers = await res.allHeaders()
  const json = await res.json()

  expect(json).toEqual<ResponseBody>({
    name: 'John',
  })
  expect(headers).toHaveProperty('x-powered-by', 'Express')
  expect(runtime.consoleSpy.get('warning')).toBeUndefined()
})

it('prints a warning and performs a request as-is if nothing was returned from the resolver', async () => {
  const runtime = await prepareRuntime()
  const endpointUrl = httpServer.http.url('/user')

  await runtime.page.evaluate((endpointUrl) => {
    const { worker, rest } = window.msw
    worker.use(
      rest.post<never, ResponseBody>(endpointUrl, () => {
        return
      }),
    )
  }, endpointUrl)

  const res = await runtime.request(endpointUrl, { method: 'POST' })
  const headers = await res.allHeaders()
  const json = await res.json()

  expect(json).toEqual<ResponseBody>({
    name: 'John',
  })
  expect(headers).toHaveProperty('x-powered-by', 'Express')

  expect(runtime.consoleSpy.get('warning')).toEqual(
    expect.arrayContaining([
      expect.stringContaining(
        '[MSW] Expected response resolver to return a mocked response Object, but got undefined. The original response is going to be used instead.',
      ),
    ]),
  )
})

/*
 * If tests are running with DEBUG=1 (with a live/"headful" Playwright browser),
 * print one friendly warning to avoid frustration of apparently unfixable tests
 */
let warned: string | undefined
const warnDeveloperInDebugModeThatTestsAreExpectedToFail = () => {
  if (!process.env.DEBUG || warned) {
    return
  }

  warned = [
    'WARNING [passthrough.test.ts]: these tests will FAIL with DEBUG enabled!',
    '\tOpening the Playwright debug browser interferes with the test, because',
    '\tit triggers a navigation request that the service worker intercepts,',
    '\tproducing an unexpected and unhandled request, but only in debug mode.',
  ].join('\n')

  console.warn(warned)
}
