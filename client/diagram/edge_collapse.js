void function(){

  var log = console.log.bind(console)
  var zipg = require('../util/zips.js').zipGreedy

  // [a] → a
  function first(as){ return as && as[0] }

  // a → Boolean
  function not_null(a){ return a != null }

  // (a, b) → Boolean
  function equal(a, b){ return a === b }

  // ([a], [a]) → Boolean
  function equal_lists(l1, l2){
    return zipg(l1, l2).every(spread(equal))
  }

  // [a] → [a]
  function unique(list){
    return list.filter(function(x, i){ return list.indexOf(x) == i })
  }

  // ([[a]] → [a])
  function flatten(nested){
    return [].concat.apply([], nested)
  }

  // ([[Node]], [Node]) → Boolean
  function find_nodes(lists, l){
    var nodes = unique(flatten(lists))
    return l.every(function(n){
//log(n, nodes, nodes.indexOf(n) )
      return nodes.indexOf(n) > -1
    })
  }

  // ([[Node]], [Node]) → Boolean
  function find_sublist(lists, l){
    return lists.some(equal_lists.bind(null, l))
  }

  // (a1 → a2 → ... → aN → b) → (#[a1, a2, ..., aN) → b)
  function spread(f){
    return function(args){ return f.apply(this, args) }
  }

  // (Edge → Node) → [MergedEdges]
  function get_transforms(node){

    // MergedEdge → [Node]
    function me_node(merged_edge){
      return merged_edge.map(node).filter(not_null)
    }

    // [MergedEdge] → [[Node]]
    function mes_nodes(mes){
      return mes.map(me_node)
    }

    // (MergedEdge, MergedEdge) → Bool
    function same_node(a, b){
      return equal_lists(unique(me_node(a)), unique(me_node(b)))
    }

    // (MergedEdge, MergedEdge) → Bool
    function different_node(a, b){
      return ! equal_lists(unique(me_node(a)), unique(me_node(b)))
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function different_nodes(mes, me){
      return mes.filter(different_node.bind(null, me))
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function same_nodes(mes, me){
// log(mes.filter(same_node.bind(null, me)))
      return mes.filter(same_node.bind(null, me))
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function new_nodes(mes, me){
      var mes_s = mes_nodes(mes)
      var is_me_new = mes.length == 0 || (! find_nodes(mes_s, me_node(me)))
//log(mes.length == 0 , ! find_nodes(mes_s, me_node(me)))
      return is_me_new ? [me] : []
    }

    return {
      different_nodes: different_nodes
    , same_nodes: same_nodes
    , new_nodes: new_nodes
    }
  }


  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_source(b, a){
    var b_exits = b.map(first)
    var a_exit = first(a)

    b.forEach(function(b_exit){
      b_exit[0].remove()
      b_exit[0] = a_exit[0]
      b_exit[1] = a_exit[1]
      b_exit[2].exit_junction = b_exit[1]
    })
    return a.concat(b)
  }
  function source(edge){
    var first_point = first(edge)
    return first_point && first_point.exit
  }


  module.exports = function(edges){
    var mes = edges.map(function(g){ return [g] })

    ;[[source, merge_by_source]].forEach(spread(function(selector, merge){
      var tr = get_transforms(selector)
      var guard = 0
      function rec(mes, t_count){
        mes = mes.reduce(function collapse(mes, me){
          var dt = tr.different_nodes(mes, me)
          var st = tr.same_nodes(mes, me)
          var mt = st.map(merge.bind(null, me))
          var nt = tr.new_nodes(mes, me)
//log(dt, mt, nt)
          t_count += mt.length
          return dt.concat(mt, nt)
        }, [])
        // log(mes)

        // log(t_count)
        return t_count > 0 && ++guard < 10 ? rec(mes, 0) : mes
      }
      mes = rec(mes, 1)
      // log(guard)
    }))

/*
*/
// log(mt.length, nt.length)
         //return  > 0 &&


    return flatten(mes)
  }


}()
