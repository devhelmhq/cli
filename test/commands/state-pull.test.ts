import {describe, it, expect} from 'vitest'
import {pullsMonitor} from '../../src/commands/state/pull.js'

describe('state pull monitor scope', () => {
  const mine = {owner: {type: 'GIT', project: 'acme/web'}, managedBy: 'GIT'} as never
  const theirs = {owner: {type: 'GIT', project: 'acme/api'}, managedBy: 'GIT'} as never
  const dashboard = {managedBy: 'DASHBOARD'} as never

  it('pulls only this project\'s monitors when project: is set', () => {
    expect(pullsMonitor(mine, 'acme/web')).toBe(true)
    expect(pullsMonitor(theirs, 'acme/web')).toBe(false)
    expect(pullsMonitor(dashboard, 'acme/web')).toBe(false)
  })

  it('pulls every monitor when project: is absent', () => {
    expect(pullsMonitor(mine, undefined)).toBe(true)
    expect(pullsMonitor(theirs, undefined)).toBe(true)
    expect(pullsMonitor(dashboard, undefined)).toBe(true)
  })
})
