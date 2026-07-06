"use client";

import { DEPARTMENTS } from "./departments";
import { DepartmentBeacon } from "./DepartmentBeacon";
import type { ProgressRef } from "./types";

export function FactoryDepartments({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <>
      {DEPARTMENTS.slice(1).map((dept) => (
        <DepartmentBeacon key={dept.id} department={dept} progressRef={progressRef} />
      ))}
    </>
  );
}
