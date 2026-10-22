import AVFoundation
import ExpoModulesCore
import UIKit

struct VideoLayer: Record {
  @Field var uri: String = ""
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var width: Double = 0
  @Field var height: Double = 0
  @Field var fit: String = "cover"
  /// Drawn in this frame only (a map snapshot): not kept in the cache.
  @Field var once: Bool = false
}

/// Writes pictures into an H.264 MP4 (same API as the Android module): each frame is drawn with UIKit into a
/// pixel buffer from the writer's pool and appended at its own timestamp, so held frames are never dropped.
public class JourneyVideoModule: Module {
  private var writer: AVAssetWriter?
  private var input: AVAssetWriterInput?
  private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var frames: Int64 = 0
  private var fps: Int32 = 15
  private var size = CGSize.zero
  private var path = ""
  // Overlays and the end card repeat across frames, so their images are decoded once.
  private var cache: [String: UIImage] = [:]

  public func definition() -> ModuleDefinition {
    Name("JourneyVideo")

    AsyncFunction("start") { (outPath: String, width: Int, height: Int, fps: Int) in
      self.reset()
      let url = URL(fileURLWithPath: outPath)
      try? FileManager.default.removeItem(at: url)
      let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
      let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: width * height * 6,
          AVVideoMaxKeyFrameIntervalKey: fps,
        ],
      ])
      input.expectsMediaDataInRealTime = false
      let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
      ])
      writer.add(input)
      guard writer.startWriting() else { throw VideoError(writer.error?.localizedDescription ?? "cannot start writing") }
      writer.startSession(atSourceTime: .zero)
      self.writer = writer
      self.input = input
      self.adaptor = adaptor
      self.fps = Int32(fps)
      self.size = CGSize(width: width, height: height)
      self.path = outPath
    }

    AsyncFunction("addFrame") { (layers: [VideoLayer], background: String, repeatCount: Int) in
      guard let input = self.input, let adaptor = self.adaptor else { throw VideoError("start() first") }
      let buffer = try self.render(layers, background: background, pool: adaptor.pixelBufferPool)
      for layer in layers where layer.once { self.cache.removeValue(forKey: layer.uri) }
      for _ in 0..<max(repeatCount, 1) {
        while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
        guard adaptor.append(buffer, withPresentationTime: CMTime(value: self.frames, timescale: self.fps)) else {
          throw VideoError(self.writer?.error?.localizedDescription ?? "cannot append a frame")
        }
        self.frames += 1
      }
    }

    AsyncFunction("finish") { (audio: String?, promise: Promise) in
      guard let writer = self.writer, let input = self.input else {
        promise.reject(VideoError("start() first"))
        return
      }
      let out = self.path
      input.markAsFinished()
      writer.finishWriting {
        self.reset()
        guard writer.status == .completed else {
          promise.reject(VideoError(writer.error?.localizedDescription ?? "cannot finish the video"))
          return
        }
        guard let audio else {
          promise.resolve(out)
          return
        }
        // Background music: the silent video is exported again with the track, cut and faded at the video's end.
        let silent = URL(fileURLWithPath: out + ".silent.mp4")
        try? FileManager.default.removeItem(at: silent)
        do {
          try FileManager.default.moveItem(at: URL(fileURLWithPath: out), to: silent)
        } catch {
          promise.resolve(out)
          return
        }
        let music = audio.hasPrefix("file://") ? (URL(string: audio) ?? URL(fileURLWithPath: audio)) : URL(fileURLWithPath: audio)
        self.addAudio(video: silent, audio: music, to: URL(fileURLWithPath: out)) { ok in
          if ok {
            try? FileManager.default.removeItem(at: silent)
          } else {
            try? FileManager.default.removeItem(atPath: out)
            try? FileManager.default.moveItem(at: silent, to: URL(fileURLWithPath: out))
          }
          promise.resolve(out)
        }
      }
    }

    AsyncFunction("cancel") {
      let out = self.path
      self.writer?.cancelWriting()
      self.reset()
      if !out.isEmpty { try? FileManager.default.removeItem(atPath: out) }
    }

    OnDestroy {
      self.writer?.cancelWriting()
      self.reset()
    }
  }

  private func reset() {
    writer = nil
    input = nil
    adaptor = nil
    frames = 0
    cache.removeAll()
  }

  /// Exports `video` with `audio` under it, cut at the video's end with a 1.2 s fade-out; `done(false)` keeps it silent.
  private func addAudio(video: URL, audio: URL, to out: URL, done: @escaping (Bool) -> Void) {
    let videoAsset = AVURLAsset(url: video)
    let audioAsset = AVURLAsset(url: audio)
    let composition = AVMutableComposition()
    guard
      let videoSource = videoAsset.tracks(withMediaType: .video).first,
      let audioSource = audioAsset.tracks(withMediaType: .audio).first,
      let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    else { return done(false) }
    let length = videoAsset.duration
    let heard = CMTimeMinimum(length, audioAsset.duration)
    do {
      try videoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: length), of: videoSource, at: .zero)
      try audioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: heard), of: audioSource, at: .zero)
    } catch {
      return done(false)
    }
    let fade = CMTimeMinimum(CMTime(seconds: 1.2, preferredTimescale: 600), heard)
    let volume = AVMutableAudioMixInputParameters(track: audioTrack)
    volume.setVolumeRamp(fromStartVolume: 1, toEndVolume: 0, timeRange: CMTimeRange(start: heard - fade, duration: fade))
    let mix = AVMutableAudioMix()
    mix.inputParameters = [volume]
    guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else { return done(false) }
    export.outputURL = out
    export.outputFileType = .mp4
    export.audioMix = mix
    export.exportAsynchronously { done(export.status == .completed) }
  }

  private func load(_ uri: String) -> UIImage? {
    if let image = cache[uri] { return image }
    let file = uri.hasPrefix("file://") ? (URL(string: uri)?.path ?? uri) : uri
    guard let image = UIImage(contentsOfFile: file) else { return nil }
    cache[uri] = image
    return image
  }

  /// Where a layer's image goes: its box, the image's aspect kept by cropping (cover) or letterboxing (contain).
  private func place(_ layer: VideoLayer, _ image: UIImage) -> CGRect {
    let box = CGRect(x: layer.x, y: layer.y, width: layer.width, height: layer.height)
    let sx = box.width / image.size.width
    let sy = box.height / image.size.height
    let s = layer.fit == "contain" ? min(sx, sy) : max(sx, sy)
    let w = image.size.width * s
    let h = image.size.height * s
    return CGRect(x: box.midX - w / 2, y: box.midY - h / 2, width: w, height: h)
  }

  private func render(_ layers: [VideoLayer], background: String, pool: CVPixelBufferPool?) throws -> CVPixelBuffer {
    guard let pool else { throw VideoError("no pixel buffer pool") }
    var made: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &made)
    guard let buffer = made else { throw VideoError("cannot make a pixel buffer") }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let context = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: Int(size.width),
      height: Int(size.height),
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else { throw VideoError("cannot draw a frame") }
    // UIKit draws top-down; the bitmap context is bottom-up.
    context.translateBy(x: 0, y: size.height)
    context.scaleBy(x: 1, y: -1)
    context.interpolationQuality = .high
    UIGraphicsPushContext(context)
    defer { UIGraphicsPopContext() }
    color(background).setFill()
    UIRectFill(CGRect(origin: .zero, size: size))
    for layer in layers {
      if let image = load(layer.uri) { image.draw(in: place(layer, image)) }
    }
    return buffer
  }

  private func color(_ hex: String) -> UIColor {
    let value = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0xFFFFFF
    return UIColor(
      red: CGFloat((value >> 16) & 0xFF) / 255,
      green: CGFloat((value >> 8) & 0xFF) / 255,
      blue: CGFloat(value & 0xFF) / 255,
      alpha: 1
    )
  }
}

struct VideoError: Error, CustomStringConvertible {
  let description: String
  init(_ message: String) { description = "journey-video: \(message)" }
}
