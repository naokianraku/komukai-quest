// 小向クエスト2 ゴールデンエイジ編 — 第3章 GR社 工場の待合室（g2_gr_machi）
//
// 米国の機器サプライヤの古い工場。肌寒い、トイレのようなタイル張りの待合室。
// 金を払っているのはこちらなのに、閉じた扉の前で何時間も待たされる。
// 章の始まり（x 0〜439）だけに張られ、最初の18秒（待合室フェーズ）は扉の手前（x≤420）から先へ進めない。
// 自機が歩ける間にカメラが映す奥の壁は、およそ x −100〜250（ワールド）。細かい物はそこに集め、
// その先は床と壁だけを W+60 まで敷く。
//
//   左: 閉まったままの受付の小窓（向こうは暖かい事務所。すりガラスだけが明るい）と呼び出しの電話
//   中: 硬いベンチ、床置きの冷水器、掛け時計。時計の下のベンチに便箋の束
//   右: 閉じた扉（x≈140）。上の灯が赤いあいだは開かない。消火器・掃除のバケツ・掲示板・古い自販機・枯れた鉢
//   手前: 扉の方を向いて並ぶ低いベンチの背（足元の線より低い）
//   床と腰壁: 白いタイル（目地は薄い箱の格子）。歩く帯の縁に市松の帯。上は冷たい灰青の塗り壁と
//   下がり天井（天井を低く見せる）、青白い壁付けの蛍光灯（1本は切れかけて瞬く）
//
// 出来事:
//   tick    … 時計の針（待っているあいだは18秒で6時間半進む）、便箋の束の高さ（レター 0〜1）、瞬く蛍光灯
//   waitEnd … 扉の上の灯が緑になり、扉が開いて向こうの温かい明かりが床にこぼれる。部屋の光も少しだけ温かく
//             （待ちが無い／終わった後に建てたときは、最初から開けておく）
//
// 文字・ロゴ・社章は描かない（看板は無地の板＋色の棒）。人に見える物も置かない。
// 描画の数: 動かない箱は boxBatch にまとめる（照らされる物で2回、自分で光る面で1回）。
// 1つずつ描くのは動く物（扉・時計の針・便箋・瞬く管・扉の上の灯・こぼれる明かり）と時計の円盤だけ。
import {
  THREE, boxBatch, addScenery, hex, zones, setLighting, scene, hemi, sun, fill,
} from '../../../game3d/src/render3d.js';

// ===== 配色: 冷えた灰青と、くすんだ白いタイル =====
const P = {
  bg: '#7d8a93',
  // 床のタイルは腰壁の白タイルより一段暗く（明るすぎる床に、この章の敵の服が溶けていた）
  tile: '#919696', grout: '#6f777b', checker: '#4e6371', crack: '#636b6f',
  tileOld: ['#8d9191', '#91938d', '#888e8f', '#9a9c98', '#848a8a'],
  wtile: '#dfe4e3', wgrout: '#a1abaf', trim: '#4c6776', cap: '#c4cccd', base: '#3a4953',
  wall: '#95a6b1', rail: '#73858f', glow1: '#a6b7c1', glow2: '#bdcbd3',
  soffit: '#a5b4bd', soffitLine: '#6d7d87', ceiling: '#a9b4ba', pipe: '#c3cbcf', clip: '#5f6a70',
  steel: '#38434b', wood: '#8b7a61', woodBack: '#7a6b55',
  door: '#4b5963', frame: '#2f3940', kick: '#a3acb1', handle: '#c0c6ca',
  tube: '#e9f4ff', tubeDim: '#5d6a73', housing: '#d4dadc',
  frost: '#ddd8ca', frostHi: '#e6e1d2', sash: '#55616a', counter: '#7d8a92',
  warm: '#efd8ab', warmFloor: '#ccae84', warmPool: '#fff0d0', warmDado: '#ae8a5c',
  paper: '#f3f1e9', ink: '#2d3e6a', sheets: ['#f6f5ef', '#e8e5da', '#f1eee3', '#dedbd0'],
  lampRed: '#e2483b', lampGreen: '#46d47c', lampBase: '#262d33',
  clockFace: '#f2f1ea', clockRim: '#262b30', hand: '#1d2228',
};

// ===== 光（第3章は坂0.4: 春の第1章より冷たく少し暗い）。扉が開くと少しだけ温かくする =====
const LIGHT = {
  cold: { hemi: new THREE.Color('#d2dfea'), ground: new THREE.Color('#5f6a74'), hi: 1.66,
          sun: new THREE.Color('#d9e5f4'), si: 0.78, fi: 0.86 },
  warm: { hemi: new THREE.Color('#e9e0d2'), ground: new THREE.Color('#6f6860'), hi: 1.78,
          sun: new THREE.Color('#fae6ca'), si: 0.9, fi: 0.9 },
};
function setWarmth(k) {
  const c = LIGHT.cold, w = LIGHT.warm;
  hemi.color.copy(c.hemi).lerp(w.hemi, k);
  hemi.groundColor.copy(c.ground).lerp(w.ground, k);
  hemi.intensity = c.hi + (w.hi - c.hi) * k;
  sun.color.copy(c.sun).lerp(w.sun, k);
  sun.intensity = c.si + (w.si - c.si) * k;
  fill.intensity = c.fi + (w.fi - c.fi) * k;   // fill の色は他の場面が戻さないので触らない
}

