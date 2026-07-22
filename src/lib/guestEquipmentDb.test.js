import { GUEST_COMMON_EQUIPMENT } from "./guestEquipmentCatalog";
test("QR seeded UI catalog mirrors the server guest common catalog",()=>{
  expect(GUEST_COMMON_EQUIPMENT).toHaveLength(9);
  expect(GUEST_COMMON_EQUIPMENT.map(item=>item.price)).toEqual([200,200,200,180,180,180,150,150,150]);
  expect(GUEST_COMMON_EQUIPMENT.some(item=>item.slotId==="bow")).toBe(false);
});
