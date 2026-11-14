// 小向クエスト2 ゴールデンエイジ編 — 最終章「1階の大会議室」（ボス戦・解散・エピローグ）
//
// 自社1階の、広くて冷たい大会議室。発注官庁の担当官（ボス）が係争を連れて来る。
// 本編の役員フロアは使わない（本編の到達点を先に見せないため）。
//
// 奥ゾーンに向かい合わせの長机を2列:
//   壁側＝官庁側。こちらを向いて座る。書類は1部ずつ、無地の席札、水のグラス、2席に1本のマイク。整っている。
//   手前＝こちら側。カメラに背を向けて座る。書類の山・立てたバインダー・図面・湯のみ。散らかっている。
// 手前ゾーンはこちらの資料置き場（低い折りたたみ机に書類箱と書類。椅子は置かない。帯の手前の人を隠さない高さ）。
// 奥の壁は柱で区切り、柱間ごとにブラインドを下ろした窓／掲示板。ボス戦の正面（右端の手前）に
// 大きなホワイトボード（文字なしの工程表＝赤い縦の期限の線を越えて伸びる棒、延長の赤い棒の列）、
// 右端の柱間に扉と誘導灯（無地の緑）。机の列は扉の手前の柱で終わり、扉の前は空けてある。
// 光は灰緑で冷たい（坂 1.0。いちばん冷たく暗い章）。
//
// 出来事（onEvent）:
//   'disband'  … 誰もいない部屋に変わる。机の上の物が1つずつ消え、椅子が机に押し込まれる
//                （官庁側は揃えて、こちら側は向きが乱れたまま）。照明が2段で半分落ちる。
//                白板の工程表だけが残る（磁石と付箋は消え、マーカーの線は消し忘れ）。
//                「最後の同期が呼ばれて出ていく」の行（3.4秒）に合わせて右端の扉が開き、
//                廊下の光が床に差して、閉じる。
//   'epilogue' … そのまま。手前（画面の外）の窓から外の明かりが一筋差し、白板の期限を越えた棒のあたりに
//                縦の帯、床と机に斜めの帯を落とす。奥の窓の外は夜が深くなる。時計は1時間ほど進んでいる。
//   'tick'     … 壁の時計（秒針は1秒ずつ）と、上の変化の進み。
// build のたびに「人がいる」状態から建て直す。
//
// 文字・ロゴ・社章・旗・国章は描かない（誘導灯も無地の緑の板）。人に見える物も置かない。
// 描画の回数: 動かない物はまとめ描き（光を受ける物 影あり／なし・自分で光る物・白板）、
// 椅子と机の上の物は InstancedMesh（1回ずつ。解散で1つずつ動かす／消すため）。
import { THREE, S, wx, wz, box, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, chair, fireRow, scene, hemi, sun, fill, ROOM } from '../../../game3d/src/render3d.js';

// ===== 色 =====
const C = {
  wall: '#aab6af', wainscot: '#6c7972', rail: '#59655f', base: '#39423e',
  column: '#9eaaa3',
  floor: '#4f5853', tile: '#56605a',
  ceiling: '#87928c',
  top: '#d3d7d1', topEdge: '#8f9893', leg: '#59625e', panel: '#6b7570', frontTop: '#c9cdc6',
  chair: '#4a5d58', chairFrame: '#262c2a',
  frame: '#97a19c', sill: '#bfc8c2', headbox: '#b3bbb6', cord: '#76817c',
  blind: '#cbd6d0', slat: '#a9b7af',
  board: '#eef1ee', boardRim: '#a0aaa4', tray: '#8d9791', smudge: '#dfe3e0',
  door: '#77837d', doorFrame: '#56615b', handle: '#c4cac6', kick: '#959e99', closer: '#3e4542',
  exitBox: '#e6e9e5', exitGreen: '#2fcf76',
  corridor: '#ded9c8', corridorLow: '#bdb7a6', corridorFloor: '#a7a294',
  cork: '#9c7b55', corkFrame: '#765f45', pin: ['#c8382f', '#2f5a8f', '#e0b23a'],
  clockFace: '#eff0ec', clockRim: '#2c3230', clockMark: '#39403c',
  paper: ['#f2f3ee', '#e8e7de', '#ece8d9', '#f6f6f1'],
  plate: '#f6f6f2', glass: '#c3d6da', mic: '#272c2a', pen: '#2b3a5e',
  cup: '#e9e7df', roll: '#dce6ec', drawing: '#d3e0ea', drawLine: '#3d5d8c',
  binder: ['#2f5a8f', '#8f3a2e', '#3f6e46', '#d6d3c5', '#7a6a2e', '#4a4f8a', '#2c3e50'],
  box: '#b49166', boxLid: '#c29f73',
  bin: '#5d6763',
};
// 工程表の棒。予定（淡い青）・済み（青）・遅れ（橙）・期限越え（赤）
const BAR = {
  plan: '#8fb0d6', done: '#3f6fa8', late: '#de8a2c', over: '#c9362e', dead: '#d42c26',
  grid: '#d9dfdb', head: '#ccd4cf', ink: '#4a514d',
};
const MAGNET = ['#c8382f', '#2f5a8f', '#e0b23a', '#2a2e2c'];
const NOTE = ['#f3e27a', '#f2b6c4', '#f3e27a'];

// 光（坂 1.0）。人がいる／照明が半分落ちた／エピローグ
// 直前の区間（5階の審査室）は四騎士と戦ううちに夜になる。そのあとで明るい昼に戻らないよう、夜の室内の明るさから始める
const L0 = { hemi: '#c3d0c9', ground: '#45504a', hi: 1.15, sun: '#dfe9e4', si: 0.56, fi: 0.76, fog: '#4a5450' };
const L1 = { hi: 0.98, si: 0.40, fi: 0.64, fog: '#3d4641' };
const L2 = { hi: 0.88, si: 0.34, fi: 0.60, fog: '#383f3b' };

// 寸法（ワールド単位）
const TOPY = 8.6;          // 奥の長机の天板の上面
const TD = 9;              // 長机の奥行き
const ZG = -57;            // 官庁側の長机の中心（壁側）
const ZO = -38;            // こちら側の長机の中心
const FTOP = 7.6;          // 手前の後列の机（折りたたみ）の上面
const ZF = 57;             // 資料置き場の机の中心（物の上端が「足元の線」に収まる奥行き）
const FD = 8;              // 後列の机の奥行き
const TW = 30, TG = 1.0;   // 机1台の幅と、台どうしの隙間（3台で1組）
const AISLE = 12;          // 組と組のあいだの通路