// 時計: 着いたのは朝9時。待たされている18秒で、15時半まで進む
const START_H = 9.0, SPAN_H = 6.5;
const DOOR_MAX = 1.62;            // 扉が開く角度（約93°。部屋の側へ開く）
const C_TUBE = new THREE.Color(P.tube), C_TUBE_DIM = new THREE.Color(P.tubeDim);

// 今張られている待合室の動く物。build のたびに作り直す（前の章の参照を残さない）
let L = null;

// 決まった乱数（建て直しても同じタイルが汚れているように）
function hash(i, j) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul((j | 0) + 977, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// boxBatch の照らされない版。蛍光灯の管・すりガラス・扉の向こうの明かりを1回の描画でまとめて描く
function unlit(batch) {
  for (const m of batch.done()) {
    m.material.dispose();
    m.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    m.castShadow = false; m.receiveShadow = false;
  }
}
const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color: hex(color), ...opts });

export function build(W, halfD, ctx = {}) {
  L = null;
  const stage = ctx.stage || null;
  const sec = (ctx.data && ctx.data.waitingRoom && ctx.data.waitingRoom.sec) || 18;
  const waiting = !!(stage && stage.waitT > 0);

  // 狭い部屋なので奥は浅く。手前はベンチの背を1列
  const { BACK, FRONT } = zones(halfD, 34, 64);
  setLighting(false);
  setWarmth(0);
  scene.background = hex(P.bg);
  scene.fog = new THREE.Fog(hex(P.bg), 300, 900);

  const XL = -130, XR = W + 60, XW = XR - XL, XC = (XL + XR) / 2;
  const XD = 300;          // 細かい物はここまで（待合室の区間から見えるのは x≈250 まで）
  const b = boxBatch();    // 動かない箱（照らされる）
  const g = boxBatch();    // 自分で光る面（最後に照らされない材質に替える）

  // ---------- 床: くすんだ白のタイル。目地は薄い箱の格子（z=0 に揃える）----------
  const ZM = (FRONT + BACK) / 2, ZD = FRONT - BACK, T = 5;
  b.box(XW, 2, ZD, P.tile, XC, -1, ZM);
  for (let x = Math.ceil(XL / T) * T; x <= XR; x += T) b.box(0.32, 0.06, ZD, P.grout, x, 0.03, ZM);
  for (let z = Math.ceil(BACK / T) * T; z < FRONT; z += T) b.box(XW, 0.06, 0.32, P.grout, XC, 0.03, z);
  // 歩く帯の縁（z −30〜−25 と 25〜30）に市松の帯。古い手洗い場の床の縁取り
  for (let i = Math.floor(XL / T); i * T < XR; i += 2) {
    for (const z of [-27.5, 27.5]) b.box(T - 0.44, 0.04, T - 0.44, P.checker, i * T + T / 2, 0.02, z);
  }
  // 色の褪せたタイル。人の通る帯ほど多い（すり減って灰色に寄る）
  for (let i = Math.floor(XL / T); i * T < XD; i++) {
    for (let j = Math.floor(BACK / T); j * T < 75; j++) {
      if (j === -6 || j === 5) continue;
      const band = j >= -5 && j < 5;
      if (hash(i, j) < (band ? 0.15 : 0.08)) {
        b.box(T - 0.44, 0.04, T - 0.44, P.tileOld[Math.floor(hash(j, i) * P.tileOld.length)],
          i * T + T / 2, 0.02, j * T + T / 2);
      }
    }
  }
  // ひび
  for (let k = 0; k < 9; k++) {
    b.box(2.4 + hash(k, 5) * 2.4, 0.05, 0.16, P.crack, -70 + k * 38 + hash(k, 9) * 18, 0.05,
      -52 + hash(k, 3) * 104, { rotY: hash(k, 7) * 3 });
  }
  // 床の排水口（トイレのような床）
  const drain = (x, z) => {
    b.box(3.4, 0.06, 3.4, '#6b757b', x, 0.05, z);
    for (let k = -1; k <= 1; k++) b.box(2.4, 0.04, 0.36, '#2f363b', x, 0.09, z + k * 0.85);
  };
  drain(58, 3); drain(-42, -10); drain(204, 9);

  // ---------- 奥の壁: 扉の所だけ開ける（開いたとき向こうが見えるように）----------
  // 箱の切れ目（内側の面）が壁の表に出ると、細い筋になって見える。上は1枚で通し、
  // 下の2枚は縦枠の中で終わらせ、上下の継ぎ目は扉の上枠の高さに通した長押（なげし）で隠す
  const DX = 140, DW = 14, DH = 24, dL = DX - DW / 2, dR = DX + DW / 2, HEAD = DH + 1.5;   // 枠の上端（DH+1.4）とは面をずらす
  b.box(XW, 64 - HEAD, 2, P.wall, XC, (64 + HEAD) / 2, BACK - 1);
  b.box(dL - 0.5 - XL, HEAD, 2, P.wall, (XL + dL - 0.5) / 2, HEAD / 2, BACK - 1);
  b.box(XR - dR - 0.5, HEAD, 2, P.wall, (dR + 0.5 + XR) / 2, HEAD / 2, BACK - 1);
  b.box(XW, 1.2, 0.36, P.rail, XC, HEAD + 0.2, BACK + 0.18);   // 上からの視線で継ぎ目が覗かない高さ

  // 腰壁: 白いタイル（目地の格子）、色タイルの帯、笠木、濃い巾木
  const WH = 13.2, TB0 = 9.975, TB1 = 11.225, TS = 2.1;
  const wainscot = (x0, x1) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    b.box(w, WH, 0.5, P.wtile, cx, WH / 2, BACK + 0.25);
    b.box(w, 1.5, 0.75, P.base, cx, 0.75, BACK + 0.375);
    b.box(w, TB1 - TB0, 0.62, P.trim, cx, (TB0 + TB1) / 2, BACK + 0.31);
    b.box(w, 0.9, 1.1, P.cap, cx, WH + 0.45, BACK + 0.55);
    for (const y of [3.6, 5.7, 7.8, 12.2]) b.box(w, 0.16, 0.08, P.wgrout, cx, y, BACK + 0.54);
    for (let x = Math.ceil(x0 / TS) * TS + TS / 2; x < Math.min(x1, XD); x += TS) {
      b.box(0.16, TB0 - 1.5, 0.08, P.wgrout, x, (1.5 + TB0) / 2, BACK + 0.54);
      b.box(0.16, WH - TB1, 0.08, P.wgrout, x, (TB1 + WH) / 2, BACK + 0.54);
    }
  };
  wainscot(XL, dL - 1.3);          // 端は縦枠の中に少し差し込む（切り口の面を枠と重ねない）
  wainscot(dR + 1.3, XR);

  // 古さ: 剥がれ落ちた腰壁のタイル（下地が見える）と、黄ばんだタイル。
  // 目地の格子の内側（タイルの中心は 2.1 の倍数）に、タイル面より少しだけ手前で貼る
  for (const [x, y] of [[48.3, 4.65], [-33.6, 8.89], [151.2, 2.55], [216.3, 6.75]]) {
    b.box(1.9, 1.9, 0.06, '#7d878b', x, y, BACK + 0.53);
  }
  for (const [x, y, h] of [[63.0, 6.75, 1.9], [-16.8, 4.65, 1.9], [172.2, 8.89, 1.9], [-71.4, 2.55, 1.9],
    [33.6, 12.7, 0.84], [107.1, 11.71, 0.84], [-50.4, 12.7, 0.84]]) {
    b.box(1.9, h, 0.04, '#d3d0c2', x, y, BACK + 0.52);
  }

  // 下がり天井（天井が低く見える）と、その面を這う冷たい水道管
  b.box(XW, 13.5, 6, P.soffit, XC, 33 + 6.75, BACK + 3);
  b.box(XW, 0.4, 0.2, P.soffitLine, XC, 33.2, BACK + 6.1);
  b.box(XW, 1.5, 1.5, P.pipe, XC, 35.3, BACK + 7.0);
  for (let x = XL + 6; x < XD; x += 22) b.box(0.7, 2.3, 2.1, P.clip, x, 35.3, BACK + 6.95);

  // 天井。手前の端は z=40（本編の ceilingSlab と同じ）。左右は壁と同じだけ張る
  const CEIL = halfD + 12;
  b.box(XW, 2, CEIL - BACK, P.ceiling, XC, 47, (CEIL + BACK) / 2);

  // 青白い壁付けの蛍光灯。壁に回った光は2段の明るさの板で描く（点光源は使わない）
  const LAMP_Y = 29.4, FLICK_X = 44;
  for (let x = -100; x < XR; x += 48) {
    if (Math.abs(x - DX) < 20) continue;          // 扉の上は表示灯だけ
    b.box(26, 6.4, 0.06, P.glow1, x, LAMP_Y, BACK + 0.07);
    b.box(20, 3.8, 0.06, P.glow2, x, LAMP_Y, BACK + 0.11);
    b.box(17, 1.3, 1.1, P.housing, x, LAMP_Y + 0.75, BACK + 0.75);
    if (x !== FLICK_X) g.box(15.4, 0.7, 0.7, P.tube, x, LAMP_Y - 0.15, BACK + 1.5);
  }
  const flick = addScenery(new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.7, 0.7), basic(P.tube)));
  flick.position.set(FLICK_X, LAMP_Y - 0.15, BACK + 1.5);

  // ---------- 閉じた扉（x≈140）と、その向こうの温かい廊下 ----------
  // 縦枠。開口の内側へ0.05だけ出して、壁の切り口と同じ面にしない（点滅する）
  b.box(1.45, DH + 1.4, 2.8, P.frame, dL - 0.675, (DH + 1.4) / 2, BACK - 0.6);
  b.box(1.45, DH + 1.4, 2.8, P.frame, dR + 0.675, (DH + 1.4) / 2, BACK - 0.6);
  b.box(DW + 2.8, 1.4, 2.8, P.frame, DX, DH + 0.7, BACK - 0.6);                // 上枠
  b.box(DW, 0.22, 2.4, P.kick, DX, 0.11, BACK - 1);                            // 沓摺
  b.box(1.4, 0.9, 1.4, P.clip, dL - 1.2, 0.45, BACK + 14.6);                   // 戸当たり
  // 扉の上の表示灯。待たされているあいだは赤、通されると緑
  b.box(3.8, 2.4, 1.0, P.lampBase, DX, DH + 3.8, BACK + 0.5);
  const lamp = addScenery(new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 0.5), basic(P.lampRed)));
  lamp.position.set(DX, DH + 3.8, BACK + 1.2);

  // 扉の向こう（開いたときだけ見える）。事務所の暖かい明かり。照らされない面で明るさを出す。
  // 戸口から覗ける範囲は、この区間のどのカメラ位置からでも奥の壁の x≈131〜166 に収まる。
  // 横の壁は置かない（壁のすぐ裏に面があると、深度の精度で壁越しに筋が透けて見える）
  // 床も同じ理由で、壁のすぐ裏は戸口の幅だけにし、広い床は8奥から敷く
  const CZ = BACK - 2, CDP = 30;
  g.box(DW - 0.2, 2, 8, P.warmFloor, DX, -1, CZ - 4);
  g.box(56, 2, CDP - 8, P.warmFloor, DX, -1, CZ - 8 - (CDP - 8) / 2);
  g.box(13, 0.08, 13, P.warmPool, DX, 0.04, CZ - 8);
  g.box(56, 34, 1, P.warm, DX, 17, CZ - CDP - 0.5);
  g.box(56, 1.2, 0.4, P.warmDado, DX, 9, CZ - CDP + 0.2);
  g.box(10, 18, 0.4, '#7a6650', DX + 10, 9, CZ - CDP + 0.25);                  // 奥の扉（工場へ）

  // 扉の板。蝶番（左の縦枠の部屋側の角）を軸に、部屋の側へ開く
  const leaf = new THREE.Group();
  leaf.position.set(dL + 0.1, 0, BACK - 0.1);
  {
    const lb = boxBatch();   // ローカル座標: x=0..DW が扉、z=0 が部屋側の面、厚みは奥（−z）へ
    const LW = DW - 0.3;
    lb.box(LW, DH - 0.25, 0.9, P.door, LW / 2, (DH - 0.25) / 2 + 0.05, -0.45, { cast: true });
    lb.box(LW - 1.4, 2.6, 0.12, P.kick, LW / 2, 1.6, 0.05);                    // 蹴り板
    lb.box(0.7, 3.6, 0.6, P.handle, LW - 1.8, 11.4, 0.36);                     // 取っ手
    lb.box(1.2, 4.6, 0.14, P.kick, LW - 1.8, 11.4, 0.07);                      // 座金
    for (const y of [3, 12, 21]) lb.box(0.5, 1.6, 1.2, P.clip, 0.15, y, -0.45); // 蝶番
    // 小窓の金網の格子（部屋側）
    for (const y of [14.5, 16.5, 18.5]) lb.box(3.6, 0.12, 0.08, '#5a5040', LW / 2, y, 0.14);
    for (const x of [-0.9, 0.9]) lb.box(0.12, 5.8, 0.08, '#5a5040', LW / 2 + x, 16.5, 0.14);
    lb.box(4.4, 0.5, 1.1, P.frame, LW / 2, 13.25, -0.45);                      // 小窓の枠
    lb.box(4.4, 0.5, 1.1, P.frame, LW / 2, 19.75, -0.45);
    for (const m of lb.done()) leaf.add(m);
    // 小窓。向こうの明かりが透ける
    const win = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6, 1.08), basic('#ead8b0'));
    win.position.set(LW / 2, 16.5, -0.45);
    leaf.add(win);
  }
  addScenery(leaf);

  // 扉が開くと床にこぼれる明かり（扉の幅から手前へ広がる台形）
  const sh = new THREE.Shape();
  sh.moveTo(-DW / 2, 0); sh.lineTo(DW / 2, 0); sh.lineTo(DW / 2 + 7, -22); sh.lineTo(-DW / 2 - 5, -22);
  const sg = new THREE.ShapeGeometry(sh);
  sg.rotateX(-Math.PI / 2);                 // 形の −y が部屋の手前（+z）になる
  const spill = addScenery(new THREE.Mesh(sg, basic('#ffd9a2', { transparent: true, opacity: 0, depthWrite: false })));
  spill.position.set(DX, 0.14, BACK + 0.3);
  spill.visible = false;

  // ---------- 奥ゾーン: 壁ぎわの物 ----------
  // 硬いベンチ（壁ぎわ。座は手前を向く）。くたびれた木の板を黒い鉄の脚に載せただけ
  const SEAT = 5.6, SEAT_TOP = SEAT + 0.35;
  const benchWall = (x0, x1) => {
    const len = x1 - x0, cx = (x0 + x1) / 2, z = BACK;
    for (let i = 0; i < 3; i++) b.box(len, 0.7, 1.75, P.wood, cx, SEAT, z + 2.3 + i * 2.05, { cast: true });
    b.box(len, 1.8, 0.6, P.woodBack, cx, 8.4, z + 1.7, { cast: true });
    b.box(len, 1.8, 0.6, P.woodBack, cx, 10.7, z + 1.7, { cast: true });
    const n = Math.max(2, Math.round(len / 16) + 1);
    for (let k = 0; k < n; k++) {
      const x = x0 + 1.4 + (len - 2.8) * k / (n - 1);
      b.box(0.7, SEAT - 0.35, 0.7, P.steel, x, (SEAT - 0.35) / 2, z + 7.0);   // 前脚
      b.box(0.7, 12.0, 0.7, P.steel, x, 6.0, z + 2.2);                       // 後脚（背の支柱。背板より少し上へ出す）
      b.box(0.6, 0.6, 5.6, P.steel, x, SEAT - 0.65, z + 4.6);                // 座の受け
      b.box(0.5, 0.5, 5.4, P.steel, x, 1.3, z + 4.6);                        // 貫
    }
  };
  benchWall(-4, 44);
  benchWall(68, 122);
  benchWall(176, 212);
  benchWall(-112, -84);

  // 受付の小窓（閉まったまま）。すりガラスの向こうだけが暖かく明るい
  const RX = -25;
  b.box(24, 11.6, 0.6, P.sash, RX, 19.0, BACK + 0.3);
  g.box(10.4, 9.2, 0.2, P.frost, RX - 5.2, 19.0, BACK + 0.7);
  g.box(10.4, 9.2, 0.2, P.frostHi, RX + 5.2, 19.0, BACK + 0.9);
  b.box(0.8, 9.6, 0.5, P.sash, RX, 19.0, BACK + 1.15);                         // 引き違いの召し合わせ
  b.box(22.4, 0.7, 0.5, P.sash, RX, 23.9, BACK + 0.85);
  b.box(26, 0.8, 4.2, P.counter, RX, 14.3, BACK + 2.1);                        // 受付の台
  b.box(5, 2.6, 0.12, '#cfc8b8', RX - 5.2, 19.6, BACK + 0.88);                 // 「閉」の札（無地＋赤い棒）
  b.box(3.8, 0.7, 0.06, '#b5392f', RX - 5.2, 19.6, BACK + 0.97);
  b.box(1.4, 0.7, 1.4, '#c9ced0', RX + 7, 15.05, BACK + 2.6);                  // 呼び鈴
  b.box(0.4, 0.3, 0.4, '#7f878b', RX + 7, 15.55, BACK + 2.6);
  // 呼び出しの電話（誰も出ない）
  b.box(2.6, 4.2, 1.0, '#cdc6b6', -8.2, 17.4, BACK + 0.5);
  b.box(0.9, 3.6, 0.8, '#b9b19f', -8.8, 17.4, BACK + 1.4);
  b.box(0.16, 3.4, 0.16, '#3a3a3a', -8.8, 14.0, BACK + 1.6);

  // 古い鋳物のラジエーター（冷たいまま）
  const radiator = (x, w) => {
    b.box(w, 6.8, 1.4, '#99a1a5', x, 5.0, BACK + 1.6);
    for (let k = 0; k * 1.6 < w - 0.6; k++) b.box(0.9, 7.6, 2.4, '#889195', x - w / 2 + 0.8 + k * 1.6, 5.0, BACK + 1.7);
    b.box(0.8, 1.2, 0.8, '#6f787c', x - w / 2 + 1, 0.6, BACK + 1.7);
    b.box(0.8, 1.2, 0.8, '#6f787c', x + w / 2 - 1, 0.6, BACK + 1.7);
  };
  radiator(-58, 18);

  // 額に入った製品写真（文字なし。古い機械の写真）
  const photo = (x, y, w, h) => {
    b.box(w, h, 0.5, '#2b3036', x, y, BACK + 0.25);
    b.box(w - 1.2, h - 1.2, 0.1, '#d6d6cf', x, y, BACK + 0.55);
    b.box(w - 3, h - 3, 0.1, '#55626b', x, y, BACK + 0.65);
    b.box((w - 3) * 0.48, (h - 3) * 0.46, 0.08, '#a6b0b5', x - 0.8, y - 0.2, BACK + 0.74);
    b.box((w - 3) * 0.2, (h - 3) * 0.3, 0.08, '#c3cacd', x + (w - 3) * 0.27, y - 0.5, BACK + 0.8);
    b.box((w - 3) * 0.8, 0.5, 0.08, '#30383e', x, y - (h - 3) * 0.33, BACK + 0.86);
  };
  photo(20, 19.6, 16, 8.6);
  photo(194, 19.6, 14, 8.0);
  photo(-98, 19.6, 14, 8.0);

  // 床置きの冷水器（ベージュの箱にステンレスの受け皿）。壁掛けの白い器だと便器に見えるので箱にする
  {
    const x = 56, z = BACK + 3.0;
    b.box(5.4, 8.4, 4.6, '#c8c2b2', x, 4.2, z, { cast: true });
    b.box(5.8, 0.9, 5.0, '#b5bcc0', x, 8.85, z);
    b.box(4.0, 0.2, 3.2, '#8b9498', x, 9.36, z + 0.2);
    b.box(5.8, 2.6, 0.5, '#b5bcc0', x, 10.6, z - 2.3);
    b.box(0.5, 0.9, 0.5, '#8b9498', x - 1.1, 9.9, z - 0.6);
    b.box(1.6, 0.8, 0.3, '#8b9498', x, 8.4, z + 2.55);
    b.box(4.0, 2.2, 0.12, '#8f8a7c', x, 1.8, z + 2.33);   // 下の通気口
    for (const y of [1.2, 1.8, 2.4]) b.box(3.6, 0.16, 0.06, '#5f5b52', x, y, z + 2.41);
  }

  // 掛け時計（便箋の束の真上）。HUD の帯に掛からない高さで、扉の前に立つと画面の左に入る位置
  // （iPhone の横向きでは HUD の札が大きいので、扉の前から見えることを優先した）
  const CX = 108, CY = 19.6, CR = 4.1;
  {
    const face = addScenery(new THREE.Mesh(new THREE.CylinderGeometry(CR, CR, 0.6, 28),
      new THREE.MeshLambertMaterial({ color: hex(P.clockFace) })));
    face.rotation.x = Math.PI / 2;
    face.position.set(CX, CY, BACK + 0.9);
    const rim = addScenery(new THREE.Mesh(new THREE.CylinderGeometry(CR + 0.6, CR + 0.6, 0.8, 28),
      new THREE.MeshLambertMaterial({ color: hex(P.clockRim) })));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(CX, CY, BACK + 0.7);
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, q = k % 3 === 0, v = k % 6 === 0;
      b.box(q ? (v ? 0.55 : 1.15) : 0.42, q ? (v ? 1.15 : 0.55) : 0.42, 0.08, P.hand,
        CX + Math.sin(a) * (CR - 0.7), CY + Math.cos(a) * (CR - 0.7), BACK + 1.24);
    }
    b.box(0.9, 0.9, 0.16, P.hand, CX, CY, BACK + 1.76);
  }
  const hand = (w, len, z) => {
    const geo = new THREE.BoxGeometry(w, len, 0.16);
    geo.translate(0, len / 2 - 0.5, 0);
    const m = addScenery(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: hex(P.hand) })));
    m.position.set(CX, CY, z);
    return m;
  };
  const hourHand = hand(0.75, 2.8, BACK + 1.38);
  const minHand = hand(0.5, 3.8, BACK + 1.58);

  // 便箋の束（時計の下のベンチ）。レター＝社長宛の改善要望が溜まるほど高くなる
  const stacks = [
    paperPile(101.2, SEAT_TOP, BACK + 4.4, 0.07, 12, 1),
    paperPile(106.6, SEAT_TOP, BACK + 4.8, -0.13, 10, 2),
    paperPile(112.0, SEAT_TOP, BACK + 4.2, 0.22, 8, 3),
  ];
  b.box(3.2, 0.1, 4.2, P.paper, 95.6, SEAT_TOP + 0.05, BACK + 4.4, { rotY: -0.25 });   // 書きかけの1枚
  b.box(0.35, 0.3, 3.0, P.ink, 116.4, SEAT_TOP + 0.15, BACK + 4.6, { rotY: 0.55 });    // ペン
  // 書き損じて丸めた紙
  for (const [x, z, r] of [[97, 12, 0.3], [104, 15, 1.1], [113, 11, 0.7], [121, 16, 2.0], [92, 17, 1.4]]) {
    b.box(1.1, 0.9, 1.0, '#e9e7df', x, 0.45, BACK + z, { rotY: r });
  }

  // 右: 消火器・掲示板（無地の紙だけ）
  b.box(2.2, 6.0, 2.2, '#b3352c', 156, 8.4, BACK + 1.7, { cast: true });
  b.box(1.2, 1.1, 1.2, '#2b2f33', 156, 11.95, BACK + 1.7);
  b.box(0.5, 4.2, 0.5, '#2b2f33', 157.4, 9.0, BACK + 2.5);
  b.box(3.0, 0.6, 1.0, P.clip, 156, 5.2, BACK + 1.0);
  // 掃除用のバケツとモップ（扉の脇に置きっぱなし）
  {
    const x = 165, z = BACK + 5.2;
    b.box(5.0, 4.0, 4.2, '#d2ae3a', x, 2.4, z, { cast: true });
    b.box(3.4, 1.3, 4.4, '#bb9a2c', x, 5.0, z);
    for (const [dx, dz] of [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]]) b.box(0.8, 0.4, 0.8, '#2b2f33', x + dx, 0.2, z + dz);
    b.box(2.2, 1.6, 2.2, '#cfcabc', x + 0.9, 4.6, z - 0.6);            // モップの房（バケツから覗く）
    b.box(0.45, 13, 0.45, '#9a8a6a', x + 0.9, 10.6, z - 0.6);          // 柄
  }
  b.box(13, 8.6, 0.5, '#6b5238', 168, 19.4, BACK + 0.25);
  b.box(12, 7.6, 0.2, '#a8875d', 168, 19.4, BACK + 0.6);
  for (const [x, y, c, w, h] of [[-3.6, 1.2, '#efeee8', 3.0, 3.8], [0, 1.6, '#e7dc9c', 3.2, 2.6],
    [3.4, 0.4, '#cfdfe9', 2.8, 3.6], [-0.4, -2.2, '#efeee8', 3.6, 2.2]]) {
    b.box(w, h, 0.06, c, 168 + x, 19.4 + y, BACK + 0.74);
  }

  // 古い自販機（冷たい光の見本窓。文字もロゴもない）
  {
    const VX = 228, VZ = BACK + 4.8, front = BACK + 8.8;
    b.box(12, 21, 8, '#3a454d', VX, 10.5, VZ, { cast: true });
    b.box(12.4, 0.8, 8.4, '#2b343a', VX, 21.4, VZ);
    g.box(7.6, 8.4, 0.2, '#d6e3eb', VX - 1.4, 15.2, front + 0.1);
    const goods = ['#b65a4a', '#7a5a3a', '#4a6a9a', '#5a8a5a', '#c9a84a', '#8a4a5a'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      g.box(1.7, 1.9, 0.1, goods[(r * 3 + c + r) % goods.length], VX - 3.8 + c * 2.4, 12.7 + r * 2.6, front + 0.25);
    }
    b.box(2.4, 7.6, 0.3, '#262e33', VX + 4.4, 15.2, front + 0.15);
    for (let k = 0; k < 4; k++) g.box(1.3, 0.7, 0.1, '#9fd0e8', VX + 4.4, 18 - k * 1.8, front + 0.35);
    b.box(7.6, 2.8, 0.5, '#1c2226', VX - 1.4, 4.6, front + 0.25);
    b.box(1.6, 2.4, 0.3, '#5d676e', VX + 4.4, 9.4, front + 0.15);
  }
  // ごみ箱と、枯れた鉢植え
  b.box(4.6, 6.2, 4.6, '#55626a', 241, 3.1, BACK + 4.2);
  b.box(5.0, 0.6, 5.0, '#44505a', 241, 6.5, BACK + 4.2);
  b.box(2.0, 0.8, 1.4, P.paper, 240.2, 7.1, BACK + 4.4, { rotY: 0.4 });
  b.box(4.4, 4.6, 4.4, '#8e6a4e', 251, 2.3, BACK + 4.2, { cast: true });
  b.box(4.9, 0.6, 4.9, '#7a5a42', 251, 4.6, BACK + 4.2);
  for (const [dx, h, r] of [[-0.8, 6.5, 0.3], [0.6, 8.2, 1.2], [0.2, 5.0, 2.4]]) {
    b.box(0.35, h, 0.35, '#7d6a48', 251 + dx, 4.9 + h / 2, BACK + 4.2, { rotY: r });
    b.box(1.6, 0.25, 0.9, '#8a7448', 251 + dx + 0.6, 4.9 + h - 0.6, BACK + 4.6, { rotY: r });
  }

  // ---------- 手前ゾーン: 低い物だけ（足元の線より低く）----------
  // 扉の方を向いて並ぶベンチ。カメラには背の側が見える
  const benchFront = (x0, x1, zc) => {
    const len = x1 - x0, cx = (x0 + x1) / 2;
    for (let i = 0; i < 3; i++) b.box(len, 0.7, 1.75, P.wood, cx, SEAT, zc - 2.05 + i * 2.05);
    b.box(len, 1.8, 0.6, P.woodBack, cx, 8.6, zc + 3.0);
    const n = Math.max(2, Math.round(len / 16) + 1);
    for (let k = 0; k < n; k++) {
      const x = x0 + 1.4 + (len - 2.8) * k / (n - 1);
      b.box(0.7, SEAT - 0.35, 0.7, P.steel, x, (SEAT - 0.35) / 2, zc - 2.7);
      b.box(0.7, 9.9, 0.7, P.steel, x, 4.95, zc + 2.6);
      b.box(0.6, 0.6, 5.6, P.steel, x, SEAT - 0.65, zc);
      b.box(0.5, 0.5, 5.4, P.steel, x, 1.3, zc);
    }
  };
  for (const [x0, x1] of [[-80, -46], [-28, 6], [24, 58], [76, 110], [168, 202], [220, 254]]) benchFront(x0, x1, 55);

  b.done();
  unlit(g);

  // 動く物をまとめる
  L = {
    sec, leaf, lamp, spill, flick, hourHand, minHand, stacks,
    opened: false, openT: 0, ticks: 0, letter: -1, flickOn: true,
    clockH: waiting ? START_H + (1 - Math.min(1, stage.waitT / sec)) * SPAN_H : START_H + SPAN_H,
  };
  setHands(L);
  setStacks(L, 0);
  if (!waiting && stage) openDoor(L, true);
}

