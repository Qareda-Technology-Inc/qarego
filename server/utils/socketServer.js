// The Socket.IO server, for code that runs outside a request (payment webhooks, schedulers).
let ioInstance = null;

export function setSocketServer(io) {
  ioInstance = io;
}

export function getSocketServer() {
  return ioInstance;
}
