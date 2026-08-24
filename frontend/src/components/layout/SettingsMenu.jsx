import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function SettingsMenu({ isAdmin }) {
  const [open, setOpen] = useState(false);
  return <div className="settings-menu-wrap"><button className="top-action-button" type="button" title="Settings" aria-label="Open settings" onClick={() => setOpen((value) => !value)}>⚙</button>{open && <div className="top-popover settings-menu">
    <strong>Personal settings</strong>
    <Link to="/settings/general" onClick={() => setOpen(false)}><span>♙</span><div><b>General settings</b><small>Language, time zone, and password</small></div></Link>
    <Link to="/settings/notifications" onClick={() => setOpen(false)}><span>♧</span><div><b>Notification settings</b><small>Email and in-app preferences</small></div></Link>
    {isAdmin && <><strong>Taskflow Admin settings</strong>
      <Link to="/settings/system" onClick={() => setOpen(false)}><span>▣</span><div><b>System</b><small>General configuration and security</small></div></Link>
      <Link to="/settings/apps" onClick={() => setOpen(false)}><span>▦</span><div><b>Apps</b><small>Built-in services and integrations</small></div></Link>
      <Link to="/settings/spaces" onClick={() => setOpen(false)}><span>♢</span><div><b>Spaces</b><small>Manage Spaces and templates</small></div></Link>
      <Link to="/settings/work-items" onClick={() => setOpen(false)}><span>▤</span><div><b>Work items</b><small>Types and workflow references</small></div></Link>
    </>}
  </div>}</div>;
}
