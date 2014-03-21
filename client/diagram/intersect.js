void function(){

  var V = require('./vectors.js')

  module.exports = function(seg1, seg2){
    var p = [seg1.x1, seg1.y1]
    var r = V.subtract([seg1.x2, seg1.y2], p)
    var q = [seg2.x1, seg2.y1]
    var s = V.subtract([seg2.x2, seg2.y2], q)

    // collinear overlapping            1
    // collinear disjoing               2
    // parallel                         4
    // intersecting                     8
    // non-parallel non-intersecting   16
    var response = 0


    var rxs = V.cross(r, s)
    var q_p = V.subtract(q,p)
    var q_pxr = V.cross(q_p, r)
    if ( rxs == 0 ) {
      if ( q_pxr != 0 ) {
        return [4]
      } else {
        var rr = V.dot(r, r)
        var q_pdr = V.dot(q_p, r)
        var ss = V.dot(r, r)
        var q_pds = V.dot(q_p, s)
        if ( ( 0 <= q_pdr &&  q_pdr <= rr ) || ( 0 <= q_pds && q_pds <= ss ) ) {
          return [1]
        } else {
          return [2]
        }
      }
    }

    var t = V.cross(q_p, s) / rxs
    if ( t < 0 || t > 1 ) return [16]
    var u = V.cross(q_p, r) / rxs
    if ( u < 0 || u > 1 ) return [16]

    // var z1 = V.add(p, V.scale(r, t))
    // var z2 = V.add(q, V.scale(s, u))

    return [8, V.add(p, V.scale(r, t))]
  }

}()