function setHands(s) {
  const h = s.clockH;
  s.minHand.rotation.z = -((h % 1) * Math.PI * 2);
  s.hourHand.rotation.z = -(((h % 12) / 12) * Math.PI * 2);
}

// 便箋の束。1束（厚み0.4）ずつ少しずらして積んだ形を1つのメッシュにまとめ、
// setDrawRange で下から何束目まで描くかを変える（描画は1山1回のまま、紙が積み上がっていく）
const BUNDLE = 0.75, PER_BUNDLE = 36;   // 待った時間＝レターの山。満タンで腰壁の笠木を越えて見えるくらいに   // BoxGeometry 1個の添字の数
function paperPile(x, y, z, rotY, n, seed) {
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color(), v = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const gk = new THREE.BoxGeometry(3.4 + hash(seed, k) * 0.3, BUNDLE, 4.4 + hash(k, seed) * 0.3);
    gk.rotateY((hash(seed + 7, k) - 0.5) * 0.32);
    gk.translate((hash(seed + 3, k) - 0.5) * 0.55, BUNDLE * (k + 0.5), (hash(k, seed + 5) - 0.5) * 0.55);
    c.set(P.sheets[(k * 3 + seed) % P.sheets.length]);
    const base = pos.length / 3;
    const pa = gk.attributes.position, na = gk.attributes.normal;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i); nv.fromBufferAttribute(na, i);
      pos.push(v.x, v.y, v.z); nor.push(nv.x, nv.y, nv.z); col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < gk.index.count; i++) idx.push(base + gk.index.array[i]);
    gk.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const m = addScenery(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  return { m, n };
}

