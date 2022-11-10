export async function punybind (root, initialData) {
  // const isCSPon = (function () {
  //   try {
  //     new Function('return 0')
  //     return false
  //   } catch (e) {
  //     return true
  //   }
  // }())

  async function compile (source, ...params) {
    return new Function(...params, `return function(${params.join(',')}) { ${source} }`)() //eslint-disable-line
  }

  const $promise = Symbol('promise')
  const $resolver = Symbol('resolver')
  const $timeout = Symbol('timeout')

  async function refresh (force = false) {
    async function debounced () {
      if (refresh[$timeout]) {
        clearTimeout(refresh[$timeout])
        delete refresh[$timeout]
      }
      const changes = []
      await Promise.all(bindings.map(binding => binding(changes)))
      if (changes.length) {
        await Promise.all(changes.map(change => change()))
      }
      delete refresh[$promise]
      refresh[$resolver]()
    }

    if (force) {
      return await debounced()
    }
    if (!refresh[$promise]) {
      refresh[$promise] = new Promise(resolve => { refresh[$resolver] = resolve })
      refresh[$timeout] = setTimeout(debounced, 0)
    }
    await refresh[$promise]
  }

  const $raw = Symbol('raw')

  function observe (object) {
    return new Proxy(object, {
      get (obj, prop) {
        if (prop === $raw) {
          return object
        }
        const value = obj[prop] ?? ''
        const type = typeof value
        if (type === 'function') {
          const before = JSON.stringify(obj)
          return function () {
            const result = value.apply(obj, arguments)
            if (JSON.stringify(obj) !== before) {
              refresh()
            }
            return result
          }
        }
        if (type === 'object') {
          return observe(value)
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

  const data = observe(initialData)

  async function bindNodeValue (node, context) {
    const parsed = node.nodeValue.split(/{{((?:[^}]|}[^}])*)}}/)
    if (parsed.length > 1) {
      const expression = await compile(`with (__context__) { return [
        ${parsed.map((expr, idx) => idx % 2 ? expr : `\`${expr}\``).join(',')}
      ].join('') }`, '__context__')

      let previousValue

      return function refreshNodeValue (changes) {
        let value
        try {
          value = expression(context)
        } catch (e) {
          value = ''
        }
        if (value !== previousValue) {
          previousValue = value
          changes.push(() => { node.nodeValue = value })
        }
      }
    }
  }

  async function bindIterator (settings, context) {
    const { placeholder } = settings
    const parent = placeholder.parentNode
    const template = placeholder.firstChild
    const [valueName, indexName] = settings.for.split(',')
    const dataMember = settings.of

    const iterations = []

    return async function iterate (changes) {
      let newValues
      try {
        newValues = [...context[dataMember]]
      } catch (e) {
        newValues = []
      }
      if (newValues.length === iterations.length && newValues.every((value, index) => value === iterations[index].value)) {
        return // No significant change
      }
      // First implementation (remove all & replace)
      iterations.forEach(({ instance }) => parent.removeChild(instance))
      iterations.length = 0
      let index = 0
      for await (const value of newValues) {
        const instance = parent.insertBefore(template.cloneNode(true), placeholder)
        const subContext = Object.create(context[$raw])
        subContext[valueName] = value
        subContext[indexName || '__index__'] = index
        const bindings = await parse(instance, observe(subContext))
        iterations.push({ instance, value, bindings })
        ++index
      }

      await Promise.all(iterations.map(({ bindings }) => Promise.all(bindings.map(binding => binding(changes)))))
    }
  }

  async function parse (root, context) {
    const ELEMENT_NODE = 1
    const TEXT_NODE = 3
    const promises = []

    function traverse (node) {
      if (node.nodeType === TEXT_NODE) {
        promises.push(bindNodeValue(node, context))
      }
      if (node.nodeType === ELEMENT_NODE) {
        const attributes = node.getAttributeNames()
        if (attributes.includes('{{for}}')) {
          const placeholder = node.ownerDocument.createElement('template')
          node.parentNode.insertBefore(placeholder, node)
          placeholder.appendChild(node)
          const settings = {
            placeholder
          }
          'for,of'.split(',').forEach(name => {
            settings[name] = node.getAttribute(`{{${name}}}`)
            node.removeAttribute(`{{${name}}}`)
          })
          promises.push(bindIterator(settings, context))
        } else {
          promises.push(...attributes
            .filter(name => !name.match(/^{{\w+}}$/))
            .map(name => bindNodeValue(node.getAttributeNode(name), context))
          );
          [].slice.call(node.childNodes).forEach(traverse)
        }
      }
    }

    traverse(root)

    return Promise.all(promises)
      .then(bindings => bindings.filter(binding => !!binding))
  }
  const bindings = await parse(root, data)

  refresh()

  return data
}
