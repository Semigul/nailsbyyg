# Research: lättbegripliga mobila arbetsflöden för en ung användare

Datum: 2026-08-07  
Beslutsunderlag för: [GitHub-ärende #29](https://github.com/Semigul/nailsbyyg/issues/29)

## Fråga och avgränsning

Vilka väldokumenterade mönster kan hjälpa en elvaårig orderansvarig att se
beställningar, registrera en beställning och ändra status snabbt och säkert på
mobil? Rapporten anger principer och testbara krav. Den väljer inte flikar,
kort, lista, detaljvy eller formulärlayout.

Källorna är W3C-standarder och kompletterande WAI-vägledning samt officiella
riktlinjer från Apple, Android, GOV.UK och brittiska ICO. WAI:s kognitiva
designmönster är uttryckligen kompletterande vägledning, inte ytterligare
WCAG-krav. ICO-råden gäller främst barns integritet och används här som
åldersanpassade designheuristiker, inte som ett påstående om att brittisk lag
gäller NailsbyG.

## Källfynd

### 1. Prioritera huvuduppgifterna och tona ned resten

WAI rekommenderar att viktiga uppgifter får visuell tyngd, ligger tidigt i
innehållet och är lätta att hitta. Samma vägledning stödjer att funktioner som
inte är nödvändiga kan döljas, om de fortfarande är lätta att hitta när de
behövs. [WAI: viktiga uppgifter](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o2p01-site-important/),
[WAI: förenkling](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o8p03-complexity/)

**Tillämpning för prototyperna:** gör `Se beställningar` och `Ny beställning`
omedelbart synliga. Testa sekundära verktyg bakom en tydligt namngiven väg, men
göm aldrig information som de flesta behöver för sin aktuella uppgift. Det
senare följer även GOV.UK:s gräns för progressiv visning.
[GOV.UK: Details](https://design-system.service.gov.uk/components/details/)

### 2. Använd stabil struktur och ord som användaren känner igen

WAI anger att vanliga ord, synliga etiketter nära kontrollen och konsekvent
identifierade funktioner gör kontroller lättare att förstå. Återkommande
navigering ska behålla samma relativa ordning.
[WAI: tydliga etiketter](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p06-clear-labels/),
[WCAG 3.2.3](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation),
[WCAG 3.2.4](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification)

**Tillämpning för prototyperna:** använd samma svenska verb och substantiv
överallt, exempelvis `Ny beställning`, `Ändra status`, `Redigera` och
`Arkivera`. Låt inte en ikon ensam bära innebörden för en kärnuppgift. Byt inte
placering eller namn på samma åtgärd mellan översikt, detalj och formulär.

### 3. Gör touchkontroller rymliga och ge alltid ett enkelt alternativ till dragning

WCAG 2.2 AA kräver normalt en pekyta på minst 24 × 24 CSS-pixlar eller
tillräckligt mellanrum; den starkare AAA-nivån anger 44 × 44 CSS-pixlar. Apple
rekommenderar minst 44 × 44 punkters träffyta och Android minst 48 × 48 dp för
touchkontroller.
[WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum),
[WCAG 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced),
[Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons),
[Android: Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/apps.html)

WCAG 2.5.7 kräver att funktionalitet som använder dragning också kan utföras
med en enkel pekinteraktion utan dragning.
[WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)

**Tillämpning för prototyperna:** sikta på minst cirka 44 × 44 CSS-pixlar för
primära mobilkontroller och håll farliga åtgärder isär. Drag och släpp kan vara
en genväg för status, men det måste finnas ett tydligt tryckbart alternativ.

### 4. Bekräfta resultatet och gör misstag lätta att rätta

Upptäckta formulärfel ska identifieras och beskrivas i text, och kända sätt att
rätta dem ska föreslås. WAI rekommenderar att användaren kan granska och ändra
uppgifter utan att förlora redan inmatat innehåll; en sammanfattning före en
viktig inlämning kan göra fel synliga. Synliga statusmeddelanden om exempelvis
sparande ska även kunna förmedlas av hjälpmedel.
[WCAG 3.3.1](https://www.w3.org/WAI/WCAG22/Understanding/error-identification),
[WCAG 3.3.3](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion),
[WAI: ångra formulärfel](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p05-form-undo/),
[WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

**Tillämpning för prototyperna:** visa direkt `Beställningen är sparad` eller
ett konkret fel och nästa steg. Bevara formulärdata vid fel och bakåtnavigering.
Gör arkivering till normal åtgärd. Placera permanent radering sekundärt, beskriv
konsekvensen och kräv bekräftelse. Undersök `Ångra` för status- och
arkivändringar.

### 5. Dela upp komplexitet utan att dölja nödvändiga fält

GOV.UK rekommenderar att formulär utformas för sitt faktiska format, ordnas
efter vanliga scenarier och använder förgrening så att användaren bara möter
relevanta frågor. GOV.UK varnar samtidigt för att gömma information som de
flesta användare behöver.
[GOV.UK: formulärstruktur](https://www.gov.uk/service-manual/design/form-structure),
[GOV.UK: Details](https://design-system.service.gov.uk/components/details/)

**Tillämpning för prototyperna:** behåll samtliga befintliga fält och regler,
men jämför begripliga grupper eller steg. Prototyperna måste kontrollera att
uppdelningen inte gör vanliga uppgifter långsammare eller gömmer obligatorisk
information. Tidigare svar ska ligga kvar när användaren går framåt och bakåt.

### 6. Låna förutsägbarhet från sociala appar, inte deras uppmärksamhetsmönster

Apple beskriver tydlig och konsekvent återkoppling som ett sätt att visa vad
som händer, nästa möjliga steg och resultatet av en handling. ICO:s
barnriktlinjer avråder från nudgar som får barn att lämna onödiga
personuppgifter eller sänka sitt integritetsskydd.
[Apple HIG: Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback),
[ICO: Code standards](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/code-standards/)

**Tillämpning för prototyperna:** låna omedelbar respons, tydligt markerad
aktuell status och korta handlingsverb. Undvik oändliga flöden, autoplay,
streaks, belöningsanimationer och brådskande notiser som inte hjälper
orderuppgiften. Detta är en ansvarsprincip, inte ett val av visuell stil.

### 7. Validera med den faktiska unga användaren

ICO rekommenderar att barn involveras för att kontrollera att utkast är
tillgängliga och begripliga och att metoden anpassas till sammanhanget. För
åldern 10–12 rekommenderar ICO progressiv detaljnivå för integritetsinformation
och betonar att barn i samma ålder kan ha olika behov och förståelse.
[ICO: involvera barn](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/designing-products-that-protect-privacy/childrens-code-design-guidance/bring-children-s-views-into-the-design-process/),
[ICO: behov över tid](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/designing-products-that-protect-privacy/childrens-code-design-guidance/meet-children-s-needs-as-they-change-over-time/)

GOV.UK:s metod för modererade användningstest säger att uppgifter ska ha ett
tydligt och trovärdigt mål utan att avslöja hur de ska lösas. Deltagaren ska få
veta att tjänsten testas, inte personen.
[GOV.UK: modererade användningstest](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing)

**Tillämpning för valideringen:** låt den faktiska elvaåriga orderansvariga, på
sin vanliga mobil och utan stegvisa instruktioner:

1. hitta en aktuell beställning;
2. registrera en komplett beställning;
3. ändra status;
4. hitta och redigera en detalj;
5. arkivera utan att riskera permanent radering.

Använd realistiska men påhittade kunduppgifter. Be om vårdnadshavares stöd och
samtycke där det behövs, gör tydligt att barnet kan avbryta och lagra inga
onödiga personuppgifter från testsessionen.

## Designprinciper att ta vidare

1. **Två tydliga huvuduppgifter:** beställningsöversikt och ny beställning ska
   gå att hitta direkt.
2. **Konsekvent språk och struktur:** samma åtgärd ska alltid heta och bete sig
   likadant.
3. **Mobilprecision:** rymliga tryckytor, avstånd mellan riskfyllda val och
   inget beroende av dragning.
4. **Synligt systemtillstånd:** visa aktuell status, laddning, lyckat resultat
   och fel i klartext.
5. **Säker återhämtning:** bevara inmatning, stöd rättning och gör destruktiva
   handlingar svåra att utlösa av misstag.
6. **Progressiv komplexitet:** visa det som behövs nu och håll resten enkelt
   att hitta; dölj inte information som de flesta behöver.
7. **Vuxet men lättbegripligt:** bekanta interaktionsmönster och korta ord,
   utan barnslig estetik eller uppmärksamhetsdrivande mekanik.
8. **Bevis genom användning:** välj slutlig lösning först efter uppgiftsbaserat
   test med den faktiska målpersonen.

## Frågor som prototyperna ska avgöra

- Vilken informationsarkitektur gör de två huvuduppgifterna snabbast att hitta?
- Vilken uppdelning av det fullständiga formuläret känns enklast utan fler fel?
- Hur mycket beställningsinformation behövs före öppning av en detalj?
- Vilket tryckbart statusmönster fungerar bäst, med eventuell dragning som
  bonus?
- Var hittar användaren sekundära verktyg igen utan att huvudflödet blir rörigt?

Källorna avgör inte dessa layoutbeslut; de ger kriterier för att jämföra
prototyperna.
