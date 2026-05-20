import { Link, Outlet, useLocation } from 'react-router';
import { LayoutDashboard, MonitorCheck, UtensilsCrossed, Package, TrendingUp, Menu, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navigation = [
  { name: 'Tổng quan', href: '/', icon: LayoutDashboard },
  { name: 'Máy POS', href: '/pos', icon: MonitorCheck },
  { name: 'Quản lý Menu', href: '/menu', icon: UtensilsCrossed },
  { name: 'Quản lý Tồn kho', href: '/inventory', icon: Package },
  { name: 'Quản lý Doanh thu', href: '/revenue', icon: TrendingUp },
];

export function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang kết nối server...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-40">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-lg">Quản lý F&B</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Quản lý F&B</h1>
            <p className="text-sm text-gray-500 mt-1">Hệ thống quản lý nhà hàng</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p>Demo Version 1.0</p>
              <p className="mt-1">© 2026 F&B Management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-64 pt-14 lg:pt-0">
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}