// 解散の進み（秒）。書類の「最後の同期が呼ばれて出ていく」は 3.4 秒で出る
const T = {
  items: 1.5,                 // 机の上の物が消え終わる
  chairs0: 0.3, chairs1: 2.0, // 椅子が動く区間
  lights: [0.95, 1.75],       // 照明が落ちる（2段）
  doorOpen: 3.4, doorOpenDur: 0.9, doorHold: 1.6, doorClose: 0.8,
};
const DOOR_MAX = 1.55;        // 扉の開き（rad）。ほぼ直角まで開く（浅いと、扉へ歩いて入る同期の体を戸の縁が縦に切る）

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
// 位置から決まる乱数。建て直しても同じ机に同じ物が載る
function rng(seed) {
  let s = (Math.floor(Math.abs(seed) * 7919 + 104729) >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

// ===== まとめ描き =====
// boxBatch と同じ考え方（頂点カラーで1メッシュ）で、円柱や回した箱も混ぜられる版。
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
function geoBatch() {
  const list = [];
  const api = {
    add(tpl, color, x, y, z, o = {}) {
      const g = tpl.clone();
      g.scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
      if (o.rx) g.rotateX(o.rx);
      if (o.rz) g.rotateZ(o.rz);
      if (o.ry) g.rotateY(o.ry);
      g.translate(x, y, z);
      list.push([g, color]);
      return api;
    },
    box(w, h, d, color, x, y, z, o = {}) { return api.add(UNIT_BOX, color, x, y, z, { ...o, sx: w, sy: h, sz: d }); },
    cyl(r, h, color, x, y, z, o = {}) { return api.add(UNIT_CYL, color, x, y, z, { ...o, sx: r * 2, sy: h, sz: r * 2 }); },
    geometry() {
      let nv = 0, ni = 0;
      for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      const c = new THREE.Color();
      let v = 0, k = 0;
      for (const [g, color] of list) {
        c.set(color);   // ColorManagement で linear になる。頂点カラーにそのまま入れてよい
        const n = g.attributes.position.count;
        pos.set(g.attributes.position.array, v * 3);
        nor.set(g.attributes.normal.array, v * 3);
        for (let i = 0; i < n; i++) { col[(v + i) * 3] = c.r; col[(v + i) * 3 + 1] = c.g; col[(v + i) * 3 + 2] = c.b; }
        if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx[k++] = v + I[i]; }
        else for (let i = 0; i < n; i++) idx[k++] = v + i;
        v += n;
        g.dispose();
      }
      list.length = 0;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      return geo;
    },
    // シーンに足す。material を渡す（頂点カラー前提）
    done(material, { cast = false, receive = true } = {}) {
      if (!list.length) return null;
      const m = new THREE.Mesh(api.geometry(), material);
      m.castShadow = cast; m.receiveShadow = receive;
      m.matrixAutoUpdate = false; m.updateMatrix();
      return addScenery(m);
    },
  };
  return api;
}
const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const unlit = () => new THREE.MeshBasicMaterial({ vertexColors: true });

// 机の上の物（InstancedMesh にするための控え）。解散で1つずつ消すので、1つずつ行列を持つ
function itemList() {
  const L = [];
  return {
    L,
    add(w, h, d, color, x, y, z, o = {}) { L.push({ w, h, d, color, x, y, z, rx: o.rx || 0, ry: o.ry || 0, rz: o.rz || 0, at: 0 }); },
  };
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function setItem(mesh, i, it, k) {
  _p.set(it.x, it.y, it.z);
  _q.setFromEuler(_e.set(it.rx, it.ry, it.rz));
  _s.set(it.w * k, it.h * k, it.d * k);
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
}
function setChair(mesh, i, x, z, ry) {
  _p.set(x, 0, z);
  _q.setFromEuler(_e.set(0, ry, 0));
  _s.set(1, 1, 1);
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
}
// clearScenery は geometry と material しか捨てないので、行列のバッファも一緒に捨てる
function disposeWithGeometry(inst) { inst.geometry.addEventListener('dispose', () => inst.dispose()); }
function itemsMesh(tpl, L) {
  if (!L.length) return null;
  const m = new THREE.InstancedMesh(tpl.clone(), new THREE.MeshLambertMaterial(), L.length);
  for (let i = 0; i < L.length; i++) { setItem(m, i, L[i], 1); m.setColorAt(i, _c.set(L[i].color)); }
  m.instanceMatrix.needsUpdate = true;
  m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  m.castShadow = false; m.receiveShadow = true;
  disposeWithGeometry(m);
  return addScenery(m);
}

// 会議椅子（4本脚・布張り）。局所座標で座る人は +z を向き、背もたれは -z 側。床が原点
function chairGeometry() {
  const g = geoBatch();
  g.box(5.8, 1.1, 5.6, C.chair, 0, 5.05, 0.2);              // 座面
  g.box(5.8, 5.6, 0.9, C.chair, 0, 9.7, -2.55);             // 背もたれ（上端 12.5）
  for (const sx of [-2.45, 2.45]) {
    g.box(0.45, 4.5, 0.45, C.chairFrame, sx, 2.25, 2.3);    // 前脚
    g.box(0.45, 4.5, 0.45, C.chairFrame, sx, 2.25, -2.3);   // 後脚
    g.box(0.45, 2.1, 0.45, C.chairFrame, sx, 6.45, -2.55);  // 背の支柱（座面と背もたれの間に見える）
  }
  g.box(5.0, 0.4, 0.4, C.chairFrame, 0, 1.2, 2.3);          // 前の貫
  return g.geometry();
}

// ===== 動かす物（build のたびに作り直す。前の章の参照を残さない）=====
let anim = null;

export function build(W, halfD, ctx = {}) {
  anim = null;
  const { BACK, FRONT } = zones(halfD, 44, 70);   // 奥 -72 / 手前 98
  setLighting(false);
  hemi.color.set(L0.hemi); hemi.groundColor.set(L0.ground); hemi.intensity = L0.hi;
  sun.color.set(L0.sun); sun.intensity = L0.si; fill.intensity = L0.fi;   // fill の色は他の場面が戻さないので触らない
  scene.background = hex(L0.fog);
  scene.fog = new THREE.Fog(hex(L0.fog), 280, 900);

  const XL = -140, XR = W + 140, XM = (XL + XR) / 2, XW = XR - XL;
  const B = geoBatch();      // 光を受ける・動かない物（影なし）
  const K = geoBatch();      // 光を受ける・動かない物（影を落とす。奥の大物だけ）
  const G = geoBatch();      // 自分で光る物（誘導灯・廊下）
  const Bl = geoBatch();     // ブラインド越しの外の明るさ（外は夜。エピローグでさらに暗くする）
  const Bd = geoBatch();     // ホワイトボードの面と線（部屋が暗くなっても読めるよう少し自発光）
  const IB = itemList();     // 机の上の物（箱）。解散で消える
  const IC = itemList();     // 机の上の物（円柱）。解散で消える

  // ===== 床 =====
  // 冷たい灰緑のPタイル。わずかに色の違う市松
  B.box(XW, 2, FRONT - BACK, C.floor, XM, -1, (FRONT + BACK) / 2);
  for (let i = 0, x = XL; x < XR; x += 12, i++) {
    for (let j = 0, z = BACK; z < FRONT - 0.1; z += 12, j++) {
      if ((i + j) % 2) B.box(12, 0.04, Math.min(12, FRONT - z), C.tile, x + 6, 0.02, z + Math.min(12, FRONT - z) / 2);
    }
  }

  // ===== 奥の壁 =====
  // 右端の柱間に扉。開くと廊下が見えるので、扉の所だけ壁を本当に開ける（箱はくり抜けないので壁を3つに分ける）
  const DX = W + 12, DW = 12.4, DH = 23;
  const dx0 = DX - DW / 2, dx1 = DX + DW / 2;
  B.box(dx0 - XL, 64, 2, C.wall, (XL + dx0) / 2, 32, BACK - 1);
  B.box(XR - dx1, 64, 2, C.wall, (dx1 + XR) / 2, 32, BACK - 1);
  B.box(DW, 64 - DH, 2, C.wall, DX, (64 + DH) / 2, BACK - 1);
  // 腰壁・見切り・幅木（扉の枠の手前で切る）
  for (const [a, b] of [[XL, dx0 - 1.0], [dx1 + 1.0, XR]]) {
    B.box(b - a, 9, 0.8, C.wainscot, (a + b) / 2, 4.5, BACK + 0.4);
    B.box(b - a, 0.8, 1.2, C.rail, (a + b) / 2, 9.4, BACK + 0.6);
    B.box(b - a + 0.4, 1.0, 1.0, C.base, (a + b) / 2, 0.5, BACK + 0.9);   // 端を腰壁と揃えない（同じ面が重なる）
  }

  // 天井（手前は z=40 で切る）。本編の ceilingSlab に、左右の延長を足す
  const CF = ceilingSlab(W, halfD, BACK, C.ceiling, 47);
  B.box(-40 - XL, 2, CF - BACK, C.ceiling, (XL - 40) / 2, 47, (CF + BACK) / 2);
  B.box(XR - W - 40, 2, CF - BACK, C.ceiling, (W + 40 + XR) / 2, 47, (CF + BACK) / 2);

  // 柱。右から: 扉の柱間の右端 / 扉と白板の間 / 白板と窓の間 / 以降 96 ごと
  const cols = [W + 62, W - 14];
  for (let x = W - 119; x > XL + 3; x -= 96) cols.push(x);
  for (const x of cols) {
    K.box(6, 46, 2.6, C.column, x, 23, BACK + 1.3, { cast: true });
    B.box(6.6, 1.0, 3.2, C.base, x, 0.5, BACK + 1.6);
  }

  // 柱間の中身
  const windowBay = (a, b) => {
    for (const cx of [a + 26, a + 70]) if (cx + 20 <= b - 3) win(B, Bl, cx, 38, BACK);
  };
  for (let i = 2; i < cols.length; i++) {
    const a = i + 1 < cols.length ? cols[i + 1] : XL - 3;
    const b = cols[i];
    if (i % 2 === 0) windowBay(a, b);
    else if (i % 4 === 3) corkBoard(B, (a + b) / 2, BACK, i);
    else oldBoard(B, Bd, (a + b) / 2, BACK);
  }
  windowBay(W + 62, XR);

  // ===== 白板（ボス戦の正面）=====
  const WB0 = W - 112, WB1 = W - 21, WBY0 = 11.2, WBY1 = 29.6;
  {
    const cx = (WB0 + WB1) / 2, cy = (WBY0 + WBY1) / 2, zf = BACK + 1.1;   // 面の手前の面
    B.box(WB1 - WB0 + 1.2, WBY1 - WBY0 + 1.2, 0.8, C.boardRim, cx, cy, BACK + 0.4);             // 裏板
    for (const s of [-1, 1]) {
      B.box(WB1 - WB0 + 2.0, 1.0, 0.6, C.boardRim, cx, s > 0 ? WBY1 + 0.5 : WBY0 - 0.5, BACK + 1.1);   // 上下の縁
      B.box(1.0, WBY1 - WBY0 + 2.0, 0.6, C.boardRim, s > 0 ? WB1 + 0.5 : WB0 - 0.5, cy, BACK + 1.1);   // 左右の縁
    }
    Bd.box(WB1 - WB0, WBY1 - WBY0, 0.3, C.board, cx, cy, BACK + 0.95);
    schedule(Bd, IB, WB0, WB1, WBY0, WBY1, zf);
    // ペン受けとマーカー・イレーザー（これは残る）。白板の下の縁（手前 BACK+1.4）より手前に載せる
    const ty = WBY0 - 1.0;                                                                       // 受けの上面
    B.box(WB1 - WB0 - 6, 0.7, 2.0, C.tray, cx, ty - 0.35, BACK + 1.5);
    B.box(2.6, 0.55, 0.55, '#c8382f', cx - 30, ty + 0.27, BACK + 1.95, { ry: 0.05 });
    B.box(2.6, 0.55, 0.55, '#2f5a8f', cx - 26.5, ty + 0.27, BACK + 1.9);
    B.box(2.6, 0.55, 0.55, '#262a28', cx - 23, ty + 0.27, BACK + 1.95, { ry: -0.08 });
    B.box(3.4, 0.5, 0.9, '#d8dad6', cx + 24, ty + 0.25, BACK + 1.95);                          // イレーザーのフェルト
    B.box(3.2, 0.6, 0.8, '#3c4a5c', cx + 24, ty + 0.78, BACK + 1.95);                          // 持ち手
  }

  // ===== 扉・誘導灯・時計（右端の柱間）=====
  // 枠（ケーシング）は開口に少しかぶせ、閉じた扉のまわりから廊下の光が漏れないようにする。
  // 下の隙間だけは開けておく（暗くなった部屋で、扉の下に廊下の明かりが細く見える）
  B.box(1.4, DH + 1.0, 0.8, C.doorFrame, dx0 - 0.3, (DH + 1.0) / 2, BACK + 0.4);
  B.box(1.4, DH + 1.0, 0.8, C.doorFrame, dx1 + 0.3, (DH + 1.0) / 2, BACK + 0.4);
  B.box(DW + 2.0, 1.4, 0.8, C.doorFrame, DX, DH + 0.3, BACK + 0.4);
  // 開いたときに見える廊下（自分で光る。壁の厚みの奥）
  G.box(DW + 22, DH + 8, 0.4, C.corridor, DX + 6, (DH + 8) / 2, BACK - 12);
  G.box(DW + 22, 7, 0.2, C.corridorLow, DX + 6, 3.5, BACK - 11.7);
  G.box(DW + 22, 0.1, 10.5, C.corridorFloor, DX + 6, 0.05, BACK - 6.9);
  G.box(DW - 0.2, 0.1, 2.1, C.corridorFloor, DX, 0.06, BACK - 1.0);       // 壁の厚みの床（敷居）
  // 誘導灯（無地の緑）
  B.box(7.4, 2.8, 1.0, C.exitBox, DX, DH + 3.6, BACK + 0.5);
  G.box(6.6, 2.0, 0.12, C.exitGreen, DX, DH + 3.6, BACK + 1.06);
  // 照明のスイッチ板
  B.box(1.5, 2.5, 0.3, '#e3e6e2', dx1 + 3.4, 12.2, BACK + 0.15);
  B.box(0.5, 0.9, 0.2, '#c9cdc9', dx1 + 3.4, 12.6, BACK + 0.35);
  // 時計（扉の左。扉の右だと、画面の右上の得点の札に隠れる）
  const clock = buildClock(B, W - 3, 21.5, BACK);
  // 扉の右の隅に、積み重ねた椅子
  {
    const x = W + 50, z = BACK + 7;
    for (let i = 0; i < 6; i++) K.box(5.8, 0.9, 5.6, C.chair, x, 5.0 + i * 1.25, z + i * 0.18, { cast: true });
    K.box(5.8, 5.6, 0.9, C.chair, x, 15.4, z - 2.4);
    for (const sx of [-2.45, 2.45]) for (const sz of [-2.3, 2.3]) K.box(0.45, 5.0, 0.45, C.chairFrame, x + sx, 2.5, z + sz);
    for (const sx of [-2.45, 2.45]) K.box(0.45, 9.4, 0.45, C.chairFrame, x + sx, 10.8, z - 2.4);
  }
  B.cyl(1.9, 4.2, C.bin, W - 4, 2.1, BACK + 5);   // 屑かご（扉の手前の柱の足元）

  // ===== 扉の戸（開け閉めするので別のメッシュ。蝶番は左）=====
  let leaf = null;
  {
    const lw = DW - 0.4, lh = DH - 0.25;
    const g = geoBatch();
    g.box(lw, lh, 0.7, C.door, lw / 2, 0.25 + lh / 2, 0);
    g.box(lw - 0.8, 2.2, 0.08, C.kick, lw / 2, 1.5, 0.39);                 // 蹴り板
    g.box(0.9, 0.9, 0.3, C.handle, lw - 1.5, 10.5, 0.5);                    // レバーの座
    g.box(2.2, 0.38, 0.38, C.handle, lw - 2.3, 10.5, 0.75);                 // レバー
    g.box(3.6, 0.9, 0.9, C.closer, 2.6, lh - 0.9, 0.8);                     // ドアクローザー
    leaf = new THREE.Mesh(g.geometry(), lambert());
    leaf.position.set(dx0 + 0.2, 0, BACK - 0.6);
    leaf.receiveShadow = true;
    addScenery(leaf);
  }
  // 開いたとき床に落ちる廊下の光（足し合わせの板。普段は見せない）
  const wedge = lightQuads([
    // 戸口から部屋へ扇形に広がる。蝶番の側（左）は開いた戸の陰になるので、右へ寄せる
    { p: [[dx0 + 1.5, 0.07, BACK + 0.2], [dx1, 0.07, BACK + 0.2], [dx1 + 10, 0.07, BACK + 30], [dx0 + 6, 0.07, BACK + 30]],
      c: ['#7a6f58', '#7a6f58', '#000000', '#000000'] },
  ]);
  wedge.visible = false;

  // ===== 長机（奥ゾーン）=====
  // 3台で1組。右端の組は扉の手前の柱（W-14）で終わる。官庁側とこちら側は同じ x に向かい合わせ
  const tables = [], groups = [];
  for (let right = W - 17; right > -40; right -= 3 * TW + 2 * TG + AISLE) {
    for (let k = 0; k < 3; k++) tables.push(right - TW / 2 - k * (TW + TG));
    groups.push({ x0: right - 3 * TW - 2 * TG, x1: right });
  }
  const chairPoses = [];     // {x0,z0,r0, x1,z1,r1, d}  人がいる → 誰もいない
  let seat = 0;
  for (const tx of tables) {
    longTable(K, B, tx, ZG, +1);   // 官庁側。幕板はこちら側（+z）
    longTable(K, B, tx, ZO, -1);   // こちら側。幕板は官庁側（-z）
    for (const dx of [-10, 0, 10]) {
      const sx = tx + dx;
      const r = rng(sx * 3.1 + 7);
      // 官庁側の椅子: 引いて座っていた → 揃えて机に押し込む（官庁は整然と帰る）
      chairPoses.push({
        x0: sx + (r() - 0.5) * 1.2, z0: ZG - TD / 2 - 3.4 - r() * 0.9, r0: (r() - 0.5) * 0.34,
        x1: sx, z1: ZG - TD / 2 - 0.3 + 2.1, r1: 0,
        d: T.chairs0 + r() * (T.chairs1 - T.chairs0 - 0.55),
      });
      govItems(IB, IC, sx, r, seat++ % 2 === 0);   // マイクは2席に1本
      // こちら側の椅子: 引いたまま → 押し込んだもの、向きが乱れたもの、横を向いたもの
      const r2 = rng(sx * 5.7 + 3);
      const kind = r2();
      const pose = { x0: sx + (r2() - 0.5) * 1.2, z0: ZO + TD / 2 + 3.6 + r2() * 0.5, r0: Math.PI + (r2() - 0.5) * 0.36 };
      // 隣の椅子（10 間隔）とぶつからないよう、横へのずれは小さく。帯（z>-25）にもはみ出さない
      if (kind < 0.38) Object.assign(pose, { x1: sx + (r2() - 0.5) * 0.6, z1: ZO + TD / 2 + 0.3 - 2.1, r1: Math.PI + (r2() - 0.5) * 0.1 });
      else if (kind < 0.8) Object.assign(pose, { x1: sx + (r2() - 0.5) * 1.6, z1: ZO + TD / 2 + 3.2, r1: Math.PI + (r2() < 0.5 ? -1 : 1) * (0.42 + r2() * 0.5) });
      else Object.assign(pose, { x1: sx + (r2() - 0.5) * 2.4, z1: ZO + TD / 2 + 3.9, r1: Math.PI + (r2() < 0.5 ? -1 : 1) * (1.25 + r2() * 0.3) });
      pose.d = T.chairs0 + r2() * (T.chairs1 - T.chairs0 - 0.55);
      chairPoses.push(pose);
      ourItems(IB, IC, sx, rng(sx * 2.3 + 11));
    }
  }

  // ===== 手前ゾーン: こちらの資料置き場（低い折りたたみ机に、書類箱と書類）=====
  // 椅子は置かない。カメラのすぐ前に背もたれが並ぶと、画面の下が暗い板で埋まるため。
  // 机の上の物も低く（天板から 2.5 まで）。帯の手前の端に立つ人の足元より少し上まで
  for (let right = W + 50; right > XL + 60; right -= 3 * TW + 2 * TG + AISLE) {
    for (let k = 0; k < 3; k++) {
      const tx = right - TW / 2 - k * (TW + TG);
      foldingTable(B, tx);
      backRowItems(IB, IC, tx, rng(tx * 4.3 + 19));
    }
  }

  // ===== まとめて描く =====
  B.done(lambert());
  K.done(lambert(), { cast: true });
  G.done(unlit(), { receive: false });
  const blindMat = unlit();
  Bl.done(blindMat, { receive: false });
  blindMat.color.set('#56606c');   // 外は夜（ブラインドの羽根が室内の明かりを少し拾うだけ）
  const boardMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: hex('#2c312e') });
  Bd.done(boardMat);

  // 椅子（1回の描画で全部。解散で1脚ずつ動かす）
  const chairs = new THREE.InstancedMesh(chairGeometry(), lambert(), chairPoses.length);
  chairPoses.forEach((p, i) => setChair(chairs, i, p.x0, p.z0, p.r0));
  chairs.instanceMatrix.needsUpdate = true;
  chairs.computeBoundingSphere();
  chairs.boundingSphere.radius += 8;   // 解散で少し動くぶん
  chairs.castShadow = true; chairs.receiveShadow = true;
  disposeWithGeometry(chairs);
  addScenery(chairs);

  // 机の上の物。消える順番はばらばら（一斉に消えると「場面が変わった」にしか見えない）
  const ib = itemsMesh(UNIT_BOX, IB.L), ic = itemsMesh(UNIT_CYL, IC.L);
  for (const L of [IB.L, IC.L]) {
    const r = rng(L.length * 13 + 5);
    for (const it of L) it.at = r() * (T.items - 0.2);
  }

  anim = {
    W, BACK, stage: ctx.stage || null, t: 0,
    chairs, chairPoses, ib, ic, items: [IB.L, IC.L],
    leaf, wedge, clock, blindMat, boardMat, groups, wb: { x0: WB0, x1: WB1 },
    disbandAt: null, epilogueAt: null, done: { items: false, chairs: false }, doorA: 0, doorAtEpi: 0, beam: null,
  };
}

