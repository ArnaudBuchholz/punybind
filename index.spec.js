'use strict'

const { punybind } = require('./index.js')
const { JSDOM } = require('jsdom')

const ELEMENT_NODE = 1
const TEXT_NODE = 3

function dom2json (node) {
  if (node.nodeType === TEXT_NODE) {
    return node.nodeValue.trim()
  }
  if (node.nodeType === ELEMENT_NODE) {
    const content = Array.prototype.slice.call(node.childNodes)
      .map(dom2json)
      .filter(json => !!json)
    if (node.attributes.length) {
      const attributes = {}
      for (const attr of node.attributes) {
        attributes[`@${attr.name}`] = attr.value
      }
      content.unshift(attributes)
    }
    return {
      [node.nodeName.toLowerCase()]: content
    }
  }
}

describe('punybind', () => {
  it('imports punybind', () => {
    expect(typeof punybind).toBe('function')
  })

  describe('binding function', () => {
    it('returns a function', async () => {
      const dom = new JSDOM('<head><title>Title : {{ title }}</title></head>')
      const update = await punybind(dom.window.document.head)
      expect(typeof update).toBe('function')
    })

    describe('bindingsCount property', () => {
      let update

      beforeAll(async () => {
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

    describe('node binding', () => {
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

    describe('attribute binding', () => {
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

    describe('iterators', () => {
      const invalidSyntaxes = [
        '<div {{for}}="">',
        '<div {{for}}="item">', // of expected
        '<div {{for}}="item in items">', // of expected
        '<div {{for}}="(item, index) of items">', // no parenthesis expected
        '<div {{for}}="item-, index of items">', // invalid name
        '<div {{for}}="item, -index of items">', // invalid name
        '<div {{for}}="item, index of">', // missing expression
        '<div {{for}}="item, index of ()">' // invalid expression
      ]

      invalidSyntaxes.forEach(invalidSyntax => {
        it(`ignores invalid syntax: ${invalidSyntax}`, async () => {
          const dom = new JSDOM(`<body>${invalidSyntax}</body>`)
          const update = await punybind(dom.window.document.body)
          expect(update.bindingsCount).toBe(0)
        })
      })

      const validSyntaxes = [
        '<div {{for}}=" item of items">',
        '<div {{for}}="item,index of items">',
        '<div {{for}}="item, index of items">',
        '<div {{for}}="item , index of items">',
        '<div {{for}}="item, index  of items">',
        '<div {{for}}="item, index of  items">'
      ]

      validSyntaxes.forEach(validSyntax => {
        it(`accepts valid syntax: ${validSyntax}`, async () => {
          const dom = new JSDOM(`<body>${validSyntax}</body>`)
          const update = await punybind(dom.window.document.body)
          expect(update.bindingsCount).toBe(1)
        })
      })

      it('enables list rendering', async () => {
        const dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{for}}="item, index of items">{{ item.text + ' ' + index }}</div>
  <h1>after</h1>
<body>`)
        const update = await punybind(dom.window.document.body)
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

      it('empties the content if an error occurs (absorbed)', async () => {
        const dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{for}}="item of items">{{ item.text + ' ' + index }}</div>
  <h1>after</h1>
<body>`)
        const update = await punybind(dom.window.document.body)
        await update({
          get items () {
            throw new Error()
          }
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
      })

      it('empties the content if an error occurs (explicit)', async () => {
        const dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{for}}="item of items">{{ item.text + ' ' + index }}</div>
  <h1>after</h1>
<body>`)
        const update = await punybind(dom.window.document.body)
        await expect(update({
          get items () {
            return undefined
          }
        })).rejects.toThrowError()
      })

      it('dynamically updates the list', async () => {
        const dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{for}}="item of items">{{ item.text }}</div>
  <h1>after</h1>
<body>`)
        const update = await punybind(dom.window.document.body)
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
            { div: ['first'] },
            { div: ['second'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
        const div = dom.window.document.body.querySelector('div')
        div.id = 'flagged'
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: [{ '@id': 'flagged' }, 'first'] },
            { div: ['second'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
        const insertBefore = jest.spyOn(dom.window.document.body, 'insertBefore')
        await update({
          items: [{
            text: 'third'
          }, {
            text: 'fourth'
          }]
        })
        expect(insertBefore).not.toHaveBeenCalled()
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: [{ '@id': 'flagged' }, 'third'] },
            { div: ['fourth'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
      })

      it('dynamically shrinks the list', async () => {
        const dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{for}}="item, index of items">{{ item.text + ' ' + index }}</div>
  <h1>after</h1>
<body>`)
        const update = await punybind(dom.window.document.body)
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
        const div = dom.window.document.body.querySelector('div')
        div.id = 'flagged'
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: [{ '@id': 'flagged' }, 'first 0'] },
            { div: ['second 1'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
        await update({
          items: [{
            text: 'third'
          }]
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: [{ '@id': 'flagged' }, 'third 0'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
      })

      it('dynamically grows the list', async () => {
        const dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{for}}="item, index of items">{{ item.text + ' ' + index }}</div>
  <h1>after</h1>
<body>`)
        const update = await punybind(dom.window.document.body)
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
        const div = dom.window.document.body.querySelector('div')
        div.id = 'flagged'
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: [{ '@id': 'flagged' }, 'first 0'] },
            { div: ['second 1'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
        await update({
          items: [{
            text: 'first'
          }, {
            text: 'second'
          }, {
            text: 'third'
          }]
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: [{ '@id': 'flagged' }, 'first 0'] },
            { div: ['second 1'] },
            { div: ['third 2'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
      })
    })
  })

  describe('reactive model', () => {
    let dom
    let update
    let model

    beforeEach(async () => {
      dom = new JSDOM(`<body>
  <h1>{{ title }}</h1>
  <ul>
    <li
      {{for}}="item of items"
      class="todo{{ item.done ? ' done' : '' }}"
    >{{ item.text }}</li>
  </ul>
</body>`)
      update = await punybind(dom.window.document.body, {
        title: 'Hello World !',
        items: [{
          done: false,
          text: 'Forget about heavy frameworks'
        }, {
          done: true,
          text: 'Adopt punybind'
        }]
      })
      model = update.model
    })

    describe('model property', () => {
      it('exposes a model property', () => {
        expect(update.model).not.toBeUndefined()
        expect(update.model.title).toBe('Hello World !')
      })

      it('is read-only', () => {
        expect(() => {
          update.model = 0
        }).toThrowError()
      })

      it('cannot be reconfigured', () => {
        expect(() => {
          Object.defineProperty(update, 'model', {
            get () { return 0 }
          }).toThrowError()
        })
      })
    })

    describe('done property', () => {
      it('exposes a done property', () => {
        expect(update.done).not.toBeUndefined()
        expect(typeof update.done).toBe('function')
      })

      it('is read-only', () => {
        expect(() => {
          update.done = 0
        }).toThrowError()
      })

      it('cannot be reconfigured', () => {
        expect(() => {
          Object.defineProperty(update, 'done', {
            get () { return 0 }
          }).toThrowError()
        })
      })
    })

    describe('reactive behavior', () => {
      let changes

      beforeEach(() => {
        changes = 0
        const observer = new dom.window.MutationObserver(() => ++changes)
        observer.observe(dom.window.document.body, {
          attributes: true,
          childList: true,
          subtree: true
        })
      })

      it('triggers an initial update', () => {
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['Hello World !'] },
            {
              ul: [
                { li: [{ '@class': 'todo' }, 'Forget about heavy frameworks'] },
                { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                { template: expect.anything() }
              ]
            }
          ]
        })
      })

      it('updates when changing a property', async () => {
        expect(changes).toBe(0)
        model.title = 'Test'
        await update.done()
        expect(changes).toBe(1)
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['Test'] },
            {
              ul: [
                { li: [{ '@class': 'todo' }, 'Forget about heavy frameworks'] },
                { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                { template: expect.anything() }
              ]
            }
          ]
        })
      })

      it('debounces property changes', async () => {
        expect(changes).toBe(0)
        model.title = 'Test'
        const firstDone = update.done()
        model.title = 'Test 2'
        const secondDone = update.done()
        expect(firstDone).toBe(secondDone)
        await update.done()
        expect(changes).toBe(1)
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['Test 2'] },
            {
              ul: [
                { li: [{ '@class': 'todo' }, 'Forget about heavy frameworks'] },
                { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                { template: expect.anything() }
              ]
            }
          ]
        })
      })

      it('does not refresh if property value does not change', async () => {
        expect(changes).toBe(0)
        const previousDone = update.done()
        model.title = 'Hello World !'
        await update.done()
        expect(changes).toBe(0)
        expect(update.done()).toBe(previousDone)
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['Hello World !'] },
            {
              ul: [
                { li: [{ '@class': 'todo' }, 'Forget about heavy frameworks'] },
                { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                { template: expect.anything() }
              ]
            }
          ]
        })
      })

      describe('array', () => {
        it('detects item change', async () => {
          model.items[0].done = true
          await update.done()
          expect(dom2json(dom.window.document.body)).toMatchObject({
            body: [
              { h1: ['Hello World !'] },
              {
                ul: [
                  { li: [{ '@class': 'todo done' }, 'Forget about heavy frameworks'] },
                  { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                  { template: expect.anything() }
                ]
              }
            ]
          })
        })

        it('detects list change (adding)', async () => {
          model.items[2] = {
            done: true,
            text: 'It works !'
          }
          await update.done()
          expect(dom2json(dom.window.document.body)).toMatchObject({
            body: [
              { h1: ['Hello World !'] },
              {
                ul: [
                  { li: [{ '@class': 'todo' }, 'Forget about heavy frameworks'] },
                  { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                  { li: [{ '@class': 'todo done' }, 'It works !'] },
                  { template: expect.anything() }
                ]
              }
            ]
          })
        })

        it('detects list change (push)', async () => {
          model.items.push({
            done: true,
            text: 'It works !'
          })
          await update.done()
          expect(dom2json(dom.window.document.body)).toMatchObject({
            body: [
              { h1: ['Hello World !'] },
              {
                ul: [
                  { li: [{ '@class': 'todo' }, 'Forget about heavy frameworks'] },
                  { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                  { li: [{ '@class': 'todo done' }, 'It works !'] },
                  { template: expect.anything() }
                ]
              }
            ]
          })
        })

        it('detects list change (unshift)', async () => {
          model.items.unshift({
            done: true,
            text: 'It works !'
          })
          await update.done()
          expect(dom2json(dom.window.document.body)).toMatchObject({
            body: [
              { h1: ['Hello World !'] },
              {
                ul: [
                  { li: [{ '@class': 'todo done' }, 'It works !'] },
                  { li: [{ '@class': 'todo' }, 'Forget about heavy frameworks'] },
                  { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                  { template: expect.anything() }
                ]
              }
            ]
          })
        })

        it('detects list change (pop)', async () => {
          model.items.pop()
          await update.done()
          expect(dom2json(dom.window.document.body)).toMatchObject({
            body: [
              { h1: ['Hello World !'] },
              {
                ul: [
                  { li: [{ '@class': 'todo' }, 'Forget about heavy frameworks'] },
                  { template: expect.anything() }
                ]
              }
            ]
          })
        })

        it('detects list change (shift)', async () => {
          model.items.shift()
          await update.done()
          expect(dom2json(dom.window.document.body)).toMatchObject({
            body: [
              { h1: ['Hello World !'] },
              {
                ul: [
                  { li: [{ '@class': 'todo done' }, 'Adopt punybind'] },
                  { template: expect.anything() }
                ]
              }
            ]
          })
        })
      })
    })
  })
})
