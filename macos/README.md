# Hand Cursor for Mac

The same hand tracking idea as the web build, made into a Mac app that controls
the real system pointer in every app.

You don't see the app itself. It has no Dock icon, no menu bar item and no
window in daily use. There are two ways to control it:

- **Control Center:** a *Hand Cursor* on/off button.
- **Siri:** "Turn on Hand Cursor", "Turn off Hand Cursor", "Toggle Hand Cursor".
  These also show up in Spotlight and Shortcuts, and you can bind them to a
  keyboard shortcut.

While it's on, macOS shows its usual green camera light and menu bar camera
indicator.

## Gestures

| Do this | Get this |
| --- | --- |
| Point | Move the pointer |
| Quick pinch (thumb to index) | Click |
| Two quick pinches | Double-click |
| Pinch and move | Scroll; the content follows your hand and keeps going when you let go |
| Pinch, hold still for half a second, then move | Press and drag (move windows, select text, drag sliders) |

The pointer stays still while a pinch is undecided, so a click lands where you
aimed. The tuning numbers are at the top of
[`GestureEngine.swift`](HandCursor/Engine/GestureEngine.swift) and match
[`src/config.js`](../src/config.js).

## Requirements

- macOS 26 Tahoe or later. That's the first version that lets apps add their
  own controls to the Mac's Control Center.
- Xcode 26 or later.
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`
- An Apple Developer Program membership ($99/year). Control Center controls
  and App Groups need a signed build, and selling on the Mac App Store needs
  the paid program.

## Build

```sh
cd macos
echo 'DEVELOPMENT_TEAM = YOURTEAMID' > Config/Local.xcconfig   # once
xcodegen
open HandCursor.xcodeproj
```

Run the **HandCursor** scheme. On first launch you'll see the app's only
window. It asks for:

1. **Camera:** to see your hand. Frames are processed on the Mac by Apple's
   Vision framework and never stored or sent anywhere.
2. **Permission to control the pointer.** macOS lists this under Privacy &
   Security › Accessibility, and you can only switch it on there, so the
   button takes you to that page.

After that, the app runs invisibly in the background. *Open at login* is off
by default; switching it on makes the first turn-on after a restart a little
faster. To add the button, open
Control Center, choose **Edit Controls**, and add **Hand Cursor**. You can also
drag it into the menu bar. To reopen the setup window later, open *Hand Cursor*
from Spotlight or Finder.

## How it fits together

```
Control Center button ──► SetHandCursorIntent (runs in the widget extension)
                              │ writes "enabled" to the shared App Group
                              │ posts a Darwin notification
                              │ launches the app if it isn't running
                              ▼
Siri / Shortcuts ───────► HandCursorController (app process, always resident)
                              │
                              ▼
                          HandTracker: front camera → Vision hand pose
                              │
                              ▼
                          GestureEngine: 1€ filter, pinch, click/scroll/drag
                              │
                              ▼
                          CursorDriver: CGEvents → the real pointer
```

- `Shared/`: code compiled into both the app and the extension: the shared
  on/off state and the control's intent.
- `HandCursorControls/`: the WidgetKit extension that provides the Control
  Center button.
- `HandCursor/App`: app lifecycle, permissions and the on/off controller.
- `HandCursor/Engine`: camera, hand pose, gestures and event posting.
- `HandCursor/Intents`: the Siri phrases.
- `HandCursor/Onboarding`: the setup window.

### Why the button doesn't start the camera itself

A Control Center button runs its action inside a sandboxed widget extension,
and that process can't keep the camera running. So the button only records the
state you want, and the app does the work. If the app isn't running, the
button launches it first.

## Mac App Store

The app and its extension are both sandboxed, as the Mac App Store requires.

Moving the pointer and clicking in other apps uses `CGEvent.post`. macOS gates
that behind the **Post Event** privilege (`CGRequestPostEventAccess`), which
works inside the sandbox. It is different from the full **Accessibility**
privilege, which doesn't work in the sandbox and isn't used here. Both appear
under Privacy & Security › Accessibility in System Settings, which is why
they're easy to confuse.

What's already set up for submission:

- App Sandbox on both targets, with only the camera and App Group
  entitlements.
- Privacy manifests (`Privacy/`) declaring no data collection or tracking, and
  the reasons for the two "required reason" APIs used (`UserDefaults`,
  `systemUptime`).
- Open at login is opt-in. App Review doesn't allow starting at login without
  the user's consent.
- `ITSAppUsesNonExemptEncryption = NO`, so uploads skip the export compliance
  question.

The open risk is App Review's judgment rather than anything technical. Apps
posting synthetic input have been rejected for using accessibility features
for non-accessibility purposes. [`APP_REVIEW.md`](APP_REVIEW.md) has draft
review notes that explain why this one is an accessibility feature. If it's
rejected anyway, the same build can be signed with Developer ID, notarized and
sold directly.

## Status

This is a first scaffold. It was written without a Mac to build on, so expect
a round of compile fixes in Xcode the first time. Things to check on real
hardware:

- **Pointer control from the sandbox.** Confirm that the pointer moves and
  clicks in other apps in a sandboxed build after granting the permission.
  This is the first thing to test before submitting.
- **Launching from the button.** Check that the sandboxed extension can start
  the app when it isn't running.
- **Scroll direction.** Posted scroll events may or may not be flipped by the
  Natural Scrolling setting. If scrolling feels backwards, flip
  `scrollDirection` in `GestureEngine.Tuning`.
- **Multiple displays.** The hand currently maps onto the main display only.
- **Smoothness.** The pointer updates at the camera's frame rate (~30 fps).
  The web build resamples onto the display's refresh rate, and the same idea
  would carry over here with a `CADisplayLink`.