// ===== 部品 =====

// 長机（奥）。face=+1 は官庁側（人は -z 側に座る。幕板は +z）、-1 はこちら側（人は +z 側。幕板は -z）
function longTable(K, B, x, z, face) {
  K.box(TW, 0.9, TD, C.top, x, TOPY - 0.45, z, { cast: true });
  B.box(TW + 0.2, 0.5, TD + 0.2, C.topEdge, x, TOPY - 0.65, z);               // 天板の木口
  for (const s of [-1, 1]) K.box(1.0, TOPY - 0.9, TD - 1.4, C.leg, x + s * 14.4, (TOPY - 0.9) / 2, z, { cast: true });
  K.box(TW - 2.0, 5.0, 0.6, C.panel, x, TOPY - 0.9 - 2.5, z + face * (TD / 2 - 0.4), { cast: true });   // 幕板
}

// 後列の折りたたみ机（手前ゾーン。脚は細く、幕板なし。天板の上面は FTOP）
function foldingTable(B, x) {
  B.box(TW, 0.7, FD, C.frontTop, x, FTOP - 0.35, ZF);
  B.box(TW + 0.2, 0.4, FD + 0.2, C.topEdge, x, FTOP - 0.5, ZF);
  for (const sx of [-13.8, 13.8]) for (const sz of [-3.2, 3.2]) B.box(0.6, FTOP - 0.7, 0.6, C.leg, x + sx, (FTOP - 0.7) / 2, ZF + sz);
  for (const sx of [-13.8, 13.8]) B.box(0.5, 0.5, FD - 1.2, C.leg, x + sx, 1.0, ZF);
}

