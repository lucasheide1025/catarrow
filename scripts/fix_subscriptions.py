#!/usr/bin/env python3
"""Replace onSnapshot with getDoc in subscribe functions + add return data for write functions."""

import re

def fix_db_js():
    with open('src/lib/db.js', 'r', encoding='utf-8') as f:
        content = f.read()

    changes_made = []

    # 1. subscribeMaterials → getDoc
    old = '''export function subscribeMaterials(memberId, callback) {
  return onSnapshot(
    doc(db, C_MATERIALS, memberId),
    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),
    err  => { console.warn("subscribeMaterials:", err.message); callback({}); }
  );
}'''
    new = '''export function subscribeMaterials(memberId, callback) {
  getDoc(doc(db, C_MATERIALS, memberId)).then(
    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),
    err  => { console.warn("subscribeMaterials:", err.message); callback({}); }
  );
  return () => {};
}'''
    if old in content:
        content = content.replace(old, new)
        changes_made.append("subscribeMaterials")
        print("[OK] subscribeMaterials -> getDoc")
    else:
        print("[FAIL] subscribeMaterials not found")

    # 2. subscribeChests → getDoc
    old = '''export function subscribeChests(memberId, callback) {
  return onSnapshot(
    doc(db, C_CHESTS, memberId),
    snap => callback(snap.exists() ? (snap.data().chests || []) : []),
    err  => { console.warn("subscribeChests:", err.message); callback([]); }
  );
}'''
    new = '''export function subscribeChests(memberId, callback) {
  getDoc(doc(db, C_CHESTS, memberId)).then(
    snap => callback(snap.exists() ? (snap.data().chests || []) : []),
    err  => { console.warn("subscribeChests:", err.message); callback([]); }
  );
  return () => {};
}'''
    if old in content:
        content = content.replace(old, new)
        changes_made.append("subscribeChests")
        print("[OK] subscribeChests -> getDoc")
    else:
        print("[FAIL] subscribeChests not found")

    # 3. subscribeFragments → getDoc
    old = '''export function subscribeFragments(memberId, callback) {
  return onSnapshot(
    doc(db, C_FRAGS, memberId),
    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),
    err  => { console.warn("subscribeFragments:", err.message); callback({}); }
  );
}'''
    new = '''export function subscribeFragments(memberId, callback) {
  getDoc(doc(db, C_FRAGS, memberId)).then(
    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),
    err  => { console.warn("subscribeFragments:", err.message); callback({}); }
  );
  return () => {};
}'''
    if old in content:
        content = content.replace(old, new)
        changes_made.append("subscribeFragments")
        print("[OK] subscribeFragments -> getDoc")
    else:
        print("[FAIL] subscribeFragments not found")

    # 4. subscribeMonsterDex → getDoc
    old = '''export function subscribeMonsterDex(memberId, callback) {
  return onSnapshot(
    doc(db, C_MONSTER_DEX, memberId),
    snap => callback(snap.exists() ? (snap.data().monsters || {}) : {}),
    err  => { console.warn("subscribeMonsterDex:", err.message); callback({}); }
  );
}'''
    new = '''export function subscribeMonsterDex(memberId, callback) {
  getDoc(doc(db, C_MONSTER_DEX, memberId)).then(
    snap => callback(snap.exists() ? (snap.data().monsters || {}) : {}),
    err  => { console.warn("subscribeMonsterDex:", err.message); callback({}); }
  );
  return () => {};
}'''
    if old in content:
        content = content.replace(old, new)
        changes_made.append("subscribeMonsterDex")
        print("[OK] subscribeMonsterDex -> getDoc")
    else:
        print("[FAIL] subscribeMonsterDex not found")

    # 5. upgradeMaterial: add inventory to return
    old = '''    await setDoc(ref, { items: inventory, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true, from: mat, to: target };'''
    new = '''    await setDoc(ref, { items: inventory, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true, from: mat, to: target, inventory };'''
    if old in content:
        content = content.replace(old, new)
        changes_made.append("upgradeMaterial return inventory")
        print("[OK] upgradeMaterial returns inventory")
    else:
        print("[FAIL] upgradeMaterial return not found")

    # 6. craftFragment: add fragments to return
    old = '''    await setDoc(fragRef, { items, updatedAt: serverTimestamp() }, { merge: true });
    // 2. 更新 member badge（badgeField = "fatCat" | "score" | "achievement"）
    const memRef = doc(db, "members", memberId);
    await updateDoc(memRef, { [`${badgeField}.${badgeLevel}`]: increment(1) });
    await updateCraftStats(memberId, "frag", { fragId }).catch(() => {});
    return { ok: true, label };'''
    new = '''    await setDoc(fragRef, { items, updatedAt: serverTimestamp() }, { merge: true });
    // 2. 更新 member badge（badgeField = "fatCat" | "score" | "achievement"）
    const memRef = doc(db, "members", memberId);
    await updateDoc(memRef, { [`${badgeField}.${badgeLevel}`]: increment(1) });
    await updateCraftStats(memberId, "frag", { fragId }).catch(() => {});
    return { ok: true, label, fragments: items };'''
    if old in content:
        content = content.replace(old, new)
        changes_made.append("craftFragment return fragments")
        print("[OK] craftFragment returns fragments")
    else:
        print("[FAIL] craftFragment return not found")

    # 7. openChest: add updatedChests to all returns
    # First, add the updatedChests variable after the setDoc + before coin check
    old = '''    await setDoc(ref, { chests: list.filter(c => c.id !== chestId), updatedAt: serverTimestamp() }, { merge: true });

    if (chest.type === "coin") {'''
    new = '''    const updatedChests = list.filter(c => c.id !== chestId);
    await setDoc(ref, { chests: updatedChests, updatedAt: serverTimestamp() }, { merge: true });

    if (chest.type === "coin") {'''
    if old in content:
        content = content.replace(old, new)
        print("[OK] openChest added updatedChests variable")
    else:
        print("[FAIL] openChest variable insertion not found")

    # Coin chest return
    old = '''      return { ok: true, coins };
    }'''
    new = '''      return { ok: true, coins, chests: updatedChests };
    }'''
    if old in content:
        content = content.replace(old, new)
        print("[OK] openChest coin case returns chests")
    else:
        print("[FAIL] openChest coin return not found")

    # Mimi box return
    old = '''      return { ok: true, catResult: catRes };
    }'''
    new = '''      return { ok: true, catResult: catRes, chests: updatedChests };
    }'''
    if old in content:
        content = content.replace(old, new)
        print("[OK] openChest mimi case returns chests")
    else:
        print("[FAIL] openChest mimi return not found")

    # Material chest return
    old = '''    return { ok: true, coins: contents?.coins };'''
    new = '''    return { ok: true, coins: contents?.coins, chests: updatedChests };'''
    if old in content:
        content = content.replace(old, new)
        print("[OK] openChest material case returns chests")
    else:
        print("[FAIL] openChest material return not found")

    with open('src/lib/db.js', 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"\nTotal changes: {len(changes_made)}")
    return changes_made

if __name__ == '__main__':
    fix_db_js()
