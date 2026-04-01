# Option 4: Full Map Restructure — Implementation Plan

## Overview

Restructure the campaign map from 5 regions (39 nodes) to 7 doctrinal-pillar regions (98 nodes). This replaces the existing region topology with one that mirrors a standard constitutional law curriculum, placing every scenario in its correct doctrinal neighborhood.

---

## Phase 0: Region Definitions & Scenario Assignments

### The 7 Regions

| Region ID | Label | Scenarios | Description |
|-----------|-------|-----------|-------------|
| `judicial-power` | Judicial Power | 7 | Judicial review, standing, mootness, political question doctrine, constitutional interpretation |
| `congressional-power` | Congressional Power | 17 | Commerce Clause, spending power, taxing power, Necessary & Proper Clause |
| `executive-power` | Executive Power | 17 | Youngstown framework, executive privilege, presidential immunity, removal power |
| `separation-of-powers` | Separation of Powers | 14 | Non-delegation, legislative veto, appointments, major questions doctrine |
| `federalism` | Federalism | 13 | Anti-commandeering, preemption, Dormant Commerce Clause, Privileges & Immunities |
| `foreign-affairs` | Foreign Affairs | 9 | Treaties, executive agreements, war powers, recognition power |
| `individual-rights` | Individual Rights | 21 | Equal Protection (all tiers), Substantive Due Process, incorporation, fundamental rights |

### Scenario-to-Region Assignments

#### judicial-power (7)
- the-partisan-gerrymander-challenge *(migrates from democracy-justiciability)*
- gerrymandering-challenge *(new)*
- environmental-standing *(new)*
- abortion-clinic-mootness *(new)*
- president-refuses-court-order *(new)*
- agency-defiance-judicial-review *(new)*
- second-amendment-interpretation-methods *(new)*

#### congressional-power (17)
- the-school-zone-statute *(migrates from federalism)*
- the-home-garden-prohibition *(migrates from federalism)*
- the-purchase-mandate *(migrates from federalism)*
- spending-clause-coercion *(migrates from federalism)*
- the-highway-incentive *(migrates from federalism)*
- the-medicaid-ultimatum *(migrates from federalism)*
- federal-mental-health-act *(new)*
- national-broadband-mandate *(new)*
- nutrition-mandate-inactivity *(new)*
- domestic-violence-housing-act *(new)*
- intrastate-endangered-species *(new)*
- homegrown-psychedelics-regulation *(new)*
- education-standards-funding *(new)*
- education-medicaid-spending-coercion *(new)*
- carbon-emissions-charge *(new)*
- social-media-age-verification-fee *(new)*
- mcculloch-modern-bank *(new)*

#### executive-power (17)
- youngstown-steel-seizure *(stays)*
- the-frozen-accounts *(stays)*
- the-frozen-accounts-statutory-twist *(stays)*
- the-tariff-gambit *(stays)*
- youngstown-full-analysis *(stays)*
- the-subpoenaed-tapes *(stays)*
- the-state-of-the-union-incident *(stays)*
- the-rally-gone-wrong *(stays)*
- presidential-immunity-framework *(stays)*
- removal-independent-agency-head *(stays)*
- removal-multi-member-commission *(stays)*
- seila-law-deep-dive *(stays)*
- president-seizes-semiconductor-plants *(new)*
- presidential-campaign-rally-assault *(new)*
- executive-privilege-congressional-subpoena *(new)*
- independent-ai-safety-director *(new)*
- double-insulated-inspector-general *(new)*

#### separation-of-powers (14)
- ins-v-chadha-legislative-veto *(migrates from administrative-state)*
- the-nullification-resolution *(migrates from administrative-state)*
- the-sixtyday-window *(migrates from administrative-state)*
- the-approval-requirement *(migrates from administrative-state)*
- nondelegation-intelligible-principle *(migrates from administrative-state)*
- the-public-interest-mandate *(migrates from administrative-state)*
- the-registration-directive *(migrates from administrative-state)*
- the-unsupervised-adjudicator *(migrates from administrative-state)*
- the-congressional-commission *(migrates from administrative-state)*
- pandemic-emergency-delegation *(new)*
- ai-oversight-legislative-veto *(new)*
- epa-carbon-major-questions *(new)*
- congressional-inspector-general *(new)*
- tech-czar-appointments *(new)*

