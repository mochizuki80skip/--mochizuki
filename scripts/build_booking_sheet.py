# -*- coding: utf-8 -*-
"""
ONE'S BODY 静岡安倍川店 オープン前体験会 予約表 生成スクリプト
- 3日分（8/28・29・30）を別タブで作成
- ルームA〜Dを横並び
- 担当者はドロップダウン
- 「対応可」チェック（✅の付け外しで受付可否・ブロックを管理）
- 「来店」チェック（当日ご来店の実績）
"""
from datetime import date
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter

# ---- 設定値（自由に編集できます） ----
STAFF = ["", "担当A", "担当B", "担当C", "担当D", "担当E"]          # 担当者リスト
CHANNELS = ["Instagram", "Googleマップ", "チラシ", "紹介", "HP", "既存会員", "その他"]  # 集客経路
ROOMS = ["A", "B", "C", "D"]
DATES = [date(2026, 8, 28), date(2026, 8, 29), date(2026, 8, 30)]
WD = ["月", "火", "水", "木", "金", "土", "日"]

# 各ルームの列（対応可 / 氏名 / 連絡先 / 集客経路 / 来店）
ROOM_COLS = ["対応可", "氏名", "連絡先", "集客経路", "来店"]

# 時間枠 9:00〜18:00 の30分刻み（開始時刻ベース、計18枠）
def time_slots():
    slots = []
    h, m = 9, 0
    while (h, m) < (18, 0):
        nh, nm = (h, m + 30) if m == 0 else (h + 1, 0)
        slots.append(f"{h:02d}:{m:02d}〜{nh:02d}:{nm:02d}")
        h, m = nh, nm
    return slots

SLOTS = time_slots()

# ---- スタイル ----
thin = Side(style="thin", color="B7B7B7")
med = Side(style="medium", color="666666")
border_thin = Border(left=thin, right=thin, top=thin, bottom=thin)
border_room = Border(left=med, right=med, top=thin, bottom=thin)

TITLE_FILL = PatternFill("solid", fgColor="1F3864")
ROOM_FILLS = {  # ルームごとに淡い色分け
    "A": "DEEBF7",
    "B": "E2EFDA",
    "C": "FFF2CC",
    "D": "FCE4D6",
}
SUBHEAD_FILL = PatternFill("solid", fgColor="D9D9D9")
TIME_FILL = PatternFill("solid", fgColor="F2F2F2")
STAFF_FILL = PatternFill("solid", fgColor="FFFFFF")

C = Alignment(horizontal="center", vertical="center", wrap_text=True)
L = Alignment(horizontal="left", vertical="center", wrap_text=True)


def build_settings(wb):
    ws = wb.create_sheet("設定")
    ws["A1"] = "担当者リスト"
    ws["A1"].font = Font(bold=True)
    for i, s in enumerate(STAFF, start=2):
        ws.cell(row=i, column=1, value=s)
    ws["C1"] = "集客経路リスト"
    ws["C1"].font = Font(bold=True)
    for i, s in enumerate(CHANNELS, start=2):
        ws.cell(row=i, column=3, value=s)
    ws["E1"] = "チェック"
    ws["E1"].font = Font(bold=True)
    ws["E2"] = "✅"
    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["E"].width = 8
    ws.sheet_properties.tabColor = "808080"
    return ws


