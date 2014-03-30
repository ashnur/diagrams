void function(){
  var viral = require('viral')
  var enslave = require('enslave')

  function get_edges(gap){
    return gap.get_gaps().reduce(function(l, g){
      return l.concat(
        g.steps
      , gap.forward_skips
      , gap.backward_skips
      , g.forward_skips
      , g.backward_skips)
    }, [])//.filter(function(p){ console.log(p);return p.gap_number() == gn })
s
  }

  module.exports = viral.extend({
    init: function(prev_rank, rank, rn, step_of_exit, forward_skip_of_exit, backward_skip_of_exit){
      var exits = prev_rank.reduce(function(s, n){ return s.concat(n.exit_points) }, [])
      var entries = rank.reduce(function(s, n){ return s.concat(n.entry_points)  }, [])
      this.exits = exits
      this.entries = entries
      this.steps = exits.filter(function(exit){ return rank.indexOf(exit.match) > -1 })
                        .map(step_of_exit.bind(null, this))

      this.forward_skips = exits.filter(function(exit){return exit.match.true_rank - rn > 0 })
                                .map(forward_skip_of_exit.bind(null, this))

      this.backward_skips = entries.filter(function(entry){ return entry.match.true_rank - rn >= 0 })
                                   .map(backward_skip_of_exit.bind(null, this))

      this.paths_count = (entries.length + exits.length - this.steps.length + 1)
      this.index = rn
    }
  , edges: enslave(get_edges)

  })

}()
