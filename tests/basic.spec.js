'use strict'

describe('bindingsCount property', () => {
  let update

  beforeEach(async () => {
    const dom = new JSDOM('<head><title>Title : {{ title }}</title></head>')
    update = await punybind(dom.window.document.head)
  })

  it('exposes a bindingsCount property', () => {
    expect(update.bindingsCount).toBe(1)
  })

  it('is read-only', () => {
    expect(() => {
      update.bindingsCount = 2
    }).toThrowError()
  })

  it('cannot be reconfigured', () => {
    expect(() => {
      Object.defineProperty(update, 'bindingsCount', {
        get () { return 2 }
      }).toThrowError()
    })
  })
})
