void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var dom = require('../utils/dom.js')

  function draw(shape, diagram){
    this.el = diagram.draw(shape)
  }

  function update_attr(shape, attr){
  }

  function update_attrs(shape, attrs){
  }

  var Shape = viral.extend({
    init: function(svg, attrs){
      this.svg = svg
      this.attrs = attrs
    }
  , draw: enslave(draw)
  , attr: enslave(update_attr)
  , attrs: enslave(update_attrs)
  })
  module.exports = Shape
}()