// 官庁側の席: 書類1部・無地の席札・水のグラス・（2席に1本）マイク。整っている
function govItems(IB, IC, sx, r, mic) {
  const zs = ZG - 1.4;                        // 座る人の側
  IB.add(4.2, 0.35, 3.0, C.paper[0], sx - 1.0 + (r() - 0.5) * 0.4, TOPY + 0.175, zs, { ry: (r() - 0.5) * 0.08 });
  IB.add(2.4, 0.2, 0.26, C.pen, sx - 1.2, TOPY + 0.45, zs + 0.9, { ry: 0.25 });
  IB.add(4.8, 1.7, 0.6, C.plate, sx, TOPY + 0.85, ZG + 3.2);                  // 席札（こちら側を向く。無地）
  IC.add(1.0, 1.8, 1.0, C.glass, sx + 3.2, TOPY + 0.9, zs + 0.6);              // 水
  if (mic) {
    IB.add(1.8, 0.45, 1.3, C.mic, sx + 1.4, TOPY + 0.225, ZG + 1.6);
    IB.add(0.22, 3.4, 0.22, C.mic, sx + 1.4, TOPY + 1.95, ZG + 0.9, { rx: -0.42 });
  }
}

// こちら側の席: 書類の山・立てたバインダー・図面・湯のみ。散らかっている
function ourItems(IB, IC, sx, r) {
  const zs = ZO + 1.6;                        // 座る人の側（+z）
  // 書類の山（1〜3段）
  let y = TOPY;
  const n = 1 + Math.floor(r() * 3);
  const px = sx - 2.4 + (r() - 0.5) * 1.6;
  for (let k = 0; k < n; k++) {
    const h = 0.5 + r() * 1.3;
    IB.add(4.2 + r() * 0.6, h, 3.0 + r() * 0.4, pick(r, C.paper), px + (r() - 0.5) * 0.5, y + h / 2, zs + (r() - 0.5) * 0.6, { ry: (r() - 0.5) * 0.3 });
    y += h;
  }
  // 立てたバインダー（机の奥側に並べる）
  const nb = 2 + Math.floor(r() * 4);
  const bx = sx + 0.8 + r() * 1.5;
  for (let k = 0; k < nb; k++) IB.add(0.95, 4.0, 3.2, pick(r, C.binder), bx + k * 1.05, TOPY + 2.0, ZO - 2.2);
  // 図面（広げたもの／丸めたもの）
  const kind = r();
  if (kind < 0.34) {
    IB.add(8.5, 0.06, 5.0, C.drawing, sx + 1.5, TOPY + 0.03, zs + 0.2, { ry: (r() - 0.5) * 0.2 });
    for (let k = 0; k < 3; k++) IB.add(5.5 - k * 1.2, 0.05, 0.16, C.drawLine, sx + 0.8 + k * 0.4, TOPY + 0.085, zs - 1.2 + k * 1.1);
  } else if (kind < 0.62) {
    IC.add(1.0, 9, 1.0, C.roll, sx + 1.0, TOPY + 0.5, zs + 1.9, { rz: Math.PI / 2, ry: (r() - 0.5) * 0.3 });
  }
  // 湯のみ
  if (r() < 0.7) IC.add(1.1, 1.3, 1.1, C.cup, sx + 4.0, TOPY + 0.65, zs + 1.6);
}

