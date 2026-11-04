import CoreGraphics
import Foundation

/// 1€ filter (Casiez, Roussel & Vogel, 2012), ported from src/one-euro.js.
/// Heavy smoothing while the hand is still, light smoothing while it moves.
struct OneEuroFilter {
    var minCutoff: Double
    var beta: Double
    var dCutoff: Double

    private var x: Double?
    private var dx: Double = 0

    init(minCutoff: Double, beta: Double, dCutoff: Double) {
        self.minCutoff = minCutoff
        self.beta = beta
        self.dCutoff = dCutoff
    }

    private static func alpha(_ cutoff: Double, _ dt: Double) -> Double {
        let tau = 1 / (2 * Double.pi * cutoff)
        return 1 / (1 + tau / dt)
    }

    mutating func filter(_ value: Double, dt rawDt: Double) -> Double {
        let dt = rawDt > 0 ? rawDt : 1.0 / 60
        guard let previous = x else {
            x = value
            return value
        }
        let derivative = (value - previous) / dt
        let ad = Self.alpha(dCutoff, dt)
        dx = ad * derivative + (1 - ad) * dx
        let cutoff = minCutoff + beta * abs(dx)
        let a = Self.alpha(cutoff, dt)
        let next = a * value + (1 - a) * previous
        x = next
        return next
    }

    mutating func reset() {
        x = nil
        dx = 0
    }
}

struct PointFilter {
    private var fx: OneEuroFilter
    private var fy: OneEuroFilter

    init(minCutoff: Double = 1.4, beta: Double = 0.015, dCutoff: Double = 1.0) {
        fx = OneEuroFilter(minCutoff: minCutoff, beta: beta, dCutoff: dCutoff)
        fy = OneEuroFilter(minCutoff: minCutoff, beta: beta, dCutoff: dCutoff)
    }

    mutating func filter(_ p: CGPoint, dt: Double) -> CGPoint {
        CGPoint(x: fx.filter(Double(p.x), dt: dt), y: fy.filter(Double(p.y), dt: dt))
    }

    mutating func reset() {
        fx.reset()
        fy.reset()
    }
}
