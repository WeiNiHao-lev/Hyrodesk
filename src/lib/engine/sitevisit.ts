/**
 * Site visit and pre-approval preparation.
 *
 * Structured the way the work actually happens: what every project needs,
 * then what the site condition adds, then what the process type adds, then what
 * you must be able to answer when you stand in front of the engineering
 * director. Every item carries its reasoning, because an engineer who knows why
 * he is asking gets a better answer than one reading from a list.
 */

export interface Ask {
  id: string;
  q: string;
  /** Why the answer is needed. */
  why: string;
  /** What a complete answer looks like — units and level of detail. */
  good?: string;
  /** An answer that should worry you, and what it usually means. */
  redFlag?: string;
  /** The design decision this unlocks. */
  unlocks?: string;
  critical?: boolean;
}

export interface AskGroup {
  id: string;
  title: string;
  intro: string;
  items: Ask[];
}

export interface Observation {
  id: string;
  what: string;
  how: string;
  why: string;
}

export interface DocRequest {
  id: string;
  doc: string;
  why: string;
  critical?: boolean;
}

export interface RegRef {
  name: string;
  governs: string;
  note: string;
  indicative?: { param: string; value: string }[];
}

export interface DirectorQ {
  q: string;
  why: string;
  how: string;
}

/* ==================================================================== UNIVERSAL */

