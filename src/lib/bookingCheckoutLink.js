export function checkinMatchesBooking(booking, checkin, resolvedCheckinId = null) {
  if (!booking?.id || !checkin) return false;
  if (checkin.bookingId) return checkin.bookingId === booking.id;
  return !!(
    booking.checkinId &&
    resolvedCheckinId &&
    booking.checkinId === resolvedCheckinId
  );
}

export function checkinAllowsRegularCheckout(booking, checkin, resolvedCheckinId = null) {
  return !!checkin?.classEnded && checkinMatchesBooking(booking, checkin, resolvedCheckinId);
}

export function billingRecordMatchesBooking(booking, record) {
  if (!booking?.id || !record) return false;
  if (record.bookingId) return record.bookingId === booking.id;
  return !!(
    booking.checkinId &&
    record.checkinId &&
    booking.checkinId === record.checkinId
  );
}

function within(time, booking) {
  return !!time && !!booking?.startTime && !!booking?.endTime && booking.startTime <= time && time < booking.endTime;
}

// Legacy checkin 沒有 bookingId 時，只在「明確唯一」的情況自動補連動。
// 同日多筆又無法靠 checkinId/時間唯一辨識時，必須回 null，不能猜最近一筆。
export function selectLegacyBookingForCheckin(bookings, { memberId, checkinId = null, checkinTime = null, nowTime = null } = {}) {
  const candidates = (bookings || []).filter(booking =>
    booking?.memberId === memberId &&
    ["confirmed", "completed"].includes(booking.status) &&
    !booking.billingRecordId
  );
  if (!candidates.length) return null;

  if (checkinId) {
    const linked = candidates.filter(booking => booking.checkinId === checkinId);
    if (linked.length === 1) return linked[0];
    if (linked.length > 1) return null;
  }

  if (checkinTime) {
    const inCheckinWindow = candidates.filter(booking => within(checkinTime, booking));
    if (inCheckinWindow.length === 1) return inCheckinWindow[0];
    // 已知實際報到時間卻對不到唯一課次時，不可再拿「現在時間」猜另一筆。
    return null;
  }

  if (nowTime) {
    const inCurrentWindow = candidates.filter(booking => within(nowTime, booking));
    if (inCurrentWindow.length === 1) return inCurrentWindow[0];
    if (inCurrentWindow.length > 1) return null;
  }

  return candidates.length === 1 ? candidates[0] : null;
}
