# App Review notes (draft)

Paste into **App Review Information › Notes** in App Store Connect when
submitting. Edit to match the final build.

---

Hand Cursor is a hands-free pointing tool. It lets people control the Mac
pointer by moving their hand in front of the built-in camera: point to move,
pinch to click, pinch and move to scroll. It is meant for people who can't
comfortably use a mouse or trackpad (limited fine motor control, repetitive
strain injury, temporary injury), and for anyone who needs to use their Mac
without touching it. It does the same job as macOS's own Head Pointer and
Pointer Control features, using the hand instead of the head.

**Why it posts input events.** Moving the system pointer and clicking in
other apps is the app's whole purpose, so it posts mouse events with
`CGEvent.post`. It requests only the Post Event privilege
(`CGRequestPostEventAccess`). It doesn't use the Accessibility API to read or
control other apps' interfaces, doesn't monitor the keyboard, and never posts
keyboard events.

**Camera.** Frames are analyzed on-device with Apple's Vision framework
(hand pose detection) and are never stored, recorded or transmitted. The app
makes no network requests at all. The camera is only on while the user has
Hand Cursor switched on, and macOS shows the camera indicator the whole time.

**How to test.**
1. Launch the app. A setup window asks for camera access and for permission
   to control the pointer (System Settings › Privacy & Security ›
   Accessibility).
2. Open Control Center › Edit Controls and add **Hand Cursor**, or say
   "Hey Siri, turn on Hand Cursor".
3. Hold one hand up in view of the camera, palm toward the screen, and point.
   The pointer follows your hand. Touch your thumb to your index finger
   briefly to click. Keep them touching and move your hand to scroll.
4. Turn it off from the same Control Center button, or say "Turn off Hand
   Cursor". The camera indicator goes off.

The app has no Dock icon or menu bar item by design: its interface is the
Control Center control and Siri. To reopen the setup window, open the app
again from Finder or Spotlight.
