import re

with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# 1. Add postSubmitted state variable after potionUsedThisRound
old_state = "  const [potionUsedThisRound, setPotionUsedThisRound] = useState(false);\n\n\n  const {"
new_state = "  const [potionUsedThisRound, setPotionUsedThisRound] = useState(false);\n  // 提交後鎖定所有輸入按鈕，到下一回合開始才解鎖（防止動畫進行中玩家誤操作）\n  const [postSubmitted, setPostSubmitted] = useState(false);\n\n  const {"
content = content.replace(old_state, new_state)
print("1. Added postSubmitted state")

# 2. Set postSubmitted after successful submit
old_onsuccess = "    onSubmitSuccess: (submittedArrows) => {\n      if (myId && Array.isArray(submittedArrows) && submittedArrows.length > 0) {\n        addRoundArrows(myId, submittedArrows.length).catch(() => {});"
new_onsuccess = "    onSubmitSuccess: (submittedArrows) => {\n      setPostSubmitted(true);\n      if (myId && Array.isArray(submittedArrows) && submittedArrows.length > 0) {\n        addRoundArrows(myId, submittedArrows.length).catch(() => {});"
content = content.replace(old_onsuccess, new_onsuccess)
print("2. Added setPostSubmitted in onSubmitSuccess")

# 3. Reset postSubmitted on new round
old_round_reset = "  // 每回合開始時重置計分門禁、角色選擇、Firestore hook submitted 狀態\n  useEffect(() => {\n    setScoringReady(false);\n    setFsSubmitted(false);\n    // 從 Firestore 讀取自己目前的 role"
new_round_reset = "  // 每回合開始時重置計分門禁、角色選擇、Firestore hook submitted 狀態\n  useEffect(() => {\n    setScoringReady(false);\n    setPostSubmitted(false);\n    setFsSubmitted(false);\n    // 從 Firestore 讀取自己目前的 role"
content = content.replace(old_round_reset, new_round_reset)
print("3. Added setPostSubmitted in round reset effect")

# 4. Add postSubmitted guard to addArrow
old_addArrow = """  function addArrow(label, landing) {
    if (arrows.length >= (room?.arrowsPerRound || ARROWS_PER_ROUND) || myReady) return;"""
new_addArrow = """  function addArrow(label, landing) {
    if (arrows.length >= (room?.arrowsPerRound || ARROWS_PER_ROUND) || myReady || postSubmitted) return;"""
content = content.replace(old_addArrow, new_addArrow)
print("4. Added postSubmitted guard to addArrow")

# 5. Add postSubmitted guard to removeLastArrow
old_removeArrow = """  function removeLastArrow() {
    if (myReady) return;
    setArrows(prev => prev.slice(0, -1));"""
new_removeArrow = """  function removeLastArrow() {
    if (myReady || postSubmitted) return;
    setArrows(prev => prev.slice(0, -1));"""
content = content.replace(old_removeArrow, new_removeArrow)
print("5. Added postSubmitted guard to removeLastArrow")

# 6. Add postSubmitted guard to handleTargetSubmit
old_targetSubmit = """  function handleTargetSubmit() {
    if (targetPending) return; // 防止重複觸發疊加多個 timeout
    setTargetPending(true);
    setTimeout(() => { setTargetPending(false); handleSubmit(); }, 2000);"""
new_targetSubmit = """  function handleTargetSubmit() {
    if (postSubmitted || targetPending) return; // 防止重複觸發疊加多個 timeout
    setTargetPending(true);
    setTimeout(() => { setTargetPending(false); handleSubmit(); }, 2000);"""
content = content.replace(old_targetSubmit, new_targetSubmit)
print("6. Added postSubmitted guard to handleTargetSubmit")

# 7. Add postSubmitted guard to handlePartyScoringSubmit
old_partySubmit = """  async function handlePartyScoringSubmit(scores) {
    if (myReady || submitting) return;"""
new_partySubmit = """  async function handlePartyScoringSubmit(scores) {
    if (postSubmitted || myReady || submitting) return;"""
content = content.replace(old_partySubmit, new_partySubmit)
print("7. Added postSubmitted guard to handlePartyScoringSubmit")

# 8. Add postSubmitted guard to handleSubmit
old_handleSubmit = """  async function handleSubmit() {
    if (arrows.length < (room?.arrowsPerRound || ARROWS_PER_ROUND) || myReady || submitting) return;"""
new_handleSubmit = """  async function handleSubmit() {
    if (arrows.length < (room?.arrowsPerRound || ARROWS_PER_ROUND) || postSubmitted || myReady || submitting) return;"""
content = content.replace(old_handleSubmit, new_handleSubmit)
print("8. Added postSubmitted guard to handleSubmit")

# 9. Add postSubmitted guard to first onPotionUsed (around line 1987)
old_potion1 = """              onPotionUsed={(pid) => {
                const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(x=>x.id===pid);
                if (!p || !myId || isGuestMode) return;"""
new_potion1 = """              onPotionUsed={(pid) => {
                const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(x=>x.id===pid);
                if (!p || !myId || isGuestMode || postSubmitted) return;"""
content = content.replace(old_potion1, new_potion1)
print("9. Added postSubmitted guard to first onPotionUsed")

# 10. Add postSubmitted guard to second onPotionUsed (around line 2159)
old_potion2 = """            onPotionUsed={(potionId) => {
              const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(pp => pp.id === potionId);
              if (!p) return;"""
new_potion2 = """            onPotionUsed={(potionId) => {
              const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(pp => pp.id === potionId);
              if (!p || postSubmitted) return;"""
content = content.replace(old_potion2, new_potion2)
print("10. Added postSubmitted guard to second onPotionUsed")

# 11. Set partySubmitted to use postSubmitted for persistent overlay
old_partySubmitted = "partySubmitted={myReady}"
new_partySubmitted = "partySubmitted={myReady || postSubmitted}"
content = content.replace(old_partySubmitted, new_partySubmitted)
print("11. Updated partySubmitted to include postSubmitted for persistent lock")

with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("\nAll animation lock changes applied!")
