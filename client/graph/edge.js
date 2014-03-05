void function(){
  var enslave = require('enslave')
  var Node = require('./node.js')
  var uid = require('../util/unique_id.js')

  var Edge = Node.extend({
    init: function(graph, from, to, transform, attrs){
      this.id = uid()
      this.type = 'edge'
      this.graph = graph
      this.from = from
      this.to = to
      this.transform = transform.bind(null, this)
      this.attrs(attrs)
    }
  })

  module.exports = Edge
}()
