// 小向クエスト2 ゴールデンエイジ編 — 第3章 GR社編「古い会議室」（ボス戦の場面 g2_gr_kaigi）
//
// GR社プロマネとの会議。英語で話し、代理店（商社）が同席する。会議に入れるのは英語が分かる自機だけで、
// 同期と主担当はガラスの外の廊下から見ている——見えているのに、入ってこられない。
//
// 間取り（ワールドの x。W=600 のとき）:
//   〜GX(=W−89)   廊下（外）。古い工場へ通じる鉄の両開き扉（網入りの小窓から工場の黄色い灯り）、
//                 保護帽の棚と長椅子（棚の帽子は同期と主担当の部署の色。残っている同期の分だけ）、
//                 消火器、打刻機とタイムカード差し、掲示板、工場をのぞく網入りガラスの窓、古い放熱器
//   GX           帯を縦に横切るガラスの仕切り。細い枠と、ごく薄い板と、閉じたガラス戸（見た目だけ）
//   GX〜XE(=W+26) 会議室（内）。褪せた黄土〜茶の木の腰壁と黄ばんだ漆喰。古い会議机を挟んで、
//                 奥がGR社の席（からし色のビニール張りの回転椅子、右端にボスの背の高い革椅子）、
//                 手前がこちらの席（硬い折りたたみ椅子。代理店の席だけは回転椅子で、辞書と黄色い便箋と鞄）。
//                 机の上に OHP と壊れた試作品（不良札）、会議電話、ドーナツの箱。壁に巻き上げ式のスクリーン、
//                 半分下ろした古いブラインドの窓、コーヒーメーカーのサイドボード、掛け時計、古い空調、
//                 隅に書類棚とブラウン管テレビの台車
//   XE           右の突き当たりの壁（自機は W−13 までしか行けないので帯にはかからない）
// ボス戦の始まり: 自機 x≈W−73、代理店 W−50、ボス W−20。見物の4人は W−123〜W−99 の帯の奥（z≈−22）。
//
// 出来事:
//   tick      … 掛け時計（会議が長引く。ゲームの1秒で1分）、窓の外が夕方から夜へ、
//               OHP のスライドが替わる・埃が舞う、古い蛍光灯がときどき瞬く、会議電話の灯り
//   bossStart … OHP のランプが瞬いてから点く（会議が始まる）
//   letter    … 社長宛レターを出した → 机の会議電話が赤く点滅する（上から電話が来る）
//   defeated  … OHP が消える（会議が終わる）
//
// 作法は render3d.js の本編の場面と同じ。歩行帯 z=−25〜+25 には床の模様と仕切りの細い枠しか置かない。
// 手前ゾーンは遮蔽の線より低い物だけ。文字・ロゴ・社章・旗・地名は描かない（看板・名札は無地）。
// 描画の数: 動かない物はまとめ描き（照らされる物・自分で光る物・窓の外・ガラス）で数回にし、
// 1つずつ描くのは動く物（時計の針・OHP の光とスライド・光の筋・埃・会議電話の灯り）だけ。
import { THREE, S, wx, wz, box, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, chair, fireRow, scene, hemi, sun, fill, ROOM } from '../../../game3d/src/render3d.js';

// ===== 色 =====
// 廊下は冷えた灰緑の塗り（ブロック積み）、会議室は褪せた黄土〜茶の木と黄ばんだ漆喰。
// 椅子はからし色のビニール（古い会議室の定番）、ボスの椅子だけ暗い牛血色の革。
const C = {
  bg: '#3b3830',
  // 廊下
  cWall: '#a3ab98', cLine: '#959d8a', cDado: '#6b7262', cDadoLine: '#5f6656', cBase: '#3a3933',
  cFloor: '#8e8874', cTile: '#7f7966', cTileDk: '#76705d', cTileLt: '#99927d', cScuff: '#837d6b',
  steel: '#5d665f', steelDk: '#3c423d', door: '#66716a', doorDk: '#4d5751', kick: '#8d8d86',
  // 会議室
  plaster: '#c4b894', plasterLt: '#cdc2a0', plasterDk: '#b3a682', stain: '#a89a74',
  wood: '#8a6a40', woodDk: '#6a512f', woodLt: '#9b7b4c', rail: '#5e4729', baseDk: '#46351f',
  carpet: '#4d5651', carpetLt: '#57605a', carpetDk: '#48504b', carpetSeam: '#3f4642', carpetDot: '#555e58',
  ceil: '#9f998a',
  frame: '#4a453c',                  // 仕切りの枠（古いブロンズ色のアルミ）
  glass: '#c6dbd2',
  tableTop: '#6b4d31', tableEdge: '#4b3621', table: '#5a4129', grain: '#61462c',
  vinyl: '#a8873a', vinylDk: '#8a6d2c', metal: '#3f3e3a', chrome: '#9c9b94',
  boss: '#5b2b22', bossDk: '#401c16',
  fold: '#7c807e', foldDk: '#4f5351',
  paper: '#ebe7da', paperB: '#e2ddcb', cup: '#eeece2',
  ohp: '#bcb5a2', ohpDk: '#3a3936',
  proto: '#69777b', protoDk: '#394144', protoLt: '#8f9a9b', tag: '#c03a2b',
  cabinet: '#a39c85', cabinetDk: '#8a836d', card: '#a3875a',
  screen: '#e3dece', screenDk: '#2a2826',
  blind: '#d0c7aa', blindDk: '#b4ab8d',
  win: '#8f8c80',
};
const BINDER = ['#2f4a6a', '#7a3a2e', '#4a6a43', '#8a7838', '#5c4a63', '#40625f'];
// 保護帽の色（同期と主担当の部署の色。game2/src/stages2.js の PALETTES2 と同じ）
const HAT = { douki_sekkei: '#4a7ad0', douki_genba: '#44507a', douki_hinsho: '#9a6ad0', shutantou: '#40b0a8' };

