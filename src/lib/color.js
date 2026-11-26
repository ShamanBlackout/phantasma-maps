function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function hslToRgbString(h, s, l) {
  const normalizedHue = ((Number(h) % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, Number(s))) / 100;
  const lightness = Math.max(0, Math.min(100, Number(l))) / 100;

  if (saturation === 0) {
    const channel = clampColorChannel(lightness * 255);
    return `${channel}, ${channel}, ${channel}`;
  }

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((hueSection % 2) - 1));

  let redPrime = 0;
  let greenPrime = 0;
  let bluePrime = 0;

  if (hueSection >= 0 && hueSection < 1) {
    redPrime = chroma;
    greenPrime = x;
  } else if (hueSection < 2) {
    redPrime = x;
    greenPrime = chroma;
  } else if (hueSection < 3) {
    greenPrime = chroma;
    bluePrime = x;
  } else if (hueSection < 4) {
    greenPrime = x;
    bluePrime = chroma;
  } else if (hueSection < 5) {
    redPrime = x;
    bluePrime = chroma;
  } else {
    redPrime = chroma;
    bluePrime = x;
  }

  const match = lightness - chroma / 2;
  const red = clampColorChannel((redPrime + match) * 255);
  const green = clampColorChannel((greenPrime + match) * 255);
  const blue = clampColorChannel((bluePrime + match) * 255);
  return `${red}, ${green}, ${blue}`;
}

export function hashToHue(value) {
  const source = String(value || "");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 360;
  }
  return hash;
}
