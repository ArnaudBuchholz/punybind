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

  function buildExpression (value) {
    const parsed = value.split(/{{((?:[^}]|}[^}])+)}}/)
    if (parsed.length > 1) {
      const source = `with (__context__) try { return [${
        parsed.map((expr, idx) => idx % 2 ? expr : `\`${expr}\``).join(',')
      }].join('') } catch (e) { return '' }`
      // eslint-disable-next-line no-new-func
      return new Function(`return function(__context__) { ${source} }`)()
    }
  }

  function bindTextNode (node, bindings) {
    const expression = buildExpression(node.nodeValue)
    if (expression) {
      const parent = node.parentNode
      let value

      bindings.push(function refreshTextNode (context, changes) {
        const newValue = expression(context)
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

  function bindAttribute (node, name, bindings) {
    const expression = buildExpression(node.getAttribute(name))
    if (expression) {
      let value

      bindings.push(function refreshAttribute (context, changes) {
        const newValue = expression(context)
        if (newValue !== value) {
          value = newValue
          changes.push(() => {
            node.setAttribute(name, newValue)
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
        for (const attr of node.attributes) {
          bindAttribute(node, attr.name, bindings)
        }
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
