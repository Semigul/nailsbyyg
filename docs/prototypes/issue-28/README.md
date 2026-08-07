# Prototyp: mobil struktur för beställningsöversikten

Tre varianter av beställningsöversikten, växlingsbara med `?variant=`, på den
befintliga och inloggningsskyddade routen `/admin.html`.

Frågan är vilken mobil informationsarkitektur som gör det snabbast och
tydligast att se aktiva beställningar och starta en ny. Prototypen är
engångskod för [Wayfinder-biljett #28](https://github.com/Semigul/nailsbyyg/issues/28),
inte en produktionsimplementation.

## Starta

```bash
python3 -m http.server 5500
```

Logga in som vanligt och öppna:

- `http://localhost:5500/admin.html?variant=A` — fokuslista med statusfilter.
- `http://localhost:5500/admin.html?variant=B` — prioriterad handlingskö.
- `http://localhost:5500/admin.html?variant=C` — en status i taget.

Pilarna i den mörka listen eller tangentbordets vänster-/högerpil byter variant
utan omladdning. Utan en giltig `variant`-parameter visas den befintliga sidan
oförändrad.

## Det som ska jämföras

- Hur snabbt en aktuell beställning går att hitta.
- Om statusflödet går att förstå utan instruktion.
- Om `Ny beställning` syns direkt och känns som huvudhandlingen.
- Om arkiv och andra verktyg går att hitta utan att störa huvudflödet.
- Hur lagom mängd information känns på cirka 390 px bred mobilskärm.

Knappar som hör till översiktens presentationsidé ändrar inte beställningar.
`Ny beställning` leder däremot till det befintliga formuläret så att starten på
den verkliga uppgiften kan bedömas i sitt sammanhang.
