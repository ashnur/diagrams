void function(){
  var viral = require('viral')
  var enslave = require('enslave')

  function position(item){
    return [item.svgel.asPX('x'), item.svgel.asPX('y')]
  }

  function set_shape(item, shape){
  }

  module.exports = viral.extend({
    init: function(chart, name, attrs){
      name = name || 'rect'
      attrs = attrs || {width: 100, height: 100}
      this.svgel = chart.svgel.el(name).attr(attrs)
    }
//   modify item -> item
    //   position
    , position: enslave(position)
    //   css
    //   type
    , shape: enslave(set_shate)
    //   active enabled/disabled
    //   visible hidden/visible
    //   selected true/false
    //
    //   dom_element
  })
}()
