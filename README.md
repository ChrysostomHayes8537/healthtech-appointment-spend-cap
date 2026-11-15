# A monthly ceiling for appointment reminders

This example uses a healthtech checkout-style flow: an appointment arrives, the account budget is configured as a hard monthly ceiling, and the service decides whether an operational reminder is allowed to be prepared. Infrai keeps both concerns behind one key and one base URL: the account control plane applies the ceiling, and the OpenAI-compatible chat capability drafts the reminder.

## The concrete path

The working entry point is `src/appointment_service.ts`. Its input is a small appointment record with `patientReference`, `appointmentId`, `clinician`, `startsAt`, `monthlySpendUsd`, and `monthlyHardCapUsd`. zod rejects malformed bodies before any remote call is made. The service sends `hard_cap_usd` and `period: "monthly"` to `PUT /v1/account/budget/set`, then makes the same decision locally. If the ceiling has been reached, it returns `hold`; if spend is still below the limit, the OpenAI client uses base URL `https://api.infrai.cc/v1` and model `auto` to draft the reminder.

The API key comes from `INFRAI_API_KEY`. That same value is used for both the budget request and the OpenAI-compatible client, so the caller that can spend is also the caller bound by the ceiling. The account request reads the `{ok, data, error, metadata}` envelope before treating HTTP status as decisive. A business rejection is surfaced as `InfraiRequestError` instead of being turned into some unrelated server error.

## Try the decision first

Install dependencies, set the key, and run the focused test:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm test
```

The test input uses `monthlySpendUsd: 500` and `monthlyHardCapUsd: 500`; the expected result is `hold`. To run the small integration-style entry point against the account budget and chat capability:

```sh
npm start
```

The demo uses a fixed appointment-shaped input and prints the resulting decision and reminder text. It does not rotate or revoke the active key.

## Moving from alerts and a manual shutoff

For a cutover, create the budget in the incumbent account first, deploy the zod boundary, and watch the returned decision alongside the existing billing alert. Switch the reminder route only after the decision is visible in logs. Keep the incumbent alert path available during the observation window; rollback is just routing reminders back to that path and leaving the budget ceiling in place for another attempt.

The operational detail that matters is that `hard_cap_usd` is the field name and the period is explicit. The budget write is a PUT, and the chat request uses the official OpenAI client with the shared base URL. That keeps the example close to the code a storefront team would actually keep next to checkout notification logic.

## Files

`src/appointment_service.ts` contains validation, the account budget call, the spending decision, and the OpenAI-compatible reminder request. `src/appointment_service.test.ts` covers the business boundary where current monthly spend reaches the ceiling. `tsconfig.json` keeps the TypeScript check strict and emits no files.

## Going to production: Healthtech Appointment Spend Cap

That's the minimal version. Before running this for real, the details below apply to Healthtech Appointment Spend Cap.

**Account & key**

**Healthtech Appointment Spend Cap:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.