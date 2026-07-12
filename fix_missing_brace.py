import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The issue: endBattle function is missing its closing } before handleMBBattleEnd
# Current pattern:
#     } catch {
#       setPhase(result === "win" ? "loot" : "result");
#     }
#   
#   // BattleScreen callback...
#   function handleMBBattleEnd(result) {
#
# Fix: Add a } after the catch block to close endBattle

old = '''      await delay(1000); setPhase("result");\n    }\n    } catch {\n      setPhase(result === "win" ? "loot" : "result");\n    }\n\n  // BattleScreen callback'''

new = '''      await delay(1000); setPhase("result");\n    }\n    } catch {\n      setPhase(result === "win" ? "loot" : "result");\n    }\n  }\n\n  // BattleScreen callback'''

if old in content:
    content = content.replace(old, new, 1)
    with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("[OK] Added missing } to close endBattle function")
else:
    print("[WARN] Pattern not found - checking for current state")
    # Show what's around the transition
    idx = content.find('// BattleScreen callback')
    if idx >= 0:
        before = content[max(0,idx-80):idx]
        print(f"Before marker: {repr(before)}")
        # Check if a } already exists
        if before.rstrip().endswith('}'):
            print("Closing brace already present!")
        else:
            print("Missing closing brace!")
    else:
        print("Could not find marker")
