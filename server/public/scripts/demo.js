void function(){
  "use strict"

  var rand_int = RandomNumber.generator({integer: true})

  var lipscfg = {
      count: 1                      // Number of words, sentences, or paragraphs to generate.
    , units: 'sentences'            // Generate words, sentences, or paragraphs.
    , sentenceLowerBound: 1         // Minimum words per sentence.
    , sentenceUpperBound: 2        // Maximum words per sentence.
    , format: 'plain'               // Plain text or html
  }

  var lipsum = LoremIpsum.bind(null, lipscfg)

  function isNumber(n){ return typeof n == 'number' }

  var config = Diagram.config({
    padding: 40
  , rank_detection_error_margin: 2
  , skipSep: 32
  , edgeWidth: 8
  , edgeClass: 'FCHLine'
  , edgeEndClass: 'FCHLine-witharrow'
  , intersectionClass: 'FCHLine-intersection'
  , layout_config: {
      rankDir: 'LR'
    , universalSep: 32
    , edgeSep: 0
    , rankSep: 136
    }
  })


  var graph_ranked = Diagram.graph()
  var graph_unranked = Diagram.graph()
  var graph_random_1 = Diagram.graph()
  var graph_random_2 = Diagram.graph()
  var graph_random_3 = Diagram.graph()

  var ranked_nodes = Array(12)
  var unranked_nodes = Array(12)
  var ranks = ['same_first','same_second','same_second','same_second','same_third','same_third','same_third','same_third','same_third','same_fourth','same_fourth','same_fourth']

  for ( var i = 0; i < ranked_nodes.length ; i++ ) {
    ranked_nodes[i] = graph_ranked.add_node(
      'FCHBox'
    , (function (i, node, values){
        node.add_attr('.FCHBox-Text-bg', 'width', values.width )
        node.add_attr('.FCHBox-Text-bg', 'height', values.height)
        node.label = i +''
    }).bind(null, i + 1)
    , {
        ".FCHBox-Text-title": {_text: (i+1) +' ' + lipsum().slice(0, 17)}
      , ".FCHBox-Text-type" : {_text: 'Type: ' + lipsum().slice(0, 13)}
    }, ranks[i])
  }

  for ( var i = 0; i < unranked_nodes.length ; i++ ) {
    unranked_nodes[i] = graph_unranked.add_node(
      'FCHBox'
    , (function (i, node, values){
        node.add_attr('.FCHBox-Text-bg', 'width', values.width )
        node.add_attr('.FCHBox-Text-bg', 'height', values.height)
        node.label = i +''
    }).bind(null, i + 1)
    , {
        ".FCHBox-Text-title": {_text: (i+1) +' ' + lipsum().slice(0, 17)}
      , ".FCHBox-Text-type" : {_text: 'Type: ' + lipsum().slice(0, 13)}
    })
  }

  // var random_nodes = Array(rand_int(5, 20))
  var random_nodes_1 = Array(4)

  for ( var i = 0; i < random_nodes_1.length ; i++ ) {
    random_nodes_1[i] = graph_random_1.add_node(
      'FCHBox'
    , (function(i, node, values){
        node.add_attr('.FCHBox-Text-bg', 'width', values.width )
        node.add_attr('.FCHBox-Text-bg', 'height', values.height)
        node.label = i + ''
    }).bind(null, i + 1) // this bind really is just for the `i` which is only for the control graph, otherwise a simple function declaration is enough
    , {
        ".FCHBox-Text-title": {_text: (i+1) +' ' + lipsum().slice(0, 17)}
      , ".FCHBox-Text-type" : {_text: 'Type: ' + lipsum().slice(0, 13)}
    }, 'same_rank' + i )
  }

  var random_nodes_2 = Array(5)

  for ( var i = 0; i < random_nodes_2.length ; i++ ) {
    random_nodes_2[i] = graph_random_2.add_node(
      'FCHBox'
    , (function(i, node, values){
        node.add_attr('.FCHBox-Text-bg', 'width', values.width )
        node.add_attr('.FCHBox-Text-bg', 'height', values.height)
        node.label = i + ''
    }).bind(null, i + 1) // this bind really is just for the `i` which is only for the control graph, otherwise a simple function declaration is enough
    , {
        ".FCHBox-Text-title": {_text: (i+1) +' ' + lipsum().slice(0, 17)}
      , ".FCHBox-Text-type" : {_text: 'Type: ' + lipsum().slice(0, 13)}
    })
  }

  var random_nodes_3 = Array(5)

  for ( var i = 0; i < random_nodes_3.length ; i++ ) {
    random_nodes_3[i] = graph_random_3.add_node(
      'FCHBox'
    , (function(i, node, values){
        node.add_attr('.FCHBox-Text-bg', 'width', values.width )
        node.add_attr('.FCHBox-Text-bg', 'height', values.height)
        node.label = i + ''
    }).bind(null, i + 1) // this bind really is just for the `i` which is only for the control graph, otherwise a simple function declaration is enough
    , {
        ".FCHBox-Text-title": {_text: (i+1) +' ' + lipsum().slice(0, 17)}
      , ".FCHBox-Text-type" : {_text: 'Type: ' + lipsum().slice(0, 13)}
    })
  }


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
  for ( var i = connections.length - 1; i >= 0 ; i-- ) {

    links[i] = graph_ranked.connect(
      'FCHLine'
    , ranked_nodes[connections[i][0]]
    , ranked_nodes[connections[i][1]]
    )

    links[i] = graph_unranked.connect(
      'FCHLine'
    , unranked_nodes[connections[i][0]]
    , unranked_nodes[connections[i][1]]
    )

  }

  // var rnd_node = RandomNumber.generator({min: 0, max: random_nodes.length - 1, integer: true})
  // var random_links = Array(rand_int(1, rand_int(1, random_nodes.length * 2)))
  var random_links_1 = Array(3)
  var random_links_2 = Array(5)
  var random_links_3 = Array(5)

  function but(gen, x){
    var r = gen()
    while ( r == x ) { r = gen() }
    return r
  }

  // for ( var i = random_links.length - 1; i >= 0 ; i-- ) {
  //   var link1 = rnd_node()
  //   links[i] = graph_random.connect(
  //     'FCHLine'
  //   , random_nodes[link1]
  //   , random_nodes[but(rnd_node, link1)]
  //   )
  // }
  links[0] = graph_random_1.connect( 'FCHLine' , random_nodes_1[0] , random_nodes_1[2])
  links[1] = graph_random_1.connect( 'FCHLine' , random_nodes_1[0] , random_nodes_1[3])
  links[2] = graph_random_1.connect( 'FCHLine' , random_nodes_1[1] , random_nodes_1[3])
  links[3] = graph_random_1.connect( 'FCHLine' , random_nodes_1[1] , random_nodes_1[0])

  links[0] = graph_random_2.connect( 'FCHLine' , random_nodes_2[0] , random_nodes_2[3])
  links[1] = graph_random_2.connect( 'FCHLine' , random_nodes_2[0] , random_nodes_2[4])
  links[2] = graph_random_2.connect( 'FCHLine' , random_nodes_2[1] , random_nodes_2[3])
  links[3] = graph_random_2.connect( 'FCHLine' , random_nodes_2[1] , random_nodes_2[4])
  links[4] = graph_random_2.connect( 'FCHLine' , random_nodes_2[2] , random_nodes_2[4])

  links[2] = graph_random_3.connect( 'FCHLine' , random_nodes_3[2] , random_nodes_3[3])
  links[0] = graph_random_3.connect( 'FCHLine' , random_nodes_3[0] , random_nodes_3[3])
  links[1] = graph_random_3.connect( 'FCHLine' , random_nodes_3[0] , random_nodes_3[4])
  links[4] = graph_random_3.connect( 'FCHLine' , random_nodes_3[3] , random_nodes_3[4])
  links[6] = graph_random_3.connect( 'FCHLine' , random_nodes_3[1] , random_nodes_3[0])
  links[5] = graph_random_3.connect( 'FCHLine' , random_nodes_3[1] , random_nodes_3[4])
  links[6] = graph_random_3.connect( 'FCHLine' , random_nodes_3[4] , random_nodes_3[2])

  var diagram_ranked = Diagram.diagram(config, graph_ranked)
  var diagram_unranked = Diagram.diagram(config, graph_unranked)
  var diagram_random_1 = Diagram.diagram(config, graph_random_1)
  var diagram_random_2 = Diagram.diagram(config, graph_random_2)
  var diagram_random_3 = Diagram.diagram(config, graph_random_3)

  var i = 0
  var defs = ['background.svg'
  , '/font.svg'
  , 'item.svg'
//  , 'line-pattern.svg'
  , 'line-arrow.svg'
  , '/line-intersection.svg'
  , '/line.svg'
  , '/line-witharrow.svg']

  var getdefsXhrOpts = {
      headers: { "Content-Type": "text/text" }
  }

  defs.forEach(function(def){
    getdefsXhrOpts.uri = '/resources/' + def
    XHR(getdefsXhrOpts, function(err, resp, body){
      diagram_ranked.to_defs(body)
      diagram_unranked.to_defs(body)
      diagram_random_1.to_defs(body)
      diagram_random_2.to_defs(body)
      diagram_random_3.to_defs(body)
      if ( ++ i == defs.length ) {
//        diagram_ranked.display()
//        document.getElementById('ranked_nodes').appendChild(diagram_ranked.node)
//        var renderer = new dagreD3.Renderer()
//        diagram_unranked.display()
//        document.getElementById('unranked_nodes').appendChild(diagram_unranked.node)
//        renderer.run(diagram_ranked.graph, d3.select("#ranked_control svg g"))
//        var renderer = new dagreD3.Renderer()
//        renderer.run(diagram_unranked.graph, d3.select("#unranked_control svg g"))
        diagram_random_1.display()
        document.getElementById('random_graph_1').appendChild(diagram_random_1.node)
        var renderer = new dagreD3.Renderer()
        renderer.run(diagram_random_1.graph, d3.select("#random_control_1 svg g"))
        diagram_random_2.display()
        document.getElementById('random_graph_2').appendChild(diagram_random_2.node)
        var renderer = new dagreD3.Renderer()
        renderer.run(diagram_random_2.graph, d3.select("#random_control_2 svg g"))
        diagram_random_3.display()
        document.getElementById('random_graph_3').appendChild(diagram_random_3.node)
        var renderer = new dagreD3.Renderer()
        renderer.run(diagram_random_3.graph, d3.select("#random_control_3 svg g"))

      }
    })
  })







}()
