'use strict'

const { punyexpr } = require('punyexpr')

describe('compiler', () => {
  const safepunybind = punybind.use({
    compiler: punyexpr
  })

  describe('text node', () => {
    let update
    let dom

    beforeEach(async () => {
      dom = new JSDOM('<head><title>Title is {{ title }}.</title></head>')
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

  describe('conditional', () => {
    let update
    let dom

    beforeEach(async () => {
      dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{if}}="hello">Hello World !</div>
  <div {{elseif}}="goodbye">Goodbye World !</div>
  <div {{else}}>Not sure what to say !</div>
  <h1>after</h1>
<body>`)
      update = await safepunybind(dom.window.document.body)
    })

    it('generates only one binding', async () => {
      expect(update.bindingsCount).toBe(1)
    })

    it('shows if on truthy condition', async () => {
      await update({
        hello: true
      })
      expect(dom2json(dom.window.document.body)).toMatchObject({
        body: [
          { h1: ['before'] },
          { div: ['Hello World !'] },
          { template: expect.anything() },
          { h1: ['after'] }
        ]
      })
    })

    it('shows elseif on truthy condition', async () => {
      await update({
        goodbye: true
      })
      expect(dom2json(dom.window.document.body)).toMatchObject({
        body: [
          { h1: ['before'] },
          { div: ['Goodbye World !'] },
          { template: expect.anything() },
          { h1: ['after'] }
        ]
      })
    })

    it('shows else otherwise', async () => {
      await update({
      })
      expect(dom2json(dom.window.document.body)).toMatchObject({
        body: [
          { h1: ['before'] },
          { div: ['Not sure what to say !'] },
          { template: expect.anything() },
          { h1: ['after'] }
        ]
      })
    })
  })

  describe('iterator', () => {
    it('enables list rendering', async () => {
      const dom = new JSDOM(`<body>
    <h1>before</h1>
    <div {{for}}="item, index of items">{{ item.text + ' ' + index }}</div>
    <h1>after</h1>
  <body>`)
      const update = await safepunybind(dom.window.document.body)
      await update({
        items: [{
          text: 'first'
        }, {
          text: 'second'
        }]
      })
      expect(dom2json(dom.window.document.body)).toMatchObject({
        body: [
          { h1: ['before'] },
          { div: ['first 0'] },
          { div: ['second 1'] },
          { template: expect.anything() },
          { h1: ['after'] }
        ]
      })
    })
  })
})
