# حساب الديوان — Diwaniya Account

A bilingual (Arabic RTL / English LTR) PWA that keeps the diwaniya's money as a **chronological cash ledger** in Kuwaiti dinars. It uses a dark-navy and champagne-gold theme and saves data to Firebase.

## Run

```bash
npm install
npm run dev          # local development
npm test             # automated tests (vitest)
npm run lint         # eslint, zero warnings
npm run build        # typecheck + production build → dist/
npm run pdf:samples  # writes sample Arabic / English / bilingual PDFs to ./samples
```

Firebase: copy `.env.example` to `.env` and fill in the web config. Without it the app runs in on-device mode (localStorage). Security rules: `firestore.rules`.

## Where things live

| Concern | File |
| --- | --- |
| App name (header, login, PWA manifest, `<title>`, PDFs, footer) | `src/config/app.json` (read by `src/config/app.ts` and `vite.config.ts`), plus `app.name` in the translation files |
| Translations | `src/i18n/ar.json`, `src/i18n/en.json` (lookup: `src/i18n/translate.ts`, React: `src/i18n/I18nProvider.tsx`) |
| Running balance and ordering | `src/domain/ledger.ts` |
| Month sections and carry-forward | `src/domain/periods.ts` |
| Money (integer fils) | `src/domain/money.ts` |
| Categories (defaults and merge) | `src/domain/categories.ts` |
| Category analysis, search and filters | `src/domain/analysis.ts`, `src/domain/filters.ts` |
| Report model (ar / en / bilingual text) | `src/pdf/reportModel.ts` |
| PDF ledger renderer | `src/pdf/pdfReport.ts` |
| Arabic bidi runs for the PDF | `src/pdf/bidiText.ts` |
| Firestore persistence | `src/data/firebaseRepository.ts` |

## Ledger rules

* Balance after a transaction = previous balance + received inflow − paid outflow.
* Transaction order: date, then created time, then document id.
* The opening balance comes first on its effective date. It is not counted as inflow.
* Pending inflows and due or overdue outflows appear in the ledger but don't change the cash balance. Due outflows count as unpaid commitments.
* Balances are never stored. They are recalculated from the data, so any edit or delete fixes every later row.
