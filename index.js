(function (exports) {
  'use strict'

  const compile = expression => {
    const source = `try { with (__context__) { return ${
      expression
    } } } catch (e) { return '' }`
    try {
      // eslint-disable-next-line no-new-func
      return new Function(`return function(__context__) { ${source} }`)()
    } catch (e) {
      // ignore
    }
  }

  const fromBoundValue = value => {
    const parsed = value.split(/{{((?:[^}])+)}}/)
    if (parsed.length > 1) {
      return compile(`[${
        parsed.map((expr, idx) => idx % 2 ? expr : `\`${expr}\``).join(',')
      }].join('')`)
    }
  }

  const bindTextNode = (node, bindings) => {
    const valueFactory = fromBoundValue(node.nodeValue)
    if (valueFactory) {
      const parent = node.parentNode
      let value

      bindings.push((context, changes) => {
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

  const bindAttribute = (node, name, bindings) => {
    const valueFactory = fromBoundValue(node.getAttribute(name))
    if (valueFactory) {
      let value

      bindings.push((context, changes) => {
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

  const $for = '{{for}}'

  const bindIterator = (node, bindings) => {
    const forValue = node.getAttribute($for)
    const match = /^\s*(\w+)(?:\s*,\s*(\w+))?\s+of\s(.*)/.exec(forValue)
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

    const instances = []

    bindings.push(async (context, changes) => {
      const iterator = iteratorFactory(context)
      let index = -1
      for await (const item of iterator) {
        ++index

        if (index === instances.length) {
          const instance = template.firstChild.cloneNode(true)
          instances.push({
            instance,
            bindings: parse(instance)
          })
          changes.push(function () {
            parent.insertBefore(instance, template)
          })
        }

        await collectChanges(
          instances[index].bindings,
          {
            ...context,
            [valueName]: item,
            [indexName]: index
          },
          changes
        )
      }

      ++index

      changes.push(function () {
        this.forEach(({ instance }) => parent.removeChild(instance))
      }.bind(instances.slice(index)))
      instances.length = index
    })
  }

  const parse = root => {
    const ELEMENT_NODE = 1
    const TEXT_NODE = 3
    const bindings = []

    const traverse = node => {
      if (node.nodeType === TEXT_NODE) {
        bindTextNode(node, bindings)
      }
      if (node.nodeType === ELEMENT_NODE) {
        if (node.getAttribute($for)) {
          bindIterator(node, bindings)
          return
        }
        for (const attr of node.attributes) {
          bindAttribute(node, attr.name, bindings)
        }
        Array.prototype.slice.call(node.childNodes).forEach(traverse)
      }
    }

    traverse(root)

    return bindings
  }

  const collectChanges = async (bindings, context, changes) => {
    for (const binding of bindings) {
      await binding(context, changes)
    }
  }

  const observe = (object, refresh) => {
    return new Proxy(object, {
      get (obj, prop) {
        const value = obj[prop]
        const type = typeof value
        if (type === 'object') {
          return observe(value, refresh)
        }
        return value
      },
      set (obj, prop, value) {
        const previousValue = obj[prop]
        if (previousValue !== value) {
          obj[prop] = value
          refresh()
        }
        return true
      }
    })
  }

  exports.punybind = async (root, properties = {}) => {
    const bindings = parse(root)

    let done = Promise.resolve()
    let succeeded
    let failed
    let lastContext

    const debounced = async () => {
      try {
        const changes = []
        await collectChanges(bindings, lastContext, changes)
        for (const change of changes) {
          await change()
        }
        lastContext = undefined
        succeeded(changes.length)
      } catch (reason) {
        failed(reason)
      }
    }

    const update = async (context) => {
      if (lastContext === undefined) {
        setTimeout(debounced, 0)
        done = new Promise((resolve, reject) => {
          succeeded = resolve
          failed = reject
        })
      }
      lastContext = context
      return done
    }

    await update(properties)
    const model = observe(properties, () => {
      update(properties)
    })

    const ro = value => ({
      value,
      writable: false
    })

    Object.defineProperties(update, {
      bindingsCount: ro(bindings.length),
      model: ro(model),
      done: ro(() => done)
    })

    return update
  }
// eslint-disable-next-line no-eval
}((0, eval)('this')))
