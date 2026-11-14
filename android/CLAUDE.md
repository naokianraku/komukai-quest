# 小向クエスト（Android アプリ）— Claude 作業ガイド

Web 版の 3D をそのまま WebView に入れたアプリ。中身も入口（2作品の選択画面）も iPhone 版と同じ。
**ゲームのコードはここには無い**。直すのは親リポジトリの `game3d/` `game/src/`（本編）と
`game2-3d/` `game2/src/`（続編）、選択画面は `ios/launcher/`（iPhone 版と同じファイルを使う）。
このフォルダが持つのは、入れ物（Kotlin 1 ファイル）・アイコン・ビルドの設定だけ。

## 決まりごと

- 配るのは Google Play の**クローズドテスト（Alpha）**。参加は Google グループ経由で、希望者が募集ページから
  自分で入る（MaxRecovery と同じ形。2026-11-15 本人の決定。最初は内部テストだったが、グループは内部テストでは使えないため切り替えた）。
  製品版・オープンテストには出さない
- 続編は選択画面で「開発中」のまま（iPhone 版と同じ。選べるようにするのは本人の OK のあと）
- 社名・人名は伏せたまま（親リポジトリの決まりと同じ）
- 外から読むものを増やさない。**INTERNET 権限は付けていない**（ゲームは丸ごと assets にあり、機内でも動く）

## 基本情報

| 項目 | 値 |
|---|---|
| 表示名 | 小向クエスト |
| パッケージ名 | com.anraku.komukai（iPhone 版の Bundle ID と同じ。Play に一度上げたら変えられない） |
| Play Console | デベロッパー アカウント「Anraku Tech」（MaxRecovery と同じ）。アプリ ID 4975917153909854455。2026-11-15 作成（ゲーム・無料・既定の言語は日本語）。自動保護（インストーラ チェック）は既定のまま |
| 対象 | Android 8.0（API 26）以上、targetSdk 36（Play の要件）、横向きのみ、全画面 |
| ビルドの道具 | AGP 9.2.1 / Gradle 9.4.1 / Kotlin 2.4.20（MaxRecovery と同じ版）。JDK は Android Studio 同梱の JBR 21 |
| 版 | versionName は iPhone 版に合わせる（今は 1.1.0）。versionCode は 1 から、Play に上げるたびに +1（同じ番号は二度と使えない） |
| 署名 | アップロード鍵 `~/keystores/komukai-upload.jks`。パスワードは同じフォルダの `komukai-upload.properties`（**中身を表示しない**）。アプリの署名鍵は Google が預かる（Play アプリ署名）。アップロード鍵をなくしても Play Console から作り直しを頼める |
| 中身 | `game3d/` `game/` `game2-3d/` `game2/` と `ios/launcher/`（→ `launcher/`）を assets/www/ に同梱（AAB で約 2.9MB） |

## ビルド

```bash
cd android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:assembleDebug     # 開発用 APK（エミュレーターで確かめる）
```

Play に上げる AAB は、**作業ツリーではなく、きれいな写しから作る**（iPhone 版と同じ理由。
写すタスクでも `.bak` などは外しているが、追跡外のファイルが入らないことをこれで保証する）。

```bash
WT=<scratchpad>/komukai-wt
git worktree add --detach $WT HEAD
cd $WT/android && printf 'sdk.dir=%s\n' ~/Library/Android/sdk > local.properties
./gradlew :app:bundleRelease
mkdir -p ~/Developer/komukai/android/dist
cp app/build/outputs/bundle/release/app-release.aab ~/Developer/komukai/android/dist/komukai-<versionName>-<versionCode>.aab
cd ~/Developer/komukai && git worktree remove --force $WT
```

- 鍵の設定（`~/keystores/komukai-upload.properties`）が無いと release は止まる（`preReleaseBuild` のガード）
- ゲームのファイルは `copy<Variant>GameAssets` タスクが assets/www/ へ写す。並びはリポジトリのまま
  （game3d から `../../game/src/...` への相対の読み込みが通る）。`game2-3d/cast.html` は Web 版と同じく外す
