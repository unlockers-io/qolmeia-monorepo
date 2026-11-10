const UNITS = [
  {
    format: new Intl.NumberFormat("pt-BR", { style: "unit", unit: "day", unitDisplay: "long" }),
    seconds: 60 * 60 * 24,
  },
  {
    format: new Intl.NumberFormat("pt-BR", { style: "unit", unit: "hour", unitDisplay: "long" }),
    seconds: 60 * 60,
  },
  {
    format: new Intl.NumberFormat("pt-BR", { style: "unit", unit: "minute", unitDisplay: "long" }),
    seconds: 60,
  },
];

const SECONDS = {
  format: new Intl.NumberFormat("pt-BR", { style: "unit", unit: "second", unitDisplay: "long" }),
  seconds: 1,
};

const formatDuration = (totalSeconds: number): string => {
  const { format, seconds } = UNITS.find((unit) => totalSeconds % unit.seconds === 0) ?? SECONDS;

  return format.format(totalSeconds / seconds);
};

export { formatDuration };
