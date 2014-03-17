void function(){
  "use strict"
  var rt = require('random-token')
  var rnd = require('random-number')
  var fs = require('fs')
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
  , rank_detection_error_margin: 2
  , edgeWidth: 5
  , edgeClass: 'FCHLine'
  , edgeEndClass: 'FCHLine-witharrow'
  , intersectionClass: 'FCHLine-intersection'
  })

  var graph = wt.graph({
    rankDir: 'LR'
  , universalSep: 29
  , edgeSep: 0
  , rankSep: 150
  })

  var nodes = Array(12)
  var ranks = ['same_first','same_second','same_second','same_second','same_third','same_third','same_third','same_third','same_third','same_fourth','same_fourth','same_fourth']
  for ( var i = 0; i < nodes.length ; i++ ) {
    nodes[i] = graph.add_node(
      'FCHBox'
    , function (node, values){
// these lines shouldn't be here
        node.attr('x', values.x)
        node.attr('y', values.y)
        var x = values.x - values.width / 2
        var y = values.y - values.height / 2
        node.add_attr(':first', 'transform', 'translate(' + x + ',' + y + ')')
        node.add_attr('.FCHBox-Text-bg', 'width', values.width )
        node.add_attr('.FCHBox-Text-bg', 'height', values.height)
    }
    , {
        ".FCHBox-Text-title": {_text: (i+1) +' ' + lipsum().slice(0, 17)}
      , ".FCHBox-Text-type" : {_text: 'Type: ' + lipsum().slice(0, 13)}
    }, ranks[i])
  }

  // var rnd_node = rnd.generator({min: 0, max: nodes.length - 1, integer: true})
  // var links= Array(rand_int(1, Math.pow(rand_int(1, nodes.length), 2) - 1))
  var connections = [
    [0,1]
  , [0,2]
  , [0,3]
  , [1,4]
  , [1,5]
  , [1,6]
  , [3,9]
  , [2,7]
  , [2,8]
  , [4,9]
  , [6,9]
  , [5,10]
  , [7,11]
  , [8,11]
  , [9,7]
  , [9,8]
  , [9,11]
  , [10,7]
  , [10,8]
  , [10,11]
  ]
  var links = Array(connections.length)


  function but(gen, x){
    var r = gen()
    while ( r == x ) { r = gen() }
    return r
  }


  for ( var i = connections.length - 1; i >= 0 ; i-- ) {
    //var link1 = rnd_node()

    links[i] = graph.connect(
      'FCHLine'
    // , nodes[link1]
    // , nodes[but(rnd_node, link1)]
    , nodes[connections[i][0]]
    , nodes[connections[i][1]]
  )

  }

  var diagram = wt.diagram(config, graph)
  diagram.to_defs(fs.readFileSync('../resources/font.svg'))
  // diagram.to_defs(fs.readFileSync('../resources/background.svg'))
  diagram.to_defs(fs.readFileSync('../resources/item.svg'))
  diagram.to_defs(fs.readFileSync('../resources/line-pattern.svg'))
  diagram.to_defs(fs.readFileSync('../resources/line-arrow.svg'))
  diagram.to_defs(fs.readFileSync('../resources/line-intersection.svg'))
  diagram.to_defs(fs.readFileSync('../resources/line.svg'))
  diagram.to_defs(fs.readFileSync('../resources/line-witharrow.svg'))
  diagram.display()


}()
