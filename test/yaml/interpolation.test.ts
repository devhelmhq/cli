import {describe, it, expect} from 'vitest'
import {interpolate, interpolateObject, findVariables, findVariablesInObject, findMissingVariables, findMissingVariablesInObject, InterpolationError} from '../../src/lib/yaml/interpolation.js'

describe('interpolation', () => {
  describe('interpolate', () => {
    it('replaces ${VAR} with env value', () => {
      const result = interpolate('url: ${API_URL}', {API_URL: 'https://api.com'})
      expect(result).toBe('url: https://api.com')
    })

    it('replaces multiple vars in one string', () => {
      const result = interpolate('${HOST}:${PORT}', {HOST: 'localhost', PORT: '3000'})
      expect(result).toBe('localhost:3000')
    })

    it('uses fallback from ${VAR:-default}', () => {
      const result = interpolate('url: ${API_URL:-https://default.com}', {})
      expect(result).toBe('url: https://default.com')
    })

    it('prefers env value over fallback', () => {
      const result = interpolate('${VAR:-fallback}', {VAR: 'actual'})
      expect(result).toBe('actual')
    })

    it('uses fallback for empty string value', () => {
      const result = interpolate('${VAR:-fallback}', {VAR: ''})
      expect(result).toBe('fallback')
    })

    it('throws InterpolationError for missing required var', () => {
      expect(() => interpolate('${MISSING}', {})).toThrow(InterpolationError)
    })

    it('treats empty-string env value as missing for required vars (POSIX :- semantics)', () => {
      // CI systems often export missing secrets as empty strings; we surface
      // that as a hard error so a misconfigured deploy fails loudly rather
      // than silently producing empty URLs/tokens.
      expect(() => interpolate('${API_TOKEN}', {API_TOKEN: ''})).toThrow(InterpolationError)
      try {
        interpolate('${API_TOKEN}', {API_TOKEN: ''})
      } catch (err) {
        expect((err as InterpolationError).message).toMatch(/empty string/)
        expect((err as InterpolationError).message).toMatch(/\$\{API_TOKEN:-\}/)
      }
    })

    it('${VAR:-} explicitly allows an empty value', () => {
      expect(interpolate('${MAYBE_EMPTY:-}', {})).toBe('')
      expect(interpolate('${MAYBE_EMPTY:-}', {MAYBE_EMPTY: ''})).toBe('')
      expect(interpolate('${MAYBE_EMPTY:-}', {MAYBE_EMPTY: 'set'})).toBe('set')
    })

    it('throws with helpful message', () => {
      try {
        interpolate('${SECRET_KEY}', {})
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(InterpolationError)
        expect((err as InterpolationError).variable).toBe('SECRET_KEY')
        expect((err as InterpolationError).message).toContain('SECRET_KEY')
      }
    })

    it('leaves strings without ${} unchanged', () => {
      const result = interpolate('plain text here', {})
      expect(result).toBe('plain text here')
    })

    it('handles empty fallback', () => {
      const result = interpolate('pre-${VAR:-}-post', {})
      expect(result).toBe('pre--post')
    })

    it('handles fallback with special characters', () => {
      const result = interpolate('${VAR:-https://hooks.slack.com/T00/B00/x}', {})
      expect(result).toBe('https://hooks.slack.com/T00/B00/x')
    })

    it('handles nested-like braces (outer only)', () => {
      const result = interpolate('${OUTER}', {OUTER: 'value'})
      expect(result).toBe('value')
    })

    it('handles unicode variable names', () => {
      const result = interpolate('${MY_VAR_123}', {MY_VAR_123: 'ok'})
      expect(result).toBe('ok')
    })

    it('handles multiple same var occurrences', () => {
      const result = interpolate('${A}-${A}', {A: 'x'})
      expect(result).toBe('x-x')
    })

    it('handles whitespace in var name (trimmed)', () => {
      const result = interpolate('${ MY_VAR }', {MY_VAR: 'trimmed'})
      expect(result).toBe('trimmed')
    })

    it('handles multiline input', () => {
      const input = 'line1: ${A}\nline2: ${B:-default}'
      const result = interpolate(input, {A: 'first'})
      expect(result).toBe('line1: first\nline2: default')
    })

    it('escapes $$ to a literal $', () => {
      const result = interpolate('price: $$100', {})
      expect(result).toBe('price: $100')
    })

    it('$$ before a ${VAR} is escaped, not interpolation', () => {
      const result = interpolate('$${VAR}', {VAR: 'unused'})
      expect(result).toBe('${VAR}')
    })

    it('supports mixing $$ escapes and ${VAR} interpolation', () => {
      const result = interpolate('$$price=${VAR}', {VAR: '5'})
      expect(result).toBe('$price=5')
    })
  })

  describe('findVariables', () => {
    it('finds all variable references', () => {
      const vars = findVariables('${A} and ${B:-default} and ${C}')
      expect(vars).toEqual(['A', 'B', 'C'])
    })

    it('returns empty for no vars', () => {
      expect(findVariables('no vars here')).toEqual([])
    })

    it('finds duplicates', () => {
      const vars = findVariables('${A} ${A}')
      expect(vars).toEqual(['A', 'A'])
    })

    it('ignores $$ escapes', () => {
      expect(findVariables('$${A} ${B}')).toEqual(['B'])
    })
  })

  describe('findMissingVariables', () => {
    it('returns only missing required vars', () => {
      const missing = findMissingVariables('${SET} ${MISSING} ${DEFAULT:-ok}', {SET: 'yes'})
      expect(missing).toEqual(['MISSING'])
    })

    it('returns empty when all vars are set', () => {
      const missing = findMissingVariables('${A} ${B:-x}', {A: 'val'})
      expect(missing).toEqual([])
    })

    it('flags empty string as missing', () => {
      const missing = findMissingVariables('${EMPTY}', {EMPTY: ''})
      expect(missing).toEqual(['EMPTY'])
    })

    it('returns duplicate occurrences of the same missing var', () => {
      const missing = findMissingVariables('${X} ${X}', {})
      expect(missing).toEqual(['X', 'X'])
    })

    it('ignores vars with defaults', () => {
      const missing = findMissingVariables('${A:-x} ${B:-y}', {})
      expect(missing).toEqual([])
    })

    it('returns multiple distinct missing vars', () => {
      const missing = findMissingVariables('${A} ${B} ${C}', {})
      expect(missing).toEqual(['A', 'B', 'C'])
    })
  })

  describe('interpolateObject (post-parse, injection-safe)', () => {
    it('interpolates string values in a flat object', () => {
      const result = interpolateObject({url: '${API_URL}', name: 'test'}, {API_URL: 'https://api.com'})
      expect(result).toEqual({url: 'https://api.com', name: 'test'})
    })

    it('interpolates nested objects', () => {
      const result = interpolateObject(
        {config: {url: '${URL}', headers: {auth: '${TOKEN}'}}},
        {URL: 'https://x', TOKEN: 'secret'},
      )
      expect(result).toEqual({config: {url: 'https://x', headers: {auth: 'secret'}}})
    })

    it('interpolates inside arrays', () => {
      const result = interpolateObject(
        {regions: ['${R1}', '${R2}']},
        {R1: 'us-east', R2: 'eu-west'},
      )
      expect(result).toEqual({regions: ['us-east', 'eu-west']})
    })

    it('leaves non-string values unchanged', () => {
      const result = interpolateObject(
        {name: '${N}', count: 42, enabled: true, data: null},
        {N: 'test'},
      )
      expect(result).toEqual({name: 'test', count: 42, enabled: true, data: null})
    })

    it('YAML metacharacters in env values cannot alter structure', () => {
      const result = interpolateObject(
        {url: '${EVIL}'},
        {EVIL: 'value: injected\nnewkey: hacked'},
      )
      expect(result).toEqual({url: 'value: injected\nnewkey: hacked'})
      expect(Object.keys(result as Record<string, unknown>)).toEqual(['url'])
    })

    it('colons in env values are treated as literal text', () => {
      const result = interpolateObject(
        {url: '${URL}'},
        {URL: 'host:port:extra'},
      )
      expect(result).toEqual({url: 'host:port:extra'})
    })

    it('quotes in env values are treated as literal text', () => {
      const result = interpolateObject(
        {value: '${Q}'},
        {Q: `it's a "test" with 'quotes'`},
      )
      expect(result).toEqual({value: `it's a "test" with 'quotes'`})
    })

    it('nested ${...} in env values are treated as literal text (no re-interpolation)', () => {
      const result = interpolateObject(
        {token: '${OUTER}'},
        {OUTER: '${INNER}', INNER: 'should-not-appear'},
      )
      expect(result).toEqual({token: '${INNER}'})
    })

    it('throws InterpolationError for missing required var in nested object', () => {
      expect(() => interpolateObject({deep: {key: '${MISSING}'}}, {})).toThrow(InterpolationError)
    })

    it('uses fallback for missing vars in objects', () => {
      const result = interpolateObject({url: '${URL:-https://default.com}'}, {})
      expect(result).toEqual({url: 'https://default.com'})
    })

    it('handles $$ escape in object values', () => {
      const result = interpolateObject({price: '$$100'}, {})
      expect(result).toEqual({price: '$100'})
    })
  })

  describe('findVariablesInObject', () => {
    it('finds variables in nested objects and arrays', () => {
      const vars = findVariablesInObject({
        name: '${A}',
        config: {url: '${B:-x}'},
        regions: ['${C}'],
      })
      expect(vars).toEqual(['A', 'B', 'C'])
    })

    it('returns empty for objects without vars', () => {
      expect(findVariablesInObject({name: 'plain', count: 42})).toEqual([])
    })
  })

  describe('findMissingVariablesInObject', () => {
    it('finds missing vars across nested structure', () => {
      const missing = findMissingVariablesInObject(
        {url: '${URL}', config: {token: '${TOKEN}', port: '${PORT:-8080}'}},
        {URL: 'https://x'},
      )
      expect(missing).toEqual(['TOKEN'])
    })

    it('returns empty when all vars are set or have defaults', () => {
      const missing = findMissingVariablesInObject(
        {a: '${X}', b: '${Y:-default}'},
        {X: 'val'},
      )
      expect(missing).toEqual([])
    })
  })
})
