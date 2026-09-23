// 生成「叫叫留言」语音资源：用火山 TTS（叫叫音色）把 DEMO_LEAVE_NOTES 的文本
// 合成成 mp3 放到 public/demo-audio/ 下，供相册模拟数据的语音留言播放。
//
// 用法：
//   VOLC_TTS_API_KEY=你的Key node scripts/generate-leave-note-audio.mjs
// （无 Key 时也可复用 VOLC_SPEECH_API_KEY / VOLC_SPEECH_APP_ID+ACCESS_TOKEN）
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { getVolcTtsConfig, synthesizeSpeech } from "../server/volc-tts.js";
import { DEMO_LEAVE_NOTES } from "../src/library-demo-data.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "demo-audio");

// 凭据来源（按优先级）：
//  1. 环境变量 VOLC_TTS_API_KEY / VOLC_SPEECH_API_KEY（新版控制台单头）
//  2. 环境变量 VOLC_TTS_APP_ID+VOLC_TTS_ACCESS_KEY 或 VOLC_SPEECH_APP_ID+VOLC_SPEECH_ACCESS_TOKEN（旧版双头）

function loadLocalEnv() {
  // 查找本机其他项目里可复用的火山语音凭据（旧版双头鉴权）。
  const home = homedir();
  const candidates = [
    join(home, "VibeCoding/萌萌新的奇妙图鉴/.env.local"),
    join(home, ".codex/.chatgpt-projects/g-p-6a8c679ea01481919a02ad9b9b4df2c1/kindergrimm/.env.local"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const out = {};
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?([^"'\n]*)["']?\s*$/.exec(line);
      if (m) out[m[1]] = m[2];
    }
    if (out.VOLC_SPEECH_APP_ID && out.VOLC_SPEECH_ACCESS_TOKEN) {
      console.log(`本地凭据：${file}`);
      return out;
    }
  }
  return {};
}

const local = loadLocalEnv();
const key = process.env.VOLC_TTS_API_KEY || process.env.VOLC_SPEECH_API_KEY || "";
const appId = process.env.VOLC_TTS_APP_ID || process.env.VOLC_SPEECH_APP_ID || local.VOLC_SPEECH_APP_ID || "";
const accessKey = process.env.VOLC_TTS_ACCESS_KEY || process.env.VOLC_SPEECH_ACCESS_TOKEN || local.VOLC_SPEECH_ACCESS_TOKEN || "";
if (!key && !(appId && accessKey)) {
  console.error("缺少 TTS 凭据：请设置 VOLC_TTS_API_KEY（或 VOLC_SPEECH_API_KEY）。");
  process.exit(2);
}
const config = getVolcTtsConfig({ ...process.env, VOLC_TTS_API_KEY: key, VOLC_TTS_APP_ID: appId, VOLC_TTS_ACCESS_KEY: accessKey });

await mkdir(outDir, { recursive: true });
let ok = 0;
for (const note of DEMO_LEAVE_NOTES) {
  const slug = `leave-note-${note.dayKey}`;
  const text = String(note.text || "").replace(/\s+/g, " ").trim();
  if (!text) continue;
  try {
    const audio = await synthesizeSpeech(text, note.character || "jiaojiao", config);
    const path = join(outDir, `${slug}.mp3`);
    await writeFile(path, audio);
    console.log(`✓ ${slug}.mp3 (${audio.length} bytes)`);
    ok += 1;
  } catch (error) {
    console.error(`✗ ${slug}: ${error.message.slice(0, 140)}`);
  }
}
console.log(`done: ${ok}/${DEMO_LEAVE_NOTES.length} audio files in public/demo-audio/`);
