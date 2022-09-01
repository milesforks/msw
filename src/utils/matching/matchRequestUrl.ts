import { match } from 'path-to-regexp'
import { getCleanUrl } from '@mswjs/interceptors/lib/utils/getCleanUrl'
import { normalizePath } from './normalizePath'

export type Path = string | RegExp
export type PathParams<KeyType extends keyof any = string> = {
  [ParamName in KeyType]: string | ReadonlyArray<string>
}

export interface Match {
  matches: boolean
  params?: PathParams
}

/**
 * Coerce a path supported by MSW into a path
 * supported by "path-to-regexp".
 */
export function coercePath(path: string): string {
  return (
    path
      /**
       * Replace wildcards ("*") with unnamed capturing groups
       * because "path-to-regexp" doesn't support wildcards.
       * Ignore path parameter' modifiers (i.e. ":name*").
       */
      .replace(
        /([:a-zA-Z_-]*)(\*{1,2})+/g,
        (_, parameterName: string | undefined, wildcard: string) => {
          const expression = '(.*)'

          if (!parameterName) {
            return expression
          }

          return parameterName.startsWith(':')
            ? `${parameterName}${wildcard}`
            : `${parameterName}${expression}`
        },
      )
      /**
       * Escape any `:` character in the SCHEME, PORT, and HOST (if bracketed IPv6)
       * This allows `path-to-regexp` to match absolute URL including port numbers.
       * @see https://github.com/pillarjs/path-to-regexp/issues/259
       *
       * Example bracketed IPv6 replacement (any `:` in HOST is escaped):
       * ```
       * http://[::1]:3000/:aaa/:bbb
       * http\://[\:\:1]\:3000/:aaa/:bbb
       *```
       *
       * Example non-bracketed replacement (any `:` in HOST is _not_ escaped)
       * ```
       * http://:subdomain.example.com:3000/:aaa/:bbb
       * http\://:subdomain.example.com\:3000/:aaa/:bbb
       * ```
       *
       * Scheme, port, and path are optional, but address is always expected
       * to exist (e.g. `http://` is invalid, but `http://:foobar` is OK)
       */
      .replace(
        /(?<scheme>^(?:\/\/|(?:[^\/\s]+)(?::)(?=\/\/)\/\/))?(?<addr>(?<bracketed>\[(?<ip6addr>[0-9a-f:]+?)\])|(?<unbracketed>[^\/\[\]\s]+)(?<!:[0-9]{1,5}))(?=\/|\:[0-9]{1,5}|$)(?<port>:[0-9]{1,5})?(?<path>\/$|(?:\/[^\/\s]+)+?$)?$/,
        (_substring, ...args) => {
          const namedGroups = args.slice(-1)[0]
          const { bracketed, path, port, scheme, unbracketed } = namedGroups

          return [
            scheme?.replace(/:/, '\\:') ?? '',
            bracketed?.replace(/:/g, '\\:') ?? unbracketed,
            port?.replace(/^:/, '\\:') ?? '',
            path ?? '',
          ].join('')
        },
      )
  )
}

/**
 * Returns the result of matching given request URL against a mask.
 */
export function matchRequestUrl(url: URL, path: Path, baseUrl?: string): Match {
  const normalizedPath = normalizePath(path, baseUrl)
  const cleanPath =
    typeof normalizedPath === 'string'
      ? coercePath(normalizedPath)
      : normalizedPath

  const cleanUrl = getCleanUrl(url)
  const result = match(cleanPath, { decode: decodeURIComponent })(cleanUrl)
  const params = (result && (result.params as PathParams)) || {}

  return {
    matches: result !== false,
    params,
  }
}
