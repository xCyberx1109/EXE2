import { Loader2 } from 'lucide-react';
import { DataTablePagination } from './DataTablePagination';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
  } | null;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  error,
  emptyMessage = 'Không có dữ liệu',
  pagination,
  onPageChange,
  onPageSizeChange,
}: DataTableProps<T>) {
  const colSpan = columns.length;

  return (
    <>
      <div className="overflow-auto rounded-lg border border-border bg-background shadow-sm">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-100 dark:bg-zinc-800 border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-4 py-2.5
                    text-left
                    text-[11px]
                    font-semibold
                    uppercase
                    tracking-wider
                    text-slate-600
                    dark:text-slate-400
                    whitespace-nowrap
                    ${col.headerClassName || ''}
                  `}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border bg-white dark:bg-card">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Đang tải...
                  </p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="py-10 text-center text-sm text-destructive"
                >
                  {error}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="
                    transition-colors duration-150
                    hover:bg-slate-50
                    dark:hover:bg-zinc-800/60
                  "
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`
                        px-4
                        py-2.5
                        text-sm
                        text-slate-700
                        dark:text-slate-200
                        whitespace-nowrap
                        ${col.className || ''}
                      `}
                    >
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && onPageChange && onPageSizeChange && (
        <div className="mt-3 flex-shrink-0">
          <DataTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.limit}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </>
  );
}