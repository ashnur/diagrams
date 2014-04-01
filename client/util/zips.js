void function(){
  /* thanks Maxdamantus */
  module.exports = {
    zip: function(xs, ys){
      return Array.apply(null, Array(Math.min(xs.length, ys.length)))
                  .map(function(_, i){
                    return [xs[i], ys[i]]
                  })
    }

  , zipWith: function(fn, xs, ys){
      return Array.apply(null, Array(Math.min(xs.length, ys.length)))
                  .map(function(_, i){
                    return fn(xs[i], ys[i])
                  })
    }

  , zipGreedy: function(xs, ys){
      return Array.apply(null, Array(Math.max(xs.length, ys.length)))
                  .map(function(_, i){
                    return [xs[i], ys[i]]
                  })
    }

  , zipWithGreedy: function(fn, xs, ys){
      return Array.apply(null, Array(Math.max(xs.length, ys.length)))
                  .map(function(_, i){
                    return fn(xs[i], ys[i])
                  })
    }
  }
}()
