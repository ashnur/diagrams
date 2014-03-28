void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var translate = require('../util/translate.js')

  function orientate(rankDir, a, b){
    return (rankDir == 'TB' || rankDir == 'BT') ? a : b
  }

  function calculate(point){

    var si = index(point)
    var rankDir = point.rankDir
    var rankSep = point.rankSep
    var reversed = rankDir == 'BT' || rankDir == 'RL'
    var tr = (reversed ? -1 : 1) * psep(point) * (si + 1)
    var tr_sep = tr - (reversed ? -1 * rankSep : rankSep)

    var vector =  point.relative.type == 'exit' ? orientate(rankDir, [0, tr], [tr, 0])
               :                                  orientate(rankDir, [0, tr_sep ], [tr_sep, 0])

    return translate(vector, point.relative.static())
  }

  function get_x(point){ return calculate(point).x }

  function get_y(point){ return calculate(point).y }

  function index(point){
    return list(point).indexOf(point.relative)
  }

  function list(point){
    return point.rank.steps.map(function(step){
      return point.relative.type == 'exit' ? step[0] : step[step.length - 1]
    })
  }

  function psep(point){
    var rank = point.rank
log(rank.path_count)
    return point.rankSep / rank.path_count
    return point.rankSep / (rank.entries.length + rank.exits.length - rank.steps.length + 1)
  }

  function remove(point){
    return point.rank.steps.splice(index(point), 1)
  }

  module.exports = viral.extend({
    init: function(type, relative, rank, rankDir, rankSep){
      this.type = type
      this.relative = relative
      this.rank = rank
      this.rankDir = rankDir
      this.rankSep = rankSep

    }
  , x: enslave(get_x)
  , y: enslave(get_y)
  , static: enslave(calculate)
  , remove: enslave(remove)
  })

}()
