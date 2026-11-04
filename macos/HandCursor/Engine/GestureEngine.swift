import CoreGraphics
import Foundation

/// What the gesture engine drives. `CursorDriver` posts these as real
/// system events; tests can substitute a recorder.
protocol PointerOutput: AnyObject {
    func move(to point: CGPoint)
    func click(at point: CGPoint)
    func mouseDown(at point: CGPoint)
    func mouseUp(at point: CGPoint)
    func scroll(by delta: CGVector, at point: CGPoint, phase: ScrollPhase)
}

enum ScrollPhase {
    case began, changed, ended
    case momentumBegan, momentum, momentumEnded
}

/// Turns hand samples into pointer actions. Same gesture vocabulary as the web
/// build, mapped onto a Mac:
///
/// - point to move the pointer
/// - quick pinch → click (two quick pinches → double-click)
/// - pinch and move → scroll, content following the hand, with a fling
/// - pinch and hold still, then move → press-and-drag (windows, text, sliders)
///
/// Everything runs on the camera's serial queue.
final class GestureEngine {
    struct Tuning {
        /// Outer slice of the camera frame that is dead space on each edge, so
        /// the screen corners stay reachable without leaving frame.
        var region = CGPoint(x: 0.15, y: 0.15)
        /// Pinch ratio thresholds with hysteresis (see src/config.js).
        var pinchOn: CGFloat = 0.22
        var pinchOff: CGFloat = 0.32
        /// A pinch shorter and tighter than this is a click.
        var tapMaxDuration: TimeInterval = 0.8
        var tapMaxTravel: CGFloat = 32
        /// Scroll gate: travel needed, and how long the pinch must be held
        /// first unless it travels `holdEscape` straight away.
        var scrollThreshold: CGFloat = 34
        var scrollHoldDelay: TimeInterval = 0.14
        var holdEscape: CGFloat = 70
        /// Holding a pinch still this long turns it into a held mouse button.
        var longPress: TimeInterval = 0.5
        /// Fling.
        var friction: Double = 0.967
        var minVelocity: Double = 24
        var maxVelocity: Double = 3600
        var velocityWindow: TimeInterval = 0.12
        /// Flip if scrolling feels backwards on your setup.
        var scrollDirection: CGFloat = 1
    }

    private enum State {
        case idle
        /// Pinched, not yet decided between click, scroll and drag.
        case pressed(origin: CGPoint, since: TimeInterval)
        case scrolling(origin: CGPoint, last: CGPoint)
        case dragging
    }

    var tuning = Tuning()

    private let output: PointerOutput
    private let queue: DispatchQueue
    private var state: State = .idle
    private var filter = PointFilter()
    private var lastTime: TimeInterval?
    private var pinched = false
    private var cursor = CGPoint.zero
    private var samples: [(point: CGPoint, time: TimeInterval)] = []
    private var fling: DispatchSourceTimer?

    init(output: PointerOutput, queue: DispatchQueue) {
        self.output = output
        self.queue = queue
    }

    // MARK: Input

    func process(_ sample: HandSample?, at time: TimeInterval) {
        guard let sample else {
            handLost()
            return
        }

        let dt = lastTime.map { time - $0 } ?? 1.0 / 30
        lastTime = time

        let screen = CGDisplayBounds(CGMainDisplayID())
        let raw = screenPoint(for: controlPoint(sample), in: screen)
        let point = filter.filter(raw, dt: dt)

        let ratio = pinchRatio(sample)
        let wasPinched = pinched
        pinched = wasPinched ? ratio < tuning.pinchOff : ratio < tuning.pinchOn

        switch (wasPinched, pinched) {
        case (false, true): press(at: point, time: time)
        case (true, false): release(at: point, time: time)
        case (true, true): hold(at: point, time: time)
        case (false, false): hover(at: point)
        }
    }

    /// Drops every gesture in flight without clicking. Called when the hand
    /// leaves frame and when tracking stops.
    func reset() {
        handLost()
        stopFling()
        filter.reset()
        lastTime = nil
    }

    // MARK: Gestures

    private func hover(at point: CGPoint) {
        cursor = point
        output.move(to: point)
    }

    private func press(at point: CGPoint, time: TimeInterval) {
        stopFling()
        cursor = point
        state = .pressed(origin: point, since: time)
        samples = [(point, time)]
    }