export const UNIVERSAL: AskGroup[] = [
  {
    id: "u-commercial",
    title: "Commercial framing — establish this first",
    intro:
      "Before any technical question, understand what is actually being bought and who decides. A technically perfect study for the wrong scope is wasted work, and this is the part the marketing manager needs from you as much as you need it from them.",
    items: [
      {
        id: "u-c1", critical: true,
        q: "What contract model is envisaged — EPC, EP only, supply only, or DBO with operation?",
        why: "It changes what you are responsible for and therefore what must be designed. A DBO contract makes operating cost your problem for years, so a design with high chemical consumption becomes a liability rather than a saving.",
        good: "A named model, plus whether civil works and electrical are inside or outside.",
        redFlag: "\"We will decide later.\" Then you cannot price it, and you should say so rather than guessing.",
        unlocks: "Battery limit, and whether OPEX is a selection criterion or just information.",
      },
      {
        id: "u-c2", critical: true,
        q: "Battery limit: where does our scope start and stop?",
        why: "This single answer can move a capital estimate by a factor of two. Intake civil works, transfer pipelines, effluent outfall, buildings, electrical supply and the deaerator are each large enough to change the whole number.",
        good: "A marked-up plot plan, or at minimum a written list of what is in and what is out.",
        redFlag: "Vague agreement that it is \"the water treatment plant\" — that phrase means different things to every party in the room.",
        unlocks: "Everything in the cost estimate.",
      },
      {
        id: "u-c3",
        q: "Who is the decision maker, and what is the approval path and timeline?",
        why: "You are preparing a pre-approval study for a decision. Knowing whether it goes to a technical committee, a board, or a single owner tells you what to emphasise and how much detail is useful.",
        good: "Named roles, the sequence, and the date the decision is needed.",
      },
      {
        id: "u-c4",
        q: "Is there an incumbent supplier, a previous study, or a competing proposal?",
        why: "A previous study is free data and tells you what the client has already been told. A competing proposal tells you what you are being compared against.",
        good: "A copy of any previous feasibility study or basic design.",
      },
      {
        id: "u-c5",
        q: "What is driving the project — expansion, a compliance deadline, a failing existing plant, or a cost reduction?",
        why: "The driver decides what the client will trade away. A compliance deadline makes schedule dominant; a cost reduction makes OPEX dominant; a failing plant makes reliability dominant.",
        unlocks: "How to weight the optimiser, and what to lead with in the report.",
      },
    ],
  },
  {
    id: "u-capacity",
    title: "Capacity and demand — the number everything scales from",
    intro:
      "A single total flow is never enough. The most expensive early mistake is designing the whole flow to the strictest quality when only a fraction of it needs that quality.",
    items: [
      {
        id: "u-q1", critical: true,
        q: "Total capacity required, and in what units",
        why: "L/s, m³/h and m³/d get mixed up constantly. Confirm which, and whether it is product water or raw water intake — they are not the same number.",
        good: "\"52 L/s of product water\" — stated as product or as intake, explicitly.",
        redFlag: "A number with no unit and no indication of whether it is feed or product.",
      },
      {
        id: "u-q2", critical: true,
        q: "Breakdown of that capacity by consumer and by required quality",
        why: "Different consumers need completely different trains. Cooling tower make-up needs clarity; boiler feed needs demineralisation; potable needs disinfection. Sizing the whole plant for the strictest one is how a proposal becomes uncompetitive.",
        good: "A table: consumer, flow, required quality, governing standard.",
        redFlag: "\"All of it needs to be pure.\" Push back gently and ask what each consumer actually is.",
        unlocks: "The entire process configuration. Without it, every flow rate in the study is an assumption.",
      },
      {
        id: "u-q3",
        q: "Continuous or intermittent? Peak factors, and hours per day and days per year",
        why: "Peak flow sizes the equipment; annual hours size the consumption and operating cost.",
        good: "Operating pattern plus a peak factor, e.g. \"24/7, 8000 h/y, peak factor 1.2\".",
      },
      {
        id: "u-q4",
        q: "Future expansion — is a phase 2 planned, and should we allow for it?",
        why: "Allowing space and hydraulic capacity now is cheap; retrofitting later is not. But designing for a phase that never comes wastes the client's money.",
        good: "A stated phase 2 capacity and an approximate date, or a clear \"no expansion planned\".",
      },
      {
        id: "u-q5",
        q: "What happens if the plant stops? Is there storage, a second source, or does production stop?",
        why: "This decides redundancy. If a plant outage stops a smelter, 2 × 50 % trains and larger storage are justified. If there is a week of storage, they are not.",
        unlocks: "Redundancy philosophy and product tank sizing.",
      },
    ],
  },
  {
    id: "u-water",
    title: "Raw water — the analysis, and how much to trust it",
    intro:
      "Everything downstream inherits the quality of this data. Ask not only for the numbers but for their provenance: an analysis with no date and no sampling method is not evidence.",
    items: [
      {
        id: "u-w1", critical: true,
        q: "Source: river, lake, sea, groundwater, municipal supply, or a process stream?",
        why: "Sets the whole character of the pre-treatment and the variability you must design for.",
        good: "Named source, with a location on a map and the distance to the plant.",
      },
      {
        id: "u-w2", critical: true,
        q: "Full analysis: ions, aggregates, and the date it was taken",
        why: "Chloride, silica, TOC and turbidity are the four most commonly missing parameters, and each of them governs a different design decision.",
        good: "A laboratory report with a date, a sampling point and the method for each parameter.",
        redFlag: "An undated table in a slide deck. Ask for the original report.",
        unlocks: "Process selection, membrane projections, chemical dosing, everything.",
      },
      {
        id: "u-w3", critical: true,
        q: "Seasonal variation — is there wet-season and dry-season data?",
        why: "Clarifiers and filters are designed on peak turbidity, not the average. A plant sized on dry-season data will pass solids for several months of every year.",
        good: "At least two analyses from different seasons, or historical turbidity records.",
        redFlag: "A single sample. Say clearly in your report that the design case is unknown.",
      },
      {
        id: "u-w4",
        q: "Source reliability: low-flow records, abstraction licence, competing users",
        why: "A plant that cannot abstract water in the dry season does not work regardless of how well it is designed.",
        good: "River low-flow statistics, and the licensed abstraction volume.",
      },
      {
        id: "u-w5",
        q: "Can we take our own samples, and is there a laboratory available?",
        why: "Your own sample, taken properly, is worth more than a client table of unknown provenance. Offering to sample also signals seriousness.",
        good: "Agreement on sampling points and who pays for analysis.",
      },
    ],
  },
  {
    id: "u-site",
    title: "Site, civil and utilities",
    intro:
      "The things that are obvious on site and invisible in a specification. Walk the site with the plot plan in your hand.",
    items: [
      {
        id: "u-s1", critical: true,
        q: "Available land: dimensions, boundaries, and any restrictions",
        why: "Footprint decides lamella versus conventional clarifier, UF versus media filtration, filter press versus drying beds. A tight site changes the technology, not just the layout.",
        good: "A dimensioned plot plan with the available area marked.",
      },
      {
        id: "u-s2",
        q: "Levels: elevation of the source, the plant and the consumers",
        why: "Sets pump heads and therefore a large part of the energy consumption. Also decides whether gravity flow is possible between units.",
        good: "Spot levels, or a topographic survey.",
      },
      {
        id: "u-s3",
        q: "Geotechnical: soil bearing capacity, groundwater table, flood level",
        why: "Large tanks and basins on poor ground need piling, which can be a significant part of the civil cost. A high water table makes deep structures much more expensive.",
        redFlag: "No soil investigation at all on a site with large basins planned.",
      },
      {
        id: "u-s4", critical: true,
        q: "Power: available capacity, voltage, reliability, and tariff",
        why: "Membrane and thermal plants are power-hungry. If the site cannot supply the load, that becomes your problem. The tariff turns specific energy into money.",
        good: "Available kVA, supply voltage, and the industrial tariff in local currency per kWh.",
      },
      {
        id: "u-s5",
        q: "Other utilities: steam, compressed air, instrument air, service water, nitrogen",
        why: "If they exist you can use them; if not you must generate them and that is scope you might otherwise miss.",
      },
      {
        id: "u-s6",
        q: "Access: road width, crane access, delivery route for large equipment",
        why: "A membrane skid or a large tank that cannot reach the site is a real and embarrassing problem. Check the route, not just the site.",
      },
      {
        id: "u-s7",
        q: "Climate: rainfall, evaporation rate, ambient temperature range",
        why: "Rainfall and evaporation size sludge drying beds; temperature affects membrane flux and biological kinetics; both affect the water balance on open basins.",
      },
    ],
  },
  {
    id: "u-effluent",
    title: "Effluent, waste and discharge",
    intro:
      "The half of the balance that gets forgotten in the meeting and then dominates the permit discussion.",
    items: [
      {
        id: "u-e1", critical: true,
        q: "Where does the effluent go, and what are the permitted limits?",
        why: "Determines whether direct discharge is possible or whether further treatment, or even zero liquid discharge, is required. This can change the project entirely.",
        good: "A copy of the environmental permit with the discharge limits and the receiving water body named.",
        redFlag: "\"We will discharge to the river, it should be fine.\" Ask for the permit.",
      },
      {
        id: "u-e2",
        q: "Is zero or minimal liquid discharge a requirement, and on what basis?",
        why: "ZLD adds very large capital and energy cost. It is sometimes a genuine regulatory requirement and sometimes an assumption nobody has checked. Establish which.",
        redFlag: "ZLD stated as a requirement with no regulation or permit condition behind it. Challenge it politely — it may save the client a great deal.",
      },
      {
        id: "u-e3",
        q: "Sludge: where does it go, who takes it, and is it classified as hazardous?",
        why: "Disposal route and classification drive both cost and the dewatering technology. Aluminium-bearing or metal-bearing sludge may be regulated waste.",
        good: "Named disposal contractor or landfill, and the classification.",
      },
      {
        id: "u-e4",
        q: "Is there space and permission for drying beds, or must we use mechanical dewatering?",
        why: "Drying beds are far cheaper to build and run but need land and tolerate rain poorly. In a tropical climate this is a real trade-off.",
      },
    ],
  },
  {
    id: "u-owner",
    title: "Owner's plan, operation and expectations",
    intro:
      "The soft information that decides whether a technically sound plant actually works in service.",
    items: [
      {
        id: "u-o1",
        q: "Who will operate the plant, and what is their experience level?",
        why: "A plant requiring acid and caustic regeneration, or careful membrane management, needs competent operators. If the client has none, that argues for simpler technology or an operating contract — this is a legitimate technical input, not a judgement about the client.",
        unlocks: "EDI versus mixed bed; degree of automation; training scope.",
      },
      {
        id: "u-o2",
        q: "Chemical supply chain: what is locally available, and what has a long lead time?",
        why: "A design depending on a chemical that takes three months to import will fail in service. Local availability is a genuine selection criterion.",
      },
      {
        id: "u-o3",
        q: "Budget expectation, and how is it being judged — capital only or lifecycle?",
        why: "If the client compares on capital alone, an EDI or a UF has to be justified differently than if lifecycle cost is being evaluated.",
        redFlag: "No budget indication at all, which usually means the client does not yet know the scale of what they are asking for.",
      },
      {
        id: "u-o4",
        q: "Schedule: required completion date, and any hard constraints behind it",
        why: "Long-lead items — membranes, large pumps, evaporators — can drive the programme. A date driven by a compliance deadline is not negotiable; one driven by preference may be.",
      },
      {
        id: "u-o5",
        q: "What does the client consider a successful outcome?",
        why: "Ask it directly. The answer is often narrower than the specification and tells you what to guarantee and what to leave flexible.",
      },
    ],
  },
];

