void function(){
  var log = console.log.bind(console)
  module.exports = function(steps, step){
    var exit_doubles = steps.filter(function(s){ return s[0].relative == step[0].relative })
    if ( exit_doubles.length == 1 ) {
      var exit_double = exit_doubles.reduce(function(_,s){ return s}, false)
      step[0].remove()
      step[1].remove()
      step[0] = exit_double[0]
      step[1] = exit_double[1]
      step[2].exit_junction = step[1]
    } else if ( exit_doubles.length > 1 ) {
      log(exit_doubles)
    }
    steps.push(step)
    return steps
  }
}()
