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
  function last(as){ return as && as[as.length - 0] }

  // a → Boolean
  function not_null(a){ return a != null }

  // (a, b) → Boolean
  function equal(a, b){ return a === b }

  // (a, b) → Boolean
  function not_equal(a, b){ return a !== b }

  // (a1 → a2 → ... → aN → b) → (#[a1, a2, ..., aN) → b)
  function spread(f){
    return function(args){ return f.apply(this, args) }
  }

  // ([[a]] → [a])
  function flatten(nested){
    return [].concat.apply([], nested)
  }

  function compare_lists(l1, l2){
    return zipg(l1, l2).every(spread(equal))
  }

  // ([[Node]], [Node]) → Boolean
  function find_sublist(lists, l){
    return lists.some(compare_lists.bind(null, l))
  }

  // Edge → [Edge]
  function MergedEdge(edge){
    return [edge]
  }

  // Edge → Node
  function source(edge){
    var first_point = first(edge)
    return first_point && first_point.exit
  }

  // Edge → Node
  function target(edge){
    var last_point = last(edge)
    return last_point && last_point.exit
  }

  // MergedEdge → [Node]
  function me_source(merged_edge){
    return merged_edge.map(source).filter(not_null)
  }

  // MergedEdge → [Node]
  function me_target(merged_edge){
    return merged_edge.map(target).filter(not_null)
  }

  // [MergedEdge] → [[Node]]
  function mes_sources(mes){
    return mes.map(me_source)
  }

  // [MergedEdge] → [[Node]]
  function mes_targets(mes){
    return mes.map(me_target)
  }

  // (MergedEdge, MergedEdge) → Bool
  function same_source(a, b){
    return compare_lists(me_source(a), me_source(b))
  }

  // (MergedEdge, MergedEdge) → Bool
  function same_target(a, b){
    return compare_lists(me_target(a), me_target(b))
  }

  // (MergedEdge, MergedEdge) → Bool
  function different_source(a, b){
    return ! compare_lists(me_source(a), me_source(b))
  }

  // (MergedEdge, MergedEdge) → Bool
  function different_target(a, b){
    return ! compare_lists(me_target(a), me_target(b))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function different_sources(mes, me){
    return mes.filter(different_source.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function different_targets(mes, me){
    return mes.filter(different_target.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function same_sources(mes, me){
    return mes.filter(same_source.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function same_targets(mes, me){
    return mes.filter(same_target.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function new_sources(mes, me){
    var mes_s = mes_sources(mes)
    var is_me_new = mes_s.length == 0 || ! find_sublist(mes_s, me_source(me))
    return is_me_new ? [me] : []
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function new_targets(mes, me){
    var mes_t = mes_targets(mes)
    var is_me_new = mes_t.length == 0 || ! find_sublist(mes_t, me_target(me))
    return is_me_new ? [me] : []
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_source(b, a){
 //log(a, b)
    b[0][0].remove()
    b[0][0] = a[0][0]
    b[0][1] = a[0][1]
    b[0][2].exit_junction = b[0][1]
    return a.concat(b)
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_target(b, a){
 //log(a, b)
    var b_last = b.length - 1
    var a_last = a.length - 1
    var b_end = b[b_last].length - 1
    var a_end = a[a_last].length - 1
    b[b_last][b_end].remove()
    b[b_last][b_end] = a[a_last][a_end]
    b[b_last][b_end - 1] = a[a_last][a_end - 1]
    b[b_last][b_end - 2].exit_junction = b[b_last][b_end - 1]

    return a.concat(b)
  }

  module.exports = function(edges){
    var mes = edges.map(MergedEdge)
                   .reduce(function(mes, me){

      var ds = different_sources(mes, me)
      var ss = same_sources(mes, me)
      var ms = ss.map(merge_by_source.bind(null, me))
      var ns = new_sources(mes, me)

      var s = ds.concat(ms, ns)


      var dt = different_targets(s, me)
      var st = same_targets(s, me)
      var mt = st.map(merge_by_target.bind(null, me))
      var nt = new_targets(s, me)



      return dt.concat(mt, nt)
    }, [])

//      var exit_double = exit_doubles.reduce(function(_,me){ return me}, false)
//    var exit_doubles =
//                            .filter(function(me){
//                              return me[0].exit == edge[0].exit
//                            })
//

//log(mes, flatten(mes))
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

},{"../util/translate.js":68,"../util/unique_id.js":69,"enslave":58,"viral":62}],7:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var translate = require('../util/translate.js')

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
    return list(point).indexOf(point)
  }

  function list(point){
    return point.type == 'exit' ? point.node.exit_points : point.node.entry_points
  }

  function remove(point){
    return list(point).splice(index(point), 1)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9kaWFncmFtL2RpYWdyYW0uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9lZGdlX2NvbGxhcHNlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vZWRnZXMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9nYXBzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vaW50ZXJzZWN0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vanVuY3Rpb25fcG9pbnRzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vc2lkZV9wb2ludHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9za2lwX3BvaW50cy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ncmFwaC9lZGdlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL2dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL25vZGUuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvbGF5b3V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9vcmRlci9jcm9zc0NvdW50LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdExheWVyR3JhcGhzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdE9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvc29ydExheWVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcG9zaXRpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9hY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9jb25zdHJhaW50cy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvZmVhc2libGVUcmVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9pbml0UmFuay5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvcmFua1V0aWwuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rL3NpbXBsZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi91dGlsLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvdmVyc2lvbi5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9jcC1kYXRhL2xpYi9Qcmlvcml0eVF1ZXVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvU2V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvbGliL3ZlcnNpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9pbmRleC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9CYXNlR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2NvbXBvbmVudHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2RpamtzdHJhLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9kaWprc3RyYUFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmluZEN5Y2xlcy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmxveWRXYXJzaGFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvaXNBY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wb3N0b3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3ByZW9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wcmltLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy90YXJqYW4uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3RvcHNvcnQuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29tcG91bmRpZnkuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29udmVydGVyL2pzb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvZmlsdGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2dyYXBoLWNvbnZlcnRlcnMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi92ZXJzaW9uLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9lbnNsYXZlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9oeXBlcmdsdWUvYnJvd3Nlci5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvaHlwZXJnbHVlL25vZGVfbW9kdWxlcy9kb21pZnkvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL3JhbmRvbS10b2tlbi9pbmRleC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvdmlyYWwvdmlyYWwuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL3ppcHB5L3ppcHB5LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvZGVmYXVsdHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC9kb20uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC9lbWl0dGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvcGx1Y2suanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC90cmFuc2xhdGUuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC91bmlxdWVfaWQuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC92ZWN0b3JzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvemlwcy5qcyIsIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdGJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JIQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIC8vIHZhciBTbmFwID0gcmVxdWlyZSgnc25hcHN2ZycpXG4gIHZhciB2aXJhbCA9IHJlcXVpcmUoJ3ZpcmFsJylcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIGRhZ3JlID0gcmVxdWlyZSgnZGFncmUnKVxuICB2YXIgaGdsdWUgPSByZXF1aXJlKCdoeXBlcmdsdWUnKVxuICB2YXIgemlwcHkgPSByZXF1aXJlKCd6aXBweScpXG4gIHZhciBwbHVjayA9IHJlcXVpcmUoJy4uL3V0aWwvcGx1Y2suanMnKVxuICB2YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuLi91dGlsL2RlZmF1bHRzLmpzJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIGRvbSA9IHJlcXVpcmUoJy4uL3V0aWwvZG9tLmpzJylcbiAgdmFyIGludGVyc2VjdCA9IHJlcXVpcmUoJy4vaW50ZXJzZWN0LmpzJylcbiAgdmFyIGZsb29yID0gTWF0aC5mbG9vclxuICB2YXIgY2VpbCA9IE1hdGguY2VpbFxuICB2YXIgbWluID0gTWF0aC5taW5cbiAgdmFyIG1heCA9IE1hdGgubWF4XG5cbiAgZnVuY3Rpb24gZnJvbV9kZWZzKGRpYWdyYW0sIGNsYXNzbmFtZSl7XG4gICAgcmV0dXJuIGRpYWdyYW0uc3ZnZWwucGFyZW50KCkuc2VsZWN0KCdkZWZzIC4nICsgY2xhc3NuYW1lKVxuICB9XG5cbiAgZnVuY3Rpb24gdG9fZGVmcyhkaWFncmFtLCBzdmcpe1xuICAgIHZhciBwID0gZGlhZ3JhbS5zdmdlbC5wYXJlbnQoKVxuICAgIGlmICggdHlwZW9mIHN2ZyA9PSAnc3RyaW5nJyApIHtcbiAgICAgIHZhciBlbCA9IFNuYXAucGFyc2Uoc3ZnKS5zZWxlY3QoJyonKVxuICAgIH0gZWxzZSBpZiAoIEFycmF5LmlzQXJyYXkoc3ZnKSApIHtcbiAgICAgIHZhciBlbCA9IHAuZWwuYXBwbHkocC5lbCwgc3ZnKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIGRpYWdyYW0uY29uZmlnLmRlYnVnICkgY29uc29sZS5lcnJvcigndW5yZWNvZ25pemFibGUgc3ZnIHZhcmlhYmxlIHR5cGUnKVxuICAgIH1cbiAgICByZXR1cm4gcC5zZWxlY3QoJ2RlZnMnKS5hcHBlbmQoZWwpXG4gIH1cblxuICBmdW5jdGlvbiBkcmF3KGRpYWdyYW0sIGVsKXtcbiAgICB2YXIgbmV3X2VsID0gZnJvbV9kZWZzKGRpYWdyYW0sIGVsLmNsYXNzbmFtZSkuY2xvbmUoKVxuICAgIHZhciBub2RlID0gaGdsdWUobmV3X2VsLm5vZGUsIGVsLmNvbnRlbnQpXG4gICAgZGlhZ3JhbS5zdmdlbC5hcHBlbmQobmV3X2VsKVxuICAgIHJldHVybiBuZXdfZWxcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9saW5lX2F0dHJzKGl0ZW0sIGxpbmVfaGVpZ2h0LCB4KXtcbiAgICBpdGVtLmcuc2VsZWN0QWxsKCd0c3BhbicpLmZvckVhY2goZnVuY3Rpb24odHNwYW4sIGlkeCl7XG4gICAgICB0c3Bhbi5hdHRyKHsgZHk6IGlkeCA/IGxpbmVfaGVpZ2h0IDogMCAsIHg6IHggfSlcbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gcG9zX2NhbGMoeCx3LHksaCl7XG4gICAgcmV0dXJuIFt4ICsgdyAvIDIsIHkgKyBoIC8gMl1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF90ZXh0d2lkdGgobm9kZSl7XG4gICAgcmV0dXJuIG5vZGUuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKClcbiAgfVxuXG4gIGZ1bmN0aW9uIGludml6X2Jib3goZGlhZ3JhbSwgZWwpe1xuICAgIHZhciBjbG9uZSA9IGVsLmNsb25lKCkuYXR0cigpXG4gICAgZGlhZ3JhbS5zdmdlbC5hcHBlbmQoY2xvbmUpXG4gICAgdmFyIGJib3ggPSBjbG9uZS5nZXRCQm94KClcbiAgICBjbG9uZS5yZW1vdmUoKVxuICAgIHJldHVybiBiYm94XG4gIH1cblxuICBmdW5jdGlvbiBwb2ludF90b19zdHJpbmcocCl7IHJldHVybiBwLnggKyAnLCcgKyBwLnkgfVxuXG4gIGZ1bmN0aW9uIGhvcml6b250YWwobGluZSl7XG4gICAgcmV0dXJuIGxpbmUuZ2V0QXR0cmlidXRlKCd4MScpID09IGxpbmUuZ2V0QXR0cmlidXRlKCd4MicpXG4gIH1cblxuICBmdW5jdGlvbiBhcHBseV9kaW1lbnNpb25zKGRpYWdyYW0pe1xuICAgIC8vIGFwcGx5IGhlaWdodCAvIHdpZHRoIG9uIG5vZGVzXG4gICAgdmFyIGJib3hfY2FjaGUgPSB7fVxuICAgIGRpYWdyYW0uZ3JhcGguZWFjaE5vZGUoZnVuY3Rpb24oaWQsIG5vZGUpe1xuICAgICAgdmFyIGNsYXNzbmFtZSA9IG5vZGUuY2xhc3NuYW1lXG4gICAgICB2YXIgYmJveCA9IGJib3hfY2FjaGVbY2xhc3NuYW1lXSB8fCAoYmJveF9jYWNoZVtjbGFzc25hbWVdID0gaW52aXpfYmJveChkaWFncmFtLCBmcm9tX2RlZnMoZGlhZ3JhbSwgY2xhc3NuYW1lKSkpXG4gICAgICBub2RlLmF0dHIoJ3dpZHRoJywgYmJveC53aWR0aClcbiAgICAgIG5vZGUuYXR0cignaGVpZ2h0JywgYmJveC5oZWlnaHQpXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc3BsYXlfbm9kZXMobGF5b3V0LCBkaWFncmFtKXtcbiAgICAvLyBkaXNwbGF5IG5vZGVzXG4gICAgbGF5b3V0LmVhY2hOb2RlKGZ1bmN0aW9uKGlkLCB2YWx1ZXMpe1xuICAgICAgdmFyIG5vZGUgPSBkaWFncmFtLmdyYXBoLm5vZGUoaWQpXG4gICAgICBub2RlLmF0dHIoJ3gnLCB2YWx1ZXMueClcbiAgICAgIG5vZGUuYXR0cigneScsIHZhbHVlcy55KVxuICAgICAgdmFyIHggPSB2YWx1ZXMueCAtIHZhbHVlcy53aWR0aCAvIDJcbiAgICAgIHZhciB5ID0gdmFsdWVzLnkgLSB2YWx1ZXMuaGVpZ2h0IC8gMlxuICAgICAgbm9kZS5hZGRfYXR0cignOmZpcnN0JywgJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHggKyAnLCcgKyB5ICsgJyknKVxuICAgICAgbm9kZS50cmFuc2Zvcm0odmFsdWVzKVxuICAgICAgZHJhdyhkaWFncmFtLCBub2RlKVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBpbml0X2xheW91dChkaWFncmFtKXtcbiAgICBhcHBseV9kaW1lbnNpb25zKGRpYWdyYW0pXG4gICAgcmV0dXJuIGRpYWdyYW0ucnVuKGRpYWdyYW0uZ3JhcGgpXG4gIH1cblxuXG4gIGZ1bmN0aW9uIGRyYXdfc2VnbWVudChkaWFncmFtLCB0cmFuc2Zvcm0sIHRhcmdldCwgc2VnbWVudCl7XG4gICAgdmFyIHRyYW5zZl9vYmogPSBPYmplY3QuY3JlYXRlKHRyYW5zZm9ybSlcbiAgICB0cmFuc2Zfb2JqLmNvbnRlbnQgPSB7fVxuICAgIHRyYW5zZl9vYmouY29udGVudFt0YXJnZXRdID0gc2VnbWVudFxuICAgIGRyYXcoZGlhZ3JhbSwgdHJhbnNmX29iailcbiAgICByZXR1cm4gc2VnbWVudFxuICB9XG5cbiAgZnVuY3Rpb24gZHJhd19zZWdtZW50cyhkaWFncmFtLCB0cmFuc2Zvcm0sIHRhcmdldCwgZWRnZXMpe1xuICAgIHZhciB0cmFuc2Zfb2JqID0gT2JqZWN0LmNyZWF0ZSh0cmFuc2Zvcm0pXG4gICAgdHJhbnNmX29iai5jb250ZW50ID0ge31cbiAgICB0cmFuc2Zfb2JqLmNvbnRlbnRbdGFyZ2V0XSA9IGVkZ2VzLm1hcChmdW5jdGlvbihzKXsgcmV0dXJuIHsnOmZpcnN0Jzogc319KVxuICAgIGRyYXcoZGlhZ3JhbSwgdHJhbnNmX29iailcbiAgICByZXR1cm4gZWRnZXNcbiAgfVxuXG4gIHZhciBnZXRfanVuY3Rpb25fbm9kZSA9IHBsdWNrKCdub2RlJylcbiAgdmFyIGdldF9qdW5jdGlvbl9jdXQgPSBwbHVjaygnY3V0JylcblxuICBmdW5jdGlvbiBkaXNwbGF5KGRpYWdyYW0pe1xuXG4gICAgdmFyIHRyYW5zZm9ybV9vYmplY3QgPSB7IGNsYXNzbmFtZTogZGlhZ3JhbS5jb25maWcuZWRnZUNsYXNzIH1cblxuICAgIC8vIHJlbW92ZSBhbGwgc3ZnIG5vZGVzXG4gICAgLy8gVE9ETzogYXQgc29tZSBwb2ludCB0aGlzIGNvdWxkIGJlIG9wdGltYWxpemVkIHNvIHdlIHJldXNlIHRoZSBub2RlcyB3aGljaCBkbyBub3QgY2hhbmdlXG4gICAgZGlhZ3JhbS5zdmdlbC5jbGVhcigpXG5cblxuICAgIHZhciBsYXlvdXQgPSBpbml0X2xheW91dChkaWFncmFtKVxuXG4gICAgZGlzcGxheV9ub2RlcyhsYXlvdXQsIGRpYWdyYW0pXG5cbiAgICB2YXIgb3V0Z3JhcGggPSBsYXlvdXQuZ3JhcGgoKVxuICAgIHZhciByYW5rRGlyID0gb3V0Z3JhcGgucmFua0RpclxuICAgIHZhciB2ZXJ0aWNhbCA9IHJhbmtEaXIgPT0gJ1RCJyB8fCByYW5rRGlyID09ICdCVCdcblxuICAgIC8vIGNhbGN1bGF0ZSBlZGdlcyBsYXlvdXRcbiAgICB2YXIgZWRnZXMgPSByZXF1aXJlKCcuL2VkZ2VzLmpzJykoZGlhZ3JhbSwgbGF5b3V0KVxuXG4gICAgZHJhd19zZWdtZW50cyhkaWFncmFtLCB0cmFuc2Zvcm1fb2JqZWN0LCAnLkVkZ2UnLCBlZGdlcylcblxuICAgIHZhciBpbnRlcnNlY3Rpb25fc2l6ZSA9IGludml6X2Jib3goZGlhZ3JhbSwgZnJvbV9kZWZzKGRpYWdyYW0sIGRpYWdyYW0uY29uZmlnLmludGVyc2VjdGlvbkNsYXNzKSlcbiAgICB2YXIgaW50ZXJzZWN0aW9uX21pZGRsZSA9IFtpbnRlcnNlY3Rpb25fc2l6ZS53aWR0aCAvIDIsIGludGVyc2VjdGlvbl9zaXplLmhlaWdodCAvIDJdXG4gICAgZWRnZXMuZm9yRWFjaChmdW5jdGlvbihzZWcxLCBpZDEpe1xuICAgICAgZWRnZXMuZm9yRWFjaChmdW5jdGlvbihzZWcyLCBpZDIpe1xuICAgICAgICBpZiAoIGlkMiA+IGlkMSAmJiBzZWcxLngxICE9IHNlZzIueDEgJiYgIHNlZzEueDIgIT0gc2VnMi54MlxuICAgICAgICAgICAgICAgICAgICAgICAmJiBzZWcxLnkxICE9IHNlZzIueTEgJiYgIHNlZzEueTIgIT0gc2VnMi55MlxuICAgICAgICAgICAgICAgICAgICAgICAmJiBzZWcxLngxICE9IHNlZzIueDIgJiYgIHNlZzEueTEgIT0gc2VnMi55MlxuICAgICAgICAgICAgICAgICAgICAgICAmJiBzZWcxLngxICE9IHNlZzIueTEgJiYgIHNlZzEueDIgIT0gc2VnMi55MlxuICAgICAgICAgICAgICAgICAgICAgICAmJiBzZWcxLngxICE9IHNlZzIueTIgJiYgIHNlZzEueDIgIT0gc2VnMi55MVxuICAgICAgICAgICApIHtcbiAgICAgICAgICB2YXIgaXNjdCA9IGludGVyc2VjdChzZWcxLCBzZWcyKVxuICAgICAgICAgIGlmICggaXNjdFswXSA9PSA4ICkgeyAvLyBpbnRlcnNlY3RpbmdcbiAgICAgICAgICAgIHZhciBzZWcxbm9kZSA9IGRvbS4kaWQoc2VnMS5pZClcbiAgICAgICAgICAgIHZhciBzZWcybm9kZSA9IGRvbS4kaWQoc2VnMi5pZClcbiAgICAgICAgICAgIHZhciB0b3Bub2RlID0gc2VnMW5vZGUuY29tcGFyZURvY3VtZW50UG9zaXRpb24oc2VnMm5vZGUpICYgNCA/IHNlZzFub2RlIDogc2VnMm5vZGVcbiAgICAgICAgICAgIHZhciBpbnRlcnNlY3Rfbm9kZSA9IGRyYXcoZGlhZ3JhbSwgeyBjbGFzc25hbWU6IGRpYWdyYW0uY29uZmlnLmludGVyc2VjdGlvbkNsYXNzICwgY29udGVudDoge30gfSlcbiAgICAgICAgICAgIGlmICggaG9yaXpvbnRhbCh0b3Bub2RlKSApIHtcbiAgICAgICAgICAgICAgaW50ZXJzZWN0X25vZGUudHJhbnNmb3JtKChuZXcgU25hcC5NYXRyaXgoMSwgMCwgMCwgMSwgMCAsIDApKS5yb3RhdGUoOTAsIGlzY3RbMV1bMF0gLCBpc2N0WzFdWzFdICkudG9UcmFuc2Zvcm1TdHJpbmcoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNmb3JtKGludGVyc2VjdF9ub2RlLm1hdHJpeC50cmFuc2xhdGUoaXNjdFsxXVswXSAtIGludGVyc2VjdGlvbl9taWRkbGVbMF0sIGlzY3RbMV1bMV0gLSBpbnRlcnNlY3Rpb25fbWlkZGxlWzFdKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGludGVyc2VjdF9ub2RlLnRyYW5zZm9ybShuZXcgU25hcC5NYXRyaXgoMSwgMCwgMCwgMSwgaXNjdFsxXVswXSAtIGludGVyc2VjdGlvbl9taWRkbGVbMF0sIGlzY3RbMV1bMV0gLSBpbnRlcnNlY3Rpb25fbWlkZGxlWzFdKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZG9tLmluc2VydEFmdGVyKHRvcG5vZGUucGFyZW50Tm9kZSwgaW50ZXJzZWN0X25vZGUubm9kZSwgdG9wbm9kZS5uZXh0U2libGluZylcblxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgdmFyIG1vdmUgPSBuZXcgU25hcC5NYXRyaXgoMSwgMCwgMCwgMSwgMCwgMClcbiAgICBpZiAoIHJhbmtEaXIgPT0gXCJMUlwiIHx8IHJhbmtEaXIgPT0gXCJSTFwiICkge1xuICAgICAgb3V0Z3JhcGguaGVpZ2h0ID0gb3V0Z3JhcGguaGVpZ2h0ICsgZWRnZXMuZ3Jvd3RoICogMlxuICAgICAgdmFyIG1vdmUgPSBtb3ZlLnRyYW5zbGF0ZSgwLCBlZGdlcy5ncm93dGgpXG4gICAgfSBlbHNlIHtcbiAgICAgIG91dGdyYXBoLndpZHRoID0gb3V0Z3JhcGgud2lkdGggKyBlZGdlcy5ncm93dGggKiAyXG4gICAgICB2YXIgbW92ZSA9IG1vdmUudHJhbnNsYXRlKGVkZ2VzLmdyb3d0aCwgMClcbiAgICB9XG5cbiAgICBkaWFncmFtLnN2Z2VsLmF0dHIoeyB3aWR0aDogb3V0Z3JhcGgud2lkdGgsIGhlaWdodDogb3V0Z3JhcGguaGVpZ2h0IH0pLnRyYW5zZm9ybShtb3ZlLnRvVHJhbnNmb3JtU3RyaW5nKCkpXG5cbiAgICBpZiAoIHZlcnRpY2FsICkge1xuICAgICAgZGlhZ3JhbS5jb25maWcuaGVpZ2h0ID0gZGlhZ3JhbS5jb25maWcuaGVpZ2h0ICsgZWRnZXMuZ3Jvd3RoXG4gICAgfSBlbHNlIHtcbiAgICAgIGRpYWdyYW0uY29uZmlnLndpZHRoID0gZGlhZ3JhbS5jb25maWcud2lkdGggKyBlZGdlcy5ncm93dGhcbiAgICB9XG5cbiAgICBkaWFncmFtLnN2Z2VsLnBhcmVudCgpLmF0dHIoe1xuICAgICAgd2lkdGg6IG91dGdyYXBoLndpZHRoICsgZGlhZ3JhbS5jb25maWcucGFkZGluZyAqIDJcbiAgICAsIGhlaWdodDogb3V0Z3JhcGguaGVpZ2h0ICsgZGlhZ3JhbS5jb25maWcucGFkZGluZyAqIDJcbiAgICB9KVxuXG4gICAgcmV0dXJuIGRpYWdyYW1cbiAgfVxuXG4gIHZhciBlbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9lbWl0dGVyLmpzJylcbiAgdmFyIGxheW91dCA9IGVtaXR0ZXIuZXh0ZW5kKGRhZ3JlLmxheW91dCgpKVxuXG4gIG1vZHVsZS5leHBvcnRzID0gbGF5b3V0LmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oY29uZmlnLCBncmFwaCl7XG4gICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgT2JqZWN0LmtleXMoY29uZmlnLmxheW91dF9jb25maWcpLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKXtcbiAgICAgICAgdGhpc1ttZXRob2RdKGNvbmZpZy5sYXlvdXRfY29uZmlnW21ldGhvZF0pXG4gICAgICB9LCB0aGlzKVxuICAgICAgdGhpcy5yYW5rU2ltcGxleCA9IHRydWVcbiAgICAgIHRoaXMuZ3JhcGggPSBncmFwaFxuICAgICAgdGhpcy5pZCA9IHVpZCgpXG4gICAgICB0aGlzLnN2Z2VsID0gU25hcC5hcHBseShTbmFwLCBjb25maWcuc25hcF9hcmdzKS5nKCkuYXR0cih7IHRyYW5zZm9ybTogXCJ0cmFuc2xhdGUoMjAsMjApXCIsIGlkOnRoaXMuaWR9KVxuICAgICAgdGhpcy5ub2RlID0gdGhpcy5zdmdlbC5wYXJlbnQoKS5ub2RlXG4gICAgfVxuICAsIGRpc3BsYXk6IGVuc2xhdmUoZGlzcGxheSlcbiAgLCBkcmF3OiBlbnNsYXZlKGRyYXcpXG4gICwgdG9fZGVmczogZW5zbGF2ZSh0b19kZWZzKVxuXG4gIH0pXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcbiAgdmFyIHppcGcgPSByZXF1aXJlKCcuLi91dGlsL3ppcHMuanMnKS56aXBHcmVlZHlcblxuICAvLyBbYV0g4oaSIGFcbiAgZnVuY3Rpb24gZmlyc3QoYXMpeyByZXR1cm4gYXMgJiYgYXNbMF0gfVxuXG4gIC8vIFthXSDihpIgYVxuICBmdW5jdGlvbiBsYXN0KGFzKXsgcmV0dXJuIGFzICYmIGFzW2FzLmxlbmd0aCAtIDBdIH1cblxuICAvLyBhIOKGkiBCb29sZWFuXG4gIGZ1bmN0aW9uIG5vdF9udWxsKGEpeyByZXR1cm4gYSAhPSBudWxsIH1cblxuICAvLyAoYSwgYikg4oaSIEJvb2xlYW5cbiAgZnVuY3Rpb24gZXF1YWwoYSwgYil7IHJldHVybiBhID09PSBiIH1cblxuICAvLyAoYSwgYikg4oaSIEJvb2xlYW5cbiAgZnVuY3Rpb24gbm90X2VxdWFsKGEsIGIpeyByZXR1cm4gYSAhPT0gYiB9XG5cbiAgLy8gKGExIOKGkiBhMiDihpIgLi4uIOKGkiBhTiDihpIgYikg4oaSICgjW2ExLCBhMiwgLi4uLCBhTikg4oaSIGIpXG4gIGZ1bmN0aW9uIHNwcmVhZChmKXtcbiAgICByZXR1cm4gZnVuY3Rpb24oYXJncyl7IHJldHVybiBmLmFwcGx5KHRoaXMsIGFyZ3MpIH1cbiAgfVxuXG4gIC8vIChbW2FdXSDihpIgW2FdKVxuICBmdW5jdGlvbiBmbGF0dGVuKG5lc3RlZCl7XG4gICAgcmV0dXJuIFtdLmNvbmNhdC5hcHBseShbXSwgbmVzdGVkKVxuICB9XG5cbiAgZnVuY3Rpb24gY29tcGFyZV9saXN0cyhsMSwgbDIpe1xuICAgIHJldHVybiB6aXBnKGwxLCBsMikuZXZlcnkoc3ByZWFkKGVxdWFsKSlcbiAgfVxuXG4gIC8vIChbW05vZGVdXSwgW05vZGVdKSDihpIgQm9vbGVhblxuICBmdW5jdGlvbiBmaW5kX3N1Ymxpc3QobGlzdHMsIGwpe1xuICAgIHJldHVybiBsaXN0cy5zb21lKGNvbXBhcmVfbGlzdHMuYmluZChudWxsLCBsKSlcbiAgfVxuXG4gIC8vIEVkZ2Ug4oaSIFtFZGdlXVxuICBmdW5jdGlvbiBNZXJnZWRFZGdlKGVkZ2Upe1xuICAgIHJldHVybiBbZWRnZV1cbiAgfVxuXG4gIC8vIEVkZ2Ug4oaSIE5vZGVcbiAgZnVuY3Rpb24gc291cmNlKGVkZ2Upe1xuICAgIHZhciBmaXJzdF9wb2ludCA9IGZpcnN0KGVkZ2UpXG4gICAgcmV0dXJuIGZpcnN0X3BvaW50ICYmIGZpcnN0X3BvaW50LmV4aXRcbiAgfVxuXG4gIC8vIEVkZ2Ug4oaSIE5vZGVcbiAgZnVuY3Rpb24gdGFyZ2V0KGVkZ2Upe1xuICAgIHZhciBsYXN0X3BvaW50ID0gbGFzdChlZGdlKVxuICAgIHJldHVybiBsYXN0X3BvaW50ICYmIGxhc3RfcG9pbnQuZXhpdFxuICB9XG5cbiAgLy8gTWVyZ2VkRWRnZSDihpIgW05vZGVdXG4gIGZ1bmN0aW9uIG1lX3NvdXJjZShtZXJnZWRfZWRnZSl7XG4gICAgcmV0dXJuIG1lcmdlZF9lZGdlLm1hcChzb3VyY2UpLmZpbHRlcihub3RfbnVsbClcbiAgfVxuXG4gIC8vIE1lcmdlZEVkZ2Ug4oaSIFtOb2RlXVxuICBmdW5jdGlvbiBtZV90YXJnZXQobWVyZ2VkX2VkZ2Upe1xuICAgIHJldHVybiBtZXJnZWRfZWRnZS5tYXAodGFyZ2V0KS5maWx0ZXIobm90X251bGwpXG4gIH1cblxuICAvLyBbTWVyZ2VkRWRnZV0g4oaSIFtbTm9kZV1dXG4gIGZ1bmN0aW9uIG1lc19zb3VyY2VzKG1lcyl7XG4gICAgcmV0dXJuIG1lcy5tYXAobWVfc291cmNlKVxuICB9XG5cbiAgLy8gW01lcmdlZEVkZ2VdIOKGkiBbW05vZGVdXVxuICBmdW5jdGlvbiBtZXNfdGFyZ2V0cyhtZXMpe1xuICAgIHJldHVybiBtZXMubWFwKG1lX3RhcmdldClcbiAgfVxuXG4gIC8vIChNZXJnZWRFZGdlLCBNZXJnZWRFZGdlKSDihpIgQm9vbFxuICBmdW5jdGlvbiBzYW1lX3NvdXJjZShhLCBiKXtcbiAgICByZXR1cm4gY29tcGFyZV9saXN0cyhtZV9zb3VyY2UoYSksIG1lX3NvdXJjZShiKSlcbiAgfVxuXG4gIC8vIChNZXJnZWRFZGdlLCBNZXJnZWRFZGdlKSDihpIgQm9vbFxuICBmdW5jdGlvbiBzYW1lX3RhcmdldChhLCBiKXtcbiAgICByZXR1cm4gY29tcGFyZV9saXN0cyhtZV90YXJnZXQoYSksIG1lX3RhcmdldChiKSlcbiAgfVxuXG4gIC8vIChNZXJnZWRFZGdlLCBNZXJnZWRFZGdlKSDihpIgQm9vbFxuICBmdW5jdGlvbiBkaWZmZXJlbnRfc291cmNlKGEsIGIpe1xuICAgIHJldHVybiAhIGNvbXBhcmVfbGlzdHMobWVfc291cmNlKGEpLCBtZV9zb3VyY2UoYikpXG4gIH1cblxuICAvLyAoTWVyZ2VkRWRnZSwgTWVyZ2VkRWRnZSkg4oaSIEJvb2xcbiAgZnVuY3Rpb24gZGlmZmVyZW50X3RhcmdldChhLCBiKXtcbiAgICByZXR1cm4gISBjb21wYXJlX2xpc3RzKG1lX3RhcmdldChhKSwgbWVfdGFyZ2V0KGIpKVxuICB9XG5cbiAgLy8gKFtNZXJnZWRFZGdlXSwgTWVyZ2VkRWRnZSkg4oaSIFtNZXJnZWRFZGdlXVxuICBmdW5jdGlvbiBkaWZmZXJlbnRfc291cmNlcyhtZXMsIG1lKXtcbiAgICByZXR1cm4gbWVzLmZpbHRlcihkaWZmZXJlbnRfc291cmNlLmJpbmQobnVsbCwgbWUpKVxuICB9XG5cbiAgLy8gKFtNZXJnZWRFZGdlXSwgTWVyZ2VkRWRnZSkg4oaSIFtNZXJnZWRFZGdlXVxuICBmdW5jdGlvbiBkaWZmZXJlbnRfdGFyZ2V0cyhtZXMsIG1lKXtcbiAgICByZXR1cm4gbWVzLmZpbHRlcihkaWZmZXJlbnRfdGFyZ2V0LmJpbmQobnVsbCwgbWUpKVxuICB9XG5cbiAgLy8gKFtNZXJnZWRFZGdlXSwgTWVyZ2VkRWRnZSkg4oaSIFtNZXJnZWRFZGdlXVxuICBmdW5jdGlvbiBzYW1lX3NvdXJjZXMobWVzLCBtZSl7XG4gICAgcmV0dXJuIG1lcy5maWx0ZXIoc2FtZV9zb3VyY2UuYmluZChudWxsLCBtZSkpXG4gIH1cblxuICAvLyAoW01lcmdlZEVkZ2VdLCBNZXJnZWRFZGdlKSDihpIgW01lcmdlZEVkZ2VdXG4gIGZ1bmN0aW9uIHNhbWVfdGFyZ2V0cyhtZXMsIG1lKXtcbiAgICByZXR1cm4gbWVzLmZpbHRlcihzYW1lX3RhcmdldC5iaW5kKG51bGwsIG1lKSlcbiAgfVxuXG4gIC8vIChbTWVyZ2VkRWRnZV0sIE1lcmdlZEVkZ2UpIOKGkiBbTWVyZ2VkRWRnZV1cbiAgZnVuY3Rpb24gbmV3X3NvdXJjZXMobWVzLCBtZSl7XG4gICAgdmFyIG1lc19zID0gbWVzX3NvdXJjZXMobWVzKVxuICAgIHZhciBpc19tZV9uZXcgPSBtZXNfcy5sZW5ndGggPT0gMCB8fCAhIGZpbmRfc3VibGlzdChtZXNfcywgbWVfc291cmNlKG1lKSlcbiAgICByZXR1cm4gaXNfbWVfbmV3ID8gW21lXSA6IFtdXG4gIH1cblxuICAvLyAoW01lcmdlZEVkZ2VdLCBNZXJnZWRFZGdlKSDihpIgW01lcmdlZEVkZ2VdXG4gIGZ1bmN0aW9uIG5ld190YXJnZXRzKG1lcywgbWUpe1xuICAgIHZhciBtZXNfdCA9IG1lc190YXJnZXRzKG1lcylcbiAgICB2YXIgaXNfbWVfbmV3ID0gbWVzX3QubGVuZ3RoID09IDAgfHwgISBmaW5kX3N1Ymxpc3QobWVzX3QsIG1lX3RhcmdldChtZSkpXG4gICAgcmV0dXJuIGlzX21lX25ldyA/IFttZV0gOiBbXVxuICB9XG5cbiAgLy8gKE1lcmdlZEVkZ2UsIE1lcmdlZEVkZ2UpIOKGkiBNZXJnZWRFZGdlXG4gIGZ1bmN0aW9uIG1lcmdlX2J5X3NvdXJjZShiLCBhKXtcbiAvL2xvZyhhLCBiKVxuICAgIGJbMF1bMF0ucmVtb3ZlKClcbiAgICBiWzBdWzBdID0gYVswXVswXVxuICAgIGJbMF1bMV0gPSBhWzBdWzFdXG4gICAgYlswXVsyXS5leGl0X2p1bmN0aW9uID0gYlswXVsxXVxuICAgIHJldHVybiBhLmNvbmNhdChiKVxuICB9XG5cbiAgLy8gKE1lcmdlZEVkZ2UsIE1lcmdlZEVkZ2UpIOKGkiBNZXJnZWRFZGdlXG4gIGZ1bmN0aW9uIG1lcmdlX2J5X3RhcmdldChiLCBhKXtcbiAvL2xvZyhhLCBiKVxuICAgIHZhciBiX2xhc3QgPSBiLmxlbmd0aCAtIDFcbiAgICB2YXIgYV9sYXN0ID0gYS5sZW5ndGggLSAxXG4gICAgdmFyIGJfZW5kID0gYltiX2xhc3RdLmxlbmd0aCAtIDFcbiAgICB2YXIgYV9lbmQgPSBhW2FfbGFzdF0ubGVuZ3RoIC0gMVxuICAgIGJbYl9sYXN0XVtiX2VuZF0ucmVtb3ZlKClcbiAgICBiW2JfbGFzdF1bYl9lbmRdID0gYVthX2xhc3RdW2FfZW5kXVxuICAgIGJbYl9sYXN0XVtiX2VuZCAtIDFdID0gYVthX2xhc3RdW2FfZW5kIC0gMV1cbiAgICBiW2JfbGFzdF1bYl9lbmQgLSAyXS5leGl0X2p1bmN0aW9uID0gYltiX2xhc3RdW2JfZW5kIC0gMV1cblxuICAgIHJldHVybiBhLmNvbmNhdChiKVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlZGdlcyl7XG4gICAgdmFyIG1lcyA9IGVkZ2VzLm1hcChNZXJnZWRFZGdlKVxuICAgICAgICAgICAgICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24obWVzLCBtZSl7XG5cbiAgICAgIHZhciBkcyA9IGRpZmZlcmVudF9zb3VyY2VzKG1lcywgbWUpXG4gICAgICB2YXIgc3MgPSBzYW1lX3NvdXJjZXMobWVzLCBtZSlcbiAgICAgIHZhciBtcyA9IHNzLm1hcChtZXJnZV9ieV9zb3VyY2UuYmluZChudWxsLCBtZSkpXG4gICAgICB2YXIgbnMgPSBuZXdfc291cmNlcyhtZXMsIG1lKVxuXG4gICAgICB2YXIgcyA9IGRzLmNvbmNhdChtcywgbnMpXG5cblxuICAgICAgdmFyIGR0ID0gZGlmZmVyZW50X3RhcmdldHMocywgbWUpXG4gICAgICB2YXIgc3QgPSBzYW1lX3RhcmdldHMocywgbWUpXG4gICAgICB2YXIgbXQgPSBzdC5tYXAobWVyZ2VfYnlfdGFyZ2V0LmJpbmQobnVsbCwgbWUpKVxuICAgICAgdmFyIG50ID0gbmV3X3RhcmdldHMocywgbWUpXG5cblxuXG4gICAgICByZXR1cm4gZHQuY29uY2F0KG10LCBudClcbiAgICB9LCBbXSlcblxuLy8gICAgICB2YXIgZXhpdF9kb3VibGUgPSBleGl0X2RvdWJsZXMucmVkdWNlKGZ1bmN0aW9uKF8sbWUpeyByZXR1cm4gbWV9LCBmYWxzZSlcbi8vICAgIHZhciBleGl0X2RvdWJsZXMgPVxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihmdW5jdGlvbihtZSl7XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZVswXS5leGl0ID09IGVkZ2VbMF0uZXhpdFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbi8vXG5cbi8vbG9nKG1lcywgZmxhdHRlbihtZXMpKVxuICAgIHJldHVybiBmbGF0dGVuKG1lcylcbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgdmFyIHppcCA9IHJlcXVpcmUoJy4uL3V0aWwvemlwcy5qcycpLnppcFxuICB2YXIgdWlkID0gcmVxdWlyZSgnLi4vdXRpbC91bmlxdWVfaWQuanMnKVxuICB2YXIgdHJhbnNsYXRlID0gcmVxdWlyZSgnLi4vdXRpbC90cmFuc2xhdGUuanMnKVxuICB2YXIgR2FwcyA9IHJlcXVpcmUoJy4vZ2Fwcy5qcycpXG4gIHZhciBzaWRlX3BvaW50cyA9IHJlcXVpcmUoJy4vc2lkZV9wb2ludHMuanMnKVxuICB2YXIganVuY3Rpb25fcG9pbnRzID0gcmVxdWlyZSgnLi9qdW5jdGlvbl9wb2ludHMuanMnKVxuICB2YXIgc2tpcF9wb2ludHMgPSByZXF1aXJlKCcuL3NraXBfcG9pbnRzLmpzJylcblxudmFyIGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcblxuICBmdW5jdGlvbiBub2RlX2Zyb21faWQoZ3JhcGgsIGlkKXtcbiAgICB2YXIgbiA9IGdyYXBoLm5vZGUoaWQpXG4gICAgbi5pZCA9IGlkXG4gICAgbi5ncmFwaCA9IGdyYXBoXG4gICAgcmV0dXJuIG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9ub2RlcyhkaWFncmFtLCBsYXlvdXQpe1xuICAgIHZhciBub2RlcyA9IFtdXG4gICAgdmFyIGcgPSBsYXlvdXQuZ3JhcGgoKVxuICAgIHZhciByYW5rRGlyID0gZy5yYW5rRGlyXG4gICAgdmFyIHZlcnRpY2FsID0gcmFua0RpciA9PSAnVEInIHx8IHJhbmtEaXIgPT0gJ0JUJ1xuICAgIHZhciByYW5rX2F0dHIgPSB2ZXJ0aWNhbCA/ICd5JyA6ICd4J1xuICAgIHZhciBub2RlX3JhbmtfZGltZW5zaW9uID0gZ2V0X3JhbmtfZGltZW5zaW9uLmJpbmQobnVsbCwgZGlhZ3JhbS5jb25maWcucmFua19kZXRlY3Rpb25fZXJyb3JfbWFyZ2luLCByYW5rX2F0dHIpXG4gICAgdmFyIG5vZGVfZnJvbV9sYXlvdXQgPSBub2RlX2Zyb21faWQuYmluZChudWxsLCBsYXlvdXQpXG4gICAgdmFyIGVkZ2VfZnJvbV9sYXlvdXQgPSBub2RlX2Zyb21faWQuYmluZChudWxsLCBsYXlvdXQpXG4gICAgbGF5b3V0LmVhY2hOb2RlKGZ1bmN0aW9uKGlkLCBub2RlKXtcbiAgICAgIG5vZGUucmRpbSA9IE51bWJlcihub2RlX3JhbmtfZGltZW5zaW9uKG5vZGUpKVxuICAgICAgbm9kZS50YXJnZXRzID0gbGF5b3V0Lm91dEVkZ2VzKGlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChsYXlvdXQudGFyZ2V0LmJpbmQobGF5b3V0KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAobm9kZV9mcm9tX2xheW91dClcbiAgICAgIG5vZGUuc291cmNlcyA9IGxheW91dC5pbkVkZ2VzKGlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChsYXlvdXQuc291cmNlLmJpbmQobGF5b3V0KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAobm9kZV9mcm9tX2xheW91dClcbiAgICAgIG5vZGVzLnB1c2gobm9kZSlcbiAgICB9KVxuICAgIHJldHVybiBub2Rlc1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3JhbmtfZGltZW5zaW9uKG1hcmdpbiwga2V5LCBub2RlKXtcbiAgICByZXR1cm4gTWF0aC5jZWlsKG5vZGVba2V5XSAvIG1hcmdpbikgKiBtYXJnaW5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZV9zZWdtZW50KHN0YXJ0LCBlbmQpe1xuICAgIHJldHVybiB7IGlkOiB1aWQoKSwgeDE6IHN0YXJ0LngsIHkxOnN0YXJ0LnksIHgyOiBlbmQueCwgeTI6IGVuZC55fVxuICB9XG5cbiAgZnVuY3Rpb24gc2VnbWVudHMoc3RlcHMsIHMpe1xuICAgIHJldHVybiBzdGVwcy5jb25jYXQoemlwKHMsIHMuc2xpY2UoMSkpLm1hcChmdW5jdGlvbihqKXtcbiAgICAgIHJldHVybiBjcmVhdGVfc2VnbWVudChqWzBdLnN0YXRpYygpLCBqWzFdLnN0YXRpYygpKVxuICAgIH0pKVxuICB9XG5cbiAgZnVuY3Rpb24gaWR4X3RvX2lkKHMsIHQsIGkpe1xuICAgIHNbdC5pZF0gPSBpXG4gICAgcmV0dXJuIHNcblxuICB9XG5cblxuICBmdW5jdGlvbiBzb3J0X2J5X29yaWVudGF0aW9uKHZlcnRpY2FsLCBhLCBiKXsgcmV0dXJuIHZlcnRpY2FsID8gYSA6IGIgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYXBzX2VkZ2VzKGdhcHMpe1xuICAgIHJldHVybiBnYXBzLnJlZHVjZShmdW5jdGlvbihlZGdlcywgZWRnZSl7XG4gICAgICByZXR1cm4gZWRnZXMuY29uY2F0KGVkZ2UuZm9yd2FyZF9za2lwcy5jb25jYXQoZWRnZS5zdGVwcywgZWRnZS5iYWNrd2FyZF9za2lwcykpXG4gICAgfSwgW10pXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNhbGN1bGF0ZV9lZGdlcyhkaWFncmFtLCBsYXlvdXQpe1xuXG5cbiAgICBmdW5jdGlvbiBzdGVwcyhnYXAsIGV4aXRfcG9pbnQsIHNpKXtcbiAgICAgIHZhciBlbnRyeV9ub2RlID0gZXhpdF9wb2ludC5wYWlyX25vZGVcbiAgICAgIHZhciBlbnRyeV9wb2ludCA9IGV4aXRfcG9pbnQub3RoZXJfZW5kcG9pbnQoKVxuICAgICAgdmFyIGV4aXRfanVuY3Rpb24gPSBqdW5jdGlvbl9wb2ludHMubWFrZSgnc3RlcCcsIGV4aXRfcG9pbnQsIHNpLCBnYXAsIHJhbmtEaXIsIHJhbmtTZXApXG4gICAgICByZXR1cm4gW1xuICAgICAgICBleGl0X3BvaW50XG4gICAgICAsIGV4aXRfanVuY3Rpb25cbiAgICAgICwganVuY3Rpb25fcG9pbnRzLm1ha2UoJ3N0ZXAnLCBlbnRyeV9wb2ludCwgc2ksIGdhcCwgcmFua0RpciwgcmFua1NlcCwgbnVsbCwgZXhpdF9qdW5jdGlvbilcbiAgICAgICwgZW50cnlfcG9pbnRcbiAgICAgIF1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBza2lwcyhnYXAsIGRpcmVjdGlvbiwgZXhpdF9wb2ludCwgc2kpe1xuICAgICAgdmFyIGVudHJ5X25vZGUgPSBleGl0X3BvaW50LnBhaXJfbm9kZVxuICAgICAgdmFyIGVudHJ5X3BvaW50ID0gZXhpdF9wb2ludC5vdGhlcl9lbmRwb2ludCgpXG4gICAgICB2YXIgZXhpdF9qdW5jdGlvbiA9IGp1bmN0aW9uX3BvaW50cy5tYWtlKCdleGl0JywgZXhpdF9wb2ludCwgc2ksIGdhcCwgcmFua0RpciwgcmFua1NlcCwgZGlyZWN0aW9uKVxuICAgICAgdmFyIGVudHJ5X2p1bmN0aW9uID0ganVuY3Rpb25fcG9pbnRzLm1ha2UoJ2VudHJ5JywgZW50cnlfcG9pbnQsIHNpLCBnYXAsIHJhbmtEaXIsIHJhbmtTZXAsIGRpcmVjdGlvbilcbiAgICAgIHZhciByZXYgPSBkaXJlY3Rpb24gPT0gJ2ZvcndhcmQnID8gcmV2ZXJzZWQgOiAhIHJldmVyc2VkXG4gICAgICB2YXIgc2tpcCA9IFtcbiAgICAgICAgZXhpdF9wb2ludFxuICAgICAgLCBleGl0X2p1bmN0aW9uXG4gICAgICAsIHNraXBfcG9pbnRzLm1ha2UoJ2ZvcndhcmQnLCAgZXhpdF9qdW5jdGlvbiwgZ2FwLCBzaSwgcmFua0Rpciwgc2tpcHNlcCwgcmV2LCBnLCByYW5rX2F0dHIsIGxldmVsX2RpcilcbiAgICAgICwgc2tpcF9wb2ludHMubWFrZSgnZm9yd2FyZCcsIGVudHJ5X2p1bmN0aW9uLCBnYXAsIHNpLCByYW5rRGlyLCBza2lwc2VwLCByZXYsIGcsIHJhbmtfYXR0ciwgbGV2ZWxfZGlyKVxuICAgICAgLCBlbnRyeV9qdW5jdGlvblxuICAgICAgLCBlbnRyeV9wb2ludFxuICAgICAgXVxuICAgICAgcmV0dXJuIHNraXBcbiAgICB9XG5cbiAgICB2YXIgcmFua1NlcCA9IGRpYWdyYW0uY29uZmlnLmxheW91dF9jb25maWcucmFua1NlcFxuICAgIHZhciBnID0gbGF5b3V0LmdyYXBoKClcbiAgICB2YXIgcmFua0RpciA9IGcucmFua0RpclxuICAgIHZhciByZXZlcnNlZCA9IHJhbmtEaXIgPT0gJ0JUJyB8fCByYW5rRGlyID09ICdSTCdcbiAgICB2YXIgdmVydGljYWwgPSByYW5rRGlyID09ICdUQicgfHwgcmFua0RpciA9PSAnQlQnXG4gICAgdmFyIG9yaWVudGF0ZSA9IHNvcnRfYnlfb3JpZW50YXRpb24uYmluZChudWxsLCB2ZXJ0aWNhbClcbiAgICB2YXIgbGV2ZWxfZGlyID0gdmVydGljYWwgPyAnd2lkdGgnIDogJ2hlaWdodCdcbiAgICB2YXIgcmFua19hdHRyID0gdmVydGljYWwgPyAneScgOiAneCdcbiAgICB2YXIgbm9kZXMgPSBnZXRfbm9kZXMoZGlhZ3JhbSwgbGF5b3V0KVxuICAgIHZhciBza2lwc2VwID0gZGlhZ3JhbS5jb25maWcuc2tpcFNlcFxuXG4gICAgdmFyIG5vZGVzX2tleXMgPSBub2Rlcy5yZWR1Y2UoZnVuY3Rpb24obywgbm9kZSl7XG4gICAgICB2YXIgdiA9IG5vZGUucmRpbVxuICAgICAgOyhvW3ZdIHx8IChvW3ZdID0gW10pKS5wdXNoKG5vZGUpXG4gICAgICByZXR1cm4gb1xuICAgIH0sIHt9KVxuXG4gICAgbm9kZXMgPSBub2Rlcy5tYXAoZnVuY3Rpb24obil7XG4gICAgICBuLmV4aXRzID0gbi50YXJnZXRzLnJlZHVjZShpZHhfdG9faWQsIHt9KVxuICAgICAgbi5leGl0X3BvaW50cyA9IG4udGFyZ2V0cy5tYXAoZnVuY3Rpb24odGFyZ2V0X25vZGUpeyByZXR1cm4gc2lkZV9wb2ludHMubWFrZSgnZXhpdCcsIG4sIHJhbmtEaXIsIHRhcmdldF9ub2RlKSB9KVxuICAgICAgbi5lbnRyaWVzID0gbi5zb3VyY2VzLnJlZHVjZShpZHhfdG9faWQsIHt9KVxuICAgICAgbi5lbnRyeV9wb2ludHMgPSBuLnNvdXJjZXMubWFwKGZ1bmN0aW9uKHNvdXJjZV9ub2RlKXsgcmV0dXJuIHNpZGVfcG9pbnRzLm1ha2UoJ2VudHJ5JywgbiwgcmFua0Rpciwgc291cmNlX25vZGUpIH0pXG4gICAgICByZXR1cm4gblxuICAgIH0pXG5cbiAgICB2YXIgcmFua3MgPSAgT2JqZWN0LmtleXMobm9kZXNfa2V5cykuc29ydChmdW5jdGlvbihhLCBiKXsgcmV0dXJuICthIC0gK2IgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGssIGkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1trXS5tYXAoZnVuY3Rpb24obil7IG4udHJ1ZV9yYW5rID0gaTsgcmV0dXJuIG59KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNba11cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBub2Rlc19rZXlzKVxuICAgIHZhciBnYXBzID0gQXJyYXkocmFua3MubGVuZ3RoICsgMSlcblxuICAgIHJhbmtzLnJlZHVjZShmdW5jdGlvbihwLGEsaSkge1xuICAgICAgZ2Fwc1tpXSA9IEdhcHMuZXh0ZW5kKHtnZXRfZ2FwczogZnVuY3Rpb24oKXsgcmV0dXJuIGdhcHN9fSlcbiAgICAgICAgICAgICAgICAgICAgLm1ha2UocCwgYSwgaSwgc3RlcHMsIHNraXBzKVxuXG4gICAgICByZXR1cm4gYVxuICAgIH0sIFtdKVxuXG4gICAgZ2Fwc1tyYW5rcy5sZW5ndGhdID0gR2Fwcy5leHRlbmQoe2dldF9nYXBzOiBmdW5jdGlvbigpeyByZXR1cm4gZ2Fwc319KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFrZShyYW5rc1tyYW5rcy5sZW5ndGggLSAxXSwgW10sIHJhbmtzLmxlbmd0aCwgc3RlcHMsIHNraXBzKVxuXG4gICAgdmFyIGNvbGxhcHNlX2VkZ2VzID0gcmVxdWlyZSgnLi9lZGdlX2NvbGxhcHNlLmpzJylcbiAgICB2YXIgZWRnZXMgPSBjb2xsYXBzZV9lZGdlcyhnZXRfZ2Fwc19lZGdlcyhnYXBzKSkucmVkdWNlKHNlZ21lbnRzLCBbXSlcblxuXG4gICAgZWRnZXMuZ3Jvd3RoID0gZ2Fwcy5yZWR1Y2UoZnVuY3Rpb24oc3MsIHIpeyByZXR1cm4gc3MgKyByLmZvcndhcmRfc2tpcHMubGVuZ3RoICsgci5iYWNrd2FyZF9za2lwcy5sZW5ndGh9LCAwKSAqIHNraXBzZXBcblxuICAgIHJldHVybiBlZGdlc1xuICB9XG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG5cbiAgZnVuY3Rpb24gZ2V0X2VkZ2VzX2NvbWJpbmVkKGdhcCl7XG4gICAgcmV0dXJuIGdhcC5nZXRfZ2FwcygpLnJlZHVjZShmdW5jdGlvbihsLCBnKXtcbiAgICAgIHJldHVybiBsLmNvbmNhdCggW11cbiAgICAgICwgZy5mb3J3YXJkX3NraXBzXG4gICAgICAsIGdhcC5mb3J3YXJkX3NraXBzXG4gICAgICAsIGcuc3RlcHNcbiAgICAgICwgZ2FwLmJhY2t3YXJkX3NraXBzXG4gICAgICAsIGcuYmFja3dhcmRfc2tpcHNcbiAgICAgIClcbiAgICB9LCBbXSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9lZGdlcyhnYXApe1xuICAgIHJldHVybiBnYXAuZ2V0X2dhcHMoKS5yZWR1Y2UoZnVuY3Rpb24oZWRnZXMsIGVkZ2Upe1xuICAgICAgcmV0dXJuIGVkZ2VzLmNvbmNhdChlZGdlLmZvcndhcmRfc2tpcHMuY29uY2F0KGVkZ2Uuc3RlcHMsIGVkZ2UuYmFja3dhcmRfc2tpcHMpKVxuICAgIH0sIFtdKVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3N0ZXBzKGdhcCl7XG4gICAgcmV0dXJuIGdhcC5nZXRfZ2FwcygpW2dhcC5pbmRleF0uc3RlcHNcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihwcmV2X3JhbmssIHJhbmssIHJuLCBzdGVwcywgc2tpcHMpe1xuICAgICAgdmFyIGV4aXRzID0gcHJldl9yYW5rLnJlZHVjZShmdW5jdGlvbihzLCBuKXsgcmV0dXJuIHMuY29uY2F0KG4uZXhpdF9wb2ludHMpIH0sIFtdKVxuICAgICAgdmFyIGVudHJpZXMgPSByYW5rLnJlZHVjZShmdW5jdGlvbihzLCBuKXsgcmV0dXJuIHMuY29uY2F0KG4uZW50cnlfcG9pbnRzKSAgfSwgW10pXG4gICAgICB0aGlzLmV4aXRzID0gZXhpdHNcbiAgICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXNcbiAgICAgIHRoaXMuc3RlcHMgPSBleGl0cy5maWx0ZXIoZnVuY3Rpb24oZXhpdCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByYW5rLmluZGV4T2YoZXhpdC5lbnRyeSkgPiAtMVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoc3RlcHMuYmluZChudWxsLCB0aGlzKSlcblxuICAgICAgdGhpcy5mb3J3YXJkX3NraXBzID0gZXhpdHMuZmlsdGVyKGZ1bmN0aW9uKGV4aXQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByYW5rLmluZGV4T2YoZXhpdC5lbnRyeSkgPT0gLTEgJiYgZXhpdC5lbnRyeS50cnVlX3JhbmsgLSBybiA+IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChza2lwcy5iaW5kKG51bGwsIHRoaXMsICdmb3J3YXJkJykpXG5cbiAgICAgIHRoaXMuYmFja3dhcmRfc2tpcHMgPSBleGl0cy5maWx0ZXIoZnVuY3Rpb24oZXhpdCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJhbmsuaW5kZXhPZihleGl0LmVudHJ5KSA9PSAtMSAmJiBybiAtIGV4aXQuZW50cnkudHJ1ZV9yYW5rID49IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChza2lwcy5iaW5kKG51bGwsIHRoaXMsICdiYWNrd2FyZCcpKVxuXG4gICAgICB0aGlzLnBhdGhzX2NvdW50ID0gKGVudHJpZXMubGVuZ3RoICsgZXhpdHMubGVuZ3RoIC0gdGhpcy5zdGVwcy5sZW5ndGggKyAxKVxuICAgICAgdGhpcy5pbmRleCA9IHJuXG4gICAgfVxuICAsIGVkZ2VzOiBlbnNsYXZlKGdldF9lZGdlcylcbiAgLCBlZGdlc19jb21iaW5lZDogZW5zbGF2ZShnZXRfZWRnZXNfY29tYmluZWQpXG4gICwgZ2V0X3N0ZXBzOiBlbnNsYXZlKGdldF9zdGVwcylcblxuICB9KVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICB2YXIgViA9IHJlcXVpcmUoJy4uL3V0aWwvdmVjdG9ycy5qcycpXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzZWcxLCBzZWcyKXtcbiAgICB2YXIgcCA9IFtzZWcxLngxLCBzZWcxLnkxXVxuICAgIHZhciByID0gVi5zdWJ0cmFjdChbc2VnMS54Miwgc2VnMS55Ml0sIHApXG4gICAgdmFyIHEgPSBbc2VnMi54MSwgc2VnMi55MV1cbiAgICB2YXIgcyA9IFYuc3VidHJhY3QoW3NlZzIueDIsIHNlZzIueTJdLCBxKVxuXG4gICAgLy8gY29sbGluZWFyIG92ZXJsYXBwaW5nICAgICAgICAgICAgMVxuICAgIC8vIGNvbGxpbmVhciBkaXNqb2ludCAgICAgICAgICAgICAgIDJcbiAgICAvLyBwYXJhbGxlbCAgICAgICAgICAgICAgICAgICAgICAgICA0XG4gICAgLy8gaW50ZXJzZWN0aW5nICAgICAgICAgICAgICAgICAgICAgOFxuICAgIC8vIG5vbi1wYXJhbGxlbCBub24taW50ZXJzZWN0aW5nICAgMTZcbiAgICB2YXIgcmVzcG9uc2UgPSAwXG5cblxuICAgIHZhciByeHMgPSBWLmNyb3NzKHIsIHMpXG4gICAgdmFyIHFfcCA9IFYuc3VidHJhY3QocSxwKVxuICAgIHZhciBxX3B4ciA9IFYuY3Jvc3MocV9wLCByKVxuICAgIGlmICggcnhzID09IDAgKSB7XG4gICAgICBpZiAoIHFfcHhyICE9IDAgKSB7XG4gICAgICAgIHJldHVybiBbNF1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByciA9IFYuZG90KHIsIHIpXG4gICAgICAgIHZhciBxX3BkciA9IFYuZG90KHFfcCwgcilcbiAgICAgICAgdmFyIHNzID0gVi5kb3QocywgcylcbiAgICAgICAgdmFyIHFfcGRzID0gVi5kb3QocV9wLCBzKVxuICAgICAgICBpZiAoICggMCA8PSBxX3BkciAmJiAgcV9wZHIgPD0gcnIgKSB8fCAoIDAgPD0gcV9wZHMgJiYgcV9wZHMgPD0gc3MgKSApIHtcbiAgICAgICAgICByZXR1cm4gWzFdXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFsyXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHQgPSBWLmNyb3NzKHFfcCwgcykgLyByeHNcbiAgICBpZiAoIHQgPCAwIHx8IHQgPiAxICkgcmV0dXJuIFsxNl1cbiAgICB2YXIgdSA9IFYuY3Jvc3MocV9wLCByKSAvIHJ4c1xuICAgIGlmICggdSA8IDAgfHwgdSA+IDEgKSByZXR1cm4gWzE2XVxuXG4gICAgLy8gdmFyIHoxID0gVi5hZGQocCwgVi5zY2FsZShyLCB0KSlcbiAgICAvLyB2YXIgejIgPSBWLmFkZChxLCBWLnNjYWxlKHMsIHUpKVxuXG4gICAgcmV0dXJuIFs4LCBWLmFkZChwLCBWLnNjYWxlKHIsIHQpKV1cbiAgfVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuICB2YXIgdHJhbnNsYXRlID0gcmVxdWlyZSgnLi4vdXRpbC90cmFuc2xhdGUuanMnKVxudmFyIGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcblxuICBmdW5jdGlvbiBub2R1cHMociwgaSwgcnMpeyByZXR1cm4gcnMuaW5kZXhPZihyKSA9PT0gaSB9XG5cbiAgZnVuY3Rpb24gb3JpZW50YXRlKHJhbmtEaXIsIGEsIGIpe1xuICAgIHJldHVybiAocmFua0RpciA9PSAnVEInIHx8IHJhbmtEaXIgPT0gJ0JUJykgPyBhIDogYlxuICB9XG5cbiAgZnVuY3Rpb24gY2FsY3VsYXRlKHBvaW50KXtcblxuICAgIHZhciBpZHggPSBpbmRleChwb2ludCkgKyAxXG4gICAgdmFyIHJhbmtEaXIgPSBwb2ludC5yYW5rRGlyXG4gICAgdmFyIHJhbmtTZXAgPSBwb2ludC5yYW5rU2VwXG4gICAgdmFyIHJldmVyc2VkID0gcmFua0RpciA9PSAnQlQnIHx8IHJhbmtEaXIgPT0gJ1JMJ1xuICAgIHZhciB0ciA9IChyZXZlcnNlZCA/IC0xIDogMSkgKiBwc2VwKHBvaW50KSAqIGlkeFxuICAgIHZhciB0cl9zZXAgPSB0ciAtIChyZXZlcnNlZCA/IC0xICogcmFua1NlcCA6IHJhbmtTZXApXG5cbiAgICB2YXIgdmVjdG9yID0gIHBvaW50Lm5vZGVfcG9pbnQudHlwZSA9PSAnZXhpdCcgPyBvcmllbnRhdGUocmFua0RpciwgWzAsIHRyXSwgW3RyLCAwXSlcbiAgICAgICAgICAgICAgIDogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRlKHJhbmtEaXIsIFswLCB0cl9zZXAgXSwgW3RyX3NlcCwgMF0pXG5cbiAgICByZXR1cm4gdHJhbnNsYXRlKHZlY3RvciwgcG9pbnQubm9kZV9wb2ludC5zdGF0aWMoKSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF94KHBvaW50KXsgcmV0dXJuIGNhbGN1bGF0ZShwb2ludCkueCB9XG5cbiAgZnVuY3Rpb24gZ2V0X3kocG9pbnQpeyByZXR1cm4gY2FsY3VsYXRlKHBvaW50KS55IH1cblxuICBmdW5jdGlvbiBpbmRleChwb2ludCl7XG4gICAgdmFyIGwgPSBsaXN0KHBvaW50KVxuICAgIHZhciBxID0gcG9pbnQudHlwZSA9PSAnc3RlcCcgJiYgcG9pbnQubm9kZV9wb2ludC50eXBlID09ICdlbnRyeScgPyBwb2ludC5leGl0X2p1bmN0aW9uXG4gICAgICAgICAgOiBwb2ludFxuICAgIHZhciByID0gbC5pbmRleE9mKHEpXG4gICAgcmV0dXJuIHJcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYXAocG9pbnQpe1xuICAgIHJldHVybiBwb2ludC50eXBlID09ICdlbnRyeScgJiYgcG9pbnQuc2tpcERpciA9PSAnZm9yd2FyZCcgID8gcG9pbnQuZ2FwLmdldF9nYXBzKClbcG9pbnQubm9kZV9wb2ludC5ub2RlLnRydWVfcmFua11cbiAgICAgICAgIDogcG9pbnQudHlwZSA9PSAnZW50cnknICYmIHBvaW50LnNraXBEaXIgPT0gJ2JhY2t3YXJkJyA/IHBvaW50LmdhcC5nZXRfZ2FwcygpW3BvaW50Lm5vZGVfcG9pbnQubm9kZS50cnVlX3JhbmtdXG4gICAgICAgICA6IHBvaW50LmdhcFxuICB9XG5cblxuXG5cbiAgZnVuY3Rpb24gZ2l2ZV92YWx1ZShub2RlKXtcbiAgICByZXR1cm4gKG5vZGUudHJ1ZV9yYW5rICsgMSkgKiAobm9kZS54ICsgbm9kZS55KVxuICB9XG5cbiAgZnVuY3Rpb24gbGlzdChwb2ludCl7XG4gICAgdmFyIGduID0gcG9pbnQuZ2FwX251bWJlcigpXG4gICAgdmFyIGwgPSBwb2ludC5nYXAuZWRnZXMoKVxuICAgICAgICAgICAgICAgICAucmVkdWNlKGZ1bmN0aW9uIGp1bmNzKGpzLCBzKXtcbiAgICAgICAgICAgICAgICAgICAganMgPSBqcy5jb25jYXQocy5maWx0ZXIoZnVuY3Rpb24gaXNfanVuYyhwKXtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5pbml0ID09IEp1bmN0aW9uLmluaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgcC5nYXBfbnVtYmVyKCkgPT0gZ25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgISAocC50eXBlID09ICdzdGVwJyAmJiBwLm5vZGVfcG9pbnQudHlwZSA9PSAnZW50cnknKVxuICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGpzXG4gICAgICAgICAgICAgICAgICB9LCBbXSlcbiAgICAgICAgICAgICAgICAgLmZpbHRlcihub2R1cHMpXG4gICAgICAgICAgICAgICAgIC5zb3J0KGZ1bmN0aW9uKGEsIGIpeyByZXR1cm4gYS5vcmRlciA8IGIub3JkZXIgfSlcbiAgICByZXR1cm4gbFxuICB9XG5cbiAgZnVuY3Rpb24gcHNlcChwb2ludCl7XG4gICAgdmFyIGwgPSBsaXN0KHBvaW50KVxuXG4gICAgcmV0dXJuIHBvaW50LnJhbmtTZXAgLyAobC5sZW5ndGggKyAxKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlKHBvaW50KXtcbiAgICB2YXIgZ2FwID0gZ2V0X2dhcChwb2ludClcbiAgICByZXR1cm4gZ2FwLnN0ZXBzLnNwbGljZShpbmRleChwb2ludCksIDEpXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ2FwX251bWJlcihwb2ludCl7XG4gICAgcmV0dXJuIGdldF9nYXAocG9pbnQpLmluZGV4XG4gIH1cblxuICB2YXIgSnVuY3Rpb24gPSAgdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbih0eXBlLCBub2RlX3BvaW50LCBzaSwgZ2FwLCByYW5rRGlyLCByYW5rU2VwLCBza2lwRGlyLCBleGl0X2p1bmN0aW9uKXtcbiAgICAgIHRoaXMudHlwZSA9IHR5cGVcbiAgICAgIHRoaXMubm9kZV9wb2ludCA9IG5vZGVfcG9pbnRcbiAgICAgIHRoaXMuZXhpdF9wb2ludCA9IG5vZGVfcG9pbnQudHlwZSA9PSAnZXhpdCcgPyBub2RlX3BvaW50IDogbm9kZV9wb2ludC5vdGhlcl9lbmRwb2ludCgpXG4gICAgICB0aGlzLmVudHJ5X3BvaW50ID0gbm9kZV9wb2ludC50eXBlID09ICdlbnRyeScgPyBub2RlX3BvaW50IDogbm9kZV9wb2ludC5vdGhlcl9lbmRwb2ludCgpXG4gICAgICB0aGlzLnNpID0gc2lcbiAgICAgIHRoaXMuZ2FwID0gZ2FwXG4gICAgICB0aGlzLnJhbmtEaXIgPSByYW5rRGlyXG4gICAgICB0aGlzLnJhbmtTZXAgPSByYW5rU2VwXG4gICAgICB0aGlzLnNraXBEaXIgPSBza2lwRGlyXG4gICAgICB0aGlzLmlkID0gdWlkKClcbiAgICAgIHRoaXMuZ3JhcGggPSBub2RlX3BvaW50Lm5vZGUuZ3JhcGhcbiAgICAgIHRoaXMuZWRnZV9pZCA9IHRoaXMuZ3JhcGguaW5jaWRlbnRFZGdlcyh0aGlzLmV4aXRfcG9pbnQubm9kZS5pZCwgdGhpcy5lbnRyeV9wb2ludC5ub2RlLmlkKVswXVxuICAgICAgdGhpcy5vcmRlciA9IHRoaXMuZ3JhcGguZWRnZXMoKS5pbmRleE9mKHRoaXMuZWRnZV9pZClcbiAgICAgIHRoaXMuZXhpdF9qdW5jdGlvbiA9IGV4aXRfanVuY3Rpb25cbiAgICB9XG4gICwgeDogZW5zbGF2ZShnZXRfeClcbiAgLCB5OiBlbnNsYXZlKGdldF95KVxuICAsIHN0YXRpYzogZW5zbGF2ZShjYWxjdWxhdGUpXG4gICwgcmVtb3ZlOiBlbnNsYXZlKHJlbW92ZSlcbiAgLCBnYXBfbnVtYmVyOiBlbnNsYXZlKGdldF9nYXBfbnVtYmVyKVxuICB9KVxuXG4gIG1vZHVsZS5leHBvcnRzID0gSnVuY3Rpb25cblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciB2aXJhbCA9IHJlcXVpcmUoJ3ZpcmFsJylcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIHRyYW5zbGF0ZSA9IHJlcXVpcmUoJy4uL3V0aWwvdHJhbnNsYXRlLmpzJylcblxuICBmdW5jdGlvbiBzaWRlX2Zyb21fZGlyZWN0aW9uKG5vZGUsIGQpe1xuICAgIHZhciB3ICA9IG5vZGUud2lkdGggLyAyXG4gICAgdmFyIGggID0gbm9kZS5oZWlnaHQgLyAyXG4gICAgdmFyIHRsID0gdHJhbnNsYXRlKFstdywgLWhdLCBub2RlKVxuICAgIHZhciB0ciA9IHRyYW5zbGF0ZShbIHcsIC1oXSwgbm9kZSlcbiAgICB2YXIgYmwgPSB0cmFuc2xhdGUoWy13LCAgaF0sIG5vZGUpXG4gICAgdmFyIGJyID0gdHJhbnNsYXRlKFsgdywgIGhdLCBub2RlKVxuICAgIHN3aXRjaCAoIGQgKSB7XG4gICAgICBjYXNlICdMJyA6XG4gICAgICAgIHJldHVybiBbdGwsIGJsXVxuICAgICAgY2FzZSAnUicgOlxuICAgICAgICByZXR1cm4gW3RyLCBicl1cbiAgICAgIGNhc2UgJ0InIDpcbiAgICAgICAgcmV0dXJuIFtibCwgYnJdXG4gICAgICBjYXNlICdUJyA6XG4gICAgICAgIHJldHVybiBbdGwsIHRyXVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRpdmlkZV9zaWRlKHNpZGUsIHBhcnRzLCBuKXtcbiAgICBuID0gbiArIDFcbiAgICB2YXIgWDEgPSBzaWRlWzBdLnhcbiAgICB2YXIgWTEgPSBzaWRlWzBdLnlcbiAgICB2YXIgWDIgPSBzaWRlWzFdLnhcbiAgICB2YXIgWTIgPSBzaWRlWzFdLnlcblxuICAgIHZhciBXID0gWDIgLSBYMVxuICAgIHZhciBIID0gWTIgLSBZMVxuICAgIHZhciBydyA9IFcgLyAocGFydHMgKyAxKVxuICAgIHZhciByaCA9IEggLyAocGFydHMgKyAxKVxuICAgIHJldHVybiB0cmFuc2xhdGUoWyBuICogcncsIG4gKiByaCBdLCBzaWRlWzBdKVxuICB9XG5cbiAgZnVuY3Rpb24gY2FsY3VsYXRlKHBvaW50KXtcbiAgICByZXR1cm4gZGl2aWRlX3NpZGUoXG4gICAgICAgICAgICBzaWRlX2Zyb21fZGlyZWN0aW9uKHBvaW50Lm5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgcG9pbnQucmFua0Rpcltwb2ludC50eXBlID09ICdleGl0JyA/IDEgOiAwXSlcbiAgICAgICAgICAsIGxpc3QocG9pbnQpLmxlbmd0aFxuICAgICAgICAgICwgaW5kZXgocG9pbnQpKVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3gocG9pbnQpeyByZXR1cm4gY2FsY3VsYXRlKHBvaW50KS54IH1cblxuICBmdW5jdGlvbiBnZXRfeShwb2ludCl7IHJldHVybiBjYWxjdWxhdGUocG9pbnQpLnkgfVxuXG4gIGZ1bmN0aW9uIGluZGV4KHBvaW50KXtcbiAgICByZXR1cm4gbGlzdChwb2ludCkuaW5kZXhPZihwb2ludClcbiAgfVxuXG4gIGZ1bmN0aW9uIGxpc3QocG9pbnQpe1xuICAgIHJldHVybiBwb2ludC50eXBlID09ICdleGl0JyA/IHBvaW50Lm5vZGUuZXhpdF9wb2ludHMgOiBwb2ludC5ub2RlLmVudHJ5X3BvaW50c1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlKHBvaW50KXtcbiAgICByZXR1cm4gbGlzdChwb2ludCkuc3BsaWNlKGluZGV4KHBvaW50KSwgMSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYXBfbnVtYmVyKHBvaW50KXtcbiAgICByZXR1cm4gcG9pbnQubm9kZS50cnVlX3JhbmsgKyAocG9pbnQudHlwZSA9PSAnZW50cnknID8gMCA6IDEpXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfb3RoZXJfZW5kKHBvaW50KXtcbiAgICB2YXIgcGFpcl9ub2RlID0gcG9pbnQucGFpcl9ub2RlXG4gICAgdmFyIHBwdCA9IHBvaW50LnR5cGUgPT0gJ2VudHJ5JyA/ICdleGl0X3BvaW50cycgOiAnZW50cnlfcG9pbnRzJ1xuICAgIHZhciBwbnQgPSBwb2ludC50eXBlID09ICdlbnRyeScgPyAnZXhpdHMnIDogJ2VudHJpZXMnXG4gICAgdmFyIHBhaXJfcG9pbnQgPSBwYWlyX25vZGVbcHB0XVtwYWlyX25vZGVbcG50XVtwb2ludC5ub2RlLmlkXV1cbiAgICByZXR1cm4gcGFpcl9wb2ludFxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB2aXJhbC5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKHR5cGUsIG5vZGUsIHJhbmtEaXIsIHBhaXJfbm9kZSl7XG4gICAgICB0aGlzLnR5cGUgPSB0eXBlXG4gICAgICB0aGlzLm5vZGUgPSBub2RlXG4gICAgICB0aGlzLnBhaXJfbm9kZSA9IHBhaXJfbm9kZVxuICAgICAgdGhpcy5leGl0ID0gdHlwZSA9PSAnZXhpdCcgPyBub2RlIDogcGFpcl9ub2RlXG4gICAgICB0aGlzLnJhbmtEaXIgPSByYW5rRGlyXG4gICAgICB0aGlzLmVudHJ5ID0gdHlwZSA9PSAnZW50cnknID8gbm9kZSA6IHBhaXJfbm9kZVxuICAgICAgdGhpcy5lZGdlX2lkID0gbm9kZS5ncmFwaC5pbmNpZGVudEVkZ2VzKG5vZGUuaWQsIHBhaXJfbm9kZS5pZClcbiAgICB9XG4gICwgeDogZW5zbGF2ZShnZXRfeClcbiAgLCB5OiBlbnNsYXZlKGdldF95KVxuICAsIHN0YXRpYzogZW5zbGF2ZShjYWxjdWxhdGUpXG4gICwgcmVtb3ZlOiBlbnNsYXZlKHJlbW92ZSlcbiAgLCBnYXBfbnVtYmVyOiBlbnNsYXZlKGdldF9nYXBfbnVtYmVyKVxuICAsIG90aGVyX2VuZHBvaW50OiBlbnNsYXZlKGdldF9vdGhlcl9lbmQpXG4gIH0pXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciB0cmFuc2xhdGUgPSByZXF1aXJlKCcuLi91dGlsL3RyYW5zbGF0ZS5qcycpXG5cbiAgdmFyIGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcblxuICBmdW5jdGlvbiBvcmllbnRhdGUocmFua0RpciwgYSwgYil7XG4gICAgcmV0dXJuIChyYW5rRGlyID09ICdUQicgfHwgcmFua0RpciA9PSAnQlQnKSA/IGEgOiBiXG4gIH1cblxuICBmdW5jdGlvbiBjYWxjdWxhdGUocG9pbnQpe1xuICAgIHZhciBzX2xlbmd0aCA9IHBvaW50LmdhcC5nZXRfZ2FwcygpLnNsaWNlKDAsIGluZGV4KHBvaW50KSkucmVkdWNlKGZ1bmN0aW9uKHRzYywgcil7XG4gICAgICByZXR1cm4gdHNjICsgKHBvaW50LnR5cGUgPT0gJ2ZvcndhcmQnID8gci5mb3J3YXJkX3NraXBzIDogci5iYWNrd2FyZF9za2lwcykubGVuZ3RoXG4gICAgfSwgMSlcblxuICAgIHZhciBsZXZlbF9hbW91bnQgPSAoc19sZW5ndGggKyBwb2ludC5zaWR4KSAqIHBvaW50LnNraXBzZXBcbiAgICB2YXIgbGV2ZWwgPSBwb2ludC5yZXYgPyAwIC0gbGV2ZWxfYW1vdW50IDogcG9pbnQuZ1twb2ludC5sZXZlbF9kaXJdICsgbGV2ZWxfYW1vdW50XG5cbiAgICByZXR1cm4ge1xuICAgICAgeDogb3JpZW50YXRlKHBvaW50LnJhbmtEaXIsIGxldmVsLCBwb2ludC5yZWxhdGl2ZVtwb2ludC5yYW5rX2F0dHJdKCkpXG4gICAgLCB5OiBvcmllbnRhdGUocG9pbnQucmFua0RpciwgcG9pbnQucmVsYXRpdmVbcG9pbnQucmFua19hdHRyXSgpLCBsZXZlbClcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRfeChwb2ludCl7IHJldHVybiBjYWxjdWxhdGUocG9pbnQpLnggfVxuXG4gIGZ1bmN0aW9uIGdldF95KHBvaW50KXsgcmV0dXJuIGNhbGN1bGF0ZShwb2ludCkueSB9XG5cbiAgZnVuY3Rpb24gaW5kZXgocG9pbnQpeyByZXR1cm4gcG9pbnQuZ2FwLmdldF9nYXBzKCkuaW5kZXhPZihwb2ludC5nYXApIH1cblxuICBmdW5jdGlvbiBnZXRfZ2FwX251bWJlcihwb2ludCl7XG4gICAgcmV0dXJuIHBvaW50LnJlbGF0aXZlLmdhcF9udW1iZXIoKVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB2aXJhbC5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKHR5cGUsIHJlbGF0aXZlLCBnYXAsIHNpZHgsIHJhbmtEaXIsIHNraXBzZXAsIHJldiwgZywgcmFua19hdHRyLCBsZXZlbF9kaXIpe1xuICAgICAgdGhpcy50eXBlID0gdHlwZVxuICAgICAgdGhpcy5yZWxhdGl2ZSA9IHJlbGF0aXZlXG4gICAgICB0aGlzLmdhcCA9IGdhcFxuICAgICAgdGhpcy5zaWR4ID0gc2lkeFxuICAgICAgdGhpcy5yYW5rRGlyID0gcmFua0RpclxuICAgICAgdGhpcy5za2lwc2VwID0gc2tpcHNlcFxuICAgICAgdGhpcy5yZXYgPSByZXZcbiAgICAgIHRoaXMuZyA9IGdcbiAgICAgIHRoaXMucmFua19hdHRyID0gcmFua19hdHRyXG4gICAgICB0aGlzLmxldmVsX2RpciA9IGxldmVsX2RpclxuICAgIH1cbiAgLCB4OiBlbnNsYXZlKGdldF94KVxuICAsIHk6IGVuc2xhdmUoZ2V0X3kpXG4gICwgc3RhdGljOiBlbnNsYXZlKGNhbGN1bGF0ZSlcbiAgLCBnYXBfbnVtYmVyOiBlbnNsYXZlKGdldF9nYXBfbnVtYmVyKVxuICB9KVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIE5vZGUgPSByZXF1aXJlKCcuL25vZGUuanMnKVxuICB2YXIgdWlkID0gcmVxdWlyZSgnLi4vdXRpbC91bmlxdWVfaWQuanMnKVxuXG4gIC8vIFRPRE86IG1ha2UgdGhpcyAxIHRvIDEgZm9yIGEgZGlzcGxheWVkIHBhcnQgb2YgdGhlIHBhdGggc2ltaWxhcmx5IGhvdyBub2RlcyBhcmVcbiAgdmFyIEVkZ2UgPSBOb2RlLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oZ3JhcGgsIHNvdXJjZSwgdGFyZ2V0LCB0cmFuc2Zvcm0sIGF0dHJzKXtcbiAgICAgIHRoaXMuaWQgPSB1aWQoKVxuICAgICAgdGhpcy50eXBlID0gJ2VkZ2UnXG4gICAgICB0aGlzLmdyYXBoID0gZ3JhcGhcbiAgICAgIHRoaXMuc291cmNlID0gc291cmNlXG4gICAgICB0aGlzLnRhcmdldCA9IHRhcmdldFxuICAgIH1cbiAgfSlcblxuICBtb2R1bGUuZXhwb3J0cyA9IEVkZ2Vcbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciBkYWdyZSA9IHJlcXVpcmUoJ2RhZ3JlJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIE5vZGUgPSByZXF1aXJlKCcuL25vZGUuanMnKVxuICB2YXIgRWRnZSA9IHJlcXVpcmUoJy4vZWRnZS5qcycpXG5cbiAgZnVuY3Rpb24gYWRkX25vZGUoZ3JhcGgsIGNsYXNzbmFtZSwgdHJhbnNmb3JtLCBjb250ZW50LCBwcmVmUmFuayl7XG4gICAgdmFyIG5vZGUgPSBOb2RlLm1ha2UoZ3JhcGgsIHRyYW5zZm9ybSwge1xuICAgICAgICBjbGFzc25hbWU6IGNsYXNzbmFtZVxuICAgICAgLCBjb250ZW50OiBjb250ZW50XG4gICAgICAsIHJhbms6IHByZWZSYW5rXG4gICAgfSlcbiAgICBncmFwaC5hZGROb2RlKG5vZGUuaWQsIG5vZGUpXG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZV9ub2RlKGdyYXBoLCBub2RlX2lkKXtcbiAgICBpZiAoIGdyYXBoLmhhc05vZGUobm9kZV9pZCkgKSB7XG4gICAgICBncmFwaC5kZWxOb2RlKG5vZGVfaWQpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbm5lY3QoZ3JhcGgsIGNsYXNzbmFtZSwgc291cmNlLCB0YXJnZXQsIHRyYW5zZm9ybSwgY29udGVudCl7XG4gICAgdmFyIGVkZ2UgPSBFZGdlLm1ha2UoZ3JhcGgsIHNvdXJjZSwgdGFyZ2V0KVxuICAgIGdyYXBoLmFkZEVkZ2UoZWRnZS5pZCwgc291cmNlLmlkLCB0YXJnZXQuaWQsIGVkZ2UpXG4gICAgcmV0dXJuIGVkZ2VcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc2Nvbm5lY3QoZ3JhcGgsIHNvdXJjZSwgdGFyZ2V0KXtcbiAgICB2YXIgZWRnZV9pZCA9IGdyYXBoLm91dEVkZ2VzKHNvdXJjZS5pZCwgdGFyZ2V0LmlkKVxuICAgIGlmICggZ3JhcGguaGFzRWRnZShlZGdlX2lkKSApIHtcbiAgICAgIGdyYXBoLmRlbEVkZ2UoZWRnZV9pZClcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIHZhciBlbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9lbWl0dGVyLmpzJylcbiAgdmFyIGdyYXBoID0gZW1pdHRlci5leHRlbmQoZGFncmUuRGlncmFwaC5wcm90b3R5cGUpXG4gICAgICAgICAgICAgICAgICAgICAuZXh0ZW5kKHsgaW5pdDogZnVuY3Rpb24oKXsgZGFncmUuRGlncmFwaC5jYWxsKHRoaXMpIH0gfSlcblxuICBtb2R1bGUuZXhwb3J0cyA9IGdyYXBoLmV4dGVuZCh7XG4gICAgYWRkX25vZGU6IGVuc2xhdmUoYWRkX25vZGUpXG4gICwgZGVsX25vZGU6IGVuc2xhdmUocmVtb3ZlX25vZGUpXG4gICwgY29ubmVjdDogZW5zbGF2ZShjb25uZWN0KVxuICAsIGRpc2Nvbm5lY3Q6IGVuc2xhdmUoZGlzY29ubmVjdClcbiAgfSlcblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciB2aXJhbCA9IHJlcXVpcmUoJ3ZpcmFsJylcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcblxuICBmdW5jdGlvbiBzZXRfYXR0cnMobm9kZSwgYXR0cnMpe1xuICAgIE9iamVjdC5rZXlzKGF0dHJzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICBub2RlW2tleV0gPSBhdHRyc1trZXldXG4gICAgfSlcbiAgICBub2RlLmdyYXBoLmVtaXQobm9kZS50eXBlICsgJ19hdHRycycsIGF0dHJzKVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X2F0dHIobm9kZSwgYXR0ciwgdmFsdWUpe1xuICAgIG5vZGVbYXR0cl0gPSB2YWx1ZVxuICAgIG5vZGUuZ3JhcGguZW1pdChub2RlLnR5cGUgKyAnX2F0dHInLCBhdHRyLCB2YWx1ZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZF9hdHRyKG5vZGUsIHNlbGVjdG9yLCBuYW1lLCB2YWx1ZSl7XG4gICAgbm9kZS5jb250ZW50W3NlbGVjdG9yXSA9IG5vZGUuY29udGVudFtzZWxlY3Rvcl0gfHwge31cbiAgICBub2RlLmNvbnRlbnRbc2VsZWN0b3JdW25hbWVdID0gdmFsdWVcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZF9hdHRycyhub2RlLCBzZWxlY3RvciwgYXR0cnMpe1xuICAgIG5vZGUuY29udGVudFtzZWxlY3Rvcl0gPSB2YWx1ZVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB2aXJhbC5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGdyYXBoLCB0cmFuc2Zvcm0sIGF0dHJzKXtcbiAgICAgIHRoaXMuaWQgPSB1aWQoKVxuICAgICAgdGhpcy50eXBlID0gJ3ZlcnRleCdcbiAgICAgIHRoaXMuZ3JhcGggPSBncmFwaFxuICAgICAgdGhpcy50cmFuc2Zvcm0gPSB0cmFuc2Zvcm0uYmluZChudWxsLCB0aGlzKVxuICAgICAgc2V0X2F0dHJzKHRoaXMsIGF0dHJzKVxuICAgIH1cbiAgLCBhdHRyczogZW5zbGF2ZShzZXRfYXR0cnMpXG4gICwgYXR0cjogZW5zbGF2ZShzZXRfYXR0cilcbiAgLCBhZGRfYXR0cjogZW5zbGF2ZShhZGRfYXR0cilcbiAgLCBhZGRfYXR0cnM6IGVuc2xhdmUoYWRkX2F0dHJzKVxuICB9KVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICBpZiAoIVN0cmluZy5wcm90b3R5cGUudHJpbSkge1xuICAgIFN0cmluZy5wcm90b3R5cGUudHJpbSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxuICAgIH1cbiAgfVxuXG4gIHZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vdXRpbC9kZWZhdWx0cy5qcycpXG4gIHZhciBHcmFwaCA9IHJlcXVpcmUoJy4vZ3JhcGgvZ3JhcGguanMnKVxuICB2YXIgRGlhZ3JhbSA9IHJlcXVpcmUoJy4vZGlhZ3JhbS9kaWFncmFtLmpzJylcblxuXG4gIC8qKlxuICAqIFNldCBkZWZhdWx0IGNvbmZpZ3VyYXRpb25cbiAgKiBAcGFyYW0gICAgICB7T2JqZWN0fSBvcHRpb25zXG4gICogQHJldHVybiAgICAge09iamVjdH0gb3B0aW9ucyBmaWxsZWQgd2l0aCBkZWZhdWx0c1xuICAqL1xuICBmdW5jdGlvbiBjb25maWcoY2Znb2JqKXtcbiAgICB2YXIgZGVmYXVsdF9jZmcgPSB7XG4gICAgICB3aWR0aDogd2luZG93LmlubmVyV2lkdGhcbiAgICAsIGhlaWdodDogd2luZG93LmlubmVySGVpZ2h0XG4gICAgLCBmb250X3NpemU6IDIxXG4gICAgLCBsaW5lX2hlaWdodDogMjYgLy8gZm9yIGZvbnQtc2l6ZSAyMVxuICAgIH1cbiAgICByZXR1cm4gY2Znb2JqID09IG51bGwgPyBkZWZhdWx0X2NmZ1xuICAgICAgICAgOiAgICAgICAgICAgICAgICAgIGRlZmF1bHRzKGNmZ29iaiwgZGVmYXVsdF9jZmcpXG4gIH1cblxuICAvKipcbiAgKiBDcmVhdGUgYSBuZXcgZ3JhcGggb2JqZWN0IHRvIHN0b3JlIGRpYWdyYW0gZGF0YSBpbiBpdFxuICAqIEByZXR1cm4gICAgIHtPYmplY3R9ICAgZ3JhcGggb2JqZWN0XG4gICovXG4gIGZ1bmN0aW9uIGdyYXBoKGNmZ29iail7XG4gICAgcmV0dXJuIEdyYXBoLm1ha2UoY2Znb2JqKVxuICB9XG5cbiAgLyoqXG4gICogSW5pdGlhbGl6ZSBkaWFncmFtIHdpdGggb3B0aW9ucyBhbmQgZ3JhcGggb2JqZWN0XG4gICogYW5kIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXG4gICogQHBhcmFtICAgICAge09iamVjdH0gICBvcHRpb25zXG4gICogQHBhcmFtICAgICAge09iamVjdH0gICBncmFwaCBvYmplY3RcbiAgKiBAcmV0dXJuICAgICB7T2JqZWN0fSAgIGRpYWdyYW1cbiAgKi9cbiAgZnVuY3Rpb24gZGlhZ3JhbShjZmdvYmosIGdyYXBoKXtcbiAgICByZXR1cm4gRGlhZ3JhbS5tYWtlKGNmZ29iaiwgZ3JhcGgpXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBjb25maWc6IGNvbmZpZ1xuICAsIGdyYXBoOiBncmFwaFxuICAsIGRpYWdyYW06IGRpYWdyYW1cbiAgfVxuICBpZiAoIHdpbmRvdyApIHdpbmRvdy5EaWFncmFtID0gbW9kdWxlLmV4cG9ydHNcblxufSgpXG4iLCIvKlxuQ29weXJpZ2h0IChjKSAyMDEyLTIwMTMgQ2hyaXMgUGV0dGl0dFxuXG5QZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG5vZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG5pbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG50byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG5jb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbmZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG5cblRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG5hbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cblxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG5GSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbkFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbkxJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG5PVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG5USEUgU09GVFdBUkUuXG4qL1xuZXhwb3J0cy5EaWdyYXBoID0gcmVxdWlyZShcImdyYXBobGliXCIpLkRpZ3JhcGg7XG5leHBvcnRzLkdyYXBoID0gcmVxdWlyZShcImdyYXBobGliXCIpLkdyYXBoO1xuZXhwb3J0cy5sYXlvdXQgPSByZXF1aXJlKFwiLi9saWIvbGF5b3V0XCIpO1xuZXhwb3J0cy52ZXJzaW9uID0gcmVxdWlyZShcIi4vbGliL3ZlcnNpb25cIik7XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIHJhbmsgPSByZXF1aXJlKCcuL3JhbmsnKSxcbiAgICBvcmRlciA9IHJlcXVpcmUoJy4vb3JkZXInKSxcbiAgICBDR3JhcGggPSByZXF1aXJlKCdncmFwaGxpYicpLkNHcmFwaCxcbiAgICBDRGlncmFwaCA9IHJlcXVpcmUoJ2dyYXBobGliJykuQ0RpZ3JhcGg7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIC8vIEV4dGVybmFsIGNvbmZpZ3VyYXRpb25cbiAgdmFyIGNvbmZpZyA9IHtcbiAgICAvLyBIb3cgbXVjaCBkZWJ1ZyBpbmZvcm1hdGlvbiB0byBpbmNsdWRlP1xuICAgIGRlYnVnTGV2ZWw6IDAsXG4gICAgLy8gTWF4IG51bWJlciBvZiBzd2VlcHMgdG8gcGVyZm9ybSBpbiBvcmRlciBwaGFzZVxuICAgIG9yZGVyTWF4U3dlZXBzOiBvcmRlci5ERUZBVUxUX01BWF9TV0VFUFMsXG4gICAgLy8gVXNlIG5ldHdvcmsgc2ltcGxleCBhbGdvcml0aG0gaW4gcmFua2luZ1xuICAgIHJhbmtTaW1wbGV4OiBmYWxzZSxcbiAgICAvLyBSYW5rIGRpcmVjdGlvbi4gVmFsaWQgdmFsdWVzIGFyZSAoVEIsIExSKVxuICAgIHJhbmtEaXI6ICdUQidcbiAgfTtcblxuICAvLyBQaGFzZSBmdW5jdGlvbnNcbiAgdmFyIHBvc2l0aW9uID0gcmVxdWlyZSgnLi9wb3NpdGlvbicpKCk7XG5cbiAgLy8gVGhpcyBsYXlvdXQgb2JqZWN0XG4gIHZhciBzZWxmID0ge307XG5cbiAgc2VsZi5vcmRlckl0ZXJzID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ29yZGVyTWF4U3dlZXBzJyk7XG5cbiAgc2VsZi5yYW5rU2ltcGxleCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdyYW5rU2ltcGxleCcpO1xuXG4gIHNlbGYubm9kZVNlcCA9IGRlbGVnYXRlUHJvcGVydHkocG9zaXRpb24ubm9kZVNlcCk7XG4gIHNlbGYuZWRnZVNlcCA9IGRlbGVnYXRlUHJvcGVydHkocG9zaXRpb24uZWRnZVNlcCk7XG4gIHNlbGYudW5pdmVyc2FsU2VwID0gZGVsZWdhdGVQcm9wZXJ0eShwb3NpdGlvbi51bml2ZXJzYWxTZXApO1xuICBzZWxmLnJhbmtTZXAgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLnJhbmtTZXApO1xuICBzZWxmLnJhbmtEaXIgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAncmFua0RpcicpO1xuICBzZWxmLmRlYnVnQWxpZ25tZW50ID0gZGVsZWdhdGVQcm9wZXJ0eShwb3NpdGlvbi5kZWJ1Z0FsaWdubWVudCk7XG5cbiAgc2VsZi5kZWJ1Z0xldmVsID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ2RlYnVnTGV2ZWwnLCBmdW5jdGlvbih4KSB7XG4gICAgdXRpbC5sb2cubGV2ZWwgPSB4O1xuICAgIHBvc2l0aW9uLmRlYnVnTGV2ZWwoeCk7XG4gIH0pO1xuXG4gIHNlbGYucnVuID0gdXRpbC50aW1lKCdUb3RhbCBsYXlvdXQnLCBydW4pO1xuXG4gIHNlbGYuX25vcm1hbGl6ZSA9IG5vcm1hbGl6ZTtcblxuICByZXR1cm4gc2VsZjtcblxuICAvKlxuICAgKiBDb25zdHJ1Y3RzIGFuIGFkamFjZW5jeSBncmFwaCB1c2luZyB0aGUgbm9kZXMgYW5kIGVkZ2VzIHNwZWNpZmllZCB0aHJvdWdoXG4gICAqIGNvbmZpZy4gRm9yIGVhY2ggbm9kZSBhbmQgZWRnZSB3ZSBhZGQgYSBwcm9wZXJ0eSBgZGFncmVgIHRoYXQgY29udGFpbnMgYW5cbiAgICogb2JqZWN0IHRoYXQgd2lsbCBob2xkIGludGVybWVkaWF0ZSBhbmQgZmluYWwgbGF5b3V0IGluZm9ybWF0aW9uLiBTb21lIG9mXG4gICAqIHRoZSBjb250ZW50cyBpbmNsdWRlOlxuICAgKlxuICAgKiAgMSkgQSBnZW5lcmF0ZWQgSUQgdGhhdCB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSBvYmplY3QuXG4gICAqICAyKSBEaW1lbnNpb24gaW5mb3JtYXRpb24gZm9yIG5vZGVzIChjb3BpZWQgZnJvbSB0aGUgc291cmNlIG5vZGUpLlxuICAgKiAgMykgT3B0aW9uYWwgZGltZW5zaW9uIGluZm9ybWF0aW9uIGZvciBlZGdlcy5cbiAgICpcbiAgICogQWZ0ZXIgdGhlIGFkamFjZW5jeSBncmFwaCBpcyBjb25zdHJ1Y3RlZCB0aGUgY29kZSBubyBsb25nZXIgbmVlZHMgdG8gdXNlXG4gICAqIHRoZSBvcmlnaW5hbCBub2RlcyBhbmQgZWRnZXMgcGFzc2VkIGluIHZpYSBjb25maWcuXG4gICAqL1xuICBmdW5jdGlvbiBpbml0TGF5b3V0R3JhcGgoaW5wdXRHcmFwaCkge1xuICAgIHZhciBnID0gbmV3IENEaWdyYXBoKCk7XG5cbiAgICBpbnB1dEdyYXBoLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgdmFsdWUgPSB7fTtcbiAgICAgIGcuYWRkTm9kZSh1LCB7XG4gICAgICAgIHdpZHRoOiB2YWx1ZS53aWR0aCxcbiAgICAgICAgaGVpZ2h0OiB2YWx1ZS5oZWlnaHRcbiAgICAgIH0pO1xuICAgICAgaWYgKHZhbHVlLmhhc093blByb3BlcnR5KCdyYW5rJykpIHtcbiAgICAgICAgZy5ub2RlKHUpLnByZWZSYW5rID0gdmFsdWUucmFuaztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFNldCB1cCBzdWJncmFwaHNcbiAgICBpZiAoaW5wdXRHcmFwaC5wYXJlbnQpIHtcbiAgICAgIGlucHV0R3JhcGgubm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgICAgZy5wYXJlbnQodSwgaW5wdXRHcmFwaC5wYXJlbnQodSkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaW5wdXRHcmFwaC5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHZhbHVlID0ge307XG4gICAgICB2YXIgbmV3VmFsdWUgPSB7XG4gICAgICAgIGU6IGUsXG4gICAgICAgIG1pbkxlbjogdmFsdWUubWluTGVuIHx8IDEsXG4gICAgICAgIHdpZHRoOiB2YWx1ZS53aWR0aCB8fCAwLFxuICAgICAgICBoZWlnaHQ6IHZhbHVlLmhlaWdodCB8fCAwLFxuICAgICAgICBwb2ludHM6IFtdXG4gICAgICB9O1xuXG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdiwgbmV3VmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gSW5pdGlhbCBncmFwaCBhdHRyaWJ1dGVzXG4gICAgdmFyIGdyYXBoVmFsdWUgPSBpbnB1dEdyYXBoLmdyYXBoKCkgfHwge307XG4gICAgZy5ncmFwaCh7XG4gICAgICByYW5rRGlyOiBncmFwaFZhbHVlLnJhbmtEaXIgfHwgY29uZmlnLnJhbmtEaXIsXG4gICAgICBvcmRlclJlc3RhcnRzOiBncmFwaFZhbHVlLm9yZGVyUmVzdGFydHNcbiAgICB9KTtcblxuICAgIHJldHVybiBnO1xuICB9XG5cbiAgZnVuY3Rpb24gcnVuKGlucHV0R3JhcGgpIHtcbiAgICB2YXIgcmFua1NlcCA9IHNlbGYucmFua1NlcCgpO1xuICAgIHZhciBnO1xuICAgIHRyeSB7XG4gICAgICAvLyBCdWlsZCBpbnRlcm5hbCBncmFwaFxuICAgICAgZyA9IHV0aWwudGltZSgnaW5pdExheW91dEdyYXBoJywgaW5pdExheW91dEdyYXBoKShpbnB1dEdyYXBoKTtcblxuICAgICAgaWYgKGcub3JkZXIoKSA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZztcbiAgICAgIH1cblxuICAgICAgLy8gTWFrZSBzcGFjZSBmb3IgZWRnZSBsYWJlbHNcbiAgICAgIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgcywgdCwgYSkge1xuICAgICAgICBhLm1pbkxlbiAqPSAyO1xuICAgICAgfSk7XG4gICAgICBzZWxmLnJhbmtTZXAocmFua1NlcCAvIDIpO1xuXG4gICAgICAvLyBEZXRlcm1pbmUgdGhlIHJhbmsgZm9yIGVhY2ggbm9kZS4gTm9kZXMgd2l0aCBhIGxvd2VyIHJhbmsgd2lsbCBhcHBlYXJcbiAgICAgIC8vIGFib3ZlIG5vZGVzIG9mIGhpZ2hlciByYW5rLlxuICAgICAgdXRpbC50aW1lKCdyYW5rLnJ1bicsIHJhbmsucnVuKShnLCBjb25maWcucmFua1NpbXBsZXgpO1xuXG4gICAgICAvLyBOb3JtYWxpemUgdGhlIGdyYXBoIGJ5IGVuc3VyaW5nIHRoYXQgZXZlcnkgZWRnZSBpcyBwcm9wZXIgKGVhY2ggZWRnZSBoYXNcbiAgICAgIC8vIGEgbGVuZ3RoIG9mIDEpLiBXZSBhY2hpZXZlIHRoaXMgYnkgYWRkaW5nIGR1bW15IG5vZGVzIHRvIGxvbmcgZWRnZXMsXG4gICAgICAvLyB0aHVzIHNob3J0ZW5pbmcgdGhlbS5cbiAgICAgIHV0aWwudGltZSgnbm9ybWFsaXplJywgbm9ybWFsaXplKShnKTtcblxuICAgICAgLy8gT3JkZXIgdGhlIG5vZGVzIHNvIHRoYXQgZWRnZSBjcm9zc2luZ3MgYXJlIG1pbmltaXplZC5cbiAgICAgIHV0aWwudGltZSgnb3JkZXInLCBvcmRlcikoZywgY29uZmlnLm9yZGVyTWF4U3dlZXBzKTtcblxuICAgICAgLy8gRmluZCB0aGUgeCBhbmQgeSBjb29yZGluYXRlcyBmb3IgZXZlcnkgbm9kZSBpbiB0aGUgZ3JhcGguXG4gICAgICB1dGlsLnRpbWUoJ3Bvc2l0aW9uJywgcG9zaXRpb24ucnVuKShnKTtcblxuICAgICAgLy8gRGUtbm9ybWFsaXplIHRoZSBncmFwaCBieSByZW1vdmluZyBkdW1teSBub2RlcyBhbmQgYXVnbWVudGluZyB0aGVcbiAgICAgIC8vIG9yaWdpbmFsIGxvbmcgZWRnZXMgd2l0aCBjb29yZGluYXRlIGluZm9ybWF0aW9uLlxuICAgICAgdXRpbC50aW1lKCd1bmRvTm9ybWFsaXplJywgdW5kb05vcm1hbGl6ZSkoZyk7XG5cbiAgICAgIC8vIFJldmVyc2VzIHBvaW50cyBmb3IgZWRnZXMgdGhhdCBhcmUgaW4gYSByZXZlcnNlZCBzdGF0ZS5cbiAgICAgIHV0aWwudGltZSgnZml4dXBFZGdlUG9pbnRzJywgZml4dXBFZGdlUG9pbnRzKShnKTtcblxuICAgICAgLy8gUmVzdG9yZSBkZWxldGUgZWRnZXMgYW5kIHJldmVyc2UgZWRnZXMgdGhhdCB3ZXJlIHJldmVyc2VkIGluIHRoZSByYW5rXG4gICAgICAvLyBwaGFzZS5cbiAgICAgIHV0aWwudGltZSgncmFuay5yZXN0b3JlRWRnZXMnLCByYW5rLnJlc3RvcmVFZGdlcykoZyk7XG5cbiAgICAgIC8vIENvbnN0cnVjdCBmaW5hbCByZXN1bHQgZ3JhcGggYW5kIHJldHVybiBpdFxuICAgICAgcmV0dXJuIHV0aWwudGltZSgnY3JlYXRlRmluYWxHcmFwaCcsIGNyZWF0ZUZpbmFsR3JhcGgpKGcsIGlucHV0R3JhcGguaXNEaXJlY3RlZCgpKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2VsZi5yYW5rU2VwKHJhbmtTZXApO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAqIFRoaXMgZnVuY3Rpb24gaXMgcmVzcG9uc2libGUgZm9yICdub3JtYWxpemluZycgdGhlIGdyYXBoLiBUaGUgcHJvY2VzcyBvZlxuICAgKiBub3JtYWxpemF0aW9uIGVuc3VyZXMgdGhhdCBubyBlZGdlIGluIHRoZSBncmFwaCBoYXMgc3BhbnMgbW9yZSB0aGFuIG9uZVxuICAgKiByYW5rLiBUbyBkbyB0aGlzIGl0IGluc2VydHMgZHVtbXkgbm9kZXMgYXMgbmVlZGVkIGFuZCBsaW5rcyB0aGVtIGJ5IGFkZGluZ1xuICAgKiBkdW1teSBlZGdlcy4gVGhpcyBmdW5jdGlvbiBrZWVwcyBlbm91Z2ggaW5mb3JtYXRpb24gaW4gdGhlIGR1bW15IG5vZGVzIGFuZFxuICAgKiBlZGdlcyB0byBlbnN1cmUgdGhhdCB0aGUgb3JpZ2luYWwgZ3JhcGggY2FuIGJlIHJlY29uc3RydWN0ZWQgbGF0ZXIuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGFzc3VtZXMgdGhhdCB0aGUgaW5wdXQgZ3JhcGggaXMgY3ljbGUgZnJlZS5cbiAgICovXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZShnKSB7XG4gICAgdmFyIGR1bW15Q291bnQgPSAwO1xuICAgIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgcywgdCwgYSkge1xuICAgICAgdmFyIHNvdXJjZVJhbmsgPSBnLm5vZGUocykucmFuaztcbiAgICAgIHZhciB0YXJnZXRSYW5rID0gZy5ub2RlKHQpLnJhbms7XG4gICAgICBpZiAoc291cmNlUmFuayArIDEgPCB0YXJnZXRSYW5rKSB7XG4gICAgICAgIGZvciAodmFyIHUgPSBzLCByYW5rID0gc291cmNlUmFuayArIDEsIGkgPSAwOyByYW5rIDwgdGFyZ2V0UmFuazsgKytyYW5rLCArK2kpIHtcbiAgICAgICAgICB2YXIgdiA9ICdfRCcgKyAoKytkdW1teUNvdW50KTtcbiAgICAgICAgICB2YXIgbm9kZSA9IHtcbiAgICAgICAgICAgIHdpZHRoOiBhLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBhLmhlaWdodCxcbiAgICAgICAgICAgIGVkZ2U6IHsgaWQ6IGUsIHNvdXJjZTogcywgdGFyZ2V0OiB0LCBhdHRyczogYSB9LFxuICAgICAgICAgICAgcmFuazogcmFuayxcbiAgICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIElmIHRoaXMgbm9kZSByZXByZXNlbnRzIGEgYmVuZCB0aGVuIHdlIHdpbGwgdXNlIGl0IGFzIGEgY29udHJvbFxuICAgICAgICAgIC8vIHBvaW50LiBGb3IgZWRnZXMgd2l0aCAyIHNlZ21lbnRzIHRoaXMgd2lsbCBiZSB0aGUgY2VudGVyIGR1bW15XG4gICAgICAgICAgLy8gbm9kZS4gRm9yIGVkZ2VzIHdpdGggbW9yZSB0aGFuIHR3byBzZWdtZW50cywgdGhpcyB3aWxsIGJlIHRoZVxuICAgICAgICAgIC8vIGZpcnN0IGFuZCBsYXN0IGR1bW15IG5vZGUuXG4gICAgICAgICAgaWYgKGkgPT09IDApIG5vZGUuaW5kZXggPSAwO1xuICAgICAgICAgIGVsc2UgaWYgKHJhbmsgKyAxID09PSB0YXJnZXRSYW5rKSBub2RlLmluZGV4ID0gMTtcblxuICAgICAgICAgIGcuYWRkTm9kZSh2LCBub2RlKTtcbiAgICAgICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdiwge30pO1xuICAgICAgICAgIHUgPSB2O1xuICAgICAgICB9XG4gICAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB0LCB7fSk7XG4gICAgICAgIGcuZGVsRWRnZShlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIFJlY29uc3RydWN0cyB0aGUgZ3JhcGggYXMgaXQgd2FzIGJlZm9yZSBub3JtYWxpemF0aW9uLiBUaGUgcG9zaXRpb25zIG9mXG4gICAqIGR1bW15IG5vZGVzIGFyZSB1c2VkIHRvIGJ1aWxkIGFuIGFycmF5IG9mIHBvaW50cyBmb3IgdGhlIG9yaWdpbmFsICdsb25nJ1xuICAgKiBlZGdlLiBEdW1teSBub2RlcyBhbmQgZWRnZXMgYXJlIHJlbW92ZWQuXG4gICAqL1xuICBmdW5jdGlvbiB1bmRvTm9ybWFsaXplKGcpIHtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIGEpIHtcbiAgICAgIGlmIChhLmR1bW15KSB7XG4gICAgICAgIGlmICgnaW5kZXgnIGluIGEpIHtcbiAgICAgICAgICB2YXIgZWRnZSA9IGEuZWRnZTtcbiAgICAgICAgICBpZiAoIWcuaGFzRWRnZShlZGdlLmlkKSkge1xuICAgICAgICAgICAgZy5hZGRFZGdlKGVkZ2UuaWQsIGVkZ2Uuc291cmNlLCBlZGdlLnRhcmdldCwgZWRnZS5hdHRycyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBwb2ludHMgPSBnLmVkZ2UoZWRnZS5pZCkucG9pbnRzO1xuICAgICAgICAgIHBvaW50c1thLmluZGV4XSA9IHsgeDogYS54LCB5OiBhLnksIHVsOiBhLnVsLCB1cjogYS51ciwgZGw6IGEuZGwsIGRyOiBhLmRyIH07XG4gICAgICAgIH1cbiAgICAgICAgZy5kZWxOb2RlKHUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLypcbiAgICogRm9yIGVhY2ggZWRnZSB0aGF0IHdhcyByZXZlcnNlZCBkdXJpbmcgdGhlIGBhY3ljbGljYCBzdGVwLCByZXZlcnNlIGl0c1xuICAgKiBhcnJheSBvZiBwb2ludHMuXG4gICAqL1xuICBmdW5jdGlvbiBmaXh1cEVkZ2VQb2ludHMoZykge1xuICAgIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgcywgdCwgYSkgeyBpZiAoYS5yZXZlcnNlZCkgYS5wb2ludHMucmV2ZXJzZSgpOyB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUZpbmFsR3JhcGgoZywgaXNEaXJlY3RlZCkge1xuICAgIHZhciBvdXQgPSBpc0RpcmVjdGVkID8gbmV3IENEaWdyYXBoKCkgOiBuZXcgQ0dyYXBoKCk7XG4gICAgb3V0LmdyYXBoKGcuZ3JhcGgoKSk7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkgeyBvdXQuYWRkTm9kZSh1LCB2YWx1ZSk7IH0pO1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkgeyBvdXQucGFyZW50KHUsIGcucGFyZW50KHUpKTsgfSk7XG4gICAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgICAgb3V0LmFkZEVkZ2UodmFsdWUuZSwgdSwgdiwgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gQXR0YWNoIGJvdW5kaW5nIGJveCBpbmZvcm1hdGlvblxuICAgIHZhciBtYXhYID0gMCwgbWF4WSA9IDA7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgICAgaWYgKCFnLmNoaWxkcmVuKHUpLmxlbmd0aCkge1xuICAgICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgdmFsdWUueCArIHZhbHVlLndpZHRoIC8gMik7XG4gICAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCB2YWx1ZS55ICsgdmFsdWUuaGVpZ2h0IC8gMik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgICAgdmFyIG1heFhQb2ludHMgPSBNYXRoLm1heC5hcHBseShNYXRoLCB2YWx1ZS5wb2ludHMubWFwKGZ1bmN0aW9uKHApIHsgcmV0dXJuIHAueDsgfSkpO1xuICAgICAgdmFyIG1heFlQb2ludHMgPSBNYXRoLm1heC5hcHBseShNYXRoLCB2YWx1ZS5wb2ludHMubWFwKGZ1bmN0aW9uKHApIHsgcmV0dXJuIHAueTsgfSkpO1xuICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIG1heFhQb2ludHMgKyB2YWx1ZS53aWR0aCAvIDIpO1xuICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIG1heFlQb2ludHMgKyB2YWx1ZS5oZWlnaHQgLyAyKTtcbiAgICB9KTtcbiAgICBvdXQuZ3JhcGgoKS53aWR0aCA9IG1heFg7XG4gICAgb3V0LmdyYXBoKCkuaGVpZ2h0ID0gbWF4WTtcblxuICAgIHJldHVybiBvdXQ7XG4gIH1cblxuICAvKlxuICAgKiBHaXZlbiBhIGZ1bmN0aW9uLCBhIG5ldyBmdW5jdGlvbiBpcyByZXR1cm5lZCB0aGF0IGludm9rZXMgdGhlIGdpdmVuXG4gICAqIGZ1bmN0aW9uLiBUaGUgcmV0dXJuIHZhbHVlIGZyb20gdGhlIGZ1bmN0aW9uIGlzIGFsd2F5cyB0aGUgYHNlbGZgIG9iamVjdC5cbiAgICovXG4gIGZ1bmN0aW9uIGRlbGVnYXRlUHJvcGVydHkoZikge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGYoKTtcbiAgICAgIGYuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBzZWxmO1xuICAgIH07XG4gIH1cbn07XG5cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgY3Jvc3NDb3VudCA9IHJlcXVpcmUoJy4vb3JkZXIvY3Jvc3NDb3VudCcpLFxuICAgIGluaXRMYXllckdyYXBocyA9IHJlcXVpcmUoJy4vb3JkZXIvaW5pdExheWVyR3JhcGhzJyksXG4gICAgaW5pdE9yZGVyID0gcmVxdWlyZSgnLi9vcmRlci9pbml0T3JkZXInKSxcbiAgICBzb3J0TGF5ZXIgPSByZXF1aXJlKCcuL29yZGVyL3NvcnRMYXllcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9yZGVyO1xuXG4vLyBUaGUgbWF4aW11bSBudW1iZXIgb2Ygc3dlZXBzIHRvIHBlcmZvcm0gYmVmb3JlIGZpbmlzaGluZyB0aGUgb3JkZXIgcGhhc2UuXG52YXIgREVGQVVMVF9NQVhfU1dFRVBTID0gMjQ7XG5vcmRlci5ERUZBVUxUX01BWF9TV0VFUFMgPSBERUZBVUxUX01BWF9TV0VFUFM7XG5cbi8qXG4gKiBSdW5zIHRoZSBvcmRlciBwaGFzZSB3aXRoIHRoZSBzcGVjaWZpZWQgYGdyYXBoLCBgbWF4U3dlZXBzYCwgYW5kXG4gKiBgZGVidWdMZXZlbGAuIElmIGBtYXhTd2VlcHNgIGlzIG5vdCBzcGVjaWZpZWQgd2UgdXNlIGBERUZBVUxUX01BWF9TV0VFUFNgLlxuICogSWYgYGRlYnVnTGV2ZWxgIGlzIG5vdCBzZXQgd2UgYXNzdW1lIDAuXG4gKi9cbmZ1bmN0aW9uIG9yZGVyKGcsIG1heFN3ZWVwcykge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICBtYXhTd2VlcHMgPSBERUZBVUxUX01BWF9TV0VFUFM7XG4gIH1cblxuICB2YXIgcmVzdGFydHMgPSBnLmdyYXBoKCkub3JkZXJSZXN0YXJ0cyB8fCAwO1xuXG4gIHZhciBsYXllckdyYXBocyA9IGluaXRMYXllckdyYXBocyhnKTtcbiAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgd2hlbiB3ZSBhZGQgYmFjayBzdXBwb3J0IGZvciBvcmRlcmluZyBjbHVzdGVyc1xuICBsYXllckdyYXBocy5mb3JFYWNoKGZ1bmN0aW9uKGxnKSB7XG4gICAgbGcgPSBsZy5maWx0ZXJOb2RlcyhmdW5jdGlvbih1KSB7IHJldHVybiAhZy5jaGlsZHJlbih1KS5sZW5ndGg7IH0pO1xuICB9KTtcblxuICB2YXIgaXRlcnMgPSAwLFxuICAgICAgY3VycmVudEJlc3RDQyxcbiAgICAgIGFsbFRpbWVCZXN0Q0MgPSBOdW1iZXIuTUFYX1ZBTFVFLFxuICAgICAgYWxsVGltZUJlc3QgPSB7fTtcblxuICBmdW5jdGlvbiBzYXZlQWxsVGltZUJlc3QoKSB7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkgeyBhbGxUaW1lQmVzdFt1XSA9IHZhbHVlLm9yZGVyOyB9KTtcbiAgfVxuXG4gIGZvciAodmFyIGogPSAwOyBqIDwgTnVtYmVyKHJlc3RhcnRzKSArIDEgJiYgYWxsVGltZUJlc3RDQyAhPT0gMDsgKytqKSB7XG4gICAgY3VycmVudEJlc3RDQyA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgaW5pdE9yZGVyKGcsIHJlc3RhcnRzID4gMCk7XG5cbiAgICB1dGlsLmxvZygyLCAnT3JkZXIgcGhhc2Ugc3RhcnQgY3Jvc3MgY291bnQ6ICcgKyBnLmdyYXBoKCkub3JkZXJJbml0Q0MpO1xuXG4gICAgdmFyIGksIGxhc3RCZXN0LCBjYztcbiAgICBmb3IgKGkgPSAwLCBsYXN0QmVzdCA9IDA7IGxhc3RCZXN0IDwgNCAmJiBpIDwgbWF4U3dlZXBzICYmIGN1cnJlbnRCZXN0Q0MgPiAwOyArK2ksICsrbGFzdEJlc3QsICsraXRlcnMpIHtcbiAgICAgIHN3ZWVwKGcsIGxheWVyR3JhcGhzLCBpKTtcbiAgICAgIGNjID0gY3Jvc3NDb3VudChnKTtcbiAgICAgIGlmIChjYyA8IGN1cnJlbnRCZXN0Q0MpIHtcbiAgICAgICAgbGFzdEJlc3QgPSAwO1xuICAgICAgICBjdXJyZW50QmVzdENDID0gY2M7XG4gICAgICAgIGlmIChjYyA8IGFsbFRpbWVCZXN0Q0MpIHtcbiAgICAgICAgICBzYXZlQWxsVGltZUJlc3QoKTtcbiAgICAgICAgICBhbGxUaW1lQmVzdENDID0gY2M7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHV0aWwubG9nKDMsICdPcmRlciBwaGFzZSBzdGFydCAnICsgaiArICcgaXRlciAnICsgaSArICcgY3Jvc3MgY291bnQ6ICcgKyBjYyk7XG4gICAgfVxuICB9XG5cbiAgT2JqZWN0LmtleXMoYWxsVGltZUJlc3QpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIGlmICghZy5jaGlsZHJlbiB8fCAhZy5jaGlsZHJlbih1KS5sZW5ndGgpIHtcbiAgICAgIGcubm9kZSh1KS5vcmRlciA9IGFsbFRpbWVCZXN0W3VdO1xuICAgIH1cbiAgfSk7XG4gIGcuZ3JhcGgoKS5vcmRlckNDID0gYWxsVGltZUJlc3RDQztcblxuICB1dGlsLmxvZygyLCAnT3JkZXIgaXRlcmF0aW9uczogJyArIGl0ZXJzKTtcbiAgdXRpbC5sb2coMiwgJ09yZGVyIHBoYXNlIGJlc3QgY3Jvc3MgY291bnQ6ICcgKyBnLmdyYXBoKCkub3JkZXJDQyk7XG59XG5cbmZ1bmN0aW9uIHByZWRlY2Vzc29yV2VpZ2h0cyhnLCBub2Rlcykge1xuICB2YXIgd2VpZ2h0cyA9IHt9O1xuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICB3ZWlnaHRzW3VdID0gZy5pbkVkZ2VzKHUpLm1hcChmdW5jdGlvbihlKSB7XG4gICAgICByZXR1cm4gZy5ub2RlKGcuc291cmNlKGUpKS5vcmRlcjtcbiAgICB9KTtcbiAgfSk7XG4gIHJldHVybiB3ZWlnaHRzO1xufVxuXG5mdW5jdGlvbiBzdWNjZXNzb3JXZWlnaHRzKGcsIG5vZGVzKSB7XG4gIHZhciB3ZWlnaHRzID0ge307XG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHdlaWdodHNbdV0gPSBnLm91dEVkZ2VzKHUpLm1hcChmdW5jdGlvbihlKSB7XG4gICAgICByZXR1cm4gZy5ub2RlKGcudGFyZ2V0KGUpKS5vcmRlcjtcbiAgICB9KTtcbiAgfSk7XG4gIHJldHVybiB3ZWlnaHRzO1xufVxuXG5mdW5jdGlvbiBzd2VlcChnLCBsYXllckdyYXBocywgaXRlcikge1xuICBpZiAoaXRlciAlIDIgPT09IDApIHtcbiAgICBzd2VlcERvd24oZywgbGF5ZXJHcmFwaHMsIGl0ZXIpO1xuICB9IGVsc2Uge1xuICAgIHN3ZWVwVXAoZywgbGF5ZXJHcmFwaHMsIGl0ZXIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN3ZWVwRG93bihnLCBsYXllckdyYXBocykge1xuICB2YXIgY2c7XG4gIGZvciAoaSA9IDE7IGkgPCBsYXllckdyYXBocy5sZW5ndGg7ICsraSkge1xuICAgIGNnID0gc29ydExheWVyKGxheWVyR3JhcGhzW2ldLCBjZywgcHJlZGVjZXNzb3JXZWlnaHRzKGcsIGxheWVyR3JhcGhzW2ldLm5vZGVzKCkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzd2VlcFVwKGcsIGxheWVyR3JhcGhzKSB7XG4gIHZhciBjZztcbiAgZm9yIChpID0gbGF5ZXJHcmFwaHMubGVuZ3RoIC0gMjsgaSA+PSAwOyAtLWkpIHtcbiAgICBzb3J0TGF5ZXIobGF5ZXJHcmFwaHNbaV0sIGNnLCBzdWNjZXNzb3JXZWlnaHRzKGcsIGxheWVyR3JhcGhzW2ldLm5vZGVzKCkpKTtcbiAgfVxufVxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gY3Jvc3NDb3VudDtcblxuLypcbiAqIFJldHVybnMgdGhlIGNyb3NzIGNvdW50IGZvciB0aGUgZ2l2ZW4gZ3JhcGguXG4gKi9cbmZ1bmN0aW9uIGNyb3NzQ291bnQoZykge1xuICB2YXIgY2MgPSAwO1xuICB2YXIgb3JkZXJpbmcgPSB1dGlsLm9yZGVyaW5nKGcpO1xuICBmb3IgKHZhciBpID0gMTsgaSA8IG9yZGVyaW5nLmxlbmd0aDsgKytpKSB7XG4gICAgY2MgKz0gdHdvTGF5ZXJDcm9zc0NvdW50KGcsIG9yZGVyaW5nW2ktMV0sIG9yZGVyaW5nW2ldKTtcbiAgfVxuICByZXR1cm4gY2M7XG59XG5cbi8qXG4gKiBUaGlzIGZ1bmN0aW9uIHNlYXJjaGVzIHRocm91Z2ggYSByYW5rZWQgYW5kIG9yZGVyZWQgZ3JhcGggYW5kIGNvdW50cyB0aGVcbiAqIG51bWJlciBvZiBlZGdlcyB0aGF0IGNyb3NzLiBUaGlzIGFsZ29yaXRobSBpcyBkZXJpdmVkIGZyb206XG4gKlxuICogICAgVy4gQmFydGggZXQgYWwuLCBCaWxheWVyIENyb3NzIENvdW50aW5nLCBKR0FBLCA4KDIpIDE3OeKAkzE5NCAoMjAwNClcbiAqL1xuZnVuY3Rpb24gdHdvTGF5ZXJDcm9zc0NvdW50KGcsIGxheWVyMSwgbGF5ZXIyKSB7XG4gIHZhciBpbmRpY2VzID0gW107XG4gIGxheWVyMS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICB2YXIgbm9kZUluZGljZXMgPSBbXTtcbiAgICBnLm91dEVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkgeyBub2RlSW5kaWNlcy5wdXNoKGcubm9kZShnLnRhcmdldChlKSkub3JkZXIpOyB9KTtcbiAgICBub2RlSW5kaWNlcy5zb3J0KGZ1bmN0aW9uKHgsIHkpIHsgcmV0dXJuIHggLSB5OyB9KTtcbiAgICBpbmRpY2VzID0gaW5kaWNlcy5jb25jYXQobm9kZUluZGljZXMpO1xuICB9KTtcblxuICB2YXIgZmlyc3RJbmRleCA9IDE7XG4gIHdoaWxlIChmaXJzdEluZGV4IDwgbGF5ZXIyLmxlbmd0aCkgZmlyc3RJbmRleCA8PD0gMTtcblxuICB2YXIgdHJlZVNpemUgPSAyICogZmlyc3RJbmRleCAtIDE7XG4gIGZpcnN0SW5kZXggLT0gMTtcblxuICB2YXIgdHJlZSA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHRyZWVTaXplOyArK2kpIHsgdHJlZVtpXSA9IDA7IH1cblxuICB2YXIgY2MgPSAwO1xuICBpbmRpY2VzLmZvckVhY2goZnVuY3Rpb24oaSkge1xuICAgIHZhciB0cmVlSW5kZXggPSBpICsgZmlyc3RJbmRleDtcbiAgICArK3RyZWVbdHJlZUluZGV4XTtcbiAgICB3aGlsZSAodHJlZUluZGV4ID4gMCkge1xuICAgICAgaWYgKHRyZWVJbmRleCAlIDIpIHtcbiAgICAgICAgY2MgKz0gdHJlZVt0cmVlSW5kZXggKyAxXTtcbiAgICAgIH1cbiAgICAgIHRyZWVJbmRleCA9ICh0cmVlSW5kZXggLSAxKSA+PiAxO1xuICAgICAgKyt0cmVlW3RyZWVJbmRleF07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY2M7XG59XG4iLCJ2YXIgbm9kZXNGcm9tTGlzdCA9IHJlcXVpcmUoJ2dyYXBobGliJykuZmlsdGVyLm5vZGVzRnJvbUxpc3QsXG4gICAgLyoganNoaW50IC1XMDc5ICovXG4gICAgU2V0ID0gcmVxdWlyZSgnY3AtZGF0YScpLlNldDtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0TGF5ZXJHcmFwaHM7XG5cbi8qXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGEgY29tcG91bmQgbGF5ZXJlZCBncmFwaCwgZywgYW5kIHByb2R1Y2VzIGFuIGFycmF5IG9mXG4gKiBsYXllciBncmFwaHMuIEVhY2ggZW50cnkgaW4gdGhlIGFycmF5IHJlcHJlc2VudHMgYSBzdWJncmFwaCBvZiBub2Rlc1xuICogcmVsZXZhbnQgZm9yIHBlcmZvcm1pbmcgY3Jvc3NpbmcgcmVkdWN0aW9uIG9uIHRoYXQgbGF5ZXIuXG4gKi9cbmZ1bmN0aW9uIGluaXRMYXllckdyYXBocyhnKSB7XG4gIHZhciByYW5rcyA9IFtdO1xuXG4gIGZ1bmN0aW9uIGRmcyh1KSB7XG4gICAgaWYgKHUgPT09IG51bGwpIHtcbiAgICAgIGcuY2hpbGRyZW4odSkuZm9yRWFjaChmdW5jdGlvbih2KSB7IGRmcyh2KTsgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHZhbHVlID0gZy5ub2RlKHUpO1xuICAgIHZhbHVlLm1pblJhbmsgPSAoJ3JhbmsnIGluIHZhbHVlKSA/IHZhbHVlLnJhbmsgOiBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgIHZhbHVlLm1heFJhbmsgPSAoJ3JhbmsnIGluIHZhbHVlKSA/IHZhbHVlLnJhbmsgOiBOdW1iZXIuTUlOX1ZBTFVFO1xuICAgIHZhciB1UmFua3MgPSBuZXcgU2V0KCk7XG4gICAgZy5jaGlsZHJlbih1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIHZhciBycyA9IGRmcyh2KTtcbiAgICAgIHVSYW5rcyA9IFNldC51bmlvbihbdVJhbmtzLCByc10pO1xuICAgICAgdmFsdWUubWluUmFuayA9IE1hdGgubWluKHZhbHVlLm1pblJhbmssIGcubm9kZSh2KS5taW5SYW5rKTtcbiAgICAgIHZhbHVlLm1heFJhbmsgPSBNYXRoLm1heCh2YWx1ZS5tYXhSYW5rLCBnLm5vZGUodikubWF4UmFuayk7XG4gICAgfSk7XG5cbiAgICBpZiAoJ3JhbmsnIGluIHZhbHVlKSB1UmFua3MuYWRkKHZhbHVlLnJhbmspO1xuXG4gICAgdVJhbmtzLmtleXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHIpIHtcbiAgICAgIGlmICghKHIgaW4gcmFua3MpKSByYW5rc1tyXSA9IFtdO1xuICAgICAgcmFua3Nbcl0ucHVzaCh1KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB1UmFua3M7XG4gIH1cbiAgZGZzKG51bGwpO1xuXG4gIHZhciBsYXllckdyYXBocyA9IFtdO1xuICByYW5rcy5mb3JFYWNoKGZ1bmN0aW9uKHVzLCByYW5rKSB7XG4gICAgbGF5ZXJHcmFwaHNbcmFua10gPSBnLmZpbHRlck5vZGVzKG5vZGVzRnJvbUxpc3QodXMpKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGxheWVyR3JhcGhzO1xufVxuIiwidmFyIGNyb3NzQ291bnQgPSByZXF1aXJlKCcuL2Nyb3NzQ291bnQnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXRPcmRlcjtcblxuLypcbiAqIEdpdmVuIGEgZ3JhcGggd2l0aCBhIHNldCBvZiBsYXllcmVkIG5vZGVzIChpLmUuIG5vZGVzIHRoYXQgaGF2ZSBhIGByYW5rYFxuICogYXR0cmlidXRlKSB0aGlzIGZ1bmN0aW9uIGF0dGFjaGVzIGFuIGBvcmRlcmAgYXR0cmlidXRlIHRoYXQgdW5pcXVlbHlcbiAqIGFycmFuZ2VzIGVhY2ggbm9kZSBvZiBlYWNoIHJhbmsuIElmIG5vIGNvbnN0cmFpbnQgZ3JhcGggaXMgcHJvdmlkZWQgdGhlXG4gKiBvcmRlciBvZiB0aGUgbm9kZXMgaW4gZWFjaCByYW5rIGlzIGVudGlyZWx5IGFyYml0cmFyeS5cbiAqL1xuZnVuY3Rpb24gaW5pdE9yZGVyKGcsIHJhbmRvbSkge1xuICB2YXIgbGF5ZXJzID0gW107XG5cbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIHZhciBsYXllciA9IGxheWVyc1t2YWx1ZS5yYW5rXTtcbiAgICBpZiAoZy5jaGlsZHJlbiAmJiBnLmNoaWxkcmVuKHUpLmxlbmd0aCA+IDApIHJldHVybjtcbiAgICBpZiAoIWxheWVyKSB7XG4gICAgICBsYXllciA9IGxheWVyc1t2YWx1ZS5yYW5rXSA9IFtdO1xuICAgIH1cbiAgICBsYXllci5wdXNoKHUpO1xuICB9KTtcblxuICBsYXllcnMuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgIGlmIChyYW5kb20pIHtcbiAgICAgIHV0aWwuc2h1ZmZsZShsYXllcik7XG4gICAgfVxuICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odSwgaSkge1xuICAgICAgZy5ub2RlKHUpLm9yZGVyID0gaTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgdmFyIGNjID0gY3Jvc3NDb3VudChnKTtcbiAgZy5ncmFwaCgpLm9yZGVySW5pdENDID0gY2M7XG4gIGcuZ3JhcGgoKS5vcmRlckNDID0gTnVtYmVyLk1BWF9WQUxVRTtcbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuLypcbiAgICBEaWdyYXBoID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5EaWdyYXBoLFxuICAgIHRvcHNvcnQgPSByZXF1aXJlKCdncmFwaGxpYicpLmFsZy50b3Bzb3J0LFxuICAgIG5vZGVzRnJvbUxpc3QgPSByZXF1aXJlKCdncmFwaGxpYicpLmZpbHRlci5ub2Rlc0Zyb21MaXN0O1xuKi9cblxubW9kdWxlLmV4cG9ydHMgPSBzb3J0TGF5ZXI7XG5cbi8qXG5mdW5jdGlvbiBzb3J0TGF5ZXIoZywgY2csIHdlaWdodHMpIHtcbiAgdmFyIHJlc3VsdCA9IHNvcnRMYXllclN1YmdyYXBoKGcsIG51bGwsIGNnLCB3ZWlnaHRzKTtcbiAgcmVzdWx0Lmxpc3QuZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7XG4gICAgZy5ub2RlKHUpLm9yZGVyID0gaTtcbiAgfSk7XG4gIHJldHVybiByZXN1bHQuY29uc3RyYWludEdyYXBoO1xufVxuKi9cblxuZnVuY3Rpb24gc29ydExheWVyKGcsIGNnLCB3ZWlnaHRzKSB7XG4gIHZhciBvcmRlcmluZyA9IFtdO1xuICB2YXIgYnMgPSB7fTtcbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIG9yZGVyaW5nW3ZhbHVlLm9yZGVyXSA9IHU7XG4gICAgdmFyIHdzID0gd2VpZ2h0c1t1XTtcbiAgICBpZiAod3MubGVuZ3RoKSB7XG4gICAgICBic1t1XSA9IHV0aWwuc3VtKHdzKSAvIHdzLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHZhciB0b1NvcnQgPSBnLm5vZGVzKCkuZmlsdGVyKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGJzW3VdICE9PSB1bmRlZmluZWQ7IH0pO1xuICB0b1NvcnQuc29ydChmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIGJzW3hdIC0gYnNbeV0gfHwgZy5ub2RlKHgpLm9yZGVyIC0gZy5ub2RlKHkpLm9yZGVyO1xuICB9KTtcblxuICBmb3IgKHZhciBpID0gMCwgaiA9IDAsIGpsID0gdG9Tb3J0Lmxlbmd0aDsgaiA8IGpsOyArK2kpIHtcbiAgICBpZiAoYnNbb3JkZXJpbmdbaV1dICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGcubm9kZSh0b1NvcnRbaisrXSkub3JkZXIgPSBpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBUT09EOiByZS1lbmFibGUgY29uc3RyYWluZWQgc29ydGluZyBvbmNlIHdlIGhhdmUgYSBzdHJhdGVneSBmb3IgaGFuZGxpbmdcbi8vIHVuZGVmaW5lZCBiYXJ5Y2VudGVycy5cbi8qXG5mdW5jdGlvbiBzb3J0TGF5ZXJTdWJncmFwaChnLCBzZywgY2csIHdlaWdodHMpIHtcbiAgY2cgPSBjZyA/IGNnLmZpbHRlck5vZGVzKG5vZGVzRnJvbUxpc3QoZy5jaGlsZHJlbihzZykpKSA6IG5ldyBEaWdyYXBoKCk7XG5cbiAgdmFyIG5vZGVEYXRhID0ge307XG4gIGcuY2hpbGRyZW4oc2cpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIGlmIChnLmNoaWxkcmVuKHUpLmxlbmd0aCkge1xuICAgICAgbm9kZURhdGFbdV0gPSBzb3J0TGF5ZXJTdWJncmFwaChnLCB1LCBjZywgd2VpZ2h0cyk7XG4gICAgICBub2RlRGF0YVt1XS5maXJzdFNHID0gdTtcbiAgICAgIG5vZGVEYXRhW3VdLmxhc3RTRyA9IHU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciB3cyA9IHdlaWdodHNbdV07XG4gICAgICBub2RlRGF0YVt1XSA9IHtcbiAgICAgICAgZGVncmVlOiB3cy5sZW5ndGgsXG4gICAgICAgIGJhcnljZW50ZXI6IHdzLmxlbmd0aCA+IDAgPyB1dGlsLnN1bSh3cykgLyB3cy5sZW5ndGggOiAwLFxuICAgICAgICBsaXN0OiBbdV1cbiAgICAgIH07XG4gICAgfVxuICB9KTtcblxuICByZXNvbHZlVmlvbGF0ZWRDb25zdHJhaW50cyhnLCBjZywgbm9kZURhdGEpO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMobm9kZURhdGEpO1xuICBrZXlzLnNvcnQoZnVuY3Rpb24oeCwgeSkge1xuICAgIHJldHVybiBub2RlRGF0YVt4XS5iYXJ5Y2VudGVyIC0gbm9kZURhdGFbeV0uYmFyeWNlbnRlcjtcbiAgfSk7XG5cbiAgdmFyIHJlc3VsdCA9ICBrZXlzLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBub2RlRGF0YVt1XTsgfSlcbiAgICAgICAgICAgICAgICAgICAgLnJlZHVjZShmdW5jdGlvbihsaHMsIHJocykgeyByZXR1cm4gbWVyZ2VOb2RlRGF0YShnLCBsaHMsIHJocyk7IH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKlxuZnVuY3Rpb24gbWVyZ2VOb2RlRGF0YShnLCBsaHMsIHJocykge1xuICB2YXIgY2cgPSBtZXJnZURpZ3JhcGhzKGxocy5jb25zdHJhaW50R3JhcGgsIHJocy5jb25zdHJhaW50R3JhcGgpO1xuXG4gIGlmIChsaHMubGFzdFNHICE9PSB1bmRlZmluZWQgJiYgcmhzLmZpcnN0U0cgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmIChjZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjZyA9IG5ldyBEaWdyYXBoKCk7XG4gICAgfVxuICAgIGlmICghY2cuaGFzTm9kZShsaHMubGFzdFNHKSkgeyBjZy5hZGROb2RlKGxocy5sYXN0U0cpOyB9XG4gICAgY2cuYWRkTm9kZShyaHMuZmlyc3RTRyk7XG4gICAgY2cuYWRkRWRnZShudWxsLCBsaHMubGFzdFNHLCByaHMuZmlyc3RTRyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGRlZ3JlZTogbGhzLmRlZ3JlZSArIHJocy5kZWdyZWUsXG4gICAgYmFyeWNlbnRlcjogKGxocy5iYXJ5Y2VudGVyICogbGhzLmRlZ3JlZSArIHJocy5iYXJ5Y2VudGVyICogcmhzLmRlZ3JlZSkgL1xuICAgICAgICAgICAgICAgIChsaHMuZGVncmVlICsgcmhzLmRlZ3JlZSksXG4gICAgbGlzdDogbGhzLmxpc3QuY29uY2F0KHJocy5saXN0KSxcbiAgICBmaXJzdFNHOiBsaHMuZmlyc3RTRyAhPT0gdW5kZWZpbmVkID8gbGhzLmZpcnN0U0cgOiByaHMuZmlyc3RTRyxcbiAgICBsYXN0U0c6IHJocy5sYXN0U0cgIT09IHVuZGVmaW5lZCA/IHJocy5sYXN0U0cgOiBsaHMubGFzdFNHLFxuICAgIGNvbnN0cmFpbnRHcmFwaDogY2dcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VEaWdyYXBocyhsaHMsIHJocykge1xuICBpZiAobGhzID09PSB1bmRlZmluZWQpIHJldHVybiByaHM7XG4gIGlmIChyaHMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGxocztcblxuICBsaHMgPSBsaHMuY29weSgpO1xuICByaHMubm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHsgbGhzLmFkZE5vZGUodSk7IH0pO1xuICByaHMuZWRnZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKGUsIHUsIHYpIHsgbGhzLmFkZEVkZ2UobnVsbCwgdSwgdik7IH0pO1xuICByZXR1cm4gbGhzO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVmlvbGF0ZWRDb25zdHJhaW50cyhnLCBjZywgbm9kZURhdGEpIHtcbiAgLy8gUmVtb3ZlcyBub2RlcyBgdWAgYW5kIGB2YCBmcm9tIGBjZ2AgYW5kIG1ha2VzIGFueSBlZGdlcyBpbmNpZGVudCBvbiB0aGVtXG4gIC8vIGluY2lkZW50IG9uIGB3YCBpbnN0ZWFkLlxuICBmdW5jdGlvbiBjb2xsYXBzZU5vZGVzKHUsIHYsIHcpIHtcbiAgICAvLyBUT0RPIG9yaWdpbmFsIHBhcGVyIHJlbW92ZXMgc2VsZiBsb29wcywgYnV0IGl0IGlzIG5vdCBvYnZpb3VzIHdoZW4gdGhpcyB3b3VsZCBoYXBwZW5cbiAgICBjZy5pbkVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgICAgY2cuZGVsRWRnZShlKTtcbiAgICAgIGNnLmFkZEVkZ2UobnVsbCwgY2cuc291cmNlKGUpLCB3KTtcbiAgICB9KTtcblxuICAgIGNnLm91dEVkZ2VzKHYpLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgICAgY2cuZGVsRWRnZShlKTtcbiAgICAgIGNnLmFkZEVkZ2UobnVsbCwgdywgY2cudGFyZ2V0KGUpKTtcbiAgICB9KTtcblxuICAgIGNnLmRlbE5vZGUodSk7XG4gICAgY2cuZGVsTm9kZSh2KTtcbiAgfVxuXG4gIHZhciB2aW9sYXRlZDtcbiAgd2hpbGUgKCh2aW9sYXRlZCA9IGZpbmRWaW9sYXRlZENvbnN0cmFpbnQoY2csIG5vZGVEYXRhKSkgIT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBzb3VyY2UgPSBjZy5zb3VyY2UodmlvbGF0ZWQpLFxuICAgICAgICB0YXJnZXQgPSBjZy50YXJnZXQodmlvbGF0ZWQpO1xuXG4gICAgdmFyIHY7XG4gICAgd2hpbGUgKCh2ID0gY2cuYWRkTm9kZShudWxsKSkgJiYgZy5oYXNOb2RlKHYpKSB7XG4gICAgICBjZy5kZWxOb2RlKHYpO1xuICAgIH1cblxuICAgIC8vIENvbGxhcHNlIGJhcnljZW50ZXIgYW5kIGxpc3RcbiAgICBub2RlRGF0YVt2XSA9IG1lcmdlTm9kZURhdGEoZywgbm9kZURhdGFbc291cmNlXSwgbm9kZURhdGFbdGFyZ2V0XSk7XG4gICAgZGVsZXRlIG5vZGVEYXRhW3NvdXJjZV07XG4gICAgZGVsZXRlIG5vZGVEYXRhW3RhcmdldF07XG5cbiAgICBjb2xsYXBzZU5vZGVzKHNvdXJjZSwgdGFyZ2V0LCB2KTtcbiAgICBpZiAoY2cuaW5jaWRlbnRFZGdlcyh2KS5sZW5ndGggPT09IDApIHsgY2cuZGVsTm9kZSh2KTsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRWaW9sYXRlZENvbnN0cmFpbnQoY2csIG5vZGVEYXRhKSB7XG4gIHZhciB1cyA9IHRvcHNvcnQoY2cpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHVzLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHUgPSB1c1tpXTtcbiAgICB2YXIgaW5FZGdlcyA9IGNnLmluRWRnZXModSk7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBpbkVkZ2VzLmxlbmd0aDsgKytqKSB7XG4gICAgICB2YXIgZSA9IGluRWRnZXNbal07XG4gICAgICBpZiAobm9kZURhdGFbY2cuc291cmNlKGUpXS5iYXJ5Y2VudGVyID49IG5vZGVEYXRhW3VdLmJhcnljZW50ZXIpIHtcbiAgICAgICAgcmV0dXJuIGU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4qL1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLypcbiAqIFRoZSBhbGdvcml0aG1zIGhlcmUgYXJlIGJhc2VkIG9uIEJyYW5kZXMgYW5kIEvDtnBmLCBcIkZhc3QgYW5kIFNpbXBsZVxuICogSG9yaXpvbnRhbCBDb29yZGluYXRlIEFzc2lnbm1lbnRcIi5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgLy8gRXh0ZXJuYWwgY29uZmlndXJhdGlvblxuICB2YXIgY29uZmlnID0ge1xuICAgIG5vZGVTZXA6IDUwLFxuICAgIGVkZ2VTZXA6IDEwLFxuICAgIHVuaXZlcnNhbFNlcDogbnVsbCxcbiAgICByYW5rU2VwOiAzMFxuICB9O1xuXG4gIHZhciBzZWxmID0ge307XG5cbiAgc2VsZi5ub2RlU2VwID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ25vZGVTZXAnKTtcbiAgc2VsZi5lZGdlU2VwID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ2VkZ2VTZXAnKTtcbiAgLy8gSWYgbm90IG51bGwgdGhpcyBzZXBhcmF0aW9uIHZhbHVlIGlzIHVzZWQgZm9yIGFsbCBub2RlcyBhbmQgZWRnZXNcbiAgLy8gcmVnYXJkbGVzcyBvZiB0aGVpciB3aWR0aHMuIGBub2RlU2VwYCBhbmQgYGVkZ2VTZXBgIGFyZSBpZ25vcmVkIHdpdGggdGhpc1xuICAvLyBvcHRpb24uXG4gIHNlbGYudW5pdmVyc2FsU2VwID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ3VuaXZlcnNhbFNlcCcpO1xuICBzZWxmLnJhbmtTZXAgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAncmFua1NlcCcpO1xuICBzZWxmLmRlYnVnTGV2ZWwgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnZGVidWdMZXZlbCcpO1xuXG4gIHNlbGYucnVuID0gcnVuO1xuXG4gIHJldHVybiBzZWxmO1xuXG4gIGZ1bmN0aW9uIHJ1bihnKSB7XG4gICAgZyA9IGcuZmlsdGVyTm9kZXModXRpbC5maWx0ZXJOb25TdWJncmFwaHMoZykpO1xuXG4gICAgdmFyIGxheWVyaW5nID0gdXRpbC5vcmRlcmluZyhnKTtcblxuICAgIHZhciBjb25mbGljdHMgPSBmaW5kQ29uZmxpY3RzKGcsIGxheWVyaW5nKTtcblxuICAgIHZhciB4c3MgPSB7fTtcbiAgICBbJ3UnLCAnZCddLmZvckVhY2goZnVuY3Rpb24odmVydERpcikge1xuICAgICAgaWYgKHZlcnREaXIgPT09ICdkJykgbGF5ZXJpbmcucmV2ZXJzZSgpO1xuXG4gICAgICBbJ2wnLCAnciddLmZvckVhY2goZnVuY3Rpb24oaG9yaXpEaXIpIHtcbiAgICAgICAgaWYgKGhvcml6RGlyID09PSAncicpIHJldmVyc2VJbm5lck9yZGVyKGxheWVyaW5nKTtcblxuICAgICAgICB2YXIgZGlyID0gdmVydERpciArIGhvcml6RGlyO1xuICAgICAgICB2YXIgYWxpZ24gPSB2ZXJ0aWNhbEFsaWdubWVudChnLCBsYXllcmluZywgY29uZmxpY3RzLCB2ZXJ0RGlyID09PSAndScgPyAncHJlZGVjZXNzb3JzJyA6ICdzdWNjZXNzb3JzJyk7XG4gICAgICAgIHhzc1tkaXJdPSBob3Jpem9udGFsQ29tcGFjdGlvbihnLCBsYXllcmluZywgYWxpZ24ucG9zLCBhbGlnbi5yb290LCBhbGlnbi5hbGlnbik7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5kZWJ1Z0xldmVsID49IDMpXG4gICAgICAgICAgZGVidWdQb3NpdGlvbmluZyh2ZXJ0RGlyICsgaG9yaXpEaXIsIGcsIGxheWVyaW5nLCB4c3NbZGlyXSk7XG5cbiAgICAgICAgaWYgKGhvcml6RGlyID09PSAncicpIGZsaXBIb3Jpem9udGFsbHkoeHNzW2Rpcl0pO1xuXG4gICAgICAgIGlmIChob3JpekRpciA9PT0gJ3InKSByZXZlcnNlSW5uZXJPcmRlcihsYXllcmluZyk7XG4gICAgICB9KTtcblxuICAgICAgaWYgKHZlcnREaXIgPT09ICdkJykgbGF5ZXJpbmcucmV2ZXJzZSgpO1xuICAgIH0pO1xuXG4gICAgYmFsYW5jZShnLCBsYXllcmluZywgeHNzKTtcblxuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odikge1xuICAgICAgdmFyIHhzID0gW107XG4gICAgICBmb3IgKHZhciBhbGlnbm1lbnQgaW4geHNzKSB7XG4gICAgICAgIHZhciBhbGlnbm1lbnRYID0geHNzW2FsaWdubWVudF1bdl07XG4gICAgICAgIHBvc1hEZWJ1ZyhhbGlnbm1lbnQsIGcsIHYsIGFsaWdubWVudFgpO1xuICAgICAgICB4cy5wdXNoKGFsaWdubWVudFgpO1xuICAgICAgfVxuICAgICAgeHMuc29ydChmdW5jdGlvbih4LCB5KSB7IHJldHVybiB4IC0geTsgfSk7XG4gICAgICBwb3NYKGcsIHYsICh4c1sxXSArIHhzWzJdKSAvIDIpO1xuICAgIH0pO1xuXG4gICAgLy8gQWxpZ24geSBjb29yZGluYXRlcyB3aXRoIHJhbmtzXG4gICAgdmFyIHkgPSAwLCByZXZlcnNlWSA9IGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnQlQnIHx8IGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnUkwnO1xuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIHZhciBtYXhIZWlnaHQgPSB1dGlsLm1heChsYXllci5tYXAoZnVuY3Rpb24odSkgeyByZXR1cm4gaGVpZ2h0KGcsIHUpOyB9KSk7XG4gICAgICB5ICs9IG1heEhlaWdodCAvIDI7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgICAgcG9zWShnLCB1LCByZXZlcnNlWSA/IC15IDogeSk7XG4gICAgICB9KTtcbiAgICAgIHkgKz0gbWF4SGVpZ2h0IC8gMiArIGNvbmZpZy5yYW5rU2VwO1xuICAgIH0pO1xuXG4gICAgLy8gVHJhbnNsYXRlIGxheW91dCBzbyB0aGF0IHRvcCBsZWZ0IGNvcm5lciBvZiBib3VuZGluZyByZWN0YW5nbGUgaGFzXG4gICAgLy8gY29vcmRpbmF0ZSAoMCwgMCkuXG4gICAgdmFyIG1pblggPSB1dGlsLm1pbihnLm5vZGVzKCkubWFwKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIHBvc1goZywgdSkgLSB3aWR0aChnLCB1KSAvIDI7IH0pKTtcbiAgICB2YXIgbWluWSA9IHV0aWwubWluKGcubm9kZXMoKS5tYXAoZnVuY3Rpb24odSkgeyByZXR1cm4gcG9zWShnLCB1KSAtIGhlaWdodChnLCB1KSAvIDI7IH0pKTtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHtcbiAgICAgIHBvc1goZywgdSwgcG9zWChnLCB1KSAtIG1pblgpO1xuICAgICAgcG9zWShnLCB1LCBwb3NZKGcsIHUpIC0gbWluWSk7XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBHZW5lcmF0ZSBhbiBJRCB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlcHJlc2VudCBhbnkgdW5kaXJlY3RlZCBlZGdlIHRoYXQgaXNcbiAgICogaW5jaWRlbnQgb24gYHVgIGFuZCBgdmAuXG4gICAqL1xuICBmdW5jdGlvbiB1bmRpckVkZ2VJZCh1LCB2KSB7XG4gICAgcmV0dXJuIHUgPCB2XG4gICAgICA/IHUudG9TdHJpbmcoKS5sZW5ndGggKyAnOicgKyB1ICsgJy0nICsgdlxuICAgICAgOiB2LnRvU3RyaW5nKCkubGVuZ3RoICsgJzonICsgdiArICctJyArIHU7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5kQ29uZmxpY3RzKGcsIGxheWVyaW5nKSB7XG4gICAgdmFyIGNvbmZsaWN0cyA9IHt9LCAvLyBTZXQgb2YgY29uZmxpY3RpbmcgZWRnZSBpZHNcbiAgICAgICAgcG9zID0ge30sICAgICAgIC8vIFBvc2l0aW9uIG9mIG5vZGUgaW4gaXRzIGxheWVyXG4gICAgICAgIHByZXZMYXllcixcbiAgICAgICAgY3VyckxheWVyLFxuICAgICAgICBrMCwgICAgIC8vIFBvc2l0aW9uIG9mIHRoZSBsYXN0IGlubmVyIHNlZ21lbnQgaW4gdGhlIHByZXZpb3VzIGxheWVyXG4gICAgICAgIGwsICAgICAgLy8gQ3VycmVudCBwb3NpdGlvbiBpbiB0aGUgY3VycmVudCBsYXllciAoZm9yIGl0ZXJhdGlvbiB1cCB0byBgbDFgKVxuICAgICAgICBrMTsgICAgIC8vIFBvc2l0aW9uIG9mIHRoZSBuZXh0IGlubmVyIHNlZ21lbnQgaW4gdGhlIHByZXZpb3VzIGxheWVyIG9yXG4gICAgICAgICAgICAgICAgLy8gdGhlIHBvc2l0aW9uIG9mIHRoZSBsYXN0IGVsZW1lbnQgaW4gdGhlIHByZXZpb3VzIGxheWVyXG5cbiAgICBpZiAobGF5ZXJpbmcubGVuZ3RoIDw9IDIpIHJldHVybiBjb25mbGljdHM7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVDb25mbGljdHModikge1xuICAgICAgdmFyIGsgPSBwb3Nbdl07XG4gICAgICBpZiAoayA8IGswIHx8IGsgPiBrMSkge1xuICAgICAgICBjb25mbGljdHNbdW5kaXJFZGdlSWQoY3VyckxheWVyW2xdLCB2KV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxheWVyaW5nWzFdLmZvckVhY2goZnVuY3Rpb24odSwgaSkgeyBwb3NbdV0gPSBpOyB9KTtcbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IGxheWVyaW5nLmxlbmd0aCAtIDE7ICsraSkge1xuICAgICAgcHJldkxheWVyID0gbGF5ZXJpbmdbaV07XG4gICAgICBjdXJyTGF5ZXIgPSBsYXllcmluZ1tpKzFdO1xuICAgICAgazAgPSAwO1xuICAgICAgbCA9IDA7XG5cbiAgICAgIC8vIFNjYW4gY3VycmVudCBsYXllciBmb3IgbmV4dCBub2RlIHRoYXQgaXMgaW5jaWRlbnQgdG8gYW4gaW5uZXIgc2VnZW1lbnRcbiAgICAgIC8vIGJldHdlZW4gbGF5ZXJpbmdbaSsxXSBhbmQgbGF5ZXJpbmdbaV0uXG4gICAgICBmb3IgKHZhciBsMSA9IDA7IGwxIDwgY3VyckxheWVyLmxlbmd0aDsgKytsMSkge1xuICAgICAgICB2YXIgdSA9IGN1cnJMYXllcltsMV07IC8vIE5leHQgaW5uZXIgc2VnbWVudCBpbiB0aGUgY3VycmVudCBsYXllciBvclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxhc3Qgbm9kZSBpbiB0aGUgY3VycmVudCBsYXllclxuICAgICAgICBwb3NbdV0gPSBsMTtcbiAgICAgICAgazEgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKGcubm9kZSh1KS5kdW1teSkge1xuICAgICAgICAgIHZhciB1UHJlZCA9IGcucHJlZGVjZXNzb3JzKHUpWzBdO1xuICAgICAgICAgIC8vIE5vdGU6IEluIHRoZSBjYXNlIG9mIHNlbGYgbG9vcHMgYW5kIHNpZGV3YXlzIGVkZ2VzIGl0IGlzIHBvc3NpYmxlXG4gICAgICAgICAgLy8gZm9yIGEgZHVtbXkgbm90IHRvIGhhdmUgYSBwcmVkZWNlc3Nvci5cbiAgICAgICAgICBpZiAodVByZWQgIT09IHVuZGVmaW5lZCAmJiBnLm5vZGUodVByZWQpLmR1bW15KVxuICAgICAgICAgICAgazEgPSBwb3NbdVByZWRdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChrMSA9PT0gdW5kZWZpbmVkICYmIGwxID09PSBjdXJyTGF5ZXIubGVuZ3RoIC0gMSlcbiAgICAgICAgICBrMSA9IHByZXZMYXllci5sZW5ndGggLSAxO1xuXG4gICAgICAgIGlmIChrMSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZm9yICg7IGwgPD0gbDE7ICsrbCkge1xuICAgICAgICAgICAgZy5wcmVkZWNlc3NvcnMoY3VyckxheWVyW2xdKS5mb3JFYWNoKHVwZGF0ZUNvbmZsaWN0cyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGswID0gazE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY29uZmxpY3RzO1xuICB9XG5cbiAgZnVuY3Rpb24gdmVydGljYWxBbGlnbm1lbnQoZywgbGF5ZXJpbmcsIGNvbmZsaWN0cywgcmVsYXRpb25zaGlwKSB7XG4gICAgdmFyIHBvcyA9IHt9LCAgIC8vIFBvc2l0aW9uIGZvciBhIG5vZGUgaW4gaXRzIGxheWVyXG4gICAgICAgIHJvb3QgPSB7fSwgIC8vIFJvb3Qgb2YgdGhlIGJsb2NrIHRoYXQgdGhlIG5vZGUgcGFydGljaXBhdGVzIGluXG4gICAgICAgIGFsaWduID0ge307IC8vIFBvaW50cyB0byB0aGUgbmV4dCBub2RlIGluIHRoZSBibG9jayBvciwgaWYgdGhlIGxhc3RcbiAgICAgICAgICAgICAgICAgICAgLy8gZWxlbWVudCBpbiB0aGUgYmxvY2ssIHBvaW50cyB0byB0aGUgZmlyc3QgYmxvY2sncyByb290XG5cbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHtcbiAgICAgICAgcm9vdFt1XSA9IHU7XG4gICAgICAgIGFsaWduW3VdID0gdTtcbiAgICAgICAgcG9zW3VdID0gaTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgdmFyIHByZXZJZHggPSAtMTtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgICB2YXIgcmVsYXRlZCA9IGdbcmVsYXRpb25zaGlwXSh2KSwgLy8gQWRqYWNlbnQgbm9kZXMgZnJvbSB0aGUgcHJldmlvdXMgbGF5ZXJcbiAgICAgICAgICAgIG1pZDsgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSBtaWQgcG9pbnQgaW4gdGhlIHJlbGF0ZWQgYXJyYXlcblxuICAgICAgICBpZiAocmVsYXRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmVsYXRlZC5zb3J0KGZ1bmN0aW9uKHgsIHkpIHsgcmV0dXJuIHBvc1t4XSAtIHBvc1t5XTsgfSk7XG4gICAgICAgICAgbWlkID0gKHJlbGF0ZWQubGVuZ3RoIC0gMSkgLyAyO1xuICAgICAgICAgIHJlbGF0ZWQuc2xpY2UoTWF0aC5mbG9vcihtaWQpLCBNYXRoLmNlaWwobWlkKSArIDEpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgICAgICAgaWYgKGFsaWduW3ZdID09PSB2KSB7XG4gICAgICAgICAgICAgIGlmICghY29uZmxpY3RzW3VuZGlyRWRnZUlkKHUsIHYpXSAmJiBwcmV2SWR4IDwgcG9zW3VdKSB7XG4gICAgICAgICAgICAgICAgYWxpZ25bdV0gPSB2O1xuICAgICAgICAgICAgICAgIGFsaWduW3ZdID0gcm9vdFt2XSA9IHJvb3RbdV07XG4gICAgICAgICAgICAgICAgcHJldklkeCA9IHBvc1t1XTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7IHBvczogcG9zLCByb290OiByb290LCBhbGlnbjogYWxpZ24gfTtcbiAgfVxuXG4gIC8vIFRoaXMgZnVuY3Rpb24gZGV2aWF0ZXMgZnJvbSB0aGUgc3RhbmRhcmQgQksgYWxnb3JpdGhtIGluIHR3byB3YXlzLiBGaXJzdFxuICAvLyBpdCB0YWtlcyBpbnRvIGFjY291bnQgdGhlIHNpemUgb2YgdGhlIG5vZGVzLiBTZWNvbmQgaXQgaW5jbHVkZXMgYSBmaXggdG9cbiAgLy8gdGhlIG9yaWdpbmFsIGFsZ29yaXRobSB0aGF0IGlzIGRlc2NyaWJlZCBpbiBDYXJzdGVucywgXCJOb2RlIGFuZCBMYWJlbFxuICAvLyBQbGFjZW1lbnQgaW4gYSBMYXllcmVkIExheW91dCBBbGdvcml0aG1cIi5cbiAgZnVuY3Rpb24gaG9yaXpvbnRhbENvbXBhY3Rpb24oZywgbGF5ZXJpbmcsIHBvcywgcm9vdCwgYWxpZ24pIHtcbiAgICB2YXIgc2luayA9IHt9LCAgICAgICAvLyBNYXBwaW5nIG9mIG5vZGUgaWQgLT4gc2luayBub2RlIGlkIGZvciBjbGFzc1xuICAgICAgICBtYXliZVNoaWZ0ID0ge30sIC8vIE1hcHBpbmcgb2Ygc2luayBub2RlIGlkIC0+IHsgY2xhc3Mgbm9kZSBpZCwgbWluIHNoaWZ0IH1cbiAgICAgICAgc2hpZnQgPSB7fSwgICAgICAvLyBNYXBwaW5nIG9mIHNpbmsgbm9kZSBpZCAtPiBzaGlmdFxuICAgICAgICBwcmVkID0ge30sICAgICAgIC8vIE1hcHBpbmcgb2Ygbm9kZSBpZCAtPiBwcmVkZWNlc3NvciBub2RlIChvciBudWxsKVxuICAgICAgICB4cyA9IHt9OyAgICAgICAgIC8vIENhbGN1bGF0ZWQgWCBwb3NpdGlvbnNcblxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odSwgaSkge1xuICAgICAgICBzaW5rW3VdID0gdTtcbiAgICAgICAgbWF5YmVTaGlmdFt1XSA9IHt9O1xuICAgICAgICBpZiAoaSA+IDApXG4gICAgICAgICAgcHJlZFt1XSA9IGxheWVyW2kgLSAxXTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gdXBkYXRlU2hpZnQodG9TaGlmdCwgbmVpZ2hib3IsIGRlbHRhKSB7XG4gICAgICBpZiAoIShuZWlnaGJvciBpbiBtYXliZVNoaWZ0W3RvU2hpZnRdKSkge1xuICAgICAgICBtYXliZVNoaWZ0W3RvU2hpZnRdW25laWdoYm9yXSA9IGRlbHRhO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWF5YmVTaGlmdFt0b1NoaWZ0XVtuZWlnaGJvcl0gPSBNYXRoLm1pbihtYXliZVNoaWZ0W3RvU2hpZnRdW25laWdoYm9yXSwgZGVsdGEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBsYWNlQmxvY2sodikge1xuICAgICAgaWYgKCEodiBpbiB4cykpIHtcbiAgICAgICAgeHNbdl0gPSAwO1xuICAgICAgICB2YXIgdyA9IHY7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICBpZiAocG9zW3ddID4gMCkge1xuICAgICAgICAgICAgdmFyIHUgPSByb290W3ByZWRbd11dO1xuICAgICAgICAgICAgcGxhY2VCbG9jayh1KTtcbiAgICAgICAgICAgIGlmIChzaW5rW3ZdID09PSB2KSB7XG4gICAgICAgICAgICAgIHNpbmtbdl0gPSBzaW5rW3VdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGRlbHRhID0gc2VwKGcsIHByZWRbd10pICsgc2VwKGcsIHcpO1xuICAgICAgICAgICAgaWYgKHNpbmtbdl0gIT09IHNpbmtbdV0pIHtcbiAgICAgICAgICAgICAgdXBkYXRlU2hpZnQoc2lua1t1XSwgc2lua1t2XSwgeHNbdl0gLSB4c1t1XSAtIGRlbHRhKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHhzW3ZdID0gTWF0aC5tYXgoeHNbdl0sIHhzW3VdICsgZGVsdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB3ID0gYWxpZ25bd107XG4gICAgICAgIH0gd2hpbGUgKHcgIT09IHYpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJvb3QgY29vcmRpbmF0ZXMgcmVsYXRpdmUgdG8gc2lua1xuICAgIHV0aWwudmFsdWVzKHJvb3QpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgcGxhY2VCbG9jayh2KTtcbiAgICB9KTtcblxuICAgIC8vIEFic29sdXRlIGNvb3JkaW5hdGVzXG4gICAgLy8gVGhlcmUgaXMgYW4gYXNzdW1wdGlvbiBoZXJlIHRoYXQgd2UndmUgcmVzb2x2ZWQgc2hpZnRzIGZvciBhbnkgY2xhc3Nlc1xuICAgIC8vIHRoYXQgYmVnaW4gYXQgYW4gZWFybGllciBsYXllci4gV2UgZ3VhcmFudGVlIHRoaXMgYnkgdmlzaXRpbmcgbGF5ZXJzIGluXG4gICAgLy8gb3JkZXIuXG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgIHhzW3ZdID0geHNbcm9vdFt2XV07XG4gICAgICAgIGlmICh2ID09PSByb290W3ZdICYmIHYgPT09IHNpbmtbdl0pIHtcbiAgICAgICAgICB2YXIgbWluU2hpZnQgPSAwO1xuICAgICAgICAgIGlmICh2IGluIG1heWJlU2hpZnQgJiYgT2JqZWN0LmtleXMobWF5YmVTaGlmdFt2XSkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbWluU2hpZnQgPSB1dGlsLm1pbihPYmplY3Qua2V5cyhtYXliZVNoaWZ0W3ZdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbih1KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXliZVNoaWZ0W3ZdW3VdICsgKHUgaW4gc2hpZnQgPyBzaGlmdFt1XSA6IDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2hpZnRbdl0gPSBtaW5TaGlmdDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgeHNbdl0gKz0gc2hpZnRbc2lua1tyb290W3ZdXV0gfHwgMDtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHhzO1xuICB9XG5cbiAgZnVuY3Rpb24gZmluZE1pbkNvb3JkKGcsIGxheWVyaW5nLCB4cykge1xuICAgIHJldHVybiB1dGlsLm1pbihsYXllcmluZy5tYXAoZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIHZhciB1ID0gbGF5ZXJbMF07XG4gICAgICByZXR1cm4geHNbdV07XG4gICAgfSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmluZE1heENvb3JkKGcsIGxheWVyaW5nLCB4cykge1xuICAgIHJldHVybiB1dGlsLm1heChsYXllcmluZy5tYXAoZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIHZhciB1ID0gbGF5ZXJbbGF5ZXIubGVuZ3RoIC0gMV07XG4gICAgICByZXR1cm4geHNbdV07XG4gICAgfSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gYmFsYW5jZShnLCBsYXllcmluZywgeHNzKSB7XG4gICAgdmFyIG1pbiA9IHt9LCAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNaW4gY29vcmRpbmF0ZSBmb3IgdGhlIGFsaWdubWVudFxuICAgICAgICBtYXggPSB7fSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWF4IGNvb3JkaW5hdGUgZm9yIHRoZSBhbGdpbm1lbnRcbiAgICAgICAgc21hbGxlc3RBbGlnbm1lbnQsXG4gICAgICAgIHNoaWZ0ID0ge307ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbW91bnQgdG8gc2hpZnQgYSBnaXZlbiBhbGlnbm1lbnRcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUFsaWdubWVudCh2KSB7XG4gICAgICB4c3NbYWxpZ25tZW50XVt2XSArPSBzaGlmdFthbGlnbm1lbnRdO1xuICAgIH1cblxuICAgIHZhciBzbWFsbGVzdCA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICBmb3IgKHZhciBhbGlnbm1lbnQgaW4geHNzKSB7XG4gICAgICB2YXIgeHMgPSB4c3NbYWxpZ25tZW50XTtcbiAgICAgIG1pblthbGlnbm1lbnRdID0gZmluZE1pbkNvb3JkKGcsIGxheWVyaW5nLCB4cyk7XG4gICAgICBtYXhbYWxpZ25tZW50XSA9IGZpbmRNYXhDb29yZChnLCBsYXllcmluZywgeHMpO1xuICAgICAgdmFyIHcgPSBtYXhbYWxpZ25tZW50XSAtIG1pblthbGlnbm1lbnRdO1xuICAgICAgaWYgKHcgPCBzbWFsbGVzdCkge1xuICAgICAgICBzbWFsbGVzdCA9IHc7XG4gICAgICAgIHNtYWxsZXN0QWxpZ25tZW50ID0gYWxpZ25tZW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIERldGVybWluZSBob3cgbXVjaCB0byBhZGp1c3QgcG9zaXRpb25pbmcgZm9yIGVhY2ggYWxpZ25tZW50XG4gICAgWyd1JywgJ2QnXS5mb3JFYWNoKGZ1bmN0aW9uKHZlcnREaXIpIHtcbiAgICAgIFsnbCcsICdyJ10uZm9yRWFjaChmdW5jdGlvbihob3JpekRpcikge1xuICAgICAgICB2YXIgYWxpZ25tZW50ID0gdmVydERpciArIGhvcml6RGlyO1xuICAgICAgICBzaGlmdFthbGlnbm1lbnRdID0gaG9yaXpEaXIgPT09ICdsJ1xuICAgICAgICAgICAgPyBtaW5bc21hbGxlc3RBbGlnbm1lbnRdIC0gbWluW2FsaWdubWVudF1cbiAgICAgICAgICAgIDogbWF4W3NtYWxsZXN0QWxpZ25tZW50XSAtIG1heFthbGlnbm1lbnRdO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBGaW5kIGF2ZXJhZ2Ugb2YgbWVkaWFucyBmb3IgeHNzIGFycmF5XG4gICAgZm9yIChhbGlnbm1lbnQgaW4geHNzKSB7XG4gICAgICBnLmVhY2hOb2RlKHVwZGF0ZUFsaWdubWVudCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZmxpcEhvcml6b250YWxseSh4cykge1xuICAgIGZvciAodmFyIHUgaW4geHMpIHtcbiAgICAgIHhzW3VdID0gLXhzW3VdO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJldmVyc2VJbm5lck9yZGVyKGxheWVyaW5nKSB7XG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgbGF5ZXIucmV2ZXJzZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gd2lkdGgoZywgdSkge1xuICAgIHN3aXRjaCAoZy5ncmFwaCgpLnJhbmtEaXIpIHtcbiAgICAgIGNhc2UgJ0xSJzogcmV0dXJuIGcubm9kZSh1KS5oZWlnaHQ7XG4gICAgICBjYXNlICdSTCc6IHJldHVybiBnLm5vZGUodSkuaGVpZ2h0O1xuICAgICAgZGVmYXVsdDogICByZXR1cm4gZy5ub2RlKHUpLndpZHRoO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhlaWdodChnLCB1KSB7XG4gICAgc3dpdGNoKGcuZ3JhcGgoKS5yYW5rRGlyKSB7XG4gICAgICBjYXNlICdMUic6IHJldHVybiBnLm5vZGUodSkud2lkdGg7XG4gICAgICBjYXNlICdSTCc6IHJldHVybiBnLm5vZGUodSkud2lkdGg7XG4gICAgICBkZWZhdWx0OiAgIHJldHVybiBnLm5vZGUodSkuaGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNlcChnLCB1KSB7XG4gICAgaWYgKGNvbmZpZy51bml2ZXJzYWxTZXAgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBjb25maWcudW5pdmVyc2FsU2VwO1xuICAgIH1cbiAgICB2YXIgdyA9IHdpZHRoKGcsIHUpO1xuICAgIHZhciBzID0gZy5ub2RlKHUpLmR1bW15ID8gY29uZmlnLmVkZ2VTZXAgOiBjb25maWcubm9kZVNlcDtcbiAgICByZXR1cm4gKHcgKyBzKSAvIDI7XG4gIH1cblxuICBmdW5jdGlvbiBwb3NYKGcsIHUsIHgpIHtcbiAgICBpZiAoZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdMUicgfHwgZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdSTCcpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpLnk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSkueSA9IHg7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpLng7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSkueCA9IHg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcG9zWERlYnVnKG5hbWUsIGcsIHUsIHgpIHtcbiAgICBpZiAoZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdMUicgfHwgZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdSTCcpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpW25hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpW25hbWVdID0geDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSlbbmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSlbbmFtZV0gPSB4O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc1koZywgdSwgeSkge1xuICAgIGlmIChnLmdyYXBoKCkucmFua0RpciA9PT0gJ0xSJyB8fCBnLmdyYXBoKCkucmFua0RpciA9PT0gJ1JMJykge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSkueDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KS54ID0geTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSkueTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KS55ID0geTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWJ1Z1Bvc2l0aW9uaW5nKGFsaWduLCBnLCBsYXllcmluZywgeHMpIHtcbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGwsIGxpKSB7XG4gICAgICB2YXIgdSwgeFU7XG4gICAgICBsLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgICB2YXIgeFYgPSB4c1t2XTtcbiAgICAgICAgaWYgKHUpIHtcbiAgICAgICAgICB2YXIgcyA9IHNlcChnLCB1KSArIHNlcChnLCB2KTtcbiAgICAgICAgICBpZiAoeFYgLSB4VSA8IHMpXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUG9zaXRpb24gcGhhc2U6IHNlcCB2aW9sYXRpb24uIEFsaWduOiAnICsgYWxpZ24gKyAnLiBMYXllcjogJyArIGxpICsgJy4gJyArXG4gICAgICAgICAgICAgICdVOiAnICsgdSArICcgVjogJyArIHYgKyAnLiBBY3R1YWwgc2VwOiAnICsgKHhWIC0geFUpICsgJyBFeHBlY3RlZCBzZXA6ICcgKyBzKTtcbiAgICAgICAgfVxuICAgICAgICB1ID0gdjtcbiAgICAgICAgeFUgPSB4VjtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59O1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBhY3ljbGljID0gcmVxdWlyZSgnLi9yYW5rL2FjeWNsaWMnKSxcbiAgICBpbml0UmFuayA9IHJlcXVpcmUoJy4vcmFuay9pbml0UmFuaycpLFxuICAgIGZlYXNpYmxlVHJlZSA9IHJlcXVpcmUoJy4vcmFuay9mZWFzaWJsZVRyZWUnKSxcbiAgICBjb25zdHJhaW50cyA9IHJlcXVpcmUoJy4vcmFuay9jb25zdHJhaW50cycpLFxuICAgIHNpbXBsZXggPSByZXF1aXJlKCcuL3Jhbmsvc2ltcGxleCcpLFxuICAgIGNvbXBvbmVudHMgPSByZXF1aXJlKCdncmFwaGxpYicpLmFsZy5jb21wb25lbnRzLFxuICAgIGZpbHRlciA9IHJlcXVpcmUoJ2dyYXBobGliJykuZmlsdGVyO1xuXG5leHBvcnRzLnJ1biA9IHJ1bjtcbmV4cG9ydHMucmVzdG9yZUVkZ2VzID0gcmVzdG9yZUVkZ2VzO1xuXG4vKlxuICogSGV1cmlzdGljIGZ1bmN0aW9uIHRoYXQgYXNzaWducyBhIHJhbmsgdG8gZWFjaCBub2RlIG9mIHRoZSBpbnB1dCBncmFwaCB3aXRoXG4gKiB0aGUgaW50ZW50IG9mIG1pbmltaXppbmcgZWRnZSBsZW5ndGhzLCB3aGlsZSByZXNwZWN0aW5nIHRoZSBgbWluTGVuYFxuICogYXR0cmlidXRlIG9mIGluY2lkZW50IGVkZ2VzLlxuICpcbiAqIFByZXJlcXVpc2l0ZXM6XG4gKlxuICogICogRWFjaCBlZGdlIGluIHRoZSBpbnB1dCBncmFwaCBtdXN0IGhhdmUgYW4gYXNzaWduZWQgJ21pbkxlbicgYXR0cmlidXRlXG4gKi9cbmZ1bmN0aW9uIHJ1bihnLCB1c2VTaW1wbGV4KSB7XG4gIGV4cGFuZFNlbGZMb29wcyhnKTtcblxuICAvLyBJZiB0aGVyZSBhcmUgcmFuayBjb25zdHJhaW50cyBvbiBub2RlcywgdGhlbiBidWlsZCBhIG5ldyBncmFwaCB0aGF0XG4gIC8vIGVuY29kZXMgdGhlIGNvbnN0cmFpbnRzLlxuICB1dGlsLnRpbWUoJ2NvbnN0cmFpbnRzLmFwcGx5JywgY29uc3RyYWludHMuYXBwbHkpKGcpO1xuXG4gIGV4cGFuZFNpZGV3YXlzRWRnZXMoZyk7XG5cbiAgLy8gUmV2ZXJzZSBlZGdlcyB0byBnZXQgYW4gYWN5Y2xpYyBncmFwaCwgd2Uga2VlcCB0aGUgZ3JhcGggaW4gYW4gYWN5Y2xpY1xuICAvLyBzdGF0ZSB1bnRpbCB0aGUgdmVyeSBlbmQuXG4gIHV0aWwudGltZSgnYWN5Y2xpYycsIGFjeWNsaWMpKGcpO1xuXG4gIC8vIENvbnZlcnQgdGhlIGdyYXBoIGludG8gYSBmbGF0IGdyYXBoIGZvciByYW5raW5nXG4gIHZhciBmbGF0R3JhcGggPSBnLmZpbHRlck5vZGVzKHV0aWwuZmlsdGVyTm9uU3ViZ3JhcGhzKGcpKTtcblxuICAvLyBBc3NpZ24gYW4gaW5pdGlhbCByYW5raW5nIHVzaW5nIERGUy5cbiAgaW5pdFJhbmsoZmxhdEdyYXBoKTtcblxuICAvLyBGb3IgZWFjaCBjb21wb25lbnQgaW1wcm92ZSB0aGUgYXNzaWduZWQgcmFua3MuXG4gIGNvbXBvbmVudHMoZmxhdEdyYXBoKS5mb3JFYWNoKGZ1bmN0aW9uKGNtcHQpIHtcbiAgICB2YXIgc3ViZ3JhcGggPSBmbGF0R3JhcGguZmlsdGVyTm9kZXMoZmlsdGVyLm5vZGVzRnJvbUxpc3QoY21wdCkpO1xuICAgIHJhbmtDb21wb25lbnQoc3ViZ3JhcGgsIHVzZVNpbXBsZXgpO1xuICB9KTtcblxuICAvLyBSZWxheCBvcmlnaW5hbCBjb25zdHJhaW50c1xuICB1dGlsLnRpbWUoJ2NvbnN0cmFpbnRzLnJlbGF4JywgY29uc3RyYWludHMucmVsYXgoZykpO1xuXG4gIC8vIFdoZW4gaGFuZGxpbmcgbm9kZXMgd2l0aCBjb25zdHJhaW5lZCByYW5rcyBpdCBpcyBwb3NzaWJsZSB0byBlbmQgdXAgd2l0aFxuICAvLyBlZGdlcyB0aGF0IHBvaW50IHRvIHByZXZpb3VzIHJhbmtzLiBNb3N0IG9mIHRoZSBzdWJzZXF1ZW50IGFsZ29yaXRobXMgYXNzdW1lXG4gIC8vIHRoYXQgZWRnZXMgYXJlIHBvaW50aW5nIHRvIHN1Y2Nlc3NpdmUgcmFua3Mgb25seS4gSGVyZSB3ZSByZXZlcnNlIGFueSBcImJhY2tcbiAgLy8gZWRnZXNcIiBhbmQgbWFyayB0aGVtIGFzIHN1Y2guIFRoZSBhY3ljbGljIGFsZ29yaXRobSB3aWxsIHJldmVyc2UgdGhlbSBhcyBhXG4gIC8vIHBvc3QgcHJvY2Vzc2luZyBzdGVwLlxuICB1dGlsLnRpbWUoJ3Jlb3JpZW50RWRnZXMnLCByZW9yaWVudEVkZ2VzKShnKTtcbn1cblxuZnVuY3Rpb24gcmVzdG9yZUVkZ2VzKGcpIHtcbiAgYWN5Y2xpYy51bmRvKGcpO1xufVxuXG4vKlxuICogRXhwYW5kIHNlbGYgbG9vcHMgaW50byB0aHJlZSBkdW1teSBub2Rlcy4gT25lIHdpbGwgc2l0IGFib3ZlIHRoZSBpbmNpZGVudFxuICogbm9kZSwgb25lIHdpbGwgYmUgYXQgdGhlIHNhbWUgbGV2ZWwsIGFuZCBvbmUgYmVsb3cuIFRoZSByZXN1bHQgbG9va3MgbGlrZTpcbiAqXG4gKiAgICAgICAgIC8tLTwtLXgtLS0+LS1cXFxuICogICAgIG5vZGUgICAgICAgICAgICAgIHlcbiAqICAgICAgICAgXFwtLTwtLXotLS0+LS0vXG4gKlxuICogRHVtbXkgbm9kZXMgeCwgeSwgeiBnaXZlIHVzIHRoZSBzaGFwZSBvZiBhIGxvb3AgYW5kIG5vZGUgeSBpcyB3aGVyZSB3ZSBwbGFjZVxuICogdGhlIGxhYmVsLlxuICpcbiAqIFRPRE86IGNvbnNvbGlkYXRlIGtub3dsZWRnZSBvZiBkdW1teSBub2RlIGNvbnN0cnVjdGlvbi5cbiAqIFRPRE86IHN1cHBvcnQgbWluTGVuID0gMlxuICovXG5mdW5jdGlvbiBleHBhbmRTZWxmTG9vcHMoZykge1xuICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIGEpIHtcbiAgICBpZiAodSA9PT0gdikge1xuICAgICAgdmFyIHggPSBhZGREdW1teU5vZGUoZywgZSwgdSwgdiwgYSwgMCwgZmFsc2UpLFxuICAgICAgICAgIHkgPSBhZGREdW1teU5vZGUoZywgZSwgdSwgdiwgYSwgMSwgdHJ1ZSksXG4gICAgICAgICAgeiA9IGFkZER1bW15Tm9kZShnLCBlLCB1LCB2LCBhLCAyLCBmYWxzZSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgeCwgdSwge21pbkxlbjogMSwgc2VsZkxvb3A6IHRydWV9KTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB4LCB5LCB7bWluTGVuOiAxLCBzZWxmTG9vcDogdHJ1ZX0pO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHosIHttaW5MZW46IDEsIHNlbGZMb29wOiB0cnVlfSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgeSwgeiwge21pbkxlbjogMSwgc2VsZkxvb3A6IHRydWV9KTtcbiAgICAgIGcuZGVsRWRnZShlKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBleHBhbmRTaWRld2F5c0VkZ2VzKGcpIHtcbiAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCBhKSB7XG4gICAgaWYgKHUgPT09IHYpIHtcbiAgICAgIHZhciBvcmlnRWRnZSA9IGEub3JpZ2luYWxFZGdlLFxuICAgICAgICAgIGR1bW15ID0gYWRkRHVtbXlOb2RlKGcsIG9yaWdFZGdlLmUsIG9yaWdFZGdlLnUsIG9yaWdFZGdlLnYsIG9yaWdFZGdlLnZhbHVlLCAwLCB0cnVlKTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCBkdW1teSwge21pbkxlbjogMX0pO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIGR1bW15LCB2LCB7bWluTGVuOiAxfSk7XG4gICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gYWRkRHVtbXlOb2RlKGcsIGUsIHUsIHYsIGEsIGluZGV4LCBpc0xhYmVsKSB7XG4gIHJldHVybiBnLmFkZE5vZGUobnVsbCwge1xuICAgIHdpZHRoOiBpc0xhYmVsID8gYS53aWR0aCA6IDAsXG4gICAgaGVpZ2h0OiBpc0xhYmVsID8gYS5oZWlnaHQgOiAwLFxuICAgIGVkZ2U6IHsgaWQ6IGUsIHNvdXJjZTogdSwgdGFyZ2V0OiB2LCBhdHRyczogYSB9LFxuICAgIGR1bW15OiB0cnVlLFxuICAgIGluZGV4OiBpbmRleFxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVvcmllbnRFZGdlcyhnKSB7XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBpZiAoZy5ub2RlKHUpLnJhbmsgPiBnLm5vZGUodikucmFuaykge1xuICAgICAgZy5kZWxFZGdlKGUpO1xuICAgICAgdmFsdWUucmV2ZXJzZWQgPSB0cnVlO1xuICAgICAgZy5hZGRFZGdlKGUsIHYsIHUsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByYW5rQ29tcG9uZW50KHN1YmdyYXBoLCB1c2VTaW1wbGV4KSB7XG4gIHZhciBzcGFubmluZ1RyZWUgPSBmZWFzaWJsZVRyZWUoc3ViZ3JhcGgpO1xuXG4gIGlmICh1c2VTaW1wbGV4KSB7XG4gICAgdXRpbC5sb2coMSwgJ1VzaW5nIG5ldHdvcmsgc2ltcGxleCBmb3IgcmFua2luZycpO1xuICAgIHNpbXBsZXgoc3ViZ3JhcGgsIHNwYW5uaW5nVHJlZSk7XG4gIH1cbiAgbm9ybWFsaXplKHN1YmdyYXBoKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplKGcpIHtcbiAgdmFyIG0gPSB1dGlsLm1pbihnLm5vZGVzKCkubWFwKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGcubm9kZSh1KS5yYW5rOyB9KSk7XG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgbm9kZSkgeyBub2RlLnJhbmsgLT0gbTsgfSk7XG59XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBhY3ljbGljO1xubW9kdWxlLmV4cG9ydHMudW5kbyA9IHVuZG87XG5cbi8qXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGEgZGlyZWN0ZWQgZ3JhcGggdGhhdCBtYXkgaGF2ZSBjeWNsZXMgYW5kIHJldmVyc2VzIGVkZ2VzXG4gKiBhcyBhcHByb3ByaWF0ZSB0byBicmVhayB0aGVzZSBjeWNsZXMuIEVhY2ggcmV2ZXJzZWQgZWRnZSBpcyBhc3NpZ25lZCBhXG4gKiBgcmV2ZXJzZWRgIGF0dHJpYnV0ZSB3aXRoIHRoZSB2YWx1ZSBgdHJ1ZWAuXG4gKlxuICogVGhlcmUgc2hvdWxkIGJlIG5vIHNlbGYgbG9vcHMgaW4gdGhlIGdyYXBoLlxuICovXG5mdW5jdGlvbiBhY3ljbGljKGcpIHtcbiAgdmFyIG9uU3RhY2sgPSB7fSxcbiAgICAgIHZpc2l0ZWQgPSB7fSxcbiAgICAgIHJldmVyc2VDb3VudCA9IDA7XG4gIFxuICBmdW5jdGlvbiBkZnModSkge1xuICAgIGlmICh1IGluIHZpc2l0ZWQpIHJldHVybjtcbiAgICB2aXNpdGVkW3VdID0gb25TdGFja1t1XSA9IHRydWU7XG4gICAgZy5vdXRFZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHZhciB0ID0gZy50YXJnZXQoZSksXG4gICAgICAgICAgdmFsdWU7XG5cbiAgICAgIGlmICh1ID09PSB0KSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1dhcm5pbmc6IGZvdW5kIHNlbGYgbG9vcCBcIicgKyBlICsgJ1wiIGZvciBub2RlIFwiJyArIHUgKyAnXCInKTtcbiAgICAgIH0gZWxzZSBpZiAodCBpbiBvblN0YWNrKSB7XG4gICAgICAgIHZhbHVlID0gZy5lZGdlKGUpO1xuICAgICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgICAgIHZhbHVlLnJldmVyc2VkID0gdHJ1ZTtcbiAgICAgICAgKytyZXZlcnNlQ291bnQ7XG4gICAgICAgIGcuYWRkRWRnZShlLCB0LCB1LCB2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZnModCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWxldGUgb25TdGFja1t1XTtcbiAgfVxuXG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkgeyBkZnModSk7IH0pO1xuXG4gIHV0aWwubG9nKDIsICdBY3ljbGljIFBoYXNlOiByZXZlcnNlZCAnICsgcmV2ZXJzZUNvdW50ICsgJyBlZGdlKHMpJyk7XG5cbiAgcmV0dXJuIHJldmVyc2VDb3VudDtcbn1cblxuLypcbiAqIEdpdmVuIGEgZ3JhcGggdGhhdCBoYXMgaGFkIHRoZSBhY3ljbGljIG9wZXJhdGlvbiBhcHBsaWVkLCB0aGlzIGZ1bmN0aW9uXG4gKiB1bmRvZXMgdGhhdCBvcGVyYXRpb24uIE1vcmUgc3BlY2lmaWNhbGx5LCBhbnkgZWRnZSB3aXRoIHRoZSBgcmV2ZXJzZWRgXG4gKiBhdHRyaWJ1dGUgaXMgYWdhaW4gcmV2ZXJzZWQgdG8gcmVzdG9yZSB0aGUgb3JpZ2luYWwgZGlyZWN0aW9uIG9mIHRoZSBlZGdlLlxuICovXG5mdW5jdGlvbiB1bmRvKGcpIHtcbiAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCBzLCB0LCBhKSB7XG4gICAgaWYgKGEucmV2ZXJzZWQpIHtcbiAgICAgIGRlbGV0ZSBhLnJldmVyc2VkO1xuICAgICAgZy5kZWxFZGdlKGUpO1xuICAgICAgZy5hZGRFZGdlKGUsIHQsIHMsIGEpO1xuICAgIH1cbiAgfSk7XG59XG4iLCJleHBvcnRzLmFwcGx5ID0gZnVuY3Rpb24oZykge1xuICBmdW5jdGlvbiBkZnMoc2cpIHtcbiAgICB2YXIgcmFua1NldHMgPSB7fTtcbiAgICBnLmNoaWxkcmVuKHNnKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIGlmIChnLmNoaWxkcmVuKHUpLmxlbmd0aCkge1xuICAgICAgICBkZnModSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHZhbHVlID0gZy5ub2RlKHUpLFxuICAgICAgICAgIHByZWZSYW5rID0gdmFsdWUucHJlZlJhbms7XG4gICAgICBpZiAocHJlZlJhbmsgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoIWNoZWNrU3VwcG9ydGVkUHJlZlJhbmsocHJlZlJhbmspKSB7IHJldHVybjsgfVxuXG4gICAgICAgIGlmICghKHByZWZSYW5rIGluIHJhbmtTZXRzKSkge1xuICAgICAgICAgIHJhbmtTZXRzLnByZWZSYW5rID0gW3VdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJhbmtTZXRzLnByZWZSYW5rLnB1c2godSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbmV3VSA9IHJhbmtTZXRzW3ByZWZSYW5rXTtcbiAgICAgICAgaWYgKG5ld1UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIG5ld1UgPSByYW5rU2V0c1twcmVmUmFua10gPSBnLmFkZE5vZGUobnVsbCwgeyBvcmlnaW5hbE5vZGVzOiBbXSB9KTtcbiAgICAgICAgICBnLnBhcmVudChuZXdVLCBzZyk7XG4gICAgICAgIH1cblxuICAgICAgICByZWRpcmVjdEluRWRnZXMoZywgdSwgbmV3VSwgcHJlZlJhbmsgPT09ICdtaW4nKTtcbiAgICAgICAgcmVkaXJlY3RPdXRFZGdlcyhnLCB1LCBuZXdVLCBwcmVmUmFuayA9PT0gJ21heCcpO1xuXG4gICAgICAgIC8vIFNhdmUgb3JpZ2luYWwgbm9kZSBhbmQgcmVtb3ZlIGl0IGZyb20gcmVkdWNlZCBncmFwaFxuICAgICAgICBnLm5vZGUobmV3VSkub3JpZ2luYWxOb2Rlcy5wdXNoKHsgdTogdSwgdmFsdWU6IHZhbHVlLCBwYXJlbnQ6IHNnIH0pO1xuICAgICAgICBnLmRlbE5vZGUodSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhZGRMaWdodEVkZ2VzRnJvbU1pbk5vZGUoZywgc2csIHJhbmtTZXRzLm1pbik7XG4gICAgYWRkTGlnaHRFZGdlc1RvTWF4Tm9kZShnLCBzZywgcmFua1NldHMubWF4KTtcbiAgfVxuXG4gIGRmcyhudWxsKTtcbn07XG5cbmZ1bmN0aW9uIGNoZWNrU3VwcG9ydGVkUHJlZlJhbmsocHJlZlJhbmspIHtcbiAgaWYgKHByZWZSYW5rICE9PSAnbWluJyAmJiBwcmVmUmFuayAhPT0gJ21heCcgJiYgcHJlZlJhbmsuaW5kZXhPZignc2FtZV8nKSAhPT0gMCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1Vuc3VwcG9ydGVkIHJhbmsgdHlwZTogJyArIHByZWZSYW5rKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHJlZGlyZWN0SW5FZGdlcyhnLCB1LCBuZXdVLCByZXZlcnNlKSB7XG4gIGcuaW5FZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgb3JpZ1ZhbHVlID0gZy5lZGdlKGUpLFxuICAgICAgICB2YWx1ZTtcbiAgICBpZiAob3JpZ1ZhbHVlLm9yaWdpbmFsRWRnZSkge1xuICAgICAgdmFsdWUgPSBvcmlnVmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gIHtcbiAgICAgICAgb3JpZ2luYWxFZGdlOiB7IGU6IGUsIHU6IGcuc291cmNlKGUpLCB2OiBnLnRhcmdldChlKSwgdmFsdWU6IG9yaWdWYWx1ZSB9LFxuICAgICAgICBtaW5MZW46IGcuZWRnZShlKS5taW5MZW5cbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRG8gbm90IHJldmVyc2UgZWRnZXMgZm9yIHNlbGYtbG9vcHMuXG4gICAgaWYgKG9yaWdWYWx1ZS5zZWxmTG9vcCkge1xuICAgICAgcmV2ZXJzZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChyZXZlcnNlKSB7XG4gICAgICAvLyBFbnN1cmUgdGhhdCBhbGwgZWRnZXMgdG8gbWluIGFyZSByZXZlcnNlZFxuICAgICAgZy5hZGRFZGdlKG51bGwsIG5ld1UsIGcuc291cmNlKGUpLCB2YWx1ZSk7XG4gICAgICB2YWx1ZS5yZXZlcnNlZCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCBnLnNvdXJjZShlKSwgbmV3VSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlZGlyZWN0T3V0RWRnZXMoZywgdSwgbmV3VSwgcmV2ZXJzZSkge1xuICBnLm91dEVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgIHZhciBvcmlnVmFsdWUgPSBnLmVkZ2UoZSksXG4gICAgICAgIHZhbHVlO1xuICAgIGlmIChvcmlnVmFsdWUub3JpZ2luYWxFZGdlKSB7XG4gICAgICB2YWx1ZSA9IG9yaWdWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSAge1xuICAgICAgICBvcmlnaW5hbEVkZ2U6IHsgZTogZSwgdTogZy5zb3VyY2UoZSksIHY6IGcudGFyZ2V0KGUpLCB2YWx1ZTogb3JpZ1ZhbHVlIH0sXG4gICAgICAgIG1pbkxlbjogZy5lZGdlKGUpLm1pbkxlblxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEbyBub3QgcmV2ZXJzZSBlZGdlcyBmb3Igc2VsZi1sb29wcy5cbiAgICBpZiAob3JpZ1ZhbHVlLnNlbGZMb29wKSB7XG4gICAgICByZXZlcnNlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHJldmVyc2UpIHtcbiAgICAgIC8vIEVuc3VyZSB0aGF0IGFsbCBlZGdlcyBmcm9tIG1heCBhcmUgcmV2ZXJzZWRcbiAgICAgIGcuYWRkRWRnZShudWxsLCBnLnRhcmdldChlKSwgbmV3VSwgdmFsdWUpO1xuICAgICAgdmFsdWUucmV2ZXJzZWQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgbmV3VSwgZy50YXJnZXQoZSksIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhZGRMaWdodEVkZ2VzRnJvbU1pbk5vZGUoZywgc2csIG1pbk5vZGUpIHtcbiAgaWYgKG1pbk5vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgIGcuY2hpbGRyZW4oc2cpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgLy8gVGhlIGR1bW15IGNoZWNrIGVuc3VyZXMgd2UgZG9uJ3QgYWRkIGFuIGVkZ2UgaWYgdGhlIG5vZGUgaXMgaW52b2x2ZWRcbiAgICAgIC8vIGluIGEgc2VsZiBsb29wIG9yIHNpZGV3YXlzIGVkZ2UuXG4gICAgICBpZiAodSAhPT0gbWluTm9kZSAmJiAhZy5vdXRFZGdlcyhtaW5Ob2RlLCB1KS5sZW5ndGggJiYgIWcubm9kZSh1KS5kdW1teSkge1xuICAgICAgICBnLmFkZEVkZ2UobnVsbCwgbWluTm9kZSwgdSwgeyBtaW5MZW46IDAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkTGlnaHRFZGdlc1RvTWF4Tm9kZShnLCBzZywgbWF4Tm9kZSkge1xuICBpZiAobWF4Tm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZy5jaGlsZHJlbihzZykuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAvLyBUaGUgZHVtbXkgY2hlY2sgZW5zdXJlcyB3ZSBkb24ndCBhZGQgYW4gZWRnZSBpZiB0aGUgbm9kZSBpcyBpbnZvbHZlZFxuICAgICAgLy8gaW4gYSBzZWxmIGxvb3Agb3Igc2lkZXdheXMgZWRnZS5cbiAgICAgIGlmICh1ICE9PSBtYXhOb2RlICYmICFnLm91dEVkZ2VzKHUsIG1heE5vZGUpLmxlbmd0aCAmJiAhZy5ub2RlKHUpLmR1bW15KSB7XG4gICAgICAgIGcuYWRkRWRnZShudWxsLCB1LCBtYXhOb2RlLCB7IG1pbkxlbjogMCB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG4vKlxuICogVGhpcyBmdW5jdGlvbiBcInJlbGF4ZXNcIiB0aGUgY29uc3RyYWludHMgYXBwbGllZCBwcmV2aW91c2x5IGJ5IHRoZSBcImFwcGx5XCJcbiAqIGZ1bmN0aW9uLiBJdCBleHBhbmRzIGFueSBub2RlcyB0aGF0IHdlcmUgY29sbGFwc2VkIGFuZCBhc3NpZ25zIHRoZSByYW5rIG9mXG4gKiB0aGUgY29sbGFwc2VkIG5vZGUgdG8gZWFjaCBvZiB0aGUgZXhwYW5kZWQgbm9kZXMuIEl0IGFsc28gcmVzdG9yZXMgdGhlXG4gKiBvcmlnaW5hbCBlZGdlcyBhbmQgcmVtb3ZlcyBhbnkgZHVtbXkgZWRnZXMgcG9pbnRpbmcgYXQgdGhlIGNvbGxhcHNlZCBub2Rlcy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIHByb2Nlc3Mgb2YgcmVtb3ZpbmcgY29sbGFwc2VkIG5vZGVzIGFsc28gcmVtb3ZlcyBkdW1teSBlZGdlc1xuICogYXV0b21hdGljYWxseS5cbiAqL1xuZXhwb3J0cy5yZWxheCA9IGZ1bmN0aW9uKGcpIHtcbiAgLy8gU2F2ZSBvcmlnaW5hbCBlZGdlc1xuICB2YXIgb3JpZ2luYWxFZGdlcyA9IFtdO1xuICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgdmFyIG9yaWdpbmFsRWRnZSA9IHZhbHVlLm9yaWdpbmFsRWRnZTtcbiAgICBpZiAob3JpZ2luYWxFZGdlKSB7XG4gICAgICBvcmlnaW5hbEVkZ2VzLnB1c2gob3JpZ2luYWxFZGdlKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEV4cGFuZCBjb2xsYXBzZWQgbm9kZXNcbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIHZhciBvcmlnaW5hbE5vZGVzID0gdmFsdWUub3JpZ2luYWxOb2RlcztcbiAgICBpZiAob3JpZ2luYWxOb2Rlcykge1xuICAgICAgb3JpZ2luYWxOb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKG9yaWdpbmFsTm9kZSkge1xuICAgICAgICBvcmlnaW5hbE5vZGUudmFsdWUucmFuayA9IHZhbHVlLnJhbms7XG4gICAgICAgIGcuYWRkTm9kZShvcmlnaW5hbE5vZGUudSwgb3JpZ2luYWxOb2RlLnZhbHVlKTtcbiAgICAgICAgZy5wYXJlbnQob3JpZ2luYWxOb2RlLnUsIG9yaWdpbmFsTm9kZS5wYXJlbnQpO1xuICAgICAgfSk7XG4gICAgICBnLmRlbE5vZGUodSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBSZXN0b3JlIG9yaWdpbmFsIGVkZ2VzXG4gIG9yaWdpbmFsRWRnZXMuZm9yRWFjaChmdW5jdGlvbihlZGdlKSB7XG4gICAgZy5hZGRFZGdlKGVkZ2UuZSwgZWRnZS51LCBlZGdlLnYsIGVkZ2UudmFsdWUpO1xuICB9KTtcbn07XG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKCdjcC1kYXRhJykuU2V0LFxuLyoganNoaW50ICtXMDc5ICovXG4gICAgRGlncmFwaCA9IHJlcXVpcmUoJ2dyYXBobGliJykuRGlncmFwaCxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZlYXNpYmxlVHJlZTtcblxuLypcbiAqIEdpdmVuIGFuIGFjeWNsaWMgZ3JhcGggd2l0aCBlYWNoIG5vZGUgYXNzaWduZWQgYSBgcmFua2AgYXR0cmlidXRlLCB0aGlzXG4gKiBmdW5jdGlvbiBjb25zdHJ1Y3RzIGFuZCByZXR1cm5zIGEgc3Bhbm5pbmcgdHJlZS4gVGhpcyBmdW5jdGlvbiBtYXkgcmVkdWNlXG4gKiB0aGUgbGVuZ3RoIG9mIHNvbWUgZWRnZXMgZnJvbSB0aGUgaW5pdGlhbCByYW5rIGFzc2lnbm1lbnQgd2hpbGUgbWFpbnRhaW5pbmdcbiAqIHRoZSBgbWluTGVuYCBzcGVjaWZpZWQgYnkgZWFjaCBlZGdlLlxuICpcbiAqIFByZXJlcXVpc2l0ZXM6XG4gKlxuICogKiBUaGUgaW5wdXQgZ3JhcGggaXMgYWN5Y2xpY1xuICogKiBFYWNoIG5vZGUgaW4gdGhlIGlucHV0IGdyYXBoIGhhcyBhbiBhc3NpZ25lZCBgcmFua2AgYXR0cmlidXRlXG4gKiAqIEVhY2ggZWRnZSBpbiB0aGUgaW5wdXQgZ3JhcGggaGFzIGFuIGFzc2lnbmVkIGBtaW5MZW5gIGF0dHJpYnV0ZVxuICpcbiAqIE91dHB1dHM6XG4gKlxuICogQSBmZWFzaWJsZSBzcGFubmluZyB0cmVlIGZvciB0aGUgaW5wdXQgZ3JhcGggKGkuZS4gYSBzcGFubmluZyB0cmVlIHRoYXRcbiAqIHJlc3BlY3RzIGVhY2ggZ3JhcGggZWRnZSdzIGBtaW5MZW5gIGF0dHJpYnV0ZSkgcmVwcmVzZW50ZWQgYXMgYSBEaWdyYXBoIHdpdGhcbiAqIGEgYHJvb3RgIGF0dHJpYnV0ZSBvbiBncmFwaC5cbiAqXG4gKiBOb2RlcyBoYXZlIHRoZSBzYW1lIGlkIGFuZCB2YWx1ZSBhcyB0aGF0IGluIHRoZSBpbnB1dCBncmFwaC5cbiAqXG4gKiBFZGdlcyBpbiB0aGUgdHJlZSBoYXZlIGFyYml0cmFyaWx5IGFzc2lnbmVkIGlkcy4gVGhlIGF0dHJpYnV0ZXMgZm9yIGVkZ2VzXG4gKiBpbmNsdWRlIGByZXZlcnNlZGAuIGByZXZlcnNlZGAgaW5kaWNhdGVzIHRoYXQgdGhlIGVkZ2UgaXMgYVxuICogYmFjayBlZGdlIGluIHRoZSBpbnB1dCBncmFwaC5cbiAqL1xuZnVuY3Rpb24gZmVhc2libGVUcmVlKGcpIHtcbiAgdmFyIHJlbWFpbmluZyA9IG5ldyBTZXQoZy5ub2RlcygpKSxcbiAgICAgIHRyZWUgPSBuZXcgRGlncmFwaCgpO1xuXG4gIGlmIChyZW1haW5pbmcuc2l6ZSgpID09PSAxKSB7XG4gICAgdmFyIHJvb3QgPSBnLm5vZGVzKClbMF07XG4gICAgdHJlZS5hZGROb2RlKHJvb3QsIHt9KTtcbiAgICB0cmVlLmdyYXBoKHsgcm9vdDogcm9vdCB9KTtcbiAgICByZXR1cm4gdHJlZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFRpZ2h0RWRnZXModikge1xuICAgIHZhciBjb250aW51ZVRvU2NhbiA9IHRydWU7XG4gICAgZy5wcmVkZWNlc3NvcnModikuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICBpZiAocmVtYWluaW5nLmhhcyh1KSAmJiAhc2xhY2soZywgdSwgdikpIHtcbiAgICAgICAgaWYgKHJlbWFpbmluZy5oYXModikpIHtcbiAgICAgICAgICB0cmVlLmFkZE5vZGUodiwge30pO1xuICAgICAgICAgIHJlbWFpbmluZy5yZW1vdmUodik7XG4gICAgICAgICAgdHJlZS5ncmFwaCh7IHJvb3Q6IHYgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cmVlLmFkZE5vZGUodSwge30pO1xuICAgICAgICB0cmVlLmFkZEVkZ2UobnVsbCwgdSwgdiwgeyByZXZlcnNlZDogdHJ1ZSB9KTtcbiAgICAgICAgcmVtYWluaW5nLnJlbW92ZSh1KTtcbiAgICAgICAgYWRkVGlnaHRFZGdlcyh1KTtcbiAgICAgICAgY29udGludWVUb1NjYW4gPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGcuc3VjY2Vzc29ycyh2KS5mb3JFYWNoKGZ1bmN0aW9uKHcpICB7XG4gICAgICBpZiAocmVtYWluaW5nLmhhcyh3KSAmJiAhc2xhY2soZywgdiwgdykpIHtcbiAgICAgICAgaWYgKHJlbWFpbmluZy5oYXModikpIHtcbiAgICAgICAgICB0cmVlLmFkZE5vZGUodiwge30pO1xuICAgICAgICAgIHJlbWFpbmluZy5yZW1vdmUodik7XG4gICAgICAgICAgdHJlZS5ncmFwaCh7IHJvb3Q6IHYgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cmVlLmFkZE5vZGUodywge30pO1xuICAgICAgICB0cmVlLmFkZEVkZ2UobnVsbCwgdiwgdywge30pO1xuICAgICAgICByZW1haW5pbmcucmVtb3ZlKHcpO1xuICAgICAgICBhZGRUaWdodEVkZ2VzKHcpO1xuICAgICAgICBjb250aW51ZVRvU2NhbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBjb250aW51ZVRvU2NhbjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVRpZ2h0RWRnZSgpIHtcbiAgICB2YXIgbWluU2xhY2sgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgIHJlbWFpbmluZy5rZXlzKCkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICBnLnByZWRlY2Vzc29ycyh2KS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgICAgaWYgKCFyZW1haW5pbmcuaGFzKHUpKSB7XG4gICAgICAgICAgdmFyIGVkZ2VTbGFjayA9IHNsYWNrKGcsIHUsIHYpO1xuICAgICAgICAgIGlmIChNYXRoLmFicyhlZGdlU2xhY2spIDwgTWF0aC5hYnMobWluU2xhY2spKSB7XG4gICAgICAgICAgICBtaW5TbGFjayA9IC1lZGdlU2xhY2s7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgZy5zdWNjZXNzb3JzKHYpLmZvckVhY2goZnVuY3Rpb24odykge1xuICAgICAgICBpZiAoIXJlbWFpbmluZy5oYXModykpIHtcbiAgICAgICAgICB2YXIgZWRnZVNsYWNrID0gc2xhY2soZywgdiwgdyk7XG4gICAgICAgICAgaWYgKE1hdGguYWJzKGVkZ2VTbGFjaykgPCBNYXRoLmFicyhtaW5TbGFjaykpIHtcbiAgICAgICAgICAgIG1pblNsYWNrID0gZWRnZVNsYWNrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0cmVlLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHsgZy5ub2RlKHUpLnJhbmsgLT0gbWluU2xhY2s7IH0pO1xuICB9XG5cbiAgd2hpbGUgKHJlbWFpbmluZy5zaXplKCkpIHtcbiAgICB2YXIgbm9kZXNUb1NlYXJjaCA9ICF0cmVlLm9yZGVyKCkgPyByZW1haW5pbmcua2V5cygpIDogdHJlZS5ub2RlcygpO1xuICAgIGZvciAodmFyIGkgPSAwLCBpbCA9IG5vZGVzVG9TZWFyY2gubGVuZ3RoO1xuICAgICAgICAgaSA8IGlsICYmIGFkZFRpZ2h0RWRnZXMobm9kZXNUb1NlYXJjaFtpXSk7XG4gICAgICAgICArK2kpO1xuICAgIGlmIChyZW1haW5pbmcuc2l6ZSgpKSB7XG4gICAgICBjcmVhdGVUaWdodEVkZ2UoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJlZTtcbn1cblxuZnVuY3Rpb24gc2xhY2soZywgdSwgdikge1xuICB2YXIgcmFua0RpZmYgPSBnLm5vZGUodikucmFuayAtIGcubm9kZSh1KS5yYW5rO1xuICB2YXIgbWF4TWluTGVuID0gdXRpbC5tYXgoZy5vdXRFZGdlcyh1LCB2KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oZSkgeyByZXR1cm4gZy5lZGdlKGUpLm1pbkxlbjsgfSkpO1xuICByZXR1cm4gcmFua0RpZmYgLSBtYXhNaW5MZW47XG59XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKSxcbiAgICB0b3Bzb3J0ID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5hbGcudG9wc29ydDtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0UmFuaztcblxuLypcbiAqIEFzc2lnbnMgYSBgcmFua2AgYXR0cmlidXRlIHRvIGVhY2ggbm9kZSBpbiB0aGUgaW5wdXQgZ3JhcGggYW5kIGVuc3VyZXMgdGhhdFxuICogdGhpcyByYW5rIHJlc3BlY3RzIHRoZSBgbWluTGVuYCBhdHRyaWJ1dGUgb2YgaW5jaWRlbnQgZWRnZXMuXG4gKlxuICogUHJlcmVxdWlzaXRlczpcbiAqXG4gKiAgKiBUaGUgaW5wdXQgZ3JhcGggbXVzdCBiZSBhY3ljbGljXG4gKiAgKiBFYWNoIGVkZ2UgaW4gdGhlIGlucHV0IGdyYXBoIG11c3QgaGF2ZSBhbiBhc3NpZ25lZCAnbWluTGVuJyBhdHRyaWJ1dGVcbiAqL1xuZnVuY3Rpb24gaW5pdFJhbmsoZykge1xuICB2YXIgc29ydGVkID0gdG9wc29ydChnKTtcblxuICBzb3J0ZWQuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgdmFyIGluRWRnZXMgPSBnLmluRWRnZXModSk7XG4gICAgaWYgKGluRWRnZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBnLm5vZGUodSkucmFuayA9IDA7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIG1pbkxlbnMgPSBpbkVkZ2VzLm1hcChmdW5jdGlvbihlKSB7XG4gICAgICByZXR1cm4gZy5ub2RlKGcuc291cmNlKGUpKS5yYW5rICsgZy5lZGdlKGUpLm1pbkxlbjtcbiAgICB9KTtcbiAgICBnLm5vZGUodSkucmFuayA9IHV0aWwubWF4KG1pbkxlbnMpO1xuICB9KTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBzbGFjazogc2xhY2tcbn07XG5cbi8qXG4gKiBBIGhlbHBlciB0byBjYWxjdWxhdGUgdGhlIHNsYWNrIGJldHdlZW4gdHdvIG5vZGVzIChgdWAgYW5kIGB2YCkgZ2l2ZW4gYVxuICogYG1pbkxlbmAgY29uc3RyYWludC4gVGhlIHNsYWNrIHJlcHJlc2VudHMgaG93IG11Y2ggdGhlIGRpc3RhbmNlIGJldHdlZW4gYHVgXG4gKiBhbmQgYHZgIGNvdWxkIHNocmluayB3aGlsZSBtYWludGFpbmluZyB0aGUgYG1pbkxlbmAgY29uc3RyYWludC4gSWYgdGhlIHZhbHVlXG4gKiBpcyBuZWdhdGl2ZSB0aGVuIHRoZSBjb25zdHJhaW50IGlzIGN1cnJlbnRseSB2aW9sYXRlZC5cbiAqXG4gIFRoaXMgZnVuY3Rpb24gcmVxdWlyZXMgdGhhdCBgdWAgYW5kIGB2YCBhcmUgaW4gYGdyYXBoYCBhbmQgdGhleSBib3RoIGhhdmUgYVxuICBgcmFua2AgYXR0cmlidXRlLlxuICovXG5mdW5jdGlvbiBzbGFjayhncmFwaCwgdSwgdiwgbWluTGVuKSB7XG4gIHJldHVybiBNYXRoLmFicyhncmFwaC5ub2RlKHUpLnJhbmsgLSBncmFwaC5ub2RlKHYpLnJhbmspIC0gbWluTGVuO1xufVxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyksXG4gICAgcmFua1V0aWwgPSByZXF1aXJlKCcuL3JhbmtVdGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc2ltcGxleDtcblxuZnVuY3Rpb24gc2ltcGxleChncmFwaCwgc3Bhbm5pbmdUcmVlKSB7XG4gIC8vIFRoZSBuZXR3b3JrIHNpbXBsZXggYWxnb3JpdGhtIHJlcGVhdGVkbHkgcmVwbGFjZXMgZWRnZXMgb2ZcbiAgLy8gdGhlIHNwYW5uaW5nIHRyZWUgd2l0aCBuZWdhdGl2ZSBjdXQgdmFsdWVzIHVudGlsIG5vIHN1Y2hcbiAgLy8gZWRnZSBleGlzdHMuXG4gIGluaXRDdXRWYWx1ZXMoZ3JhcGgsIHNwYW5uaW5nVHJlZSk7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgdmFyIGUgPSBsZWF2ZUVkZ2Uoc3Bhbm5pbmdUcmVlKTtcbiAgICBpZiAoZSA9PT0gbnVsbCkgYnJlYWs7XG4gICAgdmFyIGYgPSBlbnRlckVkZ2UoZ3JhcGgsIHNwYW5uaW5nVHJlZSwgZSk7XG4gICAgZXhjaGFuZ2UoZ3JhcGgsIHNwYW5uaW5nVHJlZSwgZSwgZik7XG4gIH1cbn1cblxuLypcbiAqIFNldCB0aGUgY3V0IHZhbHVlcyBvZiBlZGdlcyBpbiB0aGUgc3Bhbm5pbmcgdHJlZSBieSBhIGRlcHRoLWZpcnN0XG4gKiBwb3N0b3JkZXIgdHJhdmVyc2FsLiAgVGhlIGN1dCB2YWx1ZSBjb3JyZXNwb25kcyB0byB0aGUgY29zdCwgaW5cbiAqIHRlcm1zIG9mIGEgcmFua2luZydzIGVkZ2UgbGVuZ3RoIHN1bSwgb2YgbGVuZ3RoZW5pbmcgYW4gZWRnZS5cbiAqIE5lZ2F0aXZlIGN1dCB2YWx1ZXMgdHlwaWNhbGx5IGluZGljYXRlIGVkZ2VzIHRoYXQgd291bGQgeWllbGQgYVxuICogc21hbGxlciBlZGdlIGxlbmd0aCBzdW0gaWYgdGhleSB3ZXJlIGxlbmd0aGVuZWQuXG4gKi9cbmZ1bmN0aW9uIGluaXRDdXRWYWx1ZXMoZ3JhcGgsIHNwYW5uaW5nVHJlZSkge1xuICBjb21wdXRlTG93TGltKHNwYW5uaW5nVHJlZSk7XG5cbiAgc3Bhbm5pbmdUcmVlLmVhY2hFZGdlKGZ1bmN0aW9uKGlkLCB1LCB2LCB0cmVlVmFsdWUpIHtcbiAgICB0cmVlVmFsdWUuY3V0VmFsdWUgPSAwO1xuICB9KTtcblxuICAvLyBQcm9wYWdhdGUgY3V0IHZhbHVlcyB1cCB0aGUgdHJlZS5cbiAgZnVuY3Rpb24gZGZzKG4pIHtcbiAgICB2YXIgY2hpbGRyZW4gPSBzcGFubmluZ1RyZWUuc3VjY2Vzc29ycyhuKTtcbiAgICBmb3IgKHZhciBjIGluIGNoaWxkcmVuKSB7XG4gICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltjXTtcbiAgICAgIGRmcyhjaGlsZCk7XG4gICAgfVxuICAgIGlmIChuICE9PSBzcGFubmluZ1RyZWUuZ3JhcGgoKS5yb290KSB7XG4gICAgICBzZXRDdXRWYWx1ZShncmFwaCwgc3Bhbm5pbmdUcmVlLCBuKTtcbiAgICB9XG4gIH1cbiAgZGZzKHNwYW5uaW5nVHJlZS5ncmFwaCgpLnJvb3QpO1xufVxuXG4vKlxuICogUGVyZm9ybSBhIERGUyBwb3N0b3JkZXIgdHJhdmVyc2FsLCBsYWJlbGluZyBlYWNoIG5vZGUgdiB3aXRoXG4gKiBpdHMgdHJhdmVyc2FsIG9yZGVyICdsaW0odiknIGFuZCB0aGUgbWluaW11bSB0cmF2ZXJzYWwgbnVtYmVyXG4gKiBvZiBhbnkgb2YgaXRzIGRlc2NlbmRhbnRzICdsb3codiknLiAgVGhpcyBwcm92aWRlcyBhbiBlZmZpY2llbnRcbiAqIHdheSB0byB0ZXN0IHdoZXRoZXIgdSBpcyBhbiBhbmNlc3RvciBvZiB2IHNpbmNlXG4gKiBsb3codSkgPD0gbGltKHYpIDw9IGxpbSh1KSBpZiBhbmQgb25seSBpZiB1IGlzIGFuIGFuY2VzdG9yLlxuICovXG5mdW5jdGlvbiBjb21wdXRlTG93TGltKHRyZWUpIHtcbiAgdmFyIHBvc3RPcmRlck51bSA9IDA7XG4gIFxuICBmdW5jdGlvbiBkZnMobikge1xuICAgIHZhciBjaGlsZHJlbiA9IHRyZWUuc3VjY2Vzc29ycyhuKTtcbiAgICB2YXIgbG93ID0gcG9zdE9yZGVyTnVtO1xuICAgIGZvciAodmFyIGMgaW4gY2hpbGRyZW4pIHtcbiAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2NdO1xuICAgICAgZGZzKGNoaWxkKTtcbiAgICAgIGxvdyA9IE1hdGgubWluKGxvdywgdHJlZS5ub2RlKGNoaWxkKS5sb3cpO1xuICAgIH1cbiAgICB0cmVlLm5vZGUobikubG93ID0gbG93O1xuICAgIHRyZWUubm9kZShuKS5saW0gPSBwb3N0T3JkZXJOdW0rKztcbiAgfVxuXG4gIGRmcyh0cmVlLmdyYXBoKCkucm9vdCk7XG59XG5cbi8qXG4gKiBUbyBjb21wdXRlIHRoZSBjdXQgdmFsdWUgb2YgdGhlIGVkZ2UgcGFyZW50IC0+IGNoaWxkLCB3ZSBjb25zaWRlclxuICogaXQgYW5kIGFueSBvdGhlciBncmFwaCBlZGdlcyB0byBvciBmcm9tIHRoZSBjaGlsZC5cbiAqICAgICAgICAgIHBhcmVudFxuICogICAgICAgICAgICAgfFxuICogICAgICAgICAgIGNoaWxkXG4gKiAgICAgICAgICAvICAgICAgXFxcbiAqICAgICAgICAgdSAgICAgICAgdlxuICovXG5mdW5jdGlvbiBzZXRDdXRWYWx1ZShncmFwaCwgdHJlZSwgY2hpbGQpIHtcbiAgdmFyIHBhcmVudEVkZ2UgPSB0cmVlLmluRWRnZXMoY2hpbGQpWzBdO1xuXG4gIC8vIExpc3Qgb2YgY2hpbGQncyBjaGlsZHJlbiBpbiB0aGUgc3Bhbm5pbmcgdHJlZS5cbiAgdmFyIGdyYW5kY2hpbGRyZW4gPSBbXTtcbiAgdmFyIGdyYW5kY2hpbGRFZGdlcyA9IHRyZWUub3V0RWRnZXMoY2hpbGQpO1xuICBmb3IgKHZhciBnY2UgaW4gZ3JhbmRjaGlsZEVkZ2VzKSB7XG4gICAgZ3JhbmRjaGlsZHJlbi5wdXNoKHRyZWUudGFyZ2V0KGdyYW5kY2hpbGRFZGdlc1tnY2VdKSk7XG4gIH1cblxuICB2YXIgY3V0VmFsdWUgPSAwO1xuXG4gIC8vIFRPRE86IFJlcGxhY2UgdW5pdCBpbmNyZW1lbnQvZGVjcmVtZW50IHdpdGggZWRnZSB3ZWlnaHRzLlxuICB2YXIgRSA9IDA7ICAgIC8vIEVkZ2VzIGZyb20gY2hpbGQgdG8gZ3JhbmRjaGlsZCdzIHN1YnRyZWUuXG4gIHZhciBGID0gMDsgICAgLy8gRWRnZXMgdG8gY2hpbGQgZnJvbSBncmFuZGNoaWxkJ3Mgc3VidHJlZS5cbiAgdmFyIEcgPSAwOyAgICAvLyBFZGdlcyBmcm9tIGNoaWxkIHRvIG5vZGVzIG91dHNpZGUgb2YgY2hpbGQncyBzdWJ0cmVlLlxuICB2YXIgSCA9IDA7ICAgIC8vIEVkZ2VzIGZyb20gbm9kZXMgb3V0c2lkZSBvZiBjaGlsZCdzIHN1YnRyZWUgdG8gY2hpbGQuXG5cbiAgLy8gQ29uc2lkZXIgYWxsIGdyYXBoIGVkZ2VzIGZyb20gY2hpbGQuXG4gIHZhciBvdXRFZGdlcyA9IGdyYXBoLm91dEVkZ2VzKGNoaWxkKTtcbiAgdmFyIGdjO1xuICBmb3IgKHZhciBvZSBpbiBvdXRFZGdlcykge1xuICAgIHZhciBzdWNjID0gZ3JhcGgudGFyZ2V0KG91dEVkZ2VzW29lXSk7XG4gICAgZm9yIChnYyBpbiBncmFuZGNoaWxkcmVuKSB7XG4gICAgICBpZiAoaW5TdWJ0cmVlKHRyZWUsIHN1Y2MsIGdyYW5kY2hpbGRyZW5bZ2NdKSkge1xuICAgICAgICBFKys7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghaW5TdWJ0cmVlKHRyZWUsIHN1Y2MsIGNoaWxkKSkge1xuICAgICAgRysrO1xuICAgIH1cbiAgfVxuXG4gIC8vIENvbnNpZGVyIGFsbCBncmFwaCBlZGdlcyB0byBjaGlsZC5cbiAgdmFyIGluRWRnZXMgPSBncmFwaC5pbkVkZ2VzKGNoaWxkKTtcbiAgZm9yICh2YXIgaWUgaW4gaW5FZGdlcykge1xuICAgIHZhciBwcmVkID0gZ3JhcGguc291cmNlKGluRWRnZXNbaWVdKTtcbiAgICBmb3IgKGdjIGluIGdyYW5kY2hpbGRyZW4pIHtcbiAgICAgIGlmIChpblN1YnRyZWUodHJlZSwgcHJlZCwgZ3JhbmRjaGlsZHJlbltnY10pKSB7XG4gICAgICAgIEYrKztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFpblN1YnRyZWUodHJlZSwgcHJlZCwgY2hpbGQpKSB7XG4gICAgICBIKys7XG4gICAgfVxuICB9XG5cbiAgLy8gQ29udHJpYnV0aW9ucyBkZXBlbmQgb24gdGhlIGFsaWdubWVudCBvZiB0aGUgcGFyZW50IC0+IGNoaWxkIGVkZ2VcbiAgLy8gYW5kIHRoZSBjaGlsZCAtPiB1IG9yIHYgZWRnZXMuXG4gIHZhciBncmFuZGNoaWxkQ3V0U3VtID0gMDtcbiAgZm9yIChnYyBpbiBncmFuZGNoaWxkcmVuKSB7XG4gICAgdmFyIGN2ID0gdHJlZS5lZGdlKGdyYW5kY2hpbGRFZGdlc1tnY10pLmN1dFZhbHVlO1xuICAgIGlmICghdHJlZS5lZGdlKGdyYW5kY2hpbGRFZGdlc1tnY10pLnJldmVyc2VkKSB7XG4gICAgICBncmFuZGNoaWxkQ3V0U3VtICs9IGN2O1xuICAgIH0gZWxzZSB7XG4gICAgICBncmFuZGNoaWxkQ3V0U3VtIC09IGN2O1xuICAgIH1cbiAgfVxuXG4gIGlmICghdHJlZS5lZGdlKHBhcmVudEVkZ2UpLnJldmVyc2VkKSB7XG4gICAgY3V0VmFsdWUgKz0gZ3JhbmRjaGlsZEN1dFN1bSAtIEUgKyBGIC0gRyArIEg7XG4gIH0gZWxzZSB7XG4gICAgY3V0VmFsdWUgLT0gZ3JhbmRjaGlsZEN1dFN1bSAtIEUgKyBGIC0gRyArIEg7XG4gIH1cblxuICB0cmVlLmVkZ2UocGFyZW50RWRnZSkuY3V0VmFsdWUgPSBjdXRWYWx1ZTtcbn1cblxuLypcbiAqIFJldHVybiB3aGV0aGVyIG4gaXMgYSBub2RlIGluIHRoZSBzdWJ0cmVlIHdpdGggdGhlIGdpdmVuXG4gKiByb290LlxuICovXG5mdW5jdGlvbiBpblN1YnRyZWUodHJlZSwgbiwgcm9vdCkge1xuICByZXR1cm4gKHRyZWUubm9kZShyb290KS5sb3cgPD0gdHJlZS5ub2RlKG4pLmxpbSAmJlxuICAgICAgICAgIHRyZWUubm9kZShuKS5saW0gPD0gdHJlZS5ub2RlKHJvb3QpLmxpbSk7XG59XG5cbi8qXG4gKiBSZXR1cm4gYW4gZWRnZSBmcm9tIHRoZSB0cmVlIHdpdGggYSBuZWdhdGl2ZSBjdXQgdmFsdWUsIG9yIG51bGwgaWYgdGhlcmVcbiAqIGlzIG5vbmUuXG4gKi9cbmZ1bmN0aW9uIGxlYXZlRWRnZSh0cmVlKSB7XG4gIHZhciBlZGdlcyA9IHRyZWUuZWRnZXMoKTtcbiAgZm9yICh2YXIgbiBpbiBlZGdlcykge1xuICAgIHZhciBlID0gZWRnZXNbbl07XG4gICAgdmFyIHRyZWVWYWx1ZSA9IHRyZWUuZWRnZShlKTtcbiAgICBpZiAodHJlZVZhbHVlLmN1dFZhbHVlIDwgMCkge1xuICAgICAgcmV0dXJuIGU7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vKlxuICogVGhlIGVkZ2UgZSBzaG91bGQgYmUgYW4gZWRnZSBpbiB0aGUgdHJlZSwgd2l0aCBhbiB1bmRlcmx5aW5nIGVkZ2VcbiAqIGluIHRoZSBncmFwaCwgd2l0aCBhIG5lZ2F0aXZlIGN1dCB2YWx1ZS4gIE9mIHRoZSB0d28gbm9kZXMgaW5jaWRlbnRcbiAqIG9uIHRoZSBlZGdlLCB0YWtlIHRoZSBsb3dlciBvbmUuICBlbnRlckVkZ2UgcmV0dXJucyBhbiBlZGdlIHdpdGhcbiAqIG1pbmltdW0gc2xhY2sgZ29pbmcgZnJvbSBvdXRzaWRlIG9mIHRoYXQgbm9kZSdzIHN1YnRyZWUgdG8gaW5zaWRlXG4gKiBvZiB0aGF0IG5vZGUncyBzdWJ0cmVlLlxuICovXG5mdW5jdGlvbiBlbnRlckVkZ2UoZ3JhcGgsIHRyZWUsIGUpIHtcbiAgdmFyIHNvdXJjZSA9IHRyZWUuc291cmNlKGUpO1xuICB2YXIgdGFyZ2V0ID0gdHJlZS50YXJnZXQoZSk7XG4gIHZhciBsb3dlciA9IHRyZWUubm9kZSh0YXJnZXQpLmxpbSA8IHRyZWUubm9kZShzb3VyY2UpLmxpbSA/IHRhcmdldCA6IHNvdXJjZTtcblxuICAvLyBJcyB0aGUgdHJlZSBlZGdlIGFsaWduZWQgd2l0aCB0aGUgZ3JhcGggZWRnZT9cbiAgdmFyIGFsaWduZWQgPSAhdHJlZS5lZGdlKGUpLnJldmVyc2VkO1xuXG4gIHZhciBtaW5TbGFjayA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgdmFyIG1pblNsYWNrRWRnZTtcbiAgaWYgKGFsaWduZWQpIHtcbiAgICBncmFwaC5lYWNoRWRnZShmdW5jdGlvbihpZCwgdSwgdiwgdmFsdWUpIHtcbiAgICAgIGlmIChpZCAhPT0gZSAmJiBpblN1YnRyZWUodHJlZSwgdSwgbG93ZXIpICYmICFpblN1YnRyZWUodHJlZSwgdiwgbG93ZXIpKSB7XG4gICAgICAgIHZhciBzbGFjayA9IHJhbmtVdGlsLnNsYWNrKGdyYXBoLCB1LCB2LCB2YWx1ZS5taW5MZW4pO1xuICAgICAgICBpZiAoc2xhY2sgPCBtaW5TbGFjaykge1xuICAgICAgICAgIG1pblNsYWNrID0gc2xhY2s7XG4gICAgICAgICAgbWluU2xhY2tFZGdlID0gaWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBncmFwaC5lYWNoRWRnZShmdW5jdGlvbihpZCwgdSwgdiwgdmFsdWUpIHtcbiAgICAgIGlmIChpZCAhPT0gZSAmJiAhaW5TdWJ0cmVlKHRyZWUsIHUsIGxvd2VyKSAmJiBpblN1YnRyZWUodHJlZSwgdiwgbG93ZXIpKSB7XG4gICAgICAgIHZhciBzbGFjayA9IHJhbmtVdGlsLnNsYWNrKGdyYXBoLCB1LCB2LCB2YWx1ZS5taW5MZW4pO1xuICAgICAgICBpZiAoc2xhY2sgPCBtaW5TbGFjaykge1xuICAgICAgICAgIG1pblNsYWNrID0gc2xhY2s7XG4gICAgICAgICAgbWluU2xhY2tFZGdlID0gaWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtaW5TbGFja0VkZ2UgPT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBvdXRzaWRlID0gW107XG4gICAgdmFyIGluc2lkZSA9IFtdO1xuICAgIGdyYXBoLmVhY2hOb2RlKGZ1bmN0aW9uKGlkKSB7XG4gICAgICBpZiAoIWluU3VidHJlZSh0cmVlLCBpZCwgbG93ZXIpKSB7XG4gICAgICAgIG91dHNpZGUucHVzaChpZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnNpZGUucHVzaChpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdObyBlZGdlIGZvdW5kIGZyb20gb3V0c2lkZSBvZiB0cmVlIHRvIGluc2lkZScpO1xuICB9XG5cbiAgcmV0dXJuIG1pblNsYWNrRWRnZTtcbn1cblxuLypcbiAqIFJlcGxhY2UgZWRnZSBlIHdpdGggZWRnZSBmIGluIHRoZSB0cmVlLCByZWNhbGN1bGF0aW5nIHRoZSB0cmVlIHJvb3QsXG4gKiB0aGUgbm9kZXMnIGxvdyBhbmQgbGltIHByb3BlcnRpZXMgYW5kIHRoZSBlZGdlcycgY3V0IHZhbHVlcy5cbiAqL1xuZnVuY3Rpb24gZXhjaGFuZ2UoZ3JhcGgsIHRyZWUsIGUsIGYpIHtcbiAgdHJlZS5kZWxFZGdlKGUpO1xuICB2YXIgc291cmNlID0gZ3JhcGguc291cmNlKGYpO1xuICB2YXIgdGFyZ2V0ID0gZ3JhcGgudGFyZ2V0KGYpO1xuXG4gIC8vIFJlZGlyZWN0IGVkZ2VzIHNvIHRoYXQgdGFyZ2V0IGlzIHRoZSByb290IG9mIGl0cyBzdWJ0cmVlLlxuICBmdW5jdGlvbiByZWRpcmVjdCh2KSB7XG4gICAgdmFyIGVkZ2VzID0gdHJlZS5pbkVkZ2VzKHYpO1xuICAgIGZvciAodmFyIGkgaW4gZWRnZXMpIHtcbiAgICAgIHZhciBlID0gZWRnZXNbaV07XG4gICAgICB2YXIgdSA9IHRyZWUuc291cmNlKGUpO1xuICAgICAgdmFyIHZhbHVlID0gdHJlZS5lZGdlKGUpO1xuICAgICAgcmVkaXJlY3QodSk7XG4gICAgICB0cmVlLmRlbEVkZ2UoZSk7XG4gICAgICB2YWx1ZS5yZXZlcnNlZCA9ICF2YWx1ZS5yZXZlcnNlZDtcbiAgICAgIHRyZWUuYWRkRWRnZShlLCB2LCB1LCB2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgcmVkaXJlY3QodGFyZ2V0KTtcblxuICB2YXIgcm9vdCA9IHNvdXJjZTtcbiAgdmFyIGVkZ2VzID0gdHJlZS5pbkVkZ2VzKHJvb3QpO1xuICB3aGlsZSAoZWRnZXMubGVuZ3RoID4gMCkge1xuICAgIHJvb3QgPSB0cmVlLnNvdXJjZShlZGdlc1swXSk7XG4gICAgZWRnZXMgPSB0cmVlLmluRWRnZXMocm9vdCk7XG4gIH1cblxuICB0cmVlLmdyYXBoKCkucm9vdCA9IHJvb3Q7XG5cbiAgdHJlZS5hZGRFZGdlKG51bGwsIHNvdXJjZSwgdGFyZ2V0LCB7Y3V0VmFsdWU6IDB9KTtcblxuICBpbml0Q3V0VmFsdWVzKGdyYXBoLCB0cmVlKTtcblxuICBhZGp1c3RSYW5rcyhncmFwaCwgdHJlZSk7XG59XG5cbi8qXG4gKiBSZXNldCB0aGUgcmFua3Mgb2YgYWxsIG5vZGVzIGJhc2VkIG9uIHRoZSBjdXJyZW50IHNwYW5uaW5nIHRyZWUuXG4gKiBUaGUgcmFuayBvZiB0aGUgdHJlZSdzIHJvb3QgcmVtYWlucyB1bmNoYW5nZWQsIHdoaWxlIGFsbCBvdGhlclxuICogbm9kZXMgYXJlIHNldCB0byB0aGUgc3VtIG9mIG1pbmltdW0gbGVuZ3RoIGNvbnN0cmFpbnRzIGFsb25nXG4gKiB0aGUgcGF0aCBmcm9tIHRoZSByb290LlxuICovXG5mdW5jdGlvbiBhZGp1c3RSYW5rcyhncmFwaCwgdHJlZSkge1xuICBmdW5jdGlvbiBkZnMocCkge1xuICAgIHZhciBjaGlsZHJlbiA9IHRyZWUuc3VjY2Vzc29ycyhwKTtcbiAgICBjaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGMpIHtcbiAgICAgIHZhciBtaW5MZW4gPSBtaW5pbXVtTGVuZ3RoKGdyYXBoLCBwLCBjKTtcbiAgICAgIGdyYXBoLm5vZGUoYykucmFuayA9IGdyYXBoLm5vZGUocCkucmFuayArIG1pbkxlbjtcbiAgICAgIGRmcyhjKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRmcyh0cmVlLmdyYXBoKCkucm9vdCk7XG59XG5cbi8qXG4gKiBJZiB1IGFuZCB2IGFyZSBjb25uZWN0ZWQgYnkgc29tZSBlZGdlcyBpbiB0aGUgZ3JhcGgsIHJldHVybiB0aGVcbiAqIG1pbmltdW0gbGVuZ3RoIG9mIHRob3NlIGVkZ2VzLCBhcyBhIHBvc2l0aXZlIG51bWJlciBpZiB2IHN1Y2NlZWRzXG4gKiB1IGFuZCBhcyBhIG5lZ2F0aXZlIG51bWJlciBpZiB2IHByZWNlZGVzIHUuXG4gKi9cbmZ1bmN0aW9uIG1pbmltdW1MZW5ndGgoZ3JhcGgsIHUsIHYpIHtcbiAgdmFyIG91dEVkZ2VzID0gZ3JhcGgub3V0RWRnZXModSwgdik7XG4gIGlmIChvdXRFZGdlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHV0aWwubWF4KG91dEVkZ2VzLm1hcChmdW5jdGlvbihlKSB7XG4gICAgICByZXR1cm4gZ3JhcGguZWRnZShlKS5taW5MZW47XG4gICAgfSkpO1xuICB9XG5cbiAgdmFyIGluRWRnZXMgPSBncmFwaC5pbkVkZ2VzKHUsIHYpO1xuICBpZiAoaW5FZGdlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIC11dGlsLm1heChpbkVkZ2VzLm1hcChmdW5jdGlvbihlKSB7XG4gICAgICByZXR1cm4gZ3JhcGguZWRnZShlKS5taW5MZW47XG4gICAgfSkpO1xuICB9XG59XG4iLCIvKlxuICogUmV0dXJucyB0aGUgc21hbGxlc3QgdmFsdWUgaW4gdGhlIGFycmF5LlxuICovXG5leHBvcnRzLm1pbiA9IGZ1bmN0aW9uKHZhbHVlcykge1xuICByZXR1cm4gTWF0aC5taW4uYXBwbHkoTWF0aCwgdmFsdWVzKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIHRoZSBsYXJnZXN0IHZhbHVlIGluIHRoZSBhcnJheS5cbiAqL1xuZXhwb3J0cy5tYXggPSBmdW5jdGlvbih2YWx1ZXMpIHtcbiAgcmV0dXJuIE1hdGgubWF4LmFwcGx5KE1hdGgsIHZhbHVlcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyBgdHJ1ZWAgb25seSBpZiBgZih4KWAgaXMgYHRydWVgIGZvciBhbGwgYHhgIGluIGB4c2AuIE90aGVyd2lzZVxuICogcmV0dXJucyBgZmFsc2VgLiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmV0dXJuIGltbWVkaWF0ZWx5IGlmIGl0IGZpbmRzIGFcbiAqIGNhc2Ugd2hlcmUgYGYoeClgIGRvZXMgbm90IGhvbGQuXG4gKi9cbmV4cG9ydHMuYWxsID0gZnVuY3Rpb24oeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7ICsraSkge1xuICAgIGlmICghZih4c1tpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vKlxuICogQWNjdW11bGF0ZXMgdGhlIHN1bSBvZiBlbGVtZW50cyBpbiB0aGUgZ2l2ZW4gYXJyYXkgdXNpbmcgdGhlIGArYCBvcGVyYXRvci5cbiAqL1xuZXhwb3J0cy5zdW0gPSBmdW5jdGlvbih2YWx1ZXMpIHtcbiAgcmV0dXJuIHZhbHVlcy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCB4KSB7IHJldHVybiBhY2MgKyB4OyB9LCAwKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGFsbCB2YWx1ZXMgaW4gdGhlIGdpdmVuIG9iamVjdC5cbiAqL1xuZXhwb3J0cy52YWx1ZXMgPSBmdW5jdGlvbihvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaikubWFwKGZ1bmN0aW9uKGspIHsgcmV0dXJuIG9ialtrXTsgfSk7XG59O1xuXG5leHBvcnRzLnNodWZmbGUgPSBmdW5jdGlvbihhcnJheSkge1xuICBmb3IgKGkgPSBhcnJheS5sZW5ndGggLSAxOyBpID4gMDsgLS1pKSB7XG4gICAgdmFyIGogPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoaSArIDEpKTtcbiAgICB2YXIgYWogPSBhcnJheVtqXTtcbiAgICBhcnJheVtqXSA9IGFycmF5W2ldO1xuICAgIGFycmF5W2ldID0gYWo7XG4gIH1cbn07XG5cbmV4cG9ydHMucHJvcGVydHlBY2Nlc3NvciA9IGZ1bmN0aW9uKHNlbGYsIGNvbmZpZywgZmllbGQsIHNldEhvb2spIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHgpIHtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBjb25maWdbZmllbGRdO1xuICAgIGNvbmZpZ1tmaWVsZF0gPSB4O1xuICAgIGlmIChzZXRIb29rKSBzZXRIb29rKHgpO1xuICAgIHJldHVybiBzZWxmO1xuICB9O1xufTtcblxuLypcbiAqIEdpdmVuIGEgbGF5ZXJlZCwgZGlyZWN0ZWQgZ3JhcGggd2l0aCBgcmFua2AgYW5kIGBvcmRlcmAgbm9kZSBhdHRyaWJ1dGVzLFxuICogdGhpcyBmdW5jdGlvbiByZXR1cm5zIGFuIGFycmF5IG9mIG9yZGVyZWQgcmFua3MuIEVhY2ggcmFuayBjb250YWlucyBhbiBhcnJheVxuICogb2YgdGhlIGlkcyBvZiB0aGUgbm9kZXMgaW4gdGhhdCByYW5rIGluIHRoZSBvcmRlciBzcGVjaWZpZWQgYnkgdGhlIGBvcmRlcmBcbiAqIGF0dHJpYnV0ZS5cbiAqL1xuZXhwb3J0cy5vcmRlcmluZyA9IGZ1bmN0aW9uKGcpIHtcbiAgdmFyIG9yZGVyaW5nID0gW107XG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB2YXIgcmFuayA9IG9yZGVyaW5nW3ZhbHVlLnJhbmtdIHx8IChvcmRlcmluZ1t2YWx1ZS5yYW5rXSA9IFtdKTtcbiAgICByYW5rW3ZhbHVlLm9yZGVyXSA9IHU7XG4gIH0pO1xuICByZXR1cm4gb3JkZXJpbmc7XG59O1xuXG4vKlxuICogQSBmaWx0ZXIgdGhhdCBjYW4gYmUgdXNlZCB3aXRoIGBmaWx0ZXJOb2Rlc2AgdG8gZ2V0IGEgZ3JhcGggdGhhdCBvbmx5XG4gKiBpbmNsdWRlcyBub2RlcyB0aGF0IGRvIG5vdCBjb250YWluIG90aGVycyBub2Rlcy5cbiAqL1xuZXhwb3J0cy5maWx0ZXJOb25TdWJncmFwaHMgPSBmdW5jdGlvbihnKSB7XG4gIHJldHVybiBmdW5jdGlvbih1KSB7XG4gICAgcmV0dXJuIGcuY2hpbGRyZW4odSkubGVuZ3RoID09PSAwO1xuICB9O1xufTtcblxuLypcbiAqIFJldHVybnMgYSBuZXcgZnVuY3Rpb24gdGhhdCB3cmFwcyBgZnVuY2Agd2l0aCBhIHRpbWVyLiBUaGUgd3JhcHBlciBsb2dzIHRoZVxuICogdGltZSBpdCB0YWtlcyB0byBleGVjdXRlIHRoZSBmdW5jdGlvbi5cbiAqXG4gKiBUaGUgdGltZXIgd2lsbCBiZSBlbmFibGVkIHByb3ZpZGVkIGBsb2cubGV2ZWwgPj0gMWAuXG4gKi9cbmZ1bmN0aW9uIHRpbWUobmFtZSwgZnVuYykge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHN0YXJ0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGxvZygxLCBuYW1lICsgJyB0aW1lOiAnICsgKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnQpICsgJ21zJyk7XG4gICAgfVxuICB9O1xufVxudGltZS5lbmFibGVkID0gZmFsc2U7XG5cbmV4cG9ydHMudGltZSA9IHRpbWU7XG5cbi8qXG4gKiBBIGdsb2JhbCBsb2dnZXIgd2l0aCB0aGUgc3BlY2lmaWNhdGlvbiBgbG9nKGxldmVsLCBtZXNzYWdlLCAuLi4pYCB0aGF0XG4gKiB3aWxsIGxvZyBhIG1lc3NhZ2UgdG8gdGhlIGNvbnNvbGUgaWYgYGxvZy5sZXZlbCA+PSBsZXZlbGAuXG4gKi9cbmZ1bmN0aW9uIGxvZyhsZXZlbCkge1xuICBpZiAobG9nLmxldmVsID49IGxldmVsKSB7XG4gICAgY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gIH1cbn1cbmxvZy5sZXZlbCA9IDA7XG5cbmV4cG9ydHMubG9nID0gbG9nO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAnMC40LjUnO1xuIiwiZXhwb3J0cy5TZXQgPSByZXF1aXJlKCcuL2xpYi9TZXQnKTtcbmV4cG9ydHMuUHJpb3JpdHlRdWV1ZSA9IHJlcXVpcmUoJy4vbGliL1ByaW9yaXR5UXVldWUnKTtcbmV4cG9ydHMudmVyc2lvbiA9IHJlcXVpcmUoJy4vbGliL3ZlcnNpb24nKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gUHJpb3JpdHlRdWV1ZTtcblxuLyoqXG4gKiBBIG1pbi1wcmlvcml0eSBxdWV1ZSBkYXRhIHN0cnVjdHVyZS4gVGhpcyBhbGdvcml0aG0gaXMgZGVyaXZlZCBmcm9tIENvcm1lbixcbiAqIGV0IGFsLiwgXCJJbnRyb2R1Y3Rpb24gdG8gQWxnb3JpdGhtc1wiLiBUaGUgYmFzaWMgaWRlYSBvZiBhIG1pbi1wcmlvcml0eVxuICogcXVldWUgaXMgdGhhdCB5b3UgY2FuIGVmZmljaWVudGx5IChpbiBPKDEpIHRpbWUpIGdldCB0aGUgc21hbGxlc3Qga2V5IGluXG4gKiB0aGUgcXVldWUuIEFkZGluZyBhbmQgcmVtb3ZpbmcgZWxlbWVudHMgdGFrZXMgTyhsb2cgbikgdGltZS4gQSBrZXkgY2FuXG4gKiBoYXZlIGl0cyBwcmlvcml0eSBkZWNyZWFzZWQgaW4gTyhsb2cgbikgdGltZS5cbiAqL1xuZnVuY3Rpb24gUHJpb3JpdHlRdWV1ZSgpIHtcbiAgdGhpcy5fYXJyID0gW107XG4gIHRoaXMuX2tleUluZGljZXMgPSB7fTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgaW4gdGhlIHF1ZXVlLiBUYWtlcyBgTygxKWAgdGltZS5cbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuc2l6ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fYXJyLmxlbmd0aDtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUga2V5cyB0aGF0IGFyZSBpbiB0aGUgcXVldWUuIFRha2VzIGBPKG4pYCB0aW1lLlxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9hcnIubWFwKGZ1bmN0aW9uKHgpIHsgcmV0dXJuIHgua2V5OyB9KTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBgdHJ1ZWAgaWYgKiprZXkqKiBpcyBpbiB0aGUgcXVldWUgYW5kIGBmYWxzZWAgaWYgbm90LlxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgcmV0dXJuIGtleSBpbiB0aGlzLl9rZXlJbmRpY2VzO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBwcmlvcml0eSBmb3IgKiprZXkqKi4gSWYgKiprZXkqKiBpcyBub3QgcHJlc2VudCBpbiB0aGUgcXVldWVcbiAqIHRoZW4gdGhpcyBmdW5jdGlvbiByZXR1cm5zIGB1bmRlZmluZWRgLiBUYWtlcyBgTygxKWAgdGltZS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0ga2V5XG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLnByaW9yaXR5ID0gZnVuY3Rpb24oa2V5KSB7XG4gIHZhciBpbmRleCA9IHRoaXMuX2tleUluZGljZXNba2V5XTtcbiAgaWYgKGluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdGhpcy5fYXJyW2luZGV4XS5wcmlvcml0eTtcbiAgfVxufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBrZXkgZm9yIHRoZSBtaW5pbXVtIGVsZW1lbnQgaW4gdGhpcyBxdWV1ZS4gSWYgdGhlIHF1ZXVlIGlzXG4gKiBlbXB0eSB0aGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvci4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5zaXplKCkgPT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJRdWV1ZSB1bmRlcmZsb3dcIik7XG4gIH1cbiAgcmV0dXJuIHRoaXMuX2FyclswXS5rZXk7XG59O1xuXG4vKipcbiAqIEluc2VydHMgYSBuZXcga2V5IGludG8gdGhlIHByaW9yaXR5IHF1ZXVlLiBJZiB0aGUga2V5IGFscmVhZHkgZXhpc3RzIGluXG4gKiB0aGUgcXVldWUgdGhpcyBmdW5jdGlvbiByZXR1cm5zIGBmYWxzZWA7IG90aGVyd2lzZSBpdCB3aWxsIHJldHVybiBgdHJ1ZWAuXG4gKiBUYWtlcyBgTyhuKWAgdGltZS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0ga2V5IHRoZSBrZXkgdG8gYWRkXG4gKiBAcGFyYW0ge051bWJlcn0gcHJpb3JpdHkgdGhlIGluaXRpYWwgcHJpb3JpdHkgZm9yIHRoZSBrZXlcbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oa2V5LCBwcmlvcml0eSkge1xuICB2YXIga2V5SW5kaWNlcyA9IHRoaXMuX2tleUluZGljZXM7XG4gIGlmICghKGtleSBpbiBrZXlJbmRpY2VzKSkge1xuICAgIHZhciBhcnIgPSB0aGlzLl9hcnI7XG4gICAgdmFyIGluZGV4ID0gYXJyLmxlbmd0aDtcbiAgICBrZXlJbmRpY2VzW2tleV0gPSBpbmRleDtcbiAgICBhcnIucHVzaCh7a2V5OiBrZXksIHByaW9yaXR5OiBwcmlvcml0eX0pO1xuICAgIHRoaXMuX2RlY3JlYXNlKGluZGV4KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKipcbiAqIFJlbW92ZXMgYW5kIHJldHVybnMgdGhlIHNtYWxsZXN0IGtleSBpbiB0aGUgcXVldWUuIFRha2VzIGBPKGxvZyBuKWAgdGltZS5cbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUucmVtb3ZlTWluID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX3N3YXAoMCwgdGhpcy5fYXJyLmxlbmd0aCAtIDEpO1xuICB2YXIgbWluID0gdGhpcy5fYXJyLnBvcCgpO1xuICBkZWxldGUgdGhpcy5fa2V5SW5kaWNlc1ttaW4ua2V5XTtcbiAgdGhpcy5faGVhcGlmeSgwKTtcbiAgcmV0dXJuIG1pbi5rZXk7XG59O1xuXG4vKipcbiAqIERlY3JlYXNlcyB0aGUgcHJpb3JpdHkgZm9yICoqa2V5KiogdG8gKipwcmlvcml0eSoqLiBJZiB0aGUgbmV3IHByaW9yaXR5IGlzXG4gKiBncmVhdGVyIHRoYW4gdGhlIHByZXZpb3VzIHByaW9yaXR5LCB0aGlzIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGtleSB0aGUga2V5IGZvciB3aGljaCB0byByYWlzZSBwcmlvcml0eVxuICogQHBhcmFtIHtOdW1iZXJ9IHByaW9yaXR5IHRoZSBuZXcgcHJpb3JpdHkgZm9yIHRoZSBrZXlcbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuZGVjcmVhc2UgPSBmdW5jdGlvbihrZXksIHByaW9yaXR5KSB7XG4gIHZhciBpbmRleCA9IHRoaXMuX2tleUluZGljZXNba2V5XTtcbiAgaWYgKHByaW9yaXR5ID4gdGhpcy5fYXJyW2luZGV4XS5wcmlvcml0eSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk5ldyBwcmlvcml0eSBpcyBncmVhdGVyIHRoYW4gY3VycmVudCBwcmlvcml0eS4gXCIgK1xuICAgICAgICBcIktleTogXCIgKyBrZXkgKyBcIiBPbGQ6IFwiICsgdGhpcy5fYXJyW2luZGV4XS5wcmlvcml0eSArIFwiIE5ldzogXCIgKyBwcmlvcml0eSk7XG4gIH1cbiAgdGhpcy5fYXJyW2luZGV4XS5wcmlvcml0eSA9IHByaW9yaXR5O1xuICB0aGlzLl9kZWNyZWFzZShpbmRleCk7XG59O1xuXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5faGVhcGlmeSA9IGZ1bmN0aW9uKGkpIHtcbiAgdmFyIGFyciA9IHRoaXMuX2FycjtcbiAgdmFyIGwgPSAyICogaSxcbiAgICAgIHIgPSBsICsgMSxcbiAgICAgIGxhcmdlc3QgPSBpO1xuICBpZiAobCA8IGFyci5sZW5ndGgpIHtcbiAgICBsYXJnZXN0ID0gYXJyW2xdLnByaW9yaXR5IDwgYXJyW2xhcmdlc3RdLnByaW9yaXR5ID8gbCA6IGxhcmdlc3Q7XG4gICAgaWYgKHIgPCBhcnIubGVuZ3RoKSB7XG4gICAgICBsYXJnZXN0ID0gYXJyW3JdLnByaW9yaXR5IDwgYXJyW2xhcmdlc3RdLnByaW9yaXR5ID8gciA6IGxhcmdlc3Q7XG4gICAgfVxuICAgIGlmIChsYXJnZXN0ICE9PSBpKSB7XG4gICAgICB0aGlzLl9zd2FwKGksIGxhcmdlc3QpO1xuICAgICAgdGhpcy5faGVhcGlmeShsYXJnZXN0KTtcbiAgICB9XG4gIH1cbn07XG5cblByaW9yaXR5UXVldWUucHJvdG90eXBlLl9kZWNyZWFzZSA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gIHZhciBhcnIgPSB0aGlzLl9hcnI7XG4gIHZhciBwcmlvcml0eSA9IGFycltpbmRleF0ucHJpb3JpdHk7XG4gIHZhciBwYXJlbnQ7XG4gIHdoaWxlIChpbmRleCAhPT0gMCkge1xuICAgIHBhcmVudCA9IGluZGV4ID4+IDE7XG4gICAgaWYgKGFycltwYXJlbnRdLnByaW9yaXR5IDwgcHJpb3JpdHkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICB0aGlzLl9zd2FwKGluZGV4LCBwYXJlbnQpO1xuICAgIGluZGV4ID0gcGFyZW50O1xuICB9XG59O1xuXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5fc3dhcCA9IGZ1bmN0aW9uKGksIGopIHtcbiAgdmFyIGFyciA9IHRoaXMuX2FycjtcbiAgdmFyIGtleUluZGljZXMgPSB0aGlzLl9rZXlJbmRpY2VzO1xuICB2YXIgb3JpZ0FyckkgPSBhcnJbaV07XG4gIHZhciBvcmlnQXJySiA9IGFycltqXTtcbiAgYXJyW2ldID0gb3JpZ0Fycko7XG4gIGFycltqXSA9IG9yaWdBcnJJO1xuICBrZXlJbmRpY2VzW29yaWdBcnJKLmtleV0gPSBpO1xuICBrZXlJbmRpY2VzW29yaWdBcnJJLmtleV0gPSBqO1xufTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gU2V0O1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBuZXcgU2V0IHdpdGggYW4gb3B0aW9uYWwgc2V0IG9mIGBpbml0aWFsS2V5c2AuXG4gKlxuICogSXQgaXMgaW1wb3J0YW50IHRvIG5vdGUgdGhhdCBrZXlzIGFyZSBjb2VyY2VkIHRvIFN0cmluZyBmb3IgbW9zdCBwdXJwb3Nlc1xuICogd2l0aCB0aGlzIG9iamVjdCwgc2ltaWxhciB0byB0aGUgYmVoYXZpb3Igb2YgSmF2YVNjcmlwdCdzIE9iamVjdC4gRm9yXG4gKiBleGFtcGxlLCB0aGUgZm9sbG93aW5nIHdpbGwgYWRkIG9ubHkgb25lIGtleTpcbiAqXG4gKiAgICAgdmFyIHMgPSBuZXcgU2V0KCk7XG4gKiAgICAgcy5hZGQoMSk7XG4gKiAgICAgcy5hZGQoXCIxXCIpO1xuICpcbiAqIEhvd2V2ZXIsIHRoZSB0eXBlIG9mIHRoZSBrZXkgaXMgcHJlc2VydmVkIGludGVybmFsbHkgc28gdGhhdCBga2V5c2AgcmV0dXJuc1xuICogdGhlIG9yaWdpbmFsIGtleSBzZXQgdW5jb2VyY2VkLiBGb3IgdGhlIGFib3ZlIGV4YW1wbGUsIGBrZXlzYCB3b3VsZCByZXR1cm5cbiAqIGBbMV1gLlxuICovXG5mdW5jdGlvbiBTZXQoaW5pdGlhbEtleXMpIHtcbiAgdGhpcy5fc2l6ZSA9IDA7XG4gIHRoaXMuX2tleXMgPSB7fTtcblxuICBpZiAoaW5pdGlhbEtleXMpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgaWwgPSBpbml0aWFsS2V5cy5sZW5ndGg7IGkgPCBpbDsgKytpKSB7XG4gICAgICB0aGlzLmFkZChpbml0aWFsS2V5c1tpXSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUmV0dXJucyBhIG5ldyBTZXQgdGhhdCByZXByZXNlbnRzIHRoZSBzZXQgaW50ZXJzZWN0aW9uIG9mIHRoZSBhcnJheSBvZiBnaXZlblxuICogc2V0cy5cbiAqL1xuU2V0LmludGVyc2VjdCA9IGZ1bmN0aW9uKHNldHMpIHtcbiAgaWYgKHNldHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBTZXQoKTtcbiAgfVxuXG4gIHZhciByZXN1bHQgPSBuZXcgU2V0KCF1dGlsLmlzQXJyYXkoc2V0c1swXSkgPyBzZXRzWzBdLmtleXMoKSA6IHNldHNbMF0pO1xuICBmb3IgKHZhciBpID0gMSwgaWwgPSBzZXRzLmxlbmd0aDsgaSA8IGlsOyArK2kpIHtcbiAgICB2YXIgcmVzdWx0S2V5cyA9IHJlc3VsdC5rZXlzKCksXG4gICAgICAgIG90aGVyID0gIXV0aWwuaXNBcnJheShzZXRzW2ldKSA/IHNldHNbaV0gOiBuZXcgU2V0KHNldHNbaV0pO1xuICAgIGZvciAodmFyIGogPSAwLCBqbCA9IHJlc3VsdEtleXMubGVuZ3RoOyBqIDwgamw7ICsraikge1xuICAgICAgdmFyIGtleSA9IHJlc3VsdEtleXNbal07XG4gICAgICBpZiAoIW90aGVyLmhhcyhrZXkpKSB7XG4gICAgICAgIHJlc3VsdC5yZW1vdmUoa2V5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgbmV3IFNldCB0aGF0IHJlcHJlc2VudHMgdGhlIHNldCB1bmlvbiBvZiB0aGUgYXJyYXkgb2YgZ2l2ZW4gc2V0cy5cbiAqL1xuU2V0LnVuaW9uID0gZnVuY3Rpb24oc2V0cykge1xuICB2YXIgdG90YWxFbGVtcyA9IHV0aWwucmVkdWNlKHNldHMsIGZ1bmN0aW9uKGxocywgcmhzKSB7XG4gICAgcmV0dXJuIGxocyArIChyaHMuc2l6ZSA/IHJocy5zaXplKCkgOiByaHMubGVuZ3RoKTtcbiAgfSwgMCk7XG4gIHZhciBhcnIgPSBuZXcgQXJyYXkodG90YWxFbGVtcyk7XG5cbiAgdmFyIGsgPSAwO1xuICBmb3IgKHZhciBpID0gMCwgaWwgPSBzZXRzLmxlbmd0aDsgaSA8IGlsOyArK2kpIHtcbiAgICB2YXIgY3VyID0gc2V0c1tpXSxcbiAgICAgICAga2V5cyA9ICF1dGlsLmlzQXJyYXkoY3VyKSA/IGN1ci5rZXlzKCkgOiBjdXI7XG4gICAgZm9yICh2YXIgaiA9IDAsIGpsID0ga2V5cy5sZW5ndGg7IGogPCBqbDsgKytqKSB7XG4gICAgICBhcnJbaysrXSA9IGtleXNbal07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ldyBTZXQoYXJyKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgc2l6ZSBvZiB0aGlzIHNldCBpbiBgTygxKWAgdGltZS5cbiAqL1xuU2V0LnByb3RvdHlwZS5zaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9zaXplO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBrZXlzIGluIHRoaXMgc2V0LiBUYWtlcyBgTyhuKWAgdGltZS5cbiAqL1xuU2V0LnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB2YWx1ZXModGhpcy5fa2V5cyk7XG59O1xuXG4vKipcbiAqIFRlc3RzIGlmIGEga2V5IGlzIHByZXNlbnQgaW4gdGhpcyBTZXQuIFJldHVybnMgYHRydWVgIGlmIGl0IGlzIGFuZCBgZmFsc2VgXG4gKiBpZiBub3QuIFRha2VzIGBPKDEpYCB0aW1lLlxuICovXG5TZXQucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKGtleSkge1xuICByZXR1cm4ga2V5IGluIHRoaXMuX2tleXM7XG59O1xuXG4vKipcbiAqIEFkZHMgYSBuZXcga2V5IHRvIHRoaXMgU2V0IGlmIGl0IGlzIG5vdCBhbHJlYWR5IHByZXNlbnQuIFJldHVybnMgYHRydWVgIGlmXG4gKiB0aGUga2V5IHdhcyBhZGRlZCBhbmQgYGZhbHNlYCBpZiBpdCB3YXMgYWxyZWFkeSBwcmVzZW50LiBUYWtlcyBgTygxKWAgdGltZS5cbiAqL1xuU2V0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihrZXkpIHtcbiAgaWYgKCEoa2V5IGluIHRoaXMuX2tleXMpKSB7XG4gICAgdGhpcy5fa2V5c1trZXldID0ga2V5O1xuICAgICsrdGhpcy5fc2l6ZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKipcbiAqIFJlbW92ZXMgYSBrZXkgZnJvbSB0aGlzIFNldC4gSWYgdGhlIGtleSB3YXMgcmVtb3ZlZCB0aGlzIGZ1bmN0aW9uIHJldHVybnNcbiAqIGB0cnVlYC4gSWYgbm90LCBpdCByZXR1cm5zIGBmYWxzZWAuIFRha2VzIGBPKDEpYCB0aW1lLlxuICovXG5TZXQucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKGtleSkge1xuICBpZiAoa2V5IGluIHRoaXMuX2tleXMpIHtcbiAgICBkZWxldGUgdGhpcy5fa2V5c1trZXldO1xuICAgIC0tdGhpcy5fc2l6ZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBhbGwgdmFsdWVzIGZvciBwcm9wZXJ0aWVzIG9mICoqbyoqLlxuICovXG5mdW5jdGlvbiB2YWx1ZXMobykge1xuICB2YXIga3MgPSBPYmplY3Qua2V5cyhvKSxcbiAgICAgIGxlbiA9IGtzLmxlbmd0aCxcbiAgICAgIHJlc3VsdCA9IG5ldyBBcnJheShsZW4pLFxuICAgICAgaTtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgcmVzdWx0W2ldID0gb1trc1tpXV07XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsIi8qXG4gKiBUaGlzIHBvbHlmaWxsIGNvbWVzIGZyb21cbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L2lzQXJyYXlcbiAqL1xuaWYoIUFycmF5LmlzQXJyYXkpIHtcbiAgZXhwb3J0cy5pc0FycmF5ID0gZnVuY3Rpb24gKHZBcmcpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZBcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xuICB9O1xufSBlbHNlIHtcbiAgZXhwb3J0cy5pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbn1cblxuLypcbiAqIFNsaWdodGx5IGFkYXB0ZWQgcG9seWZpbGwgZnJvbVxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvUmVkdWNlXG4gKi9cbmlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YgQXJyYXkucHJvdG90eXBlLnJlZHVjZSkge1xuICBleHBvcnRzLnJlZHVjZSA9IGZ1bmN0aW9uKGFycmF5LCBjYWxsYmFjaywgb3B0X2luaXRpYWxWYWx1ZSkge1xuICAgICd1c2Ugc3RyaWN0JztcbiAgICBpZiAobnVsbCA9PT0gYXJyYXkgfHwgJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBhcnJheSkge1xuICAgICAgLy8gQXQgdGhlIG1vbWVudCBhbGwgbW9kZXJuIGJyb3dzZXJzLCB0aGF0IHN1cHBvcnQgc3RyaWN0IG1vZGUsIGhhdmVcbiAgICAgIC8vIG5hdGl2ZSBpbXBsZW1lbnRhdGlvbiBvZiBBcnJheS5wcm90b3R5cGUucmVkdWNlLiBGb3IgaW5zdGFuY2UsIElFOFxuICAgICAgLy8gZG9lcyBub3Qgc3VwcG9ydCBzdHJpY3QgbW9kZSwgc28gdGhpcyBjaGVjayBpcyBhY3R1YWxseSB1c2VsZXNzLlxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAnQXJyYXkucHJvdG90eXBlLnJlZHVjZSBjYWxsZWQgb24gbnVsbCBvciB1bmRlZmluZWQnKTtcbiAgICB9XG4gICAgaWYgKCdmdW5jdGlvbicgIT09IHR5cGVvZiBjYWxsYmFjaykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihjYWxsYmFjayArICcgaXMgbm90IGEgZnVuY3Rpb24nKTtcbiAgICB9XG4gICAgdmFyIGluZGV4LCB2YWx1ZSxcbiAgICAgICAgbGVuZ3RoID0gYXJyYXkubGVuZ3RoID4+PiAwLFxuICAgICAgICBpc1ZhbHVlU2V0ID0gZmFsc2U7XG4gICAgaWYgKDEgPCBhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICB2YWx1ZSA9IG9wdF9pbml0aWFsVmFsdWU7XG4gICAgICBpc1ZhbHVlU2V0ID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChpbmRleCA9IDA7IGxlbmd0aCA+IGluZGV4OyArK2luZGV4KSB7XG4gICAgICBpZiAoYXJyYXkuaGFzT3duUHJvcGVydHkoaW5kZXgpKSB7XG4gICAgICAgIGlmIChpc1ZhbHVlU2V0KSB7XG4gICAgICAgICAgdmFsdWUgPSBjYWxsYmFjayh2YWx1ZSwgYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gYXJyYXlbaW5kZXhdO1xuICAgICAgICAgIGlzVmFsdWVTZXQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghaXNWYWx1ZVNldCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZScpO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG59IGVsc2Uge1xuICBleHBvcnRzLnJlZHVjZSA9IGZ1bmN0aW9uKGFycmF5LCBjYWxsYmFjaywgb3B0X2luaXRpYWxWYWx1ZSkge1xuICAgIHJldHVybiBhcnJheS5yZWR1Y2UoY2FsbGJhY2ssIG9wdF9pbml0aWFsVmFsdWUpO1xuICB9O1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSAnMS4xLjMnO1xuIiwiZXhwb3J0cy5HcmFwaCA9IHJlcXVpcmUoXCIuL2xpYi9HcmFwaFwiKTtcbmV4cG9ydHMuRGlncmFwaCA9IHJlcXVpcmUoXCIuL2xpYi9EaWdyYXBoXCIpO1xuZXhwb3J0cy5DR3JhcGggPSByZXF1aXJlKFwiLi9saWIvQ0dyYXBoXCIpO1xuZXhwb3J0cy5DRGlncmFwaCA9IHJlcXVpcmUoXCIuL2xpYi9DRGlncmFwaFwiKTtcbnJlcXVpcmUoXCIuL2xpYi9ncmFwaC1jb252ZXJ0ZXJzXCIpO1xuXG5leHBvcnRzLmFsZyA9IHtcbiAgaXNBY3ljbGljOiByZXF1aXJlKFwiLi9saWIvYWxnL2lzQWN5Y2xpY1wiKSxcbiAgY29tcG9uZW50czogcmVxdWlyZShcIi4vbGliL2FsZy9jb21wb25lbnRzXCIpLFxuICBkaWprc3RyYTogcmVxdWlyZShcIi4vbGliL2FsZy9kaWprc3RyYVwiKSxcbiAgZGlqa3N0cmFBbGw6IHJlcXVpcmUoXCIuL2xpYi9hbGcvZGlqa3N0cmFBbGxcIiksXG4gIGZpbmRDeWNsZXM6IHJlcXVpcmUoXCIuL2xpYi9hbGcvZmluZEN5Y2xlc1wiKSxcbiAgZmxveWRXYXJzaGFsbDogcmVxdWlyZShcIi4vbGliL2FsZy9mbG95ZFdhcnNoYWxsXCIpLFxuICBwb3N0b3JkZXI6IHJlcXVpcmUoXCIuL2xpYi9hbGcvcG9zdG9yZGVyXCIpLFxuICBwcmVvcmRlcjogcmVxdWlyZShcIi4vbGliL2FsZy9wcmVvcmRlclwiKSxcbiAgcHJpbTogcmVxdWlyZShcIi4vbGliL2FsZy9wcmltXCIpLFxuICB0YXJqYW46IHJlcXVpcmUoXCIuL2xpYi9hbGcvdGFyamFuXCIpLFxuICB0b3Bzb3J0OiByZXF1aXJlKFwiLi9saWIvYWxnL3RvcHNvcnRcIilcbn07XG5cbmV4cG9ydHMuY29udmVydGVyID0ge1xuICBqc29uOiByZXF1aXJlKFwiLi9saWIvY29udmVydGVyL2pzb24uanNcIilcbn07XG5cbnZhciBmaWx0ZXIgPSByZXF1aXJlKFwiLi9saWIvZmlsdGVyXCIpO1xuZXhwb3J0cy5maWx0ZXIgPSB7XG4gIGFsbDogZmlsdGVyLmFsbCxcbiAgbm9kZXNGcm9tTGlzdDogZmlsdGVyLm5vZGVzRnJvbUxpc3Rcbn07XG5cbmV4cG9ydHMudmVyc2lvbiA9IHJlcXVpcmUoXCIuL2xpYi92ZXJzaW9uXCIpO1xuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gQmFzZUdyYXBoO1xuXG5mdW5jdGlvbiBCYXNlR3JhcGgoKSB7XG4gIC8vIFRoZSB2YWx1ZSBhc3NpZ25lZCB0byB0aGUgZ3JhcGggaXRzZWxmLlxuICB0aGlzLl92YWx1ZSA9IHVuZGVmaW5lZDtcblxuICAvLyBNYXAgb2Ygbm9kZSBpZCAtPiB7IGlkLCB2YWx1ZSB9XG4gIHRoaXMuX25vZGVzID0ge307XG5cbiAgLy8gTWFwIG9mIGVkZ2UgaWQgLT4geyBpZCwgdSwgdiwgdmFsdWUgfVxuICB0aGlzLl9lZGdlcyA9IHt9O1xuXG4gIC8vIFVzZWQgdG8gZ2VuZXJhdGUgYSB1bmlxdWUgaWQgaW4gdGhlIGdyYXBoXG4gIHRoaXMuX25leHRJZCA9IDA7XG59XG5cbi8vIE51bWJlciBvZiBub2Rlc1xuQmFzZUdyYXBoLnByb3RvdHlwZS5vcmRlciA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fbm9kZXMpLmxlbmd0aDtcbn07XG5cbi8vIE51bWJlciBvZiBlZGdlc1xuQmFzZUdyYXBoLnByb3RvdHlwZS5zaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9lZGdlcykubGVuZ3RoO1xufTtcblxuLy8gQWNjZXNzb3IgZm9yIGdyYXBoIGxldmVsIHZhbHVlXG5CYXNlR3JhcGgucHJvdG90eXBlLmdyYXBoID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gdGhpcy5fdmFsdWU7XG4gIH1cbiAgdGhpcy5fdmFsdWUgPSB2YWx1ZTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuaGFzTm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgcmV0dXJuIHUgaW4gdGhpcy5fbm9kZXM7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLm5vZGUgPSBmdW5jdGlvbih1LCB2YWx1ZSkge1xuICB2YXIgbm9kZSA9IHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgbm9kZS52YWx1ZSA9IHZhbHVlO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5ub2RlcyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbm9kZXMgPSBbXTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbihpZCkgeyBub2Rlcy5wdXNoKGlkKTsgfSk7XG4gIHJldHVybiBub2Rlcztcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZWFjaE5vZGUgPSBmdW5jdGlvbihmdW5jKSB7XG4gIGZvciAodmFyIGsgaW4gdGhpcy5fbm9kZXMpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuX25vZGVzW2tdO1xuICAgIGZ1bmMobm9kZS5pZCwgbm9kZS52YWx1ZSk7XG4gIH1cbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuaGFzRWRnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIGUgaW4gdGhpcy5fZWRnZXM7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmVkZ2UgPSBmdW5jdGlvbihlLCB2YWx1ZSkge1xuICB2YXIgZWRnZSA9IHRoaXMuX3N0cmljdEdldEVkZ2UoZSk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGVkZ2UudmFsdWU7XG4gIH1cbiAgZWRnZS52YWx1ZSA9IHZhbHVlO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5lZGdlcyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZXMgPSBbXTtcbiAgdGhpcy5lYWNoRWRnZShmdW5jdGlvbihpZCkgeyBlcy5wdXNoKGlkKTsgfSk7XG4gIHJldHVybiBlcztcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZWFjaEVkZ2UgPSBmdW5jdGlvbihmdW5jKSB7XG4gIGZvciAodmFyIGsgaW4gdGhpcy5fZWRnZXMpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMuX2VkZ2VzW2tdO1xuICAgIGZ1bmMoZWRnZS5pZCwgZWRnZS51LCBlZGdlLnYsIGVkZ2UudmFsdWUpO1xuICB9XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmluY2lkZW50Tm9kZXMgPSBmdW5jdGlvbihlKSB7XG4gIHZhciBlZGdlID0gdGhpcy5fc3RyaWN0R2V0RWRnZShlKTtcbiAgcmV0dXJuIFtlZGdlLnUsIGVkZ2Uudl07XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmFkZE5vZGUgPSBmdW5jdGlvbih1LCB2YWx1ZSkge1xuICBpZiAodSA9PT0gdW5kZWZpbmVkIHx8IHUgPT09IG51bGwpIHtcbiAgICBkbyB7XG4gICAgICB1ID0gXCJfXCIgKyAoKyt0aGlzLl9uZXh0SWQpO1xuICAgIH0gd2hpbGUgKHRoaXMuaGFzTm9kZSh1KSk7XG4gIH0gZWxzZSBpZiAodGhpcy5oYXNOb2RlKHUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiR3JhcGggYWxyZWFkeSBoYXMgbm9kZSAnXCIgKyB1ICsgXCInXCIpO1xuICB9XG4gIHRoaXMuX25vZGVzW3VdID0geyBpZDogdSwgdmFsdWU6IHZhbHVlIH07XG4gIHJldHVybiB1O1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5kZWxOb2RlID0gZnVuY3Rpb24odSkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICB0aGlzLmluY2lkZW50RWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7IHRoaXMuZGVsRWRnZShlKTsgfSwgdGhpcyk7XG4gIGRlbGV0ZSB0aGlzLl9ub2Rlc1t1XTtcbn07XG5cbi8vIGluTWFwIGFuZCBvdXRNYXAgYXJlIG9wcG9zaXRlIHNpZGVzIG9mIGFuIGluY2lkZW5jZSBtYXAuIEZvciBleGFtcGxlLCBmb3Jcbi8vIEdyYXBoIHRoZXNlIHdvdWxkIGJvdGggY29tZSBmcm9tIHRoZSBfaW5jaWRlbnRFZGdlcyBtYXAsIHdoaWxlIGZvciBEaWdyYXBoXG4vLyB0aGV5IHdvdWxkIGNvbWUgZnJvbSBfaW5FZGdlcyBhbmQgX291dEVkZ2VzLlxuQmFzZUdyYXBoLnByb3RvdHlwZS5fYWRkRWRnZSA9IGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlLCBpbk1hcCwgb3V0TWFwKSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodik7XG5cbiAgaWYgKGUgPT09IHVuZGVmaW5lZCB8fCBlID09PSBudWxsKSB7XG4gICAgZG8ge1xuICAgICAgZSA9IFwiX1wiICsgKCsrdGhpcy5fbmV4dElkKTtcbiAgICB9IHdoaWxlICh0aGlzLmhhc0VkZ2UoZSkpO1xuICB9XG4gIGVsc2UgaWYgKHRoaXMuaGFzRWRnZShlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkdyYXBoIGFscmVhZHkgaGFzIGVkZ2UgJ1wiICsgZSArIFwiJ1wiKTtcbiAgfVxuXG4gIHRoaXMuX2VkZ2VzW2VdID0geyBpZDogZSwgdTogdSwgdjogdiwgdmFsdWU6IHZhbHVlIH07XG4gIGFkZEVkZ2VUb01hcChpbk1hcFt2XSwgdSwgZSk7XG4gIGFkZEVkZ2VUb01hcChvdXRNYXBbdV0sIHYsIGUpO1xuXG4gIHJldHVybiBlO1xufTtcblxuLy8gU2VlIG5vdGUgZm9yIF9hZGRFZGdlIHJlZ2FyZGluZyBpbk1hcCBhbmQgb3V0TWFwLlxuQmFzZUdyYXBoLnByb3RvdHlwZS5fZGVsRWRnZSA9IGZ1bmN0aW9uKGUsIGluTWFwLCBvdXRNYXApIHtcbiAgdmFyIGVkZ2UgPSB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpO1xuICBkZWxFZGdlRnJvbU1hcChpbk1hcFtlZGdlLnZdLCBlZGdlLnUsIGUpO1xuICBkZWxFZGdlRnJvbU1hcChvdXRNYXBbZWRnZS51XSwgZWRnZS52LCBlKTtcbiAgZGVsZXRlIHRoaXMuX2VkZ2VzW2VdO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBjb3B5ID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgY29weS5ncmFwaCh0aGlzLmdyYXBoKCkpO1xuICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7IGNvcHkuYWRkTm9kZSh1LCB2YWx1ZSk7IH0pO1xuICB0aGlzLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7IGNvcHkuYWRkRWRnZShlLCB1LCB2LCB2YWx1ZSk7IH0pO1xuICBjb3B5Ll9uZXh0SWQgPSB0aGlzLl9uZXh0SWQ7XG4gIHJldHVybiBjb3B5O1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5maWx0ZXJOb2RlcyA9IGZ1bmN0aW9uKGZpbHRlcikge1xuICB2YXIgY29weSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gIGNvcHkuZ3JhcGgodGhpcy5ncmFwaCgpKTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIGlmIChmaWx0ZXIodSkpIHtcbiAgICAgIGNvcHkuYWRkTm9kZSh1LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgdGhpcy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGlmIChjb3B5Lmhhc05vZGUodSkgJiYgY29weS5oYXNOb2RlKHYpKSB7XG4gICAgICBjb3B5LmFkZEVkZ2UoZSwgdSwgdiwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBjb3B5O1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5fc3RyaWN0R2V0Tm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgdmFyIG5vZGUgPSB0aGlzLl9ub2Rlc1t1XTtcbiAgaWYgKG5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk5vZGUgJ1wiICsgdSArIFwiJyBpcyBub3QgaW4gZ3JhcGhcIik7XG4gIH1cbiAgcmV0dXJuIG5vZGU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLl9zdHJpY3RHZXRFZGdlID0gZnVuY3Rpb24oZSkge1xuICB2YXIgZWRnZSA9IHRoaXMuX2VkZ2VzW2VdO1xuICBpZiAoZWRnZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRWRnZSAnXCIgKyBlICsgXCInIGlzIG5vdCBpbiBncmFwaFwiKTtcbiAgfVxuICByZXR1cm4gZWRnZTtcbn07XG5cbmZ1bmN0aW9uIGFkZEVkZ2VUb01hcChtYXAsIHYsIGUpIHtcbiAgKG1hcFt2XSB8fCAobWFwW3ZdID0gbmV3IFNldCgpKSkuYWRkKGUpO1xufVxuXG5mdW5jdGlvbiBkZWxFZGdlRnJvbU1hcChtYXAsIHYsIGUpIHtcbiAgdmFyIHZFbnRyeSA9IG1hcFt2XTtcbiAgdkVudHJ5LnJlbW92ZShlKTtcbiAgaWYgKHZFbnRyeS5zaXplKCkgPT09IDApIHtcbiAgICBkZWxldGUgbWFwW3ZdO1xuICB9XG59XG5cbiIsInZhciBEaWdyYXBoID0gcmVxdWlyZShcIi4vRGlncmFwaFwiKSxcbiAgICBjb21wb3VuZGlmeSA9IHJlcXVpcmUoXCIuL2NvbXBvdW5kaWZ5XCIpO1xuXG52YXIgQ0RpZ3JhcGggPSBjb21wb3VuZGlmeShEaWdyYXBoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBDRGlncmFwaDtcblxuQ0RpZ3JhcGguZnJvbURpZ3JhcGggPSBmdW5jdGlvbihzcmMpIHtcbiAgdmFyIGcgPSBuZXcgQ0RpZ3JhcGgoKSxcbiAgICAgIGdyYXBoVmFsdWUgPSBzcmMuZ3JhcGgoKTtcblxuICBpZiAoZ3JhcGhWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZy5ncmFwaChncmFwaFZhbHVlKTtcbiAgfVxuXG4gIHNyYy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLmFkZE5vZGUodSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkTm9kZSh1LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgc3JjLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZztcbn07XG5cbkNEaWdyYXBoLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJDRGlncmFwaCBcIiArIEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIDIpO1xufTtcbiIsInZhciBHcmFwaCA9IHJlcXVpcmUoXCIuL0dyYXBoXCIpLFxuICAgIGNvbXBvdW5kaWZ5ID0gcmVxdWlyZShcIi4vY29tcG91bmRpZnlcIik7XG5cbnZhciBDR3JhcGggPSBjb21wb3VuZGlmeShHcmFwaCk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ0dyYXBoO1xuXG5DR3JhcGguZnJvbUdyYXBoID0gZnVuY3Rpb24oc3JjKSB7XG4gIHZhciBnID0gbmV3IENHcmFwaCgpLFxuICAgICAgZ3JhcGhWYWx1ZSA9IHNyYy5ncmFwaCgpO1xuXG4gIGlmIChncmFwaFZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICBnLmdyYXBoKGdyYXBoVmFsdWUpO1xuICB9XG5cbiAgc3JjLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGcuYWRkTm9kZSh1KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGROb2RlKHUsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICBzcmMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdiwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBnO1xufTtcblxuQ0dyYXBoLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJDR3JhcGggXCIgKyBKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCAyKTtcbn07XG4iLCIvKlxuICogVGhpcyBmaWxlIGlzIG9yZ2FuaXplZCB3aXRoIGluIHRoZSBmb2xsb3dpbmcgb3JkZXI6XG4gKlxuICogRXhwb3J0c1xuICogR3JhcGggY29uc3RydWN0b3JzXG4gKiBHcmFwaCBxdWVyaWVzIChlLmcuIG5vZGVzKCksIGVkZ2VzKClcbiAqIEdyYXBoIG11dGF0b3JzXG4gKiBIZWxwZXIgZnVuY3Rpb25zXG4gKi9cblxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpLFxuICAgIEJhc2VHcmFwaCA9IHJlcXVpcmUoXCIuL0Jhc2VHcmFwaFwiKSxcbi8qIGpzaGludCAtVzA3OSAqL1xuICAgIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IERpZ3JhcGg7XG5cbi8qXG4gKiBDb25zdHJ1Y3RvciB0byBjcmVhdGUgYSBuZXcgZGlyZWN0ZWQgbXVsdGktZ3JhcGguXG4gKi9cbmZ1bmN0aW9uIERpZ3JhcGgoKSB7XG4gIEJhc2VHcmFwaC5jYWxsKHRoaXMpO1xuXG4gIC8qISBNYXAgb2Ygc291cmNlSWQgLT4ge3RhcmdldElkIC0+IFNldCBvZiBlZGdlIGlkc30gKi9cbiAgdGhpcy5faW5FZGdlcyA9IHt9O1xuXG4gIC8qISBNYXAgb2YgdGFyZ2V0SWQgLT4ge3NvdXJjZUlkIC0+IFNldCBvZiBlZGdlIGlkc30gKi9cbiAgdGhpcy5fb3V0RWRnZXMgPSB7fTtcbn1cblxuRGlncmFwaC5wcm90b3R5cGUgPSBuZXcgQmFzZUdyYXBoKCk7XG5EaWdyYXBoLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IERpZ3JhcGg7XG5cbi8qXG4gKiBBbHdheXMgcmV0dXJucyBgdHJ1ZWAuXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmlzRGlyZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgc3VjY2Vzc29ycyBvZiB0aGUgbm9kZSB3aXRoIHRoZSBpZCBgdWAuIFRoYXQgaXMsIGFsbCBub2Rlc1xuICogdGhhdCBoYXZlIHRoZSBub2RlIGB1YCBhcyB0aGVpciBzb3VyY2UgYXJlIHJldHVybmVkLlxuICogXG4gKiBJZiBubyBub2RlIGB1YCBleGlzdHMgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5zdWNjZXNzb3JzID0gZnVuY3Rpb24odSkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fb3V0RWRnZXNbdV0pXG4gICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHRoaXMuX25vZGVzW3ZdLmlkOyB9LCB0aGlzKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBwcmVkZWNlc3NvcnMgb2YgdGhlIG5vZGUgd2l0aCB0aGUgaWQgYHVgLiBUaGF0IGlzLCBhbGwgbm9kZXNcbiAqIHRoYXQgaGF2ZSB0aGUgbm9kZSBgdWAgYXMgdGhlaXIgdGFyZ2V0IGFyZSByZXR1cm5lZC5cbiAqIFxuICogSWYgbm8gbm9kZSBgdWAgZXhpc3RzIGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUucHJlZGVjZXNzb3JzID0gZnVuY3Rpb24odSkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5faW5FZGdlc1t1XSlcbiAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24odikgeyByZXR1cm4gdGhpcy5fbm9kZXNbdl0uaWQ7IH0sIHRoaXMpO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIG5vZGVzIHRoYXQgYXJlIGFkamFjZW50IHRvIHRoZSBub2RlIHdpdGggdGhlIGlkIGB1YC4gSW4gb3RoZXJcbiAqIHdvcmRzLCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgdGhlIHNldCBvZiBhbGwgc3VjY2Vzc29ycyBhbmQgcHJlZGVjZXNzb3JzIG9mXG4gKiBub2RlIGB1YC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUubmVpZ2hib3JzID0gZnVuY3Rpb24odSkge1xuICByZXR1cm4gU2V0LnVuaW9uKFt0aGlzLnN1Y2Nlc3NvcnModSksIHRoaXMucHJlZGVjZXNzb3JzKHUpXSkua2V5cygpO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIG5vZGVzIGluIHRoZSBncmFwaCB0aGF0IGhhdmUgbm8gaW4tZWRnZXMuXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnNvdXJjZXMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gdGhpcy5fZmlsdGVyTm9kZXMoZnVuY3Rpb24odSkge1xuICAgIC8vIFRoaXMgY291bGQgaGF2ZSBiZXR0ZXIgc3BhY2UgY2hhcmFjdGVyaXN0aWNzIGlmIHdlIGhhZCBhbiBpbkRlZ3JlZSBmdW5jdGlvbi5cbiAgICByZXR1cm4gc2VsZi5pbkVkZ2VzKHUpLmxlbmd0aCA9PT0gMDtcbiAgfSk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgbm9kZXMgaW4gdGhlIGdyYXBoIHRoYXQgaGF2ZSBubyBvdXQtZWRnZXMuXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnNpbmtzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgcmV0dXJuIHRoaXMuX2ZpbHRlck5vZGVzKGZ1bmN0aW9uKHUpIHtcbiAgICAvLyBUaGlzIGNvdWxkIGhhdmUgYmV0dGVyIHNwYWNlIGNoYXJhY3RlcmlzdGljcyBpZiB3ZSBoYXZlIGFuIG91dERlZ3JlZSBmdW5jdGlvbi5cbiAgICByZXR1cm4gc2VsZi5vdXRFZGdlcyh1KS5sZW5ndGggPT09IDA7XG4gIH0pO1xufTtcblxuLypcbiAqIFJldHVybnMgdGhlIHNvdXJjZSBub2RlIGluY2lkZW50IG9uIHRoZSBlZGdlIGlkZW50aWZpZWQgYnkgdGhlIGlkIGBlYC4gSWYgbm9cbiAqIHN1Y2ggZWRnZSBleGlzdHMgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBlIGFuIGVkZ2UgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuc291cmNlID0gZnVuY3Rpb24oZSkge1xuICByZXR1cm4gdGhpcy5fc3RyaWN0R2V0RWRnZShlKS51O1xufTtcblxuLypcbiAqIFJldHVybnMgdGhlIHRhcmdldCBub2RlIGluY2lkZW50IG9uIHRoZSBlZGdlIGlkZW50aWZpZWQgYnkgdGhlIGlkIGBlYC4gSWYgbm9cbiAqIHN1Y2ggZWRnZSBleGlzdHMgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBlIGFuIGVkZ2UgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUudGFyZ2V0ID0gZnVuY3Rpb24oZSkge1xuICByZXR1cm4gdGhpcy5fc3RyaWN0R2V0RWRnZShlKS52O1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgaWRzIGZvciBhbGwgZWRnZXMgaW4gdGhlIGdyYXBoIHRoYXQgaGF2ZSB0aGUgbm9kZVxuICogYHRhcmdldGAgYXMgdGhlaXIgdGFyZ2V0LiBJZiB0aGUgbm9kZSBgdGFyZ2V0YCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoaXNcbiAqIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBPcHRpb25hbGx5IGEgYHNvdXJjZWAgbm9kZSBjYW4gYWxzbyBiZSBzcGVjaWZpZWQuIFRoaXMgY2F1c2VzIHRoZSByZXN1bHRzXG4gKiB0byBiZSBmaWx0ZXJlZCBzdWNoIHRoYXQgb25seSBlZGdlcyBmcm9tIGBzb3VyY2VgIHRvIGB0YXJnZXRgIGFyZSBpbmNsdWRlZC5cbiAqIElmIHRoZSBub2RlIGBzb3VyY2VgIGlzIHNwZWNpZmllZCBidXQgaXMgbm90IGluIHRoZSBncmFwaCB0aGVuIHRoaXMgZnVuY3Rpb25cbiAqIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdGFyZ2V0IHRoZSB0YXJnZXQgbm9kZSBpZFxuICogQHBhcmFtIHtTdHJpbmd9IFtzb3VyY2VdIGFuIG9wdGlvbmFsIHNvdXJjZSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmluRWRnZXMgPSBmdW5jdGlvbih0YXJnZXQsIHNvdXJjZSkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHRhcmdldCk7XG4gIHZhciByZXN1bHRzID0gU2V0LnVuaW9uKHV0aWwudmFsdWVzKHRoaXMuX2luRWRnZXNbdGFyZ2V0XSkpLmtleXMoKTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgdGhpcy5fc3RyaWN0R2V0Tm9kZShzb3VyY2UpO1xuICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihmdW5jdGlvbihlKSB7IHJldHVybiB0aGlzLnNvdXJjZShlKSA9PT0gc291cmNlOyB9LCB0aGlzKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0cztcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGlkcyBmb3IgYWxsIGVkZ2VzIGluIHRoZSBncmFwaCB0aGF0IGhhdmUgdGhlIG5vZGVcbiAqIGBzb3VyY2VgIGFzIHRoZWlyIHNvdXJjZS4gSWYgdGhlIG5vZGUgYHNvdXJjZWAgaXMgbm90IGluIHRoZSBncmFwaCB0aGlzXG4gKiBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogT3B0aW9uYWxseSBhIGB0YXJnZXRgIG5vZGUgbWF5IGFsc28gYmUgc3BlY2lmaWVkLiBUaGlzIGNhdXNlcyB0aGUgcmVzdWx0c1xuICogdG8gYmUgZmlsdGVyZWQgc3VjaCB0aGF0IG9ubHkgZWRnZXMgZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YCBhcmUgaW5jbHVkZWQuXG4gKiBJZiB0aGUgbm9kZSBgdGFyZ2V0YCBpcyBzcGVjaWZpZWQgYnV0IGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhlbiB0aGlzIGZ1bmN0aW9uXG4gKiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZSB0aGUgc291cmNlIG5vZGUgaWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBbdGFyZ2V0XSBhbiBvcHRpb25hbCB0YXJnZXQgbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5vdXRFZGdlcyA9IGZ1bmN0aW9uKHNvdXJjZSwgdGFyZ2V0KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUoc291cmNlKTtcbiAgdmFyIHJlc3VsdHMgPSBTZXQudW5pb24odXRpbC52YWx1ZXModGhpcy5fb3V0RWRnZXNbc291cmNlXSkpLmtleXMoKTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh0YXJnZXQpO1xuICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihmdW5jdGlvbihlKSB7IHJldHVybiB0aGlzLnRhcmdldChlKSA9PT0gdGFyZ2V0OyB9LCB0aGlzKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0cztcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGlkcyBmb3IgYWxsIGVkZ2VzIGluIHRoZSBncmFwaCB0aGF0IGhhdmUgdGhlIGB1YCBhc1xuICogdGhlaXIgc291cmNlIG9yIHRoZWlyIHRhcmdldC4gSWYgdGhlIG5vZGUgYHVgIGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhpc1xuICogZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIE9wdGlvbmFsbHkgYSBgdmAgbm9kZSBtYXkgYWxzbyBiZSBzcGVjaWZpZWQuIFRoaXMgY2F1c2VzIHRoZSByZXN1bHRzIHRvIGJlXG4gKiBmaWx0ZXJlZCBzdWNoIHRoYXQgb25seSBlZGdlcyBiZXR3ZWVuIGB1YCBhbmQgYHZgIC0gaW4gZWl0aGVyIGRpcmVjdGlvbiAtXG4gKiBhcmUgaW5jbHVkZWQuIElGIHRoZSBub2RlIGB2YCBpcyBzcGVjaWZpZWQgYnV0IG5vdCBpbiB0aGUgZ3JhcGggdGhlbiB0aGlzXG4gKiBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgdGhlIG5vZGUgZm9yIHdoaWNoIHRvIGZpbmQgaW5jaWRlbnQgZWRnZXNcbiAqIEBwYXJhbSB7U3RyaW5nfSBbdl0gb3B0aW9uIG5vZGUgdGhhdCBtdXN0IGJlIGFkamFjZW50IHRvIGB1YFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5pbmNpZGVudEVkZ2VzID0gZnVuY3Rpb24odSwgdikge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICByZXR1cm4gU2V0LnVuaW9uKFt0aGlzLm91dEVkZ2VzKHUsIHYpLCB0aGlzLm91dEVkZ2VzKHYsIHUpXSkua2V5cygpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBTZXQudW5pb24oW3RoaXMuaW5FZGdlcyh1KSwgdGhpcy5vdXRFZGdlcyh1KV0pLmtleXMoKTtcbiAgfVxufTtcblxuLypcbiAqIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhpcyBncmFwaC5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiRGlncmFwaCBcIiArIEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIDIpO1xufTtcblxuLypcbiAqIEFkZHMgYSBuZXcgbm9kZSB3aXRoIHRoZSBpZCBgdWAgdG8gdGhlIGdyYXBoIGFuZCBhc3NpZ25zIGl0IHRoZSB2YWx1ZVxuICogYHZhbHVlYC4gSWYgYSBub2RlIHdpdGggdGhlIGlkIGlzIGFscmVhZHkgYSBwYXJ0IG9mIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uXG4gKiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKiBAcGFyYW0ge09iamVjdH0gW3ZhbHVlXSBhbiBvcHRpb25hbCB2YWx1ZSB0byBhdHRhY2ggdG8gdGhlIG5vZGVcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuYWRkTm9kZSA9IGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gIHUgPSBCYXNlR3JhcGgucHJvdG90eXBlLmFkZE5vZGUuY2FsbCh0aGlzLCB1LCB2YWx1ZSk7XG4gIHRoaXMuX2luRWRnZXNbdV0gPSB7fTtcbiAgdGhpcy5fb3V0RWRnZXNbdV0gPSB7fTtcbiAgcmV0dXJuIHU7XG59O1xuXG4vKlxuICogUmVtb3ZlcyBhIG5vZGUgZnJvbSB0aGUgZ3JhcGggdGhhdCBoYXMgdGhlIGlkIGB1YC4gQW55IGVkZ2VzIGluY2lkZW50IG9uIHRoZVxuICogbm9kZSBhcmUgYWxzbyByZW1vdmVkLiBJZiB0aGUgZ3JhcGggZG9lcyBub3QgY29udGFpbiBhIG5vZGUgd2l0aCB0aGUgaWQgdGhpc1xuICogZnVuY3Rpb24gd2lsbCB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuZGVsTm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgQmFzZUdyYXBoLnByb3RvdHlwZS5kZWxOb2RlLmNhbGwodGhpcywgdSk7XG4gIGRlbGV0ZSB0aGlzLl9pbkVkZ2VzW3VdO1xuICBkZWxldGUgdGhpcy5fb3V0RWRnZXNbdV07XG59O1xuXG4vKlxuICogQWRkcyBhIG5ldyBlZGdlIHRvIHRoZSBncmFwaCB3aXRoIHRoZSBpZCBgZWAgZnJvbSBhIG5vZGUgd2l0aCB0aGUgaWQgYHNvdXJjZWBcbiAqIHRvIGEgbm9kZSB3aXRoIGFuIGlkIGB0YXJnZXRgIGFuZCBhc3NpZ25zIGl0IHRoZSB2YWx1ZSBgdmFsdWVgLiBUaGlzIGdyYXBoXG4gKiBhbGxvd3MgbW9yZSB0aGFuIG9uZSBlZGdlIGZyb20gYHNvdXJjZWAgdG8gYHRhcmdldGAgYXMgbG9uZyBhcyB0aGUgaWQgYGVgXG4gKiBpcyB1bmlxdWUgaW4gdGhlIHNldCBvZiBlZGdlcy4gSWYgYGVgIGlzIGBudWxsYCB0aGUgZ3JhcGggd2lsbCBhc3NpZ24gYVxuICogdW5pcXVlIGlkZW50aWZpZXIgdG8gdGhlIGVkZ2UuXG4gKlxuICogSWYgYHNvdXJjZWAgb3IgYHRhcmdldGAgYXJlIG5vdCBwcmVzZW50IGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHdpbGxcbiAqIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZV0gYW4gZWRnZSBpZFxuICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZSB0aGUgc291cmNlIG5vZGUgaWRcbiAqIEBwYXJhbSB7U3RyaW5nfSB0YXJnZXQgdGhlIHRhcmdldCBub2RlIGlkXG4gKiBAcGFyYW0ge09iamVjdH0gW3ZhbHVlXSBhbiBvcHRpb25hbCB2YWx1ZSB0byBhdHRhY2ggdG8gdGhlIGVkZ2VcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuYWRkRWRnZSA9IGZ1bmN0aW9uKGUsIHNvdXJjZSwgdGFyZ2V0LCB2YWx1ZSkge1xuICByZXR1cm4gQmFzZUdyYXBoLnByb3RvdHlwZS5fYWRkRWRnZS5jYWxsKHRoaXMsIGUsIHNvdXJjZSwgdGFyZ2V0LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9pbkVkZ2VzLCB0aGlzLl9vdXRFZGdlcyk7XG59O1xuXG4vKlxuICogUmVtb3ZlcyBhbiBlZGdlIGluIHRoZSBncmFwaCB3aXRoIHRoZSBpZCBgZWAuIElmIG5vIGVkZ2UgaW4gdGhlIGdyYXBoIGhhc1xuICogdGhlIGlkIGBlYCB0aGlzIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGUgYW4gZWRnZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5kZWxFZGdlID0gZnVuY3Rpb24oZSkge1xuICBCYXNlR3JhcGgucHJvdG90eXBlLl9kZWxFZGdlLmNhbGwodGhpcywgZSwgdGhpcy5faW5FZGdlcywgdGhpcy5fb3V0RWRnZXMpO1xufTtcblxuLy8gVW5saWtlIEJhc2VHcmFwaC5maWx0ZXJOb2RlcywgdGhpcyBoZWxwZXIganVzdCByZXR1cm5zIG5vZGVzIHRoYXRcbi8vIHNhdGlzZnkgYSBwcmVkaWNhdGUuXG5EaWdyYXBoLnByb3RvdHlwZS5fZmlsdGVyTm9kZXMgPSBmdW5jdGlvbihwcmVkKSB7XG4gIHZhciBmaWx0ZXJlZCA9IFtdO1xuICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHtcbiAgICBpZiAocHJlZCh1KSkge1xuICAgICAgZmlsdGVyZWQucHVzaCh1KTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZmlsdGVyZWQ7XG59O1xuXG4iLCIvKlxuICogVGhpcyBmaWxlIGlzIG9yZ2FuaXplZCB3aXRoIGluIHRoZSBmb2xsb3dpbmcgb3JkZXI6XG4gKlxuICogRXhwb3J0c1xuICogR3JhcGggY29uc3RydWN0b3JzXG4gKiBHcmFwaCBxdWVyaWVzIChlLmcuIG5vZGVzKCksIGVkZ2VzKClcbiAqIEdyYXBoIG11dGF0b3JzXG4gKiBIZWxwZXIgZnVuY3Rpb25zXG4gKi9cblxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpLFxuICAgIEJhc2VHcmFwaCA9IHJlcXVpcmUoXCIuL0Jhc2VHcmFwaFwiKSxcbi8qIGpzaGludCAtVzA3OSAqL1xuICAgIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdyYXBoO1xuXG4vKlxuICogQ29uc3RydWN0b3IgdG8gY3JlYXRlIGEgbmV3IHVuZGlyZWN0ZWQgbXVsdGktZ3JhcGguXG4gKi9cbmZ1bmN0aW9uIEdyYXBoKCkge1xuICBCYXNlR3JhcGguY2FsbCh0aGlzKTtcblxuICAvKiEgTWFwIG9mIG5vZGVJZCAtPiB7IG90aGVyTm9kZUlkIC0+IFNldCBvZiBlZGdlIGlkcyB9ICovXG4gIHRoaXMuX2luY2lkZW50RWRnZXMgPSB7fTtcbn1cblxuR3JhcGgucHJvdG90eXBlID0gbmV3IEJhc2VHcmFwaCgpO1xuR3JhcGgucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gR3JhcGg7XG5cbi8qXG4gKiBBbHdheXMgcmV0dXJucyBgZmFsc2VgLlxuICovXG5HcmFwaC5wcm90b3R5cGUuaXNEaXJlY3RlZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgbm9kZXMgdGhhdCBhcmUgYWRqYWNlbnQgdG8gdGhlIG5vZGUgd2l0aCB0aGUgaWQgYHVgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5HcmFwaC5wcm90b3R5cGUubmVpZ2hib3JzID0gZnVuY3Rpb24odSkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5faW5jaWRlbnRFZGdlc1t1XSlcbiAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24odikgeyByZXR1cm4gdGhpcy5fbm9kZXNbdl0uaWQ7IH0sIHRoaXMpO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgaWRzIGZvciBhbGwgZWRnZXMgaW4gdGhlIGdyYXBoIHRoYXQgYXJlIGluY2lkZW50IG9uIGB1YC5cbiAqIElmIHRoZSBub2RlIGB1YCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIE9wdGlvbmFsbHkgYSBgdmAgbm9kZSBtYXkgYWxzbyBiZSBzcGVjaWZpZWQuIFRoaXMgY2F1c2VzIHRoZSByZXN1bHRzIHRvIGJlXG4gKiBmaWx0ZXJlZCBzdWNoIHRoYXQgb25seSBlZGdlcyBiZXR3ZWVuIGB1YCBhbmQgYHZgIGFyZSBpbmNsdWRlZC4gSWYgdGhlIG5vZGVcbiAqIGB2YCBpcyBzcGVjaWZpZWQgYnV0IG5vdCBpbiB0aGUgZ3JhcGggdGhlbiB0aGlzIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSB0aGUgbm9kZSBmb3Igd2hpY2ggdG8gZmluZCBpbmNpZGVudCBlZGdlc1xuICogQHBhcmFtIHtTdHJpbmd9IFt2XSBvcHRpb24gbm9kZSB0aGF0IG11c3QgYmUgYWRqYWNlbnQgdG8gYHVgXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5pbmNpZGVudEVkZ2VzID0gZnVuY3Rpb24odSwgdikge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHYpO1xuICAgIHJldHVybiB2IGluIHRoaXMuX2luY2lkZW50RWRnZXNbdV0gPyB0aGlzLl9pbmNpZGVudEVkZ2VzW3VdW3ZdLmtleXMoKSA6IFtdO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBTZXQudW5pb24odXRpbC52YWx1ZXModGhpcy5faW5jaWRlbnRFZGdlc1t1XSkpLmtleXMoKTtcbiAgfVxufTtcblxuLypcbiAqIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhpcyBncmFwaC5cbiAqL1xuR3JhcGgucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkdyYXBoIFwiICsgSlNPTi5zdHJpbmdpZnkodGhpcywgbnVsbCwgMik7XG59O1xuXG4vKlxuICogQWRkcyBhIG5ldyBub2RlIHdpdGggdGhlIGlkIGB1YCB0byB0aGUgZ3JhcGggYW5kIGFzc2lnbnMgaXQgdGhlIHZhbHVlXG4gKiBgdmFsdWVgLiBJZiBhIG5vZGUgd2l0aCB0aGUgaWQgaXMgYWxyZWFkeSBhIHBhcnQgb2YgdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb25cbiAqIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBbdmFsdWVdIGFuIG9wdGlvbmFsIHZhbHVlIHRvIGF0dGFjaCB0byB0aGUgbm9kZVxuICovXG5HcmFwaC5wcm90b3R5cGUuYWRkTm9kZSA9IGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gIHUgPSBCYXNlR3JhcGgucHJvdG90eXBlLmFkZE5vZGUuY2FsbCh0aGlzLCB1LCB2YWx1ZSk7XG4gIHRoaXMuX2luY2lkZW50RWRnZXNbdV0gPSB7fTtcbiAgcmV0dXJuIHU7XG59O1xuXG4vKlxuICogUmVtb3ZlcyBhIG5vZGUgZnJvbSB0aGUgZ3JhcGggdGhhdCBoYXMgdGhlIGlkIGB1YC4gQW55IGVkZ2VzIGluY2lkZW50IG9uIHRoZVxuICogbm9kZSBhcmUgYWxzbyByZW1vdmVkLiBJZiB0aGUgZ3JhcGggZG9lcyBub3QgY29udGFpbiBhIG5vZGUgd2l0aCB0aGUgaWQgdGhpc1xuICogZnVuY3Rpb24gd2lsbCB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqL1xuR3JhcGgucHJvdG90eXBlLmRlbE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gIEJhc2VHcmFwaC5wcm90b3R5cGUuZGVsTm9kZS5jYWxsKHRoaXMsIHUpO1xuICBkZWxldGUgdGhpcy5faW5jaWRlbnRFZGdlc1t1XTtcbn07XG5cbi8qXG4gKiBBZGRzIGEgbmV3IGVkZ2UgdG8gdGhlIGdyYXBoIHdpdGggdGhlIGlkIGBlYCBiZXR3ZWVuIGEgbm9kZSB3aXRoIHRoZSBpZCBgdWBcbiAqIGFuZCBhIG5vZGUgd2l0aCBhbiBpZCBgdmAgYW5kIGFzc2lnbnMgaXQgdGhlIHZhbHVlIGB2YWx1ZWAuIFRoaXMgZ3JhcGhcbiAqIGFsbG93cyBtb3JlIHRoYW4gb25lIGVkZ2UgYmV0d2VlbiBgdWAgYW5kIGB2YCBhcyBsb25nIGFzIHRoZSBpZCBgZWBcbiAqIGlzIHVuaXF1ZSBpbiB0aGUgc2V0IG9mIGVkZ2VzLiBJZiBgZWAgaXMgYG51bGxgIHRoZSBncmFwaCB3aWxsIGFzc2lnbiBhXG4gKiB1bmlxdWUgaWRlbnRpZmllciB0byB0aGUgZWRnZS5cbiAqXG4gKiBJZiBgdWAgb3IgYHZgIGFyZSBub3QgcHJlc2VudCBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB3aWxsIHRocm93IGFuXG4gKiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW2VdIGFuIGVkZ2UgaWRcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IHRoZSBub2RlIGlkIG9mIG9uZSBvZiB0aGUgYWRqYWNlbnQgbm9kZXNcbiAqIEBwYXJhbSB7U3RyaW5nfSB2IHRoZSBub2RlIGlkIG9mIHRoZSBvdGhlciBhZGphY2VudCBub2RlXG4gKiBAcGFyYW0ge09iamVjdH0gW3ZhbHVlXSBhbiBvcHRpb25hbCB2YWx1ZSB0byBhdHRhY2ggdG8gdGhlIGVkZ2VcbiAqL1xuR3JhcGgucHJvdG90eXBlLmFkZEVkZ2UgPSBmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICByZXR1cm4gQmFzZUdyYXBoLnByb3RvdHlwZS5fYWRkRWRnZS5jYWxsKHRoaXMsIGUsIHUsIHYsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2luY2lkZW50RWRnZXMsIHRoaXMuX2luY2lkZW50RWRnZXMpO1xufTtcblxuLypcbiAqIFJlbW92ZXMgYW4gZWRnZSBpbiB0aGUgZ3JhcGggd2l0aCB0aGUgaWQgYGVgLiBJZiBubyBlZGdlIGluIHRoZSBncmFwaCBoYXNcbiAqIHRoZSBpZCBgZWAgdGhpcyBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBlIGFuIGVkZ2UgaWRcbiAqL1xuR3JhcGgucHJvdG90eXBlLmRlbEVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIEJhc2VHcmFwaC5wcm90b3R5cGUuX2RlbEVkZ2UuY2FsbCh0aGlzLCBlLCB0aGlzLl9pbmNpZGVudEVkZ2VzLCB0aGlzLl9pbmNpZGVudEVkZ2VzKTtcbn07XG5cbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbXBvbmVudHM7XG5cbi8qKlxuICogRmluZHMgYWxsIFtjb25uZWN0ZWQgY29tcG9uZW50c11bXSBpbiBhIGdyYXBoIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mIHRoZXNlXG4gKiBjb21wb25lbnRzLiBFYWNoIGNvbXBvbmVudCBpcyBpdHNlbGYgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgaWRzIG9mIG5vZGVzXG4gKiBpbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gb25seSB3b3JrcyB3aXRoIHVuZGlyZWN0ZWQgR3JhcGhzLlxuICpcbiAqIFtjb25uZWN0ZWQgY29tcG9uZW50c106IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQ29ubmVjdGVkX2NvbXBvbmVudF8oZ3JhcGhfdGhlb3J5KVxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3IgY29tcG9uZW50c1xuICovXG5mdW5jdGlvbiBjb21wb25lbnRzKGcpIHtcbiAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgdmFyIHZpc2l0ZWQgPSBuZXcgU2V0KCk7XG5cbiAgZnVuY3Rpb24gZGZzKHYsIGNvbXBvbmVudCkge1xuICAgIGlmICghdmlzaXRlZC5oYXModikpIHtcbiAgICAgIHZpc2l0ZWQuYWRkKHYpO1xuICAgICAgY29tcG9uZW50LnB1c2godik7XG4gICAgICBnLm5laWdoYm9ycyh2KS5mb3JFYWNoKGZ1bmN0aW9uKHcpIHtcbiAgICAgICAgZGZzKHcsIGNvbXBvbmVudCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBnLm5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IFtdO1xuICAgIGRmcyh2LCBjb21wb25lbnQpO1xuICAgIGlmIChjb21wb25lbnQubGVuZ3RoID4gMCkge1xuICAgICAgcmVzdWx0cy5wdXNoKGNvbXBvbmVudCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsInZhciBQcmlvcml0eVF1ZXVlID0gcmVxdWlyZShcImNwLWRhdGFcIikuUHJpb3JpdHlRdWV1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSBkaWprc3RyYTtcblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGFuIGltcGxlbWVudGF0aW9uIG9mIFtEaWprc3RyYSdzIGFsZ29yaXRobV1bXSB3aGljaCBmaW5kc1xuICogdGhlIHNob3J0ZXN0IHBhdGggZnJvbSAqKnNvdXJjZSoqIHRvIGFsbCBvdGhlciBub2RlcyBpbiAqKmcqKi4gVGhpc1xuICogZnVuY3Rpb24gcmV0dXJucyBhIG1hcCBvZiBgdSAtPiB7IGRpc3RhbmNlLCBwcmVkZWNlc3NvciB9YC4gVGhlIGRpc3RhbmNlXG4gKiBwcm9wZXJ0eSBob2xkcyB0aGUgc3VtIG9mIHRoZSB3ZWlnaHRzIGZyb20gKipzb3VyY2UqKiB0byBgdWAgYWxvbmcgdGhlXG4gKiBzaG9ydGVzdCBwYXRoIG9yIGBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFlgIGlmIHRoZXJlIGlzIG5vIHBhdGggZnJvbVxuICogKipzb3VyY2UqKi4gVGhlIHByZWRlY2Vzc29yIHByb3BlcnR5IGNhbiBiZSB1c2VkIHRvIHdhbGsgdGhlIGluZGl2aWR1YWxcbiAqIGVsZW1lbnRzIG9mIHRoZSBwYXRoIGZyb20gKipzb3VyY2UqKiB0byAqKnUqKiBpbiByZXZlcnNlIG9yZGVyLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYHdlaWdodEZ1bmMoZSlgIHdoaWNoIHJldHVybnMgdGhlXG4gKiB3ZWlnaHQgb2YgdGhlIGVkZ2UgYGVgLiBJZiBubyB3ZWlnaHRGdW5jIGlzIHN1cHBsaWVkIHRoZW4gZWFjaCBlZGdlIGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYSB3ZWlnaHQgb2YgMS4gVGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IgaWYgYW55IG9mXG4gKiB0aGUgdHJhdmVyc2VkIGVkZ2VzIGhhdmUgYSBuZWdhdGl2ZSBlZGdlIHdlaWdodC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGBpbmNpZGVudEZ1bmModSlgIHdoaWNoIHJldHVybnMgdGhlIGlkcyBvZlxuICogYWxsIGVkZ2VzIGluY2lkZW50IHRvIHRoZSBub2RlIGB1YCBmb3IgdGhlIHB1cnBvc2VzIG9mIHNob3J0ZXN0IHBhdGhcbiAqIHRyYXZlcnNhbC4gQnkgZGVmYXVsdCB0aGlzIGZ1bmN0aW9uIHVzZXMgdGhlIGBnLm91dEVkZ2VzYCBmb3IgRGlncmFwaHMgYW5kXG4gKiBgZy5pbmNpZGVudEVkZ2VzYCBmb3IgR3JhcGhzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYE8oKHxFfCArIHxWfCkgKiBsb2cgfFZ8KWAgdGltZS5cbiAqXG4gKiBbRGlqa3N0cmEncyBhbGdvcml0aG1dOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0RpamtzdHJhJTI3c19hbGdvcml0aG1cbiAqXG4gKiBAcGFyYW0ge0dyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIHNob3J0ZXN0IHBhdGhzIGZyb20gKipzb3VyY2UqKlxuICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSB0aGUgc291cmNlIGZyb20gd2hpY2ggdG8gc3RhcnQgdGhlIHNlYXJjaFxuICogQHBhcmFtIHtGdW5jdGlvbn0gW3dlaWdodEZ1bmNdIG9wdGlvbmFsIHdlaWdodCBmdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2luY2lkZW50RnVuY10gb3B0aW9uYWwgaW5jaWRlbnQgZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gZGlqa3N0cmEoZywgc291cmNlLCB3ZWlnaHRGdW5jLCBpbmNpZGVudEZ1bmMpIHtcbiAgdmFyIHJlc3VsdHMgPSB7fSxcbiAgICAgIHBxID0gbmV3IFByaW9yaXR5UXVldWUoKTtcblxuICBmdW5jdGlvbiB1cGRhdGVOZWlnaGJvcnMoZSkge1xuICAgIHZhciBpbmNpZGVudE5vZGVzID0gZy5pbmNpZGVudE5vZGVzKGUpLFxuICAgICAgICB2ID0gaW5jaWRlbnROb2Rlc1swXSAhPT0gdSA/IGluY2lkZW50Tm9kZXNbMF0gOiBpbmNpZGVudE5vZGVzWzFdLFxuICAgICAgICB2RW50cnkgPSByZXN1bHRzW3ZdLFxuICAgICAgICB3ZWlnaHQgPSB3ZWlnaHRGdW5jKGUpLFxuICAgICAgICBkaXN0YW5jZSA9IHVFbnRyeS5kaXN0YW5jZSArIHdlaWdodDtcblxuICAgIGlmICh3ZWlnaHQgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJkaWprc3RyYSBkb2VzIG5vdCBhbGxvdyBuZWdhdGl2ZSBlZGdlIHdlaWdodHMuIEJhZCBlZGdlOiBcIiArIGUgKyBcIiBXZWlnaHQ6IFwiICsgd2VpZ2h0KTtcbiAgICB9XG5cbiAgICBpZiAoZGlzdGFuY2UgPCB2RW50cnkuZGlzdGFuY2UpIHtcbiAgICAgIHZFbnRyeS5kaXN0YW5jZSA9IGRpc3RhbmNlO1xuICAgICAgdkVudHJ5LnByZWRlY2Vzc29yID0gdTtcbiAgICAgIHBxLmRlY3JlYXNlKHYsIGRpc3RhbmNlKTtcbiAgICB9XG4gIH1cblxuICB3ZWlnaHRGdW5jID0gd2VpZ2h0RnVuYyB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIDE7IH07XG4gIGluY2lkZW50RnVuYyA9IGluY2lkZW50RnVuYyB8fCAoZy5pc0RpcmVjdGVkKClcbiAgICAgID8gZnVuY3Rpb24odSkgeyByZXR1cm4gZy5vdXRFZGdlcyh1KTsgfVxuICAgICAgOiBmdW5jdGlvbih1KSB7IHJldHVybiBnLmluY2lkZW50RWRnZXModSk7IH0pO1xuXG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgIHZhciBkaXN0YW5jZSA9IHUgPT09IHNvdXJjZSA/IDAgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgcmVzdWx0c1t1XSA9IHsgZGlzdGFuY2U6IGRpc3RhbmNlIH07XG4gICAgcHEuYWRkKHUsIGRpc3RhbmNlKTtcbiAgfSk7XG5cbiAgdmFyIHUsIHVFbnRyeTtcbiAgd2hpbGUgKHBxLnNpemUoKSA+IDApIHtcbiAgICB1ID0gcHEucmVtb3ZlTWluKCk7XG4gICAgdUVudHJ5ID0gcmVzdWx0c1t1XTtcbiAgICBpZiAodUVudHJ5LmRpc3RhbmNlID09PSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGluY2lkZW50RnVuYyh1KS5mb3JFYWNoKHVwZGF0ZU5laWdoYm9ycyk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsInZhciBkaWprc3RyYSA9IHJlcXVpcmUoXCIuL2RpamtzdHJhXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRpamtzdHJhQWxsO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gZmluZHMgdGhlIHNob3J0ZXN0IHBhdGggZnJvbSBlYWNoIG5vZGUgdG8gZXZlcnkgb3RoZXJcbiAqIHJlYWNoYWJsZSBub2RlIGluIHRoZSBncmFwaC4gSXQgaXMgc2ltaWxhciB0byBbYWxnLmRpamtzdHJhXVtdLCBidXRcbiAqIGluc3RlYWQgb2YgcmV0dXJuaW5nIGEgc2luZ2xlLXNvdXJjZSBhcnJheSwgaXQgcmV0dXJucyBhIG1hcHBpbmcgb2ZcbiAqIG9mIGBzb3VyY2UgLT4gYWxnLmRpamtzdGEoZywgc291cmNlLCB3ZWlnaHRGdW5jLCBpbmNpZGVudEZ1bmMpYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGB3ZWlnaHRGdW5jKGUpYCB3aGljaCByZXR1cm5zIHRoZVxuICogd2VpZ2h0IG9mIHRoZSBlZGdlIGBlYC4gSWYgbm8gd2VpZ2h0RnVuYyBpcyBzdXBwbGllZCB0aGVuIGVhY2ggZWRnZSBpc1xuICogYXNzdW1lZCB0byBoYXZlIGEgd2VpZ2h0IG9mIDEuIFRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yIGlmIGFueSBvZlxuICogdGhlIHRyYXZlcnNlZCBlZGdlcyBoYXZlIGEgbmVnYXRpdmUgZWRnZSB3ZWlnaHQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgaW5jaWRlbnRGdW5jKHUpYCB3aGljaCByZXR1cm5zIHRoZSBpZHMgb2ZcbiAqIGFsbCBlZGdlcyBpbmNpZGVudCB0byB0aGUgbm9kZSBgdWAgZm9yIHRoZSBwdXJwb3NlcyBvZiBzaG9ydGVzdCBwYXRoXG4gKiB0cmF2ZXJzYWwuIEJ5IGRlZmF1bHQgdGhpcyBmdW5jdGlvbiB1c2VzIHRoZSBgb3V0RWRnZXNgIGZ1bmN0aW9uIG9uIHRoZVxuICogc3VwcGxpZWQgZ3JhcGguXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBgTyh8VnwgKiAofEV8ICsgfFZ8KSAqIGxvZyB8VnwpYCB0aW1lLlxuICpcbiAqIFthbGcuZGlqa3N0cmFdOiBkaWprc3RyYS5qcy5odG1sI2RpamtzdHJhXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBzaG9ydGVzdCBwYXRocyBmcm9tICoqc291cmNlKipcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFt3ZWlnaHRGdW5jXSBvcHRpb25hbCB3ZWlnaHQgZnVuY3Rpb25cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtpbmNpZGVudEZ1bmNdIG9wdGlvbmFsIGluY2lkZW50IGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGRpamtzdHJhQWxsKGcsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYykge1xuICB2YXIgcmVzdWx0cyA9IHt9O1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHtcbiAgICByZXN1bHRzW3VdID0gZGlqa3N0cmEoZywgdSwgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKTtcbiAgfSk7XG4gIHJldHVybiByZXN1bHRzO1xufVxuIiwidmFyIHRhcmphbiA9IHJlcXVpcmUoXCIuL3RhcmphblwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmaW5kQ3ljbGVzO1xuXG4vKlxuICogR2l2ZW4gYSBEaWdyYXBoICoqZyoqIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbGwgbm9kZXMgdGhhdCBhcmUgcGFydCBvZiBhXG4gKiBjeWNsZS4gU2luY2UgdGhlcmUgbWF5IGJlIG1vcmUgdGhhbiBvbmUgY3ljbGUgaW4gYSBncmFwaCB0aGlzIGZ1bmN0aW9uXG4gKiByZXR1cm5zIGFuIGFycmF5IG9mIHRoZXNlIGN5Y2xlcywgd2hlcmUgZWFjaCBjeWNsZSBpcyBpdHNlbGYgcmVwcmVzZW50ZWRcbiAqIGJ5IGFuIGFycmF5IG9mIGlkcyBmb3IgZWFjaCBub2RlIGludm9sdmVkIGluIHRoYXQgY3ljbGUuXG4gKlxuICogW2FsZy5pc0FjeWNsaWNdW10gaXMgbW9yZSBlZmZpY2llbnQgaWYgeW91IG9ubHkgbmVlZCB0byBkZXRlcm1pbmUgd2hldGhlclxuICogYSBncmFwaCBoYXMgYSBjeWNsZSBvciBub3QuXG4gKlxuICogW2FsZy5pc0FjeWNsaWNdOiBpc0FjeWNsaWMuanMuaHRtbCNpc0FjeWNsaWNcbiAqXG4gKiBAcGFyYW0ge0RpZ3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3IgY3ljbGVzLlxuICovXG5mdW5jdGlvbiBmaW5kQ3ljbGVzKGcpIHtcbiAgcmV0dXJuIHRhcmphbihnKS5maWx0ZXIoZnVuY3Rpb24oY21wdCkgeyByZXR1cm4gY21wdC5sZW5ndGggPiAxOyB9KTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZmxveWRXYXJzaGFsbDtcblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGFuIGltcGxlbWVudGF0aW9uIG9mIHRoZSBbRmxveWQtV2Fyc2hhbGwgYWxnb3JpdGhtXVtdLFxuICogd2hpY2ggZmluZHMgdGhlIHNob3J0ZXN0IHBhdGggZnJvbSBlYWNoIG5vZGUgdG8gZXZlcnkgb3RoZXIgcmVhY2hhYmxlIG5vZGVcbiAqIGluIHRoZSBncmFwaC4gSXQgaXMgc2ltaWxhciB0byBbYWxnLmRpamtzdHJhQWxsXVtdLCBidXQgaXQgaGFuZGxlcyBuZWdhdGl2ZVxuICogZWRnZSB3ZWlnaHRzIGFuZCBpcyBtb3JlIGVmZmljaWVudCBmb3Igc29tZSB0eXBlcyBvZiBncmFwaHMuIFRoaXMgZnVuY3Rpb25cbiAqIHJldHVybnMgYSBtYXAgb2YgYHNvdXJjZSAtPiB7IHRhcmdldCAtPiB7IGRpc3RhbmNlLCBwcmVkZWNlc3NvciB9YC4gVGhlXG4gKiBkaXN0YW5jZSBwcm9wZXJ0eSBob2xkcyB0aGUgc3VtIG9mIHRoZSB3ZWlnaHRzIGZyb20gYHNvdXJjZWAgdG8gYHRhcmdldGBcbiAqIGFsb25nIHRoZSBzaG9ydGVzdCBwYXRoIG9mIGBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFlgIGlmIHRoZXJlIGlzIG5vIHBhdGhcbiAqIGZyb20gYHNvdXJjZWAuIFRoZSBwcmVkZWNlc3NvciBwcm9wZXJ0eSBjYW4gYmUgdXNlZCB0byB3YWxrIHRoZSBpbmRpdmlkdWFsXG4gKiBlbGVtZW50cyBvZiB0aGUgcGF0aCBmcm9tIGBzb3VyY2VgIHRvIGB0YXJnZXRgIGluIHJldmVyc2Ugb3JkZXIuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgd2VpZ2h0RnVuYyhlKWAgd2hpY2ggcmV0dXJucyB0aGVcbiAqIHdlaWdodCBvZiB0aGUgZWRnZSBgZWAuIElmIG5vIHdlaWdodEZ1bmMgaXMgc3VwcGxpZWQgdGhlbiBlYWNoIGVkZ2UgaXNcbiAqIGFzc3VtZWQgdG8gaGF2ZSBhIHdlaWdodCBvZiAxLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYGluY2lkZW50RnVuYyh1KWAgd2hpY2ggcmV0dXJucyB0aGUgaWRzIG9mXG4gKiBhbGwgZWRnZXMgaW5jaWRlbnQgdG8gdGhlIG5vZGUgYHVgIGZvciB0aGUgcHVycG9zZXMgb2Ygc2hvcnRlc3QgcGF0aFxuICogdHJhdmVyc2FsLiBCeSBkZWZhdWx0IHRoaXMgZnVuY3Rpb24gdXNlcyB0aGUgYG91dEVkZ2VzYCBmdW5jdGlvbiBvbiB0aGVcbiAqIHN1cHBsaWVkIGdyYXBoLlxuICpcbiAqIFRoaXMgYWxnb3JpdGhtIHRha2VzIE8ofFZ8XjMpIHRpbWUuXG4gKlxuICogW0Zsb3lkLVdhcnNoYWxsIGFsZ29yaXRobV06IGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Zsb3lkLVdhcnNoYWxsX2FsZ29yaXRobVxuICogW2FsZy5kaWprc3RyYUFsbF06IGRpamtzdHJhQWxsLmpzLmh0bWwjZGlqa3N0cmFBbGxcbiAqXG4gKiBAcGFyYW0ge0dyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIHNob3J0ZXN0IHBhdGhzIGZyb20gKipzb3VyY2UqKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW3dlaWdodEZ1bmNdIG9wdGlvbmFsIHdlaWdodCBmdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2luY2lkZW50RnVuY10gb3B0aW9uYWwgaW5jaWRlbnQgZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gZmxveWRXYXJzaGFsbChnLCB3ZWlnaHRGdW5jLCBpbmNpZGVudEZ1bmMpIHtcbiAgdmFyIHJlc3VsdHMgPSB7fSxcbiAgICAgIG5vZGVzID0gZy5ub2RlcygpO1xuXG4gIHdlaWdodEZ1bmMgPSB3ZWlnaHRGdW5jIHx8IGZ1bmN0aW9uKCkgeyByZXR1cm4gMTsgfTtcbiAgaW5jaWRlbnRGdW5jID0gaW5jaWRlbnRGdW5jIHx8IChnLmlzRGlyZWN0ZWQoKVxuICAgICAgPyBmdW5jdGlvbih1KSB7IHJldHVybiBnLm91dEVkZ2VzKHUpOyB9XG4gICAgICA6IGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGcuaW5jaWRlbnRFZGdlcyh1KTsgfSk7XG5cbiAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgcmVzdWx0c1t1XSA9IHt9O1xuICAgIHJlc3VsdHNbdV1bdV0gPSB7IGRpc3RhbmNlOiAwIH07XG4gICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICBpZiAodSAhPT0gdikge1xuICAgICAgICByZXN1bHRzW3VdW3ZdID0geyBkaXN0YW5jZTogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZIH07XG4gICAgICB9XG4gICAgfSk7XG4gICAgaW5jaWRlbnRGdW5jKHUpLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgICAgdmFyIGluY2lkZW50Tm9kZXMgPSBnLmluY2lkZW50Tm9kZXMoZSksXG4gICAgICAgICAgdiA9IGluY2lkZW50Tm9kZXNbMF0gIT09IHUgPyBpbmNpZGVudE5vZGVzWzBdIDogaW5jaWRlbnROb2Rlc1sxXSxcbiAgICAgICAgICBkID0gd2VpZ2h0RnVuYyhlKTtcbiAgICAgIGlmIChkIDwgcmVzdWx0c1t1XVt2XS5kaXN0YW5jZSkge1xuICAgICAgICByZXN1bHRzW3VdW3ZdID0geyBkaXN0YW5jZTogZCwgcHJlZGVjZXNzb3I6IHUgfTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG5cbiAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgdmFyIHJvd0sgPSByZXN1bHRzW2tdO1xuICAgIG5vZGVzLmZvckVhY2goZnVuY3Rpb24oaSkge1xuICAgICAgdmFyIHJvd0kgPSByZXN1bHRzW2ldO1xuICAgICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbihqKSB7XG4gICAgICAgIHZhciBpayA9IHJvd0lba107XG4gICAgICAgIHZhciBraiA9IHJvd0tbal07XG4gICAgICAgIHZhciBpaiA9IHJvd0lbal07XG4gICAgICAgIHZhciBhbHREaXN0YW5jZSA9IGlrLmRpc3RhbmNlICsga2ouZGlzdGFuY2U7XG4gICAgICAgIGlmIChhbHREaXN0YW5jZSA8IGlqLmRpc3RhbmNlKSB7XG4gICAgICAgICAgaWouZGlzdGFuY2UgPSBhbHREaXN0YW5jZTtcbiAgICAgICAgICBpai5wcmVkZWNlc3NvciA9IGtqLnByZWRlY2Vzc29yO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJ2YXIgdG9wc29ydCA9IHJlcXVpcmUoXCIuL3RvcHNvcnRcIik7XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBY3ljbGljO1xuXG4vKlxuICogR2l2ZW4gYSBEaWdyYXBoICoqZyoqIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGdyYXBoIGhhcyBub1xuICogY3ljbGVzIGFuZCByZXR1cm5zIGBmYWxzZWAgaWYgaXQgZG9lcy4gVGhpcyBhbGdvcml0aG0gcmV0dXJucyBhcyBzb29uIGFzIGl0XG4gKiBkZXRlY3RzIHRoZSBmaXJzdCBjeWNsZS5cbiAqXG4gKiBVc2UgW2FsZy5maW5kQ3ljbGVzXVtdIGlmIHlvdSBuZWVkIHRoZSBhY3R1YWwgbGlzdCBvZiBjeWNsZXMgaW4gYSBncmFwaC5cbiAqXG4gKiBbYWxnLmZpbmRDeWNsZXNdOiBmaW5kQ3ljbGVzLmpzLmh0bWwjZmluZEN5Y2xlc1xuICpcbiAqIEBwYXJhbSB7RGlncmFwaH0gZyB0aGUgZ3JhcGggdG8gdGVzdCBmb3IgY3ljbGVzXG4gKi9cbmZ1bmN0aW9uIGlzQWN5Y2xpYyhnKSB7XG4gIHRyeSB7XG4gICAgdG9wc29ydChnKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChlIGluc3RhbmNlb2YgdG9wc29ydC5DeWNsZUV4Y2VwdGlvbikgcmV0dXJuIGZhbHNlO1xuICAgIHRocm93IGU7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBwb3N0b3JkZXI7XG5cbi8vIFBvc3RvcmRlciB0cmF2ZXJzYWwgb2YgZywgY2FsbGluZyBmIGZvciBlYWNoIHZpc2l0ZWQgbm9kZS4gQXNzdW1lcyB0aGUgZ3JhcGhcbi8vIGlzIGEgdHJlZS5cbmZ1bmN0aW9uIHBvc3RvcmRlcihnLCByb290LCBmKSB7XG4gIHZhciB2aXNpdGVkID0gbmV3IFNldCgpO1xuICBpZiAoZy5pc0RpcmVjdGVkKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIGZ1bmN0aW9uIG9ubHkgd29ya3MgZm9yIHVuZGlyZWN0ZWQgZ3JhcGhzXCIpO1xuICB9XG4gIGZ1bmN0aW9uIGRmcyh1LCBwcmV2KSB7XG4gICAgaWYgKHZpc2l0ZWQuaGFzKHUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgaW5wdXQgZ3JhcGggaXMgbm90IGEgdHJlZTogXCIgKyBnKTtcbiAgICB9XG4gICAgdmlzaXRlZC5hZGQodSk7XG4gICAgZy5uZWlnaGJvcnModSkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICBpZiAodiAhPT0gcHJldikgZGZzKHYsIHUpO1xuICAgIH0pO1xuICAgIGYodSk7XG4gIH1cbiAgZGZzKHJvb3QpO1xufVxuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gcHJlb3JkZXI7XG5cbi8vIFByZW9yZGVyIHRyYXZlcnNhbCBvZiBnLCBjYWxsaW5nIGYgZm9yIGVhY2ggdmlzaXRlZCBub2RlLiBBc3N1bWVzIHRoZSBncmFwaFxuLy8gaXMgYSB0cmVlLlxuZnVuY3Rpb24gcHJlb3JkZXIoZywgcm9vdCwgZikge1xuICB2YXIgdmlzaXRlZCA9IG5ldyBTZXQoKTtcbiAgaWYgKGcuaXNEaXJlY3RlZCgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIGZvciB1bmRpcmVjdGVkIGdyYXBoc1wiKTtcbiAgfVxuICBmdW5jdGlvbiBkZnModSwgcHJldikge1xuICAgIGlmICh2aXNpdGVkLmhhcyh1KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGlucHV0IGdyYXBoIGlzIG5vdCBhIHRyZWU6IFwiICsgZyk7XG4gICAgfVxuICAgIHZpc2l0ZWQuYWRkKHUpO1xuICAgIGYodSk7XG4gICAgZy5uZWlnaGJvcnModSkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICBpZiAodiAhPT0gcHJldikgZGZzKHYsIHUpO1xuICAgIH0pO1xuICB9XG4gIGRmcyhyb290KTtcbn1cbiIsInZhciBHcmFwaCA9IHJlcXVpcmUoXCIuLi9HcmFwaFwiKSxcbiAgICBQcmlvcml0eVF1ZXVlID0gcmVxdWlyZShcImNwLWRhdGFcIikuUHJpb3JpdHlRdWV1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSBwcmltO1xuXG4vKipcbiAqIFtQcmltJ3MgYWxnb3JpdGhtXVtdIHRha2VzIGEgY29ubmVjdGVkIHVuZGlyZWN0ZWQgZ3JhcGggYW5kIGdlbmVyYXRlcyBhXG4gKiBbbWluaW11bSBzcGFubmluZyB0cmVlXVtdLiBUaGlzIGZ1bmN0aW9uIHJldHVybnMgdGhlIG1pbmltdW0gc3Bhbm5pbmdcbiAqIHRyZWUgYXMgYW4gdW5kaXJlY3RlZCBncmFwaC4gVGhpcyBhbGdvcml0aG0gaXMgZGVyaXZlZCBmcm9tIHRoZSBkZXNjcmlwdGlvblxuICogaW4gXCJJbnRyb2R1Y3Rpb24gdG8gQWxnb3JpdGhtc1wiLCBUaGlyZCBFZGl0aW9uLCBDb3JtZW4sIGV0IGFsLiwgUGcgNjM0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYSBgd2VpZ2h0RnVuYyhlKWAgd2hpY2ggcmV0dXJucyB0aGUgd2VpZ2h0IG9mIHRoZSBlZGdlXG4gKiBgZWAuIEl0IHRocm93cyBhbiBFcnJvciBpZiB0aGUgZ3JhcGggaXMgbm90IGNvbm5lY3RlZC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGBPKHxFfCBsb2cgfFZ8KWAgdGltZS5cbiAqXG4gKiBbUHJpbSdzIGFsZ29yaXRobV06IGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1ByaW0nc19hbGdvcml0aG1cbiAqIFttaW5pbXVtIHNwYW5uaW5nIHRyZWVdOiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9NaW5pbXVtX3NwYW5uaW5nX3RyZWVcbiAqXG4gKiBAcGFyYW0ge0dyYXBofSBnIHRoZSBncmFwaCB1c2VkIHRvIGdlbmVyYXRlIHRoZSBtaW5pbXVtIHNwYW5uaW5nIHRyZWVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHdlaWdodEZ1bmMgdGhlIHdlaWdodCBmdW5jdGlvbiB0byB1c2VcbiAqL1xuZnVuY3Rpb24gcHJpbShnLCB3ZWlnaHRGdW5jKSB7XG4gIHZhciByZXN1bHQgPSBuZXcgR3JhcGgoKSxcbiAgICAgIHBhcmVudHMgPSB7fSxcbiAgICAgIHBxID0gbmV3IFByaW9yaXR5UXVldWUoKSxcbiAgICAgIHU7XG5cbiAgZnVuY3Rpb24gdXBkYXRlTmVpZ2hib3JzKGUpIHtcbiAgICB2YXIgaW5jaWRlbnROb2RlcyA9IGcuaW5jaWRlbnROb2RlcyhlKSxcbiAgICAgICAgdiA9IGluY2lkZW50Tm9kZXNbMF0gIT09IHUgPyBpbmNpZGVudE5vZGVzWzBdIDogaW5jaWRlbnROb2Rlc1sxXSxcbiAgICAgICAgcHJpID0gcHEucHJpb3JpdHkodik7XG4gICAgaWYgKHByaSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgZWRnZVdlaWdodCA9IHdlaWdodEZ1bmMoZSk7XG4gICAgICBpZiAoZWRnZVdlaWdodCA8IHByaSkge1xuICAgICAgICBwYXJlbnRzW3ZdID0gdTtcbiAgICAgICAgcHEuZGVjcmVhc2UodiwgZWRnZVdlaWdodCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGcub3JkZXIoKSA9PT0gMCkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHtcbiAgICBwcS5hZGQodSwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKTtcbiAgICByZXN1bHQuYWRkTm9kZSh1KTtcbiAgfSk7XG5cbiAgLy8gU3RhcnQgZnJvbSBhbiBhcmJpdHJhcnkgbm9kZVxuICBwcS5kZWNyZWFzZShnLm5vZGVzKClbMF0sIDApO1xuXG4gIHZhciBpbml0ID0gZmFsc2U7XG4gIHdoaWxlIChwcS5zaXplKCkgPiAwKSB7XG4gICAgdSA9IHBxLnJlbW92ZU1pbigpO1xuICAgIGlmICh1IGluIHBhcmVudHMpIHtcbiAgICAgIHJlc3VsdC5hZGRFZGdlKG51bGwsIHUsIHBhcmVudHNbdV0pO1xuICAgIH0gZWxzZSBpZiAoaW5pdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgZ3JhcGggaXMgbm90IGNvbm5lY3RlZDogXCIgKyBnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5pdCA9IHRydWU7XG4gICAgfVxuXG4gICAgZy5pbmNpZGVudEVkZ2VzKHUpLmZvckVhY2godXBkYXRlTmVpZ2hib3JzKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHRhcmphbjtcblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGFuIGltcGxlbWVudGF0aW9uIG9mIFtUYXJqYW4ncyBhbGdvcml0aG1dW10gd2hpY2ggZmluZHNcbiAqIGFsbCBbc3Ryb25nbHkgY29ubmVjdGVkIGNvbXBvbmVudHNdW10gaW4gdGhlIGRpcmVjdGVkIGdyYXBoICoqZyoqLiBFYWNoXG4gKiBzdHJvbmdseSBjb25uZWN0ZWQgY29tcG9uZW50IGlzIGNvbXBvc2VkIG9mIG5vZGVzIHRoYXQgY2FuIHJlYWNoIGFsbCBvdGhlclxuICogbm9kZXMgaW4gdGhlIGNvbXBvbmVudCB2aWEgZGlyZWN0ZWQgZWRnZXMuIEEgc3Ryb25nbHkgY29ubmVjdGVkIGNvbXBvbmVudFxuICogY2FuIGNvbnNpc3Qgb2YgYSBzaW5nbGUgbm9kZSBpZiB0aGF0IG5vZGUgY2Fubm90IGJvdGggcmVhY2ggYW5kIGJlIHJlYWNoZWRcbiAqIGJ5IGFueSBvdGhlciBzcGVjaWZpYyBub2RlIGluIHRoZSBncmFwaC4gQ29tcG9uZW50cyBvZiBtb3JlIHRoYW4gb25lIG5vZGVcbiAqIGFyZSBndWFyYW50ZWVkIHRvIGhhdmUgYXQgbGVhc3Qgb25lIGN5Y2xlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBhcnJheSBvZiBjb21wb25lbnRzLiBFYWNoIGNvbXBvbmVudCBpcyBpdHNlbGYgYW5cbiAqIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIGlkcyBvZiBhbGwgbm9kZXMgaW4gdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBbVGFyamFuJ3MgYWxnb3JpdGhtXTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9UYXJqYW4nc19zdHJvbmdseV9jb25uZWN0ZWRfY29tcG9uZW50c19hbGdvcml0aG1cbiAqIFtzdHJvbmdseSBjb25uZWN0ZWQgY29tcG9uZW50c106IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvU3Ryb25nbHlfY29ubmVjdGVkX2NvbXBvbmVudFxuICpcbiAqIEBwYXJhbSB7RGlncmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBzdHJvbmdseSBjb25uZWN0ZWQgY29tcG9uZW50c1xuICovXG5mdW5jdGlvbiB0YXJqYW4oZykge1xuICBpZiAoIWcuaXNEaXJlY3RlZCgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwidGFyamFuIGNhbiBvbmx5IGJlIGFwcGxpZWQgdG8gYSBkaXJlY3RlZCBncmFwaC4gQmFkIGlucHV0OiBcIiArIGcpO1xuICB9XG5cbiAgdmFyIGluZGV4ID0gMCxcbiAgICAgIHN0YWNrID0gW10sXG4gICAgICB2aXNpdGVkID0ge30sIC8vIG5vZGUgaWQgLT4geyBvblN0YWNrLCBsb3dsaW5rLCBpbmRleCB9XG4gICAgICByZXN1bHRzID0gW107XG5cbiAgZnVuY3Rpb24gZGZzKHUpIHtcbiAgICB2YXIgZW50cnkgPSB2aXNpdGVkW3VdID0ge1xuICAgICAgb25TdGFjazogdHJ1ZSxcbiAgICAgIGxvd2xpbms6IGluZGV4LFxuICAgICAgaW5kZXg6IGluZGV4KytcbiAgICB9O1xuICAgIHN0YWNrLnB1c2godSk7XG5cbiAgICBnLnN1Y2Nlc3NvcnModSkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoISh2IGluIHZpc2l0ZWQpKSB7XG4gICAgICAgIGRmcyh2KTtcbiAgICAgICAgZW50cnkubG93bGluayA9IE1hdGgubWluKGVudHJ5Lmxvd2xpbmssIHZpc2l0ZWRbdl0ubG93bGluayk7XG4gICAgICB9IGVsc2UgaWYgKHZpc2l0ZWRbdl0ub25TdGFjaykge1xuICAgICAgICBlbnRyeS5sb3dsaW5rID0gTWF0aC5taW4oZW50cnkubG93bGluaywgdmlzaXRlZFt2XS5pbmRleCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoZW50cnkubG93bGluayA9PT0gZW50cnkuaW5kZXgpIHtcbiAgICAgIHZhciBjbXB0ID0gW10sXG4gICAgICAgICAgdjtcbiAgICAgIGRvIHtcbiAgICAgICAgdiA9IHN0YWNrLnBvcCgpO1xuICAgICAgICB2aXNpdGVkW3ZdLm9uU3RhY2sgPSBmYWxzZTtcbiAgICAgICAgY21wdC5wdXNoKHYpO1xuICAgICAgfSB3aGlsZSAodSAhPT0gdik7XG4gICAgICByZXN1bHRzLnB1c2goY21wdCk7XG4gICAgfVxuICB9XG5cbiAgZy5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIGlmICghKHUgaW4gdmlzaXRlZCkpIHtcbiAgICAgIGRmcyh1KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHRzO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB0b3Bzb3J0O1xudG9wc29ydC5DeWNsZUV4Y2VwdGlvbiA9IEN5Y2xlRXhjZXB0aW9uO1xuXG4vKlxuICogR2l2ZW4gYSBncmFwaCAqKmcqKiwgdGhpcyBmdW5jdGlvbiByZXR1cm5zIGFuIG9yZGVyZWQgbGlzdCBvZiBub2RlcyBzdWNoXG4gKiB0aGF0IGZvciBlYWNoIGVkZ2UgYHUgLT4gdmAsIGB1YCBhcHBlYXJzIGJlZm9yZSBgdmAgaW4gdGhlIGxpc3QuIElmIHRoZVxuICogZ3JhcGggaGFzIGEgY3ljbGUgaXQgaXMgaW1wb3NzaWJsZSB0byBnZW5lcmF0ZSBzdWNoIGEgbGlzdCBhbmRcbiAqICoqQ3ljbGVFeGNlcHRpb24qKiBpcyB0aHJvd24uXG4gKlxuICogU2VlIFt0b3BvbG9naWNhbCBzb3J0aW5nXShodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Ub3BvbG9naWNhbF9zb3J0aW5nKVxuICogZm9yIG1vcmUgZGV0YWlscyBhYm91dCBob3cgdGhpcyBhbGdvcml0aG0gd29ya3MuXG4gKlxuICogQHBhcmFtIHtEaWdyYXBofSBnIHRoZSBncmFwaCB0byBzb3J0XG4gKi9cbmZ1bmN0aW9uIHRvcHNvcnQoZykge1xuICBpZiAoIWcuaXNEaXJlY3RlZCgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwidG9wc29ydCBjYW4gb25seSBiZSBhcHBsaWVkIHRvIGEgZGlyZWN0ZWQgZ3JhcGguIEJhZCBpbnB1dDogXCIgKyBnKTtcbiAgfVxuXG4gIHZhciB2aXNpdGVkID0ge307XG4gIHZhciBzdGFjayA9IHt9O1xuICB2YXIgcmVzdWx0cyA9IFtdO1xuXG4gIGZ1bmN0aW9uIHZpc2l0KG5vZGUpIHtcbiAgICBpZiAobm9kZSBpbiBzdGFjaykge1xuICAgICAgdGhyb3cgbmV3IEN5Y2xlRXhjZXB0aW9uKCk7XG4gICAgfVxuXG4gICAgaWYgKCEobm9kZSBpbiB2aXNpdGVkKSkge1xuICAgICAgc3RhY2tbbm9kZV0gPSB0cnVlO1xuICAgICAgdmlzaXRlZFtub2RlXSA9IHRydWU7XG4gICAgICBnLnByZWRlY2Vzc29ycyhub2RlKS5mb3JFYWNoKGZ1bmN0aW9uKHByZWQpIHtcbiAgICAgICAgdmlzaXQocHJlZCk7XG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSBzdGFja1tub2RlXTtcbiAgICAgIHJlc3VsdHMucHVzaChub2RlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgc2lua3MgPSBnLnNpbmtzKCk7XG4gIGlmIChnLm9yZGVyKCkgIT09IDAgJiYgc2lua3MubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEN5Y2xlRXhjZXB0aW9uKCk7XG4gIH1cblxuICBnLnNpbmtzKCkuZm9yRWFjaChmdW5jdGlvbihzaW5rKSB7XG4gICAgdmlzaXQoc2luayk7XG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHRzO1xufVxuXG5mdW5jdGlvbiBDeWNsZUV4Y2VwdGlvbigpIHt9XG5cbkN5Y2xlRXhjZXB0aW9uLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJHcmFwaCBoYXMgYXQgbGVhc3Qgb25lIGN5Y2xlXCI7XG59O1xuIiwiLy8gVGhpcyBmaWxlIHByb3ZpZGVzIGEgaGVscGVyIGZ1bmN0aW9uIHRoYXQgbWl4ZXMtaW4gRG90IGJlaGF2aW9yIHRvIGFuXG4vLyBleGlzdGluZyBncmFwaCBwcm90b3R5cGUuXG5cbi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbXBvdW5kaWZ5O1xuXG4vLyBFeHRlbmRzIHRoZSBnaXZlbiBTdXBlckNvbnN0cnVjdG9yIHdpdGggdGhlIGFiaWxpdHkgZm9yIG5vZGVzIHRvIGNvbnRhaW5cbi8vIG90aGVyIG5vZGVzLiBBIHNwZWNpYWwgbm9kZSBpZCBgbnVsbGAgaXMgdXNlZCB0byBpbmRpY2F0ZSB0aGUgcm9vdCBncmFwaC5cbmZ1bmN0aW9uIGNvbXBvdW5kaWZ5KFN1cGVyQ29uc3RydWN0b3IpIHtcbiAgZnVuY3Rpb24gQ29uc3RydWN0b3IoKSB7XG4gICAgU3VwZXJDb25zdHJ1Y3Rvci5jYWxsKHRoaXMpO1xuXG4gICAgLy8gTWFwIG9mIG9iamVjdCBpZCAtPiBwYXJlbnQgaWQgKG9yIG51bGwgZm9yIHJvb3QgZ3JhcGgpXG4gICAgdGhpcy5fcGFyZW50cyA9IHt9O1xuXG4gICAgLy8gTWFwIG9mIGlkIChvciBudWxsKSAtPiBjaGlsZHJlbiBzZXRcbiAgICB0aGlzLl9jaGlsZHJlbiA9IHt9O1xuICAgIHRoaXMuX2NoaWxkcmVuW251bGxdID0gbmV3IFNldCgpO1xuICB9XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlID0gbmV3IFN1cGVyQ29uc3RydWN0b3IoKTtcbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLnBhcmVudCA9IGZ1bmN0aW9uKHUsIHBhcmVudCkge1xuICAgIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgIHJldHVybiB0aGlzLl9wYXJlbnRzW3VdO1xuICAgIH1cblxuICAgIGlmICh1ID09PSBwYXJlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBtYWtlIFwiICsgdSArIFwiIGEgcGFyZW50IG9mIGl0c2VsZlwiKTtcbiAgICB9XG4gICAgaWYgKHBhcmVudCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3RyaWN0R2V0Tm9kZShwYXJlbnQpO1xuICAgIH1cblxuICAgIHRoaXMuX2NoaWxkcmVuW3RoaXMuX3BhcmVudHNbdV1dLnJlbW92ZSh1KTtcbiAgICB0aGlzLl9wYXJlbnRzW3VdID0gcGFyZW50O1xuICAgIHRoaXMuX2NoaWxkcmVuW3BhcmVudF0uYWRkKHUpO1xuICB9O1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5jaGlsZHJlbiA9IGZ1bmN0aW9uKHUpIHtcbiAgICBpZiAodSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2NoaWxkcmVuW3VdLmtleXMoKTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuYWRkTm9kZSA9IGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgdSA9IFN1cGVyQ29uc3RydWN0b3IucHJvdG90eXBlLmFkZE5vZGUuY2FsbCh0aGlzLCB1LCB2YWx1ZSk7XG4gICAgdGhpcy5fcGFyZW50c1t1XSA9IG51bGw7XG4gICAgdGhpcy5fY2hpbGRyZW5bdV0gPSBuZXcgU2V0KCk7XG4gICAgdGhpcy5fY2hpbGRyZW5bbnVsbF0uYWRkKHUpO1xuICAgIHJldHVybiB1O1xuICB9O1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5kZWxOb2RlID0gZnVuY3Rpb24odSkge1xuICAgIC8vIFByb21vdGUgYWxsIGNoaWxkcmVuIHRvIHRoZSBwYXJlbnQgb2YgdGhlIHN1YmdyYXBoXG4gICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50KHUpO1xuICAgIHRoaXMuX2NoaWxkcmVuW3VdLmtleXMoKS5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICB0aGlzLnBhcmVudChjaGlsZCwgcGFyZW50KTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuX2NoaWxkcmVuW3BhcmVudF0ucmVtb3ZlKHUpO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJlbnRzW3VdO1xuICAgIGRlbGV0ZSB0aGlzLl9jaGlsZHJlblt1XTtcblxuICAgIHJldHVybiBTdXBlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5kZWxOb2RlLmNhbGwodGhpcywgdSk7XG4gIH07XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29weSA9IFN1cGVyQ29uc3RydWN0b3IucHJvdG90eXBlLmNvcHkuY2FsbCh0aGlzKTtcbiAgICB0aGlzLm5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICBjb3B5LnBhcmVudCh1LCB0aGlzLnBhcmVudCh1KSk7XG4gICAgfSwgdGhpcyk7XG4gICAgcmV0dXJuIGNvcHk7XG4gIH07XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmZpbHRlck5vZGVzID0gZnVuY3Rpb24oZmlsdGVyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBjb3B5ID0gU3VwZXJDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZmlsdGVyTm9kZXMuY2FsbCh0aGlzLCBmaWx0ZXIpO1xuXG4gICAgdmFyIHBhcmVudHMgPSB7fTtcbiAgICBmdW5jdGlvbiBmaW5kUGFyZW50KHUpIHtcbiAgICAgIHZhciBwYXJlbnQgPSBzZWxmLnBhcmVudCh1KTtcbiAgICAgIGlmIChwYXJlbnQgPT09IG51bGwgfHwgY29weS5oYXNOb2RlKHBhcmVudCkpIHtcbiAgICAgICAgcGFyZW50c1t1XSA9IHBhcmVudDtcbiAgICAgICAgcmV0dXJuIHBhcmVudDtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50IGluIHBhcmVudHMpIHtcbiAgICAgICAgcmV0dXJuIHBhcmVudHNbcGFyZW50XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmaW5kUGFyZW50KHBhcmVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29weS5lYWNoTm9kZShmdW5jdGlvbih1KSB7IGNvcHkucGFyZW50KHUsIGZpbmRQYXJlbnQodSkpOyB9KTtcblxuICAgIHJldHVybiBjb3B5O1xuICB9O1xuXG4gIHJldHVybiBDb25zdHJ1Y3Rvcjtcbn1cbiIsInZhciBHcmFwaCA9IHJlcXVpcmUoXCIuLi9HcmFwaFwiKSxcbiAgICBEaWdyYXBoID0gcmVxdWlyZShcIi4uL0RpZ3JhcGhcIiksXG4gICAgQ0dyYXBoID0gcmVxdWlyZShcIi4uL0NHcmFwaFwiKSxcbiAgICBDRGlncmFwaCA9IHJlcXVpcmUoXCIuLi9DRGlncmFwaFwiKTtcblxuZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbihub2RlcywgZWRnZXMsIEN0b3IpIHtcbiAgQ3RvciA9IEN0b3IgfHwgRGlncmFwaDtcblxuICBpZiAodHlwZU9mKG5vZGVzKSAhPT0gXCJBcnJheVwiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwibm9kZXMgaXMgbm90IGFuIEFycmF5XCIpO1xuICB9XG5cbiAgaWYgKHR5cGVPZihlZGdlcykgIT09IFwiQXJyYXlcIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcImVkZ2VzIGlzIG5vdCBhbiBBcnJheVwiKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgQ3RvciA9PT0gXCJzdHJpbmdcIikge1xuICAgIHN3aXRjaChDdG9yKSB7XG4gICAgICBjYXNlIFwiZ3JhcGhcIjogQ3RvciA9IEdyYXBoOyBicmVhaztcbiAgICAgIGNhc2UgXCJkaWdyYXBoXCI6IEN0b3IgPSBEaWdyYXBoOyBicmVhaztcbiAgICAgIGNhc2UgXCJjZ3JhcGhcIjogQ3RvciA9IENHcmFwaDsgYnJlYWs7XG4gICAgICBjYXNlIFwiY2RpZ3JhcGhcIjogQ3RvciA9IENEaWdyYXBoOyBicmVhaztcbiAgICAgIGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcihcIlVucmVjb2duaXplZCBncmFwaCB0eXBlOiBcIiArIEN0b3IpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBncmFwaCA9IG5ldyBDdG9yKCk7XG5cbiAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgZ3JhcGguYWRkTm9kZSh1LmlkLCB1LnZhbHVlKTtcbiAgfSk7XG5cbiAgLy8gSWYgdGhlIGdyYXBoIGlzIGNvbXBvdW5kLCBzZXQgdXAgY2hpbGRyZW4uLi5cbiAgaWYgKGdyYXBoLnBhcmVudCkge1xuICAgIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgaWYgKHUuY2hpbGRyZW4pIHtcbiAgICAgICAgdS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICBncmFwaC5wYXJlbnQodiwgdS5pZCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZWRnZXMuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgZ3JhcGguYWRkRWRnZShlLmlkLCBlLnUsIGUudiwgZS52YWx1ZSk7XG4gIH0pO1xuXG4gIHJldHVybiBncmFwaDtcbn07XG5cbmV4cG9ydHMuZW5jb2RlID0gZnVuY3Rpb24oZ3JhcGgpIHtcbiAgdmFyIG5vZGVzID0gW107XG4gIHZhciBlZGdlcyA9IFtdO1xuXG4gIGdyYXBoLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgdmFyIG5vZGUgPSB7aWQ6IHUsIHZhbHVlOiB2YWx1ZX07XG4gICAgaWYgKGdyYXBoLmNoaWxkcmVuKSB7XG4gICAgICB2YXIgY2hpbGRyZW4gPSBncmFwaC5jaGlsZHJlbih1KTtcbiAgICAgIGlmIChjaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgbm9kZS5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgICAgfVxuICAgIH1cbiAgICBub2Rlcy5wdXNoKG5vZGUpO1xuICB9KTtcblxuICBncmFwaC5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGVkZ2VzLnB1c2goe2lkOiBlLCB1OiB1LCB2OiB2LCB2YWx1ZTogdmFsdWV9KTtcbiAgfSk7XG5cbiAgdmFyIHR5cGU7XG4gIGlmIChncmFwaCBpbnN0YW5jZW9mIENEaWdyYXBoKSB7XG4gICAgdHlwZSA9IFwiY2RpZ3JhcGhcIjtcbiAgfSBlbHNlIGlmIChncmFwaCBpbnN0YW5jZW9mIENHcmFwaCkge1xuICAgIHR5cGUgPSBcImNncmFwaFwiO1xuICB9IGVsc2UgaWYgKGdyYXBoIGluc3RhbmNlb2YgRGlncmFwaCkge1xuICAgIHR5cGUgPSBcImRpZ3JhcGhcIjtcbiAgfSBlbHNlIGlmIChncmFwaCBpbnN0YW5jZW9mIEdyYXBoKSB7XG4gICAgdHlwZSA9IFwiZ3JhcGhcIjtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb3VsZG4ndCBkZXRlcm1pbmUgdHlwZSBvZiBncmFwaDogXCIgKyBncmFwaCk7XG4gIH1cblxuICByZXR1cm4geyBub2Rlczogbm9kZXMsIGVkZ2VzOiBlZGdlcywgdHlwZTogdHlwZSB9O1xufTtcblxuZnVuY3Rpb24gdHlwZU9mKG9iaikge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikuc2xpY2UoOCwgLTEpO1xufVxuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbmV4cG9ydHMuYWxsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHsgcmV0dXJuIHRydWU7IH07XG59O1xuXG5leHBvcnRzLm5vZGVzRnJvbUxpc3QgPSBmdW5jdGlvbihub2Rlcykge1xuICB2YXIgc2V0ID0gbmV3IFNldChub2Rlcyk7XG4gIHJldHVybiBmdW5jdGlvbih1KSB7XG4gICAgcmV0dXJuIHNldC5oYXModSk7XG4gIH07XG59O1xuIiwidmFyIEdyYXBoID0gcmVxdWlyZShcIi4vR3JhcGhcIiksXG4gICAgRGlncmFwaCA9IHJlcXVpcmUoXCIuL0RpZ3JhcGhcIik7XG5cbi8vIFNpZGUtZWZmZWN0IGJhc2VkIGNoYW5nZXMgYXJlIGxvdXN5LCBidXQgbm9kZSBkb2Vzbid0IHNlZW0gdG8gcmVzb2x2ZSB0aGVcbi8vIHJlcXVpcmVzIGN5Y2xlLlxuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgZGlyZWN0ZWQgZ3JhcGggdXNpbmcgdGhlIG5vZGVzIGFuZCBlZGdlcyBmcm9tIHRoaXMgZ3JhcGguIFRoZVxuICogbmV3IGdyYXBoIHdpbGwgaGF2ZSB0aGUgc2FtZSBub2RlcywgYnV0IHdpbGwgaGF2ZSB0d2ljZSB0aGUgbnVtYmVyIG9mIGVkZ2VzOlxuICogZWFjaCBlZGdlIGlzIHNwbGl0IGludG8gdHdvIGVkZ2VzIHdpdGggb3Bwb3NpdGUgZGlyZWN0aW9ucy4gRWRnZSBpZHMsXG4gKiBjb25zZXF1ZW50bHksIGFyZSBub3QgcHJlc2VydmVkIGJ5IHRoaXMgdHJhbnNmb3JtYXRpb24uXG4gKi9cbkdyYXBoLnByb3RvdHlwZS50b0RpZ3JhcGggPVxuR3JhcGgucHJvdG90eXBlLmFzRGlyZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGcgPSBuZXcgRGlncmFwaCgpO1xuICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7IGcuYWRkTm9kZSh1LCB2YWx1ZSk7IH0pO1xuICB0aGlzLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgZy5hZGRFZGdlKG51bGwsIHUsIHYsIHZhbHVlKTtcbiAgICBnLmFkZEVkZ2UobnVsbCwgdiwgdSwgdmFsdWUpO1xuICB9KTtcbiAgcmV0dXJuIGc7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgdW5kaXJlY3RlZCBncmFwaCB1c2luZyB0aGUgbm9kZXMgYW5kIGVkZ2VzIGZyb20gdGhpcyBncmFwaC5cbiAqIFRoZSBuZXcgZ3JhcGggd2lsbCBoYXZlIHRoZSBzYW1lIG5vZGVzLCBidXQgdGhlIGVkZ2VzIHdpbGwgYmUgbWFkZVxuICogdW5kaXJlY3RlZC4gRWRnZSBpZHMgYXJlIHByZXNlcnZlZCBpbiB0aGlzIHRyYW5zZm9ybWF0aW9uLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS50b0dyYXBoID1cbkRpZ3JhcGgucHJvdG90eXBlLmFzVW5kaXJlY3RlZCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZyA9IG5ldyBHcmFwaCgpO1xuICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7IGcuYWRkTm9kZSh1LCB2YWx1ZSk7IH0pO1xuICB0aGlzLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgZy5hZGRFZGdlKGUsIHUsIHYsIHZhbHVlKTtcbiAgfSk7XG4gIHJldHVybiBnO1xufTtcbiIsIi8vIFJldHVybnMgYW4gYXJyYXkgb2YgYWxsIHZhbHVlcyBmb3IgcHJvcGVydGllcyBvZiAqKm8qKi5cbmV4cG9ydHMudmFsdWVzID0gZnVuY3Rpb24obykge1xuICB2YXIga3MgPSBPYmplY3Qua2V5cyhvKSxcbiAgICAgIGxlbiA9IGtzLmxlbmd0aCxcbiAgICAgIHJlc3VsdCA9IG5ldyBBcnJheShsZW4pLFxuICAgICAgaTtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgcmVzdWx0W2ldID0gb1trc1tpXV07XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICcwLjcuNCc7XG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gICd1c2Ugc3RyaWN0J1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZuKXtcbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICAgIHJldHVybiBmbi5iaW5kKG51bGwsIHRoaXMpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgIH1cbiAgfVxufSgpXG4iLCJ2YXIgZG9taWZ5ID0gcmVxdWlyZSgnZG9taWZ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaHlwZXJnbHVlO1xuZnVuY3Rpb24gaHlwZXJnbHVlIChzcmMsIHVwZGF0ZXMpIHtcbiAgICBpZiAoIXVwZGF0ZXMpIHVwZGF0ZXMgPSB7fTtcblxuICAgIHZhciBkb20gPSB0eXBlb2Ygc3JjID09PSAnb2JqZWN0J1xuICAgICAgICA/IFsgc3JjIF1cbiAgICAgICAgOiBkb21pZnkoc3JjKVxuICAgIDtcbiAgICBmb3JFYWNoKG9iamVjdEtleXModXBkYXRlcyksIGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICAgICAgICB2YXIgdmFsdWUgPSB1cGRhdGVzW3NlbGVjdG9yXTtcbiAgICAgICAgZm9yRWFjaChkb20sIGZ1bmN0aW9uIChkKSB7XG4gICAgICAgICAgICBpZiAoc2VsZWN0b3IgPT09ICc6Zmlyc3QnKSB7XG4gICAgICAgICAgICAgICAgYmluZChkLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICgvOmZpcnN0JC8udGVzdChzZWxlY3RvcikpIHtcbiAgICAgICAgICAgICAgICB2YXIgayA9IHNlbGVjdG9yLnJlcGxhY2UoLzpmaXJzdCQvLCAnJyk7XG4gICAgICAgICAgICAgICAgdmFyIGVsZW0gPSBkLnF1ZXJ5U2VsZWN0b3Ioayk7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW0pIGJpbmQoZWxlbSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG5vZGVzID0gZC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBiaW5kKG5vZGVzW2ldLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBkb20ubGVuZ3RoID09PSAxXG4gICAgICAgID8gZG9tWzBdXG4gICAgICAgIDogZG9tXG4gICAgO1xufVxuXG5mdW5jdGlvbiBiaW5kIChub2RlLCB2YWx1ZSkge1xuICAgIGlmIChpc0VsZW1lbnQodmFsdWUpKSB7XG4gICAgICAgIG5vZGUuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgIG5vZGUuYXBwZW5kQ2hpbGQodmFsdWUpO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgZSA9IGh5cGVyZ2x1ZShub2RlLmNsb25lTm9kZSh0cnVlKSwgdmFsdWVbaV0pO1xuICAgICAgICAgICAgbm9kZS5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlLCBub2RlKTtcbiAgICAgICAgfVxuICAgICAgICBub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobm9kZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZm9yRWFjaChvYmplY3RLZXlzKHZhbHVlKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgaWYgKGtleSA9PT0gJ190ZXh0Jykge1xuICAgICAgICAgICAgICAgIHNldFRleHQobm9kZSwgdmFsdWVba2V5XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChrZXkgPT09ICdfaHRtbCcgJiYgaXNFbGVtZW50KHZhbHVlW2tleV0pKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgICAgICAgICBub2RlLmFwcGVuZENoaWxkKHZhbHVlW2tleV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoa2V5ID09PSAnX2h0bWwnKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5pbm5lckhUTUwgPSB2YWx1ZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBub2RlLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlW2tleV0pO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSBzZXRUZXh0KG5vZGUsIHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZm9yRWFjaCh4cywgZikge1xuICAgIGlmICh4cy5mb3JFYWNoKSByZXR1cm4geHMuZm9yRWFjaChmKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSBmKHhzW2ldLCBpKVxufVxuXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgcmVzLnB1c2goa2V5KTtcbiAgICByZXR1cm4gcmVzO1xufTtcblxuZnVuY3Rpb24gaXNFbGVtZW50IChlKSB7XG4gICAgcmV0dXJuIGUgJiYgdHlwZW9mIGUgPT09ICdvYmplY3QnICYmIGUuY2hpbGROb2Rlc1xuICAgICAgICAmJiAodHlwZW9mIGUuYXBwZW5kQ2hpbGQgPT09ICdmdW5jdGlvbidcbiAgICAgICAgfHwgdHlwZW9mIGUuYXBwZW5kQ2hpbGQgPT09ICdvYmplY3QnKVxuICAgIDtcbn1cblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuZnVuY3Rpb24gc2V0VGV4dCAoZSwgcykge1xuICAgIGUuaW5uZXJIVE1MID0gJyc7XG4gICAgdmFyIHR4dCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFN0cmluZyhzKSk7XG4gICAgZS5hcHBlbmRDaGlsZCh0eHQpO1xufVxuIiwiXG4vKipcbiAqIEV4cG9zZSBgcGFyc2VgLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2U7XG5cbi8qKlxuICogV3JhcCBtYXAgZnJvbSBqcXVlcnkuXG4gKi9cblxudmFyIG1hcCA9IHtcbiAgb3B0aW9uOiBbMSwgJzxzZWxlY3QgbXVsdGlwbGU9XCJtdWx0aXBsZVwiPicsICc8L3NlbGVjdD4nXSxcbiAgb3B0Z3JvdXA6IFsxLCAnPHNlbGVjdCBtdWx0aXBsZT1cIm11bHRpcGxlXCI+JywgJzwvc2VsZWN0PiddLFxuICBsZWdlbmQ6IFsxLCAnPGZpZWxkc2V0PicsICc8L2ZpZWxkc2V0PiddLFxuICB0aGVhZDogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIHRib2R5OiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgdGZvb3Q6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICBjb2xncm91cDogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIGNhcHRpb246IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICB0cjogWzIsICc8dGFibGU+PHRib2R5PicsICc8L3Rib2R5PjwvdGFibGU+J10sXG4gIHRkOiBbMywgJzx0YWJsZT48dGJvZHk+PHRyPicsICc8L3RyPjwvdGJvZHk+PC90YWJsZT4nXSxcbiAgdGg6IFszLCAnPHRhYmxlPjx0Ym9keT48dHI+JywgJzwvdHI+PC90Ym9keT48L3RhYmxlPiddLFxuICBjb2w6IFsyLCAnPHRhYmxlPjx0Ym9keT48L3Rib2R5Pjxjb2xncm91cD4nLCAnPC9jb2xncm91cD48L3RhYmxlPiddLFxuICBfZGVmYXVsdDogWzAsICcnLCAnJ11cbn07XG5cbi8qKlxuICogUGFyc2UgYGh0bWxgIGFuZCByZXR1cm4gdGhlIGNoaWxkcmVuLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBodG1sXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKGh0bWwpIHtcbiAgaWYgKCdzdHJpbmcnICE9IHR5cGVvZiBodG1sKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdHJpbmcgZXhwZWN0ZWQnKTtcbiAgXG4gIC8vIHRhZyBuYW1lXG4gIHZhciBtID0gLzwoW1xcdzpdKykvLmV4ZWMoaHRtbCk7XG4gIGlmICghbSkgdGhyb3cgbmV3IEVycm9yKCdObyBlbGVtZW50cyB3ZXJlIGdlbmVyYXRlZC4nKTtcbiAgdmFyIHRhZyA9IG1bMV07XG4gIFxuICAvLyBib2R5IHN1cHBvcnRcbiAgaWYgKHRhZyA9PSAnYm9keScpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdodG1sJyk7XG4gICAgZWwuaW5uZXJIVE1MID0gaHRtbDtcbiAgICByZXR1cm4gW2VsLnJlbW92ZUNoaWxkKGVsLmxhc3RDaGlsZCldO1xuICB9XG4gIFxuICAvLyB3cmFwIG1hcFxuICB2YXIgd3JhcCA9IG1hcFt0YWddIHx8IG1hcC5fZGVmYXVsdDtcbiAgdmFyIGRlcHRoID0gd3JhcFswXTtcbiAgdmFyIHByZWZpeCA9IHdyYXBbMV07XG4gIHZhciBzdWZmaXggPSB3cmFwWzJdO1xuICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZWwuaW5uZXJIVE1MID0gcHJlZml4ICsgaHRtbCArIHN1ZmZpeDtcbiAgd2hpbGUgKGRlcHRoLS0pIGVsID0gZWwubGFzdENoaWxkO1xuXG4gIHJldHVybiBvcnBoYW4oZWwuY2hpbGRyZW4pO1xufVxuXG4vKipcbiAqIE9ycGhhbiBgZWxzYCBhbmQgcmV0dXJuIGFuIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7Tm9kZUxpc3R9IGVsc1xuICogQHJldHVybiB7QXJyYXl9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBvcnBoYW4oZWxzKSB7XG4gIHZhciByZXQgPSBbXTtcblxuICB3aGlsZSAoZWxzLmxlbmd0aCkge1xuICAgIHJldC5wdXNoKGVsc1swXS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGVsc1swXSkpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cbiIsInZvaWQgZnVuY3Rpb24ocm9vdCl7XG5cbiAgICAvLyByZXR1cm4gYSBudW1iZXIgYmV0d2VlbiAwIGFuZCBtYXgtMVxuICAgIGZ1bmN0aW9uIHIobWF4KXsgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSptYXgpIH1cblxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlKHNhbHQsIHNpemUpe1xuICAgICAgICB2YXIga2V5ID0gJydcbiAgICAgICAgdmFyIHNsID0gc2FsdC5sZW5ndGhcbiAgICAgICAgd2hpbGUgKCBzaXplIC0tICkge1xuICAgICAgICAgICAgdmFyIHJuZCA9IHIoc2wpXG4gICAgICAgICAgICBrZXkgKz0gc2FsdFtybmRdXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleVxuICAgIH1cblxuICAgIHZhciBybmR0b2sgPSBmdW5jdGlvbihzYWx0LCBzaXplKXtcbiAgICAgICAgcmV0dXJuIGlzTmFOKHNpemUpID8gdW5kZWZpbmVkIDpcbiAgICAgICAgICAgICAgIHNpemUgPCAxICAgID8gdW5kZWZpbmVkIDogZ2VuZXJhdGUoc2FsdCwgc2l6ZSlcblxuICAgIH1cblxuICAgIHJuZHRvay5nZW4gPSBjcmVhdGVHZW5lcmF0b3JcblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUdlbmVyYXRvcihzYWx0KXtcbiAgICAgICAgc2FsdCA9IHR5cGVvZiBzYWx0ICA9PSAnc3RyaW5nJyAmJiBzYWx0Lmxlbmd0aCA+IDAgPyBzYWx0IDogICdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h6eTAxMjM0NTY3ODknXG4gICAgICAgIHZhciB0ZW1wID0gcm5kdG9rLmJpbmQocm5kdG9rLCBzYWx0KVxuICAgICAgICB0ZW1wLnNhbHQgPSBmdW5jdGlvbigpeyByZXR1cm4gc2FsdCB9XG4gICAgICAgIHRlbXAuY3JlYXRlID0gY3JlYXRlR2VuZXJhdG9yXG4gICAgICAgIHRlbXAuZ2VuID0gY3JlYXRlR2VuZXJhdG9yXG4gICAgICAgIHJldHVybiB0ZW1wXG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVHZW5lcmF0b3IoKVxuXG59KHRoaXMpXG4iLCJ2b2lkIGZ1bmN0aW9uKHJvb3Qpe1xuXG5cdCd1c2Ugc3RyaWN0J1xuXG5cdHZhciBjcmVhdGUgPSBPYmplY3QuY3JlYXRlIHx8IGZ1bmN0aW9uKG8pe1xuXHRcdHZhciBGID0gZnVuY3Rpb24oKXt9XG5cdFx0Ri5wcm90b3R5cGUgPSBvXG5cdFx0cmV0dXJuIG5ldyBGKClcblx0fVxuXG5cdHZhciBleHRlbmQgPSBmdW5jdGlvbih0bywgZnJvbSl7XG5cdFx0Zm9yICggdmFyIHAgaW4gZnJvbSApIHRvW3BdID0gZnJvbVtwXVxuXHRcdHJldHVybiB0b1xuXHR9XG5cblx0Ly8gTGlicmFyeSBvYmplY3QgLSBhIGJhc2Ugb2JqZWN0IHRvIGJlIGV4dGVuZGVkXG5cdHZhciBWaXJhbCA9IHtcblxuXHRcdC8vIGNyZWF0ZSBhbiBpbmhlcml0aW5nIG9iamVjdCwgd2l0aCBhZGRlZCBvciBjaGFuZ2VkIG1ldGhvZHMgb3IgcHJvcGVydGllc1xuXHRcdGV4dGVuZDogZnVuY3Rpb24ocHJvcHMpe1xuXHRcdFx0cmV0dXJuIGV4dGVuZChjcmVhdGUodGhpcyksIHByb3BzKVxuXHRcdH0sXG5cblx0XHQvLyBjcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYW4gb2JqZWN0LCBjYWxsaW5nIGFuIGluaXQgbWV0aG9kIGlmIGF2YWlsYWJsZVxuXHRcdG1ha2U6IGZ1bmN0aW9uKCl7XG5cdFx0XHR2YXIgb2JqID0gY3JlYXRlKHRoaXMpXG5cdFx0XHRpZiAoIHR5cGVvZiBvYmouaW5pdCA9PT0gJ2Z1bmN0aW9uJyApIG9iai5pbml0LmFwcGx5KG9iaiwgYXJndW1lbnRzKVxuXHRcdFx0cmV0dXJuIG9ialxuXHRcdH1cblx0fVxuXG5cdC8vIG1vZHVsZSBkYW5jZVxuXHRpZiAoIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzICkgbW9kdWxlLmV4cG9ydHMgPSBWaXJhbFxuXHRlbHNlIGlmICggdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kICkgZGVmaW5lKFZpcmFsKVxuXHRlbHNlICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5WaXJhbCA9IFZpcmFsXG5cbn0odGhpcylcbiIsIi8vICMgXCJaaXBwaW5nIGFuZCBVbnppcHBpbmcgTGlzdHNcIlxuLy8gQmVjYXVzZSBqcyBpcyBkeW5hbWljIGFuZCBkb2Vzbid0IHJvY2sgdHVwbGVzLCB0aGVzZSB6aXBwZXJzIHdvcmsgd2l0aCBuXG4vLyBjaGFycyBpaXJjLCBhbmQgYWxzbyBhY3RzIGFzIGFuIHVuemlwLlxuXG5leHBvcnRzLnppcFdpdGggPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBmeG4gPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLFxuICAgICAgYXJncyA9IGZ4bi5zcGxpY2UoMSksXG4gICAgICBvdXRwdXQgPSBbXSxcbiAgICAgIHdpZHRoID0gTWF0aC5tYXguYXBwbHkobnVsbCwgQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKGFyZ3MsIGZ1bmN0aW9uKHhzKSB7XG4gICAgICAgIHJldHVybiB4cy5sZW5ndGg7XG4gICAgICB9KSksXG4gICAgICBpO1xuXG4gIGZ4biA9IGZ4blswXTtcblxuICBmb3IgKGkgPSAwOyBpIDwgd2lkdGg7IGkrKykge1xuICAgIG91dHB1dC5wdXNoKGZ4bi5hcHBseShudWxsLCBbXS5tYXAuY2FsbChhcmdzLCBmdW5jdGlvbih4cykge1xuICAgICAgcmV0dXJuIHhzW2ldO1xuICAgIH0pKSk7XG4gIH1cbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0cy56aXAgPSBleHBvcnRzLnppcFdpdGguYmluZChudWxsLCBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTsgXG59KTtcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgXCJ1c2Ugc3RyaWN0XCJcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZWZhdWx0cyhvYmopIHtcbiAgICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLmZvckVhY2goZnVuY3Rpb24oc291cmNlKXtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgIGlmIChvYmpbcHJvcF0gPT09IHVuZGVmaW5lZCkgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdXG4gICAgICB9XG4gICAgfSlcbiAgICByZXR1cm4gb2JqXG4gIH1cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuXG4gIGZ1bmN0aW9uIHF1ZXJ5KHNlbGVjdG9yLCBwYXJlbnQpe1xuICAgIHBhcmVudCA9IHBhcmVudCB8fCBkb2N1bWVudFxuICAgIHJldHVybiBwYXJlbnQucXVlcnlTZWxlY3RvcihzZWxlY3RvcilcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZSh0YWdfbmFtZSwgYXR0cnMpe1xuICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdfbmFtZSlcbiAgICBpZiAoIGF0dHJzICkgeyBzZXRfYXR0cmlidXRlcyhub2RlLCBhdHRycykgfVxuICAgIHJldHVybiBub2RlXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfYXR0cmlidXRlKG5vZGUsIGF0dHIpe1xuICAgIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsdmFsdWUpXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfYXR0cmlidXRlcyhub2RlLCBhdHRycyl7XG4gICAgT2JqZWN0LmtleXMoYXR0cnMpXG4gICAgICAgICAgLmZvckVhY2goZnVuY3Rpb24obmFtZSl7XG4gICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCBhdHRyc1tuYW1lXSlcbiAgICAgICAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3RleHQobm9kZSl7XG4gICAgcmV0dXJuIG5vZGUudGV4dENvbnRlbnQgfHwgbm9kZS5pbm5lclRleHRcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF90ZXh0KG5vZGUsIHRleHQpe1xuICAgIG5vZGUudGV4dENvbnRlbnQgPSBub2RlLmlubmVyVGV4dCA9IHRleHRcbiAgfVxuXG4gIGZ1bmN0aW9uIGluc2VydEFmdGVyKHBhcmVudEVsLCBzcDEsIHNwMil7XG4gICAgcGFyZW50RWwuaW5zZXJ0QmVmb3JlKHNwMSwgc3AyLm5leHRTaWJsaW5nKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlTm9kZShub2RlKXtcbiAgICBub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobm9kZSlcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICQgICAgICAgICAgICAgOiBxdWVyeVxuICAvLywgJGlkICAgICAgICAgICA6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkLmJpbmQoZG9jdW1lbnQpXG4gICwgJGlkICAgICAgICAgICA6IGZ1bmN0aW9uKGlkKXsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKSB9XG4gICwgY3JlYXRlICAgICAgICA6IGNyZWF0ZVxuICAsIGF0dHIgICAgICAgICAgOiBzZXRfYXR0cmlidXRlXG4gICwgYXR0cnMgICAgICAgICA6IHNldF9hdHRyaWJ1dGVzXG4gICwgZ2V0X3RleHQgICAgICA6IGdldF90ZXh0XG4gICwgc2V0X3RleHQgICAgICA6IHNldF90ZXh0XG4gICwgcmVtb3ZlICAgICAgICA6IHJlbW92ZU5vZGVcbiAgLCBpbnNlcnRBZnRlciAgIDogaW5zZXJ0QWZ0ZXJcbiAgfVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJylcblxuICBtb2R1bGUuZXhwb3J0cyA9IHZpcmFsLmV4dGVuZChldmVudHMuRXZlbnRFbWl0dGVyLnByb3RvdHlwZSkuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbigpeyBldmVudHMuRXZlbnRFbWl0dGVyLmNhbGwodGhpcykgfVxuICB9KVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBwbHVjayhuYW1lKXtcbiAgICByZXR1cm4gZnVuY3Rpb24gZ2V0QXR0cihvYmopeyByZXR1cm4gb2JqW25hbWVdIH1cbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gdHJhbnNsYXRlKHZlY3RvciwgcG9pbnQpe1xuICAgIHJldHVybiB7IHg6IHBvaW50LnggKyB2ZWN0b3JbMF0sIHk6IHBvaW50LnkgKyB2ZWN0b3JbMV0gfVxuICB9XG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIGlkcyA9IFtdXG4gIHZhciBydCA9IHJlcXVpcmUoJ3JhbmRvbS10b2tlbicpXG4gIHZhciBsZXR0ZXJzID0gcnQuZ2VuKCdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5dCcpXG5cbiAgZnVuY3Rpb24gdG9rZW4oKXsgcmV0dXJuIGxldHRlcnMoMSkgKyBydCgxNikgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcbiAgICB2YXIgaWQgPSB0b2tlbigpXG4gICAgd2hpbGUgKCBpZHMuaW5kZXhPZihpZCkgIT0gLTEgKXtcbiAgICAgIGlkID0gdG9rZW4oKVxuICAgIH1cbiAgICByZXR1cm4gaWRcbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgZnVuY3Rpb24gcHl0aChhLCBiKXtcbiAgICByZXR1cm4gTWF0aC5zcXJ0KE1hdGgucG93KGEsMiksIE1hdGgucG93KGIsMikpXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBjcm9zczogZnVuY3Rpb24gY3Jvc3Modiwgdyl7XG4gICAgICByZXR1cm4gdlswXSAqIHdbMV0gLSB2WzFdICogd1swXVxuICAgIH1cblxuICAsIGRvdDogIGZ1bmN0aW9uIGFkZCh2LCB3KXtcbiAgICAgIHJldHVybiB2WzBdICogd1swXSArIHZbMV0gKiB3WzFdXG4gICAgfVxuXG4gICwgYWRkOiAgZnVuY3Rpb24gYWRkKHYsIHcpe1xuICAgICAgcmV0dXJuIFt2WzBdICsgd1swXSwgdlsxXSArIHdbMV1dXG4gICAgfVxuXG4gICwgc3VidHJhY3Q6ICBmdW5jdGlvbiBzdWJ0cmFjdCh2LCB3KXtcbiAgICAgIHJldHVybiBbdlswXSAtIHdbMF0sIHZbMV0gLSB3WzFdXVxuICAgIH1cblxuICAsIHNjYWxlOiAgZnVuY3Rpb24gc2NhbGUodiwgcyl7XG4gICAgICByZXR1cm4gW3ZbMF0gKiBzLCB2WzFdICogc11cbiAgICB9XG5cbiAgLCBlcTogIGZ1bmN0aW9uIGVxKHYsIHcpe1xuICAgICAgcmV0dXJuIHZbMF0gPT0gd1swXSAmJiAgdlsxXSA9PSB3WzFdXG4gICAgfVxuICAsIG1hZ25pdHVkZTogZnVuY3Rpb24gbWFnbml0dWRlKHYpe1xuICAgICAgcmV0dXJuIHB5dGgodlswXSwgdlsxXSlcbiAgICB9XG5cbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIC8qIHRoYW5rcyBNYXhkYW1hbnR1cyAqL1xuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICB6aXA6IGZ1bmN0aW9uKHhzLCB5cyl7XG4gICAgICByZXR1cm4gQXJyYXkuYXBwbHkobnVsbCwgQXJyYXkoTWF0aC5taW4oeHMubGVuZ3RoLCB5cy5sZW5ndGgpKSlcbiAgICAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oXywgaSl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbeHNbaV0sIHlzW2ldXVxuICAgICAgICAgICAgICAgICAgfSlcbiAgICB9XG5cbiAgLCB6aXBXaXRoOiBmdW5jdGlvbihmbiwgeHMsIHlzKXtcbiAgICAgIHJldHVybiBBcnJheS5hcHBseShudWxsLCBBcnJheShNYXRoLm1pbih4cy5sZW5ndGgsIHlzLmxlbmd0aCkpKVxuICAgICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbihfLCBpKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZuKHhzW2ldLCB5c1tpXSlcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICwgemlwR3JlZWR5OiBmdW5jdGlvbih4cywgeXMpe1xuICAgICAgcmV0dXJuIEFycmF5LmFwcGx5KG51bGwsIEFycmF5KE1hdGgubWF4KHhzLmxlbmd0aCwgeXMubGVuZ3RoKSkpXG4gICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKF8sIGkpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW3hzW2ldLCB5c1tpXV1cbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICwgemlwV2l0aEdyZWVkeTogZnVuY3Rpb24oZm4sIHhzLCB5cyl7XG4gICAgICByZXR1cm4gQXJyYXkuYXBwbHkobnVsbCwgQXJyYXkoTWF0aC5tYXgoeHMubGVuZ3RoLCB5cy5sZW5ndGgpKSlcbiAgICAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oXywgaSl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmbih4c1tpXSwgeXNbaV0pXG4gICAgICAgICAgICAgICAgICB9KVxuICAgIH1cbiAgfVxufSgpXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iXX0=
