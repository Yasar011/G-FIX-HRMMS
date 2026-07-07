/**
 * Profile page — the signed-in user's own account: display name, avatar
 * (Firebase Storage), password change, theme preference, session info.
 */
import { currentUser, roleLabel, updateUserProfile, logout } from "../lib/auth.js";
import { auth, updateProfile, updatePassword, storage, sRef, uploadBytes, getDownloadURL } from "../lib/firebase.js";
import { toast } from "../lib/ui.js";
import { statRow } from "../components/kpi.js";
import { el, initials, timeAgo, esc } from "../lib/utils.js";
import { setTheme } from "../lib/ui.js";

export async function render(root) {
  const u = currentUser;
  if (!u) return;

  /* ---------- avatar upload ---------- */
  const photoInput = el("input", { type: "file", accept: "image/*", class: "hidden" });
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    try {
      toast("Uploading…");
      const path = sRef(storage, `avatars/${u.uid}/${Date.now()}`);
      await uploadBytes(path, file);
      const url = await getDownloadURL(path);
      await updateUserProfile(u.uid, { photo: url });
      toast("Photo updated", "ok");
    } catch (e) { console.error(e); toast("Upload failed (is Firebase Storage enabled?)", "err"); }
  });

  /* ---------- name + password ---------- */
  const nameInput = el("input", { type: "text", value: u.name || "" });
  const passInput = el("input", { type: "password", placeholder: "New password (min 6 chars)", autocomplete: "new-password" });

  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "My Profile")),

    el("div", { class: "card profile-hero" },
      el("div", { class: "avatar" }, u.photo ? el("img", { src: u.photo, alt: "" }) : initials(u.name || u.email)),
      el("div", { style: { flex: 1 } },
        el("h3", {}, u.name || u.email),
        el("p", { class: "muted" }, u.email),
        el("div", { class: "profile-meta" },
          el("span", { class: "chip" }, roleLabel(u.role)),
          u.department ? el("span", { class: "chip" }, u.department) : null)),
      el("div", {}, photoInput,
        el("button", { class: "btn btn-sm", onclick: () => photoInput.click() }, "📷 Change photo"))),

    el("div", { class: "grid grid-2" },
      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h4", {}, "Account")),
        el("label", { class: "field" }, el("span", {}, "Display name"), nameInput),
        el("button", {
          class: "btn btn-primary",
          onclick: async () => {
            const name = nameInput.value.trim();
            if (!name) { toast("Name cannot be empty", "warn"); return; }
            await updateUserProfile(u.uid, { name });
            if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });
            toast("Name updated", "ok");
          },
        }, "Save name"),
        el("hr", { style: { border: "none", borderTop: "1px solid var(--line)", margin: "16px 0" } }),
        el("label", { class: "field" }, el("span", {}, "Change password"), passInput),
        el("button", {
          class: "btn",
          onclick: async () => {
            const p = passInput.value;
            if (p.length < 6) { toast("Password must be at least 6 characters", "warn"); return; }
            try {
              await updatePassword(auth.currentUser, p);
              passInput.value = "";
              toast("Password changed", "ok");
            } catch (e) {
              toast(e.code === "auth/requires-recent-login" ? "Please sign out and back in, then retry" : "Could not change password", "err");
            }
          },
        }, "Update password")),

      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h4", {}, "Session & preferences")),
        statRow("Role", roleLabel(u.role)),
        statRow("Department scope", u.department || "All"),
        statRow("Account created", u.createdAt ? timeAgo(u.createdAt) : "—"),
        el("div", { class: "stat-row" },
          el("span", { class: "muted" }, "Theme"),
          el("div", { style: { display: "flex", gap: "8px" } },
            el("button", { class: "btn btn-sm", onclick: () => setTheme("dark") }, "🌙 Dark"),
            el("button", { class: "btn btn-sm", onclick: () => setTheme("light") }, "☀️ Light"))),
        el("div", { class: "stat-row" },
          el("span", { class: "muted" }, "Shortcuts"),
          el("small", { class: "muted", html: `<span class="kbd">/</span> search · <span class="kbd">Ctrl+B</span> sidebar · <span class="kbd">Ctrl+D</span> theme` })),
        el("div", { style: { marginTop: "14px" } },
          el("button", { class: "btn btn-danger", onclick: async () => { await logout(); location.hash = ""; } }, "⏻ Sign out")))));
}
