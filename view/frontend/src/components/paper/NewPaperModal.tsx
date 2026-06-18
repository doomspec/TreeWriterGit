import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createPaper, fetchJournalTemplates } from "@/modelApi";

export function NewPaperModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (path: string) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [journal, setJournal] = useState("");
  const [authors, setAuthors] = useState("");
  const [slug, setSlug] = useState("");
  const [journals, setJournals] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchJournalTemplates()
      .then((data) => {
        setJournals(data.journals);
        if (data.journals[0]) setJournal(data.journals[0]);
      })
      .catch(() => setJournals(["PLOS ONE"]));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      onError("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const authorList = authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const result = await createPaper({
        title: title.trim(),
        journal: journal.trim() || "PLOS ONE",
        authors: authorList,
        slug: slug.trim() || undefined,
      });
      onCreated(result.path);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="new-paper-title"
        className="w-full max-w-md rounded-md border border-border bg-background shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="new-paper-title" className="text-sm font-semibold">
            New paper
          </h2>
          <button type="button" className="rounded-sm p-1 hover:bg-accent" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-3 px-4 py-4" onSubmit={(e) => void handleSubmit(e)}>
          <label className="block text-xs">
            <span className="mb-1 block font-medium">Title</span>
            <input
              className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-medium">Journal template</span>
            <select
              className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
            >
              {(journals.length > 0 ? journals : ["PLOS ONE"]).map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-medium">Authors (comma-separated)</span>
            <input
              className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="Alice Smith, Bob Jones"
            />
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-medium">Slug (optional)</span>
            <input
              className="h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="h-8 px-3 text-xs" disabled={submitting}>
              {submitting ? "Creating…" : "Create paper"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
