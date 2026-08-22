import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import * as authApi from '../api/auth.api';
import useAuth from '../hooks/useAuth';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [registerMode, setRegisterMode] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/projects" replace />;
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (registerMode) {
        await authApi.register(form);
      }
      await login({ email: form.email, password: form.password });
      navigate('/projects');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card stack-form" onSubmit={submit}>
        <div className="auth-brand"><span className="auth-logo">◆</span><strong>TASKFLOW</strong></div>
        <div className="auth-heading"><h1>{registerMode ? 'Create your account' : 'Log in to continue'}</h1><p>Use your Taskflow workspace account</p></div>
        {error && <p className="alert error">{error}</p>}
        {registerMode && <label>Name<input required value={form.name} onChange={(event) => setField('name', event.target.value)} /></label>}
        <label>Email<input required type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} /></label>
        <label>Password<input required minLength="8" type="password" value={form.password} onChange={(event) => setField('password', event.target.value)} /></label>
        <button className="button primary auth-submit" disabled={busy} type="submit">{busy ? 'Working…' : registerMode ? 'Create account' : 'Continue'}</button>
        <button className="button link-button" type="button" onClick={() => setRegisterMode((value) => !value)}>
          {registerMode ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
      </form>
      <div className="auth-art auth-art-left"><span>▦</span><i>✓</i><b>⌁</b></div><div className="auth-art auth-art-right"><span>⌕</span><i>▤</i><b>◆</b></div>
    </main>
  );
}