#### federalism (13)
- the-waste-disposal-directive *(stays)*
- the-background-check-order *(stays)*
- dormant-commerce-clause-flow-control *(stays)*
- federal-preemption-cannabis *(stays)*
- federal-gun-registry-commandeering *(new)*
- state-drone-privacy-preemption *(new)*
- state-wine-shipping-ban *(new)*
- state-truck-length-safety *(new)*
- dairy-subsidy-scheme *(new)*
- humane-poultry-standards-dcc *(new)*
- insurance-regulation-mccarran-ferguson *(new)*
- nonresident-fishing-license-fees *(new)*
- medical-school-residency-preference *(new)*

#### foreign-affairs (9)
- the-foreign-arms-embargo *(stays)*
- the-hostage-crisis-executive-agreement *(stays)*
- the-treaty-enforcement-memo *(stays)*
- the-passport-dispute *(stays)*
- the-unilateral-bombing-campaign *(stays)*
- climate-executive-agreement *(new)*
- passport-recognition-power *(new)*
- treaty-delegation-international-body *(new)*
- unilateral-military-strike *(new)*

#### individual-rights (21)
- equal-protection-scrutiny-framework *(migrates from democracy-justiciability)*
- disparate-impact-intent-framework *(migrates from democracy-justiciability)*
- food-truck-licensing-ban *(new)*
- school-admissions-test-disparate-impact *(new)*
- fire-department-diversity-program *(new)*
- male-parental-leave-discrimination *(new)*
- adoption-agency-orientation-ban *(new)*
- resegregation-after-unitary-status *(new)*
- gender-identity-birth-certificate *(new)*
- race-neutral-admissions-post-sffa *(new)*
- drug-conviction-business-license-ban *(new)*
- women-stem-scholarship *(new)*
- police-promotion-exam-disparate-impact *(new)*
- pregnancy-leave-classification *(new)*
- inheritance-rights-nonmarital-children *(new)*
- voter-id-fundamental-interest *(new)*
- food-truck-proximity-ban *(new)*
- grand-jury-incorporation *(new)*
- post-dobbs-six-week-ban *(new)*
- surrogacy-ban-substantive-due-process *(new)*
- marriage-counseling-mandate *(new)*

### Migration Summary
- **21 nodes stay** in their current region (all of executive-power, federalism, foreign-affairs)
- **18 nodes migrate** to new regions (all of administrative-state → separation-of-powers, all of democracy-justiciability → split across judicial-power + individual-rights, 6 Commerce/Spending from federalism → congressional-power)
- **59 new nodes** created
- **2 regions deleted**: `administrative-state`, `democracy-justiciability`
- **4 regions created**: `judicial-power`, `congressional-power`, `separation-of-powers`, `individual-rights`
- **3 regions preserved**: `executive-power`, `federalism`, `foreign-affairs`

### Design Decisions Required (Before Implementation)

1. **Should removal power stay in executive-power or move to separation-of-powers?**
   Current plan: stays in executive-power (matches current game). Alternative: move 5 removal scenarios to SoP (makes SoP 19 nodes, executive 12). Pedagogically, removal is taught in either unit depending on the course.

2. **Should individual-rights be one region (21) or split into equal-protection (16) + due-process (5)?**
   Current plan: combined. 5 scenarios is thin for a standalone region. EP and DP share 14th Amendment text and tiered scrutiny framework. First Amendment content would expand due-process if added later.

---

## Phase 1: campaigns.json Restructure

This is the largest single change. The entire file is rewritten.

### 1a. Replace the `regions` array

**Delete** the existing 5 regions. **Write** 7 new region objects:

```json
"regions": [
  { "id": "judicial-power", "label": "Judicial Power" },
  { "id": "congressional-power", "label": "Congressional Power" },
  { "id": "executive-power", "label": "Executive Power" },
  { "id": "separation-of-powers", "label": "Separation of Powers" },
  { "id": "federalism", "label": "Federalism" },
  { "id": "foreign-affairs", "label": "Foreign Affairs" },
  { "id": "individual-rights", "label": "Individual Rights" }
]
```

### 1b. Update all 39 existing node `regionId` values

