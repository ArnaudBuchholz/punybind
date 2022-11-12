const { punybind } = require('./index.js')
const { JSDOM } = require('jsdom')

describe('punybind', () => {
  it('imports punybind', () => {
    expect(typeof punybind).toBe('function')
  })

  describe('binding function', () => {
    it('returns a function', () => {
      const dom = new JSDOM('<head><title>Title : {{ title }}</title></head>')
      const update = punybind(dom.window.document.head)
      expect(typeof update).toBe('function')
    })

    describe('node binding', () => {
      const invalidSyntaxes = [
        'Title',
        'Title : {{ title',
        'Title : {{ title }',
        'Title : { { title }}',
        'Title : {{ title } }',
        'Title : {{}}title}}'
      ]

      invalidSyntaxes.forEach(invalidSyntax => {
        it(`ignores invalid syntax: ${invalidSyntax}`, async () => {
          const dom = new JSDOM(`<head><title>${invalidSyntax}</title></head>`)
          const update = punybind(dom.window.document.head)
          expect(update.bindingsCount).toBe(0)
          await update({
            title: 'Hello World !'
          })
          expect(dom.window.document.title).toBe(invalidSyntax)
        })
      })

      it('mixes static and dynamic content', async () => {
        const dom = new JSDOM('<head><title>Title is {{ title }}.</title></head>')
        const update = punybind(dom.window.document.head)
        await update({
          title: 'Hello World !'
        })
        expect(dom.window.document.title).toBe('Title is Hello World !.')
      })

      it('empties the content if an error occurs', async () => {
        const dom = new JSDOM('<head><title>Title : {{ error }}</title></head>')
        const update = punybind(dom.window.document.head)
        await update({
          get error () {
            throw new Error()
          }
        })
        expect(dom.window.document.title).toBe('')
      })

      it('changes the node only when the value changes', async () => {
        const dom = new JSDOM('<head><title id="title">Title : {{ title }}</title></head>')
        let changes = 0
        const observer = new dom.window.MutationObserver(() => ++changes)
        observer.observe(dom.window.document.head, {
          attributes: true,
          childList: true,
          subtree: true
        })
        const update = punybind(dom.window.document.head)
        await update({
          title: 'Hello World !'
        })
        expect(changes).toBe(1)
        await update({
          title: 'Hello World !'
        })
        expect(changes).toBe(1)
      })

      it('securely injects the content', async () => {
        const dom = new JSDOM('<body>{{ inject }}</body>')
        const update = punybind(dom.window.document.body)
        update({
          inject: '<script>alert(0)</alert>'
        })
        expect(dom.window.document.body.innerHTML).toBe('&lt;script&gt;alert(0)&lt;/alert&gt;')
      })
    })
  })
})
