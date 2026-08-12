import { COMPONENTS, Component, IONS, Stream, StreamExtras } from "./types";

export const EQ_WEIGHT: Partial<Record<Component, number>> = {
  Na: 22.99, K: 39.1, Ca: 20.04, Mg: 12.15, NH4: 18.04,
  Cl: 35.45, SO4: 48.03, HCO3: 61.02, CO3: 30.0, NO3: 62.0, F: 19.0,
};

/** Charge sign for the ionic balance check. */
export const ION_CHARGE: Partial<Record<Component, 1 | -1>> = {
  Na: 1, K: 1, Ca: 1, Mg: 1, NH4: 1, Fe: 1, Mn: 1, Ba: 1, Sr: 1,
  Cl: -1, SO4: -1, HCO3: -1, CO3: -1, NO3: -1, F: -1,
};

export function zeroComponents(): Record<Component, number> {
  const c = {} as Record<Component, number>;
  for (const k of COMPONENTS) c[k] = 0;
  return c;
}

export function emptyExtras(): StreamExtras {
  return { turbidityNTU: 0, coliform: 0, sdi15: 0 };
}

export function emptyStream(): Stream {
  return { flow: 0, T: 25, pH: 7, c: zeroComponents(), extras: emptyExtras() };
}

export function cloneStream(s: Stream): Stream {
  return { flow: s.flow, T: s.T, pH: s.pH, c: { ...s.c }, extras: { ...s.extras } };
}

export function makeStream(
  flow: number,
  conc: Partial<Record<Component, number>>,
  opts: Partial<{ T: number; pH: number } & StreamExtras> = {},
): Stream {
  const c = zeroComponents();
  for (const [k, v] of Object.entries(conc)) {
    if (v != null && Number.isFinite(v)) c[k as Component] = v;
  }
  return {
    flow,
    T: opts.T ?? 25,
    pH: opts.pH ?? 7,
    c,
    extras: {
      turbidityNTU: opts.turbidityNTU ?? 0,
      coliform: opts.coliform ?? 0,
      sdi15: opts.sdi15 ?? 0,
    },
  };
}

/** Mass load of a component, kg/h. */
export function loadKgH(s: Stream, k: Component): number {
  return (s.flow * s.c[k]) / 1000;
}

/** Mix an arbitrary number of streams on a mass basis. */
export function mixStreams(streams: Stream[]): Stream {
  const live = streams.filter((s) => s && s.flow > 0);
  if (live.length === 0) return emptyStream();
  if (live.length === 1) return cloneStream(live[0]);

  const flow = live.reduce((a, s) => a + s.flow, 0);
  const out = emptyStream();
  out.flow = flow;
  for (const k of COMPONENTS) {
    const load = live.reduce((a, s) => a + s.flow * s.c[k], 0);
    out.c[k] = load / flow;
  }
  out.T = live.reduce((a, s) => a + s.flow * s.T, 0) / flow;
  // pH mixed on hydrogen-ion activity, which is the physically correct way.
  const hPlus = live.reduce((a, s) => a + s.flow * Math.pow(10, -s.pH), 0) / flow;
  out.pH = clamp(-Math.log10(Math.max(hPlus, 1e-14)), 0, 14);
  out.extras.turbidityNTU =
    live.reduce((a, s) => a + s.flow * s.extras.turbidityNTU, 0) / flow;
  out.extras.coliform =
    live.reduce((a, s) => a + s.flow * s.extras.coliform, 0) / flow;
  out.extras.sdi15 = Math.max(...live.map((s) => s.extras.sdi15));
  return out;
}

/**
 * Split a stream into a product and a reject at a given volumetric recovery,
 * applying a per-component removal (fraction of incoming load removed from the
 * product). All removed load reports to the reject, so the balance closes.
 */
export function splitByRejection(
  inlet: Stream,
  recovery: number,
  rejection: Partial<Record<Component, number>>,
  defaultRejection = 0,
): { product: Stream; reject: Stream } {
  const Y = clamp(recovery, 1e-6, 0.999999);
  const product = emptyStream();
  const reject = emptyStream();
  product.flow = inlet.flow * Y;
  reject.flow = inlet.flow * (1 - Y);
  product.T = reject.T = inlet.T;
  product.pH = reject.pH = inlet.pH;

  // Log-mean concentration factor along the module, the standard approximation
  // for the average feed concentration seen by a membrane at recovery Y.
  const lm = Y > 0.02 ? Math.log(1 / (1 - Y)) / Y : 1;

  for (const k of COMPONENTS) {
    const feedLoad = inlet.flow * inlet.c[k]; // g/h basis (mg/L * m3/h)
    const R = clamp(rejection[k] ?? defaultRejection, 0, 1);
    const cp = inlet.c[k] * (1 - R) * lm;
    const permLoad = Math.min(cp * product.flow, feedLoad);
    product.c[k] = product.flow > 0 ? permLoad / product.flow : 0;
    reject.c[k] = reject.flow > 0 ? (feedLoad - permLoad) / reject.flow : 0;
  }
  product.extras.turbidityNTU = Math.min(inlet.extras.turbidityNTU, 0.05);
  product.extras.sdi15 = Math.min(inlet.extras.sdi15, 1);
  product.extras.coliform = 0;
  reject.extras.turbidityNTU =
    reject.flow > 0
      ? (inlet.flow * inlet.extras.turbidityNTU) / reject.flow
      : 0;
  reject.extras.coliform =
    reject.flow > 0 ? (inlet.flow * inlet.extras.coliform) / reject.flow : 0;
  reject.extras.sdi15 = inlet.extras.sdi15;
  return { product, reject };
}

