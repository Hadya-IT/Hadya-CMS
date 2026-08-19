# User guide

The full guide is **inside the app** at `/admin/guide` — searchable, and next to
the screens it describes. That is the copy to keep current.

This file exists only so the content is greppable in the repo. It lives in
`src/lib/guide.ts` as structured data:

```ts
export const GUIDE: GuideTopic[] = [ ... ]
```

Topics: Start here · Pages · Sections · Design tab · Images · Submissions ·
Analytics · Settings & access · When something looks wrong.

## Editing it

Each section is an object with a `title`, a one-line `summary`, and then any of
`steps`, `body`, `table` or `warn`. Marking a section `audience: 'admin'` adds an
"Admin only" pill.

Two rules:

1. **Describe what the editor sees, not what the code does.** If a step cannot be
   followed by clicking, it does not belong in the guide.
2. **Keep the grid explanation accurate.** "There is no 2×4 setting — set columns,
   add items" is the single most repeated question, and the answer changes if
   anyone adds a rows control.

Search matches across every field, so a section is findable by any word in it.
