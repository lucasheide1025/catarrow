// Interaction pattern adapted from React Bits (MIT): https://github.com/DavidHDev/react-bits
// Rewritten for touch fallback, RAF cleanup, and existing project styling.
import { useEffect, useRef } from "react";
import "./reactBits.css";

export default function SpotlightCard({ children, className = "", color = "rgba(251,191,36,.16)", as: Tag = "div", style, ...props }) {
  const ref = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function handlePointerMove(event) {
    if (event.pointerType === "touch") return;
    cancelAnimationFrame(frameRef.current);
    const { clientX, clientY } = event;
    frameRef.current = requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      node.style.setProperty("--rb-spot-x", `${clientX - rect.left}px`);
      node.style.setProperty("--rb-spot-y", `${clientY - rect.top}px`);
    });
  }

  return (
    <Tag ref={ref} className={`rb-spotlight-card ${className}`}
      style={{ "--rb-spot-color": color, ...style }} onPointerMove={handlePointerMove} {...props}>
      {children}
    </Tag>
  );
}
