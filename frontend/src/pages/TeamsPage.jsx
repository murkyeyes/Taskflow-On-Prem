import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import * as authApi from '../api/auth.api';
import * as projectApi from '../api/project.api';
import Sidebar from '../components/layout/Sidebar';
import useAuth from '../hooks/useAuth';

export default function TeamsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [membersBySpace, setMembersBySpace] = useState({});
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('taskflow-sidebar') === 'collapsed');
  const [accountOpen, setAccountOpen] = useState(false);
  const [busySpaceId, setBusySpaceId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isAdmin = ['overall_admin', 'admin'].includes(user?.accountRole);
  const isOverallAdmin = user?.accountRole === 'overall_admin';

  const refreshMemberships = useCallback(async (availableSpaces) => {
    const results = await Promise.all(availableSpaces.map(async (space) => [space.id, (await projectApi.listMembers(space.id)).members]));
    setMembersBySpace(Object.fromEntries(results));
  }, []);

  const load = useCallback(async () => {
    try {
      const projectResult = await projectApi.listProjects();
      setSpaces(projectResult.projects);
      if (!['overall_admin', 'admin'].includes(user?.accountRole)) return;
      const accountResult = await authApi.listUsers();
      setAccounts(accountResult.users);
      await refreshMemberships(projectResult.projects);
    } catch (requestError) { setError(requestError.message); }
  }, [refreshMemberships, user?.accountRole]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isAdmin) return undefined;
    const timer = setTimeout(() => {
      authApi.listUsers(accountSearch).then((result) => setAccounts(result.users)).catch((requestError) => setError(requestError.message));
    }, 180);
    return () => clearTimeout(timer);
  }, [accountSearch, isAdmin]);

  const selectedMemberships = useMemo(() => spaces.map((space) => ({
    space,
    membership: (membersBySpace[space.id] ?? []).find((member) => member.user_id === selectedAccount?.id) ?? null,
  })), [membersBySpace, selectedAccount?.id, spaces]);
  const selectedIsAdmin = ['overall_admin', 'admin'].includes(selectedAccount?.accountRole);

  function toggleSidebar() {
    setCollapsed((value) => {
      localStorage.setItem('taskflow-sidebar', value ? 'expanded' : 'collapsed');
      return !value;
    });
  }

  async function signOut() { await logout(); navigate('/login'); }

  async function createAccount(event) {
    event.preventDefault(); setError(''); setMessage('');
    const formElement = event.currentTarget;
    try {
      const data = new FormData(formElement);
      const result = await authApi.register({ name: data.get('name'), email: data.get('email'), password: data.get('password'), accountRole: data.get('accountRole') || 'member' });
      formElement.reset();
      setSelectedAccount(result.user);
      setAccountSearch('');
      setAccounts((current) => [...current.filter((account) => account.id !== result.user.id), result.user].sort((a, b) => a.name.localeCompare(b.name)));
      setMessage(`Account ${result.user.name} created. Choose its Space access on the right.`);
    } catch (requestError) { setError(requestError.message); }
  }

  async function deactivateAccount() {
    if (!selectedAccount || !window.confirm(`Delete ${selectedAccount.name}'s login and Space access? Historical activity will be retained.`)) return;
    setError(''); setMessage('');
    try {
      const target = selectedAccount;
      await authApi.deactivateAccount(target.id);
      setSelectedAccount(null);
      setAccounts((current) => current.filter((account) => account.id !== target.id));
      await refreshMemberships(spaces);
      setMessage(`Account ${target.name} deactivated. Historical activity is retained.`);
    } catch (requestError) { setError(requestError.message); }
  }

  async function setAccountRole(accountRole) {
    if (!selectedAccount) return;
    setError(''); setMessage('');
    try {
      const result = await authApi.updateAccountRole(selectedAccount.id, accountRole);
      setSelectedAccount(result.user);
      setAccounts((current) => current.map((account) => account.id === result.user.id ? result.user : account));
      setMessage(`${result.user.name} is now ${accountRole === 'admin' ? 'an Admin' : 'a Member'}.`);
    } catch (requestError) { setError(requestError.message); }
  }

  async function setAccess(spaceId, enabled) {
    if (!selectedAccount) return;
    setBusySpaceId(spaceId); setError(''); setMessage('');
    try {
      if (enabled) await projectApi.addMember(spaceId, { userId: selectedAccount.id, projectRole: 'member' });
      else await projectApi.deleteMember(spaceId, selectedAccount.id);
      await refreshMemberships(spaces);
      setMessage(`${enabled ? 'Granted' : 'Revoked'} access for ${selectedAccount.name}.`);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusySpaceId(null); }
  }

  return <div className="workspace teams-workspace">
    <Sidebar collapsed={collapsed} onToggle={toggleSidebar} spaces={spaces} />
    <div className="workspace-main">
      <div className="topbar"><Link className="mobile-brand" to="/">◆</Link><div className="global-search"><span>⌕</span><input aria-label="Search accounts" placeholder="Search accounts by name or email" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></div>{isAdmin && <Link className="button primary" to="/spaces/new">＋ Create Space</Link>}<div className="top-actions"><button className="avatar-button" type="button" title="Account menu" onClick={() => setAccountOpen((value) => !value)}>{user?.name?.slice(0, 1).toUpperCase()}</button></div>{accountOpen && <div className="top-popover account-popover"><strong>{user?.name}</strong><small>{user?.email}</small><button className="link-button" type="button" onClick={signOut}>Sign out</button></div>}</div>
      <main className="workspace-content teams-content"><div className="view-heading"><div><p className="eyebrow">Administration</p><h1>Accounts and Space access</h1><p>Create separate accounts, then grant or revoke their access to specific Spaces.</p></div></div>
        {error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}
        {!isAdmin && <div className="panel"><h2>Administrator access required</h2><p className="muted">Only application administrators can create accounts or manage Space access.</p><Link className="button subtle" to="/">Return home</Link></div>}
        {isAdmin && <div className="teams-admin-grid">
          <section className="panel"><h2>Create account</h2><p className="muted">Provision a login independently from any Space. Access is assigned after creation.</p><form className="stack-form" onSubmit={createAccount}><label>Account name<input name="name" required maxLength="120" /></label><label>Email<input name="email" type="email" required /></label><label>Temporary password<input name="password" type="password" minLength="8" maxLength="72" required /></label><label>Account role<select name="accountRole" defaultValue="member"><option value="member">Member</option>{isOverallAdmin && <option value="admin">Admin</option>}</select></label><button className="button primary">Create account</button></form></section>
          <section className="panel account-directory"><h2>Existing accounts</h2><p className="muted">Select an account to manage its privileges and Space permissions.</p><div className="account-directory-list">{accounts.map((account) => <button type="button" className={selectedAccount?.id === account.id ? 'selected' : ''} key={account.id} onClick={() => setSelectedAccount(account)}><span className="avatar-mini">{account.name.slice(0, 1).toUpperCase()}</span><span><strong>{account.name}</strong><small>{account.email} · {account.accountRole === 'overall_admin' ? 'Overall Admin' : account.accountRole === 'admin' ? 'Admin' : 'Member'}</small></span></button>)}{!accounts.length && <p className="muted">No matching accounts.</p>}</div></section>
          <section className="panel space-access-panel"><h2>Privileges and Space access</h2>{!selectedAccount && <div className="empty-state"><span>♚</span><h3>Select an account</h3><p>Choose an existing account to grant or revoke privileges and access.</p></div>}{selectedAccount && <><div className="selected-account"><span className="avatar-mini">{selectedAccount.name.slice(0, 1).toUpperCase()}</span><div><strong>{selectedAccount.name}</strong><small>{selectedAccount.email} · {selectedAccount.accountRole === 'overall_admin' ? 'Overall Admin' : selectedAccount.accountRole === 'admin' ? 'Admin' : 'Member'}</small></div></div>{isOverallAdmin && selectedAccount.id !== user?.id && selectedAccount.accountRole !== 'overall_admin' && <div className="account-role-control"><label>Application privilege<select value={selectedAccount.accountRole} onChange={(event) => setAccountRole(event.target.value)}><option value="member">Member</option><option value="admin">Admin</option></select></label><small>Admins can administer every Space. Only the Overall Admin can change this privilege.</small></div>}{selectedAccount.accountRole === 'overall_admin' && <p className="alert success">This is the protected Overall Admin account. Its role cannot be revoked.</p>}{selectedAccount.accountRole === 'admin' && <p className="alert success">This account is an application Admin and has access to every Space. The Overall Admin can revoke this privilege above.</p>}<div className="space-access-list">{selectedMemberships.map(({ space, membership }) => { const locked = selectedIsAdmin || membership?.project_role === 'admin'; const checked = selectedIsAdmin || Boolean(membership); return <label key={space.id}><input type="checkbox" checked={checked} disabled={locked || busySpaceId === space.id} onChange={(event) => setAccess(space.id, event.target.checked)} /><span className="project-avatar">{space.key.slice(0, 1)}</span><span><strong>{space.name}</strong><small>{selectedIsAdmin ? 'Admin access' : membership?.project_role === 'admin' ? 'Space administrator' : membership?.project_role === 'viewer' ? 'Viewer access' : membership ? 'Member access' : 'No access'}</small></span>{busySpaceId === space.id && <small>Saving…</small>}</label>; })}</div>{selectedAccount.id !== user?.id && selectedAccount.accountRole !== 'overall_admin' && (isOverallAdmin || selectedAccount.accountRole === 'member') && <div className="account-deactivation"><p className="muted">Deleting this account revokes login and Space access while retaining all historical activity.</p><button className="button danger" type="button" onClick={deactivateAccount}>Delete account</button></div>}</>}</section>
        </div>}
      </main>
    </div>
  </div>;
}
