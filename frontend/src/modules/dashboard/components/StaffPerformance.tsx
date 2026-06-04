import { Users, Clock, UserCheck, Medal } from 'lucide-react';
import { SectionHeader, EmptyState, QuickStatCard } from './shared';
import type { CurrentShift, ActiveStaff } from '../../app/types';

export function StaffPerformance({ currentShift, activeStaff, checkedIn, totalStaff, topStaff, loading }: {
  currentShift: CurrentShift | null;
  activeStaff: ActiveStaff[];
  checkedIn: number;
  totalStaff: number;
  topStaff: { id: string; name: string; ordersHandled: number }[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-40 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-32 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatVND = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
    return `${n.toLocaleString('vi-VN')} ₫`;
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Nhân viên" actionLabel="Quản lý" actionHref="/app/staff" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {currentShift ? 'Ca hiện tại' : 'Nhân sự hôm nay'}
          </h3>
          {currentShift ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Mở ca: {new Date(currentShift.openedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    Doanh số: {formatVND(currentShift.currentSales)} • Đơn: {currentShift.totalOrders}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <QuickStatCard
                  icon={UserCheck}
                  label="Đã điểm danh"
                  value={`${checkedIn}/${totalStaff}`}
                  color="text-green-600"
                  bg="bg-green-50"
                />
                <QuickStatCard
                  icon={Users}
                  label="Đang làm việc"
                  value={String(activeStaff.length)}
                  color="text-blue-600"
                  bg="bg-blue-50"
                />
              </div>
              {activeStaff.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Nhân viên đang làm việc:</p>
                  {activeStaff.map((s) => (
                    <div key={s.sessionId} className="flex items-center gap-2 text-sm px-2 py-1.5 bg-gray-50 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-gray-900">{s.account.fullName}</span>

                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                <p className="text-sm text-gray-500">Chưa mở ca hôm nay</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <QuickStatCard
                  icon={UserCheck}
                  label="Đã điểm danh"
                  value={`${checkedIn}/${totalStaff}`}
                  color="text-green-600"
                  bg="bg-green-50"
                />
                <QuickStatCard
                  icon={Users}
                  label="Đang làm việc"
                  value={String(activeStaff.length)}
                  color="text-blue-600"
                  bg="bg-blue-50"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader title="Xếp hạng nhân viên" />
          {topStaff.length > 0 ? (
            <div className="space-y-2">
              {topStaff.map((staff, idx) => (
                <div key={staff.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0 ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {idx < 3 ? <Medal className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{staff.name}</p>

                  </div>
                  <span className="text-sm font-semibold text-gray-900">{staff.ordersHandled} đơn</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Chưa có dữ liệu" icon={Medal} />
          )}
        </div>
      </div>
    </div>
  );
}
