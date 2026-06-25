export function VyroLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/onboarding/logo.jpeg"
      alt="VYRO — Own The Edge"
      className={className}
      draggable={false}
    />
  );
}
