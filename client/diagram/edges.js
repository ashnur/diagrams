void function(){

  var zippy = require('zippy')
  var zip = zippy.zip
  var zipWith = zippy.zipWith
  var log = console.log.bind(console)
  var uid = require('../util/unique_id.js')
  var translate = require('../util/translate.js')

  function node_from_id(graph, id){
    var n = graph.node(id)
    n.id = id
    return n
  }

//  function edge_from_id(graph, id){ return graph.edge(id) }

  function point(x, y){ return { x: x || 0, y: y || 0 } }

  function side_from_direction(node, d){
    var c = point(node.x, node.y)
    var w = node.width / 2
    var h = node.height / 2
    var tl = translate([-w, -h], c)
    var tr = translate([w, -h], c)
    var bl = translate([-w, h], c)
    var br = translate([w, h], c)
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
    var points = []
    var rw = W / (n + 1)
    var rh = H / (n + 1)
    var i = 0
    while ( i++ < n ) {
      points.push(translate([ i * rw, i * rh ], side[0]))
    }
    return points
  }

  function get_nodes(diagram, layout){
    var nodes = []
    var g = layout.graph()
    var rankDir = g.rankDir
    var vertical = rankDir == 'TB' || rankDir == 'BT'
    var rank_attr = vertical ? 'y' : 'x'
    var node_rank_dimension = get_rank_dimension.bind(null, diagram.config.rank_detection_error_margin, rank_attr )
    var node_from_layout = node_from_id.bind(null, layout)
    var edge_from_layout = node_from_id.bind(null, layout)
    layout.eachNode(function(id, node){
      node.rdim = Number(node_rank_dimension(node))
      node.targets = layout.outEdges(id)
                           .map(function(e_id){ return layout.target(e_id) })
                           .map(node_from_layout)
      node.sources = layout.inEdges(id)
                           .map(function(e_id){ return layout.source(e_id) })
                           .map(node_from_layout)
      nodes.push(node)
    })
    return nodes
  }

  function get_rank_dimension(margin, key, node){
    return Math.ceil(node[key] / margin) * margin
  }

  function create_segment(start, end){
    return { id: uid(), x1: start.x, y1:start.y, x2: end.x, y2: end.y}
  }

  function get_junction(vertical, path, level){
    return {
      x: vertical ? level : path
    , y: vertical ? path : level
    }
  }

  function idx_to_id(s, t, i){
    s[t.id] = i
    return s
  }

  module.exports = function calculate_edges(diagram, layout){
    var rankSep = diagram.config.layout_config.rankSep
    var g = layout.graph()
    var rankDir = g.rankDir
    var reversed = rankDir == 'BT' || rankDir == 'RL'
    var vertical = rankDir == 'TB' || rankDir == 'BT'
    var level_dir = vertical ? 'width' : 'height'
    var rank_attr = vertical ? 'y' : 'x'
    var nodes = get_nodes(diagram, layout)
    var skipsep = diagram.config.skipSep
    var i = nodes.reduce(function(o, node){
      var v = node.rdim
      ;(o[v] || (o[v] = [])).push(node)
      return o
    }, {})
    var ranks = Object.keys(i).sort(function(a, b){ return +a - +b })
                              .map(function(k){ return this[k] }, i)
    nodes = nodes.map(function(n){
      var exit_points = divide_side(side_from_direction(n, rankDir[1]), n.targets.length)
      n.exit_points = exit_points.map(function(p, i){
        p.tid = n.targets[i].id
        p.node = n
        return p
      })
      n.exits = n.targets.reduce(idx_to_id, {})

      var entry_points = divide_side(side_from_direction(n, rankDir[0]), n.sources.length)
      n.entry_points = entry_points.map(function(p, i){
        p.sid = n.sources[i].id
        p.node = n
        return p
      })
      n.entries = n.sources.reduce(idx_to_id, {})
      return n
    })

    var nodes_by_id = nodes.reduce(function(nids, n){
      nids[n.id] = n
      return nids
    }, {})

    ranks.push([])

    ranks = ranks.map(function(rank, rn){
      return {
        nodes: rank.map(function(n){
          n.true_rank = rn
          return n
        })
      , exits: (rn != 0 ? ranks[rn - 1] : []).reduce(function(s, n){
          s = s.concat(n.exit_points)
          return s
        }, [])
      , entries: rank.reduce(function(s, n){
          s = s.concat(n.entry_points)
          return s
        }, [])
      , node_ids: rank.map(function(n){ return n.id })
      }
    }).map(function(rank, rn){

      rank.steps = rank.exits.filter(function(exit, i){
        return (rank.node_ids).indexOf(exit.tid) > -1
      }).map(function(exit){
        var entry = nodes_by_id[exit.tid]
        return {
          exit: exit
        , entry: entry.entry_points[entry.entries[exit.node.id]]
        }
      })

      rank.forward_skips = rank.exits.filter(function(exit, i){
        return nodes_by_id[exit.tid].true_rank - rn > 0
      }).map(function(exit){
        var entry = nodes_by_id[exit.tid]
        return {
          exit: exit
        , entry: entry.entry_points[entry.entries[exit.node.id]]
        }
      })

      rank.backward_skips = rank.entries.filter(function(entry, i){
        return nodes_by_id[entry.sid].true_rank - rn >= 0
      }).map(function(entry){
        var exit = nodes_by_id[entry.sid]
        return {
          exit: exit.exit_points[exit.exits[entry.node.id]]
        , entry: entry
        }
      })

      function not_in_steps(p){
        return rank.steps.every(function(s){ return s.exit != p && s.entry != p})
      }

      rank.skippoints = rank.exits.filter(not_in_steps).concat(rank.entries.filter(not_in_steps))

      return rank
    }).map(function(rank){
      rank.psep = rankSep / (rank.entries.length + rank.exits.length - rank.steps.length + 1)
      rank.steps = rank.steps.map(function(s, si){
        var tr = rank.psep * (si + 1)
        if ( reversed ) tr  = tr * -1
        s.tr = tr
        return s
      })

      rank.skippoints = rank.skippoints.map(function(point, i){
        var tr = rank.psep * (i + rank.steps.length + 1)
        if ( reversed ) tr  = tr * -1
        point.tr = tr
        return point
      })

      return rank
    })

    var pathways = ranks.map(function(rank, rn){
      var psep = rank.psep

      var lane = rank.steps.map(function(s, si){
        var tr = s.tr
        var tr_exit = translate.bind(null, vertical ? [0, tr] : [tr, 0])
        var tr_entry = translate.bind(null, vertical ? [0, tr - (reversed ? -1 * rankSep : rankSep)]
                                                     : [tr - (reversed ? -1 * rankSep : rankSep), 0])
        var p1 = tr_exit(s.exit)
        var p2 = tr_entry(s.entry)
        return [ create_segment(s.exit, p1)
               , create_segment(p1, p2)
               , create_segment(p2, s.entry)]

      }).concat(rank.forward_skips.map(function(s, si){
        var level_amount = (ranks.slice(0, rn).reduce(function(tsc, r){
                              return tsc + r.forward_skips.length
                            }, 1) + si) * skipsep
        var level = reversed ? 0 - level_amount : g[level_dir] + level_amount

        var tr = s.exit.tr
        var trt = s.entry.tr
        var tr_exit = translate.bind(null, vertical ? [0, tr] : [tr, 0])
        var tr_entry = translate.bind(null, vertical ? [0, trt - (reversed ? -1 * rankSep : rankSep)]
                                                     : [trt - (reversed ? -1 * rankSep : rankSep), 0])
        var p1 = tr_exit(s.exit)
        var p2 = get_junction(vertical, p1[rank_attr], level)
        var p4 = tr_entry(s.entry)
        var p3 = get_junction(vertical, p4[rank_attr], level )
        return [
                 create_segment(s.exit, p1)
               , create_segment(p1, p2)
               , create_segment(p2, p3)
               , create_segment(p3, p4)
               , create_segment(p4, s.entry)
               ]

      })).concat(rank.backward_skips.map(function(s, si){
        var level_amount = (ranks.slice(0, rn).reduce(function(tsc, r){
                              return tsc + r.backward_skips.length
                            }, 1) + si) * skipsep
        var level = reversed ? g[level_dir] + level_amount : 0 - level_amount
        var tr = s.exit.tr
        var trt = s.entry.tr
        var tr_exit = translate.bind(null, vertical ? [0, tr] : [tr, 0])
        var tr_entry = translate.bind(null, vertical ? [0, trt - (reversed ? -1 * rankSep : rankSep)]
                                                     : [trt - (reversed ? -1 * rankSep : rankSep), 0])
        var p1 = tr_exit(s.exit)
        var p2 = get_junction(vertical, p1[rank_attr], level)
        var p4 = tr_entry(s.entry)
        var p3 = get_junction(vertical, p4[rank_attr], level )
        return [
                 create_segment(s.exit, p1)
               , create_segment(p1, p2)
               , create_segment(p2, p3)
               , create_segment(p3, p4)
               , create_segment(p4, s.entry)
               ]

      }))
      return lane
    })

    pathways.growth = ranks.reduce(function(ss, r){ return ss + r.forward_skips.length + r.backward_skips.length}, 0) * skipsep

    log(pathways)

    return pathways
  }

}()
/*
*/
