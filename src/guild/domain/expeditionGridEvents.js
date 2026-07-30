// src/guild/domain/expeditionGridEvents.js
// 公會單人遠征的路線整備資料。這一層只描述路線，不發放或修改獎勵。

export function resolveTier(contract = {}) {
  const danger = Number(contract.danger);
  if (Number.isFinite(danger)) return Math.max(1, Math.min(6, Math.floor(danger)));

  const skullCount = typeof contract.skulls === "string"
    ? [...contract.skulls].filter(char => char === "★" || char === "☠").length
    : 0;
  return Math.max(1, Math.min(6, skullCount || 1));
}

export function generateExpeditionMapNodes(expedition = {}) {
  const totalWaves = Math.max(1, expedition.waves?.length || expedition.totalWaves || 1);
  const nodes = [{ id: "node_0", type: "start", label: "公會出發點", icon: "🚩" }];
  let seed = Array.from(String(expedition.id || "")).reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 0);

  for (let waveIndex = 0; waveIndex < totalWaves; waveIndex += 1) {
    const isFinalWave = waveIndex === totalWaves - 1;
    seed = (Math.imul(seed || 1, 1664525) + 1013904223) >>> 0;
    const landmarkType = seed % 5 === 0 ? "ambush" : seed % 2 === 0 ? "event" : "treasure";
    nodes.push({
      id: `node_${nodes.length}`,
      type: landmarkType === "ambush" ? "event" : landmarkType,
      eventKind: landmarkType,
      label: landmarkType === "ambush" ? "危險動靜" : landmarkType === "event" ? "未知區域" : "遠征遺跡",
      icon: landmarkType === "ambush" ? "❗" : landmarkType === "event" ? "❓" : "📦",
      waveIndex,
    });
    nodes.push({
      id: `node_${nodes.length}`,
      type: isFinalWave ? "boss" : "battle",
      label: isFinalWave ? "最終遠征目標" : "未知遭遇",
      icon: isFinalWave ? "👑" : "⚔️",
      waveIndex,
      avoidable: !isFinalWave && landmarkType !== "ambush",
    });
  }

  return nodes;
}

function journeyPhaseFor(node) {
  if (!node) return "complete";
  if (node.type === "event" || node.type === "treasure") return "event";
  if (node.type === "battle" || node.type === "boss") return "battle";
  return "map";
}

export function createExpeditionJourney(expedition = {}) {
  return {
    nodes: generateExpeditionMapNodes(expedition),
    nodeIndex: 0,
    phase: "map",
    waveIndex: null,
    routeSeed: expedition.id || "legacy-route",
    revealedThrough: 1,
  };
}

export function advanceExpeditionJourney(journey) {
  const nodes = journey?.nodes || [];
  const nodeIndex = Math.min(nodes.length - 1, Math.max(0, (journey?.nodeIndex || 0) + 1));
  const node = nodes[nodeIndex];
  return {
    ...journey,
    nodeIndex,
    phase: journeyPhaseFor(node),
    waveIndex: Number.isInteger(node?.waveIndex) ? node.waveIndex : null,
    revealedThrough: Math.max(journey?.revealedThrough || 1, nodeIndex + 1),
  };
}

export function completeExpeditionJourneyBattle(journey) {
  if (journey?.phase !== "battle") return journey;
  return { ...journey, phase: "map" };
}
