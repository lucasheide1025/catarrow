// Interaction pattern adapted from React Bits (MIT): https://github.com/DavidHDev/react-bits
// Rewritten for this project without animation-library dependencies.
import { useEffect, useState } from "react";
import "./reactBits.css";

export default function FadeContent({ children, className = "", delay = 0, as: Tag = "div" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Tag className={`rb-fade-content ${visible ? "is-visible" : ""} ${className}`}
      style={{ "--rb-fade-delay": `${Math.max(0, delay)}ms` }}>
      {children}
    </Tag>
  );
}
