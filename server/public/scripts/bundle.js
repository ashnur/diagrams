(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var enslave = require('enslave')

  function size(arr){
    return arr.values.length
  }

  function clone(arr){
    return Arr.make(arr)
  }

  function forEach(set, fn){
    set.values.forEach(fn)
  }

  function reduce(set, fn, init){
    if ( init !== undefined ) {
      return set.values.reduce(fn, init)
    } else {
      return set.values.reduce(fn)
    }
  }

  function map(set, fn){
    return set.values.map(fn)
  }

  function some(set, fn){
    return set.values.some(fn)
  }

  function indexOf(set, value){
    return set.values.indexOf(value)
  }

  var Arr = viral.extend({
    init: function(arr){
      this.values = arr != null ? arr.values.slice(0) : []
    }
  , forEach: enslave(forEach)
  , reduce: enslave(reduce)
  , map: enslave(map)
  , some: enslave(some)
  , size: enslave(size)
  , clone: enslave(clone)
  , indexOf: enslave(indexOf)
  })

  module.exports = Arr

}()

},{"enslave":57,"viral":64}],2:[function(require,module,exports){
void function(){
  // var Snap = require('snapsvg')
  var viral = require('viral')
  var enslave = require('enslave')
  var dagre = require('dagre')
  var events = require('events')
  var hglue = require('hyperglue')
  var defaults = require('../util/defaults.js')
  var uid = require('../util/unique_id.js')
  var dom = require('../util/dom.js')
  var intersect = require('./intersect.js')
  var floor = Math.floor
  var ceil = Math.ceil
  var min = Math.min
  var max = Math.max

  var Item = require('./item.js')
  var print = console.log.bind(console)

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
      // TODO: replace this
      print('not sure how to handle')
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


  function display(diagram){
    // apply height / width on nodes
    var ingraph = diagram.ingraph
    var bbox_cache = {}
    ingraph.eachNode(function(id, node){
      var classname = node.classname
      var bbox = bbox_cache[classname] || (bbox_cache[classname] = inviz_bbox(diagram, from_defs(diagram, classname)))
      node.attr('x', bbox.x)
      node.attr('y', bbox.y)
      node.attr('width', bbox.width)
      node.attr('height', bbox.height)
    })

    var layout = diagram.layout
    var gcfg = diagram.graph.config
    if ( gcfg ) {
      Object.keys(gcfg).forEach(function(method){
        layout = layout[method](gcfg[method])
      })
    }
    layout.rankSimplex = true
    // calculate nodes layout
    layout = layout.run(ingraph)

    var graph = diagram.outgraph = layout.graph()

    // display nodes
    layout.eachNode(function(id, values){
      var node = diagram.ingraph.node(id)
      node.transform(values)
      draw(diagram, node)
    })


    // calculate edges layout
    var lanes = require('./edges.js')(layout, diagram)
    var segments = []

    var draw_bound = draw.bind(null, diagram)

    lanes.forEach(function(lane){
      lane.forEach(function(pw){
        var start = pw[0]
        var end = pw[pw.length - 1]
        // draw path
        var path_segment = {id: uid(), x1: start.x, y1:start.y, x2: end.x, y2: end.y}
        draw_bound({
          classname: diagram.config.edgeClass
        , content: {'.Edge:first': path_segment}
        })
        segments.push(path_segment)

        // draw the junctions
        var junctions = pw.filter(function(p){return p.node && ! p.entry })
        draw_bound({
          classname: diagram.config.edgeClass
        , content: {
            '.Edge': junctions.map(function(p){
              var j_segment = {id: uid(), x1: p.x, y1:p.y, x2: p.node.x, y2: p.node.y}
              segments.push(j_segment)
              return { ':first': j_segment}
            })
          }
        })

        var entries = pw.filter(function(p){return !! p.entry })
        draw_bound({
          classname: diagram.config.edgeEndClass
        , content: {
            '.Edge': entries.map(function(p){
              var j_segment = {id: uid(), x1: p.x, y1:p.y, x2: p.cut.x, y2: p.cut.y}
              segments.push(j_segment)
              return {':first': j_segment}
            })
          , '.Edge--end': entries.map(function(p){
              var j_segment = {id: uid(), x1: p.cut.x, y1:p.cut.y, x2: p.node.x, y2: p.node.y}
              segments.push(j_segment)
              return {':first': j_segment}
            })
          }
        })

      })
    })

    // draw the skips
    draw_bound({
      classname: diagram.config.edgeClass
    , content: {'.Edge': lanes.skips.map(function(p){
        var skip_segment = {id: uid(), x1: p[0].x, y1:p[0].y, x2: p[1].x, y2: p[1].y}
        segments.push(skip_segment)
        return { ':first': skip_segment }
      })}
    })

    var intersection_size = inviz_bbox(diagram, from_defs(diagram, diagram.config.intersectionClass))
    var intersection_middle = [intersection_size.width / 2, intersection_size.height / 2]
    segments.forEach(function(seg1, id1){
      segments.forEach(function(seg2, id2){
        if ( id2 > id1 && seg1.x1 != seg2.x1 &&  seg1.x2 != seg2.x2 && seg1.y1 != seg2.y1 &&  seg1.y2 != seg2.y2 ) {
          var isct = intersect(seg1, seg2)
          if ( isct ) {
            var seg1node = dom.$id(seg1.id)
            var seg2node = dom.$id(seg2.id)
            var topnode = seg1node.compareDocumentPosition(seg2node) & 4 ? seg1node : seg2node
            var intersect_node = draw(diagram, { classname: diagram.config.intersectionClass , content: {} })
            if ( horizontal(topnode) ) {
              intersect_node.transform((new Snap.Matrix(1, 0, 0, 1, 0 , 0)).rotate(90, isct[0] , isct[1] ).toTransformString())
                            .transform(intersect_node.matrix.translate(isct[0] - intersection_middle[0], isct[1] - intersection_middle[1]))
            } else {
              intersect_node.transform(new Snap.Matrix(1, 0, 0, 1, isct[0] - intersection_middle[0], isct[1] - intersection_middle[1]))
            }

            dom.insertAfter(topnode.parentNode, intersect_node.node, topnode.nextSibling)

          }
        }
      })
    })

    var move = diagram.svgel.matrix.clone()
    if ( graph.rankDir == "LR" || graph.rankDir == "RL" ) {
      graph.height = graph.height + lanes.growth * 2
      var move = move.translate(0, lanes.growth)
    } else {
      graph.width = graph.width + lanes.growth * 2
      var move = move.translate(lanes.growth, 0)
    }

    diagram.svgel.attr({ width: graph.width, height: graph.height }).transform(move.toTransformString())
    diagram.svgel.parent().attr({
      width: graph.width + diagram.config.edgeWidth + diagram.config.padding
    , height: graph.height + diagram.config.edgeWidth + diagram.config.padding
    })
    return layout
  }

  module.exports = viral.extend(new events.EventEmitter).extend({
    init: function(config, graph){
      this.config = config
      this.items = {}
      this.connectors = {}
      this.graph = graph
      this.ingraph = graph.ingraph
      this.layout = dagre.layout()
      this.svgel = Snap.apply(Snap, config.snap_args).g().attr({ transform: "translate(20,20)", id:uid()})
    }
  , display: enslave(display)
  , draw: enslave(draw)
  , to_defs: enslave(to_defs)

//  , addItem: enslave(add_item)
//  , delItem: enslave(remove_item)
//
//  , connect: enslave(add_connector)
//  , disconnect: enslave(remove_connector)
//
//
//  , selectItems: enslave(filter_items)
//  , selectConnectors: enslave(filter_items)

  })
}()

},{"../util/defaults.js":68,"../util/dom.js":69,"../util/unique_id.js":70,"./edges.js":3,"./intersect.js":4,"./item.js":5,"dagre":12,"enslave":57,"events":72,"hyperglue":58,"viral":64}],3:[function(require,module,exports){
void function(){

  var Set = require('../set.js')
  var Pathways = require('../pathway.js')

  var translate = require('./translate.js')
  var V = require('./vectors.js')

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
      lane.forEach(function(pathway, pw_idx){
        edges[rank_nr][pw_idx].sort(rank_sorter)
      })
    })

    edges.growth = (fskips.length + bskips.length) * skipsep


    return edges
  }

}()

},{"../pathway.js":65,"../set.js":66,"./translate.js":6,"./vectors.js":7}],4:[function(require,module,exports){
void function(){

  var V = require('./vectors.js')

  module.exports = function(seg1, seg2){
    var p = [seg1.x1, seg1.y1]
    var r = V.subtract([seg1.x2, seg1.y2], p)
    var q = [seg2.x1, seg2.y1]
    var s = V.subtract([seg2.x2, seg2.y2], q)

    var rxs = V.cross(r, s)
    if ( rxs == 0 ) return false

    var q_p = V.subtract(q,p)
    var rxs = V.cross(r, s)
    var t = V.cross(q_p, s) / rxs
    if ( t < 0 || t > 1 ) return false
    var u = V.cross(q_p, r) / rxs
    if ( u < 0 || u > 1 ) return false

    // var z1 = V.add(p, V.scale(r, t))
    // var z2 = V.add(q, V.scale(s, u))

    return V.add(p, V.scale(r, t))
  }

}()

},{"./vectors.js":7}],5:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var enslave = require('enslave')

//  function draw_item(item){
//    return item.g = item.diagram.draw(item)
//  }

  var Item = viral.extend({
    init: function(diagram, id, value, invalues){
      this.diagram = diagram
      this.id = id
      this.value = value
      this.input = invalues



//      console.log('o', value)
//      console.log('i', invalues)
    }
//    , draw: enslave(draw_item)
  })

  module.exports = Item

}()


},{"enslave":57,"viral":64}],6:[function(require,module,exports){
void function(){
  module.exports = function translate(vector, point){
    return { x: point.x + vector[0], y: point.y + vector[1] }
  }
}()

},{}],7:[function(require,module,exports){
void function(){

  function pyth(a, b){
    return Math.sqrt(Math.pow(a,2), Math.pow(b,2))
  }

  module.exports = {
    cross: function cross(v, w){
      return v[0] * w[1] - v[1] * w[0]
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

},{}],8:[function(require,module,exports){
void function(){
  var enslave = require('enslave')
  var Node = require('./node.js')
  var uid = require('../util/unique_id.js')

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

},{"../util/unique_id.js":70,"./node.js":10,"enslave":57}],9:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var dagre = require('dagre')
  var events = require('events')
  var uid = require('../util/unique_id.js')
  var Node = require('./node.js')
  var Edge = require('./edge.js')

  function add_node(graph, classname, transform, content, prefRank){
    var node = Node.make(graph, transform, {
        classname: classname
      , content: content
      , rank: prefRank
    })

    graph.ingraph.addNode(node.id, node)
    return node
  }

  function remove_node(graph, node_id){
    var g = graph.ingraph
    if ( g.hasNode(node_id) ) {
      char.delNode(node_id)
      return true
    }
    return false
  }

  function connect(graph, classname, source, target, transform, content){
    var edge = Edge.make(graph, source, target)
    graph.ingraph.addEdge(edge.id, source.id, target.id, edge)
    return edge
  }

  function disconnect(graph, source, target){
    var g = graph.ingraph
    var edge_id = g.outEdges(source.id, target.id)
    if ( g.hasEdge(edge_id) ) {
      g.delEdge(edge_id)
      return true
    } else {
      return false
    }
  }

  module.exports = viral.extend(new events.EventEmitter).extend({
    init: function(cfgobj){
      this.config = cfgobj
      this.ingraph =  new dagre.Digraph()
    }
  , add_node: enslave(add_node)
  , del_node: enslave(remove_node)
  , connect: enslave(connect)
  , disconnect: enslave(disconnect)
  })

}()

},{"../util/unique_id.js":70,"./edge.js":8,"./node.js":10,"dagre":12,"enslave":57,"events":72,"viral":64}],10:[function(require,module,exports){
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

},{"../util/unique_id.js":70,"enslave":57,"viral":64}],11:[function(require,module,exports){
void function(){
//  var Snap = require('snapsvg')
//    init: function(){
//      this.svgel = Snap.apply(Snap, arguments)
//    }

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

}()

},{"./diagram/diagram.js":2,"./graph/graph.js":9,"./util/defaults.js":68}],12:[function(require,module,exports){
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

},{"./lib/layout":13,"./lib/version":28,"graphlib":34}],13:[function(require,module,exports){
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


},{"./order":14,"./position":19,"./rank":20,"./util":27,"graphlib":34}],14:[function(require,module,exports){
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

},{"./order/crossCount":15,"./order/initLayerGraphs":16,"./order/initOrder":17,"./order/sortLayer":18,"./util":27}],15:[function(require,module,exports){
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

},{"../util":27}],16:[function(require,module,exports){
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

},{"cp-data":29,"graphlib":34}],17:[function(require,module,exports){
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

},{"../util":27,"./crossCount":15}],18:[function(require,module,exports){
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

},{"../util":27}],19:[function(require,module,exports){
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

},{"./util":27}],20:[function(require,module,exports){
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

},{"./rank/acyclic":21,"./rank/constraints":22,"./rank/feasibleTree":23,"./rank/initRank":24,"./rank/simplex":26,"./util":27,"graphlib":34}],21:[function(require,module,exports){
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

},{"../util":27}],22:[function(require,module,exports){
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

},{}],23:[function(require,module,exports){
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

},{"../util":27,"cp-data":29,"graphlib":34}],24:[function(require,module,exports){
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

},{"../util":27,"graphlib":34}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
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

},{"../util":27,"./rankUtil":25}],27:[function(require,module,exports){
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

},{}],28:[function(require,module,exports){
module.exports = '0.4.5';

},{}],29:[function(require,module,exports){
exports.Set = require('./lib/Set');
exports.PriorityQueue = require('./lib/PriorityQueue');
exports.version = require('./lib/version');

},{"./lib/PriorityQueue":30,"./lib/Set":31,"./lib/version":33}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){
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

},{"./util":32}],32:[function(require,module,exports){
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

},{}],33:[function(require,module,exports){
module.exports = '1.1.3';

},{}],34:[function(require,module,exports){
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

},{"./lib/CDigraph":36,"./lib/CGraph":37,"./lib/Digraph":38,"./lib/Graph":39,"./lib/alg/components":40,"./lib/alg/dijkstra":41,"./lib/alg/dijkstraAll":42,"./lib/alg/findCycles":43,"./lib/alg/floydWarshall":44,"./lib/alg/isAcyclic":45,"./lib/alg/postorder":46,"./lib/alg/preorder":47,"./lib/alg/prim":48,"./lib/alg/tarjan":49,"./lib/alg/topsort":50,"./lib/converter/json.js":52,"./lib/filter":53,"./lib/graph-converters":54,"./lib/version":56}],35:[function(require,module,exports){
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


},{"cp-data":29}],36:[function(require,module,exports){
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

},{"./Digraph":38,"./compoundify":51}],37:[function(require,module,exports){
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

},{"./Graph":39,"./compoundify":51}],38:[function(require,module,exports){
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


},{"./BaseGraph":35,"./util":55,"cp-data":29}],39:[function(require,module,exports){
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


},{"./BaseGraph":35,"./util":55,"cp-data":29}],40:[function(require,module,exports){
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

},{"cp-data":29}],41:[function(require,module,exports){
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

},{"cp-data":29}],42:[function(require,module,exports){
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

},{"./dijkstra":41}],43:[function(require,module,exports){
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

},{"./tarjan":49}],44:[function(require,module,exports){
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

},{}],45:[function(require,module,exports){
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

},{"./topsort":50}],46:[function(require,module,exports){
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

},{"cp-data":29}],47:[function(require,module,exports){
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

},{"cp-data":29}],48:[function(require,module,exports){
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

},{"../Graph":39,"cp-data":29}],49:[function(require,module,exports){
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

},{}],50:[function(require,module,exports){
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

},{}],51:[function(require,module,exports){
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

},{"cp-data":29}],52:[function(require,module,exports){
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

},{"../CDigraph":36,"../CGraph":37,"../Digraph":38,"../Graph":39}],53:[function(require,module,exports){
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

},{"cp-data":29}],54:[function(require,module,exports){
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

},{"./Digraph":38,"./Graph":39}],55:[function(require,module,exports){
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

},{}],56:[function(require,module,exports){
module.exports = '0.7.4';

},{}],57:[function(require,module,exports){
void function(){
  'use strict'
  module.exports = function(fn){
    return function(){
      return fn.bind(null, this).apply(null, arguments)
   }
  }
}()

},{}],58:[function(require,module,exports){
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

},{"domify":59}],59:[function(require,module,exports){

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

},{}],60:[function(require,module,exports){
var dictionary = {
  words: [
    'ad',
    'adipisicing',
    'aliqua',
    'aliquip',
    'amet',
    'anim',
    'aute',
    'cillum',
    'commodo',
    'consectetur',
    'consequat',
    'culpa',
    'cupidatat',
    'deserunt',
    'do',
    'dolor',
    'dolore',
    'duis',
    'ea',
    'eiusmod',
    'elit',
    'enim',
    'esse',
    'est',
    'et',
    'eu',
    'ex',
    'excepteur',
    'exercitation',
    'fugiat',
    'id',
    'in',
    'incididunt',
    'ipsum',
    'irure',
    'labore',
    'laboris',
    'laborum',
    'Lorem',
    'magna',
    'minim',
    'mollit',
    'nisi',
    'non',
    'nostrud',
    'nulla',
    'occaecat',
    'officia',
    'pariatur',
    'proident',
    'qui',
    'quis',
    'reprehenderit',
    'sint',
    'sit',
    'sunt',
    'tempor',
    'ullamco',
    'ut',
    'velit',
    'veniam',
    'voluptate'  
  ]
};

module.exports = dictionary;
},{}],61:[function(require,module,exports){
var generator = function() {
  var options = (arguments.length) ? arguments[0] : {}
    , count = options.count || 1
    , units = options.units || 'sentences'
    , sentenceLowerBound = options.sentenceLowerBound || 5
    , sentenceUpperBound = options.sentenceUpperBound || 15
	  , paragraphLowerBound = options.paragraphLowerBound || 3
	  , paragraphUpperBound = options.paragraphUpperBound || 7
	  , format = options.format || 'plain'
    , words = options.words || require('./dictionary').words
    , random = options.random || Math.random;

  units = simplePluralize(units.toLowerCase());

  var randomInteger = function(min, max) {
    return Math.floor(random() * (max - min + 1) + min);
  };
  
  var randomWord = function(words) {
    return words[randomInteger(0, words.length - 1)];
  };
  
  var randomSentence = function(words, lowerBound, upperBound) {
    var sentence = ''
      , bounds = {min: 0, max: randomInteger(lowerBound, upperBound)};
    
    while (bounds.min < bounds.max) {
      sentence = sentence + ' ' + randomWord(words);
      bounds.min = bounds.min + 1;
    }
    
    if (sentence.length) {
      sentence = sentence.slice(1);
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    }
  
    return sentence;
  };

  var randomParagraph = function(words, lowerBound, upperBound, sentenceLowerBound, sentenceUpperBound) {
    var paragraph = ''
      , bounds = {min: 0, max: randomInteger(lowerBound, upperBound)};
      
    while (bounds.min < bounds.max) {
      paragraph = paragraph + '. ' + randomSentence(words, sentenceLowerBound, sentenceUpperBound);
      bounds.min = bounds.min + 1;
    }
    
    if (paragraph.length) {
      paragraph = paragraph.slice(2);
      paragraph = paragraph + '.';
    }
    
    return paragraph;
  }
  
  var iter = 0
    , bounds = {min: 0, max: count}
    , string = ''
    , prefix = ''
    , suffix = "\r\n";

  if (format == 'html') {
    prefix = '<p>';
    suffix = '</p>';
  }
      
  while (bounds.min < bounds.max) {
    switch (units.toLowerCase()) {
      case 'words':
        string = string + ' ' + randomWord(words);
        break;
      case 'sentences':
        string = string + '. ' + randomSentence(words, sentenceLowerBound, sentenceUpperBound);
        break;
      case 'paragraphs':
        string = string + prefix + randomParagraph(words, paragraphLowerBound, paragraphUpperBound, sentenceLowerBound, sentenceUpperBound) + suffix;
        break;
    }
    bounds.min = bounds.min + 1;
  }
    
  if (string.length) {
    var pos = 0;
    
    if (string.indexOf('. ') == 0) {
      pos = 2;
    } else if (string.indexOf('.') == 0 || string.indexOf(' ') == 0) {
      pos = 1;
    }
    
    string = string.slice(pos);
    
    if (units == 'sentences') {
      string = string + '.';
    }
  }  
  
  return string;
};

function simplePluralize(string) {
  if (string.indexOf('s', string.length - 1) === -1) {
    return string + 's';
  }
  return string;
}

module.exports = generator;

},{"./dictionary":60}],62:[function(require,module,exports){
void function(root){

  function defaults(options){
    var options = options || {}
    var min = options.min
    var max = options.max
    var integer = options.integer || false
    if ( min == null && max == null ) {
      min = 0
      max = 1
    } else if ( min == null ) {
      min = max - 1
    } else if ( max == null ) {
      max = min + 1
    }
    if ( max < min ) throw new Error('invalid options, max must be >= min')
    return {
      min:     min
    , max:     max
    , integer: integer
    }
  }

  function random(options){
    options = defaults(options)
    if ( options.max === options.min ) return options.min
    var r = Math.random() * (options.max - options.min + Number(!!options.integer)) + options.min
    return options.integer ? Math.floor(r) : r
  }

  function generator(options){
    options = defaults(options)
    return function(min, max, integer){
      options.min     = min     || options.min
      options.max     = max     || options.max
      options.integer = integer != null ? integer : options.integer
      return random(options)
    }
  }

  module.exports =  random
  module.exports.generator = generator
  module.exports.defaults = defaults
}(this)

},{}],63:[function(require,module,exports){
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

},{}],64:[function(require,module,exports){
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

},{}],65:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var Set = require('./set.js')
  var enslave = require('enslave')

  function clone(A){
    return Pathway.make(A.sources, A.edges, A.targets)
  }

  function union(A, B){

    return Pathway.make(A.sources.union(B.sources)
                      , A.edges.union(B.edges)
                      , A.targets.union(B.targets))
  }

  function same(A, B){

    return A.sources.joint(B.sources) ||
           A.edges.joint(B.edges) ||
           A.targets.joint(B.targets)
  }

  var Pathway = viral.extend({
    init: function(sources, edges, targets){
      this.sources = sources != null ? sources : Set.make()
      this.edges = edges != null ? edges : Set.make()
      this.targets = targets != null ? targets : Set.make()
    }
  , same: enslave(same)
  , clone: enslave(clone)
  , union: enslave(union)
  })

  function indexOf(P, p){
    for ( var i = 0; i < P.values.length; i++ ) {
      if ( same(P.values[i], p) ) return i
    }
    return -1
  }

  function size(pathways){
    return pathways.values.length
  }


  function forEach(pathways, fn){
    pathways.values.forEach(fn)
  }

  function add(pathways, source, edge, target){

    var n = Pathway.make(Set.make().add(source), Set.make().add(edge), Set.make().add(target))

    var h = indexOf(pathways, n)
    if ( h > -1  ) {
      pathways.values[h] = pathways.values[h].union(n)
    } else {
      pathways.values.push(n)
    }

    return pathways
  }

  var Pathways = Set.extend({
    add: enslave(add)
  , indexOf: enslave(indexOf)
  })


  module.exports = Pathways


}()

},{"./set.js":66,"enslave":57,"viral":64}],66:[function(require,module,exports){
void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var Arr = require('./arr.js')


  function has(set, value){
    return set.indexOf(value) > -1
  }

  function add(set, value){
    if ( ! has(set, value) ) {
      set.values.push(value)
    }
    return set
  }

  function remove(set, value){
    var idx = indexOf(set, value)
    if ( idx > -1 ) {
      set.values.splice(idx, 1)
    }
    return set
  }

  function same(set, other){
    return set.values.length != other.values.length ? false
         : set.values.every(function(a){ return other.has(a) })
  }

  function union(set, other){
    var result = set.clone()
    other.forEach(function(v){
      result.add(v)
    })
    return result
  }

  function joint(set, other){
    return set.some(function(a){ return other.has(a) })
  }

  function clone(set){
    return Set.make(set)
  }

  var Set = Arr.extend({
    union: enslave(union)
  , has: enslave(has)
  , add: enslave(add)
  , remove: enslave(remove)
  , same: enslave(same)
  , joint: enslave(joint)
  , clone: enslave(clone)
  })

  module.exports = Set

}()

},{"./arr.js":1,"enslave":57,"viral":64}],67:[function(require,module,exports){
void function(){
  "use strict"
  var rnd = require('random-number')
  var fs = require('fs')
  var wt = require('../index.js')
  var dom = require('../util/dom.js')
  var uid = require('../util/unique_id.js')
  var rand_int = rnd.generator({integer: true})
  var print = console.log.bind(console)

  var lipscfg = {
      count: 1                      // Number of words, sentences, or paragraphs to generate.
    , units: 'sentences'            // Generate words, sentences, or paragraphs.
    , sentenceLowerBound: 1         // Minimum words per sentence.
    , sentenceUpperBound: 2        // Maximum words per sentence.
    , format: 'plain'               // Plain text or html
  }

  var lipsum = require('lorem-ipsum').bind(null, lipscfg)

  function isNumber(n){ return typeof n == 'number' }

  var config = wt.config({
    padding: 21
  , rank_detection_error_margin: 2
  , edgeWidth: 5
  , edgeClass: 'FCHLine'
  , edgeEndClass: 'FCHLine-witharrow'
  , intersectionClass: 'FCHLine-intersection'
  })



  var graph = wt.graph({
    rankDir: 'LR'
  , universalSep: 29
  , edgeSep: 0
  , rankSep: 135
  })

  var nodes = Array(12)
  var ranks = ['same_first','same_second','same_second','same_second','same_third','same_third','same_third','same_third','same_third','same_fourth','same_fourth','same_fourth']
  for ( var i = 0; i < nodes.length ; i++ ) {
    nodes[i] = graph.add_node(
      'FCHBox'
    , function (node, values){
// these lines shouldn't be here
        node.attr('x', values.x)
        node.attr('y', values.y)
        var x = values.x - values.width / 2
        var y = values.y - values.height / 2
        node.add_attr(':first', 'transform', 'translate(' + x + ',' + y + ')')
        node.add_attr('.FCHBox-Text-bg', 'width', values.width )
        node.add_attr('.FCHBox-Text-bg', 'height', values.height)
    }
    , {
        ".FCHBox-Text-title": {_text: (i+1) +' ' + lipsum().slice(0, 17)}
      , ".FCHBox-Text-type" : {_text: 'Type: ' + lipsum().slice(0, 13)}
    })
  }

  // var rnd_node = rnd.generator({min: 0, max: nodes.length - 1, integer: true})
  // var links= Array(rand_int(1, Math.pow(rand_int(1, nodes.length), 2) - 1))
  var connections = [
    [0,1]
  , [0,2]
  , [0,3]
  , [1,4]
  , [1,5]
  , [1,6]
  , [3,9]
  , [2,7]
  , [2,8]
  , [4,9]
  , [6,9]
  , [5,10]
  , [7,11]
  , [8,11]
  , [9,7]
  , [9,8]
  , [9,11]
  , [10,7]
  , [10,8]
  , [10,11]
  ]
  var links = Array(connections.length)


  function but(gen, x){
    var r = gen()
    while ( r == x ) { r = gen() }
    return r
  }


  for ( var i = connections.length - 1; i >= 0 ; i-- ) {
    //var link1 = rnd_node()

    links[i] = graph.connect(
      'FCHLine'
    // , nodes[link1]
    // , nodes[but(rnd_node, link1)]
    , nodes[connections[i][0]]
    , nodes[connections[i][1]]
  )

  }

  var diagram = wt.diagram(config, graph)
  diagram.to_defs("<font horiz-adv-x=\"2048\">\n  <!-- Open Sans is a trademark of Google and may be registered in certain jurisdictions. -->\n  <!-- Copyright: Copyright 2014 Adobe System Incorporated. All rights reserved. -->\n  <font-face font-family=\"OpenSans-Semibold\" units-per-em=\"2048\" underline-position=\"-154\" underline-thickness=\"102\"/>\n  <missing-glyph horiz-adv-x=\"1229\" d=\"M193,1462l841,0l0,-1462l-841,0M297,104l633,0l0,1254l-633,0z\"/>\n  <glyph unicode=\" \" horiz-adv-x=\"532\"/>\n  <glyph unicode=\"!\" horiz-adv-x=\"565\" d=\"M371,444l-174,0l-52,1018l277,0M133,125C133,174 146,212 172,238C198,263 235,276 283,276C330,276 367,263 392,236C417,209 430,172 430,125C430,78 417,40 392,13C366,-15 330,-29 283,-29C236,-29 199,-16 173,11C146,38 133,76 133,125z\"/>\n  <glyph unicode=\"&quot;\" horiz-adv-x=\"893\" d=\"M365,1462l-41,-528l-150,0l-41,528M760,1462l-41,-528l-150,0l-41,528z\"/>\n  <glyph unicode=\"#\" horiz-adv-x=\"1323\" d=\"M989,870l-55,-284l270,0l0,-168l-303,0l-80,-418l-178,0l80,418l-248,0l-80,-418l-174,0l76,418l-250,0l0,168l283,0l57,284l-264,0l0,168l293,0l80,422l180,0l-80,-422l252,0l80,422l174,0l-80,-422l252,0l0,-168M506,586l250,0l57,284l-250,0z\"/>\n  <glyph unicode=\"$\" horiz-adv-x=\"1169\" d=\"M1063,453C1063,356 1028,277 957,214C886,151 784,113 651,98l0,-217l-133,0l0,211C353,95 217,120 111,168l0,211C168,351 235,328 312,309C389,290 457,280 518,279l0,374l-84,31C325,726 245,776 195,835C144,893 119,965 119,1051C119,1143 155,1219 227,1278C298,1337 395,1373 518,1386l0,168l133,0l0,-165C786,1384 915,1357 1036,1307l-73,-183C858,1165 754,1190 651,1198l0,-364l76,-29C854,756 941,705 990,651C1039,597 1063,531 1063,453M827,438C827,477 814,509 787,534C760,559 714,583 651,606l0,-319C768,305 827,355 827,438M354,1053C354,1015 366,983 390,958C413,933 456,908 518,883l0,311C465,1186 424,1170 396,1145C368,1120 354,1090 354,1053z\"/>\n  <glyph unicode=\"%\" horiz-adv-x=\"1765\" d=\"M279,1024C279,925 289,851 308,802C327,753 359,729 403,729C491,729 535,827 535,1024C535,1221 491,1319 403,1319C359,1319 327,1295 308,1246C289,1197 279,1123 279,1024M729,1026C729,873 702,758 647,681C592,604 510,565 403,565C302,565 223,605 168,685C112,764 84,878 84,1026C84,1331 190,1483 403,1483C508,1483 588,1444 645,1365C701,1286 729,1173 729,1026M1231,440C1231,341 1241,266 1261,217C1280,168 1312,143 1356,143C1443,143 1487,242 1487,440C1487,635 1443,733 1356,733C1312,733 1280,709 1261,661C1241,613 1231,539 1231,440M1681,440C1681,287 1653,172 1598,95C1543,18 1462,-20 1356,-20C1255,-20 1176,20 1120,99C1064,178 1036,291 1036,440C1036,745 1143,897 1356,897C1459,897 1539,858 1596,779C1653,700 1681,587 1681,440M1384,1462l-811,-1462l-194,0l811,1462z\"/>\n  <glyph unicode=\"&amp;\" horiz-adv-x=\"1516\" d=\"M451,1147C451,1105 462,1065 485,1028C507,991 538,951 578,909C653,952 706,992 737,1029C767,1066 782,1107 782,1153C782,1196 768,1231 739,1257C710,1283 671,1296 623,1296C570,1296 529,1283 498,1256C467,1229 451,1192 451,1147M600,182C722,182 826,218 913,289l-383,377C459,621 411,578 384,539C357,499 344,454 344,403C344,338 367,285 414,244C460,203 522,182 600,182M96,387C96,474 117,551 160,616C203,681 280,745 391,809C328,883 285,946 262,997C239,1048 227,1100 227,1155C227,1256 263,1336 336,1395C408,1454 505,1483 627,1483C745,1483 838,1455 905,1398C972,1341 1006,1264 1006,1167C1006,1091 984,1022 939,960C894,898 818,836 713,774l346,-334C1113,511 1158,616 1194,754l242,0C1389,565 1315,410 1212,291l301,-291l-303,0l-149,145C993,90 921,49 844,22C767,-6 681,-20 588,-20C435,-20 314,16 227,89C140,162 96,261 96,387z\"/>\n  <glyph unicode=\"'\" horiz-adv-x=\"498\" d=\"M365,1462l-41,-528l-150,0l-41,528z\"/>\n  <glyph unicode=\"(\" horiz-adv-x=\"649\" d=\"M82,561C82,738 108,903 160,1057C211,1211 286,1346 383,1462l205,0C495,1337 424,1196 375,1041C326,885 301,726 301,563C301,400 326,243 375,90C424,-63 495,-201 586,-324l-203,0C285,-211 210,-78 159,73C108,224 82,387 82,561z\"/>\n  <glyph unicode=\")\" horiz-adv-x=\"649\" d=\"M567,561C567,386 541,222 490,71C438,-80 363,-212 266,-324l-203,0C155,-199 226,-61 275,91C324,243 348,400 348,563C348,726 323,886 274,1041C225,1196 154,1336 61,1462l205,0C364,1345 439,1210 490,1056C541,901 567,736 567,561z\"/>\n  <glyph unicode=\"*\" horiz-adv-x=\"1122\" d=\"M672,1556l-41,-382l385,108l28,-217l-360,-29l236,-311l-199,-107l-166,338l-149,-338l-205,107l231,311l-358,29l35,217l376,-108l-41,382z\"/>\n  <glyph unicode=\"+\" horiz-adv-x=\"1169\" d=\"M494,633l-398,0l0,178l398,0l0,408l180,0l0,-408l399,0l0,-178l-399,0l0,-406l-180,0z\"/>\n  <glyph unicode=\",\" horiz-adv-x=\"547\" d=\"M412,215C380,91 321,-69 236,-264l-173,0C109,-84 143,83 166,238l231,0z\"/>\n  <glyph unicode=\"-\" horiz-adv-x=\"659\" d=\"M72,449l0,200l514,0l0,-200z\"/>\n  <glyph unicode=\".\" horiz-adv-x=\"563\" d=\"M133,125C133,174 146,211 171,237C196,263 233,276 281,276C330,276 367,263 392,236C417,209 430,172 430,125C430,78 417,40 392,13C366,-15 329,-29 281,-29C233,-29 196,-15 171,12C146,39 133,77 133,125z\"/>\n  <glyph unicode=\"/\" horiz-adv-x=\"799\" d=\"M782,1462l-544,-1462l-222,0l545,1462z\"/>\n  <glyph unicode=\"0\" horiz-adv-x=\"1169\" d=\"M1081,731C1081,477 1040,288 959,165C877,42 752,-20 584,-20C421,-20 298,44 214,171C130,298 88,485 88,731C88,989 129,1179 211,1302C292,1424 417,1485 584,1485C747,1485 871,1421 955,1293C1039,1165 1081,978 1081,731M326,731C326,532 347,389 388,304C429,219 494,176 584,176C674,176 740,219 782,306C823,393 844,534 844,731C844,927 823,1069 782,1157C740,1244 674,1288 584,1288C494,1288 429,1245 388,1159C347,1073 326,930 326,731z\"/>\n  <glyph unicode=\"1\" horiz-adv-x=\"1169\" d=\"M780,0l-235,0l0,944C545,1057 548,1146 553,1212C538,1196 519,1178 497,1159C474,1140 399,1078 272,975l-118,149l430,338l196,0z\"/>\n  <glyph unicode=\"2\" horiz-adv-x=\"1169\" d=\"M1081,0l-991,0l0,178l377,379C578,671 652,752 689,800C725,847 751,892 768,934C785,976 793,1021 793,1069C793,1135 773,1187 734,1225C694,1263 639,1282 569,1282C513,1282 459,1272 407,1251C354,1230 294,1193 225,1139l-127,155C179,1363 258,1411 335,1440C412,1469 493,1483 580,1483C716,1483 825,1448 907,1377C989,1306 1030,1210 1030,1090C1030,1024 1018,961 995,902C971,843 935,782 886,719C837,656 755,570 641,463l-254,-246l0,-10l694,0z\"/>\n  <glyph unicode=\"3\" horiz-adv-x=\"1169\" d=\"M1026,1126C1026,1033 999,956 945,895C891,833 815,791 717,770l0,-8C834,747 922,711 981,653C1040,594 1069,517 1069,420C1069,279 1019,171 920,95C821,18 679,-20 496,-20C334,-20 197,6 86,59l0,209C148,237 214,214 283,197C352,180 419,172 483,172C596,172 681,193 737,235C793,277 821,342 821,430C821,508 790,565 728,602C666,639 569,657 436,657l-127,0l0,191l129,0C671,848 788,929 788,1090C788,1153 768,1201 727,1235C686,1269 626,1286 547,1286C492,1286 438,1278 387,1263C336,1247 275,1216 205,1171l-115,164C224,1434 380,1483 557,1483C704,1483 819,1451 902,1388C985,1325 1026,1237 1026,1126z\"/>\n  <glyph unicode=\"4\" horiz-adv-x=\"1169\" d=\"M1133,319l-197,0l0,-319l-229,0l0,319l-668,0l0,181l668,966l229,0l0,-952l197,0M707,514l0,367C707,1012 710,1119 717,1202l-8,0C690,1158 661,1105 621,1042l-363,-528z\"/>\n  <glyph unicode=\"5\" horiz-adv-x=\"1169\" d=\"M586,913C733,913 850,874 936,796C1022,718 1065,612 1065,477C1065,321 1016,199 919,112C821,24 682,-20 502,-20C339,-20 210,6 117,59l0,213C171,241 233,218 303,201C373,184 438,176 498,176C604,176 685,200 740,247C795,294 823,364 823,455C823,630 712,717 489,717C458,717 419,714 373,708C327,701 287,694 252,686l-105,62l56,714l760,0l0,-209l-553,0l-33,-362C400,895 429,900 463,905C496,910 537,913 586,913z\"/>\n  <glyph unicode=\"6\" horiz-adv-x=\"1169\" d=\"M94,623C94,1195 327,1481 793,1481C866,1481 928,1475 979,1464l0,-196C928,1283 870,1290 803,1290C646,1290 529,1248 450,1164C371,1080 329,945 322,760l12,0C365,814 409,856 466,886C523,915 589,930 666,930C799,930 902,889 976,808C1050,727 1087,616 1087,477C1087,324 1044,203 959,114C873,25 756,-20 608,-20C503,-20 412,5 335,56C258,106 198,179 157,276C115,372 94,488 94,623M604,174C685,174 747,200 791,252C834,304 856,378 856,475C856,559 836,625 795,673C754,721 692,745 610,745C559,745 513,734 470,713C427,691 394,661 369,624C344,586 332,547 332,508C332,414 358,335 409,271C460,206 525,174 604,174z\"/>\n  <glyph unicode=\"7\" horiz-adv-x=\"1169\" d=\"M256,0l578,1253l-760,0l0,207l1011,0l0,-164l-575,-1296z\"/>\n  <glyph unicode=\"8\" horiz-adv-x=\"1169\" d=\"M584,1481C723,1481 832,1449 913,1386C994,1322 1034,1237 1034,1130C1034,980 944,861 764,772C879,715 960,654 1009,591C1057,528 1081,457 1081,379C1081,258 1037,162 948,89C859,16 739,-20 588,-20C429,-20 306,14 219,82C132,150 88,246 88,371C88,452 111,526 157,591C202,656 277,713 381,764C292,817 228,874 190,933C152,992 133,1059 133,1133C133,1239 175,1324 258,1387C341,1450 450,1481 584,1481M313,379C313,310 337,256 386,218C435,179 501,160 584,160C670,160 737,180 785,220C832,259 856,313 856,381C856,435 834,484 790,529C746,574 679,615 590,653l-29,13C473,627 410,585 371,539C332,492 313,439 313,379M582,1300C515,1300 462,1284 421,1251C380,1218 360,1173 360,1116C360,1081 367,1050 382,1023C397,996 418,971 446,949C474,926 521,899 588,868C668,903 725,941 758,980C791,1019 807,1064 807,1116C807,1173 787,1218 746,1251C705,1284 650,1300 582,1300z\"/>\n  <glyph unicode=\"9\" horiz-adv-x=\"1169\" d=\"M1079,838C1079,550 1021,335 905,193C789,51 614,-20 381,-20C292,-20 229,-15 190,-4l0,197C249,176 309,168 369,168C528,168 646,211 724,296C802,381 845,515 852,698l-12,0C801,638 753,595 698,568C642,541 577,528 502,528C373,528 271,568 197,649C123,730 86,840 86,981C86,1134 129,1255 215,1346C300,1436 417,1481 565,1481C669,1481 760,1456 837,1405C914,1354 974,1281 1016,1185C1058,1088 1079,973 1079,838M569,1286C488,1286 425,1260 382,1207C339,1154 317,1079 317,983C317,900 337,834 378,787C418,739 479,715 561,715C640,715 707,739 761,786C815,833 842,889 842,952C842,1011 831,1067 808,1119C785,1170 752,1211 711,1241C670,1271 622,1286 569,1286z\"/>\n  <glyph unicode=\":\" horiz-adv-x=\"563\" d=\"M133,125C133,174 146,211 171,237C196,263 233,276 281,276C330,276 367,263 392,236C417,209 430,172 430,125C430,78 417,40 392,13C366,-15 329,-29 281,-29C233,-29 196,-15 171,12C146,39 133,77 133,125M133,979C133,1080 182,1130 281,1130C331,1130 368,1117 393,1090C418,1063 430,1026 430,979C430,932 417,894 392,867C366,839 329,825 281,825C233,825 196,839 171,866C146,893 133,931 133,979z\"/>\n  <glyph unicode=\";\" horiz-adv-x=\"569\" d=\"M397,238l15,-23C380,91 321,-69 236,-264l-173,0C109,-84 143,83 166,238M131,979C131,1080 180,1130 279,1130C329,1130 366,1117 391,1090C416,1063 428,1026 428,979C428,932 415,894 390,867C364,839 327,825 279,825C231,825 194,839 169,866C144,893 131,931 131,979z\"/>\n  <glyph unicode=\"&lt;\" horiz-adv-x=\"1169\" d=\"M1073,221l-977,430l0,121l977,488l0,-195l-733,-344l733,-303z\"/>\n  <glyph unicode=\"=\" horiz-adv-x=\"1169\" d=\"M102,831l0,179l963,0l0,-179M102,432l0,178l963,0l0,-178z\"/>\n  <glyph unicode=\"&gt;\" horiz-adv-x=\"1169\" d=\"M96,418l733,303l-733,344l0,195l977,-488l0,-121l-977,-430z\"/>\n  <glyph unicode=\"?\" horiz-adv-x=\"928\" d=\"M283,444l0,64C283,581 296,642 323,691C350,740 396,790 463,842C542,905 594,953 617,988C640,1023 651,1064 651,1112C651,1168 632,1211 595,1241C558,1271 504,1286 434,1286C371,1286 312,1277 258,1259C204,1241 151,1219 100,1194l-84,176C151,1445 296,1483 451,1483C582,1483 685,1451 762,1387C839,1323 877,1235 877,1122C877,1072 870,1028 855,989C840,950 818,912 789,877C759,842 708,796 635,739C573,690 532,650 511,618C490,586 479,543 479,489l0,-45M242,125C242,226 291,276 389,276C437,276 474,263 499,237C524,210 537,173 537,125C537,78 524,40 499,13C473,-15 436,-29 389,-29C342,-29 305,-15 280,12C255,39 242,76 242,125z\"/>\n  <glyph unicode=\"@\" horiz-adv-x=\"1839\" d=\"M1726,739C1726,644 1711,557 1681,478C1651,399 1609,337 1555,293C1500,249 1437,227 1366,227C1313,227 1268,241 1229,269C1190,297 1164,335 1151,383l-12,0C1106,331 1066,292 1018,266C970,240 916,227 856,227C747,227 662,262 600,332C537,402 506,497 506,616C506,753 547,865 630,951C713,1036 824,1079 963,1079C1014,1079 1070,1075 1132,1066C1193,1057 1248,1044 1296,1028l-22,-465l0,-24C1274,432 1309,379 1378,379C1431,379 1473,413 1504,481C1535,549 1550,636 1550,741C1550,855 1527,955 1480,1042C1433,1128 1367,1194 1281,1241C1195,1288 1096,1311 985,1311C843,1311 720,1282 615,1223C510,1164 429,1081 374,972C319,863 291,736 291,592C291,399 343,250 446,146C549,42 698,-10 891,-10C1038,-10 1192,20 1352,80l0,-164C1212,-141 1060,-170 895,-170C648,-170 456,-103 318,30C180,163 111,348 111,586C111,760 148,915 223,1051C298,1186 401,1290 534,1362C666,1434 816,1470 983,1470C1128,1470 1257,1440 1370,1380C1483,1320 1570,1235 1633,1124C1695,1013 1726,884 1726,739M698,612C698,457 759,379 881,379C1010,379 1080,477 1092,672l12,239C1062,922 1017,928 969,928C884,928 817,900 770,843C722,786 698,709 698,612z\"/>\n  <glyph unicode=\"A\" horiz-adv-x=\"1354\" d=\"M1100,0l-146,406l-559,0l-143,-406l-252,0l547,1468l260,0l547,-1468M891,612l-137,398C744,1037 730,1079 713,1136C695,1193 683,1235 676,1262C658,1180 632,1090 597,993l-132,-381z\"/>\n  <glyph unicode=\"B\" horiz-adv-x=\"1352\" d=\"M193,1462l434,0C828,1462 974,1433 1064,1374C1153,1315 1198,1223 1198,1096C1198,1011 1176,940 1132,883C1088,826 1025,791 942,776l0,-10C1045,747 1120,709 1169,652C1217,595 1241,517 1241,420C1241,289 1195,186 1104,112C1012,37 884,0 721,0l-528,0M432,858l230,0C762,858 835,874 881,906C927,937 950,991 950,1067C950,1136 925,1185 876,1216C826,1247 747,1262 639,1262l-207,0M432,664l0,-463l254,0C786,201 862,220 913,259C964,297 989,357 989,440C989,516 963,572 911,609C859,646 780,664 674,664z\"/>\n  <glyph unicode=\"C\" horiz-adv-x=\"1298\" d=\"M815,1278C678,1278 570,1229 491,1132C412,1035 373,900 373,729C373,550 411,414 487,322C562,230 672,184 815,184C877,184 937,190 995,203C1053,215 1113,231 1176,250l0,-205C1061,2 931,-20 786,-20C572,-20 408,45 293,175C178,304 121,490 121,731C121,883 149,1016 205,1130C260,1244 341,1331 446,1392C551,1453 675,1483 817,1483C966,1483 1104,1452 1231,1389l-86,-199C1096,1213 1044,1234 989,1252C934,1269 876,1278 815,1278z\"/>\n  <glyph unicode=\"D\" horiz-adv-x=\"1503\" d=\"M1382,745C1382,504 1315,319 1181,192C1047,64 854,0 602,0l-409,0l0,1462l452,0C878,1462 1059,1399 1188,1274C1317,1149 1382,972 1382,745M1130,737C1130,1087 966,1262 639,1262l-207,0l0,-1061l170,0C954,201 1130,380 1130,737z\"/>\n  <glyph unicode=\"E\" horiz-adv-x=\"1143\" d=\"M1020,0l-827,0l0,1462l827,0l0,-202l-588,0l0,-398l551,0l0,-200l-551,0l0,-459l588,0z\"/>\n  <glyph unicode=\"F\" horiz-adv-x=\"1090\" d=\"M430,0l-237,0l0,1462l825,0l0,-202l-588,0l0,-457l551,0l0,-203l-551,0z\"/>\n  <glyph unicode=\"G\" horiz-adv-x=\"1487\" d=\"M791,793l538,0l0,-734C1241,30 1157,10 1076,-2C995,-14 907,-20 813,-20C592,-20 421,46 301,177C181,308 121,492 121,731C121,966 189,1151 324,1284C459,1417 646,1483 883,1483C1036,1483 1180,1454 1317,1395l-84,-199C1114,1251 996,1278 877,1278C721,1278 598,1229 507,1131C416,1033 371,899 371,729C371,550 412,415 494,322C575,229 693,182 846,182C923,182 1006,192 1094,211l0,377l-303,0z\"/>\n  <glyph unicode=\"H\" horiz-adv-x=\"1538\" d=\"M1346,0l-240,0l0,659l-674,0l0,-659l-239,0l0,1462l239,0l0,-598l674,0l0,598l240,0z\"/>\n  <glyph unicode=\"J\" horiz-adv-x=\"612\" d=\"M8,-408C-57,-408 -112,-400 -156,-383l0,201C-100,-196 -51,-203 -10,-203C121,-203 186,-120 186,45l0,1417l240,0l0,-1409C426,-96 391,-210 320,-289C249,-368 145,-408 8,-408z\"/>\n  <glyph unicode=\"K\" horiz-adv-x=\"1309\" d=\"M1309,0l-277,0l-459,662l-141,-115l0,-547l-239,0l0,1462l239,0l0,-698C497,844 562,921 627,995l395,467l272,0C1039,1162 856,948 745,821z\"/>\n  <glyph unicode=\"L\" horiz-adv-x=\"1110\" d=\"M193,0l0,1462l239,0l0,-1257l619,0l0,-205z\"/>\n  <glyph unicode=\"M\" horiz-adv-x=\"1890\" d=\"M825,0l-424,1221l-8,0C404,1040 410,870 410,711l0,-711l-217,0l0,1462l337,0l406,-1163l6,0l418,1163l338,0l0,-1462l-230,0l0,723C1468,796 1470,890 1474,1007C1477,1124 1480,1194 1483,1219l-8,0l-439,-1219z\"/>\n  <glyph unicode=\"N\" horiz-adv-x=\"1604\" d=\"M1411,0l-293,0l-719,1165l-8,0l5,-65C405,976 410,863 410,760l0,-760l-217,0l0,1462l290,0l717,-1159l6,0C1205,318 1202,374 1198,471C1194,567 1192,642 1192,696l0,766l219,0z\"/>\n  <glyph unicode=\"O\" horiz-adv-x=\"1612\" d=\"M1491,733C1491,495 1432,310 1313,178C1194,46 1025,-20 807,-20C586,-20 417,46 299,177C180,308 121,494 121,735C121,976 181,1162 300,1291C419,1420 588,1485 809,1485C1026,1485 1194,1419 1313,1288C1432,1157 1491,972 1491,733M375,733C375,553 411,417 484,324C557,231 664,184 807,184C949,184 1056,230 1129,322C1201,414 1237,551 1237,733C1237,912 1201,1048 1130,1141C1058,1234 951,1280 809,1280C666,1280 558,1234 485,1141C412,1048 375,912 375,733z\"/>\n  <glyph unicode=\"P\" horiz-adv-x=\"1260\" d=\"M1161,1020C1161,867 1111,750 1011,669C911,588 769,547 584,547l-152,0l0,-547l-239,0l0,1462l421,0C797,1462 934,1425 1025,1350C1116,1275 1161,1165 1161,1020M432,748l127,0C682,748 772,769 829,812C886,855 915,921 915,1012C915,1096 889,1159 838,1200C787,1241 707,1262 598,1262l-166,0z\"/>\n  <glyph unicode=\"Q\" horiz-adv-x=\"1612\" d=\"M1491,733C1491,556 1457,406 1390,285C1322,164 1223,78 1094,29l350,-377l-322,0l-276,328l-39,0C586,-20 417,46 299,177C180,308 121,494 121,735C121,976 181,1162 300,1291C419,1420 588,1485 809,1485C1026,1485 1194,1419 1313,1288C1432,1157 1491,972 1491,733M375,733C375,553 411,417 484,324C557,231 664,184 807,184C949,184 1056,230 1129,322C1201,414 1237,551 1237,733C1237,912 1201,1048 1130,1141C1058,1234 951,1280 809,1280C666,1280 558,1234 485,1141C412,1048 375,912 375,733z\"/>\n  <glyph unicode=\"R\" horiz-adv-x=\"1309\" d=\"M432,782l166,0C709,782 790,803 840,844C890,885 915,947 915,1028C915,1111 888,1170 834,1206C780,1242 699,1260 590,1260l-158,0M432,584l0,-584l-239,0l0,1462l413,0C795,1462 934,1427 1025,1356C1116,1285 1161,1179 1161,1036C1161,854 1066,724 877,647l413,-647l-272,0l-350,584z\"/>\n  <glyph unicode=\"S\" horiz-adv-x=\"1126\" d=\"M1036,397C1036,267 989,165 895,91C801,17 671,-20 506,-20C341,-20 205,6 100,57l0,226C167,252 238,227 313,209C388,191 457,182 522,182C617,182 687,200 732,236C777,272 799,320 799,381C799,436 778,482 737,520C696,558 610,603 481,655C348,709 254,771 199,840C144,909 117,993 117,1090C117,1212 160,1308 247,1378C334,1448 450,1483 596,1483C736,1483 875,1452 1014,1391l-76,-195C808,1251 692,1278 590,1278C513,1278 454,1261 414,1228C374,1194 354,1149 354,1094C354,1056 362,1024 378,997C394,970 420,944 457,920C494,896 560,864 655,825C762,780 841,739 891,700C941,661 978,618 1001,569C1024,520 1036,463 1036,397z\"/>\n  <glyph unicode=\"T\" horiz-adv-x=\"1159\" d=\"M698,0l-239,0l0,1257l-430,0l0,205l1099,0l0,-205l-430,0z\"/>\n  <glyph unicode=\"U\" horiz-adv-x=\"1520\" d=\"M1339,1462l0,-946C1339,408 1316,314 1270,233C1223,152 1156,89 1069,46C981,2 876,-20 754,-20C573,-20 432,28 331,124C230,220 180,352 180,520l0,942l240,0l0,-925C420,416 448,327 504,270C560,213 646,184 762,184C987,184 1100,302 1100,539l0,923z\"/>\n  <glyph unicode=\"V\" horiz-adv-x=\"1274\" d=\"M1026,1462l248,0l-512,-1462l-252,0l-510,1462l246,0l305,-909C567,510 584,454 602,386C620,317 632,266 637,233C646,284 659,342 677,409C695,476 710,525 721,557z\"/>\n  <glyph unicode=\"W\" horiz-adv-x=\"1937\" d=\"M1542,0l-260,0l-248,872C1023,910 1010,965 994,1037C978,1108 968,1158 965,1186C958,1143 948,1088 933,1020C918,952 905,901 895,868l-242,-868l-260,0l-189,732l-192,730l244,0l209,-852C498,473 521,353 535,248C542,305 553,368 568,438C583,508 596,565 608,608l238,854l237,0l244,-858C1350,525 1375,406 1401,248C1411,343 1435,465 1473,612l208,850l242,0z\"/>\n  <glyph unicode=\"X\" horiz-adv-x=\"1274\" d=\"M1270,0l-275,0l-366,598l-369,-598l-256,0l485,758l-454,704l266,0l338,-553l338,553l258,0l-457,-708z\"/>\n  <glyph unicode=\"Y\" horiz-adv-x=\"1212\" d=\"M606,795l346,667l260,0l-487,-895l0,-567l-240,0l0,559l-485,903l260,0z\"/>\n  <glyph unicode=\"Z\" horiz-adv-x=\"1178\" d=\"M1112,0l-1046,0l0,166l737,1091l-717,0l0,205l1006,0l0,-168l-740,-1089l760,0z\"/>\n  <glyph unicode=\"\\\" horiz-adv-x=\"799\" d=\"M238,1462l544,-1462l-221,0l-545,1462z\"/>\n  <glyph unicode=\"^\" horiz-adv-x=\"1100\" d=\"M29,535l436,935l121,0l485,-935l-194,0l-349,694l-307,-694z\"/>\n  <glyph unicode=\"_\" horiz-adv-x=\"879\" d=\"M883,-319l-887,0l0,135l887,0z\"/>\n  <glyph unicode=\"a\" horiz-adv-x=\"1188\" d=\"M860,0l-47,154l-8,0C752,87 698,41 644,17C590,-8 521,-20 436,-20C327,-20 243,9 182,68C121,127 90,210 90,317C90,431 132,517 217,575C302,633 431,665 604,670l191,6l0,59C795,806 779,859 746,894C713,929 661,946 592,946C535,946 481,938 429,921C377,904 327,885 279,862l-76,168C263,1061 329,1085 400,1102C471,1118 539,1126 602,1126C743,1126 849,1095 921,1034C992,973 1028,876 1028,745l0,-745M510,160C595,160 664,184 716,232C767,279 793,346 793,432l0,96l-142,-6C540,518 460,500 410,467C359,434 334,383 334,315C334,266 349,228 378,201C407,174 451,160 510,160z\"/>\n  <glyph unicode=\"b\" horiz-adv-x=\"1276\" d=\"M733,1126C871,1126 979,1076 1056,976C1133,876 1171,736 1171,555C1171,374 1132,233 1054,132C976,31 868,-20 729,-20C589,-20 480,30 403,131l-16,0l-43,-131l-176,0l0,1556l235,0l0,-370C403,1159 402,1118 399,1064C396,1010 394,976 393,961l10,0C478,1071 588,1126 733,1126M672,934C577,934 509,906 468,851C426,795 404,702 403,571l0,-16C403,420 424,323 467,263C510,202 579,172 676,172C759,172 823,205 866,271C909,337 930,432 930,557C930,808 844,934 672,934z\"/>\n  <glyph unicode=\"c\" horiz-adv-x=\"1014\" d=\"M614,-20C447,-20 320,29 233,127C146,224 102,364 102,547C102,733 148,876 239,976C330,1076 461,1126 633,1126C750,1126 855,1104 948,1061l-71,-189C778,911 696,930 631,930C440,930 344,803 344,549C344,425 368,332 416,270C463,207 533,176 625,176C730,176 829,202 922,254l0,-205C880,24 835,7 788,-4C740,-15 682,-20 614,-20z\"/>\n  <glyph unicode=\"d\" horiz-adv-x=\"1276\" d=\"M541,-20C403,-20 295,30 218,130C141,230 102,370 102,551C102,732 141,874 220,975C298,1076 406,1126 545,1126C690,1126 801,1072 877,965l12,0C878,1044 872,1107 872,1153l0,403l236,0l0,-1556l-184,0l-41,145l-11,0C797,35 686,-20 541,-20M604,170C701,170 771,197 815,252C859,306 882,394 883,516l0,33C883,688 860,787 815,846C770,905 699,934 602,934C519,934 456,901 411,834C366,767 344,671 344,547C344,424 366,331 409,267C452,202 517,170 604,170z\"/>\n  <glyph unicode=\"e\" horiz-adv-x=\"1180\" d=\"M651,-20C479,-20 345,30 248,131C151,231 102,369 102,545C102,726 147,868 237,971C327,1074 451,1126 608,1126C754,1126 869,1082 954,993C1039,904 1081,782 1081,627l0,-127l-737,0C347,393 376,310 431,253C486,195 563,166 662,166C727,166 788,172 845,185C901,197 961,217 1026,246l0,-191C969,28 911,8 852,-3C793,-14 726,-20 651,-20M608,948C533,948 474,924 429,877C384,830 357,761 348,670l502,0C849,761 827,831 784,878C741,925 683,948 608,948z\"/>\n  <glyph unicode=\"f\" horiz-adv-x=\"743\" d=\"M723,928l-270,0l0,-928l-236,0l0,928l-182,0l0,110l182,72l0,72C217,1313 248,1410 309,1473C370,1536 464,1567 590,1567C673,1567 754,1553 834,1526l-62,-178C714,1367 659,1376 606,1376C553,1376 514,1360 490,1327C465,1294 453,1244 453,1178l0,-72l270,0z\"/>\n  <glyph unicode=\"g\" horiz-adv-x=\"1139\" d=\"M1102,1106l0,-129l-189,-35C930,919 945,890 956,856C967,822 973,786 973,748C973,634 934,544 855,479C776,414 668,381 530,381C495,381 463,384 434,389C383,358 358,321 358,279C358,254 370,235 394,222C417,209 461,203 524,203l193,0C839,203 932,177 995,125C1058,73 1090,-2 1090,-100C1090,-225 1038,-322 935,-390C832,-458 682,-492 487,-492C336,-492 221,-465 142,-412C63,-359 23,-283 23,-184C23,-116 45,-59 88,-12C131,34 191,66 268,84C237,97 211,119 191,149C170,178 160,209 160,242C160,283 172,318 195,347C218,376 253,404 299,432C242,457 195,497 160,553C124,608 106,673 106,748C106,868 144,961 220,1027C295,1093 403,1126 543,1126C574,1126 607,1124 642,1120C676,1115 702,1111 719,1106M233,-172C233,-223 256,-262 302,-289C347,-316 411,-330 494,-330C622,-330 717,-312 780,-275C843,-238 874,-190 874,-129C874,-81 857,-47 823,-26C788,-6 724,4 631,4l-178,0C386,4 332,-12 293,-43C253,-75 233,-118 233,-172M334,748C334,679 352,625 388,588C423,551 474,532 541,532C677,532 745,605 745,750C745,822 728,878 695,917C661,956 610,975 541,975C473,975 422,956 387,917C352,878 334,822 334,748z\"/>\n  <glyph unicode=\"h\" horiz-adv-x=\"1300\" d=\"M1141,0l-236,0l0,680C905,765 888,829 854,871C819,913 765,934 690,934C591,934 519,905 473,846C426,787 403,688 403,549l0,-549l-235,0l0,1556l235,0l0,-395C403,1098 399,1030 391,958l15,0C438,1011 483,1053 540,1082C597,1111 663,1126 739,1126C1007,1126 1141,991 1141,721z\"/>\n  <glyph unicode=\"i\" horiz-adv-x=\"571\" d=\"M403,0l-235,0l0,1106l235,0M154,1399C154,1441 166,1473 189,1496C212,1519 244,1530 287,1530C328,1530 361,1519 384,1496C407,1473 418,1441 418,1399C418,1359 407,1328 384,1305C361,1282 328,1270 287,1270C244,1270 212,1282 189,1305C166,1328 154,1359 154,1399z\"/>\n  <glyph unicode=\"j\" horiz-adv-x=\"571\" d=\"M55,-492C-16,-492 -74,-484 -121,-467l0,186C-76,-293 -29,-299 18,-299C118,-299 168,-242 168,-129l0,1235l235,0l0,-1251C403,-259 373,-345 314,-404C254,-463 168,-492 55,-492M154,1399C154,1441 166,1473 189,1496C212,1519 244,1530 287,1530C328,1530 361,1519 384,1496C407,1473 418,1441 418,1399C418,1359 407,1328 384,1305C361,1282 328,1270 287,1270C244,1270 212,1282 189,1305C166,1328 154,1359 154,1399z\"/>\n  <glyph unicode=\"k\" horiz-adv-x=\"1171\" d=\"M395,584l133,166l334,356l271,0l-445,-475l473,-631l-276,0l-355,485l-129,-106l0,-379l-233,0l0,1556l233,0l0,-759l-12,-213z\"/>\n  <glyph unicode=\"l\" horiz-adv-x=\"571\" d=\"M403,0l-235,0l0,1556l235,0z\"/>\n  <glyph unicode=\"m\" horiz-adv-x=\"1958\" d=\"M1100,0l-236,0l0,682C864,767 848,830 816,872C784,913 734,934 666,934C575,934 509,905 467,846C424,787 403,688 403,551l0,-551l-235,0l0,1106l184,0l33,-145l12,0C428,1014 472,1054 531,1083C589,1112 653,1126 723,1126C893,1126 1006,1068 1061,952l16,0C1110,1007 1156,1049 1215,1080C1274,1111 1342,1126 1419,1126C1551,1126 1647,1093 1708,1026C1768,959 1798,858 1798,721l0,-721l-235,0l0,682C1563,767 1547,830 1515,872C1482,913 1432,934 1364,934C1273,934 1206,906 1164,849C1121,792 1100,704 1100,586z\"/>\n  <glyph unicode=\"n\" horiz-adv-x=\"1300\" d=\"M1141,0l-236,0l0,680C905,765 888,829 854,871C819,913 765,934 690,934C591,934 518,905 472,846C426,787 403,689 403,551l0,-551l-235,0l0,1106l184,0l33,-145l12,0C430,1014 478,1054 539,1083C600,1112 668,1126 743,1126C1008,1126 1141,991 1141,721z\"/>\n  <glyph unicode=\"o\" horiz-adv-x=\"1251\" d=\"M1149,555C1149,374 1103,233 1010,132C917,31 788,-20 623,-20C520,-20 428,3 349,50C270,97 209,164 166,251C123,338 102,440 102,555C102,734 148,874 240,975C332,1076 462,1126 629,1126C789,1126 916,1075 1009,972C1102,869 1149,730 1149,555M344,555C344,300 438,172 627,172C814,172 907,300 907,555C907,808 813,934 625,934C526,934 455,901 411,836C366,771 344,677 344,555z\"/>\n  <glyph unicode=\"p\" horiz-adv-x=\"1276\" d=\"M729,-20C589,-20 480,30 403,131l-14,0C398,38 403,-19 403,-39l0,-453l-235,0l0,1598l190,0C363,1085 374,1036 391,958l12,0C476,1070 586,1126 733,1126C871,1126 979,1076 1056,976C1133,876 1171,736 1171,555C1171,374 1132,233 1054,132C975,31 867,-20 729,-20M672,934C579,934 511,907 468,852C425,797 403,710 403,590l0,-35C403,420 424,323 467,263C510,202 579,172 676,172C757,172 820,205 864,272C908,339 930,434 930,557C930,681 908,775 865,839C821,902 757,934 672,934z\"/>\n  <glyph unicode=\"q\" horiz-adv-x=\"1276\" d=\"M606,168C705,168 776,197 819,254C862,311 883,397 883,512l0,37C883,686 861,784 817,844C772,904 701,934 602,934C518,934 454,901 410,834C366,767 344,672 344,547C344,294 431,168 606,168M539,-20C402,-20 295,30 218,131C141,231 102,371 102,551C102,731 141,872 220,974C299,1075 407,1126 545,1126C614,1126 677,1113 732,1088C787,1062 836,1020 879,961l8,0l26,145l195,0l0,-1598l-236,0l0,469C872,6 873,37 876,70C879,103 881,128 883,145l-13,0C801,35 690,-20 539,-20z\"/>\n  <glyph unicode=\"r\" horiz-adv-x=\"883\" d=\"M729,1126C776,1126 815,1123 846,1116l-23,-219C790,905 755,909 719,909C625,909 549,878 491,817C432,756 403,676 403,578l0,-578l-235,0l0,1106l184,0l31,-195l12,0C432,977 480,1029 539,1068C598,1107 661,1126 729,1126z\"/>\n  <glyph unicode=\"s\" horiz-adv-x=\"997\" d=\"M911,315C911,207 872,124 793,67C714,9 602,-20 455,-20C308,-20 189,2 100,47l0,203C230,190 351,160 463,160C608,160 680,204 680,291C680,319 672,342 656,361C640,380 614,399 577,419C540,439 489,462 424,487C297,536 211,586 166,635C121,684 98,748 98,827C98,922 136,995 213,1048C289,1100 393,1126 524,1126C654,1126 777,1100 893,1047l-76,-177C698,919 597,944 516,944C392,944 330,909 330,838C330,803 346,774 379,750C411,726 481,693 590,651C681,616 748,583 789,554C830,525 861,491 881,453C901,414 911,368 911,315z\"/>\n  <glyph unicode=\"t\" horiz-adv-x=\"805\" d=\"M580,170C637,170 695,179 752,197l0,-177C726,9 693,-1 652,-8C611,-16 568,-20 524,-20C301,-20 190,97 190,332l0,596l-151,0l0,104l162,86l80,234l145,0l0,-246l315,0l0,-178l-315,0l0,-592C426,279 440,238 469,211C497,184 534,170 580,170z\"/>\n  <glyph unicode=\"u\" horiz-adv-x=\"1300\" d=\"M948,0l-33,145l-12,0C870,94 824,53 764,24C703,-5 634,-20 557,-20C423,-20 323,13 257,80C191,147 158,248 158,383l0,723l237,0l0,-682C395,339 412,276 447,234C482,191 536,170 610,170C709,170 781,200 828,259C874,318 897,416 897,555l0,551l236,0l0,-1106z\"/>\n  <glyph unicode=\"v\" horiz-adv-x=\"1096\" d=\"M420,0l-420,1106l248,0l225,-643C512,355 535,268 543,201l8,0C557,249 580,336 621,463l225,643l250,0l-422,-1106z\"/>\n  <glyph unicode=\"w\" horiz-adv-x=\"1673\" d=\"M1075,0l-143,516C915,571 883,698 838,897l-9,0C790,717 760,589 737,514l-147,-514l-260,0l-310,1106l240,0l141,-545C433,426 456,311 469,215l6,0C482,264 492,320 506,383C519,446 531,493 541,524l168,582l258,0l163,-582C1140,491 1153,441 1168,374C1183,307 1191,254 1194,217l8,0C1212,299 1235,414 1272,561l143,545l236,0l-312,-1106z\"/>\n  <glyph unicode=\"x\" horiz-adv-x=\"1128\" d=\"M414,565l-371,541l268,0l252,-387l254,387l266,0l-372,-541l391,-565l-266,0l-273,414l-272,-414l-266,0z\"/>\n  <glyph unicode=\"y\" horiz-adv-x=\"1098\" d=\"M0,1106l256,0l225,-627C515,390 538,306 549,227l8,0C563,264 574,308 590,361C606,413 691,661 844,1106l254,0l-473,-1253C539,-377 396,-492 195,-492C143,-492 92,-486 43,-475l0,186C78,-297 119,-301 164,-301C277,-301 357,-235 403,-104l41,104z\"/>\n  <glyph unicode=\"z\" horiz-adv-x=\"979\" d=\"M907,0l-839,0l0,145l559,781l-525,0l0,180l789,0l0,-164l-547,-762l563,0z\"/>\n  <glyph unicode=\"~\" horiz-adv-x=\"1169\" d=\"M330,692C297,692 260,682 219,662C178,642 137,612 96,571l0,191C162,834 245,870 346,870C390,870 432,866 471,857C510,848 559,832 618,807C705,770 779,752 838,752C873,752 911,762 953,783C994,804 1034,833 1073,872l0,-190C1003,608 920,571 823,571C780,571 737,576 696,587C654,597 605,614 549,637C464,674 391,692 330,692z\"/>\n  <glyph unicode=\"&#xA0;\" horiz-adv-x=\"532\"/>\n  <glyph unicode=\"&#xA3;\" horiz-adv-x=\"1169\" d=\"M690,1481C819,1481 944,1454 1065,1399l-76,-182C881,1264 786,1288 705,1288C568,1288 500,1215 500,1069l0,-244l397,0l0,-172l-397,0l0,-182C500,410 489,359 467,316C445,273 407,237 354,207l756,0l0,-207l-1038,0l0,195C137,215 186,247 217,291C248,335 264,394 264,469l0,184l-188,0l0,172l188,0l0,256C264,1206 302,1304 378,1375C453,1446 557,1481 690,1481z\"/>\n  <glyph unicode=\"&#xA9;\" horiz-adv-x=\"1704\" d=\"M893,1034C819,1034 762,1007 722,954C682,900 662,826 662,731C662,633 680,558 716,505C752,452 811,426 893,426C930,426 969,431 1011,441C1053,451 1089,463 1120,477l0,-158C1043,285 965,268 885,268C754,268 652,308 580,389C507,469 471,583 471,731C471,874 508,986 581,1069C654,1151 756,1192 887,1192C979,1192 1070,1169 1161,1122l-65,-143C1025,1016 958,1034 893,1034M100,731C100,864 133,989 200,1106C267,1223 358,1315 475,1382C592,1449 717,1483 852,1483C985,1483 1110,1450 1227,1383C1344,1316 1436,1225 1503,1108C1570,991 1604,866 1604,731C1604,600 1572,476 1507,361C1442,246 1352,153 1235,84C1118,15 991,-20 852,-20C714,-20 587,15 470,84C353,153 263,245 198,360C133,475 100,599 100,731M223,731C223,618 251,513 308,416C364,319 441,242 538,186C635,130 740,102 852,102C965,102 1071,131 1168,188C1265,245 1342,321 1398,418C1453,514 1481,618 1481,731C1481,843 1453,948 1397,1046C1340,1143 1263,1220 1166,1276C1068,1332 963,1360 852,1360C740,1360 636,1332 540,1277C443,1222 366,1145 309,1048C252,951 223,845 223,731z\"/>\n  <glyph unicode=\"&#xAD;\" horiz-adv-x=\"659\" d=\"M72,449l0,200l514,0l0,-200z\"/>\n  <glyph unicode=\"&#xAE;\" horiz-adv-x=\"1704\" d=\"M748,770l69,0C866,770 904,782 929,805C954,828 967,862 967,905C967,953 955,987 931,1006C906,1025 868,1034 815,1034l-67,0M1157,909C1157,795 1106,717 1004,676l237,-397l-211,0l-192,346l-90,0l0,-346l-189,0l0,903l262,0C937,1182 1022,1159 1076,1114C1130,1069 1157,1000 1157,909M100,731C100,864 133,989 200,1106C267,1223 358,1315 475,1382C592,1449 717,1483 852,1483C985,1483 1110,1450 1227,1383C1344,1316 1436,1225 1503,1108C1570,991 1604,866 1604,731C1604,600 1572,476 1507,361C1442,246 1352,153 1235,84C1118,15 991,-20 852,-20C714,-20 587,15 470,84C353,153 263,245 198,360C133,475 100,599 100,731M223,731C223,618 251,513 308,416C364,319 441,242 538,186C635,130 740,102 852,102C965,102 1071,131 1168,188C1265,245 1342,321 1398,418C1453,514 1481,618 1481,731C1481,843 1453,948 1397,1046C1340,1143 1263,1220 1166,1276C1068,1332 963,1360 852,1360C740,1360 636,1332 540,1277C443,1222 366,1145 309,1048C252,951 223,845 223,731z\"/>\n  <glyph unicode=\"&#x2018;\" horiz-adv-x=\"395\" d=\"M37,961l-12,22C38,1038 62,1113 96,1207C130,1301 165,1386 201,1462l170,0C328,1291 295,1124 270,961z\"/>\n  <glyph unicode=\"&#x2019;\" horiz-adv-x=\"395\" d=\"M356,1462l15,-22C336,1301 277,1141 195,961l-170,0C71,1154 104,1321 125,1462z\"/>\n  <glyph unicode=\"&#x201C;\" horiz-adv-x=\"813\" d=\"M440,983C475,1118 535,1278 618,1462l170,0C742,1265 709,1098 688,961l-233,0M25,983C38,1038 62,1113 96,1207C130,1301 165,1386 201,1462l170,0C328,1291 295,1124 270,961l-233,0z\"/>\n  <glyph unicode=\"&#x201D;\" horiz-adv-x=\"813\" d=\"M371,1440C336,1301 277,1141 195,961l-170,0C71,1154 104,1321 125,1462l231,0M788,1440C753,1301 694,1141 612,961l-172,0C486,1142 520,1309 543,1462l231,0z\"/>\n  <glyph unicode=\"&#x2022;\" horiz-adv-x=\"770\" d=\"M131,748C131,840 153,910 197,958C241,1006 304,1030 385,1030C466,1030 528,1006 573,958C617,909 639,839 639,748C639,658 617,588 572,539C527,490 465,465 385,465C305,465 243,489 198,538C153,586 131,656 131,748z\"/>\n  <glyph unicode=\"&#x20AC;\" horiz-adv-x=\"1188\" d=\"M799,1278C705,1278 628,1250 569,1194C509,1138 469,1053 449,940l456,0l0,-154l-471,0l-2,-45l0,-55l2,-39l408,0l0,-153l-391,0C494,286 615,182 815,182C910,182 1008,203 1108,244l0,-203C1021,0 919,-20 803,-20C642,-20 512,24 412,112C311,200 246,327 215,494l-152,0l0,153l136,0l-2,37l0,37l2,65l-136,0l0,154l150,0C238,1107 302,1239 404,1334C506,1429 638,1477 799,1477C932,1477 1052,1448 1157,1389l-84,-187C970,1253 879,1278 799,1278z\"/>\n  <glyph unicode=\"&#x2122;\" horiz-adv-x=\"1561\" d=\"M375,741l-146,0l0,592l-202,0l0,129l553,0l0,-129l-205,0M963,741l-185,543l-6,0l4,-119l0,-424l-141,0l0,721l217,0l178,-534l187,534l210,0l0,-721l-147,0l0,414l4,129l-6,0l-193,-543z\"/>\n  <glyph unicode=\"I\" horiz-adv-x=\"625\" d=\"M193,0l0,1462l239,0l0,-1462z\"/>\n </font>\n")
  // diagram.to_defs(fs.readFileSync('../resources/background.svg'))
  diagram.to_defs("<g class=\"FCHBox\">\n  <g>\n    <path fill=\"#FFFFFF\" d=\"m160 50c0 1 -1 3 -2 3h-155c-1 0 -2 -1 -2 -2v-45c0 -1 1 -2 3 -2h155c1 0 3 1 3 3v45z\"/>\n    <path fill=\"#AAB2BD\" d=\"m160 0v50h-155v-45h155m0 -5h-155c-3 0 -5 2 -5 5v45c0 3 2 5 5 5h155c3 0 5 -2 5 -5v-45c0 -3 -2 -5 -5 -5l0 0z\"/>\n  </g>\n  <rect class=\"FCHBox-Text-bg\"  fill=\"none\" width=\"135\" height=\"32.7\"/>\n  <g class=\"FCHBox-Text\">\n    <text class=\"FCHBox-Text-title\" x=\"15\" y=\"21\" fill=\"#AAB2BD\" font-family=\"'OpenSans-Semibold'\" font-size=\"14\">Action Title</text>\n    <text class=\"FCHBox-Text-type\" x=\"15\" y=\"42\" fill=\"#AAB2BD\" font-family=\"'OpenSans-Semibold'\" font-size=\"14\">Type: Normal</text>\n  </g>\n</g>\n")
  diagram.to_defs("<pattern id=\"fch-line-pattern\" patternContentUnits=\"userSpaceOnUse\" patternUnits=\"userSpaceOnUse\" width=\"50\" height=\"50\" class=\"FCHLine-pattern\">\n  <circle fill=\"#AAB2BD\" r=\"2.5\"/>\n</pattern>\n")
  diagram.to_defs("<g class=\"FCHLine-arrow\">\n  <marker id=\"fch-endarrow\" overflow=\"visible\" orient=\"auto\" >\n   <polygon points=\"-5,-5 0,0 -5,5\" fill=\"#AAB2BD\"/>\n  </marker>\n</g>\n")
  diagram.to_defs("<g class=\"FCHLine-intersection Edge-intersection\">\n  <!--rect x=\"18\" y=\"17\" width=\"9\" height=\"11\" />\n  <line x1=\"45\" y1=\"28\" x2=\"30\" y2=\"28\"/>\n  <line x1=\"30\" y1=\"17\" x2=\"45\" y2=\"17\"/>\n  <line x1=\"15\" y1=\"28\"         y2=\"28\" />\n  <line         y1=\"17\" x2=\"15\" y2=\"17\"/>\n  <line x1=\"17\" y1=\"45\" x2=\"17\"/>\n  <line x1=\"28\" x2=\"28\" y2=\"45\"/-->\n<rect x=\"12\" y=\"10\" width=\"10\" height=\"13\"/>\n<line x1=\"34\" y1=\"23\" x2=\"23\" y2=\"23\" />\n\n<line x1=\"23\" y1=\"11\" x2=\"34\" y2=\"11\" />\n<line x1=\"11\" y1=\"23\"         y2=\"23\" />\n<line         y1=\"11\" x2=\"11\" y2=\"11\" />\n<line x1=\"11\" y1=\"34\"   x2=\"11\"         />\n<line x1=\"23\"           x2=\"23\" y2=\"34\" />\n\n\n</g>\n")
  diagram.to_defs("<g class=\"FCHLine\">\n  <line class=\"FCHLine-dots Edge\" />\n</g>\n")
  diagram.to_defs("<g class=\"FCHLine-witharrow\">\n  <line class=\"FCHLine-dots Edge\" />\n  <line class=\"FCHLine-endarrow Edge--end\" />\n</g>\n")
  diagram.display()


}()

},{"../index.js":11,"../util/dom.js":69,"../util/unique_id.js":70,"fs":71,"lorem-ipsum":61,"random-number":62}],68:[function(require,module,exports){
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

},{}],69:[function(require,module,exports){
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

},{}],70:[function(require,module,exports){
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

},{"random-token":63}],71:[function(require,module,exports){

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

},{}]},{},[67])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9hcnIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9kaWFncmFtLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vZWRnZXMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9pbnRlcnNlY3QuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9pdGVtLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vdHJhbnNsYXRlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vdmVjdG9ycy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ncmFwaC9lZGdlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL2dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL25vZGUuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvbGF5b3V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9vcmRlci9jcm9zc0NvdW50LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdExheWVyR3JhcGhzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdE9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvc29ydExheWVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcG9zaXRpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9hY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9jb25zdHJhaW50cy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvZmVhc2libGVUcmVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9pbml0UmFuay5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvcmFua1V0aWwuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rL3NpbXBsZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi91dGlsLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvdmVyc2lvbi5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9jcC1kYXRhL2xpYi9Qcmlvcml0eVF1ZXVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvU2V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvbGliL3ZlcnNpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9pbmRleC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9CYXNlR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2NvbXBvbmVudHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2RpamtzdHJhLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9kaWprc3RyYUFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmluZEN5Y2xlcy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmxveWRXYXJzaGFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvaXNBY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wb3N0b3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3ByZW9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wcmltLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy90YXJqYW4uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3RvcHNvcnQuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29tcG91bmRpZnkuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29udmVydGVyL2pzb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvZmlsdGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2dyYXBoLWNvbnZlcnRlcnMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi92ZXJzaW9uLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9lbnNsYXZlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9oeXBlcmdsdWUvYnJvd3Nlci5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvaHlwZXJnbHVlL25vZGVfbW9kdWxlcy9kb21pZnkvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2xvcmVtLWlwc3VtL2xpYi9kaWN0aW9uYXJ5LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9sb3JlbS1pcHN1bS9saWIvZ2VuZXJhdG9yLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9yYW5kb20tbnVtYmVyL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9yYW5kb20tdG9rZW4vaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL3ZpcmFsL3ZpcmFsLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3BhdGh3YXkuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvc2V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3Rlc3QvdGVzdC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC91dGlsL2RlZmF1bHRzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvZG9tLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvdW5pcXVlX2lkLmpzIiwiL3Vzci9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L2xpYi9fZW1wdHkuanMiLCIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0YkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG5cbiAgZnVuY3Rpb24gc2l6ZShhcnIpe1xuICAgIHJldHVybiBhcnIudmFsdWVzLmxlbmd0aFxuICB9XG5cbiAgZnVuY3Rpb24gY2xvbmUoYXJyKXtcbiAgICByZXR1cm4gQXJyLm1ha2UoYXJyKVxuICB9XG5cbiAgZnVuY3Rpb24gZm9yRWFjaChzZXQsIGZuKXtcbiAgICBzZXQudmFsdWVzLmZvckVhY2goZm4pXG4gIH1cblxuICBmdW5jdGlvbiByZWR1Y2Uoc2V0LCBmbiwgaW5pdCl7XG4gICAgaWYgKCBpbml0ICE9PSB1bmRlZmluZWQgKSB7XG4gICAgICByZXR1cm4gc2V0LnZhbHVlcy5yZWR1Y2UoZm4sIGluaXQpXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzZXQudmFsdWVzLnJlZHVjZShmbilcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtYXAoc2V0LCBmbil7XG4gICAgcmV0dXJuIHNldC52YWx1ZXMubWFwKGZuKVxuICB9XG5cbiAgZnVuY3Rpb24gc29tZShzZXQsIGZuKXtcbiAgICByZXR1cm4gc2V0LnZhbHVlcy5zb21lKGZuKVxuICB9XG5cbiAgZnVuY3Rpb24gaW5kZXhPZihzZXQsIHZhbHVlKXtcbiAgICByZXR1cm4gc2V0LnZhbHVlcy5pbmRleE9mKHZhbHVlKVxuICB9XG5cbiAgdmFyIEFyciA9IHZpcmFsLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oYXJyKXtcbiAgICAgIHRoaXMudmFsdWVzID0gYXJyICE9IG51bGwgPyBhcnIudmFsdWVzLnNsaWNlKDApIDogW11cbiAgICB9XG4gICwgZm9yRWFjaDogZW5zbGF2ZShmb3JFYWNoKVxuICAsIHJlZHVjZTogZW5zbGF2ZShyZWR1Y2UpXG4gICwgbWFwOiBlbnNsYXZlKG1hcClcbiAgLCBzb21lOiBlbnNsYXZlKHNvbWUpXG4gICwgc2l6ZTogZW5zbGF2ZShzaXplKVxuICAsIGNsb25lOiBlbnNsYXZlKGNsb25lKVxuICAsIGluZGV4T2Y6IGVuc2xhdmUoaW5kZXhPZilcbiAgfSlcblxuICBtb2R1bGUuZXhwb3J0cyA9IEFyclxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgLy8gdmFyIFNuYXAgPSByZXF1aXJlKCdzbmFwc3ZnJylcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuICB2YXIgZGFncmUgPSByZXF1aXJlKCdkYWdyZScpXG4gIHZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKVxuICB2YXIgaGdsdWUgPSByZXF1aXJlKCdoeXBlcmdsdWUnKVxuICB2YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuLi91dGlsL2RlZmF1bHRzLmpzJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIGRvbSA9IHJlcXVpcmUoJy4uL3V0aWwvZG9tLmpzJylcbiAgdmFyIGludGVyc2VjdCA9IHJlcXVpcmUoJy4vaW50ZXJzZWN0LmpzJylcbiAgdmFyIGZsb29yID0gTWF0aC5mbG9vclxuICB2YXIgY2VpbCA9IE1hdGguY2VpbFxuICB2YXIgbWluID0gTWF0aC5taW5cbiAgdmFyIG1heCA9IE1hdGgubWF4XG5cbiAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuL2l0ZW0uanMnKVxuICB2YXIgcHJpbnQgPSBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpXG5cbiAgZnVuY3Rpb24gZnJvbV9kZWZzKGRpYWdyYW0sIGNsYXNzbmFtZSl7XG4gICAgcmV0dXJuIGRpYWdyYW0uc3ZnZWwucGFyZW50KCkuc2VsZWN0KCdkZWZzIC4nICsgY2xhc3NuYW1lKVxuICB9XG5cbiAgZnVuY3Rpb24gdG9fZGVmcyhkaWFncmFtLCBzdmcpe1xuICAgIHZhciBwID0gZGlhZ3JhbS5zdmdlbC5wYXJlbnQoKVxuICAgIGlmICggdHlwZW9mIHN2ZyA9PSAnc3RyaW5nJyApIHtcbiAgICAgIHZhciBlbCA9IFNuYXAucGFyc2Uoc3ZnKS5zZWxlY3QoJyonKVxuICAgIH0gZWxzZSBpZiAoIEFycmF5LmlzQXJyYXkoc3ZnKSApIHtcbiAgICAgIHZhciBlbCA9IHAuZWwuYXBwbHkocC5lbCwgc3ZnKVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPOiByZXBsYWNlIHRoaXNcbiAgICAgIHByaW50KCdub3Qgc3VyZSBob3cgdG8gaGFuZGxlJylcbiAgICB9XG4gICAgcmV0dXJuIHAuc2VsZWN0KCdkZWZzJykuYXBwZW5kKGVsKVxuICB9XG5cbiAgZnVuY3Rpb24gZHJhdyhkaWFncmFtLCBlbCl7XG4gICAgdmFyIG5ld19lbCA9IGZyb21fZGVmcyhkaWFncmFtLCBlbC5jbGFzc25hbWUpLmNsb25lKClcbiAgICB2YXIgbm9kZSA9IGhnbHVlKG5ld19lbC5ub2RlLCBlbC5jb250ZW50KVxuICAgIGRpYWdyYW0uc3ZnZWwuYXBwZW5kKG5ld19lbClcbiAgICByZXR1cm4gbmV3X2VsXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfbGluZV9hdHRycyhpdGVtLCBsaW5lX2hlaWdodCwgeCl7XG4gICAgaXRlbS5nLnNlbGVjdEFsbCgndHNwYW4nKS5mb3JFYWNoKGZ1bmN0aW9uKHRzcGFuLCBpZHgpe1xuICAgICAgdHNwYW4uYXR0cih7IGR5OiBpZHggPyBsaW5lX2hlaWdodCA6IDAgLCB4OiB4IH0pXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc19jYWxjKHgsdyx5LGgpe1xuICAgIHJldHVybiBbeCArIHcgLyAyLCB5ICsgaCAvIDJdXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfdGV4dHdpZHRoKG5vZGUpe1xuICAgIHJldHVybiBub2RlLmdldENvbXB1dGVkVGV4dExlbmd0aCgpXG4gIH1cblxuICBmdW5jdGlvbiBpbnZpel9iYm94KGRpYWdyYW0sIGVsKXtcbiAgICB2YXIgY2xvbmUgPSBlbC5jbG9uZSgpLmF0dHIoKVxuICAgIGRpYWdyYW0uc3ZnZWwuYXBwZW5kKGNsb25lKVxuICAgIHZhciBiYm94ID0gY2xvbmUuZ2V0QkJveCgpXG4gICAgY2xvbmUucmVtb3ZlKClcbiAgICByZXR1cm4gYmJveFxuICB9XG5cbiAgZnVuY3Rpb24gcG9pbnRfdG9fc3RyaW5nKHApeyByZXR1cm4gcC54ICsgJywnICsgcC55IH1cblxuICBmdW5jdGlvbiBob3Jpem9udGFsKGxpbmUpe1xuICAgIHJldHVybiBsaW5lLmdldEF0dHJpYnV0ZSgneDEnKSA9PSBsaW5lLmdldEF0dHJpYnV0ZSgneDInKVxuICB9XG5cblxuICBmdW5jdGlvbiBkaXNwbGF5KGRpYWdyYW0pe1xuICAgIC8vIGFwcGx5IGhlaWdodCAvIHdpZHRoIG9uIG5vZGVzXG4gICAgdmFyIGluZ3JhcGggPSBkaWFncmFtLmluZ3JhcGhcbiAgICB2YXIgYmJveF9jYWNoZSA9IHt9XG4gICAgaW5ncmFwaC5lYWNoTm9kZShmdW5jdGlvbihpZCwgbm9kZSl7XG4gICAgICB2YXIgY2xhc3NuYW1lID0gbm9kZS5jbGFzc25hbWVcbiAgICAgIHZhciBiYm94ID0gYmJveF9jYWNoZVtjbGFzc25hbWVdIHx8IChiYm94X2NhY2hlW2NsYXNzbmFtZV0gPSBpbnZpel9iYm94KGRpYWdyYW0sIGZyb21fZGVmcyhkaWFncmFtLCBjbGFzc25hbWUpKSlcbiAgICAgIG5vZGUuYXR0cigneCcsIGJib3gueClcbiAgICAgIG5vZGUuYXR0cigneScsIGJib3gueSlcbiAgICAgIG5vZGUuYXR0cignd2lkdGgnLCBiYm94LndpZHRoKVxuICAgICAgbm9kZS5hdHRyKCdoZWlnaHQnLCBiYm94LmhlaWdodClcbiAgICB9KVxuXG4gICAgdmFyIGxheW91dCA9IGRpYWdyYW0ubGF5b3V0XG4gICAgdmFyIGdjZmcgPSBkaWFncmFtLmdyYXBoLmNvbmZpZ1xuICAgIGlmICggZ2NmZyApIHtcbiAgICAgIE9iamVjdC5rZXlzKGdjZmcpLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKXtcbiAgICAgICAgbGF5b3V0ID0gbGF5b3V0W21ldGhvZF0oZ2NmZ1ttZXRob2RdKVxuICAgICAgfSlcbiAgICB9XG4gICAgbGF5b3V0LnJhbmtTaW1wbGV4ID0gdHJ1ZVxuICAgIC8vIGNhbGN1bGF0ZSBub2RlcyBsYXlvdXRcbiAgICBsYXlvdXQgPSBsYXlvdXQucnVuKGluZ3JhcGgpXG5cbiAgICB2YXIgZ3JhcGggPSBkaWFncmFtLm91dGdyYXBoID0gbGF5b3V0LmdyYXBoKClcblxuICAgIC8vIGRpc3BsYXkgbm9kZXNcbiAgICBsYXlvdXQuZWFjaE5vZGUoZnVuY3Rpb24oaWQsIHZhbHVlcyl7XG4gICAgICB2YXIgbm9kZSA9IGRpYWdyYW0uaW5ncmFwaC5ub2RlKGlkKVxuICAgICAgbm9kZS50cmFuc2Zvcm0odmFsdWVzKVxuICAgICAgZHJhdyhkaWFncmFtLCBub2RlKVxuICAgIH0pXG5cblxuICAgIC8vIGNhbGN1bGF0ZSBlZGdlcyBsYXlvdXRcbiAgICB2YXIgbGFuZXMgPSByZXF1aXJlKCcuL2VkZ2VzLmpzJykobGF5b3V0LCBkaWFncmFtKVxuICAgIHZhciBzZWdtZW50cyA9IFtdXG5cbiAgICB2YXIgZHJhd19ib3VuZCA9IGRyYXcuYmluZChudWxsLCBkaWFncmFtKVxuXG4gICAgbGFuZXMuZm9yRWFjaChmdW5jdGlvbihsYW5lKXtcbiAgICAgIGxhbmUuZm9yRWFjaChmdW5jdGlvbihwdyl7XG4gICAgICAgIHZhciBzdGFydCA9IHB3WzBdXG4gICAgICAgIHZhciBlbmQgPSBwd1twdy5sZW5ndGggLSAxXVxuICAgICAgICAvLyBkcmF3IHBhdGhcbiAgICAgICAgdmFyIHBhdGhfc2VnbWVudCA9IHtpZDogdWlkKCksIHgxOiBzdGFydC54LCB5MTpzdGFydC55LCB4MjogZW5kLngsIHkyOiBlbmQueX1cbiAgICAgICAgZHJhd19ib3VuZCh7XG4gICAgICAgICAgY2xhc3NuYW1lOiBkaWFncmFtLmNvbmZpZy5lZGdlQ2xhc3NcbiAgICAgICAgLCBjb250ZW50OiB7Jy5FZGdlOmZpcnN0JzogcGF0aF9zZWdtZW50fVxuICAgICAgICB9KVxuICAgICAgICBzZWdtZW50cy5wdXNoKHBhdGhfc2VnbWVudClcblxuICAgICAgICAvLyBkcmF3IHRoZSBqdW5jdGlvbnNcbiAgICAgICAgdmFyIGp1bmN0aW9ucyA9IHB3LmZpbHRlcihmdW5jdGlvbihwKXtyZXR1cm4gcC5ub2RlICYmICEgcC5lbnRyeSB9KVxuICAgICAgICBkcmF3X2JvdW5kKHtcbiAgICAgICAgICBjbGFzc25hbWU6IGRpYWdyYW0uY29uZmlnLmVkZ2VDbGFzc1xuICAgICAgICAsIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICcuRWRnZSc6IGp1bmN0aW9ucy5tYXAoZnVuY3Rpb24ocCl7XG4gICAgICAgICAgICAgIHZhciBqX3NlZ21lbnQgPSB7aWQ6IHVpZCgpLCB4MTogcC54LCB5MTpwLnksIHgyOiBwLm5vZGUueCwgeTI6IHAubm9kZS55fVxuICAgICAgICAgICAgICBzZWdtZW50cy5wdXNoKGpfc2VnbWVudClcbiAgICAgICAgICAgICAgcmV0dXJuIHsgJzpmaXJzdCc6IGpfc2VnbWVudH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIHZhciBlbnRyaWVzID0gcHcuZmlsdGVyKGZ1bmN0aW9uKHApe3JldHVybiAhISBwLmVudHJ5IH0pXG4gICAgICAgIGRyYXdfYm91bmQoe1xuICAgICAgICAgIGNsYXNzbmFtZTogZGlhZ3JhbS5jb25maWcuZWRnZUVuZENsYXNzXG4gICAgICAgICwgY29udGVudDoge1xuICAgICAgICAgICAgJy5FZGdlJzogZW50cmllcy5tYXAoZnVuY3Rpb24ocCl7XG4gICAgICAgICAgICAgIHZhciBqX3NlZ21lbnQgPSB7aWQ6IHVpZCgpLCB4MTogcC54LCB5MTpwLnksIHgyOiBwLmN1dC54LCB5MjogcC5jdXQueX1cbiAgICAgICAgICAgICAgc2VnbWVudHMucHVzaChqX3NlZ21lbnQpXG4gICAgICAgICAgICAgIHJldHVybiB7JzpmaXJzdCc6IGpfc2VnbWVudH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgLCAnLkVkZ2UtLWVuZCc6IGVudHJpZXMubWFwKGZ1bmN0aW9uKHApe1xuICAgICAgICAgICAgICB2YXIgal9zZWdtZW50ID0ge2lkOiB1aWQoKSwgeDE6IHAuY3V0LngsIHkxOnAuY3V0LnksIHgyOiBwLm5vZGUueCwgeTI6IHAubm9kZS55fVxuICAgICAgICAgICAgICBzZWdtZW50cy5wdXNoKGpfc2VnbWVudClcbiAgICAgICAgICAgICAgcmV0dXJuIHsnOmZpcnN0Jzogal9zZWdtZW50fVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgIH0pXG4gICAgfSlcblxuICAgIC8vIGRyYXcgdGhlIHNraXBzXG4gICAgZHJhd19ib3VuZCh7XG4gICAgICBjbGFzc25hbWU6IGRpYWdyYW0uY29uZmlnLmVkZ2VDbGFzc1xuICAgICwgY29udGVudDogeycuRWRnZSc6IGxhbmVzLnNraXBzLm1hcChmdW5jdGlvbihwKXtcbiAgICAgICAgdmFyIHNraXBfc2VnbWVudCA9IHtpZDogdWlkKCksIHgxOiBwWzBdLngsIHkxOnBbMF0ueSwgeDI6IHBbMV0ueCwgeTI6IHBbMV0ueX1cbiAgICAgICAgc2VnbWVudHMucHVzaChza2lwX3NlZ21lbnQpXG4gICAgICAgIHJldHVybiB7ICc6Zmlyc3QnOiBza2lwX3NlZ21lbnQgfVxuICAgICAgfSl9XG4gICAgfSlcblxuICAgIHZhciBpbnRlcnNlY3Rpb25fc2l6ZSA9IGludml6X2Jib3goZGlhZ3JhbSwgZnJvbV9kZWZzKGRpYWdyYW0sIGRpYWdyYW0uY29uZmlnLmludGVyc2VjdGlvbkNsYXNzKSlcbiAgICB2YXIgaW50ZXJzZWN0aW9uX21pZGRsZSA9IFtpbnRlcnNlY3Rpb25fc2l6ZS53aWR0aCAvIDIsIGludGVyc2VjdGlvbl9zaXplLmhlaWdodCAvIDJdXG4gICAgc2VnbWVudHMuZm9yRWFjaChmdW5jdGlvbihzZWcxLCBpZDEpe1xuICAgICAgc2VnbWVudHMuZm9yRWFjaChmdW5jdGlvbihzZWcyLCBpZDIpe1xuICAgICAgICBpZiAoIGlkMiA+IGlkMSAmJiBzZWcxLngxICE9IHNlZzIueDEgJiYgIHNlZzEueDIgIT0gc2VnMi54MiAmJiBzZWcxLnkxICE9IHNlZzIueTEgJiYgIHNlZzEueTIgIT0gc2VnMi55MiApIHtcbiAgICAgICAgICB2YXIgaXNjdCA9IGludGVyc2VjdChzZWcxLCBzZWcyKVxuICAgICAgICAgIGlmICggaXNjdCApIHtcbiAgICAgICAgICAgIHZhciBzZWcxbm9kZSA9IGRvbS4kaWQoc2VnMS5pZClcbiAgICAgICAgICAgIHZhciBzZWcybm9kZSA9IGRvbS4kaWQoc2VnMi5pZClcbiAgICAgICAgICAgIHZhciB0b3Bub2RlID0gc2VnMW5vZGUuY29tcGFyZURvY3VtZW50UG9zaXRpb24oc2VnMm5vZGUpICYgNCA/IHNlZzFub2RlIDogc2VnMm5vZGVcbiAgICAgICAgICAgIHZhciBpbnRlcnNlY3Rfbm9kZSA9IGRyYXcoZGlhZ3JhbSwgeyBjbGFzc25hbWU6IGRpYWdyYW0uY29uZmlnLmludGVyc2VjdGlvbkNsYXNzICwgY29udGVudDoge30gfSlcbiAgICAgICAgICAgIGlmICggaG9yaXpvbnRhbCh0b3Bub2RlKSApIHtcbiAgICAgICAgICAgICAgaW50ZXJzZWN0X25vZGUudHJhbnNmb3JtKChuZXcgU25hcC5NYXRyaXgoMSwgMCwgMCwgMSwgMCAsIDApKS5yb3RhdGUoOTAsIGlzY3RbMF0gLCBpc2N0WzFdICkudG9UcmFuc2Zvcm1TdHJpbmcoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNmb3JtKGludGVyc2VjdF9ub2RlLm1hdHJpeC50cmFuc2xhdGUoaXNjdFswXSAtIGludGVyc2VjdGlvbl9taWRkbGVbMF0sIGlzY3RbMV0gLSBpbnRlcnNlY3Rpb25fbWlkZGxlWzFdKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGludGVyc2VjdF9ub2RlLnRyYW5zZm9ybShuZXcgU25hcC5NYXRyaXgoMSwgMCwgMCwgMSwgaXNjdFswXSAtIGludGVyc2VjdGlvbl9taWRkbGVbMF0sIGlzY3RbMV0gLSBpbnRlcnNlY3Rpb25fbWlkZGxlWzFdKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZG9tLmluc2VydEFmdGVyKHRvcG5vZGUucGFyZW50Tm9kZSwgaW50ZXJzZWN0X25vZGUubm9kZSwgdG9wbm9kZS5uZXh0U2libGluZylcblxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgdmFyIG1vdmUgPSBkaWFncmFtLnN2Z2VsLm1hdHJpeC5jbG9uZSgpXG4gICAgaWYgKCBncmFwaC5yYW5rRGlyID09IFwiTFJcIiB8fCBncmFwaC5yYW5rRGlyID09IFwiUkxcIiApIHtcbiAgICAgIGdyYXBoLmhlaWdodCA9IGdyYXBoLmhlaWdodCArIGxhbmVzLmdyb3d0aCAqIDJcbiAgICAgIHZhciBtb3ZlID0gbW92ZS50cmFuc2xhdGUoMCwgbGFuZXMuZ3Jvd3RoKVxuICAgIH0gZWxzZSB7XG4gICAgICBncmFwaC53aWR0aCA9IGdyYXBoLndpZHRoICsgbGFuZXMuZ3Jvd3RoICogMlxuICAgICAgdmFyIG1vdmUgPSBtb3ZlLnRyYW5zbGF0ZShsYW5lcy5ncm93dGgsIDApXG4gICAgfVxuXG4gICAgZGlhZ3JhbS5zdmdlbC5hdHRyKHsgd2lkdGg6IGdyYXBoLndpZHRoLCBoZWlnaHQ6IGdyYXBoLmhlaWdodCB9KS50cmFuc2Zvcm0obW92ZS50b1RyYW5zZm9ybVN0cmluZygpKVxuICAgIGRpYWdyYW0uc3ZnZWwucGFyZW50KCkuYXR0cih7XG4gICAgICB3aWR0aDogZ3JhcGgud2lkdGggKyBkaWFncmFtLmNvbmZpZy5lZGdlV2lkdGggKyBkaWFncmFtLmNvbmZpZy5wYWRkaW5nXG4gICAgLCBoZWlnaHQ6IGdyYXBoLmhlaWdodCArIGRpYWdyYW0uY29uZmlnLmVkZ2VXaWR0aCArIGRpYWdyYW0uY29uZmlnLnBhZGRpbmdcbiAgICB9KVxuICAgIHJldHVybiBsYXlvdXRcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gdmlyYWwuZXh0ZW5kKG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKS5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGNvbmZpZywgZ3JhcGgpe1xuICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgIHRoaXMuaXRlbXMgPSB7fVxuICAgICAgdGhpcy5jb25uZWN0b3JzID0ge31cbiAgICAgIHRoaXMuZ3JhcGggPSBncmFwaFxuICAgICAgdGhpcy5pbmdyYXBoID0gZ3JhcGguaW5ncmFwaFxuICAgICAgdGhpcy5sYXlvdXQgPSBkYWdyZS5sYXlvdXQoKVxuICAgICAgdGhpcy5zdmdlbCA9IFNuYXAuYXBwbHkoU25hcCwgY29uZmlnLnNuYXBfYXJncykuZygpLmF0dHIoeyB0cmFuc2Zvcm06IFwidHJhbnNsYXRlKDIwLDIwKVwiLCBpZDp1aWQoKX0pXG4gICAgfVxuICAsIGRpc3BsYXk6IGVuc2xhdmUoZGlzcGxheSlcbiAgLCBkcmF3OiBlbnNsYXZlKGRyYXcpXG4gICwgdG9fZGVmczogZW5zbGF2ZSh0b19kZWZzKVxuXG4vLyAgLCBhZGRJdGVtOiBlbnNsYXZlKGFkZF9pdGVtKVxuLy8gICwgZGVsSXRlbTogZW5zbGF2ZShyZW1vdmVfaXRlbSlcbi8vXG4vLyAgLCBjb25uZWN0OiBlbnNsYXZlKGFkZF9jb25uZWN0b3IpXG4vLyAgLCBkaXNjb25uZWN0OiBlbnNsYXZlKHJlbW92ZV9jb25uZWN0b3IpXG4vL1xuLy9cbi8vICAsIHNlbGVjdEl0ZW1zOiBlbnNsYXZlKGZpbHRlcl9pdGVtcylcbi8vICAsIHNlbGVjdENvbm5lY3RvcnM6IGVuc2xhdmUoZmlsdGVyX2l0ZW1zKVxuXG4gIH0pXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICB2YXIgU2V0ID0gcmVxdWlyZSgnLi4vc2V0LmpzJylcbiAgdmFyIFBhdGh3YXlzID0gcmVxdWlyZSgnLi4vcGF0aHdheS5qcycpXG5cbiAgdmFyIHRyYW5zbGF0ZSA9IHJlcXVpcmUoJy4vdHJhbnNsYXRlLmpzJylcbiAgdmFyIFYgPSByZXF1aXJlKCcuL3ZlY3RvcnMuanMnKVxuXG4gIGZ1bmN0aW9uIHBvaW50KHgsIHkpe1xuICAgIHJldHVybiB7IHg6IHggfHwgMCwgeTogeSB8fCAwIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNpZGVfZnJvbV9kaXJlY3Rpb24obm9kZSwgZCl7XG4gICAgdmFyIGMgPSBwb2ludChub2RlLngsIG5vZGUueSlcbiAgICB2YXIgdyA9IG5vZGUud2lkdGggLyAyXG4gICAgdmFyIGggPSBub2RlLmhlaWdodCAvIDJcbiAgICB2YXIgdGwgPSB0cmFuc2xhdGUoWy13LCAtaF0sIGMpXG4gICAgdmFyIHRyID0gdHJhbnNsYXRlKFt3LCAtaF0sIGMpXG4gICAgdmFyIGJsID0gdHJhbnNsYXRlKFstdywgaF0sIGMpXG4gICAgdmFyIGJyID0gdHJhbnNsYXRlKFt3LCBoXSwgYylcbiAgICBzd2l0Y2ggKCBkICkge1xuICAgICAgY2FzZSAnTCcgOlxuICAgICAgICByZXR1cm4gW3RsLCBibF1cbiAgICAgIGNhc2UgJ1InIDpcbiAgICAgICAgcmV0dXJuIFt0ciwgYnJdXG4gICAgICBjYXNlICdCJyA6XG4gICAgICAgIHJldHVybiBbYmwsIGJyXVxuICAgICAgY2FzZSAnVCcgOlxuICAgICAgICByZXR1cm4gW3RsLCB0cl1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkaXZpZGVfc2lkZShzaWRlLCBuKXtcbiAgICB2YXIgWDEgPSBzaWRlWzBdLnhcbiAgICB2YXIgWTEgPSBzaWRlWzBdLnlcbiAgICB2YXIgWDIgPSBzaWRlWzFdLnhcbiAgICB2YXIgWTIgPSBzaWRlWzFdLnlcblxuICAgIHZhciBXID0gWDIgLSBYMVxuICAgIHZhciBIID0gWTIgLSBZMVxuICAgIHZhciBwb2ludHMgPSBbXVxuICAgIHZhciBydyA9IFcgLyBuXG4gICAgdmFyIHJoID0gSCAvIG5cbiAgICB3aGlsZSAoIC0tbiA+IDAgKSB7XG4gICAgICBwb2ludHMucHVzaCh0cmFuc2xhdGUoWyBuICogcncsIG4gKiByaCBdLCBzaWRlWzBdKSlcbiAgICB9XG4gICAgcG9pbnRzLnJldmVyc2UoKVxuICAgIHJldHVybiBwb2ludHNcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9yYW5rX2RpbShtYXJnaW4sIGtleSwgbm9kZSl7XG4gICAgcmV0dXJuIE1hdGguY2VpbChub2RlW2tleV0gLyBtYXJnaW4pICogbWFyZ2luXG4gIH1cblxuICBmdW5jdGlvbiBudW1fY29tcChhLCBiKXtcbiAgICByZXR1cm4gYSA+IGIgPyAgMVxuICAgICAgICAgOiBhIDwgYiA/IC0xXG4gICAgICAgICA6ICAgICAgICAgIDBcbiAgfVxuXG4gIGZ1bmN0aW9uIHNvcnRfbm9kZXNfaW5fcmFuayhkaXIsIGEsIGIpe1xuICAgIHN3aXRjaCAoIGRpciApIHtcbiAgICAgIGNhc2UgJ1RCJzpcbiAgICAgICAgcmV0dXJuIGEueCA8IGIueCA/IC0xXG4gICAgICAgICAgICAgOiBhLnggPiBiLnggPyAgMVxuICAgICAgICAgICAgIDogICAgICAgICAgICAgIDBcbiAgICAgIGNhc2UgJ0JUJzpcbiAgICAgICAgcmV0dXJuIGEueCA+IGIueCA/IC0xXG4gICAgICAgICAgICAgOiBhLnggPCBiLnggPyAgMVxuICAgICAgICAgICAgIDogICAgICAgICAgICAgIDBcbiAgICAgIGNhc2UgJ0xSJzpcbiAgICAgICAgcmV0dXJuIGEueSA8IGIueSA/IC0xXG4gICAgICAgICAgICAgOiBhLnkgPiBiLnkgPyAgMVxuICAgICAgICAgICAgIDogICAgICAgICAgICAgIDBcbiAgICAgIGNhc2UgJ1JMJzpcbiAgICAgICAgcmV0dXJuIGEueSA+IGIueSA/IC0xXG4gICAgICAgICAgICAgOiBhLnkgPCBiLnkgPyAgMVxuICAgICAgICAgICAgIDogICAgICAgICAgICAgIDBcbiAgICB9XG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvdW50X2V4aXRzKHBhdGh3YXlzLCBzb3VyY2VfaWQpe1xuICAgIHZhciBjb3VudCA9IDAsIGZpbmRzID0gW11cblxuICAgIHBhdGh3YXlzLmZvckVhY2goZnVuY3Rpb24ocCwgcGkpe1xuICAgICAgcC5mb3JFYWNoKGZ1bmN0aW9uKHcsIHdpKXtcbiAgICAgICAgaWYgKCB3LnNvdXJjZXMuaGFzKHNvdXJjZV9pZCkgKSB7XG4gICAgICAgICAgZmluZHMucHVzaChbcGksIHdpLCB3XSlcbiAgICAgICAgICBjb3VudCsrXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgICByZXR1cm4gY291bnRcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3V0Z3JhcGgsIGRpYWdyYW0pe1xuICAgIHZhciBnID0gb3V0Z3JhcGguZ3JhcGgoKVxuICAgIHZhciByYW5rRGlyID0gZy5yYW5rRGlyXG4gICAgdmFyIHZlcnRpY2FsID0gcmFua0RpciA9PSAnVEInIHx8IHJhbmtEaXIgPT0gJ0JUJ1xuICAgIHZhciByZXZlcnNlZCA9IHJhbmtEaXIgPT0gJ0JUJyB8fCByYW5rRGlyID09ICdSTCdcbiAgICB2YXIgcmFua1NlcCA9IGRpYWdyYW0uZ3JhcGguY29uZmlnLnJhbmtTZXBcbiAgICB2YXIgcmFua19zb3J0ZXIgPSBzb3J0X25vZGVzX2luX3JhbmsuYmluZChudWxsLCByYW5rRGlyKVxuICAgIHZhciBsZXZlbF9kaXIgPSB2ZXJ0aWNhbCA/ICd3aWR0aCcgOiAnaGVpZ2h0J1xuICAgIHZhciByYW5rc19wb3NpdGlvbnMgPSBbXVxuICAgIHZhciByYW5rcyA9IFtdXG4gICAgdmFyIG5vcm1fcmFua19kaW0gPSBnZXRfcmFua19kaW0uYmluZChudWxsLCBkaWFncmFtLmNvbmZpZy5yYW5rX2RldGVjdGlvbl9lcnJvcl9tYXJnaW4sIHZlcnRpY2FsID8gJ3knIDogJ3gnIClcblxuICAgIGZ1bmN0aW9uIGdldF9qdW5jdGlvbihwYXRoLCBsZXZlbCl7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiB2ZXJ0aWNhbCA/IGxldmVsIDogcGF0aFxuICAgICAgLCB5OiB2ZXJ0aWNhbCA/IHBhdGggOiBsZXZlbFxuICAgICAgfVxuICAgIH1cblxuICAgIG91dGdyYXBoLmVhY2hOb2RlKGZ1bmN0aW9uKGlkLCBub2RlKXtcbiAgICAgIHZhciByZGltID0gbm9ybV9yYW5rX2RpbShub2RlKVxuICAgICAgaWYgKCByYW5rc19wb3NpdGlvbnMuaW5kZXhPZihyZGltKSA9PSAtMSApIHtcbiAgICAgICAgcmFua3NfcG9zaXRpb25zLnB1c2gocmRpbSlcbiAgICAgICAgcmFua3NfcG9zaXRpb25zLnNvcnQobnVtX2NvbXApXG4gICAgICB9XG4gICAgICBub2RlLnJkaW0gPSByZGltXG4gICAgfSlcbiAgICBpZiAoIHJldmVyc2VkICkge1xuICAgICAgcmFua3NfcG9zaXRpb25zLnJldmVyc2UoKVxuICAgIH1cbiAgICBvdXRncmFwaC5lYWNoTm9kZShmdW5jdGlvbihpZCwgbm9kZSl7XG4gICAgICB2YXIgciA9IHJhbmtzX3Bvc2l0aW9ucy5pbmRleE9mKG5vZGUucmRpbSlcbiAgICAgIG5vZGUudHJ1ZV9yYW5rID0gclxuICAgICAgaWYgKCByYW5rc1tyXSA9PSBudWxsICkgcmFua3Nbcl0gPSBbXVxuICAgICAgcmFua3Nbcl0ucHVzaChub2RlKVxuICAgIH0pXG5cbiAgICByYW5rcy5mb3JFYWNoKGZ1bmN0aW9uKHIsIGkpe1xuICAgICAgcmFua3NbaV0uc29ydChyYW5rX3NvcnRlcilcbiAgICB9KVxuXG4gICAgdmFyIGVkZ2VzX2luX3JhbmtzID0gW11cbiAgICB2YXIgcGF0aHdheV9jb3VudCA9IHJhbmtzLmxlbmd0aCArIDFcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBwYXRod2F5X2NvdW50OyBpKysgKSB7XG4gICAgICBlZGdlc19pbl9yYW5rc1tpXSA9IFNldC5tYWtlKClcbiAgICB9XG5cbiAgICBvdXRncmFwaC5lYWNoTm9kZShmdW5jdGlvbihpZCwgbm9kZSl7XG5cbiAgICAgIHZhciBub2RlX3JhbmsgPSBub2RlLnRydWVfcmFua1xuICAgICAgb3V0Z3JhcGgub3V0RWRnZXMoaWQpLmZvckVhY2goZnVuY3Rpb24ob3V0X2VkZ2VfaWQpe1xuICAgICAgICBlZGdlc19pbl9yYW5rc1tub2RlX3JhbmsgKyAxXS5hZGQob3V0X2VkZ2VfaWQpXG4gICAgICB9KVxuXG4gICAgfSlcblxuICAgIHZhciBsYW5lcyA9IFtdXG4gICAgZWRnZXNfaW5fcmFua3MuZm9yRWFjaChmdW5jdGlvbihyYW5rLCBpZHgpe1xuICAgICAgbGFuZXNbaWR4XSA9IFBhdGh3YXlzLm1ha2UoKVxuICAgICAgcmFuay5mb3JFYWNoKGZ1bmN0aW9uKGVkZ2VfaWQpe1xuICAgICAgICBsYW5lc1tpZHhdLmFkZCggb3V0Z3JhcGguc291cmNlKGVkZ2VfaWQpXG4gICAgICAgICAgICAgICAgICAgICwgZWRnZV9pZFxuICAgICAgICAgICAgICAgICAgICAsIG91dGdyYXBoLnRhcmdldChlZGdlX2lkKSlcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIG91dGdyYXBoLmVhY2hOb2RlKGZ1bmN0aW9uKGlkLCBub2RlKXtcbiAgICAgIHZhciBleGl0cyA9IGRpdmlkZV9zaWRlKHNpZGVfZnJvbV9kaXJlY3Rpb24obm9kZSwgcmFua0RpclsxXSksIGNvdW50X2V4aXRzKGxhbmVzLCBpZCkgKyAxKVxuICAgICAgbm9kZS5leGl0cyA9IGV4aXRzXG4gICAgICBub2RlLmVudHJpZXMgPSBkaXZpZGVfc2lkZShzaWRlX2Zyb21fZGlyZWN0aW9uKG5vZGUsIHJhbmtEaXJbMF0pLCAyKVxuICAgIH0pXG5cbiAgICB2YXIgZnNraXBzID0gW11cbiAgICB2YXIgYnNraXBzID0gW11cbiAgICB2YXIgZWRnZXMgPSBbXVxuICAgIHZhciBza2lwc2VwID0gZGlhZ3JhbS5jb25maWcuZWRnZVdpZHRoXG4gICAgbGFuZXMuZm9yRWFjaChmdW5jdGlvbihsYW5lLCByYW5rX25yKXtcbiAgICAgIHZhciBwd3MgID0gW11cbiAgICAgIHZhciBwYXRod2F5c19jb3VudCA9IGxhbmUuc2l6ZSgpXG4gICAgICB2YXIgcHNlcCA9IHJhbmtTZXAgLyAocGF0aHdheXNfY291bnQgKyAxKVxuICAgICAgbGFuZS5mb3JFYWNoKGZ1bmN0aW9uKHBhdGh3YXksIHB3X2lkeCl7XG4gICAgICAgIHZhciB0ciA9IHBzZXAgKiAocHdfaWR4ICsgMSlcbiAgICAgICAgaWYgKCByZXZlcnNlZCApIHRyICA9IHRyICogLTFcbiAgICAgICAgdmFyIHRyX2V4aXQgPSB0cmFuc2xhdGUuYmluZChudWxsLCB2ZXJ0aWNhbCA/IFswLCB0cl0gOiBbdHIsIDBdKVxuICAgICAgICB2YXIgdHJfZW50cnkgPSB0cmFuc2xhdGUuYmluZChudWxsLCB2ZXJ0aWNhbCA/IFswLCB0ciAtIChyZXZlcnNlZCA/IC0xICogcmFua1NlcCA6IHJhbmtTZXApXSA6IFt0ciAtIChyZXZlcnNlZCA/IC0xICogcmFua1NlcCA6IHJhbmtTZXApLCAwXSlcbiAgICAgICAgdmFyIHB3ID0gW11cbiAgICAgICAgcGF0aHdheS5zb3VyY2VzLmZvckVhY2goZnVuY3Rpb24oc291cmNlX2lkKXtcbiAgICAgICAgICB2YXIgc291cmNlID0gb3V0Z3JhcGgubm9kZShzb3VyY2VfaWQpXG4gICAgICAgICAgaWYgKCBzb3VyY2UudHJ1ZV9yYW5rID09IHJhbmtfbnIgLSAxICkge1xuICAgICAgICAgICAgc291cmNlLnNwd2kgPSBwd19pZHhcbiAgICAgICAgICAgIHZhciBqdW5jdGlvbnMgPSBzb3VyY2UuZXhpdHMubWFwKGZ1bmN0aW9uKGV4aXQsIGlkeCl7XG4gICAgICAgICAgICAgIHZhciBwID0gdHJfZXhpdChleGl0KVxuICAgICAgICAgICAgICBwLm5vZGUgPSBleGl0XG4gICAgICAgICAgICAgIHNvdXJjZS5leGl0c1tpZHhdLmp1bmN0aW9uID0gcFxuICAgICAgICAgICAgICByZXR1cm4gcFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHB3ID0gcHcuY29uY2F0KGp1bmN0aW9ucylcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIHBhdGh3YXkudGFyZ2V0cy5mb3JFYWNoKGZ1bmN0aW9uKHRhcmdldF9pZCl7XG4gICAgICAgICAgdmFyIHRhcmdldCA9IG91dGdyYXBoLm5vZGUodGFyZ2V0X2lkKVxuICAgICAgICAgIGlmICggdGFyZ2V0LnRydWVfcmFuayA9PSByYW5rX25yICkge1xuICAgICAgICAgICAgdGFyZ2V0LnRwd2kgPSBwd19pZHhcbiAgICAgICAgICAgIHZhciBqdW5jdGlvbnMgPSB0YXJnZXQuZW50cmllcy5tYXAoZnVuY3Rpb24oZW50cnksIGlkeCl7XG4gICAgICAgICAgICAgIHZhciBwID0gdHJfZW50cnkoZW50cnkpXG4gICAgICAgICAgICAgIHZhciB2ZWN0b3IgPSBbZW50cnkueCAtIHAueCwgZW50cnkueSAtIHAueV1cbiAgICAgICAgICAgICAgdmFyIHMgPSBWLnNjYWxlKHZlY3RvciwgLTEuMiAqIGRpYWdyYW0uY29uZmlnLmVkZ2VXaWR0aCAvIFYubWFnbml0dWRlKHZlY3RvcikpXG4gICAgICAgICAgICAgIHAuY3V0ID0gdHJhbnNsYXRlKHMsIGVudHJ5KVxuICAgICAgICAgICAgICBwLm5vZGUgPSBlbnRyeVxuICAgICAgICAgICAgICBwLmVudHJ5ID0gdHJ1ZVxuICAgICAgICAgICAgICB0YXJnZXQuZW50cmllc1tpZHhdLmp1bmN0aW9uID0gcFxuICAgICAgICAgICAgICByZXR1cm4gcFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHB3ID0gcHcuY29uY2F0KGp1bmN0aW9ucylcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIHB3c1twd19pZHhdID0gcHdcbiAgICAgIH0pXG4gICAgICBlZGdlc1tyYW5rX25yXSA9IHB3c1xuICAgIH0pXG5cbiAgICBlZGdlcy5za2lwcyA9IFtdXG4gICAgbGFuZXMuZm9yRWFjaChmdW5jdGlvbihsYW5lLCByYW5rX25yKXtcbiAgICAgIGxhbmUuZm9yRWFjaChmdW5jdGlvbihwYXRod2F5LCBwd19pZHgpe1xuICAgICAgICBwYXRod2F5LmVkZ2VzLmZvckVhY2goZnVuY3Rpb24oZWRnZV9pZCl7XG4gICAgICAgICAgdmFyIHRpZCA9IG91dGdyYXBoLnRhcmdldChlZGdlX2lkKVxuICAgICAgICAgIHZhciB0YXJnZXQgPSBvdXRncmFwaC5ub2RlKHRpZClcbiAgICAgICAgICB2YXIgdGFyZ2V0X3JhbmsgPSB0YXJnZXQudHJ1ZV9yYW5rXG4gICAgICAgICAgdmFyIHNpZCA9IG91dGdyYXBoLnNvdXJjZShlZGdlX2lkKVxuICAgICAgICAgIHZhciBzb3VyY2UgPSBvdXRncmFwaC5ub2RlKHNpZClcbiAgICAgICAgICB2YXIgc291cmNlX3JhbmsgPSBzb3VyY2UudHJ1ZV9yYW5rXG4gICAgICAgICAgdmFyIHJkID0gdGFyZ2V0X3JhbmsgLSBzb3VyY2VfcmFua1xuICAgICAgICAgIGlmICggcmQgPiAxICYmIGZza2lwcy5pbmRleE9mKHBhdGh3YXkpID09IC0xICkge1xuICAgICAgICAgICAgZnNraXBzLnB1c2gocGF0aHdheSlcbiAgICAgICAgICAgIHZhciBsZXZlbF9hbW91bnQgPSBmc2tpcHMubGVuZ3RoICogc2tpcHNlcFxuICAgICAgICAgICAgdmFyIGxldmVsID0gcmV2ZXJzZWQgPyAwIC0gbGV2ZWxfYW1vdW50IDogZ1tsZXZlbF9kaXJdICsgbGV2ZWxfYW1vdW50XG4gICAgICAgICAgICB2YXIgc291cmNlX2p1bmN0aW9uID0gZ2V0X2p1bmN0aW9uKHNvdXJjZS5leGl0c1swXS5qdW5jdGlvblt2ZXJ0aWNhbCA/ICd5JyA6ICd4J10sIGxldmVsIClcbiAgICAgICAgICAgIGVkZ2VzW3NvdXJjZS50cnVlX3JhbmsgKyAxXVtzb3VyY2Uuc3B3aV0ucHVzaChzb3VyY2VfanVuY3Rpb24pXG4gICAgICAgICAgICB2YXIgdGFyZ2V0X2p1bmN0aW9uID0gZ2V0X2p1bmN0aW9uKHRhcmdldC5lbnRyaWVzWzBdLmp1bmN0aW9uW3ZlcnRpY2FsID8gJ3knIDogJ3gnXSwgbGV2ZWwgKVxuICAgICAgICAgICAgZWRnZXNbdGFyZ2V0LnRydWVfcmFua11bdGFyZ2V0LnRwd2ldLnB1c2godGFyZ2V0X2p1bmN0aW9uKVxuICAgICAgICAgICAgZWRnZXMuc2tpcHMucHVzaChbc291cmNlX2p1bmN0aW9uLCB0YXJnZXRfanVuY3Rpb25dKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIHJkIDwgMCAmJiBic2tpcHMuaW5kZXhPZihwYXRod2F5KSA9PSAtMSApIHtcbiAgICAgICAgICAgIGJza2lwcy5wdXNoKHBhdGh3YXkpXG4gICAgICAgICAgICB2YXIgbGV2ZWxfYW1vdW50ID0gYnNraXBzLmxlbmd0aCAqIHNraXBzZXBcbiAgICAgICAgICAgIHZhciBsZXZlbCA9IHJldmVyc2VkID8gZ1tsZXZlbF9kaXJdICsgbGV2ZWxfYW1vdW50IDogMCAtIGxldmVsX2Ftb3VudFxuICAgICAgICAgICAgdmFyIHNvdXJjZV9qdW5jdGlvbiA9IGdldF9qdW5jdGlvbihzb3VyY2UuZXhpdHNbMF0uanVuY3Rpb25bdmVydGljYWwgPyAneScgOiAneCddLCBsZXZlbCApXG4gICAgICAgICAgICBlZGdlc1tzb3VyY2UudHJ1ZV9yYW5rICsgMV1bc291cmNlLnNwd2ldLnB1c2goc291cmNlX2p1bmN0aW9uKVxuICAgICAgICAgICAgdmFyIHRhcmdldF9qdW5jdGlvbiA9IGdldF9qdW5jdGlvbih0YXJnZXQuZW50cmllc1swXS5qdW5jdGlvblt2ZXJ0aWNhbCA/ICd5JyA6ICd4J10sIGxldmVsIClcbiAgICAgICAgICAgIGVkZ2VzW3RhcmdldC50cnVlX3JhbmtdW3RhcmdldC50cHdpXS5wdXNoKHRhcmdldF9qdW5jdGlvbilcbiAgICAgICAgICAgIGVkZ2VzLnNraXBzLnB1c2goW3NvdXJjZV9qdW5jdGlvbiwgdGFyZ2V0X2p1bmN0aW9uXSlcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9KVxuICAgIH0pXG4gICAgbGFuZXMuZm9yRWFjaChmdW5jdGlvbihsYW5lLCByYW5rX25yKXtcbiAgICAgIGxhbmUuZm9yRWFjaChmdW5jdGlvbihwYXRod2F5LCBwd19pZHgpe1xuICAgICAgICBlZGdlc1tyYW5rX25yXVtwd19pZHhdLnNvcnQocmFua19zb3J0ZXIpXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICBlZGdlcy5ncm93dGggPSAoZnNraXBzLmxlbmd0aCArIGJza2lwcy5sZW5ndGgpICogc2tpcHNlcFxuXG5cbiAgICByZXR1cm4gZWRnZXNcbiAgfVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICB2YXIgViA9IHJlcXVpcmUoJy4vdmVjdG9ycy5qcycpXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzZWcxLCBzZWcyKXtcbiAgICB2YXIgcCA9IFtzZWcxLngxLCBzZWcxLnkxXVxuICAgIHZhciByID0gVi5zdWJ0cmFjdChbc2VnMS54Miwgc2VnMS55Ml0sIHApXG4gICAgdmFyIHEgPSBbc2VnMi54MSwgc2VnMi55MV1cbiAgICB2YXIgcyA9IFYuc3VidHJhY3QoW3NlZzIueDIsIHNlZzIueTJdLCBxKVxuXG4gICAgdmFyIHJ4cyA9IFYuY3Jvc3MociwgcylcbiAgICBpZiAoIHJ4cyA9PSAwICkgcmV0dXJuIGZhbHNlXG5cbiAgICB2YXIgcV9wID0gVi5zdWJ0cmFjdChxLHApXG4gICAgdmFyIHJ4cyA9IFYuY3Jvc3MociwgcylcbiAgICB2YXIgdCA9IFYuY3Jvc3MocV9wLCBzKSAvIHJ4c1xuICAgIGlmICggdCA8IDAgfHwgdCA+IDEgKSByZXR1cm4gZmFsc2VcbiAgICB2YXIgdSA9IFYuY3Jvc3MocV9wLCByKSAvIHJ4c1xuICAgIGlmICggdSA8IDAgfHwgdSA+IDEgKSByZXR1cm4gZmFsc2VcblxuICAgIC8vIHZhciB6MSA9IFYuYWRkKHAsIFYuc2NhbGUociwgdCkpXG4gICAgLy8gdmFyIHoyID0gVi5hZGQocSwgVi5zY2FsZShzLCB1KSlcblxuICAgIHJldHVybiBWLmFkZChwLCBWLnNjYWxlKHIsIHQpKVxuICB9XG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG5cbi8vICBmdW5jdGlvbiBkcmF3X2l0ZW0oaXRlbSl7XG4vLyAgICByZXR1cm4gaXRlbS5nID0gaXRlbS5kaWFncmFtLmRyYXcoaXRlbSlcbi8vICB9XG5cbiAgdmFyIEl0ZW0gPSB2aXJhbC5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGRpYWdyYW0sIGlkLCB2YWx1ZSwgaW52YWx1ZXMpe1xuICAgICAgdGhpcy5kaWFncmFtID0gZGlhZ3JhbVxuICAgICAgdGhpcy5pZCA9IGlkXG4gICAgICB0aGlzLnZhbHVlID0gdmFsdWVcbiAgICAgIHRoaXMuaW5wdXQgPSBpbnZhbHVlc1xuXG5cblxuLy8gICAgICBjb25zb2xlLmxvZygnbycsIHZhbHVlKVxuLy8gICAgICBjb25zb2xlLmxvZygnaScsIGludmFsdWVzKVxuICAgIH1cbi8vICAgICwgZHJhdzogZW5zbGF2ZShkcmF3X2l0ZW0pXG4gIH0pXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBJdGVtXG5cbn0oKVxuXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gdHJhbnNsYXRlKHZlY3RvciwgcG9pbnQpe1xuICAgIHJldHVybiB7IHg6IHBvaW50LnggKyB2ZWN0b3JbMF0sIHk6IHBvaW50LnkgKyB2ZWN0b3JbMV0gfVxuICB9XG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcblxuICBmdW5jdGlvbiBweXRoKGEsIGIpe1xuICAgIHJldHVybiBNYXRoLnNxcnQoTWF0aC5wb3coYSwyKSwgTWF0aC5wb3coYiwyKSlcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuICAgIGNyb3NzOiBmdW5jdGlvbiBjcm9zcyh2LCB3KXtcbiAgICAgIHJldHVybiB2WzBdICogd1sxXSAtIHZbMV0gKiB3WzBdXG4gICAgfVxuXG4gICwgYWRkOiAgZnVuY3Rpb24gYWRkKHYsIHcpe1xuICAgICAgcmV0dXJuIFt2WzBdICsgd1swXSwgdlsxXSArIHdbMV1dXG4gICAgfVxuXG4gICwgc3VidHJhY3Q6ICBmdW5jdGlvbiBzdWJ0cmFjdCh2LCB3KXtcbiAgICAgIHJldHVybiBbdlswXSAtIHdbMF0sIHZbMV0gLSB3WzFdXVxuICAgIH1cblxuICAsIHNjYWxlOiAgZnVuY3Rpb24gc2NhbGUodiwgcyl7XG4gICAgICByZXR1cm4gW3ZbMF0gKiBzLCB2WzFdICogc11cbiAgICB9XG5cbiAgLCBlcTogIGZ1bmN0aW9uIGVxKHYsIHcpe1xuICAgICAgcmV0dXJuIHZbMF0gPT0gd1swXSAmJiAgdlsxXSA9PSB3WzFdXG4gICAgfVxuICAsIG1hZ25pdHVkZTogZnVuY3Rpb24gbWFnbml0dWRlKHYpe1xuICAgICAgcmV0dXJuIHB5dGgodlswXSwgdlsxXSlcbiAgICB9XG5cbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciBOb2RlID0gcmVxdWlyZSgnLi9ub2RlLmpzJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcblxuICB2YXIgRWRnZSA9IE5vZGUuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihncmFwaCwgc291cmNlLCB0YXJnZXQsIHRyYW5zZm9ybSwgYXR0cnMpe1xuICAgICAgdGhpcy5pZCA9IHVpZCgpXG4gICAgICB0aGlzLnR5cGUgPSAnZWRnZSdcbiAgICAgIHRoaXMuZ3JhcGggPSBncmFwaFxuICAgICAgdGhpcy5zb3VyY2UgPSBzb3VyY2VcbiAgICAgIHRoaXMudGFyZ2V0ID0gdGFyZ2V0XG4gICAgfVxuICB9KVxuXG4gIG1vZHVsZS5leHBvcnRzID0gRWRnZVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIHZhciB2aXJhbCA9IHJlcXVpcmUoJ3ZpcmFsJylcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIGRhZ3JlID0gcmVxdWlyZSgnZGFncmUnKVxuICB2YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJylcbiAgdmFyIHVpZCA9IHJlcXVpcmUoJy4uL3V0aWwvdW5pcXVlX2lkLmpzJylcbiAgdmFyIE5vZGUgPSByZXF1aXJlKCcuL25vZGUuanMnKVxuICB2YXIgRWRnZSA9IHJlcXVpcmUoJy4vZWRnZS5qcycpXG5cbiAgZnVuY3Rpb24gYWRkX25vZGUoZ3JhcGgsIGNsYXNzbmFtZSwgdHJhbnNmb3JtLCBjb250ZW50LCBwcmVmUmFuayl7XG4gICAgdmFyIG5vZGUgPSBOb2RlLm1ha2UoZ3JhcGgsIHRyYW5zZm9ybSwge1xuICAgICAgICBjbGFzc25hbWU6IGNsYXNzbmFtZVxuICAgICAgLCBjb250ZW50OiBjb250ZW50XG4gICAgICAsIHJhbms6IHByZWZSYW5rXG4gICAgfSlcblxuICAgIGdyYXBoLmluZ3JhcGguYWRkTm9kZShub2RlLmlkLCBub2RlKVxuICAgIHJldHVybiBub2RlXG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVfbm9kZShncmFwaCwgbm9kZV9pZCl7XG4gICAgdmFyIGcgPSBncmFwaC5pbmdyYXBoXG4gICAgaWYgKCBnLmhhc05vZGUobm9kZV9pZCkgKSB7XG4gICAgICBjaGFyLmRlbE5vZGUobm9kZV9pZClcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgZnVuY3Rpb24gY29ubmVjdChncmFwaCwgY2xhc3NuYW1lLCBzb3VyY2UsIHRhcmdldCwgdHJhbnNmb3JtLCBjb250ZW50KXtcbiAgICB2YXIgZWRnZSA9IEVkZ2UubWFrZShncmFwaCwgc291cmNlLCB0YXJnZXQpXG4gICAgZ3JhcGguaW5ncmFwaC5hZGRFZGdlKGVkZ2UuaWQsIHNvdXJjZS5pZCwgdGFyZ2V0LmlkLCBlZGdlKVxuICAgIHJldHVybiBlZGdlXG4gIH1cblxuICBmdW5jdGlvbiBkaXNjb25uZWN0KGdyYXBoLCBzb3VyY2UsIHRhcmdldCl7XG4gICAgdmFyIGcgPSBncmFwaC5pbmdyYXBoXG4gICAgdmFyIGVkZ2VfaWQgPSBnLm91dEVkZ2VzKHNvdXJjZS5pZCwgdGFyZ2V0LmlkKVxuICAgIGlmICggZy5oYXNFZGdlKGVkZ2VfaWQpICkge1xuICAgICAgZy5kZWxFZGdlKGVkZ2VfaWQpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHZpcmFsLmV4dGVuZChuZXcgZXZlbnRzLkV2ZW50RW1pdHRlcikuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihjZmdvYmope1xuICAgICAgdGhpcy5jb25maWcgPSBjZmdvYmpcbiAgICAgIHRoaXMuaW5ncmFwaCA9ICBuZXcgZGFncmUuRGlncmFwaCgpXG4gICAgfVxuICAsIGFkZF9ub2RlOiBlbnNsYXZlKGFkZF9ub2RlKVxuICAsIGRlbF9ub2RlOiBlbnNsYXZlKHJlbW92ZV9ub2RlKVxuICAsIGNvbm5lY3Q6IGVuc2xhdmUoY29ubmVjdClcbiAgLCBkaXNjb25uZWN0OiBlbnNsYXZlKGRpc2Nvbm5lY3QpXG4gIH0pXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciB1aWQgPSByZXF1aXJlKCcuLi91dGlsL3VuaXF1ZV9pZC5qcycpXG5cbiAgZnVuY3Rpb24gc2V0X2F0dHJzKG5vZGUsIGF0dHJzKXtcbiAgICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaChmdW5jdGlvbihrZXkpe1xuICAgICAgbm9kZVtrZXldID0gYXR0cnNba2V5XVxuICAgIH0pXG4gICAgbm9kZS5ncmFwaC5lbWl0KG5vZGUudHlwZSArICdfYXR0cnMnLCBhdHRycylcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9hdHRyKG5vZGUsIGF0dHIsIHZhbHVlKXtcbiAgICBub2RlW2F0dHJdID0gdmFsdWVcbiAgICBub2RlLmdyYXBoLmVtaXQobm9kZS50eXBlICsgJ19hdHRyJywgYXR0ciwgdmFsdWUpXG4gIH1cblxuICBmdW5jdGlvbiBhZGRfYXR0cihub2RlLCBzZWxlY3RvciwgbmFtZSwgdmFsdWUpe1xuICAgIG5vZGUuY29udGVudFtzZWxlY3Rvcl0gPSBub2RlLmNvbnRlbnRbc2VsZWN0b3JdIHx8IHt9XG4gICAgbm9kZS5jb250ZW50W3NlbGVjdG9yXVtuYW1lXSA9IHZhbHVlXG4gIH1cblxuICBmdW5jdGlvbiBhZGRfYXR0cnMobm9kZSwgc2VsZWN0b3IsIGF0dHJzKXtcbiAgICBub2RlLmNvbnRlbnRbc2VsZWN0b3JdID0gdmFsdWVcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihncmFwaCwgdHJhbnNmb3JtLCBhdHRycyl7XG4gICAgICB0aGlzLmlkID0gdWlkKClcbiAgICAgIHRoaXMudHlwZSA9ICd2ZXJ0ZXgnXG4gICAgICB0aGlzLmdyYXBoID0gZ3JhcGhcbiAgICAgIHRoaXMudHJhbnNmb3JtID0gdHJhbnNmb3JtLmJpbmQobnVsbCwgdGhpcylcbiAgICAgIHNldF9hdHRycyh0aGlzLCBhdHRycylcbiAgICB9XG4gICwgYXR0cnM6IGVuc2xhdmUoc2V0X2F0dHJzKVxuICAsIGF0dHI6IGVuc2xhdmUoc2V0X2F0dHIpXG4gICwgYWRkX2F0dHI6IGVuc2xhdmUoYWRkX2F0dHIpXG4gICwgYWRkX2F0dHJzOiBlbnNsYXZlKGFkZF9hdHRycylcbiAgfSlcblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4vLyAgdmFyIFNuYXAgPSByZXF1aXJlKCdzbmFwc3ZnJylcbi8vICAgIGluaXQ6IGZ1bmN0aW9uKCl7XG4vLyAgICAgIHRoaXMuc3ZnZWwgPSBTbmFwLmFwcGx5KFNuYXAsIGFyZ3VtZW50cylcbi8vICAgIH1cblxuICBpZiAoIVN0cmluZy5wcm90b3R5cGUudHJpbSkge1xuICAgIFN0cmluZy5wcm90b3R5cGUudHJpbSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxuICAgIH1cbiAgfVxuXG4gIHZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vdXRpbC9kZWZhdWx0cy5qcycpXG4gIHZhciBHcmFwaCA9IHJlcXVpcmUoJy4vZ3JhcGgvZ3JhcGguanMnKVxuICB2YXIgRGlhZ3JhbSA9IHJlcXVpcmUoJy4vZGlhZ3JhbS9kaWFncmFtLmpzJylcblxuXG4gIC8qKlxuICAqIFNldCBkZWZhdWx0IGNvbmZpZ3VyYXRpb25cbiAgKiBAcGFyYW0gICAgICB7T2JqZWN0fSBvcHRpb25zXG4gICogQHJldHVybiAgICAge09iamVjdH0gb3B0aW9ucyBmaWxsZWQgd2l0aCBkZWZhdWx0c1xuICAqL1xuICBmdW5jdGlvbiBjb25maWcoY2Znb2JqKXtcbiAgICB2YXIgZGVmYXVsdF9jZmcgPSB7XG4gICAgICB3aWR0aDogd2luZG93LmlubmVyV2lkdGhcbiAgICAsIGhlaWdodDogd2luZG93LmlubmVySGVpZ2h0XG4gICAgLCBmb250X3NpemU6IDIxXG4gICAgLCBsaW5lX2hlaWdodDogMjYgLy8gZm9yIGZvbnQtc2l6ZSAyMVxuICAgIH1cbiAgICByZXR1cm4gY2Znb2JqID09IG51bGwgPyBkZWZhdWx0X2NmZ1xuICAgICAgICAgOiAgICAgICAgICAgICAgICAgIGRlZmF1bHRzKGNmZ29iaiwgZGVmYXVsdF9jZmcpXG4gIH1cblxuICAvKipcbiAgKiBDcmVhdGUgYSBuZXcgZ3JhcGggb2JqZWN0IHRvIHN0b3JlIGRpYWdyYW0gZGF0YSBpbiBpdFxuICAqIEByZXR1cm4gICAgIHtPYmplY3R9ICAgZ3JhcGggb2JqZWN0XG4gICovXG4gIGZ1bmN0aW9uIGdyYXBoKGNmZ29iail7XG4gICAgcmV0dXJuIEdyYXBoLm1ha2UoY2Znb2JqKVxuICB9XG5cbiAgLyoqXG4gICogSW5pdGlhbGl6ZSBkaWFncmFtIHdpdGggb3B0aW9ucyBhbmQgZ3JhcGggb2JqZWN0XG4gICogYW5kIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXG4gICogQHBhcmFtICAgICAge09iamVjdH0gICBvcHRpb25zXG4gICogQHBhcmFtICAgICAge09iamVjdH0gICBncmFwaCBvYmplY3RcbiAgKiBAcmV0dXJuICAgICB7T2JqZWN0fSAgIGRpYWdyYW1cbiAgKi9cbiAgZnVuY3Rpb24gZGlhZ3JhbShjZmdvYmosIGdyYXBoKXtcbiAgICByZXR1cm4gRGlhZ3JhbS5tYWtlKGNmZ29iaiwgZ3JhcGgpXG4gIH1cblxuXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuICAgIGNvbmZpZzogY29uZmlnXG4gICwgZ3JhcGg6IGdyYXBoXG4gICwgZGlhZ3JhbTogZGlhZ3JhbVxuICB9XG5cbn0oKVxuIiwiLypcbkNvcHlyaWdodCAoYykgMjAxMi0yMDEzIENocmlzIFBldHRpdHRcblxuUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxub2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xudG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG5mdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxuXG5UaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG5cblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbklNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG5BVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG5MSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuVEhFIFNPRlRXQVJFLlxuKi9cbmV4cG9ydHMuRGlncmFwaCA9IHJlcXVpcmUoXCJncmFwaGxpYlwiKS5EaWdyYXBoO1xuZXhwb3J0cy5HcmFwaCA9IHJlcXVpcmUoXCJncmFwaGxpYlwiKS5HcmFwaDtcbmV4cG9ydHMubGF5b3V0ID0gcmVxdWlyZShcIi4vbGliL2xheW91dFwiKTtcbmV4cG9ydHMudmVyc2lvbiA9IHJlcXVpcmUoXCIuL2xpYi92ZXJzaW9uXCIpO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICByYW5rID0gcmVxdWlyZSgnLi9yYW5rJyksXG4gICAgb3JkZXIgPSByZXF1aXJlKCcuL29yZGVyJyksXG4gICAgQ0dyYXBoID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5DR3JhcGgsXG4gICAgQ0RpZ3JhcGggPSByZXF1aXJlKCdncmFwaGxpYicpLkNEaWdyYXBoO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAvLyBFeHRlcm5hbCBjb25maWd1cmF0aW9uXG4gIHZhciBjb25maWcgPSB7XG4gICAgLy8gSG93IG11Y2ggZGVidWcgaW5mb3JtYXRpb24gdG8gaW5jbHVkZT9cbiAgICBkZWJ1Z0xldmVsOiAwLFxuICAgIC8vIE1heCBudW1iZXIgb2Ygc3dlZXBzIHRvIHBlcmZvcm0gaW4gb3JkZXIgcGhhc2VcbiAgICBvcmRlck1heFN3ZWVwczogb3JkZXIuREVGQVVMVF9NQVhfU1dFRVBTLFxuICAgIC8vIFVzZSBuZXR3b3JrIHNpbXBsZXggYWxnb3JpdGhtIGluIHJhbmtpbmdcbiAgICByYW5rU2ltcGxleDogZmFsc2UsXG4gICAgLy8gUmFuayBkaXJlY3Rpb24uIFZhbGlkIHZhbHVlcyBhcmUgKFRCLCBMUilcbiAgICByYW5rRGlyOiAnVEInXG4gIH07XG5cbiAgLy8gUGhhc2UgZnVuY3Rpb25zXG4gIHZhciBwb3NpdGlvbiA9IHJlcXVpcmUoJy4vcG9zaXRpb24nKSgpO1xuXG4gIC8vIFRoaXMgbGF5b3V0IG9iamVjdFxuICB2YXIgc2VsZiA9IHt9O1xuXG4gIHNlbGYub3JkZXJJdGVycyA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdvcmRlck1heFN3ZWVwcycpO1xuXG4gIHNlbGYucmFua1NpbXBsZXggPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAncmFua1NpbXBsZXgnKTtcblxuICBzZWxmLm5vZGVTZXAgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLm5vZGVTZXApO1xuICBzZWxmLmVkZ2VTZXAgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLmVkZ2VTZXApO1xuICBzZWxmLnVuaXZlcnNhbFNlcCA9IGRlbGVnYXRlUHJvcGVydHkocG9zaXRpb24udW5pdmVyc2FsU2VwKTtcbiAgc2VsZi5yYW5rU2VwID0gZGVsZWdhdGVQcm9wZXJ0eShwb3NpdGlvbi5yYW5rU2VwKTtcbiAgc2VsZi5yYW5rRGlyID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ3JhbmtEaXInKTtcbiAgc2VsZi5kZWJ1Z0FsaWdubWVudCA9IGRlbGVnYXRlUHJvcGVydHkocG9zaXRpb24uZGVidWdBbGlnbm1lbnQpO1xuXG4gIHNlbGYuZGVidWdMZXZlbCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdkZWJ1Z0xldmVsJywgZnVuY3Rpb24oeCkge1xuICAgIHV0aWwubG9nLmxldmVsID0geDtcbiAgICBwb3NpdGlvbi5kZWJ1Z0xldmVsKHgpO1xuICB9KTtcblxuICBzZWxmLnJ1biA9IHV0aWwudGltZSgnVG90YWwgbGF5b3V0JywgcnVuKTtcblxuICBzZWxmLl9ub3JtYWxpemUgPSBub3JtYWxpemU7XG5cbiAgcmV0dXJuIHNlbGY7XG5cbiAgLypcbiAgICogQ29uc3RydWN0cyBhbiBhZGphY2VuY3kgZ3JhcGggdXNpbmcgdGhlIG5vZGVzIGFuZCBlZGdlcyBzcGVjaWZpZWQgdGhyb3VnaFxuICAgKiBjb25maWcuIEZvciBlYWNoIG5vZGUgYW5kIGVkZ2Ugd2UgYWRkIGEgcHJvcGVydHkgYGRhZ3JlYCB0aGF0IGNvbnRhaW5zIGFuXG4gICAqIG9iamVjdCB0aGF0IHdpbGwgaG9sZCBpbnRlcm1lZGlhdGUgYW5kIGZpbmFsIGxheW91dCBpbmZvcm1hdGlvbi4gU29tZSBvZlxuICAgKiB0aGUgY29udGVudHMgaW5jbHVkZTpcbiAgICpcbiAgICogIDEpIEEgZ2VuZXJhdGVkIElEIHRoYXQgdW5pcXVlbHkgaWRlbnRpZmllcyB0aGUgb2JqZWN0LlxuICAgKiAgMikgRGltZW5zaW9uIGluZm9ybWF0aW9uIGZvciBub2RlcyAoY29waWVkIGZyb20gdGhlIHNvdXJjZSBub2RlKS5cbiAgICogIDMpIE9wdGlvbmFsIGRpbWVuc2lvbiBpbmZvcm1hdGlvbiBmb3IgZWRnZXMuXG4gICAqXG4gICAqIEFmdGVyIHRoZSBhZGphY2VuY3kgZ3JhcGggaXMgY29uc3RydWN0ZWQgdGhlIGNvZGUgbm8gbG9uZ2VyIG5lZWRzIHRvIHVzZVxuICAgKiB0aGUgb3JpZ2luYWwgbm9kZXMgYW5kIGVkZ2VzIHBhc3NlZCBpbiB2aWEgY29uZmlnLlxuICAgKi9cbiAgZnVuY3Rpb24gaW5pdExheW91dEdyYXBoKGlucHV0R3JhcGgpIHtcbiAgICB2YXIgZyA9IG5ldyBDRGlncmFwaCgpO1xuXG4gICAgaW5wdXRHcmFwaC5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHZhbHVlID0ge307XG4gICAgICBnLmFkZE5vZGUodSwge1xuICAgICAgICB3aWR0aDogdmFsdWUud2lkdGgsXG4gICAgICAgIGhlaWdodDogdmFsdWUuaGVpZ2h0XG4gICAgICB9KTtcbiAgICAgIGlmICh2YWx1ZS5oYXNPd25Qcm9wZXJ0eSgncmFuaycpKSB7XG4gICAgICAgIGcubm9kZSh1KS5wcmVmUmFuayA9IHZhbHVlLnJhbms7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBTZXQgdXAgc3ViZ3JhcGhzXG4gICAgaWYgKGlucHV0R3JhcGgucGFyZW50KSB7XG4gICAgICBpbnB1dEdyYXBoLm5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAgIGcucGFyZW50KHUsIGlucHV0R3JhcGgucGFyZW50KHUpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlucHV0R3JhcGguZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB2YWx1ZSA9IHt9O1xuICAgICAgdmFyIG5ld1ZhbHVlID0ge1xuICAgICAgICBlOiBlLFxuICAgICAgICBtaW5MZW46IHZhbHVlLm1pbkxlbiB8fCAxLFxuICAgICAgICB3aWR0aDogdmFsdWUud2lkdGggfHwgMCxcbiAgICAgICAgaGVpZ2h0OiB2YWx1ZS5oZWlnaHQgfHwgMCxcbiAgICAgICAgcG9pbnRzOiBbXVxuICAgICAgfTtcblxuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYsIG5ld1ZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIEluaXRpYWwgZ3JhcGggYXR0cmlidXRlc1xuICAgIHZhciBncmFwaFZhbHVlID0gaW5wdXRHcmFwaC5ncmFwaCgpIHx8IHt9O1xuICAgIGcuZ3JhcGgoe1xuICAgICAgcmFua0RpcjogZ3JhcGhWYWx1ZS5yYW5rRGlyIHx8IGNvbmZpZy5yYW5rRGlyLFxuICAgICAgb3JkZXJSZXN0YXJ0czogZ3JhcGhWYWx1ZS5vcmRlclJlc3RhcnRzXG4gICAgfSk7XG5cbiAgICByZXR1cm4gZztcbiAgfVxuXG4gIGZ1bmN0aW9uIHJ1bihpbnB1dEdyYXBoKSB7XG4gICAgdmFyIHJhbmtTZXAgPSBzZWxmLnJhbmtTZXAoKTtcbiAgICB2YXIgZztcbiAgICB0cnkge1xuICAgICAgLy8gQnVpbGQgaW50ZXJuYWwgZ3JhcGhcbiAgICAgIGcgPSB1dGlsLnRpbWUoJ2luaXRMYXlvdXRHcmFwaCcsIGluaXRMYXlvdXRHcmFwaCkoaW5wdXRHcmFwaCk7XG5cbiAgICAgIGlmIChnLm9yZGVyKCkgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGc7XG4gICAgICB9XG5cbiAgICAgIC8vIE1ha2Ugc3BhY2UgZm9yIGVkZ2UgbGFiZWxzXG4gICAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHMsIHQsIGEpIHtcbiAgICAgICAgYS5taW5MZW4gKj0gMjtcbiAgICAgIH0pO1xuICAgICAgc2VsZi5yYW5rU2VwKHJhbmtTZXAgLyAyKTtcblxuICAgICAgLy8gRGV0ZXJtaW5lIHRoZSByYW5rIGZvciBlYWNoIG5vZGUuIE5vZGVzIHdpdGggYSBsb3dlciByYW5rIHdpbGwgYXBwZWFyXG4gICAgICAvLyBhYm92ZSBub2RlcyBvZiBoaWdoZXIgcmFuay5cbiAgICAgIHV0aWwudGltZSgncmFuay5ydW4nLCByYW5rLnJ1bikoZywgY29uZmlnLnJhbmtTaW1wbGV4KTtcblxuICAgICAgLy8gTm9ybWFsaXplIHRoZSBncmFwaCBieSBlbnN1cmluZyB0aGF0IGV2ZXJ5IGVkZ2UgaXMgcHJvcGVyIChlYWNoIGVkZ2UgaGFzXG4gICAgICAvLyBhIGxlbmd0aCBvZiAxKS4gV2UgYWNoaWV2ZSB0aGlzIGJ5IGFkZGluZyBkdW1teSBub2RlcyB0byBsb25nIGVkZ2VzLFxuICAgICAgLy8gdGh1cyBzaG9ydGVuaW5nIHRoZW0uXG4gICAgICB1dGlsLnRpbWUoJ25vcm1hbGl6ZScsIG5vcm1hbGl6ZSkoZyk7XG5cbiAgICAgIC8vIE9yZGVyIHRoZSBub2RlcyBzbyB0aGF0IGVkZ2UgY3Jvc3NpbmdzIGFyZSBtaW5pbWl6ZWQuXG4gICAgICB1dGlsLnRpbWUoJ29yZGVyJywgb3JkZXIpKGcsIGNvbmZpZy5vcmRlck1heFN3ZWVwcyk7XG5cbiAgICAgIC8vIEZpbmQgdGhlIHggYW5kIHkgY29vcmRpbmF0ZXMgZm9yIGV2ZXJ5IG5vZGUgaW4gdGhlIGdyYXBoLlxuICAgICAgdXRpbC50aW1lKCdwb3NpdGlvbicsIHBvc2l0aW9uLnJ1bikoZyk7XG5cbiAgICAgIC8vIERlLW5vcm1hbGl6ZSB0aGUgZ3JhcGggYnkgcmVtb3ZpbmcgZHVtbXkgbm9kZXMgYW5kIGF1Z21lbnRpbmcgdGhlXG4gICAgICAvLyBvcmlnaW5hbCBsb25nIGVkZ2VzIHdpdGggY29vcmRpbmF0ZSBpbmZvcm1hdGlvbi5cbiAgICAgIHV0aWwudGltZSgndW5kb05vcm1hbGl6ZScsIHVuZG9Ob3JtYWxpemUpKGcpO1xuXG4gICAgICAvLyBSZXZlcnNlcyBwb2ludHMgZm9yIGVkZ2VzIHRoYXQgYXJlIGluIGEgcmV2ZXJzZWQgc3RhdGUuXG4gICAgICB1dGlsLnRpbWUoJ2ZpeHVwRWRnZVBvaW50cycsIGZpeHVwRWRnZVBvaW50cykoZyk7XG5cbiAgICAgIC8vIFJlc3RvcmUgZGVsZXRlIGVkZ2VzIGFuZCByZXZlcnNlIGVkZ2VzIHRoYXQgd2VyZSByZXZlcnNlZCBpbiB0aGUgcmFua1xuICAgICAgLy8gcGhhc2UuXG4gICAgICB1dGlsLnRpbWUoJ3JhbmsucmVzdG9yZUVkZ2VzJywgcmFuay5yZXN0b3JlRWRnZXMpKGcpO1xuXG4gICAgICAvLyBDb25zdHJ1Y3QgZmluYWwgcmVzdWx0IGdyYXBoIGFuZCByZXR1cm4gaXRcbiAgICAgIHJldHVybiB1dGlsLnRpbWUoJ2NyZWF0ZUZpbmFsR3JhcGgnLCBjcmVhdGVGaW5hbEdyYXBoKShnLCBpbnB1dEdyYXBoLmlzRGlyZWN0ZWQoKSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNlbGYucmFua1NlcChyYW5rU2VwKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBUaGlzIGZ1bmN0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciAnbm9ybWFsaXppbmcnIHRoZSBncmFwaC4gVGhlIHByb2Nlc3Mgb2ZcbiAgICogbm9ybWFsaXphdGlvbiBlbnN1cmVzIHRoYXQgbm8gZWRnZSBpbiB0aGUgZ3JhcGggaGFzIHNwYW5zIG1vcmUgdGhhbiBvbmVcbiAgICogcmFuay4gVG8gZG8gdGhpcyBpdCBpbnNlcnRzIGR1bW15IG5vZGVzIGFzIG5lZWRlZCBhbmQgbGlua3MgdGhlbSBieSBhZGRpbmdcbiAgICogZHVtbXkgZWRnZXMuIFRoaXMgZnVuY3Rpb24ga2VlcHMgZW5vdWdoIGluZm9ybWF0aW9uIGluIHRoZSBkdW1teSBub2RlcyBhbmRcbiAgICogZWRnZXMgdG8gZW5zdXJlIHRoYXQgdGhlIG9yaWdpbmFsIGdyYXBoIGNhbiBiZSByZWNvbnN0cnVjdGVkIGxhdGVyLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoYXQgdGhlIGlucHV0IGdyYXBoIGlzIGN5Y2xlIGZyZWUuXG4gICAqL1xuICBmdW5jdGlvbiBub3JtYWxpemUoZykge1xuICAgIHZhciBkdW1teUNvdW50ID0gMDtcbiAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHMsIHQsIGEpIHtcbiAgICAgIHZhciBzb3VyY2VSYW5rID0gZy5ub2RlKHMpLnJhbms7XG4gICAgICB2YXIgdGFyZ2V0UmFuayA9IGcubm9kZSh0KS5yYW5rO1xuICAgICAgaWYgKHNvdXJjZVJhbmsgKyAxIDwgdGFyZ2V0UmFuaykge1xuICAgICAgICBmb3IgKHZhciB1ID0gcywgcmFuayA9IHNvdXJjZVJhbmsgKyAxLCBpID0gMDsgcmFuayA8IHRhcmdldFJhbms7ICsrcmFuaywgKytpKSB7XG4gICAgICAgICAgdmFyIHYgPSAnX0QnICsgKCsrZHVtbXlDb3VudCk7XG4gICAgICAgICAgdmFyIG5vZGUgPSB7XG4gICAgICAgICAgICB3aWR0aDogYS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogYS5oZWlnaHQsXG4gICAgICAgICAgICBlZGdlOiB7IGlkOiBlLCBzb3VyY2U6IHMsIHRhcmdldDogdCwgYXR0cnM6IGEgfSxcbiAgICAgICAgICAgIHJhbms6IHJhbmssXG4gICAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBJZiB0aGlzIG5vZGUgcmVwcmVzZW50cyBhIGJlbmQgdGhlbiB3ZSB3aWxsIHVzZSBpdCBhcyBhIGNvbnRyb2xcbiAgICAgICAgICAvLyBwb2ludC4gRm9yIGVkZ2VzIHdpdGggMiBzZWdtZW50cyB0aGlzIHdpbGwgYmUgdGhlIGNlbnRlciBkdW1teVxuICAgICAgICAgIC8vIG5vZGUuIEZvciBlZGdlcyB3aXRoIG1vcmUgdGhhbiB0d28gc2VnbWVudHMsIHRoaXMgd2lsbCBiZSB0aGVcbiAgICAgICAgICAvLyBmaXJzdCBhbmQgbGFzdCBkdW1teSBub2RlLlxuICAgICAgICAgIGlmIChpID09PSAwKSBub2RlLmluZGV4ID0gMDtcbiAgICAgICAgICBlbHNlIGlmIChyYW5rICsgMSA9PT0gdGFyZ2V0UmFuaykgbm9kZS5pbmRleCA9IDE7XG5cbiAgICAgICAgICBnLmFkZE5vZGUodiwgbm9kZSk7XG4gICAgICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYsIHt9KTtcbiAgICAgICAgICB1ID0gdjtcbiAgICAgICAgfVxuICAgICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdCwge30pO1xuICAgICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBSZWNvbnN0cnVjdHMgdGhlIGdyYXBoIGFzIGl0IHdhcyBiZWZvcmUgbm9ybWFsaXphdGlvbi4gVGhlIHBvc2l0aW9ucyBvZlxuICAgKiBkdW1teSBub2RlcyBhcmUgdXNlZCB0byBidWlsZCBhbiBhcnJheSBvZiBwb2ludHMgZm9yIHRoZSBvcmlnaW5hbCAnbG9uZydcbiAgICogZWRnZS4gRHVtbXkgbm9kZXMgYW5kIGVkZ2VzIGFyZSByZW1vdmVkLlxuICAgKi9cbiAgZnVuY3Rpb24gdW5kb05vcm1hbGl6ZShnKSB7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCBhKSB7XG4gICAgICBpZiAoYS5kdW1teSkge1xuICAgICAgICBpZiAoJ2luZGV4JyBpbiBhKSB7XG4gICAgICAgICAgdmFyIGVkZ2UgPSBhLmVkZ2U7XG4gICAgICAgICAgaWYgKCFnLmhhc0VkZ2UoZWRnZS5pZCkpIHtcbiAgICAgICAgICAgIGcuYWRkRWRnZShlZGdlLmlkLCBlZGdlLnNvdXJjZSwgZWRnZS50YXJnZXQsIGVkZ2UuYXR0cnMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgcG9pbnRzID0gZy5lZGdlKGVkZ2UuaWQpLnBvaW50cztcbiAgICAgICAgICBwb2ludHNbYS5pbmRleF0gPSB7IHg6IGEueCwgeTogYS55LCB1bDogYS51bCwgdXI6IGEudXIsIGRsOiBhLmRsLCBkcjogYS5kciB9O1xuICAgICAgICB9XG4gICAgICAgIGcuZGVsTm9kZSh1KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIEZvciBlYWNoIGVkZ2UgdGhhdCB3YXMgcmV2ZXJzZWQgZHVyaW5nIHRoZSBgYWN5Y2xpY2Agc3RlcCwgcmV2ZXJzZSBpdHNcbiAgICogYXJyYXkgb2YgcG9pbnRzLlxuICAgKi9cbiAgZnVuY3Rpb24gZml4dXBFZGdlUG9pbnRzKGcpIHtcbiAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHMsIHQsIGEpIHsgaWYgKGEucmV2ZXJzZWQpIGEucG9pbnRzLnJldmVyc2UoKTsgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVGaW5hbEdyYXBoKGcsIGlzRGlyZWN0ZWQpIHtcbiAgICB2YXIgb3V0ID0gaXNEaXJlY3RlZCA/IG5ldyBDRGlncmFwaCgpIDogbmV3IENHcmFwaCgpO1xuICAgIG91dC5ncmFwaChnLmdyYXBoKCkpO1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgb3V0LmFkZE5vZGUodSwgdmFsdWUpOyB9KTtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHsgb3V0LnBhcmVudCh1LCBnLnBhcmVudCh1KSk7IH0pO1xuICAgIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICAgIG91dC5hZGRFZGdlKHZhbHVlLmUsIHUsIHYsIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIEF0dGFjaCBib3VuZGluZyBib3ggaW5mb3JtYXRpb25cbiAgICB2YXIgbWF4WCA9IDAsIG1heFkgPSAwO1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICAgIGlmICghZy5jaGlsZHJlbih1KS5sZW5ndGgpIHtcbiAgICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIHZhbHVlLnggKyB2YWx1ZS53aWR0aCAvIDIpO1xuICAgICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgdmFsdWUueSArIHZhbHVlLmhlaWdodCAvIDIpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICAgIHZhciBtYXhYUG9pbnRzID0gTWF0aC5tYXguYXBwbHkoTWF0aCwgdmFsdWUucG9pbnRzLm1hcChmdW5jdGlvbihwKSB7IHJldHVybiBwLng7IH0pKTtcbiAgICAgIHZhciBtYXhZUG9pbnRzID0gTWF0aC5tYXguYXBwbHkoTWF0aCwgdmFsdWUucG9pbnRzLm1hcChmdW5jdGlvbihwKSB7IHJldHVybiBwLnk7IH0pKTtcbiAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCBtYXhYUG9pbnRzICsgdmFsdWUud2lkdGggLyAyKTtcbiAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCBtYXhZUG9pbnRzICsgdmFsdWUuaGVpZ2h0IC8gMik7XG4gICAgfSk7XG4gICAgb3V0LmdyYXBoKCkud2lkdGggPSBtYXhYO1xuICAgIG91dC5ncmFwaCgpLmhlaWdodCA9IG1heFk7XG5cbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgLypcbiAgICogR2l2ZW4gYSBmdW5jdGlvbiwgYSBuZXcgZnVuY3Rpb24gaXMgcmV0dXJuZWQgdGhhdCBpbnZva2VzIHRoZSBnaXZlblxuICAgKiBmdW5jdGlvbi4gVGhlIHJldHVybiB2YWx1ZSBmcm9tIHRoZSBmdW5jdGlvbiBpcyBhbHdheXMgdGhlIGBzZWxmYCBvYmplY3QuXG4gICAqL1xuICBmdW5jdGlvbiBkZWxlZ2F0ZVByb3BlcnR5KGYpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBmKCk7XG4gICAgICBmLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9O1xuICB9XG59O1xuXG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGNyb3NzQ291bnQgPSByZXF1aXJlKCcuL29yZGVyL2Nyb3NzQ291bnQnKSxcbiAgICBpbml0TGF5ZXJHcmFwaHMgPSByZXF1aXJlKCcuL29yZGVyL2luaXRMYXllckdyYXBocycpLFxuICAgIGluaXRPcmRlciA9IHJlcXVpcmUoJy4vb3JkZXIvaW5pdE9yZGVyJyksXG4gICAgc29ydExheWVyID0gcmVxdWlyZSgnLi9vcmRlci9zb3J0TGF5ZXInKTtcblxubW9kdWxlLmV4cG9ydHMgPSBvcmRlcjtcblxuLy8gVGhlIG1heGltdW0gbnVtYmVyIG9mIHN3ZWVwcyB0byBwZXJmb3JtIGJlZm9yZSBmaW5pc2hpbmcgdGhlIG9yZGVyIHBoYXNlLlxudmFyIERFRkFVTFRfTUFYX1NXRUVQUyA9IDI0O1xub3JkZXIuREVGQVVMVF9NQVhfU1dFRVBTID0gREVGQVVMVF9NQVhfU1dFRVBTO1xuXG4vKlxuICogUnVucyB0aGUgb3JkZXIgcGhhc2Ugd2l0aCB0aGUgc3BlY2lmaWVkIGBncmFwaCwgYG1heFN3ZWVwc2AsIGFuZFxuICogYGRlYnVnTGV2ZWxgLiBJZiBgbWF4U3dlZXBzYCBpcyBub3Qgc3BlY2lmaWVkIHdlIHVzZSBgREVGQVVMVF9NQVhfU1dFRVBTYC5cbiAqIElmIGBkZWJ1Z0xldmVsYCBpcyBub3Qgc2V0IHdlIGFzc3VtZSAwLlxuICovXG5mdW5jdGlvbiBvcmRlcihnLCBtYXhTd2VlcHMpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgbWF4U3dlZXBzID0gREVGQVVMVF9NQVhfU1dFRVBTO1xuICB9XG5cbiAgdmFyIHJlc3RhcnRzID0gZy5ncmFwaCgpLm9yZGVyUmVzdGFydHMgfHwgMDtcblxuICB2YXIgbGF5ZXJHcmFwaHMgPSBpbml0TGF5ZXJHcmFwaHMoZyk7XG4gIC8vIFRPRE86IHJlbW92ZSB0aGlzIHdoZW4gd2UgYWRkIGJhY2sgc3VwcG9ydCBmb3Igb3JkZXJpbmcgY2x1c3RlcnNcbiAgbGF5ZXJHcmFwaHMuZm9yRWFjaChmdW5jdGlvbihsZykge1xuICAgIGxnID0gbGcuZmlsdGVyTm9kZXMoZnVuY3Rpb24odSkgeyByZXR1cm4gIWcuY2hpbGRyZW4odSkubGVuZ3RoOyB9KTtcbiAgfSk7XG5cbiAgdmFyIGl0ZXJzID0gMCxcbiAgICAgIGN1cnJlbnRCZXN0Q0MsXG4gICAgICBhbGxUaW1lQmVzdENDID0gTnVtYmVyLk1BWF9WQUxVRSxcbiAgICAgIGFsbFRpbWVCZXN0ID0ge307XG5cbiAgZnVuY3Rpb24gc2F2ZUFsbFRpbWVCZXN0KCkge1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgYWxsVGltZUJlc3RbdV0gPSB2YWx1ZS5vcmRlcjsgfSk7XG4gIH1cblxuICBmb3IgKHZhciBqID0gMDsgaiA8IE51bWJlcihyZXN0YXJ0cykgKyAxICYmIGFsbFRpbWVCZXN0Q0MgIT09IDA7ICsraikge1xuICAgIGN1cnJlbnRCZXN0Q0MgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgIGluaXRPcmRlcihnLCByZXN0YXJ0cyA+IDApO1xuXG4gICAgdXRpbC5sb2coMiwgJ09yZGVyIHBoYXNlIHN0YXJ0IGNyb3NzIGNvdW50OiAnICsgZy5ncmFwaCgpLm9yZGVySW5pdENDKTtcblxuICAgIHZhciBpLCBsYXN0QmVzdCwgY2M7XG4gICAgZm9yIChpID0gMCwgbGFzdEJlc3QgPSAwOyBsYXN0QmVzdCA8IDQgJiYgaSA8IG1heFN3ZWVwcyAmJiBjdXJyZW50QmVzdENDID4gMDsgKytpLCArK2xhc3RCZXN0LCArK2l0ZXJzKSB7XG4gICAgICBzd2VlcChnLCBsYXllckdyYXBocywgaSk7XG4gICAgICBjYyA9IGNyb3NzQ291bnQoZyk7XG4gICAgICBpZiAoY2MgPCBjdXJyZW50QmVzdENDKSB7XG4gICAgICAgIGxhc3RCZXN0ID0gMDtcbiAgICAgICAgY3VycmVudEJlc3RDQyA9IGNjO1xuICAgICAgICBpZiAoY2MgPCBhbGxUaW1lQmVzdENDKSB7XG4gICAgICAgICAgc2F2ZUFsbFRpbWVCZXN0KCk7XG4gICAgICAgICAgYWxsVGltZUJlc3RDQyA9IGNjO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1dGlsLmxvZygzLCAnT3JkZXIgcGhhc2Ugc3RhcnQgJyArIGogKyAnIGl0ZXIgJyArIGkgKyAnIGNyb3NzIGNvdW50OiAnICsgY2MpO1xuICAgIH1cbiAgfVxuXG4gIE9iamVjdC5rZXlzKGFsbFRpbWVCZXN0KS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICBpZiAoIWcuY2hpbGRyZW4gfHwgIWcuY2hpbGRyZW4odSkubGVuZ3RoKSB7XG4gICAgICBnLm5vZGUodSkub3JkZXIgPSBhbGxUaW1lQmVzdFt1XTtcbiAgICB9XG4gIH0pO1xuICBnLmdyYXBoKCkub3JkZXJDQyA9IGFsbFRpbWVCZXN0Q0M7XG5cbiAgdXRpbC5sb2coMiwgJ09yZGVyIGl0ZXJhdGlvbnM6ICcgKyBpdGVycyk7XG4gIHV0aWwubG9nKDIsICdPcmRlciBwaGFzZSBiZXN0IGNyb3NzIGNvdW50OiAnICsgZy5ncmFwaCgpLm9yZGVyQ0MpO1xufVxuXG5mdW5jdGlvbiBwcmVkZWNlc3NvcldlaWdodHMoZywgbm9kZXMpIHtcbiAgdmFyIHdlaWdodHMgPSB7fTtcbiAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgd2VpZ2h0c1t1XSA9IGcuaW5FZGdlcyh1KS5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGcubm9kZShnLnNvdXJjZShlKSkub3JkZXI7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gd2VpZ2h0cztcbn1cblxuZnVuY3Rpb24gc3VjY2Vzc29yV2VpZ2h0cyhnLCBub2Rlcykge1xuICB2YXIgd2VpZ2h0cyA9IHt9O1xuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICB3ZWlnaHRzW3VdID0gZy5vdXRFZGdlcyh1KS5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGcubm9kZShnLnRhcmdldChlKSkub3JkZXI7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gd2VpZ2h0cztcbn1cblxuZnVuY3Rpb24gc3dlZXAoZywgbGF5ZXJHcmFwaHMsIGl0ZXIpIHtcbiAgaWYgKGl0ZXIgJSAyID09PSAwKSB7XG4gICAgc3dlZXBEb3duKGcsIGxheWVyR3JhcGhzLCBpdGVyKTtcbiAgfSBlbHNlIHtcbiAgICBzd2VlcFVwKGcsIGxheWVyR3JhcGhzLCBpdGVyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzd2VlcERvd24oZywgbGF5ZXJHcmFwaHMpIHtcbiAgdmFyIGNnO1xuICBmb3IgKGkgPSAxOyBpIDwgbGF5ZXJHcmFwaHMubGVuZ3RoOyArK2kpIHtcbiAgICBjZyA9IHNvcnRMYXllcihsYXllckdyYXBoc1tpXSwgY2csIHByZWRlY2Vzc29yV2VpZ2h0cyhnLCBsYXllckdyYXBoc1tpXS5ub2RlcygpKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3dlZXBVcChnLCBsYXllckdyYXBocykge1xuICB2YXIgY2c7XG4gIGZvciAoaSA9IGxheWVyR3JhcGhzLmxlbmd0aCAtIDI7IGkgPj0gMDsgLS1pKSB7XG4gICAgc29ydExheWVyKGxheWVyR3JhcGhzW2ldLCBjZywgc3VjY2Vzc29yV2VpZ2h0cyhnLCBsYXllckdyYXBoc1tpXS5ub2RlcygpKSk7XG4gIH1cbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyb3NzQ291bnQ7XG5cbi8qXG4gKiBSZXR1cm5zIHRoZSBjcm9zcyBjb3VudCBmb3IgdGhlIGdpdmVuIGdyYXBoLlxuICovXG5mdW5jdGlvbiBjcm9zc0NvdW50KGcpIHtcbiAgdmFyIGNjID0gMDtcbiAgdmFyIG9yZGVyaW5nID0gdXRpbC5vcmRlcmluZyhnKTtcbiAgZm9yICh2YXIgaSA9IDE7IGkgPCBvcmRlcmluZy5sZW5ndGg7ICsraSkge1xuICAgIGNjICs9IHR3b0xheWVyQ3Jvc3NDb3VudChnLCBvcmRlcmluZ1tpLTFdLCBvcmRlcmluZ1tpXSk7XG4gIH1cbiAgcmV0dXJuIGNjO1xufVxuXG4vKlxuICogVGhpcyBmdW5jdGlvbiBzZWFyY2hlcyB0aHJvdWdoIGEgcmFua2VkIGFuZCBvcmRlcmVkIGdyYXBoIGFuZCBjb3VudHMgdGhlXG4gKiBudW1iZXIgb2YgZWRnZXMgdGhhdCBjcm9zcy4gVGhpcyBhbGdvcml0aG0gaXMgZGVyaXZlZCBmcm9tOlxuICpcbiAqICAgIFcuIEJhcnRoIGV0IGFsLiwgQmlsYXllciBDcm9zcyBDb3VudGluZywgSkdBQSwgOCgyKSAxNznigJMxOTQgKDIwMDQpXG4gKi9cbmZ1bmN0aW9uIHR3b0xheWVyQ3Jvc3NDb3VudChnLCBsYXllcjEsIGxheWVyMikge1xuICB2YXIgaW5kaWNlcyA9IFtdO1xuICBsYXllcjEuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgdmFyIG5vZGVJbmRpY2VzID0gW107XG4gICAgZy5vdXRFZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHsgbm9kZUluZGljZXMucHVzaChnLm5vZGUoZy50YXJnZXQoZSkpLm9yZGVyKTsgfSk7XG4gICAgbm9kZUluZGljZXMuc29ydChmdW5jdGlvbih4LCB5KSB7IHJldHVybiB4IC0geTsgfSk7XG4gICAgaW5kaWNlcyA9IGluZGljZXMuY29uY2F0KG5vZGVJbmRpY2VzKTtcbiAgfSk7XG5cbiAgdmFyIGZpcnN0SW5kZXggPSAxO1xuICB3aGlsZSAoZmlyc3RJbmRleCA8IGxheWVyMi5sZW5ndGgpIGZpcnN0SW5kZXggPDw9IDE7XG5cbiAgdmFyIHRyZWVTaXplID0gMiAqIGZpcnN0SW5kZXggLSAxO1xuICBmaXJzdEluZGV4IC09IDE7XG5cbiAgdmFyIHRyZWUgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmVlU2l6ZTsgKytpKSB7IHRyZWVbaV0gPSAwOyB9XG5cbiAgdmFyIGNjID0gMDtcbiAgaW5kaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKGkpIHtcbiAgICB2YXIgdHJlZUluZGV4ID0gaSArIGZpcnN0SW5kZXg7XG4gICAgKyt0cmVlW3RyZWVJbmRleF07XG4gICAgd2hpbGUgKHRyZWVJbmRleCA+IDApIHtcbiAgICAgIGlmICh0cmVlSW5kZXggJSAyKSB7XG4gICAgICAgIGNjICs9IHRyZWVbdHJlZUluZGV4ICsgMV07XG4gICAgICB9XG4gICAgICB0cmVlSW5kZXggPSAodHJlZUluZGV4IC0gMSkgPj4gMTtcbiAgICAgICsrdHJlZVt0cmVlSW5kZXhdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNjO1xufVxuIiwidmFyIG5vZGVzRnJvbUxpc3QgPSByZXF1aXJlKCdncmFwaGxpYicpLmZpbHRlci5ub2Rlc0Zyb21MaXN0LFxuICAgIC8qIGpzaGludCAtVzA3OSAqL1xuICAgIFNldCA9IHJlcXVpcmUoJ2NwLWRhdGEnKS5TZXQ7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdExheWVyR3JhcGhzO1xuXG4vKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhIGNvbXBvdW5kIGxheWVyZWQgZ3JhcGgsIGcsIGFuZCBwcm9kdWNlcyBhbiBhcnJheSBvZlxuICogbGF5ZXIgZ3JhcGhzLiBFYWNoIGVudHJ5IGluIHRoZSBhcnJheSByZXByZXNlbnRzIGEgc3ViZ3JhcGggb2Ygbm9kZXNcbiAqIHJlbGV2YW50IGZvciBwZXJmb3JtaW5nIGNyb3NzaW5nIHJlZHVjdGlvbiBvbiB0aGF0IGxheWVyLlxuICovXG5mdW5jdGlvbiBpbml0TGF5ZXJHcmFwaHMoZykge1xuICB2YXIgcmFua3MgPSBbXTtcblxuICBmdW5jdGlvbiBkZnModSkge1xuICAgIGlmICh1ID09PSBudWxsKSB7XG4gICAgICBnLmNoaWxkcmVuKHUpLmZvckVhY2goZnVuY3Rpb24odikgeyBkZnModik7IH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB2YWx1ZSA9IGcubm9kZSh1KTtcbiAgICB2YWx1ZS5taW5SYW5rID0gKCdyYW5rJyBpbiB2YWx1ZSkgPyB2YWx1ZS5yYW5rIDogTnVtYmVyLk1BWF9WQUxVRTtcbiAgICB2YWx1ZS5tYXhSYW5rID0gKCdyYW5rJyBpbiB2YWx1ZSkgPyB2YWx1ZS5yYW5rIDogTnVtYmVyLk1JTl9WQUxVRTtcbiAgICB2YXIgdVJhbmtzID0gbmV3IFNldCgpO1xuICAgIGcuY2hpbGRyZW4odSkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICB2YXIgcnMgPSBkZnModik7XG4gICAgICB1UmFua3MgPSBTZXQudW5pb24oW3VSYW5rcywgcnNdKTtcbiAgICAgIHZhbHVlLm1pblJhbmsgPSBNYXRoLm1pbih2YWx1ZS5taW5SYW5rLCBnLm5vZGUodikubWluUmFuayk7XG4gICAgICB2YWx1ZS5tYXhSYW5rID0gTWF0aC5tYXgodmFsdWUubWF4UmFuaywgZy5ub2RlKHYpLm1heFJhbmspO1xuICAgIH0pO1xuXG4gICAgaWYgKCdyYW5rJyBpbiB2YWx1ZSkgdVJhbmtzLmFkZCh2YWx1ZS5yYW5rKTtcblxuICAgIHVSYW5rcy5rZXlzKCkuZm9yRWFjaChmdW5jdGlvbihyKSB7XG4gICAgICBpZiAoIShyIGluIHJhbmtzKSkgcmFua3Nbcl0gPSBbXTtcbiAgICAgIHJhbmtzW3JdLnB1c2godSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdVJhbmtzO1xuICB9XG4gIGRmcyhudWxsKTtcblxuICB2YXIgbGF5ZXJHcmFwaHMgPSBbXTtcbiAgcmFua3MuZm9yRWFjaChmdW5jdGlvbih1cywgcmFuaykge1xuICAgIGxheWVyR3JhcGhzW3JhbmtdID0gZy5maWx0ZXJOb2Rlcyhub2Rlc0Zyb21MaXN0KHVzKSk7XG4gIH0pO1xuXG4gIHJldHVybiBsYXllckdyYXBocztcbn1cbiIsInZhciBjcm9zc0NvdW50ID0gcmVxdWlyZSgnLi9jcm9zc0NvdW50JyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0T3JkZXI7XG5cbi8qXG4gKiBHaXZlbiBhIGdyYXBoIHdpdGggYSBzZXQgb2YgbGF5ZXJlZCBub2RlcyAoaS5lLiBub2RlcyB0aGF0IGhhdmUgYSBgcmFua2BcbiAqIGF0dHJpYnV0ZSkgdGhpcyBmdW5jdGlvbiBhdHRhY2hlcyBhbiBgb3JkZXJgIGF0dHJpYnV0ZSB0aGF0IHVuaXF1ZWx5XG4gKiBhcnJhbmdlcyBlYWNoIG5vZGUgb2YgZWFjaCByYW5rLiBJZiBubyBjb25zdHJhaW50IGdyYXBoIGlzIHByb3ZpZGVkIHRoZVxuICogb3JkZXIgb2YgdGhlIG5vZGVzIGluIGVhY2ggcmFuayBpcyBlbnRpcmVseSBhcmJpdHJhcnkuXG4gKi9cbmZ1bmN0aW9uIGluaXRPcmRlcihnLCByYW5kb20pIHtcbiAgdmFyIGxheWVycyA9IFtdO1xuXG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB2YXIgbGF5ZXIgPSBsYXllcnNbdmFsdWUucmFua107XG4gICAgaWYgKGcuY2hpbGRyZW4gJiYgZy5jaGlsZHJlbih1KS5sZW5ndGggPiAwKSByZXR1cm47XG4gICAgaWYgKCFsYXllcikge1xuICAgICAgbGF5ZXIgPSBsYXllcnNbdmFsdWUucmFua10gPSBbXTtcbiAgICB9XG4gICAgbGF5ZXIucHVzaCh1KTtcbiAgfSk7XG5cbiAgbGF5ZXJzLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBpZiAocmFuZG9tKSB7XG4gICAgICB1dGlsLnNodWZmbGUobGF5ZXIpO1xuICAgIH1cbiAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHtcbiAgICAgIGcubm9kZSh1KS5vcmRlciA9IGk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHZhciBjYyA9IGNyb3NzQ291bnQoZyk7XG4gIGcuZ3JhcGgoKS5vcmRlckluaXRDQyA9IGNjO1xuICBnLmdyYXBoKCkub3JkZXJDQyA9IE51bWJlci5NQVhfVkFMVUU7XG59XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcbi8qXG4gICAgRGlncmFwaCA9IHJlcXVpcmUoJ2dyYXBobGliJykuRGlncmFwaCxcbiAgICB0b3Bzb3J0ID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5hbGcudG9wc29ydCxcbiAgICBub2Rlc0Zyb21MaXN0ID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5maWx0ZXIubm9kZXNGcm9tTGlzdDtcbiovXG5cbm1vZHVsZS5leHBvcnRzID0gc29ydExheWVyO1xuXG4vKlxuZnVuY3Rpb24gc29ydExheWVyKGcsIGNnLCB3ZWlnaHRzKSB7XG4gIHZhciByZXN1bHQgPSBzb3J0TGF5ZXJTdWJncmFwaChnLCBudWxsLCBjZywgd2VpZ2h0cyk7XG4gIHJlc3VsdC5saXN0LmZvckVhY2goZnVuY3Rpb24odSwgaSkge1xuICAgIGcubm9kZSh1KS5vcmRlciA9IGk7XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0LmNvbnN0cmFpbnRHcmFwaDtcbn1cbiovXG5cbmZ1bmN0aW9uIHNvcnRMYXllcihnLCBjZywgd2VpZ2h0cykge1xuICB2YXIgb3JkZXJpbmcgPSBbXTtcbiAgdmFyIGJzID0ge307XG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICBvcmRlcmluZ1t2YWx1ZS5vcmRlcl0gPSB1O1xuICAgIHZhciB3cyA9IHdlaWdodHNbdV07XG4gICAgaWYgKHdzLmxlbmd0aCkge1xuICAgICAgYnNbdV0gPSB1dGlsLnN1bSh3cykgLyB3cy5sZW5ndGg7XG4gICAgfVxuICB9KTtcblxuICB2YXIgdG9Tb3J0ID0gZy5ub2RlcygpLmZpbHRlcihmdW5jdGlvbih1KSB7IHJldHVybiBic1t1XSAhPT0gdW5kZWZpbmVkOyB9KTtcbiAgdG9Tb3J0LnNvcnQoZnVuY3Rpb24oeCwgeSkge1xuICAgIHJldHVybiBic1t4XSAtIGJzW3ldIHx8IGcubm9kZSh4KS5vcmRlciAtIGcubm9kZSh5KS5vcmRlcjtcbiAgfSk7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSAwLCBqbCA9IHRvU29ydC5sZW5ndGg7IGogPCBqbDsgKytpKSB7XG4gICAgaWYgKGJzW29yZGVyaW5nW2ldXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLm5vZGUodG9Tb3J0W2orK10pLm9yZGVyID0gaTtcbiAgICB9XG4gIH1cbn1cblxuLy8gVE9PRDogcmUtZW5hYmxlIGNvbnN0cmFpbmVkIHNvcnRpbmcgb25jZSB3ZSBoYXZlIGEgc3RyYXRlZ3kgZm9yIGhhbmRsaW5nXG4vLyB1bmRlZmluZWQgYmFyeWNlbnRlcnMuXG4vKlxuZnVuY3Rpb24gc29ydExheWVyU3ViZ3JhcGgoZywgc2csIGNnLCB3ZWlnaHRzKSB7XG4gIGNnID0gY2cgPyBjZy5maWx0ZXJOb2Rlcyhub2Rlc0Zyb21MaXN0KGcuY2hpbGRyZW4oc2cpKSkgOiBuZXcgRGlncmFwaCgpO1xuXG4gIHZhciBub2RlRGF0YSA9IHt9O1xuICBnLmNoaWxkcmVuKHNnKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICBpZiAoZy5jaGlsZHJlbih1KS5sZW5ndGgpIHtcbiAgICAgIG5vZGVEYXRhW3VdID0gc29ydExheWVyU3ViZ3JhcGgoZywgdSwgY2csIHdlaWdodHMpO1xuICAgICAgbm9kZURhdGFbdV0uZmlyc3RTRyA9IHU7XG4gICAgICBub2RlRGF0YVt1XS5sYXN0U0cgPSB1O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgd3MgPSB3ZWlnaHRzW3VdO1xuICAgICAgbm9kZURhdGFbdV0gPSB7XG4gICAgICAgIGRlZ3JlZTogd3MubGVuZ3RoLFxuICAgICAgICBiYXJ5Y2VudGVyOiB3cy5sZW5ndGggPiAwID8gdXRpbC5zdW0od3MpIC8gd3MubGVuZ3RoIDogMCxcbiAgICAgICAgbGlzdDogW3VdXG4gICAgICB9O1xuICAgIH1cbiAgfSk7XG5cbiAgcmVzb2x2ZVZpb2xhdGVkQ29uc3RyYWludHMoZywgY2csIG5vZGVEYXRhKTtcblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG5vZGVEYXRhKTtcbiAga2V5cy5zb3J0KGZ1bmN0aW9uKHgsIHkpIHtcbiAgICByZXR1cm4gbm9kZURhdGFbeF0uYmFyeWNlbnRlciAtIG5vZGVEYXRhW3ldLmJhcnljZW50ZXI7XG4gIH0pO1xuXG4gIHZhciByZXN1bHQgPSAga2V5cy5tYXAoZnVuY3Rpb24odSkgeyByZXR1cm4gbm9kZURhdGFbdV07IH0pXG4gICAgICAgICAgICAgICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24obGhzLCByaHMpIHsgcmV0dXJuIG1lcmdlTm9kZURhdGEoZywgbGhzLCByaHMpOyB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLypcbmZ1bmN0aW9uIG1lcmdlTm9kZURhdGEoZywgbGhzLCByaHMpIHtcbiAgdmFyIGNnID0gbWVyZ2VEaWdyYXBocyhsaHMuY29uc3RyYWludEdyYXBoLCByaHMuY29uc3RyYWludEdyYXBoKTtcblxuICBpZiAobGhzLmxhc3RTRyAhPT0gdW5kZWZpbmVkICYmIHJocy5maXJzdFNHICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoY2cgPT09IHVuZGVmaW5lZCkge1xuICAgICAgY2cgPSBuZXcgRGlncmFwaCgpO1xuICAgIH1cbiAgICBpZiAoIWNnLmhhc05vZGUobGhzLmxhc3RTRykpIHsgY2cuYWRkTm9kZShsaHMubGFzdFNHKTsgfVxuICAgIGNnLmFkZE5vZGUocmhzLmZpcnN0U0cpO1xuICAgIGNnLmFkZEVkZ2UobnVsbCwgbGhzLmxhc3RTRywgcmhzLmZpcnN0U0cpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBkZWdyZWU6IGxocy5kZWdyZWUgKyByaHMuZGVncmVlLFxuICAgIGJhcnljZW50ZXI6IChsaHMuYmFyeWNlbnRlciAqIGxocy5kZWdyZWUgKyByaHMuYmFyeWNlbnRlciAqIHJocy5kZWdyZWUpIC9cbiAgICAgICAgICAgICAgICAobGhzLmRlZ3JlZSArIHJocy5kZWdyZWUpLFxuICAgIGxpc3Q6IGxocy5saXN0LmNvbmNhdChyaHMubGlzdCksXG4gICAgZmlyc3RTRzogbGhzLmZpcnN0U0cgIT09IHVuZGVmaW5lZCA/IGxocy5maXJzdFNHIDogcmhzLmZpcnN0U0csXG4gICAgbGFzdFNHOiByaHMubGFzdFNHICE9PSB1bmRlZmluZWQgPyByaHMubGFzdFNHIDogbGhzLmxhc3RTRyxcbiAgICBjb25zdHJhaW50R3JhcGg6IGNnXG4gIH07XG59XG5cbmZ1bmN0aW9uIG1lcmdlRGlncmFwaHMobGhzLCByaHMpIHtcbiAgaWYgKGxocyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gcmhzO1xuICBpZiAocmhzID09PSB1bmRlZmluZWQpIHJldHVybiBsaHM7XG5cbiAgbGhzID0gbGhzLmNvcHkoKTtcbiAgcmhzLm5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbih1KSB7IGxocy5hZGROb2RlKHUpOyB9KTtcbiAgcmhzLmVkZ2VzKCkuZm9yRWFjaChmdW5jdGlvbihlLCB1LCB2KSB7IGxocy5hZGRFZGdlKG51bGwsIHUsIHYpOyB9KTtcbiAgcmV0dXJuIGxocztcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZpb2xhdGVkQ29uc3RyYWludHMoZywgY2csIG5vZGVEYXRhKSB7XG4gIC8vIFJlbW92ZXMgbm9kZXMgYHVgIGFuZCBgdmAgZnJvbSBgY2dgIGFuZCBtYWtlcyBhbnkgZWRnZXMgaW5jaWRlbnQgb24gdGhlbVxuICAvLyBpbmNpZGVudCBvbiBgd2AgaW5zdGVhZC5cbiAgZnVuY3Rpb24gY29sbGFwc2VOb2Rlcyh1LCB2LCB3KSB7XG4gICAgLy8gVE9ETyBvcmlnaW5hbCBwYXBlciByZW1vdmVzIHNlbGYgbG9vcHMsIGJ1dCBpdCBpcyBub3Qgb2J2aW91cyB3aGVuIHRoaXMgd291bGQgaGFwcGVuXG4gICAgY2cuaW5FZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgIGNnLmRlbEVkZ2UoZSk7XG4gICAgICBjZy5hZGRFZGdlKG51bGwsIGNnLnNvdXJjZShlKSwgdyk7XG4gICAgfSk7XG5cbiAgICBjZy5vdXRFZGdlcyh2KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgIGNnLmRlbEVkZ2UoZSk7XG4gICAgICBjZy5hZGRFZGdlKG51bGwsIHcsIGNnLnRhcmdldChlKSk7XG4gICAgfSk7XG5cbiAgICBjZy5kZWxOb2RlKHUpO1xuICAgIGNnLmRlbE5vZGUodik7XG4gIH1cblxuICB2YXIgdmlvbGF0ZWQ7XG4gIHdoaWxlICgodmlvbGF0ZWQgPSBmaW5kVmlvbGF0ZWRDb25zdHJhaW50KGNnLCBub2RlRGF0YSkpICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgc291cmNlID0gY2cuc291cmNlKHZpb2xhdGVkKSxcbiAgICAgICAgdGFyZ2V0ID0gY2cudGFyZ2V0KHZpb2xhdGVkKTtcblxuICAgIHZhciB2O1xuICAgIHdoaWxlICgodiA9IGNnLmFkZE5vZGUobnVsbCkpICYmIGcuaGFzTm9kZSh2KSkge1xuICAgICAgY2cuZGVsTm9kZSh2KTtcbiAgICB9XG5cbiAgICAvLyBDb2xsYXBzZSBiYXJ5Y2VudGVyIGFuZCBsaXN0XG4gICAgbm9kZURhdGFbdl0gPSBtZXJnZU5vZGVEYXRhKGcsIG5vZGVEYXRhW3NvdXJjZV0sIG5vZGVEYXRhW3RhcmdldF0pO1xuICAgIGRlbGV0ZSBub2RlRGF0YVtzb3VyY2VdO1xuICAgIGRlbGV0ZSBub2RlRGF0YVt0YXJnZXRdO1xuXG4gICAgY29sbGFwc2VOb2Rlcyhzb3VyY2UsIHRhcmdldCwgdik7XG4gICAgaWYgKGNnLmluY2lkZW50RWRnZXModikubGVuZ3RoID09PSAwKSB7IGNnLmRlbE5vZGUodik7IH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kVmlvbGF0ZWRDb25zdHJhaW50KGNnLCBub2RlRGF0YSkge1xuICB2YXIgdXMgPSB0b3Bzb3J0KGNnKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB1cy5sZW5ndGg7ICsraSkge1xuICAgIHZhciB1ID0gdXNbaV07XG4gICAgdmFyIGluRWRnZXMgPSBjZy5pbkVkZ2VzKHUpO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgaW5FZGdlcy5sZW5ndGg7ICsraikge1xuICAgICAgdmFyIGUgPSBpbkVkZ2VzW2pdO1xuICAgICAgaWYgKG5vZGVEYXRhW2NnLnNvdXJjZShlKV0uYmFyeWNlbnRlciA+PSBub2RlRGF0YVt1XS5iYXJ5Y2VudGVyKSB7XG4gICAgICAgIHJldHVybiBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuKi9cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbi8qXG4gKiBUaGUgYWxnb3JpdGhtcyBoZXJlIGFyZSBiYXNlZCBvbiBCcmFuZGVzIGFuZCBLw7ZwZiwgXCJGYXN0IGFuZCBTaW1wbGVcbiAqIEhvcml6b250YWwgQ29vcmRpbmF0ZSBBc3NpZ25tZW50XCIuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIC8vIEV4dGVybmFsIGNvbmZpZ3VyYXRpb25cbiAgdmFyIGNvbmZpZyA9IHtcbiAgICBub2RlU2VwOiA1MCxcbiAgICBlZGdlU2VwOiAxMCxcbiAgICB1bml2ZXJzYWxTZXA6IG51bGwsXG4gICAgcmFua1NlcDogMzBcbiAgfTtcblxuICB2YXIgc2VsZiA9IHt9O1xuXG4gIHNlbGYubm9kZVNlcCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdub2RlU2VwJyk7XG4gIHNlbGYuZWRnZVNlcCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdlZGdlU2VwJyk7XG4gIC8vIElmIG5vdCBudWxsIHRoaXMgc2VwYXJhdGlvbiB2YWx1ZSBpcyB1c2VkIGZvciBhbGwgbm9kZXMgYW5kIGVkZ2VzXG4gIC8vIHJlZ2FyZGxlc3Mgb2YgdGhlaXIgd2lkdGhzLiBgbm9kZVNlcGAgYW5kIGBlZGdlU2VwYCBhcmUgaWdub3JlZCB3aXRoIHRoaXNcbiAgLy8gb3B0aW9uLlxuICBzZWxmLnVuaXZlcnNhbFNlcCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICd1bml2ZXJzYWxTZXAnKTtcbiAgc2VsZi5yYW5rU2VwID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ3JhbmtTZXAnKTtcbiAgc2VsZi5kZWJ1Z0xldmVsID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ2RlYnVnTGV2ZWwnKTtcblxuICBzZWxmLnJ1biA9IHJ1bjtcblxuICByZXR1cm4gc2VsZjtcblxuICBmdW5jdGlvbiBydW4oZykge1xuICAgIGcgPSBnLmZpbHRlck5vZGVzKHV0aWwuZmlsdGVyTm9uU3ViZ3JhcGhzKGcpKTtcblxuICAgIHZhciBsYXllcmluZyA9IHV0aWwub3JkZXJpbmcoZyk7XG5cbiAgICB2YXIgY29uZmxpY3RzID0gZmluZENvbmZsaWN0cyhnLCBsYXllcmluZyk7XG5cbiAgICB2YXIgeHNzID0ge307XG4gICAgWyd1JywgJ2QnXS5mb3JFYWNoKGZ1bmN0aW9uKHZlcnREaXIpIHtcbiAgICAgIGlmICh2ZXJ0RGlyID09PSAnZCcpIGxheWVyaW5nLnJldmVyc2UoKTtcblxuICAgICAgWydsJywgJ3InXS5mb3JFYWNoKGZ1bmN0aW9uKGhvcml6RGlyKSB7XG4gICAgICAgIGlmIChob3JpekRpciA9PT0gJ3InKSByZXZlcnNlSW5uZXJPcmRlcihsYXllcmluZyk7XG5cbiAgICAgICAgdmFyIGRpciA9IHZlcnREaXIgKyBob3JpekRpcjtcbiAgICAgICAgdmFyIGFsaWduID0gdmVydGljYWxBbGlnbm1lbnQoZywgbGF5ZXJpbmcsIGNvbmZsaWN0cywgdmVydERpciA9PT0gJ3UnID8gJ3ByZWRlY2Vzc29ycycgOiAnc3VjY2Vzc29ycycpO1xuICAgICAgICB4c3NbZGlyXT0gaG9yaXpvbnRhbENvbXBhY3Rpb24oZywgbGF5ZXJpbmcsIGFsaWduLnBvcywgYWxpZ24ucm9vdCwgYWxpZ24uYWxpZ24pO1xuXG4gICAgICAgIGlmIChjb25maWcuZGVidWdMZXZlbCA+PSAzKVxuICAgICAgICAgIGRlYnVnUG9zaXRpb25pbmcodmVydERpciArIGhvcml6RGlyLCBnLCBsYXllcmluZywgeHNzW2Rpcl0pO1xuXG4gICAgICAgIGlmIChob3JpekRpciA9PT0gJ3InKSBmbGlwSG9yaXpvbnRhbGx5KHhzc1tkaXJdKTtcblxuICAgICAgICBpZiAoaG9yaXpEaXIgPT09ICdyJykgcmV2ZXJzZUlubmVyT3JkZXIobGF5ZXJpbmcpO1xuICAgICAgfSk7XG5cbiAgICAgIGlmICh2ZXJ0RGlyID09PSAnZCcpIGxheWVyaW5nLnJldmVyc2UoKTtcbiAgICB9KTtcblxuICAgIGJhbGFuY2UoZywgbGF5ZXJpbmcsIHhzcyk7XG5cbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHYpIHtcbiAgICAgIHZhciB4cyA9IFtdO1xuICAgICAgZm9yICh2YXIgYWxpZ25tZW50IGluIHhzcykge1xuICAgICAgICB2YXIgYWxpZ25tZW50WCA9IHhzc1thbGlnbm1lbnRdW3ZdO1xuICAgICAgICBwb3NYRGVidWcoYWxpZ25tZW50LCBnLCB2LCBhbGlnbm1lbnRYKTtcbiAgICAgICAgeHMucHVzaChhbGlnbm1lbnRYKTtcbiAgICAgIH1cbiAgICAgIHhzLnNvcnQoZnVuY3Rpb24oeCwgeSkgeyByZXR1cm4geCAtIHk7IH0pO1xuICAgICAgcG9zWChnLCB2LCAoeHNbMV0gKyB4c1syXSkgLyAyKTtcbiAgICB9KTtcblxuICAgIC8vIEFsaWduIHkgY29vcmRpbmF0ZXMgd2l0aCByYW5rc1xuICAgIHZhciB5ID0gMCwgcmV2ZXJzZVkgPSBnLmdyYXBoKCkucmFua0RpciA9PT0gJ0JUJyB8fCBnLmdyYXBoKCkucmFua0RpciA9PT0gJ1JMJztcbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICB2YXIgbWF4SGVpZ2h0ID0gdXRpbC5tYXgobGF5ZXIubWFwKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGhlaWdodChnLCB1KTsgfSkpO1xuICAgICAgeSArPSBtYXhIZWlnaHQgLyAyO1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAgIHBvc1koZywgdSwgcmV2ZXJzZVkgPyAteSA6IHkpO1xuICAgICAgfSk7XG4gICAgICB5ICs9IG1heEhlaWdodCAvIDIgKyBjb25maWcucmFua1NlcDtcbiAgICB9KTtcblxuICAgIC8vIFRyYW5zbGF0ZSBsYXlvdXQgc28gdGhhdCB0b3AgbGVmdCBjb3JuZXIgb2YgYm91bmRpbmcgcmVjdGFuZ2xlIGhhc1xuICAgIC8vIGNvb3JkaW5hdGUgKDAsIDApLlxuICAgIHZhciBtaW5YID0gdXRpbC5taW4oZy5ub2RlcygpLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBwb3NYKGcsIHUpIC0gd2lkdGgoZywgdSkgLyAyOyB9KSk7XG4gICAgdmFyIG1pblkgPSB1dGlsLm1pbihnLm5vZGVzKCkubWFwKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIHBvc1koZywgdSkgLSBoZWlnaHQoZywgdSkgLyAyOyB9KSk7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgICBwb3NYKGcsIHUsIHBvc1goZywgdSkgLSBtaW5YKTtcbiAgICAgIHBvc1koZywgdSwgcG9zWShnLCB1KSAtIG1pblkpO1xuICAgIH0pO1xuICB9XG5cbiAgLypcbiAgICogR2VuZXJhdGUgYW4gSUQgdGhhdCBjYW4gYmUgdXNlZCB0byByZXByZXNlbnQgYW55IHVuZGlyZWN0ZWQgZWRnZSB0aGF0IGlzXG4gICAqIGluY2lkZW50IG9uIGB1YCBhbmQgYHZgLlxuICAgKi9cbiAgZnVuY3Rpb24gdW5kaXJFZGdlSWQodSwgdikge1xuICAgIHJldHVybiB1IDwgdlxuICAgICAgPyB1LnRvU3RyaW5nKCkubGVuZ3RoICsgJzonICsgdSArICctJyArIHZcbiAgICAgIDogdi50b1N0cmluZygpLmxlbmd0aCArICc6JyArIHYgKyAnLScgKyB1O1xuICB9XG5cbiAgZnVuY3Rpb24gZmluZENvbmZsaWN0cyhnLCBsYXllcmluZykge1xuICAgIHZhciBjb25mbGljdHMgPSB7fSwgLy8gU2V0IG9mIGNvbmZsaWN0aW5nIGVkZ2UgaWRzXG4gICAgICAgIHBvcyA9IHt9LCAgICAgICAvLyBQb3NpdGlvbiBvZiBub2RlIGluIGl0cyBsYXllclxuICAgICAgICBwcmV2TGF5ZXIsXG4gICAgICAgIGN1cnJMYXllcixcbiAgICAgICAgazAsICAgICAvLyBQb3NpdGlvbiBvZiB0aGUgbGFzdCBpbm5lciBzZWdtZW50IGluIHRoZSBwcmV2aW91cyBsYXllclxuICAgICAgICBsLCAgICAgIC8vIEN1cnJlbnQgcG9zaXRpb24gaW4gdGhlIGN1cnJlbnQgbGF5ZXIgKGZvciBpdGVyYXRpb24gdXAgdG8gYGwxYClcbiAgICAgICAgazE7ICAgICAvLyBQb3NpdGlvbiBvZiB0aGUgbmV4dCBpbm5lciBzZWdtZW50IGluIHRoZSBwcmV2aW91cyBsYXllciBvclxuICAgICAgICAgICAgICAgIC8vIHRoZSBwb3NpdGlvbiBvZiB0aGUgbGFzdCBlbGVtZW50IGluIHRoZSBwcmV2aW91cyBsYXllclxuXG4gICAgaWYgKGxheWVyaW5nLmxlbmd0aCA8PSAyKSByZXR1cm4gY29uZmxpY3RzO1xuXG4gICAgZnVuY3Rpb24gdXBkYXRlQ29uZmxpY3RzKHYpIHtcbiAgICAgIHZhciBrID0gcG9zW3ZdO1xuICAgICAgaWYgKGsgPCBrMCB8fCBrID4gazEpIHtcbiAgICAgICAgY29uZmxpY3RzW3VuZGlyRWRnZUlkKGN1cnJMYXllcltsXSwgdildID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsYXllcmluZ1sxXS5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHsgcG9zW3VdID0gaTsgfSk7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsYXllcmluZy5sZW5ndGggLSAxOyArK2kpIHtcbiAgICAgIHByZXZMYXllciA9IGxheWVyaW5nW2ldO1xuICAgICAgY3VyckxheWVyID0gbGF5ZXJpbmdbaSsxXTtcbiAgICAgIGswID0gMDtcbiAgICAgIGwgPSAwO1xuXG4gICAgICAvLyBTY2FuIGN1cnJlbnQgbGF5ZXIgZm9yIG5leHQgbm9kZSB0aGF0IGlzIGluY2lkZW50IHRvIGFuIGlubmVyIHNlZ2VtZW50XG4gICAgICAvLyBiZXR3ZWVuIGxheWVyaW5nW2krMV0gYW5kIGxheWVyaW5nW2ldLlxuICAgICAgZm9yICh2YXIgbDEgPSAwOyBsMSA8IGN1cnJMYXllci5sZW5ndGg7ICsrbDEpIHtcbiAgICAgICAgdmFyIHUgPSBjdXJyTGF5ZXJbbDFdOyAvLyBOZXh0IGlubmVyIHNlZ21lbnQgaW4gdGhlIGN1cnJlbnQgbGF5ZXIgb3JcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBsYXN0IG5vZGUgaW4gdGhlIGN1cnJlbnQgbGF5ZXJcbiAgICAgICAgcG9zW3VdID0gbDE7XG4gICAgICAgIGsxID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChnLm5vZGUodSkuZHVtbXkpIHtcbiAgICAgICAgICB2YXIgdVByZWQgPSBnLnByZWRlY2Vzc29ycyh1KVswXTtcbiAgICAgICAgICAvLyBOb3RlOiBJbiB0aGUgY2FzZSBvZiBzZWxmIGxvb3BzIGFuZCBzaWRld2F5cyBlZGdlcyBpdCBpcyBwb3NzaWJsZVxuICAgICAgICAgIC8vIGZvciBhIGR1bW15IG5vdCB0byBoYXZlIGEgcHJlZGVjZXNzb3IuXG4gICAgICAgICAgaWYgKHVQcmVkICE9PSB1bmRlZmluZWQgJiYgZy5ub2RlKHVQcmVkKS5kdW1teSlcbiAgICAgICAgICAgIGsxID0gcG9zW3VQcmVkXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoazEgPT09IHVuZGVmaW5lZCAmJiBsMSA9PT0gY3VyckxheWVyLmxlbmd0aCAtIDEpXG4gICAgICAgICAgazEgPSBwcmV2TGF5ZXIubGVuZ3RoIC0gMTtcblxuICAgICAgICBpZiAoazEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGZvciAoOyBsIDw9IGwxOyArK2wpIHtcbiAgICAgICAgICAgIGcucHJlZGVjZXNzb3JzKGN1cnJMYXllcltsXSkuZm9yRWFjaCh1cGRhdGVDb25mbGljdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBrMCA9IGsxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbmZsaWN0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIHZlcnRpY2FsQWxpZ25tZW50KGcsIGxheWVyaW5nLCBjb25mbGljdHMsIHJlbGF0aW9uc2hpcCkge1xuICAgIHZhciBwb3MgPSB7fSwgICAvLyBQb3NpdGlvbiBmb3IgYSBub2RlIGluIGl0cyBsYXllclxuICAgICAgICByb290ID0ge30sICAvLyBSb290IG9mIHRoZSBibG9jayB0aGF0IHRoZSBub2RlIHBhcnRpY2lwYXRlcyBpblxuICAgICAgICBhbGlnbiA9IHt9OyAvLyBQb2ludHMgdG8gdGhlIG5leHQgbm9kZSBpbiB0aGUgYmxvY2sgb3IsIGlmIHRoZSBsYXN0XG4gICAgICAgICAgICAgICAgICAgIC8vIGVsZW1lbnQgaW4gdGhlIGJsb2NrLCBwb2ludHMgdG8gdGhlIGZpcnN0IGJsb2NrJ3Mgcm9vdFxuXG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7XG4gICAgICAgIHJvb3RbdV0gPSB1O1xuICAgICAgICBhbGlnblt1XSA9IHU7XG4gICAgICAgIHBvc1t1XSA9IGk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIHZhciBwcmV2SWR4ID0gLTE7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdmFyIHJlbGF0ZWQgPSBnW3JlbGF0aW9uc2hpcF0odiksIC8vIEFkamFjZW50IG5vZGVzIGZyb20gdGhlIHByZXZpb3VzIGxheWVyXG4gICAgICAgICAgICBtaWQ7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGUgbWlkIHBvaW50IGluIHRoZSByZWxhdGVkIGFycmF5XG5cbiAgICAgICAgaWYgKHJlbGF0ZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJlbGF0ZWQuc29ydChmdW5jdGlvbih4LCB5KSB7IHJldHVybiBwb3NbeF0gLSBwb3NbeV07IH0pO1xuICAgICAgICAgIG1pZCA9IChyZWxhdGVkLmxlbmd0aCAtIDEpIC8gMjtcbiAgICAgICAgICByZWxhdGVkLnNsaWNlKE1hdGguZmxvb3IobWlkKSwgTWF0aC5jZWlsKG1pZCkgKyAxKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgICAgICAgIGlmIChhbGlnblt2XSA9PT0gdikge1xuICAgICAgICAgICAgICBpZiAoIWNvbmZsaWN0c1t1bmRpckVkZ2VJZCh1LCB2KV0gJiYgcHJldklkeCA8IHBvc1t1XSkge1xuICAgICAgICAgICAgICAgIGFsaWduW3VdID0gdjtcbiAgICAgICAgICAgICAgICBhbGlnblt2XSA9IHJvb3Rbdl0gPSByb290W3VdO1xuICAgICAgICAgICAgICAgIHByZXZJZHggPSBwb3NbdV07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyBwb3M6IHBvcywgcm9vdDogcm9vdCwgYWxpZ246IGFsaWduIH07XG4gIH1cblxuICAvLyBUaGlzIGZ1bmN0aW9uIGRldmlhdGVzIGZyb20gdGhlIHN0YW5kYXJkIEJLIGFsZ29yaXRobSBpbiB0d28gd2F5cy4gRmlyc3RcbiAgLy8gaXQgdGFrZXMgaW50byBhY2NvdW50IHRoZSBzaXplIG9mIHRoZSBub2Rlcy4gU2Vjb25kIGl0IGluY2x1ZGVzIGEgZml4IHRvXG4gIC8vIHRoZSBvcmlnaW5hbCBhbGdvcml0aG0gdGhhdCBpcyBkZXNjcmliZWQgaW4gQ2Fyc3RlbnMsIFwiTm9kZSBhbmQgTGFiZWxcbiAgLy8gUGxhY2VtZW50IGluIGEgTGF5ZXJlZCBMYXlvdXQgQWxnb3JpdGhtXCIuXG4gIGZ1bmN0aW9uIGhvcml6b250YWxDb21wYWN0aW9uKGcsIGxheWVyaW5nLCBwb3MsIHJvb3QsIGFsaWduKSB7XG4gICAgdmFyIHNpbmsgPSB7fSwgICAgICAgLy8gTWFwcGluZyBvZiBub2RlIGlkIC0+IHNpbmsgbm9kZSBpZCBmb3IgY2xhc3NcbiAgICAgICAgbWF5YmVTaGlmdCA9IHt9LCAvLyBNYXBwaW5nIG9mIHNpbmsgbm9kZSBpZCAtPiB7IGNsYXNzIG5vZGUgaWQsIG1pbiBzaGlmdCB9XG4gICAgICAgIHNoaWZ0ID0ge30sICAgICAgLy8gTWFwcGluZyBvZiBzaW5rIG5vZGUgaWQgLT4gc2hpZnRcbiAgICAgICAgcHJlZCA9IHt9LCAgICAgICAvLyBNYXBwaW5nIG9mIG5vZGUgaWQgLT4gcHJlZGVjZXNzb3Igbm9kZSAob3IgbnVsbClcbiAgICAgICAgeHMgPSB7fTsgICAgICAgICAvLyBDYWxjdWxhdGVkIFggcG9zaXRpb25zXG5cbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHtcbiAgICAgICAgc2lua1t1XSA9IHU7XG4gICAgICAgIG1heWJlU2hpZnRbdV0gPSB7fTtcbiAgICAgICAgaWYgKGkgPiAwKVxuICAgICAgICAgIHByZWRbdV0gPSBsYXllcltpIC0gMV07XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZVNoaWZ0KHRvU2hpZnQsIG5laWdoYm9yLCBkZWx0YSkge1xuICAgICAgaWYgKCEobmVpZ2hib3IgaW4gbWF5YmVTaGlmdFt0b1NoaWZ0XSkpIHtcbiAgICAgICAgbWF5YmVTaGlmdFt0b1NoaWZ0XVtuZWlnaGJvcl0gPSBkZWx0YTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1heWJlU2hpZnRbdG9TaGlmdF1bbmVpZ2hib3JdID0gTWF0aC5taW4obWF5YmVTaGlmdFt0b1NoaWZ0XVtuZWlnaGJvcl0sIGRlbHRhKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwbGFjZUJsb2NrKHYpIHtcbiAgICAgIGlmICghKHYgaW4geHMpKSB7XG4gICAgICAgIHhzW3ZdID0gMDtcbiAgICAgICAgdmFyIHcgPSB2O1xuICAgICAgICBkbyB7XG4gICAgICAgICAgaWYgKHBvc1t3XSA+IDApIHtcbiAgICAgICAgICAgIHZhciB1ID0gcm9vdFtwcmVkW3ddXTtcbiAgICAgICAgICAgIHBsYWNlQmxvY2sodSk7XG4gICAgICAgICAgICBpZiAoc2lua1t2XSA9PT0gdikge1xuICAgICAgICAgICAgICBzaW5rW3ZdID0gc2lua1t1XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBkZWx0YSA9IHNlcChnLCBwcmVkW3ddKSArIHNlcChnLCB3KTtcbiAgICAgICAgICAgIGlmIChzaW5rW3ZdICE9PSBzaW5rW3VdKSB7XG4gICAgICAgICAgICAgIHVwZGF0ZVNoaWZ0KHNpbmtbdV0sIHNpbmtbdl0sIHhzW3ZdIC0geHNbdV0gLSBkZWx0YSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB4c1t2XSA9IE1hdGgubWF4KHhzW3ZdLCB4c1t1XSArIGRlbHRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdyA9IGFsaWduW3ddO1xuICAgICAgICB9IHdoaWxlICh3ICE9PSB2KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSb290IGNvb3JkaW5hdGVzIHJlbGF0aXZlIHRvIHNpbmtcbiAgICB1dGlsLnZhbHVlcyhyb290KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIHBsYWNlQmxvY2sodik7XG4gICAgfSk7XG5cbiAgICAvLyBBYnNvbHV0ZSBjb29yZGluYXRlc1xuICAgIC8vIFRoZXJlIGlzIGFuIGFzc3VtcHRpb24gaGVyZSB0aGF0IHdlJ3ZlIHJlc29sdmVkIHNoaWZ0cyBmb3IgYW55IGNsYXNzZXNcbiAgICAvLyB0aGF0IGJlZ2luIGF0IGFuIGVhcmxpZXIgbGF5ZXIuIFdlIGd1YXJhbnRlZSB0aGlzIGJ5IHZpc2l0aW5nIGxheWVycyBpblxuICAgIC8vIG9yZGVyLlxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgICB4c1t2XSA9IHhzW3Jvb3Rbdl1dO1xuICAgICAgICBpZiAodiA9PT0gcm9vdFt2XSAmJiB2ID09PSBzaW5rW3ZdKSB7XG4gICAgICAgICAgdmFyIG1pblNoaWZ0ID0gMDtcbiAgICAgICAgICBpZiAodiBpbiBtYXliZVNoaWZ0ICYmIE9iamVjdC5rZXlzKG1heWJlU2hpZnRbdl0pLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG1pblNoaWZ0ID0gdXRpbC5taW4oT2JqZWN0LmtleXMobWF5YmVTaGlmdFt2XSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24odSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWF5YmVTaGlmdFt2XVt1XSArICh1IGluIHNoaWZ0ID8gc2hpZnRbdV0gOiAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNoaWZ0W3ZdID0gbWluU2hpZnQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgIHhzW3ZdICs9IHNoaWZ0W3Npbmtbcm9vdFt2XV1dIHx8IDA7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB4cztcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRNaW5Db29yZChnLCBsYXllcmluZywgeHMpIHtcbiAgICByZXR1cm4gdXRpbC5taW4obGF5ZXJpbmcubWFwKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICB2YXIgdSA9IGxheWVyWzBdO1xuICAgICAgcmV0dXJuIHhzW3VdO1xuICAgIH0pKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRNYXhDb29yZChnLCBsYXllcmluZywgeHMpIHtcbiAgICByZXR1cm4gdXRpbC5tYXgobGF5ZXJpbmcubWFwKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICB2YXIgdSA9IGxheWVyW2xheWVyLmxlbmd0aCAtIDFdO1xuICAgICAgcmV0dXJuIHhzW3VdO1xuICAgIH0pKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJhbGFuY2UoZywgbGF5ZXJpbmcsIHhzcykge1xuICAgIHZhciBtaW4gPSB7fSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWluIGNvb3JkaW5hdGUgZm9yIHRoZSBhbGlnbm1lbnRcbiAgICAgICAgbWF4ID0ge30sICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1heCBjb29yZGluYXRlIGZvciB0aGUgYWxnaW5tZW50XG4gICAgICAgIHNtYWxsZXN0QWxpZ25tZW50LFxuICAgICAgICBzaGlmdCA9IHt9OyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQW1vdW50IHRvIHNoaWZ0IGEgZ2l2ZW4gYWxpZ25tZW50XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVBbGlnbm1lbnQodikge1xuICAgICAgeHNzW2FsaWdubWVudF1bdl0gKz0gc2hpZnRbYWxpZ25tZW50XTtcbiAgICB9XG5cbiAgICB2YXIgc21hbGxlc3QgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgZm9yICh2YXIgYWxpZ25tZW50IGluIHhzcykge1xuICAgICAgdmFyIHhzID0geHNzW2FsaWdubWVudF07XG4gICAgICBtaW5bYWxpZ25tZW50XSA9IGZpbmRNaW5Db29yZChnLCBsYXllcmluZywgeHMpO1xuICAgICAgbWF4W2FsaWdubWVudF0gPSBmaW5kTWF4Q29vcmQoZywgbGF5ZXJpbmcsIHhzKTtcbiAgICAgIHZhciB3ID0gbWF4W2FsaWdubWVudF0gLSBtaW5bYWxpZ25tZW50XTtcbiAgICAgIGlmICh3IDwgc21hbGxlc3QpIHtcbiAgICAgICAgc21hbGxlc3QgPSB3O1xuICAgICAgICBzbWFsbGVzdEFsaWdubWVudCA9IGFsaWdubWVudDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBEZXRlcm1pbmUgaG93IG11Y2ggdG8gYWRqdXN0IHBvc2l0aW9uaW5nIGZvciBlYWNoIGFsaWdubWVudFxuICAgIFsndScsICdkJ10uZm9yRWFjaChmdW5jdGlvbih2ZXJ0RGlyKSB7XG4gICAgICBbJ2wnLCAnciddLmZvckVhY2goZnVuY3Rpb24oaG9yaXpEaXIpIHtcbiAgICAgICAgdmFyIGFsaWdubWVudCA9IHZlcnREaXIgKyBob3JpekRpcjtcbiAgICAgICAgc2hpZnRbYWxpZ25tZW50XSA9IGhvcml6RGlyID09PSAnbCdcbiAgICAgICAgICAgID8gbWluW3NtYWxsZXN0QWxpZ25tZW50XSAtIG1pblthbGlnbm1lbnRdXG4gICAgICAgICAgICA6IG1heFtzbWFsbGVzdEFsaWdubWVudF0gLSBtYXhbYWxpZ25tZW50XTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gRmluZCBhdmVyYWdlIG9mIG1lZGlhbnMgZm9yIHhzcyBhcnJheVxuICAgIGZvciAoYWxpZ25tZW50IGluIHhzcykge1xuICAgICAgZy5lYWNoTm9kZSh1cGRhdGVBbGlnbm1lbnQpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZsaXBIb3Jpem9udGFsbHkoeHMpIHtcbiAgICBmb3IgKHZhciB1IGluIHhzKSB7XG4gICAgICB4c1t1XSA9IC14c1t1XTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZXZlcnNlSW5uZXJPcmRlcihsYXllcmluZykge1xuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLnJldmVyc2UoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdpZHRoKGcsIHUpIHtcbiAgICBzd2l0Y2ggKGcuZ3JhcGgoKS5yYW5rRGlyKSB7XG4gICAgICBjYXNlICdMUic6IHJldHVybiBnLm5vZGUodSkuaGVpZ2h0O1xuICAgICAgY2FzZSAnUkwnOiByZXR1cm4gZy5ub2RlKHUpLmhlaWdodDtcbiAgICAgIGRlZmF1bHQ6ICAgcmV0dXJuIGcubm9kZSh1KS53aWR0aDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoZWlnaHQoZywgdSkge1xuICAgIHN3aXRjaChnLmdyYXBoKCkucmFua0Rpcikge1xuICAgICAgY2FzZSAnTFInOiByZXR1cm4gZy5ub2RlKHUpLndpZHRoO1xuICAgICAgY2FzZSAnUkwnOiByZXR1cm4gZy5ub2RlKHUpLndpZHRoO1xuICAgICAgZGVmYXVsdDogICByZXR1cm4gZy5ub2RlKHUpLmhlaWdodDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzZXAoZywgdSkge1xuICAgIGlmIChjb25maWcudW5pdmVyc2FsU2VwICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gY29uZmlnLnVuaXZlcnNhbFNlcDtcbiAgICB9XG4gICAgdmFyIHcgPSB3aWR0aChnLCB1KTtcbiAgICB2YXIgcyA9IGcubm9kZSh1KS5kdW1teSA/IGNvbmZpZy5lZGdlU2VwIDogY29uZmlnLm5vZGVTZXA7XG4gICAgcmV0dXJuICh3ICsgcykgLyAyO1xuICB9XG5cbiAgZnVuY3Rpb24gcG9zWChnLCB1LCB4KSB7XG4gICAgaWYgKGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnTFInIHx8IGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnUkwnKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KS55O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpLnkgPSB4O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KS54O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpLnggPSB4O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc1hEZWJ1ZyhuYW1lLCBnLCB1LCB4KSB7XG4gICAgaWYgKGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnTFInIHx8IGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnUkwnKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KVtuYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KVtuYW1lXSA9IHg7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpW25hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpW25hbWVdID0geDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwb3NZKGcsIHUsIHkpIHtcbiAgICBpZiAoZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdMUicgfHwgZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdSTCcpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpLng7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSkueCA9IHk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICByZXR1cm4gZy5ub2RlKHUpLnk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSkueSA9IHk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVidWdQb3NpdGlvbmluZyhhbGlnbiwgZywgbGF5ZXJpbmcsIHhzKSB7XG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsLCBsaSkge1xuICAgICAgdmFyIHUsIHhVO1xuICAgICAgbC5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdmFyIHhWID0geHNbdl07XG4gICAgICAgIGlmICh1KSB7XG4gICAgICAgICAgdmFyIHMgPSBzZXAoZywgdSkgKyBzZXAoZywgdik7XG4gICAgICAgICAgaWYgKHhWIC0geFUgPCBzKVxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1Bvc2l0aW9uIHBoYXNlOiBzZXAgdmlvbGF0aW9uLiBBbGlnbjogJyArIGFsaWduICsgJy4gTGF5ZXI6ICcgKyBsaSArICcuICcgK1xuICAgICAgICAgICAgICAnVTogJyArIHUgKyAnIFY6ICcgKyB2ICsgJy4gQWN0dWFsIHNlcDogJyArICh4ViAtIHhVKSArICcgRXhwZWN0ZWQgc2VwOiAnICsgcyk7XG4gICAgICAgIH1cbiAgICAgICAgdSA9IHY7XG4gICAgICAgIHhVID0geFY7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgYWN5Y2xpYyA9IHJlcXVpcmUoJy4vcmFuay9hY3ljbGljJyksXG4gICAgaW5pdFJhbmsgPSByZXF1aXJlKCcuL3JhbmsvaW5pdFJhbmsnKSxcbiAgICBmZWFzaWJsZVRyZWUgPSByZXF1aXJlKCcuL3JhbmsvZmVhc2libGVUcmVlJyksXG4gICAgY29uc3RyYWludHMgPSByZXF1aXJlKCcuL3JhbmsvY29uc3RyYWludHMnKSxcbiAgICBzaW1wbGV4ID0gcmVxdWlyZSgnLi9yYW5rL3NpbXBsZXgnKSxcbiAgICBjb21wb25lbnRzID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5hbGcuY29tcG9uZW50cyxcbiAgICBmaWx0ZXIgPSByZXF1aXJlKCdncmFwaGxpYicpLmZpbHRlcjtcblxuZXhwb3J0cy5ydW4gPSBydW47XG5leHBvcnRzLnJlc3RvcmVFZGdlcyA9IHJlc3RvcmVFZGdlcztcblxuLypcbiAqIEhldXJpc3RpYyBmdW5jdGlvbiB0aGF0IGFzc2lnbnMgYSByYW5rIHRvIGVhY2ggbm9kZSBvZiB0aGUgaW5wdXQgZ3JhcGggd2l0aFxuICogdGhlIGludGVudCBvZiBtaW5pbWl6aW5nIGVkZ2UgbGVuZ3Rocywgd2hpbGUgcmVzcGVjdGluZyB0aGUgYG1pbkxlbmBcbiAqIGF0dHJpYnV0ZSBvZiBpbmNpZGVudCBlZGdlcy5cbiAqXG4gKiBQcmVyZXF1aXNpdGVzOlxuICpcbiAqICAqIEVhY2ggZWRnZSBpbiB0aGUgaW5wdXQgZ3JhcGggbXVzdCBoYXZlIGFuIGFzc2lnbmVkICdtaW5MZW4nIGF0dHJpYnV0ZVxuICovXG5mdW5jdGlvbiBydW4oZywgdXNlU2ltcGxleCkge1xuICBleHBhbmRTZWxmTG9vcHMoZyk7XG5cbiAgLy8gSWYgdGhlcmUgYXJlIHJhbmsgY29uc3RyYWludHMgb24gbm9kZXMsIHRoZW4gYnVpbGQgYSBuZXcgZ3JhcGggdGhhdFxuICAvLyBlbmNvZGVzIHRoZSBjb25zdHJhaW50cy5cbiAgdXRpbC50aW1lKCdjb25zdHJhaW50cy5hcHBseScsIGNvbnN0cmFpbnRzLmFwcGx5KShnKTtcblxuICBleHBhbmRTaWRld2F5c0VkZ2VzKGcpO1xuXG4gIC8vIFJldmVyc2UgZWRnZXMgdG8gZ2V0IGFuIGFjeWNsaWMgZ3JhcGgsIHdlIGtlZXAgdGhlIGdyYXBoIGluIGFuIGFjeWNsaWNcbiAgLy8gc3RhdGUgdW50aWwgdGhlIHZlcnkgZW5kLlxuICB1dGlsLnRpbWUoJ2FjeWNsaWMnLCBhY3ljbGljKShnKTtcblxuICAvLyBDb252ZXJ0IHRoZSBncmFwaCBpbnRvIGEgZmxhdCBncmFwaCBmb3IgcmFua2luZ1xuICB2YXIgZmxhdEdyYXBoID0gZy5maWx0ZXJOb2Rlcyh1dGlsLmZpbHRlck5vblN1YmdyYXBocyhnKSk7XG5cbiAgLy8gQXNzaWduIGFuIGluaXRpYWwgcmFua2luZyB1c2luZyBERlMuXG4gIGluaXRSYW5rKGZsYXRHcmFwaCk7XG5cbiAgLy8gRm9yIGVhY2ggY29tcG9uZW50IGltcHJvdmUgdGhlIGFzc2lnbmVkIHJhbmtzLlxuICBjb21wb25lbnRzKGZsYXRHcmFwaCkuZm9yRWFjaChmdW5jdGlvbihjbXB0KSB7XG4gICAgdmFyIHN1YmdyYXBoID0gZmxhdEdyYXBoLmZpbHRlck5vZGVzKGZpbHRlci5ub2Rlc0Zyb21MaXN0KGNtcHQpKTtcbiAgICByYW5rQ29tcG9uZW50KHN1YmdyYXBoLCB1c2VTaW1wbGV4KTtcbiAgfSk7XG5cbiAgLy8gUmVsYXggb3JpZ2luYWwgY29uc3RyYWludHNcbiAgdXRpbC50aW1lKCdjb25zdHJhaW50cy5yZWxheCcsIGNvbnN0cmFpbnRzLnJlbGF4KGcpKTtcblxuICAvLyBXaGVuIGhhbmRsaW5nIG5vZGVzIHdpdGggY29uc3RyYWluZWQgcmFua3MgaXQgaXMgcG9zc2libGUgdG8gZW5kIHVwIHdpdGhcbiAgLy8gZWRnZXMgdGhhdCBwb2ludCB0byBwcmV2aW91cyByYW5rcy4gTW9zdCBvZiB0aGUgc3Vic2VxdWVudCBhbGdvcml0aG1zIGFzc3VtZVxuICAvLyB0aGF0IGVkZ2VzIGFyZSBwb2ludGluZyB0byBzdWNjZXNzaXZlIHJhbmtzIG9ubHkuIEhlcmUgd2UgcmV2ZXJzZSBhbnkgXCJiYWNrXG4gIC8vIGVkZ2VzXCIgYW5kIG1hcmsgdGhlbSBhcyBzdWNoLiBUaGUgYWN5Y2xpYyBhbGdvcml0aG0gd2lsbCByZXZlcnNlIHRoZW0gYXMgYVxuICAvLyBwb3N0IHByb2Nlc3Npbmcgc3RlcC5cbiAgdXRpbC50aW1lKCdyZW9yaWVudEVkZ2VzJywgcmVvcmllbnRFZGdlcykoZyk7XG59XG5cbmZ1bmN0aW9uIHJlc3RvcmVFZGdlcyhnKSB7XG4gIGFjeWNsaWMudW5kbyhnKTtcbn1cblxuLypcbiAqIEV4cGFuZCBzZWxmIGxvb3BzIGludG8gdGhyZWUgZHVtbXkgbm9kZXMuIE9uZSB3aWxsIHNpdCBhYm92ZSB0aGUgaW5jaWRlbnRcbiAqIG5vZGUsIG9uZSB3aWxsIGJlIGF0IHRoZSBzYW1lIGxldmVsLCBhbmQgb25lIGJlbG93LiBUaGUgcmVzdWx0IGxvb2tzIGxpa2U6XG4gKlxuICogICAgICAgICAvLS08LS14LS0tPi0tXFxcbiAqICAgICBub2RlICAgICAgICAgICAgICB5XG4gKiAgICAgICAgIFxcLS08LS16LS0tPi0tL1xuICpcbiAqIER1bW15IG5vZGVzIHgsIHksIHogZ2l2ZSB1cyB0aGUgc2hhcGUgb2YgYSBsb29wIGFuZCBub2RlIHkgaXMgd2hlcmUgd2UgcGxhY2VcbiAqIHRoZSBsYWJlbC5cbiAqXG4gKiBUT0RPOiBjb25zb2xpZGF0ZSBrbm93bGVkZ2Ugb2YgZHVtbXkgbm9kZSBjb25zdHJ1Y3Rpb24uXG4gKiBUT0RPOiBzdXBwb3J0IG1pbkxlbiA9IDJcbiAqL1xuZnVuY3Rpb24gZXhwYW5kU2VsZkxvb3BzKGcpIHtcbiAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCBhKSB7XG4gICAgaWYgKHUgPT09IHYpIHtcbiAgICAgIHZhciB4ID0gYWRkRHVtbXlOb2RlKGcsIGUsIHUsIHYsIGEsIDAsIGZhbHNlKSxcbiAgICAgICAgICB5ID0gYWRkRHVtbXlOb2RlKGcsIGUsIHUsIHYsIGEsIDEsIHRydWUpLFxuICAgICAgICAgIHogPSBhZGREdW1teU5vZGUoZywgZSwgdSwgdiwgYSwgMiwgZmFsc2UpO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHgsIHUsIHttaW5MZW46IDEsIHNlbGZMb29wOiB0cnVlfSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgeCwgeSwge21pbkxlbjogMSwgc2VsZkxvb3A6IHRydWV9KTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB6LCB7bWluTGVuOiAxLCBzZWxmTG9vcDogdHJ1ZX0pO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHksIHosIHttaW5MZW46IDEsIHNlbGZMb29wOiB0cnVlfSk7XG4gICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gZXhwYW5kU2lkZXdheXNFZGdlcyhnKSB7XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgYSkge1xuICAgIGlmICh1ID09PSB2KSB7XG4gICAgICB2YXIgb3JpZ0VkZ2UgPSBhLm9yaWdpbmFsRWRnZSxcbiAgICAgICAgICBkdW1teSA9IGFkZER1bW15Tm9kZShnLCBvcmlnRWRnZS5lLCBvcmlnRWRnZS51LCBvcmlnRWRnZS52LCBvcmlnRWRnZS52YWx1ZSwgMCwgdHJ1ZSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgZHVtbXksIHttaW5MZW46IDF9KTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCBkdW1teSwgdiwge21pbkxlbjogMX0pO1xuICAgICAgZy5kZWxFZGdlKGUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGFkZER1bW15Tm9kZShnLCBlLCB1LCB2LCBhLCBpbmRleCwgaXNMYWJlbCkge1xuICByZXR1cm4gZy5hZGROb2RlKG51bGwsIHtcbiAgICB3aWR0aDogaXNMYWJlbCA/IGEud2lkdGggOiAwLFxuICAgIGhlaWdodDogaXNMYWJlbCA/IGEuaGVpZ2h0IDogMCxcbiAgICBlZGdlOiB7IGlkOiBlLCBzb3VyY2U6IHUsIHRhcmdldDogdiwgYXR0cnM6IGEgfSxcbiAgICBkdW1teTogdHJ1ZSxcbiAgICBpbmRleDogaW5kZXhcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlb3JpZW50RWRnZXMoZykge1xuICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgaWYgKGcubm9kZSh1KS5yYW5rID4gZy5ub2RlKHYpLnJhbmspIHtcbiAgICAgIGcuZGVsRWRnZShlKTtcbiAgICAgIHZhbHVlLnJldmVyc2VkID0gdHJ1ZTtcbiAgICAgIGcuYWRkRWRnZShlLCB2LCB1LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmFua0NvbXBvbmVudChzdWJncmFwaCwgdXNlU2ltcGxleCkge1xuICB2YXIgc3Bhbm5pbmdUcmVlID0gZmVhc2libGVUcmVlKHN1YmdyYXBoKTtcblxuICBpZiAodXNlU2ltcGxleCkge1xuICAgIHV0aWwubG9nKDEsICdVc2luZyBuZXR3b3JrIHNpbXBsZXggZm9yIHJhbmtpbmcnKTtcbiAgICBzaW1wbGV4KHN1YmdyYXBoLCBzcGFubmluZ1RyZWUpO1xuICB9XG4gIG5vcm1hbGl6ZShzdWJncmFwaCk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZShnKSB7XG4gIHZhciBtID0gdXRpbC5taW4oZy5ub2RlcygpLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBnLm5vZGUodSkucmFuazsgfSkpO1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIG5vZGUpIHsgbm9kZS5yYW5rIC09IG07IH0pO1xufVxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gYWN5Y2xpYztcbm1vZHVsZS5leHBvcnRzLnVuZG8gPSB1bmRvO1xuXG4vKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhIGRpcmVjdGVkIGdyYXBoIHRoYXQgbWF5IGhhdmUgY3ljbGVzIGFuZCByZXZlcnNlcyBlZGdlc1xuICogYXMgYXBwcm9wcmlhdGUgdG8gYnJlYWsgdGhlc2UgY3ljbGVzLiBFYWNoIHJldmVyc2VkIGVkZ2UgaXMgYXNzaWduZWQgYVxuICogYHJldmVyc2VkYCBhdHRyaWJ1dGUgd2l0aCB0aGUgdmFsdWUgYHRydWVgLlxuICpcbiAqIFRoZXJlIHNob3VsZCBiZSBubyBzZWxmIGxvb3BzIGluIHRoZSBncmFwaC5cbiAqL1xuZnVuY3Rpb24gYWN5Y2xpYyhnKSB7XG4gIHZhciBvblN0YWNrID0ge30sXG4gICAgICB2aXNpdGVkID0ge30sXG4gICAgICByZXZlcnNlQ291bnQgPSAwO1xuICBcbiAgZnVuY3Rpb24gZGZzKHUpIHtcbiAgICBpZiAodSBpbiB2aXNpdGVkKSByZXR1cm47XG4gICAgdmlzaXRlZFt1XSA9IG9uU3RhY2tbdV0gPSB0cnVlO1xuICAgIGcub3V0RWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICB2YXIgdCA9IGcudGFyZ2V0KGUpLFxuICAgICAgICAgIHZhbHVlO1xuXG4gICAgICBpZiAodSA9PT0gdCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdXYXJuaW5nOiBmb3VuZCBzZWxmIGxvb3AgXCInICsgZSArICdcIiBmb3Igbm9kZSBcIicgKyB1ICsgJ1wiJyk7XG4gICAgICB9IGVsc2UgaWYgKHQgaW4gb25TdGFjaykge1xuICAgICAgICB2YWx1ZSA9IGcuZWRnZShlKTtcbiAgICAgICAgZy5kZWxFZGdlKGUpO1xuICAgICAgICB2YWx1ZS5yZXZlcnNlZCA9IHRydWU7XG4gICAgICAgICsrcmV2ZXJzZUNvdW50O1xuICAgICAgICBnLmFkZEVkZ2UoZSwgdCwgdSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGZzKHQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVsZXRlIG9uU3RhY2tbdV07XG4gIH1cblxuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHsgZGZzKHUpOyB9KTtcblxuICB1dGlsLmxvZygyLCAnQWN5Y2xpYyBQaGFzZTogcmV2ZXJzZWQgJyArIHJldmVyc2VDb3VudCArICcgZWRnZShzKScpO1xuXG4gIHJldHVybiByZXZlcnNlQ291bnQ7XG59XG5cbi8qXG4gKiBHaXZlbiBhIGdyYXBoIHRoYXQgaGFzIGhhZCB0aGUgYWN5Y2xpYyBvcGVyYXRpb24gYXBwbGllZCwgdGhpcyBmdW5jdGlvblxuICogdW5kb2VzIHRoYXQgb3BlcmF0aW9uLiBNb3JlIHNwZWNpZmljYWxseSwgYW55IGVkZ2Ugd2l0aCB0aGUgYHJldmVyc2VkYFxuICogYXR0cmlidXRlIGlzIGFnYWluIHJldmVyc2VkIHRvIHJlc3RvcmUgdGhlIG9yaWdpbmFsIGRpcmVjdGlvbiBvZiB0aGUgZWRnZS5cbiAqL1xuZnVuY3Rpb24gdW5kbyhnKSB7XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgcywgdCwgYSkge1xuICAgIGlmIChhLnJldmVyc2VkKSB7XG4gICAgICBkZWxldGUgYS5yZXZlcnNlZDtcbiAgICAgIGcuZGVsRWRnZShlKTtcbiAgICAgIGcuYWRkRWRnZShlLCB0LCBzLCBhKTtcbiAgICB9XG4gIH0pO1xufVxuIiwiZXhwb3J0cy5hcHBseSA9IGZ1bmN0aW9uKGcpIHtcbiAgZnVuY3Rpb24gZGZzKHNnKSB7XG4gICAgdmFyIHJhbmtTZXRzID0ge307XG4gICAgZy5jaGlsZHJlbihzZykuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICBpZiAoZy5jaGlsZHJlbih1KS5sZW5ndGgpIHtcbiAgICAgICAgZGZzKHUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciB2YWx1ZSA9IGcubm9kZSh1KSxcbiAgICAgICAgICBwcmVmUmFuayA9IHZhbHVlLnByZWZSYW5rO1xuICAgICAgaWYgKHByZWZSYW5rICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKCFjaGVja1N1cHBvcnRlZFByZWZSYW5rKHByZWZSYW5rKSkgeyByZXR1cm47IH1cblxuICAgICAgICBpZiAoIShwcmVmUmFuayBpbiByYW5rU2V0cykpIHtcbiAgICAgICAgICByYW5rU2V0cy5wcmVmUmFuayA9IFt1XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByYW5rU2V0cy5wcmVmUmFuay5wdXNoKHUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5ld1UgPSByYW5rU2V0c1twcmVmUmFua107XG4gICAgICAgIGlmIChuZXdVID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBuZXdVID0gcmFua1NldHNbcHJlZlJhbmtdID0gZy5hZGROb2RlKG51bGwsIHsgb3JpZ2luYWxOb2RlczogW10gfSk7XG4gICAgICAgICAgZy5wYXJlbnQobmV3VSwgc2cpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVkaXJlY3RJbkVkZ2VzKGcsIHUsIG5ld1UsIHByZWZSYW5rID09PSAnbWluJyk7XG4gICAgICAgIHJlZGlyZWN0T3V0RWRnZXMoZywgdSwgbmV3VSwgcHJlZlJhbmsgPT09ICdtYXgnKTtcblxuICAgICAgICAvLyBTYXZlIG9yaWdpbmFsIG5vZGUgYW5kIHJlbW92ZSBpdCBmcm9tIHJlZHVjZWQgZ3JhcGhcbiAgICAgICAgZy5ub2RlKG5ld1UpLm9yaWdpbmFsTm9kZXMucHVzaCh7IHU6IHUsIHZhbHVlOiB2YWx1ZSwgcGFyZW50OiBzZyB9KTtcbiAgICAgICAgZy5kZWxOb2RlKHUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYWRkTGlnaHRFZGdlc0Zyb21NaW5Ob2RlKGcsIHNnLCByYW5rU2V0cy5taW4pO1xuICAgIGFkZExpZ2h0RWRnZXNUb01heE5vZGUoZywgc2csIHJhbmtTZXRzLm1heCk7XG4gIH1cblxuICBkZnMobnVsbCk7XG59O1xuXG5mdW5jdGlvbiBjaGVja1N1cHBvcnRlZFByZWZSYW5rKHByZWZSYW5rKSB7XG4gIGlmIChwcmVmUmFuayAhPT0gJ21pbicgJiYgcHJlZlJhbmsgIT09ICdtYXgnICYmIHByZWZSYW5rLmluZGV4T2YoJ3NhbWVfJykgIT09IDApIHtcbiAgICBjb25zb2xlLmVycm9yKCdVbnN1cHBvcnRlZCByYW5rIHR5cGU6ICcgKyBwcmVmUmFuayk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiByZWRpcmVjdEluRWRnZXMoZywgdSwgbmV3VSwgcmV2ZXJzZSkge1xuICBnLmluRWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgdmFyIG9yaWdWYWx1ZSA9IGcuZWRnZShlKSxcbiAgICAgICAgdmFsdWU7XG4gICAgaWYgKG9yaWdWYWx1ZS5vcmlnaW5hbEVkZ2UpIHtcbiAgICAgIHZhbHVlID0gb3JpZ1ZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9ICB7XG4gICAgICAgIG9yaWdpbmFsRWRnZTogeyBlOiBlLCB1OiBnLnNvdXJjZShlKSwgdjogZy50YXJnZXQoZSksIHZhbHVlOiBvcmlnVmFsdWUgfSxcbiAgICAgICAgbWluTGVuOiBnLmVkZ2UoZSkubWluTGVuXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERvIG5vdCByZXZlcnNlIGVkZ2VzIGZvciBzZWxmLWxvb3BzLlxuICAgIGlmIChvcmlnVmFsdWUuc2VsZkxvb3ApIHtcbiAgICAgIHJldmVyc2UgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAocmV2ZXJzZSkge1xuICAgICAgLy8gRW5zdXJlIHRoYXQgYWxsIGVkZ2VzIHRvIG1pbiBhcmUgcmV2ZXJzZWRcbiAgICAgIGcuYWRkRWRnZShudWxsLCBuZXdVLCBnLnNvdXJjZShlKSwgdmFsdWUpO1xuICAgICAgdmFsdWUucmV2ZXJzZWQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgZy5zb3VyY2UoZSksIG5ld1UsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZWRpcmVjdE91dEVkZ2VzKGcsIHUsIG5ld1UsIHJldmVyc2UpIHtcbiAgZy5vdXRFZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgb3JpZ1ZhbHVlID0gZy5lZGdlKGUpLFxuICAgICAgICB2YWx1ZTtcbiAgICBpZiAob3JpZ1ZhbHVlLm9yaWdpbmFsRWRnZSkge1xuICAgICAgdmFsdWUgPSBvcmlnVmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gIHtcbiAgICAgICAgb3JpZ2luYWxFZGdlOiB7IGU6IGUsIHU6IGcuc291cmNlKGUpLCB2OiBnLnRhcmdldChlKSwgdmFsdWU6IG9yaWdWYWx1ZSB9LFxuICAgICAgICBtaW5MZW46IGcuZWRnZShlKS5taW5MZW5cbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRG8gbm90IHJldmVyc2UgZWRnZXMgZm9yIHNlbGYtbG9vcHMuXG4gICAgaWYgKG9yaWdWYWx1ZS5zZWxmTG9vcCkge1xuICAgICAgcmV2ZXJzZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChyZXZlcnNlKSB7XG4gICAgICAvLyBFbnN1cmUgdGhhdCBhbGwgZWRnZXMgZnJvbSBtYXggYXJlIHJldmVyc2VkXG4gICAgICBnLmFkZEVkZ2UobnVsbCwgZy50YXJnZXQoZSksIG5ld1UsIHZhbHVlKTtcbiAgICAgIHZhbHVlLnJldmVyc2VkID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIG5ld1UsIGcudGFyZ2V0KGUpLCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gYWRkTGlnaHRFZGdlc0Zyb21NaW5Ob2RlKGcsIHNnLCBtaW5Ob2RlKSB7XG4gIGlmIChtaW5Ob2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICBnLmNoaWxkcmVuKHNnKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIC8vIFRoZSBkdW1teSBjaGVjayBlbnN1cmVzIHdlIGRvbid0IGFkZCBhbiBlZGdlIGlmIHRoZSBub2RlIGlzIGludm9sdmVkXG4gICAgICAvLyBpbiBhIHNlbGYgbG9vcCBvciBzaWRld2F5cyBlZGdlLlxuICAgICAgaWYgKHUgIT09IG1pbk5vZGUgJiYgIWcub3V0RWRnZXMobWluTm9kZSwgdSkubGVuZ3RoICYmICFnLm5vZGUodSkuZHVtbXkpIHtcbiAgICAgICAgZy5hZGRFZGdlKG51bGwsIG1pbk5vZGUsIHUsIHsgbWluTGVuOiAwIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFkZExpZ2h0RWRnZXNUb01heE5vZGUoZywgc2csIG1heE5vZGUpIHtcbiAgaWYgKG1heE5vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgIGcuY2hpbGRyZW4oc2cpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgLy8gVGhlIGR1bW15IGNoZWNrIGVuc3VyZXMgd2UgZG9uJ3QgYWRkIGFuIGVkZ2UgaWYgdGhlIG5vZGUgaXMgaW52b2x2ZWRcbiAgICAgIC8vIGluIGEgc2VsZiBsb29wIG9yIHNpZGV3YXlzIGVkZ2UuXG4gICAgICBpZiAodSAhPT0gbWF4Tm9kZSAmJiAhZy5vdXRFZGdlcyh1LCBtYXhOb2RlKS5sZW5ndGggJiYgIWcubm9kZSh1KS5kdW1teSkge1xuICAgICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgbWF4Tm9kZSwgeyBtaW5MZW46IDAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLypcbiAqIFRoaXMgZnVuY3Rpb24gXCJyZWxheGVzXCIgdGhlIGNvbnN0cmFpbnRzIGFwcGxpZWQgcHJldmlvdXNseSBieSB0aGUgXCJhcHBseVwiXG4gKiBmdW5jdGlvbi4gSXQgZXhwYW5kcyBhbnkgbm9kZXMgdGhhdCB3ZXJlIGNvbGxhcHNlZCBhbmQgYXNzaWducyB0aGUgcmFuayBvZlxuICogdGhlIGNvbGxhcHNlZCBub2RlIHRvIGVhY2ggb2YgdGhlIGV4cGFuZGVkIG5vZGVzLiBJdCBhbHNvIHJlc3RvcmVzIHRoZVxuICogb3JpZ2luYWwgZWRnZXMgYW5kIHJlbW92ZXMgYW55IGR1bW15IGVkZ2VzIHBvaW50aW5nIGF0IHRoZSBjb2xsYXBzZWQgbm9kZXMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBwcm9jZXNzIG9mIHJlbW92aW5nIGNvbGxhcHNlZCBub2RlcyBhbHNvIHJlbW92ZXMgZHVtbXkgZWRnZXNcbiAqIGF1dG9tYXRpY2FsbHkuXG4gKi9cbmV4cG9ydHMucmVsYXggPSBmdW5jdGlvbihnKSB7XG4gIC8vIFNhdmUgb3JpZ2luYWwgZWRnZXNcbiAgdmFyIG9yaWdpbmFsRWRnZXMgPSBbXTtcbiAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIHZhciBvcmlnaW5hbEVkZ2UgPSB2YWx1ZS5vcmlnaW5hbEVkZ2U7XG4gICAgaWYgKG9yaWdpbmFsRWRnZSkge1xuICAgICAgb3JpZ2luYWxFZGdlcy5wdXNoKG9yaWdpbmFsRWRnZSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBFeHBhbmQgY29sbGFwc2VkIG5vZGVzXG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB2YXIgb3JpZ2luYWxOb2RlcyA9IHZhbHVlLm9yaWdpbmFsTm9kZXM7XG4gICAgaWYgKG9yaWdpbmFsTm9kZXMpIHtcbiAgICAgIG9yaWdpbmFsTm9kZXMuZm9yRWFjaChmdW5jdGlvbihvcmlnaW5hbE5vZGUpIHtcbiAgICAgICAgb3JpZ2luYWxOb2RlLnZhbHVlLnJhbmsgPSB2YWx1ZS5yYW5rO1xuICAgICAgICBnLmFkZE5vZGUob3JpZ2luYWxOb2RlLnUsIG9yaWdpbmFsTm9kZS52YWx1ZSk7XG4gICAgICAgIGcucGFyZW50KG9yaWdpbmFsTm9kZS51LCBvcmlnaW5hbE5vZGUucGFyZW50KTtcbiAgICAgIH0pO1xuICAgICAgZy5kZWxOb2RlKHUpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gUmVzdG9yZSBvcmlnaW5hbCBlZGdlc1xuICBvcmlnaW5hbEVkZ2VzLmZvckVhY2goZnVuY3Rpb24oZWRnZSkge1xuICAgIGcuYWRkRWRnZShlZGdlLmUsIGVkZ2UudSwgZWRnZS52LCBlZGdlLnZhbHVlKTtcbiAgfSk7XG59O1xuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZSgnY3AtZGF0YScpLlNldCxcbi8qIGpzaGludCArVzA3OSAqL1xuICAgIERpZ3JhcGggPSByZXF1aXJlKCdncmFwaGxpYicpLkRpZ3JhcGgsXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmZWFzaWJsZVRyZWU7XG5cbi8qXG4gKiBHaXZlbiBhbiBhY3ljbGljIGdyYXBoIHdpdGggZWFjaCBub2RlIGFzc2lnbmVkIGEgYHJhbmtgIGF0dHJpYnV0ZSwgdGhpc1xuICogZnVuY3Rpb24gY29uc3RydWN0cyBhbmQgcmV0dXJucyBhIHNwYW5uaW5nIHRyZWUuIFRoaXMgZnVuY3Rpb24gbWF5IHJlZHVjZVxuICogdGhlIGxlbmd0aCBvZiBzb21lIGVkZ2VzIGZyb20gdGhlIGluaXRpYWwgcmFuayBhc3NpZ25tZW50IHdoaWxlIG1haW50YWluaW5nXG4gKiB0aGUgYG1pbkxlbmAgc3BlY2lmaWVkIGJ5IGVhY2ggZWRnZS5cbiAqXG4gKiBQcmVyZXF1aXNpdGVzOlxuICpcbiAqICogVGhlIGlucHV0IGdyYXBoIGlzIGFjeWNsaWNcbiAqICogRWFjaCBub2RlIGluIHRoZSBpbnB1dCBncmFwaCBoYXMgYW4gYXNzaWduZWQgYHJhbmtgIGF0dHJpYnV0ZVxuICogKiBFYWNoIGVkZ2UgaW4gdGhlIGlucHV0IGdyYXBoIGhhcyBhbiBhc3NpZ25lZCBgbWluTGVuYCBhdHRyaWJ1dGVcbiAqXG4gKiBPdXRwdXRzOlxuICpcbiAqIEEgZmVhc2libGUgc3Bhbm5pbmcgdHJlZSBmb3IgdGhlIGlucHV0IGdyYXBoIChpLmUuIGEgc3Bhbm5pbmcgdHJlZSB0aGF0XG4gKiByZXNwZWN0cyBlYWNoIGdyYXBoIGVkZ2UncyBgbWluTGVuYCBhdHRyaWJ1dGUpIHJlcHJlc2VudGVkIGFzIGEgRGlncmFwaCB3aXRoXG4gKiBhIGByb290YCBhdHRyaWJ1dGUgb24gZ3JhcGguXG4gKlxuICogTm9kZXMgaGF2ZSB0aGUgc2FtZSBpZCBhbmQgdmFsdWUgYXMgdGhhdCBpbiB0aGUgaW5wdXQgZ3JhcGguXG4gKlxuICogRWRnZXMgaW4gdGhlIHRyZWUgaGF2ZSBhcmJpdHJhcmlseSBhc3NpZ25lZCBpZHMuIFRoZSBhdHRyaWJ1dGVzIGZvciBlZGdlc1xuICogaW5jbHVkZSBgcmV2ZXJzZWRgLiBgcmV2ZXJzZWRgIGluZGljYXRlcyB0aGF0IHRoZSBlZGdlIGlzIGFcbiAqIGJhY2sgZWRnZSBpbiB0aGUgaW5wdXQgZ3JhcGguXG4gKi9cbmZ1bmN0aW9uIGZlYXNpYmxlVHJlZShnKSB7XG4gIHZhciByZW1haW5pbmcgPSBuZXcgU2V0KGcubm9kZXMoKSksXG4gICAgICB0cmVlID0gbmV3IERpZ3JhcGgoKTtcblxuICBpZiAocmVtYWluaW5nLnNpemUoKSA9PT0gMSkge1xuICAgIHZhciByb290ID0gZy5ub2RlcygpWzBdO1xuICAgIHRyZWUuYWRkTm9kZShyb290LCB7fSk7XG4gICAgdHJlZS5ncmFwaCh7IHJvb3Q6IHJvb3QgfSk7XG4gICAgcmV0dXJuIHRyZWU7XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUaWdodEVkZ2VzKHYpIHtcbiAgICB2YXIgY29udGludWVUb1NjYW4gPSB0cnVlO1xuICAgIGcucHJlZGVjZXNzb3JzKHYpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgaWYgKHJlbWFpbmluZy5oYXModSkgJiYgIXNsYWNrKGcsIHUsIHYpKSB7XG4gICAgICAgIGlmIChyZW1haW5pbmcuaGFzKHYpKSB7XG4gICAgICAgICAgdHJlZS5hZGROb2RlKHYsIHt9KTtcbiAgICAgICAgICByZW1haW5pbmcucmVtb3ZlKHYpO1xuICAgICAgICAgIHRyZWUuZ3JhcGgoeyByb290OiB2IH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJlZS5hZGROb2RlKHUsIHt9KTtcbiAgICAgICAgdHJlZS5hZGRFZGdlKG51bGwsIHUsIHYsIHsgcmV2ZXJzZWQ6IHRydWUgfSk7XG4gICAgICAgIHJlbWFpbmluZy5yZW1vdmUodSk7XG4gICAgICAgIGFkZFRpZ2h0RWRnZXModSk7XG4gICAgICAgIGNvbnRpbnVlVG9TY2FuID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBnLnN1Y2Nlc3NvcnModikuZm9yRWFjaChmdW5jdGlvbih3KSAge1xuICAgICAgaWYgKHJlbWFpbmluZy5oYXModykgJiYgIXNsYWNrKGcsIHYsIHcpKSB7XG4gICAgICAgIGlmIChyZW1haW5pbmcuaGFzKHYpKSB7XG4gICAgICAgICAgdHJlZS5hZGROb2RlKHYsIHt9KTtcbiAgICAgICAgICByZW1haW5pbmcucmVtb3ZlKHYpO1xuICAgICAgICAgIHRyZWUuZ3JhcGgoeyByb290OiB2IH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJlZS5hZGROb2RlKHcsIHt9KTtcbiAgICAgICAgdHJlZS5hZGRFZGdlKG51bGwsIHYsIHcsIHt9KTtcbiAgICAgICAgcmVtYWluaW5nLnJlbW92ZSh3KTtcbiAgICAgICAgYWRkVGlnaHRFZGdlcyh3KTtcbiAgICAgICAgY29udGludWVUb1NjYW4gPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gY29udGludWVUb1NjYW47XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVUaWdodEVkZ2UoKSB7XG4gICAgdmFyIG1pblNsYWNrID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICByZW1haW5pbmcua2V5cygpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgZy5wcmVkZWNlc3NvcnModikuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAgIGlmICghcmVtYWluaW5nLmhhcyh1KSkge1xuICAgICAgICAgIHZhciBlZGdlU2xhY2sgPSBzbGFjayhnLCB1LCB2KTtcbiAgICAgICAgICBpZiAoTWF0aC5hYnMoZWRnZVNsYWNrKSA8IE1hdGguYWJzKG1pblNsYWNrKSkge1xuICAgICAgICAgICAgbWluU2xhY2sgPSAtZWRnZVNsYWNrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGcuc3VjY2Vzc29ycyh2KS5mb3JFYWNoKGZ1bmN0aW9uKHcpIHtcbiAgICAgICAgaWYgKCFyZW1haW5pbmcuaGFzKHcpKSB7XG4gICAgICAgICAgdmFyIGVkZ2VTbGFjayA9IHNsYWNrKGcsIHYsIHcpO1xuICAgICAgICAgIGlmIChNYXRoLmFicyhlZGdlU2xhY2spIDwgTWF0aC5hYnMobWluU2xhY2spKSB7XG4gICAgICAgICAgICBtaW5TbGFjayA9IGVkZ2VTbGFjaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdHJlZS5lYWNoTm9kZShmdW5jdGlvbih1KSB7IGcubm9kZSh1KS5yYW5rIC09IG1pblNsYWNrOyB9KTtcbiAgfVxuXG4gIHdoaWxlIChyZW1haW5pbmcuc2l6ZSgpKSB7XG4gICAgdmFyIG5vZGVzVG9TZWFyY2ggPSAhdHJlZS5vcmRlcigpID8gcmVtYWluaW5nLmtleXMoKSA6IHRyZWUubm9kZXMoKTtcbiAgICBmb3IgKHZhciBpID0gMCwgaWwgPSBub2Rlc1RvU2VhcmNoLmxlbmd0aDtcbiAgICAgICAgIGkgPCBpbCAmJiBhZGRUaWdodEVkZ2VzKG5vZGVzVG9TZWFyY2hbaV0pO1xuICAgICAgICAgKytpKTtcbiAgICBpZiAocmVtYWluaW5nLnNpemUoKSkge1xuICAgICAgY3JlYXRlVGlnaHRFZGdlKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRyZWU7XG59XG5cbmZ1bmN0aW9uIHNsYWNrKGcsIHUsIHYpIHtcbiAgdmFyIHJhbmtEaWZmID0gZy5ub2RlKHYpLnJhbmsgLSBnLm5vZGUodSkucmFuaztcbiAgdmFyIG1heE1pbkxlbiA9IHV0aWwubWF4KGcub3V0RWRnZXModSwgdilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGcuZWRnZShlKS5taW5MZW47IH0pKTtcbiAgcmV0dXJuIHJhbmtEaWZmIC0gbWF4TWluTGVuO1xufVxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyksXG4gICAgdG9wc29ydCA9IHJlcXVpcmUoJ2dyYXBobGliJykuYWxnLnRvcHNvcnQ7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdFJhbms7XG5cbi8qXG4gKiBBc3NpZ25zIGEgYHJhbmtgIGF0dHJpYnV0ZSB0byBlYWNoIG5vZGUgaW4gdGhlIGlucHV0IGdyYXBoIGFuZCBlbnN1cmVzIHRoYXRcbiAqIHRoaXMgcmFuayByZXNwZWN0cyB0aGUgYG1pbkxlbmAgYXR0cmlidXRlIG9mIGluY2lkZW50IGVkZ2VzLlxuICpcbiAqIFByZXJlcXVpc2l0ZXM6XG4gKlxuICogICogVGhlIGlucHV0IGdyYXBoIG11c3QgYmUgYWN5Y2xpY1xuICogICogRWFjaCBlZGdlIGluIHRoZSBpbnB1dCBncmFwaCBtdXN0IGhhdmUgYW4gYXNzaWduZWQgJ21pbkxlbicgYXR0cmlidXRlXG4gKi9cbmZ1bmN0aW9uIGluaXRSYW5rKGcpIHtcbiAgdmFyIHNvcnRlZCA9IHRvcHNvcnQoZyk7XG5cbiAgc29ydGVkLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHZhciBpbkVkZ2VzID0gZy5pbkVkZ2VzKHUpO1xuICAgIGlmIChpbkVkZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZy5ub2RlKHUpLnJhbmsgPSAwO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBtaW5MZW5zID0gaW5FZGdlcy5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGcubm9kZShnLnNvdXJjZShlKSkucmFuayArIGcuZWRnZShlKS5taW5MZW47XG4gICAgfSk7XG4gICAgZy5ub2RlKHUpLnJhbmsgPSB1dGlsLm1heChtaW5MZW5zKTtcbiAgfSk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgc2xhY2s6IHNsYWNrXG59O1xuXG4vKlxuICogQSBoZWxwZXIgdG8gY2FsY3VsYXRlIHRoZSBzbGFjayBiZXR3ZWVuIHR3byBub2RlcyAoYHVgIGFuZCBgdmApIGdpdmVuIGFcbiAqIGBtaW5MZW5gIGNvbnN0cmFpbnQuIFRoZSBzbGFjayByZXByZXNlbnRzIGhvdyBtdWNoIHRoZSBkaXN0YW5jZSBiZXR3ZWVuIGB1YFxuICogYW5kIGB2YCBjb3VsZCBzaHJpbmsgd2hpbGUgbWFpbnRhaW5pbmcgdGhlIGBtaW5MZW5gIGNvbnN0cmFpbnQuIElmIHRoZSB2YWx1ZVxuICogaXMgbmVnYXRpdmUgdGhlbiB0aGUgY29uc3RyYWludCBpcyBjdXJyZW50bHkgdmlvbGF0ZWQuXG4gKlxuICBUaGlzIGZ1bmN0aW9uIHJlcXVpcmVzIHRoYXQgYHVgIGFuZCBgdmAgYXJlIGluIGBncmFwaGAgYW5kIHRoZXkgYm90aCBoYXZlIGFcbiAgYHJhbmtgIGF0dHJpYnV0ZS5cbiAqL1xuZnVuY3Rpb24gc2xhY2soZ3JhcGgsIHUsIHYsIG1pbkxlbikge1xuICByZXR1cm4gTWF0aC5hYnMoZ3JhcGgubm9kZSh1KS5yYW5rIC0gZ3JhcGgubm9kZSh2KS5yYW5rKSAtIG1pbkxlbjtcbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpLFxuICAgIHJhbmtVdGlsID0gcmVxdWlyZSgnLi9yYW5rVXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHNpbXBsZXg7XG5cbmZ1bmN0aW9uIHNpbXBsZXgoZ3JhcGgsIHNwYW5uaW5nVHJlZSkge1xuICAvLyBUaGUgbmV0d29yayBzaW1wbGV4IGFsZ29yaXRobSByZXBlYXRlZGx5IHJlcGxhY2VzIGVkZ2VzIG9mXG4gIC8vIHRoZSBzcGFubmluZyB0cmVlIHdpdGggbmVnYXRpdmUgY3V0IHZhbHVlcyB1bnRpbCBubyBzdWNoXG4gIC8vIGVkZ2UgZXhpc3RzLlxuICBpbml0Q3V0VmFsdWVzKGdyYXBoLCBzcGFubmluZ1RyZWUpO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIHZhciBlID0gbGVhdmVFZGdlKHNwYW5uaW5nVHJlZSk7XG4gICAgaWYgKGUgPT09IG51bGwpIGJyZWFrO1xuICAgIHZhciBmID0gZW50ZXJFZGdlKGdyYXBoLCBzcGFubmluZ1RyZWUsIGUpO1xuICAgIGV4Y2hhbmdlKGdyYXBoLCBzcGFubmluZ1RyZWUsIGUsIGYpO1xuICB9XG59XG5cbi8qXG4gKiBTZXQgdGhlIGN1dCB2YWx1ZXMgb2YgZWRnZXMgaW4gdGhlIHNwYW5uaW5nIHRyZWUgYnkgYSBkZXB0aC1maXJzdFxuICogcG9zdG9yZGVyIHRyYXZlcnNhbC4gIFRoZSBjdXQgdmFsdWUgY29ycmVzcG9uZHMgdG8gdGhlIGNvc3QsIGluXG4gKiB0ZXJtcyBvZiBhIHJhbmtpbmcncyBlZGdlIGxlbmd0aCBzdW0sIG9mIGxlbmd0aGVuaW5nIGFuIGVkZ2UuXG4gKiBOZWdhdGl2ZSBjdXQgdmFsdWVzIHR5cGljYWxseSBpbmRpY2F0ZSBlZGdlcyB0aGF0IHdvdWxkIHlpZWxkIGFcbiAqIHNtYWxsZXIgZWRnZSBsZW5ndGggc3VtIGlmIHRoZXkgd2VyZSBsZW5ndGhlbmVkLlxuICovXG5mdW5jdGlvbiBpbml0Q3V0VmFsdWVzKGdyYXBoLCBzcGFubmluZ1RyZWUpIHtcbiAgY29tcHV0ZUxvd0xpbShzcGFubmluZ1RyZWUpO1xuXG4gIHNwYW5uaW5nVHJlZS5lYWNoRWRnZShmdW5jdGlvbihpZCwgdSwgdiwgdHJlZVZhbHVlKSB7XG4gICAgdHJlZVZhbHVlLmN1dFZhbHVlID0gMDtcbiAgfSk7XG5cbiAgLy8gUHJvcGFnYXRlIGN1dCB2YWx1ZXMgdXAgdGhlIHRyZWUuXG4gIGZ1bmN0aW9uIGRmcyhuKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gc3Bhbm5pbmdUcmVlLnN1Y2Nlc3NvcnMobik7XG4gICAgZm9yICh2YXIgYyBpbiBjaGlsZHJlbikge1xuICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bY107XG4gICAgICBkZnMoY2hpbGQpO1xuICAgIH1cbiAgICBpZiAobiAhPT0gc3Bhbm5pbmdUcmVlLmdyYXBoKCkucm9vdCkge1xuICAgICAgc2V0Q3V0VmFsdWUoZ3JhcGgsIHNwYW5uaW5nVHJlZSwgbik7XG4gICAgfVxuICB9XG4gIGRmcyhzcGFubmluZ1RyZWUuZ3JhcGgoKS5yb290KTtcbn1cblxuLypcbiAqIFBlcmZvcm0gYSBERlMgcG9zdG9yZGVyIHRyYXZlcnNhbCwgbGFiZWxpbmcgZWFjaCBub2RlIHYgd2l0aFxuICogaXRzIHRyYXZlcnNhbCBvcmRlciAnbGltKHYpJyBhbmQgdGhlIG1pbmltdW0gdHJhdmVyc2FsIG51bWJlclxuICogb2YgYW55IG9mIGl0cyBkZXNjZW5kYW50cyAnbG93KHYpJy4gIFRoaXMgcHJvdmlkZXMgYW4gZWZmaWNpZW50XG4gKiB3YXkgdG8gdGVzdCB3aGV0aGVyIHUgaXMgYW4gYW5jZXN0b3Igb2YgdiBzaW5jZVxuICogbG93KHUpIDw9IGxpbSh2KSA8PSBsaW0odSkgaWYgYW5kIG9ubHkgaWYgdSBpcyBhbiBhbmNlc3Rvci5cbiAqL1xuZnVuY3Rpb24gY29tcHV0ZUxvd0xpbSh0cmVlKSB7XG4gIHZhciBwb3N0T3JkZXJOdW0gPSAwO1xuICBcbiAgZnVuY3Rpb24gZGZzKG4pIHtcbiAgICB2YXIgY2hpbGRyZW4gPSB0cmVlLnN1Y2Nlc3NvcnMobik7XG4gICAgdmFyIGxvdyA9IHBvc3RPcmRlck51bTtcbiAgICBmb3IgKHZhciBjIGluIGNoaWxkcmVuKSB7XG4gICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltjXTtcbiAgICAgIGRmcyhjaGlsZCk7XG4gICAgICBsb3cgPSBNYXRoLm1pbihsb3csIHRyZWUubm9kZShjaGlsZCkubG93KTtcbiAgICB9XG4gICAgdHJlZS5ub2RlKG4pLmxvdyA9IGxvdztcbiAgICB0cmVlLm5vZGUobikubGltID0gcG9zdE9yZGVyTnVtKys7XG4gIH1cblxuICBkZnModHJlZS5ncmFwaCgpLnJvb3QpO1xufVxuXG4vKlxuICogVG8gY29tcHV0ZSB0aGUgY3V0IHZhbHVlIG9mIHRoZSBlZGdlIHBhcmVudCAtPiBjaGlsZCwgd2UgY29uc2lkZXJcbiAqIGl0IGFuZCBhbnkgb3RoZXIgZ3JhcGggZWRnZXMgdG8gb3IgZnJvbSB0aGUgY2hpbGQuXG4gKiAgICAgICAgICBwYXJlbnRcbiAqICAgICAgICAgICAgIHxcbiAqICAgICAgICAgICBjaGlsZFxuICogICAgICAgICAgLyAgICAgIFxcXG4gKiAgICAgICAgIHUgICAgICAgIHZcbiAqL1xuZnVuY3Rpb24gc2V0Q3V0VmFsdWUoZ3JhcGgsIHRyZWUsIGNoaWxkKSB7XG4gIHZhciBwYXJlbnRFZGdlID0gdHJlZS5pbkVkZ2VzKGNoaWxkKVswXTtcblxuICAvLyBMaXN0IG9mIGNoaWxkJ3MgY2hpbGRyZW4gaW4gdGhlIHNwYW5uaW5nIHRyZWUuXG4gIHZhciBncmFuZGNoaWxkcmVuID0gW107XG4gIHZhciBncmFuZGNoaWxkRWRnZXMgPSB0cmVlLm91dEVkZ2VzKGNoaWxkKTtcbiAgZm9yICh2YXIgZ2NlIGluIGdyYW5kY2hpbGRFZGdlcykge1xuICAgIGdyYW5kY2hpbGRyZW4ucHVzaCh0cmVlLnRhcmdldChncmFuZGNoaWxkRWRnZXNbZ2NlXSkpO1xuICB9XG5cbiAgdmFyIGN1dFZhbHVlID0gMDtcblxuICAvLyBUT0RPOiBSZXBsYWNlIHVuaXQgaW5jcmVtZW50L2RlY3JlbWVudCB3aXRoIGVkZ2Ugd2VpZ2h0cy5cbiAgdmFyIEUgPSAwOyAgICAvLyBFZGdlcyBmcm9tIGNoaWxkIHRvIGdyYW5kY2hpbGQncyBzdWJ0cmVlLlxuICB2YXIgRiA9IDA7ICAgIC8vIEVkZ2VzIHRvIGNoaWxkIGZyb20gZ3JhbmRjaGlsZCdzIHN1YnRyZWUuXG4gIHZhciBHID0gMDsgICAgLy8gRWRnZXMgZnJvbSBjaGlsZCB0byBub2RlcyBvdXRzaWRlIG9mIGNoaWxkJ3Mgc3VidHJlZS5cbiAgdmFyIEggPSAwOyAgICAvLyBFZGdlcyBmcm9tIG5vZGVzIG91dHNpZGUgb2YgY2hpbGQncyBzdWJ0cmVlIHRvIGNoaWxkLlxuXG4gIC8vIENvbnNpZGVyIGFsbCBncmFwaCBlZGdlcyBmcm9tIGNoaWxkLlxuICB2YXIgb3V0RWRnZXMgPSBncmFwaC5vdXRFZGdlcyhjaGlsZCk7XG4gIHZhciBnYztcbiAgZm9yICh2YXIgb2UgaW4gb3V0RWRnZXMpIHtcbiAgICB2YXIgc3VjYyA9IGdyYXBoLnRhcmdldChvdXRFZGdlc1tvZV0pO1xuICAgIGZvciAoZ2MgaW4gZ3JhbmRjaGlsZHJlbikge1xuICAgICAgaWYgKGluU3VidHJlZSh0cmVlLCBzdWNjLCBncmFuZGNoaWxkcmVuW2djXSkpIHtcbiAgICAgICAgRSsrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWluU3VidHJlZSh0cmVlLCBzdWNjLCBjaGlsZCkpIHtcbiAgICAgIEcrKztcbiAgICB9XG4gIH1cblxuICAvLyBDb25zaWRlciBhbGwgZ3JhcGggZWRnZXMgdG8gY2hpbGQuXG4gIHZhciBpbkVkZ2VzID0gZ3JhcGguaW5FZGdlcyhjaGlsZCk7XG4gIGZvciAodmFyIGllIGluIGluRWRnZXMpIHtcbiAgICB2YXIgcHJlZCA9IGdyYXBoLnNvdXJjZShpbkVkZ2VzW2llXSk7XG4gICAgZm9yIChnYyBpbiBncmFuZGNoaWxkcmVuKSB7XG4gICAgICBpZiAoaW5TdWJ0cmVlKHRyZWUsIHByZWQsIGdyYW5kY2hpbGRyZW5bZ2NdKSkge1xuICAgICAgICBGKys7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghaW5TdWJ0cmVlKHRyZWUsIHByZWQsIGNoaWxkKSkge1xuICAgICAgSCsrO1xuICAgIH1cbiAgfVxuXG4gIC8vIENvbnRyaWJ1dGlvbnMgZGVwZW5kIG9uIHRoZSBhbGlnbm1lbnQgb2YgdGhlIHBhcmVudCAtPiBjaGlsZCBlZGdlXG4gIC8vIGFuZCB0aGUgY2hpbGQgLT4gdSBvciB2IGVkZ2VzLlxuICB2YXIgZ3JhbmRjaGlsZEN1dFN1bSA9IDA7XG4gIGZvciAoZ2MgaW4gZ3JhbmRjaGlsZHJlbikge1xuICAgIHZhciBjdiA9IHRyZWUuZWRnZShncmFuZGNoaWxkRWRnZXNbZ2NdKS5jdXRWYWx1ZTtcbiAgICBpZiAoIXRyZWUuZWRnZShncmFuZGNoaWxkRWRnZXNbZ2NdKS5yZXZlcnNlZCkge1xuICAgICAgZ3JhbmRjaGlsZEN1dFN1bSArPSBjdjtcbiAgICB9IGVsc2Uge1xuICAgICAgZ3JhbmRjaGlsZEN1dFN1bSAtPSBjdjtcbiAgICB9XG4gIH1cblxuICBpZiAoIXRyZWUuZWRnZShwYXJlbnRFZGdlKS5yZXZlcnNlZCkge1xuICAgIGN1dFZhbHVlICs9IGdyYW5kY2hpbGRDdXRTdW0gLSBFICsgRiAtIEcgKyBIO1xuICB9IGVsc2Uge1xuICAgIGN1dFZhbHVlIC09IGdyYW5kY2hpbGRDdXRTdW0gLSBFICsgRiAtIEcgKyBIO1xuICB9XG5cbiAgdHJlZS5lZGdlKHBhcmVudEVkZ2UpLmN1dFZhbHVlID0gY3V0VmFsdWU7XG59XG5cbi8qXG4gKiBSZXR1cm4gd2hldGhlciBuIGlzIGEgbm9kZSBpbiB0aGUgc3VidHJlZSB3aXRoIHRoZSBnaXZlblxuICogcm9vdC5cbiAqL1xuZnVuY3Rpb24gaW5TdWJ0cmVlKHRyZWUsIG4sIHJvb3QpIHtcbiAgcmV0dXJuICh0cmVlLm5vZGUocm9vdCkubG93IDw9IHRyZWUubm9kZShuKS5saW0gJiZcbiAgICAgICAgICB0cmVlLm5vZGUobikubGltIDw9IHRyZWUubm9kZShyb290KS5saW0pO1xufVxuXG4vKlxuICogUmV0dXJuIGFuIGVkZ2UgZnJvbSB0aGUgdHJlZSB3aXRoIGEgbmVnYXRpdmUgY3V0IHZhbHVlLCBvciBudWxsIGlmIHRoZXJlXG4gKiBpcyBub25lLlxuICovXG5mdW5jdGlvbiBsZWF2ZUVkZ2UodHJlZSkge1xuICB2YXIgZWRnZXMgPSB0cmVlLmVkZ2VzKCk7XG4gIGZvciAodmFyIG4gaW4gZWRnZXMpIHtcbiAgICB2YXIgZSA9IGVkZ2VzW25dO1xuICAgIHZhciB0cmVlVmFsdWUgPSB0cmVlLmVkZ2UoZSk7XG4gICAgaWYgKHRyZWVWYWx1ZS5jdXRWYWx1ZSA8IDApIHtcbiAgICAgIHJldHVybiBlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLypcbiAqIFRoZSBlZGdlIGUgc2hvdWxkIGJlIGFuIGVkZ2UgaW4gdGhlIHRyZWUsIHdpdGggYW4gdW5kZXJseWluZyBlZGdlXG4gKiBpbiB0aGUgZ3JhcGgsIHdpdGggYSBuZWdhdGl2ZSBjdXQgdmFsdWUuICBPZiB0aGUgdHdvIG5vZGVzIGluY2lkZW50XG4gKiBvbiB0aGUgZWRnZSwgdGFrZSB0aGUgbG93ZXIgb25lLiAgZW50ZXJFZGdlIHJldHVybnMgYW4gZWRnZSB3aXRoXG4gKiBtaW5pbXVtIHNsYWNrIGdvaW5nIGZyb20gb3V0c2lkZSBvZiB0aGF0IG5vZGUncyBzdWJ0cmVlIHRvIGluc2lkZVxuICogb2YgdGhhdCBub2RlJ3Mgc3VidHJlZS5cbiAqL1xuZnVuY3Rpb24gZW50ZXJFZGdlKGdyYXBoLCB0cmVlLCBlKSB7XG4gIHZhciBzb3VyY2UgPSB0cmVlLnNvdXJjZShlKTtcbiAgdmFyIHRhcmdldCA9IHRyZWUudGFyZ2V0KGUpO1xuICB2YXIgbG93ZXIgPSB0cmVlLm5vZGUodGFyZ2V0KS5saW0gPCB0cmVlLm5vZGUoc291cmNlKS5saW0gPyB0YXJnZXQgOiBzb3VyY2U7XG5cbiAgLy8gSXMgdGhlIHRyZWUgZWRnZSBhbGlnbmVkIHdpdGggdGhlIGdyYXBoIGVkZ2U/XG4gIHZhciBhbGlnbmVkID0gIXRyZWUuZWRnZShlKS5yZXZlcnNlZDtcblxuICB2YXIgbWluU2xhY2sgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gIHZhciBtaW5TbGFja0VkZ2U7XG4gIGlmIChhbGlnbmVkKSB7XG4gICAgZ3JhcGguZWFjaEVkZ2UoZnVuY3Rpb24oaWQsIHUsIHYsIHZhbHVlKSB7XG4gICAgICBpZiAoaWQgIT09IGUgJiYgaW5TdWJ0cmVlKHRyZWUsIHUsIGxvd2VyKSAmJiAhaW5TdWJ0cmVlKHRyZWUsIHYsIGxvd2VyKSkge1xuICAgICAgICB2YXIgc2xhY2sgPSByYW5rVXRpbC5zbGFjayhncmFwaCwgdSwgdiwgdmFsdWUubWluTGVuKTtcbiAgICAgICAgaWYgKHNsYWNrIDwgbWluU2xhY2spIHtcbiAgICAgICAgICBtaW5TbGFjayA9IHNsYWNrO1xuICAgICAgICAgIG1pblNsYWNrRWRnZSA9IGlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgZ3JhcGguZWFjaEVkZ2UoZnVuY3Rpb24oaWQsIHUsIHYsIHZhbHVlKSB7XG4gICAgICBpZiAoaWQgIT09IGUgJiYgIWluU3VidHJlZSh0cmVlLCB1LCBsb3dlcikgJiYgaW5TdWJ0cmVlKHRyZWUsIHYsIGxvd2VyKSkge1xuICAgICAgICB2YXIgc2xhY2sgPSByYW5rVXRpbC5zbGFjayhncmFwaCwgdSwgdiwgdmFsdWUubWluTGVuKTtcbiAgICAgICAgaWYgKHNsYWNrIDwgbWluU2xhY2spIHtcbiAgICAgICAgICBtaW5TbGFjayA9IHNsYWNrO1xuICAgICAgICAgIG1pblNsYWNrRWRnZSA9IGlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAobWluU2xhY2tFZGdlID09PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgb3V0c2lkZSA9IFtdO1xuICAgIHZhciBpbnNpZGUgPSBbXTtcbiAgICBncmFwaC5lYWNoTm9kZShmdW5jdGlvbihpZCkge1xuICAgICAgaWYgKCFpblN1YnRyZWUodHJlZSwgaWQsIGxvd2VyKSkge1xuICAgICAgICBvdXRzaWRlLnB1c2goaWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5zaWRlLnB1c2goaWQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRocm93IG5ldyBFcnJvcignTm8gZWRnZSBmb3VuZCBmcm9tIG91dHNpZGUgb2YgdHJlZSB0byBpbnNpZGUnKTtcbiAgfVxuXG4gIHJldHVybiBtaW5TbGFja0VkZ2U7XG59XG5cbi8qXG4gKiBSZXBsYWNlIGVkZ2UgZSB3aXRoIGVkZ2UgZiBpbiB0aGUgdHJlZSwgcmVjYWxjdWxhdGluZyB0aGUgdHJlZSByb290LFxuICogdGhlIG5vZGVzJyBsb3cgYW5kIGxpbSBwcm9wZXJ0aWVzIGFuZCB0aGUgZWRnZXMnIGN1dCB2YWx1ZXMuXG4gKi9cbmZ1bmN0aW9uIGV4Y2hhbmdlKGdyYXBoLCB0cmVlLCBlLCBmKSB7XG4gIHRyZWUuZGVsRWRnZShlKTtcbiAgdmFyIHNvdXJjZSA9IGdyYXBoLnNvdXJjZShmKTtcbiAgdmFyIHRhcmdldCA9IGdyYXBoLnRhcmdldChmKTtcblxuICAvLyBSZWRpcmVjdCBlZGdlcyBzbyB0aGF0IHRhcmdldCBpcyB0aGUgcm9vdCBvZiBpdHMgc3VidHJlZS5cbiAgZnVuY3Rpb24gcmVkaXJlY3Qodikge1xuICAgIHZhciBlZGdlcyA9IHRyZWUuaW5FZGdlcyh2KTtcbiAgICBmb3IgKHZhciBpIGluIGVkZ2VzKSB7XG4gICAgICB2YXIgZSA9IGVkZ2VzW2ldO1xuICAgICAgdmFyIHUgPSB0cmVlLnNvdXJjZShlKTtcbiAgICAgIHZhciB2YWx1ZSA9IHRyZWUuZWRnZShlKTtcbiAgICAgIHJlZGlyZWN0KHUpO1xuICAgICAgdHJlZS5kZWxFZGdlKGUpO1xuICAgICAgdmFsdWUucmV2ZXJzZWQgPSAhdmFsdWUucmV2ZXJzZWQ7XG4gICAgICB0cmVlLmFkZEVkZ2UoZSwgdiwgdSwgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHJlZGlyZWN0KHRhcmdldCk7XG5cbiAgdmFyIHJvb3QgPSBzb3VyY2U7XG4gIHZhciBlZGdlcyA9IHRyZWUuaW5FZGdlcyhyb290KTtcbiAgd2hpbGUgKGVkZ2VzLmxlbmd0aCA+IDApIHtcbiAgICByb290ID0gdHJlZS5zb3VyY2UoZWRnZXNbMF0pO1xuICAgIGVkZ2VzID0gdHJlZS5pbkVkZ2VzKHJvb3QpO1xuICB9XG5cbiAgdHJlZS5ncmFwaCgpLnJvb3QgPSByb290O1xuXG4gIHRyZWUuYWRkRWRnZShudWxsLCBzb3VyY2UsIHRhcmdldCwge2N1dFZhbHVlOiAwfSk7XG5cbiAgaW5pdEN1dFZhbHVlcyhncmFwaCwgdHJlZSk7XG5cbiAgYWRqdXN0UmFua3MoZ3JhcGgsIHRyZWUpO1xufVxuXG4vKlxuICogUmVzZXQgdGhlIHJhbmtzIG9mIGFsbCBub2RlcyBiYXNlZCBvbiB0aGUgY3VycmVudCBzcGFubmluZyB0cmVlLlxuICogVGhlIHJhbmsgb2YgdGhlIHRyZWUncyByb290IHJlbWFpbnMgdW5jaGFuZ2VkLCB3aGlsZSBhbGwgb3RoZXJcbiAqIG5vZGVzIGFyZSBzZXQgdG8gdGhlIHN1bSBvZiBtaW5pbXVtIGxlbmd0aCBjb25zdHJhaW50cyBhbG9uZ1xuICogdGhlIHBhdGggZnJvbSB0aGUgcm9vdC5cbiAqL1xuZnVuY3Rpb24gYWRqdXN0UmFua3MoZ3JhcGgsIHRyZWUpIHtcbiAgZnVuY3Rpb24gZGZzKHApIHtcbiAgICB2YXIgY2hpbGRyZW4gPSB0cmVlLnN1Y2Nlc3NvcnMocCk7XG4gICAgY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjKSB7XG4gICAgICB2YXIgbWluTGVuID0gbWluaW11bUxlbmd0aChncmFwaCwgcCwgYyk7XG4gICAgICBncmFwaC5ub2RlKGMpLnJhbmsgPSBncmFwaC5ub2RlKHApLnJhbmsgKyBtaW5MZW47XG4gICAgICBkZnMoYyk7XG4gICAgfSk7XG4gIH1cblxuICBkZnModHJlZS5ncmFwaCgpLnJvb3QpO1xufVxuXG4vKlxuICogSWYgdSBhbmQgdiBhcmUgY29ubmVjdGVkIGJ5IHNvbWUgZWRnZXMgaW4gdGhlIGdyYXBoLCByZXR1cm4gdGhlXG4gKiBtaW5pbXVtIGxlbmd0aCBvZiB0aG9zZSBlZGdlcywgYXMgYSBwb3NpdGl2ZSBudW1iZXIgaWYgdiBzdWNjZWVkc1xuICogdSBhbmQgYXMgYSBuZWdhdGl2ZSBudW1iZXIgaWYgdiBwcmVjZWRlcyB1LlxuICovXG5mdW5jdGlvbiBtaW5pbXVtTGVuZ3RoKGdyYXBoLCB1LCB2KSB7XG4gIHZhciBvdXRFZGdlcyA9IGdyYXBoLm91dEVkZ2VzKHUsIHYpO1xuICBpZiAob3V0RWRnZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB1dGlsLm1heChvdXRFZGdlcy5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGdyYXBoLmVkZ2UoZSkubWluTGVuO1xuICAgIH0pKTtcbiAgfVxuXG4gIHZhciBpbkVkZ2VzID0gZ3JhcGguaW5FZGdlcyh1LCB2KTtcbiAgaWYgKGluRWRnZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiAtdXRpbC5tYXgoaW5FZGdlcy5tYXAoZnVuY3Rpb24oZSkge1xuICAgICAgcmV0dXJuIGdyYXBoLmVkZ2UoZSkubWluTGVuO1xuICAgIH0pKTtcbiAgfVxufVxuIiwiLypcbiAqIFJldHVybnMgdGhlIHNtYWxsZXN0IHZhbHVlIGluIHRoZSBhcnJheS5cbiAqL1xuZXhwb3J0cy5taW4gPSBmdW5jdGlvbih2YWx1ZXMpIHtcbiAgcmV0dXJuIE1hdGgubWluLmFwcGx5KE1hdGgsIHZhbHVlcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyB0aGUgbGFyZ2VzdCB2YWx1ZSBpbiB0aGUgYXJyYXkuXG4gKi9cbmV4cG9ydHMubWF4ID0gZnVuY3Rpb24odmFsdWVzKSB7XG4gIHJldHVybiBNYXRoLm1heC5hcHBseShNYXRoLCB2YWx1ZXMpO1xufTtcblxuLypcbiAqIFJldHVybnMgYHRydWVgIG9ubHkgaWYgYGYoeClgIGlzIGB0cnVlYCBmb3IgYWxsIGB4YCBpbiBgeHNgLiBPdGhlcndpc2VcbiAqIHJldHVybnMgYGZhbHNlYC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJldHVybiBpbW1lZGlhdGVseSBpZiBpdCBmaW5kcyBhXG4gKiBjYXNlIHdoZXJlIGBmKHgpYCBkb2VzIG5vdCBob2xkLlxuICovXG5leHBvcnRzLmFsbCA9IGZ1bmN0aW9uKHhzLCBmKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoIWYoeHNbaV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufTtcblxuLypcbiAqIEFjY3VtdWxhdGVzIHRoZSBzdW0gb2YgZWxlbWVudHMgaW4gdGhlIGdpdmVuIGFycmF5IHVzaW5nIHRoZSBgK2Agb3BlcmF0b3IuXG4gKi9cbmV4cG9ydHMuc3VtID0gZnVuY3Rpb24odmFsdWVzKSB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgeCkgeyByZXR1cm4gYWNjICsgeDsgfSwgMCk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBhbGwgdmFsdWVzIGluIHRoZSBnaXZlbiBvYmplY3QuXG4gKi9cbmV4cG9ydHMudmFsdWVzID0gZnVuY3Rpb24ob2JqKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopLm1hcChmdW5jdGlvbihrKSB7IHJldHVybiBvYmpba107IH0pO1xufTtcblxuZXhwb3J0cy5zaHVmZmxlID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgZm9yIChpID0gYXJyYXkubGVuZ3RoIC0gMTsgaSA+IDA7IC0taSkge1xuICAgIHZhciBqID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKGkgKyAxKSk7XG4gICAgdmFyIGFqID0gYXJyYXlbal07XG4gICAgYXJyYXlbal0gPSBhcnJheVtpXTtcbiAgICBhcnJheVtpXSA9IGFqO1xuICB9XG59O1xuXG5leHBvcnRzLnByb3BlcnR5QWNjZXNzb3IgPSBmdW5jdGlvbihzZWxmLCBjb25maWcsIGZpZWxkLCBzZXRIb29rKSB7XG4gIHJldHVybiBmdW5jdGlvbih4KSB7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gY29uZmlnW2ZpZWxkXTtcbiAgICBjb25maWdbZmllbGRdID0geDtcbiAgICBpZiAoc2V0SG9vaykgc2V0SG9vayh4KTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfTtcbn07XG5cbi8qXG4gKiBHaXZlbiBhIGxheWVyZWQsIGRpcmVjdGVkIGdyYXBoIHdpdGggYHJhbmtgIGFuZCBgb3JkZXJgIG5vZGUgYXR0cmlidXRlcyxcbiAqIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBhcnJheSBvZiBvcmRlcmVkIHJhbmtzLiBFYWNoIHJhbmsgY29udGFpbnMgYW4gYXJyYXlcbiAqIG9mIHRoZSBpZHMgb2YgdGhlIG5vZGVzIGluIHRoYXQgcmFuayBpbiB0aGUgb3JkZXIgc3BlY2lmaWVkIGJ5IHRoZSBgb3JkZXJgXG4gKiBhdHRyaWJ1dGUuXG4gKi9cbmV4cG9ydHMub3JkZXJpbmcgPSBmdW5jdGlvbihnKSB7XG4gIHZhciBvcmRlcmluZyA9IFtdO1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgdmFyIHJhbmsgPSBvcmRlcmluZ1t2YWx1ZS5yYW5rXSB8fCAob3JkZXJpbmdbdmFsdWUucmFua10gPSBbXSk7XG4gICAgcmFua1t2YWx1ZS5vcmRlcl0gPSB1O1xuICB9KTtcbiAgcmV0dXJuIG9yZGVyaW5nO1xufTtcblxuLypcbiAqIEEgZmlsdGVyIHRoYXQgY2FuIGJlIHVzZWQgd2l0aCBgZmlsdGVyTm9kZXNgIHRvIGdldCBhIGdyYXBoIHRoYXQgb25seVxuICogaW5jbHVkZXMgbm9kZXMgdGhhdCBkbyBub3QgY29udGFpbiBvdGhlcnMgbm9kZXMuXG4gKi9cbmV4cG9ydHMuZmlsdGVyTm9uU3ViZ3JhcGhzID0gZnVuY3Rpb24oZykge1xuICByZXR1cm4gZnVuY3Rpb24odSkge1xuICAgIHJldHVybiBnLmNoaWxkcmVuKHUpLmxlbmd0aCA9PT0gMDtcbiAgfTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGEgbmV3IGZ1bmN0aW9uIHRoYXQgd3JhcHMgYGZ1bmNgIHdpdGggYSB0aW1lci4gVGhlIHdyYXBwZXIgbG9ncyB0aGVcbiAqIHRpbWUgaXQgdGFrZXMgdG8gZXhlY3V0ZSB0aGUgZnVuY3Rpb24uXG4gKlxuICogVGhlIHRpbWVyIHdpbGwgYmUgZW5hYmxlZCBwcm92aWRlZCBgbG9nLmxldmVsID49IDFgLlxuICovXG5mdW5jdGlvbiB0aW1lKG5hbWUsIGZ1bmMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGFydCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZnVuYy5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBsb2coMSwgbmFtZSArICcgdGltZTogJyArIChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHN0YXJ0KSArICdtcycpO1xuICAgIH1cbiAgfTtcbn1cbnRpbWUuZW5hYmxlZCA9IGZhbHNlO1xuXG5leHBvcnRzLnRpbWUgPSB0aW1lO1xuXG4vKlxuICogQSBnbG9iYWwgbG9nZ2VyIHdpdGggdGhlIHNwZWNpZmljYXRpb24gYGxvZyhsZXZlbCwgbWVzc2FnZSwgLi4uKWAgdGhhdFxuICogd2lsbCBsb2cgYSBtZXNzYWdlIHRvIHRoZSBjb25zb2xlIGlmIGBsb2cubGV2ZWwgPj0gbGV2ZWxgLlxuICovXG5mdW5jdGlvbiBsb2cobGV2ZWwpIHtcbiAgaWYgKGxvZy5sZXZlbCA+PSBsZXZlbCkge1xuICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICB9XG59XG5sb2cubGV2ZWwgPSAwO1xuXG5leHBvcnRzLmxvZyA9IGxvZztcbiIsIm1vZHVsZS5leHBvcnRzID0gJzAuNC41JztcbiIsImV4cG9ydHMuU2V0ID0gcmVxdWlyZSgnLi9saWIvU2V0Jyk7XG5leHBvcnRzLlByaW9yaXR5UXVldWUgPSByZXF1aXJlKCcuL2xpYi9Qcmlvcml0eVF1ZXVlJyk7XG5leHBvcnRzLnZlcnNpb24gPSByZXF1aXJlKCcuL2xpYi92ZXJzaW9uJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFByaW9yaXR5UXVldWU7XG5cbi8qKlxuICogQSBtaW4tcHJpb3JpdHkgcXVldWUgZGF0YSBzdHJ1Y3R1cmUuIFRoaXMgYWxnb3JpdGhtIGlzIGRlcml2ZWQgZnJvbSBDb3JtZW4sXG4gKiBldCBhbC4sIFwiSW50cm9kdWN0aW9uIHRvIEFsZ29yaXRobXNcIi4gVGhlIGJhc2ljIGlkZWEgb2YgYSBtaW4tcHJpb3JpdHlcbiAqIHF1ZXVlIGlzIHRoYXQgeW91IGNhbiBlZmZpY2llbnRseSAoaW4gTygxKSB0aW1lKSBnZXQgdGhlIHNtYWxsZXN0IGtleSBpblxuICogdGhlIHF1ZXVlLiBBZGRpbmcgYW5kIHJlbW92aW5nIGVsZW1lbnRzIHRha2VzIE8obG9nIG4pIHRpbWUuIEEga2V5IGNhblxuICogaGF2ZSBpdHMgcHJpb3JpdHkgZGVjcmVhc2VkIGluIE8obG9nIG4pIHRpbWUuXG4gKi9cbmZ1bmN0aW9uIFByaW9yaXR5UXVldWUoKSB7XG4gIHRoaXMuX2FyciA9IFtdO1xuICB0aGlzLl9rZXlJbmRpY2VzID0ge307XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIHRoZSBxdWV1ZS4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLnNpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2Fyci5sZW5ndGg7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGtleXMgdGhhdCBhcmUgaW4gdGhlIHF1ZXVlLiBUYWtlcyBgTyhuKWAgdGltZS5cbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fYXJyLm1hcChmdW5jdGlvbih4KSB7IHJldHVybiB4LmtleTsgfSk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYHRydWVgIGlmICoqa2V5KiogaXMgaW4gdGhlIHF1ZXVlIGFuZCBgZmFsc2VgIGlmIG5vdC5cbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24oa2V5KSB7XG4gIHJldHVybiBrZXkgaW4gdGhpcy5fa2V5SW5kaWNlcztcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgcHJpb3JpdHkgZm9yICoqa2V5KiouIElmICoqa2V5KiogaXMgbm90IHByZXNlbnQgaW4gdGhlIHF1ZXVlXG4gKiB0aGVuIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBgdW5kZWZpbmVkYC4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGtleVxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5wcmlvcml0eSA9IGZ1bmN0aW9uKGtleSkge1xuICB2YXIgaW5kZXggPSB0aGlzLl9rZXlJbmRpY2VzW2tleV07XG4gIGlmIChpbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHRoaXMuX2FycltpbmRleF0ucHJpb3JpdHk7XG4gIH1cbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUga2V5IGZvciB0aGUgbWluaW11bSBlbGVtZW50IGluIHRoaXMgcXVldWUuIElmIHRoZSBxdWV1ZSBpc1xuICogZW1wdHkgdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuIFRha2VzIGBPKDEpYCB0aW1lLlxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5taW4gPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuc2l6ZSgpID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiUXVldWUgdW5kZXJmbG93XCIpO1xuICB9XG4gIHJldHVybiB0aGlzLl9hcnJbMF0ua2V5O1xufTtcblxuLyoqXG4gKiBJbnNlcnRzIGEgbmV3IGtleSBpbnRvIHRoZSBwcmlvcml0eSBxdWV1ZS4gSWYgdGhlIGtleSBhbHJlYWR5IGV4aXN0cyBpblxuICogdGhlIHF1ZXVlIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBgZmFsc2VgOyBvdGhlcndpc2UgaXQgd2lsbCByZXR1cm4gYHRydWVgLlxuICogVGFrZXMgYE8obilgIHRpbWUuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGtleSB0aGUga2V5IHRvIGFkZFxuICogQHBhcmFtIHtOdW1iZXJ9IHByaW9yaXR5IHRoZSBpbml0aWFsIHByaW9yaXR5IGZvciB0aGUga2V5XG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGtleSwgcHJpb3JpdHkpIHtcbiAgdmFyIGtleUluZGljZXMgPSB0aGlzLl9rZXlJbmRpY2VzO1xuICBpZiAoIShrZXkgaW4ga2V5SW5kaWNlcykpIHtcbiAgICB2YXIgYXJyID0gdGhpcy5fYXJyO1xuICAgIHZhciBpbmRleCA9IGFyci5sZW5ndGg7XG4gICAga2V5SW5kaWNlc1trZXldID0gaW5kZXg7XG4gICAgYXJyLnB1c2goe2tleToga2V5LCBwcmlvcml0eTogcHJpb3JpdHl9KTtcbiAgICB0aGlzLl9kZWNyZWFzZShpbmRleCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBSZW1vdmVzIGFuZCByZXR1cm5zIHRoZSBzbWFsbGVzdCBrZXkgaW4gdGhlIHF1ZXVlLiBUYWtlcyBgTyhsb2cgbilgIHRpbWUuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLnJlbW92ZU1pbiA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9zd2FwKDAsIHRoaXMuX2Fyci5sZW5ndGggLSAxKTtcbiAgdmFyIG1pbiA9IHRoaXMuX2Fyci5wb3AoKTtcbiAgZGVsZXRlIHRoaXMuX2tleUluZGljZXNbbWluLmtleV07XG4gIHRoaXMuX2hlYXBpZnkoMCk7XG4gIHJldHVybiBtaW4ua2V5O1xufTtcblxuLyoqXG4gKiBEZWNyZWFzZXMgdGhlIHByaW9yaXR5IGZvciAqKmtleSoqIHRvICoqcHJpb3JpdHkqKi4gSWYgdGhlIG5ldyBwcmlvcml0eSBpc1xuICogZ3JlYXRlciB0aGFuIHRoZSBwcmV2aW91cyBwcmlvcml0eSwgdGhpcyBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBrZXkgdGhlIGtleSBmb3Igd2hpY2ggdG8gcmFpc2UgcHJpb3JpdHlcbiAqIEBwYXJhbSB7TnVtYmVyfSBwcmlvcml0eSB0aGUgbmV3IHByaW9yaXR5IGZvciB0aGUga2V5XG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLmRlY3JlYXNlID0gZnVuY3Rpb24oa2V5LCBwcmlvcml0eSkge1xuICB2YXIgaW5kZXggPSB0aGlzLl9rZXlJbmRpY2VzW2tleV07XG4gIGlmIChwcmlvcml0eSA+IHRoaXMuX2FycltpbmRleF0ucHJpb3JpdHkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJOZXcgcHJpb3JpdHkgaXMgZ3JlYXRlciB0aGFuIGN1cnJlbnQgcHJpb3JpdHkuIFwiICtcbiAgICAgICAgXCJLZXk6IFwiICsga2V5ICsgXCIgT2xkOiBcIiArIHRoaXMuX2FycltpbmRleF0ucHJpb3JpdHkgKyBcIiBOZXc6IFwiICsgcHJpb3JpdHkpO1xuICB9XG4gIHRoaXMuX2FycltpbmRleF0ucHJpb3JpdHkgPSBwcmlvcml0eTtcbiAgdGhpcy5fZGVjcmVhc2UoaW5kZXgpO1xufTtcblxuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuX2hlYXBpZnkgPSBmdW5jdGlvbihpKSB7XG4gIHZhciBhcnIgPSB0aGlzLl9hcnI7XG4gIHZhciBsID0gMiAqIGksXG4gICAgICByID0gbCArIDEsXG4gICAgICBsYXJnZXN0ID0gaTtcbiAgaWYgKGwgPCBhcnIubGVuZ3RoKSB7XG4gICAgbGFyZ2VzdCA9IGFycltsXS5wcmlvcml0eSA8IGFycltsYXJnZXN0XS5wcmlvcml0eSA/IGwgOiBsYXJnZXN0O1xuICAgIGlmIChyIDwgYXJyLmxlbmd0aCkge1xuICAgICAgbGFyZ2VzdCA9IGFycltyXS5wcmlvcml0eSA8IGFycltsYXJnZXN0XS5wcmlvcml0eSA/IHIgOiBsYXJnZXN0O1xuICAgIH1cbiAgICBpZiAobGFyZ2VzdCAhPT0gaSkge1xuICAgICAgdGhpcy5fc3dhcChpLCBsYXJnZXN0KTtcbiAgICAgIHRoaXMuX2hlYXBpZnkobGFyZ2VzdCk7XG4gICAgfVxuICB9XG59O1xuXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5fZGVjcmVhc2UgPSBmdW5jdGlvbihpbmRleCkge1xuICB2YXIgYXJyID0gdGhpcy5fYXJyO1xuICB2YXIgcHJpb3JpdHkgPSBhcnJbaW5kZXhdLnByaW9yaXR5O1xuICB2YXIgcGFyZW50O1xuICB3aGlsZSAoaW5kZXggIT09IDApIHtcbiAgICBwYXJlbnQgPSBpbmRleCA+PiAxO1xuICAgIGlmIChhcnJbcGFyZW50XS5wcmlvcml0eSA8IHByaW9yaXR5KSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgdGhpcy5fc3dhcChpbmRleCwgcGFyZW50KTtcbiAgICBpbmRleCA9IHBhcmVudDtcbiAgfVxufTtcblxuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuX3N3YXAgPSBmdW5jdGlvbihpLCBqKSB7XG4gIHZhciBhcnIgPSB0aGlzLl9hcnI7XG4gIHZhciBrZXlJbmRpY2VzID0gdGhpcy5fa2V5SW5kaWNlcztcbiAgdmFyIG9yaWdBcnJJID0gYXJyW2ldO1xuICB2YXIgb3JpZ0FyckogPSBhcnJbal07XG4gIGFycltpXSA9IG9yaWdBcnJKO1xuICBhcnJbal0gPSBvcmlnQXJySTtcbiAga2V5SW5kaWNlc1tvcmlnQXJySi5rZXldID0gaTtcbiAga2V5SW5kaWNlc1tvcmlnQXJySS5rZXldID0gajtcbn07XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNldDtcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IFNldCB3aXRoIGFuIG9wdGlvbmFsIHNldCBvZiBgaW5pdGlhbEtleXNgLlxuICpcbiAqIEl0IGlzIGltcG9ydGFudCB0byBub3RlIHRoYXQga2V5cyBhcmUgY29lcmNlZCB0byBTdHJpbmcgZm9yIG1vc3QgcHVycG9zZXNcbiAqIHdpdGggdGhpcyBvYmplY3QsIHNpbWlsYXIgdG8gdGhlIGJlaGF2aW9yIG9mIEphdmFTY3JpcHQncyBPYmplY3QuIEZvclxuICogZXhhbXBsZSwgdGhlIGZvbGxvd2luZyB3aWxsIGFkZCBvbmx5IG9uZSBrZXk6XG4gKlxuICogICAgIHZhciBzID0gbmV3IFNldCgpO1xuICogICAgIHMuYWRkKDEpO1xuICogICAgIHMuYWRkKFwiMVwiKTtcbiAqXG4gKiBIb3dldmVyLCB0aGUgdHlwZSBvZiB0aGUga2V5IGlzIHByZXNlcnZlZCBpbnRlcm5hbGx5IHNvIHRoYXQgYGtleXNgIHJldHVybnNcbiAqIHRoZSBvcmlnaW5hbCBrZXkgc2V0IHVuY29lcmNlZC4gRm9yIHRoZSBhYm92ZSBleGFtcGxlLCBga2V5c2Agd291bGQgcmV0dXJuXG4gKiBgWzFdYC5cbiAqL1xuZnVuY3Rpb24gU2V0KGluaXRpYWxLZXlzKSB7XG4gIHRoaXMuX3NpemUgPSAwO1xuICB0aGlzLl9rZXlzID0ge307XG5cbiAgaWYgKGluaXRpYWxLZXlzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGlsID0gaW5pdGlhbEtleXMubGVuZ3RoOyBpIDwgaWw7ICsraSkge1xuICAgICAgdGhpcy5hZGQoaW5pdGlhbEtleXNbaV0pO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgU2V0IHRoYXQgcmVwcmVzZW50cyB0aGUgc2V0IGludGVyc2VjdGlvbiBvZiB0aGUgYXJyYXkgb2YgZ2l2ZW5cbiAqIHNldHMuXG4gKi9cblNldC5pbnRlcnNlY3QgPSBmdW5jdGlvbihzZXRzKSB7XG4gIGlmIChzZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgU2V0KCk7XG4gIH1cblxuICB2YXIgcmVzdWx0ID0gbmV3IFNldCghdXRpbC5pc0FycmF5KHNldHNbMF0pID8gc2V0c1swXS5rZXlzKCkgOiBzZXRzWzBdKTtcbiAgZm9yICh2YXIgaSA9IDEsIGlsID0gc2V0cy5sZW5ndGg7IGkgPCBpbDsgKytpKSB7XG4gICAgdmFyIHJlc3VsdEtleXMgPSByZXN1bHQua2V5cygpLFxuICAgICAgICBvdGhlciA9ICF1dGlsLmlzQXJyYXkoc2V0c1tpXSkgPyBzZXRzW2ldIDogbmV3IFNldChzZXRzW2ldKTtcbiAgICBmb3IgKHZhciBqID0gMCwgamwgPSByZXN1bHRLZXlzLmxlbmd0aDsgaiA8IGpsOyArK2opIHtcbiAgICAgIHZhciBrZXkgPSByZXN1bHRLZXlzW2pdO1xuICAgICAgaWYgKCFvdGhlci5oYXMoa2V5KSkge1xuICAgICAgICByZXN1bHQucmVtb3ZlKGtleSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIG5ldyBTZXQgdGhhdCByZXByZXNlbnRzIHRoZSBzZXQgdW5pb24gb2YgdGhlIGFycmF5IG9mIGdpdmVuIHNldHMuXG4gKi9cblNldC51bmlvbiA9IGZ1bmN0aW9uKHNldHMpIHtcbiAgdmFyIHRvdGFsRWxlbXMgPSB1dGlsLnJlZHVjZShzZXRzLCBmdW5jdGlvbihsaHMsIHJocykge1xuICAgIHJldHVybiBsaHMgKyAocmhzLnNpemUgPyByaHMuc2l6ZSgpIDogcmhzLmxlbmd0aCk7XG4gIH0sIDApO1xuICB2YXIgYXJyID0gbmV3IEFycmF5KHRvdGFsRWxlbXMpO1xuXG4gIHZhciBrID0gMDtcbiAgZm9yICh2YXIgaSA9IDAsIGlsID0gc2V0cy5sZW5ndGg7IGkgPCBpbDsgKytpKSB7XG4gICAgdmFyIGN1ciA9IHNldHNbaV0sXG4gICAgICAgIGtleXMgPSAhdXRpbC5pc0FycmF5KGN1cikgPyBjdXIua2V5cygpIDogY3VyO1xuICAgIGZvciAodmFyIGogPSAwLCBqbCA9IGtleXMubGVuZ3RoOyBqIDwgamw7ICsraikge1xuICAgICAgYXJyW2srK10gPSBrZXlzW2pdO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgU2V0KGFycik7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHNpemUgb2YgdGhpcyBzZXQgaW4gYE8oMSlgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUuc2l6ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fc2l6ZTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUga2V5cyBpbiB0aGlzIHNldC4gVGFrZXMgYE8obilgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdmFsdWVzKHRoaXMuX2tleXMpO1xufTtcblxuLyoqXG4gKiBUZXN0cyBpZiBhIGtleSBpcyBwcmVzZW50IGluIHRoaXMgU2V0LiBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbmQgYGZhbHNlYFxuICogaWYgbm90LiBUYWtlcyBgTygxKWAgdGltZS5cbiAqL1xuU2V0LnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgcmV0dXJuIGtleSBpbiB0aGlzLl9rZXlzO1xufTtcblxuLyoqXG4gKiBBZGRzIGEgbmV3IGtleSB0byB0aGlzIFNldCBpZiBpdCBpcyBub3QgYWxyZWFkeSBwcmVzZW50LiBSZXR1cm5zIGB0cnVlYCBpZlxuICogdGhlIGtleSB3YXMgYWRkZWQgYW5kIGBmYWxzZWAgaWYgaXQgd2FzIGFscmVhZHkgcHJlc2VudC4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oa2V5KSB7XG4gIGlmICghKGtleSBpbiB0aGlzLl9rZXlzKSkge1xuICAgIHRoaXMuX2tleXNba2V5XSA9IGtleTtcbiAgICArK3RoaXMuX3NpemU7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBSZW1vdmVzIGEga2V5IGZyb20gdGhpcyBTZXQuIElmIHRoZSBrZXkgd2FzIHJlbW92ZWQgdGhpcyBmdW5jdGlvbiByZXR1cm5zXG4gKiBgdHJ1ZWAuIElmIG5vdCwgaXQgcmV0dXJucyBgZmFsc2VgLiBUYWtlcyBgTygxKWAgdGltZS5cbiAqL1xuU2V0LnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihrZXkpIHtcbiAgaWYgKGtleSBpbiB0aGlzLl9rZXlzKSB7XG4gICAgZGVsZXRlIHRoaXMuX2tleXNba2V5XTtcbiAgICAtLXRoaXMuX3NpemU7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgYWxsIHZhbHVlcyBmb3IgcHJvcGVydGllcyBvZiAqKm8qKi5cbiAqL1xuZnVuY3Rpb24gdmFsdWVzKG8pIHtcbiAgdmFyIGtzID0gT2JqZWN0LmtleXMobyksXG4gICAgICBsZW4gPSBrcy5sZW5ndGgsXG4gICAgICByZXN1bHQgPSBuZXcgQXJyYXkobGVuKSxcbiAgICAgIGk7XG4gIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHJlc3VsdFtpXSA9IG9ba3NbaV1dO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG4iLCIvKlxuICogVGhpcyBwb2x5ZmlsbCBjb21lcyBmcm9tXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9pc0FycmF5XG4gKi9cbmlmKCFBcnJheS5pc0FycmF5KSB7XG4gIGV4cG9ydHMuaXNBcnJheSA9IGZ1bmN0aW9uICh2QXJnKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2QXJnKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcbn0gZWxzZSB7XG4gIGV4cG9ydHMuaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG59XG5cbi8qXG4gKiBTbGlnaHRseSBhZGFwdGVkIHBvbHlmaWxsIGZyb21cbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L1JlZHVjZVxuICovXG5pZiAoJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UpIHtcbiAgZXhwb3J0cy5yZWR1Y2UgPSBmdW5jdGlvbihhcnJheSwgY2FsbGJhY2ssIG9wdF9pbml0aWFsVmFsdWUpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgaWYgKG51bGwgPT09IGFycmF5IHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2YgYXJyYXkpIHtcbiAgICAgIC8vIEF0IHRoZSBtb21lbnQgYWxsIG1vZGVybiBicm93c2VycywgdGhhdCBzdXBwb3J0IHN0cmljdCBtb2RlLCBoYXZlXG4gICAgICAvLyBuYXRpdmUgaW1wbGVtZW50YXRpb24gb2YgQXJyYXkucHJvdG90eXBlLnJlZHVjZS4gRm9yIGluc3RhbmNlLCBJRThcbiAgICAgIC8vIGRvZXMgbm90IHN1cHBvcnQgc3RyaWN0IG1vZGUsIHNvIHRoaXMgY2hlY2sgaXMgYWN0dWFsbHkgdXNlbGVzcy5cbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgJ0FycmF5LnByb3RvdHlwZS5yZWR1Y2UgY2FsbGVkIG9uIG51bGwgb3IgdW5kZWZpbmVkJyk7XG4gICAgfVxuICAgIGlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YgY2FsbGJhY2spIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoY2FsbGJhY2sgKyAnIGlzIG5vdCBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIHZhciBpbmRleCwgdmFsdWUsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCA+Pj4gMCxcbiAgICAgICAgaXNWYWx1ZVNldCA9IGZhbHNlO1xuICAgIGlmICgxIDwgYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgdmFsdWUgPSBvcHRfaW5pdGlhbFZhbHVlO1xuICAgICAgaXNWYWx1ZVNldCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoaW5kZXggPSAwOyBsZW5ndGggPiBpbmRleDsgKytpbmRleCkge1xuICAgICAgaWYgKGFycmF5Lmhhc093blByb3BlcnR5KGluZGV4KSkge1xuICAgICAgICBpZiAoaXNWYWx1ZVNldCkge1xuICAgICAgICAgIHZhbHVlID0gY2FsbGJhY2sodmFsdWUsIGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IGFycmF5W2luZGV4XTtcbiAgICAgICAgICBpc1ZhbHVlU2V0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWlzVmFsdWVTZXQpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1JlZHVjZSBvZiBlbXB0eSBhcnJheSB3aXRoIG5vIGluaXRpYWwgdmFsdWUnKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xufSBlbHNlIHtcbiAgZXhwb3J0cy5yZWR1Y2UgPSBmdW5jdGlvbihhcnJheSwgY2FsbGJhY2ssIG9wdF9pbml0aWFsVmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkucmVkdWNlKGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKTtcbiAgfTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gJzEuMS4zJztcbiIsImV4cG9ydHMuR3JhcGggPSByZXF1aXJlKFwiLi9saWIvR3JhcGhcIik7XG5leHBvcnRzLkRpZ3JhcGggPSByZXF1aXJlKFwiLi9saWIvRGlncmFwaFwiKTtcbmV4cG9ydHMuQ0dyYXBoID0gcmVxdWlyZShcIi4vbGliL0NHcmFwaFwiKTtcbmV4cG9ydHMuQ0RpZ3JhcGggPSByZXF1aXJlKFwiLi9saWIvQ0RpZ3JhcGhcIik7XG5yZXF1aXJlKFwiLi9saWIvZ3JhcGgtY29udmVydGVyc1wiKTtcblxuZXhwb3J0cy5hbGcgPSB7XG4gIGlzQWN5Y2xpYzogcmVxdWlyZShcIi4vbGliL2FsZy9pc0FjeWNsaWNcIiksXG4gIGNvbXBvbmVudHM6IHJlcXVpcmUoXCIuL2xpYi9hbGcvY29tcG9uZW50c1wiKSxcbiAgZGlqa3N0cmE6IHJlcXVpcmUoXCIuL2xpYi9hbGcvZGlqa3N0cmFcIiksXG4gIGRpamtzdHJhQWxsOiByZXF1aXJlKFwiLi9saWIvYWxnL2RpamtzdHJhQWxsXCIpLFxuICBmaW5kQ3ljbGVzOiByZXF1aXJlKFwiLi9saWIvYWxnL2ZpbmRDeWNsZXNcIiksXG4gIGZsb3lkV2Fyc2hhbGw6IHJlcXVpcmUoXCIuL2xpYi9hbGcvZmxveWRXYXJzaGFsbFwiKSxcbiAgcG9zdG9yZGVyOiByZXF1aXJlKFwiLi9saWIvYWxnL3Bvc3RvcmRlclwiKSxcbiAgcHJlb3JkZXI6IHJlcXVpcmUoXCIuL2xpYi9hbGcvcHJlb3JkZXJcIiksXG4gIHByaW06IHJlcXVpcmUoXCIuL2xpYi9hbGcvcHJpbVwiKSxcbiAgdGFyamFuOiByZXF1aXJlKFwiLi9saWIvYWxnL3RhcmphblwiKSxcbiAgdG9wc29ydDogcmVxdWlyZShcIi4vbGliL2FsZy90b3Bzb3J0XCIpXG59O1xuXG5leHBvcnRzLmNvbnZlcnRlciA9IHtcbiAganNvbjogcmVxdWlyZShcIi4vbGliL2NvbnZlcnRlci9qc29uLmpzXCIpXG59O1xuXG52YXIgZmlsdGVyID0gcmVxdWlyZShcIi4vbGliL2ZpbHRlclwiKTtcbmV4cG9ydHMuZmlsdGVyID0ge1xuICBhbGw6IGZpbHRlci5hbGwsXG4gIG5vZGVzRnJvbUxpc3Q6IGZpbHRlci5ub2Rlc0Zyb21MaXN0XG59O1xuXG5leHBvcnRzLnZlcnNpb24gPSByZXF1aXJlKFwiLi9saWIvdmVyc2lvblwiKTtcbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VHcmFwaDtcblxuZnVuY3Rpb24gQmFzZUdyYXBoKCkge1xuICAvLyBUaGUgdmFsdWUgYXNzaWduZWQgdG8gdGhlIGdyYXBoIGl0c2VsZi5cbiAgdGhpcy5fdmFsdWUgPSB1bmRlZmluZWQ7XG5cbiAgLy8gTWFwIG9mIG5vZGUgaWQgLT4geyBpZCwgdmFsdWUgfVxuICB0aGlzLl9ub2RlcyA9IHt9O1xuXG4gIC8vIE1hcCBvZiBlZGdlIGlkIC0+IHsgaWQsIHUsIHYsIHZhbHVlIH1cbiAgdGhpcy5fZWRnZXMgPSB7fTtcblxuICAvLyBVc2VkIHRvIGdlbmVyYXRlIGEgdW5pcXVlIGlkIGluIHRoZSBncmFwaFxuICB0aGlzLl9uZXh0SWQgPSAwO1xufVxuXG4vLyBOdW1iZXIgb2Ygbm9kZXNcbkJhc2VHcmFwaC5wcm90b3R5cGUub3JkZXIgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX25vZGVzKS5sZW5ndGg7XG59O1xuXG4vLyBOdW1iZXIgb2YgZWRnZXNcbkJhc2VHcmFwaC5wcm90b3R5cGUuc2l6ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZWRnZXMpLmxlbmd0aDtcbn07XG5cbi8vIEFjY2Vzc29yIGZvciBncmFwaCBsZXZlbCB2YWx1ZVxuQmFzZUdyYXBoLnByb3RvdHlwZS5ncmFwaCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHRoaXMuX3ZhbHVlO1xuICB9XG4gIHRoaXMuX3ZhbHVlID0gdmFsdWU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmhhc05vZGUgPSBmdW5jdGlvbih1KSB7XG4gIHJldHVybiB1IGluIHRoaXMuX25vZGVzO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5ub2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgdmFyIG5vZGUgPSB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIG5vZGUudmFsdWUgPSB2YWx1ZTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUubm9kZXMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5vZGVzID0gW107XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24oaWQpIHsgbm9kZXMucHVzaChpZCk7IH0pO1xuICByZXR1cm4gbm9kZXM7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmVhY2hOb2RlID0gZnVuY3Rpb24oZnVuYykge1xuICBmb3IgKHZhciBrIGluIHRoaXMuX25vZGVzKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLl9ub2Rlc1trXTtcbiAgICBmdW5jKG5vZGUuaWQsIG5vZGUudmFsdWUpO1xuICB9XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmhhc0VkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIHJldHVybiBlIGluIHRoaXMuX2VkZ2VzO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5lZGdlID0gZnVuY3Rpb24oZSwgdmFsdWUpIHtcbiAgdmFyIGVkZ2UgPSB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBlZGdlLnZhbHVlO1xuICB9XG4gIGVkZ2UudmFsdWUgPSB2YWx1ZTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZWRnZXMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGVzID0gW107XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oaWQpIHsgZXMucHVzaChpZCk7IH0pO1xuICByZXR1cm4gZXM7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmVhY2hFZGdlID0gZnVuY3Rpb24oZnVuYykge1xuICBmb3IgKHZhciBrIGluIHRoaXMuX2VkZ2VzKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLl9lZGdlc1trXTtcbiAgICBmdW5jKGVkZ2UuaWQsIGVkZ2UudSwgZWRnZS52LCBlZGdlLnZhbHVlKTtcbiAgfVxufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5pbmNpZGVudE5vZGVzID0gZnVuY3Rpb24oZSkge1xuICB2YXIgZWRnZSA9IHRoaXMuX3N0cmljdEdldEVkZ2UoZSk7XG4gIHJldHVybiBbZWRnZS51LCBlZGdlLnZdO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5hZGROb2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgaWYgKHUgPT09IHVuZGVmaW5lZCB8fCB1ID09PSBudWxsKSB7XG4gICAgZG8ge1xuICAgICAgdSA9IFwiX1wiICsgKCsrdGhpcy5fbmV4dElkKTtcbiAgICB9IHdoaWxlICh0aGlzLmhhc05vZGUodSkpO1xuICB9IGVsc2UgaWYgKHRoaXMuaGFzTm9kZSh1KSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkdyYXBoIGFscmVhZHkgaGFzIG5vZGUgJ1wiICsgdSArIFwiJ1wiKTtcbiAgfVxuICB0aGlzLl9ub2Rlc1t1XSA9IHsgaWQ6IHUsIHZhbHVlOiB2YWx1ZSB9O1xuICByZXR1cm4gdTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZGVsTm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgdGhpcy5pbmNpZGVudEVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkgeyB0aGlzLmRlbEVkZ2UoZSk7IH0sIHRoaXMpO1xuICBkZWxldGUgdGhpcy5fbm9kZXNbdV07XG59O1xuXG4vLyBpbk1hcCBhbmQgb3V0TWFwIGFyZSBvcHBvc2l0ZSBzaWRlcyBvZiBhbiBpbmNpZGVuY2UgbWFwLiBGb3IgZXhhbXBsZSwgZm9yXG4vLyBHcmFwaCB0aGVzZSB3b3VsZCBib3RoIGNvbWUgZnJvbSB0aGUgX2luY2lkZW50RWRnZXMgbWFwLCB3aGlsZSBmb3IgRGlncmFwaFxuLy8gdGhleSB3b3VsZCBjb21lIGZyb20gX2luRWRnZXMgYW5kIF9vdXRFZGdlcy5cbkJhc2VHcmFwaC5wcm90b3R5cGUuX2FkZEVkZ2UgPSBmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSwgaW5NYXAsIG91dE1hcCkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHYpO1xuXG4gIGlmIChlID09PSB1bmRlZmluZWQgfHwgZSA9PT0gbnVsbCkge1xuICAgIGRvIHtcbiAgICAgIGUgPSBcIl9cIiArICgrK3RoaXMuX25leHRJZCk7XG4gICAgfSB3aGlsZSAodGhpcy5oYXNFZGdlKGUpKTtcbiAgfVxuICBlbHNlIGlmICh0aGlzLmhhc0VkZ2UoZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJHcmFwaCBhbHJlYWR5IGhhcyBlZGdlICdcIiArIGUgKyBcIidcIik7XG4gIH1cblxuICB0aGlzLl9lZGdlc1tlXSA9IHsgaWQ6IGUsIHU6IHUsIHY6IHYsIHZhbHVlOiB2YWx1ZSB9O1xuICBhZGRFZGdlVG9NYXAoaW5NYXBbdl0sIHUsIGUpO1xuICBhZGRFZGdlVG9NYXAob3V0TWFwW3VdLCB2LCBlKTtcblxuICByZXR1cm4gZTtcbn07XG5cbi8vIFNlZSBub3RlIGZvciBfYWRkRWRnZSByZWdhcmRpbmcgaW5NYXAgYW5kIG91dE1hcC5cbkJhc2VHcmFwaC5wcm90b3R5cGUuX2RlbEVkZ2UgPSBmdW5jdGlvbihlLCBpbk1hcCwgb3V0TWFwKSB7XG4gIHZhciBlZGdlID0gdGhpcy5fc3RyaWN0R2V0RWRnZShlKTtcbiAgZGVsRWRnZUZyb21NYXAoaW5NYXBbZWRnZS52XSwgZWRnZS51LCBlKTtcbiAgZGVsRWRnZUZyb21NYXAob3V0TWFwW2VkZ2UudV0sIGVkZ2UudiwgZSk7XG4gIGRlbGV0ZSB0aGlzLl9lZGdlc1tlXTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgY29weSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gIGNvcHkuZ3JhcGgodGhpcy5ncmFwaCgpKTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkgeyBjb3B5LmFkZE5vZGUodSwgdmFsdWUpOyB9KTtcbiAgdGhpcy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkgeyBjb3B5LmFkZEVkZ2UoZSwgdSwgdiwgdmFsdWUpOyB9KTtcbiAgY29weS5fbmV4dElkID0gdGhpcy5fbmV4dElkO1xuICByZXR1cm4gY29weTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZmlsdGVyTm9kZXMgPSBmdW5jdGlvbihmaWx0ZXIpIHtcbiAgdmFyIGNvcHkgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICBjb3B5LmdyYXBoKHRoaXMuZ3JhcGgoKSk7XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICBpZiAoZmlsdGVyKHUpKSB7XG4gICAgICBjb3B5LmFkZE5vZGUodSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBpZiAoY29weS5oYXNOb2RlKHUpICYmIGNvcHkuaGFzTm9kZSh2KSkge1xuICAgICAgY29weS5hZGRFZGdlKGUsIHUsIHYsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gY29weTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuX3N0cmljdEdldE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gIHZhciBub2RlID0gdGhpcy5fbm9kZXNbdV07XG4gIGlmIChub2RlID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb2RlICdcIiArIHUgKyBcIicgaXMgbm90IGluIGdyYXBoXCIpO1xuICB9XG4gIHJldHVybiBub2RlO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5fc3RyaWN0R2V0RWRnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgdmFyIGVkZ2UgPSB0aGlzLl9lZGdlc1tlXTtcbiAgaWYgKGVkZ2UgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkVkZ2UgJ1wiICsgZSArIFwiJyBpcyBub3QgaW4gZ3JhcGhcIik7XG4gIH1cbiAgcmV0dXJuIGVkZ2U7XG59O1xuXG5mdW5jdGlvbiBhZGRFZGdlVG9NYXAobWFwLCB2LCBlKSB7XG4gIChtYXBbdl0gfHwgKG1hcFt2XSA9IG5ldyBTZXQoKSkpLmFkZChlKTtcbn1cblxuZnVuY3Rpb24gZGVsRWRnZUZyb21NYXAobWFwLCB2LCBlKSB7XG4gIHZhciB2RW50cnkgPSBtYXBbdl07XG4gIHZFbnRyeS5yZW1vdmUoZSk7XG4gIGlmICh2RW50cnkuc2l6ZSgpID09PSAwKSB7XG4gICAgZGVsZXRlIG1hcFt2XTtcbiAgfVxufVxuXG4iLCJ2YXIgRGlncmFwaCA9IHJlcXVpcmUoXCIuL0RpZ3JhcGhcIiksXG4gICAgY29tcG91bmRpZnkgPSByZXF1aXJlKFwiLi9jb21wb3VuZGlmeVwiKTtcblxudmFyIENEaWdyYXBoID0gY29tcG91bmRpZnkoRGlncmFwaCk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ0RpZ3JhcGg7XG5cbkNEaWdyYXBoLmZyb21EaWdyYXBoID0gZnVuY3Rpb24oc3JjKSB7XG4gIHZhciBnID0gbmV3IENEaWdyYXBoKCksXG4gICAgICBncmFwaFZhbHVlID0gc3JjLmdyYXBoKCk7XG5cbiAgaWYgKGdyYXBoVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIGcuZ3JhcGgoZ3JhcGhWYWx1ZSk7XG4gIH1cblxuICBzcmMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5hZGROb2RlKHUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZE5vZGUodSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHNyYy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGc7XG59O1xuXG5DRGlncmFwaC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiQ0RpZ3JhcGggXCIgKyBKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCAyKTtcbn07XG4iLCJ2YXIgR3JhcGggPSByZXF1aXJlKFwiLi9HcmFwaFwiKSxcbiAgICBjb21wb3VuZGlmeSA9IHJlcXVpcmUoXCIuL2NvbXBvdW5kaWZ5XCIpO1xuXG52YXIgQ0dyYXBoID0gY29tcG91bmRpZnkoR3JhcGgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENHcmFwaDtcblxuQ0dyYXBoLmZyb21HcmFwaCA9IGZ1bmN0aW9uKHNyYykge1xuICB2YXIgZyA9IG5ldyBDR3JhcGgoKSxcbiAgICAgIGdyYXBoVmFsdWUgPSBzcmMuZ3JhcGgoKTtcblxuICBpZiAoZ3JhcGhWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZy5ncmFwaChncmFwaFZhbHVlKTtcbiAgfVxuXG4gIHNyYy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLmFkZE5vZGUodSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkTm9kZSh1LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgc3JjLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZztcbn07XG5cbkNHcmFwaC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiQ0dyYXBoIFwiICsgSlNPTi5zdHJpbmdpZnkodGhpcywgbnVsbCwgMik7XG59O1xuIiwiLypcbiAqIFRoaXMgZmlsZSBpcyBvcmdhbml6ZWQgd2l0aCBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICpcbiAqIEV4cG9ydHNcbiAqIEdyYXBoIGNvbnN0cnVjdG9yc1xuICogR3JhcGggcXVlcmllcyAoZS5nLiBub2RlcygpLCBlZGdlcygpXG4gKiBHcmFwaCBtdXRhdG9yc1xuICogSGVscGVyIGZ1bmN0aW9uc1xuICovXG5cbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKSxcbiAgICBCYXNlR3JhcGggPSByZXF1aXJlKFwiLi9CYXNlR3JhcGhcIiksXG4vKiBqc2hpbnQgLVcwNzkgKi9cbiAgICBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBEaWdyYXBoO1xuXG4vKlxuICogQ29uc3RydWN0b3IgdG8gY3JlYXRlIGEgbmV3IGRpcmVjdGVkIG11bHRpLWdyYXBoLlxuICovXG5mdW5jdGlvbiBEaWdyYXBoKCkge1xuICBCYXNlR3JhcGguY2FsbCh0aGlzKTtcblxuICAvKiEgTWFwIG9mIHNvdXJjZUlkIC0+IHt0YXJnZXRJZCAtPiBTZXQgb2YgZWRnZSBpZHN9ICovXG4gIHRoaXMuX2luRWRnZXMgPSB7fTtcblxuICAvKiEgTWFwIG9mIHRhcmdldElkIC0+IHtzb3VyY2VJZCAtPiBTZXQgb2YgZWRnZSBpZHN9ICovXG4gIHRoaXMuX291dEVkZ2VzID0ge307XG59XG5cbkRpZ3JhcGgucHJvdG90eXBlID0gbmV3IEJhc2VHcmFwaCgpO1xuRGlncmFwaC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBEaWdyYXBoO1xuXG4vKlxuICogQWx3YXlzIHJldHVybnMgYHRydWVgLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5pc0RpcmVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIHN1Y2Nlc3NvcnMgb2YgdGhlIG5vZGUgd2l0aCB0aGUgaWQgYHVgLiBUaGF0IGlzLCBhbGwgbm9kZXNcbiAqIHRoYXQgaGF2ZSB0aGUgbm9kZSBgdWAgYXMgdGhlaXIgc291cmNlIGFyZSByZXR1cm5lZC5cbiAqIFxuICogSWYgbm8gbm9kZSBgdWAgZXhpc3RzIGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuc3VjY2Vzc29ycyA9IGZ1bmN0aW9uKHUpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX291dEVkZ2VzW3VdKVxuICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbih2KSB7IHJldHVybiB0aGlzLl9ub2Rlc1t2XS5pZDsgfSwgdGhpcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgcHJlZGVjZXNzb3JzIG9mIHRoZSBub2RlIHdpdGggdGhlIGlkIGB1YC4gVGhhdCBpcywgYWxsIG5vZGVzXG4gKiB0aGF0IGhhdmUgdGhlIG5vZGUgYHVgIGFzIHRoZWlyIHRhcmdldCBhcmUgcmV0dXJuZWQuXG4gKiBcbiAqIElmIG5vIG5vZGUgYHVgIGV4aXN0cyBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnByZWRlY2Vzc29ycyA9IGZ1bmN0aW9uKHUpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2luRWRnZXNbdV0pXG4gICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHRoaXMuX25vZGVzW3ZdLmlkOyB9LCB0aGlzKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBub2RlcyB0aGF0IGFyZSBhZGphY2VudCB0byB0aGUgbm9kZSB3aXRoIHRoZSBpZCBgdWAuIEluIG90aGVyXG4gKiB3b3JkcywgdGhpcyBmdW5jdGlvbiByZXR1cm5zIHRoZSBzZXQgb2YgYWxsIHN1Y2Nlc3NvcnMgYW5kIHByZWRlY2Vzc29ycyBvZlxuICogbm9kZSBgdWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLm5laWdoYm9ycyA9IGZ1bmN0aW9uKHUpIHtcbiAgcmV0dXJuIFNldC51bmlvbihbdGhpcy5zdWNjZXNzb3JzKHUpLCB0aGlzLnByZWRlY2Vzc29ycyh1KV0pLmtleXMoKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBub2RlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIG5vIGluLWVkZ2VzLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5zb3VyY2VzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgcmV0dXJuIHRoaXMuX2ZpbHRlck5vZGVzKGZ1bmN0aW9uKHUpIHtcbiAgICAvLyBUaGlzIGNvdWxkIGhhdmUgYmV0dGVyIHNwYWNlIGNoYXJhY3RlcmlzdGljcyBpZiB3ZSBoYWQgYW4gaW5EZWdyZWUgZnVuY3Rpb24uXG4gICAgcmV0dXJuIHNlbGYuaW5FZGdlcyh1KS5sZW5ndGggPT09IDA7XG4gIH0pO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIG5vZGVzIGluIHRoZSBncmFwaCB0aGF0IGhhdmUgbm8gb3V0LWVkZ2VzLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5zaW5rcyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHJldHVybiB0aGlzLl9maWx0ZXJOb2RlcyhmdW5jdGlvbih1KSB7XG4gICAgLy8gVGhpcyBjb3VsZCBoYXZlIGJldHRlciBzcGFjZSBjaGFyYWN0ZXJpc3RpY3MgaWYgd2UgaGF2ZSBhbiBvdXREZWdyZWUgZnVuY3Rpb24uXG4gICAgcmV0dXJuIHNlbGYub3V0RWRnZXModSkubGVuZ3RoID09PSAwO1xuICB9KTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIHRoZSBzb3VyY2Ugbm9kZSBpbmNpZGVudCBvbiB0aGUgZWRnZSBpZGVudGlmaWVkIGJ5IHRoZSBpZCBgZWAuIElmIG5vXG4gKiBzdWNoIGVkZ2UgZXhpc3RzIGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZSBhbiBlZGdlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnNvdXJjZSA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIHRoaXMuX3N0cmljdEdldEVkZ2UoZSkudTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIHRoZSB0YXJnZXQgbm9kZSBpbmNpZGVudCBvbiB0aGUgZWRnZSBpZGVudGlmaWVkIGJ5IHRoZSBpZCBgZWAuIElmIG5vXG4gKiBzdWNoIGVkZ2UgZXhpc3RzIGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZSBhbiBlZGdlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnRhcmdldCA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIHRoaXMuX3N0cmljdEdldEVkZ2UoZSkudjtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGlkcyBmb3IgYWxsIGVkZ2VzIGluIHRoZSBncmFwaCB0aGF0IGhhdmUgdGhlIG5vZGVcbiAqIGB0YXJnZXRgIGFzIHRoZWlyIHRhcmdldC4gSWYgdGhlIG5vZGUgYHRhcmdldGAgaXMgbm90IGluIHRoZSBncmFwaCB0aGlzXG4gKiBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogT3B0aW9uYWxseSBhIGBzb3VyY2VgIG5vZGUgY2FuIGFsc28gYmUgc3BlY2lmaWVkLiBUaGlzIGNhdXNlcyB0aGUgcmVzdWx0c1xuICogdG8gYmUgZmlsdGVyZWQgc3VjaCB0aGF0IG9ubHkgZWRnZXMgZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YCBhcmUgaW5jbHVkZWQuXG4gKiBJZiB0aGUgbm9kZSBgc291cmNlYCBpcyBzcGVjaWZpZWQgYnV0IGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhlbiB0aGlzIGZ1bmN0aW9uXG4gKiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHRhcmdldCB0aGUgdGFyZ2V0IG5vZGUgaWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBbc291cmNlXSBhbiBvcHRpb25hbCBzb3VyY2Ugbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5pbkVkZ2VzID0gZnVuY3Rpb24odGFyZ2V0LCBzb3VyY2UpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh0YXJnZXQpO1xuICB2YXIgcmVzdWx0cyA9IFNldC51bmlvbih1dGlsLnZhbHVlcyh0aGlzLl9pbkVkZ2VzW3RhcmdldF0pKS5rZXlzKCk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgIHRoaXMuX3N0cmljdEdldE5vZGUoc291cmNlKTtcbiAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIoZnVuY3Rpb24oZSkgeyByZXR1cm4gdGhpcy5zb3VyY2UoZSkgPT09IHNvdXJjZTsgfSwgdGhpcyk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBpZHMgZm9yIGFsbCBlZGdlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIHRoZSBub2RlXG4gKiBgc291cmNlYCBhcyB0aGVpciBzb3VyY2UuIElmIHRoZSBub2RlIGBzb3VyY2VgIGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhpc1xuICogZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIE9wdGlvbmFsbHkgYSBgdGFyZ2V0YCBub2RlIG1heSBhbHNvIGJlIHNwZWNpZmllZC4gVGhpcyBjYXVzZXMgdGhlIHJlc3VsdHNcbiAqIHRvIGJlIGZpbHRlcmVkIHN1Y2ggdGhhdCBvbmx5IGVkZ2VzIGZyb20gYHNvdXJjZWAgdG8gYHRhcmdldGAgYXJlIGluY2x1ZGVkLlxuICogSWYgdGhlIG5vZGUgYHRhcmdldGAgaXMgc3BlY2lmaWVkIGJ1dCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoZW4gdGhpcyBmdW5jdGlvblxuICogcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2UgdGhlIHNvdXJjZSBub2RlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gW3RhcmdldF0gYW4gb3B0aW9uYWwgdGFyZ2V0IG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUub3V0RWRnZXMgPSBmdW5jdGlvbihzb3VyY2UsIHRhcmdldCkge1xuICB0aGlzLl9zdHJpY3RHZXROb2RlKHNvdXJjZSk7XG4gIHZhciByZXN1bHRzID0gU2V0LnVuaW9uKHV0aWwudmFsdWVzKHRoaXMuX291dEVkZ2VzW3NvdXJjZV0pKS5rZXlzKCk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgIHRoaXMuX3N0cmljdEdldE5vZGUodGFyZ2V0KTtcbiAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIoZnVuY3Rpb24oZSkgeyByZXR1cm4gdGhpcy50YXJnZXQoZSkgPT09IHRhcmdldDsgfSwgdGhpcyk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBpZHMgZm9yIGFsbCBlZGdlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIHRoZSBgdWAgYXNcbiAqIHRoZWlyIHNvdXJjZSBvciB0aGVpciB0YXJnZXQuIElmIHRoZSBub2RlIGB1YCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoaXNcbiAqIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBPcHRpb25hbGx5IGEgYHZgIG5vZGUgbWF5IGFsc28gYmUgc3BlY2lmaWVkLiBUaGlzIGNhdXNlcyB0aGUgcmVzdWx0cyB0byBiZVxuICogZmlsdGVyZWQgc3VjaCB0aGF0IG9ubHkgZWRnZXMgYmV0d2VlbiBgdWAgYW5kIGB2YCAtIGluIGVpdGhlciBkaXJlY3Rpb24gLVxuICogYXJlIGluY2x1ZGVkLiBJRiB0aGUgbm9kZSBgdmAgaXMgc3BlY2lmaWVkIGJ1dCBub3QgaW4gdGhlIGdyYXBoIHRoZW4gdGhpc1xuICogZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IHRoZSBub2RlIGZvciB3aGljaCB0byBmaW5kIGluY2lkZW50IGVkZ2VzXG4gKiBAcGFyYW0ge1N0cmluZ30gW3ZdIG9wdGlvbiBub2RlIHRoYXQgbXVzdCBiZSBhZGphY2VudCB0byBgdWBcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuaW5jaWRlbnRFZGdlcyA9IGZ1bmN0aW9uKHUsIHYpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgcmV0dXJuIFNldC51bmlvbihbdGhpcy5vdXRFZGdlcyh1LCB2KSwgdGhpcy5vdXRFZGdlcyh2LCB1KV0pLmtleXMoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gU2V0LnVuaW9uKFt0aGlzLmluRWRnZXModSksIHRoaXMub3V0RWRnZXModSldKS5rZXlzKCk7XG4gIH1cbn07XG5cbi8qXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgZ3JhcGguXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkRpZ3JhcGggXCIgKyBKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCAyKTtcbn07XG5cbi8qXG4gKiBBZGRzIGEgbmV3IG5vZGUgd2l0aCB0aGUgaWQgYHVgIHRvIHRoZSBncmFwaCBhbmQgYXNzaWducyBpdCB0aGUgdmFsdWVcbiAqIGB2YWx1ZWAuIElmIGEgbm9kZSB3aXRoIHRoZSBpZCBpcyBhbHJlYWR5IGEgcGFydCBvZiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvblxuICogdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gYW4gb3B0aW9uYWwgdmFsdWUgdG8gYXR0YWNoIHRvIHRoZSBub2RlXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmFkZE5vZGUgPSBmdW5jdGlvbih1LCB2YWx1ZSkge1xuICB1ID0gQmFzZUdyYXBoLnByb3RvdHlwZS5hZGROb2RlLmNhbGwodGhpcywgdSwgdmFsdWUpO1xuICB0aGlzLl9pbkVkZ2VzW3VdID0ge307XG4gIHRoaXMuX291dEVkZ2VzW3VdID0ge307XG4gIHJldHVybiB1O1xufTtcblxuLypcbiAqIFJlbW92ZXMgYSBub2RlIGZyb20gdGhlIGdyYXBoIHRoYXQgaGFzIHRoZSBpZCBgdWAuIEFueSBlZGdlcyBpbmNpZGVudCBvbiB0aGVcbiAqIG5vZGUgYXJlIGFsc28gcmVtb3ZlZC4gSWYgdGhlIGdyYXBoIGRvZXMgbm90IGNvbnRhaW4gYSBub2RlIHdpdGggdGhlIGlkIHRoaXNcbiAqIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmRlbE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gIEJhc2VHcmFwaC5wcm90b3R5cGUuZGVsTm9kZS5jYWxsKHRoaXMsIHUpO1xuICBkZWxldGUgdGhpcy5faW5FZGdlc1t1XTtcbiAgZGVsZXRlIHRoaXMuX291dEVkZ2VzW3VdO1xufTtcblxuLypcbiAqIEFkZHMgYSBuZXcgZWRnZSB0byB0aGUgZ3JhcGggd2l0aCB0aGUgaWQgYGVgIGZyb20gYSBub2RlIHdpdGggdGhlIGlkIGBzb3VyY2VgXG4gKiB0byBhIG5vZGUgd2l0aCBhbiBpZCBgdGFyZ2V0YCBhbmQgYXNzaWducyBpdCB0aGUgdmFsdWUgYHZhbHVlYC4gVGhpcyBncmFwaFxuICogYWxsb3dzIG1vcmUgdGhhbiBvbmUgZWRnZSBmcm9tIGBzb3VyY2VgIHRvIGB0YXJnZXRgIGFzIGxvbmcgYXMgdGhlIGlkIGBlYFxuICogaXMgdW5pcXVlIGluIHRoZSBzZXQgb2YgZWRnZXMuIElmIGBlYCBpcyBgbnVsbGAgdGhlIGdyYXBoIHdpbGwgYXNzaWduIGFcbiAqIHVuaXF1ZSBpZGVudGlmaWVyIHRvIHRoZSBlZGdlLlxuICpcbiAqIElmIGBzb3VyY2VgIG9yIGB0YXJnZXRgIGFyZSBub3QgcHJlc2VudCBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB3aWxsXG4gKiB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW2VdIGFuIGVkZ2UgaWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2UgdGhlIHNvdXJjZSBub2RlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gdGFyZ2V0IHRoZSB0YXJnZXQgbm9kZSBpZFxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gYW4gb3B0aW9uYWwgdmFsdWUgdG8gYXR0YWNoIHRvIHRoZSBlZGdlXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmFkZEVkZ2UgPSBmdW5jdGlvbihlLCBzb3VyY2UsIHRhcmdldCwgdmFsdWUpIHtcbiAgcmV0dXJuIEJhc2VHcmFwaC5wcm90b3R5cGUuX2FkZEVkZ2UuY2FsbCh0aGlzLCBlLCBzb3VyY2UsIHRhcmdldCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5FZGdlcywgdGhpcy5fb3V0RWRnZXMpO1xufTtcblxuLypcbiAqIFJlbW92ZXMgYW4gZWRnZSBpbiB0aGUgZ3JhcGggd2l0aCB0aGUgaWQgYGVgLiBJZiBubyBlZGdlIGluIHRoZSBncmFwaCBoYXNcbiAqIHRoZSBpZCBgZWAgdGhpcyBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBlIGFuIGVkZ2UgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuZGVsRWRnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgQmFzZUdyYXBoLnByb3RvdHlwZS5fZGVsRWRnZS5jYWxsKHRoaXMsIGUsIHRoaXMuX2luRWRnZXMsIHRoaXMuX291dEVkZ2VzKTtcbn07XG5cbi8vIFVubGlrZSBCYXNlR3JhcGguZmlsdGVyTm9kZXMsIHRoaXMgaGVscGVyIGp1c3QgcmV0dXJucyBub2RlcyB0aGF0XG4vLyBzYXRpc2Z5IGEgcHJlZGljYXRlLlxuRGlncmFwaC5wcm90b3R5cGUuX2ZpbHRlck5vZGVzID0gZnVuY3Rpb24ocHJlZCkge1xuICB2YXIgZmlsdGVyZWQgPSBbXTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgaWYgKHByZWQodSkpIHtcbiAgICAgIGZpbHRlcmVkLnB1c2godSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGZpbHRlcmVkO1xufTtcblxuIiwiLypcbiAqIFRoaXMgZmlsZSBpcyBvcmdhbml6ZWQgd2l0aCBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICpcbiAqIEV4cG9ydHNcbiAqIEdyYXBoIGNvbnN0cnVjdG9yc1xuICogR3JhcGggcXVlcmllcyAoZS5nLiBub2RlcygpLCBlZGdlcygpXG4gKiBHcmFwaCBtdXRhdG9yc1xuICogSGVscGVyIGZ1bmN0aW9uc1xuICovXG5cbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKSxcbiAgICBCYXNlR3JhcGggPSByZXF1aXJlKFwiLi9CYXNlR3JhcGhcIiksXG4vKiBqc2hpbnQgLVcwNzkgKi9cbiAgICBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBHcmFwaDtcblxuLypcbiAqIENvbnN0cnVjdG9yIHRvIGNyZWF0ZSBhIG5ldyB1bmRpcmVjdGVkIG11bHRpLWdyYXBoLlxuICovXG5mdW5jdGlvbiBHcmFwaCgpIHtcbiAgQmFzZUdyYXBoLmNhbGwodGhpcyk7XG5cbiAgLyohIE1hcCBvZiBub2RlSWQgLT4geyBvdGhlck5vZGVJZCAtPiBTZXQgb2YgZWRnZSBpZHMgfSAqL1xuICB0aGlzLl9pbmNpZGVudEVkZ2VzID0ge307XG59XG5cbkdyYXBoLnByb3RvdHlwZSA9IG5ldyBCYXNlR3JhcGgoKTtcbkdyYXBoLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEdyYXBoO1xuXG4vKlxuICogQWx3YXlzIHJldHVybnMgYGZhbHNlYC5cbiAqL1xuR3JhcGgucHJvdG90eXBlLmlzRGlyZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIG5vZGVzIHRoYXQgYXJlIGFkamFjZW50IHRvIHRoZSBub2RlIHdpdGggdGhlIGlkIGB1YC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqL1xuR3JhcGgucHJvdG90eXBlLm5laWdoYm9ycyA9IGZ1bmN0aW9uKHUpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2luY2lkZW50RWRnZXNbdV0pXG4gICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHRoaXMuX25vZGVzW3ZdLmlkOyB9LCB0aGlzKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGlkcyBmb3IgYWxsIGVkZ2VzIGluIHRoZSBncmFwaCB0aGF0IGFyZSBpbmNpZGVudCBvbiBgdWAuXG4gKiBJZiB0aGUgbm9kZSBgdWAgaXMgbm90IGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBPcHRpb25hbGx5IGEgYHZgIG5vZGUgbWF5IGFsc28gYmUgc3BlY2lmaWVkLiBUaGlzIGNhdXNlcyB0aGUgcmVzdWx0cyB0byBiZVxuICogZmlsdGVyZWQgc3VjaCB0aGF0IG9ubHkgZWRnZXMgYmV0d2VlbiBgdWAgYW5kIGB2YCBhcmUgaW5jbHVkZWQuIElmIHRoZSBub2RlXG4gKiBgdmAgaXMgc3BlY2lmaWVkIGJ1dCBub3QgaW4gdGhlIGdyYXBoIHRoZW4gdGhpcyBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgdGhlIG5vZGUgZm9yIHdoaWNoIHRvIGZpbmQgaW5jaWRlbnQgZWRnZXNcbiAqIEBwYXJhbSB7U3RyaW5nfSBbdl0gb3B0aW9uIG5vZGUgdGhhdCBtdXN0IGJlIGFkamFjZW50IHRvIGB1YFxuICovXG5HcmFwaC5wcm90b3R5cGUuaW5jaWRlbnRFZGdlcyA9IGZ1bmN0aW9uKHUsIHYpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh2KTtcbiAgICByZXR1cm4gdiBpbiB0aGlzLl9pbmNpZGVudEVkZ2VzW3VdID8gdGhpcy5faW5jaWRlbnRFZGdlc1t1XVt2XS5rZXlzKCkgOiBbXTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gU2V0LnVuaW9uKHV0aWwudmFsdWVzKHRoaXMuX2luY2lkZW50RWRnZXNbdV0pKS5rZXlzKCk7XG4gIH1cbn07XG5cbi8qXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgZ3JhcGguXG4gKi9cbkdyYXBoLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJHcmFwaCBcIiArIEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIDIpO1xufTtcblxuLypcbiAqIEFkZHMgYSBuZXcgbm9kZSB3aXRoIHRoZSBpZCBgdWAgdG8gdGhlIGdyYXBoIGFuZCBhc3NpZ25zIGl0IHRoZSB2YWx1ZVxuICogYHZhbHVlYC4gSWYgYSBub2RlIHdpdGggdGhlIGlkIGlzIGFscmVhZHkgYSBwYXJ0IG9mIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uXG4gKiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKiBAcGFyYW0ge09iamVjdH0gW3ZhbHVlXSBhbiBvcHRpb25hbCB2YWx1ZSB0byBhdHRhY2ggdG8gdGhlIG5vZGVcbiAqL1xuR3JhcGgucHJvdG90eXBlLmFkZE5vZGUgPSBmdW5jdGlvbih1LCB2YWx1ZSkge1xuICB1ID0gQmFzZUdyYXBoLnByb3RvdHlwZS5hZGROb2RlLmNhbGwodGhpcywgdSwgdmFsdWUpO1xuICB0aGlzLl9pbmNpZGVudEVkZ2VzW3VdID0ge307XG4gIHJldHVybiB1O1xufTtcblxuLypcbiAqIFJlbW92ZXMgYSBub2RlIGZyb20gdGhlIGdyYXBoIHRoYXQgaGFzIHRoZSBpZCBgdWAuIEFueSBlZGdlcyBpbmNpZGVudCBvbiB0aGVcbiAqIG5vZGUgYXJlIGFsc28gcmVtb3ZlZC4gSWYgdGhlIGdyYXBoIGRvZXMgbm90IGNvbnRhaW4gYSBub2RlIHdpdGggdGhlIGlkIHRoaXNcbiAqIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5kZWxOb2RlID0gZnVuY3Rpb24odSkge1xuICBCYXNlR3JhcGgucHJvdG90eXBlLmRlbE5vZGUuY2FsbCh0aGlzLCB1KTtcbiAgZGVsZXRlIHRoaXMuX2luY2lkZW50RWRnZXNbdV07XG59O1xuXG4vKlxuICogQWRkcyBhIG5ldyBlZGdlIHRvIHRoZSBncmFwaCB3aXRoIHRoZSBpZCBgZWAgYmV0d2VlbiBhIG5vZGUgd2l0aCB0aGUgaWQgYHVgXG4gKiBhbmQgYSBub2RlIHdpdGggYW4gaWQgYHZgIGFuZCBhc3NpZ25zIGl0IHRoZSB2YWx1ZSBgdmFsdWVgLiBUaGlzIGdyYXBoXG4gKiBhbGxvd3MgbW9yZSB0aGFuIG9uZSBlZGdlIGJldHdlZW4gYHVgIGFuZCBgdmAgYXMgbG9uZyBhcyB0aGUgaWQgYGVgXG4gKiBpcyB1bmlxdWUgaW4gdGhlIHNldCBvZiBlZGdlcy4gSWYgYGVgIGlzIGBudWxsYCB0aGUgZ3JhcGggd2lsbCBhc3NpZ24gYVxuICogdW5pcXVlIGlkZW50aWZpZXIgdG8gdGhlIGVkZ2UuXG4gKlxuICogSWYgYHVgIG9yIGB2YCBhcmUgbm90IHByZXNlbnQgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gd2lsbCB0aHJvdyBhblxuICogRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IFtlXSBhbiBlZGdlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gdSB0aGUgbm9kZSBpZCBvZiBvbmUgb2YgdGhlIGFkamFjZW50IG5vZGVzXG4gKiBAcGFyYW0ge1N0cmluZ30gdiB0aGUgbm9kZSBpZCBvZiB0aGUgb3RoZXIgYWRqYWNlbnQgbm9kZVxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gYW4gb3B0aW9uYWwgdmFsdWUgdG8gYXR0YWNoIHRvIHRoZSBlZGdlXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5hZGRFZGdlID0gZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgcmV0dXJuIEJhc2VHcmFwaC5wcm90b3R5cGUuX2FkZEVkZ2UuY2FsbCh0aGlzLCBlLCB1LCB2LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9pbmNpZGVudEVkZ2VzLCB0aGlzLl9pbmNpZGVudEVkZ2VzKTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGFuIGVkZ2UgaW4gdGhlIGdyYXBoIHdpdGggdGhlIGlkIGBlYC4gSWYgbm8gZWRnZSBpbiB0aGUgZ3JhcGggaGFzXG4gKiB0aGUgaWQgYGVgIHRoaXMgZnVuY3Rpb24gd2lsbCB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZSBhbiBlZGdlIGlkXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5kZWxFZGdlID0gZnVuY3Rpb24oZSkge1xuICBCYXNlR3JhcGgucHJvdG90eXBlLl9kZWxFZGdlLmNhbGwodGhpcywgZSwgdGhpcy5faW5jaWRlbnRFZGdlcywgdGhpcy5faW5jaWRlbnRFZGdlcyk7XG59O1xuXG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb25lbnRzO1xuXG4vKipcbiAqIEZpbmRzIGFsbCBbY29ubmVjdGVkIGNvbXBvbmVudHNdW10gaW4gYSBncmFwaCBhbmQgcmV0dXJucyBhbiBhcnJheSBvZiB0aGVzZVxuICogY29tcG9uZW50cy4gRWFjaCBjb21wb25lbnQgaXMgaXRzZWxmIGFuIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIGlkcyBvZiBub2Rlc1xuICogaW4gdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIG9ubHkgd29ya3Mgd2l0aCB1bmRpcmVjdGVkIEdyYXBocy5cbiAqXG4gKiBbY29ubmVjdGVkIGNvbXBvbmVudHNdOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Nvbm5lY3RlZF9jb21wb25lbnRfKGdyYXBoX3RoZW9yeSlcbiAqXG4gKiBAcGFyYW0ge0dyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIGNvbXBvbmVudHNcbiAqL1xuZnVuY3Rpb24gY29tcG9uZW50cyhnKSB7XG4gIHZhciByZXN1bHRzID0gW107XG4gIHZhciB2aXNpdGVkID0gbmV3IFNldCgpO1xuXG4gIGZ1bmN0aW9uIGRmcyh2LCBjb21wb25lbnQpIHtcbiAgICBpZiAoIXZpc2l0ZWQuaGFzKHYpKSB7XG4gICAgICB2aXNpdGVkLmFkZCh2KTtcbiAgICAgIGNvbXBvbmVudC5wdXNoKHYpO1xuICAgICAgZy5uZWlnaGJvcnModikuZm9yRWFjaChmdW5jdGlvbih3KSB7XG4gICAgICAgIGRmcyh3LCBjb21wb25lbnQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZy5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgIHZhciBjb21wb25lbnQgPSBbXTtcbiAgICBkZnModiwgY29tcG9uZW50KTtcbiAgICBpZiAoY29tcG9uZW50Lmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdHMucHVzaChjb21wb25lbnQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJ2YXIgUHJpb3JpdHlRdWV1ZSA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlByaW9yaXR5UXVldWU7XG5cbm1vZHVsZS5leHBvcnRzID0gZGlqa3N0cmE7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBpcyBhbiBpbXBsZW1lbnRhdGlvbiBvZiBbRGlqa3N0cmEncyBhbGdvcml0aG1dW10gd2hpY2ggZmluZHNcbiAqIHRoZSBzaG9ydGVzdCBwYXRoIGZyb20gKipzb3VyY2UqKiB0byBhbGwgb3RoZXIgbm9kZXMgaW4gKipnKiouIFRoaXNcbiAqIGZ1bmN0aW9uIHJldHVybnMgYSBtYXAgb2YgYHUgLT4geyBkaXN0YW5jZSwgcHJlZGVjZXNzb3IgfWAuIFRoZSBkaXN0YW5jZVxuICogcHJvcGVydHkgaG9sZHMgdGhlIHN1bSBvZiB0aGUgd2VpZ2h0cyBmcm9tICoqc291cmNlKiogdG8gYHVgIGFsb25nIHRoZVxuICogc2hvcnRlc3QgcGF0aCBvciBgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZYCBpZiB0aGVyZSBpcyBubyBwYXRoIGZyb21cbiAqICoqc291cmNlKiouIFRoZSBwcmVkZWNlc3NvciBwcm9wZXJ0eSBjYW4gYmUgdXNlZCB0byB3YWxrIHRoZSBpbmRpdmlkdWFsXG4gKiBlbGVtZW50cyBvZiB0aGUgcGF0aCBmcm9tICoqc291cmNlKiogdG8gKip1KiogaW4gcmV2ZXJzZSBvcmRlci5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGB3ZWlnaHRGdW5jKGUpYCB3aGljaCByZXR1cm5zIHRoZVxuICogd2VpZ2h0IG9mIHRoZSBlZGdlIGBlYC4gSWYgbm8gd2VpZ2h0RnVuYyBpcyBzdXBwbGllZCB0aGVuIGVhY2ggZWRnZSBpc1xuICogYXNzdW1lZCB0byBoYXZlIGEgd2VpZ2h0IG9mIDEuIFRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yIGlmIGFueSBvZlxuICogdGhlIHRyYXZlcnNlZCBlZGdlcyBoYXZlIGEgbmVnYXRpdmUgZWRnZSB3ZWlnaHQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgaW5jaWRlbnRGdW5jKHUpYCB3aGljaCByZXR1cm5zIHRoZSBpZHMgb2ZcbiAqIGFsbCBlZGdlcyBpbmNpZGVudCB0byB0aGUgbm9kZSBgdWAgZm9yIHRoZSBwdXJwb3NlcyBvZiBzaG9ydGVzdCBwYXRoXG4gKiB0cmF2ZXJzYWwuIEJ5IGRlZmF1bHQgdGhpcyBmdW5jdGlvbiB1c2VzIHRoZSBgZy5vdXRFZGdlc2AgZm9yIERpZ3JhcGhzIGFuZFxuICogYGcuaW5jaWRlbnRFZGdlc2AgZm9yIEdyYXBocy5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGBPKCh8RXwgKyB8VnwpICogbG9nIHxWfClgIHRpbWUuXG4gKlxuICogW0RpamtzdHJhJ3MgYWxnb3JpdGhtXTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9EaWprc3RyYSUyN3NfYWxnb3JpdGhtXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBzaG9ydGVzdCBwYXRocyBmcm9tICoqc291cmNlKipcbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgdGhlIHNvdXJjZSBmcm9tIHdoaWNoIHRvIHN0YXJ0IHRoZSBzZWFyY2hcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFt3ZWlnaHRGdW5jXSBvcHRpb25hbCB3ZWlnaHQgZnVuY3Rpb25cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtpbmNpZGVudEZ1bmNdIG9wdGlvbmFsIGluY2lkZW50IGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGRpamtzdHJhKGcsIHNvdXJjZSwgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKSB7XG4gIHZhciByZXN1bHRzID0ge30sXG4gICAgICBwcSA9IG5ldyBQcmlvcml0eVF1ZXVlKCk7XG5cbiAgZnVuY3Rpb24gdXBkYXRlTmVpZ2hib3JzKGUpIHtcbiAgICB2YXIgaW5jaWRlbnROb2RlcyA9IGcuaW5jaWRlbnROb2RlcyhlKSxcbiAgICAgICAgdiA9IGluY2lkZW50Tm9kZXNbMF0gIT09IHUgPyBpbmNpZGVudE5vZGVzWzBdIDogaW5jaWRlbnROb2Rlc1sxXSxcbiAgICAgICAgdkVudHJ5ID0gcmVzdWx0c1t2XSxcbiAgICAgICAgd2VpZ2h0ID0gd2VpZ2h0RnVuYyhlKSxcbiAgICAgICAgZGlzdGFuY2UgPSB1RW50cnkuZGlzdGFuY2UgKyB3ZWlnaHQ7XG5cbiAgICBpZiAod2VpZ2h0IDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZGlqa3N0cmEgZG9lcyBub3QgYWxsb3cgbmVnYXRpdmUgZWRnZSB3ZWlnaHRzLiBCYWQgZWRnZTogXCIgKyBlICsgXCIgV2VpZ2h0OiBcIiArIHdlaWdodCk7XG4gICAgfVxuXG4gICAgaWYgKGRpc3RhbmNlIDwgdkVudHJ5LmRpc3RhbmNlKSB7XG4gICAgICB2RW50cnkuZGlzdGFuY2UgPSBkaXN0YW5jZTtcbiAgICAgIHZFbnRyeS5wcmVkZWNlc3NvciA9IHU7XG4gICAgICBwcS5kZWNyZWFzZSh2LCBkaXN0YW5jZSk7XG4gICAgfVxuICB9XG5cbiAgd2VpZ2h0RnVuYyA9IHdlaWdodEZ1bmMgfHwgZnVuY3Rpb24oKSB7IHJldHVybiAxOyB9O1xuICBpbmNpZGVudEZ1bmMgPSBpbmNpZGVudEZ1bmMgfHwgKGcuaXNEaXJlY3RlZCgpXG4gICAgICA/IGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGcub3V0RWRnZXModSk7IH1cbiAgICAgIDogZnVuY3Rpb24odSkgeyByZXR1cm4gZy5pbmNpZGVudEVkZ2VzKHUpOyB9KTtcblxuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHtcbiAgICB2YXIgZGlzdGFuY2UgPSB1ID09PSBzb3VyY2UgPyAwIDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgIHJlc3VsdHNbdV0gPSB7IGRpc3RhbmNlOiBkaXN0YW5jZSB9O1xuICAgIHBxLmFkZCh1LCBkaXN0YW5jZSk7XG4gIH0pO1xuXG4gIHZhciB1LCB1RW50cnk7XG4gIHdoaWxlIChwcS5zaXplKCkgPiAwKSB7XG4gICAgdSA9IHBxLnJlbW92ZU1pbigpO1xuICAgIHVFbnRyeSA9IHJlc3VsdHNbdV07XG4gICAgaWYgKHVFbnRyeS5kaXN0YW5jZSA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpbmNpZGVudEZ1bmModSkuZm9yRWFjaCh1cGRhdGVOZWlnaGJvcnMpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJ2YXIgZGlqa3N0cmEgPSByZXF1aXJlKFwiLi9kaWprc3RyYVwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBkaWprc3RyYUFsbDtcblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGZpbmRzIHRoZSBzaG9ydGVzdCBwYXRoIGZyb20gZWFjaCBub2RlIHRvIGV2ZXJ5IG90aGVyXG4gKiByZWFjaGFibGUgbm9kZSBpbiB0aGUgZ3JhcGguIEl0IGlzIHNpbWlsYXIgdG8gW2FsZy5kaWprc3RyYV1bXSwgYnV0XG4gKiBpbnN0ZWFkIG9mIHJldHVybmluZyBhIHNpbmdsZS1zb3VyY2UgYXJyYXksIGl0IHJldHVybnMgYSBtYXBwaW5nIG9mXG4gKiBvZiBgc291cmNlIC0+IGFsZy5kaWprc3RhKGcsIHNvdXJjZSwgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKWAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgd2VpZ2h0RnVuYyhlKWAgd2hpY2ggcmV0dXJucyB0aGVcbiAqIHdlaWdodCBvZiB0aGUgZWRnZSBgZWAuIElmIG5vIHdlaWdodEZ1bmMgaXMgc3VwcGxpZWQgdGhlbiBlYWNoIGVkZ2UgaXNcbiAqIGFzc3VtZWQgdG8gaGF2ZSBhIHdlaWdodCBvZiAxLiBUaGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvciBpZiBhbnkgb2ZcbiAqIHRoZSB0cmF2ZXJzZWQgZWRnZXMgaGF2ZSBhIG5lZ2F0aXZlIGVkZ2Ugd2VpZ2h0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYGluY2lkZW50RnVuYyh1KWAgd2hpY2ggcmV0dXJucyB0aGUgaWRzIG9mXG4gKiBhbGwgZWRnZXMgaW5jaWRlbnQgdG8gdGhlIG5vZGUgYHVgIGZvciB0aGUgcHVycG9zZXMgb2Ygc2hvcnRlc3QgcGF0aFxuICogdHJhdmVyc2FsLiBCeSBkZWZhdWx0IHRoaXMgZnVuY3Rpb24gdXNlcyB0aGUgYG91dEVkZ2VzYCBmdW5jdGlvbiBvbiB0aGVcbiAqIHN1cHBsaWVkIGdyYXBoLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYE8ofFZ8ICogKHxFfCArIHxWfCkgKiBsb2cgfFZ8KWAgdGltZS5cbiAqXG4gKiBbYWxnLmRpamtzdHJhXTogZGlqa3N0cmEuanMuaHRtbCNkaWprc3RyYVxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3Igc2hvcnRlc3QgcGF0aHMgZnJvbSAqKnNvdXJjZSoqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbd2VpZ2h0RnVuY10gb3B0aW9uYWwgd2VpZ2h0IGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaW5jaWRlbnRGdW5jXSBvcHRpb25hbCBpbmNpZGVudCBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkaWprc3RyYUFsbChnLCB3ZWlnaHRGdW5jLCBpbmNpZGVudEZ1bmMpIHtcbiAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgcmVzdWx0c1t1XSA9IGRpamtzdHJhKGcsIHUsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYyk7XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsInZhciB0YXJqYW4gPSByZXF1aXJlKFwiLi90YXJqYW5cIik7XG5cbm1vZHVsZS5leHBvcnRzID0gZmluZEN5Y2xlcztcblxuLypcbiAqIEdpdmVuIGEgRGlncmFwaCAqKmcqKiB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYWxsIG5vZGVzIHRoYXQgYXJlIHBhcnQgb2YgYVxuICogY3ljbGUuIFNpbmNlIHRoZXJlIG1heSBiZSBtb3JlIHRoYW4gb25lIGN5Y2xlIGluIGEgZ3JhcGggdGhpcyBmdW5jdGlvblxuICogcmV0dXJucyBhbiBhcnJheSBvZiB0aGVzZSBjeWNsZXMsIHdoZXJlIGVhY2ggY3ljbGUgaXMgaXRzZWxmIHJlcHJlc2VudGVkXG4gKiBieSBhbiBhcnJheSBvZiBpZHMgZm9yIGVhY2ggbm9kZSBpbnZvbHZlZCBpbiB0aGF0IGN5Y2xlLlxuICpcbiAqIFthbGcuaXNBY3ljbGljXVtdIGlzIG1vcmUgZWZmaWNpZW50IGlmIHlvdSBvbmx5IG5lZWQgdG8gZGV0ZXJtaW5lIHdoZXRoZXJcbiAqIGEgZ3JhcGggaGFzIGEgY3ljbGUgb3Igbm90LlxuICpcbiAqIFthbGcuaXNBY3ljbGljXTogaXNBY3ljbGljLmpzLmh0bWwjaXNBY3ljbGljXG4gKlxuICogQHBhcmFtIHtEaWdyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIGN5Y2xlcy5cbiAqL1xuZnVuY3Rpb24gZmluZEN5Y2xlcyhnKSB7XG4gIHJldHVybiB0YXJqYW4oZykuZmlsdGVyKGZ1bmN0aW9uKGNtcHQpIHsgcmV0dXJuIGNtcHQubGVuZ3RoID4gMTsgfSk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZsb3lkV2Fyc2hhbGw7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBpcyBhbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgW0Zsb3lkLVdhcnNoYWxsIGFsZ29yaXRobV1bXSxcbiAqIHdoaWNoIGZpbmRzIHRoZSBzaG9ydGVzdCBwYXRoIGZyb20gZWFjaCBub2RlIHRvIGV2ZXJ5IG90aGVyIHJlYWNoYWJsZSBub2RlXG4gKiBpbiB0aGUgZ3JhcGguIEl0IGlzIHNpbWlsYXIgdG8gW2FsZy5kaWprc3RyYUFsbF1bXSwgYnV0IGl0IGhhbmRsZXMgbmVnYXRpdmVcbiAqIGVkZ2Ugd2VpZ2h0cyBhbmQgaXMgbW9yZSBlZmZpY2llbnQgZm9yIHNvbWUgdHlwZXMgb2YgZ3JhcGhzLiBUaGlzIGZ1bmN0aW9uXG4gKiByZXR1cm5zIGEgbWFwIG9mIGBzb3VyY2UgLT4geyB0YXJnZXQgLT4geyBkaXN0YW5jZSwgcHJlZGVjZXNzb3IgfWAuIFRoZVxuICogZGlzdGFuY2UgcHJvcGVydHkgaG9sZHMgdGhlIHN1bSBvZiB0aGUgd2VpZ2h0cyBmcm9tIGBzb3VyY2VgIHRvIGB0YXJnZXRgXG4gKiBhbG9uZyB0aGUgc2hvcnRlc3QgcGF0aCBvZiBgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZYCBpZiB0aGVyZSBpcyBubyBwYXRoXG4gKiBmcm9tIGBzb3VyY2VgLiBUaGUgcHJlZGVjZXNzb3IgcHJvcGVydHkgY2FuIGJlIHVzZWQgdG8gd2FsayB0aGUgaW5kaXZpZHVhbFxuICogZWxlbWVudHMgb2YgdGhlIHBhdGggZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YCBpbiByZXZlcnNlIG9yZGVyLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYHdlaWdodEZ1bmMoZSlgIHdoaWNoIHJldHVybnMgdGhlXG4gKiB3ZWlnaHQgb2YgdGhlIGVkZ2UgYGVgLiBJZiBubyB3ZWlnaHRGdW5jIGlzIHN1cHBsaWVkIHRoZW4gZWFjaCBlZGdlIGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYSB3ZWlnaHQgb2YgMS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGBpbmNpZGVudEZ1bmModSlgIHdoaWNoIHJldHVybnMgdGhlIGlkcyBvZlxuICogYWxsIGVkZ2VzIGluY2lkZW50IHRvIHRoZSBub2RlIGB1YCBmb3IgdGhlIHB1cnBvc2VzIG9mIHNob3J0ZXN0IHBhdGhcbiAqIHRyYXZlcnNhbC4gQnkgZGVmYXVsdCB0aGlzIGZ1bmN0aW9uIHVzZXMgdGhlIGBvdXRFZGdlc2AgZnVuY3Rpb24gb24gdGhlXG4gKiBzdXBwbGllZCBncmFwaC5cbiAqXG4gKiBUaGlzIGFsZ29yaXRobSB0YWtlcyBPKHxWfF4zKSB0aW1lLlxuICpcbiAqIFtGbG95ZC1XYXJzaGFsbCBhbGdvcml0aG1dOiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GbG95ZC1XYXJzaGFsbF9hbGdvcml0aG1cbiAqIFthbGcuZGlqa3N0cmFBbGxdOiBkaWprc3RyYUFsbC5qcy5odG1sI2RpamtzdHJhQWxsXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBzaG9ydGVzdCBwYXRocyBmcm9tICoqc291cmNlKipcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFt3ZWlnaHRGdW5jXSBvcHRpb25hbCB3ZWlnaHQgZnVuY3Rpb25cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtpbmNpZGVudEZ1bmNdIG9wdGlvbmFsIGluY2lkZW50IGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGZsb3lkV2Fyc2hhbGwoZywgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKSB7XG4gIHZhciByZXN1bHRzID0ge30sXG4gICAgICBub2RlcyA9IGcubm9kZXMoKTtcblxuICB3ZWlnaHRGdW5jID0gd2VpZ2h0RnVuYyB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIDE7IH07XG4gIGluY2lkZW50RnVuYyA9IGluY2lkZW50RnVuYyB8fCAoZy5pc0RpcmVjdGVkKClcbiAgICAgID8gZnVuY3Rpb24odSkgeyByZXR1cm4gZy5vdXRFZGdlcyh1KTsgfVxuICAgICAgOiBmdW5jdGlvbih1KSB7IHJldHVybiBnLmluY2lkZW50RWRnZXModSk7IH0pO1xuXG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHJlc3VsdHNbdV0gPSB7fTtcbiAgICByZXN1bHRzW3VdW3VdID0geyBkaXN0YW5jZTogMCB9O1xuICAgIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgaWYgKHUgIT09IHYpIHtcbiAgICAgICAgcmVzdWx0c1t1XVt2XSA9IHsgZGlzdGFuY2U6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSB9O1xuICAgICAgfVxuICAgIH0pO1xuICAgIGluY2lkZW50RnVuYyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHZhciBpbmNpZGVudE5vZGVzID0gZy5pbmNpZGVudE5vZGVzKGUpLFxuICAgICAgICAgIHYgPSBpbmNpZGVudE5vZGVzWzBdICE9PSB1ID8gaW5jaWRlbnROb2Rlc1swXSA6IGluY2lkZW50Tm9kZXNbMV0sXG4gICAgICAgICAgZCA9IHdlaWdodEZ1bmMoZSk7XG4gICAgICBpZiAoZCA8IHJlc3VsdHNbdV1bdl0uZGlzdGFuY2UpIHtcbiAgICAgICAgcmVzdWx0c1t1XVt2XSA9IHsgZGlzdGFuY2U6IGQsIHByZWRlY2Vzc29yOiB1IH07XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xuXG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgIHZhciByb3dLID0gcmVzdWx0c1trXTtcbiAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHZhciByb3dJID0gcmVzdWx0c1tpXTtcbiAgICAgIG5vZGVzLmZvckVhY2goZnVuY3Rpb24oaikge1xuICAgICAgICB2YXIgaWsgPSByb3dJW2tdO1xuICAgICAgICB2YXIga2ogPSByb3dLW2pdO1xuICAgICAgICB2YXIgaWogPSByb3dJW2pdO1xuICAgICAgICB2YXIgYWx0RGlzdGFuY2UgPSBpay5kaXN0YW5jZSArIGtqLmRpc3RhbmNlO1xuICAgICAgICBpZiAoYWx0RGlzdGFuY2UgPCBpai5kaXN0YW5jZSkge1xuICAgICAgICAgIGlqLmRpc3RhbmNlID0gYWx0RGlzdGFuY2U7XG4gICAgICAgICAgaWoucHJlZGVjZXNzb3IgPSBrai5wcmVkZWNlc3NvcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHRzO1xufVxuIiwidmFyIHRvcHNvcnQgPSByZXF1aXJlKFwiLi90b3Bzb3J0XCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQWN5Y2xpYztcblxuLypcbiAqIEdpdmVuIGEgRGlncmFwaCAqKmcqKiB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYHRydWVgIGlmIHRoZSBncmFwaCBoYXMgbm9cbiAqIGN5Y2xlcyBhbmQgcmV0dXJucyBgZmFsc2VgIGlmIGl0IGRvZXMuIFRoaXMgYWxnb3JpdGhtIHJldHVybnMgYXMgc29vbiBhcyBpdFxuICogZGV0ZWN0cyB0aGUgZmlyc3QgY3ljbGUuXG4gKlxuICogVXNlIFthbGcuZmluZEN5Y2xlc11bXSBpZiB5b3UgbmVlZCB0aGUgYWN0dWFsIGxpc3Qgb2YgY3ljbGVzIGluIGEgZ3JhcGguXG4gKlxuICogW2FsZy5maW5kQ3ljbGVzXTogZmluZEN5Y2xlcy5qcy5odG1sI2ZpbmRDeWNsZXNcbiAqXG4gKiBAcGFyYW0ge0RpZ3JhcGh9IGcgdGhlIGdyYXBoIHRvIHRlc3QgZm9yIGN5Y2xlc1xuICovXG5mdW5jdGlvbiBpc0FjeWNsaWMoZykge1xuICB0cnkge1xuICAgIHRvcHNvcnQoZyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIHRvcHNvcnQuQ3ljbGVFeGNlcHRpb24pIHJldHVybiBmYWxzZTtcbiAgICB0aHJvdyBlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gcG9zdG9yZGVyO1xuXG4vLyBQb3N0b3JkZXIgdHJhdmVyc2FsIG9mIGcsIGNhbGxpbmcgZiBmb3IgZWFjaCB2aXNpdGVkIG5vZGUuIEFzc3VtZXMgdGhlIGdyYXBoXG4vLyBpcyBhIHRyZWUuXG5mdW5jdGlvbiBwb3N0b3JkZXIoZywgcm9vdCwgZikge1xuICB2YXIgdmlzaXRlZCA9IG5ldyBTZXQoKTtcbiAgaWYgKGcuaXNEaXJlY3RlZCgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIGZvciB1bmRpcmVjdGVkIGdyYXBoc1wiKTtcbiAgfVxuICBmdW5jdGlvbiBkZnModSwgcHJldikge1xuICAgIGlmICh2aXNpdGVkLmhhcyh1KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGlucHV0IGdyYXBoIGlzIG5vdCBhIHRyZWU6IFwiICsgZyk7XG4gICAgfVxuICAgIHZpc2l0ZWQuYWRkKHUpO1xuICAgIGcubmVpZ2hib3JzKHUpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgaWYgKHYgIT09IHByZXYpIGRmcyh2LCB1KTtcbiAgICB9KTtcbiAgICBmKHUpO1xuICB9XG4gIGRmcyhyb290KTtcbn1cbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHByZW9yZGVyO1xuXG4vLyBQcmVvcmRlciB0cmF2ZXJzYWwgb2YgZywgY2FsbGluZyBmIGZvciBlYWNoIHZpc2l0ZWQgbm9kZS4gQXNzdW1lcyB0aGUgZ3JhcGhcbi8vIGlzIGEgdHJlZS5cbmZ1bmN0aW9uIHByZW9yZGVyKGcsIHJvb3QsIGYpIHtcbiAgdmFyIHZpc2l0ZWQgPSBuZXcgU2V0KCk7XG4gIGlmIChnLmlzRGlyZWN0ZWQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoaXMgZnVuY3Rpb24gb25seSB3b3JrcyBmb3IgdW5kaXJlY3RlZCBncmFwaHNcIik7XG4gIH1cbiAgZnVuY3Rpb24gZGZzKHUsIHByZXYpIHtcbiAgICBpZiAodmlzaXRlZC5oYXModSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBpbnB1dCBncmFwaCBpcyBub3QgYSB0cmVlOiBcIiArIGcpO1xuICAgIH1cbiAgICB2aXNpdGVkLmFkZCh1KTtcbiAgICBmKHUpO1xuICAgIGcubmVpZ2hib3JzKHUpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgaWYgKHYgIT09IHByZXYpIGRmcyh2LCB1KTtcbiAgICB9KTtcbiAgfVxuICBkZnMocm9vdCk7XG59XG4iLCJ2YXIgR3JhcGggPSByZXF1aXJlKFwiLi4vR3JhcGhcIiksXG4gICAgUHJpb3JpdHlRdWV1ZSA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlByaW9yaXR5UXVldWU7XG5cbm1vZHVsZS5leHBvcnRzID0gcHJpbTtcblxuLyoqXG4gKiBbUHJpbSdzIGFsZ29yaXRobV1bXSB0YWtlcyBhIGNvbm5lY3RlZCB1bmRpcmVjdGVkIGdyYXBoIGFuZCBnZW5lcmF0ZXMgYVxuICogW21pbmltdW0gc3Bhbm5pbmcgdHJlZV1bXS4gVGhpcyBmdW5jdGlvbiByZXR1cm5zIHRoZSBtaW5pbXVtIHNwYW5uaW5nXG4gKiB0cmVlIGFzIGFuIHVuZGlyZWN0ZWQgZ3JhcGguIFRoaXMgYWxnb3JpdGhtIGlzIGRlcml2ZWQgZnJvbSB0aGUgZGVzY3JpcHRpb25cbiAqIGluIFwiSW50cm9kdWN0aW9uIHRvIEFsZ29yaXRobXNcIiwgVGhpcmQgRWRpdGlvbiwgQ29ybWVuLCBldCBhbC4sIFBnIDYzNC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGEgYHdlaWdodEZ1bmMoZSlgIHdoaWNoIHJldHVybnMgdGhlIHdlaWdodCBvZiB0aGUgZWRnZVxuICogYGVgLiBJdCB0aHJvd3MgYW4gRXJyb3IgaWYgdGhlIGdyYXBoIGlzIG5vdCBjb25uZWN0ZWQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBgTyh8RXwgbG9nIHxWfClgIHRpbWUuXG4gKlxuICogW1ByaW0ncyBhbGdvcml0aG1dOiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9QcmltJ3NfYWxnb3JpdGhtXG4gKiBbbWluaW11bSBzcGFubmluZyB0cmVlXTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTWluaW11bV9zcGFubmluZ190cmVlXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdXNlZCB0byBnZW5lcmF0ZSB0aGUgbWluaW11bSBzcGFubmluZyB0cmVlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSB3ZWlnaHRGdW5jIHRoZSB3ZWlnaHQgZnVuY3Rpb24gdG8gdXNlXG4gKi9cbmZ1bmN0aW9uIHByaW0oZywgd2VpZ2h0RnVuYykge1xuICB2YXIgcmVzdWx0ID0gbmV3IEdyYXBoKCksXG4gICAgICBwYXJlbnRzID0ge30sXG4gICAgICBwcSA9IG5ldyBQcmlvcml0eVF1ZXVlKCksXG4gICAgICB1O1xuXG4gIGZ1bmN0aW9uIHVwZGF0ZU5laWdoYm9ycyhlKSB7XG4gICAgdmFyIGluY2lkZW50Tm9kZXMgPSBnLmluY2lkZW50Tm9kZXMoZSksXG4gICAgICAgIHYgPSBpbmNpZGVudE5vZGVzWzBdICE9PSB1ID8gaW5jaWRlbnROb2Rlc1swXSA6IGluY2lkZW50Tm9kZXNbMV0sXG4gICAgICAgIHByaSA9IHBxLnByaW9yaXR5KHYpO1xuICAgIGlmIChwcmkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGVkZ2VXZWlnaHQgPSB3ZWlnaHRGdW5jKGUpO1xuICAgICAgaWYgKGVkZ2VXZWlnaHQgPCBwcmkpIHtcbiAgICAgICAgcGFyZW50c1t2XSA9IHU7XG4gICAgICAgIHBxLmRlY3JlYXNlKHYsIGVkZ2VXZWlnaHQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChnLm9yZGVyKCkgPT09IDApIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgcHEuYWRkKHUsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSk7XG4gICAgcmVzdWx0LmFkZE5vZGUodSk7XG4gIH0pO1xuXG4gIC8vIFN0YXJ0IGZyb20gYW4gYXJiaXRyYXJ5IG5vZGVcbiAgcHEuZGVjcmVhc2UoZy5ub2RlcygpWzBdLCAwKTtcblxuICB2YXIgaW5pdCA9IGZhbHNlO1xuICB3aGlsZSAocHEuc2l6ZSgpID4gMCkge1xuICAgIHUgPSBwcS5yZW1vdmVNaW4oKTtcbiAgICBpZiAodSBpbiBwYXJlbnRzKSB7XG4gICAgICByZXN1bHQuYWRkRWRnZShudWxsLCB1LCBwYXJlbnRzW3VdKTtcbiAgICB9IGVsc2UgaWYgKGluaXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IGdyYXBoIGlzIG5vdCBjb25uZWN0ZWQ6IFwiICsgZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluaXQgPSB0cnVlO1xuICAgIH1cblxuICAgIGcuaW5jaWRlbnRFZGdlcyh1KS5mb3JFYWNoKHVwZGF0ZU5laWdoYm9ycyk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB0YXJqYW47XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBpcyBhbiBpbXBsZW1lbnRhdGlvbiBvZiBbVGFyamFuJ3MgYWxnb3JpdGhtXVtdIHdoaWNoIGZpbmRzXG4gKiBhbGwgW3N0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnRzXVtdIGluIHRoZSBkaXJlY3RlZCBncmFwaCAqKmcqKi4gRWFjaFxuICogc3Ryb25nbHkgY29ubmVjdGVkIGNvbXBvbmVudCBpcyBjb21wb3NlZCBvZiBub2RlcyB0aGF0IGNhbiByZWFjaCBhbGwgb3RoZXJcbiAqIG5vZGVzIGluIHRoZSBjb21wb25lbnQgdmlhIGRpcmVjdGVkIGVkZ2VzLiBBIHN0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnRcbiAqIGNhbiBjb25zaXN0IG9mIGEgc2luZ2xlIG5vZGUgaWYgdGhhdCBub2RlIGNhbm5vdCBib3RoIHJlYWNoIGFuZCBiZSByZWFjaGVkXG4gKiBieSBhbnkgb3RoZXIgc3BlY2lmaWMgbm9kZSBpbiB0aGUgZ3JhcGguIENvbXBvbmVudHMgb2YgbW9yZSB0aGFuIG9uZSBub2RlXG4gKiBhcmUgZ3VhcmFudGVlZCB0byBoYXZlIGF0IGxlYXN0IG9uZSBjeWNsZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHJldHVybnMgYW4gYXJyYXkgb2YgY29tcG9uZW50cy4gRWFjaCBjb21wb25lbnQgaXMgaXRzZWxmIGFuXG4gKiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSBpZHMgb2YgYWxsIG5vZGVzIGluIHRoZSBjb21wb25lbnQuXG4gKlxuICogW1RhcmphbidzIGFsZ29yaXRobV06IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVGFyamFuJ3Nfc3Ryb25nbHlfY29ubmVjdGVkX2NvbXBvbmVudHNfYWxnb3JpdGhtXG4gKiBbc3Ryb25nbHkgY29ubmVjdGVkIGNvbXBvbmVudHNdOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1N0cm9uZ2x5X2Nvbm5lY3RlZF9jb21wb25lbnRcbiAqXG4gKiBAcGFyYW0ge0RpZ3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3Igc3Ryb25nbHkgY29ubmVjdGVkIGNvbXBvbmVudHNcbiAqL1xuZnVuY3Rpb24gdGFyamFuKGcpIHtcbiAgaWYgKCFnLmlzRGlyZWN0ZWQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcInRhcmphbiBjYW4gb25seSBiZSBhcHBsaWVkIHRvIGEgZGlyZWN0ZWQgZ3JhcGguIEJhZCBpbnB1dDogXCIgKyBnKTtcbiAgfVxuXG4gIHZhciBpbmRleCA9IDAsXG4gICAgICBzdGFjayA9IFtdLFxuICAgICAgdmlzaXRlZCA9IHt9LCAvLyBub2RlIGlkIC0+IHsgb25TdGFjaywgbG93bGluaywgaW5kZXggfVxuICAgICAgcmVzdWx0cyA9IFtdO1xuXG4gIGZ1bmN0aW9uIGRmcyh1KSB7XG4gICAgdmFyIGVudHJ5ID0gdmlzaXRlZFt1XSA9IHtcbiAgICAgIG9uU3RhY2s6IHRydWUsXG4gICAgICBsb3dsaW5rOiBpbmRleCxcbiAgICAgIGluZGV4OiBpbmRleCsrXG4gICAgfTtcbiAgICBzdGFjay5wdXNoKHUpO1xuXG4gICAgZy5zdWNjZXNzb3JzKHUpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgaWYgKCEodiBpbiB2aXNpdGVkKSkge1xuICAgICAgICBkZnModik7XG4gICAgICAgIGVudHJ5Lmxvd2xpbmsgPSBNYXRoLm1pbihlbnRyeS5sb3dsaW5rLCB2aXNpdGVkW3ZdLmxvd2xpbmspO1xuICAgICAgfSBlbHNlIGlmICh2aXNpdGVkW3ZdLm9uU3RhY2spIHtcbiAgICAgICAgZW50cnkubG93bGluayA9IE1hdGgubWluKGVudHJ5Lmxvd2xpbmssIHZpc2l0ZWRbdl0uaW5kZXgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGVudHJ5Lmxvd2xpbmsgPT09IGVudHJ5LmluZGV4KSB7XG4gICAgICB2YXIgY21wdCA9IFtdLFxuICAgICAgICAgIHY7XG4gICAgICBkbyB7XG4gICAgICAgIHYgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgdmlzaXRlZFt2XS5vblN0YWNrID0gZmFsc2U7XG4gICAgICAgIGNtcHQucHVzaCh2KTtcbiAgICAgIH0gd2hpbGUgKHUgIT09IHYpO1xuICAgICAgcmVzdWx0cy5wdXNoKGNtcHQpO1xuICAgIH1cbiAgfVxuXG4gIGcubm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICBpZiAoISh1IGluIHZpc2l0ZWQpKSB7XG4gICAgICBkZnModSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gdG9wc29ydDtcbnRvcHNvcnQuQ3ljbGVFeGNlcHRpb24gPSBDeWNsZUV4Y2VwdGlvbjtcblxuLypcbiAqIEdpdmVuIGEgZ3JhcGggKipnKiosIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBvcmRlcmVkIGxpc3Qgb2Ygbm9kZXMgc3VjaFxuICogdGhhdCBmb3IgZWFjaCBlZGdlIGB1IC0+IHZgLCBgdWAgYXBwZWFycyBiZWZvcmUgYHZgIGluIHRoZSBsaXN0LiBJZiB0aGVcbiAqIGdyYXBoIGhhcyBhIGN5Y2xlIGl0IGlzIGltcG9zc2libGUgdG8gZ2VuZXJhdGUgc3VjaCBhIGxpc3QgYW5kXG4gKiAqKkN5Y2xlRXhjZXB0aW9uKiogaXMgdGhyb3duLlxuICpcbiAqIFNlZSBbdG9wb2xvZ2ljYWwgc29ydGluZ10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVG9wb2xvZ2ljYWxfc29ydGluZylcbiAqIGZvciBtb3JlIGRldGFpbHMgYWJvdXQgaG93IHRoaXMgYWxnb3JpdGhtIHdvcmtzLlxuICpcbiAqIEBwYXJhbSB7RGlncmFwaH0gZyB0aGUgZ3JhcGggdG8gc29ydFxuICovXG5mdW5jdGlvbiB0b3Bzb3J0KGcpIHtcbiAgaWYgKCFnLmlzRGlyZWN0ZWQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcInRvcHNvcnQgY2FuIG9ubHkgYmUgYXBwbGllZCB0byBhIGRpcmVjdGVkIGdyYXBoLiBCYWQgaW5wdXQ6IFwiICsgZyk7XG4gIH1cblxuICB2YXIgdmlzaXRlZCA9IHt9O1xuICB2YXIgc3RhY2sgPSB7fTtcbiAgdmFyIHJlc3VsdHMgPSBbXTtcblxuICBmdW5jdGlvbiB2aXNpdChub2RlKSB7XG4gICAgaWYgKG5vZGUgaW4gc3RhY2spIHtcbiAgICAgIHRocm93IG5ldyBDeWNsZUV4Y2VwdGlvbigpO1xuICAgIH1cblxuICAgIGlmICghKG5vZGUgaW4gdmlzaXRlZCkpIHtcbiAgICAgIHN0YWNrW25vZGVdID0gdHJ1ZTtcbiAgICAgIHZpc2l0ZWRbbm9kZV0gPSB0cnVlO1xuICAgICAgZy5wcmVkZWNlc3NvcnMobm9kZSkuZm9yRWFjaChmdW5jdGlvbihwcmVkKSB7XG4gICAgICAgIHZpc2l0KHByZWQpO1xuICAgICAgfSk7XG4gICAgICBkZWxldGUgc3RhY2tbbm9kZV07XG4gICAgICByZXN1bHRzLnB1c2gobm9kZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIHNpbmtzID0gZy5zaW5rcygpO1xuICBpZiAoZy5vcmRlcigpICE9PSAwICYmIHNpbmtzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBDeWNsZUV4Y2VwdGlvbigpO1xuICB9XG5cbiAgZy5zaW5rcygpLmZvckVhY2goZnVuY3Rpb24oc2luaykge1xuICAgIHZpc2l0KHNpbmspO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cblxuZnVuY3Rpb24gQ3ljbGVFeGNlcHRpb24oKSB7fVxuXG5DeWNsZUV4Y2VwdGlvbi5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiR3JhcGggaGFzIGF0IGxlYXN0IG9uZSBjeWNsZVwiO1xufTtcbiIsIi8vIFRoaXMgZmlsZSBwcm92aWRlcyBhIGhlbHBlciBmdW5jdGlvbiB0aGF0IG1peGVzLWluIERvdCBiZWhhdmlvciB0byBhblxuLy8gZXhpc3RpbmcgZ3JhcGggcHJvdG90eXBlLlxuXG4vKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb3VuZGlmeTtcblxuLy8gRXh0ZW5kcyB0aGUgZ2l2ZW4gU3VwZXJDb25zdHJ1Y3RvciB3aXRoIHRoZSBhYmlsaXR5IGZvciBub2RlcyB0byBjb250YWluXG4vLyBvdGhlciBub2Rlcy4gQSBzcGVjaWFsIG5vZGUgaWQgYG51bGxgIGlzIHVzZWQgdG8gaW5kaWNhdGUgdGhlIHJvb3QgZ3JhcGguXG5mdW5jdGlvbiBjb21wb3VuZGlmeShTdXBlckNvbnN0cnVjdG9yKSB7XG4gIGZ1bmN0aW9uIENvbnN0cnVjdG9yKCkge1xuICAgIFN1cGVyQ29uc3RydWN0b3IuY2FsbCh0aGlzKTtcblxuICAgIC8vIE1hcCBvZiBvYmplY3QgaWQgLT4gcGFyZW50IGlkIChvciBudWxsIGZvciByb290IGdyYXBoKVxuICAgIHRoaXMuX3BhcmVudHMgPSB7fTtcblxuICAgIC8vIE1hcCBvZiBpZCAob3IgbnVsbCkgLT4gY2hpbGRyZW4gc2V0XG4gICAgdGhpcy5fY2hpbGRyZW4gPSB7fTtcbiAgICB0aGlzLl9jaGlsZHJlbltudWxsXSA9IG5ldyBTZXQoKTtcbiAgfVxuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZSA9IG5ldyBTdXBlckNvbnN0cnVjdG9yKCk7XG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5wYXJlbnQgPSBmdW5jdGlvbih1LCBwYXJlbnQpIHtcbiAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcGFyZW50c1t1XTtcbiAgICB9XG5cbiAgICBpZiAodSA9PT0gcGFyZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgbWFrZSBcIiArIHUgKyBcIiBhIHBhcmVudCBvZiBpdHNlbGZcIik7XG4gICAgfVxuICAgIGlmIChwYXJlbnQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N0cmljdEdldE5vZGUocGFyZW50KTtcbiAgICB9XG5cbiAgICB0aGlzLl9jaGlsZHJlblt0aGlzLl9wYXJlbnRzW3VdXS5yZW1vdmUodSk7XG4gICAgdGhpcy5fcGFyZW50c1t1XSA9IHBhcmVudDtcbiAgICB0aGlzLl9jaGlsZHJlbltwYXJlbnRdLmFkZCh1KTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY2hpbGRyZW4gPSBmdW5jdGlvbih1KSB7XG4gICAgaWYgKHUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jaGlsZHJlblt1XS5rZXlzKCk7XG4gIH07XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmFkZE5vZGUgPSBmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIHUgPSBTdXBlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5hZGROb2RlLmNhbGwodGhpcywgdSwgdmFsdWUpO1xuICAgIHRoaXMuX3BhcmVudHNbdV0gPSBudWxsO1xuICAgIHRoaXMuX2NoaWxkcmVuW3VdID0gbmV3IFNldCgpO1xuICAgIHRoaXMuX2NoaWxkcmVuW251bGxdLmFkZCh1KTtcbiAgICByZXR1cm4gdTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZGVsTm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgICAvLyBQcm9tb3RlIGFsbCBjaGlsZHJlbiB0byB0aGUgcGFyZW50IG9mIHRoZSBzdWJncmFwaFxuICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudCh1KTtcbiAgICB0aGlzLl9jaGlsZHJlblt1XS5rZXlzKCkuZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuICAgICAgdGhpcy5wYXJlbnQoY2hpbGQsIHBhcmVudCk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9jaGlsZHJlbltwYXJlbnRdLnJlbW92ZSh1KTtcbiAgICBkZWxldGUgdGhpcy5fcGFyZW50c1t1XTtcbiAgICBkZWxldGUgdGhpcy5fY2hpbGRyZW5bdV07XG5cbiAgICByZXR1cm4gU3VwZXJDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZGVsTm9kZS5jYWxsKHRoaXMsIHUpO1xuICB9O1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNvcHkgPSBTdXBlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5jb3B5LmNhbGwodGhpcyk7XG4gICAgdGhpcy5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgY29weS5wYXJlbnQodSwgdGhpcy5wYXJlbnQodSkpO1xuICAgIH0sIHRoaXMpO1xuICAgIHJldHVybiBjb3B5O1xuICB9O1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5maWx0ZXJOb2RlcyA9IGZ1bmN0aW9uKGZpbHRlcikge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgY29weSA9IFN1cGVyQ29uc3RydWN0b3IucHJvdG90eXBlLmZpbHRlck5vZGVzLmNhbGwodGhpcywgZmlsdGVyKTtcblxuICAgIHZhciBwYXJlbnRzID0ge307XG4gICAgZnVuY3Rpb24gZmluZFBhcmVudCh1KSB7XG4gICAgICB2YXIgcGFyZW50ID0gc2VsZi5wYXJlbnQodSk7XG4gICAgICBpZiAocGFyZW50ID09PSBudWxsIHx8IGNvcHkuaGFzTm9kZShwYXJlbnQpKSB7XG4gICAgICAgIHBhcmVudHNbdV0gPSBwYXJlbnQ7XG4gICAgICAgIHJldHVybiBwYXJlbnQ7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudCBpbiBwYXJlbnRzKSB7XG4gICAgICAgIHJldHVybiBwYXJlbnRzW3BhcmVudF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmluZFBhcmVudChwYXJlbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvcHkuZWFjaE5vZGUoZnVuY3Rpb24odSkgeyBjb3B5LnBhcmVudCh1LCBmaW5kUGFyZW50KHUpKTsgfSk7XG5cbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICByZXR1cm4gQ29uc3RydWN0b3I7XG59XG4iLCJ2YXIgR3JhcGggPSByZXF1aXJlKFwiLi4vR3JhcGhcIiksXG4gICAgRGlncmFwaCA9IHJlcXVpcmUoXCIuLi9EaWdyYXBoXCIpLFxuICAgIENHcmFwaCA9IHJlcXVpcmUoXCIuLi9DR3JhcGhcIiksXG4gICAgQ0RpZ3JhcGggPSByZXF1aXJlKFwiLi4vQ0RpZ3JhcGhcIik7XG5cbmV4cG9ydHMuZGVjb2RlID0gZnVuY3Rpb24obm9kZXMsIGVkZ2VzLCBDdG9yKSB7XG4gIEN0b3IgPSBDdG9yIHx8IERpZ3JhcGg7XG5cbiAgaWYgKHR5cGVPZihub2RlcykgIT09IFwiQXJyYXlcIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcIm5vZGVzIGlzIG5vdCBhbiBBcnJheVwiKTtcbiAgfVxuXG4gIGlmICh0eXBlT2YoZWRnZXMpICE9PSBcIkFycmF5XCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJlZGdlcyBpcyBub3QgYW4gQXJyYXlcIik7XG4gIH1cblxuICBpZiAodHlwZW9mIEN0b3IgPT09IFwic3RyaW5nXCIpIHtcbiAgICBzd2l0Y2goQ3Rvcikge1xuICAgICAgY2FzZSBcImdyYXBoXCI6IEN0b3IgPSBHcmFwaDsgYnJlYWs7XG4gICAgICBjYXNlIFwiZGlncmFwaFwiOiBDdG9yID0gRGlncmFwaDsgYnJlYWs7XG4gICAgICBjYXNlIFwiY2dyYXBoXCI6IEN0b3IgPSBDR3JhcGg7IGJyZWFrO1xuICAgICAgY2FzZSBcImNkaWdyYXBoXCI6IEN0b3IgPSBDRGlncmFwaDsgYnJlYWs7XG4gICAgICBkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoXCJVbnJlY29nbml6ZWQgZ3JhcGggdHlwZTogXCIgKyBDdG9yKTtcbiAgICB9XG4gIH1cblxuICB2YXIgZ3JhcGggPSBuZXcgQ3RvcigpO1xuXG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIGdyYXBoLmFkZE5vZGUodS5pZCwgdS52YWx1ZSk7XG4gIH0pO1xuXG4gIC8vIElmIHRoZSBncmFwaCBpcyBjb21wb3VuZCwgc2V0IHVwIGNoaWxkcmVuLi4uXG4gIGlmIChncmFwaC5wYXJlbnQpIHtcbiAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIGlmICh1LmNoaWxkcmVuKSB7XG4gICAgICAgIHUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgICAgZ3JhcGgucGFyZW50KHYsIHUuaWQpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGVkZ2VzLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgIGdyYXBoLmFkZEVkZ2UoZS5pZCwgZS51LCBlLnYsIGUudmFsdWUpO1xuICB9KTtcblxuICByZXR1cm4gZ3JhcGg7XG59O1xuXG5leHBvcnRzLmVuY29kZSA9IGZ1bmN0aW9uKGdyYXBoKSB7XG4gIHZhciBub2RlcyA9IFtdO1xuICB2YXIgZWRnZXMgPSBbXTtcblxuICBncmFwaC5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIHZhciBub2RlID0ge2lkOiB1LCB2YWx1ZTogdmFsdWV9O1xuICAgIGlmIChncmFwaC5jaGlsZHJlbikge1xuICAgICAgdmFyIGNoaWxkcmVuID0gZ3JhcGguY2hpbGRyZW4odSk7XG4gICAgICBpZiAoY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgIG5vZGUuY2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZXMucHVzaChub2RlKTtcbiAgfSk7XG5cbiAgZ3JhcGguZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBlZGdlcy5wdXNoKHtpZDogZSwgdTogdSwgdjogdiwgdmFsdWU6IHZhbHVlfSk7XG4gIH0pO1xuXG4gIHZhciB0eXBlO1xuICBpZiAoZ3JhcGggaW5zdGFuY2VvZiBDRGlncmFwaCkge1xuICAgIHR5cGUgPSBcImNkaWdyYXBoXCI7XG4gIH0gZWxzZSBpZiAoZ3JhcGggaW5zdGFuY2VvZiBDR3JhcGgpIHtcbiAgICB0eXBlID0gXCJjZ3JhcGhcIjtcbiAgfSBlbHNlIGlmIChncmFwaCBpbnN0YW5jZW9mIERpZ3JhcGgpIHtcbiAgICB0eXBlID0gXCJkaWdyYXBoXCI7XG4gIH0gZWxzZSBpZiAoZ3JhcGggaW5zdGFuY2VvZiBHcmFwaCkge1xuICAgIHR5cGUgPSBcImdyYXBoXCI7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ291bGRuJ3QgZGV0ZXJtaW5lIHR5cGUgb2YgZ3JhcGg6IFwiICsgZ3JhcGgpO1xuICB9XG5cbiAgcmV0dXJuIHsgbm9kZXM6IG5vZGVzLCBlZGdlczogZWRnZXMsIHR5cGU6IHR5cGUgfTtcbn07XG5cbmZ1bmN0aW9uIHR5cGVPZihvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopLnNsaWNlKDgsIC0xKTtcbn1cbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5leHBvcnRzLmFsbCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7IHJldHVybiB0cnVlOyB9O1xufTtcblxuZXhwb3J0cy5ub2Rlc0Zyb21MaXN0ID0gZnVuY3Rpb24obm9kZXMpIHtcbiAgdmFyIHNldCA9IG5ldyBTZXQobm9kZXMpO1xuICByZXR1cm4gZnVuY3Rpb24odSkge1xuICAgIHJldHVybiBzZXQuaGFzKHUpO1xuICB9O1xufTtcbiIsInZhciBHcmFwaCA9IHJlcXVpcmUoXCIuL0dyYXBoXCIpLFxuICAgIERpZ3JhcGggPSByZXF1aXJlKFwiLi9EaWdyYXBoXCIpO1xuXG4vLyBTaWRlLWVmZmVjdCBiYXNlZCBjaGFuZ2VzIGFyZSBsb3VzeSwgYnV0IG5vZGUgZG9lc24ndCBzZWVtIHRvIHJlc29sdmUgdGhlXG4vLyByZXF1aXJlcyBjeWNsZS5cblxuLyoqXG4gKiBSZXR1cm5zIGEgbmV3IGRpcmVjdGVkIGdyYXBoIHVzaW5nIHRoZSBub2RlcyBhbmQgZWRnZXMgZnJvbSB0aGlzIGdyYXBoLiBUaGVcbiAqIG5ldyBncmFwaCB3aWxsIGhhdmUgdGhlIHNhbWUgbm9kZXMsIGJ1dCB3aWxsIGhhdmUgdHdpY2UgdGhlIG51bWJlciBvZiBlZGdlczpcbiAqIGVhY2ggZWRnZSBpcyBzcGxpdCBpbnRvIHR3byBlZGdlcyB3aXRoIG9wcG9zaXRlIGRpcmVjdGlvbnMuIEVkZ2UgaWRzLFxuICogY29uc2VxdWVudGx5LCBhcmUgbm90IHByZXNlcnZlZCBieSB0aGlzIHRyYW5zZm9ybWF0aW9uLlxuICovXG5HcmFwaC5wcm90b3R5cGUudG9EaWdyYXBoID1cbkdyYXBoLnByb3RvdHlwZS5hc0RpcmVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnID0gbmV3IERpZ3JhcGgoKTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkgeyBnLmFkZE5vZGUodSwgdmFsdWUpOyB9KTtcbiAgdGhpcy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCB2YWx1ZSk7XG4gICAgZy5hZGRFZGdlKG51bGwsIHYsIHUsIHZhbHVlKTtcbiAgfSk7XG4gIHJldHVybiBnO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgbmV3IHVuZGlyZWN0ZWQgZ3JhcGggdXNpbmcgdGhlIG5vZGVzIGFuZCBlZGdlcyBmcm9tIHRoaXMgZ3JhcGguXG4gKiBUaGUgbmV3IGdyYXBoIHdpbGwgaGF2ZSB0aGUgc2FtZSBub2RlcywgYnV0IHRoZSBlZGdlcyB3aWxsIGJlIG1hZGVcbiAqIHVuZGlyZWN0ZWQuIEVkZ2UgaWRzIGFyZSBwcmVzZXJ2ZWQgaW4gdGhpcyB0cmFuc2Zvcm1hdGlvbi5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUudG9HcmFwaCA9XG5EaWdyYXBoLnByb3RvdHlwZS5hc1VuZGlyZWN0ZWQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGcgPSBuZXcgR3JhcGgoKTtcbiAgdGhpcy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkgeyBnLmFkZE5vZGUodSwgdmFsdWUpOyB9KTtcbiAgdGhpcy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGcuYWRkRWRnZShlLCB1LCB2LCB2YWx1ZSk7XG4gIH0pO1xuICByZXR1cm4gZztcbn07XG4iLCIvLyBSZXR1cm5zIGFuIGFycmF5IG9mIGFsbCB2YWx1ZXMgZm9yIHByb3BlcnRpZXMgb2YgKipvKiouXG5leHBvcnRzLnZhbHVlcyA9IGZ1bmN0aW9uKG8pIHtcbiAgdmFyIGtzID0gT2JqZWN0LmtleXMobyksXG4gICAgICBsZW4gPSBrcy5sZW5ndGgsXG4gICAgICByZXN1bHQgPSBuZXcgQXJyYXkobGVuKSxcbiAgICAgIGk7XG4gIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHJlc3VsdFtpXSA9IG9ba3NbaV1dO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSAnMC43LjQnO1xuIiwidm9pZCBmdW5jdGlvbigpe1xuICAndXNlIHN0cmljdCdcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihmbil7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gZm4uYmluZChudWxsLCB0aGlzKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICB9XG4gIH1cbn0oKVxuIiwidmFyIGRvbWlmeSA9IHJlcXVpcmUoJ2RvbWlmeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGh5cGVyZ2x1ZTtcbmZ1bmN0aW9uIGh5cGVyZ2x1ZSAoc3JjLCB1cGRhdGVzKSB7XG4gICAgaWYgKCF1cGRhdGVzKSB1cGRhdGVzID0ge307XG5cbiAgICB2YXIgZG9tID0gdHlwZW9mIHNyYyA9PT0gJ29iamVjdCdcbiAgICAgICAgPyBbIHNyYyBdXG4gICAgICAgIDogZG9taWZ5KHNyYylcbiAgICA7XG4gICAgZm9yRWFjaChvYmplY3RLZXlzKHVwZGF0ZXMpLCBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gdXBkYXRlc1tzZWxlY3Rvcl07XG4gICAgICAgIGZvckVhY2goZG9tLCBmdW5jdGlvbiAoZCkge1xuICAgICAgICAgICAgaWYgKHNlbGVjdG9yID09PSAnOmZpcnN0Jykge1xuICAgICAgICAgICAgICAgIGJpbmQoZCwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoLzpmaXJzdCQvLnRlc3Qoc2VsZWN0b3IpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGsgPSBzZWxlY3Rvci5yZXBsYWNlKC86Zmlyc3QkLywgJycpO1xuICAgICAgICAgICAgICAgIHZhciBlbGVtID0gZC5xdWVyeVNlbGVjdG9yKGspO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtKSBiaW5kKGVsZW0sIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBub2RlcyA9IGQucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYmluZChub2Rlc1tpXSwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZG9tLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IGRvbVswXVxuICAgICAgICA6IGRvbVxuICAgIDtcbn1cblxuZnVuY3Rpb24gYmluZCAobm9kZSwgdmFsdWUpIHtcbiAgICBpZiAoaXNFbGVtZW50KHZhbHVlKSkge1xuICAgICAgICBub2RlLmlubmVySFRNTCA9ICcnO1xuICAgICAgICBub2RlLmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGUgPSBoeXBlcmdsdWUobm9kZS5jbG9uZU5vZGUodHJ1ZSksIHZhbHVlW2ldKTtcbiAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZSwgbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgIH1cbiAgICBlbHNlIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGZvckVhY2gob2JqZWN0S2V5cyh2YWx1ZSksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdfdGV4dCcpIHtcbiAgICAgICAgICAgICAgICBzZXRUZXh0KG5vZGUsIHZhbHVlW2tleV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoa2V5ID09PSAnX2h0bWwnICYmIGlzRWxlbWVudCh2YWx1ZVtrZXldKSkge1xuICAgICAgICAgICAgICAgIG5vZGUuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgICAgICAgICAgbm9kZS5hcHBlbmRDaGlsZCh2YWx1ZVtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGtleSA9PT0gJ19odG1sJykge1xuICAgICAgICAgICAgICAgIG5vZGUuaW5uZXJIVE1MID0gdmFsdWVba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZVtrZXldKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2Ugc2V0VGV4dChub2RlLCB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGZvckVhY2goeHMsIGYpIHtcbiAgICBpZiAoeHMuZm9yRWFjaCkgcmV0dXJuIHhzLmZvckVhY2goZik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykgZih4c1tpXSwgaSlcbn1cblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHJlcy5wdXNoKGtleSk7XG4gICAgcmV0dXJuIHJlcztcbn07XG5cbmZ1bmN0aW9uIGlzRWxlbWVudCAoZSkge1xuICAgIHJldHVybiBlICYmIHR5cGVvZiBlID09PSAnb2JqZWN0JyAmJiBlLmNoaWxkTm9kZXNcbiAgICAgICAgJiYgKHR5cGVvZiBlLmFwcGVuZENoaWxkID09PSAnZnVuY3Rpb24nXG4gICAgICAgIHx8IHR5cGVvZiBlLmFwcGVuZENoaWxkID09PSAnb2JqZWN0JylcbiAgICA7XG59XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbmZ1bmN0aW9uIHNldFRleHQgKGUsIHMpIHtcbiAgICBlLmlubmVySFRNTCA9ICcnO1xuICAgIHZhciB0eHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShTdHJpbmcocykpO1xuICAgIGUuYXBwZW5kQ2hpbGQodHh0KTtcbn1cbiIsIlxuLyoqXG4gKiBFeHBvc2UgYHBhcnNlYC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuXG4vKipcbiAqIFdyYXAgbWFwIGZyb20ganF1ZXJ5LlxuICovXG5cbnZhciBtYXAgPSB7XG4gIG9wdGlvbjogWzEsICc8c2VsZWN0IG11bHRpcGxlPVwibXVsdGlwbGVcIj4nLCAnPC9zZWxlY3Q+J10sXG4gIG9wdGdyb3VwOiBbMSwgJzxzZWxlY3QgbXVsdGlwbGU9XCJtdWx0aXBsZVwiPicsICc8L3NlbGVjdD4nXSxcbiAgbGVnZW5kOiBbMSwgJzxmaWVsZHNldD4nLCAnPC9maWVsZHNldD4nXSxcbiAgdGhlYWQ6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICB0Ym9keTogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIHRmb290OiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgY29sZ3JvdXA6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICBjYXB0aW9uOiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgdHI6IFsyLCAnPHRhYmxlPjx0Ym9keT4nLCAnPC90Ym9keT48L3RhYmxlPiddLFxuICB0ZDogWzMsICc8dGFibGU+PHRib2R5Pjx0cj4nLCAnPC90cj48L3Rib2R5PjwvdGFibGU+J10sXG4gIHRoOiBbMywgJzx0YWJsZT48dGJvZHk+PHRyPicsICc8L3RyPjwvdGJvZHk+PC90YWJsZT4nXSxcbiAgY29sOiBbMiwgJzx0YWJsZT48dGJvZHk+PC90Ym9keT48Y29sZ3JvdXA+JywgJzwvY29sZ3JvdXA+PC90YWJsZT4nXSxcbiAgX2RlZmF1bHQ6IFswLCAnJywgJyddXG59O1xuXG4vKipcbiAqIFBhcnNlIGBodG1sYCBhbmQgcmV0dXJuIHRoZSBjaGlsZHJlbi5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaHRtbFxuICogQHJldHVybiB7QXJyYXl9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShodG1sKSB7XG4gIGlmICgnc3RyaW5nJyAhPSB0eXBlb2YgaHRtbCkgdGhyb3cgbmV3IFR5cGVFcnJvcignU3RyaW5nIGV4cGVjdGVkJyk7XG4gIFxuICAvLyB0YWcgbmFtZVxuICB2YXIgbSA9IC88KFtcXHc6XSspLy5leGVjKGh0bWwpO1xuICBpZiAoIW0pIHRocm93IG5ldyBFcnJvcignTm8gZWxlbWVudHMgd2VyZSBnZW5lcmF0ZWQuJyk7XG4gIHZhciB0YWcgPSBtWzFdO1xuICBcbiAgLy8gYm9keSBzdXBwb3J0XG4gIGlmICh0YWcgPT0gJ2JvZHknKSB7XG4gICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaHRtbCcpO1xuICAgIGVsLmlubmVySFRNTCA9IGh0bWw7XG4gICAgcmV0dXJuIFtlbC5yZW1vdmVDaGlsZChlbC5sYXN0Q2hpbGQpXTtcbiAgfVxuICBcbiAgLy8gd3JhcCBtYXBcbiAgdmFyIHdyYXAgPSBtYXBbdGFnXSB8fCBtYXAuX2RlZmF1bHQ7XG4gIHZhciBkZXB0aCA9IHdyYXBbMF07XG4gIHZhciBwcmVmaXggPSB3cmFwWzFdO1xuICB2YXIgc3VmZml4ID0gd3JhcFsyXTtcbiAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGVsLmlubmVySFRNTCA9IHByZWZpeCArIGh0bWwgKyBzdWZmaXg7XG4gIHdoaWxlIChkZXB0aC0tKSBlbCA9IGVsLmxhc3RDaGlsZDtcblxuICByZXR1cm4gb3JwaGFuKGVsLmNoaWxkcmVuKTtcbn1cblxuLyoqXG4gKiBPcnBoYW4gYGVsc2AgYW5kIHJldHVybiBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge05vZGVMaXN0fSBlbHNcbiAqIEByZXR1cm4ge0FycmF5fVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gb3JwaGFuKGVscykge1xuICB2YXIgcmV0ID0gW107XG5cbiAgd2hpbGUgKGVscy5sZW5ndGgpIHtcbiAgICByZXQucHVzaChlbHNbMF0ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbHNbMF0pKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG4iLCJ2YXIgZGljdGlvbmFyeSA9IHtcbiAgd29yZHM6IFtcbiAgICAnYWQnLFxuICAgICdhZGlwaXNpY2luZycsXG4gICAgJ2FsaXF1YScsXG4gICAgJ2FsaXF1aXAnLFxuICAgICdhbWV0JyxcbiAgICAnYW5pbScsXG4gICAgJ2F1dGUnLFxuICAgICdjaWxsdW0nLFxuICAgICdjb21tb2RvJyxcbiAgICAnY29uc2VjdGV0dXInLFxuICAgICdjb25zZXF1YXQnLFxuICAgICdjdWxwYScsXG4gICAgJ2N1cGlkYXRhdCcsXG4gICAgJ2Rlc2VydW50JyxcbiAgICAnZG8nLFxuICAgICdkb2xvcicsXG4gICAgJ2RvbG9yZScsXG4gICAgJ2R1aXMnLFxuICAgICdlYScsXG4gICAgJ2VpdXNtb2QnLFxuICAgICdlbGl0JyxcbiAgICAnZW5pbScsXG4gICAgJ2Vzc2UnLFxuICAgICdlc3QnLFxuICAgICdldCcsXG4gICAgJ2V1JyxcbiAgICAnZXgnLFxuICAgICdleGNlcHRldXInLFxuICAgICdleGVyY2l0YXRpb24nLFxuICAgICdmdWdpYXQnLFxuICAgICdpZCcsXG4gICAgJ2luJyxcbiAgICAnaW5jaWRpZHVudCcsXG4gICAgJ2lwc3VtJyxcbiAgICAnaXJ1cmUnLFxuICAgICdsYWJvcmUnLFxuICAgICdsYWJvcmlzJyxcbiAgICAnbGFib3J1bScsXG4gICAgJ0xvcmVtJyxcbiAgICAnbWFnbmEnLFxuICAgICdtaW5pbScsXG4gICAgJ21vbGxpdCcsXG4gICAgJ25pc2knLFxuICAgICdub24nLFxuICAgICdub3N0cnVkJyxcbiAgICAnbnVsbGEnLFxuICAgICdvY2NhZWNhdCcsXG4gICAgJ29mZmljaWEnLFxuICAgICdwYXJpYXR1cicsXG4gICAgJ3Byb2lkZW50JyxcbiAgICAncXVpJyxcbiAgICAncXVpcycsXG4gICAgJ3JlcHJlaGVuZGVyaXQnLFxuICAgICdzaW50JyxcbiAgICAnc2l0JyxcbiAgICAnc3VudCcsXG4gICAgJ3RlbXBvcicsXG4gICAgJ3VsbGFtY28nLFxuICAgICd1dCcsXG4gICAgJ3ZlbGl0JyxcbiAgICAndmVuaWFtJyxcbiAgICAndm9sdXB0YXRlJyAgXG4gIF1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZGljdGlvbmFyeTsiLCJ2YXIgZ2VuZXJhdG9yID0gZnVuY3Rpb24oKSB7XG4gIHZhciBvcHRpb25zID0gKGFyZ3VtZW50cy5sZW5ndGgpID8gYXJndW1lbnRzWzBdIDoge31cbiAgICAsIGNvdW50ID0gb3B0aW9ucy5jb3VudCB8fCAxXG4gICAgLCB1bml0cyA9IG9wdGlvbnMudW5pdHMgfHwgJ3NlbnRlbmNlcydcbiAgICAsIHNlbnRlbmNlTG93ZXJCb3VuZCA9IG9wdGlvbnMuc2VudGVuY2VMb3dlckJvdW5kIHx8IDVcbiAgICAsIHNlbnRlbmNlVXBwZXJCb3VuZCA9IG9wdGlvbnMuc2VudGVuY2VVcHBlckJvdW5kIHx8IDE1XG5cdCAgLCBwYXJhZ3JhcGhMb3dlckJvdW5kID0gb3B0aW9ucy5wYXJhZ3JhcGhMb3dlckJvdW5kIHx8IDNcblx0ICAsIHBhcmFncmFwaFVwcGVyQm91bmQgPSBvcHRpb25zLnBhcmFncmFwaFVwcGVyQm91bmQgfHwgN1xuXHQgICwgZm9ybWF0ID0gb3B0aW9ucy5mb3JtYXQgfHwgJ3BsYWluJ1xuICAgICwgd29yZHMgPSBvcHRpb25zLndvcmRzIHx8IHJlcXVpcmUoJy4vZGljdGlvbmFyeScpLndvcmRzXG4gICAgLCByYW5kb20gPSBvcHRpb25zLnJhbmRvbSB8fCBNYXRoLnJhbmRvbTtcblxuICB1bml0cyA9IHNpbXBsZVBsdXJhbGl6ZSh1bml0cy50b0xvd2VyQ2FzZSgpKTtcblxuICB2YXIgcmFuZG9tSW50ZWdlciA9IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IocmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkgKyBtaW4pO1xuICB9O1xuICBcbiAgdmFyIHJhbmRvbVdvcmQgPSBmdW5jdGlvbih3b3Jkcykge1xuICAgIHJldHVybiB3b3Jkc1tyYW5kb21JbnRlZ2VyKDAsIHdvcmRzLmxlbmd0aCAtIDEpXTtcbiAgfTtcbiAgXG4gIHZhciByYW5kb21TZW50ZW5jZSA9IGZ1bmN0aW9uKHdvcmRzLCBsb3dlckJvdW5kLCB1cHBlckJvdW5kKSB7XG4gICAgdmFyIHNlbnRlbmNlID0gJydcbiAgICAgICwgYm91bmRzID0ge21pbjogMCwgbWF4OiByYW5kb21JbnRlZ2VyKGxvd2VyQm91bmQsIHVwcGVyQm91bmQpfTtcbiAgICBcbiAgICB3aGlsZSAoYm91bmRzLm1pbiA8IGJvdW5kcy5tYXgpIHtcbiAgICAgIHNlbnRlbmNlID0gc2VudGVuY2UgKyAnICcgKyByYW5kb21Xb3JkKHdvcmRzKTtcbiAgICAgIGJvdW5kcy5taW4gPSBib3VuZHMubWluICsgMTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHNlbnRlbmNlLmxlbmd0aCkge1xuICAgICAgc2VudGVuY2UgPSBzZW50ZW5jZS5zbGljZSgxKTtcbiAgICAgIHNlbnRlbmNlID0gc2VudGVuY2UuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzZW50ZW5jZS5zbGljZSgxKTtcbiAgICB9XG4gIFxuICAgIHJldHVybiBzZW50ZW5jZTtcbiAgfTtcblxuICB2YXIgcmFuZG9tUGFyYWdyYXBoID0gZnVuY3Rpb24od29yZHMsIGxvd2VyQm91bmQsIHVwcGVyQm91bmQsIHNlbnRlbmNlTG93ZXJCb3VuZCwgc2VudGVuY2VVcHBlckJvdW5kKSB7XG4gICAgdmFyIHBhcmFncmFwaCA9ICcnXG4gICAgICAsIGJvdW5kcyA9IHttaW46IDAsIG1heDogcmFuZG9tSW50ZWdlcihsb3dlckJvdW5kLCB1cHBlckJvdW5kKX07XG4gICAgICBcbiAgICB3aGlsZSAoYm91bmRzLm1pbiA8IGJvdW5kcy5tYXgpIHtcbiAgICAgIHBhcmFncmFwaCA9IHBhcmFncmFwaCArICcuICcgKyByYW5kb21TZW50ZW5jZSh3b3Jkcywgc2VudGVuY2VMb3dlckJvdW5kLCBzZW50ZW5jZVVwcGVyQm91bmQpO1xuICAgICAgYm91bmRzLm1pbiA9IGJvdW5kcy5taW4gKyAxO1xuICAgIH1cbiAgICBcbiAgICBpZiAocGFyYWdyYXBoLmxlbmd0aCkge1xuICAgICAgcGFyYWdyYXBoID0gcGFyYWdyYXBoLnNsaWNlKDIpO1xuICAgICAgcGFyYWdyYXBoID0gcGFyYWdyYXBoICsgJy4nO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcGFyYWdyYXBoO1xuICB9XG4gIFxuICB2YXIgaXRlciA9IDBcbiAgICAsIGJvdW5kcyA9IHttaW46IDAsIG1heDogY291bnR9XG4gICAgLCBzdHJpbmcgPSAnJ1xuICAgICwgcHJlZml4ID0gJydcbiAgICAsIHN1ZmZpeCA9IFwiXFxyXFxuXCI7XG5cbiAgaWYgKGZvcm1hdCA9PSAnaHRtbCcpIHtcbiAgICBwcmVmaXggPSAnPHA+JztcbiAgICBzdWZmaXggPSAnPC9wPic7XG4gIH1cbiAgICAgIFxuICB3aGlsZSAoYm91bmRzLm1pbiA8IGJvdW5kcy5tYXgpIHtcbiAgICBzd2l0Y2ggKHVuaXRzLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ3dvcmRzJzpcbiAgICAgICAgc3RyaW5nID0gc3RyaW5nICsgJyAnICsgcmFuZG9tV29yZCh3b3Jkcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc2VudGVuY2VzJzpcbiAgICAgICAgc3RyaW5nID0gc3RyaW5nICsgJy4gJyArIHJhbmRvbVNlbnRlbmNlKHdvcmRzLCBzZW50ZW5jZUxvd2VyQm91bmQsIHNlbnRlbmNlVXBwZXJCb3VuZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncGFyYWdyYXBocyc6XG4gICAgICAgIHN0cmluZyA9IHN0cmluZyArIHByZWZpeCArIHJhbmRvbVBhcmFncmFwaCh3b3JkcywgcGFyYWdyYXBoTG93ZXJCb3VuZCwgcGFyYWdyYXBoVXBwZXJCb3VuZCwgc2VudGVuY2VMb3dlckJvdW5kLCBzZW50ZW5jZVVwcGVyQm91bmQpICsgc3VmZml4O1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgYm91bmRzLm1pbiA9IGJvdW5kcy5taW4gKyAxO1xuICB9XG4gICAgXG4gIGlmIChzdHJpbmcubGVuZ3RoKSB7XG4gICAgdmFyIHBvcyA9IDA7XG4gICAgXG4gICAgaWYgKHN0cmluZy5pbmRleE9mKCcuICcpID09IDApIHtcbiAgICAgIHBvcyA9IDI7XG4gICAgfSBlbHNlIGlmIChzdHJpbmcuaW5kZXhPZignLicpID09IDAgfHwgc3RyaW5nLmluZGV4T2YoJyAnKSA9PSAwKSB7XG4gICAgICBwb3MgPSAxO1xuICAgIH1cbiAgICBcbiAgICBzdHJpbmcgPSBzdHJpbmcuc2xpY2UocG9zKTtcbiAgICBcbiAgICBpZiAodW5pdHMgPT0gJ3NlbnRlbmNlcycpIHtcbiAgICAgIHN0cmluZyA9IHN0cmluZyArICcuJztcbiAgICB9XG4gIH0gIFxuICBcbiAgcmV0dXJuIHN0cmluZztcbn07XG5cbmZ1bmN0aW9uIHNpbXBsZVBsdXJhbGl6ZShzdHJpbmcpIHtcbiAgaWYgKHN0cmluZy5pbmRleE9mKCdzJywgc3RyaW5nLmxlbmd0aCAtIDEpID09PSAtMSkge1xuICAgIHJldHVybiBzdHJpbmcgKyAncyc7XG4gIH1cbiAgcmV0dXJuIHN0cmluZztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZW5lcmF0b3I7XG4iLCJ2b2lkIGZ1bmN0aW9uKHJvb3Qpe1xuXG4gIGZ1bmN0aW9uIGRlZmF1bHRzKG9wdGlvbnMpe1xuICAgIHZhciBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIHZhciBtaW4gPSBvcHRpb25zLm1pblxuICAgIHZhciBtYXggPSBvcHRpb25zLm1heFxuICAgIHZhciBpbnRlZ2VyID0gb3B0aW9ucy5pbnRlZ2VyIHx8IGZhbHNlXG4gICAgaWYgKCBtaW4gPT0gbnVsbCAmJiBtYXggPT0gbnVsbCApIHtcbiAgICAgIG1pbiA9IDBcbiAgICAgIG1heCA9IDFcbiAgICB9IGVsc2UgaWYgKCBtaW4gPT0gbnVsbCApIHtcbiAgICAgIG1pbiA9IG1heCAtIDFcbiAgICB9IGVsc2UgaWYgKCBtYXggPT0gbnVsbCApIHtcbiAgICAgIG1heCA9IG1pbiArIDFcbiAgICB9XG4gICAgaWYgKCBtYXggPCBtaW4gKSB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgb3B0aW9ucywgbWF4IG11c3QgYmUgPj0gbWluJylcbiAgICByZXR1cm4ge1xuICAgICAgbWluOiAgICAgbWluXG4gICAgLCBtYXg6ICAgICBtYXhcbiAgICAsIGludGVnZXI6IGludGVnZXJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByYW5kb20ob3B0aW9ucyl7XG4gICAgb3B0aW9ucyA9IGRlZmF1bHRzKG9wdGlvbnMpXG4gICAgaWYgKCBvcHRpb25zLm1heCA9PT0gb3B0aW9ucy5taW4gKSByZXR1cm4gb3B0aW9ucy5taW5cbiAgICB2YXIgciA9IE1hdGgucmFuZG9tKCkgKiAob3B0aW9ucy5tYXggLSBvcHRpb25zLm1pbiArIE51bWJlcighIW9wdGlvbnMuaW50ZWdlcikpICsgb3B0aW9ucy5taW5cbiAgICByZXR1cm4gb3B0aW9ucy5pbnRlZ2VyID8gTWF0aC5mbG9vcihyKSA6IHJcbiAgfVxuXG4gIGZ1bmN0aW9uIGdlbmVyYXRvcihvcHRpb25zKXtcbiAgICBvcHRpb25zID0gZGVmYXVsdHMob3B0aW9ucylcbiAgICByZXR1cm4gZnVuY3Rpb24obWluLCBtYXgsIGludGVnZXIpe1xuICAgICAgb3B0aW9ucy5taW4gICAgID0gbWluICAgICB8fCBvcHRpb25zLm1pblxuICAgICAgb3B0aW9ucy5tYXggICAgID0gbWF4ICAgICB8fCBvcHRpb25zLm1heFxuICAgICAgb3B0aW9ucy5pbnRlZ2VyID0gaW50ZWdlciAhPSBudWxsID8gaW50ZWdlciA6IG9wdGlvbnMuaW50ZWdlclxuICAgICAgcmV0dXJuIHJhbmRvbShvcHRpb25zKVxuICAgIH1cbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gIHJhbmRvbVxuICBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3IgPSBnZW5lcmF0b3JcbiAgbW9kdWxlLmV4cG9ydHMuZGVmYXVsdHMgPSBkZWZhdWx0c1xufSh0aGlzKVxuIiwidm9pZCBmdW5jdGlvbihyb290KXtcblxuICAgIC8vIHJldHVybiBhIG51bWJlciBiZXR3ZWVuIDAgYW5kIG1heC0xXG4gICAgZnVuY3Rpb24gcihtYXgpeyByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpKm1heCkgfVxuXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGUoc2FsdCwgc2l6ZSl7XG4gICAgICAgIHZhciBrZXkgPSAnJ1xuICAgICAgICB2YXIgc2wgPSBzYWx0Lmxlbmd0aFxuICAgICAgICB3aGlsZSAoIHNpemUgLS0gKSB7XG4gICAgICAgICAgICB2YXIgcm5kID0gcihzbClcbiAgICAgICAgICAgIGtleSArPSBzYWx0W3JuZF1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ga2V5XG4gICAgfVxuXG4gICAgdmFyIHJuZHRvayA9IGZ1bmN0aW9uKHNhbHQsIHNpemUpe1xuICAgICAgICByZXR1cm4gaXNOYU4oc2l6ZSkgPyB1bmRlZmluZWQgOlxuICAgICAgICAgICAgICAgc2l6ZSA8IDEgICAgPyB1bmRlZmluZWQgOiBnZW5lcmF0ZShzYWx0LCBzaXplKVxuXG4gICAgfVxuXG4gICAgcm5kdG9rLmdlbiA9IGNyZWF0ZUdlbmVyYXRvclxuXG4gICAgZnVuY3Rpb24gY3JlYXRlR2VuZXJhdG9yKHNhbHQpe1xuICAgICAgICBzYWx0ID0gdHlwZW9mIHNhbHQgID09ICdzdHJpbmcnICYmIHNhbHQubGVuZ3RoID4gMCA/IHNhbHQgOiAgJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHp5MDEyMzQ1Njc4OSdcbiAgICAgICAgdmFyIHRlbXAgPSBybmR0b2suYmluZChybmR0b2ssIHNhbHQpXG4gICAgICAgIHRlbXAuc2FsdCA9IGZ1bmN0aW9uKCl7IHJldHVybiBzYWx0IH1cbiAgICAgICAgdGVtcC5jcmVhdGUgPSBjcmVhdGVHZW5lcmF0b3JcbiAgICAgICAgdGVtcC5nZW4gPSBjcmVhdGVHZW5lcmF0b3JcbiAgICAgICAgcmV0dXJuIHRlbXBcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUdlbmVyYXRvcigpXG5cbn0odGhpcylcbiIsInZvaWQgZnVuY3Rpb24ocm9vdCl7XG5cblx0J3VzZSBzdHJpY3QnXG5cblx0dmFyIGNyZWF0ZSA9IE9iamVjdC5jcmVhdGUgfHwgZnVuY3Rpb24obyl7XG5cdFx0dmFyIEYgPSBmdW5jdGlvbigpe31cblx0XHRGLnByb3RvdHlwZSA9IG9cblx0XHRyZXR1cm4gbmV3IEYoKVxuXHR9XG5cblx0dmFyIGV4dGVuZCA9IGZ1bmN0aW9uKHRvLCBmcm9tKXtcblx0XHRmb3IgKCB2YXIgcCBpbiBmcm9tICkgdG9bcF0gPSBmcm9tW3BdXG5cdFx0cmV0dXJuIHRvXG5cdH1cblxuXHQvLyBMaWJyYXJ5IG9iamVjdCAtIGEgYmFzZSBvYmplY3QgdG8gYmUgZXh0ZW5kZWRcblx0dmFyIFZpcmFsID0ge1xuXG5cdFx0Ly8gY3JlYXRlIGFuIGluaGVyaXRpbmcgb2JqZWN0LCB3aXRoIGFkZGVkIG9yIGNoYW5nZWQgbWV0aG9kcyBvciBwcm9wZXJ0aWVzXG5cdFx0ZXh0ZW5kOiBmdW5jdGlvbihwcm9wcyl7XG5cdFx0XHRyZXR1cm4gZXh0ZW5kKGNyZWF0ZSh0aGlzKSwgcHJvcHMpXG5cdFx0fSxcblxuXHRcdC8vIGNyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBhbiBvYmplY3QsIGNhbGxpbmcgYW4gaW5pdCBtZXRob2QgaWYgYXZhaWxhYmxlXG5cdFx0bWFrZTogZnVuY3Rpb24oKXtcblx0XHRcdHZhciBvYmogPSBjcmVhdGUodGhpcylcblx0XHRcdGlmICggdHlwZW9mIG9iai5pbml0ID09PSAnZnVuY3Rpb24nICkgb2JqLmluaXQuYXBwbHkob2JqLCBhcmd1bWVudHMpXG5cdFx0XHRyZXR1cm4gb2JqXG5cdFx0fVxuXHR9XG5cblx0Ly8gbW9kdWxlIGRhbmNlXG5cdGlmICggdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMgKSBtb2R1bGUuZXhwb3J0cyA9IFZpcmFsXG5cdGVsc2UgaWYgKCB0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgKSBkZWZpbmUoVmlyYWwpXG5cdGVsc2UgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb290LlZpcmFsID0gVmlyYWxcblxufSh0aGlzKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBTZXQgPSByZXF1aXJlKCcuL3NldC5qcycpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG5cbiAgZnVuY3Rpb24gY2xvbmUoQSl7XG4gICAgcmV0dXJuIFBhdGh3YXkubWFrZShBLnNvdXJjZXMsIEEuZWRnZXMsIEEudGFyZ2V0cylcbiAgfVxuXG4gIGZ1bmN0aW9uIHVuaW9uKEEsIEIpe1xuXG4gICAgcmV0dXJuIFBhdGh3YXkubWFrZShBLnNvdXJjZXMudW5pb24oQi5zb3VyY2VzKVxuICAgICAgICAgICAgICAgICAgICAgICwgQS5lZGdlcy51bmlvbihCLmVkZ2VzKVxuICAgICAgICAgICAgICAgICAgICAgICwgQS50YXJnZXRzLnVuaW9uKEIudGFyZ2V0cykpXG4gIH1cblxuICBmdW5jdGlvbiBzYW1lKEEsIEIpe1xuXG4gICAgcmV0dXJuIEEuc291cmNlcy5qb2ludChCLnNvdXJjZXMpIHx8XG4gICAgICAgICAgIEEuZWRnZXMuam9pbnQoQi5lZGdlcykgfHxcbiAgICAgICAgICAgQS50YXJnZXRzLmpvaW50KEIudGFyZ2V0cylcbiAgfVxuXG4gIHZhciBQYXRod2F5ID0gdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihzb3VyY2VzLCBlZGdlcywgdGFyZ2V0cyl7XG4gICAgICB0aGlzLnNvdXJjZXMgPSBzb3VyY2VzICE9IG51bGwgPyBzb3VyY2VzIDogU2V0Lm1ha2UoKVxuICAgICAgdGhpcy5lZGdlcyA9IGVkZ2VzICE9IG51bGwgPyBlZGdlcyA6IFNldC5tYWtlKClcbiAgICAgIHRoaXMudGFyZ2V0cyA9IHRhcmdldHMgIT0gbnVsbCA/IHRhcmdldHMgOiBTZXQubWFrZSgpXG4gICAgfVxuICAsIHNhbWU6IGVuc2xhdmUoc2FtZSlcbiAgLCBjbG9uZTogZW5zbGF2ZShjbG9uZSlcbiAgLCB1bmlvbjogZW5zbGF2ZSh1bmlvbilcbiAgfSlcblxuICBmdW5jdGlvbiBpbmRleE9mKFAsIHApe1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IFAudmFsdWVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgaWYgKCBzYW1lKFAudmFsdWVzW2ldLCBwKSApIHJldHVybiBpXG4gICAgfVxuICAgIHJldHVybiAtMVxuICB9XG5cbiAgZnVuY3Rpb24gc2l6ZShwYXRod2F5cyl7XG4gICAgcmV0dXJuIHBhdGh3YXlzLnZhbHVlcy5sZW5ndGhcbiAgfVxuXG5cbiAgZnVuY3Rpb24gZm9yRWFjaChwYXRod2F5cywgZm4pe1xuICAgIHBhdGh3YXlzLnZhbHVlcy5mb3JFYWNoKGZuKVxuICB9XG5cbiAgZnVuY3Rpb24gYWRkKHBhdGh3YXlzLCBzb3VyY2UsIGVkZ2UsIHRhcmdldCl7XG5cbiAgICB2YXIgbiA9IFBhdGh3YXkubWFrZShTZXQubWFrZSgpLmFkZChzb3VyY2UpLCBTZXQubWFrZSgpLmFkZChlZGdlKSwgU2V0Lm1ha2UoKS5hZGQodGFyZ2V0KSlcblxuICAgIHZhciBoID0gaW5kZXhPZihwYXRod2F5cywgbilcbiAgICBpZiAoIGggPiAtMSAgKSB7XG4gICAgICBwYXRod2F5cy52YWx1ZXNbaF0gPSBwYXRod2F5cy52YWx1ZXNbaF0udW5pb24obilcbiAgICB9IGVsc2Uge1xuICAgICAgcGF0aHdheXMudmFsdWVzLnB1c2gobilcbiAgICB9XG5cbiAgICByZXR1cm4gcGF0aHdheXNcbiAgfVxuXG4gIHZhciBQYXRod2F5cyA9IFNldC5leHRlbmQoe1xuICAgIGFkZDogZW5zbGF2ZShhZGQpXG4gICwgaW5kZXhPZjogZW5zbGF2ZShpbmRleE9mKVxuICB9KVxuXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBQYXRod2F5c1xuXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciBBcnIgPSByZXF1aXJlKCcuL2Fyci5qcycpXG5cblxuICBmdW5jdGlvbiBoYXMoc2V0LCB2YWx1ZSl7XG4gICAgcmV0dXJuIHNldC5pbmRleE9mKHZhbHVlKSA+IC0xXG4gIH1cblxuICBmdW5jdGlvbiBhZGQoc2V0LCB2YWx1ZSl7XG4gICAgaWYgKCAhIGhhcyhzZXQsIHZhbHVlKSApIHtcbiAgICAgIHNldC52YWx1ZXMucHVzaCh2YWx1ZSlcbiAgICB9XG4gICAgcmV0dXJuIHNldFxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlKHNldCwgdmFsdWUpe1xuICAgIHZhciBpZHggPSBpbmRleE9mKHNldCwgdmFsdWUpXG4gICAgaWYgKCBpZHggPiAtMSApIHtcbiAgICAgIHNldC52YWx1ZXMuc3BsaWNlKGlkeCwgMSlcbiAgICB9XG4gICAgcmV0dXJuIHNldFxuICB9XG5cbiAgZnVuY3Rpb24gc2FtZShzZXQsIG90aGVyKXtcbiAgICByZXR1cm4gc2V0LnZhbHVlcy5sZW5ndGggIT0gb3RoZXIudmFsdWVzLmxlbmd0aCA/IGZhbHNlXG4gICAgICAgICA6IHNldC52YWx1ZXMuZXZlcnkoZnVuY3Rpb24oYSl7IHJldHVybiBvdGhlci5oYXMoYSkgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHVuaW9uKHNldCwgb3RoZXIpe1xuICAgIHZhciByZXN1bHQgPSBzZXQuY2xvbmUoKVxuICAgIG90aGVyLmZvckVhY2goZnVuY3Rpb24odil7XG4gICAgICByZXN1bHQuYWRkKHYpXG4gICAgfSlcbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICBmdW5jdGlvbiBqb2ludChzZXQsIG90aGVyKXtcbiAgICByZXR1cm4gc2V0LnNvbWUoZnVuY3Rpb24oYSl7IHJldHVybiBvdGhlci5oYXMoYSkgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsb25lKHNldCl7XG4gICAgcmV0dXJuIFNldC5tYWtlKHNldClcbiAgfVxuXG4gIHZhciBTZXQgPSBBcnIuZXh0ZW5kKHtcbiAgICB1bmlvbjogZW5zbGF2ZSh1bmlvbilcbiAgLCBoYXM6IGVuc2xhdmUoaGFzKVxuICAsIGFkZDogZW5zbGF2ZShhZGQpXG4gICwgcmVtb3ZlOiBlbnNsYXZlKHJlbW92ZSlcbiAgLCBzYW1lOiBlbnNsYXZlKHNhbWUpXG4gICwgam9pbnQ6IGVuc2xhdmUoam9pbnQpXG4gICwgY2xvbmU6IGVuc2xhdmUoY2xvbmUpXG4gIH0pXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBTZXRcblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIFwidXNlIHN0cmljdFwiXG4gIHZhciBybmQgPSByZXF1aXJlKCdyYW5kb20tbnVtYmVyJylcbiAgdmFyIGZzID0gcmVxdWlyZSgnZnMnKVxuICB2YXIgd3QgPSByZXF1aXJlKCcuLi9pbmRleC5qcycpXG4gIHZhciBkb20gPSByZXF1aXJlKCcuLi91dGlsL2RvbS5qcycpXG4gIHZhciB1aWQgPSByZXF1aXJlKCcuLi91dGlsL3VuaXF1ZV9pZC5qcycpXG4gIHZhciByYW5kX2ludCA9IHJuZC5nZW5lcmF0b3Ioe2ludGVnZXI6IHRydWV9KVxuICB2YXIgcHJpbnQgPSBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpXG5cbiAgdmFyIGxpcHNjZmcgPSB7XG4gICAgICBjb3VudDogMSAgICAgICAgICAgICAgICAgICAgICAvLyBOdW1iZXIgb2Ygd29yZHMsIHNlbnRlbmNlcywgb3IgcGFyYWdyYXBocyB0byBnZW5lcmF0ZS5cbiAgICAsIHVuaXRzOiAnc2VudGVuY2VzJyAgICAgICAgICAgIC8vIEdlbmVyYXRlIHdvcmRzLCBzZW50ZW5jZXMsIG9yIHBhcmFncmFwaHMuXG4gICAgLCBzZW50ZW5jZUxvd2VyQm91bmQ6IDEgICAgICAgICAvLyBNaW5pbXVtIHdvcmRzIHBlciBzZW50ZW5jZS5cbiAgICAsIHNlbnRlbmNlVXBwZXJCb3VuZDogMiAgICAgICAgLy8gTWF4aW11bSB3b3JkcyBwZXIgc2VudGVuY2UuXG4gICAgLCBmb3JtYXQ6ICdwbGFpbicgICAgICAgICAgICAgICAvLyBQbGFpbiB0ZXh0IG9yIGh0bWxcbiAgfVxuXG4gIHZhciBsaXBzdW0gPSByZXF1aXJlKCdsb3JlbS1pcHN1bScpLmJpbmQobnVsbCwgbGlwc2NmZylcblxuICBmdW5jdGlvbiBpc051bWJlcihuKXsgcmV0dXJuIHR5cGVvZiBuID09ICdudW1iZXInIH1cblxuICB2YXIgY29uZmlnID0gd3QuY29uZmlnKHtcbiAgICBwYWRkaW5nOiAyMVxuICAsIHJhbmtfZGV0ZWN0aW9uX2Vycm9yX21hcmdpbjogMlxuICAsIGVkZ2VXaWR0aDogNVxuICAsIGVkZ2VDbGFzczogJ0ZDSExpbmUnXG4gICwgZWRnZUVuZENsYXNzOiAnRkNITGluZS13aXRoYXJyb3cnXG4gICwgaW50ZXJzZWN0aW9uQ2xhc3M6ICdGQ0hMaW5lLWludGVyc2VjdGlvbidcbiAgfSlcblxuXG5cbiAgdmFyIGdyYXBoID0gd3QuZ3JhcGgoe1xuICAgIHJhbmtEaXI6ICdMUidcbiAgLCB1bml2ZXJzYWxTZXA6IDI5XG4gICwgZWRnZVNlcDogMFxuICAsIHJhbmtTZXA6IDEzNVxuICB9KVxuXG4gIHZhciBub2RlcyA9IEFycmF5KDEyKVxuICB2YXIgcmFua3MgPSBbJ3NhbWVfZmlyc3QnLCdzYW1lX3NlY29uZCcsJ3NhbWVfc2Vjb25kJywnc2FtZV9zZWNvbmQnLCdzYW1lX3RoaXJkJywnc2FtZV90aGlyZCcsJ3NhbWVfdGhpcmQnLCdzYW1lX3RoaXJkJywnc2FtZV90aGlyZCcsJ3NhbWVfZm91cnRoJywnc2FtZV9mb3VydGgnLCdzYW1lX2ZvdXJ0aCddXG4gIGZvciAoIHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aCA7IGkrKyApIHtcbiAgICBub2Rlc1tpXSA9IGdyYXBoLmFkZF9ub2RlKFxuICAgICAgJ0ZDSEJveCdcbiAgICAsIGZ1bmN0aW9uIChub2RlLCB2YWx1ZXMpe1xuLy8gdGhlc2UgbGluZXMgc2hvdWxkbid0IGJlIGhlcmVcbiAgICAgICAgbm9kZS5hdHRyKCd4JywgdmFsdWVzLngpXG4gICAgICAgIG5vZGUuYXR0cigneScsIHZhbHVlcy55KVxuICAgICAgICB2YXIgeCA9IHZhbHVlcy54IC0gdmFsdWVzLndpZHRoIC8gMlxuICAgICAgICB2YXIgeSA9IHZhbHVlcy55IC0gdmFsdWVzLmhlaWdodCAvIDJcbiAgICAgICAgbm9kZS5hZGRfYXR0cignOmZpcnN0JywgJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHggKyAnLCcgKyB5ICsgJyknKVxuICAgICAgICBub2RlLmFkZF9hdHRyKCcuRkNIQm94LVRleHQtYmcnLCAnd2lkdGgnLCB2YWx1ZXMud2lkdGggKVxuICAgICAgICBub2RlLmFkZF9hdHRyKCcuRkNIQm94LVRleHQtYmcnLCAnaGVpZ2h0JywgdmFsdWVzLmhlaWdodClcbiAgICB9XG4gICAgLCB7XG4gICAgICAgIFwiLkZDSEJveC1UZXh0LXRpdGxlXCI6IHtfdGV4dDogKGkrMSkgKycgJyArIGxpcHN1bSgpLnNsaWNlKDAsIDE3KX1cbiAgICAgICwgXCIuRkNIQm94LVRleHQtdHlwZVwiIDoge190ZXh0OiAnVHlwZTogJyArIGxpcHN1bSgpLnNsaWNlKDAsIDEzKX1cbiAgICB9KVxuICB9XG5cbiAgLy8gdmFyIHJuZF9ub2RlID0gcm5kLmdlbmVyYXRvcih7bWluOiAwLCBtYXg6IG5vZGVzLmxlbmd0aCAtIDEsIGludGVnZXI6IHRydWV9KVxuICAvLyB2YXIgbGlua3M9IEFycmF5KHJhbmRfaW50KDEsIE1hdGgucG93KHJhbmRfaW50KDEsIG5vZGVzLmxlbmd0aCksIDIpIC0gMSkpXG4gIHZhciBjb25uZWN0aW9ucyA9IFtcbiAgICBbMCwxXVxuICAsIFswLDJdXG4gICwgWzAsM11cbiAgLCBbMSw0XVxuICAsIFsxLDVdXG4gICwgWzEsNl1cbiAgLCBbMyw5XVxuICAsIFsyLDddXG4gICwgWzIsOF1cbiAgLCBbNCw5XVxuICAsIFs2LDldXG4gICwgWzUsMTBdXG4gICwgWzcsMTFdXG4gICwgWzgsMTFdXG4gICwgWzksN11cbiAgLCBbOSw4XVxuICAsIFs5LDExXVxuICAsIFsxMCw3XVxuICAsIFsxMCw4XVxuICAsIFsxMCwxMV1cbiAgXVxuICB2YXIgbGlua3MgPSBBcnJheShjb25uZWN0aW9ucy5sZW5ndGgpXG5cblxuICBmdW5jdGlvbiBidXQoZ2VuLCB4KXtcbiAgICB2YXIgciA9IGdlbigpXG4gICAgd2hpbGUgKCByID09IHggKSB7IHIgPSBnZW4oKSB9XG4gICAgcmV0dXJuIHJcbiAgfVxuXG5cbiAgZm9yICggdmFyIGkgPSBjb25uZWN0aW9ucy5sZW5ndGggLSAxOyBpID49IDAgOyBpLS0gKSB7XG4gICAgLy92YXIgbGluazEgPSBybmRfbm9kZSgpXG5cbiAgICBsaW5rc1tpXSA9IGdyYXBoLmNvbm5lY3QoXG4gICAgICAnRkNITGluZSdcbiAgICAvLyAsIG5vZGVzW2xpbmsxXVxuICAgIC8vICwgbm9kZXNbYnV0KHJuZF9ub2RlLCBsaW5rMSldXG4gICAgLCBub2Rlc1tjb25uZWN0aW9uc1tpXVswXV1cbiAgICAsIG5vZGVzW2Nvbm5lY3Rpb25zW2ldWzFdXVxuICApXG5cbiAgfVxuXG4gIHZhciBkaWFncmFtID0gd3QuZGlhZ3JhbShjb25maWcsIGdyYXBoKVxuICBkaWFncmFtLnRvX2RlZnMoXCI8Zm9udCBob3Jpei1hZHYteD1cXFwiMjA0OFxcXCI+XFxuICA8IS0tIE9wZW4gU2FucyBpcyBhIHRyYWRlbWFyayBvZiBHb29nbGUgYW5kIG1heSBiZSByZWdpc3RlcmVkIGluIGNlcnRhaW4ganVyaXNkaWN0aW9ucy4gLS0+XFxuICA8IS0tIENvcHlyaWdodDogQ29weXJpZ2h0IDIwMTQgQWRvYmUgU3lzdGVtIEluY29ycG9yYXRlZC4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gLS0+XFxuICA8Zm9udC1mYWNlIGZvbnQtZmFtaWx5PVxcXCJPcGVuU2Fucy1TZW1pYm9sZFxcXCIgdW5pdHMtcGVyLWVtPVxcXCIyMDQ4XFxcIiB1bmRlcmxpbmUtcG9zaXRpb249XFxcIi0xNTRcXFwiIHVuZGVybGluZS10aGlja25lc3M9XFxcIjEwMlxcXCIvPlxcbiAgPG1pc3NpbmctZ2x5cGggaG9yaXotYWR2LXg9XFxcIjEyMjlcXFwiIGQ9XFxcIk0xOTMsMTQ2Mmw4NDEsMGwwLC0xNDYybC04NDEsME0yOTcsMTA0bDYzMywwbDAsMTI1NGwtNjMzLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiIFxcXCIgaG9yaXotYWR2LXg9XFxcIjUzMlxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiFcXFwiIGhvcml6LWFkdi14PVxcXCI1NjVcXFwiIGQ9XFxcIk0zNzEsNDQ0bC0xNzQsMGwtNTIsMTAxOGwyNzcsME0xMzMsMTI1QzEzMywxNzQgMTQ2LDIxMiAxNzIsMjM4QzE5OCwyNjMgMjM1LDI3NiAyODMsMjc2QzMzMCwyNzYgMzY3LDI2MyAzOTIsMjM2QzQxNywyMDkgNDMwLDE3MiA0MzAsMTI1QzQzMCw3OCA0MTcsNDAgMzkyLDEzQzM2NiwtMTUgMzMwLC0yOSAyODMsLTI5QzIzNiwtMjkgMTk5LC0xNiAxNzMsMTFDMTQ2LDM4IDEzMyw3NiAxMzMsMTI1elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiZxdW90O1xcXCIgaG9yaXotYWR2LXg9XFxcIjg5M1xcXCIgZD1cXFwiTTM2NSwxNDYybC00MSwtNTI4bC0xNTAsMGwtNDEsNTI4TTc2MCwxNDYybC00MSwtNTI4bC0xNTAsMGwtNDEsNTI4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiNcXFwiIGhvcml6LWFkdi14PVxcXCIxMzIzXFxcIiBkPVxcXCJNOTg5LDg3MGwtNTUsLTI4NGwyNzAsMGwwLC0xNjhsLTMwMywwbC04MCwtNDE4bC0xNzgsMGw4MCw0MThsLTI0OCwwbC04MCwtNDE4bC0xNzQsMGw3Niw0MThsLTI1MCwwbDAsMTY4bDI4MywwbDU3LDI4NGwtMjY0LDBsMCwxNjhsMjkzLDBsODAsNDIybDE4MCwwbC04MCwtNDIybDI1MiwwbDgwLDQyMmwxNzQsMGwtODAsLTQyMmwyNTIsMGwwLC0xNjhNNTA2LDU4NmwyNTAsMGw1NywyODRsLTI1MCwwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiRcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNMTA2Myw0NTNDMTA2MywzNTYgMTAyOCwyNzcgOTU3LDIxNEM4ODYsMTUxIDc4NCwxMTMgNjUxLDk4bDAsLTIxN2wtMTMzLDBsMCwyMTFDMzUzLDk1IDIxNywxMjAgMTExLDE2OGwwLDIxMUMxNjgsMzUxIDIzNSwzMjggMzEyLDMwOUMzODksMjkwIDQ1NywyODAgNTE4LDI3OWwwLDM3NGwtODQsMzFDMzI1LDcyNiAyNDUsNzc2IDE5NSw4MzVDMTQ0LDg5MyAxMTksOTY1IDExOSwxMDUxQzExOSwxMTQzIDE1NSwxMjE5IDIyNywxMjc4QzI5OCwxMzM3IDM5NSwxMzczIDUxOCwxMzg2bDAsMTY4bDEzMywwbDAsLTE2NUM3ODYsMTM4NCA5MTUsMTM1NyAxMDM2LDEzMDdsLTczLC0xODNDODU4LDExNjUgNzU0LDExOTAgNjUxLDExOThsMCwtMzY0bDc2LC0yOUM4NTQsNzU2IDk0MSw3MDUgOTkwLDY1MUMxMDM5LDU5NyAxMDYzLDUzMSAxMDYzLDQ1M004MjcsNDM4QzgyNyw0NzcgODE0LDUwOSA3ODcsNTM0Qzc2MCw1NTkgNzE0LDU4MyA2NTEsNjA2bDAsLTMxOUM3NjgsMzA1IDgyNywzNTUgODI3LDQzOE0zNTQsMTA1M0MzNTQsMTAxNSAzNjYsOTgzIDM5MCw5NThDNDEzLDkzMyA0NTYsOTA4IDUxOCw4ODNsMCwzMTFDNDY1LDExODYgNDI0LDExNzAgMzk2LDExNDVDMzY4LDExMjAgMzU0LDEwOTAgMzU0LDEwNTN6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJVxcXCIgaG9yaXotYWR2LXg9XFxcIjE3NjVcXFwiIGQ9XFxcIk0yNzksMTAyNEMyNzksOTI1IDI4OSw4NTEgMzA4LDgwMkMzMjcsNzUzIDM1OSw3MjkgNDAzLDcyOUM0OTEsNzI5IDUzNSw4MjcgNTM1LDEwMjRDNTM1LDEyMjEgNDkxLDEzMTkgNDAzLDEzMTlDMzU5LDEzMTkgMzI3LDEyOTUgMzA4LDEyNDZDMjg5LDExOTcgMjc5LDExMjMgMjc5LDEwMjRNNzI5LDEwMjZDNzI5LDg3MyA3MDIsNzU4IDY0Nyw2ODFDNTkyLDYwNCA1MTAsNTY1IDQwMyw1NjVDMzAyLDU2NSAyMjMsNjA1IDE2OCw2ODVDMTEyLDc2NCA4NCw4NzggODQsMTAyNkM4NCwxMzMxIDE5MCwxNDgzIDQwMywxNDgzQzUwOCwxNDgzIDU4OCwxNDQ0IDY0NSwxMzY1QzcwMSwxMjg2IDcyOSwxMTczIDcyOSwxMDI2TTEyMzEsNDQwQzEyMzEsMzQxIDEyNDEsMjY2IDEyNjEsMjE3QzEyODAsMTY4IDEzMTIsMTQzIDEzNTYsMTQzQzE0NDMsMTQzIDE0ODcsMjQyIDE0ODcsNDQwQzE0ODcsNjM1IDE0NDMsNzMzIDEzNTYsNzMzQzEzMTIsNzMzIDEyODAsNzA5IDEyNjEsNjYxQzEyNDEsNjEzIDEyMzEsNTM5IDEyMzEsNDQwTTE2ODEsNDQwQzE2ODEsMjg3IDE2NTMsMTcyIDE1OTgsOTVDMTU0MywxOCAxNDYyLC0yMCAxMzU2LC0yMEMxMjU1LC0yMCAxMTc2LDIwIDExMjAsOTlDMTA2NCwxNzggMTAzNiwyOTEgMTAzNiw0NDBDMTAzNiw3NDUgMTE0Myw4OTcgMTM1Niw4OTdDMTQ1OSw4OTcgMTUzOSw4NTggMTU5Niw3NzlDMTY1Myw3MDAgMTY4MSw1ODcgMTY4MSw0NDBNMTM4NCwxNDYybC04MTEsLTE0NjJsLTE5NCwwbDgxMSwxNDYyelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiZhbXA7XFxcIiBob3Jpei1hZHYteD1cXFwiMTUxNlxcXCIgZD1cXFwiTTQ1MSwxMTQ3QzQ1MSwxMTA1IDQ2MiwxMDY1IDQ4NSwxMDI4QzUwNyw5OTEgNTM4LDk1MSA1NzgsOTA5QzY1Myw5NTIgNzA2LDk5MiA3MzcsMTAyOUM3NjcsMTA2NiA3ODIsMTEwNyA3ODIsMTE1M0M3ODIsMTE5NiA3NjgsMTIzMSA3MzksMTI1N0M3MTAsMTI4MyA2NzEsMTI5NiA2MjMsMTI5NkM1NzAsMTI5NiA1MjksMTI4MyA0OTgsMTI1NkM0NjcsMTIyOSA0NTEsMTE5MiA0NTEsMTE0N002MDAsMTgyQzcyMiwxODIgODI2LDIxOCA5MTMsMjg5bC0zODMsMzc3QzQ1OSw2MjEgNDExLDU3OCAzODQsNTM5QzM1Nyw0OTkgMzQ0LDQ1NCAzNDQsNDAzQzM0NCwzMzggMzY3LDI4NSA0MTQsMjQ0QzQ2MCwyMDMgNTIyLDE4MiA2MDAsMTgyTTk2LDM4N0M5Niw0NzQgMTE3LDU1MSAxNjAsNjE2QzIwMyw2ODEgMjgwLDc0NSAzOTEsODA5QzMyOCw4ODMgMjg1LDk0NiAyNjIsOTk3QzIzOSwxMDQ4IDIyNywxMTAwIDIyNywxMTU1QzIyNywxMjU2IDI2MywxMzM2IDMzNiwxMzk1QzQwOCwxNDU0IDUwNSwxNDgzIDYyNywxNDgzQzc0NSwxNDgzIDgzOCwxNDU1IDkwNSwxMzk4Qzk3MiwxMzQxIDEwMDYsMTI2NCAxMDA2LDExNjdDMTAwNiwxMDkxIDk4NCwxMDIyIDkzOSw5NjBDODk0LDg5OCA4MTgsODM2IDcxMyw3NzRsMzQ2LC0zMzRDMTExMyw1MTEgMTE1OCw2MTYgMTE5NCw3NTRsMjQyLDBDMTM4OSw1NjUgMTMxNSw0MTAgMTIxMiwyOTFsMzAxLC0yOTFsLTMwMywwbC0xNDksMTQ1Qzk5Myw5MCA5MjEsNDkgODQ0LDIyQzc2NywtNiA2ODEsLTIwIDU4OCwtMjBDNDM1LC0yMCAzMTQsMTYgMjI3LDg5QzE0MCwxNjIgOTYsMjYxIDk2LDM4N3pcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCInXFxcIiBob3Jpei1hZHYteD1cXFwiNDk4XFxcIiBkPVxcXCJNMzY1LDE0NjJsLTQxLC01MjhsLTE1MCwwbC00MSw1Mjh6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiKFxcXCIgaG9yaXotYWR2LXg9XFxcIjY0OVxcXCIgZD1cXFwiTTgyLDU2MUM4Miw3MzggMTA4LDkwMyAxNjAsMTA1N0MyMTEsMTIxMSAyODYsMTM0NiAzODMsMTQ2MmwyMDUsMEM0OTUsMTMzNyA0MjQsMTE5NiAzNzUsMTA0MUMzMjYsODg1IDMwMSw3MjYgMzAxLDU2M0MzMDEsNDAwIDMyNiwyNDMgMzc1LDkwQzQyNCwtNjMgNDk1LC0yMDEgNTg2LC0zMjRsLTIwMywwQzI4NSwtMjExIDIxMCwtNzggMTU5LDczQzEwOCwyMjQgODIsMzg3IDgyLDU2MXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIpXFxcIiBob3Jpei1hZHYteD1cXFwiNjQ5XFxcIiBkPVxcXCJNNTY3LDU2MUM1NjcsMzg2IDU0MSwyMjIgNDkwLDcxQzQzOCwtODAgMzYzLC0yMTIgMjY2LC0zMjRsLTIwMywwQzE1NSwtMTk5IDIyNiwtNjEgMjc1LDkxQzMyNCwyNDMgMzQ4LDQwMCAzNDgsNTYzQzM0OCw3MjYgMzIzLDg4NiAyNzQsMTA0MUMyMjUsMTE5NiAxNTQsMTMzNiA2MSwxNDYybDIwNSwwQzM2NCwxMzQ1IDQzOSwxMjEwIDQ5MCwxMDU2QzU0MSw5MDEgNTY3LDczNiA1NjcsNTYxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIipcXFwiIGhvcml6LWFkdi14PVxcXCIxMTIyXFxcIiBkPVxcXCJNNjcyLDE1NTZsLTQxLC0zODJsMzg1LDEwOGwyOCwtMjE3bC0zNjAsLTI5bDIzNiwtMzExbC0xOTksLTEwN2wtMTY2LDMzOGwtMTQ5LC0zMzhsLTIwNSwxMDdsMjMxLDMxMWwtMzU4LDI5bDM1LDIxN2wzNzYsLTEwOGwtNDEsMzgyelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIitcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNNDk0LDYzM2wtMzk4LDBsMCwxNzhsMzk4LDBsMCw0MDhsMTgwLDBsMCwtNDA4bDM5OSwwbDAsLTE3OGwtMzk5LDBsMCwtNDA2bC0xODAsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIsXFxcIiBob3Jpei1hZHYteD1cXFwiNTQ3XFxcIiBkPVxcXCJNNDEyLDIxNUMzODAsOTEgMzIxLC02OSAyMzYsLTI2NGwtMTczLDBDMTA5LC04NCAxNDMsODMgMTY2LDIzOGwyMzEsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCItXFxcIiBob3Jpei1hZHYteD1cXFwiNjU5XFxcIiBkPVxcXCJNNzIsNDQ5bDAsMjAwbDUxNCwwbDAsLTIwMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIuXFxcIiBob3Jpei1hZHYteD1cXFwiNTYzXFxcIiBkPVxcXCJNMTMzLDEyNUMxMzMsMTc0IDE0NiwyMTEgMTcxLDIzN0MxOTYsMjYzIDIzMywyNzYgMjgxLDI3NkMzMzAsMjc2IDM2NywyNjMgMzkyLDIzNkM0MTcsMjA5IDQzMCwxNzIgNDMwLDEyNUM0MzAsNzggNDE3LDQwIDM5MiwxM0MzNjYsLTE1IDMyOSwtMjkgMjgxLC0yOUMyMzMsLTI5IDE5NiwtMTUgMTcxLDEyQzE0NiwzOSAxMzMsNzcgMTMzLDEyNXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIvXFxcIiBob3Jpei1hZHYteD1cXFwiNzk5XFxcIiBkPVxcXCJNNzgyLDE0NjJsLTU0NCwtMTQ2MmwtMjIyLDBsNTQ1LDE0NjJ6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiMFxcXCIgaG9yaXotYWR2LXg9XFxcIjExNjlcXFwiIGQ9XFxcIk0xMDgxLDczMUMxMDgxLDQ3NyAxMDQwLDI4OCA5NTksMTY1Qzg3Nyw0MiA3NTIsLTIwIDU4NCwtMjBDNDIxLC0yMCAyOTgsNDQgMjE0LDE3MUMxMzAsMjk4IDg4LDQ4NSA4OCw3MzFDODgsOTg5IDEyOSwxMTc5IDIxMSwxMzAyQzI5MiwxNDI0IDQxNywxNDg1IDU4NCwxNDg1Qzc0NywxNDg1IDg3MSwxNDIxIDk1NSwxMjkzQzEwMzksMTE2NSAxMDgxLDk3OCAxMDgxLDczMU0zMjYsNzMxQzMyNiw1MzIgMzQ3LDM4OSAzODgsMzA0QzQyOSwyMTkgNDk0LDE3NiA1ODQsMTc2QzY3NCwxNzYgNzQwLDIxOSA3ODIsMzA2QzgyMywzOTMgODQ0LDUzNCA4NDQsNzMxQzg0NCw5MjcgODIzLDEwNjkgNzgyLDExNTdDNzQwLDEyNDQgNjc0LDEyODggNTg0LDEyODhDNDk0LDEyODggNDI5LDEyNDUgMzg4LDExNTlDMzQ3LDEwNzMgMzI2LDkzMCAzMjYsNzMxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIjFcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNNzgwLDBsLTIzNSwwbDAsOTQ0QzU0NSwxMDU3IDU0OCwxMTQ2IDU1MywxMjEyQzUzOCwxMTk2IDUxOSwxMTc4IDQ5NywxMTU5QzQ3NCwxMTQwIDM5OSwxMDc4IDI3Miw5NzVsLTExOCwxNDlsNDMwLDMzOGwxOTYsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIyXFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTEwODEsMGwtOTkxLDBsMCwxNzhsMzc3LDM3OUM1NzgsNjcxIDY1Miw3NTIgNjg5LDgwMEM3MjUsODQ3IDc1MSw4OTIgNzY4LDkzNEM3ODUsOTc2IDc5MywxMDIxIDc5MywxMDY5Qzc5MywxMTM1IDc3MywxMTg3IDczNCwxMjI1QzY5NCwxMjYzIDYzOSwxMjgyIDU2OSwxMjgyQzUxMywxMjgyIDQ1OSwxMjcyIDQwNywxMjUxQzM1NCwxMjMwIDI5NCwxMTkzIDIyNSwxMTM5bC0xMjcsMTU1QzE3OSwxMzYzIDI1OCwxNDExIDMzNSwxNDQwQzQxMiwxNDY5IDQ5MywxNDgzIDU4MCwxNDgzQzcxNiwxNDgzIDgyNSwxNDQ4IDkwNywxMzc3Qzk4OSwxMzA2IDEwMzAsMTIxMCAxMDMwLDEwOTBDMTAzMCwxMDI0IDEwMTgsOTYxIDk5NSw5MDJDOTcxLDg0MyA5MzUsNzgyIDg4Niw3MTlDODM3LDY1NiA3NTUsNTcwIDY0MSw0NjNsLTI1NCwtMjQ2bDAsLTEwbDY5NCwwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIjNcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNMTAyNiwxMTI2QzEwMjYsMTAzMyA5OTksOTU2IDk0NSw4OTVDODkxLDgzMyA4MTUsNzkxIDcxNyw3NzBsMCwtOEM4MzQsNzQ3IDkyMiw3MTEgOTgxLDY1M0MxMDQwLDU5NCAxMDY5LDUxNyAxMDY5LDQyMEMxMDY5LDI3OSAxMDE5LDE3MSA5MjAsOTVDODIxLDE4IDY3OSwtMjAgNDk2LC0yMEMzMzQsLTIwIDE5Nyw2IDg2LDU5bDAsMjA5QzE0OCwyMzcgMjE0LDIxNCAyODMsMTk3QzM1MiwxODAgNDE5LDE3MiA0ODMsMTcyQzU5NiwxNzIgNjgxLDE5MyA3MzcsMjM1Qzc5MywyNzcgODIxLDM0MiA4MjEsNDMwQzgyMSw1MDggNzkwLDU2NSA3MjgsNjAyQzY2Niw2MzkgNTY5LDY1NyA0MzYsNjU3bC0xMjcsMGwwLDE5MWwxMjksMEM2NzEsODQ4IDc4OCw5MjkgNzg4LDEwOTBDNzg4LDExNTMgNzY4LDEyMDEgNzI3LDEyMzVDNjg2LDEyNjkgNjI2LDEyODYgNTQ3LDEyODZDNDkyLDEyODYgNDM4LDEyNzggMzg3LDEyNjNDMzM2LDEyNDcgMjc1LDEyMTYgMjA1LDExNzFsLTExNSwxNjRDMjI0LDE0MzQgMzgwLDE0ODMgNTU3LDE0ODNDNzA0LDE0ODMgODE5LDE0NTEgOTAyLDEzODhDOTg1LDEzMjUgMTAyNiwxMjM3IDEwMjYsMTEyNnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI0XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTExMzMsMzE5bC0xOTcsMGwwLC0zMTlsLTIyOSwwbDAsMzE5bC02NjgsMGwwLDE4MWw2NjgsOTY2bDIyOSwwbDAsLTk1MmwxOTcsME03MDcsNTE0bDAsMzY3QzcwNywxMDEyIDcxMCwxMTE5IDcxNywxMjAybC04LDBDNjkwLDExNTggNjYxLDExMDUgNjIxLDEwNDJsLTM2MywtNTI4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIjVcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNNTg2LDkxM0M3MzMsOTEzIDg1MCw4NzQgOTM2LDc5NkMxMDIyLDcxOCAxMDY1LDYxMiAxMDY1LDQ3N0MxMDY1LDMyMSAxMDE2LDE5OSA5MTksMTEyQzgyMSwyNCA2ODIsLTIwIDUwMiwtMjBDMzM5LC0yMCAyMTAsNiAxMTcsNTlsMCwyMTNDMTcxLDI0MSAyMzMsMjE4IDMwMywyMDFDMzczLDE4NCA0MzgsMTc2IDQ5OCwxNzZDNjA0LDE3NiA2ODUsMjAwIDc0MCwyNDdDNzk1LDI5NCA4MjMsMzY0IDgyMyw0NTVDODIzLDYzMCA3MTIsNzE3IDQ4OSw3MTdDNDU4LDcxNyA0MTksNzE0IDM3Myw3MDhDMzI3LDcwMSAyODcsNjk0IDI1Miw2ODZsLTEwNSw2Mmw1Niw3MTRsNzYwLDBsMCwtMjA5bC01NTMsMGwtMzMsLTM2MkM0MDAsODk1IDQyOSw5MDAgNDYzLDkwNUM0OTYsOTEwIDUzNyw5MTMgNTg2LDkxM3pcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI2XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTk0LDYyM0M5NCwxMTk1IDMyNywxNDgxIDc5MywxNDgxQzg2NiwxNDgxIDkyOCwxNDc1IDk3OSwxNDY0bDAsLTE5NkM5MjgsMTI4MyA4NzAsMTI5MCA4MDMsMTI5MEM2NDYsMTI5MCA1MjksMTI0OCA0NTAsMTE2NEMzNzEsMTA4MCAzMjksOTQ1IDMyMiw3NjBsMTIsMEMzNjUsODE0IDQwOSw4NTYgNDY2LDg4NkM1MjMsOTE1IDU4OSw5MzAgNjY2LDkzMEM3OTksOTMwIDkwMiw4ODkgOTc2LDgwOEMxMDUwLDcyNyAxMDg3LDYxNiAxMDg3LDQ3N0MxMDg3LDMyNCAxMDQ0LDIwMyA5NTksMTE0Qzg3MywyNSA3NTYsLTIwIDYwOCwtMjBDNTAzLC0yMCA0MTIsNSAzMzUsNTZDMjU4LDEwNiAxOTgsMTc5IDE1NywyNzZDMTE1LDM3MiA5NCw0ODggOTQsNjIzTTYwNCwxNzRDNjg1LDE3NCA3NDcsMjAwIDc5MSwyNTJDODM0LDMwNCA4NTYsMzc4IDg1Niw0NzVDODU2LDU1OSA4MzYsNjI1IDc5NSw2NzNDNzU0LDcyMSA2OTIsNzQ1IDYxMCw3NDVDNTU5LDc0NSA1MTMsNzM0IDQ3MCw3MTNDNDI3LDY5MSAzOTQsNjYxIDM2OSw2MjRDMzQ0LDU4NiAzMzIsNTQ3IDMzMiw1MDhDMzMyLDQxNCAzNTgsMzM1IDQwOSwyNzFDNDYwLDIwNiA1MjUsMTc0IDYwNCwxNzR6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiN1xcXCIgaG9yaXotYWR2LXg9XFxcIjExNjlcXFwiIGQ9XFxcIk0yNTYsMGw1NzgsMTI1M2wtNzYwLDBsMCwyMDdsMTAxMSwwbDAsLTE2NGwtNTc1LC0xMjk2elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIjhcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNNTg0LDE0ODFDNzIzLDE0ODEgODMyLDE0NDkgOTEzLDEzODZDOTk0LDEzMjIgMTAzNCwxMjM3IDEwMzQsMTEzMEMxMDM0LDk4MCA5NDQsODYxIDc2NCw3NzJDODc5LDcxNSA5NjAsNjU0IDEwMDksNTkxQzEwNTcsNTI4IDEwODEsNDU3IDEwODEsMzc5QzEwODEsMjU4IDEwMzcsMTYyIDk0OCw4OUM4NTksMTYgNzM5LC0yMCA1ODgsLTIwQzQyOSwtMjAgMzA2LDE0IDIxOSw4MkMxMzIsMTUwIDg4LDI0NiA4OCwzNzFDODgsNDUyIDExMSw1MjYgMTU3LDU5MUMyMDIsNjU2IDI3Nyw3MTMgMzgxLDc2NEMyOTIsODE3IDIyOCw4NzQgMTkwLDkzM0MxNTIsOTkyIDEzMywxMDU5IDEzMywxMTMzQzEzMywxMjM5IDE3NSwxMzI0IDI1OCwxMzg3QzM0MSwxNDUwIDQ1MCwxNDgxIDU4NCwxNDgxTTMxMywzNzlDMzEzLDMxMCAzMzcsMjU2IDM4NiwyMThDNDM1LDE3OSA1MDEsMTYwIDU4NCwxNjBDNjcwLDE2MCA3MzcsMTgwIDc4NSwyMjBDODMyLDI1OSA4NTYsMzEzIDg1NiwzODFDODU2LDQzNSA4MzQsNDg0IDc5MCw1MjlDNzQ2LDU3NCA2NzksNjE1IDU5MCw2NTNsLTI5LDEzQzQ3Myw2MjcgNDEwLDU4NSAzNzEsNTM5QzMzMiw0OTIgMzEzLDQzOSAzMTMsMzc5TTU4MiwxMzAwQzUxNSwxMzAwIDQ2MiwxMjg0IDQyMSwxMjUxQzM4MCwxMjE4IDM2MCwxMTczIDM2MCwxMTE2QzM2MCwxMDgxIDM2NywxMDUwIDM4MiwxMDIzQzM5Nyw5OTYgNDE4LDk3MSA0NDYsOTQ5QzQ3NCw5MjYgNTIxLDg5OSA1ODgsODY4QzY2OCw5MDMgNzI1LDk0MSA3NTgsOTgwQzc5MSwxMDE5IDgwNywxMDY0IDgwNywxMTE2QzgwNywxMTczIDc4NywxMjE4IDc0NiwxMjUxQzcwNSwxMjg0IDY1MCwxMzAwIDU4MiwxMzAwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIjlcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNMTA3OSw4MzhDMTA3OSw1NTAgMTAyMSwzMzUgOTA1LDE5M0M3ODksNTEgNjE0LC0yMCAzODEsLTIwQzI5MiwtMjAgMjI5LC0xNSAxOTAsLTRsMCwxOTdDMjQ5LDE3NiAzMDksMTY4IDM2OSwxNjhDNTI4LDE2OCA2NDYsMjExIDcyNCwyOTZDODAyLDM4MSA4NDUsNTE1IDg1Miw2OThsLTEyLDBDODAxLDYzOCA3NTMsNTk1IDY5OCw1NjhDNjQyLDU0MSA1NzcsNTI4IDUwMiw1MjhDMzczLDUyOCAyNzEsNTY4IDE5Nyw2NDlDMTIzLDczMCA4Niw4NDAgODYsOTgxQzg2LDExMzQgMTI5LDEyNTUgMjE1LDEzNDZDMzAwLDE0MzYgNDE3LDE0ODEgNTY1LDE0ODFDNjY5LDE0ODEgNzYwLDE0NTYgODM3LDE0MDVDOTE0LDEzNTQgOTc0LDEyODEgMTAxNiwxMTg1QzEwNTgsMTA4OCAxMDc5LDk3MyAxMDc5LDgzOE01NjksMTI4NkM0ODgsMTI4NiA0MjUsMTI2MCAzODIsMTIwN0MzMzksMTE1NCAzMTcsMTA3OSAzMTcsOTgzQzMxNyw5MDAgMzM3LDgzNCAzNzgsNzg3QzQxOCw3MzkgNDc5LDcxNSA1NjEsNzE1QzY0MCw3MTUgNzA3LDczOSA3NjEsNzg2QzgxNSw4MzMgODQyLDg4OSA4NDIsOTUyQzg0MiwxMDExIDgzMSwxMDY3IDgwOCwxMTE5Qzc4NSwxMTcwIDc1MiwxMjExIDcxMSwxMjQxQzY3MCwxMjcxIDYyMiwxMjg2IDU2OSwxMjg2elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIjpcXFwiIGhvcml6LWFkdi14PVxcXCI1NjNcXFwiIGQ9XFxcIk0xMzMsMTI1QzEzMywxNzQgMTQ2LDIxMSAxNzEsMjM3QzE5NiwyNjMgMjMzLDI3NiAyODEsMjc2QzMzMCwyNzYgMzY3LDI2MyAzOTIsMjM2QzQxNywyMDkgNDMwLDE3MiA0MzAsMTI1QzQzMCw3OCA0MTcsNDAgMzkyLDEzQzM2NiwtMTUgMzI5LC0yOSAyODEsLTI5QzIzMywtMjkgMTk2LC0xNSAxNzEsMTJDMTQ2LDM5IDEzMyw3NyAxMzMsMTI1TTEzMyw5NzlDMTMzLDEwODAgMTgyLDExMzAgMjgxLDExMzBDMzMxLDExMzAgMzY4LDExMTcgMzkzLDEwOTBDNDE4LDEwNjMgNDMwLDEwMjYgNDMwLDk3OUM0MzAsOTMyIDQxNyw4OTQgMzkyLDg2N0MzNjYsODM5IDMyOSw4MjUgMjgxLDgyNUMyMzMsODI1IDE5Niw4MzkgMTcxLDg2NkMxNDYsODkzIDEzMyw5MzEgMTMzLDk3OXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI7XFxcIiBob3Jpei1hZHYteD1cXFwiNTY5XFxcIiBkPVxcXCJNMzk3LDIzOGwxNSwtMjNDMzgwLDkxIDMyMSwtNjkgMjM2LC0yNjRsLTE3MywwQzEwOSwtODQgMTQzLDgzIDE2NiwyMzhNMTMxLDk3OUMxMzEsMTA4MCAxODAsMTEzMCAyNzksMTEzMEMzMjksMTEzMCAzNjYsMTExNyAzOTEsMTA5MEM0MTYsMTA2MyA0MjgsMTAyNiA0MjgsOTc5QzQyOCw5MzIgNDE1LDg5NCAzOTAsODY3QzM2NCw4MzkgMzI3LDgyNSAyNzksODI1QzIzMSw4MjUgMTk0LDgzOSAxNjksODY2QzE0NCw4OTMgMTMxLDkzMSAxMzEsOTc5elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiZsdDtcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNMTA3MywyMjFsLTk3Nyw0MzBsMCwxMjFsOTc3LDQ4OGwwLC0xOTVsLTczMywtMzQ0bDczMywtMzAzelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIj1cXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNMTAyLDgzMWwwLDE3OWw5NjMsMGwwLC0xNzlNMTAyLDQzMmwwLDE3OGw5NjMsMGwwLC0xNzh6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJmd0O1xcXCIgaG9yaXotYWR2LXg9XFxcIjExNjlcXFwiIGQ9XFxcIk05Niw0MThsNzMzLDMwM2wtNzMzLDM0NGwwLDE5NWw5NzcsLTQ4OGwwLC0xMjFsLTk3NywtNDMwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIj9cXFwiIGhvcml6LWFkdi14PVxcXCI5MjhcXFwiIGQ9XFxcIk0yODMsNDQ0bDAsNjRDMjgzLDU4MSAyOTYsNjQyIDMyMyw2OTFDMzUwLDc0MCAzOTYsNzkwIDQ2Myw4NDJDNTQyLDkwNSA1OTQsOTUzIDYxNyw5ODhDNjQwLDEwMjMgNjUxLDEwNjQgNjUxLDExMTJDNjUxLDExNjggNjMyLDEyMTEgNTk1LDEyNDFDNTU4LDEyNzEgNTA0LDEyODYgNDM0LDEyODZDMzcxLDEyODYgMzEyLDEyNzcgMjU4LDEyNTlDMjA0LDEyNDEgMTUxLDEyMTkgMTAwLDExOTRsLTg0LDE3NkMxNTEsMTQ0NSAyOTYsMTQ4MyA0NTEsMTQ4M0M1ODIsMTQ4MyA2ODUsMTQ1MSA3NjIsMTM4N0M4MzksMTMyMyA4NzcsMTIzNSA4NzcsMTEyMkM4NzcsMTA3MiA4NzAsMTAyOCA4NTUsOTg5Qzg0MCw5NTAgODE4LDkxMiA3ODksODc3Qzc1OSw4NDIgNzA4LDc5NiA2MzUsNzM5QzU3Myw2OTAgNTMyLDY1MCA1MTEsNjE4QzQ5MCw1ODYgNDc5LDU0MyA0NzksNDg5bDAsLTQ1TTI0MiwxMjVDMjQyLDIyNiAyOTEsMjc2IDM4OSwyNzZDNDM3LDI3NiA0NzQsMjYzIDQ5OSwyMzdDNTI0LDIxMCA1MzcsMTczIDUzNywxMjVDNTM3LDc4IDUyNCw0MCA0OTksMTNDNDczLC0xNSA0MzYsLTI5IDM4OSwtMjlDMzQyLC0yOSAzMDUsLTE1IDI4MCwxMkMyNTUsMzkgMjQyLDc2IDI0MiwxMjV6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiQFxcXCIgaG9yaXotYWR2LXg9XFxcIjE4MzlcXFwiIGQ9XFxcIk0xNzI2LDczOUMxNzI2LDY0NCAxNzExLDU1NyAxNjgxLDQ3OEMxNjUxLDM5OSAxNjA5LDMzNyAxNTU1LDI5M0MxNTAwLDI0OSAxNDM3LDIyNyAxMzY2LDIyN0MxMzEzLDIyNyAxMjY4LDI0MSAxMjI5LDI2OUMxMTkwLDI5NyAxMTY0LDMzNSAxMTUxLDM4M2wtMTIsMEMxMTA2LDMzMSAxMDY2LDI5MiAxMDE4LDI2NkM5NzAsMjQwIDkxNiwyMjcgODU2LDIyN0M3NDcsMjI3IDY2MiwyNjIgNjAwLDMzMkM1MzcsNDAyIDUwNiw0OTcgNTA2LDYxNkM1MDYsNzUzIDU0Nyw4NjUgNjMwLDk1MUM3MTMsMTAzNiA4MjQsMTA3OSA5NjMsMTA3OUMxMDE0LDEwNzkgMTA3MCwxMDc1IDExMzIsMTA2NkMxMTkzLDEwNTcgMTI0OCwxMDQ0IDEyOTYsMTAyOGwtMjIsLTQ2NWwwLC0yNEMxMjc0LDQzMiAxMzA5LDM3OSAxMzc4LDM3OUMxNDMxLDM3OSAxNDczLDQxMyAxNTA0LDQ4MUMxNTM1LDU0OSAxNTUwLDYzNiAxNTUwLDc0MUMxNTUwLDg1NSAxNTI3LDk1NSAxNDgwLDEwNDJDMTQzMywxMTI4IDEzNjcsMTE5NCAxMjgxLDEyNDFDMTE5NSwxMjg4IDEwOTYsMTMxMSA5ODUsMTMxMUM4NDMsMTMxMSA3MjAsMTI4MiA2MTUsMTIyM0M1MTAsMTE2NCA0MjksMTA4MSAzNzQsOTcyQzMxOSw4NjMgMjkxLDczNiAyOTEsNTkyQzI5MSwzOTkgMzQzLDI1MCA0NDYsMTQ2QzU0OSw0MiA2OTgsLTEwIDg5MSwtMTBDMTAzOCwtMTAgMTE5MiwyMCAxMzUyLDgwbDAsLTE2NEMxMjEyLC0xNDEgMTA2MCwtMTcwIDg5NSwtMTcwQzY0OCwtMTcwIDQ1NiwtMTAzIDMxOCwzMEMxODAsMTYzIDExMSwzNDggMTExLDU4NkMxMTEsNzYwIDE0OCw5MTUgMjIzLDEwNTFDMjk4LDExODYgNDAxLDEyOTAgNTM0LDEzNjJDNjY2LDE0MzQgODE2LDE0NzAgOTgzLDE0NzBDMTEyOCwxNDcwIDEyNTcsMTQ0MCAxMzcwLDEzODBDMTQ4MywxMzIwIDE1NzAsMTIzNSAxNjMzLDExMjRDMTY5NSwxMDEzIDE3MjYsODg0IDE3MjYsNzM5TTY5OCw2MTJDNjk4LDQ1NyA3NTksMzc5IDg4MSwzNzlDMTAxMCwzNzkgMTA4MCw0NzcgMTA5Miw2NzJsMTIsMjM5QzEwNjIsOTIyIDEwMTcsOTI4IDk2OSw5MjhDODg0LDkyOCA4MTcsOTAwIDc3MCw4NDNDNzIyLDc4NiA2OTgsNzA5IDY5OCw2MTJ6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiQVxcXCIgaG9yaXotYWR2LXg9XFxcIjEzNTRcXFwiIGQ9XFxcIk0xMTAwLDBsLTE0Niw0MDZsLTU1OSwwbC0xNDMsLTQwNmwtMjUyLDBsNTQ3LDE0NjhsMjYwLDBsNTQ3LC0xNDY4TTg5MSw2MTJsLTEzNywzOThDNzQ0LDEwMzcgNzMwLDEwNzkgNzEzLDExMzZDNjk1LDExOTMgNjgzLDEyMzUgNjc2LDEyNjJDNjU4LDExODAgNjMyLDEwOTAgNTk3LDk5M2wtMTMyLC0zODF6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiQlxcXCIgaG9yaXotYWR2LXg9XFxcIjEzNTJcXFwiIGQ9XFxcIk0xOTMsMTQ2Mmw0MzQsMEM4MjgsMTQ2MiA5NzQsMTQzMyAxMDY0LDEzNzRDMTE1MywxMzE1IDExOTgsMTIyMyAxMTk4LDEwOTZDMTE5OCwxMDExIDExNzYsOTQwIDExMzIsODgzQzEwODgsODI2IDEwMjUsNzkxIDk0Miw3NzZsMCwtMTBDMTA0NSw3NDcgMTEyMCw3MDkgMTE2OSw2NTJDMTIxNyw1OTUgMTI0MSw1MTcgMTI0MSw0MjBDMTI0MSwyODkgMTE5NSwxODYgMTEwNCwxMTJDMTAxMiwzNyA4ODQsMCA3MjEsMGwtNTI4LDBNNDMyLDg1OGwyMzAsMEM3NjIsODU4IDgzNSw4NzQgODgxLDkwNkM5MjcsOTM3IDk1MCw5OTEgOTUwLDEwNjdDOTUwLDExMzYgOTI1LDExODUgODc2LDEyMTZDODI2LDEyNDcgNzQ3LDEyNjIgNjM5LDEyNjJsLTIwNywwTTQzMiw2NjRsMCwtNDYzbDI1NCwwQzc4NiwyMDEgODYyLDIyMCA5MTMsMjU5Qzk2NCwyOTcgOTg5LDM1NyA5ODksNDQwQzk4OSw1MTYgOTYzLDU3MiA5MTEsNjA5Qzg1OSw2NDYgNzgwLDY2NCA2NzQsNjY0elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIkNcXFwiIGhvcml6LWFkdi14PVxcXCIxMjk4XFxcIiBkPVxcXCJNODE1LDEyNzhDNjc4LDEyNzggNTcwLDEyMjkgNDkxLDExMzJDNDEyLDEwMzUgMzczLDkwMCAzNzMsNzI5QzM3Myw1NTAgNDExLDQxNCA0ODcsMzIyQzU2MiwyMzAgNjcyLDE4NCA4MTUsMTg0Qzg3NywxODQgOTM3LDE5MCA5OTUsMjAzQzEwNTMsMjE1IDExMTMsMjMxIDExNzYsMjUwbDAsLTIwNUMxMDYxLDIgOTMxLC0yMCA3ODYsLTIwQzU3MiwtMjAgNDA4LDQ1IDI5MywxNzVDMTc4LDMwNCAxMjEsNDkwIDEyMSw3MzFDMTIxLDg4MyAxNDksMTAxNiAyMDUsMTEzMEMyNjAsMTI0NCAzNDEsMTMzMSA0NDYsMTM5MkM1NTEsMTQ1MyA2NzUsMTQ4MyA4MTcsMTQ4M0M5NjYsMTQ4MyAxMTA0LDE0NTIgMTIzMSwxMzg5bC04NiwtMTk5QzEwOTYsMTIxMyAxMDQ0LDEyMzQgOTg5LDEyNTJDOTM0LDEyNjkgODc2LDEyNzggODE1LDEyNzh6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiRFxcXCIgaG9yaXotYWR2LXg9XFxcIjE1MDNcXFwiIGQ9XFxcIk0xMzgyLDc0NUMxMzgyLDUwNCAxMzE1LDMxOSAxMTgxLDE5MkMxMDQ3LDY0IDg1NCwwIDYwMiwwbC00MDksMGwwLDE0NjJsNDUyLDBDODc4LDE0NjIgMTA1OSwxMzk5IDExODgsMTI3NEMxMzE3LDExNDkgMTM4Miw5NzIgMTM4Miw3NDVNMTEzMCw3MzdDMTEzMCwxMDg3IDk2NiwxMjYyIDYzOSwxMjYybC0yMDcsMGwwLC0xMDYxbDE3MCwwQzk1NCwyMDEgMTEzMCwzODAgMTEzMCw3Mzd6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiRVxcXCIgaG9yaXotYWR2LXg9XFxcIjExNDNcXFwiIGQ9XFxcIk0xMDIwLDBsLTgyNywwbDAsMTQ2Mmw4MjcsMGwwLC0yMDJsLTU4OCwwbDAsLTM5OGw1NTEsMGwwLC0yMDBsLTU1MSwwbDAsLTQ1OWw1ODgsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJGXFxcIiBob3Jpei1hZHYteD1cXFwiMTA5MFxcXCIgZD1cXFwiTTQzMCwwbC0yMzcsMGwwLDE0NjJsODI1LDBsMCwtMjAybC01ODgsMGwwLC00NTdsNTUxLDBsMCwtMjAzbC01NTEsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJHXFxcIiBob3Jpei1hZHYteD1cXFwiMTQ4N1xcXCIgZD1cXFwiTTc5MSw3OTNsNTM4LDBsMCwtNzM0QzEyNDEsMzAgMTE1NywxMCAxMDc2LC0yQzk5NSwtMTQgOTA3LC0yMCA4MTMsLTIwQzU5MiwtMjAgNDIxLDQ2IDMwMSwxNzdDMTgxLDMwOCAxMjEsNDkyIDEyMSw3MzFDMTIxLDk2NiAxODksMTE1MSAzMjQsMTI4NEM0NTksMTQxNyA2NDYsMTQ4MyA4ODMsMTQ4M0MxMDM2LDE0ODMgMTE4MCwxNDU0IDEzMTcsMTM5NWwtODQsLTE5OUMxMTE0LDEyNTEgOTk2LDEyNzggODc3LDEyNzhDNzIxLDEyNzggNTk4LDEyMjkgNTA3LDExMzFDNDE2LDEwMzMgMzcxLDg5OSAzNzEsNzI5QzM3MSw1NTAgNDEyLDQxNSA0OTQsMzIyQzU3NSwyMjkgNjkzLDE4MiA4NDYsMTgyQzkyMywxODIgMTAwNiwxOTIgMTA5NCwyMTFsMCwzNzdsLTMwMywwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIkhcXFwiIGhvcml6LWFkdi14PVxcXCIxNTM4XFxcIiBkPVxcXCJNMTM0NiwwbC0yNDAsMGwwLDY1OWwtNjc0LDBsMCwtNjU5bC0yMzksMGwwLDE0NjJsMjM5LDBsMCwtNTk4bDY3NCwwbDAsNTk4bDI0MCwwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIkpcXFwiIGhvcml6LWFkdi14PVxcXCI2MTJcXFwiIGQ9XFxcIk04LC00MDhDLTU3LC00MDggLTExMiwtNDAwIC0xNTYsLTM4M2wwLDIwMUMtMTAwLC0xOTYgLTUxLC0yMDMgLTEwLC0yMDNDMTIxLC0yMDMgMTg2LC0xMjAgMTg2LDQ1bDAsMTQxN2wyNDAsMGwwLC0xNDA5QzQyNiwtOTYgMzkxLC0yMTAgMzIwLC0yODlDMjQ5LC0zNjggMTQ1LC00MDggOCwtNDA4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIktcXFwiIGhvcml6LWFkdi14PVxcXCIxMzA5XFxcIiBkPVxcXCJNMTMwOSwwbC0yNzcsMGwtNDU5LDY2MmwtMTQxLC0xMTVsMCwtNTQ3bC0yMzksMGwwLDE0NjJsMjM5LDBsMCwtNjk4QzQ5Nyw4NDQgNTYyLDkyMSA2MjcsOTk1bDM5NSw0NjdsMjcyLDBDMTAzOSwxMTYyIDg1Niw5NDggNzQ1LDgyMXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJMXFxcIiBob3Jpei1hZHYteD1cXFwiMTExMFxcXCIgZD1cXFwiTTE5MywwbDAsMTQ2MmwyMzksMGwwLC0xMjU3bDYxOSwwbDAsLTIwNXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJNXFxcIiBob3Jpei1hZHYteD1cXFwiMTg5MFxcXCIgZD1cXFwiTTgyNSwwbC00MjQsMTIyMWwtOCwwQzQwNCwxMDQwIDQxMCw4NzAgNDEwLDcxMWwwLC03MTFsLTIxNywwbDAsMTQ2MmwzMzcsMGw0MDYsLTExNjNsNiwwbDQxOCwxMTYzbDMzOCwwbDAsLTE0NjJsLTIzMCwwbDAsNzIzQzE0NjgsNzk2IDE0NzAsODkwIDE0NzQsMTAwN0MxNDc3LDExMjQgMTQ4MCwxMTk0IDE0ODMsMTIxOWwtOCwwbC00MzksLTEyMTl6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiTlxcXCIgaG9yaXotYWR2LXg9XFxcIjE2MDRcXFwiIGQ9XFxcIk0xNDExLDBsLTI5MywwbC03MTksMTE2NWwtOCwwbDUsLTY1QzQwNSw5NzYgNDEwLDg2MyA0MTAsNzYwbDAsLTc2MGwtMjE3LDBsMCwxNDYybDI5MCwwbDcxNywtMTE1OWw2LDBDMTIwNSwzMTggMTIwMiwzNzQgMTE5OCw0NzFDMTE5NCw1NjcgMTE5Miw2NDIgMTE5Miw2OTZsMCw3NjZsMjE5LDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiT1xcXCIgaG9yaXotYWR2LXg9XFxcIjE2MTJcXFwiIGQ9XFxcIk0xNDkxLDczM0MxNDkxLDQ5NSAxNDMyLDMxMCAxMzEzLDE3OEMxMTk0LDQ2IDEwMjUsLTIwIDgwNywtMjBDNTg2LC0yMCA0MTcsNDYgMjk5LDE3N0MxODAsMzA4IDEyMSw0OTQgMTIxLDczNUMxMjEsOTc2IDE4MSwxMTYyIDMwMCwxMjkxQzQxOSwxNDIwIDU4OCwxNDg1IDgwOSwxNDg1QzEwMjYsMTQ4NSAxMTk0LDE0MTkgMTMxMywxMjg4QzE0MzIsMTE1NyAxNDkxLDk3MiAxNDkxLDczM00zNzUsNzMzQzM3NSw1NTMgNDExLDQxNyA0ODQsMzI0QzU1NywyMzEgNjY0LDE4NCA4MDcsMTg0Qzk0OSwxODQgMTA1NiwyMzAgMTEyOSwzMjJDMTIwMSw0MTQgMTIzNyw1NTEgMTIzNyw3MzNDMTIzNyw5MTIgMTIwMSwxMDQ4IDExMzAsMTE0MUMxMDU4LDEyMzQgOTUxLDEyODAgODA5LDEyODBDNjY2LDEyODAgNTU4LDEyMzQgNDg1LDExNDFDNDEyLDEwNDggMzc1LDkxMiAzNzUsNzMzelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIlBcXFwiIGhvcml6LWFkdi14PVxcXCIxMjYwXFxcIiBkPVxcXCJNMTE2MSwxMDIwQzExNjEsODY3IDExMTEsNzUwIDEwMTEsNjY5QzkxMSw1ODggNzY5LDU0NyA1ODQsNTQ3bC0xNTIsMGwwLC01NDdsLTIzOSwwbDAsMTQ2Mmw0MjEsMEM3OTcsMTQ2MiA5MzQsMTQyNSAxMDI1LDEzNTBDMTExNiwxMjc1IDExNjEsMTE2NSAxMTYxLDEwMjBNNDMyLDc0OGwxMjcsMEM2ODIsNzQ4IDc3Miw3NjkgODI5LDgxMkM4ODYsODU1IDkxNSw5MjEgOTE1LDEwMTJDOTE1LDEwOTYgODg5LDExNTkgODM4LDEyMDBDNzg3LDEyNDEgNzA3LDEyNjIgNTk4LDEyNjJsLTE2NiwwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIlFcXFwiIGhvcml6LWFkdi14PVxcXCIxNjEyXFxcIiBkPVxcXCJNMTQ5MSw3MzNDMTQ5MSw1NTYgMTQ1Nyw0MDYgMTM5MCwyODVDMTMyMiwxNjQgMTIyMyw3OCAxMDk0LDI5bDM1MCwtMzc3bC0zMjIsMGwtMjc2LDMyOGwtMzksMEM1ODYsLTIwIDQxNyw0NiAyOTksMTc3QzE4MCwzMDggMTIxLDQ5NCAxMjEsNzM1QzEyMSw5NzYgMTgxLDExNjIgMzAwLDEyOTFDNDE5LDE0MjAgNTg4LDE0ODUgODA5LDE0ODVDMTAyNiwxNDg1IDExOTQsMTQxOSAxMzEzLDEyODhDMTQzMiwxMTU3IDE0OTEsOTcyIDE0OTEsNzMzTTM3NSw3MzNDMzc1LDU1MyA0MTEsNDE3IDQ4NCwzMjRDNTU3LDIzMSA2NjQsMTg0IDgwNywxODRDOTQ5LDE4NCAxMDU2LDIzMCAxMTI5LDMyMkMxMjAxLDQxNCAxMjM3LDU1MSAxMjM3LDczM0MxMjM3LDkxMiAxMjAxLDEwNDggMTEzMCwxMTQxQzEwNTgsMTIzNCA5NTEsMTI4MCA4MDksMTI4MEM2NjYsMTI4MCA1NTgsMTIzNCA0ODUsMTE0MUM0MTIsMTA0OCAzNzUsOTEyIDM3NSw3MzN6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiUlxcXCIgaG9yaXotYWR2LXg9XFxcIjEzMDlcXFwiIGQ9XFxcIk00MzIsNzgybDE2NiwwQzcwOSw3ODIgNzkwLDgwMyA4NDAsODQ0Qzg5MCw4ODUgOTE1LDk0NyA5MTUsMTAyOEM5MTUsMTExMSA4ODgsMTE3MCA4MzQsMTIwNkM3ODAsMTI0MiA2OTksMTI2MCA1OTAsMTI2MGwtMTU4LDBNNDMyLDU4NGwwLC01ODRsLTIzOSwwbDAsMTQ2Mmw0MTMsMEM3OTUsMTQ2MiA5MzQsMTQyNyAxMDI1LDEzNTZDMTExNiwxMjg1IDExNjEsMTE3OSAxMTYxLDEwMzZDMTE2MSw4NTQgMTA2Niw3MjQgODc3LDY0N2w0MTMsLTY0N2wtMjcyLDBsLTM1MCw1ODR6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiU1xcXCIgaG9yaXotYWR2LXg9XFxcIjExMjZcXFwiIGQ9XFxcIk0xMDM2LDM5N0MxMDM2LDI2NyA5ODksMTY1IDg5NSw5MUM4MDEsMTcgNjcxLC0yMCA1MDYsLTIwQzM0MSwtMjAgMjA1LDYgMTAwLDU3bDAsMjI2QzE2NywyNTIgMjM4LDIyNyAzMTMsMjA5QzM4OCwxOTEgNDU3LDE4MiA1MjIsMTgyQzYxNywxODIgNjg3LDIwMCA3MzIsMjM2Qzc3NywyNzIgNzk5LDMyMCA3OTksMzgxQzc5OSw0MzYgNzc4LDQ4MiA3MzcsNTIwQzY5Niw1NTggNjEwLDYwMyA0ODEsNjU1QzM0OCw3MDkgMjU0LDc3MSAxOTksODQwQzE0NCw5MDkgMTE3LDk5MyAxMTcsMTA5MEMxMTcsMTIxMiAxNjAsMTMwOCAyNDcsMTM3OEMzMzQsMTQ0OCA0NTAsMTQ4MyA1OTYsMTQ4M0M3MzYsMTQ4MyA4NzUsMTQ1MiAxMDE0LDEzOTFsLTc2LC0xOTVDODA4LDEyNTEgNjkyLDEyNzggNTkwLDEyNzhDNTEzLDEyNzggNDU0LDEyNjEgNDE0LDEyMjhDMzc0LDExOTQgMzU0LDExNDkgMzU0LDEwOTRDMzU0LDEwNTYgMzYyLDEwMjQgMzc4LDk5N0MzOTQsOTcwIDQyMCw5NDQgNDU3LDkyMEM0OTQsODk2IDU2MCw4NjQgNjU1LDgyNUM3NjIsNzgwIDg0MSw3MzkgODkxLDcwMEM5NDEsNjYxIDk3OCw2MTggMTAwMSw1NjlDMTAyNCw1MjAgMTAzNiw0NjMgMTAzNiwzOTd6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiVFxcXCIgaG9yaXotYWR2LXg9XFxcIjExNTlcXFwiIGQ9XFxcIk02OTgsMGwtMjM5LDBsMCwxMjU3bC00MzAsMGwwLDIwNWwxMDk5LDBsMCwtMjA1bC00MzAsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJVXFxcIiBob3Jpei1hZHYteD1cXFwiMTUyMFxcXCIgZD1cXFwiTTEzMzksMTQ2MmwwLC05NDZDMTMzOSw0MDggMTMxNiwzMTQgMTI3MCwyMzNDMTIyMywxNTIgMTE1Niw4OSAxMDY5LDQ2Qzk4MSwyIDg3NiwtMjAgNzU0LC0yMEM1NzMsLTIwIDQzMiwyOCAzMzEsMTI0QzIzMCwyMjAgMTgwLDM1MiAxODAsNTIwbDAsOTQybDI0MCwwbDAsLTkyNUM0MjAsNDE2IDQ0OCwzMjcgNTA0LDI3MEM1NjAsMjEzIDY0NiwxODQgNzYyLDE4NEM5ODcsMTg0IDExMDAsMzAyIDExMDAsNTM5bDAsOTIzelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIlZcXFwiIGhvcml6LWFkdi14PVxcXCIxMjc0XFxcIiBkPVxcXCJNMTAyNiwxNDYybDI0OCwwbC01MTIsLTE0NjJsLTI1MiwwbC01MTAsMTQ2MmwyNDYsMGwzMDUsLTkwOUM1NjcsNTEwIDU4NCw0NTQgNjAyLDM4NkM2MjAsMzE3IDYzMiwyNjYgNjM3LDIzM0M2NDYsMjg0IDY1OSwzNDIgNjc3LDQwOUM2OTUsNDc2IDcxMCw1MjUgNzIxLDU1N3pcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJXXFxcIiBob3Jpei1hZHYteD1cXFwiMTkzN1xcXCIgZD1cXFwiTTE1NDIsMGwtMjYwLDBsLTI0OCw4NzJDMTAyMyw5MTAgMTAxMCw5NjUgOTk0LDEwMzdDOTc4LDExMDggOTY4LDExNTggOTY1LDExODZDOTU4LDExNDMgOTQ4LDEwODggOTMzLDEwMjBDOTE4LDk1MiA5MDUsOTAxIDg5NSw4NjhsLTI0MiwtODY4bC0yNjAsMGwtMTg5LDczMmwtMTkyLDczMGwyNDQsMGwyMDksLTg1MkM0OTgsNDczIDUyMSwzNTMgNTM1LDI0OEM1NDIsMzA1IDU1MywzNjggNTY4LDQzOEM1ODMsNTA4IDU5Niw1NjUgNjA4LDYwOGwyMzgsODU0bDIzNywwbDI0NCwtODU4QzEzNTAsNTI1IDEzNzUsNDA2IDE0MDEsMjQ4QzE0MTEsMzQzIDE0MzUsNDY1IDE0NzMsNjEybDIwOCw4NTBsMjQyLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiWFxcXCIgaG9yaXotYWR2LXg9XFxcIjEyNzRcXFwiIGQ9XFxcIk0xMjcwLDBsLTI3NSwwbC0zNjYsNTk4bC0zNjksLTU5OGwtMjU2LDBsNDg1LDc1OGwtNDU0LDcwNGwyNjYsMGwzMzgsLTU1M2wzMzgsNTUzbDI1OCwwbC00NTcsLTcwOHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJZXFxcIiBob3Jpei1hZHYteD1cXFwiMTIxMlxcXCIgZD1cXFwiTTYwNiw3OTVsMzQ2LDY2N2wyNjAsMGwtNDg3LC04OTVsMCwtNTY3bC0yNDAsMGwwLDU1OWwtNDg1LDkwM2wyNjAsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJaXFxcIiBob3Jpei1hZHYteD1cXFwiMTE3OFxcXCIgZD1cXFwiTTExMTIsMGwtMTA0NiwwbDAsMTY2bDczNywxMDkxbC03MTcsMGwwLDIwNWwxMDA2LDBsMCwtMTY4bC03NDAsLTEwODlsNzYwLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiXFxcXFxcXCIgaG9yaXotYWR2LXg9XFxcIjc5OVxcXCIgZD1cXFwiTTIzOCwxNDYybDU0NCwtMTQ2MmwtMjIxLDBsLTU0NSwxNDYyelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIl5cXFwiIGhvcml6LWFkdi14PVxcXCIxMTAwXFxcIiBkPVxcXCJNMjksNTM1bDQzNiw5MzVsMTIxLDBsNDg1LC05MzVsLTE5NCwwbC0zNDksNjk0bC0zMDcsLTY5NHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJfXFxcIiBob3Jpei1hZHYteD1cXFwiODc5XFxcIiBkPVxcXCJNODgzLC0zMTlsLTg4NywwbDAsMTM1bDg4NywwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImFcXFwiIGhvcml6LWFkdi14PVxcXCIxMTg4XFxcIiBkPVxcXCJNODYwLDBsLTQ3LDE1NGwtOCwwQzc1Miw4NyA2OTgsNDEgNjQ0LDE3QzU5MCwtOCA1MjEsLTIwIDQzNiwtMjBDMzI3LC0yMCAyNDMsOSAxODIsNjhDMTIxLDEyNyA5MCwyMTAgOTAsMzE3QzkwLDQzMSAxMzIsNTE3IDIxNyw1NzVDMzAyLDYzMyA0MzEsNjY1IDYwNCw2NzBsMTkxLDZsMCw1OUM3OTUsODA2IDc3OSw4NTkgNzQ2LDg5NEM3MTMsOTI5IDY2MSw5NDYgNTkyLDk0NkM1MzUsOTQ2IDQ4MSw5MzggNDI5LDkyMUMzNzcsOTA0IDMyNyw4ODUgMjc5LDg2MmwtNzYsMTY4QzI2MywxMDYxIDMyOSwxMDg1IDQwMCwxMTAyQzQ3MSwxMTE4IDUzOSwxMTI2IDYwMiwxMTI2Qzc0MywxMTI2IDg0OSwxMDk1IDkyMSwxMDM0Qzk5Miw5NzMgMTAyOCw4NzYgMTAyOCw3NDVsMCwtNzQ1TTUxMCwxNjBDNTk1LDE2MCA2NjQsMTg0IDcxNiwyMzJDNzY3LDI3OSA3OTMsMzQ2IDc5Myw0MzJsMCw5NmwtMTQyLC02QzU0MCw1MTggNDYwLDUwMCA0MTAsNDY3QzM1OSw0MzQgMzM0LDM4MyAzMzQsMzE1QzMzNCwyNjYgMzQ5LDIyOCAzNzgsMjAxQzQwNywxNzQgNDUxLDE2MCA1MTAsMTYwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImJcXFwiIGhvcml6LWFkdi14PVxcXCIxMjc2XFxcIiBkPVxcXCJNNzMzLDExMjZDODcxLDExMjYgOTc5LDEwNzYgMTA1Niw5NzZDMTEzMyw4NzYgMTE3MSw3MzYgMTE3MSw1NTVDMTE3MSwzNzQgMTEzMiwyMzMgMTA1NCwxMzJDOTc2LDMxIDg2OCwtMjAgNzI5LC0yMEM1ODksLTIwIDQ4MCwzMCA0MDMsMTMxbC0xNiwwbC00MywtMTMxbC0xNzYsMGwwLDE1NTZsMjM1LDBsMCwtMzcwQzQwMywxMTU5IDQwMiwxMTE4IDM5OSwxMDY0QzM5NiwxMDEwIDM5NCw5NzYgMzkzLDk2MWwxMCwwQzQ3OCwxMDcxIDU4OCwxMTI2IDczMywxMTI2TTY3Miw5MzRDNTc3LDkzNCA1MDksOTA2IDQ2OCw4NTFDNDI2LDc5NSA0MDQsNzAyIDQwMyw1NzFsMCwtMTZDNDAzLDQyMCA0MjQsMzIzIDQ2NywyNjNDNTEwLDIwMiA1NzksMTcyIDY3NiwxNzJDNzU5LDE3MiA4MjMsMjA1IDg2NiwyNzFDOTA5LDMzNyA5MzAsNDMyIDkzMCw1NTdDOTMwLDgwOCA4NDQsOTM0IDY3Miw5MzR6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiY1xcXCIgaG9yaXotYWR2LXg9XFxcIjEwMTRcXFwiIGQ9XFxcIk02MTQsLTIwQzQ0NywtMjAgMzIwLDI5IDIzMywxMjdDMTQ2LDIyNCAxMDIsMzY0IDEwMiw1NDdDMTAyLDczMyAxNDgsODc2IDIzOSw5NzZDMzMwLDEwNzYgNDYxLDExMjYgNjMzLDExMjZDNzUwLDExMjYgODU1LDExMDQgOTQ4LDEwNjFsLTcxLC0xODlDNzc4LDkxMSA2OTYsOTMwIDYzMSw5MzBDNDQwLDkzMCAzNDQsODAzIDM0NCw1NDlDMzQ0LDQyNSAzNjgsMzMyIDQxNiwyNzBDNDYzLDIwNyA1MzMsMTc2IDYyNSwxNzZDNzMwLDE3NiA4MjksMjAyIDkyMiwyNTRsMCwtMjA1Qzg4MCwyNCA4MzUsNyA3ODgsLTRDNzQwLC0xNSA2ODIsLTIwIDYxNCwtMjB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiZFxcXCIgaG9yaXotYWR2LXg9XFxcIjEyNzZcXFwiIGQ9XFxcIk01NDEsLTIwQzQwMywtMjAgMjk1LDMwIDIxOCwxMzBDMTQxLDIzMCAxMDIsMzcwIDEwMiw1NTFDMTAyLDczMiAxNDEsODc0IDIyMCw5NzVDMjk4LDEwNzYgNDA2LDExMjYgNTQ1LDExMjZDNjkwLDExMjYgODAxLDEwNzIgODc3LDk2NWwxMiwwQzg3OCwxMDQ0IDg3MiwxMTA3IDg3MiwxMTUzbDAsNDAzbDIzNiwwbDAsLTE1NTZsLTE4NCwwbC00MSwxNDVsLTExLDBDNzk3LDM1IDY4NiwtMjAgNTQxLC0yME02MDQsMTcwQzcwMSwxNzAgNzcxLDE5NyA4MTUsMjUyQzg1OSwzMDYgODgyLDM5NCA4ODMsNTE2bDAsMzNDODgzLDY4OCA4NjAsNzg3IDgxNSw4NDZDNzcwLDkwNSA2OTksOTM0IDYwMiw5MzRDNTE5LDkzNCA0NTYsOTAxIDQxMSw4MzRDMzY2LDc2NyAzNDQsNjcxIDM0NCw1NDdDMzQ0LDQyNCAzNjYsMzMxIDQwOSwyNjdDNDUyLDIwMiA1MTcsMTcwIDYwNCwxNzB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiZVxcXCIgaG9yaXotYWR2LXg9XFxcIjExODBcXFwiIGQ9XFxcIk02NTEsLTIwQzQ3OSwtMjAgMzQ1LDMwIDI0OCwxMzFDMTUxLDIzMSAxMDIsMzY5IDEwMiw1NDVDMTAyLDcyNiAxNDcsODY4IDIzNyw5NzFDMzI3LDEwNzQgNDUxLDExMjYgNjA4LDExMjZDNzU0LDExMjYgODY5LDEwODIgOTU0LDk5M0MxMDM5LDkwNCAxMDgxLDc4MiAxMDgxLDYyN2wwLC0xMjdsLTczNywwQzM0NywzOTMgMzc2LDMxMCA0MzEsMjUzQzQ4NiwxOTUgNTYzLDE2NiA2NjIsMTY2QzcyNywxNjYgNzg4LDE3MiA4NDUsMTg1QzkwMSwxOTcgOTYxLDIxNyAxMDI2LDI0NmwwLC0xOTFDOTY5LDI4IDkxMSw4IDg1MiwtM0M3OTMsLTE0IDcyNiwtMjAgNjUxLC0yME02MDgsOTQ4QzUzMyw5NDggNDc0LDkyNCA0MjksODc3QzM4NCw4MzAgMzU3LDc2MSAzNDgsNjcwbDUwMiwwQzg0OSw3NjEgODI3LDgzMSA3ODQsODc4Qzc0MSw5MjUgNjgzLDk0OCA2MDgsOTQ4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImZcXFwiIGhvcml6LWFkdi14PVxcXCI3NDNcXFwiIGQ9XFxcIk03MjMsOTI4bC0yNzAsMGwwLC05MjhsLTIzNiwwbDAsOTI4bC0xODIsMGwwLDExMGwxODIsNzJsMCw3MkMyMTcsMTMxMyAyNDgsMTQxMCAzMDksMTQ3M0MzNzAsMTUzNiA0NjQsMTU2NyA1OTAsMTU2N0M2NzMsMTU2NyA3NTQsMTU1MyA4MzQsMTUyNmwtNjIsLTE3OEM3MTQsMTM2NyA2NTksMTM3NiA2MDYsMTM3NkM1NTMsMTM3NiA1MTQsMTM2MCA0OTAsMTMyN0M0NjUsMTI5NCA0NTMsMTI0NCA0NTMsMTE3OGwwLC03MmwyNzAsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJnXFxcIiBob3Jpei1hZHYteD1cXFwiMTEzOVxcXCIgZD1cXFwiTTExMDIsMTEwNmwwLC0xMjlsLTE4OSwtMzVDOTMwLDkxOSA5NDUsODkwIDk1Niw4NTZDOTY3LDgyMiA5NzMsNzg2IDk3Myw3NDhDOTczLDYzNCA5MzQsNTQ0IDg1NSw0NzlDNzc2LDQxNCA2NjgsMzgxIDUzMCwzODFDNDk1LDM4MSA0NjMsMzg0IDQzNCwzODlDMzgzLDM1OCAzNTgsMzIxIDM1OCwyNzlDMzU4LDI1NCAzNzAsMjM1IDM5NCwyMjJDNDE3LDIwOSA0NjEsMjAzIDUyNCwyMDNsMTkzLDBDODM5LDIwMyA5MzIsMTc3IDk5NSwxMjVDMTA1OCw3MyAxMDkwLC0yIDEwOTAsLTEwMEMxMDkwLC0yMjUgMTAzOCwtMzIyIDkzNSwtMzkwQzgzMiwtNDU4IDY4MiwtNDkyIDQ4NywtNDkyQzMzNiwtNDkyIDIyMSwtNDY1IDE0MiwtNDEyQzYzLC0zNTkgMjMsLTI4MyAyMywtMTg0QzIzLC0xMTYgNDUsLTU5IDg4LC0xMkMxMzEsMzQgMTkxLDY2IDI2OCw4NEMyMzcsOTcgMjExLDExOSAxOTEsMTQ5QzE3MCwxNzggMTYwLDIwOSAxNjAsMjQyQzE2MCwyODMgMTcyLDMxOCAxOTUsMzQ3QzIxOCwzNzYgMjUzLDQwNCAyOTksNDMyQzI0Miw0NTcgMTk1LDQ5NyAxNjAsNTUzQzEyNCw2MDggMTA2LDY3MyAxMDYsNzQ4QzEwNiw4NjggMTQ0LDk2MSAyMjAsMTAyN0MyOTUsMTA5MyA0MDMsMTEyNiA1NDMsMTEyNkM1NzQsMTEyNiA2MDcsMTEyNCA2NDIsMTEyMEM2NzYsMTExNSA3MDIsMTExMSA3MTksMTEwNk0yMzMsLTE3MkMyMzMsLTIyMyAyNTYsLTI2MiAzMDIsLTI4OUMzNDcsLTMxNiA0MTEsLTMzMCA0OTQsLTMzMEM2MjIsLTMzMCA3MTcsLTMxMiA3ODAsLTI3NUM4NDMsLTIzOCA4NzQsLTE5MCA4NzQsLTEyOUM4NzQsLTgxIDg1NywtNDcgODIzLC0yNkM3ODgsLTYgNzI0LDQgNjMxLDRsLTE3OCwwQzM4Niw0IDMzMiwtMTIgMjkzLC00M0MyNTMsLTc1IDIzMywtMTE4IDIzMywtMTcyTTMzNCw3NDhDMzM0LDY3OSAzNTIsNjI1IDM4OCw1ODhDNDIzLDU1MSA0NzQsNTMyIDU0MSw1MzJDNjc3LDUzMiA3NDUsNjA1IDc0NSw3NTBDNzQ1LDgyMiA3MjgsODc4IDY5NSw5MTdDNjYxLDk1NiA2MTAsOTc1IDU0MSw5NzVDNDczLDk3NSA0MjIsOTU2IDM4Nyw5MTdDMzUyLDg3OCAzMzQsODIyIDMzNCw3NDh6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiaFxcXCIgaG9yaXotYWR2LXg9XFxcIjEzMDBcXFwiIGQ9XFxcIk0xMTQxLDBsLTIzNiwwbDAsNjgwQzkwNSw3NjUgODg4LDgyOSA4NTQsODcxQzgxOSw5MTMgNzY1LDkzNCA2OTAsOTM0QzU5MSw5MzQgNTE5LDkwNSA0NzMsODQ2QzQyNiw3ODcgNDAzLDY4OCA0MDMsNTQ5bDAsLTU0OWwtMjM1LDBsMCwxNTU2bDIzNSwwbDAsLTM5NUM0MDMsMTA5OCAzOTksMTAzMCAzOTEsOTU4bDE1LDBDNDM4LDEwMTEgNDgzLDEwNTMgNTQwLDEwODJDNTk3LDExMTEgNjYzLDExMjYgNzM5LDExMjZDMTAwNywxMTI2IDExNDEsOTkxIDExNDEsNzIxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImlcXFwiIGhvcml6LWFkdi14PVxcXCI1NzFcXFwiIGQ9XFxcIk00MDMsMGwtMjM1LDBsMCwxMTA2bDIzNSwwTTE1NCwxMzk5QzE1NCwxNDQxIDE2NiwxNDczIDE4OSwxNDk2QzIxMiwxNTE5IDI0NCwxNTMwIDI4NywxNTMwQzMyOCwxNTMwIDM2MSwxNTE5IDM4NCwxNDk2QzQwNywxNDczIDQxOCwxNDQxIDQxOCwxMzk5QzQxOCwxMzU5IDQwNywxMzI4IDM4NCwxMzA1QzM2MSwxMjgyIDMyOCwxMjcwIDI4NywxMjcwQzI0NCwxMjcwIDIxMiwxMjgyIDE4OSwxMzA1QzE2NiwxMzI4IDE1NCwxMzU5IDE1NCwxMzk5elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImpcXFwiIGhvcml6LWFkdi14PVxcXCI1NzFcXFwiIGQ9XFxcIk01NSwtNDkyQy0xNiwtNDkyIC03NCwtNDg0IC0xMjEsLTQ2N2wwLDE4NkMtNzYsLTI5MyAtMjksLTI5OSAxOCwtMjk5QzExOCwtMjk5IDE2OCwtMjQyIDE2OCwtMTI5bDAsMTIzNWwyMzUsMGwwLC0xMjUxQzQwMywtMjU5IDM3MywtMzQ1IDMxNCwtNDA0QzI1NCwtNDYzIDE2OCwtNDkyIDU1LC00OTJNMTU0LDEzOTlDMTU0LDE0NDEgMTY2LDE0NzMgMTg5LDE0OTZDMjEyLDE1MTkgMjQ0LDE1MzAgMjg3LDE1MzBDMzI4LDE1MzAgMzYxLDE1MTkgMzg0LDE0OTZDNDA3LDE0NzMgNDE4LDE0NDEgNDE4LDEzOTlDNDE4LDEzNTkgNDA3LDEzMjggMzg0LDEzMDVDMzYxLDEyODIgMzI4LDEyNzAgMjg3LDEyNzBDMjQ0LDEyNzAgMjEyLDEyODIgMTg5LDEzMDVDMTY2LDEzMjggMTU0LDEzNTkgMTU0LDEzOTl6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwia1xcXCIgaG9yaXotYWR2LXg9XFxcIjExNzFcXFwiIGQ9XFxcIk0zOTUsNTg0bDEzMywxNjZsMzM0LDM1NmwyNzEsMGwtNDQ1LC00NzVsNDczLC02MzFsLTI3NiwwbC0zNTUsNDg1bC0xMjksLTEwNmwwLC0zNzlsLTIzMywwbDAsMTU1NmwyMzMsMGwwLC03NTlsLTEyLC0yMTN6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwibFxcXCIgaG9yaXotYWR2LXg9XFxcIjU3MVxcXCIgZD1cXFwiTTQwMywwbC0yMzUsMGwwLDE1NTZsMjM1LDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwibVxcXCIgaG9yaXotYWR2LXg9XFxcIjE5NThcXFwiIGQ9XFxcIk0xMTAwLDBsLTIzNiwwbDAsNjgyQzg2NCw3NjcgODQ4LDgzMCA4MTYsODcyQzc4NCw5MTMgNzM0LDkzNCA2NjYsOTM0QzU3NSw5MzQgNTA5LDkwNSA0NjcsODQ2QzQyNCw3ODcgNDAzLDY4OCA0MDMsNTUxbDAsLTU1MWwtMjM1LDBsMCwxMTA2bDE4NCwwbDMzLC0xNDVsMTIsMEM0MjgsMTAxNCA0NzIsMTA1NCA1MzEsMTA4M0M1ODksMTExMiA2NTMsMTEyNiA3MjMsMTEyNkM4OTMsMTEyNiAxMDA2LDEwNjggMTA2MSw5NTJsMTYsMEMxMTEwLDEwMDcgMTE1NiwxMDQ5IDEyMTUsMTA4MEMxMjc0LDExMTEgMTM0MiwxMTI2IDE0MTksMTEyNkMxNTUxLDExMjYgMTY0NywxMDkzIDE3MDgsMTAyNkMxNzY4LDk1OSAxNzk4LDg1OCAxNzk4LDcyMWwwLC03MjFsLTIzNSwwbDAsNjgyQzE1NjMsNzY3IDE1NDcsODMwIDE1MTUsODcyQzE0ODIsOTEzIDE0MzIsOTM0IDEzNjQsOTM0QzEyNzMsOTM0IDEyMDYsOTA2IDExNjQsODQ5QzExMjEsNzkyIDExMDAsNzA0IDExMDAsNTg2elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIm5cXFwiIGhvcml6LWFkdi14PVxcXCIxMzAwXFxcIiBkPVxcXCJNMTE0MSwwbC0yMzYsMGwwLDY4MEM5MDUsNzY1IDg4OCw4MjkgODU0LDg3MUM4MTksOTEzIDc2NSw5MzQgNjkwLDkzNEM1OTEsOTM0IDUxOCw5MDUgNDcyLDg0NkM0MjYsNzg3IDQwMyw2ODkgNDAzLDU1MWwwLC01NTFsLTIzNSwwbDAsMTEwNmwxODQsMGwzMywtMTQ1bDEyLDBDNDMwLDEwMTQgNDc4LDEwNTQgNTM5LDEwODNDNjAwLDExMTIgNjY4LDExMjYgNzQzLDExMjZDMTAwOCwxMTI2IDExNDEsOTkxIDExNDEsNzIxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIm9cXFwiIGhvcml6LWFkdi14PVxcXCIxMjUxXFxcIiBkPVxcXCJNMTE0OSw1NTVDMTE0OSwzNzQgMTEwMywyMzMgMTAxMCwxMzJDOTE3LDMxIDc4OCwtMjAgNjIzLC0yMEM1MjAsLTIwIDQyOCwzIDM0OSw1MEMyNzAsOTcgMjA5LDE2NCAxNjYsMjUxQzEyMywzMzggMTAyLDQ0MCAxMDIsNTU1QzEwMiw3MzQgMTQ4LDg3NCAyNDAsOTc1QzMzMiwxMDc2IDQ2MiwxMTI2IDYyOSwxMTI2Qzc4OSwxMTI2IDkxNiwxMDc1IDEwMDksOTcyQzExMDIsODY5IDExNDksNzMwIDExNDksNTU1TTM0NCw1NTVDMzQ0LDMwMCA0MzgsMTcyIDYyNywxNzJDODE0LDE3MiA5MDcsMzAwIDkwNyw1NTVDOTA3LDgwOCA4MTMsOTM0IDYyNSw5MzRDNTI2LDkzNCA0NTUsOTAxIDQxMSw4MzZDMzY2LDc3MSAzNDQsNjc3IDM0NCw1NTV6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwicFxcXCIgaG9yaXotYWR2LXg9XFxcIjEyNzZcXFwiIGQ9XFxcIk03MjksLTIwQzU4OSwtMjAgNDgwLDMwIDQwMywxMzFsLTE0LDBDMzk4LDM4IDQwMywtMTkgNDAzLC0zOWwwLC00NTNsLTIzNSwwbDAsMTU5OGwxOTAsMEMzNjMsMTA4NSAzNzQsMTAzNiAzOTEsOTU4bDEyLDBDNDc2LDEwNzAgNTg2LDExMjYgNzMzLDExMjZDODcxLDExMjYgOTc5LDEwNzYgMTA1Niw5NzZDMTEzMyw4NzYgMTE3MSw3MzYgMTE3MSw1NTVDMTE3MSwzNzQgMTEzMiwyMzMgMTA1NCwxMzJDOTc1LDMxIDg2NywtMjAgNzI5LC0yME02NzIsOTM0QzU3OSw5MzQgNTExLDkwNyA0NjgsODUyQzQyNSw3OTcgNDAzLDcxMCA0MDMsNTkwbDAsLTM1QzQwMyw0MjAgNDI0LDMyMyA0NjcsMjYzQzUxMCwyMDIgNTc5LDE3MiA2NzYsMTcyQzc1NywxNzIgODIwLDIwNSA4NjQsMjcyQzkwOCwzMzkgOTMwLDQzNCA5MzAsNTU3QzkzMCw2ODEgOTA4LDc3NSA4NjUsODM5QzgyMSw5MDIgNzU3LDkzNCA2NzIsOTM0elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcInFcXFwiIGhvcml6LWFkdi14PVxcXCIxMjc2XFxcIiBkPVxcXCJNNjA2LDE2OEM3MDUsMTY4IDc3NiwxOTcgODE5LDI1NEM4NjIsMzExIDg4MywzOTcgODgzLDUxMmwwLDM3Qzg4Myw2ODYgODYxLDc4NCA4MTcsODQ0Qzc3Miw5MDQgNzAxLDkzNCA2MDIsOTM0QzUxOCw5MzQgNDU0LDkwMSA0MTAsODM0QzM2Niw3NjcgMzQ0LDY3MiAzNDQsNTQ3QzM0NCwyOTQgNDMxLDE2OCA2MDYsMTY4TTUzOSwtMjBDNDAyLC0yMCAyOTUsMzAgMjE4LDEzMUMxNDEsMjMxIDEwMiwzNzEgMTAyLDU1MUMxMDIsNzMxIDE0MSw4NzIgMjIwLDk3NEMyOTksMTA3NSA0MDcsMTEyNiA1NDUsMTEyNkM2MTQsMTEyNiA2NzcsMTExMyA3MzIsMTA4OEM3ODcsMTA2MiA4MzYsMTAyMCA4NzksOTYxbDgsMGwyNiwxNDVsMTk1LDBsMCwtMTU5OGwtMjM2LDBsMCw0NjlDODcyLDYgODczLDM3IDg3Niw3MEM4NzksMTAzIDg4MSwxMjggODgzLDE0NWwtMTMsMEM4MDEsMzUgNjkwLC0yMCA1MzksLTIwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcInJcXFwiIGhvcml6LWFkdi14PVxcXCI4ODNcXFwiIGQ9XFxcIk03MjksMTEyNkM3NzYsMTEyNiA4MTUsMTEyMyA4NDYsMTExNmwtMjMsLTIxOUM3OTAsOTA1IDc1NSw5MDkgNzE5LDkwOUM2MjUsOTA5IDU0OSw4NzggNDkxLDgxN0M0MzIsNzU2IDQwMyw2NzYgNDAzLDU3OGwwLC01NzhsLTIzNSwwbDAsMTEwNmwxODQsMGwzMSwtMTk1bDEyLDBDNDMyLDk3NyA0ODAsMTAyOSA1MzksMTA2OEM1OTgsMTEwNyA2NjEsMTEyNiA3MjksMTEyNnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJzXFxcIiBob3Jpei1hZHYteD1cXFwiOTk3XFxcIiBkPVxcXCJNOTExLDMxNUM5MTEsMjA3IDg3MiwxMjQgNzkzLDY3QzcxNCw5IDYwMiwtMjAgNDU1LC0yMEMzMDgsLTIwIDE4OSwyIDEwMCw0N2wwLDIwM0MyMzAsMTkwIDM1MSwxNjAgNDYzLDE2MEM2MDgsMTYwIDY4MCwyMDQgNjgwLDI5MUM2ODAsMzE5IDY3MiwzNDIgNjU2LDM2MUM2NDAsMzgwIDYxNCwzOTkgNTc3LDQxOUM1NDAsNDM5IDQ4OSw0NjIgNDI0LDQ4N0MyOTcsNTM2IDIxMSw1ODYgMTY2LDYzNUMxMjEsNjg0IDk4LDc0OCA5OCw4MjdDOTgsOTIyIDEzNiw5OTUgMjEzLDEwNDhDMjg5LDExMDAgMzkzLDExMjYgNTI0LDExMjZDNjU0LDExMjYgNzc3LDExMDAgODkzLDEwNDdsLTc2LC0xNzdDNjk4LDkxOSA1OTcsOTQ0IDUxNiw5NDRDMzkyLDk0NCAzMzAsOTA5IDMzMCw4MzhDMzMwLDgwMyAzNDYsNzc0IDM3OSw3NTBDNDExLDcyNiA0ODEsNjkzIDU5MCw2NTFDNjgxLDYxNiA3NDgsNTgzIDc4OSw1NTRDODMwLDUyNSA4NjEsNDkxIDg4MSw0NTNDOTAxLDQxNCA5MTEsMzY4IDkxMSwzMTV6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwidFxcXCIgaG9yaXotYWR2LXg9XFxcIjgwNVxcXCIgZD1cXFwiTTU4MCwxNzBDNjM3LDE3MCA2OTUsMTc5IDc1MiwxOTdsMCwtMTc3QzcyNiw5IDY5MywtMSA2NTIsLThDNjExLC0xNiA1NjgsLTIwIDUyNCwtMjBDMzAxLC0yMCAxOTAsOTcgMTkwLDMzMmwwLDU5NmwtMTUxLDBsMCwxMDRsMTYyLDg2bDgwLDIzNGwxNDUsMGwwLC0yNDZsMzE1LDBsMCwtMTc4bC0zMTUsMGwwLC01OTJDNDI2LDI3OSA0NDAsMjM4IDQ2OSwyMTFDNDk3LDE4NCA1MzQsMTcwIDU4MCwxNzB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwidVxcXCIgaG9yaXotYWR2LXg9XFxcIjEzMDBcXFwiIGQ9XFxcIk05NDgsMGwtMzMsMTQ1bC0xMiwwQzg3MCw5NCA4MjQsNTMgNzY0LDI0QzcwMywtNSA2MzQsLTIwIDU1NywtMjBDNDIzLC0yMCAzMjMsMTMgMjU3LDgwQzE5MSwxNDcgMTU4LDI0OCAxNTgsMzgzbDAsNzIzbDIzNywwbDAsLTY4MkMzOTUsMzM5IDQxMiwyNzYgNDQ3LDIzNEM0ODIsMTkxIDUzNiwxNzAgNjEwLDE3MEM3MDksMTcwIDc4MSwyMDAgODI4LDI1OUM4NzQsMzE4IDg5Nyw0MTYgODk3LDU1NWwwLDU1MWwyMzYsMGwwLC0xMTA2elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcInZcXFwiIGhvcml6LWFkdi14PVxcXCIxMDk2XFxcIiBkPVxcXCJNNDIwLDBsLTQyMCwxMTA2bDI0OCwwbDIyNSwtNjQzQzUxMiwzNTUgNTM1LDI2OCA1NDMsMjAxbDgsMEM1NTcsMjQ5IDU4MCwzMzYgNjIxLDQ2M2wyMjUsNjQzbDI1MCwwbC00MjIsLTExMDZ6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwid1xcXCIgaG9yaXotYWR2LXg9XFxcIjE2NzNcXFwiIGQ9XFxcIk0xMDc1LDBsLTE0Myw1MTZDOTE1LDU3MSA4ODMsNjk4IDgzOCw4OTdsLTksMEM3OTAsNzE3IDc2MCw1ODkgNzM3LDUxNGwtMTQ3LC01MTRsLTI2MCwwbC0zMTAsMTEwNmwyNDAsMGwxNDEsLTU0NUM0MzMsNDI2IDQ1NiwzMTEgNDY5LDIxNWw2LDBDNDgyLDI2NCA0OTIsMzIwIDUwNiwzODNDNTE5LDQ0NiA1MzEsNDkzIDU0MSw1MjRsMTY4LDU4MmwyNTgsMGwxNjMsLTU4MkMxMTQwLDQ5MSAxMTUzLDQ0MSAxMTY4LDM3NEMxMTgzLDMwNyAxMTkxLDI1NCAxMTk0LDIxN2w4LDBDMTIxMiwyOTkgMTIzNSw0MTQgMTI3Miw1NjFsMTQzLDU0NWwyMzYsMGwtMzEyLC0xMTA2elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcInhcXFwiIGhvcml6LWFkdi14PVxcXCIxMTI4XFxcIiBkPVxcXCJNNDE0LDU2NWwtMzcxLDU0MWwyNjgsMGwyNTIsLTM4N2wyNTQsMzg3bDI2NiwwbC0zNzIsLTU0MWwzOTEsLTU2NWwtMjY2LDBsLTI3Myw0MTRsLTI3MiwtNDE0bC0yNjYsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJ5XFxcIiBob3Jpei1hZHYteD1cXFwiMTA5OFxcXCIgZD1cXFwiTTAsMTEwNmwyNTYsMGwyMjUsLTYyN0M1MTUsMzkwIDUzOCwzMDYgNTQ5LDIyN2w4LDBDNTYzLDI2NCA1NzQsMzA4IDU5MCwzNjFDNjA2LDQxMyA2OTEsNjYxIDg0NCwxMTA2bDI1NCwwbC00NzMsLTEyNTNDNTM5LC0zNzcgMzk2LC00OTIgMTk1LC00OTJDMTQzLC00OTIgOTIsLTQ4NiA0MywtNDc1bDAsMTg2Qzc4LC0yOTcgMTE5LC0zMDEgMTY0LC0zMDFDMjc3LC0zMDEgMzU3LC0yMzUgNDAzLC0xMDRsNDEsMTA0elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcInpcXFwiIGhvcml6LWFkdi14PVxcXCI5NzlcXFwiIGQ9XFxcIk05MDcsMGwtODM5LDBsMCwxNDVsNTU5LDc4MWwtNTI1LDBsMCwxODBsNzg5LDBsMCwtMTY0bC01NDcsLTc2Mmw1NjMsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJ+XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTMzMCw2OTJDMjk3LDY5MiAyNjAsNjgyIDIxOSw2NjJDMTc4LDY0MiAxMzcsNjEyIDk2LDU3MWwwLDE5MUMxNjIsODM0IDI0NSw4NzAgMzQ2LDg3MEMzOTAsODcwIDQzMiw4NjYgNDcxLDg1N0M1MTAsODQ4IDU1OSw4MzIgNjE4LDgwN0M3MDUsNzcwIDc3OSw3NTIgODM4LDc1MkM4NzMsNzUyIDkxMSw3NjIgOTUzLDc4M0M5OTQsODA0IDEwMzQsODMzIDEwNzMsODcybDAsLTE5MEMxMDAzLDYwOCA5MjAsNTcxIDgyMyw1NzFDNzgwLDU3MSA3MzcsNTc2IDY5Niw1ODdDNjU0LDU5NyA2MDUsNjE0IDU0OSw2MzdDNDY0LDY3NCAzOTEsNjkyIDMzMCw2OTJ6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4QTA7XFxcIiBob3Jpei1hZHYteD1cXFwiNTMyXFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4QTM7XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTY5MCwxNDgxQzgxOSwxNDgxIDk0NCwxNDU0IDEwNjUsMTM5OWwtNzYsLTE4MkM4ODEsMTI2NCA3ODYsMTI4OCA3MDUsMTI4OEM1NjgsMTI4OCA1MDAsMTIxNSA1MDAsMTA2OWwwLC0yNDRsMzk3LDBsMCwtMTcybC0zOTcsMGwwLC0xODJDNTAwLDQxMCA0ODksMzU5IDQ2NywzMTZDNDQ1LDI3MyA0MDcsMjM3IDM1NCwyMDdsNzU2LDBsMCwtMjA3bC0xMDM4LDBsMCwxOTVDMTM3LDIxNSAxODYsMjQ3IDIxNywyOTFDMjQ4LDMzNSAyNjQsMzk0IDI2NCw0NjlsMCwxODRsLTE4OCwwbDAsMTcybDE4OCwwbDAsMjU2QzI2NCwxMjA2IDMwMiwxMzA0IDM3OCwxMzc1QzQ1MywxNDQ2IDU1NywxNDgxIDY5MCwxNDgxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeEE5O1xcXCIgaG9yaXotYWR2LXg9XFxcIjE3MDRcXFwiIGQ9XFxcIk04OTMsMTAzNEM4MTksMTAzNCA3NjIsMTAwNyA3MjIsOTU0QzY4Miw5MDAgNjYyLDgyNiA2NjIsNzMxQzY2Miw2MzMgNjgwLDU1OCA3MTYsNTA1Qzc1Miw0NTIgODExLDQyNiA4OTMsNDI2QzkzMCw0MjYgOTY5LDQzMSAxMDExLDQ0MUMxMDUzLDQ1MSAxMDg5LDQ2MyAxMTIwLDQ3N2wwLC0xNThDMTA0MywyODUgOTY1LDI2OCA4ODUsMjY4Qzc1NCwyNjggNjUyLDMwOCA1ODAsMzg5QzUwNyw0NjkgNDcxLDU4MyA0NzEsNzMxQzQ3MSw4NzQgNTA4LDk4NiA1ODEsMTA2OUM2NTQsMTE1MSA3NTYsMTE5MiA4ODcsMTE5MkM5NzksMTE5MiAxMDcwLDExNjkgMTE2MSwxMTIybC02NSwtMTQzQzEwMjUsMTAxNiA5NTgsMTAzNCA4OTMsMTAzNE0xMDAsNzMxQzEwMCw4NjQgMTMzLDk4OSAyMDAsMTEwNkMyNjcsMTIyMyAzNTgsMTMxNSA0NzUsMTM4MkM1OTIsMTQ0OSA3MTcsMTQ4MyA4NTIsMTQ4M0M5ODUsMTQ4MyAxMTEwLDE0NTAgMTIyNywxMzgzQzEzNDQsMTMxNiAxNDM2LDEyMjUgMTUwMywxMTA4QzE1NzAsOTkxIDE2MDQsODY2IDE2MDQsNzMxQzE2MDQsNjAwIDE1NzIsNDc2IDE1MDcsMzYxQzE0NDIsMjQ2IDEzNTIsMTUzIDEyMzUsODRDMTExOCwxNSA5OTEsLTIwIDg1MiwtMjBDNzE0LC0yMCA1ODcsMTUgNDcwLDg0QzM1MywxNTMgMjYzLDI0NSAxOTgsMzYwQzEzMyw0NzUgMTAwLDU5OSAxMDAsNzMxTTIyMyw3MzFDMjIzLDYxOCAyNTEsNTEzIDMwOCw0MTZDMzY0LDMxOSA0NDEsMjQyIDUzOCwxODZDNjM1LDEzMCA3NDAsMTAyIDg1MiwxMDJDOTY1LDEwMiAxMDcxLDEzMSAxMTY4LDE4OEMxMjY1LDI0NSAxMzQyLDMyMSAxMzk4LDQxOEMxNDUzLDUxNCAxNDgxLDYxOCAxNDgxLDczMUMxNDgxLDg0MyAxNDUzLDk0OCAxMzk3LDEwNDZDMTM0MCwxMTQzIDEyNjMsMTIyMCAxMTY2LDEyNzZDMTA2OCwxMzMyIDk2MywxMzYwIDg1MiwxMzYwQzc0MCwxMzYwIDYzNiwxMzMyIDU0MCwxMjc3QzQ0MywxMjIyIDM2NiwxMTQ1IDMwOSwxMDQ4QzI1Miw5NTEgMjIzLDg0NSAyMjMsNzMxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeEFEO1xcXCIgaG9yaXotYWR2LXg9XFxcIjY1OVxcXCIgZD1cXFwiTTcyLDQ0OWwwLDIwMGw1MTQsMGwwLC0yMDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4QUU7XFxcIiBob3Jpei1hZHYteD1cXFwiMTcwNFxcXCIgZD1cXFwiTTc0OCw3NzBsNjksMEM4NjYsNzcwIDkwNCw3ODIgOTI5LDgwNUM5NTQsODI4IDk2Nyw4NjIgOTY3LDkwNUM5NjcsOTUzIDk1NSw5ODcgOTMxLDEwMDZDOTA2LDEwMjUgODY4LDEwMzQgODE1LDEwMzRsLTY3LDBNMTE1Nyw5MDlDMTE1Nyw3OTUgMTEwNiw3MTcgMTAwNCw2NzZsMjM3LC0zOTdsLTIxMSwwbC0xOTIsMzQ2bC05MCwwbDAsLTM0NmwtMTg5LDBsMCw5MDNsMjYyLDBDOTM3LDExODIgMTAyMiwxMTU5IDEwNzYsMTExNEMxMTMwLDEwNjkgMTE1NywxMDAwIDExNTcsOTA5TTEwMCw3MzFDMTAwLDg2NCAxMzMsOTg5IDIwMCwxMTA2QzI2NywxMjIzIDM1OCwxMzE1IDQ3NSwxMzgyQzU5MiwxNDQ5IDcxNywxNDgzIDg1MiwxNDgzQzk4NSwxNDgzIDExMTAsMTQ1MCAxMjI3LDEzODNDMTM0NCwxMzE2IDE0MzYsMTIyNSAxNTAzLDExMDhDMTU3MCw5OTEgMTYwNCw4NjYgMTYwNCw3MzFDMTYwNCw2MDAgMTU3Miw0NzYgMTUwNywzNjFDMTQ0MiwyNDYgMTM1MiwxNTMgMTIzNSw4NEMxMTE4LDE1IDk5MSwtMjAgODUyLC0yMEM3MTQsLTIwIDU4NywxNSA0NzAsODRDMzUzLDE1MyAyNjMsMjQ1IDE5OCwzNjBDMTMzLDQ3NSAxMDAsNTk5IDEwMCw3MzFNMjIzLDczMUMyMjMsNjE4IDI1MSw1MTMgMzA4LDQxNkMzNjQsMzE5IDQ0MSwyNDIgNTM4LDE4NkM2MzUsMTMwIDc0MCwxMDIgODUyLDEwMkM5NjUsMTAyIDEwNzEsMTMxIDExNjgsMTg4QzEyNjUsMjQ1IDEzNDIsMzIxIDEzOTgsNDE4QzE0NTMsNTE0IDE0ODEsNjE4IDE0ODEsNzMxQzE0ODEsODQzIDE0NTMsOTQ4IDEzOTcsMTA0NkMxMzQwLDExNDMgMTI2MywxMjIwIDExNjYsMTI3NkMxMDY4LDEzMzIgOTYzLDEzNjAgODUyLDEzNjBDNzQwLDEzNjAgNjM2LDEzMzIgNTQwLDEyNzdDNDQzLDEyMjIgMzY2LDExNDUgMzA5LDEwNDhDMjUyLDk1MSAyMjMsODQ1IDIyMyw3MzF6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4MjAxODtcXFwiIGhvcml6LWFkdi14PVxcXCIzOTVcXFwiIGQ9XFxcIk0zNyw5NjFsLTEyLDIyQzM4LDEwMzggNjIsMTExMyA5NiwxMjA3QzEzMCwxMzAxIDE2NSwxMzg2IDIwMSwxNDYybDE3MCwwQzMyOCwxMjkxIDI5NSwxMTI0IDI3MCw5NjF6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4MjAxOTtcXFwiIGhvcml6LWFkdi14PVxcXCIzOTVcXFwiIGQ9XFxcIk0zNTYsMTQ2MmwxNSwtMjJDMzM2LDEzMDEgMjc3LDExNDEgMTk1LDk2MWwtMTcwLDBDNzEsMTE1NCAxMDQsMTMyMSAxMjUsMTQ2MnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImI3gyMDFDO1xcXCIgaG9yaXotYWR2LXg9XFxcIjgxM1xcXCIgZD1cXFwiTTQ0MCw5ODNDNDc1LDExMTggNTM1LDEyNzggNjE4LDE0NjJsMTcwLDBDNzQyLDEyNjUgNzA5LDEwOTggNjg4LDk2MWwtMjMzLDBNMjUsOTgzQzM4LDEwMzggNjIsMTExMyA5NiwxMjA3QzEzMCwxMzAxIDE2NSwxMzg2IDIwMSwxNDYybDE3MCwwQzMyOCwxMjkxIDI5NSwxMTI0IDI3MCw5NjFsLTIzMywwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeDIwMUQ7XFxcIiBob3Jpei1hZHYteD1cXFwiODEzXFxcIiBkPVxcXCJNMzcxLDE0NDBDMzM2LDEzMDEgMjc3LDExNDEgMTk1LDk2MWwtMTcwLDBDNzEsMTE1NCAxMDQsMTMyMSAxMjUsMTQ2MmwyMzEsME03ODgsMTQ0MEM3NTMsMTMwMSA2OTQsMTE0MSA2MTIsOTYxbC0xNzIsMEM0ODYsMTE0MiA1MjAsMTMwOSA1NDMsMTQ2MmwyMzEsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImI3gyMDIyO1xcXCIgaG9yaXotYWR2LXg9XFxcIjc3MFxcXCIgZD1cXFwiTTEzMSw3NDhDMTMxLDg0MCAxNTMsOTEwIDE5Nyw5NThDMjQxLDEwMDYgMzA0LDEwMzAgMzg1LDEwMzBDNDY2LDEwMzAgNTI4LDEwMDYgNTczLDk1OEM2MTcsOTA5IDYzOSw4MzkgNjM5LDc0OEM2MzksNjU4IDYxNyw1ODggNTcyLDUzOUM1MjcsNDkwIDQ2NSw0NjUgMzg1LDQ2NUMzMDUsNDY1IDI0Myw0ODkgMTk4LDUzOEMxNTMsNTg2IDEzMSw2NTYgMTMxLDc0OHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImI3gyMEFDO1xcXCIgaG9yaXotYWR2LXg9XFxcIjExODhcXFwiIGQ9XFxcIk03OTksMTI3OEM3MDUsMTI3OCA2MjgsMTI1MCA1NjksMTE5NEM1MDksMTEzOCA0NjksMTA1MyA0NDksOTQwbDQ1NiwwbDAsLTE1NGwtNDcxLDBsLTIsLTQ1bDAsLTU1bDIsLTM5bDQwOCwwbDAsLTE1M2wtMzkxLDBDNDk0LDI4NiA2MTUsMTgyIDgxNSwxODJDOTEwLDE4MiAxMDA4LDIwMyAxMTA4LDI0NGwwLC0yMDNDMTAyMSwwIDkxOSwtMjAgODAzLC0yMEM2NDIsLTIwIDUxMiwyNCA0MTIsMTEyQzMxMSwyMDAgMjQ2LDMyNyAyMTUsNDk0bC0xNTIsMGwwLDE1M2wxMzYsMGwtMiwzN2wwLDM3bDIsNjVsLTEzNiwwbDAsMTU0bDE1MCwwQzIzOCwxMTA3IDMwMiwxMjM5IDQwNCwxMzM0QzUwNiwxNDI5IDYzOCwxNDc3IDc5OSwxNDc3QzkzMiwxNDc3IDEwNTIsMTQ0OCAxMTU3LDEzODlsLTg0LC0xODdDOTcwLDEyNTMgODc5LDEyNzggNzk5LDEyNzh6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4MjEyMjtcXFwiIGhvcml6LWFkdi14PVxcXCIxNTYxXFxcIiBkPVxcXCJNMzc1LDc0MWwtMTQ2LDBsMCw1OTJsLTIwMiwwbDAsMTI5bDU1MywwbDAsLTEyOWwtMjA1LDBNOTYzLDc0MWwtMTg1LDU0M2wtNiwwbDQsLTExOWwwLC00MjRsLTE0MSwwbDAsNzIxbDIxNywwbDE3OCwtNTM0bDE4Nyw1MzRsMjEwLDBsMCwtNzIxbC0xNDcsMGwwLDQxNGw0LDEyOWwtNiwwbC0xOTMsLTU0M3pcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJJXFxcIiBob3Jpei1hZHYteD1cXFwiNjI1XFxcIiBkPVxcXCJNMTkzLDBsMCwxNDYybDIzOSwwbDAsLTE0NjJ6XFxcIi8+XFxuIDwvZm9udD5cXG5cIilcbiAgLy8gZGlhZ3JhbS50b19kZWZzKGZzLnJlYWRGaWxlU3luYygnLi4vcmVzb3VyY2VzL2JhY2tncm91bmQuc3ZnJykpXG4gIGRpYWdyYW0udG9fZGVmcyhcIjxnIGNsYXNzPVxcXCJGQ0hCb3hcXFwiPlxcbiAgPGc+XFxuICAgIDxwYXRoIGZpbGw9XFxcIiNGRkZGRkZcXFwiIGQ9XFxcIm0xNjAgNTBjMCAxIC0xIDMgLTIgM2gtMTU1Yy0xIDAgLTIgLTEgLTIgLTJ2LTQ1YzAgLTEgMSAtMiAzIC0yaDE1NWMxIDAgMyAxIDMgM3Y0NXpcXFwiLz5cXG4gICAgPHBhdGggZmlsbD1cXFwiI0FBQjJCRFxcXCIgZD1cXFwibTE2MCAwdjUwaC0xNTV2LTQ1aDE1NW0wIC01aC0xNTVjLTMgMCAtNSAyIC01IDV2NDVjMCAzIDIgNSA1IDVoMTU1YzMgMCA1IC0yIDUgLTV2LTQ1YzAgLTMgLTIgLTUgLTUgLTVsMCAwelxcXCIvPlxcbiAgPC9nPlxcbiAgPHJlY3QgY2xhc3M9XFxcIkZDSEJveC1UZXh0LWJnXFxcIiAgZmlsbD1cXFwibm9uZVxcXCIgd2lkdGg9XFxcIjEzNVxcXCIgaGVpZ2h0PVxcXCIzMi43XFxcIi8+XFxuICA8ZyBjbGFzcz1cXFwiRkNIQm94LVRleHRcXFwiPlxcbiAgICA8dGV4dCBjbGFzcz1cXFwiRkNIQm94LVRleHQtdGl0bGVcXFwiIHg9XFxcIjE1XFxcIiB5PVxcXCIyMVxcXCIgZmlsbD1cXFwiI0FBQjJCRFxcXCIgZm9udC1mYW1pbHk9XFxcIidPcGVuU2Fucy1TZW1pYm9sZCdcXFwiIGZvbnQtc2l6ZT1cXFwiMTRcXFwiPkFjdGlvbiBUaXRsZTwvdGV4dD5cXG4gICAgPHRleHQgY2xhc3M9XFxcIkZDSEJveC1UZXh0LXR5cGVcXFwiIHg9XFxcIjE1XFxcIiB5PVxcXCI0MlxcXCIgZmlsbD1cXFwiI0FBQjJCRFxcXCIgZm9udC1mYW1pbHk9XFxcIidPcGVuU2Fucy1TZW1pYm9sZCdcXFwiIGZvbnQtc2l6ZT1cXFwiMTRcXFwiPlR5cGU6IE5vcm1hbDwvdGV4dD5cXG4gIDwvZz5cXG48L2c+XFxuXCIpXG4gIGRpYWdyYW0udG9fZGVmcyhcIjxwYXR0ZXJuIGlkPVxcXCJmY2gtbGluZS1wYXR0ZXJuXFxcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVxcXCJ1c2VyU3BhY2VPblVzZVxcXCIgcGF0dGVyblVuaXRzPVxcXCJ1c2VyU3BhY2VPblVzZVxcXCIgd2lkdGg9XFxcIjUwXFxcIiBoZWlnaHQ9XFxcIjUwXFxcIiBjbGFzcz1cXFwiRkNITGluZS1wYXR0ZXJuXFxcIj5cXG4gIDxjaXJjbGUgZmlsbD1cXFwiI0FBQjJCRFxcXCIgcj1cXFwiMi41XFxcIi8+XFxuPC9wYXR0ZXJuPlxcblwiKVxuICBkaWFncmFtLnRvX2RlZnMoXCI8ZyBjbGFzcz1cXFwiRkNITGluZS1hcnJvd1xcXCI+XFxuICA8bWFya2VyIGlkPVxcXCJmY2gtZW5kYXJyb3dcXFwiIG92ZXJmbG93PVxcXCJ2aXNpYmxlXFxcIiBvcmllbnQ9XFxcImF1dG9cXFwiID5cXG4gICA8cG9seWdvbiBwb2ludHM9XFxcIi01LC01IDAsMCAtNSw1XFxcIiBmaWxsPVxcXCIjQUFCMkJEXFxcIi8+XFxuICA8L21hcmtlcj5cXG48L2c+XFxuXCIpXG4gIGRpYWdyYW0udG9fZGVmcyhcIjxnIGNsYXNzPVxcXCJGQ0hMaW5lLWludGVyc2VjdGlvbiBFZGdlLWludGVyc2VjdGlvblxcXCI+XFxuICA8IS0tcmVjdCB4PVxcXCIxOFxcXCIgeT1cXFwiMTdcXFwiIHdpZHRoPVxcXCI5XFxcIiBoZWlnaHQ9XFxcIjExXFxcIiAvPlxcbiAgPGxpbmUgeDE9XFxcIjQ1XFxcIiB5MT1cXFwiMjhcXFwiIHgyPVxcXCIzMFxcXCIgeTI9XFxcIjI4XFxcIi8+XFxuICA8bGluZSB4MT1cXFwiMzBcXFwiIHkxPVxcXCIxN1xcXCIgeDI9XFxcIjQ1XFxcIiB5Mj1cXFwiMTdcXFwiLz5cXG4gIDxsaW5lIHgxPVxcXCIxNVxcXCIgeTE9XFxcIjI4XFxcIiAgICAgICAgIHkyPVxcXCIyOFxcXCIgLz5cXG4gIDxsaW5lICAgICAgICAgeTE9XFxcIjE3XFxcIiB4Mj1cXFwiMTVcXFwiIHkyPVxcXCIxN1xcXCIvPlxcbiAgPGxpbmUgeDE9XFxcIjE3XFxcIiB5MT1cXFwiNDVcXFwiIHgyPVxcXCIxN1xcXCIvPlxcbiAgPGxpbmUgeDE9XFxcIjI4XFxcIiB4Mj1cXFwiMjhcXFwiIHkyPVxcXCI0NVxcXCIvLS0+XFxuPHJlY3QgeD1cXFwiMTJcXFwiIHk9XFxcIjEwXFxcIiB3aWR0aD1cXFwiMTBcXFwiIGhlaWdodD1cXFwiMTNcXFwiLz5cXG48bGluZSB4MT1cXFwiMzRcXFwiIHkxPVxcXCIyM1xcXCIgeDI9XFxcIjIzXFxcIiB5Mj1cXFwiMjNcXFwiIC8+XFxuXFxuPGxpbmUgeDE9XFxcIjIzXFxcIiB5MT1cXFwiMTFcXFwiIHgyPVxcXCIzNFxcXCIgeTI9XFxcIjExXFxcIiAvPlxcbjxsaW5lIHgxPVxcXCIxMVxcXCIgeTE9XFxcIjIzXFxcIiAgICAgICAgIHkyPVxcXCIyM1xcXCIgLz5cXG48bGluZSAgICAgICAgIHkxPVxcXCIxMVxcXCIgeDI9XFxcIjExXFxcIiB5Mj1cXFwiMTFcXFwiIC8+XFxuPGxpbmUgeDE9XFxcIjExXFxcIiB5MT1cXFwiMzRcXFwiICAgeDI9XFxcIjExXFxcIiAgICAgICAgIC8+XFxuPGxpbmUgeDE9XFxcIjIzXFxcIiAgICAgICAgICAgeDI9XFxcIjIzXFxcIiB5Mj1cXFwiMzRcXFwiIC8+XFxuXFxuXFxuPC9nPlxcblwiKVxuICBkaWFncmFtLnRvX2RlZnMoXCI8ZyBjbGFzcz1cXFwiRkNITGluZVxcXCI+XFxuICA8bGluZSBjbGFzcz1cXFwiRkNITGluZS1kb3RzIEVkZ2VcXFwiIC8+XFxuPC9nPlxcblwiKVxuICBkaWFncmFtLnRvX2RlZnMoXCI8ZyBjbGFzcz1cXFwiRkNITGluZS13aXRoYXJyb3dcXFwiPlxcbiAgPGxpbmUgY2xhc3M9XFxcIkZDSExpbmUtZG90cyBFZGdlXFxcIiAvPlxcbiAgPGxpbmUgY2xhc3M9XFxcIkZDSExpbmUtZW5kYXJyb3cgRWRnZS0tZW5kXFxcIiAvPlxcbjwvZz5cXG5cIilcbiAgZGlhZ3JhbS5kaXNwbGF5KClcblxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgXCJ1c2Ugc3RyaWN0XCJcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZWZhdWx0cyhvYmopIHtcbiAgICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLmZvckVhY2goZnVuY3Rpb24oc291cmNlKXtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgIGlmIChvYmpbcHJvcF0gPT09IHVuZGVmaW5lZCkgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdXG4gICAgICB9XG4gICAgfSlcbiAgICByZXR1cm4gb2JqXG4gIH1cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuXG4gIGZ1bmN0aW9uIHF1ZXJ5KHNlbGVjdG9yLCBwYXJlbnQpe1xuICAgIHBhcmVudCA9IHBhcmVudCB8fCBkb2N1bWVudFxuICAgIHJldHVybiBwYXJlbnQucXVlcnlTZWxlY3RvcihzZWxlY3RvcilcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZSh0YWdfbmFtZSwgYXR0cnMpe1xuICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdfbmFtZSlcbiAgICBpZiAoIGF0dHJzICkgeyBzZXRfYXR0cmlidXRlcyhub2RlLCBhdHRycykgfVxuICAgIHJldHVybiBub2RlXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfYXR0cmlidXRlKG5vZGUsIGF0dHIpe1xuICAgIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsdmFsdWUpXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfYXR0cmlidXRlcyhub2RlLCBhdHRycyl7XG4gICAgT2JqZWN0LmtleXMoYXR0cnMpXG4gICAgICAgICAgLmZvckVhY2goZnVuY3Rpb24obmFtZSl7XG4gICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCBhdHRyc1tuYW1lXSlcbiAgICAgICAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3RleHQobm9kZSl7XG4gICAgcmV0dXJuIG5vZGUudGV4dENvbnRlbnQgfHwgbm9kZS5pbm5lclRleHRcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF90ZXh0KG5vZGUsIHRleHQpe1xuICAgIG5vZGUudGV4dENvbnRlbnQgPSBub2RlLmlubmVyVGV4dCA9IHRleHRcbiAgfVxuXG4gIGZ1bmN0aW9uIGluc2VydEFmdGVyKHBhcmVudEVsLCBzcDEsIHNwMil7XG4gICAgcGFyZW50RWwuaW5zZXJ0QmVmb3JlKHNwMSwgc3AyLm5leHRTaWJsaW5nKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlTm9kZShub2RlKXtcbiAgICBub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobm9kZSlcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICQgICAgICAgICAgICAgOiBxdWVyeVxuICAvLywgJGlkICAgICAgICAgICA6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkLmJpbmQoZG9jdW1lbnQpXG4gICwgJGlkICAgICAgICAgICA6IGZ1bmN0aW9uKGlkKXsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKSB9XG4gICwgY3JlYXRlICAgICAgICA6IGNyZWF0ZVxuICAsIGF0dHIgICAgICAgICAgOiBzZXRfYXR0cmlidXRlXG4gICwgYXR0cnMgICAgICAgICA6IHNldF9hdHRyaWJ1dGVzXG4gICwgZ2V0X3RleHQgICAgICA6IGdldF90ZXh0XG4gICwgc2V0X3RleHQgICAgICA6IHNldF90ZXh0XG4gICwgcmVtb3ZlICAgICAgICA6IHJlbW92ZU5vZGVcbiAgLCBpbnNlcnRBZnRlciAgIDogaW5zZXJ0QWZ0ZXJcbiAgfVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIGlkcyA9IFtdXG4gIHZhciBydCA9IHJlcXVpcmUoJ3JhbmRvbS10b2tlbicpXG4gIHZhciBsZXR0ZXJzID0gcnQuZ2VuKCdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5dCcpXG5cbiAgZnVuY3Rpb24gdG9rZW4oKXsgcmV0dXJuIGxldHRlcnMoMSkgKyBydCgxNikgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcbiAgICB2YXIgaWQgPSB0b2tlbigpXG4gICAgd2hpbGUgKCBpZHMuaW5kZXhPZihpZCkgIT0gLTEgKXtcbiAgICAgIGlkID0gdG9rZW4oKVxuICAgIH1cbiAgICByZXR1cm4gaWRcbiAgfVxufSgpXG4iLG51bGwsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiJdfQ==
