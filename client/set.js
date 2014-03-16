void function(){
  var viral = require('viral')
  var enslave = require('enslave')
  var Arr = require('./arr.js')


  function has(set, value){
    return set.indexOf(value) > -1
  }

  function add(set, value){
    if ( ! has(set, value) ) {
      set.values.push(value)
    }
    return set
  }

  function remove(set, value){
    var idx = indexOf(set, value)
    if ( idx > -1 ) {
      set.values.splice(idx, 1)
    }
    return set
  }

  function same(set, other){
    return set.values.length != other.values.length ? false
         : set.values.every(function(a){ return other.has(a) })
  }

  function union(set, other){
    var result = set.clone()
    other.forEach(function(v){
      result.add(v)
    })
    return result
  }

  function joint(set, other){
    return set.some(function(a){ return other.has(a) })
  }

  function clone(set){
    return Set.make(set)
  }

  var Set = Arr.extend({
    union: enslave(union)
  , has: enslave(has)
  , add: enslave(add)
  , remove: enslave(remove)
  , same: enslave(same)
  , joint: enslave(joint)
  , clone: enslave(clone)
  })

  module.exports = Set

}()
