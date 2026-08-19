export function BuiltByRaafat({
  className = "text-[11px] text-muted-foreground",
  linkClassName = "font-semibold hover:text-foreground transition-colors",
}) {
  return (
    <p className={className}>
      Built by{" "}
      <a
        href="https://raafat.site"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        RAAFAT-Technolgies
      </a>
    </p>
  );
}
