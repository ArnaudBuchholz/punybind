# punybind 🦴

[![Node.js CI](https://github.com/ArnaudBuchholz/punybind/actions/workflows/node.js.yml/badge.svg)](https://github.com/ArnaudBuchholz/punybind/actions/workflows/node.js.yml)
[![Mutation Testing](https://img.shields.io/badge/mutation%20testing-100%25-green)](https://arnaudbuchholz.github.io/punybind/reports/mutation/mutation.html)
[![Package Quality](https://npm.packagequality.com/shield/punybind.svg)](https://packagequality.com/#?package=punybind)
[![Known Vulnerabilities](https://snyk.io/test/github/ArnaudBuchholz/punybind/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ArnaudBuchholz/punybind?targetFile=package.json)
[![punybind](https://badge.fury.io/js/punybind.svg)](https://www.npmjs.org/package/punybind)
[![punybind](http://img.shields.io/npm/dm/punybind.svg)](https://www.npmjs.org/package/punybind)
[![install size](https://packagephobia.now.sh/badge?p=punybind)](https://packagephobia.now.sh/result?p=punybind)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


A minimalist one-way binding helper.

## Usage

### 1. Inject the punybind helper

```html
<script src="punybind.js"></script>
``` 

### 2. Define bindings in the HTML

```html
<html>
  <head>
    <title>TODO list</title>
    <script src="punybind.js"></script>
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

Text elements and attribute values can use `{{ }}` syntax.
The special `{{for}}` attribute defines an iteration.

### 3. Bind the section

```JavaScript
const update = await punybind(document.body)
```

The `update` asynchronous method exposes the following properties :
  * `bindingsCount` (number) : The number of bindings detected
  * `model` (object) : The reactive model (see below)

### 4. Update the section by passing a context object

```JavaScript
await update({
  title: 'My TODO list',
  items: [{
    done: false,
    text: 'Forget about heavy frameworks'
  }, {
    done: true,
    text: 'Adopt punybind'
  }]
})
```

### 5. Enjoy !

## Reactive model

```JavaScript
const { model } = await punybind(document.body, {
  title: 'Hello World !'
})
console.log(model.title) // Hello World !
model.title = 'It works !' // Triggers update
```

## Implementation notes

* This implementation is **not** compliant with [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
* For a textual values, it is possible to mix static content with computed one but any error clears the whole value.
