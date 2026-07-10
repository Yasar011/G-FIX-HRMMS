/**
 * HR metrics engine.
 *
 * Pure functions that turn raw Realtime Database nodes (employees, attendance,
 * budget, attrition, leaves, recruitment) into the numbers shown on the
 * dashboard, department pages and reports. No DOM, no Firebase — fully
 * testable and reusable.
 *
 * Data model reference (paths in Realtime Database):
 *   employees/{empId}   {name, department, section, module, buyer, designation,
 *                        grade, category, gender, dob, doj, type, nationality,
 *                        status: active|inactive|notice|resigned, resignDate,
 *                        email, phone, otRate}
 *   attendance/{YYYY-MM-DD}/{empId}
 *                       {status: P|A|L|HD|WFH|H, late, earlyOut, in, out,
 *                        workMin, otHours, shift}
 *   budget/{YYYY-MM}/{dept} {total, sections: {sectionName: n}}
 *   attrition/{id}      {empId, name, department, type, reason, noticeDate,
 *                        lastDay, tenureYears, replacement}
 *   leaves/{id}         {empId, name, department, type, from, to, days, status}
 *   vacancies/{id}      {department, designation, count, status}
 *   recruitment/{id}    {position, department, candidate, source, stage,
 *                        recruiter, appliedAt, offerAt, joinedAt}
 */
import {
  toList, sum, avg, uniq, groupBy, ym, ymd, today, dateRange, lastMonths,
  yearsSince, daysToAnniversary, parseYmd,
} from "./utils.js";

/** Attendance status codes → labels. */
export const ATT_STATUS = {
  P: "Present", A: "Absent", L: "Leave", HD: "Half Day",
  WFH: "Work From Home", H: "Holiday",
};

/** Statuses that count toward "worked / present" attendance %. */
const PRESENT_LIKE = new Set(["P", "HD", "WFH"]);

/* =============== Employee dimension =============== */

/** employees node → array with `id` field. */
export function empList(employeesObj) {
  return toList(employeesObj, "id").map((e) => ({ ...e, id: e.id }));
}

/** Employees currently on payroll (active or serving notice). */
export function activeEmps(list) {
  return list.filter((e) => e.status === "active" || e.status === "notice");
}

/** Composite workforce KPIs (headcount, demographics, tenure, upcoming events). */
export function workforceStats(employees) {
  const active = activeEmps(employees);
  const month = ym();
  const isThisMonth = (d) => d && d.startsWith(month);
  return {
    headcount: active.length,
    inactive: employees.filter((e) => e.status === "inactive").length,
    notice: employees.filter((e) => e.status === "notice").length,
    newJoiners: employees.filter((e) => isThisMonth(e.doj)).length,
    resignedThisMonth: employees.filter((e) => e.status === "resigned" && isThisMonth(e.resignDate)).length,
    departments: uniq(active, (e) => e.department).length,
    male: active.filter((e) => e.gender === "Male").length,
    female: active.filter((e) => e.gender === "Female").length,
    contract: active.filter((e) => e.type === "Contract").length,
    permanent: active.filter((e) => e.type === "Permanent").length,
    expat: active.filter((e) => e.nationality === "Expat").length,
    local: active.filter((e) => e.nationality !== "Expat").length,
    categories: uniq(active, (e) => e.category).length,
    avgExperience: avg(active.filter((e) => e.doj), (e) => yearsSince(e.doj)),
    avgAge: avg(active.filter((e) => e.dob), (e) => yearsSince(e.dob)),
    birthdays7d: active.filter((e) => daysToAnniversary(e.dob) <= 7).length,
    anniversaries7d: active.filter((e) => e.doj && daysToAnniversary(e.doj) <= 7).length,
  };
}

/* =============== Daily attendance =============== */

/**
 * Stats for one day's attendance node.
 * @param {Object} dayObj attendance/{date} ({empId: record})
 * @param {Array}  employees full employee list (for headcount denominator)
 */
export function dayStats(dayObj, employees) {
  const recs = Object.values(dayObj || {});
  const active = activeEmps(employees).length;
  const count = (s) => recs.filter((r) => r.status === s).length;
  const present = recs.filter((r) => PRESENT_LIKE.has(r.status)).length;
  const marked = recs.filter((r) => r.status !== "H").length;
  const otHours = sum(recs, (r) => r.otHours);
  const workMins = recs.filter((r) => r.workMin > 0);
  return {
    present,
    absent: count("A"),
    leave: count("L"),
    late: recs.filter((r) => r.late).length,
    earlyOut: recs.filter((r) => r.earlyOut).length,
    halfDay: count("HD"),
    wfh: count("WFH"),
    holiday: count("H"),
    marked,
    unmarked: Math.max(0, active - recs.length),
    attendancePct: marked ? (present / marked) * 100 : 0,
    avgWorkMin: avg(workMins, (r) => r.workMin),
    otHours,
    otEmployees: recs.filter((r) => (r.otHours || 0) > 0).length,
  };
}

