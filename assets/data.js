/* Fictitious assortment line-item data for the MFG Orders & Pricing prototype.
   Mirrors the Figma design (Pepsi beverage assortment). Not real product data.

   Promotion tiers drive the gamified Order-Qty popover:
     promoTiers  ascending milestones the buyer can unlock, each { q, label, reward }
                   q       quantity threshold to unlock the tier
                   label   short reward name (shown on the milestone bar)
                   reward  optional longer description
   UoM ("Pack of N") determines the rounding multiple; parsed at render time. */
window.MFG_ROWS = [
  {
    num: 1, product: "Pepsi Cola 1.0L PET Bottle", category: "Beverages", brand: "Pepsi",
    promo: 5, uom: "Pack of 6", list: "$10.00", suggested: "100", qty: "0",
    discount: "$0.00", netUnit: "$10.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 6, label: "5% off", reward: "5% off the line" },
      { q: 8, label: "10% off", reward: "10% off the line" },
      { q: 12, label: "Free case", reward: "1 case free (6 units)" },
      { q: 18, label: "Free cooler", reward: "1 branded cooler (1 unit)" },
      { q: 24, label: "Free pallet", reward: "1 pallet free (12 units)" },
      { q: 30, label: "Free crate", reward: "1 crate free (24 units)" }
    ],
    /* promoFree: reward granted simply for adding a product that carries this
       promotion (unlocks as soon as the line is ordered — qty > 0). */
    promoFree: { promo: "Summer Refresh Bundle", label: "Branded display cooler", note: "1 branded cooler (campaign asset)", units: 1, value: 45.0 },
    expanded: true,
    children: [
      { product: "Pepsi Cola 1.0L PET Bottle", category: "Beverages", brand: "Pepsi", promo: 2, uom: "Single Bottle", list: "$1.50", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$1.50", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 12, label: "8% off" }, { q: 18, label: "Free case" }, { q: 24, label: "12% off" } ] },
      { product: "Pepsi Cola 1.0L PET Bottle", category: "Beverages", brand: "Pepsi", promo: 2, uom: "Pack of 24", list: "$40", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$40.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 24, label: "3% off" }, { q: 48, label: "6% off" }, { q: 72, label: "Free pack" } ] },
      { product: "Pepsi Cola 1.0L PET Bottle", category: "Beverages", brand: "Pepsi", promo: 1, uom: "Pack of 100", list: "$80", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$80.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 100, label: "Bulk rate" }, { q: 200, label: "10% off" } ] }
    ]
  },
  {
    num: 2, product: "Pepsi Cola 1.5L PET Bottle", category: "Beverages", brand: "Pepsi",
    promo: 4, uom: "Pack of 6", list: "$15.00", suggested: "120", qty: "0",
    discount: "$0.00", netUnit: "$15.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 6, label: "6% off" }, { q: 12, label: "12% off" }, { q: 18, label: "Free case", reward: "1 case free (6 units)" },
      { q: 24, label: "Free crate", reward: "1 crate free (24 units)" }, { q: 36, label: "Free cooler", reward: "1 branded cooler (1 unit)" }
    ],
    promoFree: { promo: "Peak Season Push", label: "Promotional gift pack", note: "Summer campaign merchandise", units: 1, value: 30.0 },
    expanded: false, children: [
      { product: "Pepsi Cola 1.5L PET Bottle", category: "Beverages", brand: "Pepsi", promo: 2, uom: "Single Bottle", list: "$2.50", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$2.50", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 6, label: "4% off" }, { q: 12, label: "8% off" }, { q: 18, label: "Free case" } ] }
    ]
  },
  {
    num: 3, product: "Pepsi Cola 0.33L Can", category: "Beverages", brand: "Pepsi",
    promo: 3, uom: "Pack of 6", list: "$8.00", suggested: "80", qty: "0",
    discount: "$0.00", netUnit: "$8.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "7% off" }, { q: 12, label: "12% off" }, { q: 18, label: "Free case", reward: "1 case free (6 units)" }, { q: 24, label: "Free pack", reward: "1 pack free (24 units)" } ],
    promoFree: { promo: "Retail Display Program", label: "Counter display unit", note: "Point-of-sale display stand", units: 1, value: 25.0 },
    expanded: false, children: [
      { product: "Pepsi Cola 0.33L Can", category: "Beverages", brand: "Pepsi", promo: 2, uom: "Pack of 24", list: "$28.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$28.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 24, label: "5% off" }, { q: 48, label: "9% off" }, { q: 72, label: "Free pack" } ] }
    ]
  },
  {
    num: 4, product: "Pepsi Max 0.5L PET", category: "Beverages", brand: "Pepsi",
    promo: 0, uom: "Pack of 12", list: "$18.00", suggested: "60", qty: "0",
    discount: "$0.00", netUnit: "$18.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: []  /* no active promotion → rounding-only popover variant */
  },
  {
    num: 5, product: "7UP 1.0L PET Bottle", category: "Beverages", brand: "Pepsi",
    promo: 4, uom: "Pack of 6", list: "$9.50", suggested: "40", qty: "0",
    discount: "$0.00", netUnit: "$9.50", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "9% off" }, { q: 12, label: "15% off" }, { q: 18, label: "Free case", reward: "1 case free (6 units)" }, { q: 24, label: "Free crate", reward: "1 crate free (24 units)" }, { q: 30, label: "Free tray", reward: "2 trays free (48 units)" } ],
    promoFree: { promo: "Outdoor Activation", label: "Branded parasol", note: "Outdoor branding asset", units: 1, value: 20.0 }, children: []
  },
  {
    num: 6, product: "Mirinda Orange 1.0L PET", category: "Beverages", brand: "Mirinda",
    promo: 5, uom: "Pack of 6", list: "$11.00", suggested: "90", qty: "0",
    discount: "$0.00", netUnit: "$11.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "5% off" }, { q: 12, label: "10% off" }, { q: 18, label: "Free case", reward: "1 case free (6 units)" }, { q: 24, label: "Free cooler", reward: "1 branded cooler (1 unit)" }, { q: 30, label: "Free pallet", reward: "1 pallet free (12 units)" }, { q: 36, label: "Free tray", reward: "1 tray free (24 units)" } ],
    promoFree: { promo: "Summer Refresh Bundle", label: "Branded ice bucket", note: "Campaign asset", units: 1, value: 22.0 },
    expanded: false, children: [
      { product: "Mirinda Orange 1.0L PET", category: "Beverages", brand: "Mirinda", promo: 1, uom: "Pack of 24", list: "$42.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$42.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 24, label: "4% off" }, { q: 48, label: "8% off" } ] }
    ]
  },
  {
    num: 7, product: "7UP Free 0.5L PET", category: "Beverages", brand: "7UP",
    promo: 2, uom: "Pack of 12", list: "$16.00", suggested: "70", qty: "0",
    discount: "$0.00", netUnit: "$16.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 12, label: "6% off" }, { q: 24, label: "11% off" }, { q: 36, label: "Free case", reward: "1 case free (12 units)" } ],
    promoFree: { promo: "Retail Display Program", label: "Shelf strip kit", note: "Point-of-sale merchandising", units: 1, value: 18.0 }, children: []
  },
  {
    num: 8, product: "Gatorade Cool Blue 0.5L", category: "Beverages", brand: "Gatorade",
    promo: 0, uom: "Pack of 12", list: "$24.00", suggested: "50", qty: "0",
    discount: "$0.00", netUnit: "$24.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: []  /* no active promotion → rounding-only popover variant */
  },
  {
    num: 9, product: "Lipton Ice Tea Lemon 0.5L", category: "Beverages", brand: "Lipton",
    promo: 5, uom: "Pack of 6", list: "$13.50", suggested: "85", qty: "0",
    discount: "$0.00", netUnit: "$13.50", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "5% off" }, { q: 12, label: "10% off" }, { q: 18, label: "Free case", reward: "1 case free (6 units)" }, { q: 24, label: "Free pallet", reward: "1 pallet free (12 units)" }, { q: 30, label: "Free crate", reward: "1 crate free (24 units)" }, { q: 36, label: "Free tray", reward: "1 tray free (24 units)" } ],
    promoFree: { promo: "Peak Season Push", label: "Promotional gift pack", note: "Summer campaign merchandise", units: 1, value: 28.0 },
    expanded: false, children: [
      { product: "Lipton Ice Tea Lemon 0.5L", category: "Beverages", brand: "Lipton", promo: 2, uom: "Single Bottle", list: "$2.30", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$2.30", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 6, label: "4% off" }, { q: 12, label: "9% off" } ] }
    ]
  },
  {
    num: 10, product: "Tropicana Orange 1.0L", category: "Beverages", brand: "Tropicana",
    promo: 3, uom: "Pack of 6", list: "$21.00", suggested: "45", qty: "0",
    discount: "$0.00", netUnit: "$21.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "6% off" }, { q: 12, label: "12% off" }, { q: 18, label: "Free case", reward: "1 case free (6 units)" }, { q: 24, label: "Free pallet", reward: "1 pallet free (12 units)" } ],
    promoFree: { promo: "Retail Display Program", label: "Counter chiller", note: "Point-of-sale chiller unit", units: 1, value: 35.0 }, children: []
  },
  {
    num: 11, product: "Aquafina Still Water 0.5L", category: "Beverages", brand: "Aquafina",
    promo: 0, uom: "Pack of 24", list: "$12.00", suggested: "120", qty: "0",
    discount: "$0.00", netUnit: "$12.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: []
  },
  {
    num: 12, product: "Mountain Dew 0.33L Can", category: "Beverages", brand: "Mountain Dew",
    promo: 4, uom: "Pack of 6", list: "$8.50", suggested: "95", qty: "0",
    discount: "$0.00", netUnit: "$8.50", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "7% off" }, { q: 12, label: "13% off" }, { q: 18, label: "Free case", reward: "1 case free (6 units)" }, { q: 24, label: "Free cooler", reward: "1 branded cooler (1 unit)" }, { q: 30, label: "Free crate", reward: "1 crate free (24 units)" } ],
    promoFree: { promo: "Outdoor Activation", label: "Branded backpack", note: "Outdoor branding asset", units: 1, value: 24.0 },
    expanded: false, children: [
      { product: "Mountain Dew 0.33L Can", category: "Beverages", brand: "Mountain Dew", promo: 1, uom: "Pack of 24", list: "$30.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$30.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 24, label: "5% off" }, { q: 48, label: "9% off" } ] }
    ]
  },
  {
    num: 13, product: "Pepsi Cola 2.0L PET Bottle", category: "Beverages", brand: "Pepsi",
    promo: 2, uom: "Pack of 4", list: "$14.00", suggested: "60", qty: "0",
    discount: "$0.00", netUnit: "$14.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 4, label: "5% off" }, { q: 8, label: "10% off" }, { q: 12, label: "Free case", reward: "1 case free (4 units)" } ],
    promoFree: { promo: "Summer Refresh Bundle", label: "Branded display cooler", note: "Campaign asset", units: 1, value: 45.0 }, children: []
  }
];

