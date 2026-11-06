import XCTest

/// 本物のタップでゲームが動くかを確かめる。
///
/// WKWebView の中は canvas と three.js の絵なので、XCUITest からは何も見えない。
/// アプリ側（GameView の probeJS）が JavaScript で覗いた結果を見えない文字に
/// 書き出しているので、それを読んで判定する。座標は CSS px ＝ ポイントなので、
/// 覗き見が返した位置をそのまま押せばゲーム内のボタンに当たる。
/// XCUIApplication は @MainActor。クラスごと付けないと Swift 6 で警告まみれになる。
@MainActor
final class GameUITests: XCTestCase {

    override func setUp() {
        continueAfterFailure = false
    }

    // MARK: - 下ごしらえ

    private func launch(_ game: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-uitest", "1"]
        if let game { app.launchArguments += ["-game", game] }
        app.launch()
        return app
    }

    /// 覗き見の文字を読む。読めるまで待つ。
    @discardableResult
    private func state(_ app: XCUIApplication,
                       timeout: TimeInterval = 30,
                       until: ([String: Any]) -> Bool = { _ in true },
                       _ what: String = "",
                       file: StaticString = #filePath, line: UInt = #line) -> [String: Any] {
        let el = app.staticTexts["gamestate"]
        XCTAssertTrue(el.waitForExistence(timeout: timeout),
                      "覗き見の文字が出てこない（-uitest が効いていない）", file: file, line: line)
        var last: [String: Any] = [:]
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if let d = el.label.data(using: .utf8),
               let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                last = o
                if until(o) { return o }
            }
            usleep(150_000)
        }
        XCTFail("\(what.isEmpty ? "状態" : what)にならなかった。最後に見えたもの: \(last)",
                file: file, line: line)
        return last
    }

    /// 覗き見が返した "x,y"（CSS px＝ポイント）を押せる座標に直す。
    private func point(_ app: XCUIApplication, _ s: Any?) -> XCUICoordinate? {
        guard let t = s as? String else { return nil }
        let p = t.split(separator: ",").compactMap { Double($0) }
        guard p.count == 2 else { return nil }
        return app.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: p[0], dy: p[1]))
    }

    // MARK: - テスト

    /// 起動して、ゲームが「指で遊ぶ端末」だと認識し、タッチ操作のUIを描いていること。
    /// ここが false だとボタンが1つも描かれず、指で何もできない。
    func testタッチ端末として認識して操作UIを描く() {
        let app = launch("stage=1&demo=380")
        let s = state(app, until: { ($0["drawn"] as? Bool) == true }, "操作UIが描かれる状態")
        XCTAssertEqual(s["touch"] as? Bool, true, "指で遊ぶ端末だと認識していない")
        XCTAssertEqual(s["drawn"] as? Bool, true, "タッチ操作の板が描かれていない")
        XCTAssertNotNil(point(app, s["atk"]), "攻撃ボタンの位置が取れない")
        XCTAssertGreaterThan((s["tags"] as? Int) ?? 0, 0, "敵の名札が1つも出ていない＝ゲームが動いていない")
    }

    /// タイトルの「はじめる」を押すとゲームが始まること。
    /// 指で遊ぶ端末では、ボタン以外を押しても音が解禁されるだけで始まらない作り。
    func testはじめるを押すと始まる() {
        let app = launch()
        let title = state(app, until: { ($0["start"] as? String)?.isEmpty == false },
                          "タイトルの「はじめる」が出る状態")
        XCTAssertEqual(title["screen"] as? String, "flex", "タイトルの紙が出ていない")

        guard let start = point(app, title["start"]) else {
            return XCTFail("「はじめる」の位置が取れない")
        }
        start.tap()

        // 「はじめる」の次はすぐ戦闘ではなく、作業指示書（intro）が出る。
        // 紙は出たままなので screen は flex のまま。「はじめる」が消えたことで見分ける。
        let intro = state(app, until: { (($0["start"] as? String) ?? "").isEmpty },
                          "作業指示書に変わった状態")
        XCTAssertEqual(intro["screen"] as? String, "flex", "作業指示書が出ていない")

        // 指示書はどこを押しても進む（タイトルだけが「はじめる」限定）
        guard let mid = point(app, intro["mid"]) else { return XCTFail("画面中央の位置が取れない") }
        Thread.sleep(forTimeInterval: 0.8)   // ゲーム側が 0.4 秒は受け付けない
        mid.tap()

        let playing = state(app, until: { ($0["screen"] as? String) == "none" }, "ゲームが始まった状態")
        XCTAssertEqual(playing["screen"] as? String, "none")
        XCTAssertEqual(playing["drawn"] as? Bool, true, "始まったのに操作UIが無い")
        XCTAssertGreaterThan((playing["tags"] as? Int) ?? 0, 0, "敵が1人も出ていない")
    }

    /// 攻撃ボタンを押すと、そのボタンが光ること。
    /// ＝指のタッチが WKWebView を通ってゲームの canvas まで届いている証拠。
    func test攻撃ボタンを押すと光る() {
        let app = launch("stage=1&demo=380")
        let before = state(app, until: { ($0["drawn"] as? Bool) == true }, "操作UIが描かれる状態")
        let cold = (before["warm"] as? Double) ?? -999
        XCTAssertGreaterThan(cold, -900, "攻撃ボタンの色を読めていない")

        XCTAssertLessThan((before["peak"] as? Double) ?? 999, cold + 20, "押す前から光っている")

        guard let atk = point(app, before["atk"]) else { return XCTFail("攻撃ボタンの位置が取れない") }
        // press() は指を離してから返ってくるので、外から押下中を覗くことはできない。
        // いちばん光ったときの値はゲーム側（probeJS の window.__peak）が覚えている。
        atk.press(forDuration: 1.2)

        let after = state(app, timeout: 10,
                          until: { (($0["peak"] as? Double) ?? -999) > cold + 20 },
                          "攻撃ボタンが光った状態")
        let peak = (after["peak"] as? Double) ?? -999
        XCTAssertGreaterThan(peak, cold + 20,
                             "攻撃ボタンが光らない＝タッチが canvas に届いていない（待機 \(cold) / 最大 \(peak)）")
    }

    /// スティックを倒すと景色が動くこと（＝歩けている）。
    /// 名札は世界の座標から投影しているので、カメラが動けば transform が変わる。
    func testスティックで歩くと景色が動く() {
        let app = launch("stage=1&demo=380")
        let before = state(app, until: { !(($0["cam"] as? String) ?? "").isEmpty }, "名札が出る状態")
        let camBefore = (before["cam"] as? String) ?? ""

        guard let from = point(app, before["stick"]),
              let to = point(app, before["stick2"]) else {
            return XCTFail("スティックの位置が取れない")
        }
        // 左半分を押して右へ倒し、そのまま保つ
        from.press(forDuration: 0.1, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 1.5)

        let after = state(app, timeout: 10,
                          until: { (($0["cam"] as? String) ?? "") != camBefore },
                          "景色が動いた状態")
        XCTAssertNotEqual(after["cam"] as? String, camBefore,
                          "スティックを倒しても景色が動かない＝歩けていない")
    }
}
