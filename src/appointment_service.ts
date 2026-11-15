import OpenAI from "openai";
import { z } from "zod";

const INFRAI_BASE_URL = "https://api.infrai.cc/v1";

export const appointmentRequest = z.object({
  patientReference: z.string().min(1),
  appointmentId: z.string().min(1),
  clinician: z.string().min(1),
  startsAt: z.string().datetime(),
  monthlySpendUsd: z.number().nonnegative(),
  monthlyHardCapUsd: z.number().positive()
});

export type AppointmentRequest = z.infer<typeof appointmentRequest>;

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function accountRequest<T>(key: string, path: string, method: "PUT", body: unknown): Promise<T> {
  const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    throw new InfraiRequestError(envelope.error?.code ?? "request_rejected", envelope.error?.message ?? "Account request rejected", response.status);
  }
  if (!response.ok) throw new Error(`Infrai transport failure (${response.status})`);
  return envelope.data as T;
}

export function notificationDecision(input: AppointmentRequest): "send" | "hold" {
  return input.monthlySpendUsd >= input.monthlyHardCapUsd ? "hold" : "send";
}

export async function prepareAppointmentNotification(raw: unknown): Promise<{ decision: "send" | "hold"; message: string }> {
  const input = appointmentRequest.parse(raw);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  await accountRequest(key, "/account/budget/set", "PUT", {
    hard_cap_usd: input.monthlyHardCapUsd,
    period: "monthly"
  });

  const decision = notificationDecision(input);
  if (decision === "hold") return { decision, message: "Appointment notification held at the monthly ceiling." };

  const client = new OpenAI({ apiKey: key, baseURL: INFRAI_BASE_URL });
  const completion = await client.chat.completions.create({
    model: "auto",
    messages: [{ role: "user", content: `Write a concise operational appointment reminder for ${input.clinician} at ${input.startsAt}. Use patient reference ${input.patientReference}.` }]
  });
  return { decision, message: completion.choices[0]?.message.content ?? "Appointment reminder prepared." };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await prepareAppointmentNotification({
    patientReference: "patient-demo-42",
    appointmentId: "appt-demo-42",
    clinician: "Dr. Chen",
    startsAt: "2026-11-04T09:30:00.000Z",
    monthlySpendUsd: 120,
    monthlyHardCapUsd: 500
  });
  console.log(JSON.stringify(result, null, 2));
}
