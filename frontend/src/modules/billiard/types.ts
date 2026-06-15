import type { TableStatus } from '@/app/types';

export interface BilliardTable {
  id: string;
  accountId: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
  tableType: 'POOL' | 'SNOOKER' | 'VIP';
  posX: number;
  posY: number;
  status: TableStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BilliardPlaySession {
  id: string;
  tableId: string;
  startTime: string;
  expectedEndTime: string;
  endTime: string | null;
  durationMinutes: number;
  tableFee: number;
  status: 'PLAYING' | 'FINISHED' | 'CANCELLED';
}

export interface BilliardReservation {
  id: string;
  tableId: string;
  branchId: string;
  customerName: string;
  phone: string | null;
  reservationTime: string;
  durationMinutes: number;
  note: string | null;
  status: 'PENDING' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
}

export type BilliardTableWithSession = BilliardTable & {
  currentSession?: BilliardPlaySession | null;
  currentReservation?: BilliardReservation | null;
};

export type SortPriority =
  | 'OCCUPIED_ENDING'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'AVAILABLE'
  | 'CLEANING'
  | 'CHECKING_OUT'
  | 'DISABLED';

export interface PlayNowBody {
  durationMinutes: number;
  customerName?: string;
  phone?: string;
}

export interface ReserveBody {
  customerName: string;
  phone?: string;
  reservationTime: string;
  durationMinutes?: number;
  note?: string;
}

export interface ExtendSessionBody {
  additionalMinutes: number;
}

export interface CreateTableBody {
  tableCode: string;
  tableName?: string;
  tableType: 'POOL' | 'SNOOKER' | 'VIP';
}
