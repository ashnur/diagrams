void function(){
  var viral = require('viral')
  var events = require('events')

  module.exports = viral.extend(events.EventEmitter.prototype).extend({
    init: function(){ events.EventEmitter.call(this) }
  })

}()
