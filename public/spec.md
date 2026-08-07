# Storyboard Generator — Product Specification

> This document is the authoritative specification for the Storyboard Generator app.
> Tags: **NEW** = added recently · **UPDATED** = changed recently

---

## Overview

A web-based storyboard generation tool for music videos and films. Users build a project with characters, locations, and shots; generate AI images and motion videos for each shot; and assemble them into an animatic with audio. All data is versioned, cloud-synced, and persists across sessions.

---

## Projects

- Users can create, rename, and delete projects. Each project is independent.
- Projects are stored in Supabase (cloud) and in localStorage/IndexedDB (local). On load, cloud data takes precedence; on save failure, data is kept locally.
- Projects can be duplicated, which copies all data including audio.

---

## Versioning

- Each project maintains a version history. Versions can be created manually ("+ Version" button) or are created automatically every N edits.
- The working copy is always what the user is editing. Versions are read-only snapshots stored in Supabase.
- **History panel:** clicking "History" opens a modal listing all saved versions (loaded live from Supabase). Each version shows its label, type (auto/manual), and age. "Restore" restores that version.
- **Restore flow:** before applying a snapshot, the current working copy is auto-saved as a new version. The snapshot is then applied and saved as the new working copy, so there is no data loss.
- **No "viewing a version" state:** versions are never loaded into the editor as a browseable mode. Restore is an explicit, irreversible-but-recoverable action.
- **Versioned:** all character/location/shot fields (prompts, images, angles, composeMeta, composeLayers, finalImage, videoUrl, motionVideoUrl), visual styles, generation rules, boilerplate, script text/name.
- **Not versioned (shared across all versions):** the image galleries (all historically generated images per shot/character/location — these accumulate); the animatics list (project-level).
- Version snapshots strip base64 and blob: data; only permanent Supabase https: URLs are stored in snapshots.

---

## Configuration Tab

- Visual style selector: choose or create styles that affect AI image generation.
- Character generation rules: global prompt instructions applied to all character image generation.
- Location generation rules: same for locations.
- Character prompt boilerplate: appended to every character image prompt.
- Script import: upload a text/PDF script. The script text is parsed to extract characters, locations, and shots. Versioned per version.
- **UPDATED** Audio import: upload an MP3/WAV/M4A/MP4. Audio is always transcribed via Whisper (word-level timestamps). If "Music piece" is checked, beat detection also runs (see below). Audio is stored per project in IndexedDB and is not version-snapshotted.

### Audio — Music Piece Mode **NEW**

- When "Music piece" is checked before importing audio, the app runs client-side downbeat detection: (1) IIR low-pass filter (~200 Hz) isolates kick/bass frequencies; (2) onset strength (positive energy flux) is computed per 23 ms hop; (3) adaptive peak picking finds all beat positions (quarter notes); (4) beats are grouped into 4/4 bars — all four phase offsets (0–3) are scored by summing low-frequency energy at each candidate downbeat, and the phase with the highest score is selected; every 4th beat at that phase becomes a downbeat (bar 1).
- Two text boxes appear after import:
  - **Lyrics & Word Timestamps** — one line per transcribed word: `[M:SS.d] word`
  - **Downbeats with Lyrics** — one line per bar: `[M:SS.d] word1 word2 …` (all words that fall between that downbeat and the next)
- Shot timestamps are assigned to detected downbeats (one shot per bar): shots are distributed evenly across downbeats; lyric shots snap to the downbeat nearest their Whisper transcript match.
- Downbeat timestamps and music-piece mode are persisted per project in IndexedDB alongside the audio file and transcript.

---

## Characters

- Each character has: name, reference description, attributes, prompt, expression field, LoRA training status, reference images, and angle images (front, 3/4 left, profile left, 3/4 back left, back, 3/4 back right, profile right, 3/4 right).
- Reference images: upload or choose from library. Multiple reference images can be uploaded. "Use Ref As Default" toggles whether the ref image is used in generation.
- Expression: a text input with preset suggestions (via datalist). Pressing ▶ applies the expression to the current character image via AI editing.
- Angle images: generate each angle via AI. Images are stored as Supabase URLs and versioned.
- LoRA training: trains a fine-tuned model on the character's reference images. LoRA URL and status are versioned.

---

## Locations

- Each location has: name, aliases, reference description, prompt, and shot angle images (wide establishing, reverse angle, 3/4 left, 3/4 right, high angle, low angle) plus custom views.
- Reference image column offers Upload or Choose from Library. The library shows all historical images for that location (including shot images for shots assigned to it).
- "Use Ref As Default" applies the reference image when generating shot angles for that location. Versioned.
- Custom views: user-defined named views with their own prompts and generated images.

