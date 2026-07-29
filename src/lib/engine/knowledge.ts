/**
 * Engineering knowledge base.
 *
 * Every entry answers the questions an engineer actually asks when he meets a
 * unit operation for the first time: what is physically happening, when should
 * I pick it, when should I refuse it, what numbers are normal and WHY, and what
 * goes wrong in service. The "why" matters more than the number — a rule of
 * thumb you cannot justify is a rule you cannot defend in a design review.
 */

export interface DesignRule {
  rule: string;
  why: string;
}

export interface KeyNumber {
  param: string;
  typical: string;
  why: string;
}

export interface FailureMode {
  mode: string;
  symptom: string;
  prevention: string;
}

export interface UnitKnowledge {
  /** One paragraph on the physics. */
  principle: string;
  /** Positive selection criteria. */
  whenToUse: string[];
  /** Anti-patterns. This is where most of the learning is. */
  whenNotToUse: string[];
  designRules: DesignRule[];
  keyNumbers: KeyNumber[];
  failureModes: FailureMode[];
  /** What normally sits immediately upstream, and why. */
  upstream?: string;
  /** What normally sits immediately downstream. */
  downstream?: string;
  /** CCEPC deployment experience. */
  ccepcNote?: string;
}

export const KNOWLEDGE: Record<string, UnitKnowledge> = {
  /* ============================================================ INTAKE */
  intake: {
    principle:
      "Water is drawn from the source through a coarse bar screen that stops debris, fish and floating material, then lifted by pumps to the treatment plant. Nothing dissolved is removed — only what a bar can physically stop.",
    whenToUse: [
      "Every surface water plant: river, lake, canal or seawater.",
      "Where the source is open to the environment and can carry debris.",
    ],
    whenNotToUse: [
      "Groundwater or a municipal supply already under pressure — you only need a metering and booster set.",
      "As a substitute for real solids removal. A bar screen stops branches, not turbidity.",
    ],
    designRules: [
      {
        rule: "Size the intake for the design flow plus at least 10 %, and check it against the dry-season low water level, not the average.",
        why: "An intake that cannot draw water in September is useless no matter how well the rest of the plant performs. Low water level, not average flow, is the binding constraint.",
      },
      {
        rule: "On seawater, provide continuous electrochlorination at the intake.",
        why: "Marine growth — mussels, barnacles, biofilm — will colonise the intake pipe within weeks and progressively strangle it. Dosing at the intake, not at the plant, is what protects the pipeline itself.",
      },
      {
        rule: "Take the water balance figure, not the product figure, when sizing.",
        why: "The intake must carry product plus every backwash, reject and sludge stream. On a membrane plant that is typically 10 to 40 % more than the product flow.",
      },
    ],
    keyNumbers: [
      { param: "Pump head", typical: "20–40 m", why: "Static lift plus friction to the raw water pond. Long transfer lines push this well above 40 m." },
      { param: "Pump efficiency", typical: "0.65–0.78", why: "Large centrifugal pumps sit at the top of this band; small ones at the bottom. It feeds straight into the energy figure." },
      { param: "Chlorine dose", typical: "1–3 mg/L as Cl₂", why: "Enough to hold a residual through the transfer line without overloading downstream carbon or dechlorination." },
    ],
    failureModes: [
      { mode: "Intake blockage", symptom: "Falling flow, rising pump suction vacuum", prevention: "Adequate screen area, automatic raking, and a design velocity below 0.15 m/s at the screen face." },
      { mode: "Marine fouling", symptom: "Progressive capacity loss over months", prevention: "Continuous electrochlorination plus provision to pig or chemically clean the line." },
    ],
    downstream: "A raw water pond or equalisation tank, so that intake interruptions and turbidity spikes do not propagate straight into the plant.",
    ccepcNote: "CCEPC uses electrochlorination as standard on seawater intakes, including the Gresik salt plant.",
  },

  /* ============================================================ TANKS */
  rawtank: {
    principle:
      "A large open or lined basin that holds raw water. It does three things at once: buffers interruptions in abstraction, damps swings in raw water quality, and lets the coarsest silt settle out by gravity before it ever reaches the treatment train.",
    whenToUse: [
      "Any surface water source where turbidity varies with rainfall.",
      "Where the intake and the plant can fail independently and you want the plant to keep running through a short intake outage.",
      "Where a wet-season turbidity spike would otherwise overwhelm the clarifier.",
    ],
    whenNotToUse: [
      "Where land is severely constrained and the source is stable — a smaller equalisation tank may be enough.",
      "As a substitute for clarification. Plain settling removes grit, not colloids.",
    ],
    designRules: [
      {
        rule: "Retention of 8 to 24 hours for a river source.",
        why: "Long enough for grit to settle and for the plant to survive a short intake stoppage; beyond about a day you start growing algae and paying for civil works you do not need.",
      },
      {
        rule: "Provide a desilting facility, and count the desilting water as a loss in the balance.",
        why: "Silt accumulates. If you do not plan for its removal you lose working volume year by year, and if you do not count the water you overstate recovery.",
      },
    ],
    keyNumbers: [
      { param: "Retention (HRT)", typical: "8–24 h", why: "Volume = flow × HRT. This single number sets both the civil cost and the security of supply." },
      { param: "Plain settling of TSS", typical: "10–30 %", why: "Only the coarse fraction settles without coagulant. Claiming more than 30 % without chemistry is optimistic." },
    ],
    failureModes: [
      { mode: "Algal growth", symptom: "Green water, rising pH in daylight, filter blinding", prevention: "Pre-chlorination, covering, or shorter retention." },
      { mode: "Short-circuiting", symptom: "Actual retention far below design", prevention: "Inlet and outlet at opposite ends, with a baffle wall." },
    ],
  },

  eqtank: {
    principle:
      "An equalisation tank absorbs variation. Wastewater arrives in surges — shift changes, rainfall, batch discharges — and biology hates surges. The tank converts a varying flow and load into a steady one.",
    whenToUse: [
      "Ahead of any biological process on an industrial wastewater.",
      "Where flow varies by more than roughly ±30 % through the day.",
      "Where a slug of toxic or high-strength discharge could shock the biology.",
    ],
    whenNotToUse: [
      "On a steady, continuous feed where it adds cost without smoothing anything.",
    ],
    designRules: [
      {
        rule: "Size on the diurnal variation, not on an arbitrary retention time.",
        why: "The real requirement is to absorb the peak. Plot the hourly inflow against the average and size for the largest cumulative deviation.",
      },
      {
        rule: "Mix it, and consider aerating it.",
        why: "An unmixed equalisation tank stratifies and becomes a settling tank, which defeats the purpose and creates septic sludge.",
      },
    ],
    keyNumbers: [
      { param: "Retention (HRT)", typical: "6–12 h industrial, 4–8 h municipal", why: "Enough to flatten a shift pattern without going septic." },
    ],
    failureModes: [
      { mode: "Going septic", symptom: "Odour, black water, sulphide", prevention: "Mixing plus aeration, and keeping retention below about 12 h." },
    ],
    downstream: "Biological treatment, which is the whole reason the tank exists.",
  },

  producttank: {
    principle:
      "Storage between the plant and the consumer. It decouples the two, so a short plant outage does not become a process outage.",
    whenToUse: ["On every product stream where an interruption would stop production downstream."],
    whenNotToUse: ["Where the consumer has its own large storage and you would just be duplicating it."],
    designRules: [
      {
        rule: "Size demineralised water storage on how long it takes to repair the most likely failure.",
        why: "Storage is what buys you repair time. With a single RO train, 8 hours is thin; with 2 × 50 % trains you already have partial capacity and can hold less.",
      },
    ],
    keyNumbers: [
      { param: "Retention (HRT)", typical: "4–12 h", why: "Balances repair time against the cost of a large stainless or lined tank." },
    ],
    failureModes: [
      { mode: "Recontamination", symptom: "Rising conductivity or bacterial count in stored demin water", prevention: "Nitrogen blanket or CO₂-absorbing vent filter; recirculation loop rather than dead storage." },
    ],
  },

  /* ============================================================ PRETREATMENT */
  coagfloc: {
    principle:
      "Colloids in water carry a negative surface charge and repel each other, which is why they never settle. A coagulant — usually an aluminium or iron salt — neutralises that charge so particles can approach. Gentle stirring then lets them collide and grow into flocs large enough to settle or be filtered. Fast mixing disperses the coagulant; slow mixing grows the floc. Getting those two backwards is the most common mistake.",
    whenToUse: [
      "Any surface water with turbidity above roughly 5 NTU.",
      "Ahead of clarification, flotation or direct filtration.",
      "Where colour or dissolved organics must be removed before membranes.",
    ],
    whenNotToUse: [
      "On a clean groundwater with no colloidal load — you would only be adding chemicals and sludge.",
      "Immediately upstream of RO without intermediate solids removal. Carry-over coagulant fouls membranes badly.",
    ],
    designRules: [
      {
        rule: "Rapid mix 1 to 2 minutes at high energy, then flocculation 15 to 30 minutes at low, tapering energy.",
        why: "Charge neutralisation happens in seconds and needs violent mixing to distribute the dose. Floc growth needs many gentle collisions; too much shear tears the floc apart again.",
      },
      {
        rule: "Always check alkalinity before choosing the dose.",
        why: "Aluminium coagulants consume roughly 0.5 mg/L of alkalinity as CaCO₃ per mg/L of product. On a low-alkalinity water the pH crashes, coagulation stops working, and you must dose caustic to hold it. This is a real operating cost, not a footnote.",
      },
      {
        rule: "Optimum pH for alum and PAC is about 6.5 to 7.5.",
        why: "Outside that window aluminium hydroxide does not precipitate properly and residual dissolved aluminium passes forward — where it will foul a membrane.",
      },
      {
        rule: "Confirm the dose by jar test, always.",
        why: "Coagulant demand depends on the specific colloid chemistry of that water. No correlation predicts it reliably; 30 mg/L is a starting point, not an answer.",
      },
    ],
    keyNumbers: [
      { param: "PAC dose", typical: "10–50 mg/L", why: "Rises with turbidity and organic load. Above 60 mg/L, question whether the raw water is what you were told." },
      { param: "Polymer dose", typical: "0.2–1.0 mg/L", why: "A bridging aid, not a coagulant. Overdosing polymer blinds filters." },
      { param: "Rapid mix G value", typical: "600–1000 s⁻¹", why: "Velocity gradient. High enough to disperse in seconds." },
      { param: "Flocculation G value", typical: "20–70 s⁻¹, tapering", why: "Enough collisions to grow floc, gentle enough not to shear it." },
    ],
    failureModes: [
      { mode: "pH crash", symptom: "Falling pH, poor floc, high residual aluminium", prevention: "Caustic dosing, sized on alkalinity consumption not guesswork." },
      { mode: "Overdosing", symptom: "Charge reversal, restabilised colloids, worse turbidity than no dose at all", prevention: "Jar testing across a dose range, including above the expected optimum." },
      { mode: "Floc shear", symptom: "Fine pin floc carrying over the clarifier", prevention: "Taper the flocculation energy; check for a pump between flocculation and clarification." },
    ],
    downstream: "Clarification or flotation. Coagulation without a solids separation step immediately afterwards achieves nothing.",
  },

  clarifier: {
    principle:
      "Gravity separation. A floc settles at a velocity set by its size and density; if the upward water velocity is lower than that settling velocity, the floc reaches the bottom. Inclined plates multiply the effective settling area within the same footprint — the particle only has to fall a few centimetres to the plate below instead of metres to the floor, so a lamella clarifier does the work of a basin many times its plan area.",
    whenToUse: [
      "After coagulation and flocculation on any water with meaningful turbidity.",
      "Where the solids are dense enough to settle — mineral turbidity, chemical precipitate, biological sludge.",
      "Where footprint is constrained: choose lamella over a conventional circular basin.",
    ],
    whenNotToUse: [
      "On light, buoyant or oily solids — use dissolved air flotation instead. Algae in particular float rather than settle.",
      "Without upstream coagulation, unless the solids are already coarse grit.",
    ],
    designRules: [
      {
        rule: "Surface loading rate governs performance, not retention time.",
        why: "Settling is a race between the particle falling and the water rising. Only the upward velocity — flow divided by area — decides whether the particle is captured. A deeper tank at the same area does not settle better.",
      },
      {
        rule: "Design for the wet-season turbidity peak, not the average.",
        why: "A clarifier sized on 15 NTU will pass solids at 150 NTU, and everything downstream — filters, membranes — pays for it. Peak turbidity is the design case.",
      },
      {
        rule: "Count the sludge blowdown in the water balance.",
        why: "It is typically 1 to 3 % of feed. On a plant chasing 90 % recovery that is a material number, and thickening it to recover the supernatant is usually the cheapest recovery lever available.",
      },
    ],
    keyNumbers: [
      { param: "Rise rate, lamella", typical: "4–9 m³/m²·h", why: "The plate area does the work. Beyond about 9 the floc no longer reaches a plate before it exits." },
      { param: "Rise rate, conventional", typical: "1–2.5 m³/m²·h", why: "No plates, so the particle must fall the full depth." },
      { param: "TSS removal", typical: "85–95 %", why: "With good coagulation. Below 80 % suspect the chemistry, not the clarifier." },
      { param: "Sludge blowdown", typical: "1–3 % of feed", why: "Rises with raw water solids. Very high turbidity can push it past 5 %." },
    ],
    failureModes: [
      { mode: "Floc carryover", symptom: "Rising outlet turbidity, filters blinding fast", prevention: "Check coagulation first — carryover is usually a chemistry problem, not a hydraulic one." },
      { mode: "Plate fouling", symptom: "Falling capacity, sludge on the plates", prevention: "Adequate plate spacing and slope (55–60°), and regular sludge withdrawal." },
      { mode: "Short-circuiting", symptom: "Performance far below design", prevention: "Even inlet distribution and a properly designed feed well." },
    ],
    upstream: "Coagulation and flocculation.",
    downstream: "Filtration — granular media or ultrafiltration.",
    ccepcNote: "CCEPC uses grid flocculation with inclined-plate sedimentation as the standard pre-treatment on the Gresik seawater train.",
  },

  daf: {
    principle:
      "Air is dissolved into water under 5 to 6 bar, then released to atmospheric pressure through a nozzle. The sudden pressure drop precipitates the air as microbubbles 20 to 50 µm across. Those bubbles attach to flocs, and the combined bubble-floc has a density lower than water, so it rises instead of settling. A surface scraper removes the float. It is gravity separation run in reverse, and it works precisely where settling fails.",
    whenToUse: [
      "Algae-laden surface water, especially seawater and reservoirs — algae float naturally and resist settling.",
      "Oily wastewater and any low-density solid.",
      "Where the raw water solids are light and a clarifier would need an impractical area.",
      "Where a compact footprint matters: DAF loading rates are several times higher than settling.",
    ],
    whenNotToUse: [
      "On heavy mineral turbidity — sand and silt settle readily and flotation wastes energy fighting them.",
      "As the only solids step on very high turbidity water; sedimentation first, then DAF for the light fraction.",
    ],
    designRules: [
      {
        rule: "Recycle 8 to 12 % of the treated water through the saturator.",
        why: "That recycle carries the dissolved air. Too little and there are not enough bubbles to float the floc; too much and you are pumping treated water to 6 bar for nothing.",
      },
      {
        rule: "DAF needs its own coagulation, tuned differently from a clarifier.",
        why: "You want a small, strong, low-density floc that a bubble can lift — not the large dense floc that settles well. The optimum coagulant dose for DAF is usually lower.",
      },
    ],
    keyNumbers: [
      { param: "Surface loading", typical: "5–12 m³/m²·h", why: "Several times a clarifier, which is why the footprint is small." },
      { param: "Saturation recycle", typical: "8–12 % of feed", why: "Sets the air-to-solids ratio, the controlling variable." },
      { param: "Saturator pressure", typical: "5–6 bar", why: "Henry's law: dissolved air rises with pressure. Below 4 bar bubble production falls off sharply." },
      { param: "Bubble size", typical: "20–50 µm", why: "Small enough to attach without dislodging the floc, large enough to lift it." },
    ],
    failureModes: [
      { mode: "Poor float", symptom: "Solids passing to the outlet, thin scum", prevention: "Check saturator pressure and recycle rate before touching the coagulant." },
      { mode: "Nozzle blockage", symptom: "Uneven bubble curtain across the cell", prevention: "Filter the recycle water; inspect nozzles on a schedule." },
    ],
    ccepcNote: "CCEPC installs DAF downstream of the sedimentation basin at Gresik, catching the light fraction that settling leaves behind.",
  },

  mmf: {
    principle:
      "Water passes down through layers of media — coarse, light anthracite on top, finer, denser sand below. Particles are captured in the depth of the bed, not just on its surface, which is why a graded multimedia bed holds far more solids than sand alone before it blocks. Backwashing fluidises the bed and carries the captured solids away; because the media differ in density, they re-stratify in the correct order on settling.",
    whenToUse: [
      "After clarification, as a polishing step before membranes or distribution.",
      "Where the capital budget rules out ultrafiltration.",
      "On iron and manganese removal after oxidation.",
    ],
    whenNotToUse: [
      "As the sole pre-treatment for reverse osmosis on a variable surface water. Media filtration cannot guarantee an SDI below 3 when the feed swings — that is what ultrafiltration is for.",
      "On feed above roughly 20 NTU without upstream clarification. You will spend the day backwashing.",
    ],
    designRules: [
      {
        rule: "Filtration rate 8 to 12 m/h for potable duty.",
        why: "Higher rates drive particles deeper and eventually through. The bed depth to grain size ratio, not the rate alone, sets the capture.",
      },
      {
        rule: "Provide n+1 filters, and check the rate with one unit in backwash.",
        why: "Backwashing takes a filter offline. If four duty filters become three during backwash, the remaining three must still meet the rate limit — otherwise quality drops every time you wash.",
      },
      {
        rule: "Air scour then water backwash.",
        why: "Water alone does not break the mud balls that form in the top layer. Air scour scrubs the grains against each other first.",
      },
    ],
    keyNumbers: [
      { param: "Filtration rate", typical: "8–12 m/h", why: "Standard for gravity or pressure multimedia. Above 14 m/h capture falls." },
      { param: "Bed depth", typical: "0.9–1.5 m", why: "Depth provides storage. A shallow bed blocks on the surface." },
      { param: "Backwash water", typical: "2–4 % of throughput", why: "Directly reduces plant recovery, which is why recovering it is worthwhile." },
      { param: "Backwash rate", typical: "35–50 m/h", why: "Enough to fluidise the bed by 20–30 %. Too little and it does not clean; too much and you lose media." },
      { param: "Effluent turbidity", typical: "< 0.5 NTU", why: "Achievable after good clarification. If you cannot reach it, the problem is upstream." },
    ],
    failureModes: [
      { mode: "Mud balling", symptom: "Rising headloss, poor backwash, channels in the bed", prevention: "Air scour, adequate backwash rate, and not letting the bed run to excessive headloss." },
      { mode: "Media loss", symptom: "Falling bed level, media in the backwash", prevention: "Correct backwash rate and adequate freeboard." },
      { mode: "Breakthrough", symptom: "Turbidity spike late in the run", prevention: "Terminate the run on turbidity as well as headloss." },
    ],
  },

  acf: {
    principle:
      "Activated carbon has an enormous internal surface area — around 1000 m² per gram — in a network of pores. Organic molecules and free chlorine are held on that surface by adsorption and, in the case of chlorine, destroyed by a catalytic reaction on the carbon surface. Chlorine removal is fast and catalytic; organics removal is slow, capacity-limited, and eventually exhausts.",
    whenToUse: [
      "Immediately upstream of any polyamide membrane, to remove free chlorine.",
      "Where taste, odour or dissolved organics must be removed.",
      "Ahead of EDI, which is intolerant of organic fouling.",
    ],
    whenNotToUse: [
      "Where chloramine rather than free chlorine is present — carbon removes it far more slowly and you need a much longer contact time.",
      "As the only dechlorination barrier on a critical membrane plant. Carbon exhausts silently; back it up with metabisulphite dosing.",
      "Where the organic load is high enough to exhaust the bed in weeks — a different process is needed.",
    ],
    designRules: [
      {
        rule: "Empty bed contact time of 6 to 10 minutes for dechlorination.",
        why: "EBCT = bed depth ÷ filtration rate. Chlorine destruction is fast, but you still need contact. Below about 6 minutes breakthrough becomes likely as the carbon ages.",
      },
      {
        rule: "Always back up carbon dechlorination with sodium metabisulphite.",
        why: "Carbon gives no warning before it stops removing chlorine. A single chlorine excursion irreversibly oxidises a polyamide membrane — the damage is permanent and the whole element must be replaced. SMBS is cheap insurance against a very expensive failure.",
      },
      {
        rule: "Expect a carbon bed to grow bacteria.",
        why: "You have just removed the disinfectant and provided a huge surface with adsorbed organics. Carbon beds are biologically active by nature. Periodic sanitisation, and never leaving a bed stagnant, are part of normal operation.",
      },
    ],
    keyNumbers: [
      { param: "EBCT", typical: "6–10 min dechlorination, 15–30 min organics", why: "Organics adsorb far more slowly than chlorine reacts." },
      { param: "Filtration rate", typical: "8–12 m/h", why: "Combined with bed depth this sets EBCT." },
      { param: "Carbon life", typical: "1–3 years", why: "Governed by organic loading, which is why an unmeasured TOC makes this number a guess." },
      { param: "TOC removal", typical: "40–70 % fresh", why: "Falls steadily as the bed loads. The average over a replacement cycle is well below the fresh figure." },
    ],
    failureModes: [
      { mode: "Chlorine breakthrough", symptom: "Free chlorine detected at the RO feed — often only after membrane damage", prevention: "ORP monitoring on the RO feed, plus SMBS dosing." },
      { mode: "Bacterial growth", symptom: "Rising counts, biofouling downstream", prevention: "Regular sanitisation, avoid stagnation, consider hot water sanitisable carbon." },
    ],
    downstream: "Cartridge filtration then the membrane it exists to protect.",
  },

  cartridge: {
    principle:
      "A wound or pleated element with a nominal pore rating that stops particles larger than the rating. On a membrane plant it is not really a treatment step — it is a guard and a diagnostic.",
    whenToUse: ["Immediately before every high pressure membrane pump, without exception."],
    whenNotToUse: ["As a process filter carrying a real solids load. Elements are consumables and you will change them daily."],
    designRules: [
      {
        rule: "Treat rising differential pressure as an alarm, not a maintenance item.",
        why: "The cartridge is the cheapest instrument on the plant. A rising dP tells you something upstream has failed days before the membranes show it — and membranes cost a hundred times more than elements.",
      },
      {
        rule: "5 µm is the normal rating ahead of RO.",
        why: "Fine enough to stop what would damage a membrane, coarse enough not to blind immediately.",
      },
    ],
    keyNumbers: [
      { param: "Rating", typical: "5 µm", why: "Industry standard ahead of spiral-wound RO." },
      { param: "Flow per 40 in element", typical: "2–3 m³/h", why: "Higher flows shorten life sharply." },
      { param: "Change-out dP", typical: "1.0 bar rise", why: "Beyond this the elements can deform and bypass." },
    ],
    failureModes: [
      { mode: "Rapid blinding", symptom: "dP rising within days", prevention: "Fix the upstream problem — never simply fit coarser elements." },
      { mode: "Element bypass", symptom: "Clean dP but fouled membranes", prevention: "Correct seals and proper installation; do not run past the change-out dP." },
    ],
  },

  /* ============================================================ MEMBRANES */
  uf: {
    principle:
      "Hollow fibres with pores of 0.01 to 0.1 µm separate by absolute size exclusion. Anything larger than the pore is stopped, regardless of how the feed varies — which is the fundamental difference from a media filter, where capture depends on depth, rate and condition of the bed. Dissolved salts pass through completely. Operation is usually dead-end, with all feed becoming filtrate, and periodic backwash plus air scour to lift the accumulated cake off the fibre.",
    whenToUse: [
      "As pre-treatment for RO where a dependable low SDI matters — which is to say, on any surface water.",
      "Where the feed quality varies and a media filter would pass solids during upsets.",
      "Where bacteria, cysts and viruses must be removed by a physical barrier rather than by chemistry.",
      "Where footprint is tight: UF occupies a fraction of the area of clarification plus media filtration.",
    ],
    whenNotToUse: [
      "For desalination. UF removes nothing dissolved — it will not reduce TDS, hardness or silica by any meaningful amount.",
      "On feed with high oil or grease without pre-treatment; oil coats the fibre and is difficult to remove.",
      "Where free chlorine is present and the membrane is polyamide — check the material tolerance. PVDF handles chlorine; some others do not.",
    ],
    designRules: [
      {
        rule: "Design flux 50 to 75 LMH on clarified surface water; derate for high turbidity or high temperature swings.",
        why: "Flux is the throughput per unit membrane area. Push it too high and the cake compacts faster than backwash can remove it, so trans-membrane pressure climbs and cleaning frequency rises until the plant cannot keep up.",
      },
      {
        rule: "Always provide at least one standby train.",
        why: "A train in backwash or CIP is offline. Without a standby, the duty trains must carry the whole flow at a higher flux exactly when you least want it — and every backwash becomes a plant derate.",
      },
      {
        rule: "Backwash goes to a recovery basin, not to drain.",
        why: "UF backwash is 3 to 6 % of throughput. Returning it to the head of the clarifier is normally the single cheapest way to raise overall plant recovery — far cheaper per point of recovery than pushing RO recovery higher.",
      },
      {
        rule: "Segregate the chemically enhanced backwash waste.",
        why: "CEB water carries hypochlorite. Returning it to the head of the works sends free chlorine toward the RO membranes. This is a small piping detail with an expensive consequence.",
      },
    ],
    keyNumbers: [
      { param: "Design flux", typical: "50–75 LMH", why: "Surface water after clarification. Groundwater tolerates more, raw surface water less." },
      { param: "Net recovery", typical: "90–95 %", why: "Losses are backwash and CEB. Recoverable if you route them to a recovery basin." },
      { param: "Trans-membrane pressure", typical: "0.3–1.5 bar", why: "Rises as the membrane fouls. The trend, not the value, is what matters." },
      { param: "Filtrate turbidity", typical: "< 0.1 NTU", why: "Absolute barrier. If it is higher, a fibre has broken." },
      { param: "SDI₁₅", typical: "< 3", why: "This is the number that makes 80 % RO recovery dependable rather than hopeful." },
      { param: "Membrane life", typical: "5–10 years", why: "Longer than RO because the duty is gentler." },
    ],
    failureModes: [
      { mode: "Irreversible fouling", symptom: "TMP not recovering after CEB", prevention: "Correct coagulation upstream; CIP before the trend becomes irreversible, not after." },
      { mode: "Fibre breakage", symptom: "Filtrate turbidity spike, failed integrity test", prevention: "Daily pressure-decay integrity testing; avoid pressure shocks." },
      { mode: "Oxidant damage", symptom: "Loss of integrity, fibres embrittled", prevention: "Confirm the membrane material tolerates the CEB chemistry you plan to use." },
    ],
    upstream: "Clarification, or direct on good-quality water. A self-cleaning strainer of about 100 µm protects the fibres.",
    downstream: "Cartridge filtration then RO.",
    ccepcNote: "CCEPC uses pressurised hollow-fibre UF with dead-end operation, air scour, backwash and CEB on the Gresik seawater train.",
  },

  nf: {
    principle:
      "Nanofiltration sits between ultrafiltration and reverse osmosis. Its membrane carries a fixed negative surface charge, so rejection is governed by ion charge as much as by size: divalent ions such as calcium, magnesium and sulphate are strongly repelled and rejected, while monovalent sodium and chloride pass relatively freely. That selectivity is the entire point — it lets you separate hardness and sulphate from sodium chloride rather than removing everything indiscriminately.",
    whenToUse: [
      "Salt separation: removing calcium, magnesium and sulphate while keeping sodium chloride in solution, which is what makes downstream brine concentration and salt production possible.",
      "Softening where you want hardness gone but do not need the TDS reduced.",
      "Colour and organics removal on surface water at lower pressure than RO.",
      "Ahead of high-recovery RO, to remove the scale-forming ions that would otherwise limit recovery.",
    ],
    whenNotToUse: [
      "For desalination or boiler feed water. NF passes most of the sodium and chloride — around half in practice — so it cannot make low-TDS water.",
      "Where the goal is simply hardness removal on a small plant; a sodium softener is far cheaper.",
    ],
    designRules: [
      {
        rule: "Understand that NF rejection is ion-specific, and never quote a single rejection figure.",
        why: "A vendor sheet saying '98 % rejection' means sulphate. Sodium may be 20 %. If you size a downstream process on the headline number you will be badly wrong.",
      },
      {
        rule: "Removing divalent ions first is what allows the downstream RO to reach high recovery.",
        why: "RO recovery is limited by the first salt to reach saturation in the concentrate — usually calcium carbonate or calcium sulphate. Take those out at the NF stage and the RO can be concentrated much further before anything precipitates.",
      },
    ],
    keyNumbers: [
      { param: "Recovery", typical: "70–85 %", why: "Higher than RO because the osmotic pressure of the passing monovalent salt is not being fought." },
      { param: "Rejection: SO₄²⁻", typical: "95–99 %", why: "Divalent and strongly repelled by the charged membrane." },
      { param: "Rejection: Mg²⁺", typical: "90–97 %", why: "Divalent." },
      { param: "Rejection: Ca²⁺", typical: "75–90 %", why: "Divalent but smaller hydrated radius than magnesium." },
      { param: "Rejection: Na⁺ / Cl⁻", typical: "15–50 %", why: "Monovalent — deliberately allowed to pass. This is the feature, not a defect." },
      { param: "Operating pressure", typical: "5–25 bar", why: "Well below RO because most of the osmotic load passes through." },
    ],
    failureModes: [
      { mode: "Sulphate scaling", symptom: "Falling flux, rising dP across the stage", prevention: "Antiscalant selected for barium and strontium sulphate, and a scaling projection run at design recovery." },
      { mode: "Unexpected monovalent rejection", symptom: "Downstream salinity lower than designed", prevention: "Use project-specific rejection data, not a generic datasheet." },
    ],
    ccepcNote: "At Gresik, CCEPC uses two NF stages for salt separation. The model in this tool is calibrated against the reported permeate composition of the first stage.",
  },

  ro: {
    principle:
      "A dense polyamide film with no pores in the conventional sense. Water dissolves into the film and diffuses through it; salts do so far more slowly, so the permeate is depleted in salt. It works only against osmotic pressure: you must apply more pressure than the osmotic pressure difference across the membrane, and that difference grows as the feed concentrates along the vessel. Dissolved gases — carbon dioxide above all — are not ionic and pass straight through, which is why RO permeate is acidic and why its conductivity reading overstates its true ionic content.",
    whenToUse: [
      "Desalination, demineralisation, boiler feed water preparation.",
      "Wherever TDS, hardness, silica and organics must all come down in one step.",
      "Ahead of EDI or mixed bed polishing.",
      "Wastewater reuse where a high-quality product is needed.",
    ],
    whenNotToUse: [
      "Without adequate pre-treatment. SDI above 3 will foul the membranes, and no operating regime will rescue it.",
      "Where free chlorine may reach the membrane. Polyamide is destroyed irreversibly by oxidants.",
      "Where only hardness is a problem — ion exchange softening is far cheaper.",
      "On very high TDS where the osmotic pressure exceeds what the membrane can be pressurised to; that is evaporation territory.",
    ],
    designRules: [
      {
        rule: "Permeate quality degrades as recovery rises, and the relationship is not linear.",
        why: "The membrane sees the average feed-to-brine concentration, not the feed. The log-mean concentration factor is ln(1/(1−Y))/Y — about 2.0 at 75 % recovery and 2.6 at 90 %. Push recovery up and permeate salinity rises even though the membrane has not changed.",
      },
      {
        rule: "Recovery is limited by scaling in the concentrate, not by the pump.",
        why: "Calcium carbonate, calcium sulphate, barium sulphate and silica each have a saturation limit. The first one reached sets the maximum recovery. That is why NF or softening upstream buys you recovery.",
      },
      {
        rule: "Design flux 15 to 20 LMH on surface water, up to 25 on well pre-treated water.",
        why: "High flux concentrates solutes at the membrane surface faster than they can diffuse away — concentration polarisation — which accelerates both scaling and fouling. Low flux is the cheapest fouling control there is.",
      },
      {
        rule: "Expect permeate pH of 5.5 to 6.5 and do not be alarmed by it.",
        why: "Carbon dioxide passes freely and re-forms carbonic acid on the permeate side. It is not a membrane fault. If it matters downstream, dose caustic before the next stage or fit a degasser.",
      },
      {
        rule: "Two passes are needed when one cannot meet the downstream limit — most often when feeding EDI.",
        why: "EDI typically requires feed hardness below 1 mg/L as CaCO₃. On a hard feed, single-pass permeate will exceed that. The second pass is protecting an expensive module, not chasing the boiler standard.",
      },
    ],
    keyNumbers: [
      { param: "Recovery, brackish", typical: "70–85 %", why: "Scaling-limited. Above 85 % you are relying heavily on antiscalant." },
      { param: "Design flux", typical: "15–20 LMH", why: "Surface water with UF pre-treatment. Lower for difficult feeds." },
      { param: "Salt rejection", typical: "97–99.5 %", why: "New membrane. Design on the aged, warranted figure, not the new one." },
      { param: "Feed pressure", typical: "10–25 bar brackish", why: "Osmotic pressure plus net driving pressure plus losses." },
      { param: "Element life", typical: "3–5 years", why: "Longer with UF pre-treatment; shorter behind media filtration." },
      { param: "Feed SDI₁₅", typical: "< 3", why: "The single most important pre-treatment specification." },
      { param: "Antiscalant dose", typical: "2–5 mg/L", why: "Set by the scaling projection at design recovery, not by habit." },
    ],
    failureModes: [
      { mode: "Scaling", symptom: "Flux loss and dP rise in the last stage first", prevention: "Scaling projection at design recovery; correct antiscalant; consider softening or NF upstream." },
      { mode: "Biofouling", symptom: "dP rise in the first stage first, permeate flow falling", prevention: "Control biology upstream; do not leave the plant stagnant; sanitise on a schedule." },
      { mode: "Oxidation", symptom: "Rejection falls permanently and does not recover after cleaning", prevention: "Carbon plus SMBS plus ORP monitoring. This damage cannot be reversed." },
      { mode: "Colloidal fouling", symptom: "dP rise across the whole array", prevention: "Fix the SDI — this is a pre-treatment failure showing up at the membrane." },
    ],
    upstream: "Cartridge filter, antiscalant and dechlorination.",
    downstream: "EDI, mixed bed, or direct use.",
  },

  swro: {
    principle:
      "The same mechanism as brackish RO, but at seawater salinity the osmotic pressure is around 25 bar at the feed and far higher in the concentrate, so operating pressures reach 55 to 80 bar. At those pressures the energy in the concentrate stream is a large fraction of the total energy input, which is why energy recovery is standard rather than optional.",
    whenToUse: [
      "Seawater desalination.",
      "Brine concentration in salt production and ZLD trains.",
      "Any feed where osmotic pressure makes brackish membranes impractical.",
    ],
    whenNotToUse: [
      "On brackish or low-TDS feed — the thicker, tighter membrane costs more energy for rejection you do not need.",
      "Where the concentrate osmotic pressure would exceed the membrane pressure rating; beyond that point evaporation is the only route.",
    ],
    designRules: [
      {
        rule: "Fit energy recovery. On seawater it is not a refinement.",
        why: "At 45 % recovery, 55 % of the pressurised flow leaves as concentrate still at near-feed pressure. A pressure exchanger returns most of that energy and typically cuts specific energy consumption by 50 to 60 %. The payback is measured in months.",
      },
      {
        rule: "Recovery is limited to 35 to 50 %.",
        why: "Not by scaling but by osmotic pressure. Concentrate at 50 % recovery is twice feed salinity, so its osmotic pressure is roughly 50 bar — you are close to the membrane pressure limit before any driving force is left.",
      },
      {
        rule: "Design flux lower than brackish, 12 to 17 LMH.",
        why: "Concentration polarisation is much more severe at high salinity, so the same flux produces a far worse local environment at the membrane surface.",
      },
    ],
    keyNumbers: [
      { param: "Recovery", typical: "35–50 %", why: "Osmotic-pressure limited." },
      { param: "Feed pressure", typical: "55–80 bar", why: "Must exceed the concentrate osmotic pressure plus driving force." },
      { param: "Design flux", typical: "12–17 LMH", why: "Lower than brackish because of polarisation." },
      { param: "Specific energy with ERD", typical: "2.5–4 kWh/m³", why: "Without recovery it is 6–8. This is the largest single lever on desalination cost." },
      { param: "Salt rejection", typical: "99.5–99.8 %", why: "Must be high: at 35,000 mg/L feed, even 0.5 % passage gives 175 mg/L permeate." },
    ],
    failureModes: [
      { mode: "Boron passage", symptom: "Product boron above specification", prevention: "Boron is poorly rejected at neutral pH; a second pass at elevated pH is the usual answer." },
      { mode: "High-pressure mechanical failure", symptom: "Vessel or connector leaks", prevention: "Correct pressure rating throughout, and slow-opening valves to avoid hydraulic shock." },
    ],
    ccepcNote: "CCEPC uses staged high-pressure RO, including low-salt-rejection membranes, to concentrate brine to 15 % NaCl at Gresik.",
  },

  ceramicmf: {
    principle:
      "Microfiltration through a rigid ceramic monolith rather than a polymer fibre. The ceramic tolerates extremes that would destroy a polymeric membrane: high salinity, high temperature, extreme pH, strong oxidants and aggressive cleaning.",
    whenToUse: [
      "Downstream of chemical softening, to separate precipitated calcium and magnesium from concentrated brine.",
      "Where salinity, temperature or pH rules out polymeric membranes.",
      "Where a very long membrane life justifies a high capital cost.",
    ],
    whenNotToUse: [
      "On ordinary surface water, where polymeric UF does the same job at a fraction of the cost.",
    ],
    designRules: [
      {
        rule: "Justify ceramic on the duty, not on performance.",
        why: "Ceramic and polymeric UF remove much the same particles. You pay for ceramic because the environment would destroy a polymer, not because the separation is better.",
      },
    ],
    keyNumbers: [
      { param: "Flux", typical: "100–250 LMH", why: "Much higher than polymeric, which partly offsets the capital cost." },
      { param: "Recovery", typical: "90–97 %", why: "Backwash losses." },
      { param: "Membrane life", typical: "10–20 years", why: "The economic argument for ceramic." },
    ],
    failureModes: [
      { mode: "Thermal shock cracking", symptom: "Loss of integrity after a temperature swing", prevention: "Controlled ramp rates on cleaning and start-up." },
    ],
    ccepcNote: "Used at Gresik after dual-alkali softening to remove the precipitate before evaporation.",
  },

  /* ============================================================ POLISHING */
  edi: {
    principle:
      "Ion exchange resin sandwiched between ion-selective membranes with a direct current field applied across the stack. Ions are captured by the resin, then driven through the membranes into a concentrate channel by the electric field. At the same time the field splits water into H⁺ and OH⁻, which continuously regenerate the resin. The result is ion exchange that never needs acid or caustic, never stops for regeneration, and never drifts in product quality.",
    whenToUse: [
      "Polishing RO permeate to boiler feed or process water quality.",
      "Where continuous, non-drifting product quality matters.",
      "Where handling and storing concentrated acid and caustic is unwelcome — safety, effluent, or operator skill.",
      "Where eliminating a neutralisation pit and its regenerant effluent has real value.",
    ],
    whenNotToUse: [
      "On feed with hardness above about 1 mg/L as CaCO₃. Hardness precipitates inside the stack in the alkaline regions and is very difficult to reverse. This is the single most common way EDI is destroyed.",
      "On feed with high TOC, CO₂ or silica without addressing them first.",
      "Where the capital budget is tight and a mixed bed would serve — EDI costs more up front and pays it back in operation.",
      "Directly on RO permeate from a hard feed without a second pass or a softener.",
    ],
    designRules: [
      {
        rule: "Treat feed hardness below 1 mg/L as CaCO₃ as an absolute requirement, not a target.",
        why: "Hardness fouling of an EDI stack is largely irreversible and the modules are expensive. If your single-pass RO permeate is 1.7 mg/L, you do not run the EDI at the edge of its limit — you add a second RO pass or a softener. This is exactly the decision that drove the two-pass configuration in the South Sumatra study.",
      },
      {
        rule: "Control carbon dioxide before the EDI, not inside it.",
        why: "CO₂ passes RO freely and becomes carbonic acid, loading the anion resin and driving up current demand and cost. Either dose caustic between RO passes to convert it to bicarbonate — which the second pass then rejects — or fit a degasser.",
      },
      {
        rule: "Quote the total exchangeable anion load, not just conductivity.",
        why: "Vendors size on TEA — carbon dioxide plus silica plus the strong anions, as CaCO₃. Conductivity alone hides the CO₂ because dissolved CO₂ is not ionic.",
      },
    ],
    keyNumbers: [
      { param: "Product resistivity", typical: "15–18 MΩ·cm", why: "Equivalent to well below 0.1 µS/cm." },
      { param: "Recovery", typical: "90–95 %", why: "Concentrate is dilute and normally recycled to the RO feed, so the net loss is small." },
      { param: "DC energy", typical: "0.1–0.3 kWh/m³", why: "Rises with the ionic load being removed." },
      { param: "Feed conductivity", typical: "< 40 µS/cm", why: "EDI is a polisher, not a desalinator." },
      { param: "Feed hardness", typical: "< 1 mg/L CaCO₃", why: "The limit that governs the whole upstream design." },
      { param: "Feed TOC", typical: "< 0.5 mg/L", why: "Organic fouling of the resin is slow and difficult to reverse." },
      { param: "Module life", typical: "7–10 years", why: "Provided the feed limits are respected." },
    ],
    failureModes: [
      { mode: "Hardness scaling", symptom: "Rising stack voltage, falling product quality, permanent", prevention: "Respect the feed hardness limit absolutely; monitor RO permeate hardness continuously." },
      { mode: "Organic fouling", symptom: "Gradual quality loss not recovered by cleaning", prevention: "Carbon filtration upstream and a real TOC measurement, not an assumed one." },
      { mode: "Chlorine damage", symptom: "Membrane degradation in the stack", prevention: "The same dechlorination that protects the RO protects the EDI." },
    ],
    upstream: "RO permeate, of a quality that meets every one of the limits above.",
  },

  mixedbed: {
    principle:
      "Strong acid cation and strong base anion resin intimately mixed in one vessel. Because cation and anion sites are adjacent, the water passes through thousands of alternating exchange stages, which is what allows a mixed bed to reach a far lower leakage than separate beds. Regeneration requires separating the two resins hydraulically, regenerating each with its own chemical, then remixing.",
    whenToUse: [
      "Polishing RO permeate where capital cost matters more than operating simplicity.",
      "Condensate polishing.",
      "Where the site already handles acid and caustic and has the containment for it.",
    ],
    whenNotToUse: [
      "Where handling concentrated acid and caustic is undesirable for safety or effluent reasons.",
      "Where a consistently constant product quality is needed — mixed bed quality drifts as the run progresses and steps back after each regeneration.",
      "Where the regenerant effluent and neutralisation pit are unwelcome.",
    ],
    designRules: [
      {
        rule: "Run length is set by the ionic load, not by time.",
        why: "Behind a good RO the permeate is so dilute that a mixed bed can run for weeks. Behind a poor RO it may run for days. Size on the actual permeate quality — including silica, which is easy to overlook and often the first to break through.",
      },
      {
        rule: "A neutralisation pit is mandatory, not optional.",
        why: "The regenerant is strongly acidic then strongly alkaline. It cannot be discharged as it is. This item is small and frequently forgotten at estimating stage, then becomes a compliance problem at commissioning.",
      },
      {
        rule: "Provide two vessels.",
        why: "Regeneration takes the vessel offline for hours. One duty and one regenerating is the minimum that keeps the plant running.",
      },
    ],
    keyNumbers: [
      { param: "Service velocity", typical: "20–40 m/h", why: "Too fast and you get leakage; too slow and you need an impractically wide vessel." },
      { param: "Product conductivity", typical: "< 0.2 µS/cm", why: "Achievable on RO permeate feed." },
      { param: "Recovery", typical: "97–99 %", why: "Regeneration rinse water is the loss." },
      { param: "Resin life", typical: "3–7 years", why: "Shortened by oxidants and organic fouling." },
    ],
    failureModes: [
      { mode: "Silica breakthrough", symptom: "Silica rises before conductivity does", prevention: "Monitor silica, not just conductivity — silica is the first to break through on a mixed bed." },
      { mode: "Incomplete separation before regeneration", symptom: "Falling capacity run after run", prevention: "Check backwash separation; cross-contaminated resin regenerates poorly." },
    ],
  },

  softener: {
    principle:
      "Strong acid cation resin in the sodium form. Calcium and magnesium have a higher affinity for the resin than sodium, so they are captured and an equivalent quantity of sodium is released. Total dissolved solids barely change — you have swapped one cation for another. Regeneration with concentrated brine reverses the exchange by mass action.",
    whenToUse: [
      "Where hardness must go but TDS does not matter: cooling tower make-up, low pressure boiler feed.",
      "Ahead of RO to allow higher recovery by removing the scale-forming cations.",
      "Ahead of EDI where a second RO pass is not justified.",
    ],
    whenNotToUse: [
      "For boiler feed water on its own. Softening removes hardness but leaves TDS, silica and alkalinity untouched — it cannot meet a demineralised specification.",
      "Where the added sodium is itself a problem.",
      "Where brine discharge is restricted. The regeneration brine is concentrated and counts against recovery.",
    ],
    designRules: [
      {
        rule: "Salt consumption follows the hardness load, and it is a real operating cost.",
        why: "Roughly 100 to 150 g of NaCl per equivalent of hardness removed. On a hard water at scale this becomes tonnes per day, plus a brine stream that reduces overall recovery — which is precisely why EDI is chosen to avoid regeneration chemistry.",
      },
      {
        rule: "Softening does not reduce alkalinity.",
        why: "Sodium bicarbonate passes straight through. If alkalinity is the problem, softening is the wrong process — you need dealkalisation or RO.",
      },
    ],
    keyNumbers: [
      { param: "Hardness removal", typical: "> 99 %", why: "Achievable; leakage rises as the bed exhausts." },
      { param: "Salt dose", typical: "100–150 g NaCl/eq", why: "Higher dose gives higher capacity but worse efficiency." },
      { param: "Service velocity", typical: "15–40 m/h", why: "Standard for gel resin." },
    ],
    failureModes: [
      { mode: "Hardness leakage", symptom: "Hardness detected before the expected exhaustion", prevention: "Correct regeneration; check for resin fouling by iron or organics." },
      { mode: "Iron fouling", symptom: "Progressive capacity loss", prevention: "Remove iron upstream; periodic acid or reducing cleaning." },
    ],
  },

  degasser: {
    principle:
      "A packed tower with air blown counter-current to the falling water. Dissolved carbon dioxide is stripped out because its partial pressure in the air stream is near zero. It removes a dissolved gas, which no membrane or ion exchange resin does efficiently.",
    whenToUse: [
      "Between RO passes or before ion exchange, to cut the anion load.",
      "Where CO₂ would otherwise consume anion resin capacity or EDI current.",
      "As a lower operating cost alternative to interstage caustic dosing.",
    ],
    whenNotToUse: [
      "Where reintroducing oxygen matters — it will saturate the water with air.",
      "Where the added break tank and repumping cost more than simply dosing caustic.",
    ],
    designRules: [
      {
        rule: "Degassing is only effective at low pH.",
        why: "CO₂ can only be stripped as dissolved gas. Above pH 8.3 the carbon is bicarbonate and carbonate, which cannot be stripped at all. RO permeate at pH 5.5 to 6 is ideal; caustic-dosed water is not.",
      },
    ],
    keyNumbers: [
      { param: "Air to water ratio", typical: "40–80 m³/m³", why: "Sets the driving force. More air gives better removal at more fan power." },
      { param: "CO₂ removal", typical: "85–95 %", why: "Residual is typically 5 mg/L." },
    ],
    failureModes: [
      { mode: "Biological growth in the packing", symptom: "Odour, rising downstream counts", prevention: "Periodic sanitisation; filtered air intake." },
      { mode: "Oxygen pickup", symptom: "Raised dissolved oxygen downstream", prevention: "Accept it and deaerate later, or use membrane degassing under vacuum." },
    ],
  },

  chemsoft: {
    principle:
      "Chemical precipitation. Adding sodium carbonate precipitates calcium as calcium carbonate; adding caustic or magnesium oxide raises pH so magnesium precipitates as magnesium hydroxide. Unlike ion exchange, this physically removes the hardness from solution as a solid, so it works at any salinity — including in concentrated brine where a resin would be useless.",
    whenToUse: [
      "Softening concentrated brine ahead of evaporation, where ion exchange cannot work.",
      "Where hardness is far too high for a resin to handle economically.",
      "In ZLD and salt production trains before crystallisation.",
    ],
    whenNotToUse: [
      "On ordinary feed water where a softener or RO would be simpler and produce no sludge.",
      "Where sludge handling and disposal is difficult — this process generates a lot of it.",
    ],
    designRules: [
      {
        rule: "Dose stoichiometrically, then add 10 to 20 % excess.",
        why: "Precipitation is an equilibrium. Exact stoichiometry leaves residual hardness in solution; the excess drives the reaction toward completion.",
      },
      {
        rule: "Provide 30 to 60 minutes of reaction time.",
        why: "Crystal nucleation and growth are not instantaneous. Too short and the precipitate is fine, hard to separate and passes to the filter.",
      },
    ],
    keyNumbers: [
      { param: "Reaction time", typical: "30–60 min", why: "Crystal growth kinetics." },
      { param: "Operating pH", typical: "10–11", why: "Magnesium hydroxide needs a high pH to precipitate." },
      { param: "Ca removal", typical: "95–99 %", why: "Limited by carbonate solubility." },
    ],
    failureModes: [
      { mode: "Fine precipitate carryover", symptom: "Downstream filter blinding", prevention: "Adequate reaction time; seed recirculation to grow larger crystals." },
      { mode: "Post-precipitation", symptom: "Scaling downstream after the separation step", prevention: "Full reaction completion and pH stabilisation before the filter." },
    ],
    downstream: "A separation step — ceramic membrane or clarifier.",
    ccepcNote: "CCEPC uses the dual-alkali method with Na₂CO₃, NaOH and MgO followed by ceramic membrane filtration at Gresik.",
  },

  /* ============================================================ BIOLOGICAL */
  aao: {
    principle:
      "Three zones in series, each selecting a different microbial community. Anaerobic first: phosphorus-accumulating organisms release phosphate and take up carbon, which is what sets up biological phosphorus removal. Anoxic next: denitrifiers use nitrate returned from the aerobic zone as their oxygen source, converting it to nitrogen gas while consuming carbon. Aerobic last: ordinary heterotrophs oxidise the remaining carbon and nitrifiers convert ammonia to nitrate. The order is not arbitrary — each zone depends on what the previous one has done.",
    whenToUse: [
      "Municipal wastewater requiring nitrogen and phosphorus removal.",
      "Industrial wastewater with a reasonable BOD to nutrient ratio.",
      "Where a proven, well-understood process with wide operator familiarity is wanted.",
    ],
    whenNotToUse: [
      "Where the carbon to nitrogen ratio is too low to drive denitrification without buying methanol.",
      "On highly toxic or inhibitory wastewater without extensive pre-treatment.",
      "Where footprint is very tight — MBR or MBBR are more compact.",
    ],
    designRules: [
      {
        rule: "Check the BOD:TN ratio before promising nitrogen removal.",
        why: "Denitrification consumes carbon. Below about 4:1 there is not enough carbon in the wastewater to reduce the nitrate, and you must buy an external source. This is an operating cost that appears nowhere on a process diagram and surprises people at commissioning.",
      },
      {
        rule: "Check the BOD:TP ratio too, around 20:1 for biological phosphorus removal.",
        why: "Phosphorus-accumulating organisms need readily biodegradable carbon in the anaerobic zone. Without it, biological P removal fails and you fall back to chemical dosing.",
      },
      {
        rule: "Sludge age governs nitrification, and temperature governs sludge age.",
        why: "Nitrifiers grow slowly, and much more slowly when cold. If the SRT is shorter than their doubling time they are washed out and ammonia passes through. Design the SRT on the minimum expected temperature, not the average.",
      },
      {
        rule: "F/M ratio is the sanity check on volume.",
        why: "Above about 0.3 kgBOD/kgMLSS·d the sludge tends to bulk and settle badly, and the secondary clarifier — not the reactor — becomes the bottleneck.",
      },
    ],
    keyNumbers: [
      { param: "Total HRT", typical: "10–20 h", why: "Split roughly 1 : 2 : 5 between anaerobic, anoxic and aerobic." },
      { param: "SRT", typical: "10–20 d", why: "Long enough for nitrifiers at the design temperature." },
      { param: "MLSS", typical: "3000–5000 mg/L", why: "Higher needs a larger clarifier or a membrane." },
      { param: "F/M ratio", typical: "0.1–0.25 kgBOD/kgMLSS·d", why: "Above 0.3 invites bulking." },
      { param: "Internal recycle", typical: "200–400 % of feed", why: "Carries nitrate from aerobic back to anoxic. This is what actually enables denitrification." },
      { param: "Oxygen demand", typical: "1.0–1.5 kgO₂/kgBOD + 4.57 kgO₂/kgN", why: "Nitrification is oxygen-hungry — the 4.57 factor often dominates the aeration bill." },
      { param: "Sludge yield", typical: "0.4–0.6 kgVSS/kgBOD", why: "Lower at long sludge age because of endogenous decay." },
    ],
    failureModes: [
      { mode: "Sludge bulking", symptom: "Poor settling, high SVI, solids over the clarifier weir", prevention: "Control F/M, maintain a proper selector zone, avoid septic feed." },
      { mode: "Nitrification failure", symptom: "Ammonia in the effluent, often after a cold spell", prevention: "SRT designed on minimum temperature; watch for toxic shock." },
      { mode: "Denitrification failure", symptom: "Nitrate in the effluent", prevention: "Confirm the carbon supply and the internal recycle rate." },
      { mode: "Rising sludge in the clarifier", symptom: "Sludge floating in clumps", prevention: "Denitrification in the clarifier — reduce sludge blanket time." },
    ],
    ccepcNote: "CCEPC reference: Baoxie WWTP, Wuhan, 70,000 m³/d, modified AAO with D-type filters.",
  },

  msbr: {
    principle:
      "A sequencing batch reactor run in a modified continuous configuration. The same basin passes through anaerobic, anoxic and aerobic conditions in sequence over time rather than in space, with settling in the same tank. Time replaces geometry, which is what removes the need for a separate secondary clarifier.",
    whenToUse: [
      "Where footprint is constrained and a separate clarifier cannot be accommodated.",
      "Where influent varies and the flexibility of adjusting cycle times has value.",
      "Municipal plants needing nutrient removal in a compact envelope.",
    ],
    whenNotToUse: [
      "Where operators are unfamiliar with cycle-based control — it demands more instrumentation and understanding than a continuous process.",
      "On very large flows where continuous processes are simpler and cheaper per m³.",
    ],
    designRules: [
      {
        rule: "The cycle time is the design variable, and it is what you tune in service.",
        why: "Unlike a continuous plant, where you would have to build a new tank, an MSBR lets you shift the balance between nitrification and denitrification by changing the aerated fraction of the cycle.",
      },
    ],
    keyNumbers: [
      { param: "Total HRT", typical: "12–24 h", why: "Includes settle and decant, which do no biological work." },
      { param: "Cycle time", typical: "4–6 h", why: "Shorter cycles give better equalisation but less settling time." },
    ],
    failureModes: [
      { mode: "Poor decant quality", symptom: "Solids in the decant", prevention: "Adequate settle time; floating decanter set correctly." },
    ],
    ccepcNote: "CCEPC reference: Zuoling WWTP, Wuhan, 100,000 m³/d, MSBR with tertiary treatment to TN < 10 mg/L.",
  },

  mbbr: {
    principle:
      "Plastic carriers kept in suspension by aeration or mixing, with biofilm growing on their protected internal surface. Because the biomass is attached rather than suspended, it is not washed out with the flow — sludge age is decoupled from hydraulic retention time. That is what makes an MBBR compact and resistant to shock.",
    whenToUse: [
      "Upgrading an existing basin without building a new one.",
      "Where the load varies sharply and a suspended-growth system would wash out.",
      "Where nitrification must be robust at low temperature.",
    ],
    whenNotToUse: [
      "Where biological phosphorus removal is required — a biofilm process does not do it.",
      "Where carrier retention screens would be difficult to maintain.",
    ],
    designRules: [
      {
        rule: "Design on surface area loading, not volumetric loading.",
        why: "The biofilm lives on the carrier surface. What matters is grams of BOD per square metre of carrier per day, so the carrier fill ratio and its specific surface area are the real design variables.",
      },
      {
        rule: "Keep the fill ratio below about 60 %.",
        why: "Above that the carriers cannot circulate freely, mixing fails and dead zones form.",
      },
    ],
    keyNumbers: [
      { param: "Carrier fill", typical: "30–60 %", why: "Higher gives more surface but risks poor mixing." },
      { param: "Surface loading (BOD)", typical: "5–15 gBOD/m²·d", why: "Lower for nitrification, which is slower." },
      { param: "HRT", typical: "4–10 h", why: "Shorter than suspended growth for the same duty." },
    ],
    failureModes: [
      { mode: "Carrier loss", symptom: "Carriers downstream, falling capacity", prevention: "Correctly sized retention screens, inspected regularly." },
      { mode: "Thick biofilm", symptom: "Mass transfer limitation, falling performance", prevention: "Adequate turbulence to shear the film to the right thickness." },
    ],
  },

  "coke-ao": {
    principle:
      "Anoxic-oxic treatment adapted for coking wastewater, which contains phenol, cyanide, thiocyanate and ammonia at concentrations that would kill an ordinary activated sludge plant. The biomass is acclimatised over months to degrade those specific compounds. The anoxic zone also uses the recycled nitrate to oxidise part of the organic load, which reduces the aeration burden.",
    whenToUse: [
      "Coking, gasification and coal chemical wastewater.",
      "High-strength phenolic wastewater where the biology can be acclimatised.",
    ],
    whenNotToUse: [
      "Without extensive pre-treatment — oil removal, ammonia stripping and equalisation are all prerequisites.",
      "Where the toxic load fluctuates so badly that acclimatised biomass cannot survive.",
    ],
    designRules: [
      {
        rule: "Pre-treatment is not optional and usually costs more attention than the biology.",
        why: "Oil coats the biomass, tar blocks diffusers, and an ammonia slug at several thousand mg/L is simply toxic. The A/O stage only works if what reaches it has already been conditioned.",
      },
      {
        rule: "Expect very long retention and a long acclimatisation period.",
        why: "Phenol and thiocyanate degrade slowly and the organisms that do it grow slowly. Commissioning is measured in months, not weeks — plan for it contractually.",
      },
    ],
    keyNumbers: [
      { param: "HRT", typical: "40–72 h", why: "Far longer than municipal because of the slow degradation kinetics." },
      { param: "Influent COD", typical: "3000–10000 mg/L", why: "Typical coking wastewater strength." },
      { param: "COD removal", typical: "85–95 %", why: "Residual is largely non-biodegradable and needs a polishing step." },
    ],
    failureModes: [
      { mode: "Toxic shock", symptom: "Sudden loss of removal, biomass die-off", prevention: "Equalisation and on-line toxicity monitoring upstream." },
      { mode: "Ammonia inhibition", symptom: "Nitrification stops", prevention: "Ammonia stripping before the biology." },
    ],
    ccepcNote: "CCEPC reference: Hubei Jinshenglan, 120 m³/h DBO contract, COD 8000 to below 30 mg/L.",
  },

  denitrifilter: {
    principle:
      "A fixed-film filter that provides both denitrification and solids removal. Methanol or another carbon source is dosed into the feed; denitrifying bacteria on the media convert nitrate to nitrogen gas. The media simultaneously filters the residual suspended solids from the upstream clarifier.",
    whenToUse: [
      "Tertiary polishing where total nitrogen must reach below 10 mg/L.",
      "Where the secondary process cannot achieve the nitrogen limit alone.",
    ],
    whenNotToUse: [
      "Where nitrogen limits are loose enough for the secondary process to meet.",
      "Where methanol handling is unacceptable — it is a flammable liquid needing proper storage.",
    ],
    designRules: [
      {
        rule: "Dose carbon at 3 to 4 kg methanol per kg of nitrate-nitrogen removed.",
        why: "Stoichiometry plus growth. Underdose and nitrogen passes; overdose and you export COD to the effluent, replacing one violation with another.",
      },
      {
        rule: "Nitrogen gas accumulates in the bed and must be released.",
        why: "The process generates gas inside the media. Without periodic bumping the bed gas-binds, headloss climbs and flow distribution collapses.",
      },
    ],
    keyNumbers: [
      { param: "Filtration rate", typical: "5–12 m/h", why: "Slower than a plain filter because biological reaction time is needed." },
      { param: "Methanol ratio", typical: "3.0–3.5 kg/kgNO₃-N", why: "Stoichiometric requirement plus biomass yield." },
      { param: "TN removal", typical: "60–85 %", why: "Of the nitrate entering; ammonia is not removed here." },
    ],
    failureModes: [
      { mode: "Gas binding", symptom: "Rapid headloss rise, uneven flow", prevention: "Scheduled nitrogen release bumps." },
      { mode: "Carbon overdose", symptom: "COD in the final effluent", prevention: "Feed-forward dosing on nitrate, trimmed by an effluent COD check." },
    ],
  },

  disinfection: {
    principle:
      "Chlorine oxidises cell membranes and enzymes; ultraviolet light at 254 nm damages the DNA so organisms cannot reproduce. Chlorine leaves a residual that protects the distribution system; UV leaves nothing, so downstream recontamination is not prevented.",
    whenToUse: [
      "Potable water, always.",
      "Treated effluent before discharge or reuse.",
      "Ahead of storage, to prevent regrowth.",
    ],
    whenNotToUse: [
      "Chlorine, directly upstream of a polyamide membrane without dechlorination.",
      "UV, where a residual is needed in the distribution network.",
      "Chlorine, on water with high organic content where trihalomethane formation would breach the standard.",
    ],
    designRules: [
      {
        rule: "Chlorine works on CT — concentration multiplied by contact time.",
        why: "A high dose with no contact tank does not disinfect. The contact tank is part of the process, not a convenience.",
      },
      {
        rule: "UV requires good transmittance, so turbidity must be low first.",
        why: "Particles shield organisms from the light. UV after poor filtration is money spent on nothing.",
      },
    ],
    keyNumbers: [
      { param: "Cl₂ dose", typical: "1–3 mg/L", why: "To hold 0.2–0.5 mg/L residual after demand is satisfied." },
      { param: "Contact time", typical: "30 min", why: "At normal pH and residual, sufficient for the usual CT requirement." },
      { param: "UV dose", typical: "40 mJ/cm²", why: "Standard for drinking water; higher for wastewater reuse." },
    ],
    failureModes: [
      { mode: "Insufficient contact", symptom: "Coliform breakthrough despite adequate dose", prevention: "Baffled contact tank with a proper baffling factor." },
      { mode: "UV lamp fouling", symptom: "Falling transmittance, reduced dose", prevention: "Automatic wipers and a calibrated UV intensity sensor." },
    ],
  },

  /* ============================================================ SLUDGE / THERMAL */
  thickener: {
    principle:
      "Gravity concentration. Sludge is allowed to compact under its own weight so that the water above can be drawn off, typically taking sludge from under 1 % dry solids to 3 to 6 %. Halving the volume halves everything downstream — dewatering, transport, disposal.",
    whenToUse: [
      "Ahead of any dewatering step, always.",
      "Where the supernatant can be returned to the head of the works to raise plant recovery.",
    ],
    whenNotToUse: [
      "On very small sludge flows where the civil cost is not justified.",
    ],
    designRules: [
      {
        rule: "Return the supernatant and count it.",
        why: "It is typically half the sludge volume and it is nearly clean water. Returning it to the clarifier inlet is one of the cheapest recovery levers available, and if you do not count it you understate your own plant.",
      },
      {
        rule: "Watch out for a septic thickener.",
        why: "Held too long, biological sludge goes anaerobic, releases phosphorus back into the supernatant, and floats. You then return that load to the head of the works and create a recycle problem.",
      },
    ],
    keyNumbers: [
      { param: "Solids loading", typical: "40–80 kg/m²·d", why: "Lower for light biological sludge, higher for dense chemical sludge." },
      { param: "Supernatant recovery", typical: "40–60 % of feed volume", why: "Depends on how thick the underflow can be drawn." },
      { param: "Underflow solids", typical: "3–6 % DS", why: "From under 1 % — a fourfold or better volume reduction." },
    ],
    failureModes: [
      { mode: "Rising sludge", symptom: "Sludge floating rather than settling", prevention: "Shorter retention; avoid going septic." },
    ],
  },

  dewatering: {
    principle:
      "Mechanical removal of water from thickened sludge. A filter press applies pressure across a cloth, forming a cake; a centrifuge uses centrifugal force. Polymer is added first to flocculate the fine solids so that they are captured rather than passing into the filtrate.",
    whenToUse: [
      "Wherever sludge must be transported or landfilled — cake is far cheaper to move than liquid sludge.",
      "Where disposal is charged by volume or mass.",
    ],
    whenNotToUse: [
      "Where drying beds are viable and land is cheap. In a tropical climate, beds cost a fraction of a press to build and almost nothing to run.",
    ],
    designRules: [
      {
        rule: "Return the filtrate to the head of the works and count it.",
        why: "It carries a solids and nutrient load back into the plant. Ignoring it in the balance is a common way to overstate performance.",
      },
      {
        rule: "Polymer dose and type must be confirmed by test.",
        why: "Conditioning is highly specific to the sludge. The wrong polymer gives a wet cake and a dirty filtrate no matter how good the machine is.",
      },
    ],
    keyNumbers: [
      { param: "Cake dryness, filter press", typical: "25–35 % DS", why: "Higher than a centrifuge, which is why presses persist despite being batch machines." },
      { param: "Cake dryness, centrifuge", typical: "18–25 % DS", why: "Continuous operation at lower dryness." },
      { param: "Polymer dose", typical: "3–6 kg/t DS", why: "Rises for light biological sludge." },
      { param: "Solids capture", typical: "95–98 %", why: "The remainder returns in the filtrate." },
    ],
    failureModes: [
      { mode: "Poor cake release", symptom: "Cake sticking to the cloth", prevention: "Cloth washing; correct conditioning." },
      { mode: "High filtrate solids", symptom: "Solids recycling back into the plant", prevention: "Polymer optimisation." },
    ],
  },

  mvr: {
    principle:
      "Vapour from the evaporator is compressed, which raises its saturation temperature; the compressed vapour then condenses on the other side of the heat transfer surface, giving up its latent heat to boil more feed. The same latent heat is used over and over, and the only energy input is the compressor work. That is why MVR uses a fraction of the energy of a once-through evaporator — but it is still, by a wide margin, the largest energy consumer in any ZLD train.",
    whenToUse: [
      "Where membranes have reached their osmotic limit and further concentration is still required.",
      "ZLD and minimal liquid discharge.",
      "Salt production from concentrated brine.",
    ],
    whenNotToUse: [
      "Where a membrane could still do the job. Always concentrate as far as possible by RO first — the energy difference is an order of magnitude.",
      "Where the brine is prone to scaling and has not been softened. Scale on the heat transfer surface destroys the economics immediately.",
    ],
    designRules: [
      {
        rule: "Soften thoroughly before the evaporator.",
        why: "Calcium sulphate and calcium carbonate scale the heat transfer surface, and the heat transfer coefficient is the whole basis of the design. This is why chemical softening and a ceramic membrane sit in front of the evaporator in a salt plant.",
      },
      {
        rule: "Allow for boiling point elevation.",
        why: "A concentrated brine boils well above the temperature of pure water at the same pressure. That elevation directly reduces the available temperature difference and therefore the capacity — ignoring it produces an undersized evaporator.",
      },
      {
        rule: "Concentrate as far as possible by membranes first.",
        why: "RO uses roughly 3 to 5 kWh per m³ removed. MVR uses 15 to 40. Every cubic metre you remove with a membrane instead of a compressor is a large saving.",
      },
    ],
    keyNumbers: [
      { param: "Specific energy", typical: "15–40 kWh/m³ evaporated", why: "Depends on compression ratio and boiling point elevation." },
      { param: "Distillate TDS", typical: "10–50 mg/L", why: "Very pure, and normally reused." },
      { param: "Concentration achievable", typical: "to 20–25 % TDS", why: "Beyond this you are at crystallisation." },
    ],
    failureModes: [
      { mode: "Heat surface scaling", symptom: "Falling capacity, rising temperature difference required", prevention: "Thorough upstream softening; seeded slurry operation." },
      { mode: "Foaming", symptom: "Carryover into the distillate", prevention: "Antifoam dosing; adequate vapour disengagement space." },
    ],
  },

  crystalliser: {
    principle:
      "Evaporation continued past saturation so that salt crystallises out of solution. Forced circulation keeps the slurry moving and the crystals suspended; the crystals are separated by centrifuge and the mother liquor is recycled back to the evaporator.",
    whenToUse: [
      "Salt production as a saleable product.",
      "The final stage of a true zero liquid discharge plant.",
    ],
    whenNotToUse: [
      "Where a concentrated brine can be legally discharged. Crystallisation is very expensive in both capital and energy — do not build it to solve a problem you do not have.",
    ],
    designRules: [
      {
        rule: "Mixed salts destroy product value.",
        why: "If sulphate and other ions are still present, you crystallise a mixture rather than sodium chloride, and the product is worth much less. That is precisely why nanofiltration performs salt separation earlier in the train.",
      },
      {
        rule: "There must be a purge on the mother liquor.",
        why: "Non-crystallising impurities accumulate in the recycle loop indefinitely. Without a purge, the loop concentration climbs until the product goes off specification.",
      },
    ],
    keyNumbers: [
      { param: "Specific energy", typical: "50–200 kWh/t salt", why: "Depends on the concentration of the feed brine." },
      { param: "Salt recovery", typical: "85–95 %", why: "The remainder leaves in the mother liquor purge." },
    ],
    failureModes: [
      { mode: "Impurity build-up", symptom: "Product specification drift", prevention: "Adequate mother liquor purge rate." },
      { mode: "Crystal habit problems", symptom: "Fine crystals, poor centrifuge performance", prevention: "Control supersaturation and residence time." },
    ],
  },

  /* ============================================================ NETWORK */
  splitter: {
    principle:
      "Divides a stream into two on a volumetric fraction. Composition is unchanged in both branches — splitting water does not separate anything.",
    whenToUse: [
      "Sending part of a stream to recycle and the rest onward.",
      "Distributing one source to several consumers of different quality requirement.",
      "Building a bypass around a treatment step.",
    ],
    whenNotToUse: ["To represent a separation. Use the unit that actually separates."],
    designRules: [
      {
        rule: "A splitter is how you build a recycle in a flowsheet.",
        why: "Take a fraction of a downstream stream and route it back upstream. The solver will iterate the loop to convergence — that is exactly how backwash recovery and reject recycle are modelled.",
      },
    ],
    keyNumbers: [{ param: "Split fraction", typical: "as required", why: "Set by the recycle ratio you want." }],
    failureModes: [
      { mode: "Runaway recycle", symptom: "Solver fails to converge, flows growing each iteration", prevention: "Keep the recycle fraction well below unity; check the loop makes physical sense." },
    ],
  },

  pump: {
    principle:
      "Adds hydraulic energy. Power is flow times head divided by efficiency — nothing about the water changes except its pressure.",
    whenToUse: ["Anywhere head must be added and you want that energy to appear in the balance."],
    whenNotToUse: ["Where the head is already accounted for inside another unit's model, or you will double count."],
    designRules: [
      {
        rule: "Efficiency matters more than it looks.",
        why: "Power scales inversely with efficiency. A pump at 0.55 instead of 0.75 uses 36 % more energy for the same duty, every hour, for twenty years.",
      },
      {
        rule: "Size on the design flow including recycles, not on the product flow.",
        why: "The classic under-sizing error. A pump feeding a unit that has a recycle returning to its suction must carry both.",
      },
    ],
    keyNumbers: [
      { param: "Efficiency", typical: "0.65–0.80", why: "Large pumps at the top of the band, small ones below it." },
      { param: "Head", typical: "site specific", why: "Static lift plus friction plus the pressure required by the downstream unit." },
    ],
    failureModes: [
      { mode: "Cavitation", symptom: "Noise, vibration, impeller damage", prevention: "Adequate NPSH available above NPSH required." },
      { mode: "Running off-curve", symptom: "Poor efficiency, high energy bill", prevention: "Match the pump to the actual duty, not the nameplate maximum." },
    ],
  },

  product: {
    principle:
      "Terminates a stream as a plant product. Everything reaching a product outlet counts toward overall recovery.",
    whenToUse: ["On every stream that leaves the plant as useful water."],
    whenNotToUse: ["On a stream you actually discard — that is a waste outlet, and mislabelling it inflates your recovery."],
    designRules: [
      {
        rule: "Every stream must terminate somewhere.",
        why: "A stream left unconnected simply vanishes from the balance. Recovery will look better than it is, and the closure check is what will catch you.",
      },
    ],
    keyNumbers: [],
    failureModes: [
      { mode: "Overstated recovery", symptom: "Water balance closure error above zero", prevention: "Connect every outlet, then check the closure figure on the results page." },
    ],
  },

  waste: {
    principle: "Terminates a stream as effluent or solid waste. Waste flows are summed for the effluent table.",
    whenToUse: ["On reject, backwash blowdown, sludge, regeneration effluent and process losses."],
    whenNotToUse: ["On a stream that is genuinely recycled — route it back instead, or you will understate recovery."],
    designRules: [
      {
        rule: "Ask whether each waste stream really has to be waste.",
        why: "Filter backwash and thickener supernatant are mostly clean water. Recycling them is usually the cheapest route to a higher recovery — cheaper per point than pushing membrane recovery, and with far less risk.",
      },
    ],
    keyNumbers: [],
    failureModes: [
      { mode: "Missed recovery opportunity", symptom: "Recovery below target while sending clean backwash to drain", prevention: "Review every waste stream before accepting the recovery figure." },
    ],
  },
};

export function knowledgeFor(type: string): UnitKnowledge | undefined {
  return KNOWLEDGE[type];
}
