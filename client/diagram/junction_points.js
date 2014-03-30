void function(){
  var uid = require('../util/unique_id.js')
  var viral = require('viral')
  var enslave = require('enslave')
  var translate = require('../util/translate.js')
var log = console.log.bind(console)

  function nodups(r, i, rs){ return rs.indexOf(r) === i }

  function orientate(rankDir, a, b){
    return (rankDir == 'TB' || rankDir == 'BT') ? a : b
  }

  function calculate(point){

    var idx = index(point) + 1
    var rankDir = point.rankDir
    var rankSep = point.rankSep
    var reversed = rankDir == 'BT' || rankDir == 'RL'
    var tr = (reversed ? -1 : 1) * psep(point) * idx
    var tr_sep = tr - (reversed ? -1 * rankSep : rankSep)

    var vector =  point.relative.type == 'exit' ? orientate(rankDir, [0, tr], [tr, 0])
               :                                  orientate(rankDir, [0, tr_sep ], [tr_sep, 0])

    return translate(vector, point.relative.static())
  }

  function get_x(point){ return calculate(point).x }

  function get_y(point){ return calculate(point).y }

  function index(point){
    var l = list(point)
    var r = l.indexOf(point.type == 'step' && point.relative.type == 'entry' ? point.origin : point)
    if ( r == -1 ) log( l )
    return r
  }

  function get_gap(point){
    return point.type == 'entry' && point.skipDir == 'forward'  ? point.gap.get_gaps()[point.relative.relative.true_rank]
         : point.type == 'exit'  && point.skipDir == 'backward' ? point.gap.get_gaps()[point.relative.relative.true_rank]
         : point.gap
  }

  function is_junc(gn, p){
    return p.init === Junction.init
           && p.gap_number() == gn
           && ! (p.type == 'step' && p.relative.type == 'entry')
  }
  function juncs(gi, js, s){ js = js.concat(s.filter(is_junc.bind(null, gi))); return js }

  function list(point){
    var junctions = juncs.bind(null, point.gap_number())
    var l = point.gap.edges().reduce(junctions, []).filter(nodups)
    return l
  }

  function psep(point){
    var l = list(point)
    //log( gap, l.length)
    return point.rankSep / (l.length + 1)
  }

  function remove(point){
    var gap = get_gap(point)
    return gap.steps.splice(index(point), 1)
  }

  function get_gap_number(point){
    return get_gap(point).index
  }

  var Junction =  viral.extend({
    init: function(type, relative, si, gap, rankDir, rankSep, origin, skipDir){
      this.type = type
      this.relative = relative
      this.si = si
      this.gap = gap
      this.rankDir = rankDir
      this.rankSep = rankSep
      this.origin = origin
      this.skipDir = skipDir
      this.id = uid()
    }
  , x: enslave(get_x)
  , y: enslave(get_y)
  , static: enslave(calculate)
  , remove: enslave(remove)
  , gap_number: enslave(get_gap_number)
  })

  module.exports = Junction

}()
