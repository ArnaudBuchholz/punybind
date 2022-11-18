'use strict'

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

module.exports = {
  dom2json
}
