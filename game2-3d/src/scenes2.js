// 小向クエスト2 ゴールデンエイジ編 — 続編専用の3Dの場面
//
// 続編の各章は、これまで本編の部屋（会議室・執務室・工場）を借りていた。
// ここで続編の場面を登録する。中身は1場面1ファイル（scenes2/<キー>.js）で、
// それぞれ `export function build(W, halfD)` を持つ。描画エンジン（render3d.js）の
// registerScene に渡すので、本編の SCENES には混ざらず、本編のページは読まない。
//
// 1ファイルずつ読み、失敗したものは飛ばす（その章だけ本編の執務室で出る）。
// 1つの場面の書き損じで、続編ぜんぶが真っ黒になるのを避けるため。
import { registerScene } from '../../game3d/src/render3d.js';

// 続編の場面のキー。ファイル名と同じ（scenes2/<キー>.js）。
export const SEQUEL_SCENE_KEYS = [];

export async function loadSequelScenes() {
  const results = await Promise.allSettled(SEQUEL_SCENE_KEYS.map((key) =>
    import(`./scenes2/${key}.js`).then((m) => {
      if (typeof m.build !== 'function') throw new Error(`${key}.js に build が無い`);
      registerScene(key, m.build);
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
