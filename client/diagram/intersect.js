void function(){

  var V = require('./vectors.js')

  module.exports = function(seg1, seg2){
    var p = [seg1.x1, seg1.y1]
    var r = V.subtract([seg1.x2, seg1.y2], p)
    var q = [seg2.x1, seg2.y1]
    var s = V.subtract([seg2.x2, seg2.y2], q)

    var rxs = V.cross(r, s)
    if ( rxs == 0 ) return false

    var q_p = V.subtract(q,p)
    var rxs = V.cross(r, s)
    var t = V.cross(q_p, s) / rxs
    if ( t < 0 || t > 1 ) return false
    var u = V.cross(q_p, r) / rxs
    if ( u < 0 || u > 1 ) return false

    // var z1 = V.add(p, V.scale(r, t))
    // var z2 = V.add(q, V.scale(s, u))

    return V.add(p, V.scale(r, t))
  }

}()
