// ===========================================================================
// 経穴データ。
// 座標系は SVG viewBox 0..100 (x) × 0..133 (y)。
// 1200×1600 の体図イラスト (clinic-app/public/chart/body-{front,back}.png) に
// 合わせて配置。
//
// 2 モード:
//   - "main"  : 主要 40 穴 (精密配置・院での頻用)
//   - "full"  : WHO 標準 361 穴 (経絡パスから補間生成・概略位置)
//
// 「pair」は左右対称。定義は左半身 (x<50) のみで、表示時に右側 (100-x) を自動生成。
// ===========================================================================

export type AcupointView = "front" | "back";
export type AcupointSide = "single" | "pair";

export type AcupointDef = {
  id: string;
  /** 表示用日本語ラベル (例: "百会", "合谷") */
  label: string;
  /** 経絡コード (例: "GV", "LI", "ST") — 全 14 + 奇穴 */
  meridian?: string;
  view: AcupointView;
  /** 0..100 (左右対称ペアの場合は左側 x < 50 を定義) */
  x: number;
  /** 0..133 */
  y: number;
  side: AcupointSide;
  /** "main" モードに含めるか */
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
// 主要 40 穴 (院の頻用穴・精密配置)
// ---------------------------------------------------------------------------
const MAIN_ACUPOINTS: AcupointDef[] = [
  // 頭部・首
  { id: "GV20", label: "百会",   meridian: "GV", view: "back",  x: 50, y: 5,   side: "single", isMain: true },
  { id: "EX-HN3", label: "印堂", view: "front", x: 50, y: 11,  side: "single", isMain: true },
  { id: "BL10", label: "天柱",   meridian: "BL", view: "back",  x: 47, y: 17,  side: "pair",   isMain: true },
  { id: "GB20", label: "風池",   meridian: "GB", view: "back",  x: 44, y: 15,  side: "pair",   isMain: true },
  { id: "GV16", label: "風府",   meridian: "GV", view: "back",  x: 50, y: 14,  side: "single", isMain: true },
  { id: "GV14", label: "大椎",   meridian: "GV", view: "back",  x: 50, y: 19,  side: "single", isMain: true },

  // 肩
  { id: "GB21", label: "肩井",   meridian: "GB", view: "back",  x: 32, y: 19,  side: "pair",   isMain: true },
  { id: "SI15", label: "肩中兪", meridian: "SI", view: "back",  x: 42, y: 19,  side: "pair",   isMain: true },
  { id: "SI14", label: "肩外兪", meridian: "SI", view: "back",  x: 38, y: 21,  side: "pair",   isMain: true },
  { id: "BL12", label: "風門",   meridian: "BL", view: "back",  x: 46, y: 24,  side: "pair",   isMain: true },

  // 胸
  { id: "CV17", label: "膻中",   meridian: "CV", view: "front", x: 50, y: 31,  side: "single", isMain: true },
  { id: "LU1",  label: "中府",   meridian: "LU", view: "front", x: 36, y: 26,  side: "pair",   isMain: true },

  // 腕 (前面)
  { id: "LI11", label: "曲池",   meridian: "LI", view: "front", x: 22, y: 42,  side: "pair",   isMain: true },
  { id: "LI10", label: "手三里", meridian: "LI", view: "front", x: 21, y: 47,  side: "pair",   isMain: true },
  { id: "PC6",  label: "内関",   meridian: "PC", view: "front", x: 19, y: 54,  side: "pair",   isMain: true },
  { id: "LU9",  label: "太淵",   meridian: "LU", view: "front", x: 17, y: 58,  side: "pair",   isMain: true },
  { id: "LI4",  label: "合谷",   meridian: "LI", view: "front", x: 14, y: 62,  side: "pair",   isMain: true },

  // 腹
  { id: "CV12", label: "中脘",   meridian: "CV", view: "front", x: 50, y: 43,  side: "single", isMain: true },
  { id: "CV8",  label: "神闕",   meridian: "CV", view: "front", x: 50, y: 50,  side: "single", isMain: true },
  { id: "CV4",  label: "関元",   meridian: "CV", view: "front", x: 50, y: 56,  side: "single", isMain: true },
  { id: "ST25", label: "天枢",   meridian: "ST", view: "front", x: 45, y: 50,  side: "pair",   isMain: true },

  // 背中
  { id: "BL13", label: "肺兪",   meridian: "BL", view: "back",  x: 45, y: 27,  side: "pair",   isMain: true },
  { id: "BL15", label: "心兪",   meridian: "BL", view: "back",  x: 45, y: 31,  side: "pair",   isMain: true },
  { id: "BL17", label: "膈兪",   meridian: "BL", view: "back",  x: 45, y: 36,  side: "pair",   isMain: true },
  { id: "BL18", label: "肝兪",   meridian: "BL", view: "back",  x: 45, y: 40,  side: "pair",   isMain: true },
  { id: "BL19", label: "胆兪",   meridian: "BL", view: "back",  x: 45, y: 43,  side: "pair",   isMain: true },
  { id: "BL20", label: "脾兪",   meridian: "BL", view: "back",  x: 45, y: 45,  side: "pair",   isMain: true },
  { id: "BL21", label: "胃兪",   meridian: "BL", view: "back",  x: 45, y: 47,  side: "pair",   isMain: true },
  { id: "BL23", label: "腎兪",   meridian: "BL", view: "back",  x: 45, y: 53,  side: "pair",   isMain: true },
  { id: "BL25", label: "大腸兪", meridian: "BL", view: "back",  x: 45, y: 58,  side: "pair",   isMain: true },
  { id: "GV4",  label: "命門",   meridian: "GV", view: "back",  x: 50, y: 53,  side: "single", isMain: true },

  // 臀部
  { id: "GB30", label: "環跳",   meridian: "GB", view: "back",  x: 36, y: 68,  side: "pair",   isMain: true },

  // 下肢
  { id: "ST36", label: "足三里", meridian: "ST", view: "front", x: 44, y: 84,  side: "pair",   isMain: true },
  { id: "GB34", label: "陽陵泉", meridian: "GB", view: "front", x: 41, y: 86,  side: "pair",   isMain: true },
  { id: "SP6",  label: "三陰交", meridian: "SP", view: "front", x: 46, y: 105, side: "pair",   isMain: true },
  { id: "SP10", label: "血海",   meridian: "SP", view: "front", x: 44, y: 76,  side: "pair",   isMain: true },
  { id: "LR3",  label: "太衝",   meridian: "LR", view: "front", x: 47, y: 122, side: "pair",   isMain: true },
  { id: "BL40", label: "委中",   meridian: "BL", view: "back",  x: 46, y: 86,  side: "pair",   isMain: true },
  { id: "BL57", label: "承山",   meridian: "BL", view: "back",  x: 47, y: 100, side: "pair",   isMain: true },
  { id: "KI3",  label: "太渓",   meridian: "KI", view: "back",  x: 49, y: 117, side: "pair",   isMain: true },
];

// ---------------------------------------------------------------------------
// 14 経絡パス定義 (361 穴生成用)
// 各メリディアンを「アンカーポイント」のリストで表し、
// 等分補間で N 点を生成する。座標は body image 0..100 × 0..133 に基づく概略位置。
// ---------------------------------------------------------------------------

type Anchor = { view: AcupointView; x: number; y: number };
type MeridianPath = {
  prefix: string;
  count: number;
  side: AcupointSide;
  /** 経絡名 (日本語) */
  jaName: string;
  /** 各点の日本語ラベル (count と同じ長さ — 簡易のため番号で代替) */
  labels: string[];
  /** 経絡が通るアンカー (start → end) — 線形補間で count 個に展開 */
  anchors: Anchor[];
};

const M: MeridianPath[] = [
  // 督脈 GV (28穴): 尾骨先 → 頭頂 → 上唇上 (背中→頭頂→顔正中)
  {
    prefix: "GV", count: 28, side: "single", jaName: "督脈",
    labels: [
      "長強","腰兪","腰陽関","命門","懸枢","脊中","中枢","筋縮","至陽","霊台",
      "神道","身柱","陶道","大椎","瘂門","風府","脳戸","強間","後頂","百会",
      "前頂","顖会","上星","神庭","素髎","水溝","兌端","龈交",
    ],
    anchors: [
      { view: "back",  x: 50, y: 67 }, // GV1
      { view: "back",  x: 50, y: 53 }, // GV4 命門
      { view: "back",  x: 50, y: 19 }, // GV14 大椎
      { view: "back",  x: 50, y: 14 }, // GV16 風府
      { view: "back",  x: 50, y: 5  }, // GV20 百会
      { view: "front", x: 50, y: 8  }, // GV24 神庭
      { view: "front", x: 50, y: 14 }, // GV26
      { view: "front", x: 50, y: 16 }, // GV28
    ],
  },
  // 任脈 CV (24穴): 会陰 → 下唇下
  {
    prefix: "CV", count: 24, side: "single", jaName: "任脈",
    labels: [
      "会陰","曲骨","中極","関元","石門","気海","陰交","神闕","水分","下脘",
      "建里","中脘","上脘","巨闕","鳩尾","中庭","膻中","玉堂","紫宮","華蓋",
      "璇璣","天突","廉泉","承漿",
    ],
    anchors: [
      { view: "front", x: 50, y: 70 }, // CV1
      { view: "front", x: 50, y: 56 }, // CV4 関元
      { view: "front", x: 50, y: 50 }, // CV8 神闕
      { view: "front", x: 50, y: 43 }, // CV12 中脘
      { view: "front", x: 50, y: 31 }, // CV17 膻中
      { view: "front", x: 50, y: 22 }, // CV22 天突
      { view: "front", x: 50, y: 16 }, // CV24 承漿
    ],
  },
  // 手太陰肺経 LU (11穴): 胸 → 上肢前外側 → 母指
  {
    prefix: "LU", count: 11, side: "pair", jaName: "手太陰肺経",
    labels: ["中府","雲門","天府","侠白","尺沢","孔最","列欠","経渠","太淵","魚際","少商"],
    anchors: [
      { view: "front", x: 36, y: 26 },
      { view: "front", x: 36, y: 24 },
      { view: "front", x: 30, y: 32 },
      { view: "front", x: 25, y: 38 },
      { view: "front", x: 22, y: 44 },
      { view: "front", x: 19, y: 54 },
      { view: "front", x: 17, y: 58 },
      { view: "front", x: 14, y: 62 },
    ],
  },
  // 手陽明大腸経 LI (20穴): 示指 → 上肢後外側 → 鼻
  {
    prefix: "LI", count: 20, side: "pair", jaName: "手陽明大腸経",
    labels: ["商陽","二間","三間","合谷","陽渓","偏歴","温溜","下廉","上廉","手三里",
            "曲池","肘髎","手五里","臂臑","肩髃","巨骨","天鼎","扶突","禾髎","迎香"],
    anchors: [
      { view: "front", x: 12, y: 64 },
      { view: "front", x: 14, y: 62 },
      { view: "front", x: 17, y: 58 },
      { view: "front", x: 21, y: 47 },
      { view: "front", x: 22, y: 42 },
      { view: "front", x: 26, y: 32 },
      { view: "front", x: 30, y: 24 },
      { view: "front", x: 38, y: 22 },
      { view: "front", x: 44, y: 18 },
      { view: "front", x: 47, y: 13 },
    ],
  },
  // 足陽明胃経 ST (45穴): 顔 → 胸 → 腹 → 下肢前 → 足第二趾
  {
    prefix: "ST", count: 45, side: "pair", jaName: "足陽明胃経",
    labels: ["承泣","四白","巨髎","地倉","大迎","頬車","下関","頭維","人迎","水突",
            "気舎","欠盆","気戸","庫房","屋翳","膺窓","乳中","乳根","不容","承満",
            "梁門","関門","太乙","滑肉門","天枢","外陵","大巨","水道","帰来","気衝",
            "髀関","伏兎","陰市","梁丘","犢鼻","足三里","上巨虚","条口","下巨虚","豊隆",
            "解渓","衝陽","陥谷","内庭","厲兌"],
    anchors: [
      { view: "front", x: 45, y: 11 },
      { view: "front", x: 44, y: 14 },
      { view: "front", x: 43, y: 18 },
      { view: "front", x: 42, y: 22 },
      { view: "front", x: 40, y: 28 },
      { view: "front", x: 38, y: 33 },
      { view: "front", x: 38, y: 38 },
      { view: "front", x: 45, y: 43 },
      { view: "front", x: 45, y: 50 },
      { view: "front", x: 44, y: 60 },
      { view: "front", x: 42, y: 68 },
      { view: "front", x: 43, y: 76 },
      { view: "front", x: 44, y: 84 },
      { view: "front", x: 44, y: 96 },
      { view: "front", x: 45, y: 110 },
      { view: "front", x: 47, y: 120 },
      { view: "front", x: 47, y: 128 },
    ],
  },
  // 足太陰脾経 SP (21穴): 足母趾 → 下肢内側 → 腹 → 脇
  {
    prefix: "SP", count: 21, side: "pair", jaName: "足太陰脾経",
    labels: ["隠白","大都","太白","公孫","商丘","三陰交","漏谷","地機","陰陵泉","血海",
            "箕門","衝門","府舎","腹結","大横","腹哀","食竇","天渓","胸郷","周栄","大包"],
    anchors: [
      { view: "front", x: 47, y: 128 },
      { view: "front", x: 47, y: 122 },
      { view: "front", x: 47, y: 117 },
      { view: "front", x: 46, y: 105 },
      { view: "front", x: 44, y: 92 },
      { view: "front", x: 44, y: 76 },
      { view: "front", x: 42, y: 65 },
      { view: "front", x: 42, y: 56 },
      { view: "front", x: 41, y: 50 },
      { view: "front", x: 38, y: 43 },
      { view: "front", x: 35, y: 36 },
      { view: "front", x: 32, y: 30 },
    ],
  },
  // 手少陰心経 HT (9穴): 腋 → 上肢内側 → 小指
  {
    prefix: "HT", count: 9, side: "pair", jaName: "手少陰心経",
    labels: ["極泉","青霊","少海","霊道","通里","陰郄","神門","少府","少衝"],
    anchors: [
      { view: "front", x: 30, y: 25 },
      { view: "front", x: 27, y: 32 },
      { view: "front", x: 23, y: 42 },
      { view: "front", x: 21, y: 50 },
      { view: "front", x: 19, y: 56 },
      { view: "front", x: 17, y: 60 },
      { view: "front", x: 15, y: 63 },
      { view: "front", x: 13, y: 66 },
    ],
  },
  // 手太陽小腸経 SI (19穴): 小指 → 上肢後内側 → 肩 → 顔
  {
    prefix: "SI", count: 19, side: "pair", jaName: "手太陽小腸経",
    labels: ["少沢","前谷","後渓","腕骨","陽谷","養老","支正","小海","肩貞","臑兪",
            "天宗","秉風","曲垣","肩外兪","肩中兪","天窓","天容","顴髎","聴宮"],
    anchors: [
      { view: "back",  x: 13, y: 66 },
      { view: "back",  x: 16, y: 60 },
      { view: "back",  x: 19, y: 54 },
      { view: "back",  x: 22, y: 46 },
      { view: "back",  x: 26, y: 38 },
      { view: "back",  x: 30, y: 28 },
      { view: "back",  x: 35, y: 22 },
      { view: "back",  x: 38, y: 21 },
      { view: "back",  x: 42, y: 19 },
      { view: "back",  x: 44, y: 17 },
      { view: "back",  x: 44, y: 14 },
      { view: "back",  x: 43, y: 11 },
    ],
  },
  // 足太陽膀胱経 BL (67穴): 内眼角 → 頭 → 背中 (脊柱から1.5寸の第1線) → 下肢後 → 足小指
  // 67穴は最大、背中第1線20点+第2線14点を含むため、ざっくり脊柱に沿って配置
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
      { view: "front", x: 47, y: 11 },  // BL1 睛明 (内眼角)
      { view: "back",  x: 47, y: 7  },  // BL3 (頭頂手前)
      { view: "back",  x: 48, y: 12 },  // BL10 天柱
      { view: "back",  x: 45, y: 22 },  // BL11
      { view: "back",  x: 45, y: 27 },  // BL13 肺兪
      { view: "back",  x: 45, y: 36 },  // BL17 膈兪
      { view: "back",  x: 45, y: 47 },  // BL21 胃兪
      { view: "back",  x: 45, y: 53 },  // BL23 腎兪
      { view: "back",  x: 45, y: 58 },  // BL25 大腸兪
      { view: "back",  x: 47, y: 62 },  // BL31 上髎
      { view: "back",  x: 38, y: 70 },  // BL36 承扶
      { view: "back",  x: 41, y: 78 },  // BL37 殷門
      { view: "back",  x: 46, y: 86 },  // BL40 委中
      { view: "back",  x: 41, y: 27 },  // BL41 附分 (第2線・上)
      { view: "back",  x: 41, y: 47 },  // BL49 (第2線・中)
      { view: "back",  x: 41, y: 58 },  // BL53
      { view: "back",  x: 41, y: 68 },  // BL54 秩辺
      { view: "back",  x: 47, y: 96 },  // BL56 承筋
      { view: "back",  x: 47, y: 100 }, // BL57 承山
      { view: "back",  x: 48, y: 110 }, // BL59 跗陽
      { view: "back",  x: 49, y: 117 }, // BL60 崑崙
      { view: "back",  x: 50, y: 124 }, // BL64 京骨
      { view: "back",  x: 51, y: 130 }, // BL67 至陰
    ],
  },
  // 足少陰腎経 KI (27穴): 足底 → 下肢内側 → 腹 → 胸
  {
    prefix: "KI", count: 27, side: "pair", jaName: "足少陰腎経",
    labels: ["湧泉","然谷","太渓","大鐘","水泉","照海","復溜","交信","築賓","陰谷",
            "横骨","大赫","気穴","四満","中注","肓兪","商曲","石関","陰都","腹通谷",
            "幽門","歩廊","神封","霊墟","神蔵","彧中","兪府"],
    anchors: [
      { view: "back",  x: 50, y: 132 },
      { view: "back",  x: 49, y: 120 },
      { view: "back",  x: 49, y: 117 },
      { view: "back",  x: 48, y: 108 },
      { view: "back",  x: 48, y: 100 },
      { view: "back",  x: 48, y: 90 },
      { view: "back",  x: 48, y: 82 },
      { view: "front", x: 48, y: 70 },
      { view: "front", x: 48, y: 60 },
      { view: "front", x: 48, y: 50 },
      { view: "front", x: 48, y: 42 },
      { view: "front", x: 48, y: 34 },
      { view: "front", x: 47, y: 28 },
      { view: "front", x: 47, y: 24 },
    ],
  },
  // 手厥陰心包経 PC (9穴): 胸 → 上肢中央前 → 中指
  {
    prefix: "PC", count: 9, side: "pair", jaName: "手厥陰心包経",
    labels: ["天池","天泉","曲沢","郄門","間使","内関","大陵","労宮","中衝"],
    anchors: [
      { view: "front", x: 36, y: 30 },
      { view: "front", x: 30, y: 36 },
      { view: "front", x: 24, y: 44 },
      { view: "front", x: 21, y: 50 },
      { view: "front", x: 19, y: 54 },
      { view: "front", x: 18, y: 58 },
      { view: "front", x: 17, y: 60 },
      { view: "front", x: 15, y: 64 },
    ],
  },
  // 手少陽三焦経 TE (23穴): 薬指 → 上肢後中央 → 肩 → 耳
  {
    prefix: "TE", count: 23, side: "pair", jaName: "手少陽三焦経",
    labels: ["関衝","液門","中渚","陽池","外関","支溝","会宗","三陽絡","四瀆","天井",
            "清冷淵","消濼","臑会","肩髎","天髎","天牖","翳風","瘛脈","顱息","角孫",
            "耳門","和髎","糸竹空"],
    anchors: [
      { view: "back",  x: 14, y: 65 },
      { view: "back",  x: 16, y: 60 },
      { view: "back",  x: 18, y: 56 },
      { view: "back",  x: 20, y: 50 },
      { view: "back",  x: 24, y: 44 },
      { view: "back",  x: 28, y: 36 },
      { view: "back",  x: 32, y: 28 },
      { view: "back",  x: 36, y: 22 },
      { view: "back",  x: 40, y: 18 },
      { view: "back",  x: 42, y: 14 },
    ],
  },
  // 足少陽胆経 GB (44穴): 外眼角 → 耳 → 頭側 → 頸 → 体側 → 下肢外側 → 足第四趾
  {
    prefix: "GB", count: 44, side: "pair", jaName: "足少陽胆経",
    labels: ["瞳子髎","聴会","上関","頷厭","懸顱","懸釐","曲鬢","率谷","天衝","浮白",
            "頭竅陰","完骨","本神","陽白","頭臨泣","目窓","正営","承霊","脳空","風池",
            "肩井","淵腋","輒筋","日月","京門","帯脈","五枢","維道","居髎","環跳",
            "風市","中瀆","膝陽関","陽陵泉","陽交","外丘","光明","陽輔","懸鐘","丘墟",
            "足臨泣","地五会","侠渓","足竅陰"],
    anchors: [
      { view: "front", x: 41, y: 11 },
      { view: "back",  x: 42, y: 13 },
      { view: "back",  x: 44, y: 15 },
      { view: "back",  x: 32, y: 19 },
      { view: "back",  x: 32, y: 30 },
      { view: "back",  x: 30, y: 42 },
      { view: "back",  x: 28, y: 56 },
      { view: "back",  x: 30, y: 64 },
      { view: "back",  x: 36, y: 68 },
      { view: "back",  x: 35, y: 76 },
      { view: "back",  x: 36, y: 86 },
      { view: "back",  x: 38, y: 96 },
      { view: "back",  x: 41, y: 86 },
      { view: "back",  x: 40, y: 105 },
      { view: "back",  x: 41, y: 115 },
      { view: "back",  x: 43, y: 122 },
      { view: "back",  x: 44, y: 128 },
    ],
  },
  // 足厥陰肝経 LR (14穴): 足母趾 → 下肢内側 → 腹 → 脇
  {
    prefix: "LR", count: 14, side: "pair", jaName: "足厥陰肝経",
    labels: ["大敦","行間","太衝","中封","蠡溝","中都","膝関","曲泉","陰包","足五里",
            "陰廉","急脈","章門","期門"],
    anchors: [
      { view: "front", x: 47, y: 130 },
      { view: "front", x: 47, y: 124 },
      { view: "front", x: 47, y: 122 },
      { view: "front", x: 47, y: 117 },
      { view: "front", x: 46, y: 105 },
      { view: "front", x: 45, y: 95 },
      { view: "front", x: 44, y: 84 },
      { view: "front", x: 43, y: 76 },
      { view: "front", x: 42, y: 68 },
      { view: "front", x: 40, y: 58 },
      { view: "front", x: 36, y: 50 },
      { view: "front", x: 34, y: 38 },
    ],
  },
];

