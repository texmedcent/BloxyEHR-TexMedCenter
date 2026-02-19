# Reference Catalog Import Guide

This project now supports full-scale reference catalogs via:
- `public.icd10_catalog`
- `public.medication_catalog`

Run migration first:
- `supabase/migrations/20250219000003_reference_catalogs.sql`

## ICD-10 Import

Recommended source:
- CMS ICD-10-CM code release files (or your own validated ICD-10-CM export).

Expected columns for import:
- `code` (required, primary key)
- `label` (required)
- `category_key` (optional, matches UI filters like `cardio`, `respiratory`, etc.)
- `is_billable` (optional)
- `is_active` (optional)

Example SQL insert:

```sql
insert into public.icd10_catalog (code, label, category_key, is_billable, is_active)
values
  ('I10', 'Essential (primary) hypertension', 'cardio', true, true),
  ('J18.9', 'Pneumonia, unspecified organism', 'respiratory', true, true);
```

## Medication Catalog Import

Recommended source:
- RxNorm monthly release (normalized generic names + synonyms).
- Optionally enrich with local formulary flags (`controlled`, route/frequency defaults).

Expected columns for import:
- `generic_name` (required)
- `brand_names` (`text[]`, optional)
- `rxnorm_code` (optional)
- `category_key` (optional, matches existing medication category keys)
- `controlled` (optional)
- `default_route` (optional)
- `default_frequency` (optional)
- `is_active` (optional)

Example SQL insert:

```sql
insert into public.medication_catalog (
  generic_name, brand_names, rxnorm_code, category_key, controlled, default_route, default_frequency, is_active
)
values
  ('Acetaminophen', array['Tylenol'], '161', 'analgesics', false, 'PO', 'Q6H PRN', true),
  ('Morphine', array['MS Contin'], '7052', 'analgesics', true, 'IV', 'Q4H PRN', true);
```

## UI Behavior

- If catalog tables are populated, pickers use catalog-backed search.
- If tables are empty, UI falls back to bundled curated lists in:
  - `lib/icd10.ts`
  - `lib/medications.ts`
