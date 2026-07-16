import FadeContent from "../react-bits/FadeContent";
import "./DungeonEventStage.css";

const TONES = {
  event: { accent:"#fbbf24", glow:"rgba(251,191,36,.24)", border:"rgba(251,191,36,.25)" },
  trap: { accent:"#fb923c", glow:"rgba(251,146,60,.24)", border:"rgba(251,146,60,.25)" },
  rest: { accent:"#34d399", glow:"rgba(52,211,153,.22)", border:"rgba(52,211,153,.24)" },
  chest: { accent:"#facc15", glow:"rgba(250,204,21,.24)", border:"rgba(250,204,21,.25)" },
  path: { accent:"#818cf8", glow:"rgba(129,140,248,.24)", border:"rgba(129,140,248,.25)" },
};

export default function DungeonEventStage({ children, tone = "event", className = "" }) {
  const colors = TONES[tone] || TONES.event;
  return (
    <div className={`dungeon-event-stage dungeon-event-stage--${tone} ${className}`}
      style={{
        "--dungeon-event-accent": colors.accent,
        "--dungeon-event-glow": colors.glow,
        "--dungeon-event-border": colors.border,
      }}>
      <div className="dungeon-event-stage__scene" aria-hidden="true" />
      <div className="dungeon-event-stage__atmosphere" aria-hidden="true" />
      <FadeContent className="dungeon-event-stage__content">{children}</FadeContent>
    </div>
  );
}
