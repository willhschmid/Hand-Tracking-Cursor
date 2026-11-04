import AVFoundation
import CoreGraphics
import Vision

/// The few landmarks the cursor needs, in a top-left-origin frame mirrored so
/// that moving your hand right moves the pointer right.
struct HandSample {
    var thumbTip: CGPoint
    var indexTip: CGPoint
    var wrist: CGPoint
    var middleMCP: CGPoint
    /// Camera frame width / height. Normalized coordinates are anisotropic, so
    /// x is rescaled by this before any distance is measured.
    var aspect: CGFloat
}

/// Front camera in, `HandSample`s out, into the gesture engine — all on one
/// serial queue, so nothing downstream needs locks.
final class HandTracker: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    enum TrackerError: Error {
        case noCamera
        case cannotConfigure
    }

    /// Called (on an arbitrary queue) when capture stops without being asked.
    var onStop: (() -> Void)?

    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "HandCursor.session")
    private let videoQueue = DispatchQueue(label: "HandCursor.video", qos: .userInteractive)
    private let request: VNDetectHumanHandPoseRequest = {
        let request = VNDetectHumanHandPoseRequest()
        request.maximumHandCount = 1
        return request
    }()

    private lazy var engine = GestureEngine(output: CursorDriver(), queue: videoQueue)
    private var configured = false
    private var observers: [NSObjectProtocol] = []

    func start() throws {
        if !configured {
            try configure()
            configured = true
        }
        sessionQueue.async { [session] in
            if !session.isRunning { session.startRunning() }
        }
    }

    func stop() {
        sessionQueue.async { [session] in
            if session.isRunning { session.stopRunning() }
        }
        // Never leave a mouse button held down or a fling running.
        videoQueue.async { [weak self] in self?.engine.reset() }
    }

    // MARK: Setup

    private func configure() throws {
        let device =
            AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .unspecified)
            ?? AVCaptureDevice.default(for: .video)
        guard let device else { throw TrackerError.noCamera }

        let input = try AVCaptureDeviceInput(device: device)
        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: videoQueue)

        session.beginConfiguration()
        defer { session.commitConfiguration() }

        // Hand pose doesn't need more; fewer pixels is less latency.
        if session.canSetSessionPreset(.vga640x480) {
            session.sessionPreset = .vga640x480
        }
        guard session.canAddInput(input), session.canAddOutput(output) else {
            throw TrackerError.cannotConfigure
        }
        session.addInput(input)
        session.addOutput(output)

        let center = NotificationCenter.default
        let stopped: (Notification) -> Void = { [weak self] _ in
            self?.videoQueue.async { self?.engine.reset() }
            self?.onStop?()
        }
        observers = [
            center.addObserver(forName: AVCaptureSession.runtimeErrorNotification,
                               object: session, queue: nil, using: stopped),
            center.addObserver(forName: AVCaptureDevice.wasDisconnectedNotification,
                               object: device, queue: nil, using: stopped),
        ]
    }

    // MARK: Frames

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        let time = CMSampleBufferGetPresentationTimeStamp(sampleBuffer).seconds
        engine.process(sample(from: sampleBuffer), at: time)
    }

    private func sample(from buffer: CMSampleBuffer) -> HandSample? {
        guard let pixels = CMSampleBufferGetImageBuffer(buffer) else { return nil }
        let aspect = CGFloat(CVPixelBufferGetWidth(pixels)) / CGFloat(max(CVPixelBufferGetHeight(pixels), 1))

        let handler = VNImageRequestHandler(cvPixelBuffer: pixels, orientation: .up)
        do {
            try handler.perform([request])
        } catch {
            return nil
        }
        guard let hand = request.results?.first,
              let joints = try? hand.recognizedPoints(.all)
        else { return nil }

        func point(_ name: VNHumanHandPoseObservation.JointName) -> CGPoint? {
            guard let p = joints[name], p.confidence > 0.3 else { return nil }
            // Vision is bottom-left origin and sees the camera's view; flip both
            // axes so it reads like a mirror with a top-left origin.
            return CGPoint(x: 1 - p.location.x, y: 1 - p.location.y)
        }

        guard let thumb = point(.thumbTip),
              let index = point(.indexTip),
              let wrist = point(.wrist),
              let middle = point(.middleMCP)
        else { return nil }

        return HandSample(thumbTip: thumb, indexTip: index, wrist: wrist, middleMCP: middle, aspect: aspect)
    }
}
