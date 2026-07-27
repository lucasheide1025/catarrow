import { getTargetFaceFormat, TARGET_FACE_FORMATS } from "../../lib/targetFace";
import { scoreToValue } from "../../lib/score";

const scoreColor = score => {
  if (score >= 9) return "#ca8a04";
  if (score >= 7) return "#dc2626";
  if (score >= 5) return "#2563eb";
  if (score >= 3) return "#171717";
  return "#64748b";
};

export const GUILD_TARGET_FACE_OPTIONS = TARGET_FACE_FORMATS.map(format => ({
  id: format.id,
  label: format.label,
  shortLabel: format.shortLabel,
}));

export function guildScoreButtons(formatId) {
  const format = getTargetFaceFormat(formatId);
  const scores = [];
  for (let score = format.maxScore; score >= format.minScore; score -= 1) {
    const label = String(score);
    scores.push({ label, rawScore: score, score: scoreToValue(label, format.id), color: scoreColor(score) });
  }
  return [
    { label: "X", rawScore: "X", score: scoreToValue("X", format.id), color: "#d97706" },
    ...scores,
    { label: "M", rawScore: "M", score: 0, color: "#334155" },
  ];
}

export function initialGuildTargetFace() {
  if (typeof window === "undefined") return "full_110";
  const saved = window.localStorage.getItem("guild_target_face");
  return TARGET_FACE_FORMATS.some(format => format.id === saved) ? saved : "full_110";
}

export function rememberGuildTargetFace(formatId) {
  if (typeof window !== "undefined") window.localStorage.setItem("guild_target_face", formatId);
}
