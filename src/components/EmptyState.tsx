import Link from "next/link";

export function EmptyState({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="card empty-state">
      <p>{title}</p>
      {body ? <p className="muted">{body}</p> : null}
      {href && action ? (
        <Link href={href} className="btn btn-primary">
          {action}
        </Link>
      ) : null}
    </div>
  );
}
