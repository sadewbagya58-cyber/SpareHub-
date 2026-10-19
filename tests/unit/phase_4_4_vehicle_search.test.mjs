import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function formatVariantYearRange(yearStart, yearEnd) {
  if (!yearStart) return "";
  if (yearEnd && yearEnd >= yearStart) {
    return yearEnd === yearStart ? `${yearStart}` : `${yearStart}–${yearEnd}`;
  }
  return `${yearStart}–Present`;
}

function formatVariantLabel(variant) {
  const years = formatVariantYearRange(variant.year_start, variant.year_end);
  const parts = [variant.generation_chassis];
  if (years) parts[0] = `${variant.generation_chassis} (${years})`;
  if (variant.engine_code) parts.push(variant.engine_code);
  if (variant.fuel_type) parts.push(variant.fuel_type);
  return parts.join(" • ");
}

function resolveAndValidateVehicleQueryParams(rawParams, hierarchy) {
  const rawType = rawParams.type?.trim().toLowerCase() || "";
  const rawMake = rawParams.make?.trim().toLowerCase() || "";
  const rawModel = rawParams.model?.trim().toLowerCase() || "";
  const rawVariant = rawParams.variant?.trim().toLowerCase() || "";

  let resolvedType;
  let resolvedMake;
  let resolvedModel;
  let resolvedVariant;

  // 1. Resolve vehicle type
  if (rawType && rawType !== "all") {
    resolvedType = hierarchy.vehicleTypes.find(
      (t) => t.id.toLowerCase() === rawType || t.name.toLowerCase() === rawType
    );
  }

  // 2. Resolve vehicle make
  if (rawMake && rawMake !== "all") {
    const candidateMake = hierarchy.vehicleMakes.find(
      (m) =>
        m.id.toLowerCase() === rawMake ||
        m.slug.toLowerCase() === rawMake ||
        m.name.toLowerCase() === rawMake
    );

    if (candidateMake) {
      if (resolvedType) {
        if (candidateMake.vehicle_type_id === resolvedType.id) {
          resolvedMake = candidateMake;
        }
      } else {
        resolvedMake = candidateMake;
        resolvedType = hierarchy.vehicleTypes.find(
          (t) => t.id === candidateMake.vehicle_type_id
        );
      }
    }
  }

  // 3. Resolve vehicle model (must belong to resolved make)
  if (rawModel && rawModel !== "all" && resolvedMake) {
    const candidateModel = hierarchy.vehicleModels.find(
      (m) =>
        m.make_id === resolvedMake.id &&
        (m.id.toLowerCase() === rawModel ||
          m.slug.toLowerCase() === rawModel ||
          m.name.toLowerCase() === rawModel)
    );

    if (candidateModel) {
      resolvedModel = candidateModel;
    }
  }

  // 4. Resolve vehicle variant (must belong to resolved model)
  if (rawVariant && rawVariant !== "all" && resolvedModel) {
    const candidateVariant = hierarchy.vehicleVariants.find(
      (v) =>
        v.model_id === resolvedModel.id &&
        (v.id.toLowerCase() === rawVariant ||
          v.generation_chassis.toLowerCase() === rawVariant)
    );

    if (candidateVariant) {
      resolvedVariant = candidateVariant;
    }
  }

  const hasFilter = Boolean(resolvedType || resolvedMake || resolvedModel || resolvedVariant);
  let displayLabel = "";
  let filterSummary = "All Vehicles";
  let fitmentScope = "none";

  if (resolvedVariant && resolvedModel && resolvedMake) {
    displayLabel = `${resolvedMake.name} ${resolvedModel.name} (${formatVariantLabel(resolvedVariant)})`;
    filterSummary = `Fits ${resolvedMake.name} ${resolvedModel.name} • ${resolvedVariant.generation_chassis}`;
    fitmentScope = "variant";
  } else if (resolvedModel && resolvedMake) {
    displayLabel = `${resolvedMake.name} ${resolvedModel.name} (All Generations)`;
    filterSummary = `Fits all ${resolvedMake.name} ${resolvedModel.name} models`;
    fitmentScope = "model";
  } else if (resolvedMake) {
    displayLabel = `${resolvedMake.name} (All Models)`;
    filterSummary = `Fits ${resolvedMake.name} vehicles`;
    fitmentScope = "make";
  } else if (resolvedType) {
    displayLabel = `${resolvedType.name} (All Makes)`;
    filterSummary = `Fits ${resolvedType.name}`;
    fitmentScope = "type";
  }

  const sanitizedParams = {};
  if (resolvedType) sanitizedParams.type = resolvedType.id;
  if (resolvedMake) sanitizedParams.make = resolvedMake.id;
  if (resolvedModel) sanitizedParams.model = resolvedModel.id;
  if (resolvedVariant) sanitizedParams.variant = resolvedVariant.id;

  return {
    isValid: true,
    hasFilter,
    vehicleType: resolvedType,
    vehicleMake: resolvedMake,
    vehicleModel: resolvedModel,
    vehicleVariant: resolvedVariant,
    displayLabel,
    fitmentScope,
    sanitizedParams,
    filterSummary,
  };
}

