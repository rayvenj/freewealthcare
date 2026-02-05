# Moore Hospitality — Loveable Code True-Up Prompt

Use this prompt with Loveable (or any AI coding agent) to refine the code for https://moorehospitality.xyz/.

## Prompt
You are a senior front-end engineer and product designer. Please **true up** and **refine** the codebase for https://moorehospitality.xyz/ with a focus on production readiness, visual polish, performance, and accessibility.

### Goals
1. **Visual polish**
   - Harmonize typography (scale, line-height, spacing) and improve hierarchy.
   - Tighten layout spacing to feel premium and hospitality-focused.
   - Ensure consistent button styles, hover states, and focus states.

2. **Accessibility (WCAG 2.1 AA)**
   - Ensure color contrast, keyboard navigation, and visible focus rings.
   - Add/confirm semantic HTML and ARIA where needed.

3. **Performance & maintainability**
   - Reduce layout shift (CLS) and avoid content jumps.
   - Deduplicate or simplify styles/components.
   - Ensure responsive behavior for mobile, tablet, and desktop.

4. **Content clarity**
   - Make section headings and CTA copy concise and action-oriented.
   - Ensure consistent capitalization and punctuation.

### Output requirements
- Provide a concise **summary of changes** grouped by area (visual, accessibility, performance, content).
- Provide a **diff/patch** or list of files edited with a brief rationale per file.
- If any changes are assumptions, call them out explicitly.

### Constraints
- Keep the brand look upscale and modern.
- Do not remove existing sections unless they are duplicates.
- Keep all current navigation/CTA targets functional.
- If you change colors or typography, provide the new tokens/variables.

### Deliverables
- Updated code with improvements.
- A short QA checklist for responsive, a11y, and performance validation.
