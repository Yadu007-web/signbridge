let hands = null
let isReady = false

async function initMediaPipe() {
  importScripts('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js')

  hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  })

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  })

  hands.onResults((results) => {
    if (
      !results.multiHandLandmarks ||
      results.multiHandLandmarks.length === 0
    ) {
      self.postMessage({ type: 'NO_HANDS' })
      return
    }

    const landmarks = results.multiHandLandmarks[0]
    const confidence = results.multiHandedness?.[0]?.score ?? 0

    if (confidence < 0.7) {
      self.postMessage({ type: 'LOW_CONFIDENCE', confidence })
      return
    }

    const flat = landmarks.flatMap((lm) => [lm.x, lm.y, lm.z])

    self.postMessage({
      type: 'LANDMARKS',
      landmarks: flat,
      confidence,
      timestamp: Date.now(),
    })
  })

  isReady = true
  self.postMessage({ type: 'READY' })
}

self.onmessage = async (e) => {
  if (e.data.type === 'INIT') {
    await initMediaPipe()
    return
  }

  if (e.data.type === 'FRAME' && isReady && hands) {
    try {
      await hands.send({ image: e.data.bitmap })
      e.data.bitmap.close()
    } catch (err) {
      self.postMessage({ type: 'ERROR', message: err.message })
    }
  }
}
