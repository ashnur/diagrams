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

  module.exports = function calculate_edges(diagram, layout){


    function step_of_exit(gap, exit, si){
      var entry_node = nodes_by_id[exit.match.id]
      var entry = entry_node.entry_points[entry_node.entries[exit.relative.id]]
      var exit_junction = junction_points.make('step', exit, si, gap, rankDir, rankSep, exit.relative, exit.relative.true_rank)
      return [
        exit
      , exit_junction
      , junction_points.make('step', entry, si, gap, rankDir, rankSep, exit_junction, entry_node.true_rank)
      , entry
      ]
    }

    function forward_skip_of_exit(gap, exit, si){

      var entry_node = nodes_by_id[exit.match.id]
      var entry = entry_node.entry_points[entry_node.entries[exit.relative.id]]
      var exit_junction = junction_points.make('exit', exit, si, gap, rankDir, rankSep, exit.relative, 'forward', exit.relative.true_rank)
      var entry_junction = junction_points.make('entry', entry, si, gap, rankDir, rankSep, entry, 'forward', entry_node.true_rank)
      var skip = [
        exit
      , exit_junction
      , skip_points.make('forward',  exit_junction, gap, si, rankDir, skipsep, reversed, g, rank_attr, level_dir)
      , skip_points.make('forward', entry_junction, gap, si, rankDir, skipsep, reversed, g, rank_attr, level_dir)
      , entry_junction
      , entry
      ]
      return skip
    }

    function backward_skip_of_exit(gap, entry, si){
      var exit_node = nodes_by_id[entry.match.id]
      var exit = exit_node.exit_points[exit_node.exits[entry.relative.id]]
      var exit_junction = junction_points.make('exit', exit, si, gap, rankDir, rankSep, exit.relative, 'backward', exit.relative.true_rank)
      var entry_junction = junction_points.make('entry', entry, si, gap, rankDir, rankSep, entry, 'backward', entry.relative.true_rank)
      var skip = [
        exit
      , exit_junction
      , skip_points.make('forward',  exit_junction, gap, si, rankDir, skipsep, ! reversed, g, rank_attr, level_dir)
      , skip_points.make('forward', entry_junction, gap, si, rankDir, skipsep, ! reversed, g, rank_attr, level_dir)
      , entry_junction
      , entry
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
      n.exit_points = n.targets.map(function(target){ return side_points.make('exit', n, rankDir, target) })
      n.entries = n.sources.reduce(idx_to_id, {})
      n.entry_points = n.sources.map(function(source){ return side_points.make('entry', n, rankDir, source) })
      return n
    })

    var nodes_by_id = nodes.reduce(function(nids, n){
      nids[n.id] = n
      return nids
    }, {})

    var ranks =  Object.keys(nodes_keys).sort(function(a, b){ return +a - +b })
                                        .map(function(k, i){
                                          this[k].map(function(n){ n.true_rank = i; return n})
                                          return this[k]
                                        }, nodes_keys)
    var gaps = Array(ranks.length + 1)
    ranks.reduce(function(p,a,i) {
      gaps[i] = Gaps.extend({get_gaps: function(){ return gaps}})
                    .make(p, a, i, step_of_exit, forward_skip_of_exit, backward_skip_of_exit)

      return a
    }, [])
    gaps[ranks.length] = Gaps.extend({get_gaps: function(){ return gaps}})
                             .make(ranks[ranks.length - 1], [], ranks.length, step_of_exit, forward_skip_of_exit, backward_skip_of_exit)


    var edges = gaps.reduce(function(pw, gap){
      var step_segments = gap.steps.reduce(function(steps, step){
        var exit_doubles = steps.filter(function(s){ return s[0].relative == step[0].relative })
        if ( exit_doubles.length == 1 ) {
          var exit_double = exit_doubles.reduce(function(_,s){ return s}, false)
          log(step, exit_double)
          step[0].remove()
          step[1].remove()
          step[0] = exit_double[0]
          step[1] = exit_double[1]
          step[2].origin = step[1]
        }
        steps.push(step)
        return steps
      }, [])
      var forward_skip_segments = gap.forward_skips
      var backward_skip_segments = gap.backward_skips
      return pw.concat([]
               , step_segments.reduce(segments, [])
               , forward_skip_segments.reduce(segments, [])
               , backward_skip_segments.reduce(segments, [])
      )

    }, [])


    edges.growth = gaps.reduce(function(ss, r){ return ss + r.forward_skips.length + r.backward_skips.length}, 0) * skipsep

    return edges
  }

}()