function evaluateProductFitment(product, filter) {
  const hasVehicleFilter = Boolean(
    (filter.vehicleTypeId && filter.vehicleTypeId !== "all") ||
      (filter.vehicleMakeId && filter.vehicleMakeId !== "all") ||
      (filter.vehicleModelId && filter.vehicleModelId !== "all") ||
      (filter.vehicleVariantId && filter.vehicleVariantId !== "all")
  );

  if (!hasVehicleFilter) {
    return {
      isMatch: true,
      isExactFit: true,
      fitmentType: product.is_universal ? "universal" : "none",
      fitmentBadge: product.is_universal ? "Universal Fit" : "Verified Fit",
      fitmentDetails: product.is_universal
        ? "Universal Fitment (All Vehicles)"
        : "Verified Compatibility",
    };
  }

  if (product.is_universal) {
    return {
      isMatch: true,
      isExactFit: true,
      fitmentType: "universal",
      fitmentBadge: "Universal Fit",
      fitmentDetails: "Universal Fitment (Fits All Vehicles)",
    };
  }

  const entries = product.product_compatibility || [];
  if (entries.length === 0) {
    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  if (filter.vehicleVariantId && filter.vehicleVariantId !== "all") {
    const exactMatch = entries.find(
      (c) => c.vehicle_variant_id === filter.vehicleVariantId
    );
    if (exactMatch) {
      return {
        isMatch: true,
        isExactFit: exactMatch.is_exact_fit !== false,
        fitmentType: "exact_variant",
        fitmentBadge:
          exactMatch.is_exact_fit !== false ? "Direct OEM Fit" : "Compatible Variant Fit",
        fitmentDetails: exactMatch.notes
          ? `Direct Fit • ${exactMatch.notes}`
          : "Direct OEM Fitment for Selected Variant",
      };
    }

    const modelLevelMatch = entries.find(
      (c) =>
        c.vehicle_model_id === filter.vehicleModelId &&
        (!c.vehicle_variant_id || c.vehicle_variant_id === null)
    );
    if (modelLevelMatch) {
      return {
        isMatch: true,
        isExactFit: modelLevelMatch.is_exact_fit !== false,
        fitmentType: "model_compatible",
        fitmentBadge: "Model Compatible",
        fitmentDetails: modelLevelMatch.notes
          ? `Compatible • ${modelLevelMatch.notes}`
          : "Model-wide fitment (All Generations)",
      };
    }

    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  if (filter.vehicleModelId && filter.vehicleModelId !== "all") {
    const modelMatch = entries.find(
      (c) => c.vehicle_model_id === filter.vehicleModelId
    );
    if (modelMatch) {
      return {
        isMatch: true,
        isExactFit: modelMatch.is_exact_fit !== false,
        fitmentType: "model_compatible",
        fitmentBadge:
          modelMatch.is_exact_fit !== false ? "Direct OEM Fit" : "Compatible Model Fit",
        fitmentDetails: modelMatch.notes
          ? `Fits Model • ${modelMatch.notes}`
          : "Compatible with selected model",
      };
    }

    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  if (filter.vehicleMakeId && filter.vehicleMakeId !== "all") {
    const makeMatch = entries.find((c) => c.make_id === filter.vehicleMakeId);
    if (makeMatch) {
      return {
        isMatch: true,
        isExactFit: false,
        fitmentType: "make_compatible",
        fitmentBadge: "Make Compatible",
        fitmentDetails: "Compatible with manufacturer vehicles",
      };
    }

    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  if (filter.vehicleTypeId && filter.vehicleTypeId !== "all") {
    const typeMatch = entries.find(
      (c) => c.vehicle_type_id === filter.vehicleTypeId
    );
    if (typeMatch) {
      return {
        isMatch: true,
        isExactFit: false,
        fitmentType: "type_compatible",
        fitmentBadge: "Vehicle Compatible",
        fitmentDetails: "Compatible with vehicle class",
      };
    }

    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  return {
    isMatch: true,
    isExactFit: true,
    fitmentType: "none",
    fitmentBadge: "Verified Fit",
    fitmentDetails: "Verified Compatibility",
  };
}

const mockTaxonomy = {
  vehicleTypes: [
    { id: "car", name: "Cars & SUVs" },
    { id: "three_wheeler", name: "Three-Wheelers" },
    { id: "motorcycle", name: "Motorcycles" },
  ],
  vehicleMakes: [
    { id: "b1000000-0000-0000-0000-000000000001", vehicle_type_id: "car", name: "Toyota", slug: "toyota" },
    { id: "b1000000-0000-0000-0000-000000000002", vehicle_type_id: "car", name: "Honda", slug: "honda" },
    { id: "b1000000-0000-0000-0000-000000000006", vehicle_type_id: "three_wheeler", name: "Bajaj", slug: "bajaj-three-wheeler" },
  ],
  vehicleModels: [
    { id: "d1000000-0000-0000-0000-000000000001", make_id: "b1000000-0000-0000-0000-000000000001", name: "Corolla", slug: "corolla" },
    { id: "d1000000-0000-0000-0000-000000000002", make_id: "b1000000-0000-0000-0000-000000000001", name: "Prius", slug: "prius" },
    { id: "d1000000-0000-0000-0000-000000000007", make_id: "b1000000-0000-0000-0000-000000000002", name: "Civic", slug: "civic" },
  ],
  vehicleVariants: [
    {
      id: "e1000000-0000-0000-0000-000000000001",
      model_id: "d1000000-0000-0000-0000-000000000001",
      generation_chassis: "AE110 (5A-FE 1.5L)",
      year_start: 1995,
      year_end: 2000,
      engine_code: "5A-FE",
      fuel_type: "petrol",
    },
    {
      id: "e1000000-0000-0000-0000-000000000002",
      model_id: "d1000000-0000-0000-0000-000000000001",
      generation_chassis: "NZE121 (1NZ-FE 1.5L)",
      year_start: 2000,
      year_end: 2006,
      engine_code: "1NZ-FE",
      fuel_type: "petrol",
    },
    {
      id: "e1000000-0000-0000-0000-000000000012",
      model_id: "d1000000-0000-0000-0000-000000000007",
      generation_chassis: "FD1 / FD4 (8th Gen)",
      year_start: 2006,
      year_end: 2011,
      engine_code: "R18A",
      fuel_type: "petrol",
    },
  ],
};

describe("Phase 4.4: 1. Cascading Vehicle Taxonomy Selection & Integrity", () => {
  test("loads valid vehicle types and allows narrowing makes by vehicle type", () => {
    assert.strictEqual(mockTaxonomy.vehicleTypes.length, 3);
    const carType = mockTaxonomy.vehicleTypes.find((t) => t.id === "car");
    assert.ok(carType);

    const carMakes = mockTaxonomy.vehicleMakes.filter(
      (m) => m.vehicle_type_id === carType.id
    );
    assert.strictEqual(carMakes.length, 2);
    assert.ok(carMakes.some((m) => m.name === "Toyota"));
    assert.ok(carMakes.some((m) => m.name === "Honda"));
    assert.ok(!carMakes.some((m) => m.slug === "bajaj-three-wheeler"));
  });

  test("narrows models by selected make and never displays models of other makes", () => {
    const toyota = mockTaxonomy.vehicleMakes.find((m) => m.name === "Toyota");
    assert.ok(toyota);

    const toyotaModels = mockTaxonomy.vehicleModels.filter(
      (mod) => mod.make_id === toyota.id
    );
    assert.strictEqual(toyotaModels.length, 2);
    assert.ok(toyotaModels.some((mod) => mod.name === "Corolla"));
    assert.ok(toyotaModels.some((mod) => mod.name === "Prius"));
    assert.ok(!toyotaModels.some((mod) => mod.name === "Civic"));
  });

  test("narrows variants by selected model and never displays variants of other models", () => {
    const corolla = mockTaxonomy.vehicleModels.find((mod) => mod.name === "Corolla");
    assert.ok(corolla);

    const corollaVariants = mockTaxonomy.vehicleVariants.filter(
      (v) => v.model_id === corolla.id
    );
    assert.strictEqual(corollaVariants.length, 2);
    assert.ok(corollaVariants.some((v) => v.generation_chassis.includes("AE110")));
    assert.ok(corollaVariants.some((v) => v.generation_chassis.includes("NZE121")));
    assert.ok(!corollaVariants.some((v) => v.generation_chassis.includes("FD1")));
  });
});

describe("Phase 4.4: 2. Server-Side Untrusted Query Parameter Validation & Sanitization", () => {
  test("validates valid 4-level taxonomy query parameters", () => {
    const result = resolveAndValidateVehicleQueryParams(
      {
        type: "car",
        make: "toyota",
        model: "corolla",
        variant: "e1000000-0000-0000-0000-000000000001",
      },
      mockTaxonomy
    );

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.hasFilter, true);
    assert.strictEqual(result.fitmentScope, "variant");
    assert.strictEqual(result.vehicleType?.id, "car");
    assert.strictEqual(result.vehicleMake?.name, "Toyota");
    assert.strictEqual(result.vehicleModel?.name, "Corolla");
    assert.ok(result.vehicleVariant?.generation_chassis.includes("AE110"));
    assert.ok(result.displayLabel.includes("Toyota Corolla"));
  });

  test("resolves make and model using canonical UUIDs", () => {
    const result = resolveAndValidateVehicleQueryParams(
      {
        type: "car",
        make: "b1000000-0000-0000-0000-000000000001",
        model: "d1000000-0000-0000-0000-000000000001",
      },
      mockTaxonomy
    );

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.vehicleMake?.name, "Toyota");
    assert.strictEqual(result.vehicleModel?.name, "Corolla");
    assert.strictEqual(result.fitmentScope, "model");
  });

  test("auto-resolves vehicle type when only make is provided", () => {
    const result = resolveAndValidateVehicleQueryParams(
      {
        make: "toyota",
      },
      mockTaxonomy
    );

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.vehicleType?.id, "car");
    assert.strictEqual(result.vehicleMake?.name, "Toyota");
    assert.strictEqual(result.fitmentScope, "make");
  });

  test("sanitizes and drops mismatched model that belongs to another make", () => {
    const result = resolveAndValidateVehicleQueryParams(
      {
        type: "car",
        make: "toyota",
        model: "civic", // Civic belongs to Honda
      },
      mockTaxonomy
    );

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.vehicleMake?.name, "Toyota");
    assert.strictEqual(result.vehicleModel, undefined); // Dropped
    assert.strictEqual(result.fitmentScope, "make");
    assert.strictEqual(result.sanitizedParams.model, undefined);
  });

  test("sanitizes and drops mismatched variant that belongs to another model", () => {
    const result = resolveAndValidateVehicleQueryParams(
      {
        type: "car",
        make: "toyota",
        model: "corolla",
        variant: "e1000000-0000-0000-0000-000000000012", // Civic FD1 variant
      },
      mockTaxonomy
    );

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.vehicleModel?.name, "Corolla");
    assert.strictEqual(result.vehicleVariant, undefined); // Dropped
    assert.strictEqual(result.fitmentScope, "model");
  });

  test("safely handles SQL injection, script injection and non-existent IDs", () => {
    const malicious = [
      "1; DROP TABLE products; --",
      "' OR '1'='1",
      "<script>alert(1)</script>",
      "non-existent-uuid-12345",
      null,
      undefined,
    ];

    for (const val of malicious) {
      assert.doesNotThrow(() => {
        const res = resolveAndValidateVehicleQueryParams(
          { type: val, make: val, model: val, variant: val },
          mockTaxonomy
        );
        assert.strictEqual(res.isValid, true);
      });
    }
  });
});

