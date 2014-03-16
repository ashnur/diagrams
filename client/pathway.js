void function(){
  var viral = require('viral')
  var Set = require('./set.js')
  var enslave = require('enslave')

  function clone(A){
    return Pathway.make(A.sources, A.edges, A.targets)
  }

  function union(A, B){

    return Pathway.make(A.sources.union(B.sources)
                      , A.edges.union(B.edges)
                      , A.targets.union(B.targets))
  }

  function same(A, B){

    return A.sources.joint(B.sources) ||
           A.edges.joint(B.edges) ||
           A.targets.joint(B.targets)
  }

  var Pathway = viral.extend({
    init: function(sources, edges, targets){
      this.sources = sources != null ? sources : Set.make()
      this.edges = edges != null ? edges : Set.make()
      this.targets = targets != null ? targets : Set.make()
    }
  , same: enslave(same)
  , clone: enslave(clone)
  , union: enslave(union)
  })

  function indexOf(P, p){
    for ( var i = 0; i < P.values.length; i++ ) {
      if ( same(P.values[i], p) ) return i
    }
    return -1
  }

  function size(pathways){
    return pathways.values.length
  }


  function forEach(pathways, fn){
    pathways.values.forEach(fn)
  }

  function add(pathways, source, edge, target){

    var n = Pathway.make(Set.make().add(source), Set.make().add(edge), Set.make().add(target))

    var h = indexOf(pathways, n)
    if ( h > -1  ) {
      pathways.values[h] = pathways.values[h].union(n)
    } else {
      pathways.values.push(n)
    }

    return pathways
  }

  var Pathways = Set.extend({
    add: enslave(add)
  , indexOf: enslave(indexOf)
  })


  module.exports = Pathways


}()
