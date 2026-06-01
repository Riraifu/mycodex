function parseRgb(color) {
  if (typeof color !== 'string') {
    return null;
  }

  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i);
  if (!match) {
    return null;
  }

  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: alpha,
  };
}

function isGreenColor(color) {
  const rgb = parseRgb(color);
  if (!rgb || rgb.a === 0) {
    return false;
  }

  return rgb.g >= 120 && rgb.r <= 140 && rgb.b <= 120 && rgb.g > rgb.r + 35;
}

function isLeftmostGreen(colors) {
  return Array.isArray(colors) && colors.length > 0 && isGreenColor(colors[0]);
}

function isDoneForDate(state, today) {
  return state && state.doneDate === today;
}

module.exports = {
  isDoneForDate,
  isGreenColor,
  isLeftmostGreen,
  parseRgb,
};
