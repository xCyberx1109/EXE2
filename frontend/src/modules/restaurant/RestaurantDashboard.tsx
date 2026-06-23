import { useState } from 'react';
import { UnifiedDashboard } from '../billiard/UnifiedDashboard';

export function RestaurantDashboard() {
  const [autoOpenDrawer, setAutoOpenDrawer] = useState(false);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <UnifiedDashboard
        mode="RESTAURANT"
        autoOpenDrawer={autoOpenDrawer}
        onAutoOpenDrawerConsumed={() => setAutoOpenDrawer(false)}
        onOrderCreated={() => setAutoOpenDrawer(true)}
      />
    </div>
  );
}
