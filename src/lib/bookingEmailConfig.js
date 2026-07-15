export const BOOKING_EMAIL_TEMPLATE_META = {
  studentConfirmed: { label: "學生｜預約確認", tokens: ["studentName", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  studentRescheduled: { label: "學生｜預約改期", tokens: ["studentName", "oldDate", "oldStartTime", "oldEndTime", "date", "startTime", "endTime", "planName"] },
  studentCancelled: { label: "學生｜預約取消", tokens: ["studentName", "date", "startTime", "endTime", "planName"] },
  studentInactive: { label: "學生｜兩週未預約", tokens: ["studentName", "daysSinceLastClass", "lastClassDate", "bookingUrl"] },
  coachConfirmed: { label: "教練｜新預約", tokens: ["eventLabel", "studentName", "contactEmail", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  coachRescheduled: { label: "教練｜預約改期", tokens: ["eventLabel", "studentName", "contactEmail", "oldDate", "oldStartTime", "oldEndTime", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  coachCancelled: { label: "教練｜預約取消", tokens: ["eventLabel", "studentName", "contactEmail", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
};

export const DEFAULT_BOOKING_EMAIL_CONFIG = {
  enabled: false,
  inactivityEnabled: false,
  dailyLimit: 20,
  coachTo: "broudes@gmail.com",
  coachBcc: ["chobitsgl1@gmail.com", "beluga0109@gmail.com"],
  templates: {
    studentConfirmed: { subject: "catGROUP 預約確認｜{{date}} {{startTime}}", text: "{{studentName}} 您好，\n\n您的預約已確認。\n日期：{{date}}\n時間：{{startTime}}－{{endTime}}\n方案：{{planName}}\n\n如需異動，請回到預約頁面操作。" },
    studentRescheduled: { subject: "catGROUP 預約改期完成｜{{date}} {{startTime}}", text: "{{studentName}} 您好，\n\n您的預約已改期。\n原時段：{{oldDate}} {{oldStartTime}}－{{oldEndTime}}\n新時段：{{date}} {{startTime}}－{{endTime}}\n方案：{{planName}}" },
    studentCancelled: { subject: "catGROUP 預約已取消｜{{date}} {{startTime}}", text: "{{studentName}} 您好，\n\n您的預約已取消。\n日期：{{date}}\n時間：{{startTime}}－{{endTime}}\n方案：{{planName}}" },
    studentInactive: { subject: "catGROUP｜好久不見，回來預約練習吧", text: "{{studentName}} 您好，\n\n距離您上次完成課程已經 {{daysSinceLastClass}} 天。\n上次上課日期：{{lastClassDate}}\n\n期待再次與您一起練習！\n預約網址：{{bookingUrl}}" },
    coachConfirmed: { subject: "新預約｜{{studentName}}｜{{date}} {{startTime}}", text: "事件：{{eventLabel}}\n學生：{{studentName}}\nEmail：{{contactEmail}}\n日期：{{date}}\n時間：{{startTime}}－{{endTime}}\n方案：{{planName}}\n人數：{{participantCount}}\n來源：{{source}}" },
    coachRescheduled: { subject: "預約改期｜{{studentName}}｜{{date}} {{startTime}}", text: "事件：{{eventLabel}}\n學生：{{studentName}}\nEmail：{{contactEmail}}\n原時段：{{oldDate}} {{oldStartTime}}－{{oldEndTime}}\n新時段：{{date}} {{startTime}}－{{endTime}}\n方案：{{planName}}\n人數：{{participantCount}}\n來源：{{source}}" },
    coachCancelled: { subject: "預約取消｜{{studentName}}｜{{date}} {{startTime}}", text: "事件：{{eventLabel}}\n學生：{{studentName}}\nEmail：{{contactEmail}}\n已取消：{{date}} {{startTime}}－{{endTime}}\n方案：{{planName}}\n人數：{{participantCount}}\n來源：{{source}}" },
  },
};

export const BOOKING_EMAIL_SAMPLE = {
  eventLabel: "新預約", studentName: "測試學生", contactEmail: "student@example.com",
  date: "2026-07-20", startTime: "10:00", endTime: "11:00", planName: "單人一般",
  participantCount: "1", source: "online", oldDate: "2026-07-19", oldStartTime: "09:00",
  oldEndTime: "10:00", daysSinceLastClass: "14", lastClassDate: "2026-07-06",
  bookingUrl: "https://student.catgroup.com.tw/",
};

export function mergeBookingEmailConfig(value = {}) {
  return {
    ...DEFAULT_BOOKING_EMAIL_CONFIG,
    ...value,
    coachBcc: Array.isArray(value.coachBcc) ? value.coachBcc : DEFAULT_BOOKING_EMAIL_CONFIG.coachBcc,
    templates: Object.fromEntries(Object.keys(BOOKING_EMAIL_TEMPLATE_META).map(id => [
      id, { ...DEFAULT_BOOKING_EMAIL_CONFIG.templates[id], ...(value.templates?.[id] || {}) },
    ])),
  };
}

export function renderBookingEmailPreview(value) {
  return String(value || "").replace(/{{([A-Za-z][A-Za-z0-9]*)}}/g, (_, key) => BOOKING_EMAIL_SAMPLE[key] ?? "");
}
