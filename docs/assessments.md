# Assessments

Assessments are optional and generic. New installations start with an empty catalogue.

An assessment type defines stable field keys, labels, input types, required state, and stable invoice-line templates. Templates can use `{organisation}`, `{assessment_date}`, `{contract}`, `{assessment_type}`, and any configured field key. Line multipliers and percentage adjustments are stored as decimal snapshots.

Assessment records store values in `field_values_json`. Their billable timesheet rows use source-aware identity, so multiple assessments can coexist on the same date. Assessment invoices are created as canonical draft invoices and may be combined or grouped per organisation.

Issued invoice sources are locked. Contracts, hour types, and assessment types cannot be deleted while referenced. Voiding an assessment invoice releases its source records while retaining the invoice audit trail.

Document template ID, output folder ID, filename pattern, invoice template/folder, and email recipient/subject/body values are user settings rather than hard-coded organisational data.
