import Foundation
import WebKit

/// アプリに同梱したゲームを `komukai://game/...` として WKWebView へ渡す。
///
/// file:// のままだと ES モジュール（import 文）が読めない。file:// のページは
/// オリジンが null 扱いになり、WebKit がモジュールの読み込みを断るため、
/// ゲームが真っ黒のまま止まる。独自スキームにすると普通のオリジンとして扱われ、
/// import がそのまま通る。
final class GameSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "komukai"
    static let host = "game"
    /// 入口。ここから下のファイルしか返さない。
    static let entry = "game3d/index.html"

    private let root: URL

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    /// `komukai://game/game3d/index.html?stage=2` のような URL を作る。
    static func url(path: String = entry, query: String? = nil) -> URL {
        var c = URLComponents()
        c.scheme = scheme
        c.host = host
        c.path = "/" + path
        c.query = query
        return c.url!
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, let file = resolve(url) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        do {
            let data = try Data(contentsOf: file)
            let response = URLResponse(
                url: url,
                mimeType: Self.mime(for: file.pathExtension),
                expectedContentLength: data.count,
                textEncodingName: "utf-8")
            task.didReceive(response)
            task.didReceive(data)
            task.didFinish()
        } catch {
            task.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    /// URL をアプリの中のファイルに直す。root の外へは絶対に出さない。
    private func resolve(_ url: URL) -> URL? {
        var path = url.path
        if path.isEmpty || path == "/" { path = "/" + Self.entry }
        if path.hasSuffix("/") { path += "index.html" }
        let decoded = path.removingPercentEncoding ?? path
        let file = root.appendingPathComponent(decoded).standardizedFileURL
        // `..` で同梱物の外を読まれないようにする
        guard file.path.hasPrefix(root.path + "/") else { return nil }
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        return file
    }

    private static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html"
        case "js", "mjs":   return "text/javascript"
        case "css":         return "text/css"
        case "json":        return "application/json"
        case "png":         return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg":         return "image/svg+xml"
        case "webmanifest": return "application/manifest+json"
        default:            return "application/octet-stream"
        }
    }
}
