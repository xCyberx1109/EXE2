import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import {
  getPosToken, staffAuthApi, shiftApi, deviceAuthApi,
} from '../api/posServices';
import { useAuth } from '../context/AuthContext';
import type { CurrentShift, ActiveStaff } from '../types';

type Tab = 'login' | 'shift' | 'staff' | 'settings';

export function PosV2Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isDeviceMode, logoutDevice, deviceInfo, branchInfo, deviceType } = useAuth();

  // Redirect to device-aware route if device type is known
  useEffect(() => {
    if (!isDeviceMode || !deviceType) return;
    const redirectMap: Record<string, string> = {
      CASHIER: '/pos/order',
      KITCHEN: '/pos/kitchen-queue',
      WAITER: '/pos/waiter-order',
      KIOSK: '/pos/kiosk',
      CUSTOMER_DISPLAY: '/pos/display',
      MANAGER: '/pos/order',
      TABLET: '/pos/waiter-order',
    };
    const target = redirectMap[deviceType];
    if (target && target !== '/pos-v2/dashboard') {
      navigate(target, { replace: true });
    }
  }, [isDeviceMode, deviceType, navigate]);
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [pinCode, setPinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null);
  const [activeStaff, setActiveStaff] = useState<ActiveStaff[]>([]);
  const [shiftBalances, setShiftBalances] = useState({
    openingBalance: '',
    closingBalance: '',
    actualBalance: '',
    note: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const [shift, staff] = await Promise.all([
        shiftApi.current().catch(() => null),
        staffAuthApi.activeStaff().catch(() => []),
      ]);
      setCurrentShift(shift);
      setActiveStaff(staff);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (!getPosToken() || !isDeviceMode) {
      navigate('/login', { replace: true });
      return;
    }
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [navigate, fetchData, isDeviceMode]);

  const handleStaffLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await staffAuthApi.loginPin(pinCode);
      setPinCode('');
      await fetchData();
      setActiveTab('shift');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogout = async () => {
    try {
      await staffAuthApi.logout();
      setActiveStaff([]);
    } catch {
      // silent
    }
  };

  const handleOpenShift = async () => {
    setLoading(true);
    setError('');
    try {
      await shiftApi.open({
        openingBalance: Number(shiftBalances.openingBalance),
        note: shiftBalances.note || undefined,
      });
      setShiftBalances({ openingBalance: '', closingBalance: '', actualBalance: '', note: '' });
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open shift');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await shiftApi.close({
        closingBalance: Number(shiftBalances.closingBalance),
        actualBalance: shiftBalances.actualBalance ? Number(shiftBalances.actualBalance) : undefined,
        note: shiftBalances.note || undefined,
      });
      setShiftBalances({ openingBalance: '', closingBalance: '', actualBalance: '', note: '' });
      alert(
        `Shift closed!\nExpected: ${result.expectedCashBalance}\nActual: ${result.closingBalance}\nVariance: ${result.balanceVariance}`,
      );
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close shift');
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceLogout = async () => {
    await logoutDevice();
    navigate('/login', { replace: true });
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">POS Dashboard</h1>
            {currentShift && (
              <Badge variant={currentShift.status === 'OPEN' ? 'default' : 'secondary'}>
                Shift {currentShift.status === 'OPEN' ? 'Open' : 'Closed'}
              </Badge>
            )}
            {activeStaff.length > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                {activeStaff[0].account.fullName}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDeviceLogout}>
              Device Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6">
          {(['login', 'shift', 'staff', 'settings'] as Tab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'login' ? 'Staff Login' : tab === 'shift' ? 'Shift' : tab === 'staff' ? 'Staff' : 'Settings'}
            </Button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* STAFF LOGIN TAB */}
        {activeTab === 'login' && (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Staff Login</CardTitle>
                <CardDescription>Enter your PIN to start a session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="password"
                  placeholder="PIN Code"
                  value={pinCode}
                  onChange={handlePinChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                  className="font-mono text-2xl tracking-widest text-center h-14"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleStaffLogin}
                  disabled={loading || pinCode.length < 4}
                >
                  {loading ? 'Verifying...' : 'Login'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SHIFT TAB */}
        {activeTab === 'shift' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Shift Management</CardTitle>
                  <CardDescription>
                    {currentShift
                      ? `Shift opened at ${new Date(currentShift.openedAt).toLocaleTimeString()}`
                      : 'No active shift'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentShift && currentShift.status === 'OPEN' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">Opening Balance</div>
                        <div className="text-2xl font-bold">{currentShift.openingBalance.toLocaleString()}</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">Cash Sales</div>
                        <div className="text-2xl font-bold text-green-600">
                          {currentShift.cashSales.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">Card Sales</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {currentShift.cardSales.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">Total Orders</div>
                        <div className="text-2xl font-bold">{currentShift.totalOrders}</div>
                      </div>
                    </div>
                  )}

                  {!currentShift || currentShift.status === 'CLOSED' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Opening Balance</label>
                        <Input
                          type="number"
                          min="0"
                          value={shiftBalances.openingBalance}
                          onChange={(e) =>
                            setShiftBalances({ ...shiftBalances, openingBalance: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Note (optional)</label>
                        <Input
                          value={shiftBalances.note}
                          onChange={(e) =>
                            setShiftBalances({ ...shiftBalances, note: e.target.value })
                          }
                          placeholder="e.g., Morning shift"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleOpenShift}
                        disabled={loading || !activeStaff.length}
                      >
                        {loading ? 'Opening...' : 'Open Shift'}
                      </Button>
                      {!activeStaff.length && (
                        <p className="text-sm text-amber-600">
                          A staff member must be logged in to open a shift
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 border-t pt-4">
                      <div>
                        <label className="text-sm font-medium">Closing Balance (Cash Drawer)</label>
                        <Input
                          type="number"
                          min="0"
                          value={shiftBalances.closingBalance}
                          onChange={(e) =>
                            setShiftBalances({ ...shiftBalances, closingBalance: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Actual Balance (optional)</label>
                        <Input
                          type="number"
                          min="0"
                          value={shiftBalances.actualBalance}
                          onChange={(e) =>
                            setShiftBalances({ ...shiftBalances, actualBalance: e.target.value })
                          }
                          placeholder="Leave blank to use closing balance"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Note</label>
                        <Input
                          value={shiftBalances.note}
                          onChange={(e) =>
                            setShiftBalances({ ...shiftBalances, note: e.target.value })
                          }
                          placeholder="e.g., End of day"
                        />
                      </div>
                      <Button
                        className="w-full"
                        variant="destructive"
                        onClick={handleCloseShift}
                        disabled={loading}
                      >
                        {loading ? 'Closing...' : 'Close Shift'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Shift Summary Sidebar */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Staff on Duty</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeStaff.length === 0 ? (
                    <p className="text-gray-500 text-sm">No staff logged in</p>
                  ) : (
                    <div className="space-y-3">
                      {activeStaff.map((s) => (
                        <div key={s.sessionId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{s.account.fullName}</div>
                            <Badge variant="outline" className="text-xs">
                              {s.account.role}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(s.loginAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full" onClick={handleStaffLogout}>
                        Logout All Staff
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* STAFF TAB */}
        {activeTab === 'staff' && (
          <Card>
            <CardHeader>
              <CardTitle>Active Staff Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {activeStaff.length === 0 ? (
                <p className="text-gray-500">No active staff sessions. Log in with a PIN first.</p>
              ) : (
                <div className="space-y-2">
                  {activeStaff.map((s) => (
                    <div key={s.sessionId} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div>
                        <div className="font-medium">{s.account.fullName}</div>
                        <div className="text-sm text-gray-500">{s.account.role}</div>
                      </div>
                      <div className="text-sm text-gray-400">
                        Since {new Date(s.loginAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <Card>
            <CardHeader>
              <CardTitle>Device Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full" onClick={handleDeviceLogout}>
                Logout Device & Return to Setup
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
