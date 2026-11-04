import AppKit
import WidgetKit

/// Owns the on/off state inside the app process and reconciles it with what
/// the control or Siri asked for.
@MainActor
final class HandCursorController {
    static let shared = HandCursorController()

    enum Failure: Error {
        case missingPermissions
        case noCamera
    }

    private let tracker = HandTracker()
    private var started = false
    private(set) var isRunning = false

    private init() {
        tracker.onStop = { [weak self] in
            // The camera went away underneath us (unplugged, taken by another
            // app). Reflect that in Control Center rather than lying.
            Task { @MainActor in self?.cameraStopped() }
        }
    }

    /// Called once at launch: picks up whatever state was requested while the
    /// app was not running, then follows every later request.
    func start() {
        guard !started else { return }
        started = true
        SharedState.observe { [weak self] in
            Task { @MainActor in self?.reconcile() }
        }
        reconcile()
    }

    /// Turn on or off directly — the Siri intents use this so they can say
    /// whether it worked.
    @discardableResult
    func setEnabled(_ enabled: Bool) -> Result<Void, Failure> {
        SharedState.record(enabled: enabled)
        return apply(enabled)
    }

    func shutdown() {
        tracker.stop()
        isRunning = false
    }

    // MARK: -

    private func reconcile() {
        _ = apply(SharedState.isEnabled)
    }

    private func apply(_ enabled: Bool) -> Result<Void, Failure> {
        defer { refreshControl() }

        guard enabled else {
            if isRunning {
                tracker.stop()
                isRunning = false
            }
            return .success(())
        }

        if isRunning { return .success(()) }

        guard Permissions.allGranted else {
            // Can't honour it; flip the control back off and show the user
            // what's missing. This is the one time a window appears.
            SharedState.record(enabled: false)
            SetupWindow.show()
            return .failure(.missingPermissions)
        }

        do {
            try tracker.start()
            isRunning = true
            return .success(())
        } catch {
            NSLog("[HandCursor] could not start: \(error)")
            SharedState.record(enabled: false)
            return .failure(.noCamera)
        }
    }

    private func cameraStopped() {
        guard isRunning else { return }
        isRunning = false
        SharedState.record(enabled: false)
        refreshControl()
    }

    private func refreshControl() {
        ControlCenter.shared.reloadControls(ofKind: SharedState.controlKind)
    }
}
