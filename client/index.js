void function(){
//  var Snap = require('snapsvg')
//    init: function(){
//      this.svgel = Snap.apply(Snap, arguments)
//    }

  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^\s+|\s+$/g, '')
    }
  }

  var defaults = require('./util/defaults.js')
  var Graph = require('./graph/graph.js')
  var Diagram = require('./diagram/diagram.js')


  /**
  * Set default configuration
  * @param      {Object} options
  * @return     {Object} options filled with defaults
  */
  function config(cfgobj){
    var default_cfg = {
      width: window.innerWidth
    , height: window.innerHeight
    , font_size: 21
    , line_height: 26 // for font-size 21
    }
    return cfgobj == null ? default_cfg
         :                  defaults(cfgobj, default_cfg)
  }

  /**
  * Create a new graph object to store diagram data in it
  * @return     {Object}   graph object
  */
  function graph(){
    return Graph.make()
  }

  /**
  * Initialize diagram with options and graph object
  * and register event handlers
  * @param      {Object}   options
  * @param      {Object}   graph object
  * @return     {Object}   diagram
  */
  function diagram(cfgobj, graph){
    return Diagram.make(cfgobj, graph)
  }


  module.exports = {
    config: config
  , graph: graph
  , diagram: diagram
  }

}()