---

## Shot Sequence

- Each shot has: lyric/line, description, image prompt, video prompt, shot size, shot angle, shot movement, assigned characters, assigned location, character details, timestamp, and final image.
- Timestamps are assigned manually or auto-assigned from the Whisper transcript. In music piece mode, timestamps snap to detected beat positions.
- Final image: the selected/approved image for this shot. Shown in the animatic.
- Image editor (Compose): opens a canvas where a background (from location images) and character layers can be arranged, scaled, and lit. The compose state (bgUrl, bgColor, bgScale, bgOffsetX, bgOffsetY, globalLighting, globalContrast, globalSaturation, bgSeparation, layers with per-layer position/opacity/lighting) is versioned with the shot.
- **UPDATED** Motion video: two kinds — (1) Generate Video (shots table) stores a fal.ai video URL as `videoUrl`; (2) Motion video (compose editor) stores a pan/zoom WebM as `motionVideoUrl`. Both are versioned and used in the animatic. `motionVideoUrl` takes priority over `videoUrl` when both exist.
- **UPDATED** Motion duration override (`motionDuration`): optional per-shot field (seconds). If set, only that many seconds of the motion clip play in the animatic; the shot slot holds on the last frame for the remaining duration. Shown as an input in the Video Prompt column when a motion video exists for the shot.
- Undo in the image editor: undoes changes to all compose fields including background size and position.

---

## AV Script

- A read-only formatted view showing each shot's lyric, description, and assigned characters/location in a two-column A/V script layout.
- Can be printed.

---

## Animatic

- **UPDATED** Generates a video assembling all shots — motion video (`motionVideoUrl` preferred, then `videoUrl`) where generated, otherwise final image — timed to the imported audio. The server follows HTTP redirects and falls back per-shot from video to image if a video URL is unreachable.
- **UPDATED** Video shot duration behavior: a motion video clip fills the full shot slot by default. If the clip is shorter than the shot's duration (next timestamp minus this timestamp), the last frame is held for the remainder. If a `motionDuration` override is set on the shot, only that many seconds of motion play; the rest of the slot shows the last frame. Changing a shot's timestamps (start or end) automatically changes the slot length — re-generating the animatic picks up the new durations.
- **UPDATED** Live canvas preview: the animatic tab renders a `<canvas>` element as the primary visual display, driven by a `requestAnimationFrame` loop. A hidden `<video>` element provides the audio track only. For shots with a `motionVideoUrl` or `videoUrl`, a pool of hidden `<video>` elements decode and supply frames in sync with playback. For still shots, the current `finalImage` is drawn. The canvas always reflects the live shot data — timestamp changes and image updates are visible immediately without regenerating the server MP4. A Play/Pause button controls playback; clicking the canvas also toggles play/pause. Clicking the timeline scrubs to that position.
- Shot boundaries are shown as a draggable timeline below the video player. Dragging a handle adjusts the shot's timestamp and saves it.
- Clicking the timeline scrubs the video to that position.
- Generated animatics are uploaded to Supabase and saved permanently. The animatic tab shows all previously generated animatics for the project, newest first.
- Each animatic has a Download button and a Remove button.
- **UPDATED** Animatics are project-level (not version-level) — they persist across version switches and are never cleared when switching versions.

---

## Cloud Sync

- Project data (characters, locations, shots, styles, rules) is saved to Supabase Storage as JSON files (`data.json`, `images.json`) on every auto-save.
- Script text is stored locally only (IndexedDB) — it is too large for efficient cloud storage.
- Audio files are stored in IndexedDB, keyed per-project.
- Generated images and videos are stored as permanent Supabase Storage URLs and referenced in the project data.
- If cloud sync fails, data is retained locally. The error toast shows the specific failure reason.

---

## Known Limitations

- Audio files are stored in the browser's IndexedDB — they do not sync across devices. Re-import audio on a new device.
- Image galleries (all historically generated images per shot/character/location) are not versioned — they accumulate across all versions of a project.
- Blob: URLs (temporary browser object URLs) are not persisted — generated videos/images are always uploaded to Supabase before being stored in shot data.
- Downbeat detection accuracy varies by genre. It works best on 4/4 music with a prominent kick drum on beat 1. Sparse or acoustic music may produce uneven bar groupings.
