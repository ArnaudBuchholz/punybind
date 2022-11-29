const { join } = require('path')
const { readFileSync, writeFileSync } = require('fs')
const { version } = require(join(__dirname, 'package.json'))
const path = join(__dirname, 'dist/punybind.js')
writeFileSync(
  path,
  readFileSync(path)
    .toString()
    .replace('0.0.0', version)
)
