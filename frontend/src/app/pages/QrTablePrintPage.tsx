import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

import { qrMenuApi } from '../api/services';

type QrTableItem = {
  tableId: string;
  tableCode: string;
  tableName: string | null;
  token: string;
};

export function QrTablePrintPage() {
  const [items, setItems] = useState<QrTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    qrMenuApi
      .listTableLinks()
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không thể tải QR bàn');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .qr-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .qr-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-lg font-bold text-foreground">In QR theo bàn</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            In mã QR để khách quét và gọi món bằng điện thoại
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-black px-3 py-2 text-sm font-semibold text-white"
        >
          <Printer className="size-4" />
          In QR
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Đang tải...</p>}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Chưa có bàn nhà hàng để tạo QR.
        </div>
      )}

      <div className="qr-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const qrUrl = `${window.location.origin}/qrmenu?t=${encodeURIComponent(item.token)}`;

          return (
            <div
              key={item.tableId}
              className="qr-card rounded-xl border bg-white p-5 text-center"
            >
              <div className="text-lg font-bold text-black">
                {item.tableName || item.tableCode}
              </div>
              <div className="mb-3 text-sm text-gray-500">{item.tableCode}</div>

              <div className="flex justify-center">
                <QRCodeCanvas value={qrUrl} size={180} includeMargin />
              </div>

              <p className="mt-2 text-sm text-gray-700">Quét mã để gọi món</p>

              <a
                href={qrUrl}
                target="_blank"
                rel="noreferrer"
                className="no-print mt-3 block text-sm font-medium text-blue-600 hover:underline"
              >
                Mở thử trang gọi món
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
