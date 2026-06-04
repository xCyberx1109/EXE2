import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Button } from '../../app/components/ui/button';
import { Badge } from '../../app/components/ui/badge';
import { Input } from '../../app/components/ui/input';
import { useAuth } from '../../app/context/AuthContext';
import { useNavigate } from 'react-router';
import { ShoppingCart, Printer, QrCode, Split, DollarSign, Search, Plus, Minus, Trash2 } from 'lucide-react';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface TabInfo {
  id: string;
  tableNumber: string;
  tableId?: string;
  items: CartItem[];
  subtotal: number;
}

const INITIAL_TABLES: TabInfo[] = [
  { id: '1', tableNumber: 'A1', items: [], subtotal: 0 },
  { id: '2', tableNumber: 'A2', items: [], subtotal: 0 },
  { id: '3', tableNumber: 'B1', items: [], subtotal: 0 },
  { id: '4', tableNumber: 'B2', items: [], subtotal: 0 },
];

export function CashierPOS() {
  const { hasDevicePermission, branchInfo } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableIdParam = searchParams.get('tableId');
  const tableCodeParam = searchParams.get('tableCode');

  const [activeTab, setActiveTab] = useState<'order' | 'payment' | 'receipt'>('order');
  const [tables, setTables] = useState<TabInfo[]>(INITIAL_TABLES);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(tableIdParam);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (tableIdParam && tableCodeParam) {
      const exists = tables.find((t) => t.id === tableIdParam);
      if (!exists) {
        const newTable: TabInfo = {
          id: tableIdParam,
          tableNumber: tableCodeParam,
          tableId: tableIdParam,
          items: [],
          subtotal: 0,
        };
        setTables((prev) => [...prev, newTable]);
        setSelectedTable(tableIdParam);
        setSelectedTableId(tableIdParam);
      } else {
        setSelectedTable(tableIdParam);
        setSelectedTableId(tableIdParam);
      }
    }
  }, [tableIdParam, tableCodeParam]);

  const canProcessPayment = hasDevicePermission('payment:process');
  const canSplitBill = hasDevicePermission('bill:split');
  const canPrintReceipt = hasDevicePermission('receipt:print');

  const currentTab = tables.find((t) => t.id === selectedTable);

  return (
    <div className="h-full overflow-y-auto">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Chọn bàn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => {
                    setSelectedTable(table.id);
                    setSelectedTableId(table.tableId || null);
                  }}
                  className={`p-3 rounded-lg text-center font-medium text-sm transition-colors ${
                    selectedTable === table.id
                      ? 'bg-blue-600 text-white'
                      : table.items.length > 0
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {table.tableNumber}
                  {table.items.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {table.items.reduce((s, i) => s + i.quantity, 0)}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tìm món</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Nhập tên món..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Giỏ hàng</span>
              {currentTab && <Badge>Bàn {currentTab.tableNumber}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!currentTab ? (
              <p className="text-sm text-gray-400 text-center py-8">Chọn bàn để bắt đầu</p>
            ) : currentTab.items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Giỏ hàng trống</p>
            ) : (
              <div className="space-y-2">
                {currentTab.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.price.toLocaleString()}đ x {item.quantity}
                      </p>
                    </div>
                    <div className="text-sm font-bold">
                      {(item.price * item.quantity).toLocaleString()}đ
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold text-base border-t">
                  <span>Tổng</span>
                  <span>{currentTab.subtotal.toLocaleString()}đ</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          {canProcessPayment && (
            <Button className="w-full" size="lg" disabled={!currentTab || currentTab.items.length === 0}>
              <DollarSign className="w-4 h-4 mr-2" />
              Thanh toán
            </Button>
          )}
          {canSplitBill && (
            <Button variant="outline" className="w-full" disabled={!currentTab || currentTab.items.length === 0}>
              <Split className="w-4 h-4 mr-2" />
              Chia hóa đơn
            </Button>
          )}
          {canPrintReceipt && (
            <Button variant="outline" className="w-full">
              <Printer className="w-4 h-4 mr-2" />
              In hóa đơn
            </Button>
          )}
          <Button variant="outline" className="w-full">
            <QrCode className="w-4 h-4 mr-2" />
            QR Payment
          </Button>
        </div>
      </div>
    </div>
    </div>
  );
}
