export function resolveGuestEntry(searchParams) {
  if (searchParams.has("kid")) {
    const rawSessionId = (searchParams.get("kid") || "").trim();
    return { accountType:"kid", sessionSourceId:rawSessionId && rawSessionId !== "1" ? rawSessionId : null };
  }
  if (searchParams.has("guest")) return { accountType:"guest", sessionSourceId:null };
  return null;
}