/**
 * Remove a fraction of selected components into a concentrated side stream
 * (clarifier sludge, filter backwash, biological waste sludge, ...).
 *
 * A component with no stated removal leaves in BOTH streams at the same
 * concentration, because the side stream is water and carries whatever is
 * dissolved in it. Defaulting such a component to zero removal kept all of its
 * mass in a smaller product flow and quietly concentrated it: on a plant losing
 * 4.5 % of its water to float and backwash, the dissolved solids rose from 365
 * to 382 mg/L across units that remove no salt at all. Mass still balanced,
 * which is why it survived — the error was in where the mass went, not how much
 * of it there was.
 */
export function removeToSideStream(
  inlet: Stream,
  sideFlowFraction: number,
  removal: Partial<Record<Component, number>>,
): { product: Stream; side: Stream } {
  const f = clamp(sideFlowFraction, 0, 0.9);
  const product = cloneStream(inlet);
  const side = cloneStream(inlet);
  product.flow = inlet.flow * (1 - f);
  side.flow = inlet.flow * f;

  for (const k of COMPONENTS) {
    const feedLoad = inlet.flow * inlet.c[k];
    // Unlisted components go with the water, so the fraction removed is the
    // fraction of the water removed.
    const rem = clamp(removal[k] ?? f, 0, 1);
    const removedLoad = feedLoad * rem;
    product.c[k] = product.flow > 0 ? (feedLoad - removedLoad) / product.flow : 0;
    side.c[k] = side.flow > 0 ? removedLoad / side.flow : 0;
  }
  return { product, side };
}

/** Total dissolved solids implied by the tracked ions, mg/L. */
export function tdsFromIons(s: Stream): number {
  return IONS.reduce((a, k) => a + s.c[k], 0);
}

/** Total hardness as mg/L CaCO3. */
export function hardnessAsCaCO3(s: Stream): number {
  return (s.c.Ca / 20.04 + s.c.Mg / 12.15) * 50;
}

/** Alkalinity as mg/L CaCO3 from bicarbonate and carbonate. */
export function alkalinityAsCaCO3(s: Stream): number {
  return (s.c.HCO3 / 61.02 + s.c.CO3 / 30.0) * 50;
}

/** Ionic balance error, %. Acceptable is roughly +/-5 %. */
export function ionicBalanceErrorPct(s: Stream): number {
  let cat = 0;
  let an = 0;
  for (const k of IONS) {
    const eq = EQ_WEIGHT[k];
    const z = ION_CHARGE[k];
    if (!eq || !z) continue;
    const meq = s.c[k] / eq;
    if (z > 0) cat += meq;
    else an += meq;
  }
  if (cat + an === 0) return 0;
  return ((cat - an) / (cat + an)) * 100;
}

/** Osmotic pressure, bar, from van 't Hoff on the tracked TDS. */
export function osmoticPressureBar(s: Stream): number {
  const tds = Math.max(s.c.TDS, tdsFromIons(s));
  // 1000 mg/L NaCl-equivalent gives roughly 0.78 bar at 25 degC.
  return (tds / 1000) * 0.78 * ((s.T + 273.15) / 298.15);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Relative difference between two streams, used for recycle convergence. */
export function streamResidual(a: Stream, b: Stream): number {
  const denom = Math.max(a.flow, b.flow, 1e-6);
  let r = Math.abs(a.flow - b.flow) / denom;
  for (const k of COMPONENTS) {
    const d = Math.max(Math.abs(a.c[k]), Math.abs(b.c[k]), 1);
    r = Math.max(r, Math.abs(a.c[k] - b.c[k]) / d);
  }
  return r;
}

export function blendStream(prev: Stream, next: Stream, damping: number): Stream {
  const w = clamp(damping, 0, 1);
  const out = emptyStream();
  out.flow = prev.flow * (1 - w) + next.flow * w;
  out.T = prev.T * (1 - w) + next.T * w;
  out.pH = prev.pH * (1 - w) + next.pH * w;
  for (const k of COMPONENTS) out.c[k] = prev.c[k] * (1 - w) + next.c[k] * w;
  out.extras.turbidityNTU =
    prev.extras.turbidityNTU * (1 - w) + next.extras.turbidityNTU * w;
  out.extras.coliform = prev.extras.coliform * (1 - w) + next.extras.coliform * w;
  out.extras.sdi15 = prev.extras.sdi15 * (1 - w) + next.extras.sdi15 * w;
  return out;
}
