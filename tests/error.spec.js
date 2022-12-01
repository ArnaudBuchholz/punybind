'use strict'

describe('error', () => {
  it('ends properly in case of unexpected error', async () => {
    const dom = new JSDOM('<head><title>Title : {{ title }}</title></head>')
    const update = await punybind(dom.window.document.head)
    const title = dom.window.document.querySelector('title')
    title.replaceChild = () => { throw new Error() }
    await safeWait(expect(update({
      title: 'Nope !'
    })).rejects.toThrowError())
  })
})
