import { battleBowLabel, loadBattleShootingProfile } from "./battlePractice";

export function worldBossWeaponLabel(profile, memberId, shooting = loadBattleShootingProfile(memberId)) {
  const configured = (profile?.equipment || []).find(item => item?.id === shooting.bowId);
  if (configured?.label?.trim()) return configured.label.trim();
  return battleBowLabel(shooting.bowType);
}
