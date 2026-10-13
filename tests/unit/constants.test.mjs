import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Brand Tokens & Design Specifications Verification", () => {
  const cssContent = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/globals.css"),
    "utf-8"
  );

  test("defines approved SpareHub brand colors in CSS tokens", () => {
    assert.ok(cssContent.includes("#FF6B00"), "Primary Orange token must be #FF6B00");
    assert.ok(cssContent.includes("#171717"), "Dark Black token must be #171717");
    assert.ok(cssContent.includes("#FFFFFF"), "White token must be #FFFFFF");
    assert.ok(cssContent.includes("#F5F5F5"), "Light Gray token must be #F5F5F5");
    assert.ok(cssContent.includes("#E5E7EB"), "Border Gray token must be #E5E7EB");
    assert.ok(cssContent.includes("#16A34A"), "Success Green token must be #16A34A");
    assert.ok(cssContent.includes("#DC2626"), "Error Red token must be #DC2626");
  });

  test("contains accessible focus ring token", () => {
    assert.ok(cssContent.includes(":focus-visible"), "Must define accessible keyboard focus outline");
    assert.ok(cssContent.includes("#FF6B00"), "Focus ring must use brand orange token");
  });
});

describe("Vehicle Taxonomy & District Constants Verification", () => {
  const constantsContent = fs.readFileSync(
    path.resolve(process.cwd(), "src/lib/constants.ts"),
    "utf-8"
  );

  test("supports all mandatory vehicle categories in Sri Lanka", () => {
    const requiredVehicles = [
      "car",
      "motorcycle",
      "three_wheeler",
      "van",
      "bus",
      "truck",
      "tractor",
      "heavy_machinery",
    ];

    for (const v of requiredVehicles) {
      assert.ok(
        constantsContent.includes(`id: "${v}"`),
        `Missing vehicle category: ${v}`
      );
    }
  });

  test("includes all 25 Sri Lankan administrative districts", () => {
    const districts = [
      "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
      "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
      "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
      "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
      "Monaragala", "Ratnapura", "Kegalle"
    ];

    assert.equal(districts.length, 25);
    for (const d of districts) {
      assert.ok(
        constantsContent.includes(`"${d}"`),
        `Missing administrative district: ${d}`
      );
    }
  });
});