18 nodes change regionId. 21 stay the same. All 39 existing nodes retain their `id` and `scenarioId`.

### 1c. Create 59 new node objects

Each needs: `id`, `scenarioId`, `regionId`, `x`, `y`, `requiresAll`, `requiresAny`, `requiresMinStarsInRegion`, `tags`.

### 1d. Assign x/y coordinates for all 98 nodes

The current layout uses x bands per region (executive ~8-16, admin-state ~27-35, federalism ~46-54, foreign-affairs ~65-73, democracy ~82-90) and y from 12-88.

**New layout approach**: 7 regions across a wider x range. Suggested x bands:
- judicial-power: x 5-15
- executive-power: x 18-28
- separation-of-powers: x 31-41
- congressional-power: x 44-54
- federalism: x 57-67
- foreign-affairs: x 70-80
- individual-rights: x 83-95

Y coordinates distribute nodes vertically within each region's band, spaced evenly based on prerequisite depth. Entry nodes at y ~12, capstones at y ~88.

### 1e. Rebuild the `edges` array

**35 existing intra-region edges survive unchanged.** These are edges where both endpoints land in the same new region.

**8 existing cross-region edges survive as inter-region bridges:**
- youngstown-steel-seizure → ins-v-chadha-legislative-veto (executive → separation-of-powers)
- nondelegation-intelligible-principle → removal-independent-agency-head (separation-of-powers → executive)
- nondelegation-intelligible-principle → spending-clause-coercion (separation-of-powers → congressional)
- the-medicaid-ultimatum → the-waste-disposal-directive (congressional → federalism)
- the-purchase-mandate → the-waste-disposal-directive (congressional → federalism)
- the-waste-disposal-directive → the-foreign-arms-embargo (federalism → foreign-affairs)
- the-unilateral-bombing-campaign → the-partisan-gerrymander-challenge (foreign-affairs → judicial)
- the-partisan-gerrymander-challenge → equal-protection-scrutiny-framework (judicial → individual-rights)

**New edges needed**: approximately 60-70 new edges for the 59 new scenario nodes (internal chains within each region + any new inter-region bridges).

### 1f. Rebuild the `mainPath` array

Current main path (12 nodes) threads through all 5 old regions. New main path should thread through all 7 new regions, hitting ~25-30 key scenarios.

**Proposed main path** (27 scenarios):
1. youngstown-steel-seizure (executive — entry point)
2. the-subpoenaed-tapes (executive — privilege)
3. presidential-immunity-framework (executive — immunity)
4. ins-v-chadha-legislative-veto (SoP — legislative veto)
5. nondelegation-intelligible-principle (SoP — delegation)
6. epa-carbon-major-questions (SoP — major questions)
7. mcculloch-modern-bank (congressional — N&P, easy entry)
8. spending-clause-coercion (congressional — spending)
9. the-school-zone-statute (congressional — commerce)
10. the-home-garden-prohibition (congressional — aggregation)
11. the-purchase-mandate (congressional — Sebelius capstone)
12. the-waste-disposal-directive (federalism — anti-commandeering)
13. dormant-commerce-clause-flow-control (federalism — DCC)
14. state-wine-shipping-ban (federalism — DCC facial discrimination)
15. the-foreign-arms-embargo (foreign-affairs — delegation in FA)
16. the-hostage-crisis-executive-agreement (foreign-affairs — exec agreements)
17. the-unilateral-bombing-campaign (foreign-affairs — war powers)
18. environmental-standing (judicial — standing)
19. the-partisan-gerrymander-challenge (judicial — political question)
20. president-refuses-court-order (judicial — judicial supremacy)
21. equal-protection-scrutiny-framework (rights — EP framework)
22. school-admissions-test-disparate-impact (rights — race/strict)
23. male-parental-leave-discrimination (rights — gender/intermediate)
24. food-truck-licensing-ban (rights — rational basis)
25. post-dobbs-six-week-ban (rights — SDP)
26. grand-jury-incorporation (rights — incorporation)
27. disparate-impact-intent-framework (rights — capstone)

### 1g. Update tags on nodes

