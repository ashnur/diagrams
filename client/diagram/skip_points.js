void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var translate = require('../util/translate.js')

  var log = console.log.bind(console)

  function orientate(rankDir, a, b){
    return (rankDir == 'TB' || rankDir == 'BT') ? a : b
  }

  function calculate(point){
    var s_length = point.gap.get_gaps().slice(0, index(point)).reduce(function(tsc, r){
      return tsc + (point.type == 'forward' ? r.forward_skips : r.backward_skips).length
    }, 1)

    var level_amount = (s_length + point.sidx) * point.skipsep
    var level = point.rev ? 0 - level_amount : point.g[point.level_dir] + level_amount

    return {
      x: orientate(point.rankDir, level, point.relative[point.rank_attr]())
    , y: orientate(point.rankDir, point.relative[point.rank_attr](), level)
    }
  }

  function get_x(point){ return calculate(point).x }

  function get_y(point){ return calculate(point).y }

  function index(point){ return point.gap.get_gaps().indexOf(point.gap) }

  function get_gap_number(point){
    return point.relative.gap_number()
  }

  module.exports = viral.extend({
    init: function(type, relative, gap, sidx, rankDir, skipsep, rev, g, rank_attr, level_dir){
      this.type = type
      this.relative = relative
      this.gap = gap
      this.sidx = sidx
      this.rankDir = rankDir
      this.skipsep = skipsep
      this.rev = rev
      this.g = g
      this.rank_attr = rank_attr
      this.level_dir = level_dir
    }
  , x: enslave(get_x)
  , y: enslave(get_y)
  , static: enslave(calculate)
  , gap_number: enslave(get_gap_number)
  })

}()
