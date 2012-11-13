var code = 'function add(a, b) { return a + b }\nfunction makeAdder(a){\n\treturn function plus(b) {\n\t\treturn add(a, b)\n\t}\n}\nvar add1 = makeAdder(1)\nvar add2 = makeAdder(2)\nadd1(5) + add2(6);'
$('#editor').html(code)

var start = $('#start')
var stop = $('#stop')
var next = $('#next')
var prev = $('#prev')
var prog

next.click(function () {
  if (next.hasClass('disabled')) return
  prog.next()
})
start.click(function () {
  if (start.hasClass('disabled')) return
  start.addClass('disabled')
  next.removeClass('disabled')
  stop.removeClass('disabled')
  var code = editor.getSession().getValue()
  editor.setReadOnly(true)
  prog = run(code, 14)
})
stop.click(function() {
  if (stop.hasClass('disabled')) return
  stop.addClass('disabled')
  next.addClass('disabled')
  start.removeClass('disabled')
  editor.setReadOnly(false)
})

var editor = ace.edit("editor");
editor.setTheme("ace/theme/twilight");
editor.getSession().setMode("ace/mode/javascript");

/*
editor.getSession().removeMarker(marker);
ace.require(['ace/range'], function(a) {
    console.log('ACED', Range)
      range = new a.Range(0, 4, 0, 10);
        marker = editor.getSession().addMarker(range,"ace_selected_word", "text");
})
*/

var width = 300,
  height = 500;

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
    .attr("transform", "translate(0, 0)");
  var diagonal = d3.svg.diagonal()

function prettyprintFunction(fn) {
  var name = fn.name ? ' ' + fn.name : ''
  return '[Function' + name + ']'
}
function update(data) {
  vis.selectAll("path.link").remove()
  vis.selectAll("g.node").remove()
  if (data.length === 0) return console.log('returning')

  var nodes = tree.nodes(data);

  if (data.length > 1) {
  var link = vis.selectAll("path.link")
    .data(tree.links(nodes))
    .enter().append("path")
    .attr("class", "link")
    .attr("d", diagonal);
  }

  var node = vis.selectAll("g.node")
    .data(nodes)

  node.exit().remove()

  var nodeGroup = node.enter().append("g")
    .attr("class", "node")
    .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
    

  nodeGroup.append("rect")
    .attr("height", function (d) { return Object.keys(d[0]).length * 20 })
    .attr("width", 225)
    .attr('x', -100)
    .attr('y', 1)

  nodeGroup.selectAll("text.props")
    .data(function (d, i) { return Object.keys(d[0]).map(function(key) { return [key, d[0][key]] }) })
    .enter().append("text")
    .attr("class", 'props')
    .attr("dx", -90)
    .attr("dy", function (d, i) { return i * 20 + 14 })
    .attr("text-anchor", "before")
    .text(function(d) { return d[0] + ': ' + (typeof d[1] === 'function' ? prettyprintFunction(d[1]) : d[1]) });
}
