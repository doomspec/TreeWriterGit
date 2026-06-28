export function WorkspaceLoadingState({
  loading,
  loadingMessage,
  errorMessage = "Could not load view.",
}: {
  loading: boolean;
  loadingMessage: string;
  errorMessage?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      {loading ? loadingMessage : errorMessage}
    </div>
  );
}
