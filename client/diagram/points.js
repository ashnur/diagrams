void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var translate = require('../util/translate.js')

var log = console.log.bind(console)

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

  function divide_side(side, n){
    var X1 = side[0].x
    var Y1 = side[0].y
    var X2 = side[1].x
    var Y2 = side[1].y

    var W = X2 - X1
    var H = Y2 - Y1
    var rw = W / (n + 1)
    var rh = H / (n + 1)
    return translate([ n * rw, n * rh ], side[0])
  }

  function calculate(point){
    return divide_side(
            side_from_direction(point.relative
                              , point.rankDir[point.type == 'exit' ? 1 : 0])
          , point.list.length)
  }

  function get_x(point){ return calculate(point).x }

  function get_y(point){ return calculate(point).y }

  function index(point){ return point.list.indexOf(point) }

  module.exports = viral.extend({
    init: function(type, relative, list, rankDir, match){
      this.relative = relative
      this.list = list
      this.rankDir = rankDir
      this.match = match
      this.type = type

    }
  , x: enslave(get_x)
  , y: enslave(get_y)
  , static: enslave(calculate)
  })

}()
