'use strict'

describe('template tags', () => {
  it('does not alter existing templates', async () => {
    const dom = new JSDOM('<body><template>{{ binding }}</template></body>')
    const update = await punybind(dom.window.document.body)
    expect(update.bindingsCount === 0)
  })
})