/* ============================================================== SITE CONDITION */

export interface SiteCondition {
  key: string;
  label: string;
  summary: string;
  groups: AskGroup[];
  observations: Observation[];
}

export const SITE_CONDITIONS: SiteCondition[] = [
  {
    key: "greenfield",
    label: "Greenfield — new plant on a clear site",
    summary:
      "Nothing exists yet, so everything is a design choice and everything must be specified. The risk is not what is already there but what has not been investigated.",
    groups: [
      {
        id: "g-1",
        title: "Greenfield-specific",
        intro: "With no existing asset to measure, the site investigation carries the whole burden of certainty.",
        items: [
          {
            id: "g-1a", critical: true,
            q: "Has a topographic and geotechnical survey been done? Can we see it?",
            why: "On a greenfield site there is no existing structure to tell you what the ground will carry. Foundations for large basins are a major civil cost and cannot be estimated from a walkover.",
            redFlag: "No survey, and the client expects a firm price. Say what you can price and what you cannot.",
          },
          {
            id: "g-1b",
            q: "Where exactly is the intake point, and what is the route to the plant?",
            why: "Pipeline length and terrain drive both cost and pump head. A kilometre of pipeline through difficult ground can rival the treatment plant in cost.",
            good: "A marked route on a map with approximate length and any crossings.",
          },
          {
            id: "g-1c",
            q: "Is the land already secured, and is there any permitting or community issue?",
            why: "A design for land the client does not yet own carries a risk that is not yours but will become your schedule problem.",
          },
          {
            id: "g-1d",
            q: "What is the flood level and the design return period?",
            why: "Plant levels and civil design follow from it. In a coastal or riverine site this can dictate the whole platform level.",
          },
        ],
      },
    ],
    observations: [
      { id: "go-1", what: "Walk the full site boundary", how: "With the plot plan in hand, note anything not shown on it — drainage, cables, existing structures, vegetation.", why: "Plot plans are frequently out of date. What is on the ground governs." },
      { id: "go-2", what: "Photograph the intake location from the water and from the bank", how: "Include something for scale, and note the water level against a fixed feature.", why: "The intake civil design starts from this. Levels matter more than anything else." },
      { id: "go-3", what: "Locate the discharge point and check it is feasible", how: "Walk the route from the plant to the outfall.", why: "The discharge route is often assumed and rarely walked." },
      { id: "go-4", what: "Note the nearest power connection point and its distance", how: "Photograph the substation or line, and estimate the run.", why: "Electrical supply to the plant is scope that is regularly missed at estimating stage." },
    ],
  },
  {
    key: "brownfield",
    label: "Brownfield — existing plant to extend, upgrade or replace",
    summary:
      "Something already exists, which is both an asset and a constraint. The whole value of the site visit is measuring and assessing what is there — and this is where an unprepared engineer gets caught, because the client assumes you looked.",
    groups: [
      {
        id: "b-1",
        title: "Existing asset inventory — measure it, do not accept a description",
        intro:
          "The single most common gap in a brownfield pre-approval study. If you can reuse an existing basin, the saving is large; if you assume you can and it turns out to be undersized or failing, the error is larger still. Take a tape measure.",
        items: [
          {
            id: "b-1a", critical: true,
            q: "For every existing tank, basin or pool: length, width, water depth and freeboard",
            why: "Volume is what determines whether it can be reused, and volume is what nobody records. A description like 'the big aeration pond' is not a number you can design with.",
            good: "Dimensions in metres for each structure, with a sketch and photographs, and the calculated working volume.",
            redFlag: "Being told the volume from memory. Measure it yourself, or ask for the as-built drawing.",
            unlocks: "Whether existing structures can be reused, and what the achievable retention time is.",
          },
          {
            id: "b-1b", critical: true,
            q: "What is the actual retention time in each existing unit at current flow?",
            why: "HRT is volume divided by flow. Once you have measured the volume and know the current flow you can calculate it — and immediately see whether the existing plant is undersized, which is often the reason they called you.",
            good: "Calculated HRT per unit, compared against what that process type needs.",
            unlocks: "Whether the existing plant is undersized, and by how much. This is frequently the core finding of the study.",
          },
          {
            id: "b-1c", critical: true,
            q: "Structural condition of each existing structure: cracking, leakage, corrosion, liner condition",
            why: "A structurally sound basin can be reused; a leaking one must be repaired or replaced, and that cost belongs in your estimate. Concrete condition also decides whether it can take new equipment loads.",
            good: "Photographs of each structure, notes on visible defects, and any repair history.",
            redFlag: "Visible leakage or exposed reinforcement. Flag it explicitly — it is not your scope to hide it.",
          },
          {
            id: "b-1d",
            q: "What equipment is installed, what is its age, and what still works?",
            why: "Existing pumps, blowers, mixers and dosing systems may be reusable. Equally they may be obsolete, unsupported or simply worn out. Both are important and only one is visible from a list.",
            good: "Nameplate photographs — make, model, rating, year — for every significant item.",
          },
          {
            id: "b-1e",
            q: "Are there as-built drawings, and do they match what is on the ground?",
            why: "As-builts are the fastest route to volumes and levels, but they are frequently out of date after years of modifications. Verify a few dimensions by hand against the drawing before trusting it.",
            good: "Drawing files, plus your own spot checks confirming they are current.",
          },
        ],
      },
      {
        id: "b-2",
        title: "Existing performance — what it actually achieves",
        intro:
          "The operating record tells you what the real feed is and where the plant fails, which no design calculation can give you.",
        items: [
          {
            id: "b-2a", critical: true,
            q: "Operating records: influent and effluent quality over at least the last twelve months",
            why: "This is real data on the real feed, including its variability — far better than a single design analysis. It also shows exactly when and how the plant fails.",
            good: "Monthly or daily logs of flow and key parameters, and the compliance monitoring reports.",
            unlocks: "The true design basis, including seasonal variation, at no cost.",
          },
          {
            id: "b-2b",
            q: "Which unit is the bottleneck, and what specifically fails first?",
            why: "The operators know. Asking them directly usually shortens the diagnosis by weeks, and the answer is often not what the management believes.",
            good: "A specific answer: 'the clarifier carries over whenever it rains', not 'the plant underperforms'.",
          },
          {
            id: "b-2c",
            q: "Current chemical consumption and power consumption",
            why: "Gives you the real operating cost baseline, so any improvement you propose can be quantified against something rather than asserted.",
            good: "Monthly chemical purchase records and electricity bills.",
          },
          {
            id: "b-2d",
            q: "Maintenance history: what breaks, how often, and what has been replaced",
            why: "Recurring failures point at a design fault, not a maintenance fault. It also tells you what the client has already spent money on.",
          },
          {
            id: "b-2e",
            q: "Has the plant ever been in breach of its permit? What happened?",
            why: "A compliance history explains the urgency and tells you what the regulator is watching. It may also be the real reason for the project.",
          },
        ],
      },
      {
        id: "b-3",
        title: "Tie-in and construction constraints",
        intro: "Building next to a plant that must keep running is a different problem from building on an empty field.",
        items: [
          {
            id: "b-3a", critical: true,
            q: "Can the existing plant be shut down? For how long, and when?",
            why: "If it cannot stop, everything must be built and tied in live, which changes the construction method, the sequence and the cost. This is a major and frequently missed constraint.",
            good: "A stated shutdown window, or a clear statement that continuous operation is required.",
          },
          {
            id: "b-3b",
            q: "Where are the tie-in points, and what is the condition of the existing pipework?",
            why: "Tie-ins are where brownfield projects overrun. Old pipework may not survive being cut into.",
          },
          {
            id: "b-3c",
            q: "What space is available for construction, laydown and crane positions?",
            why: "An operating plant leaves little free space. If there is nowhere to lay down equipment the construction method changes.",
          },
          {
            id: "b-3d",
            q: "Are there live services — power, gas, drainage — crossing the construction area?",
            why: "Unknown buried services are a safety issue and a schedule risk. Ask for a services drawing and treat it with suspicion.",
          },
        ],
      },
    ],
    observations: [
      { id: "bo-1", what: "Measure every basin yourself", how: "Tape measure or laser. Record length, width, water depth and freeboard. Sketch it. Photograph it with something for scale.", why: "This is the item that most often gets missed, and it is the one the director will ask about first on a brownfield project." },
      { id: "bo-2", what: "Photograph every equipment nameplate", how: "Close enough to read make, model, rating and year.", why: "Nameplates are the only reliable record of what is installed. Ten minutes on site saves weeks of correspondence." },
      { id: "bo-3", what: "Look into every tank that can safely be opened", how: "With the operator, observing site safety rules. Note sludge depth, scaling, corrosion, media condition.", why: "The inside condition determines reusability and is invisible from the walkway." },
      { id: "bo-4", what: "Photograph the control panel and any SCADA screens", how: "Capture current flows, levels and any alarms.", why: "Gives you real operating values, and shows what instrumentation actually exists." },
      { id: "bo-5", what: "Talk to the shift operator, not only the manager", how: "Ask what annoys them most about the plant.", why: "Operators know the real failure modes. This is the highest-value conversation on the whole visit." },
      { id: "bo-6", what: "Note what has been modified since construction", how: "Look for pipework that does not match the drawings, bypasses, temporary pumps.", why: "Every field modification is a symptom of a design problem someone had to solve in a hurry." },
    ],
  },
];

