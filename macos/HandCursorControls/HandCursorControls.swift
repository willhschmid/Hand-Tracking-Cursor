import AppIntents
import SwiftUI
import WidgetKit

@main
struct HandCursorControlsBundle: WidgetBundle {
    var body: some Widget {
        HandCursorToggle()
    }
}

/// The on/off button in Control Center (and, if the user drags it there, the
/// menu bar).
struct HandCursorToggle: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(
            kind: SharedState.controlKind,
            provider: Provider()
        ) { isOn in
            ControlWidgetToggle(
                "Hand Cursor",
                isOn: isOn,
                action: SetHandCursorIntent()
            ) { isOn in
                Label(
                    isOn ? "On" : "Off",
                    systemImage: isOn ? "hand.point.up.left.fill" : "hand.point.up.left"
                )
            }
            .tint(.blue)
        }
        .displayName("Hand Cursor")
        .description("Move the pointer with your hand. Pinch to click.")
    }
}

extension HandCursorToggle {
    struct Provider: ControlValueProvider {
        var previewValue: Bool { false }

        func currentValue() async throws -> Bool {
            SharedState.isEnabled
        }
    }
}
