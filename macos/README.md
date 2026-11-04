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
- An Apple Developer account. Control Center controls and App Groups need a
  signed build. To share the app with other people, you need the paid program
  so it can be notarized.

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
2. **Accessibility:** to move the pointer and click. macOS only lets you grant
   this in System Settings, so the button takes you there.

After that, the app runs as an invisible login item. To add the button, open
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
state you want, and the app does the work. The app is a login item, so it's
already running and the button responds right away. If you quit the app, the
button launches it again.

### Why it isn't in the Mac App Store

Moving the pointer in other apps means posting synthetic input events. That
requires the Accessibility permission and an app outside the App Store
sandbox. To share it, distribute it like other utilities in this category:
signed with a Developer ID and notarized. Only the extension is sandboxed.

## Status

This is a first scaffold. It was written without a Mac to build on, so expect
a round of compile fixes in Xcode the first time. Things to check on real
hardware:

- **Scroll direction.** Posted scroll events may or may not be flipped by the
  Natural Scrolling setting. If scrolling feels backwards, flip
  `scrollDirection` in `GestureEngine.Tuning`.
- **Multiple displays.** The hand currently maps onto the main display only.
- **Smoothness.** The pointer updates at the camera's frame rate (~30 fps).
  The web build resamples onto the display's refresh rate, and the same idea
  would carry over here with a `CADisplayLink`.
