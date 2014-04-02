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

    var vector =  point.node_point.type == 'exit' ? orientate(rankDir, [0, tr], [tr, 0])
               :                                  orientate(rankDir, [0, tr_sep ], [tr_sep, 0])

    return translate(vector, point.node_point.static())
  }

  function get_x(point){ return calculate(point).x }

  function get_y(point){ return calculate(point).y }

  function index(point){
    var l = list(point)
    var q = point.type == 'step' && point.node_point.type == 'entry' ? point.exit_junction
          : point
    var r = l.indexOf(q)
    return r
  }

  function get_gap(point){
    return point.type == 'entry' && point.skipDir == 'forward'  ? point.gap.get_gaps()[point.node_point.node.true_rank]
         : point.type == 'entry' && point.skipDir == 'backward' ? point.gap.get_gaps()[point.node_point.node.true_rank]
         : point.gap
  }

  function give_value(node){
    return (node.true_rank + 1) * (node.x + node.y)
  }

  function list(point){
    var gn = point.gap_number()
    var l = point.gap.edges()
                 .reduce(function juncs(js, s){
                    js = js.concat(s.filter(function is_junc(p){
                      return p.init == Junction.init
                             && p.gap_number() == gn
                             && ! (p.type == 'step' && p.node_point.type == 'entry')
                    }))
                    return js
                  }, [])
                 .filter(nodups)
                 .sort(function(a, b){ return a.order < b.order })
    return l
  }

  function psep(point){
    var l = list(point)

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
    init: function(type, node_point, si, gap, rankDir, rankSep, skipDir, exit_junction){
      this.type = type
      this.node_point = node_point
      this.exit_point = node_point.type == 'exit' ? node_point : node_point.other_endpoint()
      this.entry_point = node_point.type == 'entry' ? node_point : node_point.other_endpoint()
      this.si = si
      this.gap = gap
      this.rankDir = rankDir
      this.rankSep = rankSep
      this.skipDir = skipDir
      this.id = uid()
      this.graph = node_point.node.graph
      this.edge_id = this.graph.incidentEdges(this.exit_point.node.id, this.entry_point.node.id)[0]
      this.order = this.graph.edges().indexOf(this.edge_id)
      this.exit_junction = exit_junction
    }
  , x: enslave(get_x)
  , y: enslave(get_y)
  , static: enslave(calculate)
  , remove: enslave(remove)
  , gap_number: enslave(get_gap_number)
  })

  module.exports = Junction

}()
