"use client";

import { useEffect } from "react";
import {
  DEFAULT_SEO,
  DEFAULT_THEME,
  SEO_PATH,
  THEME_PATH,
  subscribeNode,
  type SeoSettings,
  type ThemeSettings,
} from "@/lib/settings";

/**
 * Applies admin-configured theme accent and SEO tags to the live document.
 * Mounted once at the app root. Non-visual; renders nothing.
 */
export function DynamicSettings() {
  useEffect(() => {
    const unsubTheme = subscribeNode<ThemeSettings>(THEME_PATH, DEFAULT_THEME, (theme) => {
      if (theme.accent) {
        document.documentElement.style.setProperty("--accent", theme.accent);
      }
    });

    const unsubSeo = subscribeNode<SeoSettings>(SEO_PATH, DEFAULT_SEO, (seo) => {
      if (seo.title) document.title = seo.title;
      setMeta("name", "description", seo.description);
      setMeta("property", "og:title", seo.title);
      setMeta("property", "og:description", seo.description);
      if (seo.ogImage) setMeta("property", "og:image", seo.ogImage);
    });

    return () => {
      unsubTheme();
      unsubSeo();
    };
  }, []);

  return null;
}

function setMeta(attr: "name" | "property", key: string, value: string) {
  if (!value) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}
