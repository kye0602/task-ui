const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const port = 4000;

app.use(cors());
app.use(express.json());

const tasks = [
  { id: 't1', title: 'Task T1', status: 'pending', stage: 'start', progress: 0, description: 'Task T1 detail' },
  { id: 't2', title: 'Task T2', status: 'running', stage: 'processing', progress: 45, description: 'Task T2 detail' },
  { id: 't3', title: 'Task T3', status: 'completed', stage: 'done', progress: 100, description: 'Task T3 detail' }
];

const histories = {
  t1: [
    { timestamp: Date.now() - 600000, event: 'task_created' },
    { timestamp: Date.now() - 300000, event: 'start', value: 0 }
  ],
  t2: [
    { timestamp: Date.now() - 1200000, event: 'task_created' },
    { timestamp: Date.now() - 900000, event: 'progress_update', value: 45 }
  ],
  t3: [
    { timestamp: Date.now() - 1800000, event: 'task_created' },
    { timestamp: Date.now() - 300000, event: 'completed' }
  ]
};

app.get('/api/tasks', (_req, res) => {
  const smallTasks = tasks.map(({ description, ...rest }) => rest);
  res.json(smallTasks);
});

app.get('/api/tasks/:taskId', (req, res) => {
  const task = tasks.find((t) => t.id === req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'task_not_found' });
  }
  res.json(task);
});

app.get('/api/tasks/:taskId/history', (req, res) => {
  const history = histories[req.params.taskId] || [];
  res.json(history);
});

app.listen(port, () => {
  console.log(`Mock API server running at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ port: 4001 });
let updateStep = 0;

wss.on('connection', (ws) => {
  console.log('WebSocket connected');

  const sendStatusUpdate = () => {
    const task = tasks.find((t) => t.id === 't1');
    if (!task) return;

    if (updateStep === 0) {
      task.status = 'running';
      task.stage = 'processing';
      task.progress = 45;
      updateStep += 1;
    } else if (updateStep === 1) {
      task.status = 'completed';
      task.stage = 'done';
      task.progress = 100;
      updateStep += 1;
    }

    ws.send(
      JSON.stringify({
        type: 'task.status.updated',
        payload: {
          id: task.id,
          title: task.title,
          status: task.status,
          stage: task.stage,
          progress: task.progress
        }
      })
    );
  };

  const interval = setInterval(sendStatusUpdate, 5000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('WebSocket disconnected');
  });
});

console.log('Mock WebSocket server running at ws://localhost:4001');