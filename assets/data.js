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
    promo: 2, uom: "Pack of 6", list: "$10.00", suggested: "100", qty: "0",
    discount: "$0.00", netUnit: "$10.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 6, label: "5% off", reward: "5% off the line" },
      { q: 8, label: "10% off", reward: "10% off the line" },
      { q: 12, label: "Free case", reward: "1 case free (6 units)" },
      { q: 18, label: "Free cooler", reward: "1 branded cooler (1 unit)" },
      { q: 24, label: "Free pallet", reward: "1 pallet free (12 units)" }
    ],
    /* promoFree: reward granted simply for adding a product that carries this
       promotion (unlocks as soon as the line is ordered — qty > 0). */
    promoFree: { promo: "Summer Refresh Bundle", label: "Branded display cooler", note: "1 branded cooler (campaign asset)", units: 1, value: 45.0 },
    expanded: true,
    children: [
      { product: "Pepsi Cola 1.0L PET Bottle", category: "Beverages", brand: "Pepsi", promo: 2, uom: "Single Bottle", list: "$1.50", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$1.50", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 12, label: "8% off" }, { q: 18, label: "Free case" }, { q: 24, label: "12% off" } ] },
      { product: "Pepsi Cola 1.0L PET Bottle", category: "Beverages", brand: "Pepsi", promo: 1, uom: "Pack of 24", list: "$40", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$40.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 24, label: "3% off" }, { q: 48, label: "6% off" }, { q: 72, label: "Free pack" } ] },
      { product: "Pepsi Cola 1.0L PET Bottle", category: "Beverages", brand: "Pepsi", promo: 1, uom: "Pack of 100", list: "$80", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$80.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 100, label: "Bulk rate" }, { q: 200, label: "10% off" } ] }
    ]
  },
  {
    num: 2, product: "Pepsi Cola 1.5L PET Bottle", category: "Beverages", brand: "Pepsi",
    promo: 2, uom: "Pack of 6", list: "$15.00", suggested: "120", qty: "0",
    discount: "$0.00", netUnit: "$15.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [
      { q: 6, label: "6% off" }, { q: 12, label: "12% off" }, { q: 18, label: "Free case" }
    ],
    promoFree: { promo: "Peak Season Push", label: "Promotional gift pack", note: "Summer campaign merchandise", units: 1, value: 30.0 },
    expanded: false, children: [
      { product: "Pepsi Cola 1.5L PET Bottle", category: "Beverages", brand: "Pepsi", promo: 2, uom: "Single Bottle", list: "$2.50", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$2.50", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 6, label: "4% off" }, { q: 12, label: "8% off" }, { q: 18, label: "Free case" } ] }
    ]
  },
  {
    num: 3, product: "Pepsi Cola 0.33L Can", category: "Beverages", brand: "Pepsi",
    promo: 1, uom: "Pack of 6", list: "$8.00", suggested: "80", qty: "0",
    discount: "$0.00", netUnit: "$8.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "7% off" }, { q: 12, label: "12% off" }, { q: 18, label: "Free case" } ],
    promoFree: { promo: "Retail Display Program", label: "Counter display unit", note: "Point-of-sale display stand", units: 1, value: 25.0 },
    expanded: false, children: [
      { product: "Pepsi Cola 0.33L Can", category: "Beverages", brand: "Pepsi", promo: 1, uom: "Pack of 24", list: "$28.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$28.00", spPrice: "$0.00", netTotal: "$0.00",
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
    promo: 1, uom: "Pack of 6", list: "$9.50", suggested: "40", qty: "0",
    discount: "$0.00", netUnit: "$9.50", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "9% off" }, { q: 12, label: "15% off" }, { q: 18, label: "Free case" } ],
    promoFree: { promo: "Outdoor Activation", label: "Branded parasol", note: "Outdoor branding asset", units: 1, value: 20.0 }, children: []
  },
  {
    num: 6, product: "Mirinda Orange 1.0L PET", category: "Beverages", brand: "Mirinda",
    promo: 2, uom: "Pack of 6", list: "$11.00", suggested: "90", qty: "0",
    discount: "$0.00", netUnit: "$11.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "5% off" }, { q: 12, label: "10% off" }, { q: 18, label: "Free case" }, { q: 24, label: "Free cooler" } ],
    promoFree: { promo: "Summer Refresh Bundle", label: "Branded ice bucket", note: "Campaign asset", units: 1, value: 22.0 },
    expanded: false, children: [
      { product: "Mirinda Orange 1.0L PET", category: "Beverages", brand: "Mirinda", promo: 1, uom: "Pack of 24", list: "$42.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$42.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 24, label: "4% off" }, { q: 48, label: "8% off" } ] }
    ]
  },
  {
    num: 7, product: "7UP Free 0.5L PET", category: "Beverages", brand: "7UP",
    promo: 1, uom: "Pack of 12", list: "$16.00", suggested: "70", qty: "0",
    discount: "$0.00", netUnit: "$16.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 12, label: "6% off" }, { q: 24, label: "11% off" }, { q: 36, label: "Free case" } ],
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
    promo: 2, uom: "Pack of 6", list: "$13.50", suggested: "85", qty: "0",
    discount: "$0.00", netUnit: "$13.50", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "5% off" }, { q: 12, label: "10% off" }, { q: 18, label: "Free case" }, { q: 24, label: "Free pallet" } ],
    promoFree: { promo: "Peak Season Push", label: "Promotional gift pack", note: "Summer campaign merchandise", units: 1, value: 28.0 },
    expanded: false, children: [
      { product: "Lipton Ice Tea Lemon 0.5L", category: "Beverages", brand: "Lipton", promo: 2, uom: "Single Bottle", list: "$2.30", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$2.30", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 6, label: "4% off" }, { q: 12, label: "9% off" } ] }
    ]
  },
  {
    num: 10, product: "Tropicana Orange 1.0L", category: "Beverages", brand: "Tropicana",
    promo: 1, uom: "Pack of 6", list: "$21.00", suggested: "45", qty: "0",
    discount: "$0.00", netUnit: "$21.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "6% off" }, { q: 12, label: "12% off" }, { q: 18, label: "Free case" } ],
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
    promo: 2, uom: "Pack of 6", list: "$8.50", suggested: "95", qty: "0",
    discount: "$0.00", netUnit: "$8.50", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 6, label: "7% off" }, { q: 12, label: "13% off" }, { q: 18, label: "Free case" }, { q: 24, label: "Free cooler" } ],
    promoFree: { promo: "Outdoor Activation", label: "Branded backpack", note: "Outdoor branding asset", units: 1, value: 24.0 },
    expanded: false, children: [
      { product: "Mountain Dew 0.33L Can", category: "Beverages", brand: "Mountain Dew", promo: 1, uom: "Pack of 24", list: "$30.00", suggested: "0", qty: "0", discount: "$0.00", netUnit: "$30.00", spPrice: "$0.00", netTotal: "$0.00",
        promoTiers: [ { q: 24, label: "5% off" }, { q: 48, label: "9% off" } ] }
    ]
  },
  {
    num: 13, product: "Pepsi Cola 2.0L PET Bottle", category: "Beverages", brand: "Pepsi",
    promo: 1, uom: "Pack of 4", list: "$14.00", suggested: "60", qty: "0",
    discount: "$0.00", netUnit: "$14.00", spPrice: "$0.00", netTotal: "$0.00",
    promoTiers: [ { q: 4, label: "5% off" }, { q: 8, label: "10% off" }, { q: 12, label: "Free case" } ],
    promoFree: { promo: "Summer Refresh Bundle", label: "Branded display cooler", note: "Campaign asset", units: 1, value: 45.0 }, children: []
  }
];
