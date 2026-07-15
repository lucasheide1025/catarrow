#!/usr/bin/env python3
"""Add missing getMonthlyCardConfig/saveMonthlyCardConfig/_logMonthlyCard
and refresh helper functions to db.js (handles \r\n line endings)."""

def fix():
    with open('src/lib/db.js', 'r', encoding='utf-8') as f:
        content = f.read()

    changes = 0

    # 1. Add refresh helper functions before "/* ═══════════════ 怪物圖鑑"
    old_marker = "// ─── 怪物圖鑑 ──────────────────────────────────────────────"
    refresh_helpers = '// ── 重新讀取輔助 ───────────────────────────────────────────\r\n'
    refresh_helpers += 'export function refreshMaterials(memberId, callback) {\r\n'
    refresh_helpers += '  getDoc(doc(db, C_MATERIALS, memberId)).then(\r\n'
    refresh_helpers += '    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),\r\n'
    refresh_helpers += '    () => callback({})\r\n'
    refresh_helpers += '  );\r\n'
    refresh_helpers += '}\r\n'
    refresh_helpers += 'export function refreshFragments(memberId, callback) {\r\n'
    refresh_helpers += '  getDoc(doc(db, C_FRAGS, memberId)).then(\r\n'
    refresh_helpers += '    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),\r\n'
    refresh_helpers += '    () => callback({})\r\n'
    refresh_helpers += '  );\r\n'
    refresh_helpers += '}\r\n'
    refresh_helpers += 'export function refreshPotions(memberId, callback) {\r\n'
    refresh_helpers += '  getDoc(doc(db, C_POTIONS, memberId)).then(\r\n'
    refresh_helpers += '    snap => {\r\n'
    refresh_helpers += '      const data = snap.exists() ? snap.data() : {};\r\n'
    refresh_helpers += '      const migrated = migratePotionInventory(data);\r\n'
    refresh_helpers += '      callback(migrated.items);\r\n'
    refresh_helpers += '      if (migrated.migrated) {\r\n'
    refresh_helpers += '        setDoc(doc(db, C_POTIONS, memberId), {\r\n'
    refresh_helpers += '          items: migrated.items,\r\n'
    refresh_helpers += '          catalogVersion: migrated.catalogVersion,\r\n'
    refresh_helpers += '          updatedAt: serverTimestamp(),\r\n'
    refresh_helpers += '        }, { merge: true }).catch(e => console.warn("migratePotionInventory:", e?.message));\r\n'
    refresh_helpers += '      }\r\n'
    refresh_helpers += '    },\r\n'
    refresh_helpers += '    () => callback({})\r\n'
    refresh_helpers += '  );\r\n'
    refresh_helpers += '}\r\n'
    refresh_helpers += '\r\n'

    if old_marker in content:
        content = content.replace(old_marker, refresh_helpers + old_marker)
        changes += 1
        print("[OK] Added refresh helper functions")
    else:
        # Try with \r\n for raw comparison
        print(f"[FAIL] monster dex marker not found (looking for: {repr(old_marker[:30])})")
        # Find the marker position
        idx = content.find("怪物圖鑑")
        if idx >= 0:
            print(f"  Found 怪物圖鑑 at position {idx}")
            print(f"  Context: {repr(content[idx-5:idx+15])}")
        else:
            print("  怪物圖鑑 not found anywhere")

    # 2. Add monthly card functions before "// ── 月卡申請與審核流程"
    # Let's find the exact text around submitMonthlyCardRequest
    markers_to_try = [
        "// ── 月卡申請與審核流程",
    ]

    monthly_card_start = '// ─── 月卡系統 ────────────────────────────────────────────────\r\n'
    monthly_card_start += 'const C_MONTHLY        = "monthlyCardRequests";\r\n'
    monthly_card_start += 'const C_MONTHLY_CONFIG = "monthlyCardConfig";\r\n'
    monthly_card_start += 'const C_MONTHLY_LOGS   = "monthlyCardLogs";\r\n'
    monthly_card_start += '\r\n'
    monthly_card_start += '// 月卡設定（後台設定次數 / 天數）\r\n'
    monthly_card_start += 'export async function getMonthlyCardConfig() {\r\n'
    monthly_card_start += '  try {\r\n'
    monthly_card_start += '    const snap = await getDoc(doc(db, C_MONTHLY_CONFIG, "default"));\r\n'
    monthly_card_start += '    if (snap.exists()) return snap.data();\r\n'
    monthly_card_start += '  } catch {}\r\n'
    monthly_card_start += '  return { sessions: 16, validDays: 60 };\r\n'
    monthly_card_start += '}\r\n'
    monthly_card_start += 'export async function saveMonthlyCardConfig(cfg, operatorId) {\r\n'
    monthly_card_start += '  await setDoc(doc(db, C_MONTHLY_CONFIG, "default"),\r\n'
    monthly_card_start += '    { ...cfg, updatedAt: serverTimestamp(), operatorId }, { merge: true });\r\n'
    monthly_card_start += '}\r\n'
    monthly_card_start += '\r\n'
    monthly_card_start += '// 內部：寫入月卡操作記錄（append-only）\r\n'
    monthly_card_start += 'async function _logMonthlyCard(memberId, memberName, action, delta, note, operatorId) {\r\n'
    monthly_card_start += '  try {\r\n'
    monthly_card_start += '    await addDoc(collection(db, C_MONTHLY_LOGS), {\r\n'
    monthly_card_start += '      memberId, memberName, action, delta, note,\r\n'
    monthly_card_start += '      operatorId: operatorId || null,\r\n'
    monthly_card_start += '      createdAt: serverTimestamp(),\r\n'
    monthly_card_start += '    });\r\n'
    monthly_card_start += '  } catch {}\r\n'
    monthly_card_start += '}\r\n'
    monthly_card_start += '\r\n'

    found_monthly_marker = False
    for marker in markers_to_try:
        if marker in content:
            content = content.replace(marker, monthly_card_start + marker)
            changes += 1
            found_monthly_marker = True
            print(f"[OK] Added monthly card functions before '{marker}'")
            break

    if not found_monthly_marker:
        print("[FAIL] Monthly card marker not found. Looking for alternatives...")
        # Try finding a nearby function - subscribeMonthlyCardLogs
        idx = content.find("export function subscribeMonthlyCardLogs")
        if idx >= 0:
            print(f"  Found subscribeMonthlyCardLogs at {idx}")
            # Insert before subscribeMonthlyCardLogs
            content = content[:idx] + monthly_card_start + content[idx:]
            changes += 1
            print("[OK] Added monthly card functions before subscribeMonthlyCardLogs")
        else:
            print("  Cannot find insertion point for monthly card functions")

    with open('src/lib/db.js', 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"\nTotal changes: {changes}")

if __name__ == '__main__':
    fix()
