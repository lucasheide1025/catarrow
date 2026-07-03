export const DUNGEON_TARGET_FORMATS = [
  { id:"full_110", label:"全靶", sub:"1-10 環" },
  { id:"half_610", label:"半靶", sub:"6-10 環" },
  { id:"field_16", label:"原野", sub:"1-6 環" },
];

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
