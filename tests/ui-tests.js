#!/usr/bin/env node
/* ui-tests — the Oracle page in a real DOM (jsdom).
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The engine has its own suite. This one proves the page is wired to it: the compliment
 * refuses without a detail and then carries the detail verbatim; keeping it writes to the
 * device; the photo path reads pixels (through a stubbed canvas — jsdom has none), shows
 * what it measured, labels the myth invented, and refuses when a face detector says there
 * is no face; and a corrupt kept list is reported instead of replaced.
 *
 *   npm install --no-save jsdom && node tests/ui-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var { JSDOM } = require("jsdom");

var ROOT = path.join(__dirname, "..");
var PLAY = path.join(ROOT, "docs", "play");
var PAGE = path.join(PLAY, "index.html");

var passed = 0;
var failed = [];
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 30); }); }

/* jsdom has no canvas and no image decoding, so the page's own reading path is fed a
   stub context with a synthetic warm gradient. The engine's real analysis is covered in
   tests/self-tests.js against real pixel arrays. */
function stubCanvas(w) {
  w.HTMLCanvasElement.prototype.getContext = function () {
    return {
      drawImage: function () {},
      getImageData: function (x, y, cw, ch) {
        var data = new Uint8ClampedArray(cw * ch * 4);
        for (var j = 0; j < ch; j++) {
          for (var i = 0; i < cw; i++) {
            var k = (j * cw + i) * 4;
            var l = 1 - i / cw;
            data[k] = 40 + 200 * l;
            data[k + 1] = 30 + 150 * l;
            data[k + 2] = 20 + 80 * l;
            data[k + 3] = 255;
          }
        }
        return { data: data, width: cw, height: ch };
      }
    };
  };
}

function build(seed) {
  var html = fs.readFileSync(PAGE, "utf8");
  var dom = new JSDOM(html, { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  stubCanvas(w);
  w.URL.createObjectURL = function () { return "blob:photo"; };
  w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "oracle-core.js", "app.js"].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(PLAY, f), "utf8"));
  });
  return dom;
}

