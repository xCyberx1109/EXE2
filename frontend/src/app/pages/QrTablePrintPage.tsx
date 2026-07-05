import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { qrMenuApi } from '../api/services';

type QrTableItem = {
  tableId: string;
  tableCode: string;
  tableName: string | null;
  token: string;
  qrUrl: string;
};

export function QrTablePrintPage() {
  const [items, setItems] = useState<QrTableItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    qrMenuApi
      .listTableLinks()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-bold">In QR theo bàn</h1>
          <p className="text-sm text-gray-500">
            In mã QR để khách quét và gọi món bằng điện thoại
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded bg-black text-white"
        >
          In QR
        </button>
      </div>

      {loading ? (
        <div>Đang tải...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.tableId} className="border rounded-xl p-4 bg-white">
  <div className="text-center mb-3">
    <div className="font-bold text-lg">
      {item.tableName || item.tableCode}
    </div>

    <div className="text-sm text-gray-500">
      {item.tableCode}
    </div>
  </div>

  <div className="flex justify-center mb-3">
    <QRCodeCanvas value={item.qrUrl} size={180} />
  </div>

  <div className="text-center text-sm">
    Quét mã để gọi món
  </div>

  <a
    href={item.qrUrl}
    target="_blank"
    rel="noreferrer"
    className="no-print mt-3 block text-center text-sm font-medium text-blue-600 hover:underline"
  >
    Mở thử trang gọi món
  </a>
</div>
          ))}
        </div>
      )}
    </div>
  );
}