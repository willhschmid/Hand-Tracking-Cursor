import AppKit
import CoreGraphics

/// Posts real system events, so the hand drives the actual Mac pointer in
/// every app — no overlay, no second cursor. Needs the Accessibility
/// permission (see `Permissions.eventsGranted`).
final class CursorDriver: PointerOutput {
    private let source = CGEventSource(stateID: .hidSystemState)
    private var buttonDown = false

    // Double-click bookkeeping.
    private var lastClick: (point: CGPoint, time: TimeInterval)?
    private var clickCount: Int64 = 0

    // Scroll events are whole pixels; carry the remainder so slow scrolls
    // don't round to nothing.
    private var remainder = CGVector.zero

    func move(to point: CGPoint) {
        post(buttonDown ? .leftMouseDragged : .mouseMoved, at: point)
    }

    func click(at point: CGPoint) {
        let count = nextClickCount(at: point)
        post(.mouseMoved, at: point)
        post(.leftMouseDown, at: point, clickCount: count)
        post(.leftMouseUp, at: point, clickCount: count)
    }

    func mouseDown(at point: CGPoint) {
        buttonDown = true
        clickCount = 0
        lastClick = nil
        post(.leftMouseDown, at: point, clickCount: 1)
    }

    func mouseUp(at point: CGPoint) {
        guard buttonDown else { return }
        buttonDown = false
        post(.leftMouseUp, at: point, clickCount: 1)
    }

    func scroll(by delta: CGVector, at point: CGPoint, phase: ScrollPhase) {
        let total = CGVector(dx: delta.dx + remainder.dx, dy: delta.dy + remainder.dy)
        let dx = Int32(total.dx.rounded(.towardZero))
        let dy = Int32(total.dy.rounded(.towardZero))
        remainder = CGVector(dx: total.dx - CGFloat(dx), dy: total.dy - CGFloat(dy))
        if phase == .ended || phase == .momentumEnded { remainder = .zero }

        guard let event = CGEvent(
            scrollWheelEvent2Source: source,
            units: .pixel,
            wheelCount: 2,
            wheel1: dy,
            wheel2: dx,
            wheel3: 0
        ) else { return }

        event.location = point
        // Marked as continuous, phased scrolling — what a trackpad sends — so
        // apps give it rubber-banding and smooth momentum instead of treating
        // it as notched wheel clicks.
        event.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
        switch phase {
        case .began:
            event.setIntegerValueField(.scrollWheelEventScrollPhase, value: Int64(CGScrollPhase.began.rawValue))
        case .changed:
            event.setIntegerValueField(.scrollWheelEventScrollPhase, value: Int64(CGScrollPhase.changed.rawValue))
        case .ended:
            event.setIntegerValueField(.scrollWheelEventScrollPhase, value: Int64(CGScrollPhase.ended.rawValue))
        case .momentumBegan:
            event.setIntegerValueField(.scrollWheelEventMomentumPhase, value: Int64(CGMomentumScrollPhase.begin.rawValue))
        case .momentum:
            event.setIntegerValueField(.scrollWheelEventMomentumPhase, value: Int64(CGMomentumScrollPhase.continuous.rawValue))
        case .momentumEnded:
            event.setIntegerValueField(.scrollWheelEventMomentumPhase, value: Int64(CGMomentumScrollPhase.end.rawValue))
        }
        event.post(tap: .cghidEventTap)
    }

    // MARK: -

    private func post(_ type: CGEventType, at point: CGPoint, clickCount: Int64? = nil) {
        guard let event = CGEvent(
            mouseEventSource: source,
            mouseType: type,
            mouseCursorPosition: point,
            mouseButton: .left
        ) else { return }
        if let clickCount {
            event.setIntegerValueField(.mouseEventClickState, value: clickCount)
        }
        event.post(tap: .cghidEventTap)
    }

    private func nextClickCount(at point: CGPoint) -> Int64 {
        let now = ProcessInfo.processInfo.systemUptime
        // A pinch is slower than a finger, so allow a bit more than the
        // system's own double-click interval.
        let interval = NSEvent.doubleClickInterval * 1.5
        if let last = lastClick,
           now - last.time <= interval,
           hypot(point.x - last.point.x, point.y - last.point.y) <= 12 {
            clickCount += 1
        } else {
            clickCount = 1
        }
        lastClick = (point, now)
        return clickCount
    }
}
