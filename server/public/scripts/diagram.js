(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
void function(){
  // var Snap = require('snapsvg')
  var viral = require('viral')
  var enslave = require('enslave')
  var dagre = require('dagre')
  var hglue = require('hyperglue')
  var zippy = require('zippy')
  var pluck = require('../util/pluck.js')
  var defaults = require('../util/defaults.js')
  var uid = require('../util/unique_id.js')
  var dom = require('../util/dom.js')
  var intersect = require('./intersect.js')
  var floor = Math.floor
  var ceil = Math.ceil
  var min = Math.min
  var max = Math.max

  function from_defs(diagram, classname){
    return diagram.svgel.parent().select('defs .' + classname)
  }

  function to_defs(diagram, svg){
    var p = diagram.svgel.parent()
    if ( typeof svg == 'string' ) {
      var el = Snap.parse(svg).select('*')
    } else if ( Array.isArray(svg) ) {
      var el = p.el.apply(p.el, svg)
    } else {
      if ( diagram.config.debug ) console.error('unrecognizable svg variable type')
    }
    return p.select('defs').append(el)
  }

  function draw(diagram, el){
    var new_el = from_defs(diagram, el.classname).clone()
    var node = hglue(new_el.node, el.content)
    diagram.svgel.append(new_el)
    return new_el
  }

  function set_line_attrs(item, line_height, x){
    item.g.selectAll('tspan').forEach(function(tspan, idx){
      tspan.attr({ dy: idx ? line_height : 0 , x: x })
    })
  }

  function pos_calc(x,w,y,h){
    return [x + w / 2, y + h / 2]
  }

  function get_textwidth(node){
    return node.getComputedTextLength()
  }

  function inviz_bbox(diagram, el){
    var clone = el.clone().attr()
    diagram.svgel.append(clone)
    var bbox = clone.getBBox()
    clone.remove()
    return bbox
  }

  function point_to_string(p){ return p.x + ',' + p.y }

  function horizontal(line){
    return line.getAttribute('x1') == line.getAttribute('x2')
  }

  function apply_dimensions(diagram){
    // apply height / width on nodes
    var bbox_cache = {}
    diagram.graph.eachNode(function(id, node){
      var classname = node.classname
      var bbox = bbox_cache[classname] || (bbox_cache[classname] = inviz_bbox(diagram, from_defs(diagram, classname)))
      node.attr('width', bbox.width)
      node.attr('height', bbox.height)
    })
  }

  function display_nodes(layout, diagram){
    // display nodes
    layout.eachNode(function(id, values){
      var node = diagram.graph.node(id)
      node.attr('x', values.x)
      node.attr('y', values.y)
      var x = values.x - values.width / 2
      var y = values.y - values.height / 2
      node.add_attr(':first', 'transform', 'translate(' + x + ',' + y + ')')
      node.transform(values)
      draw(diagram, node)
    })
  }

  function init_layout(diagram){
    apply_dimensions(diagram)
    return diagram.run(diagram.graph)
  }


  function draw_segment(diagram, transform, target, segment){
    var transf_obj = Object.create(transform)
    transf_obj.content = {}
    transf_obj.content[target] = segment
    draw(diagram, transf_obj)
    return segment
  }

  function draw_segments(diagram, transform, target, edges){
    var transf_obj = Object.create(transform)
    transf_obj.content = {}
    transf_obj.content[target] = edges.map(function(s){ return {':first': s}})
    draw(diagram, transf_obj)
    return edges
  }

  var get_junction_node = pluck('node')
  var get_junction_cut = pluck('cut')

  function display(diagram){

    var transform_object = { classname: diagram.config.edgeClass }

    // remove all svg nodes
    // TODO: at some point this could be optimalized so we reuse the nodes which do not change
    diagram.svgel.clear()


    var layout = init_layout(diagram)

    display_nodes(layout, diagram)

    var outgraph = layout.graph()
    var rankDir = outgraph.rankDir
    var vertical = rankDir == 'TB' || rankDir == 'BT'

    // calculate edges layout
    var edges = require('./edges.js')(diagram, layout)

    draw_segments(diagram, transform_object, '.Edge', edges)

    var intersection_size = inviz_bbox(diagram, from_defs(diagram, diagram.config.intersectionClass))
    var intersection_middle = [intersection_size.width / 2, intersection_size.height / 2]
    edges.forEach(function(seg1, id1){
      edges.forEach(function(seg2, id2){
        if ( id2 > id1 && seg1.x1 != seg2.x1 &&  seg1.x2 != seg2.x2
                       && seg1.y1 != seg2.y1 &&  seg1.y2 != seg2.y2
                       && seg1.x1 != seg2.x2 &&  seg1.y1 != seg2.y2
                       && seg1.x1 != seg2.y1 &&  seg1.x2 != seg2.y2
                       && seg1.x1 != seg2.y2 &&  seg1.x2 != seg2.y1
           ) {
          var isct = intersect(seg1, seg2)
          if ( isct[0] == 8 ) { // intersecting
            var seg1node = dom.$id(seg1.id)
            var seg2node = dom.$id(seg2.id)
            var topnode = seg1node.compareDocumentPosition(seg2node) & 4 ? seg1node : seg2node
            var intersect_node = draw(diagram, { classname: diagram.config.intersectionClass , content: {} })
            if ( horizontal(topnode) ) {
              intersect_node.transform((new Snap.Matrix(1, 0, 0, 1, 0 , 0)).rotate(90, isct[1][0] , isct[1][1] ).toTransformString())
                            .transform(intersect_node.matrix.translate(isct[1][0] - intersection_middle[0], isct[1][1] - intersection_middle[1]))
            } else {
              intersect_node.transform(new Snap.Matrix(1, 0, 0, 1, isct[1][0] - intersection_middle[0], isct[1][1] - intersection_middle[1]))
            }

            dom.insertAfter(topnode.parentNode, intersect_node.node, topnode.nextSibling)

          }
        }
      })
    })

    var move = new Snap.Matrix(1, 0, 0, 1, 0, 0)
    if ( rankDir == "LR" || rankDir == "RL" ) {
      outgraph.height = outgraph.height + edges.growth * 2
      var move = move.translate(0, edges.growth)
    } else {
      outgraph.width = outgraph.width + edges.growth * 2
      var move = move.translate(edges.growth, 0)
    }

    diagram.svgel.attr({ width: outgraph.width, height: outgraph.height }).transform(move.toTransformString())

    if ( vertical ) {
      diagram.config.height = diagram.config.height + edges.growth
    } else {
      diagram.config.width = diagram.config.width + edges.growth
    }

    diagram.svgel.parent().attr({
      width: outgraph.width + diagram.config.padding * 2
    , height: outgraph.height + diagram.config.padding * 2
    })

    return diagram
  }

  var emitter = require('../util/emitter.js')
  var layout = emitter.extend(dagre.layout())

  module.exports = layout.extend({
    init: function(config, graph){
      this.config = config
      Object.keys(config.layout_config).forEach(function(method){
        this[method](config.layout_config[method])
      }, this)
      this.rankSimplex = true
      this.graph = graph
      this.id = uid()
      this.svgel = Snap.apply(Snap, config.snap_args).g().attr({ transform: "translate(20,20)", id:this.id})
      this.node = this.svgel.parent().node
    }
  , display: enslave(display)
  , draw: enslave(draw)
  , to_defs: enslave(to_defs)

  })
}()

},{"../util/defaults.js":64,"../util/dom.js":65,"../util/emitter.js":66,"../util/pluck.js":67,"../util/unique_id.js":69,"./edges.js":3,"./intersect.js":5,"dagre":13,"enslave":58,"hyperglue":59,"viral":62,"zippy":63}],2:[function(require,module,exports){
void function(){

  var log = console.log.bind(console)
  var zipg = require('../util/zips.js').zipGreedy

  // [a] → a
  function first(as){ return as && as[0] }

  // [a] → a
  function last(as){ return as && as[as.length - 1] }

  // a → Boolean
  function not_null(a){ return a != null }

  // (a, b) → Boolean
  function equal(a, b){ return a === b }

  // (a1 → a2 → ... → aN → b) → (#[a1, a2, ..., aN) → b)
  function spread(f){
    return function(args){ return f.apply(this, args) }
  }

  // ([a], a) → Integer
  function count(arr, value){
    return arr.filter(function(elem){ return elem == value }).length
  }

  // ([a], [a]) → Boolean
  function equal_lists(l1, l2){
    return zipg(l1, l2).every(spread(equal))
  }

  // ([[a]], [a]) → Boolean
  function find_sublist(lists, l){
    return lists.some(equal_lists.bind(null, l))
  }

  // (MergedEdge, MergedEdge) → Boolean
  function me_equal(a, b){
    return a.every(function(ae){
      return find_sublist(b, ae)
    })
  }

  // [a] → [a]
  function unique(list){
    return list.filter(function(x, i){ return list.indexOf(x) == i })
  }

  // ([[a]] → [a])
  function flatten(nested){
    return [].concat.apply([], nested)
  }

  // (Number, Node) → Boolean
  function same_rank(crn, n){ return n.true_rank == crn }

  // MergedEdge → [Node]
  function me_node(selector, merged_edge){
    return merged_edge.map(selector).filter(not_null)
  }

  // (Edge → Node) → [MergedEdges]
  function get_transforms(selector, same_edge){

    var me_node_bound = me_node.bind(null, selector)

    // [MergedEdge] → [[Node]]
    function mes_nodes(mes){
      return mes.map(me_node_bound)
    }

    // (MergedEdge, MergedEdge) → Boolean
    function different_edge(a, b){
      return ! same_edge(a, b)
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function different_edges(mes, me){
      return mes.filter(different_edge.bind(null, me))
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function same_edges(mes, me){
      return mes.filter(same_edge.bind(null, me))
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function new_edges(all, diff, same, me){
      var mes_s = mes_nodes(all)
      var has_me = me_equal.bind(null, me)
      var is_me_new = all.length == 0 || ! ( diff.some(has_me) ||  same.some(has_me))
      return is_me_new ? [me] : []
    }

    return {
      different_edges: different_edges
    , same_edges: same_edges
    , new_edges: new_edges
    }
  }

  function source(edge){
    var first_point = first(edge)
    return first_point && first_point.exit
  }

  // (MergedEdge, MergedEdge) → Boolean
  function same_source(a, b){
    var ans = unique(me_node(source, a))
    var cgn = first(ans).true_rank
    var bns = unique(me_node(source, b).filter(same_rank.bind(null, cgn)))
    return equal_lists(ans, bns)
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_source(b, a){
    var b_sources = b.map(first)
    var a_source = first(a)

    b.forEach(function(b_source){
      b_source[0].remove()
      b_source[0] = a_source[0]
      b_source[1] = a_source[1]
      b_source[2].exit_junction = b_source[1]
    })
    return a.concat(b)
  }

  // Edge → Node
  function target(edge){
    var last_point = last(edge)
    return last_point && last_point.entry
  }

  // (MergedEdge, MergedEdge) → Boolean
  function same_target(a, b){
    var an = me_node(target, a)
    var cgn = first(an).true_rank
    var ns =  me_node(target, b).filter(same_rank.bind(null, cgn))
    return equal_lists(ns, an)
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_target(b, a){
    var me_target = me_node.bind(null, target)
    var b_targets = me_target(b)
    var edges_to_merge = a.filter(function(edge){
      return b_targets.indexOf(target(edge)) > -1
    })
    edges_to_merge.forEach(function(edge_to_merge){
      var a_end = edge_to_merge.length - 1
      b.forEach(function(b_edge){
        var b_end = b_edge.length - 1
        if ( target(edge_to_merge) == target(b_edge) ) {
          b_edge[b_end].remove()
          b_edge[b_end] = edge_to_merge[a_end]
          b_edge[b_end - 1] = edge_to_merge[a_end - 1]
          b_edge[b_end - 2].exit_junction = b_edge[b_end - 1]
          if ( b_end == 3 && a_end == 5 ) {
            // edge_to_merge[3].relative = b_edge[0]
            edge_to_merge[4].relative = b_edge[1]

          } else if ( b_end == 5 && a_end == 3 ) {
            b_edge[3].relative = edge_to_merge[2]
          } else if ( b_end == 5 && a_end == 5 ) {
          }
        }
      })
    })

    return a.concat(b)
  }


  module.exports = function(edges){
    var mes = edges.map(function(g){ return [g] })

    ;[
      [source, merge_by_source, same_source]
    , [target, merge_by_target, same_target]
    ].forEach(spread(function(selector, merge, same_edge){
      var tr = get_transforms(selector, same_edge)
      var guard = 0
      function rec(mes, t_count){
        mes = mes.reduce(function collapse(mes, me){
          var dt = tr.different_edges(mes, me)
          var st = tr.same_edges(mes, me)
          var mt = st.map(merge.bind(null, me))
          var nt = tr.new_edges(mes, dt, mt, me)
// log('diff', dt, 'merg', mt, 'new' ,nt)
          t_count += mt.length
          return dt.concat(mt, nt)
        }, [])
        // log(mes)

        // log(t_count)
        return t_count > 0 && ++guard < 10 ? rec(mes, 0) : mes
      }
      mes = rec(mes, 0)
      // log(guard)
    }))


    return flatten(mes)
  }


}()

},{"../util/zips.js":71}],3:[function(require,module,exports){
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
      , skip_points.make(direction,  exit_junction, gap, si, rankDir, skipsep, rev, g, rank_attr, level_dir)
      , skip_points.make(direction, entry_junction, gap, si, rankDir, skipsep, rev, g, rank_attr, level_dir)
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

},{"../util/translate.js":68,"../util/unique_id.js":69,"../util/zips.js":71,"./edge_collapse.js":2,"./gaps.js":4,"./junction_points.js":6,"./side_points.js":7,"./skip_points.js":8}],4:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var enslave = require('enslave')

  function get_edges_combined(gap){
    return gap.get_gaps().reduce(function(l, g){
      return l.concat( []
      , g.forward_skips
      , gap.forward_skips
      , g.steps
      , gap.backward_skips
      , g.backward_skips
      )
    }, [])
  }

  function get_edges(gap){
    return gap.get_gaps().reduce(function(edges, edge){
      return edges.concat(edge.forward_skips.concat(edge.steps, edge.backward_skips))
    }, [])
  }

  function get_steps(gap){
    return gap.get_gaps()[gap.index].steps
  }

  module.exports = viral.extend({
    init: function(prev_rank, rank, rn, steps, skips){
      var exits = prev_rank.reduce(function(s, n){ return s.concat(n.exit_points) }, [])
      var entries = rank.reduce(function(s, n){ return s.concat(n.entry_points)  }, [])
      this.exits = exits
      this.entries = entries
      this.steps = exits.filter(function(exit){
                          return rank.indexOf(exit.entry) > -1
                        })
                        .map(steps.bind(null, this))

      this.forward_skips = exits.filter(function(exit){
                                  return rank.indexOf(exit.entry) == -1 && exit.entry.true_rank - rn > 0
                                })
                                .map(skips.bind(null, this, 'forward'))

      this.backward_skips = exits.filter(function(exit){
                                  return rank.indexOf(exit.entry) == -1 && rn - exit.entry.true_rank >= 0
                                })
                                .map(skips.bind(null, this, 'backward'))

      this.paths_count = (entries.length + exits.length - this.steps.length + 1)
      this.index = rn
    }
  , edges: enslave(get_edges)
  , edges_combined: enslave(get_edges_combined)
  , get_steps: enslave(get_steps)

  })

}()

},{"enslave":58,"viral":62}],5:[function(require,module,exports){
void function(){

  var V = require('../util/vectors.js')

  module.exports = function(seg1, seg2){
    var p = [seg1.x1, seg1.y1]
    var r = V.subtract([seg1.x2, seg1.y2], p)
    var q = [seg2.x1, seg2.y1]
    var s = V.subtract([seg2.x2, seg2.y2], q)

    // collinear overlapping            1
    // collinear disjoint               2
    // parallel                         4
    // intersecting                     8
    // non-parallel non-intersecting   16
    var response = 0


    var rxs = V.cross(r, s)
    var q_p = V.subtract(q,p)
    var q_pxr = V.cross(q_p, r)
    if ( rxs == 0 ) {
      if ( q_pxr != 0 ) {
        return [4]
      } else {
        var rr = V.dot(r, r)
        var q_pdr = V.dot(q_p, r)
        var ss = V.dot(s, s)
        var q_pds = V.dot(q_p, s)
        if ( ( 0 <= q_pdr &&  q_pdr <= rr ) || ( 0 <= q_pds && q_pds <= ss ) ) {
          return [1]
        } else {
          return [2]
        }
      }
    }

    var t = V.cross(q_p, s) / rxs
    if ( t < 0 || t > 1 ) return [16]
    var u = V.cross(q_p, r) / rxs
    if ( u < 0 || u > 1 ) return [16]

    // var z1 = V.add(p, V.scale(r, t))
    // var z2 = V.add(q, V.scale(s, u))

    return [8, V.add(p, V.scale(r, t))]
  }

}()

},{"../util/vectors.js":70}],6:[function(require,module,exports){
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
          : point.type == 'entry' && point.node_point.type == 'entry' ? point.relative
          : point
    var r = l.indexOf(q)
// if (r == -1   ) log(l, point, point.relative)
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
                             // && p.type != 'entry'
                             && ! (p.type == 'entry' && p.node_point.type == 'entry')
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
  , index: enslave(index)
  })

  module.exports = Junction

}()

},{"../util/translate.js":68,"../util/unique_id.js":69,"enslave":58,"viral":62}],7:[function(require,module,exports){
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
    var r = list(point).indexOf(point)
    return r
  }

  function list(point){
    return point.type == 'exit' ? point.node.exit_points : point.node.entry_points
  }

  function remove(point){
    var idx = index(point)
    return idx > -1 ? list(point).splice(idx, 1) : false
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
  , index: enslave(index)
  , list: enslave(list)
  })

}()

},{"../util/translate.js":68,"enslave":58,"viral":62}],8:[function(require,module,exports){
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

    var rel = point.relative.static()
log(point.deleted)
    return point.deleted ? point.relative.static() : {
      x: orientate(point.rankDir, level, rel[point.rank_attr])
    , y: orientate(point.rankDir, rel[point.rank_attr], level)
    }
  }

  function get_x(point){ return calculate(point).x }

  function get_y(point){ return calculate(point).y }

  function index(point){

    return point.gap.get_gaps().indexOf(point.gap)
  }

  function get_gap_number(point){
    return point.relative.gap_number()
  }

  function remove(point){
    point.deleted = true
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
      this.deleted = false
    }
  , x: enslave(get_x)
  , y: enslave(get_y)
  , static: enslave(calculate)
  , gap_number: enslave(get_gap_number)
  , remove: enslave(remove)
  })

}()

},{"../util/translate.js":68,"enslave":58,"viral":62}],9:[function(require,module,exports){
void function(){
  var enslave = require('enslave')
  var Node = require('./node.js')
  var uid = require('../util/unique_id.js')

  // TODO: make this 1 to 1 for a displayed part of the path similarly how nodes are
  var Edge = Node.extend({
    init: function(graph, source, target, transform, attrs){
      this.id = uid()
      this.type = 'edge'
      this.graph = graph
      this.source = source
      this.target = target
    }
  })

  module.exports = Edge
}()

},{"../util/unique_id.js":69,"./node.js":11,"enslave":58}],10:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var dagre = require('dagre')
  var uid = require('../util/unique_id.js')
  var Node = require('./node.js')
  var Edge = require('./edge.js')

  function add_node(graph, classname, transform, content, prefRank){
    var node = Node.make(graph, transform, {
        classname: classname
      , content: content
      , rank: prefRank
    })
    graph.addNode(node.id, node)
    return node
  }

  function remove_node(graph, node_id){
    if ( graph.hasNode(node_id) ) {
      graph.delNode(node_id)
      return true
    }
    return false
  }

  function connect(graph, classname, source, target, transform, content){
    var edge = Edge.make(graph, source, target)
    graph.addEdge(edge.id, source.id, target.id, edge)
    return edge
  }

  function disconnect(graph, source, target){
    var edge_id = graph.outEdges(source.id, target.id)
    if ( graph.hasEdge(edge_id) ) {
      graph.delEdge(edge_id)
      return true
    } else {
      return false
    }
  }

  var emitter = require('../util/emitter.js')
  var graph = emitter.extend(dagre.Digraph.prototype)
                     .extend({ init: function(){ dagre.Digraph.call(this) } })

  module.exports = graph.extend({
    add_node: enslave(add_node)
  , del_node: enslave(remove_node)
  , connect: enslave(connect)
  , disconnect: enslave(disconnect)
  })

}()

},{"../util/emitter.js":66,"../util/unique_id.js":69,"./edge.js":9,"./node.js":11,"dagre":13,"enslave":58,"viral":62}],11:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var uid = require('../util/unique_id.js')

  function set_attrs(node, attrs){
    Object.keys(attrs).forEach(function(key){
      node[key] = attrs[key]
    })
    node.graph.emit(node.type + '_attrs', attrs)
  }

  function set_attr(node, attr, value){
    node[attr] = value
    node.graph.emit(node.type + '_attr', attr, value)
  }

  function add_attr(node, selector, name, value){
    node.content[selector] = node.content[selector] || {}
    node.content[selector][name] = value
  }

  function add_attrs(node, selector, attrs){
    node.content[selector] = value
  }

  module.exports = viral.extend({
    init: function(graph, transform, attrs){
      this.id = uid()
      this.type = 'vertex'
      this.graph = graph
      this.transform = transform.bind(null, this)
      set_attrs(this, attrs)
    }
  , attrs: enslave(set_attrs)
  , attr: enslave(set_attr)
  , add_attr: enslave(add_attr)
  , add_attrs: enslave(add_attrs)
  })

}()

},{"../util/unique_id.js":69,"enslave":58,"viral":62}],12:[function(require,module,exports){
void function(){

  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^\s+|\s+$/g, '')
    }
  }

  var defaults = require('./util/defaults.js')
  var Graph = require('./graph/graph.js')
  var Diagram = require('./diagram/diagram.js')


  /**
  * Set default configuration
  * @param      {Object} options
  * @return     {Object} options filled with defaults
  */
  function config(cfgobj){
    var default_cfg = {
      width: window.innerWidth
    , height: window.innerHeight
    , font_size: 21
    , line_height: 26 // for font-size 21
    }
    return cfgobj == null ? default_cfg
         :                  defaults(cfgobj, default_cfg)
  }

  /**
  * Create a new graph object to store diagram data in it
  * @return     {Object}   graph object
  */
  function graph(cfgobj){
    return Graph.make(cfgobj)
  }

  /**
  * Initialize diagram with options and graph object
  * and register event handlers
  * @param      {Object}   options
  * @param      {Object}   graph object
  * @return     {Object}   diagram
  */
  function diagram(cfgobj, graph){
    return Diagram.make(cfgobj, graph)
  }

  module.exports = {
    config: config
  , graph: graph
  , diagram: diagram
  }
  if ( window ) window.Diagram = module.exports

}()

},{"./diagram/diagram.js":1,"./graph/graph.js":10,"./util/defaults.js":64}],13:[function(require,module,exports){
/*
Copyright (c) 2012-2013 Chris Pettitt

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
exports.Digraph = require("graphlib").Digraph;
exports.Graph = require("graphlib").Graph;
exports.layout = require("./lib/layout");
exports.version = require("./lib/version");

},{"./lib/layout":14,"./lib/version":29,"graphlib":35}],14:[function(require,module,exports){
var util = require('./util'),
    rank = require('./rank'),
    order = require('./order'),
    CGraph = require('graphlib').CGraph,
    CDigraph = require('graphlib').CDigraph;

module.exports = function() {
  // External configuration
  var config = {
    // How much debug information to include?
    debugLevel: 0,
    // Max number of sweeps to perform in order phase
    orderMaxSweeps: order.DEFAULT_MAX_SWEEPS,
    // Use network simplex algorithm in ranking
    rankSimplex: false,
    // Rank direction. Valid values are (TB, LR)
    rankDir: 'TB'
  };

  // Phase functions
  var position = require('./position')();

  // This layout object
  var self = {};

  self.orderIters = util.propertyAccessor(self, config, 'orderMaxSweeps');

  self.rankSimplex = util.propertyAccessor(self, config, 'rankSimplex');

  self.nodeSep = delegateProperty(position.nodeSep);
  self.edgeSep = delegateProperty(position.edgeSep);
  self.universalSep = delegateProperty(position.universalSep);
  self.rankSep = delegateProperty(position.rankSep);
  self.rankDir = util.propertyAccessor(self, config, 'rankDir');
  self.debugAlignment = delegateProperty(position.debugAlignment);

  self.debugLevel = util.propertyAccessor(self, config, 'debugLevel', function(x) {
    util.log.level = x;
    position.debugLevel(x);
  });

  self.run = util.time('Total layout', run);

  self._normalize = normalize;

  return self;

  /*
   * Constructs an adjacency graph using the nodes and edges specified through
   * config. For each node and edge we add a property `dagre` that contains an
   * object that will hold intermediate and final layout information. Some of
   * the contents include:
   *
   *  1) A generated ID that uniquely identifies the object.
   *  2) Dimension information for nodes (copied from the source node).
   *  3) Optional dimension information for edges.
   *
   * After the adjacency graph is constructed the code no longer needs to use
   * the original nodes and edges passed in via config.
   */
  function initLayoutGraph(inputGraph) {
    var g = new CDigraph();

    inputGraph.eachNode(function(u, value) {
      if (value === undefined) value = {};
      g.addNode(u, {
        width: value.width,
        height: value.height
      });
      if (value.hasOwnProperty('rank')) {
        g.node(u).prefRank = value.rank;
      }
    });

    // Set up subgraphs
    if (inputGraph.parent) {
      inputGraph.nodes().forEach(function(u) {
        g.parent(u, inputGraph.parent(u));
      });
    }

    inputGraph.eachEdge(function(e, u, v, value) {
      if (value === undefined) value = {};
      var newValue = {
        e: e,
        minLen: value.minLen || 1,
        width: value.width || 0,
        height: value.height || 0,
        points: []
      };

      g.addEdge(null, u, v, newValue);
    });

    // Initial graph attributes
    var graphValue = inputGraph.graph() || {};
    g.graph({
      rankDir: graphValue.rankDir || config.rankDir,
      orderRestarts: graphValue.orderRestarts
    });

    return g;
  }

  function run(inputGraph) {
    var rankSep = self.rankSep();
    var g;
    try {
      // Build internal graph
      g = util.time('initLayoutGraph', initLayoutGraph)(inputGraph);

      if (g.order() === 0) {
        return g;
      }

      // Make space for edge labels
      g.eachEdge(function(e, s, t, a) {
        a.minLen *= 2;
      });
      self.rankSep(rankSep / 2);

      // Determine the rank for each node. Nodes with a lower rank will appear
      // above nodes of higher rank.
      util.time('rank.run', rank.run)(g, config.rankSimplex);

      // Normalize the graph by ensuring that every edge is proper (each edge has
      // a length of 1). We achieve this by adding dummy nodes to long edges,
      // thus shortening them.
      util.time('normalize', normalize)(g);

      // Order the nodes so that edge crossings are minimized.
      util.time('order', order)(g, config.orderMaxSweeps);

      // Find the x and y coordinates for every node in the graph.
      util.time('position', position.run)(g);

      // De-normalize the graph by removing dummy nodes and augmenting the
      // original long edges with coordinate information.
      util.time('undoNormalize', undoNormalize)(g);

      // Reverses points for edges that are in a reversed state.
      util.time('fixupEdgePoints', fixupEdgePoints)(g);

      // Restore delete edges and reverse edges that were reversed in the rank
      // phase.
      util.time('rank.restoreEdges', rank.restoreEdges)(g);

      // Construct final result graph and return it
      return util.time('createFinalGraph', createFinalGraph)(g, inputGraph.isDirected());
    } finally {
      self.rankSep(rankSep);
    }
  }

  /*
   * This function is responsible for 'normalizing' the graph. The process of
   * normalization ensures that no edge in the graph has spans more than one
   * rank. To do this it inserts dummy nodes as needed and links them by adding
   * dummy edges. This function keeps enough information in the dummy nodes and
   * edges to ensure that the original graph can be reconstructed later.
   *
   * This method assumes that the input graph is cycle free.
   */
  function normalize(g) {
    var dummyCount = 0;
    g.eachEdge(function(e, s, t, a) {
      var sourceRank = g.node(s).rank;
      var targetRank = g.node(t).rank;
      if (sourceRank + 1 < targetRank) {
        for (var u = s, rank = sourceRank + 1, i = 0; rank < targetRank; ++rank, ++i) {
          var v = '_D' + (++dummyCount);
          var node = {
            width: a.width,
            height: a.height,
            edge: { id: e, source: s, target: t, attrs: a },
            rank: rank,
            dummy: true
          };

          // If this node represents a bend then we will use it as a control
          // point. For edges with 2 segments this will be the center dummy
          // node. For edges with more than two segments, this will be the
          // first and last dummy node.
          if (i === 0) node.index = 0;
          else if (rank + 1 === targetRank) node.index = 1;

          g.addNode(v, node);
          g.addEdge(null, u, v, {});
          u = v;
        }
        g.addEdge(null, u, t, {});
        g.delEdge(e);
      }
    });
  }

  /*
   * Reconstructs the graph as it was before normalization. The positions of
   * dummy nodes are used to build an array of points for the original 'long'
   * edge. Dummy nodes and edges are removed.
   */
  function undoNormalize(g) {
    g.eachNode(function(u, a) {
      if (a.dummy) {
        if ('index' in a) {
          var edge = a.edge;
          if (!g.hasEdge(edge.id)) {
            g.addEdge(edge.id, edge.source, edge.target, edge.attrs);
          }
          var points = g.edge(edge.id).points;
          points[a.index] = { x: a.x, y: a.y, ul: a.ul, ur: a.ur, dl: a.dl, dr: a.dr };
        }
        g.delNode(u);
      }
    });
  }

  /*
   * For each edge that was reversed during the `acyclic` step, reverse its
   * array of points.
   */
  function fixupEdgePoints(g) {
    g.eachEdge(function(e, s, t, a) { if (a.reversed) a.points.reverse(); });
  }

  function createFinalGraph(g, isDirected) {
    var out = isDirected ? new CDigraph() : new CGraph();
    out.graph(g.graph());
    g.eachNode(function(u, value) { out.addNode(u, value); });
    g.eachNode(function(u) { out.parent(u, g.parent(u)); });
    g.eachEdge(function(e, u, v, value) {
      out.addEdge(value.e, u, v, value);
    });

    // Attach bounding box information
    var maxX = 0, maxY = 0;
    g.eachNode(function(u, value) {
      if (!g.children(u).length) {
        maxX = Math.max(maxX, value.x + value.width / 2);
        maxY = Math.max(maxY, value.y + value.height / 2);
      }
    });
    g.eachEdge(function(e, u, v, value) {
      var maxXPoints = Math.max.apply(Math, value.points.map(function(p) { return p.x; }));
      var maxYPoints = Math.max.apply(Math, value.points.map(function(p) { return p.y; }));
      maxX = Math.max(maxX, maxXPoints + value.width / 2);
      maxY = Math.max(maxY, maxYPoints + value.height / 2);
    });
    out.graph().width = maxX;
    out.graph().height = maxY;

    return out;
  }

  /*
   * Given a function, a new function is returned that invokes the given
   * function. The return value from the function is always the `self` object.
   */
  function delegateProperty(f) {
    return function() {
      if (!arguments.length) return f();
      f.apply(null, arguments);
      return self;
    };
  }
};


},{"./order":15,"./position":20,"./rank":21,"./util":28,"graphlib":35}],15:[function(require,module,exports){
var util = require('./util'),
    crossCount = require('./order/crossCount'),
    initLayerGraphs = require('./order/initLayerGraphs'),
    initOrder = require('./order/initOrder'),
    sortLayer = require('./order/sortLayer');

module.exports = order;

// The maximum number of sweeps to perform before finishing the order phase.
var DEFAULT_MAX_SWEEPS = 24;
order.DEFAULT_MAX_SWEEPS = DEFAULT_MAX_SWEEPS;

/*
 * Runs the order phase with the specified `graph, `maxSweeps`, and
 * `debugLevel`. If `maxSweeps` is not specified we use `DEFAULT_MAX_SWEEPS`.
 * If `debugLevel` is not set we assume 0.
 */
function order(g, maxSweeps) {
  if (arguments.length < 2) {
    maxSweeps = DEFAULT_MAX_SWEEPS;
  }

  var restarts = g.graph().orderRestarts || 0;

  var layerGraphs = initLayerGraphs(g);
  // TODO: remove this when we add back support for ordering clusters
  layerGraphs.forEach(function(lg) {
    lg = lg.filterNodes(function(u) { return !g.children(u).length; });
  });

  var iters = 0,
      currentBestCC,
      allTimeBestCC = Number.MAX_VALUE,
      allTimeBest = {};

  function saveAllTimeBest() {
    g.eachNode(function(u, value) { allTimeBest[u] = value.order; });
  }

  for (var j = 0; j < Number(restarts) + 1 && allTimeBestCC !== 0; ++j) {
    currentBestCC = Number.MAX_VALUE;
    initOrder(g, restarts > 0);

    util.log(2, 'Order phase start cross count: ' + g.graph().orderInitCC);

    var i, lastBest, cc;
    for (i = 0, lastBest = 0; lastBest < 4 && i < maxSweeps && currentBestCC > 0; ++i, ++lastBest, ++iters) {
      sweep(g, layerGraphs, i);
      cc = crossCount(g);
      if (cc < currentBestCC) {
        lastBest = 0;
        currentBestCC = cc;
        if (cc < allTimeBestCC) {
          saveAllTimeBest();
          allTimeBestCC = cc;
        }
      }
      util.log(3, 'Order phase start ' + j + ' iter ' + i + ' cross count: ' + cc);
    }
  }

  Object.keys(allTimeBest).forEach(function(u) {
    if (!g.children || !g.children(u).length) {
      g.node(u).order = allTimeBest[u];
    }
  });
  g.graph().orderCC = allTimeBestCC;

  util.log(2, 'Order iterations: ' + iters);
  util.log(2, 'Order phase best cross count: ' + g.graph().orderCC);
}

function predecessorWeights(g, nodes) {
  var weights = {};
  nodes.forEach(function(u) {
    weights[u] = g.inEdges(u).map(function(e) {
      return g.node(g.source(e)).order;
    });
  });
  return weights;
}

function successorWeights(g, nodes) {
  var weights = {};
  nodes.forEach(function(u) {
    weights[u] = g.outEdges(u).map(function(e) {
      return g.node(g.target(e)).order;
    });
  });
  return weights;
}

function sweep(g, layerGraphs, iter) {
  if (iter % 2 === 0) {
    sweepDown(g, layerGraphs, iter);
  } else {
    sweepUp(g, layerGraphs, iter);
  }
}

function sweepDown(g, layerGraphs) {
  var cg;
  for (i = 1; i < layerGraphs.length; ++i) {
    cg = sortLayer(layerGraphs[i], cg, predecessorWeights(g, layerGraphs[i].nodes()));
  }
}

function sweepUp(g, layerGraphs) {
  var cg;
  for (i = layerGraphs.length - 2; i >= 0; --i) {
    sortLayer(layerGraphs[i], cg, successorWeights(g, layerGraphs[i].nodes()));
  }
}

},{"./order/crossCount":16,"./order/initLayerGraphs":17,"./order/initOrder":18,"./order/sortLayer":19,"./util":28}],16:[function(require,module,exports){
var util = require('../util');

module.exports = crossCount;

/*
 * Returns the cross count for the given graph.
 */
function crossCount(g) {
  var cc = 0;
  var ordering = util.ordering(g);
  for (var i = 1; i < ordering.length; ++i) {
    cc += twoLayerCrossCount(g, ordering[i-1], ordering[i]);
  }
  return cc;
}

/*
 * This function searches through a ranked and ordered graph and counts the
 * number of edges that cross. This algorithm is derived from:
 *
 *    W. Barth et al., Bilayer Cross Counting, JGAA, 8(2) 179–194 (2004)
 */
function twoLayerCrossCount(g, layer1, layer2) {
  var indices = [];
  layer1.forEach(function(u) {
    var nodeIndices = [];
    g.outEdges(u).forEach(function(e) { nodeIndices.push(g.node(g.target(e)).order); });
    nodeIndices.sort(function(x, y) { return x - y; });
    indices = indices.concat(nodeIndices);
  });

  var firstIndex = 1;
  while (firstIndex < layer2.length) firstIndex <<= 1;

  var treeSize = 2 * firstIndex - 1;
  firstIndex -= 1;

  var tree = [];
  for (var i = 0; i < treeSize; ++i) { tree[i] = 0; }

  var cc = 0;
  indices.forEach(function(i) {
    var treeIndex = i + firstIndex;
    ++tree[treeIndex];
    while (treeIndex > 0) {
      if (treeIndex % 2) {
        cc += tree[treeIndex + 1];
      }
      treeIndex = (treeIndex - 1) >> 1;
      ++tree[treeIndex];
    }
  });

  return cc;
}

},{"../util":28}],17:[function(require,module,exports){
var nodesFromList = require('graphlib').filter.nodesFromList,
    /* jshint -W079 */
    Set = require('cp-data').Set;

module.exports = initLayerGraphs;

/*
 * This function takes a compound layered graph, g, and produces an array of
 * layer graphs. Each entry in the array represents a subgraph of nodes
 * relevant for performing crossing reduction on that layer.
 */
function initLayerGraphs(g) {
  var ranks = [];

  function dfs(u) {
    if (u === null) {
      g.children(u).forEach(function(v) { dfs(v); });
      return;
    }

    var value = g.node(u);
    value.minRank = ('rank' in value) ? value.rank : Number.MAX_VALUE;
    value.maxRank = ('rank' in value) ? value.rank : Number.MIN_VALUE;
    var uRanks = new Set();
    g.children(u).forEach(function(v) {
      var rs = dfs(v);
      uRanks = Set.union([uRanks, rs]);
      value.minRank = Math.min(value.minRank, g.node(v).minRank);
      value.maxRank = Math.max(value.maxRank, g.node(v).maxRank);
    });

    if ('rank' in value) uRanks.add(value.rank);

    uRanks.keys().forEach(function(r) {
      if (!(r in ranks)) ranks[r] = [];
      ranks[r].push(u);
    });

    return uRanks;
  }
  dfs(null);

  var layerGraphs = [];
  ranks.forEach(function(us, rank) {
    layerGraphs[rank] = g.filterNodes(nodesFromList(us));
  });

  return layerGraphs;
}

},{"cp-data":30,"graphlib":35}],18:[function(require,module,exports){
var crossCount = require('./crossCount'),
    util = require('../util');

module.exports = initOrder;

/*
 * Given a graph with a set of layered nodes (i.e. nodes that have a `rank`
 * attribute) this function attaches an `order` attribute that uniquely
 * arranges each node of each rank. If no constraint graph is provided the
 * order of the nodes in each rank is entirely arbitrary.
 */
function initOrder(g, random) {
  var layers = [];

  g.eachNode(function(u, value) {
    var layer = layers[value.rank];
    if (g.children && g.children(u).length > 0) return;
    if (!layer) {
      layer = layers[value.rank] = [];
    }
    layer.push(u);
  });

  layers.forEach(function(layer) {
    if (random) {
      util.shuffle(layer);
    }
    layer.forEach(function(u, i) {
      g.node(u).order = i;
    });
  });

  var cc = crossCount(g);
  g.graph().orderInitCC = cc;
  g.graph().orderCC = Number.MAX_VALUE;
}

},{"../util":28,"./crossCount":16}],19:[function(require,module,exports){
var util = require('../util');
/*
    Digraph = require('graphlib').Digraph,
    topsort = require('graphlib').alg.topsort,
    nodesFromList = require('graphlib').filter.nodesFromList;
*/

module.exports = sortLayer;

/*
function sortLayer(g, cg, weights) {
  var result = sortLayerSubgraph(g, null, cg, weights);
  result.list.forEach(function(u, i) {
    g.node(u).order = i;
  });
  return result.constraintGraph;
}
*/

function sortLayer(g, cg, weights) {
  var ordering = [];
  var bs = {};
  g.eachNode(function(u, value) {
    ordering[value.order] = u;
    var ws = weights[u];
    if (ws.length) {
      bs[u] = util.sum(ws) / ws.length;
    }
  });

  var toSort = g.nodes().filter(function(u) { return bs[u] !== undefined; });
  toSort.sort(function(x, y) {
    return bs[x] - bs[y] || g.node(x).order - g.node(y).order;
  });

  for (var i = 0, j = 0, jl = toSort.length; j < jl; ++i) {
    if (bs[ordering[i]] !== undefined) {
      g.node(toSort[j++]).order = i;
    }
  }
}

// TOOD: re-enable constrained sorting once we have a strategy for handling
// undefined barycenters.
/*
function sortLayerSubgraph(g, sg, cg, weights) {
  cg = cg ? cg.filterNodes(nodesFromList(g.children(sg))) : new Digraph();

  var nodeData = {};
  g.children(sg).forEach(function(u) {
    if (g.children(u).length) {
      nodeData[u] = sortLayerSubgraph(g, u, cg, weights);
      nodeData[u].firstSG = u;
      nodeData[u].lastSG = u;
    } else {
      var ws = weights[u];
      nodeData[u] = {
        degree: ws.length,
        barycenter: ws.length > 0 ? util.sum(ws) / ws.length : 0,
        list: [u]
      };
    }
  });

  resolveViolatedConstraints(g, cg, nodeData);

  var keys = Object.keys(nodeData);
  keys.sort(function(x, y) {
    return nodeData[x].barycenter - nodeData[y].barycenter;
  });

  var result =  keys.map(function(u) { return nodeData[u]; })
                    .reduce(function(lhs, rhs) { return mergeNodeData(g, lhs, rhs); });
  return result;
}

/*
function mergeNodeData(g, lhs, rhs) {
  var cg = mergeDigraphs(lhs.constraintGraph, rhs.constraintGraph);

  if (lhs.lastSG !== undefined && rhs.firstSG !== undefined) {
    if (cg === undefined) {
      cg = new Digraph();
    }
    if (!cg.hasNode(lhs.lastSG)) { cg.addNode(lhs.lastSG); }
    cg.addNode(rhs.firstSG);
    cg.addEdge(null, lhs.lastSG, rhs.firstSG);
  }

  return {
    degree: lhs.degree + rhs.degree,
    barycenter: (lhs.barycenter * lhs.degree + rhs.barycenter * rhs.degree) /
                (lhs.degree + rhs.degree),
    list: lhs.list.concat(rhs.list),
    firstSG: lhs.firstSG !== undefined ? lhs.firstSG : rhs.firstSG,
    lastSG: rhs.lastSG !== undefined ? rhs.lastSG : lhs.lastSG,
    constraintGraph: cg
  };
}

function mergeDigraphs(lhs, rhs) {
  if (lhs === undefined) return rhs;
  if (rhs === undefined) return lhs;

  lhs = lhs.copy();
  rhs.nodes().forEach(function(u) { lhs.addNode(u); });
  rhs.edges().forEach(function(e, u, v) { lhs.addEdge(null, u, v); });
  return lhs;
}

function resolveViolatedConstraints(g, cg, nodeData) {
  // Removes nodes `u` and `v` from `cg` and makes any edges incident on them
  // incident on `w` instead.
  function collapseNodes(u, v, w) {
    // TODO original paper removes self loops, but it is not obvious when this would happen
    cg.inEdges(u).forEach(function(e) {
      cg.delEdge(e);
      cg.addEdge(null, cg.source(e), w);
    });

    cg.outEdges(v).forEach(function(e) {
      cg.delEdge(e);
      cg.addEdge(null, w, cg.target(e));
    });

    cg.delNode(u);
    cg.delNode(v);
  }

  var violated;
  while ((violated = findViolatedConstraint(cg, nodeData)) !== undefined) {
    var source = cg.source(violated),
        target = cg.target(violated);

    var v;
    while ((v = cg.addNode(null)) && g.hasNode(v)) {
      cg.delNode(v);
    }

    // Collapse barycenter and list
    nodeData[v] = mergeNodeData(g, nodeData[source], nodeData[target]);
    delete nodeData[source];
    delete nodeData[target];

    collapseNodes(source, target, v);
    if (cg.incidentEdges(v).length === 0) { cg.delNode(v); }
  }
}

function findViolatedConstraint(cg, nodeData) {
  var us = topsort(cg);
  for (var i = 0; i < us.length; ++i) {
    var u = us[i];
    var inEdges = cg.inEdges(u);
    for (var j = 0; j < inEdges.length; ++j) {
      var e = inEdges[j];
      if (nodeData[cg.source(e)].barycenter >= nodeData[u].barycenter) {
        return e;
      }
    }
  }
}
*/

},{"../util":28}],20:[function(require,module,exports){
var util = require('./util');

/*
 * The algorithms here are based on Brandes and Köpf, "Fast and Simple
 * Horizontal Coordinate Assignment".
 */
module.exports = function() {
  // External configuration
  var config = {
    nodeSep: 50,
    edgeSep: 10,
    universalSep: null,
    rankSep: 30
  };

  var self = {};

  self.nodeSep = util.propertyAccessor(self, config, 'nodeSep');
  self.edgeSep = util.propertyAccessor(self, config, 'edgeSep');
  // If not null this separation value is used for all nodes and edges
  // regardless of their widths. `nodeSep` and `edgeSep` are ignored with this
  // option.
  self.universalSep = util.propertyAccessor(self, config, 'universalSep');
  self.rankSep = util.propertyAccessor(self, config, 'rankSep');
  self.debugLevel = util.propertyAccessor(self, config, 'debugLevel');

  self.run = run;

  return self;

  function run(g) {
    g = g.filterNodes(util.filterNonSubgraphs(g));

    var layering = util.ordering(g);

    var conflicts = findConflicts(g, layering);

    var xss = {};
    ['u', 'd'].forEach(function(vertDir) {
      if (vertDir === 'd') layering.reverse();

      ['l', 'r'].forEach(function(horizDir) {
        if (horizDir === 'r') reverseInnerOrder(layering);

        var dir = vertDir + horizDir;
        var align = verticalAlignment(g, layering, conflicts, vertDir === 'u' ? 'predecessors' : 'successors');
        xss[dir]= horizontalCompaction(g, layering, align.pos, align.root, align.align);

        if (config.debugLevel >= 3)
          debugPositioning(vertDir + horizDir, g, layering, xss[dir]);

        if (horizDir === 'r') flipHorizontally(xss[dir]);

        if (horizDir === 'r') reverseInnerOrder(layering);
      });

      if (vertDir === 'd') layering.reverse();
    });

    balance(g, layering, xss);

    g.eachNode(function(v) {
      var xs = [];
      for (var alignment in xss) {
        var alignmentX = xss[alignment][v];
        posXDebug(alignment, g, v, alignmentX);
        xs.push(alignmentX);
      }
      xs.sort(function(x, y) { return x - y; });
      posX(g, v, (xs[1] + xs[2]) / 2);
    });

    // Align y coordinates with ranks
    var y = 0, reverseY = g.graph().rankDir === 'BT' || g.graph().rankDir === 'RL';
    layering.forEach(function(layer) {
      var maxHeight = util.max(layer.map(function(u) { return height(g, u); }));
      y += maxHeight / 2;
      layer.forEach(function(u) {
        posY(g, u, reverseY ? -y : y);
      });
      y += maxHeight / 2 + config.rankSep;
    });

    // Translate layout so that top left corner of bounding rectangle has
    // coordinate (0, 0).
    var minX = util.min(g.nodes().map(function(u) { return posX(g, u) - width(g, u) / 2; }));
    var minY = util.min(g.nodes().map(function(u) { return posY(g, u) - height(g, u) / 2; }));
    g.eachNode(function(u) {
      posX(g, u, posX(g, u) - minX);
      posY(g, u, posY(g, u) - minY);
    });
  }

  /*
   * Generate an ID that can be used to represent any undirected edge that is
   * incident on `u` and `v`.
   */
  function undirEdgeId(u, v) {
    return u < v
      ? u.toString().length + ':' + u + '-' + v
      : v.toString().length + ':' + v + '-' + u;
  }

  function findConflicts(g, layering) {
    var conflicts = {}, // Set of conflicting edge ids
        pos = {},       // Position of node in its layer
        prevLayer,
        currLayer,
        k0,     // Position of the last inner segment in the previous layer
        l,      // Current position in the current layer (for iteration up to `l1`)
        k1;     // Position of the next inner segment in the previous layer or
                // the position of the last element in the previous layer

    if (layering.length <= 2) return conflicts;

    function updateConflicts(v) {
      var k = pos[v];
      if (k < k0 || k > k1) {
        conflicts[undirEdgeId(currLayer[l], v)] = true;
      }
    }

    layering[1].forEach(function(u, i) { pos[u] = i; });
    for (var i = 1; i < layering.length - 1; ++i) {
      prevLayer = layering[i];
      currLayer = layering[i+1];
      k0 = 0;
      l = 0;

      // Scan current layer for next node that is incident to an inner segement
      // between layering[i+1] and layering[i].
      for (var l1 = 0; l1 < currLayer.length; ++l1) {
        var u = currLayer[l1]; // Next inner segment in the current layer or
                               // last node in the current layer
        pos[u] = l1;
        k1 = undefined;

        if (g.node(u).dummy) {
          var uPred = g.predecessors(u)[0];
          // Note: In the case of self loops and sideways edges it is possible
          // for a dummy not to have a predecessor.
          if (uPred !== undefined && g.node(uPred).dummy)
            k1 = pos[uPred];
        }
        if (k1 === undefined && l1 === currLayer.length - 1)
          k1 = prevLayer.length - 1;

        if (k1 !== undefined) {
          for (; l <= l1; ++l) {
            g.predecessors(currLayer[l]).forEach(updateConflicts);
          }
          k0 = k1;
        }
      }
    }

    return conflicts;
  }

  function verticalAlignment(g, layering, conflicts, relationship) {
    var pos = {},   // Position for a node in its layer
        root = {},  // Root of the block that the node participates in
        align = {}; // Points to the next node in the block or, if the last
                    // element in the block, points to the first block's root

    layering.forEach(function(layer) {
      layer.forEach(function(u, i) {
        root[u] = u;
        align[u] = u;
        pos[u] = i;
      });
    });

    layering.forEach(function(layer) {
      var prevIdx = -1;
      layer.forEach(function(v) {
        var related = g[relationship](v), // Adjacent nodes from the previous layer
            mid;                          // The mid point in the related array

        if (related.length > 0) {
          related.sort(function(x, y) { return pos[x] - pos[y]; });
          mid = (related.length - 1) / 2;
          related.slice(Math.floor(mid), Math.ceil(mid) + 1).forEach(function(u) {
            if (align[v] === v) {
              if (!conflicts[undirEdgeId(u, v)] && prevIdx < pos[u]) {
                align[u] = v;
                align[v] = root[v] = root[u];
                prevIdx = pos[u];
              }
            }
          });
        }
      });
    });

    return { pos: pos, root: root, align: align };
  }

  // This function deviates from the standard BK algorithm in two ways. First
  // it takes into account the size of the nodes. Second it includes a fix to
  // the original algorithm that is described in Carstens, "Node and Label
  // Placement in a Layered Layout Algorithm".
  function horizontalCompaction(g, layering, pos, root, align) {
    var sink = {},       // Mapping of node id -> sink node id for class
        maybeShift = {}, // Mapping of sink node id -> { class node id, min shift }
        shift = {},      // Mapping of sink node id -> shift
        pred = {},       // Mapping of node id -> predecessor node (or null)
        xs = {};         // Calculated X positions

    layering.forEach(function(layer) {
      layer.forEach(function(u, i) {
        sink[u] = u;
        maybeShift[u] = {};
        if (i > 0)
          pred[u] = layer[i - 1];
      });
    });

    function updateShift(toShift, neighbor, delta) {
      if (!(neighbor in maybeShift[toShift])) {
        maybeShift[toShift][neighbor] = delta;
      } else {
        maybeShift[toShift][neighbor] = Math.min(maybeShift[toShift][neighbor], delta);
      }
    }

    function placeBlock(v) {
      if (!(v in xs)) {
        xs[v] = 0;
        var w = v;
        do {
          if (pos[w] > 0) {
            var u = root[pred[w]];
            placeBlock(u);
            if (sink[v] === v) {
              sink[v] = sink[u];
            }
            var delta = sep(g, pred[w]) + sep(g, w);
            if (sink[v] !== sink[u]) {
              updateShift(sink[u], sink[v], xs[v] - xs[u] - delta);
            } else {
              xs[v] = Math.max(xs[v], xs[u] + delta);
            }
          }
          w = align[w];
        } while (w !== v);
      }
    }

    // Root coordinates relative to sink
    util.values(root).forEach(function(v) {
      placeBlock(v);
    });

    // Absolute coordinates
    // There is an assumption here that we've resolved shifts for any classes
    // that begin at an earlier layer. We guarantee this by visiting layers in
    // order.
    layering.forEach(function(layer) {
      layer.forEach(function(v) {
        xs[v] = xs[root[v]];
        if (v === root[v] && v === sink[v]) {
          var minShift = 0;
          if (v in maybeShift && Object.keys(maybeShift[v]).length > 0) {
            minShift = util.min(Object.keys(maybeShift[v])
                                 .map(function(u) {
                                      return maybeShift[v][u] + (u in shift ? shift[u] : 0);
                                      }
                                 ));
          }
          shift[v] = minShift;
        }
      });
    });

    layering.forEach(function(layer) {
      layer.forEach(function(v) {
        xs[v] += shift[sink[root[v]]] || 0;
      });
    });

    return xs;
  }

  function findMinCoord(g, layering, xs) {
    return util.min(layering.map(function(layer) {
      var u = layer[0];
      return xs[u];
    }));
  }

  function findMaxCoord(g, layering, xs) {
    return util.max(layering.map(function(layer) {
      var u = layer[layer.length - 1];
      return xs[u];
    }));
  }

  function balance(g, layering, xss) {
    var min = {},                            // Min coordinate for the alignment
        max = {},                            // Max coordinate for the alginment
        smallestAlignment,
        shift = {};                          // Amount to shift a given alignment

    function updateAlignment(v) {
      xss[alignment][v] += shift[alignment];
    }

    var smallest = Number.POSITIVE_INFINITY;
    for (var alignment in xss) {
      var xs = xss[alignment];
      min[alignment] = findMinCoord(g, layering, xs);
      max[alignment] = findMaxCoord(g, layering, xs);
      var w = max[alignment] - min[alignment];
      if (w < smallest) {
        smallest = w;
        smallestAlignment = alignment;
      }
    }

    // Determine how much to adjust positioning for each alignment
    ['u', 'd'].forEach(function(vertDir) {
      ['l', 'r'].forEach(function(horizDir) {
        var alignment = vertDir + horizDir;
        shift[alignment] = horizDir === 'l'
            ? min[smallestAlignment] - min[alignment]
            : max[smallestAlignment] - max[alignment];
      });
    });

    // Find average of medians for xss array
    for (alignment in xss) {
      g.eachNode(updateAlignment);
    }
  }

  function flipHorizontally(xs) {
    for (var u in xs) {
      xs[u] = -xs[u];
    }
  }

  function reverseInnerOrder(layering) {
    layering.forEach(function(layer) {
      layer.reverse();
    });
  }

  function width(g, u) {
    switch (g.graph().rankDir) {
      case 'LR': return g.node(u).height;
      case 'RL': return g.node(u).height;
      default:   return g.node(u).width;
    }
  }

  function height(g, u) {
    switch(g.graph().rankDir) {
      case 'LR': return g.node(u).width;
      case 'RL': return g.node(u).width;
      default:   return g.node(u).height;
    }
  }

  function sep(g, u) {
    if (config.universalSep !== null) {
      return config.universalSep;
    }
    var w = width(g, u);
    var s = g.node(u).dummy ? config.edgeSep : config.nodeSep;
    return (w + s) / 2;
  }

  function posX(g, u, x) {
    if (g.graph().rankDir === 'LR' || g.graph().rankDir === 'RL') {
      if (arguments.length < 3) {
        return g.node(u).y;
      } else {
        g.node(u).y = x;
      }
    } else {
      if (arguments.length < 3) {
        return g.node(u).x;
      } else {
        g.node(u).x = x;
      }
    }
  }

  function posXDebug(name, g, u, x) {
    if (g.graph().rankDir === 'LR' || g.graph().rankDir === 'RL') {
      if (arguments.length < 3) {
        return g.node(u)[name];
      } else {
        g.node(u)[name] = x;
      }
    } else {
      if (arguments.length < 3) {
        return g.node(u)[name];
      } else {
        g.node(u)[name] = x;
      }
    }
  }

  function posY(g, u, y) {
    if (g.graph().rankDir === 'LR' || g.graph().rankDir === 'RL') {
      if (arguments.length < 3) {
        return g.node(u).x;
      } else {
        g.node(u).x = y;
      }
    } else {
      if (arguments.length < 3) {
        return g.node(u).y;
      } else {
        g.node(u).y = y;
      }
    }
  }

  function debugPositioning(align, g, layering, xs) {
    layering.forEach(function(l, li) {
      var u, xU;
      l.forEach(function(v) {
        var xV = xs[v];
        if (u) {
          var s = sep(g, u) + sep(g, v);
          if (xV - xU < s)
            console.log('Position phase: sep violation. Align: ' + align + '. Layer: ' + li + '. ' +
              'U: ' + u + ' V: ' + v + '. Actual sep: ' + (xV - xU) + ' Expected sep: ' + s);
        }
        u = v;
        xU = xV;
      });
    });
  }
};

},{"./util":28}],21:[function(require,module,exports){
var util = require('./util'),
    acyclic = require('./rank/acyclic'),
    initRank = require('./rank/initRank'),
    feasibleTree = require('./rank/feasibleTree'),
    constraints = require('./rank/constraints'),
    simplex = require('./rank/simplex'),
    components = require('graphlib').alg.components,
    filter = require('graphlib').filter;

exports.run = run;
exports.restoreEdges = restoreEdges;

/*
 * Heuristic function that assigns a rank to each node of the input graph with
 * the intent of minimizing edge lengths, while respecting the `minLen`
 * attribute of incident edges.
 *
 * Prerequisites:
 *
 *  * Each edge in the input graph must have an assigned 'minLen' attribute
 */
function run(g, useSimplex) {
  expandSelfLoops(g);

  // If there are rank constraints on nodes, then build a new graph that
  // encodes the constraints.
  util.time('constraints.apply', constraints.apply)(g);

  expandSidewaysEdges(g);

  // Reverse edges to get an acyclic graph, we keep the graph in an acyclic
  // state until the very end.
  util.time('acyclic', acyclic)(g);

  // Convert the graph into a flat graph for ranking
  var flatGraph = g.filterNodes(util.filterNonSubgraphs(g));

  // Assign an initial ranking using DFS.
  initRank(flatGraph);

  // For each component improve the assigned ranks.
  components(flatGraph).forEach(function(cmpt) {
    var subgraph = flatGraph.filterNodes(filter.nodesFromList(cmpt));
    rankComponent(subgraph, useSimplex);
  });

  // Relax original constraints
  util.time('constraints.relax', constraints.relax(g));

  // When handling nodes with constrained ranks it is possible to end up with
  // edges that point to previous ranks. Most of the subsequent algorithms assume
  // that edges are pointing to successive ranks only. Here we reverse any "back
  // edges" and mark them as such. The acyclic algorithm will reverse them as a
  // post processing step.
  util.time('reorientEdges', reorientEdges)(g);
}

function restoreEdges(g) {
  acyclic.undo(g);
}

/*
 * Expand self loops into three dummy nodes. One will sit above the incident
 * node, one will be at the same level, and one below. The result looks like:
 *
 *         /--<--x--->--\
 *     node              y
 *         \--<--z--->--/
 *
 * Dummy nodes x, y, z give us the shape of a loop and node y is where we place
 * the label.
 *
 * TODO: consolidate knowledge of dummy node construction.
 * TODO: support minLen = 2
 */
function expandSelfLoops(g) {
  g.eachEdge(function(e, u, v, a) {
    if (u === v) {
      var x = addDummyNode(g, e, u, v, a, 0, false),
          y = addDummyNode(g, e, u, v, a, 1, true),
          z = addDummyNode(g, e, u, v, a, 2, false);
      g.addEdge(null, x, u, {minLen: 1, selfLoop: true});
      g.addEdge(null, x, y, {minLen: 1, selfLoop: true});
      g.addEdge(null, u, z, {minLen: 1, selfLoop: true});
      g.addEdge(null, y, z, {minLen: 1, selfLoop: true});
      g.delEdge(e);
    }
  });
}

function expandSidewaysEdges(g) {
  g.eachEdge(function(e, u, v, a) {
    if (u === v) {
      var origEdge = a.originalEdge,
          dummy = addDummyNode(g, origEdge.e, origEdge.u, origEdge.v, origEdge.value, 0, true);
      g.addEdge(null, u, dummy, {minLen: 1});
      g.addEdge(null, dummy, v, {minLen: 1});
      g.delEdge(e);
    }
  });
}

function addDummyNode(g, e, u, v, a, index, isLabel) {
  return g.addNode(null, {
    width: isLabel ? a.width : 0,
    height: isLabel ? a.height : 0,
    edge: { id: e, source: u, target: v, attrs: a },
    dummy: true,
    index: index
  });
}

function reorientEdges(g) {
  g.eachEdge(function(e, u, v, value) {
    if (g.node(u).rank > g.node(v).rank) {
      g.delEdge(e);
      value.reversed = true;
      g.addEdge(e, v, u, value);
    }
  });
}

function rankComponent(subgraph, useSimplex) {
  var spanningTree = feasibleTree(subgraph);

  if (useSimplex) {
    util.log(1, 'Using network simplex for ranking');
    simplex(subgraph, spanningTree);
  }
  normalize(subgraph);
}

function normalize(g) {
  var m = util.min(g.nodes().map(function(u) { return g.node(u).rank; }));
  g.eachNode(function(u, node) { node.rank -= m; });
}

},{"./rank/acyclic":22,"./rank/constraints":23,"./rank/feasibleTree":24,"./rank/initRank":25,"./rank/simplex":27,"./util":28,"graphlib":35}],22:[function(require,module,exports){
var util = require('../util');

module.exports = acyclic;
module.exports.undo = undo;

/*
 * This function takes a directed graph that may have cycles and reverses edges
 * as appropriate to break these cycles. Each reversed edge is assigned a
 * `reversed` attribute with the value `true`.
 *
 * There should be no self loops in the graph.
 */
function acyclic(g) {
  var onStack = {},
      visited = {},
      reverseCount = 0;
  
  function dfs(u) {
    if (u in visited) return;
    visited[u] = onStack[u] = true;
    g.outEdges(u).forEach(function(e) {
      var t = g.target(e),
          value;

      if (u === t) {
        console.error('Warning: found self loop "' + e + '" for node "' + u + '"');
      } else if (t in onStack) {
        value = g.edge(e);
        g.delEdge(e);
        value.reversed = true;
        ++reverseCount;
        g.addEdge(e, t, u, value);
      } else {
        dfs(t);
      }
    });

    delete onStack[u];
  }

  g.eachNode(function(u) { dfs(u); });

  util.log(2, 'Acyclic Phase: reversed ' + reverseCount + ' edge(s)');

  return reverseCount;
}

/*
 * Given a graph that has had the acyclic operation applied, this function
 * undoes that operation. More specifically, any edge with the `reversed`
 * attribute is again reversed to restore the original direction of the edge.
 */
function undo(g) {
  g.eachEdge(function(e, s, t, a) {
    if (a.reversed) {
      delete a.reversed;
      g.delEdge(e);
      g.addEdge(e, t, s, a);
    }
  });
}

},{"../util":28}],23:[function(require,module,exports){
exports.apply = function(g) {
  function dfs(sg) {
    var rankSets = {};
    g.children(sg).forEach(function(u) {
      if (g.children(u).length) {
        dfs(u);
        return;
      }

      var value = g.node(u),
          prefRank = value.prefRank;
      if (prefRank !== undefined) {
        if (!checkSupportedPrefRank(prefRank)) { return; }

        if (!(prefRank in rankSets)) {
          rankSets.prefRank = [u];
        } else {
          rankSets.prefRank.push(u);
        }

        var newU = rankSets[prefRank];
        if (newU === undefined) {
          newU = rankSets[prefRank] = g.addNode(null, { originalNodes: [] });
          g.parent(newU, sg);
        }

        redirectInEdges(g, u, newU, prefRank === 'min');
        redirectOutEdges(g, u, newU, prefRank === 'max');

        // Save original node and remove it from reduced graph
        g.node(newU).originalNodes.push({ u: u, value: value, parent: sg });
        g.delNode(u);
      }
    });

    addLightEdgesFromMinNode(g, sg, rankSets.min);
    addLightEdgesToMaxNode(g, sg, rankSets.max);
  }

  dfs(null);
};

function checkSupportedPrefRank(prefRank) {
  if (prefRank !== 'min' && prefRank !== 'max' && prefRank.indexOf('same_') !== 0) {
    console.error('Unsupported rank type: ' + prefRank);
    return false;
  }
  return true;
}

function redirectInEdges(g, u, newU, reverse) {
  g.inEdges(u).forEach(function(e) {
    var origValue = g.edge(e),
        value;
    if (origValue.originalEdge) {
      value = origValue;
    } else {
      value =  {
        originalEdge: { e: e, u: g.source(e), v: g.target(e), value: origValue },
        minLen: g.edge(e).minLen
      };
    }

    // Do not reverse edges for self-loops.
    if (origValue.selfLoop) {
      reverse = false;
    }

    if (reverse) {
      // Ensure that all edges to min are reversed
      g.addEdge(null, newU, g.source(e), value);
      value.reversed = true;
    } else {
      g.addEdge(null, g.source(e), newU, value);
    }
  });
}

function redirectOutEdges(g, u, newU, reverse) {
  g.outEdges(u).forEach(function(e) {
    var origValue = g.edge(e),
        value;
    if (origValue.originalEdge) {
      value = origValue;
    } else {
      value =  {
        originalEdge: { e: e, u: g.source(e), v: g.target(e), value: origValue },
        minLen: g.edge(e).minLen
      };
    }

    // Do not reverse edges for self-loops.
    if (origValue.selfLoop) {
      reverse = false;
    }

    if (reverse) {
      // Ensure that all edges from max are reversed
      g.addEdge(null, g.target(e), newU, value);
      value.reversed = true;
    } else {
      g.addEdge(null, newU, g.target(e), value);
    }
  });
}

function addLightEdgesFromMinNode(g, sg, minNode) {
  if (minNode !== undefined) {
    g.children(sg).forEach(function(u) {
      // The dummy check ensures we don't add an edge if the node is involved
      // in a self loop or sideways edge.
      if (u !== minNode && !g.outEdges(minNode, u).length && !g.node(u).dummy) {
        g.addEdge(null, minNode, u, { minLen: 0 });
      }
    });
  }
}

function addLightEdgesToMaxNode(g, sg, maxNode) {
  if (maxNode !== undefined) {
    g.children(sg).forEach(function(u) {
      // The dummy check ensures we don't add an edge if the node is involved
      // in a self loop or sideways edge.
      if (u !== maxNode && !g.outEdges(u, maxNode).length && !g.node(u).dummy) {
        g.addEdge(null, u, maxNode, { minLen: 0 });
      }
    });
  }
}

/*
 * This function "relaxes" the constraints applied previously by the "apply"
 * function. It expands any nodes that were collapsed and assigns the rank of
 * the collapsed node to each of the expanded nodes. It also restores the
 * original edges and removes any dummy edges pointing at the collapsed nodes.
 *
 * Note that the process of removing collapsed nodes also removes dummy edges
 * automatically.
 */
exports.relax = function(g) {
  // Save original edges
  var originalEdges = [];
  g.eachEdge(function(e, u, v, value) {
    var originalEdge = value.originalEdge;
    if (originalEdge) {
      originalEdges.push(originalEdge);
    }
  });

  // Expand collapsed nodes
  g.eachNode(function(u, value) {
    var originalNodes = value.originalNodes;
    if (originalNodes) {
      originalNodes.forEach(function(originalNode) {
        originalNode.value.rank = value.rank;
        g.addNode(originalNode.u, originalNode.value);
        g.parent(originalNode.u, originalNode.parent);
      });
      g.delNode(u);
    }
  });

  // Restore original edges
  originalEdges.forEach(function(edge) {
    g.addEdge(edge.e, edge.u, edge.v, edge.value);
  });
};

},{}],24:[function(require,module,exports){
/* jshint -W079 */
var Set = require('cp-data').Set,
/* jshint +W079 */
    Digraph = require('graphlib').Digraph,
    util = require('../util');

module.exports = feasibleTree;

/*
 * Given an acyclic graph with each node assigned a `rank` attribute, this
 * function constructs and returns a spanning tree. This function may reduce
 * the length of some edges from the initial rank assignment while maintaining
 * the `minLen` specified by each edge.
 *
 * Prerequisites:
 *
 * * The input graph is acyclic
 * * Each node in the input graph has an assigned `rank` attribute
 * * Each edge in the input graph has an assigned `minLen` attribute
 *
 * Outputs:
 *
 * A feasible spanning tree for the input graph (i.e. a spanning tree that
 * respects each graph edge's `minLen` attribute) represented as a Digraph with
 * a `root` attribute on graph.
 *
 * Nodes have the same id and value as that in the input graph.
 *
 * Edges in the tree have arbitrarily assigned ids. The attributes for edges
 * include `reversed`. `reversed` indicates that the edge is a
 * back edge in the input graph.
 */
function feasibleTree(g) {
  var remaining = new Set(g.nodes()),
      tree = new Digraph();

  if (remaining.size() === 1) {
    var root = g.nodes()[0];
    tree.addNode(root, {});
    tree.graph({ root: root });
    return tree;
  }

  function addTightEdges(v) {
    var continueToScan = true;
    g.predecessors(v).forEach(function(u) {
      if (remaining.has(u) && !slack(g, u, v)) {
        if (remaining.has(v)) {
          tree.addNode(v, {});
          remaining.remove(v);
          tree.graph({ root: v });
        }

        tree.addNode(u, {});
        tree.addEdge(null, u, v, { reversed: true });
        remaining.remove(u);
        addTightEdges(u);
        continueToScan = false;
      }
    });

    g.successors(v).forEach(function(w)  {
      if (remaining.has(w) && !slack(g, v, w)) {
        if (remaining.has(v)) {
          tree.addNode(v, {});
          remaining.remove(v);
          tree.graph({ root: v });
        }

        tree.addNode(w, {});
        tree.addEdge(null, v, w, {});
        remaining.remove(w);
        addTightEdges(w);
        continueToScan = false;
      }
    });
    return continueToScan;
  }

  function createTightEdge() {
    var minSlack = Number.MAX_VALUE;
    remaining.keys().forEach(function(v) {
      g.predecessors(v).forEach(function(u) {
        if (!remaining.has(u)) {
          var edgeSlack = slack(g, u, v);
          if (Math.abs(edgeSlack) < Math.abs(minSlack)) {
            minSlack = -edgeSlack;
          }
        }
      });

      g.successors(v).forEach(function(w) {
        if (!remaining.has(w)) {
          var edgeSlack = slack(g, v, w);
          if (Math.abs(edgeSlack) < Math.abs(minSlack)) {
            minSlack = edgeSlack;
          }
        }
      });
    });

    tree.eachNode(function(u) { g.node(u).rank -= minSlack; });
  }

  while (remaining.size()) {
    var nodesToSearch = !tree.order() ? remaining.keys() : tree.nodes();
    for (var i = 0, il = nodesToSearch.length;
         i < il && addTightEdges(nodesToSearch[i]);
         ++i);
    if (remaining.size()) {
      createTightEdge();
    }
  }

  return tree;
}

function slack(g, u, v) {
  var rankDiff = g.node(v).rank - g.node(u).rank;
  var maxMinLen = util.max(g.outEdges(u, v)
                            .map(function(e) { return g.edge(e).minLen; }));
  return rankDiff - maxMinLen;
}

},{"../util":28,"cp-data":30,"graphlib":35}],25:[function(require,module,exports){
var util = require('../util'),
    topsort = require('graphlib').alg.topsort;

module.exports = initRank;

/*
 * Assigns a `rank` attribute to each node in the input graph and ensures that
 * this rank respects the `minLen` attribute of incident edges.
 *
 * Prerequisites:
 *
 *  * The input graph must be acyclic
 *  * Each edge in the input graph must have an assigned 'minLen' attribute
 */
function initRank(g) {
  var sorted = topsort(g);

  sorted.forEach(function(u) {
    var inEdges = g.inEdges(u);
    if (inEdges.length === 0) {
      g.node(u).rank = 0;
      return;
    }

    var minLens = inEdges.map(function(e) {
      return g.node(g.source(e)).rank + g.edge(e).minLen;
    });
    g.node(u).rank = util.max(minLens);
  });
}

},{"../util":28,"graphlib":35}],26:[function(require,module,exports){
module.exports = {
  slack: slack
};

/*
 * A helper to calculate the slack between two nodes (`u` and `v`) given a
 * `minLen` constraint. The slack represents how much the distance between `u`
 * and `v` could shrink while maintaining the `minLen` constraint. If the value
 * is negative then the constraint is currently violated.
 *
  This function requires that `u` and `v` are in `graph` and they both have a
  `rank` attribute.
 */
function slack(graph, u, v, minLen) {
  return Math.abs(graph.node(u).rank - graph.node(v).rank) - minLen;
}

},{}],27:[function(require,module,exports){
var util = require('../util'),
    rankUtil = require('./rankUtil');

module.exports = simplex;

function simplex(graph, spanningTree) {
  // The network simplex algorithm repeatedly replaces edges of
  // the spanning tree with negative cut values until no such
  // edge exists.
  initCutValues(graph, spanningTree);
  while (true) {
    var e = leaveEdge(spanningTree);
    if (e === null) break;
    var f = enterEdge(graph, spanningTree, e);
    exchange(graph, spanningTree, e, f);
  }
}

/*
 * Set the cut values of edges in the spanning tree by a depth-first
 * postorder traversal.  The cut value corresponds to the cost, in
 * terms of a ranking's edge length sum, of lengthening an edge.
 * Negative cut values typically indicate edges that would yield a
 * smaller edge length sum if they were lengthened.
 */
function initCutValues(graph, spanningTree) {
  computeLowLim(spanningTree);

  spanningTree.eachEdge(function(id, u, v, treeValue) {
    treeValue.cutValue = 0;
  });

  // Propagate cut values up the tree.
  function dfs(n) {
    var children = spanningTree.successors(n);
    for (var c in children) {
      var child = children[c];
      dfs(child);
    }
    if (n !== spanningTree.graph().root) {
      setCutValue(graph, spanningTree, n);
    }
  }
  dfs(spanningTree.graph().root);
}

/*
 * Perform a DFS postorder traversal, labeling each node v with
 * its traversal order 'lim(v)' and the minimum traversal number
 * of any of its descendants 'low(v)'.  This provides an efficient
 * way to test whether u is an ancestor of v since
 * low(u) <= lim(v) <= lim(u) if and only if u is an ancestor.
 */
function computeLowLim(tree) {
  var postOrderNum = 0;
  
  function dfs(n) {
    var children = tree.successors(n);
    var low = postOrderNum;
    for (var c in children) {
      var child = children[c];
      dfs(child);
      low = Math.min(low, tree.node(child).low);
    }
    tree.node(n).low = low;
    tree.node(n).lim = postOrderNum++;
  }

  dfs(tree.graph().root);
}

/*
 * To compute the cut value of the edge parent -> child, we consider
 * it and any other graph edges to or from the child.
 *          parent
 *             |
 *           child
 *          /      \
 *         u        v
 */
function setCutValue(graph, tree, child) {
  var parentEdge = tree.inEdges(child)[0];

  // List of child's children in the spanning tree.
  var grandchildren = [];
  var grandchildEdges = tree.outEdges(child);
  for (var gce in grandchildEdges) {
    grandchildren.push(tree.target(grandchildEdges[gce]));
  }

  var cutValue = 0;

  // TODO: Replace unit increment/decrement with edge weights.
  var E = 0;    // Edges from child to grandchild's subtree.
  var F = 0;    // Edges to child from grandchild's subtree.
  var G = 0;    // Edges from child to nodes outside of child's subtree.
  var H = 0;    // Edges from nodes outside of child's subtree to child.

  // Consider all graph edges from child.
  var outEdges = graph.outEdges(child);
  var gc;
  for (var oe in outEdges) {
    var succ = graph.target(outEdges[oe]);
    for (gc in grandchildren) {
      if (inSubtree(tree, succ, grandchildren[gc])) {
        E++;
      }
    }
    if (!inSubtree(tree, succ, child)) {
      G++;
    }
  }

  // Consider all graph edges to child.
  var inEdges = graph.inEdges(child);
  for (var ie in inEdges) {
    var pred = graph.source(inEdges[ie]);
    for (gc in grandchildren) {
      if (inSubtree(tree, pred, grandchildren[gc])) {
        F++;
      }
    }
    if (!inSubtree(tree, pred, child)) {
      H++;
    }
  }

  // Contributions depend on the alignment of the parent -> child edge
  // and the child -> u or v edges.
  var grandchildCutSum = 0;
  for (gc in grandchildren) {
    var cv = tree.edge(grandchildEdges[gc]).cutValue;
    if (!tree.edge(grandchildEdges[gc]).reversed) {
      grandchildCutSum += cv;
    } else {
      grandchildCutSum -= cv;
    }
  }

  if (!tree.edge(parentEdge).reversed) {
    cutValue += grandchildCutSum - E + F - G + H;
  } else {
    cutValue -= grandchildCutSum - E + F - G + H;
  }

  tree.edge(parentEdge).cutValue = cutValue;
}

/*
 * Return whether n is a node in the subtree with the given
 * root.
 */
function inSubtree(tree, n, root) {
  return (tree.node(root).low <= tree.node(n).lim &&
          tree.node(n).lim <= tree.node(root).lim);
}

/*
 * Return an edge from the tree with a negative cut value, or null if there
 * is none.
 */
function leaveEdge(tree) {
  var edges = tree.edges();
  for (var n in edges) {
    var e = edges[n];
    var treeValue = tree.edge(e);
    if (treeValue.cutValue < 0) {
      return e;
    }
  }
  return null;
}

/*
 * The edge e should be an edge in the tree, with an underlying edge
 * in the graph, with a negative cut value.  Of the two nodes incident
 * on the edge, take the lower one.  enterEdge returns an edge with
 * minimum slack going from outside of that node's subtree to inside
 * of that node's subtree.
 */
function enterEdge(graph, tree, e) {
  var source = tree.source(e);
  var target = tree.target(e);
  var lower = tree.node(target).lim < tree.node(source).lim ? target : source;

  // Is the tree edge aligned with the graph edge?
  var aligned = !tree.edge(e).reversed;

  var minSlack = Number.POSITIVE_INFINITY;
  var minSlackEdge;
  if (aligned) {
    graph.eachEdge(function(id, u, v, value) {
      if (id !== e && inSubtree(tree, u, lower) && !inSubtree(tree, v, lower)) {
        var slack = rankUtil.slack(graph, u, v, value.minLen);
        if (slack < minSlack) {
          minSlack = slack;
          minSlackEdge = id;
        }
      }
    });
  } else {
    graph.eachEdge(function(id, u, v, value) {
      if (id !== e && !inSubtree(tree, u, lower) && inSubtree(tree, v, lower)) {
        var slack = rankUtil.slack(graph, u, v, value.minLen);
        if (slack < minSlack) {
          minSlack = slack;
          minSlackEdge = id;
        }
      }
    });
  }

  if (minSlackEdge === undefined) {
    var outside = [];
    var inside = [];
    graph.eachNode(function(id) {
      if (!inSubtree(tree, id, lower)) {
        outside.push(id);
      } else {
        inside.push(id);
      }
    });
    throw new Error('No edge found from outside of tree to inside');
  }

  return minSlackEdge;
}

/*
 * Replace edge e with edge f in the tree, recalculating the tree root,
 * the nodes' low and lim properties and the edges' cut values.
 */
function exchange(graph, tree, e, f) {
  tree.delEdge(e);
  var source = graph.source(f);
  var target = graph.target(f);

  // Redirect edges so that target is the root of its subtree.
  function redirect(v) {
    var edges = tree.inEdges(v);
    for (var i in edges) {
      var e = edges[i];
      var u = tree.source(e);
      var value = tree.edge(e);
      redirect(u);
      tree.delEdge(e);
      value.reversed = !value.reversed;
      tree.addEdge(e, v, u, value);
    }
  }

  redirect(target);

  var root = source;
  var edges = tree.inEdges(root);
  while (edges.length > 0) {
    root = tree.source(edges[0]);
    edges = tree.inEdges(root);
  }

  tree.graph().root = root;

  tree.addEdge(null, source, target, {cutValue: 0});

  initCutValues(graph, tree);

  adjustRanks(graph, tree);
}

/*
 * Reset the ranks of all nodes based on the current spanning tree.
 * The rank of the tree's root remains unchanged, while all other
 * nodes are set to the sum of minimum length constraints along
 * the path from the root.
 */
function adjustRanks(graph, tree) {
  function dfs(p) {
    var children = tree.successors(p);
    children.forEach(function(c) {
      var minLen = minimumLength(graph, p, c);
      graph.node(c).rank = graph.node(p).rank + minLen;
      dfs(c);
    });
  }

  dfs(tree.graph().root);
}

/*
 * If u and v are connected by some edges in the graph, return the
 * minimum length of those edges, as a positive number if v succeeds
 * u and as a negative number if v precedes u.
 */
function minimumLength(graph, u, v) {
  var outEdges = graph.outEdges(u, v);
  if (outEdges.length > 0) {
    return util.max(outEdges.map(function(e) {
      return graph.edge(e).minLen;
    }));
  }

  var inEdges = graph.inEdges(u, v);
  if (inEdges.length > 0) {
    return -util.max(inEdges.map(function(e) {
      return graph.edge(e).minLen;
    }));
  }
}

},{"../util":28,"./rankUtil":26}],28:[function(require,module,exports){
/*
 * Returns the smallest value in the array.
 */
exports.min = function(values) {
  return Math.min.apply(Math, values);
};

/*
 * Returns the largest value in the array.
 */
exports.max = function(values) {
  return Math.max.apply(Math, values);
};

/*
 * Returns `true` only if `f(x)` is `true` for all `x` in `xs`. Otherwise
 * returns `false`. This function will return immediately if it finds a
 * case where `f(x)` does not hold.
 */
exports.all = function(xs, f) {
  for (var i = 0; i < xs.length; ++i) {
    if (!f(xs[i])) {
      return false;
    }
  }
  return true;
};

/*
 * Accumulates the sum of elements in the given array using the `+` operator.
 */
exports.sum = function(values) {
  return values.reduce(function(acc, x) { return acc + x; }, 0);
};

/*
 * Returns an array of all values in the given object.
 */
exports.values = function(obj) {
  return Object.keys(obj).map(function(k) { return obj[k]; });
};

exports.shuffle = function(array) {
  for (i = array.length - 1; i > 0; --i) {
    var j = Math.floor(Math.random() * (i + 1));
    var aj = array[j];
    array[j] = array[i];
    array[i] = aj;
  }
};

exports.propertyAccessor = function(self, config, field, setHook) {
  return function(x) {
    if (!arguments.length) return config[field];
    config[field] = x;
    if (setHook) setHook(x);
    return self;
  };
};

/*
 * Given a layered, directed graph with `rank` and `order` node attributes,
 * this function returns an array of ordered ranks. Each rank contains an array
 * of the ids of the nodes in that rank in the order specified by the `order`
 * attribute.
 */
exports.ordering = function(g) {
  var ordering = [];
  g.eachNode(function(u, value) {
    var rank = ordering[value.rank] || (ordering[value.rank] = []);
    rank[value.order] = u;
  });
  return ordering;
};

/*
 * A filter that can be used with `filterNodes` to get a graph that only
 * includes nodes that do not contain others nodes.
 */
exports.filterNonSubgraphs = function(g) {
  return function(u) {
    return g.children(u).length === 0;
  };
};

/*
 * Returns a new function that wraps `func` with a timer. The wrapper logs the
 * time it takes to execute the function.
 *
 * The timer will be enabled provided `log.level >= 1`.
 */
function time(name, func) {
  return function() {
    var start = new Date().getTime();
    try {
      return func.apply(null, arguments);
    } finally {
      log(1, name + ' time: ' + (new Date().getTime() - start) + 'ms');
    }
  };
}
time.enabled = false;

exports.time = time;

/*
 * A global logger with the specification `log(level, message, ...)` that
 * will log a message to the console if `log.level >= level`.
 */
function log(level) {
  if (log.level >= level) {
    console.log.apply(console, Array.prototype.slice.call(arguments, 1));
  }
}
log.level = 0;

exports.log = log;

},{}],29:[function(require,module,exports){
module.exports = '0.4.5';

},{}],30:[function(require,module,exports){
exports.Set = require('./lib/Set');
exports.PriorityQueue = require('./lib/PriorityQueue');
exports.version = require('./lib/version');

},{"./lib/PriorityQueue":31,"./lib/Set":32,"./lib/version":34}],31:[function(require,module,exports){
module.exports = PriorityQueue;

/**
 * A min-priority queue data structure. This algorithm is derived from Cormen,
 * et al., "Introduction to Algorithms". The basic idea of a min-priority
 * queue is that you can efficiently (in O(1) time) get the smallest key in
 * the queue. Adding and removing elements takes O(log n) time. A key can
 * have its priority decreased in O(log n) time.
 */
function PriorityQueue() {
  this._arr = [];
  this._keyIndices = {};
}

/**
 * Returns the number of elements in the queue. Takes `O(1)` time.
 */
PriorityQueue.prototype.size = function() {
  return this._arr.length;
};

/**
 * Returns the keys that are in the queue. Takes `O(n)` time.
 */
PriorityQueue.prototype.keys = function() {
  return this._arr.map(function(x) { return x.key; });
};

/**
 * Returns `true` if **key** is in the queue and `false` if not.
 */
PriorityQueue.prototype.has = function(key) {
  return key in this._keyIndices;
};

/**
 * Returns the priority for **key**. If **key** is not present in the queue
 * then this function returns `undefined`. Takes `O(1)` time.
 *
 * @param {Object} key
 */
PriorityQueue.prototype.priority = function(key) {
  var index = this._keyIndices[key];
  if (index !== undefined) {
    return this._arr[index].priority;
  }
};

/**
 * Returns the key for the minimum element in this queue. If the queue is
 * empty this function throws an Error. Takes `O(1)` time.
 */
PriorityQueue.prototype.min = function() {
  if (this.size() === 0) {
    throw new Error("Queue underflow");
  }
  return this._arr[0].key;
};

/**
 * Inserts a new key into the priority queue. If the key already exists in
 * the queue this function returns `false`; otherwise it will return `true`.
 * Takes `O(n)` time.
 *
 * @param {Object} key the key to add
 * @param {Number} priority the initial priority for the key
 */
PriorityQueue.prototype.add = function(key, priority) {
  var keyIndices = this._keyIndices;
  if (!(key in keyIndices)) {
    var arr = this._arr;
    var index = arr.length;
    keyIndices[key] = index;
    arr.push({key: key, priority: priority});
    this._decrease(index);
    return true;
  }
  return false;
};

/**
 * Removes and returns the smallest key in the queue. Takes `O(log n)` time.
 */
PriorityQueue.prototype.removeMin = function() {
  this._swap(0, this._arr.length - 1);
  var min = this._arr.pop();
  delete this._keyIndices[min.key];
  this._heapify(0);
  return min.key;
};

/**
 * Decreases the priority for **key** to **priority**. If the new priority is
 * greater than the previous priority, this function will throw an Error.
 *
 * @param {Object} key the key for which to raise priority
 * @param {Number} priority the new priority for the key
 */
PriorityQueue.prototype.decrease = function(key, priority) {
  var index = this._keyIndices[key];
  if (priority > this._arr[index].priority) {
    throw new Error("New priority is greater than current priority. " +
        "Key: " + key + " Old: " + this._arr[index].priority + " New: " + priority);
  }
  this._arr[index].priority = priority;
  this._decrease(index);
};

PriorityQueue.prototype._heapify = function(i) {
  var arr = this._arr;
  var l = 2 * i,
      r = l + 1,
      largest = i;
  if (l < arr.length) {
    largest = arr[l].priority < arr[largest].priority ? l : largest;
    if (r < arr.length) {
      largest = arr[r].priority < arr[largest].priority ? r : largest;
    }
    if (largest !== i) {
      this._swap(i, largest);
      this._heapify(largest);
    }
  }
};

PriorityQueue.prototype._decrease = function(index) {
  var arr = this._arr;
  var priority = arr[index].priority;
  var parent;
  while (index !== 0) {
    parent = index >> 1;
    if (arr[parent].priority < priority) {
      break;
    }
    this._swap(index, parent);
    index = parent;
  }
};

PriorityQueue.prototype._swap = function(i, j) {
  var arr = this._arr;
  var keyIndices = this._keyIndices;
  var origArrI = arr[i];
  var origArrJ = arr[j];
  arr[i] = origArrJ;
  arr[j] = origArrI;
  keyIndices[origArrJ.key] = i;
  keyIndices[origArrI.key] = j;
};

},{}],32:[function(require,module,exports){
var util = require('./util');

module.exports = Set;

/**
 * Constructs a new Set with an optional set of `initialKeys`.
 *
 * It is important to note that keys are coerced to String for most purposes
 * with this object, similar to the behavior of JavaScript's Object. For
 * example, the following will add only one key:
 *
 *     var s = new Set();
 *     s.add(1);
 *     s.add("1");
 *
 * However, the type of the key is preserved internally so that `keys` returns
 * the original key set uncoerced. For the above example, `keys` would return
 * `[1]`.
 */
function Set(initialKeys) {
  this._size = 0;
  this._keys = {};

  if (initialKeys) {
    for (var i = 0, il = initialKeys.length; i < il; ++i) {
      this.add(initialKeys[i]);
    }
  }
}

/**
 * Returns a new Set that represents the set intersection of the array of given
 * sets.
 */
Set.intersect = function(sets) {
  if (sets.length === 0) {
    return new Set();
  }

  var result = new Set(!util.isArray(sets[0]) ? sets[0].keys() : sets[0]);
  for (var i = 1, il = sets.length; i < il; ++i) {
    var resultKeys = result.keys(),
        other = !util.isArray(sets[i]) ? sets[i] : new Set(sets[i]);
    for (var j = 0, jl = resultKeys.length; j < jl; ++j) {
      var key = resultKeys[j];
      if (!other.has(key)) {
        result.remove(key);
      }
    }
  }

  return result;
};

/**
 * Returns a new Set that represents the set union of the array of given sets.
 */
Set.union = function(sets) {
  var totalElems = util.reduce(sets, function(lhs, rhs) {
    return lhs + (rhs.size ? rhs.size() : rhs.length);
  }, 0);
  var arr = new Array(totalElems);

  var k = 0;
  for (var i = 0, il = sets.length; i < il; ++i) {
    var cur = sets[i],
        keys = !util.isArray(cur) ? cur.keys() : cur;
    for (var j = 0, jl = keys.length; j < jl; ++j) {
      arr[k++] = keys[j];
    }
  }

  return new Set(arr);
};

/**
 * Returns the size of this set in `O(1)` time.
 */
Set.prototype.size = function() {
  return this._size;
};

/**
 * Returns the keys in this set. Takes `O(n)` time.
 */
Set.prototype.keys = function() {
  return values(this._keys);
};

/**
 * Tests if a key is present in this Set. Returns `true` if it is and `false`
 * if not. Takes `O(1)` time.
 */
Set.prototype.has = function(key) {
  return key in this._keys;
};

/**
 * Adds a new key to this Set if it is not already present. Returns `true` if
 * the key was added and `false` if it was already present. Takes `O(1)` time.
 */
Set.prototype.add = function(key) {
  if (!(key in this._keys)) {
    this._keys[key] = key;
    ++this._size;
    return true;
  }
  return false;
};

/**
 * Removes a key from this Set. If the key was removed this function returns
 * `true`. If not, it returns `false`. Takes `O(1)` time.
 */
Set.prototype.remove = function(key) {
  if (key in this._keys) {
    delete this._keys[key];
    --this._size;
    return true;
  }
  return false;
};

/*
 * Returns an array of all values for properties of **o**.
 */
function values(o) {
  var ks = Object.keys(o),
      len = ks.length,
      result = new Array(len),
      i;
  for (i = 0; i < len; ++i) {
    result[i] = o[ks[i]];
  }
  return result;
}

},{"./util":33}],33:[function(require,module,exports){
/*
 * This polyfill comes from
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
 */
if(!Array.isArray) {
  exports.isArray = function (vArg) {
    return Object.prototype.toString.call(vArg) === '[object Array]';
  };
} else {
  exports.isArray = Array.isArray;
}

/*
 * Slightly adapted polyfill from
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
 */
if ('function' !== typeof Array.prototype.reduce) {
  exports.reduce = function(array, callback, opt_initialValue) {
    'use strict';
    if (null === array || 'undefined' === typeof array) {
      // At the moment all modern browsers, that support strict mode, have
      // native implementation of Array.prototype.reduce. For instance, IE8
      // does not support strict mode, so this check is actually useless.
      throw new TypeError(
          'Array.prototype.reduce called on null or undefined');
    }
    if ('function' !== typeof callback) {
      throw new TypeError(callback + ' is not a function');
    }
    var index, value,
        length = array.length >>> 0,
        isValueSet = false;
    if (1 < arguments.length) {
      value = opt_initialValue;
      isValueSet = true;
    }
    for (index = 0; length > index; ++index) {
      if (array.hasOwnProperty(index)) {
        if (isValueSet) {
          value = callback(value, array[index], index, array);
        }
        else {
          value = array[index];
          isValueSet = true;
        }
      }
    }
    if (!isValueSet) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    return value;
  };
} else {
  exports.reduce = function(array, callback, opt_initialValue) {
    return array.reduce(callback, opt_initialValue);
  };
}

},{}],34:[function(require,module,exports){
module.exports = '1.1.3';

},{}],35:[function(require,module,exports){
exports.Graph = require("./lib/Graph");
exports.Digraph = require("./lib/Digraph");
exports.CGraph = require("./lib/CGraph");
exports.CDigraph = require("./lib/CDigraph");
require("./lib/graph-converters");

exports.alg = {
  isAcyclic: require("./lib/alg/isAcyclic"),
  components: require("./lib/alg/components"),
  dijkstra: require("./lib/alg/dijkstra"),
  dijkstraAll: require("./lib/alg/dijkstraAll"),
  findCycles: require("./lib/alg/findCycles"),
  floydWarshall: require("./lib/alg/floydWarshall"),
  postorder: require("./lib/alg/postorder"),
  preorder: require("./lib/alg/preorder"),
  prim: require("./lib/alg/prim"),
  tarjan: require("./lib/alg/tarjan"),
  topsort: require("./lib/alg/topsort")
};

exports.converter = {
  json: require("./lib/converter/json.js")
};

var filter = require("./lib/filter");
exports.filter = {
  all: filter.all,
  nodesFromList: filter.nodesFromList
};

exports.version = require("./lib/version");

},{"./lib/CDigraph":37,"./lib/CGraph":38,"./lib/Digraph":39,"./lib/Graph":40,"./lib/alg/components":41,"./lib/alg/dijkstra":42,"./lib/alg/dijkstraAll":43,"./lib/alg/findCycles":44,"./lib/alg/floydWarshall":45,"./lib/alg/isAcyclic":46,"./lib/alg/postorder":47,"./lib/alg/preorder":48,"./lib/alg/prim":49,"./lib/alg/tarjan":50,"./lib/alg/topsort":51,"./lib/converter/json.js":53,"./lib/filter":54,"./lib/graph-converters":55,"./lib/version":57}],36:[function(require,module,exports){
/* jshint -W079 */
var Set = require("cp-data").Set;
/* jshint +W079 */

module.exports = BaseGraph;

function BaseGraph() {
  // The value assigned to the graph itself.
  this._value = undefined;

  // Map of node id -> { id, value }
  this._nodes = {};

  // Map of edge id -> { id, u, v, value }
  this._edges = {};

  // Used to generate a unique id in the graph
  this._nextId = 0;
}

// Number of nodes
BaseGraph.prototype.order = function() {
  return Object.keys(this._nodes).length;
};

// Number of edges
BaseGraph.prototype.size = function() {
  return Object.keys(this._edges).length;
};

// Accessor for graph level value
BaseGraph.prototype.graph = function(value) {
  if (arguments.length === 0) {
    return this._value;
  }
  this._value = value;
};

BaseGraph.prototype.hasNode = function(u) {
  return u in this._nodes;
};

BaseGraph.prototype.node = function(u, value) {
  var node = this._strictGetNode(u);
  if (arguments.length === 1) {
    return node.value;
  }
  node.value = value;
};

BaseGraph.prototype.nodes = function() {
  var nodes = [];
  this.eachNode(function(id) { nodes.push(id); });
  return nodes;
};

BaseGraph.prototype.eachNode = function(func) {
  for (var k in this._nodes) {
    var node = this._nodes[k];
    func(node.id, node.value);
  }
};

BaseGraph.prototype.hasEdge = function(e) {
  return e in this._edges;
};

BaseGraph.prototype.edge = function(e, value) {
  var edge = this._strictGetEdge(e);
  if (arguments.length === 1) {
    return edge.value;
  }
  edge.value = value;
};

BaseGraph.prototype.edges = function() {
  var es = [];
  this.eachEdge(function(id) { es.push(id); });
  return es;
};

BaseGraph.prototype.eachEdge = function(func) {
  for (var k in this._edges) {
    var edge = this._edges[k];
    func(edge.id, edge.u, edge.v, edge.value);
  }
};

BaseGraph.prototype.incidentNodes = function(e) {
  var edge = this._strictGetEdge(e);
  return [edge.u, edge.v];
};

BaseGraph.prototype.addNode = function(u, value) {
  if (u === undefined || u === null) {
    do {
      u = "_" + (++this._nextId);
    } while (this.hasNode(u));
  } else if (this.hasNode(u)) {
    throw new Error("Graph already has node '" + u + "'");
  }
  this._nodes[u] = { id: u, value: value };
  return u;
};

BaseGraph.prototype.delNode = function(u) {
  this._strictGetNode(u);
  this.incidentEdges(u).forEach(function(e) { this.delEdge(e); }, this);
  delete this._nodes[u];
};

// inMap and outMap are opposite sides of an incidence map. For example, for
// Graph these would both come from the _incidentEdges map, while for Digraph
// they would come from _inEdges and _outEdges.
BaseGraph.prototype._addEdge = function(e, u, v, value, inMap, outMap) {
  this._strictGetNode(u);
  this._strictGetNode(v);

  if (e === undefined || e === null) {
    do {
      e = "_" + (++this._nextId);
    } while (this.hasEdge(e));
  }
  else if (this.hasEdge(e)) {
    throw new Error("Graph already has edge '" + e + "'");
  }

  this._edges[e] = { id: e, u: u, v: v, value: value };
  addEdgeToMap(inMap[v], u, e);
  addEdgeToMap(outMap[u], v, e);

  return e;
};

// See note for _addEdge regarding inMap and outMap.
BaseGraph.prototype._delEdge = function(e, inMap, outMap) {
  var edge = this._strictGetEdge(e);
  delEdgeFromMap(inMap[edge.v], edge.u, e);
  delEdgeFromMap(outMap[edge.u], edge.v, e);
  delete this._edges[e];
};

BaseGraph.prototype.copy = function() {
  var copy = new this.constructor();
  copy.graph(this.graph());
  this.eachNode(function(u, value) { copy.addNode(u, value); });
  this.eachEdge(function(e, u, v, value) { copy.addEdge(e, u, v, value); });
  copy._nextId = this._nextId;
  return copy;
};

BaseGraph.prototype.filterNodes = function(filter) {
  var copy = new this.constructor();
  copy.graph(this.graph());
  this.eachNode(function(u, value) {
    if (filter(u)) {
      copy.addNode(u, value);
    }
  });
  this.eachEdge(function(e, u, v, value) {
    if (copy.hasNode(u) && copy.hasNode(v)) {
      copy.addEdge(e, u, v, value);
    }
  });
  return copy;
};

BaseGraph.prototype._strictGetNode = function(u) {
  var node = this._nodes[u];
  if (node === undefined) {
    throw new Error("Node '" + u + "' is not in graph");
  }
  return node;
};

BaseGraph.prototype._strictGetEdge = function(e) {
  var edge = this._edges[e];
  if (edge === undefined) {
    throw new Error("Edge '" + e + "' is not in graph");
  }
  return edge;
};

function addEdgeToMap(map, v, e) {
  (map[v] || (map[v] = new Set())).add(e);
}

function delEdgeFromMap(map, v, e) {
  var vEntry = map[v];
  vEntry.remove(e);
  if (vEntry.size() === 0) {
    delete map[v];
  }
}


},{"cp-data":30}],37:[function(require,module,exports){
var Digraph = require("./Digraph"),
    compoundify = require("./compoundify");

var CDigraph = compoundify(Digraph);

module.exports = CDigraph;

CDigraph.fromDigraph = function(src) {
  var g = new CDigraph(),
      graphValue = src.graph();

  if (graphValue !== undefined) {
    g.graph(graphValue);
  }

  src.eachNode(function(u, value) {
    if (value === undefined) {
      g.addNode(u);
    } else {
      g.addNode(u, value);
    }
  });
  src.eachEdge(function(e, u, v, value) {
    if (value === undefined) {
      g.addEdge(null, u, v);
    } else {
      g.addEdge(null, u, v, value);
    }
  });
  return g;
};

CDigraph.prototype.toString = function() {
  return "CDigraph " + JSON.stringify(this, null, 2);
};

},{"./Digraph":39,"./compoundify":52}],38:[function(require,module,exports){
var Graph = require("./Graph"),
    compoundify = require("./compoundify");

var CGraph = compoundify(Graph);

module.exports = CGraph;

CGraph.fromGraph = function(src) {
  var g = new CGraph(),
      graphValue = src.graph();

  if (graphValue !== undefined) {
    g.graph(graphValue);
  }

  src.eachNode(function(u, value) {
    if (value === undefined) {
      g.addNode(u);
    } else {
      g.addNode(u, value);
    }
  });
  src.eachEdge(function(e, u, v, value) {
    if (value === undefined) {
      g.addEdge(null, u, v);
    } else {
      g.addEdge(null, u, v, value);
    }
  });
  return g;
};

CGraph.prototype.toString = function() {
  return "CGraph " + JSON.stringify(this, null, 2);
};

},{"./Graph":40,"./compoundify":52}],39:[function(require,module,exports){
/*
 * This file is organized with in the following order:
 *
 * Exports
 * Graph constructors
 * Graph queries (e.g. nodes(), edges()
 * Graph mutators
 * Helper functions
 */

var util = require("./util"),
    BaseGraph = require("./BaseGraph"),
/* jshint -W079 */
    Set = require("cp-data").Set;
/* jshint +W079 */

module.exports = Digraph;

/*
 * Constructor to create a new directed multi-graph.
 */
function Digraph() {
  BaseGraph.call(this);

  /*! Map of sourceId -> {targetId -> Set of edge ids} */
  this._inEdges = {};

  /*! Map of targetId -> {sourceId -> Set of edge ids} */
  this._outEdges = {};
}

Digraph.prototype = new BaseGraph();
Digraph.prototype.constructor = Digraph;

/*
 * Always returns `true`.
 */
Digraph.prototype.isDirected = function() {
  return true;
};

/*
 * Returns all successors of the node with the id `u`. That is, all nodes
 * that have the node `u` as their source are returned.
 * 
 * If no node `u` exists in the graph this function throws an Error.
 *
 * @param {String} u a node id
 */
Digraph.prototype.successors = function(u) {
  this._strictGetNode(u);
  return Object.keys(this._outEdges[u])
               .map(function(v) { return this._nodes[v].id; }, this);
};

/*
 * Returns all predecessors of the node with the id `u`. That is, all nodes
 * that have the node `u` as their target are returned.
 * 
 * If no node `u` exists in the graph this function throws an Error.
 *
 * @param {String} u a node id
 */
Digraph.prototype.predecessors = function(u) {
  this._strictGetNode(u);
  return Object.keys(this._inEdges[u])
               .map(function(v) { return this._nodes[v].id; }, this);
};

/*
 * Returns all nodes that are adjacent to the node with the id `u`. In other
 * words, this function returns the set of all successors and predecessors of
 * node `u`.
 *
 * @param {String} u a node id
 */
Digraph.prototype.neighbors = function(u) {
  return Set.union([this.successors(u), this.predecessors(u)]).keys();
};

/*
 * Returns all nodes in the graph that have no in-edges.
 */
Digraph.prototype.sources = function() {
  var self = this;
  return this._filterNodes(function(u) {
    // This could have better space characteristics if we had an inDegree function.
    return self.inEdges(u).length === 0;
  });
};

/*
 * Returns all nodes in the graph that have no out-edges.
 */
Digraph.prototype.sinks = function() {
  var self = this;
  return this._filterNodes(function(u) {
    // This could have better space characteristics if we have an outDegree function.
    return self.outEdges(u).length === 0;
  });
};

/*
 * Returns the source node incident on the edge identified by the id `e`. If no
 * such edge exists in the graph this function throws an Error.
 *
 * @param {String} e an edge id
 */
Digraph.prototype.source = function(e) {
  return this._strictGetEdge(e).u;
};

/*
 * Returns the target node incident on the edge identified by the id `e`. If no
 * such edge exists in the graph this function throws an Error.
 *
 * @param {String} e an edge id
 */
Digraph.prototype.target = function(e) {
  return this._strictGetEdge(e).v;
};

/*
 * Returns an array of ids for all edges in the graph that have the node
 * `target` as their target. If the node `target` is not in the graph this
 * function raises an Error.
 *
 * Optionally a `source` node can also be specified. This causes the results
 * to be filtered such that only edges from `source` to `target` are included.
 * If the node `source` is specified but is not in the graph then this function
 * raises an Error.
 *
 * @param {String} target the target node id
 * @param {String} [source] an optional source node id
 */
Digraph.prototype.inEdges = function(target, source) {
  this._strictGetNode(target);
  var results = Set.union(util.values(this._inEdges[target])).keys();
  if (arguments.length > 1) {
    this._strictGetNode(source);
    results = results.filter(function(e) { return this.source(e) === source; }, this);
  }
  return results;
};

/*
 * Returns an array of ids for all edges in the graph that have the node
 * `source` as their source. If the node `source` is not in the graph this
 * function raises an Error.
 *
 * Optionally a `target` node may also be specified. This causes the results
 * to be filtered such that only edges from `source` to `target` are included.
 * If the node `target` is specified but is not in the graph then this function
 * raises an Error.
 *
 * @param {String} source the source node id
 * @param {String} [target] an optional target node id
 */
Digraph.prototype.outEdges = function(source, target) {
  this._strictGetNode(source);
  var results = Set.union(util.values(this._outEdges[source])).keys();
  if (arguments.length > 1) {
    this._strictGetNode(target);
    results = results.filter(function(e) { return this.target(e) === target; }, this);
  }
  return results;
};

/*
 * Returns an array of ids for all edges in the graph that have the `u` as
 * their source or their target. If the node `u` is not in the graph this
 * function raises an Error.
 *
 * Optionally a `v` node may also be specified. This causes the results to be
 * filtered such that only edges between `u` and `v` - in either direction -
 * are included. IF the node `v` is specified but not in the graph then this
 * function raises an Error.
 *
 * @param {String} u the node for which to find incident edges
 * @param {String} [v] option node that must be adjacent to `u`
 */
Digraph.prototype.incidentEdges = function(u, v) {
  if (arguments.length > 1) {
    return Set.union([this.outEdges(u, v), this.outEdges(v, u)]).keys();
  } else {
    return Set.union([this.inEdges(u), this.outEdges(u)]).keys();
  }
};

/*
 * Returns a string representation of this graph.
 */
Digraph.prototype.toString = function() {
  return "Digraph " + JSON.stringify(this, null, 2);
};

/*
 * Adds a new node with the id `u` to the graph and assigns it the value
 * `value`. If a node with the id is already a part of the graph this function
 * throws an Error.
 *
 * @param {String} u a node id
 * @param {Object} [value] an optional value to attach to the node
 */
Digraph.prototype.addNode = function(u, value) {
  u = BaseGraph.prototype.addNode.call(this, u, value);
  this._inEdges[u] = {};
  this._outEdges[u] = {};
  return u;
};

/*
 * Removes a node from the graph that has the id `u`. Any edges incident on the
 * node are also removed. If the graph does not contain a node with the id this
 * function will throw an Error.
 *
 * @param {String} u a node id
 */
Digraph.prototype.delNode = function(u) {
  BaseGraph.prototype.delNode.call(this, u);
  delete this._inEdges[u];
  delete this._outEdges[u];
};

/*
 * Adds a new edge to the graph with the id `e` from a node with the id `source`
 * to a node with an id `target` and assigns it the value `value`. This graph
 * allows more than one edge from `source` to `target` as long as the id `e`
 * is unique in the set of edges. If `e` is `null` the graph will assign a
 * unique identifier to the edge.
 *
 * If `source` or `target` are not present in the graph this function will
 * throw an Error.
 *
 * @param {String} [e] an edge id
 * @param {String} source the source node id
 * @param {String} target the target node id
 * @param {Object} [value] an optional value to attach to the edge
 */
Digraph.prototype.addEdge = function(e, source, target, value) {
  return BaseGraph.prototype._addEdge.call(this, e, source, target, value,
                                           this._inEdges, this._outEdges);
};

/*
 * Removes an edge in the graph with the id `e`. If no edge in the graph has
 * the id `e` this function will throw an Error.
 *
 * @param {String} e an edge id
 */
Digraph.prototype.delEdge = function(e) {
  BaseGraph.prototype._delEdge.call(this, e, this._inEdges, this._outEdges);
};

// Unlike BaseGraph.filterNodes, this helper just returns nodes that
// satisfy a predicate.
Digraph.prototype._filterNodes = function(pred) {
  var filtered = [];
  this.eachNode(function(u) {
    if (pred(u)) {
      filtered.push(u);
    }
  });
  return filtered;
};


},{"./BaseGraph":36,"./util":56,"cp-data":30}],40:[function(require,module,exports){
/*
 * This file is organized with in the following order:
 *
 * Exports
 * Graph constructors
 * Graph queries (e.g. nodes(), edges()
 * Graph mutators
 * Helper functions
 */

var util = require("./util"),
    BaseGraph = require("./BaseGraph"),
/* jshint -W079 */
    Set = require("cp-data").Set;
/* jshint +W079 */

module.exports = Graph;

/*
 * Constructor to create a new undirected multi-graph.
 */
function Graph() {
  BaseGraph.call(this);

  /*! Map of nodeId -> { otherNodeId -> Set of edge ids } */
  this._incidentEdges = {};
}

Graph.prototype = new BaseGraph();
Graph.prototype.constructor = Graph;

/*
 * Always returns `false`.
 */
Graph.prototype.isDirected = function() {
  return false;
};

/*
 * Returns all nodes that are adjacent to the node with the id `u`.
 *
 * @param {String} u a node id
 */
Graph.prototype.neighbors = function(u) {
  this._strictGetNode(u);
  return Object.keys(this._incidentEdges[u])
               .map(function(v) { return this._nodes[v].id; }, this);
};

/*
 * Returns an array of ids for all edges in the graph that are incident on `u`.
 * If the node `u` is not in the graph this function raises an Error.
 *
 * Optionally a `v` node may also be specified. This causes the results to be
 * filtered such that only edges between `u` and `v` are included. If the node
 * `v` is specified but not in the graph then this function raises an Error.
 *
 * @param {String} u the node for which to find incident edges
 * @param {String} [v] option node that must be adjacent to `u`
 */
Graph.prototype.incidentEdges = function(u, v) {
  this._strictGetNode(u);
  if (arguments.length > 1) {
    this._strictGetNode(v);
    return v in this._incidentEdges[u] ? this._incidentEdges[u][v].keys() : [];
  } else {
    return Set.union(util.values(this._incidentEdges[u])).keys();
  }
};

/*
 * Returns a string representation of this graph.
 */
Graph.prototype.toString = function() {
  return "Graph " + JSON.stringify(this, null, 2);
};

/*
 * Adds a new node with the id `u` to the graph and assigns it the value
 * `value`. If a node with the id is already a part of the graph this function
 * throws an Error.
 *
 * @param {String} u a node id
 * @param {Object} [value] an optional value to attach to the node
 */
Graph.prototype.addNode = function(u, value) {
  u = BaseGraph.prototype.addNode.call(this, u, value);
  this._incidentEdges[u] = {};
  return u;
};

/*
 * Removes a node from the graph that has the id `u`. Any edges incident on the
 * node are also removed. If the graph does not contain a node with the id this
 * function will throw an Error.
 *
 * @param {String} u a node id
 */
Graph.prototype.delNode = function(u) {
  BaseGraph.prototype.delNode.call(this, u);
  delete this._incidentEdges[u];
};

/*
 * Adds a new edge to the graph with the id `e` between a node with the id `u`
 * and a node with an id `v` and assigns it the value `value`. This graph
 * allows more than one edge between `u` and `v` as long as the id `e`
 * is unique in the set of edges. If `e` is `null` the graph will assign a
 * unique identifier to the edge.
 *
 * If `u` or `v` are not present in the graph this function will throw an
 * Error.
 *
 * @param {String} [e] an edge id
 * @param {String} u the node id of one of the adjacent nodes
 * @param {String} v the node id of the other adjacent node
 * @param {Object} [value] an optional value to attach to the edge
 */
Graph.prototype.addEdge = function(e, u, v, value) {
  return BaseGraph.prototype._addEdge.call(this, e, u, v, value,
                                           this._incidentEdges, this._incidentEdges);
};

/*
 * Removes an edge in the graph with the id `e`. If no edge in the graph has
 * the id `e` this function will throw an Error.
 *
 * @param {String} e an edge id
 */
Graph.prototype.delEdge = function(e) {
  BaseGraph.prototype._delEdge.call(this, e, this._incidentEdges, this._incidentEdges);
};


},{"./BaseGraph":36,"./util":56,"cp-data":30}],41:[function(require,module,exports){
/* jshint -W079 */
var Set = require("cp-data").Set;
/* jshint +W079 */

module.exports = components;

/**
 * Finds all [connected components][] in a graph and returns an array of these
 * components. Each component is itself an array that contains the ids of nodes
 * in the component.
 *
 * This function only works with undirected Graphs.
 *
 * [connected components]: http://en.wikipedia.org/wiki/Connected_component_(graph_theory)
 *
 * @param {Graph} g the graph to search for components
 */
function components(g) {
  var results = [];
  var visited = new Set();

  function dfs(v, component) {
    if (!visited.has(v)) {
      visited.add(v);
      component.push(v);
      g.neighbors(v).forEach(function(w) {
        dfs(w, component);
      });
    }
  }

  g.nodes().forEach(function(v) {
    var component = [];
    dfs(v, component);
    if (component.length > 0) {
      results.push(component);
    }
  });

  return results;
}

},{"cp-data":30}],42:[function(require,module,exports){
var PriorityQueue = require("cp-data").PriorityQueue;

module.exports = dijkstra;

/**
 * This function is an implementation of [Dijkstra's algorithm][] which finds
 * the shortest path from **source** to all other nodes in **g**. This
 * function returns a map of `u -> { distance, predecessor }`. The distance
 * property holds the sum of the weights from **source** to `u` along the
 * shortest path or `Number.POSITIVE_INFINITY` if there is no path from
 * **source**. The predecessor property can be used to walk the individual
 * elements of the path from **source** to **u** in reverse order.
 *
 * This function takes an optional `weightFunc(e)` which returns the
 * weight of the edge `e`. If no weightFunc is supplied then each edge is
 * assumed to have a weight of 1. This function throws an Error if any of
 * the traversed edges have a negative edge weight.
 *
 * This function takes an optional `incidentFunc(u)` which returns the ids of
 * all edges incident to the node `u` for the purposes of shortest path
 * traversal. By default this function uses the `g.outEdges` for Digraphs and
 * `g.incidentEdges` for Graphs.
 *
 * This function takes `O((|E| + |V|) * log |V|)` time.
 *
 * [Dijkstra's algorithm]: http://en.wikipedia.org/wiki/Dijkstra%27s_algorithm
 *
 * @param {Graph} g the graph to search for shortest paths from **source**
 * @param {Object} source the source from which to start the search
 * @param {Function} [weightFunc] optional weight function
 * @param {Function} [incidentFunc] optional incident function
 */
function dijkstra(g, source, weightFunc, incidentFunc) {
  var results = {},
      pq = new PriorityQueue();

  function updateNeighbors(e) {
    var incidentNodes = g.incidentNodes(e),
        v = incidentNodes[0] !== u ? incidentNodes[0] : incidentNodes[1],
        vEntry = results[v],
        weight = weightFunc(e),
        distance = uEntry.distance + weight;

    if (weight < 0) {
      throw new Error("dijkstra does not allow negative edge weights. Bad edge: " + e + " Weight: " + weight);
    }

    if (distance < vEntry.distance) {
      vEntry.distance = distance;
      vEntry.predecessor = u;
      pq.decrease(v, distance);
    }
  }

  weightFunc = weightFunc || function() { return 1; };
  incidentFunc = incidentFunc || (g.isDirected()
      ? function(u) { return g.outEdges(u); }
      : function(u) { return g.incidentEdges(u); });

  g.eachNode(function(u) {
    var distance = u === source ? 0 : Number.POSITIVE_INFINITY;
    results[u] = { distance: distance };
    pq.add(u, distance);
  });

  var u, uEntry;
  while (pq.size() > 0) {
    u = pq.removeMin();
    uEntry = results[u];
    if (uEntry.distance === Number.POSITIVE_INFINITY) {
      break;
    }

    incidentFunc(u).forEach(updateNeighbors);
  }

  return results;
}

},{"cp-data":30}],43:[function(require,module,exports){
var dijkstra = require("./dijkstra");

module.exports = dijkstraAll;

/**
 * This function finds the shortest path from each node to every other
 * reachable node in the graph. It is similar to [alg.dijkstra][], but
 * instead of returning a single-source array, it returns a mapping of
 * of `source -> alg.dijksta(g, source, weightFunc, incidentFunc)`.
 *
 * This function takes an optional `weightFunc(e)` which returns the
 * weight of the edge `e`. If no weightFunc is supplied then each edge is
 * assumed to have a weight of 1. This function throws an Error if any of
 * the traversed edges have a negative edge weight.
 *
 * This function takes an optional `incidentFunc(u)` which returns the ids of
 * all edges incident to the node `u` for the purposes of shortest path
 * traversal. By default this function uses the `outEdges` function on the
 * supplied graph.
 *
 * This function takes `O(|V| * (|E| + |V|) * log |V|)` time.
 *
 * [alg.dijkstra]: dijkstra.js.html#dijkstra
 *
 * @param {Graph} g the graph to search for shortest paths from **source**
 * @param {Function} [weightFunc] optional weight function
 * @param {Function} [incidentFunc] optional incident function
 */
function dijkstraAll(g, weightFunc, incidentFunc) {
  var results = {};
  g.eachNode(function(u) {
    results[u] = dijkstra(g, u, weightFunc, incidentFunc);
  });
  return results;
}

},{"./dijkstra":42}],44:[function(require,module,exports){
var tarjan = require("./tarjan");

module.exports = findCycles;

/*
 * Given a Digraph **g** this function returns all nodes that are part of a
 * cycle. Since there may be more than one cycle in a graph this function
 * returns an array of these cycles, where each cycle is itself represented
 * by an array of ids for each node involved in that cycle.
 *
 * [alg.isAcyclic][] is more efficient if you only need to determine whether
 * a graph has a cycle or not.
 *
 * [alg.isAcyclic]: isAcyclic.js.html#isAcyclic
 *
 * @param {Digraph} g the graph to search for cycles.
 */
function findCycles(g) {
  return tarjan(g).filter(function(cmpt) { return cmpt.length > 1; });
}

},{"./tarjan":50}],45:[function(require,module,exports){
module.exports = floydWarshall;

/**
 * This function is an implementation of the [Floyd-Warshall algorithm][],
 * which finds the shortest path from each node to every other reachable node
 * in the graph. It is similar to [alg.dijkstraAll][], but it handles negative
 * edge weights and is more efficient for some types of graphs. This function
 * returns a map of `source -> { target -> { distance, predecessor }`. The
 * distance property holds the sum of the weights from `source` to `target`
 * along the shortest path of `Number.POSITIVE_INFINITY` if there is no path
 * from `source`. The predecessor property can be used to walk the individual
 * elements of the path from `source` to `target` in reverse order.
 *
 * This function takes an optional `weightFunc(e)` which returns the
 * weight of the edge `e`. If no weightFunc is supplied then each edge is
 * assumed to have a weight of 1.
 *
 * This function takes an optional `incidentFunc(u)` which returns the ids of
 * all edges incident to the node `u` for the purposes of shortest path
 * traversal. By default this function uses the `outEdges` function on the
 * supplied graph.
 *
 * This algorithm takes O(|V|^3) time.
 *
 * [Floyd-Warshall algorithm]: https://en.wikipedia.org/wiki/Floyd-Warshall_algorithm
 * [alg.dijkstraAll]: dijkstraAll.js.html#dijkstraAll
 *
 * @param {Graph} g the graph to search for shortest paths from **source**
 * @param {Function} [weightFunc] optional weight function
 * @param {Function} [incidentFunc] optional incident function
 */
function floydWarshall(g, weightFunc, incidentFunc) {
  var results = {},
      nodes = g.nodes();

  weightFunc = weightFunc || function() { return 1; };
  incidentFunc = incidentFunc || (g.isDirected()
      ? function(u) { return g.outEdges(u); }
      : function(u) { return g.incidentEdges(u); });

  nodes.forEach(function(u) {
    results[u] = {};
    results[u][u] = { distance: 0 };
    nodes.forEach(function(v) {
      if (u !== v) {
        results[u][v] = { distance: Number.POSITIVE_INFINITY };
      }
    });
    incidentFunc(u).forEach(function(e) {
      var incidentNodes = g.incidentNodes(e),
          v = incidentNodes[0] !== u ? incidentNodes[0] : incidentNodes[1],
          d = weightFunc(e);
      if (d < results[u][v].distance) {
        results[u][v] = { distance: d, predecessor: u };
      }
    });
  });

  nodes.forEach(function(k) {
    var rowK = results[k];
    nodes.forEach(function(i) {
      var rowI = results[i];
      nodes.forEach(function(j) {
        var ik = rowI[k];
        var kj = rowK[j];
        var ij = rowI[j];
        var altDistance = ik.distance + kj.distance;
        if (altDistance < ij.distance) {
          ij.distance = altDistance;
          ij.predecessor = kj.predecessor;
        }
      });
    });
  });

  return results;
}

},{}],46:[function(require,module,exports){
var topsort = require("./topsort");

module.exports = isAcyclic;

/*
 * Given a Digraph **g** this function returns `true` if the graph has no
 * cycles and returns `false` if it does. This algorithm returns as soon as it
 * detects the first cycle.
 *
 * Use [alg.findCycles][] if you need the actual list of cycles in a graph.
 *
 * [alg.findCycles]: findCycles.js.html#findCycles
 *
 * @param {Digraph} g the graph to test for cycles
 */
function isAcyclic(g) {
  try {
    topsort(g);
  } catch (e) {
    if (e instanceof topsort.CycleException) return false;
    throw e;
  }
  return true;
}

},{"./topsort":51}],47:[function(require,module,exports){
/* jshint -W079 */
var Set = require("cp-data").Set;
/* jshint +W079 */

module.exports = postorder;

// Postorder traversal of g, calling f for each visited node. Assumes the graph
// is a tree.
function postorder(g, root, f) {
  var visited = new Set();
  if (g.isDirected()) {
    throw new Error("This function only works for undirected graphs");
  }
  function dfs(u, prev) {
    if (visited.has(u)) {
      throw new Error("The input graph is not a tree: " + g);
    }
    visited.add(u);
    g.neighbors(u).forEach(function(v) {
      if (v !== prev) dfs(v, u);
    });
    f(u);
  }
  dfs(root);
}

},{"cp-data":30}],48:[function(require,module,exports){
/* jshint -W079 */
var Set = require("cp-data").Set;
/* jshint +W079 */

module.exports = preorder;

// Preorder traversal of g, calling f for each visited node. Assumes the graph
// is a tree.
function preorder(g, root, f) {
  var visited = new Set();
  if (g.isDirected()) {
    throw new Error("This function only works for undirected graphs");
  }
  function dfs(u, prev) {
    if (visited.has(u)) {
      throw new Error("The input graph is not a tree: " + g);
    }
    visited.add(u);
    f(u);
    g.neighbors(u).forEach(function(v) {
      if (v !== prev) dfs(v, u);
    });
  }
  dfs(root);
}

},{"cp-data":30}],49:[function(require,module,exports){
var Graph = require("../Graph"),
    PriorityQueue = require("cp-data").PriorityQueue;

module.exports = prim;

/**
 * [Prim's algorithm][] takes a connected undirected graph and generates a
 * [minimum spanning tree][]. This function returns the minimum spanning
 * tree as an undirected graph. This algorithm is derived from the description
 * in "Introduction to Algorithms", Third Edition, Cormen, et al., Pg 634.
 *
 * This function takes a `weightFunc(e)` which returns the weight of the edge
 * `e`. It throws an Error if the graph is not connected.
 *
 * This function takes `O(|E| log |V|)` time.
 *
 * [Prim's algorithm]: https://en.wikipedia.org/wiki/Prim's_algorithm
 * [minimum spanning tree]: https://en.wikipedia.org/wiki/Minimum_spanning_tree
 *
 * @param {Graph} g the graph used to generate the minimum spanning tree
 * @param {Function} weightFunc the weight function to use
 */
function prim(g, weightFunc) {
  var result = new Graph(),
      parents = {},
      pq = new PriorityQueue(),
      u;

  function updateNeighbors(e) {
    var incidentNodes = g.incidentNodes(e),
        v = incidentNodes[0] !== u ? incidentNodes[0] : incidentNodes[1],
        pri = pq.priority(v);
    if (pri !== undefined) {
      var edgeWeight = weightFunc(e);
      if (edgeWeight < pri) {
        parents[v] = u;
        pq.decrease(v, edgeWeight);
      }
    }
  }

  if (g.order() === 0) {
    return result;
  }

  g.eachNode(function(u) {
    pq.add(u, Number.POSITIVE_INFINITY);
    result.addNode(u);
  });

  // Start from an arbitrary node
  pq.decrease(g.nodes()[0], 0);

  var init = false;
  while (pq.size() > 0) {
    u = pq.removeMin();
    if (u in parents) {
      result.addEdge(null, u, parents[u]);
    } else if (init) {
      throw new Error("Input graph is not connected: " + g);
    } else {
      init = true;
    }

    g.incidentEdges(u).forEach(updateNeighbors);
  }

  return result;
}

},{"../Graph":40,"cp-data":30}],50:[function(require,module,exports){
module.exports = tarjan;

/**
 * This function is an implementation of [Tarjan's algorithm][] which finds
 * all [strongly connected components][] in the directed graph **g**. Each
 * strongly connected component is composed of nodes that can reach all other
 * nodes in the component via directed edges. A strongly connected component
 * can consist of a single node if that node cannot both reach and be reached
 * by any other specific node in the graph. Components of more than one node
 * are guaranteed to have at least one cycle.
 *
 * This function returns an array of components. Each component is itself an
 * array that contains the ids of all nodes in the component.
 *
 * [Tarjan's algorithm]: http://en.wikipedia.org/wiki/Tarjan's_strongly_connected_components_algorithm
 * [strongly connected components]: http://en.wikipedia.org/wiki/Strongly_connected_component
 *
 * @param {Digraph} g the graph to search for strongly connected components
 */
function tarjan(g) {
  if (!g.isDirected()) {
    throw new Error("tarjan can only be applied to a directed graph. Bad input: " + g);
  }

  var index = 0,
      stack = [],
      visited = {}, // node id -> { onStack, lowlink, index }
      results = [];

  function dfs(u) {
    var entry = visited[u] = {
      onStack: true,
      lowlink: index,
      index: index++
    };
    stack.push(u);

    g.successors(u).forEach(function(v) {
      if (!(v in visited)) {
        dfs(v);
        entry.lowlink = Math.min(entry.lowlink, visited[v].lowlink);
      } else if (visited[v].onStack) {
        entry.lowlink = Math.min(entry.lowlink, visited[v].index);
      }
    });

    if (entry.lowlink === entry.index) {
      var cmpt = [],
          v;
      do {
        v = stack.pop();
        visited[v].onStack = false;
        cmpt.push(v);
      } while (u !== v);
      results.push(cmpt);
    }
  }

  g.nodes().forEach(function(u) {
    if (!(u in visited)) {
      dfs(u);
    }
  });

  return results;
}

},{}],51:[function(require,module,exports){
module.exports = topsort;
topsort.CycleException = CycleException;

/*
 * Given a graph **g**, this function returns an ordered list of nodes such
 * that for each edge `u -> v`, `u` appears before `v` in the list. If the
 * graph has a cycle it is impossible to generate such a list and
 * **CycleException** is thrown.
 *
 * See [topological sorting](https://en.wikipedia.org/wiki/Topological_sorting)
 * for more details about how this algorithm works.
 *
 * @param {Digraph} g the graph to sort
 */
function topsort(g) {
  if (!g.isDirected()) {
    throw new Error("topsort can only be applied to a directed graph. Bad input: " + g);
  }

  var visited = {};
  var stack = {};
  var results = [];

  function visit(node) {
    if (node in stack) {
      throw new CycleException();
    }

    if (!(node in visited)) {
      stack[node] = true;
      visited[node] = true;
      g.predecessors(node).forEach(function(pred) {
        visit(pred);
      });
      delete stack[node];
      results.push(node);
    }
  }

  var sinks = g.sinks();
  if (g.order() !== 0 && sinks.length === 0) {
    throw new CycleException();
  }

  g.sinks().forEach(function(sink) {
    visit(sink);
  });

  return results;
}

function CycleException() {}

CycleException.prototype.toString = function() {
  return "Graph has at least one cycle";
};

},{}],52:[function(require,module,exports){
// This file provides a helper function that mixes-in Dot behavior to an
// existing graph prototype.

/* jshint -W079 */
var Set = require("cp-data").Set;
/* jshint +W079 */

module.exports = compoundify;

// Extends the given SuperConstructor with the ability for nodes to contain
// other nodes. A special node id `null` is used to indicate the root graph.
function compoundify(SuperConstructor) {
  function Constructor() {
    SuperConstructor.call(this);

    // Map of object id -> parent id (or null for root graph)
    this._parents = {};

    // Map of id (or null) -> children set
    this._children = {};
    this._children[null] = new Set();
  }

  Constructor.prototype = new SuperConstructor();
  Constructor.prototype.constructor = Constructor;

  Constructor.prototype.parent = function(u, parent) {
    this._strictGetNode(u);

    if (arguments.length < 2) {
      return this._parents[u];
    }

    if (u === parent) {
      throw new Error("Cannot make " + u + " a parent of itself");
    }
    if (parent !== null) {
      this._strictGetNode(parent);
    }

    this._children[this._parents[u]].remove(u);
    this._parents[u] = parent;
    this._children[parent].add(u);
  };

  Constructor.prototype.children = function(u) {
    if (u !== null) {
      this._strictGetNode(u);
    }
    return this._children[u].keys();
  };

  Constructor.prototype.addNode = function(u, value) {
    u = SuperConstructor.prototype.addNode.call(this, u, value);
    this._parents[u] = null;
    this._children[u] = new Set();
    this._children[null].add(u);
    return u;
  };

  Constructor.prototype.delNode = function(u) {
    // Promote all children to the parent of the subgraph
    var parent = this.parent(u);
    this._children[u].keys().forEach(function(child) {
      this.parent(child, parent);
    }, this);

    this._children[parent].remove(u);
    delete this._parents[u];
    delete this._children[u];

    return SuperConstructor.prototype.delNode.call(this, u);
  };

  Constructor.prototype.copy = function() {
    var copy = SuperConstructor.prototype.copy.call(this);
    this.nodes().forEach(function(u) {
      copy.parent(u, this.parent(u));
    }, this);
    return copy;
  };

  Constructor.prototype.filterNodes = function(filter) {
    var self = this,
        copy = SuperConstructor.prototype.filterNodes.call(this, filter);

    var parents = {};
    function findParent(u) {
      var parent = self.parent(u);
      if (parent === null || copy.hasNode(parent)) {
        parents[u] = parent;
        return parent;
      } else if (parent in parents) {
        return parents[parent];
      } else {
        return findParent(parent);
      }
    }

    copy.eachNode(function(u) { copy.parent(u, findParent(u)); });

    return copy;
  };

  return Constructor;
}

},{"cp-data":30}],53:[function(require,module,exports){
var Graph = require("../Graph"),
    Digraph = require("../Digraph"),
    CGraph = require("../CGraph"),
    CDigraph = require("../CDigraph");

exports.decode = function(nodes, edges, Ctor) {
  Ctor = Ctor || Digraph;

  if (typeOf(nodes) !== "Array") {
    throw new Error("nodes is not an Array");
  }

  if (typeOf(edges) !== "Array") {
    throw new Error("edges is not an Array");
  }

  if (typeof Ctor === "string") {
    switch(Ctor) {
      case "graph": Ctor = Graph; break;
      case "digraph": Ctor = Digraph; break;
      case "cgraph": Ctor = CGraph; break;
      case "cdigraph": Ctor = CDigraph; break;
      default: throw new Error("Unrecognized graph type: " + Ctor);
    }
  }

  var graph = new Ctor();

  nodes.forEach(function(u) {
    graph.addNode(u.id, u.value);
  });

  // If the graph is compound, set up children...
  if (graph.parent) {
    nodes.forEach(function(u) {
      if (u.children) {
        u.children.forEach(function(v) {
          graph.parent(v, u.id);
        });
      }
    });
  }

  edges.forEach(function(e) {
    graph.addEdge(e.id, e.u, e.v, e.value);
  });

  return graph;
};

exports.encode = function(graph) {
  var nodes = [];
  var edges = [];

  graph.eachNode(function(u, value) {
    var node = {id: u, value: value};
    if (graph.children) {
      var children = graph.children(u);
      if (children.length) {
        node.children = children;
      }
    }
    nodes.push(node);
  });

  graph.eachEdge(function(e, u, v, value) {
    edges.push({id: e, u: u, v: v, value: value});
  });

  var type;
  if (graph instanceof CDigraph) {
    type = "cdigraph";
  } else if (graph instanceof CGraph) {
    type = "cgraph";
  } else if (graph instanceof Digraph) {
    type = "digraph";
  } else if (graph instanceof Graph) {
    type = "graph";
  } else {
    throw new Error("Couldn't determine type of graph: " + graph);
  }

  return { nodes: nodes, edges: edges, type: type };
};

function typeOf(obj) {
  return Object.prototype.toString.call(obj).slice(8, -1);
}

},{"../CDigraph":37,"../CGraph":38,"../Digraph":39,"../Graph":40}],54:[function(require,module,exports){
/* jshint -W079 */
var Set = require("cp-data").Set;
/* jshint +W079 */

exports.all = function() {
  return function() { return true; };
};

exports.nodesFromList = function(nodes) {
  var set = new Set(nodes);
  return function(u) {
    return set.has(u);
  };
};

},{"cp-data":30}],55:[function(require,module,exports){
var Graph = require("./Graph"),
    Digraph = require("./Digraph");

// Side-effect based changes are lousy, but node doesn't seem to resolve the
// requires cycle.

/**
 * Returns a new directed graph using the nodes and edges from this graph. The
 * new graph will have the same nodes, but will have twice the number of edges:
 * each edge is split into two edges with opposite directions. Edge ids,
 * consequently, are not preserved by this transformation.
 */
Graph.prototype.toDigraph =
Graph.prototype.asDirected = function() {
  var g = new Digraph();
  this.eachNode(function(u, value) { g.addNode(u, value); });
  this.eachEdge(function(e, u, v, value) {
    g.addEdge(null, u, v, value);
    g.addEdge(null, v, u, value);
  });
  return g;
};

/**
 * Returns a new undirected graph using the nodes and edges from this graph.
 * The new graph will have the same nodes, but the edges will be made
 * undirected. Edge ids are preserved in this transformation.
 */
Digraph.prototype.toGraph =
Digraph.prototype.asUndirected = function() {
  var g = new Graph();
  this.eachNode(function(u, value) { g.addNode(u, value); });
  this.eachEdge(function(e, u, v, value) {
    g.addEdge(e, u, v, value);
  });
  return g;
};

},{"./Digraph":39,"./Graph":40}],56:[function(require,module,exports){
// Returns an array of all values for properties of **o**.
exports.values = function(o) {
  var ks = Object.keys(o),
      len = ks.length,
      result = new Array(len),
      i;
  for (i = 0; i < len; ++i) {
    result[i] = o[ks[i]];
  }
  return result;
};

},{}],57:[function(require,module,exports){
module.exports = '0.7.4';

},{}],58:[function(require,module,exports){
void function(){
  'use strict'
  module.exports = function(fn){
    return function(){
      return fn.bind(null, this).apply(null, arguments)
   }
  }
}()

},{}],59:[function(require,module,exports){
var domify = require('domify');

module.exports = hyperglue;
function hyperglue (src, updates) {
    if (!updates) updates = {};

    var dom = typeof src === 'object'
        ? [ src ]
        : domify(src)
    ;
    forEach(objectKeys(updates), function (selector) {
        var value = updates[selector];
        forEach(dom, function (d) {
            if (selector === ':first') {
                bind(d, value);
            }
            else if (/:first$/.test(selector)) {
                var k = selector.replace(/:first$/, '');
                var elem = d.querySelector(k);
                if (elem) bind(elem, value);
            }
            else {
                var nodes = d.querySelectorAll(selector);
                if (nodes.length === 0) return;
                for (var i = 0; i < nodes.length; i++) {
                    bind(nodes[i], value);
                }
            }
        });
    });

    return dom.length === 1
        ? dom[0]
        : dom
    ;
}

function bind (node, value) {
    if (isElement(value)) {
        node.innerHTML = '';
        node.appendChild(value);
    }
    else if (isArray(value)) {
        for (var i = 0; i < value.length; i++) {
            var e = hyperglue(node.cloneNode(true), value[i]);
            node.parentNode.insertBefore(e, node);
        }
        node.parentNode.removeChild(node);
    }
    else if (value && typeof value === 'object') {
        forEach(objectKeys(value), function (key) {
            if (key === '_text') {
                setText(node, value[key]);
            }
            else if (key === '_html' && isElement(value[key])) {
                node.innerHTML = '';
                node.appendChild(value[key]);
            }
            else if (key === '_html') {
                node.innerHTML = value[key];
            }
            else node.setAttribute(key, value[key]);
        });
    }
    else setText(node, value);
}

function forEach(xs, f) {
    if (xs.forEach) return xs.forEach(f);
    for (var i = 0; i < xs.length; i++) f(xs[i], i)
}

var objectKeys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

function isElement (e) {
    return e && typeof e === 'object' && e.childNodes
        && (typeof e.appendChild === 'function'
        || typeof e.appendChild === 'object')
    ;
}

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

function setText (e, s) {
    e.innerHTML = '';
    var txt = document.createTextNode(String(s));
    e.appendChild(txt);
}

},{"domify":60}],60:[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Wrap map from jquery.
 */

var map = {
  option: [1, '<select multiple="multiple">', '</select>'],
  optgroup: [1, '<select multiple="multiple">', '</select>'],
  legend: [1, '<fieldset>', '</fieldset>'],
  thead: [1, '<table>', '</table>'],
  tbody: [1, '<table>', '</table>'],
  tfoot: [1, '<table>', '</table>'],
  colgroup: [1, '<table>', '</table>'],
  caption: [1, '<table>', '</table>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  td: [3, '<table><tbody><tr>', '</tr></tbody></table>'],
  th: [3, '<table><tbody><tr>', '</tr></tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  _default: [0, '', '']
};

/**
 * Parse `html` and return the children.
 *
 * @param {String} html
 * @return {Array}
 * @api private
 */

function parse(html) {
  if ('string' != typeof html) throw new TypeError('String expected');
  
  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) throw new Error('No elements were generated.');
  var tag = m[1];
  
  // body support
  if (tag == 'body') {
    var el = document.createElement('html');
    el.innerHTML = html;
    return [el.removeChild(el.lastChild)];
  }
  
  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = document.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  return orphan(el.children);
}

/**
 * Orphan `els` and return an array.
 *
 * @param {NodeList} els
 * @return {Array}
 * @api private
 */

function orphan(els) {
  var ret = [];

  while (els.length) {
    ret.push(els[0].parentNode.removeChild(els[0]));
  }

  return ret;
}

},{}],61:[function(require,module,exports){
void function(root){

    // return a number between 0 and max-1
    function r(max){ return Math.floor(Math.random()*max) }

    function generate(salt, size){
        var key = ''
        var sl = salt.length
        while ( size -- ) {
            var rnd = r(sl)
            key += salt[rnd]
        }
        return key
    }

    var rndtok = function(salt, size){
        return isNaN(size) ? undefined :
               size < 1    ? undefined : generate(salt, size)

    }

    rndtok.gen = createGenerator

    function createGenerator(salt){
        salt = typeof salt  == 'string' && salt.length > 0 ? salt :  'abcdefghijklmnopqrstuvwxzy0123456789'
        var temp = rndtok.bind(rndtok, salt)
        temp.salt = function(){ return salt }
        temp.create = createGenerator
        temp.gen = createGenerator
        return temp
    }

    module.exports = createGenerator()

}(this)

},{}],62:[function(require,module,exports){
void function(root){

	'use strict'

	var create = Object.create || function(o){
		var F = function(){}
		F.prototype = o
		return new F()
	}

	var extend = function(to, from){
		for ( var p in from ) to[p] = from[p]
		return to
	}

	// Library object - a base object to be extended
	var Viral = {

		// create an inheriting object, with added or changed methods or properties
		extend: function(props){
			return extend(create(this), props)
		},

		// create a new instance of an object, calling an init method if available
		make: function(){
			var obj = create(this)
			if ( typeof obj.init === 'function' ) obj.init.apply(obj, arguments)
			return obj
		}
	}

	// module dance
	if ( typeof module !== 'undefined' && module.exports ) module.exports = Viral
	else if ( typeof define === 'function' && define.amd ) define(Viral)
	else                                                   root.Viral = Viral

}(this)

},{}],63:[function(require,module,exports){
// # "Zipping and Unzipping Lists"
// Because js is dynamic and doesn't rock tuples, these zippers work with n
// chars iirc, and also acts as an unzip.

exports.zipWith = function () {
  var fxn = Array.prototype.slice.call(arguments),
      args = fxn.splice(1),
      output = [],
      width = Math.max.apply(null, Array.prototype.map.call(args, function(xs) {
        return xs.length;
      })),
      i;

  fxn = fxn[0];

  for (i = 0; i < width; i++) {
    output.push(fxn.apply(null, [].map.call(args, function(xs) {
      return xs[i];
    })));
  }
  return output;
}

exports.zip = exports.zipWith.bind(null, function() {
  return [].slice.call(arguments); 
});

},{}],64:[function(require,module,exports){
void function(){
  "use strict"
  module.exports = function defaults(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source){
      for (var prop in source) {
        if (obj[prop] === undefined) obj[prop] = source[prop]
      }
    })
    return obj
  }
}()

},{}],65:[function(require,module,exports){
void function(){

  function query(selector, parent){
    parent = parent || document
    return parent.querySelector(selector)
  }

  function create(tag_name, attrs){
    var node = document.createElement(tag_name)
    if ( attrs ) { set_attributes(node, attrs) }
    return node
  }

  function set_attribute(node, attr){
    node.setAttribute(name,value)
  }

  function set_attributes(node, attrs){
    Object.keys(attrs)
          .forEach(function(name){
            node.setAttribute(name, attrs[name])
          })
  }

  function get_text(node){
    return node.textContent || node.innerText
  }

  function set_text(node, text){
    node.textContent = node.innerText = text
  }

  function insertAfter(parentEl, sp1, sp2){
    parentEl.insertBefore(sp1, sp2.nextSibling)
  }

  function removeNode(node){
    node.parentNode.removeChild(node)
  }

  module.exports = {
    $             : query
  //, $id           : document.getElementById.bind(document)
  , $id           : function(id){ return document.getElementById(id) }
  , create        : create
  , attr          : set_attribute
  , attrs         : set_attributes
  , get_text      : get_text
  , set_text      : set_text
  , remove        : removeNode
  , insertAfter   : insertAfter
  }

}()

},{}],66:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var events = require('events')

  module.exports = viral.extend(events.EventEmitter.prototype).extend({
    init: function(){ events.EventEmitter.call(this) }
  })

}()

},{"events":72,"viral":62}],67:[function(require,module,exports){
void function(){
  module.exports = function pluck(name){
    return function getAttr(obj){ return obj[name] }
  }
}()

},{}],68:[function(require,module,exports){
void function(){
  module.exports = function translate(vector, point){
    return { x: point.x + vector[0], y: point.y + vector[1] }
  }
}()

},{}],69:[function(require,module,exports){
void function(){
  var ids = []
  var rt = require('random-token')
  var letters = rt.gen('abcdefghijklmnopqrstuvwxyt')

  function token(){ return letters(1) + rt(16) }

  module.exports = function(){
    var id = token()
    while ( ids.indexOf(id) != -1 ){
      id = token()
    }
    return id
  }
}()

},{"random-token":61}],70:[function(require,module,exports){
void function(){

  function pyth(a, b){
    return Math.sqrt(Math.pow(a,2), Math.pow(b,2))
  }

  module.exports = {
    cross: function cross(v, w){
      return v[0] * w[1] - v[1] * w[0]
    }

  , dot:  function add(v, w){
      return v[0] * w[0] + v[1] * w[1]
    }

  , add:  function add(v, w){
      return [v[0] + w[0], v[1] + w[1]]
    }

  , subtract:  function subtract(v, w){
      return [v[0] - w[0], v[1] - w[1]]
    }

  , scale:  function scale(v, s){
      return [v[0] * s, v[1] * s]
    }

  , eq:  function eq(v, w){
      return v[0] == w[0] &&  v[1] == w[1]
    }
  , magnitude: function magnitude(v){
      return pyth(v[0], v[1])
    }

  }
}()

},{}],71:[function(require,module,exports){
void function(){
  /* thanks Maxdamantus */
  module.exports = {
    zip: function(xs, ys){
      return Array.apply(null, Array(Math.min(xs.length, ys.length)))
                  .map(function(_, i){
                    return [xs[i], ys[i]]
                  })
    }

  , zipWith: function(fn, xs, ys){
      return Array.apply(null, Array(Math.min(xs.length, ys.length)))
                  .map(function(_, i){
                    return fn(xs[i], ys[i])
                  })
    }

  , zipGreedy: function(xs, ys){
      return Array.apply(null, Array(Math.max(xs.length, ys.length)))
                  .map(function(_, i){
                    return [xs[i], ys[i]]
                  })
    }

  , zipWithGreedy: function(fn, xs, ys){
      return Array.apply(null, Array(Math.max(xs.length, ys.length)))
                  .map(function(_, i){
                    return fn(xs[i], ys[i])
                  })
    }
  }
}()

},{}],72:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[12])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9kaWFncmFtL2RpYWdyYW0uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9lZGdlX2NvbGxhcHNlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vZWRnZXMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9nYXBzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vaW50ZXJzZWN0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vanVuY3Rpb25fcG9pbnRzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vc2lkZV9wb2ludHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9za2lwX3BvaW50cy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ncmFwaC9lZGdlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL2dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL25vZGUuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvbGF5b3V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9vcmRlci9jcm9zc0NvdW50LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdExheWVyR3JhcGhzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdE9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvc29ydExheWVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcG9zaXRpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9hY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9jb25zdHJhaW50cy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvZmVhc2libGVUcmVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9pbml0UmFuay5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvcmFua1V0aWwuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rL3NpbXBsZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi91dGlsLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvdmVyc2lvbi5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9jcC1kYXRhL2xpYi9Qcmlvcml0eVF1ZXVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvU2V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvbGliL3ZlcnNpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9pbmRleC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9CYXNlR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2NvbXBvbmVudHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2RpamtzdHJhLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9kaWprc3RyYUFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmluZEN5Y2xlcy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmxveWRXYXJzaGFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvaXNBY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wb3N0b3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3ByZW9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wcmltLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy90YXJqYW4uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3RvcHNvcnQuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29tcG91bmRpZnkuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29udmVydGVyL2pzb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvZmlsdGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2dyYXBoLWNvbnZlcnRlcnMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi92ZXJzaW9uLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9lbnNsYXZlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9oeXBlcmdsdWUvYnJvd3Nlci5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvaHlwZXJnbHVlL25vZGVfbW9kdWxlcy9kb21pZnkvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL3JhbmRvbS10b2tlbi9pbmRleC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvdmlyYWwvdmlyYWwuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL3ppcHB5L3ppcHB5LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvZGVmYXVsdHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC9kb20uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC9lbWl0dGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvcGx1Y2suanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC90cmFuc2xhdGUuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC91bmlxdWVfaWQuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC92ZWN0b3JzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvemlwcy5qcyIsIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDak5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25NQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidm9pZCBmdW5jdGlvbigpe1xuICAvLyB2YXIgU25hcCA9IHJlcXVpcmUoJ3NuYXBzdmcnKVxuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciBkYWdyZSA9IHJlcXVpcmUoJ2RhZ3JlJylcbiAgdmFyIGhnbHVlID0gcmVxdWlyZSgnaHlwZXJnbHVlJylcbiAgdmFyIHppcHB5ID0gcmVxdWlyZSgnemlwcHknKVxuICB2YXIgcGx1Y2sgPSByZXF1aXJlKCcuLi91dGlsL3BsdWNrLmpzJylcbiAgdmFyIGRlZmF1bHRzID0gcmVxdWlyZSgnLi4vdXRpbC9kZWZhdWx0cy5qcycpXG4gIHZhciB1aWQgPSByZXF1aXJlKCcuLi91dGlsL3VuaXF1ZV9pZC5qcycpXG4gIHZhciBkb20gPSByZXF1aXJlKCcuLi91dGlsL2RvbS5qcycpXG4gIHZhciBpbnRlcnNlY3QgPSByZXF1aXJlKCcuL2ludGVyc2VjdC5qcycpXG4gIHZhciBmbG9vciA9IE1hdGguZmxvb3JcbiAgdmFyIGNlaWwgPSBNYXRoLmNlaWxcbiAgdmFyIG1pbiA9IE1hdGgubWluXG4gIHZhciBtYXggPSBNYXRoLm1heFxuXG4gIGZ1bmN0aW9uIGZyb21fZGVmcyhkaWFncmFtLCBjbGFzc25hbWUpe1xuICAgIHJldHVybiBkaWFncmFtLnN2Z2VsLnBhcmVudCgpLnNlbGVjdCgnZGVmcyAuJyArIGNsYXNzbmFtZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvX2RlZnMoZGlhZ3JhbSwgc3ZnKXtcbiAgICB2YXIgcCA9IGRpYWdyYW0uc3ZnZWwucGFyZW50KClcbiAgICBpZiAoIHR5cGVvZiBzdmcgPT0gJ3N0cmluZycgKSB7XG4gICAgICB2YXIgZWwgPSBTbmFwLnBhcnNlKHN2Zykuc2VsZWN0KCcqJylcbiAgICB9IGVsc2UgaWYgKCBBcnJheS5pc0FycmF5KHN2ZykgKSB7XG4gICAgICB2YXIgZWwgPSBwLmVsLmFwcGx5KHAuZWwsIHN2ZylcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCBkaWFncmFtLmNvbmZpZy5kZWJ1ZyApIGNvbnNvbGUuZXJyb3IoJ3VucmVjb2duaXphYmxlIHN2ZyB2YXJpYWJsZSB0eXBlJylcbiAgICB9XG4gICAgcmV0dXJuIHAuc2VsZWN0KCdkZWZzJykuYXBwZW5kKGVsKVxuICB9XG5cbiAgZnVuY3Rpb24gZHJhdyhkaWFncmFtLCBlbCl7XG4gICAgdmFyIG5ld19lbCA9IGZyb21fZGVmcyhkaWFncmFtLCBlbC5jbGFzc25hbWUpLmNsb25lKClcbiAgICB2YXIgbm9kZSA9IGhnbHVlKG5ld19lbC5ub2RlLCBlbC5jb250ZW50KVxuICAgIGRpYWdyYW0uc3ZnZWwuYXBwZW5kKG5ld19lbClcbiAgICByZXR1cm4gbmV3X2VsXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfbGluZV9hdHRycyhpdGVtLCBsaW5lX2hlaWdodCwgeCl7XG4gICAgaXRlbS5nLnNlbGVjdEFsbCgndHNwYW4nKS5mb3JFYWNoKGZ1bmN0aW9uKHRzcGFuLCBpZHgpe1xuICAgICAgdHNwYW4uYXR0cih7IGR5OiBpZHggPyBsaW5lX2hlaWdodCA6IDAgLCB4OiB4IH0pXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc19jYWxjKHgsdyx5LGgpe1xuICAgIHJldHVybiBbeCArIHcgLyAyLCB5ICsgaCAvIDJdXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfdGV4dHdpZHRoKG5vZGUpe1xuICAgIHJldHVybiBub2RlLmdldENvbXB1dGVkVGV4dExlbmd0aCgpXG4gIH1cblxuICBmdW5jdGlvbiBpbnZpel9iYm94KGRpYWdyYW0sIGVsKXtcbiAgICB2YXIgY2xvbmUgPSBlbC5jbG9uZSgpLmF0dHIoKVxuICAgIGRpYWdyYW0uc3ZnZWwuYXBwZW5kKGNsb25lKVxuICAgIHZhciBiYm94ID0gY2xvbmUuZ2V0QkJveCgpXG4gICAgY2xvbmUucmVtb3ZlKClcbiAgICByZXR1cm4gYmJveFxuICB9XG5cbiAgZnVuY3Rpb24gcG9pbnRfdG9fc3RyaW5nKHApeyByZXR1cm4gcC54ICsgJywnICsgcC55IH1cblxuICBmdW5jdGlvbiBob3Jpem9udGFsKGxpbmUpe1xuICAgIHJldHVybiBsaW5lLmdldEF0dHJpYnV0ZSgneDEnKSA9PSBsaW5lLmdldEF0dHJpYnV0ZSgneDInKVxuICB9XG5cbiAgZnVuY3Rpb24gYXBwbHlfZGltZW5zaW9ucyhkaWFncmFtKXtcbiAgICAvLyBhcHBseSBoZWlnaHQgLyB3aWR0aCBvbiBub2Rlc1xuICAgIHZhciBiYm94X2NhY2hlID0ge31cbiAgICBkaWFncmFtLmdyYXBoLmVhY2hOb2RlKGZ1bmN0aW9uKGlkLCBub2RlKXtcbiAgICAgIHZhciBjbGFzc25hbWUgPSBub2RlLmNsYXNzbmFtZVxuICAgICAgdmFyIGJib3ggPSBiYm94X2NhY2hlW2NsYXNzbmFtZV0gfHwgKGJib3hfY2FjaGVbY2xhc3NuYW1lXSA9IGludml6X2Jib3goZGlhZ3JhbSwgZnJvbV9kZWZzKGRpYWdyYW0sIGNsYXNzbmFtZSkpKVxuICAgICAgbm9kZS5hdHRyKCd3aWR0aCcsIGJib3gud2lkdGgpXG4gICAgICBub2RlLmF0dHIoJ2hlaWdodCcsIGJib3guaGVpZ2h0KVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBkaXNwbGF5X25vZGVzKGxheW91dCwgZGlhZ3JhbSl7XG4gICAgLy8gZGlzcGxheSBub2Rlc1xuICAgIGxheW91dC5lYWNoTm9kZShmdW5jdGlvbihpZCwgdmFsdWVzKXtcbiAgICAgIHZhciBub2RlID0gZGlhZ3JhbS5ncmFwaC5ub2RlKGlkKVxuICAgICAgbm9kZS5hdHRyKCd4JywgdmFsdWVzLngpXG4gICAgICBub2RlLmF0dHIoJ3knLCB2YWx1ZXMueSlcbiAgICAgIHZhciB4ID0gdmFsdWVzLnggLSB2YWx1ZXMud2lkdGggLyAyXG4gICAgICB2YXIgeSA9IHZhbHVlcy55IC0gdmFsdWVzLmhlaWdodCAvIDJcbiAgICAgIG5vZGUuYWRkX2F0dHIoJzpmaXJzdCcsICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyB4ICsgJywnICsgeSArICcpJylcbiAgICAgIG5vZGUudHJhbnNmb3JtKHZhbHVlcylcbiAgICAgIGRyYXcoZGlhZ3JhbSwgbm9kZSlcbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gaW5pdF9sYXlvdXQoZGlhZ3JhbSl7XG4gICAgYXBwbHlfZGltZW5zaW9ucyhkaWFncmFtKVxuICAgIHJldHVybiBkaWFncmFtLnJ1bihkaWFncmFtLmdyYXBoKVxuICB9XG5cblxuICBmdW5jdGlvbiBkcmF3X3NlZ21lbnQoZGlhZ3JhbSwgdHJhbnNmb3JtLCB0YXJnZXQsIHNlZ21lbnQpe1xuICAgIHZhciB0cmFuc2Zfb2JqID0gT2JqZWN0LmNyZWF0ZSh0cmFuc2Zvcm0pXG4gICAgdHJhbnNmX29iai5jb250ZW50ID0ge31cbiAgICB0cmFuc2Zfb2JqLmNvbnRlbnRbdGFyZ2V0XSA9IHNlZ21lbnRcbiAgICBkcmF3KGRpYWdyYW0sIHRyYW5zZl9vYmopXG4gICAgcmV0dXJuIHNlZ21lbnRcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYXdfc2VnbWVudHMoZGlhZ3JhbSwgdHJhbnNmb3JtLCB0YXJnZXQsIGVkZ2VzKXtcbiAgICB2YXIgdHJhbnNmX29iaiA9IE9iamVjdC5jcmVhdGUodHJhbnNmb3JtKVxuICAgIHRyYW5zZl9vYmouY29udGVudCA9IHt9XG4gICAgdHJhbnNmX29iai5jb250ZW50W3RhcmdldF0gPSBlZGdlcy5tYXAoZnVuY3Rpb24ocyl7IHJldHVybiB7JzpmaXJzdCc6IHN9fSlcbiAgICBkcmF3KGRpYWdyYW0sIHRyYW5zZl9vYmopXG4gICAgcmV0dXJuIGVkZ2VzXG4gIH1cblxuICB2YXIgZ2V0X2p1bmN0aW9uX25vZGUgPSBwbHVjaygnbm9kZScpXG4gIHZhciBnZXRfanVuY3Rpb25fY3V0ID0gcGx1Y2soJ2N1dCcpXG5cbiAgZnVuY3Rpb24gZGlzcGxheShkaWFncmFtKXtcblxuICAgIHZhciB0cmFuc2Zvcm1fb2JqZWN0ID0geyBjbGFzc25hbWU6IGRpYWdyYW0uY29uZmlnLmVkZ2VDbGFzcyB9XG5cbiAgICAvLyByZW1vdmUgYWxsIHN2ZyBub2Rlc1xuICAgIC8vIFRPRE86IGF0IHNvbWUgcG9pbnQgdGhpcyBjb3VsZCBiZSBvcHRpbWFsaXplZCBzbyB3ZSByZXVzZSB0aGUgbm9kZXMgd2hpY2ggZG8gbm90IGNoYW5nZVxuICAgIGRpYWdyYW0uc3ZnZWwuY2xlYXIoKVxuXG5cbiAgICB2YXIgbGF5b3V0ID0gaW5pdF9sYXlvdXQoZGlhZ3JhbSlcblxuICAgIGRpc3BsYXlfbm9kZXMobGF5b3V0LCBkaWFncmFtKVxuXG4gICAgdmFyIG91dGdyYXBoID0gbGF5b3V0LmdyYXBoKClcbiAgICB2YXIgcmFua0RpciA9IG91dGdyYXBoLnJhbmtEaXJcbiAgICB2YXIgdmVydGljYWwgPSByYW5rRGlyID09ICdUQicgfHwgcmFua0RpciA9PSAnQlQnXG5cbiAgICAvLyBjYWxjdWxhdGUgZWRnZXMgbGF5b3V0XG4gICAgdmFyIGVkZ2VzID0gcmVxdWlyZSgnLi9lZGdlcy5qcycpKGRpYWdyYW0sIGxheW91dClcblxuICAgIGRyYXdfc2VnbWVudHMoZGlhZ3JhbSwgdHJhbnNmb3JtX29iamVjdCwgJy5FZGdlJywgZWRnZXMpXG5cbiAgICB2YXIgaW50ZXJzZWN0aW9uX3NpemUgPSBpbnZpel9iYm94KGRpYWdyYW0sIGZyb21fZGVmcyhkaWFncmFtLCBkaWFncmFtLmNvbmZpZy5pbnRlcnNlY3Rpb25DbGFzcykpXG4gICAgdmFyIGludGVyc2VjdGlvbl9taWRkbGUgPSBbaW50ZXJzZWN0aW9uX3NpemUud2lkdGggLyAyLCBpbnRlcnNlY3Rpb25fc2l6ZS5oZWlnaHQgLyAyXVxuICAgIGVkZ2VzLmZvckVhY2goZnVuY3Rpb24oc2VnMSwgaWQxKXtcbiAgICAgIGVkZ2VzLmZvckVhY2goZnVuY3Rpb24oc2VnMiwgaWQyKXtcbiAgICAgICAgaWYgKCBpZDIgPiBpZDEgJiYgc2VnMS54MSAhPSBzZWcyLngxICYmICBzZWcxLngyICE9IHNlZzIueDJcbiAgICAgICAgICAgICAgICAgICAgICAgJiYgc2VnMS55MSAhPSBzZWcyLnkxICYmICBzZWcxLnkyICE9IHNlZzIueTJcbiAgICAgICAgICAgICAgICAgICAgICAgJiYgc2VnMS54MSAhPSBzZWcyLngyICYmICBzZWcxLnkxICE9IHNlZzIueTJcbiAgICAgICAgICAgICAgICAgICAgICAgJiYgc2VnMS54MSAhPSBzZWcyLnkxICYmICBzZWcxLngyICE9IHNlZzIueTJcbiAgICAgICAgICAgICAgICAgICAgICAgJiYgc2VnMS54MSAhPSBzZWcyLnkyICYmICBzZWcxLngyICE9IHNlZzIueTFcbiAgICAgICAgICAgKSB7XG4gICAgICAgICAgdmFyIGlzY3QgPSBpbnRlcnNlY3Qoc2VnMSwgc2VnMilcbiAgICAgICAgICBpZiAoIGlzY3RbMF0gPT0gOCApIHsgLy8gaW50ZXJzZWN0aW5nXG4gICAgICAgICAgICB2YXIgc2VnMW5vZGUgPSBkb20uJGlkKHNlZzEuaWQpXG4gICAgICAgICAgICB2YXIgc2VnMm5vZGUgPSBkb20uJGlkKHNlZzIuaWQpXG4gICAgICAgICAgICB2YXIgdG9wbm9kZSA9IHNlZzFub2RlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKHNlZzJub2RlKSAmIDQgPyBzZWcxbm9kZSA6IHNlZzJub2RlXG4gICAgICAgICAgICB2YXIgaW50ZXJzZWN0X25vZGUgPSBkcmF3KGRpYWdyYW0sIHsgY2xhc3NuYW1lOiBkaWFncmFtLmNvbmZpZy5pbnRlcnNlY3Rpb25DbGFzcyAsIGNvbnRlbnQ6IHt9IH0pXG4gICAgICAgICAgICBpZiAoIGhvcml6b250YWwodG9wbm9kZSkgKSB7XG4gICAgICAgICAgICAgIGludGVyc2VjdF9ub2RlLnRyYW5zZm9ybSgobmV3IFNuYXAuTWF0cml4KDEsIDAsIDAsIDEsIDAgLCAwKSkucm90YXRlKDkwLCBpc2N0WzFdWzBdICwgaXNjdFsxXVsxXSApLnRvVHJhbnNmb3JtU3RyaW5nKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zZm9ybShpbnRlcnNlY3Rfbm9kZS5tYXRyaXgudHJhbnNsYXRlKGlzY3RbMV1bMF0gLSBpbnRlcnNlY3Rpb25fbWlkZGxlWzBdLCBpc2N0WzFdWzFdIC0gaW50ZXJzZWN0aW9uX21pZGRsZVsxXSkpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpbnRlcnNlY3Rfbm9kZS50cmFuc2Zvcm0obmV3IFNuYXAuTWF0cml4KDEsIDAsIDAsIDEsIGlzY3RbMV1bMF0gLSBpbnRlcnNlY3Rpb25fbWlkZGxlWzBdLCBpc2N0WzFdWzFdIC0gaW50ZXJzZWN0aW9uX21pZGRsZVsxXSkpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRvbS5pbnNlcnRBZnRlcih0b3Bub2RlLnBhcmVudE5vZGUsIGludGVyc2VjdF9ub2RlLm5vZGUsIHRvcG5vZGUubmV4dFNpYmxpbmcpXG5cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcblxuICAgIHZhciBtb3ZlID0gbmV3IFNuYXAuTWF0cml4KDEsIDAsIDAsIDEsIDAsIDApXG4gICAgaWYgKCByYW5rRGlyID09IFwiTFJcIiB8fCByYW5rRGlyID09IFwiUkxcIiApIHtcbiAgICAgIG91dGdyYXBoLmhlaWdodCA9IG91dGdyYXBoLmhlaWdodCArIGVkZ2VzLmdyb3d0aCAqIDJcbiAgICAgIHZhciBtb3ZlID0gbW92ZS50cmFuc2xhdGUoMCwgZWRnZXMuZ3Jvd3RoKVxuICAgIH0gZWxzZSB7XG4gICAgICBvdXRncmFwaC53aWR0aCA9IG91dGdyYXBoLndpZHRoICsgZWRnZXMuZ3Jvd3RoICogMlxuICAgICAgdmFyIG1vdmUgPSBtb3ZlLnRyYW5zbGF0ZShlZGdlcy5ncm93dGgsIDApXG4gICAgfVxuXG4gICAgZGlhZ3JhbS5zdmdlbC5hdHRyKHsgd2lkdGg6IG91dGdyYXBoLndpZHRoLCBoZWlnaHQ6IG91dGdyYXBoLmhlaWdodCB9KS50cmFuc2Zvcm0obW92ZS50b1RyYW5zZm9ybVN0cmluZygpKVxuXG4gICAgaWYgKCB2ZXJ0aWNhbCApIHtcbiAgICAgIGRpYWdyYW0uY29uZmlnLmhlaWdodCA9IGRpYWdyYW0uY29uZmlnLmhlaWdodCArIGVkZ2VzLmdyb3d0aFxuICAgIH0gZWxzZSB7XG4gICAgICBkaWFncmFtLmNvbmZpZy53aWR0aCA9IGRpYWdyYW0uY29uZmlnLndpZHRoICsgZWRnZXMuZ3Jvd3RoXG4gICAgfVxuXG4gICAgZGlhZ3JhbS5zdmdlbC5wYXJlbnQoKS5hdHRyKHtcbiAgICAgIHdpZHRoOiBvdXRncmFwaC53aWR0aCArIGRpYWdyYW0uY29uZmlnLnBhZGRpbmcgKiAyXG4gICAgLCBoZWlnaHQ6IG91dGdyYXBoLmhlaWdodCArIGRpYWdyYW0uY29uZmlnLnBhZGRpbmcgKiAyXG4gICAgfSlcblxuICAgIHJldHVybiBkaWFncmFtXG4gIH1cblxuICB2YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvZW1pdHRlci5qcycpXG4gIHZhciBsYXlvdXQgPSBlbWl0dGVyLmV4dGVuZChkYWdyZS5sYXlvdXQoKSlcblxuICBtb2R1bGUuZXhwb3J0cyA9IGxheW91dC5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGNvbmZpZywgZ3JhcGgpe1xuICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgIE9iamVjdC5rZXlzKGNvbmZpZy5sYXlvdXRfY29uZmlnKS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZCl7XG4gICAgICAgIHRoaXNbbWV0aG9kXShjb25maWcubGF5b3V0X2NvbmZpZ1ttZXRob2RdKVxuICAgICAgfSwgdGhpcylcbiAgICAgIHRoaXMucmFua1NpbXBsZXggPSB0cnVlXG4gICAgICB0aGlzLmdyYXBoID0gZ3JhcGhcbiAgICAgIHRoaXMuaWQgPSB1aWQoKVxuICAgICAgdGhpcy5zdmdlbCA9IFNuYXAuYXBwbHkoU25hcCwgY29uZmlnLnNuYXBfYXJncykuZygpLmF0dHIoeyB0cmFuc2Zvcm06IFwidHJhbnNsYXRlKDIwLDIwKVwiLCBpZDp0aGlzLmlkfSlcbiAgICAgIHRoaXMubm9kZSA9IHRoaXMuc3ZnZWwucGFyZW50KCkubm9kZVxuICAgIH1cbiAgLCBkaXNwbGF5OiBlbnNsYXZlKGRpc3BsYXkpXG4gICwgZHJhdzogZW5zbGF2ZShkcmF3KVxuICAsIHRvX2RlZnM6IGVuc2xhdmUodG9fZGVmcylcblxuICB9KVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgdmFyIGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcbiAgdmFyIHppcGcgPSByZXF1aXJlKCcuLi91dGlsL3ppcHMuanMnKS56aXBHcmVlZHlcblxuICAvLyBbYV0g4oaSIGFcbiAgZnVuY3Rpb24gZmlyc3QoYXMpeyByZXR1cm4gYXMgJiYgYXNbMF0gfVxuXG4gIC8vIFthXSDihpIgYVxuICBmdW5jdGlvbiBsYXN0KGFzKXsgcmV0dXJuIGFzICYmIGFzW2FzLmxlbmd0aCAtIDFdIH1cblxuICAvLyBhIOKGkiBCb29sZWFuXG4gIGZ1bmN0aW9uIG5vdF9udWxsKGEpeyByZXR1cm4gYSAhPSBudWxsIH1cblxuICAvLyAoYSwgYikg4oaSIEJvb2xlYW5cbiAgZnVuY3Rpb24gZXF1YWwoYSwgYil7IHJldHVybiBhID09PSBiIH1cblxuICAvLyAoYTEg4oaSIGEyIOKGkiAuLi4g4oaSIGFOIOKGkiBiKSDihpIgKCNbYTEsIGEyLCAuLi4sIGFOKSDihpIgYilcbiAgZnVuY3Rpb24gc3ByZWFkKGYpe1xuICAgIHJldHVybiBmdW5jdGlvbihhcmdzKXsgcmV0dXJuIGYuYXBwbHkodGhpcywgYXJncykgfVxuICB9XG5cbiAgLy8gKFthXSwgYSkg4oaSIEludGVnZXJcbiAgZnVuY3Rpb24gY291bnQoYXJyLCB2YWx1ZSl7XG4gICAgcmV0dXJuIGFyci5maWx0ZXIoZnVuY3Rpb24oZWxlbSl7IHJldHVybiBlbGVtID09IHZhbHVlIH0pLmxlbmd0aFxuICB9XG5cbiAgLy8gKFthXSwgW2FdKSDihpIgQm9vbGVhblxuICBmdW5jdGlvbiBlcXVhbF9saXN0cyhsMSwgbDIpe1xuICAgIHJldHVybiB6aXBnKGwxLCBsMikuZXZlcnkoc3ByZWFkKGVxdWFsKSlcbiAgfVxuXG4gIC8vIChbW2FdXSwgW2FdKSDihpIgQm9vbGVhblxuICBmdW5jdGlvbiBmaW5kX3N1Ymxpc3QobGlzdHMsIGwpe1xuICAgIHJldHVybiBsaXN0cy5zb21lKGVxdWFsX2xpc3RzLmJpbmQobnVsbCwgbCkpXG4gIH1cblxuICAvLyAoTWVyZ2VkRWRnZSwgTWVyZ2VkRWRnZSkg4oaSIEJvb2xlYW5cbiAgZnVuY3Rpb24gbWVfZXF1YWwoYSwgYil7XG4gICAgcmV0dXJuIGEuZXZlcnkoZnVuY3Rpb24oYWUpe1xuICAgICAgcmV0dXJuIGZpbmRfc3VibGlzdChiLCBhZSlcbiAgICB9KVxuICB9XG5cbiAgLy8gW2FdIOKGkiBbYV1cbiAgZnVuY3Rpb24gdW5pcXVlKGxpc3Qpe1xuICAgIHJldHVybiBsaXN0LmZpbHRlcihmdW5jdGlvbih4LCBpKXsgcmV0dXJuIGxpc3QuaW5kZXhPZih4KSA9PSBpIH0pXG4gIH1cblxuICAvLyAoW1thXV0g4oaSIFthXSlcbiAgZnVuY3Rpb24gZmxhdHRlbihuZXN0ZWQpe1xuICAgIHJldHVybiBbXS5jb25jYXQuYXBwbHkoW10sIG5lc3RlZClcbiAgfVxuXG4gIC8vIChOdW1iZXIsIE5vZGUpIOKGkiBCb29sZWFuXG4gIGZ1bmN0aW9uIHNhbWVfcmFuayhjcm4sIG4peyByZXR1cm4gbi50cnVlX3JhbmsgPT0gY3JuIH1cblxuICAvLyBNZXJnZWRFZGdlIOKGkiBbTm9kZV1cbiAgZnVuY3Rpb24gbWVfbm9kZShzZWxlY3RvciwgbWVyZ2VkX2VkZ2Upe1xuICAgIHJldHVybiBtZXJnZWRfZWRnZS5tYXAoc2VsZWN0b3IpLmZpbHRlcihub3RfbnVsbClcbiAgfVxuXG4gIC8vIChFZGdlIOKGkiBOb2RlKSDihpIgW01lcmdlZEVkZ2VzXVxuICBmdW5jdGlvbiBnZXRfdHJhbnNmb3JtcyhzZWxlY3Rvciwgc2FtZV9lZGdlKXtcblxuICAgIHZhciBtZV9ub2RlX2JvdW5kID0gbWVfbm9kZS5iaW5kKG51bGwsIHNlbGVjdG9yKVxuXG4gICAgLy8gW01lcmdlZEVkZ2VdIOKGkiBbW05vZGVdXVxuICAgIGZ1bmN0aW9uIG1lc19ub2RlcyhtZXMpe1xuICAgICAgcmV0dXJuIG1lcy5tYXAobWVfbm9kZV9ib3VuZClcbiAgICB9XG5cbiAgICAvLyAoTWVyZ2VkRWRnZSwgTWVyZ2VkRWRnZSkg4oaSIEJvb2xlYW5cbiAgICBmdW5jdGlvbiBkaWZmZXJlbnRfZWRnZShhLCBiKXtcbiAgICAgIHJldHVybiAhIHNhbWVfZWRnZShhLCBiKVxuICAgIH1cblxuICAgIC8vIChbTWVyZ2VkRWRnZV0sIE1lcmdlZEVkZ2UpIOKGkiBbTWVyZ2VkRWRnZV1cbiAgICBmdW5jdGlvbiBkaWZmZXJlbnRfZWRnZXMobWVzLCBtZSl7XG4gICAgICByZXR1cm4gbWVzLmZpbHRlcihkaWZmZXJlbnRfZWRnZS5iaW5kKG51bGwsIG1lKSlcbiAgICB9XG5cbiAgICAvLyAoW01lcmdlZEVkZ2VdLCBNZXJnZWRFZGdlKSDihpIgW01lcmdlZEVkZ2VdXG4gICAgZnVuY3Rpb24gc2FtZV9lZGdlcyhtZXMsIG1lKXtcbiAgICAgIHJldHVybiBtZXMuZmlsdGVyKHNhbWVfZWRnZS5iaW5kKG51bGwsIG1lKSlcbiAgICB9XG5cbiAgICAvLyAoW01lcmdlZEVkZ2VdLCBNZXJnZWRFZGdlKSDihpIgW01lcmdlZEVkZ2VdXG4gICAgZnVuY3Rpb24gbmV3X2VkZ2VzKGFsbCwgZGlmZiwgc2FtZSwgbWUpe1xuICAgICAgdmFyIG1lc19zID0gbWVzX25vZGVzKGFsbClcbiAgICAgIHZhciBoYXNfbWUgPSBtZV9lcXVhbC5iaW5kKG51bGwsIG1lKVxuICAgICAgdmFyIGlzX21lX25ldyA9IGFsbC5sZW5ndGggPT0gMCB8fCAhICggZGlmZi5zb21lKGhhc19tZSkgfHwgIHNhbWUuc29tZShoYXNfbWUpKVxuICAgICAgcmV0dXJuIGlzX21lX25ldyA/IFttZV0gOiBbXVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBkaWZmZXJlbnRfZWRnZXM6IGRpZmZlcmVudF9lZGdlc1xuICAgICwgc2FtZV9lZGdlczogc2FtZV9lZGdlc1xuICAgICwgbmV3X2VkZ2VzOiBuZXdfZWRnZXNcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzb3VyY2UoZWRnZSl7XG4gICAgdmFyIGZpcnN0X3BvaW50ID0gZmlyc3QoZWRnZSlcbiAgICByZXR1cm4gZmlyc3RfcG9pbnQgJiYgZmlyc3RfcG9pbnQuZXhpdFxuICB9XG5cbiAgLy8gKE1lcmdlZEVkZ2UsIE1lcmdlZEVkZ2UpIOKGkiBCb29sZWFuXG4gIGZ1bmN0aW9uIHNhbWVfc291cmNlKGEsIGIpe1xuICAgIHZhciBhbnMgPSB1bmlxdWUobWVfbm9kZShzb3VyY2UsIGEpKVxuICAgIHZhciBjZ24gPSBmaXJzdChhbnMpLnRydWVfcmFua1xuICAgIHZhciBibnMgPSB1bmlxdWUobWVfbm9kZShzb3VyY2UsIGIpLmZpbHRlcihzYW1lX3JhbmsuYmluZChudWxsLCBjZ24pKSlcbiAgICByZXR1cm4gZXF1YWxfbGlzdHMoYW5zLCBibnMpXG4gIH1cblxuICAvLyAoTWVyZ2VkRWRnZSwgTWVyZ2VkRWRnZSkg4oaSIE1lcmdlZEVkZ2VcbiAgZnVuY3Rpb24gbWVyZ2VfYnlfc291cmNlKGIsIGEpe1xuICAgIHZhciBiX3NvdXJjZXMgPSBiLm1hcChmaXJzdClcbiAgICB2YXIgYV9zb3VyY2UgPSBmaXJzdChhKVxuXG4gICAgYi5mb3JFYWNoKGZ1bmN0aW9uKGJfc291cmNlKXtcbiAgICAgIGJfc291cmNlWzBdLnJlbW92ZSgpXG4gICAgICBiX3NvdXJjZVswXSA9IGFfc291cmNlWzBdXG4gICAgICBiX3NvdXJjZVsxXSA9IGFfc291cmNlWzFdXG4gICAgICBiX3NvdXJjZVsyXS5leGl0X2p1bmN0aW9uID0gYl9zb3VyY2VbMV1cbiAgICB9KVxuICAgIHJldHVybiBhLmNvbmNhdChiKVxuICB9XG5cbiAgLy8gRWRnZSDihpIgTm9kZVxuICBmdW5jdGlvbiB0YXJnZXQoZWRnZSl7XG4gICAgdmFyIGxhc3RfcG9pbnQgPSBsYXN0KGVkZ2UpXG4gICAgcmV0dXJuIGxhc3RfcG9pbnQgJiYgbGFzdF9wb2ludC5lbnRyeVxuICB9XG5cbiAgLy8gKE1lcmdlZEVkZ2UsIE1lcmdlZEVkZ2UpIOKGkiBCb29sZWFuXG4gIGZ1bmN0aW9uIHNhbWVfdGFyZ2V0KGEsIGIpe1xuICAgIHZhciBhbiA9IG1lX25vZGUodGFyZ2V0LCBhKVxuICAgIHZhciBjZ24gPSBmaXJzdChhbikudHJ1ZV9yYW5rXG4gICAgdmFyIG5zID0gIG1lX25vZGUodGFyZ2V0LCBiKS5maWx0ZXIoc2FtZV9yYW5rLmJpbmQobnVsbCwgY2duKSlcbiAgICByZXR1cm4gZXF1YWxfbGlzdHMobnMsIGFuKVxuICB9XG5cbiAgLy8gKE1lcmdlZEVkZ2UsIE1lcmdlZEVkZ2UpIOKGkiBNZXJnZWRFZGdlXG4gIGZ1bmN0aW9uIG1lcmdlX2J5X3RhcmdldChiLCBhKXtcbiAgICB2YXIgbWVfdGFyZ2V0ID0gbWVfbm9kZS5iaW5kKG51bGwsIHRhcmdldClcbiAgICB2YXIgYl90YXJnZXRzID0gbWVfdGFyZ2V0KGIpXG4gICAgdmFyIGVkZ2VzX3RvX21lcmdlID0gYS5maWx0ZXIoZnVuY3Rpb24oZWRnZSl7XG4gICAgICByZXR1cm4gYl90YXJnZXRzLmluZGV4T2YodGFyZ2V0KGVkZ2UpKSA+IC0xXG4gICAgfSlcbiAgICBlZGdlc190b19tZXJnZS5mb3JFYWNoKGZ1bmN0aW9uKGVkZ2VfdG9fbWVyZ2Upe1xuICAgICAgdmFyIGFfZW5kID0gZWRnZV90b19tZXJnZS5sZW5ndGggLSAxXG4gICAgICBiLmZvckVhY2goZnVuY3Rpb24oYl9lZGdlKXtcbiAgICAgICAgdmFyIGJfZW5kID0gYl9lZGdlLmxlbmd0aCAtIDFcbiAgICAgICAgaWYgKCB0YXJnZXQoZWRnZV90b19tZXJnZSkgPT0gdGFyZ2V0KGJfZWRnZSkgKSB7XG4gICAgICAgICAgYl9lZGdlW2JfZW5kXS5yZW1vdmUoKVxuICAgICAgICAgIGJfZWRnZVtiX2VuZF0gPSBlZGdlX3RvX21lcmdlW2FfZW5kXVxuICAgICAgICAgIGJfZWRnZVtiX2VuZCAtIDFdID0gZWRnZV90b19tZXJnZVthX2VuZCAtIDFdXG4gICAgICAgICAgYl9lZGdlW2JfZW5kIC0gMl0uZXhpdF9qdW5jdGlvbiA9IGJfZWRnZVtiX2VuZCAtIDFdXG4gICAgICAgICAgaWYgKCBiX2VuZCA9PSAzICYmIGFfZW5kID09IDUgKSB7XG4gICAgICAgICAgICAvLyBlZGdlX3RvX21lcmdlWzNdLnJlbGF0aXZlID0gYl9lZGdlWzBdXG4gICAgICAgICAgICBlZGdlX3RvX21lcmdlWzRdLnJlbGF0aXZlID0gYl9lZGdlWzFdXG5cbiAgICAgICAgICB9IGVsc2UgaWYgKCBiX2VuZCA9PSA1ICYmIGFfZW5kID09IDMgKSB7XG4gICAgICAgICAgICBiX2VkZ2VbM10ucmVsYXRpdmUgPSBlZGdlX3RvX21lcmdlWzJdXG4gICAgICAgICAgfSBlbHNlIGlmICggYl9lbmQgPT0gNSAmJiBhX2VuZCA9PSA1ICkge1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgcmV0dXJuIGEuY29uY2F0KGIpXG4gIH1cblxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWRnZXMpe1xuICAgIHZhciBtZXMgPSBlZGdlcy5tYXAoZnVuY3Rpb24oZyl7IHJldHVybiBbZ10gfSlcblxuICAgIDtbXG4gICAgICBbc291cmNlLCBtZXJnZV9ieV9zb3VyY2UsIHNhbWVfc291cmNlXVxuICAgICwgW3RhcmdldCwgbWVyZ2VfYnlfdGFyZ2V0LCBzYW1lX3RhcmdldF1cbiAgICBdLmZvckVhY2goc3ByZWFkKGZ1bmN0aW9uKHNlbGVjdG9yLCBtZXJnZSwgc2FtZV9lZGdlKXtcbiAgICAgIHZhciB0ciA9IGdldF90cmFuc2Zvcm1zKHNlbGVjdG9yLCBzYW1lX2VkZ2UpXG4gICAgICB2YXIgZ3VhcmQgPSAwXG4gICAgICBmdW5jdGlvbiByZWMobWVzLCB0X2NvdW50KXtcbiAgICAgICAgbWVzID0gbWVzLnJlZHVjZShmdW5jdGlvbiBjb2xsYXBzZShtZXMsIG1lKXtcbiAgICAgICAgICB2YXIgZHQgPSB0ci5kaWZmZXJlbnRfZWRnZXMobWVzLCBtZSlcbiAgICAgICAgICB2YXIgc3QgPSB0ci5zYW1lX2VkZ2VzKG1lcywgbWUpXG4gICAgICAgICAgdmFyIG10ID0gc3QubWFwKG1lcmdlLmJpbmQobnVsbCwgbWUpKVxuICAgICAgICAgIHZhciBudCA9IHRyLm5ld19lZGdlcyhtZXMsIGR0LCBtdCwgbWUpXG4vLyBsb2coJ2RpZmYnLCBkdCwgJ21lcmcnLCBtdCwgJ25ldycgLG50KVxuICAgICAgICAgIHRfY291bnQgKz0gbXQubGVuZ3RoXG4gICAgICAgICAgcmV0dXJuIGR0LmNvbmNhdChtdCwgbnQpXG4gICAgICAgIH0sIFtdKVxuICAgICAgICAvLyBsb2cobWVzKVxuXG4gICAgICAgIC8vIGxvZyh0X2NvdW50KVxuICAgICAgICByZXR1cm4gdF9jb3VudCA+IDAgJiYgKytndWFyZCA8IDEwID8gcmVjKG1lcywgMCkgOiBtZXNcbiAgICAgIH1cbiAgICAgIG1lcyA9IHJlYyhtZXMsIDApXG4gICAgICAvLyBsb2coZ3VhcmQpXG4gICAgfSkpXG5cblxuICAgIHJldHVybiBmbGF0dGVuKG1lcylcbiAgfVxuXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuXG4gIHZhciB6aXAgPSByZXF1aXJlKCcuLi91dGlsL3ppcHMuanMnKS56aXBcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIHRyYW5zbGF0ZSA9IHJlcXVpcmUoJy4uL3V0aWwvdHJhbnNsYXRlLmpzJylcbiAgdmFyIEdhcHMgPSByZXF1aXJlKCcuL2dhcHMuanMnKVxuICB2YXIgc2lkZV9wb2ludHMgPSByZXF1aXJlKCcuL3NpZGVfcG9pbnRzLmpzJylcbiAgdmFyIGp1bmN0aW9uX3BvaW50cyA9IHJlcXVpcmUoJy4vanVuY3Rpb25fcG9pbnRzLmpzJylcbiAgdmFyIHNraXBfcG9pbnRzID0gcmVxdWlyZSgnLi9za2lwX3BvaW50cy5qcycpXG5cbnZhciBsb2cgPSBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpXG5cbiAgZnVuY3Rpb24gbm9kZV9mcm9tX2lkKGdyYXBoLCBpZCl7XG4gICAgdmFyIG4gPSBncmFwaC5ub2RlKGlkKVxuICAgIG4uaWQgPSBpZFxuICAgIG4uZ3JhcGggPSBncmFwaFxuICAgIHJldHVybiBuXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfbm9kZXMoZGlhZ3JhbSwgbGF5b3V0KXtcbiAgICB2YXIgbm9kZXMgPSBbXVxuICAgIHZhciBnID0gbGF5b3V0LmdyYXBoKClcbiAgICB2YXIgcmFua0RpciA9IGcucmFua0RpclxuICAgIHZhciB2ZXJ0aWNhbCA9IHJhbmtEaXIgPT0gJ1RCJyB8fCByYW5rRGlyID09ICdCVCdcbiAgICB2YXIgcmFua19hdHRyID0gdmVydGljYWwgPyAneScgOiAneCdcbiAgICB2YXIgbm9kZV9yYW5rX2RpbWVuc2lvbiA9IGdldF9yYW5rX2RpbWVuc2lvbi5iaW5kKG51bGwsIGRpYWdyYW0uY29uZmlnLnJhbmtfZGV0ZWN0aW9uX2Vycm9yX21hcmdpbiwgcmFua19hdHRyKVxuICAgIHZhciBub2RlX2Zyb21fbGF5b3V0ID0gbm9kZV9mcm9tX2lkLmJpbmQobnVsbCwgbGF5b3V0KVxuICAgIHZhciBlZGdlX2Zyb21fbGF5b3V0ID0gbm9kZV9mcm9tX2lkLmJpbmQobnVsbCwgbGF5b3V0KVxuICAgIGxheW91dC5lYWNoTm9kZShmdW5jdGlvbihpZCwgbm9kZSl7XG4gICAgICBub2RlLnJkaW0gPSBOdW1iZXIobm9kZV9yYW5rX2RpbWVuc2lvbihub2RlKSlcbiAgICAgIG5vZGUudGFyZ2V0cyA9IGxheW91dC5vdXRFZGdlcyhpZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAobGF5b3V0LnRhcmdldC5iaW5kKGxheW91dCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKG5vZGVfZnJvbV9sYXlvdXQpXG4gICAgICBub2RlLnNvdXJjZXMgPSBsYXlvdXQuaW5FZGdlcyhpZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAobGF5b3V0LnNvdXJjZS5iaW5kKGxheW91dCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKG5vZGVfZnJvbV9sYXlvdXQpXG4gICAgICBub2Rlcy5wdXNoKG5vZGUpXG4gICAgfSlcbiAgICByZXR1cm4gbm9kZXNcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9yYW5rX2RpbWVuc2lvbihtYXJnaW4sIGtleSwgbm9kZSl7XG4gICAgcmV0dXJuIE1hdGguY2VpbChub2RlW2tleV0gLyBtYXJnaW4pICogbWFyZ2luXG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVfc2VnbWVudChzdGFydCwgZW5kKXtcbiAgICByZXR1cm4geyBpZDogdWlkKCksIHgxOiBzdGFydC54LCB5MTpzdGFydC55LCB4MjogZW5kLngsIHkyOiBlbmQueX1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNlZ21lbnRzKHN0ZXBzLCBzKXtcbiAgICByZXR1cm4gc3RlcHMuY29uY2F0KHppcChzLCBzLnNsaWNlKDEpKS5tYXAoZnVuY3Rpb24oail7XG4gICAgICByZXR1cm4gY3JlYXRlX3NlZ21lbnQoalswXS5zdGF0aWMoKSwgalsxXS5zdGF0aWMoKSlcbiAgICB9KSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGlkeF90b19pZChzLCB0LCBpKXtcbiAgICBzW3QuaWRdID0gaVxuICAgIHJldHVybiBzXG4gIH1cblxuICBmdW5jdGlvbiBzb3J0X2J5X29yaWVudGF0aW9uKHZlcnRpY2FsLCBhLCBiKXsgcmV0dXJuIHZlcnRpY2FsID8gYSA6IGIgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYXBzX2VkZ2VzKGdhcHMpe1xuICAgIHJldHVybiBnYXBzLnJlZHVjZShmdW5jdGlvbihlZGdlcywgZWRnZSl7XG4gICAgICByZXR1cm4gZWRnZXMuY29uY2F0KGVkZ2UuZm9yd2FyZF9za2lwcy5jb25jYXQoZWRnZS5zdGVwcywgZWRnZS5iYWNrd2FyZF9za2lwcykpXG4gICAgfSwgW10pXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNhbGN1bGF0ZV9lZGdlcyhkaWFncmFtLCBsYXlvdXQpe1xuXG5cbiAgICBmdW5jdGlvbiBzdGVwcyhnYXAsIGV4aXRfcG9pbnQsIHNpKXtcbiAgICAgIHZhciBlbnRyeV9ub2RlID0gZXhpdF9wb2ludC5wYWlyX25vZGVcbiAgICAgIHZhciBlbnRyeV9wb2ludCA9IGV4aXRfcG9pbnQub3RoZXJfZW5kcG9pbnQoKVxuICAgICAgdmFyIGV4aXRfanVuY3Rpb24gPSBqdW5jdGlvbl9wb2ludHMubWFrZSgnc3RlcCcsIGV4aXRfcG9pbnQsIHNpLCBnYXAsIHJhbmtEaXIsIHJhbmtTZXApXG4gICAgICByZXR1cm4gW1xuICAgICAgICBleGl0X3BvaW50XG4gICAgICAsIGV4aXRfanVuY3Rpb25cbiAgICAgICwganVuY3Rpb25fcG9pbnRzLm1ha2UoJ3N0ZXAnLCBlbnRyeV9wb2ludCwgc2ksIGdhcCwgcmFua0RpciwgcmFua1NlcCwgbnVsbCwgZXhpdF9qdW5jdGlvbilcbiAgICAgICwgZW50cnlfcG9pbnRcbiAgICAgIF1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBza2lwcyhnYXAsIGRpcmVjdGlvbiwgZXhpdF9wb2ludCwgc2kpe1xuICAgICAgdmFyIGVudHJ5X25vZGUgPSBleGl0X3BvaW50LnBhaXJfbm9kZVxuICAgICAgdmFyIGVudHJ5X3BvaW50ID0gZXhpdF9wb2ludC5vdGhlcl9lbmRwb2ludCgpXG4gICAgICB2YXIgZXhpdF9qdW5jdGlvbiA9IGp1bmN0aW9uX3BvaW50cy5tYWtlKCdleGl0JywgZXhpdF9wb2ludCwgc2ksIGdhcCwgcmFua0RpciwgcmFua1NlcCwgZGlyZWN0aW9uKVxuICAgICAgdmFyIGVudHJ5X2p1bmN0aW9uID0ganVuY3Rpb25fcG9pbnRzLm1ha2UoJ2VudHJ5JywgZW50cnlfcG9pbnQsIHNpLCBnYXAsIHJhbmtEaXIsIHJhbmtTZXAsIGRpcmVjdGlvbilcbiAgICAgIHZhciByZXYgPSBkaXJlY3Rpb24gPT0gJ2ZvcndhcmQnID8gcmV2ZXJzZWQgOiAhIHJldmVyc2VkXG4gICAgICB2YXIgc2tpcCA9IFtcbiAgICAgICAgZXhpdF9wb2ludFxuICAgICAgLCBleGl0X2p1bmN0aW9uXG4gICAgICAsIHNraXBfcG9pbnRzLm1ha2UoZGlyZWN0aW9uLCAgZXhpdF9qdW5jdGlvbiwgZ2FwLCBzaSwgcmFua0Rpciwgc2tpcHNlcCwgcmV2LCBnLCByYW5rX2F0dHIsIGxldmVsX2RpcilcbiAgICAgICwgc2tpcF9wb2ludHMubWFrZShkaXJlY3Rpb24sIGVudHJ5X2p1bmN0aW9uLCBnYXAsIHNpLCByYW5rRGlyLCBza2lwc2VwLCByZXYsIGcsIHJhbmtfYXR0ciwgbGV2ZWxfZGlyKVxuICAgICAgLCBlbnRyeV9qdW5jdGlvblxuICAgICAgLCBlbnRyeV9wb2ludFxuICAgICAgXVxuICAgICAgcmV0dXJuIHNraXBcbiAgICB9XG5cbiAgICB2YXIgcmFua1NlcCA9IGRpYWdyYW0uY29uZmlnLmxheW91dF9jb25maWcucmFua1NlcFxuICAgIHZhciBnID0gbGF5b3V0LmdyYXBoKClcbiAgICB2YXIgcmFua0RpciA9IGcucmFua0RpclxuICAgIHZhciByZXZlcnNlZCA9IHJhbmtEaXIgPT0gJ0JUJyB8fCByYW5rRGlyID09ICdSTCdcbiAgICB2YXIgdmVydGljYWwgPSByYW5rRGlyID09ICdUQicgfHwgcmFua0RpciA9PSAnQlQnXG4gICAgdmFyIG9yaWVudGF0ZSA9IHNvcnRfYnlfb3JpZW50YXRpb24uYmluZChudWxsLCB2ZXJ0aWNhbClcbiAgICB2YXIgbGV2ZWxfZGlyID0gdmVydGljYWwgPyAnd2lkdGgnIDogJ2hlaWdodCdcbiAgICB2YXIgcmFua19hdHRyID0gdmVydGljYWwgPyAneScgOiAneCdcbiAgICB2YXIgbm9kZXMgPSBnZXRfbm9kZXMoZGlhZ3JhbSwgbGF5b3V0KVxuICAgIHZhciBza2lwc2VwID0gZGlhZ3JhbS5jb25maWcuc2tpcFNlcFxuXG4gICAgdmFyIG5vZGVzX2tleXMgPSBub2Rlcy5yZWR1Y2UoZnVuY3Rpb24obywgbm9kZSl7XG4gICAgICB2YXIgdiA9IG5vZGUucmRpbVxuICAgICAgOyhvW3ZdIHx8IChvW3ZdID0gW10pKS5wdXNoKG5vZGUpXG4gICAgICByZXR1cm4gb1xuICAgIH0sIHt9KVxuXG4gICAgbm9kZXMgPSBub2Rlcy5tYXAoZnVuY3Rpb24obil7XG4gICAgICBuLmV4aXRzID0gbi50YXJnZXRzLnJlZHVjZShpZHhfdG9faWQsIHt9KVxuICAgICAgbi5leGl0X3BvaW50cyA9IG4udGFyZ2V0cy5tYXAoZnVuY3Rpb24odGFyZ2V0X25vZGUpeyByZXR1cm4gc2lkZV9wb2ludHMubWFrZSgnZXhpdCcsIG4sIHJhbmtEaXIsIHRhcmdldF9ub2RlKSB9KVxuICAgICAgbi5lbnRyaWVzID0gbi5zb3VyY2VzLnJlZHVjZShpZHhfdG9faWQsIHt9KVxuICAgICAgbi5lbnRyeV9wb2ludHMgPSBuLnNvdXJjZXMubWFwKGZ1bmN0aW9uKHNvdXJjZV9ub2RlKXsgcmV0dXJuIHNpZGVfcG9pbnRzLm1ha2UoJ2VudHJ5JywgbiwgcmFua0Rpciwgc291cmNlX25vZGUpIH0pXG4gICAgICByZXR1cm4gblxuICAgIH0pXG5cbiAgICB2YXIgcmFua3MgPSAgT2JqZWN0LmtleXMobm9kZXNfa2V5cykuc29ydChmdW5jdGlvbihhLCBiKXsgcmV0dXJuICthIC0gK2IgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGssIGkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1trXS5tYXAoZnVuY3Rpb24obil7IG4udHJ1ZV9yYW5rID0gaTsgcmV0dXJuIG59KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNba11cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBub2Rlc19rZXlzKVxuICAgIHZhciBnYXBzID0gQXJyYXkocmFua3MubGVuZ3RoICsgMSlcblxuICAgIHJhbmtzLnJlZHVjZShmdW5jdGlvbihwLGEsaSkge1xuICAgICAgZ2Fwc1tpXSA9IEdhcHMuZXh0ZW5kKHtnZXRfZ2FwczogZnVuY3Rpb24oKXsgcmV0dXJuIGdhcHN9fSlcbiAgICAgICAgICAgICAgICAgICAgLm1ha2UocCwgYSwgaSwgc3RlcHMsIHNraXBzKVxuXG4gICAgICByZXR1cm4gYVxuICAgIH0sIFtdKVxuXG4gICAgZ2Fwc1tyYW5rcy5sZW5ndGhdID0gR2Fwcy5leHRlbmQoe2dldF9nYXBzOiBmdW5jdGlvbigpeyByZXR1cm4gZ2Fwc319KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFrZShyYW5rc1tyYW5rcy5sZW5ndGggLSAxXSwgW10sIHJhbmtzLmxlbmd0aCwgc3RlcHMsIHNraXBzKVxuXG4gICAgdmFyIGNvbGxhcHNlX2VkZ2VzID0gcmVxdWlyZSgnLi9lZGdlX2NvbGxhcHNlLmpzJylcbiAgICB2YXIgZWRnZXMgPSBjb2xsYXBzZV9lZGdlcyhnZXRfZ2Fwc19lZGdlcyhnYXBzKSkucmVkdWNlKHNlZ21lbnRzLCBbXSlcblxuXG4gICAgZWRnZXMuZ3Jvd3RoID0gZ2Fwcy5yZWR1Y2UoZnVuY3Rpb24oc3MsIHIpeyByZXR1cm4gc3MgKyByLmZvcndhcmRfc2tpcHMubGVuZ3RoICsgci5iYWNrd2FyZF9za2lwcy5sZW5ndGh9LCAwKSAqIHNraXBzZXBcblxuICAgIHJldHVybiBlZGdlc1xuICB9XG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG5cbiAgZnVuY3Rpb24gZ2V0X2VkZ2VzX2NvbWJpbmVkKGdhcCl7XG4gICAgcmV0dXJuIGdhcC5nZXRfZ2FwcygpLnJlZHVjZShmdW5jdGlvbihsLCBnKXtcbiAgICAgIHJldHVybiBsLmNvbmNhdCggW11cbiAgICAgICwgZy5mb3J3YXJkX3NraXBzXG4gICAgICAsIGdhcC5mb3J3YXJkX3NraXBzXG4gICAgICAsIGcuc3RlcHNcbiAgICAgICwgZ2FwLmJhY2t3YXJkX3NraXBzXG4gICAgICAsIGcuYmFja3dhcmRfc2tpcHNcbiAgICAgIClcbiAgICB9LCBbXSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9lZGdlcyhnYXApe1xuICAgIHJldHVybiBnYXAuZ2V0X2dhcHMoKS5yZWR1Y2UoZnVuY3Rpb24oZWRnZXMsIGVkZ2Upe1xuICAgICAgcmV0dXJuIGVkZ2VzLmNvbmNhdChlZGdlLmZvcndhcmRfc2tpcHMuY29uY2F0KGVkZ2Uuc3RlcHMsIGVkZ2UuYmFja3dhcmRfc2tpcHMpKVxuICAgIH0sIFtdKVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3N0ZXBzKGdhcCl7XG4gICAgcmV0dXJuIGdhcC5nZXRfZ2FwcygpW2dhcC5pbmRleF0uc3RlcHNcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihwcmV2X3JhbmssIHJhbmssIHJuLCBzdGVwcywgc2tpcHMpe1xuICAgICAgdmFyIGV4aXRzID0gcHJldl9yYW5rLnJlZHVjZShmdW5jdGlvbihzLCBuKXsgcmV0dXJuIHMuY29uY2F0KG4uZXhpdF9wb2ludHMpIH0sIFtdKVxuICAgICAgdmFyIGVudHJpZXMgPSByYW5rLnJlZHVjZShmdW5jdGlvbihzLCBuKXsgcmV0dXJuIHMuY29uY2F0KG4uZW50cnlfcG9pbnRzKSAgfSwgW10pXG4gICAgICB0aGlzLmV4aXRzID0gZXhpdHNcbiAgICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXNcbiAgICAgIHRoaXMuc3RlcHMgPSBleGl0cy5maWx0ZXIoZnVuY3Rpb24oZXhpdCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByYW5rLmluZGV4T2YoZXhpdC5lbnRyeSkgPiAtMVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoc3RlcHMuYmluZChudWxsLCB0aGlzKSlcblxuICAgICAgdGhpcy5mb3J3YXJkX3NraXBzID0gZXhpdHMuZmlsdGVyKGZ1bmN0aW9uKGV4aXQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByYW5rLmluZGV4T2YoZXhpdC5lbnRyeSkgPT0gLTEgJiYgZXhpdC5lbnRyeS50cnVlX3JhbmsgLSBybiA+IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChza2lwcy5iaW5kKG51bGwsIHRoaXMsICdmb3J3YXJkJykpXG5cbiAgICAgIHRoaXMuYmFja3dhcmRfc2tpcHMgPSBleGl0cy5maWx0ZXIoZnVuY3Rpb24oZXhpdCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJhbmsuaW5kZXhPZihleGl0LmVudHJ5KSA9PSAtMSAmJiBybiAtIGV4aXQuZW50cnkudHJ1ZV9yYW5rID49IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChza2lwcy5iaW5kKG51bGwsIHRoaXMsICdiYWNrd2FyZCcpKVxuXG4gICAgICB0aGlzLnBhdGhzX2NvdW50ID0gKGVudHJpZXMubGVuZ3RoICsgZXhpdHMubGVuZ3RoIC0gdGhpcy5zdGVwcy5sZW5ndGggKyAxKVxuICAgICAgdGhpcy5pbmRleCA9IHJuXG4gICAgfVxuICAsIGVkZ2VzOiBlbnNsYXZlKGdldF9lZGdlcylcbiAgLCBlZGdlc19jb21iaW5lZDogZW5zbGF2ZShnZXRfZWRnZXNfY29tYmluZWQpXG4gICwgZ2V0X3N0ZXBzOiBlbnNsYXZlKGdldF9zdGVwcylcblxuICB9KVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICB2YXIgViA9IHJlcXVpcmUoJy4uL3V0aWwvdmVjdG9ycy5qcycpXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzZWcxLCBzZWcyKXtcbiAgICB2YXIgcCA9IFtzZWcxLngxLCBzZWcxLnkxXVxuICAgIHZhciByID0gVi5zdWJ0cmFjdChbc2VnMS54Miwgc2VnMS55Ml0sIHApXG4gICAgdmFyIHEgPSBbc2VnMi54MSwgc2VnMi55MV1cbiAgICB2YXIgcyA9IFYuc3VidHJhY3QoW3NlZzIueDIsIHNlZzIueTJdLCBxKVxuXG4gICAgLy8gY29sbGluZWFyIG92ZXJsYXBwaW5nICAgICAgICAgICAgMVxuICAgIC8vIGNvbGxpbmVhciBkaXNqb2ludCAgICAgICAgICAgICAgIDJcbiAgICAvLyBwYXJhbGxlbCAgICAgICAgICAgICAgICAgICAgICAgICA0XG4gICAgLy8gaW50ZXJzZWN0aW5nICAgICAgICAgICAgICAgICAgICAgOFxuICAgIC8vIG5vbi1wYXJhbGxlbCBub24taW50ZXJzZWN0aW5nICAgMTZcbiAgICB2YXIgcmVzcG9uc2UgPSAwXG5cblxuICAgIHZhciByeHMgPSBWLmNyb3NzKHIsIHMpXG4gICAgdmFyIHFfcCA9IFYuc3VidHJhY3QocSxwKVxuICAgIHZhciBxX3B4ciA9IFYuY3Jvc3MocV9wLCByKVxuICAgIGlmICggcnhzID09IDAgKSB7XG4gICAgICBpZiAoIHFfcHhyICE9IDAgKSB7XG4gICAgICAgIHJldHVybiBbNF1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByciA9IFYuZG90KHIsIHIpXG4gICAgICAgIHZhciBxX3BkciA9IFYuZG90KHFfcCwgcilcbiAgICAgICAgdmFyIHNzID0gVi5kb3QocywgcylcbiAgICAgICAgdmFyIHFfcGRzID0gVi5kb3QocV9wLCBzKVxuICAgICAgICBpZiAoICggMCA8PSBxX3BkciAmJiAgcV9wZHIgPD0gcnIgKSB8fCAoIDAgPD0gcV9wZHMgJiYgcV9wZHMgPD0gc3MgKSApIHtcbiAgICAgICAgICByZXR1cm4gWzFdXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFsyXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHQgPSBWLmNyb3NzKHFfcCwgcykgLyByeHNcbiAgICBpZiAoIHQgPCAwIHx8IHQgPiAxICkgcmV0dXJuIFsxNl1cbiAgICB2YXIgdSA9IFYuY3Jvc3MocV9wLCByKSAvIHJ4c1xuICAgIGlmICggdSA8IDAgfHwgdSA+IDEgKSByZXR1cm4gWzE2XVxuXG4gICAgLy8gdmFyIHoxID0gVi5hZGQocCwgVi5zY2FsZShyLCB0KSlcbiAgICAvLyB2YXIgejIgPSBWLmFkZChxLCBWLnNjYWxlKHMsIHUpKVxuXG4gICAgcmV0dXJuIFs4LCBWLmFkZChwLCBWLnNjYWxlKHIsIHQpKV1cbiAgfVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuICB2YXIgdHJhbnNsYXRlID0gcmVxdWlyZSgnLi4vdXRpbC90cmFuc2xhdGUuanMnKVxudmFyIGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcblxuICBmdW5jdGlvbiBub2R1cHMociwgaSwgcnMpeyByZXR1cm4gcnMuaW5kZXhPZihyKSA9PT0gaSB9XG5cbiAgZnVuY3Rpb24gb3JpZW50YXRlKHJhbmtEaXIsIGEsIGIpe1xuICAgIHJldHVybiAocmFua0RpciA9PSAnVEInIHx8IHJhbmtEaXIgPT0gJ0JUJykgPyBhIDogYlxuICB9XG5cbiAgZnVuY3Rpb24gY2FsY3VsYXRlKHBvaW50KXtcblxuICAgIHZhciBpZHggPSBpbmRleChwb2ludCkgKyAxXG4gICAgdmFyIHJhbmtEaXIgPSBwb2ludC5yYW5rRGlyXG4gICAgdmFyIHJhbmtTZXAgPSBwb2ludC5yYW5rU2VwXG4gICAgdmFyIHJldmVyc2VkID0gcmFua0RpciA9PSAnQlQnIHx8IHJhbmtEaXIgPT0gJ1JMJ1xuICAgIHZhciB0ciA9IChyZXZlcnNlZCA/IC0xIDogMSkgKiBwc2VwKHBvaW50KSAqIGlkeFxuICAgIHZhciB0cl9zZXAgPSB0ciAtIChyZXZlcnNlZCA/IC0xICogcmFua1NlcCA6IHJhbmtTZXApXG5cbiAgICB2YXIgdmVjdG9yID0gIHBvaW50Lm5vZGVfcG9pbnQudHlwZSA9PSAnZXhpdCcgPyBvcmllbnRhdGUocmFua0RpciwgWzAsIHRyXSwgW3RyLCAwXSlcbiAgICAgICAgICAgICAgIDogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRlKHJhbmtEaXIsIFswLCB0cl9zZXAgXSwgW3RyX3NlcCwgMF0pXG5cbiAgICByZXR1cm4gdHJhbnNsYXRlKHZlY3RvciwgcG9pbnQubm9kZV9wb2ludC5zdGF0aWMoKSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF94KHBvaW50KXsgcmV0dXJuIGNhbGN1bGF0ZShwb2ludCkueCB9XG5cbiAgZnVuY3Rpb24gZ2V0X3kocG9pbnQpeyByZXR1cm4gY2FsY3VsYXRlKHBvaW50KS55IH1cblxuICBmdW5jdGlvbiBpbmRleChwb2ludCl7XG4gICAgdmFyIGwgPSBsaXN0KHBvaW50KVxuICAgIHZhciBxID0gcG9pbnQudHlwZSA9PSAnc3RlcCcgJiYgcG9pbnQubm9kZV9wb2ludC50eXBlID09ICdlbnRyeScgPyBwb2ludC5leGl0X2p1bmN0aW9uXG4gICAgICAgICAgOiBwb2ludC50eXBlID09ICdlbnRyeScgJiYgcG9pbnQubm9kZV9wb2ludC50eXBlID09ICdlbnRyeScgPyBwb2ludC5yZWxhdGl2ZVxuICAgICAgICAgIDogcG9pbnRcbiAgICB2YXIgciA9IGwuaW5kZXhPZihxKVxuLy8gaWYgKHIgPT0gLTEgICApIGxvZyhsLCBwb2ludCwgcG9pbnQucmVsYXRpdmUpXG4gICAgcmV0dXJuIHJcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYXAocG9pbnQpe1xuICAgIHJldHVybiBwb2ludC50eXBlID09ICdlbnRyeScgJiYgcG9pbnQuc2tpcERpciA9PSAnZm9yd2FyZCcgID8gcG9pbnQuZ2FwLmdldF9nYXBzKClbcG9pbnQubm9kZV9wb2ludC5ub2RlLnRydWVfcmFua11cbiAgICAgICAgIDogcG9pbnQudHlwZSA9PSAnZW50cnknICYmIHBvaW50LnNraXBEaXIgPT0gJ2JhY2t3YXJkJyA/IHBvaW50LmdhcC5nZXRfZ2FwcygpW3BvaW50Lm5vZGVfcG9pbnQubm9kZS50cnVlX3JhbmtdXG4gICAgICAgICA6IHBvaW50LmdhcFxuICB9XG5cbiAgZnVuY3Rpb24gZ2l2ZV92YWx1ZShub2RlKXtcbiAgICByZXR1cm4gKG5vZGUudHJ1ZV9yYW5rICsgMSkgKiAobm9kZS54ICsgbm9kZS55KVxuICB9XG5cbiAgZnVuY3Rpb24gbGlzdChwb2ludCl7XG4gICAgdmFyIGduID0gcG9pbnQuZ2FwX251bWJlcigpXG4gICAgdmFyIGwgPSBwb2ludC5nYXAuZWRnZXMoKVxuICAgICAgICAgICAgICAgICAucmVkdWNlKGZ1bmN0aW9uIGp1bmNzKGpzLCBzKXtcbiAgICAgICAgICAgICAgICAgICAganMgPSBqcy5jb25jYXQocy5maWx0ZXIoZnVuY3Rpb24gaXNfanVuYyhwKXtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5pbml0ID09IEp1bmN0aW9uLmluaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgcC5nYXBfbnVtYmVyKCkgPT0gZ25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gJiYgcC50eXBlICE9ICdlbnRyeSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgISAocC50eXBlID09ICdlbnRyeScgJiYgcC5ub2RlX3BvaW50LnR5cGUgPT0gJ2VudHJ5JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgISAocC50eXBlID09ICdzdGVwJyAmJiBwLm5vZGVfcG9pbnQudHlwZSA9PSAnZW50cnknKVxuXG4gICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ganNcbiAgICAgICAgICAgICAgICAgIH0sIFtdKVxuICAgICAgICAgICAgICAgICAuZmlsdGVyKG5vZHVwcylcbiAgICAgICAgICAgICAgICAgLnNvcnQoZnVuY3Rpb24oYSwgYil7IHJldHVybiBhLm9yZGVyIDwgYi5vcmRlciB9KVxuICAgIHJldHVybiBsXG4gIH1cblxuICBmdW5jdGlvbiBwc2VwKHBvaW50KXtcbiAgICB2YXIgbCA9IGxpc3QocG9pbnQpXG4gICAgcmV0dXJuIHBvaW50LnJhbmtTZXAgLyAobC5sZW5ndGggKyAxKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlKHBvaW50KXtcbiAgICB2YXIgZ2FwID0gZ2V0X2dhcChwb2ludClcbiAgICByZXR1cm4gZ2FwLnN0ZXBzLnNwbGljZShpbmRleChwb2ludCksIDEpXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ2FwX251bWJlcihwb2ludCl7XG4gICAgcmV0dXJuIGdldF9nYXAocG9pbnQpLmluZGV4XG4gIH1cblxuICB2YXIgSnVuY3Rpb24gPSAgdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbih0eXBlLCBub2RlX3BvaW50LCBzaSwgZ2FwLCByYW5rRGlyLCByYW5rU2VwLCBza2lwRGlyLCBleGl0X2p1bmN0aW9uKXtcbiAgICAgIHRoaXMudHlwZSA9IHR5cGVcbiAgICAgIHRoaXMubm9kZV9wb2ludCA9IG5vZGVfcG9pbnRcbiAgICAgIHRoaXMuZXhpdF9wb2ludCA9IG5vZGVfcG9pbnQudHlwZSA9PSAnZXhpdCcgPyBub2RlX3BvaW50IDogbm9kZV9wb2ludC5vdGhlcl9lbmRwb2ludCgpXG4gICAgICB0aGlzLmVudHJ5X3BvaW50ID0gbm9kZV9wb2ludC50eXBlID09ICdlbnRyeScgPyBub2RlX3BvaW50IDogbm9kZV9wb2ludC5vdGhlcl9lbmRwb2ludCgpXG4gICAgICB0aGlzLnNpID0gc2lcbiAgICAgIHRoaXMuZ2FwID0gZ2FwXG4gICAgICB0aGlzLnJhbmtEaXIgPSByYW5rRGlyXG4gICAgICB0aGlzLnJhbmtTZXAgPSByYW5rU2VwXG4gICAgICB0aGlzLnNraXBEaXIgPSBza2lwRGlyXG4gICAgICB0aGlzLmlkID0gdWlkKClcbiAgICAgIHRoaXMuZ3JhcGggPSBub2RlX3BvaW50Lm5vZGUuZ3JhcGhcbiAgICAgIHRoaXMuZWRnZV9pZCA9IHRoaXMuZ3JhcGguaW5jaWRlbnRFZGdlcyh0aGlzLmV4aXRfcG9pbnQubm9kZS5pZCwgdGhpcy5lbnRyeV9wb2ludC5ub2RlLmlkKVswXVxuICAgICAgdGhpcy5vcmRlciA9IHRoaXMuZ3JhcGguZWRnZXMoKS5pbmRleE9mKHRoaXMuZWRnZV9pZClcbiAgICAgIHRoaXMuZXhpdF9qdW5jdGlvbiA9IGV4aXRfanVuY3Rpb25cbiAgICB9XG4gICwgeDogZW5zbGF2ZShnZXRfeClcbiAgLCB5OiBlbnNsYXZlKGdldF95KVxuICAsIHN0YXRpYzogZW5zbGF2ZShjYWxjdWxhdGUpXG4gICwgcmVtb3ZlOiBlbnNsYXZlKHJlbW92ZSlcbiAgLCBnYXBfbnVtYmVyOiBlbnNsYXZlKGdldF9nYXBfbnVtYmVyKVxuICAsIGluZGV4OiBlbnNsYXZlKGluZGV4KVxuICB9KVxuXG4gIG1vZHVsZS5leHBvcnRzID0gSnVuY3Rpb25cblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciB2aXJhbCA9IHJlcXVpcmUoJ3ZpcmFsJylcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIHRyYW5zbGF0ZSA9IHJlcXVpcmUoJy4uL3V0aWwvdHJhbnNsYXRlLmpzJylcbiAgdmFyIGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcblxuICBmdW5jdGlvbiBzaWRlX2Zyb21fZGlyZWN0aW9uKG5vZGUsIGQpe1xuICAgIHZhciB3ICA9IG5vZGUud2lkdGggLyAyXG4gICAgdmFyIGggID0gbm9kZS5oZWlnaHQgLyAyXG4gICAgdmFyIHRsID0gdHJhbnNsYXRlKFstdywgLWhdLCBub2RlKVxuICAgIHZhciB0ciA9IHRyYW5zbGF0ZShbIHcsIC1oXSwgbm9kZSlcbiAgICB2YXIgYmwgPSB0cmFuc2xhdGUoWy13LCAgaF0sIG5vZGUpXG4gICAgdmFyIGJyID0gdHJhbnNsYXRlKFsgdywgIGhdLCBub2RlKVxuICAgIHN3aXRjaCAoIGQgKSB7XG4gICAgICBjYXNlICdMJyA6XG4gICAgICAgIHJldHVybiBbdGwsIGJsXVxuICAgICAgY2FzZSAnUicgOlxuICAgICAgICByZXR1cm4gW3RyLCBicl1cbiAgICAgIGNhc2UgJ0InIDpcbiAgICAgICAgcmV0dXJuIFtibCwgYnJdXG4gICAgICBjYXNlICdUJyA6XG4gICAgICAgIHJldHVybiBbdGwsIHRyXVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRpdmlkZV9zaWRlKHNpZGUsIHBhcnRzLCBuKXtcbiAgICBuID0gbiArIDFcbiAgICB2YXIgWDEgPSBzaWRlWzBdLnhcbiAgICB2YXIgWTEgPSBzaWRlWzBdLnlcbiAgICB2YXIgWDIgPSBzaWRlWzFdLnhcbiAgICB2YXIgWTIgPSBzaWRlWzFdLnlcblxuICAgIHZhciBXID0gWDIgLSBYMVxuICAgIHZhciBIID0gWTIgLSBZMVxuICAgIHZhciBydyA9IFcgLyAocGFydHMgKyAxKVxuICAgIHZhciByaCA9IEggLyAocGFydHMgKyAxKVxuICAgIHJldHVybiB0cmFuc2xhdGUoWyBuICogcncsIG4gKiByaCBdLCBzaWRlWzBdKVxuICB9XG5cbiAgZnVuY3Rpb24gY2FsY3VsYXRlKHBvaW50KXtcbiAgICByZXR1cm4gZGl2aWRlX3NpZGUoXG4gICAgICAgICAgICBzaWRlX2Zyb21fZGlyZWN0aW9uKHBvaW50Lm5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgcG9pbnQucmFua0Rpcltwb2ludC50eXBlID09ICdleGl0JyA/IDEgOiAwXSlcbiAgICAgICAgICAsIGxpc3QocG9pbnQpLmxlbmd0aFxuICAgICAgICAgICwgaW5kZXgocG9pbnQpKVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3gocG9pbnQpeyByZXR1cm4gY2FsY3VsYXRlKHBvaW50KS54IH1cblxuICBmdW5jdGlvbiBnZXRfeShwb2ludCl7IHJldHVybiBjYWxjdWxhdGUocG9pbnQpLnkgfVxuXG4gIGZ1bmN0aW9uIGluZGV4KHBvaW50KXtcbiAgICB2YXIgciA9IGxpc3QocG9pbnQpLmluZGV4T2YocG9pbnQpXG4gICAgcmV0dXJuIHJcbiAgfVxuXG4gIGZ1bmN0aW9uIGxpc3QocG9pbnQpe1xuICAgIHJldHVybiBwb2ludC50eXBlID09ICdleGl0JyA/IHBvaW50Lm5vZGUuZXhpdF9wb2ludHMgOiBwb2ludC5ub2RlLmVudHJ5X3BvaW50c1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlKHBvaW50KXtcbiAgICB2YXIgaWR4ID0gaW5kZXgocG9pbnQpXG4gICAgcmV0dXJuIGlkeCA+IC0xID8gbGlzdChwb2ludCkuc3BsaWNlKGlkeCwgMSkgOiBmYWxzZVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2dhcF9udW1iZXIocG9pbnQpe1xuICAgIHJldHVybiBwb2ludC5ub2RlLnRydWVfcmFuayArIChwb2ludC50eXBlID09ICdlbnRyeScgPyAwIDogMSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9vdGhlcl9lbmQocG9pbnQpe1xuICAgIHZhciBwYWlyX25vZGUgPSBwb2ludC5wYWlyX25vZGVcbiAgICB2YXIgcHB0ID0gcG9pbnQudHlwZSA9PSAnZW50cnknID8gJ2V4aXRfcG9pbnRzJyA6ICdlbnRyeV9wb2ludHMnXG4gICAgdmFyIHBudCA9IHBvaW50LnR5cGUgPT0gJ2VudHJ5JyA/ICdleGl0cycgOiAnZW50cmllcydcbiAgICB2YXIgcGFpcl9wb2ludCA9IHBhaXJfbm9kZVtwcHRdW3BhaXJfbm9kZVtwbnRdW3BvaW50Lm5vZGUuaWRdXVxuICAgIHJldHVybiBwYWlyX3BvaW50XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHZpcmFsLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24odHlwZSwgbm9kZSwgcmFua0RpciwgcGFpcl9ub2RlKXtcbiAgICAgIHRoaXMudHlwZSA9IHR5cGVcbiAgICAgIHRoaXMubm9kZSA9IG5vZGVcbiAgICAgIHRoaXMucGFpcl9ub2RlID0gcGFpcl9ub2RlXG4gICAgICB0aGlzLmV4aXQgPSB0eXBlID09ICdleGl0JyA/IG5vZGUgOiBwYWlyX25vZGVcbiAgICAgIHRoaXMucmFua0RpciA9IHJhbmtEaXJcbiAgICAgIHRoaXMuZW50cnkgPSB0eXBlID09ICdlbnRyeScgPyBub2RlIDogcGFpcl9ub2RlXG4gICAgICB0aGlzLmVkZ2VfaWQgPSBub2RlLmdyYXBoLmluY2lkZW50RWRnZXMobm9kZS5pZCwgcGFpcl9ub2RlLmlkKVxuICAgIH1cbiAgLCB4OiBlbnNsYXZlKGdldF94KVxuICAsIHk6IGVuc2xhdmUoZ2V0X3kpXG4gICwgc3RhdGljOiBlbnNsYXZlKGNhbGN1bGF0ZSlcbiAgLCByZW1vdmU6IGVuc2xhdmUocmVtb3ZlKVxuICAsIGdhcF9udW1iZXI6IGVuc2xhdmUoZ2V0X2dhcF9udW1iZXIpXG4gICwgb3RoZXJfZW5kcG9pbnQ6IGVuc2xhdmUoZ2V0X290aGVyX2VuZClcbiAgLCBpbmRleDogZW5zbGF2ZShpbmRleClcbiAgLCBsaXN0OiBlbnNsYXZlKGxpc3QpXG4gIH0pXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciB0cmFuc2xhdGUgPSByZXF1aXJlKCcuLi91dGlsL3RyYW5zbGF0ZS5qcycpXG5cbiAgdmFyIGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcblxuICBmdW5jdGlvbiBvcmllbnRhdGUocmFua0RpciwgYSwgYil7XG4gICAgcmV0dXJuIChyYW5rRGlyID09ICdUQicgfHwgcmFua0RpciA9PSAnQlQnKSA/IGEgOiBiXG4gIH1cblxuICBmdW5jdGlvbiBjYWxjdWxhdGUocG9pbnQpe1xuICAgIHZhciBzX2xlbmd0aCA9IHBvaW50LmdhcC5nZXRfZ2FwcygpLnNsaWNlKDAsIGluZGV4KHBvaW50KSkucmVkdWNlKGZ1bmN0aW9uKHRzYywgcil7XG4gICAgICByZXR1cm4gdHNjICsgKHBvaW50LnR5cGUgPT0gJ2ZvcndhcmQnID8gci5mb3J3YXJkX3NraXBzIDogci5iYWNrd2FyZF9za2lwcykubGVuZ3RoXG4gICAgfSwgMSlcblxuICAgIHZhciBsZXZlbF9hbW91bnQgPSAoc19sZW5ndGggKyBwb2ludC5zaWR4KSAqIHBvaW50LnNraXBzZXBcbiAgICB2YXIgbGV2ZWwgPSBwb2ludC5yZXYgPyAwIC0gbGV2ZWxfYW1vdW50IDogcG9pbnQuZ1twb2ludC5sZXZlbF9kaXJdICsgbGV2ZWxfYW1vdW50XG5cbiAgICB2YXIgcmVsID0gcG9pbnQucmVsYXRpdmUuc3RhdGljKClcbmxvZyhwb2ludC5kZWxldGVkKVxuICAgIHJldHVybiBwb2ludC5kZWxldGVkID8gcG9pbnQucmVsYXRpdmUuc3RhdGljKCkgOiB7XG4gICAgICB4OiBvcmllbnRhdGUocG9pbnQucmFua0RpciwgbGV2ZWwsIHJlbFtwb2ludC5yYW5rX2F0dHJdKVxuICAgICwgeTogb3JpZW50YXRlKHBvaW50LnJhbmtEaXIsIHJlbFtwb2ludC5yYW5rX2F0dHJdLCBsZXZlbClcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRfeChwb2ludCl7IHJldHVybiBjYWxjdWxhdGUocG9pbnQpLnggfVxuXG4gIGZ1bmN0aW9uIGdldF95KHBvaW50KXsgcmV0dXJuIGNhbGN1bGF0ZShwb2ludCkueSB9XG5cbiAgZnVuY3Rpb24gaW5kZXgocG9pbnQpe1xuXG4gICAgcmV0dXJuIHBvaW50LmdhcC5nZXRfZ2FwcygpLmluZGV4T2YocG9pbnQuZ2FwKVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2dhcF9udW1iZXIocG9pbnQpe1xuICAgIHJldHVybiBwb2ludC5yZWxhdGl2ZS5nYXBfbnVtYmVyKClcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZShwb2ludCl7XG4gICAgcG9pbnQuZGVsZXRlZCA9IHRydWVcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbih0eXBlLCByZWxhdGl2ZSwgZ2FwLCBzaWR4LCByYW5rRGlyLCBza2lwc2VwLCByZXYsIGcsIHJhbmtfYXR0ciwgbGV2ZWxfZGlyKXtcbiAgICAgIHRoaXMudHlwZSA9IHR5cGVcbiAgICAgIHRoaXMucmVsYXRpdmUgPSByZWxhdGl2ZVxuICAgICAgdGhpcy5nYXAgPSBnYXBcbiAgICAgIHRoaXMuc2lkeCA9IHNpZHhcbiAgICAgIHRoaXMucmFua0RpciA9IHJhbmtEaXJcbiAgICAgIHRoaXMuc2tpcHNlcCA9IHNraXBzZXBcbiAgICAgIHRoaXMucmV2ID0gcmV2XG4gICAgICB0aGlzLmcgPSBnXG4gICAgICB0aGlzLnJhbmtfYXR0ciA9IHJhbmtfYXR0clxuICAgICAgdGhpcy5sZXZlbF9kaXIgPSBsZXZlbF9kaXJcbiAgICAgIHRoaXMuZGVsZXRlZCA9IGZhbHNlXG4gICAgfVxuICAsIHg6IGVuc2xhdmUoZ2V0X3gpXG4gICwgeTogZW5zbGF2ZShnZXRfeSlcbiAgLCBzdGF0aWM6IGVuc2xhdmUoY2FsY3VsYXRlKVxuICAsIGdhcF9udW1iZXI6IGVuc2xhdmUoZ2V0X2dhcF9udW1iZXIpXG4gICwgcmVtb3ZlOiBlbnNsYXZlKHJlbW92ZSlcbiAgfSlcblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciBOb2RlID0gcmVxdWlyZSgnLi9ub2RlLmpzJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcblxuICAvLyBUT0RPOiBtYWtlIHRoaXMgMSB0byAxIGZvciBhIGRpc3BsYXllZCBwYXJ0IG9mIHRoZSBwYXRoIHNpbWlsYXJseSBob3cgbm9kZXMgYXJlXG4gIHZhciBFZGdlID0gTm9kZS5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGdyYXBoLCBzb3VyY2UsIHRhcmdldCwgdHJhbnNmb3JtLCBhdHRycyl7XG4gICAgICB0aGlzLmlkID0gdWlkKClcbiAgICAgIHRoaXMudHlwZSA9ICdlZGdlJ1xuICAgICAgdGhpcy5ncmFwaCA9IGdyYXBoXG4gICAgICB0aGlzLnNvdXJjZSA9IHNvdXJjZVxuICAgICAgdGhpcy50YXJnZXQgPSB0YXJnZXRcbiAgICB9XG4gIH0pXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBFZGdlXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuICB2YXIgZGFncmUgPSByZXF1aXJlKCdkYWdyZScpXG4gIHZhciB1aWQgPSByZXF1aXJlKCcuLi91dGlsL3VuaXF1ZV9pZC5qcycpXG4gIHZhciBOb2RlID0gcmVxdWlyZSgnLi9ub2RlLmpzJylcbiAgdmFyIEVkZ2UgPSByZXF1aXJlKCcuL2VkZ2UuanMnKVxuXG4gIGZ1bmN0aW9uIGFkZF9ub2RlKGdyYXBoLCBjbGFzc25hbWUsIHRyYW5zZm9ybSwgY29udGVudCwgcHJlZlJhbmspe1xuICAgIHZhciBub2RlID0gTm9kZS5tYWtlKGdyYXBoLCB0cmFuc2Zvcm0sIHtcbiAgICAgICAgY2xhc3NuYW1lOiBjbGFzc25hbWVcbiAgICAgICwgY29udGVudDogY29udGVudFxuICAgICAgLCByYW5rOiBwcmVmUmFua1xuICAgIH0pXG4gICAgZ3JhcGguYWRkTm9kZShub2RlLmlkLCBub2RlKVxuICAgIHJldHVybiBub2RlXG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVfbm9kZShncmFwaCwgbm9kZV9pZCl7XG4gICAgaWYgKCBncmFwaC5oYXNOb2RlKG5vZGVfaWQpICkge1xuICAgICAgZ3JhcGguZGVsTm9kZShub2RlX2lkKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBmdW5jdGlvbiBjb25uZWN0KGdyYXBoLCBjbGFzc25hbWUsIHNvdXJjZSwgdGFyZ2V0LCB0cmFuc2Zvcm0sIGNvbnRlbnQpe1xuICAgIHZhciBlZGdlID0gRWRnZS5tYWtlKGdyYXBoLCBzb3VyY2UsIHRhcmdldClcbiAgICBncmFwaC5hZGRFZGdlKGVkZ2UuaWQsIHNvdXJjZS5pZCwgdGFyZ2V0LmlkLCBlZGdlKVxuICAgIHJldHVybiBlZGdlXG4gIH1cblxuICBmdW5jdGlvbiBkaXNjb25uZWN0KGdyYXBoLCBzb3VyY2UsIHRhcmdldCl7XG4gICAgdmFyIGVkZ2VfaWQgPSBncmFwaC5vdXRFZGdlcyhzb3VyY2UuaWQsIHRhcmdldC5pZClcbiAgICBpZiAoIGdyYXBoLmhhc0VkZ2UoZWRnZV9pZCkgKSB7XG4gICAgICBncmFwaC5kZWxFZGdlKGVkZ2VfaWQpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cblxuICB2YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvZW1pdHRlci5qcycpXG4gIHZhciBncmFwaCA9IGVtaXR0ZXIuZXh0ZW5kKGRhZ3JlLkRpZ3JhcGgucHJvdG90eXBlKVxuICAgICAgICAgICAgICAgICAgICAgLmV4dGVuZCh7IGluaXQ6IGZ1bmN0aW9uKCl7IGRhZ3JlLkRpZ3JhcGguY2FsbCh0aGlzKSB9IH0pXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBncmFwaC5leHRlbmQoe1xuICAgIGFkZF9ub2RlOiBlbnNsYXZlKGFkZF9ub2RlKVxuICAsIGRlbF9ub2RlOiBlbnNsYXZlKHJlbW92ZV9ub2RlKVxuICAsIGNvbm5lY3Q6IGVuc2xhdmUoY29ubmVjdClcbiAgLCBkaXNjb25uZWN0OiBlbnNsYXZlKGRpc2Nvbm5lY3QpXG4gIH0pXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciB1aWQgPSByZXF1aXJlKCcuLi91dGlsL3VuaXF1ZV9pZC5qcycpXG5cbiAgZnVuY3Rpb24gc2V0X2F0dHJzKG5vZGUsIGF0dHJzKXtcbiAgICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaChmdW5jdGlvbihrZXkpe1xuICAgICAgbm9kZVtrZXldID0gYXR0cnNba2V5XVxuICAgIH0pXG4gICAgbm9kZS5ncmFwaC5lbWl0KG5vZGUudHlwZSArICdfYXR0cnMnLCBhdHRycylcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9hdHRyKG5vZGUsIGF0dHIsIHZhbHVlKXtcbiAgICBub2RlW2F0dHJdID0gdmFsdWVcbiAgICBub2RlLmdyYXBoLmVtaXQobm9kZS50eXBlICsgJ19hdHRyJywgYXR0ciwgdmFsdWUpXG4gIH1cblxuICBmdW5jdGlvbiBhZGRfYXR0cihub2RlLCBzZWxlY3RvciwgbmFtZSwgdmFsdWUpe1xuICAgIG5vZGUuY29udGVudFtzZWxlY3Rvcl0gPSBub2RlLmNvbnRlbnRbc2VsZWN0b3JdIHx8IHt9XG4gICAgbm9kZS5jb250ZW50W3NlbGVjdG9yXVtuYW1lXSA9IHZhbHVlXG4gIH1cblxuICBmdW5jdGlvbiBhZGRfYXR0cnMobm9kZSwgc2VsZWN0b3IsIGF0dHJzKXtcbiAgICBub2RlLmNvbnRlbnRbc2VsZWN0b3JdID0gdmFsdWVcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihncmFwaCwgdHJhbnNmb3JtLCBhdHRycyl7XG4gICAgICB0aGlzLmlkID0gdWlkKClcbiAgICAgIHRoaXMudHlwZSA9ICd2ZXJ0ZXgnXG4gICAgICB0aGlzLmdyYXBoID0gZ3JhcGhcbiAgICAgIHRoaXMudHJhbnNmb3JtID0gdHJhbnNmb3JtLmJpbmQobnVsbCwgdGhpcylcbiAgICAgIHNldF9hdHRycyh0aGlzLCBhdHRycylcbiAgICB9XG4gICwgYXR0cnM6IGVuc2xhdmUoc2V0X2F0dHJzKVxuICAsIGF0dHI6IGVuc2xhdmUoc2V0X2F0dHIpXG4gICwgYWRkX2F0dHI6IGVuc2xhdmUoYWRkX2F0dHIpXG4gICwgYWRkX2F0dHJzOiBlbnNsYXZlKGFkZF9hdHRycylcbiAgfSlcblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgaWYgKCFTdHJpbmcucHJvdG90eXBlLnRyaW0pIHtcbiAgICBTdHJpbmcucHJvdG90eXBlLnRyaW0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbiAgICB9XG4gIH1cblxuICB2YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuL3V0aWwvZGVmYXVsdHMuanMnKVxuICB2YXIgR3JhcGggPSByZXF1aXJlKCcuL2dyYXBoL2dyYXBoLmpzJylcbiAgdmFyIERpYWdyYW0gPSByZXF1aXJlKCcuL2RpYWdyYW0vZGlhZ3JhbS5qcycpXG5cblxuICAvKipcbiAgKiBTZXQgZGVmYXVsdCBjb25maWd1cmF0aW9uXG4gICogQHBhcmFtICAgICAge09iamVjdH0gb3B0aW9uc1xuICAqIEByZXR1cm4gICAgIHtPYmplY3R9IG9wdGlvbnMgZmlsbGVkIHdpdGggZGVmYXVsdHNcbiAgKi9cbiAgZnVuY3Rpb24gY29uZmlnKGNmZ29iail7XG4gICAgdmFyIGRlZmF1bHRfY2ZnID0ge1xuICAgICAgd2lkdGg6IHdpbmRvdy5pbm5lcldpZHRoXG4gICAgLCBoZWlnaHQ6IHdpbmRvdy5pbm5lckhlaWdodFxuICAgICwgZm9udF9zaXplOiAyMVxuICAgICwgbGluZV9oZWlnaHQ6IDI2IC8vIGZvciBmb250LXNpemUgMjFcbiAgICB9XG4gICAgcmV0dXJuIGNmZ29iaiA9PSBudWxsID8gZGVmYXVsdF9jZmdcbiAgICAgICAgIDogICAgICAgICAgICAgICAgICBkZWZhdWx0cyhjZmdvYmosIGRlZmF1bHRfY2ZnKVxuICB9XG5cbiAgLyoqXG4gICogQ3JlYXRlIGEgbmV3IGdyYXBoIG9iamVjdCB0byBzdG9yZSBkaWFncmFtIGRhdGEgaW4gaXRcbiAgKiBAcmV0dXJuICAgICB7T2JqZWN0fSAgIGdyYXBoIG9iamVjdFxuICAqL1xuICBmdW5jdGlvbiBncmFwaChjZmdvYmope1xuICAgIHJldHVybiBHcmFwaC5tYWtlKGNmZ29iailcbiAgfVxuXG4gIC8qKlxuICAqIEluaXRpYWxpemUgZGlhZ3JhbSB3aXRoIG9wdGlvbnMgYW5kIGdyYXBoIG9iamVjdFxuICAqIGFuZCByZWdpc3RlciBldmVudCBoYW5kbGVyc1xuICAqIEBwYXJhbSAgICAgIHtPYmplY3R9ICAgb3B0aW9uc1xuICAqIEBwYXJhbSAgICAgIHtPYmplY3R9ICAgZ3JhcGggb2JqZWN0XG4gICogQHJldHVybiAgICAge09iamVjdH0gICBkaWFncmFtXG4gICovXG4gIGZ1bmN0aW9uIGRpYWdyYW0oY2Znb2JqLCBncmFwaCl7XG4gICAgcmV0dXJuIERpYWdyYW0ubWFrZShjZmdvYmosIGdyYXBoKVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgY29uZmlnOiBjb25maWdcbiAgLCBncmFwaDogZ3JhcGhcbiAgLCBkaWFncmFtOiBkaWFncmFtXG4gIH1cbiAgaWYgKCB3aW5kb3cgKSB3aW5kb3cuRGlhZ3JhbSA9IG1vZHVsZS5leHBvcnRzXG5cbn0oKVxuIiwiLypcbkNvcHlyaWdodCAoYykgMjAxMi0yMDEzIENocmlzIFBldHRpdHRcblxuUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxub2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xudG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG5mdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxuXG5UaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG5cblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbklNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG5BVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG5MSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuVEhFIFNPRlRXQVJFLlxuKi9cbmV4cG9ydHMuRGlncmFwaCA9IHJlcXVpcmUoXCJncmFwaGxpYlwiKS5EaWdyYXBoO1xuZXhwb3J0cy5HcmFwaCA9IHJlcXVpcmUoXCJncmFwaGxpYlwiKS5HcmFwaDtcbmV4cG9ydHMubGF5b3V0ID0gcmVxdWlyZShcIi4vbGliL2xheW91dFwiKTtcbmV4cG9ydHMudmVyc2lvbiA9IHJlcXVpcmUoXCIuL2xpYi92ZXJzaW9uXCIpO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICByYW5rID0gcmVxdWlyZSgnLi9yYW5rJyksXG4gICAgb3JkZXIgPSByZXF1aXJlKCcuL29yZGVyJyksXG4gICAgQ0dyYXBoID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5DR3JhcGgsXG4gICAgQ0RpZ3JhcGggPSByZXF1aXJlKCdncmFwaGxpYicpLkNEaWdyYXBoO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAvLyBFeHRlcm5hbCBjb25maWd1cmF0aW9uXG4gIHZhciBjb25maWcgPSB7XG4gICAgLy8gSG93IG11Y2ggZGVidWcgaW5mb3JtYXRpb24gdG8gaW5jbHVkZT9cbiAgICBkZWJ1Z0xldmVsOiAwLFxuICAgIC8vIE1heCBudW1iZXIgb2Ygc3dlZXBzIHRvIHBlcmZvcm0gaW4gb3JkZXIgcGhhc2VcbiAgICBvcmRlck1heFN3ZWVwczogb3JkZXIuREVGQVVMVF9NQVhfU1dFRVBTLFxuICAgIC8vIFVzZSBuZXR3b3JrIHNpbXBsZXggYWxnb3JpdGhtIGluIHJhbmtpbmdcbiAgICByYW5rU2ltcGxleDogZmFsc2UsXG4gICAgLy8gUmFuayBkaXJlY3Rpb24uIFZhbGlkIHZhbHVlcyBhcmUgKFRCLCBMUilcbiAgICByYW5rRGlyOiAnVEInXG4gIH07XG5cbiAgLy8gUGhhc2UgZnVuY3Rpb25zXG4gIHZhciBwb3NpdGlvbiA9IHJlcXVpcmUoJy4vcG9zaXRpb24nKSgpO1xuXG4gIC8vIFRoaXMgbGF5b3V0IG9iamVjdFxuICB2YXIgc2VsZiA9IHt9O1xuXG4gIHNlbGYub3JkZXJJdGVycyA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdvcmRlck1heFN3ZWVwcycpO1xuXG4gIHNlbGYucmFua1NpbXBsZXggPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAncmFua1NpbXBsZXgnKTtcblxuICBzZWxmLm5vZGVTZXAgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLm5vZGVTZXApO1xuICBzZWxmLmVkZ2VTZXAgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLmVkZ2VTZXApO1xuICBzZWxmLnVuaXZlcnNhbFNlcCA9IGRlbGVnYXRlUHJvcGVydHkocG9zaXRpb24udW5pdmVyc2FsU2VwKTtcbiAgc2VsZi5yYW5rU2VwID0gZGVsZWdhdGVQcm9wZXJ0eShwb3NpdGlvbi5yYW5rU2VwKTtcbiAgc2VsZi5yYW5rRGlyID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ3JhbmtEaXInKTtcbiAgc2VsZi5kZWJ1Z0FsaWdubWVudCA9IGRlbGVnYXRlUHJvcGVydHkocG9zaXRpb24uZGVidWdBbGlnbm1lbnQpO1xuXG4gIHNlbGYuZGVidWdMZXZlbCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdkZWJ1Z0xldmVsJywgZnVuY3Rpb24oeCkge1xuICAgIHV0aWwubG9nLmxldmVsID0geDtcbiAgICBwb3NpdGlvbi5kZWJ1Z0xldmVsKHgpO1xuICB9KTtcblxuICBzZWxmLnJ1biA9IHV0aWwudGltZSgnVG90YWwgbGF5b3V0JywgcnVuKTtcblxuICBzZWxmLl9ub3JtYWxpemUgPSBub3JtYWxpemU7XG5cbiAgcmV0dXJuIHNlbGY7XG5cbiAgLypcbiAgICogQ29uc3RydWN0cyBhbiBhZGphY2VuY3kgZ3JhcGggdXNpbmcgdGhlIG5vZGVzIGFuZCBlZGdlcyBzcGVjaWZpZWQgdGhyb3VnaFxuICAgKiBjb25maWcuIEZvciBlYWNoIG5vZGUgYW5kIGVkZ2Ugd2UgYWRkIGEgcHJvcGVydHkgYGRhZ3JlYCB0aGF0IGNvbnRhaW5zIGFuXG4gICAqIG9iamVjdCB0aGF0IHdpbGwgaG9sZCBpbnRlcm1lZGlhdGUgYW5kIGZpbmFsIGxheW91dCBpbmZvcm1hdGlvbi4gU29tZSBvZlxuICAgKiB0aGUgY29udGVudHMgaW5jbHVkZTpcbiAgICpcbiAgICogIDEpIEEgZ2VuZXJhdGVkIElEIHRoYXQgdW5pcXVlbHkgaWRlbnRpZmllcyB0aGUgb2JqZWN0LlxuICAgKiAgMikgRGltZW5zaW9uIGluZm9ybWF0aW9uIGZvciBub2RlcyAoY29waWVkIGZyb20gdGhlIHNvdXJjZSBub2RlKS5cbiAgICogIDMpIE9wdGlvbmFsIGRpbWVuc2lvbiBpbmZvcm1hdGlvbiBmb3IgZWRnZXMuXG4gICAqXG4gICAqIEFmdGVyIHRoZSBhZGphY2VuY3kgZ3JhcGggaXMgY29uc3RydWN0ZWQgdGhlIGNvZGUgbm8gbG9uZ2VyIG5lZWRzIHRvIHVzZVxuICAgKiB0aGUgb3JpZ2luYWwgbm9kZXMgYW5kIGVkZ2VzIHBhc3NlZCBpbiB2aWEgY29uZmlnLlxuICAgKi9cbiAgZnVuY3Rpb24gaW5pdExheW91dEdyYXBoKGlucHV0R3JhcGgpIHtcbiAgICB2YXIgZyA9IG5ldyBDRGlncmFwaCgpO1xuXG4gICAgaW5wdXRHcmFwaC5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHZhbHVlID0ge307XG4gICAgICBnLmFkZE5vZGUodSwge1xuICAgICAgICB3aWR0aDogdmFsdWUud2lkdGgsXG4gICAgICAgIGhlaWdodDogdmFsdWUuaGVpZ2h0XG4gICAgICB9KTtcbiAgICAgIGlmICh2YWx1ZS5oYXNPd25Qcm9wZXJ0eSgncmFuaycpKSB7XG4gICAgICAgIGcubm9kZSh1KS5wcmVmUmFuayA9IHZhbHVlLnJhbms7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBTZXQgdXAgc3ViZ3JhcGhzXG4gICAgaWYgKGlucHV0R3JhcGgucGFyZW50KSB7XG4gICAgICBpbnB1dEdyYXBoLm5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAgIGcucGFyZW50KHUsIGlucHV0R3JhcGgucGFyZW50KHUpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlucHV0R3JhcGguZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB2YWx1ZSA9IHt9O1xuICAgICAgdmFyIG5ld1ZhbHVlID0ge1xuICAgICAgICBlOiBlLFxuICAgICAgICBtaW5MZW46IHZhbHVlLm1pbkxlbiB8fCAxLFxuICAgICAgICB3aWR0aDogdmFsdWUud2lkdGggfHwgMCxcbiAgICAgICAgaGVpZ2h0OiB2YWx1ZS5oZWlnaHQgfHwgMCxcbiAgICAgICAgcG9pbnRzOiBbXVxuICAgICAgfTtcblxuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYsIG5ld1ZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIEluaXRpYWwgZ3JhcGggYXR0cmlidXRlc1xuICAgIHZhciBncmFwaFZhbHVlID0gaW5wdXRHcmFwaC5ncmFwaCgpIHx8IHt9O1xuICAgIGcuZ3JhcGgoe1xuICAgICAgcmFua0RpcjogZ3JhcGhWYWx1ZS5yYW5rRGlyIHx8IGNvbmZpZy5yYW5rRGlyLFxuICAgICAgb3JkZXJSZXN0YXJ0czogZ3JhcGhWYWx1ZS5vcmRlclJlc3RhcnRzXG4gICAgfSk7XG5cbiAgICByZXR1cm4gZztcbiAgfVxuXG4gIGZ1bmN0aW9uIHJ1bihpbnB1dEdyYXBoKSB7XG4gICAgdmFyIHJhbmtTZXAgPSBzZWxmLnJhbmtTZXAoKTtcbiAgICB2YXIgZztcbiAgICB0cnkge1xuICAgICAgLy8gQnVpbGQgaW50ZXJuYWwgZ3JhcGhcbiAgICAgIGcgPSB1dGlsLnRpbWUoJ2luaXRMYXlvdXRHcmFwaCcsIGluaXRMYXlvdXRHcmFwaCkoaW5wdXRHcmFwaCk7XG5cbiAgICAgIGlmIChnLm9yZGVyKCkgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGc7XG4gICAgICB9XG5cbiAgICAgIC8vIE1ha2Ugc3BhY2UgZm9yIGVkZ2UgbGFiZWxzXG4gICAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHMsIHQsIGEpIHtcbiAgICAgICAgYS5taW5MZW4gKj0gMjtcbiAgICAgIH0pO1xuICAgICAgc2VsZi5yYW5rU2VwKHJhbmtTZXAgLyAyKTtcblxuICAgICAgLy8gRGV0ZXJtaW5lIHRoZSByYW5rIGZvciBlYWNoIG5vZGUuIE5vZGVzIHdpdGggYSBsb3dlciByYW5rIHdpbGwgYXBwZWFyXG4gICAgICAvLyBhYm92ZSBub2RlcyBvZiBoaWdoZXIgcmFuay5cbiAgICAgIHV0aWwudGltZSgncmFuay5ydW4nLCByYW5rLnJ1bikoZywgY29uZmlnLnJhbmtTaW1wbGV4KTtcblxuICAgICAgLy8gTm9ybWFsaXplIHRoZSBncmFwaCBieSBlbnN1cmluZyB0aGF0IGV2ZXJ5IGVkZ2UgaXMgcHJvcGVyIChlYWNoIGVkZ2UgaGFzXG4gICAgICAvLyBhIGxlbmd0aCBvZiAxKS4gV2UgYWNoaWV2ZSB0aGlzIGJ5IGFkZGluZyBkdW1teSBub2RlcyB0byBsb25nIGVkZ2VzLFxuICAgICAgLy8gdGh1cyBzaG9ydGVuaW5nIHRoZW0uXG4gICAgICB1dGlsLnRpbWUoJ25vcm1hbGl6ZScsIG5vcm1hbGl6ZSkoZyk7XG5cbiAgICAgIC8vIE9yZGVyIHRoZSBub2RlcyBzbyB0aGF0IGVkZ2UgY3Jvc3NpbmdzIGFyZSBtaW5pbWl6ZWQuXG4gICAgICB1dGlsLnRpbWUoJ29yZGVyJywgb3JkZXIpKGcsIGNvbmZpZy5vcmRlck1heFN3ZWVwcyk7XG5cbiAgICAgIC8vIEZpbmQgdGhlIHggYW5kIHkgY29vcmRpbmF0ZXMgZm9yIGV2ZXJ5IG5vZGUgaW4gdGhlIGdyYXBoLlxuICAgICAgdXRpbC50aW1lKCdwb3NpdGlvbicsIHBvc2l0aW9uLnJ1bikoZyk7XG5cbiAgICAgIC8vIERlLW5vcm1hbGl6ZSB0aGUgZ3JhcGggYnkgcmVtb3ZpbmcgZHVtbXkgbm9kZXMgYW5kIGF1Z21lbnRpbmcgdGhlXG4gICAgICAvLyBvcmlnaW5hbCBsb25nIGVkZ2VzIHdpdGggY29vcmRpbmF0ZSBpbmZvcm1hdGlvbi5cbiAgICAgIHV0aWwudGltZSgndW5kb05vcm1hbGl6ZScsIHVuZG9Ob3JtYWxpemUpKGcpO1xuXG4gICAgICAvLyBSZXZlcnNlcyBwb2ludHMgZm9yIGVkZ2VzIHRoYXQgYXJlIGluIGEgcmV2ZXJzZWQgc3RhdGUuXG4gICAgICB1dGlsLnRpbWUoJ2ZpeHVwRWRnZVBvaW50cycsIGZpeHVwRWRnZVBvaW50cykoZyk7XG5cbiAgICAgIC8vIFJlc3RvcmUgZGVsZXRlIGVkZ2VzIGFuZCByZXZlcnNlIGVkZ2VzIHRoYXQgd2VyZSByZXZlcnNlZCBpbiB0aGUgcmFua1xuICAgICAgLy8gcGhhc2UuXG4gICAgICB1dGlsLnRpbWUoJ3JhbmsucmVzdG9yZUVkZ2VzJywgcmFuay5yZXN0b3JlRWRnZXMpKGcpO1xuXG4gICAgICAvLyBDb25zdHJ1Y3QgZmluYWwgcmVzdWx0IGdyYXBoIGFuZCByZXR1cm4gaXRcbiAgICAgIHJldHVybiB1dGlsLnRpbWUoJ2NyZWF0ZUZpbmFsR3JhcGgnLCBjcmVhdGVGaW5hbEdyYXBoKShnLCBpbnB1dEdyYXBoLmlzRGlyZWN0ZWQoKSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNlbGYucmFua1NlcChyYW5rU2VwKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBUaGlzIGZ1bmN0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciAnbm9ybWFsaXppbmcnIHRoZSBncmFwaC4gVGhlIHByb2Nlc3Mgb2ZcbiAgICogbm9ybWFsaXphdGlvbiBlbnN1cmVzIHRoYXQgbm8gZWRnZSBpbiB0aGUgZ3JhcGggaGFzIHNwYW5zIG1vcmUgdGhhbiBvbmVcbiAgICogcmFuay4gVG8gZG8gdGhpcyBpdCBpbnNlcnRzIGR1bW15IG5vZGVzIGFzIG5lZWRlZCBhbmQgbGlua3MgdGhlbSBieSBhZGRpbmdcbiAgICogZHVtbXkgZWRnZXMuIFRoaXMgZnVuY3Rpb24ga2VlcHMgZW5vdWdoIGluZm9ybWF0aW9uIGluIHRoZSBkdW1teSBub2RlcyBhbmRcbiAgICogZWRnZXMgdG8gZW5zdXJlIHRoYXQgdGhlIG9yaWdpbmFsIGdyYXBoIGNhbiBiZSByZWNvbnN0cnVjdGVkIGxhdGVyLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoYXQgdGhlIGlucHV0IGdyYXBoIGlzIGN5Y2xlIGZyZWUuXG4gICAqL1xuICBmdW5jdGlvbiBub3JtYWxpemUoZykge1xuICAgIHZhciBkdW1teUNvdW50ID0gMDtcbiAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHMsIHQsIGEpIHtcbiAgICAgIHZhciBzb3VyY2VSYW5rID0gZy5ub2RlKHMpLnJhbms7XG4gICAgICB2YXIgdGFyZ2V0UmFuayA9IGcubm9kZSh0KS5yYW5rO1xuICAgICAgaWYgKHNvdXJjZVJhbmsgKyAxIDwgdGFyZ2V0UmFuaykge1xuICAgICAgICBmb3IgKHZhciB1ID0gcywgcmFuayA9IHNvdXJjZVJhbmsgKyAxLCBpID0gMDsgcmFuayA8IHRhcmdldFJhbms7ICsrcmFuaywgKytpKSB7XG4gICAgICAgICAgdmFyIHYgPSAnX0QnICsgKCsrZHVtbXlDb3VudCk7XG4gICAgICAgICAgdmFyIG5vZGUgPSB7XG4gICAgICAgICAgICB3aWR0aDogYS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogYS5oZWlnaHQsXG4gICAgICAgICAgICBlZGdlOiB7IGlkOiBlLCBzb3VyY2U6IHMsIHRhcmdldDogdCwgYXR0cnM6IGEgfSxcbiAgICAgICAgICAgIHJhbms6IHJhbmssXG4gICAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBJZiB0aGlzIG5vZGUgcmVwcmVzZW50cyBhIGJlbmQgdGhlbiB3ZSB3aWxsIHVzZSBpdCBhcyBhIGNvbnRyb2xcbiAgICAgICAgICAvLyBwb2ludC4gRm9yIGVkZ2VzIHdpdGggMiBzZWdtZW50cyB0aGlzIHdpbGwgYmUgdGhlIGNlbnRlciBkdW1teVxuICAgICAgICAgIC8vIG5vZGUuIEZvciBlZGdlcyB3aXRoIG1vcmUgdGhhbiB0d28gc2VnbWVudHMsIHRoaXMgd2lsbCBiZSB0aGVcbiAgICAgICAgICAvLyBmaXJzdCBhbmQgbGFzdCBkdW1teSBub2RlLlxuICAgICAgICAgIGlmIChpID09PSAwKSBub2RlLmluZGV4ID0gMDtcbiAgICAgICAgICBlbHNlIGlmIChyYW5rICsgMSA9PT0gdGFyZ2V0UmFuaykgbm9kZS5pbmRleCA9IDE7XG5cbiAgICAgICAgICBnLmFkZE5vZGUodiwgbm9kZSk7XG4gICAgICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYsIHt9KTtcbiAgICAgICAgICB1ID0gdjtcbiAgICAgICAgfVxuICAgICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdCwge30pO1xuICAgICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBSZWNvbnN0cnVjdHMgdGhlIGdyYXBoIGFzIGl0IHdhcyBiZWZvcmUgbm9ybWFsaXphdGlvbi4gVGhlIHBvc2l0aW9ucyBvZlxuICAgKiBkdW1teSBub2RlcyBhcmUgdXNlZCB0byBidWlsZCBhbiBhcnJheSBvZiBwb2ludHMgZm9yIHRoZSBvcmlnaW5hbCAnbG9uZydcbiAgICogZWRnZS4gRHVtbXkgbm9kZXMgYW5kIGVkZ2VzIGFyZSByZW1vdmVkLlxuICAgKi9cbiAgZnVuY3Rpb24gdW5kb05vcm1hbGl6ZShnKSB7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCBhKSB7XG4gICAgICBpZiAoYS5kdW1teSkge1xuICAgICAgICBpZiAoJ2luZGV4JyBpbiBhKSB7XG4gICAgICAgICAgdmFyIGVkZ2UgPSBhLmVkZ2U7XG4gICAgICAgICAgaWYgKCFnLmhhc0VkZ2UoZWRnZS5pZCkpIHtcbiAgICAgICAgICAgIGcuYWRkRWRnZShlZGdlLmlkLCBlZGdlLnNvdXJjZSwgZWRnZS50YXJnZXQsIGVkZ2UuYXR0cnMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgcG9pbnRzID0gZy5lZGdlKGVkZ2UuaWQpLnBvaW50cztcbiAgICAgICAgICBwb2ludHNbYS5pbmRleF0gPSB7IHg6IGEueCwgeTogYS55LCB1bDogYS51bCwgdXI6IGEudXIsIGRsOiBhLmRsLCBkcjogYS5kciB9O1xuICAgICAgICB9XG4gICAgICAgIGcuZGVsTm9kZSh1KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIEZvciBlYWNoIGVkZ2UgdGhhdCB3YXMgcmV2ZXJzZWQgZHVyaW5nIHRoZSBgYWN5Y2xpY2Agc3RlcCwgcmV2ZXJzZSBpdHNcbiAgICogYXJyYXkgb2YgcG9pbnRzLlxuICAgKi9cbiAgZnVuY3Rpb24gZml4dXBFZGdlUG9pbnRzKGcpIHtcbiAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHMsIHQsIGEpIHsgaWYgKGEucmV2ZXJzZWQpIGEucG9pbnRzLnJldmVyc2UoKTsgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVGaW5hbEdyYXBoKGcsIGlzRGlyZWN0ZWQpIHtcbiAgICB2YXIgb3V0ID0gaXNEaXJlY3RlZCA/IG5ldyBDRGlncmFwaCgpIDogbmV3IENHcmFwaCgpO1xuICAgIG91dC5ncmFwaChnLmdyYXBoKCkpO1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgb3V0LmFkZE5vZGUodSwgdmFsdWUpOyB9KTtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHsgb3V0LnBhcmVudCh1LCBnLnBhcmVudCh1KSk7IH0pO1xuICAgIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICAgIG91dC5hZGRFZGdlKHZhbHVlLmUsIHUsIHYsIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIEF0dGFjaCBib3VuZGluZyBib3ggaW5mb3JtYXRpb25cbiAgICB2YXIgbWF4WCA9IDAsIG1heFkgPSAwO1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICAgIGlmICghZy5jaGlsZHJlbih1KS5sZW5ndGgpIHtcbiAgICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIHZhbHVlLnggKyB2YWx1ZS53aWR0aCAvIDIpO1xuICAgICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgdmFsdWUueSArIHZhbHVlLmhlaWdodCAvIDIpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICAgIHZhciBtYXhYUG9pbnRzID0gTWF0aC5tYXguYXBwbHkoTWF0aCwgdmFsdWUucG9pbnRzLm1hcChmdW5jdGlvbihwKSB7IHJldHVybiBwLng7IH0pKTtcbiAgICAgIHZhciBtYXhZUG9pbnRzID0gTWF0aC5tYXguYXBwbHkoTWF0aCwgdmFsdWUucG9pbnRzLm1hcChmdW5jdGlvbihwKSB7IHJldHVybiBwLnk7IH0pKTtcbiAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCBtYXhYUG9pbnRzICsgdmFsdWUud2lkdGggLyAyKTtcbiAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCBtYXhZUG9pbnRzICsgdmFsdWUuaGVpZ2h0IC8gMik7XG4gICAgfSk7XG4gICAgb3V0LmdyYXBoKCkud2lkdGggPSBtYXhYO1xuICAgIG91dC5ncmFwaCgpLmhlaWdodCA9IG1heFk7XG5cbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgLypcbiAgICogR2l2ZW4gYSBmdW5jdGlvbiwgYSBuZXcgZnVuY3Rpb24gaXMgcmV0dXJuZWQgdGhhdCBpbnZva2VzIHRoZSBnaXZlblxuICAgKiBmdW5jdGlvbi4gVGhlIHJldHVybiB2YWx1ZSBmcm9tIHRoZSBmdW5jdGlvbiBpcyBhbHdheXMgdGhlIGBzZWxmYCBvYmplY3QuXG4gICAqL1xuICBmdW5jdGlvbiBkZWxlZ2F0ZVByb3BlcnR5KGYpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBmKCk7XG4gICAgICBmLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9O1xuICB9XG59O1xuXG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGNyb3NzQ291bnQgPSByZXF1aXJlKCcuL29yZGVyL2Nyb3NzQ291bnQnKSxcbiAgICBpbml0TGF5ZXJHcmFwaHMgPSByZXF1aXJlKCcuL29yZGVyL2luaXRMYXllckdyYXBocycpLFxuICAgIGluaXRPcmRlciA9IHJlcXVpcmUoJy4vb3JkZXIvaW5pdE9yZGVyJyksXG4gICAgc29ydExheWVyID0gcmVxdWlyZSgnLi9vcmRlci9zb3J0TGF5ZXInKTtcblxubW9kdWxlLmV4cG9ydHMgPSBvcmRlcjtcblxuLy8gVGhlIG1heGltdW0gbnVtYmVyIG9mIHN3ZWVwcyB0byBwZXJmb3JtIGJlZm9yZSBmaW5pc2hpbmcgdGhlIG9yZGVyIHBoYXNlLlxudmFyIERFRkFVTFRfTUFYX1NXRUVQUyA9IDI0O1xub3JkZXIuREVGQVVMVF9NQVhfU1dFRVBTID0gREVGQVVMVF9NQVhfU1dFRVBTO1xuXG4vKlxuICogUnVucyB0aGUgb3JkZXIgcGhhc2Ugd2l0aCB0aGUgc3BlY2lmaWVkIGBncmFwaCwgYG1heFN3ZWVwc2AsIGFuZFxuICogYGRlYnVnTGV2ZWxgLiBJZiBgbWF4U3dlZXBzYCBpcyBub3Qgc3BlY2lmaWVkIHdlIHVzZSBgREVGQVVMVF9NQVhfU1dFRVBTYC5cbiAqIElmIGBkZWJ1Z0xldmVsYCBpcyBub3Qgc2V0IHdlIGFzc3VtZSAwLlxuICovXG5mdW5jdGlvbiBvcmRlcihnLCBtYXhTd2VlcHMpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgbWF4U3dlZXBzID0gREVGQVVMVF9NQVhfU1dFRVBTO1xuICB9XG5cbiAgdmFyIHJlc3RhcnRzID0gZy5ncmFwaCgpLm9yZGVyUmVzdGFydHMgfHwgMDtcblxuICB2YXIgbGF5ZXJHcmFwaHMgPSBpbml0TGF5ZXJHcmFwaHMoZyk7XG4gIC8vIFRPRE86IHJlbW92ZSB0aGlzIHdoZW4gd2UgYWRkIGJhY2sgc3VwcG9ydCBmb3Igb3JkZXJpbmcgY2x1c3RlcnNcbiAgbGF5ZXJHcmFwaHMuZm9yRWFjaChmdW5jdGlvbihsZykge1xuICAgIGxnID0gbGcuZmlsdGVyTm9kZXMoZnVuY3Rpb24odSkgeyByZXR1cm4gIWcuY2hpbGRyZW4odSkubGVuZ3RoOyB9KTtcbiAgfSk7XG5cbiAgdmFyIGl0ZXJzID0gMCxcbiAgICAgIGN1cnJlbnRCZXN0Q0MsXG4gICAgICBhbGxUaW1lQmVzdENDID0gTnVtYmVyLk1BWF9WQUxVRSxcbiAgICAgIGFsbFRpbWVCZXN0ID0ge307XG5cbiAgZnVuY3Rpb24gc2F2ZUFsbFRpbWVCZXN0KCkge1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgYWxsVGltZUJlc3RbdV0gPSB2YWx1ZS5vcmRlcjsgfSk7XG4gIH1cblxuICBmb3IgKHZhciBqID0gMDsgaiA8IE51bWJlcihyZXN0YXJ0cykgKyAxICYmIGFsbFRpbWVCZXN0Q0MgIT09IDA7ICsraikge1xuICAgIGN1cnJlbnRCZXN0Q0MgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgIGluaXRPcmRlcihnLCByZXN0YXJ0cyA+IDApO1xuXG4gICAgdXRpbC5sb2coMiwgJ09yZGVyIHBoYXNlIHN0YXJ0IGNyb3NzIGNvdW50OiAnICsgZy5ncmFwaCgpLm9yZGVySW5pdENDKTtcblxuICAgIHZhciBpLCBsYXN0QmVzdCwgY2M7XG4gICAgZm9yIChpID0gMCwgbGFzdEJlc3QgPSAwOyBsYXN0QmVzdCA8IDQgJiYgaSA8IG1heFN3ZWVwcyAmJiBjdXJyZW50QmVzdENDID4gMDsgKytpLCArK2xhc3RCZXN0LCArK2l0ZXJzKSB7XG4gICAgICBzd2VlcChnLCBsYXllckdyYXBocywgaSk7XG4gICAgICBjYyA9IGNyb3NzQ291bnQoZyk7XG4gICAgICBpZiAoY2MgPCBjdXJyZW50QmVzdENDKSB7XG4gICAgICAgIGxhc3RCZXN0ID0gMDtcbiAgICAgICAgY3VycmVudEJlc3RDQyA9IGNjO1xuICAgICAgICBpZiAoY2MgPCBhbGxUaW1lQmVzdENDKSB7XG4gICAgICAgICAgc2F2ZUFsbFRpbWVCZXN0KCk7XG4gICAgICAgICAgYWxsVGltZUJlc3RDQyA9IGNjO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1dGlsLmxvZygzLCAnT3JkZXIgcGhhc2Ugc3RhcnQgJyArIGogKyAnIGl0ZXIgJyArIGkgKyAnIGNyb3NzIGNvdW50OiAnICsgY2MpO1xuICAgIH1cbiAgfVxuXG4gIE9iamVjdC5rZXlzKGFsbFRpbWVCZXN0KS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICBpZiAoIWcuY2hpbGRyZW4gfHwgIWcuY2hpbGRyZW4odSkubGVuZ3RoKSB7XG4gICAgICBnLm5vZGUodSkub3JkZXIgPSBhbGxUaW1lQmVzdFt1XTtcbiAgICB9XG4gIH0pO1xuICBnLmdyYXBoKCkub3JkZXJDQyA9IGFsbFRpbWVCZXN0Q0M7XG5cbiAgdXRpbC5sb2coMiwgJ09yZGVyIGl0ZXJhdGlvbnM6ICcgKyBpdGVycyk7XG4gIHV0aWwubG9nKDIsICdPcmRlciBwaGFzZSBiZXN0IGNyb3NzIGNvdW50OiAnICsgZy5ncmFwaCgpLm9yZGVyQ0MpO1xufVxuXG5mdW5jdGlvbiBwcmVkZWNlc3NvcldlaWdodHMoZywgbm9kZXMpIHtcbiAgdmFyIHdlaWdodHMgPSB7fTtcbiAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgd2VpZ2h0c1t1XSA9IGcuaW5FZGdlcyh1KS5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGcubm9kZShnLnNvdXJjZShlKSkub3JkZXI7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gd2VpZ2h0cztcbn1cblxuZnVuY3Rpb24gc3VjY2Vzc29yV2VpZ2h0cyhnLCBub2Rlcykge1xuICB2YXIgd2VpZ2h0cyA9IHt9O1xuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICB3ZWlnaHRzW3VdID0gZy5vdXRFZGdlcyh1KS5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGcubm9kZShnLnRhcmdldChlKSkub3JkZXI7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gd2VpZ2h0cztcbn1cblxuZnVuY3Rpb24gc3dlZXAoZywgbGF5ZXJHcmFwaHMsIGl0ZXIpIHtcbiAgaWYgKGl0ZXIgJSAyID09PSAwKSB7XG4gICAgc3dlZXBEb3duKGcsIGxheWVyR3JhcGhzLCBpdGVyKTtcbiAgfSBlbHNlIHtcbiAgICBzd2VlcFVwKGcsIGxheWVyR3JhcGhzLCBpdGVyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzd2VlcERvd24oZywgbGF5ZXJHcmFwaHMpIHtcbiAgdmFyIGNnO1xuICBmb3IgKGkgPSAxOyBpIDwgbGF5ZXJHcmFwaHMubGVuZ3RoOyArK2kpIHtcbiAgICBjZyA9IHNvcnRMYXllcihsYXllckdyYXBoc1tpXSwgY2csIHByZWRlY2Vzc29yV2VpZ2h0cyhnLCBsYXllckdyYXBoc1tpXS5ub2RlcygpKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3dlZXBVcChnLCBsYXllckdyYXBocykge1xuICB2YXIgY2c7XG4gIGZvciAoaSA9IGxheWVyR3JhcGhzLmxlbmd0aCAtIDI7IGkgPj0gMDsgLS1pKSB7XG4gICAgc29ydExheWVyKGxheWVyR3JhcGhzW2ldLCBjZywgc3VjY2Vzc29yV2VpZ2h0cyhnLCBsYXllckdyYXBoc1tpXS5ub2RlcygpKSk7XG4gIH1cbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyb3NzQ291bnQ7XG5cbi8qXG4gKiBSZXR1cm5zIHRoZSBjcm9zcyBjb3VudCBmb3IgdGhlIGdpdmVuIGdyYXBoLlxuICovXG5mdW5jdGlvbiBjcm9zc0NvdW50KGcpIHtcbiAgdmFyIGNjID0gMDtcbiAgdmFyIG9yZGVyaW5nID0gdXRpbC5vcmRlcmluZyhnKTtcbiAgZm9yICh2YXIgaSA9IDE7IGkgPCBvcmRlcmluZy5sZW5ndGg7ICsraSkge1xuICAgIGNjICs9IHR3b0xheWVyQ3Jvc3NDb3VudChnLCBvcmRlcmluZ1tpLTFdLCBvcmRlcmluZ1tpXSk7XG4gIH1cbiAgcmV0dXJuIGNjO1xufVxuXG4vKlxuICogVGhpcyBmdW5jdGlvbiBzZWFyY2hlcyB0aHJvdWdoIGEgcmFua2VkIGFuZCBvcmRlcmVkIGdyYXBoIGFuZCBjb3VudHMgdGhlXG4gKiBudW1iZXIgb2YgZWRnZXMgdGhhdCBjcm9zcy4gVGhpcyBhbGdvcml0aG0gaXMgZGVyaXZlZCBmcm9tOlxuICpcbiAqICAgIFcuIEJhcnRoIGV0IGFsLiwgQmlsYXllciBDcm9zcyBDb3VudGluZywgSkdBQSwgOCgyKSAxNznigJMxOTQgKDIwMDQpXG4gKi9cbmZ1bmN0aW9uIHR3b0xheWVyQ3Jvc3NDb3VudChnLCBsYXllcjEsIGxheWVyMikge1xuICB2YXIgaW5kaWNlcyA9IFtdO1xuICBsYXllcjEuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgdmFyIG5vZGVJbmRpY2VzID0gW107XG4gICAgZy5vdXRFZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHsgbm9kZUluZGljZXMucHVzaChnLm5vZGUoZy50YXJnZXQoZSkpLm9yZGVyKTsgfSk7XG4gICAgbm9kZUluZGljZXMuc29ydChmdW5jdGlvbih4LCB5KSB7IHJldHVybiB4IC0geTsgfSk7XG4gICAgaW5kaWNlcyA9IGluZGljZXMuY29uY2F0KG5vZGVJbmRpY2VzKTtcbiAgfSk7XG5cbiAgdmFyIGZpcnN0SW5kZXggPSAxO1xuICB3aGlsZSAoZmlyc3RJbmRleCA8IGxheWVyMi5sZW5ndGgpIGZpcnN0SW5kZXggPDw9IDE7XG5cbiAgdmFyIHRyZWVTaXplID0gMiAqIGZpcnN0SW5kZXggLSAxO1xuICBmaXJzdEluZGV4IC09IDE7XG5cbiAgdmFyIHRyZWUgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmVlU2l6ZTsgKytpKSB7IHRyZWVbaV0gPSAwOyB9XG5cbiAgdmFyIGNjID0gMDtcbiAgaW5kaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKGkpIHtcbiAgICB2YXIgdHJlZUluZGV4ID0gaSArIGZpcnN0SW5kZXg7XG4gICAgKyt0cmVlW3RyZWVJbmRleF07XG4gICAgd2hpbGUgKHRyZWVJbmRleCA+IDApIHtcbiAgICAgIGlmICh0cmVlSW5kZXggJSAyKSB7XG4gICAgICAgIGNjICs9IHRyZWVbdHJlZUluZGV4ICsgMV07XG4gICAgICB9XG4gICAgICB0cmVlSW5kZXggPSAodHJlZUluZGV4IC0gMSkgPj4gMTtcbiAgICAgICsrdHJlZVt0cmVlSW5kZXhdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNjO1xufVxuIiwidmFyIG5vZGVzRnJvbUxpc3QgPSByZXF1aXJlKCdncmFwaGxpYicpLmZpbHRlci5ub2Rlc0Zyb21MaXN0LFxuICAgIC8qIGpzaGludCAtVzA3OSAqL1xuICAgIFNldCA9IHJlcXVpcmUoJ2NwLWRhdGEnKS5TZXQ7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdExheWVyR3JhcGhzO1xuXG4vKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhIGNvbXBvdW5kIGxheWVyZWQgZ3JhcGgsIGcsIGFuZCBwcm9kdWNlcyBhbiBhcnJheSBvZlxuICogbGF5ZXIgZ3JhcGhzLiBFYWNoIGVudHJ5IGluIHRoZSBhcnJheSByZXByZXNlbnRzIGEgc3ViZ3JhcGggb2Ygbm9kZXNcbiAqIHJlbGV2YW50IGZvciBwZXJmb3JtaW5nIGNyb3NzaW5nIHJlZHVjdGlvbiBvbiB0aGF0IGxheWVyLlxuICovXG5mdW5jdGlvbiBpbml0TGF5ZXJHcmFwaHMoZykge1xuICB2YXIgcmFua3MgPSBbXTtcblxuICBmdW5jdGlvbiBkZnModSkge1xuICAgIGlmICh1ID09PSBudWxsKSB7XG4gICAgICBnLmNoaWxkcmVuKHUpLmZvckVhY2goZnVuY3Rpb24odikgeyBkZnModik7IH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB2YWx1ZSA9IGcubm9kZSh1KTtcbiAgICB2YWx1ZS5taW5SYW5rID0gKCdyYW5rJyBpbiB2YWx1ZSkgPyB2YWx1ZS5yYW5rIDogTnVtYmVyLk1BWF9WQUxVRTtcbiAgICB2YWx1ZS5tYXhSYW5rID0gKCdyYW5rJyBpbiB2YWx1ZSkgPyB2YWx1ZS5yYW5rIDogTnVtYmVyLk1JTl9WQUxVRTtcbiAgICB2YXIgdVJhbmtzID0gbmV3IFNldCgpO1xuICAgIGcuY2hpbGRyZW4odSkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICB2YXIgcnMgPSBkZnModik7XG4gICAgICB1UmFua3MgPSBTZXQudW5pb24oW3VSYW5rcywgcnNdKTtcbiAgICAgIHZhbHVlLm1pblJhbmsgPSBNYXRoLm1pbih2YWx1ZS5taW5SYW5rLCBnLm5vZGUodikubWluUmFuayk7XG4gICAgICB2YWx1ZS5tYXhSYW5rID0gTWF0aC5tYXgodmFsdWUubWF4UmFuaywgZy5ub2RlKHYpLm1heFJhbmspO1xuICAgIH0pO1xuXG4gICAgaWYgKCdyYW5rJyBpbiB2YWx1ZSkgdVJhbmtzLmFkZCh2YWx1ZS5yYW5rKTtcblxuICAgIHVSYW5rcy5rZXlzKCkuZm9yRWFjaChmdW5jdGlvbihyKSB7XG4gICAgICBpZiAoIShyIGluIHJhbmtzKSkgcmFua3Nbcl0gPSBbXTtcbiAgICAgIHJhbmtzW3JdLnB1c2godSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdVJhbmtzO1xuICB9XG4gIGRmcyhudWxsKTtcblxuICB2YXIgbGF5ZXJHcmFwaHMgPSBbXTtcbiAgcmFua3MuZm9yRWFjaChmdW5jdGlvbih1cywgcmFuaykge1xuICAgIGxheWVyR3JhcGhzW3JhbmtdID0gZy5maWx0ZXJOb2Rlcyhub2Rlc0Zyb21MaXN0KHVzKSk7XG4gIH0pO1xuXG4gIHJldHVybiBsYXllckdyYXBocztcbn1cbiIsInZhciBjcm9zc0NvdW50ID0gcmVxdWlyZSgnLi9jcm9zc0NvdW50JyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0T3JkZXI7XG5cbi8qXG4gKiBHaXZlbiBhIGdyYXBoIHdpdGggYSBzZXQgb2YgbGF5ZXJlZCBub2RlcyAoaS5lLiBub2RlcyB0aGF0IGhhdmUgYSBgcmFua2BcbiAqIGF0dHJpYnV0ZSkgdGhpcyBmdW5jdGlvbiBhdHRhY2hlcyBhbiBgb3JkZXJgIGF0dHJpYnV0ZSB0aGF0IHVuaXF1ZWx5XG4gKiBhcnJhbmdlcyBlYWNoIG5vZGUgb2YgZWFjaCByYW5rLiBJZiBubyBjb25zdHJhaW50IGdyYXBoIGlzIHByb3ZpZGVkIHRoZVxuICogb3JkZXIgb2YgdGhlIG5vZGVzIGluIGVhY2ggcmFuayBpcyBlbnRpcmVseSBhcmJpdHJhcnkuXG4gKi9cbmZ1bmN0aW9uIGluaXRPcmRlcihnLCByYW5kb20pIHtcbiAgdmFyIGxheWVycyA9IFtdO1xuXG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB2YXIgbGF5ZXIgPSBsYXllcnNbdmFsdWUucmFua107XG4gICAgaWYgKGcuY2hpbGRyZW4gJiYgZy5jaGlsZHJlbih1KS5sZW5ndGggPiAwKSByZXR1cm47XG4gICAgaWYgKCFsYXllcikge1xuICAgICAgbGF5ZXIgPSBsYXllcnNbdmFsdWUucmFua10gPSBbXTtcbiAgICB9XG4gICAgbGF5ZXIucHVzaCh1KTtcbiAgfSk7XG5cbiAgbGF5ZXJzLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBpZiAocmFuZG9tKSB7XG4gICAgICB1dGlsLnNodWZmbGUobGF5ZXIpO1xuICAgIH1cbiAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHtcbiAgICAgIGcubm9kZSh1KS5vcmRlciA9IGk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHZhciBjYyA9IGNyb3NzQ291bnQoZyk7XG4gIGcuZ3JhcGgoKS5vcmRlckluaXRDQyA9IGNjO1xuICBnLmdyYXBoKCkub3JkZXJDQyA9IE51bWJlci5NQVhfVkFMVUU7XG59XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcbi8qXG4gICAgRGlncmFwaCA9IHJlcXVpcmUoJ2dyYXBobGliJykuRGlncmFwaCxcbiAgICB0b3Bzb3J0ID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5hbGcudG9wc29ydCxcbiAgICBub2Rlc0Zyb21MaXN0ID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5maWx0ZXIubm9kZXNGcm9tTGlzdDtcbiovXG5cbm1vZHVsZS5leHBvcnRzID0gc29ydExheWVyO1xuXG4vKlxuZnVuY3Rpb24gc29ydExheWVyKGcsIGNnLCB3ZWlnaHRzKSB7XG4gIHZhciByZXN1bHQgPSBzb3J0TGF5ZXJTdWJncmFwaChnLCBudWxsLCBjZywgd2VpZ2h0cyk7XG4gIHJlc3VsdC5saXN0LmZvckVhY2goZnVuY3Rpb24odSwgaSkge1xuICAgIGcubm9kZSh1KS5vcmRlciA9IGk7XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0LmNvbnN0cmFpbnRHcmFwaDtcbn1cbiovXG5cbmZ1bmN0aW9uIHNvcnRMYXllcihnLCBjZywgd2VpZ2h0cykge1xuICB2YXIgb3JkZXJpbmcgPSBbXTtcbiAgdmFyIGJzID0ge307XG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICBvcmRlcmluZ1t2YWx1ZS5vcmRlcl0gPSB1O1xuICAgIHZhciB3cyA9IHdlaWdodHNbdV07XG4gICAgaWYgKHdzLmxlbmd0aCkge1xuICAgICAgYnNbdV0gPSB1dGlsLnN1bSh3cykgLyB3cy5sZW5ndGg7XG4gICAgfVxuICB9KTtcblxuICB2YXIgdG9Tb3J0ID0gZy5ub2RlcygpLmZpbHRlcihmdW5jdGlvbih1KSB7IHJldHVybiBic1t1XSAhPT0gdW5kZWZpbmVkOyB9KTtcbiAgdG9Tb3J0LnNvcnQoZnVuY3Rpb24oeCwgeSkge1xuICAgIHJldHVybiBic1t4XSAtIGJzW3ldIHx8IGcubm9kZSh4KS5vcmRlciAtIGcubm9kZSh5KS5vcmRlcjtcbiAgfSk7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSAwLCBqbCA9IHRvU29ydC5sZW5ndGg7IGogPCBqbDsgKytpKSB7XG4gICAgaWYgKGJzW29yZGVyaW5nW2ldXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLm5vZGUodG9Tb3J0W2orK10pLm9yZGVyID0gaTtcbiAgICB9XG4gIH1cbn1cblxuLy8gVE9PRDogcmUtZW5hYmxlIGNvbnN0cmFpbmVkIHNvcnRpbmcgb25jZSB3ZSBoYXZlIGEgc3RyYXRlZ3kgZm9yIGhhbmRsaW5nXG4vLyB1bmRlZmluZWQgYmFyeWNlbnRlcnMuXG4vKlxuZnVuY3Rpb24gc29ydExheWVyU3ViZ3JhcGgoZywgc2csIGNnLCB3ZWlnaHRzKSB7XG4gIGNnID0gY2cgPyBjZy5maWx0ZXJOb2Rlcyhub2Rlc0Zyb21MaXN0KGcuY2hpbGRyZW4oc2cpKSkgOiBuZXcgRGlncmFwaCgpO1xuXG4gIHZhciBub2RlRGF0YSA9IHt9O1xuICBnLmNoaWxkcmVuKHNnKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICBpZiAoZy5jaGlsZHJlbih1KS5sZW5ndGgpIHtcbiAgICAgIG5vZGVEYXRhW3VdID0gc29ydExheWVyU3ViZ3JhcGgoZywgdSwgY2csIHdlaWdodHMpO1xuICAgICAgbm9kZURhdGFbdV0uZmlyc3RTRyA9IHU7XG4gICAgICBub2RlRGF0YVt1XS5sYXN0U0cgPSB1O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgd3MgPSB3ZWlnaHRzW3VdO1xuICAgICAgbm9kZURhdGFbdV0gPSB7XG4gICAgICAgIGRlZ3JlZTogd3MubGVuZ3RoLFxuICAgICAgICBiYXJ5Y2VudGVyOiB3cy5sZW5ndGggPiAwID8gdXRpbC5zdW0od3MpIC8gd3MubGVuZ3RoIDogMCxcbiAgICAgICAgbGlzdDogW3VdXG4gICAgICB9O1xuICAgIH1cbiAgfSk7XG5cbiAgcmVzb2x2ZVZpb2xhdGVkQ29uc3RyYWludHMoZywgY2csIG5vZGVEYXRhKTtcblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG5vZGVEYXRhKTtcbiAga2V5cy5zb3J0KGZ1bmN0aW9uKHgsIHkpIHtcbiAgICByZXR1cm4gbm9kZURhdGFbeF0uYmFyeWNlbnRlciAtIG5vZGVEYXRhW3ldLmJhcnljZW50ZXI7XG4gIH0pO1xuXG4gIHZhciByZXN1bHQgPSAga2V5cy5tYXAoZnVuY3Rpb24odSkgeyByZXR1cm4gbm9kZURhdGFbdV07IH0pXG4gICAgICAgICAgICAgICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24obGhzLCByaHMpIHsgcmV0dXJuIG1lcmdlTm9kZURhdGEoZywgbGhzLCByaHMpOyB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLypcbmZ1bmN0aW9uIG1lcmdlTm9kZURhdGEoZywgbGhzLCByaHMpIHtcbiAgdmFyIGNnID0gbWVyZ2VEaWdyYXBocyhsaHMuY29uc3RyYWludEdyYXBoLCByaHMuY29uc3RyYWludEdyYXBoKTtcblxuICBpZiAobGhzLmxhc3RTRyAhPT0gdW5kZWZpbmVkICYmIHJocy5maXJzdFNHICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoY2cgPT09IHVuZGVmaW5lZCkge1xuICAgICAgY2cgPSBuZXcgRGlncmFwaCgpO1xuICAgIH1cbiAgICBpZiAoIWNnLmhhc05vZGUobGhzLmxhc3RTRykpIHsgY2cuYWRkTm9kZShsaHMubGFzdFNHKTsgfVxuICAgIGNnLmFkZE5vZGUocmhzLmZpcnN0U0cpO1xuICAgIGNnLmFkZEVkZ2UobnVsbCwgbGhzLmxhc3RTRywgcmhzLmZpcnN0U0cpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBkZWdyZWU6IGxocy5kZWdyZWUgKyByaHMuZGVncmVlLFxuICAgIGJhcnljZW50ZXI6IChsaHMuYmFyeWNlbnRlciAqIGxocy5kZWdyZWUgKyByaHMuYmFyeWNlbnRlciAqIHJocy5kZWdyZWUpIC9cbiAgICAgICAgICAgICAgICAobGhzLmRlZ3JlZSArIHJocy5kZWdyZWUpLFxuICAgIGxpc3Q6IGxocy5saXN0LmNvbmNhdChyaHMubGlzdCksXG4gICAgZmlyc3RTRzogbGhzLmZpcnN0U0cgIT09IHVuZGVmaW5lZCA/IGxocy5maXJzdFNHIDogcmhzLmZpcnN0U0csXG4gICAgbGFzdFNHOiByaHMubGFzdFNHICE9PSB1bmRlZmluZWQgPyByaHMubGFzdFNHIDogbGhzLmxhc3RTRyxcbiAgICBjb25zdHJhaW50R3JhcGg6IGNnXG4gIH07XG59XG5cbmZ1bmN0aW9uIG1lcmdlRGlncmFwaHMobGhzLCByaHMpIHtcbiAgaWYgKGxocyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gcmhzO1xuICBpZiAocmhzID09PSB1bmRlZmluZWQpIHJldHVybiBsaHM7XG5cbiAgbGhzID0gbGhzLmNvcHkoKTtcbiAgcmhzLm5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbih1KSB7IGxocy5hZGROb2RlKHUpOyB9KTtcbiAgcmhzLmVkZ2VzKCkuZm9yRWFjaChmdW5jdGlvbihlLCB1LCB2KSB7IGxocy5hZGRFZGdlKG51bGwsIHUsIHYpOyB9KTtcbiAgcmV0dXJuIGxocztcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZpb2xhdGVkQ29uc3RyYWludHMoZywgY2csIG5vZGVEYXRhKSB7XG4gIC8vIFJlbW92ZXMgbm9kZXMgYHVgIGFuZCBgdmAgZnJvbSBgY2dgIGFuZCBtYWtlcyBhbnkgZWRnZXMgaW5jaWRlbnQgb24gdGhlbVxuICAvLyBpbmNpZGVudCBvbiBgd2AgaW5zdGVhZC5cbiAgZnVuY3Rpb24gY29sbGFwc2VOb2Rlcyh1LCB2LCB3KSB7XG4gICAgLy8gVE9ETyBvcmlnaW5hbCBwYXBlciByZW1vdmVzIHNlbGYgbG9vcHMsIGJ1dCBpdCBpcyBub3Qgb2J2aW91cyB3aGVuIHRoaXMgd291bGQgaGFwcGVuXG4gICAgY2cuaW5FZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgIGNnLmRlbEVkZ2UoZSk7XG4gICAgICBjZy5hZGRFZGdlKG51bGwsIGNnLnNvdXJjZShlKSwgdyk7XG4gICAgfSk7XG5cbiAgICBjZy5vdXRFZGdlcyh2KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgIGNnLmRlbEVkZ2UoZSk7XG4gICAgICBjZy5hZGRFZGdlKG51bGwsIHcsIGNnLnRhcmdldChlKSk7XG4gICAgfSk7XG5cbiAgICBjZy5kZWxOb2RlKHUpO1xuICAgIGNnLmRlbE5vZGUodik7XG4gIH1cblxuICB2YXIgdmlvbGF0ZWQ7XG4gIHdoaWxlICgodmlvbGF0ZWQgPSBmaW5kVmlvbGF0ZWRDb25zdHJhaW50KGNnLCBub2RlRGF0YSkpICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgc291cmNlID0gY2cuc291cmNlKHZpb2xhdGVkKSxcbiAgICAgICAgdGFyZ2V0ID0gY2cudGFyZ2V0KHZpb2xhdGVkKTtcblxuICAgIHZhciB2O1xuICAgIHdoaWxlICgodiA9IGNnLmFkZE5vZGUobnVsbCkpICYmIGcuaGFzTm9kZSh2KSkge1xuICAgICAgY2cuZGVsTm9kZSh2KTtcbiAgICB9XG5cbiAgICAvLyBDb2xsYXBzZSBiYXJ5Y2VudGVyIGFuZCBsaXN0XG4gICAgbm9kZURhdGFbdl0gPSBtZXJnZU5vZGVEYXRhKGcsIG5vZGVEYXRhW3NvdXJjZV0sIG5vZGVEYXRhW3RhcmdldF0pO1xuICAgIGRlbGV0ZSBub2RlRGF0YVtzb3VyY2VdO1xuICAgIGRlbGV0ZSBub2RlRGF0YVt0YXJnZXRdO1xuXG4gICAgY29sbGFwc2VOb2Rlcyhzb3VyY2UsIHRhcmdldCwgdik7XG4gICAgaWYgKGNnLmluY2lkZW50RWRnZXModikubGVuZ3RoID09PSAwKSB7IGNnLmRlbE5vZGUodik7IH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kVmlvbGF0ZWRDb25zdHJhaW50KGNnLCBub2RlRGF0YSkge1xuICB2YXIgdXMgPSB0b3Bzb3J0KGNnKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB1cy5sZW5ndGg7ICsraSkge1xuICAgIHZhciB1ID0gdXNbaV07XG4gICAgdmFyIGluRWRnZXMgPSBjZy5pbkVkZ2VzKHUpO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgaW5FZGdlcy5sZW5ndGg7ICsraikge1xuICAgICAgdmFyIGUgPSBpbkVkZ2VzW2pdO1xuICAgICAgaWYgKG5vZGVEYXRhW2NnLnNvdXJjZShlKV0uYmFyeWNlbnRlciA+PSBub2RlRGF0YVt1XS5iYXJ5Y2VudGVyKSB7XG4gICAgICAgIHJldHVybiBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuKi9cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbi8qXG4gKiBUaGUgYWxnb3JpdGhtcyBoZXJlIGFyZSBiYXNlZCBvbiBCcmFuZGVzIGFuZCBLw7ZwZiwgXCJGYXN0IGFuZCBTaW1wbGVcbiAqIEhvcml6b250YWwgQ29vcmRpbmF0ZSBBc3NpZ25tZW50XCIuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIC8vIEV4dGVybmFsIGNvbmZpZ3VyYXRpb25cbiAgdmFyIGNvbmZpZyA9IHtcbiAgICBub2RlU2VwOiA1MCxcbiAgICBlZGdlU2VwOiAxMCxcbiAgICB1bml2ZXJzYWxTZXA6IG51bGwsXG4gICAgcmFua1NlcDogMzBcbiAgfTtcblxuICB2YXIgc2VsZiA9IHt9O1xuXG4gIHNlbGYubm9kZVNlcCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdub2RlU2VwJyk7XG4gIHNlbGYuZWRnZVNlcCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdlZGdlU2VwJyk7XG4gIC8vIElmIG5vdCBudWxsIHRoaXMgc2VwYXJhdGlvbiB2YWx1ZSBpcyB1c2VkIGZvciBhbGwgbm9kZXMgYW5kIGVkZ2VzXG4gIC8vIHJlZ2FyZGxlc3Mgb2YgdGhlaXIgd2lkdGhzLiBgbm9kZVNlcGAgYW5kIGBlZGdlU2VwYCBhcmUgaWdub3JlZCB3aXRoIHRoaXNcbiAgLy8gb3B0aW9uLlxuICBzZWxmLnVuaXZlcnNhbFNlcCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICd1bml2ZXJzYWxTZXAnKTtcbiAgc2VsZi5yYW5rU2VwID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ3JhbmtTZXAnKTtcbiAgc2VsZi5kZWJ1Z0xldmVsID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ2RlYnVnTGV2ZWwnKTtcblxuICBzZWxmLnJ1biA9IHJ1bjtcblxuICByZXR1cm4gc2VsZjtcblxuICBmdW5jdGlvbiBydW4oZykge1xuICAgIGcgPSBnLmZpbHRlck5vZGVzKHV0aWwuZmlsdGVyTm9uU3ViZ3JhcGhzKGcpKTtcblxuICAgIHZhciBsYXllcmluZyA9IHV0aWwub3JkZXJpbmcoZyk7XG5cbiAgICB2YXIgY29uZmxpY3RzID0gZmluZENvbmZsaWN0cyhnLCBsYXllcmluZyk7XG5cbiAgICB2YXIgeHNzID0ge307XG4gICAgWyd1JywgJ2QnXS5mb3JFYWNoKGZ1bmN0aW9uKHZlcnREaXIpIHtcbiAgICAgIGlmICh2ZXJ0RGlyID09PSAnZCcpIGxheWVyaW5nLnJldmVyc2UoKTtcblxuICAgICAgWydsJywgJ3InXS5mb3JFYWNoKGZ1bmN0aW9uKGhvcml6RGlyKSB7XG4gICAgICAgIGlmIChob3JpekRpciA9PT0gJ3InKSByZXZlcnNlSW5uZXJPcmRlcihsYXllcmluZyk7XG5cbiAgICAgICAgdmFyIGRpciA9IHZlcnREaXIgKyBob3JpekRpcjtcbiAgICAgICAgdmFyIGFsaWduID0gdmVydGljYWxBbGlnbm1lbnQoZywgbGF5ZXJpbmcsIGNvbmZsaWN0cywgdmVydERpciA9PT0gJ3UnID8gJ3ByZWRlY2Vzc29ycycgOiAnc3VjY2Vzc29ycycpO1xuICAgICAgICB4c3NbZGlyXT0gaG9yaXpvbnRhbENvbXBhY3Rpb24oZywgbGF5ZXJpbmcsIGFsaWduLnBvcywgYWxpZ24ucm9vdCwgYWxpZ24uYWxpZ24pO1xuXG4gICAgICAgIGlmIChjb25maWcuZGVidWdMZXZlbCA+PSAzKVxuICAgICAgICAgIGRlYnVnUG9zaXRpb25pbmcodmVydERpciArIGhvcml6RGlyLCBnLCBsYXllcmluZywgeHNzW2Rpcl0pO1xuXG4gICAgICAgIGlmIChob3JpekRpciA9PT0gJ3InKSBmbGlwSG9yaXpvbnRhbGx5KHhzc1tkaXJdKTtcblxuICAgICAgICBpZiAoaG9yaXpEaXIgPT09ICdyJykgcmV2ZXJzZUlubmVyT3JkZXIobGF5ZXJpbmcpO1xuICAgICAgfSk7XG5cbiAgICAgIGlmICh2ZXJ0RGlyID09PSAnZCcpIGxheWVyaW5nLnJldmVyc2UoKTtcbiAgICB9KTtcblxuICAgIGJhbGFuY2UoZywgbGF5ZXJpbmcsIHhzcyk7XG5cbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHYpIHtcbiAgICAgIHZhciB4cyA9IFtdO1xuICAgICAgZm9yICh2YXIgYWxpZ25tZW50IGluIHhzcykge1xuICAgICAgICB2YXIgYWxpZ25tZW50WCA9IHhzc1thbGlnbm1lbnRdW3ZdO1xuICAgICAgICBwb3NYRGVidWcoYWxpZ25tZW50LCBnLCB2LCBhbGlnbm1lbnRYKTtcbiAgICAgICAgeHMucHVzaChhbGlnbm1lbnRYKTtcbiAgICAgIH1cbiAgICAgIHhzLnNvcnQoZnVuY3Rpb24oeCwgeSkgeyByZXR1cm4geCAtIHk7IH0pO1xuICAgICAgcG9zWChnLCB2LCAoeHNbMV0gKyB4c1syXSkgLyAyKTtcbiAgICB9KTtcblxuICAgIC8vIEFsaWduIHkgY29vcmRpbmF0ZXMgd2l0aCByYW5rc1xuICAgIHZhciB5ID0gMCwgcmV2ZXJzZVkgPSBnLmdyYXBoKCkucmFua0RpciA9PT0gJ0JUJyB8fCBnLmdyYXBoKCkucmFua0RpciA9PT0gJ1JMJztcbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICB2YXIgbWF4SGVpZ2h0ID0gdXRpbC5tYXgobGF5ZXIubWFwKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGhlaWdodChnLCB1KTsgfSkpO1xuICAgICAgeSArPSBtYXhIZWlnaHQgLyAyO1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAgIHBvc1koZywgdSwgcmV2ZXJzZVkgPyAteSA6IHkpO1xuICAgICAgfSk7XG4gICAgICB5ICs9IG1heEhlaWdodCAvIDIgKyBjb25maWcucmFua1NlcDtcbiAgICB9KTtcblxuICAgIC8vIFRyYW5zbGF0ZSBsYXlvdXQgc28gdGhhdCB0b3AgbGVmdCBjb3JuZXIgb2YgYm91bmRpbmcgcmVjdGFuZ2xlIGhhc1xuICAgIC8vIGNvb3JkaW5hdGUgKDAsIDApLlxuICAgIHZhciBtaW5YID0gdXRpbC5taW4oZy5ub2RlcygpLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBwb3NYKGcsIHUpIC0gd2lkdGgoZywgdSkgLyAyOyB9KSk7XG4gICAgdmFyIG1pblkgPSB1dGlsLm1pbihnLm5vZGVzKCkubWFwKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIHBvc1koZywgdSkgLSBoZWlnaHQoZywgdSkgLyAyOyB9KSk7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgICBwb3NYKGcsIHUsIHBvc1goZywgdSkgLSBtaW5YKTtcbiAgICAgIHBvc1koZywgdSwgcG9zWShnLCB1KSAtIG1pblkpO1xuICAgIH0pO1xuICB9XG5cbiAgLypcbiAgICogR2VuZXJhdGUgYW4gSUQgdGhhdCBjYW4gYmUgdXNlZCB0byByZXByZXNlbnQgYW55IHVuZGlyZWN0ZWQgZWRnZSB0aGF0IGlzXG4gICAqIGluY2lkZW50IG9uIGB1YCBhbmQgYHZgLlxuICAgKi9cbiAgZnVuY3Rpb24gdW5kaXJFZGdlSWQodSwgdikge1xuICAgIHJldHVybiB1IDwgdlxuICAgICAgPyB1LnRvU3RyaW5nKCkubGVuZ3RoICsgJzonICsgdSArICctJyArIHZcbiAgICAgIDogdi50b1N0cmluZygpLmxlbmd0aCArICc6JyArIHYgKyAnLScgKyB1O1xuICB9XG5cbiAgZnVuY3Rpb24gZmluZENvbmZsaWN0cyhnLCBsYXllcmluZykge1xuICAgIHZhciBjb25mbGljdHMgPSB7fSwgLy8gU2V0IG9mIGNvbmZsaWN0aW5nIGVkZ2UgaWRzXG4gICAgICAgIHBvcyA9IHt9LCAgICAgICAvLyBQb3NpdGlvbiBvZiBub2RlIGluIGl0cyBsYXllclxuICAgICAgICBwcmV2TGF5ZXIsXG4gICAgICAgIGN1cnJMYXllcixcbiAgICAgICAgazAsICAgICAvLyBQb3NpdGlvbiBvZiB0aGUgbGFzdCBpbm5lciBzZWdtZW50IGluIHRoZSBwcmV2aW91cyBsYXllclxuICAgICAgICBsLCAgICAgIC8vIEN1cnJlbnQgcG9zaXRpb24gaW4gdGhlIGN1cnJlbnQgbGF5ZXIgKGZvciBpdGVyYXRpb24gdXAgdG8gYGwxYClcbiAgICAgICAgazE7ICAgICAvLyBQb3NpdGlvbiBvZiB0aGUgbmV4dCBpbm5lciBzZWdtZW50IGluIHRoZSBwcmV2aW91cyBsYXllciBvclxuICAgICAgICAgICAgICAgIC8vIHRoZSBwb3NpdGlvbiBvZiB0aGUgbGFzdCBlbGVtZW50IGluIHRoZSBwcmV2aW91cyBsYXllclxuXG4gICAgaWYgKGxheWVyaW5nLmxlbmd0aCA8PSAyKSByZXR1cm4gY29uZmxpY3RzO1xuXG4gICAgZnVuY3Rpb24gdXBkYXRlQ29uZmxpY3RzKHYpIHtcbiAgICAgIHZhciBrID0gcG9zW3ZdO1xuICAgICAgaWYgKGsgPCBrMCB8fCBrID4gazEpIHtcbiAgICAgICAgY29uZmxpY3RzW3VuZGlyRWRnZUlkKGN1cnJMYXllcltsXSwgdildID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsYXllcmluZ1sxXS5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHsgcG9zW3VdID0gaTsgfSk7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsYXllcmluZy5sZW5ndGggLSAxOyArK2kpIHtcbiAgICAgIHByZXZMYXllciA9IGxheWVyaW5nW2ldO1xuICAgICAgY3VyckxheWVyID0gbGF5ZXJpbmdbaSsxXTtcbiAgICAgIGswID0gMDtcbiAgICAgIGwgPSAwO1xuXG4gICAgICAvLyBTY2FuIGN1cnJlbnQgbGF5ZXIgZm9yIG5leHQgbm9kZSB0aGF0IGlzIGluY2lkZW50IHRvIGFuIGlubmVyIHNlZ2VtZW50XG4gICAgICAvLyBiZXR3ZWVuIGxheWVyaW5nW2krMV0gYW5kIGxheWVyaW5nW2ldLlxuICAgICAgZm9yICh2YXIgbDEgPSAwOyBsMSA8IGN1cnJMYXllci5sZW5ndGg7ICsrbDEpIHtcbiAgICAgICAgdmFyIHUgPSBjdXJyTGF5ZXJbbDFdOyAvLyBOZXh0IGlubmVyIHNlZ21lbnQgaW4gdGhlIGN1cnJlbnQgbGF5ZXIgb3JcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBsYXN0IG5vZGUgaW4gdGhlIGN1cnJlbnQgbGF5ZXJcbiAgICAgICAgcG9zW3VdID0gbDE7XG4gICAgICAgIGsxID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChnLm5vZGUodSkuZHVtbXkpIHtcbiAgICAgICAgICB2YXIgdVByZWQgPSBnLnByZWRlY2Vzc29ycyh1KVswXTtcbiAgICAgICAgICAvLyBOb3RlOiBJbiB0aGUgY2FzZSBvZiBzZWxmIGxvb3BzIGFuZCBzaWRld2F5cyBlZGdlcyBpdCBpcyBwb3NzaWJsZVxuICAgICAgICAgIC8vIGZvciBhIGR1bW15IG5vdCB0byBoYXZlIGEgcHJlZGVjZXNzb3IuXG4gICAgICAgICAgaWYgKHVQcmVkICE9PSB1bmRlZmluZWQgJiYgZy5ub2RlKHVQcmVkKS5kdW1teSlcbiAgICAgICAgICAgIGsxID0gcG9zW3VQcmVkXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoazEgPT09IHVuZGVmaW5lZCAmJiBsMSA9PT0gY3VyckxheWVyLmxlbmd0aCAtIDEpXG4gICAgICAgICAgazEgPSBwcmV2TGF5ZXIubGVuZ3RoIC0gMTtcblxuICAgICAgICBpZiAoazEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGZvciAoOyBsIDw9IGwxOyArK2wpIHtcbiAgICAgICAgICAgIGcucHJlZGVjZXNzb3JzKGN1cnJMYXllcltsXSkuZm9yRWFjaCh1cGRhdGVDb25mbGljdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBrMCA9IGsxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbmZsaWN0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIHZlcnRpY2FsQWxpZ25tZW50KGcsIGxheWVyaW5nLCBjb25mbGljdHMsIHJlbGF0aW9uc2hpcCkge1xuICAgIHZhciBwb3MgPSB7fSwgICAvLyBQb3NpdGlvbiBmb3IgYSBub2RlIGluIGl0cyBsYXllclxuICAgICAgICByb290ID0ge30sICAvLyBSb290IG9mIHRoZSBibG9jayB0aGF0IHRoZSBub2RlIHBhcnRpY2lwYXRlcyBpblxuICAgICAgICBhbGlnbiA9IHt9OyAvLyBQb2ludHMgdG8gdGhlIG5leHQgbm9kZSBpbiB0aGUgYmxvY2sgb3IsIGlmIHRoZSBsYXN0XG4gICAgICAgICAgICAgICAgICAgIC8vIGVsZW1lbnQgaW4gdGhlIGJsb2NrLCBwb2ludHMgdG8gdGhlIGZpcnN0IGJsb2NrJ3Mgcm9vdFxuXG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7XG4gICAgICAgIHJvb3RbdV0gPSB1O1xuICAgICAgICBhbGlnblt1XSA9IHU7XG4gICAgICAgIHBvc1t1XSA9IGk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIHZhciBwcmV2SWR4ID0gLTE7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdmFyIHJlbGF0ZWQgPSBnW3JlbGF0aW9uc2hpcF0odiksIC8vIEFkamFjZW50IG5vZGVzIGZyb20gdGhlIHByZXZpb3VzIGxheWVyXG4gICAgICAgICAgICBtaWQ7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGUgbWlkIHBvaW50IGluIHRoZSByZWxhdGVkIGFycmF5XG5cbiAgICAgICAgaWYgKHJlbGF0ZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJlbGF0ZWQuc29ydChmdW5jdGlvbih4LCB5KSB7IHJldHVybiBwb3NbeF0gLSBwb3NbeV07IH0pO1xuICAgICAgICAgIG1pZCA9IChyZWxhdGVkLmxlbmd0aCAtIDEpIC8gMjtcbiAgICAgICAgICByZWxhdGVkLnNsaWNlKE1hdGguZmxvb3IobWlkKSwgTWF0aC5jZWlsKG1pZCkgKyAxKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgICAgICAgIGlmIChhbGlnblt2XSA9PT0gdikge1xuICAgICAgICAgICAgICBpZiAoIWNvbmZsaWN0c1t1bmRpckVkZ2VJZCh1LCB2KV0gJiYgcHJldklkeCA8IHBvc1t1XSkge1xuICAgICAgICAgICAgICAgIGFsaWduW3VdID0gdjtcbiAgICAgICAgICAgICAgICBhbGlnblt2XSA9IHJvb3Rbdl0gPSByb290W3VdO1xuICAgICAgICAgICAgICAgIHByZXZJZHggPSBwb3NbdV07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyBwb3M6IHBvcywgcm9vdDogcm9vdCwgYWxpZ246IGFsaWduIH07XG4gIH1cblxuICAvLyBUaGlzIGZ1bmN0aW9uIGRldmlhdGVzIGZyb20gdGhlIHN0YW5kYXJkIEJLIGFsZ29yaXRobSBpbiB0d28gd2F5cy4gRmlyc3RcbiAgLy8gaXQgdGFrZXMgaW50byBhY2NvdW50IHRoZSBzaXplIG9mIHRoZSBub2Rlcy4gU2Vjb25kIGl0IGluY2x1ZGVzIGEgZml4IHRvXG4gIC8vIHRoZSBvcmlnaW5hbCBhbGdvcml0aG0gdGhhdCBpcyBkZXNjcmliZWQgaW4gQ2Fyc3RlbnMsIFwiTm9kZSBhbmQgTGFiZWxcbiAgLy8gUGxhY2VtZW50IGluIGEgTGF5ZXJlZCBMYXlvdXQgQWxnb3JpdGhtXCIuXG4gIGZ1bmN0aW9uIGhvcml6b250YWxDb21wYWN0aW9uKGcsIGxheWVyaW5nLCBwb3MsIHJvb3QsIGFsaWduKSB7XG4gICAgdmFyIHNpbmsgPSB7fSwgICAgICAgLy8gTWFwcGluZyBvZiBub2RlIGlkIC0+IHNpbmsgbm9kZSBpZCBmb3IgY2xhc3NcbiAgICAgICAgbWF5YmVTaGlmdCA9IHt9LCAvLyBNYXBwaW5nIG9mIHNpbmsgbm9kZSBpZCAtPiB7IGNsYXNzIG5vZGUgaWQsIG1pbiBzaGlmdCB9XG4gICAgICAgIHNoaWZ0ID0ge30sICAgICAgLy8gTWFwcGluZyBvZiBzaW5rIG5vZGUgaWQgLT4gc2hpZnRcbiAgICAgICAgcHJlZCA9IHt9LCAgICAgICAvLyBNYXBwaW5nIG9mIG5vZGUgaWQgLT4gcHJlZGVjZXNzb3Igbm9kZSAob3IgbnVsbClcbiAgICAgICAgeHMgPSB7fTsgICAgICAgICAvLyBDYWxjdWxhdGVkIFggcG9zaXRpb25zXG5cbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHtcbiAgICAgICAgc2lua1t1XSA9IHU7XG4gICAgICAgIG1heWJlU2hpZnRbdV0gPSB7fTtcbiAgICAgICAgaWYgKGkgPiAwKVxuICAgICAgICAgIHByZWRbdV0gPSBsYXllcltpIC0gMV07XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZVNoaWZ0KHRvU2hpZnQsIG5laWdoYm9yLCBkZWx0YSkge1xuICAgICAgaWYgKCEobmVpZ2hib3IgaW4gbWF5YmVTaGlmdFt0b1NoaWZ0XSkpIHtcbiAgICAgICAgbWF5YmVTaGlmdFt0b1NoaWZ0XVtuZWlnaGJvcl0gPSBkZWx0YTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1heWJlU2hpZnRbdG9TaGlmdF1bbmVpZ2hib3JdID0gTWF0aC5taW4obWF5YmVTaGlmdFt0b1NoaWZ0XVtuZWlnaGJvcl0sIGRlbHRhKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwbGFjZUJsb2NrKHYpIHtcbiAgICAgIGlmICghKHYgaW4geHMpKSB7XG4gICAgICAgIHhzW3ZdID0gMDtcbiAgICAgICAgdmFyIHcgPSB2O1xuICAgICAgICBkbyB7XG4gICAgICAgICAgaWYgKHBvc1t3XSA+IDApIHtcbiAgICAgICAgICAgIHZhciB1ID0gcm9vdFtwcmVkW3ddXTtcbiAgICAgICAgICAgIHBsYWNlQmxvY2sodSk7XG4gICAgICAgICAgICBpZiAoc2lua1t2XSA9PT0gdikge1xuICAgICAgICAgICAgICBzaW5rW3ZdID0gc2lua1t1XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBkZWx0YSA9IHNlcChnLCBwcmVkW3ddKSArIHNlcChnLCB3KTtcbiAgICAgICAgICAgIGlmIChzaW5rW3ZdICE9PSBzaW5rW3VdKSB7XG4gICAgICAgICAgICAgIHVwZGF0ZVNoaWZ0KHNpbmtbdV0sIHNpbmtbdl0sIHhzW3ZdIC0geHNbdV0gLSBkZWx0YSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB4c1t2XSA9IE1hdGgubWF4KHhzW3ZdLCB4c1t1XSArIGRlbHRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdyA9IGFsaWduW3ddO1xuICAgICAgICB9IHdoaWxlICh3ICE9PSB2KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSb290IGNvb3JkaW5hdGVzIHJlbGF0aXZlIHRvIHNpbmtcbiAgICB1dGlsLnZhbHVlcyhyb290KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIHBsYWNlQmxvY2sodik7XG4gICAgfSk7XG5cbiAgICAvLyBBYnNvbHV0ZSBjb29yZGluYXRlc1xuICAgIC8vIFRoZXJlIGlzIGFuIGFzc3VtcHRpb24gaGVyZSB0aGF0IHdlJ3ZlIHJlc29sdmVkIHNoaWZ0cyBmb3IgYW55IGNsYXNzZXNcbiAgICAvLyB0aGF0IGJlZ2luIGF0IGFuIGVhcmxpZXIgbGF5ZXIuIFdlIGd1YXJhbnRlZSB0aGlzIGJ5IHZpc2l0aW5nIGxheWVycyBpblxuICAgIC8vIG9yZGVyLlxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgICB4c1t2XSA9IHhzW3Jvb3Rbdl1dO1xuICAgICAgICBpZiAodiA9PT0gcm9vdFt2XSAmJiB2ID09PSBzaW5rW3ZdKSB7XG4gICAgICAgICAgdmFyIG1pblNoaWZ0ID0gMDtcbiAgICAgICAgICBpZiAodiBpbiBtYXliZVNoaWZ0ICYmIE9iamVjdC5rZXlzKG1heWJlU2hpZnRbdl0pLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG1pblNoaWZ0ID0gdXRpbC5taW4oT2JqZWN0LmtleXMobWF5YmVTaGlmdFt2XSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24odSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWF5YmVTaGlmdFt2XVt1XSArICh1IGluIHNoaWZ0ID8gc2hpZnRbdV0gOiAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNoaWZ0W3ZdID0gbWluU2hpZnQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgIHhzW3ZdICs9IHNoaWZ0W3Npbmtbcm9vdFt2XV1dIHx8IDA7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB4cztcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRNaW5Db29yZChnLCBsYXllcmluZywgeHMpIHtcbiAgICByZXR1cm4gdXRpbC5taW4obGF5ZXJpbmcubWFwKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICB2YXIgdSA9IGxheWVyWzBdO1xuICAgICAgcmV0dXJuIHhzW3VdO1xuICAgIH0pKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRNYXhDb29yZChnLCBsYXllcmluZywgeHMpIHtcbiAgICByZXR1cm4gdXRpbC5tYXgobGF5ZXJpbmcubWFwKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICB2YXIgdSA9IGxheWVyW2xheWVyLmxlbmd0aCAtIDFdO1xuICAgICAgcmV0dXJuIHhzW3VdO1xuICAgIH0pKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJhbGFuY2UoZywgbGF5ZXJpbmcsIHhzcykge1xuICAgIHZhciBtaW4gPSB7fSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWluIGNvb3JkaW5hdGUgZm9yIHRoZSBhbGlnbm1lbnRcbiAgICAgICAgbWF4ID0ge30sICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1heCBjb29yZGluYXRlIGZvciB0aGUgYWxnaW5tZW50XG4gICAgICAgIHNtYWxsZXN0QWxpZ25tZW50LFxuICAgICAgICBzaGlmdCA9IHt9OyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQW1vdW50IHRvIHNoaWZ0IGEgZ2l2ZW4gYWxpZ25tZW50XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVBbGlnbm1lbnQodikge1xuICAgICAgeHNzW2FsaWdubWVudF1bdl0gKz0gc2hpZnRbYWxpZ25tZW50XTtcbiAgICB9XG5cbiAgICB2YXIgc21hbGxlc3QgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgZm9yICh2YXIgYWxpZ25tZW50IGluIHhzcykge1xuICAgICAgdmFyIHhzID0geHNzW2FsaWdubWVudF07XG4gICAgICBtaW5bYWxpZ25tZW50XSA9IGZpbmRNaW5Db29yZChnLCBsYXllcmluZywgeHMpO1xuICAgICAgbWF4W2FsaWdubWVudF0gPSBmaW5kTWF4Q29vcmQoZywgbGF5ZXJpbmcsIHhzKTtcbiAgICAgIHZhciB3ID0gbWF4W2FsaWdubWVudF0gLSBtaW5bYWxpZ25tZW50XTtcbiAgICAgIGlmICh3IDwgc21hbGxlc3QpIHtcbiAgICAgICAgc21hbGxlc3QgPSB3O1xuICAgICAgICBzbWFsbGVzdEFsaWdubWVudCA9IGFsaWdubWVudDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBEZXRlcm1pbmUgaG93IG11Y2ggdG8gYWRqdXN0IHBvc2l0aW9uaW5nIGZvciBlYWNoIGFsaWdubWVudFxuICAgIFsndScsICdkJ10uZm9yRWFjaChmdW5jdGlvbih2ZXJ0RGlyKSB7XG4gICAgICBbJ2wnLCAnciddLmZvckVhY2goZnVuY3Rpb24oaG9yaXpEaXIpIHtcbiAgICAgICAgdmFyIGFsaWdubWVudCA9IHZlcnREaXIgKyBob3JpekRpcjtcbiAgICAgICAgc2hpZnRbYWxpZ25tZW50XSA9IGhvcml6RGlyID09PSAnbCdcbiAgICAgICAgICAgID8gbWluW3NtYWxsZXN0QWxpZ25tZW50XSAtIG1pblthbGlnbm1lbnRdXG4gICAgICAgICAgICA6IG1heFtzbWFsbGVzdEFsaWdubWVudF0gLSBtYXhbYWxpZ25tZW50XTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gRmluZCBhdmVyYWdlIG9mIG1lZGlhbnMgZm9yIHhzcyBhcnJheVxuICAgIGZvciAoYWxpZ25tZW50IGluIHhzcykge1xuICAgICAgZy5lYWNoTm9kZSh1cGRhdGVBbGlnbm1lbnQpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZsaXBIb3Jpem9udGFsbHkoeHMpIHtcbiAgICBmb3IgKHZhciB1IGluIHhzKSB7XG4gICAgICB4c1t1XSA9IC14c1t1XTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZXZlcnNlSW5uZXJPcmRlcihsYXllcmluZykge1xuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLnJldmVyc2UoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdpZHRoKGcsIHUpIHtcbiAgICBzd2l0Y2ggKGcuZ3JhcGgoKS5yYW5rRGlyKSB7XG4gICAgICBjYXNlICdMUic6IHJldHVybiBnLm5vZGUodSkuaGVpZ2h0O1xuICAgICAgY2FzZSAnUkwnOiByZXR1cm4gZy5ub2RlKHUpLmhlaWdodDtcbiAgICAgIGRlZmF1bHQ6ICAgcmV0dXJuIGcubm9kZSh1KS53aWR0aDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoZWlnaHQoZywgdSkge1xuICAgIHN3aXRjaChnLmdyYXBoKCkucmFua0Rpcikge1xuICAgICAgY2FzZSAnTFInOiByZXR1cm4gZy5ub2RlKHUpLndpZHRoO1xuICAgICAgY2FzZSAnUkwnOiByZXR1cm4gZy5ub2RlKHUpLndpZHRoO1xuICAgICAgZGVmYXVsdDogICByZXR1cm4gZy5ub2RlKHUpLmhlaWdodDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzZXAoZywgdSkge1xuICAgIGlmIChjb25maWcudW5pdmVyc2FsU2VwICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gY29uZmlnLnVuaXZlcnNhbFNlcDtcbiAgICB9XG4gICAgdmFyIHcgPSB3aWR0aChnLCB1KTtcbiAgICB2YXIgcyA9IGcubm9kZSh1KS5kdW1teSA/IGNvbmZpZy5lZGdlU2VwIDogY29uZmlnLm5vZGVTZXA7XG4gICAgcmV0dXJuICh3ICsgcykgLyAyO1xuICB9XG5cbiAgZnVuY3Rpb24gcG9zWChnLCB1LCB4KSB7XG4gICAgaWYgKGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnTFInIHx8IGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnUkwnKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KS55O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpLnkgPSB4O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KS54O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpLnggPSB4O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc1hEZWJ1ZyhuYW1lLCBnLCB1LCB4KSB7XG4gICAgaWYgKGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnTFInIHx8IGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnUkwnKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KVtuYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KVtuYW1lXSA9IHg7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpW25hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpW25hbWVdID0geDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwb3NZKGcsIHUsIHkpIHtcbiAgICBpZiAoZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdMUicgfHwgZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdSTCcpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpLng7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSkueCA9IHk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpLnk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSkueSA9IHk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVidWdQb3NpdGlvbmluZyhhbGlnbiwgZywgbGF5ZXJpbmcsIHhzKSB7XG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsLCBsaSkge1xuICAgICAgdmFyIHUsIHhVO1xuICAgICAgbC5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdmFyIHhWID0geHNbdl07XG4gICAgICAgIGlmICh1KSB7XG4gICAgICAgICAgdmFyIHMgPSBzZXAoZywgdSkgKyBzZXAoZywgdik7XG4gICAgICAgICAgaWYgKHhWIC0geFUgPCBzKVxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1Bvc2l0aW9uIHBoYXNlOiBzZXAgdmlvbGF0aW9uLiBBbGlnbjogJyArIGFsaWduICsgJy4gTGF5ZXI6ICcgKyBsaSArICcuICcgK1xuICAgICAgICAgICAgICAnVTogJyArIHUgKyAnIFY6ICcgKyB2ICsgJy4gQWN0dWFsIHNlcDogJyArICh4ViAtIHhVKSArICcgRXhwZWN0ZWQgc2VwOiAnICsgcyk7XG4gICAgICAgIH1cbiAgICAgICAgdSA9IHY7XG4gICAgICAgIHhVID0geFY7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgYWN5Y2xpYyA9IHJlcXVpcmUoJy4vcmFuay9hY3ljbGljJyksXG4gICAgaW5pdFJhbmsgPSByZXF1aXJlKCcuL3JhbmsvaW5pdFJhbmsnKSxcbiAgICBmZWFzaWJsZVRyZWUgPSByZXF1aXJlKCcuL3JhbmsvZmVhc2libGVUcmVlJyksXG4gICAgY29uc3RyYWludHMgPSByZXF1aXJlKCcuL3JhbmsvY29uc3RyYWludHMnKSxcbiAgICBzaW1wbGV4ID0gcmVxdWlyZSgnLi9yYW5rL3NpbXBsZXgnKSxcbiAgICBjb21wb25lbnRzID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5hbGcuY29tcG9uZW50cyxcbiAgICBmaWx0ZXIgPSByZXF1aXJlKCdncmFwaGxpYicpLmZpbHRlcjtcblxuZXhwb3J0cy5ydW4gPSBydW47XG5leHBvcnRzLnJlc3RvcmVFZGdlcyA9IHJlc3RvcmVFZGdlcztcblxuLypcbiAqIEhldXJpc3RpYyBmdW5jdGlvbiB0aGF0IGFzc2lnbnMgYSByYW5rIHRvIGVhY2ggbm9kZSBvZiB0aGUgaW5wdXQgZ3JhcGggd2l0aFxuICogdGhlIGludGVudCBvZiBtaW5pbWl6aW5nIGVkZ2UgbGVuZ3Rocywgd2hpbGUgcmVzcGVjdGluZyB0aGUgYG1pbkxlbmBcbiAqIGF0dHJpYnV0ZSBvZiBpbmNpZGVudCBlZGdlcy5cbiAqXG4gKiBQcmVyZXF1aXNpdGVzOlxuICpcbiAqICAqIEVhY2ggZWRnZSBpbiB0aGUgaW5wdXQgZ3JhcGggbXVzdCBoYXZlIGFuIGFzc2lnbmVkICdtaW5MZW4nIGF0dHJpYnV0ZVxuICovXG5mdW5jdGlvbiBydW4oZywgdXNlU2ltcGxleCkge1xuICBleHBhbmRTZWxmTG9vcHMoZyk7XG5cbiAgLy8gSWYgdGhlcmUgYXJlIHJhbmsgY29uc3RyYWludHMgb24gbm9kZXMsIHRoZW4gYnVpbGQgYSBuZXcgZ3JhcGggdGhhdFxuICAvLyBlbmNvZGVzIHRoZSBjb25zdHJhaW50cy5cbiAgdXRpbC50aW1lKCdjb25zdHJhaW50cy5hcHBseScsIGNvbnN0cmFpbnRzLmFwcGx5KShnKTtcblxuICBleHBhbmRTaWRld2F5c0VkZ2VzKGcpO1xuXG4gIC8vIFJldmVyc2UgZWRnZXMgdG8gZ2V0IGFuIGFjeWNsaWMgZ3JhcGgsIHdlIGtlZXAgdGhlIGdyYXBoIGluIGFuIGFjeWNsaWNcbiAgLy8gc3RhdGUgdW50aWwgdGhlIHZlcnkgZW5kLlxuICB1dGlsLnRpbWUoJ2FjeWNsaWMnLCBhY3ljbGljKShnKTtcblxuICAvLyBDb252ZXJ0IHRoZSBncmFwaCBpbnRvIGEgZmxhdCBncmFwaCBmb3IgcmFua2luZ1xuICB2YXIgZmxhdEdyYXBoID0gZy5maWx0ZXJOb2Rlcyh1dGlsLmZpbHRlck5vblN1YmdyYXBocyhnKSk7XG5cbiAgLy8gQXNzaWduIGFuIGluaXRpYWwgcmFua2luZyB1c2luZyBERlMuXG4gIGluaXRSYW5rKGZsYXRHcmFwaCk7XG5cbiAgLy8gRm9yIGVhY2ggY29tcG9uZW50IGltcHJvdmUgdGhlIGFzc2lnbmVkIHJhbmtzLlxuICBjb21wb25lbnRzKGZsYXRHcmFwaCkuZm9yRWFjaChmdW5jdGlvbihjbXB0KSB7XG4gICAgdmFyIHN1YmdyYXBoID0gZmxhdEdyYXBoLmZpbHRlck5vZGVzKGZpbHRlci5ub2Rlc0Zyb21MaXN0KGNtcHQpKTtcbiAgICByYW5rQ29tcG9uZW50KHN1YmdyYXBoLCB1c2VTaW1wbGV4KTtcbiAgfSk7XG5cbiAgLy8gUmVsYXggb3JpZ2luYWwgY29uc3RyYWludHNcbiAgdXRpbC50aW1lKCdjb25zdHJhaW50cy5yZWxheCcsIGNvbnN0cmFpbnRzLnJlbGF4KGcpKTtcblxuICAvLyBXaGVuIGhhbmRsaW5nIG5vZGVzIHdpdGggY29uc3RyYWluZWQgcmFua3MgaXQgaXMgcG9zc2libGUgdG8gZW5kIHVwIHdpdGhcbiAgLy8gZWRnZXMgdGhhdCBwb2ludCB0byBwcmV2aW91cyByYW5rcy4gTW9zdCBvZiB0aGUgc3Vic2VxdWVudCBhbGdvcml0aG1zIGFzc3VtZVxuICAvLyB0aGF0IGVkZ2VzIGFyZSBwb2ludGluZyB0byBzdWNjZXNzaXZlIHJhbmtzIG9ubHkuIEhlcmUgd2UgcmV2ZXJzZSBhbnkgXCJiYWNrXG4gIC8vIGVkZ2VzXCIgYW5kIG1hcmsgdGhlbSBhcyBzdWNoLiBUaGUgYWN5Y2xpYyBhbGdvcml0aG0gd2lsbCByZXZlcnNlIHRoZW0gYXMgYVxuICAvLyBwb3N0IHByb2Nlc3Npbmcgc3RlcC5cbiAgdXRpbC50aW1lKCdyZW9yaWVudEVkZ2VzJywgcmVvcmllbnRFZGdlcykoZyk7XG59XG5cbmZ1bmN0aW9uIHJlc3RvcmVFZGdlcyhnKSB7XG4gIGFjeWNsaWMudW5kbyhnKTtcbn1cblxuLypcbiAqIEV4cGFuZCBzZWxmIGxvb3BzIGludG8gdGhyZWUgZHVtbXkgbm9kZXMuIE9uZSB3aWxsIHNpdCBhYm92ZSB0aGUgaW5jaWRlbnRcbiAqIG5vZGUsIG9uZSB3aWxsIGJlIGF0IHRoZSBzYW1lIGxldmVsLCBhbmQgb25lIGJlbG93LiBUaGUgcmVzdWx0IGxvb2tzIGxpa2U6XG4gKlxuICogICAgICAgICAvLS08LS14LS0tPi0tXFxcbiAqICAgICBub2RlICAgICAgICAgICAgICB5XG4gKiAgICAgICAgIFxcLS08LS16LS0tPi0tL1xuICpcbiAqIER1bW15IG5vZGVzIHgsIHksIHogZ2l2ZSB1cyB0aGUgc2hhcGUgb2YgYSBsb29wIGFuZCBub2RlIHkgaXMgd2hlcmUgd2UgcGxhY2VcbiAqIHRoZSBsYWJlbC5cbiAqXG4gKiBUT0RPOiBjb25zb2xpZGF0ZSBrbm93bGVkZ2Ugb2YgZHVtbXkgbm9kZSBjb25zdHJ1Y3Rpb24uXG4gKiBUT0RPOiBzdXBwb3J0IG1pbkxlbiA9IDJcbiAqL1xuZnVuY3Rpb24gZXhwYW5kU2VsZkxvb3BzKGcpIHtcbiAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCBhKSB7XG4gICAgaWYgKHUgPT09IHYpIHtcbiAgICAgIHZhciB4ID0gYWRkRHVtbXlOb2RlKGcsIGUsIHUsIHYsIGEsIDAsIGZhbHNlKSxcbiAgICAgICAgICB5ID0gYWRkRHVtbXlOb2RlKGcsIGUsIHUsIHYsIGEsIDEsIHRydWUpLFxuICAgICAgICAgIHogPSBhZGREdW1teU5vZGUoZywgZSwgdSwgdiwgYSwgMiwgZmFsc2UpO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHgsIHUsIHttaW5MZW46IDEsIHNlbGZMb29wOiB0cnVlfSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgeCwgeSwge21pbkxlbjogMSwgc2VsZkxvb3A6IHRydWV9KTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB6LCB7bWluTGVuOiAxLCBzZWxmTG9vcDogdHJ1ZX0pO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHksIHosIHttaW5MZW46IDEsIHNlbGZMb29wOiB0cnVlfSk7XG4gICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gZXhwYW5kU2lkZXdheXNFZGdlcyhnKSB7XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgYSkge1xuICAgIGlmICh1ID09PSB2KSB7XG4gICAgICB2YXIgb3JpZ0VkZ2UgPSBhLm9yaWdpbmFsRWRnZSxcbiAgICAgICAgICBkdW1teSA9IGFkZER1bW15Tm9kZShnLCBvcmlnRWRnZS5lLCBvcmlnRWRnZS51LCBvcmlnRWRnZS52LCBvcmlnRWRnZS52YWx1ZSwgMCwgdHJ1ZSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgZHVtbXksIHttaW5MZW46IDF9KTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCBkdW1teSwgdiwge21pbkxlbjogMX0pO1xuICAgICAgZy5kZWxFZGdlKGUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGFkZER1bW15Tm9kZShnLCBlLCB1LCB2LCBhLCBpbmRleCwgaXNMYWJlbCkge1xuICByZXR1cm4gZy5hZGROb2RlKG51bGwsIHtcbiAgICB3aWR0aDogaXNMYWJlbCA/IGEud2lkdGggOiAwLFxuICAgIGhlaWdodDogaXNMYWJlbCA/IGEuaGVpZ2h0IDogMCxcbiAgICBlZGdlOiB7IGlkOiBlLCBzb3VyY2U6IHUsIHRhcmdldDogdiwgYXR0cnM6IGEgfSxcbiAgICBkdW1teTogdHJ1ZSxcbiAgICBpbmRleDogaW5kZXhcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlb3JpZW50RWRnZXMoZykge1xuICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgaWYgKGcubm9kZSh1KS5yYW5rID4gZy5ub2RlKHYpLnJhbmspIHtcbiAgICAgIGcuZGVsRWRnZShlKTtcbiAgICAgIHZhbHVlLnJldmVyc2VkID0gdHJ1ZTtcbiAgICAgIGcuYWRkRWRnZShlLCB2LCB1LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmFua0NvbXBvbmVudChzdWJncmFwaCwgdXNlU2ltcGxleCkge1xuICB2YXIgc3Bhbm5pbmdUcmVlID0gZmVhc2libGVUcmVlKHN1YmdyYXBoKTtcblxuICBpZiAodXNlU2ltcGxleCkge1xuICAgIHV0aWwubG9nKDEsICdVc2luZyBuZXR3b3JrIHNpbXBsZXggZm9yIHJhbmtpbmcnKTtcbiAgICBzaW1wbGV4KHN1YmdyYXBoLCBzcGFubmluZ1RyZWUpO1xuICB9XG4gIG5vcm1hbGl6ZShzdWJncmFwaCk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZShnKSB7XG4gIHZhciBtID0gdXRpbC5taW4oZy5ub2RlcygpLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBnLm5vZGUodSkucmFuazsgfSkpO1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIG5vZGUpIHsgbm9kZS5yYW5rIC09IG07IH0pO1xufVxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gYWN5Y2xpYztcbm1vZHVsZS5leHBvcnRzLnVuZG8gPSB1bmRvO1xuXG4vKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhIGRpcmVjdGVkIGdyYXBoIHRoYXQgbWF5IGhhdmUgY3ljbGVzIGFuZCByZXZlcnNlcyBlZGdlc1xuICogYXMgYXBwcm9wcmlhdGUgdG8gYnJlYWsgdGhlc2UgY3ljbGVzLiBFYWNoIHJldmVyc2VkIGVkZ2UgaXMgYXNzaWduZWQgYVxuICogYHJldmVyc2VkYCBhdHRyaWJ1dGUgd2l0aCB0aGUgdmFsdWUgYHRydWVgLlxuICpcbiAqIFRoZXJlIHNob3VsZCBiZSBubyBzZWxmIGxvb3BzIGluIHRoZSBncmFwaC5cbiAqL1xuZnVuY3Rpb24gYWN5Y2xpYyhnKSB7XG4gIHZhciBvblN0YWNrID0ge30sXG4gICAgICB2aXNpdGVkID0ge30sXG4gICAgICByZXZlcnNlQ291bnQgPSAwO1xuICBcbiAgZnVuY3Rpb24gZGZzKHUpIHtcbiAgICBpZiAodSBpbiB2aXNpdGVkKSByZXR1cm47XG4gICAgdmlzaXRlZFt1XSA9IG9uU3RhY2tbdV0gPSB0cnVlO1xuICAgIGcub3V0RWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICB2YXIgdCA9IGcudGFyZ2V0KGUpLFxuICAgICAgICAgIHZhbHVlO1xuXG4gICAgICBpZiAodSA9PT0gdCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdXYXJuaW5nOiBmb3VuZCBzZWxmIGxvb3AgXCInICsgZSArICdcIiBmb3Igbm9kZSBcIicgKyB1ICsgJ1wiJyk7XG4gICAgICB9IGVsc2UgaWYgKHQgaW4gb25TdGFjaykge1xuICAgICAgICB2YWx1ZSA9IGcuZWRnZShlKTtcbiAgICAgICAgZy5kZWxFZGdlKGUpO1xuICAgICAgICB2YWx1ZS5yZXZlcnNlZCA9IHRydWU7XG4gICAgICAgICsrcmV2ZXJzZUNvdW50O1xuICAgICAgICBnLmFkZEVkZ2UoZSwgdCwgdSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGZzKHQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVsZXRlIG9uU3RhY2tbdV07XG4gIH1cblxuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHsgZGZzKHUpOyB9KTtcblxuICB1dGlsLmxvZygyLCAnQWN5Y2xpYyBQaGFzZTogcmV2ZXJzZWQgJyArIHJldmVyc2VDb3VudCArICcgZWRnZShzKScpO1xuXG4gIHJldHVybiByZXZlcnNlQ291bnQ7XG59XG5cbi8qXG4gKiBHaXZlbiBhIGdyYXBoIHRoYXQgaGFzIGhhZCB0aGUgYWN5Y2xpYyBvcGVyYXRpb24gYXBwbGllZCwgdGhpcyBmdW5jdGlvblxuICogdW5kb2VzIHRoYXQgb3BlcmF0aW9uLiBNb3JlIHNwZWNpZmljYWxseSwgYW55IGVkZ2Ugd2l0aCB0aGUgYHJldmVyc2VkYFxuICogYXR0cmlidXRlIGlzIGFnYWluIHJldmVyc2VkIHRvIHJlc3RvcmUgdGhlIG9yaWdpbmFsIGRpcmVjdGlvbiBvZiB0aGUgZWRnZS5cbiAqL1xuZnVuY3Rpb24gdW5kbyhnKSB7XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgcywgdCwgYSkge1xuICAgIGlmIChhLnJldmVyc2VkKSB7XG4gICAgICBkZWxldGUgYS5yZXZlcnNlZDtcbiAgICAgIGcuZGVsRWRnZShlKTtcbiAgICAgIGcuYWRkRWRnZShlLCB0LCBzLCBhKTtcbiAgICB9XG4gIH0pO1xufVxuIiwiZXhwb3J0cy5hcHBseSA9IGZ1bmN0aW9uKGcpIHtcbiAgZnVuY3Rpb24gZGZzKHNnKSB7XG4gICAgdmFyIHJhbmtTZXRzID0ge307XG4gICAgZy5jaGlsZHJlbihzZykuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICBpZiAoZy5jaGlsZHJlbih1KS5sZW5ndGgpIHtcbiAgICAgICAgZGZzKHUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciB2YWx1ZSA9IGcubm9kZSh1KSxcbiAgICAgICAgICBwcmVmUmFuayA9IHZhbHVlLnByZWZSYW5rO1xuICAgICAgaWYgKHByZWZSYW5rICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKCFjaGVja1N1cHBvcnRlZFByZWZSYW5rKHByZWZSYW5rKSkgeyByZXR1cm47IH1cblxuICAgICAgICBpZiAoIShwcmVmUmFuayBpbiByYW5rU2V0cykpIHtcbiAgICAgICAgICByYW5rU2V0cy5wcmVmUmFuayA9IFt1XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByYW5rU2V0cy5wcmVmUmFuay5wdXNoKHUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5ld1UgPSByYW5rU2V0c1twcmVmUmFua107XG4gICAgICAgIGlmIChuZXdVID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBuZXdVID0gcmFua1NldHNbcHJlZlJhbmtdID0gZy5hZGROb2RlKG51bGwsIHsgb3JpZ2luYWxOb2RlczogW10gfSk7XG4gICAgICAgICAgZy5wYXJlbnQobmV3VSwgc2cpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVkaXJlY3RJbkVkZ2VzKGcsIHUsIG5ld1UsIHByZWZSYW5rID09PSAnbWluJyk7XG4gICAgICAgIHJlZGlyZWN0T3V0RWRnZXMoZywgdSwgbmV3VSwgcHJlZlJhbmsgPT09ICdtYXgnKTtcblxuICAgICAgICAvLyBTYXZlIG9yaWdpbmFsIG5vZGUgYW5kIHJlbW92ZSBpdCBmcm9tIHJlZHVjZWQgZ3JhcGhcbiAgICAgICAgZy5ub2RlKG5ld1UpLm9yaWdpbmFsTm9kZXMucHVzaCh7IHU6IHUsIHZhbHVlOiB2YWx1ZSwgcGFyZW50OiBzZyB9KTtcbiAgICAgICAgZy5kZWxOb2RlKHUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYWRkTGlnaHRFZGdlc0Zyb21NaW5Ob2RlKGcsIHNnLCByYW5rU2V0cy5taW4pO1xuICAgIGFkZExpZ2h0RWRnZXNUb01heE5vZGUoZywgc2csIHJhbmtTZXRzLm1heCk7XG4gIH1cblxuICBkZnMobnVsbCk7XG59O1xuXG5mdW5jdGlvbiBjaGVja1N1cHBvcnRlZFByZWZSYW5rKHByZWZSYW5rKSB7XG4gIGlmIChwcmVmUmFuayAhPT0gJ21pbicgJiYgcHJlZlJhbmsgIT09ICdtYXgnICYmIHByZWZSYW5rLmluZGV4T2YoJ3NhbWVfJykgIT09IDApIHtcbiAgICBjb25zb2xlLmVycm9yKCdVbnN1cHBvcnRlZCByYW5rIHR5cGU6ICcgKyBwcmVmUmFuayk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiByZWRpcmVjdEluRWRnZXMoZywgdSwgbmV3VSwgcmV2ZXJzZSkge1xuICBnLmluRWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgdmFyIG9yaWdWYWx1ZSA9IGcuZWRnZShlKSxcbiAgICAgICAgdmFsdWU7XG4gICAgaWYgKG9yaWdWYWx1ZS5vcmlnaW5hbEVkZ2UpIHtcbiAgICAgIHZhbHVlID0gb3JpZ1ZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9ICB7XG4gICAgICAgIG9yaWdpbmFsRWRnZTogeyBlOiBlLCB1OiBnLnNvdXJjZShlKSwgdjogZy50YXJnZXQoZSksIHZhbHVlOiBvcmlnVmFsdWUgfSxcbiAgICAgICAgbWluTGVuOiBnLmVkZ2UoZSkubWluTGVuXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERvIG5vdCByZXZlcnNlIGVkZ2VzIGZvciBzZWxmLWxvb3BzLlxuICAgIGlmIChvcmlnVmFsdWUuc2VsZkxvb3ApIHtcbiAgICAgIHJldmVyc2UgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAocmV2ZXJzZSkge1xuICAgICAgLy8gRW5zdXJlIHRoYXQgYWxsIGVkZ2VzIHRvIG1pbiBhcmUgcmV2ZXJzZWRcbiAgICAgIGcuYWRkRWRnZShudWxsLCBuZXdVLCBnLnNvdXJjZShlKSwgdmFsdWUpO1xuICAgICAgdmFsdWUucmV2ZXJzZWQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgZy5zb3VyY2UoZSksIG5ld1UsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZWRpcmVjdE91dEVkZ2VzKGcsIHUsIG5ld1UsIHJldmVyc2UpIHtcbiAgZy5vdXRFZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgb3JpZ1ZhbHVlID0gZy5lZGdlKGUpLFxuICAgICAgICB2YWx1ZTtcbiAgICBpZiAob3JpZ1ZhbHVlLm9yaWdpbmFsRWRnZSkge1xuICAgICAgdmFsdWUgPSBvcmlnVmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gIHtcbiAgICAgICAgb3JpZ2luYWxFZGdlOiB7IGU6IGUsIHU6IGcuc291cmNlKGUpLCB2OiBnLnRhcmdldChlKSwgdmFsdWU6IG9yaWdWYWx1ZSB9LFxuICAgICAgICBtaW5MZW46IGcuZWRnZShlKS5taW5MZW5cbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRG8gbm90IHJldmVyc2UgZWRnZXMgZm9yIHNlbGYtbG9vcHMuXG4gICAgaWYgKG9yaWdWYWx1ZS5zZWxmTG9vcCkge1xuICAgICAgcmV2ZXJzZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChyZXZlcnNlKSB7XG4gICAgICAvLyBFbnN1cmUgdGhhdCBhbGwgZWRnZXMgZnJvbSBtYXggYXJlIHJldmVyc2VkXG4gICAgICBnLmFkZEVkZ2UobnVsbCwgZy50YXJnZXQoZSksIG5ld1UsIHZhbHVlKTtcbiAgICAgIHZhbHVlLnJldmVyc2VkID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIG5ld1UsIGcudGFyZ2V0KGUpLCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gYWRkTGlnaHRFZGdlc0Zyb21NaW5Ob2RlKGcsIHNnLCBtaW5Ob2RlKSB7XG4gIGlmIChtaW5Ob2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICBnLmNoaWxkcmVuKHNnKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIC8vIFRoZSBkdW1teSBjaGVjayBlbnN1cmVzIHdlIGRvbid0IGFkZCBhbiBlZGdlIGlmIHRoZSBub2RlIGlzIGludm9sdmVkXG4gICAgICAvLyBpbiBhIHNlbGYgbG9vcCBvciBzaWRld2F5cyBlZGdlLlxuICAgICAgaWYgKHUgIT09IG1pbk5vZGUgJiYgIWcub3V0RWRnZXMobWluTm9kZSwgdSkubGVuZ3RoICYmICFnLm5vZGUodSkuZHVtbXkpIHtcbiAgICAgICAgZy5hZGRFZGdlKG51bGwsIG1pbk5vZGUsIHUsIHsgbWluTGVuOiAwIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFkZExpZ2h0RWRnZXNUb01heE5vZGUoZywgc2csIG1heE5vZGUpIHtcbiAgaWYgKG1heE5vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgIGcuY2hpbGRyZW4oc2cpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgLy8gVGhlIGR1bW15IGNoZWNrIGVuc3VyZXMgd2UgZG9uJ3QgYWRkIGFuIGVkZ2UgaWYgdGhlIG5vZGUgaXMgaW52b2x2ZWRcbiAgICAgIC8vIGluIGEgc2VsZiBsb29wIG9yIHNpZGV3YXlzIGVkZ2UuXG4gICAgICBpZiAodSAhPT0gbWF4Tm9kZSAmJiAhZy5vdXRFZGdlcyh1LCBtYXhOb2RlKS5sZW5ndGggJiYgIWcubm9kZSh1KS5kdW1teSkge1xuICAgICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgbWF4Tm9kZSwgeyBtaW5MZW46IDAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLypcbiAqIFRoaXMgZnVuY3Rpb24gXCJyZWxheGVzXCIgdGhlIGNvbnN0cmFpbnRzIGFwcGxpZWQgcHJldmlvdXNseSBieSB0aGUgXCJhcHBseVwiXG4gKiBmdW5jdGlvbi4gSXQgZXhwYW5kcyBhbnkgbm9kZXMgdGhhdCB3ZXJlIGNvbGxhcHNlZCBhbmQgYXNzaWducyB0aGUgcmFuayBvZlxuICogdGhlIGNvbGxhcHNlZCBub2RlIHRvIGVhY2ggb2YgdGhlIGV4cGFuZGVkIG5vZGVzLiBJdCBhbHNvIHJlc3RvcmVzIHRoZVxuICogb3JpZ2luYWwgZWRnZXMgYW5kIHJlbW92ZXMgYW55IGR1bW15IGVkZ2VzIHBvaW50aW5nIGF0IHRoZSBjb2xsYXBzZWQgbm9kZXMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBwcm9jZXNzIG9mIHJlbW92aW5nIGNvbGxhcHNlZCBub2RlcyBhbHNvIHJlbW92ZXMgZHVtbXkgZWRnZXNcbiAqIGF1dG9tYXRpY2FsbHkuXG4gKi9cbmV4cG9ydHMucmVsYXggPSBmdW5jdGlvbihnKSB7XG4gIC8vIFNhdmUgb3JpZ2luYWwgZWRnZXNcbiAgdmFyIG9yaWdpbmFsRWRnZXMgPSBbXTtcbiAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIHZhciBvcmlnaW5hbEVkZ2UgPSB2YWx1ZS5vcmlnaW5hbEVkZ2U7XG4gICAgaWYgKG9yaWdpbmFsRWRnZSkge1xuICAgICAgb3JpZ2luYWxFZGdlcy5wdXNoKG9yaWdpbmFsRWRnZSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBFeHBhbmQgY29sbGFwc2VkIG5vZGVzXG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB2YXIgb3JpZ2luYWxOb2RlcyA9IHZhbHVlLm9yaWdpbmFsTm9kZXM7XG4gICAgaWYgKG9yaWdpbmFsTm9kZXMpIHtcbiAgICAgIG9yaWdpbmFsTm9kZXMuZm9yRWFjaChmdW5jdGlvbihvcmlnaW5hbE5vZGUpIHtcbiAgICAgICAgb3JpZ2luYWxOb2RlLnZhbHVlLnJhbmsgPSB2YWx1ZS5yYW5rO1xuICAgICAgICBnLmFkZE5vZGUob3JpZ2luYWxOb2RlLnUsIG9yaWdpbmFsTm9kZS52YWx1ZSk7XG4gICAgICAgIGcucGFyZW50KG9yaWdpbmFsTm9kZS51LCBvcmlnaW5hbE5vZGUucGFyZW50KTtcbiAgICAgIH0pO1xuICAgICAgZy5kZWxOb2RlKHUpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gUmVzdG9yZSBvcmlnaW5hbCBlZGdlc1xuICBvcmlnaW5hbEVkZ2VzLmZvckVhY2goZnVuY3Rpb24oZWRnZSkge1xuICAgIGcuYWRkRWRnZShlZGdlLmUsIGVkZ2UudSwgZWRnZS52LCBlZGdlLnZhbHVlKTtcbiAgfSk7XG59O1xuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZSgnY3AtZGF0YScpLlNldCxcbi8qIGpzaGludCArVzA3OSAqL1xuICAgIERpZ3JhcGggPSByZXF1aXJlKCdncmFwaGxpYicpLkRpZ3JhcGgsXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmZWFzaWJsZVRyZWU7XG5cbi8qXG4gKiBHaXZlbiBhbiBhY3ljbGljIGdyYXBoIHdpdGggZWFjaCBub2RlIGFzc2lnbmVkIGEgYHJhbmtgIGF0dHJpYnV0ZSwgdGhpc1xuICogZnVuY3Rpb24gY29uc3RydWN0cyBhbmQgcmV0dXJucyBhIHNwYW5uaW5nIHRyZWUuIFRoaXMgZnVuY3Rpb24gbWF5IHJlZHVjZVxuICogdGhlIGxlbmd0aCBvZiBzb21lIGVkZ2VzIGZyb20gdGhlIGluaXRpYWwgcmFuayBhc3NpZ25tZW50IHdoaWxlIG1haW50YWluaW5nXG4gKiB0aGUgYG1pbkxlbmAgc3BlY2lmaWVkIGJ5IGVhY2ggZWRnZS5cbiAqXG4gKiBQcmVyZXF1aXNpdGVzOlxuICpcbiAqICogVGhlIGlucHV0IGdyYXBoIGlzIGFjeWNsaWNcbiAqICogRWFjaCBub2RlIGluIHRoZSBpbnB1dCBncmFwaCBoYXMgYW4gYXNzaWduZWQgYHJhbmtgIGF0dHJpYnV0ZVxuICogKiBFYWNoIGVkZ2UgaW4gdGhlIGlucHV0IGdyYXBoIGhhcyBhbiBhc3NpZ25lZCBgbWluTGVuYCBhdHRyaWJ1dGVcbiAqXG4gKiBPdXRwdXRzOlxuICpcbiAqIEEgZmVhc2libGUgc3Bhbm5pbmcgdHJlZSBmb3IgdGhlIGlucHV0IGdyYXBoIChpLmUuIGEgc3Bhbm5pbmcgdHJlZSB0aGF0XG4gKiByZXNwZWN0cyBlYWNoIGdyYXBoIGVkZ2UncyBgbWluTGVuYCBhdHRyaWJ1dGUpIHJlcHJlc2VudGVkIGFzIGEgRGlncmFwaCB3aXRoXG4gKiBhIGByb290YCBhdHRyaWJ1dGUgb24gZ3JhcGguXG4gKlxuICogTm9kZXMgaGF2ZSB0aGUgc2FtZSBpZCBhbmQgdmFsdWUgYXMgdGhhdCBpbiB0aGUgaW5wdXQgZ3JhcGguXG4gKlxuICogRWRnZXMgaW4gdGhlIHRyZWUgaGF2ZSBhcmJpdHJhcmlseSBhc3NpZ25lZCBpZHMuIFRoZSBhdHRyaWJ1dGVzIGZvciBlZGdlc1xuICogaW5jbHVkZSBgcmV2ZXJzZWRgLiBgcmV2ZXJzZWRgIGluZGljYXRlcyB0aGF0IHRoZSBlZGdlIGlzIGFcbiAqIGJhY2sgZWRnZSBpbiB0aGUgaW5wdXQgZ3JhcGguXG4gKi9cbmZ1bmN0aW9uIGZlYXNpYmxlVHJlZShnKSB7XG4gIHZhciByZW1haW5pbmcgPSBuZXcgU2V0KGcubm9kZXMoKSksXG4gICAgICB0cmVlID0gbmV3IERpZ3JhcGgoKTtcblxuICBpZiAocmVtYWluaW5nLnNpemUoKSA9PT0gMSkge1xuICAgIHZhciByb290ID0gZy5ub2RlcygpWzBdO1xuICAgIHRyZWUuYWRkTm9kZShyb290LCB7fSk7XG4gICAgdHJlZS5ncmFwaCh7IHJvb3Q6IHJvb3QgfSk7XG4gICAgcmV0dXJuIHRyZWU7XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUaWdodEVkZ2VzKHYpIHtcbiAgICB2YXIgY29udGludWVUb1NjYW4gPSB0cnVlO1xuICAgIGcucHJlZGVjZXNzb3JzKHYpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgaWYgKHJlbWFpbmluZy5oYXModSkgJiYgIXNsYWNrKGcsIHUsIHYpKSB7XG4gICAgICAgIGlmIChyZW1haW5pbmcuaGFzKHYpKSB7XG4gICAgICAgICAgdHJlZS5hZGROb2RlKHYsIHt9KTtcbiAgICAgICAgICByZW1haW5pbmcucmVtb3ZlKHYpO1xuICAgICAgICAgIHRyZWUuZ3JhcGgoeyByb290OiB2IH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJlZS5hZGROb2RlKHUsIHt9KTtcbiAgICAgICAgdHJlZS5hZGRFZGdlKG51bGwsIHUsIHYsIHsgcmV2ZXJzZWQ6IHRydWUgfSk7XG4gICAgICAgIHJlbWFpbmluZy5yZW1vdmUodSk7XG4gICAgICAgIGFkZFRpZ2h0RWRnZXModSk7XG4gICAgICAgIGNvbnRpbnVlVG9TY2FuID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBnLnN1Y2Nlc3NvcnModikuZm9yRWFjaChmdW5jdGlvbih3KSAge1xuICAgICAgaWYgKHJlbWFpbmluZy5oYXModykgJiYgIXNsYWNrKGcsIHYsIHcpKSB7XG4gICAgICAgIGlmIChyZW1haW5pbmcuaGFzKHYpKSB7XG4gICAgICAgICAgdHJlZS5hZGROb2RlKHYsIHt9KTtcbiAgICAgICAgICByZW1haW5pbmcucmVtb3ZlKHYpO1xuICAgICAgICAgIHRyZWUuZ3JhcGgoeyByb290OiB2IH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJlZS5hZGROb2RlKHcsIHt9KTtcbiAgICAgICAgdHJlZS5hZGRFZGdlKG51bGwsIHYsIHcsIHt9KTtcbiAgICAgICAgcmVtYWluaW5nLnJlbW92ZSh3KTtcbiAgICAgICAgYWRkVGlnaHRFZGdlcyh3KTtcbiAgICAgICAgY29udGludWVUb1NjYW4gPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gY29udGludWVUb1NjYW47XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVUaWdodEVkZ2UoKSB7XG4gICAgdmFyIG1pblNsYWNrID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICByZW1haW5pbmcua2V5cygpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgZy5wcmVkZWNlc3NvcnModikuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAgIGlmICghcmVtYWluaW5nLmhhcyh1KSkge1xuICAgICAgICAgIHZhciBlZGdlU2xhY2sgPSBzbGFjayhnLCB1LCB2KTtcbiAgICAgICAgICBpZiAoTWF0aC5hYnMoZWRnZVNsYWNrKSA8IE1hdGguYWJzKG1pblNsYWNrKSkge1xuICAgICAgICAgICAgbWluU2xhY2sgPSAtZWRnZVNsYWNrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGcuc3VjY2Vzc29ycyh2KS5mb3JFYWNoKGZ1bmN0aW9uKHcpIHtcbiAgICAgICAgaWYgKCFyZW1haW5pbmcuaGFzKHcpKSB7XG4gICAgICAgICAgdmFyIGVkZ2VTbGFjayA9IHNsYWNrKGcsIHYsIHcpO1xuICAgICAgICAgIGlmIChNYXRoLmFicyhlZGdlU2xhY2spIDwgTWF0aC5hYnMobWluU2xhY2spKSB7XG4gICAgICAgICAgICBtaW5TbGFjayA9IGVkZ2VTbGFjaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdHJlZS5lYWNoTm9kZShmdW5jdGlvbih1KSB7IGcubm9kZSh1KS5yYW5rIC09IG1pblNsYWNrOyB9KTtcbiAgfVxuXG4gIHdoaWxlIChyZW1haW5pbmcuc2l6ZSgpKSB7XG4gICAgdmFyIG5vZGVzVG9TZWFyY2ggPSAhdHJlZS5vcmRlcigpID8gcmVtYWluaW5nLmtleXMoKSA6IHRyZWUubm9kZXMoKTtcbiAgICBmb3IgKHZhciBpID0gMCwgaWwgPSBub2Rlc1RvU2VhcmNoLmxlbmd0aDtcbiAgICAgICAgIGkgPCBpbCAmJiBhZGRUaWdodEVkZ2VzKG5vZGVzVG9TZWFyY2hbaV0pO1xuICAgICAgICAgKytpKTtcbiAgICBpZiAocmVtYWluaW5nLnNpemUoKSkge1xuICAgICAgY3JlYXRlVGlnaHRFZGdlKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRyZWU7XG59XG5cbmZ1bmN0aW9uIHNsYWNrKGcsIHUsIHYpIHtcbiAgdmFyIHJhbmtEaWZmID0gZy5ub2RlKHYpLnJhbmsgLSBnLm5vZGUodSkucmFuaztcbiAgdmFyIG1heE1pbkxlbiA9IHV0aWwubWF4KGcub3V0RWRnZXModSwgdilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGcuZWRnZShlKS5taW5MZW47IH0pKTtcbiAgcmV0dXJuIHJhbmtEaWZmIC0gbWF4TWluTGVuO1xufVxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyksXG4gICAgdG9wc29ydCA9IHJlcXVpcmUoJ2dyYXBobGliJykuYWxnLnRvcHNvcnQ7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdFJhbms7XG5cbi8qXG4gKiBBc3NpZ25zIGEgYHJhbmtgIGF0dHJpYnV0ZSB0byBlYWNoIG5vZGUgaW4gdGhlIGlucHV0IGdyYXBoIGFuZCBlbnN1cmVzIHRoYXRcbiAqIHRoaXMgcmFuayByZXNwZWN0cyB0aGUgYG1pbkxlbmAgYXR0cmlidXRlIG9mIGluY2lkZW50IGVkZ2VzLlxuICpcbiAqIFByZXJlcXVpc2l0ZXM6XG4gKlxuICogICogVGhlIGlucHV0IGdyYXBoIG11c3QgYmUgYWN5Y2xpY1xuICogICogRWFjaCBlZGdlIGluIHRoZSBpbnB1dCBncmFwaCBtdXN0IGhhdmUgYW4gYXNzaWduZWQgJ21pbkxlbicgYXR0cmlidXRlXG4gKi9cbmZ1bmN0aW9uIGluaXRSYW5rKGcpIHtcbiAgdmFyIHNvcnRlZCA9IHRvcHNvcnQoZyk7XG5cbiAgc29ydGVkLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHZhciBpbkVkZ2VzID0gZy5pbkVkZ2VzKHUpO1xuICAgIGlmIChpbkVkZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZy5ub2RlKHUpLnJhbmsgPSAwO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBtaW5MZW5zID0gaW5FZGdlcy5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGcubm9kZShnLnNvdXJjZShlKSkucmFuayArIGcuZWRnZShlKS5taW5MZW47XG4gICAgfSk7XG4gICAgZy5ub2RlKHUpLnJhbmsgPSB1dGlsLm1heChtaW5MZW5zKTtcbiAgfSk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgc2xhY2s6IHNsYWNrXG59O1xuXG4vKlxuICogQSBoZWxwZXIgdG8gY2FsY3VsYXRlIHRoZSBzbGFjayBiZXR3ZWVuIHR3byBub2RlcyAoYHVgIGFuZCBgdmApIGdpdmVuIGFcbiAqIGBtaW5MZW5gIGNvbnN0cmFpbnQuIFRoZSBzbGFjayByZXByZXNlbnRzIGhvdyBtdWNoIHRoZSBkaXN0YW5jZSBiZXR3ZWVuIGB1YFxuICogYW5kIGB2YCBjb3VsZCBzaHJpbmsgd2hpbGUgbWFpbnRhaW5pbmcgdGhlIGBtaW5MZW5gIGNvbnN0cmFpbnQuIElmIHRoZSB2YWx1ZVxuICogaXMgbmVnYXRpdmUgdGhlbiB0aGUgY29uc3RyYWludCBpcyBjdXJyZW50bHkgdmlvbGF0ZWQuXG4gKlxuICBUaGlzIGZ1bmN0aW9uIHJlcXVpcmVzIHRoYXQgYHVgIGFuZCBgdmAgYXJlIGluIGBncmFwaGAgYW5kIHRoZXkgYm90aCBoYXZlIGFcbiAgYHJhbmtgIGF0dHJpYnV0ZS5cbiAqL1xuZnVuY3Rpb24gc2xhY2soZ3JhcGgsIHUsIHYsIG1pbkxlbikge1xuICByZXR1cm4gTWF0aC5hYnMoZ3JhcGgubm9kZSh1KS5yYW5rIC0gZ3JhcGgubm9kZSh2KS5yYW5rKSAtIG1pbkxlbjtcbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpLFxuICAgIHJhbmtVdGlsID0gcmVxdWlyZSgnLi9yYW5rVXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHNpbXBsZXg7XG5cbmZ1bmN0aW9uIHNpbXBsZXgoZ3JhcGgsIHNwYW5uaW5nVHJlZSkge1xuICAvLyBUaGUgbmV0d29yayBzaW1wbGV4IGFsZ29yaXRobSByZXBlYXRlZGx5IHJlcGxhY2VzIGVkZ2VzIG9mXG4gIC8vIHRoZSBzcGFubmluZyB0cmVlIHdpdGggbmVnYXRpdmUgY3V0IHZhbHVlcyB1bnRpbCBubyBzdWNoXG4gIC8vIGVkZ2UgZXhpc3RzLlxuICBpbml0Q3V0VmFsdWVzKGdyYXBoLCBzcGFubmluZ1RyZWUpO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIHZhciBlID0gbGVhdmVFZGdlKHNwYW5uaW5nVHJlZSk7XG4gICAgaWYgKGUgPT09IG51bGwpIGJyZWFrO1xuICAgIHZhciBmID0gZW50ZXJFZGdlKGdyYXBoLCBzcGFubmluZ1RyZWUsIGUpO1xuICAgIGV4Y2hhbmdlKGdyYXBoLCBzcGFubmluZ1RyZWUsIGUsIGYpO1xuICB9XG59XG5cbi8qXG4gKiBTZXQgdGhlIGN1dCB2YWx1ZXMgb2YgZWRnZXMgaW4gdGhlIHNwYW5uaW5nIHRyZWUgYnkgYSBkZXB0aC1maXJzdFxuICogcG9zdG9yZGVyIHRyYXZlcnNhbC4gIFRoZSBjdXQgdmFsdWUgY29ycmVzcG9uZHMgdG8gdGhlIGNvc3QsIGluXG4gKiB0ZXJtcyBvZiBhIHJhbmtpbmcncyBlZGdlIGxlbmd0aCBzdW0sIG9mIGxlbmd0aGVuaW5nIGFuIGVkZ2UuXG4gKiBOZWdhdGl2ZSBjdXQgdmFsdWVzIHR5cGljYWxseSBpbmRpY2F0ZSBlZGdlcyB0aGF0IHdvdWxkIHlpZWxkIGFcbiAqIHNtYWxsZXIgZWRnZSBsZW5ndGggc3VtIGlmIHRoZXkgd2VyZSBsZW5ndGhlbmVkLlxuICovXG5mdW5jdGlvbiBpbml0Q3V0VmFsdWVzKGdyYXBoLCBzcGFubmluZ1RyZWUpIHtcbiAgY29tcHV0ZUxvd0xpbShzcGFubmluZ1RyZWUpO1xuXG4gIHNwYW5uaW5nVHJlZS5lYWNoRWRnZShmdW5jdGlvbihpZCwgdSwgdiwgdHJlZVZhbHVlKSB7XG4gICAgdHJlZVZhbHVlLmN1dFZhbHVlID0gMDtcbiAgfSk7XG5cbiAgLy8gUHJvcGFnYXRlIGN1dCB2YWx1ZXMgdXAgdGhlIHRyZWUuXG4gIGZ1bmN0aW9uIGRmcyhuKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gc3Bhbm5pbmdUcmVlLnN1Y2Nlc3NvcnMobik7XG4gICAgZm9yICh2YXIgYyBpbiBjaGlsZHJlbikge1xuICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bY107XG4gICAgICBkZnMoY2hpbGQpO1xuICAgIH1cbiAgICBpZiAobiAhPT0gc3Bhbm5pbmdUcmVlLmdyYXBoKCkucm9vdCkge1xuICAgICAgc2V0Q3V0VmFsdWUoZ3JhcGgsIHNwYW5uaW5nVHJlZSwgbik7XG4gICAgfVxuICB9XG4gIGRmcyhzcGFubmluZ1RyZWUuZ3JhcGgoKS5yb290KTtcbn1cblxuLypcbiAqIFBlcmZvcm0gYSBERlMgcG9zdG9yZGVyIHRyYXZlcnNhbCwgbGFiZWxpbmcgZWFjaCBub2RlIHYgd2l0aFxuICogaXRzIHRyYXZlcnNhbCBvcmRlciAnbGltKHYpJyBhbmQgdGhlIG1pbmltdW0gdHJhdmVyc2FsIG51bWJlclxuICogb2YgYW55IG9mIGl0cyBkZXNjZW5kYW50cyAnbG93KHYpJy4gIFRoaXMgcHJvdmlkZXMgYW4gZWZmaWNpZW50XG4gKiB3YXkgdG8gdGVzdCB3aGV0aGVyIHUgaXMgYW4gYW5jZXN0b3Igb2YgdiBzaW5jZVxuICogbG93KHUpIDw9IGxpbSh2KSA8PSBsaW0odSkgaWYgYW5kIG9ubHkgaWYgdSBpcyBhbiBhbmNlc3Rvci5cbiAqL1xuZnVuY3Rpb24gY29tcHV0ZUxvd0xpbSh0cmVlKSB7XG4gIHZhciBwb3N0T3JkZXJOdW0gPSAwO1xuICBcbiAgZnVuY3Rpb24gZGZzKG4pIHtcbiAgICB2YXIgY2hpbGRyZW4gPSB0cmVlLnN1Y2Nlc3NvcnMobik7XG4gICAgdmFyIGxvdyA9IHBvc3RPcmRlck51bTtcbiAgICBmb3IgKHZhciBjIGluIGNoaWxkcmVuKSB7XG4gICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltjXTtcbiAgICAgIGRmcyhjaGlsZCk7XG4gICAgICBsb3cgPSBNYXRoLm1pbihsb3csIHRyZWUubm9kZShjaGlsZCkubG93KTtcbiAgICB9XG4gICAgdHJlZS5ub2RlKG4pLmxvdyA9IGxvdztcbiAgICB0cmVlLm5vZGUobikubGltID0gcG9zdE9yZGVyTnVtKys7XG4gIH1cblxuICBkZnModHJlZS5ncmFwaCgpLnJvb3QpO1xufVxuXG4vKlxuICogVG8gY29tcHV0ZSB0aGUgY3V0IHZhbHVlIG9mIHRoZSBlZGdlIHBhcmVudCAtPiBjaGlsZCwgd2UgY29uc2lkZXJcbiAqIGl0IGFuZCBhbnkgb3RoZXIgZ3JhcGggZWRnZXMgdG8gb3IgZnJvbSB0aGUgY2hpbGQuXG4gKiAgICAgICAgICBwYXJlbnRcbiAqICAgICAgICAgICAgIHxcbiAqICAgICAgICAgICBjaGlsZFxuICogICAgICAgICAgLyAgICAgIFxcXG4gKiAgICAgICAgIHUgICAgICAgIHZcbiAqL1xuZnVuY3Rpb24gc2V0Q3V0VmFsdWUoZ3JhcGgsIHRyZWUsIGNoaWxkKSB7XG4gIHZhciBwYXJlbnRFZGdlID0gdHJlZS5pbkVkZ2VzKGNoaWxkKVswXTtcblxuICAvLyBMaXN0IG9mIGNoaWxkJ3MgY2hpbGRyZW4gaW4gdGhlIHNwYW5uaW5nIHRyZWUuXG4gIHZhciBncmFuZGNoaWxkcmVuID0gW107XG4gIHZhciBncmFuZGNoaWxkRWRnZXMgPSB0cmVlLm91dEVkZ2VzKGNoaWxkKTtcbiAgZm9yICh2YXIgZ2NlIGluIGdyYW5kY2hpbGRFZGdlcykge1xuICAgIGdyYW5kY2hpbGRyZW4ucHVzaCh0cmVlLnRhcmdldChncmFuZGNoaWxkRWRnZXNbZ2NlXSkpO1xuICB9XG5cbiAgdmFyIGN1dFZhbHVlID0gMDtcblxuICAvLyBUT0RPOiBSZXBsYWNlIHVuaXQgaW5jcmVtZW50L2RlY3JlbWVudCB3aXRoIGVkZ2Ugd2VpZ2h0cy5cbiAgdmFyIEUgPSAwOyAgICAvLyBFZGdlcyBmcm9tIGNoaWxkIHRvIGdyYW5kY2hpbGQncyBzdWJ0cmVlLlxuICB2YXIgRiA9IDA7ICAgIC8vIEVkZ2VzIHRvIGNoaWxkIGZyb20gZ3JhbmRjaGlsZCdzIHN1YnRyZWUuXG4gIHZhciBHID0gMDsgICAgLy8gRWRnZXMgZnJvbSBjaGlsZCB0byBub2RlcyBvdXRzaWRlIG9mIGNoaWxkJ3Mgc3VidHJlZS5cbiAgdmFyIEggPSAwOyAgICAvLyBFZGdlcyBmcm9tIG5vZGVzIG91dHNpZGUgb2YgY2hpbGQncyBzdWJ0cmVlIHRvIGNoaWxkLlxuXG4gIC8vIENvbnNpZGVyIGFsbCBncmFwaCBlZGdlcyBmcm9tIGNoaWxkLlxuICB2YXIgb3V0RWRnZXMgPSBncmFwaC5vdXRFZGdlcyhjaGlsZCk7XG4gIHZhciBnYztcbiAgZm9yICh2YXIgb2UgaW4gb3V0RWRnZXMpIHtcbiAgICB2YXIgc3VjYyA9IGdyYXBoLnRhcmdldChvdXRFZGdlc1tvZV0pO1xuICAgIGZvciAoZ2MgaW4gZ3JhbmRjaGlsZHJlbikge1xuICAgICAgaWYgKGluU3VidHJlZSh0cmVlLCBzdWNjLCBncmFuZGNoaWxkcmVuW2djXSkpIHtcbiAgICAgICAgRSsrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWluU3VidHJlZSh0cmVlLCBzdWNjLCBjaGlsZCkpIHtcbiAgICAgIEcrKztcbiAgICB9XG4gIH1cblxuICAvLyBDb25zaWRlciBhbGwgZ3JhcGggZWRnZXMgdG8gY2hpbGQuXG4gIHZhciBpbkVkZ2VzID0gZ3JhcGguaW5FZGdlcyhjaGlsZCk7XG4gIGZvciAodmFyIGllIGluIGluRWRnZXMpIHtcbiAgICB2YXIgcHJlZCA9IGdyYXBoLnNvdXJjZShpbkVkZ2VzW2llXSk7XG4gICAgZm9yIChnYyBpbiBncmFuZGNoaWxkcmVuKSB7XG4gICAgICBpZiAoaW5TdWJ0cmVlKHRyZWUsIHByZWQsIGdyYW5kY2hpbGRyZW5bZ2NdKSkge1xuICAgICAgICBGKys7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghaW5TdWJ0cmVlKHRyZWUsIHByZWQsIGNoaWxkKSkge1xuICAgICAgSCsrO1xuICAgIH1cbiAgfVxuXG4gIC8vIENvbnRyaWJ1dGlvbnMgZGVwZW5kIG9uIHRoZSBhbGlnbm1lbnQgb2YgdGhlIHBhcmVudCAtPiBjaGlsZCBlZGdlXG4gIC8vIGFuZCB0aGUgY2hpbGQgLT4gdSBvciB2IGVkZ2VzLlxuICB2YXIgZ3JhbmRjaGlsZEN1dFN1bSA9IDA7XG4gIGZvciAoZ2MgaW4gZ3JhbmRjaGlsZHJlbikge1xuICAgIHZhciBjdiA9IHRyZWUuZWRnZShncmFuZGNoaWxkRWRnZXNbZ2NdKS5jdXRWYWx1ZTtcbiAgICBpZiAoIXRyZWUuZWRnZShncmFuZGNoaWxkRWRnZXNbZ2NdKS5yZXZlcnNlZCkge1xuICAgICAgZ3JhbmRjaGlsZEN1dFN1bSArPSBjdjtcbiAgICB9IGVsc2Uge1xuICAgICAgZ3JhbmRjaGlsZEN1dFN1bSAtPSBjdjtcbiAgICB9XG4gIH1cblxuICBpZiAoIXRyZWUuZWRnZShwYXJlbnRFZGdlKS5yZXZlcnNlZCkge1xuICAgIGN1dFZhbHVlICs9IGdyYW5kY2hpbGRDdXRTdW0gLSBFICsgRiAtIEcgKyBIO1xuICB9IGVsc2Uge1xuICAgIGN1dFZhbHVlIC09IGdyYW5kY2hpbGRDdXRTdW0gLSBFICsgRiAtIEcgKyBIO1xuICB9XG5cbiAgdHJlZS5lZGdlKHBhcmVudEVkZ2UpLmN1dFZhbHVlID0gY3V0VmFsdWU7XG59XG5cbi8qXG4gKiBSZXR1cm4gd2hldGhlciBuIGlzIGEgbm9kZSBpbiB0aGUgc3VidHJlZSB3aXRoIHRoZSBnaXZlblxuICogcm9vdC5cbiAqL1xuZnVuY3Rpb24gaW5TdWJ0cmVlKHRyZWUsIG4sIHJvb3QpIHtcbiAgcmV0dXJuICh0cmVlLm5vZGUocm9vdCkubG93IDw9IHRyZWUubm9kZShuKS5saW0gJiZcbiAgICAgICAgICB0cmVlLm5vZGUobikubGltIDw9IHRyZWUubm9kZShyb290KS5saW0pO1xufVxuXG4vKlxuICogUmV0dXJuIGFuIGVkZ2UgZnJvbSB0aGUgdHJlZSB3aXRoIGEgbmVnYXRpdmUgY3V0IHZhbHVlLCBvciBudWxsIGlmIHRoZXJlXG4gKiBpcyBub25lLlxuICovXG5mdW5jdGlvbiBsZWF2ZUVkZ2UodHJlZSkge1xuICB2YXIgZWRnZXMgPSB0cmVlLmVkZ2VzKCk7XG4gIGZvciAodmFyIG4gaW4gZWRnZXMpIHtcbiAgICB2YXIgZSA9IGVkZ2VzW25dO1xuICAgIHZhciB0cmVlVmFsdWUgPSB0cmVlLmVkZ2UoZSk7XG4gICAgaWYgKHRyZWVWYWx1ZS5jdXRWYWx1ZSA8IDApIHtcbiAgICAgIHJldHVybiBlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLypcbiAqIFRoZSBlZGdlIGUgc2hvdWxkIGJlIGFuIGVkZ2UgaW4gdGhlIHRyZWUsIHdpdGggYW4gdW5kZXJseWluZyBlZGdlXG4gKiBpbiB0aGUgZ3JhcGgsIHdpdGggYSBuZWdhdGl2ZSBjdXQgdmFsdWUuICBPZiB0aGUgdHdvIG5vZGVzIGluY2lkZW50XG4gKiBvbiB0aGUgZWRnZSwgdGFrZSB0aGUgbG93ZXIgb25lLiAgZW50ZXJFZGdlIHJldHVybnMgYW4gZWRnZSB3aXRoXG4gKiBtaW5pbXVtIHNsYWNrIGdvaW5nIGZyb20gb3V0c2lkZSBvZiB0aGF0IG5vZGUncyBzdWJ0cmVlIHRvIGluc2lkZVxuICogb2YgdGhhdCBub2RlJ3Mgc3VidHJlZS5cbiAqL1xuZnVuY3Rpb24gZW50ZXJFZGdlKGdyYXBoLCB0cmVlLCBlKSB7XG4gIHZhciBzb3VyY2UgPSB0cmVlLnNvdXJjZShlKTtcbiAgdmFyIHRhcmdldCA9IHRyZWUudGFyZ2V0KGUpO1xuICB2YXIgbG93ZXIgPSB0cmVlLm5vZGUodGFyZ2V0KS5saW0gPCB0cmVlLm5vZGUoc291cmNlKS5saW0gPyB0YXJnZXQgOiBzb3VyY2U7XG5cbiAgLy8gSXMgdGhlIHRyZWUgZWRnZSBhbGlnbmVkIHdpdGggdGhlIGdyYXBoIGVkZ2U/XG4gIHZhciBhbGlnbmVkID0gIXRyZWUuZWRnZShlKS5yZXZlcnNlZDtcblxuICB2YXIgbWluU2xhY2sgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gIHZhciBtaW5TbGFja0VkZ2U7XG4gIGlmIChhbGlnbmVkKSB7XG4gICAgZ3JhcGguZWFjaEVkZ2UoZnVuY3Rpb24oaWQsIHUsIHYsIHZhbHVlKSB7XG4gICAgICBpZiAoaWQgIT09IGUgJiYgaW5TdWJ0cmVlKHRyZWUsIHUsIGxvd2VyKSAmJiAhaW5TdWJ0cmVlKHRyZWUsIHYsIGxvd2VyKSkge1xuICAgICAgICB2YXIgc2xhY2sgPSByYW5rVXRpbC5zbGFjayhncmFwaCwgdSwgdiwgdmFsdWUubWluTGVuKTtcbiAgICAgICAgaWYgKHNsYWNrIDwgbWluU2xhY2spIHtcbiAgICAgICAgICBtaW5TbGFjayA9IHNsYWNrO1xuICAgICAgICAgIG1pblNsYWNrRWRnZSA9IGlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgZ3JhcGguZWFjaEVkZ2UoZnVuY3Rpb24oaWQsIHUsIHYsIHZhbHVlKSB7XG4gICAgICBpZiAoaWQgIT09IGUgJiYgIWluU3VidHJlZSh0cmVlLCB1LCBsb3dlcikgJiYgaW5TdWJ0cmVlKHRyZWUsIHYsIGxvd2VyKSkge1xuICAgICAgICB2YXIgc2xhY2sgPSByYW5rVXRpbC5zbGFjayhncmFwaCwgdSwgdiwgdmFsdWUubWluTGVuKTtcbiAgICAgICAgaWYgKHNsYWNrIDwgbWluU2xhY2spIHtcbiAgICAgICAgICBtaW5TbGFjayA9IHNsYWNrO1xuICAgICAgICAgIG1pblNsYWNrRWRnZSA9IGlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAobWluU2xhY2tFZGdlID09PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgb3V0c2lkZSA9IFtdO1xuICAgIHZhciBpbnNpZGUgPSBbXTtcbiAgICBncmFwaC5lYWNoTm9kZShmdW5jdGlvbihpZCkge1xuICAgICAgaWYgKCFpblN1YnRyZWUodHJlZSwgaWQsIGxvd2VyKSkge1xuICAgICAgICBvdXRzaWRlLnB1c2goaWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5zaWRlLnB1c2goaWQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRocm93IG5ldyBFcnJvcignTm8gZWRnZSBmb3VuZCBmcm9tIG91dHNpZGUgb2YgdHJlZSB0byBpbnNpZGUnKTtcbiAgfVxuXG4gIHJldHVybiBtaW5TbGFja0VkZ2U7XG59XG5cbi8qXG4gKiBSZXBsYWNlIGVkZ2UgZSB3aXRoIGVkZ2UgZiBpbiB0aGUgdHJlZSwgcmVjYWxjdWxhdGluZyB0aGUgdHJlZSByb290LFxuICogdGhlIG5vZGVzJyBsb3cgYW5kIGxpbSBwcm9wZXJ0aWVzIGFuZCB0aGUgZWRnZXMnIGN1dCB2YWx1ZXMuXG4gKi9cbmZ1bmN0aW9uIGV4Y2hhbmdlKGdyYXBoLCB0cmVlLCBlLCBmKSB7XG4gIHRyZWUuZGVsRWRnZShlKTtcbiAgdmFyIHNvdXJjZSA9IGdyYXBoLnNvdXJjZShmKTtcbiAgdmFyIHRhcmdldCA9IGdyYXBoLnRhcmdldChmKTtcblxuICAvLyBSZWRpcmVjdCBlZGdlcyBzbyB0aGF0IHRhcmdldCBpcyB0aGUgcm9vdCBvZiBpdHMgc3VidHJlZS5cbiAgZnVuY3Rpb24gcmVkaXJlY3Qodikge1xuICAgIHZhciBlZGdlcyA9IHRyZWUuaW5FZGdlcyh2KTtcbiAgICBmb3IgKHZhciBpIGluIGVkZ2VzKSB7XG4gICAgICB2YXIgZSA9IGVkZ2VzW2ldO1xuICAgICAgdmFyIHUgPSB0cmVlLnNvdXJjZShlKTtcbiAgICAgIHZhciB2YWx1ZSA9IHRyZWUuZWRnZShlKTtcbiAgICAgIHJlZGlyZWN0KHUpO1xuICAgICAgdHJlZS5kZWxFZGdlKGUpO1xuICAgICAgdmFsdWUucmV2ZXJzZWQgPSAhdmFsdWUucmV2ZXJzZWQ7XG4gICAgICB0cmVlLmFkZEVkZ2UoZSwgdiwgdSwgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHJlZGlyZWN0KHRhcmdldCk7XG5cbiAgdmFyIHJvb3QgPSBzb3VyY2U7XG4gIHZhciBlZGdlcyA9IHRyZWUuaW5FZGdlcyhyb290KTtcbiAgd2hpbGUgKGVkZ2VzLmxlbmd0aCA+IDApIHtcbiAgICByb290ID0gdHJlZS5zb3VyY2UoZWRnZXNbMF0pO1xuICAgIGVkZ2VzID0gdHJlZS5pbkVkZ2VzKHJvb3QpO1xuICB9XG5cbiAgdHJlZS5ncmFwaCgpLnJvb3QgPSByb290O1xuXG4gIHRyZWUuYWRkRWRnZShudWxsLCBzb3VyY2UsIHRhcmdldCwge2N1dFZhbHVlOiAwfSk7XG5cbiAgaW5pdEN1dFZhbHVlcyhncmFwaCwgdHJlZSk7XG5cbiAgYWRqdXN0UmFua3MoZ3JhcGgsIHRyZWUpO1xufVxuXG4vKlxuICogUmVzZXQgdGhlIHJhbmtzIG9mIGFsbCBub2RlcyBiYXNlZCBvbiB0aGUgY3VycmVudCBzcGFubmluZyB0cmVlLlxuICogVGhlIHJhbmsgb2YgdGhlIHRyZWUncyByb290IHJlbWFpbnMgdW5jaGFuZ2VkLCB3aGlsZSBhbGwgb3RoZXJcbiAqIG5vZGVzIGFyZSBzZXQgdG8gdGhlIHN1bSBvZiBtaW5pbXVtIGxlbmd0aCBjb25zdHJhaW50cyBhbG9uZ1xuICogdGhlIHBhdGggZnJvbSB0aGUgcm9vdC5cbiAqL1xuZnVuY3Rpb24gYWRqdXN0UmFua3MoZ3JhcGgsIHRyZWUpIHtcbiAgZnVuY3Rpb24gZGZzKHApIHtcbiAgICB2YXIgY2hpbGRyZW4gPSB0cmVlLnN1Y2Nlc3NvcnMocCk7XG4gICAgY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjKSB7XG4gICAgICB2YXIgbWluTGVuID0gbWluaW11bUxlbmd0aChncmFwaCwgcCwgYyk7XG4gICAgICBncmFwaC5ub2RlKGMpLnJhbmsgPSBncmFwaC5ub2RlKHApLnJhbmsgKyBtaW5MZW47XG4gICAgICBkZnMoYyk7XG4gICAgfSk7XG4gIH1cblxuICBkZnModHJlZS5ncmFwaCgpLnJvb3QpO1xufVxuXG4vKlxuICogSWYgdSBhbmQgdiBhcmUgY29ubmVjdGVkIGJ5IHNvbWUgZWRnZXMgaW4gdGhlIGdyYXBoLCByZXR1cm4gdGhlXG4gKiBtaW5pbXVtIGxlbmd0aCBvZiB0aG9zZSBlZGdlcywgYXMgYSBwb3NpdGl2ZSBudW1iZXIgaWYgdiBzdWNjZWVkc1xuICogdSBhbmQgYXMgYSBuZWdhdGl2ZSBudW1iZXIgaWYgdiBwcmVjZWRlcyB1LlxuICovXG5mdW5jdGlvbiBtaW5pbXVtTGVuZ3RoKGdyYXBoLCB1LCB2KSB7XG4gIHZhciBvdXRFZGdlcyA9IGdyYXBoLm91dEVkZ2VzKHUsIHYpO1xuICBpZiAob3V0RWRnZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB1dGlsLm1heChvdXRFZGdlcy5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGdyYXBoLmVkZ2UoZSkubWluTGVuO1xuICAgIH0pKTtcbiAgfVxuXG4gIHZhciBpbkVkZ2VzID0gZ3JhcGguaW5FZGdlcyh1LCB2KTtcbiAgaWYgKGluRWRnZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiAtdXRpbC5tYXgoaW5FZGdlcy5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGdyYXBoLmVkZ2UoZSkubWluTGVuO1xuICAgIH0pKTtcbiAgfVxufVxuIiwiLypcbiAqIFJldHVybnMgdGhlIHNtYWxsZXN0IHZhbHVlIGluIHRoZSBhcnJheS5cbiAqL1xuZXhwb3J0cy5taW4gPSBmdW5jdGlvbih2YWx1ZXMpIHtcbiAgcmV0dXJuIE1hdGgubWluLmFwcGx5KE1hdGgsIHZhbHVlcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyB0aGUgbGFyZ2VzdCB2YWx1ZSBpbiB0aGUgYXJyYXkuXG4gKi9cbmV4cG9ydHMubWF4ID0gZnVuY3Rpb24odmFsdWVzKSB7XG4gIHJldHVybiBNYXRoLm1heC5hcHBseShNYXRoLCB2YWx1ZXMpO1xufTtcblxuLypcbiAqIFJldHVybnMgYHRydWVgIG9ubHkgaWYgYGYoeClgIGlzIGB0cnVlYCBmb3IgYWxsIGB4YCBpbiBgeHNgLiBPdGhlcndpc2VcbiAqIHJldHVybnMgYGZhbHNlYC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJldHVybiBpbW1lZGlhdGVseSBpZiBpdCBmaW5kcyBhXG4gKiBjYXNlIHdoZXJlIGBmKHgpYCBkb2VzIG5vdCBob2xkLlxuICovXG5leHBvcnRzLmFsbCA9IGZ1bmN0aW9uKHhzLCBmKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoIWYoeHNbaV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufTtcblxuLypcbiAqIEFjY3VtdWxhdGVzIHRoZSBzdW0gb2YgZWxlbWVudHMgaW4gdGhlIGdpdmVuIGFycmF5IHVzaW5nIHRoZSBgK2Agb3BlcmF0b3IuXG4gKi9cbmV4cG9ydHMuc3VtID0gZnVuY3Rpb24odmFsdWVzKSB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgeCkgeyByZXR1cm4gYWNjICsgeDsgfSwgMCk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBhbGwgdmFsdWVzIGluIHRoZSBnaXZlbiBvYmplY3QuXG4gKi9cbmV4cG9ydHMudmFsdWVzID0gZnVuY3Rpb24ob2JqKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopLm1hcChmdW5jdGlvbihrKSB7IHJldHVybiBvYmpba107IH0pO1xufTtcblxuZXhwb3J0cy5zaHVmZmxlID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgZm9yIChpID0gYXJyYXkubGVuZ3RoIC0gMTsgaSA+IDA7IC0taSkge1xuICAgIHZhciBqID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKGkgKyAxKSk7XG4gICAgdmFyIGFqID0gYXJyYXlbal07XG4gICAgYXJyYXlbal0gPSBhcnJheVtpXTtcbiAgICBhcnJheVtpXSA9IGFqO1xuICB9XG59O1xuXG5leHBvcnRzLnByb3BlcnR5QWNjZXNzb3IgPSBmdW5jdGlvbihzZWxmLCBjb25maWcsIGZpZWxkLCBzZXRIb29rKSB7XG4gIHJldHVybiBmdW5jdGlvbih4KSB7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gY29uZmlnW2ZpZWxkXTtcbiAgICBjb25maWdbZmllbGRdID0geDtcbiAgICBpZiAoc2V0SG9vaykgc2V0SG9vayh4KTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfTtcbn07XG5cbi8qXG4gKiBHaXZlbiBhIGxheWVyZWQsIGRpcmVjdGVkIGdyYXBoIHdpdGggYHJhbmtgIGFuZCBgb3JkZXJgIG5vZGUgYXR0cmlidXRlcyxcbiAqIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBhcnJheSBvZiBvcmRlcmVkIHJhbmtzLiBFYWNoIHJhbmsgY29udGFpbnMgYW4gYXJyYXlcbiAqIG9mIHRoZSBpZHMgb2YgdGhlIG5vZGVzIGluIHRoYXQgcmFuayBpbiB0aGUgb3JkZXIgc3BlY2lmaWVkIGJ5IHRoZSBgb3JkZXJgXG4gKiBhdHRyaWJ1dGUuXG4gKi9cbmV4cG9ydHMub3JkZXJpbmcgPSBmdW5jdGlvbihnKSB7XG4gIHZhciBvcmRlcmluZyA9IFtdO1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgdmFyIHJhbmsgPSBvcmRlcmluZ1t2YWx1ZS5yYW5rXSB8fCAob3JkZXJpbmdbdmFsdWUucmFua10gPSBbXSk7XG4gICAgcmFua1t2YWx1ZS5vcmRlcl0gPSB1O1xuICB9KTtcbiAgcmV0dXJuIG9yZGVyaW5nO1xufTtcblxuLypcbiAqIEEgZmlsdGVyIHRoYXQgY2FuIGJlIHVzZWQgd2l0aCBgZmlsdGVyTm9kZXNgIHRvIGdldCBhIGdyYXBoIHRoYXQgb25seVxuICogaW5jbHVkZXMgbm9kZXMgdGhhdCBkbyBub3QgY29udGFpbiBvdGhlcnMgbm9kZXMuXG4gKi9cbmV4cG9ydHMuZmlsdGVyTm9uU3ViZ3JhcGhzID0gZnVuY3Rpb24oZykge1xuICByZXR1cm4gZnVuY3Rpb24odSkge1xuICAgIHJldHVybiBnLmNoaWxkcmVuKHUpLmxlbmd0aCA9PT0gMDtcbiAgfTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGEgbmV3IGZ1bmN0aW9uIHRoYXQgd3JhcHMgYGZ1bmNgIHdpdGggYSB0aW1lci4gVGhlIHdyYXBwZXIgbG9ncyB0aGVcbiAqIHRpbWUgaXQgdGFrZXMgdG8gZXhlY3V0ZSB0aGUgZnVuY3Rpb24uXG4gKlxuICogVGhlIHRpbWVyIHdpbGwgYmUgZW5hYmxlZCBwcm92aWRlZCBgbG9nLmxldmVsID49IDFgLlxuICovXG5mdW5jdGlvbiB0aW1lKG5hbWUsIGZ1bmMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGFydCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZnVuYy5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBsb2coMSwgbmFtZSArICcgdGltZTogJyArIChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHN0YXJ0KSArICdtcycpO1xuICAgIH1cbiAgfTtcbn1cbnRpbWUuZW5hYmxlZCA9IGZhbHNlO1xuXG5leHBvcnRzLnRpbWUgPSB0aW1lO1xuXG4vKlxuICogQSBnbG9iYWwgbG9nZ2VyIHdpdGggdGhlIHNwZWNpZmljYXRpb24gYGxvZyhsZXZlbCwgbWVzc2FnZSwgLi4uKWAgdGhhdFxuICogd2lsbCBsb2cgYSBtZXNzYWdlIHRvIHRoZSBjb25zb2xlIGlmIGBsb2cubGV2ZWwgPj0gbGV2ZWxgLlxuICovXG5mdW5jdGlvbiBsb2cobGV2ZWwpIHtcbiAgaWYgKGxvZy5sZXZlbCA+PSBsZXZlbCkge1xuICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICB9XG59XG5sb2cubGV2ZWwgPSAwO1xuXG5leHBvcnRzLmxvZyA9IGxvZztcbiIsIm1vZHVsZS5leHBvcnRzID0gJzAuNC41JztcbiIsImV4cG9ydHMuU2V0ID0gcmVxdWlyZSgnLi9saWIvU2V0Jyk7XG5leHBvcnRzLlByaW9yaXR5UXVldWUgPSByZXF1aXJlKCcuL2xpYi9Qcmlvcml0eVF1ZXVlJyk7XG5leHBvcnRzLnZlcnNpb24gPSByZXF1aXJlKCcuL2xpYi92ZXJzaW9uJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFByaW9yaXR5UXVldWU7XG5cbi8qKlxuICogQSBtaW4tcHJpb3JpdHkgcXVldWUgZGF0YSBzdHJ1Y3R1cmUuIFRoaXMgYWxnb3JpdGhtIGlzIGRlcml2ZWQgZnJvbSBDb3JtZW4sXG4gKiBldCBhbC4sIFwiSW50cm9kdWN0aW9uIHRvIEFsZ29yaXRobXNcIi4gVGhlIGJhc2ljIGlkZWEgb2YgYSBtaW4tcHJpb3JpdHlcbiAqIHF1ZXVlIGlzIHRoYXQgeW91IGNhbiBlZmZpY2llbnRseSAoaW4gTygxKSB0aW1lKSBnZXQgdGhlIHNtYWxsZXN0IGtleSBpblxuICogdGhlIHF1ZXVlLiBBZGRpbmcgYW5kIHJlbW92aW5nIGVsZW1lbnRzIHRha2VzIE8obG9nIG4pIHRpbWUuIEEga2V5IGNhblxuICogaGF2ZSBpdHMgcHJpb3JpdHkgZGVjcmVhc2VkIGluIE8obG9nIG4pIHRpbWUuXG4gKi9cbmZ1bmN0aW9uIFByaW9yaXR5UXVldWUoKSB7XG4gIHRoaXMuX2FyciA9IFtdO1xuICB0aGlzLl9rZXlJbmRpY2VzID0ge307XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIHRoZSBxdWV1ZS4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLnNpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2Fyci5sZW5ndGg7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGtleXMgdGhhdCBhcmUgaW4gdGhlIHF1ZXVlLiBUYWtlcyBgTyhuKWAgdGltZS5cbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fYXJyLm1hcChmdW5jdGlvbih4KSB7IHJldHVybiB4LmtleTsgfSk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYHRydWVgIGlmICoqa2V5KiogaXMgaW4gdGhlIHF1ZXVlIGFuZCBgZmFsc2VgIGlmIG5vdC5cbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24oa2V5KSB7XG4gIHJldHVybiBrZXkgaW4gdGhpcy5fa2V5SW5kaWNlcztcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgcHJpb3JpdHkgZm9yICoqa2V5KiouIElmICoqa2V5KiogaXMgbm90IHByZXNlbnQgaW4gdGhlIHF1ZXVlXG4gKiB0aGVuIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBgdW5kZWZpbmVkYC4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGtleVxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5wcmlvcml0eSA9IGZ1bmN0aW9uKGtleSkge1xuICB2YXIgaW5kZXggPSB0aGlzLl9rZXlJbmRpY2VzW2tleV07XG4gIGlmIChpbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHRoaXMuX2FycltpbmRleF0ucHJpb3JpdHk7XG4gIH1cbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUga2V5IGZvciB0aGUgbWluaW11bSBlbGVtZW50IGluIHRoaXMgcXVldWUuIElmIHRoZSBxdWV1ZSBpc1xuICogZW1wdHkgdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuIFRha2VzIGBPKDEpYCB0aW1lLlxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5taW4gPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuc2l6ZSgpID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiUXVldWUgdW5kZXJmbG93XCIpO1xuICB9XG4gIHJldHVybiB0aGlzLl9hcnJbMF0ua2V5O1xufTtcblxuLyoqXG4gKiBJbnNlcnRzIGEgbmV3IGtleSBpbnRvIHRoZSBwcmlvcml0eSBxdWV1ZS4gSWYgdGhlIGtleSBhbHJlYWR5IGV4aXN0cyBpblxuICogdGhlIHF1ZXVlIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBgZmFsc2VgOyBvdGhlcndpc2UgaXQgd2lsbCByZXR1cm4gYHRydWVgLlxuICogVGFrZXMgYE8obilgIHRpbWUuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGtleSB0aGUga2V5IHRvIGFkZFxuICogQHBhcmFtIHtOdW1iZXJ9IHByaW9yaXR5IHRoZSBpbml0aWFsIHByaW9yaXR5IGZvciB0aGUga2V5XG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGtleSwgcHJpb3JpdHkpIHtcbiAgdmFyIGtleUluZGljZXMgPSB0aGlzLl9rZXlJbmRpY2VzO1xuICBpZiAoIShrZXkgaW4ga2V5SW5kaWNlcykpIHtcbiAgICB2YXIgYXJyID0gdGhpcy5fYXJyO1xuICAgIHZhciBpbmRleCA9IGFyci5sZW5ndGg7XG4gICAga2V5SW5kaWNlc1trZXldID0gaW5kZXg7XG4gICAgYXJyLnB1c2goe2tleToga2V5LCBwcmlvcml0eTogcHJpb3JpdHl9KTtcbiAgICB0aGlzLl9kZWNyZWFzZShpbmRleCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBSZW1vdmVzIGFuZCByZXR1cm5zIHRoZSBzbWFsbGVzdCBrZXkgaW4gdGhlIHF1ZXVlLiBUYWtlcyBgTyhsb2cgbilgIHRpbWUuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLnJlbW92ZU1pbiA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9zd2FwKDAsIHRoaXMuX2Fyci5sZW5ndGggLSAxKTtcbiAgdmFyIG1pbiA9IHRoaXMuX2Fyci5wb3AoKTtcbiAgZGVsZXRlIHRoaXMuX2tleUluZGljZXNbbWluLmtleV07XG4gIHRoaXMuX2hlYXBpZnkoMCk7XG4gIHJldHVybiBtaW4ua2V5O1xufTtcblxuLyoqXG4gKiBEZWNyZWFzZXMgdGhlIHByaW9yaXR5IGZvciAqKmtleSoqIHRvICoqcHJpb3JpdHkqKi4gSWYgdGhlIG5ldyBwcmlvcml0eSBpc1xuICogZ3JlYXRlciB0aGFuIHRoZSBwcmV2aW91cyBwcmlvcml0eSwgdGhpcyBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBrZXkgdGhlIGtleSBmb3Igd2hpY2ggdG8gcmFpc2UgcHJpb3JpdHlcbiAqIEBwYXJhbSB7TnVtYmVyfSBwcmlvcml0eSB0aGUgbmV3IHByaW9yaXR5IGZvciB0aGUga2V5XG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLmRlY3JlYXNlID0gZnVuY3Rpb24oa2V5LCBwcmlvcml0eSkge1xuICB2YXIgaW5kZXggPSB0aGlzLl9rZXlJbmRpY2VzW2tleV07XG4gIGlmIChwcmlvcml0eSA+IHRoaXMuX2FycltpbmRleF0ucHJpb3JpdHkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJOZXcgcHJpb3JpdHkgaXMgZ3JlYXRlciB0aGFuIGN1cnJlbnQgcHJpb3JpdHkuIFwiICtcbiAgICAgICAgXCJLZXk6IFwiICsga2V5ICsgXCIgT2xkOiBcIiArIHRoaXMuX2FycltpbmRleF0ucHJpb3JpdHkgKyBcIiBOZXc6IFwiICsgcHJpb3JpdHkpO1xuICB9XG4gIHRoaXMuX2FycltpbmRleF0ucHJpb3JpdHkgPSBwcmlvcml0eTtcbiAgdGhpcy5fZGVjcmVhc2UoaW5kZXgpO1xufTtcblxuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuX2hlYXBpZnkgPSBmdW5jdGlvbihpKSB7XG4gIHZhciBhcnIgPSB0aGlzLl9hcnI7XG4gIHZhciBsID0gMiAqIGksXG4gICAgICByID0gbCArIDEsXG4gICAgICBsYXJnZXN0ID0gaTtcbiAgaWYgKGwgPCBhcnIubGVuZ3RoKSB7XG4gICAgbGFyZ2VzdCA9IGFycltsXS5wcmlvcml0eSA8IGFycltsYXJnZXN0XS5wcmlvcml0eSA/IGwgOiBsYXJnZXN0O1xuICAgIGlmIChyIDwgYXJyLmxlbmd0aCkge1xuICAgICAgbGFyZ2VzdCA9IGFycltyXS5wcmlvcml0eSA8IGFycltsYXJnZXN0XS5wcmlvcml0eSA/IHIgOiBsYXJnZXN0O1xuICAgIH1cbiAgICBpZiAobGFyZ2VzdCAhPT0gaSkge1xuICAgICAgdGhpcy5fc3dhcChpLCBsYXJnZXN0KTtcbiAgICAgIHRoaXMuX2hlYXBpZnkobGFyZ2VzdCk7XG4gICAgfVxuICB9XG59O1xuXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5fZGVjcmVhc2UgPSBmdW5jdGlvbihpbmRleCkge1xuICB2YXIgYXJyID0gdGhpcy5fYXJyO1xuICB2YXIgcHJpb3JpdHkgPSBhcnJbaW5kZXhdLnByaW9yaXR5O1xuICB2YXIgcGFyZW50O1xuICB3aGlsZSAoaW5kZXggIT09IDApIHtcbiAgICBwYXJlbnQgPSBpbmRleCA+PiAxO1xuICAgIGlmIChhcnJbcGFyZW50XS5wcmlvcml0eSA8IHByaW9yaXR5KSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgdGhpcy5fc3dhcChpbmRleCwgcGFyZW50KTtcbiAgICBpbmRleCA9IHBhcmVudDtcbiAgfVxufTtcblxuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuX3N3YXAgPSBmdW5jdGlvbihpLCBqKSB7XG4gIHZhciBhcnIgPSB0aGlzLl9hcnI7XG4gIHZhciBrZXlJbmRpY2VzID0gdGhpcy5fa2V5SW5kaWNlcztcbiAgdmFyIG9yaWdBcnJJID0gYXJyW2ldO1xuICB2YXIgb3JpZ0FyckogPSBhcnJbal07XG4gIGFycltpXSA9IG9yaWdBcnJKO1xuICBhcnJbal0gPSBvcmlnQXJySTtcbiAga2V5SW5kaWNlc1tvcmlnQXJySi5rZXldID0gaTtcbiAga2V5SW5kaWNlc1tvcmlnQXJySS5rZXldID0gajtcbn07XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNldDtcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IFNldCB3aXRoIGFuIG9wdGlvbmFsIHNldCBvZiBgaW5pdGlhbEtleXNgLlxuICpcbiAqIEl0IGlzIGltcG9ydGFudCB0byBub3RlIHRoYXQga2V5cyBhcmUgY29lcmNlZCB0byBTdHJpbmcgZm9yIG1vc3QgcHVycG9zZXNcbiAqIHdpdGggdGhpcyBvYmplY3QsIHNpbWlsYXIgdG8gdGhlIGJlaGF2aW9yIG9mIEphdmFTY3JpcHQncyBPYmplY3QuIEZvclxuICogZXhhbXBsZSwgdGhlIGZvbGxvd2luZyB3aWxsIGFkZCBvbmx5IG9uZSBrZXk6XG4gKlxuICogICAgIHZhciBzID0gbmV3IFNldCgpO1xuICogICAgIHMuYWRkKDEpO1xuICogICAgIHMuYWRkKFwiMVwiKTtcbiAqXG4gKiBIb3dldmVyLCB0aGUgdHlwZSBvZiB0aGUga2V5IGlzIHByZXNlcnZlZCBpbnRlcm5hbGx5IHNvIHRoYXQgYGtleXNgIHJldHVybnNcbiAqIHRoZSBvcmlnaW5hbCBrZXkgc2V0IHVuY29lcmNlZC4gRm9yIHRoZSBhYm92ZSBleGFtcGxlLCBga2V5c2Agd291bGQgcmV0dXJuXG4gKiBgWzFdYC5cbiAqL1xuZnVuY3Rpb24gU2V0KGluaXRpYWxLZXlzKSB7XG4gIHRoaXMuX3NpemUgPSAwO1xuICB0aGlzLl9rZXlzID0ge307XG5cbiAgaWYgKGluaXRpYWxLZXlzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGlsID0gaW5pdGlhbEtleXMubGVuZ3RoOyBpIDwgaWw7ICsraSkge1xuICAgICAgdGhpcy5hZGQoaW5pdGlhbEtleXNbaV0pO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgU2V0IHRoYXQgcmVwcmVzZW50cyB0aGUgc2V0IGludGVyc2VjdGlvbiBvZiB0aGUgYXJyYXkgb2YgZ2l2ZW5cbiAqIHNldHMuXG4gKi9cblNldC5pbnRlcnNlY3QgPSBmdW5jdGlvbihzZXRzKSB7XG4gIGlmIChzZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgU2V0KCk7XG4gIH1cblxuICB2YXIgcmVzdWx0ID0gbmV3IFNldCghdXRpbC5pc0FycmF5KHNldHNbMF0pID8gc2V0c1swXS5rZXlzKCkgOiBzZXRzWzBdKTtcbiAgZm9yICh2YXIgaSA9IDEsIGlsID0gc2V0cy5sZW5ndGg7IGkgPCBpbDsgKytpKSB7XG4gICAgdmFyIHJlc3VsdEtleXMgPSByZXN1bHQua2V5cygpLFxuICAgICAgICBvdGhlciA9ICF1dGlsLmlzQXJyYXkoc2V0c1tpXSkgPyBzZXRzW2ldIDogbmV3IFNldChzZXRzW2ldKTtcbiAgICBmb3IgKHZhciBqID0gMCwgamwgPSByZXN1bHRLZXlzLmxlbmd0aDsgaiA8IGpsOyArK2opIHtcbiAgICAgIHZhciBrZXkgPSByZXN1bHRLZXlzW2pdO1xuICAgICAgaWYgKCFvdGhlci5oYXMoa2V5KSkge1xuICAgICAgICByZXN1bHQucmVtb3ZlKGtleSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIG5ldyBTZXQgdGhhdCByZXByZXNlbnRzIHRoZSBzZXQgdW5pb24gb2YgdGhlIGFycmF5IG9mIGdpdmVuIHNldHMuXG4gKi9cblNldC51bmlvbiA9IGZ1bmN0aW9uKHNldHMpIHtcbiAgdmFyIHRvdGFsRWxlbXMgPSB1dGlsLnJlZHVjZShzZXRzLCBmdW5jdGlvbihsaHMsIHJocykge1xuICAgIHJldHVybiBsaHMgKyAocmhzLnNpemUgPyByaHMuc2l6ZSgpIDogcmhzLmxlbmd0aCk7XG4gIH0sIDApO1xuICB2YXIgYXJyID0gbmV3IEFycmF5KHRvdGFsRWxlbXMpO1xuXG4gIHZhciBrID0gMDtcbiAgZm9yICh2YXIgaSA9IDAsIGlsID0gc2V0cy5sZW5ndGg7IGkgPCBpbDsgKytpKSB7XG4gICAgdmFyIGN1ciA9IHNldHNbaV0sXG4gICAgICAgIGtleXMgPSAhdXRpbC5pc0FycmF5KGN1cikgPyBjdXIua2V5cygpIDogY3VyO1xuICAgIGZvciAodmFyIGogPSAwLCBqbCA9IGtleXMubGVuZ3RoOyBqIDwgamw7ICsraikge1xuICAgICAgYXJyW2srK10gPSBrZXlzW2pdO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgU2V0KGFycik7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHNpemUgb2YgdGhpcyBzZXQgaW4gYE8oMSlgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUuc2l6ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fc2l6ZTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUga2V5cyBpbiB0aGlzIHNldC4gVGFrZXMgYE8obilgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdmFsdWVzKHRoaXMuX2tleXMpO1xufTtcblxuLyoqXG4gKiBUZXN0cyBpZiBhIGtleSBpcyBwcmVzZW50IGluIHRoaXMgU2V0LiBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbmQgYGZhbHNlYFxuICogaWYgbm90LiBUYWtlcyBgTygxKWAgdGltZS5cbiAqL1xuU2V0LnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgcmV0dXJuIGtleSBpbiB0aGlzLl9rZXlzO1xufTtcblxuLyoqXG4gKiBBZGRzIGEgbmV3IGtleSB0byB0aGlzIFNldCBpZiBpdCBpcyBub3QgYWxyZWFkeSBwcmVzZW50LiBSZXR1cm5zIGB0cnVlYCBpZlxuICogdGhlIGtleSB3YXMgYWRkZWQgYW5kIGBmYWxzZWAgaWYgaXQgd2FzIGFscmVhZHkgcHJlc2VudC4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oa2V5KSB7XG4gIGlmICghKGtleSBpbiB0aGlzLl9rZXlzKSkge1xuICAgIHRoaXMuX2tleXNba2V5XSA9IGtleTtcbiAgICArK3RoaXMuX3NpemU7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBSZW1vdmVzIGEga2V5IGZyb20gdGhpcyBTZXQuIElmIHRoZSBrZXkgd2FzIHJlbW92ZWQgdGhpcyBmdW5jdGlvbiByZXR1cm5zXG4gKiBgdHJ1ZWAuIElmIG5vdCwgaXQgcmV0dXJucyBgZmFsc2VgLiBUYWtlcyBgTygxKWAgdGltZS5cbiAqL1xuU2V0LnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihrZXkpIHtcbiAgaWYgKGtleSBpbiB0aGlzLl9rZXlzKSB7XG4gICAgZGVsZXRlIHRoaXMuX2tleXNba2V5XTtcbiAgICAtLXRoaXMuX3NpemU7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgYWxsIHZhbHVlcyBmb3IgcHJvcGVydGllcyBvZiAqKm8qKi5cbiAqL1xuZnVuY3Rpb24gdmFsdWVzKG8pIHtcbiAgdmFyIGtzID0gT2JqZWN0LmtleXMobyksXG4gICAgICBsZW4gPSBrcy5sZW5ndGgsXG4gICAgICByZXN1bHQgPSBuZXcgQXJyYXkobGVuKSxcbiAgICAgIGk7XG4gIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHJlc3VsdFtpXSA9IG9ba3NbaV1dO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG4iLCIvKlxuICogVGhpcyBwb2x5ZmlsbCBjb21lcyBmcm9tXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9pc0FycmF5XG4gKi9cbmlmKCFBcnJheS5pc0FycmF5KSB7XG4gIGV4cG9ydHMuaXNBcnJheSA9IGZ1bmN0aW9uICh2QXJnKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2QXJnKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcbn0gZWxzZSB7XG4gIGV4cG9ydHMuaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG59XG5cbi8qXG4gKiBTbGlnaHRseSBhZGFwdGVkIHBvbHlmaWxsIGZyb21cbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L1JlZHVjZVxuICovXG5pZiAoJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UpIHtcbiAgZXhwb3J0cy5yZWR1Y2UgPSBmdW5jdGlvbihhcnJheSwgY2FsbGJhY2ssIG9wdF9pbml0aWFsVmFsdWUpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgaWYgKG51bGwgPT09IGFycmF5IHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2YgYXJyYXkpIHtcbiAgICAgIC8vIEF0IHRoZSBtb21lbnQgYWxsIG1vZGVybiBicm93c2VycywgdGhhdCBzdXBwb3J0IHN0cmljdCBtb2RlLCBoYXZlXG4gICAgICAvLyBuYXRpdmUgaW1wbGVtZW50YXRpb24gb2YgQXJyYXkucHJvdG90eXBlLnJlZHVjZS4gRm9yIGluc3RhbmNlLCBJRThcbiAgICAgIC8vIGRvZXMgbm90IHN1cHBvcnQgc3RyaWN0IG1vZGUsIHNvIHRoaXMgY2hlY2sgaXMgYWN0dWFsbHkgdXNlbGVzcy5cbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgJ0FycmF5LnByb3RvdHlwZS5yZWR1Y2UgY2FsbGVkIG9uIG51bGwgb3IgdW5kZWZpbmVkJyk7XG4gICAgfVxuICAgIGlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YgY2FsbGJhY2spIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoY2FsbGJhY2sgKyAnIGlzIG5vdCBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIHZhciBpbmRleCwgdmFsdWUsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCA+Pj4gMCxcbiAgICAgICAgaXNWYWx1ZVNldCA9IGZhbHNlO1xuICAgIGlmICgxIDwgYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgdmFsdWUgPSBvcHRfaW5pdGlhbFZhbHVlO1xuICAgICAgaXNWYWx1ZVNldCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoaW5kZXggPSAwOyBsZW5ndGggPiBpbmRleDsgKytpbmRleCkge1xuICAgICAgaWYgKGFycmF5Lmhhc093blByb3BlcnR5KGluZGV4KSkge1xuICAgICAgICBpZiAoaXNWYWx1ZVNldCkge1xuICAgICAgICAgIHZhbHVlID0gY2FsbGJhY2sodmFsdWUsIGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IGFycmF5W2luZGV4XTtcbiAgICAgICAgICBpc1ZhbHVlU2V0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWlzVmFsdWVTZXQpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1JlZHVjZSBvZiBlbXB0eSBhcnJheSB3aXRoIG5vIGluaXRpYWwgdmFsdWUnKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xufSBlbHNlIHtcbiAgZXhwb3J0cy5yZWR1Y2UgPSBmdW5jdGlvbihhcnJheSwgY2FsbGJhY2ssIG9wdF9pbml0aWFsVmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkucmVkdWNlKGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKTtcbiAgfTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gJzEuMS4zJztcbiIsImV4cG9ydHMuR3JhcGggPSByZXF1aXJlKFwiLi9saWIvR3JhcGhcIik7XG5leHBvcnRzLkRpZ3JhcGggPSByZXF1aXJlKFwiLi9saWIvRGlncmFwaFwiKTtcbmV4cG9ydHMuQ0dyYXBoID0gcmVxdWlyZShcIi4vbGliL0NHcmFwaFwiKTtcbmV4cG9ydHMuQ0RpZ3JhcGggPSByZXF1aXJlKFwiLi9saWIvQ0RpZ3JhcGhcIik7XG5yZXF1aXJlKFwiLi9saWIvZ3JhcGgtY29udmVydGVyc1wiKTtcblxuZXhwb3J0cy5hbGcgPSB7XG4gIGlzQWN5Y2xpYzogcmVxdWlyZShcIi4vbGliL2FsZy9pc0FjeWNsaWNcIiksXG4gIGNvbXBvbmVudHM6IHJlcXVpcmUoXCIuL2xpYi9hbGcvY29tcG9uZW50c1wiKSxcbiAgZGlqa3N0cmE6IHJlcXVpcmUoXCIuL2xpYi9hbGcvZGlqa3N0cmFcIiksXG4gIGRpamtzdHJhQWxsOiByZXF1aXJlKFwiLi9saWIvYWxnL2RpamtzdHJhQWxsXCIpLFxuICBmaW5kQ3ljbGVzOiByZXF1aXJlKFwiLi9saWIvYWxnL2ZpbmRDeWNsZXNcIiksXG4gIGZsb3lkV2Fyc2hhbGw6IHJlcXVpcmUoXCIuL2xpYi9hbGcvZmxveWRXYXJzaGFsbFwiKSxcbiAgcG9zdG9yZGVyOiByZXF1aXJlKFwiLi9saWIvYWxnL3Bvc3RvcmRlclwiKSxcbiAgcHJlb3JkZXI6IHJlcXVpcmUoXCIuL2xpYi9hbGcvcHJlb3JkZXJcIiksXG4gIHByaW06IHJlcXVpcmUoXCIuL2xpYi9hbGcvcHJpbVwiKSxcbiAgdGFyamFuOiByZXF1aXJlKFwiLi9saWIvYWxnL3RhcmphblwiKSxcbiAgdG9wc29ydDogcmVxdWlyZShcIi4vbGliL2FsZy90b3Bzb3J0XCIpXG59O1xuXG5leHBvcnRzLmNvbnZlcnRlciA9IHtcbiAganNvbjogcmVxdWlyZShcIi4vbGliL2NvbnZlcnRlci9qc29uLmpzXCIpXG59O1xuXG52YXIgZmlsdGVyID0gcmVxdWlyZShcIi4vbGliL2ZpbHRlclwiKTtcbmV4cG9ydHMuZmlsdGVyID0ge1xuICBhbGw6IGZpbHRlci5hbGwsXG4gIG5vZGVzRnJvbUxpc3Q6IGZpbHRlci5ub2Rlc0Zyb21MaXN0XG59O1xuXG5leHBvcnRzLnZlcnNpb24gPSByZXF1aXJlKFwiLi9saWIvdmVyc2lvblwiKTtcbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VHcmFwaDtcblxuZnVuY3Rpb24gQmFzZUdyYXBoKCkge1xuICAvLyBUaGUgdmFsdWUgYXNzaWduZWQgdG8gdGhlIGdyYXBoIGl0c2VsZi5cbiAgdGhpcy5fdmFsdWUgPSB1bmRlZmluZWQ7XG5cbiAgLy8gTWFwIG9mIG5vZGUgaWQgLT4geyBpZCwgdmFsdWUgfVxuICB0aGlzLl9ub2RlcyA9IHt9O1xuXG4gIC8vIE1hcCBvZiBlZGdlIGlkIC0+IHsgaWQsIHUsIHYsIHZhbHVlIH1cbiAgdGhpcy5fZWRnZXMgPSB7fTtcblxuICAvLyBVc2VkIHRvIGdlbmVyYXRlIGEgdW5pcXVlIGlkIGluIHRoZSBncmFwaFxuICB0aGlzLl9uZXh0SWQgPSAwO1xufVxuXG4vLyBOdW1iZXIgb2Ygbm9kZXNcbkJhc2VHcmFwaC5wcm90b3R5cGUub3JkZXIgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX25vZGVzKS5sZW5ndGg7XG59O1xuXG4vLyBOdW1iZXIgb2YgZWRnZXNcbkJhc2VHcmFwaC5wcm90b3R5cGUuc2l6ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZWRnZXMpLmxlbmd0aDtcbn07XG5cbi8vIEFjY2Vzc29yIGZvciBncmFwaCBsZXZlbCB2YWx1ZVxuQmFzZUdyYXBoLnByb3RvdHlwZS5ncmFwaCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHRoaXMuX3ZhbHVlO1xuICB9XG4gIHRoaXMuX3ZhbHVlID0gdmFsdWU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmhhc05vZGUgPSBmdW5jdGlvbih1KSB7XG4gIHJldHVybiB1IGluIHRoaXMuX25vZGVzO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5ub2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgdmFyIG5vZGUgPSB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIG5vZGUudmFsdWUgPSB2YWx1ZTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUubm9kZXMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5vZGVzID0gW107XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24oaWQpIHsgbm9kZXMucHVzaChpZCk7IH0pO1xuICByZXR1cm4gbm9kZXM7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmVhY2hOb2RlID0gZnVuY3Rpb24oZnVuYykge1xuICBmb3IgKHZhciBrIGluIHRoaXMuX25vZGVzKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLl9ub2Rlc1trXTtcbiAgICBmdW5jKG5vZGUuaWQsIG5vZGUudmFsdWUpO1xuICB9XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmhhc0VkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIHJldHVybiBlIGluIHRoaXMuX2VkZ2VzO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5lZGdlID0gZnVuY3Rpb24oZSwgdmFsdWUpIHtcbiAgdmFyIGVkZ2UgPSB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBlZGdlLnZhbHVlO1xuICB9XG4gIGVkZ2UudmFsdWUgPSB2YWx1ZTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZWRnZXMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGVzID0gW107XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oaWQpIHsgZXMucHVzaChpZCk7IH0pO1xuICByZXR1cm4gZXM7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmVhY2hFZGdlID0gZnVuY3Rpb24oZnVuYykge1xuICBmb3IgKHZhciBrIGluIHRoaXMuX2VkZ2VzKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLl9lZGdlc1trXTtcbiAgICBmdW5jKGVkZ2UuaWQsIGVkZ2UudSwgZWRnZS52LCBlZGdlLnZhbHVlKTtcbiAgfVxufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5pbmNpZGVudE5vZGVzID0gZnVuY3Rpb24oZSkge1xuICB2YXIgZWRnZSA9IHRoaXMuX3N0cmljdEdldEVkZ2UoZSk7XG4gIHJldHVybiBbZWRnZS51LCBlZGdlLnZdO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5hZGROb2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgaWYgKHUgPT09IHVuZGVmaW5lZCB8fCB1ID09PSBudWxsKSB7XG4gICAgZG8ge1xuICAgICAgdSA9IFwiX1wiICsgKCsrdGhpcy5fbmV4dElkKTtcbiAgICB9IHdoaWxlICh0aGlzLmhhc05vZGUodSkpO1xuICB9IGVsc2UgaWYgKHRoaXMuaGFzTm9kZSh1KSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkdyYXBoIGFscmVhZHkgaGFzIG5vZGUgJ1wiICsgdSArIFwiJ1wiKTtcbiAgfVxuICB0aGlzLl9ub2Rlc1t1XSA9IHsgaWQ6IHUsIHZhbHVlOiB2YWx1ZSB9O1xuICByZXR1cm4gdTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZGVsTm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgdGhpcy5pbmNpZGVudEVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkgeyB0aGlzLmRlbEVkZ2UoZSk7IH0sIHRoaXMpO1xuICBkZWxldGUgdGhpcy5fbm9kZXNbdV07XG59O1xuXG4vLyBpbk1hcCBhbmQgb3V0TWFwIGFyZSBvcHBvc2l0ZSBzaWRlcyBvZiBhbiBpbmNpZGVuY2UgbWFwLiBGb3IgZXhhbXBsZSwgZm9yXG4vLyBHcmFwaCB0aGVzZSB3b3VsZCBib3RoIGNvbWUgZnJvbSB0aGUgX2luY2lkZW50RWRnZXMgbWFwLCB3aGlsZSBmb3IgRGlncmFwaFxuLy8gdGhleSB3b3VsZCBjb21lIGZyb20gX2luRWRnZXMgYW5kIF9vdXRFZGdlcy5cbkJhc2VHcmFwaC5wcm90b3R5cGUuX2FkZEVkZ2UgPSBmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSwgaW5NYXAsIG91dE1hcCkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHYpO1xuXG4gIGlmIChlID09PSB1bmRlZmluZWQgfHwgZSA9PT0gbnVsbCkge1xuICAgIGRvIHtcbiAgICAgIGUgPSBcIl9cIiArICgrK3RoaXMuX25leHRJZCk7XG4gICAgfSB3aGlsZSAodGhpcy5oYXNFZGdlKGUpKTtcbiAgfVxuICBlbHNlIGlmICh0aGlzLmhhc0VkZ2UoZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJHcmFwaCBhbHJlYWR5IGhhcyBlZGdlICdcIiArIGUgKyBcIidcIik7XG4gIH1cblxuICB0aGlzLl9lZGdlc1tlXSA9IHsgaWQ6IGUsIHU6IHUsIHY6IHYsIHZhbHVlOiB2YWx1ZSB9O1xuICBhZGRFZGdlVG9NYXAoaW5NYXBbdl0sIHUsIGUpO1xuICBhZGRFZGdlVG9NYXAob3V0TWFwW3VdLCB2LCBlKTtcblxuICByZXR1cm4gZTtcbn07XG5cbi8vIFNlZSBub3RlIGZvciBfYWRkRWRnZSByZWdhcmRpbmcgaW5NYXAgYW5kIG91dE1hcC5cbkJhc2VHcmFwaC5wcm90b3R5cGUuX2RlbEVkZ2UgPSBmdW5jdGlvbihlLCBpbk1hcCwgb3V0TWFwKSB7XG4gIHZhciBlZGdlID0gdGhpcy5fc3RyaWN0R2V0RWRnZShlKTtcbiAgZGVsRWRnZUZyb21NYXAoaW5NYXBbZWRnZS52XSwgZWRnZS51LCBlKTtcbiAgZGVsRWRnZUZyb21NYXAob3V0TWFwW2VkZ2UudV0sIGVkZ2UudiwgZSk7XG4gIGRlbGV0ZSB0aGlzLl9lZGdlc1tlXTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgY29weSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gIGNvcHkuZ3JhcGgodGhpcy5ncmFwaCgpKTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkgeyBjb3B5LmFkZE5vZGUodSwgdmFsdWUpOyB9KTtcbiAgdGhpcy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkgeyBjb3B5LmFkZEVkZ2UoZSwgdSwgdiwgdmFsdWUpOyB9KTtcbiAgY29weS5fbmV4dElkID0gdGhpcy5fbmV4dElkO1xuICByZXR1cm4gY29weTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZmlsdGVyTm9kZXMgPSBmdW5jdGlvbihmaWx0ZXIpIHtcbiAgdmFyIGNvcHkgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICBjb3B5LmdyYXBoKHRoaXMuZ3JhcGgoKSk7XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICBpZiAoZmlsdGVyKHUpKSB7XG4gICAgICBjb3B5LmFkZE5vZGUodSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBpZiAoY29weS5oYXNOb2RlKHUpICYmIGNvcHkuaGFzTm9kZSh2KSkge1xuICAgICAgY29weS5hZGRFZGdlKGUsIHUsIHYsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gY29weTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuX3N0cmljdEdldE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gIHZhciBub2RlID0gdGhpcy5fbm9kZXNbdV07XG4gIGlmIChub2RlID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb2RlICdcIiArIHUgKyBcIicgaXMgbm90IGluIGdyYXBoXCIpO1xuICB9XG4gIHJldHVybiBub2RlO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5fc3RyaWN0R2V0RWRnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgdmFyIGVkZ2UgPSB0aGlzLl9lZGdlc1tlXTtcbiAgaWYgKGVkZ2UgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkVkZ2UgJ1wiICsgZSArIFwiJyBpcyBub3QgaW4gZ3JhcGhcIik7XG4gIH1cbiAgcmV0dXJuIGVkZ2U7XG59O1xuXG5mdW5jdGlvbiBhZGRFZGdlVG9NYXAobWFwLCB2LCBlKSB7XG4gIChtYXBbdl0gfHwgKG1hcFt2XSA9IG5ldyBTZXQoKSkpLmFkZChlKTtcbn1cblxuZnVuY3Rpb24gZGVsRWRnZUZyb21NYXAobWFwLCB2LCBlKSB7XG4gIHZhciB2RW50cnkgPSBtYXBbdl07XG4gIHZFbnRyeS5yZW1vdmUoZSk7XG4gIGlmICh2RW50cnkuc2l6ZSgpID09PSAwKSB7XG4gICAgZGVsZXRlIG1hcFt2XTtcbiAgfVxufVxuXG4iLCJ2YXIgRGlncmFwaCA9IHJlcXVpcmUoXCIuL0RpZ3JhcGhcIiksXG4gICAgY29tcG91bmRpZnkgPSByZXF1aXJlKFwiLi9jb21wb3VuZGlmeVwiKTtcblxudmFyIENEaWdyYXBoID0gY29tcG91bmRpZnkoRGlncmFwaCk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ0RpZ3JhcGg7XG5cbkNEaWdyYXBoLmZyb21EaWdyYXBoID0gZnVuY3Rpb24oc3JjKSB7XG4gIHZhciBnID0gbmV3IENEaWdyYXBoKCksXG4gICAgICBncmFwaFZhbHVlID0gc3JjLmdyYXBoKCk7XG5cbiAgaWYgKGdyYXBoVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIGcuZ3JhcGgoZ3JhcGhWYWx1ZSk7XG4gIH1cblxuICBzcmMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5hZGROb2RlKHUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZE5vZGUodSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHNyYy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGc7XG59O1xuXG5DRGlncmFwaC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiQ0RpZ3JhcGggXCIgKyBKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCAyKTtcbn07XG4iLCJ2YXIgR3JhcGggPSByZXF1aXJlKFwiLi9HcmFwaFwiKSxcbiAgICBjb21wb3VuZGlmeSA9IHJlcXVpcmUoXCIuL2NvbXBvdW5kaWZ5XCIpO1xuXG52YXIgQ0dyYXBoID0gY29tcG91bmRpZnkoR3JhcGgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENHcmFwaDtcblxuQ0dyYXBoLmZyb21HcmFwaCA9IGZ1bmN0aW9uKHNyYykge1xuICB2YXIgZyA9IG5ldyBDR3JhcGgoKSxcbiAgICAgIGdyYXBoVmFsdWUgPSBzcmMuZ3JhcGgoKTtcblxuICBpZiAoZ3JhcGhWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZy5ncmFwaChncmFwaFZhbHVlKTtcbiAgfVxuXG4gIHNyYy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLmFkZE5vZGUodSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkTm9kZSh1LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgc3JjLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZztcbn07XG5cbkNHcmFwaC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiQ0dyYXBoIFwiICsgSlNPTi5zdHJpbmdpZnkodGhpcywgbnVsbCwgMik7XG59O1xuIiwiLypcbiAqIFRoaXMgZmlsZSBpcyBvcmdhbml6ZWQgd2l0aCBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICpcbiAqIEV4cG9ydHNcbiAqIEdyYXBoIGNvbnN0cnVjdG9yc1xuICogR3JhcGggcXVlcmllcyAoZS5nLiBub2RlcygpLCBlZGdlcygpXG4gKiBHcmFwaCBtdXRhdG9yc1xuICogSGVscGVyIGZ1bmN0aW9uc1xuICovXG5cbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKSxcbiAgICBCYXNlR3JhcGggPSByZXF1aXJlKFwiLi9CYXNlR3JhcGhcIiksXG4vKiBqc2hpbnQgLVcwNzkgKi9cbiAgICBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBEaWdyYXBoO1xuXG4vKlxuICogQ29uc3RydWN0b3IgdG8gY3JlYXRlIGEgbmV3IGRpcmVjdGVkIG11bHRpLWdyYXBoLlxuICovXG5mdW5jdGlvbiBEaWdyYXBoKCkge1xuICBCYXNlR3JhcGguY2FsbCh0aGlzKTtcblxuICAvKiEgTWFwIG9mIHNvdXJjZUlkIC0+IHt0YXJnZXRJZCAtPiBTZXQgb2YgZWRnZSBpZHN9ICovXG4gIHRoaXMuX2luRWRnZXMgPSB7fTtcblxuICAvKiEgTWFwIG9mIHRhcmdldElkIC0+IHtzb3VyY2VJZCAtPiBTZXQgb2YgZWRnZSBpZHN9ICovXG4gIHRoaXMuX291dEVkZ2VzID0ge307XG59XG5cbkRpZ3JhcGgucHJvdG90eXBlID0gbmV3IEJhc2VHcmFwaCgpO1xuRGlncmFwaC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBEaWdyYXBoO1xuXG4vKlxuICogQWx3YXlzIHJldHVybnMgYHRydWVgLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5pc0RpcmVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIHN1Y2Nlc3NvcnMgb2YgdGhlIG5vZGUgd2l0aCB0aGUgaWQgYHVgLiBUaGF0IGlzLCBhbGwgbm9kZXNcbiAqIHRoYXQgaGF2ZSB0aGUgbm9kZSBgdWAgYXMgdGhlaXIgc291cmNlIGFyZSByZXR1cm5lZC5cbiAqIFxuICogSWYgbm8gbm9kZSBgdWAgZXhpc3RzIGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuc3VjY2Vzc29ycyA9IGZ1bmN0aW9uKHUpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX291dEVkZ2VzW3VdKVxuICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbih2KSB7IHJldHVybiB0aGlzLl9ub2Rlc1t2XS5pZDsgfSwgdGhpcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgcHJlZGVjZXNzb3JzIG9mIHRoZSBub2RlIHdpdGggdGhlIGlkIGB1YC4gVGhhdCBpcywgYWxsIG5vZGVzXG4gKiB0aGF0IGhhdmUgdGhlIG5vZGUgYHVgIGFzIHRoZWlyIHRhcmdldCBhcmUgcmV0dXJuZWQuXG4gKiBcbiAqIElmIG5vIG5vZGUgYHVgIGV4aXN0cyBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnByZWRlY2Vzc29ycyA9IGZ1bmN0aW9uKHUpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2luRWRnZXNbdV0pXG4gICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHRoaXMuX25vZGVzW3ZdLmlkOyB9LCB0aGlzKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBub2RlcyB0aGF0IGFyZSBhZGphY2VudCB0byB0aGUgbm9kZSB3aXRoIHRoZSBpZCBgdWAuIEluIG90aGVyXG4gKiB3b3JkcywgdGhpcyBmdW5jdGlvbiByZXR1cm5zIHRoZSBzZXQgb2YgYWxsIHN1Y2Nlc3NvcnMgYW5kIHByZWRlY2Vzc29ycyBvZlxuICogbm9kZSBgdWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLm5laWdoYm9ycyA9IGZ1bmN0aW9uKHUpIHtcbiAgcmV0dXJuIFNldC51bmlvbihbdGhpcy5zdWNjZXNzb3JzKHUpLCB0aGlzLnByZWRlY2Vzc29ycyh1KV0pLmtleXMoKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBub2RlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIG5vIGluLWVkZ2VzLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5zb3VyY2VzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgcmV0dXJuIHRoaXMuX2ZpbHRlck5vZGVzKGZ1bmN0aW9uKHUpIHtcbiAgICAvLyBUaGlzIGNvdWxkIGhhdmUgYmV0dGVyIHNwYWNlIGNoYXJhY3RlcmlzdGljcyBpZiB3ZSBoYWQgYW4gaW5EZWdyZWUgZnVuY3Rpb24uXG4gICAgcmV0dXJuIHNlbGYuaW5FZGdlcyh1KS5sZW5ndGggPT09IDA7XG4gIH0pO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIG5vZGVzIGluIHRoZSBncmFwaCB0aGF0IGhhdmUgbm8gb3V0LWVkZ2VzLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5zaW5rcyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHJldHVybiB0aGlzLl9maWx0ZXJOb2RlcyhmdW5jdGlvbih1KSB7XG4gICAgLy8gVGhpcyBjb3VsZCBoYXZlIGJldHRlciBzcGFjZSBjaGFyYWN0ZXJpc3RpY3MgaWYgd2UgaGF2ZSBhbiBvdXREZWdyZWUgZnVuY3Rpb24uXG4gICAgcmV0dXJuIHNlbGYub3V0RWRnZXModSkubGVuZ3RoID09PSAwO1xuICB9KTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIHRoZSBzb3VyY2Ugbm9kZSBpbmNpZGVudCBvbiB0aGUgZWRnZSBpZGVudGlmaWVkIGJ5IHRoZSBpZCBgZWAuIElmIG5vXG4gKiBzdWNoIGVkZ2UgZXhpc3RzIGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZSBhbiBlZGdlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnNvdXJjZSA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIHRoaXMuX3N0cmljdEdldEVkZ2UoZSkudTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIHRoZSB0YXJnZXQgbm9kZSBpbmNpZGVudCBvbiB0aGUgZWRnZSBpZGVudGlmaWVkIGJ5IHRoZSBpZCBgZWAuIElmIG5vXG4gKiBzdWNoIGVkZ2UgZXhpc3RzIGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZSBhbiBlZGdlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnRhcmdldCA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIHRoaXMuX3N0cmljdEdldEVkZ2UoZSkudjtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGlkcyBmb3IgYWxsIGVkZ2VzIGluIHRoZSBncmFwaCB0aGF0IGhhdmUgdGhlIG5vZGVcbiAqIGB0YXJnZXRgIGFzIHRoZWlyIHRhcmdldC4gSWYgdGhlIG5vZGUgYHRhcmdldGAgaXMgbm90IGluIHRoZSBncmFwaCB0aGlzXG4gKiBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogT3B0aW9uYWxseSBhIGBzb3VyY2VgIG5vZGUgY2FuIGFsc28gYmUgc3BlY2lmaWVkLiBUaGlzIGNhdXNlcyB0aGUgcmVzdWx0c1xuICogdG8gYmUgZmlsdGVyZWQgc3VjaCB0aGF0IG9ubHkgZWRnZXMgZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YCBhcmUgaW5jbHVkZWQuXG4gKiBJZiB0aGUgbm9kZSBgc291cmNlYCBpcyBzcGVjaWZpZWQgYnV0IGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhlbiB0aGlzIGZ1bmN0aW9uXG4gKiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHRhcmdldCB0aGUgdGFyZ2V0IG5vZGUgaWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBbc291cmNlXSBhbiBvcHRpb25hbCBzb3VyY2Ugbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5pbkVkZ2VzID0gZnVuY3Rpb24odGFyZ2V0LCBzb3VyY2UpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh0YXJnZXQpO1xuICB2YXIgcmVzdWx0cyA9IFNldC51bmlvbih1dGlsLnZhbHVlcyh0aGlzLl9pbkVkZ2VzW3RhcmdldF0pKS5rZXlzKCk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgIHRoaXMuX3N0cmljdEdldE5vZGUoc291cmNlKTtcbiAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIoZnVuY3Rpb24oZSkgeyByZXR1cm4gdGhpcy5zb3VyY2UoZSkgPT09IHNvdXJjZTsgfSwgdGhpcyk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBpZHMgZm9yIGFsbCBlZGdlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIHRoZSBub2RlXG4gKiBgc291cmNlYCBhcyB0aGVpciBzb3VyY2UuIElmIHRoZSBub2RlIGBzb3VyY2VgIGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhpc1xuICogZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIE9wdGlvbmFsbHkgYSBgdGFyZ2V0YCBub2RlIG1heSBhbHNvIGJlIHNwZWNpZmllZC4gVGhpcyBjYXVzZXMgdGhlIHJlc3VsdHNcbiAqIHRvIGJlIGZpbHRlcmVkIHN1Y2ggdGhhdCBvbmx5IGVkZ2VzIGZyb20gYHNvdXJjZWAgdG8gYHRhcmdldGAgYXJlIGluY2x1ZGVkLlxuICogSWYgdGhlIG5vZGUgYHRhcmdldGAgaXMgc3BlY2lmaWVkIGJ1dCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoZW4gdGhpcyBmdW5jdGlvblxuICogcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2UgdGhlIHNvdXJjZSBub2RlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gW3RhcmdldF0gYW4gb3B0aW9uYWwgdGFyZ2V0IG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUub3V0RWRnZXMgPSBmdW5jdGlvbihzb3VyY2UsIHRhcmdldCkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHNvdXJjZSk7XG4gIHZhciByZXN1bHRzID0gU2V0LnVuaW9uKHV0aWwudmFsdWVzKHRoaXMuX291dEVkZ2VzW3NvdXJjZV0pKS5rZXlzKCk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgIHRoaXMuX3N0cmljdEdldE5vZGUodGFyZ2V0KTtcbiAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIoZnVuY3Rpb24oZSkgeyByZXR1cm4gdGhpcy50YXJnZXQoZSkgPT09IHRhcmdldDsgfSwgdGhpcyk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBpZHMgZm9yIGFsbCBlZGdlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIHRoZSBgdWAgYXNcbiAqIHRoZWlyIHNvdXJjZSBvciB0aGVpciB0YXJnZXQuIElmIHRoZSBub2RlIGB1YCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoaXNcbiAqIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBPcHRpb25hbGx5IGEgYHZgIG5vZGUgbWF5IGFsc28gYmUgc3BlY2lmaWVkLiBUaGlzIGNhdXNlcyB0aGUgcmVzdWx0cyB0byBiZVxuICogZmlsdGVyZWQgc3VjaCB0aGF0IG9ubHkgZWRnZXMgYmV0d2VlbiBgdWAgYW5kIGB2YCAtIGluIGVpdGhlciBkaXJlY3Rpb24gLVxuICogYXJlIGluY2x1ZGVkLiBJRiB0aGUgbm9kZSBgdmAgaXMgc3BlY2lmaWVkIGJ1dCBub3QgaW4gdGhlIGdyYXBoIHRoZW4gdGhpc1xuICogZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IHRoZSBub2RlIGZvciB3aGljaCB0byBmaW5kIGluY2lkZW50IGVkZ2VzXG4gKiBAcGFyYW0ge1N0cmluZ30gW3ZdIG9wdGlvbiBub2RlIHRoYXQgbXVzdCBiZSBhZGphY2VudCB0byBgdWBcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuaW5jaWRlbnRFZGdlcyA9IGZ1bmN0aW9uKHUsIHYpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgcmV0dXJuIFNldC51bmlvbihbdGhpcy5vdXRFZGdlcyh1LCB2KSwgdGhpcy5vdXRFZGdlcyh2LCB1KV0pLmtleXMoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gU2V0LnVuaW9uKFt0aGlzLmluRWRnZXModSksIHRoaXMub3V0RWRnZXModSldKS5rZXlzKCk7XG4gIH1cbn07XG5cbi8qXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgZ3JhcGguXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkRpZ3JhcGggXCIgKyBKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCAyKTtcbn07XG5cbi8qXG4gKiBBZGRzIGEgbmV3IG5vZGUgd2l0aCB0aGUgaWQgYHVgIHRvIHRoZSBncmFwaCBhbmQgYXNzaWducyBpdCB0aGUgdmFsdWVcbiAqIGB2YWx1ZWAuIElmIGEgbm9kZSB3aXRoIHRoZSBpZCBpcyBhbHJlYWR5IGEgcGFydCBvZiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvblxuICogdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gYW4gb3B0aW9uYWwgdmFsdWUgdG8gYXR0YWNoIHRvIHRoZSBub2RlXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmFkZE5vZGUgPSBmdW5jdGlvbih1LCB2YWx1ZSkge1xuICB1ID0gQmFzZUdyYXBoLnByb3RvdHlwZS5hZGROb2RlLmNhbGwodGhpcywgdSwgdmFsdWUpO1xuICB0aGlzLl9pbkVkZ2VzW3VdID0ge307XG4gIHRoaXMuX291dEVkZ2VzW3VdID0ge307XG4gIHJldHVybiB1O1xufTtcblxuLypcbiAqIFJlbW92ZXMgYSBub2RlIGZyb20gdGhlIGdyYXBoIHRoYXQgaGFzIHRoZSBpZCBgdWAuIEFueSBlZGdlcyBpbmNpZGVudCBvbiB0aGVcbiAqIG5vZGUgYXJlIGFsc28gcmVtb3ZlZC4gSWYgdGhlIGdyYXBoIGRvZXMgbm90IGNvbnRhaW4gYSBub2RlIHdpdGggdGhlIGlkIHRoaXNcbiAqIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmRlbE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gIEJhc2VHcmFwaC5wcm90b3R5cGUuZGVsTm9kZS5jYWxsKHRoaXMsIHUpO1xuICBkZWxldGUgdGhpcy5faW5FZGdlc1t1XTtcbiAgZGVsZXRlIHRoaXMuX291dEVkZ2VzW3VdO1xufTtcblxuLypcbiAqIEFkZHMgYSBuZXcgZWRnZSB0byB0aGUgZ3JhcGggd2l0aCB0aGUgaWQgYGVgIGZyb20gYSBub2RlIHdpdGggdGhlIGlkIGBzb3VyY2VgXG4gKiB0byBhIG5vZGUgd2l0aCBhbiBpZCBgdGFyZ2V0YCBhbmQgYXNzaWducyBpdCB0aGUgdmFsdWUgYHZhbHVlYC4gVGhpcyBncmFwaFxuICogYWxsb3dzIG1vcmUgdGhhbiBvbmUgZWRnZSBmcm9tIGBzb3VyY2VgIHRvIGB0YXJnZXRgIGFzIGxvbmcgYXMgdGhlIGlkIGBlYFxuICogaXMgdW5pcXVlIGluIHRoZSBzZXQgb2YgZWRnZXMuIElmIGBlYCBpcyBgbnVsbGAgdGhlIGdyYXBoIHdpbGwgYXNzaWduIGFcbiAqIHVuaXF1ZSBpZGVudGlmaWVyIHRvIHRoZSBlZGdlLlxuICpcbiAqIElmIGBzb3VyY2VgIG9yIGB0YXJnZXRgIGFyZSBub3QgcHJlc2VudCBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB3aWxsXG4gKiB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW2VdIGFuIGVkZ2UgaWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2UgdGhlIHNvdXJjZSBub2RlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gdGFyZ2V0IHRoZSB0YXJnZXQgbm9kZSBpZFxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gYW4gb3B0aW9uYWwgdmFsdWUgdG8gYXR0YWNoIHRvIHRoZSBlZGdlXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmFkZEVkZ2UgPSBmdW5jdGlvbihlLCBzb3VyY2UsIHRhcmdldCwgdmFsdWUpIHtcbiAgcmV0dXJuIEJhc2VHcmFwaC5wcm90b3R5cGUuX2FkZEVkZ2UuY2FsbCh0aGlzLCBlLCBzb3VyY2UsIHRhcmdldCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5FZGdlcywgdGhpcy5fb3V0RWRnZXMpO1xufTtcblxuLypcbiAqIFJlbW92ZXMgYW4gZWRnZSBpbiB0aGUgZ3JhcGggd2l0aCB0aGUgaWQgYGVgLiBJZiBubyBlZGdlIGluIHRoZSBncmFwaCBoYXNcbiAqIHRoZSBpZCBgZWAgdGhpcyBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBlIGFuIGVkZ2UgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuZGVsRWRnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgQmFzZUdyYXBoLnByb3RvdHlwZS5fZGVsRWRnZS5jYWxsKHRoaXMsIGUsIHRoaXMuX2luRWRnZXMsIHRoaXMuX291dEVkZ2VzKTtcbn07XG5cbi8vIFVubGlrZSBCYXNlR3JhcGguZmlsdGVyTm9kZXMsIHRoaXMgaGVscGVyIGp1c3QgcmV0dXJucyBub2RlcyB0aGF0XG4vLyBzYXRpc2Z5IGEgcHJlZGljYXRlLlxuRGlncmFwaC5wcm90b3R5cGUuX2ZpbHRlck5vZGVzID0gZnVuY3Rpb24ocHJlZCkge1xuICB2YXIgZmlsdGVyZWQgPSBbXTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgaWYgKHByZWQodSkpIHtcbiAgICAgIGZpbHRlcmVkLnB1c2godSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGZpbHRlcmVkO1xufTtcblxuIiwiLypcbiAqIFRoaXMgZmlsZSBpcyBvcmdhbml6ZWQgd2l0aCBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICpcbiAqIEV4cG9ydHNcbiAqIEdyYXBoIGNvbnN0cnVjdG9yc1xuICogR3JhcGggcXVlcmllcyAoZS5nLiBub2RlcygpLCBlZGdlcygpXG4gKiBHcmFwaCBtdXRhdG9yc1xuICogSGVscGVyIGZ1bmN0aW9uc1xuICovXG5cbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKSxcbiAgICBCYXNlR3JhcGggPSByZXF1aXJlKFwiLi9CYXNlR3JhcGhcIiksXG4vKiBqc2hpbnQgLVcwNzkgKi9cbiAgICBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBHcmFwaDtcblxuLypcbiAqIENvbnN0cnVjdG9yIHRvIGNyZWF0ZSBhIG5ldyB1bmRpcmVjdGVkIG11bHRpLWdyYXBoLlxuICovXG5mdW5jdGlvbiBHcmFwaCgpIHtcbiAgQmFzZUdyYXBoLmNhbGwodGhpcyk7XG5cbiAgLyohIE1hcCBvZiBub2RlSWQgLT4geyBvdGhlck5vZGVJZCAtPiBTZXQgb2YgZWRnZSBpZHMgfSAqL1xuICB0aGlzLl9pbmNpZGVudEVkZ2VzID0ge307XG59XG5cbkdyYXBoLnByb3RvdHlwZSA9IG5ldyBCYXNlR3JhcGgoKTtcbkdyYXBoLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEdyYXBoO1xuXG4vKlxuICogQWx3YXlzIHJldHVybnMgYGZhbHNlYC5cbiAqL1xuR3JhcGgucHJvdG90eXBlLmlzRGlyZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIG5vZGVzIHRoYXQgYXJlIGFkamFjZW50IHRvIHRoZSBub2RlIHdpdGggdGhlIGlkIGB1YC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqL1xuR3JhcGgucHJvdG90eXBlLm5laWdoYm9ycyA9IGZ1bmN0aW9uKHUpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2luY2lkZW50RWRnZXNbdV0pXG4gICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHRoaXMuX25vZGVzW3ZdLmlkOyB9LCB0aGlzKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGlkcyBmb3IgYWxsIGVkZ2VzIGluIHRoZSBncmFwaCB0aGF0IGFyZSBpbmNpZGVudCBvbiBgdWAuXG4gKiBJZiB0aGUgbm9kZSBgdWAgaXMgbm90IGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBPcHRpb25hbGx5IGEgYHZgIG5vZGUgbWF5IGFsc28gYmUgc3BlY2lmaWVkLiBUaGlzIGNhdXNlcyB0aGUgcmVzdWx0cyB0byBiZVxuICogZmlsdGVyZWQgc3VjaCB0aGF0IG9ubHkgZWRnZXMgYmV0d2VlbiBgdWAgYW5kIGB2YCBhcmUgaW5jbHVkZWQuIElmIHRoZSBub2RlXG4gKiBgdmAgaXMgc3BlY2lmaWVkIGJ1dCBub3QgaW4gdGhlIGdyYXBoIHRoZW4gdGhpcyBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgdGhlIG5vZGUgZm9yIHdoaWNoIHRvIGZpbmQgaW5jaWRlbnQgZWRnZXNcbiAqIEBwYXJhbSB7U3RyaW5nfSBbdl0gb3B0aW9uIG5vZGUgdGhhdCBtdXN0IGJlIGFkamFjZW50IHRvIGB1YFxuICovXG5HcmFwaC5wcm90b3R5cGUuaW5jaWRlbnRFZGdlcyA9IGZ1bmN0aW9uKHUsIHYpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh2KTtcbiAgICByZXR1cm4gdiBpbiB0aGlzLl9pbmNpZGVudEVkZ2VzW3VdID8gdGhpcy5faW5jaWRlbnRFZGdlc1t1XVt2XS5rZXlzKCkgOiBbXTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gU2V0LnVuaW9uKHV0aWwudmFsdWVzKHRoaXMuX2luY2lkZW50RWRnZXNbdV0pKS5rZXlzKCk7XG4gIH1cbn07XG5cbi8qXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgZ3JhcGguXG4gKi9cbkdyYXBoLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJHcmFwaCBcIiArIEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIDIpO1xufTtcblxuLypcbiAqIEFkZHMgYSBuZXcgbm9kZSB3aXRoIHRoZSBpZCBgdWAgdG8gdGhlIGdyYXBoIGFuZCBhc3NpZ25zIGl0IHRoZSB2YWx1ZVxuICogYHZhbHVlYC4gSWYgYSBub2RlIHdpdGggdGhlIGlkIGlzIGFscmVhZHkgYSBwYXJ0IG9mIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uXG4gKiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKiBAcGFyYW0ge09iamVjdH0gW3ZhbHVlXSBhbiBvcHRpb25hbCB2YWx1ZSB0byBhdHRhY2ggdG8gdGhlIG5vZGVcbiAqL1xuR3JhcGgucHJvdG90eXBlLmFkZE5vZGUgPSBmdW5jdGlvbih1LCB2YWx1ZSkge1xuICB1ID0gQmFzZUdyYXBoLnByb3RvdHlwZS5hZGROb2RlLmNhbGwodGhpcywgdSwgdmFsdWUpO1xuICB0aGlzLl9pbmNpZGVudEVkZ2VzW3VdID0ge307XG4gIHJldHVybiB1O1xufTtcblxuLypcbiAqIFJlbW92ZXMgYSBub2RlIGZyb20gdGhlIGdyYXBoIHRoYXQgaGFzIHRoZSBpZCBgdWAuIEFueSBlZGdlcyBpbmNpZGVudCBvbiB0aGVcbiAqIG5vZGUgYXJlIGFsc28gcmVtb3ZlZC4gSWYgdGhlIGdyYXBoIGRvZXMgbm90IGNvbnRhaW4gYSBub2RlIHdpdGggdGhlIGlkIHRoaXNcbiAqIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5kZWxOb2RlID0gZnVuY3Rpb24odSkge1xuICBCYXNlR3JhcGgucHJvdG90eXBlLmRlbE5vZGUuY2FsbCh0aGlzLCB1KTtcbiAgZGVsZXRlIHRoaXMuX2luY2lkZW50RWRnZXNbdV07XG59O1xuXG4vKlxuICogQWRkcyBhIG5ldyBlZGdlIHRvIHRoZSBncmFwaCB3aXRoIHRoZSBpZCBgZWAgYmV0d2VlbiBhIG5vZGUgd2l0aCB0aGUgaWQgYHVgXG4gKiBhbmQgYSBub2RlIHdpdGggYW4gaWQgYHZgIGFuZCBhc3NpZ25zIGl0IHRoZSB2YWx1ZSBgdmFsdWVgLiBUaGlzIGdyYXBoXG4gKiBhbGxvd3MgbW9yZSB0aGFuIG9uZSBlZGdlIGJldHdlZW4gYHVgIGFuZCBgdmAgYXMgbG9uZyBhcyB0aGUgaWQgYGVgXG4gKiBpcyB1bmlxdWUgaW4gdGhlIHNldCBvZiBlZGdlcy4gSWYgYGVgIGlzIGBudWxsYCB0aGUgZ3JhcGggd2lsbCBhc3NpZ24gYVxuICogdW5pcXVlIGlkZW50aWZpZXIgdG8gdGhlIGVkZ2UuXG4gKlxuICogSWYgYHVgIG9yIGB2YCBhcmUgbm90IHByZXNlbnQgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gd2lsbCB0aHJvdyBhblxuICogRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IFtlXSBhbiBlZGdlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gdSB0aGUgbm9kZSBpZCBvZiBvbmUgb2YgdGhlIGFkamFjZW50IG5vZGVzXG4gKiBAcGFyYW0ge1N0cmluZ30gdiB0aGUgbm9kZSBpZCBvZiB0aGUgb3RoZXIgYWRqYWNlbnQgbm9kZVxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gYW4gb3B0aW9uYWwgdmFsdWUgdG8gYXR0YWNoIHRvIHRoZSBlZGdlXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5hZGRFZGdlID0gZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgcmV0dXJuIEJhc2VHcmFwaC5wcm90b3R5cGUuX2FkZEVkZ2UuY2FsbCh0aGlzLCBlLCB1LCB2LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9pbmNpZGVudEVkZ2VzLCB0aGlzLl9pbmNpZGVudEVkZ2VzKTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGFuIGVkZ2UgaW4gdGhlIGdyYXBoIHdpdGggdGhlIGlkIGBlYC4gSWYgbm8gZWRnZSBpbiB0aGUgZ3JhcGggaGFzXG4gKiB0aGUgaWQgYGVgIHRoaXMgZnVuY3Rpb24gd2lsbCB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZSBhbiBlZGdlIGlkXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5kZWxFZGdlID0gZnVuY3Rpb24oZSkge1xuICBCYXNlR3JhcGgucHJvdG90eXBlLl9kZWxFZGdlLmNhbGwodGhpcywgZSwgdGhpcy5faW5jaWRlbnRFZGdlcywgdGhpcy5faW5jaWRlbnRFZGdlcyk7XG59O1xuXG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb25lbnRzO1xuXG4vKipcbiAqIEZpbmRzIGFsbCBbY29ubmVjdGVkIGNvbXBvbmVudHNdW10gaW4gYSBncmFwaCBhbmQgcmV0dXJucyBhbiBhcnJheSBvZiB0aGVzZVxuICogY29tcG9uZW50cy4gRWFjaCBjb21wb25lbnQgaXMgaXRzZWxmIGFuIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIGlkcyBvZiBub2Rlc1xuICogaW4gdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIG9ubHkgd29ya3Mgd2l0aCB1bmRpcmVjdGVkIEdyYXBocy5cbiAqXG4gKiBbY29ubmVjdGVkIGNvbXBvbmVudHNdOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Nvbm5lY3RlZF9jb21wb25lbnRfKGdyYXBoX3RoZW9yeSlcbiAqXG4gKiBAcGFyYW0ge0dyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIGNvbXBvbmVudHNcbiAqL1xuZnVuY3Rpb24gY29tcG9uZW50cyhnKSB7XG4gIHZhciByZXN1bHRzID0gW107XG4gIHZhciB2aXNpdGVkID0gbmV3IFNldCgpO1xuXG4gIGZ1bmN0aW9uIGRmcyh2LCBjb21wb25lbnQpIHtcbiAgICBpZiAoIXZpc2l0ZWQuaGFzKHYpKSB7XG4gICAgICB2aXNpdGVkLmFkZCh2KTtcbiAgICAgIGNvbXBvbmVudC5wdXNoKHYpO1xuICAgICAgZy5uZWlnaGJvcnModikuZm9yRWFjaChmdW5jdGlvbih3KSB7XG4gICAgICAgIGRmcyh3LCBjb21wb25lbnQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZy5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgIHZhciBjb21wb25lbnQgPSBbXTtcbiAgICBkZnModiwgY29tcG9uZW50KTtcbiAgICBpZiAoY29tcG9uZW50Lmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdHMucHVzaChjb21wb25lbnQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJ2YXIgUHJpb3JpdHlRdWV1ZSA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlByaW9yaXR5UXVldWU7XG5cbm1vZHVsZS5leHBvcnRzID0gZGlqa3N0cmE7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBpcyBhbiBpbXBsZW1lbnRhdGlvbiBvZiBbRGlqa3N0cmEncyBhbGdvcml0aG1dW10gd2hpY2ggZmluZHNcbiAqIHRoZSBzaG9ydGVzdCBwYXRoIGZyb20gKipzb3VyY2UqKiB0byBhbGwgb3RoZXIgbm9kZXMgaW4gKipnKiouIFRoaXNcbiAqIGZ1bmN0aW9uIHJldHVybnMgYSBtYXAgb2YgYHUgLT4geyBkaXN0YW5jZSwgcHJlZGVjZXNzb3IgfWAuIFRoZSBkaXN0YW5jZVxuICogcHJvcGVydHkgaG9sZHMgdGhlIHN1bSBvZiB0aGUgd2VpZ2h0cyBmcm9tICoqc291cmNlKiogdG8gYHVgIGFsb25nIHRoZVxuICogc2hvcnRlc3QgcGF0aCBvciBgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZYCBpZiB0aGVyZSBpcyBubyBwYXRoIGZyb21cbiAqICoqc291cmNlKiouIFRoZSBwcmVkZWNlc3NvciBwcm9wZXJ0eSBjYW4gYmUgdXNlZCB0byB3YWxrIHRoZSBpbmRpdmlkdWFsXG4gKiBlbGVtZW50cyBvZiB0aGUgcGF0aCBmcm9tICoqc291cmNlKiogdG8gKip1KiogaW4gcmV2ZXJzZSBvcmRlci5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGB3ZWlnaHRGdW5jKGUpYCB3aGljaCByZXR1cm5zIHRoZVxuICogd2VpZ2h0IG9mIHRoZSBlZGdlIGBlYC4gSWYgbm8gd2VpZ2h0RnVuYyBpcyBzdXBwbGllZCB0aGVuIGVhY2ggZWRnZSBpc1xuICogYXNzdW1lZCB0byBoYXZlIGEgd2VpZ2h0IG9mIDEuIFRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yIGlmIGFueSBvZlxuICogdGhlIHRyYXZlcnNlZCBlZGdlcyBoYXZlIGEgbmVnYXRpdmUgZWRnZSB3ZWlnaHQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgaW5jaWRlbnRGdW5jKHUpYCB3aGljaCByZXR1cm5zIHRoZSBpZHMgb2ZcbiAqIGFsbCBlZGdlcyBpbmNpZGVudCB0byB0aGUgbm9kZSBgdWAgZm9yIHRoZSBwdXJwb3NlcyBvZiBzaG9ydGVzdCBwYXRoXG4gKiB0cmF2ZXJzYWwuIEJ5IGRlZmF1bHQgdGhpcyBmdW5jdGlvbiB1c2VzIHRoZSBgZy5vdXRFZGdlc2AgZm9yIERpZ3JhcGhzIGFuZFxuICogYGcuaW5jaWRlbnRFZGdlc2AgZm9yIEdyYXBocy5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGBPKCh8RXwgKyB8VnwpICogbG9nIHxWfClgIHRpbWUuXG4gKlxuICogW0RpamtzdHJhJ3MgYWxnb3JpdGhtXTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9EaWprc3RyYSUyN3NfYWxnb3JpdGhtXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBzaG9ydGVzdCBwYXRocyBmcm9tICoqc291cmNlKipcbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgdGhlIHNvdXJjZSBmcm9tIHdoaWNoIHRvIHN0YXJ0IHRoZSBzZWFyY2hcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFt3ZWlnaHRGdW5jXSBvcHRpb25hbCB3ZWlnaHQgZnVuY3Rpb25cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtpbmNpZGVudEZ1bmNdIG9wdGlvbmFsIGluY2lkZW50IGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGRpamtzdHJhKGcsIHNvdXJjZSwgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKSB7XG4gIHZhciByZXN1bHRzID0ge30sXG4gICAgICBwcSA9IG5ldyBQcmlvcml0eVF1ZXVlKCk7XG5cbiAgZnVuY3Rpb24gdXBkYXRlTmVpZ2hib3JzKGUpIHtcbiAgICB2YXIgaW5jaWRlbnROb2RlcyA9IGcuaW5jaWRlbnROb2RlcyhlKSxcbiAgICAgICAgdiA9IGluY2lkZW50Tm9kZXNbMF0gIT09IHUgPyBpbmNpZGVudE5vZGVzWzBdIDogaW5jaWRlbnROb2Rlc1sxXSxcbiAgICAgICAgdkVudHJ5ID0gcmVzdWx0c1t2XSxcbiAgICAgICAgd2VpZ2h0ID0gd2VpZ2h0RnVuYyhlKSxcbiAgICAgICAgZGlzdGFuY2UgPSB1RW50cnkuZGlzdGFuY2UgKyB3ZWlnaHQ7XG5cbiAgICBpZiAod2VpZ2h0IDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZGlqa3N0cmEgZG9lcyBub3QgYWxsb3cgbmVnYXRpdmUgZWRnZSB3ZWlnaHRzLiBCYWQgZWRnZTogXCIgKyBlICsgXCIgV2VpZ2h0OiBcIiArIHdlaWdodCk7XG4gICAgfVxuXG4gICAgaWYgKGRpc3RhbmNlIDwgdkVudHJ5LmRpc3RhbmNlKSB7XG4gICAgICB2RW50cnkuZGlzdGFuY2UgPSBkaXN0YW5jZTtcbiAgICAgIHZFbnRyeS5wcmVkZWNlc3NvciA9IHU7XG4gICAgICBwcS5kZWNyZWFzZSh2LCBkaXN0YW5jZSk7XG4gICAgfVxuICB9XG5cbiAgd2VpZ2h0RnVuYyA9IHdlaWdodEZ1bmMgfHwgZnVuY3Rpb24oKSB7IHJldHVybiAxOyB9O1xuICBpbmNpZGVudEZ1bmMgPSBpbmNpZGVudEZ1bmMgfHwgKGcuaXNEaXJlY3RlZCgpXG4gICAgICA/IGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGcub3V0RWRnZXModSk7IH1cbiAgICAgIDogZnVuY3Rpb24odSkgeyByZXR1cm4gZy5pbmNpZGVudEVkZ2VzKHUpOyB9KTtcblxuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHtcbiAgICB2YXIgZGlzdGFuY2UgPSB1ID09PSBzb3VyY2UgPyAwIDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgIHJlc3VsdHNbdV0gPSB7IGRpc3RhbmNlOiBkaXN0YW5jZSB9O1xuICAgIHBxLmFkZCh1LCBkaXN0YW5jZSk7XG4gIH0pO1xuXG4gIHZhciB1LCB1RW50cnk7XG4gIHdoaWxlIChwcS5zaXplKCkgPiAwKSB7XG4gICAgdSA9IHBxLnJlbW92ZU1pbigpO1xuICAgIHVFbnRyeSA9IHJlc3VsdHNbdV07XG4gICAgaWYgKHVFbnRyeS5kaXN0YW5jZSA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpbmNpZGVudEZ1bmModSkuZm9yRWFjaCh1cGRhdGVOZWlnaGJvcnMpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJ2YXIgZGlqa3N0cmEgPSByZXF1aXJlKFwiLi9kaWprc3RyYVwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBkaWprc3RyYUFsbDtcblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGZpbmRzIHRoZSBzaG9ydGVzdCBwYXRoIGZyb20gZWFjaCBub2RlIHRvIGV2ZXJ5IG90aGVyXG4gKiByZWFjaGFibGUgbm9kZSBpbiB0aGUgZ3JhcGguIEl0IGlzIHNpbWlsYXIgdG8gW2FsZy5kaWprc3RyYV1bXSwgYnV0XG4gKiBpbnN0ZWFkIG9mIHJldHVybmluZyBhIHNpbmdsZS1zb3VyY2UgYXJyYXksIGl0IHJldHVybnMgYSBtYXBwaW5nIG9mXG4gKiBvZiBgc291cmNlIC0+IGFsZy5kaWprc3RhKGcsIHNvdXJjZSwgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKWAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgd2VpZ2h0RnVuYyhlKWAgd2hpY2ggcmV0dXJucyB0aGVcbiAqIHdlaWdodCBvZiB0aGUgZWRnZSBgZWAuIElmIG5vIHdlaWdodEZ1bmMgaXMgc3VwcGxpZWQgdGhlbiBlYWNoIGVkZ2UgaXNcbiAqIGFzc3VtZWQgdG8gaGF2ZSBhIHdlaWdodCBvZiAxLiBUaGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvciBpZiBhbnkgb2ZcbiAqIHRoZSB0cmF2ZXJzZWQgZWRnZXMgaGF2ZSBhIG5lZ2F0aXZlIGVkZ2Ugd2VpZ2h0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYGluY2lkZW50RnVuYyh1KWAgd2hpY2ggcmV0dXJucyB0aGUgaWRzIG9mXG4gKiBhbGwgZWRnZXMgaW5jaWRlbnQgdG8gdGhlIG5vZGUgYHVgIGZvciB0aGUgcHVycG9zZXMgb2Ygc2hvcnRlc3QgcGF0aFxuICogdHJhdmVyc2FsLiBCeSBkZWZhdWx0IHRoaXMgZnVuY3Rpb24gdXNlcyB0aGUgYG91dEVkZ2VzYCBmdW5jdGlvbiBvbiB0aGVcbiAqIHN1cHBsaWVkIGdyYXBoLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYE8ofFZ8ICogKHxFfCArIHxWfCkgKiBsb2cgfFZ8KWAgdGltZS5cbiAqXG4gKiBbYWxnLmRpamtzdHJhXTogZGlqa3N0cmEuanMuaHRtbCNkaWprc3RyYVxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3Igc2hvcnRlc3QgcGF0aHMgZnJvbSAqKnNvdXJjZSoqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbd2VpZ2h0RnVuY10gb3B0aW9uYWwgd2VpZ2h0IGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaW5jaWRlbnRGdW5jXSBvcHRpb25hbCBpbmNpZGVudCBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkaWprc3RyYUFsbChnLCB3ZWlnaHRGdW5jLCBpbmNpZGVudEZ1bmMpIHtcbiAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgcmVzdWx0c1t1XSA9IGRpamtzdHJhKGcsIHUsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYyk7XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsInZhciB0YXJqYW4gPSByZXF1aXJlKFwiLi90YXJqYW5cIik7XG5cbm1vZHVsZS5leHBvcnRzID0gZmluZEN5Y2xlcztcblxuLypcbiAqIEdpdmVuIGEgRGlncmFwaCAqKmcqKiB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYWxsIG5vZGVzIHRoYXQgYXJlIHBhcnQgb2YgYVxuICogY3ljbGUuIFNpbmNlIHRoZXJlIG1heSBiZSBtb3JlIHRoYW4gb25lIGN5Y2xlIGluIGEgZ3JhcGggdGhpcyBmdW5jdGlvblxuICogcmV0dXJucyBhbiBhcnJheSBvZiB0aGVzZSBjeWNsZXMsIHdoZXJlIGVhY2ggY3ljbGUgaXMgaXRzZWxmIHJlcHJlc2VudGVkXG4gKiBieSBhbiBhcnJheSBvZiBpZHMgZm9yIGVhY2ggbm9kZSBpbnZvbHZlZCBpbiB0aGF0IGN5Y2xlLlxuICpcbiAqIFthbGcuaXNBY3ljbGljXVtdIGlzIG1vcmUgZWZmaWNpZW50IGlmIHlvdSBvbmx5IG5lZWQgdG8gZGV0ZXJtaW5lIHdoZXRoZXJcbiAqIGEgZ3JhcGggaGFzIGEgY3ljbGUgb3Igbm90LlxuICpcbiAqIFthbGcuaXNBY3ljbGljXTogaXNBY3ljbGljLmpzLmh0bWwjaXNBY3ljbGljXG4gKlxuICogQHBhcmFtIHtEaWdyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIGN5Y2xlcy5cbiAqL1xuZnVuY3Rpb24gZmluZEN5Y2xlcyhnKSB7XG4gIHJldHVybiB0YXJqYW4oZykuZmlsdGVyKGZ1bmN0aW9uKGNtcHQpIHsgcmV0dXJuIGNtcHQubGVuZ3RoID4gMTsgfSk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZsb3lkV2Fyc2hhbGw7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBpcyBhbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgW0Zsb3lkLVdhcnNoYWxsIGFsZ29yaXRobV1bXSxcbiAqIHdoaWNoIGZpbmRzIHRoZSBzaG9ydGVzdCBwYXRoIGZyb20gZWFjaCBub2RlIHRvIGV2ZXJ5IG90aGVyIHJlYWNoYWJsZSBub2RlXG4gKiBpbiB0aGUgZ3JhcGguIEl0IGlzIHNpbWlsYXIgdG8gW2FsZy5kaWprc3RyYUFsbF1bXSwgYnV0IGl0IGhhbmRsZXMgbmVnYXRpdmVcbiAqIGVkZ2Ugd2VpZ2h0cyBhbmQgaXMgbW9yZSBlZmZpY2llbnQgZm9yIHNvbWUgdHlwZXMgb2YgZ3JhcGhzLiBUaGlzIGZ1bmN0aW9uXG4gKiByZXR1cm5zIGEgbWFwIG9mIGBzb3VyY2UgLT4geyB0YXJnZXQgLT4geyBkaXN0YW5jZSwgcHJlZGVjZXNzb3IgfWAuIFRoZVxuICogZGlzdGFuY2UgcHJvcGVydHkgaG9sZHMgdGhlIHN1bSBvZiB0aGUgd2VpZ2h0cyBmcm9tIGBzb3VyY2VgIHRvIGB0YXJnZXRgXG4gKiBhbG9uZyB0aGUgc2hvcnRlc3QgcGF0aCBvZiBgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZYCBpZiB0aGVyZSBpcyBubyBwYXRoXG4gKiBmcm9tIGBzb3VyY2VgLiBUaGUgcHJlZGVjZXNzb3IgcHJvcGVydHkgY2FuIGJlIHVzZWQgdG8gd2FsayB0aGUgaW5kaXZpZHVhbFxuICogZWxlbWVudHMgb2YgdGhlIHBhdGggZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YCBpbiByZXZlcnNlIG9yZGVyLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYHdlaWdodEZ1bmMoZSlgIHdoaWNoIHJldHVybnMgdGhlXG4gKiB3ZWlnaHQgb2YgdGhlIGVkZ2UgYGVgLiBJZiBubyB3ZWlnaHRGdW5jIGlzIHN1cHBsaWVkIHRoZW4gZWFjaCBlZGdlIGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYSB3ZWlnaHQgb2YgMS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGBpbmNpZGVudEZ1bmModSlgIHdoaWNoIHJldHVybnMgdGhlIGlkcyBvZlxuICogYWxsIGVkZ2VzIGluY2lkZW50IHRvIHRoZSBub2RlIGB1YCBmb3IgdGhlIHB1cnBvc2VzIG9mIHNob3J0ZXN0IHBhdGhcbiAqIHRyYXZlcnNhbC4gQnkgZGVmYXVsdCB0aGlzIGZ1bmN0aW9uIHVzZXMgdGhlIGBvdXRFZGdlc2AgZnVuY3Rpb24gb24gdGhlXG4gKiBzdXBwbGllZCBncmFwaC5cbiAqXG4gKiBUaGlzIGFsZ29yaXRobSB0YWtlcyBPKHxWfF4zKSB0aW1lLlxuICpcbiAqIFtGbG95ZC1XYXJzaGFsbCBhbGdvcml0aG1dOiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GbG95ZC1XYXJzaGFsbF9hbGdvcml0aG1cbiAqIFthbGcuZGlqa3N0cmFBbGxdOiBkaWprc3RyYUFsbC5qcy5odG1sI2RpamtzdHJhQWxsXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBzaG9ydGVzdCBwYXRocyBmcm9tICoqc291cmNlKipcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFt3ZWlnaHRGdW5jXSBvcHRpb25hbCB3ZWlnaHQgZnVuY3Rpb25cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtpbmNpZGVudEZ1bmNdIG9wdGlvbmFsIGluY2lkZW50IGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGZsb3lkV2Fyc2hhbGwoZywgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKSB7XG4gIHZhciByZXN1bHRzID0ge30sXG4gICAgICBub2RlcyA9IGcubm9kZXMoKTtcblxuICB3ZWlnaHRGdW5jID0gd2VpZ2h0RnVuYyB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIDE7IH07XG4gIGluY2lkZW50RnVuYyA9IGluY2lkZW50RnVuYyB8fCAoZy5pc0RpcmVjdGVkKClcbiAgICAgID8gZnVuY3Rpb24odSkgeyByZXR1cm4gZy5vdXRFZGdlcyh1KTsgfVxuICAgICAgOiBmdW5jdGlvbih1KSB7IHJldHVybiBnLmluY2lkZW50RWRnZXModSk7IH0pO1xuXG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHJlc3VsdHNbdV0gPSB7fTtcbiAgICByZXN1bHRzW3VdW3VdID0geyBkaXN0YW5jZTogMCB9O1xuICAgIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgaWYgKHUgIT09IHYpIHtcbiAgICAgICAgcmVzdWx0c1t1XVt2XSA9IHsgZGlzdGFuY2U6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSB9O1xuICAgICAgfVxuICAgIH0pO1xuICAgIGluY2lkZW50RnVuYyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHZhciBpbmNpZGVudE5vZGVzID0gZy5pbmNpZGVudE5vZGVzKGUpLFxuICAgICAgICAgIHYgPSBpbmNpZGVudE5vZGVzWzBdICE9PSB1ID8gaW5jaWRlbnROb2Rlc1swXSA6IGluY2lkZW50Tm9kZXNbMV0sXG4gICAgICAgICAgZCA9IHdlaWdodEZ1bmMoZSk7XG4gICAgICBpZiAoZCA8IHJlc3VsdHNbdV1bdl0uZGlzdGFuY2UpIHtcbiAgICAgICAgcmVzdWx0c1t1XVt2XSA9IHsgZGlzdGFuY2U6IGQsIHByZWRlY2Vzc29yOiB1IH07XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xuXG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgIHZhciByb3dLID0gcmVzdWx0c1trXTtcbiAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHZhciByb3dJID0gcmVzdWx0c1tpXTtcbiAgICAgIG5vZGVzLmZvckVhY2goZnVuY3Rpb24oaikge1xuICAgICAgICB2YXIgaWsgPSByb3dJW2tdO1xuICAgICAgICB2YXIga2ogPSByb3dLW2pdO1xuICAgICAgICB2YXIgaWogPSByb3dJW2pdO1xuICAgICAgICB2YXIgYWx0RGlzdGFuY2UgPSBpay5kaXN0YW5jZSArIGtqLmRpc3RhbmNlO1xuICAgICAgICBpZiAoYWx0RGlzdGFuY2UgPCBpai5kaXN0YW5jZSkge1xuICAgICAgICAgIGlqLmRpc3RhbmNlID0gYWx0RGlzdGFuY2U7XG4gICAgICAgICAgaWoucHJlZGVjZXNzb3IgPSBrai5wcmVkZWNlc3NvcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHRzO1xufVxuIiwidmFyIHRvcHNvcnQgPSByZXF1aXJlKFwiLi90b3Bzb3J0XCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQWN5Y2xpYztcblxuLypcbiAqIEdpdmVuIGEgRGlncmFwaCAqKmcqKiB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYHRydWVgIGlmIHRoZSBncmFwaCBoYXMgbm9cbiAqIGN5Y2xlcyBhbmQgcmV0dXJucyBgZmFsc2VgIGlmIGl0IGRvZXMuIFRoaXMgYWxnb3JpdGhtIHJldHVybnMgYXMgc29vbiBhcyBpdFxuICogZGV0ZWN0cyB0aGUgZmlyc3QgY3ljbGUuXG4gKlxuICogVXNlIFthbGcuZmluZEN5Y2xlc11bXSBpZiB5b3UgbmVlZCB0aGUgYWN0dWFsIGxpc3Qgb2YgY3ljbGVzIGluIGEgZ3JhcGguXG4gKlxuICogW2FsZy5maW5kQ3ljbGVzXTogZmluZEN5Y2xlcy5qcy5odG1sI2ZpbmRDeWNsZXNcbiAqXG4gKiBAcGFyYW0ge0RpZ3JhcGh9IGcgdGhlIGdyYXBoIHRvIHRlc3QgZm9yIGN5Y2xlc1xuICovXG5mdW5jdGlvbiBpc0FjeWNsaWMoZykge1xuICB0cnkge1xuICAgIHRvcHNvcnQoZyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIHRvcHNvcnQuQ3ljbGVFeGNlcHRpb24pIHJldHVybiBmYWxzZTtcbiAgICB0aHJvdyBlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gcG9zdG9yZGVyO1xuXG4vLyBQb3N0b3JkZXIgdHJhdmVyc2FsIG9mIGcsIGNhbGxpbmcgZiBmb3IgZWFjaCB2aXNpdGVkIG5vZGUuIEFzc3VtZXMgdGhlIGdyYXBoXG4vLyBpcyBhIHRyZWUuXG5mdW5jdGlvbiBwb3N0b3JkZXIoZywgcm9vdCwgZikge1xuICB2YXIgdmlzaXRlZCA9IG5ldyBTZXQoKTtcbiAgaWYgKGcuaXNEaXJlY3RlZCgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIGZvciB1bmRpcmVjdGVkIGdyYXBoc1wiKTtcbiAgfVxuICBmdW5jdGlvbiBkZnModSwgcHJldikge1xuICAgIGlmICh2aXNpdGVkLmhhcyh1KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGlucHV0IGdyYXBoIGlzIG5vdCBhIHRyZWU6IFwiICsgZyk7XG4gICAgfVxuICAgIHZpc2l0ZWQuYWRkKHUpO1xuICAgIGcubmVpZ2hib3JzKHUpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgaWYgKHYgIT09IHByZXYpIGRmcyh2LCB1KTtcbiAgICB9KTtcbiAgICBmKHUpO1xuICB9XG4gIGRmcyhyb290KTtcbn1cbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHByZW9yZGVyO1xuXG4vLyBQcmVvcmRlciB0cmF2ZXJzYWwgb2YgZywgY2FsbGluZyBmIGZvciBlYWNoIHZpc2l0ZWQgbm9kZS4gQXNzdW1lcyB0aGUgZ3JhcGhcbi8vIGlzIGEgdHJlZS5cbmZ1bmN0aW9uIHByZW9yZGVyKGcsIHJvb3QsIGYpIHtcbiAgdmFyIHZpc2l0ZWQgPSBuZXcgU2V0KCk7XG4gIGlmIChnLmlzRGlyZWN0ZWQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoaXMgZnVuY3Rpb24gb25seSB3b3JrcyBmb3IgdW5kaXJlY3RlZCBncmFwaHNcIik7XG4gIH1cbiAgZnVuY3Rpb24gZGZzKHUsIHByZXYpIHtcbiAgICBpZiAodmlzaXRlZC5oYXModSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBpbnB1dCBncmFwaCBpcyBub3QgYSB0cmVlOiBcIiArIGcpO1xuICAgIH1cbiAgICB2aXNpdGVkLmFkZCh1KTtcbiAgICBmKHUpO1xuICAgIGcubmVpZ2hib3JzKHUpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgaWYgKHYgIT09IHByZXYpIGRmcyh2LCB1KTtcbiAgICB9KTtcbiAgfVxuICBkZnMocm9vdCk7XG59XG4iLCJ2YXIgR3JhcGggPSByZXF1aXJlKFwiLi4vR3JhcGhcIiksXG4gICAgUHJpb3JpdHlRdWV1ZSA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlByaW9yaXR5UXVldWU7XG5cbm1vZHVsZS5leHBvcnRzID0gcHJpbTtcblxuLyoqXG4gKiBbUHJpbSdzIGFsZ29yaXRobV1bXSB0YWtlcyBhIGNvbm5lY3RlZCB1bmRpcmVjdGVkIGdyYXBoIGFuZCBnZW5lcmF0ZXMgYVxuICogW21pbmltdW0gc3Bhbm5pbmcgdHJlZV1bXS4gVGhpcyBmdW5jdGlvbiByZXR1cm5zIHRoZSBtaW5pbXVtIHNwYW5uaW5nXG4gKiB0cmVlIGFzIGFuIHVuZGlyZWN0ZWQgZ3JhcGguIFRoaXMgYWxnb3JpdGhtIGlzIGRlcml2ZWQgZnJvbSB0aGUgZGVzY3JpcHRpb25cbiAqIGluIFwiSW50cm9kdWN0aW9uIHRvIEFsZ29yaXRobXNcIiwgVGhpcmQgRWRpdGlvbiwgQ29ybWVuLCBldCBhbC4sIFBnIDYzNC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGEgYHdlaWdodEZ1bmMoZSlgIHdoaWNoIHJldHVybnMgdGhlIHdlaWdodCBvZiB0aGUgZWRnZVxuICogYGVgLiBJdCB0aHJvd3MgYW4gRXJyb3IgaWYgdGhlIGdyYXBoIGlzIG5vdCBjb25uZWN0ZWQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBgTyh8RXwgbG9nIHxWfClgIHRpbWUuXG4gKlxuICogW1ByaW0ncyBhbGdvcml0aG1dOiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9QcmltJ3NfYWxnb3JpdGhtXG4gKiBbbWluaW11bSBzcGFubmluZyB0cmVlXTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTWluaW11bV9zcGFubmluZ190cmVlXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdXNlZCB0byBnZW5lcmF0ZSB0aGUgbWluaW11bSBzcGFubmluZyB0cmVlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSB3ZWlnaHRGdW5jIHRoZSB3ZWlnaHQgZnVuY3Rpb24gdG8gdXNlXG4gKi9cbmZ1bmN0aW9uIHByaW0oZywgd2VpZ2h0RnVuYykge1xuICB2YXIgcmVzdWx0ID0gbmV3IEdyYXBoKCksXG4gICAgICBwYXJlbnRzID0ge30sXG4gICAgICBwcSA9IG5ldyBQcmlvcml0eVF1ZXVlKCksXG4gICAgICB1O1xuXG4gIGZ1bmN0aW9uIHVwZGF0ZU5laWdoYm9ycyhlKSB7XG4gICAgdmFyIGluY2lkZW50Tm9kZXMgPSBnLmluY2lkZW50Tm9kZXMoZSksXG4gICAgICAgIHYgPSBpbmNpZGVudE5vZGVzWzBdICE9PSB1ID8gaW5jaWRlbnROb2Rlc1swXSA6IGluY2lkZW50Tm9kZXNbMV0sXG4gICAgICAgIHByaSA9IHBxLnByaW9yaXR5KHYpO1xuICAgIGlmIChwcmkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGVkZ2VXZWlnaHQgPSB3ZWlnaHRGdW5jKGUpO1xuICAgICAgaWYgKGVkZ2VXZWlnaHQgPCBwcmkpIHtcbiAgICAgICAgcGFyZW50c1t2XSA9IHU7XG4gICAgICAgIHBxLmRlY3JlYXNlKHYsIGVkZ2VXZWlnaHQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChnLm9yZGVyKCkgPT09IDApIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgcHEuYWRkKHUsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSk7XG4gICAgcmVzdWx0LmFkZE5vZGUodSk7XG4gIH0pO1xuXG4gIC8vIFN0YXJ0IGZyb20gYW4gYXJiaXRyYXJ5IG5vZGVcbiAgcHEuZGVjcmVhc2UoZy5ub2RlcygpWzBdLCAwKTtcblxuICB2YXIgaW5pdCA9IGZhbHNlO1xuICB3aGlsZSAocHEuc2l6ZSgpID4gMCkge1xuICAgIHUgPSBwcS5yZW1vdmVNaW4oKTtcbiAgICBpZiAodSBpbiBwYXJlbnRzKSB7XG4gICAgICByZXN1bHQuYWRkRWRnZShudWxsLCB1LCBwYXJlbnRzW3VdKTtcbiAgICB9IGVsc2UgaWYgKGluaXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IGdyYXBoIGlzIG5vdCBjb25uZWN0ZWQ6IFwiICsgZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluaXQgPSB0cnVlO1xuICAgIH1cblxuICAgIGcuaW5jaWRlbnRFZGdlcyh1KS5mb3JFYWNoKHVwZGF0ZU5laWdoYm9ycyk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB0YXJqYW47XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBpcyBhbiBpbXBsZW1lbnRhdGlvbiBvZiBbVGFyamFuJ3MgYWxnb3JpdGhtXVtdIHdoaWNoIGZpbmRzXG4gKiBhbGwgW3N0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnRzXVtdIGluIHRoZSBkaXJlY3RlZCBncmFwaCAqKmcqKi4gRWFjaFxuICogc3Ryb25nbHkgY29ubmVjdGVkIGNvbXBvbmVudCBpcyBjb21wb3NlZCBvZiBub2RlcyB0aGF0IGNhbiByZWFjaCBhbGwgb3RoZXJcbiAqIG5vZGVzIGluIHRoZSBjb21wb25lbnQgdmlhIGRpcmVjdGVkIGVkZ2VzLiBBIHN0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnRcbiAqIGNhbiBjb25zaXN0IG9mIGEgc2luZ2xlIG5vZGUgaWYgdGhhdCBub2RlIGNhbm5vdCBib3RoIHJlYWNoIGFuZCBiZSByZWFjaGVkXG4gKiBieSBhbnkgb3RoZXIgc3BlY2lmaWMgbm9kZSBpbiB0aGUgZ3JhcGguIENvbXBvbmVudHMgb2YgbW9yZSB0aGFuIG9uZSBub2RlXG4gKiBhcmUgZ3VhcmFudGVlZCB0byBoYXZlIGF0IGxlYXN0IG9uZSBjeWNsZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHJldHVybnMgYW4gYXJyYXkgb2YgY29tcG9uZW50cy4gRWFjaCBjb21wb25lbnQgaXMgaXRzZWxmIGFuXG4gKiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSBpZHMgb2YgYWxsIG5vZGVzIGluIHRoZSBjb21wb25lbnQuXG4gKlxuICogW1RhcmphbidzIGFsZ29yaXRobV06IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVGFyamFuJ3Nfc3Ryb25nbHlfY29ubmVjdGVkX2NvbXBvbmVudHNfYWxnb3JpdGhtXG4gKiBbc3Ryb25nbHkgY29ubmVjdGVkIGNvbXBvbmVudHNdOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1N0cm9uZ2x5X2Nvbm5lY3RlZF9jb21wb25lbnRcbiAqXG4gKiBAcGFyYW0ge0RpZ3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3Igc3Ryb25nbHkgY29ubmVjdGVkIGNvbXBvbmVudHNcbiAqL1xuZnVuY3Rpb24gdGFyamFuKGcpIHtcbiAgaWYgKCFnLmlzRGlyZWN0ZWQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcInRhcmphbiBjYW4gb25seSBiZSBhcHBsaWVkIHRvIGEgZGlyZWN0ZWQgZ3JhcGguIEJhZCBpbnB1dDogXCIgKyBnKTtcbiAgfVxuXG4gIHZhciBpbmRleCA9IDAsXG4gICAgICBzdGFjayA9IFtdLFxuICAgICAgdmlzaXRlZCA9IHt9LCAvLyBub2RlIGlkIC0+IHsgb25TdGFjaywgbG93bGluaywgaW5kZXggfVxuICAgICAgcmVzdWx0cyA9IFtdO1xuXG4gIGZ1bmN0aW9uIGRmcyh1KSB7XG4gICAgdmFyIGVudHJ5ID0gdmlzaXRlZFt1XSA9IHtcbiAgICAgIG9uU3RhY2s6IHRydWUsXG4gICAgICBsb3dsaW5rOiBpbmRleCxcbiAgICAgIGluZGV4OiBpbmRleCsrXG4gICAgfTtcbiAgICBzdGFjay5wdXNoKHUpO1xuXG4gICAgZy5zdWNjZXNzb3JzKHUpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgaWYgKCEodiBpbiB2aXNpdGVkKSkge1xuICAgICAgICBkZnModik7XG4gICAgICAgIGVudHJ5Lmxvd2xpbmsgPSBNYXRoLm1pbihlbnRyeS5sb3dsaW5rLCB2aXNpdGVkW3ZdLmxvd2xpbmspO1xuICAgICAgfSBlbHNlIGlmICh2aXNpdGVkW3ZdLm9uU3RhY2spIHtcbiAgICAgICAgZW50cnkubG93bGluayA9IE1hdGgubWluKGVudHJ5Lmxvd2xpbmssIHZpc2l0ZWRbdl0uaW5kZXgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGVudHJ5Lmxvd2xpbmsgPT09IGVudHJ5LmluZGV4KSB7XG4gICAgICB2YXIgY21wdCA9IFtdLFxuICAgICAgICAgIHY7XG4gICAgICBkbyB7XG4gICAgICAgIHYgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgdmlzaXRlZFt2XS5vblN0YWNrID0gZmFsc2U7XG4gICAgICAgIGNtcHQucHVzaCh2KTtcbiAgICAgIH0gd2hpbGUgKHUgIT09IHYpO1xuICAgICAgcmVzdWx0cy5wdXNoKGNtcHQpO1xuICAgIH1cbiAgfVxuXG4gIGcubm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICBpZiAoISh1IGluIHZpc2l0ZWQpKSB7XG4gICAgICBkZnModSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gdG9wc29ydDtcbnRvcHNvcnQuQ3ljbGVFeGNlcHRpb24gPSBDeWNsZUV4Y2VwdGlvbjtcblxuLypcbiAqIEdpdmVuIGEgZ3JhcGggKipnKiosIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBvcmRlcmVkIGxpc3Qgb2Ygbm9kZXMgc3VjaFxuICogdGhhdCBmb3IgZWFjaCBlZGdlIGB1IC0+IHZgLCBgdWAgYXBwZWFycyBiZWZvcmUgYHZgIGluIHRoZSBsaXN0LiBJZiB0aGVcbiAqIGdyYXBoIGhhcyBhIGN5Y2xlIGl0IGlzIGltcG9zc2libGUgdG8gZ2VuZXJhdGUgc3VjaCBhIGxpc3QgYW5kXG4gKiAqKkN5Y2xlRXhjZXB0aW9uKiogaXMgdGhyb3duLlxuICpcbiAqIFNlZSBbdG9wb2xvZ2ljYWwgc29ydGluZ10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVG9wb2xvZ2ljYWxfc29ydGluZylcbiAqIGZvciBtb3JlIGRldGFpbHMgYWJvdXQgaG93IHRoaXMgYWxnb3JpdGhtIHdvcmtzLlxuICpcbiAqIEBwYXJhbSB7RGlncmFwaH0gZyB0aGUgZ3JhcGggdG8gc29ydFxuICovXG5mdW5jdGlvbiB0b3Bzb3J0KGcpIHtcbiAgaWYgKCFnLmlzRGlyZWN0ZWQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcInRvcHNvcnQgY2FuIG9ubHkgYmUgYXBwbGllZCB0byBhIGRpcmVjdGVkIGdyYXBoLiBCYWQgaW5wdXQ6IFwiICsgZyk7XG4gIH1cblxuICB2YXIgdmlzaXRlZCA9IHt9O1xuICB2YXIgc3RhY2sgPSB7fTtcbiAgdmFyIHJlc3VsdHMgPSBbXTtcblxuICBmdW5jdGlvbiB2aXNpdChub2RlKSB7XG4gICAgaWYgKG5vZGUgaW4gc3RhY2spIHtcbiAgICAgIHRocm93IG5ldyBDeWNsZUV4Y2VwdGlvbigpO1xuICAgIH1cblxuICAgIGlmICghKG5vZGUgaW4gdmlzaXRlZCkpIHtcbiAgICAgIHN0YWNrW25vZGVdID0gdHJ1ZTtcbiAgICAgIHZpc2l0ZWRbbm9kZV0gPSB0cnVlO1xuICAgICAgZy5wcmVkZWNlc3NvcnMobm9kZSkuZm9yRWFjaChmdW5jdGlvbihwcmVkKSB7XG4gICAgICAgIHZpc2l0KHByZWQpO1xuICAgICAgfSk7XG4gICAgICBkZWxldGUgc3RhY2tbbm9kZV07XG4gICAgICByZXN1bHRzLnB1c2gobm9kZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIHNpbmtzID0gZy5zaW5rcygpO1xuICBpZiAoZy5vcmRlcigpICE9PSAwICYmIHNpbmtzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBDeWNsZUV4Y2VwdGlvbigpO1xuICB9XG5cbiAgZy5zaW5rcygpLmZvckVhY2goZnVuY3Rpb24oc2luaykge1xuICAgIHZpc2l0KHNpbmspO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cblxuZnVuY3Rpb24gQ3ljbGVFeGNlcHRpb24oKSB7fVxuXG5DeWNsZUV4Y2VwdGlvbi5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiR3JhcGggaGFzIGF0IGxlYXN0IG9uZSBjeWNsZVwiO1xufTtcbiIsIi8vIFRoaXMgZmlsZSBwcm92aWRlcyBhIGhlbHBlciBmdW5jdGlvbiB0aGF0IG1peGVzLWluIERvdCBiZWhhdmlvciB0byBhblxuLy8gZXhpc3RpbmcgZ3JhcGggcHJvdG90eXBlLlxuXG4vKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb3VuZGlmeTtcblxuLy8gRXh0ZW5kcyB0aGUgZ2l2ZW4gU3VwZXJDb25zdHJ1Y3RvciB3aXRoIHRoZSBhYmlsaXR5IGZvciBub2RlcyB0byBjb250YWluXG4vLyBvdGhlciBub2Rlcy4gQSBzcGVjaWFsIG5vZGUgaWQgYG51bGxgIGlzIHVzZWQgdG8gaW5kaWNhdGUgdGhlIHJvb3QgZ3JhcGguXG5mdW5jdGlvbiBjb21wb3VuZGlmeShTdXBlckNvbnN0cnVjdG9yKSB7XG4gIGZ1bmN0aW9uIENvbnN0cnVjdG9yKCkge1xuICAgIFN1cGVyQ29uc3RydWN0b3IuY2FsbCh0aGlzKTtcblxuICAgIC8vIE1hcCBvZiBvYmplY3QgaWQgLT4gcGFyZW50IGlkIChvciBudWxsIGZvciByb290IGdyYXBoKVxuICAgIHRoaXMuX3BhcmVudHMgPSB7fTtcblxuICAgIC8vIE1hcCBvZiBpZCAob3IgbnVsbCkgLT4gY2hpbGRyZW4gc2V0XG4gICAgdGhpcy5fY2hpbGRyZW4gPSB7fTtcbiAgICB0aGlzLl9jaGlsZHJlbltudWxsXSA9IG5ldyBTZXQoKTtcbiAgfVxuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZSA9IG5ldyBTdXBlckNvbnN0cnVjdG9yKCk7XG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5wYXJlbnQgPSBmdW5jdGlvbih1LCBwYXJlbnQpIHtcbiAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcGFyZW50c1t1XTtcbiAgICB9XG5cbiAgICBpZiAodSA9PT0gcGFyZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgbWFrZSBcIiArIHUgKyBcIiBhIHBhcmVudCBvZiBpdHNlbGZcIik7XG4gICAgfVxuICAgIGlmIChwYXJlbnQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N0cmljdEdldE5vZGUocGFyZW50KTtcbiAgICB9XG5cbiAgICB0aGlzLl9jaGlsZHJlblt0aGlzLl9wYXJlbnRzW3VdXS5yZW1vdmUodSk7XG4gICAgdGhpcy5fcGFyZW50c1t1XSA9IHBhcmVudDtcbiAgICB0aGlzLl9jaGlsZHJlbltwYXJlbnRdLmFkZCh1KTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY2hpbGRyZW4gPSBmdW5jdGlvbih1KSB7XG4gICAgaWYgKHUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jaGlsZHJlblt1XS5rZXlzKCk7XG4gIH07XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmFkZE5vZGUgPSBmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIHUgPSBTdXBlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5hZGROb2RlLmNhbGwodGhpcywgdSwgdmFsdWUpO1xuICAgIHRoaXMuX3BhcmVudHNbdV0gPSBudWxsO1xuICAgIHRoaXMuX2NoaWxkcmVuW3VdID0gbmV3IFNldCgpO1xuICAgIHRoaXMuX2NoaWxkcmVuW251bGxdLmFkZCh1KTtcbiAgICByZXR1cm4gdTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZGVsTm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgICAvLyBQcm9tb3RlIGFsbCBjaGlsZHJlbiB0byB0aGUgcGFyZW50IG9mIHRoZSBzdWJncmFwaFxuICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudCh1KTtcbiAgICB0aGlzLl9jaGlsZHJlblt1XS5rZXlzKCkuZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuICAgICAgdGhpcy5wYXJlbnQoY2hpbGQsIHBhcmVudCk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9jaGlsZHJlbltwYXJlbnRdLnJlbW92ZSh1KTtcbiAgICBkZWxldGUgdGhpcy5fcGFyZW50c1t1XTtcbiAgICBkZWxldGUgdGhpcy5fY2hpbGRyZW5bdV07XG5cbiAgICByZXR1cm4gU3VwZXJDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZGVsTm9kZS5jYWxsKHRoaXMsIHUpO1xuICB9O1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNvcHkgPSBTdXBlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5jb3B5LmNhbGwodGhpcyk7XG4gICAgdGhpcy5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgY29weS5wYXJlbnQodSwgdGhpcy5wYXJlbnQodSkpO1xuICAgIH0sIHRoaXMpO1xuICAgIHJldHVybiBjb3B5O1xuICB9O1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5maWx0ZXJOb2RlcyA9IGZ1bmN0aW9uKGZpbHRlcikge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgY29weSA9IFN1cGVyQ29uc3RydWN0b3IucHJvdG90eXBlLmZpbHRlck5vZGVzLmNhbGwodGhpcywgZmlsdGVyKTtcblxuICAgIHZhciBwYXJlbnRzID0ge307XG4gICAgZnVuY3Rpb24gZmluZFBhcmVudCh1KSB7XG4gICAgICB2YXIgcGFyZW50ID0gc2VsZi5wYXJlbnQodSk7XG4gICAgICBpZiAocGFyZW50ID09PSBudWxsIHx8IGNvcHkuaGFzTm9kZShwYXJlbnQpKSB7XG4gICAgICAgIHBhcmVudHNbdV0gPSBwYXJlbnQ7XG4gICAgICAgIHJldHVybiBwYXJlbnQ7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudCBpbiBwYXJlbnRzKSB7XG4gICAgICAgIHJldHVybiBwYXJlbnRzW3BhcmVudF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmluZFBhcmVudChwYXJlbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvcHkuZWFjaE5vZGUoZnVuY3Rpb24odSkgeyBjb3B5LnBhcmVudCh1LCBmaW5kUGFyZW50KHUpKTsgfSk7XG5cbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICByZXR1cm4gQ29uc3RydWN0b3I7XG59XG4iLCJ2YXIgR3JhcGggPSByZXF1aXJlKFwiLi4vR3JhcGhcIiksXG4gICAgRGlncmFwaCA9IHJlcXVpcmUoXCIuLi9EaWdyYXBoXCIpLFxuICAgIENHcmFwaCA9IHJlcXVpcmUoXCIuLi9DR3JhcGhcIiksXG4gICAgQ0RpZ3JhcGggPSByZXF1aXJlKFwiLi4vQ0RpZ3JhcGhcIik7XG5cbmV4cG9ydHMuZGVjb2RlID0gZnVuY3Rpb24obm9kZXMsIGVkZ2VzLCBDdG9yKSB7XG4gIEN0b3IgPSBDdG9yIHx8IERpZ3JhcGg7XG5cbiAgaWYgKHR5cGVPZihub2RlcykgIT09IFwiQXJyYXlcIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcIm5vZGVzIGlzIG5vdCBhbiBBcnJheVwiKTtcbiAgfVxuXG4gIGlmICh0eXBlT2YoZWRnZXMpICE9PSBcIkFycmF5XCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJlZGdlcyBpcyBub3QgYW4gQXJyYXlcIik7XG4gIH1cblxuICBpZiAodHlwZW9mIEN0b3IgPT09IFwic3RyaW5nXCIpIHtcbiAgICBzd2l0Y2goQ3Rvcikge1xuICAgICAgY2FzZSBcImdyYXBoXCI6IEN0b3IgPSBHcmFwaDsgYnJlYWs7XG4gICAgICBjYXNlIFwiZGlncmFwaFwiOiBDdG9yID0gRGlncmFwaDsgYnJlYWs7XG4gICAgICBjYXNlIFwiY2dyYXBoXCI6IEN0b3IgPSBDR3JhcGg7IGJyZWFrO1xuICAgICAgY2FzZSBcImNkaWdyYXBoXCI6IEN0b3IgPSBDRGlncmFwaDsgYnJlYWs7XG4gICAgICBkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoXCJVbnJlY29nbml6ZWQgZ3JhcGggdHlwZTogXCIgKyBDdG9yKTtcbiAgICB9XG4gIH1cblxuICB2YXIgZ3JhcGggPSBuZXcgQ3RvcigpO1xuXG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIGdyYXBoLmFkZE5vZGUodS5pZCwgdS52YWx1ZSk7XG4gIH0pO1xuXG4gIC8vIElmIHRoZSBncmFwaCBpcyBjb21wb3VuZCwgc2V0IHVwIGNoaWxkcmVuLi4uXG4gIGlmIChncmFwaC5wYXJlbnQpIHtcbiAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIGlmICh1LmNoaWxkcmVuKSB7XG4gICAgICAgIHUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgICAgZ3JhcGgucGFyZW50KHYsIHUuaWQpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGVkZ2VzLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgIGdyYXBoLmFkZEVkZ2UoZS5pZCwgZS51LCBlLnYsIGUudmFsdWUpO1xuICB9KTtcblxuICByZXR1cm4gZ3JhcGg7XG59O1xuXG5leHBvcnRzLmVuY29kZSA9IGZ1bmN0aW9uKGdyYXBoKSB7XG4gIHZhciBub2RlcyA9IFtdO1xuICB2YXIgZWRnZXMgPSBbXTtcblxuICBncmFwaC5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIHZhciBub2RlID0ge2lkOiB1LCB2YWx1ZTogdmFsdWV9O1xuICAgIGlmIChncmFwaC5jaGlsZHJlbikge1xuICAgICAgdmFyIGNoaWxkcmVuID0gZ3JhcGguY2hpbGRyZW4odSk7XG4gICAgICBpZiAoY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgIG5vZGUuY2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZXMucHVzaChub2RlKTtcbiAgfSk7XG5cbiAgZ3JhcGguZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBlZGdlcy5wdXNoKHtpZDogZSwgdTogdSwgdjogdiwgdmFsdWU6IHZhbHVlfSk7XG4gIH0pO1xuXG4gIHZhciB0eXBlO1xuICBpZiAoZ3JhcGggaW5zdGFuY2VvZiBDRGlncmFwaCkge1xuICAgIHR5cGUgPSBcImNkaWdyYXBoXCI7XG4gIH0gZWxzZSBpZiAoZ3JhcGggaW5zdGFuY2VvZiBDR3JhcGgpIHtcbiAgICB0eXBlID0gXCJjZ3JhcGhcIjtcbiAgfSBlbHNlIGlmIChncmFwaCBpbnN0YW5jZW9mIERpZ3JhcGgpIHtcbiAgICB0eXBlID0gXCJkaWdyYXBoXCI7XG4gIH0gZWxzZSBpZiAoZ3JhcGggaW5zdGFuY2VvZiBHcmFwaCkge1xuICAgIHR5cGUgPSBcImdyYXBoXCI7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ291bGRuJ3QgZGV0ZXJtaW5lIHR5cGUgb2YgZ3JhcGg6IFwiICsgZ3JhcGgpO1xuICB9XG5cbiAgcmV0dXJuIHsgbm9kZXM6IG5vZGVzLCBlZGdlczogZWRnZXMsIHR5cGU6IHR5cGUgfTtcbn07XG5cbmZ1bmN0aW9uIHR5cGVPZihvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopLnNsaWNlKDgsIC0xKTtcbn1cbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5leHBvcnRzLmFsbCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7IHJldHVybiB0cnVlOyB9O1xufTtcblxuZXhwb3J0cy5ub2Rlc0Zyb21MaXN0ID0gZnVuY3Rpb24obm9kZXMpIHtcbiAgdmFyIHNldCA9IG5ldyBTZXQobm9kZXMpO1xuICByZXR1cm4gZnVuY3Rpb24odSkge1xuICAgIHJldHVybiBzZXQuaGFzKHUpO1xuICB9O1xufTtcbiIsInZhciBHcmFwaCA9IHJlcXVpcmUoXCIuL0dyYXBoXCIpLFxuICAgIERpZ3JhcGggPSByZXF1aXJlKFwiLi9EaWdyYXBoXCIpO1xuXG4vLyBTaWRlLWVmZmVjdCBiYXNlZCBjaGFuZ2VzIGFyZSBsb3VzeSwgYnV0IG5vZGUgZG9lc24ndCBzZWVtIHRvIHJlc29sdmUgdGhlXG4vLyByZXF1aXJlcyBjeWNsZS5cblxuLyoqXG4gKiBSZXR1cm5zIGEgbmV3IGRpcmVjdGVkIGdyYXBoIHVzaW5nIHRoZSBub2RlcyBhbmQgZWRnZXMgZnJvbSB0aGlzIGdyYXBoLiBUaGVcbiAqIG5ldyBncmFwaCB3aWxsIGhhdmUgdGhlIHNhbWUgbm9kZXMsIGJ1dCB3aWxsIGhhdmUgdHdpY2UgdGhlIG51bWJlciBvZiBlZGdlczpcbiAqIGVhY2ggZWRnZSBpcyBzcGxpdCBpbnRvIHR3byBlZGdlcyB3aXRoIG9wcG9zaXRlIGRpcmVjdGlvbnMuIEVkZ2UgaWRzLFxuICogY29uc2VxdWVudGx5LCBhcmUgbm90IHByZXNlcnZlZCBieSB0aGlzIHRyYW5zZm9ybWF0aW9uLlxuICovXG5HcmFwaC5wcm90b3R5cGUudG9EaWdyYXBoID1cbkdyYXBoLnByb3RvdHlwZS5hc0RpcmVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnID0gbmV3IERpZ3JhcGgoKTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkgeyBnLmFkZE5vZGUodSwgdmFsdWUpOyB9KTtcbiAgdGhpcy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCB2YWx1ZSk7XG4gICAgZy5hZGRFZGdlKG51bGwsIHYsIHUsIHZhbHVlKTtcbiAgfSk7XG4gIHJldHVybiBnO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgbmV3IHVuZGlyZWN0ZWQgZ3JhcGggdXNpbmcgdGhlIG5vZGVzIGFuZCBlZGdlcyBmcm9tIHRoaXMgZ3JhcGguXG4gKiBUaGUgbmV3IGdyYXBoIHdpbGwgaGF2ZSB0aGUgc2FtZSBub2RlcywgYnV0IHRoZSBlZGdlcyB3aWxsIGJlIG1hZGVcbiAqIHVuZGlyZWN0ZWQuIEVkZ2UgaWRzIGFyZSBwcmVzZXJ2ZWQgaW4gdGhpcyB0cmFuc2Zvcm1hdGlvbi5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUudG9HcmFwaCA9XG5EaWdyYXBoLnByb3RvdHlwZS5hc1VuZGlyZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGcgPSBuZXcgR3JhcGgoKTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkgeyBnLmFkZE5vZGUodSwgdmFsdWUpOyB9KTtcbiAgdGhpcy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGcuYWRkRWRnZShlLCB1LCB2LCB2YWx1ZSk7XG4gIH0pO1xuICByZXR1cm4gZztcbn07XG4iLCIvLyBSZXR1cm5zIGFuIGFycmF5IG9mIGFsbCB2YWx1ZXMgZm9yIHByb3BlcnRpZXMgb2YgKipvKiouXG5leHBvcnRzLnZhbHVlcyA9IGZ1bmN0aW9uKG8pIHtcbiAgdmFyIGtzID0gT2JqZWN0LmtleXMobyksXG4gICAgICBsZW4gPSBrcy5sZW5ndGgsXG4gICAgICByZXN1bHQgPSBuZXcgQXJyYXkobGVuKSxcbiAgICAgIGk7XG4gIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHJlc3VsdFtpXSA9IG9ba3NbaV1dO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSAnMC43LjQnO1xuIiwidm9pZCBmdW5jdGlvbigpe1xuICAndXNlIHN0cmljdCdcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihmbil7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gZm4uYmluZChudWxsLCB0aGlzKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICB9XG4gIH1cbn0oKVxuIiwidmFyIGRvbWlmeSA9IHJlcXVpcmUoJ2RvbWlmeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGh5cGVyZ2x1ZTtcbmZ1bmN0aW9uIGh5cGVyZ2x1ZSAoc3JjLCB1cGRhdGVzKSB7XG4gICAgaWYgKCF1cGRhdGVzKSB1cGRhdGVzID0ge307XG5cbiAgICB2YXIgZG9tID0gdHlwZW9mIHNyYyA9PT0gJ29iamVjdCdcbiAgICAgICAgPyBbIHNyYyBdXG4gICAgICAgIDogZG9taWZ5KHNyYylcbiAgICA7XG4gICAgZm9yRWFjaChvYmplY3RLZXlzKHVwZGF0ZXMpLCBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gdXBkYXRlc1tzZWxlY3Rvcl07XG4gICAgICAgIGZvckVhY2goZG9tLCBmdW5jdGlvbiAoZCkge1xuICAgICAgICAgICAgaWYgKHNlbGVjdG9yID09PSAnOmZpcnN0Jykge1xuICAgICAgICAgICAgICAgIGJpbmQoZCwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoLzpmaXJzdCQvLnRlc3Qoc2VsZWN0b3IpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGsgPSBzZWxlY3Rvci5yZXBsYWNlKC86Zmlyc3QkLywgJycpO1xuICAgICAgICAgICAgICAgIHZhciBlbGVtID0gZC5xdWVyeVNlbGVjdG9yKGspO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtKSBiaW5kKGVsZW0sIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBub2RlcyA9IGQucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYmluZChub2Rlc1tpXSwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZG9tLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IGRvbVswXVxuICAgICAgICA6IGRvbVxuICAgIDtcbn1cblxuZnVuY3Rpb24gYmluZCAobm9kZSwgdmFsdWUpIHtcbiAgICBpZiAoaXNFbGVtZW50KHZhbHVlKSkge1xuICAgICAgICBub2RlLmlubmVySFRNTCA9ICcnO1xuICAgICAgICBub2RlLmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGUgPSBoeXBlcmdsdWUobm9kZS5jbG9uZU5vZGUodHJ1ZSksIHZhbHVlW2ldKTtcbiAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZSwgbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgIH1cbiAgICBlbHNlIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGZvckVhY2gob2JqZWN0S2V5cyh2YWx1ZSksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdfdGV4dCcpIHtcbiAgICAgICAgICAgICAgICBzZXRUZXh0KG5vZGUsIHZhbHVlW2tleV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoa2V5ID09PSAnX2h0bWwnICYmIGlzRWxlbWVudCh2YWx1ZVtrZXldKSkge1xuICAgICAgICAgICAgICAgIG5vZGUuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgICAgICAgICAgbm9kZS5hcHBlbmRDaGlsZCh2YWx1ZVtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGtleSA9PT0gJ19odG1sJykge1xuICAgICAgICAgICAgICAgIG5vZGUuaW5uZXJIVE1MID0gdmFsdWVba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZVtrZXldKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2Ugc2V0VGV4dChub2RlLCB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGZvckVhY2goeHMsIGYpIHtcbiAgICBpZiAoeHMuZm9yRWFjaCkgcmV0dXJuIHhzLmZvckVhY2goZik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykgZih4c1tpXSwgaSlcbn1cblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHJlcy5wdXNoKGtleSk7XG4gICAgcmV0dXJuIHJlcztcbn07XG5cbmZ1bmN0aW9uIGlzRWxlbWVudCAoZSkge1xuICAgIHJldHVybiBlICYmIHR5cGVvZiBlID09PSAnb2JqZWN0JyAmJiBlLmNoaWxkTm9kZXNcbiAgICAgICAgJiYgKHR5cGVvZiBlLmFwcGVuZENoaWxkID09PSAnZnVuY3Rpb24nXG4gICAgICAgIHx8IHR5cGVvZiBlLmFwcGVuZENoaWxkID09PSAnb2JqZWN0JylcbiAgICA7XG59XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbmZ1bmN0aW9uIHNldFRleHQgKGUsIHMpIHtcbiAgICBlLmlubmVySFRNTCA9ICcnO1xuICAgIHZhciB0eHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShTdHJpbmcocykpO1xuICAgIGUuYXBwZW5kQ2hpbGQodHh0KTtcbn1cbiIsIlxuLyoqXG4gKiBFeHBvc2UgYHBhcnNlYC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuXG4vKipcbiAqIFdyYXAgbWFwIGZyb20ganF1ZXJ5LlxuICovXG5cbnZhciBtYXAgPSB7XG4gIG9wdGlvbjogWzEsICc8c2VsZWN0IG11bHRpcGxlPVwibXVsdGlwbGVcIj4nLCAnPC9zZWxlY3Q+J10sXG4gIG9wdGdyb3VwOiBbMSwgJzxzZWxlY3QgbXVsdGlwbGU9XCJtdWx0aXBsZVwiPicsICc8L3NlbGVjdD4nXSxcbiAgbGVnZW5kOiBbMSwgJzxmaWVsZHNldD4nLCAnPC9maWVsZHNldD4nXSxcbiAgdGhlYWQ6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICB0Ym9keTogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIHRmb290OiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgY29sZ3JvdXA6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICBjYXB0aW9uOiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgdHI6IFsyLCAnPHRhYmxlPjx0Ym9keT4nLCAnPC90Ym9keT48L3RhYmxlPiddLFxuICB0ZDogWzMsICc8dGFibGU+PHRib2R5Pjx0cj4nLCAnPC90cj48L3Rib2R5PjwvdGFibGU+J10sXG4gIHRoOiBbMywgJzx0YWJsZT48dGJvZHk+PHRyPicsICc8L3RyPjwvdGJvZHk+PC90YWJsZT4nXSxcbiAgY29sOiBbMiwgJzx0YWJsZT48dGJvZHk+PC90Ym9keT48Y29sZ3JvdXA+JywgJzwvY29sZ3JvdXA+PC90YWJsZT4nXSxcbiAgX2RlZmF1bHQ6IFswLCAnJywgJyddXG59O1xuXG4vKipcbiAqIFBhcnNlIGBodG1sYCBhbmQgcmV0dXJuIHRoZSBjaGlsZHJlbi5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaHRtbFxuICogQHJldHVybiB7QXJyYXl9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShodG1sKSB7XG4gIGlmICgnc3RyaW5nJyAhPSB0eXBlb2YgaHRtbCkgdGhyb3cgbmV3IFR5cGVFcnJvcignU3RyaW5nIGV4cGVjdGVkJyk7XG4gIFxuICAvLyB0YWcgbmFtZVxuICB2YXIgbSA9IC88KFtcXHc6XSspLy5leGVjKGh0bWwpO1xuICBpZiAoIW0pIHRocm93IG5ldyBFcnJvcignTm8gZWxlbWVudHMgd2VyZSBnZW5lcmF0ZWQuJyk7XG4gIHZhciB0YWcgPSBtWzFdO1xuICBcbiAgLy8gYm9keSBzdXBwb3J0XG4gIGlmICh0YWcgPT0gJ2JvZHknKSB7XG4gICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaHRtbCcpO1xuICAgIGVsLmlubmVySFRNTCA9IGh0bWw7XG4gICAgcmV0dXJuIFtlbC5yZW1vdmVDaGlsZChlbC5sYXN0Q2hpbGQpXTtcbiAgfVxuICBcbiAgLy8gd3JhcCBtYXBcbiAgdmFyIHdyYXAgPSBtYXBbdGFnXSB8fCBtYXAuX2RlZmF1bHQ7XG4gIHZhciBkZXB0aCA9IHdyYXBbMF07XG4gIHZhciBwcmVmaXggPSB3cmFwWzFdO1xuICB2YXIgc3VmZml4ID0gd3JhcFsyXTtcbiAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGVsLmlubmVySFRNTCA9IHByZWZpeCArIGh0bWwgKyBzdWZmaXg7XG4gIHdoaWxlIChkZXB0aC0tKSBlbCA9IGVsLmxhc3RDaGlsZDtcblxuICByZXR1cm4gb3JwaGFuKGVsLmNoaWxkcmVuKTtcbn1cblxuLyoqXG4gKiBPcnBoYW4gYGVsc2AgYW5kIHJldHVybiBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge05vZGVMaXN0fSBlbHNcbiAqIEByZXR1cm4ge0FycmF5fVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gb3JwaGFuKGVscykge1xuICB2YXIgcmV0ID0gW107XG5cbiAgd2hpbGUgKGVscy5sZW5ndGgpIHtcbiAgICByZXQucHVzaChlbHNbMF0ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbHNbMF0pKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG4iLCJ2b2lkIGZ1bmN0aW9uKHJvb3Qpe1xuXG4gICAgLy8gcmV0dXJuIGEgbnVtYmVyIGJldHdlZW4gMCBhbmQgbWF4LTFcbiAgICBmdW5jdGlvbiByKG1heCl7IHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqbWF4KSB9XG5cbiAgICBmdW5jdGlvbiBnZW5lcmF0ZShzYWx0LCBzaXplKXtcbiAgICAgICAgdmFyIGtleSA9ICcnXG4gICAgICAgIHZhciBzbCA9IHNhbHQubGVuZ3RoXG4gICAgICAgIHdoaWxlICggc2l6ZSAtLSApIHtcbiAgICAgICAgICAgIHZhciBybmQgPSByKHNsKVxuICAgICAgICAgICAga2V5ICs9IHNhbHRbcm5kXVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXlcbiAgICB9XG5cbiAgICB2YXIgcm5kdG9rID0gZnVuY3Rpb24oc2FsdCwgc2l6ZSl7XG4gICAgICAgIHJldHVybiBpc05hTihzaXplKSA/IHVuZGVmaW5lZCA6XG4gICAgICAgICAgICAgICBzaXplIDwgMSAgICA/IHVuZGVmaW5lZCA6IGdlbmVyYXRlKHNhbHQsIHNpemUpXG5cbiAgICB9XG5cbiAgICBybmR0b2suZ2VuID0gY3JlYXRlR2VuZXJhdG9yXG5cbiAgICBmdW5jdGlvbiBjcmVhdGVHZW5lcmF0b3Ioc2FsdCl7XG4gICAgICAgIHNhbHQgPSB0eXBlb2Ygc2FsdCAgPT0gJ3N0cmluZycgJiYgc2FsdC5sZW5ndGggPiAwID8gc2FsdCA6ICAnYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4enkwMTIzNDU2Nzg5J1xuICAgICAgICB2YXIgdGVtcCA9IHJuZHRvay5iaW5kKHJuZHRvaywgc2FsdClcbiAgICAgICAgdGVtcC5zYWx0ID0gZnVuY3Rpb24oKXsgcmV0dXJuIHNhbHQgfVxuICAgICAgICB0ZW1wLmNyZWF0ZSA9IGNyZWF0ZUdlbmVyYXRvclxuICAgICAgICB0ZW1wLmdlbiA9IGNyZWF0ZUdlbmVyYXRvclxuICAgICAgICByZXR1cm4gdGVtcFxuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0gY3JlYXRlR2VuZXJhdG9yKClcblxufSh0aGlzKVxuIiwidm9pZCBmdW5jdGlvbihyb290KXtcblxuXHQndXNlIHN0cmljdCdcblxuXHR2YXIgY3JlYXRlID0gT2JqZWN0LmNyZWF0ZSB8fCBmdW5jdGlvbihvKXtcblx0XHR2YXIgRiA9IGZ1bmN0aW9uKCl7fVxuXHRcdEYucHJvdG90eXBlID0gb1xuXHRcdHJldHVybiBuZXcgRigpXG5cdH1cblxuXHR2YXIgZXh0ZW5kID0gZnVuY3Rpb24odG8sIGZyb20pe1xuXHRcdGZvciAoIHZhciBwIGluIGZyb20gKSB0b1twXSA9IGZyb21bcF1cblx0XHRyZXR1cm4gdG9cblx0fVxuXG5cdC8vIExpYnJhcnkgb2JqZWN0IC0gYSBiYXNlIG9iamVjdCB0byBiZSBleHRlbmRlZFxuXHR2YXIgVmlyYWwgPSB7XG5cblx0XHQvLyBjcmVhdGUgYW4gaW5oZXJpdGluZyBvYmplY3QsIHdpdGggYWRkZWQgb3IgY2hhbmdlZCBtZXRob2RzIG9yIHByb3BlcnRpZXNcblx0XHRleHRlbmQ6IGZ1bmN0aW9uKHByb3BzKXtcblx0XHRcdHJldHVybiBleHRlbmQoY3JlYXRlKHRoaXMpLCBwcm9wcylcblx0XHR9LFxuXG5cdFx0Ly8gY3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGFuIG9iamVjdCwgY2FsbGluZyBhbiBpbml0IG1ldGhvZCBpZiBhdmFpbGFibGVcblx0XHRtYWtlOiBmdW5jdGlvbigpe1xuXHRcdFx0dmFyIG9iaiA9IGNyZWF0ZSh0aGlzKVxuXHRcdFx0aWYgKCB0eXBlb2Ygb2JqLmluaXQgPT09ICdmdW5jdGlvbicgKSBvYmouaW5pdC5hcHBseShvYmosIGFyZ3VtZW50cylcblx0XHRcdHJldHVybiBvYmpcblx0XHR9XG5cdH1cblxuXHQvLyBtb2R1bGUgZGFuY2Vcblx0aWYgKCB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cyApIG1vZHVsZS5leHBvcnRzID0gVmlyYWxcblx0ZWxzZSBpZiAoIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCApIGRlZmluZShWaXJhbClcblx0ZWxzZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3QuVmlyYWwgPSBWaXJhbFxuXG59KHRoaXMpXG4iLCIvLyAjIFwiWmlwcGluZyBhbmQgVW56aXBwaW5nIExpc3RzXCJcbi8vIEJlY2F1c2UganMgaXMgZHluYW1pYyBhbmQgZG9lc24ndCByb2NrIHR1cGxlcywgdGhlc2UgemlwcGVycyB3b3JrIHdpdGggblxuLy8gY2hhcnMgaWlyYywgYW5kIGFsc28gYWN0cyBhcyBhbiB1bnppcC5cblxuZXhwb3J0cy56aXBXaXRoID0gZnVuY3Rpb24gKCkge1xuICB2YXIgZnhuID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSxcbiAgICAgIGFyZ3MgPSBmeG4uc3BsaWNlKDEpLFxuICAgICAgb3V0cHV0ID0gW10sXG4gICAgICB3aWR0aCA9IE1hdGgubWF4LmFwcGx5KG51bGwsIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChhcmdzLCBmdW5jdGlvbih4cykge1xuICAgICAgICByZXR1cm4geHMubGVuZ3RoO1xuICAgICAgfSkpLFxuICAgICAgaTtcblxuICBmeG4gPSBmeG5bMF07XG5cbiAgZm9yIChpID0gMDsgaSA8IHdpZHRoOyBpKyspIHtcbiAgICBvdXRwdXQucHVzaChmeG4uYXBwbHkobnVsbCwgW10ubWFwLmNhbGwoYXJncywgZnVuY3Rpb24oeHMpIHtcbiAgICAgIHJldHVybiB4c1tpXTtcbiAgICB9KSkpO1xuICB9XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbmV4cG9ydHMuemlwID0gZXhwb3J0cy56aXBXaXRoLmJpbmQobnVsbCwgZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7IFxufSk7XG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIFwidXNlIHN0cmljdFwiXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVmYXVsdHMob2JqKSB7XG4gICAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKS5mb3JFYWNoKGZ1bmN0aW9uKHNvdXJjZSl7XG4gICAgICBmb3IgKHZhciBwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICBpZiAob2JqW3Byb3BdID09PSB1bmRlZmluZWQpIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIG9ialxuICB9XG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICBmdW5jdGlvbiBxdWVyeShzZWxlY3RvciwgcGFyZW50KXtcbiAgICBwYXJlbnQgPSBwYXJlbnQgfHwgZG9jdW1lbnRcbiAgICByZXR1cm4gcGFyZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpXG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGUodGFnX25hbWUsIGF0dHJzKXtcbiAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnX25hbWUpXG4gICAgaWYgKCBhdHRycyApIHsgc2V0X2F0dHJpYnV0ZXMobm9kZSwgYXR0cnMpIH1cbiAgICByZXR1cm4gbm9kZVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X2F0dHJpYnV0ZShub2RlLCBhdHRyKXtcbiAgICBub2RlLnNldEF0dHJpYnV0ZShuYW1lLHZhbHVlKVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X2F0dHJpYnV0ZXMobm9kZSwgYXR0cnMpe1xuICAgIE9iamVjdC5rZXlzKGF0dHJzKVxuICAgICAgICAgIC5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpe1xuICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgYXR0cnNbbmFtZV0pXG4gICAgICAgICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF90ZXh0KG5vZGUpe1xuICAgIHJldHVybiBub2RlLnRleHRDb250ZW50IHx8IG5vZGUuaW5uZXJUZXh0XG4gIH1cblxuICBmdW5jdGlvbiBzZXRfdGV4dChub2RlLCB0ZXh0KXtcbiAgICBub2RlLnRleHRDb250ZW50ID0gbm9kZS5pbm5lclRleHQgPSB0ZXh0XG4gIH1cblxuICBmdW5jdGlvbiBpbnNlcnRBZnRlcihwYXJlbnRFbCwgc3AxLCBzcDIpe1xuICAgIHBhcmVudEVsLmluc2VydEJlZm9yZShzcDEsIHNwMi5uZXh0U2libGluZylcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZU5vZGUobm9kZSl7XG4gICAgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAkICAgICAgICAgICAgIDogcXVlcnlcbiAgLy8sICRpZCAgICAgICAgICAgOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZC5iaW5kKGRvY3VtZW50KVxuICAsICRpZCAgICAgICAgICAgOiBmdW5jdGlvbihpZCl7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCkgfVxuICAsIGNyZWF0ZSAgICAgICAgOiBjcmVhdGVcbiAgLCBhdHRyICAgICAgICAgIDogc2V0X2F0dHJpYnV0ZVxuICAsIGF0dHJzICAgICAgICAgOiBzZXRfYXR0cmlidXRlc1xuICAsIGdldF90ZXh0ICAgICAgOiBnZXRfdGV4dFxuICAsIHNldF90ZXh0ICAgICAgOiBzZXRfdGV4dFxuICAsIHJlbW92ZSAgICAgICAgOiByZW1vdmVOb2RlXG4gICwgaW5zZXJ0QWZ0ZXIgICA6IGluc2VydEFmdGVyXG4gIH1cblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciB2aXJhbCA9IHJlcXVpcmUoJ3ZpcmFsJylcbiAgdmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB2aXJhbC5leHRlbmQoZXZlbnRzLkV2ZW50RW1pdHRlci5wcm90b3R5cGUpLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oKXsgZXZlbnRzLkV2ZW50RW1pdHRlci5jYWxsKHRoaXMpIH1cbiAgfSlcblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGx1Y2sobmFtZSl7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGdldEF0dHIob2JqKXsgcmV0dXJuIG9ialtuYW1lXSB9XG4gIH1cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHRyYW5zbGF0ZSh2ZWN0b3IsIHBvaW50KXtcbiAgICByZXR1cm4geyB4OiBwb2ludC54ICsgdmVjdG9yWzBdLCB5OiBwb2ludC55ICsgdmVjdG9yWzFdIH1cbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciBpZHMgPSBbXVxuICB2YXIgcnQgPSByZXF1aXJlKCdyYW5kb20tdG9rZW4nKVxuICB2YXIgbGV0dGVycyA9IHJ0LmdlbignYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXQnKVxuXG4gIGZ1bmN0aW9uIHRva2VuKCl7IHJldHVybiBsZXR0ZXJzKDEpICsgcnQoMTYpIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XG4gICAgdmFyIGlkID0gdG9rZW4oKVxuICAgIHdoaWxlICggaWRzLmluZGV4T2YoaWQpICE9IC0xICl7XG4gICAgICBpZCA9IHRva2VuKClcbiAgICB9XG4gICAgcmV0dXJuIGlkXG4gIH1cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuXG4gIGZ1bmN0aW9uIHB5dGgoYSwgYil7XG4gICAgcmV0dXJuIE1hdGguc3FydChNYXRoLnBvdyhhLDIpLCBNYXRoLnBvdyhiLDIpKVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgY3Jvc3M6IGZ1bmN0aW9uIGNyb3NzKHYsIHcpe1xuICAgICAgcmV0dXJuIHZbMF0gKiB3WzFdIC0gdlsxXSAqIHdbMF1cbiAgICB9XG5cbiAgLCBkb3Q6ICBmdW5jdGlvbiBhZGQodiwgdyl7XG4gICAgICByZXR1cm4gdlswXSAqIHdbMF0gKyB2WzFdICogd1sxXVxuICAgIH1cblxuICAsIGFkZDogIGZ1bmN0aW9uIGFkZCh2LCB3KXtcbiAgICAgIHJldHVybiBbdlswXSArIHdbMF0sIHZbMV0gKyB3WzFdXVxuICAgIH1cblxuICAsIHN1YnRyYWN0OiAgZnVuY3Rpb24gc3VidHJhY3Qodiwgdyl7XG4gICAgICByZXR1cm4gW3ZbMF0gLSB3WzBdLCB2WzFdIC0gd1sxXV1cbiAgICB9XG5cbiAgLCBzY2FsZTogIGZ1bmN0aW9uIHNjYWxlKHYsIHMpe1xuICAgICAgcmV0dXJuIFt2WzBdICogcywgdlsxXSAqIHNdXG4gICAgfVxuXG4gICwgZXE6ICBmdW5jdGlvbiBlcSh2LCB3KXtcbiAgICAgIHJldHVybiB2WzBdID09IHdbMF0gJiYgIHZbMV0gPT0gd1sxXVxuICAgIH1cbiAgLCBtYWduaXR1ZGU6IGZ1bmN0aW9uIG1hZ25pdHVkZSh2KXtcbiAgICAgIHJldHVybiBweXRoKHZbMF0sIHZbMV0pXG4gICAgfVxuXG4gIH1cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICAvKiB0aGFua3MgTWF4ZGFtYW50dXMgKi9cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgemlwOiBmdW5jdGlvbih4cywgeXMpe1xuICAgICAgcmV0dXJuIEFycmF5LmFwcGx5KG51bGwsIEFycmF5KE1hdGgubWluKHhzLmxlbmd0aCwgeXMubGVuZ3RoKSkpXG4gICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKF8sIGkpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW3hzW2ldLCB5c1tpXV1cbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICwgemlwV2l0aDogZnVuY3Rpb24oZm4sIHhzLCB5cyl7XG4gICAgICByZXR1cm4gQXJyYXkuYXBwbHkobnVsbCwgQXJyYXkoTWF0aC5taW4oeHMubGVuZ3RoLCB5cy5sZW5ndGgpKSlcbiAgICAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oXywgaSl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmbih4c1tpXSwgeXNbaV0pXG4gICAgICAgICAgICAgICAgICB9KVxuICAgIH1cblxuICAsIHppcEdyZWVkeTogZnVuY3Rpb24oeHMsIHlzKXtcbiAgICAgIHJldHVybiBBcnJheS5hcHBseShudWxsLCBBcnJheShNYXRoLm1heCh4cy5sZW5ndGgsIHlzLmxlbmd0aCkpKVxuICAgICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbihfLCBpKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFt4c1tpXSwgeXNbaV1dXG4gICAgICAgICAgICAgICAgICB9KVxuICAgIH1cblxuICAsIHppcFdpdGhHcmVlZHk6IGZ1bmN0aW9uKGZuLCB4cywgeXMpe1xuICAgICAgcmV0dXJuIEFycmF5LmFwcGx5KG51bGwsIEFycmF5KE1hdGgubWF4KHhzLmxlbmd0aCwgeXMubGVuZ3RoKSkpXG4gICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKF8sIGkpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZm4oeHNbaV0sIHlzW2ldKVxuICAgICAgICAgICAgICAgICAgfSlcbiAgICB9XG4gIH1cbn0oKVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIl19
