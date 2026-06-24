import type {
  StoredDiscussion,
  DiscussionListItem,
  DiscussionPhase,
} from "@/storage/types";

// Roundtable history lives in the database (via /api/discussions). localStorage
// is kept only for the *live* transcript, so a reload mid-run (or after the
// server stream dies) still shows what happened — the server run can't be
// resumed, but the transcript survives.

export type { DiscussionListItem, DiscussionPhase };

/** The on-screen discussion; `userId` is attached server-side when saved. */
export type SavedSession = Omit<StoredDiscussion, "userId">;

const CURRENT_KEY = "roundtable:current";

export function loadCurrent(): SavedSession | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

export function saveCurrent(s: SavedSession | null): void {
  try {
    if (s === null) localStorage.removeItem(CURRENT_KEY);
    else localStorage.setItem(CURRENT_KEY, JSON.stringify(s));
  } catch {
    // Quota exceeded or unavailable — non-fatal, just lose local persistence.
  }
}

// --- DB-backed history (the page is auth-gated, so the user is always set) ---

export async function listDiscussions(): Promise<DiscussionListItem[]> {
  try {
    const res = await fetch("/api/discussions");
    return res.ok ? ((await res.json()) as DiscussionListItem[]) : [];
  } catch {
    return [];
  }
}

export async function getDiscussion(id: string): Promise<SavedSession | null> {
  try {
    const res = await fetch(`/api/discussions/${id}`);
    return res.ok ? ((await res.json()) as SavedSession) : null;
  } catch {
    return null;
  }
}

export async function saveDiscussion(s: SavedSession): Promise<void> {
  try {
    await fetch("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
  } catch {
    // Non-fatal: the live transcript still persists in localStorage.
  }
}

export async function deleteDiscussion(id: string): Promise<void> {
  try {
    await fetch(`/api/discussions/${id}`, { method: "DELETE" });
  } catch {
    // Non-fatal.
  }
}
