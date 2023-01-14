'use strict'

describe('template tags', () => {
  it('does not alter existing templates', async () => {
    const dom = new JSDOM('<body><template>{{ binding }}</template></body>')
    // template content can be enumerated with DOM childNodes property, hence
    const update = await punybind(dom.window.document.body)
    expect(update.bindingsCount === 0)
  })
})
