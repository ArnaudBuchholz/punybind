'use strict'

describe('version', () => {
  it('exposes the version information', () => {
    expect(punybind.version).toBe(global.expectedVersion)
  })

  it('is readonly', () => {
    expect(() => { punybind.version = 'test' }).toThrowError()
  })
})
