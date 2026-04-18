import {describe, it, expect} from 'vitest'
import {interpolate, findVariables, findMissingVariables, InterpolationError} from '../../src/lib/yaml/interpolation.js'

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
})
