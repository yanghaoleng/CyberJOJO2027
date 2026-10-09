# Camera word bubbles

The `/words` entry now opens the camera conversation. English and Chinese wake phrases enter food word practice directly. The previous standalone 3D chapter and invitation modal were removed.

Supported goals: apple, banana, orange, strawberry, bread, cake, noodles, candy, juice and milk. Spoken food words create up to three bubbles with real food models. Children can drag a bubble to DOMI, tap it or press Enter. Unused bubbles fly to its mouth after eight seconds, with serialized feeding and Rive mouth-pose chewing. Dragging and background visibility pause automatic feeding.

Reports reuse the album and daily timeline, keeping independent/guided spoken vocabulary and partial progress. Goal progress advances after feeding. DOMI's PCM streams, full audio and browser fallback use 1.5x speech playback; Jiaojiao stays at 1x. PCM chunk scheduling accounts for the new playback rate.

Browser checks use fake camera and ASR fixtures. They verify actual Rive and food model rendering, automatic/manual feeding, source groups, records and no iframe. These checks do not constitute real-child microphone recognition acceptance.

The retained JMA model source builds banana/bread assets. Original procedural geometry builds orange/strawberry/milk. Regenerate with `node scripts/generate-word-foods.mjs`.

Browser fixture checks passed for automatic feeding after eight seconds, tap/Enter feeding, dragging held longer than eight seconds, mouth drop, re-entry by English wake phrase, all ten actual food models, early-exit groups and complete reports. DOMI uses verified mouth timeline poses; its fallback mouth point was calibrated against the camera canvas. Run `scripts/qa/word-bubbles.mjs` with Playwright and a 4173 build preview.

A delayed initial Rive fixture verifies that word practice waits for the real DOMI character before entering. Browser checks confirm full audio and streaming PCM both use 1.5x. The final regression suite has 216 passing tests.
