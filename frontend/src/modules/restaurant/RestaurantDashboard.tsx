import { useState } from 'react';
import { UnifiedDashboard } from '../billiard/UnifiedDashboard';

export function RestaurantDashboard() {
  const [autoOpenDrawer, setAutoOpenDrawer] = useState(false);

  return (
    <UnifiedDashboard
      mode="RESTAURANT"
      autoOpenDrawer={autoOpenDrawer}
      onAutoOpenDrawerConsumed={() => setAutoOpenDrawer(false)}
      onOrderCreated={() => setAutoOpenDrawer(true)}
    />
  );
}
