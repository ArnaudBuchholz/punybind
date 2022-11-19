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

  const compileComposite = value => {
    const parsed = value.split(/{{((?:[^}])+)}}/)
    if (parsed.length > 1) {
      return compile(`[${
        parsed.map((expr, idx) => idx % 2 ? expr : `\`${expr}\``).join(',')
      }].join('')`)
    }
  }

  const ELEMENT_NODE = 1
  const TEXT_NODE = 3

  const attr = (node, name) => node.getAttribute(name)
  const array = arrayLike => Array.prototype.slice.call(arrayLike)

  const bindTextNode = (node, bindings) => {
    const valueFactory = compileComposite(node.nodeValue)
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
    const valueFactory = compileComposite(attr(node, name))
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

  const getTemplate = (node, attributeName) => {
    const parent = node.parentNode
    const template = node.ownerDocument.createElement('template')
    parent.insertBefore(template, node)
    template.appendChild(node)
    node.removeAttribute(attributeName)
    return [parent, template]
  }

  const CLONE = 0
  const BINDINGS = 1

  const instantiate = (template, changes) => {
    const clone = template.firstChild.cloneNode(true)
    changes.push(function () {
      template.parentNode.insertBefore(clone, template)
    })
    return [
      clone,
      parse(clone)
    ]
  }

  const remove = (parent, instances, changes) => {
    changes.push(function () {
      this.forEach(instance => parent.removeChild(instance[CLONE]))
    }.bind(instances))
  }

  const $for = '{{for}}'

  const bindIterator = (node, bindings) => {
    const forValue = attr(node, $for)
    const match = /^\s*(\w+)(?:\s*,\s*(\w+))?\s+of\s(.*)/.exec(forValue)
    if (!match) {
      return
    }
    const [, valueName, indexName, iterator] = match
    const iteratorFactory = compile(iterator)
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
          instances.push(instantiate(template, changes))
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

  const INSTANCE = 2

  const bindConditional = (node, bindings) => {
    const valueFactory = compile(attr(node, $if))
    if (!valueFactory) {
      return
    }

    const [parent, template] = getTemplate(node, $if)

    const conditionalChain = [[valueFactory, template]]

    const elements = array(parent.childNodes).filter(child => child.nodeType === ELEMENT_NODE)
    const nodePos = elements.findIndex(element => element === template)
    const siblings = elements.slice(nodePos + 1)

    siblings.every(nextSibling => {
      const elseIf = attr(nextSibling, $elseif)
      if (elseIf) {
        const eiValueFactory = compile(elseIf)
        if (!eiValueFactory) {
          return false
        }
        const [, eiTemplate] = getTemplate(nextSibling, $elseif)
        conditionalChain.push([eiValueFactory, eiTemplate])
        nextSibling = eiTemplate.nextElementSibling
      } else {
        // in case of {{else}} valueFactory always return true
        return false
      }
      return true
    })

    bindings.push(async (context, changes) => {
      let searchTrueCondition = true
      const instancesToRemove = []
      for (const condition of conditionalChain) {
        const [valueFactory, template, instance] = condition

        const value = searchTrueCondition && valueFactory(context)
        if (value) {
          searchTrueCondition = false
          if (!instance) {
            condition[INSTANCE] = instantiate(template, changes)
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

  const parse = root => {
    const bindings = []

    const traverse = node => {
      if (node.nodeType === TEXT_NODE) {
        bindTextNode(node, bindings)
      }
      if (node.nodeType === ELEMENT_NODE) {
        if (attr(node, $for)) {
          bindIterator(node, bindings)
          return
        }
        if (attr(node, $if)) {
          bindConditional(node, bindings)
          return
        }
        for (const attr of node.attributes) {
          bindAttribute(node, attr.name, bindings)
        }
        array(node.childNodes).forEach(traverse)
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
