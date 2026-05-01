// ===========================================================================
// 経穴データ。
// 座標系は SVG viewBox 0..100 (x) × 0..133 (y)。
// 1200×1600 の体図イラスト (clinic-app/public/chart/body-{front,back}.png) に
// 合わせて配置。
//
// 解剖学的ランドマーク (8等身比から逆算):
//   y =   6.7  : 頭頂 (百会)
//   y =  15    : 眉間 (印堂)
//   y =  22    : オトガイ (顎)
//   y =  27    : 第7頸椎 (大椎・肩線レベル)
//   y =  37    : 乳頭線 (膻中)
//   y =  47    : 剣状突起 / 中脘
//   y =  52    : 臍 (神闕)
//   y =  58    : 関元
//   y =  67    : 恥骨上縁 / 鼠径部
//   y =  82    : 大腿中央
//   y =  92    : 膝上 (血海)
//   y =  97    : 膝関節 (委中)
//   y = 109    : 下腿中央 (承山)
//   y = 120    : 内踝・外踝 (太渓)
//   y = 128    : 足背 (太衝・厲兌)
//
//   x = 50      : 正中
//   x = 28/72   : 肩端 (acromion)
//   x = 22/78   : 肘 (上腕の半分)
//   x = 16/84   : 手首
//   x = 12/88   : 手指先端 (合谷外側)
//   x = 33/67   : 大転子
//   x = 38/62   : ASIS / 鼠径
//   x = 41/59   : 膝
//   x = 44/56   : 内踝・足
//
// 2 モード:
//   - "main"  : 主要 40 穴 (精密配置)
//   - "full"  : WHO 標準 361 穴 (経絡パス補間生成・概略位置)
// ===========================================================================

export type AcupointView = "front" | "back";
export type AcupointSide = "single" | "pair";

export type AcupointDef = {
  id: string;
  label: string;
  meridian?: string;
  view: AcupointView;
  /** 0..100 (pair の場合は左側 x<50 を定義し、右側は 100-x で自動生成) */
  x: number;
  /** 0..133 */
  y: number;
  side: AcupointSide;
  isMain?: boolean;
};

export type AcupointDot = {
  key: string;
  label: string;
  meridian?: string;
  view: AcupointView;
  x: number;
  y: number;
  isMain?: boolean;
};

// ---------------------------------------------------------------------------
// 主要 40 穴 — 精密配置
// ---------------------------------------------------------------------------
const MAIN_ACUPOINTS: AcupointDef[] = [
  // ── 頭部・顔 ──────────────────────────────────────────────────
  { id: "GV20",    label: "百会",   meridian: "GV", view: "back",  x: 50,   y: 6.7,  side: "single", isMain: true },
  { id: "EX-HN3",  label: "印堂",                   view: "front", x: 50,   y: 15,   side: "single", isMain: true },

  // ── 首 ────────────────────────────────────────────────────────
  { id: "GV16",    label: "風府",   meridian: "GV", view: "back",  x: 50,   y: 19,   side: "single", isMain: true },
  { id: "GB20",    label: "風池",   meridian: "GB", view: "back",  x: 44,   y: 20,   side: "pair",   isMain: true },
  { id: "BL10",    label: "天柱",   meridian: "BL", view: "back",  x: 47,   y: 22,   side: "pair",   isMain: true },
  { id: "GV14",    label: "大椎",   meridian: "GV", view: "back",  x: 50,   y: 27,   side: "single", isMain: true },

  // ── 肩 ────────────────────────────────────────────────────────
  { id: "GB21",    label: "肩井",   meridian: "GB", view: "back",  x: 35,   y: 27,   side: "pair",   isMain: true },
  { id: "SI15",    label: "肩中兪", meridian: "SI", view: "back",  x: 42,   y: 28,   side: "pair",   isMain: true },
  { id: "SI14",    label: "肩外兪", meridian: "SI", view: "back",  x: 38,   y: 30,   side: "pair",   isMain: true },
  { id: "BL12",    label: "風門",   meridian: "BL", view: "back",  x: 45,   y: 32,   side: "pair",   isMain: true },

  // ── 胸 ────────────────────────────────────────────────────────
  { id: "CV17",    label: "膻中",   meridian: "CV", view: "front", x: 50,   y: 37,   side: "single", isMain: true },
  { id: "LU1",     label: "中府",   meridian: "LU", view: "front", x: 35,   y: 32,   side: "pair",   isMain: true },

  // ── 腕 (前面) — 体側に下げた状態 ──────────────────────────────
  { id: "LI11",    label: "曲池",   meridian: "LI", view: "front", x: 23,   y: 50,   side: "pair",   isMain: true },
  { id: "LI10",    label: "手三里", meridian: "LI", view: "front", x: 22,   y: 53,   side: "pair",   isMain: true },
  { id: "PC6",     label: "内関",   meridian: "PC", view: "front", x: 19,   y: 62,   side: "pair",   isMain: true },
  { id: "LU9",     label: "太淵",   meridian: "LU", view: "front", x: 17,   y: 66,   side: "pair",   isMain: true },
  { id: "LI4",     label: "合谷",   meridian: "LI", view: "front", x: 14,   y: 70,   side: "pair",   isMain: true },

  // ── 腹 ────────────────────────────────────────────────────────
  { id: "CV12",    label: "中脘",   meridian: "CV", view: "front", x: 50,   y: 47,   side: "single", isMain: true },
  { id: "CV8",     label: "神闕",   meridian: "CV", view: "front", x: 50,   y: 52,   side: "single", isMain: true },
  { id: "CV4",     label: "関元",   meridian: "CV", view: "front", x: 50,   y: 58,   side: "single", isMain: true },
  { id: "ST25",    label: "天枢",   meridian: "ST", view: "front", x: 46,   y: 52,   side: "pair",   isMain: true },

  // ── 背中 — 脊柱外 1.5寸 (BL 第1線) ───────────────────────────
  { id: "BL13",    label: "肺兪",   meridian: "BL", view: "back",  x: 46,   y: 33,   side: "pair",   isMain: true },
  { id: "BL15",    label: "心兪",   meridian: "BL", view: "back",  x: 46,   y: 38,   side: "pair",   isMain: true },
  { id: "BL17",    label: "膈兪",   meridian: "BL", view: "back",  x: 46,   y: 43,   side: "pair",   isMain: true },
  { id: "BL18",    label: "肝兪",   meridian: "BL", view: "back",  x: 46,   y: 47,   side: "pair",   isMain: true },
  { id: "BL19",    label: "胆兪",   meridian: "BL", view: "back",  x: 46,   y: 49,   side: "pair",   isMain: true },
  { id: "BL20",    label: "脾兪",   meridian: "BL", view: "back",  x: 46,   y: 52,   side: "pair",   isMain: true },
  { id: "BL21",    label: "胃兪",   meridian: "BL", view: "back",  x: 46,   y: 55,   side: "pair",   isMain: true },
  { id: "BL23",    label: "腎兪",   meridian: "BL", view: "back",  x: 46,   y: 60,   side: "pair",   isMain: true },
  { id: "BL25",    label: "大腸兪", meridian: "BL", view: "back",  x: 46,   y: 65,   side: "pair",   isMain: true },
  { id: "GV4",     label: "命門",   meridian: "GV", view: "back",  x: 50,   y: 60,   side: "single", isMain: true },

  // ── 臀部 ──────────────────────────────────────────────────────
  { id: "GB30",    label: "環跳",   meridian: "GB", view: "back",  x: 36,   y: 75,   side: "pair",   isMain: true },

  // ── 下肢 (前面) ─────────────────────────────────────────────
  { id: "SP10",    label: "血海",   meridian: "SP", view: "front", x: 43,   y: 92,   side: "pair",   isMain: true },
  { id: "ST36",    label: "足三里", meridian: "ST", view: "front", x: 44,   y: 100,  side: "pair",   isMain: true },
  { id: "GB34",    label: "陽陵泉", meridian: "GB", view: "front", x: 41,   y: 100,  side: "pair",   isMain: true },
  { id: "SP6",     label: "三陰交", meridian: "SP", view: "front", x: 46,   y: 117,  side: "pair",   isMain: true },
  { id: "LR3",     label: "太衝",   meridian: "LR", view: "front", x: 47,   y: 128,  side: "pair",   isMain: true },

  // ── 下肢 (後面) ─────────────────────────────────────────────
  { id: "BL40",    label: "委中",   meridian: "BL", view: "back",  x: 46,   y: 97,   side: "pair",   isMain: true },
  { id: "BL57",    label: "承山",   meridian: "BL", view: "back",  x: 47,   y: 109,  side: "pair",   isMain: true },
  { id: "KI3",     label: "太渓",   meridian: "KI", view: "back",  x: 49,   y: 120,  side: "pair",   isMain: true },
];

