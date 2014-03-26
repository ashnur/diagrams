void function(){
  var bee = require('beeline')
  var path = require('path')
  var fs = require('fs')

  function staticFile(name, type){
    var p = path.join(__dirname , '/public/', name)
    return bee.staticFile(p, type)
  }

  var maxage = 1

  module.exports = bee.route({
    '/': function(req, res){
      fs.createReadStream(path.join(__dirname, '/public/index.html')).pipe(res)
    }
  , '/scripts/`path...`': bee.staticDir(path.join(__dirname, "./public/scripts/"), {".js": "application/javascript"}, -1)
  , '/styles/`path...`': bee.staticDir(path.join(__dirname, "./public/styles/"), {".css": "text/css"}, -1)
  , '/resources/`path...`': bee.staticDir(path.join(__dirname, "./public/resources/"), {".svg": "text/text"})
  })
}()
