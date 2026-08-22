export default function RoleGuard({ role, allow, children }) {
  return allow.includes(role) ? children : null;
}
