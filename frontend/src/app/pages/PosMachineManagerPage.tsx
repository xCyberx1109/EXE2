import { useState, useEffect } from 'react';
import { posMachineApi } from '../api/services';
import { api } from '../api/client';
import { PERMISSION_GROUPS } from '../../shared/permissions/permissionGroups';
import { POS_MACHINE_TEMPLATES, type PosMachine, type PosMachineTemplate, type PosMachineDetail } from '../types';
import { Smartphone, Plus, Lock, Unlock, Trash2, Save, X, ChevronDown } from 'lucide-react';
import { CreatePosMachineModal } from '../../modules/posMachine/CreatePosMachineModal';
import { PinResultModal } from '../../modules/posMachine/PinResultModal';

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

const TEMPLATE_OPTIONS = [
  { value: 'CASHIER', label: 'Thu ngân' },
  { value: 'KITCHEN', label: 'Bếp' },
  { value: 'CASHIER_KITCHEN', label: 'Thu ngân & Bếp' },
  { value: 'BILLIARD', label: 'Bi-a' },
  { value: 'CUSTOM', label: 'Tùy chỉnh' },
];

export function PosMachineManagerPage() {
  const [machines, setMachines] = useState<PosMachine[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // PIN result modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [createdPin, setCreatedPin] = useState('');
  const [createdMachineName, setCreatedMachineName] = useState('');

  // Edit modal state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<PosMachineDetail | null>(null);
  const [editForm, setEditForm] = useState({ name: '', template: 'CASHIER' as PosMachineTemplate, pinCode: '', pinCodeConfirm: '' });

  const [resetPinResult, setResetPinResult] = useState<{ id: string; pinCode: string } | null>(null);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const data = await posMachineApi.list();
      setMachines(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tải danh sách thất bại');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMachines(); }, []);

  const loadPermissions = async () => {
    try {
      const data = await api.get<Permission[]>('/rbac/permissions');
      setPermissions(data || []);
    } catch {}
  };

  const openCreate = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (data: { name: string; template: PosMachineTemplate }) => {
    const result = await posMachineApi.create({ name: data.name, template: data.template });
    setIsCreateModalOpen(false);
    setCreatedMachineName(data.name);
    setCreatedPin(result.pinCode);
    setIsPinModalOpen(true);
    await fetchMachines();
  };

  const handlePinModalClose = () => {
    setIsPinModalOpen(false);
    setCreatedPin('');
    setCreatedMachineName('');
  };

  const openEdit = async (machine: PosMachine) => {
    setEditingId(machine.id);
    setEditForm({ name: machine.name, template: machine.template, pinCode: '', pinCodeConfirm: '' });
    try {
      const detail = await posMachineApi.get(machine.id);
      setSelectedMachine(detail);
      if (detail.template === 'CUSTOM') {
        await loadPermissions();
      }
    } catch {}
  };

  const handleEditSave = async () => {
    setError('');
    if (!editForm.name.trim()) { setError('Vui lòng nhập tên máy POS'); return; }
    if (editForm.pinCode && editForm.pinCode !== editForm.pinCodeConfirm) {
      setError('Mã PIN xác nhận không khớp');
      return;
    }

    try {
      const body: any = { name: editForm.name, template: editForm.template };
      if (editForm.pinCode) body.pinCode = editForm.pinCode;
      await posMachineApi.update(editingId!, body);
      setEditingId(null);
      setSelectedMachine(null);
      await fetchMachines();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  const handleResetPin = async (id: string) => {
    try {
      const result = await posMachineApi.resetPin(id);
      setResetPinResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đặt lại mã PIN thất bại');
    }
  };

  const handleToggleLock = async (id: string) => {
    try {
      await posMachineApi.toggleLock(id);
      await fetchMachines();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa máy POS này?')) return;
    try {
      await posMachineApi.delete(id);
      await fetchMachines();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedMachine) return;
    try {
      await posMachineApi.updatePermissions(selectedMachine.id, selectedPermissions);
      alert('Đã lưu quyền cho máy POS');
    } catch {
      alert('Lưu quyền thất bại');
    }
  };

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const codeToIdMap = new Map(permissions.map(p => [p.code, p.id]));
  const permIdSet = new Set(selectedPermissions);

  useEffect(() => {
    if (selectedMachine && selectedMachine.template === 'CUSTOM') {
      setSelectedPermissions(selectedMachine.permissions?.map(p => p.permissionId) || []);
    }
  }, [selectedMachine]);

  const togglePerm = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const getGroupState = (group: typeof PERMISSION_GROUPS[0]) => {
    const ids = group.permissions.map(c => codeToIdMap.get(c)).filter(Boolean) as string[];
    if (ids.length === 0) return 'none';
    const count = ids.filter(id => permIdSet.has(id)).length;
    if (count === 0) return 'none';
    if (count === ids.length) return 'all';
    return 'partial';
  };

  const toggleGroup = (group: typeof PERMISSION_GROUPS[0]) => {
    const state = getGroupState(group);
    const ids = group.permissions.map(c => codeToIdMap.get(c)).filter(Boolean) as string[];
    if (state === 'all') {
      setSelectedPermissions(prev => prev.filter(p => !ids.includes(p)));
    } else {
      setSelectedPermissions(prev => {
        const set = new Set(prev);
        ids.forEach(id => set.add(id));
        return Array.from(set);
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-7 h-7" />
            Quản lý Máy POS
          </h1>
          <p className="text-gray-500">Tạo và quản lý các máy POS trong nhà hàng</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Tạo máy POS
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive mb-4">{error}</div>
      )}

      {resetPinResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-center">
          <p className="text-sm text-blue-800 font-medium mb-1">Mã PIN đã được đặt lại!</p>
          <div className="text-3xl font-bold tracking-[0.3em] text-blue-700 font-mono">{resetPinResult.pinCode}</div>
          <button onClick={() => setResetPinResult(null)}
            className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline">Bỏ qua</button>
        </div>
      )}

      {/* Create Modal */}
      <CreatePosMachineModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleCreateSubmit}
      />

      {/* PIN Result Modal */}
      <PinResultModal
        open={isPinModalOpen}
        onOpenChange={handlePinModalClose}
        machineName={createdMachineName}
        pin={createdPin}
      />

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Cập nhật máy POS</h2>
              <button onClick={() => { setEditingId(null); setSelectedMachine(null); }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tên máy</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="VD: Máy POS quầy 1"
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-input-background" />
              </div>

              <div>
                <label className="text-sm font-medium">Template</label>
                <select value={editForm.template} onChange={e => setEditForm({ ...editForm, template: e.target.value as PosMachineTemplate })}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-input-background">
                  {TEMPLATE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Template quyết định nhóm permission tự động gán cho máy POS
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Mã PIN mới (để trống nếu không đổi)</label>
                <input type="password" value={editForm.pinCode} onChange={e => setEditForm({ ...editForm, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="6 chữ số" maxLength={6}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-input-background font-mono tracking-widest" />
              </div>
              <div>
                <label className="text-sm font-medium">Xác nhận mã PIN</label>
                <input type="password" value={editForm.pinCodeConfirm} onChange={e => setEditForm({ ...editForm, pinCodeConfirm: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="Nhập lại mã PIN" maxLength={6}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-input-background font-mono tracking-widest" />
              </div>

              {selectedMachine && selectedMachine.template === 'CUSTOM' && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">Phân quyền cho máy POS</h3>
                    <button onClick={handleSavePermissions} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">
                      <Save className="w-3 h-3" />
                      Lưu quyền
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {PERMISSION_GROUPS.map(group => {
                      const state = getGroupState(group);
                      const isExpanded = expandedGroup === group.id;
                      const permIds = group.permissions.map(c => codeToIdMap.get(c)).filter(Boolean) as string[];
                      const selectedCount = permIds.filter(id => permIdSet.has(id)).length;

                      return (
                        <div key={group.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={state === 'all'}
                              ref={el => { if (el) el.indeterminate = state === 'partial'; }}
                              onChange={() => toggleGroup(group)}
                              className="w-4 h-4" />
                            <button onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                              className="flex items-center gap-2 flex-1 text-left">
                              <span className="text-sm font-medium">{group.name}</span>
                              <span className="text-xs text-muted-foreground">({selectedCount}/{permIds.length})</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="flex flex-wrap gap-1 mt-2 pl-6">
                              {group.permissions.map(code => {
                                const perm = permissions.find(p => p.code === code);
                                if (!perm) return null;
                                const isSelected = permIdSet.has(perm.id);
                                return (
                                  <span key={code} onClick={() => togglePerm(perm.id)}
                                    className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer ${
                                      isSelected ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border'
                                    }`}>
                                    {code}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setEditingId(null); setSelectedMachine(null); }}
                  className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors">
                  Hủy
                </button>
                <button onClick={handleEditSave}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Cập nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Machine List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Đang tải...</div>
      ) : machines.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-xl">
          <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Chưa có máy POS nào. Nhấn "Tạo máy POS" để bắt đầu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map(machine => (
            <div key={machine.id} className={`border rounded-xl p-4 ${machine.status === 'LOCKED' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${machine.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">{machine.name}</h3>
                    <span className="text-xs text-muted-foreground">{POS_MACHINE_TEMPLATES[machine.template]}</span>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  machine.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {machine.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                </span>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground mb-3">
                <div className="flex justify-between">
                  <span>Template</span>
                  <span className="font-medium">{POS_MACHINE_TEMPLATES[machine.template]}</span>
                </div>
                {machine.lastLoginAt && (
                  <div className="flex justify-between">
                    <span>Đăng nhập gần nhất</span>
                    <span>{new Date(machine.lastLoginAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Ngày tạo</span>
                  <span>{new Date(machine.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <div className="flex gap-2 border-t pt-3 flex-wrap">
                <button onClick={() => openEdit(machine)} className="px-3 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors">
                  Sửa
                </button>
                <button onClick={() => handleResetPin(machine.id)}
                  className="px-3 py-1.5 text-xs rounded-lg border text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1">
                  Đặt lại mã PIN
                </button>
                <button onClick={() => handleToggleLock(machine.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
                    machine.status === 'ACTIVE' ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'
                  }`}>
                  {machine.status === 'ACTIVE' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {machine.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                </button>
                <button onClick={() => handleDelete(machine.id)}
                  className="px-3 py-1.5 text-xs rounded-lg border text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
