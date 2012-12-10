var convert = require('../cpsjs/cpstransform')
var esprima = require('esprima').parse
var escodegen = require('escodegen').generate
var Memory = require('../memory-tree/memoryProxy')
var EventEmitter = require('events').EventEmitter

function run(str) {
  var __undefined
  var scopeInfoMap = new WeakMap()
  var stackInfoMap = new WeakMap()
  var globalScopeInfo = Memory.Scope({}, Memory({}))
  var __globalScope = globalScopeInfo[0]
  var __stack = null;
  var currentContin = null;
  var emitter = new EventEmitter()
  var ast = convert(esprima(str, { loc: true }))
  var code = escodegen(ast[0])

  scopeInfoMap.set(__globalScope, globalScopeInfo)

  function __pushStack(stack, scope, callSha) {
    callInfo = callSha ? ast[1][callSha] : null
    var scopeInfo = scopeInfoMap.get(scope)
    var parentStackInfo = stack ? stackInfoMap.get(stack)
      : null
    var scopeIndex = ast[1][scopeInfo[1].index]
    var stackInfo = Memory.Stack(parentStackInfo, scopeInfo, callInfo, scopeIndex)
    __stack = stackInfo[0]
    stackInfoMap.set(stackInfo[0], stackInfo)
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

  function createCallState(stackInfo, stackSha, tokenSha, cb, valInfo) {
    // Add callstate into sha list...
    return { tokenSha: tokenSha, stack: stackInfo[0], go: setSha, func: cb, valInfo: valInfo }
    function setSha() {
      stackInfo[1].setSha(stackSha)
      emitter.emit('tick', this, ast[1])
    }
  }

  /* Temporarily hold off on this part.
  * Cram it into the callstate instead....
  function createContinuation(cc, cs, valInfo, next) {
    // Add contin into sha list...
    return { parentContin: cc, callState: cs, valInfo: valInfo, next: next }
  }
  */

  var continList = []
  var continLoc = -1

  function __continuation(curSha, val, cb) {
    var valInfo = { hasVal: true, value: val }
    if (arguments.length === 2) {
      cb = val
      valInfo.value = val = null
      valInfo.hasVal = false
    }

    var stackInfo = stackInfoMap.get(__stack)
    var stackSha = stackInfo[1].getSha()
    var callState = createCallState(stackInfo, stackSha, curSha, cb, valInfo)
    continList.push(callState)
    continLoc++
    //currentContin = createContinuation(currentContin, callState, valInfo, cb)
    emitter.emit('tick', callState, ast[1])
    //emitter.next = cb.bind(null, val)
  }

  emitter.next = function () {
    var contin
    if (continLoc === -1) return eval(code)
    if (continLoc === continList.length - 1) {
      contin = continList[continLoc]
      return contin.func(contin.valInfo.value)
    }
    continLoc++
    contin = continList[continLoc]
    return contin.go()
  }

  emitter.prev = function () {
    if (continLoc === 0) return
    continLoc--
    contin = continList[continLoc]
    return contin.go()
  }

  return emitter
}