- `entry` tag: first accessible node in each region (7 total)
- `mainPath` tag: all 27 main-path nodes
- `capstone` tag: culminating scenario in each region (youngstown-full-analysis, seila-law-deep-dive, the-congressional-commission, the-purchase-mandate, federal-preemption-cannabis, the-treaty-enforcement-memo, disparate-impact-intent-framework or fire-department-diversity-program)

### 1h. Set `requiresMinStarsInRegion` for capstones

Capstone nodes should require 4-6 stars earned in their region before unlocking.

---

## Phase 2: game.js Updates

### 2a. Expand `campaignOrder`

Replace the current 15-entry array with the 27-entry main path from Phase 1f. This array drives the campaign mode's scenario queue.

### 2b. PRECEDENT_METADATA (decision point)

The existing 12 precedent keys are all structural/SoP. The 21 individual-rights scenarios have no precedent system coverage.

**Option A (minimal)**: Leave PRECEDENT_METADATA unchanged for now. The rights scenarios work fine without precedent — they just don't have cross-scenario consequence. This can be added later.

**Option B (full)**: Add 4-6 new precedent keys for rights doctrine:
- `heightenedScrutinyApproach` — did the player favor strict scrutiny broadly?
- `substantiveDueProcessExpansion` — did the player extend fundamental rights?
- `strongIncorporation` — did the player incorporate aggressively?
- `rationalBasisWithBite` — did the player endorse rational basis with teeth?

Each new key requires: an entry in PRECEDENT_METADATA, `setsPrecedent` on the appropriate choices in rights scenarios, and `precedentConditions` on downstream scenarios.

**Recommendation**: Option A for initial implementation. Precedent expansion is a separate pass that doesn't block map restructure.

---

## Phase 3: achievements.json Updates

### 3a. Update existing region mastery achievements

Two achievements reference regionId directly:
- `executive-power-mastery` → stays (regionId unchanged)
- `federalism-mastery` → stays (regionId unchanged)

### 3b. Add new region mastery achievements

5 new achievements for the 5 new/renamed regions:

```json
{
  "id": "judicial-power-mastery",
  "title": "Judicial Power Mastery",
  "description": "Average at least 85% across at least 3 Judicial Power scenarios.",
  "icon": "⚖️",
  "rule": { "type": "regionMastery", "regionId": "judicial-power", "minCompleted": 3, "minAveragePercent": 85 }
},
{
  "id": "congressional-power-mastery",
  "title": "Congressional Power Mastery",
  "description": "Average at least 85% across at least 3 Congressional Power scenarios.",
  "icon": "🏛️",
  "rule": { "type": "regionMastery", "regionId": "congressional-power", "minCompleted": 3, "minAveragePercent": 85 }
},
{
  "id": "separation-of-powers-mastery",
  "title": "Separation of Powers Mastery",
  "description": "Average at least 85% across at least 3 Separation of Powers scenarios.",
  "icon": "🔀",
  "rule": { "type": "regionMastery", "regionId": "separation-of-powers", "minCompleted": 3, "minAveragePercent": 85 }
},
{
  "id": "foreign-affairs-mastery",
  "title": "Foreign Affairs Mastery",
  "description": "Average at least 85% across at least 3 Foreign Affairs scenarios.",
  "icon": "🌐",
  "rule": { "type": "regionMastery", "regionId": "foreign-affairs", "minCompleted": 3, "minAveragePercent": 85 }
},
{
  "id": "individual-rights-mastery",
  "title": "Individual Rights Mastery",
  "description": "Average at least 85% across at least 3 Individual Rights scenarios.",
  "icon": "🗽",
  "rule": { "type": "regionMastery", "regionId": "individual-rights", "minCompleted": 3, "minAveragePercent": 85 }
}
```

### 3c. Add new doctrine accuracy achievements

