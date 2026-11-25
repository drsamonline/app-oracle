# Changelog

All notable changes to Oracle are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 25/11/2026

### Added
- Compliment machine: one real detail in, a compliment built around it and carrying it
  verbatim, with framing that contains no praise adjectives. A missing detail is refused and
  asked for; a blank name is refused. Five details produce five different compliments, each
  containing its own detail and none of the others'.
- Portrait oracle: samples a photo to a 96px grid and measures palette, brightness, contrast,
  tone and which third the light comes from — then invents a myth that quotes at least two of
  those measured values verbatim. The myth is labelled invented wherever it appears.
- A presence-only face gate: `FaceDetector` where the browser has it (yes/no only), an honest
  "no detector in this browser" mode where it does not, and a refusal — with the photo left on
  screen — when a detector finds no face.
- A last-check guard in the page: a myth containing any claim about a person (age, gender,
  ethnicity, health, mood, appearance) is never shown.
- Kept list on the device with Markdown export; an unreadable list is reported, offered for
  export, and never replaced by an empty one without an explicit clear.
- The photo is never stored: no data URL is written anywhere, the object URL is revoked, and
  the canvas is dropped after reading.
- PWA shell: manifest, cache-only service worker, icons. Works from `file://`.
- Tests: `tests/self-tests.js` (104 assertions), `tests/ui-tests.js` (35, in jsdom),
  `tests/page-smoke.js`. CI runs all three.

### Not built
- A packaged EXE / APK release: `app-builder` is not reachable from the build environment.
