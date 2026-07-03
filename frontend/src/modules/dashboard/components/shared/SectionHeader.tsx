import { Link } from 'react-router';

export function SectionHeader({
  title, actionLabel, actionHref, children,
}: {
  title: string; actionLabel?: string; actionHref?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <h2 className="text-xs font-semibold text-foreground">{title}</h2>
      <div className="flex items-center gap-1">
        {children}
        {actionLabel && actionHref && (
          <Link to={actionHref} className="text-xs text-primary hover:text-primary/80 font-medium">
            {actionLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}
