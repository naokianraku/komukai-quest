// アプリアイコンを作る。「小向」の文字を、業火のステージの見た目に寄せて加工する。
//
//   swift ios/scripts/make_icon.swift <出力先.png> [案]
//   案: ember（業火・既定）/ drip（滴り）/ crack（亀裂）/ plain（加工なし）/ sheet（比較用）
//
// 文字はフォントの輪郭を CGPath で取り出してから加工する。影や縁取りを足すだけでは
// 「おどろおどろしい」にならないので、輪郭そのものを食い込ませたり垂らしたりする。
//
// App Store はアイコンにアルファチャンネルがあると受け取らない。
// CGContext は 24bit のビットマップを作れないので、32bit のまま
// alphaInfo を noneSkipLast（アルファを持たない）にして描き、そのまま PNG にする。
import AppKit
import CoreText
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let out = URL(fileURLWithPath: args.count > 1 ? args[1] : "icon.png")
let style = args.count > 2 ? args[2] : "ember"

func C(_ hex: String, _ a: Double = 1) -> CGColor {
    var v: UInt64 = 0
    Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
    return CGColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255,
                   blue: CGFloat(v & 255) / 255, alpha: CGFloat(a))
}

/// 決まった種から同じ乱数を出す。毎回絵が変わると案を比べられない。
struct RNG {
    var s: UInt64
    mutating func next() -> Double {
        s = s &* 6364136223846793005 &+ 1442695040888963407
        return Double((s >> 33) & 0xFFFFFF) / Double(0xFFFFFF)
    }
    mutating func range(_ a: Double, _ b: Double) -> Double { a + (b - a) * next() }
}

/// 文字をパスにする。塗りや影ではなく輪郭そのものを触りたいので、グリフの形を取り出す。
func textPath(_ text: String, _ size: CGFloat, _ kern: CGFloat) -> CGPath {
    let font = CTFontCreateWithName("HiraginoSans-W8" as CFString, size, nil)
    let attr = NSAttributedString(string: text, attributes: [
        kCTFontAttributeName as NSAttributedString.Key: font,
        kCTKernAttributeName as NSAttributedString.Key: kern,
    ])
    let line = CTLineCreateWithAttributedString(attr)
    let path = CGMutablePath()
    for run in CTLineGetGlyphRuns(line) as! [CTRun] {
        let f = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
        let n = CTRunGetGlyphCount(run)
        var gs = [CGGlyph](repeating: 0, count: n)
        var ps = [CGPoint](repeating: .zero, count: n)
        CTRunGetGlyphs(run, CFRange(location: 0, length: n), &gs)
        CTRunGetPositions(run, CFRange(location: 0, length: n), &ps)
        for i in 0..<n {
            guard let gp = CTFontCreatePathForGlyph(f, gs[i], nil) else { continue }
            let t = CGAffineTransform(translationX: ps[i].x, y: ps[i].y)
            path.addPath(gp, transform: t)
        }
    }
    return path
}

/// 画面の真ん中に置き直す
func centered(_ p: CGPath, _ S: CGFloat, _ dy: CGFloat) -> CGPath {
    let b = p.boundingBoxOfPath
    var t = CGAffineTransform(translationX: (S - b.width) / 2 - b.minX,
                              y: (S - b.height) / 2 - b.minY + dy)
    return p.copy(using: &t)!
}

/// 文字の下端をたどる。滴りを垂らす位置を知るために使う。
func bottomEdge(_ p: CGPath, step: CGFloat) -> [CGPoint] {
    let b = p.boundingBoxOfPath
    var pts: [CGPoint] = []
    var x = b.minX + 2
    while x < b.maxX - 2 {
        var y = b.minY
        while y < b.maxY {
            if p.contains(CGPoint(x: x, y: y)) { pts.append(CGPoint(x: x, y: y)); break }
            y += 3
        }
        x += step
    }
    return pts
}

