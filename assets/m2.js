/* =====================================================================
   Variant M2 — "If Salesforce Manufacturing Cloud designed the Orders &
   Pricing grid from scratch."
   ---------------------------------------------------------------------
   Unlike Variant M (which RE-SKINS the CPG telesales grid with mfg data),
   M2 is a purpose-built layout that answers the manufacturing JTBDs
   directly with ONE grid:

     • Agreement context bar   → JTBD 1/3/4/12  (contract price, draw-down,
                                  rebate accrual, credit hold)
     • UoM selector per line   → JTBD 7          (EA / BOX / PALLET convert)
     • Qty stepper + min/mult  → JTBD 7          (enforced, not nudged)
     • Contract price + "why"  → JTBD 1/2        (contracted price, list strike)
     • Availability / ATP chip → JTBD 8          (in stock / lead / partial)
     • Expandable row detail   → JTBD 2/5/8      (price-break ladder, kit BOM,
                                  alt UoMs, agreement perk, delivery + split)
     • Rich order summary      → JTBD 3/4/8/14/15 (savings, freight, rebate,
                                  splits, held/quote lines)

   Self-contained: exposes window.setupM2(card). app.js dispatches to it
   from initCard when data-variant === "m2" and returns early, so none of
   the CPG grid wiring runs for this variant.
   ===================================================================== */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pm(s) { return parseFloat(String(s == null ? "" : s).replace(/[^0-9.\-]/g, "")) || 0; }
  function money(n) {
    return "$" + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function unitWord(uom) {
    uom = String(uom || "");
    if (/pallet/i.test(uom)) return "pallets";
    if (/box/i.test(uom)) return "boxes";
    if (/drum/i.test(uom)) return "drums";
    if (/kit/i.test(uom)) return "kits";
    if (/sheet/i.test(uom)) return "sheets";
    if (/visit/i.test(uom)) return "visits";
    return "units";
  }

  // Per-line augmentation the base dataset doesn't carry: order rules, ATP,
  // contract discount %, and demo qtys that mirror the sample call transcript.
  var AUG = {
    1:  { min: 1, mult: 1, atp: { k: "in",   t: "In stock · ships Thu Sep 18" }, agr: true, pct: 0.08, qty: 10 },
    2:  { min: 1, mult: 1, atp: { k: "lead", t: "1-wk lead · ships Sep 25" },     agr: true, pct: 0.06 },
    3:  { min: 1, mult: 1, atp: { k: "cto",  t: "Configured-to-order · 3-wk lead" },          pct: 0.05 },
    4:  { min: 1, mult: 1, atp: { k: "in",   t: "In stock · ships Thu Sep 18" }, agr: true, contract: true, pct: 0.07, qty: 1 },
    5:  { min: 1, mult: 1, atp: { k: "lead", t: "2-wk priority slot (agreement)" }, agr: true, pct: 0.05, quote: true, qty: 1 },
    6:  { min: 1, mult: 1, atp: { k: "sub",  t: "CB-100 discontinued" },           sub: "Conveyor Belt Section 2m PU CB-110 (+$8)" },
    7:  { min: 4, mult: 2, atp: { k: "in",   t: "Ex-mill · ships Fri Sep 19" },   agr: true, contract: true, pct: 0.0 },
    8:  { min: 1, mult: 1, atp: { k: "in",   t: "In stock · ships Thu Sep 18" },             qty: 1 },
    9:  { min: 1, mult: 1, atp: { k: "partial", t: "Partial — 2 of 3 ship now" },            qty: 1 },
    10: { min: 1, mult: 1, atp: { k: "in",   t: "In stock · ships Thu Sep 18" } }
  };
  var ATP_CLASS = { in: "m2-atp_in", lead: "m2-atp_lead", cto: "m2-atp_cto", partial: "m2-atp_warn", sub: "m2-atp_warn" };

  function kitChildrenOf(row) {
    return (row.children || []).filter(function (c) { return /^↳/.test(c.product); });
  }
  function uomChildrenOf(row) {
    return (row.children || []).filter(function (c) { return !/^↳/.test(c.product); });
  }
  function enforce(val, min, mult) {
    val = Math.round(val || 0);
    if (val <= 0) return 0;
    if (mult > 1) val = Math.ceil(val / mult) * mult;
    if (val < min) val = min;
    return val;
  }

  /* ----------------------------- markup ----------------------------- */

  function agreementBarHTML() {
    return (
      '<div class="m2-agr">' +
        '<div class="m2-agr__item">' +
          '<span class="m2-agr__k">Sales Agreement</span>' +
          '<span class="m2-agr__v">SA-4471 <span class="m2-badge m2-badge_ok">Active</span></span>' +
          '<span class="m2-agr__sub">Contracted price book · valid through Mar 2026</span>' +
        "</div>" +
        '<div class="m2-agr__item">' +
          '<span class="m2-agr__k">Bearings commitment</span>' +
          '<div class="m2-meter"><span class="m2-meter__fill" style="width:60%"></span></div>' +
          '<span class="m2-agr__sub">72 of 120 boxes drawn · 48 remaining</span>' +
        "</div>" +
        '<div class="m2-agr__item">' +
          '<span class="m2-agr__k">Growth rebate</span>' +
          '<span class="m2-agr__v">$3,200 <span class="m2-agr__accr">accruing</span></span>' +
          '<span class="m2-agr__sub">+$180 more this order unlocks the 4% tier</span>' +
        "</div>" +
        '<div class="m2-agr__item">' +
          '<span class="m2-agr__k">Credit</span>' +
          '<span class="m2-agr__v"><span class="m2-badge m2-badge_warn">On hold</span></span>' +
          '<span class="m2-agr__sub">Invoice #4471-07 past due · order saves, ships on release</span>' +
        "</div>" +
      "</div>"
    );
  }

  function toolbarHTML() {
    return (
      '<div class="m2-toolbar">' +
        '<div class="m2-search"><input type="search" class="slds-input" placeholder="Search by part #, spec or description (e.g. “750W servo, 200V, brake”)…" aria-label="Search catalog"></div>' +
        '<button type="button" class="m2-btn m2-btn_light">Saved lists ▾</button>' +
        '<button type="button" class="m2-btn m2-btn_light">Reorder from history</button>' +
        '<button type="button" class="m2-btn m2-btn_brand">+ Add from catalog</button>' +
      "</div>"
    );
  }

  function chipsHTML(row, a, kit) {
    var out = "";
    if (kit) out += '<span class="m2-chip m2-chip_kit">Kit / BOM</span>';
    if (a.agr) out += '<span class="m2-chip m2-chip_agr">Agreement</span>';
    if (a.contract) out += '<span class="m2-chip m2-chip_con">Contract price</span>';
    if ((row.promoTiers || []).some(function (t) { return /free/i.test(t.label); }))
      out += '<span class="m2-chip m2-chip_inc">Incentive</span>';
    if (a.quote) out += '<span class="m2-chip m2-chip_hold">On quote</span>';
    return out;
  }

  function ladderHTML(row) {
    if (!(row.promoTiers && row.promoTiers.length)) return "";
    var word = unitWord(row.uom);
    var tiers = row.promoTiers.map(function (t) {
      var free = /free/i.test(t.label);
      return (
        '<div class="m2-tier' + (free ? " m2-tier_free" : "") + '" data-tierq="' + t.q + '">' +
          '<span class="m2-tier__q">' + t.q + "+ " + esc(word) + "</span>" +
          '<span class="m2-tier__l">' + (free ? "🎁 " : "") + esc(t.label) + "</span>" +
          (t.reward ? '<span class="m2-tier__r">' + esc(t.reward) + "</span>" : "") +
        "</div>"
      );
    }).join("");
    return (
      '<div class="m2-d-sec"><div class="m2-d-h">Volume price breaks</div>' +
        '<div class="m2-ladder">' + tiers + "</div>" +
        '<div class="m2-d-note">Break price applies automatically at each threshold. Current tier highlights as you change qty; “next break” is always visible.</div>' +
      "</div>"
    );
  }

  function bomHTML(row, kids) {
    var rollup = kids.reduce(function (s, c) { return s + pm(c.list); }, 0);
    var rowsHtml = kids.map(function (c) {
      var back = /seal kit/i.test(c.product);
      return (
        "<tr><td>" + esc(c.product.replace(/^↳\s*/, "")) + "</td>" +
        "<td>" + esc(c.uom) + "</td>" +
        "<td>" + money(pm(c.list)) + "</td>" +
        "<td>" + (back
          ? '<span class="m2-atp m2-atp_warn">Backordered</span>'
          : '<span class="m2-atp m2-atp_in">In stock</span>') + "</td></tr>"
      );
    }).join("");
    return (
      '<div class="m2-d-sec"><div class="m2-d-h">Kit contents (BOM)</div>' +
        '<table class="m2-bom">' + rowsHtml +
          '<tr class="m2-bom__roll"><td>Kit price (roll-up)</td><td></td><td>' + money(pm(row.list)) + "</td>" +
          "<td>vs " + money(rollup) + " as components</td></tr>" +
        "</table>" +
        '<div class="m2-d-note">Order as one kit, or expand to swap a component. Kit ships when all lines are available.</div>' +
      "</div>"
    );
  }

  function altUomHTML(kids) {
    if (!kids.length) return "";
    return (
      '<div class="m2-d-sec"><div class="m2-d-h">Also orderable as</div><div class="m2-alt">' +
      kids.map(function (c) { return '<span class="m2-uom-alt">' + esc(c.uom) + " — " + money(pm(c.list)) + "</span>"; }).join("") +
      "</div></div>"
    );
  }

  function perkHTML(row) {
    if (!row.promoFree) return "";
    return (
      '<div class="m2-d-sec"><div class="m2-d-h">Agreement perk</div>' +
        '<div class="m2-perk">✓ ' + esc(row.promoFree.label) +
          ' <span class="m2-perk__note">' + esc(row.promoFree.note) + "</span></div>" +
      "</div>"
    );
  }

  function deliveryHTML(a) {
    return (
      '<div class="m2-d-sec"><div class="m2-d-h">Delivery &amp; availability</div>' +
        '<div class="m2-deliv"><span><b>Requested:</b> Fri, Sep 19</span>' +
          "<span><b>Promised:</b> " + esc(a.atp.t) + "</span></div>" +
        (a.atp.k === "partial" ? '<div class="m2-split">⚠ Splits into 2 shipments — 2 of 3 items now, seal kit to follow.</div>' : "") +
        (a.sub ? '<div class="m2-split">↔ Discontinued. Suggested substitute: <b>' + esc(a.sub) + "</b> " +
          '<button type="button" class="m2-btn m2-btn_mini" data-sub>Use substitute</button></div>' : "") +
      "</div>"
    );
  }

  function detailHTML(row, a, kids, uomKids, isKit) {
    return (
      '<div class="m2-detail">' +
        ladderHTML(row) +
        (isKit ? bomHTML(row, kids) : altUomHTML(uomKids)) +
        perkHTML(row) +
        deliveryHTML(a) +
      "</div>"
    );
  }

  function rowHTML(row) {
    var a = AUG[row.num] || { min: 1, mult: 1, atp: { k: "in", t: "In stock" } };
    var kids = kitChildrenOf(row);
    var uomKids = uomChildrenOf(row);
    var isKit = kids.length > 0;

    var listUnit = pm(row.list);
    var pct = a.pct || 0;
    var unit = listUnit * (1 - pct);
    var qty = a.qty || 0;

    var uomOpts = [{ uom: row.uom, unit: listUnit }].concat(uomKids.map(function (c) { return { uom: c.uom, unit: pm(c.list) }; }));
    var uomSelect = '<select class="m2-uom-select" aria-label="Unit of measure">' +
      uomOpts.map(function (o, i) { return '<option value="' + i + '">' + esc(o.uom) + "</option>"; }).join("") + "</select>";

    var priceCell =
      '<div class="m2-price">' +
        (pct > 0 ? '<span class="m2-price__list">' + money(listUnit) + "</span>" : "") +
        '<span class="m2-price__now">' + money(unit) + "</span>" +
        (a.agr || a.contract
          ? '<button type="button" class="m2-why" data-why title="Contract SA-4471 — list ' + money(listUnit) + '. Click for breaks.">Contract ⓘ</button>'
          : "") +
      "</div>";

    var parent =
      '<tr class="m2-row" data-num="' + row.num + '" data-qty="' + qty + '" data-unit="' + unit + '" data-list="' + listUnit +
        '" data-min="' + a.min + '" data-mult="' + a.mult + '" data-pct="' + pct + '" data-held="' + (a.quote ? 1 : 0) +
        '" data-uoms="' + esc(encodeURIComponent(JSON.stringify(uomOpts))) + '">' +
        '<td class="m2-c-exp"><button type="button" class="m2-exp" data-exp aria-expanded="false" aria-label="Expand line detail">▸</button></td>' +
        '<td class="m2-c-num">' + row.num + "</td>" +
        '<td class="m2-c-prod"><div class="m2-prod"><div class="m2-prod__name">' + esc(row.product) + "</div>" +
          '<div class="m2-prod__meta">' + esc(row.brand) + " · " + esc(row.category) + "</div>" +
          '<div class="m2-chips">' + chipsHTML(row, a, isKit) + "</div></div></td>" +
        '<td class="m2-c-uom">' + uomSelect + "</td>" +
        '<td class="m2-c-qty"><div class="m2-stepper">' +
          '<button type="button" class="m2-step" data-step="-1" aria-label="Decrease">−</button>' +
          '<input class="m2-qty" type="text" inputmode="numeric" value="' + qty + '" aria-label="Order quantity">' +
          '<button type="button" class="m2-step" data-step="1" aria-label="Increase">+</button>' +
        "</div><div class=\"m2-qty-hint\">Min " + a.min + " · in " + a.mult + "s</div></td>" +
        '<td class="m2-c-price">' + priceCell + "</td>" +
        '<td class="m2-c-avail"><span class="m2-atp ' + (ATP_CLASS[a.atp.k] || "") + '">' + esc(a.atp.t) + "</span></td>" +
        '<td class="m2-c-total"><span class="m2-line-total">—</span></td>' +
        '<td class="m2-c-act"><button type="button" class="m2-kebab" aria-label="Line actions">⋯</button></td>' +
      "</tr>";

    var detail =
      '<tr class="m2-detail-row mfg-hidden" data-detail="' + row.num + '"><td colspan="9">' +
        detailHTML(row, a, kids, uomKids, isKit) + "</td></tr>";

    return parent + detail;
  }

  function gridHTML(rows) {
    return (
      '<div class="m2-grid-wrap"><table class="m2-grid" aria-label="Order lines">' +
        "<thead><tr>" +
          '<th class="m2-c-exp"><span class="slds-assistive-text">Expand</span></th>' +
          '<th class="m2-c-num">#</th>' +
          "<th>Product</th>" +
          '<th class="m2-c-uom">Unit of measure</th>' +
          '<th class="m2-c-qty">Order qty</th>' +
          '<th class="m2-c-price">Unit price</th>' +
          '<th class="m2-c-avail">Availability</th>' +
          '<th class="m2-c-total">Line total</th>' +
          '<th class="m2-c-act"><span class="slds-assistive-text">Actions</span></th>' +
        "</tr></thead><tbody>" + rows.map(rowHTML).join("") + "</tbody></table></div>"
    );
  }

  function summaryHTML() {
    return (
      '<div class="m2-sum">' +
        '<div class="m2-sum__lines">' +
          '<div class="m2-sum__row"><span>Subtotal (contract price)</span><span class="m2-sum-subtotal">$0.00</span></div>' +
          '<div class="m2-sum__row m2-sum__save"><span>Volume &amp; contract savings</span><span class="m2-sum-savings">−$0.00</span></div>' +
          '<div class="m2-sum__row"><span>Freight</span><span>Waived <span class="m2-badge m2-badge_ok">Agreement</span></span></div>' +
          '<div class="m2-sum__row"><span>Rebate impact</span><span class="m2-sum-rebate">accrues toward 4% tier</span></div>' +
          '<div class="m2-sum__row m2-sum__split"><span>Shipments</span><span>2 &nbsp;(1 now · 1 to follow)</span></div>' +
          '<div class="m2-sum__row m2-sum__held"><span>On quote / held</span><span class="m2-sum-held">1 line — servo, pending 3% approval</span></div>' +
        "</div>" +
        '<div class="m2-sum__foot">' +
          '<div class="m2-sum__grand"><span>Order total</span><span class="m2-sum-grand">$0.00</span></div>' +
          '<div class="m2-sum__btns"><button type="button" class="m2-btn m2-btn_light">Save as quote</button>' +
            '<button type="button" class="m2-btn m2-btn_brand">Submit order</button></div>' +
        "</div>" +
      "</div>"
    );
  }

  /* --------------------------- behaviour ---------------------------- */

  // Highlight the active/next volume tier inside a detail element, given qty.
  function markTiersIn(detailEl, qty) {
    if (!detailEl) return;
    var tiers = detailEl.querySelectorAll(".m2-tier");
    var currentIdx = -1;
    tiers.forEach(function (el, i) {
      el.classList.remove("m2-tier_on", "m2-tier_next");
      if (qty >= (parseFloat(el.getAttribute("data-tierq")) || 0)) currentIdx = i;
    });
    if (currentIdx >= 0) tiers[currentIdx].classList.add("m2-tier_on");
    if (tiers[currentIdx + 1]) tiers[currentIdx + 1].classList.add("m2-tier_next");
  }
  function markTiers(tr, detailRow) {
    if (!detailRow) return;
    markTiersIn(detailRow, parseFloat(tr.getAttribute("data-qty")) || 0);
  }

  function recompute(card) {
    var sub = 0, sav = 0;
    card.querySelectorAll(".m2-row").forEach(function (tr) {
      var q = parseFloat(tr.getAttribute("data-qty")) || 0;
      var u = parseFloat(tr.getAttribute("data-unit")) || 0;
      var l = parseFloat(tr.getAttribute("data-list")) || 0;
      var held = tr.getAttribute("data-held") === "1";
      var cell = tr.querySelector(".m2-line-total");
      if (cell) cell.textContent = q > 0 ? money(q * u) + (held ? " *" : "") : "—";
      tr.classList.toggle("m2-row_active", q > 0);
      if (q > 0 && !held) { sub += q * u; sav += q * (l - u); }
    });
    var set = function (sel, txt) { var el = card.querySelector(sel); if (el) el.textContent = txt; };
    set(".m2-sum-subtotal", money(sub));
    set(".m2-sum-savings", "−" + money(sav));
    set(".m2-sum-grand", money(sub));
  }

  function detailRowFor(card, tr) {
    return card.querySelector('.m2-detail-row[data-detail="' + tr.getAttribute("data-num") + '"]');
  }

  function toggleDetail(card, tr) {
    var dr = detailRowFor(card, tr);
    if (!dr) return;
    var btn = tr.querySelector(".m2-exp");
    var open = dr.classList.toggle("mfg-hidden") === false;
    if (btn) { btn.setAttribute("aria-expanded", String(open)); btn.textContent = open ? "▾" : "▸"; }
    if (open) markTiers(tr, dr);
  }

  function flashHint(tr) {
    var hint = tr.querySelector(".m2-qty-hint");
    if (!hint) return;
    hint.classList.add("m2-qty-hint_flash");
    setTimeout(function () { hint.classList.remove("m2-qty-hint_flash"); }, 900);
  }

  function commitQty(card, tr, raw) {
    var min = parseFloat(tr.getAttribute("data-min")) || 1;
    var mult = parseFloat(tr.getAttribute("data-mult")) || 1;
    var val = enforce(pm(raw), min, mult);
    var input = tr.querySelector(".m2-qty");
    if (input && String(val) !== String(pm(raw))) flashHint(tr);
    if (input) input.value = val;
    tr.setAttribute("data-qty", val);
    recompute(card);
    markTiers(tr, detailRowFor(card, tr));
  }

  function stepQty(card, tr, dir) {
    var mult = parseFloat(tr.getAttribute("data-mult")) || 1;
    var cur = parseFloat(tr.getAttribute("data-qty")) || 0;
    commitQty(card, tr, cur + dir * mult);
  }

  function changeUom(card, tr, sel) {
    var opts;
    try { opts = JSON.parse(decodeURIComponent(tr.getAttribute("data-uoms") || "[]")); } catch (e) { opts = []; }
    var opt = opts[parseInt(sel.value, 10)] || opts[0];
    if (!opt) return;
    var pct = parseFloat(tr.getAttribute("data-pct")) || 0;
    var unit = opt.unit * (1 - pct);
    tr.setAttribute("data-list", opt.unit);
    tr.setAttribute("data-unit", unit);
    var priceWrap = tr.querySelector(".m2-price");
    if (priceWrap) {
      priceWrap.innerHTML =
        (pct > 0 ? '<span class="m2-price__list">' + money(opt.unit) + "</span>" : "") +
        '<span class="m2-price__now">' + money(unit) + "</span>" +
        (pct > 0 ? '<button type="button" class="m2-why" data-why title="Contract price">Contract ⓘ</button>' : "");
    }
    recompute(card);
  }

  function wire(card) {
    card.addEventListener("click", function (e) {
      var tr, t;
      if ((t = e.target.closest(".m2-exp, .m2-why"))) { tr = t.closest(".m2-row"); if (tr) toggleDetail(card, tr); return; }
      if ((t = e.target.closest(".m2-step"))) { tr = t.closest(".m2-row"); if (tr) stepQty(card, tr, parseInt(t.getAttribute("data-step"), 10)); return; }
      if ((t = e.target.closest("[data-sub]"))) { t.textContent = "Substituted ✓"; t.disabled = true; return; }
    });
    card.addEventListener("change", function (e) {
      var tr = e.target.closest(".m2-row");
      if (!tr) return;
      if (e.target.classList.contains("m2-qty")) commitQty(card, tr, e.target.value);
      else if (e.target.classList.contains("m2-uom-select")) changeUom(card, tr, e.target);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.classList.contains("m2-qty")) {
        e.preventDefault();
        var tr = e.target.closest(".m2-row");
        if (tr) commitQty(card, tr, e.target.value);
      }
    });
  }

  /* ------------------------------ mount ----------------------------- */

  // Shared builders/helpers, reused by the AG Grid variant (assets/m2ag.js) so
  // both variants render byte-identical agreement bar, toolbar, detail and
  // summary markup — only the grid engine differs.
  window.M2 = {
    esc: esc, pm: pm, money: money, unitWord: unitWord, enforce: enforce,
    AUG: AUG, ATP_CLASS: ATP_CLASS,
    kitChildrenOf: kitChildrenOf, uomChildrenOf: uomChildrenOf,
    agreementBarHTML: agreementBarHTML, toolbarHTML: toolbarHTML, chipsHTML: chipsHTML,
    ladderHTML: ladderHTML, bomHTML: bomHTML, altUomHTML: altUomHTML,
    perkHTML: perkHTML, deliveryHTML: deliveryHTML, detailHTML: detailHTML,
    summaryHTML: summaryHTML, markTiersIn: markTiersIn
  };

  window.setupM2 = function (card) {
    if (!card) return;
    var rows = window.MFG_ROWS_M || [];
    card.classList.add("mfg-m2");

    var title = card.querySelector(".mfg-card-title");
    if (title) title.textContent = "Order Lines";
    var subt = card.querySelector(".mfg-selected-count");
    if (subt) subt.textContent = "Kettleworth Foods  ·  Order ON-00000101  ·  Rep: Chantelle";

    // Drop the CPG header toggles/template; keep any "Go to prototype" link.
    var actions = card.querySelector(".mfg-assortment-header__actions");
    if (actions) {
      Array.prototype.slice.call(actions.querySelectorAll(".mfg-toggle, .mfg-template"))
        .forEach(function (el) { el.parentNode.removeChild(el); });
    }

    var filterRow = card.querySelector(".mfg-filter-row");
    if (filterRow) { filterRow.classList.add("m2-context-wrap"); filterRow.innerHTML = agreementBarHTML() + toolbarHTML(); }

    var layout = card.querySelector(".mfg-grid-layout");
    if (layout) layout.innerHTML = gridHTML(rows);

    var summary = card.querySelector(".mfg-order-summary");
    if (summary) { summary.classList.add("m2-summary"); summary.innerHTML = summaryHTML(); }

    wire(card);
    recompute(card);
  };
})();
