void function(){
  module.exports = function pluck(name){
    return function getAttr(obj){ return obj[name] }
  }
}()
