void function(){
  var viral = require('viral')
  var enslave = require('enslave')

//  function draw_item(item){
//    return item.g = item.diagram.draw(item)
//  }

  var Item = viral.extend({
    init: function(diagram, id, value, invalues){
      this.diagram = diagram
      this.id = id
      this.value = value
      this.input = invalues



//      console.log('o', value)
//      console.log('i', invalues)
    }
//    , draw: enslave(draw_item)
  })

  module.exports = Item

}()

