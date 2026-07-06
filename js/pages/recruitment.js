/**
 * Recruitment module — candidate pipeline (Kanban-style stage counts),
 * hiring source & recruiter performance, time-to-hire.
 */
import { pageWatchAll, dbPush, dbUpdate, dbRemove } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge, statusTone } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { notify } from "../lib/notify.js";
import { el, fmtDate, fmtNum, today, toList, uniq } from "../lib/utils.js";
import { empList, activeEmps, recruitmentStats, STAGES } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", info: "#38bdf8" };
const SOURCES = ["Referral", "Walk-in", "Job board", "Agency", "Social media", "Internal", "Other"];
const STAGE_TONE = { Applied: "dim", Screening: "info", Interview: "warn", "Offer Released": "info", "Offer Accepted": "ok", Joined: "ok", Rejected: "bad" };

export async function render(root) {
  const canManage = can("manage_recruitment");
  let employees = [];

  const kpis = kpiGrid([
    { id: "open", label: "Open Positions", icon: "🪑", color: C.warn },
    { id: "candidates", label: "Active Candidates", icon: "🧑‍💼", color: C.brand },
    { id: "interview", label: "In Interview", icon: "🗣️", color: C.info },
    { id: "offers", label: "Offers Released", icon: "📨", color: C.info },
    { id: "accepted", label: "Offers Accepted", icon: "🤝", color: C.ok },
    { id: "pending", label: "Joining Pending", icon: "⏳", color: C.warn },
    { id: "tth", label: "Avg Time to Hire (days)", icon: "⚡", color: C.brand, dp: 0 },
  ]);

  const funnel = chartCard({ title: "Pipeline by Stage", type: "bar", datasets: [] });
  const sourceChart = chartCard({ title: "Hiring Source", type: "doughnut", datasets: [] });
  const recruiterChart = chartCard({ title: "Recruiter Performance", type: "bar", datasets: [] });
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Recruitment"),
      el("div", { class: "spacer" }),
      canManage ? el("button", { class: "btn btn-primary", onclick: () => editCandidate() }, "＋ Add candidate") : null),
    kpis,
    el("div", { class: "grid grid-2" }, funnel, sourceChart),
    recruiterChart,
    tableHost);

  pageWatchAll(["employees", "recruitment", "vacancies"], (data) => {
    employees = empList(data.employees);
    const s = recruitmentStats(data.recruitment, data.vacancies);

    kpis._update({
      open: s.openPositions,
      candidates: s.candidates.filter((c) => !["Joined", "Rejected"].includes(c.stage)).length,
      interview: s.stageCount.Interview,
      offers: s.offerReleased, accepted: s.offerAccepted, pending: s.joiningPending,
      tth: s.avgTimeToHire,
    });

    funnel._update(STAGES, [{ label: "Candidates", data: STAGES.map((st) => s.stageCount[st]), perBarColor: true }]);
    sourceChart._update(s.bySource.map((x) => x.source), [{ data: s.bySource.map((x) => x.count) }]);
    recruiterChart._update(s.byRecruiter.map((r) => r.recruiter), [
      { label: "Candidates", data: s.byRecruiter.map((r) => r.candidates), color: C.brand },
      { label: "Hires", data: s.byRecruiter.map((r) => r.hires), color: C.ok },
    ]);

    tableHost.replaceChildren(dataTable({
      title: "Candidates",
      exportName: "recruitment",
      pageSize: 15,
      onRowClick: canManage ? (r) => editCandidate(r) : null,
      columns: [
        { key: "candidate", label: "Candidate" },
        { key: "position", label: "Position" },
        { key: "department", label: "Department" },
        { key: "source", label: "Source" },
        { key: "recruiter", label: "Recruiter" },
        { key: "stage", label: "Stage", render: (r) => badge(r.stage, STAGE_TONE[r.stage] || "dim"), exportVal: (r) => r.stage },
        { key: "appliedAt", label: "Applied", render: (r) => fmtDate(r.appliedAt), exportVal: (r) => r.appliedAt || "" },
        { key: "joinedAt", label: "Joined", render: (r) => fmtDate(r.joinedAt), exportVal: (r) => r.joinedAt || "" },
      ],
      rows: s.candidates.sort((a, b) => (b.appliedAt || "").localeCompare(a.appliedAt || "")),
      empty: "No candidates in the pipeline",
    }));
  });

  function editCandidate(rec = null) {
    const name = el("input", { type: "text", value: rec?.candidate || "" });
    const position = el("input", { type: "text", value: rec?.position || "" });
    const dept = el("input", { type: "text", value: rec?.department || "", list: "rec-depts" });
    const dl = el("datalist", { id: "rec-depts" }, ...uniq(activeEmps(employees), (e) => e.department).map((d) => el("option", { value: d })));
    const source = el("select", {}, ...SOURCES.map((x) => el("option", { value: x }, x)));
    source.value = rec?.source || SOURCES[0];
    const recruiter = el("input", { type: "text", value: rec?.recruiter || "" });
    const stage = el("select", {}, ...STAGES.map((x) => el("option", { value: x }, x)));
    stage.value = rec?.stage || "Applied";
    const applied = el("input", { type: "date", value: rec?.appliedAt || today() });
    const joined = el("input", { type: "date", value: rec?.joinedAt || "" });

    modal({
      title: rec ? `Candidate — ${rec.candidate}` : "Add candidate",
      width: "640px",
      body: el("div", { class: "form-grid" },
        el("label", { class: "field" }, el("span", {}, "Candidate name *"), name),
        el("label", { class: "field" }, el("span", {}, "Position *"), position),
        el("label", { class: "field" }, el("span", {}, "Department"), dept, dl),
        el("label", { class: "field" }, el("span", {}, "Source"), source),
        el("label", { class: "field" }, el("span", {}, "Recruiter"), recruiter),
        el("label", { class: "field" }, el("span", {}, "Stage"), stage),
        el("label", { class: "field" }, el("span", {}, "Applied date"), applied),
        el("label", { class: "field" }, el("span", {}, "Joined date"), joined)),
      actions: [
        rec ? {
          label: "Delete", class: "btn-danger",
          onClick: async (e, close) => {
            if (!(await confirmDialog("Delete this candidate?"))) return true;
            await dbRemove(`recruitment/${rec._key}`);
            close();
          },
        } : null,
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Save", class: "btn-primary",
          onClick: async (e, close) => {
            if (!name.value.trim() || !position.value.trim()) { toast("Candidate and position are required", "warn"); return true; }
            const data = {
              candidate: name.value.trim(), position: position.value.trim(),
              department: dept.value.trim(), source: source.value,
              recruiter: recruiter.value.trim(), stage: stage.value,
              appliedAt: applied.value,
            };
            if (joined.value) data.joinedAt = joined.value;
            if (stage.value === "Joined" && !data.joinedAt) data.joinedAt = today();
            if (rec) await dbUpdate(`recruitment/${rec._key}`, data);
            else await dbPush("recruitment", data);
            if (stage.value === "Joined" && rec?.stage !== "Joined")
              notify("joiner", "Candidate joined", `${data.candidate} — ${data.position}`);
            toast("Saved", "ok");
            close();
          },
        },
      ].filter(Boolean),
    });
  }
}
