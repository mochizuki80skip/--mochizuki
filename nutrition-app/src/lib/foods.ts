// 日本食品標準成分表ベース + 一般的な外食/コンビニ約180品目
export interface Food {
  id: string;
  name: string;
  kana: string;
  cat: string;
  unit: string;
  unitG: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const FOODS: Food[] = [
  // 主食
  { id: 'rice-1', name: 'ご飯（茶碗1杯）', kana: 'ごはん こめ', cat: '主食', unit: '杯(150g)', unitG: 150, kcal: 234, protein: 3.8, fat: 0.5, carbs: 53.4 },
  { id: 'rice-s', name: 'ご飯（小盛り）', kana: 'ごはん', cat: '主食', unit: '100g', unitG: 100, kcal: 156, protein: 2.5, fat: 0.3, carbs: 35.6 },
  { id: 'rice-l', name: 'ご飯（大盛り）', kana: 'ごはん', cat: '主食', unit: '250g', unitG: 250, kcal: 390, protein: 6.3, fat: 0.8, carbs: 89.0 },
  { id: 'genmai', name: '玄米ご飯', kana: 'げんまい', cat: '主食', unit: '杯(150g)', unitG: 150, kcal: 248, protein: 4.2, fat: 1.5, carbs: 53.4 },
  { id: 'mochi', name: 'もち', kana: 'もち', cat: '主食', unit: '1個(50g)', unitG: 50, kcal: 117, protein: 2.0, fat: 0.4, carbs: 25.4 },
  { id: 'shokupan-6', name: '食パン6枚切り', kana: 'しょくぱん', cat: '主食', unit: '1枚(60g)', unitG: 60, kcal: 149, protein: 5.4, fat: 2.5, carbs: 27.8 },
  { id: 'shokupan-8', name: '食パン8枚切り', kana: 'しょくぱん', cat: '主食', unit: '1枚(45g)', unitG: 45, kcal: 112, protein: 4.0, fat: 1.9, carbs: 20.9 },
  { id: 'roll', name: 'ロールパン', kana: 'ろーるぱん', cat: '主食', unit: '1個(30g)', unitG: 30, kcal: 95, protein: 3.0, fat: 2.7, carbs: 14.6 },
  { id: 'croissant', name: 'クロワッサン', kana: 'くろわっさん', cat: '主食', unit: '1個(40g)', unitG: 40, kcal: 179, protein: 3.2, fat: 10.7, carbs: 17.6 },
  { id: 'bagel', name: 'ベーグル', kana: 'べーぐる', cat: '主食', unit: '1個(95g)', unitG: 95, kcal: 256, protein: 9.0, fat: 1.9, carbs: 51.2 },
  { id: 'udon-yude', name: 'うどん（茹で）', kana: 'うどん', cat: '主食', unit: '1玉(250g)', unitG: 250, kcal: 263, protein: 6.5, fat: 1.0, carbs: 54.3 },
  { id: 'soba-yude', name: 'そば（茹で）', kana: 'そば', cat: '主食', unit: '1玉(180g)', unitG: 180, kcal: 230, protein: 8.6, fat: 1.8, carbs: 47.0 },
  { id: 'ramen-nama', name: '中華麺（茹で）', kana: 'らーめん', cat: '主食', unit: '1玉(220g)', unitG: 220, kcal: 327, protein: 10.8, fat: 1.3, carbs: 64.7 },
  { id: 'pasta-yude', name: 'パスタ（茹で）', kana: 'ぱすた', cat: '主食', unit: '1人前(250g)', unitG: 250, kcal: 373, protein: 13.0, fat: 2.3, carbs: 75.0 },
  { id: 'cereal', name: 'シリアル（プレーン）', kana: 'しりある', cat: '主食', unit: '40g', unitG: 40, kcal: 152, protein: 3.0, fat: 0.6, carbs: 33.3 },
  { id: 'granola', name: 'グラノーラ', kana: 'ぐらのーら', cat: '主食', unit: '50g', unitG: 50, kcal: 220, protein: 4.0, fat: 7.5, carbs: 35.4 },
  { id: 'oats', name: 'オートミール（乾）', kana: 'おーとみーる', cat: '主食', unit: '30g', unitG: 30, kcal: 105, protein: 4.1, fat: 1.7, carbs: 20.7 },

  // 主菜 / 肉
  { id: 'chicken-breast-skin', name: '鶏むね肉（皮あり）', kana: 'とりむね', cat: '主菜', unit: '100g', unitG: 100, kcal: 145, protein: 21.3, fat: 5.9, carbs: 0 },
  { id: 'chicken-breast-noskin', name: '鶏むね肉（皮なし）', kana: 'とりむね', cat: '主菜', unit: '100g', unitG: 100, kcal: 105, protein: 23.3, fat: 1.9, carbs: 0 },
  { id: 'chicken-thigh-skin', name: '鶏もも肉（皮あり）', kana: 'とりもも', cat: '主菜', unit: '100g', unitG: 100, kcal: 190, protein: 16.6, fat: 14.2, carbs: 0 },
  { id: 'chicken-thigh-noskin', name: '鶏もも肉（皮なし）', kana: 'とりもも', cat: '主菜', unit: '100g', unitG: 100, kcal: 113, protein: 19.0, fat: 5.0, carbs: 0 },
  { id: 'chicken-sasami', name: 'ささみ', kana: 'ささみ', cat: '主菜', unit: '1本(40g)', unitG: 40, kcal: 39, protein: 9.5, fat: 0.3, carbs: 0 },
  { id: 'beef-mom-aka', name: '牛もも（赤身）', kana: 'ぎゅう', cat: '主菜', unit: '100g', unitG: 100, kcal: 176, protein: 21.3, fat: 10.7, carbs: 0.5 },
  { id: 'beef-rosu', name: '牛ロース', kana: 'ぎゅう', cat: '主菜', unit: '100g', unitG: 100, kcal: 295, protein: 16.5, fat: 26.1, carbs: 0.2 },
  { id: 'beef-bara', name: '牛バラ', kana: 'ぎゅう', cat: '主菜', unit: '100g', unitG: 100, kcal: 381, protein: 12.8, fat: 39.4, carbs: 0.1 },
  { id: 'pork-mom', name: '豚もも', kana: 'ぶた', cat: '主菜', unit: '100g', unitG: 100, kcal: 171, protein: 20.5, fat: 10.2, carbs: 0.2 },
  { id: 'pork-rosu', name: '豚ロース', kana: 'ぶた', cat: '主菜', unit: '100g', unitG: 100, kcal: 248, protein: 19.3, fat: 19.2, carbs: 0.2 },
  { id: 'pork-bara', name: '豚バラ', kana: 'ぶた', cat: '主菜', unit: '100g', unitG: 100, kcal: 366, protein: 14.4, fat: 35.4, carbs: 0.1 },
  { id: 'pork-hire', name: '豚ヒレ', kana: 'ぶた', cat: '主菜', unit: '100g', unitG: 100, kcal: 118, protein: 22.2, fat: 3.7, carbs: 0.3 },
  { id: 'ham', name: 'ハム', kana: 'はむ', cat: '主菜', unit: '1枚(15g)', unitG: 15, kcal: 17, protein: 2.8, fat: 0.6, carbs: 0.2 },
  { id: 'bacon', name: 'ベーコン', kana: 'べーこん', cat: '主菜', unit: '1枚(15g)', unitG: 15, kcal: 60, protein: 1.9, fat: 5.9, carbs: 0.0 },
  { id: 'sausage', name: 'ウインナー', kana: 'うぃんなー', cat: '主菜', unit: '1本(20g)', unitG: 20, kcal: 64, protein: 2.3, fat: 5.7, carbs: 0.6 },

  // 主菜 / 魚
  { id: 'salmon', name: '鮭（生）', kana: 'さけ', cat: '主菜', unit: '1切(80g)', unitG: 80, kcal: 106, protein: 17.8, fat: 3.3, carbs: 0.1 },
  { id: 'maguro-aka', name: 'まぐろ赤身', kana: 'まぐろ', cat: '主菜', unit: '100g', unitG: 100, kcal: 115, protein: 26.4, fat: 1.4, carbs: 0.1 },
  { id: 'maguro-toro', name: 'まぐろトロ', kana: 'まぐろ', cat: '主菜', unit: '100g', unitG: 100, kcal: 308, protein: 20.1, fat: 27.5, carbs: 0.1 },
  { id: 'saba', name: 'さば', kana: 'さば', cat: '主菜', unit: '1切(80g)', unitG: 80, kcal: 169, protein: 16.5, fat: 13.4, carbs: 0.2 },
  { id: 'aji', name: 'あじ', kana: 'あじ', cat: '主菜', unit: '1尾(80g)', unitG: 80, kcal: 89, protein: 15.8, fat: 3.6, carbs: 0.1 },
  { id: 'sanma', name: 'さんま', kana: 'さんま', cat: '主菜', unit: '1尾(100g)', unitG: 100, kcal: 287, protein: 18.1, fat: 25.6, carbs: 0.1 },
  { id: 'iwashi', name: 'いわし', kana: 'いわし', cat: '主菜', unit: '1尾(80g)', unitG: 80, kcal: 134, protein: 15.4, fat: 7.4, carbs: 0.2 },
  { id: 'tara', name: 'たら', kana: 'たら', cat: '主菜', unit: '1切(80g)', unitG: 80, kcal: 61, protein: 14.1, fat: 0.2, carbs: 0.1 },
  { id: 'buri', name: 'ぶり', kana: 'ぶり', cat: '主菜', unit: '1切(80g)', unitG: 80, kcal: 178, protein: 17.1, fat: 14.1, carbs: 0.3 },
  { id: 'ebi', name: 'えび', kana: 'えび', cat: '主菜', unit: '5尾(60g)', unitG: 60, kcal: 49, protein: 11.5, fat: 0.2, carbs: 0.1 },
  { id: 'ika', name: 'いか', kana: 'いか', cat: '主菜', unit: '100g', unitG: 100, kcal: 76, protein: 17.9, fat: 0.8, carbs: 0.1 },
  { id: 'tako', name: 'たこ', kana: 'たこ', cat: '主菜', unit: '100g', unitG: 100, kcal: 70, protein: 16.4, fat: 0.7, carbs: 0.1 },
  { id: 'tuna-can', name: 'ツナ缶（水煮）', kana: 'つな', cat: '主菜', unit: '1缶(70g)', unitG: 70, kcal: 49, protein: 11.2, fat: 0.2, carbs: 0.2 },
  { id: 'tuna-can-oil', name: 'ツナ缶（オイル）', kana: 'つな', cat: '主菜', unit: '1缶(70g)', unitG: 70, kcal: 187, protein: 12.5, fat: 14.8, carbs: 0.1 },
  { id: 'sashimi-set', name: '刺身盛り合わせ', kana: 'さしみ', cat: '主菜', unit: '1人前', unitG: 150, kcal: 195, protein: 32.0, fat: 6.0, carbs: 0.3 },

  // 卵・大豆
  { id: 'egg', name: '卵', kana: 'たまご', cat: '主菜', unit: '1個(50g)', unitG: 50, kcal: 71, protein: 6.1, fat: 5.1, carbs: 0.2 },
  { id: 'egg-white', name: '卵白', kana: 'たまご', cat: '主菜', unit: '1個(33g)', unitG: 33, kcal: 15, protein: 3.4, fat: 0.0, carbs: 0.1 },
  { id: 'tofu-momen', name: '木綿豆腐', kana: 'とうふ', cat: '主菜', unit: '半丁(150g)', unitG: 150, kcal: 110, protein: 10.5, fat: 7.4, carbs: 0.6 },
  { id: 'tofu-kinu', name: '絹豆腐', kana: 'とうふ', cat: '主菜', unit: '半丁(150g)', unitG: 150, kcal: 84, protein: 7.4, fat: 5.3, carbs: 1.7 },
  { id: 'natto', name: '納豆', kana: 'なっとう', cat: '主菜', unit: '1パック(45g)', unitG: 45, kcal: 86, protein: 7.4, fat: 4.5, carbs: 5.5 },
  { id: 'edamame', name: '枝豆', kana: 'えだまめ', cat: '副菜', unit: '100g', unitG: 100, kcal: 125, protein: 11.7, fat: 6.2, carbs: 8.8 },
  { id: 'soymilk', name: '豆乳', kana: 'とうにゅう', cat: '飲料', unit: '200ml', unitG: 200, kcal: 92, protein: 7.2, fat: 4.0, carbs: 5.8 },
  { id: 'atsuage', name: '厚揚げ', kana: 'あつあげ', cat: '主菜', unit: '1枚(100g)', unitG: 100, kcal: 143, protein: 10.7, fat: 11.3, carbs: 0.9 },

  // 乳製品
  { id: 'milk', name: '牛乳', kana: 'ぎゅうにゅう', cat: '飲料', unit: '200ml', unitG: 200, kcal: 122, protein: 6.6, fat: 7.6, carbs: 9.6 },
  { id: 'milk-low', name: '低脂肪乳', kana: 'ぎゅうにゅう', cat: '飲料', unit: '200ml', unitG: 200, kcal: 84, protein: 7.6, fat: 2.0, carbs: 11.0 },
  { id: 'yogurt', name: 'プレーンヨーグルト', kana: 'よーぐると', cat: '乳製品', unit: '100g', unitG: 100, kcal: 56, protein: 3.6, fat: 3.0, carbs: 4.9 },
  { id: 'yogurt-greek', name: 'ギリシャヨーグルト（無糖）', kana: 'よーぐると', cat: '乳製品', unit: '100g', unitG: 100, kcal: 59, protein: 10.0, fat: 0.4, carbs: 3.6 },
  { id: 'cheese-slice', name: 'スライスチーズ', kana: 'ちーず', cat: '乳製品', unit: '1枚(18g)', unitG: 18, kcal: 56, protein: 4.1, fat: 4.7, carbs: 0.2 },
  { id: 'cottage', name: 'カッテージチーズ', kana: 'かってーじ', cat: '乳製品', unit: '50g', unitG: 50, kcal: 50, protein: 6.7, fat: 2.3, carbs: 0.9 },
  { id: 'butter', name: 'バター', kana: 'ばたー', cat: '油脂', unit: '10g', unitG: 10, kcal: 70, protein: 0.1, fat: 8.1, carbs: 0.0 },

  // 野菜
  { id: 'kyabetsu', name: 'キャベツ', kana: 'きゃべつ', cat: '副菜', unit: '100g', unitG: 100, kcal: 21, protein: 1.3, fat: 0.2, carbs: 5.2 },
  { id: 'lettuce', name: 'レタス', kana: 'れたす', cat: '副菜', unit: '100g', unitG: 100, kcal: 11, protein: 0.6, fat: 0.1, carbs: 2.8 },
  { id: 'tomato', name: 'トマト', kana: 'とまと', cat: '副菜', unit: '1個(150g)', unitG: 150, kcal: 30, protein: 1.1, fat: 0.2, carbs: 7.1 },
  { id: 'kyuuri', name: 'きゅうり', kana: 'きゅうり', cat: '副菜', unit: '1本(100g)', unitG: 100, kcal: 13, protein: 1.0, fat: 0.1, carbs: 3.0 },
  { id: 'broccoli', name: 'ブロッコリー', kana: 'ぶろっこりー', cat: '副菜', unit: '100g', unitG: 100, kcal: 37, protein: 5.4, fat: 0.6, carbs: 6.6 },
  { id: 'spinach', name: 'ほうれん草', kana: 'ほうれんそう', cat: '副菜', unit: '100g', unitG: 100, kcal: 18, protein: 2.2, fat: 0.4, carbs: 3.1 },
  { id: 'carrot', name: 'にんじん', kana: 'にんじん', cat: '副菜', unit: '100g', unitG: 100, kcal: 35, protein: 0.7, fat: 0.2, carbs: 9.3 },
  { id: 'onion', name: '玉ねぎ', kana: 'たまねぎ', cat: '副菜', unit: '1個(200g)', unitG: 200, kcal: 66, protein: 2.0, fat: 0.2, carbs: 17.0 },
  { id: 'piman', name: 'ピーマン', kana: 'ぴーまん', cat: '副菜', unit: '1個(30g)', unitG: 30, kcal: 6, protein: 0.3, fat: 0.1, carbs: 1.5 },
  { id: 'eggplant', name: 'なす', kana: 'なす', cat: '副菜', unit: '1本(80g)', unitG: 80, kcal: 14, protein: 0.9, fat: 0.1, carbs: 4.1 },
  { id: 'mushroom', name: 'しいたけ', kana: 'しいたけ', cat: '副菜', unit: '3個(60g)', unitG: 60, kcal: 15, protein: 1.8, fat: 0.2, carbs: 4.0 },
  { id: 'enoki', name: 'えのき', kana: 'えのき', cat: '副菜', unit: '1袋(100g)', unitG: 100, kcal: 34, protein: 2.7, fat: 0.2, carbs: 7.6 },
  { id: 'shimeji', name: 'しめじ', kana: 'しめじ', cat: '副菜', unit: '1袋(100g)', unitG: 100, kcal: 26, protein: 2.7, fat: 0.6, carbs: 4.8 },
  { id: 'daikon', name: '大根', kana: 'だいこん', cat: '副菜', unit: '100g', unitG: 100, kcal: 18, protein: 0.5, fat: 0.1, carbs: 4.1 },
  { id: 'gobou', name: 'ごぼう', kana: 'ごぼう', cat: '副菜', unit: '100g', unitG: 100, kcal: 58, protein: 1.8, fat: 0.1, carbs: 15.4 },
  { id: 'renkon', name: 'れんこん', kana: 'れんこん', cat: '副菜', unit: '100g', unitG: 100, kcal: 66, protein: 1.9, fat: 0.1, carbs: 15.5 },
  { id: 'kabocha', name: 'かぼちゃ', kana: 'かぼちゃ', cat: '副菜', unit: '100g', unitG: 100, kcal: 78, protein: 1.9, fat: 0.3, carbs: 20.6 },
  { id: 'potato', name: 'じゃがいも', kana: 'じゃがいも', cat: '副菜', unit: '1個(150g)', unitG: 150, kcal: 89, protein: 2.4, fat: 0.2, carbs: 26.1 },
  { id: 'satsumaimo', name: 'さつまいも', kana: 'さつまいも', cat: '副菜', unit: '100g', unitG: 100, kcal: 127, protein: 1.2, fat: 0.2, carbs: 31.5 },
  { id: 'satoimo', name: 'さといも', kana: 'さといも', cat: '副菜', unit: '100g', unitG: 100, kcal: 53, protein: 1.5, fat: 0.1, carbs: 13.1 },
  { id: 'corn', name: 'とうもろこし', kana: 'とうもろこし', cat: '副菜', unit: '1本(200g)', unitG: 200, kcal: 184, protein: 7.4, fat: 3.4, carbs: 33.6 },
  { id: 'avocado', name: 'アボカド', kana: 'あぼかど', cat: '副菜', unit: '1個(140g)', unitG: 140, kcal: 250, protein: 3.5, fat: 25.7, carbs: 8.7 },

  // 海藻・低カロリー
  { id: 'wakame', name: 'わかめ', kana: 'わかめ', cat: '副菜', unit: '20g', unitG: 20, kcal: 3, protein: 0.4, fat: 0.0, carbs: 1.2 },
  { id: 'nori', name: '焼きのり', kana: 'のり', cat: '副菜', unit: '1枚(3g)', unitG: 3, kcal: 6, protein: 1.2, fat: 0.1, carbs: 1.3 },
  { id: 'hijiki', name: 'ひじき煮', kana: 'ひじき', cat: '副菜', unit: '50g', unitG: 50, kcal: 41, protein: 1.5, fat: 1.5, carbs: 5.2 },
  { id: 'shirataki', name: '白滝', kana: 'しらたき', cat: '副菜', unit: '100g', unitG: 100, kcal: 7, protein: 0.2, fat: 0.0, carbs: 3.0 },
  { id: 'konnyaku', name: 'こんにゃく', kana: 'こんにゃく', cat: '副菜', unit: '100g', unitG: 100, kcal: 5, protein: 0.1, fat: 0.0, carbs: 2.3 },

  // 果物
  { id: 'banana', name: 'バナナ', kana: 'ばなな', cat: '果物', unit: '1本(100g)', unitG: 100, kcal: 93, protein: 1.1, fat: 0.2, carbs: 22.5 },
  { id: 'apple', name: 'りんご', kana: 'りんご', cat: '果物', unit: '1個(250g)', unitG: 250, kcal: 135, protein: 0.5, fat: 0.5, carbs: 38.3 },
  { id: 'orange', name: 'みかん', kana: 'みかん', cat: '果物', unit: '1個(80g)', unitG: 80, kcal: 39, protein: 0.6, fat: 0.1, carbs: 9.7 },
  { id: 'strawberry', name: 'いちご', kana: 'いちご', cat: '果物', unit: '5粒(75g)', unitG: 75, kcal: 23, protein: 0.7, fat: 0.1, carbs: 6.4 },
  { id: 'grape', name: 'ぶどう', kana: 'ぶどう', cat: '果物', unit: '100g', unitG: 100, kcal: 58, protein: 0.4, fat: 0.1, carbs: 15.7 },
  { id: 'kiwi', name: 'キウイ', kana: 'きうい', cat: '果物', unit: '1個(80g)', unitG: 80, kcal: 41, protein: 0.8, fat: 0.2, carbs: 10.9 },
  { id: 'blueberry', name: 'ブルーベリー', kana: 'ぶるーべりー', cat: '果物', unit: '50g', unitG: 50, kcal: 24, protein: 0.3, fat: 0.1, carbs: 6.4 },
  { id: 'pineapple', name: 'パイナップル', kana: 'ぱいなっぷる', cat: '果物', unit: '100g', unitG: 100, kcal: 54, protein: 0.6, fat: 0.1, carbs: 13.7 },

  // ナッツ
  { id: 'almond', name: 'アーモンド', kana: 'あーもんど', cat: '間食', unit: '10粒(15g)', unitG: 15, kcal: 91, protein: 3.1, fat: 7.8, carbs: 3.1 },
  { id: 'walnut', name: 'くるみ', kana: 'くるみ', cat: '間食', unit: '5粒(15g)', unitG: 15, kcal: 107, protein: 2.2, fat: 10.3, carbs: 1.8 },
  { id: 'cashew', name: 'カシューナッツ', kana: 'かしゅー', cat: '間食', unit: '15g', unitG: 15, kcal: 86, protein: 3.0, fat: 6.9, carbs: 4.0 },
  { id: 'mixed-nuts', name: 'ミックスナッツ', kana: 'みっくす', cat: '間食', unit: '30g', unitG: 30, kcal: 180, protein: 5.8, fat: 15.6, carbs: 6.0 },

  // 調味料・油脂
  { id: 'oil', name: 'サラダ油', kana: 'さらだあぶら', cat: '油脂', unit: '大さじ1(12g)', unitG: 12, kcal: 110, protein: 0, fat: 12.0, carbs: 0 },
  { id: 'olive-oil', name: 'オリーブオイル', kana: 'おりーぶ', cat: '油脂', unit: '大さじ1(12g)', unitG: 12, kcal: 109, protein: 0, fat: 12.0, carbs: 0 },
  { id: 'mayo', name: 'マヨネーズ', kana: 'まよねーず', cat: '調味料', unit: '大さじ1(12g)', unitG: 12, kcal: 80, protein: 0.2, fat: 8.4, carbs: 0.6 },
  { id: 'ketchup', name: 'ケチャップ', kana: 'けちゃっぷ', cat: '調味料', unit: '大さじ1(15g)', unitG: 15, kcal: 16, protein: 0.3, fat: 0.0, carbs: 4.0 },
  { id: 'sugar', name: '砂糖', kana: 'さとう', cat: '調味料', unit: '大さじ1(9g)', unitG: 9, kcal: 35, protein: 0, fat: 0, carbs: 9.0 },

  // 外食・定食
  { id: 'gyudon', name: '牛丼（並）', kana: 'ぎゅうどん', cat: '外食', unit: '1杯', unitG: 380, kcal: 633, protein: 20.0, fat: 20.4, carbs: 89.0 },
  { id: 'oyakodon', name: '親子丼', kana: 'おやこどん', cat: '外食', unit: '1杯', unitG: 400, kcal: 638, protein: 28.0, fat: 14.5, carbs: 96.0 },
  { id: 'katsudon', name: 'かつ丼', kana: 'かつどん', cat: '外食', unit: '1杯', unitG: 450, kcal: 893, protein: 32.5, fat: 28.0, carbs: 124.0 },
  { id: 'unadon', name: 'うな丼', kana: 'うなどん', cat: '外食', unit: '1杯', unitG: 380, kcal: 768, protein: 30.0, fat: 22.0, carbs: 104.0 },
  { id: 'curry-rice', name: 'カレーライス', kana: 'かれー', cat: '外食', unit: '1人前', unitG: 450, kcal: 760, protein: 16.0, fat: 25.0, carbs: 110.0 },
  { id: 'hayashi', name: 'ハヤシライス', kana: 'はやし', cat: '外食', unit: '1人前', unitG: 400, kcal: 680, protein: 18.0, fat: 22.0, carbs: 96.0 },
  { id: 'omelet-rice', name: 'オムライス', kana: 'おむらいす', cat: '外食', unit: '1人前', unitG: 400, kcal: 750, protein: 23.0, fat: 27.0, carbs: 95.0 },
  { id: 'ramen-shoyu', name: 'ラーメン（醤油）', kana: 'らーめん', cat: '外食', unit: '1杯', unitG: 600, kcal: 478, protein: 24.0, fat: 13.4, carbs: 65.0 },
  { id: 'ramen-tonkotsu', name: 'ラーメン（豚骨）', kana: 'らーめん', cat: '外食', unit: '1杯', unitG: 600, kcal: 600, protein: 25.0, fat: 20.0, carbs: 73.0 },
  { id: 'tsukemen', name: 'つけ麺', kana: 'つけめん', cat: '外食', unit: '1人前', unitG: 550, kcal: 715, protein: 28.0, fat: 16.0, carbs: 110.0 },
  { id: 'yakisoba', name: '焼きそば', kana: 'やきそば', cat: '外食', unit: '1人前', unitG: 400, kcal: 540, protein: 16.0, fat: 18.0, carbs: 78.0 },
  { id: 'kakeudon', name: 'かけうどん', kana: 'うどん', cat: '外食', unit: '1杯', unitG: 500, kcal: 326, protein: 9.5, fat: 1.5, carbs: 67.0 },
  { id: 'kitsune', name: 'きつねうどん', kana: 'きつねうどん', cat: '外食', unit: '1杯', unitG: 520, kcal: 432, protein: 13.0, fat: 11.0, carbs: 70.0 },
  { id: 'tenpura-soba', name: '天ぷらそば', kana: 'てんぷらそば', cat: '外食', unit: '1人前', unitG: 520, kcal: 458, protein: 16.0, fat: 11.0, carbs: 73.0 },
  { id: 'sushi-set', name: '寿司（10貫）', kana: 'すし', cat: '外食', unit: '10貫', unitG: 280, kcal: 532, protein: 23.0, fat: 5.5, carbs: 96.0 },
  { id: 'onigiri-shake', name: 'おにぎり（鮭）', kana: 'おにぎり', cat: '主食', unit: '1個(110g)', unitG: 110, kcal: 187, protein: 4.6, fat: 1.4, carbs: 38.0 },
  { id: 'onigiri-tuna', name: 'おにぎり（ツナマヨ）', kana: 'おにぎり', cat: '主食', unit: '1個(110g)', unitG: 110, kcal: 234, protein: 5.3, fat: 7.5, carbs: 36.0 },
  { id: 'onigiri-ume', name: 'おにぎり（梅）', kana: 'おにぎり', cat: '主食', unit: '1個(110g)', unitG: 110, kcal: 175, protein: 3.6, fat: 0.5, carbs: 39.0 },
  { id: 'sandwich', name: 'サンドイッチ（ハム）', kana: 'さんどいっち', cat: '主食', unit: '1パック', unitG: 160, kcal: 322, protein: 13.0, fat: 12.5, carbs: 38.0 },
  { id: 'hambagu', name: 'ハンバーグ定食', kana: 'はんばーぐ', cat: '外食', unit: '1人前', unitG: 500, kcal: 820, protein: 32.0, fat: 35.0, carbs: 88.0 },
  { id: 'shogayaki', name: '生姜焼き定食', kana: 'しょうがやき', cat: '外食', unit: '1人前', unitG: 500, kcal: 750, protein: 28.0, fat: 28.0, carbs: 86.0 },
  { id: 'sabashio', name: 'サバ塩焼き定食', kana: 'さばしお', cat: '外食', unit: '1人前', unitG: 480, kcal: 620, protein: 30.0, fat: 22.0, carbs: 78.0 },
  { id: 'tonkatsu', name: 'とんかつ定食', kana: 'とんかつ', cat: '外食', unit: '1人前', unitG: 500, kcal: 950, protein: 32.0, fat: 42.0, carbs: 92.0 },
  { id: 'karaage', name: '唐揚げ定食', kana: 'からあげ', cat: '外食', unit: '1人前', unitG: 500, kcal: 870, protein: 35.0, fat: 36.0, carbs: 84.0 },
  { id: 'salad-chicken', name: 'サラダチキン', kana: 'さらだちきん', cat: '主菜', unit: '1個(110g)', unitG: 110, kcal: 121, protein: 25.0, fat: 1.7, carbs: 1.0 },
  { id: 'salad-bowl', name: 'サラダボウル（チキン）', kana: 'さらだ', cat: '主食', unit: '1人前', unitG: 350, kcal: 380, protein: 28.0, fat: 14.0, carbs: 32.0 },

  // 飲料
  { id: 'coffee-black', name: 'コーヒー（ブラック）', kana: 'こーひー', cat: '飲料', unit: '200ml', unitG: 200, kcal: 8, protein: 0.4, fat: 0, carbs: 1.4 },
  { id: 'cafe-latte', name: 'カフェラテ', kana: 'らて', cat: '飲料', unit: '240ml', unitG: 240, kcal: 130, protein: 7.0, fat: 7.0, carbs: 9.5 },
  { id: 'green-tea', name: '緑茶', kana: 'りょくちゃ', cat: '飲料', unit: '200ml', unitG: 200, kcal: 4, protein: 0.4, fat: 0, carbs: 0.4 },
  { id: 'orange-juice', name: 'オレンジジュース', kana: 'おれんじ', cat: '飲料', unit: '200ml', unitG: 200, kcal: 84, protein: 1.4, fat: 0.2, carbs: 21.0 },
  { id: 'coke', name: 'コーラ', kana: 'こーら', cat: '飲料', unit: '500ml', unitG: 500, kcal: 225, protein: 0, fat: 0, carbs: 56.5 },
  { id: 'sports-drink', name: 'スポーツドリンク', kana: 'すぽーつ', cat: '飲料', unit: '500ml', unitG: 500, kcal: 125, protein: 0, fat: 0, carbs: 31.0 },
  { id: 'beer', name: 'ビール', kana: 'びーる', cat: '飲料', unit: '350ml', unitG: 350, kcal: 140, protein: 1.1, fat: 0, carbs: 10.9 },
  { id: 'highball', name: 'ハイボール', kana: 'はいぼーる', cat: '飲料', unit: '350ml', unitG: 350, kcal: 168, protein: 0, fat: 0, carbs: 0 },
  { id: 'sake', name: '日本酒', kana: 'にほんしゅ', cat: '飲料', unit: '1合(180ml)', unitG: 180, kcal: 196, protein: 0.7, fat: 0, carbs: 8.8 },
  { id: 'wine-red', name: '赤ワイン', kana: 'わいん', cat: '飲料', unit: '120ml', unitG: 120, kcal: 88, protein: 0.2, fat: 0, carbs: 1.8 },

  // 間食・お菓子
  { id: 'chocolate', name: 'チョコレート', kana: 'ちょこ', cat: '間食', unit: '1枚(50g)', unitG: 50, kcal: 279, protein: 3.5, fat: 17.1, carbs: 27.9 },
  { id: 'cookie', name: 'クッキー', kana: 'くっきー', cat: '間食', unit: '1枚(10g)', unitG: 10, kcal: 51, protein: 0.6, fat: 2.6, carbs: 6.2 },
  { id: 'donut', name: 'ドーナツ', kana: 'どーなつ', cat: '間食', unit: '1個(60g)', unitG: 60, kcal: 230, protein: 4.0, fat: 11.4, carbs: 28.1 },
  { id: 'cake-short', name: 'ショートケーキ', kana: 'けーき', cat: '間食', unit: '1切', unitG: 110, kcal: 367, protein: 4.6, fat: 19.8, carbs: 42.7 },
  { id: 'icecream', name: 'アイスクリーム', kana: 'あいす', cat: '間食', unit: '1個(120g)', unitG: 120, kcal: 216, protein: 4.6, fat: 9.6, carbs: 27.7 },
  { id: 'pudding', name: 'プリン', kana: 'ぷりん', cat: '間食', unit: '1個(100g)', unitG: 100, kcal: 126, protein: 5.5, fat: 5.0, carbs: 14.7 },
  { id: 'rice-cracker', name: 'おせんべい', kana: 'せんべい', cat: '間食', unit: '1枚(20g)', unitG: 20, kcal: 76, protein: 1.5, fat: 0.2, carbs: 17.4 },
  { id: 'chips', name: 'ポテトチップス', kana: 'ぽてとちっぷ', cat: '間食', unit: '1袋(60g)', unitG: 60, kcal: 332, protein: 3.0, fat: 21.0, carbs: 33.0 },
  { id: 'protein-bar', name: 'プロテインバー', kana: 'ぷろていん', cat: '間食', unit: '1本(45g)', unitG: 45, kcal: 188, protein: 15.0, fat: 8.0, carbs: 14.0 },
  { id: 'whey-protein', name: 'ホエイプロテイン', kana: 'ぷろていん', cat: '飲料', unit: '1杯(30g)', unitG: 30, kcal: 119, protein: 22.0, fat: 1.5, carbs: 4.5 },

  // 汁物
  { id: 'miso-soup', name: 'みそ汁', kana: 'みそしる', cat: '汁物', unit: '1杯', unitG: 200, kcal: 40, protein: 3.0, fat: 1.2, carbs: 4.5 },
  { id: 'tonjiru', name: '豚汁', kana: 'とんじる', cat: '汁物', unit: '1杯', unitG: 250, kcal: 195, protein: 8.0, fat: 11.0, carbs: 15.0 },
  { id: 'consome', name: 'コンソメスープ', kana: 'こんそめ', cat: '汁物', unit: '1杯', unitG: 200, kcal: 18, protein: 0.8, fat: 0, carbs: 3.6 },

  // 卵料理
  { id: 'medama', name: '目玉焼き', kana: 'めだまやき', cat: '主菜', unit: '1個', unitG: 55, kcal: 110, protein: 6.2, fat: 9.0, carbs: 0.2 },
  { id: 'omelet', name: 'オムレツ', kana: 'おむれつ', cat: '主菜', unit: '2個分', unitG: 120, kcal: 220, protein: 13.0, fat: 18.0, carbs: 0.5 },
  { id: 'dashimaki', name: 'だし巻き卵', kana: 'だしまき', cat: '主菜', unit: '卵2個分', unitG: 130, kcal: 180, protein: 12.6, fat: 12.0, carbs: 2.5 },
  { id: 'tamagoyaki-sweet', name: '甘い卵焼き', kana: 'たまごやき', cat: '主菜', unit: '卵2個分', unitG: 130, kcal: 210, protein: 13.0, fat: 11.0, carbs: 11.0 },

  // 揚げ物
  { id: 'gyoza', name: '餃子', kana: 'ぎょうざ', cat: '主菜', unit: '5個', unitG: 100, kcal: 230, protein: 8.0, fat: 11.0, carbs: 23.0 },
  { id: 'shumai', name: 'シュウマイ', kana: 'しゅうまい', cat: '主菜', unit: '5個', unitG: 100, kcal: 209, protein: 10.0, fat: 9.4, carbs: 19.5 },
  { id: 'harumaki', name: '春巻き', kana: 'はるまき', cat: '主菜', unit: '1本(50g)', unitG: 50, kcal: 110, protein: 2.5, fat: 6.5, carbs: 10.5 },
  { id: 'korokke', name: 'コロッケ', kana: 'ころっけ', cat: '主菜', unit: '1個(80g)', unitG: 80, kcal: 144, protein: 2.9, fat: 8.0, carbs: 15.5 },
  { id: 'menchikatsu', name: 'メンチカツ', kana: 'めんちかつ', cat: '主菜', unit: '1個(100g)', unitG: 100, kcal: 273, protein: 11.7, fat: 18.7, carbs: 14.8 },
  { id: 'agedashi', name: '揚げ出し豆腐', kana: 'あげだしどうふ', cat: '主菜', unit: '1人前', unitG: 200, kcal: 220, protein: 12.0, fat: 14.0, carbs: 11.0 }
];

export const FOOD_CATEGORIES = ['すべて', '主食', '主菜', '副菜', '汁物', '果物', '乳製品', '飲料', '油脂', '間食', '外食', '調味料'];

export function searchFoods(query: string, category?: string, limit = 80): Food[] {
  const q = (query || '').toLowerCase().trim();
  return FOODS.filter((f) => {
    if (category && category !== 'すべて' && f.cat !== category) return false;
    if (!q) return true;
    return f.name.toLowerCase().includes(q) || f.kana.toLowerCase().includes(q);
  }).slice(0, limit);
}

export function getFood(id: string): Food | undefined {
  return FOODS.find((f) => f.id === id);
}

export function scaleFood(food: Food, qty: number) {
  return {
    name: food.name,
    foodId: food.id,
    qty,
    unit: food.unit,
    kcal: Math.round(food.kcal * qty),
    protein: +(food.protein * qty).toFixed(1),
    fat: +(food.fat * qty).toFixed(1),
    carbs: +(food.carbs * qty).toFixed(1)
  };
}