/** Per-employee accumulation over a set of dates. */
export function employeeAttendance(empId, attendance, dates) {
  const out = { present: 0, absent: 0, leave: 0, late: 0, halfDay: 0, wfh: 0, holiday: 0, earlyOut: 0, otHours: 0, workMin: 0, marked: 0, records: [] };
  for (const d of dates) {
    const r = attendance?.[d]?.[empId];
    if (!r) continue;
    out.records.push({ date: d, ...r });
    if (r.status === "H") { out.holiday++; continue; }
    out.marked++;
    if (PRESENT_LIKE.has(r.status)) out.present++;
    if (r.status === "A") out.absent++;
    if (r.status === "L") out.leave++;
    if (r.status === "HD") out.halfDay++;
    if (r.status === "WFH") out.wfh++;
    if (r.late) out.late++;
    if (r.earlyOut) out.earlyOut++;
    out.otHours += Number(r.otHours) || 0;
    out.workMin += Number(r.workMin) || 0;
  }
  out.attendancePct = out.marked ? (out.present / out.marked) * 100 : 0;
  return out;
}

/** All date keys present in the attendance node for a given month. */
export function monthDates(attendance, monthKey) {
  return Object.keys(attendance || {}).filter((d) => d.startsWith(monthKey)).sort();
}

/** Daily attendance % series over the last `n` days (from stored data). */
export function dailyTrend(attendance, employees, n = 30) {
  const to = today();
  const from = ymd(new Date(Date.now() - (n - 1) * 86400e3));
  const days = dateRange(from, to).filter((d) => attendance?.[d]);
  return days.map((d) => ({ date: d, ...dayStats(attendance[d], employees) }));
}

/** Monthly aggregated attendance % / OT for the last `n` months. */
export function monthlyTrend(attendance, employees, n = 12) {
  return lastMonths(n).map((m) => {
    const days = monthDates(attendance, m);
    const stats = days.map((d) => dayStats(attendance[d], employees));
    return {
      month: m,
      attendancePct: avg(stats, (s) => s.attendancePct),
      present: sum(stats, (s) => s.present),
      absent: sum(stats, (s) => s.absent),
      leave: sum(stats, (s) => s.leave),
      late: sum(stats, (s) => s.late),
      otHours: sum(stats, (s) => s.otHours),
      days: days.length,
    };
  });
}

/** Attendance % grouped by an employee dimension (department/section/module/buyer). */
export function groupAttendance(attendance, employees, dates, dim) {
  const emps = activeEmps(employees);
  const groups = groupBy(emps, (e) => e[dim] || "—");
  const out = [];
  for (const [name, members] of groups) {
    let present = 0, marked = 0, late = 0, ot = 0;
    for (const e of members) {
      const a = employeeAttendance(e.id, attendance, dates);
      present += a.present; marked += a.marked; late += a.late; ot += a.otHours;
    }
    out.push({
      name, headcount: members.length,
      attendancePct: marked ? (present / marked) * 100 : 0,
      late, otHours: ot,
    });
  }
  return out.sort((a, b) => b.attendancePct - a.attendancePct);
}

/* =============== Overtime =============== */

/** OT hours + cost per date over a range. `otRate` = default cost/hour. */
export function otTrend(attendance, dates, employees, otRate = 0) {
  const rateOf = Object.fromEntries(employees.map((e) => [e.id, Number(e.otRate) || otRate]));
  const empIds = new Set(employees.map((e) => e.id));
  return dates.filter((d) => attendance?.[d]).map((d) => {
    const recs = Object.entries(attendance[d]).filter(([id]) => empIds.has(id));
    const hours = sum(recs, ([, r]) => r.otHours);
    const cost = sum(recs, ([id, r]) => (Number(r.otHours) || 0) * (rateOf[id] ?? otRate));
    return { date: d, hours, cost };
  });
}

/**
 * OT hours + cost + contributing-employee count grouped by any dimension over
 * a date range. `dim` may be an employee attribute ("department", "category",
 * "grade") or "shift" (which lives on the attendance record, not the employee).
 * Returns [{ name, hours, cost, employees, days }] sorted by hours desc.
 */
