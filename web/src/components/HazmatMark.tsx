export function HazmatMark({ className = "" }: { className?: string }) {
  return <img className={`object-contain ${className}`} src="/logo.png" alt="Hazmat" />;
}
