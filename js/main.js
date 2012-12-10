ace.require(['ace/range'], function progInit(a) {
  var Range = a.Range

  var start = d3.select('#start')
  var stop = d3.select('#stop')
  var next = d3.select('#next')
  var prev = d3.select('#prev')
  var curExpressionInfo = d3.select('#curExpressionInfo')
  var prog, shaList
  var curExpressionMarker

  next.on('click', function () {
    if (prog) prog.next()
  })

  prev.on('click', function () {
    if (prog) prog.prev()
  })

  start.on('click', function () {
    if (prog != null) return
    start.classed('disabled', true)
    next.classed('disabled', false)
    prev.classed('disabled', false)
    stop.classed('disabled', false)
    var code = editor.getSession().getValue()
    editor.setReadOnly(true)
    prog = run(code, 14)
    shaList = prog[1]
    prog.on('tick', update)
    prog.on('end', enableCode)
    prog.next()
  })

  stop.on('click', enableCode)
  function enableCode() {
    if (curExpressionMarker) removeMarker(curExpressionMarker)
    curExpressionInfo.classed('hidden', true)
    stop.classed('disabled', true)
    next.classed('disabled', true)
    prev.classed('disabled', true)
    start.classed('disabled', false)
    editor.setReadOnly(false)
    prog = null
    shaList = null
  }

  var editor = ace.edit("editor")
  editor.setTheme("ace/theme/twilight")
  editor.getSession().setMode("ace/mode/javascript")

  var stackVis = d3.select("#stackVis")
  var scopeVis = d3.select("#scopeVis")

  function prettyprintFunction(fn) {
    var name = fn.name ? ' ' + fn.name : ''
    return '[Function' + name + ']'
  }

  function setMarker(type, exp) {
    var start = exp.loc.start
    var end = exp.loc.end
    var range = new a.Range(start.line - 1, start.column, end.line - 1, end.column)
    var marker = editor.getSession().addMarker(range, type, "text")
    return marker
  }

  function removeMarker(marker) {
    editor.getSession().removeMarker(marker)
  }

  function mark(d) {
    var markList = d.marks[d.key] = d.marks[d.key] || []
    var createMarks = setMarker.bind(null, 'scopedVariableFinder')
    d.marks[d.key] = d.markIndex[d.key].map(createMarks).concat(markList)
  }

  function unmark(d) {
    if (!d.marks[d.key]) return
    d.marks[d.key].forEach(removeMarker)
    d.marks[d.key] = []
  }

  var stackTree = d3.layout.tree()
    .children(function (d) {
      return d.caller ? [d.caller] : null
    })

  var scopeTree = d3.layout.tree()
    .children(function (scopeMeta) {
      return scopeMeta.parentScope.index ? [scopeMeta.parentScope] : null
    })

  function update(contin, shaList) {
    stackVis.selectAll("div.stackFrame").remove()
    scopeVis.selectAll("div.scopes").remove()
    if (!contin) return
    var valInfo = contin.valInfo
    var curSha = contin.tokenSha
    var stack = contin.stack

    var callStack = stackTree.nodes(stack).reverse()
    var scopeChain = scopeTree.nodes(stack.scopeMeta).reverse()

    if (curExpressionMarker) removeMarker(curExpressionMarker)
    curExpressionMarker = setMarker('curExpression', shaList[curSha])

    curExpressionInfo.classed('hidden', false).select('.expType').text(shaList[curSha].type)

    var value = 'No Value'
    if (valInfo.hasVal) {
      if (typeof valInfo.value === 'function') value = prettyprintFunction(valInfo.value)
      else value = valInfo.value
    }
    curExpressionInfo.select('.expVal').text(value)

    var stackFrames = stackVis.selectAll(".stackFrame")
      .data(callStack)

    stackFrames.exit().remove()

    var stackItem = stackFrames.enter().append('div')
      .attr("class", "stackFrame")

    function getStackFrameInfo(key) {
      return function getStackFrameInfo(d, i) {
        var funcInfo = shaList[shaList[d.scopeMeta.index].parent]
        return [{ funcInfo: funcInfo
              , callInfo: d.callInfo
              , key: key
              , markIndex: { definition: [funcInfo], callSite: [d.callInfo] }
              , marks: {}
              }]
      }
    }

    stackItem.classed('scoped', function (d) {
      return d === stack
    })

    stackItem.selectAll('p.title').data(getStackFrameInfo('definition'))
      .enter()
      .append('p').attr('class', 'title')
      .text(function (d) {
        if (d.funcInfo.type === 'Program') return 'Global'
        var call = d.callInfo.callee
        var funcName = d.funcInfo.id && d.funcInfo.id.name || prettyprintFunction(d.funcInfo)
        var callName = call.type === 'Identifier' ? call.name
            : call.id && call.id.name || prettyprintFunction(d.funcInfo)
        return funcName === callName ? funcName
             : funcName + ' As ' + callName
      })
      .on('mouseover', mark)
      .on('mouseout', unmark)

    stackItem.selectAll('p.definition')
      .data(getStackFrameInfo('definition')).enter()
      .append('p').attr('class', 'section definition')
      .text('Definition')
      .on('mouseover', mark)
      .on('mouseout', unmark)

    stackItem.selectAll('p.callsite')
      .data(function (d, i) {
        return i === 0 ? [] : getStackFrameInfo('callSite')(d, i)
      }).enter()
      .append('p').attr('class', 'section callsite')
      .text('CallSite')
      .on('mouseover', mark)
      .on('mouseout', unmark)


    var scopes = scopeVis.selectAll(".scopes")
      .data(scopeChain)
    scopes.exit().remove()

    var scopeItem = scopes.enter().append('div')
      .attr("class", "scopes")

    scopeItem.append('div')
      .attr('class', 'props')
    .selectAll('p.prop')
      .data(function (d, i) {
        var marks = {}
        var markIndex = shaList[d.index]
        var special = ['arguments', 'this']
        return Object.keys(d.scope).sort(function (a, b) {
          var aSpec = ~special.indexOf(a)
          var bSpec = ~special.indexOf(b)
          return aSpec && bSpec ? String.localeCompare(a, b)
           : aSpec ? 1
           : bSpec ? -1
           : String.localeCompare(a, b)
        }).map(function setupPropData(key) {
          return { key: key
                 , val: d.scope[key]
                 , markIndex: markIndex
                 , marks: marks
                 }
        }) 
      })
      .enter().append("p")
      .attr('class', 'prop')
      .on('mouseover', mark)
      .on('mouseout', unmark)
      .text(function propText(d) {
        return d.key + ': ' + (typeof d.val === 'function' ? prettyprintFunction(d.val) : d.val)
      })
  }
})