// ---------------------------------------------------------------------------
// 14 経絡パス定義 — 解剖ランドマークに沿ったアンカーから等分補間で生成
// ---------------------------------------------------------------------------

type Anchor = { view: AcupointView; x: number; y: number };
type MeridianPath = {
  prefix: string;
  count: number;
  side: AcupointSide;
  jaName: string;
  labels: string[];
  anchors: Anchor[];
};

const M: MeridianPath[] = [
  // 督脈 GV (28穴): 尾骨先端 → 仙骨 → 腰椎 → 胸椎 → 頸椎 → 頭頂 → 顔正中 → 上唇上
  {
    prefix: "GV", count: 28, side: "single", jaName: "督脈",
    labels: [
      "長強","腰兪","腰陽関","命門","懸枢","脊中","中枢","筋縮","至陽","霊台",
      "神道","身柱","陶道","大椎","瘂門","風府","脳戸","強間","後頂","百会",
      "前頂","顖会","上星","神庭","素髎","水溝","兌端","龈交",
    ],
    anchors: [
      { view: "back",  x: 50, y: 75 },   // GV1 長強 (尾骨先)
      { view: "back",  x: 50, y: 67 },   // GV3 腰陽関
      { view: "back",  x: 50, y: 60 },   // GV4 命門 (L2)
      { view: "back",  x: 50, y: 53 },   // GV6 脊中 (T11)
      { view: "back",  x: 50, y: 47 },   // GV8 筋縮 (T9)
      { view: "back",  x: 50, y: 42 },   // GV9 至陽 (T7)
      { view: "back",  x: 50, y: 37 },   // GV11 神道 (T5)
      { view: "back",  x: 50, y: 33 },   // GV12 身柱 (T3)
      { view: "back",  x: 50, y: 27 },   // GV14 大椎 (C7)
      { view: "back",  x: 50, y: 23 },   // GV15 瘂門
      { view: "back",  x: 50, y: 19 },   // GV16 風府
      { view: "back",  x: 50, y: 13 },   // GV18 強間 (頭頂後)
      { view: "back",  x: 50, y: 6.7 },  // GV20 百会 (頭頂)
      { view: "front", x: 50, y: 9 },    // GV23 上星
      { view: "front", x: 50, y: 12 },   // GV24 神庭
      { view: "front", x: 50, y: 18 },   // GV25 素髎 (鼻先)
      { view: "front", x: 50, y: 20 },   // GV26 水溝 (人中)
      { view: "front", x: 50, y: 22 },   // GV28 龈交
    ],
  },
  // 任脈 CV (24穴): 会陰 → 恥骨 → 腹正中 → 胸正中 → 喉 → 下唇下
  {
    prefix: "CV", count: 24, side: "single", jaName: "任脈",
    labels: [
      "会陰","曲骨","中極","関元","石門","気海","陰交","神闕","水分","下脘",
      "建里","中脘","上脘","巨闕","鳩尾","中庭","膻中","玉堂","紫宮","華蓋",
      "璇璣","天突","廉泉","承漿",
    ],
    anchors: [
      { view: "front", x: 50, y: 75 },  // CV1 会陰
      { view: "front", x: 50, y: 67 },  // CV2 曲骨 (恥骨)
      { view: "front", x: 50, y: 64 },  // CV3 中極
      { view: "front", x: 50, y: 58 },  // CV4 関元
      { view: "front", x: 50, y: 55 },  // CV6 気海
      { view: "front", x: 50, y: 52 },  // CV8 神闕 (臍)
      { view: "front", x: 50, y: 49 },  // CV10 下脘
      { view: "front", x: 50, y: 47 },  // CV12 中脘
      { view: "front", x: 50, y: 44 },  // CV14 巨闕
      { view: "front", x: 50, y: 41 },  // CV15 鳩尾
      { view: "front", x: 50, y: 37 },  // CV17 膻中
      { view: "front", x: 50, y: 34 },  // CV18 玉堂
      { view: "front", x: 50, y: 31 },  // CV20 華蓋
      { view: "front", x: 50, y: 27 },  // CV22 天突
      { view: "front", x: 50, y: 23 },  // CV23 廉泉
      { view: "front", x: 50, y: 21 },  // CV24 承漿 (下唇下)
    ],
  },
  // 手太陰肺経 LU (11穴): 中府 (鎖骨下) → 上腕前外 → 前腕橈側 → 母指
  {
    prefix: "LU", count: 11, side: "pair", jaName: "手太陰肺経",
    labels: ["中府","雲門","天府","侠白","尺沢","孔最","列欠","経渠","太淵","魚際","少商"],
    anchors: [
      { view: "front", x: 35, y: 32 },  // LU1 中府
      { view: "front", x: 35, y: 30 },  // LU2 雲門
      { view: "front", x: 30, y: 38 },  // LU3 天府
      { view: "front", x: 27, y: 45 },  // LU4 侠白
      { view: "front", x: 23, y: 50 },  // LU5 尺沢 (肘)
      { view: "front", x: 20, y: 58 },  // LU6 孔最
      { view: "front", x: 18, y: 64 },  // LU7 列欠
      { view: "front", x: 17, y: 65 },  // LU8 経渠
      { view: "front", x: 17, y: 66 },  // LU9 太淵 (手首)
      { view: "front", x: 16, y: 68 },  // LU10 魚際
      { view: "front", x: 15, y: 70 },  // LU11 少商 (母指)
    ],
  },
  // 手陽明大腸経 LI (20穴): 示指爪甲 → 前腕橈背側 → 上腕外側 → 肩 → 頸 → 鼻翼
  {
    prefix: "LI", count: 20, side: "pair", jaName: "手陽明大腸経",
    labels: ["商陽","二間","三間","合谷","陽渓","偏歴","温溜","下廉","上廉","手三里",
            "曲池","肘髎","手五里","臂臑","肩髃","巨骨","天鼎","扶突","禾髎","迎香"],
    anchors: [
      { view: "front", x: 12, y: 71 },  // LI1 商陽 (示指)
      { view: "front", x: 13, y: 70 },  // LI2 二間
      { view: "front", x: 14, y: 69 },  // LI3 三間
      { view: "front", x: 14, y: 70 },  // LI4 合谷
      { view: "front", x: 16, y: 65 },  // LI5 陽渓
      { view: "front", x: 18, y: 60 },  // LI6 偏歴
      { view: "front", x: 19, y: 57 },  // LI7 温溜
      { view: "front", x: 20, y: 55 },  // LI8 下廉
      { view: "front", x: 21, y: 53 },  // LI9 上廉
      { view: "front", x: 22, y: 53 },  // LI10 手三里
      { view: "front", x: 23, y: 50 },  // LI11 曲池
      { view: "front", x: 24, y: 48 },  // LI12 肘髎
      { view: "front", x: 26, y: 43 },  // LI13 手五里
      { view: "front", x: 28, y: 38 },  // LI14 臂臑
      { view: "front", x: 30, y: 30 },  // LI15 肩髃
      { view: "front", x: 33, y: 28 },  // LI16 巨骨
      { view: "front", x: 42, y: 25 },  // LI17 天鼎
      { view: "front", x: 45, y: 23 },  // LI18 扶突
      { view: "front", x: 47, y: 20 },  // LI19 禾髎
      { view: "front", x: 47, y: 19 },  // LI20 迎香 (鼻翼)
    ],
  },
  // 足陽明胃経 ST (45穴): 眼下 → 顔 → 頸 → 胸 → 腹 → 鼠径 → 大腿前 → 下腿前外 → 第二趾
  {
    prefix: "ST", count: 45, side: "pair", jaName: "足陽明胃経",
    labels: ["承泣","四白","巨髎","地倉","大迎","頬車","下関","頭維","人迎","水突",
            "気舎","欠盆","気戸","庫房","屋翳","膺窓","乳中","乳根","不容","承満",
            "梁門","関門","太乙","滑肉門","天枢","外陵","大巨","水道","帰来","気衝",
            "髀関","伏兎","陰市","梁丘","犢鼻","足三里","上巨虚","条口","下巨虚","豊隆",
            "解渓","衝陽","陥谷","内庭","厲兌"],
    anchors: [
      { view: "front", x: 47, y: 16 },  // ST1 承泣
      { view: "front", x: 47, y: 17 },  // ST2 四白
      { view: "front", x: 47, y: 18 },  // ST3 巨髎
      { view: "front", x: 47, y: 20 },  // ST4 地倉
      { view: "front", x: 46, y: 21 },  // ST5 大迎
      { view: "front", x: 45, y: 21 },  // ST6 頬車
      { view: "front", x: 44, y: 18 },  // ST7 下関
      { view: "front", x: 44, y: 13 },  // ST8 頭維
      { view: "front", x: 46, y: 24 },  // ST9 人迎
      { view: "front", x: 46, y: 26 },  // ST10 水突
      { view: "front", x: 46, y: 28 },  // ST11 気舎
      { view: "front", x: 42, y: 30 },  // ST12 欠盆
      { view: "front", x: 42, y: 32 },  // ST13 気戸
      { view: "front", x: 41, y: 34 },  // ST14 庫房
      { view: "front", x: 40, y: 36 },  // ST15 屋翳
      { view: "front", x: 40, y: 38 },  // ST16 膺窓
      { view: "front", x: 39, y: 37 },  // ST17 乳中 (乳頭)
      { view: "front", x: 39, y: 40 },  // ST18 乳根
      { view: "front", x: 45, y: 44 },  // ST19 不容
      { view: "front", x: 45, y: 46 },  // ST20 承満
      { view: "front", x: 45, y: 48 },  // ST21 梁門
      { view: "front", x: 45, y: 50 },  // ST22 関門
      { view: "front", x: 46, y: 51 },  // ST23 太乙
      { view: "front", x: 46, y: 52 },  // ST24 滑肉門
      { view: "front", x: 46, y: 52 },  // ST25 天枢 (臍外)
      { view: "front", x: 46, y: 54 },  // ST26 外陵
      { view: "front", x: 46, y: 57 },  // ST27 大巨
      { view: "front", x: 46, y: 60 },  // ST28 水道
      { view: "front", x: 46, y: 63 },  // ST29 帰来
      { view: "front", x: 46, y: 66 },  // ST30 気衝
      { view: "front", x: 42, y: 70 },  // ST31 髀関
      { view: "front", x: 42, y: 80 },  // ST32 伏兎
      { view: "front", x: 42, y: 88 },  // ST33 陰市
      { view: "front", x: 42, y: 92 },  // ST34 梁丘
      { view: "front", x: 42, y: 96 },  // ST35 犢鼻
      { view: "front", x: 44, y: 100 }, // ST36 足三里
      { view: "front", x: 44, y: 105 }, // ST37 上巨虚
      { view: "front", x: 44, y: 109 }, // ST38 条口
      { view: "front", x: 44, y: 113 }, // ST39 下巨虚
      { view: "front", x: 44, y: 110 }, // ST40 豊隆
      { view: "front", x: 45, y: 119 }, // ST41 解渓
      { view: "front", x: 46, y: 122 }, // ST42 衝陽
      { view: "front", x: 47, y: 125 }, // ST43 陥谷
      { view: "front", x: 48, y: 127 }, // ST44 内庭
      { view: "front", x: 49, y: 129 }, // ST45 厲兌
    ],
  },
  // 足太陰脾経 SP (21穴): 母趾内側 → 下腿内側 → 大腿内側 → 腹 → 脇
  {
    prefix: "SP", count: 21, side: "pair", jaName: "足太陰脾経",
    labels: ["隠白","大都","太白","公孫","商丘","三陰交","漏谷","地機","陰陵泉","血海",
            "箕門","衝門","府舎","腹結","大横","腹哀","食竇","天渓","胸郷","周栄","大包"],
    anchors: [
      { view: "front", x: 48, y: 129 }, // SP1 隠白 (母趾内)
      { view: "front", x: 48, y: 128 }, // SP2 大都
      { view: "front", x: 47, y: 126 }, // SP3 太白
      { view: "front", x: 47, y: 124 }, // SP4 公孫
      { view: "front", x: 47, y: 121 }, // SP5 商丘
      { view: "front", x: 46, y: 117 }, // SP6 三陰交
      { view: "front", x: 45, y: 112 }, // SP7 漏谷
      { view: "front", x: 44, y: 105 }, // SP8 地機
      { view: "front", x: 44, y: 100 }, // SP9 陰陵泉
      { view: "front", x: 43, y: 92 },  // SP10 血海
      { view: "front", x: 41, y: 82 },  // SP11 箕門
      { view: "front", x: 39, y: 67 },  // SP12 衝門
      { view: "front", x: 39, y: 65 },  // SP13 府舎
      { view: "front", x: 41, y: 58 },  // SP14 腹結
      { view: "front", x: 42, y: 52 },  // SP15 大横
      { view: "front", x: 42, y: 47 },  // SP16 腹哀
      { view: "front", x: 38, y: 39 },  // SP17 食竇
      { view: "front", x: 36, y: 36 },  // SP18 天渓
      { view: "front", x: 35, y: 33 },  // SP19 胸郷
      { view: "front", x: 33, y: 31 },  // SP20 周栄
      { view: "front", x: 28, y: 38 },  // SP21 大包 (脇)
    ],
  },
  // 手少陰心経 HT (9穴): 腋窩 → 上腕内側 → 前腕尺側 → 小指内
  {
    prefix: "HT", count: 9, side: "pair", jaName: "手少陰心経",
    labels: ["極泉","青霊","少海","霊道","通里","陰郄","神門","少府","少衝"],
    anchors: [
      { view: "front", x: 29, y: 33 },  // HT1 極泉 (腋下)
      { view: "front", x: 27, y: 42 },  // HT2 青霊
      { view: "front", x: 25, y: 50 },  // HT3 少海 (肘内)
      { view: "front", x: 22, y: 57 },  // HT4 霊道
      { view: "front", x: 21, y: 60 },  // HT5 通里
      { view: "front", x: 21, y: 62 },  // HT6 陰郄
      { view: "front", x: 20, y: 64 },  // HT7 神門 (手首)
      { view: "front", x: 18, y: 67 },  // HT8 少府
      { view: "front", x: 16, y: 70 },  // HT9 少衝 (小指)
    ],
  },
  // 手太陽小腸経 SI (19穴): 小指外 → 前腕尺背側 → 上腕外背 → 肩甲 → 顔
  {
    prefix: "SI", count: 19, side: "pair", jaName: "手太陽小腸経",
    labels: ["少沢","前谷","後渓","腕骨","陽谷","養老","支正","小海","肩貞","臑兪",
            "天宗","秉風","曲垣","肩外兪","肩中兪","天窓","天容","顴髎","聴宮"],
    anchors: [
      { view: "back",  x: 16, y: 70 },  // SI1 少沢
      { view: "back",  x: 16, y: 68 },  // SI2 前谷
      { view: "back",  x: 16, y: 66 },  // SI3 後渓
      { view: "back",  x: 16, y: 65 },  // SI4 腕骨
      { view: "back",  x: 17, y: 64 },  // SI5 陽谷
      { view: "back",  x: 18, y: 62 },  // SI6 養老
      { view: "back",  x: 19, y: 56 },  // SI7 支正
      { view: "back",  x: 22, y: 50 },  // SI8 小海 (肘)
      { view: "back",  x: 30, y: 32 },  // SI9 肩貞
      { view: "back",  x: 32, y: 30 },  // SI10 臑兪
      { view: "back",  x: 38, y: 36 },  // SI11 天宗
      { view: "back",  x: 38, y: 30 },  // SI12 秉風
      { view: "back",  x: 40, y: 32 },  // SI13 曲垣
      { view: "back",  x: 38, y: 30 },  // SI14 肩外兪
      { view: "back",  x: 42, y: 28 },  // SI15 肩中兪
      { view: "back",  x: 45, y: 23 },  // SI16 天窓
      { view: "back",  x: 46, y: 21 },  // SI17 天容
      { view: "back",  x: 46, y: 18 },  // SI18 顴髎
      { view: "back",  x: 45, y: 17 },  // SI19 聴宮
    ],
  },
  // 足太陽膀胱経 BL (67穴): 内眼角 → 頭頂 → 後頭 → 背中(脊柱外1.5寸の第1線) → 第2線 → 臀部 → 大腿後 → 膝裏 → 下腿後 → 足小指
  // 67穴は最大経絡。背中の第1線+第2線を含むので背中が密
  {
    prefix: "BL", count: 67, side: "pair", jaName: "足太陽膀胱経",
    labels: [
      "睛明","攅竹","眉衝","曲差","五処","承光","通天","絡却","玉枕","天柱",
      "大杼","風門","肺兪","厥陰兪","心兪","督兪","膈兪","肝兪","胆兪","脾兪",
      "胃兪","三焦兪","腎兪","気海兪","大腸兪","関元兪","小腸兪","膀胱兪","中膂兪","白環兪",
      "上髎","次髎","中髎","下髎","会陽","承扶","殷門","浮郄","委陽","委中",
      "附分","魄戸","膏肓","神堂","譩譆","膈関","魂門","陽綱","意舎","胃倉",
      "肓門","志室","胞肓","秩辺","合陽","承筋","承山","飛揚","跗陽","崑崙",
      "僕参","申脈","金門","京骨","束骨","足通谷","至陰",
    ],
    anchors: [
      { view: "front", x: 48, y: 16 },  // BL1 睛明 (内眼角)
      { view: "front", x: 47, y: 14 },  // BL2 攅竹
      { view: "back",  x: 48, y: 9 },   // BL5 五処
      { view: "back",  x: 48, y: 7 },   // BL6 承光
      { view: "back",  x: 48, y: 8 },   // BL7 通天
      { view: "back",  x: 48, y: 12 },  // BL9 玉枕
      { view: "back",  x: 47, y: 22 },  // BL10 天柱
      { view: "back",  x: 46, y: 28 },  // BL11 大杼
      { view: "back",  x: 46, y: 32 },  // BL12 風門
      { view: "back",  x: 46, y: 33 },  // BL13 肺兪
      { view: "back",  x: 46, y: 36 },  // BL14 厥陰兪
      { view: "back",  x: 46, y: 38 },  // BL15 心兪
      { view: "back",  x: 46, y: 40 },  // BL16 督兪
      { view: "back",  x: 46, y: 43 },  // BL17 膈兪
      { view: "back",  x: 46, y: 47 },  // BL18 肝兪
      { view: "back",  x: 46, y: 49 },  // BL19 胆兪
      { view: "back",  x: 46, y: 52 },  // BL20 脾兪
      { view: "back",  x: 46, y: 55 },  // BL21 胃兪
      { view: "back",  x: 46, y: 58 },  // BL22 三焦兪
      { view: "back",  x: 46, y: 60 },  // BL23 腎兪
      { view: "back",  x: 46, y: 63 },  // BL24 気海兪
      { view: "back",  x: 46, y: 65 },  // BL25 大腸兪
      { view: "back",  x: 46, y: 67 },  // BL26 関元兪
      { view: "back",  x: 46, y: 69 },  // BL27 小腸兪
      { view: "back",  x: 46, y: 71 },  // BL28 膀胱兪
      { view: "back",  x: 47, y: 73 },  // BL30 白環兪
      { view: "back",  x: 47, y: 67 },  // BL31 上髎
      { view: "back",  x: 47, y: 69 },  // BL32 次髎
      { view: "back",  x: 47, y: 71 },  // BL33 中髎
      { view: "back",  x: 47, y: 73 },  // BL34 下髎
      { view: "back",  x: 47, y: 76 },  // BL35 会陽
      { view: "back",  x: 38, y: 78 },  // BL36 承扶
      { view: "back",  x: 39, y: 86 },  // BL37 殷門
      { view: "back",  x: 41, y: 95 },  // BL38 浮郄
      { view: "back",  x: 43, y: 97 },  // BL39 委陽
      { view: "back",  x: 46, y: 97 },  // BL40 委中
      { view: "back",  x: 43, y: 33 },  // BL41 附分 (第2線)
      { view: "back",  x: 43, y: 35 },  // BL42 魄戸
      { view: "back",  x: 43, y: 38 },  // BL43 膏肓
      { view: "back",  x: 43, y: 40 },  // BL44 神堂
      { view: "back",  x: 43, y: 43 },  // BL45 譩譆
      { view: "back",  x: 43, y: 47 },  // BL46 膈関
      { view: "back",  x: 43, y: 49 },  // BL47 魂門
      { view: "back",  x: 43, y: 52 },  // BL48 陽綱
      { view: "back",  x: 43, y: 55 },  // BL49 意舎
      { view: "back",  x: 43, y: 58 },  // BL50 胃倉
      { view: "back",  x: 43, y: 62 },  // BL51 肓門
      { view: "back",  x: 43, y: 65 },  // BL52 志室
      { view: "back",  x: 43, y: 73 },  // BL53 胞肓
      { view: "back",  x: 43, y: 76 },  // BL54 秩辺
      { view: "back",  x: 47, y: 100 }, // BL55 合陽
      { view: "back",  x: 47, y: 105 }, // BL56 承筋
      { view: "back",  x: 47, y: 109 }, // BL57 承山
      { view: "back",  x: 48, y: 113 }, // BL58 飛揚
      { view: "back",  x: 48, y: 117 }, // BL59 跗陽
      { view: "back",  x: 49, y: 120 }, // BL60 崑崙
      { view: "back",  x: 49, y: 122 }, // BL61 僕参
      { view: "back",  x: 49, y: 121 }, // BL62 申脈
      { view: "back",  x: 50, y: 124 }, // BL63 金門
      { view: "back",  x: 51, y: 126 }, // BL64 京骨
      { view: "back",  x: 51, y: 128 }, // BL65 束骨
      { view: "back",  x: 52, y: 129 }, // BL66 足通谷
      { view: "back",  x: 52, y: 130 }, // BL67 至陰
    ],
  },
  // 足少陰腎経 KI (27穴): 足底 → 内踝後 → 下腿内側 → 鼠径 → 腹正中外 → 胸
  {
    prefix: "KI", count: 27, side: "pair", jaName: "足少陰腎経",
    labels: ["湧泉","然谷","太渓","大鐘","水泉","照海","復溜","交信","築賓","陰谷",
            "横骨","大赫","気穴","四満","中注","肓兪","商曲","石関","陰都","腹通谷",
            "幽門","歩廊","神封","霊墟","神蔵","彧中","兪府"],
    anchors: [
      { view: "back",  x: 50, y: 131 }, // KI1 湧泉 (足底)
      { view: "back",  x: 49, y: 122 }, // KI2 然谷
      { view: "back",  x: 49, y: 120 }, // KI3 太渓
      { view: "back",  x: 49, y: 121 }, // KI4 大鐘
      { view: "back",  x: 49, y: 122 }, // KI5 水泉
      { view: "back",  x: 49, y: 119 }, // KI6 照海
      { view: "back",  x: 48, y: 116 }, // KI7 復溜
      { view: "back",  x: 48, y: 115 }, // KI8 交信
      { view: "back",  x: 47, y: 105 }, // KI9 築賓
      { view: "back",  x: 47, y: 97 },  // KI10 陰谷 (膝)
      { view: "front", x: 49, y: 67 },  // KI11 横骨
      { view: "front", x: 49, y: 64 },  // KI12 大赫
      { view: "front", x: 49, y: 60 },  // KI13 気穴
      { view: "front", x: 49, y: 57 },  // KI14 四満
      { view: "front", x: 49, y: 54 },  // KI15 中注
      { view: "front", x: 49, y: 52 },  // KI16 肓兪
      { view: "front", x: 49, y: 49 },  // KI17 商曲
      { view: "front", x: 49, y: 47 },  // KI18 石関
      { view: "front", x: 49, y: 45 },  // KI19 陰都
      { view: "front", x: 49, y: 43 },  // KI20 腹通谷
      { view: "front", x: 49, y: 41 },  // KI21 幽門
      { view: "front", x: 47, y: 38 },  // KI22 歩廊
      { view: "front", x: 47, y: 36 },  // KI23 神封
      { view: "front", x: 47, y: 34 },  // KI24 霊墟
      { view: "front", x: 47, y: 32 },  // KI25 神蔵
      { view: "front", x: 47, y: 30 },  // KI26 彧中
      { view: "front", x: 47, y: 28 },  // KI27 兪府
    ],
  },
  // 手厥陰心包経 PC (9穴): 胸 → 上腕中央前 → 前腕中央 → 中指
  {
    prefix: "PC", count: 9, side: "pair", jaName: "手厥陰心包経",
    labels: ["天池","天泉","曲沢","郄門","間使","内関","大陵","労宮","中衝"],
    anchors: [
      { view: "front", x: 36, y: 38 },  // PC1 天池
      { view: "front", x: 32, y: 42 },  // PC2 天泉
      { view: "front", x: 25, y: 50 },  // PC3 曲沢 (肘)
      { view: "front", x: 21, y: 58 },  // PC4 郄門
      { view: "front", x: 20, y: 60 },  // PC5 間使
      { view: "front", x: 19, y: 62 },  // PC6 内関
      { view: "front", x: 18, y: 65 },  // PC7 大陵
      { view: "front", x: 17, y: 68 },  // PC8 労宮
      { view: "front", x: 16, y: 71 },  // PC9 中衝 (中指)
    ],
  },
  // 手少陽三焦経 TE (23穴): 薬指 → 前腕背中央 → 上腕背 → 肩 → 耳の周り
  {
    prefix: "TE", count: 23, side: "pair", jaName: "手少陽三焦経",
    labels: ["関衝","液門","中渚","陽池","外関","支溝","会宗","三陽絡","四瀆","天井",
            "清冷淵","消濼","臑会","肩髎","天髎","天牖","翳風","瘛脈","顱息","角孫",
            "耳門","和髎","糸竹空"],
    anchors: [
      { view: "back",  x: 14, y: 70 },  // TE1 関衝
      { view: "back",  x: 15, y: 68 },  // TE2 液門
      { view: "back",  x: 16, y: 67 },  // TE3 中渚
      { view: "back",  x: 17, y: 65 },  // TE4 陽池
      { view: "back",  x: 18, y: 62 },  // TE5 外関
      { view: "back",  x: 19, y: 58 },  // TE6 支溝
      { view: "back",  x: 19, y: 56 },  // TE7 会宗
      { view: "back",  x: 20, y: 54 },  // TE8 三陽絡
      { view: "back",  x: 21, y: 52 },  // TE9 四瀆
      { view: "back",  x: 22, y: 50 },  // TE10 天井 (肘)
      { view: "back",  x: 23, y: 47 },  // TE11 清冷淵
      { view: "back",  x: 25, y: 42 },  // TE12 消濼
      { view: "back",  x: 27, y: 38 },  // TE13 臑会
      { view: "back",  x: 30, y: 30 },  // TE14 肩髎
      { view: "back",  x: 33, y: 28 },  // TE15 天髎
      { view: "back",  x: 42, y: 22 },  // TE16 天牖
      { view: "back",  x: 44, y: 19 },  // TE17 翳風
      { view: "back",  x: 44, y: 16 },  // TE18 瘛脈
      { view: "back",  x: 44, y: 14 },  // TE19 顱息
      { view: "back",  x: 44, y: 12 },  // TE20 角孫
      { view: "front", x: 44, y: 17 },  // TE21 耳門
      { view: "front", x: 44, y: 16 },  // TE22 和髎
      { view: "front", x: 45, y: 14 },  // TE23 糸竹空
    ],
  },
  // 足少陽胆経 GB (44穴): 外眼角 → 側頭 → 後頸 → 肩 → 体側 → 大腿外 → 下腿外 → 第四趾
  {
    prefix: "GB", count: 44, side: "pair", jaName: "足少陽胆経",
    labels: ["瞳子髎","聴会","上関","頷厭","懸顱","懸釐","曲鬢","率谷","天衝","浮白",
            "頭竅陰","完骨","本神","陽白","頭臨泣","目窓","正営","承霊","脳空","風池",
            "肩井","淵腋","輒筋","日月","京門","帯脈","五枢","維道","居髎","環跳",
            "風市","中瀆","膝陽関","陽陵泉","陽交","外丘","光明","陽輔","懸鐘","丘墟",
            "足臨泣","地五会","侠渓","足竅陰"],
    anchors: [
      { view: "front", x: 42, y: 16 },  // GB1 瞳子髎
      { view: "back",  x: 43, y: 17 },  // GB2 聴会
      { view: "back",  x: 44, y: 17 },  // GB3 上関
      { view: "back",  x: 44, y: 13 },  // GB4 頷厭
      { view: "back",  x: 44, y: 12 },  // GB5 懸顱
      { view: "back",  x: 44, y: 13 },  // GB6 懸釐
      { view: "back",  x: 43, y: 13 },  // GB7 曲鬢
      { view: "back",  x: 43, y: 11 },  // GB8 率谷
      { view: "back",  x: 44, y: 11 },  // GB9 天衝
      { view: "back",  x: 44, y: 13 },  // GB10 浮白
      { view: "back",  x: 44, y: 15 },  // GB11 頭竅陰
      { view: "back",  x: 44, y: 17 },  // GB12 完骨
      { view: "front", x: 46, y: 12 },  // GB13 本神
      { view: "front", x: 47, y: 14 },  // GB14 陽白
      { view: "front", x: 48, y: 11 },  // GB15 頭臨泣
      { view: "front", x: 48, y: 9 },   // GB16 目窓
      { view: "back",  x: 48, y: 8 },   // GB17 正営
      { view: "back",  x: 48, y: 11 },  // GB18 承霊
      { view: "back",  x: 47, y: 14 },  // GB19 脳空
      { view: "back",  x: 44, y: 20 },  // GB20 風池
      { view: "back",  x: 35, y: 27 },  // GB21 肩井
      { view: "front", x: 30, y: 36 },  // GB22 淵腋
      { view: "front", x: 30, y: 38 },  // GB23 輒筋
      { view: "front", x: 38, y: 41 },  // GB24 日月
      { view: "front", x: 30, y: 50 },  // GB25 京門
      { view: "front", x: 32, y: 55 },  // GB26 帯脈
      { view: "front", x: 33, y: 60 },  // GB27 五枢
      { view: "front", x: 34, y: 64 },  // GB28 維道
      { view: "front", x: 36, y: 67 },  // GB29 居髎
      { view: "back",  x: 36, y: 75 },  // GB30 環跳
      { view: "front", x: 32, y: 80 },  // GB31 風市
      { view: "front", x: 32, y: 88 },  // GB32 中瀆
      { view: "front", x: 36, y: 95 },  // GB33 膝陽関
      { view: "front", x: 36, y: 100 }, // GB34 陽陵泉
      { view: "front", x: 36, y: 104 }, // GB35 陽交
      { view: "front", x: 36, y: 107 }, // GB36 外丘
      { view: "front", x: 36, y: 111 }, // GB37 光明
      { view: "front", x: 36, y: 113 }, // GB38 陽輔
      { view: "front", x: 36, y: 116 }, // GB39 懸鐘
      { view: "front", x: 38, y: 121 }, // GB40 丘墟
      { view: "front", x: 39, y: 124 }, // GB41 足臨泣
      { view: "front", x: 40, y: 126 }, // GB42 地五会
      { view: "front", x: 40, y: 128 }, // GB43 侠渓
      { view: "front", x: 41, y: 129 }, // GB44 足竅陰
    ],
  },
  // 足厥陰肝経 LR (14穴): 母趾外 → 足背 → 下腿内 → 大腿内 → 鼠径 → 脇
  {
    prefix: "LR", count: 14, side: "pair", jaName: "足厥陰肝経",
    labels: ["大敦","行間","太衝","中封","蠡溝","中都","膝関","曲泉","陰包","足五里",
            "陰廉","急脈","章門","期門"],
    anchors: [
      { view: "front", x: 48, y: 129 }, // LR1 大敦
      { view: "front", x: 48, y: 127 }, // LR2 行間
      { view: "front", x: 47, y: 124 }, // LR3 太衝
      { view: "front", x: 47, y: 121 }, // LR4 中封
      { view: "front", x: 46, y: 113 }, // LR5 蠡溝
      { view: "front", x: 46, y: 109 }, // LR6 中都
      { view: "front", x: 45, y: 100 }, // LR7 膝関
      { view: "front", x: 45, y: 97 },  // LR8 曲泉
      { view: "front", x: 44, y: 86 },  // LR9 陰包
      { view: "front", x: 41, y: 78 },  // LR10 足五里
      { view: "front", x: 41, y: 73 },  // LR11 陰廉
      { view: "front", x: 41, y: 67 },  // LR12 急脈
      { view: "front", x: 30, y: 50 },  // LR13 章門
      { view: "front", x: 35, y: 42 },  // LR14 期門
    ],
  },
];

