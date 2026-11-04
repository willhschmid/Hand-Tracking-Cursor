import AppKit
import ServiceManagement

@main
enum Main {
    @MainActor
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        // LSUIElement already keeps it out of the Dock; this makes it explicit.
        app.setActivationPolicy(.accessory)
        app.run()
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private static let onboardedKey = "hasOnboarded"

    func applicationDidFinishLaunching(_ notification: Notification) {
        let firstLaunch = !UserDefaults.standard.bool(forKey: Self.onboardedKey)
        if firstLaunch {
            // Stay resident (invisible) so the control and Siri respond
            // instantly instead of waiting on a cold launch.
            LoginItem.setEnabled(true)
        }

        HandCursorController.shared.start()

        if firstLaunch || !Permissions.allGranted {
            UserDefaults.standard.set(true, forKey: Self.onboardedKey)
            SetupWindow.show()
        }
    }

    /// Opening the app from Finder or Spotlight while it is already running is
    /// the only way to reach its settings — there is no Dock icon or menu.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        SetupWindow.show()
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationWillTerminate(_ notification: Notification) {
        HandCursorController.shared.shutdown()
    }
}

enum LoginItem {
    static var isEnabled: Bool {
        SMAppService.mainApp.status == .enabled
    }

    static func setEnabled(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
        } catch {
            NSLog("[HandCursor] login item: \(error)")
        }
    }
}
