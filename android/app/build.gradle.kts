import java.io.File
import java.util.Properties
import javax.inject.Inject

plugins {
    id("com.android.application")
}

// ── 署名（アップロード鍵）────────────────────────────────────────────────
// 鍵とパスワードはリポジトリの外に置く（MaxRecovery と同じ ~/keystores/）。
//   ~/keystores/komukai-upload.jks         … アップロード鍵。アプリの署名鍵は Google が預かる（Play アプリ署名）
//   ~/keystores/komukai-upload.properties  … storeFile（絶対パス）/ storePassword / keyAlias / keyPassword
// 無いときは release を作らせない（未署名の AAB を Play に上げないため）。debug はそのまま作れる。
val keystorePropsFile = File(System.getProperty("user.home"), "keystores/komukai-upload.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}
val hasUploadKey = keystorePropsFile.exists()

// ── 同梱するゲーム ────────────────────────────────────────────────────
// iPhone 版（ios/project.yml の青フォルダ）と同じ 5 つを、リポジトリの並びのまま assets/www/ に入れる。
// 並びを変えないので、game3d から ../../game/src/... への相対の読み込みがアプリの中でもそのまま通る。
// 書き方は「リポジトリでの場所=アプリの中の場所」。
val gameDirs = listOf(
    "game3d=game3d",          // 本編の 3D
    "game=game",              // 本編のロジック（game3d が読む）
    "game2-3d=game2-3d",      // 続編の 3D（選択画面では「開発中」で選べない）
    "game2=game2",            // 続編のロジック
    "ios/launcher=launcher",  // 開いたときの2作品の選択画面（iPhone 版と同じファイル）
)

/** ゲームのファイルを assets/www/ へ写す。作業ツリーにある追跡外のごみ（.bak など）は入れない。 */
abstract class CopyGameAssets : DefaultTask() {
    /** 「リポジトリでの場所=アプリの中の場所」の並び */
    @get:Input
    abstract val dirs: ListProperty<String>

    @get:Internal
    abstract val repoRoot: DirectoryProperty

    /** 変更の検知用（中身が変わったら写し直す） */
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sources: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val fs: FileSystemOperations

    @TaskAction
    fun copy() {
        val root = repoRoot.get().asFile
        val out = outputDir.get().asFile
        fs.sync {
            into(out)
            dirs.get().forEach { pair ->
                val (src, dst) = pair.split('=', limit = 2)
                from(File(root, src)) {
                    into("www/$dst")
                    // 追跡外のごみ。Web 版（git archive で配る）にも入らないもの
                    exclude("**/.DS_Store", "**/*.bak", "**/*.orig", "**/*~")
                    // 続編の出演者の一覧（開発用のページ）。Web 版でも配信から外している
                    if (dst == "game2-3d") exclude("cast.html")
                }
            }
        }
    }
}

android {
    namespace = "com.anraku.komukai"
    // MaxRecovery と同じ（androidx.core 1.19 が compileSdk 37 を求める）
    compileSdk = 37
    buildToolsVersion = "36.1.0"

    defaultConfig {
        // iPhone 版と同じ ID（Play に一度上げると変えられない）
        applicationId = "com.anraku.komukai"
        minSdk = 26
        // Play の要件（2026-08-31 以降に出すものは 36 以上）。MaxRecovery と同じ
        targetSdk = 36
        // Play に上げるたびに 1 つ上げる（同じ番号は二度と受け取ってもらえない）
        versionCode = 1
        // 中身は iPhone 版 1.1.0 と同じ（続編は選択画面で「開発中」）
        versionName = "1.1.0"
    }

    signingConfigs {
        create("release") {
            if (hasUploadKey) {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // コードは入れ物の 1 ファイルだけ。難読化しても小さくならないので切っておく
            isMinifyEnabled = false
            if (hasUploadKey) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

androidComponents {
    onVariants { variant ->
        val name = variant.name.replaceFirstChar { it.uppercase() }
        val copy = tasks.register<CopyGameAssets>("copy${name}GameAssets") {
            dirs.set(gameDirs)
            repoRoot.set(rootProject.layout.projectDirectory.dir(".."))
            sources.from(gameDirs.map { rootProject.layout.projectDirectory.dir("../" + it.substringBefore('=')) })
        }
        variant.sources.assets?.addGeneratedSourceDirectory(copy, CopyGameAssets::outputDir)
    }
}

// 鍵が無いまま release を作ろうとしたら止める
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    val ok = hasUploadKey
    val path = keystorePropsFile.path
    doFirst {
        if (!ok) throw GradleException("アップロード鍵の設定がありません: $path（android/CLAUDE.md の「署名の鍵」）")
    }
}

dependencies {
    // ComponentActivity（戻る操作の受け取り）と、全画面・切り欠きの扱い（WindowCompat など）だけ使う
    implementation("androidx.activity:activity:1.10.1")
    implementation("androidx.core:core:1.19.0")
}
