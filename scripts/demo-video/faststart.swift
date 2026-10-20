import AVFoundation
let a = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
let out = URL(fileURLWithPath: CommandLine.arguments[2])
try? FileManager.default.removeItem(at: out)
let e = AVAssetExportSession(asset: a, presetName: AVAssetExportPresetPassthrough)!
e.outputURL = out; e.outputFileType = .mp4; e.shouldOptimizeForNetworkUse = true
let s = DispatchSemaphore(value: 0)
e.exportAsynchronously { s.signal() }
s.wait()
print(e.status.rawValue, e.error?.localizedDescription ?? "ok")
