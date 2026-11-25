#!/usr/bin/env node
/* self-tests — Oracle. No framework, no dependencies.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The Compliment spec's "done means" is countable, so it is counted here:
 *
 *   "A compliment built from a supplied detail contains that detail verbatim ... and the
 *    app refuses to generate one when no detail is supplied. 5 different details produce
 *    5 compliments, each containing its own detail and no other's. The compliment makes
 *    no claim about the person beyond the detail that was given."
 *
 * The Portrait Oracle's must-nots are here too: never identify, never infer, always say
 * the myth was invented, never keep the photo.
 *
 *   node tests/self-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var O = require(path.join(ROOT, "docs", "play", "oracle-core.js"));

var passed = 0;
var failed = [];
var group = "";

function section(n) { group = n; }
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(group + " :: " + name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

/* A synthetic image: a warm gradient, light from the left. */
function synth(w, h, fn) {
  var px = new Uint8ClampedArray(w * h * 4);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      var c = fn(x, y, w, h);
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
  }
  return px;
}

var WARM_LEFT = synth(64, 64, function (x, y, w) { var l = 1 - x / w; return [40 + 200 * l, 30 + 150 * l, 20 + 80 * l]; });
var COOL_CENTRE = synth(64, 64, function (x, y, w, h) {
  var dx = (x - w / 2) / w, dy = (y - h / 2) / h;
  var d = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.4);
  return [30 + 60 * d, 50 + 120 * d, 110 + 120 * d];
});
var FLAT = synth(32, 32, function () { return [120, 120, 120]; });

/* ================================================== the compliment's done means */

section("done means — a compliment carries the detail verbatim");
var DETAILS = [
  "you walked my mother to the bus stop in the rain",
  "you remembered how I take my tea",
  "you rewrote the whole rota so Ravi could sit his exam",
  "you kept the plant alive through the whole summer",
  "you send the meeting notes before anyone asks"
];
var built = DETAILS.map(function (d) { return O.buildCompliment({ name: "Asha", detail: d }); });

ok("every detail produces a compliment", built.every(function (b) { return b.ok; }));
eq("five details produce five compliments", built.length, 5);
eq("no two compliments are the same text", new Set(built.map(function (b) { return b.text; })).size, 5);
built.forEach(function (b, i) {
  ok("compliment " + (i + 1) + " contains its own detail verbatim", b.text.indexOf(DETAILS[i]) >= 0, b.text);
  ok("compliment " + (i + 1) + " contains no other detail",
    DETAILS.filter(function (_, j) { return j !== i; }).every(function (other) { return b.text.indexOf(other) < 0; }));
  ok("compliment " + (i + 1) + " is reported as containing the detail", b.containsDetailVerbatim === true);
});

section("done means — no detail, no compliment");
var noDetail = O.buildCompliment({ name: "Asha" });
eq("a missing detail is refused", noDetail.ok, false);
eq("and it asks for a detail", noDetail.needs, "detail");
ok("the refusal asks for one rather than offering a generic compliment",
  /give it one real thing/.test(noDetail.reason), noDetail.reason);
eq("a blank name is refused", O.buildCompliment({ detail: "you remembered my tea" }).ok, false);
eq("a blank name says so", O.buildCompliment({ detail: "x" }).needs, "name");
eq("a two-character detail is not a detail", O.buildCompliment({ name: "A", detail: "ok" }).ok, false);
eq("a whitespace-only detail is refused", O.buildCompliment({ name: "A", detail: "   " }).ok, false);

section("done means — the compliment makes no claim beyond the detail");
built.forEach(function (b, i) {
  eq("compliment " + (i + 1) + " uses no flattery word", b.flatteryWords.length, 0);
});
var framingText = O.FRAMING.map(function (f) { return f("X", "DETAIL"); }).join(" ").toLowerCase();
O.PRAISE.forEach(function (w) {
  ok("the framing never contains the praise word \u201c" + w + "\u201d", framingText.indexOf(w) < 0);
});
ok("the framing is built around the detail, not around an adjective",
  O.FRAMING.every(function (f) { return f("X", "DETAIL").indexOf("DETAIL") >= 0; }));

/* ================================================== the portrait's must-nots */

section("must-not — it must not identify the person or infer anything about them");
var analysis = O.analysePixels(WARM_LEFT, 64, 64);
eq("a real image is analysed", analysis.ok, true);
var myth = O.buildMyth(analysis, O.oracleGate({ detectorAvailable: false }));
eq("a myth is produced from image properties", myth.ok, true);
eq("the myth claims nothing about a person", O.claimsAboutPerson(myth.text).length, 0);
ok("the myth says it was invented", myth.invented === true && /invented/i.test(myth.says), myth.says);
ok("the myth quotes measured properties verbatim", myth.quotedMeasured.length >= 2, myth.quotedMeasured.length);
ok("every quoted property is one the analyser actually measured",
  myth.quotedMeasured.every(function (q) { return analysis.measured.indexOf(q) >= 0; }));

var core = read("docs/play/oracle-core.js");
ok("must_not_identify: no age, gender or ethnicity inference exists in the engine",
  !/\b(age|gender|sex|ethnicity|caste|religion)\s*[:=]/i.test(core));
ok("must_not_identify: no mood or emotion field exists in the engine",
  !/\b(mood|emotion|sentiment)\s*[:=]/i.test(core));
ok("must_not_identify: the page states the promise", /will not tell you who is in the photo/.test(read("docs/play/index.html")));

