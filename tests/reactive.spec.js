'use strict'

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
