import Foundation

/// The one piece of state the app and the Control Center extension share:
/// whether Hand Cursor should be on.
///
/// A control's intent runs inside the widget extension, not the app, so the
/// extension can't start the camera itself. It writes the new value here and
/// pings the app with a Darwin notification; the app (running invisibly, and
/// launched by the extension if it isn't yet) does the work. The value is
/// persisted, so an app that was not running yet picks it up the moment it
/// launches.
enum SharedState {
    /// `$(TeamIdentifierPrefix)com.willhschmid.HandCursor`, resolved at build
    /// time into each target's Info.plist.
    static let appGroup: String =
        Bundle.main.object(forInfoDictionaryKey: "HCAppGroup") as? String ?? ""

    static let hostBundleID = "com.willhschmid.HandCursor"
    static let controlKind = "com.willhschmid.HandCursor.toggle"

    private static let enabledKey = "enabled"
    private static let notificationName = "com.willhschmid.HandCursor.changed" as CFString

    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? .standard
    }

    static var isEnabled: Bool {
        defaults.bool(forKey: enabledKey)
    }

    /// Records the wanted state and tells the app about it.
    static func request(enabled: Bool) {
        defaults.set(enabled, forKey: enabledKey)
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(notificationName),
            nil, nil, true
        )
    }

    /// Writes the state without notifying — used by the app when it has to
    /// correct the value itself (a permission is missing, the camera vanished).
    static func record(enabled: Bool) {
        defaults.set(enabled, forKey: enabledKey)
    }

    // MARK: Observing

    private static var handlers: [() -> Void] = []

    /// Calls `handler` on the main queue whenever any process calls
    /// `request(enabled:)`.
    static func observe(_ handler: @escaping () -> Void) {
        if handlers.isEmpty {
            CFNotificationCenterAddObserver(
                CFNotificationCenterGetDarwinNotifyCenter(),
                nil,
                { _, _, _, _, _ in
                    DispatchQueue.main.async {
                        SharedState.handlers.forEach { $0() }
                    }
                },
                notificationName,
                nil,
                .deliverImmediately
            )
        }
        handlers.append(handler)
    }
}
