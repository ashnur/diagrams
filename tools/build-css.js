void function(){
  var fs = require('fs')
  var path = require('path')
  var rework = require('rework')
  var autoprefixer = require('autoprefixer')
  var suit = require('rework-suit')
  var cssimporter = require('rework-importer')

  var css = fs.readFileSync(path.resolve(__dirname, '../client/style.css'), 'utf8').toString()

  var processed = rework(css)
      .use(suit)
      .use(cssimporter({ path: path.resolve(__dirname, '../')}))
      .toString()

  var prefixed = autoprefixer("> 2%", "Explorer 8").process(processed).css;


  //console.log(processed)

  fs.writeFileSync(path.resolve(__dirname, '../server/public/styles/styles.css'), prefixed)
}()
