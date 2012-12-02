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
  var __stack = null;
  var emitter = new EventEmitter()
  var ast = convert(esprima(str, { loc: true }))
  var code = escodegen(ast[0])

  emitter.next = function () { eval(code) }
  scopeInfoMap.set(__globalScope, globalScopeInfo)
  globalScopeInfo.viewAll = true

  function __pushStack(stack, scope, callInfo) {
    callInfo = callInfo ? ast[1][callInfo] : null
    __stack = { scopeMeta: scopeInfoMap.get(scope)[1]
              , scope: scope
              , progInfo: ast[1]
              , callInfo: callInfo
              , caller: stack
              }
  }

  function __popStack(stack) {
    __stack = __stack.caller
  }

  function __createScopeObject(scopeDef, parentScope, scopeIndexSha) {
    var parentScopeInfo = scopeInfoMap.get(parentScope)
    var scopeInfo = Memory.Scope(scopeDef, parentScopeInfo)
    scopeInfo[1].index = scopeIndexSha
    scopeInfo[1].viewAll = true
    scopeInfoMap.set(scopeInfo[0], scopeInfo)
    return scopeInfo[0]
  }

  function __end(val) {
    __popStack(__stack)
    emitter.emit('tick', __stack)
    emitter.emit('end', __stack)
  }

  function __continuation(curSha, val, cb) {
    var valInfo = { hasVal: true, value: val }
    if (arguments.length === 2) {
      cb = val
      val=null
      valInfo.hasVal = false
    }
    var curScope = __stack[__stack.length - 1]
    emitter.emit('tick', __stack, valInfo, curSha, ast[1])
    emitter.next = cb.bind(null, val)
  }

  return emitter
}
