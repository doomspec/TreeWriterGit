/** Close a WebSocket safely, including while still CONNECTING. */
export function closeWebSocket(socket: WebSocket): void {
  if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    return;
  }
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener(
      "open",
      () => {
        socket.close();
      },
      { once: true },
    );
    return;
  }
  socket.close();
}
