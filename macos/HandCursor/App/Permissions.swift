import AppKit
import AVFoundation
import CoreGraphics

/// The two things macOS has to grant before the pointer can follow a hand.
enum Permissions {
    // MARK: Camera

    static var camera: AVAuthorizationStatus {
        AVCaptureDevice.authorizationStatus(for: .video)
    }

    static var cameraGranted: Bool { camera == .authorized }

    /// Shows the system prompt the first time; after a denial only System
    /// Settings can change the answer.
    static func requestCamera() async -> Bool {
        switch camera {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video)
        default:
            openSettings("Privacy_Camera")
            return false
        }
    }

    // MARK: Accessibility (posting mouse events)

    /// Moving the pointer and clicking in other apps means posting synthetic
    /// events, which macOS gates behind the Accessibility list.
    static var eventsGranted: Bool { CGPreflightPostEventAccess() }

    static func requestEvents() {
        // Adds the app to the list (switched off) and shows the system prompt
        // the first time. The user still has to flip the switch.
        if !CGRequestPostEventAccess() {
            openSettings("Privacy_Accessibility")
        }
    }

    static var allGranted: Bool { cameraGranted && eventsGranted }

    static func openSettings(_ pane: String) {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)") {
            NSWorkspace.shared.open(url)
        }
    }
}
