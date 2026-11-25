/* oracle-core — the engine behind Oracle.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * Two oracles, one rule: say something kind or small about what you were actually given,
 * and refuse when you were given nothing.
 *
 *   compliment   needs a real detail about a person and builds the compliment around it,
 *                verbatim. No detail, no compliment — never a generic one dressed up.
 *   portrait     reads a photo's colours, light and composition — never the person — and
 *                invents a small myth from those numbers. It says it invented it, and it
 *                never identifies anyone or infers age, gender, ethnicity, health or mood.
 *
 * Pure functions: no DOM, no network, no storage. The page does the wiring.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.OracleCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";

  /* ------------------------------------------------------------ compliment
   * The framing carries no praise adjectives: the only thing said about the person
   * is the detail they gave. That is what keeps it from flattering.
   */
  var FRAMING = [
    function (n, d) { return "What I keep noticing about " + n + " is this: " + d + ". It is a specific thing, and specific things are the ones that stay with a person."; },
    function (n, d) { return n + ", the thing I would tell someone about you is not a word like \u201ckind\u201d or \u201csmart\u201d — it is this: " + d + "."; },
    function (n, d) { return "I want to name one thing rather than a pile of them: " + d + ". That is what I think of when I think of " + n + "."; },
    function (n, d) { return "This is not a compliment in the usual shape, so here it is plainly: " + d + ". I noticed, " + n + ", and it stayed with me."; },
    function (n, d) { return "If I had to say one true thing about " + n + " today, it would be this: " + d + ". Nothing more, and nothing invented."; },
    function (n, d) { return n + " — " + d + ". I am not dressing that up; it is the whole of what I wanted to say."; },
    function (n, d) { return "The detail I would keep, if I could keep only one, is this: " + d + ". That is the compliment, " + n + ", and it is yours."; }
  ];

  /* Words that turn a compliment into flattery. None of them may appear. */
  var PRAISE = ["amazing", "awesome", "wonderful", "incredible", "perfect", "brilliant", "fantastic", "superb", "greatest", "best person", "angel", "genius"];

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 1000000007; }
    return h;
  }

  function buildCompliment(input) {
    var name = String((input && input.name) || "").trim();
    var detail = String((input && input.detail) || "").trim();
    if (!name) {
      return { ok: false, reason: "a blank name is refused \u2014 a compliment with nobody to give it to is not a compliment", needs: "name" };
    }
    if (!detail) {
      return {
        ok: false,
        reason: "there is no detail about " + name + " yet. This app will not produce a generic compliment and call it specific: give it one real thing you noticed, and it will build the compliment around that.",
        needs: "detail"
      };
    }
    if (detail.length < 3) {
      return { ok: false, reason: "\u201c" + detail + "\u201d is too short to be a detail. One real thing \u2014 what they did, how they did it, what you saw.", needs: "detail" };
    }
    var text = FRAMING[hash(detail.toLowerCase()) % FRAMING.length](name, detail);
    var low = text.toLowerCase();
    var flattery = PRAISE.filter(function (w) { return low.indexOf(w) >= 0; });
    return {
      ok: true,
      name: name,
      detail: detail,
      text: text,
      containsDetailVerbatim: text.indexOf(detail) >= 0,
      flatteryWords: flattery,
      claim: "The only thing this says about " + name + " is the detail you supplied."
    };
  }

  /* -------------------------------------------------------------- portrait */

  var COLOUR_NAMES = [
    { name: "amber", test: function (r, g, b) { return r > g && g > b && r - b > 60; } },
    { name: "rust", test: function (r, g, b) { return r > g + 20 && g > b && r - b > 40; } },
    { name: "ochre", test: function (r, g, b) { return Math.abs(r - g) < 30 && r > b + 40; } },
    { name: "moss", test: function (r, g, b) { return g > r && g > b; } },
    { name: "slate", test: function (r, g, b) { return b >= r && b >= g && b - r > 10; } },
    { name: "blue-grey", test: function (r, g, b) { return Math.abs(r - g) < 18 && b > g; } },
    { name: "rose", test: function (r, g, b) { return r > 120 && b > 90 && Math.abs(r - b) < 60 && g < r; } },
    { name: "ash", test: function () { return true; } }
  ];

  function hex(r, g, b) {
    var h = function (v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length === 1 ? "0" + s : s; };
    return "#" + h(r) + h(g) + h(b);
  }

  function colourName(r, g, b) {
    for (var i = 0; i < COLOUR_NAMES.length; i++) if (COLOUR_NAMES[i].test(r, g, b)) return COLOUR_NAMES[i].name;
    return "ash";
  }

  /* Analyse sampled pixels. `pixels` is RGBA, `width`/`height` describe the sample
   * grid, and `step` is how many source pixels each sample stands for — so the
   * numbers are honest about the resolution they were measured at. */
  function analysePixels(pixels, width, height) {
    if (!pixels || !width || !height) return { ok: false, reason: "no pixels arrived, so nothing was read" };
    var n = Math.floor(pixels.length / 4);
    if (n < 16) return { ok: false, reason: "the image is too small to read: fewer than 16 pixels were sampled" };

    var sumR = 0, sumG = 0, sumB = 0, sumL = 0, sumL2 = 0;
    var buckets = {};
    var thirds = { left: 0, right: 0, top: 0, bottom: 0, centre: 0 };
    var counts = { left: 0, right: 0, top: 0, bottom: 0, centre: 0 };
    var i, x, y, r, g, b, l, key;

    for (i = 0; i < n; i++) {
      r = pixels[i * 4]; g = pixels[i * 4 + 1]; b = pixels[i * 4 + 2];
      l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumR += r; sumG += g; sumB += b; sumL += l; sumL2 += l * l;
      key = (r >> 5) + "-" + (g >> 5) + "-" + (b >> 5);
      if (!buckets[key]) buckets[key] = { count: 0, r: 0, g: 0, b: 0 };
      buckets[key].count++; buckets[key].r += r; buckets[key].g += g; buckets[key].b += b;

      x = i % width; y = Math.floor(i / width);
      if (x < width / 3) { thirds.left += l; counts.left++; }
      else if (x > (2 * width) / 3) { thirds.right += l; counts.right++; }
      if (y < height / 3) { thirds.top += l; counts.top++; }
      else if (y > (2 * height) / 3) { thirds.bottom += l; counts.bottom++; }
      if (x >= width / 3 && x <= (2 * width) / 3 && y >= height / 3 && y <= (2 * height) / 3) { thirds.centre += l; counts.centre++; }
    }

    var meanL = sumL / n;
    var variance = Math.max(0, sumL2 / n - meanL * meanL);
    var ordered = Object.keys(buckets).map(function (k) {
      var v = buckets[k];
      return { share: v.count / n, r: v.r / v.count, g: v.g / v.count, b: v.b / v.count };
    }).sort(function (a, b2) { return b2.share - a.share; });

    var top = ordered[0];
    var avg = function (k) { return counts[k] ? thirds[k] / counts[k] : meanL; };
    var lightest = "centre", heaviest = "centre", best = -1, worst = 999;
    ["left", "right", "top", "bottom", "centre"].forEach(function (k) {
      var v = avg(k);
      if (v > best) { best = v; lightest = k; }
      if (v < worst) { worst = v; heaviest = k; }
    });

    return {
      ok: true,
      sampled: n,
      brightness: Math.round(meanL),
      contrast: Math.round(Math.sqrt(variance)),
      light: meanL > 140 ? "bright" : meanL < 80 ? "low" : "middling",
      tone: (sumR / n) - (sumB / n) > 18 ? "warm" : (sumB / n) - (sumR / n) > 18 ? "cool" : "neutral",
      dominant: { hex: hex(top.r, top.g, top.b), name: colourName(top.r, top.g, top.b), share: Math.round(top.share * 100) },
      palette: ordered.slice(0, 3).map(function (o) {
        return { hex: hex(o.r, o.g, o.b), name: colourName(o.r, o.g, o.b), share: Math.round(o.share * 100) };
      }),
      lightFrom: lightest,
      shadowIn: heaviest,
      measured: [
        "the most common colour is " + hex(top.r, top.g, top.b) + " (" + Math.round(top.share * 100) + "% of what was sampled)",
        "the picture reads as " + (meanL > 140 ? "bright" : meanL < 80 ? "low-lit" : "middling") + " at an average luminance of " + Math.round(meanL),
        "contrast sits at " + Math.round(Math.sqrt(variance)),
        "the light comes from the " + lightest + " of the frame"
      ]
    };
  }

  /* The gate. Presence only — never identity. A detector that is missing is named,
   * not faked. */
  function oracleGate(info) {
    var detectorAvailable = !!(info && info.detectorAvailable);
    var faceFound = !!(info && info.faceFound);
    if (!detectorAvailable) {
      return {
        ok: true,
        mode: "image-only",
        says: "This browser has no face detector, so the app will not claim to have seen a person. It can still invent a myth from the colours, the light and the composition \u2014 which is all it ever reads, even when a detector is present."
      };
    }
    if (!faceFound) {
      return {
        ok: false,
        mode: "refused",
        reason: "No face was found in this image, so no myth was invented from a photo the app could not read. The photo is shown above; nothing was generated from it."
      };
    }
    return { ok: true, mode: "face-confirmed", says: "A face was detected. The app will still read only colour, light and composition \u2014 never the person." };
  }

  /* The myth: built from measured values, and every myth carries at least two of
   * them so it cannot be a template that fits anyone. */
  var MYTH_OPENINGS = [
    function (a) { return "Somewhere in a city that keeps no record of it, there is a room where the light is always " + a.dominant.name + "."; },
    function (a) { return "In the year the " + a.dominant.name + " season lasted too long, someone kept a photograph like this one folded inside a book."; },
    function (a) { return "There is a street where every window is " + a.dominant.name + " at the same hour, and one person always knows when that hour is."; }
  ];

  var MYTH_TURNS = [
    function (a) { return "The story people tell is that whoever stands there becomes " + (a.light === "bright" ? "easy to find" : a.light === "low" ? "hard to photograph" : "hard to remember clearly") + "."; },
    function (a) { return "What they say about that room is that it gives back " + (a.tone === "warm" ? "a little more warmth than it was given" : a.tone === "cool" ? "a coldness that is somehow welcome" : "exactly what it was given, and not a thing more") + "."; },
    function (a) { return "The rule of the place, as it was told to me, is that you must enter from the " + a.lightFrom + " and leave by the " + a.shadowIn + "."; }
  ];

  /* Every close quotes two measured phrases verbatim, so the myth cannot be a
   * template that would fit any photograph. */
  var MYTH_CLOSES = [
    function (a) { return "The photograph itself only says this: " + a.measured[0] + ", and " + a.measured[3] + "."; },
    function (a) { return "What can be checked is smaller than the story: " + a.measured[1] + ", and " + a.measured[2] + "."; },
    function (a) { return "The evidence is the picture and nothing else \u2014 " + a.measured[2] + ", and " + a.measured[3] + "."; }
  ];

  function buildMyth(analysis, gate) {
    if (!analysis || !analysis.ok) return { ok: false, reason: (analysis && analysis.reason) || "there is no image to read" };
    if (gate && gate.ok === false) return { ok: false, reason: gate.reason };
    var seed = hash(analysis.dominant.hex + "|" + analysis.contrast + "|" + analysis.lightFrom);
    var text = [
      MYTH_OPENINGS[seed % MYTH_OPENINGS.length](analysis),
      MYTH_TURNS[Math.floor(seed / 7) % MYTH_TURNS.length](analysis),
      MYTH_CLOSES[Math.floor(seed / 49) % MYTH_CLOSES.length](analysis)
    ].join(" ");
    var quoted = analysis.measured.filter(function (m) { return text.indexOf(m) >= 0; });
    return {
      ok: true,
      text: text,
      invented: true,
      says: "This is invented. It was written from " + quoted.length + " measured property of the image \u2014 not from the person in it.",
      measured: analysis.measured,
      quotedMeasured: quoted,
      reads: { brightness: analysis.brightness, contrast: analysis.contrast, dominant: analysis.dominant.hex, lightFrom: analysis.lightFrom }
    };
  }

  /* What the app must never say about a person. Used by the tests, and by the page
   * as a last check before it shows a myth. */
  var PERSON_CLAIMS = ["young", "old", "elderly", "man", "woman", "male", "female", "boy", "girl",
    "happy", "sad", "angry", "tired", "healthy", "sick", "ill", "beautiful", "handsome",
    "attractive", "indian", "fair", "confident", "shy", "kind", "smart", "friendly"];

  function claimsAboutPerson(text) {
    var low = String(text || "").toLowerCase();
    return PERSON_CLAIMS.filter(function (w) {
      return new RegExp("\\b" + w + "\\b").test(low);
    });
  }

  /* --------------------------------------------------------------- storage */

  function serializeKept(items) {
    return JSON.stringify({ version: VERSION, kept: (items || []).map(function (k) {
      return { id: k.id, kind: k.kind, text: k.text, detail: k.detail || "", at: k.at || "" };
    }) }, null, 2);
  }

  /* An unreadable list is reported and offered for export. It is never replaced by
   * an empty one without the person saying so. */
  function parseKept(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, reason: "there is nothing kept yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      return { ok: false, reason: "the kept list is not readable JSON. It was not used, and it has not been replaced by an empty list \u2014 export it to keep it, or clear it deliberately.", raw: raw };
    }
    if (!data || !Array.isArray(data.kept)) {
      return { ok: false, reason: "the kept list has nothing in it that can be read, so it was not used. It has not been replaced \u2014 export it or clear it deliberately.", raw: raw };
    }
    var clean = [];
    data.kept.forEach(function (k) {
      if (!k || !k.text) return;
      clean.push({ id: String(k.id || "k" + clean.length), kind: String(k.kind || "compliment"), text: String(k.text), detail: String(k.detail || ""), at: String(k.at || "") });
    });
    return { ok: true, kept: clean, raw: raw };
  }

  function stamp(when) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated";
  }

  function keptMarkdown(items, when) {
    var lines = ["# Oracle \u2014 what you kept", ""];
    if (when) lines.push("Exported " + when + ".");
    lines.push("");
    (items || []).forEach(function (k, i) {
      lines.push("## " + (i + 1) + ". " + (k.kind === "myth" ? "Myth" : "Compliment") + (k.at ? " \u2014 " + k.at : ""));
      lines.push("");
      lines.push(k.text);
      if (k.detail) lines.push("", "_Built from the detail: " + k.detail + "_");
      lines.push("");
    });
    if (!(items || []).length) lines.push("Nothing was kept.");
    return lines.join("\n");
  }

  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body;
    if (what === "kept") { name = "oracle-kept-" + stamp(meta.when) + ".md"; body = keptMarkdown(payload.kept, meta.when); }
    else if (what === "raw") { name = "oracle-unreadable-kept-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, what === "raw" ? "text/plain;charset=utf-8" : "text/markdown;charset=utf-8");
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return {
    version: VERSION,
    FRAMING: FRAMING,
    PRAISE: PRAISE,
    PERSON_CLAIMS: PERSON_CLAIMS,
    buildCompliment: buildCompliment,
    analysePixels: analysePixels,
    colourName: colourName,
    oracleGate: oracleGate,
    buildMyth: buildMyth,
    claimsAboutPerson: claimsAboutPerson,
    serializeKept: serializeKept,
    parseKept: parseKept,
    keptMarkdown: keptMarkdown,
    exportFile: exportFile
  };
});
