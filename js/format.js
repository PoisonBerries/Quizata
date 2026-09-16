// Human-friendly number formatting for slider readouts and reveal markers.

export function formatValue(question, value) {
  const decimals = decimalsFor(question, value);
  const rounded = roundToPrecision(value, decimals);
  const numberText = rounded.toLocaleString("en-US", { maximumFractionDigits: decimals });
  return question.unit ? `${numberText} ${question.unit}` : numberText;
}

function decimalsFor(question, value) {
  if (question.scale === "log") return value < 10 ? 1 : 0;
  const span = question.max - question.min;
  if (span <= 10) return 1;
  return 0;
}

function roundToPrecision(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
