// Script to update collectVillageResources and add setBuildingAllocation in db.js
var fs = require('fs');

var filePath = 'src/lib/db.js';
var s = fs.readFileSync(filePath, 'utf8');

// Build the new function as a plain string to avoid backtick issues
var newFnLines = [
'export async function collectVillageResources(memberId, village) {',
'  var now = Date.now();',
'  var lastMs = village?.lastCollectedAt?.toMillis?.() || (now - 3600000);',
'  var hours = Math.min((now - lastMs) / 3600000, MAX_COLLECT_HOURS);',
'  if (hours < 0.05) return { collected: {}, hours: 0 };',
'',
'  var buildings    = village?.buildings    || {};',
'  var allocations  = village?.allocations  || {};',
'  var collected    = {};',
'  var updates      = { "village.lastCollectedAt": serverTimestamp() };',
'',
'  for (var id of BUILDING_LIST) {',
'    if (!isBuildingUnlocked(id, buildings)) continue;',
'    var lv     = buildings[id] || 1;',
'    var res    = VB[id]?.resource;',
'    if (!res) continue;',
'',
'    // Gacha: accumulate to top-level gachaCoins',
'    if (id === "gacha") {',
'      var fracKey  = "gachaTokenFrac";',
'      var prevFrac = village?.resources?.[fracKey] || 0;',
'      var rawAmt   = getProductionRate(id, lv) * hours + prevFrac;',
'      var amt      = Math.floor(rawAmt);',
'      var remain   = Math.round((rawAmt - amt) * 1000) / 1000;',
'      updates["village.resources." + fracKey] = remain;',
'      if (amt > 0) {',
'        updates.gachaCoins = increment(amt);',
'        collected.gachaCoins = (collected.gachaCoins || 0) + amt;',
'      }',
'      continue;',
'    }',
'',
'    var rate    = getProductionRate(id, lv);',
'    var maxTier = getBuildingStage(lv);',
'',
'    if (!TIERED_RESOURCES.has(res)) {',
'      // Non-tiered resources (arrowdew etc.)',
'      var resKey  = res;',
'      var fracKey = resKey + "Frac";',
'      var prevFrac = village?.resources?.[fracKey] || 0;',
'      var rawAmt   = rate * hours + prevFrac;',
'      var amt      = Math.floor(rawAmt);',
'      var remain   = Math.round((rawAmt - amt) * 1000) / 1000;',
'      updates["village.resources." + fracKey] = remain;',
'      if (amt > 0) {',
'        updates["village.resources." + resKey] = increment(amt);',
'        collected[resKey] = (collected[resKey] || 0) + amt;',
'      }',
'    } else {',
'      // Tiered resources: pool * stageMult, split by allocation%',
'      var stageMult = getStageMultiplier(lv);',
'      var pool      = rate * stageMult * hours;',
'      var alloc     = allocations[id] || getDefaultAllocation(lv);',
'',
'      // Calculate per-tier raw values (including fraction carryover)',
'      var tierRaw = {};',
'      for (var tier = 1; tier <= maxTier; tier++) {',
'        var pct    = alloc[String(tier)] || 0;',
'        if (pct <= 0) continue;',
'        var resKey2  = getResourceKey(res, tier);',
'        var fracKey2 = resKey2 + "Frac";',
'        var prevFrac2 = village?.resources?.[fracKey2] || 0;',
'        var rawAmt2   = pool * (pct / 100) + prevFrac2;',
'        tierRaw[String(tier)] = { resKey: resKey2, fracKey: fracKey2, rawAmt: rawAmt2 };',
'      }',
'',
'      // Write updates',
'      var tierKeys = Object.keys(tierRaw);',
'      for (var ti = 0; ti < tierKeys.length; ti++) {',
'        var t = tierKeys[ti];',
'        var item = tierRaw[t];',
'        var amt2 = Math.floor(item.rawAmt);',
'        var remain2 = Math.round((item.rawAmt - amt2) * 1000) / 1000;',
'        updates["village.resources." + item.fracKey] = remain2;',
'        if (amt2 > 0) {',
'          updates["village.resources." + item.resKey] = increment(amt2);',
'          collected[item.resKey] = (collected[item.resKey] || 0) + amt2;',
'        }',
'      }',
'    }',
'  }',
'',
'  await updateDoc(doc(db, C.members, memberId), updates);',
'  var curResources = Object.assign({}, village?.resources || {});',
'  Object.keys(collected).forEach(function(k) { curResources[k] = (curResources[k] || 0) + collected[k]; });',
'  return { collected: collected, resources: curResources, hours: hours };',
'}',
'',
'// ── Set per-building allocation ────────────────────────────',
'export async function setBuildingAllocation(memberId, buildingId, allocation) {',
'  if (!memberId || !buildingId || !allocation) return;',
'  await setDoc(doc(db, C.members, memberId), {',
'    ["village.allocations." + buildingId]: allocation,',
'  }, { merge: true });',
'}'
].join('\n');

// Find the function start and end
var fnStart = s.indexOf('export async function collectVillageResources(memberId, village) {');
if (fnStart === -1) {
  console.log('ERROR: Could not find collectVillageResources');
  process.exit(1);
}

// Find the next export after this function
var fnEndSearch = s.indexOf('\nexport', fnStart + 10);
// If not found, find the function end by brace matching
if (fnEndSearch === -1) {
  // Find the closing brace of the function - simplified: look for "}\n\n" or "}\n//"
  fnEndSearch = s.indexOf('\n}\n\n', fnStart);
  var fnEndSearch2 = s.indexOf('\n}//', fnStart);
  if (fnEndSearch === -1 || (fnEndSearch2 !== -1 && fnEndSearch2 < fnEndSearch)) {
    // Try other patterns
    var fnEndSearch3 = s.indexOf('\n}\n', fnStart + 100);
    if (fnEndSearch3 !== -1) fnEndSearch = fnEndSearch3;
  }
}

if (fnEndSearch === -1) {
  console.log('ERROR: Could not find end of collectVillageResources');
  process.exit(1);
}

// Find the end of the closing brace line
var fnEnd = s.indexOf('\n', fnEndSearch + 1);
if (fnEnd === -1) fnEnd = s.length;

var before = s.substring(0, fnStart);
var after = s.substring(fnEnd);

var result = before + newFnLines + after;
fs.writeFileSync(filePath, result);
console.log('collectVillageResources replaced successfully');
console.log('Old version was ' + (fnEnd - fnStart) + ' chars, new version is ' + newFnLines.length + ' chars');

// Verify the file was written correctly
var verify = fs.readFileSync(filePath, 'utf8');
if (verify.includes('setBuildingAllocation')) {
  console.log('setBuildingAllocation function exists in output');
} else {
  console.log('WARNING: setBuildingAllocation not found!');
}
