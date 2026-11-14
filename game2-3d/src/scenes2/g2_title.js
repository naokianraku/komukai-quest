// 小向クエスト2 ゴールデンエイジ編 — タイトルの背景「研修センターの前」
//
// 入社1年目の春の朝。研修センター（3階建ての低い建物）の玄関前の広場を、
// 本編の正門と同じタイトル用カメラ（updateCamera のタイトル分岐）で写す。
// カメラは自機の x（wx(stage.player.x)）から左へ32ずらした所を中心に、左右へゆっくり振れる。
// 画面の中央はタイトルの書類が覆うので、見せ場は左右に分ける。
//   左: 満開の桜が3本と、その下のベンチ。奥に連窓の帯が走る研修棟と、ガラス張りの階段室
//   右: 玄関（ひさし・ガラス扉・柱）と、ひさしの下まで入るアスファルトの車寄せ、文字のない石の銘板。桜がもう2本
//   上: 春霞の空と、遠くの山。建物の後ろの林（常緑と新緑）
//   下: 歩行帯の石畳（散った花びら）と、手前のパンジーの花壇と低い生け垣
// 学校の校舎に見えないようにする（時計・時計塔に見える塔・クリーム色の壁・チューリップは使わない）。
// 会社の建物だと読める手がかりは、明るいコンクリートの壁、ガラスの階段室、2層の玄関ホール、車寄せ
// 小さい画面（667x375）では書類が幅の7割を覆い、左右の端しか見えない。
// 端だけでも「桜と建物」「玄関」が分かるよう、桜と玄関は画面の端寄りに置いてある。
//
// 文字・ロゴ・旗は置かない。銘板は無地の板＋色の棒。人に見える物も置かない。
// 動かない物は boxBatch にまとめ（描画2回）、ロビーの明かり（自発光）と舞う花びら（1メッシュ）だけ別。
import {
  THREE, wx, box, boxBatch, addScenery, hex, setLighting, scene, hemi, sun, fill,
} from '../../../game3d/src/render3d.js';

// 配色。春の朝: 明るいコンクリートの建物、淡い桃色の桜、若い芝、霞んだ空。
// 建物は学校のクリーム色にしない。本編の事務棟（#b7babb）と同じ系統の、明るい灰色のコンクリート
const C = {
  sky: '#b9d6ec',
  lawn: '#8cad62', lawnDark: '#7d9f57', soil: '#6f5641',
  pave: '#d3ccbe', paveLine: '#bfb7a8', paveBand: '#c2baab', curb: '#e4dfd4',
  asphalt: '#75787b', asphaltLine: '#e6e6e0', curbStone: '#c4c3bc',
  wall: '#e3e2dc', pilaster: '#d8d7d0', cap: '#cecdc6', roof: '#b4b3ad', roofBox: '#c6c5bf',
  glass: '#5e7487', glassHi: '#7f98ad', mull: '#d2d2cc', sill: '#efefea', blind: '#d9dde0',
  tower: '#d4d4ce', towerGlass: '#8aa2b5',
  hall: '#d6d5cf', hallGlass: '#8aa3b6', frame: '#3b4248', canopy: '#ecebe6', fascia: '#c8c7c1',
  column: '#e4e3de', step: '#c6c4bd', stepLine: '#b0aea7', handle: '#9aa3aa',
  // ガラス扉: 朝の外から見ると、上は空と庇が映って暗い青灰、下に暖かいロビーが透ける
  interior: '#c7b48e', interiorGlow: '#2a2216', doorGlass: '#6f8597', doorShine: '#b9cad8',
  stone: '#b9b2a5', stoneDark: '#9f988b', plate: '#eeeeea', bar: '#3e4954',
  louver: '#a9adb0', louverBack: '#5d646b',
  trunk: '#4b3a33', trunkDark: '#3a2c27',
  hedge: '#3f6a3d', hedgeTop: '#4f7c47', shrub: '#4a7743',
  bench: '#9a7650', benchLeg: '#6c7176',
  forest: ['#4a7a4a', '#5a8a50', '#3f6c45', '#6f9a5a', '#86ad66'],   // 常緑と新緑
  mountain: '#a8c1cf',                                                // 空（#b9d6ec）に近い淡い青灰
  flower: ['#7a5bb0', '#f0c93a', '#f3f1ea', '#a991d6', '#e8a33a'], leaf: '#4f7f38',
};
// 桜の花。上ほど白く、下（影側）ほど濃い
const PINK = ['#fdeef3', '#fadbe5', '#f5c8d7', '#eeb6c9', '#e0a2b8', '#c98c9f'];

// 舞う花びら（onEvent で動かす）。build のたびに作り直す
let petals = null;

