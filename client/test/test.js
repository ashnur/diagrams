void function(){
  "use strict"
  var test = require('tape')
  var rt = require('random-token')
  var rnd = require('random-number')
  var fs = require('fs')
  var enslave = require('enslave')
  var wt = require('../index.js')
  var dom = require('../util/dom.js')
  var uid = require('../util/unique_id.js')
  var rand_int = rnd.generator({integer: true})
  var print = console.log.bind(console)

  var lipscfg = {
      count: 1                      // Number of words, sentences, or paragraphs to generate.
    , units: 'sentences'            // Generate words, sentences, or paragraphs.
    , sentenceLowerBound: 1         // Minimum words per sentence.
    , sentenceUpperBound: 2        // Maximum words per sentence.
    , format: 'plain'               // Plain text or html
  }
  var lipsum = require('lorem-ipsum').bind(null, lipscfg)

  function isNumber(n){ return typeof n == 'number' }

  var config = wt.config({
    padding: 21
  })
  var graph = wt.graph({
    rankDir: 'LR'
  , nodeSep: 50
  , edgeSep: 0
  , rankSep: 50
  })

  var nodes = Array(12)
  for ( var i = 0; i < nodes.length ; i++ ) {
    nodes[i] = graph.add_node(
      'FCHBox'
    , function (node, values){
        node.attr('x', values.x)
        node.attr('y', values.y)
        var x = values.x - values.width / 2
        var y = values.y - values.height / 2
        node.add_attr(':first', 'transform', 'translate(' + x + ',' + y + ')')
        node.add_attr('.FCHBox-Text-bg', 'width', values.width )
        node.add_attr('.FCHBox-Text-bg', 'height', values.height)

        //node.add_attr('rect', 'x', values.x - values.width / 2)
        //node.add_attr('rect', 'y', values.y - values.height / 2)
        // node.add_attr('rect', 'width', values.width )
        // node.add_attr('rect', 'height', values.height)
        // node.add_attr('text', 'y', values.y + 14 - values.height / 2) // TODO: 14 is half the line height, should come from config
        // node.add_attr('text tspan', 'x', values.x + 2 - values.width / 2) // TODO: 2 is distance from left border(aka. left padding), should come from config
    }
    , {
        ".FCHBox-Text-title": {_text: lipsum()}
      , ".FCHBox-Text-type" : {_text: 'Type: ' + lipsum()}
    })
  }

  var rnd_node = rnd.generator({min: 0, max: nodes.length - 1, integer: true})
  // var links= Array(rand_int(1, Math.pow(rand_int(1, nodes.length), 2) - 1))
  var links = Array(18)
  var connections = [
    [0,1]
  , [0,2]
  , [0,3]
  , [1,4]
  , [1,5]
  , [1,6]
  , [2,7]
  , [2,8]
  , [3,9]
  , [4,9]
  , [5,10]
  , [6,9]
  , [7,10]
  , [8,11]
  , [9,10]
  , [10,7]
  , [10,8]
  , [10,11]
  ]

  function but(gen, x){
    var r = gen()
    while ( r == x ) {
      r = gen()
    }
    return r
  }


  for ( var i = 0; i < links.length ; i++ ) {
    //var link1 = rnd_node()
    //print( nodes[link1])

    links[i] = graph.connect(
      'FCHLine'
    // , nodes[link1]
    // , nodes[but(rnd_node, link1)]
    , nodes[connections[i][0]]
    , nodes[connections[i][1]]
    , function(edge, values){
        //var points = [edge.from.
        //node.add_attr('line', 'x', values.x)
    }
    , {
    }
  )

  }

  var diagram = wt.diagram(config, graph)
  // diagram.to_defs(fs.readFileSync('../resources/plain_boring_box.shape'))
  // diagram.to_defs(fs.readFileSync('../resources/plain_boring_line.shape'))
  diagram.to_defs(fs.readFileSync('../resources/font.svg'))
  // diagram.to_defs(fs.readFileSync('../resources/background.svg'))
  diagram.to_defs(fs.readFileSync('../resources/item.svg'))
  diagram.to_defs(fs.readFileSync('../resources/line-pattern.svg'))
  diagram.to_defs(fs.readFileSync('../resources/line-arrow.svg'))
  diagram.to_defs(fs.readFileSync('../resources/line.svg'))
  diagram.display()

  test('diagram in the dom', function(t) {
    t.end()
  })

  test('adding and removing items', function(t) {

    t.end()
  })

  test('adding and removing connections', function(t) {

    t.end()
  })

  test('editing text', function(t) {

    t.end()
  })

  test('changing configuration', function(t) {

    t.end()
  })

  test('swapping entire graphs', function(t) {

    t.end()
  })





}()
