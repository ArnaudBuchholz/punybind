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

    describe('bindingsCount', () => {
      let update

      beforeAll(() => {
        const dom = new JSDOM('<head><title>Title : {{ title }}</title></head>')
        update = punybind(dom.window.document.head)
      })

      it('exposes a bindingsCount', () => {
        expect(update.bindingsCount).toBe(1)
      })

      it('is read-only', () => {
        update.bindingsCount = 2
        expect(update.bindingsCount).toBe(1)
      })

      it('cannot be reconfigured', () => {
        expect(() => {
          Object.defineProperty(update, 'bindingsCount', {
            get () { return 2 }
          }).toThrowError()
        })
      })
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
        await update({
          inject: '<script>alert(0)</alert>'
        })
        expect(dom.window.document.body.innerHTML).toBe('&lt;script&gt;alert(0)&lt;/alert&gt;')
      })
    })

    describe('attribute binding', () => {
      it('mixes static and dynamic content', async () => {
        const dom = new JSDOM('<body style="background-color: {{ color }};" />')
        const update = punybind(dom.window.document.body)
        await update({
          color: 'red'
        })
        expect(dom.window.document.body.getAttribute('style')).toBe('background-color: red;')
      })

      it('empties the content if an error occurs', async () => {
        const dom = new JSDOM('<body style="background-color: {{ error }};" />')
        const update = punybind(dom.window.document.body)
        await update({
          get error () {
            throw new Error()
          }
        })
        expect(dom.window.document.body.getAttribute('style')).toBe('')
      })

      it('changes the attribute only when the value changes', async () => {
        const dom = new JSDOM('<body style="background-color: {{ color }};" />')
        let changes = 0
        const observer = new dom.window.MutationObserver(() => ++changes)
        observer.observe(dom.window.document.body, {
          attributes: true,
          childList: true,
          subtree: true
        })
        const update = punybind(dom.window.document.body)
        await update({
          color: 'red'
        })
        expect(changes).toBe(1)
        await update({
          color: 'red'
        })
        expect(changes).toBe(1)
      })
    })

    describe('iterators', () => {
      const invalidSyntaxes = [
        '<div {{for}}="">',
        '<div {{for}}="item">', // of expected
        '<div {{for}}="item in items">', // of expected
        '<div {{for}}="(item, index) of items">', // no parenthesis expected
        '<div {{for}}="item, index of">' // missing expression
      ]

      invalidSyntaxes.forEach(invalidSyntax => {
        it(`ignores invalid syntax: ${invalidSyntax}`, async () => {
          const dom = new JSDOM(`<body>${invalidSyntax}</body>`)
          const update = punybind(dom.window.document.head)
          expect(update.bindingsCount).toBe(0)
        })
      })

      it('enables list rendering', async () => {
        const dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{for}}="item, index of items">{{ item.text + ' ' + index }}</div>
  <h1>after</h1>
<body>`)
        const update = punybind(dom.window.document.body)
        await update({
          items: [{
            text: 'first'
          }, {
            text: 'second'
          }]
        })
        expect(dom.window.document.body.innerHTML).toBe(`
  <h1>before</h1>
  <div>first 0</div><div>second 1</div><template></template>
  <h1>after</h1>
`)
      })
    })
  })
})
