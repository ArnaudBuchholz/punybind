# punybind 🦴

[![Node.js CI](https://github.com/ArnaudBuchholz/punybind/actions/workflows/node.js.yml/badge.svg)](https://github.com/ArnaudBuchholz/punybind/actions/workflows/node.js.yml)
[![Mutation Testing](https://img.shields.io/badge/mutation%20testing-100%25-green)](https://arnaudbuchholz.github.io/punybind/reports/mutation/mutation.html)
[![Package Quality](https://npm.packagequality.com/shield/punybind.svg)](https://packagequality.com/#?package=punybind)
[![Known Vulnerabilities](https://snyk.io/test/github/ArnaudBuchholz/punybind/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ArnaudBuchholz/punybind?targetFile=package.json)
[![punybind](https://badge.fury.io/js/punybind.svg)](https://www.npmjs.org/package/punybind)
[![punybind](http://img.shields.io/npm/dm/punybind.svg)](https://www.npmjs.org/package/punybind)
[![install size](https://packagephobia.now.sh/badge?p=punybind)](https://packagephobia.now.sh/result?p=punybind)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


A minimalist *(2889 bytes)* one-way binding helper.

## Usage

### 1. Include the punybind helper

```html
<script src="https://cdn.jsdelivr.net/npm/punybind/dist/punybind.js"></script>
``` 

### 2. Define bindings in the HTML

```html
<html>
  <head>
    <title>TODO list</title>
  </head>
  <body>
    <h1>{{ title }}</h1>
    <ul>
      <li
        {{for}}="item of items"
        class="todo{{ item.done ? ' done' : '' }}"
      >{{ item.text }}</li>
    </ul>
  </body>
</html>
``` 

See below for supported syntaxes.

### 3. Bind the section

```JavaScript
const update = await punybind(document.body)
```

The `update` asynchronous method exposes the following properties :
  * `bindingsCount` (number) : The number of bindings detected
  * `model` (object) : The reactive model (see below)
  * `done` (function) : Returns a promise being fulfilled when the last update completes (see below).

Upon `update` invocation, the returned [promise is fulfilled](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) when the DOM update is **completed**.

### 4. Update the section by passing a context object

```JavaScript
await update({
  title: 'My TODO list',
  items: [{
    done: true,
    text: 'Forget about heavy frameworks'
  }, {
    done: false,
    text: 'Adopt punybind'
  }]
})
```

*Or use the reactive model (see below).*

### 5. Enjoy !

## Supported syntaxes

### Text and attribute binding

Text nodes and attribute values leverage binding using the `{{ expression }}` syntax.

The `expression` is evaluated with the properties of the contextual object.

It is possible to mix static content with computed one but *any* error **clears** the whole value.

### Iterators

Iterators allow the repetition of elements.

An iterator is declared **on** the element to repeat using the special attribute `{{for}}` with the value being either :
* `{{for}}="item of expression"`
* `{{for}}="item, index of expression"`

Where :
* `item` is the contextual property receiving the value of the current iteration (to use in the subsequent bindings),
* `index` is the contextual property receiving the index of the current iteration (0-based),
* `expression` must evaluate to an [iterable object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols).

### Conditionals

Conditionals rule the rendering of elements.

They can form an `if` / `elseif` / `else` chain. Their expression must evaluate to a [truthy value](https://developer.mozilla.org/en-US/docs/Glossary/Truthy) to enable rendering.

To work properly, the attributes must be set **on contiguous sibling elements** :
* `{{if}}="expression"` : must be the first element of the chain,
* `{{elseif}}="expression"` : (optional) is evaluated and rendered only if the previous `if` / `elseif` did not evaluate to a truthy value,
* `{{else}}` : (optional) terminates the chain and is rendered only if the previous `if` / `elseif` did not evaluate to a truthy value.

## Reactive model

```JavaScript
const { model, done } = await punybind(document.body, {
  title: 'Hello World !',
  items: []
})
console.log(model.title) // Hello World !
// The following lines of code trigger updates
model.title = 'My TODO list'
model.items.push({
  done: false,
  text: 'Adopt punybind'
})
await done() // Wait for the DOM update to be completed
```

## Customizing

It is possible to tweak some settings with `punybind.use`, for instance :

```javascript
// see https://www.npmjs.com/package/punyexpr
const safebind = punybind.use({
  compiler: punyexpr
})
// safebind offers the same features as punybind
const { model, done } = await safebind(document.body, {
  title: 'Hello World !',
  items: []
})
```

Available options :

* `compiler: (expression: string) => (context: object) => any`
  * Function that *compiles* the expression and return a function that evaluates it with the given context. Default compiler uses an eval-like syntax.

## Implementation notes

* The default expression compiler implementation is **not** compliant with [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
* **Only** properties coming from the contextual object can be used in evaluated expressions.
* Bound elements are *hidden* under [`template` elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template).
* When any error occurs *(inconsistent binding, invalid syntax)*, the binding **silently** fails.
