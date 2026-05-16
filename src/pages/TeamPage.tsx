import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { UserPlus, MoveHorizontal as MoreHorizontal, RefreshCw, ShieldOff, ShieldCheck, X, KeyRound, ChevronDown } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import { useAuthStore } from '@/lib/store';
import clsx from 'clsx';

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  SUPER_ADMIN:   { label: 'Super Admin', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
  COMPANY_ADMIN: { label: 'Admin',       cls: 'bg-accent/10 text-[#9BA8FF] border-accent/20' },
  MANAGER:       { label: 'Manager',     cls: 'bg-accent-3/10 text-accent-3 border-accent-3/20' },
  AGENT:         { label: 'Agent',       cls: 'bg-white/[0.06] text-white/50 border-white/10' },
};

interface InviteForm {
  email: string; firstName: string; lastName: string; role: string; managerId: string;
}
interface EditModal { user: User; role: string; managerId: string; }

export function TeamPage() {
  const currentUser = useAuthStore(s => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: '', firstName: '', lastName: '', role: 'AGENT', managerId: '',
  });
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => { usersApi.list().then(setUsers).finally(() => setLoading(false)); }, []);

  const managers = users.filter(u => u.role === 'MANAGER' || u.role === 'COMPANY_ADMIN');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const payload: any = { ...inviteForm };
      if (!payload.managerId) delete payload.managerId;
      const { user, tempPassword } = await usersApi.invite(payload);
      setUsers(prev => [user, ...prev]);
      setInviteResult({ name: inviteForm.firstName, tempPassword });
      setInviteForm({ email: '', firstName: '', lastName: '', role: 'AGENT', managerId: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invite failed');
    } finally { setInviting(false); }
  };

  const openEdit = (user: User) => { setEditModal({ user, role: user.role, managerId: user.managerId || '' }); setOpenMenu(null); };

  const saveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const payload: any = { role: editModal.role };
      if (editModal.managerId) payload.managerId = editModal.managerId;
      await usersApi.update(editModal.user.id, payload);
      setUsers(us => us.map(u => u.id === editModal.user.id ? { ...u, role: editModal.role as User['role'], managerId: editModal.managerId || undefined } : u));
      setEditModal(null);
      toast.success('User updated');
    } catch { toast.error('Failed to save changes'); } finally { setSaving(false); }
  };

  const toggleActive = async (user: User) => {
    try {
      await usersApi.update(user.id, { isActive: !user.isActive });
      setUsers(us => us.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
      toast.success(`${user.firstName} ${user.isActive ? 'deactivated' : 'activated'}`);
    } catch { toast.error('Failed to update status'); }
    setOpenMenu(null);
  };

  const startReset = (user: User) => { setResetTarget(user); setResetResult(null); setOpenMenu(null); };

  const confirmReset = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const { tempPassword } = await usersApi.resetPassword(resetTarget.id);
      setResetResult(tempPassword);
    } catch { toast.error('Failed to reset password'); setResetTarget(null); } finally { setResetting(false); }
  };

  const isAdmin = currentUser?.role === 'COMPANY_ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold">Team Members</h2>
          <p className="text-sm text-white/65 mt-0.5">{users.length} members · manage roles and performance</p>
        </div>
        {(isAdmin || currentUser?.role === 'MANAGER') && (
          <button onClick={() => { setShowInvite(v => !v); setInviteResult(null); }} className="btn-primary gap-2 text-xs sm:text-sm">
            <UserPlus size={13} /> Invite Member
          </button>
        )}
      </div>

      {/* Invite form */}
      <AnimatePresence>
        {showInvite && !inviteResult && (
          <motion.form
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            onSubmit={handleInvite}
            className="card p-4 sm:p-5 border-accent/20"
          >
            <h3 className="font-display text-[14px] font-bold mb-4">Invite New Member</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-white/65 block mb-1">First name</label>
                <input required value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} className="input-base" placeholder="First" />
              </div>
              <div>
                <label className="text-xs text-white/65 block mb-1">Last name</label>
                <input required value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} className="input-base" placeholder="Last" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="sm:col-span-1">
                <label className="text-xs text-white/65 block mb-1">Work email</label>
                <input type="email" required value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="input-base" placeholder="email@company.com" />
              </div>
              <div>
                <label className="text-xs text-white/65 block mb-1">Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} className="input-base">
                  <option value="AGENT">Agent</option>
                  <option value="MANAGER">Manager</option>
                  {isAdmin && <option value="COMPANY_ADMIN">Admin</option>}
                </select>
              </div>
              {managers.length > 0 && (
                <div>
                  <label className="text-xs text-white/65 block mb-1">Reporting Manager</label>
                  <select value={inviteForm.managerId} onChange={e => setInviteForm(f => ({ ...f, managerId: e.target.value }))} className="input-base">
                    <option value="">— None —</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={inviting} className="btn-primary">{inviting ? 'Inviting…' : 'Send Invite'}</button>
              <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost">Cancel</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Invite result */}
      {inviteResult && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card p-4 border-accent-3/30 bg-accent-3/5">
          <p className="text-accent-3 font-semibold text-sm mb-2">{inviteResult.name} has been invited</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-white/65 text-xs">Temp password:</span>
            <span className="font-mono font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">{inviteResult.tempPassword}</span>
          </div>
          <p className="text-[11px] text-white/30 mt-2">Share this password securely with the new member.</p>
          <button onClick={() => { setInviteResult(null); setShowInvite(false); }} className="btn-ghost mt-2 text-xs">Dismiss</button>
        </motion.div>
      )}

      {/* Table — desktop / Cards — mobile */}
      <div className="card" onClick={() => setOpenMenu(null)}>
        {/* Desktop header */}
        <div className="hidden md:grid text-[11px] font-semibold text-white/30 uppercase tracking-wider px-5 py-3 border-b border-white/[0.06]"
          style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 0.8fr 44px' }}>
          <div>Member</div><div>Role</div><div>Sessions</div><div>Avg Score</div><div>Status</div><div />
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30">Loading team…</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {users.map((u, i) => {
              const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.AGENT;
              const score = u.avgScore ?? 0;
              const scoreColor = score >= 80 ? 'text-accent-3' : score >= 65 ? 'text-accent-5' : score > 0 ? 'text-accent-4' : 'text-white/30';
              const isMenuOpen = openMenu === u.id;

              return (
                <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                  {/* Mobile card */}
                  <div className="md:hidden px-4 py-3.5 hover:bg-white/[0.02] transition-colors" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3">
                      <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-gradient-to-br from-accent to-accent-2', u.isActive === false && 'opacity-50')}>
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={clsx('text-[13px] font-medium truncate', u.isActive === false && 'text-white/65')}>{u.firstName} {u.lastName}</div>
                        <div className="text-[11px] text-white/30 truncate">{u.email}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={clsx('font-display text-[15px] font-bold', scoreColor)}>{score > 0 ? score.toFixed(0) : '—'}</span>
                        {isAdmin && (
                          <div className="relative">
                            <button onClick={() => setOpenMenu(isMenuOpen ? null : u.id)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/30 hover:text-white transition-colors">
                              <MoreHorizontal size={14} />
                            </button>
                            <AnimatePresence>
                              {isMenuOpen && <DropMenu u={u} openEdit={openEdit} startReset={startReset} toggleActive={toggleActive} />}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 ml-12">
                      <span className={clsx('text-[10.5px] font-semibold px-2 py-0.5 rounded-full border', roleCfg.cls)}>{roleCfg.label}</span>
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border', u.isActive !== false ? 'bg-accent-3/10 text-accent-3 border-accent-3/20' : 'bg-white/[0.05] text-white/30 border-white/10')}>
                        {u.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-[10px] text-white/30">{(u as any).sessionCount ?? 0} sessions</span>
                    </div>
                  </div>

                  {/* Desktop row */}
                  <div
                    className="hidden md:grid items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors relative"
                    style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 0.8fr 44px' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-gradient-to-br from-accent to-accent-2', u.isActive === false && 'opacity-50')}>
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <div className={clsx('text-[13.5px] font-medium', u.isActive === false && 'text-white/65')}>{u.firstName} {u.lastName}</div>
                        <div className="text-[11px] text-white/30">{u.email}</div>
                      </div>
                    </div>
                    <div><span className={clsx('text-[10.5px] font-semibold px-2 py-1 rounded-full border', roleCfg.cls)}>{roleCfg.label}</span></div>
                    <div className="text-[13px] text-white/50">{(u as any).sessionCount ?? 0}</div>
                    <div className={clsx('font-display text-[15px] font-bold', scoreColor)}>{score > 0 ? score.toFixed(1) : '—'}</div>
                    <div><span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border', u.isActive !== false ? 'bg-accent-3/10 text-accent-3 border-accent-3/20' : 'bg-white/[0.05] text-white/30 border-white/10')}>{u.isActive !== false ? 'Active' : 'Inactive'}</span></div>
                    <div className="relative">
                      {isAdmin && (
                        <button onClick={() => setOpenMenu(isMenuOpen ? null : u.id)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/30 hover:text-white transition-colors">
                          <MoreHorizontal size={14} />
                        </button>
                      )}
                      <AnimatePresence>
                        {isMenuOpen && <DropMenu u={u} openEdit={openEdit} startReset={startReset} toggleActive={toggleActive} />}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} className="bg-bg-2 border border-white/[0.1] rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-[15px] font-bold">Edit {editModal.user.firstName} {editModal.user.lastName}</h3>
                <button onClick={() => setEditModal(null)} className="text-white/30 hover:text-white"><X size={15} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/65 block mb-1.5">Role</label>
                  <select value={editModal.role} onChange={e => setEditModal(m => m ? { ...m, role: e.target.value } : m)} className="input-base">
                    <option value="AGENT">Agent</option>
                    <option value="MANAGER">Manager</option>
                    <option value="COMPANY_ADMIN">Admin</option>
                  </select>
                </div>
                {managers.length > 0 && (
                  <div>
                    <label className="text-xs text-white/65 block mb-1.5">Reporting Manager</label>
                    <select value={editModal.managerId} onChange={e => setEditModal(m => m ? { ...m, managerId: e.target.value } : m)} className="input-base">
                      <option value="">— None —</option>
                      {managers.filter(m => m.id !== editModal.user.id).map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Changes'}</button>
                <button onClick={() => setEditModal(null)} className="btn-ghost">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setResetTarget(null); setResetResult(null); }}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} className="bg-bg-2 border border-white/[0.1] rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-[15px] font-bold flex items-center gap-2"><KeyRound size={15} className="text-accent" /> Reset Password</h3>
                <button onClick={() => { setResetTarget(null); setResetResult(null); }} className="text-white/30 hover:text-white"><X size={15} /></button>
              </div>
              {!resetResult ? (
                <>
                  <p className="text-sm text-white/60 mb-5">Generate a new temporary password for <span className="text-white font-medium">{resetTarget.firstName} {resetTarget.lastName}</span>.</p>
                  <div className="flex gap-2">
                    <button onClick={confirmReset} disabled={resetting} className="btn-primary flex-1">{resetting ? 'Resetting…' : 'Generate Password'}</button>
                    <button onClick={() => setResetTarget(null)} className="btn-ghost">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/60 mb-4">New temporary password for <span className="text-white font-medium">{resetTarget.firstName}</span>:</p>
                  <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-center mb-4">
                    <span className="font-mono font-bold text-accent text-lg tracking-widest">{resetResult}</span>
                  </div>
                  <p className="text-[11px] text-white/30 mb-4">Share this securely. The user should change it immediately after logging in.</p>
                  <button onClick={() => { setResetTarget(null); setResetResult(null); }} className="btn-primary w-full">Done</button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropMenu({ u, openEdit, startReset, toggleActive }: { u: User; openEdit: (u: User) => void; startReset: (u: User) => void; toggleActive: (u: User) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.12 }}
      className="absolute right-0 top-8 w-44 bg-bg-2 border border-white/[0.1] rounded-xl shadow-2xl z-20 py-1.5 overflow-hidden"
    >
      <button onClick={() => openEdit(u)} className="w-full text-left px-4 py-2 text-[12.5px] hover:bg-white/[0.06] transition-colors flex items-center gap-2.5">
        <ChevronDown size={12} className="text-white/65" /> Edit Role &amp; Manager
      </button>
      <button onClick={() => startReset(u)} className="w-full text-left px-4 py-2 text-[12.5px] hover:bg-white/[0.06] transition-colors flex items-center gap-2.5">
        <KeyRound size={12} className="text-white/65" /> Reset Password
      </button>
      <div className="border-t border-white/[0.06] my-1" />
      <button onClick={() => toggleActive(u)} className="w-full text-left px-4 py-2 text-[12.5px] hover:bg-white/[0.06] transition-colors flex items-center gap-2.5">
        {u.isActive !== false ? <><ShieldOff size={12} className="text-accent-4" /> Deactivate</> : <><ShieldCheck size={12} className="text-accent-3" /> Activate</>}
      </button>
    </motion.div>
  );
}
