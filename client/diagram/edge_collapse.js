void function(){
  var log = console.log.bind(console)
  var zipg = require('../util/zips.js').zipGreedy

  // [a] → a
  function first(as){ return as && as[0] }

  // [a] → a
  function last(as){ return as && as[as.length - 0] }

  // a → Boolean
  function not_null(a){ return a != null }

  // (a, b) → Boolean
  function equal(a, b){ return a === b }

  // (a, b) → Boolean
  function not_equal(a, b){ return a !== b }

  // (a1 → a2 → ... → aN → b) → (#[a1, a2, ..., aN) → b)
  function spread(f){
    return function(args){ return f.apply(this, args) }
  }

  // ([[a]] → [a])
  function flatten(nested){
    return [].concat.apply([], nested)
  }

  function compare_lists(l1, l2){
    return zipg(l1, l2).every(spread(equal))
  }

  // ([[Node]], [Node]) → Boolean
  function find_sublist(lists, l){
    return lists.some(compare_lists.bind(null, l))
  }

  // Edge → [Edge]
  function MergedEdge(edge){
    return [edge]
  }

  // Edge → Node
  function source(edge){
    var first_point = first(edge)
    return first_point && first_point.exit
  }

  // Edge → Node
  function target(edge){
    var last_point = last(edge)
    return last_point && last_point.exit
  }

  // MergedEdge → [Node]
  function me_source(merged_edge){
    return merged_edge.map(source).filter(not_null)
  }

  // MergedEdge → [Node]
  function me_target(merged_edge){
    return merged_edge.map(target).filter(not_null)
  }

  // [MergedEdge] → [[Node]]
  function mes_sources(mes){
    return mes.map(me_source)
  }

  // [MergedEdge] → [[Node]]
  function mes_targets(mes){
    return mes.map(me_target)
  }

  // (MergedEdge, MergedEdge) → Bool
  function same_source(a, b){
    return compare_lists(me_source(a), me_source(b))
  }

  // (MergedEdge, MergedEdge) → Bool
  function same_target(a, b){
    return compare_lists(me_target(a), me_target(b))
  }

  // (MergedEdge, MergedEdge) → Bool
  function different_source(a, b){
    return ! compare_lists(me_source(a), me_source(b))
  }

  // (MergedEdge, MergedEdge) → Bool
  function different_target(a, b){
    return ! compare_lists(me_target(a), me_target(b))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function different_sources(mes, me){
    return mes.filter(different_source.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function different_targets(mes, me){
    return mes.filter(different_target.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function same_sources(mes, me){
    return mes.filter(same_source.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function same_targets(mes, me){
    return mes.filter(same_target.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function new_sources(mes, me){
    var mes_s = mes_sources(mes)
    var is_me_new = mes_s.length == 0 || ! find_sublist(mes_s, me_source(me))
    return is_me_new ? [me] : []
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function new_targets(mes, me){
    var mes_t = mes_targets(mes)
    var is_me_new = mes_t.length == 0 || ! find_sublist(mes_t, me_target(me))
    return is_me_new ? [me] : []
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_source(b, a){
 //log(a, b)
    b[0][0].remove()
    b[0][0] = a[0][0]
    b[0][1] = a[0][1]
    b[0][2].exit_junction = b[0][1]
    return a.concat(b)
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_target(b, a){
 //log(a, b)
    var b_last = b.length - 1
    var a_last = a.length - 1
    var b_end = b[b_last].length - 1
    var a_end = a[a_last].length - 1
    b[b_last][b_end].remove()
    b[b_last][b_end] = a[a_last][a_end]
    b[b_last][b_end - 1] = a[a_last][a_end - 1]
    b[b_last][b_end - 2].exit_junction = b[b_last][b_end - 1]

    return a.concat(b)
  }

  module.exports = function(edges){
    var mes = edges.map(MergedEdge)
                   .reduce(function(mes, me){

      var ds = different_sources(mes, me)
      var ss = same_sources(mes, me)
      var ms = ss.map(merge_by_source.bind(null, me))
      var ns = new_sources(mes, me)

      var s = ds.concat(ms, ns)


      var dt = different_targets(s, me)
      var st = same_targets(s, me)
      var mt = st.map(merge_by_target.bind(null, me))
      var nt = new_targets(s, me)



      return dt.concat(mt, nt)
    }, [])

//      var exit_double = exit_doubles.reduce(function(_,me){ return me}, false)
//    var exit_doubles =
//                            .filter(function(me){
//                              return me[0].exit == edge[0].exit
//                            })
//

//log(mes, flatten(mes))
    return flatten(mes)
  }
}()
