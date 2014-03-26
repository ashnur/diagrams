!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Diagram=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
void function(){
  // var Snap = require('snapsvg')
  var viral = _dereq_('viral')
  var enslave = _dereq_('enslave')
  var dagre = _dereq_('dagre')
  var hglue = _dereq_('hyperglue')
  var zippy = _dereq_('zippy')
  var pluck = _dereq_('../util/pluck.js')
  var defaults = _dereq_('../util/defaults.js')
  var uid = _dereq_('../util/unique_id.js')
  var dom = _dereq_('../util/dom.js')
  var intersect = _dereq_('./intersect.js')
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
    var edges = _dereq_('./edges.js')(diagram, layout)

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

  var emitter = _dereq_('../util/emitter.js')
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

},{"../util/defaults.js":59,"../util/dom.js":60,"../util/emitter.js":61,"../util/pluck.js":62,"../util/unique_id.js":64,"./edges.js":2,"./intersect.js":3,"dagre":8,"enslave":53,"hyperglue":54,"viral":57,"zippy":58}],2:[function(_dereq_,module,exports){
void function(){

  var zippy = _dereq_('zippy')
  var zip = zippy.zip
  var zipWith = zippy.zipWith
  var uid = _dereq_('../util/unique_id.js')
  var translate = _dereq_('../util/translate.js')

  function node_from_id(graph, id){
    var n = graph.node(id)
    n.id = id
    return n
  }

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
      }).reduce(function(steps, step){
        if ( steps.some(function(s){ return s.exit.node == step.node }) ) {

        }
        steps.push(step)
        return steps
      }, [])

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

      rank.skippoints = {
        exits: rank.exits.filter(not_in_steps)
      , entries: rank.entries.filter(not_in_steps)
      }

      return rank
    }).map(function(rank){
      rank.psep = rankSep / (rank.entries.length + rank.exits.length - rank.steps.length + 1)
      rank.steps = rank.steps.map(function(s, si){
        var tr = rank.psep * (si + 1)
        if ( reversed ) tr  = tr * -1
        s.exit_junction  = translate(vertical ? [0, tr] : [tr, 0], s.exit)
        s.entry_junction = translate(vertical ? [0, tr - (reversed ? -1 * rankSep : rankSep)]
                                              : [tr - (reversed ? -1 * rankSep : rankSep), 0], s.entry)
        return s
      })

      rank.skippoints.exits = rank.skippoints.exits.map(function(point, i){
        var tr = rank.psep * (i + rank.steps.length + 1)
        if ( reversed ) tr  = tr * -1
        point.junction = translate(vertical ? [0, tr] : [tr, 0], point)
        return point
      })

      rank.skippoints.entries = rank.skippoints.entries.map(function(point, i){
        var tr = rank.psep * (i + rank.steps.length + rank.skippoints.exits.length + 1)
        if ( reversed ) tr  = tr * -1
        point.junction = translate(vertical ? [0, tr - (reversed ? -1 * rankSep : rankSep)]
                                            : [tr - (reversed ? -1 * rankSep : rankSep), 0], point)
        return point
      })

      return rank
    })

    function calculate_skip(skips, level, s){
      var p2 = get_junction(vertical, s.exit.junction[rank_attr], level)
      var p3 = get_junction(vertical, s.entry.junction[rank_attr], level )
      return skips.concat([
               create_segment(s.exit, s.exit.junction)
             , create_segment(s.exit.junction, p2)
             , create_segment(p2, p3)
             , create_segment(p3, s.entry.junction)
             , create_segment(s.entry.junction, s.entry)
             ])
    }

    var edges = ranks.reduce(function(pw, rank, rn){
      var fs_length = ranks.slice(0, rn).reduce(function(tsc, r){ return tsc + r.forward_skips.length }, 1)
      var bs_length = ranks.slice(0, rn).reduce(function(tsc, r){ return tsc + r.backward_skips.length }, 1)

      return pw.concat(rank.steps.reduce(function(steps, s, si){

        return steps.concat([ create_segment(s.exit, s.exit_junction)
               , create_segment(s.exit_junction, s.entry_junction)
               , create_segment(s.entry_junction, s.entry)])

        return steps.concat(steps.joints.reduce(function(p, n){
          create_segment(p, n)
          return n
        }))

      }, []).concat(rank.forward_skips.reduce(function(skips, s, si){
        var level_amount = (fs_length + si) * skipsep
        var level = reversed ? 0 - level_amount : g[level_dir] + level_amount

        return calculate_skip(skips, level, s)


      }, [])).concat(rank.backward_skips.reduce(function(skips, s, si){
        var level_amount = (bs_length + si) * skipsep
        var level = reversed ? g[level_dir] + level_amount : 0 - level_amount
        return calculate_skip(skips, level, s)

      }, [])))
    }, [])

    edges.growth = ranks.reduce(function(ss, r){ return ss + r.forward_skips.length + r.backward_skips.length}, 0) * skipsep

    return edges
  }

}()

},{"../util/translate.js":63,"../util/unique_id.js":64,"zippy":58}],3:[function(_dereq_,module,exports){
void function(){

  var V = _dereq_('../util/vectors.js')

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

},{"../util/vectors.js":65}],4:[function(_dereq_,module,exports){
void function(){
  var enslave = _dereq_('enslave')
  var Node = _dereq_('./node.js')
  var uid = _dereq_('../util/unique_id.js')

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

},{"../util/unique_id.js":64,"./node.js":6,"enslave":53}],5:[function(_dereq_,module,exports){
void function(){
  var viral = _dereq_('viral')
  var enslave = _dereq_('enslave')
  var dagre = _dereq_('dagre')
  var uid = _dereq_('../util/unique_id.js')
  var Node = _dereq_('./node.js')
  var Edge = _dereq_('./edge.js')

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

  var emitter = _dereq_('../util/emitter.js')
  var graph = emitter.extend(dagre.Digraph.prototype)
                     .extend({ init: function(){ dagre.Digraph.call(this) } })

  module.exports = graph.extend({
    add_node: enslave(add_node)
  , del_node: enslave(remove_node)
  , connect: enslave(connect)
  , disconnect: enslave(disconnect)
  })

}()

},{"../util/emitter.js":61,"../util/unique_id.js":64,"./edge.js":4,"./node.js":6,"dagre":8,"enslave":53,"viral":57}],6:[function(_dereq_,module,exports){
void function(){
  var viral = _dereq_('viral')
  var enslave = _dereq_('enslave')
  var uid = _dereq_('../util/unique_id.js')

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

},{"../util/unique_id.js":64,"enslave":53,"viral":57}],7:[function(_dereq_,module,exports){
void function(){

  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^\s+|\s+$/g, '')
    }
  }

  var defaults = _dereq_('./util/defaults.js')
  var Graph = _dereq_('./graph/graph.js')
  var Diagram = _dereq_('./diagram/diagram.js')


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

}()

},{"./diagram/diagram.js":1,"./graph/graph.js":5,"./util/defaults.js":59}],8:[function(_dereq_,module,exports){
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
exports.Digraph = _dereq_("graphlib").Digraph;
exports.Graph = _dereq_("graphlib").Graph;
exports.layout = _dereq_("./lib/layout");
exports.version = _dereq_("./lib/version");

},{"./lib/layout":9,"./lib/version":24,"graphlib":30}],9:[function(_dereq_,module,exports){
var util = _dereq_('./util'),
    rank = _dereq_('./rank'),
    order = _dereq_('./order'),
    CGraph = _dereq_('graphlib').CGraph,
    CDigraph = _dereq_('graphlib').CDigraph;

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
  var position = _dereq_('./position')();

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


},{"./order":10,"./position":15,"./rank":16,"./util":23,"graphlib":30}],10:[function(_dereq_,module,exports){
var util = _dereq_('./util'),
    crossCount = _dereq_('./order/crossCount'),
    initLayerGraphs = _dereq_('./order/initLayerGraphs'),
    initOrder = _dereq_('./order/initOrder'),
    sortLayer = _dereq_('./order/sortLayer');

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

},{"./order/crossCount":11,"./order/initLayerGraphs":12,"./order/initOrder":13,"./order/sortLayer":14,"./util":23}],11:[function(_dereq_,module,exports){
var util = _dereq_('../util');

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

},{"../util":23}],12:[function(_dereq_,module,exports){
var nodesFromList = _dereq_('graphlib').filter.nodesFromList,
    /* jshint -W079 */
    Set = _dereq_('cp-data').Set;

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

},{"cp-data":25,"graphlib":30}],13:[function(_dereq_,module,exports){
var crossCount = _dereq_('./crossCount'),
    util = _dereq_('../util');

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

},{"../util":23,"./crossCount":11}],14:[function(_dereq_,module,exports){
var util = _dereq_('../util');
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

},{"../util":23}],15:[function(_dereq_,module,exports){
var util = _dereq_('./util');

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

},{"./util":23}],16:[function(_dereq_,module,exports){
var util = _dereq_('./util'),
    acyclic = _dereq_('./rank/acyclic'),
    initRank = _dereq_('./rank/initRank'),
    feasibleTree = _dereq_('./rank/feasibleTree'),
    constraints = _dereq_('./rank/constraints'),
    simplex = _dereq_('./rank/simplex'),
    components = _dereq_('graphlib').alg.components,
    filter = _dereq_('graphlib').filter;

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

},{"./rank/acyclic":17,"./rank/constraints":18,"./rank/feasibleTree":19,"./rank/initRank":20,"./rank/simplex":22,"./util":23,"graphlib":30}],17:[function(_dereq_,module,exports){
var util = _dereq_('../util');

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

},{"../util":23}],18:[function(_dereq_,module,exports){
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

},{}],19:[function(_dereq_,module,exports){
/* jshint -W079 */
var Set = _dereq_('cp-data').Set,
/* jshint +W079 */
    Digraph = _dereq_('graphlib').Digraph,
    util = _dereq_('../util');

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

},{"../util":23,"cp-data":25,"graphlib":30}],20:[function(_dereq_,module,exports){
var util = _dereq_('../util'),
    topsort = _dereq_('graphlib').alg.topsort;

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

},{"../util":23,"graphlib":30}],21:[function(_dereq_,module,exports){
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

},{}],22:[function(_dereq_,module,exports){
var util = _dereq_('../util'),
    rankUtil = _dereq_('./rankUtil');

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

},{"../util":23,"./rankUtil":21}],23:[function(_dereq_,module,exports){
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

},{}],24:[function(_dereq_,module,exports){
module.exports = '0.4.5';

},{}],25:[function(_dereq_,module,exports){
exports.Set = _dereq_('./lib/Set');
exports.PriorityQueue = _dereq_('./lib/PriorityQueue');
exports.version = _dereq_('./lib/version');

},{"./lib/PriorityQueue":26,"./lib/Set":27,"./lib/version":29}],26:[function(_dereq_,module,exports){
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

},{}],27:[function(_dereq_,module,exports){
var util = _dereq_('./util');

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

},{"./util":28}],28:[function(_dereq_,module,exports){
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

},{}],29:[function(_dereq_,module,exports){
module.exports = '1.1.3';

},{}],30:[function(_dereq_,module,exports){
exports.Graph = _dereq_("./lib/Graph");
exports.Digraph = _dereq_("./lib/Digraph");
exports.CGraph = _dereq_("./lib/CGraph");
exports.CDigraph = _dereq_("./lib/CDigraph");
_dereq_("./lib/graph-converters");

exports.alg = {
  isAcyclic: _dereq_("./lib/alg/isAcyclic"),
  components: _dereq_("./lib/alg/components"),
  dijkstra: _dereq_("./lib/alg/dijkstra"),
  dijkstraAll: _dereq_("./lib/alg/dijkstraAll"),
  findCycles: _dereq_("./lib/alg/findCycles"),
  floydWarshall: _dereq_("./lib/alg/floydWarshall"),
  postorder: _dereq_("./lib/alg/postorder"),
  preorder: _dereq_("./lib/alg/preorder"),
  prim: _dereq_("./lib/alg/prim"),
  tarjan: _dereq_("./lib/alg/tarjan"),
  topsort: _dereq_("./lib/alg/topsort")
};

exports.converter = {
  json: _dereq_("./lib/converter/json.js")
};

var filter = _dereq_("./lib/filter");
exports.filter = {
  all: filter.all,
  nodesFromList: filter.nodesFromList
};

exports.version = _dereq_("./lib/version");

},{"./lib/CDigraph":32,"./lib/CGraph":33,"./lib/Digraph":34,"./lib/Graph":35,"./lib/alg/components":36,"./lib/alg/dijkstra":37,"./lib/alg/dijkstraAll":38,"./lib/alg/findCycles":39,"./lib/alg/floydWarshall":40,"./lib/alg/isAcyclic":41,"./lib/alg/postorder":42,"./lib/alg/preorder":43,"./lib/alg/prim":44,"./lib/alg/tarjan":45,"./lib/alg/topsort":46,"./lib/converter/json.js":48,"./lib/filter":49,"./lib/graph-converters":50,"./lib/version":52}],31:[function(_dereq_,module,exports){
/* jshint -W079 */
var Set = _dereq_("cp-data").Set;
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


},{"cp-data":25}],32:[function(_dereq_,module,exports){
var Digraph = _dereq_("./Digraph"),
    compoundify = _dereq_("./compoundify");

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

},{"./Digraph":34,"./compoundify":47}],33:[function(_dereq_,module,exports){
var Graph = _dereq_("./Graph"),
    compoundify = _dereq_("./compoundify");

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

},{"./Graph":35,"./compoundify":47}],34:[function(_dereq_,module,exports){
/*
 * This file is organized with in the following order:
 *
 * Exports
 * Graph constructors
 * Graph queries (e.g. nodes(), edges()
 * Graph mutators
 * Helper functions
 */

var util = _dereq_("./util"),
    BaseGraph = _dereq_("./BaseGraph"),
/* jshint -W079 */
    Set = _dereq_("cp-data").Set;
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


},{"./BaseGraph":31,"./util":51,"cp-data":25}],35:[function(_dereq_,module,exports){
/*
 * This file is organized with in the following order:
 *
 * Exports
 * Graph constructors
 * Graph queries (e.g. nodes(), edges()
 * Graph mutators
 * Helper functions
 */

var util = _dereq_("./util"),
    BaseGraph = _dereq_("./BaseGraph"),
/* jshint -W079 */
    Set = _dereq_("cp-data").Set;
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


},{"./BaseGraph":31,"./util":51,"cp-data":25}],36:[function(_dereq_,module,exports){
/* jshint -W079 */
var Set = _dereq_("cp-data").Set;
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

},{"cp-data":25}],37:[function(_dereq_,module,exports){
var PriorityQueue = _dereq_("cp-data").PriorityQueue;

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

},{"cp-data":25}],38:[function(_dereq_,module,exports){
var dijkstra = _dereq_("./dijkstra");

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

},{"./dijkstra":37}],39:[function(_dereq_,module,exports){
var tarjan = _dereq_("./tarjan");

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

},{"./tarjan":45}],40:[function(_dereq_,module,exports){
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

},{}],41:[function(_dereq_,module,exports){
var topsort = _dereq_("./topsort");

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

},{"./topsort":46}],42:[function(_dereq_,module,exports){
/* jshint -W079 */
var Set = _dereq_("cp-data").Set;
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

},{"cp-data":25}],43:[function(_dereq_,module,exports){
/* jshint -W079 */
var Set = _dereq_("cp-data").Set;
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

},{"cp-data":25}],44:[function(_dereq_,module,exports){
var Graph = _dereq_("../Graph"),
    PriorityQueue = _dereq_("cp-data").PriorityQueue;

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

},{"../Graph":35,"cp-data":25}],45:[function(_dereq_,module,exports){
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

},{}],46:[function(_dereq_,module,exports){
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

},{}],47:[function(_dereq_,module,exports){
// This file provides a helper function that mixes-in Dot behavior to an
// existing graph prototype.

/* jshint -W079 */
var Set = _dereq_("cp-data").Set;
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

},{"cp-data":25}],48:[function(_dereq_,module,exports){
var Graph = _dereq_("../Graph"),
    Digraph = _dereq_("../Digraph"),
    CGraph = _dereq_("../CGraph"),
    CDigraph = _dereq_("../CDigraph");

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

},{"../CDigraph":32,"../CGraph":33,"../Digraph":34,"../Graph":35}],49:[function(_dereq_,module,exports){
/* jshint -W079 */
var Set = _dereq_("cp-data").Set;
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

},{"cp-data":25}],50:[function(_dereq_,module,exports){
var Graph = _dereq_("./Graph"),
    Digraph = _dereq_("./Digraph");

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

},{"./Digraph":34,"./Graph":35}],51:[function(_dereq_,module,exports){
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

},{}],52:[function(_dereq_,module,exports){
module.exports = '0.7.4';

},{}],53:[function(_dereq_,module,exports){
void function(){
  'use strict'
  module.exports = function(fn){
    return function(){
      return fn.bind(null, this).apply(null, arguments)
   }
  }
}()

},{}],54:[function(_dereq_,module,exports){
var domify = _dereq_('domify');

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

},{"domify":55}],55:[function(_dereq_,module,exports){

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

},{}],56:[function(_dereq_,module,exports){
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

},{}],57:[function(_dereq_,module,exports){
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

},{}],58:[function(_dereq_,module,exports){
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

},{}],59:[function(_dereq_,module,exports){
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

},{}],60:[function(_dereq_,module,exports){
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

},{}],61:[function(_dereq_,module,exports){
void function(){
  var viral = _dereq_('viral')
  var events = _dereq_('events')

  module.exports = viral.extend(events.EventEmitter.prototype).extend({
    init: function(){ events.EventEmitter.call(this) }
  })

}()

},{"events":66,"viral":57}],62:[function(_dereq_,module,exports){
void function(){
  module.exports = function pluck(name){
    return function getAttr(obj){ return obj[name] }
  }
}()

},{}],63:[function(_dereq_,module,exports){
void function(){
  module.exports = function translate(vector, point){
    return { x: point.x + vector[0], y: point.y + vector[1] }
  }
}()

},{}],64:[function(_dereq_,module,exports){
void function(){
  var ids = []
  var rt = _dereq_('random-token')
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

},{"random-token":56}],65:[function(_dereq_,module,exports){
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

},{}],66:[function(_dereq_,module,exports){
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

},{}]},{},[7])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9kaWFncmFtL2RpYWdyYW0uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9lZGdlcy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9kaWFncmFtL2ludGVyc2VjdC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ncmFwaC9lZGdlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL2dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL25vZGUuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvbGF5b3V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9vcmRlci9jcm9zc0NvdW50LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdExheWVyR3JhcGhzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdE9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvc29ydExheWVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcG9zaXRpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9hY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9jb25zdHJhaW50cy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvZmVhc2libGVUcmVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9pbml0UmFuay5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvcmFua1V0aWwuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rL3NpbXBsZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi91dGlsLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvdmVyc2lvbi5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9jcC1kYXRhL2xpYi9Qcmlvcml0eVF1ZXVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvU2V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvbGliL3ZlcnNpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9pbmRleC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9CYXNlR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2NvbXBvbmVudHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2RpamtzdHJhLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9kaWprc3RyYUFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmluZEN5Y2xlcy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmxveWRXYXJzaGFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvaXNBY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wb3N0b3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3ByZW9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wcmltLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy90YXJqYW4uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3RvcHNvcnQuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29tcG91bmRpZnkuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29udmVydGVyL2pzb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvZmlsdGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2dyYXBoLWNvbnZlcnRlcnMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi92ZXJzaW9uLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9lbnNsYXZlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9oeXBlcmdsdWUvYnJvd3Nlci5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvaHlwZXJnbHVlL25vZGVfbW9kdWxlcy9kb21pZnkvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL3JhbmRvbS10b2tlbi9pbmRleC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvdmlyYWwvdmlyYWwuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL3ppcHB5L3ppcHB5LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvZGVmYXVsdHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC9kb20uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC9lbWl0dGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvcGx1Y2suanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC90cmFuc2xhdGUuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC91bmlxdWVfaWQuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvdXRpbC92ZWN0b3JzLmpzIiwiL3Vzci9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25NQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZvaWQgZnVuY3Rpb24oKXtcbiAgLy8gdmFyIFNuYXAgPSByZXF1aXJlKCdzbmFwc3ZnJylcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuICB2YXIgZGFncmUgPSByZXF1aXJlKCdkYWdyZScpXG4gIHZhciBoZ2x1ZSA9IHJlcXVpcmUoJ2h5cGVyZ2x1ZScpXG4gIHZhciB6aXBweSA9IHJlcXVpcmUoJ3ppcHB5JylcbiAgdmFyIHBsdWNrID0gcmVxdWlyZSgnLi4vdXRpbC9wbHVjay5qcycpXG4gIHZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4uL3V0aWwvZGVmYXVsdHMuanMnKVxuICB2YXIgdWlkID0gcmVxdWlyZSgnLi4vdXRpbC91bmlxdWVfaWQuanMnKVxuICB2YXIgZG9tID0gcmVxdWlyZSgnLi4vdXRpbC9kb20uanMnKVxuICB2YXIgaW50ZXJzZWN0ID0gcmVxdWlyZSgnLi9pbnRlcnNlY3QuanMnKVxuICB2YXIgZmxvb3IgPSBNYXRoLmZsb29yXG4gIHZhciBjZWlsID0gTWF0aC5jZWlsXG4gIHZhciBtaW4gPSBNYXRoLm1pblxuICB2YXIgbWF4ID0gTWF0aC5tYXhcblxuICBmdW5jdGlvbiBmcm9tX2RlZnMoZGlhZ3JhbSwgY2xhc3NuYW1lKXtcbiAgICByZXR1cm4gZGlhZ3JhbS5zdmdlbC5wYXJlbnQoKS5zZWxlY3QoJ2RlZnMgLicgKyBjbGFzc25hbWUpXG4gIH1cblxuICBmdW5jdGlvbiB0b19kZWZzKGRpYWdyYW0sIHN2Zyl7XG4gICAgdmFyIHAgPSBkaWFncmFtLnN2Z2VsLnBhcmVudCgpXG4gICAgaWYgKCB0eXBlb2Ygc3ZnID09ICdzdHJpbmcnICkge1xuICAgICAgdmFyIGVsID0gU25hcC5wYXJzZShzdmcpLnNlbGVjdCgnKicpXG4gICAgfSBlbHNlIGlmICggQXJyYXkuaXNBcnJheShzdmcpICkge1xuICAgICAgdmFyIGVsID0gcC5lbC5hcHBseShwLmVsLCBzdmcpXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICggZGlhZ3JhbS5jb25maWcuZGVidWcgKSBjb25zb2xlLmVycm9yKCd1bnJlY29nbml6YWJsZSBzdmcgdmFyaWFibGUgdHlwZScpXG4gICAgfVxuICAgIHJldHVybiBwLnNlbGVjdCgnZGVmcycpLmFwcGVuZChlbClcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYXcoZGlhZ3JhbSwgZWwpe1xuICAgIHZhciBuZXdfZWwgPSBmcm9tX2RlZnMoZGlhZ3JhbSwgZWwuY2xhc3NuYW1lKS5jbG9uZSgpXG4gICAgdmFyIG5vZGUgPSBoZ2x1ZShuZXdfZWwubm9kZSwgZWwuY29udGVudClcbiAgICBkaWFncmFtLnN2Z2VsLmFwcGVuZChuZXdfZWwpXG4gICAgcmV0dXJuIG5ld19lbFxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X2xpbmVfYXR0cnMoaXRlbSwgbGluZV9oZWlnaHQsIHgpe1xuICAgIGl0ZW0uZy5zZWxlY3RBbGwoJ3RzcGFuJykuZm9yRWFjaChmdW5jdGlvbih0c3BhbiwgaWR4KXtcbiAgICAgIHRzcGFuLmF0dHIoeyBkeTogaWR4ID8gbGluZV9oZWlnaHQgOiAwICwgeDogeCB9KVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBwb3NfY2FsYyh4LHcseSxoKXtcbiAgICByZXR1cm4gW3ggKyB3IC8gMiwgeSArIGggLyAyXVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3RleHR3aWR0aChub2RlKXtcbiAgICByZXR1cm4gbm9kZS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKVxuICB9XG5cbiAgZnVuY3Rpb24gaW52aXpfYmJveChkaWFncmFtLCBlbCl7XG4gICAgdmFyIGNsb25lID0gZWwuY2xvbmUoKS5hdHRyKClcbiAgICBkaWFncmFtLnN2Z2VsLmFwcGVuZChjbG9uZSlcbiAgICB2YXIgYmJveCA9IGNsb25lLmdldEJCb3goKVxuICAgIGNsb25lLnJlbW92ZSgpXG4gICAgcmV0dXJuIGJib3hcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvaW50X3RvX3N0cmluZyhwKXsgcmV0dXJuIHAueCArICcsJyArIHAueSB9XG5cbiAgZnVuY3Rpb24gaG9yaXpvbnRhbChsaW5lKXtcbiAgICByZXR1cm4gbGluZS5nZXRBdHRyaWJ1dGUoJ3gxJykgPT0gbGluZS5nZXRBdHRyaWJ1dGUoJ3gyJylcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5X2RpbWVuc2lvbnMoZGlhZ3JhbSl7XG4gICAgLy8gYXBwbHkgaGVpZ2h0IC8gd2lkdGggb24gbm9kZXNcbiAgICB2YXIgYmJveF9jYWNoZSA9IHt9XG4gICAgZGlhZ3JhbS5ncmFwaC5lYWNoTm9kZShmdW5jdGlvbihpZCwgbm9kZSl7XG4gICAgICB2YXIgY2xhc3NuYW1lID0gbm9kZS5jbGFzc25hbWVcbiAgICAgIHZhciBiYm94ID0gYmJveF9jYWNoZVtjbGFzc25hbWVdIHx8IChiYm94X2NhY2hlW2NsYXNzbmFtZV0gPSBpbnZpel9iYm94KGRpYWdyYW0sIGZyb21fZGVmcyhkaWFncmFtLCBjbGFzc25hbWUpKSlcbiAgICAgIG5vZGUuYXR0cignd2lkdGgnLCBiYm94LndpZHRoKVxuICAgICAgbm9kZS5hdHRyKCdoZWlnaHQnLCBiYm94LmhlaWdodClcbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gZGlzcGxheV9ub2RlcyhsYXlvdXQsIGRpYWdyYW0pe1xuICAgIC8vIGRpc3BsYXkgbm9kZXNcbiAgICBsYXlvdXQuZWFjaE5vZGUoZnVuY3Rpb24oaWQsIHZhbHVlcyl7XG4gICAgICB2YXIgbm9kZSA9IGRpYWdyYW0uZ3JhcGgubm9kZShpZClcbiAgICAgIG5vZGUuYXR0cigneCcsIHZhbHVlcy54KVxuICAgICAgbm9kZS5hdHRyKCd5JywgdmFsdWVzLnkpXG4gICAgICB2YXIgeCA9IHZhbHVlcy54IC0gdmFsdWVzLndpZHRoIC8gMlxuICAgICAgdmFyIHkgPSB2YWx1ZXMueSAtIHZhbHVlcy5oZWlnaHQgLyAyXG4gICAgICBub2RlLmFkZF9hdHRyKCc6Zmlyc3QnLCAndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgeCArICcsJyArIHkgKyAnKScpXG4gICAgICBub2RlLnRyYW5zZm9ybSh2YWx1ZXMpXG4gICAgICBkcmF3KGRpYWdyYW0sIG5vZGUpXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGluaXRfbGF5b3V0KGRpYWdyYW0pe1xuICAgIGFwcGx5X2RpbWVuc2lvbnMoZGlhZ3JhbSlcbiAgICByZXR1cm4gZGlhZ3JhbS5ydW4oZGlhZ3JhbS5ncmFwaClcbiAgfVxuXG5cbiAgZnVuY3Rpb24gZHJhd19zZWdtZW50KGRpYWdyYW0sIHRyYW5zZm9ybSwgdGFyZ2V0LCBzZWdtZW50KXtcbiAgICB2YXIgdHJhbnNmX29iaiA9IE9iamVjdC5jcmVhdGUodHJhbnNmb3JtKVxuICAgIHRyYW5zZl9vYmouY29udGVudCA9IHt9XG4gICAgdHJhbnNmX29iai5jb250ZW50W3RhcmdldF0gPSBzZWdtZW50XG4gICAgZHJhdyhkaWFncmFtLCB0cmFuc2Zfb2JqKVxuICAgIHJldHVybiBzZWdtZW50XG4gIH1cblxuICBmdW5jdGlvbiBkcmF3X3NlZ21lbnRzKGRpYWdyYW0sIHRyYW5zZm9ybSwgdGFyZ2V0LCBlZGdlcyl7XG4gICAgdmFyIHRyYW5zZl9vYmogPSBPYmplY3QuY3JlYXRlKHRyYW5zZm9ybSlcbiAgICB0cmFuc2Zfb2JqLmNvbnRlbnQgPSB7fVxuICAgIHRyYW5zZl9vYmouY29udGVudFt0YXJnZXRdID0gZWRnZXMubWFwKGZ1bmN0aW9uKHMpeyByZXR1cm4geyc6Zmlyc3QnOiBzfX0pXG4gICAgZHJhdyhkaWFncmFtLCB0cmFuc2Zfb2JqKVxuICAgIHJldHVybiBlZGdlc1xuICB9XG5cbiAgdmFyIGdldF9qdW5jdGlvbl9ub2RlID0gcGx1Y2soJ25vZGUnKVxuICB2YXIgZ2V0X2p1bmN0aW9uX2N1dCA9IHBsdWNrKCdjdXQnKVxuXG4gIGZ1bmN0aW9uIGRpc3BsYXkoZGlhZ3JhbSl7XG5cbiAgICB2YXIgdHJhbnNmb3JtX29iamVjdCA9IHsgY2xhc3NuYW1lOiBkaWFncmFtLmNvbmZpZy5lZGdlQ2xhc3MgfVxuXG4gICAgLy8gcmVtb3ZlIGFsbCBzdmcgbm9kZXNcbiAgICAvLyBUT0RPOiBhdCBzb21lIHBvaW50IHRoaXMgY291bGQgYmUgb3B0aW1hbGl6ZWQgc28gd2UgcmV1c2UgdGhlIG5vZGVzIHdoaWNoIGRvIG5vdCBjaGFuZ2VcbiAgICBkaWFncmFtLnN2Z2VsLmNsZWFyKClcblxuXG4gICAgdmFyIGxheW91dCA9IGluaXRfbGF5b3V0KGRpYWdyYW0pXG5cbiAgICBkaXNwbGF5X25vZGVzKGxheW91dCwgZGlhZ3JhbSlcblxuICAgIHZhciBvdXRncmFwaCA9IGxheW91dC5ncmFwaCgpXG4gICAgdmFyIHJhbmtEaXIgPSBvdXRncmFwaC5yYW5rRGlyXG4gICAgdmFyIHZlcnRpY2FsID0gcmFua0RpciA9PSAnVEInIHx8IHJhbmtEaXIgPT0gJ0JUJ1xuXG4gICAgLy8gY2FsY3VsYXRlIGVkZ2VzIGxheW91dFxuICAgIHZhciBlZGdlcyA9IHJlcXVpcmUoJy4vZWRnZXMuanMnKShkaWFncmFtLCBsYXlvdXQpXG5cbiAgICBkcmF3X3NlZ21lbnRzKGRpYWdyYW0sIHRyYW5zZm9ybV9vYmplY3QsICcuRWRnZScsIGVkZ2VzKVxuXG4gICAgdmFyIGludGVyc2VjdGlvbl9zaXplID0gaW52aXpfYmJveChkaWFncmFtLCBmcm9tX2RlZnMoZGlhZ3JhbSwgZGlhZ3JhbS5jb25maWcuaW50ZXJzZWN0aW9uQ2xhc3MpKVxuICAgIHZhciBpbnRlcnNlY3Rpb25fbWlkZGxlID0gW2ludGVyc2VjdGlvbl9zaXplLndpZHRoIC8gMiwgaW50ZXJzZWN0aW9uX3NpemUuaGVpZ2h0IC8gMl1cbiAgICBlZGdlcy5mb3JFYWNoKGZ1bmN0aW9uKHNlZzEsIGlkMSl7XG4gICAgICBlZGdlcy5mb3JFYWNoKGZ1bmN0aW9uKHNlZzIsIGlkMil7XG4gICAgICAgIGlmICggaWQyID4gaWQxICYmIHNlZzEueDEgIT0gc2VnMi54MSAmJiAgc2VnMS54MiAhPSBzZWcyLngyXG4gICAgICAgICAgICAgICAgICAgICAgICYmIHNlZzEueTEgIT0gc2VnMi55MSAmJiAgc2VnMS55MiAhPSBzZWcyLnkyXG4gICAgICAgICAgICAgICAgICAgICAgICYmIHNlZzEueDEgIT0gc2VnMi54MiAmJiAgc2VnMS55MSAhPSBzZWcyLnkyXG4gICAgICAgICAgICAgICAgICAgICAgICYmIHNlZzEueDEgIT0gc2VnMi55MSAmJiAgc2VnMS54MiAhPSBzZWcyLnkyXG4gICAgICAgICAgICAgICAgICAgICAgICYmIHNlZzEueDEgIT0gc2VnMi55MiAmJiAgc2VnMS54MiAhPSBzZWcyLnkxXG4gICAgICAgICAgICkge1xuICAgICAgICAgIHZhciBpc2N0ID0gaW50ZXJzZWN0KHNlZzEsIHNlZzIpXG4gICAgICAgICAgaWYgKCBpc2N0WzBdID09IDggKSB7IC8vIGludGVyc2VjdGluZ1xuICAgICAgICAgICAgdmFyIHNlZzFub2RlID0gZG9tLiRpZChzZWcxLmlkKVxuICAgICAgICAgICAgdmFyIHNlZzJub2RlID0gZG9tLiRpZChzZWcyLmlkKVxuICAgICAgICAgICAgdmFyIHRvcG5vZGUgPSBzZWcxbm9kZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbihzZWcybm9kZSkgJiA0ID8gc2VnMW5vZGUgOiBzZWcybm9kZVxuICAgICAgICAgICAgdmFyIGludGVyc2VjdF9ub2RlID0gZHJhdyhkaWFncmFtLCB7IGNsYXNzbmFtZTogZGlhZ3JhbS5jb25maWcuaW50ZXJzZWN0aW9uQ2xhc3MgLCBjb250ZW50OiB7fSB9KVxuICAgICAgICAgICAgaWYgKCBob3Jpem9udGFsKHRvcG5vZGUpICkge1xuICAgICAgICAgICAgICBpbnRlcnNlY3Rfbm9kZS50cmFuc2Zvcm0oKG5ldyBTbmFwLk1hdHJpeCgxLCAwLCAwLCAxLCAwICwgMCkpLnJvdGF0ZSg5MCwgaXNjdFsxXVswXSAsIGlzY3RbMV1bMV0gKS50b1RyYW5zZm9ybVN0cmluZygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2Zvcm0oaW50ZXJzZWN0X25vZGUubWF0cml4LnRyYW5zbGF0ZShpc2N0WzFdWzBdIC0gaW50ZXJzZWN0aW9uX21pZGRsZVswXSwgaXNjdFsxXVsxXSAtIGludGVyc2VjdGlvbl9taWRkbGVbMV0pKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaW50ZXJzZWN0X25vZGUudHJhbnNmb3JtKG5ldyBTbmFwLk1hdHJpeCgxLCAwLCAwLCAxLCBpc2N0WzFdWzBdIC0gaW50ZXJzZWN0aW9uX21pZGRsZVswXSwgaXNjdFsxXVsxXSAtIGludGVyc2VjdGlvbl9taWRkbGVbMV0pKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkb20uaW5zZXJ0QWZ0ZXIodG9wbm9kZS5wYXJlbnROb2RlLCBpbnRlcnNlY3Rfbm9kZS5ub2RlLCB0b3Bub2RlLm5leHRTaWJsaW5nKVxuXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pXG5cbiAgICB2YXIgbW92ZSA9IG5ldyBTbmFwLk1hdHJpeCgxLCAwLCAwLCAxLCAwLCAwKVxuICAgIGlmICggcmFua0RpciA9PSBcIkxSXCIgfHwgcmFua0RpciA9PSBcIlJMXCIgKSB7XG4gICAgICBvdXRncmFwaC5oZWlnaHQgPSBvdXRncmFwaC5oZWlnaHQgKyBlZGdlcy5ncm93dGggKiAyXG4gICAgICB2YXIgbW92ZSA9IG1vdmUudHJhbnNsYXRlKDAsIGVkZ2VzLmdyb3d0aClcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0Z3JhcGgud2lkdGggPSBvdXRncmFwaC53aWR0aCArIGVkZ2VzLmdyb3d0aCAqIDJcbiAgICAgIHZhciBtb3ZlID0gbW92ZS50cmFuc2xhdGUoZWRnZXMuZ3Jvd3RoLCAwKVxuICAgIH1cblxuICAgIGRpYWdyYW0uc3ZnZWwuYXR0cih7IHdpZHRoOiBvdXRncmFwaC53aWR0aCwgaGVpZ2h0OiBvdXRncmFwaC5oZWlnaHQgfSkudHJhbnNmb3JtKG1vdmUudG9UcmFuc2Zvcm1TdHJpbmcoKSlcblxuICAgIGlmICggdmVydGljYWwgKSB7XG4gICAgICBkaWFncmFtLmNvbmZpZy5oZWlnaHQgPSBkaWFncmFtLmNvbmZpZy5oZWlnaHQgKyBlZGdlcy5ncm93dGhcbiAgICB9IGVsc2Uge1xuICAgICAgZGlhZ3JhbS5jb25maWcud2lkdGggPSBkaWFncmFtLmNvbmZpZy53aWR0aCArIGVkZ2VzLmdyb3d0aFxuICAgIH1cblxuICAgIGRpYWdyYW0uc3ZnZWwucGFyZW50KCkuYXR0cih7XG4gICAgICB3aWR0aDogb3V0Z3JhcGgud2lkdGggKyBkaWFncmFtLmNvbmZpZy5wYWRkaW5nICogMlxuICAgICwgaGVpZ2h0OiBvdXRncmFwaC5oZWlnaHQgKyBkaWFncmFtLmNvbmZpZy5wYWRkaW5nICogMlxuICAgIH0pXG5cbiAgICByZXR1cm4gZGlhZ3JhbVxuICB9XG5cbiAgdmFyIGVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL2VtaXR0ZXIuanMnKVxuICB2YXIgbGF5b3V0ID0gZW1pdHRlci5leHRlbmQoZGFncmUubGF5b3V0KCkpXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBsYXlvdXQuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihjb25maWcsIGdyYXBoKXtcbiAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICBPYmplY3Qua2V5cyhjb25maWcubGF5b3V0X2NvbmZpZykuZm9yRWFjaChmdW5jdGlvbihtZXRob2Qpe1xuICAgICAgICB0aGlzW21ldGhvZF0oY29uZmlnLmxheW91dF9jb25maWdbbWV0aG9kXSlcbiAgICAgIH0sIHRoaXMpXG4gICAgICB0aGlzLnJhbmtTaW1wbGV4ID0gdHJ1ZVxuICAgICAgdGhpcy5ncmFwaCA9IGdyYXBoXG4gICAgICB0aGlzLmlkID0gdWlkKClcbiAgICAgIHRoaXMuc3ZnZWwgPSBTbmFwLmFwcGx5KFNuYXAsIGNvbmZpZy5zbmFwX2FyZ3MpLmcoKS5hdHRyKHsgdHJhbnNmb3JtOiBcInRyYW5zbGF0ZSgyMCwyMClcIiwgaWQ6dGhpcy5pZH0pXG4gICAgICB0aGlzLm5vZGUgPSB0aGlzLnN2Z2VsLnBhcmVudCgpLm5vZGVcbiAgICB9XG4gICwgZGlzcGxheTogZW5zbGF2ZShkaXNwbGF5KVxuICAsIGRyYXc6IGVuc2xhdmUoZHJhdylcbiAgLCB0b19kZWZzOiBlbnNsYXZlKHRvX2RlZnMpXG5cbiAgfSlcbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuXG4gIHZhciB6aXBweSA9IHJlcXVpcmUoJ3ppcHB5JylcbiAgdmFyIHppcCA9IHppcHB5LnppcFxuICB2YXIgemlwV2l0aCA9IHppcHB5LnppcFdpdGhcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIHRyYW5zbGF0ZSA9IHJlcXVpcmUoJy4uL3V0aWwvdHJhbnNsYXRlLmpzJylcblxuICBmdW5jdGlvbiBub2RlX2Zyb21faWQoZ3JhcGgsIGlkKXtcbiAgICB2YXIgbiA9IGdyYXBoLm5vZGUoaWQpXG4gICAgbi5pZCA9IGlkXG4gICAgcmV0dXJuIG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHBvaW50KHgsIHkpeyByZXR1cm4geyB4OiB4IHx8IDAsIHk6IHkgfHwgMCB9IH1cblxuICBmdW5jdGlvbiBzaWRlX2Zyb21fZGlyZWN0aW9uKG5vZGUsIGQpe1xuICAgIHZhciBjID0gcG9pbnQobm9kZS54LCBub2RlLnkpXG4gICAgdmFyIHcgPSBub2RlLndpZHRoIC8gMlxuICAgIHZhciBoID0gbm9kZS5oZWlnaHQgLyAyXG4gICAgdmFyIHRsID0gdHJhbnNsYXRlKFstdywgLWhdLCBjKVxuICAgIHZhciB0ciA9IHRyYW5zbGF0ZShbdywgLWhdLCBjKVxuICAgIHZhciBibCA9IHRyYW5zbGF0ZShbLXcsIGhdLCBjKVxuICAgIHZhciBiciA9IHRyYW5zbGF0ZShbdywgaF0sIGMpXG4gICAgc3dpdGNoICggZCApIHtcbiAgICAgIGNhc2UgJ0wnIDpcbiAgICAgICAgcmV0dXJuIFt0bCwgYmxdXG4gICAgICBjYXNlICdSJyA6XG4gICAgICAgIHJldHVybiBbdHIsIGJyXVxuICAgICAgY2FzZSAnQicgOlxuICAgICAgICByZXR1cm4gW2JsLCBicl1cbiAgICAgIGNhc2UgJ1QnIDpcbiAgICAgICAgcmV0dXJuIFt0bCwgdHJdXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGl2aWRlX3NpZGUoc2lkZSwgbil7XG4gICAgdmFyIFgxID0gc2lkZVswXS54XG4gICAgdmFyIFkxID0gc2lkZVswXS55XG4gICAgdmFyIFgyID0gc2lkZVsxXS54XG4gICAgdmFyIFkyID0gc2lkZVsxXS55XG5cbiAgICB2YXIgVyA9IFgyIC0gWDFcbiAgICB2YXIgSCA9IFkyIC0gWTFcbiAgICB2YXIgcG9pbnRzID0gW11cbiAgICB2YXIgcncgPSBXIC8gKG4gKyAxKVxuICAgIHZhciByaCA9IEggLyAobiArIDEpXG4gICAgdmFyIGkgPSAwXG4gICAgd2hpbGUgKCBpKysgPCBuICkge1xuICAgICAgcG9pbnRzLnB1c2godHJhbnNsYXRlKFsgaSAqIHJ3LCBpICogcmggXSwgc2lkZVswXSkpXG4gICAgfVxuICAgIHJldHVybiBwb2ludHNcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9ub2RlcyhkaWFncmFtLCBsYXlvdXQpe1xuICAgIHZhciBub2RlcyA9IFtdXG4gICAgdmFyIGcgPSBsYXlvdXQuZ3JhcGgoKVxuICAgIHZhciByYW5rRGlyID0gZy5yYW5rRGlyXG4gICAgdmFyIHZlcnRpY2FsID0gcmFua0RpciA9PSAnVEInIHx8IHJhbmtEaXIgPT0gJ0JUJ1xuICAgIHZhciByYW5rX2F0dHIgPSB2ZXJ0aWNhbCA/ICd5JyA6ICd4J1xuICAgIHZhciBub2RlX3JhbmtfZGltZW5zaW9uID0gZ2V0X3JhbmtfZGltZW5zaW9uLmJpbmQobnVsbCwgZGlhZ3JhbS5jb25maWcucmFua19kZXRlY3Rpb25fZXJyb3JfbWFyZ2luLCByYW5rX2F0dHIpXG4gICAgdmFyIG5vZGVfZnJvbV9sYXlvdXQgPSBub2RlX2Zyb21faWQuYmluZChudWxsLCBsYXlvdXQpXG4gICAgdmFyIGVkZ2VfZnJvbV9sYXlvdXQgPSBub2RlX2Zyb21faWQuYmluZChudWxsLCBsYXlvdXQpXG4gICAgbGF5b3V0LmVhY2hOb2RlKGZ1bmN0aW9uKGlkLCBub2RlKXtcbiAgICAgIG5vZGUucmRpbSA9IE51bWJlcihub2RlX3JhbmtfZGltZW5zaW9uKG5vZGUpKVxuICAgICAgbm9kZS50YXJnZXRzID0gbGF5b3V0Lm91dEVkZ2VzKGlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChsYXlvdXQudGFyZ2V0LmJpbmQobGF5b3V0KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAobm9kZV9mcm9tX2xheW91dClcbiAgICAgIG5vZGUuc291cmNlcyA9IGxheW91dC5pbkVkZ2VzKGlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChsYXlvdXQuc291cmNlLmJpbmQobGF5b3V0KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAobm9kZV9mcm9tX2xheW91dClcbiAgICAgIG5vZGVzLnB1c2gobm9kZSlcbiAgICB9KVxuICAgIHJldHVybiBub2Rlc1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3JhbmtfZGltZW5zaW9uKG1hcmdpbiwga2V5LCBub2RlKXtcbiAgICByZXR1cm4gTWF0aC5jZWlsKG5vZGVba2V5XSAvIG1hcmdpbikgKiBtYXJnaW5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZV9zZWdtZW50KHN0YXJ0LCBlbmQpe1xuICAgIHJldHVybiB7IGlkOiB1aWQoKSwgeDE6IHN0YXJ0LngsIHkxOnN0YXJ0LnksIHgyOiBlbmQueCwgeTI6IGVuZC55fVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2p1bmN0aW9uKHZlcnRpY2FsLCBwYXRoLCBsZXZlbCl7XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHZlcnRpY2FsID8gbGV2ZWwgOiBwYXRoXG4gICAgLCB5OiB2ZXJ0aWNhbCA/IHBhdGggOiBsZXZlbFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGlkeF90b19pZChzLCB0LCBpKXtcbiAgICBzW3QuaWRdID0gaVxuICAgIHJldHVybiBzXG4gIH1cblxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY2FsY3VsYXRlX2VkZ2VzKGRpYWdyYW0sIGxheW91dCl7XG4gICAgdmFyIHJhbmtTZXAgPSBkaWFncmFtLmNvbmZpZy5sYXlvdXRfY29uZmlnLnJhbmtTZXBcbiAgICB2YXIgZyA9IGxheW91dC5ncmFwaCgpXG4gICAgdmFyIHJhbmtEaXIgPSBnLnJhbmtEaXJcbiAgICB2YXIgcmV2ZXJzZWQgPSByYW5rRGlyID09ICdCVCcgfHwgcmFua0RpciA9PSAnUkwnXG4gICAgdmFyIHZlcnRpY2FsID0gcmFua0RpciA9PSAnVEInIHx8IHJhbmtEaXIgPT0gJ0JUJ1xuICAgIHZhciBsZXZlbF9kaXIgPSB2ZXJ0aWNhbCA/ICd3aWR0aCcgOiAnaGVpZ2h0J1xuICAgIHZhciByYW5rX2F0dHIgPSB2ZXJ0aWNhbCA/ICd5JyA6ICd4J1xuICAgIHZhciBub2RlcyA9IGdldF9ub2RlcyhkaWFncmFtLCBsYXlvdXQpXG4gICAgdmFyIHNraXBzZXAgPSBkaWFncmFtLmNvbmZpZy5za2lwU2VwXG4gICAgdmFyIGkgPSBub2Rlcy5yZWR1Y2UoZnVuY3Rpb24obywgbm9kZSl7XG4gICAgICB2YXIgdiA9IG5vZGUucmRpbVxuICAgICAgOyhvW3ZdIHx8IChvW3ZdID0gW10pKS5wdXNoKG5vZGUpXG4gICAgICByZXR1cm4gb1xuICAgIH0sIHt9KVxuICAgIHZhciByYW5rcyA9IE9iamVjdC5rZXlzKGkpLnNvcnQoZnVuY3Rpb24oYSwgYil7IHJldHVybiArYSAtICtiIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGspeyByZXR1cm4gdGhpc1trXSB9LCBpKVxuXG4gICAgbm9kZXMgPSBub2Rlcy5tYXAoZnVuY3Rpb24obil7XG4gICAgICB2YXIgZXhpdF9wb2ludHMgPSBkaXZpZGVfc2lkZShzaWRlX2Zyb21fZGlyZWN0aW9uKG4sIHJhbmtEaXJbMV0pLCBuLnRhcmdldHMubGVuZ3RoKVxuICAgICAgbi5leGl0X3BvaW50cyA9IGV4aXRfcG9pbnRzLm1hcChmdW5jdGlvbihwLCBpKXtcbiAgICAgICAgcC50aWQgPSBuLnRhcmdldHNbaV0uaWRcbiAgICAgICAgcC5ub2RlID0gblxuICAgICAgICByZXR1cm4gcFxuICAgICAgfSlcbiAgICAgIG4uZXhpdHMgPSBuLnRhcmdldHMucmVkdWNlKGlkeF90b19pZCwge30pXG5cbiAgICAgIHZhciBlbnRyeV9wb2ludHMgPSBkaXZpZGVfc2lkZShzaWRlX2Zyb21fZGlyZWN0aW9uKG4sIHJhbmtEaXJbMF0pLCBuLnNvdXJjZXMubGVuZ3RoKVxuICAgICAgbi5lbnRyeV9wb2ludHMgPSBlbnRyeV9wb2ludHMubWFwKGZ1bmN0aW9uKHAsIGkpe1xuICAgICAgICBwLnNpZCA9IG4uc291cmNlc1tpXS5pZFxuICAgICAgICBwLm5vZGUgPSBuXG4gICAgICAgIHJldHVybiBwXG4gICAgICB9KVxuICAgICAgbi5lbnRyaWVzID0gbi5zb3VyY2VzLnJlZHVjZShpZHhfdG9faWQsIHt9KVxuICAgICAgcmV0dXJuIG5cbiAgICB9KVxuXG4gICAgdmFyIG5vZGVzX2J5X2lkID0gbm9kZXMucmVkdWNlKGZ1bmN0aW9uKG5pZHMsIG4pe1xuICAgICAgbmlkc1tuLmlkXSA9IG5cbiAgICAgIHJldHVybiBuaWRzXG4gICAgfSwge30pXG5cbiAgICByYW5rcy5wdXNoKFtdKVxuXG4gICAgcmFua3MgPSByYW5rcy5tYXAoZnVuY3Rpb24ocmFuaywgcm4pe1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbm9kZXM6IHJhbmsubWFwKGZ1bmN0aW9uKG4pe1xuICAgICAgICAgIG4udHJ1ZV9yYW5rID0gcm5cbiAgICAgICAgICByZXR1cm4gblxuICAgICAgICB9KVxuICAgICAgLCBleGl0czogKHJuICE9IDAgPyByYW5rc1tybiAtIDFdIDogW10pLnJlZHVjZShmdW5jdGlvbihzLCBuKXtcbiAgICAgICAgICBzID0gcy5jb25jYXQobi5leGl0X3BvaW50cylcbiAgICAgICAgICByZXR1cm4gc1xuICAgICAgICB9LCBbXSlcbiAgICAgICwgZW50cmllczogcmFuay5yZWR1Y2UoZnVuY3Rpb24ocywgbil7XG4gICAgICAgICAgcyA9IHMuY29uY2F0KG4uZW50cnlfcG9pbnRzKVxuICAgICAgICAgIHJldHVybiBzXG4gICAgICAgIH0sIFtdKVxuICAgICAgLCBub2RlX2lkczogcmFuay5tYXAoZnVuY3Rpb24obil7IHJldHVybiBuLmlkIH0pXG4gICAgICB9XG4gICAgfSkubWFwKGZ1bmN0aW9uKHJhbmssIHJuKXtcblxuICAgICAgcmFuay5zdGVwcyA9IHJhbmsuZXhpdHMuZmlsdGVyKGZ1bmN0aW9uKGV4aXQsIGkpe1xuICAgICAgICByZXR1cm4gKHJhbmsubm9kZV9pZHMpLmluZGV4T2YoZXhpdC50aWQpID4gLTFcbiAgICAgIH0pLm1hcChmdW5jdGlvbihleGl0KXtcbiAgICAgICAgdmFyIGVudHJ5ID0gbm9kZXNfYnlfaWRbZXhpdC50aWRdXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZXhpdDogZXhpdFxuICAgICAgICAsIGVudHJ5OiBlbnRyeS5lbnRyeV9wb2ludHNbZW50cnkuZW50cmllc1tleGl0Lm5vZGUuaWRdXVxuICAgICAgICB9XG4gICAgICB9KS5yZWR1Y2UoZnVuY3Rpb24oc3RlcHMsIHN0ZXApe1xuICAgICAgICBpZiAoIHN0ZXBzLnNvbWUoZnVuY3Rpb24ocyl7IHJldHVybiBzLmV4aXQubm9kZSA9PSBzdGVwLm5vZGUgfSkgKSB7XG5cbiAgICAgICAgfVxuICAgICAgICBzdGVwcy5wdXNoKHN0ZXApXG4gICAgICAgIHJldHVybiBzdGVwc1xuICAgICAgfSwgW10pXG5cbiAgICAgIHJhbmsuZm9yd2FyZF9za2lwcyA9IHJhbmsuZXhpdHMuZmlsdGVyKGZ1bmN0aW9uKGV4aXQsIGkpe1xuICAgICAgICByZXR1cm4gbm9kZXNfYnlfaWRbZXhpdC50aWRdLnRydWVfcmFuayAtIHJuID4gMFxuICAgICAgfSkubWFwKGZ1bmN0aW9uKGV4aXQpe1xuICAgICAgICB2YXIgZW50cnkgPSBub2Rlc19ieV9pZFtleGl0LnRpZF1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBleGl0OiBleGl0XG4gICAgICAgICwgZW50cnk6IGVudHJ5LmVudHJ5X3BvaW50c1tlbnRyeS5lbnRyaWVzW2V4aXQubm9kZS5pZF1dXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIHJhbmsuYmFja3dhcmRfc2tpcHMgPSByYW5rLmVudHJpZXMuZmlsdGVyKGZ1bmN0aW9uKGVudHJ5LCBpKXtcbiAgICAgICAgcmV0dXJuIG5vZGVzX2J5X2lkW2VudHJ5LnNpZF0udHJ1ZV9yYW5rIC0gcm4gPj0gMFxuICAgICAgfSkubWFwKGZ1bmN0aW9uKGVudHJ5KXtcbiAgICAgICAgdmFyIGV4aXQgPSBub2Rlc19ieV9pZFtlbnRyeS5zaWRdXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZXhpdDogZXhpdC5leGl0X3BvaW50c1tleGl0LmV4aXRzW2VudHJ5Lm5vZGUuaWRdXVxuICAgICAgICAsIGVudHJ5OiBlbnRyeVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBmdW5jdGlvbiBub3RfaW5fc3RlcHMocCl7XG4gICAgICAgIHJldHVybiByYW5rLnN0ZXBzLmV2ZXJ5KGZ1bmN0aW9uKHMpeyByZXR1cm4gcy5leGl0ICE9IHAgJiYgcy5lbnRyeSAhPSBwfSlcbiAgICAgIH1cblxuICAgICAgcmFuay5za2lwcG9pbnRzID0ge1xuICAgICAgICBleGl0czogcmFuay5leGl0cy5maWx0ZXIobm90X2luX3N0ZXBzKVxuICAgICAgLCBlbnRyaWVzOiByYW5rLmVudHJpZXMuZmlsdGVyKG5vdF9pbl9zdGVwcylcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJhbmtcbiAgICB9KS5tYXAoZnVuY3Rpb24ocmFuayl7XG4gICAgICByYW5rLnBzZXAgPSByYW5rU2VwIC8gKHJhbmsuZW50cmllcy5sZW5ndGggKyByYW5rLmV4aXRzLmxlbmd0aCAtIHJhbmsuc3RlcHMubGVuZ3RoICsgMSlcbiAgICAgIHJhbmsuc3RlcHMgPSByYW5rLnN0ZXBzLm1hcChmdW5jdGlvbihzLCBzaSl7XG4gICAgICAgIHZhciB0ciA9IHJhbmsucHNlcCAqIChzaSArIDEpXG4gICAgICAgIGlmICggcmV2ZXJzZWQgKSB0ciAgPSB0ciAqIC0xXG4gICAgICAgIHMuZXhpdF9qdW5jdGlvbiAgPSB0cmFuc2xhdGUodmVydGljYWwgPyBbMCwgdHJdIDogW3RyLCAwXSwgcy5leGl0KVxuICAgICAgICBzLmVudHJ5X2p1bmN0aW9uID0gdHJhbnNsYXRlKHZlcnRpY2FsID8gWzAsIHRyIC0gKHJldmVyc2VkID8gLTEgKiByYW5rU2VwIDogcmFua1NlcCldXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBbdHIgLSAocmV2ZXJzZWQgPyAtMSAqIHJhbmtTZXAgOiByYW5rU2VwKSwgMF0sIHMuZW50cnkpXG4gICAgICAgIHJldHVybiBzXG4gICAgICB9KVxuXG4gICAgICByYW5rLnNraXBwb2ludHMuZXhpdHMgPSByYW5rLnNraXBwb2ludHMuZXhpdHMubWFwKGZ1bmN0aW9uKHBvaW50LCBpKXtcbiAgICAgICAgdmFyIHRyID0gcmFuay5wc2VwICogKGkgKyByYW5rLnN0ZXBzLmxlbmd0aCArIDEpXG4gICAgICAgIGlmICggcmV2ZXJzZWQgKSB0ciAgPSB0ciAqIC0xXG4gICAgICAgIHBvaW50Lmp1bmN0aW9uID0gdHJhbnNsYXRlKHZlcnRpY2FsID8gWzAsIHRyXSA6IFt0ciwgMF0sIHBvaW50KVxuICAgICAgICByZXR1cm4gcG9pbnRcbiAgICAgIH0pXG5cbiAgICAgIHJhbmsuc2tpcHBvaW50cy5lbnRyaWVzID0gcmFuay5za2lwcG9pbnRzLmVudHJpZXMubWFwKGZ1bmN0aW9uKHBvaW50LCBpKXtcbiAgICAgICAgdmFyIHRyID0gcmFuay5wc2VwICogKGkgKyByYW5rLnN0ZXBzLmxlbmd0aCArIHJhbmsuc2tpcHBvaW50cy5leGl0cy5sZW5ndGggKyAxKVxuICAgICAgICBpZiAoIHJldmVyc2VkICkgdHIgID0gdHIgKiAtMVxuICAgICAgICBwb2ludC5qdW5jdGlvbiA9IHRyYW5zbGF0ZSh2ZXJ0aWNhbCA/IFswLCB0ciAtIChyZXZlcnNlZCA/IC0xICogcmFua1NlcCA6IHJhbmtTZXApXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFt0ciAtIChyZXZlcnNlZCA/IC0xICogcmFua1NlcCA6IHJhbmtTZXApLCAwXSwgcG9pbnQpXG4gICAgICAgIHJldHVybiBwb2ludFxuICAgICAgfSlcblxuICAgICAgcmV0dXJuIHJhbmtcbiAgICB9KVxuXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlX3NraXAoc2tpcHMsIGxldmVsLCBzKXtcbiAgICAgIHZhciBwMiA9IGdldF9qdW5jdGlvbih2ZXJ0aWNhbCwgcy5leGl0Lmp1bmN0aW9uW3JhbmtfYXR0cl0sIGxldmVsKVxuICAgICAgdmFyIHAzID0gZ2V0X2p1bmN0aW9uKHZlcnRpY2FsLCBzLmVudHJ5Lmp1bmN0aW9uW3JhbmtfYXR0cl0sIGxldmVsIClcbiAgICAgIHJldHVybiBza2lwcy5jb25jYXQoW1xuICAgICAgICAgICAgICAgY3JlYXRlX3NlZ21lbnQocy5leGl0LCBzLmV4aXQuanVuY3Rpb24pXG4gICAgICAgICAgICAgLCBjcmVhdGVfc2VnbWVudChzLmV4aXQuanVuY3Rpb24sIHAyKVxuICAgICAgICAgICAgICwgY3JlYXRlX3NlZ21lbnQocDIsIHAzKVxuICAgICAgICAgICAgICwgY3JlYXRlX3NlZ21lbnQocDMsIHMuZW50cnkuanVuY3Rpb24pXG4gICAgICAgICAgICAgLCBjcmVhdGVfc2VnbWVudChzLmVudHJ5Lmp1bmN0aW9uLCBzLmVudHJ5KVxuICAgICAgICAgICAgIF0pXG4gICAgfVxuXG4gICAgdmFyIGVkZ2VzID0gcmFua3MucmVkdWNlKGZ1bmN0aW9uKHB3LCByYW5rLCBybil7XG4gICAgICB2YXIgZnNfbGVuZ3RoID0gcmFua3Muc2xpY2UoMCwgcm4pLnJlZHVjZShmdW5jdGlvbih0c2MsIHIpeyByZXR1cm4gdHNjICsgci5mb3J3YXJkX3NraXBzLmxlbmd0aCB9LCAxKVxuICAgICAgdmFyIGJzX2xlbmd0aCA9IHJhbmtzLnNsaWNlKDAsIHJuKS5yZWR1Y2UoZnVuY3Rpb24odHNjLCByKXsgcmV0dXJuIHRzYyArIHIuYmFja3dhcmRfc2tpcHMubGVuZ3RoIH0sIDEpXG5cbiAgICAgIHJldHVybiBwdy5jb25jYXQocmFuay5zdGVwcy5yZWR1Y2UoZnVuY3Rpb24oc3RlcHMsIHMsIHNpKXtcblxuICAgICAgICByZXR1cm4gc3RlcHMuY29uY2F0KFsgY3JlYXRlX3NlZ21lbnQocy5leGl0LCBzLmV4aXRfanVuY3Rpb24pXG4gICAgICAgICAgICAgICAsIGNyZWF0ZV9zZWdtZW50KHMuZXhpdF9qdW5jdGlvbiwgcy5lbnRyeV9qdW5jdGlvbilcbiAgICAgICAgICAgICAgICwgY3JlYXRlX3NlZ21lbnQocy5lbnRyeV9qdW5jdGlvbiwgcy5lbnRyeSldKVxuXG4gICAgICAgIHJldHVybiBzdGVwcy5jb25jYXQoc3RlcHMuam9pbnRzLnJlZHVjZShmdW5jdGlvbihwLCBuKXtcbiAgICAgICAgICBjcmVhdGVfc2VnbWVudChwLCBuKVxuICAgICAgICAgIHJldHVybiBuXG4gICAgICAgIH0pKVxuXG4gICAgICB9LCBbXSkuY29uY2F0KHJhbmsuZm9yd2FyZF9za2lwcy5yZWR1Y2UoZnVuY3Rpb24oc2tpcHMsIHMsIHNpKXtcbiAgICAgICAgdmFyIGxldmVsX2Ftb3VudCA9IChmc19sZW5ndGggKyBzaSkgKiBza2lwc2VwXG4gICAgICAgIHZhciBsZXZlbCA9IHJldmVyc2VkID8gMCAtIGxldmVsX2Ftb3VudCA6IGdbbGV2ZWxfZGlyXSArIGxldmVsX2Ftb3VudFxuXG4gICAgICAgIHJldHVybiBjYWxjdWxhdGVfc2tpcChza2lwcywgbGV2ZWwsIHMpXG5cblxuICAgICAgfSwgW10pKS5jb25jYXQocmFuay5iYWNrd2FyZF9za2lwcy5yZWR1Y2UoZnVuY3Rpb24oc2tpcHMsIHMsIHNpKXtcbiAgICAgICAgdmFyIGxldmVsX2Ftb3VudCA9IChic19sZW5ndGggKyBzaSkgKiBza2lwc2VwXG4gICAgICAgIHZhciBsZXZlbCA9IHJldmVyc2VkID8gZ1tsZXZlbF9kaXJdICsgbGV2ZWxfYW1vdW50IDogMCAtIGxldmVsX2Ftb3VudFxuICAgICAgICByZXR1cm4gY2FsY3VsYXRlX3NraXAoc2tpcHMsIGxldmVsLCBzKVxuXG4gICAgICB9LCBbXSkpKVxuICAgIH0sIFtdKVxuXG4gICAgZWRnZXMuZ3Jvd3RoID0gcmFua3MucmVkdWNlKGZ1bmN0aW9uKHNzLCByKXsgcmV0dXJuIHNzICsgci5mb3J3YXJkX3NraXBzLmxlbmd0aCArIHIuYmFja3dhcmRfc2tpcHMubGVuZ3RofSwgMCkgKiBza2lwc2VwXG5cbiAgICByZXR1cm4gZWRnZXNcbiAgfVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICB2YXIgViA9IHJlcXVpcmUoJy4uL3V0aWwvdmVjdG9ycy5qcycpXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzZWcxLCBzZWcyKXtcbiAgICB2YXIgcCA9IFtzZWcxLngxLCBzZWcxLnkxXVxuICAgIHZhciByID0gVi5zdWJ0cmFjdChbc2VnMS54Miwgc2VnMS55Ml0sIHApXG4gICAgdmFyIHEgPSBbc2VnMi54MSwgc2VnMi55MV1cbiAgICB2YXIgcyA9IFYuc3VidHJhY3QoW3NlZzIueDIsIHNlZzIueTJdLCBxKVxuXG4gICAgLy8gY29sbGluZWFyIG92ZXJsYXBwaW5nICAgICAgICAgICAgMVxuICAgIC8vIGNvbGxpbmVhciBkaXNqb2ludCAgICAgICAgICAgICAgIDJcbiAgICAvLyBwYXJhbGxlbCAgICAgICAgICAgICAgICAgICAgICAgICA0XG4gICAgLy8gaW50ZXJzZWN0aW5nICAgICAgICAgICAgICAgICAgICAgOFxuICAgIC8vIG5vbi1wYXJhbGxlbCBub24taW50ZXJzZWN0aW5nICAgMTZcbiAgICB2YXIgcmVzcG9uc2UgPSAwXG5cblxuICAgIHZhciByeHMgPSBWLmNyb3NzKHIsIHMpXG4gICAgdmFyIHFfcCA9IFYuc3VidHJhY3QocSxwKVxuICAgIHZhciBxX3B4ciA9IFYuY3Jvc3MocV9wLCByKVxuICAgIGlmICggcnhzID09IDAgKSB7XG4gICAgICBpZiAoIHFfcHhyICE9IDAgKSB7XG4gICAgICAgIHJldHVybiBbNF1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByciA9IFYuZG90KHIsIHIpXG4gICAgICAgIHZhciBxX3BkciA9IFYuZG90KHFfcCwgcilcbiAgICAgICAgdmFyIHNzID0gVi5kb3QocywgcylcbiAgICAgICAgdmFyIHFfcGRzID0gVi5kb3QocV9wLCBzKVxuICAgICAgICBpZiAoICggMCA8PSBxX3BkciAmJiAgcV9wZHIgPD0gcnIgKSB8fCAoIDAgPD0gcV9wZHMgJiYgcV9wZHMgPD0gc3MgKSApIHtcbiAgICAgICAgICByZXR1cm4gWzFdXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFsyXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHQgPSBWLmNyb3NzKHFfcCwgcykgLyByeHNcbiAgICBpZiAoIHQgPCAwIHx8IHQgPiAxICkgcmV0dXJuIFsxNl1cbiAgICB2YXIgdSA9IFYuY3Jvc3MocV9wLCByKSAvIHJ4c1xuICAgIGlmICggdSA8IDAgfHwgdSA+IDEgKSByZXR1cm4gWzE2XVxuXG4gICAgLy8gdmFyIHoxID0gVi5hZGQocCwgVi5zY2FsZShyLCB0KSlcbiAgICAvLyB2YXIgejIgPSBWLmFkZChxLCBWLnNjYWxlKHMsIHUpKVxuXG4gICAgcmV0dXJuIFs4LCBWLmFkZChwLCBWLnNjYWxlKHIsIHQpKV1cbiAgfVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIE5vZGUgPSByZXF1aXJlKCcuL25vZGUuanMnKVxuICB2YXIgdWlkID0gcmVxdWlyZSgnLi4vdXRpbC91bmlxdWVfaWQuanMnKVxuXG4gIC8vIFRPRE86IG1ha2UgdGhpcyAxIHRvIDEgZm9yIGEgZGlzcGxheWVkIHBhcnQgb2YgdGhlIHBhdGggc2ltaWxhcmx5IGhvdyBub2RlcyBhcmVcbiAgdmFyIEVkZ2UgPSBOb2RlLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oZ3JhcGgsIHNvdXJjZSwgdGFyZ2V0LCB0cmFuc2Zvcm0sIGF0dHJzKXtcbiAgICAgIHRoaXMuaWQgPSB1aWQoKVxuICAgICAgdGhpcy50eXBlID0gJ2VkZ2UnXG4gICAgICB0aGlzLmdyYXBoID0gZ3JhcGhcbiAgICAgIHRoaXMuc291cmNlID0gc291cmNlXG4gICAgICB0aGlzLnRhcmdldCA9IHRhcmdldFxuICAgIH1cbiAgfSlcblxuICBtb2R1bGUuZXhwb3J0cyA9IEVkZ2Vcbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciBkYWdyZSA9IHJlcXVpcmUoJ2RhZ3JlJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIE5vZGUgPSByZXF1aXJlKCcuL25vZGUuanMnKVxuICB2YXIgRWRnZSA9IHJlcXVpcmUoJy4vZWRnZS5qcycpXG5cbiAgZnVuY3Rpb24gYWRkX25vZGUoZ3JhcGgsIGNsYXNzbmFtZSwgdHJhbnNmb3JtLCBjb250ZW50LCBwcmVmUmFuayl7XG4gICAgdmFyIG5vZGUgPSBOb2RlLm1ha2UoZ3JhcGgsIHRyYW5zZm9ybSwge1xuICAgICAgICBjbGFzc25hbWU6IGNsYXNzbmFtZVxuICAgICAgLCBjb250ZW50OiBjb250ZW50XG4gICAgICAsIHJhbms6IHByZWZSYW5rXG4gICAgfSlcbiAgICBncmFwaC5hZGROb2RlKG5vZGUuaWQsIG5vZGUpXG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZV9ub2RlKGdyYXBoLCBub2RlX2lkKXtcbiAgICBpZiAoIGdyYXBoLmhhc05vZGUobm9kZV9pZCkgKSB7XG4gICAgICBncmFwaC5kZWxOb2RlKG5vZGVfaWQpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbm5lY3QoZ3JhcGgsIGNsYXNzbmFtZSwgc291cmNlLCB0YXJnZXQsIHRyYW5zZm9ybSwgY29udGVudCl7XG4gICAgdmFyIGVkZ2UgPSBFZGdlLm1ha2UoZ3JhcGgsIHNvdXJjZSwgdGFyZ2V0KVxuICAgIGdyYXBoLmFkZEVkZ2UoZWRnZS5pZCwgc291cmNlLmlkLCB0YXJnZXQuaWQsIGVkZ2UpXG4gICAgcmV0dXJuIGVkZ2VcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc2Nvbm5lY3QoZ3JhcGgsIHNvdXJjZSwgdGFyZ2V0KXtcbiAgICB2YXIgZWRnZV9pZCA9IGdyYXBoLm91dEVkZ2VzKHNvdXJjZS5pZCwgdGFyZ2V0LmlkKVxuICAgIGlmICggZ3JhcGguaGFzRWRnZShlZGdlX2lkKSApIHtcbiAgICAgIGdyYXBoLmRlbEVkZ2UoZWRnZV9pZClcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIHZhciBlbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9lbWl0dGVyLmpzJylcbiAgdmFyIGdyYXBoID0gZW1pdHRlci5leHRlbmQoZGFncmUuRGlncmFwaC5wcm90b3R5cGUpXG4gICAgICAgICAgICAgICAgICAgICAuZXh0ZW5kKHsgaW5pdDogZnVuY3Rpb24oKXsgZGFncmUuRGlncmFwaC5jYWxsKHRoaXMpIH0gfSlcblxuICBtb2R1bGUuZXhwb3J0cyA9IGdyYXBoLmV4dGVuZCh7XG4gICAgYWRkX25vZGU6IGVuc2xhdmUoYWRkX25vZGUpXG4gICwgZGVsX25vZGU6IGVuc2xhdmUocmVtb3ZlX25vZGUpXG4gICwgY29ubmVjdDogZW5zbGF2ZShjb25uZWN0KVxuICAsIGRpc2Nvbm5lY3Q6IGVuc2xhdmUoZGlzY29ubmVjdClcbiAgfSlcblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciB2aXJhbCA9IHJlcXVpcmUoJ3ZpcmFsJylcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcblxuICBmdW5jdGlvbiBzZXRfYXR0cnMobm9kZSwgYXR0cnMpe1xuICAgIE9iamVjdC5rZXlzKGF0dHJzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICBub2RlW2tleV0gPSBhdHRyc1trZXldXG4gICAgfSlcbiAgICBub2RlLmdyYXBoLmVtaXQobm9kZS50eXBlICsgJ19hdHRycycsIGF0dHJzKVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X2F0dHIobm9kZSwgYXR0ciwgdmFsdWUpe1xuICAgIG5vZGVbYXR0cl0gPSB2YWx1ZVxuICAgIG5vZGUuZ3JhcGguZW1pdChub2RlLnR5cGUgKyAnX2F0dHInLCBhdHRyLCB2YWx1ZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZF9hdHRyKG5vZGUsIHNlbGVjdG9yLCBuYW1lLCB2YWx1ZSl7XG4gICAgbm9kZS5jb250ZW50W3NlbGVjdG9yXSA9IG5vZGUuY29udGVudFtzZWxlY3Rvcl0gfHwge31cbiAgICBub2RlLmNvbnRlbnRbc2VsZWN0b3JdW25hbWVdID0gdmFsdWVcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZF9hdHRycyhub2RlLCBzZWxlY3RvciwgYXR0cnMpe1xuICAgIG5vZGUuY29udGVudFtzZWxlY3Rvcl0gPSB2YWx1ZVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB2aXJhbC5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGdyYXBoLCB0cmFuc2Zvcm0sIGF0dHJzKXtcbiAgICAgIHRoaXMuaWQgPSB1aWQoKVxuICAgICAgdGhpcy50eXBlID0gJ3ZlcnRleCdcbiAgICAgIHRoaXMuZ3JhcGggPSBncmFwaFxuICAgICAgdGhpcy50cmFuc2Zvcm0gPSB0cmFuc2Zvcm0uYmluZChudWxsLCB0aGlzKVxuICAgICAgc2V0X2F0dHJzKHRoaXMsIGF0dHJzKVxuICAgIH1cbiAgLCBhdHRyczogZW5zbGF2ZShzZXRfYXR0cnMpXG4gICwgYXR0cjogZW5zbGF2ZShzZXRfYXR0cilcbiAgLCBhZGRfYXR0cjogZW5zbGF2ZShhZGRfYXR0cilcbiAgLCBhZGRfYXR0cnM6IGVuc2xhdmUoYWRkX2F0dHJzKVxuICB9KVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICBpZiAoIVN0cmluZy5wcm90b3R5cGUudHJpbSkge1xuICAgIFN0cmluZy5wcm90b3R5cGUudHJpbSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxuICAgIH1cbiAgfVxuXG4gIHZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vdXRpbC9kZWZhdWx0cy5qcycpXG4gIHZhciBHcmFwaCA9IHJlcXVpcmUoJy4vZ3JhcGgvZ3JhcGguanMnKVxuICB2YXIgRGlhZ3JhbSA9IHJlcXVpcmUoJy4vZGlhZ3JhbS9kaWFncmFtLmpzJylcblxuXG4gIC8qKlxuICAqIFNldCBkZWZhdWx0IGNvbmZpZ3VyYXRpb25cbiAgKiBAcGFyYW0gICAgICB7T2JqZWN0fSBvcHRpb25zXG4gICogQHJldHVybiAgICAge09iamVjdH0gb3B0aW9ucyBmaWxsZWQgd2l0aCBkZWZhdWx0c1xuICAqL1xuICBmdW5jdGlvbiBjb25maWcoY2Znb2JqKXtcbiAgICB2YXIgZGVmYXVsdF9jZmcgPSB7XG4gICAgICB3aWR0aDogd2luZG93LmlubmVyV2lkdGhcbiAgICAsIGhlaWdodDogd2luZG93LmlubmVySGVpZ2h0XG4gICAgLCBmb250X3NpemU6IDIxXG4gICAgLCBsaW5lX2hlaWdodDogMjYgLy8gZm9yIGZvbnQtc2l6ZSAyMVxuICAgIH1cbiAgICByZXR1cm4gY2Znb2JqID09IG51bGwgPyBkZWZhdWx0X2NmZ1xuICAgICAgICAgOiAgICAgICAgICAgICAgICAgIGRlZmF1bHRzKGNmZ29iaiwgZGVmYXVsdF9jZmcpXG4gIH1cblxuICAvKipcbiAgKiBDcmVhdGUgYSBuZXcgZ3JhcGggb2JqZWN0IHRvIHN0b3JlIGRpYWdyYW0gZGF0YSBpbiBpdFxuICAqIEByZXR1cm4gICAgIHtPYmplY3R9ICAgZ3JhcGggb2JqZWN0XG4gICovXG4gIGZ1bmN0aW9uIGdyYXBoKGNmZ29iail7XG4gICAgcmV0dXJuIEdyYXBoLm1ha2UoY2Znb2JqKVxuICB9XG5cbiAgLyoqXG4gICogSW5pdGlhbGl6ZSBkaWFncmFtIHdpdGggb3B0aW9ucyBhbmQgZ3JhcGggb2JqZWN0XG4gICogYW5kIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXG4gICogQHBhcmFtICAgICAge09iamVjdH0gICBvcHRpb25zXG4gICogQHBhcmFtICAgICAge09iamVjdH0gICBncmFwaCBvYmplY3RcbiAgKiBAcmV0dXJuICAgICB7T2JqZWN0fSAgIGRpYWdyYW1cbiAgKi9cbiAgZnVuY3Rpb24gZGlhZ3JhbShjZmdvYmosIGdyYXBoKXtcbiAgICByZXR1cm4gRGlhZ3JhbS5tYWtlKGNmZ29iaiwgZ3JhcGgpXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBjb25maWc6IGNvbmZpZ1xuICAsIGdyYXBoOiBncmFwaFxuICAsIGRpYWdyYW06IGRpYWdyYW1cbiAgfVxuXG59KClcbiIsIi8qXG5Db3B5cmlnaHQgKGMpIDIwMTItMjAxMyBDaHJpcyBQZXR0aXR0XG5cblBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbm9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbmluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbnRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbmNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcblxuVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbmFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG5JTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbkZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbk9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cblRIRSBTT0ZUV0FSRS5cbiovXG5leHBvcnRzLkRpZ3JhcGggPSByZXF1aXJlKFwiZ3JhcGhsaWJcIikuRGlncmFwaDtcbmV4cG9ydHMuR3JhcGggPSByZXF1aXJlKFwiZ3JhcGhsaWJcIikuR3JhcGg7XG5leHBvcnRzLmxheW91dCA9IHJlcXVpcmUoXCIuL2xpYi9sYXlvdXRcIik7XG5leHBvcnRzLnZlcnNpb24gPSByZXF1aXJlKFwiLi9saWIvdmVyc2lvblwiKTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgcmFuayA9IHJlcXVpcmUoJy4vcmFuaycpLFxuICAgIG9yZGVyID0gcmVxdWlyZSgnLi9vcmRlcicpLFxuICAgIENHcmFwaCA9IHJlcXVpcmUoJ2dyYXBobGliJykuQ0dyYXBoLFxuICAgIENEaWdyYXBoID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5DRGlncmFwaDtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgLy8gRXh0ZXJuYWwgY29uZmlndXJhdGlvblxuICB2YXIgY29uZmlnID0ge1xuICAgIC8vIEhvdyBtdWNoIGRlYnVnIGluZm9ybWF0aW9uIHRvIGluY2x1ZGU/XG4gICAgZGVidWdMZXZlbDogMCxcbiAgICAvLyBNYXggbnVtYmVyIG9mIHN3ZWVwcyB0byBwZXJmb3JtIGluIG9yZGVyIHBoYXNlXG4gICAgb3JkZXJNYXhTd2VlcHM6IG9yZGVyLkRFRkFVTFRfTUFYX1NXRUVQUyxcbiAgICAvLyBVc2UgbmV0d29yayBzaW1wbGV4IGFsZ29yaXRobSBpbiByYW5raW5nXG4gICAgcmFua1NpbXBsZXg6IGZhbHNlLFxuICAgIC8vIFJhbmsgZGlyZWN0aW9uLiBWYWxpZCB2YWx1ZXMgYXJlIChUQiwgTFIpXG4gICAgcmFua0RpcjogJ1RCJ1xuICB9O1xuXG4gIC8vIFBoYXNlIGZ1bmN0aW9uc1xuICB2YXIgcG9zaXRpb24gPSByZXF1aXJlKCcuL3Bvc2l0aW9uJykoKTtcblxuICAvLyBUaGlzIGxheW91dCBvYmplY3RcbiAgdmFyIHNlbGYgPSB7fTtcblxuICBzZWxmLm9yZGVySXRlcnMgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnb3JkZXJNYXhTd2VlcHMnKTtcblxuICBzZWxmLnJhbmtTaW1wbGV4ID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ3JhbmtTaW1wbGV4Jyk7XG5cbiAgc2VsZi5ub2RlU2VwID0gZGVsZWdhdGVQcm9wZXJ0eShwb3NpdGlvbi5ub2RlU2VwKTtcbiAgc2VsZi5lZGdlU2VwID0gZGVsZWdhdGVQcm9wZXJ0eShwb3NpdGlvbi5lZGdlU2VwKTtcbiAgc2VsZi51bml2ZXJzYWxTZXAgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLnVuaXZlcnNhbFNlcCk7XG4gIHNlbGYucmFua1NlcCA9IGRlbGVnYXRlUHJvcGVydHkocG9zaXRpb24ucmFua1NlcCk7XG4gIHNlbGYucmFua0RpciA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdyYW5rRGlyJyk7XG4gIHNlbGYuZGVidWdBbGlnbm1lbnQgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLmRlYnVnQWxpZ25tZW50KTtcblxuICBzZWxmLmRlYnVnTGV2ZWwgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnZGVidWdMZXZlbCcsIGZ1bmN0aW9uKHgpIHtcbiAgICB1dGlsLmxvZy5sZXZlbCA9IHg7XG4gICAgcG9zaXRpb24uZGVidWdMZXZlbCh4KTtcbiAgfSk7XG5cbiAgc2VsZi5ydW4gPSB1dGlsLnRpbWUoJ1RvdGFsIGxheW91dCcsIHJ1bik7XG5cbiAgc2VsZi5fbm9ybWFsaXplID0gbm9ybWFsaXplO1xuXG4gIHJldHVybiBzZWxmO1xuXG4gIC8qXG4gICAqIENvbnN0cnVjdHMgYW4gYWRqYWNlbmN5IGdyYXBoIHVzaW5nIHRoZSBub2RlcyBhbmQgZWRnZXMgc3BlY2lmaWVkIHRocm91Z2hcbiAgICogY29uZmlnLiBGb3IgZWFjaCBub2RlIGFuZCBlZGdlIHdlIGFkZCBhIHByb3BlcnR5IGBkYWdyZWAgdGhhdCBjb250YWlucyBhblxuICAgKiBvYmplY3QgdGhhdCB3aWxsIGhvbGQgaW50ZXJtZWRpYXRlIGFuZCBmaW5hbCBsYXlvdXQgaW5mb3JtYXRpb24uIFNvbWUgb2ZcbiAgICogdGhlIGNvbnRlbnRzIGluY2x1ZGU6XG4gICAqXG4gICAqICAxKSBBIGdlbmVyYXRlZCBJRCB0aGF0IHVuaXF1ZWx5IGlkZW50aWZpZXMgdGhlIG9iamVjdC5cbiAgICogIDIpIERpbWVuc2lvbiBpbmZvcm1hdGlvbiBmb3Igbm9kZXMgKGNvcGllZCBmcm9tIHRoZSBzb3VyY2Ugbm9kZSkuXG4gICAqICAzKSBPcHRpb25hbCBkaW1lbnNpb24gaW5mb3JtYXRpb24gZm9yIGVkZ2VzLlxuICAgKlxuICAgKiBBZnRlciB0aGUgYWRqYWNlbmN5IGdyYXBoIGlzIGNvbnN0cnVjdGVkIHRoZSBjb2RlIG5vIGxvbmdlciBuZWVkcyB0byB1c2VcbiAgICogdGhlIG9yaWdpbmFsIG5vZGVzIGFuZCBlZGdlcyBwYXNzZWQgaW4gdmlhIGNvbmZpZy5cbiAgICovXG4gIGZ1bmN0aW9uIGluaXRMYXlvdXRHcmFwaChpbnB1dEdyYXBoKSB7XG4gICAgdmFyIGcgPSBuZXcgQ0RpZ3JhcGgoKTtcblxuICAgIGlucHV0R3JhcGguZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB2YWx1ZSA9IHt9O1xuICAgICAgZy5hZGROb2RlKHUsIHtcbiAgICAgICAgd2lkdGg6IHZhbHVlLndpZHRoLFxuICAgICAgICBoZWlnaHQ6IHZhbHVlLmhlaWdodFxuICAgICAgfSk7XG4gICAgICBpZiAodmFsdWUuaGFzT3duUHJvcGVydHkoJ3JhbmsnKSkge1xuICAgICAgICBnLm5vZGUodSkucHJlZlJhbmsgPSB2YWx1ZS5yYW5rO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gU2V0IHVwIHN1YmdyYXBoc1xuICAgIGlmIChpbnB1dEdyYXBoLnBhcmVudCkge1xuICAgICAgaW5wdXRHcmFwaC5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgICBnLnBhcmVudCh1LCBpbnB1dEdyYXBoLnBhcmVudCh1KSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpbnB1dEdyYXBoLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgdmFsdWUgPSB7fTtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IHtcbiAgICAgICAgZTogZSxcbiAgICAgICAgbWluTGVuOiB2YWx1ZS5taW5MZW4gfHwgMSxcbiAgICAgICAgd2lkdGg6IHZhbHVlLndpZHRoIHx8IDAsXG4gICAgICAgIGhlaWdodDogdmFsdWUuaGVpZ2h0IHx8IDAsXG4gICAgICAgIHBvaW50czogW11cbiAgICAgIH07XG5cbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCBuZXdWYWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBJbml0aWFsIGdyYXBoIGF0dHJpYnV0ZXNcbiAgICB2YXIgZ3JhcGhWYWx1ZSA9IGlucHV0R3JhcGguZ3JhcGgoKSB8fCB7fTtcbiAgICBnLmdyYXBoKHtcbiAgICAgIHJhbmtEaXI6IGdyYXBoVmFsdWUucmFua0RpciB8fCBjb25maWcucmFua0RpcixcbiAgICAgIG9yZGVyUmVzdGFydHM6IGdyYXBoVmFsdWUub3JkZXJSZXN0YXJ0c1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGc7XG4gIH1cblxuICBmdW5jdGlvbiBydW4oaW5wdXRHcmFwaCkge1xuICAgIHZhciByYW5rU2VwID0gc2VsZi5yYW5rU2VwKCk7XG4gICAgdmFyIGc7XG4gICAgdHJ5IHtcbiAgICAgIC8vIEJ1aWxkIGludGVybmFsIGdyYXBoXG4gICAgICBnID0gdXRpbC50aW1lKCdpbml0TGF5b3V0R3JhcGgnLCBpbml0TGF5b3V0R3JhcGgpKGlucHV0R3JhcGgpO1xuXG4gICAgICBpZiAoZy5vcmRlcigpID09PSAwKSB7XG4gICAgICAgIHJldHVybiBnO1xuICAgICAgfVxuXG4gICAgICAvLyBNYWtlIHNwYWNlIGZvciBlZGdlIGxhYmVsc1xuICAgICAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCBzLCB0LCBhKSB7XG4gICAgICAgIGEubWluTGVuICo9IDI7XG4gICAgICB9KTtcbiAgICAgIHNlbGYucmFua1NlcChyYW5rU2VwIC8gMik7XG5cbiAgICAgIC8vIERldGVybWluZSB0aGUgcmFuayBmb3IgZWFjaCBub2RlLiBOb2RlcyB3aXRoIGEgbG93ZXIgcmFuayB3aWxsIGFwcGVhclxuICAgICAgLy8gYWJvdmUgbm9kZXMgb2YgaGlnaGVyIHJhbmsuXG4gICAgICB1dGlsLnRpbWUoJ3JhbmsucnVuJywgcmFuay5ydW4pKGcsIGNvbmZpZy5yYW5rU2ltcGxleCk7XG5cbiAgICAgIC8vIE5vcm1hbGl6ZSB0aGUgZ3JhcGggYnkgZW5zdXJpbmcgdGhhdCBldmVyeSBlZGdlIGlzIHByb3BlciAoZWFjaCBlZGdlIGhhc1xuICAgICAgLy8gYSBsZW5ndGggb2YgMSkuIFdlIGFjaGlldmUgdGhpcyBieSBhZGRpbmcgZHVtbXkgbm9kZXMgdG8gbG9uZyBlZGdlcyxcbiAgICAgIC8vIHRodXMgc2hvcnRlbmluZyB0aGVtLlxuICAgICAgdXRpbC50aW1lKCdub3JtYWxpemUnLCBub3JtYWxpemUpKGcpO1xuXG4gICAgICAvLyBPcmRlciB0aGUgbm9kZXMgc28gdGhhdCBlZGdlIGNyb3NzaW5ncyBhcmUgbWluaW1pemVkLlxuICAgICAgdXRpbC50aW1lKCdvcmRlcicsIG9yZGVyKShnLCBjb25maWcub3JkZXJNYXhTd2VlcHMpO1xuXG4gICAgICAvLyBGaW5kIHRoZSB4IGFuZCB5IGNvb3JkaW5hdGVzIGZvciBldmVyeSBub2RlIGluIHRoZSBncmFwaC5cbiAgICAgIHV0aWwudGltZSgncG9zaXRpb24nLCBwb3NpdGlvbi5ydW4pKGcpO1xuXG4gICAgICAvLyBEZS1ub3JtYWxpemUgdGhlIGdyYXBoIGJ5IHJlbW92aW5nIGR1bW15IG5vZGVzIGFuZCBhdWdtZW50aW5nIHRoZVxuICAgICAgLy8gb3JpZ2luYWwgbG9uZyBlZGdlcyB3aXRoIGNvb3JkaW5hdGUgaW5mb3JtYXRpb24uXG4gICAgICB1dGlsLnRpbWUoJ3VuZG9Ob3JtYWxpemUnLCB1bmRvTm9ybWFsaXplKShnKTtcblxuICAgICAgLy8gUmV2ZXJzZXMgcG9pbnRzIGZvciBlZGdlcyB0aGF0IGFyZSBpbiBhIHJldmVyc2VkIHN0YXRlLlxuICAgICAgdXRpbC50aW1lKCdmaXh1cEVkZ2VQb2ludHMnLCBmaXh1cEVkZ2VQb2ludHMpKGcpO1xuXG4gICAgICAvLyBSZXN0b3JlIGRlbGV0ZSBlZGdlcyBhbmQgcmV2ZXJzZSBlZGdlcyB0aGF0IHdlcmUgcmV2ZXJzZWQgaW4gdGhlIHJhbmtcbiAgICAgIC8vIHBoYXNlLlxuICAgICAgdXRpbC50aW1lKCdyYW5rLnJlc3RvcmVFZGdlcycsIHJhbmsucmVzdG9yZUVkZ2VzKShnKTtcblxuICAgICAgLy8gQ29uc3RydWN0IGZpbmFsIHJlc3VsdCBncmFwaCBhbmQgcmV0dXJuIGl0XG4gICAgICByZXR1cm4gdXRpbC50aW1lKCdjcmVhdGVGaW5hbEdyYXBoJywgY3JlYXRlRmluYWxHcmFwaCkoZywgaW5wdXRHcmFwaC5pc0RpcmVjdGVkKCkpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZWxmLnJhbmtTZXAocmFua1NlcCk7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICogVGhpcyBmdW5jdGlvbiBpcyByZXNwb25zaWJsZSBmb3IgJ25vcm1hbGl6aW5nJyB0aGUgZ3JhcGguIFRoZSBwcm9jZXNzIG9mXG4gICAqIG5vcm1hbGl6YXRpb24gZW5zdXJlcyB0aGF0IG5vIGVkZ2UgaW4gdGhlIGdyYXBoIGhhcyBzcGFucyBtb3JlIHRoYW4gb25lXG4gICAqIHJhbmsuIFRvIGRvIHRoaXMgaXQgaW5zZXJ0cyBkdW1teSBub2RlcyBhcyBuZWVkZWQgYW5kIGxpbmtzIHRoZW0gYnkgYWRkaW5nXG4gICAqIGR1bW15IGVkZ2VzLiBUaGlzIGZ1bmN0aW9uIGtlZXBzIGVub3VnaCBpbmZvcm1hdGlvbiBpbiB0aGUgZHVtbXkgbm9kZXMgYW5kXG4gICAqIGVkZ2VzIHRvIGVuc3VyZSB0aGF0IHRoZSBvcmlnaW5hbCBncmFwaCBjYW4gYmUgcmVjb25zdHJ1Y3RlZCBsYXRlci5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgYXNzdW1lcyB0aGF0IHRoZSBpbnB1dCBncmFwaCBpcyBjeWNsZSBmcmVlLlxuICAgKi9cbiAgZnVuY3Rpb24gbm9ybWFsaXplKGcpIHtcbiAgICB2YXIgZHVtbXlDb3VudCA9IDA7XG4gICAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCBzLCB0LCBhKSB7XG4gICAgICB2YXIgc291cmNlUmFuayA9IGcubm9kZShzKS5yYW5rO1xuICAgICAgdmFyIHRhcmdldFJhbmsgPSBnLm5vZGUodCkucmFuaztcbiAgICAgIGlmIChzb3VyY2VSYW5rICsgMSA8IHRhcmdldFJhbmspIHtcbiAgICAgICAgZm9yICh2YXIgdSA9IHMsIHJhbmsgPSBzb3VyY2VSYW5rICsgMSwgaSA9IDA7IHJhbmsgPCB0YXJnZXRSYW5rOyArK3JhbmssICsraSkge1xuICAgICAgICAgIHZhciB2ID0gJ19EJyArICgrK2R1bW15Q291bnQpO1xuICAgICAgICAgIHZhciBub2RlID0ge1xuICAgICAgICAgICAgd2lkdGg6IGEud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGEuaGVpZ2h0LFxuICAgICAgICAgICAgZWRnZTogeyBpZDogZSwgc291cmNlOiBzLCB0YXJnZXQ6IHQsIGF0dHJzOiBhIH0sXG4gICAgICAgICAgICByYW5rOiByYW5rLFxuICAgICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gSWYgdGhpcyBub2RlIHJlcHJlc2VudHMgYSBiZW5kIHRoZW4gd2Ugd2lsbCB1c2UgaXQgYXMgYSBjb250cm9sXG4gICAgICAgICAgLy8gcG9pbnQuIEZvciBlZGdlcyB3aXRoIDIgc2VnbWVudHMgdGhpcyB3aWxsIGJlIHRoZSBjZW50ZXIgZHVtbXlcbiAgICAgICAgICAvLyBub2RlLiBGb3IgZWRnZXMgd2l0aCBtb3JlIHRoYW4gdHdvIHNlZ21lbnRzLCB0aGlzIHdpbGwgYmUgdGhlXG4gICAgICAgICAgLy8gZmlyc3QgYW5kIGxhc3QgZHVtbXkgbm9kZS5cbiAgICAgICAgICBpZiAoaSA9PT0gMCkgbm9kZS5pbmRleCA9IDA7XG4gICAgICAgICAgZWxzZSBpZiAocmFuayArIDEgPT09IHRhcmdldFJhbmspIG5vZGUuaW5kZXggPSAxO1xuXG4gICAgICAgICAgZy5hZGROb2RlKHYsIG5vZGUpO1xuICAgICAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCB7fSk7XG4gICAgICAgICAgdSA9IHY7XG4gICAgICAgIH1cbiAgICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHQsIHt9KTtcbiAgICAgICAgZy5kZWxFZGdlKGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLypcbiAgICogUmVjb25zdHJ1Y3RzIHRoZSBncmFwaCBhcyBpdCB3YXMgYmVmb3JlIG5vcm1hbGl6YXRpb24uIFRoZSBwb3NpdGlvbnMgb2ZcbiAgICogZHVtbXkgbm9kZXMgYXJlIHVzZWQgdG8gYnVpbGQgYW4gYXJyYXkgb2YgcG9pbnRzIGZvciB0aGUgb3JpZ2luYWwgJ2xvbmcnXG4gICAqIGVkZ2UuIER1bW15IG5vZGVzIGFuZCBlZGdlcyBhcmUgcmVtb3ZlZC5cbiAgICovXG4gIGZ1bmN0aW9uIHVuZG9Ob3JtYWxpemUoZykge1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgYSkge1xuICAgICAgaWYgKGEuZHVtbXkpIHtcbiAgICAgICAgaWYgKCdpbmRleCcgaW4gYSkge1xuICAgICAgICAgIHZhciBlZGdlID0gYS5lZGdlO1xuICAgICAgICAgIGlmICghZy5oYXNFZGdlKGVkZ2UuaWQpKSB7XG4gICAgICAgICAgICBnLmFkZEVkZ2UoZWRnZS5pZCwgZWRnZS5zb3VyY2UsIGVkZ2UudGFyZ2V0LCBlZGdlLmF0dHJzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIHBvaW50cyA9IGcuZWRnZShlZGdlLmlkKS5wb2ludHM7XG4gICAgICAgICAgcG9pbnRzW2EuaW5kZXhdID0geyB4OiBhLngsIHk6IGEueSwgdWw6IGEudWwsIHVyOiBhLnVyLCBkbDogYS5kbCwgZHI6IGEuZHIgfTtcbiAgICAgICAgfVxuICAgICAgICBnLmRlbE5vZGUodSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBGb3IgZWFjaCBlZGdlIHRoYXQgd2FzIHJldmVyc2VkIGR1cmluZyB0aGUgYGFjeWNsaWNgIHN0ZXAsIHJldmVyc2UgaXRzXG4gICAqIGFycmF5IG9mIHBvaW50cy5cbiAgICovXG4gIGZ1bmN0aW9uIGZpeHVwRWRnZVBvaW50cyhnKSB7XG4gICAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCBzLCB0LCBhKSB7IGlmIChhLnJldmVyc2VkKSBhLnBvaW50cy5yZXZlcnNlKCk7IH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlRmluYWxHcmFwaChnLCBpc0RpcmVjdGVkKSB7XG4gICAgdmFyIG91dCA9IGlzRGlyZWN0ZWQgPyBuZXcgQ0RpZ3JhcGgoKSA6IG5ldyBDR3JhcGgoKTtcbiAgICBvdXQuZ3JhcGgoZy5ncmFwaCgpKTtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7IG91dC5hZGROb2RlKHUsIHZhbHVlKTsgfSk7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7IG91dC5wYXJlbnQodSwgZy5wYXJlbnQodSkpOyB9KTtcbiAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgICBvdXQuYWRkRWRnZSh2YWx1ZS5lLCB1LCB2LCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBBdHRhY2ggYm91bmRpbmcgYm94IGluZm9ybWF0aW9uXG4gICAgdmFyIG1heFggPSAwLCBtYXhZID0gMDtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgICBpZiAoIWcuY2hpbGRyZW4odSkubGVuZ3RoKSB7XG4gICAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCB2YWx1ZS54ICsgdmFsdWUud2lkdGggLyAyKTtcbiAgICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIHZhbHVlLnkgKyB2YWx1ZS5oZWlnaHQgLyAyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgICB2YXIgbWF4WFBvaW50cyA9IE1hdGgubWF4LmFwcGx5KE1hdGgsIHZhbHVlLnBvaW50cy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4gcC54OyB9KSk7XG4gICAgICB2YXIgbWF4WVBvaW50cyA9IE1hdGgubWF4LmFwcGx5KE1hdGgsIHZhbHVlLnBvaW50cy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4gcC55OyB9KSk7XG4gICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgbWF4WFBvaW50cyArIHZhbHVlLndpZHRoIC8gMik7XG4gICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgbWF4WVBvaW50cyArIHZhbHVlLmhlaWdodCAvIDIpO1xuICAgIH0pO1xuICAgIG91dC5ncmFwaCgpLndpZHRoID0gbWF4WDtcbiAgICBvdXQuZ3JhcGgoKS5oZWlnaHQgPSBtYXhZO1xuXG4gICAgcmV0dXJuIG91dDtcbiAgfVxuXG4gIC8qXG4gICAqIEdpdmVuIGEgZnVuY3Rpb24sIGEgbmV3IGZ1bmN0aW9uIGlzIHJldHVybmVkIHRoYXQgaW52b2tlcyB0aGUgZ2l2ZW5cbiAgICogZnVuY3Rpb24uIFRoZSByZXR1cm4gdmFsdWUgZnJvbSB0aGUgZnVuY3Rpb24gaXMgYWx3YXlzIHRoZSBgc2VsZmAgb2JqZWN0LlxuICAgKi9cbiAgZnVuY3Rpb24gZGVsZWdhdGVQcm9wZXJ0eShmKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZigpO1xuICAgICAgZi5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbiAgfVxufTtcblxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBjcm9zc0NvdW50ID0gcmVxdWlyZSgnLi9vcmRlci9jcm9zc0NvdW50JyksXG4gICAgaW5pdExheWVyR3JhcGhzID0gcmVxdWlyZSgnLi9vcmRlci9pbml0TGF5ZXJHcmFwaHMnKSxcbiAgICBpbml0T3JkZXIgPSByZXF1aXJlKCcuL29yZGVyL2luaXRPcmRlcicpLFxuICAgIHNvcnRMYXllciA9IHJlcXVpcmUoJy4vb3JkZXIvc29ydExheWVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gb3JkZXI7XG5cbi8vIFRoZSBtYXhpbXVtIG51bWJlciBvZiBzd2VlcHMgdG8gcGVyZm9ybSBiZWZvcmUgZmluaXNoaW5nIHRoZSBvcmRlciBwaGFzZS5cbnZhciBERUZBVUxUX01BWF9TV0VFUFMgPSAyNDtcbm9yZGVyLkRFRkFVTFRfTUFYX1NXRUVQUyA9IERFRkFVTFRfTUFYX1NXRUVQUztcblxuLypcbiAqIFJ1bnMgdGhlIG9yZGVyIHBoYXNlIHdpdGggdGhlIHNwZWNpZmllZCBgZ3JhcGgsIGBtYXhTd2VlcHNgLCBhbmRcbiAqIGBkZWJ1Z0xldmVsYC4gSWYgYG1heFN3ZWVwc2AgaXMgbm90IHNwZWNpZmllZCB3ZSB1c2UgYERFRkFVTFRfTUFYX1NXRUVQU2AuXG4gKiBJZiBgZGVidWdMZXZlbGAgaXMgbm90IHNldCB3ZSBhc3N1bWUgMC5cbiAqL1xuZnVuY3Rpb24gb3JkZXIoZywgbWF4U3dlZXBzKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgIG1heFN3ZWVwcyA9IERFRkFVTFRfTUFYX1NXRUVQUztcbiAgfVxuXG4gIHZhciByZXN0YXJ0cyA9IGcuZ3JhcGgoKS5vcmRlclJlc3RhcnRzIHx8IDA7XG5cbiAgdmFyIGxheWVyR3JhcGhzID0gaW5pdExheWVyR3JhcGhzKGcpO1xuICAvLyBUT0RPOiByZW1vdmUgdGhpcyB3aGVuIHdlIGFkZCBiYWNrIHN1cHBvcnQgZm9yIG9yZGVyaW5nIGNsdXN0ZXJzXG4gIGxheWVyR3JhcGhzLmZvckVhY2goZnVuY3Rpb24obGcpIHtcbiAgICBsZyA9IGxnLmZpbHRlck5vZGVzKGZ1bmN0aW9uKHUpIHsgcmV0dXJuICFnLmNoaWxkcmVuKHUpLmxlbmd0aDsgfSk7XG4gIH0pO1xuXG4gIHZhciBpdGVycyA9IDAsXG4gICAgICBjdXJyZW50QmVzdENDLFxuICAgICAgYWxsVGltZUJlc3RDQyA9IE51bWJlci5NQVhfVkFMVUUsXG4gICAgICBhbGxUaW1lQmVzdCA9IHt9O1xuXG4gIGZ1bmN0aW9uIHNhdmVBbGxUaW1lQmVzdCgpIHtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7IGFsbFRpbWVCZXN0W3VdID0gdmFsdWUub3JkZXI7IH0pO1xuICB9XG5cbiAgZm9yICh2YXIgaiA9IDA7IGogPCBOdW1iZXIocmVzdGFydHMpICsgMSAmJiBhbGxUaW1lQmVzdENDICE9PSAwOyArK2opIHtcbiAgICBjdXJyZW50QmVzdENDID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICBpbml0T3JkZXIoZywgcmVzdGFydHMgPiAwKTtcblxuICAgIHV0aWwubG9nKDIsICdPcmRlciBwaGFzZSBzdGFydCBjcm9zcyBjb3VudDogJyArIGcuZ3JhcGgoKS5vcmRlckluaXRDQyk7XG5cbiAgICB2YXIgaSwgbGFzdEJlc3QsIGNjO1xuICAgIGZvciAoaSA9IDAsIGxhc3RCZXN0ID0gMDsgbGFzdEJlc3QgPCA0ICYmIGkgPCBtYXhTd2VlcHMgJiYgY3VycmVudEJlc3RDQyA+IDA7ICsraSwgKytsYXN0QmVzdCwgKytpdGVycykge1xuICAgICAgc3dlZXAoZywgbGF5ZXJHcmFwaHMsIGkpO1xuICAgICAgY2MgPSBjcm9zc0NvdW50KGcpO1xuICAgICAgaWYgKGNjIDwgY3VycmVudEJlc3RDQykge1xuICAgICAgICBsYXN0QmVzdCA9IDA7XG4gICAgICAgIGN1cnJlbnRCZXN0Q0MgPSBjYztcbiAgICAgICAgaWYgKGNjIDwgYWxsVGltZUJlc3RDQykge1xuICAgICAgICAgIHNhdmVBbGxUaW1lQmVzdCgpO1xuICAgICAgICAgIGFsbFRpbWVCZXN0Q0MgPSBjYztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdXRpbC5sb2coMywgJ09yZGVyIHBoYXNlIHN0YXJ0ICcgKyBqICsgJyBpdGVyICcgKyBpICsgJyBjcm9zcyBjb3VudDogJyArIGNjKTtcbiAgICB9XG4gIH1cblxuICBPYmplY3Qua2V5cyhhbGxUaW1lQmVzdCkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgaWYgKCFnLmNoaWxkcmVuIHx8ICFnLmNoaWxkcmVuKHUpLmxlbmd0aCkge1xuICAgICAgZy5ub2RlKHUpLm9yZGVyID0gYWxsVGltZUJlc3RbdV07XG4gICAgfVxuICB9KTtcbiAgZy5ncmFwaCgpLm9yZGVyQ0MgPSBhbGxUaW1lQmVzdENDO1xuXG4gIHV0aWwubG9nKDIsICdPcmRlciBpdGVyYXRpb25zOiAnICsgaXRlcnMpO1xuICB1dGlsLmxvZygyLCAnT3JkZXIgcGhhc2UgYmVzdCBjcm9zcyBjb3VudDogJyArIGcuZ3JhcGgoKS5vcmRlckNDKTtcbn1cblxuZnVuY3Rpb24gcHJlZGVjZXNzb3JXZWlnaHRzKGcsIG5vZGVzKSB7XG4gIHZhciB3ZWlnaHRzID0ge307XG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHdlaWdodHNbdV0gPSBnLmluRWRnZXModSkubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBnLm5vZGUoZy5zb3VyY2UoZSkpLm9yZGVyO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIHdlaWdodHM7XG59XG5cbmZ1bmN0aW9uIHN1Y2Nlc3NvcldlaWdodHMoZywgbm9kZXMpIHtcbiAgdmFyIHdlaWdodHMgPSB7fTtcbiAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgd2VpZ2h0c1t1XSA9IGcub3V0RWRnZXModSkubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBnLm5vZGUoZy50YXJnZXQoZSkpLm9yZGVyO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIHdlaWdodHM7XG59XG5cbmZ1bmN0aW9uIHN3ZWVwKGcsIGxheWVyR3JhcGhzLCBpdGVyKSB7XG4gIGlmIChpdGVyICUgMiA9PT0gMCkge1xuICAgIHN3ZWVwRG93bihnLCBsYXllckdyYXBocywgaXRlcik7XG4gIH0gZWxzZSB7XG4gICAgc3dlZXBVcChnLCBsYXllckdyYXBocywgaXRlcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3dlZXBEb3duKGcsIGxheWVyR3JhcGhzKSB7XG4gIHZhciBjZztcbiAgZm9yIChpID0gMTsgaSA8IGxheWVyR3JhcGhzLmxlbmd0aDsgKytpKSB7XG4gICAgY2cgPSBzb3J0TGF5ZXIobGF5ZXJHcmFwaHNbaV0sIGNnLCBwcmVkZWNlc3NvcldlaWdodHMoZywgbGF5ZXJHcmFwaHNbaV0ubm9kZXMoKSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN3ZWVwVXAoZywgbGF5ZXJHcmFwaHMpIHtcbiAgdmFyIGNnO1xuICBmb3IgKGkgPSBsYXllckdyYXBocy5sZW5ndGggLSAyOyBpID49IDA7IC0taSkge1xuICAgIHNvcnRMYXllcihsYXllckdyYXBoc1tpXSwgY2csIHN1Y2Nlc3NvcldlaWdodHMoZywgbGF5ZXJHcmFwaHNbaV0ubm9kZXMoKSkpO1xuICB9XG59XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcm9zc0NvdW50O1xuXG4vKlxuICogUmV0dXJucyB0aGUgY3Jvc3MgY291bnQgZm9yIHRoZSBnaXZlbiBncmFwaC5cbiAqL1xuZnVuY3Rpb24gY3Jvc3NDb3VudChnKSB7XG4gIHZhciBjYyA9IDA7XG4gIHZhciBvcmRlcmluZyA9IHV0aWwub3JkZXJpbmcoZyk7XG4gIGZvciAodmFyIGkgPSAxOyBpIDwgb3JkZXJpbmcubGVuZ3RoOyArK2kpIHtcbiAgICBjYyArPSB0d29MYXllckNyb3NzQ291bnQoZywgb3JkZXJpbmdbaS0xXSwgb3JkZXJpbmdbaV0pO1xuICB9XG4gIHJldHVybiBjYztcbn1cblxuLypcbiAqIFRoaXMgZnVuY3Rpb24gc2VhcmNoZXMgdGhyb3VnaCBhIHJhbmtlZCBhbmQgb3JkZXJlZCBncmFwaCBhbmQgY291bnRzIHRoZVxuICogbnVtYmVyIG9mIGVkZ2VzIHRoYXQgY3Jvc3MuIFRoaXMgYWxnb3JpdGhtIGlzIGRlcml2ZWQgZnJvbTpcbiAqXG4gKiAgICBXLiBCYXJ0aCBldCBhbC4sIEJpbGF5ZXIgQ3Jvc3MgQ291bnRpbmcsIEpHQUEsIDgoMikgMTc54oCTMTk0ICgyMDA0KVxuICovXG5mdW5jdGlvbiB0d29MYXllckNyb3NzQ291bnQoZywgbGF5ZXIxLCBsYXllcjIpIHtcbiAgdmFyIGluZGljZXMgPSBbXTtcbiAgbGF5ZXIxLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHZhciBub2RlSW5kaWNlcyA9IFtdO1xuICAgIGcub3V0RWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7IG5vZGVJbmRpY2VzLnB1c2goZy5ub2RlKGcudGFyZ2V0KGUpKS5vcmRlcik7IH0pO1xuICAgIG5vZGVJbmRpY2VzLnNvcnQoZnVuY3Rpb24oeCwgeSkgeyByZXR1cm4geCAtIHk7IH0pO1xuICAgIGluZGljZXMgPSBpbmRpY2VzLmNvbmNhdChub2RlSW5kaWNlcyk7XG4gIH0pO1xuXG4gIHZhciBmaXJzdEluZGV4ID0gMTtcbiAgd2hpbGUgKGZpcnN0SW5kZXggPCBsYXllcjIubGVuZ3RoKSBmaXJzdEluZGV4IDw8PSAxO1xuXG4gIHZhciB0cmVlU2l6ZSA9IDIgKiBmaXJzdEluZGV4IC0gMTtcbiAgZmlyc3RJbmRleCAtPSAxO1xuXG4gIHZhciB0cmVlID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdHJlZVNpemU7ICsraSkgeyB0cmVlW2ldID0gMDsgfVxuXG4gIHZhciBjYyA9IDA7XG4gIGluZGljZXMuZm9yRWFjaChmdW5jdGlvbihpKSB7XG4gICAgdmFyIHRyZWVJbmRleCA9IGkgKyBmaXJzdEluZGV4O1xuICAgICsrdHJlZVt0cmVlSW5kZXhdO1xuICAgIHdoaWxlICh0cmVlSW5kZXggPiAwKSB7XG4gICAgICBpZiAodHJlZUluZGV4ICUgMikge1xuICAgICAgICBjYyArPSB0cmVlW3RyZWVJbmRleCArIDFdO1xuICAgICAgfVxuICAgICAgdHJlZUluZGV4ID0gKHRyZWVJbmRleCAtIDEpID4+IDE7XG4gICAgICArK3RyZWVbdHJlZUluZGV4XTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjYztcbn1cbiIsInZhciBub2Rlc0Zyb21MaXN0ID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5maWx0ZXIubm9kZXNGcm9tTGlzdCxcbiAgICAvKiBqc2hpbnQgLVcwNzkgKi9cbiAgICBTZXQgPSByZXF1aXJlKCdjcC1kYXRhJykuU2V0O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXRMYXllckdyYXBocztcblxuLypcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYSBjb21wb3VuZCBsYXllcmVkIGdyYXBoLCBnLCBhbmQgcHJvZHVjZXMgYW4gYXJyYXkgb2ZcbiAqIGxheWVyIGdyYXBocy4gRWFjaCBlbnRyeSBpbiB0aGUgYXJyYXkgcmVwcmVzZW50cyBhIHN1YmdyYXBoIG9mIG5vZGVzXG4gKiByZWxldmFudCBmb3IgcGVyZm9ybWluZyBjcm9zc2luZyByZWR1Y3Rpb24gb24gdGhhdCBsYXllci5cbiAqL1xuZnVuY3Rpb24gaW5pdExheWVyR3JhcGhzKGcpIHtcbiAgdmFyIHJhbmtzID0gW107XG5cbiAgZnVuY3Rpb24gZGZzKHUpIHtcbiAgICBpZiAodSA9PT0gbnVsbCkge1xuICAgICAgZy5jaGlsZHJlbih1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHsgZGZzKHYpOyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWUgPSBnLm5vZGUodSk7XG4gICAgdmFsdWUubWluUmFuayA9ICgncmFuaycgaW4gdmFsdWUpID8gdmFsdWUucmFuayA6IE51bWJlci5NQVhfVkFMVUU7XG4gICAgdmFsdWUubWF4UmFuayA9ICgncmFuaycgaW4gdmFsdWUpID8gdmFsdWUucmFuayA6IE51bWJlci5NSU5fVkFMVUU7XG4gICAgdmFyIHVSYW5rcyA9IG5ldyBTZXQoKTtcbiAgICBnLmNoaWxkcmVuKHUpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgdmFyIHJzID0gZGZzKHYpO1xuICAgICAgdVJhbmtzID0gU2V0LnVuaW9uKFt1UmFua3MsIHJzXSk7XG4gICAgICB2YWx1ZS5taW5SYW5rID0gTWF0aC5taW4odmFsdWUubWluUmFuaywgZy5ub2RlKHYpLm1pblJhbmspO1xuICAgICAgdmFsdWUubWF4UmFuayA9IE1hdGgubWF4KHZhbHVlLm1heFJhbmssIGcubm9kZSh2KS5tYXhSYW5rKTtcbiAgICB9KTtcblxuICAgIGlmICgncmFuaycgaW4gdmFsdWUpIHVSYW5rcy5hZGQodmFsdWUucmFuayk7XG5cbiAgICB1UmFua3Mua2V5cygpLmZvckVhY2goZnVuY3Rpb24ocikge1xuICAgICAgaWYgKCEociBpbiByYW5rcykpIHJhbmtzW3JdID0gW107XG4gICAgICByYW5rc1tyXS5wdXNoKHUpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHVSYW5rcztcbiAgfVxuICBkZnMobnVsbCk7XG5cbiAgdmFyIGxheWVyR3JhcGhzID0gW107XG4gIHJhbmtzLmZvckVhY2goZnVuY3Rpb24odXMsIHJhbmspIHtcbiAgICBsYXllckdyYXBoc1tyYW5rXSA9IGcuZmlsdGVyTm9kZXMobm9kZXNGcm9tTGlzdCh1cykpO1xuICB9KTtcblxuICByZXR1cm4gbGF5ZXJHcmFwaHM7XG59XG4iLCJ2YXIgY3Jvc3NDb3VudCA9IHJlcXVpcmUoJy4vY3Jvc3NDb3VudCcpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdE9yZGVyO1xuXG4vKlxuICogR2l2ZW4gYSBncmFwaCB3aXRoIGEgc2V0IG9mIGxheWVyZWQgbm9kZXMgKGkuZS4gbm9kZXMgdGhhdCBoYXZlIGEgYHJhbmtgXG4gKiBhdHRyaWJ1dGUpIHRoaXMgZnVuY3Rpb24gYXR0YWNoZXMgYW4gYG9yZGVyYCBhdHRyaWJ1dGUgdGhhdCB1bmlxdWVseVxuICogYXJyYW5nZXMgZWFjaCBub2RlIG9mIGVhY2ggcmFuay4gSWYgbm8gY29uc3RyYWludCBncmFwaCBpcyBwcm92aWRlZCB0aGVcbiAqIG9yZGVyIG9mIHRoZSBub2RlcyBpbiBlYWNoIHJhbmsgaXMgZW50aXJlbHkgYXJiaXRyYXJ5LlxuICovXG5mdW5jdGlvbiBpbml0T3JkZXIoZywgcmFuZG9tKSB7XG4gIHZhciBsYXllcnMgPSBbXTtcblxuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgdmFyIGxheWVyID0gbGF5ZXJzW3ZhbHVlLnJhbmtdO1xuICAgIGlmIChnLmNoaWxkcmVuICYmIGcuY2hpbGRyZW4odSkubGVuZ3RoID4gMCkgcmV0dXJuO1xuICAgIGlmICghbGF5ZXIpIHtcbiAgICAgIGxheWVyID0gbGF5ZXJzW3ZhbHVlLnJhbmtdID0gW107XG4gICAgfVxuICAgIGxheWVyLnB1c2godSk7XG4gIH0pO1xuXG4gIGxheWVycy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgaWYgKHJhbmRvbSkge1xuICAgICAgdXRpbC5zaHVmZmxlKGxheWVyKTtcbiAgICB9XG4gICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7XG4gICAgICBnLm5vZGUodSkub3JkZXIgPSBpO1xuICAgIH0pO1xuICB9KTtcblxuICB2YXIgY2MgPSBjcm9zc0NvdW50KGcpO1xuICBnLmdyYXBoKCkub3JkZXJJbml0Q0MgPSBjYztcbiAgZy5ncmFwaCgpLm9yZGVyQ0MgPSBOdW1iZXIuTUFYX1ZBTFVFO1xufVxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG4vKlxuICAgIERpZ3JhcGggPSByZXF1aXJlKCdncmFwaGxpYicpLkRpZ3JhcGgsXG4gICAgdG9wc29ydCA9IHJlcXVpcmUoJ2dyYXBobGliJykuYWxnLnRvcHNvcnQsXG4gICAgbm9kZXNGcm9tTGlzdCA9IHJlcXVpcmUoJ2dyYXBobGliJykuZmlsdGVyLm5vZGVzRnJvbUxpc3Q7XG4qL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHNvcnRMYXllcjtcblxuLypcbmZ1bmN0aW9uIHNvcnRMYXllcihnLCBjZywgd2VpZ2h0cykge1xuICB2YXIgcmVzdWx0ID0gc29ydExheWVyU3ViZ3JhcGgoZywgbnVsbCwgY2csIHdlaWdodHMpO1xuICByZXN1bHQubGlzdC5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHtcbiAgICBnLm5vZGUodSkub3JkZXIgPSBpO1xuICB9KTtcbiAgcmV0dXJuIHJlc3VsdC5jb25zdHJhaW50R3JhcGg7XG59XG4qL1xuXG5mdW5jdGlvbiBzb3J0TGF5ZXIoZywgY2csIHdlaWdodHMpIHtcbiAgdmFyIG9yZGVyaW5nID0gW107XG4gIHZhciBicyA9IHt9O1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgb3JkZXJpbmdbdmFsdWUub3JkZXJdID0gdTtcbiAgICB2YXIgd3MgPSB3ZWlnaHRzW3VdO1xuICAgIGlmICh3cy5sZW5ndGgpIHtcbiAgICAgIGJzW3VdID0gdXRpbC5zdW0od3MpIC8gd3MubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgdmFyIHRvU29ydCA9IGcubm9kZXMoKS5maWx0ZXIoZnVuY3Rpb24odSkgeyByZXR1cm4gYnNbdV0gIT09IHVuZGVmaW5lZDsgfSk7XG4gIHRvU29ydC5zb3J0KGZ1bmN0aW9uKHgsIHkpIHtcbiAgICByZXR1cm4gYnNbeF0gLSBic1t5XSB8fCBnLm5vZGUoeCkub3JkZXIgLSBnLm5vZGUoeSkub3JkZXI7XG4gIH0pO1xuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gMCwgamwgPSB0b1NvcnQubGVuZ3RoOyBqIDwgamw7ICsraSkge1xuICAgIGlmIChic1tvcmRlcmluZ1tpXV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5ub2RlKHRvU29ydFtqKytdKS5vcmRlciA9IGk7XG4gICAgfVxuICB9XG59XG5cbi8vIFRPT0Q6IHJlLWVuYWJsZSBjb25zdHJhaW5lZCBzb3J0aW5nIG9uY2Ugd2UgaGF2ZSBhIHN0cmF0ZWd5IGZvciBoYW5kbGluZ1xuLy8gdW5kZWZpbmVkIGJhcnljZW50ZXJzLlxuLypcbmZ1bmN0aW9uIHNvcnRMYXllclN1YmdyYXBoKGcsIHNnLCBjZywgd2VpZ2h0cykge1xuICBjZyA9IGNnID8gY2cuZmlsdGVyTm9kZXMobm9kZXNGcm9tTGlzdChnLmNoaWxkcmVuKHNnKSkpIDogbmV3IERpZ3JhcGgoKTtcblxuICB2YXIgbm9kZURhdGEgPSB7fTtcbiAgZy5jaGlsZHJlbihzZykuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgaWYgKGcuY2hpbGRyZW4odSkubGVuZ3RoKSB7XG4gICAgICBub2RlRGF0YVt1XSA9IHNvcnRMYXllclN1YmdyYXBoKGcsIHUsIGNnLCB3ZWlnaHRzKTtcbiAgICAgIG5vZGVEYXRhW3VdLmZpcnN0U0cgPSB1O1xuICAgICAgbm9kZURhdGFbdV0ubGFzdFNHID0gdTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHdzID0gd2VpZ2h0c1t1XTtcbiAgICAgIG5vZGVEYXRhW3VdID0ge1xuICAgICAgICBkZWdyZWU6IHdzLmxlbmd0aCxcbiAgICAgICAgYmFyeWNlbnRlcjogd3MubGVuZ3RoID4gMCA/IHV0aWwuc3VtKHdzKSAvIHdzLmxlbmd0aCA6IDAsXG4gICAgICAgIGxpc3Q6IFt1XVxuICAgICAgfTtcbiAgICB9XG4gIH0pO1xuXG4gIHJlc29sdmVWaW9sYXRlZENvbnN0cmFpbnRzKGcsIGNnLCBub2RlRGF0YSk7XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhub2RlRGF0YSk7XG4gIGtleXMuc29ydChmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIG5vZGVEYXRhW3hdLmJhcnljZW50ZXIgLSBub2RlRGF0YVt5XS5iYXJ5Y2VudGVyO1xuICB9KTtcblxuICB2YXIgcmVzdWx0ID0gIGtleXMubWFwKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIG5vZGVEYXRhW3VdOyB9KVxuICAgICAgICAgICAgICAgICAgICAucmVkdWNlKGZ1bmN0aW9uKGxocywgcmhzKSB7IHJldHVybiBtZXJnZU5vZGVEYXRhKGcsIGxocywgcmhzKTsgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qXG5mdW5jdGlvbiBtZXJnZU5vZGVEYXRhKGcsIGxocywgcmhzKSB7XG4gIHZhciBjZyA9IG1lcmdlRGlncmFwaHMobGhzLmNvbnN0cmFpbnRHcmFwaCwgcmhzLmNvbnN0cmFpbnRHcmFwaCk7XG5cbiAgaWYgKGxocy5sYXN0U0cgIT09IHVuZGVmaW5lZCAmJiByaHMuZmlyc3RTRyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGNnID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNnID0gbmV3IERpZ3JhcGgoKTtcbiAgICB9XG4gICAgaWYgKCFjZy5oYXNOb2RlKGxocy5sYXN0U0cpKSB7IGNnLmFkZE5vZGUobGhzLmxhc3RTRyk7IH1cbiAgICBjZy5hZGROb2RlKHJocy5maXJzdFNHKTtcbiAgICBjZy5hZGRFZGdlKG51bGwsIGxocy5sYXN0U0csIHJocy5maXJzdFNHKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZGVncmVlOiBsaHMuZGVncmVlICsgcmhzLmRlZ3JlZSxcbiAgICBiYXJ5Y2VudGVyOiAobGhzLmJhcnljZW50ZXIgKiBsaHMuZGVncmVlICsgcmhzLmJhcnljZW50ZXIgKiByaHMuZGVncmVlKSAvXG4gICAgICAgICAgICAgICAgKGxocy5kZWdyZWUgKyByaHMuZGVncmVlKSxcbiAgICBsaXN0OiBsaHMubGlzdC5jb25jYXQocmhzLmxpc3QpLFxuICAgIGZpcnN0U0c6IGxocy5maXJzdFNHICE9PSB1bmRlZmluZWQgPyBsaHMuZmlyc3RTRyA6IHJocy5maXJzdFNHLFxuICAgIGxhc3RTRzogcmhzLmxhc3RTRyAhPT0gdW5kZWZpbmVkID8gcmhzLmxhc3RTRyA6IGxocy5sYXN0U0csXG4gICAgY29uc3RyYWludEdyYXBoOiBjZ1xuICB9O1xufVxuXG5mdW5jdGlvbiBtZXJnZURpZ3JhcGhzKGxocywgcmhzKSB7XG4gIGlmIChsaHMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHJocztcbiAgaWYgKHJocyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbGhzO1xuXG4gIGxocyA9IGxocy5jb3B5KCk7XG4gIHJocy5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odSkgeyBsaHMuYWRkTm9kZSh1KTsgfSk7XG4gIHJocy5lZGdlcygpLmZvckVhY2goZnVuY3Rpb24oZSwgdSwgdikgeyBsaHMuYWRkRWRnZShudWxsLCB1LCB2KTsgfSk7XG4gIHJldHVybiBsaHM7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVWaW9sYXRlZENvbnN0cmFpbnRzKGcsIGNnLCBub2RlRGF0YSkge1xuICAvLyBSZW1vdmVzIG5vZGVzIGB1YCBhbmQgYHZgIGZyb20gYGNnYCBhbmQgbWFrZXMgYW55IGVkZ2VzIGluY2lkZW50IG9uIHRoZW1cbiAgLy8gaW5jaWRlbnQgb24gYHdgIGluc3RlYWQuXG4gIGZ1bmN0aW9uIGNvbGxhcHNlTm9kZXModSwgdiwgdykge1xuICAgIC8vIFRPRE8gb3JpZ2luYWwgcGFwZXIgcmVtb3ZlcyBzZWxmIGxvb3BzLCBidXQgaXQgaXMgbm90IG9idmlvdXMgd2hlbiB0aGlzIHdvdWxkIGhhcHBlblxuICAgIGNnLmluRWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICBjZy5kZWxFZGdlKGUpO1xuICAgICAgY2cuYWRkRWRnZShudWxsLCBjZy5zb3VyY2UoZSksIHcpO1xuICAgIH0pO1xuXG4gICAgY2cub3V0RWRnZXModikuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICBjZy5kZWxFZGdlKGUpO1xuICAgICAgY2cuYWRkRWRnZShudWxsLCB3LCBjZy50YXJnZXQoZSkpO1xuICAgIH0pO1xuXG4gICAgY2cuZGVsTm9kZSh1KTtcbiAgICBjZy5kZWxOb2RlKHYpO1xuICB9XG5cbiAgdmFyIHZpb2xhdGVkO1xuICB3aGlsZSAoKHZpb2xhdGVkID0gZmluZFZpb2xhdGVkQ29uc3RyYWludChjZywgbm9kZURhdGEpKSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIHNvdXJjZSA9IGNnLnNvdXJjZSh2aW9sYXRlZCksXG4gICAgICAgIHRhcmdldCA9IGNnLnRhcmdldCh2aW9sYXRlZCk7XG5cbiAgICB2YXIgdjtcbiAgICB3aGlsZSAoKHYgPSBjZy5hZGROb2RlKG51bGwpKSAmJiBnLmhhc05vZGUodikpIHtcbiAgICAgIGNnLmRlbE5vZGUodik7XG4gICAgfVxuXG4gICAgLy8gQ29sbGFwc2UgYmFyeWNlbnRlciBhbmQgbGlzdFxuICAgIG5vZGVEYXRhW3ZdID0gbWVyZ2VOb2RlRGF0YShnLCBub2RlRGF0YVtzb3VyY2VdLCBub2RlRGF0YVt0YXJnZXRdKTtcbiAgICBkZWxldGUgbm9kZURhdGFbc291cmNlXTtcbiAgICBkZWxldGUgbm9kZURhdGFbdGFyZ2V0XTtcblxuICAgIGNvbGxhcHNlTm9kZXMoc291cmNlLCB0YXJnZXQsIHYpO1xuICAgIGlmIChjZy5pbmNpZGVudEVkZ2VzKHYpLmxlbmd0aCA9PT0gMCkgeyBjZy5kZWxOb2RlKHYpOyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZFZpb2xhdGVkQ29uc3RyYWludChjZywgbm9kZURhdGEpIHtcbiAgdmFyIHVzID0gdG9wc29ydChjZyk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdXMubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgdSA9IHVzW2ldO1xuICAgIHZhciBpbkVkZ2VzID0gY2cuaW5FZGdlcyh1KTtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGluRWRnZXMubGVuZ3RoOyArK2opIHtcbiAgICAgIHZhciBlID0gaW5FZGdlc1tqXTtcbiAgICAgIGlmIChub2RlRGF0YVtjZy5zb3VyY2UoZSldLmJhcnljZW50ZXIgPj0gbm9kZURhdGFbdV0uYmFyeWNlbnRlcikge1xuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiovXG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4vKlxuICogVGhlIGFsZ29yaXRobXMgaGVyZSBhcmUgYmFzZWQgb24gQnJhbmRlcyBhbmQgS8O2cGYsIFwiRmFzdCBhbmQgU2ltcGxlXG4gKiBIb3Jpem9udGFsIENvb3JkaW5hdGUgQXNzaWdubWVudFwiLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAvLyBFeHRlcm5hbCBjb25maWd1cmF0aW9uXG4gIHZhciBjb25maWcgPSB7XG4gICAgbm9kZVNlcDogNTAsXG4gICAgZWRnZVNlcDogMTAsXG4gICAgdW5pdmVyc2FsU2VwOiBudWxsLFxuICAgIHJhbmtTZXA6IDMwXG4gIH07XG5cbiAgdmFyIHNlbGYgPSB7fTtcblxuICBzZWxmLm5vZGVTZXAgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnbm9kZVNlcCcpO1xuICBzZWxmLmVkZ2VTZXAgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnZWRnZVNlcCcpO1xuICAvLyBJZiBub3QgbnVsbCB0aGlzIHNlcGFyYXRpb24gdmFsdWUgaXMgdXNlZCBmb3IgYWxsIG5vZGVzIGFuZCBlZGdlc1xuICAvLyByZWdhcmRsZXNzIG9mIHRoZWlyIHdpZHRocy4gYG5vZGVTZXBgIGFuZCBgZWRnZVNlcGAgYXJlIGlnbm9yZWQgd2l0aCB0aGlzXG4gIC8vIG9wdGlvbi5cbiAgc2VsZi51bml2ZXJzYWxTZXAgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAndW5pdmVyc2FsU2VwJyk7XG4gIHNlbGYucmFua1NlcCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdyYW5rU2VwJyk7XG4gIHNlbGYuZGVidWdMZXZlbCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdkZWJ1Z0xldmVsJyk7XG5cbiAgc2VsZi5ydW4gPSBydW47XG5cbiAgcmV0dXJuIHNlbGY7XG5cbiAgZnVuY3Rpb24gcnVuKGcpIHtcbiAgICBnID0gZy5maWx0ZXJOb2Rlcyh1dGlsLmZpbHRlck5vblN1YmdyYXBocyhnKSk7XG5cbiAgICB2YXIgbGF5ZXJpbmcgPSB1dGlsLm9yZGVyaW5nKGcpO1xuXG4gICAgdmFyIGNvbmZsaWN0cyA9IGZpbmRDb25mbGljdHMoZywgbGF5ZXJpbmcpO1xuXG4gICAgdmFyIHhzcyA9IHt9O1xuICAgIFsndScsICdkJ10uZm9yRWFjaChmdW5jdGlvbih2ZXJ0RGlyKSB7XG4gICAgICBpZiAodmVydERpciA9PT0gJ2QnKSBsYXllcmluZy5yZXZlcnNlKCk7XG5cbiAgICAgIFsnbCcsICdyJ10uZm9yRWFjaChmdW5jdGlvbihob3JpekRpcikge1xuICAgICAgICBpZiAoaG9yaXpEaXIgPT09ICdyJykgcmV2ZXJzZUlubmVyT3JkZXIobGF5ZXJpbmcpO1xuXG4gICAgICAgIHZhciBkaXIgPSB2ZXJ0RGlyICsgaG9yaXpEaXI7XG4gICAgICAgIHZhciBhbGlnbiA9IHZlcnRpY2FsQWxpZ25tZW50KGcsIGxheWVyaW5nLCBjb25mbGljdHMsIHZlcnREaXIgPT09ICd1JyA/ICdwcmVkZWNlc3NvcnMnIDogJ3N1Y2Nlc3NvcnMnKTtcbiAgICAgICAgeHNzW2Rpcl09IGhvcml6b250YWxDb21wYWN0aW9uKGcsIGxheWVyaW5nLCBhbGlnbi5wb3MsIGFsaWduLnJvb3QsIGFsaWduLmFsaWduKTtcblxuICAgICAgICBpZiAoY29uZmlnLmRlYnVnTGV2ZWwgPj0gMylcbiAgICAgICAgICBkZWJ1Z1Bvc2l0aW9uaW5nKHZlcnREaXIgKyBob3JpekRpciwgZywgbGF5ZXJpbmcsIHhzc1tkaXJdKTtcblxuICAgICAgICBpZiAoaG9yaXpEaXIgPT09ICdyJykgZmxpcEhvcml6b250YWxseSh4c3NbZGlyXSk7XG5cbiAgICAgICAgaWYgKGhvcml6RGlyID09PSAncicpIHJldmVyc2VJbm5lck9yZGVyKGxheWVyaW5nKTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAodmVydERpciA9PT0gJ2QnKSBsYXllcmluZy5yZXZlcnNlKCk7XG4gICAgfSk7XG5cbiAgICBiYWxhbmNlKGcsIGxheWVyaW5nLCB4c3MpO1xuXG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih2KSB7XG4gICAgICB2YXIgeHMgPSBbXTtcbiAgICAgIGZvciAodmFyIGFsaWdubWVudCBpbiB4c3MpIHtcbiAgICAgICAgdmFyIGFsaWdubWVudFggPSB4c3NbYWxpZ25tZW50XVt2XTtcbiAgICAgICAgcG9zWERlYnVnKGFsaWdubWVudCwgZywgdiwgYWxpZ25tZW50WCk7XG4gICAgICAgIHhzLnB1c2goYWxpZ25tZW50WCk7XG4gICAgICB9XG4gICAgICB4cy5zb3J0KGZ1bmN0aW9uKHgsIHkpIHsgcmV0dXJuIHggLSB5OyB9KTtcbiAgICAgIHBvc1goZywgdiwgKHhzWzFdICsgeHNbMl0pIC8gMik7XG4gICAgfSk7XG5cbiAgICAvLyBBbGlnbiB5IGNvb3JkaW5hdGVzIHdpdGggcmFua3NcbiAgICB2YXIgeSA9IDAsIHJldmVyc2VZID0gZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdCVCcgfHwgZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdSTCc7XG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgdmFyIG1heEhlaWdodCA9IHV0aWwubWF4KGxheWVyLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBoZWlnaHQoZywgdSk7IH0pKTtcbiAgICAgIHkgKz0gbWF4SGVpZ2h0IC8gMjtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgICBwb3NZKGcsIHUsIHJldmVyc2VZID8gLXkgOiB5KTtcbiAgICAgIH0pO1xuICAgICAgeSArPSBtYXhIZWlnaHQgLyAyICsgY29uZmlnLnJhbmtTZXA7XG4gICAgfSk7XG5cbiAgICAvLyBUcmFuc2xhdGUgbGF5b3V0IHNvIHRoYXQgdG9wIGxlZnQgY29ybmVyIG9mIGJvdW5kaW5nIHJlY3RhbmdsZSBoYXNcbiAgICAvLyBjb29yZGluYXRlICgwLCAwKS5cbiAgICB2YXIgbWluWCA9IHV0aWwubWluKGcubm9kZXMoKS5tYXAoZnVuY3Rpb24odSkgeyByZXR1cm4gcG9zWChnLCB1KSAtIHdpZHRoKGcsIHUpIC8gMjsgfSkpO1xuICAgIHZhciBtaW5ZID0gdXRpbC5taW4oZy5ub2RlcygpLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBwb3NZKGcsIHUpIC0gaGVpZ2h0KGcsIHUpIC8gMjsgfSkpO1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgICAgcG9zWChnLCB1LCBwb3NYKGcsIHUpIC0gbWluWCk7XG4gICAgICBwb3NZKGcsIHUsIHBvc1koZywgdSkgLSBtaW5ZKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIEdlbmVyYXRlIGFuIElEIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVwcmVzZW50IGFueSB1bmRpcmVjdGVkIGVkZ2UgdGhhdCBpc1xuICAgKiBpbmNpZGVudCBvbiBgdWAgYW5kIGB2YC5cbiAgICovXG4gIGZ1bmN0aW9uIHVuZGlyRWRnZUlkKHUsIHYpIHtcbiAgICByZXR1cm4gdSA8IHZcbiAgICAgID8gdS50b1N0cmluZygpLmxlbmd0aCArICc6JyArIHUgKyAnLScgKyB2XG4gICAgICA6IHYudG9TdHJpbmcoKS5sZW5ndGggKyAnOicgKyB2ICsgJy0nICsgdTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRDb25mbGljdHMoZywgbGF5ZXJpbmcpIHtcbiAgICB2YXIgY29uZmxpY3RzID0ge30sIC8vIFNldCBvZiBjb25mbGljdGluZyBlZGdlIGlkc1xuICAgICAgICBwb3MgPSB7fSwgICAgICAgLy8gUG9zaXRpb24gb2Ygbm9kZSBpbiBpdHMgbGF5ZXJcbiAgICAgICAgcHJldkxheWVyLFxuICAgICAgICBjdXJyTGF5ZXIsXG4gICAgICAgIGswLCAgICAgLy8gUG9zaXRpb24gb2YgdGhlIGxhc3QgaW5uZXIgc2VnbWVudCBpbiB0aGUgcHJldmlvdXMgbGF5ZXJcbiAgICAgICAgbCwgICAgICAvLyBDdXJyZW50IHBvc2l0aW9uIGluIHRoZSBjdXJyZW50IGxheWVyIChmb3IgaXRlcmF0aW9uIHVwIHRvIGBsMWApXG4gICAgICAgIGsxOyAgICAgLy8gUG9zaXRpb24gb2YgdGhlIG5leHQgaW5uZXIgc2VnbWVudCBpbiB0aGUgcHJldmlvdXMgbGF5ZXIgb3JcbiAgICAgICAgICAgICAgICAvLyB0aGUgcG9zaXRpb24gb2YgdGhlIGxhc3QgZWxlbWVudCBpbiB0aGUgcHJldmlvdXMgbGF5ZXJcblxuICAgIGlmIChsYXllcmluZy5sZW5ndGggPD0gMikgcmV0dXJuIGNvbmZsaWN0cztcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUNvbmZsaWN0cyh2KSB7XG4gICAgICB2YXIgayA9IHBvc1t2XTtcbiAgICAgIGlmIChrIDwgazAgfHwgayA+IGsxKSB7XG4gICAgICAgIGNvbmZsaWN0c1t1bmRpckVkZ2VJZChjdXJyTGF5ZXJbbF0sIHYpXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGF5ZXJpbmdbMV0uZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7IHBvc1t1XSA9IGk7IH0pO1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbGF5ZXJpbmcubGVuZ3RoIC0gMTsgKytpKSB7XG4gICAgICBwcmV2TGF5ZXIgPSBsYXllcmluZ1tpXTtcbiAgICAgIGN1cnJMYXllciA9IGxheWVyaW5nW2krMV07XG4gICAgICBrMCA9IDA7XG4gICAgICBsID0gMDtcblxuICAgICAgLy8gU2NhbiBjdXJyZW50IGxheWVyIGZvciBuZXh0IG5vZGUgdGhhdCBpcyBpbmNpZGVudCB0byBhbiBpbm5lciBzZWdlbWVudFxuICAgICAgLy8gYmV0d2VlbiBsYXllcmluZ1tpKzFdIGFuZCBsYXllcmluZ1tpXS5cbiAgICAgIGZvciAodmFyIGwxID0gMDsgbDEgPCBjdXJyTGF5ZXIubGVuZ3RoOyArK2wxKSB7XG4gICAgICAgIHZhciB1ID0gY3VyckxheWVyW2wxXTsgLy8gTmV4dCBpbm5lciBzZWdtZW50IGluIHRoZSBjdXJyZW50IGxheWVyIG9yXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGFzdCBub2RlIGluIHRoZSBjdXJyZW50IGxheWVyXG4gICAgICAgIHBvc1t1XSA9IGwxO1xuICAgICAgICBrMSA9IHVuZGVmaW5lZDtcblxuICAgICAgICBpZiAoZy5ub2RlKHUpLmR1bW15KSB7XG4gICAgICAgICAgdmFyIHVQcmVkID0gZy5wcmVkZWNlc3NvcnModSlbMF07XG4gICAgICAgICAgLy8gTm90ZTogSW4gdGhlIGNhc2Ugb2Ygc2VsZiBsb29wcyBhbmQgc2lkZXdheXMgZWRnZXMgaXQgaXMgcG9zc2libGVcbiAgICAgICAgICAvLyBmb3IgYSBkdW1teSBub3QgdG8gaGF2ZSBhIHByZWRlY2Vzc29yLlxuICAgICAgICAgIGlmICh1UHJlZCAhPT0gdW5kZWZpbmVkICYmIGcubm9kZSh1UHJlZCkuZHVtbXkpXG4gICAgICAgICAgICBrMSA9IHBvc1t1UHJlZF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGsxID09PSB1bmRlZmluZWQgJiYgbDEgPT09IGN1cnJMYXllci5sZW5ndGggLSAxKVxuICAgICAgICAgIGsxID0gcHJldkxheWVyLmxlbmd0aCAtIDE7XG5cbiAgICAgICAgaWYgKGsxICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBmb3IgKDsgbCA8PSBsMTsgKytsKSB7XG4gICAgICAgICAgICBnLnByZWRlY2Vzc29ycyhjdXJyTGF5ZXJbbF0pLmZvckVhY2godXBkYXRlQ29uZmxpY3RzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgazAgPSBrMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjb25mbGljdHM7XG4gIH1cblxuICBmdW5jdGlvbiB2ZXJ0aWNhbEFsaWdubWVudChnLCBsYXllcmluZywgY29uZmxpY3RzLCByZWxhdGlvbnNoaXApIHtcbiAgICB2YXIgcG9zID0ge30sICAgLy8gUG9zaXRpb24gZm9yIGEgbm9kZSBpbiBpdHMgbGF5ZXJcbiAgICAgICAgcm9vdCA9IHt9LCAgLy8gUm9vdCBvZiB0aGUgYmxvY2sgdGhhdCB0aGUgbm9kZSBwYXJ0aWNpcGF0ZXMgaW5cbiAgICAgICAgYWxpZ24gPSB7fTsgLy8gUG9pbnRzIHRvIHRoZSBuZXh0IG5vZGUgaW4gdGhlIGJsb2NrIG9yLCBpZiB0aGUgbGFzdFxuICAgICAgICAgICAgICAgICAgICAvLyBlbGVtZW50IGluIHRoZSBibG9jaywgcG9pbnRzIHRvIHRoZSBmaXJzdCBibG9jaydzIHJvb3RcblxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odSwgaSkge1xuICAgICAgICByb290W3VdID0gdTtcbiAgICAgICAgYWxpZ25bdV0gPSB1O1xuICAgICAgICBwb3NbdV0gPSBpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICB2YXIgcHJldklkeCA9IC0xO1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgIHZhciByZWxhdGVkID0gZ1tyZWxhdGlvbnNoaXBdKHYpLCAvLyBBZGphY2VudCBub2RlcyBmcm9tIHRoZSBwcmV2aW91cyBsYXllclxuICAgICAgICAgICAgbWlkOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlIG1pZCBwb2ludCBpbiB0aGUgcmVsYXRlZCBhcnJheVxuXG4gICAgICAgIGlmIChyZWxhdGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZWxhdGVkLnNvcnQoZnVuY3Rpb24oeCwgeSkgeyByZXR1cm4gcG9zW3hdIC0gcG9zW3ldOyB9KTtcbiAgICAgICAgICBtaWQgPSAocmVsYXRlZC5sZW5ndGggLSAxKSAvIDI7XG4gICAgICAgICAgcmVsYXRlZC5zbGljZShNYXRoLmZsb29yKG1pZCksIE1hdGguY2VpbChtaWQpICsgMSkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAgICAgICBpZiAoYWxpZ25bdl0gPT09IHYpIHtcbiAgICAgICAgICAgICAgaWYgKCFjb25mbGljdHNbdW5kaXJFZGdlSWQodSwgdildICYmIHByZXZJZHggPCBwb3NbdV0pIHtcbiAgICAgICAgICAgICAgICBhbGlnblt1XSA9IHY7XG4gICAgICAgICAgICAgICAgYWxpZ25bdl0gPSByb290W3ZdID0gcm9vdFt1XTtcbiAgICAgICAgICAgICAgICBwcmV2SWR4ID0gcG9zW3VdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgcG9zOiBwb3MsIHJvb3Q6IHJvb3QsIGFsaWduOiBhbGlnbiB9O1xuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBkZXZpYXRlcyBmcm9tIHRoZSBzdGFuZGFyZCBCSyBhbGdvcml0aG0gaW4gdHdvIHdheXMuIEZpcnN0XG4gIC8vIGl0IHRha2VzIGludG8gYWNjb3VudCB0aGUgc2l6ZSBvZiB0aGUgbm9kZXMuIFNlY29uZCBpdCBpbmNsdWRlcyBhIGZpeCB0b1xuICAvLyB0aGUgb3JpZ2luYWwgYWxnb3JpdGhtIHRoYXQgaXMgZGVzY3JpYmVkIGluIENhcnN0ZW5zLCBcIk5vZGUgYW5kIExhYmVsXG4gIC8vIFBsYWNlbWVudCBpbiBhIExheWVyZWQgTGF5b3V0IEFsZ29yaXRobVwiLlxuICBmdW5jdGlvbiBob3Jpem9udGFsQ29tcGFjdGlvbihnLCBsYXllcmluZywgcG9zLCByb290LCBhbGlnbikge1xuICAgIHZhciBzaW5rID0ge30sICAgICAgIC8vIE1hcHBpbmcgb2Ygbm9kZSBpZCAtPiBzaW5rIG5vZGUgaWQgZm9yIGNsYXNzXG4gICAgICAgIG1heWJlU2hpZnQgPSB7fSwgLy8gTWFwcGluZyBvZiBzaW5rIG5vZGUgaWQgLT4geyBjbGFzcyBub2RlIGlkLCBtaW4gc2hpZnQgfVxuICAgICAgICBzaGlmdCA9IHt9LCAgICAgIC8vIE1hcHBpbmcgb2Ygc2luayBub2RlIGlkIC0+IHNoaWZ0XG4gICAgICAgIHByZWQgPSB7fSwgICAgICAgLy8gTWFwcGluZyBvZiBub2RlIGlkIC0+IHByZWRlY2Vzc29yIG5vZGUgKG9yIG51bGwpXG4gICAgICAgIHhzID0ge307ICAgICAgICAgLy8gQ2FsY3VsYXRlZCBYIHBvc2l0aW9uc1xuXG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7XG4gICAgICAgIHNpbmtbdV0gPSB1O1xuICAgICAgICBtYXliZVNoaWZ0W3VdID0ge307XG4gICAgICAgIGlmIChpID4gMClcbiAgICAgICAgICBwcmVkW3VdID0gbGF5ZXJbaSAtIDFdO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVTaGlmdCh0b1NoaWZ0LCBuZWlnaGJvciwgZGVsdGEpIHtcbiAgICAgIGlmICghKG5laWdoYm9yIGluIG1heWJlU2hpZnRbdG9TaGlmdF0pKSB7XG4gICAgICAgIG1heWJlU2hpZnRbdG9TaGlmdF1bbmVpZ2hib3JdID0gZGVsdGE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtYXliZVNoaWZ0W3RvU2hpZnRdW25laWdoYm9yXSA9IE1hdGgubWluKG1heWJlU2hpZnRbdG9TaGlmdF1bbmVpZ2hib3JdLCBkZWx0YSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGxhY2VCbG9jayh2KSB7XG4gICAgICBpZiAoISh2IGluIHhzKSkge1xuICAgICAgICB4c1t2XSA9IDA7XG4gICAgICAgIHZhciB3ID0gdjtcbiAgICAgICAgZG8ge1xuICAgICAgICAgIGlmIChwb3Nbd10gPiAwKSB7XG4gICAgICAgICAgICB2YXIgdSA9IHJvb3RbcHJlZFt3XV07XG4gICAgICAgICAgICBwbGFjZUJsb2NrKHUpO1xuICAgICAgICAgICAgaWYgKHNpbmtbdl0gPT09IHYpIHtcbiAgICAgICAgICAgICAgc2lua1t2XSA9IHNpbmtbdV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgZGVsdGEgPSBzZXAoZywgcHJlZFt3XSkgKyBzZXAoZywgdyk7XG4gICAgICAgICAgICBpZiAoc2lua1t2XSAhPT0gc2lua1t1XSkge1xuICAgICAgICAgICAgICB1cGRhdGVTaGlmdChzaW5rW3VdLCBzaW5rW3ZdLCB4c1t2XSAtIHhzW3VdIC0gZGVsdGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgeHNbdl0gPSBNYXRoLm1heCh4c1t2XSwgeHNbdV0gKyBkZWx0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHcgPSBhbGlnblt3XTtcbiAgICAgICAgfSB3aGlsZSAodyAhPT0gdik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUm9vdCBjb29yZGluYXRlcyByZWxhdGl2ZSB0byBzaW5rXG4gICAgdXRpbC52YWx1ZXMocm9vdCkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICBwbGFjZUJsb2NrKHYpO1xuICAgIH0pO1xuXG4gICAgLy8gQWJzb2x1dGUgY29vcmRpbmF0ZXNcbiAgICAvLyBUaGVyZSBpcyBhbiBhc3N1bXB0aW9uIGhlcmUgdGhhdCB3ZSd2ZSByZXNvbHZlZCBzaGlmdHMgZm9yIGFueSBjbGFzc2VzXG4gICAgLy8gdGhhdCBiZWdpbiBhdCBhbiBlYXJsaWVyIGxheWVyLiBXZSBndWFyYW50ZWUgdGhpcyBieSB2aXNpdGluZyBsYXllcnMgaW5cbiAgICAvLyBvcmRlci5cbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgeHNbdl0gPSB4c1tyb290W3ZdXTtcbiAgICAgICAgaWYgKHYgPT09IHJvb3Rbdl0gJiYgdiA9PT0gc2lua1t2XSkge1xuICAgICAgICAgIHZhciBtaW5TaGlmdCA9IDA7XG4gICAgICAgICAgaWYgKHYgaW4gbWF5YmVTaGlmdCAmJiBPYmplY3Qua2V5cyhtYXliZVNoaWZ0W3ZdKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBtaW5TaGlmdCA9IHV0aWwubWluKE9iamVjdC5rZXlzKG1heWJlU2hpZnRbdl0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKHUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1heWJlU2hpZnRbdl1bdV0gKyAodSBpbiBzaGlmdCA/IHNoaWZ0W3VdIDogMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzaGlmdFt2XSA9IG1pblNoaWZ0O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgICB4c1t2XSArPSBzaGlmdFtzaW5rW3Jvb3Rbdl1dXSB8fCAwO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4geHM7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5kTWluQ29vcmQoZywgbGF5ZXJpbmcsIHhzKSB7XG4gICAgcmV0dXJuIHV0aWwubWluKGxheWVyaW5nLm1hcChmdW5jdGlvbihsYXllcikge1xuICAgICAgdmFyIHUgPSBsYXllclswXTtcbiAgICAgIHJldHVybiB4c1t1XTtcbiAgICB9KSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5kTWF4Q29vcmQoZywgbGF5ZXJpbmcsIHhzKSB7XG4gICAgcmV0dXJuIHV0aWwubWF4KGxheWVyaW5nLm1hcChmdW5jdGlvbihsYXllcikge1xuICAgICAgdmFyIHUgPSBsYXllcltsYXllci5sZW5ndGggLSAxXTtcbiAgICAgIHJldHVybiB4c1t1XTtcbiAgICB9KSk7XG4gIH1cblxuICBmdW5jdGlvbiBiYWxhbmNlKGcsIGxheWVyaW5nLCB4c3MpIHtcbiAgICB2YXIgbWluID0ge30sICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1pbiBjb29yZGluYXRlIGZvciB0aGUgYWxpZ25tZW50XG4gICAgICAgIG1heCA9IHt9LCAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNYXggY29vcmRpbmF0ZSBmb3IgdGhlIGFsZ2lubWVudFxuICAgICAgICBzbWFsbGVzdEFsaWdubWVudCxcbiAgICAgICAgc2hpZnQgPSB7fTsgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFtb3VudCB0byBzaGlmdCBhIGdpdmVuIGFsaWdubWVudFxuXG4gICAgZnVuY3Rpb24gdXBkYXRlQWxpZ25tZW50KHYpIHtcbiAgICAgIHhzc1thbGlnbm1lbnRdW3ZdICs9IHNoaWZ0W2FsaWdubWVudF07XG4gICAgfVxuXG4gICAgdmFyIHNtYWxsZXN0ID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgIGZvciAodmFyIGFsaWdubWVudCBpbiB4c3MpIHtcbiAgICAgIHZhciB4cyA9IHhzc1thbGlnbm1lbnRdO1xuICAgICAgbWluW2FsaWdubWVudF0gPSBmaW5kTWluQ29vcmQoZywgbGF5ZXJpbmcsIHhzKTtcbiAgICAgIG1heFthbGlnbm1lbnRdID0gZmluZE1heENvb3JkKGcsIGxheWVyaW5nLCB4cyk7XG4gICAgICB2YXIgdyA9IG1heFthbGlnbm1lbnRdIC0gbWluW2FsaWdubWVudF07XG4gICAgICBpZiAodyA8IHNtYWxsZXN0KSB7XG4gICAgICAgIHNtYWxsZXN0ID0gdztcbiAgICAgICAgc21hbGxlc3RBbGlnbm1lbnQgPSBhbGlnbm1lbnQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRGV0ZXJtaW5lIGhvdyBtdWNoIHRvIGFkanVzdCBwb3NpdGlvbmluZyBmb3IgZWFjaCBhbGlnbm1lbnRcbiAgICBbJ3UnLCAnZCddLmZvckVhY2goZnVuY3Rpb24odmVydERpcikge1xuICAgICAgWydsJywgJ3InXS5mb3JFYWNoKGZ1bmN0aW9uKGhvcml6RGlyKSB7XG4gICAgICAgIHZhciBhbGlnbm1lbnQgPSB2ZXJ0RGlyICsgaG9yaXpEaXI7XG4gICAgICAgIHNoaWZ0W2FsaWdubWVudF0gPSBob3JpekRpciA9PT0gJ2wnXG4gICAgICAgICAgICA/IG1pbltzbWFsbGVzdEFsaWdubWVudF0gLSBtaW5bYWxpZ25tZW50XVxuICAgICAgICAgICAgOiBtYXhbc21hbGxlc3RBbGlnbm1lbnRdIC0gbWF4W2FsaWdubWVudF07XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIEZpbmQgYXZlcmFnZSBvZiBtZWRpYW5zIGZvciB4c3MgYXJyYXlcbiAgICBmb3IgKGFsaWdubWVudCBpbiB4c3MpIHtcbiAgICAgIGcuZWFjaE5vZGUodXBkYXRlQWxpZ25tZW50KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBmbGlwSG9yaXpvbnRhbGx5KHhzKSB7XG4gICAgZm9yICh2YXIgdSBpbiB4cykge1xuICAgICAgeHNbdV0gPSAteHNbdV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmV2ZXJzZUlubmVyT3JkZXIobGF5ZXJpbmcpIHtcbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICBsYXllci5yZXZlcnNlKCk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiB3aWR0aChnLCB1KSB7XG4gICAgc3dpdGNoIChnLmdyYXBoKCkucmFua0Rpcikge1xuICAgICAgY2FzZSAnTFInOiByZXR1cm4gZy5ub2RlKHUpLmhlaWdodDtcbiAgICAgIGNhc2UgJ1JMJzogcmV0dXJuIGcubm9kZSh1KS5oZWlnaHQ7XG4gICAgICBkZWZhdWx0OiAgIHJldHVybiBnLm5vZGUodSkud2lkdGg7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGVpZ2h0KGcsIHUpIHtcbiAgICBzd2l0Y2goZy5ncmFwaCgpLnJhbmtEaXIpIHtcbiAgICAgIGNhc2UgJ0xSJzogcmV0dXJuIGcubm9kZSh1KS53aWR0aDtcbiAgICAgIGNhc2UgJ1JMJzogcmV0dXJuIGcubm9kZSh1KS53aWR0aDtcbiAgICAgIGRlZmF1bHQ6ICAgcmV0dXJuIGcubm9kZSh1KS5oZWlnaHQ7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2VwKGcsIHUpIHtcbiAgICBpZiAoY29uZmlnLnVuaXZlcnNhbFNlcCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGNvbmZpZy51bml2ZXJzYWxTZXA7XG4gICAgfVxuICAgIHZhciB3ID0gd2lkdGgoZywgdSk7XG4gICAgdmFyIHMgPSBnLm5vZGUodSkuZHVtbXkgPyBjb25maWcuZWRnZVNlcCA6IGNvbmZpZy5ub2RlU2VwO1xuICAgIHJldHVybiAodyArIHMpIC8gMjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc1goZywgdSwgeCkge1xuICAgIGlmIChnLmdyYXBoKCkucmFua0RpciA9PT0gJ0xSJyB8fCBnLmdyYXBoKCkucmFua0RpciA9PT0gJ1JMJykge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSkueTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KS55ID0geDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSkueDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KS54ID0geDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwb3NYRGVidWcobmFtZSwgZywgdSwgeCkge1xuICAgIGlmIChnLmdyYXBoKCkucmFua0RpciA9PT0gJ0xSJyB8fCBnLmdyYXBoKCkucmFua0RpciA9PT0gJ1JMJykge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSlbbmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSlbbmFtZV0gPSB4O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KVtuYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KVtuYW1lXSA9IHg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcG9zWShnLCB1LCB5KSB7XG4gICAgaWYgKGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnTFInIHx8IGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnUkwnKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KS54O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpLnggPSB5O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KS55O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpLnkgPSB5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlYnVnUG9zaXRpb25pbmcoYWxpZ24sIGcsIGxheWVyaW5nLCB4cykge1xuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obCwgbGkpIHtcbiAgICAgIHZhciB1LCB4VTtcbiAgICAgIGwuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgIHZhciB4ViA9IHhzW3ZdO1xuICAgICAgICBpZiAodSkge1xuICAgICAgICAgIHZhciBzID0gc2VwKGcsIHUpICsgc2VwKGcsIHYpO1xuICAgICAgICAgIGlmICh4ViAtIHhVIDwgcylcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQb3NpdGlvbiBwaGFzZTogc2VwIHZpb2xhdGlvbi4gQWxpZ246ICcgKyBhbGlnbiArICcuIExheWVyOiAnICsgbGkgKyAnLiAnICtcbiAgICAgICAgICAgICAgJ1U6ICcgKyB1ICsgJyBWOiAnICsgdiArICcuIEFjdHVhbCBzZXA6ICcgKyAoeFYgLSB4VSkgKyAnIEV4cGVjdGVkIHNlcDogJyArIHMpO1xuICAgICAgICB9XG4gICAgICAgIHUgPSB2O1xuICAgICAgICB4VSA9IHhWO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn07XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGFjeWNsaWMgPSByZXF1aXJlKCcuL3JhbmsvYWN5Y2xpYycpLFxuICAgIGluaXRSYW5rID0gcmVxdWlyZSgnLi9yYW5rL2luaXRSYW5rJyksXG4gICAgZmVhc2libGVUcmVlID0gcmVxdWlyZSgnLi9yYW5rL2ZlYXNpYmxlVHJlZScpLFxuICAgIGNvbnN0cmFpbnRzID0gcmVxdWlyZSgnLi9yYW5rL2NvbnN0cmFpbnRzJyksXG4gICAgc2ltcGxleCA9IHJlcXVpcmUoJy4vcmFuay9zaW1wbGV4JyksXG4gICAgY29tcG9uZW50cyA9IHJlcXVpcmUoJ2dyYXBobGliJykuYWxnLmNvbXBvbmVudHMsXG4gICAgZmlsdGVyID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5maWx0ZXI7XG5cbmV4cG9ydHMucnVuID0gcnVuO1xuZXhwb3J0cy5yZXN0b3JlRWRnZXMgPSByZXN0b3JlRWRnZXM7XG5cbi8qXG4gKiBIZXVyaXN0aWMgZnVuY3Rpb24gdGhhdCBhc3NpZ25zIGEgcmFuayB0byBlYWNoIG5vZGUgb2YgdGhlIGlucHV0IGdyYXBoIHdpdGhcbiAqIHRoZSBpbnRlbnQgb2YgbWluaW1pemluZyBlZGdlIGxlbmd0aHMsIHdoaWxlIHJlc3BlY3RpbmcgdGhlIGBtaW5MZW5gXG4gKiBhdHRyaWJ1dGUgb2YgaW5jaWRlbnQgZWRnZXMuXG4gKlxuICogUHJlcmVxdWlzaXRlczpcbiAqXG4gKiAgKiBFYWNoIGVkZ2UgaW4gdGhlIGlucHV0IGdyYXBoIG11c3QgaGF2ZSBhbiBhc3NpZ25lZCAnbWluTGVuJyBhdHRyaWJ1dGVcbiAqL1xuZnVuY3Rpb24gcnVuKGcsIHVzZVNpbXBsZXgpIHtcbiAgZXhwYW5kU2VsZkxvb3BzKGcpO1xuXG4gIC8vIElmIHRoZXJlIGFyZSByYW5rIGNvbnN0cmFpbnRzIG9uIG5vZGVzLCB0aGVuIGJ1aWxkIGEgbmV3IGdyYXBoIHRoYXRcbiAgLy8gZW5jb2RlcyB0aGUgY29uc3RyYWludHMuXG4gIHV0aWwudGltZSgnY29uc3RyYWludHMuYXBwbHknLCBjb25zdHJhaW50cy5hcHBseSkoZyk7XG5cbiAgZXhwYW5kU2lkZXdheXNFZGdlcyhnKTtcblxuICAvLyBSZXZlcnNlIGVkZ2VzIHRvIGdldCBhbiBhY3ljbGljIGdyYXBoLCB3ZSBrZWVwIHRoZSBncmFwaCBpbiBhbiBhY3ljbGljXG4gIC8vIHN0YXRlIHVudGlsIHRoZSB2ZXJ5IGVuZC5cbiAgdXRpbC50aW1lKCdhY3ljbGljJywgYWN5Y2xpYykoZyk7XG5cbiAgLy8gQ29udmVydCB0aGUgZ3JhcGggaW50byBhIGZsYXQgZ3JhcGggZm9yIHJhbmtpbmdcbiAgdmFyIGZsYXRHcmFwaCA9IGcuZmlsdGVyTm9kZXModXRpbC5maWx0ZXJOb25TdWJncmFwaHMoZykpO1xuXG4gIC8vIEFzc2lnbiBhbiBpbml0aWFsIHJhbmtpbmcgdXNpbmcgREZTLlxuICBpbml0UmFuayhmbGF0R3JhcGgpO1xuXG4gIC8vIEZvciBlYWNoIGNvbXBvbmVudCBpbXByb3ZlIHRoZSBhc3NpZ25lZCByYW5rcy5cbiAgY29tcG9uZW50cyhmbGF0R3JhcGgpLmZvckVhY2goZnVuY3Rpb24oY21wdCkge1xuICAgIHZhciBzdWJncmFwaCA9IGZsYXRHcmFwaC5maWx0ZXJOb2RlcyhmaWx0ZXIubm9kZXNGcm9tTGlzdChjbXB0KSk7XG4gICAgcmFua0NvbXBvbmVudChzdWJncmFwaCwgdXNlU2ltcGxleCk7XG4gIH0pO1xuXG4gIC8vIFJlbGF4IG9yaWdpbmFsIGNvbnN0cmFpbnRzXG4gIHV0aWwudGltZSgnY29uc3RyYWludHMucmVsYXgnLCBjb25zdHJhaW50cy5yZWxheChnKSk7XG5cbiAgLy8gV2hlbiBoYW5kbGluZyBub2RlcyB3aXRoIGNvbnN0cmFpbmVkIHJhbmtzIGl0IGlzIHBvc3NpYmxlIHRvIGVuZCB1cCB3aXRoXG4gIC8vIGVkZ2VzIHRoYXQgcG9pbnQgdG8gcHJldmlvdXMgcmFua3MuIE1vc3Qgb2YgdGhlIHN1YnNlcXVlbnQgYWxnb3JpdGhtcyBhc3N1bWVcbiAgLy8gdGhhdCBlZGdlcyBhcmUgcG9pbnRpbmcgdG8gc3VjY2Vzc2l2ZSByYW5rcyBvbmx5LiBIZXJlIHdlIHJldmVyc2UgYW55IFwiYmFja1xuICAvLyBlZGdlc1wiIGFuZCBtYXJrIHRoZW0gYXMgc3VjaC4gVGhlIGFjeWNsaWMgYWxnb3JpdGhtIHdpbGwgcmV2ZXJzZSB0aGVtIGFzIGFcbiAgLy8gcG9zdCBwcm9jZXNzaW5nIHN0ZXAuXG4gIHV0aWwudGltZSgncmVvcmllbnRFZGdlcycsIHJlb3JpZW50RWRnZXMpKGcpO1xufVxuXG5mdW5jdGlvbiByZXN0b3JlRWRnZXMoZykge1xuICBhY3ljbGljLnVuZG8oZyk7XG59XG5cbi8qXG4gKiBFeHBhbmQgc2VsZiBsb29wcyBpbnRvIHRocmVlIGR1bW15IG5vZGVzLiBPbmUgd2lsbCBzaXQgYWJvdmUgdGhlIGluY2lkZW50XG4gKiBub2RlLCBvbmUgd2lsbCBiZSBhdCB0aGUgc2FtZSBsZXZlbCwgYW5kIG9uZSBiZWxvdy4gVGhlIHJlc3VsdCBsb29rcyBsaWtlOlxuICpcbiAqICAgICAgICAgLy0tPC0teC0tLT4tLVxcXG4gKiAgICAgbm9kZSAgICAgICAgICAgICAgeVxuICogICAgICAgICBcXC0tPC0tei0tLT4tLS9cbiAqXG4gKiBEdW1teSBub2RlcyB4LCB5LCB6IGdpdmUgdXMgdGhlIHNoYXBlIG9mIGEgbG9vcCBhbmQgbm9kZSB5IGlzIHdoZXJlIHdlIHBsYWNlXG4gKiB0aGUgbGFiZWwuXG4gKlxuICogVE9ETzogY29uc29saWRhdGUga25vd2xlZGdlIG9mIGR1bW15IG5vZGUgY29uc3RydWN0aW9uLlxuICogVE9ETzogc3VwcG9ydCBtaW5MZW4gPSAyXG4gKi9cbmZ1bmN0aW9uIGV4cGFuZFNlbGZMb29wcyhnKSB7XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgYSkge1xuICAgIGlmICh1ID09PSB2KSB7XG4gICAgICB2YXIgeCA9IGFkZER1bW15Tm9kZShnLCBlLCB1LCB2LCBhLCAwLCBmYWxzZSksXG4gICAgICAgICAgeSA9IGFkZER1bW15Tm9kZShnLCBlLCB1LCB2LCBhLCAxLCB0cnVlKSxcbiAgICAgICAgICB6ID0gYWRkRHVtbXlOb2RlKGcsIGUsIHUsIHYsIGEsIDIsIGZhbHNlKTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB4LCB1LCB7bWluTGVuOiAxLCBzZWxmTG9vcDogdHJ1ZX0pO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHgsIHksIHttaW5MZW46IDEsIHNlbGZMb29wOiB0cnVlfSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgeiwge21pbkxlbjogMSwgc2VsZkxvb3A6IHRydWV9KTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB5LCB6LCB7bWluTGVuOiAxLCBzZWxmTG9vcDogdHJ1ZX0pO1xuICAgICAgZy5kZWxFZGdlKGUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGV4cGFuZFNpZGV3YXlzRWRnZXMoZykge1xuICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIGEpIHtcbiAgICBpZiAodSA9PT0gdikge1xuICAgICAgdmFyIG9yaWdFZGdlID0gYS5vcmlnaW5hbEVkZ2UsXG4gICAgICAgICAgZHVtbXkgPSBhZGREdW1teU5vZGUoZywgb3JpZ0VkZ2UuZSwgb3JpZ0VkZ2UudSwgb3JpZ0VkZ2Uudiwgb3JpZ0VkZ2UudmFsdWUsIDAsIHRydWUpO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIGR1bW15LCB7bWluTGVuOiAxfSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgZHVtbXksIHYsIHttaW5MZW46IDF9KTtcbiAgICAgIGcuZGVsRWRnZShlKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhZGREdW1teU5vZGUoZywgZSwgdSwgdiwgYSwgaW5kZXgsIGlzTGFiZWwpIHtcbiAgcmV0dXJuIGcuYWRkTm9kZShudWxsLCB7XG4gICAgd2lkdGg6IGlzTGFiZWwgPyBhLndpZHRoIDogMCxcbiAgICBoZWlnaHQ6IGlzTGFiZWwgPyBhLmhlaWdodCA6IDAsXG4gICAgZWRnZTogeyBpZDogZSwgc291cmNlOiB1LCB0YXJnZXQ6IHYsIGF0dHJzOiBhIH0sXG4gICAgZHVtbXk6IHRydWUsXG4gICAgaW5kZXg6IGluZGV4XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZW9yaWVudEVkZ2VzKGcpIHtcbiAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGlmIChnLm5vZGUodSkucmFuayA+IGcubm9kZSh2KS5yYW5rKSB7XG4gICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgICB2YWx1ZS5yZXZlcnNlZCA9IHRydWU7XG4gICAgICBnLmFkZEVkZ2UoZSwgdiwgdSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJhbmtDb21wb25lbnQoc3ViZ3JhcGgsIHVzZVNpbXBsZXgpIHtcbiAgdmFyIHNwYW5uaW5nVHJlZSA9IGZlYXNpYmxlVHJlZShzdWJncmFwaCk7XG5cbiAgaWYgKHVzZVNpbXBsZXgpIHtcbiAgICB1dGlsLmxvZygxLCAnVXNpbmcgbmV0d29yayBzaW1wbGV4IGZvciByYW5raW5nJyk7XG4gICAgc2ltcGxleChzdWJncmFwaCwgc3Bhbm5pbmdUcmVlKTtcbiAgfVxuICBub3JtYWxpemUoc3ViZ3JhcGgpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemUoZykge1xuICB2YXIgbSA9IHV0aWwubWluKGcubm9kZXMoKS5tYXAoZnVuY3Rpb24odSkgeyByZXR1cm4gZy5ub2RlKHUpLnJhbms7IH0pKTtcbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCBub2RlKSB7IG5vZGUucmFuayAtPSBtOyB9KTtcbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFjeWNsaWM7XG5tb2R1bGUuZXhwb3J0cy51bmRvID0gdW5kbztcblxuLypcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYSBkaXJlY3RlZCBncmFwaCB0aGF0IG1heSBoYXZlIGN5Y2xlcyBhbmQgcmV2ZXJzZXMgZWRnZXNcbiAqIGFzIGFwcHJvcHJpYXRlIHRvIGJyZWFrIHRoZXNlIGN5Y2xlcy4gRWFjaCByZXZlcnNlZCBlZGdlIGlzIGFzc2lnbmVkIGFcbiAqIGByZXZlcnNlZGAgYXR0cmlidXRlIHdpdGggdGhlIHZhbHVlIGB0cnVlYC5cbiAqXG4gKiBUaGVyZSBzaG91bGQgYmUgbm8gc2VsZiBsb29wcyBpbiB0aGUgZ3JhcGguXG4gKi9cbmZ1bmN0aW9uIGFjeWNsaWMoZykge1xuICB2YXIgb25TdGFjayA9IHt9LFxuICAgICAgdmlzaXRlZCA9IHt9LFxuICAgICAgcmV2ZXJzZUNvdW50ID0gMDtcbiAgXG4gIGZ1bmN0aW9uIGRmcyh1KSB7XG4gICAgaWYgKHUgaW4gdmlzaXRlZCkgcmV0dXJuO1xuICAgIHZpc2l0ZWRbdV0gPSBvblN0YWNrW3VdID0gdHJ1ZTtcbiAgICBnLm91dEVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgICAgdmFyIHQgPSBnLnRhcmdldChlKSxcbiAgICAgICAgICB2YWx1ZTtcblxuICAgICAgaWYgKHUgPT09IHQpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignV2FybmluZzogZm91bmQgc2VsZiBsb29wIFwiJyArIGUgKyAnXCIgZm9yIG5vZGUgXCInICsgdSArICdcIicpO1xuICAgICAgfSBlbHNlIGlmICh0IGluIG9uU3RhY2spIHtcbiAgICAgICAgdmFsdWUgPSBnLmVkZ2UoZSk7XG4gICAgICAgIGcuZGVsRWRnZShlKTtcbiAgICAgICAgdmFsdWUucmV2ZXJzZWQgPSB0cnVlO1xuICAgICAgICArK3JldmVyc2VDb3VudDtcbiAgICAgICAgZy5hZGRFZGdlKGUsIHQsIHUsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRmcyh0KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlbGV0ZSBvblN0YWNrW3VdO1xuICB9XG5cbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7IGRmcyh1KTsgfSk7XG5cbiAgdXRpbC5sb2coMiwgJ0FjeWNsaWMgUGhhc2U6IHJldmVyc2VkICcgKyByZXZlcnNlQ291bnQgKyAnIGVkZ2UocyknKTtcblxuICByZXR1cm4gcmV2ZXJzZUNvdW50O1xufVxuXG4vKlxuICogR2l2ZW4gYSBncmFwaCB0aGF0IGhhcyBoYWQgdGhlIGFjeWNsaWMgb3BlcmF0aW9uIGFwcGxpZWQsIHRoaXMgZnVuY3Rpb25cbiAqIHVuZG9lcyB0aGF0IG9wZXJhdGlvbi4gTW9yZSBzcGVjaWZpY2FsbHksIGFueSBlZGdlIHdpdGggdGhlIGByZXZlcnNlZGBcbiAqIGF0dHJpYnV0ZSBpcyBhZ2FpbiByZXZlcnNlZCB0byByZXN0b3JlIHRoZSBvcmlnaW5hbCBkaXJlY3Rpb24gb2YgdGhlIGVkZ2UuXG4gKi9cbmZ1bmN0aW9uIHVuZG8oZykge1xuICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHMsIHQsIGEpIHtcbiAgICBpZiAoYS5yZXZlcnNlZCkge1xuICAgICAgZGVsZXRlIGEucmV2ZXJzZWQ7XG4gICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgICBnLmFkZEVkZ2UoZSwgdCwgcywgYSk7XG4gICAgfVxuICB9KTtcbn1cbiIsImV4cG9ydHMuYXBwbHkgPSBmdW5jdGlvbihnKSB7XG4gIGZ1bmN0aW9uIGRmcyhzZykge1xuICAgIHZhciByYW5rU2V0cyA9IHt9O1xuICAgIGcuY2hpbGRyZW4oc2cpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgaWYgKGcuY2hpbGRyZW4odSkubGVuZ3RoKSB7XG4gICAgICAgIGRmcyh1KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgdmFsdWUgPSBnLm5vZGUodSksXG4gICAgICAgICAgcHJlZlJhbmsgPSB2YWx1ZS5wcmVmUmFuaztcbiAgICAgIGlmIChwcmVmUmFuayAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICghY2hlY2tTdXBwb3J0ZWRQcmVmUmFuayhwcmVmUmFuaykpIHsgcmV0dXJuOyB9XG5cbiAgICAgICAgaWYgKCEocHJlZlJhbmsgaW4gcmFua1NldHMpKSB7XG4gICAgICAgICAgcmFua1NldHMucHJlZlJhbmsgPSBbdV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmFua1NldHMucHJlZlJhbmsucHVzaCh1KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBuZXdVID0gcmFua1NldHNbcHJlZlJhbmtdO1xuICAgICAgICBpZiAobmV3VSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbmV3VSA9IHJhbmtTZXRzW3ByZWZSYW5rXSA9IGcuYWRkTm9kZShudWxsLCB7IG9yaWdpbmFsTm9kZXM6IFtdIH0pO1xuICAgICAgICAgIGcucGFyZW50KG5ld1UsIHNnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlZGlyZWN0SW5FZGdlcyhnLCB1LCBuZXdVLCBwcmVmUmFuayA9PT0gJ21pbicpO1xuICAgICAgICByZWRpcmVjdE91dEVkZ2VzKGcsIHUsIG5ld1UsIHByZWZSYW5rID09PSAnbWF4Jyk7XG5cbiAgICAgICAgLy8gU2F2ZSBvcmlnaW5hbCBub2RlIGFuZCByZW1vdmUgaXQgZnJvbSByZWR1Y2VkIGdyYXBoXG4gICAgICAgIGcubm9kZShuZXdVKS5vcmlnaW5hbE5vZGVzLnB1c2goeyB1OiB1LCB2YWx1ZTogdmFsdWUsIHBhcmVudDogc2cgfSk7XG4gICAgICAgIGcuZGVsTm9kZSh1KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGFkZExpZ2h0RWRnZXNGcm9tTWluTm9kZShnLCBzZywgcmFua1NldHMubWluKTtcbiAgICBhZGRMaWdodEVkZ2VzVG9NYXhOb2RlKGcsIHNnLCByYW5rU2V0cy5tYXgpO1xuICB9XG5cbiAgZGZzKG51bGwpO1xufTtcblxuZnVuY3Rpb24gY2hlY2tTdXBwb3J0ZWRQcmVmUmFuayhwcmVmUmFuaykge1xuICBpZiAocHJlZlJhbmsgIT09ICdtaW4nICYmIHByZWZSYW5rICE9PSAnbWF4JyAmJiBwcmVmUmFuay5pbmRleE9mKCdzYW1lXycpICE9PSAwKSB7XG4gICAgY29uc29sZS5lcnJvcignVW5zdXBwb3J0ZWQgcmFuayB0eXBlOiAnICsgcHJlZlJhbmspO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gcmVkaXJlY3RJbkVkZ2VzKGcsIHUsIG5ld1UsIHJldmVyc2UpIHtcbiAgZy5pbkVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgIHZhciBvcmlnVmFsdWUgPSBnLmVkZ2UoZSksXG4gICAgICAgIHZhbHVlO1xuICAgIGlmIChvcmlnVmFsdWUub3JpZ2luYWxFZGdlKSB7XG4gICAgICB2YWx1ZSA9IG9yaWdWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSAge1xuICAgICAgICBvcmlnaW5hbEVkZ2U6IHsgZTogZSwgdTogZy5zb3VyY2UoZSksIHY6IGcudGFyZ2V0KGUpLCB2YWx1ZTogb3JpZ1ZhbHVlIH0sXG4gICAgICAgIG1pbkxlbjogZy5lZGdlKGUpLm1pbkxlblxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEbyBub3QgcmV2ZXJzZSBlZGdlcyBmb3Igc2VsZi1sb29wcy5cbiAgICBpZiAob3JpZ1ZhbHVlLnNlbGZMb29wKSB7XG4gICAgICByZXZlcnNlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHJldmVyc2UpIHtcbiAgICAgIC8vIEVuc3VyZSB0aGF0IGFsbCBlZGdlcyB0byBtaW4gYXJlIHJldmVyc2VkXG4gICAgICBnLmFkZEVkZ2UobnVsbCwgbmV3VSwgZy5zb3VyY2UoZSksIHZhbHVlKTtcbiAgICAgIHZhbHVlLnJldmVyc2VkID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIGcuc291cmNlKGUpLCBuZXdVLCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVkaXJlY3RPdXRFZGdlcyhnLCB1LCBuZXdVLCByZXZlcnNlKSB7XG4gIGcub3V0RWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgdmFyIG9yaWdWYWx1ZSA9IGcuZWRnZShlKSxcbiAgICAgICAgdmFsdWU7XG4gICAgaWYgKG9yaWdWYWx1ZS5vcmlnaW5hbEVkZ2UpIHtcbiAgICAgIHZhbHVlID0gb3JpZ1ZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9ICB7XG4gICAgICAgIG9yaWdpbmFsRWRnZTogeyBlOiBlLCB1OiBnLnNvdXJjZShlKSwgdjogZy50YXJnZXQoZSksIHZhbHVlOiBvcmlnVmFsdWUgfSxcbiAgICAgICAgbWluTGVuOiBnLmVkZ2UoZSkubWluTGVuXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERvIG5vdCByZXZlcnNlIGVkZ2VzIGZvciBzZWxmLWxvb3BzLlxuICAgIGlmIChvcmlnVmFsdWUuc2VsZkxvb3ApIHtcbiAgICAgIHJldmVyc2UgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAocmV2ZXJzZSkge1xuICAgICAgLy8gRW5zdXJlIHRoYXQgYWxsIGVkZ2VzIGZyb20gbWF4IGFyZSByZXZlcnNlZFxuICAgICAgZy5hZGRFZGdlKG51bGwsIGcudGFyZ2V0KGUpLCBuZXdVLCB2YWx1ZSk7XG4gICAgICB2YWx1ZS5yZXZlcnNlZCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCBuZXdVLCBnLnRhcmdldChlKSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGFkZExpZ2h0RWRnZXNGcm9tTWluTm9kZShnLCBzZywgbWluTm9kZSkge1xuICBpZiAobWluTm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZy5jaGlsZHJlbihzZykuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAvLyBUaGUgZHVtbXkgY2hlY2sgZW5zdXJlcyB3ZSBkb24ndCBhZGQgYW4gZWRnZSBpZiB0aGUgbm9kZSBpcyBpbnZvbHZlZFxuICAgICAgLy8gaW4gYSBzZWxmIGxvb3Agb3Igc2lkZXdheXMgZWRnZS5cbiAgICAgIGlmICh1ICE9PSBtaW5Ob2RlICYmICFnLm91dEVkZ2VzKG1pbk5vZGUsIHUpLmxlbmd0aCAmJiAhZy5ub2RlKHUpLmR1bW15KSB7XG4gICAgICAgIGcuYWRkRWRnZShudWxsLCBtaW5Ob2RlLCB1LCB7IG1pbkxlbjogMCB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRMaWdodEVkZ2VzVG9NYXhOb2RlKGcsIHNnLCBtYXhOb2RlKSB7XG4gIGlmIChtYXhOb2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICBnLmNoaWxkcmVuKHNnKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIC8vIFRoZSBkdW1teSBjaGVjayBlbnN1cmVzIHdlIGRvbid0IGFkZCBhbiBlZGdlIGlmIHRoZSBub2RlIGlzIGludm9sdmVkXG4gICAgICAvLyBpbiBhIHNlbGYgbG9vcCBvciBzaWRld2F5cyBlZGdlLlxuICAgICAgaWYgKHUgIT09IG1heE5vZGUgJiYgIWcub3V0RWRnZXModSwgbWF4Tm9kZSkubGVuZ3RoICYmICFnLm5vZGUodSkuZHVtbXkpIHtcbiAgICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIG1heE5vZGUsIHsgbWluTGVuOiAwIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbi8qXG4gKiBUaGlzIGZ1bmN0aW9uIFwicmVsYXhlc1wiIHRoZSBjb25zdHJhaW50cyBhcHBsaWVkIHByZXZpb3VzbHkgYnkgdGhlIFwiYXBwbHlcIlxuICogZnVuY3Rpb24uIEl0IGV4cGFuZHMgYW55IG5vZGVzIHRoYXQgd2VyZSBjb2xsYXBzZWQgYW5kIGFzc2lnbnMgdGhlIHJhbmsgb2ZcbiAqIHRoZSBjb2xsYXBzZWQgbm9kZSB0byBlYWNoIG9mIHRoZSBleHBhbmRlZCBub2Rlcy4gSXQgYWxzbyByZXN0b3JlcyB0aGVcbiAqIG9yaWdpbmFsIGVkZ2VzIGFuZCByZW1vdmVzIGFueSBkdW1teSBlZGdlcyBwb2ludGluZyBhdCB0aGUgY29sbGFwc2VkIG5vZGVzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgcHJvY2VzcyBvZiByZW1vdmluZyBjb2xsYXBzZWQgbm9kZXMgYWxzbyByZW1vdmVzIGR1bW15IGVkZ2VzXG4gKiBhdXRvbWF0aWNhbGx5LlxuICovXG5leHBvcnRzLnJlbGF4ID0gZnVuY3Rpb24oZykge1xuICAvLyBTYXZlIG9yaWdpbmFsIGVkZ2VzXG4gIHZhciBvcmlnaW5hbEVkZ2VzID0gW107XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICB2YXIgb3JpZ2luYWxFZGdlID0gdmFsdWUub3JpZ2luYWxFZGdlO1xuICAgIGlmIChvcmlnaW5hbEVkZ2UpIHtcbiAgICAgIG9yaWdpbmFsRWRnZXMucHVzaChvcmlnaW5hbEVkZ2UpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gRXhwYW5kIGNvbGxhcHNlZCBub2Rlc1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgdmFyIG9yaWdpbmFsTm9kZXMgPSB2YWx1ZS5vcmlnaW5hbE5vZGVzO1xuICAgIGlmIChvcmlnaW5hbE5vZGVzKSB7XG4gICAgICBvcmlnaW5hbE5vZGVzLmZvckVhY2goZnVuY3Rpb24ob3JpZ2luYWxOb2RlKSB7XG4gICAgICAgIG9yaWdpbmFsTm9kZS52YWx1ZS5yYW5rID0gdmFsdWUucmFuaztcbiAgICAgICAgZy5hZGROb2RlKG9yaWdpbmFsTm9kZS51LCBvcmlnaW5hbE5vZGUudmFsdWUpO1xuICAgICAgICBnLnBhcmVudChvcmlnaW5hbE5vZGUudSwgb3JpZ2luYWxOb2RlLnBhcmVudCk7XG4gICAgICB9KTtcbiAgICAgIGcuZGVsTm9kZSh1KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFJlc3RvcmUgb3JpZ2luYWwgZWRnZXNcbiAgb3JpZ2luYWxFZGdlcy5mb3JFYWNoKGZ1bmN0aW9uKGVkZ2UpIHtcbiAgICBnLmFkZEVkZ2UoZWRnZS5lLCBlZGdlLnUsIGVkZ2UudiwgZWRnZS52YWx1ZSk7XG4gIH0pO1xufTtcbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoJ2NwLWRhdGEnKS5TZXQsXG4vKiBqc2hpbnQgK1cwNzkgKi9cbiAgICBEaWdyYXBoID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5EaWdyYXBoLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmVhc2libGVUcmVlO1xuXG4vKlxuICogR2l2ZW4gYW4gYWN5Y2xpYyBncmFwaCB3aXRoIGVhY2ggbm9kZSBhc3NpZ25lZCBhIGByYW5rYCBhdHRyaWJ1dGUsIHRoaXNcbiAqIGZ1bmN0aW9uIGNvbnN0cnVjdHMgYW5kIHJldHVybnMgYSBzcGFubmluZyB0cmVlLiBUaGlzIGZ1bmN0aW9uIG1heSByZWR1Y2VcbiAqIHRoZSBsZW5ndGggb2Ygc29tZSBlZGdlcyBmcm9tIHRoZSBpbml0aWFsIHJhbmsgYXNzaWdubWVudCB3aGlsZSBtYWludGFpbmluZ1xuICogdGhlIGBtaW5MZW5gIHNwZWNpZmllZCBieSBlYWNoIGVkZ2UuXG4gKlxuICogUHJlcmVxdWlzaXRlczpcbiAqXG4gKiAqIFRoZSBpbnB1dCBncmFwaCBpcyBhY3ljbGljXG4gKiAqIEVhY2ggbm9kZSBpbiB0aGUgaW5wdXQgZ3JhcGggaGFzIGFuIGFzc2lnbmVkIGByYW5rYCBhdHRyaWJ1dGVcbiAqICogRWFjaCBlZGdlIGluIHRoZSBpbnB1dCBncmFwaCBoYXMgYW4gYXNzaWduZWQgYG1pbkxlbmAgYXR0cmlidXRlXG4gKlxuICogT3V0cHV0czpcbiAqXG4gKiBBIGZlYXNpYmxlIHNwYW5uaW5nIHRyZWUgZm9yIHRoZSBpbnB1dCBncmFwaCAoaS5lLiBhIHNwYW5uaW5nIHRyZWUgdGhhdFxuICogcmVzcGVjdHMgZWFjaCBncmFwaCBlZGdlJ3MgYG1pbkxlbmAgYXR0cmlidXRlKSByZXByZXNlbnRlZCBhcyBhIERpZ3JhcGggd2l0aFxuICogYSBgcm9vdGAgYXR0cmlidXRlIG9uIGdyYXBoLlxuICpcbiAqIE5vZGVzIGhhdmUgdGhlIHNhbWUgaWQgYW5kIHZhbHVlIGFzIHRoYXQgaW4gdGhlIGlucHV0IGdyYXBoLlxuICpcbiAqIEVkZ2VzIGluIHRoZSB0cmVlIGhhdmUgYXJiaXRyYXJpbHkgYXNzaWduZWQgaWRzLiBUaGUgYXR0cmlidXRlcyBmb3IgZWRnZXNcbiAqIGluY2x1ZGUgYHJldmVyc2VkYC4gYHJldmVyc2VkYCBpbmRpY2F0ZXMgdGhhdCB0aGUgZWRnZSBpcyBhXG4gKiBiYWNrIGVkZ2UgaW4gdGhlIGlucHV0IGdyYXBoLlxuICovXG5mdW5jdGlvbiBmZWFzaWJsZVRyZWUoZykge1xuICB2YXIgcmVtYWluaW5nID0gbmV3IFNldChnLm5vZGVzKCkpLFxuICAgICAgdHJlZSA9IG5ldyBEaWdyYXBoKCk7XG5cbiAgaWYgKHJlbWFpbmluZy5zaXplKCkgPT09IDEpIHtcbiAgICB2YXIgcm9vdCA9IGcubm9kZXMoKVswXTtcbiAgICB0cmVlLmFkZE5vZGUocm9vdCwge30pO1xuICAgIHRyZWUuZ3JhcGgoeyByb290OiByb290IH0pO1xuICAgIHJldHVybiB0cmVlO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVGlnaHRFZGdlcyh2KSB7XG4gICAgdmFyIGNvbnRpbnVlVG9TY2FuID0gdHJ1ZTtcbiAgICBnLnByZWRlY2Vzc29ycyh2KS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIGlmIChyZW1haW5pbmcuaGFzKHUpICYmICFzbGFjayhnLCB1LCB2KSkge1xuICAgICAgICBpZiAocmVtYWluaW5nLmhhcyh2KSkge1xuICAgICAgICAgIHRyZWUuYWRkTm9kZSh2LCB7fSk7XG4gICAgICAgICAgcmVtYWluaW5nLnJlbW92ZSh2KTtcbiAgICAgICAgICB0cmVlLmdyYXBoKHsgcm9vdDogdiB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyZWUuYWRkTm9kZSh1LCB7fSk7XG4gICAgICAgIHRyZWUuYWRkRWRnZShudWxsLCB1LCB2LCB7IHJldmVyc2VkOiB0cnVlIH0pO1xuICAgICAgICByZW1haW5pbmcucmVtb3ZlKHUpO1xuICAgICAgICBhZGRUaWdodEVkZ2VzKHUpO1xuICAgICAgICBjb250aW51ZVRvU2NhbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZy5zdWNjZXNzb3JzKHYpLmZvckVhY2goZnVuY3Rpb24odykgIHtcbiAgICAgIGlmIChyZW1haW5pbmcuaGFzKHcpICYmICFzbGFjayhnLCB2LCB3KSkge1xuICAgICAgICBpZiAocmVtYWluaW5nLmhhcyh2KSkge1xuICAgICAgICAgIHRyZWUuYWRkTm9kZSh2LCB7fSk7XG4gICAgICAgICAgcmVtYWluaW5nLnJlbW92ZSh2KTtcbiAgICAgICAgICB0cmVlLmdyYXBoKHsgcm9vdDogdiB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyZWUuYWRkTm9kZSh3LCB7fSk7XG4gICAgICAgIHRyZWUuYWRkRWRnZShudWxsLCB2LCB3LCB7fSk7XG4gICAgICAgIHJlbWFpbmluZy5yZW1vdmUodyk7XG4gICAgICAgIGFkZFRpZ2h0RWRnZXModyk7XG4gICAgICAgIGNvbnRpbnVlVG9TY2FuID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbnRpbnVlVG9TY2FuO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlVGlnaHRFZGdlKCkge1xuICAgIHZhciBtaW5TbGFjayA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgcmVtYWluaW5nLmtleXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGcucHJlZGVjZXNzb3JzKHYpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgICBpZiAoIXJlbWFpbmluZy5oYXModSkpIHtcbiAgICAgICAgICB2YXIgZWRnZVNsYWNrID0gc2xhY2soZywgdSwgdik7XG4gICAgICAgICAgaWYgKE1hdGguYWJzKGVkZ2VTbGFjaykgPCBNYXRoLmFicyhtaW5TbGFjaykpIHtcbiAgICAgICAgICAgIG1pblNsYWNrID0gLWVkZ2VTbGFjaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBnLnN1Y2Nlc3NvcnModikuZm9yRWFjaChmdW5jdGlvbih3KSB7XG4gICAgICAgIGlmICghcmVtYWluaW5nLmhhcyh3KSkge1xuICAgICAgICAgIHZhciBlZGdlU2xhY2sgPSBzbGFjayhnLCB2LCB3KTtcbiAgICAgICAgICBpZiAoTWF0aC5hYnMoZWRnZVNsYWNrKSA8IE1hdGguYWJzKG1pblNsYWNrKSkge1xuICAgICAgICAgICAgbWluU2xhY2sgPSBlZGdlU2xhY2s7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRyZWUuZWFjaE5vZGUoZnVuY3Rpb24odSkgeyBnLm5vZGUodSkucmFuayAtPSBtaW5TbGFjazsgfSk7XG4gIH1cblxuICB3aGlsZSAocmVtYWluaW5nLnNpemUoKSkge1xuICAgIHZhciBub2Rlc1RvU2VhcmNoID0gIXRyZWUub3JkZXIoKSA/IHJlbWFpbmluZy5rZXlzKCkgOiB0cmVlLm5vZGVzKCk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGlsID0gbm9kZXNUb1NlYXJjaC5sZW5ndGg7XG4gICAgICAgICBpIDwgaWwgJiYgYWRkVGlnaHRFZGdlcyhub2Rlc1RvU2VhcmNoW2ldKTtcbiAgICAgICAgICsraSk7XG4gICAgaWYgKHJlbWFpbmluZy5zaXplKCkpIHtcbiAgICAgIGNyZWF0ZVRpZ2h0RWRnZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cmVlO1xufVxuXG5mdW5jdGlvbiBzbGFjayhnLCB1LCB2KSB7XG4gIHZhciByYW5rRGlmZiA9IGcubm9kZSh2KS5yYW5rIC0gZy5ub2RlKHUpLnJhbms7XG4gIHZhciBtYXhNaW5MZW4gPSB1dGlsLm1heChnLm91dEVkZ2VzKHUsIHYpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbihlKSB7IHJldHVybiBnLmVkZ2UoZSkubWluTGVuOyB9KSk7XG4gIHJldHVybiByYW5rRGlmZiAtIG1heE1pbkxlbjtcbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpLFxuICAgIHRvcHNvcnQgPSByZXF1aXJlKCdncmFwaGxpYicpLmFsZy50b3Bzb3J0O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXRSYW5rO1xuXG4vKlxuICogQXNzaWducyBhIGByYW5rYCBhdHRyaWJ1dGUgdG8gZWFjaCBub2RlIGluIHRoZSBpbnB1dCBncmFwaCBhbmQgZW5zdXJlcyB0aGF0XG4gKiB0aGlzIHJhbmsgcmVzcGVjdHMgdGhlIGBtaW5MZW5gIGF0dHJpYnV0ZSBvZiBpbmNpZGVudCBlZGdlcy5cbiAqXG4gKiBQcmVyZXF1aXNpdGVzOlxuICpcbiAqICAqIFRoZSBpbnB1dCBncmFwaCBtdXN0IGJlIGFjeWNsaWNcbiAqICAqIEVhY2ggZWRnZSBpbiB0aGUgaW5wdXQgZ3JhcGggbXVzdCBoYXZlIGFuIGFzc2lnbmVkICdtaW5MZW4nIGF0dHJpYnV0ZVxuICovXG5mdW5jdGlvbiBpbml0UmFuayhnKSB7XG4gIHZhciBzb3J0ZWQgPSB0b3Bzb3J0KGcpO1xuXG4gIHNvcnRlZC5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICB2YXIgaW5FZGdlcyA9IGcuaW5FZGdlcyh1KTtcbiAgICBpZiAoaW5FZGdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGcubm9kZSh1KS5yYW5rID0gMDtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgbWluTGVucyA9IGluRWRnZXMubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBnLm5vZGUoZy5zb3VyY2UoZSkpLnJhbmsgKyBnLmVkZ2UoZSkubWluTGVuO1xuICAgIH0pO1xuICAgIGcubm9kZSh1KS5yYW5rID0gdXRpbC5tYXgobWluTGVucyk7XG4gIH0pO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIHNsYWNrOiBzbGFja1xufTtcblxuLypcbiAqIEEgaGVscGVyIHRvIGNhbGN1bGF0ZSB0aGUgc2xhY2sgYmV0d2VlbiB0d28gbm9kZXMgKGB1YCBhbmQgYHZgKSBnaXZlbiBhXG4gKiBgbWluTGVuYCBjb25zdHJhaW50LiBUaGUgc2xhY2sgcmVwcmVzZW50cyBob3cgbXVjaCB0aGUgZGlzdGFuY2UgYmV0d2VlbiBgdWBcbiAqIGFuZCBgdmAgY291bGQgc2hyaW5rIHdoaWxlIG1haW50YWluaW5nIHRoZSBgbWluTGVuYCBjb25zdHJhaW50LiBJZiB0aGUgdmFsdWVcbiAqIGlzIG5lZ2F0aXZlIHRoZW4gdGhlIGNvbnN0cmFpbnQgaXMgY3VycmVudGx5IHZpb2xhdGVkLlxuICpcbiAgVGhpcyBmdW5jdGlvbiByZXF1aXJlcyB0aGF0IGB1YCBhbmQgYHZgIGFyZSBpbiBgZ3JhcGhgIGFuZCB0aGV5IGJvdGggaGF2ZSBhXG4gIGByYW5rYCBhdHRyaWJ1dGUuXG4gKi9cbmZ1bmN0aW9uIHNsYWNrKGdyYXBoLCB1LCB2LCBtaW5MZW4pIHtcbiAgcmV0dXJuIE1hdGguYWJzKGdyYXBoLm5vZGUodSkucmFuayAtIGdyYXBoLm5vZGUodikucmFuaykgLSBtaW5MZW47XG59XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKSxcbiAgICByYW5rVXRpbCA9IHJlcXVpcmUoJy4vcmFua1V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzaW1wbGV4O1xuXG5mdW5jdGlvbiBzaW1wbGV4KGdyYXBoLCBzcGFubmluZ1RyZWUpIHtcbiAgLy8gVGhlIG5ldHdvcmsgc2ltcGxleCBhbGdvcml0aG0gcmVwZWF0ZWRseSByZXBsYWNlcyBlZGdlcyBvZlxuICAvLyB0aGUgc3Bhbm5pbmcgdHJlZSB3aXRoIG5lZ2F0aXZlIGN1dCB2YWx1ZXMgdW50aWwgbm8gc3VjaFxuICAvLyBlZGdlIGV4aXN0cy5cbiAgaW5pdEN1dFZhbHVlcyhncmFwaCwgc3Bhbm5pbmdUcmVlKTtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICB2YXIgZSA9IGxlYXZlRWRnZShzcGFubmluZ1RyZWUpO1xuICAgIGlmIChlID09PSBudWxsKSBicmVhaztcbiAgICB2YXIgZiA9IGVudGVyRWRnZShncmFwaCwgc3Bhbm5pbmdUcmVlLCBlKTtcbiAgICBleGNoYW5nZShncmFwaCwgc3Bhbm5pbmdUcmVlLCBlLCBmKTtcbiAgfVxufVxuXG4vKlxuICogU2V0IHRoZSBjdXQgdmFsdWVzIG9mIGVkZ2VzIGluIHRoZSBzcGFubmluZyB0cmVlIGJ5IGEgZGVwdGgtZmlyc3RcbiAqIHBvc3RvcmRlciB0cmF2ZXJzYWwuICBUaGUgY3V0IHZhbHVlIGNvcnJlc3BvbmRzIHRvIHRoZSBjb3N0LCBpblxuICogdGVybXMgb2YgYSByYW5raW5nJ3MgZWRnZSBsZW5ndGggc3VtLCBvZiBsZW5ndGhlbmluZyBhbiBlZGdlLlxuICogTmVnYXRpdmUgY3V0IHZhbHVlcyB0eXBpY2FsbHkgaW5kaWNhdGUgZWRnZXMgdGhhdCB3b3VsZCB5aWVsZCBhXG4gKiBzbWFsbGVyIGVkZ2UgbGVuZ3RoIHN1bSBpZiB0aGV5IHdlcmUgbGVuZ3RoZW5lZC5cbiAqL1xuZnVuY3Rpb24gaW5pdEN1dFZhbHVlcyhncmFwaCwgc3Bhbm5pbmdUcmVlKSB7XG4gIGNvbXB1dGVMb3dMaW0oc3Bhbm5pbmdUcmVlKTtcblxuICBzcGFubmluZ1RyZWUuZWFjaEVkZ2UoZnVuY3Rpb24oaWQsIHUsIHYsIHRyZWVWYWx1ZSkge1xuICAgIHRyZWVWYWx1ZS5jdXRWYWx1ZSA9IDA7XG4gIH0pO1xuXG4gIC8vIFByb3BhZ2F0ZSBjdXQgdmFsdWVzIHVwIHRoZSB0cmVlLlxuICBmdW5jdGlvbiBkZnMobikge1xuICAgIHZhciBjaGlsZHJlbiA9IHNwYW5uaW5nVHJlZS5zdWNjZXNzb3JzKG4pO1xuICAgIGZvciAodmFyIGMgaW4gY2hpbGRyZW4pIHtcbiAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2NdO1xuICAgICAgZGZzKGNoaWxkKTtcbiAgICB9XG4gICAgaWYgKG4gIT09IHNwYW5uaW5nVHJlZS5ncmFwaCgpLnJvb3QpIHtcbiAgICAgIHNldEN1dFZhbHVlKGdyYXBoLCBzcGFubmluZ1RyZWUsIG4pO1xuICAgIH1cbiAgfVxuICBkZnMoc3Bhbm5pbmdUcmVlLmdyYXBoKCkucm9vdCk7XG59XG5cbi8qXG4gKiBQZXJmb3JtIGEgREZTIHBvc3RvcmRlciB0cmF2ZXJzYWwsIGxhYmVsaW5nIGVhY2ggbm9kZSB2IHdpdGhcbiAqIGl0cyB0cmF2ZXJzYWwgb3JkZXIgJ2xpbSh2KScgYW5kIHRoZSBtaW5pbXVtIHRyYXZlcnNhbCBudW1iZXJcbiAqIG9mIGFueSBvZiBpdHMgZGVzY2VuZGFudHMgJ2xvdyh2KScuICBUaGlzIHByb3ZpZGVzIGFuIGVmZmljaWVudFxuICogd2F5IHRvIHRlc3Qgd2hldGhlciB1IGlzIGFuIGFuY2VzdG9yIG9mIHYgc2luY2VcbiAqIGxvdyh1KSA8PSBsaW0odikgPD0gbGltKHUpIGlmIGFuZCBvbmx5IGlmIHUgaXMgYW4gYW5jZXN0b3IuXG4gKi9cbmZ1bmN0aW9uIGNvbXB1dGVMb3dMaW0odHJlZSkge1xuICB2YXIgcG9zdE9yZGVyTnVtID0gMDtcbiAgXG4gIGZ1bmN0aW9uIGRmcyhuKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gdHJlZS5zdWNjZXNzb3JzKG4pO1xuICAgIHZhciBsb3cgPSBwb3N0T3JkZXJOdW07XG4gICAgZm9yICh2YXIgYyBpbiBjaGlsZHJlbikge1xuICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bY107XG4gICAgICBkZnMoY2hpbGQpO1xuICAgICAgbG93ID0gTWF0aC5taW4obG93LCB0cmVlLm5vZGUoY2hpbGQpLmxvdyk7XG4gICAgfVxuICAgIHRyZWUubm9kZShuKS5sb3cgPSBsb3c7XG4gICAgdHJlZS5ub2RlKG4pLmxpbSA9IHBvc3RPcmRlck51bSsrO1xuICB9XG5cbiAgZGZzKHRyZWUuZ3JhcGgoKS5yb290KTtcbn1cblxuLypcbiAqIFRvIGNvbXB1dGUgdGhlIGN1dCB2YWx1ZSBvZiB0aGUgZWRnZSBwYXJlbnQgLT4gY2hpbGQsIHdlIGNvbnNpZGVyXG4gKiBpdCBhbmQgYW55IG90aGVyIGdyYXBoIGVkZ2VzIHRvIG9yIGZyb20gdGhlIGNoaWxkLlxuICogICAgICAgICAgcGFyZW50XG4gKiAgICAgICAgICAgICB8XG4gKiAgICAgICAgICAgY2hpbGRcbiAqICAgICAgICAgIC8gICAgICBcXFxuICogICAgICAgICB1ICAgICAgICB2XG4gKi9cbmZ1bmN0aW9uIHNldEN1dFZhbHVlKGdyYXBoLCB0cmVlLCBjaGlsZCkge1xuICB2YXIgcGFyZW50RWRnZSA9IHRyZWUuaW5FZGdlcyhjaGlsZClbMF07XG5cbiAgLy8gTGlzdCBvZiBjaGlsZCdzIGNoaWxkcmVuIGluIHRoZSBzcGFubmluZyB0cmVlLlxuICB2YXIgZ3JhbmRjaGlsZHJlbiA9IFtdO1xuICB2YXIgZ3JhbmRjaGlsZEVkZ2VzID0gdHJlZS5vdXRFZGdlcyhjaGlsZCk7XG4gIGZvciAodmFyIGdjZSBpbiBncmFuZGNoaWxkRWRnZXMpIHtcbiAgICBncmFuZGNoaWxkcmVuLnB1c2godHJlZS50YXJnZXQoZ3JhbmRjaGlsZEVkZ2VzW2djZV0pKTtcbiAgfVxuXG4gIHZhciBjdXRWYWx1ZSA9IDA7XG5cbiAgLy8gVE9ETzogUmVwbGFjZSB1bml0IGluY3JlbWVudC9kZWNyZW1lbnQgd2l0aCBlZGdlIHdlaWdodHMuXG4gIHZhciBFID0gMDsgICAgLy8gRWRnZXMgZnJvbSBjaGlsZCB0byBncmFuZGNoaWxkJ3Mgc3VidHJlZS5cbiAgdmFyIEYgPSAwOyAgICAvLyBFZGdlcyB0byBjaGlsZCBmcm9tIGdyYW5kY2hpbGQncyBzdWJ0cmVlLlxuICB2YXIgRyA9IDA7ICAgIC8vIEVkZ2VzIGZyb20gY2hpbGQgdG8gbm9kZXMgb3V0c2lkZSBvZiBjaGlsZCdzIHN1YnRyZWUuXG4gIHZhciBIID0gMDsgICAgLy8gRWRnZXMgZnJvbSBub2RlcyBvdXRzaWRlIG9mIGNoaWxkJ3Mgc3VidHJlZSB0byBjaGlsZC5cblxuICAvLyBDb25zaWRlciBhbGwgZ3JhcGggZWRnZXMgZnJvbSBjaGlsZC5cbiAgdmFyIG91dEVkZ2VzID0gZ3JhcGgub3V0RWRnZXMoY2hpbGQpO1xuICB2YXIgZ2M7XG4gIGZvciAodmFyIG9lIGluIG91dEVkZ2VzKSB7XG4gICAgdmFyIHN1Y2MgPSBncmFwaC50YXJnZXQob3V0RWRnZXNbb2VdKTtcbiAgICBmb3IgKGdjIGluIGdyYW5kY2hpbGRyZW4pIHtcbiAgICAgIGlmIChpblN1YnRyZWUodHJlZSwgc3VjYywgZ3JhbmRjaGlsZHJlbltnY10pKSB7XG4gICAgICAgIEUrKztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFpblN1YnRyZWUodHJlZSwgc3VjYywgY2hpbGQpKSB7XG4gICAgICBHKys7XG4gICAgfVxuICB9XG5cbiAgLy8gQ29uc2lkZXIgYWxsIGdyYXBoIGVkZ2VzIHRvIGNoaWxkLlxuICB2YXIgaW5FZGdlcyA9IGdyYXBoLmluRWRnZXMoY2hpbGQpO1xuICBmb3IgKHZhciBpZSBpbiBpbkVkZ2VzKSB7XG4gICAgdmFyIHByZWQgPSBncmFwaC5zb3VyY2UoaW5FZGdlc1tpZV0pO1xuICAgIGZvciAoZ2MgaW4gZ3JhbmRjaGlsZHJlbikge1xuICAgICAgaWYgKGluU3VidHJlZSh0cmVlLCBwcmVkLCBncmFuZGNoaWxkcmVuW2djXSkpIHtcbiAgICAgICAgRisrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWluU3VidHJlZSh0cmVlLCBwcmVkLCBjaGlsZCkpIHtcbiAgICAgIEgrKztcbiAgICB9XG4gIH1cblxuICAvLyBDb250cmlidXRpb25zIGRlcGVuZCBvbiB0aGUgYWxpZ25tZW50IG9mIHRoZSBwYXJlbnQgLT4gY2hpbGQgZWRnZVxuICAvLyBhbmQgdGhlIGNoaWxkIC0+IHUgb3IgdiBlZGdlcy5cbiAgdmFyIGdyYW5kY2hpbGRDdXRTdW0gPSAwO1xuICBmb3IgKGdjIGluIGdyYW5kY2hpbGRyZW4pIHtcbiAgICB2YXIgY3YgPSB0cmVlLmVkZ2UoZ3JhbmRjaGlsZEVkZ2VzW2djXSkuY3V0VmFsdWU7XG4gICAgaWYgKCF0cmVlLmVkZ2UoZ3JhbmRjaGlsZEVkZ2VzW2djXSkucmV2ZXJzZWQpIHtcbiAgICAgIGdyYW5kY2hpbGRDdXRTdW0gKz0gY3Y7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdyYW5kY2hpbGRDdXRTdW0gLT0gY3Y7XG4gICAgfVxuICB9XG5cbiAgaWYgKCF0cmVlLmVkZ2UocGFyZW50RWRnZSkucmV2ZXJzZWQpIHtcbiAgICBjdXRWYWx1ZSArPSBncmFuZGNoaWxkQ3V0U3VtIC0gRSArIEYgLSBHICsgSDtcbiAgfSBlbHNlIHtcbiAgICBjdXRWYWx1ZSAtPSBncmFuZGNoaWxkQ3V0U3VtIC0gRSArIEYgLSBHICsgSDtcbiAgfVxuXG4gIHRyZWUuZWRnZShwYXJlbnRFZGdlKS5jdXRWYWx1ZSA9IGN1dFZhbHVlO1xufVxuXG4vKlxuICogUmV0dXJuIHdoZXRoZXIgbiBpcyBhIG5vZGUgaW4gdGhlIHN1YnRyZWUgd2l0aCB0aGUgZ2l2ZW5cbiAqIHJvb3QuXG4gKi9cbmZ1bmN0aW9uIGluU3VidHJlZSh0cmVlLCBuLCByb290KSB7XG4gIHJldHVybiAodHJlZS5ub2RlKHJvb3QpLmxvdyA8PSB0cmVlLm5vZGUobikubGltICYmXG4gICAgICAgICAgdHJlZS5ub2RlKG4pLmxpbSA8PSB0cmVlLm5vZGUocm9vdCkubGltKTtcbn1cblxuLypcbiAqIFJldHVybiBhbiBlZGdlIGZyb20gdGhlIHRyZWUgd2l0aCBhIG5lZ2F0aXZlIGN1dCB2YWx1ZSwgb3IgbnVsbCBpZiB0aGVyZVxuICogaXMgbm9uZS5cbiAqL1xuZnVuY3Rpb24gbGVhdmVFZGdlKHRyZWUpIHtcbiAgdmFyIGVkZ2VzID0gdHJlZS5lZGdlcygpO1xuICBmb3IgKHZhciBuIGluIGVkZ2VzKSB7XG4gICAgdmFyIGUgPSBlZGdlc1tuXTtcbiAgICB2YXIgdHJlZVZhbHVlID0gdHJlZS5lZGdlKGUpO1xuICAgIGlmICh0cmVlVmFsdWUuY3V0VmFsdWUgPCAwKSB7XG4gICAgICByZXR1cm4gZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qXG4gKiBUaGUgZWRnZSBlIHNob3VsZCBiZSBhbiBlZGdlIGluIHRoZSB0cmVlLCB3aXRoIGFuIHVuZGVybHlpbmcgZWRnZVxuICogaW4gdGhlIGdyYXBoLCB3aXRoIGEgbmVnYXRpdmUgY3V0IHZhbHVlLiAgT2YgdGhlIHR3byBub2RlcyBpbmNpZGVudFxuICogb24gdGhlIGVkZ2UsIHRha2UgdGhlIGxvd2VyIG9uZS4gIGVudGVyRWRnZSByZXR1cm5zIGFuIGVkZ2Ugd2l0aFxuICogbWluaW11bSBzbGFjayBnb2luZyBmcm9tIG91dHNpZGUgb2YgdGhhdCBub2RlJ3Mgc3VidHJlZSB0byBpbnNpZGVcbiAqIG9mIHRoYXQgbm9kZSdzIHN1YnRyZWUuXG4gKi9cbmZ1bmN0aW9uIGVudGVyRWRnZShncmFwaCwgdHJlZSwgZSkge1xuICB2YXIgc291cmNlID0gdHJlZS5zb3VyY2UoZSk7XG4gIHZhciB0YXJnZXQgPSB0cmVlLnRhcmdldChlKTtcbiAgdmFyIGxvd2VyID0gdHJlZS5ub2RlKHRhcmdldCkubGltIDwgdHJlZS5ub2RlKHNvdXJjZSkubGltID8gdGFyZ2V0IDogc291cmNlO1xuXG4gIC8vIElzIHRoZSB0cmVlIGVkZ2UgYWxpZ25lZCB3aXRoIHRoZSBncmFwaCBlZGdlP1xuICB2YXIgYWxpZ25lZCA9ICF0cmVlLmVkZ2UoZSkucmV2ZXJzZWQ7XG5cbiAgdmFyIG1pblNsYWNrID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICB2YXIgbWluU2xhY2tFZGdlO1xuICBpZiAoYWxpZ25lZCkge1xuICAgIGdyYXBoLmVhY2hFZGdlKGZ1bmN0aW9uKGlkLCB1LCB2LCB2YWx1ZSkge1xuICAgICAgaWYgKGlkICE9PSBlICYmIGluU3VidHJlZSh0cmVlLCB1LCBsb3dlcikgJiYgIWluU3VidHJlZSh0cmVlLCB2LCBsb3dlcikpIHtcbiAgICAgICAgdmFyIHNsYWNrID0gcmFua1V0aWwuc2xhY2soZ3JhcGgsIHUsIHYsIHZhbHVlLm1pbkxlbik7XG4gICAgICAgIGlmIChzbGFjayA8IG1pblNsYWNrKSB7XG4gICAgICAgICAgbWluU2xhY2sgPSBzbGFjaztcbiAgICAgICAgICBtaW5TbGFja0VkZ2UgPSBpZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGdyYXBoLmVhY2hFZGdlKGZ1bmN0aW9uKGlkLCB1LCB2LCB2YWx1ZSkge1xuICAgICAgaWYgKGlkICE9PSBlICYmICFpblN1YnRyZWUodHJlZSwgdSwgbG93ZXIpICYmIGluU3VidHJlZSh0cmVlLCB2LCBsb3dlcikpIHtcbiAgICAgICAgdmFyIHNsYWNrID0gcmFua1V0aWwuc2xhY2soZ3JhcGgsIHUsIHYsIHZhbHVlLm1pbkxlbik7XG4gICAgICAgIGlmIChzbGFjayA8IG1pblNsYWNrKSB7XG4gICAgICAgICAgbWluU2xhY2sgPSBzbGFjaztcbiAgICAgICAgICBtaW5TbGFja0VkZ2UgPSBpZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1pblNsYWNrRWRnZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIG91dHNpZGUgPSBbXTtcbiAgICB2YXIgaW5zaWRlID0gW107XG4gICAgZ3JhcGguZWFjaE5vZGUoZnVuY3Rpb24oaWQpIHtcbiAgICAgIGlmICghaW5TdWJ0cmVlKHRyZWUsIGlkLCBsb3dlcikpIHtcbiAgICAgICAgb3V0c2lkZS5wdXNoKGlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGluc2lkZS5wdXNoKGlkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGVkZ2UgZm91bmQgZnJvbSBvdXRzaWRlIG9mIHRyZWUgdG8gaW5zaWRlJyk7XG4gIH1cblxuICByZXR1cm4gbWluU2xhY2tFZGdlO1xufVxuXG4vKlxuICogUmVwbGFjZSBlZGdlIGUgd2l0aCBlZGdlIGYgaW4gdGhlIHRyZWUsIHJlY2FsY3VsYXRpbmcgdGhlIHRyZWUgcm9vdCxcbiAqIHRoZSBub2RlcycgbG93IGFuZCBsaW0gcHJvcGVydGllcyBhbmQgdGhlIGVkZ2VzJyBjdXQgdmFsdWVzLlxuICovXG5mdW5jdGlvbiBleGNoYW5nZShncmFwaCwgdHJlZSwgZSwgZikge1xuICB0cmVlLmRlbEVkZ2UoZSk7XG4gIHZhciBzb3VyY2UgPSBncmFwaC5zb3VyY2UoZik7XG4gIHZhciB0YXJnZXQgPSBncmFwaC50YXJnZXQoZik7XG5cbiAgLy8gUmVkaXJlY3QgZWRnZXMgc28gdGhhdCB0YXJnZXQgaXMgdGhlIHJvb3Qgb2YgaXRzIHN1YnRyZWUuXG4gIGZ1bmN0aW9uIHJlZGlyZWN0KHYpIHtcbiAgICB2YXIgZWRnZXMgPSB0cmVlLmluRWRnZXModik7XG4gICAgZm9yICh2YXIgaSBpbiBlZGdlcykge1xuICAgICAgdmFyIGUgPSBlZGdlc1tpXTtcbiAgICAgIHZhciB1ID0gdHJlZS5zb3VyY2UoZSk7XG4gICAgICB2YXIgdmFsdWUgPSB0cmVlLmVkZ2UoZSk7XG4gICAgICByZWRpcmVjdCh1KTtcbiAgICAgIHRyZWUuZGVsRWRnZShlKTtcbiAgICAgIHZhbHVlLnJldmVyc2VkID0gIXZhbHVlLnJldmVyc2VkO1xuICAgICAgdHJlZS5hZGRFZGdlKGUsIHYsIHUsIHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICByZWRpcmVjdCh0YXJnZXQpO1xuXG4gIHZhciByb290ID0gc291cmNlO1xuICB2YXIgZWRnZXMgPSB0cmVlLmluRWRnZXMocm9vdCk7XG4gIHdoaWxlIChlZGdlcy5sZW5ndGggPiAwKSB7XG4gICAgcm9vdCA9IHRyZWUuc291cmNlKGVkZ2VzWzBdKTtcbiAgICBlZGdlcyA9IHRyZWUuaW5FZGdlcyhyb290KTtcbiAgfVxuXG4gIHRyZWUuZ3JhcGgoKS5yb290ID0gcm9vdDtcblxuICB0cmVlLmFkZEVkZ2UobnVsbCwgc291cmNlLCB0YXJnZXQsIHtjdXRWYWx1ZTogMH0pO1xuXG4gIGluaXRDdXRWYWx1ZXMoZ3JhcGgsIHRyZWUpO1xuXG4gIGFkanVzdFJhbmtzKGdyYXBoLCB0cmVlKTtcbn1cblxuLypcbiAqIFJlc2V0IHRoZSByYW5rcyBvZiBhbGwgbm9kZXMgYmFzZWQgb24gdGhlIGN1cnJlbnQgc3Bhbm5pbmcgdHJlZS5cbiAqIFRoZSByYW5rIG9mIHRoZSB0cmVlJ3Mgcm9vdCByZW1haW5zIHVuY2hhbmdlZCwgd2hpbGUgYWxsIG90aGVyXG4gKiBub2RlcyBhcmUgc2V0IHRvIHRoZSBzdW0gb2YgbWluaW11bSBsZW5ndGggY29uc3RyYWludHMgYWxvbmdcbiAqIHRoZSBwYXRoIGZyb20gdGhlIHJvb3QuXG4gKi9cbmZ1bmN0aW9uIGFkanVzdFJhbmtzKGdyYXBoLCB0cmVlKSB7XG4gIGZ1bmN0aW9uIGRmcyhwKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gdHJlZS5zdWNjZXNzb3JzKHApO1xuICAgIGNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oYykge1xuICAgICAgdmFyIG1pbkxlbiA9IG1pbmltdW1MZW5ndGgoZ3JhcGgsIHAsIGMpO1xuICAgICAgZ3JhcGgubm9kZShjKS5yYW5rID0gZ3JhcGgubm9kZShwKS5yYW5rICsgbWluTGVuO1xuICAgICAgZGZzKGMpO1xuICAgIH0pO1xuICB9XG5cbiAgZGZzKHRyZWUuZ3JhcGgoKS5yb290KTtcbn1cblxuLypcbiAqIElmIHUgYW5kIHYgYXJlIGNvbm5lY3RlZCBieSBzb21lIGVkZ2VzIGluIHRoZSBncmFwaCwgcmV0dXJuIHRoZVxuICogbWluaW11bSBsZW5ndGggb2YgdGhvc2UgZWRnZXMsIGFzIGEgcG9zaXRpdmUgbnVtYmVyIGlmIHYgc3VjY2VlZHNcbiAqIHUgYW5kIGFzIGEgbmVnYXRpdmUgbnVtYmVyIGlmIHYgcHJlY2VkZXMgdS5cbiAqL1xuZnVuY3Rpb24gbWluaW11bUxlbmd0aChncmFwaCwgdSwgdikge1xuICB2YXIgb3V0RWRnZXMgPSBncmFwaC5vdXRFZGdlcyh1LCB2KTtcbiAgaWYgKG91dEVkZ2VzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gdXRpbC5tYXgob3V0RWRnZXMubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBncmFwaC5lZGdlKGUpLm1pbkxlbjtcbiAgICB9KSk7XG4gIH1cblxuICB2YXIgaW5FZGdlcyA9IGdyYXBoLmluRWRnZXModSwgdik7XG4gIGlmIChpbkVkZ2VzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gLXV0aWwubWF4KGluRWRnZXMubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBncmFwaC5lZGdlKGUpLm1pbkxlbjtcbiAgICB9KSk7XG4gIH1cbn1cbiIsIi8qXG4gKiBSZXR1cm5zIHRoZSBzbWFsbGVzdCB2YWx1ZSBpbiB0aGUgYXJyYXkuXG4gKi9cbmV4cG9ydHMubWluID0gZnVuY3Rpb24odmFsdWVzKSB7XG4gIHJldHVybiBNYXRoLm1pbi5hcHBseShNYXRoLCB2YWx1ZXMpO1xufTtcblxuLypcbiAqIFJldHVybnMgdGhlIGxhcmdlc3QgdmFsdWUgaW4gdGhlIGFycmF5LlxuICovXG5leHBvcnRzLm1heCA9IGZ1bmN0aW9uKHZhbHVlcykge1xuICByZXR1cm4gTWF0aC5tYXguYXBwbHkoTWF0aCwgdmFsdWVzKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGB0cnVlYCBvbmx5IGlmIGBmKHgpYCBpcyBgdHJ1ZWAgZm9yIGFsbCBgeGAgaW4gYHhzYC4gT3RoZXJ3aXNlXG4gKiByZXR1cm5zIGBmYWxzZWAuIFRoaXMgZnVuY3Rpb24gd2lsbCByZXR1cm4gaW1tZWRpYXRlbHkgaWYgaXQgZmluZHMgYVxuICogY2FzZSB3aGVyZSBgZih4KWAgZG9lcyBub3QgaG9sZC5cbiAqL1xuZXhwb3J0cy5hbGwgPSBmdW5jdGlvbih4cywgZikge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCFmKHhzW2ldKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qXG4gKiBBY2N1bXVsYXRlcyB0aGUgc3VtIG9mIGVsZW1lbnRzIGluIHRoZSBnaXZlbiBhcnJheSB1c2luZyB0aGUgYCtgIG9wZXJhdG9yLlxuICovXG5leHBvcnRzLnN1bSA9IGZ1bmN0aW9uKHZhbHVlcykge1xuICByZXR1cm4gdmFsdWVzLnJlZHVjZShmdW5jdGlvbihhY2MsIHgpIHsgcmV0dXJuIGFjYyArIHg7IH0sIDApO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgYWxsIHZhbHVlcyBpbiB0aGUgZ2l2ZW4gb2JqZWN0LlxuICovXG5leHBvcnRzLnZhbHVlcyA9IGZ1bmN0aW9uKG9iaikge1xuICByZXR1cm4gT2JqZWN0LmtleXMob2JqKS5tYXAoZnVuY3Rpb24oaykgeyByZXR1cm4gb2JqW2tdOyB9KTtcbn07XG5cbmV4cG9ydHMuc2h1ZmZsZSA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gIGZvciAoaSA9IGFycmF5Lmxlbmd0aCAtIDE7IGkgPiAwOyAtLWkpIHtcbiAgICB2YXIgaiA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChpICsgMSkpO1xuICAgIHZhciBhaiA9IGFycmF5W2pdO1xuICAgIGFycmF5W2pdID0gYXJyYXlbaV07XG4gICAgYXJyYXlbaV0gPSBhajtcbiAgfVxufTtcblxuZXhwb3J0cy5wcm9wZXJ0eUFjY2Vzc29yID0gZnVuY3Rpb24oc2VsZiwgY29uZmlnLCBmaWVsZCwgc2V0SG9vaykge1xuICByZXR1cm4gZnVuY3Rpb24oeCkge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGNvbmZpZ1tmaWVsZF07XG4gICAgY29uZmlnW2ZpZWxkXSA9IHg7XG4gICAgaWYgKHNldEhvb2spIHNldEhvb2soeCk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG59O1xuXG4vKlxuICogR2l2ZW4gYSBsYXllcmVkLCBkaXJlY3RlZCBncmFwaCB3aXRoIGByYW5rYCBhbmQgYG9yZGVyYCBub2RlIGF0dHJpYnV0ZXMsXG4gKiB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYW4gYXJyYXkgb2Ygb3JkZXJlZCByYW5rcy4gRWFjaCByYW5rIGNvbnRhaW5zIGFuIGFycmF5XG4gKiBvZiB0aGUgaWRzIG9mIHRoZSBub2RlcyBpbiB0aGF0IHJhbmsgaW4gdGhlIG9yZGVyIHNwZWNpZmllZCBieSB0aGUgYG9yZGVyYFxuICogYXR0cmlidXRlLlxuICovXG5leHBvcnRzLm9yZGVyaW5nID0gZnVuY3Rpb24oZykge1xuICB2YXIgb3JkZXJpbmcgPSBbXTtcbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIHZhciByYW5rID0gb3JkZXJpbmdbdmFsdWUucmFua10gfHwgKG9yZGVyaW5nW3ZhbHVlLnJhbmtdID0gW10pO1xuICAgIHJhbmtbdmFsdWUub3JkZXJdID0gdTtcbiAgfSk7XG4gIHJldHVybiBvcmRlcmluZztcbn07XG5cbi8qXG4gKiBBIGZpbHRlciB0aGF0IGNhbiBiZSB1c2VkIHdpdGggYGZpbHRlck5vZGVzYCB0byBnZXQgYSBncmFwaCB0aGF0IG9ubHlcbiAqIGluY2x1ZGVzIG5vZGVzIHRoYXQgZG8gbm90IGNvbnRhaW4gb3RoZXJzIG5vZGVzLlxuICovXG5leHBvcnRzLmZpbHRlck5vblN1YmdyYXBocyA9IGZ1bmN0aW9uKGcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHUpIHtcbiAgICByZXR1cm4gZy5jaGlsZHJlbih1KS5sZW5ndGggPT09IDA7XG4gIH07XG59O1xuXG4vKlxuICogUmV0dXJucyBhIG5ldyBmdW5jdGlvbiB0aGF0IHdyYXBzIGBmdW5jYCB3aXRoIGEgdGltZXIuIFRoZSB3cmFwcGVyIGxvZ3MgdGhlXG4gKiB0aW1lIGl0IHRha2VzIHRvIGV4ZWN1dGUgdGhlIGZ1bmN0aW9uLlxuICpcbiAqIFRoZSB0aW1lciB3aWxsIGJlIGVuYWJsZWQgcHJvdmlkZWQgYGxvZy5sZXZlbCA+PSAxYC5cbiAqL1xuZnVuY3Rpb24gdGltZShuYW1lLCBmdW5jKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhcnQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgbG9nKDEsIG5hbWUgKyAnIHRpbWU6ICcgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBzdGFydCkgKyAnbXMnKTtcbiAgICB9XG4gIH07XG59XG50aW1lLmVuYWJsZWQgPSBmYWxzZTtcblxuZXhwb3J0cy50aW1lID0gdGltZTtcblxuLypcbiAqIEEgZ2xvYmFsIGxvZ2dlciB3aXRoIHRoZSBzcGVjaWZpY2F0aW9uIGBsb2cobGV2ZWwsIG1lc3NhZ2UsIC4uLilgIHRoYXRcbiAqIHdpbGwgbG9nIGEgbWVzc2FnZSB0byB0aGUgY29uc29sZSBpZiBgbG9nLmxldmVsID49IGxldmVsYC5cbiAqL1xuZnVuY3Rpb24gbG9nKGxldmVsKSB7XG4gIGlmIChsb2cubGV2ZWwgPj0gbGV2ZWwpIHtcbiAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgfVxufVxubG9nLmxldmVsID0gMDtcblxuZXhwb3J0cy5sb2cgPSBsb2c7XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICcwLjQuNSc7XG4iLCJleHBvcnRzLlNldCA9IHJlcXVpcmUoJy4vbGliL1NldCcpO1xuZXhwb3J0cy5Qcmlvcml0eVF1ZXVlID0gcmVxdWlyZSgnLi9saWIvUHJpb3JpdHlRdWV1ZScpO1xuZXhwb3J0cy52ZXJzaW9uID0gcmVxdWlyZSgnLi9saWIvdmVyc2lvbicpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBQcmlvcml0eVF1ZXVlO1xuXG4vKipcbiAqIEEgbWluLXByaW9yaXR5IHF1ZXVlIGRhdGEgc3RydWN0dXJlLiBUaGlzIGFsZ29yaXRobSBpcyBkZXJpdmVkIGZyb20gQ29ybWVuLFxuICogZXQgYWwuLCBcIkludHJvZHVjdGlvbiB0byBBbGdvcml0aG1zXCIuIFRoZSBiYXNpYyBpZGVhIG9mIGEgbWluLXByaW9yaXR5XG4gKiBxdWV1ZSBpcyB0aGF0IHlvdSBjYW4gZWZmaWNpZW50bHkgKGluIE8oMSkgdGltZSkgZ2V0IHRoZSBzbWFsbGVzdCBrZXkgaW5cbiAqIHRoZSBxdWV1ZS4gQWRkaW5nIGFuZCByZW1vdmluZyBlbGVtZW50cyB0YWtlcyBPKGxvZyBuKSB0aW1lLiBBIGtleSBjYW5cbiAqIGhhdmUgaXRzIHByaW9yaXR5IGRlY3JlYXNlZCBpbiBPKGxvZyBuKSB0aW1lLlxuICovXG5mdW5jdGlvbiBQcmlvcml0eVF1ZXVlKCkge1xuICB0aGlzLl9hcnIgPSBbXTtcbiAgdGhpcy5fa2V5SW5kaWNlcyA9IHt9O1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIG51bWJlciBvZiBlbGVtZW50cyBpbiB0aGUgcXVldWUuIFRha2VzIGBPKDEpYCB0aW1lLlxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5zaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9hcnIubGVuZ3RoO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBrZXlzIHRoYXQgYXJlIGluIHRoZSBxdWV1ZS4gVGFrZXMgYE8obilgIHRpbWUuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2Fyci5tYXAoZnVuY3Rpb24oeCkgeyByZXR1cm4geC5rZXk7IH0pO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGB0cnVlYCBpZiAqKmtleSoqIGlzIGluIHRoZSBxdWV1ZSBhbmQgYGZhbHNlYCBpZiBub3QuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKGtleSkge1xuICByZXR1cm4ga2V5IGluIHRoaXMuX2tleUluZGljZXM7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHByaW9yaXR5IGZvciAqKmtleSoqLiBJZiAqKmtleSoqIGlzIG5vdCBwcmVzZW50IGluIHRoZSBxdWV1ZVxuICogdGhlbiB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYHVuZGVmaW5lZGAuIFRha2VzIGBPKDEpYCB0aW1lLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBrZXlcbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUucHJpb3JpdHkgPSBmdW5jdGlvbihrZXkpIHtcbiAgdmFyIGluZGV4ID0gdGhpcy5fa2V5SW5kaWNlc1trZXldO1xuICBpZiAoaW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB0aGlzLl9hcnJbaW5kZXhdLnByaW9yaXR5O1xuICB9XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGtleSBmb3IgdGhlIG1pbmltdW0gZWxlbWVudCBpbiB0aGlzIHF1ZXVlLiBJZiB0aGUgcXVldWUgaXNcbiAqIGVtcHR5IHRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yLiBUYWtlcyBgTygxKWAgdGltZS5cbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUubWluID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLnNpemUoKSA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlF1ZXVlIHVuZGVyZmxvd1wiKTtcbiAgfVxuICByZXR1cm4gdGhpcy5fYXJyWzBdLmtleTtcbn07XG5cbi8qKlxuICogSW5zZXJ0cyBhIG5ldyBrZXkgaW50byB0aGUgcHJpb3JpdHkgcXVldWUuIElmIHRoZSBrZXkgYWxyZWFkeSBleGlzdHMgaW5cbiAqIHRoZSBxdWV1ZSB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYGZhbHNlYDsgb3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIGB0cnVlYC5cbiAqIFRha2VzIGBPKG4pYCB0aW1lLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBrZXkgdGhlIGtleSB0byBhZGRcbiAqIEBwYXJhbSB7TnVtYmVyfSBwcmlvcml0eSB0aGUgaW5pdGlhbCBwcmlvcml0eSBmb3IgdGhlIGtleVxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihrZXksIHByaW9yaXR5KSB7XG4gIHZhciBrZXlJbmRpY2VzID0gdGhpcy5fa2V5SW5kaWNlcztcbiAgaWYgKCEoa2V5IGluIGtleUluZGljZXMpKSB7XG4gICAgdmFyIGFyciA9IHRoaXMuX2FycjtcbiAgICB2YXIgaW5kZXggPSBhcnIubGVuZ3RoO1xuICAgIGtleUluZGljZXNba2V5XSA9IGluZGV4O1xuICAgIGFyci5wdXNoKHtrZXk6IGtleSwgcHJpb3JpdHk6IHByaW9yaXR5fSk7XG4gICAgdGhpcy5fZGVjcmVhc2UoaW5kZXgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhbmQgcmV0dXJucyB0aGUgc21hbGxlc3Qga2V5IGluIHRoZSBxdWV1ZS4gVGFrZXMgYE8obG9nIG4pYCB0aW1lLlxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5yZW1vdmVNaW4gPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fc3dhcCgwLCB0aGlzLl9hcnIubGVuZ3RoIC0gMSk7XG4gIHZhciBtaW4gPSB0aGlzLl9hcnIucG9wKCk7XG4gIGRlbGV0ZSB0aGlzLl9rZXlJbmRpY2VzW21pbi5rZXldO1xuICB0aGlzLl9oZWFwaWZ5KDApO1xuICByZXR1cm4gbWluLmtleTtcbn07XG5cbi8qKlxuICogRGVjcmVhc2VzIHRoZSBwcmlvcml0eSBmb3IgKiprZXkqKiB0byAqKnByaW9yaXR5KiouIElmIHRoZSBuZXcgcHJpb3JpdHkgaXNcbiAqIGdyZWF0ZXIgdGhhbiB0aGUgcHJldmlvdXMgcHJpb3JpdHksIHRoaXMgZnVuY3Rpb24gd2lsbCB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0ga2V5IHRoZSBrZXkgZm9yIHdoaWNoIHRvIHJhaXNlIHByaW9yaXR5XG4gKiBAcGFyYW0ge051bWJlcn0gcHJpb3JpdHkgdGhlIG5ldyBwcmlvcml0eSBmb3IgdGhlIGtleVxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5kZWNyZWFzZSA9IGZ1bmN0aW9uKGtleSwgcHJpb3JpdHkpIHtcbiAgdmFyIGluZGV4ID0gdGhpcy5fa2V5SW5kaWNlc1trZXldO1xuICBpZiAocHJpb3JpdHkgPiB0aGlzLl9hcnJbaW5kZXhdLnByaW9yaXR5KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTmV3IHByaW9yaXR5IGlzIGdyZWF0ZXIgdGhhbiBjdXJyZW50IHByaW9yaXR5LiBcIiArXG4gICAgICAgIFwiS2V5OiBcIiArIGtleSArIFwiIE9sZDogXCIgKyB0aGlzLl9hcnJbaW5kZXhdLnByaW9yaXR5ICsgXCIgTmV3OiBcIiArIHByaW9yaXR5KTtcbiAgfVxuICB0aGlzLl9hcnJbaW5kZXhdLnByaW9yaXR5ID0gcHJpb3JpdHk7XG4gIHRoaXMuX2RlY3JlYXNlKGluZGV4KTtcbn07XG5cblByaW9yaXR5UXVldWUucHJvdG90eXBlLl9oZWFwaWZ5ID0gZnVuY3Rpb24oaSkge1xuICB2YXIgYXJyID0gdGhpcy5fYXJyO1xuICB2YXIgbCA9IDIgKiBpLFxuICAgICAgciA9IGwgKyAxLFxuICAgICAgbGFyZ2VzdCA9IGk7XG4gIGlmIChsIDwgYXJyLmxlbmd0aCkge1xuICAgIGxhcmdlc3QgPSBhcnJbbF0ucHJpb3JpdHkgPCBhcnJbbGFyZ2VzdF0ucHJpb3JpdHkgPyBsIDogbGFyZ2VzdDtcbiAgICBpZiAociA8IGFyci5sZW5ndGgpIHtcbiAgICAgIGxhcmdlc3QgPSBhcnJbcl0ucHJpb3JpdHkgPCBhcnJbbGFyZ2VzdF0ucHJpb3JpdHkgPyByIDogbGFyZ2VzdDtcbiAgICB9XG4gICAgaWYgKGxhcmdlc3QgIT09IGkpIHtcbiAgICAgIHRoaXMuX3N3YXAoaSwgbGFyZ2VzdCk7XG4gICAgICB0aGlzLl9oZWFwaWZ5KGxhcmdlc3QpO1xuICAgIH1cbiAgfVxufTtcblxuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuX2RlY3JlYXNlID0gZnVuY3Rpb24oaW5kZXgpIHtcbiAgdmFyIGFyciA9IHRoaXMuX2FycjtcbiAgdmFyIHByaW9yaXR5ID0gYXJyW2luZGV4XS5wcmlvcml0eTtcbiAgdmFyIHBhcmVudDtcbiAgd2hpbGUgKGluZGV4ICE9PSAwKSB7XG4gICAgcGFyZW50ID0gaW5kZXggPj4gMTtcbiAgICBpZiAoYXJyW3BhcmVudF0ucHJpb3JpdHkgPCBwcmlvcml0eSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuX3N3YXAoaW5kZXgsIHBhcmVudCk7XG4gICAgaW5kZXggPSBwYXJlbnQ7XG4gIH1cbn07XG5cblByaW9yaXR5UXVldWUucHJvdG90eXBlLl9zd2FwID0gZnVuY3Rpb24oaSwgaikge1xuICB2YXIgYXJyID0gdGhpcy5fYXJyO1xuICB2YXIga2V5SW5kaWNlcyA9IHRoaXMuX2tleUluZGljZXM7XG4gIHZhciBvcmlnQXJySSA9IGFycltpXTtcbiAgdmFyIG9yaWdBcnJKID0gYXJyW2pdO1xuICBhcnJbaV0gPSBvcmlnQXJySjtcbiAgYXJyW2pdID0gb3JpZ0Fyckk7XG4gIGtleUluZGljZXNbb3JpZ0Fyckoua2V5XSA9IGk7XG4gIGtleUluZGljZXNbb3JpZ0Fyckkua2V5XSA9IGo7XG59O1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTZXQ7XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIG5ldyBTZXQgd2l0aCBhbiBvcHRpb25hbCBzZXQgb2YgYGluaXRpYWxLZXlzYC5cbiAqXG4gKiBJdCBpcyBpbXBvcnRhbnQgdG8gbm90ZSB0aGF0IGtleXMgYXJlIGNvZXJjZWQgdG8gU3RyaW5nIGZvciBtb3N0IHB1cnBvc2VzXG4gKiB3aXRoIHRoaXMgb2JqZWN0LCBzaW1pbGFyIHRvIHRoZSBiZWhhdmlvciBvZiBKYXZhU2NyaXB0J3MgT2JqZWN0LiBGb3JcbiAqIGV4YW1wbGUsIHRoZSBmb2xsb3dpbmcgd2lsbCBhZGQgb25seSBvbmUga2V5OlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTZXQoKTtcbiAqICAgICBzLmFkZCgxKTtcbiAqICAgICBzLmFkZChcIjFcIik7XG4gKlxuICogSG93ZXZlciwgdGhlIHR5cGUgb2YgdGhlIGtleSBpcyBwcmVzZXJ2ZWQgaW50ZXJuYWxseSBzbyB0aGF0IGBrZXlzYCByZXR1cm5zXG4gKiB0aGUgb3JpZ2luYWwga2V5IHNldCB1bmNvZXJjZWQuIEZvciB0aGUgYWJvdmUgZXhhbXBsZSwgYGtleXNgIHdvdWxkIHJldHVyblxuICogYFsxXWAuXG4gKi9cbmZ1bmN0aW9uIFNldChpbml0aWFsS2V5cykge1xuICB0aGlzLl9zaXplID0gMDtcbiAgdGhpcy5fa2V5cyA9IHt9O1xuXG4gIGlmIChpbml0aWFsS2V5cykge1xuICAgIGZvciAodmFyIGkgPSAwLCBpbCA9IGluaXRpYWxLZXlzLmxlbmd0aDsgaSA8IGlsOyArK2kpIHtcbiAgICAgIHRoaXMuYWRkKGluaXRpYWxLZXlzW2ldKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgbmV3IFNldCB0aGF0IHJlcHJlc2VudHMgdGhlIHNldCBpbnRlcnNlY3Rpb24gb2YgdGhlIGFycmF5IG9mIGdpdmVuXG4gKiBzZXRzLlxuICovXG5TZXQuaW50ZXJzZWN0ID0gZnVuY3Rpb24oc2V0cykge1xuICBpZiAoc2V0cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IFNldCgpO1xuICB9XG5cbiAgdmFyIHJlc3VsdCA9IG5ldyBTZXQoIXV0aWwuaXNBcnJheShzZXRzWzBdKSA/IHNldHNbMF0ua2V5cygpIDogc2V0c1swXSk7XG4gIGZvciAodmFyIGkgPSAxLCBpbCA9IHNldHMubGVuZ3RoOyBpIDwgaWw7ICsraSkge1xuICAgIHZhciByZXN1bHRLZXlzID0gcmVzdWx0LmtleXMoKSxcbiAgICAgICAgb3RoZXIgPSAhdXRpbC5pc0FycmF5KHNldHNbaV0pID8gc2V0c1tpXSA6IG5ldyBTZXQoc2V0c1tpXSk7XG4gICAgZm9yICh2YXIgaiA9IDAsIGpsID0gcmVzdWx0S2V5cy5sZW5ndGg7IGogPCBqbDsgKytqKSB7XG4gICAgICB2YXIga2V5ID0gcmVzdWx0S2V5c1tqXTtcbiAgICAgIGlmICghb3RoZXIuaGFzKGtleSkpIHtcbiAgICAgICAgcmVzdWx0LnJlbW92ZShrZXkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgU2V0IHRoYXQgcmVwcmVzZW50cyB0aGUgc2V0IHVuaW9uIG9mIHRoZSBhcnJheSBvZiBnaXZlbiBzZXRzLlxuICovXG5TZXQudW5pb24gPSBmdW5jdGlvbihzZXRzKSB7XG4gIHZhciB0b3RhbEVsZW1zID0gdXRpbC5yZWR1Y2Uoc2V0cywgZnVuY3Rpb24obGhzLCByaHMpIHtcbiAgICByZXR1cm4gbGhzICsgKHJocy5zaXplID8gcmhzLnNpemUoKSA6IHJocy5sZW5ndGgpO1xuICB9LCAwKTtcbiAgdmFyIGFyciA9IG5ldyBBcnJheSh0b3RhbEVsZW1zKTtcblxuICB2YXIgayA9IDA7XG4gIGZvciAodmFyIGkgPSAwLCBpbCA9IHNldHMubGVuZ3RoOyBpIDwgaWw7ICsraSkge1xuICAgIHZhciBjdXIgPSBzZXRzW2ldLFxuICAgICAgICBrZXlzID0gIXV0aWwuaXNBcnJheShjdXIpID8gY3VyLmtleXMoKSA6IGN1cjtcbiAgICBmb3IgKHZhciBqID0gMCwgamwgPSBrZXlzLmxlbmd0aDsgaiA8IGpsOyArK2opIHtcbiAgICAgIGFycltrKytdID0ga2V5c1tqXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IFNldChhcnIpO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBzaXplIG9mIHRoaXMgc2V0IGluIGBPKDEpYCB0aW1lLlxuICovXG5TZXQucHJvdG90eXBlLnNpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX3NpemU7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGtleXMgaW4gdGhpcyBzZXQuIFRha2VzIGBPKG4pYCB0aW1lLlxuICovXG5TZXQucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHZhbHVlcyh0aGlzLl9rZXlzKTtcbn07XG5cbi8qKlxuICogVGVzdHMgaWYgYSBrZXkgaXMgcHJlc2VudCBpbiB0aGlzIFNldC4gUmV0dXJucyBgdHJ1ZWAgaWYgaXQgaXMgYW5kIGBmYWxzZWBcbiAqIGlmIG5vdC4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24oa2V5KSB7XG4gIHJldHVybiBrZXkgaW4gdGhpcy5fa2V5cztcbn07XG5cbi8qKlxuICogQWRkcyBhIG5ldyBrZXkgdG8gdGhpcyBTZXQgaWYgaXQgaXMgbm90IGFscmVhZHkgcHJlc2VudC4gUmV0dXJucyBgdHJ1ZWAgaWZcbiAqIHRoZSBrZXkgd2FzIGFkZGVkIGFuZCBgZmFsc2VgIGlmIGl0IHdhcyBhbHJlYWR5IHByZXNlbnQuIFRha2VzIGBPKDEpYCB0aW1lLlxuICovXG5TZXQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGtleSkge1xuICBpZiAoIShrZXkgaW4gdGhpcy5fa2V5cykpIHtcbiAgICB0aGlzLl9rZXlzW2tleV0gPSBrZXk7XG4gICAgKyt0aGlzLl9zaXplO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhIGtleSBmcm9tIHRoaXMgU2V0LiBJZiB0aGUga2V5IHdhcyByZW1vdmVkIHRoaXMgZnVuY3Rpb24gcmV0dXJuc1xuICogYHRydWVgLiBJZiBub3QsIGl0IHJldHVybnMgYGZhbHNlYC4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oa2V5KSB7XG4gIGlmIChrZXkgaW4gdGhpcy5fa2V5cykge1xuICAgIGRlbGV0ZSB0aGlzLl9rZXlzW2tleV07XG4gICAgLS10aGlzLl9zaXplO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGFsbCB2YWx1ZXMgZm9yIHByb3BlcnRpZXMgb2YgKipvKiouXG4gKi9cbmZ1bmN0aW9uIHZhbHVlcyhvKSB7XG4gIHZhciBrcyA9IE9iamVjdC5rZXlzKG8pLFxuICAgICAgbGVuID0ga3MubGVuZ3RoLFxuICAgICAgcmVzdWx0ID0gbmV3IEFycmF5KGxlbiksXG4gICAgICBpO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSBvW2tzW2ldXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuIiwiLypcbiAqIFRoaXMgcG9seWZpbGwgY29tZXMgZnJvbVxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvaXNBcnJheVxuICovXG5pZighQXJyYXkuaXNBcnJheSkge1xuICBleHBvcnRzLmlzQXJyYXkgPSBmdW5jdGlvbiAodkFyZykge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodkFyZykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG59IGVsc2Uge1xuICBleHBvcnRzLmlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xufVxuXG4vKlxuICogU2xpZ2h0bHkgYWRhcHRlZCBwb2x5ZmlsbCBmcm9tXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9SZWR1Y2VcbiAqL1xuaWYgKCdmdW5jdGlvbicgIT09IHR5cGVvZiBBcnJheS5wcm90b3R5cGUucmVkdWNlKSB7XG4gIGV4cG9ydHMucmVkdWNlID0gZnVuY3Rpb24oYXJyYXksIGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGlmIChudWxsID09PSBhcnJheSB8fCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGFycmF5KSB7XG4gICAgICAvLyBBdCB0aGUgbW9tZW50IGFsbCBtb2Rlcm4gYnJvd3NlcnMsIHRoYXQgc3VwcG9ydCBzdHJpY3QgbW9kZSwgaGF2ZVxuICAgICAgLy8gbmF0aXZlIGltcGxlbWVudGF0aW9uIG9mIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UuIEZvciBpbnN0YW5jZSwgSUU4XG4gICAgICAvLyBkb2VzIG5vdCBzdXBwb3J0IHN0cmljdCBtb2RlLCBzbyB0aGlzIGNoZWNrIGlzIGFjdHVhbGx5IHVzZWxlc3MuXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICdBcnJheS5wcm90b3R5cGUucmVkdWNlIGNhbGxlZCBvbiBudWxsIG9yIHVuZGVmaW5lZCcpO1xuICAgIH1cbiAgICBpZiAoJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNhbGxiYWNrKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGNhbGxiYWNrICsgJyBpcyBub3QgYSBmdW5jdGlvbicpO1xuICAgIH1cbiAgICB2YXIgaW5kZXgsIHZhbHVlLFxuICAgICAgICBsZW5ndGggPSBhcnJheS5sZW5ndGggPj4+IDAsXG4gICAgICAgIGlzVmFsdWVTZXQgPSBmYWxzZTtcbiAgICBpZiAoMSA8IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIHZhbHVlID0gb3B0X2luaXRpYWxWYWx1ZTtcbiAgICAgIGlzVmFsdWVTZXQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGluZGV4ID0gMDsgbGVuZ3RoID4gaW5kZXg7ICsraW5kZXgpIHtcbiAgICAgIGlmIChhcnJheS5oYXNPd25Qcm9wZXJ0eShpbmRleCkpIHtcbiAgICAgICAgaWYgKGlzVmFsdWVTZXQpIHtcbiAgICAgICAgICB2YWx1ZSA9IGNhbGxiYWNrKHZhbHVlLCBhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICAgICAgaXNWYWx1ZVNldCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFpc1ZhbHVlU2V0KSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJyk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbn0gZWxzZSB7XG4gIGV4cG9ydHMucmVkdWNlID0gZnVuY3Rpb24oYXJyYXksIGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5LnJlZHVjZShjYWxsYmFjaywgb3B0X2luaXRpYWxWYWx1ZSk7XG4gIH07XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICcxLjEuMyc7XG4iLCJleHBvcnRzLkdyYXBoID0gcmVxdWlyZShcIi4vbGliL0dyYXBoXCIpO1xuZXhwb3J0cy5EaWdyYXBoID0gcmVxdWlyZShcIi4vbGliL0RpZ3JhcGhcIik7XG5leHBvcnRzLkNHcmFwaCA9IHJlcXVpcmUoXCIuL2xpYi9DR3JhcGhcIik7XG5leHBvcnRzLkNEaWdyYXBoID0gcmVxdWlyZShcIi4vbGliL0NEaWdyYXBoXCIpO1xucmVxdWlyZShcIi4vbGliL2dyYXBoLWNvbnZlcnRlcnNcIik7XG5cbmV4cG9ydHMuYWxnID0ge1xuICBpc0FjeWNsaWM6IHJlcXVpcmUoXCIuL2xpYi9hbGcvaXNBY3ljbGljXCIpLFxuICBjb21wb25lbnRzOiByZXF1aXJlKFwiLi9saWIvYWxnL2NvbXBvbmVudHNcIiksXG4gIGRpamtzdHJhOiByZXF1aXJlKFwiLi9saWIvYWxnL2RpamtzdHJhXCIpLFxuICBkaWprc3RyYUFsbDogcmVxdWlyZShcIi4vbGliL2FsZy9kaWprc3RyYUFsbFwiKSxcbiAgZmluZEN5Y2xlczogcmVxdWlyZShcIi4vbGliL2FsZy9maW5kQ3ljbGVzXCIpLFxuICBmbG95ZFdhcnNoYWxsOiByZXF1aXJlKFwiLi9saWIvYWxnL2Zsb3lkV2Fyc2hhbGxcIiksXG4gIHBvc3RvcmRlcjogcmVxdWlyZShcIi4vbGliL2FsZy9wb3N0b3JkZXJcIiksXG4gIHByZW9yZGVyOiByZXF1aXJlKFwiLi9saWIvYWxnL3ByZW9yZGVyXCIpLFxuICBwcmltOiByZXF1aXJlKFwiLi9saWIvYWxnL3ByaW1cIiksXG4gIHRhcmphbjogcmVxdWlyZShcIi4vbGliL2FsZy90YXJqYW5cIiksXG4gIHRvcHNvcnQ6IHJlcXVpcmUoXCIuL2xpYi9hbGcvdG9wc29ydFwiKVxufTtcblxuZXhwb3J0cy5jb252ZXJ0ZXIgPSB7XG4gIGpzb246IHJlcXVpcmUoXCIuL2xpYi9jb252ZXJ0ZXIvanNvbi5qc1wiKVxufTtcblxudmFyIGZpbHRlciA9IHJlcXVpcmUoXCIuL2xpYi9maWx0ZXJcIik7XG5leHBvcnRzLmZpbHRlciA9IHtcbiAgYWxsOiBmaWx0ZXIuYWxsLFxuICBub2Rlc0Zyb21MaXN0OiBmaWx0ZXIubm9kZXNGcm9tTGlzdFxufTtcblxuZXhwb3J0cy52ZXJzaW9uID0gcmVxdWlyZShcIi4vbGliL3ZlcnNpb25cIik7XG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlR3JhcGg7XG5cbmZ1bmN0aW9uIEJhc2VHcmFwaCgpIHtcbiAgLy8gVGhlIHZhbHVlIGFzc2lnbmVkIHRvIHRoZSBncmFwaCBpdHNlbGYuXG4gIHRoaXMuX3ZhbHVlID0gdW5kZWZpbmVkO1xuXG4gIC8vIE1hcCBvZiBub2RlIGlkIC0+IHsgaWQsIHZhbHVlIH1cbiAgdGhpcy5fbm9kZXMgPSB7fTtcblxuICAvLyBNYXAgb2YgZWRnZSBpZCAtPiB7IGlkLCB1LCB2LCB2YWx1ZSB9XG4gIHRoaXMuX2VkZ2VzID0ge307XG5cbiAgLy8gVXNlZCB0byBnZW5lcmF0ZSBhIHVuaXF1ZSBpZCBpbiB0aGUgZ3JhcGhcbiAgdGhpcy5fbmV4dElkID0gMDtcbn1cblxuLy8gTnVtYmVyIG9mIG5vZGVzXG5CYXNlR3JhcGgucHJvdG90eXBlLm9yZGVyID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9ub2RlcykubGVuZ3RoO1xufTtcblxuLy8gTnVtYmVyIG9mIGVkZ2VzXG5CYXNlR3JhcGgucHJvdG90eXBlLnNpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2VkZ2VzKS5sZW5ndGg7XG59O1xuXG4vLyBBY2Nlc3NvciBmb3IgZ3JhcGggbGV2ZWwgdmFsdWVcbkJhc2VHcmFwaC5wcm90b3R5cGUuZ3JhcGggPSBmdW5jdGlvbih2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB0aGlzLl92YWx1ZTtcbiAgfVxuICB0aGlzLl92YWx1ZSA9IHZhbHVlO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5oYXNOb2RlID0gZnVuY3Rpb24odSkge1xuICByZXR1cm4gdSBpbiB0aGlzLl9ub2Rlcztcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUubm9kZSA9IGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gIHZhciBub2RlID0gdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICBub2RlLnZhbHVlID0gdmFsdWU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLm5vZGVzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBub2RlcyA9IFtdO1xuICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKGlkKSB7IG5vZGVzLnB1c2goaWQpOyB9KTtcbiAgcmV0dXJuIG5vZGVzO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5lYWNoTm9kZSA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgZm9yICh2YXIgayBpbiB0aGlzLl9ub2Rlcykge1xuICAgIHZhciBub2RlID0gdGhpcy5fbm9kZXNba107XG4gICAgZnVuYyhub2RlLmlkLCBub2RlLnZhbHVlKTtcbiAgfVxufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5oYXNFZGdlID0gZnVuY3Rpb24oZSkge1xuICByZXR1cm4gZSBpbiB0aGlzLl9lZGdlcztcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZWRnZSA9IGZ1bmN0aW9uKGUsIHZhbHVlKSB7XG4gIHZhciBlZGdlID0gdGhpcy5fc3RyaWN0R2V0RWRnZShlKTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gZWRnZS52YWx1ZTtcbiAgfVxuICBlZGdlLnZhbHVlID0gdmFsdWU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmVkZ2VzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBlcyA9IFtdO1xuICB0aGlzLmVhY2hFZGdlKGZ1bmN0aW9uKGlkKSB7IGVzLnB1c2goaWQpOyB9KTtcbiAgcmV0dXJuIGVzO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5lYWNoRWRnZSA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgZm9yICh2YXIgayBpbiB0aGlzLl9lZGdlcykge1xuICAgIHZhciBlZGdlID0gdGhpcy5fZWRnZXNba107XG4gICAgZnVuYyhlZGdlLmlkLCBlZGdlLnUsIGVkZ2UudiwgZWRnZS52YWx1ZSk7XG4gIH1cbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuaW5jaWRlbnROb2RlcyA9IGZ1bmN0aW9uKGUpIHtcbiAgdmFyIGVkZ2UgPSB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpO1xuICByZXR1cm4gW2VkZ2UudSwgZWRnZS52XTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuYWRkTm9kZSA9IGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gIGlmICh1ID09PSB1bmRlZmluZWQgfHwgdSA9PT0gbnVsbCkge1xuICAgIGRvIHtcbiAgICAgIHUgPSBcIl9cIiArICgrK3RoaXMuX25leHRJZCk7XG4gICAgfSB3aGlsZSAodGhpcy5oYXNOb2RlKHUpKTtcbiAgfSBlbHNlIGlmICh0aGlzLmhhc05vZGUodSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJHcmFwaCBhbHJlYWR5IGhhcyBub2RlICdcIiArIHUgKyBcIidcIik7XG4gIH1cbiAgdGhpcy5fbm9kZXNbdV0gPSB7IGlkOiB1LCB2YWx1ZTogdmFsdWUgfTtcbiAgcmV0dXJuIHU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmRlbE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHRoaXMuaW5jaWRlbnRFZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHsgdGhpcy5kZWxFZGdlKGUpOyB9LCB0aGlzKTtcbiAgZGVsZXRlIHRoaXMuX25vZGVzW3VdO1xufTtcblxuLy8gaW5NYXAgYW5kIG91dE1hcCBhcmUgb3Bwb3NpdGUgc2lkZXMgb2YgYW4gaW5jaWRlbmNlIG1hcC4gRm9yIGV4YW1wbGUsIGZvclxuLy8gR3JhcGggdGhlc2Ugd291bGQgYm90aCBjb21lIGZyb20gdGhlIF9pbmNpZGVudEVkZ2VzIG1hcCwgd2hpbGUgZm9yIERpZ3JhcGhcbi8vIHRoZXkgd291bGQgY29tZSBmcm9tIF9pbkVkZ2VzIGFuZCBfb3V0RWRnZXMuXG5CYXNlR3JhcGgucHJvdG90eXBlLl9hZGRFZGdlID0gZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUsIGluTWFwLCBvdXRNYXApIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh2KTtcblxuICBpZiAoZSA9PT0gdW5kZWZpbmVkIHx8IGUgPT09IG51bGwpIHtcbiAgICBkbyB7XG4gICAgICBlID0gXCJfXCIgKyAoKyt0aGlzLl9uZXh0SWQpO1xuICAgIH0gd2hpbGUgKHRoaXMuaGFzRWRnZShlKSk7XG4gIH1cbiAgZWxzZSBpZiAodGhpcy5oYXNFZGdlKGUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiR3JhcGggYWxyZWFkeSBoYXMgZWRnZSAnXCIgKyBlICsgXCInXCIpO1xuICB9XG5cbiAgdGhpcy5fZWRnZXNbZV0gPSB7IGlkOiBlLCB1OiB1LCB2OiB2LCB2YWx1ZTogdmFsdWUgfTtcbiAgYWRkRWRnZVRvTWFwKGluTWFwW3ZdLCB1LCBlKTtcbiAgYWRkRWRnZVRvTWFwKG91dE1hcFt1XSwgdiwgZSk7XG5cbiAgcmV0dXJuIGU7XG59O1xuXG4vLyBTZWUgbm90ZSBmb3IgX2FkZEVkZ2UgcmVnYXJkaW5nIGluTWFwIGFuZCBvdXRNYXAuXG5CYXNlR3JhcGgucHJvdG90eXBlLl9kZWxFZGdlID0gZnVuY3Rpb24oZSwgaW5NYXAsIG91dE1hcCkge1xuICB2YXIgZWRnZSA9IHRoaXMuX3N0cmljdEdldEVkZ2UoZSk7XG4gIGRlbEVkZ2VGcm9tTWFwKGluTWFwW2VkZ2Uudl0sIGVkZ2UudSwgZSk7XG4gIGRlbEVkZ2VGcm9tTWFwKG91dE1hcFtlZGdlLnVdLCBlZGdlLnYsIGUpO1xuICBkZWxldGUgdGhpcy5fZWRnZXNbZV07XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGNvcHkgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICBjb3B5LmdyYXBoKHRoaXMuZ3JhcGgoKSk7XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgY29weS5hZGROb2RlKHUsIHZhbHVlKTsgfSk7XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHsgY29weS5hZGRFZGdlKGUsIHUsIHYsIHZhbHVlKTsgfSk7XG4gIGNvcHkuX25leHRJZCA9IHRoaXMuX25leHRJZDtcbiAgcmV0dXJuIGNvcHk7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmZpbHRlck5vZGVzID0gZnVuY3Rpb24oZmlsdGVyKSB7XG4gIHZhciBjb3B5ID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgY29weS5ncmFwaCh0aGlzLmdyYXBoKCkpO1xuICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgaWYgKGZpbHRlcih1KSkge1xuICAgICAgY29weS5hZGROb2RlKHUsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICB0aGlzLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgaWYgKGNvcHkuaGFzTm9kZSh1KSAmJiBjb3B5Lmhhc05vZGUodikpIHtcbiAgICAgIGNvcHkuYWRkRWRnZShlLCB1LCB2LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGNvcHk7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLl9zdHJpY3RHZXROb2RlID0gZnVuY3Rpb24odSkge1xuICB2YXIgbm9kZSA9IHRoaXMuX25vZGVzW3VdO1xuICBpZiAobm9kZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTm9kZSAnXCIgKyB1ICsgXCInIGlzIG5vdCBpbiBncmFwaFwiKTtcbiAgfVxuICByZXR1cm4gbm9kZTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuX3N0cmljdEdldEVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIHZhciBlZGdlID0gdGhpcy5fZWRnZXNbZV07XG4gIGlmIChlZGdlID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFZGdlICdcIiArIGUgKyBcIicgaXMgbm90IGluIGdyYXBoXCIpO1xuICB9XG4gIHJldHVybiBlZGdlO1xufTtcblxuZnVuY3Rpb24gYWRkRWRnZVRvTWFwKG1hcCwgdiwgZSkge1xuICAobWFwW3ZdIHx8IChtYXBbdl0gPSBuZXcgU2V0KCkpKS5hZGQoZSk7XG59XG5cbmZ1bmN0aW9uIGRlbEVkZ2VGcm9tTWFwKG1hcCwgdiwgZSkge1xuICB2YXIgdkVudHJ5ID0gbWFwW3ZdO1xuICB2RW50cnkucmVtb3ZlKGUpO1xuICBpZiAodkVudHJ5LnNpemUoKSA9PT0gMCkge1xuICAgIGRlbGV0ZSBtYXBbdl07XG4gIH1cbn1cblxuIiwidmFyIERpZ3JhcGggPSByZXF1aXJlKFwiLi9EaWdyYXBoXCIpLFxuICAgIGNvbXBvdW5kaWZ5ID0gcmVxdWlyZShcIi4vY29tcG91bmRpZnlcIik7XG5cbnZhciBDRGlncmFwaCA9IGNvbXBvdW5kaWZ5KERpZ3JhcGgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENEaWdyYXBoO1xuXG5DRGlncmFwaC5mcm9tRGlncmFwaCA9IGZ1bmN0aW9uKHNyYykge1xuICB2YXIgZyA9IG5ldyBDRGlncmFwaCgpLFxuICAgICAgZ3JhcGhWYWx1ZSA9IHNyYy5ncmFwaCgpO1xuXG4gIGlmIChncmFwaFZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICBnLmdyYXBoKGdyYXBoVmFsdWUpO1xuICB9XG5cbiAgc3JjLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGcuYWRkTm9kZSh1KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGROb2RlKHUsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICBzcmMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdiwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBnO1xufTtcblxuQ0RpZ3JhcGgucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkNEaWdyYXBoIFwiICsgSlNPTi5zdHJpbmdpZnkodGhpcywgbnVsbCwgMik7XG59O1xuIiwidmFyIEdyYXBoID0gcmVxdWlyZShcIi4vR3JhcGhcIiksXG4gICAgY29tcG91bmRpZnkgPSByZXF1aXJlKFwiLi9jb21wb3VuZGlmeVwiKTtcblxudmFyIENHcmFwaCA9IGNvbXBvdW5kaWZ5KEdyYXBoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBDR3JhcGg7XG5cbkNHcmFwaC5mcm9tR3JhcGggPSBmdW5jdGlvbihzcmMpIHtcbiAgdmFyIGcgPSBuZXcgQ0dyYXBoKCksXG4gICAgICBncmFwaFZhbHVlID0gc3JjLmdyYXBoKCk7XG5cbiAgaWYgKGdyYXBoVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIGcuZ3JhcGgoZ3JhcGhWYWx1ZSk7XG4gIH1cblxuICBzcmMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5hZGROb2RlKHUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZE5vZGUodSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHNyYy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGc7XG59O1xuXG5DR3JhcGgucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkNHcmFwaCBcIiArIEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIDIpO1xufTtcbiIsIi8qXG4gKiBUaGlzIGZpbGUgaXMgb3JnYW5pemVkIHdpdGggaW4gdGhlIGZvbGxvd2luZyBvcmRlcjpcbiAqXG4gKiBFeHBvcnRzXG4gKiBHcmFwaCBjb25zdHJ1Y3RvcnNcbiAqIEdyYXBoIHF1ZXJpZXMgKGUuZy4gbm9kZXMoKSwgZWRnZXMoKVxuICogR3JhcGggbXV0YXRvcnNcbiAqIEhlbHBlciBmdW5jdGlvbnNcbiAqL1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIiksXG4gICAgQmFzZUdyYXBoID0gcmVxdWlyZShcIi4vQmFzZUdyYXBoXCIpLFxuLyoganNoaW50IC1XMDc5ICovXG4gICAgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gRGlncmFwaDtcblxuLypcbiAqIENvbnN0cnVjdG9yIHRvIGNyZWF0ZSBhIG5ldyBkaXJlY3RlZCBtdWx0aS1ncmFwaC5cbiAqL1xuZnVuY3Rpb24gRGlncmFwaCgpIHtcbiAgQmFzZUdyYXBoLmNhbGwodGhpcyk7XG5cbiAgLyohIE1hcCBvZiBzb3VyY2VJZCAtPiB7dGFyZ2V0SWQgLT4gU2V0IG9mIGVkZ2UgaWRzfSAqL1xuICB0aGlzLl9pbkVkZ2VzID0ge307XG5cbiAgLyohIE1hcCBvZiB0YXJnZXRJZCAtPiB7c291cmNlSWQgLT4gU2V0IG9mIGVkZ2UgaWRzfSAqL1xuICB0aGlzLl9vdXRFZGdlcyA9IHt9O1xufVxuXG5EaWdyYXBoLnByb3RvdHlwZSA9IG5ldyBCYXNlR3JhcGgoKTtcbkRpZ3JhcGgucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gRGlncmFwaDtcblxuLypcbiAqIEFsd2F5cyByZXR1cm5zIGB0cnVlYC5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuaXNEaXJlY3RlZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBzdWNjZXNzb3JzIG9mIHRoZSBub2RlIHdpdGggdGhlIGlkIGB1YC4gVGhhdCBpcywgYWxsIG5vZGVzXG4gKiB0aGF0IGhhdmUgdGhlIG5vZGUgYHVgIGFzIHRoZWlyIHNvdXJjZSBhcmUgcmV0dXJuZWQuXG4gKiBcbiAqIElmIG5vIG5vZGUgYHVgIGV4aXN0cyBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnN1Y2Nlc3NvcnMgPSBmdW5jdGlvbih1KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9vdXRFZGdlc1t1XSlcbiAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24odikgeyByZXR1cm4gdGhpcy5fbm9kZXNbdl0uaWQ7IH0sIHRoaXMpO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIHByZWRlY2Vzc29ycyBvZiB0aGUgbm9kZSB3aXRoIHRoZSBpZCBgdWAuIFRoYXQgaXMsIGFsbCBub2Rlc1xuICogdGhhdCBoYXZlIHRoZSBub2RlIGB1YCBhcyB0aGVpciB0YXJnZXQgYXJlIHJldHVybmVkLlxuICogXG4gKiBJZiBubyBub2RlIGB1YCBleGlzdHMgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5wcmVkZWNlc3NvcnMgPSBmdW5jdGlvbih1KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9pbkVkZ2VzW3VdKVxuICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbih2KSB7IHJldHVybiB0aGlzLl9ub2Rlc1t2XS5pZDsgfSwgdGhpcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgbm9kZXMgdGhhdCBhcmUgYWRqYWNlbnQgdG8gdGhlIG5vZGUgd2l0aCB0aGUgaWQgYHVgLiBJbiBvdGhlclxuICogd29yZHMsIHRoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgc2V0IG9mIGFsbCBzdWNjZXNzb3JzIGFuZCBwcmVkZWNlc3NvcnMgb2ZcbiAqIG5vZGUgYHVgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5uZWlnaGJvcnMgPSBmdW5jdGlvbih1KSB7XG4gIHJldHVybiBTZXQudW5pb24oW3RoaXMuc3VjY2Vzc29ycyh1KSwgdGhpcy5wcmVkZWNlc3NvcnModSldKS5rZXlzKCk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgbm9kZXMgaW4gdGhlIGdyYXBoIHRoYXQgaGF2ZSBubyBpbi1lZGdlcy5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuc291cmNlcyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHJldHVybiB0aGlzLl9maWx0ZXJOb2RlcyhmdW5jdGlvbih1KSB7XG4gICAgLy8gVGhpcyBjb3VsZCBoYXZlIGJldHRlciBzcGFjZSBjaGFyYWN0ZXJpc3RpY3MgaWYgd2UgaGFkIGFuIGluRGVncmVlIGZ1bmN0aW9uLlxuICAgIHJldHVybiBzZWxmLmluRWRnZXModSkubGVuZ3RoID09PSAwO1xuICB9KTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBub2RlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIG5vIG91dC1lZGdlcy5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuc2lua3MgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gdGhpcy5fZmlsdGVyTm9kZXMoZnVuY3Rpb24odSkge1xuICAgIC8vIFRoaXMgY291bGQgaGF2ZSBiZXR0ZXIgc3BhY2UgY2hhcmFjdGVyaXN0aWNzIGlmIHdlIGhhdmUgYW4gb3V0RGVncmVlIGZ1bmN0aW9uLlxuICAgIHJldHVybiBzZWxmLm91dEVkZ2VzKHUpLmxlbmd0aCA9PT0gMDtcbiAgfSk7XG59O1xuXG4vKlxuICogUmV0dXJucyB0aGUgc291cmNlIG5vZGUgaW5jaWRlbnQgb24gdGhlIGVkZ2UgaWRlbnRpZmllZCBieSB0aGUgaWQgYGVgLiBJZiBub1xuICogc3VjaCBlZGdlIGV4aXN0cyBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGUgYW4gZWRnZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5zb3VyY2UgPSBmdW5jdGlvbihlKSB7XG4gIHJldHVybiB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpLnU7XG59O1xuXG4vKlxuICogUmV0dXJucyB0aGUgdGFyZ2V0IG5vZGUgaW5jaWRlbnQgb24gdGhlIGVkZ2UgaWRlbnRpZmllZCBieSB0aGUgaWQgYGVgLiBJZiBub1xuICogc3VjaCBlZGdlIGV4aXN0cyBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGUgYW4gZWRnZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS50YXJnZXQgPSBmdW5jdGlvbihlKSB7XG4gIHJldHVybiB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpLnY7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBpZHMgZm9yIGFsbCBlZGdlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIHRoZSBub2RlXG4gKiBgdGFyZ2V0YCBhcyB0aGVpciB0YXJnZXQuIElmIHRoZSBub2RlIGB0YXJnZXRgIGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhpc1xuICogZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIE9wdGlvbmFsbHkgYSBgc291cmNlYCBub2RlIGNhbiBhbHNvIGJlIHNwZWNpZmllZC4gVGhpcyBjYXVzZXMgdGhlIHJlc3VsdHNcbiAqIHRvIGJlIGZpbHRlcmVkIHN1Y2ggdGhhdCBvbmx5IGVkZ2VzIGZyb20gYHNvdXJjZWAgdG8gYHRhcmdldGAgYXJlIGluY2x1ZGVkLlxuICogSWYgdGhlIG5vZGUgYHNvdXJjZWAgaXMgc3BlY2lmaWVkIGJ1dCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoZW4gdGhpcyBmdW5jdGlvblxuICogcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0YXJnZXQgdGhlIHRhcmdldCBub2RlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gW3NvdXJjZV0gYW4gb3B0aW9uYWwgc291cmNlIG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuaW5FZGdlcyA9IGZ1bmN0aW9uKHRhcmdldCwgc291cmNlKSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodGFyZ2V0KTtcbiAgdmFyIHJlc3VsdHMgPSBTZXQudW5pb24odXRpbC52YWx1ZXModGhpcy5faW5FZGdlc1t0YXJnZXRdKSkua2V5cygpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHNvdXJjZSk7XG4gICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIHRoaXMuc291cmNlKGUpID09PSBzb3VyY2U7IH0sIHRoaXMpO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgaWRzIGZvciBhbGwgZWRnZXMgaW4gdGhlIGdyYXBoIHRoYXQgaGF2ZSB0aGUgbm9kZVxuICogYHNvdXJjZWAgYXMgdGhlaXIgc291cmNlLiBJZiB0aGUgbm9kZSBgc291cmNlYCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoaXNcbiAqIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBPcHRpb25hbGx5IGEgYHRhcmdldGAgbm9kZSBtYXkgYWxzbyBiZSBzcGVjaWZpZWQuIFRoaXMgY2F1c2VzIHRoZSByZXN1bHRzXG4gKiB0byBiZSBmaWx0ZXJlZCBzdWNoIHRoYXQgb25seSBlZGdlcyBmcm9tIGBzb3VyY2VgIHRvIGB0YXJnZXRgIGFyZSBpbmNsdWRlZC5cbiAqIElmIHRoZSBub2RlIGB0YXJnZXRgIGlzIHNwZWNpZmllZCBidXQgaXMgbm90IGluIHRoZSBncmFwaCB0aGVuIHRoaXMgZnVuY3Rpb25cbiAqIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc291cmNlIHRoZSBzb3VyY2Ugbm9kZSBpZFxuICogQHBhcmFtIHtTdHJpbmd9IFt0YXJnZXRdIGFuIG9wdGlvbmFsIHRhcmdldCBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLm91dEVkZ2VzID0gZnVuY3Rpb24oc291cmNlLCB0YXJnZXQpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZShzb3VyY2UpO1xuICB2YXIgcmVzdWx0cyA9IFNldC51bmlvbih1dGlsLnZhbHVlcyh0aGlzLl9vdXRFZGdlc1tzb3VyY2VdKSkua2V5cygpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHRhcmdldCk7XG4gICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIHRoaXMudGFyZ2V0KGUpID09PSB0YXJnZXQ7IH0sIHRoaXMpO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgaWRzIGZvciBhbGwgZWRnZXMgaW4gdGhlIGdyYXBoIHRoYXQgaGF2ZSB0aGUgYHVgIGFzXG4gKiB0aGVpciBzb3VyY2Ugb3IgdGhlaXIgdGFyZ2V0LiBJZiB0aGUgbm9kZSBgdWAgaXMgbm90IGluIHRoZSBncmFwaCB0aGlzXG4gKiBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogT3B0aW9uYWxseSBhIGB2YCBub2RlIG1heSBhbHNvIGJlIHNwZWNpZmllZC4gVGhpcyBjYXVzZXMgdGhlIHJlc3VsdHMgdG8gYmVcbiAqIGZpbHRlcmVkIHN1Y2ggdGhhdCBvbmx5IGVkZ2VzIGJldHdlZW4gYHVgIGFuZCBgdmAgLSBpbiBlaXRoZXIgZGlyZWN0aW9uIC1cbiAqIGFyZSBpbmNsdWRlZC4gSUYgdGhlIG5vZGUgYHZgIGlzIHNwZWNpZmllZCBidXQgbm90IGluIHRoZSBncmFwaCB0aGVuIHRoaXNcbiAqIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSB0aGUgbm9kZSBmb3Igd2hpY2ggdG8gZmluZCBpbmNpZGVudCBlZGdlc1xuICogQHBhcmFtIHtTdHJpbmd9IFt2XSBvcHRpb24gbm9kZSB0aGF0IG11c3QgYmUgYWRqYWNlbnQgdG8gYHVgXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmluY2lkZW50RWRnZXMgPSBmdW5jdGlvbih1LCB2KSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgIHJldHVybiBTZXQudW5pb24oW3RoaXMub3V0RWRnZXModSwgdiksIHRoaXMub3V0RWRnZXModiwgdSldKS5rZXlzKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFNldC51bmlvbihbdGhpcy5pbkVkZ2VzKHUpLCB0aGlzLm91dEVkZ2VzKHUpXSkua2V5cygpO1xuICB9XG59O1xuXG4vKlxuICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIGdyYXBoLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJEaWdyYXBoIFwiICsgSlNPTi5zdHJpbmdpZnkodGhpcywgbnVsbCwgMik7XG59O1xuXG4vKlxuICogQWRkcyBhIG5ldyBub2RlIHdpdGggdGhlIGlkIGB1YCB0byB0aGUgZ3JhcGggYW5kIGFzc2lnbnMgaXQgdGhlIHZhbHVlXG4gKiBgdmFsdWVgLiBJZiBhIG5vZGUgd2l0aCB0aGUgaWQgaXMgYWxyZWFkeSBhIHBhcnQgb2YgdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb25cbiAqIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBbdmFsdWVdIGFuIG9wdGlvbmFsIHZhbHVlIHRvIGF0dGFjaCB0byB0aGUgbm9kZVxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5hZGROb2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgdSA9IEJhc2VHcmFwaC5wcm90b3R5cGUuYWRkTm9kZS5jYWxsKHRoaXMsIHUsIHZhbHVlKTtcbiAgdGhpcy5faW5FZGdlc1t1XSA9IHt9O1xuICB0aGlzLl9vdXRFZGdlc1t1XSA9IHt9O1xuICByZXR1cm4gdTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGEgbm9kZSBmcm9tIHRoZSBncmFwaCB0aGF0IGhhcyB0aGUgaWQgYHVgLiBBbnkgZWRnZXMgaW5jaWRlbnQgb24gdGhlXG4gKiBub2RlIGFyZSBhbHNvIHJlbW92ZWQuIElmIHRoZSBncmFwaCBkb2VzIG5vdCBjb250YWluIGEgbm9kZSB3aXRoIHRoZSBpZCB0aGlzXG4gKiBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5kZWxOb2RlID0gZnVuY3Rpb24odSkge1xuICBCYXNlR3JhcGgucHJvdG90eXBlLmRlbE5vZGUuY2FsbCh0aGlzLCB1KTtcbiAgZGVsZXRlIHRoaXMuX2luRWRnZXNbdV07XG4gIGRlbGV0ZSB0aGlzLl9vdXRFZGdlc1t1XTtcbn07XG5cbi8qXG4gKiBBZGRzIGEgbmV3IGVkZ2UgdG8gdGhlIGdyYXBoIHdpdGggdGhlIGlkIGBlYCBmcm9tIGEgbm9kZSB3aXRoIHRoZSBpZCBgc291cmNlYFxuICogdG8gYSBub2RlIHdpdGggYW4gaWQgYHRhcmdldGAgYW5kIGFzc2lnbnMgaXQgdGhlIHZhbHVlIGB2YWx1ZWAuIFRoaXMgZ3JhcGhcbiAqIGFsbG93cyBtb3JlIHRoYW4gb25lIGVkZ2UgZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YCBhcyBsb25nIGFzIHRoZSBpZCBgZWBcbiAqIGlzIHVuaXF1ZSBpbiB0aGUgc2V0IG9mIGVkZ2VzLiBJZiBgZWAgaXMgYG51bGxgIHRoZSBncmFwaCB3aWxsIGFzc2lnbiBhXG4gKiB1bmlxdWUgaWRlbnRpZmllciB0byB0aGUgZWRnZS5cbiAqXG4gKiBJZiBgc291cmNlYCBvciBgdGFyZ2V0YCBhcmUgbm90IHByZXNlbnQgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gd2lsbFxuICogdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IFtlXSBhbiBlZGdlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gc291cmNlIHRoZSBzb3VyY2Ugbm9kZSBpZFxuICogQHBhcmFtIHtTdHJpbmd9IHRhcmdldCB0aGUgdGFyZ2V0IG5vZGUgaWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBbdmFsdWVdIGFuIG9wdGlvbmFsIHZhbHVlIHRvIGF0dGFjaCB0byB0aGUgZWRnZVxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5hZGRFZGdlID0gZnVuY3Rpb24oZSwgc291cmNlLCB0YXJnZXQsIHZhbHVlKSB7XG4gIHJldHVybiBCYXNlR3JhcGgucHJvdG90eXBlLl9hZGRFZGdlLmNhbGwodGhpcywgZSwgc291cmNlLCB0YXJnZXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2luRWRnZXMsIHRoaXMuX291dEVkZ2VzKTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGFuIGVkZ2UgaW4gdGhlIGdyYXBoIHdpdGggdGhlIGlkIGBlYC4gSWYgbm8gZWRnZSBpbiB0aGUgZ3JhcGggaGFzXG4gKiB0aGUgaWQgYGVgIHRoaXMgZnVuY3Rpb24gd2lsbCB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZSBhbiBlZGdlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmRlbEVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIEJhc2VHcmFwaC5wcm90b3R5cGUuX2RlbEVkZ2UuY2FsbCh0aGlzLCBlLCB0aGlzLl9pbkVkZ2VzLCB0aGlzLl9vdXRFZGdlcyk7XG59O1xuXG4vLyBVbmxpa2UgQmFzZUdyYXBoLmZpbHRlck5vZGVzLCB0aGlzIGhlbHBlciBqdXN0IHJldHVybnMgbm9kZXMgdGhhdFxuLy8gc2F0aXNmeSBhIHByZWRpY2F0ZS5cbkRpZ3JhcGgucHJvdG90eXBlLl9maWx0ZXJOb2RlcyA9IGZ1bmN0aW9uKHByZWQpIHtcbiAgdmFyIGZpbHRlcmVkID0gW107XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgIGlmIChwcmVkKHUpKSB7XG4gICAgICBmaWx0ZXJlZC5wdXNoKHUpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBmaWx0ZXJlZDtcbn07XG5cbiIsIi8qXG4gKiBUaGlzIGZpbGUgaXMgb3JnYW5pemVkIHdpdGggaW4gdGhlIGZvbGxvd2luZyBvcmRlcjpcbiAqXG4gKiBFeHBvcnRzXG4gKiBHcmFwaCBjb25zdHJ1Y3RvcnNcbiAqIEdyYXBoIHF1ZXJpZXMgKGUuZy4gbm9kZXMoKSwgZWRnZXMoKVxuICogR3JhcGggbXV0YXRvcnNcbiAqIEhlbHBlciBmdW5jdGlvbnNcbiAqL1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIiksXG4gICAgQmFzZUdyYXBoID0gcmVxdWlyZShcIi4vQmFzZUdyYXBoXCIpLFxuLyoganNoaW50IC1XMDc5ICovXG4gICAgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gR3JhcGg7XG5cbi8qXG4gKiBDb25zdHJ1Y3RvciB0byBjcmVhdGUgYSBuZXcgdW5kaXJlY3RlZCBtdWx0aS1ncmFwaC5cbiAqL1xuZnVuY3Rpb24gR3JhcGgoKSB7XG4gIEJhc2VHcmFwaC5jYWxsKHRoaXMpO1xuXG4gIC8qISBNYXAgb2Ygbm9kZUlkIC0+IHsgb3RoZXJOb2RlSWQgLT4gU2V0IG9mIGVkZ2UgaWRzIH0gKi9cbiAgdGhpcy5faW5jaWRlbnRFZGdlcyA9IHt9O1xufVxuXG5HcmFwaC5wcm90b3R5cGUgPSBuZXcgQmFzZUdyYXBoKCk7XG5HcmFwaC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBHcmFwaDtcblxuLypcbiAqIEFsd2F5cyByZXR1cm5zIGBmYWxzZWAuXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5pc0RpcmVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBub2RlcyB0aGF0IGFyZSBhZGphY2VudCB0byB0aGUgbm9kZSB3aXRoIHRoZSBpZCBgdWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5uZWlnaGJvcnMgPSBmdW5jdGlvbih1KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9pbmNpZGVudEVkZ2VzW3VdKVxuICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbih2KSB7IHJldHVybiB0aGlzLl9ub2Rlc1t2XS5pZDsgfSwgdGhpcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBpZHMgZm9yIGFsbCBlZGdlcyBpbiB0aGUgZ3JhcGggdGhhdCBhcmUgaW5jaWRlbnQgb24gYHVgLlxuICogSWYgdGhlIG5vZGUgYHVgIGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogT3B0aW9uYWxseSBhIGB2YCBub2RlIG1heSBhbHNvIGJlIHNwZWNpZmllZC4gVGhpcyBjYXVzZXMgdGhlIHJlc3VsdHMgdG8gYmVcbiAqIGZpbHRlcmVkIHN1Y2ggdGhhdCBvbmx5IGVkZ2VzIGJldHdlZW4gYHVgIGFuZCBgdmAgYXJlIGluY2x1ZGVkLiBJZiB0aGUgbm9kZVxuICogYHZgIGlzIHNwZWNpZmllZCBidXQgbm90IGluIHRoZSBncmFwaCB0aGVuIHRoaXMgZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IHRoZSBub2RlIGZvciB3aGljaCB0byBmaW5kIGluY2lkZW50IGVkZ2VzXG4gKiBAcGFyYW0ge1N0cmluZ30gW3ZdIG9wdGlvbiBub2RlIHRoYXQgbXVzdCBiZSBhZGphY2VudCB0byBgdWBcbiAqL1xuR3JhcGgucHJvdG90eXBlLmluY2lkZW50RWRnZXMgPSBmdW5jdGlvbih1LCB2KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgIHRoaXMuX3N0cmljdEdldE5vZGUodik7XG4gICAgcmV0dXJuIHYgaW4gdGhpcy5faW5jaWRlbnRFZGdlc1t1XSA/IHRoaXMuX2luY2lkZW50RWRnZXNbdV1bdl0ua2V5cygpIDogW107XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFNldC51bmlvbih1dGlsLnZhbHVlcyh0aGlzLl9pbmNpZGVudEVkZ2VzW3VdKSkua2V5cygpO1xuICB9XG59O1xuXG4vKlxuICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIGdyYXBoLlxuICovXG5HcmFwaC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiR3JhcGggXCIgKyBKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCAyKTtcbn07XG5cbi8qXG4gKiBBZGRzIGEgbmV3IG5vZGUgd2l0aCB0aGUgaWQgYHVgIHRvIHRoZSBncmFwaCBhbmQgYXNzaWducyBpdCB0aGUgdmFsdWVcbiAqIGB2YWx1ZWAuIElmIGEgbm9kZSB3aXRoIHRoZSBpZCBpcyBhbHJlYWR5IGEgcGFydCBvZiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvblxuICogdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gYW4gb3B0aW9uYWwgdmFsdWUgdG8gYXR0YWNoIHRvIHRoZSBub2RlXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5hZGROb2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgdSA9IEJhc2VHcmFwaC5wcm90b3R5cGUuYWRkTm9kZS5jYWxsKHRoaXMsIHUsIHZhbHVlKTtcbiAgdGhpcy5faW5jaWRlbnRFZGdlc1t1XSA9IHt9O1xuICByZXR1cm4gdTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGEgbm9kZSBmcm9tIHRoZSBncmFwaCB0aGF0IGhhcyB0aGUgaWQgYHVgLiBBbnkgZWRnZXMgaW5jaWRlbnQgb24gdGhlXG4gKiBub2RlIGFyZSBhbHNvIHJlbW92ZWQuIElmIHRoZSBncmFwaCBkb2VzIG5vdCBjb250YWluIGEgbm9kZSB3aXRoIHRoZSBpZCB0aGlzXG4gKiBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5HcmFwaC5wcm90b3R5cGUuZGVsTm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgQmFzZUdyYXBoLnByb3RvdHlwZS5kZWxOb2RlLmNhbGwodGhpcywgdSk7XG4gIGRlbGV0ZSB0aGlzLl9pbmNpZGVudEVkZ2VzW3VdO1xufTtcblxuLypcbiAqIEFkZHMgYSBuZXcgZWRnZSB0byB0aGUgZ3JhcGggd2l0aCB0aGUgaWQgYGVgIGJldHdlZW4gYSBub2RlIHdpdGggdGhlIGlkIGB1YFxuICogYW5kIGEgbm9kZSB3aXRoIGFuIGlkIGB2YCBhbmQgYXNzaWducyBpdCB0aGUgdmFsdWUgYHZhbHVlYC4gVGhpcyBncmFwaFxuICogYWxsb3dzIG1vcmUgdGhhbiBvbmUgZWRnZSBiZXR3ZWVuIGB1YCBhbmQgYHZgIGFzIGxvbmcgYXMgdGhlIGlkIGBlYFxuICogaXMgdW5pcXVlIGluIHRoZSBzZXQgb2YgZWRnZXMuIElmIGBlYCBpcyBgbnVsbGAgdGhlIGdyYXBoIHdpbGwgYXNzaWduIGFcbiAqIHVuaXF1ZSBpZGVudGlmaWVyIHRvIHRoZSBlZGdlLlxuICpcbiAqIElmIGB1YCBvciBgdmAgYXJlIG5vdCBwcmVzZW50IGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW5cbiAqIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZV0gYW4gZWRnZSBpZFxuICogQHBhcmFtIHtTdHJpbmd9IHUgdGhlIG5vZGUgaWQgb2Ygb25lIG9mIHRoZSBhZGphY2VudCBub2Rlc1xuICogQHBhcmFtIHtTdHJpbmd9IHYgdGhlIG5vZGUgaWQgb2YgdGhlIG90aGVyIGFkamFjZW50IG5vZGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbdmFsdWVdIGFuIG9wdGlvbmFsIHZhbHVlIHRvIGF0dGFjaCB0byB0aGUgZWRnZVxuICovXG5HcmFwaC5wcm90b3R5cGUuYWRkRWRnZSA9IGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gIHJldHVybiBCYXNlR3JhcGgucHJvdG90eXBlLl9hZGRFZGdlLmNhbGwodGhpcywgZSwgdSwgdiwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5jaWRlbnRFZGdlcywgdGhpcy5faW5jaWRlbnRFZGdlcyk7XG59O1xuXG4vKlxuICogUmVtb3ZlcyBhbiBlZGdlIGluIHRoZSBncmFwaCB3aXRoIHRoZSBpZCBgZWAuIElmIG5vIGVkZ2UgaW4gdGhlIGdyYXBoIGhhc1xuICogdGhlIGlkIGBlYCB0aGlzIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGUgYW4gZWRnZSBpZFxuICovXG5HcmFwaC5wcm90b3R5cGUuZGVsRWRnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgQmFzZUdyYXBoLnByb3RvdHlwZS5fZGVsRWRnZS5jYWxsKHRoaXMsIGUsIHRoaXMuX2luY2lkZW50RWRnZXMsIHRoaXMuX2luY2lkZW50RWRnZXMpO1xufTtcblxuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gY29tcG9uZW50cztcblxuLyoqXG4gKiBGaW5kcyBhbGwgW2Nvbm5lY3RlZCBjb21wb25lbnRzXVtdIGluIGEgZ3JhcGggYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgdGhlc2VcbiAqIGNvbXBvbmVudHMuIEVhY2ggY29tcG9uZW50IGlzIGl0c2VsZiBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSBpZHMgb2Ygbm9kZXNcbiAqIGluIHRoZSBjb21wb25lbnQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIHdpdGggdW5kaXJlY3RlZCBHcmFwaHMuXG4gKlxuICogW2Nvbm5lY3RlZCBjb21wb25lbnRzXTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Db25uZWN0ZWRfY29tcG9uZW50XyhncmFwaF90aGVvcnkpXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBjb21wb25lbnRzXG4gKi9cbmZ1bmN0aW9uIGNvbXBvbmVudHMoZykge1xuICB2YXIgcmVzdWx0cyA9IFtdO1xuICB2YXIgdmlzaXRlZCA9IG5ldyBTZXQoKTtcblxuICBmdW5jdGlvbiBkZnModiwgY29tcG9uZW50KSB7XG4gICAgaWYgKCF2aXNpdGVkLmhhcyh2KSkge1xuICAgICAgdmlzaXRlZC5hZGQodik7XG4gICAgICBjb21wb25lbnQucHVzaCh2KTtcbiAgICAgIGcubmVpZ2hib3JzKHYpLmZvckVhY2goZnVuY3Rpb24odykge1xuICAgICAgICBkZnModywgY29tcG9uZW50KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGcubm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gW107XG4gICAgZGZzKHYsIGNvbXBvbmVudCk7XG4gICAgaWYgKGNvbXBvbmVudC5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHRzLnB1c2goY29tcG9uZW50KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHRzO1xufVxuIiwidmFyIFByaW9yaXR5UXVldWUgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5Qcmlvcml0eVF1ZXVlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRpamtzdHJhO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gaXMgYW4gaW1wbGVtZW50YXRpb24gb2YgW0RpamtzdHJhJ3MgYWxnb3JpdGhtXVtdIHdoaWNoIGZpbmRzXG4gKiB0aGUgc2hvcnRlc3QgcGF0aCBmcm9tICoqc291cmNlKiogdG8gYWxsIG90aGVyIG5vZGVzIGluICoqZyoqLiBUaGlzXG4gKiBmdW5jdGlvbiByZXR1cm5zIGEgbWFwIG9mIGB1IC0+IHsgZGlzdGFuY2UsIHByZWRlY2Vzc29yIH1gLiBUaGUgZGlzdGFuY2VcbiAqIHByb3BlcnR5IGhvbGRzIHRoZSBzdW0gb2YgdGhlIHdlaWdodHMgZnJvbSAqKnNvdXJjZSoqIHRvIGB1YCBhbG9uZyB0aGVcbiAqIHNob3J0ZXN0IHBhdGggb3IgYE51bWJlci5QT1NJVElWRV9JTkZJTklUWWAgaWYgdGhlcmUgaXMgbm8gcGF0aCBmcm9tXG4gKiAqKnNvdXJjZSoqLiBUaGUgcHJlZGVjZXNzb3IgcHJvcGVydHkgY2FuIGJlIHVzZWQgdG8gd2FsayB0aGUgaW5kaXZpZHVhbFxuICogZWxlbWVudHMgb2YgdGhlIHBhdGggZnJvbSAqKnNvdXJjZSoqIHRvICoqdSoqIGluIHJldmVyc2Ugb3JkZXIuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgd2VpZ2h0RnVuYyhlKWAgd2hpY2ggcmV0dXJucyB0aGVcbiAqIHdlaWdodCBvZiB0aGUgZWRnZSBgZWAuIElmIG5vIHdlaWdodEZ1bmMgaXMgc3VwcGxpZWQgdGhlbiBlYWNoIGVkZ2UgaXNcbiAqIGFzc3VtZWQgdG8gaGF2ZSBhIHdlaWdodCBvZiAxLiBUaGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvciBpZiBhbnkgb2ZcbiAqIHRoZSB0cmF2ZXJzZWQgZWRnZXMgaGF2ZSBhIG5lZ2F0aXZlIGVkZ2Ugd2VpZ2h0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYGluY2lkZW50RnVuYyh1KWAgd2hpY2ggcmV0dXJucyB0aGUgaWRzIG9mXG4gKiBhbGwgZWRnZXMgaW5jaWRlbnQgdG8gdGhlIG5vZGUgYHVgIGZvciB0aGUgcHVycG9zZXMgb2Ygc2hvcnRlc3QgcGF0aFxuICogdHJhdmVyc2FsLiBCeSBkZWZhdWx0IHRoaXMgZnVuY3Rpb24gdXNlcyB0aGUgYGcub3V0RWRnZXNgIGZvciBEaWdyYXBocyBhbmRcbiAqIGBnLmluY2lkZW50RWRnZXNgIGZvciBHcmFwaHMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBgTygofEV8ICsgfFZ8KSAqIGxvZyB8VnwpYCB0aW1lLlxuICpcbiAqIFtEaWprc3RyYSdzIGFsZ29yaXRobV06IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRGlqa3N0cmElMjdzX2FsZ29yaXRobVxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3Igc2hvcnRlc3QgcGF0aHMgZnJvbSAqKnNvdXJjZSoqXG4gKiBAcGFyYW0ge09iamVjdH0gc291cmNlIHRoZSBzb3VyY2UgZnJvbSB3aGljaCB0byBzdGFydCB0aGUgc2VhcmNoXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbd2VpZ2h0RnVuY10gb3B0aW9uYWwgd2VpZ2h0IGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaW5jaWRlbnRGdW5jXSBvcHRpb25hbCBpbmNpZGVudCBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkaWprc3RyYShnLCBzb3VyY2UsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYykge1xuICB2YXIgcmVzdWx0cyA9IHt9LFxuICAgICAgcHEgPSBuZXcgUHJpb3JpdHlRdWV1ZSgpO1xuXG4gIGZ1bmN0aW9uIHVwZGF0ZU5laWdoYm9ycyhlKSB7XG4gICAgdmFyIGluY2lkZW50Tm9kZXMgPSBnLmluY2lkZW50Tm9kZXMoZSksXG4gICAgICAgIHYgPSBpbmNpZGVudE5vZGVzWzBdICE9PSB1ID8gaW5jaWRlbnROb2Rlc1swXSA6IGluY2lkZW50Tm9kZXNbMV0sXG4gICAgICAgIHZFbnRyeSA9IHJlc3VsdHNbdl0sXG4gICAgICAgIHdlaWdodCA9IHdlaWdodEZ1bmMoZSksXG4gICAgICAgIGRpc3RhbmNlID0gdUVudHJ5LmRpc3RhbmNlICsgd2VpZ2h0O1xuXG4gICAgaWYgKHdlaWdodCA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImRpamtzdHJhIGRvZXMgbm90IGFsbG93IG5lZ2F0aXZlIGVkZ2Ugd2VpZ2h0cy4gQmFkIGVkZ2U6IFwiICsgZSArIFwiIFdlaWdodDogXCIgKyB3ZWlnaHQpO1xuICAgIH1cblxuICAgIGlmIChkaXN0YW5jZSA8IHZFbnRyeS5kaXN0YW5jZSkge1xuICAgICAgdkVudHJ5LmRpc3RhbmNlID0gZGlzdGFuY2U7XG4gICAgICB2RW50cnkucHJlZGVjZXNzb3IgPSB1O1xuICAgICAgcHEuZGVjcmVhc2UodiwgZGlzdGFuY2UpO1xuICAgIH1cbiAgfVxuXG4gIHdlaWdodEZ1bmMgPSB3ZWlnaHRGdW5jIHx8IGZ1bmN0aW9uKCkgeyByZXR1cm4gMTsgfTtcbiAgaW5jaWRlbnRGdW5jID0gaW5jaWRlbnRGdW5jIHx8IChnLmlzRGlyZWN0ZWQoKVxuICAgICAgPyBmdW5jdGlvbih1KSB7IHJldHVybiBnLm91dEVkZ2VzKHUpOyB9XG4gICAgICA6IGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGcuaW5jaWRlbnRFZGdlcyh1KTsgfSk7XG5cbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgdmFyIGRpc3RhbmNlID0gdSA9PT0gc291cmNlID8gMCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICByZXN1bHRzW3VdID0geyBkaXN0YW5jZTogZGlzdGFuY2UgfTtcbiAgICBwcS5hZGQodSwgZGlzdGFuY2UpO1xuICB9KTtcblxuICB2YXIgdSwgdUVudHJ5O1xuICB3aGlsZSAocHEuc2l6ZSgpID4gMCkge1xuICAgIHUgPSBwcS5yZW1vdmVNaW4oKTtcbiAgICB1RW50cnkgPSByZXN1bHRzW3VdO1xuICAgIGlmICh1RW50cnkuZGlzdGFuY2UgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaW5jaWRlbnRGdW5jKHUpLmZvckVhY2godXBkYXRlTmVpZ2hib3JzKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHRzO1xufVxuIiwidmFyIGRpamtzdHJhID0gcmVxdWlyZShcIi4vZGlqa3N0cmFcIik7XG5cbm1vZHVsZS5leHBvcnRzID0gZGlqa3N0cmFBbGw7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBmaW5kcyB0aGUgc2hvcnRlc3QgcGF0aCBmcm9tIGVhY2ggbm9kZSB0byBldmVyeSBvdGhlclxuICogcmVhY2hhYmxlIG5vZGUgaW4gdGhlIGdyYXBoLiBJdCBpcyBzaW1pbGFyIHRvIFthbGcuZGlqa3N0cmFdW10sIGJ1dFxuICogaW5zdGVhZCBvZiByZXR1cm5pbmcgYSBzaW5nbGUtc291cmNlIGFycmF5LCBpdCByZXR1cm5zIGEgbWFwcGluZyBvZlxuICogb2YgYHNvdXJjZSAtPiBhbGcuZGlqa3N0YShnLCBzb3VyY2UsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYylgLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYHdlaWdodEZ1bmMoZSlgIHdoaWNoIHJldHVybnMgdGhlXG4gKiB3ZWlnaHQgb2YgdGhlIGVkZ2UgYGVgLiBJZiBubyB3ZWlnaHRGdW5jIGlzIHN1cHBsaWVkIHRoZW4gZWFjaCBlZGdlIGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYSB3ZWlnaHQgb2YgMS4gVGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IgaWYgYW55IG9mXG4gKiB0aGUgdHJhdmVyc2VkIGVkZ2VzIGhhdmUgYSBuZWdhdGl2ZSBlZGdlIHdlaWdodC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGBpbmNpZGVudEZ1bmModSlgIHdoaWNoIHJldHVybnMgdGhlIGlkcyBvZlxuICogYWxsIGVkZ2VzIGluY2lkZW50IHRvIHRoZSBub2RlIGB1YCBmb3IgdGhlIHB1cnBvc2VzIG9mIHNob3J0ZXN0IHBhdGhcbiAqIHRyYXZlcnNhbC4gQnkgZGVmYXVsdCB0aGlzIGZ1bmN0aW9uIHVzZXMgdGhlIGBvdXRFZGdlc2AgZnVuY3Rpb24gb24gdGhlXG4gKiBzdXBwbGllZCBncmFwaC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGBPKHxWfCAqICh8RXwgKyB8VnwpICogbG9nIHxWfClgIHRpbWUuXG4gKlxuICogW2FsZy5kaWprc3RyYV06IGRpamtzdHJhLmpzLmh0bWwjZGlqa3N0cmFcbiAqXG4gKiBAcGFyYW0ge0dyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIHNob3J0ZXN0IHBhdGhzIGZyb20gKipzb3VyY2UqKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW3dlaWdodEZ1bmNdIG9wdGlvbmFsIHdlaWdodCBmdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2luY2lkZW50RnVuY10gb3B0aW9uYWwgaW5jaWRlbnQgZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gZGlqa3N0cmFBbGwoZywgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKSB7XG4gIHZhciByZXN1bHRzID0ge307XG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgIHJlc3VsdHNbdV0gPSBkaWprc3RyYShnLCB1LCB3ZWlnaHRGdW5jLCBpbmNpZGVudEZ1bmMpO1xuICB9KTtcbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJ2YXIgdGFyamFuID0gcmVxdWlyZShcIi4vdGFyamFuXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZpbmRDeWNsZXM7XG5cbi8qXG4gKiBHaXZlbiBhIERpZ3JhcGggKipnKiogdGhpcyBmdW5jdGlvbiByZXR1cm5zIGFsbCBub2RlcyB0aGF0IGFyZSBwYXJ0IG9mIGFcbiAqIGN5Y2xlLiBTaW5jZSB0aGVyZSBtYXkgYmUgbW9yZSB0aGFuIG9uZSBjeWNsZSBpbiBhIGdyYXBoIHRoaXMgZnVuY3Rpb25cbiAqIHJldHVybnMgYW4gYXJyYXkgb2YgdGhlc2UgY3ljbGVzLCB3aGVyZSBlYWNoIGN5Y2xlIGlzIGl0c2VsZiByZXByZXNlbnRlZFxuICogYnkgYW4gYXJyYXkgb2YgaWRzIGZvciBlYWNoIG5vZGUgaW52b2x2ZWQgaW4gdGhhdCBjeWNsZS5cbiAqXG4gKiBbYWxnLmlzQWN5Y2xpY11bXSBpcyBtb3JlIGVmZmljaWVudCBpZiB5b3Ugb25seSBuZWVkIHRvIGRldGVybWluZSB3aGV0aGVyXG4gKiBhIGdyYXBoIGhhcyBhIGN5Y2xlIG9yIG5vdC5cbiAqXG4gKiBbYWxnLmlzQWN5Y2xpY106IGlzQWN5Y2xpYy5qcy5odG1sI2lzQWN5Y2xpY1xuICpcbiAqIEBwYXJhbSB7RGlncmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBjeWNsZXMuXG4gKi9cbmZ1bmN0aW9uIGZpbmRDeWNsZXMoZykge1xuICByZXR1cm4gdGFyamFuKGcpLmZpbHRlcihmdW5jdGlvbihjbXB0KSB7IHJldHVybiBjbXB0Lmxlbmd0aCA+IDE7IH0pO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmbG95ZFdhcnNoYWxsO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gaXMgYW4gaW1wbGVtZW50YXRpb24gb2YgdGhlIFtGbG95ZC1XYXJzaGFsbCBhbGdvcml0aG1dW10sXG4gKiB3aGljaCBmaW5kcyB0aGUgc2hvcnRlc3QgcGF0aCBmcm9tIGVhY2ggbm9kZSB0byBldmVyeSBvdGhlciByZWFjaGFibGUgbm9kZVxuICogaW4gdGhlIGdyYXBoLiBJdCBpcyBzaW1pbGFyIHRvIFthbGcuZGlqa3N0cmFBbGxdW10sIGJ1dCBpdCBoYW5kbGVzIG5lZ2F0aXZlXG4gKiBlZGdlIHdlaWdodHMgYW5kIGlzIG1vcmUgZWZmaWNpZW50IGZvciBzb21lIHR5cGVzIG9mIGdyYXBocy4gVGhpcyBmdW5jdGlvblxuICogcmV0dXJucyBhIG1hcCBvZiBgc291cmNlIC0+IHsgdGFyZ2V0IC0+IHsgZGlzdGFuY2UsIHByZWRlY2Vzc29yIH1gLiBUaGVcbiAqIGRpc3RhbmNlIHByb3BlcnR5IGhvbGRzIHRoZSBzdW0gb2YgdGhlIHdlaWdodHMgZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YFxuICogYWxvbmcgdGhlIHNob3J0ZXN0IHBhdGggb2YgYE51bWJlci5QT1NJVElWRV9JTkZJTklUWWAgaWYgdGhlcmUgaXMgbm8gcGF0aFxuICogZnJvbSBgc291cmNlYC4gVGhlIHByZWRlY2Vzc29yIHByb3BlcnR5IGNhbiBiZSB1c2VkIHRvIHdhbGsgdGhlIGluZGl2aWR1YWxcbiAqIGVsZW1lbnRzIG9mIHRoZSBwYXRoIGZyb20gYHNvdXJjZWAgdG8gYHRhcmdldGAgaW4gcmV2ZXJzZSBvcmRlci5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGB3ZWlnaHRGdW5jKGUpYCB3aGljaCByZXR1cm5zIHRoZVxuICogd2VpZ2h0IG9mIHRoZSBlZGdlIGBlYC4gSWYgbm8gd2VpZ2h0RnVuYyBpcyBzdXBwbGllZCB0aGVuIGVhY2ggZWRnZSBpc1xuICogYXNzdW1lZCB0byBoYXZlIGEgd2VpZ2h0IG9mIDEuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgaW5jaWRlbnRGdW5jKHUpYCB3aGljaCByZXR1cm5zIHRoZSBpZHMgb2ZcbiAqIGFsbCBlZGdlcyBpbmNpZGVudCB0byB0aGUgbm9kZSBgdWAgZm9yIHRoZSBwdXJwb3NlcyBvZiBzaG9ydGVzdCBwYXRoXG4gKiB0cmF2ZXJzYWwuIEJ5IGRlZmF1bHQgdGhpcyBmdW5jdGlvbiB1c2VzIHRoZSBgb3V0RWRnZXNgIGZ1bmN0aW9uIG9uIHRoZVxuICogc3VwcGxpZWQgZ3JhcGguXG4gKlxuICogVGhpcyBhbGdvcml0aG0gdGFrZXMgTyh8VnxeMykgdGltZS5cbiAqXG4gKiBbRmxveWQtV2Fyc2hhbGwgYWxnb3JpdGhtXTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRmxveWQtV2Fyc2hhbGxfYWxnb3JpdGhtXG4gKiBbYWxnLmRpamtzdHJhQWxsXTogZGlqa3N0cmFBbGwuanMuaHRtbCNkaWprc3RyYUFsbFxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3Igc2hvcnRlc3QgcGF0aHMgZnJvbSAqKnNvdXJjZSoqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbd2VpZ2h0RnVuY10gb3B0aW9uYWwgd2VpZ2h0IGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaW5jaWRlbnRGdW5jXSBvcHRpb25hbCBpbmNpZGVudCBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBmbG95ZFdhcnNoYWxsKGcsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYykge1xuICB2YXIgcmVzdWx0cyA9IHt9LFxuICAgICAgbm9kZXMgPSBnLm5vZGVzKCk7XG5cbiAgd2VpZ2h0RnVuYyA9IHdlaWdodEZ1bmMgfHwgZnVuY3Rpb24oKSB7IHJldHVybiAxOyB9O1xuICBpbmNpZGVudEZ1bmMgPSBpbmNpZGVudEZ1bmMgfHwgKGcuaXNEaXJlY3RlZCgpXG4gICAgICA/IGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGcub3V0RWRnZXModSk7IH1cbiAgICAgIDogZnVuY3Rpb24odSkgeyByZXR1cm4gZy5pbmNpZGVudEVkZ2VzKHUpOyB9KTtcblxuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICByZXN1bHRzW3VdID0ge307XG4gICAgcmVzdWx0c1t1XVt1XSA9IHsgZGlzdGFuY2U6IDAgfTtcbiAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh1ICE9PSB2KSB7XG4gICAgICAgIHJlc3VsdHNbdV1bdl0gPSB7IGRpc3RhbmNlOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkgfTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpbmNpZGVudEZ1bmModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICB2YXIgaW5jaWRlbnROb2RlcyA9IGcuaW5jaWRlbnROb2RlcyhlKSxcbiAgICAgICAgICB2ID0gaW5jaWRlbnROb2Rlc1swXSAhPT0gdSA/IGluY2lkZW50Tm9kZXNbMF0gOiBpbmNpZGVudE5vZGVzWzFdLFxuICAgICAgICAgIGQgPSB3ZWlnaHRGdW5jKGUpO1xuICAgICAgaWYgKGQgPCByZXN1bHRzW3VdW3ZdLmRpc3RhbmNlKSB7XG4gICAgICAgIHJlc3VsdHNbdV1bdl0gPSB7IGRpc3RhbmNlOiBkLCBwcmVkZWNlc3NvcjogdSB9O1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcblxuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICB2YXIgcm93SyA9IHJlc3VsdHNba107XG4gICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbihpKSB7XG4gICAgICB2YXIgcm93SSA9IHJlc3VsdHNbaV07XG4gICAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKGopIHtcbiAgICAgICAgdmFyIGlrID0gcm93SVtrXTtcbiAgICAgICAgdmFyIGtqID0gcm93S1tqXTtcbiAgICAgICAgdmFyIGlqID0gcm93SVtqXTtcbiAgICAgICAgdmFyIGFsdERpc3RhbmNlID0gaWsuZGlzdGFuY2UgKyBrai5kaXN0YW5jZTtcbiAgICAgICAgaWYgKGFsdERpc3RhbmNlIDwgaWouZGlzdGFuY2UpIHtcbiAgICAgICAgICBpai5kaXN0YW5jZSA9IGFsdERpc3RhbmNlO1xuICAgICAgICAgIGlqLnByZWRlY2Vzc29yID0ga2oucHJlZGVjZXNzb3I7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsInZhciB0b3Bzb3J0ID0gcmVxdWlyZShcIi4vdG9wc29ydFwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpc0FjeWNsaWM7XG5cbi8qXG4gKiBHaXZlbiBhIERpZ3JhcGggKipnKiogdGhpcyBmdW5jdGlvbiByZXR1cm5zIGB0cnVlYCBpZiB0aGUgZ3JhcGggaGFzIG5vXG4gKiBjeWNsZXMgYW5kIHJldHVybnMgYGZhbHNlYCBpZiBpdCBkb2VzLiBUaGlzIGFsZ29yaXRobSByZXR1cm5zIGFzIHNvb24gYXMgaXRcbiAqIGRldGVjdHMgdGhlIGZpcnN0IGN5Y2xlLlxuICpcbiAqIFVzZSBbYWxnLmZpbmRDeWNsZXNdW10gaWYgeW91IG5lZWQgdGhlIGFjdHVhbCBsaXN0IG9mIGN5Y2xlcyBpbiBhIGdyYXBoLlxuICpcbiAqIFthbGcuZmluZEN5Y2xlc106IGZpbmRDeWNsZXMuanMuaHRtbCNmaW5kQ3ljbGVzXG4gKlxuICogQHBhcmFtIHtEaWdyYXBofSBnIHRoZSBncmFwaCB0byB0ZXN0IGZvciBjeWNsZXNcbiAqL1xuZnVuY3Rpb24gaXNBY3ljbGljKGcpIHtcbiAgdHJ5IHtcbiAgICB0b3Bzb3J0KGcpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUgaW5zdGFuY2VvZiB0b3Bzb3J0LkN5Y2xlRXhjZXB0aW9uKSByZXR1cm4gZmFsc2U7XG4gICAgdGhyb3cgZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBvc3RvcmRlcjtcblxuLy8gUG9zdG9yZGVyIHRyYXZlcnNhbCBvZiBnLCBjYWxsaW5nIGYgZm9yIGVhY2ggdmlzaXRlZCBub2RlLiBBc3N1bWVzIHRoZSBncmFwaFxuLy8gaXMgYSB0cmVlLlxuZnVuY3Rpb24gcG9zdG9yZGVyKGcsIHJvb3QsIGYpIHtcbiAgdmFyIHZpc2l0ZWQgPSBuZXcgU2V0KCk7XG4gIGlmIChnLmlzRGlyZWN0ZWQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoaXMgZnVuY3Rpb24gb25seSB3b3JrcyBmb3IgdW5kaXJlY3RlZCBncmFwaHNcIik7XG4gIH1cbiAgZnVuY3Rpb24gZGZzKHUsIHByZXYpIHtcbiAgICBpZiAodmlzaXRlZC5oYXModSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBpbnB1dCBncmFwaCBpcyBub3QgYSB0cmVlOiBcIiArIGcpO1xuICAgIH1cbiAgICB2aXNpdGVkLmFkZCh1KTtcbiAgICBnLm5laWdoYm9ycyh1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh2ICE9PSBwcmV2KSBkZnModiwgdSk7XG4gICAgfSk7XG4gICAgZih1KTtcbiAgfVxuICBkZnMocm9vdCk7XG59XG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBwcmVvcmRlcjtcblxuLy8gUHJlb3JkZXIgdHJhdmVyc2FsIG9mIGcsIGNhbGxpbmcgZiBmb3IgZWFjaCB2aXNpdGVkIG5vZGUuIEFzc3VtZXMgdGhlIGdyYXBoXG4vLyBpcyBhIHRyZWUuXG5mdW5jdGlvbiBwcmVvcmRlcihnLCByb290LCBmKSB7XG4gIHZhciB2aXNpdGVkID0gbmV3IFNldCgpO1xuICBpZiAoZy5pc0RpcmVjdGVkKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIGZ1bmN0aW9uIG9ubHkgd29ya3MgZm9yIHVuZGlyZWN0ZWQgZ3JhcGhzXCIpO1xuICB9XG4gIGZ1bmN0aW9uIGRmcyh1LCBwcmV2KSB7XG4gICAgaWYgKHZpc2l0ZWQuaGFzKHUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgaW5wdXQgZ3JhcGggaXMgbm90IGEgdHJlZTogXCIgKyBnKTtcbiAgICB9XG4gICAgdmlzaXRlZC5hZGQodSk7XG4gICAgZih1KTtcbiAgICBnLm5laWdoYm9ycyh1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh2ICE9PSBwcmV2KSBkZnModiwgdSk7XG4gICAgfSk7XG4gIH1cbiAgZGZzKHJvb3QpO1xufVxuIiwidmFyIEdyYXBoID0gcmVxdWlyZShcIi4uL0dyYXBoXCIpLFxuICAgIFByaW9yaXR5UXVldWUgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5Qcmlvcml0eVF1ZXVlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHByaW07XG5cbi8qKlxuICogW1ByaW0ncyBhbGdvcml0aG1dW10gdGFrZXMgYSBjb25uZWN0ZWQgdW5kaXJlY3RlZCBncmFwaCBhbmQgZ2VuZXJhdGVzIGFcbiAqIFttaW5pbXVtIHNwYW5uaW5nIHRyZWVdW10uIFRoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgbWluaW11bSBzcGFubmluZ1xuICogdHJlZSBhcyBhbiB1bmRpcmVjdGVkIGdyYXBoLiBUaGlzIGFsZ29yaXRobSBpcyBkZXJpdmVkIGZyb20gdGhlIGRlc2NyaXB0aW9uXG4gKiBpbiBcIkludHJvZHVjdGlvbiB0byBBbGdvcml0aG1zXCIsIFRoaXJkIEVkaXRpb24sIENvcm1lbiwgZXQgYWwuLCBQZyA2MzQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhIGB3ZWlnaHRGdW5jKGUpYCB3aGljaCByZXR1cm5zIHRoZSB3ZWlnaHQgb2YgdGhlIGVkZ2VcbiAqIGBlYC4gSXQgdGhyb3dzIGFuIEVycm9yIGlmIHRoZSBncmFwaCBpcyBub3QgY29ubmVjdGVkLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYE8ofEV8IGxvZyB8VnwpYCB0aW1lLlxuICpcbiAqIFtQcmltJ3MgYWxnb3JpdGhtXTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUHJpbSdzX2FsZ29yaXRobVxuICogW21pbmltdW0gc3Bhbm5pbmcgdHJlZV06IGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL01pbmltdW1fc3Bhbm5pbmdfdHJlZVxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIG1pbmltdW0gc3Bhbm5pbmcgdHJlZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gd2VpZ2h0RnVuYyB0aGUgd2VpZ2h0IGZ1bmN0aW9uIHRvIHVzZVxuICovXG5mdW5jdGlvbiBwcmltKGcsIHdlaWdodEZ1bmMpIHtcbiAgdmFyIHJlc3VsdCA9IG5ldyBHcmFwaCgpLFxuICAgICAgcGFyZW50cyA9IHt9LFxuICAgICAgcHEgPSBuZXcgUHJpb3JpdHlRdWV1ZSgpLFxuICAgICAgdTtcblxuICBmdW5jdGlvbiB1cGRhdGVOZWlnaGJvcnMoZSkge1xuICAgIHZhciBpbmNpZGVudE5vZGVzID0gZy5pbmNpZGVudE5vZGVzKGUpLFxuICAgICAgICB2ID0gaW5jaWRlbnROb2Rlc1swXSAhPT0gdSA/IGluY2lkZW50Tm9kZXNbMF0gOiBpbmNpZGVudE5vZGVzWzFdLFxuICAgICAgICBwcmkgPSBwcS5wcmlvcml0eSh2KTtcbiAgICBpZiAocHJpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBlZGdlV2VpZ2h0ID0gd2VpZ2h0RnVuYyhlKTtcbiAgICAgIGlmIChlZGdlV2VpZ2h0IDwgcHJpKSB7XG4gICAgICAgIHBhcmVudHNbdl0gPSB1O1xuICAgICAgICBwcS5kZWNyZWFzZSh2LCBlZGdlV2VpZ2h0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoZy5vcmRlcigpID09PSAwKSB7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgIHBxLmFkZCh1LCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpO1xuICAgIHJlc3VsdC5hZGROb2RlKHUpO1xuICB9KTtcblxuICAvLyBTdGFydCBmcm9tIGFuIGFyYml0cmFyeSBub2RlXG4gIHBxLmRlY3JlYXNlKGcubm9kZXMoKVswXSwgMCk7XG5cbiAgdmFyIGluaXQgPSBmYWxzZTtcbiAgd2hpbGUgKHBxLnNpemUoKSA+IDApIHtcbiAgICB1ID0gcHEucmVtb3ZlTWluKCk7XG4gICAgaWYgKHUgaW4gcGFyZW50cykge1xuICAgICAgcmVzdWx0LmFkZEVkZ2UobnVsbCwgdSwgcGFyZW50c1t1XSk7XG4gICAgfSBlbHNlIGlmIChpbml0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBncmFwaCBpcyBub3QgY29ubmVjdGVkOiBcIiArIGcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbml0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBnLmluY2lkZW50RWRnZXModSkuZm9yRWFjaCh1cGRhdGVOZWlnaGJvcnMpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gdGFyamFuO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gaXMgYW4gaW1wbGVtZW50YXRpb24gb2YgW1RhcmphbidzIGFsZ29yaXRobV1bXSB3aGljaCBmaW5kc1xuICogYWxsIFtzdHJvbmdseSBjb25uZWN0ZWQgY29tcG9uZW50c11bXSBpbiB0aGUgZGlyZWN0ZWQgZ3JhcGggKipnKiouIEVhY2hcbiAqIHN0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnQgaXMgY29tcG9zZWQgb2Ygbm9kZXMgdGhhdCBjYW4gcmVhY2ggYWxsIG90aGVyXG4gKiBub2RlcyBpbiB0aGUgY29tcG9uZW50IHZpYSBkaXJlY3RlZCBlZGdlcy4gQSBzdHJvbmdseSBjb25uZWN0ZWQgY29tcG9uZW50XG4gKiBjYW4gY29uc2lzdCBvZiBhIHNpbmdsZSBub2RlIGlmIHRoYXQgbm9kZSBjYW5ub3QgYm90aCByZWFjaCBhbmQgYmUgcmVhY2hlZFxuICogYnkgYW55IG90aGVyIHNwZWNpZmljIG5vZGUgaW4gdGhlIGdyYXBoLiBDb21wb25lbnRzIG9mIG1vcmUgdGhhbiBvbmUgbm9kZVxuICogYXJlIGd1YXJhbnRlZWQgdG8gaGF2ZSBhdCBsZWFzdCBvbmUgY3ljbGUuXG4gKlxuICogVGhpcyBmdW5jdGlvbiByZXR1cm5zIGFuIGFycmF5IG9mIGNvbXBvbmVudHMuIEVhY2ggY29tcG9uZW50IGlzIGl0c2VsZiBhblxuICogYXJyYXkgdGhhdCBjb250YWlucyB0aGUgaWRzIG9mIGFsbCBub2RlcyBpbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIFtUYXJqYW4ncyBhbGdvcml0aG1dOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1RhcmphbidzX3N0cm9uZ2x5X2Nvbm5lY3RlZF9jb21wb25lbnRzX2FsZ29yaXRobVxuICogW3N0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnRzXTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9TdHJvbmdseV9jb25uZWN0ZWRfY29tcG9uZW50XG4gKlxuICogQHBhcmFtIHtEaWdyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIHN0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnRzXG4gKi9cbmZ1bmN0aW9uIHRhcmphbihnKSB7XG4gIGlmICghZy5pc0RpcmVjdGVkKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0YXJqYW4gY2FuIG9ubHkgYmUgYXBwbGllZCB0byBhIGRpcmVjdGVkIGdyYXBoLiBCYWQgaW5wdXQ6IFwiICsgZyk7XG4gIH1cblxuICB2YXIgaW5kZXggPSAwLFxuICAgICAgc3RhY2sgPSBbXSxcbiAgICAgIHZpc2l0ZWQgPSB7fSwgLy8gbm9kZSBpZCAtPiB7IG9uU3RhY2ssIGxvd2xpbmssIGluZGV4IH1cbiAgICAgIHJlc3VsdHMgPSBbXTtcblxuICBmdW5jdGlvbiBkZnModSkge1xuICAgIHZhciBlbnRyeSA9IHZpc2l0ZWRbdV0gPSB7XG4gICAgICBvblN0YWNrOiB0cnVlLFxuICAgICAgbG93bGluazogaW5kZXgsXG4gICAgICBpbmRleDogaW5kZXgrK1xuICAgIH07XG4gICAgc3RhY2sucHVzaCh1KTtcblxuICAgIGcuc3VjY2Vzc29ycyh1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghKHYgaW4gdmlzaXRlZCkpIHtcbiAgICAgICAgZGZzKHYpO1xuICAgICAgICBlbnRyeS5sb3dsaW5rID0gTWF0aC5taW4oZW50cnkubG93bGluaywgdmlzaXRlZFt2XS5sb3dsaW5rKTtcbiAgICAgIH0gZWxzZSBpZiAodmlzaXRlZFt2XS5vblN0YWNrKSB7XG4gICAgICAgIGVudHJ5Lmxvd2xpbmsgPSBNYXRoLm1pbihlbnRyeS5sb3dsaW5rLCB2aXNpdGVkW3ZdLmluZGV4KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChlbnRyeS5sb3dsaW5rID09PSBlbnRyeS5pbmRleCkge1xuICAgICAgdmFyIGNtcHQgPSBbXSxcbiAgICAgICAgICB2O1xuICAgICAgZG8ge1xuICAgICAgICB2ID0gc3RhY2sucG9wKCk7XG4gICAgICAgIHZpc2l0ZWRbdl0ub25TdGFjayA9IGZhbHNlO1xuICAgICAgICBjbXB0LnB1c2godik7XG4gICAgICB9IHdoaWxlICh1ICE9PSB2KTtcbiAgICAgIHJlc3VsdHMucHVzaChjbXB0KTtcbiAgICB9XG4gIH1cblxuICBnLm5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgaWYgKCEodSBpbiB2aXNpdGVkKSkge1xuICAgICAgZGZzKHUpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHRvcHNvcnQ7XG50b3Bzb3J0LkN5Y2xlRXhjZXB0aW9uID0gQ3ljbGVFeGNlcHRpb247XG5cbi8qXG4gKiBHaXZlbiBhIGdyYXBoICoqZyoqLCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYW4gb3JkZXJlZCBsaXN0IG9mIG5vZGVzIHN1Y2hcbiAqIHRoYXQgZm9yIGVhY2ggZWRnZSBgdSAtPiB2YCwgYHVgIGFwcGVhcnMgYmVmb3JlIGB2YCBpbiB0aGUgbGlzdC4gSWYgdGhlXG4gKiBncmFwaCBoYXMgYSBjeWNsZSBpdCBpcyBpbXBvc3NpYmxlIHRvIGdlbmVyYXRlIHN1Y2ggYSBsaXN0IGFuZFxuICogKipDeWNsZUV4Y2VwdGlvbioqIGlzIHRocm93bi5cbiAqXG4gKiBTZWUgW3RvcG9sb2dpY2FsIHNvcnRpbmddKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1RvcG9sb2dpY2FsX3NvcnRpbmcpXG4gKiBmb3IgbW9yZSBkZXRhaWxzIGFib3V0IGhvdyB0aGlzIGFsZ29yaXRobSB3b3Jrcy5cbiAqXG4gKiBAcGFyYW0ge0RpZ3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNvcnRcbiAqL1xuZnVuY3Rpb24gdG9wc29ydChnKSB7XG4gIGlmICghZy5pc0RpcmVjdGVkKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0b3Bzb3J0IGNhbiBvbmx5IGJlIGFwcGxpZWQgdG8gYSBkaXJlY3RlZCBncmFwaC4gQmFkIGlucHV0OiBcIiArIGcpO1xuICB9XG5cbiAgdmFyIHZpc2l0ZWQgPSB7fTtcbiAgdmFyIHN0YWNrID0ge307XG4gIHZhciByZXN1bHRzID0gW107XG5cbiAgZnVuY3Rpb24gdmlzaXQobm9kZSkge1xuICAgIGlmIChub2RlIGluIHN0YWNrKSB7XG4gICAgICB0aHJvdyBuZXcgQ3ljbGVFeGNlcHRpb24oKTtcbiAgICB9XG5cbiAgICBpZiAoIShub2RlIGluIHZpc2l0ZWQpKSB7XG4gICAgICBzdGFja1tub2RlXSA9IHRydWU7XG4gICAgICB2aXNpdGVkW25vZGVdID0gdHJ1ZTtcbiAgICAgIGcucHJlZGVjZXNzb3JzKG5vZGUpLmZvckVhY2goZnVuY3Rpb24ocHJlZCkge1xuICAgICAgICB2aXNpdChwcmVkKTtcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHN0YWNrW25vZGVdO1xuICAgICAgcmVzdWx0cy5wdXNoKG5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzaW5rcyA9IGcuc2lua3MoKTtcbiAgaWYgKGcub3JkZXIoKSAhPT0gMCAmJiBzaW5rcy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQ3ljbGVFeGNlcHRpb24oKTtcbiAgfVxuXG4gIGcuc2lua3MoKS5mb3JFYWNoKGZ1bmN0aW9uKHNpbmspIHtcbiAgICB2aXNpdChzaW5rKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbmZ1bmN0aW9uIEN5Y2xlRXhjZXB0aW9uKCkge31cblxuQ3ljbGVFeGNlcHRpb24ucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkdyYXBoIGhhcyBhdCBsZWFzdCBvbmUgY3ljbGVcIjtcbn07XG4iLCIvLyBUaGlzIGZpbGUgcHJvdmlkZXMgYSBoZWxwZXIgZnVuY3Rpb24gdGhhdCBtaXhlcy1pbiBEb3QgYmVoYXZpb3IgdG8gYW5cbi8vIGV4aXN0aW5nIGdyYXBoIHByb3RvdHlwZS5cblxuLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gY29tcG91bmRpZnk7XG5cbi8vIEV4dGVuZHMgdGhlIGdpdmVuIFN1cGVyQ29uc3RydWN0b3Igd2l0aCB0aGUgYWJpbGl0eSBmb3Igbm9kZXMgdG8gY29udGFpblxuLy8gb3RoZXIgbm9kZXMuIEEgc3BlY2lhbCBub2RlIGlkIGBudWxsYCBpcyB1c2VkIHRvIGluZGljYXRlIHRoZSByb290IGdyYXBoLlxuZnVuY3Rpb24gY29tcG91bmRpZnkoU3VwZXJDb25zdHJ1Y3Rvcikge1xuICBmdW5jdGlvbiBDb25zdHJ1Y3RvcigpIHtcbiAgICBTdXBlckNvbnN0cnVjdG9yLmNhbGwodGhpcyk7XG5cbiAgICAvLyBNYXAgb2Ygb2JqZWN0IGlkIC0+IHBhcmVudCBpZCAob3IgbnVsbCBmb3Igcm9vdCBncmFwaClcbiAgICB0aGlzLl9wYXJlbnRzID0ge307XG5cbiAgICAvLyBNYXAgb2YgaWQgKG9yIG51bGwpIC0+IGNoaWxkcmVuIHNldFxuICAgIHRoaXMuX2NoaWxkcmVuID0ge307XG4gICAgdGhpcy5fY2hpbGRyZW5bbnVsbF0gPSBuZXcgU2V0KCk7XG4gIH1cblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBuZXcgU3VwZXJDb25zdHJ1Y3RvcigpO1xuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUucGFyZW50ID0gZnVuY3Rpb24odSwgcGFyZW50KSB7XG4gICAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcmVudHNbdV07XG4gICAgfVxuXG4gICAgaWYgKHUgPT09IHBhcmVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IG1ha2UgXCIgKyB1ICsgXCIgYSBwYXJlbnQgb2YgaXRzZWxmXCIpO1xuICAgIH1cbiAgICBpZiAocGFyZW50ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHBhcmVudCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2hpbGRyZW5bdGhpcy5fcGFyZW50c1t1XV0ucmVtb3ZlKHUpO1xuICAgIHRoaXMuX3BhcmVudHNbdV0gPSBwYXJlbnQ7XG4gICAgdGhpcy5fY2hpbGRyZW5bcGFyZW50XS5hZGQodSk7XG4gIH07XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmNoaWxkcmVuID0gZnVuY3Rpb24odSkge1xuICAgIGlmICh1ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2hpbGRyZW5bdV0ua2V5cygpO1xuICB9O1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5hZGROb2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB1ID0gU3VwZXJDb25zdHJ1Y3Rvci5wcm90b3R5cGUuYWRkTm9kZS5jYWxsKHRoaXMsIHUsIHZhbHVlKTtcbiAgICB0aGlzLl9wYXJlbnRzW3VdID0gbnVsbDtcbiAgICB0aGlzLl9jaGlsZHJlblt1XSA9IG5ldyBTZXQoKTtcbiAgICB0aGlzLl9jaGlsZHJlbltudWxsXS5hZGQodSk7XG4gICAgcmV0dXJuIHU7XG4gIH07XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmRlbE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gICAgLy8gUHJvbW90ZSBhbGwgY2hpbGRyZW4gdG8gdGhlIHBhcmVudCBvZiB0aGUgc3ViZ3JhcGhcbiAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQodSk7XG4gICAgdGhpcy5fY2hpbGRyZW5bdV0ua2V5cygpLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgIHRoaXMucGFyZW50KGNoaWxkLCBwYXJlbnQpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5fY2hpbGRyZW5bcGFyZW50XS5yZW1vdmUodSk7XG4gICAgZGVsZXRlIHRoaXMuX3BhcmVudHNbdV07XG4gICAgZGVsZXRlIHRoaXMuX2NoaWxkcmVuW3VdO1xuXG4gICAgcmV0dXJuIFN1cGVyQ29uc3RydWN0b3IucHJvdG90eXBlLmRlbE5vZGUuY2FsbCh0aGlzLCB1KTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb3B5ID0gU3VwZXJDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY29weS5jYWxsKHRoaXMpO1xuICAgIHRoaXMubm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIGNvcHkucGFyZW50KHUsIHRoaXMucGFyZW50KHUpKTtcbiAgICB9LCB0aGlzKTtcbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZmlsdGVyTm9kZXMgPSBmdW5jdGlvbihmaWx0ZXIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIGNvcHkgPSBTdXBlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5maWx0ZXJOb2Rlcy5jYWxsKHRoaXMsIGZpbHRlcik7XG5cbiAgICB2YXIgcGFyZW50cyA9IHt9O1xuICAgIGZ1bmN0aW9uIGZpbmRQYXJlbnQodSkge1xuICAgICAgdmFyIHBhcmVudCA9IHNlbGYucGFyZW50KHUpO1xuICAgICAgaWYgKHBhcmVudCA9PT0gbnVsbCB8fCBjb3B5Lmhhc05vZGUocGFyZW50KSkge1xuICAgICAgICBwYXJlbnRzW3VdID0gcGFyZW50O1xuICAgICAgICByZXR1cm4gcGFyZW50O1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnQgaW4gcGFyZW50cykge1xuICAgICAgICByZXR1cm4gcGFyZW50c1twYXJlbnRdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZpbmRQYXJlbnQocGFyZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb3B5LmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHsgY29weS5wYXJlbnQodSwgZmluZFBhcmVudCh1KSk7IH0pO1xuXG4gICAgcmV0dXJuIGNvcHk7XG4gIH07XG5cbiAgcmV0dXJuIENvbnN0cnVjdG9yO1xufVxuIiwidmFyIEdyYXBoID0gcmVxdWlyZShcIi4uL0dyYXBoXCIpLFxuICAgIERpZ3JhcGggPSByZXF1aXJlKFwiLi4vRGlncmFwaFwiKSxcbiAgICBDR3JhcGggPSByZXF1aXJlKFwiLi4vQ0dyYXBoXCIpLFxuICAgIENEaWdyYXBoID0gcmVxdWlyZShcIi4uL0NEaWdyYXBoXCIpO1xuXG5leHBvcnRzLmRlY29kZSA9IGZ1bmN0aW9uKG5vZGVzLCBlZGdlcywgQ3Rvcikge1xuICBDdG9yID0gQ3RvciB8fCBEaWdyYXBoO1xuXG4gIGlmICh0eXBlT2Yobm9kZXMpICE9PSBcIkFycmF5XCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJub2RlcyBpcyBub3QgYW4gQXJyYXlcIik7XG4gIH1cblxuICBpZiAodHlwZU9mKGVkZ2VzKSAhPT0gXCJBcnJheVwiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZWRnZXMgaXMgbm90IGFuIEFycmF5XCIpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBDdG9yID09PSBcInN0cmluZ1wiKSB7XG4gICAgc3dpdGNoKEN0b3IpIHtcbiAgICAgIGNhc2UgXCJncmFwaFwiOiBDdG9yID0gR3JhcGg7IGJyZWFrO1xuICAgICAgY2FzZSBcImRpZ3JhcGhcIjogQ3RvciA9IERpZ3JhcGg7IGJyZWFrO1xuICAgICAgY2FzZSBcImNncmFwaFwiOiBDdG9yID0gQ0dyYXBoOyBicmVhaztcbiAgICAgIGNhc2UgXCJjZGlncmFwaFwiOiBDdG9yID0gQ0RpZ3JhcGg7IGJyZWFrO1xuICAgICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKFwiVW5yZWNvZ25pemVkIGdyYXBoIHR5cGU6IFwiICsgQ3Rvcik7XG4gICAgfVxuICB9XG5cbiAgdmFyIGdyYXBoID0gbmV3IEN0b3IoKTtcblxuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICBncmFwaC5hZGROb2RlKHUuaWQsIHUudmFsdWUpO1xuICB9KTtcblxuICAvLyBJZiB0aGUgZ3JhcGggaXMgY29tcG91bmQsIHNldCB1cCBjaGlsZHJlbi4uLlxuICBpZiAoZ3JhcGgucGFyZW50KSB7XG4gICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICBpZiAodS5jaGlsZHJlbikge1xuICAgICAgICB1LmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgICAgIGdyYXBoLnBhcmVudCh2LCB1LmlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBlZGdlcy5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICBncmFwaC5hZGRFZGdlKGUuaWQsIGUudSwgZS52LCBlLnZhbHVlKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGdyYXBoO1xufTtcblxuZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbihncmFwaCkge1xuICB2YXIgbm9kZXMgPSBbXTtcbiAgdmFyIGVkZ2VzID0gW107XG5cbiAgZ3JhcGguZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB2YXIgbm9kZSA9IHtpZDogdSwgdmFsdWU6IHZhbHVlfTtcbiAgICBpZiAoZ3JhcGguY2hpbGRyZW4pIHtcbiAgICAgIHZhciBjaGlsZHJlbiA9IGdyYXBoLmNoaWxkcmVuKHUpO1xuICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICBub2RlLmNoaWxkcmVuID0gY2hpbGRyZW47XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGVzLnB1c2gobm9kZSk7XG4gIH0pO1xuXG4gIGdyYXBoLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgZWRnZXMucHVzaCh7aWQ6IGUsIHU6IHUsIHY6IHYsIHZhbHVlOiB2YWx1ZX0pO1xuICB9KTtcblxuICB2YXIgdHlwZTtcbiAgaWYgKGdyYXBoIGluc3RhbmNlb2YgQ0RpZ3JhcGgpIHtcbiAgICB0eXBlID0gXCJjZGlncmFwaFwiO1xuICB9IGVsc2UgaWYgKGdyYXBoIGluc3RhbmNlb2YgQ0dyYXBoKSB7XG4gICAgdHlwZSA9IFwiY2dyYXBoXCI7XG4gIH0gZWxzZSBpZiAoZ3JhcGggaW5zdGFuY2VvZiBEaWdyYXBoKSB7XG4gICAgdHlwZSA9IFwiZGlncmFwaFwiO1xuICB9IGVsc2UgaWYgKGdyYXBoIGluc3RhbmNlb2YgR3JhcGgpIHtcbiAgICB0eXBlID0gXCJncmFwaFwiO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNvdWxkbid0IGRldGVybWluZSB0eXBlIG9mIGdyYXBoOiBcIiArIGdyYXBoKTtcbiAgfVxuXG4gIHJldHVybiB7IG5vZGVzOiBub2RlcywgZWRnZXM6IGVkZ2VzLCB0eXBlOiB0eXBlIH07XG59O1xuXG5mdW5jdGlvbiB0eXBlT2Yob2JqKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKS5zbGljZSg4LCAtMSk7XG59XG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxuZXhwb3J0cy5hbGwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkgeyByZXR1cm4gdHJ1ZTsgfTtcbn07XG5cbmV4cG9ydHMubm9kZXNGcm9tTGlzdCA9IGZ1bmN0aW9uKG5vZGVzKSB7XG4gIHZhciBzZXQgPSBuZXcgU2V0KG5vZGVzKTtcbiAgcmV0dXJuIGZ1bmN0aW9uKHUpIHtcbiAgICByZXR1cm4gc2V0Lmhhcyh1KTtcbiAgfTtcbn07XG4iLCJ2YXIgR3JhcGggPSByZXF1aXJlKFwiLi9HcmFwaFwiKSxcbiAgICBEaWdyYXBoID0gcmVxdWlyZShcIi4vRGlncmFwaFwiKTtcblxuLy8gU2lkZS1lZmZlY3QgYmFzZWQgY2hhbmdlcyBhcmUgbG91c3ksIGJ1dCBub2RlIGRvZXNuJ3Qgc2VlbSB0byByZXNvbHZlIHRoZVxuLy8gcmVxdWlyZXMgY3ljbGUuXG5cbi8qKlxuICogUmV0dXJucyBhIG5ldyBkaXJlY3RlZCBncmFwaCB1c2luZyB0aGUgbm9kZXMgYW5kIGVkZ2VzIGZyb20gdGhpcyBncmFwaC4gVGhlXG4gKiBuZXcgZ3JhcGggd2lsbCBoYXZlIHRoZSBzYW1lIG5vZGVzLCBidXQgd2lsbCBoYXZlIHR3aWNlIHRoZSBudW1iZXIgb2YgZWRnZXM6XG4gKiBlYWNoIGVkZ2UgaXMgc3BsaXQgaW50byB0d28gZWRnZXMgd2l0aCBvcHBvc2l0ZSBkaXJlY3Rpb25zLiBFZGdlIGlkcyxcbiAqIGNvbnNlcXVlbnRseSwgYXJlIG5vdCBwcmVzZXJ2ZWQgYnkgdGhpcyB0cmFuc2Zvcm1hdGlvbi5cbiAqL1xuR3JhcGgucHJvdG90eXBlLnRvRGlncmFwaCA9XG5HcmFwaC5wcm90b3R5cGUuYXNEaXJlY3RlZCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZyA9IG5ldyBEaWdyYXBoKCk7XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgZy5hZGROb2RlKHUsIHZhbHVlKTsgfSk7XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdiwgdmFsdWUpO1xuICAgIGcuYWRkRWRnZShudWxsLCB2LCB1LCB2YWx1ZSk7XG4gIH0pO1xuICByZXR1cm4gZztcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIG5ldyB1bmRpcmVjdGVkIGdyYXBoIHVzaW5nIHRoZSBub2RlcyBhbmQgZWRnZXMgZnJvbSB0aGlzIGdyYXBoLlxuICogVGhlIG5ldyBncmFwaCB3aWxsIGhhdmUgdGhlIHNhbWUgbm9kZXMsIGJ1dCB0aGUgZWRnZXMgd2lsbCBiZSBtYWRlXG4gKiB1bmRpcmVjdGVkLiBFZGdlIGlkcyBhcmUgcHJlc2VydmVkIGluIHRoaXMgdHJhbnNmb3JtYXRpb24uXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnRvR3JhcGggPVxuRGlncmFwaC5wcm90b3R5cGUuYXNVbmRpcmVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnID0gbmV3IEdyYXBoKCk7XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgZy5hZGROb2RlKHUsIHZhbHVlKTsgfSk7XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBnLmFkZEVkZ2UoZSwgdSwgdiwgdmFsdWUpO1xuICB9KTtcbiAgcmV0dXJuIGc7XG59O1xuIiwiLy8gUmV0dXJucyBhbiBhcnJheSBvZiBhbGwgdmFsdWVzIGZvciBwcm9wZXJ0aWVzIG9mICoqbyoqLlxuZXhwb3J0cy52YWx1ZXMgPSBmdW5jdGlvbihvKSB7XG4gIHZhciBrcyA9IE9iamVjdC5rZXlzKG8pLFxuICAgICAgbGVuID0ga3MubGVuZ3RoLFxuICAgICAgcmVzdWx0ID0gbmV3IEFycmF5KGxlbiksXG4gICAgICBpO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSBvW2tzW2ldXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gJzAuNy40JztcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgJ3VzZSBzdHJpY3QnXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZm4pe1xuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgcmV0dXJuIGZuLmJpbmQobnVsbCwgdGhpcykuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgfVxuICB9XG59KClcbiIsInZhciBkb21pZnkgPSByZXF1aXJlKCdkb21pZnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBoeXBlcmdsdWU7XG5mdW5jdGlvbiBoeXBlcmdsdWUgKHNyYywgdXBkYXRlcykge1xuICAgIGlmICghdXBkYXRlcykgdXBkYXRlcyA9IHt9O1xuXG4gICAgdmFyIGRvbSA9IHR5cGVvZiBzcmMgPT09ICdvYmplY3QnXG4gICAgICAgID8gWyBzcmMgXVxuICAgICAgICA6IGRvbWlmeShzcmMpXG4gICAgO1xuICAgIGZvckVhY2gob2JqZWN0S2V5cyh1cGRhdGVzKSwgZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHVwZGF0ZXNbc2VsZWN0b3JdO1xuICAgICAgICBmb3JFYWNoKGRvbSwgZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgIGlmIChzZWxlY3RvciA9PT0gJzpmaXJzdCcpIHtcbiAgICAgICAgICAgICAgICBiaW5kKGQsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKC86Zmlyc3QkLy50ZXN0KHNlbGVjdG9yKSkge1xuICAgICAgICAgICAgICAgIHZhciBrID0gc2VsZWN0b3IucmVwbGFjZSgvOmZpcnN0JC8sICcnKTtcbiAgICAgICAgICAgICAgICB2YXIgZWxlbSA9IGQucXVlcnlTZWxlY3RvcihrKTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbSkgYmluZChlbGVtLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgbm9kZXMgPSBkLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgICAgICAgICAgICAgIGlmIChub2Rlcy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGJpbmQobm9kZXNbaV0sIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRvbS5sZW5ndGggPT09IDFcbiAgICAgICAgPyBkb21bMF1cbiAgICAgICAgOiBkb21cbiAgICA7XG59XG5cbmZ1bmN0aW9uIGJpbmQgKG5vZGUsIHZhbHVlKSB7XG4gICAgaWYgKGlzRWxlbWVudCh2YWx1ZSkpIHtcbiAgICAgICAgbm9kZS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgbm9kZS5hcHBlbmRDaGlsZCh2YWx1ZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBlID0gaHlwZXJnbHVlKG5vZGUuY2xvbmVOb2RlKHRydWUpLCB2YWx1ZVtpXSk7XG4gICAgICAgICAgICBub2RlLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGUsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBmb3JFYWNoKG9iamVjdEtleXModmFsdWUpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICBpZiAoa2V5ID09PSAnX3RleHQnKSB7XG4gICAgICAgICAgICAgICAgc2V0VGV4dChub2RlLCB2YWx1ZVtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGtleSA9PT0gJ19odG1sJyAmJiBpc0VsZW1lbnQodmFsdWVba2V5XSkpIHtcbiAgICAgICAgICAgICAgICBub2RlLmlubmVySFRNTCA9ICcnO1xuICAgICAgICAgICAgICAgIG5vZGUuYXBwZW5kQ2hpbGQodmFsdWVba2V5XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChrZXkgPT09ICdfaHRtbCcpIHtcbiAgICAgICAgICAgICAgICBub2RlLmlubmVySFRNTCA9IHZhbHVlW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIG5vZGUuc2V0QXR0cmlidXRlKGtleSwgdmFsdWVba2V5XSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHNldFRleHQobm9kZSwgdmFsdWUpO1xufVxuXG5mdW5jdGlvbiBmb3JFYWNoKHhzLCBmKSB7XG4gICAgaWYgKHhzLmZvckVhY2gpIHJldHVybiB4cy5mb3JFYWNoKGYpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIGYoeHNbaV0sIGkpXG59XG5cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciByZXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSByZXMucHVzaChrZXkpO1xuICAgIHJldHVybiByZXM7XG59O1xuXG5mdW5jdGlvbiBpc0VsZW1lbnQgKGUpIHtcbiAgICByZXR1cm4gZSAmJiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgZS5jaGlsZE5vZGVzXG4gICAgICAgICYmICh0eXBlb2YgZS5hcHBlbmRDaGlsZCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICB8fCB0eXBlb2YgZS5hcHBlbmRDaGlsZCA9PT0gJ29iamVjdCcpXG4gICAgO1xufVxuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5mdW5jdGlvbiBzZXRUZXh0IChlLCBzKSB7XG4gICAgZS5pbm5lckhUTUwgPSAnJztcbiAgICB2YXIgdHh0ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoU3RyaW5nKHMpKTtcbiAgICBlLmFwcGVuZENoaWxkKHR4dCk7XG59XG4iLCJcbi8qKlxuICogRXhwb3NlIGBwYXJzZWAuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZTtcblxuLyoqXG4gKiBXcmFwIG1hcCBmcm9tIGpxdWVyeS5cbiAqL1xuXG52YXIgbWFwID0ge1xuICBvcHRpb246IFsxLCAnPHNlbGVjdCBtdWx0aXBsZT1cIm11bHRpcGxlXCI+JywgJzwvc2VsZWN0PiddLFxuICBvcHRncm91cDogWzEsICc8c2VsZWN0IG11bHRpcGxlPVwibXVsdGlwbGVcIj4nLCAnPC9zZWxlY3Q+J10sXG4gIGxlZ2VuZDogWzEsICc8ZmllbGRzZXQ+JywgJzwvZmllbGRzZXQ+J10sXG4gIHRoZWFkOiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgdGJvZHk6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICB0Zm9vdDogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIGNvbGdyb3VwOiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgY2FwdGlvbjogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIHRyOiBbMiwgJzx0YWJsZT48dGJvZHk+JywgJzwvdGJvZHk+PC90YWJsZT4nXSxcbiAgdGQ6IFszLCAnPHRhYmxlPjx0Ym9keT48dHI+JywgJzwvdHI+PC90Ym9keT48L3RhYmxlPiddLFxuICB0aDogWzMsICc8dGFibGU+PHRib2R5Pjx0cj4nLCAnPC90cj48L3Rib2R5PjwvdGFibGU+J10sXG4gIGNvbDogWzIsICc8dGFibGU+PHRib2R5PjwvdGJvZHk+PGNvbGdyb3VwPicsICc8L2NvbGdyb3VwPjwvdGFibGU+J10sXG4gIF9kZWZhdWx0OiBbMCwgJycsICcnXVxufTtcblxuLyoqXG4gKiBQYXJzZSBgaHRtbGAgYW5kIHJldHVybiB0aGUgY2hpbGRyZW4uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGh0bWxcbiAqIEByZXR1cm4ge0FycmF5fVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2UoaHRtbCkge1xuICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIGh0bWwpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1N0cmluZyBleHBlY3RlZCcpO1xuICBcbiAgLy8gdGFnIG5hbWVcbiAgdmFyIG0gPSAvPChbXFx3Ol0rKS8uZXhlYyhodG1sKTtcbiAgaWYgKCFtKSB0aHJvdyBuZXcgRXJyb3IoJ05vIGVsZW1lbnRzIHdlcmUgZ2VuZXJhdGVkLicpO1xuICB2YXIgdGFnID0gbVsxXTtcbiAgXG4gIC8vIGJvZHkgc3VwcG9ydFxuICBpZiAodGFnID09ICdib2R5Jykge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2h0bWwnKTtcbiAgICBlbC5pbm5lckhUTUwgPSBodG1sO1xuICAgIHJldHVybiBbZWwucmVtb3ZlQ2hpbGQoZWwubGFzdENoaWxkKV07XG4gIH1cbiAgXG4gIC8vIHdyYXAgbWFwXG4gIHZhciB3cmFwID0gbWFwW3RhZ10gfHwgbWFwLl9kZWZhdWx0O1xuICB2YXIgZGVwdGggPSB3cmFwWzBdO1xuICB2YXIgcHJlZml4ID0gd3JhcFsxXTtcbiAgdmFyIHN1ZmZpeCA9IHdyYXBbMl07XG4gIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBlbC5pbm5lckhUTUwgPSBwcmVmaXggKyBodG1sICsgc3VmZml4O1xuICB3aGlsZSAoZGVwdGgtLSkgZWwgPSBlbC5sYXN0Q2hpbGQ7XG5cbiAgcmV0dXJuIG9ycGhhbihlbC5jaGlsZHJlbik7XG59XG5cbi8qKlxuICogT3JwaGFuIGBlbHNgIGFuZCByZXR1cm4gYW4gYXJyYXkuXG4gKlxuICogQHBhcmFtIHtOb2RlTGlzdH0gZWxzXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIG9ycGhhbihlbHMpIHtcbiAgdmFyIHJldCA9IFtdO1xuXG4gIHdoaWxlIChlbHMubGVuZ3RoKSB7XG4gICAgcmV0LnB1c2goZWxzWzBdLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWxzWzBdKSk7XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuIiwidm9pZCBmdW5jdGlvbihyb290KXtcblxuICAgIC8vIHJldHVybiBhIG51bWJlciBiZXR3ZWVuIDAgYW5kIG1heC0xXG4gICAgZnVuY3Rpb24gcihtYXgpeyByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpKm1heCkgfVxuXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGUoc2FsdCwgc2l6ZSl7XG4gICAgICAgIHZhciBrZXkgPSAnJ1xuICAgICAgICB2YXIgc2wgPSBzYWx0Lmxlbmd0aFxuICAgICAgICB3aGlsZSAoIHNpemUgLS0gKSB7XG4gICAgICAgICAgICB2YXIgcm5kID0gcihzbClcbiAgICAgICAgICAgIGtleSArPSBzYWx0W3JuZF1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ga2V5XG4gICAgfVxuXG4gICAgdmFyIHJuZHRvayA9IGZ1bmN0aW9uKHNhbHQsIHNpemUpe1xuICAgICAgICByZXR1cm4gaXNOYU4oc2l6ZSkgPyB1bmRlZmluZWQgOlxuICAgICAgICAgICAgICAgc2l6ZSA8IDEgICAgPyB1bmRlZmluZWQgOiBnZW5lcmF0ZShzYWx0LCBzaXplKVxuXG4gICAgfVxuXG4gICAgcm5kdG9rLmdlbiA9IGNyZWF0ZUdlbmVyYXRvclxuXG4gICAgZnVuY3Rpb24gY3JlYXRlR2VuZXJhdG9yKHNhbHQpe1xuICAgICAgICBzYWx0ID0gdHlwZW9mIHNhbHQgID09ICdzdHJpbmcnICYmIHNhbHQubGVuZ3RoID4gMCA/IHNhbHQgOiAgJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHp5MDEyMzQ1Njc4OSdcbiAgICAgICAgdmFyIHRlbXAgPSBybmR0b2suYmluZChybmR0b2ssIHNhbHQpXG4gICAgICAgIHRlbXAuc2FsdCA9IGZ1bmN0aW9uKCl7IHJldHVybiBzYWx0IH1cbiAgICAgICAgdGVtcC5jcmVhdGUgPSBjcmVhdGVHZW5lcmF0b3JcbiAgICAgICAgdGVtcC5nZW4gPSBjcmVhdGVHZW5lcmF0b3JcbiAgICAgICAgcmV0dXJuIHRlbXBcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUdlbmVyYXRvcigpXG5cbn0odGhpcylcbiIsInZvaWQgZnVuY3Rpb24ocm9vdCl7XG5cblx0J3VzZSBzdHJpY3QnXG5cblx0dmFyIGNyZWF0ZSA9IE9iamVjdC5jcmVhdGUgfHwgZnVuY3Rpb24obyl7XG5cdFx0dmFyIEYgPSBmdW5jdGlvbigpe31cblx0XHRGLnByb3RvdHlwZSA9IG9cblx0XHRyZXR1cm4gbmV3IEYoKVxuXHR9XG5cblx0dmFyIGV4dGVuZCA9IGZ1bmN0aW9uKHRvLCBmcm9tKXtcblx0XHRmb3IgKCB2YXIgcCBpbiBmcm9tICkgdG9bcF0gPSBmcm9tW3BdXG5cdFx0cmV0dXJuIHRvXG5cdH1cblxuXHQvLyBMaWJyYXJ5IG9iamVjdCAtIGEgYmFzZSBvYmplY3QgdG8gYmUgZXh0ZW5kZWRcblx0dmFyIFZpcmFsID0ge1xuXG5cdFx0Ly8gY3JlYXRlIGFuIGluaGVyaXRpbmcgb2JqZWN0LCB3aXRoIGFkZGVkIG9yIGNoYW5nZWQgbWV0aG9kcyBvciBwcm9wZXJ0aWVzXG5cdFx0ZXh0ZW5kOiBmdW5jdGlvbihwcm9wcyl7XG5cdFx0XHRyZXR1cm4gZXh0ZW5kKGNyZWF0ZSh0aGlzKSwgcHJvcHMpXG5cdFx0fSxcblxuXHRcdC8vIGNyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBhbiBvYmplY3QsIGNhbGxpbmcgYW4gaW5pdCBtZXRob2QgaWYgYXZhaWxhYmxlXG5cdFx0bWFrZTogZnVuY3Rpb24oKXtcblx0XHRcdHZhciBvYmogPSBjcmVhdGUodGhpcylcblx0XHRcdGlmICggdHlwZW9mIG9iai5pbml0ID09PSAnZnVuY3Rpb24nICkgb2JqLmluaXQuYXBwbHkob2JqLCBhcmd1bWVudHMpXG5cdFx0XHRyZXR1cm4gb2JqXG5cdFx0fVxuXHR9XG5cblx0Ly8gbW9kdWxlIGRhbmNlXG5cdGlmICggdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMgKSBtb2R1bGUuZXhwb3J0cyA9IFZpcmFsXG5cdGVsc2UgaWYgKCB0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgKSBkZWZpbmUoVmlyYWwpXG5cdGVsc2UgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb290LlZpcmFsID0gVmlyYWxcblxufSh0aGlzKVxuIiwiLy8gIyBcIlppcHBpbmcgYW5kIFVuemlwcGluZyBMaXN0c1wiXG4vLyBCZWNhdXNlIGpzIGlzIGR5bmFtaWMgYW5kIGRvZXNuJ3Qgcm9jayB0dXBsZXMsIHRoZXNlIHppcHBlcnMgd29yayB3aXRoIG5cbi8vIGNoYXJzIGlpcmMsIGFuZCBhbHNvIGFjdHMgYXMgYW4gdW56aXAuXG5cbmV4cG9ydHMuemlwV2l0aCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGZ4biA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyksXG4gICAgICBhcmdzID0gZnhuLnNwbGljZSgxKSxcbiAgICAgIG91dHB1dCA9IFtdLFxuICAgICAgd2lkdGggPSBNYXRoLm1heC5hcHBseShudWxsLCBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoYXJncywgZnVuY3Rpb24oeHMpIHtcbiAgICAgICAgcmV0dXJuIHhzLmxlbmd0aDtcbiAgICAgIH0pKSxcbiAgICAgIGk7XG5cbiAgZnhuID0gZnhuWzBdO1xuXG4gIGZvciAoaSA9IDA7IGkgPCB3aWR0aDsgaSsrKSB7XG4gICAgb3V0cHV0LnB1c2goZnhuLmFwcGx5KG51bGwsIFtdLm1hcC5jYWxsKGFyZ3MsIGZ1bmN0aW9uKHhzKSB7XG4gICAgICByZXR1cm4geHNbaV07XG4gICAgfSkpKTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufVxuXG5leHBvcnRzLnppcCA9IGV4cG9ydHMuemlwV2l0aC5iaW5kKG51bGwsIGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpOyBcbn0pO1xuIiwidm9pZCBmdW5jdGlvbigpe1xuICBcInVzZSBzdHJpY3RcIlxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlZmF1bHRzKG9iaikge1xuICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkuZm9yRWFjaChmdW5jdGlvbihzb3VyY2Upe1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgaWYgKG9ialtwcm9wXSA9PT0gdW5kZWZpbmVkKSBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF1cbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBvYmpcbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgZnVuY3Rpb24gcXVlcnkoc2VsZWN0b3IsIHBhcmVudCl7XG4gICAgcGFyZW50ID0gcGFyZW50IHx8IGRvY3VtZW50XG4gICAgcmV0dXJuIHBhcmVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKVxuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlKHRhZ19uYW1lLCBhdHRycyl7XG4gICAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ19uYW1lKVxuICAgIGlmICggYXR0cnMgKSB7IHNldF9hdHRyaWJ1dGVzKG5vZGUsIGF0dHJzKSB9XG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9hdHRyaWJ1dGUobm9kZSwgYXR0cil7XG4gICAgbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSx2YWx1ZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9hdHRyaWJ1dGVzKG5vZGUsIGF0dHJzKXtcbiAgICBPYmplY3Qua2V5cyhhdHRycylcbiAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbihuYW1lKXtcbiAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIGF0dHJzW25hbWVdKVxuICAgICAgICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfdGV4dChub2RlKXtcbiAgICByZXR1cm4gbm9kZS50ZXh0Q29udGVudCB8fCBub2RlLmlubmVyVGV4dFxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X3RleHQobm9kZSwgdGV4dCl7XG4gICAgbm9kZS50ZXh0Q29udGVudCA9IG5vZGUuaW5uZXJUZXh0ID0gdGV4dFxuICB9XG5cbiAgZnVuY3Rpb24gaW5zZXJ0QWZ0ZXIocGFyZW50RWwsIHNwMSwgc3AyKXtcbiAgICBwYXJlbnRFbC5pbnNlcnRCZWZvcmUoc3AxLCBzcDIubmV4dFNpYmxpbmcpXG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVOb2RlKG5vZGUpe1xuICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgJCAgICAgICAgICAgICA6IHF1ZXJ5XG4gIC8vLCAkaWQgICAgICAgICAgIDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQuYmluZChkb2N1bWVudClcbiAgLCAkaWQgICAgICAgICAgIDogZnVuY3Rpb24oaWQpeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpIH1cbiAgLCBjcmVhdGUgICAgICAgIDogY3JlYXRlXG4gICwgYXR0ciAgICAgICAgICA6IHNldF9hdHRyaWJ1dGVcbiAgLCBhdHRycyAgICAgICAgIDogc2V0X2F0dHJpYnV0ZXNcbiAgLCBnZXRfdGV4dCAgICAgIDogZ2V0X3RleHRcbiAgLCBzZXRfdGV4dCAgICAgIDogc2V0X3RleHRcbiAgLCByZW1vdmUgICAgICAgIDogcmVtb3ZlTm9kZVxuICAsIGluc2VydEFmdGVyICAgOiBpbnNlcnRBZnRlclxuICB9XG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKVxuXG4gIG1vZHVsZS5leHBvcnRzID0gdmlyYWwuZXh0ZW5kKGV2ZW50cy5FdmVudEVtaXR0ZXIucHJvdG90eXBlKS5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKCl7IGV2ZW50cy5FdmVudEVtaXR0ZXIuY2FsbCh0aGlzKSB9XG4gIH0pXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHBsdWNrKG5hbWUpe1xuICAgIHJldHVybiBmdW5jdGlvbiBnZXRBdHRyKG9iail7IHJldHVybiBvYmpbbmFtZV0gfVxuICB9XG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB0cmFuc2xhdGUodmVjdG9yLCBwb2ludCl7XG4gICAgcmV0dXJuIHsgeDogcG9pbnQueCArIHZlY3RvclswXSwgeTogcG9pbnQueSArIHZlY3RvclsxXSB9XG4gIH1cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgaWRzID0gW11cbiAgdmFyIHJ0ID0gcmVxdWlyZSgncmFuZG9tLXRva2VuJylcbiAgdmFyIGxldHRlcnMgPSBydC5nZW4oJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl0JylcblxuICBmdW5jdGlvbiB0b2tlbigpeyByZXR1cm4gbGV0dGVycygxKSArIHJ0KDE2KSB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpe1xuICAgIHZhciBpZCA9IHRva2VuKClcbiAgICB3aGlsZSAoIGlkcy5pbmRleE9mKGlkKSAhPSAtMSApe1xuICAgICAgaWQgPSB0b2tlbigpXG4gICAgfVxuICAgIHJldHVybiBpZFxuICB9XG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICBmdW5jdGlvbiBweXRoKGEsIGIpe1xuICAgIHJldHVybiBNYXRoLnNxcnQoTWF0aC5wb3coYSwyKSwgTWF0aC5wb3coYiwyKSlcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuICAgIGNyb3NzOiBmdW5jdGlvbiBjcm9zcyh2LCB3KXtcbiAgICAgIHJldHVybiB2WzBdICogd1sxXSAtIHZbMV0gKiB3WzBdXG4gICAgfVxuXG4gICwgZG90OiAgZnVuY3Rpb24gYWRkKHYsIHcpe1xuICAgICAgcmV0dXJuIHZbMF0gKiB3WzBdICsgdlsxXSAqIHdbMV1cbiAgICB9XG5cbiAgLCBhZGQ6ICBmdW5jdGlvbiBhZGQodiwgdyl7XG4gICAgICByZXR1cm4gW3ZbMF0gKyB3WzBdLCB2WzFdICsgd1sxXV1cbiAgICB9XG5cbiAgLCBzdWJ0cmFjdDogIGZ1bmN0aW9uIHN1YnRyYWN0KHYsIHcpe1xuICAgICAgcmV0dXJuIFt2WzBdIC0gd1swXSwgdlsxXSAtIHdbMV1dXG4gICAgfVxuXG4gICwgc2NhbGU6ICBmdW5jdGlvbiBzY2FsZSh2LCBzKXtcbiAgICAgIHJldHVybiBbdlswXSAqIHMsIHZbMV0gKiBzXVxuICAgIH1cblxuICAsIGVxOiAgZnVuY3Rpb24gZXEodiwgdyl7XG4gICAgICByZXR1cm4gdlswXSA9PSB3WzBdICYmICB2WzFdID09IHdbMV1cbiAgICB9XG4gICwgbWFnbml0dWRlOiBmdW5jdGlvbiBtYWduaXR1ZGUodil7XG4gICAgICByZXR1cm4gcHl0aCh2WzBdLCB2WzFdKVxuICAgIH1cblxuICB9XG59KClcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiJdfQ==
(7)
});
