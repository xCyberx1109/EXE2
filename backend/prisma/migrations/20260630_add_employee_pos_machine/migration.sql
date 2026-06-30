-- Create EmployeePosMachine junction table (N:N between Employee and PosMachine)
CREATE TABLE "employee_pos_machines" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "posMachineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_pos_machines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_pos_machines_employeeId_posMachineId_key" ON "employee_pos_machines"("employeeId", "posMachineId");
CREATE INDEX "employee_pos_machines_employeeId_idx" ON "employee_pos_machines"("employeeId");
CREATE INDEX "employee_pos_machines_posMachineId_idx" ON "employee_pos_machines"("posMachineId");

ALTER TABLE "employee_pos_machines" ADD CONSTRAINT "employee_pos_machines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_pos_machines" ADD CONSTRAINT "employee_pos_machines_posMachineId_fkey" FOREIGN KEY ("posMachineId") REFERENCES "pos_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