function setStacks(s, letter) {
  s.letter = letter;
  const total = s.stacks.reduce((a, p) => a + p.n, 0);
  let left = Math.max(1, Math.round(letter * total));   // 1束目は最初からある（書き始めの便箋）
  for (const p of s.stacks) {
    const k = Math.min(p.n, left);
    left -= k;
    p.m.visible = k > 0;
    p.m.geometry.setDrawRange(0, k * PER_BUNDLE);
  }
}

function openDoor(s, snap) {
  if (s.opened) return;
  s.opened = true;
  s.openT = snap ? 99 : 0;
  if (snap) s.clockH = START_H + SPAN_H;   // 待ちの後に建てた: 時計はもう夕方
  setHands(s);
  s.lamp.material.color.set(P.lampGreen);
  applyOpen(s);
}

// 開いてからの時間で、扉の角度・こぼれる明かり・部屋の光の温かさを決める
function applyOpen(s) {
  const t = s.openT;
  const d = easeOut(clamp01((t - 0.35) / 1.5));      // 錠が外れる間を置いてから、重い扉がゆっくり開く
  s.leaf.rotation.y = -DOOR_MAX * d;
  s.spill.visible = d > 0.01;
  s.spill.material.opacity = 0.34 * d;
  setWarmth(0.35 * clamp01((t - 0.3) / 2.5));   // 扉が開いても「少しだけ」温かく（床が青白からクリームへ反転しない）
}

