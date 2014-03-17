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
