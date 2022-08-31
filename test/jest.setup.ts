import * as fs from 'fs'
import * as path from 'path'
import { invariant } from 'outvariant'
import { CreateBrowserApi, createBrowser } from 'page-with'
import { HttpServer } from '@open-draft/test-server/http'
import { SERVICE_WORKER_BUILD_PATH } from '../config/constants'
import {
  createWorkerConsoleServer,
  workerConsoleSpy,
} from './support/workerConsole'

let browser: CreateBrowserApi
let workerConsoleServer: HttpServer

beforeAll(async () => {
  workerConsoleServer = await createWorkerConsoleServer()

  const browserInstance = await createBrowser({
    serverOptions: {
      router(app) {
        // Prevent Express from responding with cached 304 responses.
        app.set('etag', false)

        app.get('/mockServiceWorker.js', (req, res) => {
          const workerScript = fs.readFileSync(
            SERVICE_WORKER_BUILD_PATH,
            'utf8',
          )

          // Edit the worker script to signal any console messages
          // to the standalone server. This way tests can spy on the
          // console messages from the worker.
          res.set('Content-Type', 'application/javascript').send(`
${workerScript}

// EVERYTHING BELOW THIS LINE IS APPENDED TO THE WORKER SCRIPT
// ONLY DURING THE TEST RUN.
const originals = {}
Object.keys(console).forEach((methodName) => {
  originals[methodName] = console[methodName]
  console[methodName] = (...args) => {
    fetch('${workerConsoleServer.http.url('/console/')}' + methodName, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    })

    originals[methodName](...args)
  }
})
`)
        })
      },
      webpackConfig: {
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              exclude: /node_modules/,
              use: [
                {
                  loader: 'ts-loader',
                  options: {
                    configFile: path.resolve(__dirname, '../tsconfig.json'),
                    transpileOnly: true,
                  },
                },
              ],
            },
          ],
        },
        resolve: {
          alias: {
            msw: path.resolve(__dirname, '..'),
          },
          extensions: ['.ts', '.js'],
        },
      },
    },
  }).catch((error) => {
    console.error('Failed to create browser:', error)
  })

  invariant(
    browserInstance,
    'Failed to run the "beforeAll" hook: the browser instance is missing or malformed.',
    browserInstance,
  )

  browser = browserInstance
})

afterEach(() => {
  workerConsoleSpy.clear()
})

afterAll(async () => {
  invariant(
    browser,
    'Failed to run the "afterAll" hook: the browser instance does not exist.',
    browser,
  )

  await Promise.all([browser.cleanup(), workerConsoleServer.close()])
})
