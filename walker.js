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
  var currentContin = null;
  var emitter = new EventEmitter()
  var ast = convert(esprima(str, { loc: true }))
  var code = escodegen(ast[0])

  emitter.next = function () { eval(code) }
  scopeInfoMap.set(__globalScope, globalScopeInfo)
  globalScopeInfo[1].parent = null

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
    emitter.emit('tick', null)
    emitter.emit('end', __stack)
  }

  function createCallState(stack, tokenSha) {
    // Add callstate into sha list...
    return { tokenSha: tokenSha, stack: stack }
  }

  function createContinuation(cc, cs, valInfo, next) {
    // Add contin into sha list...
    return { parentContin: cc, callState: cs, valInfo: valInfo, next: next }
  }

  function __continuation(curSha, val, cb) {
    var valInfo = { hasVal: true, value: val }
    if (arguments.length === 2) {
      cb = val
      valInfo.value = val = null
      valInfo.hasVal = false
    }

    var callState = createCallState(__stack, curSha)
    var contin = createContinuation(currentContin, callState, valInfo, cb)
    emitter.emit('tick', contin, ast[1])
    emitter.next = cb.bind(null, val)
  }

  return emitter
}