export function otByDimension(attendance, dates, employees, dim, otRate = 0) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const rateOf = (id) => Number(byId.get(id)?.otRate) || otRate;
  const groups = new Map(); // key -> {name, hours, cost, emps:Set, dayset:Set}
  const bump = (key, id, hrs, date) => {
    if (!(hrs > 0)) return;
    let g = groups.get(key);
    if (!g) { g = { name: key, hours: 0, cost: 0, emps: new Set(), dayset: new Set() }; groups.set(key, g); }
    g.hours += hrs;
    g.cost += hrs * rateOf(id);
    g.emps.add(id);
    g.dayset.add(date);
  };
  for (const d of dates) {
    const day = attendance?.[d];
    if (!day) continue;
    for (const [id, r] of Object.entries(day)) {
      if (!byId.has(id)) continue;
      const hrs = Number(r.otHours) || 0;
      const key = dim === "shift" ? (r.shift || "—") : (byId.get(id)[dim] || "—");
      bump(key, id, hrs, d);
    }
  }
  return [...groups.values()]
    .map((g) => ({ name: g.name, hours: Number(g.hours.toFixed(1)), cost: Math.round(g.cost), employees: g.emps.size, days: g.dayset.size }))
    .sort((a, b) => b.hours - a.hours);
}

/* =============== Headcount / joining / attrition trends =============== */

/** Headcount at end of each month (from doj / resignDate). */
export function headcountTrend(employees, n = 12) {
  return lastMonths(n).map((m) => {
    const endOfMonth = `${m}-31`;
    const count = employees.filter((e) =>
      e.doj && e.doj <= endOfMonth &&
      !(e.status === "resigned" && e.resignDate && e.resignDate <= endOfMonth)).length;
    return { month: m, count };
  });
}

/** Joiners / leavers per month. */
export function movementTrend(employees, attrition, n = 12) {
  const leavers = toList(attrition, "_key");
  return lastMonths(n).map((m) => ({
    month: m,
    joined: employees.filter((e) => e.doj?.startsWith(m)).length,
    left: leavers.filter((a) => a.lastDay?.startsWith(m)).length,
  }));
}

/** Attrition summary: monthly %, avg tenure, by-department, replacement pending. */
export function attritionStats(attritionObj, employees) {
  const list = toList(attritionObj, "_key");
  const headcount = Math.max(1, activeEmps(employees).length);
  const thisMonth = list.filter((a) => a.lastDay?.startsWith(ym()));
  const thisYear = list.filter((a) => a.lastDay?.startsWith(String(new Date().getFullYear())));
  return {
    list,
    total: list.length,
    monthly: thisMonth.length,
    yearly: thisYear.length,
    monthlyPct: (thisMonth.length / headcount) * 100,
    yearlyPct: (thisYear.length / headcount) * 100,
    avgTenure: avg(list.filter((a) => a.tenureYears != null), (a) => Number(a.tenureYears)),
    replacementPending: list.filter((a) => a.replacement === "Pending").length,
    byDept: [...groupBy(list, (a) => a.department || "—")].map(([d, items]) => ({ department: d, count: items.length })),
    byReason: [...groupBy(list, (a) => a.reason || "Not stated")].map(([r, items]) => ({ reason: r, count: items.length })),
  };
}

/* =============== Budget =============== */

/**
 * Budget vs actual per department for a month. Department names are joined
 * case/whitespace-insensitively (real exports routinely differ only in
 * casing, e.g. "Training school" vs "Training School") so budget and actual
 * don't silently split into two separate rows over a typo-level difference.
 * @returns [{department, budget, actual, variance, utilization, tone}]
 */
export function budgetStats(budgetMonthObj, employees) {
  const normKey = (s) => String(s ?? "—").trim().toLowerCase();
  const actualByNorm = groupBy(activeEmps(employees), (e) => normKey(e.department));
  // Prefer the budget file's casing for the display label; fall back to the
  // employee register's casing when a department has no budget entry at all.
  const labelByNorm = new Map();
  for (const d of Object.keys(budgetMonthObj || {})) labelByNorm.set(normKey(d), d);
  for (const [nk, members] of actualByNorm) if (!labelByNorm.has(nk)) labelByNorm.set(nk, members[0]?.department || nk);

  const rows = [];
  for (const [nk, label] of labelByNorm) {
    const budget = Number(budgetMonthObj?.[label]?.total) || 0;
    const actual = (actualByNorm.get(nk) || []).length;
    const utilization = budget ? (actual / budget) * 100 : (actual ? 999 : 0);
    rows.push({
      department: label, budget, actual,
      variance: actual - budget,
      vacancies: Math.max(0, budget - actual),
      excess: Math.max(0, actual - budget),
      utilization,
      tone: utilization > 100 ? "bad" : utilization >= 90 ? "ok" : utilization >= 70 ? "warn" : "bad",
      sections: budgetMonthObj?.[label]?.sections || null,
      designations: budgetMonthObj?.[label]?.designations || null,
      categories: budgetMonthObj?.[label]?.categories || null,
      localExpat: budgetMonthObj?.[label]?.localExpat || null,
    });
  }
  return rows.sort((a, b) => b.budget - a.budget);
}

