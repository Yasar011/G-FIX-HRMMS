import { get, onValue, ref, set } from "firebase/database";
import { db } from "./firebase";

/**
 * Generic read/write helpers for a single JSON object stored at a Realtime
 * Database path. Used by the config admin modules (SEO, theme, Y-BOT config,
 * general settings) so each doesn't need its own boilerplate.
 */

export function subscribeNode<T>(
  path: string,
  fallback: T,
  callback: (value: T) => void,
  onError?: (error: Error) => void
): () => void {
  return onValue(
    ref(db, path),
    (snapshot) => {
      const value = snapshot.val() as Partial<T> | null;
      callback(value ? { ...fallback, ...value } : fallback);
    },
    (error) => onError?.(error)
  );
}

export async function getNode<T>(path: string, fallback: T): Promise<T> {
  const snapshot = await get(ref(db, path));
  const value = snapshot.val() as Partial<T> | null;
  return value ? { ...fallback, ...value } : fallback;
}

export async function saveNode<T>(path: string, data: T): Promise<void> {
  await set(ref(db, path), data);
}

// ---- SEO ----
export type SeoSettings = {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
};
export const SEO_PATH = "content/seo";
export const DEFAULT_SEO: SeoSettings = {
  title: "Yasar Industries — The Digital Factory",
  description:
    "Yasar C H's portfolio: apparel engineering, IoT automation, software, and creative work, presented as a walk through a digital factory.",
  keywords: "Yasar C H, NIFT Jodhpur, apparel engineering, IoT, GarmentFix, fashion technology, portfolio",
  ogImage: "",
};

// ---- Theme ----
export type ThemeSettings = {
  accent: string;
};
export const THEME_PATH = "content/theme";
export const DEFAULT_THEME: ThemeSettings = {
  accent: "#f59e0b",
};

// ---- Y-BOT config ----
export type YbotConfig = {
  suggestedQuestions: string[];
  extraInstructions: string;
  model: string;
};
export const YBOT_CONFIG_PATH = "content/ybot/config";
export const DEFAULT_YBOT_CONFIG: YbotConfig = {
  suggestedQuestions: [
    "What projects have you built?",
    "Tell me about GarmentFix",
    "What's your apparel background?",
    "What tech do you work with?",
  ],
  extraInstructions: "",
  model: "llama-3.3-70b-versatile",
};

// ---- Y-BOT knowledge (extra facts) ----
export type YbotKnowledge = {
  facts: string[];
};
export const YBOT_KNOWLEDGE_PATH = "content/ybot/knowledge";
export const DEFAULT_YBOT_KNOWLEDGE: YbotKnowledge = { facts: [] };

// ---- General settings ----
export type GeneralSettings = {
  ambienceEnabled: boolean;
  chatbotEnabled: boolean;
  showScrollHint: boolean;
};
export const GENERAL_SETTINGS_PATH = "content/settings";
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  ambienceEnabled: true,
  chatbotEnabled: true,
  showScrollHint: true,
};