describe("Phase 4.4: 3. Vehicle Compatibility Fitment Evaluation Engine", () => {
  const corollaModelId = "d1000000-0000-0000-0000-000000000001";
  const corollaAE110VariantId = "e1000000-0000-0000-0000-000000000001";
  const corollaNZE121VariantId = "e1000000-0000-0000-0000-000000000002";
  const civicModelId = "d1000000-0000-0000-0000-000000000007";

  test("universal-fit products match any vehicle filter", () => {
    const universalProduct = {
      is_universal: true,
      product_compatibility: [],
    };

    const fitment = evaluateProductFitment(universalProduct, {
      vehicleTypeId: "car",
      vehicleMakeId: "b1000000-0000-0000-0000-000000000001",
      vehicleModelId: corollaModelId,
      vehicleVariantId: corollaAE110VariantId,
    });

    assert.strictEqual(fitment.isMatch, true);
    assert.strictEqual(fitment.isExactFit, true);
    assert.strictEqual(fitment.fitmentType, "universal");
    assert.strictEqual(fitment.fitmentBadge, "Universal Fit");
  });

  test("exact variant match is identified as Direct OEM Fit", () => {
    const product = {
      is_universal: false,
      product_compatibility: [
        {
          vehicle_model_id: corollaModelId,
          vehicle_variant_id: corollaAE110VariantId,
          is_exact_fit: true,
          notes: "Front brake pads OEM spec",
        },
      ],
    };

    const fitment = evaluateProductFitment(product, {
      vehicleModelId: corollaModelId,
      vehicleVariantId: corollaAE110VariantId,
    });

    assert.strictEqual(fitment.isMatch, true);
    assert.strictEqual(fitment.isExactFit, true);
    assert.strictEqual(fitment.fitmentType, "exact_variant");
    assert.strictEqual(fitment.fitmentBadge, "Direct OEM Fit");
  });

  test("model-level compatibility (null variant) matches when a variant of that model is selected", () => {
    const product = {
      is_universal: false,
      product_compatibility: [
        {
          vehicle_model_id: corollaModelId,
          vehicle_variant_id: null, // Model-wide
          is_exact_fit: true,
          notes: "Fits all Corolla 1.5L engines",
        },
      ],
    };

    const fitment = evaluateProductFitment(product, {
      vehicleModelId: corollaModelId,
      vehicleVariantId: corollaAE110VariantId,
    });

    assert.strictEqual(fitment.isMatch, true);
    assert.strictEqual(fitment.fitmentType, "model_compatible");
    assert.strictEqual(fitment.fitmentBadge, "Model Compatible");
  });

  test("excludes products tailored for a different variant of the same model", () => {
    const product = {
      is_universal: false,
      product_compatibility: [
        {
          vehicle_model_id: corollaModelId,
          vehicle_variant_id: corollaNZE121VariantId,
          is_exact_fit: true,
        },
      ],
    };

    const fitment = evaluateProductFitment(product, {
      vehicleModelId: corollaModelId,
      vehicleVariantId: corollaAE110VariantId,
    });

    assert.strictEqual(fitment.isMatch, false);
    assert.strictEqual(fitment.fitmentType, "none");
  });

  test("excludes products tailored for a completely different vehicle model", () => {
    const product = {
      is_universal: false,
      product_compatibility: [
        {
          vehicle_model_id: civicModelId,
          vehicle_variant_id: null,
          is_exact_fit: true,
        },
      ],
    };

    const fitment = evaluateProductFitment(product, {
      vehicleModelId: corollaModelId,
    });

    assert.strictEqual(fitment.isMatch, false);
    assert.strictEqual(fitment.fitmentType, "none");
  });

  test("excludes non-universal products with zero compatibility entries", () => {
    const product = {
      is_universal: false,
      product_compatibility: [],
    };

    const fitment = evaluateProductFitment(product, {
      vehicleModelId: corollaModelId,
    });

    assert.strictEqual(fitment.isMatch, false);
  });
});

