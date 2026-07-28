---
name: Release Requirements
description: "Use when preparing release, deploy, or verification for GitHub Pages. Includes mobile-first and child-friendly quality gates."
---
# Releasekrav for Orderkompis

Anvand denna checklista innan release.

## Produktkrav
- Appen ska fungera bra pa mobil i portrattlage.
- Flodet for "Ny order" ska vara tydligt for ett barn runt 10 ar.
- Knappar ska vara stora nog for touch (minst cirka 44px hojd).
- Viktig information ska vara pa enkel svenska.

## Tekniska krav
- Appen ska fungera utan backend (lokal lagring).
- Om Firebase anvands ska appen fortsatt fungera lokalt vid fel.
- Inga hemligheter far laggas i repo.

## Releasekrav
- .github/workflows/deploy-pages.yml ska deploya utan fel.
- Minst en manuell mobiltest ska goras fore release.
- README ska beskriva hur man startar och deployar appen.
