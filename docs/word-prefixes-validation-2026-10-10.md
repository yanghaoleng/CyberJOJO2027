# Camera word phrases and consistent DOMI voice

- First goal: apple. Second: two bananas. Third: three red oranges. Later goals keep quantity/color slots and the existing ten-food chapter.
- Underlined quantity/color/food tokens expose touch and keyboard suggestions. Quantities one–five, ten colors and ten foods can be recombined. Mass nouns use pieces, bowls or cups; countable nouns pluralize.
- Spoken prefixes control the rendered models independently of the displayed suggestion. Each bubble uses one canvas with up to five distinct model instances. Banana bunches become single bananas for practice; recoloring preserves leaves/stems and accessories.
- Prompt uses a camera-wide dark gradient with no card background, border or shadow. No bottom instruction strip. Existing click, drag, eight-second auto-feed and expanded album reports remain.
- Reports retain spoken quantity/color vocabulary, independent versus guided groups, and phrases. Changing a suggestion is a menu action, never a voice attempt. Completing a goal records the food interaction; it does not claim pronunciation scoring.
- Conversation, prompts, camera reactions, word cards and old/new DOMI notes share `zh_male_naiqimengwa_uranus_bigtts`. Canonical audio carries `domi-word-tts-v1`; unverified saved audio regenerates, system/PCM fallback is prohibited for DOMI. Playback is 1.5x with preserved pitch. Source changes reapply the rate.
- Latest-prompt requests coalesce within the existing synthesis rate limit. New selections cancel stale TTS; exiting cancels pending prompts.

Local verification: 243 automated tests; production build; real GLB tint/count checks; browser tests for full ten-goal flow, drag/auto-feed/report, all voice playback paths, and touch layouts at 320/390 pixels and 844-pixel landscape passed.

Formal release acceptance: run `scripts/qa/word-prefixes-live.mjs` after deployment to check actual provider audio through the browser microphone and ASR, three food combinations, stored groups/phrases, and full-conversation voice identity. This is automated Chromium acceptance; physical phones and child accents require separate testing. Deployment revision and time are recorded by the server release ledger.
