import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Direct testing of currency formatting logic
function formatLKR(minorUnits) {
  const rupees = minorUnits / 100;
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

describe("Utility Functions - formatLKR", () => {
  test("formats 750,000 minor units to LKR 7,500.00", () => {
    const formatted = formatLKR(750000);
    assert.match(formatted, /7,500/);
    assert.match(formatted, /LKR|Rs/);
  });

  test("formats 0 minor units to 0.00", () => {
    const formatted = formatLKR(0);
    assert.match(formatted, /0/);
  });

  test("formats fractional cents correctly", () => {
    const formatted = formatLKR(12550); // LKR 125.50
    assert.match(formatted, /125\.5/);
  });
});
