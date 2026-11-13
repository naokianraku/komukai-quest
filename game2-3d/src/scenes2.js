// 小向クエスト2 ゴールデンエイジ編 — 続編専用の3Dの場面
//
// 続編の各章は、これまで本編の部屋（会議室・執務室・工場）を借りていた。
// ここで続編の場面を登録する。中身は1場面1ファイル（scenes2/<キー>.js）で、
// それぞれ `export function build(W, halfD)` を持つ。描画エンジン（render3d.js）の
// registerScene に渡すので、本編の SCENES には混ざらず、本編のページは読まない。
//
// 1ファイルずつ読み、失敗したものは飛ばす（その章だけ本編の執務室で出る）。
// 1つの場面の書き損じで、続編ぜんぶが真っ黒になるのを避けるため。
//
// 場面のファイルが export するもの:
//   build(W, halfD, ctx)  … 場面を建てる（必須）。ctx = { stage, data, title }
//   onEvent(name, arg)    … その場面が張られている間に起きた出来事（任意）。シェルが送る名前:
//     'tick' {dt,t,letter,waitT,kouki,genka}  毎フレーム（時計の針などの動きに使う）
//     'waitEnd'   待合室の待ちが終わった（第3章）
//     'bossStart' ボス戦が始まった
//     'reveal'    隠れていたボスのHPバーが見えた（第4章）
//     'revive'    ボスが作り直しで復活した（第5章）
//     'kuchidashi' 設計に口を出した（第5章・E）
//     'letter'    社長宛レターを出した（第3章・R）
//     'defeated'  ボスを倒した（作り直しの残りが無いとき）
//     'disband'   解散（最終章のボスのあと）
//     'epilogue'  エピローグ
import { registerScene } from '../../game3d/src/render3d.js';

// 続編の場面のキー。ファイル名と同じ（scenes2/<キー>.js）。章データの scenes3d / bossScene3d と、
// タイトル（g2_title）から使う。2D版が見る bg.scene には書かない（2D は知らないキーを工場で描くため）。
export const SEQUEL_SCENE_KEYS = [
  'g2_title',
  'g2_kodo', 'g2_kenshu', 'g2_ryo',            // 第1章 研修センターの講堂・実習場と廊下・独身寮
  'g2_m_kaigi',                                // 第2章 相手先の大会議室
  'g2_jisha',                                  // 第2〜5章 帰社（自社の執務室。共通）
  'g2_gr_machi', 'g2_gr_kojo', 'g2_gr_kaigi',  // 第3章 待合室・古い工場・古い会議室
  'g2_l3_kuiki', 'g2_l3_kaigi',                // 第4章 立入制限区域・窓のない会議室
  'g2_lm_kojo', 'g2_lm_kaigi',                 // 第5章 巨大な組立工場・試験台の見える会議室
  'g2_saishin', 'g2_daikaigi',                 // 最終章 5階の審査室・1階の大会議室
];

export async function loadSequelScenes() {
  const results = await Promise.allSettled(SEQUEL_SCENE_KEYS.map((key) =>
    import(`./scenes2/${key}.js`).then((m) => {
      if (typeof m.build !== 'function') throw new Error(`${key}.js に build が無い`);
      registerScene(key, m.build, m.onEvent ? { onEvent: m.onEvent } : null);
      return key;
    })));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? `${SEQUEL_SCENE_KEYS[i]}: ${r.reason && r.reason.message}` : null))
    .filter(Boolean);
  if (failed.length) {
    console.warn('続編の場面を読めなかった（本編の執務室で代用する）:', failed);
    if (window.__dbg) window.__dbg('SCENES2: ' + failed.join(' / '));
  }
  return { loaded: results.filter((r) => r.status === 'fulfilled').map((r) => r.value), failed };
}
