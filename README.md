# punybind

A minimalist binding helper.

## Usage

* Inject the punybind helper

```html
<script src="punybind.js"></script>
``` 

* Define bound sections in the HTML

```html
<html>
  <head>
    <title>{{ title }}</title>
  </head>
</html>
``` 

* Bind the section

```JavaScript
const update = punybind(document.head)
```

* Update by passing the context object

```JavaScript
update({ title: 'Hello World !' })
```

* Enjoy !

## Implementation notes

* Bindings are set at node / attribute level.
* For a node, it is possible to mix static content with computed one but an error would clear the node value.