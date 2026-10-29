# Budget templates

A template is a starter set of categories you can share as a single JSON file.
Opening one in FreeWealthCare (**Templates & data → Open a template file**)
adds its categories to your budget.

## What a template can and can't do

| Can | Can't |
| --- | --- |
| Add categories and groups | Add, change or delete transactions |
| Suggest a set-aside percentage for a category (e.g. 25% for taxes) | Assign money or change balances |
| Restore an archived category with the same name | Overwrite a set-aside rate you already chose |

Applying the same template twice changes nothing. Categories match on group
and name, ignoring case.

## Format

```json
{
  "format": "freewealthcare-template",
  "version": 1,
  "id": "my-template",
  "name": "My Template",
  "description": "Who it's for and how to use it.",
  "author": "Optional",
  "source": "https://optional.example/link",
  "categories": [
    { "group": "Taxes", "name": "Quarterly Estimated Taxes", "setAsideRate": 2500 },
    { "group": "Bills", "name": "Rent / Mortgage" }
  ]
}
```

| Field | Rules |
| --- | --- |
| `id` | Lowercase letters, numbers and dashes, up to 64 characters |
| `name`, `group` | 1 to 100 characters |
| `description` | Up to 1,000 characters |
| `categories` | 1 to 200 entries |
| `setAsideRate` | Optional. Basis points: `2500` = 25%. Whole number from 1 to 9000. |

Files over 256 KB are refused. Unknown fields are ignored.

## Built-in templates

| Template | File |
| --- | --- |
| 1099 Contractor Starter | [`public/templates/1099-contractor.json`](../public/templates/1099-contractor.json) |

Built-ins live in `src/templates/` and are bundled into the app. The copy in
`public/templates/` is the one people download; a test keeps the two identical.
