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
