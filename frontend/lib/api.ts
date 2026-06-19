const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// --- Types ---

export type ApplicationStatus = "applied" | "interview" | "offer" | "rejected";

export interface Application {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  match_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyseResult {
  match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
  summary: string;
}

// --- API helpers ---

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Applications ---

export const getApplications = () =>
  request<Application[]>("/applications/");

export const createApplication = (data: {
  company: string;
  role: string;
  match_score?: number;
  notes?: string;
}) => request<Application>("/applications/", { method: "POST", body: JSON.stringify(data) });

export const updateApplication = (id: string, data: { status?: ApplicationStatus; notes?: string }) =>
  request<Application>(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteApplication = (id: string) =>
  request<void>(`/applications/${id}`, { method: "DELETE" });

// --- Analyse ---

export const analyseCV = (cv: string, job_description: string) =>
  request<AnalyseResult>("/analyse/", {
    method: "POST",
    body: JSON.stringify({ cv, job_description }),
  });

// --- PDF ---

export interface PdfExtractResult {
  text: string;
}

export async function uploadPDF(file: File): Promise<PdfExtractResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/pdf/extract`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error((err as { detail?: string }).detail ?? "Upload failed");
  }
  return res.json() as Promise<PdfExtractResult>;
}

// --- Tailor ---

export interface TailorResult {
  tailored_cv: string;
}

export async function tailorCV(req: {
  cv: string;
  job_description: string;
  missing_keywords: string[];
  suggestions: string[];
}): Promise<TailorResult> {
  return request<TailorResult>("/tailor/", { method: "POST", body: JSON.stringify(req) });
}