    private func hold(at point: CGPoint, time: TimeInterval) {
        record(point, time)

        switch state {
        case let .pressed(origin, since):
            // The pointer stays put while undecided, so pinch drift can't
            // move a click off its target.
            let travel = distance(point, origin)
            let held = time - since

            if held >= tuning.longPress && travel < tuning.tapMaxTravel {
                output.mouseDown(at: origin)
                state = .dragging
            } else if travel >= tuning.holdEscape
                        || (held >= tuning.scrollHoldDelay && travel >= tuning.scrollThreshold) {
                // Start from here, not from the origin, so the content doesn't
                // lurch by the gate distance.
                output.scroll(by: .zero, at: origin, phase: .began)
                state = .scrolling(origin: origin, last: point)
            }

        case let .scrolling(origin, last):
            let delta = CGVector(
                dx: (point.x - last.x) * tuning.scrollDirection,
                dy: (point.y - last.y) * tuning.scrollDirection
            )
            // The pointer stays where the scroll started so it keeps scrolling
            // the same view.
            output.scroll(by: delta, at: origin, phase: .changed)
            state = .scrolling(origin: origin, last: point)

        case .dragging:
            cursor = point
            output.move(to: point)

        case .idle:
            press(at: point, time: time)
        }
    }

    private func release(at point: CGPoint, time: TimeInterval) {
        switch state {
        case let .pressed(origin, since):
            if time - since <= tuning.tapMaxDuration {
                output.click(at: origin)
            }
        case let .scrolling(origin, _):
            output.scroll(by: .zero, at: origin, phase: .ended)
            startFling(at: origin, velocity: releaseVelocity())
        case .dragging:
            output.mouseUp(at: point)
        case .idle:
            break
        }
        state = .idle
        samples = []
    }

    private func handLost() {
        switch state {
        case let .scrolling(origin, _):
            output.scroll(by: .zero, at: origin, phase: .ended)
        case .dragging:
            output.mouseUp(at: cursor)
        case .pressed, .idle:
            break
        }
        state = .idle
        pinched = false
        samples = []
    }

    // MARK: Fling

    private func record(_ point: CGPoint, _ time: TimeInterval) {
        samples.append((point, time))
        samples.removeAll { time - $0.time > tuning.velocityWindow }
    }

    /// Screen points per second over the last `velocityWindow`.
    private func releaseVelocity() -> CGVector {
        guard let first = samples.first, let last = samples.last, last.time > first.time else {
            return .zero
        }
        let dt = CGFloat(last.time - first.time)
        return CGVector(
            dx: (last.point.x - first.point.x) / dt * tuning.scrollDirection,
            dy: (last.point.y - first.point.y) / dt * tuning.scrollDirection
        )
    }

    private func startFling(at origin: CGPoint, velocity start: CGVector) {
        var vx = Double(start.dx)
        var vy = Double(start.dy)
        let speed = hypot(vx, vy)
        guard speed >= tuning.minVelocity else { return }
        if speed > tuning.maxVelocity {
            vx *= tuning.maxVelocity / speed
            vy *= tuning.maxVelocity / speed
        }

        let interval = 1.0 / 120
        var began = false
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: interval, leeway: .milliseconds(1))
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            let decay = pow(self.tuning.friction, interval * 60)
            vx *= decay
            vy *= decay
            if hypot(vx, vy) < self.tuning.minVelocity {
                self.output.scroll(by: .zero, at: origin, phase: .momentumEnded)
                self.stopFling(notify: false)
                return
            }
            let delta = CGVector(dx: vx * interval, dy: vy * interval)
            self.output.scroll(by: delta, at: origin, phase: began ? .momentum : .momentumBegan)
            began = true
        }
        fling = timer
        flingOrigin = origin
        timer.resume()
    }

    private var flingOrigin: CGPoint?

    private func stopFling(notify: Bool = true) {
        guard let timer = fling else { return }
        timer.cancel()
        fling = nil
        if notify, let origin = flingOrigin {
            output.scroll(by: .zero, at: origin, phase: .momentumEnded)
        }
        flingOrigin = nil
    }

    // MARK: Geometry (mirrors src/landmarks.js)

    private func controlPoint(_ s: HandSample) -> CGPoint {
        // Midway between thumb and index: both tips close on each other during
        // a pinch, so this barely moves when you click.
        CGPoint(x: (s.thumbTip.x + s.indexTip.x) / 2, y: (s.thumbTip.y + s.indexTip.y) / 2)
    }

    private func pinchRatio(_ s: HandSample) -> CGFloat {
        func d(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
            hypot((a.x - b.x) * s.aspect, a.y - b.y)
        }
        return d(s.thumbTip, s.indexTip) / max(d(s.wrist, s.middleMCP), 1e-4)
    }

    private func screenPoint(for p: CGPoint, in screen: CGRect) -> CGPoint {
        let rx = tuning.region.x, ry = tuning.region.y
        let u = min(max((p.x - rx) / (1 - 2 * rx), 0), 1)
        let v = min(max((p.y - ry) / (1 - 2 * ry), 0), 1)
        return CGPoint(
            x: screen.minX + u * (screen.width - 1),
            y: screen.minY + v * (screen.height - 1)
        )
    }

    private func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        hypot(a.x - b.x, a.y - b.y)
    }
}
