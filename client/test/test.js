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

  var lipscfg = {
      count: 1                      // Number of words, sentences, or paragraphs to generate.
    , units: 'sentences'            // Generate words, sentences, or paragraphs.
    , sentenceLowerBound: 1         // Minimum words per sentence.
    , sentenceUpperBound: 2        // Maximum words per sentence.
    , format: 'plain'               // Plain text or html
  }
  var lipsum = require('lorem-ipsum').bind(null, lipscfg)

  function isNumber(n){ return typeof n == 'number' }

  var config = wt.config({ })
  var graph = wt.graph()

  var nodes = Array(rand_int(2, 10))
  for ( var i = 0; i < nodes.length ; i++ ) {
    nodes[i] = graph.add_node(
      'PlainBoringBox'
    , function (node, values){
        node.add_attr('rect', 'x', values.x)
        node.add_attr('rect', 'y', values.y)
        node.add_attr('rect', 'width', values.width)
        node.add_attr('rect', 'height', values.height)
        node.add_attr('text', 'y', values.y + 14) // TODO: 14 is half the line height, should come from config
        node.add_attr('text tspan', 'x', values.x + 2) // TODO: 2 is distance from left border(aka. left padding), should come from config
    }
    , {
        ".PlainBoringBox-text-action_title": {_text: lipsum()}
      , ".PlainBoringBox-text-type" : {_text: 'TYPE' + ':' + lipsum()}
    })
  }

  var rnd_node = rnd.generator({min: 0, max: nodes.length - 1, integer: true})
  var links= Array(rand_int(1, Math.pow(rand_int(1, nodes.length), 2) - 1))

  function but(gen, x){
    var r = gen()
    while ( r == x ) {
      r = gen()
    }
    return r
  }

  for ( var i = 0; i < links.length ; i++ ) {
    var link1 = rnd_node()
    links[i] = graph.connect(
      'PlainBoringLine'
    , nodes[link1]
    , nodes[but(rnd_node, link1)]
    , function(edge, values){
        //var points = [edge.from.
        //node.add_attr('line', 'x', values.x)
    }
    , {
    }
  )

  }

  var diagram = wt.diagram(config, graph)
  diagram.to_defs(fs.readFileSync('../resources/plain_boring_box.shape'))
  diagram.to_defs(fs.readFileSync('../resources/plain_boring_line.shape'))
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
