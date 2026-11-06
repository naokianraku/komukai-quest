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
| Bundle ID | com.anraku.komukai |
| 対象 | iOS 18.0+、iPhone、**横向きのみ**、全画面（ステータスバーなし） |
| Team | Y5GK3529Q4 |
| 言語 | Swift 6、SwiftUI、外部ライブラリなし |
| 中身 | `game3d/` と `game/` を丸ごと同梱（約 2MB） |

## ビルド・確認

**端末は名前ではなく UDID で指定すること。** この Mac には同じ名前のシミュレーターが
複数あり、MaxSauna や塚越ナビのセッションと取り合いになる。UI テストの途中で
ほかのアプリに画面を取られると落ちる。`xcrun simctl list devices available` で
誰も使っていないものを選ぶ。

```bash
SIM=264BF619-05C9-481D-BA48-FA014B4398F0   # iPhone 17 Pro Max / iOS 26.4
xcodegen   # Sources/ Tests/ Resources/ にファイルを足したとき（ゲームのファイルは不要）
xcodebuild build -scheme KomukaiQuest -destination "platform=iOS Simulator,id=$SIM" -derivedDataPath build/DerivedData -quiet
xcodebuild test  -scheme KomukaiQuest -destination "platform=iOS Simulator,id=$SIM" -derivedDataPath build/DerivedData

APP=build/DerivedData/Build/Products/Debug-iphonesimulator/KomukaiQuest.app
xcrun simctl install "$SIM" "$APP"
xcrun simctl launch  "$SIM" com.anraku.komukai
```

場面を確かめるときは起動引数 `-game` に Web 版と同じクエリを渡す（塚越ナビの `-boardSide` と同じやり方）。

```bash
xcrun simctl launch "iPhone 17 Pro" com.anraku.komukai -game "stage=3&demo=1010"
xcrun simctl launch "iPhone 17 Pro" com.anraku.komukai -game "stage=ura&boss=1&nosheet=1"
```

使えるクエリは Web 版と同じ（`stage` `ch` `demo` `boss` `meteor` `diff` `cast` `looks` `scene` `nosheet` `noshadow`）。
アプリは常に `app=1` を付けて開く＝ページの枠（角丸・影・キーボードの案内）を出さず画面いっぱいにする。

アイコンを作り直すとき:

```bash
swift scripts/make_icon.swift Resources/Assets.xcassets/AppIcon.appiconset/icon.png
```

## UIテスト（本物のタップで確かめる）

`Tests/GameUITests.swift`。シミュレーターに実際にタップとドラッグを流して、4つを見る。

| 見るもの | なぜ要るか |
|---|---|
| タッチ端末として認識し、操作UIを描く | ここが false だとボタンが1つも描かれず、指で何もできない |
| 「はじめる」を押すと始まる | タイトルはボタン以外を押しても始まらない作り。押せているかは外からしか分からない |
| 攻撃ボタンを押すと光る | タッチが WKWebView を越えて canvas まで届いている証拠 |
| スティックを倒すと景色が動く | 歩けている証拠 |

仕組み: WKWebView の中（canvas と three.js の絵）は XCUITest から一切見えない。
アプリを `-uitest 1` で起動すると、`GameView.probeJS` が 0.25 秒ごとにページを覗いて、
結果を**見えない文字**（`accessibilityIdentifier("gamestate")`）に書き出す。テストはそれを読む。
覗き見が返す座標は CSS px ＝ UIKit のポイントなので、そのまま `XCUICoordinate` で押せる。

はまったこと:
- **WKWebView をアクセシビリティの木から外さないと tap が失敗する。** 外さないと XCUITest が
  ページ全体をなめに行き、タップ前の「画面が落ち着くまで待つ」が終わらない（実測 324 秒かけて失敗）。
  `web.accessibilityElementsHidden = true`（UIテストのときだけ）で直る
- **`press(forDuration:)` は指を離してから返る。** 押下中の光りを外から覗くことはできないので、
  いちばん光ったときの値をページ側（`window.__peak`）で覚えている
- 「はじめる」の次はすぐ戦闘ではなく作業指示書（intro）。紙は出たままなので `screen` は `flex` のまま

## 作りの要点（はまりどころ）

- **`file://` では動かない。** ES モジュール（`import`）は file:// のページだとオリジンが null 扱いになり、
  WebKit が読み込みを断る。画面が真っ黒のまま止まる。そのため独自スキーム `komukai://game/...` を
  `WKURLSchemeHandler`（`Sources/GameScheme.swift`）で受けて、アプリの中のファイルを返している
- **`WKNavigationDelegate` のクロージャは `@escaping @MainActor @Sendable`。** Swift 6 でここを書き落とすと
  「よく似た別のメソッド」になり、警告は出るがデリゲートとして**黙って呼ばれなくなる**
