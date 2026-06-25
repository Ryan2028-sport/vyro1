import { useEffect, useState, useCallback } from "react";
import { VyroLogo } from "./VyroLogo";

const slides = [
  "/onboarding/gravity lifestyle 1-1LG8bEuk.png",
  "/onboarding/PDP_Navigator_Evergr-jcYqI868.png",
  "/onboarding/PDP_Navigator_Evergr-Z3hIaRdY.png",
];

export function WelcomeScreen({
  onJoin,
  onLogin,
  onSkip,
}: {
  onJoin: () => void;
  onLogin: () => void;
  onSkip: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const advance = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, []);

  useEffect(() => {
    const iv = setInterval(advance, 4000);
    return () => clearInterval(iv);
  }, [advance]);

  return (
    <div className="relative flex h-screen w-full flex-col bg-[#f2f2f2]">
      {/* Image carousel — top 2/3 */}
      <div className="relative flex-[2] overflow-hidden">
        {slides.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === current ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {/* Gradient overlay fading into white */}
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[#f2f2f2] via-[#f2f2f2]/80 to-transparent" />

        {/* Slide indicators */}
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 bg-gray-900"
                  : "w-1.5 bg-gray-900/20"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Bottom section — 1/3 */}
      <div
        className={`flex flex-1 flex-col items-center px-6 pb-10 pt-2 transition-all duration-700 ${
          loaded
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0"
        }`}
      >
        <VyroLogo className="mb-6 w-[140px]" />

        <div className="flex w-full max-w-sm flex-col gap-3">
          <button
            onClick={onJoin}
            className="h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors active:bg-gray-800"
          >
            Join for Free
          </button>
          <button
            onClick={onLogin}
            className="h-[52px] w-full rounded-2xl border border-gray-300 bg-white/60 text-[15px] font-semibold text-gray-900 transition-colors active:bg-white/80"
          >
            Log In
          </button>
        </div>

        {/* TODO(temp): Remove skip button before production launch */}
        <button
          onClick={onSkip}
          className="mt-4 text-[13px] text-gray-400 transition-colors hover:text-gray-600"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