/* ============================================================== PROJECT TYPES */

export interface TypeGuide {
  key: string;
  label: string;
  summary: string;
  groups: AskGroup[];
  regulations: RegRef[];
}

export const TYPE_GUIDES: TypeGuide[] = [
  {
    key: "wtp-surface",
    label: "WTP — surface water for drinking or process supply",
    summary:
      "The turbidity is rarely the problem. What catches people out is the dissolved fraction, which conventional treatment does not touch, and the seasonal swing that a single sample hides.",
    groups: [
      {
        id: "w-1",
        title: "The source, over a year",
        intro:
          "A reservoir or river is not one water. It stratifies, it turns over, it floods and it dries, and a design built on one sample is a design built on one day.",
        items: [
          { id: "w-1a", critical: true, q: "Raw water analysis with the sampling date, depth and point — not just the numbers", why: "A figure without a date cannot be placed in the year. Reservoir water in the dry season and after the first rains are different waters, and the plant has to handle both.", good: "Full ion set with dates: Ca, Mg, Na, K, HCO3, Cl, SO4, NO3, SiO2, Fe, Mn, plus TDS, turbidity, pH, TOC.", redFlag: "Three parameters and no date. That is a specification, not an analysis.", unlocks: "Whether the dissolved solids need a membrane at all, and if so how much of the flow." },
          { id: "w-1b", critical: true, q: "At what raw TDS must the plant still meet its product limit?", why: "The product limit is a guarantee; the raw TDS is a variable. What sizes a membrane is the worst case you must still meet, not the average you were shown. Between a raw TDS of 350 and 450 the membrane can double.", good: "A design maximum agreed in writing, or twelve months of monthly TDS.", unlocks: "The blend fraction, and therefore most of the membrane cost." },
          { id: "w-1c", critical: true, q: "Turbidity range across the year, and the peak after heavy rain", why: "The average tells you nothing about the clarifier. A source that runs at 15 NTU and spikes to 300 needs a completely different front end from one that stays at 15.", redFlag: "A single figure offered as the design value." },
          { id: "w-1d", q: "Algae: bloom history, chlorophyll-a, taste and odour complaints", why: "A pH above about 8 in a reservoir usually means algae are stripping carbon dioxide out of the water. Algae blind filters, cause taste and odour, and are precursors for disinfection by-products. If they are present, flotation may beat sedimentation.", unlocks: "DAF versus clarifier, and whether powdered carbon dosing is needed." },
          { id: "w-1e", critical: true, q: "Iron and manganese, and the depth of the intake", why: "The bottom of a reservoir goes anoxic in the dry season and iron and manganese dissolve out of the sediment. A deep intake then draws water that a surface sample never showed. Both are regulated and both stain.", redFlag: "Neither parameter appears in the analysis at all." },
          { id: "w-1f", q: "Organic carbon: TOC or UV254", why: "Sets the coagulant demand, and with chlorination it sets the trihalomethane risk, which is a regulated parameter people discover late." },
          { id: "w-1g", q: "Is the source shared, and is there an abstraction permit or quota?", why: "Abstraction rights are a legal constraint on intake flow, and they are often lower than the physical capacity." },
        ],
      },
      {
        id: "w-2",
        title: "What the water has to become",
        intro:
          "A two-line product specification usually hides a twenty-parameter standard behind it.",
        items: [
          { id: "w-2a", critical: true, q: "Which standard applies in full, and which edition?", why: "For drinking water in Indonesia this is Permenkes; the specific edition matters because the older one is still widely quoted. The client's two or three stated parameters are a subset of it, and you are contractually held to all of it.", unlocks: "Disinfection, residual chlorine, and whether the parameters nobody mentioned are already met." },
          { id: "w-2b", critical: true, q: "Is the product for potable supply, and is there a distribution network?", why: "A potable product needs disinfection with a residual that survives to the far end of the network, contact time in a clear water tank, and stability so the water does not corrode the pipes it is sent through.", unlocks: "Clear water tank volume, which is a large item on a tight site." },
          { id: "w-2c", q: "Is the stated flow the plant output or the raw water intake?", why: "The difference is every loss in the plant. On a train with a membrane slipstream it is roughly ten percent, and quoting the wrong one either undersizes the plant or oversizes the intake." },
          { id: "w-2d", q: "Daily peaking factor, and is there storage downstream?", why: "A plant that must follow demand directly is sized on the peak hour. One with a reservoir downstream is sized on the daily average, which can be a third smaller." },
        ],
      },
      {
        id: "w-3",
        title: "Site and residuals",
        intro: "The two things most often left until after the process is fixed, and the two that most often break it.",
        items: [
          { id: "w-3a", critical: true, q: "Is the quoted land area the gross plot or the net process area?", why: "Below roughly 0.3 square metres per cubic metre per day, a conventional layout with horizontal-flow sedimentation will not fit and the answer is lamella or flotation. Whether you are at that threshold depends entirely on what the quoted area includes.", good: "A plot plan with the boundary, existing structures, access road and any easements marked.", unlocks: "Clarifier type, filter type, and whether expansion is possible at all." },
          { id: "w-3b", critical: true, q: "Where do the sludge and any membrane reject go?", why: "Coagulation sludge and membrane concentrate both have to leave the site. Returning either to the source is normally not permitted, and a discharge permit can take longer to obtain than the plant takes to build.", redFlag: "\"We will discharge it back to the reservoir.\"" },
          { id: "w-3c", q: "Power supply available, in kVA, and its reliability", why: "A membrane stage changes the electrical load materially. If the answer is a diesel generator, the operating cost calculation changes completely." },
          { id: "w-3d", q: "Available head between the intake, the plant and the delivery point", why: "Gravity is free. A plant that can be laid out to flow downhill saves a pumping stage and its whole-life cost." },
        ],
      },
    ],
    regulations: [
      { name: "Permenkes — drinking water quality", governs: "Product quality for potable supply", note: "Confirm the edition in force with the client and read the full annex rather than the two or three parameters quoted in the enquiry. The list is long and the enquiry is not." },
      { name: "PP No. 22/2021", governs: "Environmental approval and discharge of sludge supernatant or membrane concentrate", note: "The receiving water class determines the limits. Establish the class before assuming any discharge route." },
      { name: "Abstraction permit (izin pengambilan air)", governs: "How much may legally be taken from the source", note: "Often lower than the physical intake capacity, and issued by a different authority from the discharge permit." },
    ],
  },
  {
    key: "desal",
    label: "Desalination — seawater or brackish",
    summary:
      "Energy and intake dominate. The technical risk sits in the source water and the concentrate, not in the membranes.",
    groups: [
      {
        id: "d-1",
        title: "Source and intake",
        intro: "The intake is often the largest single civil item and the largest single risk.",
        items: [
          { id: "d-1a", critical: true, q: "Open intake or beach well?", why: "A beach well gives naturally filtered water with a low and stable SDI, which greatly simplifies pre-treatment. An open intake needs full pre-treatment and must deal with algal blooms.", unlocks: "Whether DAF and heavy pre-treatment are needed at all." },
          { id: "d-1b", critical: true, q: "Seawater analysis including boron, bromide and total organic carbon", why: "Boron is poorly rejected at neutral pH and often has its own limit; TOC drives biofouling, which is the dominant fouling mechanism in seawater plants.", redFlag: "A seawater analysis with only TDS and chloride." },
          { id: "d-1c", q: "Algal bloom history and red tide frequency", why: "Blooms are the classic cause of seawater plant shutdown. If they occur, DAF is not optional." },
          { id: "d-1d", q: "Seasonal temperature range of the seawater", why: "Membrane flux and permeate quality are strongly temperature dependent. Design at minimum temperature for flow and maximum for quality." },
          { id: "d-1e", q: "Tidal range, wave climate, and any sediment transport data", why: "Sets the intake civil design and the risk of sand ingress." },
        ],
      },
      {
        id: "d-2",
        title: "Product and concentrate",
        intro: "Both ends of the plant have constraints that are often only discovered late.",
        items: [
          { id: "d-2a", critical: true, q: "Product specification — TDS, boron, chloride, and is it for potable use?", why: "A potable product brings boron and bromate limits and remineralisation requirements that a process water product does not." },
          { id: "d-2b", q: "Is remineralisation required?", why: "RO permeate is aggressive and unstable. For potable supply it must be remineralised, which is extra equipment and chemical." },
          { id: "d-2c", critical: true, q: "Where does the concentrate go, and are there dispersion or dilution requirements?", why: "Concentrate discharge is the main environmental issue in a desalination project. Some permits require modelling of the discharge plume." },
          { id: "d-2d", q: "Is energy recovery expected, and what is the power tariff?", why: "On seawater, energy recovery typically halves specific energy consumption. Whether it pays back depends on the tariff, which is why you need the number." },
        ],
      },
    ],
    regulations: [
      { name: "Environmental permit (Persetujuan Lingkungan) under PP No. 22/2021", governs: "Environmental approval, including brine discharge conditions", note: "Confirm the current instrument and the specific conditions attached to this site — the framework regulation changed in 2021 and older references are often quoted." },
      { name: "Permenkes drinking water quality regulation", governs: "Product quality where the water enters a potable supply", note: "Confirm the edition in force with the client; the drinking water regulation has been revised and the older 492/2010 is still widely cited." },
    ],
  },
  {
    key: "demin",
    label: "Demineralisation — boiler feed and process water",
    summary:
      "The specification comes from the boiler, not from the water. Get the boiler data first and the rest follows.",
    groups: [
      {
        id: "dm-1",
        title: "The consumer defines the specification",
        intro: "Almost every demineralisation error traces back to not asking the boiler people.",
        items: [
          { id: "dm-1a", critical: true, q: "Boiler rated steam pressure and type", why: "Below 3.8 MPa, GB/T 1576 applies. At or above it, GB/T 12145 governs and the specification is far stricter, with continuous on-line instrumentation becoming mandatory. Getting this wrong invalidates the whole study.", unlocks: "Which standard applies, and therefore the entire product specification." },
          { id: "dm-1b", critical: true, q: "Condensate return rate", why: "High condensate return sharply reduces the demineralised make-up demand — and therefore the size of the RO train, which is the most expensive part of the plant.", good: "A percentage, and whether the returned condensate is contaminated." },
          { id: "dm-1c", critical: true, q: "Is the deaerator and boiler feed water conditioning in our scope or the boiler island's?", why: "Neither RO nor EDI removes dissolved oxygen, and ion exchange product is pH neutral. Those two parameters are met by the deaerator and conditioning dosing. If the client believes the water treatment plant delivers a fully compliant boiler feed water, that is a scope gap that will surface at commissioning.", redFlag: "Assumption on either side that it is the other party's scope. Get it in writing." },
          { id: "dm-1d", q: "Silica and TOC limits, and how they will be monitored", why: "Silica governs ion exchange run length and is the first parameter to break through a mixed bed. TOC governs EDI fouling." },
          { id: "dm-1e", q: "Is there an existing demineralisation plant, and why is it being replaced?", why: "The failure mode of the existing plant is the most valuable piece of design information available." },
        ],
      },
      {
        id: "dm-2",
        title: "Feed water characteristics that decide the train",
        intro: "Three numbers between them decide the whole configuration.",
        items: [
          { id: "dm-2a", critical: true, q: "Total hardness, and calcium and magnesium separately", why: "Hardness decides whether a single RO pass can feed an EDI. Above roughly 1 mg/L as CaCO₃ in the permeate, EDI is at risk, and that usually means a second pass or a softener.", unlocks: "Single-pass versus two-pass RO — a significant cost and energy decision." },
          { id: "dm-2b", critical: true, q: "Alkalinity, and hardness relative to it", why: "Where hardness greatly exceeds alkalinity, most of it is non-carbonate and lime softening cannot remove it. This rules out an entire family of processes in one calculation." },
          { id: "dm-2c", q: "Silica, and whether it has ever been measured", why: "Silica is frequently missing or implausible in an analysis and governs both RO recovery and ion exchange run length." },
        ],
      },
    ],
    regulations: [
      { name: "GB/T 1576-2018 — Water quality for industrial boilers", governs: "Feed water, boiler water and make-up for boilers below 3.8 MPa", note: "Applies only below 3.8 MPa. Confirm the boiler pressure before assuming it governs.",
        indicative: [
          { param: "Hardness (desalted make-up, 2.5–3.8 MPa)", value: "≤ 0.005 mmol/L" },
          { param: "Conductivity", value: "≤ 80 µS/cm" },
          { param: "Dissolved oxygen", value: "≤ 0.050 mg/L (met by deaerator)" },
        ] },
      { name: "GB/T 12145 — Water and steam for power plants", governs: "Boilers at or above 3.8 MPa", note: "Substantially stricter than GB/T 1576, particularly for silica, iron, copper and TOC." },
    ],
  },
  {
    key: "wwtp-municipal",
    label: "Municipal wastewater",
    summary:
      "Load, not flow, sizes a biological plant — and the ratios between the loads decide whether nutrient removal will work at all.",
    groups: [
      {
        id: "wm-1",
        title: "Load and its variability",
        intro: "Ask for loads in kg/d, not only concentrations. A concentration without a flow is not a load.",
        items: [
          { id: "wm-1a", critical: true, q: "Population equivalent served, current and design", why: "The fundamental sizing basis for a municipal plant, and the number the client is most likely to have." },
          { id: "wm-1b", critical: true, q: "Influent BOD, COD, TSS, TN, TP and ammonia — average and peak", why: "Biological reactors are sized on load. Peak load, not average, determines whether the effluent stays compliant on the worst day." },
          { id: "wm-1c", critical: true, q: "BOD:TN and BOD:TP ratios", why: "Below about 4:1 BOD to TN there is not enough carbon to drive denitrification and external carbon must be purchased — a recurring cost that appears nowhere on a process diagram. Below about 20:1 BOD to TP, biological phosphorus removal will not work and chemical dosing is needed.", unlocks: "Whether the nutrient limits can be met biologically at all." },
          { id: "wm-1d", q: "Diurnal and seasonal flow pattern, and infiltration during rainfall", why: "Sets equalisation requirements and the hydraulic design case. Combined sewers can multiply the flow several times in a storm." },
          { id: "wm-1e", q: "Any industrial discharges into the sewer, and are they controlled?", why: "An uncontrolled industrial discharge can kill a biological plant. This is a common cause of municipal plant failure." },
          { id: "wm-1f", q: "Minimum wastewater temperature in the coldest month", why: "Nitrifiers grow slowly and much more slowly when cold. Sludge age must be designed on the minimum temperature, not the average." },
        ],
      },
      {
        id: "wm-2",
        title: "Effluent and sludge",
        intro: "",
        items: [
          { id: "wm-2a", critical: true, q: "Effluent standard, receiving water, and whether reuse is intended", why: "Reuse imposes a far stricter standard than discharge and usually adds filtration and disinfection, sometimes membranes." },
          { id: "wm-2b", q: "Sludge disposal route and whether stabilisation is required", why: "Decides whether digestion, lime stabilisation or simply dewatering is needed. Disposal route often constrains the technology." },
        ],
      },
    ],
    regulations: [
      { name: "PermenLHK on domestic wastewater effluent standards", governs: "Discharge from domestic and municipal wastewater treatment", note: "Confirm the current instrument and edition with the client's environmental permit — Indonesian effluent regulations have been reorganised under PP No. 22/2021 and citations vary.",
        indicative: [{ param: "Typical municipal limits", value: "BOD, COD, TSS, ammonia, oil and pH — obtain the actual permit rather than assuming" }] },
    ],
  },
  {
    key: "wwtp-industrial",
    label: "Industrial wastewater and leachate",
    summary:
      "The hazard is what is not in the standard analysis. Toxicity, biodegradability and variability matter more than the headline COD.",
    groups: [
      {
        id: "wi-1",
        title: "Characterisation — go beyond COD and BOD",
        intro:
          "An industrial wastewater is defined by its awkward components, not its bulk parameters. This is where a pre-approval study is most often wrong.",
        items: [
          { id: "wi-1a", critical: true, q: "What process generates the wastewater, and what goes into it?", why: "Understanding the source tells you what to look for. You cannot analyse for a compound you have not thought of.", good: "A process description and a list of chemicals used on site." },
          { id: "wi-1b", critical: true, q: "BOD:COD ratio", why: "It measures biodegradability. Below about 0.3 the wastewater is largely non-biodegradable and biological treatment alone will not meet the limit — you need advanced oxidation, adsorption or membranes.", unlocks: "Whether a biological process is viable at all." },
          { id: "wi-1c", critical: true, q: "Heavy metals, cyanide, phenol, sulphide, and any inhibitory compounds", why: "These kill biological treatment and often carry their own discharge limits. They must be removed before the biology, not after." },
          { id: "wi-1d", q: "Ammonia and total nitrogen, especially for leachate", why: "Leachate ammonia can reach several thousand mg/L, which is toxic to nitrifiers. Stripping or a physicochemical step is usually needed before biology." },
          { id: "wi-1e", critical: true, q: "Variability — how much does the composition change, and over what period?", why: "An industrial wastewater that swings by an order of magnitude needs equalisation and a robust process. Design on the worst case, not the average sample." },
          { id: "wi-1f", q: "For leachate specifically: age of the landfill and whether it is still receiving waste", why: "Young leachate is high in BOD and readily biodegradable; old leachate is high in ammonia and refractory COD. They need completely different processes, and the site will change from one to the other over its life.", unlocks: "Whether to design for the leachate you sampled or the leachate it will become." },
          { id: "wi-1g", q: "Is there a toxicity test result, or can one be arranged?", why: "A respirometry or bioassay result tells you directly whether the biology will survive. It is inexpensive relative to designing a plant that then fails." },
        ],
      },
      {
        id: "wi-2",
        title: "Treatability and pilot testing",
        intro: "For a difficult wastewater, a bench or pilot test is not a luxury — it is the only honest basis for a guarantee.",
        items: [
          { id: "wi-2a", q: "Can we obtain a representative sample for laboratory testing?", why: "A treatability test converts assumptions into data. CCEPC has its own accredited laboratory and pilot facilities, which is a genuine differentiator worth offering." },
          { id: "wi-2b", q: "Is the client willing to fund or host a pilot trial?", why: "For refractory or highly variable wastewater, a pilot is the difference between a defensible guarantee and a hopeful one." },
          { id: "wi-2c", q: "Are there existing treatability studies or previous vendor trials?", why: "Someone has often tried before. Their results, including their failures, are valuable." },
        ],
      },
    ],
    regulations: [
      { name: "PermenLHK P.59/2016 — Baku Mutu Lindi (leachate standard)", governs: "Leachate discharge from final waste processing sites (TPA)", note: "This is the instrument specifically covering landfill leachate. Verify the edition currently in force and, more importantly, obtain the limits written into this site's own environmental permit — permit conditions can be stricter than the national standard.",
        indicative: [
          { param: "pH", value: "6 – 9" },
          { param: "BOD", value: "typically ~150 mg/L" },
          { param: "COD", value: "typically ~300 mg/L" },
          { param: "TSS", value: "typically ~100 mg/L" },
          { param: "Total nitrogen", value: "typically ~60 mg/L" },
          { param: "Mercury, cadmium", value: "trace limits apply" },
        ] },
      { name: "PP No. 22/2021 — environmental protection and management", governs: "The framework instrument for environmental approval and effluent standards", note: "Reorganised much of the earlier regulation. Always work from the site's actual permit rather than a general citation." },
      { name: "Sector-specific PermenLHK effluent standards", governs: "Industry-specific discharge limits, by sector", note: "Which one applies depends on the industry. Ask the client which standard their permit cites." },
    ],
  },
  {
    key: "reuse-zld",
    label: "Reuse, MLD and ZLD",
    summary:
      "The driver is usually regulatory or water-scarcity, and the cost is dominated by the last few percent of recovery. Establish whether the target is real.",
    groups: [
      {
        id: "rz-1",
        title: "Establish the actual requirement",
        intro: "The most valuable thing you can do here is find out whether zero discharge is genuinely required.",
        items: [
          { id: "rz-1a", critical: true, q: "Is zero discharge a regulatory requirement, a corporate target, or an assumption?", why: "ZLD adds very large capital and energy cost. If it is an assumption nobody has tested, challenging it politely may save the client an enormous sum — and demonstrates more competence than quietly pricing it.", redFlag: "Nobody can point to the regulation or permit condition requiring it." },
          { id: "rz-1b", critical: true, q: "What recovery is actually required, and what happens to the residue?", why: "The cost curve rises steeply above about 95 % recovery. Minimal liquid discharge at 95 % is often a fraction of the cost of true zero at 99 %, and may satisfy the requirement." },
          { id: "rz-1c", q: "Is the recovered salt a product or a waste?", why: "If it is a saleable product, salt purity matters and the process must separate the salts. If it is waste, disposal route and classification matter instead." },
          { id: "rz-1d", q: "Is there a use for the recovered water, and what quality does it need?", why: "Recovered water with no consumer is not a benefit. Match the quality to a real user." },
          { id: "rz-1e", q: "What is the power tariff and is waste heat available?", why: "Evaporation dominates ZLD energy. Available waste heat can transform the economics; without it, MVR power cost dominates the operating cost." },
        ],
      },
    ],
    regulations: [
      { name: "PP No. 22/2021 and the site's environmental permit", governs: "Whether discharge is permitted at all, and under what conditions", note: "The permit, not the general regulation, is what determines whether ZLD is required. Ask to see it." },
    ],
  },
];

