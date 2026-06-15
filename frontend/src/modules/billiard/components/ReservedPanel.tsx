import { CheckCircle, XCircle, Phone, User, Clock, FileText } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useCheckIn, useCancelReservation } from '../hooks';
import type { BilliardTableWithSession } from '../types';
import { Loader2 } from 'lucide-react';

interface ReservedPanelProps {
  table: BilliardTableWithSession;
  onSuccess: () => void;
}

export function ReservedPanel({ table, onSuccess }: ReservedPanelProps) {
  const checkIn = useCheckIn();
  const cancelReservation = useCancelReservation();

  const reservation = table.currentReservation;

  const handleCheckIn = async () => {
    await checkIn.mutateAsync(table.id);
    onSuccess();
  };

  const handleCancel = async () => {
    await cancelReservation.mutateAsync(table.id);
    onSuccess();
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400">
          Reserved
        </span>
      </div>

      {reservation ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{reservation.customerName}</span>
          </div>

          {reservation.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{reservation.phone}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{new Date(reservation.reservationTime).toLocaleString()}</span>
          </div>

          {reservation.note && (
            <div className="flex items-start gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span className="text-muted-foreground">{reservation.note}</span>
            </div>
          )}

          <div className="pt-3 space-y-2">
            <Button
              className="w-full"
              onClick={handleCheckIn}
              disabled={checkIn.isPending}
            >
              {checkIn.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Check In
            </Button>
            <Button
              variant="outline"
              className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={handleCancel}
              disabled={cancelReservation.isPending}
            >
              {cancelReservation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Cancel Reservation
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No reservation details available.</p>
      )}
    </div>
  );
}