// 決まった並びの乱数（撮り直しても同じ絵になるように）
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function build(W, halfD, ctx) {
  petals = null;
  // カメラの中心（タイトルのカメラは自機の x から左へ32ずらした所を見る）
  const cx = ctx && ctx.stage && ctx.stage.player ? wx(ctx.stage.player.x) : 20;
  const ox = cx - 32;
  const R = rng(20260401);

  // --- 光: 春の朝。暖かい日差しと、霞んだ明るい空 ---
  setLighting(true);
  hemi.color.set('#d3e5f4');
  hemi.groundColor.set('#a08e6a');
  hemi.intensity = 1.5;
  sun.color.set('#ffecce');
  sun.intensity = 2.05;
  fill.intensity = 0.55;
  scene.background = hex(C.sky);
  scene.fog = new THREE.Fog(hex(C.sky), 380, 1150);

  const b = boxBatch();
  const L = ox - 420, Rt = ox + 420;                                         // 地面と大きな箱の左右の端
  const near = (x, m = 150) => Math.abs(x - ox) < m;                         // 細かい物はカメラに入る所だけ

  // --- 地面: 芝。その上に広場の石畳（歩行帯）と玄関へのアプローチ ---
  // 左右の端の面も重ねない（幅を少しずつ変える）
  b.box(Rt - L, 2, 900, C.lawn, ox, -1, -340);                               // 天面 y=0
  const PZ0 = -34, PZ1 = 48;                                                 // 広場の奥と手前
  b.box(Rt - L - 2, 0.3, PZ1 - PZ0, C.pave, ox, -0.11, (PZ0 + PZ1) / 2);    // 天面 y=0.04
  // 薄い箱の天面は高さをはっきり分ける（石畳0.04／縁の帯0.07／目地0.11・0.12／散った花びら0.16）。
  // 近いと遠くで点滅する
  b.box(Rt - L - 4, 0.06, 3.2, C.paveBand, ox, 0.04, PZ0 + 1.8);             // 縁の帯（色違いの石）
  b.box(Rt - L - 4, 0.06, 3.2, C.paveBand, ox, 0.04, PZ1 - 1.8);
  for (let z = PZ0 + 6; z < PZ1 - 3; z += 6) b.box(Rt - L - 6, 0.06, 0.35, C.paveLine, ox, 0.08, z);
  // 縦の目地は横の目地より少しだけ高く（交わる所で同じ面が重ならないように）
  for (let x = L + 3; x < Rt; x += 9) if (near(x)) b.box(0.35, 0.07, PZ1 - PZ0 - 1, C.paveLine, x, 0.085, (PZ0 + PZ1) / 2);
  // 縁石（奥は芝との境、手前は花壇との境）
  b.box(Rt - L - 3, 0.5, 1.2, C.curb, ox, 0.25, PZ0 - 0.6);
  b.box(Rt - L - 3, 0.5, 1.2, C.curb, ox, 0.25, PZ1 + 0.6);

  // --- 研修棟（3階建て。横長の連窓の帯、窓の上に薄い庇）---
  // 人の背丈18に合わせる: 1階（ロビー階）18、2・3階13、パラペット2で高さ46
  const FZ = -92;                                                            // 正面の面
  const BX0 = ox - 270, BX1 = ox + 166, BD = 46, BH = 46;
  const EX = ox + 116;                                                       // 玄関の中心
  const TX = ox - 104;                                                       // 階段室の中心
  b.box(BX1 - BX0, BH, BD, C.wall, (BX0 + BX1) / 2, BH / 2, FZ - BD / 2, { cast: true });
  b.box(BX1 - BX0 + 1, 1.2, BD + 1, C.cap, (BX0 + BX1) / 2, BH + 0.6, FZ - BD / 2);   // パラペットの笠木
  b.box(BX1 - BX0 - 4, 0.3, BD - 4, C.roof, (BX0 + BX1) / 2, BH + 1.25, FZ - BD / 2); // 屋上の床
  // 屋上: 奥へ下げた機械室と室外機（正面からは稜線に少し段が出るだけ）
  b.box(30, 7, 16, C.roofBox, ox + 20, BH + 4.7, FZ - 30, { cast: true });
  b.box(31, 0.7, 17, C.cap, ox + 20, BH + 8.5, FZ - 30);
  // 機械室の正面のガラリ（階段室の正面には付けない。塔の上の暗いガラリは、時計の無い時計塔に見える）
  b.box(12, 4.4, 0.3, C.louverBack, ox + 20, BH + 4.7, FZ - 21.8);
  for (let n = 0; n < 4; n++) b.box(12.4, 0.5, 0.7, C.louver, ox + 20, BH + 3.05 + n * 1.1, FZ - 21.6);
  for (const x of [ox - 210, ox - 175, ox + 70]) b.box(10, 3.2, 7, C.roofBox, x, BH + 3.1, FZ - 33);
  // 連窓（階ごと）。玄関ホールの所は1・2階を抜く
  const FLOORS = [[4.0, 10.0], [21.5, 6.5], [34.5, 6.5]];
  FLOORS.forEach(([y0, h], f) => {
    const runs = f < 2 ? [[BX0 + 4, EX - 21], [EX + 21, BX1 - 4]] : [[BX0 + 4, BX1 - 4]];
    for (const [x0, x1] of runs) {
      if (x1 - x0 < 4) continue;
      const xm = (x0 + x1) / 2, len = x1 - x0;
      b.box(len, h, 0.8, C.glass, xm, y0 + h / 2, FZ + 0.2);                 // ガラスの帯
      b.box(len - 0.3, h * 0.28, 0.8, C.glassHi, xm, y0 + h * 0.83, FZ + 0.25);   // 上の映り込み
      for (let x = x0 + 3.2; x < x1; x += 6.4) b.box(0.55, h + 0.2, 1.0, C.mull, x, y0 + h / 2, FZ + 0.35);
      b.box(len + 0.6, 0.7, 1.8, C.sill, xm, y0 - 0.35, FZ + 0.7);          // 窓台
      b.box(len + 0.6, 0.6, 3.0, C.cap, xm, y0 + h + 0.9, FZ + 1.3, { cast: true });   // 窓の上の庇
      // ブラインドを半分下ろした窓（まだらにして単調さを消す）
      for (let x = x0 + 3.2; x < x1 - 6.4; x += 6.4) {
        if (R() < 0.2) {
          const hb = h * (0.25 + R() * 0.3);                                       // 上の桟から吊るす
          b.box(5.8, hb, 0.3, C.blind, x + 3.2, y0 + h * 0.96 - hb / 2, FZ + 0.68);
        }
      }
    }
  });
  // 付け柱（長い壁を区切る）
  for (let x = BX0 + 52; x < BX1 - 10; x += 52) {
    if (Math.abs(x - EX) < 26 || Math.abs(x - TX) < 14) continue;
    b.box(2.0, BH, 1.4, C.pilaster, x, BH / 2, FZ + 0.75);
  }

  // --- 階段室（事務所ビルの、ガラス張りの階段室）---
  // 屋上から高く突き出た塔に暗いガラリや時計があると、遠目には校舎の時計塔に見える。
  // 突き出しは低く抑え、正面は下から上まで通しのガラスにする
  const TH = BH + 4;
  b.box(15, TH, 10, C.tower, TX, TH / 2, FZ + 2, { cast: true });
  b.box(16, 1.0, 11, C.cap, TX, TH + 0.5, FZ + 2);
  b.box(10, 45, 0.6, C.towerGlass, TX, 3 + 45 / 2, FZ + 7.1);                // y 3〜48
  for (let k = 0; k <= 7; k++) b.box(10.4, 0.5, 0.8, C.mull, TX, 3 + k * 45 / 7, FZ + 7.3);   // 横桟（約6.4ごと）
  b.box(0.5, 44.6, 0.9, C.mull, TX, 3 + 45 / 2, FZ + 7.35);                  // 縦の中桟（上端は横桟の中に収める）

  // --- 玄関ホール（少し前へ出た2階分の箱）とひさし・ガラス扉・柱 ---
  const HZ = FZ + 4;                                                         // ホールの正面
  const HH = 33;                                                             // ホールの高さ（2階分）
  b.box(40, HH, 5, C.hall, EX, HH / 2, FZ + 1.5, { cast: true });
  b.box(41, 1.0, 6, C.cap, EX, HH + 0.5, FZ + 1.5);
  // 2階のガラス壁（方立の格子。7本を本数で並べる。足し算で回すと端数で右端の1本が落ちる）
  b.box(34, 9.5, 0.6, C.hallGlass, EX, 25.2, HZ + 0.1);
  for (let k = 0; k <= 6; k++) b.box(0.6, 9.7, 0.9, C.frame, EX - 17 + k * 34 / 6, 25.2, HZ + 0.3);
  b.box(34.6, 0.6, 1.0, C.frame, EX, 25.2, HZ + 0.3);                        // 中の横桟（方立より少し前）
  b.box(34.6, 0.6, 1.0, C.frame, EX, 20.6, HZ + 0.3);                        // 下の横桟
  // 無地の銘板（文字なし。板と色の棒だけ）
  b.box(22, 2.2, 0.5, C.plate, EX, 31.6, HZ + 0.3);
  b.box(22, 0.5, 0.55, C.bar, EX, 30.25, HZ + 0.32);
  // 1階: ガラス扉4枚と枠。朝の外から見るガラスは、上が空と庇を映して暗い青灰、下に暖かいロビーが透ける
  // （一様に明るい板だと、ガラスではなく不透明なクリーム色の扉に見える）。ロビーの明かりは下の自発光の箱
  b.box(29.4, 8.0, 0.2, C.doorGlass, EX, 13.2, HZ + 0.12);                   // 上の映り込み（y 9.2〜17.2）
  for (const dx of [-13.2, -5.7, 1.8, 9.3]) {                                // 各扉の左寄りの、縦の映り込み
    b.box(1.0, 13, 0.06, C.doorShine, EX + dx, 7.7, HZ + 0.26);
    b.box(0.35, 10, 0.06, C.doorShine, EX + dx + 1.2, 7.2, HZ + 0.26);
  }
  b.box(30, 0.9, 1.0, C.frame, EX, 14.6, HZ + 0.4);                          // 欄間の横桟
  b.box(30, 0.9, 1.0, C.frame, EX, 17.4, HZ + 0.4);
  for (const dx of [-15, -7.5, 0, 7.5, 15]) b.box(dx === 0 ? 0.55 : 0.9, 17.8, 1.0, C.frame, EX + dx, 8.9, HZ + 0.4);
  b.box(30, 0.6, 1.0, C.frame, EX, 0.3, HZ + 0.4);
  for (const dx of [-4, 4]) b.box(0.45, 4.2, 1.2, C.handle, EX + dx, 7.0, HZ + 0.6);    // 取っ手
  // ひさし（ホールから手前へ張り出す平らな屋根）と2本の柱
  const CZ0 = HZ, CZ1 = HZ + 22, CY = 19.2;
  b.box(38, 1.6, CZ1 - CZ0, C.canopy, EX, CY, (CZ0 + CZ1) / 2, { cast: true });
  b.box(38.4, 2.6, 0.8, C.fascia, EX, CY - 0.2, CZ1 + 0.2);
  for (const dx of [-17, 17]) b.box(2.0, CY - 0.8, 2.0, C.column, EX + dx, (CY - 0.8) / 2, CZ1 - 1.8, { cast: true });

  // --- 車寄せ: ひさしの下まで車が入るアスファルトの車路と縁石。扉の前だけ一段上げた石張りの歩道 ---
  // 学校の昇降口には無い「会社の玄関」の手がかり。柱はひさしの下の石張りの島に立つ
  const WZ = HZ + 6.4;                                                       // 扉の前の歩道の手前の縁
  const DW = 15.5;                                                           // 車路の半幅
  const AZ1 = PZ0 - 1.2;                                                     // 車路の手前の端（広場の縁石の奥）
  b.box(40, 0.5, WZ - HZ, C.step, EX, 0.25, (HZ + WZ) / 2);                 // 扉の前の歩道（天面0.5）
  b.box(2 * DW + 0.4, 0.56, 0.6, C.stepLine, EX, 0.28, WZ + 0.3);            // 歩道の縁石（両端は柱の島に埋める）
  for (const s of [-1, 1]) {
    b.box(20 - DW, 0.5, CZ1 + 3 - WZ, C.step, EX + s * (DW + 20) / 2, 0.25, (WZ + CZ1 + 3) / 2);   // 柱の島
    b.box(1.0, 0.45, AZ1 + 0.2 - CZ1 - 3, C.curbStone, EX + s * (DW + 0.5), 0.225, (CZ1 + 3 + AZ1 + 0.2) / 2); // 縁石
    b.box(0.4, 0.04, AZ1 - WZ - 2, C.asphaltLine, EX + s * (DW - 1.2), 0.07, (WZ + AZ1 - 0.8) / 2); // 路肩の白線
  }
  // 車路（天面0.05）。両脇と手前の端は縁石・島・広場の縁石の中へ埋める（端の面を重ねない）
  b.box(2 * DW + 1, 0.1, AZ1 + 0.4 - WZ, C.asphalt, EX, 0.0, (WZ + AZ1 + 0.4) / 2);
  b.box(2 * DW - 4, 0.04, 0.8, C.asphaltLine, EX, 0.07, AZ1 - 3.5);          // 広場の手前の停止線

  // --- 前庭: 建物ぎわの植え込み ---
  // 建物ぎわの低い生け垣（玄関と階段室の前は空ける）
  for (const [x0, x1] of [[BX0 + 2, TX - 9], [TX + 9, EX - 21], [EX + 21, BX1 - 2]]) {
    const xm = (x0 + x1) / 2;
    b.box(x1 - x0, 4.2, 4.6, C.hedge, xm, 2.1, FZ + 4.9);
    b.box(x1 - x0 - 0.4, 0.5, 4.2, C.hedgeTop, xm, 4.45, FZ + 4.9);
  }
  // 芝の色むら（刈り跡）
  // 乱数を引く順は変えない（後ろの林の形が変わらないように）。車路に掛かる物と、
  // 先に置いた刈り跡に重なる物（同じ高さの面が重なる）は、引いてから捨てる
  const mown = [];
  for (let i = 0; i < 30; i++) {
    const x = L + 20 + R() * (Rt - L - 40), z = -84 + R() * 46;
    if (Math.abs(x - EX) < 18) continue;
    const w = 6 + R() * 10, d = 3 + R() * 5, ry = R() * 0.6 - 0.3;
    if (Math.abs(x - EX) < DW + 1 + (w + d * 0.3) / 2 + 0.5) continue;
    const r = Math.hypot(w, d) / 2;
    if (mown.some(([mx, mz, mr]) => Math.hypot(mx - x, mz - z) < mr + r)) continue;
    mown.push([x, z, r]);
    b.box(w, 0.05, d, C.lawnDark, x, 0.03, z, { rotY: ry });
  }

  // --- 文字のない石の銘板（低い石の壁に無地の板と色の棒）---
  const SX = EX - 36, SZ = -42;
  b.box(25, 1.2, 6, C.stoneDark, SX, 0.6, SZ, { cast: true });
  b.box(22, 8.6, 3.4, C.stone, SX, 5.5, SZ, { cast: true });
  b.box(22.8, 0.8, 3.9, C.stoneDark, SX, 10.2, SZ);
  b.box(17, 3.0, 0.3, C.plate, SX, 6.4, SZ + 1.82);
  b.box(17, 0.6, 0.35, C.bar, SX, 4.2, SZ + 1.84);
  for (const dx of [-15, 15]) b.box(5.5, 2.8, 5.5, C.shrub, SX + dx, 1.4, SZ + 0.6);

  // --- 桜（満開）---
  const trees = [
    [ox - 128, -55, 1.6], [ox - 80, -68, 1.55], [ox - 36, -52, 1.15],      // 左
    [ox + 64, -58, 1.3], [ox + 152, -64, 1.45],                            // 右
  ];
  for (const [x, z, s] of trees) sakura(b, x, z, s, R);
  // 桜の下の花びらの絨毯（天面0.13）と、広場に散った花びら（天面0.16）。
  // 薄い箱どうしが同じ高さで重なると点滅するので、同じ層ですでに置いた花びらの中心から
  // 1.25（花びらの対角より長い）未満の所には置かない。絨毯は広場の縁石より手前へ出さない（石畳の目地0.12と近い）。
  // 乱数は引いてから捨てる（後ろの林の形が変わらないように）
  const carpet = [], scatter = [];
  const room = (list, x, z) => list.every(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 >= 1.25 * 1.25);
  for (const [x, z, s] of trees) {
    for (let i = 0; i < 40; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 17 * s;
      const col = PINK[(R() * 3) | 0], ry = R() * 3;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * 0.8;
      if (pz > PZ0 - 0.8 || !room(carpet, px, pz)) continue;
      carpet.push([px, pz]);
      b.box(0.95, 0.06, 0.75, col, px, 0.1, pz, { rotY: ry });
    }
  }
  for (let i = 0; i < 110; i++) {
    const x = ox - 150 + R() * 300, z = PZ0 + 1 + R() * (PZ1 - PZ0 - 2);
    const col = PINK[1 + ((R() * 2) | 0)], ry = R() * 3;
    if (!room(scatter, x, z)) continue;
    scatter.push([x, z]);
    b.box(0.9, 0.06, 0.7, col, x, 0.13, z, { rotY: ry });
  }

  // --- ベンチ（桜の下。木の座面と背もたれ、灰色の脚）---
  bench(b, ox - 110, -38.5);
  bench(b, ox - 60, -38.5);
  bench(b, ox + 40, -38.5);

  // --- 建物の後ろの林（常緑と新緑）---
  for (let x = BX0 - 30; x < BX1 + 160; x += 14 + R() * 10) {
    const h = 46 + R() * 16, w = 18 + R() * 12, z = FZ - BD - 14 - R() * 30;
    const col = C.forest[(R() * C.forest.length) | 0];
    clump(b, x, z, w, h, col, R);
  }
  // 建物の右の先にも木立（建物の端の向こうを空にしない）
  for (let x = BX1 + 18; x < BX1 + 160; x += 16 + R() * 8) {
    const h = 32 + R() * 16, w = 18 + R() * 10, z = FZ + 4 - R() * 34;
    clump(b, x, z, w, h, C.forest[(R() * C.forest.length) | 0], R);
  }
  mountains(b, ox, R);

  // --- 手前: 広場の縁の花壇（パンジー・ビオラ）と低い生け垣 ---
  const FB0 = PZ1 + 1.2, FB1 = FB0 + 7;
  b.box(Rt - L, 0.4, FB1 - FB0, C.soil, ox, 0.2, (FB0 + FB1) / 2);
  for (let x = L + 2; x < Rt; x += 2.1) {
    if (!near(x, 118)) continue;
    for (let row = 0; row < 3; row++) {
      const z = FB0 + 1.3 + row * 2.2 + (R() - 0.5) * 0.5;
      const xx = x + (row % 2) * 1.05;
      b.box(1.7, 0.8, 1.7, C.leaf, xx, 0.75, z);                               // 低い株
      if (R() < 0.15) continue;
      b.box(1.0, 0.5, 1.0, C.flower[(R() * C.flower.length) | 0], xx + (R() - 0.5) * 0.4, 1.35, z);
    }
  }
  b.box(Rt - L, 2.2, 3.6, C.hedge, ox, 1.1, FB1 + 2.4);
  b.box(Rt - L, 0.4, 3.2, C.hedgeTop, ox, 2.4, FB1 + 2.4);

  b.done();

  // --- ロビーの明かり（ガラス扉の下半分の奥。自発光なので別の描画）---
  // ホールの正面（HZ）と同じ面に置くと点滅するので、少し手前に出す。枠（HZ+0.4）よりは奥。
  // 上半分（y 9.2〜17.2）は空の映り込みの板（まとめた箱）で、高さを分けて重ねない
  box(29.4, 8.6, 0.2, C.interior, EX, 4.9, HZ + 0.12, { emissive: C.interiorGlow, receive: false });

  // --- 舞う花びら（1メッシュ。tick で動かす）---
  petals = makePetals(trees, ox, R);
}

