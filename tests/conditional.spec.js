describe('conditional {{if}}', () => {
  const invalidSyntaxes = [
    '<div {{if}}="" />',
    '<div {{if}}="-" />', // syntax error
    '<div {{elseif}}="display" />' // no matching if
  ]

  invalidSyntaxes.forEach(invalidSyntax => {
    it(`ignores invalid syntax: ${invalidSyntax}`, async () => {
      const dom = new JSDOM(`<body>${invalidSyntax}</body>`)
      const update = await punybind(dom.window.document.body)
      expect(update.bindingsCount).toBe(0)
    })
  })

  describe('{{if}} only', () => {
    let dom
    let update

    beforeEach(async () => {
      dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{if}}="display">Hello World !</div>
  <h1>after</h1>
<body>`)
      update = await punybind(dom.window.document.body)
      expect(dom2json(dom.window.document.body)).toMatchObject({
        body: [
          { h1: ['before'] },
          { template: expect.anything() },
          { h1: ['after'] }
        ]
      })
    })

    it('displays on truthy value (true)', async () => {
      await update({
        display: true
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

    it('displays on truthy value (\'truthy\')', async () => {
      await update({
        display: 'truthy'
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

    it('hides on falsy value (false)', async () => {
      await update({
        display: false
      })
      expect(dom2json(dom.window.document.body)).toMatchObject({
        body: [
          { h1: ['before'] },
          { template: expect.anything() },
          { h1: ['after'] }
        ]
      })
    })

    it('hides on falsy value (\'\')', async () => {
      await update({
        display: ''
      })
      expect(dom2json(dom.window.document.body)).toMatchObject({
        body: [
          { h1: ['before'] },
          { template: expect.anything() },
          { h1: ['after'] }
        ]
      })
    })

    describe('switching', () => {
      it('true -> false : removes the instance', async () => {
        await update({
          display: true
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: ['Hello World !'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
        await update({
          display: false
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
      })

      it('false -> true : adds the instance', async () => {
        await update({
          display: false
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
        await update({
          display: true
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

      it('true -> true : creates only one instance', async () => {
        await update({
          display: 1
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: ['Hello World !'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
        await update({
          display: {}
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

      it('false -> false', async () => {
        await update({
          display: false
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
        await update({
          display: false
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { template: expect.anything() },
            { h1: ['after'] }
          ]
        })
      })
    })
  })

  describe('{{if}} / {{elseif}}', () => {
    const invalidSyntaxes = {
      '<div {{if}}="condition"></div><div {{elseif}}=""></div>': {
        body: [
          { template: expect.anything() },
          { div: [{ '@{{elseif}}': '' }] }
        ]
      },
      '<div {{if}}="condition"></div><div {{elseif}}="-"></div>': {
        body: [
          { template: expect.anything() },
          { div: [{ '@{{elseif}}': '-' }] }
        ]
      },
      '<div {{if}}="condition"></div><div {{elseif}}="-"></div><div {{elseif}}="true"></div>': {
        body: [
          { template: expect.anything() },
          { div: [{ '@{{elseif}}': '-' }] },
          { div: [{ '@{{elseif}}': 'true' }] } // Not parsed because of previous failure
        ]
      }
    }

    Object.keys(invalidSyntaxes).forEach(invalidSyntax => {
      const expected = invalidSyntaxes[invalidSyntax]

      it(`ignores invalid syntax: ${invalidSyntax}`, async () => {
        const dom = new JSDOM(`<body>${invalidSyntax}</body>`)
        await punybind(dom.window.document.body)
        expect(dom2json(dom.window.document.body)).toMatchObject(expected)
      })
    })

    let dom
    let update

    beforeEach(async () => {
      dom = new JSDOM(`<body>
  <h1>before</h1>
  <div {{if}}="hello">Hello World !</div>
  <div {{elseif}}="goodbye">Goodbye World !</div>
  <div {{elseif}}="goodbye">Should never be displayed</div>
  <div {{elseif}}="hello === false && goodbye === false">Not sure what to say</div>
  <h1>after</h1>
  <div {{elseif}}="true">Should be ignored (not in the sibling chain)</div>
<body>`)
      update = await punybind(dom.window.document.body)
      expect(dom2json(dom.window.document.body)).toMatchObject({
        body: [
          { h1: ['before'] },
          { template: expect.anything() },
          { template: expect.anything() },
          { template: expect.anything() },
          { template: expect.anything() },
          { h1: ['after'] },
          { div: [{ '@{{elseif}}': 'true' }, 'Should be ignored (not in the sibling chain)'] }
        ]
      })
    })

    it('generates only one binding', async () => {
      expect(update.bindingsCount).toBe(1)
    })

    describe('skipping condition remainder on first truthy condition', () => {
      it('processes only first condition', async () => {
        await update({
          hello: true
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { div: ['Hello World !'] },
            { template: expect.anything() },
            { template: expect.anything() },
            { template: expect.anything() },
            { template: expect.anything() },
            { h1: ['after'] },
            { div: [{ '@{{elseif}}': 'true' }, 'Should be ignored (not in the sibling chain)'] }
          ]
        })
      })

      it('processes only second condition', async () => {
        await update({
          hello: false,
          goodbye: true
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { template: expect.anything() },
            { div: ['Goodbye World !'] },
            { template: expect.anything() },
            { template: expect.anything() },
            { template: expect.anything() },
            { h1: ['after'] },
            { div: [{ '@{{elseif}}': 'true' }, 'Should be ignored (not in the sibling chain)'] }
          ]
        })
      })

      it('processes only third condition', async () => {
        await update({
          hello: false,
          goodbye: false
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { template: expect.anything() },
            { template: expect.anything() },
            { template: expect.anything() },
            { div: ['Not sure what to say'] },
            { template: expect.anything() },
            { h1: ['after'] },
            { div: [{ '@{{elseif}}': 'true' }, 'Should be ignored (not in the sibling chain)'] }
          ]
        })
      })

      it('renders none of the conditions', async () => {
        await update({
          hello: 0,
          goodbye: 0
        })
        expect(dom2json(dom.window.document.body)).toMatchObject({
          body: [
            { h1: ['before'] },
            { template: expect.anything() },
            { template: expect.anything() },
            { template: expect.anything() },
            { template: expect.anything() },
            { h1: ['after'] },
            { div: [{ '@{{elseif}}': 'true' }, 'Should be ignored (not in the sibling chain)'] }
          ]
        })
      })
    })
  })
})
