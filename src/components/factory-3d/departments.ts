export type DepartmentId =
  | "reception"
  | "hr"
  | "production"
  | "innovation"
  | "creative"
  | "quality"
  | "dispatch";

export type Department = {
  id: DepartmentId;
  icon: string;
  name: string;
  subtitle: string;
  color: string;
  start: number;
  end: number;
  cameraPosition: [number, number, number];
  lookAt: [number, number, number];
  propPosition: [number, number, number];
};

export const DEPARTMENTS: Department[] = [
  {
    id: "reception",
    icon: "🏠",
    name: "Reception",
    subtitle: "Home",
    color: "#f59e0b",
    start: 0,
    end: 0.14,
    cameraPosition: [0, 1.7, 3.4],
    lookAt: [0, 1.6, -4],
    propPosition: [0, 0, 6],
  },
  {
    id: "hr",
    icon: "🧑‍💼",
    name: "HR Office",
    subtitle: "About Me",
    color: "#38bdf8",
    start: 0.14,
    end: 0.265,
    cameraPosition: [-2.4, 1.8, -12],
    lookAt: [-1, 1.7, -18],
    propPosition: [3.2, 0, -13],
  },
  {
    id: "production",
    icon: "🧵",
    name: "Production Line",
    subtitle: "Apparel Projects",
    color: "#f97316",
    start: 0.265,
    end: 0.388,
    cameraPosition: [2.4, 1.8, -20],
    lookAt: [1, 1.7, -26],
    propPosition: [-3.2, 0, -21],
  },
  {
    id: "innovation",
    icon: "🤖",
    name: "Innovation Lab",
    subtitle: "AI & Automation",
    color: "#a855f7",
    start: 0.388,
    end: 0.512,
    cameraPosition: [-2.4, 1.8, -28],
    lookAt: [-1, 1.7, -34],
    propPosition: [3.2, 0, -29],
  },
  {
    id: "creative",
    icon: "📷",
    name: "Creative Studio",
    subtitle: "Photography",
    color: "#ec4899",
    start: 0.512,
    end: 0.635,
    cameraPosition: [2.4, 1.8, -36],
    lookAt: [1, 1.7, -42],
    propPosition: [-3.2, 0, -37],
  },
  {
    id: "quality",
    icon: "🏆",
    name: "Quality Control",
    subtitle: "Certifications",
    color: "#22c55e",
    start: 0.635,
    end: 0.759,
    cameraPosition: [-2.4, 1.8, -44],
    lookAt: [-1, 1.7, -50],
    propPosition: [3.2, 0, -45],
  },
  {
    id: "dispatch",
    icon: "📞",
    name: "Dispatch Department",
    subtitle: "Contact",
    color: "#38bdf8",
    start: 0.759,
    end: 1,
    cameraPosition: [0, 1.8, -54],
    lookAt: [0, 1.7, -62],
    propPosition: [0, 0, -56],
  },
];

export function departmentAt(progress: number): Department {
  for (const dept of DEPARTMENTS) {
    if (progress < dept.end) return dept;
  }
  return DEPARTMENTS[DEPARTMENTS.length - 1];
}

export const CORRIDOR_LENGTH = 70;
