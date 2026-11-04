import AppIntents

// Siri, Spotlight and Shortcuts. These live only in the app target, so
// `perform()` runs in the app process and can report whether it worked.
//
// App Shortcuts need no setup from the user: once the app has launched once,
// "Hey Siri, turn on Hand Cursor" works.

struct TurnOnHandCursor: AppIntent {
    static let title: LocalizedStringResource = "Turn On Hand Cursor"
    static let description = IntentDescription("Start moving the pointer with your hand.")

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: Self.turnOn())
    }

    @MainActor
    static func turnOn() -> IntentDialog {
        switch HandCursorController.shared.setEnabled(true) {
        case .success:
            return "Hand Cursor is on. Pinch to click."
        case .failure(.missingPermissions):
            return "Hand Cursor needs camera and accessibility access first. I've opened setup."
        case .failure(.noCamera):
            return "Hand Cursor couldn't find a camera."
        }
    }
}

struct TurnOffHandCursor: AppIntent {
    static let title: LocalizedStringResource = "Turn Off Hand Cursor"
    static let description = IntentDescription("Stop hand tracking and turn the camera off.")

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        HandCursorController.shared.setEnabled(false)
        return .result(dialog: "Hand Cursor is off.")
    }
}

struct ToggleHandCursor: AppIntent {
    static let title: LocalizedStringResource = "Toggle Hand Cursor"
    static let description = IntentDescription("Turn hand tracking on if it's off, or off if it's on.")

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let controller = HandCursorController.shared
        if controller.isRunning {
            controller.setEnabled(false)
            return .result(dialog: "Hand Cursor is off.")
        }
        return .result(dialog: TurnOnHandCursor.turnOn())
    }
}

struct HandCursorShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: TurnOnHandCursor(),
            phrases: [
                "Turn on \(.applicationName)",
                "Turn \(.applicationName) on",
                "Start \(.applicationName)",
                "Enable \(.applicationName)",
            ],
            shortTitle: "Turn On",
            systemImageName: "hand.point.up.left.fill"
        )
        AppShortcut(
            intent: TurnOffHandCursor(),
            phrases: [
                "Turn off \(.applicationName)",
                "Turn \(.applicationName) off",
                "Stop \(.applicationName)",
                "Disable \(.applicationName)",
            ],
            shortTitle: "Turn Off",
            systemImageName: "hand.raised.slash"
        )
        AppShortcut(
            intent: ToggleHandCursor(),
            phrases: ["Toggle \(.applicationName)"],
            shortTitle: "Toggle",
            systemImageName: "hand.point.up.left"
        )
    }
}
