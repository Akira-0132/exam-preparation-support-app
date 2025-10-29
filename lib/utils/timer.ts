export function timer(label: string) {
  const start = process.hrtime.bigint();
  const laps: { name: string; ms: number }[] = [];

  return {
    lap(name: string) {
      const now = process.hrtime.bigint();
      laps.push({ name, ms: Number(now - start) / 1e6 });
    },
    header() {
      return laps.map(l => `${l.name};dur=${l.ms.toFixed(1)}`).join(', ');
    },
    getLaps() {
      return laps;
    },
  };
}

