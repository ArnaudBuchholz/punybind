(function (factory) {
  // Stryker disable all : bootstrap code
  'use strict'
  // istanbul ignore else
  if (typeof module !== 'undefined' && module.exports) {
    factory(module.exports)
  } else {
    // eslint-disable-next-line no-eval
    factory((0, eval)('this'))
  }
}(function (exports) {
  // Stryker restore all
  'use strict'

  function bindTextNode (node, bindings) {
    const parsed = node.nodeValue.split(/{{((?:[^}]|}[^}])+)}}/)
    if (parsed.length > 1) {
      const source = `with (__context__) { return [${
        parsed.map((expr, idx) => idx % 2 ? expr : `\`${expr}\``).join(',')
      }].join('') }`
      // eslint-disable-next-line no-new-func
      const expression = new Function(`return function(__context__) { ${source} }`)()

      const parent = node.parentNode
      let value

      bindings.push(function refreshNodeValue (context, changes) {
        let newValue
        try {
          newValue = expression(context)
        } catch (e) {
          newValue = ''
        }
        if (newValue !== value) {
          const newChild = parent.ownerDocument.createTextNode(newValue)
          value = newValue
          changes.push(() => {
            parent.replaceChild(newChild, node)
            node = newChild
          })
        }
      })
    }
  }

  function parse (root) {
    const ELEMENT_NODE = 1
    const TEXT_NODE = 3
    const bindings = []

    function traverse (node) {
      if (node.nodeType === TEXT_NODE) {
        bindTextNode(node, bindings)
      }
      if (node.nodeType === ELEMENT_NODE) {
        Array.prototype.slice.call(node.childNodes).forEach(traverse)
      }
    }

    traverse(root)

    return bindings
  }

  exports.punybind = function (root) {
    const bindings = parse(root)

    function update (context) {
      const changes = []
      bindings.forEach(binding => binding(context, changes))
      changes.forEach(change => change())
    }

    update.bindingsCount = bindings.length

    return update
  }
}))