// 決まった乱数（建て直しても同じ部屋になるように）
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ===== まとめ描き =====
// boxBatch と同じ考え（頂点カラーで1メッシュ）。回転（rx→rz→ry の順に、その物の中心で回す）と円柱・球・輪も混ぜる。
function batch() {
  const L = { cast: [], plain: [] };
  const api = {
    geo(g, color, x, y, z, o = {}) {
      if (o.rx) g.rotateX(o.rx);
      if (o.rz) g.rotateZ(o.rz);
      if (o.ry) g.rotateY(o.ry);
      g.translate(x, y, z);
      (o.cast ? L.cast : L.plain).push([g, color]);
      return api;
    },
    box(w, h, d, color, x, y, z, o) { return api.geo(new THREE.BoxGeometry(w, h, d), color, x, y, z, o); },
    // 円柱（軸は y）。r は下の半径、o.r2 で上の半径
    cyl(r, h, color, x, y, z, o = {}) {
      return api.geo(new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 12), color, x, y, z, o);
    },
    count() { return L.cast.length + L.plain.length; },
    // mat は照らされる・照らされない・半透明のどれでもよい。作ったメッシュを返す
    done(mat, receive = true) {
      const out = [];
      for (const kind of ['cast', 'plain']) {
        const list = L[kind];
        if (!list.length) continue;
        const m = new THREE.Mesh(merge(list), out.length ? mat.clone() : mat);
        m.castShadow = kind === 'cast';
        m.receiveShadow = receive;
        m.matrixAutoUpdate = false; m.updateMatrix();
        addScenery(m);
        out.push(m);
      }
      L.cast.length = 0; L.plain.length = 0;
      return out;
    },
  };
  return api;
}
function merge(list) {
  let nv = 0, ni = 0;
  for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const idx = new Uint32Array(ni);
  const c = new THREE.Color();
  let v = 0, k = 0;
  for (const [g, color] of list) {
    c.set(color);   // ColorManagement が効いているので linear。頂点カラーにそのまま入れてよい
    const P = g.attributes.position, N = g.attributes.normal, n = P.count;
    for (let i = 0; i < n; i++) {
      const j = (v + i) * 3;
      pos[j] = P.getX(i); pos[j + 1] = P.getY(i); pos[j + 2] = P.getZ(i);
      nor[j] = N.getX(i); nor[j + 1] = N.getY(i); nor[j + 2] = N.getZ(i);
      col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[k++] = v + g.index.getX(i);
    else for (let i = 0; i < n; i++) idx[k++] = v + i;
    v += n;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// 家具の部品を「家具の向き ry」で回した位置に置く（家具は手前 +z を向いた形で書く）
function placer(B, x, z, ry, base = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return (w, h, d, color, lx, ly, lz, o = {}) => {
    B.box(w, h, d, color, x + lx * c + lz * s, ly, z - lx * s + lz * c, { ...base, ...o, ry: ry + (o.ry || 0) });
  };
}

// からし色のビニール張りの回転椅子（GR社の椅子。代理店の席も同じ）。arms=false は肘掛けなし
function swivelChair(B, x, z, ry, cast = true, arms = true) {
  const P = placer(B, x, z, ry, { cast });
  P(6.4, 1.4, 6.0, C.vinyl, 0, 5.5, 0.2);
  P(6.0, 0.5, 5.6, C.vinylDk, 0, 4.6, 0.2);
  P(6.2, 7.0, 1.3, C.vinyl, 0, 10.6, -3.0, { rx: -0.1 });            // 背もたれ
  P(5.6, 6.2, 0.5, C.vinylDk, 0, 10.5, -3.75, { rx: -0.1 });         // 背の殻
  P(6.3, 0.35, 0.4, C.vinylDk, 0, 11.2, -2.25, { rx: -0.1 });        // 縫い目
  P(1.2, 3.0, 0.8, C.metal, 0, 6.4, -3.3);
  if (arms) for (const sx of [-1, 1]) {
    P(0.7, 0.6, 4.6, C.metal, sx * 3.45, 8.3, 0.0);                  // 肘掛け
    P(0.6, 2.4, 0.6, C.metal, sx * 3.45, 7.0, -1.7);
  }
  P(1.0, 4.0, 1.0, C.chrome, 0, 2.6, 0.2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    P(4.2, 0.5, 0.8, C.metal, Math.cos(a) * 2.1, 0.5, 0.2 + Math.sin(a) * 2.1, { ry: -a });
  }
}

// 硬い鉄の折りたたみ椅子（こちらの席）
function foldingChair(B, x, z, ry, cast = true) {
  const P = placer(B, x, z, ry, { cast });
  P(5.4, 0.5, 5.0, C.fold, 0, 5.3, 0.4);
  P(5.2, 3.2, 0.5, C.fold, 0, 10.2, -2.55);                          // 背板
  for (const sx of [-1, 1]) {
    P(0.45, 12.2, 0.45, C.foldDk, sx * 2.55, 6.1, -2.3, { rx: 0.08 }); // 後ろ脚から背の柱まで1本
    P(0.45, 5.6, 0.45, C.foldDk, sx * 2.45, 2.8, 2.1, { rx: -0.22 });  // 前脚
  }
  P(4.9, 0.35, 0.35, C.foldDk, 0, 1.3, 0.0);
}

// ボスの席: 背の高い牛血色の革椅子。ボタン留めの段と木の肘掛け
function bossChair(B, x, z, ry) {
  const P = placer(B, x, z, ry, { cast: true });
  P(7.8, 1.9, 7.0, C.boss, 0, 6.0, 0.3);
  P(8.0, 14.0, 1.9, C.boss, 0, 14.0, -3.4);                          // 背（y 7〜21）
  P(7.0, 2.4, 2.0, C.bossDk, 0, 21.6, -3.5);                         // 頭の巻き
  for (let k = 0; k < 3; k++) P(7.2, 0.3, 0.3, C.bossDk, 0, 10.6 + k * 3.3, -2.4);   // 段の縫い目
  for (let k = 0; k < 3; k++) for (const sx of [-2, 0, 2]) P(0.5, 0.5, 0.3, C.bossDk, sx, 12.2 + k * 3.3, -2.35);   // ボタン
  for (const sx of [-1, 1]) {
    P(1.1, 0.9, 6.4, C.woodDk, sx * 4.3, 9.4, 0.0);                  // 木の肘掛け
    P(0.8, 3.0, 0.8, C.woodDk, sx * 4.3, 7.6, 2.4);
    P(0.8, 3.0, 0.8, C.woodDk, sx * 4.3, 7.6, -2.0);
  }
  P(1.3, 4.4, 1.3, C.chrome, 0, 2.8, 0.2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    P(5.0, 0.6, 1.0, C.metal, Math.cos(a) * 2.5, 0.5, 0.2 + Math.sin(a) * 2.5, { ry: -a });
  }
}

// 保護帽（棚の上や机の上に置く）。つばを手前に向ける
function hardHat(B, x, y, z, color, ry = 0) {
  const dome = new THREE.SphereGeometry(1.75, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  B.geo(dome, color, x, y + 0.2, z, { ry });
  B.cyl(2.1, 0.28, color, x, y + 0.2, z, { seg: 14 });
  const P = placer(B, x, z, ry);
  P(2.6, 0.26, 1.4, color, 0, y + 0.28, 2.3);                       // 前のつば
  P(0.5, 0.45, 3.4, color, 0, y + 1.85, 0);                          // 頭の筋
}

// 鉄の両開き扉（工場へ）。網入りの小窓の向こうに工場の黄色い灯り
function factoryDoor(B, U, x, BACK) {
  const z = BACK;
  B.box(1.4, 25.4, 1.2, C.steelDk, x - 10.7, 12.7, z + 0.6);
  B.box(1.4, 25.4, 1.2, C.steelDk, x + 10.7, 12.7, z + 0.6);
  B.box(22.8, 1.4, 1.2, C.steelDk, x, 25.7, z + 0.6);
  for (const s of [-1, 1]) {
    const dx = x + s * 5.0;
    B.box(9.9, 24.6, 0.5, C.door, dx, 12.3, z + 0.45);
    B.box(9.6, 2.6, 0.14, C.kick, dx, 1.5, z + 0.77);                  // 蹴り板
    B.box(8.2, 0.9, 0.8, '#a3a59e', dx, 10.2, z + 1.15);               // 押し棒
    for (const e of [-1, 1]) B.box(0.8, 1.6, 0.8, C.steelDk, dx + e * 4.4, 10.2, z + 0.95);
    // 網入りの小窓
    B.box(4.4, 7.4, 0.2, C.steelDk, dx, 17.6, z + 0.75);
    U.box(3.4, 6.4, 0.1, '#a58a55', dx, 17.6, z + 0.86);
    for (const k of [-0.85, 0.85]) B.box(0.12, 6.4, 0.06, '#4a4436', dx + k, 17.6, z + 0.94);
    for (const k of [-2, 0, 2]) B.box(3.4, 0.12, 0.06, '#4a4436', dx, 17.6 + k, z + 0.94);
  }
  B.box(0.3, 24.6, 0.6, '#2c302c', x, 12.3, z + 0.5);                  // 合わせ目
  B.box(5.0, 1.2, 1.4, C.steelDk, x - 5.2, 23.9, z + 1.1);            // ドアクローザ
  B.box(3.4, 0.4, 0.4, C.steelDk, x - 3.6, 23.2, z + 1.5, { ry: 0.3 });
  // 扉の上の札（無地の板＋色の棒）
  B.box(10, 2.6, 0.4, '#e4dfcf', x, 28.4, z + 0.2);
  B.box(8.0, 0.8, 0.1, '#d9b02e', x, 28.8, z + 0.45);
  B.box(5.6, 0.4, 0.1, '#2a2826', x, 27.7, z + 0.45);
  // 扉の前の床の黄黒（工場の区域）
  for (let i = 0; i < 11; i++) B.box(2.0, 0.06, 3.6, i % 2 ? '#2d2b27' : '#cfa92e', x - 10 + i * 2, 0.04, z + 2.6);
}

// 壁掛けの消火器と赤い札
function extinguisher(B, x, BACK) {
  const z = BACK;
  B.box(2.0, 0.6, 1.6, C.steelDk, x, 5.4, z + 0.8);
  B.cyl(1.2, 6.2, '#b3302a', x, 8.4, z + 1.7, { seg: 12 });
  B.cyl(0.8, 0.8, '#b3302a', x, 11.9, z + 1.7, { seg: 10, r2: 0.5 });
  B.box(1.0, 1.0, 1.0, '#2c2a28', x, 12.6, z + 1.7);
  B.box(2.0, 0.3, 0.5, '#2c2a28', x + 0.6, 13.2, z + 1.7, { rz: 0.2 });
  B.box(0.3, 4.2, 0.3, '#2c2a28', x - 1.3, 10.6, z + 2.4, { rz: 0.15 });   // ホース
  B.box(3.2, 2.6, 0.3, '#c0352c', x, 16.2, z + 0.15);
  B.box(2.2, 0.5, 0.1, '#efe9dc', x, 16.2, z + 0.35);
}

// 古い鋳物の放熱器（窓の下）
function radiator(B, x0, x1, z, h = 8.2, color = '#b4ac96') {
  const n = Math.floor((x1 - x0) / 1.1);
  for (let i = 0; i <= n; i++) B.box(0.62, h, 2.4, color, x0 + i * 1.1, 0.8 + h / 2, z);
  B.box(x1 - x0 + 0.8, 0.7, 1.4, '#8f887a', (x0 + x1) / 2, 1.6, z);
  B.box(x1 - x0 + 0.8, 0.7, 1.4, '#8f887a', (x0 + x1) / 2, h - 0.2, z);
  for (let i = 0; i < 4; i++) B.box(0.65, 0.8 + rnd(x0 + i) * 1.6, 0.1, '#7a5034', x0 + 2 + rnd(x0 * 3 + i) * (x1 - x0 - 4), 2 + rnd(i + x1) * 5, z + 1.25);   // 錆
}

// 工場をのぞく網入りガラスの窓（廊下）。向こうは暗い工場と灯り
function factoryWindow(B, U, x0, x1, BACK) {
  const z = BACK, xm = (x0 + x1) / 2, w = x1 - x0;
  U.box(w, 16, 0.1, '#6c5d41', xm, 21, z + 0.1);                      // 向こうの工場（暗い黄土）
  for (let i = 0; i < 4; i++) {                                         // 機械の影
    const mx = x0 + 4 + i * (w - 8) / 3, mh = 3 + rnd(x0 + i) * 3;
    U.box(5 + rnd(i + x0) * 4, mh, 0.06, '#47402f', mx, 13 + mh / 2, z + 0.16);
  }
  U.box(w, 1.2, 0.06, '#4f4734', xm, 27.4, z + 0.16);                  // 向こうの梁
  for (const k of [0.25, 0.75]) U.box(2.2, 0.8, 0.06, '#e7cf8e', x0 + w * k, 25.6, z + 0.2);   // 高天井灯
  for (let x = x0 + 2.4; x < x1 - 0.5; x += 2.4) B.box(0.1, 16, 0.06, '#3b3a33', x, 21, z + 0.3);
  for (let y = 15; y < 29; y += 2.4) B.box(w, 0.1, 0.06, '#3b3a33', xm, y, z + 0.3);
  B.box(w + 2.4, 1.3, 1.4, C.steel, xm, 29.6, z + 0.7);
  B.box(w + 2.4, 1.0, 2.4, C.steel, xm, 12.6, z + 1.2);
  for (const x of [x0 - 0.6, x1 + 0.6]) B.box(1.2, 17.6, 1.4, C.steel, x, 21, z + 0.7);
  for (let k = 1; k < 3; k++) B.box(0.9, 16, 1.0, C.steel, x0 + (w * k) / 3, 21, z + 0.55);
}

// 掲示板（コルク。紙は無地の色だけ）
function noticeBoard(B, x, y, BACK, seed) {
  const z = BACK;
  B.box(22.4, 13.4, 0.5, '#5e4b33', x, y, z + 0.25);
  B.box(21.2, 12.2, 0.3, '#a5814f', x, y, z + 0.45);
  const cols = ['#efeadb', '#e8d78a', '#d9e3ea', '#f0c8c0', '#efeadb', '#dfe8cf'];
  for (let i = 0; i < 7; i++) {
    const w = 3.2 + rnd(seed + i) * 2.4, h = 3.6 + rnd(seed * 3 + i) * 2.4;
    const px = x - 8 + (i % 4) * 5.2 + rnd(seed + i * 7) * 1.2, py = y + (i < 4 ? 2.6 : -2.8) + rnd(seed * 5 + i) * 0.8;
    B.box(w, h, 0.1, cols[i % cols.length], px, py, z + 0.66 + i * 0.03, { rz: (rnd(seed + i * 11) - 0.5) * 0.18 });
    B.box(0.45, 0.45, 0.25, i % 2 ? '#c0352c' : '#2f5a8f', px, py + h / 2 - 0.6, z + 0.95 + i * 0.03);
    if (h > 4.4) for (let k = 0; k < 3; k++) B.box(w * 0.6, 0.16, 0.05, '#9a9384', px, py + 0.8 - k * 0.9, z + 0.74 + i * 0.03, { rz: (rnd(seed + i * 11) - 0.5) * 0.18 });
  }
}

// 廊下の長椅子（背なし。木の座板に鉄の脚）
function bench(B, x, z, len, cast = true) {
  for (let k = 0; k < 3; k++) B.box(len, 0.7, 1.4, '#8a6c44', x, 5.2, z - 1.6 + k * 1.6, { cast });
  for (const s of [-1, 1]) {
    B.box(0.8, 4.9, 4.4, C.steelDk, x + s * (len / 2 - 2), 2.45, z, { cast });
    B.box(1.2, 0.4, 5.0, C.steelDk, x + s * (len / 2 - 2), 0.2, z);
  }
}

// 動く物。build のたびに作り直す（前の章のメッシュを掴んだままにしない）
let A = null;

export function build(W, halfD, ctx) {
  A = null;
  ctx = ctx || {};
  const { BACK, FRONT } = zones(halfD, 38, 66);        // 奥 −66 / 手前 94

  // ===== 光 =====
  // 第3章（坂 0.4）。待合室・古い工場と同じく春より一段冷えて暗い。ここは古い蛍光灯の、
  // わずかに黄緑がかった白で、天井の低い部屋らしく少し暗く落とす（影の向きはどの場面も同じ）
  setLighting(false);
  hemi.color.set('#dde2d0'); hemi.groundColor.set('#585547'); hemi.intensity = 1.5;
  sun.color.set('#efe9d3'); sun.intensity = 0.74;
  fill.intensity = 0.86;                               // fill の色は他の場面が戻さないので触らない
  scene.background = hex(C.bg);
  scene.fog = new THREE.Fog(hex(C.bg), 270, 820);

  const GX = W - 89;                    // ガラスの仕切り（ワールド x）
  const XE = W + 26;                    // 右の突き当たりの壁の面
  const XL = -150, XR = W + 150;        // 開始のカメラは左へ −100 あたり、右端に寄ると W+90 あたりまで見える
  const FZ = 40;                        // 天井と仕切りの手前の端（ceilingSlab と同じ）
  const ZC = (FZ + BACK) / 2, ZL = FZ - BACK;

  const B = batch();    // 照らされる・動かない物（影を落とすのは cast を付けた奥の大物だけ）
  const U = batch();    // 自分で光る面（工場の灯り・投影の光・ランプ）
  const O = batch();    // 窓の外（夕方へ向けて色を変える）
  const G = batch();    // ガラス（半透明）
  const Gs = batch();   // ガラスの映り込み（斜めの白い筋）

  // ===== 床 =====
  // 廊下: すり減ったビニルタイル（目地の格子と、ところどころ色の違う貼り替え）
  B.box(GX - XL, 2, FRONT - BACK, C.cFloor, (XL + GX) / 2, -1, (FRONT + BACK) / 2);
  for (let x = XL + 6, i = 0; x < GX; x += 6, i++) B.box(0.14, 0.05, FRONT - BACK, C.cTile, x, 0.025, (FRONT + BACK) / 2);
  for (let z = BACK + 6; z < FRONT; z += 6) B.box(GX - XL, 0.05, 0.14, C.cTile, (XL + GX) / 2, 0.025, z);
  for (let i = 0, x = XL + 3; x < GX - 2; x += 6, i++) {
    for (let j = 0, z = BACK + 3; z < FRONT - 2; z += 6, j++) {
      const r = rnd(i * 31 + j * 7);
      if (r < 0.045) B.box(5.8, 0.03, 5.8, C.cTileDk, x, 0.015, z);
      else if (r > 0.95) B.box(5.8, 0.03, 5.8, C.cTileLt, x, 0.015, z);
    }
  }
  // 帯の中ほどがすり減って白っぽい（人が歩く筋）
  B.box(GX - XL, 0.012, 16, C.cScuff, (XL + GX) / 2, 0.006, -2);

  // 会議室: 古いカーペット。すり減った筋・継ぎ目・コーヒーの染み
  B.box(XR - GX, 2, FRONT - BACK, C.carpet, (GX + XR) / 2, -1, (FRONT + BACK) / 2);
  B.box(XE - GX, 0.03, 20, C.carpetLt, (GX + XE) / 2, 0.015, -1);
  // 業務用カーペットの小さな市松の柄（ごく薄く。広い床が一色の板に見えないように）
  for (let j = 0, z = BACK + 2.5; z < FRONT; z += 4.5, j++) {
    for (let x = GX + 2.5 + (j % 2) * 2.25; x < XE - 0.5; x += 4.5) B.box(0.9, 0.03, 0.9, C.carpetDot, x, 0.03, z);
  }
  for (const z of [-26.5, 26.5]) B.box(XR - GX, 0.04, 0.3, C.carpetSeam, (GX + XR) / 2, 0.035, z);
  for (let i = 0; i < 6; i++) {
    const sx = GX + 10 + rnd(i * 13) * (XE - GX - 20), sz = -22 + rnd(i * 17 + 5) * 44, r = 0.7 + rnd(i * 3) * 0.9;
    B.cyl(r, 0.03, C.carpetDk, sx, 0.05, sz, { seg: 10 });
  }
  // 仕切りの下の見切り
  B.box(1.8, 0.1, FRONT - BACK, '#76736a', GX, 0.05, (FRONT + BACK) / 2);

  // ===== 奥の壁 =====
  // 廊下の壁: 塗ったブロック積み（下は濃い色の腰）。目地は横の線、扉のまわりだけ縦の目地も
  B.box(GX - XL, 64, 2, C.cWall, (XL + GX) / 2, 32, BACK - 1);
  B.box(GX - XL, 9, 0.3, C.cDado, (XL + GX) / 2, 4.5, BACK + 0.15);
  B.box(GX - XL, 0.5, 0.5, '#58604f', (XL + GX) / 2, 9.1, BACK + 0.25);
  B.box(GX - XL, 1.2, 0.6, C.cBase, (XL + GX) / 2, 0.6, BACK + 0.3);
  for (let y = 2.2, r = 0; y < 46; y += 2.2, r++) {
    if (Math.abs(y - 9.1) < 0.4) continue;
    B.box(GX - XL, 0.22, 0.06, y < 9 ? C.cDadoLine : C.cLine, (XL + GX) / 2, y, BACK + (y < 9 ? 0.33 : 0.03));
    // 縦の目地（ボス戦のカメラに映る範囲だけ）
    for (let x = GX - 150 + (r % 2) * 2.2; x < GX - 1; x += 4.4) {
      B.box(0.2, 2.0, 0.06, y < 9 ? C.cDadoLine : C.cLine, x, y + 1.1, BACK + (y < 9 ? 0.33 : 0.03));
    }
  }

  // 会議室の壁: 黄ばんだ漆喰に、褪せた黄土〜茶の木の腰壁
  B.box(XE + 2 - GX, 64, 2, C.plaster, (GX + XE + 2) / 2, 32, BACK - 1);
  const wainscot = (x0, x1) => {
    const xm = (x0 + x1) / 2, w = x1 - x0;
    B.box(w, 11.5, 0.6, C.wood, xm, 5.75, BACK + 0.3);
    for (let x = x0 + 3.5; x < x1 - 1; x += 7) B.box(0.7, 10.6, 0.3, C.woodDk, x, 5.6, BACK + 0.72);
    for (let x = x0 + 7; x < x1 - 1; x += 7) B.box(5.6, 0.12, 0.05, C.woodLt, x - 3.5, 3.2 + rnd(x) * 6, BACK + 0.63);   // 木目
    B.box(w, 1.0, 1.0, C.rail, xm, 12.0, BACK + 0.5);                 // 腰の見切り
    B.box(w, 1.0, 0.9, C.baseDk, xm, 0.5, BACK + 0.45);               // 幅木
  };
  wainscot(GX + 0.6, XE);
  B.box(XE - GX, 0.8, 0.7, C.woodDk, (GX + XE) / 2, 35.6, BACK + 0.35);   // 長押（額を吊る桟）
  // 額を外した跡（そこだけ日に焼けていない）と、雨漏りの染み
  B.box(5.6, 4.6, 0.06, C.plasterLt, GX + 7.5, 30.4, BACK + 0.04);
  B.box(0.3, 0.3, 0.3, '#3a3630', GX + 7.5, 32.9, BACK + 0.2);
  B.box(14, 3.5, 0.06, C.plasterDk, W - 78, 38.2, BACK + 0.04);

  // 天井（手前は z=40 で切る）。本編の ceilingSlab に、左右の延長を足す
  ceilingSlab(W, halfD, BACK, C.ceil, 47);
  B.box(-40 - XL, 2, ZL, C.ceil, (XL - 40) / 2, 47, ZC);
  B.box(XR - W - 40, 2, ZL, C.ceil, (W + 40 + XR) / 2, 47, ZC);

  // 右の突き当たりの壁（帯にはかからない: 自機・ボスは W−13 まで）。
  // 天井の端（z=40）で切ると、右端へ寄ったカメラから壁の向こうの何も無い所が見えるので、
  // 手前は画面の外（z=FRONT+20）まで伸ばす。どのキャラよりも右にあるので、人を隠すことはない
  const EZ1 = FRONT + 20;
  B.box(2, 64, EZ1 - BACK, C.plaster, XE + 1, 32, (EZ1 + BACK) / 2);
  {
    const seg = (z0, z1) => {
      const zm = (z0 + z1) / 2, d = z1 - z0;
      B.box(0.6, 11.5, d, C.wood, XE - 0.3, 5.75, zm);
      for (let z = z0 + 3.5; z < z1 - 1; z += 7) B.box(0.3, 10.6, 0.7, C.woodDk, XE - 0.72, 5.6, z);
      B.box(1.0, 1.0, d, C.rail, XE - 0.5, 12.0, zm);
      B.box(0.9, 1.0, d, C.baseDk, XE - 0.45, 0.5, zm);
    };
    seg(BACK, -51.2); seg(-34.8, EZ1);
    // GR社の事務所へ通じる木の扉
    B.box(0.5, 24, 13, '#6c4f30', XE - 0.3, 12, -43);
    for (const [y, h] of [[17.5, 9], [6.2, 8]]) B.box(0.2, h, 9.6, '#5a4127', XE - 0.62, y, -43);
    B.box(1.0, 25.4, 1.2, C.woodDk, XE - 0.5, 12.7, -50.2);
    B.box(1.0, 25.4, 1.2, C.woodDk, XE - 0.5, 12.7, -35.8);
    B.box(1.0, 1.4, 15.6, C.woodDk, XE - 0.5, 25.1, -43);
    B.box(1.4, 0.9, 0.9, '#b8963e', XE - 1.0, 11.5, -38.2);           // 真鍮のノブ
    // 額（古い製品の写真。文字なし）
    B.box(0.5, 10, 13, '#3e3226', XE - 0.25, 21.5, -12);
    B.box(0.2, 8.4, 11.4, '#d9d2bd', XE - 0.55, 21.5, -12);
    B.box(0.1, 4.0, 6.0, '#77806f', XE - 0.7, 20.6, -12);
    B.box(0.1, 1.2, 2.2, '#5b6356', XE - 0.75, 23.2, -10.4);
    B.box(0.3, 1.8, 1.2, '#e8e2cf', XE - 0.15, 13.2, -31);            // スイッチの板
    // 手前寄り: 古い壁掛け電話（巻いた線）・丸い温度調節器・升目だけの暦・赤い火災報知器
    B.box(1.0, 4.6, 2.4, '#cdc5ad', XE - 0.5, 15.0, 6);
    B.box(1.2, 1.0, 3.2, '#bdb59c', XE - 1.0, 17.0, 6);
    B.box(0.3, 5.0, 0.3, '#8f8870', XE - 1.2, 10.6, 5.3);
    B.cyl(1.1, 0.5, '#d6d0bd', XE - 0.25, 15.2, -2.5, { rz: Math.PI / 2, seg: 16 });
    B.cyl(0.6, 0.2, '#8f8a78', XE - 0.55, 15.2, -2.5, { rz: Math.PI / 2, seg: 12 });
    B.box(0.2, 13, 9, '#ebe6d6', XE - 0.1, 20.5, 22);
    B.box(0.1, 5.2, 8.2, '#8a9a8a', XE - 0.25, 24.0, 22);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
      B.box(0.06, 0.9, 0.95, (r === 3 && c > 3) || (r === 4 && c < 2) ? '#c4473a' : '#cfc9b6', XE - 0.24, 19.6 - r * 1.25, 22 - 3.4 + c * 1.13);
    }
    B.box(0.8, 2.6, 2.0, '#b8322a', XE - 0.4, 14.6, 33);
    B.box(0.2, 0.8, 1.2, '#efe9dc', XE - 0.85, 15.0, 33);
  }

  // ===== ガラスの仕切り（帯を縦に横切る。見た目だけの細い枠と、ごく薄い板）=====
  {
    B.box(1.4, 0.5, ZL, C.frame, GX, 0.25, ZC);                        // 下の枠
    B.box(1.4, 1.2, ZL, C.frame, GX, 45.4, ZC);                        // 上の枠（天井の下）
    // 欄間の桟（戸の高さ）と縦の枠は、奥の角から戸までだけ。戸より手前（カメラ側）に縦の枠や桟を
    // 入れると、ボス戦の始まりのカメラから見て、ガラスの外で見ている同期と主担当に重なる
    B.box(1.0, 0.8, 8 - BACK, C.frame, GX, 29.6, (8 + BACK) / 2);
    for (const z of [BACK + 0.6, -42, -6.5, 7.5]) B.box(z === BACK + 0.6 ? 1.4 : 0.9, 45, 0.9, C.frame, GX, 22.6, z);
    // 閉じたガラス戸（帯のまん中）。取っ手は内と外の両側に
    B.box(1.1, 2.4, 13.4, C.frame, GX, 1.2, 0.5);                      // 戸の下框
    B.box(1.1, 0.9, 13.4, C.frame, GX, 28.9, 0.5);                     // 戸の上框
    for (const s of [-1, 1]) {
      B.box(0.35, 7.6, 0.35, C.chrome, GX + s * 1.2, 12.6, 4.6);       // 縦の取っ手
      for (const y of [9.4, 15.8]) B.box(1.0, 0.3, 0.3, C.chrome, GX + s * 0.75, y, 4.6);
    }
    B.box(1.4, 1.2, 5.0, C.frame, GX + 1.2, 27.7, 2.0);                // ドアクローザ（部屋の側）
    // 上に巻き上げたままのブラインド（部屋の側。下ろせば中が見えなくなるが、下ろされていない）
    B.box(1.3, 2.4, 7 - BACK, C.blind, GX + 1.1, 43.4, (7 + BACK) / 2);
    B.box(1.5, 0.5, 7 - BACK, C.blindDk, GX + 1.15, 42.0, (7 + BACK) / 2);
    // ガラス（1枚にまとめる）と、斜めの映り込み
    G.box(0.16, 44.4, ZL - 1.2, C.glass, GX, 22.9, ZC);
    for (const [y, z, len] of [[33, -50, 22], [21, -18, 30], [36, 16, 18], [24, -40, 12]]) {
      Gs.box(0.1, 1.4, len, '#ffffff', GX + 0.14, y, z, { rx: 0.62 });
      Gs.box(0.1, 0.5, len * 0.7, '#ffffff', GX + 0.14, y - 1.9, z + 1.4, { rx: 0.62 });
    }
  }

  // ===== 廊下の奥: 繰り返しの区画（ボス戦では左へ戻ったときだけ映る）=====
  let modEnd = XL;
  for (let i = 0, x0 = XL + 10; x0 + 140 <= GX - 190; x0 += 140, i++) {
    modEnd = x0 + 126;
    factoryWindow(B, U, x0 + 6, x0 + 42, BACK);
    radiator(B, x0 + 9, x0 + 39, BACK + 1.8);
    if (i % 2) { bench(B, x0 + 66, BACK + 3.6, 24); noticeBoard(B, x0 + 66, 19, BACK, 40 + i); }
    else {
      // 水飲み器
      B.box(5.4, 3.2, 4.2, '#c9c6bb', x0 + 66, 10.2, BACK + 2.1);
      B.box(4.6, 0.4, 3.4, '#8f9196', x0 + 66, 11.9, BACK + 2.3);
      B.box(0.5, 0.9, 0.5, '#8f9196', x0 + 67.4, 12.5, BACK + 2.6);
      B.box(4.0, 5.6, 1.2, '#b5b2a7', x0 + 66, 5.6, BACK + 0.6);
      noticeBoard(B, x0 + 66, 22, BACK, 70 + i);
    }
    factoryDoor(B, U, x0 + 104, BACK);
    extinguisher(B, x0 + 122, BACK);
    // 帯の外の奥に、戻ってきた荷（不良札のついた木箱）
    if (i % 2 === 0) {
      B.box(9, 6, 7, C.card, x0 + 88, 3, BACK + 18, { cast: true });
      B.box(1.4, 2.0, 0.1, C.tag, x0 + 90, 4, BACK + 21.6);
    }
  }
  // 区画の残り（窓だけ。章の幅が違って最後の区画と重なるときは置かない）
  if (GX - 226 > modEnd) {
    factoryWindow(B, U, GX - 225, GX - 189, BACK);
    radiator(B, GX - 222, GX - 192, BACK + 1.8);
  }

  // ===== 廊下の奥: 仕切りのそば（ボス戦のカメラに映る）=====
  // 掲示板・打刻機とタイムカード差し・戻り品の台車・工場への扉・消火器・保護帽の棚と長椅子
  noticeBoard(B, GX - 160, 19, BACK, 7);
  {
    const px = GX - 112;                                              // 打刻機
    B.box(5.2, 7.2, 3.4, '#bdb5a0', px, 15.6, BACK + 1.7);
    B.cyl(1.9, 0.3, '#ecead8', px, 16.8, BACK + 3.45, { rx: Math.PI / 2, seg: 16 });
    B.box(0.2, 1.4, 0.1, '#2a2826', px, 17.4, BACK + 3.65);
    B.box(1.1, 0.2, 0.1, '#2a2826', px + 0.5, 16.8, BACK + 3.65);
    B.box(3.6, 0.6, 0.6, '#3a3834', px, 13.0, BACK + 3.3);             // カードの差し口
    for (const side of [-1, 1]) {                                      // タイムカード差し
      const rx = px + side * 8.6;
      B.box(6.6, 13, 1.2, '#7e8279', rx, 15.5, BACK + 0.6);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) {
        if (rnd(r * 9 + c * 5 + side * 3) < 0.15) continue;           // 抜けている＝まだ工場にいる人
        B.box(1.2, 2.2, 0.25, rnd(r + c * 13 + side) < 0.12 ? '#e8b9b0' : '#e7e1c7', rx - 2.25 + c * 1.5, 10.6 + r * 1.65 + 0.5, BACK + 1.3);
      }
    }
  }
  // 戻り品の台車（帯の外の奥）
  {
    const cx = GX - 86, cz = -43;
    B.box(16, 0.8, 10, '#5b6158', cx, 2.6, cz, { cast: true });
    for (const [dx, dz] of [[-6.5, -4], [6.5, -4], [-6.5, 4], [6.5, 4]]) B.cyl(1.0, 0.9, '#2a2a28', cx + dx, 1.0, cz + dz, { rx: Math.PI / 2, seg: 10 });
    for (const dz of [-4.4, 4.4]) B.box(0.6, 9, 0.6, '#5b6158', cx + 7.6, 7.3, cz + dz);
    B.box(0.6, 0.6, 9.4, '#5b6158', cx + 7.6, 11.6, cz);
    B.box(7, 5.6, 6.6, C.card, cx - 3.6, 5.8, cz, { cast: true });
    B.box(6, 4.2, 5.4, '#7e6038', cx + 3.2, 5.1, cz + 0.4, { cast: true });
    B.box(5.4, 3.8, 4.4, C.proto, cx - 3.4, 10.5, cz - 0.4, { cast: true });   // 箱から出した試作品（また戻ってきた）
    B.box(5.6, 0.8, 4.6, C.protoDk, cx - 3.4, 12.8, cz - 0.4);
    B.box(1.4, 2.0, 0.1, C.tag, cx - 1.2, 10.2, cz + 1.9);
    B.box(1.4, 2.0, 0.1, C.tag, cx + 3.6, 5.0, cz + 3.15);
  }
  factoryDoor(B, U, GX - 55, BACK);
  extinguisher(B, GX - 40, BACK);
  // 保護帽の棚と、その下の長椅子。棚の帽子は、ガラスの外で待っている人の部署の色
  {
    const hx = GX - 19, hz = BACK + 1.7;
    B.box(28, 0.6, 3.4, '#7a6446', hx, 15, hz);
    for (const dx of [-12, 0, 12]) B.box(0.5, 2.2, 3.0, C.steelDk, hx + dx, 13.6, hz - 0.2);
    const roster = (ctx.stage && ctx.stage.game && Array.isArray(ctx.stage.game.roster))
      ? ctx.stage.game.roster : ['douki_sekkei', 'douki_genba', 'douki_hinsho'];
    const hats = ['#e7e5dc', ...['douki_sekkei', 'douki_genba', 'douki_hinsho'].filter((k) => roster.includes(k)).map((k) => HAT[k])];
    if (!ctx.data || ctx.data.support === 'shutantou') hats.push(HAT.shutantou);
    while (hats.length < 6) hats.push(hats.length % 2 ? '#e7e5dc' : null);
    hats.forEach((c, i) => { if (c) hardHat(B, hx - 11.5 + i * 4.6, 15.3, hz + 0.2, c, (rnd(i + 3) - 0.5) * 0.6); });
    bench(B, hx, BACK + 4.0, 26);
    B.cyl(0.62, 1.9, C.cup, hx + 7, 6.5, BACK + 4.4, { r2: 0.75, seg: 10 });   // 置いていった紙コップ
    B.box(4.2, 0.5, 3.0, C.paperB, hx - 6, 5.8, BACK + 3.6, { ry: 0.2 });
  }

  // ===== 会議室の奥の壁 =====
  // 左: サイドボードとコーヒーメーカー、その上に額と掛け時計
  {
    const sx = GX + 14, sz = BACK + 3.8;
    B.box(24, 9.4, 7.4, '#5e452c', sx, 4.9, sz, { cast: true });
    B.box(24.8, 0.7, 8.0, '#6e5236', sx, 9.95, sz);
    for (let k = 0; k < 4; k++) {
      B.box(5.4, 7.2, 0.2, '#68502f', sx - 9 + k * 6, 5.0, sz + 3.75);
      B.box(0.35, 1.6, 0.35, '#b8963e', sx - 7 + k * 6 - (k % 2) * 4, 5.6, sz + 3.95);
    }
    const ty = 10.3;
    // コーヒーメーカー（黒）と、煮詰まったガラスのポット
    B.box(3.6, 0.9, 4.8, '#2b2927', sx - 8.5, ty + 0.45, sz + 0.4);
    B.box(3.6, 6.4, 1.6, '#2b2927', sx - 8.5, ty + 3.2, sz - 1.4);
    B.box(3.6, 1.4, 4.0, '#2b2927', sx - 8.5, ty + 6.0, sz + 0.2);
    B.cyl(1.2, 2.8, '#3c2a1c', sx - 8.5, ty + 2.3, sz + 1.0, { seg: 12 });
    B.cyl(1.25, 0.8, '#6f6a60', sx - 8.5, ty + 4.0, sz + 1.0, { seg: 12, r2: 1.0 });
    U.box(0.5, 0.4, 0.1, '#ff5a3a', sx - 7.4, ty + 0.5, sz + 2.85);     // 保温の赤い灯り
    // 紙コップの束、砂糖の缶、寝かせたバインダー、枯れかけの鉢
    B.cyl(0.78, 3.8, C.cup, sx - 4.4, ty + 1.9, sz + 0.6, { r2: 0.62, seg: 10 });
    B.cyl(0.9, 1.6, '#b6b0a0', sx - 2.2, ty + 0.8, sz + 1.2, { seg: 10 });
    for (let k = 0; k < 3; k++) B.box(5.4, 1.0, 4.2, BINDER[(k + 1) % BINDER.length], sx + 3.2, ty + 0.5 + k * 1.02, sz + 0.2, { ry: (rnd(k) - 0.5) * 0.25 });
    B.cyl(1.5, 2.6, '#8f5636', sx + 9.4, ty + 1.3, sz + 0.4, { r2: 1.8, seg: 12 });
    for (let k = 0; k < 6; k++) {
      B.box(0.6, 3.6 + rnd(k) * 2, 0.6, k % 2 ? '#7d7a3e' : '#9a8a4a', sx + 9.4 + (rnd(k * 3) - 0.5) * 2, ty + 4.2 + rnd(k) * 1.2, sz + 0.4 + (rnd(k * 5) - 0.5) * 1.6, { rz: (rnd(k * 7) - 0.5) * 1.4, rx: (rnd(k * 9) - 0.5) * 0.8 });
    }
    // 額（古い工場の写真。文字なし）
    B.box(9.6, 7.4, 0.5, '#3e3226', sx - 6.5, 22.6, BACK + 0.25);
    B.box(8.4, 6.2, 0.2, '#cfc6ad', sx - 6.5, 22.6, BACK + 0.55);
    B.box(7.0, 2.6, 0.1, '#8a8678', sx - 6.5, 21.3, BACK + 0.7);
    B.box(1.0, 3.0, 0.1, '#6e6a5e', sx - 4.2, 23.6, BACK + 0.75);
    B.box(7.0, 2.0, 0.1, '#b9c0bf', sx - 6.5, 24.3, BACK + 0.66);
    // 盾（表彰の飾り。真鍮の板は無地）
    B.box(4.4, 5.4, 0.6, '#4e3a24', sx + 3.0, 21.0, BACK + 0.3);
    B.box(3.2, 1.6, 0.12, '#b9984a', sx + 3.0, 21.6, BACK + 0.66);
  }
  // 掛け時計（針は onEvent で回す）
  const CX = GX + 21.5, CY = 28.6, CZ = BACK + 0.5;
  B.cyl(3.1, 0.6, '#262420', CX, CY, CZ, { rx: Math.PI / 2, seg: 24 });
  B.cyl(2.7, 0.2, '#efebdc', CX, CY, CZ + 0.32, { rx: Math.PI / 2, seg: 24 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    B.box(i % 3 ? 0.18 : 0.34, i % 3 ? 0.42 : 0.8, 0.06, '#33302a', CX + Math.sin(a) * 2.2, CY + Math.cos(a) * 2.2, CZ + 0.46, { rz: -a });
  }

  // 中: 巻き上げ式のスクリーン（OHP の光が当たる）
  const SX = W - 42, SZ = BACK + 1.9;
  {
    B.cyl(0.95, 34, '#d6d1c2', SX, 33.9, BACK + 1.3, { rz: Math.PI / 2, seg: 12 });
    for (const s of [-1, 1]) B.box(1.4, 2.4, 2.4, '#4a4640', SX + s * 17.3, 33.9, BACK + 1.3);
    B.box(31, 18.8, 0.12, C.screen, SX, 24.3, SZ);                     // 幕（y 14.9〜33.7）
    for (const s of [-1, 1]) B.box(0.7, 18.8, 0.06, C.screenDk, SX + s * 15.15, 24.3, SZ + 0.09);
    B.box(31, 2.6, 0.06, C.screenDk, SX, 32.4, SZ + 0.09);
    B.box(31.8, 0.6, 0.6, '#3a3632', SX, 14.7, SZ);                    // 下の棒と引き手
    B.box(0.35, 1.8, 0.2, '#3a3632', SX, 13.5, SZ);
    B.box(1.4, 0.35, 0.2, '#3a3632', SX, 12.6, SZ);
  }

  // 右: 古いブラインドの窓（半分下ろして、下の縁が斜めに傾いている）。下に放熱器
  const WX = W - 7, WW = 30;
  {
    // 窓の外: 曇り空と古い工場の屋根と煙突（夕方へ向けて色が変わる）
    O.box(WW, 20, 0.1, '#d7dacf', WX, 22.4, BACK + 0.1);
    O.box(WW, 3.0, 0.06, '#bfc3bb', WX, 13.9, BACK + 0.16);
    O.box(WW * 0.7, 4.2, 0.06, '#8e8b80', WX - 4, 14.5, BACK + 0.2);
    O.box(9, 6.6, 0.06, '#857f72', WX + 9, 15.7, BACK + 0.22);
    O.box(1.6, 12, 0.06, '#7d776b', WX + 6.2, 19.0, BACK + 0.24);
    O.box(2.2, 0.8, 0.06, '#6f6a5f', WX + 6.2, 25.2, BACK + 0.26);
    // 枠と窓台
    for (const s of [-1, 1]) B.box(1.2, 21.4, 1.0, C.win, WX + s * (WW / 2 + 0.6), 22.4, BACK + 0.5);
    B.box(WW + 2.4, 1.2, 1.0, C.win, WX, 33.0, BACK + 0.5);
    B.box(0.8, 20, 0.8, C.win, WX, 22.4, BACK + 0.4);
    B.box(WW + 3.2, 0.8, 2.6, '#7a5a34', WX, 12.0, BACK + 1.3);
    // ブラインド: 上は閉じ気味、下の縁は右下がり。羽根が1枚抜け、1枚曲がっている
    B.box(WW + 1, 1.4, 1.7, C.blind, WX, 32.0, BACK + 1.7);
    const slatsTop = 30.9, pitch = 0.86, n = 15;
    for (let i = 0; i < n; i++) {
      if (i === 9) continue;
      const y = slatsTop - i * pitch;
      const bend = i === 5 ? 0.06 : i >= n - 3 ? -0.025 * (i - n + 4) : 0;
      B.box(WW + 0.4, 0.5, 1.2, i % 4 === 2 ? C.blindDk : C.blind, WX + (i === 5 ? 1.2 : 0), y, BACK + 1.7, { rz: bend });
    }
    const yb = slatsTop - n * pitch;
    B.box(WW + 0.6, 0.7, 1.4, C.blindDk, WX, yb + 0.1, BACK + 1.75, { rz: -0.08 });
    for (const dx of [-9, 9]) B.box(0.12, slatsTop - yb + 0.8, 0.1, '#e6ddc2', WX + dx, (slatsTop + yb) / 2 + (dx > 0 ? -0.6 : 0.6), BACK + 2.42);
    B.box(0.15, 12.5, 0.15, '#e6ddc2', WX + WW / 2 - 1.2, 25.0, BACK + 2.5);   // 引き紐
    B.box(0.5, 1.0, 0.5, C.blindDk, WX + WW / 2 - 1.2, 18.6, BACK + 2.5);
    B.box(0.25, 9, 0.25, '#cfc6a8', WX - WW / 2 + 1.4, 26.6, BACK + 2.5);       // 角度の棒
    radiator(B, WX - 12, WX + 12, BACK + 2.2, 8.4, '#b8b09a');
  }
  // 右の隅: 書類棚（段ボールと丸めた図面）と、その上の古い空調
  {
    const fx = W + 17.5, fz = BACK + 3.9;
    B.box(7.0, 14.6, 7.6, C.cabinet, fx, 7.3, fz, { cast: true });
    for (let k = 0; k < 4; k++) {
      B.box(6.4, 0.25, 0.1, C.cabinetDk, fx, 3.6 + k * 3.5, fz + 3.85);
      B.box(2.2, 0.5, 0.4, '#8f8c82', fx, 2.4 + k * 3.5, fz + 3.95);
    }
    B.box(6.6, 4.6, 5.8, C.card, fx - 0.2, 16.9, fz + 0.4, { ry: 0.1, cast: true });
    B.box(6.7, 0.5, 2.0, '#8a6e47', fx - 0.2, 19.2, fz + 2.2, { ry: 0.1, rx: -0.5 });
    for (let k = 0; k < 3; k++) B.cyl(0.55, 13 + k * 1.5, ['#e4e0d2', '#cfdbe2', '#e9e3cf'][k], fx - 4.6 - k * 0.6, 7.0 + k * 0.4, fz + 1.4 - k * 1.1, { rz: 0.16 + k * 0.05, seg: 8 });
    // 壁掛けの古い空調（下に水の染み）
    B.box(11, 6.6, 3.2, '#c9c2ad', fx - 1, 29.0, BACK + 1.6);
    for (let k = 0; k < 4; k++) B.box(9.6, 0.25, 0.1, '#8f8a78', fx - 1, 27.0 + k * 1.1, BACK + 3.25);
    B.box(2.4, 1.0, 0.1, '#7a8478', fx + 2.6, 31.1, BACK + 3.25);
    B.box(2.6, 7.4, 0.06, C.stain, fx + 1.5, 22.0, BACK + 0.04);
  }

  // ===== 会議机（奥ゾーン）=====
  const T0 = W - 78, T1 = W + 6, TM = (T0 + T1) / 2, TL = T1 - T0;
  const TZ = -41, TD = 15, TY = 8.9;
  B.box(TL, 1.0, TD, C.tableTop, TM, TY - 0.5, TZ, { cast: true });
  B.box(TL + 0.4, 0.6, TD + 0.4, C.tableEdge, TM, TY - 1.2, TZ, { cast: true });
  for (const x of [T0 + 3.5, T1 - 3.5]) B.box(1.6, TY - 1.5, TD - 3, C.table, x, (TY - 1.5) / 2, TZ, { cast: true });
  B.box(TL - 9, 5.0, 0.8, C.table, TM, 4.4, TZ + 1, { cast: true });  // 幕板
  for (let i = 0; i < 5; i++) B.box(TL - 2, 0.02, 0.35, C.grain, TM, TY + 0.012, TZ - 6 + i * 3 + rnd(i) * 1.2);   // 木目
  for (let i = 0; i < 4; i++) B.cyl(0.8, 0.02, '#5a3f26', T0 + 10 + rnd(i * 5) * (TL - 20), TY + 0.02, TZ - 4 + rnd(i * 7) * 8, { seg: 12 });   // 輪じみ

  // 奥: GR社の席（からし色の回転椅子）と、右端にボスの椅子
  const grX = [T0 + 10, T0 + 26, T0 + 42, T0 + 58];
  grX.forEach((x, i) => swivelChair(B, x, -53 - (i === 3 ? 1.2 : 0), (rnd(i + 20) - 0.5) * 0.3 + (i === 3 ? -0.2 : 0)));
  const BX = T1 - 9;
  bossChair(B, BX, -54, -0.12);
  // 手前: こちらの席（硬い折りたたみ椅子）。代理店の席だけ回転椅子で、立ったばかりで斜めに向いている。
  // 背もたれまで奥ゾーン（z<−28）に収める（肘掛けのない椅子にして、座面を机の下へ入れる）
  foldingChair(B, T0 + 13, -31.6, Math.PI + 0.1);
  swivelChair(B, T0 + 29.5, -33.2, Math.PI + 0.3, true, false);
  foldingChair(B, T0 + 46, -32.2, Math.PI - 0.04);
  foldingChair(B, T0 + 63, -32.0, Math.PI + 0.12);
  // 代理店の鞄（床。帯の外）
  B.box(5.8, 4.4, 1.6, '#4a3424', T0 + 22.5, 2.2, -29.6, { ry: 0.15 });
  B.box(2.2, 0.9, 0.5, '#2e2118', T0 + 22.5, 4.8, -29.6, { ry: 0.15 });

  // 机の上
  {
    const y = TY;
    // GR社の側: 配られた資料・紙コップ・バインダー
    grX.forEach((x, i) => {
      B.box(4.6, 0.14, 3.3, C.paper, x - 0.5, y + 0.07, -45.2, { ry: (rnd(i) - 0.5) * 0.3 });
      B.cyl(0.55, 1.9, C.cup, x + 3.4, y + 0.95, -46.2, { r2: 0.72, seg: 10 });
    });
    B.box(4.6, 1.4, 5.2, BINDER[0], grX[2] - 4.5, y + 0.7, -45.6, { ry: 0.1 });
    // ドーナツの箱（ふたを開けたまま。1つ減っている）
    {
      const dx = T0 + 9, dz = -42.6;
      B.box(7.4, 1.3, 6.6, '#ece6d6', dx, y + 0.65, dz);
      B.box(7.4, 0.25, 6.6, '#e3dccb', dx, y + 1.3 + 3.0, dz - 3.6, { rx: 1.35 });
      const col = ['#b9824e', '#e0a0b0', null, '#5a3a28'];
      col.forEach((c, k) => {
        if (!c) return;
        const t = new THREE.TorusGeometry(1.05, 0.48, 8, 14);
        B.geo(t, c, dx - 1.75 + (k % 2) * 3.5, y + 1.55, dz - 1.6 + Math.floor(k / 2) * 3.2, { rx: Math.PI / 2 });
      });
    }
    // 壊れた試作品（会議の議題。不良札つき）
    {
      const px = T0 + 20, pz = -40.4;
      B.box(6, 4.4, 4.6, C.proto, px, y + 2.2, pz, { ry: 0.25 });
      B.box(6.2, 0.6, 4.8, C.protoDk, px, y + 4.6, pz, { ry: 0.25 });
      B.box(2.2, 1.6, 0.2, '#cfd3c2', px - 1.0, y + 2.6, pz + 2.25, { ry: 0.25 });   // 計器
      B.box(1.6, 0.18, 0.1, '#2c2a28', px + 1.4, y + 3.2, pz + 2.0, { ry: 0.25, rz: 0.7 });   // ひび
      B.box(1.2, 0.18, 0.1, '#2c2a28', px + 1.9, y + 2.4, pz + 1.9, { ry: 0.25, rz: -0.6 });
      B.box(0.18, 2.2, 0.18, '#c07a2a', px + 2.6, y + 5.5, pz - 0.6, { rz: 0.5 });   // 出たままの配線
      B.box(0.18, 1.8, 0.18, '#3a6aa8', px + 2.2, y + 5.3, pz - 1.0, { rz: -0.4 });
      B.box(1.5, 2.1, 0.12, C.tag, px - 2.6, y + 2.2, pz + 2.1, { ry: 0.25, rz: 0.12 });
      for (let k = 0; k < 4; k++) B.box(0.35, 0.35, 0.35, '#8a8a84', px + 4.2 + rnd(k) * 2, y + 0.18, pz + 1 + rnd(k + 9) * 2);   // 外したねじ
    }
    // こちらの席: 自機の青い紙ばさみと、机に置いた保護帽（作業着の緑）
    B.box(4.6, 0.32, 3.4, '#8ea8c0', T0 + 13, y + 0.16, -36.6, { ry: -0.08 });
    B.box(2.4, 0.2, 0.2, '#2a3a6a', T0 + 15.2, y + 0.42, -36.2, { ry: 0.5 });
    hardHat(B, T0 + 7.6, y, -37.4, '#36b06a', 0.3);
    // 代理店の席: 分厚い辞書・黄色い便箋・ペン
    B.box(3.4, 1.7, 4.4, '#7a2a24', T0 + 25.6, y + 0.85, -37.0, { ry: 0.1 });
    B.box(3.1, 1.4, 0.1, '#e8e2cc', T0 + 25.75, y + 0.85, -34.8, { ry: 0.1 });
    B.box(3.6, 0.24, 4.8, '#e3d27a', T0 + 31.0, y + 0.12, -36.4, { ry: -0.12 });
    B.box(2.3, 0.2, 0.2, '#1e1e22', T0 + 31.6, y + 0.36, -36.0, { ry: 0.7 });
    // 会議電話（三角）。灯りは onEvent で点滅
    const tri = new THREE.CylinderGeometry(2.3, 2.7, 0.7, 3);
    B.geo(tri, '#3a3b3d', T0 + 50, y + 0.35, -41.5);
    for (let k = 0; k < 3; k++) {
      const a = Math.PI / 2 + (k / 3) * Math.PI * 2;
      B.box(0.8, 0.3, 0.8, '#262729', T0 + 50 + Math.cos(a) * 2.4, y + 0.85, -41.5 + Math.sin(a) * 2.4);
    }
    B.box(0.18, 0.12, 9, '#26272a', T0 + 50.6, y + 0.06, -46.6, { ry: 0.2 });   // 電話の線
    // 水差しと紙コップ
    B.cyl(1.25, 3.8, '#b9c9c6', T0 + 64, y + 1.9, -43.6, { r2: 1.05, seg: 12 });
    B.box(0.4, 2.4, 1.2, '#a6b8b4', T0 + 65.5, y + 2.2, -43.6);
    B.cyl(0.55, 3.0, C.cup, T0 + 67.6, y + 1.5, -42.8, { r2: 0.7, seg: 10 });
    // ボスの席: 分厚い赤いバインダー・マグ・名札（無地の真鍮）
    B.box(5.2, 2.4, 5.8, '#7d2c24', BX - 2.5, y + 1.2, -45.4, { ry: 0.12 });
    B.box(0.6, 2.2, 5.4, '#e7e1cf', BX - 0.1, y + 1.2, -45.1, { ry: 0.12 });
    B.cyl(0.85, 2.1, '#d9d3c4', BX + 4.0, y + 1.05, -46.0, { seg: 12 });
    B.box(0.35, 1.2, 1.0, '#d9d3c4', BX + 5.0, y + 1.05, -46.0);
    B.box(5.4, 1.7, 1.3, '#4a3420', BX, y + 0.85, -40.6);
    B.box(4.4, 0.9, 0.08, '#b9984a', BX, y + 0.95, -39.9);
  }

  // OHP（机の手前寄り。頭はスクリーンを向く）
  const OX = SX + 2, OZ = -37.2;
  const HEAD = new THREE.Vector3(OX, TY + 10.3, OZ - 3.1);
  {
    const y = TY;
    B.box(6.6, 3.0, 6.6, C.ohp, OX, y + 1.5, OZ);
    B.box(6.7, 0.5, 6.7, '#a59e8b', OX, y + 0.25, OZ);
    for (let k = 0; k < 4; k++) B.box(0.12, 1.4, 3.6, '#6e6a5e', OX + 3.33, y + 1.5, OZ - 1.6 + k * 0.1 + k * 0.8);
    B.box(5.8, 0.15, 5.8, '#4a4a46', OX, y + 3.07, OZ);
    B.box(0.8, 8.4, 0.8, C.ohpDk, OX + 2.6, y + 7.0, OZ - 2.9);          // 柱
    B.box(1.3, 1.3, 1.3, C.ohpDk, OX + 3.4, y + 6.0, OZ - 2.9);          // つまみ
    B.box(3.4, 0.6, 0.7, C.ohpDk, OX + 1.3, y + 10.6, OZ - 2.9);         // 腕
    B.box(3.0, 1.9, 2.4, '#2f2e2b', OX, y + 10.3, OZ - 1.9);            // 頭
    B.cyl(0.95, 1.4, C.ohpDk, OX, y + 8.8, OZ - 1.8, { seg: 12 });       // レンズの筒
    B.box(2.4, 1.5, 0.2, '#6d7a80', OX, y + 10.3, OZ - 3.15);           // 鏡
    B.box(0.2, 0.15, 6, '#26272a', OX - 2.8, y + 0.08, OZ + 3.4, { ry: 0.3 });   // 電源の線（机の縁から床へ）
    B.box(0.2, TY, 0.2, '#26272a', OX - 4.6, TY / 2, -33.6);
  }

  // 隅（手前寄りの奥ゾーン）: ブラウン管テレビとビデオの台車
  {
    const vx = W + 14, vz = -37;
    for (const [dx, dz] of [[-4, -3.4], [4, -3.4], [-4, 3.4], [4, 3.4]]) {
      B.box(0.6, 9.4, 0.6, '#4b4d4c', vx + dx, 5.1, vz + dz);
      B.cyl(0.6, 0.6, '#222', vx + dx, 0.3, vz + dz, { rx: Math.PI / 2, seg: 8 });
    }
    B.box(9, 0.6, 7.6, '#5a5c5b', vx, 2.0, vz, { cast: true });
    B.box(9, 0.6, 7.6, '#5a5c5b', vx, 9.6, vz, { cast: true });
    B.box(7.6, 1.8, 5.8, '#2c2c2c', vx, 3.2, vz);                       // ビデオ
    B.box(1.6, 0.25, 0.1, '#5a8a5a', vx + 2.4, 3.3, vz + 2.95);
    B.box(8.6, 7.6, 7.8, '#3c3b38', vx, 13.7, vz - 0.2, { cast: true }); // テレビ
    B.box(7.0, 5.9, 0.3, '#2c3735', vx - 0.4, 13.9, vz + 3.75);
    B.box(0.6, 3.6, 0.2, '#55534e', vx + 3.5, 13.4, vz + 3.75);
    B.box(0.25, 4, 0.25, '#202020', vx - 3.6, 7.6, vz - 3.9);           // 線
  }

  // ===== 手前ゾーン（遮蔽の線より低い物だけ）=====
  // 会議室: くず籠と、入りきらずに床に落ちた丸めた紙（作り直しの下書き）
  {
    const bx = GX + 25, bz = 38;
    B.cyl(1.7, 4.4, '#55584f', bx, 2.2, bz, { r2: 2.0, seg: 12 });
    for (let k = 0; k < 7; k++) {
      const g = new THREE.IcosahedronGeometry(0.7 + rnd(k) * 0.25, 0);
      const out = k > 3;
      B.geo(g, k % 3 ? C.paper : '#e4e0d0', out ? bx - 4 + rnd(k * 3) * 9 : bx + (rnd(k) - 0.5) * 1.8, out ? 0.6 : 4.6 + rnd(k * 5) * 0.8, out ? bz - 6 + rnd(k * 7) * 9 : bz + (rnd(k * 2) - 0.5) * 1.8, { rx: k, ry: k * 2 });
    }
  }
  // 廊下: 低い長椅子とくず籠
  bench(B, GX - 44, 55, 28, false);
  B.cyl(1.8, 5.6, '#5d655e', GX - 10, 2.8, 44, { r2: 2.0, seg: 12 });
  for (let x = XL + 70; x < GX - 120; x += 210) bench(B, x, 52, 26, false);

  // ===== まとめて描く =====
  B.done(new THREE.MeshLambertMaterial({ vertexColors: true }));
  U.done(new THREE.MeshBasicMaterial({ vertexColors: true }), false);
  const outMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  O.done(outMat, false);
  const glass = G.done(new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, emissive: 0x16201b,
  }), false);
  for (const m of glass) m.renderOrder = 4;
  for (const m of Gs.done(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false }), false)) m.renderOrder = 5;

  // ===== 動く物 =====
  // 時計の針（中心で回るよう、根元を原点に寄せてから置く）
  const hand = (w, len, color, z) => {
    const g = new THREE.BoxGeometry(w, len, 0.08);
    g.translate(0, len / 2 - 0.3, 0);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: hex(color) }));
    m.position.set(CX, CY, z);
    return addScenery(m);
  };
  const hour = hand(0.42, 1.7, '#22201c', CZ + 0.55);
  const min = hand(0.28, 2.5, '#22201c', CZ + 0.63);

  // OHP の光: スクリーンの台形（上が広い）と、台の上の光る板
  const IMG = { yb: 17.4, yt: 30.4, wb: 21.6, wt: 24.4, x: SX, z: SZ + 0.12 };
  const imgMat = new THREE.MeshBasicMaterial({ color: hex('#f2e9cc'), transparent: true, opacity: 1, depthWrite: false });
  const ig = new THREE.BufferGeometry();
  ig.setAttribute('position', new THREE.Float32BufferAttribute([
    IMG.x - IMG.wb / 2, IMG.yb, IMG.z, IMG.x + IMG.wb / 2, IMG.yb, IMG.z, IMG.x + IMG.wt / 2, IMG.yt, IMG.z,
    IMG.x - IMG.wt / 2, IMG.yt, IMG.z,
    OX - 2.7, TY + 3.2, OZ + 2.7, OX + 2.7, TY + 3.2, OZ + 2.7, OX + 2.7, TY + 3.2, OZ - 2.7, OX - 2.7, TY + 3.2, OZ - 2.7,
  ], 3));
  ig.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const img = addScenery(new THREE.Mesh(ig, imgMat));
  img.renderOrder = 1;

  // スライド3枚（無地の図形だけ）。少し傾けて置いた透明シートの感じ
  const slides = [];
  const slide = (draw) => {
    const Sb = batch();
    draw(Sb);
    const [m] = Sb.done(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false }), false);
    m.renderOrder = 2;
    m.visible = false;
    slides.push(m);
  };
  const sz = IMG.z + 0.06, sy = (IMG.yb + IMG.yt) / 2, rz = 0.025;
  const at = (dx, dy) => [SX + dx * Math.cos(rz) - dy * Math.sin(rz), sy + dx * Math.sin(rz) + dy * Math.cos(rz)];
  const pbox = (Sb, w, h, color, dx, dy, o = {}) => { const [x, y] = at(dx, dy); Sb.box(w, h, 0.04, color, x, y, sz + (o.dz || 0), { rz: rz + (o.rz || 0) }); };
  // 1枚目: 工程の線表。後ろの方ほど赤い延長が継ぎ足されている
  slide((Sb) => {
    pbox(Sb, 19, 0.35, '#6f6a5c', 0, 5.0);
    for (let r = 0; r < 5; r++) {
      const y = 3.3 - r * 1.75, x0 = -8.5 + r * 2.4, len = 4.5 + rnd(r + 3) * 2.5;
      pbox(Sb, 2.2, 0.8, '#b8b19a', -9.0, y);
      pbox(Sb, len, 0.9, '#6f8aa6', x0 + len / 2, y);
      const late = 1.5 + r * 1.2;
      pbox(Sb, late, 0.9, '#c4573f', x0 + len + late / 2, y, { dz: 0.01 });
    }
    pbox(Sb, 0.25, 9.8, '#c4573f', 2.6, -0.3, { dz: 0.02 });
  });
  // 2枚目: 壊れた試作品の写真。ひびを赤い丸で囲んである
  slide((Sb) => {
    pbox(Sb, 15, 9.6, '#8b8f86', -1.5, -0.2);
    pbox(Sb, 8.6, 5.6, '#5f6c70', -2.0, -0.6, { dz: 0.01 });
    pbox(Sb, 8.8, 1.0, '#3e474a', -2.0, 2.6, { dz: 0.015 });
    pbox(Sb, 2.2, 0.25, '#262624', 0.4, -0.2, { dz: 0.02, rz: 0.7 });
    pbox(Sb, 1.8, 0.25, '#262624', 1.3, -1.3, { dz: 0.02, rz: -0.5 });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      pbox(Sb, 1.05, 0.3, '#c4473a', 0.8 + Math.cos(a) * 2.7, -0.7 + Math.sin(a) * 2.3, { dz: 0.025, rz: a + Math.PI / 2 });
    }
    for (let k = 0; k < 3; k++) pbox(Sb, 3.6, 0.35, '#7d7869', 8.6, 2.6 - k * 1.4);
  });
  // 3枚目: 歩留まりの折れ線。目標（緑の点線）はずっと上、実績は下がっていく
  slide((Sb) => {
    pbox(Sb, 0.3, 9.4, '#55524a', -8.6, -0.3);
    pbox(Sb, 18, 0.3, '#55524a', 0.2, -4.8);
    for (let k = 0; k < 8; k++) pbox(Sb, 1.3, 0.3, '#5f9a5a', -7.4 + k * 2.2, 3.6);
    const pts = [[-7.6, 1.6], [-5.0, 2.2], [-2.4, 0.4], [0.2, 0.9], [2.8, -1.4], [5.4, -1.0], [8.0, -3.2]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      pbox(Sb, len, 0.32, '#c4573f', (x0 + x1) / 2, (y0 + y1) / 2, { rz: Math.atan2(y1 - y0, x1 - x0) });
    }
    for (let k = 0; k < 6; k++) pbox(Sb, 1.4, 1.2 + rnd(k) * 2.4, '#8e9fb2', -6.6 + k * 2.8, -4.0 + (1.2 + rnd(k) * 2.4) / 2 - 0.6, { dz: -0.01 });
  });

  // 光の筋（OHP の頭からスクリーンへ。加算でごく薄く）。上から見下ろすカメラでは筋の面が投影の上に重なるので、
  // レンズの側だけ明るく、スクリーンに近づくほど消える（頂点の色で）。でないとスライドが白く飛ぶ
  const beamGeo = new THREE.BufferGeometry();
  const bv = [
    HEAD.x - 0.9, HEAD.y - 0.5, HEAD.z, HEAD.x + 0.9, HEAD.y - 0.5, HEAD.z, HEAD.x + 0.9, HEAD.y + 0.5, HEAD.z, HEAD.x - 0.9, HEAD.y + 0.5, HEAD.z,
    IMG.x - IMG.wb / 2, IMG.yb, IMG.z, IMG.x + IMG.wb / 2, IMG.yb, IMG.z, IMG.x + IMG.wt / 2, IMG.yt, IMG.z, IMG.x - IMG.wt / 2, IMG.yt, IMG.z,
  ];
  beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(bv, 3));
  const bc = new THREE.Color(BEAM);
  beamGeo.setAttribute('color', new THREE.Float32BufferAttribute([
    ...[0, 1, 2, 3].flatMap(() => [bc.r, bc.g, bc.b]), ...[0, 1, 2, 3].flatMap(() => [0, 0, 0])], 3));
  beamGeo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  const beamMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const beam = addScenery(new THREE.Mesh(beamGeo, beamMat));
  beam.renderOrder = 3;

  // 光の中を舞う埃
  const NM = 36;
  const motes = [];
  const mp = new Float32Array(NM * 3);
  for (let i = 0; i < NM; i++) motes.push({ u: rnd(i * 3 + 1), a: rnd(i * 5 + 2) - 0.5, b: rnd(i * 7 + 3) - 0.5, s: 0.4 + rnd(i) * 0.8 });
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  mg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NM * 3), 3));   // レンズに近いほど明るい
  const moteMat = new THREE.PointsMaterial({
    vertexColors: true, size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dust = addScenery(new THREE.Points(mg, moteMat));
  dust.renderOrder = 3;
  dust.frustumCulled = false;

  // 会議電話の灯り
  const ledMat = new THREE.MeshBasicMaterial({ color: hex('#3a1e1a') });
  const led = addScenery(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.5), ledMat));
  led.position.set(T0 + 50, TY + 0.8, -41.5);

  A = {
    t: 0, hour, min, img, imgMat, slides, slideI: 0, slideT: 0, beam, beamMat, dust, moteMat, motes, mp, mg, mc: mg.attributes.color.array,
    HEAD, IMG, led, ledMat, outMat,
    ohp: 1, ohpTarget: 1, warm: -1, ring: 0,
    baseHemi: hemi.intensity, flickNext: 6 + rnd(3) * 5, flickT: -1,
    min0: 16 * 60 + 45,          // 会議が始まったのは 16:45（待合室で 15:30 まで待たされた後）
  };
  slides[0].visible = true;
  applyOhp(1);
  updateMotes(0);
  updateClock();
  updateOutside();
}

