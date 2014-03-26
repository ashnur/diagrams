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
