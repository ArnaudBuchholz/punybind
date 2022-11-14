# punybind

A minimalist binding helper.

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
        class="todo {{ item.done ? 'done' : '' }}"
      >{{ item.text }}</li>
    </ul>
  </body>
</html>
``` 

Text elements and attribute values can use `{{ }}` syntax.
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

* Bindings are set at node / attribute level.
* For a textual values, it is possible to mix static content with computed one but any error clears the whole value.