/**
 * パスを等分補間して count 個の点を生成する。
 */
function interpolatePath(anchors: Anchor[], count: number): Anchor[] {
  if (anchors.length === 0) return [];
  if (anchors.length === 1) {
    return Array.from({ length: count }, () => ({ ...anchors[0] }));
  }
  // セグメント長 (ユークリッド距離)。view 跨ぎは距離0扱いにせず一律で扱う。
  const segs: number[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push(d);
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
        // view が跨ぐ場合は前半 < 0.5 なら a の view、後半なら b の view
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

/**
 * 14 経絡から 361 穴データを生成。
 * 主要 40 穴と被る場合は MAIN を優先 (位置はメイン側を使用)。
 */
function build361(): AcupointDef[] {
  const mainById = new Map(MAIN_ACUPOINTS.map((a) => [a.id, a]));
  const out: AcupointDef[] = [];
  for (const m of M) {
    const points = interpolatePath(m.anchors, m.count);
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
  // メインに含まれる奇穴 (経絡なし) も足す
  for (const a of MAIN_ACUPOINTS) {
    if (!out.find((o) => o.id === a.id)) out.push(a);
  }
  return out;
}

const ALL_ACUPOINTS: AcupointDef[] = build361();

// ---------------------------------------------------------------------------
// 表示用展開関数
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
