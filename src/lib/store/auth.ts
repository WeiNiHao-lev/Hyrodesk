"use client";

import { create } from "zustand";

/**
 * Client side of accounts and workspace access. Every call goes to the server,
 * which holds the sessions and does every check; nothing here decides access.
 */

export interface Me {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

export interface MeResponse {
  user: Me | null;
  needsSetup: boolean;
  cloud: boolean;
}

export interface SharedWorkspace {
  id: string;
  username: string;
  displayName: string;
  since: string;
  projects: number;
}

export interface WorkspaceAccess {
  open: boolean;
  viewers: { id: string; username: string; displayName: string; since: string }[];
}

export interface AdminView {
  registrationOpen: boolean;
  members: { username: string; displayName: string; isAdmin: boolean; createdAt: string; projects: number }[];
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(json.error ?? `Request failed (${r.status})`));
  return json as T;
}

export const fetchMe = () => call<MeResponse>("/api/auth/me");
export const login = (username: string, password: string) => call<{ ok: true }>("/api/auth/login", "POST", { username, password });
export const register = (b: { username: string; password: string; displayName: string; inviteCode: string }) =>
  call<{ ok: true }>("/api/auth/register", "POST", b);
export const setupAdmin = (b: { username: string; password: string; displayName: string }) =>
  call<{ ok: true; claimedProjects: number }>("/api/auth/setup", "POST", b);
export const logout = () => call<{ ok: true }>("/api/auth/logout", "POST");
export const changePassword = (current: string, next: string) =>
  call<{ ok: true }>("/api/auth/password", "POST", { current, next });

export const getAccess = () => call<WorkspaceAccess>("/api/workspace/access");
export const setAccessPassword = (password: string | null) =>
  call<{ ok: true; open: boolean }>("/api/workspace/access", "PUT", { password });
export const revokeViewer = (viewerId: string) =>
  call<{ ok: true }>(`/api/workspace/access?viewer=${encodeURIComponent(viewerId)}`, "DELETE");

export const openWorkspace = (username: string, password: string) =>
  call<{ ok: true; owner: { id: string; username: string; displayName: string } }>("/api/workspace/open", "POST", { username, password });
export const sharedWorkspaces = () => call<SharedWorkspace[]>("/api/workspace/shared");
export const leaveWorkspace = (ownerId: string) =>
  call<{ ok: true }>(`/api/workspace/shared?owner=${encodeURIComponent(ownerId)}`, "DELETE");

export const adminView = () => call<AdminView>("/api/auth/admin");
export const setInviteCode = (code: string | null) => call<{ ok: true; registrationOpen: boolean }>("/api/auth/admin", "POST", { action: "invite", code });
export const resetMemberPassword = (username: string, password: string) =>
  call<{ ok: true }>("/api/auth/admin", "POST", { action: "reset", username, password });

export interface ApiToken { id: string; label: string; createdAt: string; lastUsedAt: string | null }
export interface CliRequest { code: string; label: string; createdAt: string; status: "pending" | "approved" | "expired" }

export const listTokens = () => call<ApiToken[]>("/api/tokens");
export const revokeToken = (id: string) => call<{ ok: true }>(`/api/tokens?id=${encodeURIComponent(id)}`, "DELETE");
export const getCliRequest = (code: string) => call<CliRequest>(`/api/cli/request?code=${encodeURIComponent(code)}`);
export const answerCliRequest = (code: string, approve: boolean) =>
  call<{ ok: true; status: string }>("/api/cli/approve", "POST", { code, approve });

/** Who is signed in, shared by the navigation bar and the sign-in gate. */
interface AuthState {
  loaded: boolean;
  cloud: boolean;
  me: Me | null;
  needsSetup: boolean;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  loaded: false,
  cloud: false,
  me: null,
  needsSetup: false,
  refresh: async () => {
    try {
      const r = await fetchMe();
      set({ loaded: true, cloud: r.cloud, me: r.user, needsSetup: r.needsSetup });
    } catch {
      // The server could not say: behave as the local, single-user app.
      set({ loaded: true, cloud: false, me: null, needsSetup: false });
    }
  },
}));