- `android/dist/` は gitignore（AAB の置き場）

## 配り方（クローズドテスト＋Google グループ）

| もの | 値 |
|---|---|
| 募集ページ | **https://anraku-tech.com/komukai/android**（noindex。URL を知っている人に配る）。元は `~/Developer/website-anrakutech/public/komukai/android.html`（git 管理外。`npm run deploy` で公開）。審査中に出していた冒頭の「準備中」の帯は、通ったので外した（2026-11-15） |
| Google グループ | 「小向クエスト テスター」 komukai-testers@googlegroups.com（https://groups.google.com/g/komukai-testers）。オーナーは開発者用の anraku.tech@gmail.com（個人のアドレスは出さない）。誰でも参加可・投稿とメンバー一覧は管理者だけ（MaxRecovery のグループと同じ設定） |
| 参加用リンク（クローズド） | https://play.google.com/apps/testing/com.anraku.komukai |
| トラック | クローズド テスト - Alpha。国は日本だけ。テスターはこのグループ |
| 内部テスト | versionCode 1 を公開済みだが、テスターは誰もいない（https://play.google.com/apps/internaltest/4700482543915190230）。使わない |

| 版 | 中身 | 上げた日・方法 | 状態 |
|---|---|---|---|
| versionCode 1（1.1.0） | iPhone 版 1.1.0 と同じ（続編は「開発中」） | 2026-11-15 06:11・API（play.py）で内部テストへ。同じ版をライブラリから Alpha へ | 2026-11-15 07:05 に審査へ送った（ストアの掲載情報・申告とまとめて 13 件。管理対象の公開はオフ）。**数時間で通って同日に公開**。テスターにグループ、フィードバック先に support@anraku-tech.com を入れた 2 件は、グループができたあとに別に審査へ送り、15 分ほどで公開。これで Alpha は「有効」 |

- テスターはグループのメンバーなので、Play Console でメールアドレスを集めたり登録したりしない（本人がアドレスを預からない）
- 審査が通るまで、テスターに見えるアプリ名は「com.anraku.komukai (unreviewed)」
- メールのテスターリストは API では編集できない（API が扱えるのは Google グループだけ）。リストはデベロッパー
  アカウントで共通で、既にある「tester-list」（2 人）は MaxRecovery 側のもの。小向クエストには使っていない

### ストアの掲載情報と申告（2026-11-15 に Console で入れた）

| 項目 | 中身 |
|---|---|
| 掲載文 | `store/listing/ja-JP/`（title・short・full）。iPhone 版の説明文から「iPhone専用」「App内課金」の 2 か所だけ直したもの |
| 画像 | アイコン `store/icon-512.png`、フィーチャー グラフィック `store/feature-1024x500.jpg`（`store/make_feature.swift` で作る）、スクリーンショット `store/phone/*.jpg`（iPhone 版の 6 枚の左右の黒帯を落として 16:9 の 2346×1320 にしたもの。順番も iPhone 版と同じ） |
| AI アセットの申告 | ラベルを付けない（画像はゲームの画面と、コードで描いたもの） |
| カテゴリ・連絡先 | ゲーム／アクション。anraku.tech@gmail.com、https://anraku-tech.com/komukai/support |
| プライバシーポリシー | https://anraku-tech.com/komukai/privacy（iPhone 版と同じ） |
| 広告・ログイン・広告 ID・行政・金融・健康 | どれも「なし」 |
| データ セーフティ | 収集も共有もしない |
| ターゲット ユーザー | 13〜15・16〜17・18 歳以上（iPhone 版の 12+ に合わせ、13 歳未満は入れない） |
| コンテンツのレーティング | iPhone 版の年齢区分の答えに合わせた: 人間への暴力（空想・ドット絵風・非現実的な反応・遠目から頻繁・流血なし）、恐怖（まれ）、軽度ののしり（まれ）、アルコールへの言及（まれ）。結果は ESRB 10+・オーストラリア PG・韓国 15+・ブラジル L など。連絡先は anraku.tech@gmail.com |

