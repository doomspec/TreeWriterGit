import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  FileText,
  Folder,
  GitBranch,
  RefreshCw,
  Save,
  TerminalSquare
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const terminalUrl = import.meta.env.VITE_TERMINAL_WS_URL ?? "ws://localhost:4000/terminal";
const modelEventsUrl = import.meta.env.VITE_MODEL_EVENTS_WS_URL ?? "ws://localhost:4000/model-events";

type ConnectionState = "connecting" | "connected" | "closed";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type ModelNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children?: ModelNode[];
};

type GitSyncState = {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

function flattenFiles(nodes: ModelNode[]): ModelNode[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node] : flattenFiles(node.children ?? [])
  );
}

function TreeNode({
  node,
  selectedPath,
  onSelect
}: {
  node: ModelNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  if (node.type === "directory") {
    return (
      <li>
        <div className="flex h-7 items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
          <Folder className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="truncate">{node.name}</span>
        </div>
        <ul className="ml-3 border-l border-border pl-2">
          {(node.children ?? []).map((child) => (
            <TreeNode key={child.path} node={child} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        className={cn(
          "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-accent",
          selectedPath === node.path && "bg-accent text-accent-foreground"
        )}
        onClick={() => onSelect(node.path)}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}

export default function App() {
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [sessionKey, setSessionKey] = useState(0);
  const [tree, setTree] = useState<ModelNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [gitSync, setGitSync] = useState<GitSyncState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const files = useMemo(() => flattenFiles(tree), [tree]);
  const selectedFileName = selectedPath?.split("/").at(-1) ?? "Select a file";
  const isDirty = content !== loadedContent;

  const loadTree = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/model/tree`);
    if (!response.ok) {
      throw new Error(`Failed to load model tree: ${response.status}`);
    }
    const data = (await response.json()) as { tree: ModelNode[] };
    setTree(data.tree);

    if (!selectedPath) {
      const firstFile = flattenFiles(data.tree).find((file) => file.name.endsWith(".md"));
      if (firstFile) {
        setSelectedPath(firstFile.path);
      }
    }
  }, [selectedPath]);

  const loadGitSyncStatus = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/git-sync/status`);
    if (response.ok) {
      setGitSync((await response.json()) as GitSyncState);
    }
  }, []);

  useEffect(() => {
    loadTree().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    });
    loadGitSyncStatus().catch(() => {});
  }, [loadGitSyncStatus, loadTree]);

  useEffect(() => {
    if (!selectedPath) {
      return;
    }

    const controller = new AbortController();
    fetch(`${apiBaseUrl}/api/model/file?path=${encodeURIComponent(selectedPath)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.status}`);
        }
        return (await response.json()) as { content: string };
      })
      .then((data) => {
        setContent(data.content);
        setLoadedContent(data.content);
        setSaveState("idle");
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      });

    return () => controller.abort();
  }, [selectedPath]);

  useEffect(() => {
    if (!selectedPath || !isDirty || saveState === "saving") {
      return;
    }
    setSaveState("dirty");
  }, [isDirty, saveState, selectedPath]);

  useEffect(() => {
    const socket = new WebSocket(modelEventsUrl);
    let reloadTimer: number | undefined;

    socket.addEventListener("message", () => {
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        loadTree().catch(() => {});
        loadGitSyncStatus().catch(() => {});

        if (selectedPath && !isDirty) {
          fetch(`${apiBaseUrl}/api/model/file?path=${encodeURIComponent(selectedPath)}`)
            .then((response) => response.json())
            .then((data: { content: string }) => {
              setContent(data.content);
              setLoadedContent(data.content);
            })
            .catch(() => {});
        }
      }, 150);
    });

    return () => {
      window.clearTimeout(reloadTimer);
      socket.close();
    };
  }, [isDirty, loadGitSyncStatus, loadTree, selectedPath]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadGitSyncStatus().catch(() => {});
    }, 10_000);

    return () => window.clearInterval(timer);
  }, [loadGitSyncStatus]);

  useEffect(() => {
    if (!terminalElementRef.current) {
      return;
    }

    setConnectionState("connecting");

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      theme: {
        background: "#111315",
        foreground: "#eceff1",
        cursor: "#ffffff",
        selectionBackground: "#3b4754"
      }
    });
    const fitAddon = new FitAddon();
    const socket = new WebSocket(terminalUrl);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    socketRef.current = socket;

    terminal.loadAddon(fitAddon);
    terminal.open(terminalElementRef.current);
    fitAddon.fit();
    terminal.focus();

    const sendResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
      }
    };

    const resizeObserver = new ResizeObserver(sendResize);
    resizeObserver.observe(terminalElementRef.current);

    const dataDisposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    socket.addEventListener("open", () => {
      setConnectionState("connected");
      sendResize();
    });
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        terminal.write(event.data);
      }
    });
    socket.addEventListener("close", () => {
      setConnectionState("closed");
      terminal.writeln("\r\n[terminal disconnected]");
    });
    socket.addEventListener("error", () => {
      setConnectionState("closed");
      terminal.writeln("\r\n[terminal websocket error]");
    });

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      socket.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      socketRef.current = null;
    };
  }, [sessionKey]);

  const saveFile = async () => {
    if (!selectedPath) {
      return;
    }

    setSaveState("saving");
    const response = await fetch(`${apiBaseUrl}/api/model/file`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: selectedPath,
        content
      })
    });

    if (!response.ok) {
      setSaveState("error");
      setError(`Failed to save file: ${response.status}`);
      return;
    }

    setLoadedContent(content);
    setSaveState("saved");
    setError(null);
    window.setTimeout(() => setSaveState("idle"), 1200);
  };

  const runGitSync = async () => {
    const response = await fetch(`${apiBaseUrl}/api/git-sync/run`, { method: "POST" });
    if (response.ok) {
      setGitSync((await response.json()) as GitSyncState);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <TerminalSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
          <h1 className="text-sm font-semibold">TreeWriter</h1>
          <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            terminal {connectionState}
          </span>
          <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            git {gitSync?.enabled ? (gitSync.running ? "syncing" : "enabled") : "disabled"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Run Git sync"
            title="Run Git sync"
            onClick={() => void runGitSync()}
          >
            <GitBranch className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Reconnect terminal"
            title="Reconnect terminal"
            onClick={() => setSessionKey((key) => key + 1)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(280px,32vw)_minmax(360px,1fr)]">
        <aside className="grid min-h-0 grid-rows-[42%_58%] border-r border-border bg-muted/20">
          <div className="min-h-0 border-b border-border">
            <div ref={terminalElementRef} className="h-full w-full p-2" />
          </div>
          <div className="min-h-0 overflow-auto p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">Model</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refresh model tree"
                title="Refresh model tree"
                onClick={() => void loadTree()}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            <ul className="space-y-1">
              {tree.map((node) => (
                <TreeNode key={node.path} node={node} selectedPath={selectedPath} onSelect={setSelectedPath} />
              ))}
            </ul>
          </div>
        </aside>

        <section className="grid min-h-0 grid-rows-[auto_1fr_auto]">
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{selectedFileName}</h2>
              <p className="truncate text-xs text-muted-foreground">{selectedPath ?? "No file selected"}</p>
            </div>
            <Button
              type="button"
              disabled={!selectedPath || saveState === "saving" || !isDirty}
              onClick={() => void saveFile()}
            >
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              Save
            </Button>
          </div>

          <textarea
            className="min-h-0 w-full resize-none border-0 bg-background p-4 font-mono text-sm leading-6 outline-none"
            value={content}
            disabled={!selectedPath}
            spellCheck={false}
            onChange={(event) => setContent(event.target.value)}
          />

          <footer className="flex h-9 items-center justify-between border-t border-border px-4 text-xs text-muted-foreground">
            <span>{saveState === "idle" && isDirty ? "dirty" : saveState}</span>
            <span>
              {gitSync?.lastError
                ? `git error: ${gitSync.lastError}`
                : gitSync?.lastSuccessAt
                  ? `last git sync ${new Date(gitSync.lastSuccessAt).toLocaleTimeString()}`
                  : `${files.length} files`}
            </span>
          </footer>
        </section>
      </section>

      {error ? (
        <div className="fixed bottom-3 right-3 max-w-lg rounded-md border border-destructive bg-background px-3 py-2 text-xs text-destructive shadow">
          {error}
        </div>
      ) : null}
    </main>
  );
}

