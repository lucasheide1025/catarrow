import { formatQrRemaining, getGuestEquipmentPageAction, getGuestNavTab, getQrTimeState, GUEST_SHELL_TABS } from "./guestShellState";
test("guest shell has exactly four persistent destinations", () => {
  expect(GUEST_SHELL_TABS).toEqual(["home", "adventure", "inventory", "equipment"]);
  expect(getGuestNavTab("worldboss")).toBe("adventure");
  expect(getGuestNavTab("practice")).toBe("home");
});
test("equipment actions stay in the embedded shop and ignore unsupported routes", () => {
  expect(getGuestEquipmentPageAction("coinshop")).toBe("equipment");
  expect(getGuestEquipmentPageAction("inventory-hub")).toBe("home");
  expect(getGuestEquipmentPageAction("gacha")).toBeNull();
});
test("QR countdown exposes warning, notification and expiry boundaries", () => {
  const now = 1000;
  expect(getQrTimeState(now + 11 * 60_000, now)).toMatchObject({ warning:false, notifyTwoMinutes:false, expired:false });
  expect(getQrTimeState(now + 10 * 60_000, now)).toMatchObject({ warning:true, notifyTwoMinutes:false });
  expect(getQrTimeState(now + 2 * 60_000, now)).toMatchObject({ warning:true, notifyTwoMinutes:true });
  expect(getQrTimeState(now, now).expired).toBe(true);
  expect(formatQrRemaining(101 * 60_000)).toBe("1:41");
});
