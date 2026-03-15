import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TaskListPage from './pages/TaskListPage';
import TaskDetailPage from './pages/TaskDetailPage';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/tasks" element={<TaskListPage />} />
      <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
      <Route path="*" element={<Navigate to="/tasks" replace />} />
    </Routes>
  );
};

export default App;
