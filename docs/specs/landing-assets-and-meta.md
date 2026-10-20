# Landing page: the clip, the captions, the poster, the share image and the page head

*Spec for `docs/engineering/engineering-doc.md`, sections 5, 6 and 11. The files go in `public/`, which Vite copies into `dist/` and the engine serves (`express.static`, with `Range` support). The Content-Security-Policy in `server/engine.ts` does not change: the video, the captions and the images are all same-origin.*

## 1. The files

| File | What | Notes |
|---|---|---|
| `public/clip-how-it-works.mp4` | The one-minute clip, 1280 × 720, H.264 and AAC, about 56 seconds, about 6.7 MB | Must be the web version with the `moov` atom first. The copy `~/Desktop/demo-clip-how-it-works-web.mp4` was made so on 20 October (`AVAssetExportSession`, `shouldOptimizeForNetworkUse`); check it again before copying (§5). |
| `public/clip-how-it-works.vtt` | English captions, WebVTT | §2 |
| `public/clip-poster.jpg` | The poster, 1280 × 720, under 150 KB | A frame of the clip that shows a receipt (the "fits" frame); `.jpg` quality about 80 |
| `public/share.png` | The link-preview image, 1200 × 630, under 300 KB | §4 |

None of these is secret; all four are public once deployed. They are ordinary blobs in git (not LFS). The clip adds about 7 MB to the repository and the image; the owner's loose end 1.9 (videos in git history) is noted in `docs/STATUS.md` and cleaned later, together.

## 2. The captions

`clip-how-it-works.vtt` has five cues, one per narration line. The text is exactly `LANDING.transcript` in `src/data/landing.ts` (the same five lines as `scripts/demo-video/narration-clip.json`, segments `k0` to `k4`). Cue times are the start and end of each narration segment **as muxed into the clip**, not guessed:

- `scripts/demo-video/assemble.mjs` places each TTS segment at an offset on the clip's audio track. Add a `--print-offsets` flag (or write `clip-offsets.json` beside the output) that prints each segment's start and its duration in seconds, then build the cues from that. If a segment's audio was stretched to fit its scene, use the stretched duration.
- A cue starts at the segment's start and ends at its end (the end, not the next start, so silences are not captioned).
- Format: `WEBVTT` header, a blank line, then `00:00:00.000 --> 00:00:03.400` style cues; one sentence per cue; no styling tags.

**The owner (or a native speaker) listens once with captions on** and confirms the words match what is said (engineering document, section 12, question 1). A mismatch is a bug in the file, not in the narration.

## 3. The markup (inside `Landing.tsx`, section S3)

```tsx
<video controls preload="none" playsInline poster="/clip-poster.jpg"
       aria-label="One-minute recording of DiaBite" width={1280} height={720}>
  <source src="/clip-how-it-works.mp4" type="video/mp4" />
  <track kind="captions" src="/clip-how-it-works.vtt" srclang="en" label="English" default />
  Your browser cannot play this clip. The transcript is below.
</video>
```

No `autoPlay`, no `loop`, no `muted` attribute (a person who presses play wants sound). `width` and `height` reserve the space so nothing jumps. The poster's `alt` is not needed (the `video` has its label); the transcript below carries the content.

## 4. The share image and `index.html`

`public/share.png` is the receipt card of the landing page as a picture (decided 20 October): the question in quotes, the **Fits** pill, the three figures, on the Paper background, with the wordmark at the top. Make it by screenshotting the rendered S4 card at 1200 × 630 in light mode with headless Chrome (`eval/lib/cdp.mjs` already launches it), not by drawing it, so it shows the real numbers. It must be regenerated when `LANDING` changes; note this in a comment at the top of `src/data/landing.ts`.

In `index.html`, in `<head>` (static, because a crawler for LinkedIn or Slack does not run the app):

```html
<meta name="description" content="Describe a meal in your own words. DiaBite says whether it fits what is left of your day, and shows the arithmetic. For adults in the US with type 2 diabetes, prediabetes or insulin resistance." />
<link rel="canonical" href="https://diabite.pro/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="DiaBite" />
<meta property="og:title" content="DiaBite: can I eat this?" />
<meta property="og:description" content="Describe a meal in your own words. DiaBite says whether it fits what is left of your day, and shows the arithmetic." />
<meta property="og:url" content="https://diabite.pro/" />
<meta property="og:image" content="https://diabite.pro/share.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="A DiaBite receipt: two eggs, a slice of rye bread and half an avocado fit the day, with a meal load of 7.2 and 37.8 left." />
<meta name="twitter:card" content="summary_large_image" />
```

The existing `<title>` stays (`DiaBite - nutrition for type 2 diabetes and insulin resistance`). The `og:image:alt` states the same facts as the receipt, so it is built from the same numbers: if `LANDING` changes, this line changes with it (check L9 compares them).

Nothing in `<head>` loads a third-party script; the Google Fonts stylesheet the app already uses is the only external request, as today.

## 5. Making the web copy of the clip (only if it needs redoing)

The clip as recorded writes its `moov` atom last, so a browser or a Drive preview must fetch the whole file before playing. Rewrite it with the atom first, without re-encoding:

```
# macOS, no extra software: AVAssetExportSession, passthrough preset, shouldOptimizeForNetworkUse = true
```

The scratchpad script used on 20 October is `faststart.swift` (`AVAssetExportSession(asset:presetName: AVAssetExportPresetPassthrough)`); a reusable copy goes to `scripts/demo-video/faststart.swift` in the same change. Check afterwards: the bytes after `ftyp` read `moov` (not `mdat`), the duration is unchanged, and an `AVURLAsset` reports it playable with a video and an audio track.

## 6. Verify

- `ls -l public/` shows the four files at the sizes above; `npm run build` copies them to `dist/`.
- After deploy: `curl -sI https://diabite.pro/share.png` is 200 with `content-type: image/png`; `curl -s -r 0-1023 -o /dev/null -w "%{http_code}" https://diabite.pro/clip-how-it-works.mp4` is **206**; the captions file is 200 with `content-type: text/vtt`; the page source contains every meta tag of §4.
- The captions play: open the page, press play with captions on, read them against the sound.
- A real link preview: paste `https://diabite.pro` into a LinkedIn or Slack message draft; the title, the sentence and the image appear. (LinkedIn caches previews: the Post Inspector can refresh one. This is the owner's check; no script can do it.)
