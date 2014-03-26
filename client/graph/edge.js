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
