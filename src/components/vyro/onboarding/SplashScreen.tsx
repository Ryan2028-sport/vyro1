import { useEffect, useState } from "react";
import { VyroLogo } from "./VyroLogo";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 2000);
    const nav = setTimeout(onComplete, 2500);
    return () => {
      clearTimeout(timer);
      clearTimeout(nav);
    };
  }, [onComplete]);

  return (
    <div
      className={`flex h-screen w-full items-center justify-center bg-white transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <VyroLogo className="w-[180px] animate-in fade-in zoom-in-95 duration-700" />
    </div>
  );
}
