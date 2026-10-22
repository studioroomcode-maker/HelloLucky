package expo.modules.journeyvideo

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

class VideoLayer : Record {
  @Field var uri: String = ""
  @Field var x: Double = 0.0
  @Field var y: Double = 0.0
  @Field var width: Double = 0.0
  @Field var height: Double = 0.0
  @Field var fit: String = "cover"
  /** Drawn in this frame only (a map snapshot): freed afterwards instead of cached. */
  @Field var once: Boolean = false
}

/**
 * Writes pictures into an H.264 MP4. Each frame is composed on a Bitmap, converted to YUV 4:2:0 and queued with its own
 * timestamp, so held frames (the same picture many times) are never dropped the way a fast-fed input surface drops them.
 */
class JourneyVideoModule : Module() {
  private var codec: MediaCodec? = null
  private var muxer: MediaMuxer? = null
  private var track = -1
  private var muxing = false
  private var queued = 0L
  private var frameUs = 0L
  private var width = 0
  private var height = 0
  private var path = ""
  private var frame: Bitmap? = null
  private var argb = IntArray(0)
  private var yPlane = ByteArray(0)
  private var uPlane = ByteArray(0)
  private var vPlane = ByteArray(0)
  // Overlays and the end card repeat across frames, so their bitmaps are decoded once.
  private val cache = HashMap<String, Bitmap>()
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)

  override fun definition() = ModuleDefinition {
    Name("JourneyVideo")

    AsyncFunction("start") { outPath: String, w: Int, h: Int, fps: Int ->
      release()
      val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, w, h).apply {
        setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
        setInteger(MediaFormat.KEY_BIT_RATE, w * h * 6)
        setInteger(MediaFormat.KEY_FRAME_RATE, fps)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
      }
      val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
      encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      encoder.start()
      codec = encoder
      width = w
      height = h
      path = outPath
      File(outPath).delete()
      muxer = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      track = -1
      muxing = false
      queued = 0
      frameUs = 1_000_000L / fps
      frame = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
      argb = IntArray(w * h)
      yPlane = ByteArray(w * h)
      uPlane = ByteArray((w / 2) * (h / 2))
      vPlane = ByteArray((w / 2) * (h / 2))
    }

    AsyncFunction("addFrame") { layers: List<VideoLayer>, background: String, repeat: Int ->
      val picture = frame ?: throw IllegalStateException("journey-video: start() first")
      val canvas = Canvas(picture)
      canvas.drawColor(Color.parseColor(background))
      layers.forEach { layer -> load(layer.uri)?.let { canvas.drawBitmap(it, null, place(layer, it), paint) } }
      layers.forEach { if (it.once) cache.remove(it.uri)?.recycle() }
      picture.getPixels(argb, 0, width, 0, 0, width, height)
      toYuv()
      repeat(maxOf(repeat, 1)) { queue(0) }
    }

    AsyncFunction("finish") { audio: String? ->
      queue(MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      drain(true)
      val out = path
      release()
      if (audio != null) {
        // Background music: the silent video is muxed again with the track, cut and faded at the video's end.
        val silent = File("$out.silent.mp4")
        File(out).renameTo(silent)
        try {
          addAudio(silent.path, Uri.parse(audio).path ?: audio, out)
          silent.delete()
        } catch (error: Exception) {
          android.util.Log.w("JourneyVideo", "music skipped", error)
          File(out).delete()
          silent.renameTo(File(out))
        }
      }
      out
    }

    AsyncFunction("cancel") {
      val out = path
      release()
      File(out).delete()
    }

    OnDestroy { release() }
  }

  private fun load(uri: String): Bitmap? =
    cache.getOrPut(uri) { BitmapFactory.decodeFile(Uri.parse(uri).path ?: uri) ?: return null }

  /** Where a layer's bitmap goes: its box, with the bitmap's aspect kept by cropping (cover) or letterboxing (contain). */
  private fun place(layer: VideoLayer, bitmap: Bitmap): RectF {
    val box = RectF(layer.x.toFloat(), layer.y.toFloat(), (layer.x + layer.width).toFloat(), (layer.y + layer.height).toFloat())
    val sx = box.width() / bitmap.width
    val sy = box.height() / bitmap.height
    val s = if (layer.fit == "contain") minOf(sx, sy) else maxOf(sx, sy)
    val w = bitmap.width * s
    val h = bitmap.height * s
    return RectF(box.centerX() - w / 2, box.centerY() - h / 2, box.centerX() + w / 2, box.centerY() + h / 2)
  }

  /** ARGB pixels to BT.601 limited-range Y, U, V planes (chroma from the top-left pixel of each 2×2 block). */
  private fun toYuv() {
    val cw = width / 2
    for (row in 0 until height) {
      for (col in 0 until width) {
        val c = argb[row * width + col]
        val r = (c shr 16) and 0xff
        val g = (c shr 8) and 0xff
        val b = c and 0xff
        yPlane[row * width + col] = (((66 * r + 129 * g + 25 * b + 128) shr 8) + 16).toByte()
        if (row % 2 == 0 && col % 2 == 0) {
          val i = (row / 2) * cw + col / 2
          uPlane[i] = (((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128).toByte()
          vPlane[i] = (((112 * r - 94 * g - 18 * b + 128) shr 8) + 128).toByte()
        }
      }
    }
  }

  /** Queues the current YUV picture (or, with the end flag, an empty end-of-stream buffer) at the next timestamp. */
  private fun queue(flags: Int) {
    val encoder = codec ?: return
    var index: Int
    while (true) {
      index = encoder.dequeueInputBuffer(10_000)
      if (index >= 0) break
      drain(false)
    }
    if (flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
      encoder.queueInputBuffer(index, 0, 0, queued * frameUs, flags)
      return
    }
    val image = encoder.getInputImage(index) ?: throw IllegalStateException("journey-video: no input image")
    val planes = image.planes
    copy(yPlane, width, height, planes[0])
    copy(uPlane, width / 2, height / 2, planes[1])
    copy(vPlane, width / 2, height / 2, planes[2])
    encoder.queueInputBuffer(index, 0, width * height * 3 / 2, queued * frameUs, 0)
    queued++
    drain(false)
  }

  /** Writes a plane into the codec's layout, whatever its row and pixel strides (planar or interleaved chroma). */
  private fun copy(src: ByteArray, w: Int, h: Int, plane: android.media.Image.Plane) {
    val buffer = plane.buffer
    val rowStride = plane.rowStride
    val pixelStride = plane.pixelStride
    if (pixelStride == 1 && rowStride == w) {
      buffer.position(0)
      buffer.put(src, 0, w * h)
      return
    }
    for (row in 0 until h) {
      val base = row * rowStride
      for (col in 0 until w) buffer.put(base + col * pixelStride, src[row * w + col])
    }
  }

  /** Moves encoded frames to the muxer (waiting for the end of the stream when `end`). */
  private fun drain(end: Boolean) {
    val encoder = codec ?: return
    val mux = muxer ?: return
    val info = MediaCodec.BufferInfo()
    while (true) {
      val index = encoder.dequeueOutputBuffer(info, if (end) 10_000 else 0)
      when {
        index == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!end) return
        index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          track = mux.addTrack(encoder.outputFormat)
          mux.start()
          muxing = true
        }
        index >= 0 -> {
          val buffer = encoder.getOutputBuffer(index)
          if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
          if (info.size > 0 && muxing && buffer != null) {
            buffer.position(info.offset)
            buffer.limit(info.offset + info.size)
            mux.writeSampleData(track, buffer, info)
          }
          encoder.releaseOutputBuffer(index, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
        }
      }
    }
  }

  /** Muxes the video at `videoPath` with `audioPath` (re-encoded to AAC, cut at the video's end, faded out) into `outPath`. */
  private fun addAudio(videoPath: String, audioPath: String, outPath: String) {
    val video = MediaExtractor().apply { setDataSource(videoPath) }
    val mux = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    try {
      val vTrack = (0 until video.trackCount).first { video.getTrackFormat(it).getString(MediaFormat.KEY_MIME)!!.startsWith("video/") }
      val vFormat = video.getTrackFormat(vTrack)
      val (aFormat, samples) = encodeAudio(audioPath, vFormat.getLong(MediaFormat.KEY_DURATION))
      val vOut = mux.addTrack(vFormat)
      val aOut = mux.addTrack(aFormat)
      mux.start()
      for ((bytes, info) in samples) mux.writeSampleData(aOut, ByteBuffer.wrap(bytes), info)
      video.selectTrack(vTrack)
      val buffer = ByteBuffer.allocate(4 shl 20)
      val info = MediaCodec.BufferInfo()
      while (true) {
        val size = video.readSampleData(buffer, 0)
        if (size < 0) break
        val key = video.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0
        info.set(0, size, video.sampleTime, if (key) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
        mux.writeSampleData(vOut, buffer, info)
        video.advance()
      }
      mux.stop()
    } finally {
      mux.release()
      video.release()
    }
  }

  /** The track decoded to 16-bit PCM, cut at `endUs` with a 1.2 s fade-out, and encoded to AAC (format + samples). */
  private fun encodeAudio(path: String, endUs: Long): Pair<MediaFormat, List<Pair<ByteArray, MediaCodec.BufferInfo>>> {
    val extractor = MediaExtractor().apply { setDataSource(path) }
    val track = (0 until extractor.trackCount).first { extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)!!.startsWith("audio/") }
    extractor.selectTrack(track)
    val inFormat = extractor.getTrackFormat(track)
    var rate = inFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
    var channels = inFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
    val info = MediaCodec.BufferInfo()

    // 1. Decode to PCM, only as far as the video lasts.
    val pcm = ByteArrayOutputStream()
    val decoder = MediaCodec.createDecoderByType(inFormat.getString(MediaFormat.KEY_MIME)!!)
    decoder.configure(inFormat, null, null, 0)
    decoder.start()
    try {
      var inputDone = false
      var outputDone = false
      while (!outputDone) {
        if (!inputDone) {
          val i = decoder.dequeueInputBuffer(5_000)
          if (i >= 0) {
            val n = extractor.readSampleData(decoder.getInputBuffer(i)!!, 0)
            if (n < 0) {
              decoder.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              decoder.queueInputBuffer(i, 0, n, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }
        val o = decoder.dequeueOutputBuffer(info, 5_000)
        if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          rate = decoder.outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          channels = decoder.outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        } else if (o >= 0) {
          val buffer = decoder.getOutputBuffer(o)!!
          val bytes = ByteArray(info.size)
          buffer.position(info.offset)
          buffer.get(bytes)
          pcm.write(bytes)
          decoder.releaseOutputBuffer(o, false)
          val enough = pcm.size() >= endUs * rate / 1_000_000 * 2 * channels
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0 || enough) outputDone = true
        }
      }
    } finally {
      decoder.stop()
      decoder.release()
      extractor.release()
    }

    // 2. Cut and fade.
    val frameBytes = 2 * channels
    val frames = minOf(pcm.size() / frameBytes.toLong(), endUs * rate / 1_000_000).toInt()
    val data = pcm.toByteArray()
    val samples = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
    val fade = rate * 6 / 5
    for (f in maxOf(0, frames - fade) until frames) {
      val gain = (frames - f).toFloat() / fade
      for (c in 0 until channels) {
        val k = f * channels + c
        samples.put(k, (samples.get(k) * gain).toInt().toShort())
      }
    }
    val total = frames * frameBytes

    // 3. Encode to AAC.
    val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    encoder.configure(
      MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, rate, channels).apply {
        setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
        setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 1 shl 16)
      },
      null,
      null,
      MediaCodec.CONFIGURE_FLAG_ENCODE,
    )
    encoder.start()
    val out = ArrayList<Pair<ByteArray, MediaCodec.BufferInfo>>()
    var format: MediaFormat? = null
    try {
      var pos = 0
      var eos = false
      while (true) {
        if (!eos) {
          val i = encoder.dequeueInputBuffer(5_000)
          if (i >= 0) {
            val input = encoder.getInputBuffer(i)!!
            input.clear()
            val n = minOf(input.remaining(), total - pos) / frameBytes * frameBytes
            val us = pos.toLong() / frameBytes * 1_000_000 / rate
            if (n <= 0) {
              encoder.queueInputBuffer(i, 0, 0, us, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              eos = true
            } else {
              input.put(data, pos, n)
              encoder.queueInputBuffer(i, 0, n, us, 0)
              pos += n
            }
          }
        }
        val o = encoder.dequeueOutputBuffer(info, 5_000)
        if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          format = encoder.outputFormat
        } else if (o >= 0) {
          if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0 && info.size > 0) {
            val buffer = encoder.getOutputBuffer(o)!!
            val bytes = ByteArray(info.size)
            buffer.position(info.offset)
            buffer.get(bytes)
            out.add(bytes to MediaCodec.BufferInfo().apply { set(0, info.size, info.presentationTimeUs, info.flags) })
          }
          encoder.releaseOutputBuffer(o, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
        }
      }
    } finally {
      encoder.stop()
      encoder.release()
    }
    return (format ?: throw IllegalStateException("journey-video: no audio format")) to out
  }

  private fun release() {
    runCatching { codec?.stop() }
    runCatching { codec?.release() }
    runCatching { if (muxing) muxer?.stop() }
    runCatching { muxer?.release() }
    codec = null
    muxer = null
    muxing = false
    frame?.recycle()
    frame = null
    cache.values.forEach { it.recycle() }
    cache.clear()
  }
}
