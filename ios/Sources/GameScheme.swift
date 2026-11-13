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
    /// アプリを開いたときに最初に出すページ（2作品の選択画面）。
    /// 配るのはこの下に限らず、root（アプリのバンドル）の下ぜんぶ。
    static let entry = "launcher/index.html"

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
    /// `url.path` は末尾のスラッシュを落とす（"komukai://game/game3d/" → "/game3d"）ので、
    /// 「/ で終わっていたら index.html」は効かない。ファイルを引いてからフォルダかどうかで決める。
    private func resolve(_ url: URL) -> URL? {
        var path = url.path(percentEncoded: false)
        if path.isEmpty || path == "/" { path = "/" + Self.entry }
        var file = root.appendingPathComponent(path).standardizedFileURL
        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: file.path, isDirectory: &isDir), isDir.boolValue {
            file = file.appendingPathComponent("index.html")
        }
        // `..` で同梱物の外を読まれないようにする
        guard file.path.hasPrefix(root.path + "/") else { return nil }
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        return file
    }

    /// クエリに app が無ければ app=1 を足した URL を返す（あれば nil）。
    /// app=1 はページの枠（角丸・影・キーボードの案内）を消す指定で、ページを移るたびに
    /// 付け直さないと、行った先のページに枠が出る。
    static func withApp(_ url: URL) -> URL? {
        guard var c = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        var items = c.queryItems ?? []
        if items.contains(where: { $0.name == "app" }) { return nil }
        items.insert(URLQueryItem(name: "app", value: "1"), at: 0)
        c.queryItems = items
        return c.url
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
