import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.resolve(__dirname, "PublicBookingApp.jsx"), "utf8");
const appSource = fs.readFileSync(path.resolve(__dirname, "../App.jsx"), "utf8");

test("booking member center enters the Local First visitor arcade", () => {
  expect(source).toContain('window.location.href = "/?arcade"');
  expect(source).toContain("🎮 進入訪客冒險");
  expect(source).not.toContain('window.location.href = "/?guest=1"');
});

test("arcade entry does not bridge booking identity through guest_prefill", () => {
  const entryHandler = source.match(/function enterVisitorArcade\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
  expect(source).not.toContain("guest_prefill");
  expect(entryHandler).not.toContain("sessionStorage.setItem");
  expect(entryHandler).not.toMatch(/profile\.|memberDoc\./);
});

test("app routes arcade explicitly without changing the legacy guest entry", () => {
  expect(appSource).toContain('if (searchParams.has("arcade")) return <ArcadeApp />');
  expect(appSource).toContain("if (guestEntry) return <GuestApp");
  expect(appSource.indexOf('searchParams.has("arcade")')).toBeLessThan(appSource.indexOf("if (guestEntry)"));
});
