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
