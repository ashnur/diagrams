void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var translate = require('../util/translate.js')

  function side_from_direction(node, d){
    var w  = node.width / 2
    var h  = node.height / 2
    var tl = translate([-w, -h], node)
    var tr = translate([ w, -h], node)
    var bl = translate([-w,  h], node)
    var br = translate([ w,  h], node)
    switch ( d ) {
      case 'L' :
        return [tl, bl]
      case 'R' :
        return [tr, br]
      case 'B' :
        return [bl, br]
      case 'T' :
        return [tl, tr]
    }
  }

  function divide_side(side, parts, n){
    n = n + 1
    var X1 = side[0].x
    var Y1 = side[0].y
    var X2 = side[1].x
    var Y2 = side[1].y

    var W = X2 - X1
    var H = Y2 - Y1
    var rw = W / (parts + 1)
    var rh = H / (parts + 1)
    return translate([ n * rw, n * rh ], side[0])
  }

  function calculate(point){
    return divide_side(
            side_from_direction(point.node
                              , point.rankDir[point.type == 'exit' ? 1 : 0])
          , list(point).length
          , index(point))
  }

  function get_x(point){ return calculate(point).x }

  function get_y(point){ return calculate(point).y }

  function index(point){
    return list(point).indexOf(point)
  }

  function list(point){
    return point.type == 'exit' ? point.node.exit_points : point.node.entry_points
  }

  function remove(point){
    return list(point).splice(index(point), 1)
  }

  function get_gap_number(point){
    return point.node.true_rank + (point.type == 'entry' ? 0 : 1)
  }

  function get_other_end(point){
    var pair_node = point.pair_node
    var ppt = point.type == 'entry' ? 'exit_points' : 'entry_points'
    var pnt = point.type == 'entry' ? 'exits' : 'entries'
    var pair_point = pair_node[ppt][pair_node[pnt][point.node.id]]
    return pair_point
  }

  module.exports = viral.extend({
    init: function(type, node, rankDir, pair_node){
      this.type = type
      this.node = node
      this.pair_node = pair_node
      this.exit = type == 'exit' ? node : pair_node
      this.rankDir = rankDir
      this.entry = type == 'entry' ? node : pair_node
      this.edge_id = node.graph.incidentEdges(node.id, pair_node.id)
    }
  , x: enslave(get_x)
  , y: enslave(get_y)
  , static: enslave(calculate)
  , remove: enslave(remove)
  , gap_number: enslave(get_gap_number)
  , other_endpoint: enslave(get_other_end)
  })

}()
