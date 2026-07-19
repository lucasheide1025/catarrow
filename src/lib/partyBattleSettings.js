const TARGET_FORMATS = new Set(["full_110", "half_610", "field_16"]);
const INPUT_MODES = new Set(["button", "target"]);

export function normalizePartyBattleSettings(room, localFallback = {}) {
  const arrowsPerRound = room?.arrowsPerRound === 3 ? 3 : 6;
  const targetFormat = TARGET_FORMATS.has(room?.targetFormat)
    ? room.targetFormat
    : (TARGET_FORMATS.has(localFallback.targetFormat) ? localFallback.targetFormat : "full_110");
  const targetInputMode = INPUT_MODES.has(room?.targetInputMode)
    ? room.targetInputMode
    : (localFallback.targetInputMode === "target" ? "target" : "button");
  return { arrowsPerRound, targetFormat, targetInputMode };
}

