package com.anraku.komukai

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.ByteArrayInputStream
import java.io.IOException

/**
 * 小向クエスト（Android）。Web 版・iPhone 版とまったく同じゲームを assets/www/ に同梱し、
 * WebView で開くだけの入れ物。
 *
 * file:// のページでは ES モジュール（import）が読めず、画面が真っ黒のまま止まる。
 * そこで Android がこの用途のために予約しているドメイン https://appassets.androidplatform.net/ を
 * アプリの中だけで受けて、assets の中身を返す（iPhone 版の komukai://game/ と同じ役目）。
 * このドメインへの読み込みは全部ここで返すので、ネットには一切出ない。
 */
class MainActivity : ComponentActivity() {

    private lateinit var frame: FrameLayout
    private var web: WebView? = null

    /** 今いるページ。WebView を作り直したとき、起動時のページではなくここへ戻す。 */
    private var current: String? = null
    private var retried = false
    private var lastGone = 0L
    private var goneStreak = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 画面いっぱい（ステータスバー・ナビゲーションバーなし）。カメラの穴の側まで使う
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= 28) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        // 文章を読んでいるあいだに画面が消えないように（アプリを開いている間だけ）
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // 音量ボタンは、音が鳴っていないときもゲームの音量を変える
        volumeControlStream = AudioManager.STREAM_MUSIC

        frame = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        // カメラの穴（切り欠き）にゲームがかからないよう、その分だけ内側に寄せる。
        // 隠したシステムバーは数えない（指で引き出したときは上に重なるだけ）。
        // ゲームの画面は 16:9 固定で、横長の端末ではもともと左右が黒帯になる（iPhone 版と同じ）。
        ViewCompat.setOnApplyWindowInsetsListener(frame) { v, insets ->
            val c = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
            v.setPadding(c.left, c.top, c.right, c.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(frame)
        hideSystemBars()

        // 開発用のビルドだけ、Mac の Chrome（chrome://inspect）から中を覗ける
        WebView.setWebContentsDebuggingEnabled(isDebuggable())
        attachWebView(savedInstanceState?.getString(KEY_CURRENT) ?: startUrl())

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = onBack()
        })
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun attachWebView(url: String) {
        val w = WebView(this)
        w.setBackgroundColor(Color.BLACK)
        w.isVerticalScrollBarEnabled = false
        w.isHorizontalScrollBarEnabled = false
        w.overScrollMode = View.OVER_SCROLL_NEVER
        // 長押しで文字の選択やメニューが出ないように（指の操作そのものはページに届く）
        w.isHapticFeedbackEnabled = false
        w.setOnLongClickListener { true }
        with(w.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true                 // セーブ（localStorage）
            mediaPlaybackRequiresUserGesture = false // 音は最初の操作から（ゲーム側も初回のタップで鳴らし始める）
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100                           // 端末の「文字の大きさ」でゲームの文字がずれないように
            setSupportMultipleWindows(false)         // target=_blank も同じ画面で開く
        }
        w.webViewClient = Client()
        frame.addView(w, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web = w
        w.loadUrl(url)
    }

    private inner class Client : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val url = request.url
            if (url.host != HOST) return null
            return Www.open(this@MainActivity, url.path ?: "/")
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            if (url.scheme == "https" && url.host == HOST) {
                if (!request.isForMainFrame) return false
                // ページを移るときに app=1 が落ちていたら、付けて開き直す（行き先にページの枠を出さない）
                val fixed = withApp(url) ?: return false
                view.loadUrl(fixed.toString())
                return true
            }
            // 外のリンクはアプリの中で開かず、ブラウザに渡す
            try {
                startActivity(Intent(Intent.ACTION_VIEW, url))
            } catch (_: ActivityNotFoundException) {
            }
            return true
        }

        override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
            if (Uri.parse(url).host == HOST) current = url
        }

        override fun onPageFinished(view: WebView, url: String) {
            retried = false
        }

        /** 読み込みに失敗したら1回だけやり直す（読み込めたら数え直す）。黒い画面のまま固まらないように。 */
        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame || retried) return
            retried = true
            view.loadUrl(current ?: startUrl())
        }

        /**
         * WebView の中身は別のプロセスで動いていて、裏に回っている間に OS に回収されたり、
         * 落ちたりすることがある（three.js + WebGL は真っ先に切られる側）。false を返すとアプリごと落ちる。
         * その WebView はもう使えないので、作り直して今いたページへ戻す。
         * 立て続けに落ちるときは、繰り返さずに閉じる。
         */
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            val now = SystemClock.elapsedRealtime()
            goneStreak = if (now - lastGone < 10_000) goneStreak + 1 else 0
            lastGone = now
            if (web === view) web = null
            frame.removeView(view)
            view.destroy()
            if (goneStreak >= 3) {
                finish()
            } else {
                attachWebView(current ?: startUrl())
            }
            return true
        }
    }

    /**
     * 戻る（ボタン・端からのスワイプ）。
     * - 選択画面: アプリを閉じる
     * - タイトル画面（「◀ 作品の選択へ」が見えている）: 選択画面へ戻る（そのリンクを押したのと同じ）
     * - それ以外（遊んでいる最中・作業指示書・エンディングなど）: 何もしない。
     *   うっかり端から指を滑らせても、遊んでいる途中の状態が消えないように。
     *   本編の 3D には一時停止が無く（続編は P キー）、iPhone 版でも遊んでいる途中に抜ける道は無い。
     */
    private fun onBack() {
        val w = web ?: return finish()
        w.evaluateJavascript(BACK_JS) { r ->
            if (r == "\"exit\"" || r == null || r == "null") finish()
        }
    }

    private fun hideSystemBars() {
        WindowCompat.getInsetsController(window, window.decorView).apply {
            // 端からスワイプすると一時的に出る（1回目のスワイプで、いきなりホームや戻るにならない）
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onPause() {
        super.onPause()
        // 裏に回ったら止める（BGM はページ側が visibilitychange で止める）
        web?.onPause()
        web?.pauseTimers()
    }

    override fun onResume() {
        super.onResume()
        web?.resumeTimers()
        web?.onResume()
        hideSystemBars()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        current?.let { outState.putString(KEY_CURRENT, it) }
    }

    override fun onDestroy() {
        web?.let {
            frame.removeView(it)
            it.destroy()
        }
        web = null
        super.onDestroy()
    }

    private fun isDebuggable() = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    /**
     * 最初に開くページ。ふだんは2作品の選択画面。常に app=1 を付ける
     * （ページの枠・キーボードの案内を出さず画面いっぱいにする指定）。
     * 開発用のビルドだけ、iPhone 版の起動引数（-page / -game）と同じことが intent の extra でできる:
     *   adb shell am start -n com.anraku.komukai/.MainActivity --es page game2-3d
     *   adb shell am start -n com.anraku.komukai/.MainActivity --es game "stage=3&demo=1010"
     */
    private fun startUrl(): String {
        var page = ENTRY
        var query = "app=1"
        if (isDebuggable()) {
            val p = intent.getStringExtra("page")
            val g = intent.getStringExtra("game")
            if (!p.isNullOrBlank()) {
                page = if (p.endsWith(".html")) p else "$p/index.html"
            } else if (!g.isNullOrBlank()) {
                page = "game3d/index.html"
            }
            if (!g.isNullOrBlank()) query += "&$g"
        }
        return "https://$HOST/$page?$query"
    }

    /** クエリに app が無ければ、先頭に app=1 を足した URL を返す（あれば null）。 */
    private fun withApp(url: Uri): Uri? {
        if (url.queryParameterNames.contains("app")) return null
        val q = url.encodedQuery
        return url.buildUpon().encodedQuery(if (q.isNullOrEmpty()) "app=1" else "app=1&$q").build()
    }

    /** assets/www/ の中身を返す。 */
    private object Www {
        fun open(context: Context, rawPath: String): WebResourceResponse {
            var path = rawPath.trimStart('/')
            if (path.isEmpty()) path = ENTRY
            // `..` で同梱物の外を読まれないように
            if (path.split('/').any { it == ".." }) return notFound()
            // フォルダ（../game3d/ など）は index.html を返す
            val candidates = if (path.endsWith("/")) listOf(path + "index.html") else listOf(path, "$path/index.html")
            for (c in candidates) {
                val stream = try {
                    context.assets.open("www/$c")
                } catch (_: IOException) {
                    continue
                }
                val mime = mimeOf(c)
                val text = mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("+xml")
                return WebResourceResponse(mime, if (text) "utf-8" else null, 200, "OK", emptyMap(), stream)
            }
            return notFound()
        }

        private fun notFound() =
            WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

        private fun mimeOf(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
            "html", "htm" -> "text/html"
            "js", "mjs" -> "text/javascript"
            "css" -> "text/css"
            "json" -> "application/json"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            "svg" -> "image/svg+xml"
            "webmanifest" -> "application/manifest+json"
            "mp3" -> "audio/mpeg"
            "ogg" -> "audio/ogg"
            "wav" -> "audio/wav"
            "m4a" -> "audio/mp4"
            "woff2" -> "font/woff2"
            "woff" -> "font/woff"
            "ttf" -> "font/ttf"
            "glb" -> "model/gltf-binary"
            "gltf" -> "model/gltf+json"
            else -> "application/octet-stream"
        }
    }

    private companion object {
        /** Android がアプリの中身を配るために予約しているドメイン（実在しない。外には出ない） */
        const val HOST = "appassets.androidplatform.net"
        const val ENTRY = "launcher/index.html"
        const val KEY_CURRENT = "current"

        /** 戻る操作のときにページで動かす。何をしたかを返す（exit / launcher / none）。 */
        val BACK_JS = """
            (() => {
              if (location.pathname.indexOf('/launcher/') === 0) return 'exit';
              const b = document.querySelector('#screen .backlink');
              const s = document.getElementById('screen');
              if (b && s && getComputedStyle(s).display !== 'none' && b.getClientRects().length > 0) {
                b.click();
                return 'launcher';
              }
              return 'none';
            })()
        """.trimIndent()
    }
}