/* ============================================================== DOCUMENTS */

export const DOCUMENTS: DocRequest[] = [
  { id: "doc-1", doc: "Full raw water or influent laboratory analysis, with dates and sampling points", why: "The design basis. Without provenance it is not evidence.", critical: true },
  { id: "doc-2", doc: "Historical operating data — at least twelve months of flow and quality", why: "Real variability, free of charge. Better than any single design analysis.", critical: true },
  { id: "doc-3", doc: "Environmental permit, with discharge limits and the receiving water body", why: "Determines the effluent target, and whether ZLD is genuinely required.", critical: true },
  { id: "doc-4", doc: "Plot plan with available area marked, and a topographic survey if available", why: "Footprint decides technology, not just layout.", critical: true },
  { id: "doc-5", doc: "As-built drawings of any existing plant — process, civil and P&ID", why: "The fastest route to volumes and levels on a brownfield site. Verify against reality." },
  { id: "doc-6", doc: "Equipment list of the existing plant, with make, model, rating and year", why: "Determines what can be reused and what must be replaced." },
  { id: "doc-7", doc: "Geotechnical report", why: "Foundations for large basins are a major civil cost that cannot be estimated from a walkover." },
  { id: "doc-8", doc: "Electrical single line diagram and available supply capacity", why: "Membrane and thermal plants are power-hungry. Confirm the site can supply the load." },
  { id: "doc-9", doc: "Water balance of the client's own process, if one exists", why: "Gives the demand breakdown by consumer and quality — the single most valuable document you can obtain.", critical: true },
  { id: "doc-10", doc: "Any previous feasibility study, basic design or vendor proposal", why: "Free data, and it shows what the client has already been told." },
  { id: "doc-11", doc: "Chemical and power consumption records for the existing plant", why: "The operating cost baseline against which any improvement is measured." },
  { id: "doc-12", doc: "Compliance monitoring reports and any notices of breach", why: "Explains the urgency and shows what the regulator is watching." },
];

