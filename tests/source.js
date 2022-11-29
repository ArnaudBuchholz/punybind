'use strict'

const { punybind } = require('../punybind.js')
global.punybind = punybind
global.expectedVersion = '0.0.0'

require('./setup')
