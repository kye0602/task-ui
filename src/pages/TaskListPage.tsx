import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import WSClient from '../ws-client';
import { Task } from '../types';

const statusColors: Record<string, string> = {
  pending: '#999',
  running: '#007bff',
  completed: '#28a745',
  failed: '#dc3545',
  blocked: '#fd7e14',
};

const clampProgress = (value: number) => Math.max(0, Math.min(100, value));

const TaskListPage: React.FC = () => {
  const wsClient = useMemo(() => new WSClient('ws://localhost:4001'), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/tasks')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Task list API failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTasks(
          Array.isArray(data)
            ? data.map((task) => ({
                ...task,
                progress: clampProgress(task.progress ?? 0),
              }))
            : []
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError('Failed to load tasks.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onMessage(data: any) {
      if (data.type === 'polling.update') {
        setTasks(
          Array.isArray(data.payload)
            ? data.payload.map((task: Task) => ({
                ...task,
                progress: clampProgress(task.progress ?? 0),
              }))
            : []
        );
      } else if (data.type === 'task.status.updated') {
        const updatedTask = data.payload;
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === updatedTask.id);
          if (idx === -1) return prev;

          const next = [...prev];
          next[idx] = {
            ...next[idx],
            ...updatedTask,
            progress: clampProgress(updatedTask.progress ?? next[idx].progress ?? 0),
          };
          return next;
        });
      }
    }

    wsClient.addListener(onMessage);

    return () => {
      wsClient.removeListener(onMessage);
    };
  }, [wsClient]);

  if (loading) {
    return <div data-testid="task-list-loading">Loading...</div>;
  }

  if (error) {
    return <div data-testid="task-list-error">{error}</div>;
  }

  return (
    <div data-testid="task-list-container">
      <h1>Task List</h1>

      {tasks.length === 0 ? (
        <div data-testid="task-list-empty">No tasks</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {tasks.map((task) => {
            const progress = clampProgress(task.progress ?? 0);

            return (
              <li
                key={task.id}
                data-testid={`task-row-${task.id}`}
                style={{
                  border: '1px solid #ddd',
                  padding: '10px',
                  marginBottom: '10px',
                  borderRadius: '5px',
                }}
              >
                <Link
                  to={`/tasks/${task.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      data-testid={`task-title-${task.id}`}
                      style={{ fontWeight: 'bold' }}
                    >
                      {task.title}
                    </div>

                    <span
                      data-testid={`task-status-${task.id}`}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        color: 'white',
                        backgroundColor: statusColors[task.status] || '#777',
                        textTransform: 'capitalize',
                        fontSize: '0.8rem',
                      }}
                    >
                      {task.status}
                    </span>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div
                      style={{
                        height: 12,
                        width: '100%',
                        backgroundColor: '#eee',
                        borderRadius: 6,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        data-testid={`task-progress-bar-${task.id}`}
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          backgroundColor: progress >= 100 ? '#28a745' : '#007bff',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>

                    <div
                      data-testid={`task-progress-${task.id}`}
                      style={{ marginTop: 4, fontSize: '0.8rem', color: '#555' }}
                    >
                      {progress} / 100
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#555' }}>
                      Stage:{' '}
                      <span data-testid={`task-stage-${task.id}`}>
                        {task.stage || '-'}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TaskListPage;