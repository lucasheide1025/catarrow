// Durable class-end retry orchestration. The local arrow-operation queue and the
// shop's Firestore checkpoint are the durable state; no additional marker or
// per-arrow write is needed.
export async function settleClassEndRushAward(memberId, { flushArrows, claimRush }) {
  if (!memberId) return { pending:false, awardedSeconds:0, isReplay:true };
  const flush = await flushArrows(memberId);
  if ((Number(flush?.pending) || 0) > 0 || flush?.blocked) {
    return {
      pending:true,
      reason:"arrow_flush_pending",
      pendingArrows:Number(flush?.pending) || 0,
      lastError:flush?.lastError || null,
    };
  }
  const award = await claimRush(memberId);
  return { pending:false, ...award };
}

export async function completeClassEndRushFlow({ persistClassEnd, settleRush }) {
  await persistClassEnd();
  return settleRush();
}
