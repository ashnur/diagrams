void function(){

  var log = console.log.bind(console)
  var zipg = require('../util/zips.js').zipGreedy

  // [a] → a
  function first(as){ return as && as[0] }

  // [a] → a
  function last(as){ return as && as[as.length - 1] }

  // a → Boolean
  function not_null(a){ return a != null }

  // (a, b) → Boolean
  function equal(a, b){ return a === b }

  // (a1 → a2 → ... → aN → b) → (#[a1, a2, ..., aN) → b)
  function spread(f){
    return function(args){ return f.apply(this, args) }
  }

  // ([a], a) → Integer
  function count(arr, value){
    return arr.filter(function(elem){ return elem == value }).length
  }

  // ([a], [a]) → Boolean
  function equal_lists(l1, l2){
    return zipg(l1, l2).every(spread(equal))
  }

  // ([[a]], [a]) → Boolean
  function find_sublist(lists, l){
    return lists.some(equal_lists.bind(null, l))
  }

  // (MergedEdge, MergedEdge) → Boolean
  function me_equal(a, b){
    return a.every(function(ae){
      return find_sublist(b, ae)
    })
  }

  // [a] → [a]
  function unique(list){
    return list.filter(function(x, i){ return list.indexOf(x) == i })
  }

  // ([[a]] → [a])
  function flatten(nested){
    return [].concat.apply([], nested)
  }

  // (Number, Node) → Boolean
  function same_rank(crn, n){ return n.true_rank == crn }

  // MergedEdge → [Node]
  function me_node(selector, merged_edge){
    return merged_edge.map(selector).filter(not_null)
  }

  // (Edge → Node) → [MergedEdges]
  function get_transforms(selector, same_edge){

    var me_node_bound = me_node.bind(null, selector)

    // [MergedEdge] → [[Node]]
    function mes_nodes(mes){
      return mes.map(me_node_bound)
    }

    // (MergedEdge, MergedEdge) → Boolean
    function different_edge(a, b){
      return ! same_edge(a, b)
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function different_edges(mes, me){
      return mes.filter(different_edge.bind(null, me))
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function same_edges(mes, me){
      return mes.filter(same_edge.bind(null, me))
    }

    // ([MergedEdge], MergedEdge) → [MergedEdge]
    function new_edges(all, diff, same, me){
      var mes_s = mes_nodes(all)
      var has_me = me_equal.bind(null, me)
      var is_me_new = all.length == 0 || ! ( diff.some(has_me) ||  same.some(has_me))
      return is_me_new ? [me] : []
    }

    return {
      different_edges: different_edges
    , same_edges: same_edges
    , new_edges: new_edges
    }
  }

  function source(edge){
    var first_point = first(edge)
    return first_point && first_point.exit
  }

  // (MergedEdge, MergedEdge) → Boolean
  function same_source(a, b){
    var ans = unique(me_node(source, a))
    var cgn = first(ans).true_rank
    var bns = unique(me_node(source, b).filter(same_rank.bind(null, cgn)))
    return equal_lists(ans, bns)
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_source(b, a){
    var b_sources = b.map(first)
    var a_source = first(a)

    b.forEach(function(b_source){
      b_source[0].remove()
      b_source[0] = a_source[0]
      b_source[1] = a_source[1]
      b_source[2].exit_junction = b_source[1]
    })
    return a.concat(b)
  }

  // Edge → Node
  function target(edge){
    var last_point = last(edge)
    return last_point && last_point.entry
  }

  // (MergedEdge, MergedEdge) → Boolean
  function same_target(a, b){
    var an = me_node(target, a)
    var cgn = first(an).true_rank
    var ns =  me_node(target, b).filter(same_rank.bind(null, cgn))
    return equal_lists(ns, an)
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_target(b, a){
    var me_target = me_node.bind(null, target)
    var b_targets = me_target(b)
    var edges_to_merge = a.filter(function(edge){
      return b_targets.indexOf(target(edge)) > -1
    })
    edges_to_merge.forEach(function(edge_to_merge){
      var a_end = edge_to_merge.length - 1
      b.forEach(function(b_edge){
        var b_end = b_edge.length - 1
        if ( target(edge_to_merge) == target(b_edge) ) {
          b_edge[b_end].remove()
          b_edge[b_end] = edge_to_merge[a_end]
          b_edge[b_end - 1] = edge_to_merge[a_end - 1]
          b_edge[b_end - 2].exit_junction = b_edge[b_end - 1]
          if ( b_end == 3 && a_end == 5 ) {
            // edge_to_merge[3].relative = b_edge[0]
            edge_to_merge[4].relative = b_edge[1]

          } else if ( b_end == 5 && a_end == 3 ) {
            b_edge[3].relative = edge_to_merge[2]
          } else if ( b_end == 5 && a_end == 5 ) {
          }
        }
      })
    })

    return a.concat(b)
  }


  module.exports = function(edges){
    var mes = edges.map(function(g){ return [g] })

    ;[
      [source, merge_by_source, same_source]
    , [target, merge_by_target, same_target]
    ].forEach(spread(function(selector, merge, same_edge){
      var tr = get_transforms(selector, same_edge)
      var guard = 0
      function rec(mes, t_count){
        mes = mes.reduce(function collapse(mes, me){
          var dt = tr.different_edges(mes, me)
          var st = tr.same_edges(mes, me)
          var mt = st.map(merge.bind(null, me))
          var nt = tr.new_edges(mes, dt, mt, me)
// log('diff', dt, 'merg', mt, 'new' ,nt)
          t_count += mt.length
          return dt.concat(mt, nt)
        }, [])
        // log(mes)

        // log(t_count)
        return t_count > 0 && ++guard < 10 ? rec(mes, 0) : mes
      }
      mes = rec(mes, 0)
      // log(guard)
    }))


    return flatten(mes)
  }


}()
