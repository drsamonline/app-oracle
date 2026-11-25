/* app — the Oracle page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * Wiring only: the compliment, the image reading, the gate and the myth live in
 * oracle-core.js, which the tests exercise directly.
 *
 * Two promises this file has to keep on its own, because they are about the page and
 * not the engine:
 *   - the photo is read into a canvas and never stored: no data URL goes into storage,
 *     and the object URL is revoked when the photo is removed;
 *   - nothing about a person is ever rendered: the myth is checked against the core's
 *     own forbidden-claims list before it is shown.
 */
(function () {
  "use strict";

  var O = window.OracleCore;
  var $ = function (id) { return document.getElementById(id); };

  var K_KEPT = "oracle:kept";
  var MAX_SAMPLE = 96;

  var els = {
    status: $("status"),
    cName: $("cName"), cDetail: $("cDetail"), cBuild: $("cBuild"), cKeep: $("cKeep"),
    cOutCard: $("cOutCard"), cOut: $("cOut"), cMeta: $("cMeta"),
    keptList: $("keptList"), keptCount: $("keptCount"), keptNote: $("keptNote"),
    exportKept: $("exportKept"), clearKept: $("clearKept"),
    file: $("file"), drop: $("drop"), preview: $("preview"),
    pBuild: $("pBuild"), pKeep: $("pKeep"), pClear: $("pClear"), pNote: $("pNote"),
    readCard: $("readCard"), readBody: $("readTable").querySelector("tbody"),
    pOutCard: $("pOutCard"), pOut: $("pOut"), pMeta: $("pMeta")
  };

  var state = { kept: [], compliment: null, myth: null, photoUrl: "", analysis: null };

  /* ------------------------------------------------------------- helpers */

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function setStatus(kind, msg) {
    els.status.className = "status show " + kind;
    els.status.textContent = msg;
  }
  function clearStatus() { els.status.className = "status"; els.status.textContent = ""; }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function store(key, value) {
    try { window.localStorage.setItem(key, value); return { ok: true }; }
    catch (e) { return { ok: false, reason: e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable" }; }
  }
  function load(key) {
    try { return { ok: true, value: window.localStorage.getItem(key) }; }
    catch (e) { return { ok: false, value: null }; }
  }
  function drop(key) { try { window.localStorage.removeItem(key); return true; } catch (e) { return false; } }

  /* ------------------------------------------------------------ the kept */

  function renderKept() {
    els.keptList.textContent = "";
    els.keptCount.textContent = state.kept.length ? "· " + state.kept.length + " kept" : "· nothing kept yet";
    state.kept.slice().reverse().forEach(function (k) {
      var li = node("li");
      li.appendChild(node("span", "tag", (k.kind === "myth" ? "myth" : "compliment") + (k.at ? " · " + k.at : "")));
      li.appendChild(document.createTextNode(k.text));
      els.keptList.appendChild(li);
    });
  }

  function keep(item) {
    state.kept.push(item);
    var saved = store(K_KEPT, O.serializeKept(state.kept));
    renderKept();
    if (!saved.ok) {
      setStatus("warn", "It was generated and is on screen, but it was not kept: " + saved.reason + ".");
      return false;
    }
    setStatus("ok", "Kept on this device. " + state.kept.length + " item(s) in the list.");
    return true;
  }

  /* --------------------------------------------------------- compliment */

  function buildCompliment() {
    clearStatus();
    var out = O.buildCompliment({ name: els.cName.value, detail: els.cDetail.value });
    if (!out.ok) {
      els.cOutCard.hidden = true;
      els.cKeep.hidden = true;
      state.compliment = null;
      setStatus("bad", out.reason);
      if (out.needs === "detail") els.cDetail.focus();
      else if (out.needs === "name") els.cName.focus();
      return;
    }
    state.compliment = out;
    els.cOutCard.hidden = false;
    els.cOut.textContent = out.text;
    els.cMeta.textContent = "Built from the detail: \u201c" + out.detail + "\u201d \u2014 " + out.claim;
    els.cKeep.hidden = false;
    setStatus("ok", "The compliment contains the detail you gave, word for word. Nothing else was said about " + out.name + ".");
  }

  /* ----------------------------------------------------------- portrait */

  function revokePhoto() {
    if (state.photoUrl) {
      try { URL.revokeObjectURL(state.photoUrl); } catch (e) { /* nothing to revoke */ }
      state.photoUrl = "";
    }
    els.preview.removeAttribute("src");
    els.preview.style.display = "none";
    els.pBuild.hidden = true;
    els.pClear.hidden = true;
    els.readCard.hidden = true;
    els.pOutCard.hidden = true;
    state.analysis = null;
    state.myth = null;
    els.pKeep.hidden = true;
  }

  function acceptPhoto(file) {
    clearStatus();
    if (!file) return;
    if (!/^image\//.test(file.type || "")) {
      setStatus("bad", "refused: " + file.name + " is not an image. Nothing was read and no myth was invented.");
      return;
    }
    revokePhoto();
    state.photoUrl = URL.createObjectURL(file);
    els.preview.src = state.photoUrl;
    els.preview.style.display = "block";
    els.preview.onload = function () {
      els.pBuild.hidden = false;
      els.pClear.hidden = false;
      els.pNote.textContent = file.name + " — in memory only, never stored.";
    };
    els.pNote.textContent = file.name + " — in memory only, never stored.";
  }

  /* Presence only. If the browser has no detector, the app says so rather than
   * pretending it looked. */
  function detectFacePresent(img) {
    return new Promise(function (resolve) {
      if (typeof window.FaceDetector !== "function") { resolve({ detectorAvailable: false, faceFound: false }); return; }
      var detector;
      try { detector = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true }); }
      catch (e) { resolve({ detectorAvailable: false, faceFound: false }); return; }
      detector.detect(img).then(function (faces) {
        resolve({ detectorAvailable: true, faceFound: !!(faces && faces.length) });
      }, function () { resolve({ detectorAvailable: false, faceFound: false }); });
    });
  }

  function samplePhoto() {
    var img = els.preview;
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) return { ok: false, reason: "the image has no size yet, so nothing was read" };
    var scale = Math.min(1, MAX_SAMPLE / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, reason: "this browser gave no canvas context, so the photo could not be read" };
    ctx.drawImage(img, 0, 0, cw, ch);
    var data;
    try { data = ctx.getImageData(0, 0, cw, ch); }
    catch (e) { return { ok: false, reason: "the photo could not be read into pixels: " + (e && e.message ? e.message : "unknown reason") } }
    /* The canvas is dropped here: nothing is written anywhere. */
    canvas.width = 0;
    canvas.height = 0;
    return O.analysePixels(data.data, cw, ch);
  }

  function readPhoto() {
    clearStatus();
    els.pBuild.disabled = true;
    detectFacePresent(els.preview).then(function (face) {
      var analysis = samplePhoto();
      if (!analysis.ok) {
        els.pBuild.disabled = false;
        setStatus("bad", analysis.reason + " No myth was invented.");
        return;
      }
      state.analysis = analysis;
      var gate = O.oracleGate({ detectorAvailable: face.detectorAvailable, faceFound: face.faceFound });
      renderRead(analysis);
      if (!gate.ok) {
        els.pOutCard.hidden = true;
        els.pKeep.hidden = true;
        els.pBuild.disabled = false;
        /* the photo stays on screen, because the refusal is about that photo */
        setStatus("bad", gate.reason);
        return;
      }
      var myth = O.buildMyth(analysis, gate);
      if (!myth.ok) { els.pBuild.disabled = false; setStatus("bad", myth.reason); return; }

      var claims = O.claimsAboutPerson(myth.text);
      if (claims.length) {
        /* last line of defence: a myth that claims something about the person is not shown */
        els.pBuild.disabled = false;
        setStatus("bad", "The generated text contained a claim about the person (" + claims.join(", ") + "), so it was not shown. Nothing was invented about anyone.");
        return;
      }
      state.myth = myth;
      els.pOutCard.hidden = false;
      els.pOut.textContent = myth.text;
      els.pMeta.textContent = myth.says;
      els.pKeep.hidden = false;
      els.pBuild.disabled = false;
      setStatus("ok", gate.says);
    });
  }

  function renderRead(a) {
    els.readCard.hidden = false;
    els.readBody.textContent = "";
    var rows = [
      ["Brightness (0–255)", String(a.brightness)],
      ["Contrast", String(a.contrast)],
      ["Tone", a.tone],
      ["Light comes from", a.lightFrom],
      ["Points sampled", String(a.sampled)]
    ];
    rows.forEach(function (r) {
      var tr = node("tr");
      tr.appendChild(node("th", null, r[0]));
      tr.appendChild(node("td", null, r[1]));
      els.readBody.appendChild(tr);
    });
    var tr = node("tr");
    tr.appendChild(node("th", null, "Palette"));
    var td = node("td");
    a.palette.forEach(function (p) {
      var sw = node("span", "swatch");
      sw.style.background = p.hex;
      td.appendChild(sw);
      td.appendChild(document.createTextNode(p.hex + " " + p.name + " " + p.share + "%  "));
    });
    tr.appendChild(td);
    els.readBody.appendChild(tr);
  }

  /* -------------------------------------------------------------- export */

  function writer(name, text, mime) {
    if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
    window.Export.save(name, text, mime);
    return true;
  }

  function doExport(what, payload) {
    var out = O.exportFile(what, payload, { when: today() }, writer);
    if (out.ok) {
      els.keptNote.textContent = "Wrote " + out.filename + " (" + out.bytes + " bytes).";
      setStatus("ok", "Wrote " + out.filename + ".");
    } else {
      setStatus("bad", out.reason + ".");
    }
  }

  /* ---------------------------------------------------------------- tabs */

  ["compliment", "portrait"].forEach(function (name) {
    $("tab-" + name).addEventListener("click", function () {
      ["compliment", "portrait"].forEach(function (other) {
        var on = other === name;
        $("tab-" + other).setAttribute("aria-selected", on ? "true" : "false");
        $("panel-" + other).hidden = !on;
      });
    });
  });

  /* ---------------------------------------------------------------- wire */

  els.cBuild.addEventListener("click", buildCompliment);
  els.cKeep.addEventListener("click", function () {
    if (!state.compliment) return;
    keep({
      id: "k" + (state.kept.length + 1) + "-" + Date.now(),
      kind: "compliment",
      text: state.compliment.text,
      detail: state.compliment.detail,
      at: today()
    });
  });

  els.exportKept.addEventListener("click", function () {
    if (!state.kept.length) { setStatus("bad", "There is nothing kept to export yet."); return; }
    doExport("kept", { kept: state.kept });
  });

  els.clearKept.addEventListener("click", function () {
    drop(K_KEPT);
    state.kept = [];
    renderKept();
    setStatus("ok", "The kept list was cleared deliberately. Nothing else on this device was touched.");
  });

  els.pBuild.addEventListener("click", readPhoto);
  els.pKeep.addEventListener("click", function () {
    if (!state.myth) return;
    keep({ id: "m" + (state.kept.length + 1) + "-" + Date.now(), kind: "myth", text: state.myth.text, detail: "", at: today() });
  });
  els.pClear.addEventListener("click", function () {
    revokePhoto();
    els.pNote.textContent = "The photo was removed from the page. It was never stored.";
    setStatus("ok", "Photo removed. Nothing about it was kept except a myth, if you kept one.");
  });

  els.file.addEventListener("change", function () {
    acceptPhoto(els.file.files && els.file.files[0]);
    els.file.value = "";
  });
  ["dragenter", "dragover"].forEach(function (ev) {
    els.drop.addEventListener(ev, function (e) { e.preventDefault(); els.drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    els.drop.addEventListener(ev, function (e) { e.preventDefault(); els.drop.classList.remove("over"); });
  });
  els.drop.addEventListener("drop", function (e) {
    acceptPhoto(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  /* ------------------------------------------------------------ start up */

  var raw = load(K_KEPT);
  if (raw.ok && raw.value) {
    var parsed = O.parseKept(raw.value);
    if (parsed.ok) {
      state.kept = parsed.kept;
    } else {
      /* Reported, offered for export, and never replaced by an empty list silently. */
      setStatus("bad", parsed.reason);
      var exportRaw = node("button", "small", "Export the unreadable list");
      exportRaw.addEventListener("click", function () { doExport("raw", parsed); });
      els.keptNote.parentNode.insertBefore(exportRaw, els.keptNote);
      var clearRaw = node("button", "small", "Clear it and start a new list");
      clearRaw.addEventListener("click", function () {
        drop(K_KEPT);
        state.kept = [];
        renderKept();
        setStatus("ok", "The unreadable list was cleared deliberately. A new list starts empty.");
      });
      els.keptNote.parentNode.insertBefore(clearRaw, els.keptNote);
    }
  }

  renderKept();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
