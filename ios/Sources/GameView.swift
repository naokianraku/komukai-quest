import SwiftUI
import WebKit
import AVFoundation

/// ゲーム本体（WKWebView）。中身は Web 版とまったく同じものを同梱している。
struct GameView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        // BGM は着信/消音スイッチに従わせる（.ambient）。ゲームなので、
        // 消音にしている人の意に反して鳴らさない。ゲーム内にもミュートはある。
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(context.coordinator.handler, forURLScheme: GameSchemeHandler.scheme)
        // 音は最初の操作から鳴らす（ゲーム側も初回のタップで鳴らし始める）
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        config.suppressesIncrementalRendering = true

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        // ゲームの画面を指で動かされると困る
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { web.isInspectable = true }   // Mac の Safari から覗ける

        web.load(URLRequest(url: GameSchemeHandler.url(query: Self.query)))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    /// 最初に開く URL のクエリ。
    /// `app=1` はページの枠（角丸・影・キーボードの案内）を出さず画面いっぱいにする指定。
    /// シミュレーターで場面を確かめるときは起動引数を足す（塚越ナビと同じやり方）:
    ///   -game "stage=3&demo=1010"   第3ステージの途中から
    ///   -game "stage=ura&boss=1"    魔王戦をすぐ
    private static var query: String {
        var q = "app=1"
        if let extra = UserDefaults.standard.string(forKey: "game"), !extra.isEmpty {
            q += "&" + extra
        }
        return q
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let handler = GameSchemeHandler(root: Bundle.main.bundleURL)

        /// 外のリンク（あそびかた等）はアプリの中で開かず、Safari に渡す。
        /// クロージャの `@MainActor @Sendable` は WKNavigationDelegate の宣言どおり。
        /// 付け忘れると「よく似た別のメソッド」になり、黙って呼ばれなくなる。
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel); return
            }
            if url.scheme == GameSchemeHandler.scheme {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                UIApplication.shared.open(url)
            }
        }
    }
}