## API で上げる（2 回目から）

- MaxRecovery の `play.py` を使う。サービスアカウント play-publisher に、小向クエストの
  「テスト版トラックとしてのアプリのリリース」「テスト版トラックの管理、テスターリストの編集」「アプリ情報の閲覧」
  「ストアでの表示の管理」を付けた（2026-11-15。製品版の権限と管理者は付けていない。ストアの表示の権限は付けてから
  しばらく 403 のままだったので、その日の掲載情報は Console で入れた）。トラックは `alpha`。使い方は
  `~/Developer/max_sauna_timer_pixel/tools/play/README.md`。パッケージ名を必ず指定する:

```bash
cd ~/Developer/max_sauna_timer_pixel
# --package はサブコマンドの後ろに置く（前に置くと既定の MaxRecovery のパッケージになる）
python3 tools/play/play.py whoami --package com.anraku.komukai
python3 tools/play/play.py tracks --package com.anraku.komukai
python3 tools/play/play.py upload-release --package com.anraku.komukai --track alpha \
  --aab ~/Developer/komukai/android/dist/komukai-1.1.0-2.aab --notes-ja <ノートのファイル>   # まず dry-run、次に --apply --validate-only、最後に --apply --send-for-review
```

- **このアプリは「変更が自動で審査に送られる」状態。** play.py の既定（審査に送らない保存）は
  `changesNotSentForReview must not be set` で弾かれるので、`--send-for-review` を付けて送る（テスト版トラックへの配信は
  本人の包括許可あり。2026-11-15）
- play.py が出す「versionCode は 1xxx の決まり」「-beta の目印が無い」の注意は MaxRecovery 用。小向クエストでは気にしない
- ブラウザ（Claude in Chrome）は Windows の Chrome しかつながっていない（2026-11-15 時点）。Play Console は
  ログイン済み。Mac のファイルも `file_upload` でそのまま渡せる（掲載画像はこれで上げた）。Google グループは
  開発者用の Tech Anraku（anraku.tech@gmail.com。`/u/1/`）に切り替えて操作する
- Google グループの作成はロボット確認（reCAPTCHA）が出る。これは Claude は押せないので本人に頼む

## 確かめ方（エミュレーター）

AVD は **`Pixel_Phone_Play_API36` を `-read-only` で**立てる。`Pixel_Phone_API35` は MaxRecovery のセッションが
`-read-only` なしで使っていることがあり、そのときは同じ AVD をもう一つ立てられない。

```bash
~/Library/Android/sdk/emulator/emulator -avd Pixel_Phone_Play_API36 -read-only -port 5570 \
  -no-window -no-audio -no-boot-anim -gpu host          # バックグラウンドで
adb -s emulator-5570 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5570 shell am start -S -n com.anraku.komukai/.MainActivity                        # 選択画面
adb -s emulator-5570 shell am start -S -n com.anraku.komukai/.MainActivity --es game "dbg=1"      # 本編のタイトル（__g1 が使える）
adb -s emulator-5570 shell am start -S -n com.anraku.komukai/.MainActivity --es page game2-3d     # 続編のタイトル
```

- `--es page` / `--es game` は iPhone 版の起動引数 `-page` / `-game` と同じ。**開発用ビルドだけ**効く
- 開発用ビルドは WebView のデバッグが有効。`adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`
  （pid は `adb shell pidof com.anraku.komukai`）で DevTools プロトコルにつながり、ページで式を評価できる
- 座標: 端末の px ＝ 切り欠きの幅（Pixel の横向きで左 132px）＋ CSS px × 2.625
- zsh では `A="adb -s emulator-5570"; $A shell ...` が動かない（変数が単語に分かれない）。関数にする
- 待つときは `adb shell 'sleep 2'`（端末の上の sleep）

