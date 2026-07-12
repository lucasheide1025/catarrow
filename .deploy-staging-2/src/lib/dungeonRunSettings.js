import { TARGET_FACE_FORMATS } from "./targetFace";

export const DUNGEON_TARGET_FORMATS = TARGET_FACE_FORMATS.map(format => ({
  id:format.id,
  label:format.shortLabel,
  sub:format.sub,
}));

export const DEFAULT_DUNGEON_ARROWS = 6;
export const DEFAULT_DUNGEON_TARGET = "full_110";

export function normalizeDungeonRunSettings(settings = {}) {
  return {
    arrowsPerRound: [3, 6].includes(settings.arrowsPerRound)
      ? settings.arrowsPerRound
      : DEFAULT_DUNGEON_ARROWS,
    targetFmt: DUNGEON_TARGET_FORMATS.some(format => format.id === settings.targetFmt)
      ? settings.targetFmt
      : DEFAULT_DUNGEON_TARGET,
  };
}

export function getDungeonTargetLabel(targetFmt) {
  return DUNGEON_TARGET_FORMATS.find(format => format.id === targetFmt)?.label
    || DUNGEON_TARGET_FORMATS[0].label;
}
