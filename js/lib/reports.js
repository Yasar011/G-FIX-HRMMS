/**
 * Report registry — single source of truth for every downloadable report.
 *
 * Each report defines:
 *   id, title, icon, group   — catalog metadata
 *   params                   — which pickers it needs: "date" | "month" | "year"
 *   build(data, p)           — returns {columns:[{key,label}], rows:[{...}], subtitle}
 *
 * `data` is the raw snapshot map: {employees, attendance, budget, attrition,
 * leaves, vacancies, recruitment, settings}. The Reports page and the Email
 * Automation page both consume this registry, so a report added here appears
 * in both automatically.
 */
import {
  ym, ymd, today, dateRange, addDays, fmtDate, parseYmd, yearsSince,
  daysToAnniversary, toList, flattenNested, sum, uniq, fmtNum,
} from "./utils.js";
import {
  empList, activeEmps, dayStats, employeeAttendance, monthDates, groupAttendance,
  budgetStats, attritionStats, absenteeStats, recruitmentStats, headcountTrend,
  distribution, EXP_BANDS, ATT_STATUS,
} from "./metrics.js";

/* ---------- shared column sets ---------- */
const EMP_COLS = [
  { key: "id", label: "ID" }, { key: "name", label: "Name" },
  { key: "department", label: "Department" }, { key: "section", label: "Section" },
  { key: "designation", label: "Designation" },
];

/* ---------- helpers ---------- */

/** Attendance rows for a set of dates, one row per employee with totals. */
function attendanceSummaryRows(data, dates) {
  const employees = activeEmps(empList(data.employees));
  return employees.map((e) => {
    const a = employeeAttendance(e.id, data.attendance, dates);
    return {
      id: e.id, name: e.name, department: e.department || "", section: e.section || "",
      present: a.present, absent: a.absent, leave: a.leave, late: a.late,
      halfDay: a.halfDay, holiday: a.holiday,
      workHrs: Number((a.workMin / 60).toFixed(1)), otHrs: Number(a.otHours.toFixed(1)),
      attPct: Number(a.attendancePct.toFixed(1)),
    };
  }).filter((r) => r.present + r.absent + r.leave + r.halfDay > 0);
}
const ATT_SUM_COLS = [
  ...EMP_COLS.slice(0, 4),
  { key: "present", label: "Present" }, { key: "absent", label: "Absent" },
  { key: "leave", label: "Leave" }, { key: "late", label: "Late" },
  { key: "halfDay", label: "Half Day" }, { key: "workHrs", label: "Work Hrs" },
  { key: "otHrs", label: "OT Hrs" }, { key: "attPct", label: "Att %" },
];

/** Totals strip for an attendance-summary-shaped row set. */
function attSummary(rows) {
  const avgAtt = rows.length ? sum(rows, (r) => r.attPct) / rows.length : 0;
  return [
    { label: "Employees", value: rows.length },
    { label: "Present", value: sum(rows, (r) => r.present) },
    { label: "Absent", value: sum(rows, (r) => r.absent) },
    { label: "Leave", value: sum(rows, (r) => r.leave) },
    { label: "Half Day", value: sum(rows, (r) => r.halfDay) },
    { label: "Late", value: sum(rows, (r) => r.late) },
    { label: "OT Hrs", value: Number(sum(rows, (r) => r.otHrs).toFixed(1)) },
    { label: "Avg Att %", value: `${avgAtt.toFixed(1)}%` },
  ];
}

/** Group-dimension attendance report (department/section/module/buyer). */
function dimensionReport(dim) {
  return (data, p) => {
    const dates = monthDates(data.attendance, p.month || ym());
    const rows = groupAttendance(data.attendance, empList(data.employees), dates, dim)
      .map((g) => ({ name: g.name, headcount: g.headcount, attPct: Number(g.attendancePct.toFixed(1)), late: g.late, otHrs: Number(g.otHours.toFixed(1)) }));
    return {
      subtitle: p.month,
      columns: [
        { key: "name", label: dim[0].toUpperCase() + dim.slice(1) },
        { key: "headcount", label: "Headcount" }, { key: "attPct", label: "Attendance %" },
        { key: "late", label: "Late Count" }, { key: "otHrs", label: "OT Hours" },
      ],
      rows,
    };
  };
}

