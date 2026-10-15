// Frames to an H.264 video, and a video plus an audio file to one MP4. No ffmpeg needed.
//   mux video plan.json out.mp4        (plan: { width, height, fps, dir, segments: [{ file, start, count }] })
//   mux merge video.mp4 audio.m4a out.mp4
import AVFoundation
import AppKit

struct Seg: Decodable { let file: String; let start: Int; let count: Int }
struct Plan: Decodable { let width: Int; let height: Int; let fps: Int; let dir: String; let segments: [Seg] }

func fail(_ m: String) -> Never { FileHandle.standardError.write((m + "\n").data(using: .utf8)!); exit(1) }

func renderVideo(planPath: String, out: String) {
    guard let data = FileManager.default.contents(atPath: planPath), let plan = try? JSONDecoder().decode(Plan.self, from: data) else { fail("bad plan") }
    try? FileManager.default.removeItem(atPath: out)
    guard let writer = try? AVAssetWriter(outputURL: URL(fileURLWithPath: out), fileType: .mp4) else { fail("no writer") }
    let settings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: plan.width, AVVideoHeightKey: plan.height,
        AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 6_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
    ]
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: plan.width, kCVPixelBufferHeightKey as String: plan.height,
    ])
    writer.add(input)
    guard writer.startWriting() else { fail("cannot start: \(String(describing: writer.error))") }
    writer.startSession(atSourceTime: .zero)
    let space = CGColorSpaceCreateDeviceRGB()
    for seg in plan.segments {
        guard let img = NSImage(contentsOfFile: plan.dir + "/" + seg.file), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fail("cannot read \(seg.file)") }
        var pbOpt: CVPixelBuffer?
        CVPixelBufferCreate(nil, plan.width, plan.height, kCVPixelFormatType_32BGRA, nil, &pbOpt)
        guard let pb = pbOpt else { fail("no pixel buffer") }
        CVPixelBufferLockBaseAddress(pb, [])
        if let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: plan.width, height: plan.height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: space,
                               bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) {
            ctx.interpolationQuality = .high
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: plan.width, height: plan.height))
        }
        CVPixelBufferUnlockBaseAddress(pb, [])
        for i in 0..<seg.count {
            while !input.isReadyForMoreMediaData { usleep(2000) }
            if !adaptor.append(pb, withPresentationTime: CMTime(value: Int64(seg.start + i), timescale: Int32(plan.fps))) { fail("append failed: \(String(describing: writer.error))") }
        }
    }
    input.markAsFinished()
    let sem = DispatchSemaphore(value: 0)
    writer.finishWriting { sem.signal() }
    sem.wait()
    if writer.status != .completed { fail("video failed: \(String(describing: writer.error))") }
}

func merge(video: String, audio: String, out: String) {
    try? FileManager.default.removeItem(atPath: out)
    let comp = AVMutableComposition()
    let v = AVURLAsset(url: URL(fileURLWithPath: video)), a = AVURLAsset(url: URL(fileURLWithPath: audio))
    guard let vt = v.tracks(withMediaType: .video).first, let at = a.tracks(withMediaType: .audio).first,
          let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
          let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { fail("no tracks") }
    try? cv.insertTimeRange(CMTimeRange(start: .zero, duration: v.duration), of: vt, at: .zero)
    try? ca.insertTimeRange(CMTimeRange(start: .zero, duration: min(a.duration, v.duration)), of: at, at: .zero)
    guard let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough) else { fail("no export") }
    ex.outputURL = URL(fileURLWithPath: out); ex.outputFileType = .mp4
    let sem = DispatchSemaphore(value: 0)
    ex.exportAsynchronously { sem.signal() }
    sem.wait()
    if ex.status != .completed { fail("merge failed: \(String(describing: ex.error))") }
}

let a = CommandLine.arguments
if a.count == 4 && a[1] == "video" { renderVideo(planPath: a[2], out: a[3]) }
else if a.count == 5 && a[1] == "merge" { merge(video: a[2], audio: a[3], out: a[4]) }
else { fail("usage: mux video plan.json out.mp4 | mux merge video.mp4 audio.m4a out.mp4") }
