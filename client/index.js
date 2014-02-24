void function(){
  var Snap = require('snapsvg')
  var viral = require('viral')
  var enslave = require('enslave')
  var Chart = require('./charts.js')


  function add_chart(page){
    var new_chart = Chart.make(page)
    return new_chart
  }

  function del_chart(page, attrs){
  }

  module.exports = viral.extend({
    init: function(){
      this.svgel = Snap.apply(Snap, arguments)
    }
  , addChart: enslave(add_chart)
  , delChart: enslave(del_chart)
  })
}()
