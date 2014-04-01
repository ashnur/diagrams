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

  // (a, b) → Boolean
  function not_equal(a, b){ return a !== b }

  // (a1 → a2 → ... → aN → b) → (#[a1, a2, ..., aN) → b)
  function spread(f){
    return function(args){ return f.apply(this, args) }
  }

  // [[a]] → [a]
  function longest(ls){
    return ls.reduce(function(longest, l){
      return longest.length < l.length ? l : longest
    })
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
    return last_point && last_point.entry
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

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_target(b, a){
 //log(a, b)
    var b_entries = b.map(last)
    var a_entry = longest(a)
    var a_end = a_entry.length - 1

    b.forEach(function(b_entry){
      var b_end = b_entry.length - 1
      b_entry[b_end].remove()
      b_entry[b_end] = a_entry[a_end]
      b_entry[b_end - 1] = a_entry[a_end - 1]
//      b_entry[b_end - 2].entry_junction = b_entry[b_end - 1]
      if ( b_end == 5 && a_end == 5) {
        b_entry[1] = a_entry[1]
        b_entry[2] = a_entry[2]
        b_entry[3] = a_entry[3]
      }
    })

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

      return s
    }, []).reduce(function(mes, me){

      var dt = different_targets(mes, me)
      var st = same_targets(mes, me)
// log(st)
      var mt = st.map(merge_by_target.bind(null, me))
      var nt = new_targets(mes, me)

      return dt.concat(mt, nt)
    }, [])


//log(mes, flatten(mes))
    return flatten(mes)
  }
}()
