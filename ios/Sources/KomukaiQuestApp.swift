import SwiftUI

@main
struct KomukaiQuestApp: App {
    /// UIテスト（-uitest 1）のときだけ、ゲームの中の状態を見えない文字に出す。
    /// 普段のビルドでは覗き見そのものを動かさない。
    private let uiTest = UserDefaults.standard.bool(forKey: "uitest")
    @StateObject private var probe = GameProbe()

    var body: some Scene {
        WindowGroup {
            ZStack(alignment: .topLeading) {
                GameView(probe: uiTest ? probe : nil)
                if uiTest {
                    // XCUITest はこの文字を読む。目には見えないが、
                    // opacity 0 にすると要素ごと消えてテストから読めなくなる。
                    Text(probe.state)
                        .font(.system(size: 1))
                        .foregroundStyle(.clear)
                        .opacity(0.01)
                        .allowsHitTesting(false)
                        .accessibilityIdentifier("gamestate")
                }
            }
            // ゲームは画面いっぱい。切り欠きの避け方は中の CSS
            // （viewport-fit=cover と env(safe-area-inset-*)）が持っている。
            .ignoresSafeArea()
            .background(Color.black)
            .statusBarHidden()
            .persistentSystemOverlays(.hidden)   // 下のホームバーも薄くする
            // 攻撃ボタンは画面の下のほうにある。下端から指を上げたときに
            // いきなりホームへ戻らないよう、1回目のスワイプは渡さない。
            .defersSystemGestures(on: .bottom)
        }
    }
}