2026-11-15 に確かめたこと（API 36・WebView 157・開発用ビルド）:

| 見たもの | 結果 |
|---|---|
| 選択画面 | 本編は「本編をプレイ」、続編は灰色の「開発中」 |
| 本編を選ぶ | `game3d/index.html?app=1`、3D が描ける（WebGL2）、タッチ端末として認識 |
| はじめる → 作業指示書 → プレイ | 本物のタップで進む |
| 攻撃ボタン・スティック | 押すと光って attack になる／右に倒すと歩く |
| 戻る | タイトル → 選択画面、選択画面 → アプリを閉じる、プレイ中 → 何もしない |
| 裏に回す | `visibilityState` が hidden（BGM はページ側が止める）。戻すと読み込み直さず続きから |
| 描画プロセスが落ちる | アプリは落ちず、WebView を作り直して同じページへ |
| INTERNET 権限なし | 読み込める（このドメインは全部アプリが返す） |

## 作りの要点（はまりどころ）

- **file:// では ES モジュールが読めない**（iPhone 版と同じ）。Android がこの用途に予約しているドメイン
  `https://appassets.androidplatform.net/` を `shouldInterceptRequest` で受けて、assets/www/ の中身を返す
  （iPhone 版の `komukai://game/` と同じ役目）。androidx.webkit の WebViewAssetLoader は使わず自前（フォルダの
  index.html、`..` よけ、MIME だけ）
- ページを移るときに `app=1` が落ちたら付け直して開き直す（`withApp`。iPhone 版と同じ）
- **戻る**: 選択画面 → 閉じる／タイトル（「◀ 作品の選択へ」が見えている）→ そのリンクを押す／それ以外 → 何もしない。
  本編の 3D には一時停止が無い（2D 版の P・Escape は 3D には無い。続編は P）。うっかり端から指を滑らせても
  遊んでいる途中が消えないようにしている
- **描画プロセスが落ちたら**（`onRenderProcessGone`）WebView を作り直して今いたページへ。false を返すとアプリごと落ちる。
  10 秒以内に 3 回続いたら閉じる
- カメラの穴（切り欠き）の分だけ内側に寄せる。ゲームは 16:9 固定なので、左右はもともと黒帯
- `configChanges` を広く取っている。折りたたみの開閉などで Activity が作り直されると、WebView が読み込み直しになり
  遊んでいる途中が消える
- `textZoom = 100`（端末の「文字の大きさ」でゲームの文字がずれないように）
- localStorage は、書いてすぐに強制終了すると残らない（Chromium がディスクに書くのは数秒後）。ゲームは今 localStorage を使っていない
- 初回だけ Android が「全画面表示中」の案内を出す（OS の決まり。ゲームの上に出るが、一度閉じれば出ない）

## アイコン

iPhone 版の `icon.png` を、108dp の枠の中央 72dp に縮めて置き、外側を元の絵の縁の色（#2C1409）で埋めたもの。
端末の丸や角丸のマスクで見えるのは中央の 72dp だけなので、全面に敷くと「小向」の字が切れる。作り直し:

```bash
cd android && SRC=../ios/Resources/Assets.xcassets/AppIcon.appiconset/icon.png
for spec in mdpi:72:108 hdpi:108:162 xhdpi:144:216 xxhdpi:216:324 xxxhdpi:288:432; do
  IFS=: read d inner outer <<<"$spec"
  sips -z $inner $inner "$SRC" --out app/src/main/res/mipmap-$d/ic_launcher_fg.png
  sips --padToHeightWidth $outer $outer --padColor 2C1409 app/src/main/res/mipmap-$d/ic_launcher_fg.png
done
sips -z 512 512 "$SRC" --out store/icon-512.png   # ストアの掲載用（512px）
```
