import { Navigate, Route, Routes } from 'react-router-dom';

import Navbar from './components/common/Navbar';
import useAuth from './hooks/useAuth';
import IssueDetailPage from './pages/IssueDetailPage';
import LoginPage from './pages/LoginPage';
import ProjectBoardPage from './pages/ProjectBoardPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import ProjectSummaryPage from './pages/ProjectSummaryPage';
import ProjectBacklogPage from './pages/ProjectBacklogPage';
import ProjectTimelinePage from './pages/ProjectTimelinePage';
import ProjectDevelopmentPage from './pages/ProjectDevelopmentPage';
import ProjectDocsPage from './pages/ProjectDocsPage';
import ProjectFormsPage from './pages/ProjectFormsPage';
import WorkspaceShell from './components/layout/WorkspaceShell';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="page-center">Loading…</main>;
  return user ? children : <Navigate to="/login" replace />;
}

function Shell({ children }) {
  return <><Navbar /><main className="page-shell">{children}</main></>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/projects" element={<ProtectedRoute><Shell><ProjectListPage /></Shell></ProtectedRoute>} />
      <Route path="/projects/:projectId" element={<ProtectedRoute><WorkspaceShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="summary" replace />} />
        <Route path="summary" element={<ProjectSummaryPage />} />
        <Route path="backlog" element={<ProjectBacklogPage />} />
        <Route path="board" element={<ProjectBoardPage />} />
        <Route path="timeline" element={<ProjectTimelinePage />} />
        <Route path="development" element={<ProjectDevelopmentPage />} />
        <Route path="docs" element={<ProjectDocsPage />} />
        <Route path="forms" element={<ProjectFormsPage />} />
        <Route path="settings" element={<ProjectSettingsPage />} />
      </Route>
      <Route path="/issues/:issueKey" element={<ProtectedRoute><Shell><IssueDetailPage /></Shell></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
