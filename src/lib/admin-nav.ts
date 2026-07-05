export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard Home", href: "/admin" }],
  },
  {
    label: "Content",
    items: [
      { label: "CMS", href: "/admin/cms" },
      { label: "Projects", href: "/admin/projects" },
      { label: "Internships", href: "/admin/internships" },
      { label: "Fashion Portfolio", href: "/admin/fashion" },
      { label: "Photography", href: "/admin/photography" },
      { label: "Certificates", href: "/admin/certificates" },
    ],
  },
  {
    label: "Media & AI",
    items: [
      { label: "AI Knowledge Center", href: "/admin/ai-knowledge" },
      { label: "AI Chatbot Manager", href: "/admin/ai-chatbot" },
      { label: "Media Manager", href: "/admin/media" },
    ],
  },
  {
    label: "Site & Analytics",
    items: [
      { label: "Theme Builder", href: "/admin/theme" },
      { label: "Factory Layout Editor", href: "/admin/factory-layout" },
      { label: "Visitor Analytics", href: "/admin/analytics" },
      { label: "Contact Manager", href: "/admin/contact" },
      { label: "SEO Manager", href: "/admin/seo" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Backup System", href: "/admin/backup" },
      { label: "Notification Center", href: "/admin/notifications" },
      { label: "Settings", href: "/admin/settings" },
    ],
  },
];
