'use strict'

require('../punybind.js')
const { punybind } = global
const { JSDOM } = require('jsdom')
global.JSDOM = JSDOM
const { dom2json } = require('./dom2json.js')
global.dom2json = dom2json

beforeAll(async () => {
  // sanity check
  expect(typeof punybind).toBe('function')
  const dom = new JSDOM('<head><title>Title : {{ title }}</title></head>')
  let timeoutId
  await Promise.race([
    punybind(dom.window.document.head),
    new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout')), 1000)
    })
  ])
  clearTimeout(timeoutId)
})
