const SLOT_INDEX = {
  bow: 0, arrow: 1, absorber: 2, module: 3, chest: 4,
  arm: 5, hand: 6, nutrition: 7, quiver: 8, toolkit: 9,
};

export default function EquipmentIcon({ slotId, size = 56, className = "" }) {
  const index = SLOT_INDEX[slotId] ?? 0;
  const col = index % 5;
  const row = Math.floor(index / 5);
  return <span aria-hidden="true" className={className} style={{
    display:"block", width:size, height:size, flexShrink:0,
    backgroundImage:"url(/art/equipment/archery-equipment-icons-v1.png)",
    backgroundRepeat:"no-repeat", backgroundSize:"500% 200%",
    backgroundPosition:`${col * 25}% ${row * 100}%`,
  }} />;
}
