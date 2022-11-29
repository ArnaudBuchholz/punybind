'use strict'

const { punybind } = require('../dist/punybind.js')
global.punybind = punybind

const { version } = require('../package.json')
global.expectedVersion = version

require('./setup')
