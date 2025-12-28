# Invoices

*TODO - Need to update when the invoice generation is working correctly.*

Available when `enable_invoices` is enabled; line item templates require `enable_contract_line_item_templates`.

## Prerequisites
- Configure template doc ID, output folder ID, and placeholder limit in Settings.
- Ensure contracts/hour types exist for linking line items to entries.

## Core Flow
- Invoices page lists headers; select/create to edit.
- Header fields: invoice number/date, client info, status, etc.
- Line items: description, amount; optional hours and hour type.
- Defaults drawer stores reusable line definitions.

## Entry Linkage
- When hours are present on a line, a basic entry is created/updated immediately.
- If the calendar entry later changes, a “modified” warning surfaces.

## Generation
- Uses Google Docs template placeholders: invoice number/date/total, total hours, per-line fields (date, description, hours, hour type, rate, amount, contract) up to configured limit.
- Template and output folder IDs are cached on the invoice record for re-generation.

## Tips
- Keep hour types aligned with invoiced work to avoid income mismatch.
- Ensure line limit in Settings matches template placeholders.

## Summary

Invoices track company income with line items, client details, and Google Docs generation. Create headers, add line items with optional hours linkage, manage default templates, and generate formatted invoices from templates.

