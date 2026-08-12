"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getApplications, updateApplication, deleteApplication,
  type Application, type ApplicationStatus,
} from "@/lib/api";

interface UseApplicationsResult {
  applications: Application[];
  loading: boolean;
  error: string | null;
  actionError: string | null;
  updateStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  removeApplication: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/** Single source of truth for the applications list: fetch, optimistic
 * status update with rollback on failure, and delete. Centralised here so
 * every view (Kanban board, future detail page) shares the same CRUD logic
 * and error handling instead of re-implementing it. */
export function useApplications(): UseApplicationsResult {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApplications(await getApplications());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load inline: loading/error mają już właściwe wartości startowe,
  // więc każdy setState siedzi w asynchronicznym callbacku
  // (react-hooks/set-state-in-effect zabrania synchronicznych setState,
  // także pośrednio przez wywołanie fetchApplications()).
  useEffect(() => {
    let cancelled = false;
    getApplications()
      .then((data) => { if (!cancelled) setApplications(data); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load applications.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Poprzedni stan łapany WEWNĄTRZ funkcyjnego settera (nie z domknięcia na
  // `applications`) — równoległe operacje nie rollbackują do stęchłej migawki.
  const updateStatus = useCallback(async (id: string, status: ApplicationStatus) => {
    let previous: ApplicationStatus | undefined;
    setActionError(null);
    setApplications((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      previous = a.status;
      return { ...a, status };
    }));
    try {
      const updated = await updateApplication(id, { status });
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e) {
      console.error(e);
      setActionError(e instanceof Error ? e.message : "Failed to update status.");
      const rollback = previous;
      if (rollback) {
        setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: rollback } : a)));
      }
    }
  }, []);

  const removeApplication = useCallback(async (id: string) => {
    let removed: Application | undefined;
    let removedAt = -1;
    setActionError(null);
    setApplications((prev) => {
      removedAt = prev.findIndex((a) => a.id === id);
      removed = removedAt >= 0 ? prev[removedAt] : undefined;
      return prev.filter((a) => a.id !== id);
    });
    try {
      await deleteApplication(id);
    } catch (e) {
      console.error(e);
      setActionError(e instanceof Error ? e.message : "Failed to delete application.");
      // Rollback wstawia z powrotem tylko usunięty element — nie nadpisuje
      // całej listy migawką, która skasowałaby równoległe zmiany.
      const item = removed;
      if (item) {
        setApplications((prev) => {
          if (prev.some((a) => a.id === item.id)) return prev;
          const copy = [...prev];
          copy.splice(Math.min(Math.max(removedAt, 0), copy.length), 0, item);
          return copy;
        });
      }
    }
  }, []);

  return {
    applications, loading, error, actionError,
    updateStatus, removeApplication, refetch: fetchApplications,
  };
}