/** Employee-register style report from a filter, with a headcount summary. */
function registerReport(filter, extraCols = []) {
  return (data) => {
    const rows = empList(data.employees).filter(filter);
    const active = rows.filter((e) => e.status === "active" || e.status === "notice");
    const catCounts = {};
    for (const e of active) { const c = e.category || "—"; catCounts[c] = (catCounts[c] || 0) + 1; }
    const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([c, n]) => ({ label: c, value: n }));
    return {
      columns: [...EMP_COLS,
        { key: "category", label: "Category" }, { key: "grade", label: "Grade" }, { key: "type", label: "Type" },
        { key: "gender", label: "Gender" }, { key: "doj", label: "DOJ" },
        { key: "status", label: "Status" }, ...extraCols],
      rows,
      summary: [{ label: "Total", value: rows.length }, { label: "Active", value: active.length }, ...topCats],
    };
  };
}

/* ---------- the registry ---------- */
export const REPORTS = [
  /* --- Attendance group --- */
  {
    id: "daily_attendance", title: "Daily Attendance", icon: "🗓️", group: "Attendance", params: ["date"],
    build: (data, p) => {
      const date = p.date || today();
      const employees = empList(data.employees);
      const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
      const dayObj = data.attendance?.[date] || {};
      const rows = Object.entries(dayObj).map(([id, r]) => ({
        id, name: byId[id]?.name || r.name || "", department: byId[id]?.department || "",
        section: byId[id]?.section || "", shift: r.shift || "",
        status: ATT_STATUS[r.status] || r.status, in: r.in || "", out: r.out || "",
        workHrs: Number(((r.workMin || 0) / 60).toFixed(1)), otHrs: r.otHours || 0,
        late: r.late ? "Yes" : "", earlyOut: r.earlyOut ? "Yes" : "",
      }));
      const s = dayStats(dayObj, employees);
      return {
        subtitle: fmtDate(date),
        columns: [...EMP_COLS.slice(0, 4), { key: "shift", label: "Shift" }, { key: "status", label: "Status" },
          { key: "in", label: "In" }, { key: "out", label: "Out" }, { key: "workHrs", label: "Hours" },
          { key: "otHrs", label: "OT" }, { key: "late", label: "Late" }, { key: "earlyOut", label: "Early Out" }],
        rows,
        summary: [
          { label: "Present", value: s.present }, { label: "Absent", value: s.absent },
          { label: "Leave", value: s.leave }, { label: "Half Day", value: s.halfDay },
          { label: "Late", value: s.late }, { label: "Early Out", value: s.earlyOut },
          { label: "Unmarked", value: s.unmarked }, { label: "OT Hrs", value: Number(s.otHours.toFixed(1)) },
        ],
      };
    },
  },
  {
    id: "weekly_attendance", title: "Weekly Attendance", icon: "📅", group: "Attendance", params: ["date"],
    build: (data, p) => {
      const end = p.date || today();
      const dates = dateRange(addDays(end, -6), end);
      const rows = attendanceSummaryRows(data, dates);
      return { subtitle: `${fmtDate(dates[0])} → ${fmtDate(end)}`, columns: ATT_SUM_COLS, rows, summary: attSummary(rows) };
    },
  },
  {
    id: "monthly_attendance", title: "Monthly Attendance", icon: "🗓️", group: "Attendance", params: ["month"],
    build: (data, p) => {
      const rows = attendanceSummaryRows(data, monthDates(data.attendance, p.month || ym()));
      return { subtitle: p.month, columns: ATT_SUM_COLS, rows, summary: attSummary(rows) };
    },
  },
  {
    id: "yearly_attendance", title: "Yearly Attendance", icon: "📆", group: "Attendance", params: ["year"],
    build: (data, p) => {
      const year = p.year || String(new Date().getFullYear());
      const dates = Object.keys(data.attendance || {}).filter((d) => d.startsWith(year)).sort();
      const rows = attendanceSummaryRows(data, dates);
      return { subtitle: year, columns: ATT_SUM_COLS, rows, summary: attSummary(rows) };
    },
  },
  {
    id: "late", title: "Late Report", icon: "⏰", group: "Attendance", params: ["month"],
    build: (data, p) => {
      const dates = monthDates(data.attendance, p.month || ym());
      const rows = attendanceSummaryRows(data, dates).filter((r) => r.late > 0).sort((a, b) => b.late - a.late);
      return { subtitle: p.month, columns: ATT_SUM_COLS, rows, summary: attSummary(rows) };
    },
  },
  {
    id: "absent", title: "Absent Report", icon: "🚫", group: "Attendance", params: ["month"],
    build: (data, p) => {
      const dates = monthDates(data.attendance, p.month || ym());
      const rows = attendanceSummaryRows(data, dates).filter((r) => r.absent > 0).sort((a, b) => b.absent - a.absent);
      return { subtitle: p.month, columns: ATT_SUM_COLS, rows, summary: attSummary(rows) };
    },
  },
  {
    id: "frequent_absentee", title: "Frequent Absentee", icon: "📵", group: "Attendance", params: ["month"],
    build: (data, p) => {
      const rows = absenteeStats(data.attendance, empList(data.employees), p.month || ym())
        .filter((a) => a.absents >= 3)
        .map((a) => ({ id: a.id, name: a.name, department: a.department || "", section: a.section || "",
          absents: a.absents, maxStreak: a.streak, absentPct: Number(a.absentPct.toFixed(1)),
          band: a.absents > 10 ? ">10 days" : a.absents > 5 ? ">5 days" : ">3 days" }));
      return {
        subtitle: p.month,
        columns: [...EMP_COLS.slice(0, 4), { key: "absents", label: "Absent Days" },
          { key: "maxStreak", label: "Max Consecutive" }, { key: "absentPct", label: "Absent %" }, { key: "band", label: "Band" }],
        rows,
      };
    },
  },
  {
    id: "overtime", title: "Overtime Report", icon: "⏱️", group: "Attendance", params: ["month"],
    build: (data, p) => {
      const dates = monthDates(data.attendance, p.month || ym());
      const otRate = Number(data.settings?.otRate) || 0;
      const rows = activeEmps(empList(data.employees)).map((e) => {
        const a = employeeAttendance(e.id, data.attendance, dates);
        return { id: e.id, name: e.name, department: e.department || "", section: e.section || "",
          otHrs: Number(a.otHours.toFixed(1)),
          otDays: a.records.filter((r) => (r.otHours || 0) > 0).length,
          cost: Math.round(a.otHours * (Number(e.otRate) || otRate)) };
      }).filter((r) => r.otHrs > 0).sort((a, b) => b.otHrs - a.otHrs);
      return { subtitle: p.month, columns: [...EMP_COLS.slice(0, 4),
        { key: "otHrs", label: "OT Hours" }, { key: "otDays", label: "OT Days" }, { key: "cost", label: "OT Cost" }], rows,
        summary: [
          { label: "Workers with OT", value: rows.length },
          { label: "Total OT Hours", value: Number(sum(rows, (r) => r.otHrs).toFixed(1)) },
          { label: "Total OT Cost", value: fmtNum(sum(rows, (r) => r.cost)) },
          { label: "Avg OT/Worker", value: rows.length ? Number((sum(rows, (r) => r.otHrs) / rows.length).toFixed(1)) : 0 },
        ] };
    },
  },
  {
    id: "leave", title: "Leave Report", icon: "🌴", group: "Attendance", params: ["month"],
    build: (data, p) => {
      const month = p.month || ym();
      const rows = flattenNested(data.leaves, "empId").filter((l) => l.from?.startsWith(month))
        .map((l) => ({ id: l.empId, name: l.name, department: l.department || "", type: l.type,
          from: l.from, to: l.to, days: l.days, status: l.status, reason: l.reason || "" }));
      return { subtitle: month, columns: [{ key: "id", label: "ID" }, { key: "name", label: "Name" },
        { key: "department", label: "Department" }, { key: "type", label: "Type" }, { key: "from", label: "From" },
        { key: "to", label: "To" }, { key: "days", label: "Days" }, { key: "status", label: "Status" }, { key: "reason", label: "Reason" }], rows,
        summary: [
          { label: "Requests", value: rows.length },
          { label: "Total Days", value: Number(sum(rows, (r) => Number(r.days) || 0).toFixed(1)) },
          { label: "Approved", value: rows.filter((r) => r.status === "approved").length },
          { label: "Pending", value: rows.filter((r) => r.status === "pending").length },
        ] };
    },
  },

  /* --- Organization group --- */
  { id: "department", title: "Department Report", icon: "🏭", group: "Organization", params: ["month"], build: dimensionReport("department") },
  { id: "section", title: "Section Report", icon: "🧩", group: "Organization", params: ["month"], build: dimensionReport("section") },
  { id: "module", title: "Module Report", icon: "🧱", group: "Organization", params: ["month"], build: dimensionReport("module") },
  { id: "buyer", title: "Buyer Report", icon: "🛍️", group: "Organization", params: ["month"], build: dimensionReport("buyer") },
  {
    id: "headcount", title: "Headcount Report", icon: "👥", group: "Organization", params: [],
    build: (data) => ({
      columns: [{ key: "month", label: "Month" }, { key: "count", label: "Headcount" }],
      rows: headcountTrend(empList(data.employees), 12),
    }),
  },
  {
    id: "budget", title: "Budget Report", icon: "💰", group: "Organization", params: ["month"],
    build: (data, p) => {
      const rows = budgetStats(data.budget?.[p.month || ym()], empList(data.employees)).map((b) => ({
        department: b.department, budget: b.budget, actual: b.actual, variance: b.variance,
        vacancies: b.vacancies, excess: b.excess, utilization: Number(b.utilization.toFixed(1)),
        status: b.excess > 0 ? "Exceeded" : b.utilization >= 90 ? "Healthy" : "Under",
      }));
      return { subtitle: p.month, columns: [{ key: "department", label: "Department" }, { key: "budget", label: "Budget" },
        { key: "actual", label: "Actual" }, { key: "variance", label: "Variance" }, { key: "vacancies", label: "Vacancies" },
        { key: "excess", label: "Excess" }, { key: "utilization", label: "Utilization %" }, { key: "status", label: "Status" }], rows };
    },
  },
  {
    id: "vacancy", title: "Vacancy Report", icon: "🪑", group: "Organization", params: [],
    build: (data) => ({
      columns: [{ key: "designation", label: "Position" }, { key: "department", label: "Department" },
        { key: "section", label: "Section" }, { key: "count", label: "Openings" },
        { key: "priority", label: "Priority" }, { key: "openedAt", label: "Opened" }, { key: "status", label: "Status" }],
      rows: toList(data.vacancies, "_key"),
    }),
  },

  /* --- People group --- */
  { id: "employee", title: "Employee Report", icon: "🧑‍💼", group: "People", params: [], build: registerReport(() => true) },
  { id: "inactive", title: "Inactive Employees", icon: "💤", group: "People", params: [], build: registerReport((e) => e.status === "inactive") },
  {
    id: "new_joiner", title: "New Joiner Report", icon: "🎉", group: "People", params: ["month"],
    build: (data, p) => registerReport((e) => e.doj?.startsWith(p.month || ym()))(data),
  },
  {
    id: "resignation", title: "Resignation Report", icon: "👋", group: "People", params: ["month"],
    build: (data, p) => {
      const month = p.month || ym();
      const rows = attritionStats(data.attrition, empList(data.employees)).list
        .filter((a) => a.lastDay?.startsWith(month))
        .map((a) => ({ id: a.empId, name: a.name, department: a.department || "", type: a.type,
          noticeDate: a.noticeDate || "", lastDay: a.lastDay || "", tenure: a.tenureYears ?? "", reason: a.reason || "", replacement: a.replacement || "" }));
      return { subtitle: month, columns: [{ key: "id", label: "ID" }, { key: "name", label: "Name" },
        { key: "department", label: "Department" }, { key: "type", label: "Type" }, { key: "noticeDate", label: "Notice" },
        { key: "lastDay", label: "Last Day" }, { key: "tenure", label: "Tenure (y)" }, { key: "reason", label: "Reason" }, { key: "replacement", label: "Replacement" }], rows };
    },
  },
  {
    id: "notice_period", title: "Notice Period Report", icon: "📮", group: "People", params: [],
    build: registerReport((e) => e.status === "notice", [{ key: "resignDate", label: "Last Day" }]),
  },
  {
    id: "attrition", title: "Attrition Report", icon: "📉", group: "People", params: [],
    build: (data) => {
      const s = attritionStats(data.attrition, empList(data.employees));
      return { columns: [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "department", label: "Department" },
        { key: "type", label: "Type" }, { key: "lastDay", label: "Last Day" }, { key: "tenure", label: "Tenure (y)" }, { key: "reason", label: "Reason" }],
        rows: s.list.map((a) => ({ id: a.empId, name: a.name, department: a.department || "", type: a.type, lastDay: a.lastDay || "", tenure: a.tenureYears ?? "", reason: a.reason || "" })) };
    },
  },
  {
    id: "recruitment", title: "Recruitment Report", icon: "🧲", group: "People", params: [],
    build: (data) => ({
      columns: [{ key: "candidate", label: "Candidate" }, { key: "position", label: "Position" },
        { key: "department", label: "Department" }, { key: "source", label: "Source" },
        { key: "recruiter", label: "Recruiter" }, { key: "stage", label: "Stage" },
        { key: "appliedAt", label: "Applied" }, { key: "joinedAt", label: "Joined" }],
      rows: recruitmentStats(data.recruitment, data.vacancies).candidates,
    }),
  },
  {
    id: "birthday", title: "Birthday Report", icon: "🎂", group: "People", params: [],
    build: (data) => ({
      subtitle: "Next 30 days",
      columns: [...EMP_COLS.slice(0, 3), { key: "dob", label: "Date of Birth" }, { key: "inDays", label: "In (days)" }],
      rows: activeEmps(empList(data.employees)).filter((e) => e.dob && daysToAnniversary(e.dob) <= 30)
        .map((e) => ({ id: e.id, name: e.name, department: e.department || "", dob: e.dob, inDays: daysToAnniversary(e.dob) }))
        .sort((a, b) => a.inDays - b.inDays),
    }),
  },
  {
    id: "anniversary", title: "Work Anniversary Report", icon: "🏅", group: "People", params: [],
    build: (data) => ({
      subtitle: "Next 30 days",
      columns: [...EMP_COLS.slice(0, 3), { key: "doj", label: "DOJ" }, { key: "years", label: "Completing (yrs)" }, { key: "inDays", label: "In (days)" }],
      rows: activeEmps(empList(data.employees)).filter((e) => e.doj && daysToAnniversary(e.doj) <= 30)
        .map((e) => ({ id: e.id, name: e.name, department: e.department || "", doj: e.doj,
          years: Math.round(yearsSince(e.doj) + daysToAnniversary(e.doj) / 365), inDays: daysToAnniversary(e.doj) }))
        .sort((a, b) => a.inDays - b.inDays),
    }),
  },
  {
    id: "gender", title: "Gender Report", icon: "🚻", group: "People", params: [],
    build: (data) => {
      const active = activeEmps(empList(data.employees));
      const rows = uniq(active, (e) => e.department).map((d) => {
        const members = active.filter((e) => e.department === d);
        return { department: d, male: members.filter((e) => e.gender === "Male").length,
          female: members.filter((e) => e.gender === "Female").length, total: members.length };
      });
      return { columns: [{ key: "department", label: "Department" }, { key: "male", label: "Male" },
        { key: "female", label: "Female" }, { key: "total", label: "Total" }], rows };
    },
  },
  {
    id: "experience", title: "Experience Report", icon: "📚", group: "People", params: [],
    build: (data) => ({
      columns: [{ key: "label", label: "Experience Band" }, { key: "count", label: "Employees" }],
      rows: distribution(activeEmps(empList(data.employees)), (e) => e.doj ? yearsSince(e.doj) : null, EXP_BANDS),
    }),
  },
  {
    id: "category", title: "Category Report", icon: "🏷️", group: "People", params: [],
    build: (data) => {
      const active = activeEmps(empList(data.employees));
      return { columns: [{ key: "category", label: "Category" }, { key: "count", label: "Employees" }],
        rows: uniq(active, (e) => e.category).map((c) => ({ category: c, count: active.filter((e) => e.category === c).length })) };
    },
  },
];

/** Look up a report by id. */
export function getReport(id) { return REPORTS.find((r) => r.id === id); }

/** The database paths a report snapshot needs. */
export const REPORT_PATHS = ["employees", "attendance", "budget", "attrition", "leaves", "vacancies", "recruitment", "settings"];
