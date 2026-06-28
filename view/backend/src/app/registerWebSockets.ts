import type { Server } from "node:http";
import type { WebSocketServer } from "ws";

export type WebSocketUpgradeRuntime = {
  terminalServer: WebSocketServer;
  modelEventsServer: WebSocketServer;
};

export function attachWebSocketUpgrade(runtime: WebSocketUpgradeRuntime, server: Server): void {
  const wsToken = process.env.TREEWRITER_WS_TOKEN?.trim();
  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (wsToken) {
      const token =
        requestUrl.searchParams.get("token") ??
        (typeof request.headers["x-treewriter-token"] === "string"
          ? request.headers["x-treewriter-token"]
          : "");
      if (token !== wsToken) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }
    const websocketServer =
      requestUrl.pathname === "/terminal"
        ? runtime.terminalServer
        : requestUrl.pathname === "/model-events"
          ? runtime.modelEventsServer
          : null;

    if (!websocketServer) {
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request);
    });
  });
}
