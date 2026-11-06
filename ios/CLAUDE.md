# 小向クエスト（iPhone アプリ）— Claude 作業ガイド

Web 版の 3D（`game3d/`）をそのまま WKWebView に入れただけのアプリ。**ゲームのコードはここには無い**。
直すのは親リポジトリの `game3d/` と `game/src/`。このフォルダが持つのは、入れ物（Swift）とアイコンと
ビルドの手順だけ。MaxSauna / MaxRecovery / 塚越ナビとは別のアプリ。

## 決まりごと

- ゲームの挙動を直すときは `ios/` ではなく `../game3d/` `../game/src/` を直す。ブラウザで確かめてからアプリに入れる
- ゲームのファイルは青フォルダ（`project.yml` の `type: folder`）でそのまま入る。**ファイルを足しても `xcodegen` のやり直しは要らない**（フォルダごと参照しているため）
- 外部から読むものを増やさない。機内でも動くのが前提で、three.js も `game3d/vendor/` に同梱してある
- 社名は伏せたまま（親リポジトリの決まりと同じ）

## 基本情報

| 項目 | 値 |
|---|---|
| 表示名 | 小向クエスト |
| Bundle ID | com.anraku.KomukaiQuest |
| 対象 | iOS 18.0+、iPhone、**横向きのみ**、全画面（ステータスバーなし） |
| Team | Y5GK3529Q4 |
| 言語 | Swift 6、SwiftUI、外部ライブラリなし |
| 中身 | `game3d/` と `game/` を丸ごと同梱（約 2MB） |

## ビルド・確認

```bash
xcodegen   # Sources/ や Resources/ にファイルを足したとき（ゲームのファイルは不要）
xcodebuild build -scheme KomukaiQuest -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/DerivedData -quiet

APP=build/DerivedData/Build/Products/Debug-iphonesimulator/KomukaiQuest.app
xcrun simctl install "iPhone 17 Pro" "$APP"
xcrun simctl launch  "iPhone 17 Pro" com.anraku.KomukaiQuest
```

場面を確かめるときは起動引数 `-game` に Web 版と同じクエリを渡す（塚越ナビの `-boardSide` と同じやり方）。

```bash
xcrun simctl launch "iPhone 17 Pro" com.anraku.KomukaiQuest -game "stage=3&demo=1010"
xcrun simctl launch "iPhone 17 Pro" com.anraku.KomukaiQuest -game "stage=ura&boss=1&nosheet=1"
```

使えるクエリは Web 版と同じ（`stage` `ch` `demo` `boss` `meteor` `diff` `cast` `looks` `scene` `nosheet` `noshadow`）。
アプリは常に `app=1` を付けて開く＝ページの枠（角丸・影・キーボードの案内）を出さず画面いっぱいにする。

アイコンを作り直すとき:

```bash
swift scripts/make_icon.swift Resources/Assets.xcassets/AppIcon.appiconset/icon.png
```

## 作りの要点（はまりどころ）

- **`file://` では動かない。** ES モジュール（`import`）は file:// のページだとオリジンが null 扱いになり、
  WebKit が読み込みを断る。画面が真っ黒のまま止まる。そのため独自スキーム `komukai://game/...` を
  `WKURLSchemeHandler`（`Sources/GameScheme.swift`）で受けて、アプリの中のファイルを返している
- **`WKNavigationDelegate` のクロージャは `@escaping @MainActor @Sendable`。** Swift 6 でここを書き落とすと
  「よく似た別のメソッド」になり、警告は出るがデリゲートとして**黙って呼ばれなくなる**
- 画面は 16:9 固定（カメラの画角を 2D 版と揃える決まり）。19.5:9 の端末では左右が黒帯になる。引き伸ばさない
- BGM は `.ambient`＝消音スイッチに従う。ゲーム内にもミュートがある
- 攻撃ボタンが下端に近いので `.defersSystemGestures(on: .bottom)` を入れてある（1回目の下端スワイプでホームに戻らない）

## まだやっていないこと

- ゴールデンエイジ編（`game2-3d/`）は入れていない。本編だけのアプリ
- 実機への配布・App Store 申請。掲載文・スクリーンショット・審査メモも未作成
- 実機での確認（シミュレーターのみ）。特に音と、指でボタンを押したときの当たりは実機で見ること
