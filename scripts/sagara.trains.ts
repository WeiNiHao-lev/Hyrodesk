import { simulate } from "../src/lib/engine/solver";
import { TEMPLATES } from "../src/lib/engine/templates";
import { Flowsheet } from "../src/lib/engine/types";
import { writeFileSync } from "fs";

/**
 * What actually happens when an RO train is switched off.
 *
 * The question is whether the water that would have gone to the idle train is
 * thrown away. It is not: the split is set at the filtered-water tank, so water
 * not drawn into the RO branch simply stays in the bypass. What changes is the
 * product TDS, and — counter-intuitively — the plant recovery goes UP.
 */
const FILTERED = 196;      // m3/h leaving the filtered water tank
const FEED_PER_TRAIN = 32; // m3/h at 24 permeate and 75 % recovery

function run(trains: number) {
  const share = (trains * FEED_PER_TRAIN) / FILTERED * 100;
  const fs = JSON.parse(JSON.stringify(
    TEMPLATES.find((t) => t.key === "wtp-sagara-split")!.make())) as Flowsheet;
  for (const nd of fs.nodes) {
    if (nd.type === "rawtank" && nd.params.outletCount === 2) nd.params.split2 = share;
  }
  const r = simulate(fs);
  const s = r.summary;
  const ro = r.nodes.find((x) => x.type === "ro")!;
  const tank = r.nodes.find((x) => x.label === "Tangki Air Tersaring")!;
  const p = r.productStreams[0]?.stream;
  const rd = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    trains, sharePct: rd(share, 1),
    bypass: rd(tank.outlets.out1.flow), roFeed: rd(tank.outlets.out2.flow),
    permeate: rd(ro.outlets.permeate.flow), concentrate: rd(ro.outlets.concentrate.flow),
    product: rd(s.productFlow), productTDS: rd(p?.c.TDS ?? 0, 1),
    waste: rd(s.wasteFlow), recovery: rd(s.recoveryPct, 2),
    power: rd(s.totalPowerKW, 1),
    meetsSpec: (p?.c.TDS ?? 999) <= 300,
  };
}

const rows = [1, 2, 3].map(run);
writeFileSync("scripts/out/sagara-trains.json", JSON.stringify(rows, null, 2));
console.log("train  share%  bypass  roFeed  permeat  konsentrat  produk  TDS    buangan  recovery  daya   spek");
for (const r of rows) {
  console.log(
    `  ${r.trains}    ${String(r.sharePct).padStart(5)}  ${String(r.bypass).padStart(6)}  ` +
    `${String(r.roFeed).padStart(6)}  ${String(r.permeate).padStart(7)}  ${String(r.concentrate).padStart(10)}  ` +
    `${String(r.product).padStart(6)}  ${String(r.productTDS).padStart(5)}  ${String(r.waste).padStart(7)}  ` +
    `${String(r.recovery).padStart(8)}  ${String(r.power).padStart(5)}  ${r.meetsSpec ? "OK" : "GAGAL"}`);
}
