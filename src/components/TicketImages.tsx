export function TicketImages({
  items,
  alt,
}: {
  items: { id: string; url: string }[];
  alt: string;
}) {
  if (!items.length) return null;
  return (
    <div className="attach-row">
      {items.map((item) => (
        <a key={item.id} href={item.url}>
          {/* Authenticated same-origin WebP. The route checks the ticket owner or an admin. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={alt} width={120} height={90} />
        </a>
      ))}
    </div>
  );
}