// 桜1本。s は大きさ。ソメイヨシノの横に広い傘形を、同じ大きさのボクセルを積んで作る。
// 楕円体の中を格子で埋め、外から見える殻だけを置く（中身は描かない）。上ほど白く、下ほど濃い。
function sakura(b, x, z, s, R) {
  const k = (v) => v * s;
  b.box(k(2.6), k(10), k(2.6), C.trunk, x, k(5), z, { cast: true });
  b.box(k(3.4), k(0.9), k(3.4), C.trunkDark, x, k(0.45), z);                 // 根元
  // 枝（左右へ斜めに伸ばす。段にして傾きを出す）
  b.box(k(7), k(1.5), k(1.5), C.trunk, x - k(3.4), k(10.2), z + k(0.4), { cast: true, rotY: 0.35 });
  b.box(k(6), k(1.4), k(1.4), C.trunk, x + k(3.2), k(10.8), z - k(0.6), { cast: true, rotY: -0.45 });
  b.box(k(1.4), k(3.6), k(1.4), C.trunk, x - k(6.2), k(12.0), z + k(1.0), { cast: true });
  b.box(k(1.4), k(3.4), k(1.4), C.trunk, x + k(5.8), k(12.6), z - k(1.0), { cast: true });
  // 樹冠
  // 奥行き（RZ）は浅め。カメラから見えるのは正面と上だけで、深くすると後ろの建物の壁に刺さる
  const c = k(3.3);
  const RX = k(16), RY = k(8.2), RZ = k(10), CY = k(16.5);
  const NX = 6, NY = 3, NZ = 3;
  const inside = new Map();
  const key = (i, j, l) => `${i},${j},${l}`;
  for (let i = -NX; i <= NX; i++) for (let j = -NY; j <= NY; j++) for (let l = -NZ; l <= NZ; l++) {
    const px = i * c, py = j * c, pz = l * c;
    if (py < -RY * 0.62) continue;                                             // 傘の下面は平らに
    const e = (px / RX) ** 2 + (py / RY) ** 2 + (pz / RZ) ** 2;
    if (e <= 1 + (R() - 0.5) * 0.55) inside.set(key(i, j, l), true);
  }
  // 上下のずらしは柱（i, l）ごとに1つ。粒ごとにずらすと、縦に重なった粒の側面が同じ面で重なって点滅する
  const lift = new Map();
  const liftOf = (i, l) => {
    const kk = `${i},${l}`;
    if (!lift.has(kk)) lift.set(kk, (R() - 0.5) * k(0.8));
    return lift.get(kk);
  };
  for (const k3 of inside.keys()) {
    const [i, j, l] = k3.split(',').map(Number);
    const shell = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
      .some(([a, bb, cc]) => !inside.has(key(i + a, j + bb, l + cc)));
    if (!shell) continue;
    const hn = (j * c + RY * 0.62) / (RY * 1.62);                              // 0（下）〜1（上）
    let ci = hn > 0.82 ? 0 : hn > 0.6 ? 1 : hn > 0.38 ? 2 : hn > 0.18 ? 3 : 4;
    const rr = R();
    if (rr < 0.18 && ci > 0) ci--; else if (rr > 0.86 && ci < 4) ci++;
    b.box(c, c, c, PINK[ci], x + i * c, CY + j * c + liftOf(i, l), z + l * c, { cast: true });
  }
  // 縁から垂れた房（下の段の外側に、小さめの濃い粒）
  for (let n = 0; n < 9; n++) {
    const a = R() * Math.PI * 2;
    const px = Math.cos(a) * RX * 0.92, pz = Math.sin(a) * RZ * 0.92;
    b.box(c * 0.75, c * 0.75, c * 0.75, PINK[4 + ((R() * 2) | 0)], x + px, CY - RY * 0.62 - c * 0.2 - R() * k(1.2), z + pz);
  }
}

