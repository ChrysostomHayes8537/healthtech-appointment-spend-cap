import { strict as assert } from "node:assert";
import test from "node:test";
import { appointmentRequest, notificationDecision } from "./appointment_service.ts";

test("holds an appointment notification when monthly spend reaches hard cap", () => {
  const request = appointmentRequest.parse({
    patientReference: "patient-7",
    appointmentId: "appt-7",
    clinician: "Dr. Rao",
    startsAt: "2026-11-04T09:30:00.000Z",
    monthlySpendUsd: 500,
    monthlyHardCapUsd: 500
  });
  assert.equal(notificationDecision(request), "hold");
});
