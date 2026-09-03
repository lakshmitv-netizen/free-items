# free-items

**Type:** Collaborative Prototyping Hub
**Created:** 2026-09-03

## Structure

- `knowledgebases/` - PRDs and research insights (the source of truth for the prototype)
- `prototype/` - the ONE active prototype (SLDS starter kit and LWC components)
- `outputs/` - Quality reports and decision logs
- `references/` - read-only reference repos (gitignored, never merged into the prototype)

One hub builds one prototype. To explore another repo for ideas, clone it
into `references/` instead of mixing it into `prototype/`.

## Getting Started

1. Generate PRD: `/collaborative-prototyping-hub:generate-prd`
2. Start prototyping: `/collaborative-prototyping-hub:build-prototype`
3. Validate quality: `/collaborative-prototyping-hub:validate-prototype`
4. Publish: `/collaborative-prototyping-hub:publish-prototype`

## Team Collaboration

This hub is shared via git. Add a remote and push to share:

```bash
git remote add origin <your-git-url>
git push -u origin main
```
