# 查问试改：学习路径对比图

用于官网 `/intro/#future-case` 的概念示意图。当前版本根据用户反馈降低信息密度：删除辅助标签、背景色块与周边装饰，仅保留两条学习路径、查问试改的循环和知识内化、能力掌握的结果。使用轻字重、单色抽象线条图标及留白，保留柔和、亲和的视觉感受。

使用内置 imagegen 编辑，检查中文文字、顺序与回路箭头。桌面版为 3:2 横图，手机端为 2:3 竖图，以 `picture` 自动切换。图片用于说明产品设计目标。

## 桌面版最终提示词

```text
Use case: infographic-diagram, visual simplification.
Image 1 is the EDIT TARGET, a Chinese learning comparison infographic. The user now wants LOWER INFORMATION DENSITY, much more ABSTRACT SIMPLE ICONS, and ZERO small decorations around elements or in the background. Substantially simplify this image. Output one 1536x1024 landscape image.

Style: contemporary, approachable, extremely airy minimal information design. Uniform solid nearly-white lavender background #fbfaff. Muted plum regular-weight Chinese sans-serif typography, weight 400, headings no heavier than 500. Thin understated lavender curved arrows. Tiny simple rounded single-line icons, all one muted purple color. No gradients, no texture, no shadows, no organic color blobs, no flowers, no leaves as edge decorations, no stars, no sparkle marks, no confetti, no hills, no decorative dashes, no background motifs. No filled cards, pills, bars, circles or badge containers. ALL space outside functional content is completely empty.

Keep only TWO clearly separated horizontal learning paths:
Upper heading exact text "依赖 AI 直接给答案". Below it, a sparse simple horizontal flow with ONLY the text "提出问题" → "AI 生成答案" → "拿到答案". No icons in this upper path. No subtitle "过程由 AI 完成". Use subtle grey-lavender thin arrows and regular text.
Lower heading exact text "在查问试改中掌握能力". Beneath it four evenly spaced stations LEFT TO RIGHT, connected by thin smooth arrows. Each station has one TINY ABSTRACT OUTLINE icon, and one single Chinese character beneath it:
查: an abstract open-book outline in 4–5 simple strokes, no magnifying glass, no page detail.
问: an abstract rounded conversation bubble with one simple question mark, no extra bubbles.
试: a tiny simple sprout outline consisting of one stem and two smooth leaves, no pot, soil, detail or scenery.
改: a minimal diagonal pencil outline, no page, eraser or markings.
Node labels ONLY "查", "问", "试", "改", no subtitles. These labels must be regular/medium weight, never heavy black.
Connect 查 → 问 → 试 → 改, with one thin gently curved return arrow from 改 below back to 查, no label on the return arrow.
At the bottom, a SINGLE clean outcome line "知识内化 · 能力掌握". No additional outcome labels, no backdrop container.

Typography, spacing and arrows carry the composition, not big illustrations. Very generous whitespace. The image must feel light and friendly, not technical, not industrial, not formally corporate, not cute sticker art. Functional icons are small abstract glyphs rather than illustrations. Render ONLY the exact allowed text above, correct simplified Chinese. No other text or decorative elements.
```

## 手机端最终提示词

```text
Use case: infographic-diagram, visual simplification.
Image 1 is the old portrait EDIT TARGET. Image 2 is the NEW MINIMAL LANDSCAPE STYLE REFERENCE; match its very airy, pared-back line-graphic design precisely. Output one 1024 x 1536 portrait image.

The user's latest request: lower information density; abstract simple icons; no small decorations around elements and no background decoration. Use a uniform solid nearly-white lavender background #fbfaff. Muted plum regular Chinese sans-serif, weight 400; headings max 500. Tiny simple outline glyphs and very thin curved lavender arrows. No texture, gradient, shadows, color blobs, enclosing circles/cards, pastel pills, stars, confetti, sprout decoration, leaves around the edges, sparkles, hills or background motifs. Empty areas MUST stay completely empty.

Top section: readable two-line heading "依赖 AI" / "直接给答案". Under it a compact horizontal three-label path "提出问题" → "AI 生成答案" → "拿到答案", text only, no icons or filled containers. Keep labels large enough to read at 340 CSS pixels wide. Do NOT include the old subtitle "过程由 AI 完成".

Lower section: two-line heading "在查问试改中" / "掌握能力".
Arrange four small line icons and labels in a spacious two-by-two CLOCKWISE loop:
Top left: a very simple open-book outline, label only "查" underneath.
Top right: one outline conversation bubble with one question mark, label only "问" underneath.
Bottom right: a minimal sprout with one stem and two leaves, label only "试" underneath.
Bottom left: a minimal diagonal pencil outline, label only "改" underneath.
Use these icons as functional symbols, all one understated purple; no page illustration, magnifier, soil, pot, extra bubbles or backdrop. Tiny smooth arrows show 查 → 问 → 试 → 改 → 查. Preserve the correct directions. No return-arrow label. No node subtitles.
Bottom: a single clean outcome line "知识内化 · 能力掌握", regular weight, no enclosing box and no further labels.
Constraints: Render ONLY the exact specified Chinese text. Meaning and Chinese correct. Much less text than Image 1, no auxiliary explanatory phrases. Text and functional arrows are the hierarchy. Simple contemporary friendly line artwork, no industrial look, no childish decorations. Keep balanced safe margins and generous whitespace.
```
