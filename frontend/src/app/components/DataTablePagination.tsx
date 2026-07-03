import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from './ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface DataTablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function DataTablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  if (totalPages <= 0) return null;

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
      <div className="flex items-center justify-between gap-1 p-1.5 border-t border-border flex-wrap">
      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
        <span className="flex-shrink-0">Tổng số: {total}</span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span>/</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-7 w-10 sm:w-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>trang</span>
          </div>
        )}
      </div>

      <Pagination className="w-auto mx-0 flex-shrink-0">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(1)}
              className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            >
              <span className="sr-only">Đầu</span>
              <span aria-hidden>Đầu</span>
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>

          {getPageNumbers().map((p, idx) =>
            p === 'ellipsis' ? (
              <PaginationItem key={`e-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={() => onPageChange(p)}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(totalPages)}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            >
              <span className="sr-only">Cuối</span>
              <span aria-hidden>Cuối</span>
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
