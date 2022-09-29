/**
 * @jest-environment jsdom
 */
import { coercePath, matchRequestUrl } from './matchRequestUrl'

describe('matchRequestUrl', () => {
  test('returns true when matches against an exact URL', () => {
    const match = matchRequestUrl(
      new URL('https://test.mswjs.io'),
      'https://test.mswjs.io',
    )
    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', {})
  })

  test('returns true when matched against a wildcard', () => {
    const match = matchRequestUrl(new URL('https://test.mswjs.io'), '*')
    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', {
      '0': 'https://test.mswjs.io/',
    })
  })

  test('returns true when matched against a RegExp', () => {
    const match = matchRequestUrl(
      new URL('https://test.mswjs.io'),
      /test\.mswjs\.io/,
    )
    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', {})
  })

  test('returns path parameters when matched', () => {
    const match = matchRequestUrl(
      new URL('https://test.mswjs.io/user/abc-123'),
      'https://test.mswjs.io/user/:userId',
    )
    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', {
      userId: 'abc-123',
    })
  })

  test('decodes path parameters', () => {
    const url = 'http://example.com:5001/example'
    const match = matchRequestUrl(
      new URL(`https://test.mswjs.io/reflect-url/${encodeURIComponent(url)}`),
      'https://test.mswjs.io/reflect-url/:url',
    )
    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', {
      url,
    })
  })

  test('decodes path parameters with ipv6 address', () => {
    const url = 'http://example.com:5001/example'
    const match = matchRequestUrl(
      new URL(`https://[::1]/reflect-url/${encodeURIComponent(url)}`),
      'https://[::1]/reflect-url/:url',
    )
    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', {
      url,
    })
  })

  test('returns false when does not match against the request URL', () => {
    const match = matchRequestUrl(
      new URL('https://test.mswjs.io'),
      'https://google.com',
    )
    expect(match).toHaveProperty('matches', false)
    expect(match).toHaveProperty('params', {})
  })

  test('returns true for exact match ipv4', () => {
    const match = matchRequestUrl(
      new URL('http://127.0.0.1:62588/user'),
      'http://127.0.0.1:62588/user',
    )

    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', {})
  })

  test('returns true for exact match ipv6', () => {
    const match = matchRequestUrl(
      new URL('http://[::1]:62588/user'),
      'http://[::1]:62588/user',
    )

    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', {})
  })

  test('returns true for wildcard match ipv6 with parameters', () => {
    const match = matchRequestUrl(
      new URL('http://[::1]:62588/user/23848304'),
      'http://[::1]:62588/user/:user_id',
    )

    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', { user_id: '23848304' })
  })

  test('returns true for wildcard match ipv6, no port, with parameters', () => {
    const match = matchRequestUrl(
      new URL('http://[::1]/user/23848304'),
      'http://[::1]/user/:user_id',
    )

    expect(match).toHaveProperty('matches', true)
    expect(match).toHaveProperty('params', { user_id: '23848304' })
  })

  test('returns false for wildcard non-match ipv6 with parameters', () => {
    const match = matchRequestUrl(
      new URL('http://[::1]:62588/not-matching/23848304'),
      'http://[::1]:62588/user/:user_id',
    )

    expect(match).toHaveProperty('matches', false)
    expect(match).toHaveProperty('params', {})
  })
})

