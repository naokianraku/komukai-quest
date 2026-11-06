// アプリアイコンを作る。橙の地に「小向」。
//   swift ios/scripts/make_icon.swift ios/Resources/Assets.xcassets/AppIcon.appiconset/icon.png
//
// App Store はアイコンにアルファチャンネルがあると受け取らない。
// CGContext は 24bit のビットマップを作れないので、32bit のまま
// alphaInfo を noneSkipLast（アルファを持たない）にして描き、そのまま PNG にする。
import AppKit
import ImageIO
import UniformTypeIdentifiers

let out = CommandLine.arguments.count > 1
    ? URL(fileURLWithPath: CommandLine.arguments[1])
    : URL(fileURLWithPath: "icon.png")
let S = 1024

guard let ctx = CGContext(
    data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
    fatalError("描画先を作れなかった")
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)

// 地: ゲームのアクセント色の橙。上をわずかに明るくして平板さを消す
let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [
    CGColor(srgbRed: 1.00, green: 0.58, blue: 0.16, alpha: 1),
    CGColor(srgbRed: 0.93, green: 0.42, blue: 0.03, alpha: 1),
] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: S), end: CGPoint(x: 0, y: 0), options: [])

// 下に工場の影。ボクセルのゲームなので、角のある塊を並べる
ctx.setFillColor(CGColor(srgbRed: 0.08, green: 0.09, blue: 0.10, alpha: 0.13))
for (x, w, h) in [(60, 150, 120), (230, 120, 190), (370, 190, 140),
                  (580, 140, 210), (740, 110, 150), (870, 120, 180)] {
    ctx.fill(CGRect(x: x, y: 0, width: w, height: h))
}

// 文字「小向」。ゲームの背景色（濃い炭色）で抜く
let ink = NSColor(srgbRed: 0.082, green: 0.090, blue: 0.102, alpha: 1)
let text = "小向" as NSString
let style = NSMutableParagraphStyle()
style.alignment = .center
let attrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 430, weight: .bold),
    .foregroundColor: ink,
    .paragraphStyle: style,
    .kern: -14,
]
let size = text.size(withAttributes: attrs)
text.draw(at: NSPoint(x: (CGFloat(S) - size.width) / 2,
                      y: (CGFloat(S) - size.height) / 2 + 34),
          withAttributes: attrs)

// 下線。ゲーム内の橙の下線と同じ役割（文字の足元を締める）
ctx.setFillColor(ink.cgColor)
ctx.fill(CGRect(x: 300, y: 196, width: 424, height: 26))

NSGraphicsContext.restoreGraphicsState()

guard let image = ctx.makeImage() else { fatalError("画像にできなかった") }
try! FileManager.default.createDirectory(
    at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
guard let dest = CGImageDestinationCreateWithURL(
    out as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("書き出せなかった")
}
CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else { fatalError("PNG を閉じられなかった") }
print("書いた: \(out.path)  \(S)x\(S)")
