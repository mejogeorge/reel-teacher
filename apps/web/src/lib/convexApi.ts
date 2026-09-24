import type { Settings, WordContent, WordStatus } from "@wordcast/shared";
import { makeFunctionReference } from "convex/server";

/**
 * Typed Convex function references by name. Using makeFunctionReference (instead
 * of convex/_generated/api) lets the dashboard build without the Convex link;
 * calls resolve against the deployment at runtime.
 */

export interface WordSummary {
  _id: string;
  word: string;
  slug: string;
  status: WordStatus;
  origin: string;
  themeId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WordDoc extends WordSummary {
  content?: WordContent;
  safety?: { passed: boolean; reasons: string[]; model: string };
  approvedAt?: number;
  rejectedReason?: string;
  error?: { step: string; message: string; at: number };
  runId?: string;
}

export interface Asset {
  _id: string;
  kind: "video" | "thumbnail" | "voice";
  url: string | null;
  durationSec?: number;
  width?: number;
  height?: number;
  bytes: number;
  themeId: string;
  renderVersion: number;
}

export interface EventRow {
  _id: string;
  _creationTime: number;
  type: string;
  message: string;
  level: "info" | "warn" | "error";
  createdAt: number;
  data?: unknown;
}

export interface RunDoc {
  _id: string;
  runDate: string;
  status: "running" | "succeeded" | "failed";
  wordId?: string;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

export interface TodayData {
  runDate: string;
  run: RunDoc | null;
  word: WordDoc | null;
  assets: Asset[];
}

export interface WordDetail {
  word: WordDoc;
  assets: Asset[];
  events: EventRow[];
}

export interface MusicTrack {
  _id: string;
  title: string;
  url: string | null;
  durationSec: number;
  source: string;
  licenseUrl: string;
  attributionText?: string;
  active: boolean;
  mood?: string;
}

export interface BlocklistRow {
  _id: string;
  term: string;
  reason?: string;
}

export interface FallbackRow {
  _id: string;
  word: string;
  lastUsedAt?: number;
}

export interface SystemStatus {
  jobCounts: Record<string, number>;
  latestLease: number;
  recentErrors: EventRow[];
}

export type SettingsDoc = Settings & { _id: string; key: string };

type NoArgs = Record<string, never>;

const q = <Args extends Record<string, unknown>, Return>(name: string) =>
  makeFunctionReference<"query", Args, Return>(name);
const m = <Args extends Record<string, unknown>, Return>(name: string) =>
  makeFunctionReference<"mutation", Args, Return>(name);

export const api = {
  getToday: q<NoArgs, TodayData>("admin:getToday"),
  listWords: q<{ status?: string }, WordSummary[]>("admin:listWords"),
  getWordDetail: q<{ wordId: string }, WordDetail | null>("admin:getWordDetail"),
  listMusic: q<NoArgs, MusicTrack[]>("admin:listMusic"),
  listBlocklist: q<NoArgs, BlocklistRow[]>("admin:listBlocklist"),
  listFallbackWords: q<NoArgs, FallbackRow[]>("admin:listFallbackWords"),
  systemStatus: q<NoArgs, SystemStatus>("admin:systemStatus"),
  getSettings: q<NoArgs, SettingsDoc | null>("settings:get"),

  approveNow: m<{ wordId: string }, null>("admin:approveNow"),
  changeWord: m<{ wordId: string }, null>("admin:changeWord"),
  reject: m<{ wordId: string; reason: string }, null>("admin:reject"),
  regenerate: m<{ wordId: string }, null>("admin:regenerate"),
  rerender: m<{ wordId: string; themeId?: string }, null>("admin:rerender"),
  retryFailed: m<{ wordId: string }, null>("admin:retryFailed"),
  editContent: m<{ wordId: string; content: WordContent }, null>("admin:editContent"),
  addWordManually: m<{ word: string }, string>("admin:addWordManually"),
  addBlocklistTerm: m<{ term: string; reason?: string }, null>("admin:addBlocklistTerm"),
  removeBlocklistTerm: m<{ id: string }, null>("admin:removeBlocklistTerm"),
  addFallbackWords: m<{ words: string[] }, null>("admin:addFallbackWords"),
  createMusicUploadUrl: m<NoArgs, string>("admin:createMusicUploadUrl"),
  addMusicTrack: m<
    {
      title: string;
      storageId: string;
      durationSec: number;
      source: string;
      licenseUrl: string;
      attributionText?: string;
      mood?: string;
    },
    null
  >("admin:addMusicTrack"),
  setMusicActive: m<{ trackId: string; active: boolean }, null>("admin:setMusicActive"),
  updateSettings: m<{ patch: Partial<Settings> }, null>("settings:update"),
  bootstrap: m<NoArgs, null>("admin:bootstrap"),
};