func drawIcon(_ ctx: CGContext, _ S: Int, _ style: String) {
    let s = CGFloat(S)
    var rng = RNG(s: 20261106)
    let glyph = centered(textPath("小向", s * 0.44, -s * 0.03), s, s * 0.015)
    let gb = glyph.boundingBoxOfPath

    // ===== 地 =====
    switch style {
    case "plain":
        let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                           colors: [C("#ff9429"), C("#ed6b08")] as CFArray, locations: [0, 1])!
        ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: s), end: .zero, options: [])
    case "crack":
        ctx.setFillColor(C("#3a0d0a")); ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))
        let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                           colors: [C("#601610", 0.0), C("#1c0605")] as CFArray, locations: [0, 1])!
        ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: s), end: .zero, options: [])
    default:
        ctx.setFillColor(C("#120a08")); ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))
        // 下から燃え上がる照り返し。業火のステージの地明かりと同じ考え方
        let hot = style == "drip" ? "#6e0a0a" : "#ff6a1e"
        let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                           colors: [C(hot, 0.58), C(hot, 0.0)] as CFArray, locations: [0, 1])!
        ctx.drawRadialGradient(g, startCenter: CGPoint(x: s / 2, y: s * 0.16), startRadius: 0,
                               endCenter: CGPoint(x: s / 2, y: s * 0.16), endRadius: s * 0.78, options: [])
    }

    // 地の下に工場の影
    ctx.setFillColor(C(style == "plain" ? "#15171a" : "#000000", style == "plain" ? 0.13 : 0.5))
    let u = s / 100
    for (x, w, h) in [(2, 13, 9), (18, 10, 14), (31, 15, 10), (54, 11, 15), (70, 9, 11), (84, 12, 13)] {
        ctx.fill(CGRect(x: CGFloat(x) * u, y: 0, width: CGFloat(w) * u, height: CGFloat(h) * u))
    }

    if style == "plain" {
        ctx.setFillColor(C("#15171a")); ctx.addPath(glyph); ctx.fillPath()
        ctx.fill(CGRect(x: s * 0.29, y: s * 0.19, width: s * 0.42, height: s * 0.026))
        return
    }

    // ===== 滴り（文字より先に垂らす。文字が上に乗るので根元が自然になる）=====
    if style == "drip" {
        for (i, pt) in bottomEdge(glyph, step: s * 0.011).enumerated() where i % 6 == 0 {
            if rng.next() > 0.6 { continue }
            let len = rng.range(s * 0.05, s * 0.24)
            let w = rng.range(s * 0.013, s * 0.028)
            ctx.setFillColor(C("#7d0d0d"))
            ctx.fill(CGRect(x: pt.x - w / 2, y: pt.y - len, width: w, height: len + w))
            ctx.fillEllipse(in: CGRect(x: pt.x - w * 0.8, y: pt.y - len - w * 0.85,
                                       width: w * 1.6, height: w * 1.6))   // 先の玉
        }
    }

    // ===== 文字の中 =====
    ctx.saveGState()
    ctx.addPath(glyph)
    ctx.clip()
    switch style {
    case "ember":
        // 炭。下から熱せられて、根元が白熱している
        // 上を真っ黒まで落とすと、暗い地に沈んで60pxで字が読めなくなる。
        // いちばん暗い所でも地より明るい赤で止める。
        let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [
            C("#ffe8b8"), C("#ff9424"), C("#d3440c"), C("#8a2409"),
        ] as CFArray, locations: [0, 0.26, 0.62, 1])!
        ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: gb.minY), end: CGPoint(x: 0, y: gb.maxY), options: [])
    case "drip":
        let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                           colors: [C("#5c0707"), C("#c41818"), C("#8d0f0f")] as CFArray,
                           locations: [0, 0.45, 1])!
        ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: gb.minY), end: CGPoint(x: 0, y: gb.maxY), options: [])
    default:   // crack: 骨の色
        ctx.setFillColor(C("#e6ddc8")); ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))
        let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                           colors: [C("#a89878", 0.85), C("#e6ddc8", 0)] as CFArray, locations: [0, 1])!
        ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: gb.minY), end: CGPoint(x: 0, y: gb.midY), options: [])
    }

    // 縁を食い込ませる。輪郭の帯の中だけに暗い粒を散らすと、腐食したように見える
    if let band = CGPath(__byStroking: glyph, transform: nil, lineWidth: s * 0.02,
                         lineCap: .round, lineJoin: .round, miterLimit: 10) {
        ctx.saveGState(); ctx.addPath(band); ctx.clip()
        ctx.setFillColor(C(style == "crack" ? "#1b0604" : "#140705", 0.95))
        for _ in 0..<(style == "crack" ? 700 : 480) {
            let x = rng.range(gb.minX - 12, gb.maxX + 12)
            let y = rng.range(gb.minY - 12, gb.maxY + 12)
            let r = rng.range(s * 0.004, s * 0.015)
            ctx.fillEllipse(in: CGRect(x: x, y: y, width: r, height: r))
        }
        ctx.restoreGState()
    }

    // ひび。文字の中を細い線が走る
    ctx.setLineCap(.round)
    for _ in 0..<(style == "crack" ? 30 : 15) {
        var x = rng.range(gb.minX, gb.maxX)
        var y = rng.range(gb.minY, gb.maxY)
        let p = CGMutablePath()
        p.move(to: CGPoint(x: x, y: y))
        for _ in 0..<Int(rng.range(3, 7)) {
            x += rng.range(-s * 0.07, s * 0.07)
            y += rng.range(-s * 0.08, s * 0.08)
            p.addLine(to: CGPoint(x: x, y: y))
        }
        ctx.setStrokeColor(C(style == "crack" ? "#1b0604" : "#120604", 0.88))
        ctx.setLineWidth(rng.range(s * 0.004, s * 0.012))
        ctx.addPath(p); ctx.strokePath()
    }
    ctx.restoreGState()

    // ===== 文字の外 =====
    if style == "ember" {
        // 熱の滲み。輪郭のまわりをぼかして、焼けているように見せる
        ctx.saveGState()
        ctx.setShadow(offset: .zero, blur: s * 0.075, color: C("#ff6a1e", 0.95))
        ctx.setStrokeColor(C("#ffa040", 0.7))
        ctx.setLineWidth(s * 0.011)
        ctx.addPath(glyph); ctx.strokePath()
        ctx.restoreGState()
        // 火の粉。上へ行くほど小さく、薄くなる
        for _ in 0..<110 {
            let x = rng.range(gb.minX - s * 0.05, gb.maxX + s * 0.05)
            let y = rng.range(gb.minY, gb.maxY + s * 0.24)
            let t = max(0, min(1, (y - gb.minY) / (gb.maxY - gb.minY + 1)))
            let r = rng.range(s * 0.003, s * 0.0095) * (1 - t * 0.6)
            ctx.setFillColor(C(rng.next() > 0.5 ? "#ffd24a" : "#ff7f0e", 0.9 * (1 - t * 0.7)))
            ctx.fillEllipse(in: CGRect(x: x, y: y, width: r, height: r))
        }
    } else {
        ctx.saveGState()
        ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.007), blur: s * 0.035,
                      color: C("#000000", 0.9))
        ctx.setStrokeColor(C(style == "crack" ? "#2a0a07" : "#2b0404", 0.92))
        ctx.setLineWidth(s * 0.007)
        ctx.addPath(glyph); ctx.strokePath()
        ctx.restoreGState()
    }
}

