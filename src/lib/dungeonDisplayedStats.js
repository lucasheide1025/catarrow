function positiveMultiplier(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 1;
}

function percentMultiplier(value) {
  const number = Number(value);
  return 1 + (Number.isFinite(number) ? number : 0) / 100;
}

export function calculateDungeonDisplayedStats(playerState = {}) {
  const atkBase = Math.max(0, Number(playerState.atk) || 0);
  const defBase = Math.max(0, Number(playerState.def) || 0);
  const atkMultiplier =
    positiveMultiplier(playerState.buffs?.atkMult) *
    positiveMultiplier(playerState.potionBuffs?.atkMult) *
    percentMultiplier(playerState.restBonuses?.atkPct) *
    percentMultiplier(playerState.merchantBonuses?.atkPct);
  const defMultiplier =
    positiveMultiplier(playerState.buffs?.defMult) *
    positiveMultiplier(playerState.potionBuffs?.defMult) *
    percentMultiplier(playerState.restBonuses?.defPct) *
    percentMultiplier(playerState.merchantBonuses?.defPct);

  return {
    atkBase,
    defBase,
    atk: Math.round(atkBase * atkMultiplier),
    def: Math.round(defBase * defMultiplier),
    atkPct: Math.round((atkMultiplier - 1) * 100),
    defPct: Math.round((defMultiplier - 1) * 100),
  };
}