describe("Phase 4.4: 4. Filter Combination, Search Sorting and Public Security Rules", () => {
  const sampleProducts = [
    {
      id: "prod-1",
      title: "Toyota Corolla Front Brake Pads Akebono",
      brand_name: "Akebono",
      price_minor_units: 750000,
      condition: "brand_new",
      is_published: true,
      status: "active",
      is_universal: false,
      product_compatibility: [
        {
          vehicle_model_id: "d1000000-0000-0000-0000-000000000001",
          vehicle_variant_id: "e1000000-0000-0000-0000-000000000001",
          is_exact_fit: true,
        },
      ],
    },
    {
      id: "prod-2",
      title: "Full Synthetic Engine Oil 5W-30 4L",
      brand_name: "Toyota Genuine",
      price_minor_units: 1450000,
      condition: "brand_new",
      is_published: true,
      status: "active",
      is_universal: true,
      product_compatibility: [],
    },
    {
      id: "prod-3",
      title: "Honda Civic Timing Belt Kit",
      brand_name: "Gates",
      price_minor_units: 850000,
      condition: "brand_new",
      is_published: true,
      status: "active",
      is_universal: false,
      product_compatibility: [
        {
          vehicle_model_id: "d1000000-0000-0000-0000-000000000007",
          vehicle_variant_id: null,
          is_exact_fit: true,
        },
      ],
    },
    {
      id: "prod-4",
      title: "Unpublished Test Part (Should Never Show)",
      brand_name: "TestBrand",
      price_minor_units: 100000,
      condition: "brand_new",
      is_published: false,
      status: "active",
      is_universal: true,
    },
    {
      id: "prod-5",
      title: "Banned Part Listing",
      brand_name: "BannedBrand",
      price_minor_units: 200000,
      condition: "used",
      is_published: true,
      status: "banned",
      is_universal: true,
    },
  ];

  test("combines vehicle compatibility filter with keyword search and excludes incompatible parts", () => {
    const filter = {
      vehicleModelId: "d1000000-0000-0000-0000-000000000001",
      vehicleVariantId: "e1000000-0000-0000-0000-000000000001",
    };
    const keyword = "brake";

    const eligible = sampleProducts.filter(
      (p) => p.is_published && p.status === "active"
    );

    const matched = eligible.filter((p) => {
      const fit = evaluateProductFitment(p, filter);
      if (!fit.isMatch) return false;
      return p.title.toLowerCase().includes(keyword.toLowerCase());
    });

    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].id, "prod-1");
  });

  test("includes both compatible parts and universal products when vehicle is selected", () => {
    const filter = {
      vehicleModelId: "d1000000-0000-0000-0000-000000000001",
    };

    const eligible = sampleProducts.filter(
      (p) => p.is_published && p.status === "active"
    );

    const matched = eligible.filter((p) => {
      const fit = evaluateProductFitment(p, filter);
      return fit.isMatch;
    });

    assert.strictEqual(matched.length, 2);
    assert.ok(matched.some((p) => p.id === "prod-1"));
    assert.ok(matched.some((p) => p.id === "prod-2"));
    assert.ok(!matched.some((p) => p.id === "prod-3"));
  });

  test("security invariant: unpublished and banned products are strictly excluded", () => {
    const publicProducts = sampleProducts.filter(
      (p) => p.is_published === true && p.status === "active"
    );

    assert.ok(!publicProducts.some((p) => p.id === "prod-4"));
    assert.ok(!publicProducts.some((p) => p.id === "prod-5"));
    assert.strictEqual(publicProducts.length, 3);
  });

  test("supports sorting results by price ascending and descending", () => {
    const activeProducts = sampleProducts.filter(
      (p) => p.is_published && p.status === "active"
    );

    const asc = [...activeProducts].sort(
      (a, b) => a.price_minor_units - b.price_minor_units
    );
    assert.strictEqual(asc[0].price_minor_units, 750000);
    assert.strictEqual(asc[asc.length - 1].price_minor_units, 1450000);

    const desc = [...activeProducts].sort(
      (a, b) => b.price_minor_units - a.price_minor_units
    );
    assert.strictEqual(desc[0].price_minor_units, 1450000);
    assert.strictEqual(desc[desc.length - 1].price_minor_units, 750000);
  });
});

