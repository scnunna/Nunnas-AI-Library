---
title: The local content factory: voice, image and video models on one GPU
date: 2026-10-23
tags: content, video, audio, image, combination
usecases: video, audio, image
summary: How open voice, image, music and video models now chain into a full production line on a single consumer GPU, and where paid cloud models still earn their place.
video:
---

A year ago, a short-form video needed four subscriptions: a voice service, a stock-footage site, a music library and an editor. Today the same output can come from open models running one after another on a single 8 GB laptop GPU. The cost moves from per-minute fees to electricity.

## The chain

A working pipeline has five stations, and each one has an open-source option in this library:

1. **Script**: a local LLM drafts the hook, the beats and the caption ([Ollama](../?q=ollama#explore)).
2. **Voice**: a text-to-speech model reads it, or a voice-cloning model reads it in a voice you have rights to ([search: tts](../?q=tts#explore)).
3. **Pictures**: an image model renders keyframes. Node-graph tools like [ComfyUI](../?q=comfyui#explore) make those runs repeatable instead of one-off prompts.
4. **Motion**: an image-to-video model animates each keyframe for a few seconds.
5. **Assembly**: FFmpeg or an HTML-to-video renderer adds captions, music, transitions and loudness mastering ([search: render](../?q=render#explore)).

The key engineering rule is that **one GPU runs one model at a time**. Queue the heavy steps; let CPU-only steps (text-to-speech, captions) run alongside them.

## Where cloud still wins

Open video models are improving fast, but for a product shot that has to look like a commercial, paid image-to-video APIs still produce steadier motion and fewer artefacts. The pattern that works is hybrid: generate the keyframe locally for free, then pay a few cents per second only for the motion clip. You keep creative control of the frame and spend money only where quality is visibly better.

## Licences matter more than quality

Several of the best-sounding foley and talking-head models ship with research or non-commercial licences. Each tool's entry in this library notes this, and you should check it before anything is published. A fast rule: if you could not explain the licence to a client, keep that model to drafts.

## Cross-industry uses

- **Restaurants and food brands**: five-scene recipe shorts from a menu description (see the companion post on food and hospitality).
- **Training teams**: narrated how-to clips for every internal process, regenerated when the process changes.
- **Real estate**: listing walkthrough clips from photos plus a written description.
- **Education**: daily lesson recaps in a consistent voice and visual style.

The pain point being solved is the same everywhere: consistent video volume without a production crew.
