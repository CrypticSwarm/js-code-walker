ace.require(['ace/range'], function(a) {
  var Range = a.Range

  var start = d3.select('#start')
  var stop = d3.select('#stop')
  var next = d3.select('#next')
  var prev = d3.select('#prev')
  var curExpressionInfo = d3.select('#curExpressionInfo')
  var prog
  var curExpressionMarker

  next.on('click', function () {
    if (prog) prog.next()
  })

  start.on('click', function () {
    if (prog != null) return
    start.classed('disabled', true)
    next.classed('disabled', false)
    stop.classed('disabled', false)
    var code = editor.getSession().getValue()
    editor.setReadOnly(true)
    prog = run(code, 14)
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
    start.classed('disabled', false)
    editor.setReadOnly(false)
    prog = null
  }

  var editor = ace.edit("editor")
  editor.setTheme("ace/theme/twilight")
  editor.getSession().setMode("ace/mode/javascript")

  var vis = d3.select("#visualContainer")

  function prettyprintFunction(fn) {
    var name = fn.name ? ' ' + fn.name : ''
    return '[Function' + name + ']'
  }

  function setMarker(sha, shaList, type) {
    var exp = shaList[sha]
    var start = exp.loc.start
    var end = exp.loc.end
    var range = new a.Range(start.line - 1, start.column, end.line - 1, end.column)
    var marker = editor.getSession().addMarker(range, type, "text")
    return marker
  }

  function removeMarker(marker) {
    editor.getSession().removeMarker(marker)
  }

  function update(data, valInfo, curSha, shaList) {
    vis.selectAll("div.node").remove()
    if (data.length === 0) return

    if (curExpressionMarker) removeMarker(curExpressionMarker)
    curExpressionMarker = setMarker(curSha, shaList, 'curExpression')

    curExpressionInfo.classed('hidden', false).select('.expType').text(shaList[curSha].type)

    var value = 'No Value'
    if (valInfo.hasVal) {
      if (typeof valInfo.value === 'function') value = prettyprintFunction(valInfo.value)
      else value = valInfo.value
    }
    curExpressionInfo.select('.expVal').text(value)

    var node = vis.selectAll(".node")
      .data(data)

    node.exit().remove()

    var nodeItem = node.enter().append('div')
      .attr("class", "node")

    nodeItem.append('p')
      .attr('class', 'title')
      .text(function (d) {
        var progInfo = d.progInfo
        var funcInfo = progInfo[progInfo[d.scopeMeta.index].parent]
        var callInfo = d.callInfo
        if (funcInfo.type === 'Program') return 'Global'
        var call = callInfo.callee
        var funcName = funcInfo.id && funcInfo.id.name || prettyprintFunction(funcInfo)
        var callName = call.type === 'Identifier' ? call.name
            : call.id && call.id.name || prettyprintFunction(funcInfo)
        return funcName === callName ? funcName
             : funcName + ' As ' + callName
      })

    nodeItem.append('div')
      .attr('class', 'props')
    .selectAll('p.prop')
      .data(function (d, i) { 
        return Object.keys(d.scope).map(function(key) {
          return { key: key
                 , val: d.scope[key]
                 , scopeMeta: d.scopeMeta
                 , progInfo:  d.progInfo
                 }
        }) 
      })
      .enter().append("p")
      .attr('class', 'prop')
      .on('mouseover', function (d) {
        var scopeIndex = d.progInfo[d.scopeMeta.index]
        scopeIndex.__marks = scopeIndex.__marks || {}
        var markList = scopeIndex.__marks[d.key] = scopeIndex.__marks[d.key] || []
        scopeIndex[d.key].forEach(function (ident) {
          var start = ident.loc.start
          var end = ident.loc.end
          var range = new a.Range(start.line - 1, start.column, end.line - 1, end.column)
          var marker = editor.getSession().addMarker(range,"scopedVariableFinder", "text")
          markList.push(marker)
        })
      })
      .on('mouseout', function(d) {
        var marks = d.progInfo[d.scopeMeta.index].__marks
        if (!marks[d.key]) return
        marks[d.key].forEach(removeMarker)
        marks[d.key] = []
      })
      .text(function(d) {
        return d.key + ': ' + (typeof d.val === 'function' ? prettyprintFunction(d.val) : d.val)
      })
  }
})