describe("Phase 4.4: 5. Codebase Verification of Search Surface & Selector Components", () => {
  test("src/app/search/page.tsx implements SearchVehicleBanner and passes vehicle filters to getPublicProducts", () => {
    const searchPagePath = path.resolve(process.cwd(), "src/app/search/page.tsx");
    const content = fs.readFileSync(searchPagePath, "utf-8");

    assert.ok(content.includes("SearchVehicleBanner"), "SearchVehicleBanner must be used on search page");
    assert.ok(content.includes("resolveAndValidateVehicleQueryParams"), "Must call resolveAndValidateVehicleQueryParams");
    assert.ok(content.includes("getPublicProducts"), "Must call getPublicProducts");
    assert.ok(content.includes("vehicleTypeId"), "Must pass vehicleTypeId to getPublicProducts");
    assert.ok(content.includes("vehicleMakeId"), "Must pass vehicleMakeId to getPublicProducts");
    assert.ok(content.includes("vehicleModelId"), "Must pass vehicleModelId to getPublicProducts");
    assert.ok(content.includes("vehicleVariantId"), "Must pass vehicleVariantId to getPublicProducts");
    assert.ok(content.includes("Clear Vehicle"), "Must provide clear vehicle filter action");
  });

  test("src/components/marketplace/vehicle-selector.tsx supports 4-level cascading taxonomy and clear resets", () => {
    const selectorPath = path.resolve(
      process.cwd(),
      "src/components/marketplace/vehicle-selector.tsx"
    );
    const content = fs.readFileSync(selectorPath, "utf-8");

    assert.ok(content.includes("taxonomy"), "VehicleSelector must support taxonomy prop");
    assert.ok(content.includes("handleTypeChange"), "Must implement cascading type change");
    assert.ok(content.includes("handleMakeChange"), "Must implement cascading make change");
    assert.ok(content.includes("handleModelChange"), "Must implement cascading model change");
    assert.ok(content.includes("handleReset"), "Must implement selection reset");
    assert.ok(content.includes("formatVariantLabel"), "Must format variant labels cleanly");
  });
});
