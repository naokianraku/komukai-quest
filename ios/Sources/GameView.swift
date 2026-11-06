import SwiftUI
import WebKit
import AVFoundation

/// UIテストのときだけ、ゲームの中の状態を外から読めるようにする入れ物。
/// XCUITest は WKWebView の中（canvas で描いたボタンや three.js の絵）を見られないので、
/// アプリ側が JavaScript で覗いた結果を、見えない文字として画面に置いておく。
@MainActor
final class GameProbe: ObservableObject {
    @Published var state = ""
}

/// ゲーム本体（WKWebView）。中身は Web 版とまったく同じものを同梱している。
struct GameView: UIViewRepresentable {
    /// UIテストのとき以外は nil。nil なら覗き見もしない。
    var probe: GameProbe?

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
        // Mac の Safari から中を覗ける。配布するビルドでは開けないようにする。
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif

        web.load(URLRequest(url: GameSchemeHandler.url(query: Self.query)))

        if let probe { context.coordinator.watch(web, probe: probe) }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    /// 最初に開く URL のクエリ。
    /// `app=1` はページの枠（角丸・影・キーボードの案内）を出さず画面いっぱいにする指定。
    /// シミュレーターで場面を確かめるときは起動引数を足す（塚越ナビと同じやり方）:
    ///   -game "stage=3&demo=1010"   第3ステージの途中から
    ///   -game "stage=ura&boss=1"    魔王戦をすぐ
    static var query: String {
        var q = "app=1"
        if let extra = UserDefaults.standard.string(forKey: "game"), !extra.isEmpty {
            q += "&" + extra
        }
        return q
    }

    /// UIテストから見るための覗き見スクリプト。
    /// canvas で描いたタッチ操作のボタンはアクセシビリティに出てこないので、
    /// 「本当に描かれたか」「押して光ったか」は画素を1点読むしか外から確かめる方法がない。
    /// 返す座標（atk/jump/stick）は CSS px ＝ UIKit のポイントと1:1なので、
    /// テスト側はそのまま tap できる。
    static let probeJS = """
    (() => {
      const g = (id) => document.getElementById(id);
      const st = g('stage') ? g('stage').getBoundingClientRect() : null;
      const pt = (lx, ly) => st
        ? Math.round(st.left + lx / 480 * st.width) + ',' + Math.round(st.top + ly / 270 * st.height)
        : '';
      let warm = -999, drawn = false;
      try {
        const pad = g('pad'), c = pad.getContext('2d'), s = pad.width / 480;
        drawn = pad.width > 0;
        // 攻撃ボタンの中。押されていればオレンジで塗られる＝赤みが出る
        const d = c.getImageData(Math.round(437 * s), Math.round(214 * s), 1, 1).data;
        warm = d[0] - d[2];
        // 押している間しか光らない。XCUITest の press() は離してから返ってくるので、
        // 外から覗いても間に合わない。いちばん光ったときの値をここで覚えておく。
        window.__peak = Math.max(window.__peak === undefined ? -999 : window.__peak, warm);
      } catch (e) {}
      const tag = document.querySelector('#labels .tag');
      // タイトルは「はじめる」を押さないと始まらない（空振りのタップは音の解禁だけ）。
      // ボタンの位置もここから渡す。
      const sb = document.querySelector('#screen .startbtn');
      const r = sb ? sb.getBoundingClientRect() : null;
      return JSON.stringify({
        start: r ? Math.round(r.left + r.width / 2) + ',' + Math.round(r.top + r.height / 2) : '',
        screen: g('screen') ? getComputedStyle(g('screen')).display : '?',
        hp: g('hpNum') ? g('hpNum').textContent.trim() : '?',
        touch: !!(('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0),
        drawn, warm, peak: window.__peak === undefined ? -999 : window.__peak,
        tags: document.querySelectorAll('#labels .tag').length,
        cam: tag ? tag.style.transform : '',
        atk: pt(437, 231), jump: pt(415, 188), stick: pt(110, 200), stick2: pt(176, 200),
        mid: pt(240, 150),
      });
    })()
    """

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let handler = GameSchemeHandler(root: Bundle.main.bundleURL)
        private var task: Task<Void, Never>?
        private var retried = false

        deinit { task?.cancel() }

        /// ゲームの中を定期的に覗いて、見えない文字に書き出す（UIテストのときだけ）。
        func watch(_ web: WKWebView, probe: GameProbe) {
            // WKWebView の中身をアクセシビリティの木から外す。外さないと XCUITest が
            // ページ全体（タイトルの紙の文字など）を毎回なめに行き、tap の前の
            // 「画面が落ち着くまで待つ」が何分経っても終わらずタップが失敗する。
            // 覗き見用の文字は WebView の外（兄弟）にあるので、これで消えはしない。
            web.accessibilityElementsHidden = true
            task?.cancel()
            task = Task { @MainActor [weak web] in
                while !Task.isCancelled {
                    try? await Task.sleep(for: .milliseconds(250))
                    guard let web else { return }
                    let r = try? await web.evaluateJavaScript(GameView.probeJS)
                    probe.state = (r as? String) ?? ""
                }
            }
        }

        /// WKWebView の中身は別プロセスで動いていて、裏に回っているあいだに
        /// OS に回収されることがある（three.js + WebGL は真っ先に切られる側）。
        /// 戻すものが無いと、画面いっぱいの WKWebView が空になって真っ黒のまま固まる。
        /// アプリ側に他のUIが無いので、押せる場所も無い。必ず貼り直す。
        /// 独自スキームだと履歴が無く reload() が空振りすることがあるので、
        /// 起動時と同じ URL を投げ直す。
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.load(URLRequest(url: GameSchemeHandler.url(query: GameView.query)))
        }

        /// 最初の読み込みに失敗したときも、同じく黒いままになる。1回だけやり直す。
        func webView(_ webView: WKWebView,
                     didFailProvisionalNavigation navigation: WKNavigation!,
                     withError error: Error) {
            guard !retried else { return }
            retried = true
            webView.load(URLRequest(url: GameSchemeHandler.url(query: GameView.query)))
        }

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
