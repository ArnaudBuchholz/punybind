'use strict'

describe('iterators {{for}}', () => {
  const invalidSyntaxes = [
    '<div {{for}}="" />',
    '<div {{for}}="item" />', // of expected
    '<div {{for}}="item in items" />', // of expected
    '<div {{for}}="(item, index) of items" />', // no parenthesis expected
    '<div {{for}}="item-, index of items" />', // invalid name
    '<div {{for}}="item, -index of items" />', // invalid name
    '<div {{for}}="item, index of" />', // missing expression
    '<div {{for}}="item, index of ()" />' // invalid expression
  ]

  invalidSyntaxes.forEach(invalidSyntax => {
    it(`ignores invalid syntax: ${invalidSyntax}`, async () => {
      const dom = new JSDOM(`<body>${invalidSyntax}</body>`)
      const update = await punybind(dom.window.document.body)
      expect(update.bindingsCount).toBe(0)
    })
  })

  const validSyntaxes = [
    '<div {{for}}=" item of items" />',
    '<div {{for}}="item,index of items" />',
    '<div {{for}}="item, index of items" />',
    '<div {{for}}="item , index of items" />',
    '<div {{for}}="item, index  of items" />',
    '<div {{for}}="item, index of  items" />'
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
    // Mutation may prevent the update completion
    let timeoutId
    await Promise.race([
      expect(update({
        get items () {
          return undefined
        }
      })).resolves,
      new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout')), 1000)
      })
    ])
    clearTimeout(timeoutId)
    expect(dom2json(dom.window.document.body)).toMatchObject({
      body: [
        { h1: ['before'] },
        { template: expect.anything() },
        { h1: ['after'] }
      ]
    })
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