/* Free-items assortment — loaded into the grid when the Order Item Template
   dropdown is switched to "Free Items". These are the products a buyer can order
   as free items (grouped by category in the Order Summary's "Custom Free items"
   section). They carry no promoTiers / promoFree, so no "+N free items" badge
   appears on their Product-name cells. `category` drives the summary clubbing. */
window.MFG_FREE_ITEM_ROWS = [
  { num: 1, product: "Lay's Classic 52g", category: "Snacks", brand: "Frito-Lay",
    promo: 0, uom: "Case of 6", list: "$12.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$12.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: [] },
  { num: 2, product: "Doritos Nacho 45g", category: "Snacks", brand: "Frito-Lay",
    promo: 0, uom: "Pack of 4", list: "$8.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$8.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: [] },
  { num: 3, product: "Cheetos Crunchy 40g", category: "Snacks", brand: "Frito-Lay",
    promo: 0, uom: "Pack of 4", list: "$7.50", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$7.50", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: [] },
  { num: 4, product: "Pepsi Cola 0.33L Can", category: "Beverages", brand: "Pepsi",
    promo: 0, uom: "Case of 24", list: "$22.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$22.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: [] },
  { num: 5, product: "7UP 0.33L Can", category: "Beverages", brand: "7UP",
    promo: 0, uom: "Case of 24", list: "$20.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$20.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: [] },
  { num: 6, product: "Branded Cooler", category: "Merchandise", brand: "PepsiCo",
    promo: 0, uom: "Each", list: "$45.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$45.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: [] }
];

/* =====================================================================
   MANUFACTURING dataset (Variant M)
   ---------------------------------------------------------------------
   Same record SHAPE as window.MFG_ROWS — proving the telesales ordering
   UI is data-agnostic — but the SEMANTICS are re-skinned for a B2B
   manufacturing order taken against a sales agreement:

     promoTiers  → VOLUME PRICE BREAKS. Milestone labels read "3% off",
                   "Contract price", etc. A milestone whose label matches
                   /free/i is a bundled INCENTIVE (spare kit, calibration,
                   extended warranty) — it flows through the same free-items
                   modal, so the unlock mechanic is reused, not free soda.
                   Free tiers carry an explicit `free` SKU + reward "(N units)".
     promoFree   → SALES-AGREEMENT / order-level perk granted the moment the
                   line is ordered (e.g. waived freight, on-site install).
     children    → for KITS/ASSEMBLIES these are BOM COMPONENTS; for stock
                   items they are alternate order UoMs (Each / Box / Pallet).
     uom         → industrial units (Box of N, Pallet (N), Drum, Each) that
                   drive order-multiple rounding exactly like pack sizes.

   Fictitious products; not real part numbers. ===================== */
window.MFG_ROWS_M = [
  {
    num: 1, product: "Deep-Groove Ball Bearing 6205-2RS", category: "Bearings", brand: "RotoCore",
    promo: 3, uom: "Box of 10", list: "$85.00", suggested: "200", qty: "0",
    discount: "$0.00", netUnit: "$85.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 10, label: "3% off", reward: "3% price break" },
      { q: 50, label: "7% off", reward: "7% price break" },
      { q: 100, label: "12% off", reward: "12% price break" },
      { q: 200, label: "Free service kit", reward: "1 bearing puller kit free (1 unit)", free: "Bearing Puller Kit BP-3", uom: "Each" }
    ],
    /* Order-level agreement perk: unlocks as soon as the line is ordered. */
    promoFree: { promo: "Sales Agreement SA-4471", label: "Freight waived on this line", note: "Agreement perk — inbound freight covered", units: 1, value: 60.0 },
    expanded: true,
    children: [
      { product: "Deep-Groove Ball Bearing 6205-2RS", category: "Bearings", brand: "RotoCore", promo: 1, uom: "Each", list: "$9.50", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$9.50", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 100, label: "5% off" }, { q: 500, label: "9% off" } ] },
      { product: "Deep-Groove Ball Bearing 6205-2RS", category: "Bearings", brand: "RotoCore", promo: 1, uom: "Pallet (48 boxes)", list: "$3,900.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$3,900.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 4, label: "Contract price" }, { q: 8, label: "6% off" } ] }
    ]
  },
  {
    num: 2, product: "Hydraulic Gear Pump HGP-45", category: "Hydraulics", brand: "FluidX",
    promo: 2, uom: "Each", list: "$1,240.00", suggested: "12", qty: "0",
    discount: "$0.00", netUnit: "$1,240.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 5, label: "4% off", reward: "4% price break" },
      { q: 10, label: "8% off", reward: "8% price break" },
      { q: 20, label: "Free warranty", reward: "1 extended warranty free (1 unit)", free: "24-Month Extended Warranty", uom: "Each" }
    ],
    promoFree: { promo: "Sales Agreement SA-4471", label: "On-site commissioning", note: "Agreement perk — field engineer visit", units: 1, value: 350.0 },
    expanded: false, children: []
  },
  {
    /* KIT / ASSEMBLY — children are BOM components, not UoM variants. */
    num: 3, product: "PLC Control Panel Assembly CPX-200", category: "Assemblies / Kits", brand: "AutoLine",
    promo: 2, uom: "Each", list: "$2,850.00", suggested: "8", qty: "0",
    discount: "$0.00", netUnit: "$2,850.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 4, label: "5% off", reward: "5% price break" },
      { q: 8, label: "10% off", reward: "10% price break" },
      { q: 12, label: "Free spares", reward: "1 spare I/O module free (1 unit)", free: "Spare I/O Module IO-16", uom: "Each" }
    ],
    promoFree: { promo: "Configured-to-order", label: "Free wiring schematic pack", note: "As-built documentation set", units: 1, value: 120.0 },
    expanded: true,
    children: [
      { product: "↳ PLC CPU Unit CPU-32", category: "Assemblies / Kits", brand: "AutoLine", promo: 0, uom: "Each", list: "$980.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$980.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [] },
      { product: "↳ 16-Channel I/O Module IO-16", category: "Assemblies / Kits", brand: "AutoLine", promo: 0, uom: "Each", list: "$420.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$420.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [] },
      { product: "↳ DIN-Rail Power Supply 24V", category: "Assemblies / Kits", brand: "AutoLine", promo: 0, uom: "Each", list: "$185.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$185.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [] },
      { product: "↳ Enclosure IP66 600×400", category: "Assemblies / Kits", brand: "AutoLine", promo: 0, uom: "Each", list: "$265.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$265.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [] }
    ]
  },
  {
    num: 4, product: "M12×50 Hex Bolt Grade 8.8 (Zinc)", category: "Fasteners", brand: "FastGrip",
    promo: 3, uom: "Box of 100", list: "$42.00", suggested: "500", qty: "0",
    discount: "$0.00", netUnit: "$42.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 5, label: "4% off", reward: "4% price break" },
      { q: 20, label: "9% off", reward: "9% price break" },
      { q: 50, label: "Contract price", reward: "Agreement tier price" },
      { q: 100, label: "Free hardware", reward: "1 assorted washer pack free (1 unit)", free: "Assorted Washer Pack WP-500", uom: "Pack of 500" }
    ],
    expanded: false, children: [
      { product: "M12×50 Hex Bolt Grade 8.8 (Zinc)", category: "Fasteners", brand: "FastGrip", promo: 1, uom: "Pallet (60 boxes)", list: "$2,400.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$2,400.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 2, label: "Contract price" }, { q: 6, label: "7% off" } ] }
    ]
  },
  {
    num: 5, product: "AC Servo Motor 750W SM-075", category: "Electrical Drives", brand: "AutoLine",
    promo: 2, uom: "Each", list: "$620.00", suggested: "30", qty: "0",
    discount: "$0.00", netUnit: "$620.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 10, label: "5% off", reward: "5% price break" },
      { q: 25, label: "11% off", reward: "11% price break" },
      { q: 50, label: "Free cabling", reward: "1 encoder cable set free (1 unit)", free: "Encoder Cable Set EC-3M", uom: "Each" }
    ],
    promoFree: { promo: "Sales Agreement SA-4471", label: "Priority lead time", note: "Agreement perk — 2-week build slot", units: 1, value: 0 },
    expanded: false, children: []
  },
  {
    num: 6, product: "Conveyor Belt Section 2m PU", category: "Material Handling", brand: "MoveTech",
    promo: 0, uom: "Each", list: "$310.00", suggested: "40", qty: "0",
    discount: "$0.00", netUnit: "$310.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [], children: []  /* no active program → rounding-only qty popover */
  },
  {
    num: 7, product: "Cold-Rolled Steel Sheet 2mm (1.25×2.5m)", category: "Raw Material", brand: "SteelCo",
    promo: 2, uom: "Pallet (25 sheets)", list: "$1,875.00", suggested: "6", qty: "0",
    discount: "$0.00", netUnit: "$1,875.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 4, label: "Contract price", reward: "Agreement tier price" },
      { q: 10, label: "6% off", reward: "6% volume break" },
      { q: 20, label: "9% off", reward: "9% volume break" }
    ],
    promoFree: { promo: "Sales Agreement SA-4471", label: "Mill test certificates", note: "Agreement perk — EN 10204 3.1 certs", units: 1, value: 0 },
    expanded: false, children: [
      { product: "Cold-Rolled Steel Sheet 2mm (1.25×2.5m)", category: "Raw Material", brand: "SteelCo", promo: 0, uom: "Sheet", list: "$78.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$78.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 50, label: "4% off" }, { q: 100, label: "7% off" } ] }
    ]
  },
  {
    num: 8, product: "Synthetic Machine Coolant 200L", category: "Consumables", brand: "LubriPro",
    promo: 1, uom: "Drum", list: "$540.00", suggested: "20", qty: "0",
    discount: "$0.00", netUnit: "$540.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 5, label: "5% off", reward: "5% price break" }, { q: 15, label: "10% off", reward: "10% price break" }, { q: 30, label: "Free disposal", reward: "1 used-coolant collection free (1 unit)", free: "Waste-Coolant Collection Service", uom: "Each" } ],
    expanded: false, children: []
  },
  {
    /* KIT — starter maintenance kit; children are its BOM contents. */
    num: 9, product: "Line Maintenance Starter Kit MK-1", category: "Assemblies / Kits", brand: "RotoCore",
    promo: 1, uom: "Kit", list: "$465.00", suggested: "15", qty: "0",
    discount: "$0.00", netUnit: "$465.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 5, label: "6% off", reward: "6% price break" }, { q: 10, label: "10% off", reward: "10% price break" } ],
    promoFree: { promo: "Configured-to-order", label: "Free storage case", note: "Rugged carry case included", units: 1, value: 40.0 },
    expanded: false,
    children: [
      { product: "↳ Bearing Puller Kit BP-3", category: "Assemblies / Kits", brand: "RotoCore", promo: 0, uom: "Each", list: "$150.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$150.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [] },
      { product: "↳ Torque Wrench 20–100Nm", category: "Assemblies / Kits", brand: "RotoCore", promo: 0, uom: "Each", list: "$185.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$185.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [] },
      { product: "↳ Assorted Seal Kit SK-40", category: "Assemblies / Kits", brand: "RotoCore", promo: 0, uom: "Each", list: "$130.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$130.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [] }
    ]
  },
  {
    num: 10, product: "Pneumatic Cylinder ISO 63×200", category: "Pneumatics", brand: "FluidX",
    promo: 2, uom: "Box of 4", list: "$188.00", suggested: "60", qty: "0",
    discount: "$0.00", netUnit: "$188.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 8, label: "5% off", reward: "5% price break" }, { q: 16, label: "9% off", reward: "9% price break" }, { q: 24, label: "Free seals", reward: "1 seal service kit free (1 unit)", free: "Cylinder Seal Service Kit", uom: "Each" } ],
    expanded: false, children: []
  }
];

/* Free / incentive items orderable in Variant M when the Order Item Template is
   switched to "Free Items" — manufacturing service & spare-part goodwill items
   (grouped by `category` in the Order Summary). No promoTiers/promoFree. */
window.MFG_FREE_ITEM_ROWS_M = [
  { num: 1, product: "Bearing Puller Kit BP-3", category: "Spare Parts", brand: "RotoCore",
    promo: 0, uom: "Each", list: "$150.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$150.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [], children: [] },
  { num: 2, product: "Encoder Cable Set EC-3M", category: "Spare Parts", brand: "AutoLine",
    promo: 0, uom: "Each", list: "$65.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$65.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [], children: [] },
  { num: 3, product: "On-Site Calibration Service", category: "Services", brand: "FluidX",
    promo: 0, uom: "Visit", list: "$280.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$280.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [], children: [] },
  { num: 4, product: "24-Month Extended Warranty", category: "Services", brand: "FluidX",
    promo: 0, uom: "Each", list: "$0.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$0.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [], children: [] },
  { num: 5, product: "Safety Gloves (Cut-5)", category: "Safety / PPE", brand: "GuardPro",
    promo: 0, uom: "Case of 12", list: "$96.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$96.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [], children: [] },
  { num: 6, product: "Equipment O&M Manual (Printed)", category: "Documentation", brand: "AutoLine",
    promo: 0, uom: "Each", list: "$35.00", suggested: "0", qty: "0",
    discount: "$0.00", netUnit: "$35.00", spPrice: "$0.00", netTotal: "$0.00", promoTiers: [], children: [] }
];