```json
{
  "id": "equal-protection-scholar",
  "title": "Equal Protection Scholar",
  "description": "Achieve 80%+ accuracy across 3+ Equal Protection scenarios.",
  "icon": "⚖️",
  "rule": { "type": "doctrineAccuracy", "doctrineSlugPrefix": "equal-protection", "minAttempts": 3, "minAccuracy": 80 }
},
{
  "id": "due-process-authority",
  "title": "Due Process Authority",
  "description": "Achieve 80%+ accuracy across 3+ Due Process scenarios.",
  "icon": "📜",
  "rule": { "type": "doctrineAccuracy", "doctrineSlugPrefix": "due-process", "minAttempts": 3, "minAccuracy": 80 }
},
{
  "id": "dormant-commerce-clause-expert",
  "title": "Dormant Commerce Clause Expert",
  "description": "Achieve 80%+ accuracy across 3+ Dormant Commerce Clause scenarios.",
  "icon": "🚧",
  "rule": { "type": "doctrineAccuracy", "doctrineSlugPrefix": "dormant-commerce", "minAttempts": 3, "minAccuracy": 80 }
},
{
  "id": "war-powers-strategist",
  "title": "War Powers Strategist",
  "description": "Achieve 80%+ accuracy across 3+ War Powers / Foreign Affairs scenarios.",
  "icon": "🎖️",
  "rule": { "type": "doctrineAccuracy", "doctrineSlugPrefix": "war-powers", "minAttempts": 3, "minAccuracy": 80 }
}
```

### 3d. Update milestone counts

The `complete-every-scenario` and `constitutional-generalist` achievements should naturally scale since they use dynamic counts, but verify minAttempts thresholds are reasonable for 98 scenarios.

---

## Phase 4: characters.json Updates

### 4a. Expand chief-clerk mentorNotes

Add notes covering the new doctrinal areas:

```json
"mentorNotes": [
  "Youngstown is the spine of executive power analysis: always ask what Congress has done.",
  "For anti-commandeering, separate direct federal commands from preemption.",
  "A hard commerce-clause question usually turns on the limiting principle, not just the government interest.",
  "Equal protection analysis starts with the classification, then the level of scrutiny, then the fit.",
  "Substantive due process asks whether a right is deeply rooted in history and tradition — after Dobbs, that test has real teeth.",
  "Standing requires injury-in-fact, causation, and redressability. Miss one and the case is dismissed.",
  "The dormant commerce clause is about what states cannot do, even when Congress is silent.",
  "For spending power, ask whether the condition is coercive or merely an inducement — NFIB v. Sebelius draws the line."
]
```

### 4b. Consider adding a second character (optional, deferred)

A civil-rights-focused character (e.g., "Rights Advocate" or "Constitutional Counsel") could provide mentorship in the individual-rights region. This is additive and non-blocking — defer to a later pass.

---

## Phase 5: Test File Updates

### 5a. tests/map.test.js

**Lines affected**: 83-84 (discoveredRegionIds in baseProfile)

Change:
```js
discoveredRegionIds: ['executive-power', 'administrative-state']
```
To:
```js
discoveredRegionIds: ['executive-power', 'separation-of-powers']
```

**Line 139**: Region filter test uses `'executive-power'` — this stays valid.

No other changes needed. The test uses real scenario IDs (youngstown-steel-seizure, ins-v-chadha-legislative-veto, the-frozen-accounts) which all still exist. The region filter test exercises executive-power which still exists.

### 5b. tests/achievements.test.js

**Lines 6-10**: Test campaign data defines regions. Change:
```js
regions: [
  { id: 'executive-power', label: 'Executive Power' },
  { id: 'federalism', label: 'Federalism' }
]
```
No change needed — these are abstract test fixtures, not real region IDs. The tests verify achievement logic, not region existence. Keeping `executive-power` and `federalism` as test region IDs is fine since both still exist.

**Lines 11-16**: Test nodes use `regionId: 'executive-power'` and `regionId: 'federalism'`. Same — still valid since both regions exist in the new structure.

### 5c. tests/progress.test.js

**Lines 19-21**: Test campaign data defines one region `executive-power` with test nodes alpha/beta/gamma. No change needed — `executive-power` still exists.

### 5d. tests/integration.test.js

**Lines 346-359**: progressionCampaign defines `executive-power` region with test nodes. No change needed.

### 5e. tests/data-validation.test.js

No region references at all. Tests validate scenario structure and campaignOrder existence. Will automatically pass once game.js campaignOrder is updated.

### Summary: Only map.test.js needs a one-line change.

The test files are well-designed — they use `executive-power` as an abstract test region, not the full region set. Since `executive-power` survives the restructure, all test fixtures remain valid.

---

## Phase 6: Cross-Reference & Service Worker Updates

### 6a. Run generate-cross-links.js

```bash
node scripts/generate-cross-links.js
```

