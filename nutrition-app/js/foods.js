/* Food database. Values per "unit" listed in `unit` field.
 * Source basis: 日本食品標準成分表2020 (8th rev) + common 外食/コンビニ estimates.
 * Fields: id, name, kana(search), category, unit, unitG, kcal, p, f, c
 * (kcal/p/f/c are per unit, not per 100g, for UX)
 */
const FOODS = [
  // --- 主食 / 米・パン ---
  { id: 'rice-1', name: 'ご飯（茶碗1杯）', kana: 'ごはん こめ rice', cat: '主食', unit: '杯(150g)', unitG: 150, kcal: 234, p: 3.8, f: 0.5, c: 53.4 },
  { id: 'rice-s', name: 'ご飯（小盛り）', kana: 'ごはん こめ', cat: '主食', unit: '100g', unitG: 100, kcal: 156, p: 2.5, f: 0.3, c: 35.6 },
  { id: 'rice-l', name: 'ご飯（大盛り）', kana: 'ごはん こめ', cat: '主食', unit: '250g', unitG: 250, kcal: 390, p: 6.3, f: 0.8, c: 89.0 },
  { id: 'genmai', name: '玄米ご飯', kana: 'げんまい', cat: '主食', unit: '杯(150g)', unitG: 150, kcal: 248, p: 4.2, f: 1.5, c: 53.4 },
  { id: 'mochi', name: 'もち', kana: 'もち', cat: '主食', unit: '1個(50g)', unitG: 50, kcal: 117, p: 2.0, f: 0.4, c: 25.4 },
  { id: 'shokupan-6', name: '食パン6枚切り', kana: 'しょくぱん bread', cat: '主食', unit: '1枚(60g)', unitG: 60, kcal: 149, p: 5.4, f: 2.5, c: 27.8 },
  { id: 'shokupan-8', name: '食パン8枚切り', kana: 'しょくぱん', cat: '主食', unit: '1枚(45g)', unitG: 45, kcal: 112, p: 4.0, f: 1.9, c: 20.9 },
  { id: 'roll', name: 'ロールパン', kana: 'ろーるぱん', cat: '主食', unit: '1個(30g)', unitG: 30, kcal: 95, p: 3.0, f: 2.7, c: 14.6 },
  { id: 'croissant', name: 'クロワッサン', kana: 'くろわっさん', cat: '主食', unit: '1個(40g)', unitG: 40, kcal: 179, p: 3.2, f: 10.7, c: 17.6 },
  { id: 'bagel', name: 'ベーグル', kana: 'べーぐる', cat: '主食', unit: '1個(95g)', unitG: 95, kcal: 256, p: 9.0, f: 1.9, c: 51.2 },
  { id: 'udon-yude', name: 'うどん（茹で）', kana: 'うどん udon', cat: '主食', unit: '1玉(250g)', unitG: 250, kcal: 263, p: 6.5, f: 1.0, c: 54.3 },
  { id: 'soba-yude', name: 'そば（茹で）', kana: 'そば soba', cat: '主食', unit: '1玉(180g)', unitG: 180, kcal: 230, p: 8.6, f: 1.8, c: 47.0 },
  { id: 'ramen-nama', name: '中華麺（茹で）', kana: 'らーめん ramen', cat: '主食', unit: '1玉(220g)', unitG: 220, kcal: 327, p: 10.8, f: 1.3, c: 64.7 },
  { id: 'pasta-yude', name: 'パスタ（茹で）', kana: 'ぱすた pasta', cat: '主食', unit: '1人前(250g)', unitG: 250, kcal: 373, p: 13.0, f: 2.3, c: 75.0 },
  { id: 'cereal', name: 'シリアル（プレーン）', kana: 'しりある cereal', cat: '主食', unit: '40g', unitG: 40, kcal: 152, p: 3.0, f: 0.6, c: 33.3 },
  { id: 'granola', name: 'グラノーラ', kana: 'ぐらのーら granola', cat: '主食', unit: '50g', unitG: 50, kcal: 220, p: 4.0, f: 7.5, c: 35.4 },
  { id: 'oats', name: 'オートミール（乾）', kana: 'おーとみーる oats', cat: '主食', unit: '30g', unitG: 30, kcal: 105, p: 4.1, f: 1.7, c: 20.7 },

  // --- 主菜 / 肉 ---
  { id: 'chicken-breast-skin', name: '鶏むね肉（皮あり）', kana: 'とりむね chicken', cat: '主菜', unit: '100g', unitG: 100, kcal: 145, p: 21.3, f: 5.9, c: 0 },
  { id: 'chicken-breast-noskin', name: '鶏むね肉（皮なし）', kana: 'とりむね chicken', cat: '主菜', unit: '100g', unitG: 100, kcal: 105, p: 23.3, f: 1.9, c: 0 },
  { id: 'chicken-thigh-skin', name: '鶏もも肉（皮あり）', kana: 'とりもも chicken', cat: '主菜', unit: '100g', unitG: 100, kcal: 190, p: 16.6, f: 14.2, c: 0 },
  { id: 'chicken-thigh-noskin', name: '鶏もも肉（皮なし）', kana: 'とりもも chicken', cat: '主菜', unit: '100g', unitG: 100, kcal: 113, p: 19.0, f: 5.0, c: 0 },
  { id: 'chicken-sasami', name: 'ささみ', kana: 'ささみ sasami', cat: '主菜', unit: '1本(40g)', unitG: 40, kcal: 39, p: 9.5, f: 0.3, c: 0 },
  { id: 'beef-mom-aka', name: '牛もも（赤身）', kana: 'ぎゅう beef', cat: '主菜', unit: '100g', unitG: 100, kcal: 176, p: 21.3, f: 10.7, c: 0.5 },
  { id: 'beef-rosu', name: '牛ロース', kana: 'ぎゅう beef', cat: '主菜', unit: '100g', unitG: 100, kcal: 295, p: 16.5, f: 26.1, c: 0.2 },
  { id: 'beef-katz', name: '牛バラ', kana: 'ぎゅう beef', cat: '主菜', unit: '100g', unitG: 100, kcal: 381, p: 12.8, f: 39.4, c: 0.1 },
  { id: 'pork-mom', name: '豚もも', kana: 'ぶた pork', cat: '主菜', unit: '100g', unitG: 100, kcal: 171, p: 20.5, f: 10.2, c: 0.2 },
  { id: 'pork-rosu', name: '豚ロース', kana: 'ぶた pork', cat: '主菜', unit: '100g', unitG: 100, kcal: 248, p: 19.3, f: 19.2, c: 0.2 },
  { id: 'pork-bara', name: '豚バラ', kana: 'ぶた pork', cat: '主菜', unit: '100g', unitG: 100, kcal: 366, p: 14.4, f: 35.4, c: 0.1 },
  { id: 'pork-hire', name: '豚ヒレ', kana: 'ぶた pork', cat: '主菜', unit: '100g', unitG: 100, kcal: 118, p: 22.2, f: 3.7, c: 0.3 },
  { id: 'ham', name: 'ハム', kana: 'はむ ham', cat: '主菜', unit: '1枚(15g)', unitG: 15, kcal: 17, p: 2.8, f: 0.6, c: 0.2 },
  { id: 'bacon', name: 'ベーコン', kana: 'べーこん bacon', cat: '主菜', unit: '1枚(15g)', unitG: 15, kcal: 60, p: 1.9, f: 5.9, c: 0.0 },
  { id: 'sausage', name: 'ウインナー', kana: 'うぃんなー sausage', cat: '主菜', unit: '1本(20g)', unitG: 20, kcal: 64, p: 2.3, f: 5.7, c: 0.6 },

  // --- 主菜 / 魚 ---
  { id: 'salmon', name: '鮭（生）', kana: 'さけ salmon', cat: '主菜', unit: '1切(80g)', unitG: 80, kcal: 106, p: 17.8, f: 3.3, c: 0.1 },
  { id: 'maguro-aka', name: 'まぐろ赤身', kana: 'まぐろ tuna', cat: '主菜', unit: '100g', unitG: 100, kcal: 115, p: 26.4, f: 1.4, c: 0.1 },
  { id: 'maguro-toro', name: 'まぐろトロ', kana: 'まぐろ tuna toro', cat: '主菜', unit: '100g', unitG: 100, kcal: 308, p: 20.1, f: 27.5, c: 0.1 },
  { id: 'saba', name: 'さば', kana: 'さば mackerel', cat: '主菜', unit: '1切(80g)', unitG: 80, kcal: 169, p: 16.5, f: 13.4, c: 0.2 },
  { id: 'aji', name: 'あじ', kana: 'あじ horse mackerel', cat: '主菜', unit: '1尾(80g)', unitG: 80, kcal: 89, p: 15.8, f: 3.6, c: 0.1 },
  { id: 'sanma', name: 'さんま', kana: 'さんま pacific saury', cat: '主菜', unit: '1尾(100g)', unitG: 100, kcal: 287, p: 18.1, f: 25.6, c: 0.1 },
  { id: 'iwashi', name: 'いわし', kana: 'いわし sardine', cat: '主菜', unit: '1尾(80g)', unitG: 80, kcal: 134, p: 15.4, f: 7.4, c: 0.2 },
  { id: 'tara', name: 'たら', kana: 'たら cod', cat: '主菜', unit: '1切(80g)', unitG: 80, kcal: 61, p: 14.1, f: 0.2, c: 0.1 },
  { id: 'buri', name: 'ぶり', kana: 'ぶり yellowtail', cat: '主菜', unit: '1切(80g)', unitG: 80, kcal: 178, p: 17.1, f: 14.1, c: 0.3 },
  { id: 'ebi', name: 'えび', kana: 'えび shrimp', cat: '主菜', unit: '5尾(60g)', unitG: 60, kcal: 49, p: 11.5, f: 0.2, c: 0.1 },
  { id: 'ika', name: 'いか', kana: 'いか squid', cat: '主菜', unit: '100g', unitG: 100, kcal: 76, p: 17.9, f: 0.8, c: 0.1 },
  { id: 'tako', name: 'たこ', kana: 'たこ octopus', cat: '主菜', unit: '100g', unitG: 100, kcal: 70, p: 16.4, f: 0.7, c: 0.1 },
  { id: 'tuna-can', name: 'ツナ缶（水煮）', kana: 'つな tuna can', cat: '主菜', unit: '1缶(70g)', unitG: 70, kcal: 49, p: 11.2, f: 0.2, c: 0.2 },
  { id: 'tuna-can-oil', name: 'ツナ缶（オイル）', kana: 'つな tuna can oil', cat: '主菜', unit: '1缶(70g)', unitG: 70, kcal: 187, p: 12.5, f: 14.8, c: 0.1 },
  { id: 'sashimi-set', name: '刺身盛り合わせ', kana: 'さしみ sashimi', cat: '主菜', unit: '1人前', unitG: 150, kcal: 195, p: 32.0, f: 6.0, c: 0.3 },

  // --- 卵・大豆 ---
  { id: 'egg', name: '卵', kana: 'たまご egg', cat: '主菜', unit: '1個(50g)', unitG: 50, kcal: 71, p: 6.1, f: 5.1, c: 0.2 },
  { id: 'egg-white', name: '卵白', kana: 'たまご しろみ egg white', cat: '主菜', unit: '1個(33g)', unitG: 33, kcal: 15, p: 3.4, f: 0.0, c: 0.1 },
  { id: 'tofu-momen', name: '木綿豆腐', kana: 'とうふ tofu', cat: '主菜', unit: '半丁(150g)', unitG: 150, kcal: 110, p: 10.5, f: 7.4, c: 0.6 },
  { id: 'tofu-kinu', name: '絹豆腐', kana: 'とうふ tofu', cat: '主菜', unit: '半丁(150g)', unitG: 150, kcal: 84, p: 7.4, f: 5.3, c: 1.7 },
  { id: 'natto', name: '納豆', kana: 'なっとう natto', cat: '主菜', unit: '1パック(45g)', unitG: 45, kcal: 86, p: 7.4, f: 4.5, c: 5.5 },
  { id: 'edamame', name: '枝豆', kana: 'えだまめ edamame', cat: '副菜', unit: '100g', unitG: 100, kcal: 125, p: 11.7, f: 6.2, c: 8.8 },
  { id: 'soymilk', name: '豆乳', kana: 'とうにゅう soy milk', cat: '飲料', unit: '200ml', unitG: 200, kcal: 92, p: 7.2, f: 4.0, c: 5.8 },
  { id: 'atsuage', name: '厚揚げ', kana: 'あつあげ', cat: '主菜', unit: '1枚(100g)', unitG: 100, kcal: 143, p: 10.7, f: 11.3, c: 0.9 },

  // --- 乳製品 ---
  { id: 'milk', name: '牛乳', kana: 'ぎゅうにゅう milk', cat: '飲料', unit: '200ml', unitG: 200, kcal: 122, p: 6.6, f: 7.6, c: 9.6 },
  { id: 'milk-low', name: '低脂肪乳', kana: 'ぎゅうにゅう low fat milk', cat: '飲料', unit: '200ml', unitG: 200, kcal: 84, p: 7.6, f: 2.0, c: 11.0 },
  { id: 'yogurt', name: 'プレーンヨーグルト', kana: 'よーぐると yogurt', cat: '乳製品', unit: '100g', unitG: 100, kcal: 56, p: 3.6, f: 3.0, c: 4.9 },
  { id: 'yogurt-greek', name: 'ギリシャヨーグルト（無糖）', kana: 'よーぐると greek yogurt', cat: '乳製品', unit: '100g', unitG: 100, kcal: 59, p: 10.0, f: 0.4, c: 3.6 },
  { id: 'cheese-slice', name: 'スライスチーズ', kana: 'ちーず cheese', cat: '乳製品', unit: '1枚(18g)', unitG: 18, kcal: 56, p: 4.1, f: 4.7, c: 0.2 },
  { id: 'cottage', name: 'カッテージチーズ', kana: 'かってーじ cottage cheese', cat: '乳製品', unit: '50g', unitG: 50, kcal: 50, p: 6.7, f: 2.3, c: 0.9 },
  { id: 'butter', name: 'バター', kana: 'ばたー butter', cat: '油脂', unit: '10g', unitG: 10, kcal: 70, p: 0.1, f: 8.1, c: 0.0 },

  // --- 野菜 ---
  { id: 'kyabetsu', name: 'キャベツ', kana: 'きゃべつ cabbage', cat: '副菜', unit: '100g', unitG: 100, kcal: 21, p: 1.3, f: 0.2, c: 5.2 },
  { id: 'lettuce', name: 'レタス', kana: 'れたす lettuce', cat: '副菜', unit: '100g', unitG: 100, kcal: 11, p: 0.6, f: 0.1, c: 2.8 },
  { id: 'tomato', name: 'トマト', kana: 'とまと tomato', cat: '副菜', unit: '1個(150g)', unitG: 150, kcal: 30, p: 1.1, f: 0.2, c: 7.1 },
  { id: 'kyuuri', name: 'きゅうり', kana: 'きゅうり cucumber', cat: '副菜', unit: '1本(100g)', unitG: 100, kcal: 13, p: 1.0, f: 0.1, c: 3.0 },
  { id: 'broccoli', name: 'ブロッコリー', kana: 'ぶろっこりー broccoli', cat: '副菜', unit: '100g', unitG: 100, kcal: 37, p: 5.4, f: 0.6, c: 6.6 },
  { id: 'spinach', name: 'ほうれん草', kana: 'ほうれんそう spinach', cat: '副菜', unit: '100g', unitG: 100, kcal: 18, p: 2.2, f: 0.4, c: 3.1 },
  { id: 'carrot', name: 'にんじん', kana: 'にんじん carrot', cat: '副菜', unit: '100g', unitG: 100, kcal: 35, p: 0.7, f: 0.2, c: 9.3 },
  { id: 'onion', name: '玉ねぎ', kana: 'たまねぎ onion', cat: '副菜', unit: '1個(200g)', unitG: 200, kcal: 66, p: 2.0, f: 0.2, c: 17.0 },
  { id: 'piman', name: 'ピーマン', kana: 'ぴーまん bell pepper', cat: '副菜', unit: '1個(30g)', unitG: 30, kcal: 6, p: 0.3, f: 0.1, c: 1.5 },
  { id: 'eggplant', name: 'なす', kana: 'なす eggplant', cat: '副菜', unit: '1本(80g)', unitG: 80, kcal: 14, p: 0.9, f: 0.1, c: 4.1 },
  { id: 'mushroom', name: 'しいたけ', kana: 'しいたけ shiitake', cat: '副菜', unit: '3個(60g)', unitG: 60, kcal: 15, p: 1.8, f: 0.2, c: 4.0 },
  { id: 'enoki', name: 'えのき', kana: 'えのき enoki', cat: '副菜', unit: '1袋(100g)', unitG: 100, kcal: 34, p: 2.7, f: 0.2, c: 7.6 },
  { id: 'shimeji', name: 'しめじ', kana: 'しめじ shimeji', cat: '副菜', unit: '1袋(100g)', unitG: 100, kcal: 26, p: 2.7, f: 0.6, c: 4.8 },
  { id: 'daikon', name: '大根', kana: 'だいこん daikon', cat: '副菜', unit: '100g', unitG: 100, kcal: 18, p: 0.5, f: 0.1, c: 4.1 },
  { id: 'gobou', name: 'ごぼう', kana: 'ごぼう burdock', cat: '副菜', unit: '100g', unitG: 100, kcal: 58, p: 1.8, f: 0.1, c: 15.4 },
  { id: 'renkon', name: 'れんこん', kana: 'れんこん lotus root', cat: '副菜', unit: '100g', unitG: 100, kcal: 66, p: 1.9, f: 0.1, c: 15.5 },
  { id: 'kabocha', name: 'かぼちゃ', kana: 'かぼちゃ pumpkin', cat: '副菜', unit: '100g', unitG: 100, kcal: 78, p: 1.9, f: 0.3, c: 20.6 },
  { id: 'potato', name: 'じゃがいも', kana: 'じゃがいも potato', cat: '副菜', unit: '1個(150g)', unitG: 150, kcal: 89, p: 2.4, f: 0.2, c: 26.1 },
  { id: 'satsumaimo', name: 'さつまいも', kana: 'さつまいも sweet potato', cat: '副菜', unit: '100g', unitG: 100, kcal: 127, p: 1.2, f: 0.2, c: 31.5 },
  { id: 'satoimo', name: 'さといも', kana: 'さといも taro', cat: '副菜', unit: '100g', unitG: 100, kcal: 53, p: 1.5, f: 0.1, c: 13.1 },
  { id: 'corn', name: 'とうもろこし', kana: 'とうもろこし corn', cat: '副菜', unit: '1本(200g)', unitG: 200, kcal: 184, p: 7.4, f: 3.4, c: 33.6 },
  { id: 'avocado', name: 'アボカド', kana: 'あぼかど avocado', cat: '副菜', unit: '1個(140g)', unitG: 140, kcal: 250, p: 3.5, f: 25.7, c: 8.7 },

  // --- 海藻・大豆製品 ---
  { id: 'wakame', name: 'わかめ', kana: 'わかめ wakame', cat: '副菜', unit: '20g', unitG: 20, kcal: 3, p: 0.4, f: 0.0, c: 1.2 },
  { id: 'nori', name: '焼きのり', kana: 'のり nori', cat: '副菜', unit: '1枚(3g)', unitG: 3, kcal: 6, p: 1.2, f: 0.1, c: 1.3 },
  { id: 'hijiki', name: 'ひじき煮', kana: 'ひじき hijiki', cat: '副菜', unit: '50g', unitG: 50, kcal: 41, p: 1.5, f: 1.5, c: 5.2 },
  { id: 'shirataki', name: '白滝', kana: 'しらたき shirataki', cat: '副菜', unit: '100g', unitG: 100, kcal: 7, p: 0.2, f: 0.0, c: 3.0 },
  { id: 'konnyaku', name: 'こんにゃく', kana: 'こんにゃく konjac', cat: '副菜', unit: '100g', unitG: 100, kcal: 5, p: 0.1, f: 0.0, c: 2.3 },

  // --- 果物 ---
  { id: 'banana', name: 'バナナ', kana: 'ばなな banana', cat: '果物', unit: '1本(100g)', unitG: 100, kcal: 93, p: 1.1, f: 0.2, c: 22.5 },
  { id: 'apple', name: 'りんご', kana: 'りんご apple', cat: '果物', unit: '1個(250g)', unitG: 250, kcal: 135, p: 0.5, f: 0.5, c: 38.3 },
  { id: 'orange', name: 'みかん', kana: 'みかん orange', cat: '果物', unit: '1個(80g)', unitG: 80, kcal: 39, p: 0.6, f: 0.1, c: 9.7 },
  { id: 'strawberry', name: 'いちご', kana: 'いちご strawberry', cat: '果物', unit: '5粒(75g)', unitG: 75, kcal: 23, p: 0.7, f: 0.1, c: 6.4 },
  { id: 'grape', name: 'ぶどう', kana: 'ぶどう grape', cat: '果物', unit: '100g', unitG: 100, kcal: 58, p: 0.4, f: 0.1, c: 15.7 },
  { id: 'kiwi', name: 'キウイ', kana: 'きうい kiwi', cat: '果物', unit: '1個(80g)', unitG: 80, kcal: 41, p: 0.8, f: 0.2, c: 10.9 },
  { id: 'blueberry', name: 'ブルーベリー', kana: 'ぶるーべりー blueberry', cat: '果物', unit: '50g', unitG: 50, kcal: 24, p: 0.3, f: 0.1, c: 6.4 },
  { id: 'pineapple', name: 'パイナップル', kana: 'ぱいなっぷる pineapple', cat: '果物', unit: '100g', unitG: 100, kcal: 54, p: 0.6, f: 0.1, c: 13.7 },

  // --- ナッツ・種実 ---
  { id: 'almond', name: 'アーモンド', kana: 'あーもんど almond', cat: '間食', unit: '10粒(15g)', unitG: 15, kcal: 91, p: 3.1, f: 7.8, c: 3.1 },
  { id: 'walnut', name: 'くるみ', kana: 'くるみ walnut', cat: '間食', unit: '5粒(15g)', unitG: 15, kcal: 107, p: 2.2, f: 10.3, c: 1.8 },
  { id: 'cashew', name: 'カシューナッツ', kana: 'かしゅー cashew', cat: '間食', unit: '15g', unitG: 15, kcal: 86, p: 3.0, f: 6.9, c: 4.0 },
  { id: 'mixed-nuts', name: 'ミックスナッツ', kana: 'みっくす mixed nuts', cat: '間食', unit: '30g', unitG: 30, kcal: 180, p: 5.8, f: 15.6, c: 6.0 },

  // --- 調味料 ---
  { id: 'oil', name: 'サラダ油', kana: 'さらだあぶら oil', cat: '油脂', unit: '大さじ1(12g)', unitG: 12, kcal: 110, p: 0, f: 12.0, c: 0 },
  { id: 'olive-oil', name: 'オリーブオイル', kana: 'おりーぶ olive oil', cat: '油脂', unit: '大さじ1(12g)', unitG: 12, kcal: 109, p: 0, f: 12.0, c: 0 },
  { id: 'mayo', name: 'マヨネーズ', kana: 'まよねーず mayo', cat: '調味料', unit: '大さじ1(12g)', unitG: 12, kcal: 80, p: 0.2, f: 8.4, c: 0.6 },
  { id: 'ketchup', name: 'ケチャップ', kana: 'けちゃっぷ ketchup', cat: '調味料', unit: '大さじ1(15g)', unitG: 15, kcal: 16, p: 0.3, f: 0.0, c: 4.0 },
  { id: 'sugar', name: '砂糖', kana: 'さとう sugar', cat: '調味料', unit: '大さじ1(9g)', unitG: 9, kcal: 35, p: 0, f: 0, c: 9.0 },

  // --- 定食・外食 ---
  { id: 'gyudon', name: '牛丼（並）', kana: 'ぎゅうどん beef bowl', cat: '外食', unit: '1杯', unitG: 380, kcal: 633, p: 20.0, f: 20.4, c: 89.0 },
  { id: 'oyakodon', name: '親子丼', kana: 'おやこどん', cat: '外食', unit: '1杯', unitG: 400, kcal: 638, p: 28.0, f: 14.5, c: 96.0 },
  { id: 'katsudon', name: 'かつ丼', kana: 'かつどん', cat: '外食', unit: '1杯', unitG: 450, kcal: 893, p: 32.5, f: 28.0, c: 124.0 },
  { id: 'unadon', name: 'うな丼', kana: 'うなどん', cat: '外食', unit: '1杯', unitG: 380, kcal: 768, p: 30.0, f: 22.0, c: 104.0 },
  { id: 'curry-rice', name: 'カレーライス', kana: 'かれー curry', cat: '外食', unit: '1人前', unitG: 450, kcal: 760, p: 16.0, f: 25.0, c: 110.0 },
  { id: 'hayashi', name: 'ハヤシライス', kana: 'はやし', cat: '外食', unit: '1人前', unitG: 400, kcal: 680, p: 18.0, f: 22.0, c: 96.0 },
  { id: 'omelet-rice', name: 'オムライス', kana: 'おむらいす omurice', cat: '外食', unit: '1人前', unitG: 400, kcal: 750, p: 23.0, f: 27.0, c: 95.0 },
  { id: 'ramen-shoyu', name: 'ラーメン（醤油）', kana: 'らーめん shoyu ramen', cat: '外食', unit: '1杯', unitG: 600, kcal: 478, p: 24.0, f: 13.4, c: 65.0 },
  { id: 'ramen-tonkotsu', name: 'ラーメン（豚骨）', kana: 'らーめん tonkotsu', cat: '外食', unit: '1杯', unitG: 600, kcal: 600, p: 25.0, f: 20.0, c: 73.0 },
  { id: 'tsukemen', name: 'つけ麺', kana: 'つけめん tsukemen', cat: '外食', unit: '1人前', unitG: 550, kcal: 715, p: 28.0, f: 16.0, c: 110.0 },
  { id: 'yakisoba', name: '焼きそば', kana: 'やきそば yakisoba', cat: '外食', unit: '1人前', unitG: 400, kcal: 540, p: 16.0, f: 18.0, c: 78.0 },
  { id: 'kakeudon', name: 'かけうどん', kana: 'うどん kake udon', cat: '外食', unit: '1杯', unitG: 500, kcal: 326, p: 9.5, f: 1.5, c: 67.0 },
  { id: 'kitsune', name: 'きつねうどん', kana: 'きつねうどん', cat: '外食', unit: '1杯', unitG: 520, kcal: 432, p: 13.0, f: 11.0, c: 70.0 },
  { id: 'tenpura-soba', name: '天ぷらそば', kana: 'てんぷらそば', cat: '外食', unit: '1人前', unitG: 520, kcal: 458, p: 16.0, f: 11.0, c: 73.0 },
  { id: 'sushi-set', name: '寿司（10貫）', kana: 'すし sushi', cat: '外食', unit: '10貫', unitG: 280, kcal: 532, p: 23.0, f: 5.5, c: 96.0 },
  { id: 'onigiri-shake', name: 'おにぎり（鮭）', kana: 'おにぎり salmon onigiri', cat: '主食', unit: '1個(110g)', unitG: 110, kcal: 187, p: 4.6, f: 1.4, c: 38.0 },
  { id: 'onigiri-tuna', name: 'おにぎり（ツナマヨ）', kana: 'おにぎり tuna onigiri', cat: '主食', unit: '1個(110g)', unitG: 110, kcal: 234, p: 5.3, f: 7.5, c: 36.0 },
  { id: 'onigiri-ume', name: 'おにぎり（梅）', kana: 'おにぎり ume onigiri', cat: '主食', unit: '1個(110g)', unitG: 110, kcal: 175, p: 3.6, f: 0.5, c: 39.0 },
  { id: 'sandwich', name: 'サンドイッチ（ハム）', kana: 'さんどいっち sandwich', cat: '主食', unit: '1パック', unitG: 160, kcal: 322, p: 13.0, f: 12.5, c: 38.0 },
  { id: 'hambagu', name: 'ハンバーグ定食', kana: 'はんばーぐ hamburg', cat: '外食', unit: '1人前', unitG: 500, kcal: 820, p: 32.0, f: 35.0, c: 88.0 },
  { id: 'shogayaki', name: '生姜焼き定食', kana: 'しょうがやき', cat: '外食', unit: '1人前', unitG: 500, kcal: 750, p: 28.0, f: 28.0, c: 86.0 },
  { id: 'sabashio', name: 'サバ塩焼き定食', kana: 'さばしお saba teishoku', cat: '外食', unit: '1人前', unitG: 480, kcal: 620, p: 30.0, f: 22.0, c: 78.0 },
  { id: 'tonkatsu', name: 'とんかつ定食', kana: 'とんかつ tonkatsu', cat: '外食', unit: '1人前', unitG: 500, kcal: 950, p: 32.0, f: 42.0, c: 92.0 },
  { id: 'karaage', name: '唐揚げ定食', kana: 'からあげ karaage', cat: '外食', unit: '1人前', unitG: 500, kcal: 870, p: 35.0, f: 36.0, c: 84.0 },
  { id: 'salada-chicken', name: 'サラダチキン', kana: 'さらだちきん salad chicken', cat: '主菜', unit: '1個(110g)', unitG: 110, kcal: 121, p: 25.0, f: 1.7, c: 1.0 },
  { id: 'salad-bowl', name: 'サラダボウル（チキン）', kana: 'さらだ salad bowl', cat: '主食', unit: '1人前', unitG: 350, kcal: 380, p: 28.0, f: 14.0, c: 32.0 },

  // --- 飲料 ---
  { id: 'coffee-black', name: 'コーヒー（ブラック）', kana: 'こーひー black coffee', cat: '飲料', unit: '200ml', unitG: 200, kcal: 8, p: 0.4, f: 0, c: 1.4 },
  { id: 'cafe-latte', name: 'カフェラテ', kana: 'らて latte', cat: '飲料', unit: '240ml', unitG: 240, kcal: 130, p: 7.0, f: 7.0, c: 9.5 },
  { id: 'green-tea', name: '緑茶', kana: 'りょくちゃ green tea', cat: '飲料', unit: '200ml', unitG: 200, kcal: 4, p: 0.4, f: 0, c: 0.4 },
  { id: 'orange-juice', name: 'オレンジジュース', kana: 'おれんじ orange juice', cat: '飲料', unit: '200ml', unitG: 200, kcal: 84, p: 1.4, f: 0.2, c: 21.0 },
  { id: 'coke', name: 'コーラ', kana: 'こーら cola', cat: '飲料', unit: '500ml', unitG: 500, kcal: 225, p: 0, f: 0, c: 56.5 },
  { id: 'sports-drink', name: 'スポーツドリンク', kana: 'すぽーつ sports drink', cat: '飲料', unit: '500ml', unitG: 500, kcal: 125, p: 0, f: 0, c: 31.0 },
  { id: 'beer', name: 'ビール', kana: 'びーる beer', cat: '飲料', unit: '350ml', unitG: 350, kcal: 140, p: 1.1, f: 0, c: 10.9 },
  { id: 'highball', name: 'ハイボール', kana: 'はいぼーる highball', cat: '飲料', unit: '350ml', unitG: 350, kcal: 168, p: 0, f: 0, c: 0 },
  { id: 'sake', name: '日本酒', kana: 'にほんしゅ sake', cat: '飲料', unit: '1合(180ml)', unitG: 180, kcal: 196, p: 0.7, f: 0, c: 8.8 },
  { id: 'wine-red', name: '赤ワイン', kana: 'わいん red wine', cat: '飲料', unit: '120ml', unitG: 120, kcal: 88, p: 0.2, f: 0, c: 1.8 },

  // --- 間食・お菓子 ---
  { id: 'chocolate', name: 'チョコレート', kana: 'ちょこ chocolate', cat: '間食', unit: '1枚(50g)', unitG: 50, kcal: 279, p: 3.5, f: 17.1, c: 27.9 },
  { id: 'cookie', name: 'クッキー', kana: 'くっきー cookie', cat: '間食', unit: '1枚(10g)', unitG: 10, kcal: 51, p: 0.6, f: 2.6, c: 6.2 },
  { id: 'donut', name: 'ドーナツ', kana: 'どーなつ donut', cat: '間食', unit: '1個(60g)', unitG: 60, kcal: 230, p: 4.0, f: 11.4, c: 28.1 },
  { id: 'cake-short', name: 'ショートケーキ', kana: 'けーき shortcake', cat: '間食', unit: '1切', unitG: 110, kcal: 367, p: 4.6, f: 19.8, c: 42.7 },
  { id: 'icecream', name: 'アイスクリーム', kana: 'あいす ice cream', cat: '間食', unit: '1個(120g)', unitG: 120, kcal: 216, p: 4.6, f: 9.6, c: 27.7 },
  { id: 'pudding', name: 'プリン', kana: 'ぷりん pudding', cat: '間食', unit: '1個(100g)', unitG: 100, kcal: 126, p: 5.5, f: 5.0, c: 14.7 },
  { id: 'rice-cracker', name: 'おせんべい', kana: 'せんべい rice cracker', cat: '間食', unit: '1枚(20g)', unitG: 20, kcal: 76, p: 1.5, f: 0.2, c: 17.4 },
  { id: 'chips', name: 'ポテトチップス', kana: 'ぽてとちっぷ chips', cat: '間食', unit: '1袋(60g)', unitG: 60, kcal: 332, p: 3.0, f: 21.0, c: 33.0 },
  { id: 'protein-bar', name: 'プロテインバー', kana: 'ぷろていん protein bar', cat: '間食', unit: '1本(45g)', unitG: 45, kcal: 188, p: 15.0, f: 8.0, c: 14.0 },
  { id: 'whey-protein', name: 'ホエイプロテイン', kana: 'ぷろていん whey protein', cat: '飲料', unit: '1杯(30g)', unitG: 30, kcal: 119, p: 22.0, f: 1.5, c: 4.5 },

  // --- 汁物 ---
  { id: 'miso-soup', name: 'みそ汁', kana: 'みそしる miso soup', cat: '汁物', unit: '1杯', unitG: 200, kcal: 40, p: 3.0, f: 1.2, c: 4.5 },
  { id: 'tonjiru', name: '豚汁', kana: 'とんじる tonjiru', cat: '汁物', unit: '1杯', unitG: 250, kcal: 195, p: 8.0, f: 11.0, c: 15.0 },
  { id: 'consome', name: 'コンソメスープ', kana: 'こんそめ consomme', cat: '汁物', unit: '1杯', unitG: 200, kcal: 18, p: 0.8, f: 0, c: 3.6 },

  // --- 卵料理 ---
  { id: 'medama', name: '目玉焼き', kana: 'めだまやき fried egg', cat: '主菜', unit: '1個', unitG: 55, kcal: 110, p: 6.2, f: 9.0, c: 0.2 },
  { id: 'omelet', name: 'オムレツ', kana: 'おむれつ omelet', cat: '主菜', unit: '2個分', unitG: 120, kcal: 220, p: 13.0, f: 18.0, c: 0.5 },
  { id: 'dashimaki', name: 'だし巻き卵', kana: 'だしまき', cat: '主菜', unit: '卵2個分', unitG: 130, kcal: 180, p: 12.6, f: 12.0, c: 2.5 },
  { id: 'tamagoyaki-sweet', name: '甘い卵焼き', kana: 'たまごやき', cat: '主菜', unit: '卵2個分', unitG: 130, kcal: 210, p: 13.0, f: 11.0, c: 11.0 },

  // --- 餃子・揚げ物 ---
  { id: 'gyoza', name: '餃子', kana: 'ぎょうざ gyoza', cat: '主菜', unit: '5個', unitG: 100, kcal: 230, p: 8.0, f: 11.0, c: 23.0 },
  { id: 'shumai', name: 'シュウマイ', kana: 'しゅうまい shumai', cat: '主菜', unit: '5個', unitG: 100, kcal: 209, p: 10.0, f: 9.4, c: 19.5 },
  { id: 'harumaki', name: '春巻き', kana: 'はるまき spring roll', cat: '主菜', unit: '1本(50g)', unitG: 50, kcal: 110, p: 2.5, f: 6.5, c: 10.5 },
  { id: 'korokke', name: 'コロッケ', kana: 'ころっけ croquette', cat: '主菜', unit: '1個(80g)', unitG: 80, kcal: 144, p: 2.9, f: 8.0, c: 15.5 },
  { id: 'menchikatsu', name: 'メンチカツ', kana: 'めんちかつ', cat: '主菜', unit: '1個(100g)', unitG: 100, kcal: 273, p: 11.7, f: 18.7, c: 14.8 },
  { id: 'agedashi', name: '揚げ出し豆腐', kana: 'あげだしどうふ', cat: '主菜', unit: '1人前', unitG: 200, kcal: 220, p: 12.0, f: 14.0, c: 11.0 }
];

const FOOD_CATEGORIES = ['すべて', '主食', '主菜', '副菜', '汁物', '果物', '乳製品', '飲料', '油脂', '間食', '外食', '調味料'];

function searchFoods(query, category) {
  const q = (query || '').toLowerCase().trim();
  return FOODS.filter((f) => {
    if (category && category !== 'すべて' && f.cat !== category) return false;
    if (!q) return true;
    return f.name.toLowerCase().includes(q) || f.kana.toLowerCase().includes(q);
  }).slice(0, 80);
}

function getFood(id) {
  return FOODS.find((f) => f.id === id);
}

window.FOODS = FOODS;
window.FOOD_CATEGORIES = FOOD_CATEGORIES;
window.searchFoods = searchFoods;
window.getFood = getFood;
