import { useEffect, useId, useRef, useState } from "react";

type MermaidBlockProps = {
  source: string;
  className?: string;
};

export function MermaidBlock({ source, className }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const trimmed = source.trim();
    if (!trimmed) return;

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
        });
        const { svg } = await mermaid.render(`mermaid-${reactId}`, trimmed);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reactId, source]);

  if (!source.trim()) return null;

  if (error) {
    return (
      <pre className={className}>
        <code>{source}</code>
      </pre>
    );
  }

  return <div ref={containerRef} className={className} aria-label="Mermaid diagram" />;
}
