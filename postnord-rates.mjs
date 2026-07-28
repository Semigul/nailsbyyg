// PostNord "Brev inrikes", frimärkt. Gäller från 1 januari 2026.
// Källa: https://www.postnord.se/privat/priser-och-villkor/portotabeller/portotabell-brev/
export const POSTNORD_LETTER_RATES = Object.freeze([
  Object.freeze({ maxWeight: 50, price: 22 }),
  Object.freeze({ maxWeight: 100, price: 44 }),
  Object.freeze({ maxWeight: 250, price: 66 }),
  Object.freeze({ maxWeight: 500, price: 88 }),
  Object.freeze({ maxWeight: 1000, price: 132 }),
  Object.freeze({ maxWeight: 2000, price: 154 })
]);

export function getPostNordLetterRate(weightGrams) {
  const weight = Number(weightGrams);

  if (!Number.isFinite(weight) || weight <= 0) {
    return null;
  }

  return POSTNORD_LETTER_RATES.find((rate) => weight <= rate.maxWeight) || null;
}

export function formatWeightLimit(weightGrams) {
  if (weightGrams >= 1000) {
    return `${weightGrams / 1000} kg`;
  }

  return `${weightGrams} g`;
}
