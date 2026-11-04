import AppIntents
import Foundation
#if canImport(AppKit)
import AppKit
#endif

/// What the Control Center toggle runs when it is flipped.
///
/// It is compiled into both targets, which Apple requires for a control's
/// intent, but `perform()` is written to work identically in either process:
/// it only records the wanted state and makes sure the app is up to act on it.
struct SetHandCursorIntent: SetValueIntent {
    static let title: LocalizedStringResource = "Set Hand Cursor"
    static let description = IntentDescription("Turns hand tracking on or off.")
    /// Siri gets its own, better-worded intents (see HandCursorShortcuts).
    static let isDiscoverable = false

    @Parameter(title: "Hand Cursor On")
    var value: Bool

    init() {}

    func perform() async throws -> some IntentResult {
        SharedState.request(enabled: value)
        HostApp.launchIfNeeded()
        return .result()
    }
}

/// Starts the app if a control was flipped while it wasn't running — it is
/// normally a login item, so this only matters right after install or a quit.
enum HostApp {
    static func launchIfNeeded() {
        #if CONTROLS_EXTENSION
        let running = NSRunningApplication.runningApplications(
            withBundleIdentifier: SharedState.hostBundleID
        )
        guard running.isEmpty else { return }

        // …/Hand Cursor.app/Contents/PlugIns/HandCursorControls.appex
        let appURL = Bundle.main.bundleURL
            .deletingLastPathComponent()   // PlugIns
            .deletingLastPathComponent()   // Contents
            .deletingLastPathComponent()   // Hand Cursor.app

        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        configuration.addsToRecentItems = false
        NSWorkspace.shared.openApplication(at: appURL, configuration: configuration)
        #endif
    }
}