func render(_ S: Int, _ style: String) -> CGImage {
    let ctx = CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    drawIcon(ctx, S, style)
    return ctx.makeImage()!
}

func write(_ image: CGImage, _ url: URL) {
    try! FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                             withIntermediateDirectories: true)
    let d = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, image, nil)
    _ = CGImageDestinationFinalize(d)
}

if style == "sheet" {
    let variants = [("plain", "0 いまの"), ("ember", "① 業火"), ("drip", "② 滴り"), ("crack", "③ 亀裂")]
    let big = 270, small = 60, pad = 22, labelH = 32
    let w = pad + (big + pad) * variants.count, h = pad + labelH + big + 14 + small + pad
    let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    ctx.setFillColor(C("#e8e8e4")); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
    for (i, v) in variants.enumerated() {
        let x = pad + (big + pad) * i
        let yBig = h - pad - labelH - big
        // iOS は角を丸めて出す。丸めた状態で見ないと判断できない
        let p1 = CGPath(roundedRect: CGRect(x: x, y: yBig, width: big, height: big),
                        cornerWidth: CGFloat(big) * 0.225, cornerHeight: CGFloat(big) * 0.225, transform: nil)
        ctx.saveGState(); ctx.addPath(p1); ctx.clip()
        ctx.draw(render(810, v.0), in: CGRect(x: x, y: yBig, width: big, height: big))
        ctx.restoreGState()
        let ys = yBig - 14 - small
        let p2 = CGPath(roundedRect: CGRect(x: x, y: ys, width: small, height: small),
                        cornerWidth: CGFloat(small) * 0.225, cornerHeight: CGFloat(small) * 0.225, transform: nil)
        ctx.saveGState(); ctx.addPath(p2); ctx.clip()
        ctx.draw(render(240, v.0), in: CGRect(x: x, y: ys, width: small, height: small))
        ctx.restoreGState()
        (v.1 as NSString).draw(at: NSPoint(x: x, y: h - pad - 23), withAttributes: [
            .font: NSFont.systemFont(ofSize: 15, weight: .bold),
            .foregroundColor: NSColor(srgbRed: 0.12, green: 0.12, blue: 0.11, alpha: 1)])
        ("60px" as NSString).draw(at: NSPoint(x: x + small + 9, y: ys + 21), withAttributes: [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: NSColor(srgbRed: 0.45, green: 0.45, blue: 0.43, alpha: 1)])
    }
    NSGraphicsContext.restoreGraphicsState()
    write(ctx.makeImage()!, out)
    print("比較用を書いた: \(out.path)")
} else {
    write(render(1024, style), out)
    print("書いた: \(out.path)  1024x1024  案=\(style)")
}
