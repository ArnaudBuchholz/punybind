'use strict'

describe('text', () => {
  describe('node text', () => {
    const invalidSyntaxes = [
      'Title',
      'Title : {{ title',
      'Title : {{ title }',
      'Title : { { title }}',
      'Title : {{ title } }',
      'Title : {{}}title}}',
      'Title : {{ () }}'
    ]

    invalidSyntaxes.forEach(invalidSyntax => {
      it(`ignores invalid syntax: ${invalidSyntax}`, async () => {
        const dom = new JSDOM(`<head><title>${invalidSyntax}</title></head>`)
        const update = await punybind(dom.window.document.head)
        expect(update.bindingsCount).toBe(0)
        await update({
          title: 'Hello World !'
        })
        expect(dom.window.document.title).toBe(invalidSyntax)
      })
    })

    it('mixes static and dynamic content', async () => {
      const dom = new JSDOM('<head><title>Title is {{ title }}.</title></head>')
      const update = await punybind(dom.window.document.head)
      await update({
        title: 'Hello World !'
      })
      expect(dom.window.document.title).toBe('Title is Hello World !.')
    })

    it('properly escapes static strings', async () => {
      const dom = new JSDOM('<head><title>\'\\{{ title }}\\\'</title></head>')
      const update = await punybind(dom.window.document.head)
      await update({
        title: '\\\'\\'
      })
      expect(dom.window.document.title).toBe('\'\\\\\'\\\\\'')
    })

    it('empties the content if an error occurs', async () => {
      const dom = new JSDOM('<head><title>Title : {{ error }}</title></head>')
      const update = await punybind(dom.window.document.head)
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
      const update = await punybind(dom.window.document.head)
      expect(changes).toBe(1) // Initial update
      await update({
        title: 'Hello World !'
      })
      expect(changes).toBe(2)
      await update({
        title: 'Hello World !'
      })
      expect(changes).toBe(2)
    })

    it('securely injects the content', async () => {
      const dom = new JSDOM('<body>{{ inject }}</body>')
      const update = await punybind(dom.window.document.body)
      await update({
        inject: '<script>alert(0)</alert>'
      })
      expect(dom.window.document.body.innerHTML).toBe('&lt;script&gt;alert(0)&lt;/alert&gt;')
    })
  })

  describe('attribute value', () => {
    it('mixes static and dynamic content', async () => {
      const dom = new JSDOM('<body style="background-color: {{ color }};" />')
      const update = await punybind(dom.window.document.body)
      await update({
        color: 'red'
      })
      expect(dom.window.document.body.getAttribute('style')).toBe('background-color: red;')
    })

    it('empties the content if an error occurs', async () => {
      const dom = new JSDOM('<body style="background-color: {{ error }};" />')
      const update = await punybind(dom.window.document.body)
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
      const update = await punybind(dom.window.document.body)
      expect(changes).toBe(1) // Initial update
      await update({
        color: 'red'
      })
      expect(changes).toBe(2)
      await update({
        color: 'red'
      })
      expect(changes).toBe(2)
    })
  })
})
