# scripts/insert_milestone_fn.py
"""Insert checkAndGrantArrowMilestones() into db.js before grantArrowMilestoneRewards."""
import re

# Try different encodings
for enc in ['utf-8', 'latin-1', 'cp1252']:
    try:
        with open("src/lib/db.js", "r", encoding=enc) as f:
            content = f.read()
        print(f"Opened with encoding: {enc}")
        break
    except UnicodeDecodeError:
        continue
else:
    print("ERROR: could not decode db.js")
    exit(1)

anchor = '// milestones: getMilestonesReached() 回傳的陣列\nexport async function grantArrowMilestoneRewards(memberId, milestones) {'
if anchor not in content:
    # Try with CRLF
    anchor2 = anchor.replace('\n', '\r\n')
    if anchor2 in content:
        print("Found with CRLF")
        anchor = anchor2
    else:
        # Search for nearby string
        idx = content.find("grantArrowMilestoneRewards")
        if idx >= 0:
            print(f"Found at index {idx}")
            # Get surrounding context
            ctx = content[idx-80:idx+80]
            print(f"Context: {repr(ctx)}")
        else:
            print("ERROR: grantArrowMilestoneRewards not found!")
            exit(1)

new_fn = '''// ── 共用箭數里程碑檢查（取代各模式各自傳入 0 導致每日重複跳出的 bug）──
// 自動查詢今日練習紀錄的實際累計箭數，正確計算穿越了哪些門檻
export async function checkAndGrantArrowMilestones(memberId, sessionArrowCount) {
  if (!memberId || !sessionArrowCount || sessionArrowCount <= 0 || memberId.startsWith("guest")) {
    return { milestones: [] };
  }
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  let todayTotal = 0;
  try {
    const snap = await getDocs(query(
      collection(db, C.practiceLogs),
      where("memberId", "==", memberId),
      where("date", "==", today)
    ));
    for (const doc of snap.docs) {
      const log = doc.data();
      let rounds = [];
      if (log.roundsString) {
        try { rounds = JSON.parse(log.roundsString); } catch {}
      }
      if (log.rounds) rounds = log.rounds;
      if (Array.isArray(rounds)) {
        const arrowsInLog = rounds.flat().filter(v => typeof v === "number" || v === "M").length;
        todayTotal += arrowsInLog;
      }
    }
  } catch (e) {
    console.warn("checkAndGrantArrowMilestones: query failed", e?.message);
  }
  const beforeSession = Math.max(0, todayTotal - (sessionArrowCount || 0));
  const { getMilestonesReached } = await import("./arrowMilestone");
  const milestones = getMilestonesReached(beforeSession, todayTotal);
  if (milestones.length > 0) {
    await grantArrowMilestoneRewards(memberId, milestones).catch(() => {});
  }
  return { milestones, beforeSession, afterSession: todayTotal };
}

''' + anchor

count = content.count(anchor)
if count == 0:
    print(f"ERROR: anchor not found in content! Lines matching 'milestones':")
    for i, line in enumerate(content.split('\n')):
        if 'milestones' in line:
            print(f"  Line {i}: {line[:100]}")
    exit(1)

content = content.replace(anchor, new_fn, 1)

with open("src/lib/db.js", "w", encoding=enc) as f:
    f.write(content)

print(f"SUCCESS: checkAndGrantArrowMilestones inserted into db.js (replaced 1 occurrence)")
