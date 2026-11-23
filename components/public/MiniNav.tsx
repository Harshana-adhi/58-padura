"use client";

import { useEffect, useState } from "react";

export function MiniNav() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <nav className="sticky top-0 z-10 flex justify-center gap-6 bg-stage/95 py-2 text-sm text-stage-muted ring-1 ring-stage-border backdrop-blur">
      <a href="#now" className="hover:text-stage-foreground">
        Now
      </a>
      <a href="#up-next" className="hover:text-stage-foreground">
        Up next
      </a>
      <a href="#full-agenda" className="hover:text-stage-foreground">
        Agenda
      </a>
    </nav>
  );
}
