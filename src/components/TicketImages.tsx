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
          {/* Ticket images are same-origin WebP or the configured R2 host. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={alt} />
        </a>
      ))}
    </div>
  );
}