// 資料置き場の机1台ぶん: 段ボールの書類箱（蓋つき）・書類の山・寝かせたバインダー・湯のみ。低い物だけ
function backRowItems(IB, IC, tx, r) {
  let x = tx - TW / 2 + 2;
  while (x < tx + TW / 2 - 4) {
    const k = r();
    if (k < 0.34) {                                   // 書類箱
      const w = 6.2, h = 2.0;
      const ry = (r() - 0.5) * 0.12, z = ZF - 0.6 + (r() - 0.5) * 0.8;
      IB.add(w, h, 4.2, C.box, x + w / 2, FTOP + h / 2, z, { ry });
      IB.add(w + 0.3, 0.35, 4.5, C.boxLid, x + w / 2, FTOP + h + 0.1, z, { ry });
      x += w + 0.8;
    } else if (k < 0.7) {                             // 書類の山
      const h = 0.5 + r() * 1.5;
      IB.add(4.2, h, 3.0, pick(r, C.paper), x + 2.1, FTOP + h / 2, ZF + (r() - 0.5) * 1.6, { ry: (r() - 0.5) * 0.35 });
      x += 5.0;
    } else if (k < 0.88) {                            // 寝かせたバインダー（1〜2冊）
      const n = 1 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) IB.add(3.3, 0.85, 4.4, pick(r, C.binder), x + 1.7 + (r() - 0.5) * 0.4, FTOP + 0.425 + i * 0.86, ZF + 0.4, { ry: (r() - 0.5) * 0.3 });
      x += 4.2;
    } else {
      IC.add(1.1, 1.3, 1.1, C.cup, x + 1.0, FTOP + 0.65, ZF + 2.2);
      x += 2.6;
    }
  }
}

