import { Link } from 'react-router';

export function SectionHeader({
  title, actionLabel, actionHref, children,
}: {
  title: string; actionLabel?: string; actionHref?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex items-center gap-3">
        {children}
        {actionLabel && actionHref && (
          <Link to={actionHref} className="text-sm text-primary hover:text-primary/80 font-medium">
            {actionLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}