// ===== 出来事 =====
const BEAM = '#7a6a48';
const _mote = new THREE.Color('#fff1cc');
const C_LED_OFF = new THREE.Color('#3a1e1a'), C_LED_ON = new THREE.Color('#ff3a24');
const C_DAY = new THREE.Color(1, 1, 1), C_DUSK = new THREE.Color(1.0, 0.74, 0.52), C_NIGHT = new THREE.Color(0.34, 0.36, 0.5);
const _c = new THREE.Color();

function applyOhp(k) {
  const on = k > 0.01;
  A.img.visible = on;
  A.imgMat.opacity = k;
  A.beam.visible = on;
  A.beamMat.color.setScalar(k);
  A.dust.visible = on;
  A.moteMat.opacity = 0.55 * k;
  for (const [i, s] of A.slides.entries()) {
    s.material.opacity = k;
    if (!on) s.visible = false;
    else s.visible = i === A.slideI && A.slideT < 6.4;
  }
}

function updateClock() {
  const m = A.min0 + A.t;                       // ゲームの1秒で1分
  A.min.rotation.z = -(m / 60) * Math.PI * 2;
  A.hour.rotation.z = -(m / 720) * Math.PI * 2;
}

// 窓の外: 17:30 から夕焼け、18:15 から暮れていく
function updateOutside() {
  const m = A.min0 + A.t;
  const k1 = Math.min(1, Math.max(0, (m - 1050) / 45)), k2 = Math.min(1, Math.max(0, (m - 1095) / 45));
  _c.copy(C_DAY).lerp(C_DUSK, k1).lerp(C_NIGHT, k2);
  A.outMat.color.copy(_c);
}

