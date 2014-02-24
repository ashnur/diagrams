void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var Item = require('./items.js')

  function position(chart){
    return [chart.svgel.asPX('x'), chart.svgel.asPX('y')]
  }

  function switch_layout(chart, layout_name){
  }

  function add_item(chart, name, attrs){
    var new_item = Item.make(chart, name, attrs)
    return new_item
  }

  function remove_item(chart, item){
  }

  function select(chart, selector){
  }

  function connect(chart, item, item){
  }

  function disconnect(chart, item, item){
  }

  module.exports = viral.extend({
    init: function(page){
      this.svgel = page.svgel.g()
    }
  , position: enslave(position)
    //   layout
  , layout: enslave(switch_layout)
    //   add item
  , addItem: enslave(add_item)
  , delItem: enslave(remove_item)
  , attr: enslave(remove_item)
    //   connect item, item -> layout
  , connect: enslave(connect)
    //   disconnect item, item -> layout
  , disconnect: enslave(disconnect)
    //   filter layout -> [item]
  , select: enslave(select)

  })
}()
