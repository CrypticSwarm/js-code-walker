ace.require(['ace/range'], function progInit(a) {
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
      return d.caller ? [d.caller] : null;
    })

  function update(data, valInfo, curSha, shaList) {
    vis.selectAll("div.node").remove()
    if (!data) return
    var nodes = stackTree.nodes(data)

    if (curExpressionMarker) removeMarker(curExpressionMarker)
    curExpressionMarker = setMarker('curExpression', shaList[curSha])

    curExpressionInfo.classed('hidden', false).select('.expType').text(shaList[curSha].type)

    var value = 'No Value'
    if (valInfo.hasVal) {
      if (typeof valInfo.value === 'function') value = prettyprintFunction(valInfo.value)
      else value = valInfo.value
    }
    curExpressionInfo.select('.expVal').text(value)

    var node = vis.selectAll(".node")
      .data(nodes)

    node.exit().remove()

    var nodeItem = node.enter().append('div')
      .attr("class", "node")

    nodeItem.selectAll('p.title').data(function (d, i) {
      var funcInfo = d.progInfo[d.progInfo[d.scopeMeta.index].parent]
      return [{ scopeMeta: d.scopeMeta
             , funcInfo: funcInfo
             , callInfo: d.callInfo
             , key: 'func'
             , markIndex: { func: [funcInfo] }
             , marks: {}
             }]
    })
      .enter()
      .append('p')
      .attr('class', 'title')
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

    nodeItem.append('div')
      .attr('class', 'props')
    .selectAll('p.prop')
      .data(function (d, i) { 
        var marks = {}
        var markIndex = d.progInfo[d.scopeMeta.index]
        return Object.keys(d.scope).map(function setupPropData(key) {
          return { key: key
                 , val: d.scope[key]
                 , scopeMeta: d.scopeMeta
                 , progInfo:  d.progInfo
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
