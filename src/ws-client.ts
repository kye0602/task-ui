type Listener = (data: any) => void;

class WSClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectInterval = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<Listener> = new Set();
  private isPolling = false;
  private pollingInterval = 7000;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private emit(data: any) {
    this.listeners.forEach((cb) => cb(data));
  }

  private connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.stopPolling();
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected, trying to reconnect...');
      this.scheduleReconnect();
      this.startPolling();
    };

    this.ws.onerror = () => {
      console.log('WebSocket error');
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    }
  }

  private startPolling() {
    if (this.isPolling) return;

    this.isPolling = true;
    this.pollingTimer = setInterval(() => {
      fetch('/api/tasks')
        .then((res) => res.json())
        .then((data) => {
          this.emit({ type: 'polling.update', payload: data });
        })
        .catch(console.error);
    }, this.pollingInterval);
  }

  private stopPolling() {
    if (!this.isPolling) return;

    this.isPolling = false;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  public addListener(cb: Listener) {
    this.listeners.add(cb);
  }

  public removeListener(cb: Listener) {
    this.listeners.delete(cb);
  }

  public startDetailPolling(taskId: string, onUpdate: Listener) {
    const detailInterval = setInterval(() => {
      fetch(`/api/tasks/${taskId}`)
        .then((res) => res.json())
        .then((data) => {
          onUpdate({ type: 'polling.update.detail', payload: data });
        })
        .catch(console.error);
    }, this.pollingInterval);

    return () => clearInterval(detailInterval);
  }
}

export default WSClient;
