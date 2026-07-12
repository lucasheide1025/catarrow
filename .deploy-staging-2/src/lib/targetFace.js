// Shared target-face geometry and raw archery scoring.
// Combat conversion belongs in score.js / damage.js, never in this module.

const TARGET_COLORS = {
  10:{ fill:"#facc15", stroke:"#ca8a04" },
  9: { fill:"#facc15", stroke:"#ca8a04" },
  8: { fill:"#ef4444", stroke:"#b91c1c" },
  7: { fill:"#ef4444", stroke:"#b91c1c" },
  6: { fill:"#38bdf8", stroke:"#0284c7" },
  5: { fill:"#38bdf8", stroke:"#0284c7" },
  4: { fill:"#171717", stroke:"#525252" },
  3: { fill:"#171717", stroke:"#525252" },
  2: { fill:"#f5f5f4", stroke:"#a8a29e" },
  1: { fill:"#f5f5f4", stroke:"#a8a29e" },
};

const FIELD_COLORS = {
  6:{ fill:"#facc15", stroke:"#ca8a04" },
  5:{ fill:"#facc15", stroke:"#ca8a04" },
  4:{ fill:"#171717", stroke:"#525252" },
  3:{ fill:"#171717", stroke:"#525252" },
  2:{ fill:"#171717", stroke:"#525252" },
  1:{ fill:"#171717", stroke:"#525252" },
};

export const TARGET_FACE_FORMATS = [
  {
    id:"full_110",
    label:"122cm 十環全靶",
    shortLabel:"122cm 全靶",
    sub:"1-10 環",
    faceSizeCm:122,
    minScore:1,
    maxScore:10,
    layout:"single",
    innerTenRatio:0.05,
    colors:TARGET_COLORS,
  },
  {
    id:"compound_510",
    label:"80cm 六環靶",
    shortLabel:"80cm 六環",
    sub:"5-10 環",
    faceSizeCm:80,
    minScore:5,
    maxScore:10,
    layout:"single",
    // The visible edge is the 5-ring (48 cm diameter); X is 4 cm.
    innerTenRatio:1 / 12,
    colors:TARGET_COLORS,
  },
  {
    id:"indoor_40",
    label:"40cm 十環單靶",
    shortLabel:"40cm 單靶",
    sub:"1-10 環",
    faceSizeCm:40,
    minScore:1,
    maxScore:10,
    layout:"single",
    innerTenRatio:0.05,
    colors:TARGET_COLORS,
  },
  {
    id:"half_610",
    label:"40cm 五環單靶",
    shortLabel:"40cm 五環",
    sub:"6-10 環",
    faceSizeCm:40,
    minScore:6,
    maxScore:10,
    layout:"single",
    // Combined indoor face: compound inner ten inside the recurve ten.
    innerTenRatio:0.1,
    colors:TARGET_COLORS,
  },
  {
    id:"triple",
    label:"40cm 直式三連靶",
    shortLabel:"40cm 三連靶",
    sub:"6-10 環",
    faceSizeCm:40,
    minScore:6,
    maxScore:10,
    layout:"vertical_triple",
    innerTenRatio:0.1,
    colors:TARGET_COLORS,
  },
  {
    id:"field_16",
    label:"原野靶",
    shortLabel:"原野靶",
    sub:"1-6 環",
    faceSizeCm:null,
    minScore:1,
    maxScore:6,
    layout:"single",
    innerTenRatio:null,
    colors:FIELD_COLORS,
  },
];

const LEGACY_TARGET_ALIASES = {
  indoor_610:"half_610",
};

export function normalizeTargetFormatId(formatId) {
  const normalized = LEGACY_TARGET_ALIASES[formatId] || formatId;
  return TARGET_FACE_FORMATS.some(format => format.id === normalized)
    ? normalized
    : "full_110";
}

export function getTargetFaceFormat(formatId) {
  const normalized = normalizeTargetFormatId(formatId);
  return TARGET_FACE_FORMATS.find(format => format.id === normalized)
    || TARGET_FACE_FORMATS[0];
}

export function getTargetRings(formatId) {
  const format = getTargetFaceFormat(formatId);
  const zoneCount = format.maxScore - format.minScore + 1;
  const rings = [];
  for (let score = format.minScore; score <= format.maxScore; score += 1) {
    const radius = (format.maxScore - score + 1) / zoneCount;
    rings.push({
      score,
      radius,
      ...(format.colors[score] || TARGET_COLORS[score]),
    });
  }
  return rings;
}

export function resolveTargetHit(formatId, nx, ny) {
  const format = getTargetFaceFormat(formatId);
  const ratio = Math.sqrt(nx ** 2 + ny ** 2);
  if (!Number.isFinite(ratio) || ratio > 1) {
    return { label:"M", rawScore:0, ratio };
  }

  const zoneCount = format.maxScore - format.minScore + 1;
  const zone = ratio === 0 ? 0 : Math.ceil((ratio - Number.EPSILON) * zoneCount);
  const rawScore = Math.max(format.minScore, format.maxScore - zone + 1);
  const label = format.innerTenRatio != null && ratio <= format.innerTenRatio
    ? "X"
    : String(rawScore);
  return { label, rawScore, ratio };
}

export function getTargetScoreLabels(formatId) {
  const format = getTargetFaceFormat(formatId);
  const labels = [];
  if (format.innerTenRatio != null) labels.push("X");
  for (let score = format.maxScore; score >= format.minScore; score -= 1) {
    labels.push(String(score));
  }
  labels.push("M");
  return labels;
}

export function makeLandingRecord(formatId, nx, ny, faceIndex = 0) {
  const format = getTargetFaceFormat(formatId);
  const hit = resolveTargetHit(format.id, nx, ny);
  return {
    label:hit.label,
    rawScore:hit.rawScore,
    nx,
    ny,
    faceIndex,
    targetFormat:format.id,
  };
}
