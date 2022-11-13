# punybind

A minimalist binding helper.

## Usage

### Inject the punybind helper

```html
<script src="punybind.js"></script>
``` 

### Define bound sections in the HTML

```html
<html>
  <head>
    <title>{{ title }}</title>
  </head>
</html>
``` 

### Bind the section

```JavaScript
const update = punybind(document.head)
```

The update method contains the following properties :
  * `bindingsCount` (number) : The number of bindings detected

### Update by passing a context object

```JavaScript
await update({ title: 'Hello World !' })
```

### Enjoy !

## Reactive update

```JavaScript
const update = punybind(document.querySelector('bound'), {
  title: 'Hello World !'
})
const { model } = update
model.title = 'It works !'

```


## Implementation notes

* Bindings are set at node / attribute level.
* For a node, it is possible to mix static content with computed one but an error would clear the node value.