import AppKit
import Combine
import SwiftUI

/// The app's only window. It appears on first launch, when a permission is
/// missing, or when the user opens the app again from Finder or Spotlight.
@MainActor
enum SetupWindow {
    private static var window: NSWindow?

    static func show() {
        if window == nil {
            let window = NSWindow(contentViewController: NSHostingController(rootView: SetupView()))
            window.title = "Hand Cursor"
            window.styleMask = [.titled, .closable, .fullSizeContentView]
            window.titlebarAppearsTransparent = true
            window.isReleasedWhenClosed = false
            window.center()
            self.window = window
        }
        NSApp.activate()
        window?.makeKeyAndOrderFront(nil)
    }
}

struct SetupView: View {
    @State private var camera = Permissions.cameraGranted
    @State private var events = Permissions.eventsGranted
    @State private var openAtLogin = LoginItem.isEnabled

    // Permissions change in System Settings, out of our sight; poll while open.
    private let poll = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 14) {
                Image(systemName: "hand.point.up.left.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(.tint)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Hand Cursor").font(.title2.bold())
                    Text("Point to move. Pinch to click. Pinch and drag to scroll.")
                        .foregroundStyle(.secondary)
                }
            }

            GroupBox {
                VStack(spacing: 12) {
                    PermissionRow(
                        title: "Camera",
                        detail: "Video stays on this Mac.",
                        granted: camera
                    ) {
                        Task { camera = await Permissions.requestCamera() }
                    }
                    Divider()
                    PermissionRow(
                        title: "Accessibility",
                        detail: "Lets your hand move the pointer and click.",
                        granted: events
                    ) {
                        Permissions.requestEvents()
                    }
                }
                .padding(6)
            }

            VStack(alignment: .leading, spacing: 8) {
                Label("Add the **Hand Cursor** button: Control Center › Edit Controls.",
                      systemImage: "switch.2")
                Label("Or just say **“Hey Siri, turn on Hand Cursor.”**",
                      systemImage: "waveform")
            }
            .foregroundStyle(.secondary)

            HStack {
                Toggle("Open at login", isOn: $openAtLogin)
                    .onChange(of: openAtLogin) { _, on in LoginItem.setEnabled(on) }
                Spacer()
                Button("Quit") { NSApp.terminate(nil) }
                Button("Done") { NSApp.keyWindow?.close() }
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(24)
        .frame(width: 440)
        .onReceive(poll) { _ in
            camera = Permissions.cameraGranted
            events = Permissions.eventsGranted
        }
    }
}

private struct PermissionRow: View {
    let title: String
    let detail: String
    let granted: Bool
    let request: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(detail).font(.callout).foregroundStyle(.secondary)
            }
            Spacer()
            if granted {
                Label("Allowed", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else {
                Button("Allow…", action: request)
            }
        }
    }
}