// 林の木1本（幹は建物に隠れて見えないので、丸い樹冠を段々に積む）
function clump(b, x, z, w, h, col, R) {
  b.box(w * 0.9, h * 0.56, w * 0.8, col, x, h * 0.28, z);
  b.box(w * 1.06, h * 0.2, w * 0.9, col, x, h * 0.62, z + 0.3);
  b.box(w * 0.8, h * 0.15, w * 0.72, col, x + (R() - 0.5) * 3, h * 0.79, z + 0.6);
  b.box(w * 0.46, h * 0.1, w * 0.44, col, x + (R() - 0.5) * 3, h * 0.915, z + 0.9);
}

// ベンチ。座面は木の板3枚、背もたれ2枚、脚は灰色の鋳物（座面の高さは人の背丈18の1/4）
function bench(b, x, z) {
  for (let i = 0; i < 3; i++) b.box(13.5, 0.6, 1.1, C.bench, x, 4.4, z - 1.2 + i * 1.25);
  for (let i = 0; i < 2; i++) b.box(13.5, 1.0, 0.55, C.bench, x, 6.3 + i * 1.7, z - 2.1);
  for (const dx of [-5.6, 5.6]) {
    b.box(0.9, 4.1, 3.8, C.benchLeg, x + dx, 2.05, z);
    b.box(0.9, 4.6, 0.8, C.benchLeg, x + dx, 6.7, z - 1.9);
  }
}

