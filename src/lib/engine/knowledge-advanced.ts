import { UnitKnowledge } from "./knowledge";

/**
 * Knowledge entries for the high-strength wastewater units.
 *
 * The reference points are the seventeen leachate plants delivered by Wuhan
 * City Environment Protection between 2012 and 2022 and the Bantargebang IPAS 2
 * engineering analysis. Where a number came from one of those it says so, and
 * where it is a textbook figure it says that instead.
 */
export const ADVANCED_KNOWLEDGE: Record<string, UnitKnowledge> = {
  feedsource: {
    principle:
      "Not a machine. It is the drawing's statement of what water you are treating, placed where the water enters so that the flowsheet reads the way the plant runs. Everything downstream is sized from what is written here, which makes it the single most consequential block on the canvas and the one with no moving parts.",
    whenToUse: [
      "On every flowsheet. A drawing that does not say what it is treating is a drawing of nothing in particular.",
    ],
    whenNotToUse: [
      "As a way to model two different waters. There is one feed specification per study; blending two sources is a design question that deserves its own study, not a second block.",
    ],
    designRules: [
      {
        rule: "Enter what the laboratory reported, not what you wish it had reported.",
        why: "Every assumption you make here propagates silently through the whole balance. Entering a guessed value is not neutral — it looks exactly like a measurement to everyone who reads the output afterwards, including you in three months.",
      },
      {
        rule: "Leave unmeasured parameters blank rather than zero.",
        why: "Blank means not analysed. Zero means analysed and found absent. The two lead to completely different conversations with the client, and only one of them is honest.",
      },
      {
        rule: "Check the ionic balance before trusting anything downstream.",
        why: "Water is electrically neutral. If the cations and anions do not agree within a few percent, the analysis is not internally valid and every figure derived from it inherits the error.",
      },
    ],
    keyNumbers: [
      { param: "Ionic balance error", typical: "within ±5 %", why: "Beyond that a major ion is missing or misreported — chloride most often, because it falls outside the standard Indonesian sampling set." },
      { param: "TDS to conductivity", typical: "0.55–0.90 mg/L per µS/cm", why: "A cheap cross-check on a reported TDS, and the fastest way to catch a transcription error." },
    ],
    failureModes: [
      { mode: "Single sample used as the design basis", symptom: "Plant meets its guarantee in the month it was commissioned and fails in the dry season", prevention: "Ask for the seasonal range, and if it does not exist, state the design basis explicitly in the report." },
      { mode: "Assumption entered as data", symptom: "Nobody downstream can tell which figures were measured", prevention: "Leave it blank and let the validator flag it, rather than filling the gap with something plausible." },
    ],
    downstream: "Whatever the water meets first — an intake, a screen, or an equalisation basin.",
  },

  "intake-plain": {
    principle:
      "Abstraction and lifting, nothing else. A pump takes water from the source and delivers it to the plant at the head the process needs. Nothing is removed, and that is the point of having this block rather than the screened one: it does not credit you with a removal you are not providing.",
    whenToUse: [
      "Where the screening structure belongs to the client, or already exists, or sits in a separate contract.",
      "Where the source is already treated or protected — a municipal supply, a settled reservoir draw-off, an existing balancing tank.",
      "Where you are pumping between stages rather than abstracting from the environment.",
    ],
    whenNotToUse: [
      "On an open, unprotected surface abstraction. Debris will reach the pumps, and a screen that is nobody's scope is a screen that does not get built.",
    ],
    designRules: [
      {
        rule: "State in the proposal who provides the screening.",
        why: "A boundary that is obvious to you while drawing it is invisible in a tender document. This is one of the most common scope disputes on a water project, and it is settled with one sentence written early.",
      },
      {
        rule: "Size the head on the worst case, not the normal case.",
        why: "The static lift is set by the lowest water level in the source, which occurs in the same season as the highest demand.",
      },
    ],
    keyNumbers: [
      { param: "Pump efficiency", typical: "0.70–0.80", why: "Below 0.65 either the duty point is wrong or the pump is worn." },
      { param: "Standby", typical: "1 x 100 %", why: "An intake that stops stops the plant. This is the one duty where a standby is rarely questioned." },
    ],
    failureModes: [
      { mode: "Debris at the pumps", symptom: "Blocked suction, tripped motors, damaged impellers", prevention: "Confirm that someone is screening upstream, and confirm it in writing." },
      { mode: "Low water level", symptom: "Cavitation and loss of duty in the dry season", prevention: "Design the suction on the recorded minimum level, not the level on the day you visited." },
    ],
    downstream: "Equalisation, coagulation, or directly into treatment.",
  },

  outfall: {
    principle:
      "The point where treated water leaves the plant. It has no settings because there is nothing to decide: it counts as product in the water balance, so recovery includes whatever passes through it.",
    whenToUse: [
      "Treated effluent to a river, sea or drain.",
      "Product to a distribution network or a client's battery limit, where naming the product type adds nothing.",
    ],
    whenNotToUse: [
      "For reject, backwash, sludge or regeneration effluent. Those are waste, and routing them here would count them as product and inflate the recovery — the one number everybody reads.",
    ],
    designRules: [
      {
        rule: "One outfall per discharge consent, not one per pipe.",
        why: "The consent is what is monitored and what is enforced. Drawing the flowsheet the way the permit is written makes the compliance check match the obligation.",
      },
      {
        rule: "Check what the receiving water requires before assuming the effluent is acceptable.",
        why: "Meeting a discharge standard is not the same as meeting the river's class limits under PP 22/2021. Which applies depends on where the pipe ends.",
      },
    ],
    keyNumbers: [],
    failureModes: [
      { mode: "Waste routed to an outfall", symptom: "Recovery looks excellent and the balance still closes", prevention: "Use the Waste Outlet block for anything that is not the plant's product. The balance cannot tell you what you meant." },
    ],
    upstream: "The last treatment step, and normally a monitoring point.",
  },

  phadjust: {
    principle:
      "A stirred tank with a reagent pump and a pH controller. Nothing is removed; the chemistry of what is already dissolved is changed. That sounds trivial and it is not, because pH decides the form a substance takes, and the form decides whether the next unit can remove it. Ammonia at pH 11 is a dissolved gas that a stripping tower can blow out; the same ammonia at pH 7 is an ion that a membrane can reject. The same nitrogen, two completely different removal routes, chosen with a dosing pump.",
    whenToUse: [
      "Ahead of ammonia stripping, to convert ammonium into free ammonia. Nothing else in the train matters if this step is missing.",
      "Ahead of any membrane, to bring the water back to pH 6.5-7 so that ammonia is an ion again and gets rejected.",
      "On reverse osmosis permeate before discharge. Carbon dioxide passes the membrane and the alkalinity that would buffer it does not, so RO permeate is acidic and will fail a pH 6-9 limit on its own.",
      "Before coagulation, where the coagulant has a narrow optimum: PAC and alum work at pH 6-7 and lose most of their effectiveness outside it.",
    ],
    whenNotToUse: [
      "As a way of meeting a discharge pH limit while the real problem is elsewhere. Neutralising an effluent that fails on COD does not make it compliant, it makes it neutral.",
      "With lime, immediately upstream of a membrane. Lime adds calcium, and calcium is what scales the membrane you are feeding.",
      "Where the water has almost no buffering. On a soft water the controller will hunt and overshoot; add a buffer or accept a wider band.",
    ],
    designRules: [
      {
        rule: "Size the reagent from a titration curve, never from the pH difference.",
        why: "pH is a logarithm of concentration, not a quantity of anything. Two waters at the same pH can need doses that differ a hundredfold. The only honest way to size the dose is to titrate the actual water in a beaker and read off how much reagent moves it to the target.",
      },
      {
        rule: "On a high-ammonia water, expect ammonium to dominate the alkali demand.",
        why: "Every mole of NH4+ that has to become NH3 consumes a mole of hydroxide. At 5000 mg/L of ammoniacal nitrogen that is roughly 340 milliequivalents per litre, against perhaps 100 from the carbonate system. An engineer who sizes the caustic from alkalinity alone will order a quarter of what the plant needs.",
      },
      {
        rule: "Lime is cheaper per equivalent; caustic is cleaner per equivalent.",
        why: "Hydrated lime costs a fraction of caustic soda for the same neutralising power, which on a 20 t/d duty is a large number. But it arrives as a slurry, it needs slaking and handling, it adds calcium to the water, and it leaves sludge. Whether that trade is worth taking depends entirely on what is downstream.",
      },
      {
        rule: "Allow 10-20 % excess over the stoichiometric demand.",
        why: "The controller sees the pH after mixing, so it is always correcting a condition that has already passed. Without margin the plant sits below target whenever the load moves.",
      },
    ],
    keyNumbers: [
      { param: "Reaction time", typical: "15-30 min", why: "Long enough for the reagent to disperse and the pH probe to read a settled value. Shorter and the controller chases its own tail." },
      { param: "Mixing intensity", typical: "30-60 W/m3", why: "Enough to keep the tank uniform. Acid-base reactions are instantaneous; the time is for mixing, not for chemistry." },
      { param: "Caustic demand, leachate to pH 11", typical: "300-500 meq/L", why: "Dominated by the ammonium. Translates to roughly 12-20 kg NaOH per m3 of leachate, which is normally the largest single operating cost in the plant." },
      { param: "Dosing excess", typical: "10-20 %", why: "Covers control lag and the error in reading a titration curve." },
      { param: "Alkalinity per mg NH4-N nitrified", typical: "7.14 mg as CaCO3", why: "The stoichiometry of nitrification. It is why a biological plant on a high-ammonia water often needs alkali dosing even when nobody planned for it." },
    ],
    failureModes: [
      { mode: "Under-ordered reagent", symptom: "Plant never reaches target pH; ammonia removal far below design", prevention: "Titrate the real water. Include the ammonium term explicitly in the calculation." },
      { mode: "Overshoot and hunting", symptom: "pH oscillating either side of setpoint, reagent consumption far above theory", prevention: "Two-stage dosing (coarse then trim), adequate mixing, probe positioned where the water is mixed." },
      { mode: "Scaling in the dosing line", symptom: "Blocked injection quill, dosing pump running against a closed line", prevention: "Injection into a turbulent zone, flushing connection, and lime slurry lines sized for velocity not for pressure drop." },
      { mode: "Precipitate carried downstream", symptom: "Suspended solids rising across a unit that removes nothing", prevention: "Expect magnesium hydroxide above pH 10.5 and provide somewhere for it to settle or be filtered." },
    ],
    upstream: "Equalisation, so the reagent controller sees a steady load rather than a moving one.",
    downstream: "Whatever needed the pH changed: a stripping tower, a membrane, a coagulation stage.",
    ccepcNote:
      "Every CCEPC leachate plant has at least two of these, and they are usually drawn as a single small box on a flowsheet. On the Bantargebang analysis the caustic and acid together come to over 40 t/d, which is more operating cost than the membranes and the evaporator combined.",
  },

  nh3strip: {
    principle:
      "Water falls through a packed tower while air is blown up against it. Ammonia that is present as the dissolved gas NH3 transfers into the air and leaves; ammonium ions, being charged, cannot. The whole design therefore rests on one number: what fraction of the ammonia is in the free form. That fraction comes from pH and temperature through the dissociation constant, and at pH 7 it is under 1 per cent while at pH 11 it is 98 per cent. Raise the pH and the same water becomes strippable.",
    whenToUse: [
      "Ammoniacal nitrogen above roughly 500 mg/L, where biological nitrification would need an impossible amount of oxygen and alkalinity.",
      "Old landfill leachate, where the carbon needed for denitrification simply is not present and the biological route cannot close.",
      "Warm climates. The free ammonia fraction rises with temperature, so a tropical site strips far more cheaply than a temperate one.",
      "Where land is tight. The tower is tall and narrow relative to a biological basin, though not as small as it first appears.",
    ],
    whenNotToUse: [
      "Without an acid scrubber on the off-gas. Stripping without capture does not treat the ammonia, it moves it into the air, and in most jurisdictions that is not permittable.",
      "Where most of the nitrogen is organic. Only ammonia strips; organic nitrogen passes straight through and sets a floor no air ratio can break.",
      "On cold water without heating. Below about 15 degC the economics collapse.",
      "Where scaling is likely and no softening is provided. At pH 11 calcium carbonate and magnesium hydroxide precipitate onto the packing, and a fouled tower loses its transfer area.",
    ],
    designRules: [
      {
        rule: "The tower diameter is set by the air, not by the water.",
        why: "At an air-to-water ratio of 3000, the gas flow is three thousand times the liquid flow. Keeping the superficial gas velocity below about 2 m/s then demands ten times the cross-section that the liquid loading would suggest. Sizing from the water flow alone produces a tower that floods on the day it starts.",
      },
      {
        rule: "Raise the pH above 10.5, and check it, before believing any removal figure.",
        why: "At pH 10 the free fraction is about 85 %; at pH 9 it is 35 %. The blower power is the same in all three cases. Stripping at the wrong pH is the most expensive way to move air there is.",
      },
      {
        rule: "Provide for scaling from the first day.",
        why: "You have deliberately created the exact conditions under which calcium carbonate precipitates. Either soften ahead of the tower, or accept an acid-wash cycle and design the packing so it can be washed in place.",
      },
      {
        rule: "Treat the ammonium sulphate as a liability until an offtake is signed.",
        why: "A plant producing 25 t/d of fertiliser needs a buyer, a store, a loading arrangement and a matching acid supply chain. Counted as revenue in a feasibility study and then unsold, it becomes a hazardous waste with a disposal cost.",
      },
    ],
    keyNumbers: [
      { param: "Air-to-water ratio", typical: "2000-4000 m3/m3", why: "Sets both removal and blower power. CCEPC designs leachate towers at 3000. Below 1500 the removal falls away; above 4000 the extra air buys very little." },
      { param: "Operating pH", typical: "10.5-11.5", why: "Puts 95-99 % of the ammonia in the strippable free form. This is the single most sensitive parameter in the unit." },
      { param: "Superficial gas velocity", typical: "1.5-2.5 m/s", why: "Above about 3 m/s the upward air holds the water up and the packing floods. This governs the diameter." },
      { param: "Packing height", typical: "6-12 m", why: "More height means more transfer units and better removal, at the cost of pumping the water to the top of it." },
      { param: "Packing pressure drop", typical: "1000-2000 Pa", why: "Multiplied by a very large air flow, this is the blower power and therefore most of the running cost." },
      { param: "Removal achieved", typical: "85-95 % of NH3-N", why: "Of the free ammonia. Total nitrogen falls by less, because organic nitrogen is untouched." },
      { param: "Acid demand", typical: "3.5 kg H2SO4 per kg N", why: "From the stoichiometry: two moles of ammonia per mole of sulphuric acid." },
      { param: "Fertiliser produced", typical: "4.7 kg (NH4)2SO4 per kg N", why: "The same stoichiometry, on the product side." },
    ],
    failureModes: [
      { mode: "Insufficient pH", symptom: "Removal far below design at the correct air ratio", prevention: "Continuous pH measurement at the tower inlet, interlocked to the caustic dosing." },
      { mode: "Scaling of the packing", symptom: "Rising pressure drop, falling removal, water channelling down one side", prevention: "Softening upstream or a routine acid clean; random packing that can be removed and washed." },
      { mode: "Flooding", symptom: "Water carried up the tower, liquid at the fan, violent pressure fluctuation", prevention: "Size the diameter on gas velocity, and check it again at the maximum design flow." },
      { mode: "Ammonia release", symptom: "Odour complaints and an air-quality violation while the water analysis looks excellent", prevention: "Acid scrubber with its own pH control, sized for the full stripped load and not for the average." },
      { mode: "Fertiliser with no buyer", symptom: "Ammonium sulphate accumulating on site", prevention: "Secure the offtake before the plant is built, or plan to recycle the scrubber liquor back into the process." },
    ],
    upstream: "Alkali dosing to pH 11. Ideally a solids removal step too, because the tower will otherwise blind.",
    downstream: "Neutralisation back to pH 7, without exception, before any membrane or biological stage.",
    ccepcNote:
      "The Bantargebang analysis sizes this at an air-to-water ratio of 3000 on 1200 m3/d, giving roughly 150,000 m3/h of air and a tower whose diameter is set entirely by that air flow.",
  },

  aombr: {
    principle:
      "Ammonia removal and nitrogen removal are different jobs, and a single aerated tank only does the first. Nitrifiers oxidise ammonium to nitrate, which is still nitrogen and still counts against a total-nitrogen consent. Getting rid of it needs the opposite condition: no oxygen, and carbon to donate electrons, so that bacteria use nitrate as their oxidant and release it as nitrogen gas. An A/O reactor supplies both by putting an unaerated anoxic zone in front of the aerated one and pumping mixed liquor backwards from the aerated zone into it. The feed enters the anoxic zone, so its raw carbon meets the returned nitrate before any of it has been aerated away.",
    whenToUse: [
      "Where the consent is written on total nitrogen rather than on ammonia. This is the whole reason the configuration exists.",
      "Where the feed has carbon to spare. Denitrification is free treatment paid for with BOD that would otherwise have cost oxygen to destroy.",
      "Where alkalinity is tight. Denitrification returns half the alkalinity that nitrification consumed, and on a high-ammonia water that is often the difference between holding pH and stalling.",
      "Where the aeration bill matters. Each kg of nitrate nitrogen reduced saves 2.86 kg of oxygen the blowers would have supplied.",
    ],
    whenNotToUse: [
      "Where the consent is on ammonia only. The anoxic zone, the mixers and the recycle pumps are all cost for a parameter nobody measures.",
      "Where BOD:TN is below about 3 and no cheap carbon is available. The methanol bill will exceed the cost of stripping the ammonia off instead.",
      "Where the nitrogen is mostly ammoniacal and very concentrated, as in a young leachate. Stripping or anammox beats conventional denitrification well before 1000 mg/L.",
      "As a way to reach a very low total nitrogen with a modest recycle. The R/(1+R) ceiling is arithmetic, not engineering, and no operational skill moves it.",
    ],
    designRules: [
      {
        rule: "The recycle ratio, not the tank volume, sets the ceiling on nitrogen removal.",
        why: "Nitrate is made in the oxic zone and destroyed in the anoxic zone, so only the nitrate that is pumped back can be destroyed. With a recycle of R times the feed, the best achievable is R/(1+R) of what was nitrified: 75 % at R=3, 80 % at R=4, 83 % at R=5. Adding volume to a plant that is recycle-limited changes nothing at all.",
      },
      {
        rule: "Stop increasing the recycle at about 5Q.",
        why: "The ceiling improves by three points between R=4 and R=5 and by two more between R=5 and R=8, while pumping power rises in proportion to R the whole way. Worse, the recycle carries dissolved oxygen into the anoxic zone, and every mg/L of it destroys a mg/L of BOD that the nitrate needed. Past 5Q the extra nitrate delivered is worth less than the carbon destroyed delivering it.",
      },
      {
        rule: "Check BOD:TN before believing any nitrogen removal figure.",
        why: "About 4 kg of BOD is consumed per kg of nitrate nitrogen reduced, 2.86 by stoichiometry and the rest going into cell synthesis. Below a ratio of 4 the water cannot denitrify itself and external carbon becomes an operating cost that runs for the life of the plant.",
      },
      {
        rule: "Size the anoxic zone at 25-40 % of the total volume.",
        why: "Below 20 % there is not enough contact time to reduce the nitrate arriving in the recycle, so the recycle is pumped for nothing. Above 45 % the oxic zone runs short, and nitrification is the slower of the two reactions, so the plant then fails on ammonia instead of on nitrate.",
      },
      {
        rule: "Mix the anoxic zone, do not aerate it, and do not let the mixer entrain air.",
        why: "The sludge has to stay suspended or the zone becomes a settling tank, but any oxygen introduced is consumed in preference to nitrate and defeats the purpose. Submersible mixers at 5-8 W/m3 do the job; a coarse-bubble system does not.",
      },
      {
        rule: "Count the alkalinity net of what denitrification returns.",
        why: "Nitrification consumes 7.14 mg of alkalinity as CaCO3 per mg of nitrogen and denitrification returns 3.57. Designing the alkali dosing on the gross figure over-orders the caustic by half on a plant that denitrifies well, and designing it on the net figure without checking the recycle under-orders it when the plant does not.",
      },
    ],
    keyNumbers: [
      { param: "Mixed liquor recycle", typical: "3-5 x Q", why: "Sets the ceiling R/(1+R) at 75-83 %. The single most consequential number in the configuration." },
      { param: "Anoxic volume fraction", typical: "25-40 %", why: "Enough contact time for the returned nitrate without starving nitrification of oxic volume." },
      { param: "BOD per nitrate-N", typical: "4.0 kgBOD/kgN", why: "2.86 by electron stoichiometry; the balance goes into cell synthesis. Use 3.0 kg methanol per kg N when carbon is dosed." },
      { param: "SDNR", typical: "0.04-0.10 kgN/kgMLSS.d", why: "The anoxic zone's loading check, as F/M is the oxic zone's. Above 0.12 the zone is undersized for its nitrate load." },
      { param: "Oxygen credit", typical: "2.86 kgO2/kgN denitrified", why: "Real saving on the blowers, typically 10-20 % of process aeration. Frequently left out of energy estimates." },
      { param: "Alkalinity returned", typical: "3.57 mg CaCO3 per mg N", why: "Exactly half what nitrification consumed. On a high-ammonia water this is what keeps the pH up." },
      { param: "DO in the recycle", typical: "under 1 mg/L", why: "Each mg/L costs a mg/L of BOD. At R=4 a DO of 2 wastes 8 mg/L of carbon, worth about 2 mg/L of nitrate nitrogen." },
    ],
    failureModes: [
      { mode: "Recycle-limited nitrogen", symptom: "Ammonia low, nitrate high, total nitrogen failing while every biological indicator looks healthy", prevention: "Compute R/(1+R) at design. If the target exceeds it, the answer is more recycle or a second anoxic stage, never more tank." },
      { mode: "Carbon starvation", symptom: "Nitrate breaking through, especially at low load or after rain", prevention: "Check BOD:TN at minimum strength, not average. Provide for carbon dosing even if it is not used." },
      { mode: "Oxygen in the recycle", symptom: "Denitrification worse than predicted despite ample recycle and carbon", prevention: "Lower the oxic DO set point to 1.5-2 mg/L, and draw the recycle from the end of the oxic zone rather than mid-tank." },
      { mode: "Anoxic zone settling", symptom: "Solids accumulating in the anoxic zone, MLSS falling in the oxic zone", prevention: "Mixer power at 5-8 W/m3 and a mixing pattern verified, not assumed." },
      { mode: "Alkalinity exhaustion", symptom: "pH falling, nitrification stalling, ammonia rising while nitrate falls", prevention: "Net alkalinity balance at design; alkali dosing provided and pH alarmed." },
    ],
    upstream: "Fine screening to 1-3 mm, grease removal, and equalisation. The feed must enter the anoxic zone, not the oxic one, or its carbon is aerated away before the nitrate can use it.",
    downstream: "Direct discharge, or reverse osmosis where the consent is tighter than biology can reach. The permeate carries no solids, so it is a good membrane feed.",
    ccepcNote:
      "CCEPC runs two-stage A/O plus MBR on the Qianzishan biogas slurry plant, and A/O configurations on the Baoxie and Zuoling municipal works in Wuhan. On leachate the group more often strips the ammonia first, precisely because BOD:TN is too low for the anoxic zone to pay.",
  },

  tuf: {
    principle:
      "A ultrafiltration membrane separates by pore size, and the pore size is much the same whichever way the module is built. What differs is how the cake is kept off, and that decides everything else. A tubular module keeps it off by shear: the liquor is pumped through wide channels, five to twelve millimetres across, fast enough that the wall shear strips solids as fast as they deposit. Nothing is immersed, nothing is aerated, and no part of the membrane ever sits still. That is why it will run on mixed liquor at 25,000 mg/L and on feeds carrying fibre, oil and grit that would destroy a hollow fibre in a week. The bill for it is the recirculation pump, which moves twenty to fifty times the permeate flow against the pressure drop the tubes themselves impose, continuously.",
    whenToUse: [
      "Landfill leachate. The feed carries fibre, hair and oil, the MLSS is high, and the alternative fouls irreversibly. This is why every Chinese leachate MBR uses it.",
      "Where the reactor is to run above 12,000 mg/L MLSS. A submerged membrane cannot; a tubular one can go to 25,000.",
      "Where the feed screening cannot be trusted. A tubular channel passes what would braid round a fibre bundle.",
      "Where the plant is retrofitted into an existing tank. The modules sit outside it, so the tank is not rebuilt.",
    ],
    whenNotToUse: [
      "On a clean feed. Paying 3 kWh/m3 to separate a water a submerged membrane would take at 0.3 is throwing away the difference for tolerance nobody needs.",
      "Where electricity is the dominant operating cost and the feed does not demand it.",
      "Where the crossflow cannot be maintained at part load. The velocity is what keeps it clean, so a tubular loop cannot simply be throttled.",
    ],
    designRules: [
      {
        rule: "The crossflow velocity is the design variable, and the energy follows from it.",
        why: "Pressure drop rises with the square of velocity and the pumping power with the cube. Going from 3 to 4 m/s raises the scouring by a third and the power by more than double. Below 2.5 m/s the cake is not stripped at all and the flux collapses within days, so the working window is narrow and worth getting right.",
      },
      {
        rule: "Size the recirculation from the area, not from a rule of thumb.",
        why: "The membrane area fixes how many parallel tube paths there are, the paths and the velocity fix the recirculation flow, and the path length fixes the pressure drop. Every one of those is a consequence of choices already made. Quoting a specific energy instead hides which choice is driving the bill.",
      },
      {
        rule: "Count the liquor viscosity, not water's.",
        why: "Mixed liquor at 10,000 mg/L is roughly twice as viscous as water and at 25,000 three to five times. That lowers the Reynolds number, raises the friction factor, and raises the pumping power for the same velocity. A calculation done on water understates the pump.",
      },
      {
        rule: "Do not draw the recirculation loop on the flowsheet.",
        why: "It is internal to the unit and the model already accounts for it. Drawing it makes the solver iterate the loop and count the same load twenty times over.",
      },
    ],
    keyNumbers: [
      { param: "Crossflow velocity", typical: "3-4.5 m/s", why: "Below 3 the cake is not stripped; above 4.5 the pressure drop grows faster than the benefit." },
      { param: "Channel diameter", typical: "5.2, 8, 11.5 mm", why: "The standard sizes. Wider passes more solids and costs more pumping for the same velocity." },
      { param: "Net flux", typical: "60-120 LMH on mixed liquor", why: "Four to six times a submerged membrane, because the crossflow rather than the flux controls the cake." },
      { param: "Recirculation ratio", typical: "20-50 x permeate", why: "A consequence of the area and the velocity, not an independent choice." },
      { param: "Specific energy", typical: "2-4 kWh/m3 permeate", why: "The single largest energy item on most leachate plants. Against 0.1-0.3 for a submerged membrane." },
      { param: "Feed MLSS", typical: "up to 25,000 mg/L", why: "Roughly twice what an immersed membrane tolerates, and the reason to accept the energy." },
      { param: "CIP frequency", typical: "12-52 per year", why: "More often than a submerged membrane because the feed is dirtier, but each clean is quicker." },
    ],
    failureModes: [
      { mode: "Crossflow lost at part load", symptom: "Flux falling whenever the plant runs below design flow", prevention: "Recirculate at constant velocity and vary the permeate draw, never the loop flow. Variable-speed drives on the recirculation pump are a trap unless the control keeps velocity, not flow." },
      { mode: "Laminar flow", symptom: "Rapid irreversible flux loss shortly after commissioning", prevention: "Check the Reynolds number at the design viscosity, not water's. A liquor five times as viscous can be laminar at a velocity that looks safe." },
      { mode: "Pump wear", symptom: "Recirculation flow drifting down, energy per m3 drifting up", prevention: "The loop pump handles abrasive liquor continuously. Duty and standby, and wear parts held on site." },
      { mode: "Energy ignored at tender", symptom: "Operating cost far above the bid", prevention: "Price the recirculation from the hydraulics at award, not from a catalogue specific-energy figure." },
    ],
    upstream: "Screening to 3 mm is enough, against 1 mm for a submerged membrane. Oil removal is helpful but not the absolute requirement it is for hollow fibre.",
    downstream: "Nanofiltration or reverse osmosis. Tubular UF permeate is a sound membrane feed, SDI comfortably below 3.",
    ccepcNote:
      "External tubular UF is standard on the CCEPC leachate reference plants, paired with two-stage A/O ahead of NF and RO. On Bantargebang-scale duty it is the largest single power consumer on the works.",
  },

  suf: {
    principle:
      "The opposite trade to a tubular module. The membrane hangs in the tank, permeate is drawn through it by suction at well under a bar, and the cake is kept off by coarse bubbles rising along the fibres. There is no recirculation loop and no high-pressure pump, so the energy is a fifth to a tenth of the tubular arrangement doing the same separation. What it costs is flux and tolerance: fifteen to twenty-five litres per square metre per hour against eighty, so four times the area for the same duty, and a feed that has to be screened finely because a hair braiding round a fibre bundle does damage no cleaning reverses.",
    whenToUse: [
      "Municipal sewage and any reasonably clean mixed liquor, where the tolerance a tubular module buys is not needed.",
      "Where electricity is expensive relative to capital. The area costs more and the power costs much less.",
      "Where the tank can be built to hold the membranes. The modules are part of the civil works, not a skid beside them.",
    ],
    whenNotToUse: [
      "On leachate, or any feed with fibre, hair, oil or grit. This is the failure that ends plants.",
      "Above about 12,000 mg/L MLSS. The sludge viscosity rises, the bubbles stop scouring, and the membrane fouls faster than it can be cleaned.",
      "Where the plant will spend much of its life turned down. The blower runs regardless, so half flow is not half power.",
    ],
    designRules: [
      {
        rule: "The scouring blower is the design, and it does no treatment.",
        why: "Air swept along the membrane surface only keeps solids off it. On a submerged unit it is typically eighty to ninety per cent of the module's power and it runs continuously, load or no load. Every other energy term here is a rounding error beside it.",
      },
      {
        rule: "Use the mixed-liquor flux, never the clean-water flux.",
        why: "A module rated at 60-80 LMH on clean water delivers 15-25 in mixed liquor and 8-15 on leachate. Specifying from the catalogue figure is how membrane areas end up at a third of what is needed, and it is the most common single error in MBR tendering.",
      },
      {
        rule: "Screen to 1 mm, not 3.",
        why: "Three millimetres is fine for a tubular channel and far too coarse for a fibre bundle. Hair passes a 3 mm screen, wraps the fibres, and cuts them.",
      },
      {
        rule: "Deeper membrane tanks scour better and cost more air pressure.",
        why: "The blower must overcome the static head of the tank plus the diffuser loss. The power is proportional to that pressure, so tank depth is an energy decision taken by the civil engineer.",
      },
    ],
    keyNumbers: [
      { param: "Net flux", typical: "15-25 LMH municipal, 8-15 leachate", why: "Net of relaxation and backwash. A quarter of the tubular figure, which is where the extra area comes from." },
      { param: "Scouring air", typical: "0.3-0.5 Nm3/m2.h", why: "Set by the supplier. The dominant energy term and not reducible without fouling." },
      { param: "Specific energy", typical: "0.3-0.8 kWh/m3 permeate", why: "A fifth to a tenth of tubular. This is the whole case for the arrangement." },
      { param: "Blower discharge", typical: "50-70 kPa", why: "Static head of the membrane tank plus diffuser loss." },
      { param: "MLSS ceiling", typical: "12,000 mg/L", why: "Above it the bubbles stop scouring and the fouling rate outruns the cleaning schedule." },
      { param: "Suction pressure", typical: "0.1-0.4 bar", why: "Vacuum, not pressure. Rising suction at constant flux is the fouling indicator to trend." },
      { param: "Recovery cleans", typical: "2-6 per year", why: "Hypochlorite for organic fouling, citric acid for inorganic. More often than this means something upstream is wrong." },
    ],
    failureModes: [
      { mode: "Fibre damage from screening failure", symptom: "Permeate turbidity rising, integrity test failing on one module", prevention: "1 mm screening ahead of the membrane tank, and the screen itself maintained. This is not optional." },
      { mode: "Oil fouling", symptom: "Permeability falling and not recovering after cleaning", prevention: "Oil removal upstream. If the feed will always carry oil, the arrangement is wrong and tubular is the answer." },
      { mode: "MLSS chased upward", symptom: "Fouling accelerating after a capacity increase that raised the MLSS", prevention: "Hold 12,000 as a ceiling. The apparent gain in capacity is paid for twice." },
      { mode: "Blower sized on clean-water flux", symptom: "Air per square metre correct but the total air a third of what is needed", prevention: "Set the area from the mixed-liquor flux first, then the air from the area." },
    ],
    upstream: "Screening to 1 mm, oil and grease removal, and grit removal. Everything a tubular module forgives, this one does not.",
    downstream: "Nanofiltration, reverse osmosis or direct discharge. The permeate carries no suspended solids.",
    ccepcNote:
      "Submerged membranes are CCEPC's standard on municipal duty; on leachate the group uses external tubular UF instead, and the reason is feed tolerance rather than any difference in what the membrane separates.",
  },

  mbr: {
    principle:
      "Conventional activated sludge separates biomass from water by letting it settle, which limits how much biomass the tank can hold: push the concentration too high and the clarifier fails. An MBR replaces the clarifier with a membrane immersed in the sludge, so separation no longer depends on settling. The reactor can then run at three times the biomass concentration in the same volume, the sludge age is decoupled from the hydraulic retention time, and the effluent contains no suspended solids at all because the membrane is an absolute barrier.",
    whenToUse: [
      "Where land is limited. The footprint is roughly half a conventional plant with a clarifier.",
      "Ahead of reverse osmosis. An MBR permeate is the best RO feed any biological process can produce.",
      "Where the biology is slow-growing, such as nitrification at low temperature, because a long sludge age can be held without a huge tank.",
      "Where a sludge settles badly and a conventional clarifier would never work.",
    ],
    whenNotToUse: [
      "On a water whose organic matter is refractory. An MBR removes what biology can degrade, and on an old leachate that may be only 10-20 % of the COD. The membrane does not change that; it only guarantees the solids.",
      "Where the operator cannot maintain a membrane. Chemical cleaning is a routine that has to actually happen.",
      "Where the feed carries oil, grease or fibre that has not been removed. These foul irreversibly.",
      "As a way to reach a nitrogen limit without carbon. Nitrification needs oxygen and alkalinity; denitrification needs carbon. An MBR supplies neither.",
    ],
    designRules: [
      {
        rule: "Design the flux for the water, not for the catalogue.",
        why: "A clean-water UF module runs at 60-80 LMH. The same module in mixed liquor runs at 15-25, and on a leachate at 8-15. The difference is the cake layer, and it is not optional.",
      },
      {
        rule: "Scouring air, not process air, is what makes an MBR expensive.",
        why: "Air is blown continuously along the membrane surface to keep solids from settling on it. That air does no treatment at all. On a typical MBR it is a third to a half of the total power, and it runs whether or not there is load.",
      },
      {
        rule: "Check the alkalinity balance before believing the ammonia removal.",
        why: "Nitrification consumes 7.14 mg of alkalinity as calcium carbonate for every mg of ammoniacal nitrogen oxidised. On a high-ammonia water the alkalinity runs out, the pH falls, nitrification stops, and the plant fails on ammonia while every biological indicator looks normal.",
      },
      {
        rule: "Do not exceed about 12,000 mg/L MLSS.",
        why: "Above that the sludge viscosity rises sharply, oxygen transfer efficiency collapses, and the membrane fouls faster than it can be cleaned. The apparent gain in capacity is paid for twice.",
      },
    ],
    keyNumbers: [
      { param: "MLSS", typical: "8,000-12,000 mg/L", why: "Three times a conventional plant. This is the reason the tank is small." },
      { param: "Net flux", typical: "15-25 LMH municipal, 8-15 leachate", why: "Net of backwash and relaxation. Quoting gross flux overstates the capacity by 10-15 %." },
      { param: "Scouring air", typical: "0.3-0.5 Nm3/m2.h", why: "Set by the membrane supplier. It is the dominant energy term and cannot be reduced without fouling." },
      { param: "Sludge age", typical: "20-40 d", why: "Long enough for nitrifiers, which grow slowly. Decoupled from HRT, which is the second reason an MBR is compact." },
      { param: "Oxygen transfer efficiency", typical: "1.2 kgO2/kWh at high MLSS", why: "Against 2.5-3 in clean municipal sludge. Thick, saline liquor transfers oxygen badly, and designing on the clean figure undersizes the blowers by half." },
      { param: "Sludge yield", typical: "0.2-0.35 kgVSS/kgBOD", why: "Lower than conventional activated sludge because the long sludge age lets the biomass digest itself." },
      { param: "Recovery cleans", typical: "2-6 per year", why: "Hypochlorite for organic fouling, citric or oxalic acid for inorganic. More often than this means something upstream is wrong." },
    ],
    failureModes: [
      { mode: "Irreversible fouling", symptom: "Permeability falling and not recovering after cleaning", prevention: "Screening to 1-3 mm, oil removal, and cleaning on schedule rather than on symptom." },
      { mode: "Alkalinity exhaustion", symptom: "pH drifting down, ammonia breaking through, nitrate not rising", prevention: "Alkalinity balance at design, alkali dosing provided, pH alarmed." },
      { mode: "Sludge bulking", symptom: "Viscosity rising, membrane fouling accelerating", prevention: "Control the F/M ratio and the dissolved oxygen; do not chase capacity with MLSS." },
      { mode: "Screening failure", symptom: "Hair and fibre braiding around hollow fibres, torn membranes", prevention: "A fine screen ahead of the membrane tank is not optional, and 3 mm is not fine enough for hollow fibre." },
      { mode: "Assumed COD removal", symptom: "Effluent COD far above prediction on an old leachate", prevention: "Measure BOD:COD. If it is below 0.15 the COD is refractory and no biological process will remove it." },
    ],
    upstream: "Fine screening, oil removal, and pH correction to 6.5-7.5.",
    downstream: "Reverse osmosis or DTRO. MBR permeate is a good membrane feed, but it is not a dischargeable effluent on a refractory water.",
    ccepcNote:
      "CCEPC has MBR on leachate at Zhongshan (300 m3/h, MBR + NF + RO), Jiyuan (180 m3/d, MBR + RO) and Wuhan Shenneng (330 t/d, anaerobic + MBR + membrane), plus two-stage AO + MBR on the Qianzishan biogas slurry plant.",
  },

  anaerobic: {
    principle:
      "Bacteria break organic matter down in the absence of oxygen, ending in methane and carbon dioxide. Nothing has to be aerated, so the largest energy cost of biological treatment disappears, and the process returns a fuel instead of consuming power. In a UASB the biomass forms dense granules that settle against the upward flow, which is what allows a very high biomass concentration in a simple tank with no mechanical parts inside it.",
    whenToUse: [
      "COD above roughly 2000 mg/L. Below that the methane does not repay the reactor.",
      "As the first biological step on leachate, distillery, food or coking wastewater — which is exactly where CCEPC puts it, in thirteen of its seventeen leachate plants.",
      "Where sludge disposal cost matters. Anaerobic yield is roughly a tenth of aerobic.",
      "Warm wastewater. A tropical leachate needs no heating at all, which removes the main operating cost of digestion in a temperate country.",
    ],
    whenNotToUse: [
      "As the last biological step. Anaerobic effluent still carries substantial COD and all of the nitrogen; something aerobic has to follow.",
      "On dilute wastewater, where the reactor is large and the gas is negligible.",
      "Where sulphate is high relative to COD. Sulphate reducers outcompete methanogens, and you get hydrogen sulphide instead of methane — an odour, corrosion and gas-cleaning problem in one.",
      "Immediately before a membrane on a high-nitrogen water. Anaerobic treatment mineralises organic nitrogen into ammonium, so it raises the ammonia load rather than lowering it.",
    ],
    designRules: [
      {
        rule: "Size on organic loading rate, not on retention time.",
        why: "On strong wastewater the volume needed to keep the loading within what the biomass can process is far larger than the volume needed for a nominal HRT. Whichever is larger governs, and on leachate it is almost always the loading.",
      },
      {
        rule: "Check the COD to sulphate ratio before committing.",
        why: "Below about 10 the sulphate reducers take a large share of the substrate. The methane yield falls, the gas needs treating for hydrogen sulphide, and the concrete and steel start corroding.",
      },
      {
        rule: "Control the upflow velocity.",
        why: "Too low and the granules are not fluidised, so short-circuiting begins. Too high and the granules wash out and the reactor loses its biomass, which takes months to recover.",
      },
      {
        rule: "Decide what happens to the gas before designing the reactor.",
        why: "Biogas is only a credit if something on site can burn it. On a landfill with a waste-to-energy plant that is easy; on a standalone plant it is flared, and the energy saving is only the aeration you avoided.",
      },
    ],
    keyNumbers: [
      { param: "Organic loading rate", typical: "4-12 kgCOD/m3.d UASB, 10-25 EGSB", why: "Set by how much substrate the granular biomass can turn over. This normally fixes the volume." },
      { param: "Upflow velocity", typical: "0.5-1.5 m/h UASB, 4-10 EGSB", why: "Fluidises the sludge bed without washing it out." },
      { param: "COD removal", typical: "65-85 %", why: "Higher on readily degradable wastewater, much lower on refractory leachate." },
      { param: "Methane yield", typical: "0.28-0.32 Nm3/kgCOD removed", why: "The theoretical maximum is 0.35 at standard conditions; the rest dissolves or goes to biomass." },
      { param: "Methane heating value", typical: "9.97 kWh/Nm3", why: "Converts the gas into a comparable energy figure." },
      { param: "Sludge yield", typical: "0.05-0.1 kgVSS/kgCOD", why: "An order of magnitude below aerobic. Little sludge is the second reason to choose anaerobic treatment." },
      { param: "Free ammonia inhibition", typical: "above ~100 mg/L NH3", why: "Methanogens stall. On a high-ammonia leachate this constrains how high the pH may drift." },
    ],
    failureModes: [
      { mode: "Granule washout", symptom: "Suspended solids in the effluent, gas production collapsing", prevention: "Upflow velocity control and a properly designed gas-liquid-solid separator at the top." },
      { mode: "Sulphide poisoning", symptom: "Gas smells, methane fraction falls, concrete and steel corroding", prevention: "Check COD:SO4 at design; provide gas desulphurisation if it is marginal." },
      { mode: "Ammonia inhibition", symptom: "Volatile fatty acids accumulating, pH falling, reactor souring", prevention: "Hold the pH down so that ammonia stays ionised; consider stripping ahead of the reactor." },
      { mode: "Overloading after a shutdown", symptom: "Acidification, weeks or months to recover", prevention: "Ramp the load back slowly. Methanogens grow slowly and cannot be hurried." },
    ],
    upstream: "Equalisation and solids removal. Some plants add a conditioning tank to correct pH and nutrients first.",
    downstream: "An aerobic stage, almost always. In the CCEPC leachate train it is two-stage A/O, then UF, NF and RO.",
    ccepcNote:
      "The standard CCEPC leachate train is pretreatment conditioning tank, anaerobic, two-stage A/O, UF, NF, RO. It appears in that form at Wuhan South (1500 m3/d), Qianzishan phase II (500 m3/d), Heze Jinjiang (210 m3/d) and Mianyang (400 m3/d).",
  },

  baf: {
    principle:
      "A submerged bed of granular or floating media, aerated from below. Biomass grows on the media as a film while the bed simultaneously filters the suspended solids, so a single vessel does the work of an aeration tank and a clarifier. Because the biomass is attached rather than suspended, nothing has to settle and the footprint is small.",
    whenToUse: [
      "As a tertiary or polishing stage after a main biological process.",
      "Where land is severely constrained and a clarifier will not fit.",
      "Where the load varies: attached biomass is far more resilient to shock than suspended sludge.",
      "In two stages, the first removing carbon and the second nitrifying, which is how CCEPC configured it at Qianzishan.",
    ],
    whenNotToUse: [
      "On high suspended solids. The bed filters as well as it treats, so solids consume the run length directly and the backwash frequency becomes unworkable.",
      "As the primary treatment of a strong wastewater. The volumetric loading it can take is limited.",
      "Where backwash handling has not been provided for. A BAF produces a large, dirty, intermittent backwash that has to go somewhere.",
    ],
    designRules: [
      {
        rule: "Separate the carbon stage from the nitrifying stage.",
        why: "Heterotrophs grow far faster than nitrifiers and will outcompete them wherever organic carbon remains. Removing the carbon first is what lets the second stage nitrify at all.",
      },
      {
        rule: "Design the backwash before designing the filter.",
        why: "The backwash is 3-8 % of throughput, arrives all at once, and carries the solids the bed has captured. Without a buffer tank and a return route it destabilises whatever is upstream.",
      },
      {
        rule: "Watch the volumetric load, not just the filtration rate.",
        why: "The hydraulic rate sets the area; the organic load per unit volume sets whether the biofilm can process what arrives. Exceed the second and the bed blinds however generous the first looks.",
      },
    ],
    keyNumbers: [
      { param: "Filtration rate", typical: "2-6 m/h", why: "Balances contact time against footprint." },
      { param: "Media depth", typical: "2-4 m", why: "Enough biofilm surface without an unreasonable head loss or backwash demand." },
      { param: "Volumetric BOD load", typical: "1.5-4 kgBOD/m3.d carbon stage, 0.3-1 nitrifying", why: "Nitrifiers are slow, so the nitrifying stage is loaded far more gently." },
      { param: "Process air ratio", typical: "5-20 m3/m3", why: "Higher than a suspended-growth system because oxygen has to diffuse into a film." },
      { param: "Backwash water", typical: "3-8 % of throughput", why: "Recycled to the head of the works, so it reduces net plant capacity by the same amount." },
    ],
    failureModes: [
      { mode: "Bed blinding", symptom: "Head loss rising quickly, run time falling to hours", prevention: "Solids removal upstream, and a realistic volumetric load." },
      { mode: "Media loss", symptom: "Media in the effluent or the backwash", prevention: "Correct backwash rate and a nozzle floor that is actually maintained." },
      { mode: "Nitrification failure", symptom: "Ammonia passing while COD looks fine", prevention: "Separate stages; check that the carbon stage is really removing the carbon." },
    ],
    upstream: "A settling, flotation or membrane step. Solids are what kill a BAF.",
    downstream: "Disinfection or discharge, or a membrane if reuse is the target.",
    ccepcNote: "Two-stage BAF on the Qianzishan organic solid waste biogas slurry plant, 700 m3/d, following MBR and electrochemical treatment.",
  },

  dtro: {
    principle:
      "The same reverse osmosis membrane chemistry as any other RO, in a completely different module. Instead of a tightly wound spiral with a thin mesh spacer, the membrane is stacked as discs on a central tension rod, and water flows across each disc in an open channel a few millimetres wide. That channel is what lets the module run on a liquid that would block a spiral element within hours. The price is packing density: far less membrane area in the same volume, and a much higher pressure to push water through it.",
    whenToUse: [
      "Landfill leachate. This is the application the module was designed for and where it has no real competitor.",
      "Any feed with high fouling potential, high suspended solids or a high SDI that has to be desalinated anyway.",
      "Concentrating a reject stream towards zero liquid discharge, where the salinity is beyond a spiral element's pressure rating.",
      "Where the plant will be operated by people who cannot guarantee perfect pretreatment.",
    ],
    whenNotToUse: [
      "On clean water. A spiral element does the same separation for a fraction of the capital and energy.",
      "Where the osmotic pressure of the feed approaches the module rating. A membrane cannot work below its own osmotic pressure, and at that point the answer is evaporation.",
      "Without neutralisation on a high-ammonia water. At high pH the ammonia is a dissolved gas and passes the membrane freely.",
      "As a substitute for a biological stage. Rejecting COD into a concentrate does not destroy it; it just makes it someone else's problem in a smaller volume.",
    ],
    designRules: [
      {
        rule: "Two stages, not one, for leachate.",
        why: "A single stage at very high recovery pushes the concentrate to the scaling and pressure limit at once. Two stages in series, the first at about 75 % and the second taking its concentrate, reaches 85 % overall with each stage inside its own envelope.",
      },
      {
        rule: "Distinguish the local rejection from the system rejection.",
        why: "A vendor quotes 98.5 % system rejection at the design recovery. The membrane itself rejects more than that, because the concentration rises along the module. Enter one where the other belongs and the permeate quality will be wrong by a factor of two — in whichever direction is least convenient.",
      },
      {
        rule: "Check the osmotic pressure before choosing a recovery.",
        why: "Osmotic pressure is roughly 0.78 bar per 1000 mg/L of dissolved solids. At 85 % recovery the concentrate is 2.6 times the feed, and if that lands above the module rating the recovery is not achievable at any cost.",
      },
      {
        rule: "Budget for cleaning as an operating routine, not an event.",
        why: "DTRO on leachate is cleaned every week or two. That is normal and it is designed in; a plant that has to be shut down to clean has been designed wrongly.",
      },
    ],
    keyNumbers: [
      { param: "Operating pressure", typical: "60-120 bar", why: "Set by the osmotic pressure of a concentrated leachate plus the driving pressure. This is a high-pressure plant with the safety implications that carries." },
      { param: "Flux", typical: "8-20 LMH", why: "18 is the CCEPC leachate design figure. Similar to spiral RO, but achieved with far less area per unit volume." },
      { param: "Recovery", typical: "75-80 % single stage, 85 % over two", why: "Beyond that the concentrate salinity and the pressure both go past the module envelope." },
      { param: "Channel gap", typical: "3-6 mm open channel", why: "Two orders of magnitude more open than a spiral feed spacer. This is the whole reason the module exists." },
      { param: "COD rejection", typical: "98-99 % system", why: "Leachate COD is largely humic macromolecules, which a dense membrane rejects almost completely." },
      { param: "Specific energy", typical: "6-15 kWh/m3 permeate", why: "Far above brackish RO. The pressure is the price of running on a liquid nothing else will handle." },
      { param: "Cleaning frequency", typical: "every 1-4 weeks", why: "Designed in, with a CIP set sized to clean one stage while the other runs." },
    ],
    failureModes: [
      { mode: "Ammonia breakthrough", symptom: "Nitrogen limit missed while every other parameter passes", prevention: "Neutralise to pH 6.5-7 upstream, and verify the pH at the membrane rather than at the dosing tank." },
      { mode: "Scaling of the concentrate stage", symptom: "Second-stage pressure rising, recovery falling", prevention: "Antiscalant selected against the actual concentrate composition, not a generic dose." },
      { mode: "High-pressure incidents", symptom: "Hose or fitting failure at 100 bar", prevention: "Rated hoses, guarded runs and a pressure-relief philosophy. This is the real safety hazard of a leachate plant." },
      { mode: "Concentrate with nowhere to go", symptom: "Plant limited by concentrate storage rather than by treatment", prevention: "Decide the concentrate route — evaporation, recirculation to the landfill, or solidification — before the recovery is fixed." },
    ],
    upstream: "Neutralisation, and a cartridge filter. Even though DTRO tolerates solids, removing them extends the cleaning interval enough to pay for the filter.",
    downstream: "Polishing (AOP) on the permeate; evaporation or crystallisation on the concentrate.",
    ccepcNote:
      "The CCEPC leachate references use two-stage material membrane reduction on the nanofiltration concentrate at Qianzishan II, Heze Jinjiang and Mianyang. The Bantargebang analysis uses two-stage DTRO at 18 LMH and 85 % recovery, with 98.5 % COD and 97 % TN system rejection.",
  },

  aop: {
    principle:
      "Ozone, or ozone with a catalyst or peroxide, generates hydroxyl radicals in the water. The hydroxyl radical is close to the strongest oxidant available in water treatment and it attacks organic molecules indiscriminately, breaking rings and double bonds that no organism will touch. That is why it removes the colour of an old leachate when nothing else will, and why the energy is proportional to the amount of organic matter it has to attack.",
    whenToUse: [
      "As a final polish on an already low-COD stream, to remove residual colour and refractory organics.",
      "Ahead of a biological stage, to break refractory molecules into biodegradable fragments and raise the BOD:COD ratio.",
      "Where colour is a compliance or perception problem. Membranes and oxidation are the only two things that produce genuinely clear water; coagulation does not.",
      "For disinfection at the same time, which comes free with the ozone.",
    ],
    whenNotToUse: [
      "On raw high-COD wastewater. The energy scales with the load: oxidising 11,000 mg/L costs roughly a hundred times more than oxidising 126 mg/L for the same flow.",
      "As the last unit, if partial oxidation is releasing BOD that will then be discharged.",
      "On a high-chloride water without testing. Chloride scavenges hydroxyl radicals and forms chlorinated by-products and chlorate.",
      "Where the operator cannot manage an ozone system. Ozone is toxic and the generator, destructor and leak detection are a plant of their own.",
    ],
    designRules: [
      {
        rule: "Position matters more than the variant chosen.",
        why: "The oxidant demand is proportional to the COD destroyed. Moving the same unit from ahead of the membranes to behind them can cut its energy by two orders of magnitude while achieving the same effluent. If an AOP is expensive to run, it is almost always in the wrong place, not the wrong technology.",
      },
      {
        rule: "Determine the oxidant demand experimentally.",
        why: "The 2-3 kg of ozone per kg of COD figure is an average across water types. On a specific water it can be half or double, and the ozone generator is the largest capital item in the unit.",
      },
      {
        rule: "Provide ozone destruction on the off-gas.",
        why: "Transfer is never complete, and undissolved ozone leaving a contact tank is an occupational hazard, not an emission technicality." ,
      },
      {
        rule: "Expect the BOD to rise even as the COD falls.",
        why: "Partial oxidation cuts large refractory molecules into small biodegradable ones. Ahead of a biological polish that is exactly what you want; as the last unit before discharge it can turn a COD success into a BOD failure.",
      },
    ],
    keyNumbers: [
      { param: "Ozone per COD removed", typical: "2-3 kg O3/kgCOD", why: "2.5 is the CCEPC design basis. Catalytic ozonation improves on it by converting more ozone into hydroxyl radicals rather than letting it react directly." },
      { param: "Generator energy", typical: "8-12 kWh/kgO3 from oxygen", why: "Roughly double from air feed. The oxygen supply, liquid or PSA, is a plant in itself." },
      { param: "Contact time", typical: "20-60 min", why: "Long enough for the radicals to do their work and for the residual ozone to decay." },
      { param: "Specific energy in position", typical: "0.5-2 kWh/m3 as polishing", why: "Against 50-200 kWh/m3 if applied to raw leachate. The same unit, the same chemistry, a different position." },
      { param: "Colour removal", typical: "85-95 %", why: "Colour comes from conjugated double bonds, which is precisely what hydroxyl radicals break." },
    ],
    failureModes: [
      { mode: "Applied in the wrong position", symptom: "Enormous power bill for a modest COD reduction", prevention: "Put it after the membranes. Calculate the load it will see before selecting the generator." },
      { mode: "Generator undersized", symptom: "COD reduction far below design and unimprovable", prevention: "Size from the measured ozone demand of the real water, not from a literature ratio." },
      { mode: "Bromate formation", symptom: "A new regulated by-product appearing in the effluent", prevention: "Check the bromide in the feed. Where it is significant, consider peroxide-based routes instead." },
      { mode: "Residual BOD", symptom: "COD passes, BOD fails", prevention: "Either a small biological polish afterwards, or enough oxidation to mineralise rather than fragment." },
    ],
    upstream: "Anything that has already removed the bulk of the load. On a leachate plant that means the membranes.",
    downstream: "Discharge, online monitoring, or a small biological polish if the released BOD matters.",
    ccepcNote:
      "Zuoling WWTP in Wuhan, 100,000 m3/d, includes an ozone oxidation tank, so CCEPC has large-scale AOP operating experience. Wuhan Erfei Mountain landfill leachate, 100 m3/h, is advanced oxidation followed by secondary A/O and sand and carbon filtration.",
  },

  electroox: {
    principle:
      "Current is passed between electrodes immersed in the wastewater. Organics are oxidised directly at the anode surface, and indirectly by hypochlorite generated from the chloride already dissolved in the water. Nothing is delivered to site and nothing precipitates, so there is no chemical logistics and no sludge — but every bit of the oxidation is paid for as electricity, at the meter, continuously.",
    whenToUse: [
      "On small, concentrated, saline streams, where the flow is low enough that the power is affordable.",
      "Where chloride is already high, because the indirect chlorine route is far more efficient than direct anodic oxidation alone.",
      "For ammonia removal by breakpoint chlorination generated in situ, which on a leachate is often the real reason it is chosen.",
      "Where chemical delivery is difficult and electricity is available.",
    ],
    whenNotToUse: [
      "On low-conductivity water. Without ions to carry the current the cell voltage and the energy per kg of COD both climb steeply.",
      "On large flows. The economics are set by kWh per cubic metre and they do not improve with scale.",
      "Where chlorinated by-products or chlorate in the effluent would be a problem, which on a river discharge they usually are.",
      "As a substitute for a membrane. It destroys organics; it does not desalinate.",
    ],
    designRules: [
      {
        rule: "Verify the specific energy on the actual water.",
        why: "Published figures span 10 to 150 kWh per kg of COD depending on conductivity, anode material and target. Designing from the wrong end of that range is an order-of-magnitude error in the running cost.",
      },
      {
        rule: "Analyse the by-products before committing.",
        why: "Chloride makes the process efficient and simultaneously creates chlorinated organics and chlorate. Both are regulated in more places every year.",
      },
      {
        rule: "Budget for anode replacement.",
        why: "Boron-doped diamond and mixed-metal-oxide anodes are a large part of the capital and they wear. A life of three to five years is normal and it belongs in the operating cost, not the capital.",
      },
    ],
    keyNumbers: [
      { param: "Specific energy", typical: "20-40 kWh/kgCOD on saline water", why: "Rises steeply as conductivity falls. This single number decides whether the unit is viable." },
      { param: "Current density", typical: "100-500 A/m2", why: "Higher gives more throughput per electrode and more side reactions and wear." },
      { param: "Cell voltage", typical: "4-8 V", why: "Set by the gap, the conductivity and the electrode. Multiplied by the current, it is the power." },
      { param: "Chloride needed", typical: "above ~1500 mg/L", why: "Below that the indirect chlorine route weakens and the efficiency falls away." },
      { param: "Anode life", typical: "3-5 y", why: "A recurring capital item that is often left out of a comparison and should not be." },
    ],
    failureModes: [
      { mode: "Electrode scaling", symptom: "Cell voltage rising at constant current", prevention: "Polarity reversal or acid cleaning; softening if the hardness is high." },
      { mode: "Chlorate and perchlorate", symptom: "New regulated species in the effluent", prevention: "Analyse before committing; consider a downstream reduction step." },
      { mode: "Runaway energy cost", symptom: "Operating cost several times the estimate", prevention: "Bench-test the specific energy on the real water at the real conductivity." },
    ],
    upstream: "Solids removal, and ideally a membrane so the stream is small and concentrated.",
    downstream: "Polishing or discharge, with by-product monitoring.",
    ccepcNote: "Electrochemistry appears in the Qianzishan biogas slurry train, between flocculation-precipitation and the two-stage BAF.",
  },

  oilsep: {
    principle:
      "Oil separates from water the same way sand does, only upwards: a droplet less dense than water rises at a velocity set by its diameter and the density difference, exactly as Stokes' law describes for a settling particle. If the water moves slowly enough that the droplet reaches the surface before the outlet, it is skimmed off. Corrugated plates shorten the distance a droplet has to travel, in the same way inclined plates shorten a settling path.",
    whenToUse: [
      "Wherever free or dispersed oil is present: refinery, petrochemical, coking, vehicle workshop, or a leachate with an oily fraction.",
      "As the first unit, before anything the oil could foul — which means before every membrane and every biological process.",
      "Where oil has value and can be recovered rather than disposed of.",
    ],
    whenNotToUse: [
      "On emulsified oil. A chemically or mechanically stabilised emulsion will not separate by gravity at any retention time; it needs demulsification, flotation or an ultrafiltration membrane.",
      "As the only oil removal step ahead of a membrane. Gravity separation leaves tens of mg/L, and a membrane wants single figures.",
      "On dissolved hydrocarbons, which are not droplets and do not rise.",
    ],
    designRules: [
      {
        rule: "Design for the smallest droplet you intend to catch.",
        why: "The rise velocity goes with the square of the diameter, so the design droplet size sets the area directly. API separators are conventionally designed on 150 micron and corrugated-plate units on 60, which is why a CPI is several times smaller for the same duty.",
      },
      {
        rule: "Keep the flow laminar and undisturbed.",
        why: "Any turbulence re-entrains the oil that has already risen. Inlet distribution, and no pumps between the separator and its skimmer, matter more than retention time.",
      },
      {
        rule: "Provide for the sludge as well as the oil.",
        why: "Solids settle while oil rises. A separator with no sludge draw-off silts up and loses its volume, and then its separation.",
      },
    ],
    keyNumbers: [
      { param: "Design rise rate", typical: "0.5-2 m/h", why: "Corresponds to the rise velocity of the design droplet. Directly sets the surface area." },
      { param: "Retention time", typical: "20-40 min", why: "Enough for the design droplet to travel the plate spacing, with margin for flow variation." },
      { param: "Free oil removal", typical: "85-95 %", why: "Of free and dispersed oil. Emulsified oil passes essentially untouched." },
      { param: "Effluent oil", typical: "20-100 mg/L", why: "The realistic floor for gravity separation. A discharge or membrane limit below this needs flotation as well." },
      { param: "Skimmed volume", typical: "0.5-2 % of feed", why: "The recovered oil layer, which still contains water and must be dewatered or disposed of." },
    ],
    failureModes: [
      { mode: "Emulsified feed", symptom: "Removal far below design, oil visible in the effluent", prevention: "Test whether the oil is free or emulsified before selecting the unit; avoid centrifugal pumps upstream, which create the emulsion themselves." },
      { mode: "Sludge accumulation", symptom: "Falling effective volume, short-circuiting", prevention: "Sludge hopper with a scraper and a routine draw-off." },
      { mode: "Short-circuiting", symptom: "Tracer appearing at the outlet far too early", prevention: "Inlet distribution baffles; check by dye test at commissioning rather than assuming." },
    ],
    upstream: "Screening and grit removal.",
    downstream: "Flotation or biological treatment. On a membrane plant, never straight to the membrane.",
    ccepcNote: "Microfiltration with oil separation and two-stage air flotation opens the Qianzishan biogas slurry train.",
  },
};
