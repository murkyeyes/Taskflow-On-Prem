import { Link, useNavigate } from 'react-router-dom';

import useAuth from '../../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <Link className="brand" to="/projects"><span className="jira-mark">◆</span> Taskflow</Link>
      <nav className="nav-actions">
        <Link to="/projects">Projects</Link>
        <span>{user?.name}</span>
        <button className="button subtle" type="button" onClick={signOut}>Sign out</button>
      </nav>
    </header>
  );
}
