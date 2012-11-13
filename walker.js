var convert = require('../cpsjs/cpstransform')
var esprima = require('esprima').parse
var escodegen = require('escodegen').generate
var Memory = require('../memory-tree/memoryProxy')
var EventEmitter = require('events').EventEmitter

function run(str) {
  var __undefined
  var scopeInfoMap = new WeakMap()
  var globalScopeInfo = Memory.Scope({ a: 1, b: 2}, Memory({}))
  var __globalScope = globalScopeInfo[0]
  var __stack = []
  var emitter = new EventEmitter()
  var ast = convert(esprima(str, { loc: true, range: true }))
  var code = escodegen(ast)

  emitter.next = function () { eval(code) }
  scopeInfoMap.set(__globalScope, globalScopeInfo)
  globalScopeInfo.viewAll = true

  function __createScopeObject(scopeDef, parentScope) {
    var parentScopeInfo = scopeInfoMap.get(parentScope)
    var scopeInfo = Memory.Scope(scopeDef, parentScopeInfo)
    scopeInfo[1].viewAll = true
    scopeInfoMap.set(scopeInfo[0], scopeInfo)
    return scopeInfo[0]
  }

  function __end(val) {
    __stack.pop()
    emitter.emit('tick', __stack)
    emitter.emit('end', __stack)
  }

  function __continuation(val, cb) {
    if (arguments.length === 1) cb = val,val=null;
    var curScope = __stack[__stack.length - 1]
    emitter.emit('tick', __stack)
    emitter.next = cb.bind(null, val)
  }

  return emitter
}
