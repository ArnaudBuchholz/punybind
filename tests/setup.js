'use strict'

const { JSDOM } = require('jsdom')
global.JSDOM = JSDOM
const { dom2json } = require('./dom2json.js')
global.dom2json = dom2json

global.safeWait = async promise => {
  let timeoutId
  await Promise.race([
    promise,
    new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout')), 1000)
    })
  ])
  clearTimeout(timeoutId)
}

beforeAll(async () => {
  // sanity check
  expect(typeof punybind).toBe('function')
  const dom = new JSDOM('<head><title>Title : {{ title }}</title></head>')
  await safeWait(punybind(dom.window.document.head))
})