describe('coercePath', () => {
  test('escapes the colon in protocol', () => {
    expect(coercePath('https://example.com')).toEqual('https\\://example.com')
    expect(coercePath('https://example.com/:userId')).toEqual(
      'https\\://example.com/:userId',
    )
    expect(coercePath('http://localhost:3000')).toEqual(
      'http\\://localhost\\:3000',
    )
    expect(coercePath('http://[::1]:3000')).toEqual('http\\://[\\:\\:1]\\:3000')
    expect(coercePath('http://[::1]')).toEqual('http\\://[\\:\\:1]')
    expect(coercePath('https://[::1]')).toEqual('https\\://[\\:\\:1]')
    expect(coercePath('https://[::1]/:111')).toEqual('https\\://[\\:\\:1]/:111')
    expect(coercePath('http://127.0.0.1:3000')).toEqual(
      'http\\://127.0.0.1\\:3000',
    )
    expect(coercePath('http://127.0.0.1')).toEqual('http\\://127.0.0.1')
    expect(coercePath('https://127.0.0.1')).toEqual('https\\://127.0.0.1')
    expect(coercePath('https://127.0.0.1/:111')).toEqual(
      'https\\://127.0.0.1/:111',
    )
  })

  test('escapes any colon(s) in host for bracketed ipv6 host ::1', () => {
    expect(coercePath('http://[::1]:3000/:aaa/:bbb/:3000')).toEqual(
      'http\\://[\\:\\:1]\\:3000/:aaa/:bbb/:3000',
    )
    expect(coercePath('http://[::1]:3000')).toEqual('http\\://[\\:\\:1]\\:3000')
    expect(coercePath('//[::1]:3000')).toEqual('//[\\:\\:1]\\:3000')
    expect(coercePath('//[::1]:3000/')).toEqual('//[\\:\\:1]\\:3000/')
    expect(coercePath('[::1]')).toEqual('[\\:\\:1]')
    expect(coercePath('[::1]')).toEqual('[\\:\\:1]')
    expect(coercePath('http://[::1]')).toEqual('http\\://[\\:\\:1]')
    expect(coercePath('http://[::1]/')).toEqual('http\\://[\\:\\:1]/')
    expect(coercePath('[::1]/foo/bar')).toEqual('[\\:\\:1]/foo/bar')
    expect(coercePath('[::1]/:360/:180')).toEqual('[\\:\\:1]/:360/:180')
  })

  test('escapes any colon(s) in host for bracketed ipv6 host [1:2:3::4]', () => {
    expect(coercePath('http://[1:2:3::4]:3000')).toEqual(
      'http\\://[1\\:2\\:3\\:\\:4]\\:3000',
    )
    expect(coercePath('//[1:2:3::4]:3000')).toEqual(
      '//[1\\:2\\:3\\:\\:4]\\:3000',
    )
    expect(coercePath('//[1:2:3::4]:3000/')).toEqual(
      '//[1\\:2\\:3\\:\\:4]\\:3000/',
    )
    expect(coercePath('[1:2:3::4]')).toEqual('[1\\:2\\:3\\:\\:4]')
    expect(coercePath('[1:2:3::4]')).toEqual('[1\\:2\\:3\\:\\:4]')
    expect(coercePath('http://[1:2:3::4]')).toEqual(
      'http\\://[1\\:2\\:3\\:\\:4]',
    )
    expect(coercePath('http://[1:2:3::4]/')).toEqual(
      'http\\://[1\\:2\\:3\\:\\:4]/',
    )
    expect(coercePath('[1:2:3::4]/foo/bar')).toEqual(
      '[1\\:2\\:3\\:\\:4]/foo/bar',
    )
    expect(coercePath('[1:2:3::4]/:360/:180')).toEqual(
      '[1\\:2\\:3\\:\\:4]/:360/:180',
    )
  })

  test('escapes any colon(s) in host for various bracketed ipv6 hosts', () => {
    expect(coercePath('//[1:2:3::4]:3000')).toEqual(
      '//[1\\:2\\:3\\:\\:4]\\:3000',
    )
    expect(coercePath('//[1:2:37ce::4]:3000')).toEqual(
      '//[1\\:2\\:37ce\\:\\:4]\\:3000',
    )
    expect(coercePath('[5:6:7ce3:333:e22::]:64735/user_ipv6/:111')).toEqual(
      '[5\\:6\\:7ce3\\:333\\:e22\\:\\:]\\:64735/user_ipv6/:111',
    )
  })

  test('does not escape any colon(s) in host for non-bracketed ipv6 hosts', () => {
    expect(
      coercePath('http://:subdomain.localhost:3000/:aaa/:bbb/:3000'),
    ).toEqual('http\\://:subdomain.localhost\\:3000/:aaa/:bbb/:3000')
    expect(coercePath('http://127.0.0.:subnet:3000/:aaa/:bbb/:3000')).toEqual(
      'http\\://127.0.0.:subnet\\:3000/:aaa/:bbb/:3000',
    )
    expect(coercePath('127.0.0.:subnet:3000')).toEqual('127.0.0.:subnet\\:3000')
    expect(coercePath('127.0.0.:subnet/')).toEqual('127.0.0.:subnet/')
    expect(coercePath('//127.0.0.:subnet/')).toEqual('//127.0.0.:subnet/')
    expect(coercePath('http://127.0.0.:subnet/')).toEqual(
      'http\\://127.0.0.:subnet/',
    )

    // note: ipv6 is hexadecimal, i.e. [a-f], so this should not be escaped
    expect(coercePath('http://[:1zz::]')).toEqual('http://[:1zz::]')

    // This is either an invalid address, or the address is `:` and port `:1`
    expect(coercePath('http://::1')).toEqual('http\\://:\\:1')
  })

  test('escapes the colon before the port number immediately after the host', () => {
    expect(coercePath('localhost:8080')).toEqual('localhost\\:8080')
    expect(coercePath('http://127.0.0.1:8080')).toEqual(
      'http\\://127.0.0.1\\:8080',
    )
    expect(coercePath('https://example.com:1234')).toEqual(
      'https\\://example.com\\:1234',
    )
    expect(coercePath('localhost:8080/:5678')).toEqual('localhost\\:8080/:5678')
    expect(coercePath('https://example.com:8080/:5678')).toEqual(
      'https\\://example.com\\:8080/:5678',
    )
    expect(coercePath('//example.com:8080/:5678')).toEqual(
      '//example.com\\:8080/:5678',
    )
    expect(coercePath('//[::1]:8080/:5678')).toEqual('//[\\:\\:1]\\:8080/:5678')
    expect(coercePath('[::1]:8080/:360/:180')).toEqual(
      '[\\:\\:1]\\:8080/:360/:180',
    )
  })

  test('replaces wildcard with an unnnamed capturing group', () => {
    expect(coercePath('*')).toEqual('(.*)')
    expect(coercePath('**')).toEqual('(.*)')
    expect(coercePath('/us*')).toEqual('/us(.*)')
    expect(coercePath('/user/*')).toEqual('/user/(.*)')
    expect(coercePath('https://example.com/user/*')).toEqual(
      'https\\://example.com/user/(.*)',
    )
    expect(coercePath('https://example.com/us*')).toEqual(
      'https\\://example.com/us(.*)',
    )
  })

  test('preserves path parameter modifiers', () => {
    expect(coercePath(':name*')).toEqual(':name*')
    expect(coercePath('/foo/:name*')).toEqual('/foo/:name*')
    expect(coercePath('/foo/**:name*')).toEqual('/foo/(.*):name*')
    expect(coercePath('**/foo/*/:name*')).toEqual('(.*)/foo/(.*)/:name*')
    expect(coercePath('/foo/:first/bar/:second*/*')).toEqual(
      '/foo/:first/bar/:second*/(.*)',
    )
  })
})