/* ============================================================== DIRECTOR PREP */

export const DIRECTOR_PREP: DirectorQ[] = [
  {
    q: "What is the design basis, and which parts of it are assumptions rather than client data?",
    why: "This is the first question a competent reviewer asks, because everything else depends on it. Answering it clearly establishes that you know the difference between what you were told and what you assumed.",
    how: "Bring a single slide separating confirmed data from assumptions, each assumption with its source and its impact if wrong. Never present an assumption as a fact.",
  },
  {
    q: "Is the water quality data reliable? When was it taken, and does it balance?",
    why: "An analysis that fails its ionic balance is not internally valid. If you have not checked, you cannot answer, and the credibility of the whole study drops.",
    how: "Run the feed through the Advisor before the meeting and bring the findings. Being the one who spotted the defect is far stronger than being the one who missed it.",
  },
  {
    q: "Why this process and not the alternatives?",
    why: "Selection without stated alternatives looks like defaulting rather than deciding. The director is testing whether you considered and rejected options for reasons.",
    how: "For each major unit, be ready with one sentence on what else was considered and the specific reason it was rejected — ideally a number, such as non-carbonate hardness ruling out lime softening.",
  },
  {
    q: "What is the recovery, and where does the rest of the water go?",
    why: "It tests whether your balance actually closes. A recovery figure without a matching effluent breakdown usually means a stream was left unaccounted for.",
    how: "Bring the water balance with every stream terminating somewhere, and the closure error shown as zero.",
  },
  {
    q: "What are the risks, and which of them could change the answer?",
    why: "A study with no stated risks reads as naive. The director needs to know what could invalidate the recommendation before committing to it.",
    how: "A short risk register: the risk, the consequence, and what would close it. Rank by impact, not by how easy they are to describe.",
  },
  {
    q: "What did you see on site that is not in the documents?",
    why: "This is why you went. If the answer is nothing, the visit added no value and the question exposes that immediately.",
    how: "Photographs with your own measurements and observations, especially anything that contradicts the drawings.",
  },
  {
    q: "Is this feasible, and what would it take to be sure?",
    why: "The purpose of a pre-approval study is a decision, and the director needs a recommendation, not a data dump.",
    how: "State a verdict — feasible, conditional or not feasible — then list precisely what must be closed to move from conditional to firm.",
  },
  {
    q: "What have we done like this before?",
    why: "Reference projects reduce perceived risk and are usually the strongest argument available. CCEPC has substantial delivered experience and it should be used.",
    how: "Name the closest comparable projects with capacity and process, and say specifically how this one is similar and how it differs.",
  },
];

