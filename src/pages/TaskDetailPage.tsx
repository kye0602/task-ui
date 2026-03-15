import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import WSClient from '../ws-client';
import { TaskDetail, HistoryEvent } from '../types';

const statusColors: Record<string, string> = {
  pending: '#999',
  running: '#007bff',
  completed: '#28a745',
  failed: '#dc3545',
  blocked: '#fd7e14',
};

const clampProgress = (value: number) => Math.max(0, Math.min(100, value));

const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const wsClient = useMemo(() => new WSClient('ws://localhost:4001'), []);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;
    setLoading(true);
    setHistoryLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/tasks/${taskId}`),
      fetch(`/api/tasks/${taskId}/history`),
    ])
      .then(async ([taskRes, historyRes]) => {
        if (!taskRes.ok) {
          throw new Error(`Task API failed: ${taskRes.status}`);
        }
        if (!historyRes.ok) {
          throw new Error(`History API failed: ${historyRes.status}`);
        }

        const [taskData, historyData] = await Promise.all([
          taskRes.json(),
          historyRes.json(),
        ]);

        if (cancelled) return;

        setTask({
          ...taskData,
          progress: clampProgress(taskData.progress ?? 0),
        });
        setHistory(Array.isArray(historyData) ? historyData : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError('Failed to load task detail.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    const stopPolling = wsClient.startDetailPolling(taskId, (data: any) => {
      if (data.type === 'polling.update.detail' && data.payload.id === taskId) {
        setTask((prev) => ({
          ...(prev ?? data.payload),
          ...data.payload,
          progress: clampProgress(data.payload.progress ?? prev?.progress ?? 0),
        }));
      }
    });

    return () => {
      stopPolling();
    };
  }, [taskId, wsClient]);

  useEffect(() => {
    function onMessage(data: any) {
      if (data.type === 'task.status.updated' && data.payload.id === taskId) {
        const updatedTask = data.payload;

        setTask((prev) =>
          prev
            ? {
                ...prev,
                ...updatedTask,
                progress: clampProgress(updatedTask.progress ?? prev.progress ?? 0),
              }
            : prev
        );

        setHistory((prev) => {
          const nextEvent: HistoryEvent = {
            timestamp: Date.now(),
            event: updatedTask.status,
            value: updatedTask.progress,
          };

          const last = prev[prev.length - 1];
          const isDuplicate =
            last &&
            last.event === nextEvent.event &&
            last.value === nextEvent.value;

          return isDuplicate ? prev : [...prev, nextEvent];
        });
      }
    }

    wsClient.addListener(onMessage);

    return () => {
      wsClient.removeListener(onMessage);
    };
  }, [taskId, wsClient]);

  if (!taskId) {
    return <div data-testid="detail-empty">Invalid task id.</div>;
  }

  if (loading) {
    return <div data-testid="detail-loading">Loading...</div>;
  }

  if (error) {
    return <div data-testid="detail-error">{error}</div>;
  }

  if (!task) {
    return <div data-testid="detail-not-found">Task not found.</div>;
  }

  const progress = clampProgress(task.progress ?? 0);

  return (
    <div data-testid="detail-container" style={{ padding: 20 }}>
      <h1 data-testid="detail-title">{task.title}</h1>
      <p data-testid="detail-description">{task.description || 'No description'}</p>

      <div
        style={{
          marginTop: 20,
          marginBottom: 20,
          padding: '10px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fafafa',
        }}
      >
        <div style={{ marginBottom: 10, fontWeight: 'bold' }}>Status</div>
        <span
          data-testid="detail-status"
          style={{
            padding: '6px 12px',
            borderRadius: '14px',
            color: 'white',
            backgroundColor: statusColors[task.status] || '#777',
            textTransform: 'capitalize',
            fontSize: '1rem',
            display: 'inline-block',
            marginBottom: 10,
          }}
        >
          {task.status}
        </span>

        <div style={{ marginBottom: 10 }}>
          Stage: <span data-testid="detail-stage">{task.stage || '-'}</span>
        </div>

        <div
          style={{
            height: 24,
            width: '100%',
            backgroundColor: '#eee',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            data-testid="detail-progress-bar"
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: progress >= 100 ? '#28a745' : '#007bff',
              transition: 'width 0.5s ease',
            }}
          />
        </div>

        <div
          data-testid="detail-progress"
          style={{ marginTop: 6, fontSize: '1rem', color: '#555' }}
        >
          {progress} / 100
        </div>
      </div>

      <h2>Timeline</h2>
      <ul data-testid="timeline">
        {historyLoading ? (
          <li data-testid="timeline-loading">Loading history...</li>
        ) : history.length > 0 ? (
          history.map((h) => (
            <li
              key={`${h.timestamp}-${h.event}-${h.value ?? 'na'}`}
              data-testid="timeline-item"
            >
              {new Date(h.timestamp).toLocaleString()} - {h.event}
              {h.value !== undefined ? ` (${h.value})` : ''}
            </li>
          ))
        ) : (
          <li data-testid="timeline-empty">No History</li>
        )}
      </ul>
    </div>
  );
};

export default TaskDetailPage;