(async function () {
  var dom = build(null);
  var w = dom.window;
  var d = w.document;
  var $ = function (id) { return d.getElementById(id); };

  ok("the engine loaded into the page", !!w.OracleCore);

  /* ---------------------------------------------------------- compliment */

  $("cName").value = "Asha";
  $("cDetail").value = "";
  $("cBuild").click();
  ok("no detail is refused on the page", /no detail about Asha/.test($("status").textContent), $("status").textContent);
  eq("and no compliment card is shown", $("cOutCard").hidden, true);

  $("cName").value = "";
  $("cDetail").value = "you remembered how I take my tea";
  $("cBuild").click();
  ok("a blank name is refused on the page", /blank name is refused/.test($("status").textContent), $("status").textContent);

  $("cName").value = "Asha";
  $("cDetail").value = "you rewrote the whole rota so Ravi could sit his exam";
  $("cBuild").click();
  eq("a compliment is shown", $("cOutCard").hidden, false);
  ok("it carries the detail verbatim", $("cOut").textContent.indexOf("you rewrote the whole rota so Ravi could sit his exam") >= 0,
    $("cOut").textContent);
  ok("it says what it was built from", /Built from the detail/.test($("cMeta").textContent), $("cMeta").textContent);
  eq("the keep button appears only after a compliment exists", $("cKeep").hidden, false);

  $("cKeep").click();
  ok("keeping it says it was kept", /Kept on this device/.test($("status").textContent), $("status").textContent);
  eq("the kept list has one item", d.querySelectorAll("#keptList li").length, 1);
  ok("it was written to the device", !!w.localStorage.getItem("oracle:kept"));

  $("exportKept").click();
  ok("the export names the file it wrote", /Wrote oracle-kept-\d{4}-\d\d-\d\d\.md/.test($("keptNote").textContent),
    $("keptNote").textContent);

  w.URL.createObjectURL = function () { throw new Error("storage is full"); };
  $("exportKept").click();
  ok("a failed export says the file was not written", /not written/.test($("status").textContent), $("status").textContent);
  w.URL.createObjectURL = function () { return "blob:photo"; };

  /* ------------------------------------------------------------ portrait */

  $("tab-portrait").click();
  eq("the portrait panel shows", $("panel-portrait").hidden, false);

  var file = new w.File([new w.Blob(["not really a png"], { type: "image/png" })], "photo.png", { type: "image/png" });
  var drop = new w.Event("drop", { bubbles: true });
  Object.defineProperty(drop, "dataTransfer", { value: { files: [file] } });
  $("drop").dispatchEvent(drop);

  Object.defineProperty($("preview"), "naturalWidth", { value: 640, configurable: true });
  Object.defineProperty($("preview"), "naturalHeight", { value: 480, configurable: true });
  $("preview").dispatchEvent(new w.Event("load"));
  eq("the photo can be read", $("pBuild").hidden, false);
  ok("the page says the photo is in memory only", /in memory only, never stored/.test($("pNote").textContent), $("pNote").textContent);

  $("pBuild").click();
  await tick(60);

  eq("what was measured is shown", $("readCard").hidden, false);
  ok("the reading lists brightness and contrast", /Brightness/.test(d.querySelector("#readTable tbody").textContent) && /Contrast/.test(d.querySelector("#readTable tbody").textContent),
    d.querySelector("#readTable tbody").textContent);
  eq("a myth is shown", $("pOutCard").hidden, false);
  ok("the myth says it was invented", /This is invented/.test($("pMeta").textContent), $("pMeta").textContent);
  ok("the myth quotes a measured value", /the most common colour is #|contrast sits at|average luminance/.test($("pOut").textContent),
    $("pOut").textContent);
  ok("the page never claims to know anything about the person",
    w.OracleCore.claimsAboutPerson($("pOut").textContent).length === 0);
  ok("it says this browser has no face detector rather than pretending", /no face detector/.test($("status").textContent),
    $("status").textContent);
  eq("the myth can be kept", $("pKeep").hidden, false);

  $("pKeep").click();
  eq("keeping a myth adds it to the list", d.querySelectorAll("#keptList li").length, 2);
  ok("the kept item is tagged a myth", /myth/.test($("keptList").textContent), $("keptList").textContent);

  $("pClear").click();
  eq("removing the photo hides the myth", $("pOutCard").hidden, true);
  ok("the page says the photo was never stored", /never stored/.test($("pNote").textContent), $("pNote").textContent);

  /* ------------------------------- a detector that finds no face refuses */

  var dom2 = build(null);
  var w2 = dom2.window;
  var d2 = w2.document;
  w2.FaceDetector = function () {
    return { detect: function () { return Promise.resolve([]); } };
  };
  var f2 = new w2.File([new w2.Blob(["x"], { type: "image/png" })], "noface.png", { type: "image/png" });
  var drop2 = new w2.Event("drop", { bubbles: true });
  Object.defineProperty(drop2, "dataTransfer", { value: { files: [f2] } });
  d2.getElementById("drop").dispatchEvent(drop2);
  Object.defineProperty(d2.getElementById("preview"), "naturalWidth", { value: 400, configurable: true });
  Object.defineProperty(d2.getElementById("preview"), "naturalHeight", { value: 400, configurable: true });
  d2.getElementById("preview").dispatchEvent(new w2.Event("load"));
  d2.getElementById("pBuild").click();
  await tick(60);
  ok("a photo with no face is refused on the page", /No face was found/.test(d2.getElementById("status").textContent),
    d2.getElementById("status").textContent);
  eq("and no myth is shown", d2.getElementById("pOutCard").hidden, true);
  ok("the photo stays on screen for that refusal", d2.getElementById("preview").style.display === "block");

  /* --------------------------------------- a corrupt kept list on reload */

  var dom3 = build({ "oracle:kept": "{ broken kept" });
  var d3 = dom3.window.document;
  ok("a corrupt kept list is reported on load", /not readable JSON/.test(d3.getElementById("status").textContent),
    d3.getElementById("status").textContent);
  ok("it offers an export of the unreadable list",
    Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Export the unreadable list/.test(b.textContent); }));
  ok("and a deliberate clear, not a silent one",
    Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Clear it and start a new list/.test(b.textContent); }));
  eq("nothing is shown as kept from a corrupt list", d3.querySelectorAll("#keptList li").length, 0);

  var total = passed + failed.length;
  if (!total) { console.error("ui-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
  if (failed.length) {
    console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
    failed.forEach(function (f) { console.error("  FAIL " + f); });
    process.exit(1);
  }
  console.log("ui-tests: " + passed + "/" + total + " assertions passed");
  dom.window.close(); dom2.window.close(); dom3.window.close();
})();
