/**
 * Thin wrapper around MediaPipe's HandLandmarker.
 *
 * The task bundle is pulled in with a dynamic import at call time rather than
 * bundled, so dropping the script on a page costs nothing until the visitor
 * actually turns the camera on.
 */

let visionModulePromise = null;

function loadVision(url) {
  if (!visionModulePromise) {
    // Held in a variable so bundlers leave the specifier alone.
    const specifier = url;
    visionModulePromise = import(/* webpackIgnore: true */ /* @vite-ignore */ specifier).catch(
      (error) => {
        visionModulePromise = null;
        throw error;
      },
    );
  }
  return visionModulePromise;
}

export async function createHandLandmarker({ cdn, numHands, delegate }) {
  const vision = await loadVision(cdn.vision);
  const fileset = await vision.FilesetResolver.forVisionTasks(cdn.wasm);

  const build = (which) =>
    vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: cdn.model, delegate: which },
      runningMode: 'VIDEO',
      numHands,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

  try {
    return await build(delegate);
  } catch (error) {
    if (delegate === 'CPU') throw error;
    // Machines without a usable WebGL context still work, just slower.
    return build('CPU');
  }
}

/** Opens the camera and returns a video element that is already playing. */
export async function openCamera({ width, height, frameRate }) {
  if (!window.isSecureContext) {
    throw Object.assign(new Error('insecure context'), { code: 'insecure' });
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('getUserMedia unavailable'), { code: 'missing' });
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: frameRate },
      },
    });
  } catch (error) {
    const code =
      error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
        ? 'denied'
        : error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError'
          ? 'missing'
          : 'failed';
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code });
  }

  return stream;
}

/** Stops every track on a stream and drops the reference. */
export function closeCamera(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}
