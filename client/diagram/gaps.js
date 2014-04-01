void function(){
  var viral = require('viral')
  var enslave = require('enslave')

  function get_edges_combined(gap){
    return gap.get_gaps().reduce(function(l, g){
      return l.concat( []
      , g.forward_skips
      , gap.forward_skips
      , g.steps
      , gap.backward_skips
      , g.backward_skips
      )
    }, [])
  }

  function get_edges(gap){
    return gap.get_gaps().reduce(function(edges, edge){
      return edges.concat(edge.forward_skips.concat(edge.steps, edge.backward_skips))
    }, [])
  }

  function get_steps(gap){
    return gap.get_gaps()[gap.index].steps
  }

  module.exports = viral.extend({
    init: function(prev_rank, rank, rn, steps, skips){
      var exits = prev_rank.reduce(function(s, n){ return s.concat(n.exit_points) }, [])
      var entries = rank.reduce(function(s, n){ return s.concat(n.entry_points)  }, [])
      this.exits = exits
      this.entries = entries
      this.steps = exits.filter(function(exit){
                          return rank.indexOf(exit.entry) > -1
                        })
                        .map(steps.bind(null, this))

      this.forward_skips = exits.filter(function(exit){
                                  return rank.indexOf(exit.entry) == -1 && exit.entry.true_rank - rn > 0
                                })
                                .map(skips.bind(null, this, 'forward'))

      this.backward_skips = exits.filter(function(exit){
                                  return rank.indexOf(exit.entry) == -1 && rn - exit.entry.true_rank >= 0
                                })
                                .map(skips.bind(null, this, 'backward'))

      this.paths_count = (entries.length + exits.length - this.steps.length + 1)
      this.index = rn
    }
  , edges: enslave(get_edges)
  , edges_combined: enslave(get_edges_combined)
  , get_steps: enslave(get_steps)

  })

}()
