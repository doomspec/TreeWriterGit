import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CommandPalette } from "@/components/commands/CommandPalette";
import type { AppCommand } from "@/lib/commandPaletteTypes";
import {
  buildChordIndex,
  DEFAULT_COMMAND_CHORDS,
  loadKeyboardBindings,
  resolveCommandChord,
  saveKeyboardBindings,
} from "@/lib/keyboardBindings";
import { chordFromKeyboardEvent, eventMatchesChord, isTypingTarget } from "@/lib/keyboardChords";

type CommandPaletteContextValue = {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  registerCommands: (commands: AppCommand[]) => () => void;
  executeCommand: (commandId: string) => void;
  getChord: (commandId: string) => string | undefined;
  setBinding: (commandId: string, chord: string | null) => void;
  resetBindings: () => void;
  bindings: Record<string, string>;
  allDefaultChords: Record<string, string>;
  commands: AppCommand[];
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [bindings, setBindings] = useState<Record<string, string>>(() => loadKeyboardBindings());
  const commandsRef = useRef(new Map<string, AppCommand>());
  const [commandVersion, setCommandVersion] = useState(0);

  const refresh = useCallback(() => setCommandVersion((value) => value + 1), []);

  const registerCommands = useCallback(
    (commands: AppCommand[]) => {
      for (const command of commands) {
        commandsRef.current.set(command.id, command);
      }
      refresh();
      return () => {
        for (const command of commands) {
          commandsRef.current.delete(command.id);
        }
        refresh();
      };
    },
    [refresh],
  );

  const commands = useMemo(
    () =>
      Array.from(commandsRef.current.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    [commandVersion],
  );

  const getChord = useCallback(
    (commandId: string) => resolveCommandChord(commandId, bindings),
    [bindings],
  );

  const executeCommand = useCallback(
    (commandId: string) => {
      const command = commandsRef.current.get(commandId);
      if (!command || command.when?.() === false) return;
      void command.run();
    },
    [],
  );

  const setBinding = useCallback((commandId: string, chord: string | null) => {
    setBindings((current) => {
      const next = { ...current };
      if (!chord) delete next[commandId];
      else next[commandId] = chord;
      saveKeyboardBindings(next);
      return next;
    });
  }, []);

  const resetBindings = useCallback(() => {
    setBindings({});
    saveKeyboardBindings({});
  }, []);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const paletteChord = resolveCommandChord("palette.open", bindings);
      const paletteAlt = resolveCommandChord("palette.open.alt", bindings);
      if (
        (paletteChord && eventMatchesChord(event, paletteChord)) ||
        (paletteAlt && eventMatchesChord(event, paletteAlt))
      ) {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if (open) return;

      const typing = isTypingTarget(event.target);
      if (typing && !eventMatchesChord(event, "Mod+K")) return;

      const commandIds = Array.from(commandsRef.current.keys());
      const chordIndex = buildChordIndex(commandIds, bindings);
      const pressed = chordFromKeyboardEvent(event);
      if (!pressed) return;
      const commandId = chordIndex.get(pressed.toLowerCase());
      if (!commandId) return;

      const command = commandsRef.current.get(commandId);
      if (!command || command.when?.() === false) return;

      event.preventDefault();
      void command.run();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings, open]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      open,
      openPalette,
      closePalette,
      registerCommands,
      executeCommand,
      getChord,
      setBinding,
      resetBindings,
      bindings,
      allDefaultChords: DEFAULT_COMMAND_CHORDS,
      commands,
    }),
    [
      bindings,
      closePalette,
      commands,
      executeCommand,
      getChord,
      open,
      openPalette,
      registerCommands,
      resetBindings,
      setBinding,
    ],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette
        open={open}
        commands={commands}
        getChord={getChord}
        onExecute={executeCommand}
        onClose={closePalette}
      />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

/** Safe optional hook for components outside provider during tests. */
export function useCommandPaletteOptional(): CommandPaletteContextValue | null {
  return useContext(CommandPaletteContext);
}
