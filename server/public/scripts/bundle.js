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
    diagram.svgel.parent().attr({ width: graph.width + diagram.config.edgeWidth + diagram.config.padding, height: graph.height + diagram.config.edgeWidth + diagram.config.padding })
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
  var rt = require('random-token')
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
  , rankSep: 150
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
    }, ranks[i])
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
  diagram.to_defs("<pattern id=\"fhc-line-pattern\" patternContentUnits=\"objectBoundingBox\" class=\"FCHLine-pattern\">\n  <circle fill=\"#AAB2BD\" r=\"2.5\"/>\n</pattern>\n")
  diagram.to_defs("<g class=\"FCHLine-arrow\">\n  <marker id=\"fch-endarrow\" overflow=\"visible\" orient=\"auto\" >\n   <polygon points=\"-5,-5 0,0 -5,5\" fill=\"#AAB2BD\"/>\n  </marker>\n</g>\n")
  diagram.to_defs("<g class=\"FCHLine-intersection Edge-intersection\">\n  <!--rect x=\"18\" y=\"17\" width=\"9\" height=\"11\" />\n  <line x1=\"45\" y1=\"28\" x2=\"30\" y2=\"28\"/>\n  <line x1=\"30\" y1=\"17\" x2=\"45\" y2=\"17\"/>\n  <line x1=\"15\" y1=\"28\"         y2=\"28\" />\n  <line         y1=\"17\" x2=\"15\" y2=\"17\"/>\n  <line x1=\"17\" y1=\"45\" x2=\"17\"/>\n  <line x1=\"28\" x2=\"28\" y2=\"45\"/-->\n<rect x=\"12\" y=\"10\" width=\"10\" height=\"13\"/>\n<line x1=\"34\" y1=\"23\" x2=\"23\" y2=\"23\" />\n\n<line x1=\"23\" y1=\"11\" x2=\"34\" y2=\"11\" />\n<line x1=\"11\" y1=\"23\"         y2=\"23\" />\n<line         y1=\"11\" x2=\"11\" y2=\"11\" />\n<line x1=\"11\" y1=\"34\"   x2=\"11\"         />\n<line x1=\"23\"           x2=\"23\" y2=\"34\" />\n\n\n</g>\n")
  diagram.to_defs("<g class=\"FCHLine\">\n  <line class=\"FCHLine-dots Edge\" />\n</g>\n")
  diagram.to_defs("<g class=\"FCHLine-witharrow\">\n  <line class=\"FCHLine-dots Edge\" />\n  <line class=\"FCHLine-endarrow Edge--end\" />\n</g>\n")
  diagram.display()


}()

},{"../index.js":11,"../util/dom.js":69,"../util/unique_id.js":70,"fs":71,"lorem-ipsum":61,"random-number":62,"random-token":63}],68:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9hcnIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9kaWFncmFtLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vZWRnZXMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9pbnRlcnNlY3QuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvZGlhZ3JhbS9pdGVtLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vdHJhbnNsYXRlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2RpYWdyYW0vdmVjdG9ycy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ncmFwaC9lZGdlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL2dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L2dyYXBoL25vZGUuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvbGF5b3V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9vcmRlci9jcm9zc0NvdW50LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdExheWVyR3JhcGhzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvaW5pdE9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvb3JkZXIvc29ydExheWVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcG9zaXRpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9hY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9jb25zdHJhaW50cy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvZmVhc2libGVUcmVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvcmFuay9pbml0UmFuay5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbGliL3JhbmsvcmFua1V0aWwuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi9yYW5rL3NpbXBsZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL2xpYi91dGlsLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9saWIvdmVyc2lvbi5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9jcC1kYXRhL2xpYi9Qcmlvcml0eVF1ZXVlLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvU2V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvY3AtZGF0YS9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2NwLWRhdGEvbGliL3ZlcnNpb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9pbmRleC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9CYXNlR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvQ0dyYXBoLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL0RpZ3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvR3JhcGguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2NvbXBvbmVudHMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL2RpamtzdHJhLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9kaWprc3RyYUFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmluZEN5Y2xlcy5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvZmxveWRXYXJzaGFsbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi9hbGcvaXNBY3ljbGljLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wb3N0b3JkZXIuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3ByZW9yZGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy9wcmltLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2FsZy90YXJqYW4uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvYWxnL3RvcHNvcnQuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29tcG91bmRpZnkuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvY29udmVydGVyL2pzb24uanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvZmlsdGVyLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9kYWdyZS9ub2RlX21vZHVsZXMvZ3JhcGhsaWIvbGliL2dyYXBoLWNvbnZlcnRlcnMuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2RhZ3JlL25vZGVfbW9kdWxlcy9ncmFwaGxpYi9saWIvdXRpbC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvZGFncmUvbm9kZV9tb2R1bGVzL2dyYXBobGliL2xpYi92ZXJzaW9uLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9lbnNsYXZlL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9oeXBlcmdsdWUvYnJvd3Nlci5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC9ub2RlX21vZHVsZXMvaHlwZXJnbHVlL25vZGVfbW9kdWxlcy9kb21pZnkvaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL2xvcmVtLWlwc3VtL2xpYi9kaWN0aW9uYXJ5LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9sb3JlbS1pcHN1bS9saWIvZ2VuZXJhdG9yLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9yYW5kb20tbnVtYmVyL2luZGV4LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L25vZGVfbW9kdWxlcy9yYW5kb20tdG9rZW4vaW5kZXguanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvbm9kZV9tb2R1bGVzL3ZpcmFsL3ZpcmFsLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3BhdGh3YXkuanMiLCIvaG9tZS9hc2hudXIvd29yay9kaWFncmFtcy9jbGllbnQvc2V0LmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3Rlc3QvdGVzdC5qcyIsIi9ob21lL2FzaG51ci93b3JrL2RpYWdyYW1zL2NsaWVudC91dGlsL2RlZmF1bHRzLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvZG9tLmpzIiwiL2hvbWUvYXNobnVyL3dvcmsvZGlhZ3JhbXMvY2xpZW50L3V0aWwvdW5pcXVlX2lkLmpzIiwiL3Vzci9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L2xpYi9fZW1wdHkuanMiLCIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0YkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuXG4gIGZ1bmN0aW9uIHNpemUoYXJyKXtcbiAgICByZXR1cm4gYXJyLnZhbHVlcy5sZW5ndGhcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsb25lKGFycil7XG4gICAgcmV0dXJuIEFyci5tYWtlKGFycilcbiAgfVxuXG4gIGZ1bmN0aW9uIGZvckVhY2goc2V0LCBmbil7XG4gICAgc2V0LnZhbHVlcy5mb3JFYWNoKGZuKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVkdWNlKHNldCwgZm4sIGluaXQpe1xuICAgIGlmICggaW5pdCAhPT0gdW5kZWZpbmVkICkge1xuICAgICAgcmV0dXJuIHNldC52YWx1ZXMucmVkdWNlKGZuLCBpbml0KVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc2V0LnZhbHVlcy5yZWR1Y2UoZm4pXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWFwKHNldCwgZm4pe1xuICAgIHJldHVybiBzZXQudmFsdWVzLm1hcChmbilcbiAgfVxuXG4gIGZ1bmN0aW9uIHNvbWUoc2V0LCBmbil7XG4gICAgcmV0dXJuIHNldC52YWx1ZXMuc29tZShmbilcbiAgfVxuXG4gIGZ1bmN0aW9uIGluZGV4T2Yoc2V0LCB2YWx1ZSl7XG4gICAgcmV0dXJuIHNldC52YWx1ZXMuaW5kZXhPZih2YWx1ZSlcbiAgfVxuXG4gIHZhciBBcnIgPSB2aXJhbC5leHRlbmQoe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGFycil7XG4gICAgICB0aGlzLnZhbHVlcyA9IGFyciAhPSBudWxsID8gYXJyLnZhbHVlcy5zbGljZSgwKSA6IFtdXG4gICAgfVxuICAsIGZvckVhY2g6IGVuc2xhdmUoZm9yRWFjaClcbiAgLCByZWR1Y2U6IGVuc2xhdmUocmVkdWNlKVxuICAsIG1hcDogZW5zbGF2ZShtYXApXG4gICwgc29tZTogZW5zbGF2ZShzb21lKVxuICAsIHNpemU6IGVuc2xhdmUoc2l6ZSlcbiAgLCBjbG9uZTogZW5zbGF2ZShjbG9uZSlcbiAgLCBpbmRleE9mOiBlbnNsYXZlKGluZGV4T2YpXG4gIH0pXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBBcnJcblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG4gIC8vIHZhciBTbmFwID0gcmVxdWlyZSgnc25hcHN2ZycpXG4gIHZhciB2aXJhbCA9IHJlcXVpcmUoJ3ZpcmFsJylcbiAgdmFyIGVuc2xhdmUgPSByZXF1aXJlKCdlbnNsYXZlJylcbiAgdmFyIGRhZ3JlID0gcmVxdWlyZSgnZGFncmUnKVxuICB2YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJylcbiAgdmFyIGhnbHVlID0gcmVxdWlyZSgnaHlwZXJnbHVlJylcbiAgdmFyIGRlZmF1bHRzID0gcmVxdWlyZSgnLi4vdXRpbC9kZWZhdWx0cy5qcycpXG4gIHZhciB1aWQgPSByZXF1aXJlKCcuLi91dGlsL3VuaXF1ZV9pZC5qcycpXG4gIHZhciBkb20gPSByZXF1aXJlKCcuLi91dGlsL2RvbS5qcycpXG4gIHZhciBpbnRlcnNlY3QgPSByZXF1aXJlKCcuL2ludGVyc2VjdC5qcycpXG4gIHZhciBmbG9vciA9IE1hdGguZmxvb3JcbiAgdmFyIGNlaWwgPSBNYXRoLmNlaWxcbiAgdmFyIG1pbiA9IE1hdGgubWluXG4gIHZhciBtYXggPSBNYXRoLm1heFxuXG4gIHZhciBJdGVtID0gcmVxdWlyZSgnLi9pdGVtLmpzJylcbiAgdmFyIHByaW50ID0gY29uc29sZS5sb2cuYmluZChjb25zb2xlKVxuXG4gIGZ1bmN0aW9uIGZyb21fZGVmcyhkaWFncmFtLCBjbGFzc25hbWUpe1xuICAgIHJldHVybiBkaWFncmFtLnN2Z2VsLnBhcmVudCgpLnNlbGVjdCgnZGVmcyAuJyArIGNsYXNzbmFtZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvX2RlZnMoZGlhZ3JhbSwgc3ZnKXtcbiAgICB2YXIgcCA9IGRpYWdyYW0uc3ZnZWwucGFyZW50KClcbiAgICBpZiAoIHR5cGVvZiBzdmcgPT0gJ3N0cmluZycgKSB7XG4gICAgICB2YXIgZWwgPSBTbmFwLnBhcnNlKHN2Zykuc2VsZWN0KCcqJylcbiAgICB9IGVsc2UgaWYgKCBBcnJheS5pc0FycmF5KHN2ZykgKSB7XG4gICAgICB2YXIgZWwgPSBwLmVsLmFwcGx5KHAuZWwsIHN2ZylcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVE9ETzogcmVwbGFjZSB0aGlzXG4gICAgICBwcmludCgnbm90IHN1cmUgaG93IHRvIGhhbmRsZScpXG4gICAgfVxuICAgIHJldHVybiBwLnNlbGVjdCgnZGVmcycpLmFwcGVuZChlbClcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYXcoZGlhZ3JhbSwgZWwpe1xuICAgIHZhciBuZXdfZWwgPSBmcm9tX2RlZnMoZGlhZ3JhbSwgZWwuY2xhc3NuYW1lKS5jbG9uZSgpXG4gICAgdmFyIG5vZGUgPSBoZ2x1ZShuZXdfZWwubm9kZSwgZWwuY29udGVudClcbiAgICBkaWFncmFtLnN2Z2VsLmFwcGVuZChuZXdfZWwpXG4gICAgcmV0dXJuIG5ld19lbFxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X2xpbmVfYXR0cnMoaXRlbSwgbGluZV9oZWlnaHQsIHgpe1xuICAgIGl0ZW0uZy5zZWxlY3RBbGwoJ3RzcGFuJykuZm9yRWFjaChmdW5jdGlvbih0c3BhbiwgaWR4KXtcbiAgICAgIHRzcGFuLmF0dHIoeyBkeTogaWR4ID8gbGluZV9oZWlnaHQgOiAwICwgeDogeCB9KVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBwb3NfY2FsYyh4LHcseSxoKXtcbiAgICByZXR1cm4gW3ggKyB3IC8gMiwgeSArIGggLyAyXVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3RleHR3aWR0aChub2RlKXtcbiAgICByZXR1cm4gbm9kZS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKVxuICB9XG5cbiAgZnVuY3Rpb24gaW52aXpfYmJveChkaWFncmFtLCBlbCl7XG4gICAgdmFyIGNsb25lID0gZWwuY2xvbmUoKS5hdHRyKClcbiAgICBkaWFncmFtLnN2Z2VsLmFwcGVuZChjbG9uZSlcbiAgICB2YXIgYmJveCA9IGNsb25lLmdldEJCb3goKVxuICAgIGNsb25lLnJlbW92ZSgpXG4gICAgcmV0dXJuIGJib3hcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvaW50X3RvX3N0cmluZyhwKXsgcmV0dXJuIHAueCArICcsJyArIHAueSB9XG5cbiAgZnVuY3Rpb24gaG9yaXpvbnRhbChsaW5lKXtcbiAgICByZXR1cm4gbGluZS5nZXRBdHRyaWJ1dGUoJ3gxJykgPT0gbGluZS5nZXRBdHRyaWJ1dGUoJ3gyJylcbiAgfVxuXG5cbiAgZnVuY3Rpb24gZGlzcGxheShkaWFncmFtKXtcbiAgICAvLyBhcHBseSBoZWlnaHQgLyB3aWR0aCBvbiBub2Rlc1xuICAgIHZhciBpbmdyYXBoID0gZGlhZ3JhbS5pbmdyYXBoXG4gICAgdmFyIGJib3hfY2FjaGUgPSB7fVxuICAgIGluZ3JhcGguZWFjaE5vZGUoZnVuY3Rpb24oaWQsIG5vZGUpe1xuICAgICAgdmFyIGNsYXNzbmFtZSA9IG5vZGUuY2xhc3NuYW1lXG4gICAgICB2YXIgYmJveCA9IGJib3hfY2FjaGVbY2xhc3NuYW1lXSB8fCAoYmJveF9jYWNoZVtjbGFzc25hbWVdID0gaW52aXpfYmJveChkaWFncmFtLCBmcm9tX2RlZnMoZGlhZ3JhbSwgY2xhc3NuYW1lKSkpXG4gICAgICBub2RlLmF0dHIoJ3gnLCBiYm94LngpXG4gICAgICBub2RlLmF0dHIoJ3knLCBiYm94LnkpXG4gICAgICBub2RlLmF0dHIoJ3dpZHRoJywgYmJveC53aWR0aClcbiAgICAgIG5vZGUuYXR0cignaGVpZ2h0JywgYmJveC5oZWlnaHQpXG4gICAgfSlcblxuICAgIHZhciBsYXlvdXQgPSBkaWFncmFtLmxheW91dFxuICAgIHZhciBnY2ZnID0gZGlhZ3JhbS5ncmFwaC5jb25maWdcbiAgICBpZiAoIGdjZmcgKSB7XG4gICAgICBPYmplY3Qua2V5cyhnY2ZnKS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZCl7XG4gICAgICAgIGxheW91dCA9IGxheW91dFttZXRob2RdKGdjZmdbbWV0aG9kXSlcbiAgICAgIH0pXG4gICAgfVxuICAgIGxheW91dC5yYW5rU2ltcGxleCA9IHRydWVcbiAgICAvLyBjYWxjdWxhdGUgbm9kZXMgbGF5b3V0XG4gICAgbGF5b3V0ID0gbGF5b3V0LnJ1bihpbmdyYXBoKVxuXG4gICAgdmFyIGdyYXBoID0gZGlhZ3JhbS5vdXRncmFwaCA9IGxheW91dC5ncmFwaCgpXG5cbiAgICAvLyBkaXNwbGF5IG5vZGVzXG4gICAgbGF5b3V0LmVhY2hOb2RlKGZ1bmN0aW9uKGlkLCB2YWx1ZXMpe1xuICAgICAgdmFyIG5vZGUgPSBkaWFncmFtLmluZ3JhcGgubm9kZShpZClcbiAgICAgIG5vZGUudHJhbnNmb3JtKHZhbHVlcylcbiAgICAgIGRyYXcoZGlhZ3JhbSwgbm9kZSlcbiAgICB9KVxuXG5cbiAgICAvLyBjYWxjdWxhdGUgZWRnZXMgbGF5b3V0XG4gICAgdmFyIGxhbmVzID0gcmVxdWlyZSgnLi9lZGdlcy5qcycpKGxheW91dCwgZGlhZ3JhbSlcbiAgICB2YXIgc2VnbWVudHMgPSBbXVxuXG4gICAgdmFyIGRyYXdfYm91bmQgPSBkcmF3LmJpbmQobnVsbCwgZGlhZ3JhbSlcblxuICAgIGxhbmVzLmZvckVhY2goZnVuY3Rpb24obGFuZSl7XG4gICAgICBsYW5lLmZvckVhY2goZnVuY3Rpb24ocHcpe1xuICAgICAgICB2YXIgc3RhcnQgPSBwd1swXVxuICAgICAgICB2YXIgZW5kID0gcHdbcHcubGVuZ3RoIC0gMV1cbiAgICAgICAgLy8gZHJhdyBwYXRoXG4gICAgICAgIHZhciBwYXRoX3NlZ21lbnQgPSB7aWQ6IHVpZCgpLCB4MTogc3RhcnQueCwgeTE6c3RhcnQueSwgeDI6IGVuZC54LCB5MjogZW5kLnl9XG4gICAgICAgIGRyYXdfYm91bmQoe1xuICAgICAgICAgIGNsYXNzbmFtZTogZGlhZ3JhbS5jb25maWcuZWRnZUNsYXNzXG4gICAgICAgICwgY29udGVudDogeycuRWRnZTpmaXJzdCc6IHBhdGhfc2VnbWVudH1cbiAgICAgICAgfSlcbiAgICAgICAgc2VnbWVudHMucHVzaChwYXRoX3NlZ21lbnQpXG5cbiAgICAgICAgLy8gZHJhdyB0aGUganVuY3Rpb25zXG4gICAgICAgIHZhciBqdW5jdGlvbnMgPSBwdy5maWx0ZXIoZnVuY3Rpb24ocCl7cmV0dXJuIHAubm9kZSAmJiAhIHAuZW50cnkgfSlcbiAgICAgICAgZHJhd19ib3VuZCh7XG4gICAgICAgICAgY2xhc3NuYW1lOiBkaWFncmFtLmNvbmZpZy5lZGdlQ2xhc3NcbiAgICAgICAgLCBjb250ZW50OiB7XG4gICAgICAgICAgICAnLkVkZ2UnOiBqdW5jdGlvbnMubWFwKGZ1bmN0aW9uKHApe1xuICAgICAgICAgICAgICB2YXIgal9zZWdtZW50ID0ge2lkOiB1aWQoKSwgeDE6IHAueCwgeTE6cC55LCB4MjogcC5ub2RlLngsIHkyOiBwLm5vZGUueX1cbiAgICAgICAgICAgICAgc2VnbWVudHMucHVzaChqX3NlZ21lbnQpXG4gICAgICAgICAgICAgIHJldHVybiB7ICc6Zmlyc3QnOiBqX3NlZ21lbnR9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICB2YXIgZW50cmllcyA9IHB3LmZpbHRlcihmdW5jdGlvbihwKXtyZXR1cm4gISEgcC5lbnRyeSB9KVxuICAgICAgICBkcmF3X2JvdW5kKHtcbiAgICAgICAgICBjbGFzc25hbWU6IGRpYWdyYW0uY29uZmlnLmVkZ2VFbmRDbGFzc1xuICAgICAgICAsIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICcuRWRnZSc6IGVudHJpZXMubWFwKGZ1bmN0aW9uKHApe1xuICAgICAgICAgICAgICB2YXIgal9zZWdtZW50ID0ge2lkOiB1aWQoKSwgeDE6IHAueCwgeTE6cC55LCB4MjogcC5jdXQueCwgeTI6IHAuY3V0Lnl9XG4gICAgICAgICAgICAgIHNlZ21lbnRzLnB1c2goal9zZWdtZW50KVxuICAgICAgICAgICAgICByZXR1cm4geyc6Zmlyc3QnOiBqX3NlZ21lbnR9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICwgJy5FZGdlLS1lbmQnOiBlbnRyaWVzLm1hcChmdW5jdGlvbihwKXtcbiAgICAgICAgICAgICAgdmFyIGpfc2VnbWVudCA9IHtpZDogdWlkKCksIHgxOiBwLmN1dC54LCB5MTpwLmN1dC55LCB4MjogcC5ub2RlLngsIHkyOiBwLm5vZGUueX1cbiAgICAgICAgICAgICAgc2VnbWVudHMucHVzaChqX3NlZ21lbnQpXG4gICAgICAgICAgICAgIHJldHVybiB7JzpmaXJzdCc6IGpfc2VnbWVudH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICAvLyBkcmF3IHRoZSBza2lwc1xuICAgIGRyYXdfYm91bmQoe1xuICAgICAgY2xhc3NuYW1lOiBkaWFncmFtLmNvbmZpZy5lZGdlQ2xhc3NcbiAgICAsIGNvbnRlbnQ6IHsnLkVkZ2UnOiBsYW5lcy5za2lwcy5tYXAoZnVuY3Rpb24ocCl7XG4gICAgICAgIHZhciBza2lwX3NlZ21lbnQgPSB7aWQ6IHVpZCgpLCB4MTogcFswXS54LCB5MTpwWzBdLnksIHgyOiBwWzFdLngsIHkyOiBwWzFdLnl9XG4gICAgICAgIHNlZ21lbnRzLnB1c2goc2tpcF9zZWdtZW50KVxuICAgICAgICByZXR1cm4geyAnOmZpcnN0Jzogc2tpcF9zZWdtZW50IH1cbiAgICAgIH0pfVxuICAgIH0pXG5cbiAgICB2YXIgaW50ZXJzZWN0aW9uX3NpemUgPSBpbnZpel9iYm94KGRpYWdyYW0sIGZyb21fZGVmcyhkaWFncmFtLCBkaWFncmFtLmNvbmZpZy5pbnRlcnNlY3Rpb25DbGFzcykpXG4gICAgdmFyIGludGVyc2VjdGlvbl9taWRkbGUgPSBbaW50ZXJzZWN0aW9uX3NpemUud2lkdGggLyAyLCBpbnRlcnNlY3Rpb25fc2l6ZS5oZWlnaHQgLyAyXVxuICAgIHNlZ21lbnRzLmZvckVhY2goZnVuY3Rpb24oc2VnMSwgaWQxKXtcbiAgICAgIHNlZ21lbnRzLmZvckVhY2goZnVuY3Rpb24oc2VnMiwgaWQyKXtcbiAgICAgICAgaWYgKCBpZDIgPiBpZDEgJiYgc2VnMS54MSAhPSBzZWcyLngxICYmICBzZWcxLngyICE9IHNlZzIueDIgJiYgc2VnMS55MSAhPSBzZWcyLnkxICYmICBzZWcxLnkyICE9IHNlZzIueTIgKSB7XG4gICAgICAgICAgdmFyIGlzY3QgPSBpbnRlcnNlY3Qoc2VnMSwgc2VnMilcbiAgICAgICAgICBpZiAoIGlzY3QgKSB7XG4gICAgICAgICAgICB2YXIgc2VnMW5vZGUgPSBkb20uJGlkKHNlZzEuaWQpXG4gICAgICAgICAgICB2YXIgc2VnMm5vZGUgPSBkb20uJGlkKHNlZzIuaWQpXG4gICAgICAgICAgICB2YXIgdG9wbm9kZSA9IHNlZzFub2RlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKHNlZzJub2RlKSAmIDQgPyBzZWcxbm9kZSA6IHNlZzJub2RlXG4gICAgICAgICAgICB2YXIgaW50ZXJzZWN0X25vZGUgPSBkcmF3KGRpYWdyYW0sIHsgY2xhc3NuYW1lOiBkaWFncmFtLmNvbmZpZy5pbnRlcnNlY3Rpb25DbGFzcyAsIGNvbnRlbnQ6IHt9IH0pXG4gICAgICAgICAgICBpZiAoIGhvcml6b250YWwodG9wbm9kZSkgKSB7XG4gICAgICAgICAgICAgIGludGVyc2VjdF9ub2RlLnRyYW5zZm9ybSgobmV3IFNuYXAuTWF0cml4KDEsIDAsIDAsIDEsIDAgLCAwKSkucm90YXRlKDkwLCBpc2N0WzBdICwgaXNjdFsxXSApLnRvVHJhbnNmb3JtU3RyaW5nKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zZm9ybShpbnRlcnNlY3Rfbm9kZS5tYXRyaXgudHJhbnNsYXRlKGlzY3RbMF0gLSBpbnRlcnNlY3Rpb25fbWlkZGxlWzBdLCBpc2N0WzFdIC0gaW50ZXJzZWN0aW9uX21pZGRsZVsxXSkpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpbnRlcnNlY3Rfbm9kZS50cmFuc2Zvcm0obmV3IFNuYXAuTWF0cml4KDEsIDAsIDAsIDEsIGlzY3RbMF0gLSBpbnRlcnNlY3Rpb25fbWlkZGxlWzBdLCBpc2N0WzFdIC0gaW50ZXJzZWN0aW9uX21pZGRsZVsxXSkpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRvbS5pbnNlcnRBZnRlcih0b3Bub2RlLnBhcmVudE5vZGUsIGludGVyc2VjdF9ub2RlLm5vZGUsIHRvcG5vZGUubmV4dFNpYmxpbmcpXG5cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcblxuICAgIHZhciBtb3ZlID0gZGlhZ3JhbS5zdmdlbC5tYXRyaXguY2xvbmUoKVxuICAgIGlmICggZ3JhcGgucmFua0RpciA9PSBcIkxSXCIgfHwgZ3JhcGgucmFua0RpciA9PSBcIlJMXCIgKSB7XG4gICAgICBncmFwaC5oZWlnaHQgPSBncmFwaC5oZWlnaHQgKyBsYW5lcy5ncm93dGggKiAyXG4gICAgICB2YXIgbW92ZSA9IG1vdmUudHJhbnNsYXRlKDAsIGxhbmVzLmdyb3d0aClcbiAgICB9IGVsc2Uge1xuICAgICAgZ3JhcGgud2lkdGggPSBncmFwaC53aWR0aCArIGxhbmVzLmdyb3d0aCAqIDJcbiAgICAgIHZhciBtb3ZlID0gbW92ZS50cmFuc2xhdGUobGFuZXMuZ3Jvd3RoLCAwKVxuICAgIH1cblxuICAgIGRpYWdyYW0uc3ZnZWwuYXR0cih7IHdpZHRoOiBncmFwaC53aWR0aCwgaGVpZ2h0OiBncmFwaC5oZWlnaHQgfSkudHJhbnNmb3JtKG1vdmUudG9UcmFuc2Zvcm1TdHJpbmcoKSlcbiAgICBkaWFncmFtLnN2Z2VsLnBhcmVudCgpLmF0dHIoeyB3aWR0aDogZ3JhcGgud2lkdGggKyBkaWFncmFtLmNvbmZpZy5lZGdlV2lkdGggKyBkaWFncmFtLmNvbmZpZy5wYWRkaW5nLCBoZWlnaHQ6IGdyYXBoLmhlaWdodCArIGRpYWdyYW0uY29uZmlnLmVkZ2VXaWR0aCArIGRpYWdyYW0uY29uZmlnLnBhZGRpbmcgfSlcbiAgICByZXR1cm4gbGF5b3V0XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHZpcmFsLmV4dGVuZChuZXcgZXZlbnRzLkV2ZW50RW1pdHRlcikuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihjb25maWcsIGdyYXBoKXtcbiAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICB0aGlzLml0ZW1zID0ge31cbiAgICAgIHRoaXMuY29ubmVjdG9ycyA9IHt9XG4gICAgICB0aGlzLmdyYXBoID0gZ3JhcGhcbiAgICAgIHRoaXMuaW5ncmFwaCA9IGdyYXBoLmluZ3JhcGhcbiAgICAgIHRoaXMubGF5b3V0ID0gZGFncmUubGF5b3V0KClcbiAgICAgIHRoaXMuc3ZnZWwgPSBTbmFwLmFwcGx5KFNuYXAsIGNvbmZpZy5zbmFwX2FyZ3MpLmcoKS5hdHRyKHsgdHJhbnNmb3JtOiBcInRyYW5zbGF0ZSgyMCwyMClcIiwgaWQ6dWlkKCl9KVxuICAgIH1cbiAgLCBkaXNwbGF5OiBlbnNsYXZlKGRpc3BsYXkpXG4gICwgZHJhdzogZW5zbGF2ZShkcmF3KVxuICAsIHRvX2RlZnM6IGVuc2xhdmUodG9fZGVmcylcblxuLy8gICwgYWRkSXRlbTogZW5zbGF2ZShhZGRfaXRlbSlcbi8vICAsIGRlbEl0ZW06IGVuc2xhdmUocmVtb3ZlX2l0ZW0pXG4vL1xuLy8gICwgY29ubmVjdDogZW5zbGF2ZShhZGRfY29ubmVjdG9yKVxuLy8gICwgZGlzY29ubmVjdDogZW5zbGF2ZShyZW1vdmVfY29ubmVjdG9yKVxuLy9cbi8vXG4vLyAgLCBzZWxlY3RJdGVtczogZW5zbGF2ZShmaWx0ZXJfaXRlbXMpXG4vLyAgLCBzZWxlY3RDb25uZWN0b3JzOiBlbnNsYXZlKGZpbHRlcl9pdGVtcylcblxuICB9KVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgdmFyIFNldCA9IHJlcXVpcmUoJy4uL3NldC5qcycpXG4gIHZhciBQYXRod2F5cyA9IHJlcXVpcmUoJy4uL3BhdGh3YXkuanMnKVxuXG4gIHZhciB0cmFuc2xhdGUgPSByZXF1aXJlKCcuL3RyYW5zbGF0ZS5qcycpXG4gIHZhciBWID0gcmVxdWlyZSgnLi92ZWN0b3JzLmpzJylcblxuICBmdW5jdGlvbiBwb2ludCh4LCB5KXtcbiAgICByZXR1cm4geyB4OiB4IHx8IDAsIHk6IHkgfHwgMCB9XG4gIH1cblxuICBmdW5jdGlvbiBzaWRlX2Zyb21fZGlyZWN0aW9uKG5vZGUsIGQpe1xuICAgIHZhciBjID0gcG9pbnQobm9kZS54LCBub2RlLnkpXG4gICAgdmFyIHcgPSBub2RlLndpZHRoIC8gMlxuICAgIHZhciBoID0gbm9kZS5oZWlnaHQgLyAyXG4gICAgdmFyIHRsID0gdHJhbnNsYXRlKFstdywgLWhdLCBjKVxuICAgIHZhciB0ciA9IHRyYW5zbGF0ZShbdywgLWhdLCBjKVxuICAgIHZhciBibCA9IHRyYW5zbGF0ZShbLXcsIGhdLCBjKVxuICAgIHZhciBiciA9IHRyYW5zbGF0ZShbdywgaF0sIGMpXG4gICAgc3dpdGNoICggZCApIHtcbiAgICAgIGNhc2UgJ0wnIDpcbiAgICAgICAgcmV0dXJuIFt0bCwgYmxdXG4gICAgICBjYXNlICdSJyA6XG4gICAgICAgIHJldHVybiBbdHIsIGJyXVxuICAgICAgY2FzZSAnQicgOlxuICAgICAgICByZXR1cm4gW2JsLCBicl1cbiAgICAgIGNhc2UgJ1QnIDpcbiAgICAgICAgcmV0dXJuIFt0bCwgdHJdXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGl2aWRlX3NpZGUoc2lkZSwgbil7XG4gICAgdmFyIFgxID0gc2lkZVswXS54XG4gICAgdmFyIFkxID0gc2lkZVswXS55XG4gICAgdmFyIFgyID0gc2lkZVsxXS54XG4gICAgdmFyIFkyID0gc2lkZVsxXS55XG5cbiAgICB2YXIgVyA9IFgyIC0gWDFcbiAgICB2YXIgSCA9IFkyIC0gWTFcbiAgICB2YXIgcG9pbnRzID0gW11cbiAgICB2YXIgcncgPSBXIC8gblxuICAgIHZhciByaCA9IEggLyBuXG4gICAgd2hpbGUgKCAtLW4gPiAwICkge1xuICAgICAgcG9pbnRzLnB1c2godHJhbnNsYXRlKFsgbiAqIHJ3LCBuICogcmggXSwgc2lkZVswXSkpXG4gICAgfVxuICAgIHBvaW50cy5yZXZlcnNlKClcbiAgICByZXR1cm4gcG9pbnRzXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfcmFua19kaW0obWFyZ2luLCBrZXksIG5vZGUpe1xuICAgIHJldHVybiBNYXRoLmNlaWwobm9kZVtrZXldIC8gbWFyZ2luKSAqIG1hcmdpblxuICB9XG5cbiAgZnVuY3Rpb24gbnVtX2NvbXAoYSwgYil7XG4gICAgcmV0dXJuIGEgPiBiID8gIDFcbiAgICAgICAgIDogYSA8IGIgPyAtMVxuICAgICAgICAgOiAgICAgICAgICAwXG4gIH1cblxuICBmdW5jdGlvbiBzb3J0X25vZGVzX2luX3JhbmsoZGlyLCBhLCBiKXtcbiAgICBzd2l0Y2ggKCBkaXIgKSB7XG4gICAgICBjYXNlICdUQic6XG4gICAgICAgIHJldHVybiBhLnggPCBiLnggPyAtMVxuICAgICAgICAgICAgIDogYS54ID4gYi54ID8gIDFcbiAgICAgICAgICAgICA6ICAgICAgICAgICAgICAwXG4gICAgICBjYXNlICdCVCc6XG4gICAgICAgIHJldHVybiBhLnggPiBiLnggPyAtMVxuICAgICAgICAgICAgIDogYS54IDwgYi54ID8gIDFcbiAgICAgICAgICAgICA6ICAgICAgICAgICAgICAwXG4gICAgICBjYXNlICdMUic6XG4gICAgICAgIHJldHVybiBhLnkgPCBiLnkgPyAtMVxuICAgICAgICAgICAgIDogYS55ID4gYi55ID8gIDFcbiAgICAgICAgICAgICA6ICAgICAgICAgICAgICAwXG4gICAgICBjYXNlICdSTCc6XG4gICAgICAgIHJldHVybiBhLnkgPiBiLnkgPyAtMVxuICAgICAgICAgICAgIDogYS55IDwgYi55ID8gIDFcbiAgICAgICAgICAgICA6ICAgICAgICAgICAgICAwXG4gICAgfVxuXG4gIH1cblxuICBmdW5jdGlvbiBjb3VudF9leGl0cyhwYXRod2F5cywgc291cmNlX2lkKXtcbiAgICB2YXIgY291bnQgPSAwLCBmaW5kcyA9IFtdXG5cbiAgICBwYXRod2F5cy5mb3JFYWNoKGZ1bmN0aW9uKHAsIHBpKXtcbiAgICAgIHAuZm9yRWFjaChmdW5jdGlvbih3LCB3aSl7XG4gICAgICAgIGlmICggdy5zb3VyY2VzLmhhcyhzb3VyY2VfaWQpICkge1xuICAgICAgICAgIGZpbmRzLnB1c2goW3BpLCB3aSwgd10pXG4gICAgICAgICAgY291bnQrK1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pXG4gICAgcmV0dXJuIGNvdW50XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG91dGdyYXBoLCBkaWFncmFtKXtcbiAgICB2YXIgZyA9IG91dGdyYXBoLmdyYXBoKClcbiAgICB2YXIgcmFua0RpciA9IGcucmFua0RpclxuICAgIHZhciB2ZXJ0aWNhbCA9IHJhbmtEaXIgPT0gJ1RCJyB8fCByYW5rRGlyID09ICdCVCdcbiAgICB2YXIgcmV2ZXJzZWQgPSByYW5rRGlyID09ICdCVCcgfHwgcmFua0RpciA9PSAnUkwnXG4gICAgdmFyIHJhbmtTZXAgPSBkaWFncmFtLmdyYXBoLmNvbmZpZy5yYW5rU2VwXG4gICAgdmFyIHJhbmtfc29ydGVyID0gc29ydF9ub2Rlc19pbl9yYW5rLmJpbmQobnVsbCwgcmFua0RpcilcbiAgICB2YXIgbGV2ZWxfZGlyID0gdmVydGljYWwgPyAnd2lkdGgnIDogJ2hlaWdodCdcbiAgICB2YXIgcmFua3NfcG9zaXRpb25zID0gW11cbiAgICB2YXIgcmFua3MgPSBbXVxuICAgIHZhciBub3JtX3JhbmtfZGltID0gZ2V0X3JhbmtfZGltLmJpbmQobnVsbCwgZGlhZ3JhbS5jb25maWcucmFua19kZXRlY3Rpb25fZXJyb3JfbWFyZ2luLCB2ZXJ0aWNhbCA/ICd5JyA6ICd4JyApXG5cbiAgICBmdW5jdGlvbiBnZXRfanVuY3Rpb24ocGF0aCwgbGV2ZWwpe1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogdmVydGljYWwgPyBsZXZlbCA6IHBhdGhcbiAgICAgICwgeTogdmVydGljYWwgPyBwYXRoIDogbGV2ZWxcbiAgICAgIH1cbiAgICB9XG5cbiAgICBvdXRncmFwaC5lYWNoTm9kZShmdW5jdGlvbihpZCwgbm9kZSl7XG4gICAgICB2YXIgcmRpbSA9IG5vcm1fcmFua19kaW0obm9kZSlcbiAgICAgIGlmICggcmFua3NfcG9zaXRpb25zLmluZGV4T2YocmRpbSkgPT0gLTEgKSB7XG4gICAgICAgIHJhbmtzX3Bvc2l0aW9ucy5wdXNoKHJkaW0pXG4gICAgICAgIHJhbmtzX3Bvc2l0aW9ucy5zb3J0KG51bV9jb21wKVxuICAgICAgfVxuICAgICAgbm9kZS5yZGltID0gcmRpbVxuICAgIH0pXG4gICAgaWYgKCByZXZlcnNlZCApIHtcbiAgICAgIHJhbmtzX3Bvc2l0aW9ucy5yZXZlcnNlKClcbiAgICB9XG4gICAgb3V0Z3JhcGguZWFjaE5vZGUoZnVuY3Rpb24oaWQsIG5vZGUpe1xuICAgICAgdmFyIHIgPSByYW5rc19wb3NpdGlvbnMuaW5kZXhPZihub2RlLnJkaW0pXG4gICAgICBub2RlLnRydWVfcmFuayA9IHJcbiAgICAgIGlmICggcmFua3Nbcl0gPT0gbnVsbCApIHJhbmtzW3JdID0gW11cbiAgICAgIHJhbmtzW3JdLnB1c2gobm9kZSlcbiAgICB9KVxuXG4gICAgcmFua3MuZm9yRWFjaChmdW5jdGlvbihyLCBpKXtcbiAgICAgIHJhbmtzW2ldLnNvcnQocmFua19zb3J0ZXIpXG4gICAgfSlcblxuICAgIHZhciBlZGdlc19pbl9yYW5rcyA9IFtdXG4gICAgdmFyIHBhdGh3YXlfY291bnQgPSByYW5rcy5sZW5ndGggKyAxXG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgcGF0aHdheV9jb3VudDsgaSsrICkge1xuICAgICAgZWRnZXNfaW5fcmFua3NbaV0gPSBTZXQubWFrZSgpXG4gICAgfVxuXG4gICAgb3V0Z3JhcGguZWFjaE5vZGUoZnVuY3Rpb24oaWQsIG5vZGUpe1xuXG4gICAgICB2YXIgbm9kZV9yYW5rID0gbm9kZS50cnVlX3JhbmtcbiAgICAgIG91dGdyYXBoLm91dEVkZ2VzKGlkKS5mb3JFYWNoKGZ1bmN0aW9uKG91dF9lZGdlX2lkKXtcbiAgICAgICAgZWRnZXNfaW5fcmFua3Nbbm9kZV9yYW5rICsgMV0uYWRkKG91dF9lZGdlX2lkKVxuICAgICAgfSlcblxuICAgIH0pXG5cbiAgICB2YXIgbGFuZXMgPSBbXVxuICAgIGVkZ2VzX2luX3JhbmtzLmZvckVhY2goZnVuY3Rpb24ocmFuaywgaWR4KXtcbiAgICAgIGxhbmVzW2lkeF0gPSBQYXRod2F5cy5tYWtlKClcbiAgICAgIHJhbmsuZm9yRWFjaChmdW5jdGlvbihlZGdlX2lkKXtcbiAgICAgICAgbGFuZXNbaWR4XS5hZGQoIG91dGdyYXBoLnNvdXJjZShlZGdlX2lkKVxuICAgICAgICAgICAgICAgICAgICAsIGVkZ2VfaWRcbiAgICAgICAgICAgICAgICAgICAgLCBvdXRncmFwaC50YXJnZXQoZWRnZV9pZCkpXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICBvdXRncmFwaC5lYWNoTm9kZShmdW5jdGlvbihpZCwgbm9kZSl7XG4gICAgICB2YXIgZXhpdHMgPSBkaXZpZGVfc2lkZShzaWRlX2Zyb21fZGlyZWN0aW9uKG5vZGUsIHJhbmtEaXJbMV0pLCBjb3VudF9leGl0cyhsYW5lcywgaWQpICsgMSlcbiAgICAgIG5vZGUuZXhpdHMgPSBleGl0c1xuICAgICAgbm9kZS5lbnRyaWVzID0gZGl2aWRlX3NpZGUoc2lkZV9mcm9tX2RpcmVjdGlvbihub2RlLCByYW5rRGlyWzBdKSwgMilcbiAgICB9KVxuXG4gICAgdmFyIGZza2lwcyA9IFtdXG4gICAgdmFyIGJza2lwcyA9IFtdXG4gICAgdmFyIGVkZ2VzID0gW11cbiAgICB2YXIgc2tpcHNlcCA9IGRpYWdyYW0uY29uZmlnLmVkZ2VXaWR0aFxuICAgIGxhbmVzLmZvckVhY2goZnVuY3Rpb24obGFuZSwgcmFua19ucil7XG4gICAgICB2YXIgcHdzICA9IFtdXG4gICAgICB2YXIgcGF0aHdheXNfY291bnQgPSBsYW5lLnNpemUoKVxuICAgICAgdmFyIHBzZXAgPSByYW5rU2VwIC8gKHBhdGh3YXlzX2NvdW50ICsgMSlcbiAgICAgIGxhbmUuZm9yRWFjaChmdW5jdGlvbihwYXRod2F5LCBwd19pZHgpe1xuICAgICAgICB2YXIgdHIgPSBwc2VwICogKHB3X2lkeCArIDEpXG4gICAgICAgIGlmICggcmV2ZXJzZWQgKSB0ciAgPSB0ciAqIC0xXG4gICAgICAgIHZhciB0cl9leGl0ID0gdHJhbnNsYXRlLmJpbmQobnVsbCwgdmVydGljYWwgPyBbMCwgdHJdIDogW3RyLCAwXSlcbiAgICAgICAgdmFyIHRyX2VudHJ5ID0gdHJhbnNsYXRlLmJpbmQobnVsbCwgdmVydGljYWwgPyBbMCwgdHIgLSAocmV2ZXJzZWQgPyAtMSAqIHJhbmtTZXAgOiByYW5rU2VwKV0gOiBbdHIgLSAocmV2ZXJzZWQgPyAtMSAqIHJhbmtTZXAgOiByYW5rU2VwKSwgMF0pXG4gICAgICAgIHZhciBwdyA9IFtdXG4gICAgICAgIHBhdGh3YXkuc291cmNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNvdXJjZV9pZCl7XG4gICAgICAgICAgdmFyIHNvdXJjZSA9IG91dGdyYXBoLm5vZGUoc291cmNlX2lkKVxuICAgICAgICAgIGlmICggc291cmNlLnRydWVfcmFuayA9PSByYW5rX25yIC0gMSApIHtcbiAgICAgICAgICAgIHNvdXJjZS5zcHdpID0gcHdfaWR4XG4gICAgICAgICAgICB2YXIganVuY3Rpb25zID0gc291cmNlLmV4aXRzLm1hcChmdW5jdGlvbihleGl0LCBpZHgpe1xuICAgICAgICAgICAgICB2YXIgcCA9IHRyX2V4aXQoZXhpdClcbiAgICAgICAgICAgICAgcC5ub2RlID0gZXhpdFxuICAgICAgICAgICAgICBzb3VyY2UuZXhpdHNbaWR4XS5qdW5jdGlvbiA9IHBcbiAgICAgICAgICAgICAgcmV0dXJuIHBcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBwdyA9IHB3LmNvbmNhdChqdW5jdGlvbnMpXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBwYXRod2F5LnRhcmdldHMuZm9yRWFjaChmdW5jdGlvbih0YXJnZXRfaWQpe1xuICAgICAgICAgIHZhciB0YXJnZXQgPSBvdXRncmFwaC5ub2RlKHRhcmdldF9pZClcbiAgICAgICAgICBpZiAoIHRhcmdldC50cnVlX3JhbmsgPT0gcmFua19uciApIHtcbiAgICAgICAgICAgIHRhcmdldC50cHdpID0gcHdfaWR4XG4gICAgICAgICAgICB2YXIganVuY3Rpb25zID0gdGFyZ2V0LmVudHJpZXMubWFwKGZ1bmN0aW9uKGVudHJ5LCBpZHgpe1xuICAgICAgICAgICAgICB2YXIgcCA9IHRyX2VudHJ5KGVudHJ5KVxuICAgICAgICAgICAgICB2YXIgdmVjdG9yID0gW2VudHJ5LnggLSBwLngsIGVudHJ5LnkgLSBwLnldXG4gICAgICAgICAgICAgIHZhciBzID0gVi5zY2FsZSh2ZWN0b3IsIC0xLjIgKiBkaWFncmFtLmNvbmZpZy5lZGdlV2lkdGggLyBWLm1hZ25pdHVkZSh2ZWN0b3IpKVxuICAgICAgICAgICAgICBwLmN1dCA9IHRyYW5zbGF0ZShzLCBlbnRyeSlcbiAgICAgICAgICAgICAgcC5ub2RlID0gZW50cnlcbiAgICAgICAgICAgICAgcC5lbnRyeSA9IHRydWVcbiAgICAgICAgICAgICAgdGFyZ2V0LmVudHJpZXNbaWR4XS5qdW5jdGlvbiA9IHBcbiAgICAgICAgICAgICAgcmV0dXJuIHBcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBwdyA9IHB3LmNvbmNhdChqdW5jdGlvbnMpXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBwd3NbcHdfaWR4XSA9IHB3XG4gICAgICB9KVxuICAgICAgZWRnZXNbcmFua19ucl0gPSBwd3NcbiAgICB9KVxuXG4gICAgZWRnZXMuc2tpcHMgPSBbXVxuICAgIGxhbmVzLmZvckVhY2goZnVuY3Rpb24obGFuZSwgcmFua19ucil7XG4gICAgICBsYW5lLmZvckVhY2goZnVuY3Rpb24ocGF0aHdheSwgcHdfaWR4KXtcbiAgICAgICAgcGF0aHdheS5lZGdlcy5mb3JFYWNoKGZ1bmN0aW9uKGVkZ2VfaWQpe1xuICAgICAgICAgIHZhciB0aWQgPSBvdXRncmFwaC50YXJnZXQoZWRnZV9pZClcbiAgICAgICAgICB2YXIgdGFyZ2V0ID0gb3V0Z3JhcGgubm9kZSh0aWQpXG4gICAgICAgICAgdmFyIHRhcmdldF9yYW5rID0gdGFyZ2V0LnRydWVfcmFua1xuICAgICAgICAgIHZhciBzaWQgPSBvdXRncmFwaC5zb3VyY2UoZWRnZV9pZClcbiAgICAgICAgICB2YXIgc291cmNlID0gb3V0Z3JhcGgubm9kZShzaWQpXG4gICAgICAgICAgdmFyIHNvdXJjZV9yYW5rID0gc291cmNlLnRydWVfcmFua1xuICAgICAgICAgIHZhciByZCA9IHRhcmdldF9yYW5rIC0gc291cmNlX3JhbmtcbiAgICAgICAgICBpZiAoIHJkID4gMSAmJiBmc2tpcHMuaW5kZXhPZihwYXRod2F5KSA9PSAtMSApIHtcbiAgICAgICAgICAgIGZza2lwcy5wdXNoKHBhdGh3YXkpXG4gICAgICAgICAgICB2YXIgbGV2ZWxfYW1vdW50ID0gZnNraXBzLmxlbmd0aCAqIHNraXBzZXBcbiAgICAgICAgICAgIHZhciBsZXZlbCA9IHJldmVyc2VkID8gMCAtIGxldmVsX2Ftb3VudCA6IGdbbGV2ZWxfZGlyXSArIGxldmVsX2Ftb3VudFxuICAgICAgICAgICAgdmFyIHNvdXJjZV9qdW5jdGlvbiA9IGdldF9qdW5jdGlvbihzb3VyY2UuZXhpdHNbMF0uanVuY3Rpb25bdmVydGljYWwgPyAneScgOiAneCddLCBsZXZlbCApXG4gICAgICAgICAgICBlZGdlc1tzb3VyY2UudHJ1ZV9yYW5rICsgMV1bc291cmNlLnNwd2ldLnB1c2goc291cmNlX2p1bmN0aW9uKVxuICAgICAgICAgICAgdmFyIHRhcmdldF9qdW5jdGlvbiA9IGdldF9qdW5jdGlvbih0YXJnZXQuZW50cmllc1swXS5qdW5jdGlvblt2ZXJ0aWNhbCA/ICd5JyA6ICd4J10sIGxldmVsIClcbiAgICAgICAgICAgIGVkZ2VzW3RhcmdldC50cnVlX3JhbmtdW3RhcmdldC50cHdpXS5wdXNoKHRhcmdldF9qdW5jdGlvbilcbiAgICAgICAgICAgIGVkZ2VzLnNraXBzLnB1c2goW3NvdXJjZV9qdW5jdGlvbiwgdGFyZ2V0X2p1bmN0aW9uXSlcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCByZCA8IDAgJiYgYnNraXBzLmluZGV4T2YocGF0aHdheSkgPT0gLTEgKSB7XG4gICAgICAgICAgICBic2tpcHMucHVzaChwYXRod2F5KVxuICAgICAgICAgICAgdmFyIGxldmVsX2Ftb3VudCA9IGJza2lwcy5sZW5ndGggKiBza2lwc2VwXG4gICAgICAgICAgICB2YXIgbGV2ZWwgPSByZXZlcnNlZCA/IGdbbGV2ZWxfZGlyXSArIGxldmVsX2Ftb3VudCA6IDAgLSBsZXZlbF9hbW91bnRcbiAgICAgICAgICAgIHZhciBzb3VyY2VfanVuY3Rpb24gPSBnZXRfanVuY3Rpb24oc291cmNlLmV4aXRzWzBdLmp1bmN0aW9uW3ZlcnRpY2FsID8gJ3knIDogJ3gnXSwgbGV2ZWwgKVxuICAgICAgICAgICAgZWRnZXNbc291cmNlLnRydWVfcmFuayArIDFdW3NvdXJjZS5zcHdpXS5wdXNoKHNvdXJjZV9qdW5jdGlvbilcbiAgICAgICAgICAgIHZhciB0YXJnZXRfanVuY3Rpb24gPSBnZXRfanVuY3Rpb24odGFyZ2V0LmVudHJpZXNbMF0uanVuY3Rpb25bdmVydGljYWwgPyAneScgOiAneCddLCBsZXZlbCApXG4gICAgICAgICAgICBlZGdlc1t0YXJnZXQudHJ1ZV9yYW5rXVt0YXJnZXQudHB3aV0ucHVzaCh0YXJnZXRfanVuY3Rpb24pXG4gICAgICAgICAgICBlZGdlcy5za2lwcy5wdXNoKFtzb3VyY2VfanVuY3Rpb24sIHRhcmdldF9qdW5jdGlvbl0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICB9KVxuICAgIGxhbmVzLmZvckVhY2goZnVuY3Rpb24obGFuZSwgcmFua19ucil7XG4gICAgICBsYW5lLmZvckVhY2goZnVuY3Rpb24ocGF0aHdheSwgcHdfaWR4KXtcbiAgICAgICAgZWRnZXNbcmFua19ucl1bcHdfaWR4XS5zb3J0KHJhbmtfc29ydGVyKVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgZWRnZXMuZ3Jvd3RoID0gKGZza2lwcy5sZW5ndGggKyBic2tpcHMubGVuZ3RoKSAqIHNraXBzZXBcblxuXG4gICAgcmV0dXJuIGVkZ2VzXG4gIH1cblxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgdmFyIFYgPSByZXF1aXJlKCcuL3ZlY3RvcnMuanMnKVxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc2VnMSwgc2VnMil7XG4gICAgdmFyIHAgPSBbc2VnMS54MSwgc2VnMS55MV1cbiAgICB2YXIgciA9IFYuc3VidHJhY3QoW3NlZzEueDIsIHNlZzEueTJdLCBwKVxuICAgIHZhciBxID0gW3NlZzIueDEsIHNlZzIueTFdXG4gICAgdmFyIHMgPSBWLnN1YnRyYWN0KFtzZWcyLngyLCBzZWcyLnkyXSwgcSlcblxuICAgIHZhciByeHMgPSBWLmNyb3NzKHIsIHMpXG4gICAgaWYgKCByeHMgPT0gMCApIHJldHVybiBmYWxzZVxuXG4gICAgdmFyIHFfcCA9IFYuc3VidHJhY3QocSxwKVxuICAgIHZhciByeHMgPSBWLmNyb3NzKHIsIHMpXG4gICAgdmFyIHQgPSBWLmNyb3NzKHFfcCwgcykgLyByeHNcbiAgICBpZiAoIHQgPCAwIHx8IHQgPiAxICkgcmV0dXJuIGZhbHNlXG4gICAgdmFyIHUgPSBWLmNyb3NzKHFfcCwgcikgLyByeHNcbiAgICBpZiAoIHUgPCAwIHx8IHUgPiAxICkgcmV0dXJuIGZhbHNlXG5cbiAgICAvLyB2YXIgejEgPSBWLmFkZChwLCBWLnNjYWxlKHIsIHQpKVxuICAgIC8vIHZhciB6MiA9IFYuYWRkKHEsIFYuc2NhbGUocywgdSkpXG5cbiAgICByZXR1cm4gVi5hZGQocCwgVi5zY2FsZShyLCB0KSlcbiAgfVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuXG4vLyAgZnVuY3Rpb24gZHJhd19pdGVtKGl0ZW0pe1xuLy8gICAgcmV0dXJuIGl0ZW0uZyA9IGl0ZW0uZGlhZ3JhbS5kcmF3KGl0ZW0pXG4vLyAgfVxuXG4gIHZhciBJdGVtID0gdmlyYWwuZXh0ZW5kKHtcbiAgICBpbml0OiBmdW5jdGlvbihkaWFncmFtLCBpZCwgdmFsdWUsIGludmFsdWVzKXtcbiAgICAgIHRoaXMuZGlhZ3JhbSA9IGRpYWdyYW1cbiAgICAgIHRoaXMuaWQgPSBpZFxuICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlXG4gICAgICB0aGlzLmlucHV0ID0gaW52YWx1ZXNcblxuXG5cbi8vICAgICAgY29uc29sZS5sb2coJ28nLCB2YWx1ZSlcbi8vICAgICAgY29uc29sZS5sb2coJ2knLCBpbnZhbHVlcylcbiAgICB9XG4vLyAgICAsIGRyYXc6IGVuc2xhdmUoZHJhd19pdGVtKVxuICB9KVxuXG4gIG1vZHVsZS5leHBvcnRzID0gSXRlbVxuXG59KClcblxuIiwidm9pZCBmdW5jdGlvbigpe1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHRyYW5zbGF0ZSh2ZWN0b3IsIHBvaW50KXtcbiAgICByZXR1cm4geyB4OiBwb2ludC54ICsgdmVjdG9yWzBdLCB5OiBwb2ludC55ICsgdmVjdG9yWzFdIH1cbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgZnVuY3Rpb24gcHl0aChhLCBiKXtcbiAgICByZXR1cm4gTWF0aC5zcXJ0KE1hdGgucG93KGEsMiksIE1hdGgucG93KGIsMikpXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBjcm9zczogZnVuY3Rpb24gY3Jvc3Modiwgdyl7XG4gICAgICByZXR1cm4gdlswXSAqIHdbMV0gLSB2WzFdICogd1swXVxuICAgIH1cblxuICAsIGFkZDogIGZ1bmN0aW9uIGFkZCh2LCB3KXtcbiAgICAgIHJldHVybiBbdlswXSArIHdbMF0sIHZbMV0gKyB3WzFdXVxuICAgIH1cblxuICAsIHN1YnRyYWN0OiAgZnVuY3Rpb24gc3VidHJhY3Qodiwgdyl7XG4gICAgICByZXR1cm4gW3ZbMF0gLSB3WzBdLCB2WzFdIC0gd1sxXV1cbiAgICB9XG5cbiAgLCBzY2FsZTogIGZ1bmN0aW9uIHNjYWxlKHYsIHMpe1xuICAgICAgcmV0dXJuIFt2WzBdICogcywgdlsxXSAqIHNdXG4gICAgfVxuXG4gICwgZXE6ICBmdW5jdGlvbiBlcSh2LCB3KXtcbiAgICAgIHJldHVybiB2WzBdID09IHdbMF0gJiYgIHZbMV0gPT0gd1sxXVxuICAgIH1cbiAgLCBtYWduaXR1ZGU6IGZ1bmN0aW9uIG1hZ25pdHVkZSh2KXtcbiAgICAgIHJldHVybiBweXRoKHZbMF0sIHZbMV0pXG4gICAgfVxuXG4gIH1cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuICB2YXIgTm9kZSA9IHJlcXVpcmUoJy4vbm9kZS5qcycpXG4gIHZhciB1aWQgPSByZXF1aXJlKCcuLi91dGlsL3VuaXF1ZV9pZC5qcycpXG5cbiAgdmFyIEVkZ2UgPSBOb2RlLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oZ3JhcGgsIHNvdXJjZSwgdGFyZ2V0LCB0cmFuc2Zvcm0sIGF0dHJzKXtcbiAgICAgIHRoaXMuaWQgPSB1aWQoKVxuICAgICAgdGhpcy50eXBlID0gJ2VkZ2UnXG4gICAgICB0aGlzLmdyYXBoID0gZ3JhcGhcbiAgICAgIHRoaXMuc291cmNlID0gc291cmNlXG4gICAgICB0aGlzLnRhcmdldCA9IHRhcmdldFxuICAgIH1cbiAgfSlcblxuICBtb2R1bGUuZXhwb3J0cyA9IEVkZ2Vcbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgdmlyYWwgPSByZXF1aXJlKCd2aXJhbCcpXG4gIHZhciBlbnNsYXZlID0gcmVxdWlyZSgnZW5zbGF2ZScpXG4gIHZhciBkYWdyZSA9IHJlcXVpcmUoJ2RhZ3JlJylcbiAgdmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpXG4gIHZhciB1aWQgPSByZXF1aXJlKCcuLi91dGlsL3VuaXF1ZV9pZC5qcycpXG4gIHZhciBOb2RlID0gcmVxdWlyZSgnLi9ub2RlLmpzJylcbiAgdmFyIEVkZ2UgPSByZXF1aXJlKCcuL2VkZ2UuanMnKVxuXG4gIGZ1bmN0aW9uIGFkZF9ub2RlKGdyYXBoLCBjbGFzc25hbWUsIHRyYW5zZm9ybSwgY29udGVudCwgcHJlZlJhbmspe1xuICAgIHZhciBub2RlID0gTm9kZS5tYWtlKGdyYXBoLCB0cmFuc2Zvcm0sIHtcbiAgICAgICAgY2xhc3NuYW1lOiBjbGFzc25hbWVcbiAgICAgICwgY29udGVudDogY29udGVudFxuICAgICAgLCByYW5rOiBwcmVmUmFua1xuICAgIH0pXG5cbiAgICBncmFwaC5pbmdyYXBoLmFkZE5vZGUobm9kZS5pZCwgbm9kZSlcbiAgICByZXR1cm4gbm9kZVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlX25vZGUoZ3JhcGgsIG5vZGVfaWQpe1xuICAgIHZhciBnID0gZ3JhcGguaW5ncmFwaFxuICAgIGlmICggZy5oYXNOb2RlKG5vZGVfaWQpICkge1xuICAgICAgY2hhci5kZWxOb2RlKG5vZGVfaWQpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbm5lY3QoZ3JhcGgsIGNsYXNzbmFtZSwgc291cmNlLCB0YXJnZXQsIHRyYW5zZm9ybSwgY29udGVudCl7XG4gICAgdmFyIGVkZ2UgPSBFZGdlLm1ha2UoZ3JhcGgsIHNvdXJjZSwgdGFyZ2V0KVxuICAgIGdyYXBoLmluZ3JhcGguYWRkRWRnZShlZGdlLmlkLCBzb3VyY2UuaWQsIHRhcmdldC5pZCwgZWRnZSlcbiAgICByZXR1cm4gZWRnZVxuICB9XG5cbiAgZnVuY3Rpb24gZGlzY29ubmVjdChncmFwaCwgc291cmNlLCB0YXJnZXQpe1xuICAgIHZhciBnID0gZ3JhcGguaW5ncmFwaFxuICAgIHZhciBlZGdlX2lkID0gZy5vdXRFZGdlcyhzb3VyY2UuaWQsIHRhcmdldC5pZClcbiAgICBpZiAoIGcuaGFzRWRnZShlZGdlX2lkKSApIHtcbiAgICAgIGcuZGVsRWRnZShlZGdlX2lkKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB2aXJhbC5leHRlbmQobmV3IGV2ZW50cy5FdmVudEVtaXR0ZXIpLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oY2Znb2JqKXtcbiAgICAgIHRoaXMuY29uZmlnID0gY2Znb2JqXG4gICAgICB0aGlzLmluZ3JhcGggPSAgbmV3IGRhZ3JlLkRpZ3JhcGgoKVxuICAgIH1cbiAgLCBhZGRfbm9kZTogZW5zbGF2ZShhZGRfbm9kZSlcbiAgLCBkZWxfbm9kZTogZW5zbGF2ZShyZW1vdmVfbm9kZSlcbiAgLCBjb25uZWN0OiBlbnNsYXZlKGNvbm5lY3QpXG4gICwgZGlzY29ubmVjdDogZW5zbGF2ZShkaXNjb25uZWN0KVxuICB9KVxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuICB2YXIgdWlkID0gcmVxdWlyZSgnLi4vdXRpbC91bmlxdWVfaWQuanMnKVxuXG4gIGZ1bmN0aW9uIHNldF9hdHRycyhub2RlLCBhdHRycyl7XG4gICAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goZnVuY3Rpb24oa2V5KXtcbiAgICAgIG5vZGVba2V5XSA9IGF0dHJzW2tleV1cbiAgICB9KVxuICAgIG5vZGUuZ3JhcGguZW1pdChub2RlLnR5cGUgKyAnX2F0dHJzJywgYXR0cnMpXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfYXR0cihub2RlLCBhdHRyLCB2YWx1ZSl7XG4gICAgbm9kZVthdHRyXSA9IHZhbHVlXG4gICAgbm9kZS5ncmFwaC5lbWl0KG5vZGUudHlwZSArICdfYXR0cicsIGF0dHIsIHZhbHVlKVxuICB9XG5cbiAgZnVuY3Rpb24gYWRkX2F0dHIobm9kZSwgc2VsZWN0b3IsIG5hbWUsIHZhbHVlKXtcbiAgICBub2RlLmNvbnRlbnRbc2VsZWN0b3JdID0gbm9kZS5jb250ZW50W3NlbGVjdG9yXSB8fCB7fVxuICAgIG5vZGUuY29udGVudFtzZWxlY3Rvcl1bbmFtZV0gPSB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gYWRkX2F0dHJzKG5vZGUsIHNlbGVjdG9yLCBhdHRycyl7XG4gICAgbm9kZS5jb250ZW50W3NlbGVjdG9yXSA9IHZhbHVlXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHZpcmFsLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oZ3JhcGgsIHRyYW5zZm9ybSwgYXR0cnMpe1xuICAgICAgdGhpcy5pZCA9IHVpZCgpXG4gICAgICB0aGlzLnR5cGUgPSAndmVydGV4J1xuICAgICAgdGhpcy5ncmFwaCA9IGdyYXBoXG4gICAgICB0aGlzLnRyYW5zZm9ybSA9IHRyYW5zZm9ybS5iaW5kKG51bGwsIHRoaXMpXG4gICAgICBzZXRfYXR0cnModGhpcywgYXR0cnMpXG4gICAgfVxuICAsIGF0dHJzOiBlbnNsYXZlKHNldF9hdHRycylcbiAgLCBhdHRyOiBlbnNsYXZlKHNldF9hdHRyKVxuICAsIGFkZF9hdHRyOiBlbnNsYXZlKGFkZF9hdHRyKVxuICAsIGFkZF9hdHRyczogZW5zbGF2ZShhZGRfYXR0cnMpXG4gIH0pXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuLy8gIHZhciBTbmFwID0gcmVxdWlyZSgnc25hcHN2ZycpXG4vLyAgICBpbml0OiBmdW5jdGlvbigpe1xuLy8gICAgICB0aGlzLnN2Z2VsID0gU25hcC5hcHBseShTbmFwLCBhcmd1bWVudHMpXG4vLyAgICB9XG5cbiAgaWYgKCFTdHJpbmcucHJvdG90eXBlLnRyaW0pIHtcbiAgICBTdHJpbmcucHJvdG90eXBlLnRyaW0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbiAgICB9XG4gIH1cblxuICB2YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuL3V0aWwvZGVmYXVsdHMuanMnKVxuICB2YXIgR3JhcGggPSByZXF1aXJlKCcuL2dyYXBoL2dyYXBoLmpzJylcbiAgdmFyIERpYWdyYW0gPSByZXF1aXJlKCcuL2RpYWdyYW0vZGlhZ3JhbS5qcycpXG5cblxuICAvKipcbiAgKiBTZXQgZGVmYXVsdCBjb25maWd1cmF0aW9uXG4gICogQHBhcmFtICAgICAge09iamVjdH0gb3B0aW9uc1xuICAqIEByZXR1cm4gICAgIHtPYmplY3R9IG9wdGlvbnMgZmlsbGVkIHdpdGggZGVmYXVsdHNcbiAgKi9cbiAgZnVuY3Rpb24gY29uZmlnKGNmZ29iail7XG4gICAgdmFyIGRlZmF1bHRfY2ZnID0ge1xuICAgICAgd2lkdGg6IHdpbmRvdy5pbm5lcldpZHRoXG4gICAgLCBoZWlnaHQ6IHdpbmRvdy5pbm5lckhlaWdodFxuICAgICwgZm9udF9zaXplOiAyMVxuICAgICwgbGluZV9oZWlnaHQ6IDI2IC8vIGZvciBmb250LXNpemUgMjFcbiAgICB9XG4gICAgcmV0dXJuIGNmZ29iaiA9PSBudWxsID8gZGVmYXVsdF9jZmdcbiAgICAgICAgIDogICAgICAgICAgICAgICAgICBkZWZhdWx0cyhjZmdvYmosIGRlZmF1bHRfY2ZnKVxuICB9XG5cbiAgLyoqXG4gICogQ3JlYXRlIGEgbmV3IGdyYXBoIG9iamVjdCB0byBzdG9yZSBkaWFncmFtIGRhdGEgaW4gaXRcbiAgKiBAcmV0dXJuICAgICB7T2JqZWN0fSAgIGdyYXBoIG9iamVjdFxuICAqL1xuICBmdW5jdGlvbiBncmFwaChjZmdvYmope1xuICAgIHJldHVybiBHcmFwaC5tYWtlKGNmZ29iailcbiAgfVxuXG4gIC8qKlxuICAqIEluaXRpYWxpemUgZGlhZ3JhbSB3aXRoIG9wdGlvbnMgYW5kIGdyYXBoIG9iamVjdFxuICAqIGFuZCByZWdpc3RlciBldmVudCBoYW5kbGVyc1xuICAqIEBwYXJhbSAgICAgIHtPYmplY3R9ICAgb3B0aW9uc1xuICAqIEBwYXJhbSAgICAgIHtPYmplY3R9ICAgZ3JhcGggb2JqZWN0XG4gICogQHJldHVybiAgICAge09iamVjdH0gICBkaWFncmFtXG4gICovXG4gIGZ1bmN0aW9uIGRpYWdyYW0oY2Znb2JqLCBncmFwaCl7XG4gICAgcmV0dXJuIERpYWdyYW0ubWFrZShjZmdvYmosIGdyYXBoKVxuICB9XG5cblxuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBjb25maWc6IGNvbmZpZ1xuICAsIGdyYXBoOiBncmFwaFxuICAsIGRpYWdyYW06IGRpYWdyYW1cbiAgfVxuXG59KClcbiIsIi8qXG5Db3B5cmlnaHQgKGMpIDIwMTItMjAxMyBDaHJpcyBQZXR0aXR0XG5cblBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbm9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbmluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbnRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbmNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcblxuVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbmFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG5JTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbkZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbk9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cblRIRSBTT0ZUV0FSRS5cbiovXG5leHBvcnRzLkRpZ3JhcGggPSByZXF1aXJlKFwiZ3JhcGhsaWJcIikuRGlncmFwaDtcbmV4cG9ydHMuR3JhcGggPSByZXF1aXJlKFwiZ3JhcGhsaWJcIikuR3JhcGg7XG5leHBvcnRzLmxheW91dCA9IHJlcXVpcmUoXCIuL2xpYi9sYXlvdXRcIik7XG5leHBvcnRzLnZlcnNpb24gPSByZXF1aXJlKFwiLi9saWIvdmVyc2lvblwiKTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgcmFuayA9IHJlcXVpcmUoJy4vcmFuaycpLFxuICAgIG9yZGVyID0gcmVxdWlyZSgnLi9vcmRlcicpLFxuICAgIENHcmFwaCA9IHJlcXVpcmUoJ2dyYXBobGliJykuQ0dyYXBoLFxuICAgIENEaWdyYXBoID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5DRGlncmFwaDtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgLy8gRXh0ZXJuYWwgY29uZmlndXJhdGlvblxuICB2YXIgY29uZmlnID0ge1xuICAgIC8vIEhvdyBtdWNoIGRlYnVnIGluZm9ybWF0aW9uIHRvIGluY2x1ZGU/XG4gICAgZGVidWdMZXZlbDogMCxcbiAgICAvLyBNYXggbnVtYmVyIG9mIHN3ZWVwcyB0byBwZXJmb3JtIGluIG9yZGVyIHBoYXNlXG4gICAgb3JkZXJNYXhTd2VlcHM6IG9yZGVyLkRFRkFVTFRfTUFYX1NXRUVQUyxcbiAgICAvLyBVc2UgbmV0d29yayBzaW1wbGV4IGFsZ29yaXRobSBpbiByYW5raW5nXG4gICAgcmFua1NpbXBsZXg6IGZhbHNlLFxuICAgIC8vIFJhbmsgZGlyZWN0aW9uLiBWYWxpZCB2YWx1ZXMgYXJlIChUQiwgTFIpXG4gICAgcmFua0RpcjogJ1RCJ1xuICB9O1xuXG4gIC8vIFBoYXNlIGZ1bmN0aW9uc1xuICB2YXIgcG9zaXRpb24gPSByZXF1aXJlKCcuL3Bvc2l0aW9uJykoKTtcblxuICAvLyBUaGlzIGxheW91dCBvYmplY3RcbiAgdmFyIHNlbGYgPSB7fTtcblxuICBzZWxmLm9yZGVySXRlcnMgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnb3JkZXJNYXhTd2VlcHMnKTtcblxuICBzZWxmLnJhbmtTaW1wbGV4ID0gdXRpbC5wcm9wZXJ0eUFjY2Vzc29yKHNlbGYsIGNvbmZpZywgJ3JhbmtTaW1wbGV4Jyk7XG5cbiAgc2VsZi5ub2RlU2VwID0gZGVsZWdhdGVQcm9wZXJ0eShwb3NpdGlvbi5ub2RlU2VwKTtcbiAgc2VsZi5lZGdlU2VwID0gZGVsZWdhdGVQcm9wZXJ0eShwb3NpdGlvbi5lZGdlU2VwKTtcbiAgc2VsZi51bml2ZXJzYWxTZXAgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLnVuaXZlcnNhbFNlcCk7XG4gIHNlbGYucmFua1NlcCA9IGRlbGVnYXRlUHJvcGVydHkocG9zaXRpb24ucmFua1NlcCk7XG4gIHNlbGYucmFua0RpciA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdyYW5rRGlyJyk7XG4gIHNlbGYuZGVidWdBbGlnbm1lbnQgPSBkZWxlZ2F0ZVByb3BlcnR5KHBvc2l0aW9uLmRlYnVnQWxpZ25tZW50KTtcblxuICBzZWxmLmRlYnVnTGV2ZWwgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnZGVidWdMZXZlbCcsIGZ1bmN0aW9uKHgpIHtcbiAgICB1dGlsLmxvZy5sZXZlbCA9IHg7XG4gICAgcG9zaXRpb24uZGVidWdMZXZlbCh4KTtcbiAgfSk7XG5cbiAgc2VsZi5ydW4gPSB1dGlsLnRpbWUoJ1RvdGFsIGxheW91dCcsIHJ1bik7XG5cbiAgc2VsZi5fbm9ybWFsaXplID0gbm9ybWFsaXplO1xuXG4gIHJldHVybiBzZWxmO1xuXG4gIC8qXG4gICAqIENvbnN0cnVjdHMgYW4gYWRqYWNlbmN5IGdyYXBoIHVzaW5nIHRoZSBub2RlcyBhbmQgZWRnZXMgc3BlY2lmaWVkIHRocm91Z2hcbiAgICogY29uZmlnLiBGb3IgZWFjaCBub2RlIGFuZCBlZGdlIHdlIGFkZCBhIHByb3BlcnR5IGBkYWdyZWAgdGhhdCBjb250YWlucyBhblxuICAgKiBvYmplY3QgdGhhdCB3aWxsIGhvbGQgaW50ZXJtZWRpYXRlIGFuZCBmaW5hbCBsYXlvdXQgaW5mb3JtYXRpb24uIFNvbWUgb2ZcbiAgICogdGhlIGNvbnRlbnRzIGluY2x1ZGU6XG4gICAqXG4gICAqICAxKSBBIGdlbmVyYXRlZCBJRCB0aGF0IHVuaXF1ZWx5IGlkZW50aWZpZXMgdGhlIG9iamVjdC5cbiAgICogIDIpIERpbWVuc2lvbiBpbmZvcm1hdGlvbiBmb3Igbm9kZXMgKGNvcGllZCBmcm9tIHRoZSBzb3VyY2Ugbm9kZSkuXG4gICAqICAzKSBPcHRpb25hbCBkaW1lbnNpb24gaW5mb3JtYXRpb24gZm9yIGVkZ2VzLlxuICAgKlxuICAgKiBBZnRlciB0aGUgYWRqYWNlbmN5IGdyYXBoIGlzIGNvbnN0cnVjdGVkIHRoZSBjb2RlIG5vIGxvbmdlciBuZWVkcyB0byB1c2VcbiAgICogdGhlIG9yaWdpbmFsIG5vZGVzIGFuZCBlZGdlcyBwYXNzZWQgaW4gdmlhIGNvbmZpZy5cbiAgICovXG4gIGZ1bmN0aW9uIGluaXRMYXlvdXRHcmFwaChpbnB1dEdyYXBoKSB7XG4gICAgdmFyIGcgPSBuZXcgQ0RpZ3JhcGgoKTtcblxuICAgIGlucHV0R3JhcGguZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB2YWx1ZSA9IHt9O1xuICAgICAgZy5hZGROb2RlKHUsIHtcbiAgICAgICAgd2lkdGg6IHZhbHVlLndpZHRoLFxuICAgICAgICBoZWlnaHQ6IHZhbHVlLmhlaWdodFxuICAgICAgfSk7XG4gICAgICBpZiAodmFsdWUuaGFzT3duUHJvcGVydHkoJ3JhbmsnKSkge1xuICAgICAgICBnLm5vZGUodSkucHJlZlJhbmsgPSB2YWx1ZS5yYW5rO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gU2V0IHVwIHN1YmdyYXBoc1xuICAgIGlmIChpbnB1dEdyYXBoLnBhcmVudCkge1xuICAgICAgaW5wdXRHcmFwaC5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgICBnLnBhcmVudCh1LCBpbnB1dEdyYXBoLnBhcmVudCh1KSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpbnB1dEdyYXBoLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgdmFsdWUgPSB7fTtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IHtcbiAgICAgICAgZTogZSxcbiAgICAgICAgbWluTGVuOiB2YWx1ZS5taW5MZW4gfHwgMSxcbiAgICAgICAgd2lkdGg6IHZhbHVlLndpZHRoIHx8IDAsXG4gICAgICAgIGhlaWdodDogdmFsdWUuaGVpZ2h0IHx8IDAsXG4gICAgICAgIHBvaW50czogW11cbiAgICAgIH07XG5cbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCBuZXdWYWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBJbml0aWFsIGdyYXBoIGF0dHJpYnV0ZXNcbiAgICB2YXIgZ3JhcGhWYWx1ZSA9IGlucHV0R3JhcGguZ3JhcGgoKSB8fCB7fTtcbiAgICBnLmdyYXBoKHtcbiAgICAgIHJhbmtEaXI6IGdyYXBoVmFsdWUucmFua0RpciB8fCBjb25maWcucmFua0RpcixcbiAgICAgIG9yZGVyUmVzdGFydHM6IGdyYXBoVmFsdWUub3JkZXJSZXN0YXJ0c1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGc7XG4gIH1cblxuICBmdW5jdGlvbiBydW4oaW5wdXRHcmFwaCkge1xuICAgIHZhciByYW5rU2VwID0gc2VsZi5yYW5rU2VwKCk7XG4gICAgdmFyIGc7XG4gICAgdHJ5IHtcbiAgICAgIC8vIEJ1aWxkIGludGVybmFsIGdyYXBoXG4gICAgICBnID0gdXRpbC50aW1lKCdpbml0TGF5b3V0R3JhcGgnLCBpbml0TGF5b3V0R3JhcGgpKGlucHV0R3JhcGgpO1xuXG4gICAgICBpZiAoZy5vcmRlcigpID09PSAwKSB7XG4gICAgICAgIHJldHVybiBnO1xuICAgICAgfVxuXG4gICAgICAvLyBNYWtlIHNwYWNlIGZvciBlZGdlIGxhYmVsc1xuICAgICAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCBzLCB0LCBhKSB7XG4gICAgICAgIGEubWluTGVuICo9IDI7XG4gICAgICB9KTtcbiAgICAgIHNlbGYucmFua1NlcChyYW5rU2VwIC8gMik7XG5cbiAgICAgIC8vIERldGVybWluZSB0aGUgcmFuayBmb3IgZWFjaCBub2RlLiBOb2RlcyB3aXRoIGEgbG93ZXIgcmFuayB3aWxsIGFwcGVhclxuICAgICAgLy8gYWJvdmUgbm9kZXMgb2YgaGlnaGVyIHJhbmsuXG4gICAgICB1dGlsLnRpbWUoJ3JhbmsucnVuJywgcmFuay5ydW4pKGcsIGNvbmZpZy5yYW5rU2ltcGxleCk7XG5cbiAgICAgIC8vIE5vcm1hbGl6ZSB0aGUgZ3JhcGggYnkgZW5zdXJpbmcgdGhhdCBldmVyeSBlZGdlIGlzIHByb3BlciAoZWFjaCBlZGdlIGhhc1xuICAgICAgLy8gYSBsZW5ndGggb2YgMSkuIFdlIGFjaGlldmUgdGhpcyBieSBhZGRpbmcgZHVtbXkgbm9kZXMgdG8gbG9uZyBlZGdlcyxcbiAgICAgIC8vIHRodXMgc2hvcnRlbmluZyB0aGVtLlxuICAgICAgdXRpbC50aW1lKCdub3JtYWxpemUnLCBub3JtYWxpemUpKGcpO1xuXG4gICAgICAvLyBPcmRlciB0aGUgbm9kZXMgc28gdGhhdCBlZGdlIGNyb3NzaW5ncyBhcmUgbWluaW1pemVkLlxuICAgICAgdXRpbC50aW1lKCdvcmRlcicsIG9yZGVyKShnLCBjb25maWcub3JkZXJNYXhTd2VlcHMpO1xuXG4gICAgICAvLyBGaW5kIHRoZSB4IGFuZCB5IGNvb3JkaW5hdGVzIGZvciBldmVyeSBub2RlIGluIHRoZSBncmFwaC5cbiAgICAgIHV0aWwudGltZSgncG9zaXRpb24nLCBwb3NpdGlvbi5ydW4pKGcpO1xuXG4gICAgICAvLyBEZS1ub3JtYWxpemUgdGhlIGdyYXBoIGJ5IHJlbW92aW5nIGR1bW15IG5vZGVzIGFuZCBhdWdtZW50aW5nIHRoZVxuICAgICAgLy8gb3JpZ2luYWwgbG9uZyBlZGdlcyB3aXRoIGNvb3JkaW5hdGUgaW5mb3JtYXRpb24uXG4gICAgICB1dGlsLnRpbWUoJ3VuZG9Ob3JtYWxpemUnLCB1bmRvTm9ybWFsaXplKShnKTtcblxuICAgICAgLy8gUmV2ZXJzZXMgcG9pbnRzIGZvciBlZGdlcyB0aGF0IGFyZSBpbiBhIHJldmVyc2VkIHN0YXRlLlxuICAgICAgdXRpbC50aW1lKCdmaXh1cEVkZ2VQb2ludHMnLCBmaXh1cEVkZ2VQb2ludHMpKGcpO1xuXG4gICAgICAvLyBSZXN0b3JlIGRlbGV0ZSBlZGdlcyBhbmQgcmV2ZXJzZSBlZGdlcyB0aGF0IHdlcmUgcmV2ZXJzZWQgaW4gdGhlIHJhbmtcbiAgICAgIC8vIHBoYXNlLlxuICAgICAgdXRpbC50aW1lKCdyYW5rLnJlc3RvcmVFZGdlcycsIHJhbmsucmVzdG9yZUVkZ2VzKShnKTtcblxuICAgICAgLy8gQ29uc3RydWN0IGZpbmFsIHJlc3VsdCBncmFwaCBhbmQgcmV0dXJuIGl0XG4gICAgICByZXR1cm4gdXRpbC50aW1lKCdjcmVhdGVGaW5hbEdyYXBoJywgY3JlYXRlRmluYWxHcmFwaCkoZywgaW5wdXRHcmFwaC5pc0RpcmVjdGVkKCkpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZWxmLnJhbmtTZXAocmFua1NlcCk7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICogVGhpcyBmdW5jdGlvbiBpcyByZXNwb25zaWJsZSBmb3IgJ25vcm1hbGl6aW5nJyB0aGUgZ3JhcGguIFRoZSBwcm9jZXNzIG9mXG4gICAqIG5vcm1hbGl6YXRpb24gZW5zdXJlcyB0aGF0IG5vIGVkZ2UgaW4gdGhlIGdyYXBoIGhhcyBzcGFucyBtb3JlIHRoYW4gb25lXG4gICAqIHJhbmsuIFRvIGRvIHRoaXMgaXQgaW5zZXJ0cyBkdW1teSBub2RlcyBhcyBuZWVkZWQgYW5kIGxpbmtzIHRoZW0gYnkgYWRkaW5nXG4gICAqIGR1bW15IGVkZ2VzLiBUaGlzIGZ1bmN0aW9uIGtlZXBzIGVub3VnaCBpbmZvcm1hdGlvbiBpbiB0aGUgZHVtbXkgbm9kZXMgYW5kXG4gICAqIGVkZ2VzIHRvIGVuc3VyZSB0aGF0IHRoZSBvcmlnaW5hbCBncmFwaCBjYW4gYmUgcmVjb25zdHJ1Y3RlZCBsYXRlci5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgYXNzdW1lcyB0aGF0IHRoZSBpbnB1dCBncmFwaCBpcyBjeWNsZSBmcmVlLlxuICAgKi9cbiAgZnVuY3Rpb24gbm9ybWFsaXplKGcpIHtcbiAgICB2YXIgZHVtbXlDb3VudCA9IDA7XG4gICAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCBzLCB0LCBhKSB7XG4gICAgICB2YXIgc291cmNlUmFuayA9IGcubm9kZShzKS5yYW5rO1xuICAgICAgdmFyIHRhcmdldFJhbmsgPSBnLm5vZGUodCkucmFuaztcbiAgICAgIGlmIChzb3VyY2VSYW5rICsgMSA8IHRhcmdldFJhbmspIHtcbiAgICAgICAgZm9yICh2YXIgdSA9IHMsIHJhbmsgPSBzb3VyY2VSYW5rICsgMSwgaSA9IDA7IHJhbmsgPCB0YXJnZXRSYW5rOyArK3JhbmssICsraSkge1xuICAgICAgICAgIHZhciB2ID0gJ19EJyArICgrK2R1bW15Q291bnQpO1xuICAgICAgICAgIHZhciBub2RlID0ge1xuICAgICAgICAgICAgd2lkdGg6IGEud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGEuaGVpZ2h0LFxuICAgICAgICAgICAgZWRnZTogeyBpZDogZSwgc291cmNlOiBzLCB0YXJnZXQ6IHQsIGF0dHJzOiBhIH0sXG4gICAgICAgICAgICByYW5rOiByYW5rLFxuICAgICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gSWYgdGhpcyBub2RlIHJlcHJlc2VudHMgYSBiZW5kIHRoZW4gd2Ugd2lsbCB1c2UgaXQgYXMgYSBjb250cm9sXG4gICAgICAgICAgLy8gcG9pbnQuIEZvciBlZGdlcyB3aXRoIDIgc2VnbWVudHMgdGhpcyB3aWxsIGJlIHRoZSBjZW50ZXIgZHVtbXlcbiAgICAgICAgICAvLyBub2RlLiBGb3IgZWRnZXMgd2l0aCBtb3JlIHRoYW4gdHdvIHNlZ21lbnRzLCB0aGlzIHdpbGwgYmUgdGhlXG4gICAgICAgICAgLy8gZmlyc3QgYW5kIGxhc3QgZHVtbXkgbm9kZS5cbiAgICAgICAgICBpZiAoaSA9PT0gMCkgbm9kZS5pbmRleCA9IDA7XG4gICAgICAgICAgZWxzZSBpZiAocmFuayArIDEgPT09IHRhcmdldFJhbmspIG5vZGUuaW5kZXggPSAxO1xuXG4gICAgICAgICAgZy5hZGROb2RlKHYsIG5vZGUpO1xuICAgICAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCB7fSk7XG4gICAgICAgICAgdSA9IHY7XG4gICAgICAgIH1cbiAgICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHQsIHt9KTtcbiAgICAgICAgZy5kZWxFZGdlKGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLypcbiAgICogUmVjb25zdHJ1Y3RzIHRoZSBncmFwaCBhcyBpdCB3YXMgYmVmb3JlIG5vcm1hbGl6YXRpb24uIFRoZSBwb3NpdGlvbnMgb2ZcbiAgICogZHVtbXkgbm9kZXMgYXJlIHVzZWQgdG8gYnVpbGQgYW4gYXJyYXkgb2YgcG9pbnRzIGZvciB0aGUgb3JpZ2luYWwgJ2xvbmcnXG4gICAqIGVkZ2UuIER1bW15IG5vZGVzIGFuZCBlZGdlcyBhcmUgcmVtb3ZlZC5cbiAgICovXG4gIGZ1bmN0aW9uIHVuZG9Ob3JtYWxpemUoZykge1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSwgYSkge1xuICAgICAgaWYgKGEuZHVtbXkpIHtcbiAgICAgICAgaWYgKCdpbmRleCcgaW4gYSkge1xuICAgICAgICAgIHZhciBlZGdlID0gYS5lZGdlO1xuICAgICAgICAgIGlmICghZy5oYXNFZGdlKGVkZ2UuaWQpKSB7XG4gICAgICAgICAgICBnLmFkZEVkZ2UoZWRnZS5pZCwgZWRnZS5zb3VyY2UsIGVkZ2UudGFyZ2V0LCBlZGdlLmF0dHJzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIHBvaW50cyA9IGcuZWRnZShlZGdlLmlkKS5wb2ludHM7XG4gICAgICAgICAgcG9pbnRzW2EuaW5kZXhdID0geyB4OiBhLngsIHk6IGEueSwgdWw6IGEudWwsIHVyOiBhLnVyLCBkbDogYS5kbCwgZHI6IGEuZHIgfTtcbiAgICAgICAgfVxuICAgICAgICBnLmRlbE5vZGUodSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBGb3IgZWFjaCBlZGdlIHRoYXQgd2FzIHJldmVyc2VkIGR1cmluZyB0aGUgYGFjeWNsaWNgIHN0ZXAsIHJldmVyc2UgaXRzXG4gICAqIGFycmF5IG9mIHBvaW50cy5cbiAgICovXG4gIGZ1bmN0aW9uIGZpeHVwRWRnZVBvaW50cyhnKSB7XG4gICAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCBzLCB0LCBhKSB7IGlmIChhLnJldmVyc2VkKSBhLnBvaW50cy5yZXZlcnNlKCk7IH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlRmluYWxHcmFwaChnLCBpc0RpcmVjdGVkKSB7XG4gICAgdmFyIG91dCA9IGlzRGlyZWN0ZWQgPyBuZXcgQ0RpZ3JhcGgoKSA6IG5ldyBDR3JhcGgoKTtcbiAgICBvdXQuZ3JhcGgoZy5ncmFwaCgpKTtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7IG91dC5hZGROb2RlKHUsIHZhbHVlKTsgfSk7XG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7IG91dC5wYXJlbnQodSwgZy5wYXJlbnQodSkpOyB9KTtcbiAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgICBvdXQuYWRkRWRnZSh2YWx1ZS5lLCB1LCB2LCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBBdHRhY2ggYm91bmRpbmcgYm94IGluZm9ybWF0aW9uXG4gICAgdmFyIG1heFggPSAwLCBtYXhZID0gMDtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgICBpZiAoIWcuY2hpbGRyZW4odSkubGVuZ3RoKSB7XG4gICAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCB2YWx1ZS54ICsgdmFsdWUud2lkdGggLyAyKTtcbiAgICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIHZhbHVlLnkgKyB2YWx1ZS5oZWlnaHQgLyAyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgICB2YXIgbWF4WFBvaW50cyA9IE1hdGgubWF4LmFwcGx5KE1hdGgsIHZhbHVlLnBvaW50cy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4gcC54OyB9KSk7XG4gICAgICB2YXIgbWF4WVBvaW50cyA9IE1hdGgubWF4LmFwcGx5KE1hdGgsIHZhbHVlLnBvaW50cy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4gcC55OyB9KSk7XG4gICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgbWF4WFBvaW50cyArIHZhbHVlLndpZHRoIC8gMik7XG4gICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgbWF4WVBvaW50cyArIHZhbHVlLmhlaWdodCAvIDIpO1xuICAgIH0pO1xuICAgIG91dC5ncmFwaCgpLndpZHRoID0gbWF4WDtcbiAgICBvdXQuZ3JhcGgoKS5oZWlnaHQgPSBtYXhZO1xuXG4gICAgcmV0dXJuIG91dDtcbiAgfVxuXG4gIC8qXG4gICAqIEdpdmVuIGEgZnVuY3Rpb24sIGEgbmV3IGZ1bmN0aW9uIGlzIHJldHVybmVkIHRoYXQgaW52b2tlcyB0aGUgZ2l2ZW5cbiAgICogZnVuY3Rpb24uIFRoZSByZXR1cm4gdmFsdWUgZnJvbSB0aGUgZnVuY3Rpb24gaXMgYWx3YXlzIHRoZSBgc2VsZmAgb2JqZWN0LlxuICAgKi9cbiAgZnVuY3Rpb24gZGVsZWdhdGVQcm9wZXJ0eShmKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZigpO1xuICAgICAgZi5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbiAgfVxufTtcblxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBjcm9zc0NvdW50ID0gcmVxdWlyZSgnLi9vcmRlci9jcm9zc0NvdW50JyksXG4gICAgaW5pdExheWVyR3JhcGhzID0gcmVxdWlyZSgnLi9vcmRlci9pbml0TGF5ZXJHcmFwaHMnKSxcbiAgICBpbml0T3JkZXIgPSByZXF1aXJlKCcuL29yZGVyL2luaXRPcmRlcicpLFxuICAgIHNvcnRMYXllciA9IHJlcXVpcmUoJy4vb3JkZXIvc29ydExheWVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gb3JkZXI7XG5cbi8vIFRoZSBtYXhpbXVtIG51bWJlciBvZiBzd2VlcHMgdG8gcGVyZm9ybSBiZWZvcmUgZmluaXNoaW5nIHRoZSBvcmRlciBwaGFzZS5cbnZhciBERUZBVUxUX01BWF9TV0VFUFMgPSAyNDtcbm9yZGVyLkRFRkFVTFRfTUFYX1NXRUVQUyA9IERFRkFVTFRfTUFYX1NXRUVQUztcblxuLypcbiAqIFJ1bnMgdGhlIG9yZGVyIHBoYXNlIHdpdGggdGhlIHNwZWNpZmllZCBgZ3JhcGgsIGBtYXhTd2VlcHNgLCBhbmRcbiAqIGBkZWJ1Z0xldmVsYC4gSWYgYG1heFN3ZWVwc2AgaXMgbm90IHNwZWNpZmllZCB3ZSB1c2UgYERFRkFVTFRfTUFYX1NXRUVQU2AuXG4gKiBJZiBgZGVidWdMZXZlbGAgaXMgbm90IHNldCB3ZSBhc3N1bWUgMC5cbiAqL1xuZnVuY3Rpb24gb3JkZXIoZywgbWF4U3dlZXBzKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgIG1heFN3ZWVwcyA9IERFRkFVTFRfTUFYX1NXRUVQUztcbiAgfVxuXG4gIHZhciByZXN0YXJ0cyA9IGcuZ3JhcGgoKS5vcmRlclJlc3RhcnRzIHx8IDA7XG5cbiAgdmFyIGxheWVyR3JhcGhzID0gaW5pdExheWVyR3JhcGhzKGcpO1xuICAvLyBUT0RPOiByZW1vdmUgdGhpcyB3aGVuIHdlIGFkZCBiYWNrIHN1cHBvcnQgZm9yIG9yZGVyaW5nIGNsdXN0ZXJzXG4gIGxheWVyR3JhcGhzLmZvckVhY2goZnVuY3Rpb24obGcpIHtcbiAgICBsZyA9IGxnLmZpbHRlck5vZGVzKGZ1bmN0aW9uKHUpIHsgcmV0dXJuICFnLmNoaWxkcmVuKHUpLmxlbmd0aDsgfSk7XG4gIH0pO1xuXG4gIHZhciBpdGVycyA9IDAsXG4gICAgICBjdXJyZW50QmVzdENDLFxuICAgICAgYWxsVGltZUJlc3RDQyA9IE51bWJlci5NQVhfVkFMVUUsXG4gICAgICBhbGxUaW1lQmVzdCA9IHt9O1xuXG4gIGZ1bmN0aW9uIHNhdmVBbGxUaW1lQmVzdCgpIHtcbiAgICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7IGFsbFRpbWVCZXN0W3VdID0gdmFsdWUub3JkZXI7IH0pO1xuICB9XG5cbiAgZm9yICh2YXIgaiA9IDA7IGogPCBOdW1iZXIocmVzdGFydHMpICsgMSAmJiBhbGxUaW1lQmVzdENDICE9PSAwOyArK2opIHtcbiAgICBjdXJyZW50QmVzdENDID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICBpbml0T3JkZXIoZywgcmVzdGFydHMgPiAwKTtcblxuICAgIHV0aWwubG9nKDIsICdPcmRlciBwaGFzZSBzdGFydCBjcm9zcyBjb3VudDogJyArIGcuZ3JhcGgoKS5vcmRlckluaXRDQyk7XG5cbiAgICB2YXIgaSwgbGFzdEJlc3QsIGNjO1xuICAgIGZvciAoaSA9IDAsIGxhc3RCZXN0ID0gMDsgbGFzdEJlc3QgPCA0ICYmIGkgPCBtYXhTd2VlcHMgJiYgY3VycmVudEJlc3RDQyA+IDA7ICsraSwgKytsYXN0QmVzdCwgKytpdGVycykge1xuICAgICAgc3dlZXAoZywgbGF5ZXJHcmFwaHMsIGkpO1xuICAgICAgY2MgPSBjcm9zc0NvdW50KGcpO1xuICAgICAgaWYgKGNjIDwgY3VycmVudEJlc3RDQykge1xuICAgICAgICBsYXN0QmVzdCA9IDA7XG4gICAgICAgIGN1cnJlbnRCZXN0Q0MgPSBjYztcbiAgICAgICAgaWYgKGNjIDwgYWxsVGltZUJlc3RDQykge1xuICAgICAgICAgIHNhdmVBbGxUaW1lQmVzdCgpO1xuICAgICAgICAgIGFsbFRpbWVCZXN0Q0MgPSBjYztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdXRpbC5sb2coMywgJ09yZGVyIHBoYXNlIHN0YXJ0ICcgKyBqICsgJyBpdGVyICcgKyBpICsgJyBjcm9zcyBjb3VudDogJyArIGNjKTtcbiAgICB9XG4gIH1cblxuICBPYmplY3Qua2V5cyhhbGxUaW1lQmVzdCkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgaWYgKCFnLmNoaWxkcmVuIHx8ICFnLmNoaWxkcmVuKHUpLmxlbmd0aCkge1xuICAgICAgZy5ub2RlKHUpLm9yZGVyID0gYWxsVGltZUJlc3RbdV07XG4gICAgfVxuICB9KTtcbiAgZy5ncmFwaCgpLm9yZGVyQ0MgPSBhbGxUaW1lQmVzdENDO1xuXG4gIHV0aWwubG9nKDIsICdPcmRlciBpdGVyYXRpb25zOiAnICsgaXRlcnMpO1xuICB1dGlsLmxvZygyLCAnT3JkZXIgcGhhc2UgYmVzdCBjcm9zcyBjb3VudDogJyArIGcuZ3JhcGgoKS5vcmRlckNDKTtcbn1cblxuZnVuY3Rpb24gcHJlZGVjZXNzb3JXZWlnaHRzKGcsIG5vZGVzKSB7XG4gIHZhciB3ZWlnaHRzID0ge307XG4gIG5vZGVzLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHdlaWdodHNbdV0gPSBnLmluRWRnZXModSkubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBnLm5vZGUoZy5zb3VyY2UoZSkpLm9yZGVyO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIHdlaWdodHM7XG59XG5cbmZ1bmN0aW9uIHN1Y2Nlc3NvcldlaWdodHMoZywgbm9kZXMpIHtcbiAgdmFyIHdlaWdodHMgPSB7fTtcbiAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgd2VpZ2h0c1t1XSA9IGcub3V0RWRnZXModSkubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBnLm5vZGUoZy50YXJnZXQoZSkpLm9yZGVyO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIHdlaWdodHM7XG59XG5cbmZ1bmN0aW9uIHN3ZWVwKGcsIGxheWVyR3JhcGhzLCBpdGVyKSB7XG4gIGlmIChpdGVyICUgMiA9PT0gMCkge1xuICAgIHN3ZWVwRG93bihnLCBsYXllckdyYXBocywgaXRlcik7XG4gIH0gZWxzZSB7XG4gICAgc3dlZXBVcChnLCBsYXllckdyYXBocywgaXRlcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3dlZXBEb3duKGcsIGxheWVyR3JhcGhzKSB7XG4gIHZhciBjZztcbiAgZm9yIChpID0gMTsgaSA8IGxheWVyR3JhcGhzLmxlbmd0aDsgKytpKSB7XG4gICAgY2cgPSBzb3J0TGF5ZXIobGF5ZXJHcmFwaHNbaV0sIGNnLCBwcmVkZWNlc3NvcldlaWdodHMoZywgbGF5ZXJHcmFwaHNbaV0ubm9kZXMoKSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN3ZWVwVXAoZywgbGF5ZXJHcmFwaHMpIHtcbiAgdmFyIGNnO1xuICBmb3IgKGkgPSBsYXllckdyYXBocy5sZW5ndGggLSAyOyBpID49IDA7IC0taSkge1xuICAgIHNvcnRMYXllcihsYXllckdyYXBoc1tpXSwgY2csIHN1Y2Nlc3NvcldlaWdodHMoZywgbGF5ZXJHcmFwaHNbaV0ubm9kZXMoKSkpO1xuICB9XG59XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcm9zc0NvdW50O1xuXG4vKlxuICogUmV0dXJucyB0aGUgY3Jvc3MgY291bnQgZm9yIHRoZSBnaXZlbiBncmFwaC5cbiAqL1xuZnVuY3Rpb24gY3Jvc3NDb3VudChnKSB7XG4gIHZhciBjYyA9IDA7XG4gIHZhciBvcmRlcmluZyA9IHV0aWwub3JkZXJpbmcoZyk7XG4gIGZvciAodmFyIGkgPSAxOyBpIDwgb3JkZXJpbmcubGVuZ3RoOyArK2kpIHtcbiAgICBjYyArPSB0d29MYXllckNyb3NzQ291bnQoZywgb3JkZXJpbmdbaS0xXSwgb3JkZXJpbmdbaV0pO1xuICB9XG4gIHJldHVybiBjYztcbn1cblxuLypcbiAqIFRoaXMgZnVuY3Rpb24gc2VhcmNoZXMgdGhyb3VnaCBhIHJhbmtlZCBhbmQgb3JkZXJlZCBncmFwaCBhbmQgY291bnRzIHRoZVxuICogbnVtYmVyIG9mIGVkZ2VzIHRoYXQgY3Jvc3MuIFRoaXMgYWxnb3JpdGhtIGlzIGRlcml2ZWQgZnJvbTpcbiAqXG4gKiAgICBXLiBCYXJ0aCBldCBhbC4sIEJpbGF5ZXIgQ3Jvc3MgQ291bnRpbmcsIEpHQUEsIDgoMikgMTc54oCTMTk0ICgyMDA0KVxuICovXG5mdW5jdGlvbiB0d29MYXllckNyb3NzQ291bnQoZywgbGF5ZXIxLCBsYXllcjIpIHtcbiAgdmFyIGluZGljZXMgPSBbXTtcbiAgbGF5ZXIxLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgIHZhciBub2RlSW5kaWNlcyA9IFtdO1xuICAgIGcub3V0RWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7IG5vZGVJbmRpY2VzLnB1c2goZy5ub2RlKGcudGFyZ2V0KGUpKS5vcmRlcik7IH0pO1xuICAgIG5vZGVJbmRpY2VzLnNvcnQoZnVuY3Rpb24oeCwgeSkgeyByZXR1cm4geCAtIHk7IH0pO1xuICAgIGluZGljZXMgPSBpbmRpY2VzLmNvbmNhdChub2RlSW5kaWNlcyk7XG4gIH0pO1xuXG4gIHZhciBmaXJzdEluZGV4ID0gMTtcbiAgd2hpbGUgKGZpcnN0SW5kZXggPCBsYXllcjIubGVuZ3RoKSBmaXJzdEluZGV4IDw8PSAxO1xuXG4gIHZhciB0cmVlU2l6ZSA9IDIgKiBmaXJzdEluZGV4IC0gMTtcbiAgZmlyc3RJbmRleCAtPSAxO1xuXG4gIHZhciB0cmVlID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdHJlZVNpemU7ICsraSkgeyB0cmVlW2ldID0gMDsgfVxuXG4gIHZhciBjYyA9IDA7XG4gIGluZGljZXMuZm9yRWFjaChmdW5jdGlvbihpKSB7XG4gICAgdmFyIHRyZWVJbmRleCA9IGkgKyBmaXJzdEluZGV4O1xuICAgICsrdHJlZVt0cmVlSW5kZXhdO1xuICAgIHdoaWxlICh0cmVlSW5kZXggPiAwKSB7XG4gICAgICBpZiAodHJlZUluZGV4ICUgMikge1xuICAgICAgICBjYyArPSB0cmVlW3RyZWVJbmRleCArIDFdO1xuICAgICAgfVxuICAgICAgdHJlZUluZGV4ID0gKHRyZWVJbmRleCAtIDEpID4+IDE7XG4gICAgICArK3RyZWVbdHJlZUluZGV4XTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjYztcbn1cbiIsInZhciBub2Rlc0Zyb21MaXN0ID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5maWx0ZXIubm9kZXNGcm9tTGlzdCxcbiAgICAvKiBqc2hpbnQgLVcwNzkgKi9cbiAgICBTZXQgPSByZXF1aXJlKCdjcC1kYXRhJykuU2V0O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXRMYXllckdyYXBocztcblxuLypcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYSBjb21wb3VuZCBsYXllcmVkIGdyYXBoLCBnLCBhbmQgcHJvZHVjZXMgYW4gYXJyYXkgb2ZcbiAqIGxheWVyIGdyYXBocy4gRWFjaCBlbnRyeSBpbiB0aGUgYXJyYXkgcmVwcmVzZW50cyBhIHN1YmdyYXBoIG9mIG5vZGVzXG4gKiByZWxldmFudCBmb3IgcGVyZm9ybWluZyBjcm9zc2luZyByZWR1Y3Rpb24gb24gdGhhdCBsYXllci5cbiAqL1xuZnVuY3Rpb24gaW5pdExheWVyR3JhcGhzKGcpIHtcbiAgdmFyIHJhbmtzID0gW107XG5cbiAgZnVuY3Rpb24gZGZzKHUpIHtcbiAgICBpZiAodSA9PT0gbnVsbCkge1xuICAgICAgZy5jaGlsZHJlbih1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHsgZGZzKHYpOyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWUgPSBnLm5vZGUodSk7XG4gICAgdmFsdWUubWluUmFuayA9ICgncmFuaycgaW4gdmFsdWUpID8gdmFsdWUucmFuayA6IE51bWJlci5NQVhfVkFMVUU7XG4gICAgdmFsdWUubWF4UmFuayA9ICgncmFuaycgaW4gdmFsdWUpID8gdmFsdWUucmFuayA6IE51bWJlci5NSU5fVkFMVUU7XG4gICAgdmFyIHVSYW5rcyA9IG5ldyBTZXQoKTtcbiAgICBnLmNoaWxkcmVuKHUpLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgdmFyIHJzID0gZGZzKHYpO1xuICAgICAgdVJhbmtzID0gU2V0LnVuaW9uKFt1UmFua3MsIHJzXSk7XG4gICAgICB2YWx1ZS5taW5SYW5rID0gTWF0aC5taW4odmFsdWUubWluUmFuaywgZy5ub2RlKHYpLm1pblJhbmspO1xuICAgICAgdmFsdWUubWF4UmFuayA9IE1hdGgubWF4KHZhbHVlLm1heFJhbmssIGcubm9kZSh2KS5tYXhSYW5rKTtcbiAgICB9KTtcblxuICAgIGlmICgncmFuaycgaW4gdmFsdWUpIHVSYW5rcy5hZGQodmFsdWUucmFuayk7XG5cbiAgICB1UmFua3Mua2V5cygpLmZvckVhY2goZnVuY3Rpb24ocikge1xuICAgICAgaWYgKCEociBpbiByYW5rcykpIHJhbmtzW3JdID0gW107XG4gICAgICByYW5rc1tyXS5wdXNoKHUpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHVSYW5rcztcbiAgfVxuICBkZnMobnVsbCk7XG5cbiAgdmFyIGxheWVyR3JhcGhzID0gW107XG4gIHJhbmtzLmZvckVhY2goZnVuY3Rpb24odXMsIHJhbmspIHtcbiAgICBsYXllckdyYXBoc1tyYW5rXSA9IGcuZmlsdGVyTm9kZXMobm9kZXNGcm9tTGlzdCh1cykpO1xuICB9KTtcblxuICByZXR1cm4gbGF5ZXJHcmFwaHM7XG59XG4iLCJ2YXIgY3Jvc3NDb3VudCA9IHJlcXVpcmUoJy4vY3Jvc3NDb3VudCcpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdE9yZGVyO1xuXG4vKlxuICogR2l2ZW4gYSBncmFwaCB3aXRoIGEgc2V0IG9mIGxheWVyZWQgbm9kZXMgKGkuZS4gbm9kZXMgdGhhdCBoYXZlIGEgYHJhbmtgXG4gKiBhdHRyaWJ1dGUpIHRoaXMgZnVuY3Rpb24gYXR0YWNoZXMgYW4gYG9yZGVyYCBhdHRyaWJ1dGUgdGhhdCB1bmlxdWVseVxuICogYXJyYW5nZXMgZWFjaCBub2RlIG9mIGVhY2ggcmFuay4gSWYgbm8gY29uc3RyYWludCBncmFwaCBpcyBwcm92aWRlZCB0aGVcbiAqIG9yZGVyIG9mIHRoZSBub2RlcyBpbiBlYWNoIHJhbmsgaXMgZW50aXJlbHkgYXJiaXRyYXJ5LlxuICovXG5mdW5jdGlvbiBpbml0T3JkZXIoZywgcmFuZG9tKSB7XG4gIHZhciBsYXllcnMgPSBbXTtcblxuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgdmFyIGxheWVyID0gbGF5ZXJzW3ZhbHVlLnJhbmtdO1xuICAgIGlmIChnLmNoaWxkcmVuICYmIGcuY2hpbGRyZW4odSkubGVuZ3RoID4gMCkgcmV0dXJuO1xuICAgIGlmICghbGF5ZXIpIHtcbiAgICAgIGxheWVyID0gbGF5ZXJzW3ZhbHVlLnJhbmtdID0gW107XG4gICAgfVxuICAgIGxheWVyLnB1c2godSk7XG4gIH0pO1xuXG4gIGxheWVycy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgaWYgKHJhbmRvbSkge1xuICAgICAgdXRpbC5zaHVmZmxlKGxheWVyKTtcbiAgICB9XG4gICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7XG4gICAgICBnLm5vZGUodSkub3JkZXIgPSBpO1xuICAgIH0pO1xuICB9KTtcblxuICB2YXIgY2MgPSBjcm9zc0NvdW50KGcpO1xuICBnLmdyYXBoKCkub3JkZXJJbml0Q0MgPSBjYztcbiAgZy5ncmFwaCgpLm9yZGVyQ0MgPSBOdW1iZXIuTUFYX1ZBTFVFO1xufVxuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG4vKlxuICAgIERpZ3JhcGggPSByZXF1aXJlKCdncmFwaGxpYicpLkRpZ3JhcGgsXG4gICAgdG9wc29ydCA9IHJlcXVpcmUoJ2dyYXBobGliJykuYWxnLnRvcHNvcnQsXG4gICAgbm9kZXNGcm9tTGlzdCA9IHJlcXVpcmUoJ2dyYXBobGliJykuZmlsdGVyLm5vZGVzRnJvbUxpc3Q7XG4qL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHNvcnRMYXllcjtcblxuLypcbmZ1bmN0aW9uIHNvcnRMYXllcihnLCBjZywgd2VpZ2h0cykge1xuICB2YXIgcmVzdWx0ID0gc29ydExheWVyU3ViZ3JhcGgoZywgbnVsbCwgY2csIHdlaWdodHMpO1xuICByZXN1bHQubGlzdC5mb3JFYWNoKGZ1bmN0aW9uKHUsIGkpIHtcbiAgICBnLm5vZGUodSkub3JkZXIgPSBpO1xuICB9KTtcbiAgcmV0dXJuIHJlc3VsdC5jb25zdHJhaW50R3JhcGg7XG59XG4qL1xuXG5mdW5jdGlvbiBzb3J0TGF5ZXIoZywgY2csIHdlaWdodHMpIHtcbiAgdmFyIG9yZGVyaW5nID0gW107XG4gIHZhciBicyA9IHt9O1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgb3JkZXJpbmdbdmFsdWUub3JkZXJdID0gdTtcbiAgICB2YXIgd3MgPSB3ZWlnaHRzW3VdO1xuICAgIGlmICh3cy5sZW5ndGgpIHtcbiAgICAgIGJzW3VdID0gdXRpbC5zdW0od3MpIC8gd3MubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgdmFyIHRvU29ydCA9IGcubm9kZXMoKS5maWx0ZXIoZnVuY3Rpb24odSkgeyByZXR1cm4gYnNbdV0gIT09IHVuZGVmaW5lZDsgfSk7XG4gIHRvU29ydC5zb3J0KGZ1bmN0aW9uKHgsIHkpIHtcbiAgICByZXR1cm4gYnNbeF0gLSBic1t5XSB8fCBnLm5vZGUoeCkub3JkZXIgLSBnLm5vZGUoeSkub3JkZXI7XG4gIH0pO1xuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gMCwgamwgPSB0b1NvcnQubGVuZ3RoOyBqIDwgamw7ICsraSkge1xuICAgIGlmIChic1tvcmRlcmluZ1tpXV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5ub2RlKHRvU29ydFtqKytdKS5vcmRlciA9IGk7XG4gICAgfVxuICB9XG59XG5cbi8vIFRPT0Q6IHJlLWVuYWJsZSBjb25zdHJhaW5lZCBzb3J0aW5nIG9uY2Ugd2UgaGF2ZSBhIHN0cmF0ZWd5IGZvciBoYW5kbGluZ1xuLy8gdW5kZWZpbmVkIGJhcnljZW50ZXJzLlxuLypcbmZ1bmN0aW9uIHNvcnRMYXllclN1YmdyYXBoKGcsIHNnLCBjZywgd2VpZ2h0cykge1xuICBjZyA9IGNnID8gY2cuZmlsdGVyTm9kZXMobm9kZXNGcm9tTGlzdChnLmNoaWxkcmVuKHNnKSkpIDogbmV3IERpZ3JhcGgoKTtcblxuICB2YXIgbm9kZURhdGEgPSB7fTtcbiAgZy5jaGlsZHJlbihzZykuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgaWYgKGcuY2hpbGRyZW4odSkubGVuZ3RoKSB7XG4gICAgICBub2RlRGF0YVt1XSA9IHNvcnRMYXllclN1YmdyYXBoKGcsIHUsIGNnLCB3ZWlnaHRzKTtcbiAgICAgIG5vZGVEYXRhW3VdLmZpcnN0U0cgPSB1O1xuICAgICAgbm9kZURhdGFbdV0ubGFzdFNHID0gdTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHdzID0gd2VpZ2h0c1t1XTtcbiAgICAgIG5vZGVEYXRhW3VdID0ge1xuICAgICAgICBkZWdyZWU6IHdzLmxlbmd0aCxcbiAgICAgICAgYmFyeWNlbnRlcjogd3MubGVuZ3RoID4gMCA/IHV0aWwuc3VtKHdzKSAvIHdzLmxlbmd0aCA6IDAsXG4gICAgICAgIGxpc3Q6IFt1XVxuICAgICAgfTtcbiAgICB9XG4gIH0pO1xuXG4gIHJlc29sdmVWaW9sYXRlZENvbnN0cmFpbnRzKGcsIGNnLCBub2RlRGF0YSk7XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhub2RlRGF0YSk7XG4gIGtleXMuc29ydChmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIG5vZGVEYXRhW3hdLmJhcnljZW50ZXIgLSBub2RlRGF0YVt5XS5iYXJ5Y2VudGVyO1xuICB9KTtcblxuICB2YXIgcmVzdWx0ID0gIGtleXMubWFwKGZ1bmN0aW9uKHUpIHsgcmV0dXJuIG5vZGVEYXRhW3VdOyB9KVxuICAgICAgICAgICAgICAgICAgICAucmVkdWNlKGZ1bmN0aW9uKGxocywgcmhzKSB7IHJldHVybiBtZXJnZU5vZGVEYXRhKGcsIGxocywgcmhzKTsgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qXG5mdW5jdGlvbiBtZXJnZU5vZGVEYXRhKGcsIGxocywgcmhzKSB7XG4gIHZhciBjZyA9IG1lcmdlRGlncmFwaHMobGhzLmNvbnN0cmFpbnRHcmFwaCwgcmhzLmNvbnN0cmFpbnRHcmFwaCk7XG5cbiAgaWYgKGxocy5sYXN0U0cgIT09IHVuZGVmaW5lZCAmJiByaHMuZmlyc3RTRyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGNnID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNnID0gbmV3IERpZ3JhcGgoKTtcbiAgICB9XG4gICAgaWYgKCFjZy5oYXNOb2RlKGxocy5sYXN0U0cpKSB7IGNnLmFkZE5vZGUobGhzLmxhc3RTRyk7IH1cbiAgICBjZy5hZGROb2RlKHJocy5maXJzdFNHKTtcbiAgICBjZy5hZGRFZGdlKG51bGwsIGxocy5sYXN0U0csIHJocy5maXJzdFNHKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZGVncmVlOiBsaHMuZGVncmVlICsgcmhzLmRlZ3JlZSxcbiAgICBiYXJ5Y2VudGVyOiAobGhzLmJhcnljZW50ZXIgKiBsaHMuZGVncmVlICsgcmhzLmJhcnljZW50ZXIgKiByaHMuZGVncmVlKSAvXG4gICAgICAgICAgICAgICAgKGxocy5kZWdyZWUgKyByaHMuZGVncmVlKSxcbiAgICBsaXN0OiBsaHMubGlzdC5jb25jYXQocmhzLmxpc3QpLFxuICAgIGZpcnN0U0c6IGxocy5maXJzdFNHICE9PSB1bmRlZmluZWQgPyBsaHMuZmlyc3RTRyA6IHJocy5maXJzdFNHLFxuICAgIGxhc3RTRzogcmhzLmxhc3RTRyAhPT0gdW5kZWZpbmVkID8gcmhzLmxhc3RTRyA6IGxocy5sYXN0U0csXG4gICAgY29uc3RyYWludEdyYXBoOiBjZ1xuICB9O1xufVxuXG5mdW5jdGlvbiBtZXJnZURpZ3JhcGhzKGxocywgcmhzKSB7XG4gIGlmIChsaHMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHJocztcbiAgaWYgKHJocyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbGhzO1xuXG4gIGxocyA9IGxocy5jb3B5KCk7XG4gIHJocy5ub2RlcygpLmZvckVhY2goZnVuY3Rpb24odSkgeyBsaHMuYWRkTm9kZSh1KTsgfSk7XG4gIHJocy5lZGdlcygpLmZvckVhY2goZnVuY3Rpb24oZSwgdSwgdikgeyBsaHMuYWRkRWRnZShudWxsLCB1LCB2KTsgfSk7XG4gIHJldHVybiBsaHM7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVWaW9sYXRlZENvbnN0cmFpbnRzKGcsIGNnLCBub2RlRGF0YSkge1xuICAvLyBSZW1vdmVzIG5vZGVzIGB1YCBhbmQgYHZgIGZyb20gYGNnYCBhbmQgbWFrZXMgYW55IGVkZ2VzIGluY2lkZW50IG9uIHRoZW1cbiAgLy8gaW5jaWRlbnQgb24gYHdgIGluc3RlYWQuXG4gIGZ1bmN0aW9uIGNvbGxhcHNlTm9kZXModSwgdiwgdykge1xuICAgIC8vIFRPRE8gb3JpZ2luYWwgcGFwZXIgcmVtb3ZlcyBzZWxmIGxvb3BzLCBidXQgaXQgaXMgbm90IG9idmlvdXMgd2hlbiB0aGlzIHdvdWxkIGhhcHBlblxuICAgIGNnLmluRWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICBjZy5kZWxFZGdlKGUpO1xuICAgICAgY2cuYWRkRWRnZShudWxsLCBjZy5zb3VyY2UoZSksIHcpO1xuICAgIH0pO1xuXG4gICAgY2cub3V0RWRnZXModikuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICBjZy5kZWxFZGdlKGUpO1xuICAgICAgY2cuYWRkRWRnZShudWxsLCB3LCBjZy50YXJnZXQoZSkpO1xuICAgIH0pO1xuXG4gICAgY2cuZGVsTm9kZSh1KTtcbiAgICBjZy5kZWxOb2RlKHYpO1xuICB9XG5cbiAgdmFyIHZpb2xhdGVkO1xuICB3aGlsZSAoKHZpb2xhdGVkID0gZmluZFZpb2xhdGVkQ29uc3RyYWludChjZywgbm9kZURhdGEpKSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIHNvdXJjZSA9IGNnLnNvdXJjZSh2aW9sYXRlZCksXG4gICAgICAgIHRhcmdldCA9IGNnLnRhcmdldCh2aW9sYXRlZCk7XG5cbiAgICB2YXIgdjtcbiAgICB3aGlsZSAoKHYgPSBjZy5hZGROb2RlKG51bGwpKSAmJiBnLmhhc05vZGUodikpIHtcbiAgICAgIGNnLmRlbE5vZGUodik7XG4gICAgfVxuXG4gICAgLy8gQ29sbGFwc2UgYmFyeWNlbnRlciBhbmQgbGlzdFxuICAgIG5vZGVEYXRhW3ZdID0gbWVyZ2VOb2RlRGF0YShnLCBub2RlRGF0YVtzb3VyY2VdLCBub2RlRGF0YVt0YXJnZXRdKTtcbiAgICBkZWxldGUgbm9kZURhdGFbc291cmNlXTtcbiAgICBkZWxldGUgbm9kZURhdGFbdGFyZ2V0XTtcblxuICAgIGNvbGxhcHNlTm9kZXMoc291cmNlLCB0YXJnZXQsIHYpO1xuICAgIGlmIChjZy5pbmNpZGVudEVkZ2VzKHYpLmxlbmd0aCA9PT0gMCkgeyBjZy5kZWxOb2RlKHYpOyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZFZpb2xhdGVkQ29uc3RyYWludChjZywgbm9kZURhdGEpIHtcbiAgdmFyIHVzID0gdG9wc29ydChjZyk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdXMubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgdSA9IHVzW2ldO1xuICAgIHZhciBpbkVkZ2VzID0gY2cuaW5FZGdlcyh1KTtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGluRWRnZXMubGVuZ3RoOyArK2opIHtcbiAgICAgIHZhciBlID0gaW5FZGdlc1tqXTtcbiAgICAgIGlmIChub2RlRGF0YVtjZy5zb3VyY2UoZSldLmJhcnljZW50ZXIgPj0gbm9kZURhdGFbdV0uYmFyeWNlbnRlcikge1xuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiovXG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4vKlxuICogVGhlIGFsZ29yaXRobXMgaGVyZSBhcmUgYmFzZWQgb24gQnJhbmRlcyBhbmQgS8O2cGYsIFwiRmFzdCBhbmQgU2ltcGxlXG4gKiBIb3Jpem9udGFsIENvb3JkaW5hdGUgQXNzaWdubWVudFwiLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAvLyBFeHRlcm5hbCBjb25maWd1cmF0aW9uXG4gIHZhciBjb25maWcgPSB7XG4gICAgbm9kZVNlcDogNTAsXG4gICAgZWRnZVNlcDogMTAsXG4gICAgdW5pdmVyc2FsU2VwOiBudWxsLFxuICAgIHJhbmtTZXA6IDMwXG4gIH07XG5cbiAgdmFyIHNlbGYgPSB7fTtcblxuICBzZWxmLm5vZGVTZXAgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnbm9kZVNlcCcpO1xuICBzZWxmLmVkZ2VTZXAgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAnZWRnZVNlcCcpO1xuICAvLyBJZiBub3QgbnVsbCB0aGlzIHNlcGFyYXRpb24gdmFsdWUgaXMgdXNlZCBmb3IgYWxsIG5vZGVzIGFuZCBlZGdlc1xuICAvLyByZWdhcmRsZXNzIG9mIHRoZWlyIHdpZHRocy4gYG5vZGVTZXBgIGFuZCBgZWRnZVNlcGAgYXJlIGlnbm9yZWQgd2l0aCB0aGlzXG4gIC8vIG9wdGlvbi5cbiAgc2VsZi51bml2ZXJzYWxTZXAgPSB1dGlsLnByb3BlcnR5QWNjZXNzb3Ioc2VsZiwgY29uZmlnLCAndW5pdmVyc2FsU2VwJyk7XG4gIHNlbGYucmFua1NlcCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdyYW5rU2VwJyk7XG4gIHNlbGYuZGVidWdMZXZlbCA9IHV0aWwucHJvcGVydHlBY2Nlc3NvcihzZWxmLCBjb25maWcsICdkZWJ1Z0xldmVsJyk7XG5cbiAgc2VsZi5ydW4gPSBydW47XG5cbiAgcmV0dXJuIHNlbGY7XG5cbiAgZnVuY3Rpb24gcnVuKGcpIHtcbiAgICBnID0gZy5maWx0ZXJOb2Rlcyh1dGlsLmZpbHRlck5vblN1YmdyYXBocyhnKSk7XG5cbiAgICB2YXIgbGF5ZXJpbmcgPSB1dGlsLm9yZGVyaW5nKGcpO1xuXG4gICAgdmFyIGNvbmZsaWN0cyA9IGZpbmRDb25mbGljdHMoZywgbGF5ZXJpbmcpO1xuXG4gICAgdmFyIHhzcyA9IHt9O1xuICAgIFsndScsICdkJ10uZm9yRWFjaChmdW5jdGlvbih2ZXJ0RGlyKSB7XG4gICAgICBpZiAodmVydERpciA9PT0gJ2QnKSBsYXllcmluZy5yZXZlcnNlKCk7XG5cbiAgICAgIFsnbCcsICdyJ10uZm9yRWFjaChmdW5jdGlvbihob3JpekRpcikge1xuICAgICAgICBpZiAoaG9yaXpEaXIgPT09ICdyJykgcmV2ZXJzZUlubmVyT3JkZXIobGF5ZXJpbmcpO1xuXG4gICAgICAgIHZhciBkaXIgPSB2ZXJ0RGlyICsgaG9yaXpEaXI7XG4gICAgICAgIHZhciBhbGlnbiA9IHZlcnRpY2FsQWxpZ25tZW50KGcsIGxheWVyaW5nLCBjb25mbGljdHMsIHZlcnREaXIgPT09ICd1JyA/ICdwcmVkZWNlc3NvcnMnIDogJ3N1Y2Nlc3NvcnMnKTtcbiAgICAgICAgeHNzW2Rpcl09IGhvcml6b250YWxDb21wYWN0aW9uKGcsIGxheWVyaW5nLCBhbGlnbi5wb3MsIGFsaWduLnJvb3QsIGFsaWduLmFsaWduKTtcblxuICAgICAgICBpZiAoY29uZmlnLmRlYnVnTGV2ZWwgPj0gMylcbiAgICAgICAgICBkZWJ1Z1Bvc2l0aW9uaW5nKHZlcnREaXIgKyBob3JpekRpciwgZywgbGF5ZXJpbmcsIHhzc1tkaXJdKTtcblxuICAgICAgICBpZiAoaG9yaXpEaXIgPT09ICdyJykgZmxpcEhvcml6b250YWxseSh4c3NbZGlyXSk7XG5cbiAgICAgICAgaWYgKGhvcml6RGlyID09PSAncicpIHJldmVyc2VJbm5lck9yZGVyKGxheWVyaW5nKTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAodmVydERpciA9PT0gJ2QnKSBsYXllcmluZy5yZXZlcnNlKCk7XG4gICAgfSk7XG5cbiAgICBiYWxhbmNlKGcsIGxheWVyaW5nLCB4c3MpO1xuXG4gICAgZy5lYWNoTm9kZShmdW5jdGlvbih2KSB7XG4gICAgICB2YXIgeHMgPSBbXTtcbiAgICAgIGZvciAodmFyIGFsaWdubWVudCBpbiB4c3MpIHtcbiAgICAgICAgdmFyIGFsaWdubWVudFggPSB4c3NbYWxpZ25tZW50XVt2XTtcbiAgICAgICAgcG9zWERlYnVnKGFsaWdubWVudCwgZywgdiwgYWxpZ25tZW50WCk7XG4gICAgICAgIHhzLnB1c2goYWxpZ25tZW50WCk7XG4gICAgICB9XG4gICAgICB4cy5zb3J0KGZ1bmN0aW9uKHgsIHkpIHsgcmV0dXJuIHggLSB5OyB9KTtcbiAgICAgIHBvc1goZywgdiwgKHhzWzFdICsgeHNbMl0pIC8gMik7XG4gICAgfSk7XG5cbiAgICAvLyBBbGlnbiB5IGNvb3JkaW5hdGVzIHdpdGggcmFua3NcbiAgICB2YXIgeSA9IDAsIHJldmVyc2VZID0gZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdCVCcgfHwgZy5ncmFwaCgpLnJhbmtEaXIgPT09ICdSTCc7XG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgdmFyIG1heEhlaWdodCA9IHV0aWwubWF4KGxheWVyLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBoZWlnaHQoZywgdSk7IH0pKTtcbiAgICAgIHkgKz0gbWF4SGVpZ2h0IC8gMjtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgICBwb3NZKGcsIHUsIHJldmVyc2VZID8gLXkgOiB5KTtcbiAgICAgIH0pO1xuICAgICAgeSArPSBtYXhIZWlnaHQgLyAyICsgY29uZmlnLnJhbmtTZXA7XG4gICAgfSk7XG5cbiAgICAvLyBUcmFuc2xhdGUgbGF5b3V0IHNvIHRoYXQgdG9wIGxlZnQgY29ybmVyIG9mIGJvdW5kaW5nIHJlY3RhbmdsZSBoYXNcbiAgICAvLyBjb29yZGluYXRlICgwLCAwKS5cbiAgICB2YXIgbWluWCA9IHV0aWwubWluKGcubm9kZXMoKS5tYXAoZnVuY3Rpb24odSkgeyByZXR1cm4gcG9zWChnLCB1KSAtIHdpZHRoKGcsIHUpIC8gMjsgfSkpO1xuICAgIHZhciBtaW5ZID0gdXRpbC5taW4oZy5ub2RlcygpLm1hcChmdW5jdGlvbih1KSB7IHJldHVybiBwb3NZKGcsIHUpIC0gaGVpZ2h0KGcsIHUpIC8gMjsgfSkpO1xuICAgIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgICAgcG9zWChnLCB1LCBwb3NYKGcsIHUpIC0gbWluWCk7XG4gICAgICBwb3NZKGcsIHUsIHBvc1koZywgdSkgLSBtaW5ZKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIEdlbmVyYXRlIGFuIElEIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVwcmVzZW50IGFueSB1bmRpcmVjdGVkIGVkZ2UgdGhhdCBpc1xuICAgKiBpbmNpZGVudCBvbiBgdWAgYW5kIGB2YC5cbiAgICovXG4gIGZ1bmN0aW9uIHVuZGlyRWRnZUlkKHUsIHYpIHtcbiAgICByZXR1cm4gdSA8IHZcbiAgICAgID8gdS50b1N0cmluZygpLmxlbmd0aCArICc6JyArIHUgKyAnLScgKyB2XG4gICAgICA6IHYudG9TdHJpbmcoKS5sZW5ndGggKyAnOicgKyB2ICsgJy0nICsgdTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRDb25mbGljdHMoZywgbGF5ZXJpbmcpIHtcbiAgICB2YXIgY29uZmxpY3RzID0ge30sIC8vIFNldCBvZiBjb25mbGljdGluZyBlZGdlIGlkc1xuICAgICAgICBwb3MgPSB7fSwgICAgICAgLy8gUG9zaXRpb24gb2Ygbm9kZSBpbiBpdHMgbGF5ZXJcbiAgICAgICAgcHJldkxheWVyLFxuICAgICAgICBjdXJyTGF5ZXIsXG4gICAgICAgIGswLCAgICAgLy8gUG9zaXRpb24gb2YgdGhlIGxhc3QgaW5uZXIgc2VnbWVudCBpbiB0aGUgcHJldmlvdXMgbGF5ZXJcbiAgICAgICAgbCwgICAgICAvLyBDdXJyZW50IHBvc2l0aW9uIGluIHRoZSBjdXJyZW50IGxheWVyIChmb3IgaXRlcmF0aW9uIHVwIHRvIGBsMWApXG4gICAgICAgIGsxOyAgICAgLy8gUG9zaXRpb24gb2YgdGhlIG5leHQgaW5uZXIgc2VnbWVudCBpbiB0aGUgcHJldmlvdXMgbGF5ZXIgb3JcbiAgICAgICAgICAgICAgICAvLyB0aGUgcG9zaXRpb24gb2YgdGhlIGxhc3QgZWxlbWVudCBpbiB0aGUgcHJldmlvdXMgbGF5ZXJcblxuICAgIGlmIChsYXllcmluZy5sZW5ndGggPD0gMikgcmV0dXJuIGNvbmZsaWN0cztcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUNvbmZsaWN0cyh2KSB7XG4gICAgICB2YXIgayA9IHBvc1t2XTtcbiAgICAgIGlmIChrIDwgazAgfHwgayA+IGsxKSB7XG4gICAgICAgIGNvbmZsaWN0c1t1bmRpckVkZ2VJZChjdXJyTGF5ZXJbbF0sIHYpXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGF5ZXJpbmdbMV0uZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7IHBvc1t1XSA9IGk7IH0pO1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbGF5ZXJpbmcubGVuZ3RoIC0gMTsgKytpKSB7XG4gICAgICBwcmV2TGF5ZXIgPSBsYXllcmluZ1tpXTtcbiAgICAgIGN1cnJMYXllciA9IGxheWVyaW5nW2krMV07XG4gICAgICBrMCA9IDA7XG4gICAgICBsID0gMDtcblxuICAgICAgLy8gU2NhbiBjdXJyZW50IGxheWVyIGZvciBuZXh0IG5vZGUgdGhhdCBpcyBpbmNpZGVudCB0byBhbiBpbm5lciBzZWdlbWVudFxuICAgICAgLy8gYmV0d2VlbiBsYXllcmluZ1tpKzFdIGFuZCBsYXllcmluZ1tpXS5cbiAgICAgIGZvciAodmFyIGwxID0gMDsgbDEgPCBjdXJyTGF5ZXIubGVuZ3RoOyArK2wxKSB7XG4gICAgICAgIHZhciB1ID0gY3VyckxheWVyW2wxXTsgLy8gTmV4dCBpbm5lciBzZWdtZW50IGluIHRoZSBjdXJyZW50IGxheWVyIG9yXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGFzdCBub2RlIGluIHRoZSBjdXJyZW50IGxheWVyXG4gICAgICAgIHBvc1t1XSA9IGwxO1xuICAgICAgICBrMSA9IHVuZGVmaW5lZDtcblxuICAgICAgICBpZiAoZy5ub2RlKHUpLmR1bW15KSB7XG4gICAgICAgICAgdmFyIHVQcmVkID0gZy5wcmVkZWNlc3NvcnModSlbMF07XG4gICAgICAgICAgLy8gTm90ZTogSW4gdGhlIGNhc2Ugb2Ygc2VsZiBsb29wcyBhbmQgc2lkZXdheXMgZWRnZXMgaXQgaXMgcG9zc2libGVcbiAgICAgICAgICAvLyBmb3IgYSBkdW1teSBub3QgdG8gaGF2ZSBhIHByZWRlY2Vzc29yLlxuICAgICAgICAgIGlmICh1UHJlZCAhPT0gdW5kZWZpbmVkICYmIGcubm9kZSh1UHJlZCkuZHVtbXkpXG4gICAgICAgICAgICBrMSA9IHBvc1t1UHJlZF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGsxID09PSB1bmRlZmluZWQgJiYgbDEgPT09IGN1cnJMYXllci5sZW5ndGggLSAxKVxuICAgICAgICAgIGsxID0gcHJldkxheWVyLmxlbmd0aCAtIDE7XG5cbiAgICAgICAgaWYgKGsxICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBmb3IgKDsgbCA8PSBsMTsgKytsKSB7XG4gICAgICAgICAgICBnLnByZWRlY2Vzc29ycyhjdXJyTGF5ZXJbbF0pLmZvckVhY2godXBkYXRlQ29uZmxpY3RzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgazAgPSBrMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjb25mbGljdHM7XG4gIH1cblxuICBmdW5jdGlvbiB2ZXJ0aWNhbEFsaWdubWVudChnLCBsYXllcmluZywgY29uZmxpY3RzLCByZWxhdGlvbnNoaXApIHtcbiAgICB2YXIgcG9zID0ge30sICAgLy8gUG9zaXRpb24gZm9yIGEgbm9kZSBpbiBpdHMgbGF5ZXJcbiAgICAgICAgcm9vdCA9IHt9LCAgLy8gUm9vdCBvZiB0aGUgYmxvY2sgdGhhdCB0aGUgbm9kZSBwYXJ0aWNpcGF0ZXMgaW5cbiAgICAgICAgYWxpZ24gPSB7fTsgLy8gUG9pbnRzIHRvIHRoZSBuZXh0IG5vZGUgaW4gdGhlIGJsb2NrIG9yLCBpZiB0aGUgbGFzdFxuICAgICAgICAgICAgICAgICAgICAvLyBlbGVtZW50IGluIHRoZSBibG9jaywgcG9pbnRzIHRvIHRoZSBmaXJzdCBibG9jaydzIHJvb3RcblxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odSwgaSkge1xuICAgICAgICByb290W3VdID0gdTtcbiAgICAgICAgYWxpZ25bdV0gPSB1O1xuICAgICAgICBwb3NbdV0gPSBpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICB2YXIgcHJldklkeCA9IC0xO1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgIHZhciByZWxhdGVkID0gZ1tyZWxhdGlvbnNoaXBdKHYpLCAvLyBBZGphY2VudCBub2RlcyBmcm9tIHRoZSBwcmV2aW91cyBsYXllclxuICAgICAgICAgICAgbWlkOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlIG1pZCBwb2ludCBpbiB0aGUgcmVsYXRlZCBhcnJheVxuXG4gICAgICAgIGlmIChyZWxhdGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZWxhdGVkLnNvcnQoZnVuY3Rpb24oeCwgeSkgeyByZXR1cm4gcG9zW3hdIC0gcG9zW3ldOyB9KTtcbiAgICAgICAgICBtaWQgPSAocmVsYXRlZC5sZW5ndGggLSAxKSAvIDI7XG4gICAgICAgICAgcmVsYXRlZC5zbGljZShNYXRoLmZsb29yKG1pZCksIE1hdGguY2VpbChtaWQpICsgMSkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAgICAgICBpZiAoYWxpZ25bdl0gPT09IHYpIHtcbiAgICAgICAgICAgICAgaWYgKCFjb25mbGljdHNbdW5kaXJFZGdlSWQodSwgdildICYmIHByZXZJZHggPCBwb3NbdV0pIHtcbiAgICAgICAgICAgICAgICBhbGlnblt1XSA9IHY7XG4gICAgICAgICAgICAgICAgYWxpZ25bdl0gPSByb290W3ZdID0gcm9vdFt1XTtcbiAgICAgICAgICAgICAgICBwcmV2SWR4ID0gcG9zW3VdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgcG9zOiBwb3MsIHJvb3Q6IHJvb3QsIGFsaWduOiBhbGlnbiB9O1xuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBkZXZpYXRlcyBmcm9tIHRoZSBzdGFuZGFyZCBCSyBhbGdvcml0aG0gaW4gdHdvIHdheXMuIEZpcnN0XG4gIC8vIGl0IHRha2VzIGludG8gYWNjb3VudCB0aGUgc2l6ZSBvZiB0aGUgbm9kZXMuIFNlY29uZCBpdCBpbmNsdWRlcyBhIGZpeCB0b1xuICAvLyB0aGUgb3JpZ2luYWwgYWxnb3JpdGhtIHRoYXQgaXMgZGVzY3JpYmVkIGluIENhcnN0ZW5zLCBcIk5vZGUgYW5kIExhYmVsXG4gIC8vIFBsYWNlbWVudCBpbiBhIExheWVyZWQgTGF5b3V0IEFsZ29yaXRobVwiLlxuICBmdW5jdGlvbiBob3Jpem9udGFsQ29tcGFjdGlvbihnLCBsYXllcmluZywgcG9zLCByb290LCBhbGlnbikge1xuICAgIHZhciBzaW5rID0ge30sICAgICAgIC8vIE1hcHBpbmcgb2Ygbm9kZSBpZCAtPiBzaW5rIG5vZGUgaWQgZm9yIGNsYXNzXG4gICAgICAgIG1heWJlU2hpZnQgPSB7fSwgLy8gTWFwcGluZyBvZiBzaW5rIG5vZGUgaWQgLT4geyBjbGFzcyBub2RlIGlkLCBtaW4gc2hpZnQgfVxuICAgICAgICBzaGlmdCA9IHt9LCAgICAgIC8vIE1hcHBpbmcgb2Ygc2luayBub2RlIGlkIC0+IHNoaWZ0XG4gICAgICAgIHByZWQgPSB7fSwgICAgICAgLy8gTWFwcGluZyBvZiBub2RlIGlkIC0+IHByZWRlY2Vzc29yIG5vZGUgKG9yIG51bGwpXG4gICAgICAgIHhzID0ge307ICAgICAgICAgLy8gQ2FsY3VsYXRlZCBYIHBvc2l0aW9uc1xuXG4gICAgbGF5ZXJpbmcuZm9yRWFjaChmdW5jdGlvbihsYXllcikge1xuICAgICAgbGF5ZXIuZm9yRWFjaChmdW5jdGlvbih1LCBpKSB7XG4gICAgICAgIHNpbmtbdV0gPSB1O1xuICAgICAgICBtYXliZVNoaWZ0W3VdID0ge307XG4gICAgICAgIGlmIChpID4gMClcbiAgICAgICAgICBwcmVkW3VdID0gbGF5ZXJbaSAtIDFdO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVTaGlmdCh0b1NoaWZ0LCBuZWlnaGJvciwgZGVsdGEpIHtcbiAgICAgIGlmICghKG5laWdoYm9yIGluIG1heWJlU2hpZnRbdG9TaGlmdF0pKSB7XG4gICAgICAgIG1heWJlU2hpZnRbdG9TaGlmdF1bbmVpZ2hib3JdID0gZGVsdGE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtYXliZVNoaWZ0W3RvU2hpZnRdW25laWdoYm9yXSA9IE1hdGgubWluKG1heWJlU2hpZnRbdG9TaGlmdF1bbmVpZ2hib3JdLCBkZWx0YSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGxhY2VCbG9jayh2KSB7XG4gICAgICBpZiAoISh2IGluIHhzKSkge1xuICAgICAgICB4c1t2XSA9IDA7XG4gICAgICAgIHZhciB3ID0gdjtcbiAgICAgICAgZG8ge1xuICAgICAgICAgIGlmIChwb3Nbd10gPiAwKSB7XG4gICAgICAgICAgICB2YXIgdSA9IHJvb3RbcHJlZFt3XV07XG4gICAgICAgICAgICBwbGFjZUJsb2NrKHUpO1xuICAgICAgICAgICAgaWYgKHNpbmtbdl0gPT09IHYpIHtcbiAgICAgICAgICAgICAgc2lua1t2XSA9IHNpbmtbdV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgZGVsdGEgPSBzZXAoZywgcHJlZFt3XSkgKyBzZXAoZywgdyk7XG4gICAgICAgICAgICBpZiAoc2lua1t2XSAhPT0gc2lua1t1XSkge1xuICAgICAgICAgICAgICB1cGRhdGVTaGlmdChzaW5rW3VdLCBzaW5rW3ZdLCB4c1t2XSAtIHhzW3VdIC0gZGVsdGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgeHNbdl0gPSBNYXRoLm1heCh4c1t2XSwgeHNbdV0gKyBkZWx0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHcgPSBhbGlnblt3XTtcbiAgICAgICAgfSB3aGlsZSAodyAhPT0gdik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUm9vdCBjb29yZGluYXRlcyByZWxhdGl2ZSB0byBzaW5rXG4gICAgdXRpbC52YWx1ZXMocm9vdCkuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICBwbGFjZUJsb2NrKHYpO1xuICAgIH0pO1xuXG4gICAgLy8gQWJzb2x1dGUgY29vcmRpbmF0ZXNcbiAgICAvLyBUaGVyZSBpcyBhbiBhc3N1bXB0aW9uIGhlcmUgdGhhdCB3ZSd2ZSByZXNvbHZlZCBzaGlmdHMgZm9yIGFueSBjbGFzc2VzXG4gICAgLy8gdGhhdCBiZWdpbiBhdCBhbiBlYXJsaWVyIGxheWVyLiBXZSBndWFyYW50ZWUgdGhpcyBieSB2aXNpdGluZyBsYXllcnMgaW5cbiAgICAvLyBvcmRlci5cbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICBsYXllci5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgeHNbdl0gPSB4c1tyb290W3ZdXTtcbiAgICAgICAgaWYgKHYgPT09IHJvb3Rbdl0gJiYgdiA9PT0gc2lua1t2XSkge1xuICAgICAgICAgIHZhciBtaW5TaGlmdCA9IDA7XG4gICAgICAgICAgaWYgKHYgaW4gbWF5YmVTaGlmdCAmJiBPYmplY3Qua2V5cyhtYXliZVNoaWZ0W3ZdKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBtaW5TaGlmdCA9IHV0aWwubWluKE9iamVjdC5rZXlzKG1heWJlU2hpZnRbdl0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGZ1bmN0aW9uKHUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1heWJlU2hpZnRbdl1bdV0gKyAodSBpbiBzaGlmdCA/IHNoaWZ0W3VdIDogMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzaGlmdFt2XSA9IG1pblNoaWZ0O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obGF5ZXIpIHtcbiAgICAgIGxheWVyLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgICB4c1t2XSArPSBzaGlmdFtzaW5rW3Jvb3Rbdl1dXSB8fCAwO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4geHM7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5kTWluQ29vcmQoZywgbGF5ZXJpbmcsIHhzKSB7XG4gICAgcmV0dXJuIHV0aWwubWluKGxheWVyaW5nLm1hcChmdW5jdGlvbihsYXllcikge1xuICAgICAgdmFyIHUgPSBsYXllclswXTtcbiAgICAgIHJldHVybiB4c1t1XTtcbiAgICB9KSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5kTWF4Q29vcmQoZywgbGF5ZXJpbmcsIHhzKSB7XG4gICAgcmV0dXJuIHV0aWwubWF4KGxheWVyaW5nLm1hcChmdW5jdGlvbihsYXllcikge1xuICAgICAgdmFyIHUgPSBsYXllcltsYXllci5sZW5ndGggLSAxXTtcbiAgICAgIHJldHVybiB4c1t1XTtcbiAgICB9KSk7XG4gIH1cblxuICBmdW5jdGlvbiBiYWxhbmNlKGcsIGxheWVyaW5nLCB4c3MpIHtcbiAgICB2YXIgbWluID0ge30sICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1pbiBjb29yZGluYXRlIGZvciB0aGUgYWxpZ25tZW50XG4gICAgICAgIG1heCA9IHt9LCAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNYXggY29vcmRpbmF0ZSBmb3IgdGhlIGFsZ2lubWVudFxuICAgICAgICBzbWFsbGVzdEFsaWdubWVudCxcbiAgICAgICAgc2hpZnQgPSB7fTsgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFtb3VudCB0byBzaGlmdCBhIGdpdmVuIGFsaWdubWVudFxuXG4gICAgZnVuY3Rpb24gdXBkYXRlQWxpZ25tZW50KHYpIHtcbiAgICAgIHhzc1thbGlnbm1lbnRdW3ZdICs9IHNoaWZ0W2FsaWdubWVudF07XG4gICAgfVxuXG4gICAgdmFyIHNtYWxsZXN0ID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgIGZvciAodmFyIGFsaWdubWVudCBpbiB4c3MpIHtcbiAgICAgIHZhciB4cyA9IHhzc1thbGlnbm1lbnRdO1xuICAgICAgbWluW2FsaWdubWVudF0gPSBmaW5kTWluQ29vcmQoZywgbGF5ZXJpbmcsIHhzKTtcbiAgICAgIG1heFthbGlnbm1lbnRdID0gZmluZE1heENvb3JkKGcsIGxheWVyaW5nLCB4cyk7XG4gICAgICB2YXIgdyA9IG1heFthbGlnbm1lbnRdIC0gbWluW2FsaWdubWVudF07XG4gICAgICBpZiAodyA8IHNtYWxsZXN0KSB7XG4gICAgICAgIHNtYWxsZXN0ID0gdztcbiAgICAgICAgc21hbGxlc3RBbGlnbm1lbnQgPSBhbGlnbm1lbnQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRGV0ZXJtaW5lIGhvdyBtdWNoIHRvIGFkanVzdCBwb3NpdGlvbmluZyBmb3IgZWFjaCBhbGlnbm1lbnRcbiAgICBbJ3UnLCAnZCddLmZvckVhY2goZnVuY3Rpb24odmVydERpcikge1xuICAgICAgWydsJywgJ3InXS5mb3JFYWNoKGZ1bmN0aW9uKGhvcml6RGlyKSB7XG4gICAgICAgIHZhciBhbGlnbm1lbnQgPSB2ZXJ0RGlyICsgaG9yaXpEaXI7XG4gICAgICAgIHNoaWZ0W2FsaWdubWVudF0gPSBob3JpekRpciA9PT0gJ2wnXG4gICAgICAgICAgICA/IG1pbltzbWFsbGVzdEFsaWdubWVudF0gLSBtaW5bYWxpZ25tZW50XVxuICAgICAgICAgICAgOiBtYXhbc21hbGxlc3RBbGlnbm1lbnRdIC0gbWF4W2FsaWdubWVudF07XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIEZpbmQgYXZlcmFnZSBvZiBtZWRpYW5zIGZvciB4c3MgYXJyYXlcbiAgICBmb3IgKGFsaWdubWVudCBpbiB4c3MpIHtcbiAgICAgIGcuZWFjaE5vZGUodXBkYXRlQWxpZ25tZW50KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBmbGlwSG9yaXpvbnRhbGx5KHhzKSB7XG4gICAgZm9yICh2YXIgdSBpbiB4cykge1xuICAgICAgeHNbdV0gPSAteHNbdV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmV2ZXJzZUlubmVyT3JkZXIobGF5ZXJpbmcpIHtcbiAgICBsYXllcmluZy5mb3JFYWNoKGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgICBsYXllci5yZXZlcnNlKCk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiB3aWR0aChnLCB1KSB7XG4gICAgc3dpdGNoIChnLmdyYXBoKCkucmFua0Rpcikge1xuICAgICAgY2FzZSAnTFInOiByZXR1cm4gZy5ub2RlKHUpLmhlaWdodDtcbiAgICAgIGNhc2UgJ1JMJzogcmV0dXJuIGcubm9kZSh1KS5oZWlnaHQ7XG4gICAgICBkZWZhdWx0OiAgIHJldHVybiBnLm5vZGUodSkud2lkdGg7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGVpZ2h0KGcsIHUpIHtcbiAgICBzd2l0Y2goZy5ncmFwaCgpLnJhbmtEaXIpIHtcbiAgICAgIGNhc2UgJ0xSJzogcmV0dXJuIGcubm9kZSh1KS53aWR0aDtcbiAgICAgIGNhc2UgJ1JMJzogcmV0dXJuIGcubm9kZSh1KS53aWR0aDtcbiAgICAgIGRlZmF1bHQ6ICAgcmV0dXJuIGcubm9kZSh1KS5oZWlnaHQ7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2VwKGcsIHUpIHtcbiAgICBpZiAoY29uZmlnLnVuaXZlcnNhbFNlcCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGNvbmZpZy51bml2ZXJzYWxTZXA7XG4gICAgfVxuICAgIHZhciB3ID0gd2lkdGgoZywgdSk7XG4gICAgdmFyIHMgPSBnLm5vZGUodSkuZHVtbXkgPyBjb25maWcuZWRnZVNlcCA6IGNvbmZpZy5ub2RlU2VwO1xuICAgIHJldHVybiAodyArIHMpIC8gMjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc1goZywgdSwgeCkge1xuICAgIGlmIChnLmdyYXBoKCkucmFua0RpciA9PT0gJ0xSJyB8fCBnLmdyYXBoKCkucmFua0RpciA9PT0gJ1JMJykge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSkueTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KS55ID0geDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSkueDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KS54ID0geDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwb3NYRGVidWcobmFtZSwgZywgdSwgeCkge1xuICAgIGlmIChnLmdyYXBoKCkucmFua0RpciA9PT0gJ0xSJyB8fCBnLmdyYXBoKCkucmFua0RpciA9PT0gJ1JMJykge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHJldHVybiBnLm5vZGUodSlbbmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnLm5vZGUodSlbbmFtZV0gPSB4O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KVtuYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGcubm9kZSh1KVtuYW1lXSA9IHg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcG9zWShnLCB1LCB5KSB7XG4gICAgaWYgKGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnTFInIHx8IGcuZ3JhcGgoKS5yYW5rRGlyID09PSAnUkwnKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KS54O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpLnggPSB5O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgcmV0dXJuIGcubm9kZSh1KS55O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZy5ub2RlKHUpLnkgPSB5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlYnVnUG9zaXRpb25pbmcoYWxpZ24sIGcsIGxheWVyaW5nLCB4cykge1xuICAgIGxheWVyaW5nLmZvckVhY2goZnVuY3Rpb24obCwgbGkpIHtcbiAgICAgIHZhciB1LCB4VTtcbiAgICAgIGwuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgIHZhciB4ViA9IHhzW3ZdO1xuICAgICAgICBpZiAodSkge1xuICAgICAgICAgIHZhciBzID0gc2VwKGcsIHUpICsgc2VwKGcsIHYpO1xuICAgICAgICAgIGlmICh4ViAtIHhVIDwgcylcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQb3NpdGlvbiBwaGFzZTogc2VwIHZpb2xhdGlvbi4gQWxpZ246ICcgKyBhbGlnbiArICcuIExheWVyOiAnICsgbGkgKyAnLiAnICtcbiAgICAgICAgICAgICAgJ1U6ICcgKyB1ICsgJyBWOiAnICsgdiArICcuIEFjdHVhbCBzZXA6ICcgKyAoeFYgLSB4VSkgKyAnIEV4cGVjdGVkIHNlcDogJyArIHMpO1xuICAgICAgICB9XG4gICAgICAgIHUgPSB2O1xuICAgICAgICB4VSA9IHhWO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn07XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGFjeWNsaWMgPSByZXF1aXJlKCcuL3JhbmsvYWN5Y2xpYycpLFxuICAgIGluaXRSYW5rID0gcmVxdWlyZSgnLi9yYW5rL2luaXRSYW5rJyksXG4gICAgZmVhc2libGVUcmVlID0gcmVxdWlyZSgnLi9yYW5rL2ZlYXNpYmxlVHJlZScpLFxuICAgIGNvbnN0cmFpbnRzID0gcmVxdWlyZSgnLi9yYW5rL2NvbnN0cmFpbnRzJyksXG4gICAgc2ltcGxleCA9IHJlcXVpcmUoJy4vcmFuay9zaW1wbGV4JyksXG4gICAgY29tcG9uZW50cyA9IHJlcXVpcmUoJ2dyYXBobGliJykuYWxnLmNvbXBvbmVudHMsXG4gICAgZmlsdGVyID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5maWx0ZXI7XG5cbmV4cG9ydHMucnVuID0gcnVuO1xuZXhwb3J0cy5yZXN0b3JlRWRnZXMgPSByZXN0b3JlRWRnZXM7XG5cbi8qXG4gKiBIZXVyaXN0aWMgZnVuY3Rpb24gdGhhdCBhc3NpZ25zIGEgcmFuayB0byBlYWNoIG5vZGUgb2YgdGhlIGlucHV0IGdyYXBoIHdpdGhcbiAqIHRoZSBpbnRlbnQgb2YgbWluaW1pemluZyBlZGdlIGxlbmd0aHMsIHdoaWxlIHJlc3BlY3RpbmcgdGhlIGBtaW5MZW5gXG4gKiBhdHRyaWJ1dGUgb2YgaW5jaWRlbnQgZWRnZXMuXG4gKlxuICogUHJlcmVxdWlzaXRlczpcbiAqXG4gKiAgKiBFYWNoIGVkZ2UgaW4gdGhlIGlucHV0IGdyYXBoIG11c3QgaGF2ZSBhbiBhc3NpZ25lZCAnbWluTGVuJyBhdHRyaWJ1dGVcbiAqL1xuZnVuY3Rpb24gcnVuKGcsIHVzZVNpbXBsZXgpIHtcbiAgZXhwYW5kU2VsZkxvb3BzKGcpO1xuXG4gIC8vIElmIHRoZXJlIGFyZSByYW5rIGNvbnN0cmFpbnRzIG9uIG5vZGVzLCB0aGVuIGJ1aWxkIGEgbmV3IGdyYXBoIHRoYXRcbiAgLy8gZW5jb2RlcyB0aGUgY29uc3RyYWludHMuXG4gIHV0aWwudGltZSgnY29uc3RyYWludHMuYXBwbHknLCBjb25zdHJhaW50cy5hcHBseSkoZyk7XG5cbiAgZXhwYW5kU2lkZXdheXNFZGdlcyhnKTtcblxuICAvLyBSZXZlcnNlIGVkZ2VzIHRvIGdldCBhbiBhY3ljbGljIGdyYXBoLCB3ZSBrZWVwIHRoZSBncmFwaCBpbiBhbiBhY3ljbGljXG4gIC8vIHN0YXRlIHVudGlsIHRoZSB2ZXJ5IGVuZC5cbiAgdXRpbC50aW1lKCdhY3ljbGljJywgYWN5Y2xpYykoZyk7XG5cbiAgLy8gQ29udmVydCB0aGUgZ3JhcGggaW50byBhIGZsYXQgZ3JhcGggZm9yIHJhbmtpbmdcbiAgdmFyIGZsYXRHcmFwaCA9IGcuZmlsdGVyTm9kZXModXRpbC5maWx0ZXJOb25TdWJncmFwaHMoZykpO1xuXG4gIC8vIEFzc2lnbiBhbiBpbml0aWFsIHJhbmtpbmcgdXNpbmcgREZTLlxuICBpbml0UmFuayhmbGF0R3JhcGgpO1xuXG4gIC8vIEZvciBlYWNoIGNvbXBvbmVudCBpbXByb3ZlIHRoZSBhc3NpZ25lZCByYW5rcy5cbiAgY29tcG9uZW50cyhmbGF0R3JhcGgpLmZvckVhY2goZnVuY3Rpb24oY21wdCkge1xuICAgIHZhciBzdWJncmFwaCA9IGZsYXRHcmFwaC5maWx0ZXJOb2RlcyhmaWx0ZXIubm9kZXNGcm9tTGlzdChjbXB0KSk7XG4gICAgcmFua0NvbXBvbmVudChzdWJncmFwaCwgdXNlU2ltcGxleCk7XG4gIH0pO1xuXG4gIC8vIFJlbGF4IG9yaWdpbmFsIGNvbnN0cmFpbnRzXG4gIHV0aWwudGltZSgnY29uc3RyYWludHMucmVsYXgnLCBjb25zdHJhaW50cy5yZWxheChnKSk7XG5cbiAgLy8gV2hlbiBoYW5kbGluZyBub2RlcyB3aXRoIGNvbnN0cmFpbmVkIHJhbmtzIGl0IGlzIHBvc3NpYmxlIHRvIGVuZCB1cCB3aXRoXG4gIC8vIGVkZ2VzIHRoYXQgcG9pbnQgdG8gcHJldmlvdXMgcmFua3MuIE1vc3Qgb2YgdGhlIHN1YnNlcXVlbnQgYWxnb3JpdGhtcyBhc3N1bWVcbiAgLy8gdGhhdCBlZGdlcyBhcmUgcG9pbnRpbmcgdG8gc3VjY2Vzc2l2ZSByYW5rcyBvbmx5LiBIZXJlIHdlIHJldmVyc2UgYW55IFwiYmFja1xuICAvLyBlZGdlc1wiIGFuZCBtYXJrIHRoZW0gYXMgc3VjaC4gVGhlIGFjeWNsaWMgYWxnb3JpdGhtIHdpbGwgcmV2ZXJzZSB0aGVtIGFzIGFcbiAgLy8gcG9zdCBwcm9jZXNzaW5nIHN0ZXAuXG4gIHV0aWwudGltZSgncmVvcmllbnRFZGdlcycsIHJlb3JpZW50RWRnZXMpKGcpO1xufVxuXG5mdW5jdGlvbiByZXN0b3JlRWRnZXMoZykge1xuICBhY3ljbGljLnVuZG8oZyk7XG59XG5cbi8qXG4gKiBFeHBhbmQgc2VsZiBsb29wcyBpbnRvIHRocmVlIGR1bW15IG5vZGVzLiBPbmUgd2lsbCBzaXQgYWJvdmUgdGhlIGluY2lkZW50XG4gKiBub2RlLCBvbmUgd2lsbCBiZSBhdCB0aGUgc2FtZSBsZXZlbCwgYW5kIG9uZSBiZWxvdy4gVGhlIHJlc3VsdCBsb29rcyBsaWtlOlxuICpcbiAqICAgICAgICAgLy0tPC0teC0tLT4tLVxcXG4gKiAgICAgbm9kZSAgICAgICAgICAgICAgeVxuICogICAgICAgICBcXC0tPC0tei0tLT4tLS9cbiAqXG4gKiBEdW1teSBub2RlcyB4LCB5LCB6IGdpdmUgdXMgdGhlIHNoYXBlIG9mIGEgbG9vcCBhbmQgbm9kZSB5IGlzIHdoZXJlIHdlIHBsYWNlXG4gKiB0aGUgbGFiZWwuXG4gKlxuICogVE9ETzogY29uc29saWRhdGUga25vd2xlZGdlIG9mIGR1bW15IG5vZGUgY29uc3RydWN0aW9uLlxuICogVE9ETzogc3VwcG9ydCBtaW5MZW4gPSAyXG4gKi9cbmZ1bmN0aW9uIGV4cGFuZFNlbGZMb29wcyhnKSB7XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgYSkge1xuICAgIGlmICh1ID09PSB2KSB7XG4gICAgICB2YXIgeCA9IGFkZER1bW15Tm9kZShnLCBlLCB1LCB2LCBhLCAwLCBmYWxzZSksXG4gICAgICAgICAgeSA9IGFkZER1bW15Tm9kZShnLCBlLCB1LCB2LCBhLCAxLCB0cnVlKSxcbiAgICAgICAgICB6ID0gYWRkRHVtbXlOb2RlKGcsIGUsIHUsIHYsIGEsIDIsIGZhbHNlKTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB4LCB1LCB7bWluTGVuOiAxLCBzZWxmTG9vcDogdHJ1ZX0pO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHgsIHksIHttaW5MZW46IDEsIHNlbGZMb29wOiB0cnVlfSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgeiwge21pbkxlbjogMSwgc2VsZkxvb3A6IHRydWV9KTtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB5LCB6LCB7bWluTGVuOiAxLCBzZWxmTG9vcDogdHJ1ZX0pO1xuICAgICAgZy5kZWxFZGdlKGUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGV4cGFuZFNpZGV3YXlzRWRnZXMoZykge1xuICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIGEpIHtcbiAgICBpZiAodSA9PT0gdikge1xuICAgICAgdmFyIG9yaWdFZGdlID0gYS5vcmlnaW5hbEVkZ2UsXG4gICAgICAgICAgZHVtbXkgPSBhZGREdW1teU5vZGUoZywgb3JpZ0VkZ2UuZSwgb3JpZ0VkZ2UudSwgb3JpZ0VkZ2Uudiwgb3JpZ0VkZ2UudmFsdWUsIDAsIHRydWUpO1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIGR1bW15LCB7bWluTGVuOiAxfSk7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgZHVtbXksIHYsIHttaW5MZW46IDF9KTtcbiAgICAgIGcuZGVsRWRnZShlKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhZGREdW1teU5vZGUoZywgZSwgdSwgdiwgYSwgaW5kZXgsIGlzTGFiZWwpIHtcbiAgcmV0dXJuIGcuYWRkTm9kZShudWxsLCB7XG4gICAgd2lkdGg6IGlzTGFiZWwgPyBhLndpZHRoIDogMCxcbiAgICBoZWlnaHQ6IGlzTGFiZWwgPyBhLmhlaWdodCA6IDAsXG4gICAgZWRnZTogeyBpZDogZSwgc291cmNlOiB1LCB0YXJnZXQ6IHYsIGF0dHJzOiBhIH0sXG4gICAgZHVtbXk6IHRydWUsXG4gICAgaW5kZXg6IGluZGV4XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZW9yaWVudEVkZ2VzKGcpIHtcbiAgZy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGlmIChnLm5vZGUodSkucmFuayA+IGcubm9kZSh2KS5yYW5rKSB7XG4gICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgICB2YWx1ZS5yZXZlcnNlZCA9IHRydWU7XG4gICAgICBnLmFkZEVkZ2UoZSwgdiwgdSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJhbmtDb21wb25lbnQoc3ViZ3JhcGgsIHVzZVNpbXBsZXgpIHtcbiAgdmFyIHNwYW5uaW5nVHJlZSA9IGZlYXNpYmxlVHJlZShzdWJncmFwaCk7XG5cbiAgaWYgKHVzZVNpbXBsZXgpIHtcbiAgICB1dGlsLmxvZygxLCAnVXNpbmcgbmV0d29yayBzaW1wbGV4IGZvciByYW5raW5nJyk7XG4gICAgc2ltcGxleChzdWJncmFwaCwgc3Bhbm5pbmdUcmVlKTtcbiAgfVxuICBub3JtYWxpemUoc3ViZ3JhcGgpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemUoZykge1xuICB2YXIgbSA9IHV0aWwubWluKGcubm9kZXMoKS5tYXAoZnVuY3Rpb24odSkgeyByZXR1cm4gZy5ub2RlKHUpLnJhbms7IH0pKTtcbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCBub2RlKSB7IG5vZGUucmFuayAtPSBtOyB9KTtcbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFjeWNsaWM7XG5tb2R1bGUuZXhwb3J0cy51bmRvID0gdW5kbztcblxuLypcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYSBkaXJlY3RlZCBncmFwaCB0aGF0IG1heSBoYXZlIGN5Y2xlcyBhbmQgcmV2ZXJzZXMgZWRnZXNcbiAqIGFzIGFwcHJvcHJpYXRlIHRvIGJyZWFrIHRoZXNlIGN5Y2xlcy4gRWFjaCByZXZlcnNlZCBlZGdlIGlzIGFzc2lnbmVkIGFcbiAqIGByZXZlcnNlZGAgYXR0cmlidXRlIHdpdGggdGhlIHZhbHVlIGB0cnVlYC5cbiAqXG4gKiBUaGVyZSBzaG91bGQgYmUgbm8gc2VsZiBsb29wcyBpbiB0aGUgZ3JhcGguXG4gKi9cbmZ1bmN0aW9uIGFjeWNsaWMoZykge1xuICB2YXIgb25TdGFjayA9IHt9LFxuICAgICAgdmlzaXRlZCA9IHt9LFxuICAgICAgcmV2ZXJzZUNvdW50ID0gMDtcbiAgXG4gIGZ1bmN0aW9uIGRmcyh1KSB7XG4gICAgaWYgKHUgaW4gdmlzaXRlZCkgcmV0dXJuO1xuICAgIHZpc2l0ZWRbdV0gPSBvblN0YWNrW3VdID0gdHJ1ZTtcbiAgICBnLm91dEVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgICAgdmFyIHQgPSBnLnRhcmdldChlKSxcbiAgICAgICAgICB2YWx1ZTtcblxuICAgICAgaWYgKHUgPT09IHQpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignV2FybmluZzogZm91bmQgc2VsZiBsb29wIFwiJyArIGUgKyAnXCIgZm9yIG5vZGUgXCInICsgdSArICdcIicpO1xuICAgICAgfSBlbHNlIGlmICh0IGluIG9uU3RhY2spIHtcbiAgICAgICAgdmFsdWUgPSBnLmVkZ2UoZSk7XG4gICAgICAgIGcuZGVsRWRnZShlKTtcbiAgICAgICAgdmFsdWUucmV2ZXJzZWQgPSB0cnVlO1xuICAgICAgICArK3JldmVyc2VDb3VudDtcbiAgICAgICAgZy5hZGRFZGdlKGUsIHQsIHUsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRmcyh0KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlbGV0ZSBvblN0YWNrW3VdO1xuICB9XG5cbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7IGRmcyh1KTsgfSk7XG5cbiAgdXRpbC5sb2coMiwgJ0FjeWNsaWMgUGhhc2U6IHJldmVyc2VkICcgKyByZXZlcnNlQ291bnQgKyAnIGVkZ2UocyknKTtcblxuICByZXR1cm4gcmV2ZXJzZUNvdW50O1xufVxuXG4vKlxuICogR2l2ZW4gYSBncmFwaCB0aGF0IGhhcyBoYWQgdGhlIGFjeWNsaWMgb3BlcmF0aW9uIGFwcGxpZWQsIHRoaXMgZnVuY3Rpb25cbiAqIHVuZG9lcyB0aGF0IG9wZXJhdGlvbi4gTW9yZSBzcGVjaWZpY2FsbHksIGFueSBlZGdlIHdpdGggdGhlIGByZXZlcnNlZGBcbiAqIGF0dHJpYnV0ZSBpcyBhZ2FpbiByZXZlcnNlZCB0byByZXN0b3JlIHRoZSBvcmlnaW5hbCBkaXJlY3Rpb24gb2YgdGhlIGVkZ2UuXG4gKi9cbmZ1bmN0aW9uIHVuZG8oZykge1xuICBnLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHMsIHQsIGEpIHtcbiAgICBpZiAoYS5yZXZlcnNlZCkge1xuICAgICAgZGVsZXRlIGEucmV2ZXJzZWQ7XG4gICAgICBnLmRlbEVkZ2UoZSk7XG4gICAgICBnLmFkZEVkZ2UoZSwgdCwgcywgYSk7XG4gICAgfVxuICB9KTtcbn1cbiIsImV4cG9ydHMuYXBwbHkgPSBmdW5jdGlvbihnKSB7XG4gIGZ1bmN0aW9uIGRmcyhzZykge1xuICAgIHZhciByYW5rU2V0cyA9IHt9O1xuICAgIGcuY2hpbGRyZW4oc2cpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgaWYgKGcuY2hpbGRyZW4odSkubGVuZ3RoKSB7XG4gICAgICAgIGRmcyh1KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgdmFsdWUgPSBnLm5vZGUodSksXG4gICAgICAgICAgcHJlZlJhbmsgPSB2YWx1ZS5wcmVmUmFuaztcbiAgICAgIGlmIChwcmVmUmFuayAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICghY2hlY2tTdXBwb3J0ZWRQcmVmUmFuayhwcmVmUmFuaykpIHsgcmV0dXJuOyB9XG5cbiAgICAgICAgaWYgKCEocHJlZlJhbmsgaW4gcmFua1NldHMpKSB7XG4gICAgICAgICAgcmFua1NldHMucHJlZlJhbmsgPSBbdV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmFua1NldHMucHJlZlJhbmsucHVzaCh1KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBuZXdVID0gcmFua1NldHNbcHJlZlJhbmtdO1xuICAgICAgICBpZiAobmV3VSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbmV3VSA9IHJhbmtTZXRzW3ByZWZSYW5rXSA9IGcuYWRkTm9kZShudWxsLCB7IG9yaWdpbmFsTm9kZXM6IFtdIH0pO1xuICAgICAgICAgIGcucGFyZW50KG5ld1UsIHNnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlZGlyZWN0SW5FZGdlcyhnLCB1LCBuZXdVLCBwcmVmUmFuayA9PT0gJ21pbicpO1xuICAgICAgICByZWRpcmVjdE91dEVkZ2VzKGcsIHUsIG5ld1UsIHByZWZSYW5rID09PSAnbWF4Jyk7XG5cbiAgICAgICAgLy8gU2F2ZSBvcmlnaW5hbCBub2RlIGFuZCByZW1vdmUgaXQgZnJvbSByZWR1Y2VkIGdyYXBoXG4gICAgICAgIGcubm9kZShuZXdVKS5vcmlnaW5hbE5vZGVzLnB1c2goeyB1OiB1LCB2YWx1ZTogdmFsdWUsIHBhcmVudDogc2cgfSk7XG4gICAgICAgIGcuZGVsTm9kZSh1KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGFkZExpZ2h0RWRnZXNGcm9tTWluTm9kZShnLCBzZywgcmFua1NldHMubWluKTtcbiAgICBhZGRMaWdodEVkZ2VzVG9NYXhOb2RlKGcsIHNnLCByYW5rU2V0cy5tYXgpO1xuICB9XG5cbiAgZGZzKG51bGwpO1xufTtcblxuZnVuY3Rpb24gY2hlY2tTdXBwb3J0ZWRQcmVmUmFuayhwcmVmUmFuaykge1xuICBpZiAocHJlZlJhbmsgIT09ICdtaW4nICYmIHByZWZSYW5rICE9PSAnbWF4JyAmJiBwcmVmUmFuay5pbmRleE9mKCdzYW1lXycpICE9PSAwKSB7XG4gICAgY29uc29sZS5lcnJvcignVW5zdXBwb3J0ZWQgcmFuayB0eXBlOiAnICsgcHJlZlJhbmspO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gcmVkaXJlY3RJbkVkZ2VzKGcsIHUsIG5ld1UsIHJldmVyc2UpIHtcbiAgZy5pbkVkZ2VzKHUpLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgIHZhciBvcmlnVmFsdWUgPSBnLmVkZ2UoZSksXG4gICAgICAgIHZhbHVlO1xuICAgIGlmIChvcmlnVmFsdWUub3JpZ2luYWxFZGdlKSB7XG4gICAgICB2YWx1ZSA9IG9yaWdWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSAge1xuICAgICAgICBvcmlnaW5hbEVkZ2U6IHsgZTogZSwgdTogZy5zb3VyY2UoZSksIHY6IGcudGFyZ2V0KGUpLCB2YWx1ZTogb3JpZ1ZhbHVlIH0sXG4gICAgICAgIG1pbkxlbjogZy5lZGdlKGUpLm1pbkxlblxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEbyBub3QgcmV2ZXJzZSBlZGdlcyBmb3Igc2VsZi1sb29wcy5cbiAgICBpZiAob3JpZ1ZhbHVlLnNlbGZMb29wKSB7XG4gICAgICByZXZlcnNlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHJldmVyc2UpIHtcbiAgICAgIC8vIEVuc3VyZSB0aGF0IGFsbCBlZGdlcyB0byBtaW4gYXJlIHJldmVyc2VkXG4gICAgICBnLmFkZEVkZ2UobnVsbCwgbmV3VSwgZy5zb3VyY2UoZSksIHZhbHVlKTtcbiAgICAgIHZhbHVlLnJldmVyc2VkID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIGcuc291cmNlKGUpLCBuZXdVLCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVkaXJlY3RPdXRFZGdlcyhnLCB1LCBuZXdVLCByZXZlcnNlKSB7XG4gIGcub3V0RWRnZXModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgdmFyIG9yaWdWYWx1ZSA9IGcuZWRnZShlKSxcbiAgICAgICAgdmFsdWU7XG4gICAgaWYgKG9yaWdWYWx1ZS5vcmlnaW5hbEVkZ2UpIHtcbiAgICAgIHZhbHVlID0gb3JpZ1ZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9ICB7XG4gICAgICAgIG9yaWdpbmFsRWRnZTogeyBlOiBlLCB1OiBnLnNvdXJjZShlKSwgdjogZy50YXJnZXQoZSksIHZhbHVlOiBvcmlnVmFsdWUgfSxcbiAgICAgICAgbWluTGVuOiBnLmVkZ2UoZSkubWluTGVuXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERvIG5vdCByZXZlcnNlIGVkZ2VzIGZvciBzZWxmLWxvb3BzLlxuICAgIGlmIChvcmlnVmFsdWUuc2VsZkxvb3ApIHtcbiAgICAgIHJldmVyc2UgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAocmV2ZXJzZSkge1xuICAgICAgLy8gRW5zdXJlIHRoYXQgYWxsIGVkZ2VzIGZyb20gbWF4IGFyZSByZXZlcnNlZFxuICAgICAgZy5hZGRFZGdlKG51bGwsIGcudGFyZ2V0KGUpLCBuZXdVLCB2YWx1ZSk7XG4gICAgICB2YWx1ZS5yZXZlcnNlZCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCBuZXdVLCBnLnRhcmdldChlKSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGFkZExpZ2h0RWRnZXNGcm9tTWluTm9kZShnLCBzZywgbWluTm9kZSkge1xuICBpZiAobWluTm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZy5jaGlsZHJlbihzZykuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICAvLyBUaGUgZHVtbXkgY2hlY2sgZW5zdXJlcyB3ZSBkb24ndCBhZGQgYW4gZWRnZSBpZiB0aGUgbm9kZSBpcyBpbnZvbHZlZFxuICAgICAgLy8gaW4gYSBzZWxmIGxvb3Agb3Igc2lkZXdheXMgZWRnZS5cbiAgICAgIGlmICh1ICE9PSBtaW5Ob2RlICYmICFnLm91dEVkZ2VzKG1pbk5vZGUsIHUpLmxlbmd0aCAmJiAhZy5ub2RlKHUpLmR1bW15KSB7XG4gICAgICAgIGcuYWRkRWRnZShudWxsLCBtaW5Ob2RlLCB1LCB7IG1pbkxlbjogMCB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRMaWdodEVkZ2VzVG9NYXhOb2RlKGcsIHNnLCBtYXhOb2RlKSB7XG4gIGlmIChtYXhOb2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICBnLmNoaWxkcmVuKHNnKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIC8vIFRoZSBkdW1teSBjaGVjayBlbnN1cmVzIHdlIGRvbid0IGFkZCBhbiBlZGdlIGlmIHRoZSBub2RlIGlzIGludm9sdmVkXG4gICAgICAvLyBpbiBhIHNlbGYgbG9vcCBvciBzaWRld2F5cyBlZGdlLlxuICAgICAgaWYgKHUgIT09IG1heE5vZGUgJiYgIWcub3V0RWRnZXModSwgbWF4Tm9kZSkubGVuZ3RoICYmICFnLm5vZGUodSkuZHVtbXkpIHtcbiAgICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIG1heE5vZGUsIHsgbWluTGVuOiAwIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbi8qXG4gKiBUaGlzIGZ1bmN0aW9uIFwicmVsYXhlc1wiIHRoZSBjb25zdHJhaW50cyBhcHBsaWVkIHByZXZpb3VzbHkgYnkgdGhlIFwiYXBwbHlcIlxuICogZnVuY3Rpb24uIEl0IGV4cGFuZHMgYW55IG5vZGVzIHRoYXQgd2VyZSBjb2xsYXBzZWQgYW5kIGFzc2lnbnMgdGhlIHJhbmsgb2ZcbiAqIHRoZSBjb2xsYXBzZWQgbm9kZSB0byBlYWNoIG9mIHRoZSBleHBhbmRlZCBub2Rlcy4gSXQgYWxzbyByZXN0b3JlcyB0aGVcbiAqIG9yaWdpbmFsIGVkZ2VzIGFuZCByZW1vdmVzIGFueSBkdW1teSBlZGdlcyBwb2ludGluZyBhdCB0aGUgY29sbGFwc2VkIG5vZGVzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgcHJvY2VzcyBvZiByZW1vdmluZyBjb2xsYXBzZWQgbm9kZXMgYWxzbyByZW1vdmVzIGR1bW15IGVkZ2VzXG4gKiBhdXRvbWF0aWNhbGx5LlxuICovXG5leHBvcnRzLnJlbGF4ID0gZnVuY3Rpb24oZykge1xuICAvLyBTYXZlIG9yaWdpbmFsIGVkZ2VzXG4gIHZhciBvcmlnaW5hbEVkZ2VzID0gW107XG4gIGcuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICB2YXIgb3JpZ2luYWxFZGdlID0gdmFsdWUub3JpZ2luYWxFZGdlO1xuICAgIGlmIChvcmlnaW5hbEVkZ2UpIHtcbiAgICAgIG9yaWdpbmFsRWRnZXMucHVzaChvcmlnaW5hbEVkZ2UpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gRXhwYW5kIGNvbGxhcHNlZCBub2Rlc1xuICBnLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgdmFyIG9yaWdpbmFsTm9kZXMgPSB2YWx1ZS5vcmlnaW5hbE5vZGVzO1xuICAgIGlmIChvcmlnaW5hbE5vZGVzKSB7XG4gICAgICBvcmlnaW5hbE5vZGVzLmZvckVhY2goZnVuY3Rpb24ob3JpZ2luYWxOb2RlKSB7XG4gICAgICAgIG9yaWdpbmFsTm9kZS52YWx1ZS5yYW5rID0gdmFsdWUucmFuaztcbiAgICAgICAgZy5hZGROb2RlKG9yaWdpbmFsTm9kZS51LCBvcmlnaW5hbE5vZGUudmFsdWUpO1xuICAgICAgICBnLnBhcmVudChvcmlnaW5hbE5vZGUudSwgb3JpZ2luYWxOb2RlLnBhcmVudCk7XG4gICAgICB9KTtcbiAgICAgIGcuZGVsTm9kZSh1KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFJlc3RvcmUgb3JpZ2luYWwgZWRnZXNcbiAgb3JpZ2luYWxFZGdlcy5mb3JFYWNoKGZ1bmN0aW9uKGVkZ2UpIHtcbiAgICBnLmFkZEVkZ2UoZWRnZS5lLCBlZGdlLnUsIGVkZ2UudiwgZWRnZS52YWx1ZSk7XG4gIH0pO1xufTtcbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoJ2NwLWRhdGEnKS5TZXQsXG4vKiBqc2hpbnQgK1cwNzkgKi9cbiAgICBEaWdyYXBoID0gcmVxdWlyZSgnZ3JhcGhsaWInKS5EaWdyYXBoLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmVhc2libGVUcmVlO1xuXG4vKlxuICogR2l2ZW4gYW4gYWN5Y2xpYyBncmFwaCB3aXRoIGVhY2ggbm9kZSBhc3NpZ25lZCBhIGByYW5rYCBhdHRyaWJ1dGUsIHRoaXNcbiAqIGZ1bmN0aW9uIGNvbnN0cnVjdHMgYW5kIHJldHVybnMgYSBzcGFubmluZyB0cmVlLiBUaGlzIGZ1bmN0aW9uIG1heSByZWR1Y2VcbiAqIHRoZSBsZW5ndGggb2Ygc29tZSBlZGdlcyBmcm9tIHRoZSBpbml0aWFsIHJhbmsgYXNzaWdubWVudCB3aGlsZSBtYWludGFpbmluZ1xuICogdGhlIGBtaW5MZW5gIHNwZWNpZmllZCBieSBlYWNoIGVkZ2UuXG4gKlxuICogUHJlcmVxdWlzaXRlczpcbiAqXG4gKiAqIFRoZSBpbnB1dCBncmFwaCBpcyBhY3ljbGljXG4gKiAqIEVhY2ggbm9kZSBpbiB0aGUgaW5wdXQgZ3JhcGggaGFzIGFuIGFzc2lnbmVkIGByYW5rYCBhdHRyaWJ1dGVcbiAqICogRWFjaCBlZGdlIGluIHRoZSBpbnB1dCBncmFwaCBoYXMgYW4gYXNzaWduZWQgYG1pbkxlbmAgYXR0cmlidXRlXG4gKlxuICogT3V0cHV0czpcbiAqXG4gKiBBIGZlYXNpYmxlIHNwYW5uaW5nIHRyZWUgZm9yIHRoZSBpbnB1dCBncmFwaCAoaS5lLiBhIHNwYW5uaW5nIHRyZWUgdGhhdFxuICogcmVzcGVjdHMgZWFjaCBncmFwaCBlZGdlJ3MgYG1pbkxlbmAgYXR0cmlidXRlKSByZXByZXNlbnRlZCBhcyBhIERpZ3JhcGggd2l0aFxuICogYSBgcm9vdGAgYXR0cmlidXRlIG9uIGdyYXBoLlxuICpcbiAqIE5vZGVzIGhhdmUgdGhlIHNhbWUgaWQgYW5kIHZhbHVlIGFzIHRoYXQgaW4gdGhlIGlucHV0IGdyYXBoLlxuICpcbiAqIEVkZ2VzIGluIHRoZSB0cmVlIGhhdmUgYXJiaXRyYXJpbHkgYXNzaWduZWQgaWRzLiBUaGUgYXR0cmlidXRlcyBmb3IgZWRnZXNcbiAqIGluY2x1ZGUgYHJldmVyc2VkYC4gYHJldmVyc2VkYCBpbmRpY2F0ZXMgdGhhdCB0aGUgZWRnZSBpcyBhXG4gKiBiYWNrIGVkZ2UgaW4gdGhlIGlucHV0IGdyYXBoLlxuICovXG5mdW5jdGlvbiBmZWFzaWJsZVRyZWUoZykge1xuICB2YXIgcmVtYWluaW5nID0gbmV3IFNldChnLm5vZGVzKCkpLFxuICAgICAgdHJlZSA9IG5ldyBEaWdyYXBoKCk7XG5cbiAgaWYgKHJlbWFpbmluZy5zaXplKCkgPT09IDEpIHtcbiAgICB2YXIgcm9vdCA9IGcubm9kZXMoKVswXTtcbiAgICB0cmVlLmFkZE5vZGUocm9vdCwge30pO1xuICAgIHRyZWUuZ3JhcGgoeyByb290OiByb290IH0pO1xuICAgIHJldHVybiB0cmVlO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVGlnaHRFZGdlcyh2KSB7XG4gICAgdmFyIGNvbnRpbnVlVG9TY2FuID0gdHJ1ZTtcbiAgICBnLnByZWRlY2Vzc29ycyh2KS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIGlmIChyZW1haW5pbmcuaGFzKHUpICYmICFzbGFjayhnLCB1LCB2KSkge1xuICAgICAgICBpZiAocmVtYWluaW5nLmhhcyh2KSkge1xuICAgICAgICAgIHRyZWUuYWRkTm9kZSh2LCB7fSk7XG4gICAgICAgICAgcmVtYWluaW5nLnJlbW92ZSh2KTtcbiAgICAgICAgICB0cmVlLmdyYXBoKHsgcm9vdDogdiB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyZWUuYWRkTm9kZSh1LCB7fSk7XG4gICAgICAgIHRyZWUuYWRkRWRnZShudWxsLCB1LCB2LCB7IHJldmVyc2VkOiB0cnVlIH0pO1xuICAgICAgICByZW1haW5pbmcucmVtb3ZlKHUpO1xuICAgICAgICBhZGRUaWdodEVkZ2VzKHUpO1xuICAgICAgICBjb250aW51ZVRvU2NhbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZy5zdWNjZXNzb3JzKHYpLmZvckVhY2goZnVuY3Rpb24odykgIHtcbiAgICAgIGlmIChyZW1haW5pbmcuaGFzKHcpICYmICFzbGFjayhnLCB2LCB3KSkge1xuICAgICAgICBpZiAocmVtYWluaW5nLmhhcyh2KSkge1xuICAgICAgICAgIHRyZWUuYWRkTm9kZSh2LCB7fSk7XG4gICAgICAgICAgcmVtYWluaW5nLnJlbW92ZSh2KTtcbiAgICAgICAgICB0cmVlLmdyYXBoKHsgcm9vdDogdiB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyZWUuYWRkTm9kZSh3LCB7fSk7XG4gICAgICAgIHRyZWUuYWRkRWRnZShudWxsLCB2LCB3LCB7fSk7XG4gICAgICAgIHJlbWFpbmluZy5yZW1vdmUodyk7XG4gICAgICAgIGFkZFRpZ2h0RWRnZXModyk7XG4gICAgICAgIGNvbnRpbnVlVG9TY2FuID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbnRpbnVlVG9TY2FuO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlVGlnaHRFZGdlKCkge1xuICAgIHZhciBtaW5TbGFjayA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgcmVtYWluaW5nLmtleXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGcucHJlZGVjZXNzb3JzKHYpLmZvckVhY2goZnVuY3Rpb24odSkge1xuICAgICAgICBpZiAoIXJlbWFpbmluZy5oYXModSkpIHtcbiAgICAgICAgICB2YXIgZWRnZVNsYWNrID0gc2xhY2soZywgdSwgdik7XG4gICAgICAgICAgaWYgKE1hdGguYWJzKGVkZ2VTbGFjaykgPCBNYXRoLmFicyhtaW5TbGFjaykpIHtcbiAgICAgICAgICAgIG1pblNsYWNrID0gLWVkZ2VTbGFjaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBnLnN1Y2Nlc3NvcnModikuZm9yRWFjaChmdW5jdGlvbih3KSB7XG4gICAgICAgIGlmICghcmVtYWluaW5nLmhhcyh3KSkge1xuICAgICAgICAgIHZhciBlZGdlU2xhY2sgPSBzbGFjayhnLCB2LCB3KTtcbiAgICAgICAgICBpZiAoTWF0aC5hYnMoZWRnZVNsYWNrKSA8IE1hdGguYWJzKG1pblNsYWNrKSkge1xuICAgICAgICAgICAgbWluU2xhY2sgPSBlZGdlU2xhY2s7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRyZWUuZWFjaE5vZGUoZnVuY3Rpb24odSkgeyBnLm5vZGUodSkucmFuayAtPSBtaW5TbGFjazsgfSk7XG4gIH1cblxuICB3aGlsZSAocmVtYWluaW5nLnNpemUoKSkge1xuICAgIHZhciBub2Rlc1RvU2VhcmNoID0gIXRyZWUub3JkZXIoKSA/IHJlbWFpbmluZy5rZXlzKCkgOiB0cmVlLm5vZGVzKCk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGlsID0gbm9kZXNUb1NlYXJjaC5sZW5ndGg7XG4gICAgICAgICBpIDwgaWwgJiYgYWRkVGlnaHRFZGdlcyhub2Rlc1RvU2VhcmNoW2ldKTtcbiAgICAgICAgICsraSk7XG4gICAgaWYgKHJlbWFpbmluZy5zaXplKCkpIHtcbiAgICAgIGNyZWF0ZVRpZ2h0RWRnZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cmVlO1xufVxuXG5mdW5jdGlvbiBzbGFjayhnLCB1LCB2KSB7XG4gIHZhciByYW5rRGlmZiA9IGcubm9kZSh2KS5yYW5rIC0gZy5ub2RlKHUpLnJhbms7XG4gIHZhciBtYXhNaW5MZW4gPSB1dGlsLm1heChnLm91dEVkZ2VzKHUsIHYpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbihlKSB7IHJldHVybiBnLmVkZ2UoZSkubWluTGVuOyB9KSk7XG4gIHJldHVybiByYW5rRGlmZiAtIG1heE1pbkxlbjtcbn1cbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpLFxuICAgIHRvcHNvcnQgPSByZXF1aXJlKCdncmFwaGxpYicpLmFsZy50b3Bzb3J0O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXRSYW5rO1xuXG4vKlxuICogQXNzaWducyBhIGByYW5rYCBhdHRyaWJ1dGUgdG8gZWFjaCBub2RlIGluIHRoZSBpbnB1dCBncmFwaCBhbmQgZW5zdXJlcyB0aGF0XG4gKiB0aGlzIHJhbmsgcmVzcGVjdHMgdGhlIGBtaW5MZW5gIGF0dHJpYnV0ZSBvZiBpbmNpZGVudCBlZGdlcy5cbiAqXG4gKiBQcmVyZXF1aXNpdGVzOlxuICpcbiAqICAqIFRoZSBpbnB1dCBncmFwaCBtdXN0IGJlIGFjeWNsaWNcbiAqICAqIEVhY2ggZWRnZSBpbiB0aGUgaW5wdXQgZ3JhcGggbXVzdCBoYXZlIGFuIGFzc2lnbmVkICdtaW5MZW4nIGF0dHJpYnV0ZVxuICovXG5mdW5jdGlvbiBpbml0UmFuayhnKSB7XG4gIHZhciBzb3J0ZWQgPSB0b3Bzb3J0KGcpO1xuXG4gIHNvcnRlZC5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICB2YXIgaW5FZGdlcyA9IGcuaW5FZGdlcyh1KTtcbiAgICBpZiAoaW5FZGdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGcubm9kZSh1KS5yYW5rID0gMDtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgbWluTGVucyA9IGluRWRnZXMubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBnLm5vZGUoZy5zb3VyY2UoZSkpLnJhbmsgKyBnLmVkZ2UoZSkubWluTGVuO1xuICAgIH0pO1xuICAgIGcubm9kZSh1KS5yYW5rID0gdXRpbC5tYXgobWluTGVucyk7XG4gIH0pO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIHNsYWNrOiBzbGFja1xufTtcblxuLypcbiAqIEEgaGVscGVyIHRvIGNhbGN1bGF0ZSB0aGUgc2xhY2sgYmV0d2VlbiB0d28gbm9kZXMgKGB1YCBhbmQgYHZgKSBnaXZlbiBhXG4gKiBgbWluTGVuYCBjb25zdHJhaW50LiBUaGUgc2xhY2sgcmVwcmVzZW50cyBob3cgbXVjaCB0aGUgZGlzdGFuY2UgYmV0d2VlbiBgdWBcbiAqIGFuZCBgdmAgY291bGQgc2hyaW5rIHdoaWxlIG1haW50YWluaW5nIHRoZSBgbWluTGVuYCBjb25zdHJhaW50LiBJZiB0aGUgdmFsdWVcbiAqIGlzIG5lZ2F0aXZlIHRoZW4gdGhlIGNvbnN0cmFpbnQgaXMgY3VycmVudGx5IHZpb2xhdGVkLlxuICpcbiAgVGhpcyBmdW5jdGlvbiByZXF1aXJlcyB0aGF0IGB1YCBhbmQgYHZgIGFyZSBpbiBgZ3JhcGhgIGFuZCB0aGV5IGJvdGggaGF2ZSBhXG4gIGByYW5rYCBhdHRyaWJ1dGUuXG4gKi9cbmZ1bmN0aW9uIHNsYWNrKGdyYXBoLCB1LCB2LCBtaW5MZW4pIHtcbiAgcmV0dXJuIE1hdGguYWJzKGdyYXBoLm5vZGUodSkucmFuayAtIGdyYXBoLm5vZGUodikucmFuaykgLSBtaW5MZW47XG59XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKSxcbiAgICByYW5rVXRpbCA9IHJlcXVpcmUoJy4vcmFua1V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzaW1wbGV4O1xuXG5mdW5jdGlvbiBzaW1wbGV4KGdyYXBoLCBzcGFubmluZ1RyZWUpIHtcbiAgLy8gVGhlIG5ldHdvcmsgc2ltcGxleCBhbGdvcml0aG0gcmVwZWF0ZWRseSByZXBsYWNlcyBlZGdlcyBvZlxuICAvLyB0aGUgc3Bhbm5pbmcgdHJlZSB3aXRoIG5lZ2F0aXZlIGN1dCB2YWx1ZXMgdW50aWwgbm8gc3VjaFxuICAvLyBlZGdlIGV4aXN0cy5cbiAgaW5pdEN1dFZhbHVlcyhncmFwaCwgc3Bhbm5pbmdUcmVlKTtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICB2YXIgZSA9IGxlYXZlRWRnZShzcGFubmluZ1RyZWUpO1xuICAgIGlmIChlID09PSBudWxsKSBicmVhaztcbiAgICB2YXIgZiA9IGVudGVyRWRnZShncmFwaCwgc3Bhbm5pbmdUcmVlLCBlKTtcbiAgICBleGNoYW5nZShncmFwaCwgc3Bhbm5pbmdUcmVlLCBlLCBmKTtcbiAgfVxufVxuXG4vKlxuICogU2V0IHRoZSBjdXQgdmFsdWVzIG9mIGVkZ2VzIGluIHRoZSBzcGFubmluZyB0cmVlIGJ5IGEgZGVwdGgtZmlyc3RcbiAqIHBvc3RvcmRlciB0cmF2ZXJzYWwuICBUaGUgY3V0IHZhbHVlIGNvcnJlc3BvbmRzIHRvIHRoZSBjb3N0LCBpblxuICogdGVybXMgb2YgYSByYW5raW5nJ3MgZWRnZSBsZW5ndGggc3VtLCBvZiBsZW5ndGhlbmluZyBhbiBlZGdlLlxuICogTmVnYXRpdmUgY3V0IHZhbHVlcyB0eXBpY2FsbHkgaW5kaWNhdGUgZWRnZXMgdGhhdCB3b3VsZCB5aWVsZCBhXG4gKiBzbWFsbGVyIGVkZ2UgbGVuZ3RoIHN1bSBpZiB0aGV5IHdlcmUgbGVuZ3RoZW5lZC5cbiAqL1xuZnVuY3Rpb24gaW5pdEN1dFZhbHVlcyhncmFwaCwgc3Bhbm5pbmdUcmVlKSB7XG4gIGNvbXB1dGVMb3dMaW0oc3Bhbm5pbmdUcmVlKTtcblxuICBzcGFubmluZ1RyZWUuZWFjaEVkZ2UoZnVuY3Rpb24oaWQsIHUsIHYsIHRyZWVWYWx1ZSkge1xuICAgIHRyZWVWYWx1ZS5jdXRWYWx1ZSA9IDA7XG4gIH0pO1xuXG4gIC8vIFByb3BhZ2F0ZSBjdXQgdmFsdWVzIHVwIHRoZSB0cmVlLlxuICBmdW5jdGlvbiBkZnMobikge1xuICAgIHZhciBjaGlsZHJlbiA9IHNwYW5uaW5nVHJlZS5zdWNjZXNzb3JzKG4pO1xuICAgIGZvciAodmFyIGMgaW4gY2hpbGRyZW4pIHtcbiAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2NdO1xuICAgICAgZGZzKGNoaWxkKTtcbiAgICB9XG4gICAgaWYgKG4gIT09IHNwYW5uaW5nVHJlZS5ncmFwaCgpLnJvb3QpIHtcbiAgICAgIHNldEN1dFZhbHVlKGdyYXBoLCBzcGFubmluZ1RyZWUsIG4pO1xuICAgIH1cbiAgfVxuICBkZnMoc3Bhbm5pbmdUcmVlLmdyYXBoKCkucm9vdCk7XG59XG5cbi8qXG4gKiBQZXJmb3JtIGEgREZTIHBvc3RvcmRlciB0cmF2ZXJzYWwsIGxhYmVsaW5nIGVhY2ggbm9kZSB2IHdpdGhcbiAqIGl0cyB0cmF2ZXJzYWwgb3JkZXIgJ2xpbSh2KScgYW5kIHRoZSBtaW5pbXVtIHRyYXZlcnNhbCBudW1iZXJcbiAqIG9mIGFueSBvZiBpdHMgZGVzY2VuZGFudHMgJ2xvdyh2KScuICBUaGlzIHByb3ZpZGVzIGFuIGVmZmljaWVudFxuICogd2F5IHRvIHRlc3Qgd2hldGhlciB1IGlzIGFuIGFuY2VzdG9yIG9mIHYgc2luY2VcbiAqIGxvdyh1KSA8PSBsaW0odikgPD0gbGltKHUpIGlmIGFuZCBvbmx5IGlmIHUgaXMgYW4gYW5jZXN0b3IuXG4gKi9cbmZ1bmN0aW9uIGNvbXB1dGVMb3dMaW0odHJlZSkge1xuICB2YXIgcG9zdE9yZGVyTnVtID0gMDtcbiAgXG4gIGZ1bmN0aW9uIGRmcyhuKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gdHJlZS5zdWNjZXNzb3JzKG4pO1xuICAgIHZhciBsb3cgPSBwb3N0T3JkZXJOdW07XG4gICAgZm9yICh2YXIgYyBpbiBjaGlsZHJlbikge1xuICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bY107XG4gICAgICBkZnMoY2hpbGQpO1xuICAgICAgbG93ID0gTWF0aC5taW4obG93LCB0cmVlLm5vZGUoY2hpbGQpLmxvdyk7XG4gICAgfVxuICAgIHRyZWUubm9kZShuKS5sb3cgPSBsb3c7XG4gICAgdHJlZS5ub2RlKG4pLmxpbSA9IHBvc3RPcmRlck51bSsrO1xuICB9XG5cbiAgZGZzKHRyZWUuZ3JhcGgoKS5yb290KTtcbn1cblxuLypcbiAqIFRvIGNvbXB1dGUgdGhlIGN1dCB2YWx1ZSBvZiB0aGUgZWRnZSBwYXJlbnQgLT4gY2hpbGQsIHdlIGNvbnNpZGVyXG4gKiBpdCBhbmQgYW55IG90aGVyIGdyYXBoIGVkZ2VzIHRvIG9yIGZyb20gdGhlIGNoaWxkLlxuICogICAgICAgICAgcGFyZW50XG4gKiAgICAgICAgICAgICB8XG4gKiAgICAgICAgICAgY2hpbGRcbiAqICAgICAgICAgIC8gICAgICBcXFxuICogICAgICAgICB1ICAgICAgICB2XG4gKi9cbmZ1bmN0aW9uIHNldEN1dFZhbHVlKGdyYXBoLCB0cmVlLCBjaGlsZCkge1xuICB2YXIgcGFyZW50RWRnZSA9IHRyZWUuaW5FZGdlcyhjaGlsZClbMF07XG5cbiAgLy8gTGlzdCBvZiBjaGlsZCdzIGNoaWxkcmVuIGluIHRoZSBzcGFubmluZyB0cmVlLlxuICB2YXIgZ3JhbmRjaGlsZHJlbiA9IFtdO1xuICB2YXIgZ3JhbmRjaGlsZEVkZ2VzID0gdHJlZS5vdXRFZGdlcyhjaGlsZCk7XG4gIGZvciAodmFyIGdjZSBpbiBncmFuZGNoaWxkRWRnZXMpIHtcbiAgICBncmFuZGNoaWxkcmVuLnB1c2godHJlZS50YXJnZXQoZ3JhbmRjaGlsZEVkZ2VzW2djZV0pKTtcbiAgfVxuXG4gIHZhciBjdXRWYWx1ZSA9IDA7XG5cbiAgLy8gVE9ETzogUmVwbGFjZSB1bml0IGluY3JlbWVudC9kZWNyZW1lbnQgd2l0aCBlZGdlIHdlaWdodHMuXG4gIHZhciBFID0gMDsgICAgLy8gRWRnZXMgZnJvbSBjaGlsZCB0byBncmFuZGNoaWxkJ3Mgc3VidHJlZS5cbiAgdmFyIEYgPSAwOyAgICAvLyBFZGdlcyB0byBjaGlsZCBmcm9tIGdyYW5kY2hpbGQncyBzdWJ0cmVlLlxuICB2YXIgRyA9IDA7ICAgIC8vIEVkZ2VzIGZyb20gY2hpbGQgdG8gbm9kZXMgb3V0c2lkZSBvZiBjaGlsZCdzIHN1YnRyZWUuXG4gIHZhciBIID0gMDsgICAgLy8gRWRnZXMgZnJvbSBub2RlcyBvdXRzaWRlIG9mIGNoaWxkJ3Mgc3VidHJlZSB0byBjaGlsZC5cblxuICAvLyBDb25zaWRlciBhbGwgZ3JhcGggZWRnZXMgZnJvbSBjaGlsZC5cbiAgdmFyIG91dEVkZ2VzID0gZ3JhcGgub3V0RWRnZXMoY2hpbGQpO1xuICB2YXIgZ2M7XG4gIGZvciAodmFyIG9lIGluIG91dEVkZ2VzKSB7XG4gICAgdmFyIHN1Y2MgPSBncmFwaC50YXJnZXQob3V0RWRnZXNbb2VdKTtcbiAgICBmb3IgKGdjIGluIGdyYW5kY2hpbGRyZW4pIHtcbiAgICAgIGlmIChpblN1YnRyZWUodHJlZSwgc3VjYywgZ3JhbmRjaGlsZHJlbltnY10pKSB7XG4gICAgICAgIEUrKztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFpblN1YnRyZWUodHJlZSwgc3VjYywgY2hpbGQpKSB7XG4gICAgICBHKys7XG4gICAgfVxuICB9XG5cbiAgLy8gQ29uc2lkZXIgYWxsIGdyYXBoIGVkZ2VzIHRvIGNoaWxkLlxuICB2YXIgaW5FZGdlcyA9IGdyYXBoLmluRWRnZXMoY2hpbGQpO1xuICBmb3IgKHZhciBpZSBpbiBpbkVkZ2VzKSB7XG4gICAgdmFyIHByZWQgPSBncmFwaC5zb3VyY2UoaW5FZGdlc1tpZV0pO1xuICAgIGZvciAoZ2MgaW4gZ3JhbmRjaGlsZHJlbikge1xuICAgICAgaWYgKGluU3VidHJlZSh0cmVlLCBwcmVkLCBncmFuZGNoaWxkcmVuW2djXSkpIHtcbiAgICAgICAgRisrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWluU3VidHJlZSh0cmVlLCBwcmVkLCBjaGlsZCkpIHtcbiAgICAgIEgrKztcbiAgICB9XG4gIH1cblxuICAvLyBDb250cmlidXRpb25zIGRlcGVuZCBvbiB0aGUgYWxpZ25tZW50IG9mIHRoZSBwYXJlbnQgLT4gY2hpbGQgZWRnZVxuICAvLyBhbmQgdGhlIGNoaWxkIC0+IHUgb3IgdiBlZGdlcy5cbiAgdmFyIGdyYW5kY2hpbGRDdXRTdW0gPSAwO1xuICBmb3IgKGdjIGluIGdyYW5kY2hpbGRyZW4pIHtcbiAgICB2YXIgY3YgPSB0cmVlLmVkZ2UoZ3JhbmRjaGlsZEVkZ2VzW2djXSkuY3V0VmFsdWU7XG4gICAgaWYgKCF0cmVlLmVkZ2UoZ3JhbmRjaGlsZEVkZ2VzW2djXSkucmV2ZXJzZWQpIHtcbiAgICAgIGdyYW5kY2hpbGRDdXRTdW0gKz0gY3Y7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdyYW5kY2hpbGRDdXRTdW0gLT0gY3Y7XG4gICAgfVxuICB9XG5cbiAgaWYgKCF0cmVlLmVkZ2UocGFyZW50RWRnZSkucmV2ZXJzZWQpIHtcbiAgICBjdXRWYWx1ZSArPSBncmFuZGNoaWxkQ3V0U3VtIC0gRSArIEYgLSBHICsgSDtcbiAgfSBlbHNlIHtcbiAgICBjdXRWYWx1ZSAtPSBncmFuZGNoaWxkQ3V0U3VtIC0gRSArIEYgLSBHICsgSDtcbiAgfVxuXG4gIHRyZWUuZWRnZShwYXJlbnRFZGdlKS5jdXRWYWx1ZSA9IGN1dFZhbHVlO1xufVxuXG4vKlxuICogUmV0dXJuIHdoZXRoZXIgbiBpcyBhIG5vZGUgaW4gdGhlIHN1YnRyZWUgd2l0aCB0aGUgZ2l2ZW5cbiAqIHJvb3QuXG4gKi9cbmZ1bmN0aW9uIGluU3VidHJlZSh0cmVlLCBuLCByb290KSB7XG4gIHJldHVybiAodHJlZS5ub2RlKHJvb3QpLmxvdyA8PSB0cmVlLm5vZGUobikubGltICYmXG4gICAgICAgICAgdHJlZS5ub2RlKG4pLmxpbSA8PSB0cmVlLm5vZGUocm9vdCkubGltKTtcbn1cblxuLypcbiAqIFJldHVybiBhbiBlZGdlIGZyb20gdGhlIHRyZWUgd2l0aCBhIG5lZ2F0aXZlIGN1dCB2YWx1ZSwgb3IgbnVsbCBpZiB0aGVyZVxuICogaXMgbm9uZS5cbiAqL1xuZnVuY3Rpb24gbGVhdmVFZGdlKHRyZWUpIHtcbiAgdmFyIGVkZ2VzID0gdHJlZS5lZGdlcygpO1xuICBmb3IgKHZhciBuIGluIGVkZ2VzKSB7XG4gICAgdmFyIGUgPSBlZGdlc1tuXTtcbiAgICB2YXIgdHJlZVZhbHVlID0gdHJlZS5lZGdlKGUpO1xuICAgIGlmICh0cmVlVmFsdWUuY3V0VmFsdWUgPCAwKSB7XG4gICAgICByZXR1cm4gZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qXG4gKiBUaGUgZWRnZSBlIHNob3VsZCBiZSBhbiBlZGdlIGluIHRoZSB0cmVlLCB3aXRoIGFuIHVuZGVybHlpbmcgZWRnZVxuICogaW4gdGhlIGdyYXBoLCB3aXRoIGEgbmVnYXRpdmUgY3V0IHZhbHVlLiAgT2YgdGhlIHR3byBub2RlcyBpbmNpZGVudFxuICogb24gdGhlIGVkZ2UsIHRha2UgdGhlIGxvd2VyIG9uZS4gIGVudGVyRWRnZSByZXR1cm5zIGFuIGVkZ2Ugd2l0aFxuICogbWluaW11bSBzbGFjayBnb2luZyBmcm9tIG91dHNpZGUgb2YgdGhhdCBub2RlJ3Mgc3VidHJlZSB0byBpbnNpZGVcbiAqIG9mIHRoYXQgbm9kZSdzIHN1YnRyZWUuXG4gKi9cbmZ1bmN0aW9uIGVudGVyRWRnZShncmFwaCwgdHJlZSwgZSkge1xuICB2YXIgc291cmNlID0gdHJlZS5zb3VyY2UoZSk7XG4gIHZhciB0YXJnZXQgPSB0cmVlLnRhcmdldChlKTtcbiAgdmFyIGxvd2VyID0gdHJlZS5ub2RlKHRhcmdldCkubGltIDwgdHJlZS5ub2RlKHNvdXJjZSkubGltID8gdGFyZ2V0IDogc291cmNlO1xuXG4gIC8vIElzIHRoZSB0cmVlIGVkZ2UgYWxpZ25lZCB3aXRoIHRoZSBncmFwaCBlZGdlP1xuICB2YXIgYWxpZ25lZCA9ICF0cmVlLmVkZ2UoZSkucmV2ZXJzZWQ7XG5cbiAgdmFyIG1pblNsYWNrID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICB2YXIgbWluU2xhY2tFZGdlO1xuICBpZiAoYWxpZ25lZCkge1xuICAgIGdyYXBoLmVhY2hFZGdlKGZ1bmN0aW9uKGlkLCB1LCB2LCB2YWx1ZSkge1xuICAgICAgaWYgKGlkICE9PSBlICYmIGluU3VidHJlZSh0cmVlLCB1LCBsb3dlcikgJiYgIWluU3VidHJlZSh0cmVlLCB2LCBsb3dlcikpIHtcbiAgICAgICAgdmFyIHNsYWNrID0gcmFua1V0aWwuc2xhY2soZ3JhcGgsIHUsIHYsIHZhbHVlLm1pbkxlbik7XG4gICAgICAgIGlmIChzbGFjayA8IG1pblNsYWNrKSB7XG4gICAgICAgICAgbWluU2xhY2sgPSBzbGFjaztcbiAgICAgICAgICBtaW5TbGFja0VkZ2UgPSBpZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGdyYXBoLmVhY2hFZGdlKGZ1bmN0aW9uKGlkLCB1LCB2LCB2YWx1ZSkge1xuICAgICAgaWYgKGlkICE9PSBlICYmICFpblN1YnRyZWUodHJlZSwgdSwgbG93ZXIpICYmIGluU3VidHJlZSh0cmVlLCB2LCBsb3dlcikpIHtcbiAgICAgICAgdmFyIHNsYWNrID0gcmFua1V0aWwuc2xhY2soZ3JhcGgsIHUsIHYsIHZhbHVlLm1pbkxlbik7XG4gICAgICAgIGlmIChzbGFjayA8IG1pblNsYWNrKSB7XG4gICAgICAgICAgbWluU2xhY2sgPSBzbGFjaztcbiAgICAgICAgICBtaW5TbGFja0VkZ2UgPSBpZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1pblNsYWNrRWRnZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIG91dHNpZGUgPSBbXTtcbiAgICB2YXIgaW5zaWRlID0gW107XG4gICAgZ3JhcGguZWFjaE5vZGUoZnVuY3Rpb24oaWQpIHtcbiAgICAgIGlmICghaW5TdWJ0cmVlKHRyZWUsIGlkLCBsb3dlcikpIHtcbiAgICAgICAgb3V0c2lkZS5wdXNoKGlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGluc2lkZS5wdXNoKGlkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGVkZ2UgZm91bmQgZnJvbSBvdXRzaWRlIG9mIHRyZWUgdG8gaW5zaWRlJyk7XG4gIH1cblxuICByZXR1cm4gbWluU2xhY2tFZGdlO1xufVxuXG4vKlxuICogUmVwbGFjZSBlZGdlIGUgd2l0aCBlZGdlIGYgaW4gdGhlIHRyZWUsIHJlY2FsY3VsYXRpbmcgdGhlIHRyZWUgcm9vdCxcbiAqIHRoZSBub2RlcycgbG93IGFuZCBsaW0gcHJvcGVydGllcyBhbmQgdGhlIGVkZ2VzJyBjdXQgdmFsdWVzLlxuICovXG5mdW5jdGlvbiBleGNoYW5nZShncmFwaCwgdHJlZSwgZSwgZikge1xuICB0cmVlLmRlbEVkZ2UoZSk7XG4gIHZhciBzb3VyY2UgPSBncmFwaC5zb3VyY2UoZik7XG4gIHZhciB0YXJnZXQgPSBncmFwaC50YXJnZXQoZik7XG5cbiAgLy8gUmVkaXJlY3QgZWRnZXMgc28gdGhhdCB0YXJnZXQgaXMgdGhlIHJvb3Qgb2YgaXRzIHN1YnRyZWUuXG4gIGZ1bmN0aW9uIHJlZGlyZWN0KHYpIHtcbiAgICB2YXIgZWRnZXMgPSB0cmVlLmluRWRnZXModik7XG4gICAgZm9yICh2YXIgaSBpbiBlZGdlcykge1xuICAgICAgdmFyIGUgPSBlZGdlc1tpXTtcbiAgICAgIHZhciB1ID0gdHJlZS5zb3VyY2UoZSk7XG4gICAgICB2YXIgdmFsdWUgPSB0cmVlLmVkZ2UoZSk7XG4gICAgICByZWRpcmVjdCh1KTtcbiAgICAgIHRyZWUuZGVsRWRnZShlKTtcbiAgICAgIHZhbHVlLnJldmVyc2VkID0gIXZhbHVlLnJldmVyc2VkO1xuICAgICAgdHJlZS5hZGRFZGdlKGUsIHYsIHUsIHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICByZWRpcmVjdCh0YXJnZXQpO1xuXG4gIHZhciByb290ID0gc291cmNlO1xuICB2YXIgZWRnZXMgPSB0cmVlLmluRWRnZXMocm9vdCk7XG4gIHdoaWxlIChlZGdlcy5sZW5ndGggPiAwKSB7XG4gICAgcm9vdCA9IHRyZWUuc291cmNlKGVkZ2VzWzBdKTtcbiAgICBlZGdlcyA9IHRyZWUuaW5FZGdlcyhyb290KTtcbiAgfVxuXG4gIHRyZWUuZ3JhcGgoKS5yb290ID0gcm9vdDtcblxuICB0cmVlLmFkZEVkZ2UobnVsbCwgc291cmNlLCB0YXJnZXQsIHtjdXRWYWx1ZTogMH0pO1xuXG4gIGluaXRDdXRWYWx1ZXMoZ3JhcGgsIHRyZWUpO1xuXG4gIGFkanVzdFJhbmtzKGdyYXBoLCB0cmVlKTtcbn1cblxuLypcbiAqIFJlc2V0IHRoZSByYW5rcyBvZiBhbGwgbm9kZXMgYmFzZWQgb24gdGhlIGN1cnJlbnQgc3Bhbm5pbmcgdHJlZS5cbiAqIFRoZSByYW5rIG9mIHRoZSB0cmVlJ3Mgcm9vdCByZW1haW5zIHVuY2hhbmdlZCwgd2hpbGUgYWxsIG90aGVyXG4gKiBub2RlcyBhcmUgc2V0IHRvIHRoZSBzdW0gb2YgbWluaW11bSBsZW5ndGggY29uc3RyYWludHMgYWxvbmdcbiAqIHRoZSBwYXRoIGZyb20gdGhlIHJvb3QuXG4gKi9cbmZ1bmN0aW9uIGFkanVzdFJhbmtzKGdyYXBoLCB0cmVlKSB7XG4gIGZ1bmN0aW9uIGRmcyhwKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gdHJlZS5zdWNjZXNzb3JzKHApO1xuICAgIGNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oYykge1xuICAgICAgdmFyIG1pbkxlbiA9IG1pbmltdW1MZW5ndGgoZ3JhcGgsIHAsIGMpO1xuICAgICAgZ3JhcGgubm9kZShjKS5yYW5rID0gZ3JhcGgubm9kZShwKS5yYW5rICsgbWluTGVuO1xuICAgICAgZGZzKGMpO1xuICAgIH0pO1xuICB9XG5cbiAgZGZzKHRyZWUuZ3JhcGgoKS5yb290KTtcbn1cblxuLypcbiAqIElmIHUgYW5kIHYgYXJlIGNvbm5lY3RlZCBieSBzb21lIGVkZ2VzIGluIHRoZSBncmFwaCwgcmV0dXJuIHRoZVxuICogbWluaW11bSBsZW5ndGggb2YgdGhvc2UgZWRnZXMsIGFzIGEgcG9zaXRpdmUgbnVtYmVyIGlmIHYgc3VjY2VlZHNcbiAqIHUgYW5kIGFzIGEgbmVnYXRpdmUgbnVtYmVyIGlmIHYgcHJlY2VkZXMgdS5cbiAqL1xuZnVuY3Rpb24gbWluaW11bUxlbmd0aChncmFwaCwgdSwgdikge1xuICB2YXIgb3V0RWRnZXMgPSBncmFwaC5vdXRFZGdlcyh1LCB2KTtcbiAgaWYgKG91dEVkZ2VzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gdXRpbC5tYXgob3V0RWRnZXMubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBncmFwaC5lZGdlKGUpLm1pbkxlbjtcbiAgICB9KSk7XG4gIH1cblxuICB2YXIgaW5FZGdlcyA9IGdyYXBoLmluRWRnZXModSwgdik7XG4gIGlmIChpbkVkZ2VzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gLXV0aWwubWF4KGluRWRnZXMubWFwKGZ1bmN0aW9uKGUpIHtcbiAgICAgIHJldHVybiBncmFwaC5lZGdlKGUpLm1pbkxlbjtcbiAgICB9KSk7XG4gIH1cbn1cbiIsIi8qXG4gKiBSZXR1cm5zIHRoZSBzbWFsbGVzdCB2YWx1ZSBpbiB0aGUgYXJyYXkuXG4gKi9cbmV4cG9ydHMubWluID0gZnVuY3Rpb24odmFsdWVzKSB7XG4gIHJldHVybiBNYXRoLm1pbi5hcHBseShNYXRoLCB2YWx1ZXMpO1xufTtcblxuLypcbiAqIFJldHVybnMgdGhlIGxhcmdlc3QgdmFsdWUgaW4gdGhlIGFycmF5LlxuICovXG5leHBvcnRzLm1heCA9IGZ1bmN0aW9uKHZhbHVlcykge1xuICByZXR1cm4gTWF0aC5tYXguYXBwbHkoTWF0aCwgdmFsdWVzKTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGB0cnVlYCBvbmx5IGlmIGBmKHgpYCBpcyBgdHJ1ZWAgZm9yIGFsbCBgeGAgaW4gYHhzYC4gT3RoZXJ3aXNlXG4gKiByZXR1cm5zIGBmYWxzZWAuIFRoaXMgZnVuY3Rpb24gd2lsbCByZXR1cm4gaW1tZWRpYXRlbHkgaWYgaXQgZmluZHMgYVxuICogY2FzZSB3aGVyZSBgZih4KWAgZG9lcyBub3QgaG9sZC5cbiAqL1xuZXhwb3J0cy5hbGwgPSBmdW5jdGlvbih4cywgZikge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCFmKHhzW2ldKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qXG4gKiBBY2N1bXVsYXRlcyB0aGUgc3VtIG9mIGVsZW1lbnRzIGluIHRoZSBnaXZlbiBhcnJheSB1c2luZyB0aGUgYCtgIG9wZXJhdG9yLlxuICovXG5leHBvcnRzLnN1bSA9IGZ1bmN0aW9uKHZhbHVlcykge1xuICByZXR1cm4gdmFsdWVzLnJlZHVjZShmdW5jdGlvbihhY2MsIHgpIHsgcmV0dXJuIGFjYyArIHg7IH0sIDApO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgYWxsIHZhbHVlcyBpbiB0aGUgZ2l2ZW4gb2JqZWN0LlxuICovXG5leHBvcnRzLnZhbHVlcyA9IGZ1bmN0aW9uKG9iaikge1xuICByZXR1cm4gT2JqZWN0LmtleXMob2JqKS5tYXAoZnVuY3Rpb24oaykgeyByZXR1cm4gb2JqW2tdOyB9KTtcbn07XG5cbmV4cG9ydHMuc2h1ZmZsZSA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gIGZvciAoaSA9IGFycmF5Lmxlbmd0aCAtIDE7IGkgPiAwOyAtLWkpIHtcbiAgICB2YXIgaiA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChpICsgMSkpO1xuICAgIHZhciBhaiA9IGFycmF5W2pdO1xuICAgIGFycmF5W2pdID0gYXJyYXlbaV07XG4gICAgYXJyYXlbaV0gPSBhajtcbiAgfVxufTtcblxuZXhwb3J0cy5wcm9wZXJ0eUFjY2Vzc29yID0gZnVuY3Rpb24oc2VsZiwgY29uZmlnLCBmaWVsZCwgc2V0SG9vaykge1xuICByZXR1cm4gZnVuY3Rpb24oeCkge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGNvbmZpZ1tmaWVsZF07XG4gICAgY29uZmlnW2ZpZWxkXSA9IHg7XG4gICAgaWYgKHNldEhvb2spIHNldEhvb2soeCk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG59O1xuXG4vKlxuICogR2l2ZW4gYSBsYXllcmVkLCBkaXJlY3RlZCBncmFwaCB3aXRoIGByYW5rYCBhbmQgYG9yZGVyYCBub2RlIGF0dHJpYnV0ZXMsXG4gKiB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYW4gYXJyYXkgb2Ygb3JkZXJlZCByYW5rcy4gRWFjaCByYW5rIGNvbnRhaW5zIGFuIGFycmF5XG4gKiBvZiB0aGUgaWRzIG9mIHRoZSBub2RlcyBpbiB0aGF0IHJhbmsgaW4gdGhlIG9yZGVyIHNwZWNpZmllZCBieSB0aGUgYG9yZGVyYFxuICogYXR0cmlidXRlLlxuICovXG5leHBvcnRzLm9yZGVyaW5nID0gZnVuY3Rpb24oZykge1xuICB2YXIgb3JkZXJpbmcgPSBbXTtcbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1LCB2YWx1ZSkge1xuICAgIHZhciByYW5rID0gb3JkZXJpbmdbdmFsdWUucmFua10gfHwgKG9yZGVyaW5nW3ZhbHVlLnJhbmtdID0gW10pO1xuICAgIHJhbmtbdmFsdWUub3JkZXJdID0gdTtcbiAgfSk7XG4gIHJldHVybiBvcmRlcmluZztcbn07XG5cbi8qXG4gKiBBIGZpbHRlciB0aGF0IGNhbiBiZSB1c2VkIHdpdGggYGZpbHRlck5vZGVzYCB0byBnZXQgYSBncmFwaCB0aGF0IG9ubHlcbiAqIGluY2x1ZGVzIG5vZGVzIHRoYXQgZG8gbm90IGNvbnRhaW4gb3RoZXJzIG5vZGVzLlxuICovXG5leHBvcnRzLmZpbHRlck5vblN1YmdyYXBocyA9IGZ1bmN0aW9uKGcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHUpIHtcbiAgICByZXR1cm4gZy5jaGlsZHJlbih1KS5sZW5ndGggPT09IDA7XG4gIH07XG59O1xuXG4vKlxuICogUmV0dXJucyBhIG5ldyBmdW5jdGlvbiB0aGF0IHdyYXBzIGBmdW5jYCB3aXRoIGEgdGltZXIuIFRoZSB3cmFwcGVyIGxvZ3MgdGhlXG4gKiB0aW1lIGl0IHRha2VzIHRvIGV4ZWN1dGUgdGhlIGZ1bmN0aW9uLlxuICpcbiAqIFRoZSB0aW1lciB3aWxsIGJlIGVuYWJsZWQgcHJvdmlkZWQgYGxvZy5sZXZlbCA+PSAxYC5cbiAqL1xuZnVuY3Rpb24gdGltZShuYW1lLCBmdW5jKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhcnQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgbG9nKDEsIG5hbWUgKyAnIHRpbWU6ICcgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBzdGFydCkgKyAnbXMnKTtcbiAgICB9XG4gIH07XG59XG50aW1lLmVuYWJsZWQgPSBmYWxzZTtcblxuZXhwb3J0cy50aW1lID0gdGltZTtcblxuLypcbiAqIEEgZ2xvYmFsIGxvZ2dlciB3aXRoIHRoZSBzcGVjaWZpY2F0aW9uIGBsb2cobGV2ZWwsIG1lc3NhZ2UsIC4uLilgIHRoYXRcbiAqIHdpbGwgbG9nIGEgbWVzc2FnZSB0byB0aGUgY29uc29sZSBpZiBgbG9nLmxldmVsID49IGxldmVsYC5cbiAqL1xuZnVuY3Rpb24gbG9nKGxldmVsKSB7XG4gIGlmIChsb2cubGV2ZWwgPj0gbGV2ZWwpIHtcbiAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgfVxufVxubG9nLmxldmVsID0gMDtcblxuZXhwb3J0cy5sb2cgPSBsb2c7XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICcwLjQuNSc7XG4iLCJleHBvcnRzLlNldCA9IHJlcXVpcmUoJy4vbGliL1NldCcpO1xuZXhwb3J0cy5Qcmlvcml0eVF1ZXVlID0gcmVxdWlyZSgnLi9saWIvUHJpb3JpdHlRdWV1ZScpO1xuZXhwb3J0cy52ZXJzaW9uID0gcmVxdWlyZSgnLi9saWIvdmVyc2lvbicpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBQcmlvcml0eVF1ZXVlO1xuXG4vKipcbiAqIEEgbWluLXByaW9yaXR5IHF1ZXVlIGRhdGEgc3RydWN0dXJlLiBUaGlzIGFsZ29yaXRobSBpcyBkZXJpdmVkIGZyb20gQ29ybWVuLFxuICogZXQgYWwuLCBcIkludHJvZHVjdGlvbiB0byBBbGdvcml0aG1zXCIuIFRoZSBiYXNpYyBpZGVhIG9mIGEgbWluLXByaW9yaXR5XG4gKiBxdWV1ZSBpcyB0aGF0IHlvdSBjYW4gZWZmaWNpZW50bHkgKGluIE8oMSkgdGltZSkgZ2V0IHRoZSBzbWFsbGVzdCBrZXkgaW5cbiAqIHRoZSBxdWV1ZS4gQWRkaW5nIGFuZCByZW1vdmluZyBlbGVtZW50cyB0YWtlcyBPKGxvZyBuKSB0aW1lLiBBIGtleSBjYW5cbiAqIGhhdmUgaXRzIHByaW9yaXR5IGRlY3JlYXNlZCBpbiBPKGxvZyBuKSB0aW1lLlxuICovXG5mdW5jdGlvbiBQcmlvcml0eVF1ZXVlKCkge1xuICB0aGlzLl9hcnIgPSBbXTtcbiAgdGhpcy5fa2V5SW5kaWNlcyA9IHt9O1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIG51bWJlciBvZiBlbGVtZW50cyBpbiB0aGUgcXVldWUuIFRha2VzIGBPKDEpYCB0aW1lLlxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5zaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9hcnIubGVuZ3RoO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBrZXlzIHRoYXQgYXJlIGluIHRoZSBxdWV1ZS4gVGFrZXMgYE8obilgIHRpbWUuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2Fyci5tYXAoZnVuY3Rpb24oeCkgeyByZXR1cm4geC5rZXk7IH0pO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGB0cnVlYCBpZiAqKmtleSoqIGlzIGluIHRoZSBxdWV1ZSBhbmQgYGZhbHNlYCBpZiBub3QuXG4gKi9cblByaW9yaXR5UXVldWUucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKGtleSkge1xuICByZXR1cm4ga2V5IGluIHRoaXMuX2tleUluZGljZXM7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHByaW9yaXR5IGZvciAqKmtleSoqLiBJZiAqKmtleSoqIGlzIG5vdCBwcmVzZW50IGluIHRoZSBxdWV1ZVxuICogdGhlbiB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYHVuZGVmaW5lZGAuIFRha2VzIGBPKDEpYCB0aW1lLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBrZXlcbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUucHJpb3JpdHkgPSBmdW5jdGlvbihrZXkpIHtcbiAgdmFyIGluZGV4ID0gdGhpcy5fa2V5SW5kaWNlc1trZXldO1xuICBpZiAoaW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB0aGlzLl9hcnJbaW5kZXhdLnByaW9yaXR5O1xuICB9XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGtleSBmb3IgdGhlIG1pbmltdW0gZWxlbWVudCBpbiB0aGlzIHF1ZXVlLiBJZiB0aGUgcXVldWUgaXNcbiAqIGVtcHR5IHRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yLiBUYWtlcyBgTygxKWAgdGltZS5cbiAqL1xuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUubWluID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLnNpemUoKSA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlF1ZXVlIHVuZGVyZmxvd1wiKTtcbiAgfVxuICByZXR1cm4gdGhpcy5fYXJyWzBdLmtleTtcbn07XG5cbi8qKlxuICogSW5zZXJ0cyBhIG5ldyBrZXkgaW50byB0aGUgcHJpb3JpdHkgcXVldWUuIElmIHRoZSBrZXkgYWxyZWFkeSBleGlzdHMgaW5cbiAqIHRoZSBxdWV1ZSB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYGZhbHNlYDsgb3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIGB0cnVlYC5cbiAqIFRha2VzIGBPKG4pYCB0aW1lLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBrZXkgdGhlIGtleSB0byBhZGRcbiAqIEBwYXJhbSB7TnVtYmVyfSBwcmlvcml0eSB0aGUgaW5pdGlhbCBwcmlvcml0eSBmb3IgdGhlIGtleVxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihrZXksIHByaW9yaXR5KSB7XG4gIHZhciBrZXlJbmRpY2VzID0gdGhpcy5fa2V5SW5kaWNlcztcbiAgaWYgKCEoa2V5IGluIGtleUluZGljZXMpKSB7XG4gICAgdmFyIGFyciA9IHRoaXMuX2FycjtcbiAgICB2YXIgaW5kZXggPSBhcnIubGVuZ3RoO1xuICAgIGtleUluZGljZXNba2V5XSA9IGluZGV4O1xuICAgIGFyci5wdXNoKHtrZXk6IGtleSwgcHJpb3JpdHk6IHByaW9yaXR5fSk7XG4gICAgdGhpcy5fZGVjcmVhc2UoaW5kZXgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhbmQgcmV0dXJucyB0aGUgc21hbGxlc3Qga2V5IGluIHRoZSBxdWV1ZS4gVGFrZXMgYE8obG9nIG4pYCB0aW1lLlxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5yZW1vdmVNaW4gPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fc3dhcCgwLCB0aGlzLl9hcnIubGVuZ3RoIC0gMSk7XG4gIHZhciBtaW4gPSB0aGlzLl9hcnIucG9wKCk7XG4gIGRlbGV0ZSB0aGlzLl9rZXlJbmRpY2VzW21pbi5rZXldO1xuICB0aGlzLl9oZWFwaWZ5KDApO1xuICByZXR1cm4gbWluLmtleTtcbn07XG5cbi8qKlxuICogRGVjcmVhc2VzIHRoZSBwcmlvcml0eSBmb3IgKiprZXkqKiB0byAqKnByaW9yaXR5KiouIElmIHRoZSBuZXcgcHJpb3JpdHkgaXNcbiAqIGdyZWF0ZXIgdGhhbiB0aGUgcHJldmlvdXMgcHJpb3JpdHksIHRoaXMgZnVuY3Rpb24gd2lsbCB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0ga2V5IHRoZSBrZXkgZm9yIHdoaWNoIHRvIHJhaXNlIHByaW9yaXR5XG4gKiBAcGFyYW0ge051bWJlcn0gcHJpb3JpdHkgdGhlIG5ldyBwcmlvcml0eSBmb3IgdGhlIGtleVxuICovXG5Qcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5kZWNyZWFzZSA9IGZ1bmN0aW9uKGtleSwgcHJpb3JpdHkpIHtcbiAgdmFyIGluZGV4ID0gdGhpcy5fa2V5SW5kaWNlc1trZXldO1xuICBpZiAocHJpb3JpdHkgPiB0aGlzLl9hcnJbaW5kZXhdLnByaW9yaXR5KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTmV3IHByaW9yaXR5IGlzIGdyZWF0ZXIgdGhhbiBjdXJyZW50IHByaW9yaXR5LiBcIiArXG4gICAgICAgIFwiS2V5OiBcIiArIGtleSArIFwiIE9sZDogXCIgKyB0aGlzLl9hcnJbaW5kZXhdLnByaW9yaXR5ICsgXCIgTmV3OiBcIiArIHByaW9yaXR5KTtcbiAgfVxuICB0aGlzLl9hcnJbaW5kZXhdLnByaW9yaXR5ID0gcHJpb3JpdHk7XG4gIHRoaXMuX2RlY3JlYXNlKGluZGV4KTtcbn07XG5cblByaW9yaXR5UXVldWUucHJvdG90eXBlLl9oZWFwaWZ5ID0gZnVuY3Rpb24oaSkge1xuICB2YXIgYXJyID0gdGhpcy5fYXJyO1xuICB2YXIgbCA9IDIgKiBpLFxuICAgICAgciA9IGwgKyAxLFxuICAgICAgbGFyZ2VzdCA9IGk7XG4gIGlmIChsIDwgYXJyLmxlbmd0aCkge1xuICAgIGxhcmdlc3QgPSBhcnJbbF0ucHJpb3JpdHkgPCBhcnJbbGFyZ2VzdF0ucHJpb3JpdHkgPyBsIDogbGFyZ2VzdDtcbiAgICBpZiAociA8IGFyci5sZW5ndGgpIHtcbiAgICAgIGxhcmdlc3QgPSBhcnJbcl0ucHJpb3JpdHkgPCBhcnJbbGFyZ2VzdF0ucHJpb3JpdHkgPyByIDogbGFyZ2VzdDtcbiAgICB9XG4gICAgaWYgKGxhcmdlc3QgIT09IGkpIHtcbiAgICAgIHRoaXMuX3N3YXAoaSwgbGFyZ2VzdCk7XG4gICAgICB0aGlzLl9oZWFwaWZ5KGxhcmdlc3QpO1xuICAgIH1cbiAgfVxufTtcblxuUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuX2RlY3JlYXNlID0gZnVuY3Rpb24oaW5kZXgpIHtcbiAgdmFyIGFyciA9IHRoaXMuX2FycjtcbiAgdmFyIHByaW9yaXR5ID0gYXJyW2luZGV4XS5wcmlvcml0eTtcbiAgdmFyIHBhcmVudDtcbiAgd2hpbGUgKGluZGV4ICE9PSAwKSB7XG4gICAgcGFyZW50ID0gaW5kZXggPj4gMTtcbiAgICBpZiAoYXJyW3BhcmVudF0ucHJpb3JpdHkgPCBwcmlvcml0eSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuX3N3YXAoaW5kZXgsIHBhcmVudCk7XG4gICAgaW5kZXggPSBwYXJlbnQ7XG4gIH1cbn07XG5cblByaW9yaXR5UXVldWUucHJvdG90eXBlLl9zd2FwID0gZnVuY3Rpb24oaSwgaikge1xuICB2YXIgYXJyID0gdGhpcy5fYXJyO1xuICB2YXIga2V5SW5kaWNlcyA9IHRoaXMuX2tleUluZGljZXM7XG4gIHZhciBvcmlnQXJySSA9IGFycltpXTtcbiAgdmFyIG9yaWdBcnJKID0gYXJyW2pdO1xuICBhcnJbaV0gPSBvcmlnQXJySjtcbiAgYXJyW2pdID0gb3JpZ0Fyckk7XG4gIGtleUluZGljZXNbb3JpZ0Fyckoua2V5XSA9IGk7XG4gIGtleUluZGljZXNbb3JpZ0Fyckkua2V5XSA9IGo7XG59O1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTZXQ7XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIG5ldyBTZXQgd2l0aCBhbiBvcHRpb25hbCBzZXQgb2YgYGluaXRpYWxLZXlzYC5cbiAqXG4gKiBJdCBpcyBpbXBvcnRhbnQgdG8gbm90ZSB0aGF0IGtleXMgYXJlIGNvZXJjZWQgdG8gU3RyaW5nIGZvciBtb3N0IHB1cnBvc2VzXG4gKiB3aXRoIHRoaXMgb2JqZWN0LCBzaW1pbGFyIHRvIHRoZSBiZWhhdmlvciBvZiBKYXZhU2NyaXB0J3MgT2JqZWN0LiBGb3JcbiAqIGV4YW1wbGUsIHRoZSBmb2xsb3dpbmcgd2lsbCBhZGQgb25seSBvbmUga2V5OlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTZXQoKTtcbiAqICAgICBzLmFkZCgxKTtcbiAqICAgICBzLmFkZChcIjFcIik7XG4gKlxuICogSG93ZXZlciwgdGhlIHR5cGUgb2YgdGhlIGtleSBpcyBwcmVzZXJ2ZWQgaW50ZXJuYWxseSBzbyB0aGF0IGBrZXlzYCByZXR1cm5zXG4gKiB0aGUgb3JpZ2luYWwga2V5IHNldCB1bmNvZXJjZWQuIEZvciB0aGUgYWJvdmUgZXhhbXBsZSwgYGtleXNgIHdvdWxkIHJldHVyblxuICogYFsxXWAuXG4gKi9cbmZ1bmN0aW9uIFNldChpbml0aWFsS2V5cykge1xuICB0aGlzLl9zaXplID0gMDtcbiAgdGhpcy5fa2V5cyA9IHt9O1xuXG4gIGlmIChpbml0aWFsS2V5cykge1xuICAgIGZvciAodmFyIGkgPSAwLCBpbCA9IGluaXRpYWxLZXlzLmxlbmd0aDsgaSA8IGlsOyArK2kpIHtcbiAgICAgIHRoaXMuYWRkKGluaXRpYWxLZXlzW2ldKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgbmV3IFNldCB0aGF0IHJlcHJlc2VudHMgdGhlIHNldCBpbnRlcnNlY3Rpb24gb2YgdGhlIGFycmF5IG9mIGdpdmVuXG4gKiBzZXRzLlxuICovXG5TZXQuaW50ZXJzZWN0ID0gZnVuY3Rpb24oc2V0cykge1xuICBpZiAoc2V0cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IFNldCgpO1xuICB9XG5cbiAgdmFyIHJlc3VsdCA9IG5ldyBTZXQoIXV0aWwuaXNBcnJheShzZXRzWzBdKSA/IHNldHNbMF0ua2V5cygpIDogc2V0c1swXSk7XG4gIGZvciAodmFyIGkgPSAxLCBpbCA9IHNldHMubGVuZ3RoOyBpIDwgaWw7ICsraSkge1xuICAgIHZhciByZXN1bHRLZXlzID0gcmVzdWx0LmtleXMoKSxcbiAgICAgICAgb3RoZXIgPSAhdXRpbC5pc0FycmF5KHNldHNbaV0pID8gc2V0c1tpXSA6IG5ldyBTZXQoc2V0c1tpXSk7XG4gICAgZm9yICh2YXIgaiA9IDAsIGpsID0gcmVzdWx0S2V5cy5sZW5ndGg7IGogPCBqbDsgKytqKSB7XG4gICAgICB2YXIga2V5ID0gcmVzdWx0S2V5c1tqXTtcbiAgICAgIGlmICghb3RoZXIuaGFzKGtleSkpIHtcbiAgICAgICAgcmVzdWx0LnJlbW92ZShrZXkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgU2V0IHRoYXQgcmVwcmVzZW50cyB0aGUgc2V0IHVuaW9uIG9mIHRoZSBhcnJheSBvZiBnaXZlbiBzZXRzLlxuICovXG5TZXQudW5pb24gPSBmdW5jdGlvbihzZXRzKSB7XG4gIHZhciB0b3RhbEVsZW1zID0gdXRpbC5yZWR1Y2Uoc2V0cywgZnVuY3Rpb24obGhzLCByaHMpIHtcbiAgICByZXR1cm4gbGhzICsgKHJocy5zaXplID8gcmhzLnNpemUoKSA6IHJocy5sZW5ndGgpO1xuICB9LCAwKTtcbiAgdmFyIGFyciA9IG5ldyBBcnJheSh0b3RhbEVsZW1zKTtcblxuICB2YXIgayA9IDA7XG4gIGZvciAodmFyIGkgPSAwLCBpbCA9IHNldHMubGVuZ3RoOyBpIDwgaWw7ICsraSkge1xuICAgIHZhciBjdXIgPSBzZXRzW2ldLFxuICAgICAgICBrZXlzID0gIXV0aWwuaXNBcnJheShjdXIpID8gY3VyLmtleXMoKSA6IGN1cjtcbiAgICBmb3IgKHZhciBqID0gMCwgamwgPSBrZXlzLmxlbmd0aDsgaiA8IGpsOyArK2opIHtcbiAgICAgIGFycltrKytdID0ga2V5c1tqXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IFNldChhcnIpO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBzaXplIG9mIHRoaXMgc2V0IGluIGBPKDEpYCB0aW1lLlxuICovXG5TZXQucHJvdG90eXBlLnNpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX3NpemU7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGtleXMgaW4gdGhpcyBzZXQuIFRha2VzIGBPKG4pYCB0aW1lLlxuICovXG5TZXQucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHZhbHVlcyh0aGlzLl9rZXlzKTtcbn07XG5cbi8qKlxuICogVGVzdHMgaWYgYSBrZXkgaXMgcHJlc2VudCBpbiB0aGlzIFNldC4gUmV0dXJucyBgdHJ1ZWAgaWYgaXQgaXMgYW5kIGBmYWxzZWBcbiAqIGlmIG5vdC4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24oa2V5KSB7XG4gIHJldHVybiBrZXkgaW4gdGhpcy5fa2V5cztcbn07XG5cbi8qKlxuICogQWRkcyBhIG5ldyBrZXkgdG8gdGhpcyBTZXQgaWYgaXQgaXMgbm90IGFscmVhZHkgcHJlc2VudC4gUmV0dXJucyBgdHJ1ZWAgaWZcbiAqIHRoZSBrZXkgd2FzIGFkZGVkIGFuZCBgZmFsc2VgIGlmIGl0IHdhcyBhbHJlYWR5IHByZXNlbnQuIFRha2VzIGBPKDEpYCB0aW1lLlxuICovXG5TZXQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGtleSkge1xuICBpZiAoIShrZXkgaW4gdGhpcy5fa2V5cykpIHtcbiAgICB0aGlzLl9rZXlzW2tleV0gPSBrZXk7XG4gICAgKyt0aGlzLl9zaXplO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhIGtleSBmcm9tIHRoaXMgU2V0LiBJZiB0aGUga2V5IHdhcyByZW1vdmVkIHRoaXMgZnVuY3Rpb24gcmV0dXJuc1xuICogYHRydWVgLiBJZiBub3QsIGl0IHJldHVybnMgYGZhbHNlYC4gVGFrZXMgYE8oMSlgIHRpbWUuXG4gKi9cblNldC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oa2V5KSB7XG4gIGlmIChrZXkgaW4gdGhpcy5fa2V5cykge1xuICAgIGRlbGV0ZSB0aGlzLl9rZXlzW2tleV07XG4gICAgLS10aGlzLl9zaXplO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGFsbCB2YWx1ZXMgZm9yIHByb3BlcnRpZXMgb2YgKipvKiouXG4gKi9cbmZ1bmN0aW9uIHZhbHVlcyhvKSB7XG4gIHZhciBrcyA9IE9iamVjdC5rZXlzKG8pLFxuICAgICAgbGVuID0ga3MubGVuZ3RoLFxuICAgICAgcmVzdWx0ID0gbmV3IEFycmF5KGxlbiksXG4gICAgICBpO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSBvW2tzW2ldXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuIiwiLypcbiAqIFRoaXMgcG9seWZpbGwgY29tZXMgZnJvbVxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvaXNBcnJheVxuICovXG5pZighQXJyYXkuaXNBcnJheSkge1xuICBleHBvcnRzLmlzQXJyYXkgPSBmdW5jdGlvbiAodkFyZykge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodkFyZykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG59IGVsc2Uge1xuICBleHBvcnRzLmlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xufVxuXG4vKlxuICogU2xpZ2h0bHkgYWRhcHRlZCBwb2x5ZmlsbCBmcm9tXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9SZWR1Y2VcbiAqL1xuaWYgKCdmdW5jdGlvbicgIT09IHR5cGVvZiBBcnJheS5wcm90b3R5cGUucmVkdWNlKSB7XG4gIGV4cG9ydHMucmVkdWNlID0gZnVuY3Rpb24oYXJyYXksIGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGlmIChudWxsID09PSBhcnJheSB8fCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGFycmF5KSB7XG4gICAgICAvLyBBdCB0aGUgbW9tZW50IGFsbCBtb2Rlcm4gYnJvd3NlcnMsIHRoYXQgc3VwcG9ydCBzdHJpY3QgbW9kZSwgaGF2ZVxuICAgICAgLy8gbmF0aXZlIGltcGxlbWVudGF0aW9uIG9mIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UuIEZvciBpbnN0YW5jZSwgSUU4XG4gICAgICAvLyBkb2VzIG5vdCBzdXBwb3J0IHN0cmljdCBtb2RlLCBzbyB0aGlzIGNoZWNrIGlzIGFjdHVhbGx5IHVzZWxlc3MuXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICdBcnJheS5wcm90b3R5cGUucmVkdWNlIGNhbGxlZCBvbiBudWxsIG9yIHVuZGVmaW5lZCcpO1xuICAgIH1cbiAgICBpZiAoJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNhbGxiYWNrKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGNhbGxiYWNrICsgJyBpcyBub3QgYSBmdW5jdGlvbicpO1xuICAgIH1cbiAgICB2YXIgaW5kZXgsIHZhbHVlLFxuICAgICAgICBsZW5ndGggPSBhcnJheS5sZW5ndGggPj4+IDAsXG4gICAgICAgIGlzVmFsdWVTZXQgPSBmYWxzZTtcbiAgICBpZiAoMSA8IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIHZhbHVlID0gb3B0X2luaXRpYWxWYWx1ZTtcbiAgICAgIGlzVmFsdWVTZXQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGluZGV4ID0gMDsgbGVuZ3RoID4gaW5kZXg7ICsraW5kZXgpIHtcbiAgICAgIGlmIChhcnJheS5oYXNPd25Qcm9wZXJ0eShpbmRleCkpIHtcbiAgICAgICAgaWYgKGlzVmFsdWVTZXQpIHtcbiAgICAgICAgICB2YWx1ZSA9IGNhbGxiYWNrKHZhbHVlLCBhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICAgICAgaXNWYWx1ZVNldCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFpc1ZhbHVlU2V0KSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJyk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbn0gZWxzZSB7XG4gIGV4cG9ydHMucmVkdWNlID0gZnVuY3Rpb24oYXJyYXksIGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5LnJlZHVjZShjYWxsYmFjaywgb3B0X2luaXRpYWxWYWx1ZSk7XG4gIH07XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICcxLjEuMyc7XG4iLCJleHBvcnRzLkdyYXBoID0gcmVxdWlyZShcIi4vbGliL0dyYXBoXCIpO1xuZXhwb3J0cy5EaWdyYXBoID0gcmVxdWlyZShcIi4vbGliL0RpZ3JhcGhcIik7XG5leHBvcnRzLkNHcmFwaCA9IHJlcXVpcmUoXCIuL2xpYi9DR3JhcGhcIik7XG5leHBvcnRzLkNEaWdyYXBoID0gcmVxdWlyZShcIi4vbGliL0NEaWdyYXBoXCIpO1xucmVxdWlyZShcIi4vbGliL2dyYXBoLWNvbnZlcnRlcnNcIik7XG5cbmV4cG9ydHMuYWxnID0ge1xuICBpc0FjeWNsaWM6IHJlcXVpcmUoXCIuL2xpYi9hbGcvaXNBY3ljbGljXCIpLFxuICBjb21wb25lbnRzOiByZXF1aXJlKFwiLi9saWIvYWxnL2NvbXBvbmVudHNcIiksXG4gIGRpamtzdHJhOiByZXF1aXJlKFwiLi9saWIvYWxnL2RpamtzdHJhXCIpLFxuICBkaWprc3RyYUFsbDogcmVxdWlyZShcIi4vbGliL2FsZy9kaWprc3RyYUFsbFwiKSxcbiAgZmluZEN5Y2xlczogcmVxdWlyZShcIi4vbGliL2FsZy9maW5kQ3ljbGVzXCIpLFxuICBmbG95ZFdhcnNoYWxsOiByZXF1aXJlKFwiLi9saWIvYWxnL2Zsb3lkV2Fyc2hhbGxcIiksXG4gIHBvc3RvcmRlcjogcmVxdWlyZShcIi4vbGliL2FsZy9wb3N0b3JkZXJcIiksXG4gIHByZW9yZGVyOiByZXF1aXJlKFwiLi9saWIvYWxnL3ByZW9yZGVyXCIpLFxuICBwcmltOiByZXF1aXJlKFwiLi9saWIvYWxnL3ByaW1cIiksXG4gIHRhcmphbjogcmVxdWlyZShcIi4vbGliL2FsZy90YXJqYW5cIiksXG4gIHRvcHNvcnQ6IHJlcXVpcmUoXCIuL2xpYi9hbGcvdG9wc29ydFwiKVxufTtcblxuZXhwb3J0cy5jb252ZXJ0ZXIgPSB7XG4gIGpzb246IHJlcXVpcmUoXCIuL2xpYi9jb252ZXJ0ZXIvanNvbi5qc1wiKVxufTtcblxudmFyIGZpbHRlciA9IHJlcXVpcmUoXCIuL2xpYi9maWx0ZXJcIik7XG5leHBvcnRzLmZpbHRlciA9IHtcbiAgYWxsOiBmaWx0ZXIuYWxsLFxuICBub2Rlc0Zyb21MaXN0OiBmaWx0ZXIubm9kZXNGcm9tTGlzdFxufTtcblxuZXhwb3J0cy52ZXJzaW9uID0gcmVxdWlyZShcIi4vbGliL3ZlcnNpb25cIik7XG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlR3JhcGg7XG5cbmZ1bmN0aW9uIEJhc2VHcmFwaCgpIHtcbiAgLy8gVGhlIHZhbHVlIGFzc2lnbmVkIHRvIHRoZSBncmFwaCBpdHNlbGYuXG4gIHRoaXMuX3ZhbHVlID0gdW5kZWZpbmVkO1xuXG4gIC8vIE1hcCBvZiBub2RlIGlkIC0+IHsgaWQsIHZhbHVlIH1cbiAgdGhpcy5fbm9kZXMgPSB7fTtcblxuICAvLyBNYXAgb2YgZWRnZSBpZCAtPiB7IGlkLCB1LCB2LCB2YWx1ZSB9XG4gIHRoaXMuX2VkZ2VzID0ge307XG5cbiAgLy8gVXNlZCB0byBnZW5lcmF0ZSBhIHVuaXF1ZSBpZCBpbiB0aGUgZ3JhcGhcbiAgdGhpcy5fbmV4dElkID0gMDtcbn1cblxuLy8gTnVtYmVyIG9mIG5vZGVzXG5CYXNlR3JhcGgucHJvdG90eXBlLm9yZGVyID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9ub2RlcykubGVuZ3RoO1xufTtcblxuLy8gTnVtYmVyIG9mIGVkZ2VzXG5CYXNlR3JhcGgucHJvdG90eXBlLnNpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2VkZ2VzKS5sZW5ndGg7XG59O1xuXG4vLyBBY2Nlc3NvciBmb3IgZ3JhcGggbGV2ZWwgdmFsdWVcbkJhc2VHcmFwaC5wcm90b3R5cGUuZ3JhcGggPSBmdW5jdGlvbih2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB0aGlzLl92YWx1ZTtcbiAgfVxuICB0aGlzLl92YWx1ZSA9IHZhbHVlO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5oYXNOb2RlID0gZnVuY3Rpb24odSkge1xuICByZXR1cm4gdSBpbiB0aGlzLl9ub2Rlcztcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUubm9kZSA9IGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gIHZhciBub2RlID0gdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICBub2RlLnZhbHVlID0gdmFsdWU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLm5vZGVzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBub2RlcyA9IFtdO1xuICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKGlkKSB7IG5vZGVzLnB1c2goaWQpOyB9KTtcbiAgcmV0dXJuIG5vZGVzO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5lYWNoTm9kZSA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgZm9yICh2YXIgayBpbiB0aGlzLl9ub2Rlcykge1xuICAgIHZhciBub2RlID0gdGhpcy5fbm9kZXNba107XG4gICAgZnVuYyhub2RlLmlkLCBub2RlLnZhbHVlKTtcbiAgfVxufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5oYXNFZGdlID0gZnVuY3Rpb24oZSkge1xuICByZXR1cm4gZSBpbiB0aGlzLl9lZGdlcztcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuZWRnZSA9IGZ1bmN0aW9uKGUsIHZhbHVlKSB7XG4gIHZhciBlZGdlID0gdGhpcy5fc3RyaWN0R2V0RWRnZShlKTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gZWRnZS52YWx1ZTtcbiAgfVxuICBlZGdlLnZhbHVlID0gdmFsdWU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmVkZ2VzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBlcyA9IFtdO1xuICB0aGlzLmVhY2hFZGdlKGZ1bmN0aW9uKGlkKSB7IGVzLnB1c2goaWQpOyB9KTtcbiAgcmV0dXJuIGVzO1xufTtcblxuQmFzZUdyYXBoLnByb3RvdHlwZS5lYWNoRWRnZSA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgZm9yICh2YXIgayBpbiB0aGlzLl9lZGdlcykge1xuICAgIHZhciBlZGdlID0gdGhpcy5fZWRnZXNba107XG4gICAgZnVuYyhlZGdlLmlkLCBlZGdlLnUsIGVkZ2UudiwgZWRnZS52YWx1ZSk7XG4gIH1cbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuaW5jaWRlbnROb2RlcyA9IGZ1bmN0aW9uKGUpIHtcbiAgdmFyIGVkZ2UgPSB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpO1xuICByZXR1cm4gW2VkZ2UudSwgZWRnZS52XTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuYWRkTm9kZSA9IGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gIGlmICh1ID09PSB1bmRlZmluZWQgfHwgdSA9PT0gbnVsbCkge1xuICAgIGRvIHtcbiAgICAgIHUgPSBcIl9cIiArICgrK3RoaXMuX25leHRJZCk7XG4gICAgfSB3aGlsZSAodGhpcy5oYXNOb2RlKHUpKTtcbiAgfSBlbHNlIGlmICh0aGlzLmhhc05vZGUodSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJHcmFwaCBhbHJlYWR5IGhhcyBub2RlICdcIiArIHUgKyBcIidcIik7XG4gIH1cbiAgdGhpcy5fbm9kZXNbdV0gPSB7IGlkOiB1LCB2YWx1ZTogdmFsdWUgfTtcbiAgcmV0dXJuIHU7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmRlbE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHRoaXMuaW5jaWRlbnRFZGdlcyh1KS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHsgdGhpcy5kZWxFZGdlKGUpOyB9LCB0aGlzKTtcbiAgZGVsZXRlIHRoaXMuX25vZGVzW3VdO1xufTtcblxuLy8gaW5NYXAgYW5kIG91dE1hcCBhcmUgb3Bwb3NpdGUgc2lkZXMgb2YgYW4gaW5jaWRlbmNlIG1hcC4gRm9yIGV4YW1wbGUsIGZvclxuLy8gR3JhcGggdGhlc2Ugd291bGQgYm90aCBjb21lIGZyb20gdGhlIF9pbmNpZGVudEVkZ2VzIG1hcCwgd2hpbGUgZm9yIERpZ3JhcGhcbi8vIHRoZXkgd291bGQgY29tZSBmcm9tIF9pbkVkZ2VzIGFuZCBfb3V0RWRnZXMuXG5CYXNlR3JhcGgucHJvdG90eXBlLl9hZGRFZGdlID0gZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUsIGluTWFwLCBvdXRNYXApIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh2KTtcblxuICBpZiAoZSA9PT0gdW5kZWZpbmVkIHx8IGUgPT09IG51bGwpIHtcbiAgICBkbyB7XG4gICAgICBlID0gXCJfXCIgKyAoKyt0aGlzLl9uZXh0SWQpO1xuICAgIH0gd2hpbGUgKHRoaXMuaGFzRWRnZShlKSk7XG4gIH1cbiAgZWxzZSBpZiAodGhpcy5oYXNFZGdlKGUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiR3JhcGggYWxyZWFkeSBoYXMgZWRnZSAnXCIgKyBlICsgXCInXCIpO1xuICB9XG5cbiAgdGhpcy5fZWRnZXNbZV0gPSB7IGlkOiBlLCB1OiB1LCB2OiB2LCB2YWx1ZTogdmFsdWUgfTtcbiAgYWRkRWRnZVRvTWFwKGluTWFwW3ZdLCB1LCBlKTtcbiAgYWRkRWRnZVRvTWFwKG91dE1hcFt1XSwgdiwgZSk7XG5cbiAgcmV0dXJuIGU7XG59O1xuXG4vLyBTZWUgbm90ZSBmb3IgX2FkZEVkZ2UgcmVnYXJkaW5nIGluTWFwIGFuZCBvdXRNYXAuXG5CYXNlR3JhcGgucHJvdG90eXBlLl9kZWxFZGdlID0gZnVuY3Rpb24oZSwgaW5NYXAsIG91dE1hcCkge1xuICB2YXIgZWRnZSA9IHRoaXMuX3N0cmljdEdldEVkZ2UoZSk7XG4gIGRlbEVkZ2VGcm9tTWFwKGluTWFwW2VkZ2Uudl0sIGVkZ2UudSwgZSk7XG4gIGRlbEVkZ2VGcm9tTWFwKG91dE1hcFtlZGdlLnVdLCBlZGdlLnYsIGUpO1xuICBkZWxldGUgdGhpcy5fZWRnZXNbZV07XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGNvcHkgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICBjb3B5LmdyYXBoKHRoaXMuZ3JhcGgoKSk7XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgY29weS5hZGROb2RlKHUsIHZhbHVlKTsgfSk7XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHsgY29weS5hZGRFZGdlKGUsIHUsIHYsIHZhbHVlKTsgfSk7XG4gIGNvcHkuX25leHRJZCA9IHRoaXMuX25leHRJZDtcbiAgcmV0dXJuIGNvcHk7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLmZpbHRlck5vZGVzID0gZnVuY3Rpb24oZmlsdGVyKSB7XG4gIHZhciBjb3B5ID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgY29weS5ncmFwaCh0aGlzLmdyYXBoKCkpO1xuICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgaWYgKGZpbHRlcih1KSkge1xuICAgICAgY29weS5hZGROb2RlKHUsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICB0aGlzLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgaWYgKGNvcHkuaGFzTm9kZSh1KSAmJiBjb3B5Lmhhc05vZGUodikpIHtcbiAgICAgIGNvcHkuYWRkRWRnZShlLCB1LCB2LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGNvcHk7XG59O1xuXG5CYXNlR3JhcGgucHJvdG90eXBlLl9zdHJpY3RHZXROb2RlID0gZnVuY3Rpb24odSkge1xuICB2YXIgbm9kZSA9IHRoaXMuX25vZGVzW3VdO1xuICBpZiAobm9kZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTm9kZSAnXCIgKyB1ICsgXCInIGlzIG5vdCBpbiBncmFwaFwiKTtcbiAgfVxuICByZXR1cm4gbm9kZTtcbn07XG5cbkJhc2VHcmFwaC5wcm90b3R5cGUuX3N0cmljdEdldEVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIHZhciBlZGdlID0gdGhpcy5fZWRnZXNbZV07XG4gIGlmIChlZGdlID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFZGdlICdcIiArIGUgKyBcIicgaXMgbm90IGluIGdyYXBoXCIpO1xuICB9XG4gIHJldHVybiBlZGdlO1xufTtcblxuZnVuY3Rpb24gYWRkRWRnZVRvTWFwKG1hcCwgdiwgZSkge1xuICAobWFwW3ZdIHx8IChtYXBbdl0gPSBuZXcgU2V0KCkpKS5hZGQoZSk7XG59XG5cbmZ1bmN0aW9uIGRlbEVkZ2VGcm9tTWFwKG1hcCwgdiwgZSkge1xuICB2YXIgdkVudHJ5ID0gbWFwW3ZdO1xuICB2RW50cnkucmVtb3ZlKGUpO1xuICBpZiAodkVudHJ5LnNpemUoKSA9PT0gMCkge1xuICAgIGRlbGV0ZSBtYXBbdl07XG4gIH1cbn1cblxuIiwidmFyIERpZ3JhcGggPSByZXF1aXJlKFwiLi9EaWdyYXBoXCIpLFxuICAgIGNvbXBvdW5kaWZ5ID0gcmVxdWlyZShcIi4vY29tcG91bmRpZnlcIik7XG5cbnZhciBDRGlncmFwaCA9IGNvbXBvdW5kaWZ5KERpZ3JhcGgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENEaWdyYXBoO1xuXG5DRGlncmFwaC5mcm9tRGlncmFwaCA9IGZ1bmN0aW9uKHNyYykge1xuICB2YXIgZyA9IG5ldyBDRGlncmFwaCgpLFxuICAgICAgZ3JhcGhWYWx1ZSA9IHNyYy5ncmFwaCgpO1xuXG4gIGlmIChncmFwaFZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICBnLmdyYXBoKGdyYXBoVmFsdWUpO1xuICB9XG5cbiAgc3JjLmVhY2hOb2RlKGZ1bmN0aW9uKHUsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGcuYWRkTm9kZSh1KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZy5hZGROb2RlKHUsIHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuICBzcmMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5hZGRFZGdlKG51bGwsIHUsIHYpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdiwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBnO1xufTtcblxuQ0RpZ3JhcGgucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkNEaWdyYXBoIFwiICsgSlNPTi5zdHJpbmdpZnkodGhpcywgbnVsbCwgMik7XG59O1xuIiwidmFyIEdyYXBoID0gcmVxdWlyZShcIi4vR3JhcGhcIiksXG4gICAgY29tcG91bmRpZnkgPSByZXF1aXJlKFwiLi9jb21wb3VuZGlmeVwiKTtcblxudmFyIENHcmFwaCA9IGNvbXBvdW5kaWZ5KEdyYXBoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBDR3JhcGg7XG5cbkNHcmFwaC5mcm9tR3JhcGggPSBmdW5jdGlvbihzcmMpIHtcbiAgdmFyIGcgPSBuZXcgQ0dyYXBoKCksXG4gICAgICBncmFwaFZhbHVlID0gc3JjLmdyYXBoKCk7XG5cbiAgaWYgKGdyYXBoVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIGcuZ3JhcGgoZ3JhcGhWYWx1ZSk7XG4gIH1cblxuICBzcmMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZy5hZGROb2RlKHUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnLmFkZE5vZGUodSwgdmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHNyYy5lYWNoRWRnZShmdW5jdGlvbihlLCB1LCB2LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGcuYWRkRWRnZShudWxsLCB1LCB2LCB2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGc7XG59O1xuXG5DR3JhcGgucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkNHcmFwaCBcIiArIEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIDIpO1xufTtcbiIsIi8qXG4gKiBUaGlzIGZpbGUgaXMgb3JnYW5pemVkIHdpdGggaW4gdGhlIGZvbGxvd2luZyBvcmRlcjpcbiAqXG4gKiBFeHBvcnRzXG4gKiBHcmFwaCBjb25zdHJ1Y3RvcnNcbiAqIEdyYXBoIHF1ZXJpZXMgKGUuZy4gbm9kZXMoKSwgZWRnZXMoKVxuICogR3JhcGggbXV0YXRvcnNcbiAqIEhlbHBlciBmdW5jdGlvbnNcbiAqL1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIiksXG4gICAgQmFzZUdyYXBoID0gcmVxdWlyZShcIi4vQmFzZUdyYXBoXCIpLFxuLyoganNoaW50IC1XMDc5ICovXG4gICAgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gRGlncmFwaDtcblxuLypcbiAqIENvbnN0cnVjdG9yIHRvIGNyZWF0ZSBhIG5ldyBkaXJlY3RlZCBtdWx0aS1ncmFwaC5cbiAqL1xuZnVuY3Rpb24gRGlncmFwaCgpIHtcbiAgQmFzZUdyYXBoLmNhbGwodGhpcyk7XG5cbiAgLyohIE1hcCBvZiBzb3VyY2VJZCAtPiB7dGFyZ2V0SWQgLT4gU2V0IG9mIGVkZ2UgaWRzfSAqL1xuICB0aGlzLl9pbkVkZ2VzID0ge307XG5cbiAgLyohIE1hcCBvZiB0YXJnZXRJZCAtPiB7c291cmNlSWQgLT4gU2V0IG9mIGVkZ2UgaWRzfSAqL1xuICB0aGlzLl9vdXRFZGdlcyA9IHt9O1xufVxuXG5EaWdyYXBoLnByb3RvdHlwZSA9IG5ldyBCYXNlR3JhcGgoKTtcbkRpZ3JhcGgucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gRGlncmFwaDtcblxuLypcbiAqIEFsd2F5cyByZXR1cm5zIGB0cnVlYC5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuaXNEaXJlY3RlZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBzdWNjZXNzb3JzIG9mIHRoZSBub2RlIHdpdGggdGhlIGlkIGB1YC4gVGhhdCBpcywgYWxsIG5vZGVzXG4gKiB0aGF0IGhhdmUgdGhlIG5vZGUgYHVgIGFzIHRoZWlyIHNvdXJjZSBhcmUgcmV0dXJuZWQuXG4gKiBcbiAqIElmIG5vIG5vZGUgYHVgIGV4aXN0cyBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnN1Y2Nlc3NvcnMgPSBmdW5jdGlvbih1KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9vdXRFZGdlc1t1XSlcbiAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24odikgeyByZXR1cm4gdGhpcy5fbm9kZXNbdl0uaWQ7IH0sIHRoaXMpO1xufTtcblxuLypcbiAqIFJldHVybnMgYWxsIHByZWRlY2Vzc29ycyBvZiB0aGUgbm9kZSB3aXRoIHRoZSBpZCBgdWAuIFRoYXQgaXMsIGFsbCBub2Rlc1xuICogdGhhdCBoYXZlIHRoZSBub2RlIGB1YCBhcyB0aGVpciB0YXJnZXQgYXJlIHJldHVybmVkLlxuICogXG4gKiBJZiBubyBub2RlIGB1YCBleGlzdHMgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5wcmVkZWNlc3NvcnMgPSBmdW5jdGlvbih1KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9pbkVkZ2VzW3VdKVxuICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbih2KSB7IHJldHVybiB0aGlzLl9ub2Rlc1t2XS5pZDsgfSwgdGhpcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgbm9kZXMgdGhhdCBhcmUgYWRqYWNlbnQgdG8gdGhlIG5vZGUgd2l0aCB0aGUgaWQgYHVgLiBJbiBvdGhlclxuICogd29yZHMsIHRoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgc2V0IG9mIGFsbCBzdWNjZXNzb3JzIGFuZCBwcmVkZWNlc3NvcnMgb2ZcbiAqIG5vZGUgYHVgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5uZWlnaGJvcnMgPSBmdW5jdGlvbih1KSB7XG4gIHJldHVybiBTZXQudW5pb24oW3RoaXMuc3VjY2Vzc29ycyh1KSwgdGhpcy5wcmVkZWNlc3NvcnModSldKS5rZXlzKCk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbGwgbm9kZXMgaW4gdGhlIGdyYXBoIHRoYXQgaGF2ZSBubyBpbi1lZGdlcy5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuc291cmNlcyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHJldHVybiB0aGlzLl9maWx0ZXJOb2RlcyhmdW5jdGlvbih1KSB7XG4gICAgLy8gVGhpcyBjb3VsZCBoYXZlIGJldHRlciBzcGFjZSBjaGFyYWN0ZXJpc3RpY3MgaWYgd2UgaGFkIGFuIGluRGVncmVlIGZ1bmN0aW9uLlxuICAgIHJldHVybiBzZWxmLmluRWRnZXModSkubGVuZ3RoID09PSAwO1xuICB9KTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBub2RlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIG5vIG91dC1lZGdlcy5cbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuc2lua3MgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gdGhpcy5fZmlsdGVyTm9kZXMoZnVuY3Rpb24odSkge1xuICAgIC8vIFRoaXMgY291bGQgaGF2ZSBiZXR0ZXIgc3BhY2UgY2hhcmFjdGVyaXN0aWNzIGlmIHdlIGhhdmUgYW4gb3V0RGVncmVlIGZ1bmN0aW9uLlxuICAgIHJldHVybiBzZWxmLm91dEVkZ2VzKHUpLmxlbmd0aCA9PT0gMDtcbiAgfSk7XG59O1xuXG4vKlxuICogUmV0dXJucyB0aGUgc291cmNlIG5vZGUgaW5jaWRlbnQgb24gdGhlIGVkZ2UgaWRlbnRpZmllZCBieSB0aGUgaWQgYGVgLiBJZiBub1xuICogc3VjaCBlZGdlIGV4aXN0cyBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGUgYW4gZWRnZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5zb3VyY2UgPSBmdW5jdGlvbihlKSB7XG4gIHJldHVybiB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpLnU7XG59O1xuXG4vKlxuICogUmV0dXJucyB0aGUgdGFyZ2V0IG5vZGUgaW5jaWRlbnQgb24gdGhlIGVkZ2UgaWRlbnRpZmllZCBieSB0aGUgaWQgYGVgLiBJZiBub1xuICogc3VjaCBlZGdlIGV4aXN0cyBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGUgYW4gZWRnZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS50YXJnZXQgPSBmdW5jdGlvbihlKSB7XG4gIHJldHVybiB0aGlzLl9zdHJpY3RHZXRFZGdlKGUpLnY7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBpZHMgZm9yIGFsbCBlZGdlcyBpbiB0aGUgZ3JhcGggdGhhdCBoYXZlIHRoZSBub2RlXG4gKiBgdGFyZ2V0YCBhcyB0aGVpciB0YXJnZXQuIElmIHRoZSBub2RlIGB0YXJnZXRgIGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhpc1xuICogZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIE9wdGlvbmFsbHkgYSBgc291cmNlYCBub2RlIGNhbiBhbHNvIGJlIHNwZWNpZmllZC4gVGhpcyBjYXVzZXMgdGhlIHJlc3VsdHNcbiAqIHRvIGJlIGZpbHRlcmVkIHN1Y2ggdGhhdCBvbmx5IGVkZ2VzIGZyb20gYHNvdXJjZWAgdG8gYHRhcmdldGAgYXJlIGluY2x1ZGVkLlxuICogSWYgdGhlIG5vZGUgYHNvdXJjZWAgaXMgc3BlY2lmaWVkIGJ1dCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoZW4gdGhpcyBmdW5jdGlvblxuICogcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0YXJnZXQgdGhlIHRhcmdldCBub2RlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gW3NvdXJjZV0gYW4gb3B0aW9uYWwgc291cmNlIG5vZGUgaWRcbiAqL1xuRGlncmFwaC5wcm90b3R5cGUuaW5FZGdlcyA9IGZ1bmN0aW9uKHRhcmdldCwgc291cmNlKSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodGFyZ2V0KTtcbiAgdmFyIHJlc3VsdHMgPSBTZXQudW5pb24odXRpbC52YWx1ZXModGhpcy5faW5FZGdlc1t0YXJnZXRdKSkua2V5cygpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHNvdXJjZSk7XG4gICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIHRoaXMuc291cmNlKGUpID09PSBzb3VyY2U7IH0sIHRoaXMpO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgaWRzIGZvciBhbGwgZWRnZXMgaW4gdGhlIGdyYXBoIHRoYXQgaGF2ZSB0aGUgbm9kZVxuICogYHNvdXJjZWAgYXMgdGhlaXIgc291cmNlLiBJZiB0aGUgbm9kZSBgc291cmNlYCBpcyBub3QgaW4gdGhlIGdyYXBoIHRoaXNcbiAqIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBPcHRpb25hbGx5IGEgYHRhcmdldGAgbm9kZSBtYXkgYWxzbyBiZSBzcGVjaWZpZWQuIFRoaXMgY2F1c2VzIHRoZSByZXN1bHRzXG4gKiB0byBiZSBmaWx0ZXJlZCBzdWNoIHRoYXQgb25seSBlZGdlcyBmcm9tIGBzb3VyY2VgIHRvIGB0YXJnZXRgIGFyZSBpbmNsdWRlZC5cbiAqIElmIHRoZSBub2RlIGB0YXJnZXRgIGlzIHNwZWNpZmllZCBidXQgaXMgbm90IGluIHRoZSBncmFwaCB0aGVuIHRoaXMgZnVuY3Rpb25cbiAqIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc291cmNlIHRoZSBzb3VyY2Ugbm9kZSBpZFxuICogQHBhcmFtIHtTdHJpbmd9IFt0YXJnZXRdIGFuIG9wdGlvbmFsIHRhcmdldCBub2RlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLm91dEVkZ2VzID0gZnVuY3Rpb24oc291cmNlLCB0YXJnZXQpIHtcbiAgdGhpcy5fc3RyaWN0R2V0Tm9kZShzb3VyY2UpO1xuICB2YXIgcmVzdWx0cyA9IFNldC51bmlvbih1dGlsLnZhbHVlcyh0aGlzLl9vdXRFZGdlc1tzb3VyY2VdKSkua2V5cygpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHRhcmdldCk7XG4gICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIHRoaXMudGFyZ2V0KGUpID09PSB0YXJnZXQ7IH0sIHRoaXMpO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcblxuLypcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgaWRzIGZvciBhbGwgZWRnZXMgaW4gdGhlIGdyYXBoIHRoYXQgaGF2ZSB0aGUgYHVgIGFzXG4gKiB0aGVpciBzb3VyY2Ugb3IgdGhlaXIgdGFyZ2V0LiBJZiB0aGUgbm9kZSBgdWAgaXMgbm90IGluIHRoZSBncmFwaCB0aGlzXG4gKiBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogT3B0aW9uYWxseSBhIGB2YCBub2RlIG1heSBhbHNvIGJlIHNwZWNpZmllZC4gVGhpcyBjYXVzZXMgdGhlIHJlc3VsdHMgdG8gYmVcbiAqIGZpbHRlcmVkIHN1Y2ggdGhhdCBvbmx5IGVkZ2VzIGJldHdlZW4gYHVgIGFuZCBgdmAgLSBpbiBlaXRoZXIgZGlyZWN0aW9uIC1cbiAqIGFyZSBpbmNsdWRlZC4gSUYgdGhlIG5vZGUgYHZgIGlzIHNwZWNpZmllZCBidXQgbm90IGluIHRoZSBncmFwaCB0aGVuIHRoaXNcbiAqIGZ1bmN0aW9uIHJhaXNlcyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSB0aGUgbm9kZSBmb3Igd2hpY2ggdG8gZmluZCBpbmNpZGVudCBlZGdlc1xuICogQHBhcmFtIHtTdHJpbmd9IFt2XSBvcHRpb24gbm9kZSB0aGF0IG11c3QgYmUgYWRqYWNlbnQgdG8gYHVgXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmluY2lkZW50RWRnZXMgPSBmdW5jdGlvbih1LCB2KSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgIHJldHVybiBTZXQudW5pb24oW3RoaXMub3V0RWRnZXModSwgdiksIHRoaXMub3V0RWRnZXModiwgdSldKS5rZXlzKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFNldC51bmlvbihbdGhpcy5pbkVkZ2VzKHUpLCB0aGlzLm91dEVkZ2VzKHUpXSkua2V5cygpO1xuICB9XG59O1xuXG4vKlxuICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIGdyYXBoLlxuICovXG5EaWdyYXBoLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJEaWdyYXBoIFwiICsgSlNPTi5zdHJpbmdpZnkodGhpcywgbnVsbCwgMik7XG59O1xuXG4vKlxuICogQWRkcyBhIG5ldyBub2RlIHdpdGggdGhlIGlkIGB1YCB0byB0aGUgZ3JhcGggYW5kIGFzc2lnbnMgaXQgdGhlIHZhbHVlXG4gKiBgdmFsdWVgLiBJZiBhIG5vZGUgd2l0aCB0aGUgaWQgaXMgYWxyZWFkeSBhIHBhcnQgb2YgdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb25cbiAqIHRocm93cyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdSBhIG5vZGUgaWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBbdmFsdWVdIGFuIG9wdGlvbmFsIHZhbHVlIHRvIGF0dGFjaCB0byB0aGUgbm9kZVxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5hZGROb2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgdSA9IEJhc2VHcmFwaC5wcm90b3R5cGUuYWRkTm9kZS5jYWxsKHRoaXMsIHUsIHZhbHVlKTtcbiAgdGhpcy5faW5FZGdlc1t1XSA9IHt9O1xuICB0aGlzLl9vdXRFZGdlc1t1XSA9IHt9O1xuICByZXR1cm4gdTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGEgbm9kZSBmcm9tIHRoZSBncmFwaCB0aGF0IGhhcyB0aGUgaWQgYHVgLiBBbnkgZWRnZXMgaW5jaWRlbnQgb24gdGhlXG4gKiBub2RlIGFyZSBhbHNvIHJlbW92ZWQuIElmIHRoZSBncmFwaCBkb2VzIG5vdCBjb250YWluIGEgbm9kZSB3aXRoIHRoZSBpZCB0aGlzXG4gKiBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5kZWxOb2RlID0gZnVuY3Rpb24odSkge1xuICBCYXNlR3JhcGgucHJvdG90eXBlLmRlbE5vZGUuY2FsbCh0aGlzLCB1KTtcbiAgZGVsZXRlIHRoaXMuX2luRWRnZXNbdV07XG4gIGRlbGV0ZSB0aGlzLl9vdXRFZGdlc1t1XTtcbn07XG5cbi8qXG4gKiBBZGRzIGEgbmV3IGVkZ2UgdG8gdGhlIGdyYXBoIHdpdGggdGhlIGlkIGBlYCBmcm9tIGEgbm9kZSB3aXRoIHRoZSBpZCBgc291cmNlYFxuICogdG8gYSBub2RlIHdpdGggYW4gaWQgYHRhcmdldGAgYW5kIGFzc2lnbnMgaXQgdGhlIHZhbHVlIGB2YWx1ZWAuIFRoaXMgZ3JhcGhcbiAqIGFsbG93cyBtb3JlIHRoYW4gb25lIGVkZ2UgZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YCBhcyBsb25nIGFzIHRoZSBpZCBgZWBcbiAqIGlzIHVuaXF1ZSBpbiB0aGUgc2V0IG9mIGVkZ2VzLiBJZiBgZWAgaXMgYG51bGxgIHRoZSBncmFwaCB3aWxsIGFzc2lnbiBhXG4gKiB1bmlxdWUgaWRlbnRpZmllciB0byB0aGUgZWRnZS5cbiAqXG4gKiBJZiBgc291cmNlYCBvciBgdGFyZ2V0YCBhcmUgbm90IHByZXNlbnQgaW4gdGhlIGdyYXBoIHRoaXMgZnVuY3Rpb24gd2lsbFxuICogdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IFtlXSBhbiBlZGdlIGlkXG4gKiBAcGFyYW0ge1N0cmluZ30gc291cmNlIHRoZSBzb3VyY2Ugbm9kZSBpZFxuICogQHBhcmFtIHtTdHJpbmd9IHRhcmdldCB0aGUgdGFyZ2V0IG5vZGUgaWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBbdmFsdWVdIGFuIG9wdGlvbmFsIHZhbHVlIHRvIGF0dGFjaCB0byB0aGUgZWRnZVxuICovXG5EaWdyYXBoLnByb3RvdHlwZS5hZGRFZGdlID0gZnVuY3Rpb24oZSwgc291cmNlLCB0YXJnZXQsIHZhbHVlKSB7XG4gIHJldHVybiBCYXNlR3JhcGgucHJvdG90eXBlLl9hZGRFZGdlLmNhbGwodGhpcywgZSwgc291cmNlLCB0YXJnZXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2luRWRnZXMsIHRoaXMuX291dEVkZ2VzKTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGFuIGVkZ2UgaW4gdGhlIGdyYXBoIHdpdGggdGhlIGlkIGBlYC4gSWYgbm8gZWRnZSBpbiB0aGUgZ3JhcGggaGFzXG4gKiB0aGUgaWQgYGVgIHRoaXMgZnVuY3Rpb24gd2lsbCB0aHJvdyBhbiBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZSBhbiBlZGdlIGlkXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLmRlbEVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIEJhc2VHcmFwaC5wcm90b3R5cGUuX2RlbEVkZ2UuY2FsbCh0aGlzLCBlLCB0aGlzLl9pbkVkZ2VzLCB0aGlzLl9vdXRFZGdlcyk7XG59O1xuXG4vLyBVbmxpa2UgQmFzZUdyYXBoLmZpbHRlck5vZGVzLCB0aGlzIGhlbHBlciBqdXN0IHJldHVybnMgbm9kZXMgdGhhdFxuLy8gc2F0aXNmeSBhIHByZWRpY2F0ZS5cbkRpZ3JhcGgucHJvdG90eXBlLl9maWx0ZXJOb2RlcyA9IGZ1bmN0aW9uKHByZWQpIHtcbiAgdmFyIGZpbHRlcmVkID0gW107XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgIGlmIChwcmVkKHUpKSB7XG4gICAgICBmaWx0ZXJlZC5wdXNoKHUpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBmaWx0ZXJlZDtcbn07XG5cbiIsIi8qXG4gKiBUaGlzIGZpbGUgaXMgb3JnYW5pemVkIHdpdGggaW4gdGhlIGZvbGxvd2luZyBvcmRlcjpcbiAqXG4gKiBFeHBvcnRzXG4gKiBHcmFwaCBjb25zdHJ1Y3RvcnNcbiAqIEdyYXBoIHF1ZXJpZXMgKGUuZy4gbm9kZXMoKSwgZWRnZXMoKVxuICogR3JhcGggbXV0YXRvcnNcbiAqIEhlbHBlciBmdW5jdGlvbnNcbiAqL1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIiksXG4gICAgQmFzZUdyYXBoID0gcmVxdWlyZShcIi4vQmFzZUdyYXBoXCIpLFxuLyoganNoaW50IC1XMDc5ICovXG4gICAgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gR3JhcGg7XG5cbi8qXG4gKiBDb25zdHJ1Y3RvciB0byBjcmVhdGUgYSBuZXcgdW5kaXJlY3RlZCBtdWx0aS1ncmFwaC5cbiAqL1xuZnVuY3Rpb24gR3JhcGgoKSB7XG4gIEJhc2VHcmFwaC5jYWxsKHRoaXMpO1xuXG4gIC8qISBNYXAgb2Ygbm9kZUlkIC0+IHsgb3RoZXJOb2RlSWQgLT4gU2V0IG9mIGVkZ2UgaWRzIH0gKi9cbiAgdGhpcy5faW5jaWRlbnRFZGdlcyA9IHt9O1xufVxuXG5HcmFwaC5wcm90b3R5cGUgPSBuZXcgQmFzZUdyYXBoKCk7XG5HcmFwaC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBHcmFwaDtcblxuLypcbiAqIEFsd2F5cyByZXR1cm5zIGBmYWxzZWAuXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5pc0RpcmVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qXG4gKiBSZXR1cm5zIGFsbCBub2RlcyB0aGF0IGFyZSBhZGphY2VudCB0byB0aGUgbm9kZSB3aXRoIHRoZSBpZCBgdWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHUgYSBub2RlIGlkXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5uZWlnaGJvcnMgPSBmdW5jdGlvbih1KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9pbmNpZGVudEVkZ2VzW3VdKVxuICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbih2KSB7IHJldHVybiB0aGlzLl9ub2Rlc1t2XS5pZDsgfSwgdGhpcyk7XG59O1xuXG4vKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBpZHMgZm9yIGFsbCBlZGdlcyBpbiB0aGUgZ3JhcGggdGhhdCBhcmUgaW5jaWRlbnQgb24gYHVgLlxuICogSWYgdGhlIG5vZGUgYHVgIGlzIG5vdCBpbiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvbiByYWlzZXMgYW4gRXJyb3IuXG4gKlxuICogT3B0aW9uYWxseSBhIGB2YCBub2RlIG1heSBhbHNvIGJlIHNwZWNpZmllZC4gVGhpcyBjYXVzZXMgdGhlIHJlc3VsdHMgdG8gYmVcbiAqIGZpbHRlcmVkIHN1Y2ggdGhhdCBvbmx5IGVkZ2VzIGJldHdlZW4gYHVgIGFuZCBgdmAgYXJlIGluY2x1ZGVkLiBJZiB0aGUgbm9kZVxuICogYHZgIGlzIHNwZWNpZmllZCBidXQgbm90IGluIHRoZSBncmFwaCB0aGVuIHRoaXMgZnVuY3Rpb24gcmFpc2VzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IHRoZSBub2RlIGZvciB3aGljaCB0byBmaW5kIGluY2lkZW50IGVkZ2VzXG4gKiBAcGFyYW0ge1N0cmluZ30gW3ZdIG9wdGlvbiBub2RlIHRoYXQgbXVzdCBiZSBhZGphY2VudCB0byBgdWBcbiAqL1xuR3JhcGgucHJvdG90eXBlLmluY2lkZW50RWRnZXMgPSBmdW5jdGlvbih1LCB2KSB7XG4gIHRoaXMuX3N0cmljdEdldE5vZGUodSk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgIHRoaXMuX3N0cmljdEdldE5vZGUodik7XG4gICAgcmV0dXJuIHYgaW4gdGhpcy5faW5jaWRlbnRFZGdlc1t1XSA/IHRoaXMuX2luY2lkZW50RWRnZXNbdV1bdl0ua2V5cygpIDogW107XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFNldC51bmlvbih1dGlsLnZhbHVlcyh0aGlzLl9pbmNpZGVudEVkZ2VzW3VdKSkua2V5cygpO1xuICB9XG59O1xuXG4vKlxuICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIGdyYXBoLlxuICovXG5HcmFwaC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiR3JhcGggXCIgKyBKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCAyKTtcbn07XG5cbi8qXG4gKiBBZGRzIGEgbmV3IG5vZGUgd2l0aCB0aGUgaWQgYHVgIHRvIHRoZSBncmFwaCBhbmQgYXNzaWducyBpdCB0aGUgdmFsdWVcbiAqIGB2YWx1ZWAuIElmIGEgbm9kZSB3aXRoIHRoZSBpZCBpcyBhbHJlYWR5IGEgcGFydCBvZiB0aGUgZ3JhcGggdGhpcyBmdW5jdGlvblxuICogdGhyb3dzIGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gYW4gb3B0aW9uYWwgdmFsdWUgdG8gYXR0YWNoIHRvIHRoZSBub2RlXG4gKi9cbkdyYXBoLnByb3RvdHlwZS5hZGROb2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgdSA9IEJhc2VHcmFwaC5wcm90b3R5cGUuYWRkTm9kZS5jYWxsKHRoaXMsIHUsIHZhbHVlKTtcbiAgdGhpcy5faW5jaWRlbnRFZGdlc1t1XSA9IHt9O1xuICByZXR1cm4gdTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGEgbm9kZSBmcm9tIHRoZSBncmFwaCB0aGF0IGhhcyB0aGUgaWQgYHVgLiBBbnkgZWRnZXMgaW5jaWRlbnQgb24gdGhlXG4gKiBub2RlIGFyZSBhbHNvIHJlbW92ZWQuIElmIHRoZSBncmFwaCBkb2VzIG5vdCBjb250YWluIGEgbm9kZSB3aXRoIHRoZSBpZCB0aGlzXG4gKiBmdW5jdGlvbiB3aWxsIHRocm93IGFuIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1IGEgbm9kZSBpZFxuICovXG5HcmFwaC5wcm90b3R5cGUuZGVsTm9kZSA9IGZ1bmN0aW9uKHUpIHtcbiAgQmFzZUdyYXBoLnByb3RvdHlwZS5kZWxOb2RlLmNhbGwodGhpcywgdSk7XG4gIGRlbGV0ZSB0aGlzLl9pbmNpZGVudEVkZ2VzW3VdO1xufTtcblxuLypcbiAqIEFkZHMgYSBuZXcgZWRnZSB0byB0aGUgZ3JhcGggd2l0aCB0aGUgaWQgYGVgIGJldHdlZW4gYSBub2RlIHdpdGggdGhlIGlkIGB1YFxuICogYW5kIGEgbm9kZSB3aXRoIGFuIGlkIGB2YCBhbmQgYXNzaWducyBpdCB0aGUgdmFsdWUgYHZhbHVlYC4gVGhpcyBncmFwaFxuICogYWxsb3dzIG1vcmUgdGhhbiBvbmUgZWRnZSBiZXR3ZWVuIGB1YCBhbmQgYHZgIGFzIGxvbmcgYXMgdGhlIGlkIGBlYFxuICogaXMgdW5pcXVlIGluIHRoZSBzZXQgb2YgZWRnZXMuIElmIGBlYCBpcyBgbnVsbGAgdGhlIGdyYXBoIHdpbGwgYXNzaWduIGFcbiAqIHVuaXF1ZSBpZGVudGlmaWVyIHRvIHRoZSBlZGdlLlxuICpcbiAqIElmIGB1YCBvciBgdmAgYXJlIG5vdCBwcmVzZW50IGluIHRoZSBncmFwaCB0aGlzIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW5cbiAqIEVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZV0gYW4gZWRnZSBpZFxuICogQHBhcmFtIHtTdHJpbmd9IHUgdGhlIG5vZGUgaWQgb2Ygb25lIG9mIHRoZSBhZGphY2VudCBub2Rlc1xuICogQHBhcmFtIHtTdHJpbmd9IHYgdGhlIG5vZGUgaWQgb2YgdGhlIG90aGVyIGFkamFjZW50IG5vZGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbdmFsdWVdIGFuIG9wdGlvbmFsIHZhbHVlIHRvIGF0dGFjaCB0byB0aGUgZWRnZVxuICovXG5HcmFwaC5wcm90b3R5cGUuYWRkRWRnZSA9IGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gIHJldHVybiBCYXNlR3JhcGgucHJvdG90eXBlLl9hZGRFZGdlLmNhbGwodGhpcywgZSwgdSwgdiwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5jaWRlbnRFZGdlcywgdGhpcy5faW5jaWRlbnRFZGdlcyk7XG59O1xuXG4vKlxuICogUmVtb3ZlcyBhbiBlZGdlIGluIHRoZSBncmFwaCB3aXRoIHRoZSBpZCBgZWAuIElmIG5vIGVkZ2UgaW4gdGhlIGdyYXBoIGhhc1xuICogdGhlIGlkIGBlYCB0aGlzIGZ1bmN0aW9uIHdpbGwgdGhyb3cgYW4gRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGUgYW4gZWRnZSBpZFxuICovXG5HcmFwaC5wcm90b3R5cGUuZGVsRWRnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgQmFzZUdyYXBoLnByb3RvdHlwZS5fZGVsRWRnZS5jYWxsKHRoaXMsIGUsIHRoaXMuX2luY2lkZW50RWRnZXMsIHRoaXMuX2luY2lkZW50RWRnZXMpO1xufTtcblxuIiwiLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gY29tcG9uZW50cztcblxuLyoqXG4gKiBGaW5kcyBhbGwgW2Nvbm5lY3RlZCBjb21wb25lbnRzXVtdIGluIGEgZ3JhcGggYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgdGhlc2VcbiAqIGNvbXBvbmVudHMuIEVhY2ggY29tcG9uZW50IGlzIGl0c2VsZiBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSBpZHMgb2Ygbm9kZXNcbiAqIGluIHRoZSBjb21wb25lbnQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIHdpdGggdW5kaXJlY3RlZCBHcmFwaHMuXG4gKlxuICogW2Nvbm5lY3RlZCBjb21wb25lbnRzXTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Db25uZWN0ZWRfY29tcG9uZW50XyhncmFwaF90aGVvcnkpXG4gKlxuICogQHBhcmFtIHtHcmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBjb21wb25lbnRzXG4gKi9cbmZ1bmN0aW9uIGNvbXBvbmVudHMoZykge1xuICB2YXIgcmVzdWx0cyA9IFtdO1xuICB2YXIgdmlzaXRlZCA9IG5ldyBTZXQoKTtcblxuICBmdW5jdGlvbiBkZnModiwgY29tcG9uZW50KSB7XG4gICAgaWYgKCF2aXNpdGVkLmhhcyh2KSkge1xuICAgICAgdmlzaXRlZC5hZGQodik7XG4gICAgICBjb21wb25lbnQucHVzaCh2KTtcbiAgICAgIGcubmVpZ2hib3JzKHYpLmZvckVhY2goZnVuY3Rpb24odykge1xuICAgICAgICBkZnModywgY29tcG9uZW50KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGcubm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gW107XG4gICAgZGZzKHYsIGNvbXBvbmVudCk7XG4gICAgaWYgKGNvbXBvbmVudC5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHRzLnB1c2goY29tcG9uZW50KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHRzO1xufVxuIiwidmFyIFByaW9yaXR5UXVldWUgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5Qcmlvcml0eVF1ZXVlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRpamtzdHJhO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gaXMgYW4gaW1wbGVtZW50YXRpb24gb2YgW0RpamtzdHJhJ3MgYWxnb3JpdGhtXVtdIHdoaWNoIGZpbmRzXG4gKiB0aGUgc2hvcnRlc3QgcGF0aCBmcm9tICoqc291cmNlKiogdG8gYWxsIG90aGVyIG5vZGVzIGluICoqZyoqLiBUaGlzXG4gKiBmdW5jdGlvbiByZXR1cm5zIGEgbWFwIG9mIGB1IC0+IHsgZGlzdGFuY2UsIHByZWRlY2Vzc29yIH1gLiBUaGUgZGlzdGFuY2VcbiAqIHByb3BlcnR5IGhvbGRzIHRoZSBzdW0gb2YgdGhlIHdlaWdodHMgZnJvbSAqKnNvdXJjZSoqIHRvIGB1YCBhbG9uZyB0aGVcbiAqIHNob3J0ZXN0IHBhdGggb3IgYE51bWJlci5QT1NJVElWRV9JTkZJTklUWWAgaWYgdGhlcmUgaXMgbm8gcGF0aCBmcm9tXG4gKiAqKnNvdXJjZSoqLiBUaGUgcHJlZGVjZXNzb3IgcHJvcGVydHkgY2FuIGJlIHVzZWQgdG8gd2FsayB0aGUgaW5kaXZpZHVhbFxuICogZWxlbWVudHMgb2YgdGhlIHBhdGggZnJvbSAqKnNvdXJjZSoqIHRvICoqdSoqIGluIHJldmVyc2Ugb3JkZXIuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgd2VpZ2h0RnVuYyhlKWAgd2hpY2ggcmV0dXJucyB0aGVcbiAqIHdlaWdodCBvZiB0aGUgZWRnZSBgZWAuIElmIG5vIHdlaWdodEZ1bmMgaXMgc3VwcGxpZWQgdGhlbiBlYWNoIGVkZ2UgaXNcbiAqIGFzc3VtZWQgdG8gaGF2ZSBhIHdlaWdodCBvZiAxLiBUaGlzIGZ1bmN0aW9uIHRocm93cyBhbiBFcnJvciBpZiBhbnkgb2ZcbiAqIHRoZSB0cmF2ZXJzZWQgZWRnZXMgaGF2ZSBhIG5lZ2F0aXZlIGVkZ2Ugd2VpZ2h0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYGluY2lkZW50RnVuYyh1KWAgd2hpY2ggcmV0dXJucyB0aGUgaWRzIG9mXG4gKiBhbGwgZWRnZXMgaW5jaWRlbnQgdG8gdGhlIG5vZGUgYHVgIGZvciB0aGUgcHVycG9zZXMgb2Ygc2hvcnRlc3QgcGF0aFxuICogdHJhdmVyc2FsLiBCeSBkZWZhdWx0IHRoaXMgZnVuY3Rpb24gdXNlcyB0aGUgYGcub3V0RWRnZXNgIGZvciBEaWdyYXBocyBhbmRcbiAqIGBnLmluY2lkZW50RWRnZXNgIGZvciBHcmFwaHMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBgTygofEV8ICsgfFZ8KSAqIGxvZyB8VnwpYCB0aW1lLlxuICpcbiAqIFtEaWprc3RyYSdzIGFsZ29yaXRobV06IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRGlqa3N0cmElMjdzX2FsZ29yaXRobVxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3Igc2hvcnRlc3QgcGF0aHMgZnJvbSAqKnNvdXJjZSoqXG4gKiBAcGFyYW0ge09iamVjdH0gc291cmNlIHRoZSBzb3VyY2UgZnJvbSB3aGljaCB0byBzdGFydCB0aGUgc2VhcmNoXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbd2VpZ2h0RnVuY10gb3B0aW9uYWwgd2VpZ2h0IGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaW5jaWRlbnRGdW5jXSBvcHRpb25hbCBpbmNpZGVudCBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkaWprc3RyYShnLCBzb3VyY2UsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYykge1xuICB2YXIgcmVzdWx0cyA9IHt9LFxuICAgICAgcHEgPSBuZXcgUHJpb3JpdHlRdWV1ZSgpO1xuXG4gIGZ1bmN0aW9uIHVwZGF0ZU5laWdoYm9ycyhlKSB7XG4gICAgdmFyIGluY2lkZW50Tm9kZXMgPSBnLmluY2lkZW50Tm9kZXMoZSksXG4gICAgICAgIHYgPSBpbmNpZGVudE5vZGVzWzBdICE9PSB1ID8gaW5jaWRlbnROb2Rlc1swXSA6IGluY2lkZW50Tm9kZXNbMV0sXG4gICAgICAgIHZFbnRyeSA9IHJlc3VsdHNbdl0sXG4gICAgICAgIHdlaWdodCA9IHdlaWdodEZ1bmMoZSksXG4gICAgICAgIGRpc3RhbmNlID0gdUVudHJ5LmRpc3RhbmNlICsgd2VpZ2h0O1xuXG4gICAgaWYgKHdlaWdodCA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImRpamtzdHJhIGRvZXMgbm90IGFsbG93IG5lZ2F0aXZlIGVkZ2Ugd2VpZ2h0cy4gQmFkIGVkZ2U6IFwiICsgZSArIFwiIFdlaWdodDogXCIgKyB3ZWlnaHQpO1xuICAgIH1cblxuICAgIGlmIChkaXN0YW5jZSA8IHZFbnRyeS5kaXN0YW5jZSkge1xuICAgICAgdkVudHJ5LmRpc3RhbmNlID0gZGlzdGFuY2U7XG4gICAgICB2RW50cnkucHJlZGVjZXNzb3IgPSB1O1xuICAgICAgcHEuZGVjcmVhc2UodiwgZGlzdGFuY2UpO1xuICAgIH1cbiAgfVxuXG4gIHdlaWdodEZ1bmMgPSB3ZWlnaHRGdW5jIHx8IGZ1bmN0aW9uKCkgeyByZXR1cm4gMTsgfTtcbiAgaW5jaWRlbnRGdW5jID0gaW5jaWRlbnRGdW5jIHx8IChnLmlzRGlyZWN0ZWQoKVxuICAgICAgPyBmdW5jdGlvbih1KSB7IHJldHVybiBnLm91dEVkZ2VzKHUpOyB9XG4gICAgICA6IGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGcuaW5jaWRlbnRFZGdlcyh1KTsgfSk7XG5cbiAgZy5lYWNoTm9kZShmdW5jdGlvbih1KSB7XG4gICAgdmFyIGRpc3RhbmNlID0gdSA9PT0gc291cmNlID8gMCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICByZXN1bHRzW3VdID0geyBkaXN0YW5jZTogZGlzdGFuY2UgfTtcbiAgICBwcS5hZGQodSwgZGlzdGFuY2UpO1xuICB9KTtcblxuICB2YXIgdSwgdUVudHJ5O1xuICB3aGlsZSAocHEuc2l6ZSgpID4gMCkge1xuICAgIHUgPSBwcS5yZW1vdmVNaW4oKTtcbiAgICB1RW50cnkgPSByZXN1bHRzW3VdO1xuICAgIGlmICh1RW50cnkuZGlzdGFuY2UgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaW5jaWRlbnRGdW5jKHUpLmZvckVhY2godXBkYXRlTmVpZ2hib3JzKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHRzO1xufVxuIiwidmFyIGRpamtzdHJhID0gcmVxdWlyZShcIi4vZGlqa3N0cmFcIik7XG5cbm1vZHVsZS5leHBvcnRzID0gZGlqa3N0cmFBbGw7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBmaW5kcyB0aGUgc2hvcnRlc3QgcGF0aCBmcm9tIGVhY2ggbm9kZSB0byBldmVyeSBvdGhlclxuICogcmVhY2hhYmxlIG5vZGUgaW4gdGhlIGdyYXBoLiBJdCBpcyBzaW1pbGFyIHRvIFthbGcuZGlqa3N0cmFdW10sIGJ1dFxuICogaW5zdGVhZCBvZiByZXR1cm5pbmcgYSBzaW5nbGUtc291cmNlIGFycmF5LCBpdCByZXR1cm5zIGEgbWFwcGluZyBvZlxuICogb2YgYHNvdXJjZSAtPiBhbGcuZGlqa3N0YShnLCBzb3VyY2UsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYylgLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gb3B0aW9uYWwgYHdlaWdodEZ1bmMoZSlgIHdoaWNoIHJldHVybnMgdGhlXG4gKiB3ZWlnaHQgb2YgdGhlIGVkZ2UgYGVgLiBJZiBubyB3ZWlnaHRGdW5jIGlzIHN1cHBsaWVkIHRoZW4gZWFjaCBlZGdlIGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYSB3ZWlnaHQgb2YgMS4gVGhpcyBmdW5jdGlvbiB0aHJvd3MgYW4gRXJyb3IgaWYgYW55IG9mXG4gKiB0aGUgdHJhdmVyc2VkIGVkZ2VzIGhhdmUgYSBuZWdhdGl2ZSBlZGdlIHdlaWdodC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGBpbmNpZGVudEZ1bmModSlgIHdoaWNoIHJldHVybnMgdGhlIGlkcyBvZlxuICogYWxsIGVkZ2VzIGluY2lkZW50IHRvIHRoZSBub2RlIGB1YCBmb3IgdGhlIHB1cnBvc2VzIG9mIHNob3J0ZXN0IHBhdGhcbiAqIHRyYXZlcnNhbC4gQnkgZGVmYXVsdCB0aGlzIGZ1bmN0aW9uIHVzZXMgdGhlIGBvdXRFZGdlc2AgZnVuY3Rpb24gb24gdGhlXG4gKiBzdXBwbGllZCBncmFwaC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGBPKHxWfCAqICh8RXwgKyB8VnwpICogbG9nIHxWfClgIHRpbWUuXG4gKlxuICogW2FsZy5kaWprc3RyYV06IGRpamtzdHJhLmpzLmh0bWwjZGlqa3N0cmFcbiAqXG4gKiBAcGFyYW0ge0dyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIHNob3J0ZXN0IHBhdGhzIGZyb20gKipzb3VyY2UqKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW3dlaWdodEZ1bmNdIG9wdGlvbmFsIHdlaWdodCBmdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2luY2lkZW50RnVuY10gb3B0aW9uYWwgaW5jaWRlbnQgZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gZGlqa3N0cmFBbGwoZywgd2VpZ2h0RnVuYywgaW5jaWRlbnRGdW5jKSB7XG4gIHZhciByZXN1bHRzID0ge307XG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgIHJlc3VsdHNbdV0gPSBkaWprc3RyYShnLCB1LCB3ZWlnaHRGdW5jLCBpbmNpZGVudEZ1bmMpO1xuICB9KTtcbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJ2YXIgdGFyamFuID0gcmVxdWlyZShcIi4vdGFyamFuXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZpbmRDeWNsZXM7XG5cbi8qXG4gKiBHaXZlbiBhIERpZ3JhcGggKipnKiogdGhpcyBmdW5jdGlvbiByZXR1cm5zIGFsbCBub2RlcyB0aGF0IGFyZSBwYXJ0IG9mIGFcbiAqIGN5Y2xlLiBTaW5jZSB0aGVyZSBtYXkgYmUgbW9yZSB0aGFuIG9uZSBjeWNsZSBpbiBhIGdyYXBoIHRoaXMgZnVuY3Rpb25cbiAqIHJldHVybnMgYW4gYXJyYXkgb2YgdGhlc2UgY3ljbGVzLCB3aGVyZSBlYWNoIGN5Y2xlIGlzIGl0c2VsZiByZXByZXNlbnRlZFxuICogYnkgYW4gYXJyYXkgb2YgaWRzIGZvciBlYWNoIG5vZGUgaW52b2x2ZWQgaW4gdGhhdCBjeWNsZS5cbiAqXG4gKiBbYWxnLmlzQWN5Y2xpY11bXSBpcyBtb3JlIGVmZmljaWVudCBpZiB5b3Ugb25seSBuZWVkIHRvIGRldGVybWluZSB3aGV0aGVyXG4gKiBhIGdyYXBoIGhhcyBhIGN5Y2xlIG9yIG5vdC5cbiAqXG4gKiBbYWxnLmlzQWN5Y2xpY106IGlzQWN5Y2xpYy5qcy5odG1sI2lzQWN5Y2xpY1xuICpcbiAqIEBwYXJhbSB7RGlncmFwaH0gZyB0aGUgZ3JhcGggdG8gc2VhcmNoIGZvciBjeWNsZXMuXG4gKi9cbmZ1bmN0aW9uIGZpbmRDeWNsZXMoZykge1xuICByZXR1cm4gdGFyamFuKGcpLmZpbHRlcihmdW5jdGlvbihjbXB0KSB7IHJldHVybiBjbXB0Lmxlbmd0aCA+IDE7IH0pO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmbG95ZFdhcnNoYWxsO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gaXMgYW4gaW1wbGVtZW50YXRpb24gb2YgdGhlIFtGbG95ZC1XYXJzaGFsbCBhbGdvcml0aG1dW10sXG4gKiB3aGljaCBmaW5kcyB0aGUgc2hvcnRlc3QgcGF0aCBmcm9tIGVhY2ggbm9kZSB0byBldmVyeSBvdGhlciByZWFjaGFibGUgbm9kZVxuICogaW4gdGhlIGdyYXBoLiBJdCBpcyBzaW1pbGFyIHRvIFthbGcuZGlqa3N0cmFBbGxdW10sIGJ1dCBpdCBoYW5kbGVzIG5lZ2F0aXZlXG4gKiBlZGdlIHdlaWdodHMgYW5kIGlzIG1vcmUgZWZmaWNpZW50IGZvciBzb21lIHR5cGVzIG9mIGdyYXBocy4gVGhpcyBmdW5jdGlvblxuICogcmV0dXJucyBhIG1hcCBvZiBgc291cmNlIC0+IHsgdGFyZ2V0IC0+IHsgZGlzdGFuY2UsIHByZWRlY2Vzc29yIH1gLiBUaGVcbiAqIGRpc3RhbmNlIHByb3BlcnR5IGhvbGRzIHRoZSBzdW0gb2YgdGhlIHdlaWdodHMgZnJvbSBgc291cmNlYCB0byBgdGFyZ2V0YFxuICogYWxvbmcgdGhlIHNob3J0ZXN0IHBhdGggb2YgYE51bWJlci5QT1NJVElWRV9JTkZJTklUWWAgaWYgdGhlcmUgaXMgbm8gcGF0aFxuICogZnJvbSBgc291cmNlYC4gVGhlIHByZWRlY2Vzc29yIHByb3BlcnR5IGNhbiBiZSB1c2VkIHRvIHdhbGsgdGhlIGluZGl2aWR1YWxcbiAqIGVsZW1lbnRzIG9mIHRoZSBwYXRoIGZyb20gYHNvdXJjZWAgdG8gYHRhcmdldGAgaW4gcmV2ZXJzZSBvcmRlci5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9wdGlvbmFsIGB3ZWlnaHRGdW5jKGUpYCB3aGljaCByZXR1cm5zIHRoZVxuICogd2VpZ2h0IG9mIHRoZSBlZGdlIGBlYC4gSWYgbm8gd2VpZ2h0RnVuYyBpcyBzdXBwbGllZCB0aGVuIGVhY2ggZWRnZSBpc1xuICogYXNzdW1lZCB0byBoYXZlIGEgd2VpZ2h0IG9mIDEuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvcHRpb25hbCBgaW5jaWRlbnRGdW5jKHUpYCB3aGljaCByZXR1cm5zIHRoZSBpZHMgb2ZcbiAqIGFsbCBlZGdlcyBpbmNpZGVudCB0byB0aGUgbm9kZSBgdWAgZm9yIHRoZSBwdXJwb3NlcyBvZiBzaG9ydGVzdCBwYXRoXG4gKiB0cmF2ZXJzYWwuIEJ5IGRlZmF1bHQgdGhpcyBmdW5jdGlvbiB1c2VzIHRoZSBgb3V0RWRnZXNgIGZ1bmN0aW9uIG9uIHRoZVxuICogc3VwcGxpZWQgZ3JhcGguXG4gKlxuICogVGhpcyBhbGdvcml0aG0gdGFrZXMgTyh8VnxeMykgdGltZS5cbiAqXG4gKiBbRmxveWQtV2Fyc2hhbGwgYWxnb3JpdGhtXTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRmxveWQtV2Fyc2hhbGxfYWxnb3JpdGhtXG4gKiBbYWxnLmRpamtzdHJhQWxsXTogZGlqa3N0cmFBbGwuanMuaHRtbCNkaWprc3RyYUFsbFxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNlYXJjaCBmb3Igc2hvcnRlc3QgcGF0aHMgZnJvbSAqKnNvdXJjZSoqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbd2VpZ2h0RnVuY10gb3B0aW9uYWwgd2VpZ2h0IGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaW5jaWRlbnRGdW5jXSBvcHRpb25hbCBpbmNpZGVudCBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBmbG95ZFdhcnNoYWxsKGcsIHdlaWdodEZ1bmMsIGluY2lkZW50RnVuYykge1xuICB2YXIgcmVzdWx0cyA9IHt9LFxuICAgICAgbm9kZXMgPSBnLm5vZGVzKCk7XG5cbiAgd2VpZ2h0RnVuYyA9IHdlaWdodEZ1bmMgfHwgZnVuY3Rpb24oKSB7IHJldHVybiAxOyB9O1xuICBpbmNpZGVudEZ1bmMgPSBpbmNpZGVudEZ1bmMgfHwgKGcuaXNEaXJlY3RlZCgpXG4gICAgICA/IGZ1bmN0aW9uKHUpIHsgcmV0dXJuIGcub3V0RWRnZXModSk7IH1cbiAgICAgIDogZnVuY3Rpb24odSkgeyByZXR1cm4gZy5pbmNpZGVudEVkZ2VzKHUpOyB9KTtcblxuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICByZXN1bHRzW3VdID0ge307XG4gICAgcmVzdWx0c1t1XVt1XSA9IHsgZGlzdGFuY2U6IDAgfTtcbiAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh1ICE9PSB2KSB7XG4gICAgICAgIHJlc3VsdHNbdV1bdl0gPSB7IGRpc3RhbmNlOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkgfTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpbmNpZGVudEZ1bmModSkuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICB2YXIgaW5jaWRlbnROb2RlcyA9IGcuaW5jaWRlbnROb2RlcyhlKSxcbiAgICAgICAgICB2ID0gaW5jaWRlbnROb2Rlc1swXSAhPT0gdSA/IGluY2lkZW50Tm9kZXNbMF0gOiBpbmNpZGVudE5vZGVzWzFdLFxuICAgICAgICAgIGQgPSB3ZWlnaHRGdW5jKGUpO1xuICAgICAgaWYgKGQgPCByZXN1bHRzW3VdW3ZdLmRpc3RhbmNlKSB7XG4gICAgICAgIHJlc3VsdHNbdV1bdl0gPSB7IGRpc3RhbmNlOiBkLCBwcmVkZWNlc3NvcjogdSB9O1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcblxuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICB2YXIgcm93SyA9IHJlc3VsdHNba107XG4gICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbihpKSB7XG4gICAgICB2YXIgcm93SSA9IHJlc3VsdHNbaV07XG4gICAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKGopIHtcbiAgICAgICAgdmFyIGlrID0gcm93SVtrXTtcbiAgICAgICAgdmFyIGtqID0gcm93S1tqXTtcbiAgICAgICAgdmFyIGlqID0gcm93SVtqXTtcbiAgICAgICAgdmFyIGFsdERpc3RhbmNlID0gaWsuZGlzdGFuY2UgKyBrai5kaXN0YW5jZTtcbiAgICAgICAgaWYgKGFsdERpc3RhbmNlIDwgaWouZGlzdGFuY2UpIHtcbiAgICAgICAgICBpai5kaXN0YW5jZSA9IGFsdERpc3RhbmNlO1xuICAgICAgICAgIGlqLnByZWRlY2Vzc29yID0ga2oucHJlZGVjZXNzb3I7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cbiIsInZhciB0b3Bzb3J0ID0gcmVxdWlyZShcIi4vdG9wc29ydFwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpc0FjeWNsaWM7XG5cbi8qXG4gKiBHaXZlbiBhIERpZ3JhcGggKipnKiogdGhpcyBmdW5jdGlvbiByZXR1cm5zIGB0cnVlYCBpZiB0aGUgZ3JhcGggaGFzIG5vXG4gKiBjeWNsZXMgYW5kIHJldHVybnMgYGZhbHNlYCBpZiBpdCBkb2VzLiBUaGlzIGFsZ29yaXRobSByZXR1cm5zIGFzIHNvb24gYXMgaXRcbiAqIGRldGVjdHMgdGhlIGZpcnN0IGN5Y2xlLlxuICpcbiAqIFVzZSBbYWxnLmZpbmRDeWNsZXNdW10gaWYgeW91IG5lZWQgdGhlIGFjdHVhbCBsaXN0IG9mIGN5Y2xlcyBpbiBhIGdyYXBoLlxuICpcbiAqIFthbGcuZmluZEN5Y2xlc106IGZpbmRDeWNsZXMuanMuaHRtbCNmaW5kQ3ljbGVzXG4gKlxuICogQHBhcmFtIHtEaWdyYXBofSBnIHRoZSBncmFwaCB0byB0ZXN0IGZvciBjeWNsZXNcbiAqL1xuZnVuY3Rpb24gaXNBY3ljbGljKGcpIHtcbiAgdHJ5IHtcbiAgICB0b3Bzb3J0KGcpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUgaW5zdGFuY2VvZiB0b3Bzb3J0LkN5Y2xlRXhjZXB0aW9uKSByZXR1cm4gZmFsc2U7XG4gICAgdGhyb3cgZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cbiIsIi8qIGpzaGludCAtVzA3OSAqL1xudmFyIFNldCA9IHJlcXVpcmUoXCJjcC1kYXRhXCIpLlNldDtcbi8qIGpzaGludCArVzA3OSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBvc3RvcmRlcjtcblxuLy8gUG9zdG9yZGVyIHRyYXZlcnNhbCBvZiBnLCBjYWxsaW5nIGYgZm9yIGVhY2ggdmlzaXRlZCBub2RlLiBBc3N1bWVzIHRoZSBncmFwaFxuLy8gaXMgYSB0cmVlLlxuZnVuY3Rpb24gcG9zdG9yZGVyKGcsIHJvb3QsIGYpIHtcbiAgdmFyIHZpc2l0ZWQgPSBuZXcgU2V0KCk7XG4gIGlmIChnLmlzRGlyZWN0ZWQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoaXMgZnVuY3Rpb24gb25seSB3b3JrcyBmb3IgdW5kaXJlY3RlZCBncmFwaHNcIik7XG4gIH1cbiAgZnVuY3Rpb24gZGZzKHUsIHByZXYpIHtcbiAgICBpZiAodmlzaXRlZC5oYXModSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBpbnB1dCBncmFwaCBpcyBub3QgYSB0cmVlOiBcIiArIGcpO1xuICAgIH1cbiAgICB2aXNpdGVkLmFkZCh1KTtcbiAgICBnLm5laWdoYm9ycyh1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh2ICE9PSBwcmV2KSBkZnModiwgdSk7XG4gICAgfSk7XG4gICAgZih1KTtcbiAgfVxuICBkZnMocm9vdCk7XG59XG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBwcmVvcmRlcjtcblxuLy8gUHJlb3JkZXIgdHJhdmVyc2FsIG9mIGcsIGNhbGxpbmcgZiBmb3IgZWFjaCB2aXNpdGVkIG5vZGUuIEFzc3VtZXMgdGhlIGdyYXBoXG4vLyBpcyBhIHRyZWUuXG5mdW5jdGlvbiBwcmVvcmRlcihnLCByb290LCBmKSB7XG4gIHZhciB2aXNpdGVkID0gbmV3IFNldCgpO1xuICBpZiAoZy5pc0RpcmVjdGVkKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIGZ1bmN0aW9uIG9ubHkgd29ya3MgZm9yIHVuZGlyZWN0ZWQgZ3JhcGhzXCIpO1xuICB9XG4gIGZ1bmN0aW9uIGRmcyh1LCBwcmV2KSB7XG4gICAgaWYgKHZpc2l0ZWQuaGFzKHUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgaW5wdXQgZ3JhcGggaXMgbm90IGEgdHJlZTogXCIgKyBnKTtcbiAgICB9XG4gICAgdmlzaXRlZC5hZGQodSk7XG4gICAgZih1KTtcbiAgICBnLm5laWdoYm9ycyh1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh2ICE9PSBwcmV2KSBkZnModiwgdSk7XG4gICAgfSk7XG4gIH1cbiAgZGZzKHJvb3QpO1xufVxuIiwidmFyIEdyYXBoID0gcmVxdWlyZShcIi4uL0dyYXBoXCIpLFxuICAgIFByaW9yaXR5UXVldWUgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5Qcmlvcml0eVF1ZXVlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHByaW07XG5cbi8qKlxuICogW1ByaW0ncyBhbGdvcml0aG1dW10gdGFrZXMgYSBjb25uZWN0ZWQgdW5kaXJlY3RlZCBncmFwaCBhbmQgZ2VuZXJhdGVzIGFcbiAqIFttaW5pbXVtIHNwYW5uaW5nIHRyZWVdW10uIFRoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgbWluaW11bSBzcGFubmluZ1xuICogdHJlZSBhcyBhbiB1bmRpcmVjdGVkIGdyYXBoLiBUaGlzIGFsZ29yaXRobSBpcyBkZXJpdmVkIGZyb20gdGhlIGRlc2NyaXB0aW9uXG4gKiBpbiBcIkludHJvZHVjdGlvbiB0byBBbGdvcml0aG1zXCIsIFRoaXJkIEVkaXRpb24sIENvcm1lbiwgZXQgYWwuLCBQZyA2MzQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhIGB3ZWlnaHRGdW5jKGUpYCB3aGljaCByZXR1cm5zIHRoZSB3ZWlnaHQgb2YgdGhlIGVkZ2VcbiAqIGBlYC4gSXQgdGhyb3dzIGFuIEVycm9yIGlmIHRoZSBncmFwaCBpcyBub3QgY29ubmVjdGVkLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYE8ofEV8IGxvZyB8VnwpYCB0aW1lLlxuICpcbiAqIFtQcmltJ3MgYWxnb3JpdGhtXTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUHJpbSdzX2FsZ29yaXRobVxuICogW21pbmltdW0gc3Bhbm5pbmcgdHJlZV06IGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL01pbmltdW1fc3Bhbm5pbmdfdHJlZVxuICpcbiAqIEBwYXJhbSB7R3JhcGh9IGcgdGhlIGdyYXBoIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIG1pbmltdW0gc3Bhbm5pbmcgdHJlZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gd2VpZ2h0RnVuYyB0aGUgd2VpZ2h0IGZ1bmN0aW9uIHRvIHVzZVxuICovXG5mdW5jdGlvbiBwcmltKGcsIHdlaWdodEZ1bmMpIHtcbiAgdmFyIHJlc3VsdCA9IG5ldyBHcmFwaCgpLFxuICAgICAgcGFyZW50cyA9IHt9LFxuICAgICAgcHEgPSBuZXcgUHJpb3JpdHlRdWV1ZSgpLFxuICAgICAgdTtcblxuICBmdW5jdGlvbiB1cGRhdGVOZWlnaGJvcnMoZSkge1xuICAgIHZhciBpbmNpZGVudE5vZGVzID0gZy5pbmNpZGVudE5vZGVzKGUpLFxuICAgICAgICB2ID0gaW5jaWRlbnROb2Rlc1swXSAhPT0gdSA/IGluY2lkZW50Tm9kZXNbMF0gOiBpbmNpZGVudE5vZGVzWzFdLFxuICAgICAgICBwcmkgPSBwcS5wcmlvcml0eSh2KTtcbiAgICBpZiAocHJpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBlZGdlV2VpZ2h0ID0gd2VpZ2h0RnVuYyhlKTtcbiAgICAgIGlmIChlZGdlV2VpZ2h0IDwgcHJpKSB7XG4gICAgICAgIHBhcmVudHNbdl0gPSB1O1xuICAgICAgICBwcS5kZWNyZWFzZSh2LCBlZGdlV2VpZ2h0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoZy5vcmRlcigpID09PSAwKSB7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGcuZWFjaE5vZGUoZnVuY3Rpb24odSkge1xuICAgIHBxLmFkZCh1LCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpO1xuICAgIHJlc3VsdC5hZGROb2RlKHUpO1xuICB9KTtcblxuICAvLyBTdGFydCBmcm9tIGFuIGFyYml0cmFyeSBub2RlXG4gIHBxLmRlY3JlYXNlKGcubm9kZXMoKVswXSwgMCk7XG5cbiAgdmFyIGluaXQgPSBmYWxzZTtcbiAgd2hpbGUgKHBxLnNpemUoKSA+IDApIHtcbiAgICB1ID0gcHEucmVtb3ZlTWluKCk7XG4gICAgaWYgKHUgaW4gcGFyZW50cykge1xuICAgICAgcmVzdWx0LmFkZEVkZ2UobnVsbCwgdSwgcGFyZW50c1t1XSk7XG4gICAgfSBlbHNlIGlmIChpbml0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBncmFwaCBpcyBub3QgY29ubmVjdGVkOiBcIiArIGcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbml0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBnLmluY2lkZW50RWRnZXModSkuZm9yRWFjaCh1cGRhdGVOZWlnaGJvcnMpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gdGFyamFuO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gaXMgYW4gaW1wbGVtZW50YXRpb24gb2YgW1RhcmphbidzIGFsZ29yaXRobV1bXSB3aGljaCBmaW5kc1xuICogYWxsIFtzdHJvbmdseSBjb25uZWN0ZWQgY29tcG9uZW50c11bXSBpbiB0aGUgZGlyZWN0ZWQgZ3JhcGggKipnKiouIEVhY2hcbiAqIHN0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnQgaXMgY29tcG9zZWQgb2Ygbm9kZXMgdGhhdCBjYW4gcmVhY2ggYWxsIG90aGVyXG4gKiBub2RlcyBpbiB0aGUgY29tcG9uZW50IHZpYSBkaXJlY3RlZCBlZGdlcy4gQSBzdHJvbmdseSBjb25uZWN0ZWQgY29tcG9uZW50XG4gKiBjYW4gY29uc2lzdCBvZiBhIHNpbmdsZSBub2RlIGlmIHRoYXQgbm9kZSBjYW5ub3QgYm90aCByZWFjaCBhbmQgYmUgcmVhY2hlZFxuICogYnkgYW55IG90aGVyIHNwZWNpZmljIG5vZGUgaW4gdGhlIGdyYXBoLiBDb21wb25lbnRzIG9mIG1vcmUgdGhhbiBvbmUgbm9kZVxuICogYXJlIGd1YXJhbnRlZWQgdG8gaGF2ZSBhdCBsZWFzdCBvbmUgY3ljbGUuXG4gKlxuICogVGhpcyBmdW5jdGlvbiByZXR1cm5zIGFuIGFycmF5IG9mIGNvbXBvbmVudHMuIEVhY2ggY29tcG9uZW50IGlzIGl0c2VsZiBhblxuICogYXJyYXkgdGhhdCBjb250YWlucyB0aGUgaWRzIG9mIGFsbCBub2RlcyBpbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIFtUYXJqYW4ncyBhbGdvcml0aG1dOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1RhcmphbidzX3N0cm9uZ2x5X2Nvbm5lY3RlZF9jb21wb25lbnRzX2FsZ29yaXRobVxuICogW3N0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnRzXTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9TdHJvbmdseV9jb25uZWN0ZWRfY29tcG9uZW50XG4gKlxuICogQHBhcmFtIHtEaWdyYXBofSBnIHRoZSBncmFwaCB0byBzZWFyY2ggZm9yIHN0cm9uZ2x5IGNvbm5lY3RlZCBjb21wb25lbnRzXG4gKi9cbmZ1bmN0aW9uIHRhcmphbihnKSB7XG4gIGlmICghZy5pc0RpcmVjdGVkKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0YXJqYW4gY2FuIG9ubHkgYmUgYXBwbGllZCB0byBhIGRpcmVjdGVkIGdyYXBoLiBCYWQgaW5wdXQ6IFwiICsgZyk7XG4gIH1cblxuICB2YXIgaW5kZXggPSAwLFxuICAgICAgc3RhY2sgPSBbXSxcbiAgICAgIHZpc2l0ZWQgPSB7fSwgLy8gbm9kZSBpZCAtPiB7IG9uU3RhY2ssIGxvd2xpbmssIGluZGV4IH1cbiAgICAgIHJlc3VsdHMgPSBbXTtcblxuICBmdW5jdGlvbiBkZnModSkge1xuICAgIHZhciBlbnRyeSA9IHZpc2l0ZWRbdV0gPSB7XG4gICAgICBvblN0YWNrOiB0cnVlLFxuICAgICAgbG93bGluazogaW5kZXgsXG4gICAgICBpbmRleDogaW5kZXgrK1xuICAgIH07XG4gICAgc3RhY2sucHVzaCh1KTtcblxuICAgIGcuc3VjY2Vzc29ycyh1KS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghKHYgaW4gdmlzaXRlZCkpIHtcbiAgICAgICAgZGZzKHYpO1xuICAgICAgICBlbnRyeS5sb3dsaW5rID0gTWF0aC5taW4oZW50cnkubG93bGluaywgdmlzaXRlZFt2XS5sb3dsaW5rKTtcbiAgICAgIH0gZWxzZSBpZiAodmlzaXRlZFt2XS5vblN0YWNrKSB7XG4gICAgICAgIGVudHJ5Lmxvd2xpbmsgPSBNYXRoLm1pbihlbnRyeS5sb3dsaW5rLCB2aXNpdGVkW3ZdLmluZGV4KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChlbnRyeS5sb3dsaW5rID09PSBlbnRyeS5pbmRleCkge1xuICAgICAgdmFyIGNtcHQgPSBbXSxcbiAgICAgICAgICB2O1xuICAgICAgZG8ge1xuICAgICAgICB2ID0gc3RhY2sucG9wKCk7XG4gICAgICAgIHZpc2l0ZWRbdl0ub25TdGFjayA9IGZhbHNlO1xuICAgICAgICBjbXB0LnB1c2godik7XG4gICAgICB9IHdoaWxlICh1ICE9PSB2KTtcbiAgICAgIHJlc3VsdHMucHVzaChjbXB0KTtcbiAgICB9XG4gIH1cblxuICBnLm5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgaWYgKCEodSBpbiB2aXNpdGVkKSkge1xuICAgICAgZGZzKHUpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHRvcHNvcnQ7XG50b3Bzb3J0LkN5Y2xlRXhjZXB0aW9uID0gQ3ljbGVFeGNlcHRpb247XG5cbi8qXG4gKiBHaXZlbiBhIGdyYXBoICoqZyoqLCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYW4gb3JkZXJlZCBsaXN0IG9mIG5vZGVzIHN1Y2hcbiAqIHRoYXQgZm9yIGVhY2ggZWRnZSBgdSAtPiB2YCwgYHVgIGFwcGVhcnMgYmVmb3JlIGB2YCBpbiB0aGUgbGlzdC4gSWYgdGhlXG4gKiBncmFwaCBoYXMgYSBjeWNsZSBpdCBpcyBpbXBvc3NpYmxlIHRvIGdlbmVyYXRlIHN1Y2ggYSBsaXN0IGFuZFxuICogKipDeWNsZUV4Y2VwdGlvbioqIGlzIHRocm93bi5cbiAqXG4gKiBTZWUgW3RvcG9sb2dpY2FsIHNvcnRpbmddKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1RvcG9sb2dpY2FsX3NvcnRpbmcpXG4gKiBmb3IgbW9yZSBkZXRhaWxzIGFib3V0IGhvdyB0aGlzIGFsZ29yaXRobSB3b3Jrcy5cbiAqXG4gKiBAcGFyYW0ge0RpZ3JhcGh9IGcgdGhlIGdyYXBoIHRvIHNvcnRcbiAqL1xuZnVuY3Rpb24gdG9wc29ydChnKSB7XG4gIGlmICghZy5pc0RpcmVjdGVkKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0b3Bzb3J0IGNhbiBvbmx5IGJlIGFwcGxpZWQgdG8gYSBkaXJlY3RlZCBncmFwaC4gQmFkIGlucHV0OiBcIiArIGcpO1xuICB9XG5cbiAgdmFyIHZpc2l0ZWQgPSB7fTtcbiAgdmFyIHN0YWNrID0ge307XG4gIHZhciByZXN1bHRzID0gW107XG5cbiAgZnVuY3Rpb24gdmlzaXQobm9kZSkge1xuICAgIGlmIChub2RlIGluIHN0YWNrKSB7XG4gICAgICB0aHJvdyBuZXcgQ3ljbGVFeGNlcHRpb24oKTtcbiAgICB9XG5cbiAgICBpZiAoIShub2RlIGluIHZpc2l0ZWQpKSB7XG4gICAgICBzdGFja1tub2RlXSA9IHRydWU7XG4gICAgICB2aXNpdGVkW25vZGVdID0gdHJ1ZTtcbiAgICAgIGcucHJlZGVjZXNzb3JzKG5vZGUpLmZvckVhY2goZnVuY3Rpb24ocHJlZCkge1xuICAgICAgICB2aXNpdChwcmVkKTtcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHN0YWNrW25vZGVdO1xuICAgICAgcmVzdWx0cy5wdXNoKG5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzaW5rcyA9IGcuc2lua3MoKTtcbiAgaWYgKGcub3JkZXIoKSAhPT0gMCAmJiBzaW5rcy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQ3ljbGVFeGNlcHRpb24oKTtcbiAgfVxuXG4gIGcuc2lua3MoKS5mb3JFYWNoKGZ1bmN0aW9uKHNpbmspIHtcbiAgICB2aXNpdChzaW5rKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbmZ1bmN0aW9uIEN5Y2xlRXhjZXB0aW9uKCkge31cblxuQ3ljbGVFeGNlcHRpb24ucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIkdyYXBoIGhhcyBhdCBsZWFzdCBvbmUgY3ljbGVcIjtcbn07XG4iLCIvLyBUaGlzIGZpbGUgcHJvdmlkZXMgYSBoZWxwZXIgZnVuY3Rpb24gdGhhdCBtaXhlcy1pbiBEb3QgYmVoYXZpb3IgdG8gYW5cbi8vIGV4aXN0aW5nIGdyYXBoIHByb3RvdHlwZS5cblxuLyoganNoaW50IC1XMDc5ICovXG52YXIgU2V0ID0gcmVxdWlyZShcImNwLWRhdGFcIikuU2V0O1xuLyoganNoaW50ICtXMDc5ICovXG5cbm1vZHVsZS5leHBvcnRzID0gY29tcG91bmRpZnk7XG5cbi8vIEV4dGVuZHMgdGhlIGdpdmVuIFN1cGVyQ29uc3RydWN0b3Igd2l0aCB0aGUgYWJpbGl0eSBmb3Igbm9kZXMgdG8gY29udGFpblxuLy8gb3RoZXIgbm9kZXMuIEEgc3BlY2lhbCBub2RlIGlkIGBudWxsYCBpcyB1c2VkIHRvIGluZGljYXRlIHRoZSByb290IGdyYXBoLlxuZnVuY3Rpb24gY29tcG91bmRpZnkoU3VwZXJDb25zdHJ1Y3Rvcikge1xuICBmdW5jdGlvbiBDb25zdHJ1Y3RvcigpIHtcbiAgICBTdXBlckNvbnN0cnVjdG9yLmNhbGwodGhpcyk7XG5cbiAgICAvLyBNYXAgb2Ygb2JqZWN0IGlkIC0+IHBhcmVudCBpZCAob3IgbnVsbCBmb3Igcm9vdCBncmFwaClcbiAgICB0aGlzLl9wYXJlbnRzID0ge307XG5cbiAgICAvLyBNYXAgb2YgaWQgKG9yIG51bGwpIC0+IGNoaWxkcmVuIHNldFxuICAgIHRoaXMuX2NoaWxkcmVuID0ge307XG4gICAgdGhpcy5fY2hpbGRyZW5bbnVsbF0gPSBuZXcgU2V0KCk7XG4gIH1cblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBuZXcgU3VwZXJDb25zdHJ1Y3RvcigpO1xuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUucGFyZW50ID0gZnVuY3Rpb24odSwgcGFyZW50KSB7XG4gICAgdGhpcy5fc3RyaWN0R2V0Tm9kZSh1KTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcmVudHNbdV07XG4gICAgfVxuXG4gICAgaWYgKHUgPT09IHBhcmVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IG1ha2UgXCIgKyB1ICsgXCIgYSBwYXJlbnQgb2YgaXRzZWxmXCIpO1xuICAgIH1cbiAgICBpZiAocGFyZW50ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHBhcmVudCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2hpbGRyZW5bdGhpcy5fcGFyZW50c1t1XV0ucmVtb3ZlKHUpO1xuICAgIHRoaXMuX3BhcmVudHNbdV0gPSBwYXJlbnQ7XG4gICAgdGhpcy5fY2hpbGRyZW5bcGFyZW50XS5hZGQodSk7XG4gIH07XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmNoaWxkcmVuID0gZnVuY3Rpb24odSkge1xuICAgIGlmICh1ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdHJpY3RHZXROb2RlKHUpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2hpbGRyZW5bdV0ua2V5cygpO1xuICB9O1xuXG4gIENvbnN0cnVjdG9yLnByb3RvdHlwZS5hZGROb2RlID0gZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB1ID0gU3VwZXJDb25zdHJ1Y3Rvci5wcm90b3R5cGUuYWRkTm9kZS5jYWxsKHRoaXMsIHUsIHZhbHVlKTtcbiAgICB0aGlzLl9wYXJlbnRzW3VdID0gbnVsbDtcbiAgICB0aGlzLl9jaGlsZHJlblt1XSA9IG5ldyBTZXQoKTtcbiAgICB0aGlzLl9jaGlsZHJlbltudWxsXS5hZGQodSk7XG4gICAgcmV0dXJuIHU7XG4gIH07XG5cbiAgQ29uc3RydWN0b3IucHJvdG90eXBlLmRlbE5vZGUgPSBmdW5jdGlvbih1KSB7XG4gICAgLy8gUHJvbW90ZSBhbGwgY2hpbGRyZW4gdG8gdGhlIHBhcmVudCBvZiB0aGUgc3ViZ3JhcGhcbiAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQodSk7XG4gICAgdGhpcy5fY2hpbGRyZW5bdV0ua2V5cygpLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgIHRoaXMucGFyZW50KGNoaWxkLCBwYXJlbnQpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5fY2hpbGRyZW5bcGFyZW50XS5yZW1vdmUodSk7XG4gICAgZGVsZXRlIHRoaXMuX3BhcmVudHNbdV07XG4gICAgZGVsZXRlIHRoaXMuX2NoaWxkcmVuW3VdO1xuXG4gICAgcmV0dXJuIFN1cGVyQ29uc3RydWN0b3IucHJvdG90eXBlLmRlbE5vZGUuY2FsbCh0aGlzLCB1KTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb3B5ID0gU3VwZXJDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY29weS5jYWxsKHRoaXMpO1xuICAgIHRoaXMubm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICAgIGNvcHkucGFyZW50KHUsIHRoaXMucGFyZW50KHUpKTtcbiAgICB9LCB0aGlzKTtcbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZmlsdGVyTm9kZXMgPSBmdW5jdGlvbihmaWx0ZXIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIGNvcHkgPSBTdXBlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5maWx0ZXJOb2Rlcy5jYWxsKHRoaXMsIGZpbHRlcik7XG5cbiAgICB2YXIgcGFyZW50cyA9IHt9O1xuICAgIGZ1bmN0aW9uIGZpbmRQYXJlbnQodSkge1xuICAgICAgdmFyIHBhcmVudCA9IHNlbGYucGFyZW50KHUpO1xuICAgICAgaWYgKHBhcmVudCA9PT0gbnVsbCB8fCBjb3B5Lmhhc05vZGUocGFyZW50KSkge1xuICAgICAgICBwYXJlbnRzW3VdID0gcGFyZW50O1xuICAgICAgICByZXR1cm4gcGFyZW50O1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnQgaW4gcGFyZW50cykge1xuICAgICAgICByZXR1cm4gcGFyZW50c1twYXJlbnRdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZpbmRQYXJlbnQocGFyZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb3B5LmVhY2hOb2RlKGZ1bmN0aW9uKHUpIHsgY29weS5wYXJlbnQodSwgZmluZFBhcmVudCh1KSk7IH0pO1xuXG4gICAgcmV0dXJuIGNvcHk7XG4gIH07XG5cbiAgcmV0dXJuIENvbnN0cnVjdG9yO1xufVxuIiwidmFyIEdyYXBoID0gcmVxdWlyZShcIi4uL0dyYXBoXCIpLFxuICAgIERpZ3JhcGggPSByZXF1aXJlKFwiLi4vRGlncmFwaFwiKSxcbiAgICBDR3JhcGggPSByZXF1aXJlKFwiLi4vQ0dyYXBoXCIpLFxuICAgIENEaWdyYXBoID0gcmVxdWlyZShcIi4uL0NEaWdyYXBoXCIpO1xuXG5leHBvcnRzLmRlY29kZSA9IGZ1bmN0aW9uKG5vZGVzLCBlZGdlcywgQ3Rvcikge1xuICBDdG9yID0gQ3RvciB8fCBEaWdyYXBoO1xuXG4gIGlmICh0eXBlT2Yobm9kZXMpICE9PSBcIkFycmF5XCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJub2RlcyBpcyBub3QgYW4gQXJyYXlcIik7XG4gIH1cblxuICBpZiAodHlwZU9mKGVkZ2VzKSAhPT0gXCJBcnJheVwiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZWRnZXMgaXMgbm90IGFuIEFycmF5XCIpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBDdG9yID09PSBcInN0cmluZ1wiKSB7XG4gICAgc3dpdGNoKEN0b3IpIHtcbiAgICAgIGNhc2UgXCJncmFwaFwiOiBDdG9yID0gR3JhcGg7IGJyZWFrO1xuICAgICAgY2FzZSBcImRpZ3JhcGhcIjogQ3RvciA9IERpZ3JhcGg7IGJyZWFrO1xuICAgICAgY2FzZSBcImNncmFwaFwiOiBDdG9yID0gQ0dyYXBoOyBicmVhaztcbiAgICAgIGNhc2UgXCJjZGlncmFwaFwiOiBDdG9yID0gQ0RpZ3JhcGg7IGJyZWFrO1xuICAgICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKFwiVW5yZWNvZ25pemVkIGdyYXBoIHR5cGU6IFwiICsgQ3Rvcik7XG4gICAgfVxuICB9XG5cbiAgdmFyIGdyYXBoID0gbmV3IEN0b3IoKTtcblxuICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKHUpIHtcbiAgICBncmFwaC5hZGROb2RlKHUuaWQsIHUudmFsdWUpO1xuICB9KTtcblxuICAvLyBJZiB0aGUgZ3JhcGggaXMgY29tcG91bmQsIHNldCB1cCBjaGlsZHJlbi4uLlxuICBpZiAoZ3JhcGgucGFyZW50KSB7XG4gICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbih1KSB7XG4gICAgICBpZiAodS5jaGlsZHJlbikge1xuICAgICAgICB1LmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgICAgICAgIGdyYXBoLnBhcmVudCh2LCB1LmlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBlZGdlcy5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICBncmFwaC5hZGRFZGdlKGUuaWQsIGUudSwgZS52LCBlLnZhbHVlKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGdyYXBoO1xufTtcblxuZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbihncmFwaCkge1xuICB2YXIgbm9kZXMgPSBbXTtcbiAgdmFyIGVkZ2VzID0gW107XG5cbiAgZ3JhcGguZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHtcbiAgICB2YXIgbm9kZSA9IHtpZDogdSwgdmFsdWU6IHZhbHVlfTtcbiAgICBpZiAoZ3JhcGguY2hpbGRyZW4pIHtcbiAgICAgIHZhciBjaGlsZHJlbiA9IGdyYXBoLmNoaWxkcmVuKHUpO1xuICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICBub2RlLmNoaWxkcmVuID0gY2hpbGRyZW47XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGVzLnB1c2gobm9kZSk7XG4gIH0pO1xuXG4gIGdyYXBoLmVhY2hFZGdlKGZ1bmN0aW9uKGUsIHUsIHYsIHZhbHVlKSB7XG4gICAgZWRnZXMucHVzaCh7aWQ6IGUsIHU6IHUsIHY6IHYsIHZhbHVlOiB2YWx1ZX0pO1xuICB9KTtcblxuICB2YXIgdHlwZTtcbiAgaWYgKGdyYXBoIGluc3RhbmNlb2YgQ0RpZ3JhcGgpIHtcbiAgICB0eXBlID0gXCJjZGlncmFwaFwiO1xuICB9IGVsc2UgaWYgKGdyYXBoIGluc3RhbmNlb2YgQ0dyYXBoKSB7XG4gICAgdHlwZSA9IFwiY2dyYXBoXCI7XG4gIH0gZWxzZSBpZiAoZ3JhcGggaW5zdGFuY2VvZiBEaWdyYXBoKSB7XG4gICAgdHlwZSA9IFwiZGlncmFwaFwiO1xuICB9IGVsc2UgaWYgKGdyYXBoIGluc3RhbmNlb2YgR3JhcGgpIHtcbiAgICB0eXBlID0gXCJncmFwaFwiO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNvdWxkbid0IGRldGVybWluZSB0eXBlIG9mIGdyYXBoOiBcIiArIGdyYXBoKTtcbiAgfVxuXG4gIHJldHVybiB7IG5vZGVzOiBub2RlcywgZWRnZXM6IGVkZ2VzLCB0eXBlOiB0eXBlIH07XG59O1xuXG5mdW5jdGlvbiB0eXBlT2Yob2JqKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKS5zbGljZSg4LCAtMSk7XG59XG4iLCIvKiBqc2hpbnQgLVcwNzkgKi9cbnZhciBTZXQgPSByZXF1aXJlKFwiY3AtZGF0YVwiKS5TZXQ7XG4vKiBqc2hpbnQgK1cwNzkgKi9cblxuZXhwb3J0cy5hbGwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkgeyByZXR1cm4gdHJ1ZTsgfTtcbn07XG5cbmV4cG9ydHMubm9kZXNGcm9tTGlzdCA9IGZ1bmN0aW9uKG5vZGVzKSB7XG4gIHZhciBzZXQgPSBuZXcgU2V0KG5vZGVzKTtcbiAgcmV0dXJuIGZ1bmN0aW9uKHUpIHtcbiAgICByZXR1cm4gc2V0Lmhhcyh1KTtcbiAgfTtcbn07XG4iLCJ2YXIgR3JhcGggPSByZXF1aXJlKFwiLi9HcmFwaFwiKSxcbiAgICBEaWdyYXBoID0gcmVxdWlyZShcIi4vRGlncmFwaFwiKTtcblxuLy8gU2lkZS1lZmZlY3QgYmFzZWQgY2hhbmdlcyBhcmUgbG91c3ksIGJ1dCBub2RlIGRvZXNuJ3Qgc2VlbSB0byByZXNvbHZlIHRoZVxuLy8gcmVxdWlyZXMgY3ljbGUuXG5cbi8qKlxuICogUmV0dXJucyBhIG5ldyBkaXJlY3RlZCBncmFwaCB1c2luZyB0aGUgbm9kZXMgYW5kIGVkZ2VzIGZyb20gdGhpcyBncmFwaC4gVGhlXG4gKiBuZXcgZ3JhcGggd2lsbCBoYXZlIHRoZSBzYW1lIG5vZGVzLCBidXQgd2lsbCBoYXZlIHR3aWNlIHRoZSBudW1iZXIgb2YgZWRnZXM6XG4gKiBlYWNoIGVkZ2UgaXMgc3BsaXQgaW50byB0d28gZWRnZXMgd2l0aCBvcHBvc2l0ZSBkaXJlY3Rpb25zLiBFZGdlIGlkcyxcbiAqIGNvbnNlcXVlbnRseSwgYXJlIG5vdCBwcmVzZXJ2ZWQgYnkgdGhpcyB0cmFuc2Zvcm1hdGlvbi5cbiAqL1xuR3JhcGgucHJvdG90eXBlLnRvRGlncmFwaCA9XG5HcmFwaC5wcm90b3R5cGUuYXNEaXJlY3RlZCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZyA9IG5ldyBEaWdyYXBoKCk7XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgZy5hZGROb2RlKHUsIHZhbHVlKTsgfSk7XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBnLmFkZEVkZ2UobnVsbCwgdSwgdiwgdmFsdWUpO1xuICAgIGcuYWRkRWRnZShudWxsLCB2LCB1LCB2YWx1ZSk7XG4gIH0pO1xuICByZXR1cm4gZztcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIG5ldyB1bmRpcmVjdGVkIGdyYXBoIHVzaW5nIHRoZSBub2RlcyBhbmQgZWRnZXMgZnJvbSB0aGlzIGdyYXBoLlxuICogVGhlIG5ldyBncmFwaCB3aWxsIGhhdmUgdGhlIHNhbWUgbm9kZXMsIGJ1dCB0aGUgZWRnZXMgd2lsbCBiZSBtYWRlXG4gKiB1bmRpcmVjdGVkLiBFZGdlIGlkcyBhcmUgcHJlc2VydmVkIGluIHRoaXMgdHJhbnNmb3JtYXRpb24uXG4gKi9cbkRpZ3JhcGgucHJvdG90eXBlLnRvR3JhcGggPVxuRGlncmFwaC5wcm90b3R5cGUuYXNVbmRpcmVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnID0gbmV3IEdyYXBoKCk7XG4gIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24odSwgdmFsdWUpIHsgZy5hZGROb2RlKHUsIHZhbHVlKTsgfSk7XG4gIHRoaXMuZWFjaEVkZ2UoZnVuY3Rpb24oZSwgdSwgdiwgdmFsdWUpIHtcbiAgICBnLmFkZEVkZ2UoZSwgdSwgdiwgdmFsdWUpO1xuICB9KTtcbiAgcmV0dXJuIGc7XG59O1xuIiwiLy8gUmV0dXJucyBhbiBhcnJheSBvZiBhbGwgdmFsdWVzIGZvciBwcm9wZXJ0aWVzIG9mICoqbyoqLlxuZXhwb3J0cy52YWx1ZXMgPSBmdW5jdGlvbihvKSB7XG4gIHZhciBrcyA9IE9iamVjdC5rZXlzKG8pLFxuICAgICAgbGVuID0ga3MubGVuZ3RoLFxuICAgICAgcmVzdWx0ID0gbmV3IEFycmF5KGxlbiksXG4gICAgICBpO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSBvW2tzW2ldXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gJzAuNy40JztcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgJ3VzZSBzdHJpY3QnXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZm4pe1xuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgcmV0dXJuIGZuLmJpbmQobnVsbCwgdGhpcykuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgfVxuICB9XG59KClcbiIsInZhciBkb21pZnkgPSByZXF1aXJlKCdkb21pZnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBoeXBlcmdsdWU7XG5mdW5jdGlvbiBoeXBlcmdsdWUgKHNyYywgdXBkYXRlcykge1xuICAgIGlmICghdXBkYXRlcykgdXBkYXRlcyA9IHt9O1xuXG4gICAgdmFyIGRvbSA9IHR5cGVvZiBzcmMgPT09ICdvYmplY3QnXG4gICAgICAgID8gWyBzcmMgXVxuICAgICAgICA6IGRvbWlmeShzcmMpXG4gICAgO1xuICAgIGZvckVhY2gob2JqZWN0S2V5cyh1cGRhdGVzKSwgZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHVwZGF0ZXNbc2VsZWN0b3JdO1xuICAgICAgICBmb3JFYWNoKGRvbSwgZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgIGlmIChzZWxlY3RvciA9PT0gJzpmaXJzdCcpIHtcbiAgICAgICAgICAgICAgICBiaW5kKGQsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKC86Zmlyc3QkLy50ZXN0KHNlbGVjdG9yKSkge1xuICAgICAgICAgICAgICAgIHZhciBrID0gc2VsZWN0b3IucmVwbGFjZSgvOmZpcnN0JC8sICcnKTtcbiAgICAgICAgICAgICAgICB2YXIgZWxlbSA9IGQucXVlcnlTZWxlY3RvcihrKTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbSkgYmluZChlbGVtLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgbm9kZXMgPSBkLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgICAgICAgICAgICAgIGlmIChub2Rlcy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGJpbmQobm9kZXNbaV0sIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRvbS5sZW5ndGggPT09IDFcbiAgICAgICAgPyBkb21bMF1cbiAgICAgICAgOiBkb21cbiAgICA7XG59XG5cbmZ1bmN0aW9uIGJpbmQgKG5vZGUsIHZhbHVlKSB7XG4gICAgaWYgKGlzRWxlbWVudCh2YWx1ZSkpIHtcbiAgICAgICAgbm9kZS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgbm9kZS5hcHBlbmRDaGlsZCh2YWx1ZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBlID0gaHlwZXJnbHVlKG5vZGUuY2xvbmVOb2RlKHRydWUpLCB2YWx1ZVtpXSk7XG4gICAgICAgICAgICBub2RlLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGUsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBmb3JFYWNoKG9iamVjdEtleXModmFsdWUpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICBpZiAoa2V5ID09PSAnX3RleHQnKSB7XG4gICAgICAgICAgICAgICAgc2V0VGV4dChub2RlLCB2YWx1ZVtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGtleSA9PT0gJ19odG1sJyAmJiBpc0VsZW1lbnQodmFsdWVba2V5XSkpIHtcbiAgICAgICAgICAgICAgICBub2RlLmlubmVySFRNTCA9ICcnO1xuICAgICAgICAgICAgICAgIG5vZGUuYXBwZW5kQ2hpbGQodmFsdWVba2V5XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChrZXkgPT09ICdfaHRtbCcpIHtcbiAgICAgICAgICAgICAgICBub2RlLmlubmVySFRNTCA9IHZhbHVlW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIG5vZGUuc2V0QXR0cmlidXRlKGtleSwgdmFsdWVba2V5XSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHNldFRleHQobm9kZSwgdmFsdWUpO1xufVxuXG5mdW5jdGlvbiBmb3JFYWNoKHhzLCBmKSB7XG4gICAgaWYgKHhzLmZvckVhY2gpIHJldHVybiB4cy5mb3JFYWNoKGYpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIGYoeHNbaV0sIGkpXG59XG5cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciByZXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSByZXMucHVzaChrZXkpO1xuICAgIHJldHVybiByZXM7XG59O1xuXG5mdW5jdGlvbiBpc0VsZW1lbnQgKGUpIHtcbiAgICByZXR1cm4gZSAmJiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgZS5jaGlsZE5vZGVzXG4gICAgICAgICYmICh0eXBlb2YgZS5hcHBlbmRDaGlsZCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICB8fCB0eXBlb2YgZS5hcHBlbmRDaGlsZCA9PT0gJ29iamVjdCcpXG4gICAgO1xufVxuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5mdW5jdGlvbiBzZXRUZXh0IChlLCBzKSB7XG4gICAgZS5pbm5lckhUTUwgPSAnJztcbiAgICB2YXIgdHh0ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoU3RyaW5nKHMpKTtcbiAgICBlLmFwcGVuZENoaWxkKHR4dCk7XG59XG4iLCJcbi8qKlxuICogRXhwb3NlIGBwYXJzZWAuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZTtcblxuLyoqXG4gKiBXcmFwIG1hcCBmcm9tIGpxdWVyeS5cbiAqL1xuXG52YXIgbWFwID0ge1xuICBvcHRpb246IFsxLCAnPHNlbGVjdCBtdWx0aXBsZT1cIm11bHRpcGxlXCI+JywgJzwvc2VsZWN0PiddLFxuICBvcHRncm91cDogWzEsICc8c2VsZWN0IG11bHRpcGxlPVwibXVsdGlwbGVcIj4nLCAnPC9zZWxlY3Q+J10sXG4gIGxlZ2VuZDogWzEsICc8ZmllbGRzZXQ+JywgJzwvZmllbGRzZXQ+J10sXG4gIHRoZWFkOiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgdGJvZHk6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICB0Zm9vdDogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIGNvbGdyb3VwOiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgY2FwdGlvbjogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIHRyOiBbMiwgJzx0YWJsZT48dGJvZHk+JywgJzwvdGJvZHk+PC90YWJsZT4nXSxcbiAgdGQ6IFszLCAnPHRhYmxlPjx0Ym9keT48dHI+JywgJzwvdHI+PC90Ym9keT48L3RhYmxlPiddLFxuICB0aDogWzMsICc8dGFibGU+PHRib2R5Pjx0cj4nLCAnPC90cj48L3Rib2R5PjwvdGFibGU+J10sXG4gIGNvbDogWzIsICc8dGFibGU+PHRib2R5PjwvdGJvZHk+PGNvbGdyb3VwPicsICc8L2NvbGdyb3VwPjwvdGFibGU+J10sXG4gIF9kZWZhdWx0OiBbMCwgJycsICcnXVxufTtcblxuLyoqXG4gKiBQYXJzZSBgaHRtbGAgYW5kIHJldHVybiB0aGUgY2hpbGRyZW4uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGh0bWxcbiAqIEByZXR1cm4ge0FycmF5fVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2UoaHRtbCkge1xuICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIGh0bWwpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1N0cmluZyBleHBlY3RlZCcpO1xuICBcbiAgLy8gdGFnIG5hbWVcbiAgdmFyIG0gPSAvPChbXFx3Ol0rKS8uZXhlYyhodG1sKTtcbiAgaWYgKCFtKSB0aHJvdyBuZXcgRXJyb3IoJ05vIGVsZW1lbnRzIHdlcmUgZ2VuZXJhdGVkLicpO1xuICB2YXIgdGFnID0gbVsxXTtcbiAgXG4gIC8vIGJvZHkgc3VwcG9ydFxuICBpZiAodGFnID09ICdib2R5Jykge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2h0bWwnKTtcbiAgICBlbC5pbm5lckhUTUwgPSBodG1sO1xuICAgIHJldHVybiBbZWwucmVtb3ZlQ2hpbGQoZWwubGFzdENoaWxkKV07XG4gIH1cbiAgXG4gIC8vIHdyYXAgbWFwXG4gIHZhciB3cmFwID0gbWFwW3RhZ10gfHwgbWFwLl9kZWZhdWx0O1xuICB2YXIgZGVwdGggPSB3cmFwWzBdO1xuICB2YXIgcHJlZml4ID0gd3JhcFsxXTtcbiAgdmFyIHN1ZmZpeCA9IHdyYXBbMl07XG4gIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBlbC5pbm5lckhUTUwgPSBwcmVmaXggKyBodG1sICsgc3VmZml4O1xuICB3aGlsZSAoZGVwdGgtLSkgZWwgPSBlbC5sYXN0Q2hpbGQ7XG5cbiAgcmV0dXJuIG9ycGhhbihlbC5jaGlsZHJlbik7XG59XG5cbi8qKlxuICogT3JwaGFuIGBlbHNgIGFuZCByZXR1cm4gYW4gYXJyYXkuXG4gKlxuICogQHBhcmFtIHtOb2RlTGlzdH0gZWxzXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIG9ycGhhbihlbHMpIHtcbiAgdmFyIHJldCA9IFtdO1xuXG4gIHdoaWxlIChlbHMubGVuZ3RoKSB7XG4gICAgcmV0LnB1c2goZWxzWzBdLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWxzWzBdKSk7XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuIiwidmFyIGRpY3Rpb25hcnkgPSB7XG4gIHdvcmRzOiBbXG4gICAgJ2FkJyxcbiAgICAnYWRpcGlzaWNpbmcnLFxuICAgICdhbGlxdWEnLFxuICAgICdhbGlxdWlwJyxcbiAgICAnYW1ldCcsXG4gICAgJ2FuaW0nLFxuICAgICdhdXRlJyxcbiAgICAnY2lsbHVtJyxcbiAgICAnY29tbW9kbycsXG4gICAgJ2NvbnNlY3RldHVyJyxcbiAgICAnY29uc2VxdWF0JyxcbiAgICAnY3VscGEnLFxuICAgICdjdXBpZGF0YXQnLFxuICAgICdkZXNlcnVudCcsXG4gICAgJ2RvJyxcbiAgICAnZG9sb3InLFxuICAgICdkb2xvcmUnLFxuICAgICdkdWlzJyxcbiAgICAnZWEnLFxuICAgICdlaXVzbW9kJyxcbiAgICAnZWxpdCcsXG4gICAgJ2VuaW0nLFxuICAgICdlc3NlJyxcbiAgICAnZXN0JyxcbiAgICAnZXQnLFxuICAgICdldScsXG4gICAgJ2V4JyxcbiAgICAnZXhjZXB0ZXVyJyxcbiAgICAnZXhlcmNpdGF0aW9uJyxcbiAgICAnZnVnaWF0JyxcbiAgICAnaWQnLFxuICAgICdpbicsXG4gICAgJ2luY2lkaWR1bnQnLFxuICAgICdpcHN1bScsXG4gICAgJ2lydXJlJyxcbiAgICAnbGFib3JlJyxcbiAgICAnbGFib3JpcycsXG4gICAgJ2xhYm9ydW0nLFxuICAgICdMb3JlbScsXG4gICAgJ21hZ25hJyxcbiAgICAnbWluaW0nLFxuICAgICdtb2xsaXQnLFxuICAgICduaXNpJyxcbiAgICAnbm9uJyxcbiAgICAnbm9zdHJ1ZCcsXG4gICAgJ251bGxhJyxcbiAgICAnb2NjYWVjYXQnLFxuICAgICdvZmZpY2lhJyxcbiAgICAncGFyaWF0dXInLFxuICAgICdwcm9pZGVudCcsXG4gICAgJ3F1aScsXG4gICAgJ3F1aXMnLFxuICAgICdyZXByZWhlbmRlcml0JyxcbiAgICAnc2ludCcsXG4gICAgJ3NpdCcsXG4gICAgJ3N1bnQnLFxuICAgICd0ZW1wb3InLFxuICAgICd1bGxhbWNvJyxcbiAgICAndXQnLFxuICAgICd2ZWxpdCcsXG4gICAgJ3ZlbmlhbScsXG4gICAgJ3ZvbHVwdGF0ZScgIFxuICBdXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRpY3Rpb25hcnk7IiwidmFyIGdlbmVyYXRvciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgb3B0aW9ucyA9IChhcmd1bWVudHMubGVuZ3RoKSA/IGFyZ3VtZW50c1swXSA6IHt9XG4gICAgLCBjb3VudCA9IG9wdGlvbnMuY291bnQgfHwgMVxuICAgICwgdW5pdHMgPSBvcHRpb25zLnVuaXRzIHx8ICdzZW50ZW5jZXMnXG4gICAgLCBzZW50ZW5jZUxvd2VyQm91bmQgPSBvcHRpb25zLnNlbnRlbmNlTG93ZXJCb3VuZCB8fCA1XG4gICAgLCBzZW50ZW5jZVVwcGVyQm91bmQgPSBvcHRpb25zLnNlbnRlbmNlVXBwZXJCb3VuZCB8fCAxNVxuXHQgICwgcGFyYWdyYXBoTG93ZXJCb3VuZCA9IG9wdGlvbnMucGFyYWdyYXBoTG93ZXJCb3VuZCB8fCAzXG5cdCAgLCBwYXJhZ3JhcGhVcHBlckJvdW5kID0gb3B0aW9ucy5wYXJhZ3JhcGhVcHBlckJvdW5kIHx8IDdcblx0ICAsIGZvcm1hdCA9IG9wdGlvbnMuZm9ybWF0IHx8ICdwbGFpbidcbiAgICAsIHdvcmRzID0gb3B0aW9ucy53b3JkcyB8fCByZXF1aXJlKCcuL2RpY3Rpb25hcnknKS53b3Jkc1xuICAgICwgcmFuZG9tID0gb3B0aW9ucy5yYW5kb20gfHwgTWF0aC5yYW5kb207XG5cbiAgdW5pdHMgPSBzaW1wbGVQbHVyYWxpemUodW5pdHMudG9Mb3dlckNhc2UoKSk7XG5cbiAgdmFyIHJhbmRvbUludGVnZXIgPSBmdW5jdGlvbihtaW4sIG1heCkge1xuICAgIHJldHVybiBNYXRoLmZsb29yKHJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpICsgbWluKTtcbiAgfTtcbiAgXG4gIHZhciByYW5kb21Xb3JkID0gZnVuY3Rpb24od29yZHMpIHtcbiAgICByZXR1cm4gd29yZHNbcmFuZG9tSW50ZWdlcigwLCB3b3Jkcy5sZW5ndGggLSAxKV07XG4gIH07XG4gIFxuICB2YXIgcmFuZG9tU2VudGVuY2UgPSBmdW5jdGlvbih3b3JkcywgbG93ZXJCb3VuZCwgdXBwZXJCb3VuZCkge1xuICAgIHZhciBzZW50ZW5jZSA9ICcnXG4gICAgICAsIGJvdW5kcyA9IHttaW46IDAsIG1heDogcmFuZG9tSW50ZWdlcihsb3dlckJvdW5kLCB1cHBlckJvdW5kKX07XG4gICAgXG4gICAgd2hpbGUgKGJvdW5kcy5taW4gPCBib3VuZHMubWF4KSB7XG4gICAgICBzZW50ZW5jZSA9IHNlbnRlbmNlICsgJyAnICsgcmFuZG9tV29yZCh3b3Jkcyk7XG4gICAgICBib3VuZHMubWluID0gYm91bmRzLm1pbiArIDE7XG4gICAgfVxuICAgIFxuICAgIGlmIChzZW50ZW5jZS5sZW5ndGgpIHtcbiAgICAgIHNlbnRlbmNlID0gc2VudGVuY2Uuc2xpY2UoMSk7XG4gICAgICBzZW50ZW5jZSA9IHNlbnRlbmNlLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc2VudGVuY2Uuc2xpY2UoMSk7XG4gICAgfVxuICBcbiAgICByZXR1cm4gc2VudGVuY2U7XG4gIH07XG5cbiAgdmFyIHJhbmRvbVBhcmFncmFwaCA9IGZ1bmN0aW9uKHdvcmRzLCBsb3dlckJvdW5kLCB1cHBlckJvdW5kLCBzZW50ZW5jZUxvd2VyQm91bmQsIHNlbnRlbmNlVXBwZXJCb3VuZCkge1xuICAgIHZhciBwYXJhZ3JhcGggPSAnJ1xuICAgICAgLCBib3VuZHMgPSB7bWluOiAwLCBtYXg6IHJhbmRvbUludGVnZXIobG93ZXJCb3VuZCwgdXBwZXJCb3VuZCl9O1xuICAgICAgXG4gICAgd2hpbGUgKGJvdW5kcy5taW4gPCBib3VuZHMubWF4KSB7XG4gICAgICBwYXJhZ3JhcGggPSBwYXJhZ3JhcGggKyAnLiAnICsgcmFuZG9tU2VudGVuY2Uod29yZHMsIHNlbnRlbmNlTG93ZXJCb3VuZCwgc2VudGVuY2VVcHBlckJvdW5kKTtcbiAgICAgIGJvdW5kcy5taW4gPSBib3VuZHMubWluICsgMTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHBhcmFncmFwaC5sZW5ndGgpIHtcbiAgICAgIHBhcmFncmFwaCA9IHBhcmFncmFwaC5zbGljZSgyKTtcbiAgICAgIHBhcmFncmFwaCA9IHBhcmFncmFwaCArICcuJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHBhcmFncmFwaDtcbiAgfVxuICBcbiAgdmFyIGl0ZXIgPSAwXG4gICAgLCBib3VuZHMgPSB7bWluOiAwLCBtYXg6IGNvdW50fVxuICAgICwgc3RyaW5nID0gJydcbiAgICAsIHByZWZpeCA9ICcnXG4gICAgLCBzdWZmaXggPSBcIlxcclxcblwiO1xuXG4gIGlmIChmb3JtYXQgPT0gJ2h0bWwnKSB7XG4gICAgcHJlZml4ID0gJzxwPic7XG4gICAgc3VmZml4ID0gJzwvcD4nO1xuICB9XG4gICAgICBcbiAgd2hpbGUgKGJvdW5kcy5taW4gPCBib3VuZHMubWF4KSB7XG4gICAgc3dpdGNoICh1bml0cy50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICd3b3Jkcyc6XG4gICAgICAgIHN0cmluZyA9IHN0cmluZyArICcgJyArIHJhbmRvbVdvcmQod29yZHMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3NlbnRlbmNlcyc6XG4gICAgICAgIHN0cmluZyA9IHN0cmluZyArICcuICcgKyByYW5kb21TZW50ZW5jZSh3b3Jkcywgc2VudGVuY2VMb3dlckJvdW5kLCBzZW50ZW5jZVVwcGVyQm91bmQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3BhcmFncmFwaHMnOlxuICAgICAgICBzdHJpbmcgPSBzdHJpbmcgKyBwcmVmaXggKyByYW5kb21QYXJhZ3JhcGgod29yZHMsIHBhcmFncmFwaExvd2VyQm91bmQsIHBhcmFncmFwaFVwcGVyQm91bmQsIHNlbnRlbmNlTG93ZXJCb3VuZCwgc2VudGVuY2VVcHBlckJvdW5kKSArIHN1ZmZpeDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGJvdW5kcy5taW4gPSBib3VuZHMubWluICsgMTtcbiAgfVxuICAgIFxuICBpZiAoc3RyaW5nLmxlbmd0aCkge1xuICAgIHZhciBwb3MgPSAwO1xuICAgIFxuICAgIGlmIChzdHJpbmcuaW5kZXhPZignLiAnKSA9PSAwKSB7XG4gICAgICBwb3MgPSAyO1xuICAgIH0gZWxzZSBpZiAoc3RyaW5nLmluZGV4T2YoJy4nKSA9PSAwIHx8IHN0cmluZy5pbmRleE9mKCcgJykgPT0gMCkge1xuICAgICAgcG9zID0gMTtcbiAgICB9XG4gICAgXG4gICAgc3RyaW5nID0gc3RyaW5nLnNsaWNlKHBvcyk7XG4gICAgXG4gICAgaWYgKHVuaXRzID09ICdzZW50ZW5jZXMnKSB7XG4gICAgICBzdHJpbmcgPSBzdHJpbmcgKyAnLic7XG4gICAgfVxuICB9ICBcbiAgXG4gIHJldHVybiBzdHJpbmc7XG59O1xuXG5mdW5jdGlvbiBzaW1wbGVQbHVyYWxpemUoc3RyaW5nKSB7XG4gIGlmIChzdHJpbmcuaW5kZXhPZigncycsIHN0cmluZy5sZW5ndGggLSAxKSA9PT0gLTEpIHtcbiAgICByZXR1cm4gc3RyaW5nICsgJ3MnO1xuICB9XG4gIHJldHVybiBzdHJpbmc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2VuZXJhdG9yO1xuIiwidm9pZCBmdW5jdGlvbihyb290KXtcblxuICBmdW5jdGlvbiBkZWZhdWx0cyhvcHRpb25zKXtcbiAgICB2YXIgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICB2YXIgbWluID0gb3B0aW9ucy5taW5cbiAgICB2YXIgbWF4ID0gb3B0aW9ucy5tYXhcbiAgICB2YXIgaW50ZWdlciA9IG9wdGlvbnMuaW50ZWdlciB8fCBmYWxzZVxuICAgIGlmICggbWluID09IG51bGwgJiYgbWF4ID09IG51bGwgKSB7XG4gICAgICBtaW4gPSAwXG4gICAgICBtYXggPSAxXG4gICAgfSBlbHNlIGlmICggbWluID09IG51bGwgKSB7XG4gICAgICBtaW4gPSBtYXggLSAxXG4gICAgfSBlbHNlIGlmICggbWF4ID09IG51bGwgKSB7XG4gICAgICBtYXggPSBtaW4gKyAxXG4gICAgfVxuICAgIGlmICggbWF4IDwgbWluICkgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIG9wdGlvbnMsIG1heCBtdXN0IGJlID49IG1pbicpXG4gICAgcmV0dXJuIHtcbiAgICAgIG1pbjogICAgIG1pblxuICAgICwgbWF4OiAgICAgbWF4XG4gICAgLCBpbnRlZ2VyOiBpbnRlZ2VyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmFuZG9tKG9wdGlvbnMpe1xuICAgIG9wdGlvbnMgPSBkZWZhdWx0cyhvcHRpb25zKVxuICAgIGlmICggb3B0aW9ucy5tYXggPT09IG9wdGlvbnMubWluICkgcmV0dXJuIG9wdGlvbnMubWluXG4gICAgdmFyIHIgPSBNYXRoLnJhbmRvbSgpICogKG9wdGlvbnMubWF4IC0gb3B0aW9ucy5taW4gKyBOdW1iZXIoISFvcHRpb25zLmludGVnZXIpKSArIG9wdGlvbnMubWluXG4gICAgcmV0dXJuIG9wdGlvbnMuaW50ZWdlciA/IE1hdGguZmxvb3IocikgOiByXG4gIH1cblxuICBmdW5jdGlvbiBnZW5lcmF0b3Iob3B0aW9ucyl7XG4gICAgb3B0aW9ucyA9IGRlZmF1bHRzKG9wdGlvbnMpXG4gICAgcmV0dXJuIGZ1bmN0aW9uKG1pbiwgbWF4LCBpbnRlZ2VyKXtcbiAgICAgIG9wdGlvbnMubWluICAgICA9IG1pbiAgICAgfHwgb3B0aW9ucy5taW5cbiAgICAgIG9wdGlvbnMubWF4ICAgICA9IG1heCAgICAgfHwgb3B0aW9ucy5tYXhcbiAgICAgIG9wdGlvbnMuaW50ZWdlciA9IGludGVnZXIgIT0gbnVsbCA/IGludGVnZXIgOiBvcHRpb25zLmludGVnZXJcbiAgICAgIHJldHVybiByYW5kb20ob3B0aW9ucylcbiAgICB9XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9ICByYW5kb21cbiAgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yXG4gIG1vZHVsZS5leHBvcnRzLmRlZmF1bHRzID0gZGVmYXVsdHNcbn0odGhpcylcbiIsInZvaWQgZnVuY3Rpb24ocm9vdCl7XG5cbiAgICAvLyByZXR1cm4gYSBudW1iZXIgYmV0d2VlbiAwIGFuZCBtYXgtMVxuICAgIGZ1bmN0aW9uIHIobWF4KXsgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSptYXgpIH1cblxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlKHNhbHQsIHNpemUpe1xuICAgICAgICB2YXIga2V5ID0gJydcbiAgICAgICAgdmFyIHNsID0gc2FsdC5sZW5ndGhcbiAgICAgICAgd2hpbGUgKCBzaXplIC0tICkge1xuICAgICAgICAgICAgdmFyIHJuZCA9IHIoc2wpXG4gICAgICAgICAgICBrZXkgKz0gc2FsdFtybmRdXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleVxuICAgIH1cblxuICAgIHZhciBybmR0b2sgPSBmdW5jdGlvbihzYWx0LCBzaXplKXtcbiAgICAgICAgcmV0dXJuIGlzTmFOKHNpemUpID8gdW5kZWZpbmVkIDpcbiAgICAgICAgICAgICAgIHNpemUgPCAxICAgID8gdW5kZWZpbmVkIDogZ2VuZXJhdGUoc2FsdCwgc2l6ZSlcblxuICAgIH1cblxuICAgIHJuZHRvay5nZW4gPSBjcmVhdGVHZW5lcmF0b3JcblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUdlbmVyYXRvcihzYWx0KXtcbiAgICAgICAgc2FsdCA9IHR5cGVvZiBzYWx0ICA9PSAnc3RyaW5nJyAmJiBzYWx0Lmxlbmd0aCA+IDAgPyBzYWx0IDogICdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h6eTAxMjM0NTY3ODknXG4gICAgICAgIHZhciB0ZW1wID0gcm5kdG9rLmJpbmQocm5kdG9rLCBzYWx0KVxuICAgICAgICB0ZW1wLnNhbHQgPSBmdW5jdGlvbigpeyByZXR1cm4gc2FsdCB9XG4gICAgICAgIHRlbXAuY3JlYXRlID0gY3JlYXRlR2VuZXJhdG9yXG4gICAgICAgIHRlbXAuZ2VuID0gY3JlYXRlR2VuZXJhdG9yXG4gICAgICAgIHJldHVybiB0ZW1wXG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVHZW5lcmF0b3IoKVxuXG59KHRoaXMpXG4iLCJ2b2lkIGZ1bmN0aW9uKHJvb3Qpe1xuXG5cdCd1c2Ugc3RyaWN0J1xuXG5cdHZhciBjcmVhdGUgPSBPYmplY3QuY3JlYXRlIHx8IGZ1bmN0aW9uKG8pe1xuXHRcdHZhciBGID0gZnVuY3Rpb24oKXt9XG5cdFx0Ri5wcm90b3R5cGUgPSBvXG5cdFx0cmV0dXJuIG5ldyBGKClcblx0fVxuXG5cdHZhciBleHRlbmQgPSBmdW5jdGlvbih0bywgZnJvbSl7XG5cdFx0Zm9yICggdmFyIHAgaW4gZnJvbSApIHRvW3BdID0gZnJvbVtwXVxuXHRcdHJldHVybiB0b1xuXHR9XG5cblx0Ly8gTGlicmFyeSBvYmplY3QgLSBhIGJhc2Ugb2JqZWN0IHRvIGJlIGV4dGVuZGVkXG5cdHZhciBWaXJhbCA9IHtcblxuXHRcdC8vIGNyZWF0ZSBhbiBpbmhlcml0aW5nIG9iamVjdCwgd2l0aCBhZGRlZCBvciBjaGFuZ2VkIG1ldGhvZHMgb3IgcHJvcGVydGllc1xuXHRcdGV4dGVuZDogZnVuY3Rpb24ocHJvcHMpe1xuXHRcdFx0cmV0dXJuIGV4dGVuZChjcmVhdGUodGhpcyksIHByb3BzKVxuXHRcdH0sXG5cblx0XHQvLyBjcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYW4gb2JqZWN0LCBjYWxsaW5nIGFuIGluaXQgbWV0aG9kIGlmIGF2YWlsYWJsZVxuXHRcdG1ha2U6IGZ1bmN0aW9uKCl7XG5cdFx0XHR2YXIgb2JqID0gY3JlYXRlKHRoaXMpXG5cdFx0XHRpZiAoIHR5cGVvZiBvYmouaW5pdCA9PT0gJ2Z1bmN0aW9uJyApIG9iai5pbml0LmFwcGx5KG9iaiwgYXJndW1lbnRzKVxuXHRcdFx0cmV0dXJuIG9ialxuXHRcdH1cblx0fVxuXG5cdC8vIG1vZHVsZSBkYW5jZVxuXHRpZiAoIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzICkgbW9kdWxlLmV4cG9ydHMgPSBWaXJhbFxuXHRlbHNlIGlmICggdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kICkgZGVmaW5lKFZpcmFsKVxuXHRlbHNlICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5WaXJhbCA9IFZpcmFsXG5cbn0odGhpcylcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgU2V0ID0gcmVxdWlyZSgnLi9zZXQuanMnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuXG4gIGZ1bmN0aW9uIGNsb25lKEEpe1xuICAgIHJldHVybiBQYXRod2F5Lm1ha2UoQS5zb3VyY2VzLCBBLmVkZ2VzLCBBLnRhcmdldHMpXG4gIH1cblxuICBmdW5jdGlvbiB1bmlvbihBLCBCKXtcblxuICAgIHJldHVybiBQYXRod2F5Lm1ha2UoQS5zb3VyY2VzLnVuaW9uKEIuc291cmNlcylcbiAgICAgICAgICAgICAgICAgICAgICAsIEEuZWRnZXMudW5pb24oQi5lZGdlcylcbiAgICAgICAgICAgICAgICAgICAgICAsIEEudGFyZ2V0cy51bmlvbihCLnRhcmdldHMpKVxuICB9XG5cbiAgZnVuY3Rpb24gc2FtZShBLCBCKXtcblxuICAgIHJldHVybiBBLnNvdXJjZXMuam9pbnQoQi5zb3VyY2VzKSB8fFxuICAgICAgICAgICBBLmVkZ2VzLmpvaW50KEIuZWRnZXMpIHx8XG4gICAgICAgICAgIEEudGFyZ2V0cy5qb2ludChCLnRhcmdldHMpXG4gIH1cblxuICB2YXIgUGF0aHdheSA9IHZpcmFsLmV4dGVuZCh7XG4gICAgaW5pdDogZnVuY3Rpb24oc291cmNlcywgZWRnZXMsIHRhcmdldHMpe1xuICAgICAgdGhpcy5zb3VyY2VzID0gc291cmNlcyAhPSBudWxsID8gc291cmNlcyA6IFNldC5tYWtlKClcbiAgICAgIHRoaXMuZWRnZXMgPSBlZGdlcyAhPSBudWxsID8gZWRnZXMgOiBTZXQubWFrZSgpXG4gICAgICB0aGlzLnRhcmdldHMgPSB0YXJnZXRzICE9IG51bGwgPyB0YXJnZXRzIDogU2V0Lm1ha2UoKVxuICAgIH1cbiAgLCBzYW1lOiBlbnNsYXZlKHNhbWUpXG4gICwgY2xvbmU6IGVuc2xhdmUoY2xvbmUpXG4gICwgdW5pb246IGVuc2xhdmUodW5pb24pXG4gIH0pXG5cbiAgZnVuY3Rpb24gaW5kZXhPZihQLCBwKXtcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBQLnZhbHVlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGlmICggc2FtZShQLnZhbHVlc1tpXSwgcCkgKSByZXR1cm4gaVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIGZ1bmN0aW9uIHNpemUocGF0aHdheXMpe1xuICAgIHJldHVybiBwYXRod2F5cy52YWx1ZXMubGVuZ3RoXG4gIH1cblxuXG4gIGZ1bmN0aW9uIGZvckVhY2gocGF0aHdheXMsIGZuKXtcbiAgICBwYXRod2F5cy52YWx1ZXMuZm9yRWFjaChmbilcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZChwYXRod2F5cywgc291cmNlLCBlZGdlLCB0YXJnZXQpe1xuXG4gICAgdmFyIG4gPSBQYXRod2F5Lm1ha2UoU2V0Lm1ha2UoKS5hZGQoc291cmNlKSwgU2V0Lm1ha2UoKS5hZGQoZWRnZSksIFNldC5tYWtlKCkuYWRkKHRhcmdldCkpXG5cbiAgICB2YXIgaCA9IGluZGV4T2YocGF0aHdheXMsIG4pXG4gICAgaWYgKCBoID4gLTEgICkge1xuICAgICAgcGF0aHdheXMudmFsdWVzW2hdID0gcGF0aHdheXMudmFsdWVzW2hdLnVuaW9uKG4pXG4gICAgfSBlbHNlIHtcbiAgICAgIHBhdGh3YXlzLnZhbHVlcy5wdXNoKG4pXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhdGh3YXlzXG4gIH1cblxuICB2YXIgUGF0aHdheXMgPSBTZXQuZXh0ZW5kKHtcbiAgICBhZGQ6IGVuc2xhdmUoYWRkKVxuICAsIGluZGV4T2Y6IGVuc2xhdmUoaW5kZXhPZilcbiAgfSlcblxuXG4gIG1vZHVsZS5leHBvcnRzID0gUGF0aHdheXNcblxuXG59KClcbiIsInZvaWQgZnVuY3Rpb24oKXtcbiAgdmFyIHZpcmFsID0gcmVxdWlyZSgndmlyYWwnKVxuICB2YXIgZW5zbGF2ZSA9IHJlcXVpcmUoJ2Vuc2xhdmUnKVxuICB2YXIgQXJyID0gcmVxdWlyZSgnLi9hcnIuanMnKVxuXG5cbiAgZnVuY3Rpb24gaGFzKHNldCwgdmFsdWUpe1xuICAgIHJldHVybiBzZXQuaW5kZXhPZih2YWx1ZSkgPiAtMVxuICB9XG5cbiAgZnVuY3Rpb24gYWRkKHNldCwgdmFsdWUpe1xuICAgIGlmICggISBoYXMoc2V0LCB2YWx1ZSkgKSB7XG4gICAgICBzZXQudmFsdWVzLnB1c2godmFsdWUpXG4gICAgfVxuICAgIHJldHVybiBzZXRcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZShzZXQsIHZhbHVlKXtcbiAgICB2YXIgaWR4ID0gaW5kZXhPZihzZXQsIHZhbHVlKVxuICAgIGlmICggaWR4ID4gLTEgKSB7XG4gICAgICBzZXQudmFsdWVzLnNwbGljZShpZHgsIDEpXG4gICAgfVxuICAgIHJldHVybiBzZXRcbiAgfVxuXG4gIGZ1bmN0aW9uIHNhbWUoc2V0LCBvdGhlcil7XG4gICAgcmV0dXJuIHNldC52YWx1ZXMubGVuZ3RoICE9IG90aGVyLnZhbHVlcy5sZW5ndGggPyBmYWxzZVxuICAgICAgICAgOiBzZXQudmFsdWVzLmV2ZXJ5KGZ1bmN0aW9uKGEpeyByZXR1cm4gb3RoZXIuaGFzKGEpIH0pXG4gIH1cblxuICBmdW5jdGlvbiB1bmlvbihzZXQsIG90aGVyKXtcbiAgICB2YXIgcmVzdWx0ID0gc2V0LmNsb25lKClcbiAgICBvdGhlci5mb3JFYWNoKGZ1bmN0aW9uKHYpe1xuICAgICAgcmVzdWx0LmFkZCh2KVxuICAgIH0pXG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG5cbiAgZnVuY3Rpb24gam9pbnQoc2V0LCBvdGhlcil7XG4gICAgcmV0dXJuIHNldC5zb21lKGZ1bmN0aW9uKGEpeyByZXR1cm4gb3RoZXIuaGFzKGEpIH0pXG4gIH1cblxuICBmdW5jdGlvbiBjbG9uZShzZXQpe1xuICAgIHJldHVybiBTZXQubWFrZShzZXQpXG4gIH1cblxuICB2YXIgU2V0ID0gQXJyLmV4dGVuZCh7XG4gICAgdW5pb246IGVuc2xhdmUodW5pb24pXG4gICwgaGFzOiBlbnNsYXZlKGhhcylcbiAgLCBhZGQ6IGVuc2xhdmUoYWRkKVxuICAsIHJlbW92ZTogZW5zbGF2ZShyZW1vdmUpXG4gICwgc2FtZTogZW5zbGF2ZShzYW1lKVxuICAsIGpvaW50OiBlbnNsYXZlKGpvaW50KVxuICAsIGNsb25lOiBlbnNsYXZlKGNsb25lKVxuICB9KVxuXG4gIG1vZHVsZS5leHBvcnRzID0gU2V0XG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICBcInVzZSBzdHJpY3RcIlxuICB2YXIgcnQgPSByZXF1aXJlKCdyYW5kb20tdG9rZW4nKVxuICB2YXIgcm5kID0gcmVxdWlyZSgncmFuZG9tLW51bWJlcicpXG4gIHZhciBmcyA9IHJlcXVpcmUoJ2ZzJylcbiAgdmFyIHd0ID0gcmVxdWlyZSgnLi4vaW5kZXguanMnKVxuICB2YXIgZG9tID0gcmVxdWlyZSgnLi4vdXRpbC9kb20uanMnKVxuICB2YXIgdWlkID0gcmVxdWlyZSgnLi4vdXRpbC91bmlxdWVfaWQuanMnKVxuICB2YXIgcmFuZF9pbnQgPSBybmQuZ2VuZXJhdG9yKHtpbnRlZ2VyOiB0cnVlfSlcbiAgdmFyIHByaW50ID0gY29uc29sZS5sb2cuYmluZChjb25zb2xlKVxuXG4gIHZhciBsaXBzY2ZnID0ge1xuICAgICAgY291bnQ6IDEgICAgICAgICAgICAgICAgICAgICAgLy8gTnVtYmVyIG9mIHdvcmRzLCBzZW50ZW5jZXMsIG9yIHBhcmFncmFwaHMgdG8gZ2VuZXJhdGUuXG4gICAgLCB1bml0czogJ3NlbnRlbmNlcycgICAgICAgICAgICAvLyBHZW5lcmF0ZSB3b3Jkcywgc2VudGVuY2VzLCBvciBwYXJhZ3JhcGhzLlxuICAgICwgc2VudGVuY2VMb3dlckJvdW5kOiAxICAgICAgICAgLy8gTWluaW11bSB3b3JkcyBwZXIgc2VudGVuY2UuXG4gICAgLCBzZW50ZW5jZVVwcGVyQm91bmQ6IDIgICAgICAgIC8vIE1heGltdW0gd29yZHMgcGVyIHNlbnRlbmNlLlxuICAgICwgZm9ybWF0OiAncGxhaW4nICAgICAgICAgICAgICAgLy8gUGxhaW4gdGV4dCBvciBodG1sXG4gIH1cblxuICB2YXIgbGlwc3VtID0gcmVxdWlyZSgnbG9yZW0taXBzdW0nKS5iaW5kKG51bGwsIGxpcHNjZmcpXG5cbiAgZnVuY3Rpb24gaXNOdW1iZXIobil7IHJldHVybiB0eXBlb2YgbiA9PSAnbnVtYmVyJyB9XG5cbiAgdmFyIGNvbmZpZyA9IHd0LmNvbmZpZyh7XG4gICAgcGFkZGluZzogMjFcbiAgLCByYW5rX2RldGVjdGlvbl9lcnJvcl9tYXJnaW46IDJcbiAgLCBlZGdlV2lkdGg6IDVcbiAgLCBlZGdlQ2xhc3M6ICdGQ0hMaW5lJ1xuICAsIGVkZ2VFbmRDbGFzczogJ0ZDSExpbmUtd2l0aGFycm93J1xuICAsIGludGVyc2VjdGlvbkNsYXNzOiAnRkNITGluZS1pbnRlcnNlY3Rpb24nXG4gIH0pXG5cbiAgdmFyIGdyYXBoID0gd3QuZ3JhcGgoe1xuICAgIHJhbmtEaXI6ICdMUidcbiAgLCB1bml2ZXJzYWxTZXA6IDI5XG4gICwgZWRnZVNlcDogMFxuICAsIHJhbmtTZXA6IDE1MFxuICB9KVxuXG4gIHZhciBub2RlcyA9IEFycmF5KDEyKVxuICB2YXIgcmFua3MgPSBbJ3NhbWVfZmlyc3QnLCdzYW1lX3NlY29uZCcsJ3NhbWVfc2Vjb25kJywnc2FtZV9zZWNvbmQnLCdzYW1lX3RoaXJkJywnc2FtZV90aGlyZCcsJ3NhbWVfdGhpcmQnLCdzYW1lX3RoaXJkJywnc2FtZV90aGlyZCcsJ3NhbWVfZm91cnRoJywnc2FtZV9mb3VydGgnLCdzYW1lX2ZvdXJ0aCddXG4gIGZvciAoIHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aCA7IGkrKyApIHtcbiAgICBub2Rlc1tpXSA9IGdyYXBoLmFkZF9ub2RlKFxuICAgICAgJ0ZDSEJveCdcbiAgICAsIGZ1bmN0aW9uIChub2RlLCB2YWx1ZXMpe1xuLy8gdGhlc2UgbGluZXMgc2hvdWxkbid0IGJlIGhlcmVcbiAgICAgICAgbm9kZS5hdHRyKCd4JywgdmFsdWVzLngpXG4gICAgICAgIG5vZGUuYXR0cigneScsIHZhbHVlcy55KVxuICAgICAgICB2YXIgeCA9IHZhbHVlcy54IC0gdmFsdWVzLndpZHRoIC8gMlxuICAgICAgICB2YXIgeSA9IHZhbHVlcy55IC0gdmFsdWVzLmhlaWdodCAvIDJcbiAgICAgICAgbm9kZS5hZGRfYXR0cignOmZpcnN0JywgJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHggKyAnLCcgKyB5ICsgJyknKVxuICAgICAgICBub2RlLmFkZF9hdHRyKCcuRkNIQm94LVRleHQtYmcnLCAnd2lkdGgnLCB2YWx1ZXMud2lkdGggKVxuICAgICAgICBub2RlLmFkZF9hdHRyKCcuRkNIQm94LVRleHQtYmcnLCAnaGVpZ2h0JywgdmFsdWVzLmhlaWdodClcbiAgICB9XG4gICAgLCB7XG4gICAgICAgIFwiLkZDSEJveC1UZXh0LXRpdGxlXCI6IHtfdGV4dDogKGkrMSkgKycgJyArIGxpcHN1bSgpLnNsaWNlKDAsIDE3KX1cbiAgICAgICwgXCIuRkNIQm94LVRleHQtdHlwZVwiIDoge190ZXh0OiAnVHlwZTogJyArIGxpcHN1bSgpLnNsaWNlKDAsIDEzKX1cbiAgICB9LCByYW5rc1tpXSlcbiAgfVxuXG4gIC8vIHZhciBybmRfbm9kZSA9IHJuZC5nZW5lcmF0b3Ioe21pbjogMCwgbWF4OiBub2Rlcy5sZW5ndGggLSAxLCBpbnRlZ2VyOiB0cnVlfSlcbiAgLy8gdmFyIGxpbmtzPSBBcnJheShyYW5kX2ludCgxLCBNYXRoLnBvdyhyYW5kX2ludCgxLCBub2Rlcy5sZW5ndGgpLCAyKSAtIDEpKVxuICB2YXIgY29ubmVjdGlvbnMgPSBbXG4gICAgWzAsMV1cbiAgLCBbMCwyXVxuICAsIFswLDNdXG4gICwgWzEsNF1cbiAgLCBbMSw1XVxuICAsIFsxLDZdXG4gICwgWzMsOV1cbiAgLCBbMiw3XVxuICAsIFsyLDhdXG4gICwgWzQsOV1cbiAgLCBbNiw5XVxuICAsIFs1LDEwXVxuICAsIFs3LDExXVxuICAsIFs4LDExXVxuICAsIFs5LDddXG4gICwgWzksOF1cbiAgLCBbOSwxMV1cbiAgLCBbMTAsN11cbiAgLCBbMTAsOF1cbiAgLCBbMTAsMTFdXG4gIF1cbiAgdmFyIGxpbmtzID0gQXJyYXkoY29ubmVjdGlvbnMubGVuZ3RoKVxuXG5cbiAgZnVuY3Rpb24gYnV0KGdlbiwgeCl7XG4gICAgdmFyIHIgPSBnZW4oKVxuICAgIHdoaWxlICggciA9PSB4ICkgeyByID0gZ2VuKCkgfVxuICAgIHJldHVybiByXG4gIH1cblxuXG4gIGZvciAoIHZhciBpID0gY29ubmVjdGlvbnMubGVuZ3RoIC0gMTsgaSA+PSAwIDsgaS0tICkge1xuICAgIC8vdmFyIGxpbmsxID0gcm5kX25vZGUoKVxuXG4gICAgbGlua3NbaV0gPSBncmFwaC5jb25uZWN0KFxuICAgICAgJ0ZDSExpbmUnXG4gICAgLy8gLCBub2Rlc1tsaW5rMV1cbiAgICAvLyAsIG5vZGVzW2J1dChybmRfbm9kZSwgbGluazEpXVxuICAgICwgbm9kZXNbY29ubmVjdGlvbnNbaV1bMF1dXG4gICAgLCBub2Rlc1tjb25uZWN0aW9uc1tpXVsxXV1cbiAgKVxuXG4gIH1cblxuICB2YXIgZGlhZ3JhbSA9IHd0LmRpYWdyYW0oY29uZmlnLCBncmFwaClcbiAgZGlhZ3JhbS50b19kZWZzKFwiPGZvbnQgaG9yaXotYWR2LXg9XFxcIjIwNDhcXFwiPlxcbiAgPCEtLSBPcGVuIFNhbnMgaXMgYSB0cmFkZW1hcmsgb2YgR29vZ2xlIGFuZCBtYXkgYmUgcmVnaXN0ZXJlZCBpbiBjZXJ0YWluIGp1cmlzZGljdGlvbnMuIC0tPlxcbiAgPCEtLSBDb3B5cmlnaHQ6IENvcHlyaWdodCAyMDE0IEFkb2JlIFN5c3RlbSBJbmNvcnBvcmF0ZWQuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIC0tPlxcbiAgPGZvbnQtZmFjZSBmb250LWZhbWlseT1cXFwiT3BlblNhbnMtU2VtaWJvbGRcXFwiIHVuaXRzLXBlci1lbT1cXFwiMjA0OFxcXCIgdW5kZXJsaW5lLXBvc2l0aW9uPVxcXCItMTU0XFxcIiB1bmRlcmxpbmUtdGhpY2tuZXNzPVxcXCIxMDJcXFwiLz5cXG4gIDxtaXNzaW5nLWdseXBoIGhvcml6LWFkdi14PVxcXCIxMjI5XFxcIiBkPVxcXCJNMTkzLDE0NjJsODQxLDBsMCwtMTQ2MmwtODQxLDBNMjk3LDEwNGw2MzMsMGwwLDEyNTRsLTYzMywwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiBcXFwiIGhvcml6LWFkdi14PVxcXCI1MzJcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIhXFxcIiBob3Jpei1hZHYteD1cXFwiNTY1XFxcIiBkPVxcXCJNMzcxLDQ0NGwtMTc0LDBsLTUyLDEwMThsMjc3LDBNMTMzLDEyNUMxMzMsMTc0IDE0NiwyMTIgMTcyLDIzOEMxOTgsMjYzIDIzNSwyNzYgMjgzLDI3NkMzMzAsMjc2IDM2NywyNjMgMzkyLDIzNkM0MTcsMjA5IDQzMCwxNzIgNDMwLDEyNUM0MzAsNzggNDE3LDQwIDM5MiwxM0MzNjYsLTE1IDMzMCwtMjkgMjgzLC0yOUMyMzYsLTI5IDE5OSwtMTYgMTczLDExQzE0NiwzOCAxMzMsNzYgMTMzLDEyNXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImcXVvdDtcXFwiIGhvcml6LWFkdi14PVxcXCI4OTNcXFwiIGQ9XFxcIk0zNjUsMTQ2MmwtNDEsLTUyOGwtMTUwLDBsLTQxLDUyOE03NjAsMTQ2MmwtNDEsLTUyOGwtMTUwLDBsLTQxLDUyOHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIjXFxcIiBob3Jpei1hZHYteD1cXFwiMTMyM1xcXCIgZD1cXFwiTTk4OSw4NzBsLTU1LC0yODRsMjcwLDBsMCwtMTY4bC0zMDMsMGwtODAsLTQxOGwtMTc4LDBsODAsNDE4bC0yNDgsMGwtODAsLTQxOGwtMTc0LDBsNzYsNDE4bC0yNTAsMGwwLDE2OGwyODMsMGw1NywyODRsLTI2NCwwbDAsMTY4bDI5MywwbDgwLDQyMmwxODAsMGwtODAsLTQyMmwyNTIsMGw4MCw0MjJsMTc0LDBsLTgwLC00MjJsMjUyLDBsMCwtMTY4TTUwNiw1ODZsMjUwLDBsNTcsMjg0bC0yNTAsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIkXFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTEwNjMsNDUzQzEwNjMsMzU2IDEwMjgsMjc3IDk1NywyMTRDODg2LDE1MSA3ODQsMTEzIDY1MSw5OGwwLC0yMTdsLTEzMywwbDAsMjExQzM1Myw5NSAyMTcsMTIwIDExMSwxNjhsMCwyMTFDMTY4LDM1MSAyMzUsMzI4IDMxMiwzMDlDMzg5LDI5MCA0NTcsMjgwIDUxOCwyNzlsMCwzNzRsLTg0LDMxQzMyNSw3MjYgMjQ1LDc3NiAxOTUsODM1QzE0NCw4OTMgMTE5LDk2NSAxMTksMTA1MUMxMTksMTE0MyAxNTUsMTIxOSAyMjcsMTI3OEMyOTgsMTMzNyAzOTUsMTM3MyA1MTgsMTM4NmwwLDE2OGwxMzMsMGwwLC0xNjVDNzg2LDEzODQgOTE1LDEzNTcgMTAzNiwxMzA3bC03MywtMTgzQzg1OCwxMTY1IDc1NCwxMTkwIDY1MSwxMTk4bDAsLTM2NGw3NiwtMjlDODU0LDc1NiA5NDEsNzA1IDk5MCw2NTFDMTAzOSw1OTcgMTA2Myw1MzEgMTA2Myw0NTNNODI3LDQzOEM4MjcsNDc3IDgxNCw1MDkgNzg3LDUzNEM3NjAsNTU5IDcxNCw1ODMgNjUxLDYwNmwwLC0zMTlDNzY4LDMwNSA4MjcsMzU1IDgyNyw0MzhNMzU0LDEwNTNDMzU0LDEwMTUgMzY2LDk4MyAzOTAsOTU4QzQxMyw5MzMgNDU2LDkwOCA1MTgsODgzbDAsMzExQzQ2NSwxMTg2IDQyNCwxMTcwIDM5NiwxMTQ1QzM2OCwxMTIwIDM1NCwxMDkwIDM1NCwxMDUzelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiVcXFwiIGhvcml6LWFkdi14PVxcXCIxNzY1XFxcIiBkPVxcXCJNMjc5LDEwMjRDMjc5LDkyNSAyODksODUxIDMwOCw4MDJDMzI3LDc1MyAzNTksNzI5IDQwMyw3MjlDNDkxLDcyOSA1MzUsODI3IDUzNSwxMDI0QzUzNSwxMjIxIDQ5MSwxMzE5IDQwMywxMzE5QzM1OSwxMzE5IDMyNywxMjk1IDMwOCwxMjQ2QzI4OSwxMTk3IDI3OSwxMTIzIDI3OSwxMDI0TTcyOSwxMDI2QzcyOSw4NzMgNzAyLDc1OCA2NDcsNjgxQzU5Miw2MDQgNTEwLDU2NSA0MDMsNTY1QzMwMiw1NjUgMjIzLDYwNSAxNjgsNjg1QzExMiw3NjQgODQsODc4IDg0LDEwMjZDODQsMTMzMSAxOTAsMTQ4MyA0MDMsMTQ4M0M1MDgsMTQ4MyA1ODgsMTQ0NCA2NDUsMTM2NUM3MDEsMTI4NiA3MjksMTE3MyA3MjksMTAyNk0xMjMxLDQ0MEMxMjMxLDM0MSAxMjQxLDI2NiAxMjYxLDIxN0MxMjgwLDE2OCAxMzEyLDE0MyAxMzU2LDE0M0MxNDQzLDE0MyAxNDg3LDI0MiAxNDg3LDQ0MEMxNDg3LDYzNSAxNDQzLDczMyAxMzU2LDczM0MxMzEyLDczMyAxMjgwLDcwOSAxMjYxLDY2MUMxMjQxLDYxMyAxMjMxLDUzOSAxMjMxLDQ0ME0xNjgxLDQ0MEMxNjgxLDI4NyAxNjUzLDE3MiAxNTk4LDk1QzE1NDMsMTggMTQ2MiwtMjAgMTM1NiwtMjBDMTI1NSwtMjAgMTE3NiwyMCAxMTIwLDk5QzEwNjQsMTc4IDEwMzYsMjkxIDEwMzYsNDQwQzEwMzYsNzQ1IDExNDMsODk3IDEzNTYsODk3QzE0NTksODk3IDE1MzksODU4IDE1OTYsNzc5QzE2NTMsNzAwIDE2ODEsNTg3IDE2ODEsNDQwTTEzODQsMTQ2MmwtODExLC0xNDYybC0xOTQsMGw4MTEsMTQ2MnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImYW1wO1xcXCIgaG9yaXotYWR2LXg9XFxcIjE1MTZcXFwiIGQ9XFxcIk00NTEsMTE0N0M0NTEsMTEwNSA0NjIsMTA2NSA0ODUsMTAyOEM1MDcsOTkxIDUzOCw5NTEgNTc4LDkwOUM2NTMsOTUyIDcwNiw5OTIgNzM3LDEwMjlDNzY3LDEwNjYgNzgyLDExMDcgNzgyLDExNTNDNzgyLDExOTYgNzY4LDEyMzEgNzM5LDEyNTdDNzEwLDEyODMgNjcxLDEyOTYgNjIzLDEyOTZDNTcwLDEyOTYgNTI5LDEyODMgNDk4LDEyNTZDNDY3LDEyMjkgNDUxLDExOTIgNDUxLDExNDdNNjAwLDE4MkM3MjIsMTgyIDgyNiwyMTggOTEzLDI4OWwtMzgzLDM3N0M0NTksNjIxIDQxMSw1NzggMzg0LDUzOUMzNTcsNDk5IDM0NCw0NTQgMzQ0LDQwM0MzNDQsMzM4IDM2NywyODUgNDE0LDI0NEM0NjAsMjAzIDUyMiwxODIgNjAwLDE4Mk05NiwzODdDOTYsNDc0IDExNyw1NTEgMTYwLDYxNkMyMDMsNjgxIDI4MCw3NDUgMzkxLDgwOUMzMjgsODgzIDI4NSw5NDYgMjYyLDk5N0MyMzksMTA0OCAyMjcsMTEwMCAyMjcsMTE1NUMyMjcsMTI1NiAyNjMsMTMzNiAzMzYsMTM5NUM0MDgsMTQ1NCA1MDUsMTQ4MyA2MjcsMTQ4M0M3NDUsMTQ4MyA4MzgsMTQ1NSA5MDUsMTM5OEM5NzIsMTM0MSAxMDA2LDEyNjQgMTAwNiwxMTY3QzEwMDYsMTA5MSA5ODQsMTAyMiA5MzksOTYwQzg5NCw4OTggODE4LDgzNiA3MTMsNzc0bDM0NiwtMzM0QzExMTMsNTExIDExNTgsNjE2IDExOTQsNzU0bDI0MiwwQzEzODksNTY1IDEzMTUsNDEwIDEyMTIsMjkxbDMwMSwtMjkxbC0zMDMsMGwtMTQ5LDE0NUM5OTMsOTAgOTIxLDQ5IDg0NCwyMkM3NjcsLTYgNjgxLC0yMCA1ODgsLTIwQzQzNSwtMjAgMzE0LDE2IDIyNyw4OUMxNDAsMTYyIDk2LDI2MSA5NiwzODd6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJ1xcXCIgaG9yaXotYWR2LXg9XFxcIjQ5OFxcXCIgZD1cXFwiTTM2NSwxNDYybC00MSwtNTI4bC0xNTAsMGwtNDEsNTI4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIihcXFwiIGhvcml6LWFkdi14PVxcXCI2NDlcXFwiIGQ9XFxcIk04Miw1NjFDODIsNzM4IDEwOCw5MDMgMTYwLDEwNTdDMjExLDEyMTEgMjg2LDEzNDYgMzgzLDE0NjJsMjA1LDBDNDk1LDEzMzcgNDI0LDExOTYgMzc1LDEwNDFDMzI2LDg4NSAzMDEsNzI2IDMwMSw1NjNDMzAxLDQwMCAzMjYsMjQzIDM3NSw5MEM0MjQsLTYzIDQ5NSwtMjAxIDU4NiwtMzI0bC0yMDMsMEMyODUsLTIxMSAyMTAsLTc4IDE1OSw3M0MxMDgsMjI0IDgyLDM4NyA4Miw1NjF6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiKVxcXCIgaG9yaXotYWR2LXg9XFxcIjY0OVxcXCIgZD1cXFwiTTU2Nyw1NjFDNTY3LDM4NiA1NDEsMjIyIDQ5MCw3MUM0MzgsLTgwIDM2MywtMjEyIDI2NiwtMzI0bC0yMDMsMEMxNTUsLTE5OSAyMjYsLTYxIDI3NSw5MUMzMjQsMjQzIDM0OCw0MDAgMzQ4LDU2M0MzNDgsNzI2IDMyMyw4ODYgMjc0LDEwNDFDMjI1LDExOTYgMTU0LDEzMzYgNjEsMTQ2MmwyMDUsMEMzNjQsMTM0NSA0MzksMTIxMCA0OTAsMTA1NkM1NDEsOTAxIDU2Nyw3MzYgNTY3LDU2MXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIqXFxcIiBob3Jpei1hZHYteD1cXFwiMTEyMlxcXCIgZD1cXFwiTTY3MiwxNTU2bC00MSwtMzgybDM4NSwxMDhsMjgsLTIxN2wtMzYwLC0yOWwyMzYsLTMxMWwtMTk5LC0xMDdsLTE2NiwzMzhsLTE0OSwtMzM4bC0yMDUsMTA3bDIzMSwzMTFsLTM1OCwyOWwzNSwyMTdsMzc2LC0xMDhsLTQxLDM4MnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIrXFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTQ5NCw2MzNsLTM5OCwwbDAsMTc4bDM5OCwwbDAsNDA4bDE4MCwwbDAsLTQwOGwzOTksMGwwLC0xNzhsLTM5OSwwbDAsLTQwNmwtMTgwLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiLFxcXCIgaG9yaXotYWR2LXg9XFxcIjU0N1xcXCIgZD1cXFwiTTQxMiwyMTVDMzgwLDkxIDMyMSwtNjkgMjM2LC0yNjRsLTE3MywwQzEwOSwtODQgMTQzLDgzIDE2NiwyMzhsMjMxLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiLVxcXCIgaG9yaXotYWR2LXg9XFxcIjY1OVxcXCIgZD1cXFwiTTcyLDQ0OWwwLDIwMGw1MTQsMGwwLC0yMDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiLlxcXCIgaG9yaXotYWR2LXg9XFxcIjU2M1xcXCIgZD1cXFwiTTEzMywxMjVDMTMzLDE3NCAxNDYsMjExIDE3MSwyMzdDMTk2LDI2MyAyMzMsMjc2IDI4MSwyNzZDMzMwLDI3NiAzNjcsMjYzIDM5MiwyMzZDNDE3LDIwOSA0MzAsMTcyIDQzMCwxMjVDNDMwLDc4IDQxNyw0MCAzOTIsMTNDMzY2LC0xNSAzMjksLTI5IDI4MSwtMjlDMjMzLC0yOSAxOTYsLTE1IDE3MSwxMkMxNDYsMzkgMTMzLDc3IDEzMywxMjV6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiL1xcXCIgaG9yaXotYWR2LXg9XFxcIjc5OVxcXCIgZD1cXFwiTTc4MiwxNDYybC01NDQsLTE0NjJsLTIyMiwwbDU0NSwxNDYyelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIjBcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNMTA4MSw3MzFDMTA4MSw0NzcgMTA0MCwyODggOTU5LDE2NUM4NzcsNDIgNzUyLC0yMCA1ODQsLTIwQzQyMSwtMjAgMjk4LDQ0IDIxNCwxNzFDMTMwLDI5OCA4OCw0ODUgODgsNzMxQzg4LDk4OSAxMjksMTE3OSAyMTEsMTMwMkMyOTIsMTQyNCA0MTcsMTQ4NSA1ODQsMTQ4NUM3NDcsMTQ4NSA4NzEsMTQyMSA5NTUsMTI5M0MxMDM5LDExNjUgMTA4MSw5NzggMTA4MSw3MzFNMzI2LDczMUMzMjYsNTMyIDM0NywzODkgMzg4LDMwNEM0MjksMjE5IDQ5NCwxNzYgNTg0LDE3NkM2NzQsMTc2IDc0MCwyMTkgNzgyLDMwNkM4MjMsMzkzIDg0NCw1MzQgODQ0LDczMUM4NDQsOTI3IDgyMywxMDY5IDc4MiwxMTU3Qzc0MCwxMjQ0IDY3NCwxMjg4IDU4NCwxMjg4QzQ5NCwxMjg4IDQyOSwxMjQ1IDM4OCwxMTU5QzM0NywxMDczIDMyNiw5MzAgMzI2LDczMXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIxXFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTc4MCwwbC0yMzUsMGwwLDk0NEM1NDUsMTA1NyA1NDgsMTE0NiA1NTMsMTIxMkM1MzgsMTE5NiA1MTksMTE3OCA0OTcsMTE1OUM0NzQsMTE0MCAzOTksMTA3OCAyNzIsOTc1bC0xMTgsMTQ5bDQzMCwzMzhsMTk2LDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiMlxcXCIgaG9yaXotYWR2LXg9XFxcIjExNjlcXFwiIGQ9XFxcIk0xMDgxLDBsLTk5MSwwbDAsMTc4bDM3NywzNzlDNTc4LDY3MSA2NTIsNzUyIDY4OSw4MDBDNzI1LDg0NyA3NTEsODkyIDc2OCw5MzRDNzg1LDk3NiA3OTMsMTAyMSA3OTMsMTA2OUM3OTMsMTEzNSA3NzMsMTE4NyA3MzQsMTIyNUM2OTQsMTI2MyA2MzksMTI4MiA1NjksMTI4MkM1MTMsMTI4MiA0NTksMTI3MiA0MDcsMTI1MUMzNTQsMTIzMCAyOTQsMTE5MyAyMjUsMTEzOWwtMTI3LDE1NUMxNzksMTM2MyAyNTgsMTQxMSAzMzUsMTQ0MEM0MTIsMTQ2OSA0OTMsMTQ4MyA1ODAsMTQ4M0M3MTYsMTQ4MyA4MjUsMTQ0OCA5MDcsMTM3N0M5ODksMTMwNiAxMDMwLDEyMTAgMTAzMCwxMDkwQzEwMzAsMTAyNCAxMDE4LDk2MSA5OTUsOTAyQzk3MSw4NDMgOTM1LDc4MiA4ODYsNzE5QzgzNyw2NTYgNzU1LDU3MCA2NDEsNDYzbC0yNTQsLTI0NmwwLC0xMGw2OTQsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCIzXFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTEwMjYsMTEyNkMxMDI2LDEwMzMgOTk5LDk1NiA5NDUsODk1Qzg5MSw4MzMgODE1LDc5MSA3MTcsNzcwbDAsLThDODM0LDc0NyA5MjIsNzExIDk4MSw2NTNDMTA0MCw1OTQgMTA2OSw1MTcgMTA2OSw0MjBDMTA2OSwyNzkgMTAxOSwxNzEgOTIwLDk1QzgyMSwxOCA2NzksLTIwIDQ5NiwtMjBDMzM0LC0yMCAxOTcsNiA4Niw1OWwwLDIwOUMxNDgsMjM3IDIxNCwyMTQgMjgzLDE5N0MzNTIsMTgwIDQxOSwxNzIgNDgzLDE3MkM1OTYsMTcyIDY4MSwxOTMgNzM3LDIzNUM3OTMsMjc3IDgyMSwzNDIgODIxLDQzMEM4MjEsNTA4IDc5MCw1NjUgNzI4LDYwMkM2NjYsNjM5IDU2OSw2NTcgNDM2LDY1N2wtMTI3LDBsMCwxOTFsMTI5LDBDNjcxLDg0OCA3ODgsOTI5IDc4OCwxMDkwQzc4OCwxMTUzIDc2OCwxMjAxIDcyNywxMjM1QzY4NiwxMjY5IDYyNiwxMjg2IDU0NywxMjg2QzQ5MiwxMjg2IDQzOCwxMjc4IDM4NywxMjYzQzMzNiwxMjQ3IDI3NSwxMjE2IDIwNSwxMTcxbC0xMTUsMTY0QzIyNCwxNDM0IDM4MCwxNDgzIDU1NywxNDgzQzcwNCwxNDgzIDgxOSwxNDUxIDkwMiwxMzg4Qzk4NSwxMzI1IDEwMjYsMTIzNyAxMDI2LDExMjZ6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiNFxcXCIgaG9yaXotYWR2LXg9XFxcIjExNjlcXFwiIGQ9XFxcIk0xMTMzLDMxOWwtMTk3LDBsMCwtMzE5bC0yMjksMGwwLDMxOWwtNjY4LDBsMCwxODFsNjY4LDk2NmwyMjksMGwwLC05NTJsMTk3LDBNNzA3LDUxNGwwLDM2N0M3MDcsMTAxMiA3MTAsMTExOSA3MTcsMTIwMmwtOCwwQzY5MCwxMTU4IDY2MSwxMTA1IDYyMSwxMDQybC0zNjMsLTUyOHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI1XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTU4Niw5MTNDNzMzLDkxMyA4NTAsODc0IDkzNiw3OTZDMTAyMiw3MTggMTA2NSw2MTIgMTA2NSw0NzdDMTA2NSwzMjEgMTAxNiwxOTkgOTE5LDExMkM4MjEsMjQgNjgyLC0yMCA1MDIsLTIwQzMzOSwtMjAgMjEwLDYgMTE3LDU5bDAsMjEzQzE3MSwyNDEgMjMzLDIxOCAzMDMsMjAxQzM3MywxODQgNDM4LDE3NiA0OTgsMTc2QzYwNCwxNzYgNjg1LDIwMCA3NDAsMjQ3Qzc5NSwyOTQgODIzLDM2NCA4MjMsNDU1QzgyMyw2MzAgNzEyLDcxNyA0ODksNzE3QzQ1OCw3MTcgNDE5LDcxNCAzNzMsNzA4QzMyNyw3MDEgMjg3LDY5NCAyNTIsNjg2bC0xMDUsNjJsNTYsNzE0bDc2MCwwbDAsLTIwOWwtNTUzLDBsLTMzLC0zNjJDNDAwLDg5NSA0MjksOTAwIDQ2Myw5MDVDNDk2LDkxMCA1MzcsOTEzIDU4Niw5MTN6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiNlxcXCIgaG9yaXotYWR2LXg9XFxcIjExNjlcXFwiIGQ9XFxcIk05NCw2MjNDOTQsMTE5NSAzMjcsMTQ4MSA3OTMsMTQ4MUM4NjYsMTQ4MSA5MjgsMTQ3NSA5NzksMTQ2NGwwLC0xOTZDOTI4LDEyODMgODcwLDEyOTAgODAzLDEyOTBDNjQ2LDEyOTAgNTI5LDEyNDggNDUwLDExNjRDMzcxLDEwODAgMzI5LDk0NSAzMjIsNzYwbDEyLDBDMzY1LDgxNCA0MDksODU2IDQ2Niw4ODZDNTIzLDkxNSA1ODksOTMwIDY2Niw5MzBDNzk5LDkzMCA5MDIsODg5IDk3Niw4MDhDMTA1MCw3MjcgMTA4Nyw2MTYgMTA4Nyw0NzdDMTA4NywzMjQgMTA0NCwyMDMgOTU5LDExNEM4NzMsMjUgNzU2LC0yMCA2MDgsLTIwQzUwMywtMjAgNDEyLDUgMzM1LDU2QzI1OCwxMDYgMTk4LDE3OSAxNTcsMjc2QzExNSwzNzIgOTQsNDg4IDk0LDYyM002MDQsMTc0QzY4NSwxNzQgNzQ3LDIwMCA3OTEsMjUyQzgzNCwzMDQgODU2LDM3OCA4NTYsNDc1Qzg1Niw1NTkgODM2LDYyNSA3OTUsNjczQzc1NCw3MjEgNjkyLDc0NSA2MTAsNzQ1QzU1OSw3NDUgNTEzLDczNCA0NzAsNzEzQzQyNyw2OTEgMzk0LDY2MSAzNjksNjI0QzM0NCw1ODYgMzMyLDU0NyAzMzIsNTA4QzMzMiw0MTQgMzU4LDMzNSA0MDksMjcxQzQ2MCwyMDYgNTI1LDE3NCA2MDQsMTc0elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIjdcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNMjU2LDBsNTc4LDEyNTNsLTc2MCwwbDAsMjA3bDEwMTEsMGwwLC0xNjRsLTU3NSwtMTI5NnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI4XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTU4NCwxNDgxQzcyMywxNDgxIDgzMiwxNDQ5IDkxMywxMzg2Qzk5NCwxMzIyIDEwMzQsMTIzNyAxMDM0LDExMzBDMTAzNCw5ODAgOTQ0LDg2MSA3NjQsNzcyQzg3OSw3MTUgOTYwLDY1NCAxMDA5LDU5MUMxMDU3LDUyOCAxMDgxLDQ1NyAxMDgxLDM3OUMxMDgxLDI1OCAxMDM3LDE2MiA5NDgsODlDODU5LDE2IDczOSwtMjAgNTg4LC0yMEM0MjksLTIwIDMwNiwxNCAyMTksODJDMTMyLDE1MCA4OCwyNDYgODgsMzcxQzg4LDQ1MiAxMTEsNTI2IDE1Nyw1OTFDMjAyLDY1NiAyNzcsNzEzIDM4MSw3NjRDMjkyLDgxNyAyMjgsODc0IDE5MCw5MzNDMTUyLDk5MiAxMzMsMTA1OSAxMzMsMTEzM0MxMzMsMTIzOSAxNzUsMTMyNCAyNTgsMTM4N0MzNDEsMTQ1MCA0NTAsMTQ4MSA1ODQsMTQ4MU0zMTMsMzc5QzMxMywzMTAgMzM3LDI1NiAzODYsMjE4QzQzNSwxNzkgNTAxLDE2MCA1ODQsMTYwQzY3MCwxNjAgNzM3LDE4MCA3ODUsMjIwQzgzMiwyNTkgODU2LDMxMyA4NTYsMzgxQzg1Niw0MzUgODM0LDQ4NCA3OTAsNTI5Qzc0Niw1NzQgNjc5LDYxNSA1OTAsNjUzbC0yOSwxM0M0NzMsNjI3IDQxMCw1ODUgMzcxLDUzOUMzMzIsNDkyIDMxMyw0MzkgMzEzLDM3OU01ODIsMTMwMEM1MTUsMTMwMCA0NjIsMTI4NCA0MjEsMTI1MUMzODAsMTIxOCAzNjAsMTE3MyAzNjAsMTExNkMzNjAsMTA4MSAzNjcsMTA1MCAzODIsMTAyM0MzOTcsOTk2IDQxOCw5NzEgNDQ2LDk0OUM0NzQsOTI2IDUyMSw4OTkgNTg4LDg2OEM2NjgsOTAzIDcyNSw5NDEgNzU4LDk4MEM3OTEsMTAxOSA4MDcsMTA2NCA4MDcsMTExNkM4MDcsMTE3MyA3ODcsMTIxOCA3NDYsMTI1MUM3MDUsMTI4NCA2NTAsMTMwMCA1ODIsMTMwMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI5XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTEwNzksODM4QzEwNzksNTUwIDEwMjEsMzM1IDkwNSwxOTNDNzg5LDUxIDYxNCwtMjAgMzgxLC0yMEMyOTIsLTIwIDIyOSwtMTUgMTkwLC00bDAsMTk3QzI0OSwxNzYgMzA5LDE2OCAzNjksMTY4QzUyOCwxNjggNjQ2LDIxMSA3MjQsMjk2QzgwMiwzODEgODQ1LDUxNSA4NTIsNjk4bC0xMiwwQzgwMSw2MzggNzUzLDU5NSA2OTgsNTY4QzY0Miw1NDEgNTc3LDUyOCA1MDIsNTI4QzM3Myw1MjggMjcxLDU2OCAxOTcsNjQ5QzEyMyw3MzAgODYsODQwIDg2LDk4MUM4NiwxMTM0IDEyOSwxMjU1IDIxNSwxMzQ2QzMwMCwxNDM2IDQxNywxNDgxIDU2NSwxNDgxQzY2OSwxNDgxIDc2MCwxNDU2IDgzNywxNDA1QzkxNCwxMzU0IDk3NCwxMjgxIDEwMTYsMTE4NUMxMDU4LDEwODggMTA3OSw5NzMgMTA3OSw4MzhNNTY5LDEyODZDNDg4LDEyODYgNDI1LDEyNjAgMzgyLDEyMDdDMzM5LDExNTQgMzE3LDEwNzkgMzE3LDk4M0MzMTcsOTAwIDMzNyw4MzQgMzc4LDc4N0M0MTgsNzM5IDQ3OSw3MTUgNTYxLDcxNUM2NDAsNzE1IDcwNyw3MzkgNzYxLDc4NkM4MTUsODMzIDg0Miw4ODkgODQyLDk1MkM4NDIsMTAxMSA4MzEsMTA2NyA4MDgsMTExOUM3ODUsMTE3MCA3NTIsMTIxMSA3MTEsMTI0MUM2NzAsMTI3MSA2MjIsMTI4NiA1NjksMTI4NnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI6XFxcIiBob3Jpei1hZHYteD1cXFwiNTYzXFxcIiBkPVxcXCJNMTMzLDEyNUMxMzMsMTc0IDE0NiwyMTEgMTcxLDIzN0MxOTYsMjYzIDIzMywyNzYgMjgxLDI3NkMzMzAsMjc2IDM2NywyNjMgMzkyLDIzNkM0MTcsMjA5IDQzMCwxNzIgNDMwLDEyNUM0MzAsNzggNDE3LDQwIDM5MiwxM0MzNjYsLTE1IDMyOSwtMjkgMjgxLC0yOUMyMzMsLTI5IDE5NiwtMTUgMTcxLDEyQzE0NiwzOSAxMzMsNzcgMTMzLDEyNU0xMzMsOTc5QzEzMywxMDgwIDE4MiwxMTMwIDI4MSwxMTMwQzMzMSwxMTMwIDM2OCwxMTE3IDM5MywxMDkwQzQxOCwxMDYzIDQzMCwxMDI2IDQzMCw5NzlDNDMwLDkzMiA0MTcsODk0IDM5Miw4NjdDMzY2LDgzOSAzMjksODI1IDI4MSw4MjVDMjMzLDgyNSAxOTYsODM5IDE3MSw4NjZDMTQ2LDg5MyAxMzMsOTMxIDEzMyw5Nzl6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiO1xcXCIgaG9yaXotYWR2LXg9XFxcIjU2OVxcXCIgZD1cXFwiTTM5NywyMzhsMTUsLTIzQzM4MCw5MSAzMjEsLTY5IDIzNiwtMjY0bC0xNzMsMEMxMDksLTg0IDE0Myw4MyAxNjYsMjM4TTEzMSw5NzlDMTMxLDEwODAgMTgwLDExMzAgMjc5LDExMzBDMzI5LDExMzAgMzY2LDExMTcgMzkxLDEwOTBDNDE2LDEwNjMgNDI4LDEwMjYgNDI4LDk3OUM0MjgsOTMyIDQxNSw4OTQgMzkwLDg2N0MzNjQsODM5IDMyNyw4MjUgMjc5LDgyNUMyMzEsODI1IDE5NCw4MzkgMTY5LDg2NkMxNDQsODkzIDEzMSw5MzEgMTMxLDk3OXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImbHQ7XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTEwNzMsMjIxbC05NzcsNDMwbDAsMTIxbDk3Nyw0ODhsMCwtMTk1bC03MzMsLTM0NGw3MzMsLTMwM3pcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI9XFxcIiBob3Jpei1hZHYteD1cXFwiMTE2OVxcXCIgZD1cXFwiTTEwMiw4MzFsMCwxNzlsOTYzLDBsMCwtMTc5TTEwMiw0MzJsMCwxNzhsOTYzLDBsMCwtMTc4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiZndDtcXFwiIGhvcml6LWFkdi14PVxcXCIxMTY5XFxcIiBkPVxcXCJNOTYsNDE4bDczMywzMDNsLTczMywzNDRsMCwxOTVsOTc3LC00ODhsMCwtMTIxbC05NzcsLTQzMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCI/XFxcIiBob3Jpei1hZHYteD1cXFwiOTI4XFxcIiBkPVxcXCJNMjgzLDQ0NGwwLDY0QzI4Myw1ODEgMjk2LDY0MiAzMjMsNjkxQzM1MCw3NDAgMzk2LDc5MCA0NjMsODQyQzU0Miw5MDUgNTk0LDk1MyA2MTcsOTg4QzY0MCwxMDIzIDY1MSwxMDY0IDY1MSwxMTEyQzY1MSwxMTY4IDYzMiwxMjExIDU5NSwxMjQxQzU1OCwxMjcxIDUwNCwxMjg2IDQzNCwxMjg2QzM3MSwxMjg2IDMxMiwxMjc3IDI1OCwxMjU5QzIwNCwxMjQxIDE1MSwxMjE5IDEwMCwxMTk0bC04NCwxNzZDMTUxLDE0NDUgMjk2LDE0ODMgNDUxLDE0ODNDNTgyLDE0ODMgNjg1LDE0NTEgNzYyLDEzODdDODM5LDEzMjMgODc3LDEyMzUgODc3LDExMjJDODc3LDEwNzIgODcwLDEwMjggODU1LDk4OUM4NDAsOTUwIDgxOCw5MTIgNzg5LDg3N0M3NTksODQyIDcwOCw3OTYgNjM1LDczOUM1NzMsNjkwIDUzMiw2NTAgNTExLDYxOEM0OTAsNTg2IDQ3OSw1NDMgNDc5LDQ4OWwwLC00NU0yNDIsMTI1QzI0MiwyMjYgMjkxLDI3NiAzODksMjc2QzQzNywyNzYgNDc0LDI2MyA0OTksMjM3QzUyNCwyMTAgNTM3LDE3MyA1MzcsMTI1QzUzNyw3OCA1MjQsNDAgNDk5LDEzQzQ3MywtMTUgNDM2LC0yOSAzODksLTI5QzM0MiwtMjkgMzA1LC0xNSAyODAsMTJDMjU1LDM5IDI0Miw3NiAyNDIsMTI1elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIkBcXFwiIGhvcml6LWFkdi14PVxcXCIxODM5XFxcIiBkPVxcXCJNMTcyNiw3MzlDMTcyNiw2NDQgMTcxMSw1NTcgMTY4MSw0NzhDMTY1MSwzOTkgMTYwOSwzMzcgMTU1NSwyOTNDMTUwMCwyNDkgMTQzNywyMjcgMTM2NiwyMjdDMTMxMywyMjcgMTI2OCwyNDEgMTIyOSwyNjlDMTE5MCwyOTcgMTE2NCwzMzUgMTE1MSwzODNsLTEyLDBDMTEwNiwzMzEgMTA2NiwyOTIgMTAxOCwyNjZDOTcwLDI0MCA5MTYsMjI3IDg1NiwyMjdDNzQ3LDIyNyA2NjIsMjYyIDYwMCwzMzJDNTM3LDQwMiA1MDYsNDk3IDUwNiw2MTZDNTA2LDc1MyA1NDcsODY1IDYzMCw5NTFDNzEzLDEwMzYgODI0LDEwNzkgOTYzLDEwNzlDMTAxNCwxMDc5IDEwNzAsMTA3NSAxMTMyLDEwNjZDMTE5MywxMDU3IDEyNDgsMTA0NCAxMjk2LDEwMjhsLTIyLC00NjVsMCwtMjRDMTI3NCw0MzIgMTMwOSwzNzkgMTM3OCwzNzlDMTQzMSwzNzkgMTQ3Myw0MTMgMTUwNCw0ODFDMTUzNSw1NDkgMTU1MCw2MzYgMTU1MCw3NDFDMTU1MCw4NTUgMTUyNyw5NTUgMTQ4MCwxMDQyQzE0MzMsMTEyOCAxMzY3LDExOTQgMTI4MSwxMjQxQzExOTUsMTI4OCAxMDk2LDEzMTEgOTg1LDEzMTFDODQzLDEzMTEgNzIwLDEyODIgNjE1LDEyMjNDNTEwLDExNjQgNDI5LDEwODEgMzc0LDk3MkMzMTksODYzIDI5MSw3MzYgMjkxLDU5MkMyOTEsMzk5IDM0MywyNTAgNDQ2LDE0NkM1NDksNDIgNjk4LC0xMCA4OTEsLTEwQzEwMzgsLTEwIDExOTIsMjAgMTM1Miw4MGwwLC0xNjRDMTIxMiwtMTQxIDEwNjAsLTE3MCA4OTUsLTE3MEM2NDgsLTE3MCA0NTYsLTEwMyAzMTgsMzBDMTgwLDE2MyAxMTEsMzQ4IDExMSw1ODZDMTExLDc2MCAxNDgsOTE1IDIyMywxMDUxQzI5OCwxMTg2IDQwMSwxMjkwIDUzNCwxMzYyQzY2NiwxNDM0IDgxNiwxNDcwIDk4MywxNDcwQzExMjgsMTQ3MCAxMjU3LDE0NDAgMTM3MCwxMzgwQzE0ODMsMTMyMCAxNTcwLDEyMzUgMTYzMywxMTI0QzE2OTUsMTAxMyAxNzI2LDg4NCAxNzI2LDczOU02OTgsNjEyQzY5OCw0NTcgNzU5LDM3OSA4ODEsMzc5QzEwMTAsMzc5IDEwODAsNDc3IDEwOTIsNjcybDEyLDIzOUMxMDYyLDkyMiAxMDE3LDkyOCA5NjksOTI4Qzg4NCw5MjggODE3LDkwMCA3NzAsODQzQzcyMiw3ODYgNjk4LDcwOSA2OTgsNjEyelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIkFcXFwiIGhvcml6LWFkdi14PVxcXCIxMzU0XFxcIiBkPVxcXCJNMTEwMCwwbC0xNDYsNDA2bC01NTksMGwtMTQzLC00MDZsLTI1MiwwbDU0NywxNDY4bDI2MCwwbDU0NywtMTQ2OE04OTEsNjEybC0xMzcsMzk4Qzc0NCwxMDM3IDczMCwxMDc5IDcxMywxMTM2QzY5NSwxMTkzIDY4MywxMjM1IDY3NiwxMjYyQzY1OCwxMTgwIDYzMiwxMDkwIDU5Nyw5OTNsLTEzMiwtMzgxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIkJcXFwiIGhvcml6LWFkdi14PVxcXCIxMzUyXFxcIiBkPVxcXCJNMTkzLDE0NjJsNDM0LDBDODI4LDE0NjIgOTc0LDE0MzMgMTA2NCwxMzc0QzExNTMsMTMxNSAxMTk4LDEyMjMgMTE5OCwxMDk2QzExOTgsMTAxMSAxMTc2LDk0MCAxMTMyLDg4M0MxMDg4LDgyNiAxMDI1LDc5MSA5NDIsNzc2bDAsLTEwQzEwNDUsNzQ3IDExMjAsNzA5IDExNjksNjUyQzEyMTcsNTk1IDEyNDEsNTE3IDEyNDEsNDIwQzEyNDEsMjg5IDExOTUsMTg2IDExMDQsMTEyQzEwMTIsMzcgODg0LDAgNzIxLDBsLTUyOCwwTTQzMiw4NThsMjMwLDBDNzYyLDg1OCA4MzUsODc0IDg4MSw5MDZDOTI3LDkzNyA5NTAsOTkxIDk1MCwxMDY3Qzk1MCwxMTM2IDkyNSwxMTg1IDg3NiwxMjE2QzgyNiwxMjQ3IDc0NywxMjYyIDYzOSwxMjYybC0yMDcsME00MzIsNjY0bDAsLTQ2M2wyNTQsMEM3ODYsMjAxIDg2MiwyMjAgOTEzLDI1OUM5NjQsMjk3IDk4OSwzNTcgOTg5LDQ0MEM5ODksNTE2IDk2Myw1NzIgOTExLDYwOUM4NTksNjQ2IDc4MCw2NjQgNjc0LDY2NHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJDXFxcIiBob3Jpei1hZHYteD1cXFwiMTI5OFxcXCIgZD1cXFwiTTgxNSwxMjc4QzY3OCwxMjc4IDU3MCwxMjI5IDQ5MSwxMTMyQzQxMiwxMDM1IDM3Myw5MDAgMzczLDcyOUMzNzMsNTUwIDQxMSw0MTQgNDg3LDMyMkM1NjIsMjMwIDY3MiwxODQgODE1LDE4NEM4NzcsMTg0IDkzNywxOTAgOTk1LDIwM0MxMDUzLDIxNSAxMTEzLDIzMSAxMTc2LDI1MGwwLC0yMDVDMTA2MSwyIDkzMSwtMjAgNzg2LC0yMEM1NzIsLTIwIDQwOCw0NSAyOTMsMTc1QzE3OCwzMDQgMTIxLDQ5MCAxMjEsNzMxQzEyMSw4ODMgMTQ5LDEwMTYgMjA1LDExMzBDMjYwLDEyNDQgMzQxLDEzMzEgNDQ2LDEzOTJDNTUxLDE0NTMgNjc1LDE0ODMgODE3LDE0ODNDOTY2LDE0ODMgMTEwNCwxNDUyIDEyMzEsMTM4OWwtODYsLTE5OUMxMDk2LDEyMTMgMTA0NCwxMjM0IDk4OSwxMjUyQzkzNCwxMjY5IDg3NiwxMjc4IDgxNSwxMjc4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIkRcXFwiIGhvcml6LWFkdi14PVxcXCIxNTAzXFxcIiBkPVxcXCJNMTM4Miw3NDVDMTM4Miw1MDQgMTMxNSwzMTkgMTE4MSwxOTJDMTA0Nyw2NCA4NTQsMCA2MDIsMGwtNDA5LDBsMCwxNDYybDQ1MiwwQzg3OCwxNDYyIDEwNTksMTM5OSAxMTg4LDEyNzRDMTMxNywxMTQ5IDEzODIsOTcyIDEzODIsNzQ1TTExMzAsNzM3QzExMzAsMTA4NyA5NjYsMTI2MiA2MzksMTI2MmwtMjA3LDBsMCwtMTA2MWwxNzAsMEM5NTQsMjAxIDExMzAsMzgwIDExMzAsNzM3elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIkVcXFwiIGhvcml6LWFkdi14PVxcXCIxMTQzXFxcIiBkPVxcXCJNMTAyMCwwbC04MjcsMGwwLDE0NjJsODI3LDBsMCwtMjAybC01ODgsMGwwLC0zOThsNTUxLDBsMCwtMjAwbC01NTEsMGwwLC00NTlsNTg4LDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiRlxcXCIgaG9yaXotYWR2LXg9XFxcIjEwOTBcXFwiIGQ9XFxcIk00MzAsMGwtMjM3LDBsMCwxNDYybDgyNSwwbDAsLTIwMmwtNTg4LDBsMCwtNDU3bDU1MSwwbDAsLTIwM2wtNTUxLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiR1xcXCIgaG9yaXotYWR2LXg9XFxcIjE0ODdcXFwiIGQ9XFxcIk03OTEsNzkzbDUzOCwwbDAsLTczNEMxMjQxLDMwIDExNTcsMTAgMTA3NiwtMkM5OTUsLTE0IDkwNywtMjAgODEzLC0yMEM1OTIsLTIwIDQyMSw0NiAzMDEsMTc3QzE4MSwzMDggMTIxLDQ5MiAxMjEsNzMxQzEyMSw5NjYgMTg5LDExNTEgMzI0LDEyODRDNDU5LDE0MTcgNjQ2LDE0ODMgODgzLDE0ODNDMTAzNiwxNDgzIDExODAsMTQ1NCAxMzE3LDEzOTVsLTg0LC0xOTlDMTExNCwxMjUxIDk5NiwxMjc4IDg3NywxMjc4QzcyMSwxMjc4IDU5OCwxMjI5IDUwNywxMTMxQzQxNiwxMDMzIDM3MSw4OTkgMzcxLDcyOUMzNzEsNTUwIDQxMiw0MTUgNDk0LDMyMkM1NzUsMjI5IDY5MywxODIgODQ2LDE4MkM5MjMsMTgyIDEwMDYsMTkyIDEwOTQsMjExbDAsMzc3bC0zMDMsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJIXFxcIiBob3Jpei1hZHYteD1cXFwiMTUzOFxcXCIgZD1cXFwiTTEzNDYsMGwtMjQwLDBsMCw2NTlsLTY3NCwwbDAsLTY1OWwtMjM5LDBsMCwxNDYybDIzOSwwbDAsLTU5OGw2NzQsMGwwLDU5OGwyNDAsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJKXFxcIiBob3Jpei1hZHYteD1cXFwiNjEyXFxcIiBkPVxcXCJNOCwtNDA4Qy01NywtNDA4IC0xMTIsLTQwMCAtMTU2LC0zODNsMCwyMDFDLTEwMCwtMTk2IC01MSwtMjAzIC0xMCwtMjAzQzEyMSwtMjAzIDE4NiwtMTIwIDE4Niw0NWwwLDE0MTdsMjQwLDBsMCwtMTQwOUM0MjYsLTk2IDM5MSwtMjEwIDMyMCwtMjg5QzI0OSwtMzY4IDE0NSwtNDA4IDgsLTQwOHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJLXFxcIiBob3Jpei1hZHYteD1cXFwiMTMwOVxcXCIgZD1cXFwiTTEzMDksMGwtMjc3LDBsLTQ1OSw2NjJsLTE0MSwtMTE1bDAsLTU0N2wtMjM5LDBsMCwxNDYybDIzOSwwbDAsLTY5OEM0OTcsODQ0IDU2Miw5MjEgNjI3LDk5NWwzOTUsNDY3bDI3MiwwQzEwMzksMTE2MiA4NTYsOTQ4IDc0NSw4MjF6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiTFxcXCIgaG9yaXotYWR2LXg9XFxcIjExMTBcXFwiIGQ9XFxcIk0xOTMsMGwwLDE0NjJsMjM5LDBsMCwtMTI1N2w2MTksMGwwLC0yMDV6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiTVxcXCIgaG9yaXotYWR2LXg9XFxcIjE4OTBcXFwiIGQ9XFxcIk04MjUsMGwtNDI0LDEyMjFsLTgsMEM0MDQsMTA0MCA0MTAsODcwIDQxMCw3MTFsMCwtNzExbC0yMTcsMGwwLDE0NjJsMzM3LDBsNDA2LC0xMTYzbDYsMGw0MTgsMTE2M2wzMzgsMGwwLC0xNDYybC0yMzAsMGwwLDcyM0MxNDY4LDc5NiAxNDcwLDg5MCAxNDc0LDEwMDdDMTQ3NywxMTI0IDE0ODAsMTE5NCAxNDgzLDEyMTlsLTgsMGwtNDM5LC0xMjE5elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIk5cXFwiIGhvcml6LWFkdi14PVxcXCIxNjA0XFxcIiBkPVxcXCJNMTQxMSwwbC0yOTMsMGwtNzE5LDExNjVsLTgsMGw1LC02NUM0MDUsOTc2IDQxMCw4NjMgNDEwLDc2MGwwLC03NjBsLTIxNywwbDAsMTQ2MmwyOTAsMGw3MTcsLTExNTlsNiwwQzEyMDUsMzE4IDEyMDIsMzc0IDExOTgsNDcxQzExOTQsNTY3IDExOTIsNjQyIDExOTIsNjk2bDAsNzY2bDIxOSwwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIk9cXFwiIGhvcml6LWFkdi14PVxcXCIxNjEyXFxcIiBkPVxcXCJNMTQ5MSw3MzNDMTQ5MSw0OTUgMTQzMiwzMTAgMTMxMywxNzhDMTE5NCw0NiAxMDI1LC0yMCA4MDcsLTIwQzU4NiwtMjAgNDE3LDQ2IDI5OSwxNzdDMTgwLDMwOCAxMjEsNDk0IDEyMSw3MzVDMTIxLDk3NiAxODEsMTE2MiAzMDAsMTI5MUM0MTksMTQyMCA1ODgsMTQ4NSA4MDksMTQ4NUMxMDI2LDE0ODUgMTE5NCwxNDE5IDEzMTMsMTI4OEMxNDMyLDExNTcgMTQ5MSw5NzIgMTQ5MSw3MzNNMzc1LDczM0MzNzUsNTUzIDQxMSw0MTcgNDg0LDMyNEM1NTcsMjMxIDY2NCwxODQgODA3LDE4NEM5NDksMTg0IDEwNTYsMjMwIDExMjksMzIyQzEyMDEsNDE0IDEyMzcsNTUxIDEyMzcsNzMzQzEyMzcsOTEyIDEyMDEsMTA0OCAxMTMwLDExNDFDMTA1OCwxMjM0IDk1MSwxMjgwIDgwOSwxMjgwQzY2NiwxMjgwIDU1OCwxMjM0IDQ4NSwxMTQxQzQxMiwxMDQ4IDM3NSw5MTIgMzc1LDczM3pcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJQXFxcIiBob3Jpei1hZHYteD1cXFwiMTI2MFxcXCIgZD1cXFwiTTExNjEsMTAyMEMxMTYxLDg2NyAxMTExLDc1MCAxMDExLDY2OUM5MTEsNTg4IDc2OSw1NDcgNTg0LDU0N2wtMTUyLDBsMCwtNTQ3bC0yMzksMGwwLDE0NjJsNDIxLDBDNzk3LDE0NjIgOTM0LDE0MjUgMTAyNSwxMzUwQzExMTYsMTI3NSAxMTYxLDExNjUgMTE2MSwxMDIwTTQzMiw3NDhsMTI3LDBDNjgyLDc0OCA3NzIsNzY5IDgyOSw4MTJDODg2LDg1NSA5MTUsOTIxIDkxNSwxMDEyQzkxNSwxMDk2IDg4OSwxMTU5IDgzOCwxMjAwQzc4NywxMjQxIDcwNywxMjYyIDU5OCwxMjYybC0xNjYsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJRXFxcIiBob3Jpei1hZHYteD1cXFwiMTYxMlxcXCIgZD1cXFwiTTE0OTEsNzMzQzE0OTEsNTU2IDE0NTcsNDA2IDEzOTAsMjg1QzEzMjIsMTY0IDEyMjMsNzggMTA5NCwyOWwzNTAsLTM3N2wtMzIyLDBsLTI3NiwzMjhsLTM5LDBDNTg2LC0yMCA0MTcsNDYgMjk5LDE3N0MxODAsMzA4IDEyMSw0OTQgMTIxLDczNUMxMjEsOTc2IDE4MSwxMTYyIDMwMCwxMjkxQzQxOSwxNDIwIDU4OCwxNDg1IDgwOSwxNDg1QzEwMjYsMTQ4NSAxMTk0LDE0MTkgMTMxMywxMjg4QzE0MzIsMTE1NyAxNDkxLDk3MiAxNDkxLDczM00zNzUsNzMzQzM3NSw1NTMgNDExLDQxNyA0ODQsMzI0QzU1NywyMzEgNjY0LDE4NCA4MDcsMTg0Qzk0OSwxODQgMTA1NiwyMzAgMTEyOSwzMjJDMTIwMSw0MTQgMTIzNyw1NTEgMTIzNyw3MzNDMTIzNyw5MTIgMTIwMSwxMDQ4IDExMzAsMTE0MUMxMDU4LDEyMzQgOTUxLDEyODAgODA5LDEyODBDNjY2LDEyODAgNTU4LDEyMzQgNDg1LDExNDFDNDEyLDEwNDggMzc1LDkxMiAzNzUsNzMzelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIlJcXFwiIGhvcml6LWFkdi14PVxcXCIxMzA5XFxcIiBkPVxcXCJNNDMyLDc4MmwxNjYsMEM3MDksNzgyIDc5MCw4MDMgODQwLDg0NEM4OTAsODg1IDkxNSw5NDcgOTE1LDEwMjhDOTE1LDExMTEgODg4LDExNzAgODM0LDEyMDZDNzgwLDEyNDIgNjk5LDEyNjAgNTkwLDEyNjBsLTE1OCwwTTQzMiw1ODRsMCwtNTg0bC0yMzksMGwwLDE0NjJsNDEzLDBDNzk1LDE0NjIgOTM0LDE0MjcgMTAyNSwxMzU2QzExMTYsMTI4NSAxMTYxLDExNzkgMTE2MSwxMDM2QzExNjEsODU0IDEwNjYsNzI0IDg3Nyw2NDdsNDEzLC02NDdsLTI3MiwwbC0zNTAsNTg0elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIlNcXFwiIGhvcml6LWFkdi14PVxcXCIxMTI2XFxcIiBkPVxcXCJNMTAzNiwzOTdDMTAzNiwyNjcgOTg5LDE2NSA4OTUsOTFDODAxLDE3IDY3MSwtMjAgNTA2LC0yMEMzNDEsLTIwIDIwNSw2IDEwMCw1N2wwLDIyNkMxNjcsMjUyIDIzOCwyMjcgMzEzLDIwOUMzODgsMTkxIDQ1NywxODIgNTIyLDE4MkM2MTcsMTgyIDY4NywyMDAgNzMyLDIzNkM3NzcsMjcyIDc5OSwzMjAgNzk5LDM4MUM3OTksNDM2IDc3OCw0ODIgNzM3LDUyMEM2OTYsNTU4IDYxMCw2MDMgNDgxLDY1NUMzNDgsNzA5IDI1NCw3NzEgMTk5LDg0MEMxNDQsOTA5IDExNyw5OTMgMTE3LDEwOTBDMTE3LDEyMTIgMTYwLDEzMDggMjQ3LDEzNzhDMzM0LDE0NDggNDUwLDE0ODMgNTk2LDE0ODNDNzM2LDE0ODMgODc1LDE0NTIgMTAxNCwxMzkxbC03NiwtMTk1QzgwOCwxMjUxIDY5MiwxMjc4IDU5MCwxMjc4QzUxMywxMjc4IDQ1NCwxMjYxIDQxNCwxMjI4QzM3NCwxMTk0IDM1NCwxMTQ5IDM1NCwxMDk0QzM1NCwxMDU2IDM2MiwxMDI0IDM3OCw5OTdDMzk0LDk3MCA0MjAsOTQ0IDQ1Nyw5MjBDNDk0LDg5NiA1NjAsODY0IDY1NSw4MjVDNzYyLDc4MCA4NDEsNzM5IDg5MSw3MDBDOTQxLDY2MSA5NzgsNjE4IDEwMDEsNTY5QzEwMjQsNTIwIDEwMzYsNDYzIDEwMzYsMzk3elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIlRcXFwiIGhvcml6LWFkdi14PVxcXCIxMTU5XFxcIiBkPVxcXCJNNjk4LDBsLTIzOSwwbDAsMTI1N2wtNDMwLDBsMCwyMDVsMTA5OSwwbDAsLTIwNWwtNDMwLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiVVxcXCIgaG9yaXotYWR2LXg9XFxcIjE1MjBcXFwiIGQ9XFxcIk0xMzM5LDE0NjJsMCwtOTQ2QzEzMzksNDA4IDEzMTYsMzE0IDEyNzAsMjMzQzEyMjMsMTUyIDExNTYsODkgMTA2OSw0NkM5ODEsMiA4NzYsLTIwIDc1NCwtMjBDNTczLC0yMCA0MzIsMjggMzMxLDEyNEMyMzAsMjIwIDE4MCwzNTIgMTgwLDUyMGwwLDk0MmwyNDAsMGwwLC05MjVDNDIwLDQxNiA0NDgsMzI3IDUwNCwyNzBDNTYwLDIxMyA2NDYsMTg0IDc2MiwxODRDOTg3LDE4NCAxMTAwLDMwMiAxMTAwLDUzOWwwLDkyM3pcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJWXFxcIiBob3Jpei1hZHYteD1cXFwiMTI3NFxcXCIgZD1cXFwiTTEwMjYsMTQ2MmwyNDgsMGwtNTEyLC0xNDYybC0yNTIsMGwtNTEwLDE0NjJsMjQ2LDBsMzA1LC05MDlDNTY3LDUxMCA1ODQsNDU0IDYwMiwzODZDNjIwLDMxNyA2MzIsMjY2IDYzNywyMzNDNjQ2LDI4NCA2NTksMzQyIDY3Nyw0MDlDNjk1LDQ3NiA3MTAsNTI1IDcyMSw1NTd6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiV1xcXCIgaG9yaXotYWR2LXg9XFxcIjE5MzdcXFwiIGQ9XFxcIk0xNTQyLDBsLTI2MCwwbC0yNDgsODcyQzEwMjMsOTEwIDEwMTAsOTY1IDk5NCwxMDM3Qzk3OCwxMTA4IDk2OCwxMTU4IDk2NSwxMTg2Qzk1OCwxMTQzIDk0OCwxMDg4IDkzMywxMDIwQzkxOCw5NTIgOTA1LDkwMSA4OTUsODY4bC0yNDIsLTg2OGwtMjYwLDBsLTE4OSw3MzJsLTE5Miw3MzBsMjQ0LDBsMjA5LC04NTJDNDk4LDQ3MyA1MjEsMzUzIDUzNSwyNDhDNTQyLDMwNSA1NTMsMzY4IDU2OCw0MzhDNTgzLDUwOCA1OTYsNTY1IDYwOCw2MDhsMjM4LDg1NGwyMzcsMGwyNDQsLTg1OEMxMzUwLDUyNSAxMzc1LDQwNiAxNDAxLDI0OEMxNDExLDM0MyAxNDM1LDQ2NSAxNDczLDYxMmwyMDgsODUwbDI0MiwwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIlhcXFwiIGhvcml6LWFkdi14PVxcXCIxMjc0XFxcIiBkPVxcXCJNMTI3MCwwbC0yNzUsMGwtMzY2LDU5OGwtMzY5LC01OThsLTI1NiwwbDQ4NSw3NThsLTQ1NCw3MDRsMjY2LDBsMzM4LC01NTNsMzM4LDU1M2wyNTgsMGwtNDU3LC03MDh6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiWVxcXCIgaG9yaXotYWR2LXg9XFxcIjEyMTJcXFwiIGQ9XFxcIk02MDYsNzk1bDM0Niw2NjdsMjYwLDBsLTQ4NywtODk1bDAsLTU2N2wtMjQwLDBsMCw1NTlsLTQ4NSw5MDNsMjYwLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiWlxcXCIgaG9yaXotYWR2LXg9XFxcIjExNzhcXFwiIGQ9XFxcIk0xMTEyLDBsLTEwNDYsMGwwLDE2Nmw3MzcsMTA5MWwtNzE3LDBsMCwyMDVsMTAwNiwwbDAsLTE2OGwtNzQwLC0xMDg5bDc2MCwwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIlxcXFxcXFwiIGhvcml6LWFkdi14PVxcXCI3OTlcXFwiIGQ9XFxcIk0yMzgsMTQ2Mmw1NDQsLTE0NjJsLTIyMSwwbC01NDUsMTQ2MnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJeXFxcIiBob3Jpei1hZHYteD1cXFwiMTEwMFxcXCIgZD1cXFwiTTI5LDUzNWw0MzYsOTM1bDEyMSwwbDQ4NSwtOTM1bC0xOTQsMGwtMzQ5LDY5NGwtMzA3LC02OTR6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiX1xcXCIgaG9yaXotYWR2LXg9XFxcIjg3OVxcXCIgZD1cXFwiTTg4MywtMzE5bC04ODcsMGwwLDEzNWw4ODcsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJhXFxcIiBob3Jpei1hZHYteD1cXFwiMTE4OFxcXCIgZD1cXFwiTTg2MCwwbC00NywxNTRsLTgsMEM3NTIsODcgNjk4LDQxIDY0NCwxN0M1OTAsLTggNTIxLC0yMCA0MzYsLTIwQzMyNywtMjAgMjQzLDkgMTgyLDY4QzEyMSwxMjcgOTAsMjEwIDkwLDMxN0M5MCw0MzEgMTMyLDUxNyAyMTcsNTc1QzMwMiw2MzMgNDMxLDY2NSA2MDQsNjcwbDE5MSw2bDAsNTlDNzk1LDgwNiA3NzksODU5IDc0Niw4OTRDNzEzLDkyOSA2NjEsOTQ2IDU5Miw5NDZDNTM1LDk0NiA0ODEsOTM4IDQyOSw5MjFDMzc3LDkwNCAzMjcsODg1IDI3OSw4NjJsLTc2LDE2OEMyNjMsMTA2MSAzMjksMTA4NSA0MDAsMTEwMkM0NzEsMTExOCA1MzksMTEyNiA2MDIsMTEyNkM3NDMsMTEyNiA4NDksMTA5NSA5MjEsMTAzNEM5OTIsOTczIDEwMjgsODc2IDEwMjgsNzQ1bDAsLTc0NU01MTAsMTYwQzU5NSwxNjAgNjY0LDE4NCA3MTYsMjMyQzc2NywyNzkgNzkzLDM0NiA3OTMsNDMybDAsOTZsLTE0MiwtNkM1NDAsNTE4IDQ2MCw1MDAgNDEwLDQ2N0MzNTksNDM0IDMzNCwzODMgMzM0LDMxNUMzMzQsMjY2IDM0OSwyMjggMzc4LDIwMUM0MDcsMTc0IDQ1MSwxNjAgNTEwLDE2MHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJiXFxcIiBob3Jpei1hZHYteD1cXFwiMTI3NlxcXCIgZD1cXFwiTTczMywxMTI2Qzg3MSwxMTI2IDk3OSwxMDc2IDEwNTYsOTc2QzExMzMsODc2IDExNzEsNzM2IDExNzEsNTU1QzExNzEsMzc0IDExMzIsMjMzIDEwNTQsMTMyQzk3NiwzMSA4NjgsLTIwIDcyOSwtMjBDNTg5LC0yMCA0ODAsMzAgNDAzLDEzMWwtMTYsMGwtNDMsLTEzMWwtMTc2LDBsMCwxNTU2bDIzNSwwbDAsLTM3MEM0MDMsMTE1OSA0MDIsMTExOCAzOTksMTA2NEMzOTYsMTAxMCAzOTQsOTc2IDM5Myw5NjFsMTAsMEM0NzgsMTA3MSA1ODgsMTEyNiA3MzMsMTEyNk02NzIsOTM0QzU3Nyw5MzQgNTA5LDkwNiA0NjgsODUxQzQyNiw3OTUgNDA0LDcwMiA0MDMsNTcxbDAsLTE2QzQwMyw0MjAgNDI0LDMyMyA0NjcsMjYzQzUxMCwyMDIgNTc5LDE3MiA2NzYsMTcyQzc1OSwxNzIgODIzLDIwNSA4NjYsMjcxQzkwOSwzMzcgOTMwLDQzMiA5MzAsNTU3QzkzMCw4MDggODQ0LDkzNCA2NzIsOTM0elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImNcXFwiIGhvcml6LWFkdi14PVxcXCIxMDE0XFxcIiBkPVxcXCJNNjE0LC0yMEM0NDcsLTIwIDMyMCwyOSAyMzMsMTI3QzE0NiwyMjQgMTAyLDM2NCAxMDIsNTQ3QzEwMiw3MzMgMTQ4LDg3NiAyMzksOTc2QzMzMCwxMDc2IDQ2MSwxMTI2IDYzMywxMTI2Qzc1MCwxMTI2IDg1NSwxMTA0IDk0OCwxMDYxbC03MSwtMTg5Qzc3OCw5MTEgNjk2LDkzMCA2MzEsOTMwQzQ0MCw5MzAgMzQ0LDgwMyAzNDQsNTQ5QzM0NCw0MjUgMzY4LDMzMiA0MTYsMjcwQzQ2MywyMDcgNTMzLDE3NiA2MjUsMTc2QzczMCwxNzYgODI5LDIwMiA5MjIsMjU0bDAsLTIwNUM4ODAsMjQgODM1LDcgNzg4LC00Qzc0MCwtMTUgNjgyLC0yMCA2MTQsLTIwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImRcXFwiIGhvcml6LWFkdi14PVxcXCIxMjc2XFxcIiBkPVxcXCJNNTQxLC0yMEM0MDMsLTIwIDI5NSwzMCAyMTgsMTMwQzE0MSwyMzAgMTAyLDM3MCAxMDIsNTUxQzEwMiw3MzIgMTQxLDg3NCAyMjAsOTc1QzI5OCwxMDc2IDQwNiwxMTI2IDU0NSwxMTI2QzY5MCwxMTI2IDgwMSwxMDcyIDg3Nyw5NjVsMTIsMEM4NzgsMTA0NCA4NzIsMTEwNyA4NzIsMTE1M2wwLDQwM2wyMzYsMGwwLC0xNTU2bC0xODQsMGwtNDEsMTQ1bC0xMSwwQzc5NywzNSA2ODYsLTIwIDU0MSwtMjBNNjA0LDE3MEM3MDEsMTcwIDc3MSwxOTcgODE1LDI1MkM4NTksMzA2IDg4MiwzOTQgODgzLDUxNmwwLDMzQzg4Myw2ODggODYwLDc4NyA4MTUsODQ2Qzc3MCw5MDUgNjk5LDkzNCA2MDIsOTM0QzUxOSw5MzQgNDU2LDkwMSA0MTEsODM0QzM2Niw3NjcgMzQ0LDY3MSAzNDQsNTQ3QzM0NCw0MjQgMzY2LDMzMSA0MDksMjY3QzQ1MiwyMDIgNTE3LDE3MCA2MDQsMTcwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImVcXFwiIGhvcml6LWFkdi14PVxcXCIxMTgwXFxcIiBkPVxcXCJNNjUxLC0yMEM0NzksLTIwIDM0NSwzMCAyNDgsMTMxQzE1MSwyMzEgMTAyLDM2OSAxMDIsNTQ1QzEwMiw3MjYgMTQ3LDg2OCAyMzcsOTcxQzMyNywxMDc0IDQ1MSwxMTI2IDYwOCwxMTI2Qzc1NCwxMTI2IDg2OSwxMDgyIDk1NCw5OTNDMTAzOSw5MDQgMTA4MSw3ODIgMTA4MSw2MjdsMCwtMTI3bC03MzcsMEMzNDcsMzkzIDM3NiwzMTAgNDMxLDI1M0M0ODYsMTk1IDU2MywxNjYgNjYyLDE2NkM3MjcsMTY2IDc4OCwxNzIgODQ1LDE4NUM5MDEsMTk3IDk2MSwyMTcgMTAyNiwyNDZsMCwtMTkxQzk2OSwyOCA5MTEsOCA4NTIsLTNDNzkzLC0xNCA3MjYsLTIwIDY1MSwtMjBNNjA4LDk0OEM1MzMsOTQ4IDQ3NCw5MjQgNDI5LDg3N0MzODQsODMwIDM1Nyw3NjEgMzQ4LDY3MGw1MDIsMEM4NDksNzYxIDgyNyw4MzEgNzg0LDg3OEM3NDEsOTI1IDY4Myw5NDggNjA4LDk0OHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJmXFxcIiBob3Jpei1hZHYteD1cXFwiNzQzXFxcIiBkPVxcXCJNNzIzLDkyOGwtMjcwLDBsMCwtOTI4bC0yMzYsMGwwLDkyOGwtMTgyLDBsMCwxMTBsMTgyLDcybDAsNzJDMjE3LDEzMTMgMjQ4LDE0MTAgMzA5LDE0NzNDMzcwLDE1MzYgNDY0LDE1NjcgNTkwLDE1NjdDNjczLDE1NjcgNzU0LDE1NTMgODM0LDE1MjZsLTYyLC0xNzhDNzE0LDEzNjcgNjU5LDEzNzYgNjA2LDEzNzZDNTUzLDEzNzYgNTE0LDEzNjAgNDkwLDEzMjdDNDY1LDEyOTQgNDUzLDEyNDQgNDUzLDExNzhsMCwtNzJsMjcwLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiZ1xcXCIgaG9yaXotYWR2LXg9XFxcIjExMzlcXFwiIGQ9XFxcIk0xMTAyLDExMDZsMCwtMTI5bC0xODksLTM1QzkzMCw5MTkgOTQ1LDg5MCA5NTYsODU2Qzk2Nyw4MjIgOTczLDc4NiA5NzMsNzQ4Qzk3Myw2MzQgOTM0LDU0NCA4NTUsNDc5Qzc3Niw0MTQgNjY4LDM4MSA1MzAsMzgxQzQ5NSwzODEgNDYzLDM4NCA0MzQsMzg5QzM4MywzNTggMzU4LDMyMSAzNTgsMjc5QzM1OCwyNTQgMzcwLDIzNSAzOTQsMjIyQzQxNywyMDkgNDYxLDIwMyA1MjQsMjAzbDE5MywwQzgzOSwyMDMgOTMyLDE3NyA5OTUsMTI1QzEwNTgsNzMgMTA5MCwtMiAxMDkwLC0xMDBDMTA5MCwtMjI1IDEwMzgsLTMyMiA5MzUsLTM5MEM4MzIsLTQ1OCA2ODIsLTQ5MiA0ODcsLTQ5MkMzMzYsLTQ5MiAyMjEsLTQ2NSAxNDIsLTQxMkM2MywtMzU5IDIzLC0yODMgMjMsLTE4NEMyMywtMTE2IDQ1LC01OSA4OCwtMTJDMTMxLDM0IDE5MSw2NiAyNjgsODRDMjM3LDk3IDIxMSwxMTkgMTkxLDE0OUMxNzAsMTc4IDE2MCwyMDkgMTYwLDI0MkMxNjAsMjgzIDE3MiwzMTggMTk1LDM0N0MyMTgsMzc2IDI1Myw0MDQgMjk5LDQzMkMyNDIsNDU3IDE5NSw0OTcgMTYwLDU1M0MxMjQsNjA4IDEwNiw2NzMgMTA2LDc0OEMxMDYsODY4IDE0NCw5NjEgMjIwLDEwMjdDMjk1LDEwOTMgNDAzLDExMjYgNTQzLDExMjZDNTc0LDExMjYgNjA3LDExMjQgNjQyLDExMjBDNjc2LDExMTUgNzAyLDExMTEgNzE5LDExMDZNMjMzLC0xNzJDMjMzLC0yMjMgMjU2LC0yNjIgMzAyLC0yODlDMzQ3LC0zMTYgNDExLC0zMzAgNDk0LC0zMzBDNjIyLC0zMzAgNzE3LC0zMTIgNzgwLC0yNzVDODQzLC0yMzggODc0LC0xOTAgODc0LC0xMjlDODc0LC04MSA4NTcsLTQ3IDgyMywtMjZDNzg4LC02IDcyNCw0IDYzMSw0bC0xNzgsMEMzODYsNCAzMzIsLTEyIDI5MywtNDNDMjUzLC03NSAyMzMsLTExOCAyMzMsLTE3Mk0zMzQsNzQ4QzMzNCw2NzkgMzUyLDYyNSAzODgsNTg4QzQyMyw1NTEgNDc0LDUzMiA1NDEsNTMyQzY3Nyw1MzIgNzQ1LDYwNSA3NDUsNzUwQzc0NSw4MjIgNzI4LDg3OCA2OTUsOTE3QzY2MSw5NTYgNjEwLDk3NSA1NDEsOTc1QzQ3Myw5NzUgNDIyLDk1NiAzODcsOTE3QzM1Miw4NzggMzM0LDgyMiAzMzQsNzQ4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImhcXFwiIGhvcml6LWFkdi14PVxcXCIxMzAwXFxcIiBkPVxcXCJNMTE0MSwwbC0yMzYsMGwwLDY4MEM5MDUsNzY1IDg4OCw4MjkgODU0LDg3MUM4MTksOTEzIDc2NSw5MzQgNjkwLDkzNEM1OTEsOTM0IDUxOSw5MDUgNDczLDg0NkM0MjYsNzg3IDQwMyw2ODggNDAzLDU0OWwwLC01NDlsLTIzNSwwbDAsMTU1NmwyMzUsMGwwLC0zOTVDNDAzLDEwOTggMzk5LDEwMzAgMzkxLDk1OGwxNSwwQzQzOCwxMDExIDQ4MywxMDUzIDU0MCwxMDgyQzU5NywxMTExIDY2MywxMTI2IDczOSwxMTI2QzEwMDcsMTEyNiAxMTQxLDk5MSAxMTQxLDcyMXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJpXFxcIiBob3Jpei1hZHYteD1cXFwiNTcxXFxcIiBkPVxcXCJNNDAzLDBsLTIzNSwwbDAsMTEwNmwyMzUsME0xNTQsMTM5OUMxNTQsMTQ0MSAxNjYsMTQ3MyAxODksMTQ5NkMyMTIsMTUxOSAyNDQsMTUzMCAyODcsMTUzMEMzMjgsMTUzMCAzNjEsMTUxOSAzODQsMTQ5NkM0MDcsMTQ3MyA0MTgsMTQ0MSA0MTgsMTM5OUM0MTgsMTM1OSA0MDcsMTMyOCAzODQsMTMwNUMzNjEsMTI4MiAzMjgsMTI3MCAyODcsMTI3MEMyNDQsMTI3MCAyMTIsMTI4MiAxODksMTMwNUMxNjYsMTMyOCAxNTQsMTM1OSAxNTQsMTM5OXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJqXFxcIiBob3Jpei1hZHYteD1cXFwiNTcxXFxcIiBkPVxcXCJNNTUsLTQ5MkMtMTYsLTQ5MiAtNzQsLTQ4NCAtMTIxLC00NjdsMCwxODZDLTc2LC0yOTMgLTI5LC0yOTkgMTgsLTI5OUMxMTgsLTI5OSAxNjgsLTI0MiAxNjgsLTEyOWwwLDEyMzVsMjM1LDBsMCwtMTI1MUM0MDMsLTI1OSAzNzMsLTM0NSAzMTQsLTQwNEMyNTQsLTQ2MyAxNjgsLTQ5MiA1NSwtNDkyTTE1NCwxMzk5QzE1NCwxNDQxIDE2NiwxNDczIDE4OSwxNDk2QzIxMiwxNTE5IDI0NCwxNTMwIDI4NywxNTMwQzMyOCwxNTMwIDM2MSwxNTE5IDM4NCwxNDk2QzQwNywxNDczIDQxOCwxNDQxIDQxOCwxMzk5QzQxOCwxMzU5IDQwNywxMzI4IDM4NCwxMzA1QzM2MSwxMjgyIDMyOCwxMjcwIDI4NywxMjcwQzI0NCwxMjcwIDIxMiwxMjgyIDE4OSwxMzA1QzE2NiwxMzI4IDE1NCwxMzU5IDE1NCwxMzk5elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImtcXFwiIGhvcml6LWFkdi14PVxcXCIxMTcxXFxcIiBkPVxcXCJNMzk1LDU4NGwxMzMsMTY2bDMzNCwzNTZsMjcxLDBsLTQ0NSwtNDc1bDQ3MywtNjMxbC0yNzYsMGwtMzU1LDQ4NWwtMTI5LC0xMDZsMCwtMzc5bC0yMzMsMGwwLDE1NTZsMjMzLDBsMCwtNzU5bC0xMiwtMjEzelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcImxcXFwiIGhvcml6LWFkdi14PVxcXCI1NzFcXFwiIGQ9XFxcIk00MDMsMGwtMjM1LDBsMCwxNTU2bDIzNSwwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIm1cXFwiIGhvcml6LWFkdi14PVxcXCIxOTU4XFxcIiBkPVxcXCJNMTEwMCwwbC0yMzYsMGwwLDY4MkM4NjQsNzY3IDg0OCw4MzAgODE2LDg3MkM3ODQsOTEzIDczNCw5MzQgNjY2LDkzNEM1NzUsOTM0IDUwOSw5MDUgNDY3LDg0NkM0MjQsNzg3IDQwMyw2ODggNDAzLDU1MWwwLC01NTFsLTIzNSwwbDAsMTEwNmwxODQsMGwzMywtMTQ1bDEyLDBDNDI4LDEwMTQgNDcyLDEwNTQgNTMxLDEwODNDNTg5LDExMTIgNjUzLDExMjYgNzIzLDExMjZDODkzLDExMjYgMTAwNiwxMDY4IDEwNjEsOTUybDE2LDBDMTExMCwxMDA3IDExNTYsMTA0OSAxMjE1LDEwODBDMTI3NCwxMTExIDEzNDIsMTEyNiAxNDE5LDExMjZDMTU1MSwxMTI2IDE2NDcsMTA5MyAxNzA4LDEwMjZDMTc2OCw5NTkgMTc5OCw4NTggMTc5OCw3MjFsMCwtNzIxbC0yMzUsMGwwLDY4MkMxNTYzLDc2NyAxNTQ3LDgzMCAxNTE1LDg3MkMxNDgyLDkxMyAxNDMyLDkzNCAxMzY0LDkzNEMxMjczLDkzNCAxMjA2LDkwNiAxMTY0LDg0OUMxMTIxLDc5MiAxMTAwLDcwNCAxMTAwLDU4NnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJuXFxcIiBob3Jpei1hZHYteD1cXFwiMTMwMFxcXCIgZD1cXFwiTTExNDEsMGwtMjM2LDBsMCw2ODBDOTA1LDc2NSA4ODgsODI5IDg1NCw4NzFDODE5LDkxMyA3NjUsOTM0IDY5MCw5MzRDNTkxLDkzNCA1MTgsOTA1IDQ3Miw4NDZDNDI2LDc4NyA0MDMsNjg5IDQwMyw1NTFsMCwtNTUxbC0yMzUsMGwwLDExMDZsMTg0LDBsMzMsLTE0NWwxMiwwQzQzMCwxMDE0IDQ3OCwxMDU0IDUzOSwxMDgzQzYwMCwxMTEyIDY2OCwxMTI2IDc0MywxMTI2QzEwMDgsMTEyNiAxMTQxLDk5MSAxMTQxLDcyMXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJvXFxcIiBob3Jpei1hZHYteD1cXFwiMTI1MVxcXCIgZD1cXFwiTTExNDksNTU1QzExNDksMzc0IDExMDMsMjMzIDEwMTAsMTMyQzkxNywzMSA3ODgsLTIwIDYyMywtMjBDNTIwLC0yMCA0MjgsMyAzNDksNTBDMjcwLDk3IDIwOSwxNjQgMTY2LDI1MUMxMjMsMzM4IDEwMiw0NDAgMTAyLDU1NUMxMDIsNzM0IDE0OCw4NzQgMjQwLDk3NUMzMzIsMTA3NiA0NjIsMTEyNiA2MjksMTEyNkM3ODksMTEyNiA5MTYsMTA3NSAxMDA5LDk3MkMxMTAyLDg2OSAxMTQ5LDczMCAxMTQ5LDU1NU0zNDQsNTU1QzM0NCwzMDAgNDM4LDE3MiA2MjcsMTcyQzgxNCwxNzIgOTA3LDMwMCA5MDcsNTU1QzkwNyw4MDggODEzLDkzNCA2MjUsOTM0QzUyNiw5MzQgNDU1LDkwMSA0MTEsODM2QzM2Niw3NzEgMzQ0LDY3NyAzNDQsNTU1elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcInBcXFwiIGhvcml6LWFkdi14PVxcXCIxMjc2XFxcIiBkPVxcXCJNNzI5LC0yMEM1ODksLTIwIDQ4MCwzMCA0MDMsMTMxbC0xNCwwQzM5OCwzOCA0MDMsLTE5IDQwMywtMzlsMCwtNDUzbC0yMzUsMGwwLDE1OThsMTkwLDBDMzYzLDEwODUgMzc0LDEwMzYgMzkxLDk1OGwxMiwwQzQ3NiwxMDcwIDU4NiwxMTI2IDczMywxMTI2Qzg3MSwxMTI2IDk3OSwxMDc2IDEwNTYsOTc2QzExMzMsODc2IDExNzEsNzM2IDExNzEsNTU1QzExNzEsMzc0IDExMzIsMjMzIDEwNTQsMTMyQzk3NSwzMSA4NjcsLTIwIDcyOSwtMjBNNjcyLDkzNEM1NzksOTM0IDUxMSw5MDcgNDY4LDg1MkM0MjUsNzk3IDQwMyw3MTAgNDAzLDU5MGwwLC0zNUM0MDMsNDIwIDQyNCwzMjMgNDY3LDI2M0M1MTAsMjAyIDU3OSwxNzIgNjc2LDE3MkM3NTcsMTcyIDgyMCwyMDUgODY0LDI3MkM5MDgsMzM5IDkzMCw0MzQgOTMwLDU1N0M5MzAsNjgxIDkwOCw3NzUgODY1LDgzOUM4MjEsOTAyIDc1Nyw5MzQgNjcyLDkzNHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJxXFxcIiBob3Jpei1hZHYteD1cXFwiMTI3NlxcXCIgZD1cXFwiTTYwNiwxNjhDNzA1LDE2OCA3NzYsMTk3IDgxOSwyNTRDODYyLDMxMSA4ODMsMzk3IDg4Myw1MTJsMCwzN0M4ODMsNjg2IDg2MSw3ODQgODE3LDg0NEM3NzIsOTA0IDcwMSw5MzQgNjAyLDkzNEM1MTgsOTM0IDQ1NCw5MDEgNDEwLDgzNEMzNjYsNzY3IDM0NCw2NzIgMzQ0LDU0N0MzNDQsMjk0IDQzMSwxNjggNjA2LDE2OE01MzksLTIwQzQwMiwtMjAgMjk1LDMwIDIxOCwxMzFDMTQxLDIzMSAxMDIsMzcxIDEwMiw1NTFDMTAyLDczMSAxNDEsODcyIDIyMCw5NzRDMjk5LDEwNzUgNDA3LDExMjYgNTQ1LDExMjZDNjE0LDExMjYgNjc3LDExMTMgNzMyLDEwODhDNzg3LDEwNjIgODM2LDEwMjAgODc5LDk2MWw4LDBsMjYsMTQ1bDE5NSwwbDAsLTE1OThsLTIzNiwwbDAsNDY5Qzg3Miw2IDg3MywzNyA4NzYsNzBDODc5LDEwMyA4ODEsMTI4IDg4MywxNDVsLTEzLDBDODAxLDM1IDY5MCwtMjAgNTM5LC0yMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJyXFxcIiBob3Jpei1hZHYteD1cXFwiODgzXFxcIiBkPVxcXCJNNzI5LDExMjZDNzc2LDExMjYgODE1LDExMjMgODQ2LDExMTZsLTIzLC0yMTlDNzkwLDkwNSA3NTUsOTA5IDcxOSw5MDlDNjI1LDkwOSA1NDksODc4IDQ5MSw4MTdDNDMyLDc1NiA0MDMsNjc2IDQwMyw1NzhsMCwtNTc4bC0yMzUsMGwwLDExMDZsMTg0LDBsMzEsLTE5NWwxMiwwQzQzMiw5NzcgNDgwLDEwMjkgNTM5LDEwNjhDNTk4LDExMDcgNjYxLDExMjYgNzI5LDExMjZ6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwic1xcXCIgaG9yaXotYWR2LXg9XFxcIjk5N1xcXCIgZD1cXFwiTTkxMSwzMTVDOTExLDIwNyA4NzIsMTI0IDc5Myw2N0M3MTQsOSA2MDIsLTIwIDQ1NSwtMjBDMzA4LC0yMCAxODksMiAxMDAsNDdsMCwyMDNDMjMwLDE5MCAzNTEsMTYwIDQ2MywxNjBDNjA4LDE2MCA2ODAsMjA0IDY4MCwyOTFDNjgwLDMxOSA2NzIsMzQyIDY1NiwzNjFDNjQwLDM4MCA2MTQsMzk5IDU3Nyw0MTlDNTQwLDQzOSA0ODksNDYyIDQyNCw0ODdDMjk3LDUzNiAyMTEsNTg2IDE2Niw2MzVDMTIxLDY4NCA5OCw3NDggOTgsODI3Qzk4LDkyMiAxMzYsOTk1IDIxMywxMDQ4QzI4OSwxMTAwIDM5MywxMTI2IDUyNCwxMTI2QzY1NCwxMTI2IDc3NywxMTAwIDg5MywxMDQ3bC03NiwtMTc3QzY5OCw5MTkgNTk3LDk0NCA1MTYsOTQ0QzM5Miw5NDQgMzMwLDkwOSAzMzAsODM4QzMzMCw4MDMgMzQ2LDc3NCAzNzksNzUwQzQxMSw3MjYgNDgxLDY5MyA1OTAsNjUxQzY4MSw2MTYgNzQ4LDU4MyA3ODksNTU0QzgzMCw1MjUgODYxLDQ5MSA4ODEsNDUzQzkwMSw0MTQgOTExLDM2OCA5MTEsMzE1elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcInRcXFwiIGhvcml6LWFkdi14PVxcXCI4MDVcXFwiIGQ9XFxcIk01ODAsMTcwQzYzNywxNzAgNjk1LDE3OSA3NTIsMTk3bDAsLTE3N0M3MjYsOSA2OTMsLTEgNjUyLC04QzYxMSwtMTYgNTY4LC0yMCA1MjQsLTIwQzMwMSwtMjAgMTkwLDk3IDE5MCwzMzJsMCw1OTZsLTE1MSwwbDAsMTA0bDE2Miw4Nmw4MCwyMzRsMTQ1LDBsMCwtMjQ2bDMxNSwwbDAsLTE3OGwtMzE1LDBsMCwtNTkyQzQyNiwyNzkgNDQwLDIzOCA0NjksMjExQzQ5NywxODQgNTM0LDE3MCA1ODAsMTcwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcInVcXFwiIGhvcml6LWFkdi14PVxcXCIxMzAwXFxcIiBkPVxcXCJNOTQ4LDBsLTMzLDE0NWwtMTIsMEM4NzAsOTQgODI0LDUzIDc2NCwyNEM3MDMsLTUgNjM0LC0yMCA1NTcsLTIwQzQyMywtMjAgMzIzLDEzIDI1Nyw4MEMxOTEsMTQ3IDE1OCwyNDggMTU4LDM4M2wwLDcyM2wyMzcsMGwwLC02ODJDMzk1LDMzOSA0MTIsMjc2IDQ0NywyMzRDNDgyLDE5MSA1MzYsMTcwIDYxMCwxNzBDNzA5LDE3MCA3ODEsMjAwIDgyOCwyNTlDODc0LDMxOCA4OTcsNDE2IDg5Nyw1NTVsMCw1NTFsMjM2LDBsMCwtMTEwNnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJ2XFxcIiBob3Jpei1hZHYteD1cXFwiMTA5NlxcXCIgZD1cXFwiTTQyMCwwbC00MjAsMTEwNmwyNDgsMGwyMjUsLTY0M0M1MTIsMzU1IDUzNSwyNjggNTQzLDIwMWw4LDBDNTU3LDI0OSA1ODAsMzM2IDYyMSw0NjNsMjI1LDY0M2wyNTAsMGwtNDIyLC0xMTA2elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIndcXFwiIGhvcml6LWFkdi14PVxcXCIxNjczXFxcIiBkPVxcXCJNMTA3NSwwbC0xNDMsNTE2QzkxNSw1NzEgODgzLDY5OCA4MzgsODk3bC05LDBDNzkwLDcxNyA3NjAsNTg5IDczNyw1MTRsLTE0NywtNTE0bC0yNjAsMGwtMzEwLDExMDZsMjQwLDBsMTQxLC01NDVDNDMzLDQyNiA0NTYsMzExIDQ2OSwyMTVsNiwwQzQ4MiwyNjQgNDkyLDMyMCA1MDYsMzgzQzUxOSw0NDYgNTMxLDQ5MyA1NDEsNTI0bDE2OCw1ODJsMjU4LDBsMTYzLC01ODJDMTE0MCw0OTEgMTE1Myw0NDEgMTE2OCwzNzRDMTE4MywzMDcgMTE5MSwyNTQgMTE5NCwyMTdsOCwwQzEyMTIsMjk5IDEyMzUsNDE0IDEyNzIsNTYxbDE0Myw1NDVsMjM2LDBsLTMxMiwtMTEwNnpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJ4XFxcIiBob3Jpei1hZHYteD1cXFwiMTEyOFxcXCIgZD1cXFwiTTQxNCw1NjVsLTM3MSw1NDFsMjY4LDBsMjUyLC0zODdsMjU0LDM4N2wyNjYsMGwtMzcyLC01NDFsMzkxLC01NjVsLTI2NiwwbC0yNzMsNDE0bC0yNzIsLTQxNGwtMjY2LDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwieVxcXCIgaG9yaXotYWR2LXg9XFxcIjEwOThcXFwiIGQ9XFxcIk0wLDExMDZsMjU2LDBsMjI1LC02MjdDNTE1LDM5MCA1MzgsMzA2IDU0OSwyMjdsOCwwQzU2MywyNjQgNTc0LDMwOCA1OTAsMzYxQzYwNiw0MTMgNjkxLDY2MSA4NDQsMTEwNmwyNTQsMGwtNDczLC0xMjUzQzUzOSwtMzc3IDM5NiwtNDkyIDE5NSwtNDkyQzE0MywtNDkyIDkyLC00ODYgNDMsLTQ3NWwwLDE4NkM3OCwtMjk3IDExOSwtMzAxIDE2NCwtMzAxQzI3NywtMzAxIDM1NywtMjM1IDQwMywtMTA0bDQxLDEwNHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCJ6XFxcIiBob3Jpei1hZHYteD1cXFwiOTc5XFxcIiBkPVxcXCJNOTA3LDBsLTgzOSwwbDAsMTQ1bDU1OSw3ODFsLTUyNSwwbDAsMTgwbDc4OSwwbDAsLTE2NGwtNTQ3LC03NjJsNTYzLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiflxcXCIgaG9yaXotYWR2LXg9XFxcIjExNjlcXFwiIGQ9XFxcIk0zMzAsNjkyQzI5Nyw2OTIgMjYwLDY4MiAyMTksNjYyQzE3OCw2NDIgMTM3LDYxMiA5Niw1NzFsMCwxOTFDMTYyLDgzNCAyNDUsODcwIDM0Niw4NzBDMzkwLDg3MCA0MzIsODY2IDQ3MSw4NTdDNTEwLDg0OCA1NTksODMyIDYxOCw4MDdDNzA1LDc3MCA3NzksNzUyIDgzOCw3NTJDODczLDc1MiA5MTEsNzYyIDk1Myw3ODNDOTk0LDgwNCAxMDM0LDgzMyAxMDczLDg3MmwwLC0xOTBDMTAwMyw2MDggOTIwLDU3MSA4MjMsNTcxQzc4MCw1NzEgNzM3LDU3NiA2OTYsNTg3QzY1NCw1OTcgNjA1LDYxNCA1NDksNjM3QzQ2NCw2NzQgMzkxLDY5MiAzMzAsNjkyelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeEEwO1xcXCIgaG9yaXotYWR2LXg9XFxcIjUzMlxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeEEzO1xcXCIgaG9yaXotYWR2LXg9XFxcIjExNjlcXFwiIGQ9XFxcIk02OTAsMTQ4MUM4MTksMTQ4MSA5NDQsMTQ1NCAxMDY1LDEzOTlsLTc2LC0xODJDODgxLDEyNjQgNzg2LDEyODggNzA1LDEyODhDNTY4LDEyODggNTAwLDEyMTUgNTAwLDEwNjlsMCwtMjQ0bDM5NywwbDAsLTE3MmwtMzk3LDBsMCwtMTgyQzUwMCw0MTAgNDg5LDM1OSA0NjcsMzE2QzQ0NSwyNzMgNDA3LDIzNyAzNTQsMjA3bDc1NiwwbDAsLTIwN2wtMTAzOCwwbDAsMTk1QzEzNywyMTUgMTg2LDI0NyAyMTcsMjkxQzI0OCwzMzUgMjY0LDM5NCAyNjQsNDY5bDAsMTg0bC0xODgsMGwwLDE3MmwxODgsMGwwLDI1NkMyNjQsMTIwNiAzMDIsMTMwNCAzNzgsMTM3NUM0NTMsMTQ0NiA1NTcsMTQ4MSA2OTAsMTQ4MXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImI3hBOTtcXFwiIGhvcml6LWFkdi14PVxcXCIxNzA0XFxcIiBkPVxcXCJNODkzLDEwMzRDODE5LDEwMzQgNzYyLDEwMDcgNzIyLDk1NEM2ODIsOTAwIDY2Miw4MjYgNjYyLDczMUM2NjIsNjMzIDY4MCw1NTggNzE2LDUwNUM3NTIsNDUyIDgxMSw0MjYgODkzLDQyNkM5MzAsNDI2IDk2OSw0MzEgMTAxMSw0NDFDMTA1Myw0NTEgMTA4OSw0NjMgMTEyMCw0NzdsMCwtMTU4QzEwNDMsMjg1IDk2NSwyNjggODg1LDI2OEM3NTQsMjY4IDY1MiwzMDggNTgwLDM4OUM1MDcsNDY5IDQ3MSw1ODMgNDcxLDczMUM0NzEsODc0IDUwOCw5ODYgNTgxLDEwNjlDNjU0LDExNTEgNzU2LDExOTIgODg3LDExOTJDOTc5LDExOTIgMTA3MCwxMTY5IDExNjEsMTEyMmwtNjUsLTE0M0MxMDI1LDEwMTYgOTU4LDEwMzQgODkzLDEwMzRNMTAwLDczMUMxMDAsODY0IDEzMyw5ODkgMjAwLDExMDZDMjY3LDEyMjMgMzU4LDEzMTUgNDc1LDEzODJDNTkyLDE0NDkgNzE3LDE0ODMgODUyLDE0ODNDOTg1LDE0ODMgMTExMCwxNDUwIDEyMjcsMTM4M0MxMzQ0LDEzMTYgMTQzNiwxMjI1IDE1MDMsMTEwOEMxNTcwLDk5MSAxNjA0LDg2NiAxNjA0LDczMUMxNjA0LDYwMCAxNTcyLDQ3NiAxNTA3LDM2MUMxNDQyLDI0NiAxMzUyLDE1MyAxMjM1LDg0QzExMTgsMTUgOTkxLC0yMCA4NTIsLTIwQzcxNCwtMjAgNTg3LDE1IDQ3MCw4NEMzNTMsMTUzIDI2MywyNDUgMTk4LDM2MEMxMzMsNDc1IDEwMCw1OTkgMTAwLDczMU0yMjMsNzMxQzIyMyw2MTggMjUxLDUxMyAzMDgsNDE2QzM2NCwzMTkgNDQxLDI0MiA1MzgsMTg2QzYzNSwxMzAgNzQwLDEwMiA4NTIsMTAyQzk2NSwxMDIgMTA3MSwxMzEgMTE2OCwxODhDMTI2NSwyNDUgMTM0MiwzMjEgMTM5OCw0MThDMTQ1Myw1MTQgMTQ4MSw2MTggMTQ4MSw3MzFDMTQ4MSw4NDMgMTQ1Myw5NDggMTM5NywxMDQ2QzEzNDAsMTE0MyAxMjYzLDEyMjAgMTE2NiwxMjc2QzEwNjgsMTMzMiA5NjMsMTM2MCA4NTIsMTM2MEM3NDAsMTM2MCA2MzYsMTMzMiA1NDAsMTI3N0M0NDMsMTIyMiAzNjYsMTE0NSAzMDksMTA0OEMyNTIsOTUxIDIyMyw4NDUgMjIzLDczMXpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImI3hBRDtcXFwiIGhvcml6LWFkdi14PVxcXCI2NTlcXFwiIGQ9XFxcIk03Miw0NDlsMCwyMDBsNTE0LDBsMCwtMjAwelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeEFFO1xcXCIgaG9yaXotYWR2LXg9XFxcIjE3MDRcXFwiIGQ9XFxcIk03NDgsNzcwbDY5LDBDODY2LDc3MCA5MDQsNzgyIDkyOSw4MDVDOTU0LDgyOCA5NjcsODYyIDk2Nyw5MDVDOTY3LDk1MyA5NTUsOTg3IDkzMSwxMDA2QzkwNiwxMDI1IDg2OCwxMDM0IDgxNSwxMDM0bC02NywwTTExNTcsOTA5QzExNTcsNzk1IDExMDYsNzE3IDEwMDQsNjc2bDIzNywtMzk3bC0yMTEsMGwtMTkyLDM0NmwtOTAsMGwwLC0zNDZsLTE4OSwwbDAsOTAzbDI2MiwwQzkzNywxMTgyIDEwMjIsMTE1OSAxMDc2LDExMTRDMTEzMCwxMDY5IDExNTcsMTAwMCAxMTU3LDkwOU0xMDAsNzMxQzEwMCw4NjQgMTMzLDk4OSAyMDAsMTEwNkMyNjcsMTIyMyAzNTgsMTMxNSA0NzUsMTM4MkM1OTIsMTQ0OSA3MTcsMTQ4MyA4NTIsMTQ4M0M5ODUsMTQ4MyAxMTEwLDE0NTAgMTIyNywxMzgzQzEzNDQsMTMxNiAxNDM2LDEyMjUgMTUwMywxMTA4QzE1NzAsOTkxIDE2MDQsODY2IDE2MDQsNzMxQzE2MDQsNjAwIDE1NzIsNDc2IDE1MDcsMzYxQzE0NDIsMjQ2IDEzNTIsMTUzIDEyMzUsODRDMTExOCwxNSA5OTEsLTIwIDg1MiwtMjBDNzE0LC0yMCA1ODcsMTUgNDcwLDg0QzM1MywxNTMgMjYzLDI0NSAxOTgsMzYwQzEzMyw0NzUgMTAwLDU5OSAxMDAsNzMxTTIyMyw3MzFDMjIzLDYxOCAyNTEsNTEzIDMwOCw0MTZDMzY0LDMxOSA0NDEsMjQyIDUzOCwxODZDNjM1LDEzMCA3NDAsMTAyIDg1MiwxMDJDOTY1LDEwMiAxMDcxLDEzMSAxMTY4LDE4OEMxMjY1LDI0NSAxMzQyLDMyMSAxMzk4LDQxOEMxNDUzLDUxNCAxNDgxLDYxOCAxNDgxLDczMUMxNDgxLDg0MyAxNDUzLDk0OCAxMzk3LDEwNDZDMTM0MCwxMTQzIDEyNjMsMTIyMCAxMTY2LDEyNzZDMTA2OCwxMzMyIDk2MywxMzYwIDg1MiwxMzYwQzc0MCwxMzYwIDYzNiwxMzMyIDU0MCwxMjc3QzQ0MywxMjIyIDM2NiwxMTQ1IDMwOSwxMDQ4QzI1Miw5NTEgMjIzLDg0NSAyMjMsNzMxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeDIwMTg7XFxcIiBob3Jpei1hZHYteD1cXFwiMzk1XFxcIiBkPVxcXCJNMzcsOTYxbC0xMiwyMkMzOCwxMDM4IDYyLDExMTMgOTYsMTIwN0MxMzAsMTMwMSAxNjUsMTM4NiAyMDEsMTQ2MmwxNzAsMEMzMjgsMTI5MSAyOTUsMTEyNCAyNzAsOTYxelxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeDIwMTk7XFxcIiBob3Jpei1hZHYteD1cXFwiMzk1XFxcIiBkPVxcXCJNMzU2LDE0NjJsMTUsLTIyQzMzNiwxMzAxIDI3NywxMTQxIDE5NSw5NjFsLTE3MCwwQzcxLDExNTQgMTA0LDEzMjEgMTI1LDE0NjJ6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4MjAxQztcXFwiIGhvcml6LWFkdi14PVxcXCI4MTNcXFwiIGQ9XFxcIk00NDAsOTgzQzQ3NSwxMTE4IDUzNSwxMjc4IDYxOCwxNDYybDE3MCwwQzc0MiwxMjY1IDcwOSwxMDk4IDY4OCw5NjFsLTIzMywwTTI1LDk4M0MzOCwxMDM4IDYyLDExMTMgOTYsMTIwN0MxMzAsMTMwMSAxNjUsMTM4NiAyMDEsMTQ2MmwxNzAsMEMzMjgsMTI5MSAyOTUsMTEyNCAyNzAsOTYxbC0yMzMsMHpcXFwiLz5cXG4gIDxnbHlwaCB1bmljb2RlPVxcXCImI3gyMDFEO1xcXCIgaG9yaXotYWR2LXg9XFxcIjgxM1xcXCIgZD1cXFwiTTM3MSwxNDQwQzMzNiwxMzAxIDI3NywxMTQxIDE5NSw5NjFsLTE3MCwwQzcxLDExNTQgMTA0LDEzMjEgMTI1LDE0NjJsMjMxLDBNNzg4LDE0NDBDNzUzLDEzMDEgNjk0LDExNDEgNjEyLDk2MWwtMTcyLDBDNDg2LDExNDIgNTIwLDEzMDkgNTQzLDE0NjJsMjMxLDB6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4MjAyMjtcXFwiIGhvcml6LWFkdi14PVxcXCI3NzBcXFwiIGQ9XFxcIk0xMzEsNzQ4QzEzMSw4NDAgMTUzLDkxMCAxOTcsOTU4QzI0MSwxMDA2IDMwNCwxMDMwIDM4NSwxMDMwQzQ2NiwxMDMwIDUyOCwxMDA2IDU3Myw5NThDNjE3LDkwOSA2MzksODM5IDYzOSw3NDhDNjM5LDY1OCA2MTcsNTg4IDU3Miw1MzlDNTI3LDQ5MCA0NjUsNDY1IDM4NSw0NjVDMzA1LDQ2NSAyNDMsNDg5IDE5OCw1MzhDMTUzLDU4NiAxMzEsNjU2IDEzMSw3NDh6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiJiN4MjBBQztcXFwiIGhvcml6LWFkdi14PVxcXCIxMTg4XFxcIiBkPVxcXCJNNzk5LDEyNzhDNzA1LDEyNzggNjI4LDEyNTAgNTY5LDExOTRDNTA5LDExMzggNDY5LDEwNTMgNDQ5LDk0MGw0NTYsMGwwLC0xNTRsLTQ3MSwwbC0yLC00NWwwLC01NWwyLC0zOWw0MDgsMGwwLC0xNTNsLTM5MSwwQzQ5NCwyODYgNjE1LDE4MiA4MTUsMTgyQzkxMCwxODIgMTAwOCwyMDMgMTEwOCwyNDRsMCwtMjAzQzEwMjEsMCA5MTksLTIwIDgwMywtMjBDNjQyLC0yMCA1MTIsMjQgNDEyLDExMkMzMTEsMjAwIDI0NiwzMjcgMjE1LDQ5NGwtMTUyLDBsMCwxNTNsMTM2LDBsLTIsMzdsMCwzN2wyLDY1bC0xMzYsMGwwLDE1NGwxNTAsMEMyMzgsMTEwNyAzMDIsMTIzOSA0MDQsMTMzNEM1MDYsMTQyOSA2MzgsMTQ3NyA3OTksMTQ3N0M5MzIsMTQ3NyAxMDUyLDE0NDggMTE1NywxMzg5bC04NCwtMTg3Qzk3MCwxMjUzIDg3OSwxMjc4IDc5OSwxMjc4elxcXCIvPlxcbiAgPGdseXBoIHVuaWNvZGU9XFxcIiYjeDIxMjI7XFxcIiBob3Jpei1hZHYteD1cXFwiMTU2MVxcXCIgZD1cXFwiTTM3NSw3NDFsLTE0NiwwbDAsNTkybC0yMDIsMGwwLDEyOWw1NTMsMGwwLC0xMjlsLTIwNSwwTTk2Myw3NDFsLTE4NSw1NDNsLTYsMGw0LC0xMTlsMCwtNDI0bC0xNDEsMGwwLDcyMWwyMTcsMGwxNzgsLTUzNGwxODcsNTM0bDIxMCwwbDAsLTcyMWwtMTQ3LDBsMCw0MTRsNCwxMjlsLTYsMGwtMTkzLC01NDN6XFxcIi8+XFxuICA8Z2x5cGggdW5pY29kZT1cXFwiSVxcXCIgaG9yaXotYWR2LXg9XFxcIjYyNVxcXCIgZD1cXFwiTTE5MywwbDAsMTQ2MmwyMzksMGwwLC0xNDYyelxcXCIvPlxcbiA8L2ZvbnQ+XFxuXCIpXG4gIC8vIGRpYWdyYW0udG9fZGVmcyhmcy5yZWFkRmlsZVN5bmMoJy4uL3Jlc291cmNlcy9iYWNrZ3JvdW5kLnN2ZycpKVxuICBkaWFncmFtLnRvX2RlZnMoXCI8ZyBjbGFzcz1cXFwiRkNIQm94XFxcIj5cXG4gIDxnPlxcbiAgICA8cGF0aCBmaWxsPVxcXCIjRkZGRkZGXFxcIiBkPVxcXCJtMTYwIDUwYzAgMSAtMSAzIC0yIDNoLTE1NWMtMSAwIC0yIC0xIC0yIC0ydi00NWMwIC0xIDEgLTIgMyAtMmgxNTVjMSAwIDMgMSAzIDN2NDV6XFxcIi8+XFxuICAgIDxwYXRoIGZpbGw9XFxcIiNBQUIyQkRcXFwiIGQ9XFxcIm0xNjAgMHY1MGgtMTU1di00NWgxNTVtMCAtNWgtMTU1Yy0zIDAgLTUgMiAtNSA1djQ1YzAgMyAyIDUgNSA1aDE1NWMzIDAgNSAtMiA1IC01di00NWMwIC0zIC0yIC01IC01IC01bDAgMHpcXFwiLz5cXG4gIDwvZz5cXG4gIDxyZWN0IGNsYXNzPVxcXCJGQ0hCb3gtVGV4dC1iZ1xcXCIgIGZpbGw9XFxcIm5vbmVcXFwiIHdpZHRoPVxcXCIxMzVcXFwiIGhlaWdodD1cXFwiMzIuN1xcXCIvPlxcbiAgPGcgY2xhc3M9XFxcIkZDSEJveC1UZXh0XFxcIj5cXG4gICAgPHRleHQgY2xhc3M9XFxcIkZDSEJveC1UZXh0LXRpdGxlXFxcIiB4PVxcXCIxNVxcXCIgeT1cXFwiMjFcXFwiIGZpbGw9XFxcIiNBQUIyQkRcXFwiIGZvbnQtZmFtaWx5PVxcXCInT3BlblNhbnMtU2VtaWJvbGQnXFxcIiBmb250LXNpemU9XFxcIjE0XFxcIj5BY3Rpb24gVGl0bGU8L3RleHQ+XFxuICAgIDx0ZXh0IGNsYXNzPVxcXCJGQ0hCb3gtVGV4dC10eXBlXFxcIiB4PVxcXCIxNVxcXCIgeT1cXFwiNDJcXFwiIGZpbGw9XFxcIiNBQUIyQkRcXFwiIGZvbnQtZmFtaWx5PVxcXCInT3BlblNhbnMtU2VtaWJvbGQnXFxcIiBmb250LXNpemU9XFxcIjE0XFxcIj5UeXBlOiBOb3JtYWw8L3RleHQ+XFxuICA8L2c+XFxuPC9nPlxcblwiKVxuICBkaWFncmFtLnRvX2RlZnMoXCI8cGF0dGVybiBpZD1cXFwiZmhjLWxpbmUtcGF0dGVyblxcXCIgcGF0dGVybkNvbnRlbnRVbml0cz1cXFwib2JqZWN0Qm91bmRpbmdCb3hcXFwiIGNsYXNzPVxcXCJGQ0hMaW5lLXBhdHRlcm5cXFwiPlxcbiAgPGNpcmNsZSBmaWxsPVxcXCIjQUFCMkJEXFxcIiByPVxcXCIyLjVcXFwiLz5cXG48L3BhdHRlcm4+XFxuXCIpXG4gIGRpYWdyYW0udG9fZGVmcyhcIjxnIGNsYXNzPVxcXCJGQ0hMaW5lLWFycm93XFxcIj5cXG4gIDxtYXJrZXIgaWQ9XFxcImZjaC1lbmRhcnJvd1xcXCIgb3ZlcmZsb3c9XFxcInZpc2libGVcXFwiIG9yaWVudD1cXFwiYXV0b1xcXCIgPlxcbiAgIDxwb2x5Z29uIHBvaW50cz1cXFwiLTUsLTUgMCwwIC01LDVcXFwiIGZpbGw9XFxcIiNBQUIyQkRcXFwiLz5cXG4gIDwvbWFya2VyPlxcbjwvZz5cXG5cIilcbiAgZGlhZ3JhbS50b19kZWZzKFwiPGcgY2xhc3M9XFxcIkZDSExpbmUtaW50ZXJzZWN0aW9uIEVkZ2UtaW50ZXJzZWN0aW9uXFxcIj5cXG4gIDwhLS1yZWN0IHg9XFxcIjE4XFxcIiB5PVxcXCIxN1xcXCIgd2lkdGg9XFxcIjlcXFwiIGhlaWdodD1cXFwiMTFcXFwiIC8+XFxuICA8bGluZSB4MT1cXFwiNDVcXFwiIHkxPVxcXCIyOFxcXCIgeDI9XFxcIjMwXFxcIiB5Mj1cXFwiMjhcXFwiLz5cXG4gIDxsaW5lIHgxPVxcXCIzMFxcXCIgeTE9XFxcIjE3XFxcIiB4Mj1cXFwiNDVcXFwiIHkyPVxcXCIxN1xcXCIvPlxcbiAgPGxpbmUgeDE9XFxcIjE1XFxcIiB5MT1cXFwiMjhcXFwiICAgICAgICAgeTI9XFxcIjI4XFxcIiAvPlxcbiAgPGxpbmUgICAgICAgICB5MT1cXFwiMTdcXFwiIHgyPVxcXCIxNVxcXCIgeTI9XFxcIjE3XFxcIi8+XFxuICA8bGluZSB4MT1cXFwiMTdcXFwiIHkxPVxcXCI0NVxcXCIgeDI9XFxcIjE3XFxcIi8+XFxuICA8bGluZSB4MT1cXFwiMjhcXFwiIHgyPVxcXCIyOFxcXCIgeTI9XFxcIjQ1XFxcIi8tLT5cXG48cmVjdCB4PVxcXCIxMlxcXCIgeT1cXFwiMTBcXFwiIHdpZHRoPVxcXCIxMFxcXCIgaGVpZ2h0PVxcXCIxM1xcXCIvPlxcbjxsaW5lIHgxPVxcXCIzNFxcXCIgeTE9XFxcIjIzXFxcIiB4Mj1cXFwiMjNcXFwiIHkyPVxcXCIyM1xcXCIgLz5cXG5cXG48bGluZSB4MT1cXFwiMjNcXFwiIHkxPVxcXCIxMVxcXCIgeDI9XFxcIjM0XFxcIiB5Mj1cXFwiMTFcXFwiIC8+XFxuPGxpbmUgeDE9XFxcIjExXFxcIiB5MT1cXFwiMjNcXFwiICAgICAgICAgeTI9XFxcIjIzXFxcIiAvPlxcbjxsaW5lICAgICAgICAgeTE9XFxcIjExXFxcIiB4Mj1cXFwiMTFcXFwiIHkyPVxcXCIxMVxcXCIgLz5cXG48bGluZSB4MT1cXFwiMTFcXFwiIHkxPVxcXCIzNFxcXCIgICB4Mj1cXFwiMTFcXFwiICAgICAgICAgLz5cXG48bGluZSB4MT1cXFwiMjNcXFwiICAgICAgICAgICB4Mj1cXFwiMjNcXFwiIHkyPVxcXCIzNFxcXCIgLz5cXG5cXG5cXG48L2c+XFxuXCIpXG4gIGRpYWdyYW0udG9fZGVmcyhcIjxnIGNsYXNzPVxcXCJGQ0hMaW5lXFxcIj5cXG4gIDxsaW5lIGNsYXNzPVxcXCJGQ0hMaW5lLWRvdHMgRWRnZVxcXCIgLz5cXG48L2c+XFxuXCIpXG4gIGRpYWdyYW0udG9fZGVmcyhcIjxnIGNsYXNzPVxcXCJGQ0hMaW5lLXdpdGhhcnJvd1xcXCI+XFxuICA8bGluZSBjbGFzcz1cXFwiRkNITGluZS1kb3RzIEVkZ2VcXFwiIC8+XFxuICA8bGluZSBjbGFzcz1cXFwiRkNITGluZS1lbmRhcnJvdyBFZGdlLS1lbmRcXFwiIC8+XFxuPC9nPlxcblwiKVxuICBkaWFncmFtLmRpc3BsYXkoKVxuXG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICBcInVzZSBzdHJpY3RcIlxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlZmF1bHRzKG9iaikge1xuICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkuZm9yRWFjaChmdW5jdGlvbihzb3VyY2Upe1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgaWYgKG9ialtwcm9wXSA9PT0gdW5kZWZpbmVkKSBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF1cbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBvYmpcbiAgfVxufSgpXG4iLCJ2b2lkIGZ1bmN0aW9uKCl7XG5cbiAgZnVuY3Rpb24gcXVlcnkoc2VsZWN0b3IsIHBhcmVudCl7XG4gICAgcGFyZW50ID0gcGFyZW50IHx8IGRvY3VtZW50XG4gICAgcmV0dXJuIHBhcmVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKVxuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlKHRhZ19uYW1lLCBhdHRycyl7XG4gICAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ19uYW1lKVxuICAgIGlmICggYXR0cnMgKSB7IHNldF9hdHRyaWJ1dGVzKG5vZGUsIGF0dHJzKSB9XG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9hdHRyaWJ1dGUobm9kZSwgYXR0cil7XG4gICAgbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSx2YWx1ZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9hdHRyaWJ1dGVzKG5vZGUsIGF0dHJzKXtcbiAgICBPYmplY3Qua2V5cyhhdHRycylcbiAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbihuYW1lKXtcbiAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIGF0dHJzW25hbWVdKVxuICAgICAgICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfdGV4dChub2RlKXtcbiAgICByZXR1cm4gbm9kZS50ZXh0Q29udGVudCB8fCBub2RlLmlubmVyVGV4dFxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X3RleHQobm9kZSwgdGV4dCl7XG4gICAgbm9kZS50ZXh0Q29udGVudCA9IG5vZGUuaW5uZXJUZXh0ID0gdGV4dFxuICB9XG5cbiAgZnVuY3Rpb24gaW5zZXJ0QWZ0ZXIocGFyZW50RWwsIHNwMSwgc3AyKXtcbiAgICBwYXJlbnRFbC5pbnNlcnRCZWZvcmUoc3AxLCBzcDIubmV4dFNpYmxpbmcpXG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVOb2RlKG5vZGUpe1xuICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKVxuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgJCAgICAgICAgICAgICA6IHF1ZXJ5XG4gIC8vLCAkaWQgICAgICAgICAgIDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQuYmluZChkb2N1bWVudClcbiAgLCAkaWQgICAgICAgICAgIDogZnVuY3Rpb24oaWQpeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpIH1cbiAgLCBjcmVhdGUgICAgICAgIDogY3JlYXRlXG4gICwgYXR0ciAgICAgICAgICA6IHNldF9hdHRyaWJ1dGVcbiAgLCBhdHRycyAgICAgICAgIDogc2V0X2F0dHJpYnV0ZXNcbiAgLCBnZXRfdGV4dCAgICAgIDogZ2V0X3RleHRcbiAgLCBzZXRfdGV4dCAgICAgIDogc2V0X3RleHRcbiAgLCByZW1vdmUgICAgICAgIDogcmVtb3ZlTm9kZVxuICAsIGluc2VydEFmdGVyICAgOiBpbnNlcnRBZnRlclxuICB9XG5cbn0oKVxuIiwidm9pZCBmdW5jdGlvbigpe1xuICB2YXIgaWRzID0gW11cbiAgdmFyIHJ0ID0gcmVxdWlyZSgncmFuZG9tLXRva2VuJylcbiAgdmFyIGxldHRlcnMgPSBydC5nZW4oJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl0JylcblxuICBmdW5jdGlvbiB0b2tlbigpeyByZXR1cm4gbGV0dGVycygxKSArIHJ0KDE2KSB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpe1xuICAgIHZhciBpZCA9IHRva2VuKClcbiAgICB3aGlsZSAoIGlkcy5pbmRleE9mKGlkKSAhPSAtMSApe1xuICAgICAgaWQgPSB0b2tlbigpXG4gICAgfVxuICAgIHJldHVybiBpZFxuICB9XG59KClcbiIsbnVsbCwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIl19
