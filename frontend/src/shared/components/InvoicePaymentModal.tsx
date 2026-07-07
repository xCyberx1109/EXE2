import { useState } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/app/components/ui/dialog';
import { useConfirmPayment } from '@/app/api/hooks';
import type { BankAccountInfo } from '@/shared/utils/printReceipt';

interface PaymentData {
  orderId: string;
  amount: number;
  paymentContent: string;
  bankAccounts: BankAccountInfo[];
  orderNumber?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethod: 'CASH' | 'BANKING' | 'CARD' | 'TRANSFER';
  data: PaymentData | null;
  onConfirmed: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Thanh toán tiền mặt',
  BANKING: 'Thanh toán chuyển khoản',
  CARD: 'Thanh toán thẻ',
  TRANSFER: 'Thanh toán chuyển khoản',
};

const CONFIRM_LABELS: Record<string, string> = {
  CASH: 'Đã nhận đủ tiền mặt?',
  BANKING: 'Đã nhận tiền',
  CARD: 'Đã thanh toán qua thẻ?',
  TRANSFER: 'Đã nhận chuyển khoản?',
};

export function InvoicePaymentModal({ open, onOpenChange, paymentMethod, data, onConfirmed }: Props) {
  const confirmPayment = useConfirmPayment();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!data) return;
    setIsConfirming(true);
    try {
      await confirmPayment.mutateAsync({ orderId: data.orderId, paymentMethod });
      onOpenChange(false);
      onConfirmed();
    } catch (err) {
      console.error('[InvoicePaymentModal.handleConfirm] Confirm payment failed:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  const showBanking = paymentMethod === 'BANKING' || paymentMethod === 'TRANSFER';
  const showQR = paymentMethod === 'BANKING';
  const ba = data?.bankAccounts?.[0];
  const vietqrUrl = ba
    ? `https://api.vietqr.io/image/${ba.bankCode}-${ba.accountNumber}-compact.jpg?accountName=${encodeURIComponent(ba.accountHolder)}&amount=${data.amount}&addInfo=${encodeURIComponent(data.paymentContent)}`
    : '';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isConfirming) { onOpenChange(false); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-base uppercase tracking-wider">
            {METHOD_LABELS[paymentMethod] || 'Thanh toán'}
          </DialogTitle>
          {showQR && data && (
            <DialogDescription className="text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-md p-2 mt-1">
              Khách vui lòng ưu tiên quét QR trên hóa đơn.
              QR trên màn hình chỉ sử dụng khi hóa đơn bị lỗi, mất hoặc không quét được.
            </DialogDescription>
          )}
        </DialogHeader>

        {data && (
          <div className="space-y-3">
            {showQR && ba && (
              <div className="flex justify-center">
                <img
                  src={vietqrUrl}
                  alt="QR thanh toán"
                  className="rounded-md border border-border"
                  style={{ width: 200, height: 200 }}
                />
              </div>
            )}

            <div className="space-y-1 text-xs bg-muted/30 rounded-md p-3">
              {showBanking && ba && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ngân hàng</span>
                    <span className="font-medium text-right">{ba.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số tài khoản</span>
                    <span className="font-medium tabular-nums">{ba.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chủ tài khoản</span>
                    <span className="font-medium text-right">{ba.accountHolder}</span>
                  </div>
                  <div className="border-t border-border my-1" />
                </>
              )}
              {!showBanking && data.orderNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mã hóa đơn</span>
                  <span className="font-medium tabular-nums">{data.orderNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tiền</span>
                <span className="font-semibold text-primary tabular-nums">
                  {data.amount.toLocaleString()}₫
                </span>
              </div>
              {showBanking && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nội dung CK</span>
                  <span className="font-medium tabular-nums">{data.paymentContent}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            Hủy
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleConfirm}
            disabled={isConfirming || !data}
          >
            {isConfirming ? (
              <><Loader2 className="size-3.5 animate-spin" /> Đang xác nhận...</>
            ) : (
              <><CheckCircle className="size-3.5" /> {CONFIRM_LABELS[paymentMethod] || 'Xác nhận'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