function updateMotes(dt) {
  const H = A.HEAD, I = A.IMG;
  for (let i = 0; i < A.motes.length; i++) {
    const p = A.motes[i];
    p.u += dt * 0.012 * p.s; if (p.u > 1) p.u -= 1;
    p.b += dt * 0.03 * p.s; if (p.b > 0.5) p.b -= 1;
    p.a += Math.sin(A.t * 0.7 + i) * dt * 0.01;
    const u = 0.08 + p.u * 0.86;
    const cy = H.y + ((I.yb + I.yt) / 2 - H.y) * u, cz = H.z + (I.z - H.z) * u;
    const w = 1.8 + ((I.wb + I.wt) / 2 - 1.8) * u, h = 1 + ((I.yt - I.yb) - 1) * u;
    A.mp[i * 3] = H.x + (I.x - H.x) * u + p.a * w * 0.9;
    A.mp[i * 3 + 1] = cy + p.b * h * 0.9;
    A.mp[i * 3 + 2] = cz;
    const k = Math.pow(1 - u, 1.5);
    A.mc[i * 3] = _mote.r * k; A.mc[i * 3 + 1] = _mote.g * k; A.mc[i * 3 + 2] = _mote.b * k;
  }
  A.mg.attributes.position.needsUpdate = true;
  A.mg.attributes.color.needsUpdate = true;
}

