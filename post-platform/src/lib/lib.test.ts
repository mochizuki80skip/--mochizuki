import { test } from "node:test";
import assert from "node:assert/strict";
import { fillTemplate, placeholders } from "./template";
import { parseCsv, toCsv, decodeCsv } from "./csv";
import { checkText } from "./compliance";
import { jstDate, jstParts } from "./themes";

const store = { name: "もちづき接骨院", city: "静岡市葵区", area: "静岡駅北口", features: "", bookingUrl: "", vars: { 院長: "望月" } };

test("テンプレート差し込み", () => {
  const r = fillTemplate("【{エリア}】{地名}の{院名}です。院長の｛院長｝がお待ちしています。{店舗名}", store);
  assert.equal(r.text, "【静岡駅北口】静岡市葵区のもちづき接骨院です。院長の望月がお待ちしています。もちづき接骨院");
  assert.deepEqual(r.missing, []);
});

test("空の項目は missing として残す", () => {
  const r = fillTemplate("{院名}の特徴：{特徴} {駐車場}", store);
  assert.deepEqual(r.missing, ["特徴", "駐車場"]);
  assert.match(r.text, /\{特徴\}/);
  assert.deepEqual(placeholders("{院名}{地名}{院名}{店名}"), ["院名", "地名"]);
});

test("CSV の往復（カンマ・改行・引用符）", () => {
  const rows = [["院名", "特徴"], ["A,院", '改行\nと"引用"']];
  const text = decodeCsv(new TextEncoder().encode(toCsv(rows)));
  assert.deepEqual(parseCsv(text), rows);
});

test("Shift_JIS の CSV も読める", () => {
  // "院名,地名\r\n" を Shift_JIS で
  const sjis = Uint8Array.from([0x89, 0x40, 0x96, 0xbc, 0x2c, 0x92, 0x6e, 0x96, 0xbc, 0x0d, 0x0a]);
  assert.deepEqual(parseCsv(decodeCsv(sjis)), [["院名", "地名"]]);
});

test("表現チェック", () => {
  assert.ok(checkText("必ず治ります", "gbp").some((f) => f.level === "error"));
  assert.ok(checkText("03-1234-5678", "gbp").length === 1);
  assert.equal(checkText("03-1234-5678", "instagram").length, 0);
  assert.deepEqual(checkText("朝晩の冷え込みで寝違えが増える時期です。", "gbp"), []);
});

test("JST の日時", () => {
  const d = jstDate(2026, 10, 12, "10:00");
  assert.equal(d.toISOString(), "2026-10-12T01:00:00.000Z");
  assert.deepEqual(jstParts(new Date("2026-10-11T16:00:00Z")), { year: 2026, month: 10, day: 12, weekday: 1 });
});