// 窓（ブラインドを下ろしてある。外は見せない＝実在の景色を描かない）。下端 12・上端 30
function win(B, Bl, cx, ww, BACK) {
  B.box(ww + 1.8, 1.0, 1.2, C.frame, cx, 30.5, BACK + 0.6);                    // 上枠
  B.box(ww + 3.0, 0.9, 2.4, C.sill, cx, 11.55, BACK + 1.2);                     // 窓台
  for (const s of [-1, 1]) B.box(0.9, 18.6, 1.2, C.frame, cx + s * (ww / 2 + 0.45), 21, BACK + 0.6);
  B.box(ww - 0.2, 1.5, 1.6, C.headbox, cx, 29.25, BACK + 0.8);                  // ブラインドのヘッドボックス
  B.box(ww - 0.4, 0.5, 0.9, C.headbox, cx, 12.6, BACK + 0.65);                  // 下のバー
  B.box(0.16, 9, 0.16, C.cord, cx + ww / 2 - 1.6, 23.6, BACK + 1.2);            // 操作棒
  Bl.box(ww - 0.1, 16.2, 0.15, C.blind, cx, 20.6, BACK + 0.3);                  // 外の明るさ（スラットの隙間）
  for (let y = 13.3; y < 28.3; y += 0.95) Bl.box(ww - 0.2, 0.34, 0.3, C.slat, cx, y, BACK + 0.55);
}

// 掲示板（コルク。貼ってある紙は無地）
function corkBoard(B, cx, BACK, seed) {
  const w = 34, h = 13, cy = 19;
  for (const s of [-1, 1]) {
    B.box(w + 1.6, 0.8, 0.9, C.corkFrame, cx, cy + s * (h / 2 + 0.4), BACK + 0.45);
    B.box(0.8, h + 1.6, 0.9, C.corkFrame, cx + s * (w / 2 + 0.4), cy, BACK + 0.45);
  }
  B.box(w, h, 0.5, C.cork, cx, cy, BACK + 0.25);
  const r = rng(seed * 17 + 3);
  for (let i = 0, x = cx - w / 2 + 3.5; x < cx + w / 2 - 3; x += 5.2 + r() * 1.5, i++) {
    const pw = 3.2 + r() * 0.8, ph = 4.0 + r() * 1.4, py = cy + (r() - 0.5) * 3.5;
    B.box(pw, ph, 0.08, pick(r, C.paper), x, py, BACK + 0.55, { rz: (r() - 0.5) * 0.06 });
    B.box(0.45, 0.45, 0.3, pick(r, C.pin), x, py + ph / 2 - 0.5, BACK + 0.7);
  }
}

// 古い白板（消した跡だけ残っている）
function oldBoard(B, Bd, cx, BACK) {
  const w = 40, h = 14, cy = 19;
  for (const s of [-1, 1]) {
    B.box(w + 1.6, 0.8, 0.6, C.boardRim, cx, cy + s * (h / 2 + 0.4), BACK + 0.9);
    B.box(0.8, h + 1.6, 0.6, C.boardRim, cx + s * (w / 2 + 0.4), cy, BACK + 0.9);
  }
  B.box(w + 0.8, h + 0.8, 0.6, C.boardRim, cx, cy, BACK + 0.3);
  Bd.box(w, h, 0.3, C.board, cx, cy, BACK + 0.75);
  for (let i = 0; i < 4; i++) Bd.box(9 + i * 3, 1.6 + (i % 2), 0.05, C.smudge, cx - 8 + i * 4, cy + 3 - i * 1.9, BACK + 0.93);
  B.box(w - 4, 0.6, 1.6, C.tray, cx, cy - h / 2 - 1.1, BACK + 1.0);
}

