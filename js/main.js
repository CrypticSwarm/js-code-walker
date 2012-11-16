ace.require(['ace/range'], function(a) {
  var Range = a.Range
  var code = 'function add(a, b) { return a + b }\nfunction makeAdder(a){\n\treturn function plus(b) {\n\t\treturn add(a, b)\n\t}\n}\nvar add1 = makeAdder(1)\nvar add2 = makeAdder(2)\nadd1(5) + add2(6)'
  d3.select('#editor').html(code)

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

  var width = 300,
    height = 600

  var tree = d3.layout.tree()
    .size([width, height - 160])
    .children(function (d) {
      var undefined
      return d.length > 1 ? [d.slice(1)] : undefined
    })
    var vis = d3.select("#visualContainer").append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", "translate(0, 0)")
    var diagonal = d3.svg.diagonal()

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
    vis.selectAll("path.link").remove()
    vis.selectAll("g.node").remove()
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

    var nodes = tree.nodes(data)

    if (data.length > 1) {
    var link = vis.selectAll("path.link")
      .data(tree.links(nodes))
      .enter().append("path")
      .attr("class", "link")
      .attr("d", diagonal)
    }


    var node = vis.selectAll("g.node")
      .data(nodes)

    node.exit().remove()

    var nodeGroup = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")" })
      

    nodeGroup.append("rect")
      .attr("width", 225)
      .attr('height', 20)
      .attr('x', -100)
      .attr('y', 1)
      .attr('rx', 10)
      .attr('ry', 10)

    nodeGroup.append('text')
      .attr('dx', 0)
      .attr('dy', 14)
      .attr("text-anchor", "middle")
      .text(function (d) {
        var progInfo = d[0].progInfo
        var funcInfo = progInfo[progInfo[d[0].scopeMeta.index].parent]
        var callInfo = d[0].callInfo
        if (funcInfo.type === 'Program') return 'Global'
        var call = callInfo.callee
        var funcName = funcInfo.id && funcInfo.id.name || prettyprintFunction(funcInfo)
        var callName = call.type === 'Identifier' ? call.name
            : call.id && call.id.name || prettyprintFunction(funcInfo)
        return funcName === callName ? funcName
             : funcName + ' As ' + callName
      })

    nodeGroup.append("rect")
      .attr("height", function (d) { return Object.keys(d[0].scope).length * 20 })
      .attr("width", 225)
      .attr('x', -100)
      .attr('y', 23)
      .attr('rx', 10)
      .attr('ry', 10)

    nodeGroup.selectAll("text.props")
      .data(function (d, i) { 
        return Object.keys(d[0].scope).map(function(key) {
          return { key: key
                 , val: d[0].scope[key]
                 , scopeMeta: d[0].scopeMeta
                 , progInfo:  d[0].progInfo
                 }
        }) 
      })
      .enter().append("text")
      .attr("class", 'props')
      .attr("dx", -90)
      .attr("dy", function (d, i) { return i * 20 + 36 })
      .attr("text-anchor", "before")
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