export function onEvent(name, arg) {
  if (!A) return;
  if (name === 'tick') {
    const dt = Math.min(0.25, Math.max(0, (arg && arg.dt) || 0));   // シェルと同じ上限（遅い端末でも実時間で進む）
    A.t += dt;
    updateClock();
    updateOutside();
    // OHP: 点くときは2度瞬いてから。消えるときはすっと
    if (A.warm >= 0) {
      A.warm += dt;
      const w = A.warm;
      A.ohp = w < 0.12 ? 0.7 : w < 0.3 ? 0 : w < 0.42 ? 0.85 : w < 0.55 ? 0.15 : Math.min(1, 0.6 + (w - 0.55) * 2);
      if (w > 0.8) { A.warm = -1; A.ohp = 1; }
    } else if (A.ohp !== A.ohpTarget) {
      A.ohp = A.ohpTarget > A.ohp ? Math.min(A.ohpTarget, A.ohp + dt * 3) : Math.max(A.ohpTarget, A.ohp - dt * 2.5);
    }
    // スライドは7秒ごとに替わる（替える間の0.6秒は空の光だけ）
    A.slideT += dt;
    if (A.slideT > 7) { A.slideT = 0; A.slideI = (A.slideI + 1) % A.slides.length; }
    applyOhp(A.ohp);
    if (A.ohp > 0.01) updateMotes(dt);
    // 会議電話: レターのあと5秒点滅
    if (A.ring > 0) {
      A.ring -= dt;
      A.ledMat.color.copy((A.ring * 4) % 1 < 0.55 && A.ring > 0 ? C_LED_ON : C_LED_OFF);
    }
    // 古い蛍光灯: ときどき2〜3回だけ小さく瞬く
    if (A.flickT < 0 && A.t >= A.flickNext) A.flickT = 0;
    if (A.flickT >= 0) {
      A.flickT += dt;
      const step = Math.floor(A.flickT / 0.06);
      const f = step >= 6 ? 1 : [0.86, 1, 0.9, 1, 0.84, 1][step];
      hemi.intensity = A.baseHemi * f;
      if (step >= 6) { A.flickT = -1; A.flickNext = A.t + 8 + rnd(A.t) * 7; }
    }
  } else if (name === 'bossStart') {
    A.warm = 0; A.ohp = 0; A.ohpTarget = 1; A.slideI = 0; A.slideT = 0;
    applyOhp(0);
  } else if (name === 'letter') {
    A.ring = 5;
  } else if (name === 'defeated') {
    A.warm = -1; A.ohpTarget = 0; A.ring = 0;
    A.ledMat.color.copy(C_LED_OFF);
  }
}