section("must-not — the photo is never kept");
var appSrc = read("docs/play/app.js");
ok("must_not_keep_photo: no data URL is written to storage", !/toDataURL|readAsDataURL/.test(appSrc));
ok("must_not_keep_photo: the stored list holds text only", !/photo|image|dataUrl/.test(O.serializeKept([{ id: "k1", kind: "compliment", text: "t" }])));
ok("must_not_keep_photo: the object URL is revoked", /revokeObjectURL/.test(appSrc));
ok("must_not_keep_photo: the canvas is dropped after reading", /canvas\.width = 0/.test(appSrc));

section("must-not — no myth from a photo it could not read");
var refused = O.oracleGate({ detectorAvailable: true, faceFound: false });
eq("a photo with no face is refused", refused.ok, false);
ok("the refusal says no myth was invented", /no myth was invented/i.test(refused.reason), refused.reason);
eq("and the engine will not build one anyway", O.buildMyth(analysis, refused).ok, false);
var noDetector = O.oracleGate({ detectorAvailable: false, faceFound: false });
eq("a browser with no detector is not a refusal", noDetector.ok, true);
eq("it names the mode honestly", noDetector.mode, "image-only");
ok("it will not claim to have seen a person", /will not claim to have seen a person/i.test(noDetector.says), noDetector.says);
var confirmed = O.oracleGate({ detectorAvailable: true, faceFound: true });
ok("a confirmed face still reads only colour and light", /never the person/i.test(confirmed.says), confirmed.says);

section("must-not — a corrupt kept list is never silently replaced");
var bad = O.parseKept("{ broken list");
eq("a corrupt list is reported", bad.ok, false);
ok("the reason promises it was not replaced", /not been replaced/.test(bad.reason), bad.reason);
eq("the raw text is kept for export", bad.raw, "{ broken list");
eq("an empty list is reported, not guessed at", O.parseKept("").ok, false);
var goodRound = O.parseKept(O.serializeKept([{ id: "k1", kind: "compliment", text: "hello", detail: "d", at: "25/11/2026" }]));
eq("a good list round-trips", goodRound.ok && goodRound.kept.length, 1);

/* ================================================ the other mechanics */

section("mechanic — the image reading is measured, not guessed");
eq("brightness is a number between 0 and 255", analysis.brightness >= 0 && analysis.brightness <= 255, true);
eq("a flat image has almost no contrast", O.analysePixels(FLAT, 32, 32).contrast <= 2, true);
ok("a warm image reads warm", O.analysePixels(WARM_LEFT, 64, 64).tone === "warm", O.analysePixels(WARM_LEFT, 64, 64).tone);
ok("a cool image reads cool", O.analysePixels(COOL_CENTRE, 64, 64).tone === "cool", O.analysePixels(COOL_CENTRE, 64, 64).tone);
eq("the light side is found, not assumed", O.analysePixels(WARM_LEFT, 64, 64).lightFrom, "left");
ok("a palette is returned with shares", analysis.palette.length === 3 && analysis.palette[0].share > 0);
eq("a too-small image is refused", O.analysePixels(new Uint8ClampedArray(8), 2, 2).ok, false);
eq("no pixels is refused", O.analysePixels(null, 0, 0).ok, false);

section("mechanic — two different photos give two different myths");
var m1 = O.buildMyth(O.analysePixels(WARM_LEFT, 64, 64), O.oracleGate({ detectorAvailable: false }));
var m2 = O.buildMyth(O.analysePixels(COOL_CENTRE, 64, 64), O.oracleGate({ detectorAvailable: false }));
ok("the myths differ", m1.text !== m2.text);
var a1 = O.analysePixels(WARM_LEFT, 64, 64);
var a2 = O.analysePixels(COOL_CENTRE, 64, 64);
ok("each myth quotes at least two of its own photo's measured values",
  m1.quotedMeasured.length >= 2 && m2.quotedMeasured.length >= 2);
ok("every value a myth quotes is one its own photo produced",
  m1.quotedMeasured.every(function (q) { return a1.measured.indexOf(q) >= 0; }) &&
  m2.quotedMeasured.every(function (q) { return a2.measured.indexOf(q) >= 0; }));
ok("the two photos do not produce the same numbers",
  JSON.stringify(a1.measured) !== JSON.stringify(a2.measured));

section("failure case — storage full or unavailable");
var thrown = O.exportFile("kept", { kept: [{ kind: "compliment", text: "t" }] }, { when: "25/11/2026" }, function () {
  var e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
});
eq("a failed write is reported as failed", thrown.ok, false);
ok("a failed write says the file was not written", /not written/.test(thrown.reason), thrown.reason);
ok("a failed write names the cause", /storage is full/.test(thrown.reason));
eq("no writer means no file", O.exportFile("kept", { kept: [] }, {}, null).ok, false);

section("failure case — no network");
["docs/play/oracle-core.js", "docs/play/app.js", "docs/play/sw.js", "docs/play/web-kit.js", "docs/play/export-kit.js"].forEach(function (f) {
  var src = read(f);
  ok("no fetch call in " + f, !/\bfetch\s*\(/.test(src));
  ok("no XHR/WebSocket/beacon in " + f, !/XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(src));
});
ok("the page forbids connections in its CSP", /connect-src 'none'/.test(read("docs/play/index.html")));

section("export — what was kept, and what it was built from");
var md = O.keptMarkdown([{ kind: "compliment", text: "You remembered my tea.", detail: "you remembered how I take my tea", at: "25/11/2026" }], "25/11/2026");
ok("the export carries the text", /You remembered my tea/.test(md));
ok("the export names the detail it was built from", /Built from the detail: you remembered how I take my tea/.test(md));
ok("an empty export says nothing was kept", /Nothing was kept/.test(O.keptMarkdown([], "")));

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (s) {
  ok("script src resolves: " + s, fs.existsSync(path.join(ROOT, "docs", "play", s.replace(/^\.\//, ""))));
});
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));

/* ============================================================== summary */

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("self-tests: " + passed + "/" + total + " assertions passed");
