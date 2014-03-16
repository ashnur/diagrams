void function(){
  var viral = require('viral')
  var enslave = require('enslave')

  function size(arr){
    return arr.values.length
  }

  function clone(arr){
    return Arr.make(arr)
  }

  function forEach(set, fn){
    set.values.forEach(fn)
  }

  function reduce(set, fn, init){
    if ( init !== undefined ) {
      return set.values.reduce(fn, init)
    } else {
      return set.values.reduce(fn)
    }
  }

  function map(set, fn){
    return set.values.map(fn)
  }

  function some(set, fn){
    return set.values.some(fn)
  }

  function indexOf(set, value){
    return set.values.indexOf(value)
  }

  var Arr = viral.extend({
    init: function(arr){
      this.values = arr != null ? arr.values.slice(0) : []
    }
  , forEach: enslave(forEach)
  , reduce: enslave(reduce)
  , map: enslave(map)
  , some: enslave(some)
  , size: enslave(size)
  , clone: enslave(clone)
  , indexOf: enslave(indexOf)
  })

  module.exports = Arr

}()
