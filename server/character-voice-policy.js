// One audio identity for DOMI, including conversation and saved word cards.
export const DOMI_WORD_VOICE_SOURCE = "domi-word-tts-v1";
export const DOMI_WORD_VOICE_ID = "zh_male_naiqimengwa_uranus_bigtts";
export const DOMI_PLAYBACK_RATE = 1.5;

export function isDomiWordVoice(message) {
  return message?.character === "lvdou" && message?.voiceSource === DOMI_WORD_VOICE_SOURCE;
}

export function configureCharacterPlayback(audio, character) {
  const rate = character === "lvdou" ? DOMI_PLAYBACK_RATE : 1;
  audio.defaultPlaybackRate = rate;
  audio.playbackRate = rate;
  audio.preservesPitch = true;
}