// ---------------------------------------------------------------------------
// パスを総距離で等分補間して count 個の点を生成
// ---------------------------------------------------------------------------

function interpolatePath(anchors: Anchor[], count: number): Anchor[] {
  if (anchors.length === 0) return [];
  if (anchors.length === 1) {
    return Array.from({ length: count }, () => ({ ...anchors[0] }));
  }
  const segs: number[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    segs.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = segs.reduce((s, x) => s + x, 0) || 1;

  const out: Anchor[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i * total) / (count - 1);
    let acc = 0;
    let placed = false;
    for (let s = 0; s < segs.length; s++) {
      if (acc + segs[s] >= t) {
        const local = segs[s] === 0 ? 0 : (t - acc) / segs[s];
        const a = anchors[s];
        const b = anchors[s + 1];
        const view = local < 0.5 ? a.view : b.view;
        out.push({
          view,
          x: a.x + (b.x - a.x) * local,
          y: a.y + (b.y - a.y) * local,
        });
        placed = true;
        break;
      }
      acc += segs[s];
    }
    if (!placed) out.push({ ...anchors[anchors.length - 1] });
  }
  return out;
}

function build361(): AcupointDef[] {
  const mainById = new Map(MAIN_ACUPOINTS.map((a) => [a.id, a]));
  const out: AcupointDef[] = [];
  for (const m of M) {
    // アンカーが count を超える場合は anchor をそのまま使う
    const points =
      m.anchors.length >= m.count
        ? m.anchors.slice(0, m.count)
        : interpolatePath(m.anchors, m.count);
    for (let i = 0; i < m.count; i++) {
      const id = `${m.prefix}${i + 1}`;
      const label = m.labels[i] || id;
      const main = mainById.get(id);
      if (main) {
        out.push({ ...main, isMain: true });
        continue;
      }
      const p = points[i];
      out.push({
        id,
        label,
        meridian: m.prefix,
        view: p.view,
        x: p.x,
        y: p.y,
        side: m.side,
        isMain: false,
      });
    }
  }
  for (const a of MAIN_ACUPOINTS) {
    if (!out.find((o) => o.id === a.id)) out.push(a);
  }
  return out;
}

const ALL_ACUPOINTS: AcupointDef[] = build361();

// ---------------------------------------------------------------------------
export type AcupointMode = "main" | "full";

export function expandAcupoints(
  view: AcupointView,
  mode: AcupointMode,
): AcupointDot[] {
  const source = mode === "main" ? MAIN_ACUPOINTS : ALL_ACUPOINTS;
  const out: AcupointDot[] = [];
  for (const a of source) {
    if (a.view !== view) continue;
    if (a.side === "single") {
      out.push({
        key: a.id,
        label: a.label,
        meridian: a.meridian,
        view,
        x: a.x,
        y: a.y,
        isMain: a.isMain,
      });
    } else {
      out.push({
        key: `${a.id}-l`,
        label: a.label,
        meridian: a.meridian,
        view,
        x: a.x,
        y: a.y,
        isMain: a.isMain,
      });
      out.push({
        key: `${a.id}-r`,
        label: a.label,
        meridian: a.meridian,
        view,
        x: 100 - a.x,
        y: a.y,
        isMain: a.isMain,
      });
    }
  }
  return out;
}

export function totalAcupointCount(mode: AcupointMode): number {
  return mode === "main" ? MAIN_ACUPOINTS.length : ALL_ACUPOINTS.length;
}