// 遠くの山。低くなだらかな稜線を、春霞（霧）で空の色に溶かす。
// 林の上に山の肩だけが淡く出る高さ。同じ形のピラミッドが並ばないよう、段の数・幅・頂の広さ・
// 裾の張り出し方を山ごとに変える（尖った峰と、台形の長い尾根が混ざる）
function mountains(b, ox, R) {
  for (let x = ox - 900; x < ox + 900;) {
    const w = 260 + R() * 260, h = 28 + R() * 26, z = -560 - R() * 70;
    const steps = 5 + ((R() * 3) | 0), sh = h / steps;
    const top = 0.12 + R() * 0.3;                                               // 頂の幅（裾に対する割合）
    const ex = 1.3 + R() * 1.5;                                                 // 大きいほど裾が長く、峰が尖る
    const sw = (i) => w * (top + (1 - top) * (1 - i / steps) ** ex);            // 段の幅
    const lean = (R() - 0.5) * w * 0.08;                                        // 峰を左右どちらかへ寄せる
    for (let i = 0; i < steps; i++) {
      b.box(sw(i), sh, 70 - i * 5, C.mountain, x + lean * i, sh * (i + 0.5), z - i * 2.5);
    }
    x += w * (0.5 + R() * 0.3);
  }
}

// 舞う花びら。全部で1つのメッシュにして、頂点を毎フレーム書き換える（描画1回）
// 桜の樹冠から落ちるもの（tree）と、広場の上を風で流れるもの（air）の2種類
function makePetals(trees, ox, R) {
  const list = [];
  for (const [x, z, s] of trees) {
    const n = Math.round(11 * s);
    for (let i = 0; i < n; i++) list.push({ kind: 'tree', tx: x, tz: z, s, sc: 1 });
  }
  for (let i = 0; i < 14; i++) list.push({ kind: 'air', ox, sc: 0.6 });
  const N = list.length;
  const unit = new THREE.BoxGeometry(1.25, 0.15, 0.95);
  const UP = unit.attributes.position.array, UN = unit.attributes.normal.array, UI = unit.index.array;
  const NV = UP.length / 3;
  const pos = new Float32Array(N * NV * 3), nor = new Float32Array(N * NV * 3), col = new Float32Array(N * NV * 3);
  const idx = [];
  const c = new THREE.Color();
  list.forEach((p, i) => {
    c.set(PINK[(R() * 3) | 0]);
    for (let v = 0; v < NV; v++) col.set([c.r, c.g, c.b], (i * NV + v) * 3);
    for (let k = 0; k < UI.length; k++) idx.push(i * NV + UI[k]);
    spawn(p, R, true);
    p.rx = R() * 6; p.ry = R() * 6; p.wx = 1.5 + R() * 2.5; p.wy = 0.8 + R() * 1.6;
    p.ph = R() * 6.28;
  });
  unit.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.frustumCulled = false;          // 頂点が動くので、最初の外接球で切られないように
  m.castShadow = false; m.receiveShadow = false;
  addScenery(m);
  const st = { m, geo, list, UP, UN, NV, R, mat: new THREE.Matrix4(), eu: new THREE.Euler() };
  writePetals(st);
  return st;
}

