void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var dagre = require('dagre')
  var events = require('events')
  var uid = require('../util/unique_id.js')
  var Node = require('./node.js')
  var Edge = require('./edge.js')

  function position(graph){
  }

  function switch_layout(graph, layout_name){
  }

  function select(graph, selector){
  }

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

  function connect(graph, classname, from, to, transform, content){
    var edge = Edge.make(graph, from, to, transform, {
        classname: classname
      , content: content
    })
    graph.ingraph.addEdge(edge.id, from.id, to.id, edge)
    return edge
  }

  function disconnect(graph, node, node){
  }

  module.exports = viral.extend(new events.EventEmitter).extend({
    init: function(cfgobj){
      this.config = cfgobj
      this.ingraph =  new dagre.Digraph()
    }
  , position: enslave(position)
  , layout: enslave(switch_layout)
  , add_node: enslave(add_node)
  , del_node: enslave(remove_node)
  , attr: enslave(remove_node)
  , connect: enslave(connect)
  , disconnect: enslave(disconnect)
  , select: enslave(select)
  })

}()
