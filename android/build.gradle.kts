// 版は MaxRecovery（~/Developer/max_sauna_timer_pixel）と揃える。この Mac にキャッシュがあり、
// Android Studio Panda 4 で開ける上限（AGP 9.2.1・Gradle 9.4.1）でもある。
// Kotlin は AGP 9 の組み込み Kotlin で有効になる（kotlin-android プラグインは不要）。
// AGP 9.2 が実行時に引く KGP 2.2.10 を、MaxRecovery と同じ 2.4.20 に引き上げる。
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.20")
    }
}

plugins {
    id("com.android.application") version "9.2.1" apply false
}
