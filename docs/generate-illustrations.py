"""Generate illustrations (PNG) for the Recovery clinic app manual.

We draw simple, abstract screen mocks and flow diagrams using Pillow so the
manual has visual aids without depending on screenshots from the live app.
The clinic owner can replace any of these with real screenshots later.
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

OUT = "/home/user/--mochizuki/docs/illustrations"
os.makedirs(OUT, exist_ok=True)

# Brand palette
ACCENT = (245, 197, 24)         # #F5C518 yellow
ACCENT_50 = (255, 251, 230)
ACCENT_100 = (255, 246, 204)
ACCENT_600 = (224, 174, 8)
INK_900 = (15, 17, 21)
INK_700 = (42, 46, 54)
INK_500 = (91, 98, 112)
INK_400 = (122, 130, 144)
INK_300 = (168, 174, 184)
INK_200 = (215, 219, 224)
INK_100 = (238, 240, 243)
INK_50 = (247, 248, 250)
WHITE = (255, 255, 255)
ROSE = (244, 63, 94)
ROSE_LIGHT = (252, 165, 165)
EMERALD = (16, 185, 129)
SKY = (14, 165, 233)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc"
        if bold
        else "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.otf"
        if bold
        else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def rounded_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int = 16,
    fill=WHITE,
    outline=INK_200,
    width: int = 2,
):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(
    draw: ImageDraw.ImageDraw,
    pos: tuple[int, int],
    s: str,
    size: int = 14,
    bold: bool = False,
    color=INK_900,
    anchor: str = "la",
):
    draw.text(pos, s, font=_font(size, bold=bold), fill=color, anchor=anchor)


# ----------------------------------------------------------------------
# 1. Mypage layout overview
# ----------------------------------------------------------------------

def make_mypage_overview() -> str:
    W, H = 720, 1100
    img = Image.new("RGB", (W, H), INK_50)
    d = ImageDraw.Draw(img)

    pad = 32
    cur = pad
    # Header
    rounded_rect(d, (pad, cur, W - pad, cur + 56), radius=12, fill=WHITE, outline=INK_100)
    text(d, (pad + 16, cur + 18), "🦔 リカバリー鍼灸院 / マイページ", size=18, bold=True)
    text(d, (W - pad - 16, cur + 18), "ログアウト", size=12, color=INK_400, anchor="ra")
    cur += 56 + 18

    # Welcome
    text(d, (pad + 8, cur), "0001", size=12, bold=True, color=ACCENT_600)
    cur += 22
    text(d, (pad + 8, cur), "黒川 様 のマイページ", size=24, bold=True)
    cur += 36
    text(
        d,
        (pad + 8, cur),
        "カレンダーの日付をタップすると、その日の記録を確認できます",
        size=12,
        color=INK_500,
    )
    cur += 28

    # Yellow CTA
    rounded_rect(d, (pad, cur, W - pad, cur + 60), radius=30, fill=ACCENT, outline=ACCENT)
    text(
        d, (W // 2, cur + 30), "＋ 今日の体調を記録する",
        size=20, bold=True, color=INK_900, anchor="mm",
    )
    cur += 60 + 12

    # Black reservation CTA
    rounded_rect(d, (pad, cur, W - pad, cur + 64), radius=32, fill=INK_900, outline=INK_900)
    # Yellow circle icon
    d.ellipse((pad + 14, cur + 14, pad + 50, cur + 50), fill=ACCENT)
    text(d, (pad + 32, cur + 32), "📅", size=16, anchor="mm")
    text(d, (pad + 60, cur + 18), "長泉三島院", size=10, bold=True, color=ACCENT)
    text(d, (pad + 60, cur + 36), "来院予約する", size=14, bold=True, color=WHITE)
    text(d, (W - pad - 16, cur + 32), "↗", size=18, color=INK_300, anchor="rm")
    cur += 64 + 24

    # Section: Calendar
    text(d, (pad, cur), "📅 カレンダー", size=18, bold=True)
    cur += 26
    text(
        d, (pad, cur), "日付をタップで詳細パネルが開きます",
        size=11, color=INK_500,
    )
    cur += 20
    rounded_rect(d, (pad, cur, W - pad, cur + 220), radius=16, fill=WHITE)
    # Mini calendar grid (7×4)
    cal_pad_x = pad + 16
    cal_pad_y = cur + 16
    cell_w = (W - 2 * pad - 32) // 7
    cell_h = 36
    for col, label in enumerate(["日", "月", "火", "水", "木", "金", "土"]):
        text(
            d,
            (cal_pad_x + col * cell_w + cell_w // 2, cal_pad_y),
            label,
            size=10,
            color=INK_400,
            anchor="ma",
        )
    for row in range(4):
        for col in range(7):
            x0 = cal_pad_x + col * cell_w + 4
            y0 = cal_pad_y + 24 + row * (cell_h + 4)
            x1 = x0 + cell_w - 8
            y1 = y0 + cell_h
            day = row * 7 + col + 1
            if day > 28:
                continue
            border = INK_100
            fill = WHITE
            if day == 14:  # today
                border = ACCENT
                fill = ACCENT_50
            elif day in (8, 22):  # has entries
                border = ACCENT_100
                fill = ACCENT_50
            rounded_rect(d, (x0, y0, x1, y1), radius=8, fill=fill, outline=border, width=2 if day == 14 else 1)
            text(d, ((x0 + x1) // 2, (y0 + y1) // 2 - 2), str(day), size=11, bold=(day == 14), anchor="mm")
            # Dots
            if day == 8:
                d.ellipse((x0 + cell_w // 2 - 9, y1 - 8, x0 + cell_w // 2 - 5, y1 - 4), fill=ACCENT)
                d.ellipse((x0 + cell_w // 2 - 2, y1 - 8, x0 + cell_w // 2 + 2, y1 - 4), fill=EMERALD)
            elif day == 22:
                d.ellipse((x0 + cell_w // 2 - 5, y1 - 8, x0 + cell_w // 2 - 1, y1 - 4), fill=EMERALD)
                d.ellipse((x0 + cell_w // 2 + 1, y1 - 8, x0 + cell_w // 2 + 5, y1 - 4), fill=SKY)
    cur += 220 + 22

    # Section: 14 days
    text(d, (pad, cur), "📊 直近14日の体調", size=18, bold=True)
    cur += 26
    rounded_rect(d, (pad, cur, W - pad, cur + 100), radius=16, fill=WHITE)
    for i in range(14):
        x0 = pad + 16 + i * 44
        y0 = cur + 14
        rounded_rect(d, (x0, y0, x0 + 36, y0 + 70), radius=8, fill=ACCENT_50, outline=INK_100, width=1)
        emoji = ["😄", "🙂", "😐", "😟", "😣"][i % 5]
        text(d, (x0 + 18, y0 + 10), str(14 - i + 14) if (14 - i + 14) <= 28 else "", size=8, color=INK_400, anchor="ma")
        text(d, (x0 + 18, y0 + 40), emoji, size=18, anchor="mm")
    cur += 100 + 22

    # Section: pain map placeholder
    text(d, (pad, cur), "🩹 多かった不調", size=18, bold=True)
    cur += 26
    rounded_rect(d, (pad, cur, W - pad, cur + 200), radius=16, fill=WHITE)
    # Tiny body silhouette on the left
    body_x = pad + 36
    body_y = cur + 16
    d.ellipse((body_x, body_y, body_x + 36, body_y + 36), fill=INK_50, outline=INK_300, width=1)
    d.rounded_rectangle((body_x + 4, body_y + 36, body_x + 32, body_y + 130), radius=10, fill=INK_50, outline=INK_300, width=1)
    d.rounded_rectangle((body_x - 14, body_y + 50, body_x + 4, body_y + 130), radius=10, fill=INK_50, outline=INK_300, width=1)
    d.rounded_rectangle((body_x + 32, body_y + 50, body_x + 50, body_y + 130), radius=10, fill=INK_50, outline=INK_300, width=1)
    d.rounded_rectangle((body_x + 4, body_y + 130, body_x + 18, body_y + 180), radius=8, fill=INK_50, outline=INK_300, width=1)
    d.rounded_rectangle((body_x + 18, body_y + 130, body_x + 32, body_y + 180), radius=8, fill=INK_50, outline=INK_300, width=1)
    # Pain markers
    d.ellipse((body_x + 30, body_y + 38, body_x + 50, body_y + 58), fill=ROSE)
    text(d, (body_x + 40, body_y + 48), "7", size=10, bold=True, color=WHITE, anchor="mm")
    d.ellipse((body_x + 8, body_y + 90, body_x + 22, body_y + 104), fill=ROSE_LIGHT)
    text(d, (body_x + 15, body_y + 97), "3", size=8, bold=True, color=WHITE, anchor="mm")

    # Pain ranking on the right
    list_x = body_x + 80
    for i, (label, days) in enumerate([("右肩こり", 7), ("腰", 4), ("左首こり", 3), ("左膝", 2)]):
        ly = cur + 22 + i * 38
        # Bar
        d.rectangle((list_x, ly + 18, list_x + 280, ly + 22), fill=INK_100)
        d.rectangle((list_x, ly + 18, list_x + int(280 * (days / 7)), ly + 22), fill=ROSE)
        text(d, (list_x, ly), f"{i+1}. {label}", size=12, bold=True)
        text(d, (list_x + 280, ly), f"{days}日", size=11, color=INK_500, anchor="ra")
    cur += 200

    img.save(os.path.join(OUT, "mypage-overview.png"), optimize=True)
    return os.path.join(OUT, "mypage-overview.png")


# ----------------------------------------------------------------------
# 2. Calendar tap interaction
# ----------------------------------------------------------------------

def make_calendar_tap() -> str:
    W, H = 800, 460
    img = Image.new("RGB", (W, H), INK_50)
    d = ImageDraw.Draw(img)

    title_y = 20
    text(d, (W // 2, title_y), "カレンダーの日付をタップ → 詳細パネルが下に開く", size=14, bold=True, anchor="ma")

    # Left: calendar
    cal_x, cal_y = 30, 60
    rounded_rect(d, (cal_x, cal_y, cal_x + 320, cal_y + 240), radius=14, fill=WHITE, outline=INK_100)
    for col in range(7):
        text(d, (cal_x + 20 + col * 40, cal_y + 12), "日月火水木金土"[col], size=10, color=INK_400, anchor="ma")
    for row in range(4):
        for col in range(7):
            day = row * 7 + col + 1
            if day > 28:
                continue
            cx = cal_x + 20 + col * 40
            cy = cal_y + 30 + row * 50
            x0, y0 = cx, cy
            x1, y1 = cx + 32, cy + 32
            border = INK_100
            fill = WHITE
            if day == 22:
                border = ACCENT
                fill = ACCENT_100  # selected
            elif day in (8, 14):
                border = ACCENT_100
                fill = ACCENT_50
            rounded_rect(d, (x0, y0, x1, y1), radius=6, fill=fill, outline=border, width=2 if day == 22 else 1)
            text(d, ((x0 + x1) // 2, (y0 + y1) // 2), str(day), size=10, bold=(day == 22), anchor="mm")

    # Arrow
    arrow_x = cal_x + 340
    arrow_y = cal_y + 100
    d.polygon([(arrow_x, arrow_y), (arrow_x + 40, arrow_y + 20), (arrow_x, arrow_y + 40)], fill=ACCENT)

    # Right: detail panel
    panel_x = arrow_x + 60
    panel_y = cal_y
    rounded_rect(d, (panel_x, panel_y, panel_x + 280, panel_y + 240), radius=14, fill=WHITE, outline=ACCENT, width=2)
    rounded_rect(
        d,
        (panel_x, panel_y, panel_x + 280, panel_y + 36),
        radius=14,
        fill=ACCENT_50,
        outline=ACCENT,
        width=2,
    )
    text(d, (panel_x + 16, panel_y + 18), "4/22 (水) の記録", size=13, bold=True, anchor="lm")
    text(d, (panel_x + 264, panel_y + 18), "閉じる", size=10, color=INK_500, anchor="rm")

    inner_y = panel_y + 50
    items = [
        ("🟡 体質診断", "神経過敏タイプ", "詳細を見る ›", ACCENT_50, ACCENT_600),
        ("🟢 体調記録", "😄 良好", "編集 ›", (236, 253, 245), EMERALD),
        ("🔵 来院記録", "✓ 来院済み", "取り消す", (224, 242, 254), SKY),
    ]
    for icon_label, mid_label, action_label, bg, action_color in items:
        rounded_rect(d, (panel_x + 12, inner_y, panel_x + 268, inner_y + 50), radius=10, fill=bg, outline=INK_100, width=1)
        text(d, (panel_x + 22, inner_y + 14), icon_label, size=10, bold=True, color=INK_400)
        text(d, (panel_x + 22, inner_y + 30), mid_label, size=12, bold=True)
        text(d, (panel_x + 256, inner_y + 30), action_label, size=10, bold=True, color=action_color, anchor="rm")
        inner_y += 60

    img.save(os.path.join(OUT, "calendar-tap.png"), optimize=True)
    return os.path.join(OUT, "calendar-tap.png")


# ----------------------------------------------------------------------
# 3. Body record form sections diagram
# ----------------------------------------------------------------------

def make_log_form_sections() -> str:
    W, H = 720, 800
    img = Image.new("RGB", (W, H), INK_50)
    d = ImageDraw.Draw(img)

    sections = [
        ("① 本日の調子", ["😣 絶不調", "😟 不調", "😐 普通", "🙂 好調", "😄 絶好調"]),
        ("② 痛み（部位×左右×強度）", ["首", "肩", "肘", "腰", "膝 ..."]),
        ("③ 神経・自律神経", ["頭痛", "不眠", "イライラ", "倦怠感 ..."]),
        ("④ 睡眠時間（30分刻み）", ["約 6時間", "約 6時間30分", "約 7時間 ..."]),
        ("⑤ 血圧（任意）", ["最高 120 / 最低 80 mmHg"]),
        ("⑥ 一言メモ", ["例: ストレッチで腰痛が和らいだ"]),
    ]
    cur = 30
    for title, items in sections:
        rounded_rect(d, (30, cur, W - 30, cur + 110), radius=14, fill=WHITE, outline=INK_100)
        text(d, (50, cur + 16), title, size=15, bold=True)
        # Tags
        x = 50
        y = cur + 48
        for it in items:
            w = 14 + len(it) * 16
            rounded_rect(d, (x, y, x + w, y + 36), radius=18, fill=ACCENT_50, outline=ACCENT, width=1)
            text(d, (x + w // 2, y + 18), it, size=11, anchor="mm")
            x += w + 8
            if x > W - 80:
                break
        cur += 120

    img.save(os.path.join(OUT, "log-form-sections.png"), optimize=True)
    return os.path.join(OUT, "log-form-sections.png")


# ----------------------------------------------------------------------
# 4. Login flow (QR)
# ----------------------------------------------------------------------

def make_login_flow() -> str:
    W, H = 800, 280
    img = Image.new("RGB", (W, H), INK_50)
    d = ImageDraw.Draw(img)

    text(d, (W // 2, 16), "QRコード経由のログインフロー", size=14, bold=True, anchor="ma")
    steps = [
        ("①", "院でQRカードをもらう", "🦔🟫"),
        ("②", "スマホでQRを読み取る", "📱"),
        ("③", "自動で情報入力済み", "✏️"),
        ("④", "マイページが開く", "🏠"),
    ]
    box_w = 160
    gap = 20
    total = box_w * 4 + gap * 3
    start_x = (W - total) // 2
    cy = 100
    for i, (num, label, icon) in enumerate(steps):
        x0 = start_x + i * (box_w + gap)
        x1 = x0 + box_w
        rounded_rect(d, (x0, cy, x1, cy + 130), radius=14, fill=WHITE, outline=ACCENT, width=2)
        text(d, (x0 + 14, cy + 12), num, size=24, bold=True, color=ACCENT_600)
        text(d, ((x0 + x1) // 2, cy + 60), icon, size=36, anchor="mm")
        text(d, ((x0 + x1) // 2, cy + 105), label, size=11, anchor="mm")
        # Arrow
        if i < 3:
            ax = x1 + 4
            d.polygon([(ax, cy + 60), (ax + 12, cy + 65), (ax, cy + 70)], fill=ACCENT)

    img.save(os.path.join(OUT, "login-flow.png"), optimize=True)
    return os.path.join(OUT, "login-flow.png")


# ----------------------------------------------------------------------
# 5. Pain body diagram (used in manual)
# ----------------------------------------------------------------------

def make_body_diagram() -> str:
    W, H = 360, 600
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)

    cx = W // 2
    # Head
    d.ellipse((cx - 40, 30, cx + 40, 110), fill=INK_50, outline=INK_400, width=2)
    # Neck
    d.rectangle((cx - 14, 110, cx + 14, 130), fill=INK_50, outline=INK_400, width=2)
    # Torso
    d.rounded_rectangle((cx - 60, 130, cx + 60, 360), radius=20, fill=INK_50, outline=INK_400, width=2)
    # Arms
    d.rounded_rectangle((cx - 90, 140, cx - 60, 360), radius=14, fill=INK_50, outline=INK_400, width=2)
    d.rounded_rectangle((cx + 60, 140, cx + 90, 360), radius=14, fill=INK_50, outline=INK_400, width=2)
    # Hands
    d.ellipse((cx - 100, 360, cx - 70, 392), fill=INK_50, outline=INK_400, width=2)
    d.ellipse((cx + 70, 360, cx + 100, 392), fill=INK_50, outline=INK_400, width=2)
    # Legs
    d.rounded_rectangle((cx - 50, 360, cx - 6, 560), radius=14, fill=INK_50, outline=INK_400, width=2)
    d.rounded_rectangle((cx + 6, 360, cx + 50, 560), radius=14, fill=INK_50, outline=INK_400, width=2)

    # Pain markers (exemplary)
    markers = [
        (cx + 50, 145, 18, ROSE, "7"),       # right shoulder
        (cx, 240, 14, ROSE_LIGHT, "3"),      # back (center)
        (cx - 28, 410, 12, ROSE_LIGHT, "2"), # left knee
    ]
    for x, y, r, color, count in markers:
        d.ellipse((x - r, y - r, x + r, y + r), fill=color, outline=WHITE, width=2)
        text(d, (x, y), count, size=11, bold=True, color=WHITE, anchor="mm")

    # Legend
    text(d, (W // 2, 10), "痛みマップ（イメージ）", size=14, bold=True, anchor="ma")

    img.save(os.path.join(OUT, "body-diagram.png"), optimize=True)
    return os.path.join(OUT, "body-diagram.png")


# ----------------------------------------------------------------------
# 6. Admin patient detail layout
# ----------------------------------------------------------------------

def make_admin_patient_layout() -> str:
    W, H = 720, 1100
    img = Image.new("RGB", (W, H), INK_50)
    d = ImageDraw.Draw(img)

    pad = 32
    cur = pad
    # Header (admin)
    rounded_rect(d, (pad, cur, W - pad, cur + 56), radius=12, fill=WHITE, outline=INK_100)
    text(d, (pad + 16, cur + 18), "🦔 リカバリー鍼灸院 ADMIN", size=16, bold=True)
    rounded_rect(d, (pad + 240, cur + 14, pad + 320, cur + 38), radius=12, fill=ACCENT_100, outline=ACCENT, width=1)
    text(d, (pad + 280, cur + 26), "長泉三島院", size=10, bold=True, anchor="mm")
    text(d, (W - pad - 16, cur + 18), "ログアウト", size=11, color=INK_400, anchor="ra")
    cur += 56 + 18

    # Patient card
    rounded_rect(d, (pad, cur, W - pad, cur + 220), radius=14, fill=WHITE, outline=INK_100)
    text(d, (pad + 16, cur + 16), "0001", size=11, bold=True, color=ACCENT_600)
    text(d, (pad + 16, cur + 36), "黒川 様", size=22, bold=True)
    text(d, (W - pad - 16, cur + 36), "編集", size=11, color=INK_500, anchor="rm")
    text(d, (pad + 16, cur + 80), "通院: 長泉三島院 / 生年月日 1999-06-13 / 登録 2026-04-25", size=10, color=INK_500)
    rounded_rect(d, (pad + 16, cur + 110, W - pad - 16, cur + 150), radius=20, fill=ACCENT, outline=ACCENT)
    text(d, (W // 2, cur + 130), "＋ 体質診断を実施", size=14, bold=True, color=INK_900, anchor="mm")
    rounded_rect(d, (pad + 16, cur + 160, W - pad - 16, cur + 200), radius=20, fill=WHITE, outline=SKY, width=2)
    text(d, (W // 2, cur + 180), "📅 来院記録 (12)", size=14, bold=True, color=SKY, anchor="mm")
    cur += 220 + 18

    # QR collapsible
    rounded_rect(d, (pad, cur, W - pad, cur + 50), radius=12, fill=WHITE, outline=INK_100)
    text(d, (pad + 16, cur + 25), "マイページQRコード", size=12, color=INK_500, anchor="lm")
    text(d, (W - pad - 16, cur + 25), "＋", size=18, color=INK_400, anchor="rm")
    cur += 50 + 18

    # 14-day heatmap with analysis CTA
    rounded_rect(d, (pad, cur, W - pad, cur + 230), radius=14, fill=WHITE, outline=INK_100)
    text(d, (pad + 16, cur + 16), "最近 14 日の体調", size=12, bold=True)
    cell_w = (W - 2 * pad - 32) // 14
    for i in range(14):
        x0 = pad + 16 + i * cell_w
        rounded_rect(d, (x0, cur + 40, x0 + cell_w - 4, cur + 110), radius=8, fill=ACCENT_50, outline=INK_100, width=1)
        emoji = ["😄", "🙂", "😐", "😟", "😣"][i % 5]
        text(d, (x0 + (cell_w - 4) // 2, cur + 75), emoji, size=18, anchor="mm")
    # Analysis CTA inside
    rounded_rect(d, (pad + 12, cur + 130, W - pad - 12, cur + 200), radius=12, fill=ACCENT_50, outline=ACCENT, width=2)
    d.ellipse((pad + 28, cur + 150, pad + 60, cur + 182), fill=ACCENT)
    text(d, (pad + 44, cur + 166), "📊", size=14, anchor="mm")
    text(d, (pad + 76, cur + 152), "ANALYSIS", size=10, bold=True, color=ACCENT_600)
    text(d, (pad + 76, cur + 174), "体調を分析する", size=14, bold=True)
    text(d, (W - pad - 24, cur + 166), "›", size=20, color=ACCENT_600, anchor="rm")
    cur += 230 + 18

    # Calendar
    rounded_rect(d, (pad, cur, W - pad, cur + 240), radius=14, fill=WHITE, outline=INK_100)
    text(d, (pad + 16, cur + 16), "診断・記録・来院カレンダー", size=12, bold=True)
    text(d, (pad + 16, cur + 34), "日付をタップで詳細パネルが開きます", size=10, color=INK_500)
    cur += 240

    img.save(os.path.join(OUT, "admin-patient-layout.png"), optimize=True)
    return os.path.join(OUT, "admin-patient-layout.png")


# ----------------------------------------------------------------------
# 7. Permissions matrix table
# ----------------------------------------------------------------------

def make_permissions_diagram() -> str:
    W, H = 720, 360
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)

    text(d, (W // 2, 20), "役割別の権限マトリクス", size=16, bold=True, anchor="ma")

    rows = [
        ("操作", "Master", "1号店スタッフ", "2号店スタッフ"),
        ("両院の患者を見る", "✅", "❌", "❌"),
        ("自院の患者を見る", "✅", "✅", "✅"),
        ("患者の新規登録", "✅", "✅(自院)", "✅(自院)"),
        ("患者の編集", "✅", "✅(自院)", "✅(自院)"),
        ("院間移籍", "✅", "❌", "❌"),
        ("患者の削除", "✅", "❌", "❌"),
        ("体質診断の実施", "✅", "✅(自院)", "✅(自院)"),
        ("分析を見る", "✅", "✅(自院)", "✅(自院)"),
    ]
    col_w = [240, 150, 150, 150]
    start_x = 30
    start_y = 50
    row_h = 32

    for r_idx, row in enumerate(rows):
        cur_x = start_x
        for c_idx, val in enumerate(row):
            x0, y0 = cur_x, start_y + r_idx * row_h
            x1, y1 = cur_x + col_w[c_idx], y0 + row_h
            fill = WHITE
            if r_idx == 0:
                fill = INK_900
            elif r_idx % 2 == 0:
                fill = INK_50
            d.rectangle((x0, y0, x1, y1), fill=fill, outline=INK_300, width=1)
            color = WHITE if r_idx == 0 else (INK_900 if val.startswith("✅") else INK_500)
            if r_idx == 0:
                text(d, ((x0 + x1) // 2, (y0 + y1) // 2), val, size=12, bold=True, color=color, anchor="mm")
            else:
                text(d, ((x0 + x1) // 2, (y0 + y1) // 2), val, size=11, color=color, anchor="mm")
            cur_x += col_w[c_idx]

    img.save(os.path.join(OUT, "permissions-matrix.png"), optimize=True)
    return os.path.join(OUT, "permissions-matrix.png")


if __name__ == "__main__":
    print("Generating illustrations…")
    files = [
        make_mypage_overview(),
        make_calendar_tap(),
        make_log_form_sections(),
        make_login_flow(),
        make_body_diagram(),
        make_admin_patient_layout(),
        make_permissions_diagram(),
    ]
    for f in files:
        print(f"  - {f}")
    print("Done.")
