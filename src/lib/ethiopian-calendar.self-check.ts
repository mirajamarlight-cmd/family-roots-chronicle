import { ethiopianToGregorianIso, formatEthiopianDate, gregorianToEthiopian } from "./ethiopian-calendar.ts";

const ec = gregorianToEthiopian("1990-03-12");
if (!ec || ec.year !== 1982 || ec.month !== 7 || ec.day !== 4) {
  throw new Error(`EC conversion failed: ${JSON.stringify(ec)}`);
}
if (ethiopianToGregorianIso({ year: 1982, month: 7, day: 4 }) !== "1990-03-12") {
  throw new Error("GC round-trip failed");
}
if (!formatEthiopianDate("1990-03-12")?.includes("1982")) {
  throw new Error("formatEthiopianDate failed");
}

console.log("ethiopian-calendar.self-check passed");
