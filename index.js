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

  const $for = '{{for}}'

  function compile (expression) {
    const source = `with (__context__) try { return ${
      expression
    } } catch (e) { return '' }`
    // eslint-disable-next-line no-new-func
    return new Function(`return function(__context__) { ${source} }`)()
  }

  function fromBoundValue (value) {
    const parsed = value.split(/{{((?:[^}]|}[^}])+)}}/)
    if (parsed.length > 1) {
      return compile(`[${
        parsed.map((expr, idx) => idx % 2 ? expr : `\`${expr}\``).join(',')
      }].join('')`)
    }
  }

  function bindTextNode (node, bindings) {
    const valueFactory = fromBoundValue(node.nodeValue)
    if (valueFactory) {
      const parent = node.parentNode
      let value

      bindings.push(function refreshTextNode (context, changes) {
        const newValue = valueFactory(context)
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
    const valueFactory = fromBoundValue(node.getAttribute(name))
    if (valueFactory) {
      let value

      bindings.push(function refreshAttribute (context, changes) {
        const newValue = valueFactory(context)
        if (newValue !== value) {
          value = newValue
          changes.push(() => {
            node.setAttribute(name, newValue)
          })
        }
      })
    }
  }

  function bindIterator (node, bindings) {
    const forValue = node.getAttribute($for)
    const match = /(\w+)(?:\s*,\s*(\w+))?\s+of\s+(.*)/.exec(forValue)
    if (!match) {
      return
    }
    const [, valueName, indexName, iterator] = match
    const iteratorFactory = compile(iterator)
    if (!iteratorFactory) {
      return
    }

    const parent = node.parentNode
    const template = node.ownerDocument.createElement('template')
    parent.insertBefore(template, node)
    template.appendChild(node)
    node.removeAttribute($for)

    const nodes = []

    bindings.push(async function refreshIterator (context, changes) {
      if (nodes.length) {
        changes.push(function () {
          this.forEach(node => parent.removeChild(node))
        }.bind([...nodes]))
      }
      nodes.length = 0

      const iterator = iteratorFactory(context)
      let index = -1
      for await (const item of iterator) {
        ++index
        if (item === undefined) {
          continue
        }

        const instance = template.firstChild.cloneNode(true)
        nodes.push(instance)
        const subBindings = parse(instance)

        changes.push(function () {
          parent.insertBefore(instance, template)
        })

        const subContext = Object.assign(Object.create(context), {
          [valueName]: item,
          [indexName]: index
        })

        await collectChanges(subBindings, subContext, changes)
      }
    })
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
          if (attr.name === $for) {
            bindIterator(node, bindings)
          } else {
            bindAttribute(node, attr.name, bindings)
          }
        }
        Array.prototype.slice.call(node.childNodes).forEach(traverse)
      }
    }

    traverse(root)

    return bindings
  }

  async function collectChanges (bindings, context, changes) {
    for (const binding of bindings) {
      await binding(context, changes)
    }
  }

  exports.punybind = function (root) {
    const bindings = parse(root)

    async function update (context) {
      const changes = []
      await collectChanges(bindings, context, changes)
      for (const change of changes) {
        await change()
      }
    }

    Object.defineProperties(update, {
      bindingsCount: {
        value: bindings.length,
        writable: false,
        configurable: false
      }
    })

    return update
  }
}))
