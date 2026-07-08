/**
 * Sample-data seeder (HR Admin only, launched from Settings).
 *
 * Populates the database with a realistic Brandix-style garment plant:
 * ~120 employees across 8 departments, 60 days of attendance, budgets,
 * leaves, attrition, vacancies and a recruitment pipeline — so every chart
 * and report has data to show before real uploads begin.
 */
import { dbUpdate, dbSet } from "./store.js";
import { ym, ymd, addDays, today, dateRange } from "./utils.js";
import { notify } from "./notify.js";

/* Deterministic PRNG so repeated seeding produces the same plant. */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260706);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const rint = (min, max) => min + Math.floor(rand() * (max - min + 1));

const FIRST = ["Kasun", "Nimal", "Sunil", "Chamara", "Ruwan", "Dilshan", "Tharindu", "Sampath", "Nuwan", "Ishara",
  "Sanduni", "Dilani", "Nadeesha", "Kumari", "Chathurika", "Hansika", "Ishini", "Sachini", "Madhavi", "Tharushi",
  "Amila", "Buddhika", "Lahiru", "Prasad", "Gayan", "Roshan", "Anjula", "Pavithra", "Sewwandi", "Udari"];
const LAST = ["Perera", "Fernando", "Silva", "Jayasinghe", "Bandara", "Rathnayake", "Wickramasinghe", "Gunawardena",
  "Dissanayake", "Herath", "Weerasinghe", "Karunaratne", "Senanayake", "Ekanayake", "Samaraweera"];

const DEPTS = [
  { name: "Sewing", sections: ["Line A", "Line B", "Line C", "Line D"], size: 44, budget: 48 },
  { name: "Cutting", sections: ["Fabric", "Marker", "Spreading"], size: 16, budget: 18 },
  { name: "Finishing", sections: ["Pressing", "Packing"], size: 15, budget: 16 },
  { name: "Quality", sections: ["Inline QC", "Final QC", "Audit"], size: 13, budget: 14 },
  { name: "Stores", sections: ["Fabric Store", "Trim Store"], size: 8, budget: 8 },
  { name: "Engineering", sections: ["Maintenance", "IE"], size: 8, budget: 9 },
  { name: "Planning", sections: ["Production Planning"], size: 5, budget: 5 },
  { name: "HR & Admin", sections: ["HR", "Admin", "Compliance"], size: 8, budget: 8 },
];
const MODULES = ["Module 1", "Module 2", "Module 3", "Module 4", "Module 5", "Module 6"];
const BUYERS = ["Nike", "Adidas", "Levi's", "GAP", "H&M", "Uniqlo"];
const DESIGNATIONS = {
  Sewing: ["Machine Operator", "Team Leader", "Line Supervisor"],
  Cutting: ["Cutter", "Marker Maker", "Cutting Supervisor"],
  Finishing: ["Presser", "Packer", "Finishing Supervisor"],
  Quality: ["QC Checker", "Quality Auditor", "QA Executive"],
  Stores: ["Storekeeper", "Store Assistant"],
  Engineering: ["Mechanic", "Electrician", "IE Executive"],
  Planning: ["Planner", "Planning Executive"],
  "HR & Admin": ["HR Executive", "Admin Assistant", "Compliance Officer"],
};
const REASONS = ["Better opportunity", "Salary", "Personal / family", "Relocation", "Higher studies"];

