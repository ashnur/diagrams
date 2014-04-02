void function(){

  var zip = require('../util/zips.js').zip
  var uid = require('../util/unique_id.js')
  var translate = require('../util/translate.js')
  var Gaps = require('./gaps.js')
  var side_points = require('./side_points.js')
  var junction_points = require('./junction_points.js')
  var skip_points = require('./skip_points.js')

var log = console.log.bind(console)

  function node_from_id(graph, id){
    var n = graph.node(id)
    n.id = id
    n.graph = graph
    return n
  }

  function get_nodes(diagram, layout){
    var nodes = []
    var g = layout.graph()
    var rankDir = g.rankDir
    var vertical = rankDir == 'TB' || rankDir == 'BT'
    var rank_attr = vertical ? 'y' : 'x'
    var node_rank_dimension = get_rank_dimension.bind(null, diagram.config.rank_detection_error_margin, rank_attr)
    var node_from_layout = node_from_id.bind(null, layout)
    var edge_from_layout = node_from_id.bind(null, layout)
    layout.eachNode(function(id, node){
      node.rdim = Number(node_rank_dimension(node))
      node.targets = layout.outEdges(id)
                           .map(layout.target.bind(layout))
                           .map(node_from_layout)
      node.sources = layout.inEdges(id)
                           .map(layout.source.bind(layout))
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

  function segments(steps, s){
    return steps.concat(zip(s, s.slice(1)).map(function(j){
      return create_segment(j[0].static(), j[1].static())
    }))
  }

  function idx_to_id(s, t, i){
    s[t.id] = i
    return s
  }

  function sort_by_orientation(vertical, a, b){ return vertical ? a : b }

  function get_gaps_edges(gaps){
    return gaps.reduce(function(edges, edge){
      return edges.concat(edge.forward_skips.concat(edge.steps, edge.backward_skips))
    }, [])
  }

  module.exports = function calculate_edges(diagram, layout){


    function steps(gap, exit_point, si){
      var entry_node = exit_point.pair_node
      var entry_point = exit_point.other_endpoint()
      var exit_junction = junction_points.make('step', exit_point, si, gap, rankDir, rankSep)
      return [
        exit_point
      , exit_junction
      , junction_points.make('step', entry_point, si, gap, rankDir, rankSep, null, exit_junction)
      , entry_point
      ]
    }

    function skips(gap, direction, exit_point, si){
      var entry_node = exit_point.pair_node
      var entry_point = exit_point.other_endpoint()
      var exit_junction = junction_points.make('exit', exit_point, si, gap, rankDir, rankSep, direction)
      var entry_junction = junction_points.make('entry', entry_point, si, gap, rankDir, rankSep, direction)
      var rev = direction == 'forward' ? reversed : ! reversed
      var skip = [
        exit_point
      , exit_junction
      , skip_points.make('forward',  exit_junction, gap, si, rankDir, skipsep, rev, g, rank_attr, level_dir)
      , skip_points.make('forward', entry_junction, gap, si, rankDir, skipsep, rev, g, rank_attr, level_dir)
      , entry_junction
      , entry_point
      ]
      return skip
    }

    var rankSep = diagram.config.layout_config.rankSep
    var g = layout.graph()
    var rankDir = g.rankDir
    var reversed = rankDir == 'BT' || rankDir == 'RL'
    var vertical = rankDir == 'TB' || rankDir == 'BT'
    var orientate = sort_by_orientation.bind(null, vertical)
    var level_dir = vertical ? 'width' : 'height'
    var rank_attr = vertical ? 'y' : 'x'
    var nodes = get_nodes(diagram, layout)
    var skipsep = diagram.config.skipSep

    var nodes_keys = nodes.reduce(function(o, node){
      var v = node.rdim
      ;(o[v] || (o[v] = [])).push(node)
      return o
    }, {})

    nodes = nodes.map(function(n){
      n.exits = n.targets.reduce(idx_to_id, {})
      n.exit_points = n.targets.map(function(target_node){ return side_points.make('exit', n, rankDir, target_node) })
      n.entries = n.sources.reduce(idx_to_id, {})
      n.entry_points = n.sources.map(function(source_node){ return side_points.make('entry', n, rankDir, source_node) })
      return n
    })

    var ranks =  Object.keys(nodes_keys).sort(function(a, b){ return +a - +b })
                                        .map(function(k, i){
                                          this[k].map(function(n){ n.true_rank = i; return n})
                                          return this[k]
                                        }, nodes_keys)
    var gaps = Array(ranks.length + 1)

    ranks.reduce(function(p,a,i) {
      gaps[i] = Gaps.extend({get_gaps: function(){ return gaps}})
                    .make(p, a, i, steps, skips)

      return a
    }, [])

    gaps[ranks.length] = Gaps.extend({get_gaps: function(){ return gaps}})
                             .make(ranks[ranks.length - 1], [], ranks.length, steps, skips)

    var collapse_edges = require('./edge_collapse.js')
    var edges = collapse_edges(get_gaps_edges(gaps)).reduce(segments, [])


    edges.growth = gaps.reduce(function(ss, r){ return ss + r.forward_skips.length + r.backward_skips.length}, 0) * skipsep

    return edges
  }

}()
