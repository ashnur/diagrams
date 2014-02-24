void function(){
  "use strict"
  var test = require('tape')
  var rt = require('random-token')
  var page = require('../index.js')
  var dom = require('../dom.js')

  function isNumber(n){
    return typeof n == 'number'
  }

  var s = page.make()

  test('add svg to dom', function(t) {
    var id = rt(8)
    s.svgel.attr({id: id})
    t.is(s.svgel.node, dom.$id(id))
    t.end()
  })

  test('add items to canvas', function(t) {
    var chart = s.addChart()
    t.ok(chart.position().every(isNumber))

    var item = chart.addItem()
    t.ok(item.position().every(isNumber))

    //   css
    //   type
    //   active enabled/disabled
    //   visible hidden/visible
    //   selected true/false
    //
    //   dom_element
    t.end()
  })


//  test('manage charts', function(t) {
//    // charts
//    //   layout
//    //   add item
//    //   modify item -> item
//    //   connect item, item -> layout
//    //   disconnect item, item -> layout
//    //   filter layout -> [item]
//    t.end()
//  })



}()
