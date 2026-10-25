/**
 * JSON-LD structured data, derived from the registry so it can never drift
 * from the visible content. Rendered by server components; Next injects
 * raw script tags without escaping the JSON.
 */
export function StructuredData({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
