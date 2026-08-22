import fs from "fs";
import path from "path";

const root = path.join(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

describe("後台月卡扣除與審核", () => {
  test("月卡管理提供手動扣除次數並留下 admin_deduct 紀錄", () => {
    const admin = read("components/admin/AdminMonthlyCard.jsx");
    const db = read("lib/db.js");
    expect(admin).toContain("deductMonthlyCardSessions");
    expect(admin).toContain("➖ 扣除次數");
    expect(admin).toContain("admin_deduct");
    expect(db).toContain("export async function deductMonthlyCardSessions");
    expect(db).toContain('action:"admin_deduct"');
  });

  test("一般下課不直接修改月卡，只有後台核准才扣 sessions", () => {
    const db = read("lib/db.js");
    const classEndStart = db.indexOf("export async function submitClassEnd");
    const classEndEnd = db.indexOf("export async function retryClassEndShopRushAward", classEndStart);
    const classEnd = db.slice(classEndStart, classEndEnd);
    expect(classEnd).not.toContain("monthlyCard.sessions");
    expect(classEnd).not.toContain("class_end_use");

    const approveStart = db.indexOf("export async function approveMonthlyCardRequest");
    const approveEnd = db.indexOf("export async function rejectMonthlyCardRequest", approveStart);
    const approve = db.slice(approveStart, approveEnd);
    expect(approve).toContain('tx.update(memRef, { "monthlyCard.sessions"');
    expect(approve).toContain('action:"use_approved"');
    expect(approve).toContain("runTransaction");
  });
});
