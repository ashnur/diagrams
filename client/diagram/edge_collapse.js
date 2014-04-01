void function(){
  var log = console.log.bind(console)
  var zipg = require('../util/zips.js').zipGreedy

  // [a] → a
  function first(as){ return as && as[0] }

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
  function flatten(nested){ return [].concat.apply([], nested) }

  // Edge → [Edge]
  function MergedEdge(edge){ return [edge] }

  // Edge → Node
  function source(edge){
    var first_point = first(edge)
    return first_point && first_point.exit
  }

  // MergedEdge → Node
  function me_source(merged_edge){ return source(first(merged_edge)) }

  // [MergedEdge] → [Node]
  function mes_sources(mes){ return mes.map(me_source).filter(not_null) }

  // (MergedEdge, MergedEdge) → Bool
  function same_source(a, b){ return me_source(a) === me_source(b) }

  // (MergedEdge, MergedEdge) → Bool
  function different_source(a, b){ return me_source(a) !== me_source(b) }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function different_sources(mes, me){
    return mes.filter(different_source.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function same_sources(mes, me){
    return mes.filter(same_source.bind(null, me))
  }

  // ([MergedEdge], MergedEdge) → [MergedEdge]
  function new_sources(mes, me){
    var me_s = me_source(me)
    var mes_s = mes_sources(mes)
    var is_me_new = mes_s.indexOf(me_s) == -1
    return is_me_new ? [me] : []
  }

  // (MergedEdge, MergedEdge) → MergedEdge
  function merge_by_source(b, a){
// log(a, b)
    b[0][0].remove()
    b[0][0] = a[0][0]
    b[0][1] = a[0][1]
    b[0][2].exit_junction = b[0][1]
    return a.concat(b)
  }

  module.exports = function(edges){
    var mes = edges.map(MergedEdge)
                   .reduce(function(mes, me){
      // log(mes)

      var ds = different_sources(mes, me)
      // log(ds)

      var ss = same_sources(mes, me)
      var ms = ss.map(merge_by_source.bind(null, me))
      // log(ms)

      var ns = new_sources(mes, me)
      // log(ns)


      return ds.concat(ms, ns)
    }, [])

//      var exit_double = exit_doubles.reduce(function(_,me){ return me}, false)
//    var exit_doubles =
//                            .filter(function(me){
//                              return me[0].exit == edge[0].exit
//                            })
//

log(mes, flatten(mes))
    return flatten(mes)
  }
}()
