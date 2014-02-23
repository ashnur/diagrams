void function(root){
  var http = require('http')
  var router = require('./routes.js')
  var app = http.createServer(router)

  app.listen(8001)


}(this)