/** Build the full seed payload (pure, no writes). */
function buildSeed() {
  const employees = {};
  const attrition = {};
  let seq = 1;

  for (const dept of DEPTS) {
    for (let i = 0; i < dept.size; i++) {
      const id = `B3${String(seq++).padStart(4, "0")}`;
      const gender = rand() < (dept.name === "Sewing" ? 0.72 : 0.4) ? "Female" : "Male";
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const dojYear = rint(2015, 2025);
      const doj = ymd(new Date(dojYear, rint(0, 11), rint(1, 28)));
      const dob = ymd(new Date(rint(1975, 2005), rint(0, 11), rint(1, 28)));
      const designation = pick(DESIGNATIONS[dept.name]);
      employees[id] = {
        name, department: dept.name, section: pick(dept.sections),
        module: dept.name === "Sewing" ? pick(MODULES) : "",
        buyer: ["Sewing", "Cutting", "Finishing", "Quality"].includes(dept.name) ? pick(BUYERS) : "",
        designation,
        grade: pick(["G1", "G2", "G3", "G4"]),
        category: /Supervisor|Executive|Leader|Auditor|Officer|Planner/.test(designation) ? "Staff" : pick(["Direct", "Direct", "Direct", "Indirect"]),
        gender, dob, doj,
        type: rand() < 0.82 ? "Permanent" : "Contract",
        nationality: rand() < 0.97 ? "Local" : "Expat",
        status: "active",
        otRate: rint(250, 520),
        email: `${id.toLowerCase()}@brandix.example`,
        phone: `07${rint(0, 7)}${String(rint(1000000, 9999999))}`,
      };
    }
  }

  const ids = Object.keys(employees);

  /* Attrition: 8 past exits + 3 on notice */
  for (let i = 0; i < 8; i++) {
    const id = pick(ids);
    if (employees[id].status !== "active") continue;
    const lastDay = addDays(today(), -rint(10, 300));
    employees[id].status = "resigned";
    employees[id].resignDate = lastDay;
    attrition[`seed${i}`] = {
      empId: id, name: employees[id].name, department: employees[id].department,
      type: rand() < 0.85 ? "Resigned" : "Terminated",
      noticeDate: addDays(lastDay, -30), lastDay,
      reason: pick(REASONS), tenureYears: rint(1, 8),
      replacement: pick(["Hired", "Pending", "Pending"]),
    };
  }
  for (let i = 0; i < 3; i++) {
    const id = pick(ids);
    if (employees[id].status !== "active") continue;
    employees[id].status = "notice";
    employees[id].resignDate = addDays(today(), rint(5, 30));
    attrition[`notice${i}`] = {
      empId: id, name: employees[id].name, department: employees[id].department,
      type: "Resigned", noticeDate: today(), lastDay: employees[id].resignDate,
      reason: pick(REASONS), tenureYears: rint(1, 6), replacement: "Pending",
    };
  }

  /* Attendance: last 60 days, Sundays = holiday */
  const attendance = {};
  const shiftOf = (dept) => (dept === "Sewing" && rand() < 0.3 ? "B" : "A");
  for (const date of dateRange(addDays(today(), -59), today())) {
    const day = {};
    const isSunday = new Date(date + "T00:00").getDay() === 0;
    for (const id of ids) {
      const e = employees[id];
      if (e.status === "resigned" && e.resignDate < date) continue;
      if (e.doj > date) continue;
      if (isSunday) { day[id] = { status: "H" }; continue; }
      const r = rand();
      let rec;
      if (r < 0.895) {
        const inMin = 465 + (rand() < 0.1 ? rint(15, 55) : rint(-10, 9)); // 07:45 ±
        const otH = rand() < 0.42 ? rint(1, 3) : 0;
        const outMin = 1020 + otH * 60 + rint(-5, 10);
        rec = {
          status: "P",
          in: `${String(Math.floor(inMin / 60)).padStart(2, "0")}:${String(inMin % 60).padStart(2, "0")}`,
          out: `${String(Math.floor(outMin / 60)).padStart(2, "0")}:${String(outMin % 60).padStart(2, "0")}`,
          workMin: outMin - inMin, otHours: otH, shift: shiftOf(e.department),
          late: inMin > 490, earlyOut: outMin < 1020,
        };
      } else if (r < 0.945) rec = { status: "A" };
      else if (r < 0.975) rec = { status: "L" };
      else if (r < 0.99) rec = { status: "HD", workMin: 270 };
      else rec = { status: "WFH", workMin: 540 };
      day[id] = rec;
    }
    attendance[date] = day;
  }

  /* Budget for previous, current and next month */
  const budget = {};
  for (const off of [-1, 0, 1]) {
    const d = new Date(); d.setMonth(d.getMonth() + off);
    const key = ym(d);
    budget[key] = {};
    for (const dept of DEPTS) {
      budget[key][dept.name] = {
        total: dept.budget,
        sections: Object.fromEntries(dept.sections.map((s) => [s, Math.ceil(dept.budget / dept.sections.length)])),
      };
    }
  }

  /* Leaves — nested leaves/{empId}/{key}, matching the live app's schema so a
     public/anonymous session can be scoped to read only its own subtree. */
  const leaves = {};
  for (let i = 0; i < 14; i++) {
    const id = pick(ids);
    const e = employees[id];
    if (e.status !== "active") continue;
    const from = addDays(today(), rint(-20, 10));
    const days = rint(1, 3);
    if (!leaves[id]) leaves[id] = {};
    leaves[id][`seed${i}`] = {
      empId: id, name: e.name, department: e.department,
      type: pick(["Annual", "Casual", "Medical"]), from, to: addDays(from, days - 1), days,
      reason: "", status: pick(["approved", "approved", "pending"]),
      appliedAt: Date.now() - rint(0, 20) * 86400e3,
      approvedBy: "Seed",
    };
  }

  /* Vacancies + recruitment pipeline */
  const vacancies = {
    v1: { designation: "Machine Operator", department: "Sewing", section: "Line B", count: 4, priority: "High", status: "open", openedAt: addDays(today(), -12) },
    v2: { designation: "QC Checker", department: "Quality", section: "Final QC", count: 2, priority: "Normal", status: "open", openedAt: addDays(today(), -8) },
    v3: { designation: "Mechanic", department: "Engineering", section: "Maintenance", count: 1, priority: "High", status: "open", openedAt: addDays(today(), -20) },
    v4: { designation: "Cutter", department: "Cutting", section: "Fabric", count: 2, priority: "Low", status: "closed", openedAt: addDays(today(), -60), closedAt: addDays(today(), -25) },
  };
  const stages = ["Applied", "Screening", "Interview", "Offer Released", "Offer Accepted", "Joined", "Rejected"];
  const recruitment = {};
  for (let i = 0; i < 18; i++) {
    const stage = pick(stages);
    const appliedAt = addDays(today(), -rint(5, 45));
    recruitment[`seed${i}`] = {
      candidate: `${pick(FIRST)} ${pick(LAST)}`,
      position: pick(["Machine Operator", "QC Checker", "Mechanic", "Cutter"]),
      department: pick(["Sewing", "Quality", "Engineering", "Cutting"]),
      source: pick(["Referral", "Walk-in", "Job board", "Agency", "Social media"]),
      recruiter: pick(["Ishara HR", "Sanduni HR", "Amila HR"]),
      stage, appliedAt,
      ...(stage === "Joined" ? { joinedAt: addDays(appliedAt, rint(10, 30)) } : {}),
    };
  }

  return { employees, attendance, budget, attrition, leaves, vacancies, recruitment };
}

/**
 * Write the sample dataset. Existing nodes for these paths are REPLACED.
 * @param {Function} onProgress optional progress callback (label)
 */
export async function seedDatabase(onProgress = () => {}) {
  const data = buildSeed();
  onProgress("Writing employees…");
  await dbSet("employees", data.employees);
  onProgress("Writing 60 days of attendance…");
  await dbSet("attendance", data.attendance);
  onProgress("Writing budgets, leaves, attrition…");
  await dbUpdate("/", {
    budget: data.budget, attrition: data.attrition, leaves: data.leaves,
    vacancies: data.vacancies, recruitment: data.recruitment,
  });
  await dbSet("settings/otRate", 350);
  await dbSet("settings/attendanceThreshold", 90);
  notify("system", "Sample data loaded", `${Object.keys(data.employees).length} employees, 60 days of attendance`);
  onProgress("Done");
}