export function onEvent(name, arg) {
  const s = L;
  if (!s) return;
  if (name === 'waitEnd') { openDoor(s, false); return; }
  if (name !== 'tick' || !arg) return;
  const dt = Math.min(0.1, Math.max(0, arg.dt || 0));
  const waitT = arg.waitT || 0;
  // 待ちが無い・もう終わっている（待合室フェーズの後にこの場面へ戻ってきた）なら、最初から開けておく
  if (!s.opened && waitT <= 0) openDoor(s, s.ticks === 0);
  s.ticks++;

  // 時計。待っているあいだは待ちの残りから時刻を決める（建て直しても狂わない）。通された後は普通に進む
  if (!s.opened) s.clockH = START_H + (1 - Math.min(1, waitT / s.sec)) * SPAN_H;
  else s.clockH += dt / 3600;
  setHands(s);

  // 便箋の束
  const lt = clamp01(arg.letter || 0);
  if (Math.abs(lt - s.letter) > 1e-4) setStacks(s, lt);

  // 扉が開いていく途中
  if (s.opened && s.openT < 3) { s.openT += dt; applyOpen(s); }

  // 切れかけの蛍光灯。7秒に1度、0.6秒ほど瞬く
  const t = arg.t || 0, ph = t % 7.1;
  const on = !((ph < 0.6 && Math.floor(t * 19) % 3 === 0) || (ph > 3.2 && ph < 3.3));
  if (on !== s.flickOn) { s.flickOn = on; s.flick.material.color.copy(on ? C_TUBE : C_TUBE_DIM); }
}