// 工程表（文字なし）。左の列は行の見出し（字ではなく短い線）、上は月の目盛り、
// 赤い縦の期限の線を、遅れの棒が越えて右の端まで伸びる。最後の行は「延長の申し入れ」の赤い棒の列。
// 磁石と付箋は IB（解散で消える）。線は消し忘れて残る。
function schedule(Bd, IB, x0, x1, y0, y1, zf) {
  const c0 = x0 + 13, c1 = x1 - 2, cw = c1 - c0;
  const X = (f) => c0 + f * cw;
  const DL = 0.6;                                                       // 期限
  const top = y1 - 1.7;
  Bd.box(cw, 1.4, 0.06, BAR.head, (c0 + c1) / 2, top, zf + 0.03);        // 月の帯
  for (let x = c0 + 5.5; x < c1 - 0.5; x += 5.5) {
    Bd.box(0.14, top - 0.9 - (y0 + 0.8), 0.04, BAR.grid, x, (top - 0.9 + y0 + 0.8) / 2, zf + 0.02);
    Bd.box(0.2, 0.9, 0.08, BAR.ink, x, top, zf + 0.1);
  }
  Bd.box(0.2, y1 - y0 - 1.6, 0.06, BAR.ink, c0 - 0.6, (y0 + y1) / 2, zf + 0.05);   // 見出しの列の区切り
  // 行: [予定の始め, 予定の終わり, 済み, 遅れの終わり（1 を越えたら右端まで矢印）]
  const rows = [
    [0.00, 0.26, 0.26, 0], [0.08, 0.40, 0.40, 0.52], [0.20, 0.48, 0.38, 0.79],
    [0.28, 0.56, 0.33, 1.2], [0.38, 0.58, 0.00, 0.93], [0.46, 0.60, 0.00, 1.2],
  ];
  const pitch = (top - 1.6 - (y0 + 1.2)) / rows.length;
  const BH = 0.9, BY = -0.2;                                            // 実績の棒の太さと位置（行の線から）
  rows.forEach(([a, b, d, e], i) => {
    const y = top - 1.9 - i * pitch;
    const lw = 3.2 + ((i * 7) % 5) * 1.1;
    Bd.box(lw, 0.34, 0.05, BAR.ink, x0 + 2.5 + lw / 2, y, zf + 0.05);                  // 見出し（短い線）
    Bd.box(b - a > 0 ? (b - a) * cw : 0.1, 0.55, 0.06, BAR.plan, X((a + b) / 2), y + 0.58, zf + 0.06);  // 予定
    if (d > a) Bd.box((d - a) * cw, BH, 0.08, BAR.done, X((a + d) / 2), y + BY, zf + 0.08);            // 済み
    if (e > b) {
      const ee = Math.min(e, 1);
      const lateEnd = Math.min(ee, DL);
      if (lateEnd > b) Bd.box((lateEnd - b) * cw, BH, 0.08, BAR.late, X((b + lateEnd) / 2), y + BY, zf + 0.08);
      const o0 = Math.max(b, DL);
      if (ee > o0) Bd.box((ee - o0) * cw, BH, 0.08, BAR.over, X((o0 + ee) / 2), y + BY, zf + 0.08);
      if (e > 1) chevron(Bd, c1 + 0.5, y + BY, zf + 0.1, BAR.over);
      if (i % 2 === 1) IB.add(1.0, 1.0, 0.35, MAGNET[i % MAGNET.length], X(ee) - 0.4, y + 0.75, zf + 0.3);
    }
  });
  // 延長の申し入れ（何度も）: 期限の右に短い赤い棒が途切れ途切れに並ぶ
  {
    const y = top - 1.9 - rows.length * pitch;
    Bd.box(5.6, 0.34, 0.05, BAR.ink, x0 + 5.3, y, zf + 0.05);
    for (let f = DL + 0.02; f < 0.97; f += 0.085) Bd.box(0.06 * cw, BH, 0.08, BAR.over, X(f + 0.03), y + BY, zf + 0.08);
    chevron(Bd, c1 + 0.5, y + BY, zf + 0.1, BAR.over);
  }
  // 期限の線（赤・太め）と、上の三角
  Bd.box(0.8, y1 - y0 - 1.2, 0.08, BAR.dead, X(DL), (y0 + y1) / 2 - 0.1, zf + 0.12);
  Bd.box(1.2, 1.2, 0.08, BAR.dead, X(DL), y1 - 1.0, zf + 0.13, { rz: Math.PI / 4 });
  // 磁石・付箋（人が貼った物。解散で外される）
  IB.add(1.0, 1.0, 0.35, MAGNET[0], X(DL), y1 - 2.6, zf + 0.33);
  IB.add(1.0, 1.0, 0.35, MAGNET[2], c0 + 1.5, y0 + 1.6, zf + 0.3);
  IB.add(2.8, 2.8, 0.06, NOTE[0], X(0.83), y1 - 4.0, zf + 0.2, { rz: 0.06 });
  IB.add(2.8, 2.8, 0.06, NOTE[1], X(0.93), y1 - 4.4, zf + 0.21, { rz: -0.05 });
  IB.add(2.8, 2.8, 0.06, NOTE[2], X(0.72), y0 + 2.6, zf + 0.2, { rz: 0.04 });
}
function chevron(Bd, x, y, z, color) {
  Bd.box(1.3, 0.24, 0.06, color, x - 0.42, y + 0.36, z, { rz: -0.72 });
  Bd.box(1.3, 0.24, 0.06, color, x - 0.42, y - 0.36, z, { rz: 0.72 });
}

// 壁の時計（数字なし）。針は別のメッシュ（tick で回す）
function buildClock(B, x, y, BACK) {
  B.cyl(3.7, 0.4, C.clockRim, x, y, BACK + 0.2, { rx: Math.PI / 2, seg: 24 });
  B.cyl(3.3, 0.5, C.clockFace, x, y, BACK + 0.45, { rx: Math.PI / 2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, rr = 2.75;
    B.box(i % 3 ? 0.18 : 0.3, i % 3 ? 0.5 : 0.8, 0.06, C.clockMark, x + Math.sin(a) * rr, y + Math.cos(a) * rr, BACK + 0.73, { rz: -a });
  }
  const hand = (len, w, color, z) => {
    const g = new THREE.BoxGeometry(w, len, 0.08);
    g.translate(0, len / 2 - 0.45, 0);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: hex(color) }));
    m.position.set(x, y, BACK + z);
    return addScenery(m);
  };
  return {
    hour: hand(2.0, 0.42, C.clockRim, 0.8), min: hand(2.9, 0.28, C.clockRim, 0.86), sec: hand(3.0, 0.12, '#c8382f', 0.92),
    // 16時47分ごろ（審査が長引いている）から進める
    base: 19 * 3600 + 6 * 60 + 12,   // 日没後（審査室で夜になったあと）
  };
}

// 足し合わせで光る板（廊下の光・差し込む光）。頂点ごとの色が明るさ（黒＝何も足さない）
function lightQuads(list) {
  const pos = [], col = [], idx = [];
  for (const q of list) {
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(...q.p[i]); _c.set(q.c[i]); col.push(_c.r, _c.g, _c.b); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  }));
  m.matrixAutoUpdate = false; m.updateMatrix();
  return addScenery(m);
}

// エピローグの光: 手前（画面の外）の窓の、カーテンの隙間から外の明かりが一筋。
// 縦に細い隙間を通った光は「縦の板」になるので、奥の壁には縦の帯、床と机の上には
// 奥から手前左へ斜めに走る帯として落ちる。白板の上なら、期限の線を越えた赤い棒のあたりを横切らせる。
// 書類が画面の真ん中から下を塞ぐので、帯は画面の上（壁と奥の机）で読めるよう、自機（＝カメラ）の近くに置く。
function makeStreak(a) {
  const px = a.stage && a.stage.player ? wx(a.stage.player.x) : a.W - 50;
  let xs = Math.min(Math.max(px + 8, a.wb.x0 + 52), a.wb.x1 - 9);
  if (Math.abs(xs - px) > 60) xs = px + 8;       // 白板が画面に無いときは、画面の真ん中の壁に
  const zw = a.BACK + 1.55;                      // 白板の縁より手前
  const hw = 4.2;                                // 帯の半分の幅
  const dx = -0.55, dz = 0.835;                  // 床の上の帯の向き（奥から手前左へ）
  const nx = dz, nz = -dx;                       // 帯の幅の向き
  const WARM = '#8a6538', DIM = '#000000';
  const q = [];
  // 壁の縦の帯。中央の線が明るく、左右の縁は 0（足し合わせなので 0＝何も足さない）。
  // 窓の上端より高くは届かないので、上は y=26 から薄れて 34 で消える（天井まで伸ばすと光の柱に見える）
  const band = (ya, yb, ca, cb) => {
    q.push({ p: [[xs - hw, ya, zw], [xs, ya, zw], [xs, yb, zw], [xs - hw, yb, zw]], c: [DIM, ca, cb, DIM] });
    q.push({ p: [[xs, ya, zw], [xs + hw, ya, zw], [xs + hw, yb, zw], [xs, yb, zw]], c: [ca, DIM, DIM, cb] });
  };
  band(0.2, 26, WARM, WARM);
  band(26, 34, WARM, DIM);
  // 水平な面（床・机の上）の帯。z の範囲 [zA, zB] に切って置く。f0→f1 は明るさ（奥→手前）。
  // 床は斜めから見るので細く見える。壁の帯より幅を広げて縁をぼかす
  const hf = hw * 1.35;
  const flat = (y, zA, zB, f0, f1) => {
    const at = (side, z) => {                    // 帯の縁（side=-1/0/1）が z を横切る点
      const s = (z - zw - side * nz * hf) / dz;
      return [xs + side * nx * hf + dx * s, y, z];
    };
    const c0 = new THREE.Color(WARM).multiplyScalar(f0), c1 = new THREE.Color(WARM).multiplyScalar(f1);
    const h0 = '#' + c0.getHexString(), h1 = '#' + c1.getHexString();
    q.push({ p: [at(-1, zA), at(0, zA), at(0, zB), at(-1, zB)], c: [DIM, h0, h1, DIM] });
    q.push({ p: [at(0, zA), at(1, zA), at(1, zB), at(0, zB)], c: [h0, DIM, DIM, h1] });
    return [at(-1, zA)[0], at(1, zB)[0]];
  };
  // 床（机の下は机に隠れる）。手前ほど薄く、帯の真ん中あたりで消える
  flat(0.09, zw, 2, 0.75, 0);
  // 机の上。通路の上に浮かないよう、帯がまるごと机の上に載る所だけ
  const fz = (z) => clamp01(1 - (z - zw) / (2 - zw));
  for (const zc of [ZG, ZO]) {
    const zA = zc - TD / 2 + 0.15, zB = zc + TD / 2 - 0.15;
    const xa = xs + dx * ((zA - zw) / dz) - nx * hf - 1, xb = xs + dx * ((zB - zw) / dz) + nx * hf + 1;
    const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
    if (!a.groups.some((g) => lo >= g.x0 && hi <= g.x1)) continue;
    flat(TOPY + 0.07, zA, zB, fz(zA) * 1.15, fz(zB) * 1.15);
  }
  // 空中の筋（ほこりに当たった光）。縦の板を、壁から手前へ。上ほど・手前ほど薄い
  const LEN = 70, AIR_LO = '#33261a', AIR_HI = '#0e0a06';
  const wallX = xs, endX = xs + dx * LEN, endZ = zw + dz * LEN;
  q.push({ p: [[wallX, 0.3, zw], [endX, 22, endZ], [endX, 46, endZ], [wallX, 34, zw]], c: [AIR_LO, DIM, DIM, AIR_HI] });
  const m = lightQuads(q);
  m.material.opacity = 0;
  return m;
}

