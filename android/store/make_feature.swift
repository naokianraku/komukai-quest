// Google Play の「フィーチャー グラフィック」（1024×500）を作る。
// 左にアプリのアイコンの絵（iPhone 版と同じ）、右に名前と一言。
//
//   swift android/store/make_feature.swift ios/Resources/Assets.xcassets/AppIcon.appiconset/icon.png android/store/feature-1024x500.jpg
//
// Play はフィーチャー グラフィックに透明を受け付けないので、JPEG で書き出す。
import AppKit
import CoreText

let args = CommandLine.arguments
let iconURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let W = 1024, H = 500

func C(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255,
            blue: CGFloat(hex & 255) / 255, alpha: a)
}

let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!

// 地: アイコンの縁の色からさらに暗く（右ほど暗い）
let grad = CGGradient(colorsSpace: space, colors: [C(0x2C1409), C(0x120A08)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: 0), end: CGPoint(x: CGFloat(W), y: 0), options: [])

// アイコンの絵（正方形）を左に。縁は地になじませる
let src = CGImageSourceCreateWithURL(iconURL as CFURL, nil)!
let icon = CGImageSourceCreateImageAtIndex(src, 0, nil)!
ctx.draw(icon, in: CGRect(x: 0, y: 0, width: H, height: H))
let fade = CGGradient(colorsSpace: space, colors: [C(0x2C1409, 0), C(0x2C1409, 1)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(fade, start: CGPoint(x: CGFloat(H) - 90, y: 0), end: CGPoint(x: CGFloat(H) + 4, y: 0), options: [])

// 文字
func draw(_ text: String, font: String, size: CGFloat, color: CGColor, x: CGFloat, baseline: CGFloat, kern: CGFloat = 0) {
    let f = CTFontCreateWithName(font as CFString, size, nil)
    let attr: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): f,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
        NSAttributedString.Key(kCTKernAttributeName as String): kern,
    ]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attr))
    ctx.textPosition = CGPoint(x: x, y: baseline)
    CTLineDraw(line, ctx)
}
let x0: CGFloat = 532
draw("KOMUKAI QUEST", font: "HiraginoSans-W7", size: 30, color: C(0xFF8F2E), x: x0 + 4, baseline: 318, kern: 3)
draw("小向クエスト", font: "HiraginoSans-W8", size: 78, color: C(0xFFFFFF), x: x0, baseline: 222, kern: 2)
draw("工場を生き残れ。", font: "HiraginoSans-W6", size: 30, color: C(0xF2E6DA), x: x0 + 4, baseline: 150)
draw("有休が残機のアクション", font: "HiraginoSans-W6", size: 30, color: C(0xF2E6DA), x: x0 + 4, baseline: 108)

let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.92])!
try! data.write(to: outURL)
print("wrote \(outURL.path) \(W)x\(H)")
