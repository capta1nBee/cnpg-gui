import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus, ShieldAlert, Trash2, MoreVertical, Mail, Search, RefreshCw, X } from 'lucide-react';
import api from '../api/axios';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';

export default function UserList() {
  const [users, setUsers] = useState<any[]>([]);
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'VIEWER',
    authType: 'local'
  });
  const { toast, confirm } = useUI();

  useEffect(() => {
    fetchUsers();
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const handleAction = async (userId: string, action: string) => {
    if (action === 'toggle_status') {
        const targetUser = users.find(u => u.id === userId);
        if (targetUser && currentUser && targetUser.username === currentUser.username) {
            toast('You cannot disable your own account', 'error');
            return;
        }
        const ok = await confirm({
            title: 'Change Status',
            message: 'Are you sure you want to change the status of this user?',
            type: 'primary'
        });
        if (!ok) return;
        
        try {
            await api.patch(`/users/${userId}/toggle-status`);
            toast('Status updated successfully', 'success');
            fetchUsers();
        } catch (err) {
            toast('Failed to update status', 'error');
        }
        return;
    }


    if (action === 'delete') {
        const targetUser = users.find(u => u.id === userId);
        if (targetUser && currentUser && targetUser.username === currentUser.username) {
            toast('You cannot delete your own account', 'error');
            return;
        }
        const ok = await confirm({
            title: 'Delete User',
            message: 'Are you sure you want to permanently delete this user? This action cannot be undone.',
            type: 'danger'
        });
        if (!ok) return;
        
        try {
            await api.delete(`/users/${userId}`);
            toast('User deleted successfully', 'success');
            fetchUsers();
        } catch (err) {
            toast('Failed to delete user', 'error');
        }
        return;
    }
    toast(`Action "${action}" triggered`, 'info');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username) return;
    setSaving(true);
    try {
      await api.post('/users', newUser);
      setIsModalOpen(false);
      setNewUser({ username: '', email: '', password: '', role: 'VIEWER', authType: 'local' });
      toast('User created successfully', 'success');
      fetchUsers();
    } catch (err) {
      toast('Failed to create user', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">User Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage system access, roles and authentication methods.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95">
          <UserPlus className="w-4 h-4 mr-2" /> Invite New User
        </button>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center bg-gray-50/30 dark:bg-gray-900/30">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search users by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="ml-auto flex space-x-2">
             <button onClick={fetchUsers} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full compact-table">
            <thead>
              <tr>
                <th className="text-left">Identity</th>
                <th className="text-left">Method</th>
                <th className="text-left">System Role</th>
                <th className="text-left">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {paginatedUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No users found
                </td></tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors ${user.status !== 'active' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                    <td>
                      <div className="flex items-center">
                        <div className={`h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm ${user.status === 'active' ? 'bg-gradient-to-tr from-blue-600 to-indigo-600' : 'bg-gray-400'}`}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <div className={`text-sm font-bold ${user.status === 'active' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{user.username}</div>
                          <div className="text-[10px] text-gray-500">{user.email || 'no-email@system.com'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold rounded-md uppercase tracking-wider">
                        {user.authType}
                      </span>
                    </td>
                    <td>
                       <div className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-300">
                         <ShieldAlert className={`w-3 h-3 mr-1.5 ${user.status === 'active' ? 'text-blue-500' : 'text-gray-400'}`} /> {user.role}
                       </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        <span className={`w-1 h-1 rounded-full mr-1.5 ${user.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                        {user.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </td>

                    <td className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => handleAction(user.id, 'toggle_status')} 
                          disabled={currentUser && user.username === currentUser.username}
                          title={user.status === 'active' ? 'Disable' : 'Enable'}
                          className={`p-2 rounded-lg transition-all ${
                            currentUser && user.username === currentUser.username
                              ? 'opacity-30 cursor-not-allowed text-gray-300'
                              : user.status === 'active' 
                              ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' 
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          }`}
                        >
                          {user.status === 'active' ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleAction(user.id, 'delete')} 
                          disabled={currentUser && user.username === currentUser.username}
                          title="Delete User"
                          className={`p-2 rounded-lg transition-colors ${
                            currentUser && user.username === currentUser.username
                              ? 'opacity-30 cursor-not-allowed text-gray-300'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-gray-900/30">
            <span className="text-xs text-gray-500">
              Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> of <span className="font-bold">{filteredUsers.length}</span> users
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30"
              >
                Previous
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold dark:text-white">Create New User</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="jdoe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="jdoe@example.com"
                />
              </div>
              {newUser.authType === 'local' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input 
                    type="password" 
                    required
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="••••••••"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select 
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="BACKUP_OPERATOR">Backup Operator</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auth Type</label>
                  <select 
                    value={newUser.authType}
                    onChange={e => setNewUser({...newUser, authType: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="local">Local</option>
                    <option value="ldap">LDAP (Invite)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving || !newUser.username} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg">
                  {saving ? 'Creating...' : (newUser.authType === 'ldap' ? 'Invite LDAP User' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
