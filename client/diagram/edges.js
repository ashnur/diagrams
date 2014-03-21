void function(){

  var Set = require('../set.js')
  var Pathways = require('../pathway.js')

  var translate = require('./translate.js')
  var V = require('./vectors.js')
  var intersect = require('./intersect.js')

  function point(x, y){
    return { x: x || 0, y: y || 0 }
  }

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
    var rw = W / n
    var rh = H / n
    while ( --n > 0 ) {
      points.push(translate([ n * rw, n * rh ], side[0]))
    }
    points.reverse()
    return points
  }

  function get_rank_dim(margin, key, node){
    return Math.ceil(node[key] / margin) * margin
  }

  function num_comp(a, b){
    return a > b ?  1
         : a < b ? -1
         :          0
  }

  function sort_nodes_in_rank(dir, a, b){
    switch ( dir ) {
      case 'TB':
        return a.x < b.x ? -1
             : a.x > b.x ?  1
             :              0
      case 'BT':
        return a.x > b.x ? -1
             : a.x < b.x ?  1
             :              0
      case 'LR':
        return a.y < b.y ? -1
             : a.y > b.y ?  1
             :              0
      case 'RL':
        return a.y > b.y ? -1
             : a.y < b.y ?  1
             :              0
    }

  }

  function count_exits(pathways, source_id){
    var count = 0, finds = []

    pathways.forEach(function(p, pi){
      p.forEach(function(w, wi){
        if ( w.sources.has(source_id) ) {
          finds.push([pi, wi, w])
          count++
        }
      })
    })
    return count
  }

  module.exports = function(outgraph, diagram){
    var g = outgraph.graph()
    var rankDir = g.rankDir
    var vertical = rankDir == 'TB' || rankDir == 'BT'
    var reversed = rankDir == 'BT' || rankDir == 'RL'
    var rankSep = diagram.graph.config.rankSep
    var rank_sorter = sort_nodes_in_rank.bind(null, rankDir)
    var level_dir = vertical ? 'width' : 'height'
    var ranks_positions = []
    var ranks = []
    var norm_rank_dim = get_rank_dim.bind(null, diagram.config.rank_detection_error_margin, vertical ? 'y' : 'x' )

    function get_junction(path, level){
      return {
        x: vertical ? level : path
      , y: vertical ? path : level
      }
    }

    outgraph.eachNode(function(id, node){
      var rdim = norm_rank_dim(node)
      if ( ranks_positions.indexOf(rdim) == -1 ) {
        ranks_positions.push(rdim)
        ranks_positions.sort(num_comp)
      }
      node.rdim = rdim
    })

    if ( reversed ) {
      ranks_positions.reverse()
    }

    outgraph.eachNode(function(id, node){
      var r = ranks_positions.indexOf(node.rdim)
      node.true_rank = r
      if ( ranks[r] == null ) ranks[r] = []
      ranks[r].push(node)
    })

    ranks.forEach(function(r, i){
      ranks[i].sort(rank_sorter)
    })

    var edges_in_ranks = []
    var pathway_count = ranks.length + 1
    for ( var i = 0; i < pathway_count; i++ ) {
      edges_in_ranks[i] = Set.make()
    }

    outgraph.eachNode(function(id, node){

      var node_rank = node.true_rank
      outgraph.outEdges(id).forEach(function(out_edge_id){
        edges_in_ranks[node_rank + 1].add(out_edge_id)
      })

    })

    var lanes = []
    edges_in_ranks.forEach(function(rank, idx){
      lanes[idx] = Pathways.make()
      rank.forEach(function(edge_id){
        lanes[idx].add( outgraph.source(edge_id)
                      , edge_id
                      , outgraph.target(edge_id))
      })
    })

    outgraph.eachNode(function(id, node){
      var exits = divide_side(side_from_direction(node, rankDir[1]), count_exits(lanes, id) + 1)
      node.exits = exits
      node.entries = divide_side(side_from_direction(node, rankDir[0]), 2)
    })


    var fskips = []
    var bskips = []
    var edges = []
    var skipsep = diagram.config.edgeWidth
    lanes.forEach(function(lane, rank_nr){
      var pws  = []
      var pathways_count = lane.size()
      var psep = rankSep / (pathways_count + 1)
      lane.forEach(function(pathway, pw_idx){
        var tr = psep * (pw_idx + 1)
        if ( reversed ) tr  = tr * -1
        var tr_exit = translate.bind(null, vertical ? [0, tr] : [tr, 0])
        var tr_entry = translate.bind(null, vertical ? [0, tr - (reversed ? -1 * rankSep : rankSep)] : [tr - (reversed ? -1 * rankSep : rankSep), 0])
        var pw = []
        pathway.sources.forEach(function(source_id){
          var source = outgraph.node(source_id)
          if ( source.true_rank == rank_nr - 1 ) {
            source.spwi = pw_idx
            var junctions = source.exits.map(function(exit, idx){
              var p = tr_exit(exit)
              p.node = exit
              source.exits[idx].junction = p
              return p
            })
            pw = pw.concat(junctions)
          }
        })
        pathway.targets.forEach(function(target_id){
          var target = outgraph.node(target_id)
          if ( target.true_rank == rank_nr ) {
            target.tpwi = pw_idx
            var junctions = target.entries.map(function(entry, idx){
              var p = tr_entry(entry)
              var vector = [entry.x - p.x, entry.y - p.y]
              var s = V.scale(vector, -1.2 * diagram.config.edgeWidth / V.magnitude(vector))
              p.cut = translate(s, entry)
              p.node = entry
              p.entry = true
              target.entries[idx].junction = p
              return p
            })
            pw = pw.concat(junctions)
          }
        })
        pws[pw_idx] = pw
      })
      edges[rank_nr] = pws
    })

    edges.skips = []
    lanes.forEach(function(lane, rank_nr){
      lane.forEach(function(pathway, pw_idx){
        pathway.edges.forEach(function(edge_id){
          var tid = outgraph.target(edge_id)
          var target = outgraph.node(tid)
          var target_rank = target.true_rank
          var sid = outgraph.source(edge_id)
          var source = outgraph.node(sid)
          var source_rank = source.true_rank
          var rd = target_rank - source_rank
          if ( rd > 1 && fskips.indexOf(pathway) == -1 ) {
            fskips.push(pathway)
            var level_amount = fskips.length * skipsep
            var level = reversed ? 0 - level_amount : g[level_dir] + level_amount
            var source_junction = get_junction(source.exits[0].junction[vertical ? 'y' : 'x'], level )
            edges[source.true_rank + 1][source.spwi].push(source_junction)
            var target_junction = get_junction(target.entries[0].junction[vertical ? 'y' : 'x'], level )
            edges[target.true_rank][target.tpwi].push(target_junction)
            edges.skips.push([source_junction, target_junction])
          }
          if ( rd < 0 && bskips.indexOf(pathway) == -1 ) {
            bskips.push(pathway)
            var level_amount = bskips.length * skipsep
            var level = reversed ? g[level_dir] + level_amount : 0 - level_amount
            var source_junction = get_junction(source.exits[0].junction[vertical ? 'y' : 'x'], level )
            edges[source.true_rank + 1][source.spwi].push(source_junction)
            var target_junction = get_junction(target.entries[0].junction[vertical ? 'y' : 'x'], level )
            edges[target.true_rank][target.tpwi].push(target_junction)
            edges.skips.push([source_junction, target_junction])
          }
        })
      })
    })


    lanes.forEach(function(lane, rank_nr){
      lane.values.sort(function(a, b){
        console.log(a, b)
      })
    })

    lanes.forEach(function(lane, rank_nr){
      lane.forEach(function(pathway, pw_idx){
        edges[rank_nr][pw_idx].sort(rank_sorter)
      })
    })

    edges.growth = (fskips.length + bskips.length) * skipsep


    return edges
  }

}()