/** Plant-level budget rollup. */
export function budgetSummary(budgetMonthObj, employees) {
  const rows = budgetStats(budgetMonthObj, employees);
  const budget = sum(rows, (r) => r.budget);
  const actual = activeEmps(employees).length;
  return {
    budget, actual,
    vacancies: sum(rows, (r) => r.vacancies),
    excess: sum(rows, (r) => r.excess),
    filledPct: budget ? (actual / budget) * 100 : 0,
    exceeded: rows.filter((r) => r.excess > 0).length,
  };
}

/* =============== Frequent absentee analytics =============== */

/**
 * Absence analysis over a month: totals, max consecutive streak, top offenders.
 * @returns [{id, name, department, section, absents, streak, absentPct}]
 */
export function absenteeStats(attendance, employees, monthKey) {
  const dates = monthDates(attendance, monthKey);
  const rows = [];
  for (const e of activeEmps(employees)) {
    let absents = 0, streak = 0, maxStreak = 0, marked = 0;
    const absentDates = [];
    for (const d of dates) {
      const r = attendance[d]?.[e.id];
      if (!r || r.status === "H") { streak = 0; continue; }
      marked++;
      if (r.status === "A") { absents++; streak++; maxStreak = Math.max(maxStreak, streak); absentDates.push(d); }
      else streak = 0;
    }
    if (marked) rows.push({
      id: e.id, name: e.name, department: e.department, section: e.section,
      absents, streak: maxStreak, marked,
      absentPct: (absents / marked) * 100, absentDates,
    });
  }
  return rows.sort((a, b) => b.absents - a.absents);
}

/* =============== Recruitment =============== */

/** Pipeline stage ordering used across recruitment views. */
export const STAGES = ["Applied", "Screening", "Interview", "Offer Released", "Offer Accepted", "Joined", "Rejected"];

export function recruitmentStats(recruitmentObj, vacanciesObj) {
  const cands = toList(recruitmentObj, "_key");
  const vacs = toList(vacanciesObj, "_key");
  const open = vacs.filter((v) => v.status !== "closed");
  const stageCount = Object.fromEntries(STAGES.map((s) => [s, cands.filter((c) => c.stage === s).length]));
  const hired = cands.filter((c) => c.stage === "Joined" && c.appliedAt && c.joinedAt);
  return {
    candidates: cands, vacancies: vacs,
    openPositions: sum(open, (v) => v.count || 1),
    stageCount,
    offerReleased: stageCount["Offer Released"] + stageCount["Offer Accepted"] + stageCount["Joined"],
    offerAccepted: stageCount["Offer Accepted"] + stageCount["Joined"],
    joiningPending: stageCount["Offer Accepted"],
    bySource: [...groupBy(cands, (c) => c.source || "Other")].map(([s, items]) => ({ source: s, count: items.length })),
    byRecruiter: [...groupBy(cands, (c) => c.recruiter || "—")].map(([r, items]) => ({
      recruiter: r, candidates: items.length,
      hires: items.filter((c) => c.stage === "Joined").length,
    })),
    avgTimeToHire: avg(hired, (c) => (parseYmd(c.joinedAt) - parseYmd(c.appliedAt)) / 86400e3),
  };
}

/* =============== Distributions =============== */

/** Bucketize a numeric metric (age, experience) into labeled bands. */
export function distribution(list, sel, bands) {
  return bands.map(([label, min, max]) =>
    ({ label, count: list.filter((e) => { const v = sel(e); return v != null && v >= min && v < max; }).length }));
}

export const AGE_BANDS = [["<20", 0, 20], ["20-29", 20, 30], ["30-39", 30, 40], ["40-49", 40, 50], ["50+", 50, 200]];
export const EXP_BANDS = [["<1y", 0, 1], ["1-3y", 1, 3], ["3-5y", 3, 5], ["5-10y", 5, 10], ["10y+", 10, 100]];