export const PRESENTATION_STRUCTURE = [
  { step: "The ask", detail: "One sentence: what decision you need from the meeting. Say it first, not last." },
  { step: "Client requirement", detail: "Capacity, quality, standard, schedule. Confirmed data only, clearly marked as such." },
  { step: "What we found on site", detail: "Photographs and your own measurements. Anything that contradicts the documents belongs here." },
  { step: "Design basis and assumptions", detail: "Split confirmed from assumed, with the impact of each assumption if it proves wrong." },
  { step: "Proposed process, and why", detail: "The train, with the alternatives considered and the specific reason each was rejected." },
  { step: "Balance and performance", detail: "Water balance, recovery, energy, chemicals. Closure error shown." },
  { step: "Risks and open items", detail: "What could change the answer, and what would close each one." },
  { step: "Verdict and recommendation", detail: "Feasible, conditional or not feasible — with the conditions stated explicitly." },
  { step: "What we need next", detail: "The specific data or decision required to move forward, with who owns each item." },
];

export const BRING_LIST = [
  { item: "Tape measure or laser distance meter", why: "The single most useful tool on a brownfield site. Basin volumes are what everyone forgets." },
  { item: "Camera or phone with plenty of storage", why: "Photograph everything, especially nameplates and anything that contradicts a drawing." },
  { item: "Printed plot plan and any as-built drawings", why: "Mark them up on site. A drawing corrected in the field is worth more than a clean one." },
  { item: "Sample bottles and a cool box", why: "Your own sample, taken properly, beats a table of unknown provenance. Agree sampling points first." },
  { item: "pH meter and conductivity meter, if available", why: "Two measurements taken on the spot immediately test whether the analysis you were given is credible." },
  { item: "This checklist, printed or on a tablet", why: "So you leave with the answers rather than remembering the questions afterwards." },
  { item: "PPE — boots, hi-vis, helmet, gloves, eye protection", why: "You will not be allowed onto an operating plant without it, and the visit ends before it starts." },
  { item: "Notebook — paper, not only a phone", why: "Sketches of basin layouts and dimensions are faster on paper and survive a flat battery." },
];
