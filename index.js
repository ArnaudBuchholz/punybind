(function (factory) {
  'use strict'
  // istanbul ignore else
  if (typeof module !== 'undefined' && module.exports) {
    factory(module.exports)
  } else {
    // eslint-disable-next-line no-eval
    factory((0, eval)('this'))
  }
}(function (exports) {
  'use strict'

  function compile (source, ...params) {
    // eslint-disable-next-line no-new-func
    return new Function(...params, `return function(${params.join(',')}) { ${source} }`)()
  }

  function bindNodeValue (node, bindings) {
    const parsed = node.nodeValue.split(/{{((?:[^}]|}[^}])*)}}/)
    if (parsed.length > 1) {
      const expression = compile(`with (__context__) { return [
        ${parsed.map((expr, idx) => idx % 2 ? expr : `\`${expr}\``).join(',')}
      ].join('') }`, '__context__')

      let previousValue

      bindings.push(function refreshNodeValue (context, changes) {
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
      })
    }
  }

  function parse (root) {
    const ELEMENT_NODE = 1
    const TEXT_NODE = 3
    const bindings = []

    function traverse (node) {
      if (node.nodeType === TEXT_NODE) {
        bindNodeValue(node, bindings)
      }
      if (node.nodeType === ELEMENT_NODE) {
        [].slice.call(node.childNodes).forEach(traverse)
      }
    }

    traverse(root)

    return bindings
  }

  exports.punybind = function (root) {
    const bindings = parse(root)

    return function (context) {
      const changes = []
      bindings.forEach(binding => binding(context, changes))
      if (changes.length) {
        changes.forEach(change => change())
      }
    }
  }
}))