- 画面は 16:9 固定（カメラの画角を 2D 版と揃える決まり）。19.5:9 の端末では左右が黒帯になる。引き伸ばさない
- BGM は `.ambient`＝消音スイッチに従う。ゲーム内にもミュートがある
- 攻撃ボタンが下端に近いので `.defersSystemGestures(on: .bottom)` を入れてある（1回目の下端スワイプでホームに戻らない）

## App Store Connect の登録内容（2026-11-06 時点）

| 項目 | 値 |
|---|---|
| App ID | 6831629914 |
| Bundle ID / SKU | com.anraku.komukai / komukai-quest |
| App ID（Developer Portal） | 993QCH23TK |
| 配布用プロファイル | Komukai Quest App Store（2027-11-03まで）。`~/.config/apple-signing/profiles/komukai_appstore.mobileprovision` |
| TestFlight 内部グループ | 「自分」 38b530a4-230e-46cb-a927-fe57421ac250（全ビルド自動配布） |
| バージョン 1.0 | PREPARE_FOR_SUBMISSION / releaseType=AFTER_APPROVAL（審査通過後に自動公開） |
| 上がっているビルド | 1（VALID・IN_BETA_TESTING） |

**審査には出していない。** 提出は本人のはっきりした OK が要る（公開は自動公開の設定済み）。

### TestFlight に上げ直す手順

```bash
cd ios
# 1) 版番号を上げる（project.yml の CFBundleVersion。同じ番号は受け取ってもらえない）
xcodegen
W=/tmp/komukai-dist && mkdir -p $W
# 2) 署名せずにアーカイブ
xcodebuild archive -scheme KomukaiQuest -configuration Release -destination generic/platform=iOS \
  -archivePath $W/KomukaiQuest.xcarchive -derivedDataPath build/DerivedData-dist \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
# 3) 一時キーチェーンで署名して ipa にする（手本: scratchpad の dist/sign.sh、元は塚越ナビの release_testflight.sh）
# 4) 上げる。--p8-file-path を付けないと鍵を見つけられない
xcrun altool --upload-app -f $W/KomukaiQuest.ipa -t ios \
  --apiKey L8Y672436D --apiIssuer 680220f7-3bcc-4a35-ba12-ab586d451466 \
  --p8-file-path ~/Developer/max_sauna_timer/appstore_drafts/handoff/keys/AuthKey_L8Y672436D.p8
```

はまったこと:
- `altool` は `--apiKey` だけだと `./private_keys` などの決まった場所しか探さない。**`--p8-file-path` が要る**
- 内部グループに `hasAccessToAllBuilds: true` を付けると、ビルドを個別に割り当てようとしても
  422（Cannot add internal group to a build）になる。自動で配られるので割り当て不要
- 別アプリの betaTester は使い回せない（409）。アプリごとに作る

## 実機に入れる・App Store に出す（塚越ナビのセッションからの引き継ぎ）

**この Mac では Xcode の自動署名が通らない。** Xcode に Apple のアカウントが無く、
API キーを付けた `-allowProvisioningUpdates` も Authentication failed で止まる
（塚越・MaxSauna で確認済み）。実機用のビルドは App Store Connect API でアプリ ID と
プロファイルを作り、手動署名する。`project.yml` は `CODE_SIGN_STYLE: Automatic` のままなので、
実機ビルドのときはコマンドラインで `CODE_SIGN_STYLE=Manual` を上書きする。

- 手本: `~/Developer/tsukagoshi_app/scripts/install_on_iphone.sh`（実機）、
  `~/Developer/tsukagoshi_app/scripts/release_testflight.sh`（TestFlight。`--no-upload` で ipa 止め）
- App Store Connect API の手伝い: `~/Developer/tsukagoshi_app/scripts/asc.swift`
- 配布用の鍵・証明書・プロファイル: `~/.config/apple-signing/`（使い方は同フォルダの README.md）。
  配布証明書は 5QCK22285N（2027-11-03 まで）でチーム共通
- 小向クエスト用にまだ作っていないもの: アプリ ID（`com.anraku.komukai`）、開発用プロファイル、
  配布用プロファイル、App Store Connect のアプリ登録
- `codesign` が errSecInternalComponent で落ちたら、本人に VS Code のターミナルで
  `security unlock-keychain ~/Library/Keychains/login.keychain-db` を打ってもらう
- 審査メモに書くこと（推論）: ゲームを丸ごと同梱していてオフラインでも動くこと
  （ガイドライン 4.2 対策）。社名を伏せていること
- **審査への提出と公開は本人のはっきりした OK が要る**

## まだやっていないこと

- ゴールデンエイジ編（`game2-3d/`）は入れていない。本編だけのアプリ
- **実機での確認**。音（`.ambient` が実機でどう鳴るか）、発熱とフレームレート、
  横向きでの切り欠きの避け方は、シミュレーターでは分からない
- App Store 申請。掲載文・スクリーンショット・審査メモが未作成（TestFlight までは済んでいる）
- プライバシーマニフェスト（`PrivacyInfo.xcprivacy`）。`UserDefaults` は required reason API に
  当たるはずで、申請前に要るかどうかを確かめること
