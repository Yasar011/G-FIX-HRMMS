/**
 * Recruitment — open requisitions (vacancies) and the candidate pipeline,
 * combined into one page with two tabs. These were two separate sidebar
 * pages; merged because they're one workflow (a vacancy opens, candidates
 * move through the pipeline, one joins, the vacancy closes) and having
 * them split made the sidebar harder to learn for a new HR user.
 */
import { pageWatchAll, dbPush, dbUpdate, dbRemove } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { notify } from "../lib/notify.js";
import { el, ym, fmtDate, fmtNum, uniq, toList, today, sum } from "../lib/utils.js";
import { empList, activeEmps, budgetStats, recruitmentStats, STAGES } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", violet: "#a78bfa", info: "#38bdf8" };
const SOURCES = ["Referral", "Walk-in", "Job board", "Agency", "Social media", "Internal", "Other"];
const STAGE_TONE = { Applied: "dim", Screening: "info", Interview: "warn", "Offer Released": "info", "Offer Accepted": "ok", Joined: "ok", Rejected: "bad" };

export async function render(root) {
  const canManage = can("manage_recruitment");
  let employees = [];
  let tab = "requisitions"; // or "candidates"

  /* ---------- Requisitions tab ---------- */
  const reqKpis = kpiGrid([
    { id: "open", label: "Open Positions", icon: "🪑", color: C.warn },
    { id: "budgetGap", label: "Budget Vacancies", icon: "🎯", color: C.violet },
    { id: "high", label: "High Priority", icon: "🚨", color: C.bad },
    { id: "filled", label: "Filled (This Month)", icon: "✅", color: C.ok },
  ]);
  const deptChart = chartCard({ title: "Open Vacancies by Department", type: "bar", datasets: [] });
  const gapChart = chartCard({ title: "Budget Gap by Department", type: "bar", options: { indexAxis: "y" }, datasets: [] });
  const reqTableHost = el("div");
  const reqPanel = el("div", {}, reqKpis, el("div", { class: "grid grid-2" }, deptChart, gapChart), reqTableHost);

  /* ---------- Candidates tab ---------- */
  const candKpis = kpiGrid([
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
  const candTableHost = el("div");
  const candPanel = el("div", {}, candKpis, el("div", { class: "grid grid-2" }, funnel, sourceChart), recruiterChart, candTableHost);

  /* ---------- Tab bar + page head ---------- */
  const addBtn = el("button", {
    class: "btn btn-primary",
    onclick: () => (tab === "requisitions" ? editVacancy() : editCandidate()),
  }, tab === "requisitions" ? "＋ New requisition" : "＋ Add candidate");

  const reqTabBtn = el("button", { class: "tab active", onclick: () => setTab("requisitions") }, "🪑 Open Requisitions");
  const candTabBtn = el("button", { class: "tab", onclick: () => setTab("candidates") }, "🧑‍💼 Candidate Pipeline");
  const tabs = el("div", { class: "tabs", style: { marginBottom: "16px" } }, reqTabBtn, candTabBtn);

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Recruitment"),
      el("div", { class: "spacer" }),
      canManage ? addBtn : null),
    tabs,
    reqPanel, candPanel);

  function setTab(next) {
    tab = next;
    reqTabBtn.classList.toggle("active", tab === "requisitions");
    candTabBtn.classList.toggle("active", tab === "candidates");
    reqPanel.style.display = tab === "requisitions" ? "" : "none";
    candPanel.style.display = tab === "candidates" ? "" : "none";
    addBtn.textContent = tab === "requisitions" ? "＋ New requisition" : "＋ Add candidate";
  }
  setTab("requisitions");

  pageWatchAll(["employees", "vacancies", "recruitment", `budget/${ym()}`], (data) => {
    employees = empList(data.employees);

    /* Requisitions */
    const vacs = toList(data.vacancies, "_key");
    const open = vacs.filter((v) => v.status !== "closed");
    const budget = budgetStats(data[`budget/${ym()}`], employees).filter((b) => b.vacancies > 0);

    reqKpis._update({
      open: sum(open, (v) => Number(v.count) || 1),
      budgetGap: sum(budget, (b) => b.vacancies),
      high: open.filter((v) => v.priority === "High").length,
      filled: vacs.filter((v) => v.status === "closed" && v.closedAt?.startsWith(ym())).length,
    });

    const byDept = {};
    for (const v of open) byDept[v.department || "—"] = (byDept[v.department || "—"] || 0) + (Number(v.count) || 1);
    deptChart._update(Object.keys(byDept), [{ label: "Open", data: Object.values(byDept), perBarColor: true }]);
    gapChart._update(budget.map((b) => b.department), [{ label: "Budget gap", data: budget.map((b) => b.vacancies), color: C.violet }]);

    reqTableHost.replaceChildren(dataTable({
      title: "Requisitions",
      exportName: "vacancies",
      pageSize: 15,
      onRowClick: canManage ? (r) => editVacancy(r) : null,
      columns: [
        { key: "designation", label: "Position" },
        { key: "department", label: "Department" },
        { key: "section", label: "Section" },
        { key: "count", label: "Openings", align: "right" },
        { key: "priority", label: "Priority", render: (r) => badge(r.priority || "Normal", r.priority === "High" ? "bad" : r.priority === "Low" ? "dim" : "warn"), exportVal: (r) => r.priority || "Normal" },
        { key: "openedAt", label: "Opened", render: (r) => fmtDate(r.openedAt), exportVal: (r) => r.openedAt || "" },
        { key: "status", label: "Status", render: (r) => badge(r.status === "closed" ? "Closed" : "Open", r.status === "closed" ? "dim" : "ok"), exportVal: (r) => r.status || "open" },
      ],
      rows: vacs.sort((a, b) => (b.openedAt || "").localeCompare(a.openedAt || "")),
      empty: "No requisitions yet",
    }));

    /* Candidates */
    const s = recruitmentStats(data.recruitment, data.vacancies);
    candKpis._update({
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

    candTableHost.replaceChildren(dataTable({
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

  /* ---------- Requisition editor ---------- */
  function editVacancy(rec = null) {
    const depts = uniq(activeEmps(employees), (e) => e.department);
    const desig = el("input", { type: "text", value: rec?.designation || "", placeholder: "e.g. Machine Operator" });
    const deptSel = el("input", { type: "text", value: rec?.department || "", list: "vac-depts" });
    const dl = el("datalist", { id: "vac-depts" }, ...depts.map((d) => el("option", { value: d })));
    const section = el("input", { type: "text", value: rec?.section || "" });
    const count = el("input", { type: "number", min: "1", value: rec?.count || 1 });
    const priority = el("select", {}, ...["Normal", "High", "Low"].map((p) => el("option", { value: p }, p)));
    priority.value = rec?.priority || "Normal";
    const status = el("select", {}, ...[["open", "Open"], ["closed", "Closed"]].map(([v, l]) => el("option", { value: v }, l)));
    status.value = rec?.status || "open";

    modal({
      title: rec ? "Edit requisition" : "New requisition",
      width: "600px",
      body: el("div", { class: "form-grid" },
        el("label", { class: "field" }, el("span", {}, "Position *"), desig),
        el("label", { class: "field" }, el("span", {}, "Department"), deptSel, dl),
        el("label", { class: "field" }, el("span", {}, "Section"), section),
        el("label", { class: "field" }, el("span", {}, "Openings"), count),
        el("label", { class: "field" }, el("span", {}, "Priority"), priority),
        el("label", { class: "field" }, el("span", {}, "Status"), status)),
      actions: [
        rec ? {
          label: "Delete", class: "btn-danger",
          onClick: async (e, close) => {
            if (!(await confirmDialog("Delete this requisition?"))) return true;
            await dbRemove(`vacancies/${rec._key}`);
            close();
          },
        } : null,
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Save", class: "btn-primary",
          onClick: async (e, close) => {
            if (!desig.value.trim()) { toast("Position is required", "warn"); return true; }
            const data = {
              designation: desig.value.trim(), department: deptSel.value.trim(),
              section: section.value.trim(), count: Number(count.value) || 1,
              priority: priority.value, status: status.value,
              openedAt: rec?.openedAt || today(),
            };
            if (status.value === "closed" && rec?.status !== "closed") data.closedAt = today();
            if (rec) await dbUpdate(`vacancies/${rec._key}`, data);
            else {
              await dbPush("vacancies", data);
              notify("vacancy", "Vacancy created", `${data.count} × ${data.designation} (${data.department || "—"})`);
            }
            toast("Saved", "ok");
            close();
          },
        },
      ].filter(Boolean),
    });
  }

  /* ---------- Candidate editor ---------- */
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
