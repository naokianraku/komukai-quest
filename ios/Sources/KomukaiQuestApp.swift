import SwiftUI

@main
struct KomukaiQuestApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
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