def build_day(wb, d):
    title = f"{d.month}月{d.day}日（{WD[d.weekday()]}）"
    ws = wb.create_sheet(title)

    # 列レイアウト: A=時間, 各ルーム5列
    total_cols = 1 + len(ROOMS) * len(ROOM_COLS)  # 1 + 20 = 21
    last_col = get_column_letter(total_cols)

    # 行構成
    # 1: タイトル
    # 2: ルーム名（5列マージ）
    # 3: 担当者ラベル+ドロップダウン
    # 4: サブ見出し
    # 5〜: 時間枠
    R_TITLE, R_ROOM, R_STAFF, R_SUB, R_START = 1, 2, 3, 4, 5

    # タイトル
    ws.merge_cells(f"A{R_TITLE}:{last_col}{R_TITLE}")
    t = ws.cell(row=R_TITLE, column=1,
                value=f"ONE'S BODY 静岡安倍川店　オープン前体験会　予約表　　{d.year}/{title}")
    t.fill = TITLE_FILL
    t.font = Font(bold=True, size=14, color="FFFFFF")
    t.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[R_TITLE].height = 30

    # A列見出し（時間）
    ws.merge_cells(f"A{R_ROOM}:A{R_SUB}")
    a = ws.cell(row=R_ROOM, column=1, value="時間")
    a.fill = SUBHEAD_FILL
    a.font = Font(bold=True)
    a.alignment = C
    a.border = border_room
    ws.column_dimensions["A"].width = 14

    dv_staff = DataValidation(type="list", formula1="=設定!$A$2:$A$7", allow_blank=True)
    dv_channel = DataValidation(type="list", formula1="=設定!$C$2:$C$8", allow_blank=True)
    dv_check = DataValidation(type="list", formula1='"✅"', allow_blank=True)
    ws.add_data_validation(dv_staff)
    ws.add_data_validation(dv_channel)
    ws.add_data_validation(dv_check)

    for ri, room in enumerate(ROOMS):
        c0 = 2 + ri * len(ROOM_COLS)          # ルーム先頭列(1-based)
        c0L = get_column_letter(c0)
        c1L = get_column_letter(c0 + len(ROOM_COLS) - 1)
        fill = PatternFill("solid", fgColor=ROOM_FILLS[room])

        # ルーム名
        ws.merge_cells(f"{c0L}{R_ROOM}:{c1L}{R_ROOM}")
        rc = ws.cell(row=R_ROOM, column=c0, value=f"ルーム {room}")
        rc.fill = fill
        rc.font = Font(bold=True, size=12)
        rc.alignment = C

        # 担当者（ラベル1列 + ドロップダウン4列マージ）
        lc = ws.cell(row=R_STAFF, column=c0, value="担当者")
        lc.fill = fill
        lc.font = Font(bold=True)
        lc.alignment = C
        ws.merge_cells(f"{get_column_letter(c0+1)}{R_STAFF}:{c1L}{R_STAFF}")
        sc = ws.cell(row=R_STAFF, column=c0 + 1)
        sc.fill = STAFF_FILL
        sc.alignment = C
        dv_staff.add(sc)

        # サブ見出し
        for ci, name in enumerate(ROOM_COLS):
            cell = ws.cell(row=R_SUB, column=c0 + ci, value=name)
            cell.fill = SUBHEAD_FILL
            cell.font = Font(bold=True)
            cell.alignment = C

        # 罫線（ヘッダ部）
        for r in range(R_ROOM, R_SUB + 1):
            for cc in range(c0, c0 + len(ROOM_COLS)):
                ws.cell(row=r, column=cc).border = border_room

        # 列幅
        widths = [7, 12, 16, 12, 6]
        for ci, w in enumerate(widths):
            ws.column_dimensions[get_column_letter(c0 + ci)].width = w

    # 時間行
    for si, slot in enumerate(SLOTS):
        r = R_START + si
        ws.row_dimensions[r].height = 24
        tcell = ws.cell(row=r, column=1, value=slot)
        tcell.fill = TIME_FILL
        tcell.font = Font(bold=True, size=9)
        tcell.alignment = C
        tcell.border = border_thin
        for ri in range(len(ROOMS)):
            c0 = 2 + ri * len(ROOM_COLS)
            for ci in range(len(ROOM_COLS)):
                cell = ws.cell(row=r, column=c0 + ci)
                cell.border = border_thin
                cell.alignment = C if ROOM_COLS[ci] in ("対応可", "来店") else L
            # 対応可・来店 にチェック用DV
            dv_check.add(ws.cell(row=r, column=c0))                      # 対応可
            dv_channel.add(ws.cell(row=r, column=c0 + 3))               # 集客経路
            dv_check.add(ws.cell(row=r, column=c0 + 4))                 # 来店

        # ルーム境界を強調
        for ri in range(len(ROOMS)):
            c0 = 2 + ri * len(ROOM_COLS)
            left = ws.cell(row=r, column=c0)
            left.border = Border(left=med, right=thin, top=thin, bottom=thin)
            right = ws.cell(row=r, column=c0 + len(ROOM_COLS) - 1)
            right.border = Border(left=thin, right=med, top=thin, bottom=thin)

    # 条件付き書式：対応可=✅ を緑、来店=✅ を青
    last_row = R_START + len(SLOTS) - 1
    green = PatternFill("solid", fgColor="C6EFCE")
    blue = PatternFill("solid", fgColor="BDD7EE")
    for ri in range(len(ROOMS)):
        c0 = 2 + ri * len(ROOM_COLS)
        ok = get_column_letter(c0)
        visit = get_column_letter(c0 + 4)
        rng_ok = f"{ok}{R_START}:{ok}{last_row}"
        rng_v = f"{visit}{R_START}:{visit}{last_row}"
        ws.conditional_formatting.add(
            rng_ok, FormulaRule(formula=[f'{ok}{R_START}="✅"'], fill=green))
        ws.conditional_formatting.add(
            rng_v, FormulaRule(formula=[f'{visit}{R_START}="✅"'], fill=blue))

    # 凡例
    lr = last_row + 2
    ws.cell(row=lr, column=1,
            value="【使い方】対応可=✅で受付OK（担当不在・休憩・ブロックは✅を外す）／来店=当日ご来店で✅／担当者・集客経路はドロップダウン選択")
    ws.merge_cells(start_row=lr, start_column=1, end_row=lr, end_column=total_cols)
    ws.cell(row=lr, column=1).font = Font(size=9, color="666666")
    ws.cell(row=lr, column=1).alignment = L

    ws.freeze_panes = "B5"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = "1F3864"
    return ws


def main():
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for d in DATES:
        build_day(wb, d)
    build_settings(wb)
    out = "/home/user/--mochizuki/ONE'S BODY静岡安倍川店_体験会予約表.xlsx"
    wb.save(out)
    print("saved:", out)


if __name__ == "__main__":
    main()