// 落とし直す。first は最初の配置（高さをばらして、一斉に降り始めないように）
function spawn(p, R, first) {
  if (p.kind === 'air') {
    // 広場の手前寄りを、左から右へ低く流れる
    p.x = p.ox - 150 + R() * (first ? 300 : 60);
    p.z = 28 + R() * 18;                                              // 歩行帯の手前（帯の中は空ける）
    p.y = first ? 1 + R() * 9 : 6 + R() * 6;
    p.vy = 0.5 + R() * 0.6;
    p.vx = 5 + R() * 4;
    p.vz = (R() - 0.5) * 1.2;
    p.amp = 1.5 + R() * 2;
    return;
  }
  const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 14 * p.s;
  p.x = p.tx + Math.cos(a) * r;
  p.z = p.tz + Math.sin(a) * r * 0.8 + 2;
  p.y = first ? 1 + R() * 18 * p.s : (10 + R() * 8) * p.s;
  p.vy = 2.0 + R() * 1.6;           // 落ちる速さ
  p.vx = 1.4 + R() * 2.2;           // そよ風（右へ）
  p.vz = 0.2 + R() * 0.6;           // 少し手前へ（歩行帯へは流れ込まない程度）
  p.amp = 1.2 + R() * 1.6;
}

function writePetals(st) {
  const { list, UP, UN, NV, mat, eu } = st;
  const P = st.geo.attributes.position.array, Nn = st.geo.attributes.normal.array;
  list.forEach((p, i) => {
    eu.set(p.rx, p.ry, p.rx * 0.5);
    mat.makeRotationFromEuler(eu);
    const e = mat.elements, sc = p.sc;
    for (let k = 0; k < NV; k++) {
      const o = (i * NV + k) * 3;
      const x = UP[k * 3] * sc, y = UP[k * 3 + 1] * sc, z = UP[k * 3 + 2] * sc;
      P[o] = e[0] * x + e[4] * y + e[8] * z + p.x;
      P[o + 1] = e[1] * x + e[5] * y + e[9] * z + p.y;
      P[o + 2] = e[2] * x + e[6] * y + e[10] * z + p.z;
      const nx = UN[k * 3], ny = UN[k * 3 + 1], nz = UN[k * 3 + 2];
      Nn[o] = e[0] * nx + e[4] * ny + e[8] * nz;
      Nn[o + 1] = e[1] * nx + e[5] * ny + e[9] * nz;
      Nn[o + 2] = e[2] * nx + e[6] * ny + e[10] * nz;
    }
  });
  st.geo.attributes.position.needsUpdate = true;
  st.geo.attributes.normal.needsUpdate = true;
}

export function onEvent(name, arg) {
  if (name !== 'tick' || !petals || !arg) return;
  const dt = Math.min(0.05, Math.max(0, arg.dt || 0));
  if (!dt) return;
  const t = arg.t || 0;
  for (const p of petals.list) {
    // ひらひら: 左右に揺れながら、ゆっくり落ちる
    p.y -= p.vy * dt;
    p.x += (p.vx + Math.sin(t * 1.7 + p.ph) * p.amp) * dt;
    p.z += (p.vz + Math.cos(t * 1.3 + p.ph) * 0.6) * dt;
    p.rx += p.wx * dt; p.ry += p.wy * dt;
    // 歩行帯（z −25〜+25）には入れない。木の花びらは帯の奥、風の花びらは帯の手前を流れる
    p.z = p.kind === 'air' ? Math.min(47, Math.max(27, p.z)) : Math.min(-27, p.z);
    if (p.y < 0.2 || (p.kind === 'air' && p.x > p.ox + 170)) spawn(p, petals.R, false);
  }
  writePetals(petals);
}
