void function(){
  "use strict"
  module.exports = function defaults(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source){
      for (var prop in source) {
        if (obj[prop] === undefined) obj[prop] = source[prop]
      }
    })
    return obj
  }
}()
