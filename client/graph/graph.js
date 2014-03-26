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
