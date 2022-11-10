const { punybind } = require('./index.js')
const { JSDOM } = require('jsdom')

describe('punybind', () => {
  it('imports punybind', () => {
    expect(typeof punybind).toBe('function')
  })

  describe('binding function', () => {
    const dom = new JSDOM(`<!DOCTYPE html>
<html>
  <head>
    <title>Title : {{ title }}</title>
  </head>
  <body>
  </body>
</html>`)

    it('returns a function', () => {
      const update = punybind(dom.window.document.head)
      expect(typeof update).toBe('function')
    })

    it('updates the HTML when calling the returned function', async () => {
      const update = punybind(dom.window.document.head)
      await update({
        title: 'Hello World !'
      })
      expect(dom.window.document.title).toBe('Title : Hello World !')
    })
  })
})
