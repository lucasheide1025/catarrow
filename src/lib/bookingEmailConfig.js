export const BOOKING_EMAIL_COPY_VERSION = 2;

export const BOOKING_EMAIL_TEMPLATE_META = {
  studentConfirmed: { label: "學生｜預約確認", tokens: ["studentName", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  studentRescheduled: { label: "學生｜預約改期", tokens: ["studentName", "oldDate", "oldStartTime", "oldEndTime", "date", "startTime", "endTime", "planName"] },
  studentCancelled: { label: "學生｜預約取消", tokens: ["studentName", "date", "startTime", "endTime", "planName"] },
  studentInactive: { label: "學生｜兩週未預約", tokens: ["studentName", "daysSinceLastClass", "lastClassDate", "bookingUrl"] },
  studentDayBefore: { label: "學生｜課前一天提醒", tokens: ["studentName", "date", "startTime", "endTime", "planName", "participantCount", "source", "bookingUrl"] },
  coachConfirmed: { label: "教練｜新預約", tokens: ["eventLabel", "studentName", "contactEmail", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  coachRescheduled: { label: "教練｜預約改期", tokens: ["eventLabel", "studentName", "contactEmail", "oldDate", "oldStartTime", "oldEndTime", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  coachCancelled: { label: "教練｜預約取消", tokens: ["eventLabel", "studentName", "contactEmail", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
};

export const DEFAULT_BOOKING_EMAIL_CONFIG = {
  copyVersion: BOOKING_EMAIL_COPY_VERSION,
  enabled: false,
  inactivityEnabled: false,
  dayBeforeEnabled: false,
  dailyLimit: 20,
  dayBeforeDailyLimit: 50,
  coachTo: "broudes@gmail.com",
  coachBcc: ["chobitsgl1@gmail.com", "beluga0109@gmail.com"],
  templates: {
    studentConfirmed: { subject: "catGROUP 預約確認｜{{date}} {{startTime}}", text: "{{studentName}} 您好，\n\n您的預約已確認。\n\n上課日期：{{date}}\n上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n\n如需改期或取消，請回到預約頁面操作。" },
    studentRescheduled: { subject: "catGROUP 預約改期完成｜{{date}} {{startTime}}", text: "{{studentName}} 您好，\n\n您的預約已完成改期。\n\n原上課時間：{{oldDate}} {{oldStartTime}}－{{oldEndTime}}\n新上課時間：{{date}} {{startTime}}－{{endTime}}\n課程方案：{{planName}}\n\n請依新的日期與時間前來上課。" },
    studentCancelled: { subject: "catGROUP 預約已取消｜{{date}} {{startTime}}", text: "{{studentName}} 您好，\n\n您的預約已取消。\n\n原上課日期：{{date}}\n原上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n\n若需要其他時段，歡迎重新預約。" },
    studentInactive: { subject: "catGROUP｜好久不見，回來預約練習吧", text: "{{studentName}} 您好，\n\n距離您上次上課已經 {{daysSinceLastClass}} 天，好久不見！\n\n上次上課日期：{{lastClassDate}}\n\n期待再次與您一起練習，歡迎回來預約課程：\n{{bookingUrl}}" },
    studentDayBefore: { subject: "catGROUP｜明天上課提醒｜{{date}} {{startTime}}", text: "{{studentName}} 您好，\n\n提醒您明天有預約課程。\n\n上課日期：{{date}}\n上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n\n請記得準時前來，期待與您見面！\n預約頁面：{{bookingUrl}}" },
    coachConfirmed: { subject: "catGROUP 新增預約通知｜{{studentName}}｜{{date}} {{startTime}}", text: "已為「{{studentName}}」新增預約。\n\n上課日期：{{date}}\n上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n預約方式：{{source}}\n聯絡信箱：{{contactEmail}}\n\n請至 catGROUP 教練後台查看完整預約資料。" },
    coachRescheduled: { subject: "catGROUP 預約改期通知｜{{studentName}}｜{{date}} {{startTime}}", text: "「{{studentName}}」的預約已完成改期。\n\n原上課時間：{{oldDate}} {{oldStartTime}}－{{oldEndTime}}\n新上課時間：{{date}} {{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n預約方式：{{source}}\n聯絡信箱：{{contactEmail}}\n\n請至 catGROUP 教練後台查看完整預約資料。" },
    coachCancelled: { subject: "catGROUP 預約取消通知｜{{studentName}}｜{{date}} {{startTime}}", text: "「{{studentName}}」的預約已取消。\n\n原上課日期：{{date}}\n原上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n預約方式：{{source}}\n聯絡信箱：{{contactEmail}}\n\n請至 catGROUP 教練後台查看完整預約資料。" },
  },
};

export const BOOKING_EMAIL_SAMPLE = {
  eventLabel: "新預約", studentName: "測試學生", contactEmail: "student@example.com",
  date: "2026年7月20日", startTime: "上午10:00", endTime: "上午11:00", planName: "單人一般",
  participantCount: "1人", source: "學生線上約課", oldDate: "2026年7月19日", oldStartTime: "上午9:00",
  oldEndTime: "上午10:00", daysSinceLastClass: "14", lastClassDate: "2026年7月6日",
  bookingUrl: "https://student.catgroup.com.tw/",
};

export function mergeBookingEmailConfig(value = {}) {
  const acceptsStoredTemplates = value.copyVersion === BOOKING_EMAIL_COPY_VERSION;
  return {
    ...DEFAULT_BOOKING_EMAIL_CONFIG,
    ...value,
    copyVersion: BOOKING_EMAIL_COPY_VERSION,
    coachBcc: Array.isArray(value.coachBcc) ? value.coachBcc : DEFAULT_BOOKING_EMAIL_CONFIG.coachBcc,
    templates: Object.fromEntries(Object.keys(BOOKING_EMAIL_TEMPLATE_META).map(id => [
      id, acceptsStoredTemplates
        ? { ...DEFAULT_BOOKING_EMAIL_CONFIG.templates[id], ...(value.templates?.[id] || {}) }
        : { ...DEFAULT_BOOKING_EMAIL_CONFIG.templates[id] },
    ])),
  };
}

export function renderBookingEmailPreview(value) {
  return String(value || "").replace(/{{([A-Za-z][A-Za-z0-9]*)}}/g, (_, key) => BOOKING_EMAIL_SAMPLE[key] ?? "");
}