This populates `cases.json` → `scenarioIds` arrays by fuzzy-matching scenario `caseReferences` strings against case names. The 59 new scenarios' case references will be linked.

**Run AFTER campaigns.json is finalized**, since the script reads scenario IDs.

### 6b. Verify sw.js cache list

The service worker caches `./data/campaigns.json`, `./data/achievements.json`, and other data files. No new data files are being added (just modifying existing ones), so no sw.js changes needed unless new asset files (icons, etc.) are added for new regions.

### 6c. Verify progress.js region handling

`progress.js` handles `discoveredRegionIds` dynamically — it reads regionId from campaign nodes at runtime. No hardcoded region IDs to update. The `getRegionStarTotal()` and `getScenarioRegionId()` functions filter by `node.regionId === regionId` which works with any region ID string.

### 6d. Verify map.js region handling

`map.js` populates the region filter dropdown from `campaigns.json.regions` dynamically. The region legend, completion tracking, and focus filtering all read from campaign data, not hardcoded strings. No changes needed.

### 6e. Verify achievements.js region handling

`achievements.js` reads `rule.regionId` from achievements.json and compares against campaign node regionIds. Fully data-driven — no changes needed.

---

## Phase 7: Validation & Verification

### 7a. Run schema validation
```bash
node scripts/validate-schemas.js
```
Must pass with zero errors.

### 7b. Run full test suite
```bash
# Run from tests/ directory or via test runner
```
All tests must pass, including the updated map.test.js.

### 7c. Visual map verification

Load the game in a browser and verify:
- All 7 regions appear in the region filter dropdown
- Nodes render in correct positions without overlap
- Edges draw correctly between connected nodes
- Cross-region edges render across region boundaries
- Region focus filtering dims out-of-region nodes correctly
- Entry nodes are accessible, capstones are gated
- Main path highlights correctly through all 7 regions

### 7d. Campaign mode smoke test

Play through the first 5-6 main path scenarios in campaign mode to verify:
- Precedent flags set correctly
- Node unlocking works across region boundaries
- Region discovery populates as new regions are entered

---

## Implementation Order

| Step | Phase | Files Changed | Estimated Effort |
|------|-------|---------------|-----------------|
| 1 | 1a-1h | `data/campaigns.json` | Heavy — full rewrite (~800 lines) |
| 2 | 2a | `game.js` | Light — replace campaignOrder array |
| 3 | 3a-3d | `data/achievements.json` | Medium — add ~9 achievement entries |
| 4 | 4a | `data/characters.json` | Light — add 5 mentorNotes strings |
| 5 | 5a | `tests/map.test.js` | Trivial — one string change |
| 6 | 6a | `data/cases.json` (via script) | Light — run script |
| 7 | 7a-7d | (verification) | Medium — run validators, visual check |

Steps 2-5 can be parallelized. Step 1 is the critical path.

---

## Risk Assessment

**Low risk**: All JS source files (progress.js, map.js, achievements.js, game.js logic) are data-driven. They read region IDs from campaigns.json at runtime. No hardcoded region ID strings in application logic need updating.

**Medium risk**: The x/y coordinate layout for 98 nodes needs careful design to avoid visual collision. If the rendering engine uses fixed viewport dimensions, 7 vertical columns of 7-21 nodes each need to fit. Manual adjustment may be needed after first render.

**Low risk**: Existing precedent system (`setsPrecedent`, `precedentConditions`) is scenario-based, not region-based. All existing precedent chains survive the restructure unchanged.

**Zero risk to scenario content**: No scenario text, steps, choices, or explanations change. This is purely a map/topology change.

---

## What Does NOT Change

- `data/scenarios.json` — zero changes
- `data/cases.json` — only scenarioIds updated by cross-link script
- `progress.js` — zero code changes (data-driven)
- `map.js` — zero code changes (data-driven)
- `achievements.js` — zero code changes (data-driven)
- `scoring.js`, `scenarios.js`, `ui.js`, `timer.js`, `analytics.js`, `dashboard.js`, `library.js`, `character.js`, `router.js` — zero changes
- `css/map.css` — zero changes (styles are class-based, not region-ID-based)
- `index.html` — zero changes
- `sw.js` — zero changes (unless new assets added)
