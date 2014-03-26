void function(){
  var viral = require('viral')
  var enslave = require('enslave')

  function size(arr){
    return arr.values.length
  }

  function clone(arr){
    return Arr.make(arr)
  }

  function forEach(arr, fn){
    arr.values.forEach(fn)
  }

  function filter(arr, fn){
    return arr.values.filter(fn)
  }

  function reduce(arr, fn, init){
    if ( init !== undefined ) {
      return arr.values.reduce(fn, init)
    } else {
      return arr.values.reduce(fn)
    }
  }

  function map(arr, fn){
    return arr.values.map(fn)
  }

  function some(arr, fn){
    return arr.values.some(fn)
  }

  function indexOf(arr, value){
    return arr.values.indexOf(value)
  }

  var Arr = viral.extend({
    init: function(arr){
      this.values = arr != null ? arr.values.slice(0) : []
    }
  , forEach: enslave(forEach)
  , reduce: enslave(reduce)
  , filter: enslave(filter)
  , map: enslave(map)
  , some: enslave(some)
  , size: enslave(size)
  , clone: enslave(clone)
  , indexOf: enslave(indexOf)
  })

  module.exports = Arr

}()
