void function(){
  var Snap = require('snapsvg')
  var viral = require('viral')
  var enslave = require('enslave')
  var dagre = require('dagre')
  var events = require('events')
  var hglue = require('hyperglue')
  var defaults = require('../util/defaults.js')
  var uid = require('../util/unique_id.js')
  var dom = require('../util/dom.js')
  var floor = Math.floor
  var ceil = Math.ceil
  var min = Math.min
  var max = Math.max

  var Item = require('./item.js')

  function from_defs(diagram, classname){
    return diagram.svgel.select('defs .' + classname)
  }

  function to_defs(diagram, svg){
    var p = diagram.svgel
    if ( typeof svg == 'string' ) {
      var el = Snap.parse(svg).select('g.Shape')
    } else if ( Array.isArray(svg) ) {
      var el = p.el.apply(p.el, svg)
    } else {
      console.log('not sure how to handle')
    }
    return p.select('defs').append(el)
  }

  function intersect_rect(rect, point) {
    var x = rect.x
    var y = rect.y

    // NOTE: For now we only support rectangles

    // Rectangle intersection algorithm from:
    // http://math.stackexchange.com/questions/108113/find-edge-between-two-boxes
    var dx = point.x - x
    var dy = point.y - y
    var w = rect.width / 2
    var h = rect.height / 2

    var sx, sy
    if (Math.abs(dy) * w > Math.abs(dx) * h) {
      // Intersection is top or bottom of rect.
      if (dy < 0) {
        h = -h
      }
      sx = dy === 0 ? 0 : h * dx / dy
      sy = h
    } else {
      // Intersection is left or right of rect.
      if (dx < 0) {
        w = -w
      }
      sx = w
      sy = dx === 0 ? 0 : w * dy / dx
    }

    // TODO: this relative positioning based on the node size is killing me. Something is not right.
    return {x: x + sx + 50, y: y + sy + 25}
  }

  function draw(diagram, el){
    var new_el = from_defs(diagram, el.classname).clone()
    var node = hglue(new_el.node, el.content)
    diagram.svgel.append(new_el)
    return new_el
  }

  function set_line_attrs(item, line_height, x){
    item.g.selectAll('tspan').forEach(function(tspan, idx){
      tspan.attr({ dy: idx ? line_height : 0
                 , x: x
                 })
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


  function display(diagram){
    // apply height / width on nodes
    var ingraph = diagram.ingraph
    var bbox_cache = {}
    ingraph.eachNode(function(id, node){
      var classname = node.classname
      var bbox = bbox_cache[classname] || (bbox_cache[classname] = inviz_bbox(diagram, from_defs(diagram, classname)))

      node.attr('width', bbox.width)
      node.attr('height', bbox.height)

    })

    var r = diagram.layout
                      //.debugLevel(4)
                      .run(ingraph)

    var graph = diagram.outgraph = r.graph()

    // width and height must be corrected for padding
    var maxdim = Object.keys(bbox_cache).reduce(function(max, next_key){
      var next = bbox_cache[next_key]
      return {
        width: max.width < next.width ? next.width : max.width
      , height: max.width < next.height ? next.height : max.height
      }
    }, {width:0, height:0})

    diagram.svgel.attr({ width: graph.width + maxdim.width, height: graph.height + maxdim.height })

    r.eachNode(function(id, values){
      var node = diagram.ingraph.node(id)
      node.transform(values)
      draw(diagram, node)
    })


    r.eachEdge(function(id, from_id, to_id, values) {
      var edge = diagram.ingraph.edge(id)
      console.log(edge)
      var start = intersect_rect(edge.from.content.rect, values.points[0] )
      var end = intersect_rect(edge.to.content.rect, values.points[0])
      var points = [start, end].map(function(p){ return p.x + ',' + p.y }).join(' ')
      edge.add_attr('polyline', 'points', points)
      //var points = [edge.from.
      draw(diagram, edge)
    })

    return r
  }

  module.exports = viral.extend(new events.EventEmitter).extend({
    init: function(options, graph){
      this.options = options =  defaults(options, {
      })

      this.items = {}
      this.connectors = {}

      this.ingraph = graph.ingraph
      this.layout = dagre.layout()

      this.svgel = Snap.apply(Snap, options.snap_args)
      this.svgel.attr({id:uid()})
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
