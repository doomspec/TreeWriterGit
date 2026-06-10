import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  ArrowUp,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  RefreshCw,
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

type CardItem = {
  id: string;
  title: string;
  subtitle: string;
  filePath: string;
  kind: "index" | "directory" | "file";
  openParentPath: string | null;
};

function flattenFiles(nodes: ModelNode[]): ModelNode[] {
  return nodes.flatMap((node) => (node.type === "file" ? [node] : flattenFiles(node.children ?? [])));
}

function parentPath(pathValue: string) {
  const parts = pathValue.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function indexPathFor(directoryPath: string) {
  return directoryPath ? `${directoryPath}/INDEX.md` : "INDEX.md";
}

function findNode(nodes: ModelNode[], pathValue: string): ModelNode | null {
  for (const node of nodes) {
    if (node.path === pathValue) {
      return node;
    }

    const child = node.children ? findNode(node.children, pathValue) : null;
    if (child) {
      return child;
    }
  }

  return null;
}

function cardsForParent(tree: ModelNode[], currentParentPath: string): CardItem[] {
  const parentNode = currentParentPath ? findNode(tree, currentParentPath) : null;
  const children = currentParentPath ? parentNode?.children ?? [] : tree;
  const parentTitle = currentParentPath ? currentParentPath.split("/").at(-1) ?? "model" : "model";

  return [
    {
      id: `index:${currentParentPath || "root"}`,
      title: `${parentTitle}/INDEX.md`,
      subtitle: currentParentPath || "model",
      filePath: indexPathFor(currentParentPath),
      kind: "index",
      openParentPath: currentParentPath
    },
    ...children
      .filter((child) => child.type === "directory" || child.name.endsWith(".md"))
      .filter((child) => child.name !== "INDEX.md")
      .map((child) => {
        if (child.type === "directory") {
          return {
            id: `directory:${child.path}`,
            title: child.name,
            subtitle: `${child.path}/INDEX.md`,
            filePath: indexPathFor(child.path),
            kind: "directory" as const,
            openParentPath: child.path
          };
        }

        return {
          id: `file:${child.path}`,
          title: child.name,
          subtitle: child.path,
          filePath: child.path,
          kind: "file" as const,
          openParentPath: parentPath(child.path)
        };
      })
  ];
}

function TreeNode({
  node,
  currentParentPath,
  onOpenParent
}: {
  node: ModelNode;
  currentParentPath: string;
  onOpenParent: (path: string) => void;
}) {
  if (node.type === "directory") {
    return (
      <li>
        <button
          type="button"
          className={cn(
            "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-xs font-medium hover:bg-accent",
            currentParentPath === node.path ? "bg-accent text-accent-foreground" : "text-muted-foreground"
          )}
          onClick={() => onOpenParent(node.path)}
        >
          <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{node.name}</span>
        </button>
        <ul className="ml-3 border-l border-border pl-2">
          {(node.children ?? []).map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              currentParentPath={currentParentPath}
              onOpenParent={onOpenParent}
            />
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        className="flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-accent"
        onClick={() => onOpenParent(parentPath(node.path))}
      >
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}

function MarkdownCard({
  item,
  refreshVersion,
  onOpenParent
}: {
  item: CardItem;
  refreshVersion: number;
  onOpenParent: (path: string) => void;
}) {
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirty = content !== loadedContent;

  useEffect(() => {
    const controller = new AbortController();
    const shouldReload = content === loadedContent;

    if (!shouldReload) {
      return () => controller.abort();
    }

    fetch(`${apiBaseUrl}/api/model/file?path=${encodeURIComponent(item.filePath)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${item.filePath}`);
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
          setSaveState("error");
        }
      });

    return () => controller.abort();
  }, [content, item.filePath, loadedContent, refreshVersion]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      const nextContent = content;

      try {
        const response = await fetch(`${apiBaseUrl}/api/model/file`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            path: item.filePath,
            content: nextContent
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to save ${item.filePath}`);
        }

        setLoadedContent(nextContent);
        setSaveState("saved");
        setError(null);
        window.setTimeout(() => setSaveState("idle"), 900);
      } catch (saveError: unknown) {
        setSaveState("error");
        setError(saveError instanceof Error ? saveError.message : String(saveError));
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [content, isDirty, item.filePath]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [content]);

  return (
    <article className="flex min-h-[260px] flex-col rounded-md border border-border bg-card text-card-foreground">
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {item.kind === "directory" ? (
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <h3 className="truncate text-sm font-semibold">{item.title}</h3>
          </div>
          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{saveState === "idle" && isDirty ? "dirty" : saveState}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Open ${item.title} parent`}
            title={item.kind === "directory" ? `Open ${item.title} as parent` : "Open containing parent"}
            onClick={() => item.openParentPath !== null && onOpenParent(item.openParentPath)}
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>
      <textarea
        ref={textareaRef}
        className="min-h-[180px] resize-none overflow-hidden rounded-b-md border-0 bg-card p-3 font-mono text-sm leading-6 outline-none"
        value={content}
        spellCheck={false}
        onChange={(event) => setContent(event.target.value)}
      />
      {error ? <div className="border-t border-border px-3 py-2 text-xs text-destructive">{error}</div> : null}
    </article>
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
  const [currentParentPath, setCurrentParentPath] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [gitSync, setGitSync] = useState<GitSyncState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const files = useMemo(() => flattenFiles(tree), [tree]);
  const currentParentNode = currentParentPath ? findNode(tree, currentParentPath) : null;
  const currentParentName = currentParentPath
    ? currentParentPath.split("/").at(-1) ?? "model"
    : "model";
  const currentCards = useMemo(
    () => cardsForParent(tree, currentParentPath),
    [currentParentPath, tree]
  );
  const canGoUp = Boolean(currentParentPath);

  const loadTree = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/model/tree`);
    if (!response.ok) {
      throw new Error(`Failed to load model tree: ${response.status}`);
    }
    const data = (await response.json()) as { tree: ModelNode[] };
    setTree(data.tree);
  }, []);

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
    if (currentParentPath && (!currentParentNode || currentParentNode.type !== "directory")) {
      setCurrentParentPath("");
    }
  }, [currentParentNode, currentParentPath]);

  useEffect(() => {
    const socket = new WebSocket(modelEventsUrl);
    let reloadTimer: number | undefined;

    socket.addEventListener("message", () => {
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        loadTree().catch(() => {});
        loadGitSyncStatus().catch(() => {});
        setRefreshVersion((version) => version + 1);
      }, 150);
    });

    return () => {
      window.clearTimeout(reloadTimer);
      socket.close();
    };
  }, [loadGitSyncStatus, loadTree]);

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

  const runGitSync = async () => {
    const response = await fetch(`${apiBaseUrl}/api/git-sync/run`, { method: "POST" });
    if (response.ok) {
      setGitSync((await response.json()) as GitSyncState);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden flex-col bg-background text-foreground">
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

      <section className="grid min-h-0 flex-1 grid-cols-[260px_minmax(420px,1fr)_minmax(320px,34vw)]">
        <aside className="min-h-0 overflow-auto border-r border-border bg-muted/20 p-3">
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
          <button
            type="button"
            className={cn(
              "mb-1 flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-xs font-medium hover:bg-accent",
              currentParentPath === "" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
            onClick={() => setCurrentParentPath("")}
          >
            <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">model</span>
          </button>
          <ul className="space-y-1">
            {tree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                currentParentPath={currentParentPath}
                onOpenParent={setCurrentParentPath}
              />
            ))}
          </ul>
        </aside>

        <section className="grid min-h-0 grid-rows-[auto_1fr_auto]">
          <div className="flex h-14 items-center justify-between gap-3 border-b border-border px-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{currentParentName}</h2>
              <p className="truncate text-xs text-muted-foreground">
                {currentParentPath || "model"} · {currentCards.length} cards · autosave enabled
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Open parent folder"
                title="Open parent folder"
                disabled={!canGoUp}
                onClick={() => setCurrentParentPath(parentPath(currentParentPath))}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Refresh cards"
                title="Refresh cards"
                onClick={() => {
                  void loadTree();
                  setRefreshVersion((version) => version + 1);
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 overflow-auto p-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
              {currentCards.map((item) => (
                <MarkdownCard
                  key={item.id}
                  item={item}
                  refreshVersion={refreshVersion}
                  onOpenParent={setCurrentParentPath}
                />
              ))}
            </div>
          </div>

          <footer className="flex h-9 items-center justify-between border-t border-border px-4 text-xs text-muted-foreground">
            <span>{files.length} files</span>
            <span>
              {gitSync?.lastError
                ? `git error: ${gitSync.lastError}`
                : gitSync?.lastSuccessAt
                  ? `last git sync ${new Date(gitSync.lastSuccessAt).toLocaleTimeString()}`
                  : "waiting for git sync"}
            </span>
          </footer>
        </section>

        <aside className="grid min-h-0 grid-rows-[auto_1fr] border-l border-border bg-muted/20">
          <div className="flex h-10 items-center justify-between border-b border-border px-3">
            <div className="flex min-w-0 items-center gap-2">
              <TerminalSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <h2 className="truncate text-xs font-semibold uppercase text-muted-foreground">Terminal</h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Reconnect terminal"
              title="Reconnect terminal"
              onClick={() => setSessionKey((key) => key + 1)}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
          <div ref={terminalElementRef} className="min-h-0 h-full w-full p-2" />
        </aside>
      </section>

      {error ? (
        <div className="fixed bottom-3 right-3 max-w-lg rounded-md border border-destructive bg-background px-3 py-2 text-xs text-destructive shadow">
          {error}
        </div>
      ) : null}
    </main>
  );
}
