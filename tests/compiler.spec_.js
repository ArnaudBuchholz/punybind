'use strict'

const { punyexpr } = require('punyexpr')

describe('compiler', () => {
  const safepunybind = punybind.use(punyexpr)

  describe('basic', () => {
    let update
    let dom

    beforeEach(async () => {
      dom = new JSDOM('<head><title>Title : {{ title }}</title></head>')
      update = await safepunybind(dom.window.document.head)
    })

    it('exposes a bindingsCount property', () => {
      expect(update.bindingsCount).toBe(1)
    })

    it('evaluates and injects results', async () => {
      await update({
        title: 'Hello World !'
      })
      expect(dom.window.document.title).toBe('Title is Hello World !.')
    })
  })
})