// ===== 出来事 =====
export function onEvent(name, arg) {
  const a = anim;
  if (!a) return;
  if (name === 'tick') {
    a.t = (arg && arg.t) || 0;
    tickClock(a);
    if (a.disbandAt != null) stepDisband(a, a.t - a.disbandAt);
    if (a.epilogueAt != null) stepEpilogue(a, a.t - a.epilogueAt);
  } else if (name === 'disband') {
    if (a.disbandAt == null) a.disbandAt = a.t;
  } else if (name === 'epilogue') {
    if (a.disbandAt == null) a.disbandAt = a.t - 30;   // 解散を経ずに来たら、空の部屋から始める
    if (a.epilogueAt == null) {
      a.epilogueAt = a.t;
      a.doorAtEpi = a.doorA;
      a.clock.base += 72 * 60;                         // 時間が経っている（夜）
      a.beam = makeStreak(a);
    }
  }
}

function tickClock(a) {
  const s = a.clock.base + Math.floor(a.t);            // 秒針は1秒ずつ進む
  const TAU = Math.PI * 2;
  a.clock.sec.rotation.z = -((s % 60) / 60) * TAU;
  a.clock.min.rotation.z = -(((s / 60) % 60) / 60) * TAU;
  a.clock.hour.rotation.z = -(((s / 3600) % 12) / 12) * TAU;
}

function stepDisband(a, u) {
  // 机の上の物が1つずつ消える
  if (!a.done.items) {
    const fin = u > T.items + 0.3;
    [a.ib, a.ic].forEach((mesh, n) => {
      if (!mesh) return;
      const L = a.items[n];
      for (let i = 0; i < L.length; i++) setItem(mesh, i, L[i], fin ? 0 : 1 - smooth((u - L[i].at) / 0.18));
      mesh.instanceMatrix.needsUpdate = true;
      if (fin) mesh.visible = false;
    });
    a.done.items = fin;
  }
  // 椅子が机に押し込まれる／向きが乱れる
  if (!a.done.chairs) {
    const fin = u > T.chairs1 + 0.3;
    a.chairPoses.forEach((p, i) => {
      const k = fin ? 1 : smooth((u - p.d) / 0.55);
      setChair(a.chairs, i, lerp(p.x0, p.x1, k), lerp(p.z0, p.z1, k), lerp(p.r0, p.r1, k));
    });
    a.chairs.instanceMatrix.needsUpdate = true;
    a.done.chairs = fin;
  }
  // 照明が2段で半分落ちる（蛍光灯の列を切るように、段ごとにすっと暗くなる）
  let k = 0;
  for (const t of T.lights) k += smooth((u - t) / 0.12);
  k /= T.lights.length;
  if (a.epilogueAt == null) applyLight(k, 0);
  // 扉: 開いて、廊下の光が床に差し、閉じる（エピローグに入ったら stepEpilogue が閉じる）
  if (a.epilogueAt == null) {
    let d = 0;
    const o = (u - T.doorOpen) / T.doorOpenDur;
    if (o > 0) {
      const c = (u - T.doorOpen - T.doorOpenDur - T.doorHold) / T.doorClose;
      d = c <= 0 ? 1 - Math.pow(1 - clamp01(o), 3) : 1 - smooth(c);
    }
    setDoor(a, d);
  }
}

function setDoor(a, d) {
  a.doorA = d;
  a.leaf.rotation.y = -d * DOOR_MAX;
  a.wedge.visible = d > 0.01;
  a.wedge.material.opacity = Math.sin(d * DOOR_MAX) / Math.sin(DOOR_MAX);
}

// k: 照明の落ち具合（0=人がいる 1=半分落ちた）、e: エピローグの進み
function applyLight(k, e) {
  hemi.intensity = lerp(lerp(L0.hi, L1.hi, k), L2.hi, e);
  sun.intensity = lerp(lerp(L0.si, L1.si, k), L2.si, e);
  fill.intensity = lerp(lerp(L0.fi, L1.fi, k), L2.fi, e);
  _c.set(L0.fog).lerp(_tmp.set(L1.fog), k).lerp(_tmp.set(L2.fog), e);
  if (scene.fog) scene.fog.color.copy(_c);
  if (scene.background && scene.background.isColor) scene.background.copy(_c);
}
const _tmp = new THREE.Color();

function stepEpilogue(a, v) {
  const e = smooth(v / 2.0);
  applyLight(1, e);
  // 奥の窓（日の当たらない側）の外は暮れていく。手前の窓から夕方の光が一筋
  a.blindMat.color.set('#56606c').lerp(_tmp.set('#3a4350'), smooth(v / 2.5));
  if (a.beam) a.beam.material.opacity = smooth((v - 0.6) / 2.4);
  // 扉が開いていたら閉じる（エピローグに入った時の開きから）
  setDoor(a, a.doorAtEpi * (1 - smooth(v / 0.8)));
}
