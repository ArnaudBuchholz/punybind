(function (exports) {
  'use strict'

  // eslint-disable-next-line no-new-func
  const defaultCompiler = expression => new Function(`return function(_){with (_){return ${expression}}}`)()

  const safeCompile = (expression, { compiler }) => {
    try {
      const compiled = compiler(expression)
      return function (context) {
        let result
        try {
          result = compiled(context)
        } catch (e) {
          // ignore
        }
        if (result === undefined) {
          return ''
        }
        return result
      }
    } catch (e) {
      // ignore
    }
  }

  const safeCompileComposite = (value, options) => {
    const parsed = value.split(/{{((?:[^}])+)}}/)
    const escape = str => str.replace(/\\|'/g, match => ({ '\\': '\\\\', '\'': '\\\'' }[match]))
    if (parsed.length > 1) {
      return safeCompile(parsed.map((expr, idx) => idx % 2 ? `(${expr})` : `'${escape(expr)}'`).join('+'), options)
    }
  }

  const ELEMENT_NODE = 1
  const TEXT_NODE = 3

  const attr = (node, name) => node.getAttribute(name)

  const bindTextNode = (node, bindings, options) => {
    const valueFactory = safeCompileComposite(node.nodeValue, options)
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

  const bindAttribute = (node, name, bindings, options) => {
    const valueFactory = safeCompileComposite(attr(node, name), options)
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

  const addToTemplate = (node, attributeName, template) => {
    const { nextElementSibling } = node
    template.appendChild(node)
    node.removeAttribute(attributeName)
    return nextElementSibling
  }

  const getTemplate = (node, attributeName) => {
    const parent = node.parentNode
    const template = node.ownerDocument.createElement('template')
    parent.insertBefore(template, node)
    addToTemplate(node, attributeName, template)
    return [parent, template]
  }

  const CLONE = 0
  const BINDINGS = 1

  const instantiate = (template, changes, options, index = 0) => {
    let elementToClone = template.firstElementChild
    while (index-- > 0) {
      elementToClone = elementToClone.nextElementSibling
    }
    const clone = elementToClone.cloneNode(true)
    changes.push(function () {
      template.parentNode.insertBefore(clone, template)
    })
    return [
      clone,
      parse(clone, options)
    ]
  }

  const remove = (parent, instances, changes) => {
    changes.push(function () {
      this.forEach(instance => parent.removeChild(instance[CLONE]))
    }.bind(instances))
  }

  const $for = '{{for}}'

  const bindIterator = (node, bindings, options) => {
    const forValue = attr(node, $for)
    const match = /^\s*(\w+)(?:\s*,\s*(\w+))?\s+of\s(.*)/.exec(forValue)
    if (!match) {
      return
    }
    const [, valueName, indexName, iterator] = match
    const iteratorFactory = safeCompile(iterator, options)
    if (!iteratorFactory) {
      return
    }

    const [parent, template] = getTemplate(node, $for)
    const instances = []

    bindings.push(async (context, changes) => {
      const iterator = iteratorFactory(context)
      let index = -1
      for await (const item of iterator) {
        ++index

        if (index === instances.length) {
          instances.push(instantiate(template, changes, options))
        }

        await collectChanges(
          instances[index][BINDINGS],
          {
            ...context,
            [valueName]: item,
            [indexName]: index
          },
          changes
        )
      }

      ++index

      remove(parent, instances.slice(index), changes)
      instances.length = index
    })
  }

  const $if = '{{if}}'
  const $elseif = '{{elseif}}'
  const $else = '{{else}}'

  const INSTANCE = 1

  const bindConditional = (node, bindings, options) => {
    const valueFactory = safeCompile(attr(node, $if), options)
    if (!valueFactory) {
      return
    }

    let nextSibling = node.nextElementSibling
    const [parent, template] = getTemplate(node, $if)

    const conditionalChain = [[valueFactory]]

    while (nextSibling) {
      const elseIf = attr(nextSibling, $elseif)
      if (elseIf) {
        const eiValueFactory = safeCompile(elseIf, options)
        if (!eiValueFactory) {
          break
        }
        conditionalChain.push([eiValueFactory])
        nextSibling = addToTemplate(nextSibling, $elseif, template)
      } else {
        if (nextSibling.hasAttribute($else)) {
          addToTemplate(nextSibling, $else, template)
          conditionalChain.push([() => true])
        }
        break
      }
    }

    bindings.push(async (context, changes) => {
      let searchTrueCondition = true
      const instancesToRemove = []
      let index = -1
      for (const condition of conditionalChain) {
        ++index
        const [valueFactory, instance] = condition

        const value = searchTrueCondition && valueFactory(context)
        if (value) {
          searchTrueCondition = false
          if (!instance) {
            condition[INSTANCE] = instantiate(template, changes, options, index)
          }
          await collectChanges(condition[INSTANCE][BINDINGS], context, changes)
        } else if (instance) {
          instancesToRemove.push(instance)
          condition[INSTANCE] = undefined
        }
      }
      remove(parent, instancesToRemove, changes)
    })
  }

  const parse = (root, options) => {
    const bindings = []

    const traverse = node => {
      if (node.nodeType === TEXT_NODE) {
        bindTextNode(node, bindings, options)
      }
      if (node.nodeType === ELEMENT_NODE) {
        if (attr(node, $for)) {
          bindIterator(node, bindings, options)
          return
        }
        if (attr(node, $if)) {
          bindConditional(node, bindings, options)
          return
        }
        for (const attr of node.attributes) {
          bindAttribute(node, attr.name, bindings, options)
        }
        const childNodes = node.childNodes
        let index = 0
        while (index < childNodes.length) {
          traverse(childNodes[index++])
        }
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

  const ro = value => ({
    value,
    writable: false
  })

  const assignROProperties = (object, properties) => {
    Object.defineProperties(
      object,
      Object.keys(properties).reduce((dict, property) => {
        dict[property] = ro(properties[property])
        return dict
      }, {})
    )
  }

  async function punybind (root, properties = {}) {
    const bindings = parse(root, this)

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

    assignROProperties(update, {
      bindingsCount: bindings.length,
      model,
      done: () => done
    })

    return update
  }

  const use = (options) => {
    const instance = punybind.bind(options)
    assignROProperties(instance, {
      version: '0.0.0',
      use: addOptions => use({
        ...options,
        ...addOptions
      })
    })
    return instance
  }

  exports.punybind = use({
    compiler: defaultCompiler
  })
}(this))
