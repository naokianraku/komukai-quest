// 小向クエスト2 — セリフ（★仮置き。今後 セリフ一覧2.md から生成して差し替える）
//
// 1の TAUNTS オブジェクトへ追加登録するだけなので、game/src/taunts.js には一切手を入れない
// （あちらは scripts/serifs-to-taunts.mjs が全上書き生成するため、直接編集すると壊れる）。
import { TAUNTS } from '../../game/src/taunts.js';

export const TAUNTS2 = {
  // --- 同期（味方）---
  douki_sekkei: ['……', 'そこ、図面と違う'],
  douki_genba:  ['おう！', '現場は回してある'],
  douki_hinsho: ['規程は確認済みだ', 'エビデンスは残した'],
  shutantou:    ['あとは頼む', 'そこは俺が持つ'],

  // --- 直属PM（課長・全章の反復エネミー）---
  pm: ['で、いつ直るんだ', '向こうに言わせるな', '催促はしたのか', '聞き方が悪いんじゃないのか'],

  // --- 第1章 社内 ---
  jinji:  ['学生気分が抜けてない'],
  manner: ['名刺の向きが逆！', 'もう一回'],
  anzen:  ['指差呼称やり直し！'],
  ryocho: ['門限は10時だと言ったはずだが'],
  kyoiku: ['で、君は何がしたいの？'],

  // --- 第2章 M菱重工 ---
  m_kikai:  ['重量、あと20kg落として'],
  m_denso:  ['電源容量はこれ以上出せません'],
  m_sekkei: ['開口部の寸法は、もう図面が出てます'],
  m_pm:     ['そちらの都合ですよね', 'うちは予定どおりです'],

  // --- 第3章 GR社 ---
  gr_chotatsu: ['Lead time is 52 weeks.'],
  gr_gijutsu:  ['確認中です'],
  gr_seizo:    ['今度こそ動きます'],
  gr_pm:       ['We are working on it.'],

  // --- 第4章 L3社 ---
  l3_toiawase: ['回答不可'],
  l3_yushutsu: ['その質問自体が規制対象です'],
  l3_pm:       ['提供できません'],

  // --- 第5章 LM社 ---
  lm_keiyaku: ['それはSOWにありません'],
  lm_cr:      ['Change order を'],
  lm_shiken:  ['試験不合格'],
  lm_kanri:   ['見積もりを出します'],
  lm_pm:      ["That's out of scope."],

  // --- 代理店（攻撃しないが間に立つ）---
  dairiten: ['先方はそうは言っていません', '……（通訳中）'],

  // --- 最終章 ---
  kensakan:        ['契約仕様を満たしていませんね'],
  kishi_kigen:     ['もう間に合わない'],
  kishi_seinou:    ['規定値に届かない'],
  kishi_sonshitsu: ['これ以上は出せない'],
  kishi_keisou:    ['代理人を立てました'],
  kancho_pm:       ['見込みがないと判断しました'],
};

// 1のカテゴリとキーが重ならないので、そのまま合流させて randomTaunt() から引けるようにする
Object.assign(TAUNTS, TAUNTS2);
