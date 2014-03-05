void function(){
  var viral = require('viral')
  var enslave = require('enslave')

  function draw_item(item){
    var g = item.g
    var box = g.rect(item.value.x, item.value.y, item.value.width, item.value.height)
                    .attr({fill: '#fff', stroke: '#000', class: 'Item'})

    item.node = box
    return item
  }

  var Connector = viral.extend({
    init: function(diagram, id, value, invalues){
      this.diagram = diagram
      this.g = diagram.svgel.g().attr({id: id})
      this.id = id
    }
    , draw: enslave(draw_connection)
  })

  module.exports = Connector

}()
