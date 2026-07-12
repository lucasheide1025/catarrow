import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Check line endings
crlf_count = content.count('\r\n')
lf_count = content.count('\n')
print(f"File has {crlf_count} CRLF endings, {lf_count - crlf_count} LF endings")

# Normalize to LF for searching, work with LF version
use_lf = '\n' not in content or crlf_count > lf_count
if use_lf:
    normalized = content.replace('\r\n', '\n')
else:
    normalized = content

# Now find the transition from endBattle's catch block to handleMBBattleEnd
old = '''    } catch {
      setPhase(result === "win" ? "loot" : "result");
    }
\n  // BattleScreen callback'''

new = '''    } catch {
      setPhase(result === "win" ? "loot" : "result");
    }
  }

  // BattleScreen callback'''

if old in normalized:
    normalized = normalized.replace(old, new, 1)
    print("[OK] Added missing } to close endBattle function")
    
    # Convert back to original line endings
    if use_lf:
        content = normalized.replace('\n', '\r\n') if crlf_count > 0 else normalized
    else:
        content = normalized
    
    with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("File saved")
else:
    print("[WARN] Pattern not found - checking for alternatives")
    idx = normalized.find('// BattleScreen callback')
    if idx >= 0:
        before = normalized[max(0,idx-60):idx]
        print(f"Before marker: {repr(before)}")
        # Also search for } at indent 2
        lines = normalized[:idx].split('\n')
        for j, l in enumerate(lines[-10:]):
            print(f"  ...{len(lines)-10+j+1}: {repr(l)}")
