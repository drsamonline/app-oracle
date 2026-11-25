# Oracle

Two small things, both built only from what you actually give it: a **compliment** around one
real detail you noticed, and a **myth** invented from what a photograph actually shows.

- **Demo (the app itself):** https://drsamonline.github.io/app-oracle/play/index.html
- **Landing page:** https://drsamonline.github.io/app-oracle/
- **Plan row:** #4 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-compliment-machine` (lead), `app-portrait-oracle`
- **Licence:** PolyForm Noncommercial 1.0.0

## Status

| | |
|---|---|
| **Built** | Compliment from one supplied detail, carried verbatim, with no praise adjectives; refusal when the detail is missing; a kept list on the device with Markdown export; photo reading (palette, brightness, contrast, tone, which third the light comes from); an invented myth quoting at least two measured values; a presence-only face gate; a guard that blocks any myth containing a claim about a person; honest handling of an unreadable kept list. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI, attached to the rolling release: [app-latest](https://github.com/drsamonline/app-oracle/releases/tag/app-latest) |
| **Not built** | Face detection in browsers that do not ship `FaceDetector` — Firefox and Safari among them; there the app says so instead of pretending it looked. |
| **Untested** | The canvas path with a real decoded photo (the tests feed a stubbed 2D context, because jsdom has no canvas), the service worker and install prompt, and `FaceDetector` on a real device — the tests drive a fake detector, so the real API's behaviour on your browser is unverified. |

## The Compliment spec's "done means", counted

The spec makes five countable demands; each is a named assertion in `tests/self-tests.js`:

| The spec says | The test |
|---|---|
| a compliment built from a detail contains that detail **verbatim** | every one of five compliments contains its own detail as a substring |
| the app **refuses** when no detail is supplied | `buildCompliment({name})` → `ok: false`, `needs: "detail"`, and the reason asks for one |
| **5** details produce **5** compliments, each containing its own and no other's | five distinct texts; each contains its own detail and none of the other four |
| the compliment makes no claim beyond the detail | the framing carries no praise adjective, and the praise list is asserted absent from all framing text |

## The Portrait Oracle's must-nots

| Must not | Test |
|---|---|
| identify the person | `must_not_identify` — no age/gender/ethnicity field exists; the page states the promise |
| infer age, gender, ethnicity, health or mood | no such field in the engine; `claimsAboutPerson()` returns empty for every myth, and the page refuses to render one that does not |
| claim insight into the real person | every myth is labelled invented, and `says` names how many measured properties it used |
| keep the photo | no `toDataURL`/`readAsDataURL` anywhere; the stored list holds text only; the object URL is revoked; the canvas is dropped |
| invent a myth from a photo it could not read | `oracleGate({faceFound: false})` refuses; `buildMyth` refuses a refused gate |

Mutation-tested four ways on 25/11/2026: a compliment that drops the detail (11 failures),
allowing a generic compliment with no detail (4), inventing a myth past a refused gate (1), and
replacing a corrupt kept list with an empty one (2) each turned the suite red; restored, 104/104.

## What it will not do

- **Flatter.** The framing sentences contain no praise adjectives at all — not "amazing", not
  "wonderful". The only thing said about the person is the detail you supplied.
- **Say anything about a person from a photo.** No identity, age, gender, ethnicity, health or
  mood. The page runs a final check against the engine's forbidden-claims list before showing a myth.
- **Keep a photo.** Sampled to a 96px grid, measured, and dropped. No data URL reaches storage.
- **Upload anything.** No `fetch`, XHR, WebSocket or beacon in any shipped file; CSP `connect-src 'none'`.

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | Missing detail → asked for, not replaced by a generic compliment. Blank name → refused. Non-image file → refused by type. |
| **No network** | Nothing changes; generation and the photo reading are local. |
| **Storage full or unavailable** | The compliment or myth is generated and shown; keeping it fails with a notice that says it was not kept. |
| **Corrupt saved state** | The unreadable kept list is reported and offered for export; it is never replaced by an empty list without an explicit clear. The photo is never retained, so there is no photo state to corrupt. |

## Where the spec was silent, and what was chosen

- **The face gate when no detector exists.** The spec's failure case assumes a detector. Where
  the browser has none, the app refuses to *claim* a face and reads the image anyway, saying in
  plain words that it saw colours and shapes, not a person. That is the smaller claim, not a
  larger one.
- **What "reads only what the image shows" means here.** Five measured numbers: brightness,
  contrast, tone, the dominant colour and its share, and which third of the frame carries the
  light. The myth quotes at least two verbatim, so it cannot fit any picture.
- **Sentence-level framing, not a personality model.** There is no adjective bank and no
  persona: the compliment is the detail plus framing that names it.
- **`repeat` of the reading.** Analysis is deterministic from pixels — the same photo always
  yields the same myth, which is what makes it testable rather than charming.

## What is not built, and why

**Face detection everywhere.** `FaceDetector` is a Chromium API. A shipped model would be the
honest way to cover other browsers; it is not in this v1, and the app says so at the point where
it matters instead of hiding it.
