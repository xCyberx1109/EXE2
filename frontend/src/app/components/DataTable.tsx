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
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-muted-foreground">
                  <Loader2 className="inline h-6 w-6 animate-spin" />
                  <span className="ml-2">Đang tải...</span>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-destructive">
                  {error}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={keyExtractor(item)} className="hover:bg-accent transition">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-sm ${col.className || 'text-foreground'}`}>
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
        <div className="flex-shrink-0">
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
