/* =====================================================================
   Variant M3 — Manufacturing (AG Grid Community), REDESIGNED
   ---------------------------------------------------------------------
   Same Salesforce record-page chrome as M2, but M3 is now the *fully
   functional* build that answers every manufacturing JTBD with live
   behaviour instead of static indicators:

     JTBD 1  Contract/agreement price defaults        → PriceRenderer + tier engine
     JTBD 2  Volume breaks AUTO-APPLY + next break     → priceFor() reprices live as qty crosses a tier
     JTBD 3  Agreement draw-down (planned vs remaining) → bearings meter recomputes from line qty
     JTBD 4  Rebate / growth-incentive accrual          → accrues from order subtotal, live
     JTBD 5  Kit / BOM expand + per-component swap       → substitute a component, kit re-rolls-up
     JTBD 6  Large-catalog search + saved / reorder      → real quick-filter, saved lists, reorder, add
     JTBD 7  Min qty / order multiples / UoM convert     → enforced stepper + UoM reprice
     JTBD 8  ATP / lead time + requested vs promised      → editable requested date, split detection

   Heuristic (Nielsen) upgrades layered on top:
     • Visibility of status  → live totals, result count, active-tier badge, toasts
     • User control/freedom  → real kebab menu (remove/duplicate), clear-filter, undo-friendly
     • Error prevention      → credit-hold guard + confirm on submit, qty enforcement
     • Recognition not recall → next-break nudge, tooltips, empty state guidance

   Reuses window.M2 helpers (esc/pm/money/enforce/unitWord/ATP_CLASS/chips/
   kit&uom children). Exposes window.setupM2AG(card); app.js dispatches for m3.
   Community-only techniques: custom cell renderers + full-width detail rows
   (Master/Detail is Enterprise-only) + external quick filter.
   ===================================================================== */
(function () {
  "use strict";

  function M() { return window.M2; }
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }

  /* ------- extra catalog rows for "Add from catalog" (JTBD 6) ------- */
  var CATALOG = [
    { num: 11, product: "V-Belt SPZ 1200", category: "Power Transmission", brand: "MoveTech", uom: "Each", list: "$18.50", suggested: "40", promoTiers: [{ q: 20, label: "6% off" }, { q: 50, label: "10% off" }], children: [] },
    { num: 12, product: "Proximity Sensor M18 PNP", category: "Sensors", brand: "AutoLine", uom: "Box of 5", list: "$96.00", suggested: "12", promoTiers: [{ q: 6, label: "5% off" }, { q: 12, label: "9% off" }], children: [] },
    { num: 13, product: "Stainless Cable Gland M20", category: "Electrical", brand: "FastGrip", uom: "Box of 50", list: "$61.00", suggested: "20", promoTiers: [{ q: 10, label: "7% off" }], children: [] }
  ];

  /* ------------------------------ pricing engine ------------------------------ */
  // Parse a percentage discount out of a tier label ("7% off" → 0.07).
  function tierPct(label) { var m = /(\d+(?:\.\d+)?)\s*%/.exec(label || ""); return m ? parseFloat(m[1]) / 100 : 0; }
  function isContractTier(label) { return /contract/i.test(label || ""); }
  function normTiers(row, contractPct) {
    return (row.promoTiers || []).map(function (t) {
      return {
        q: t.q, label: t.label, reward: t.reward, free: t.free || null,
        pct: isContractTier(t.label) ? contractPct : tierPct(t.label),
        isFree: !!t.free || /free/i.test(t.label)
      };
    });
  }
  // Given a line's current qty, find the applied tier + next tier and the
  // effective unit price (best of contract % and the reached volume tier).
  function priceFor(d) {
    var qty = d.qty || 0, best = null, next = null;
    (d.tiers || []).forEach(function (t) {
      if (qty >= t.q) { if (!best || t.q > best.q) best = t; }
      else if (!next || t.q < next.q) next = t;
    });
    var pct = Math.max(d.contractPct || 0, best ? best.pct : 0);
    var unit = Math.round(d.listUnit * (1 - pct) * 100) / 100;
    return {
      pct: pct, unit: unit, applied: best, next: next,
      freeUnits: best && best.isFree ? 1 : 0,
      freeLabel: best && best.isFree ? (best.free || best.label) : null
    };
  }

  /* ---- rowData ---- */
  function toRow(row, aug) {
    var m = M();
    var a = aug || m.AUG[row.num] || { min: 1, mult: 1, atp: { k: "in", t: "In stock" } };
    var kids = m.kitChildrenOf(row);
    var uomKids = m.uomChildrenOf(row);
    var isKit = kids.length > 0;
    var listUnit = m.pm(row.list);
    var contractPct = a.pct || 0;
    var uomOpts = [{ uom: row.uom, unit: listUnit }].concat(
      uomKids.map(function (c) { return { uom: c.uom, unit: m.pm(c.list) }; })
    );
    return {
      id: row.num, _detail: false, num: row.num,
      product: row.product, brand: row.brand, category: row.category,
      uom: row.uom, uomOpts: uomOpts, listUnit: listUnit,
      contractPct: contractPct, pct: contractPct,
      unit: listUnit * (1 - contractPct), qty: a.qty || 0, min: a.min, mult: a.mult,
      held: !!a.quote, atp: a.atp, sub: a.sub || null,
      tiers: normTiers(row, contractPct),
      reqDate: "2026-09-19",
      row: row, a: a, kids: kids, uomKids: uomKids, isKit: isKit,
      swaps: {} // component index → substituted flag (JTBD 5)
    };
  }
  function buildRows() { return (window.MFG_ROWS_M || []).map(function (r) { return toRow(r); }); }

  function detailHeight(d) {
    var hasTiers = (d.tiers || []).length > 0;
    var left = (hasTiers ? 118 : 0) +
      (d.isKit ? d.kids.length * 30 + 86 : (d.uomKids.length ? 72 : 0));
    var right = 108 + (d.row.promoFree ? 52 : 0) +
      ((d.sub || (d.atp && d.atp.k === "partial")) ? 30 : 0);
    return Math.max(left, right, 150) + 30;
  }

  /* ------------------------------- markup builders ------------------------------- */
  // M3 owns these (M2's live in m2.js) so it can add live hooks/ids.
  function agrBarHTML() {
    return (
      '<div class="m2-agr">' +
        '<div class="m2-agr__item">' +
          '<span class="m2-agr__k">Sales Agreement</span>' +
          '<span class="m2-agr__v">SA-4471 <span class="m2-badge m2-badge_ok">Active</span></span>' +
          '<span class="m2-agr__sub">Contracted price book · valid through Mar 2026</span>' +
        "</div>" +
        '<div class="m2-agr__item">' +
          '<span class="m2-agr__k">Bearings commitment</span>' +
          '<div class="m2-meter"><span class="m2-meter__fill" id="m3-draw-fill" style="width:60%"></span></div>' +
          '<span class="m2-agr__sub" id="m3-draw-sub">72 of 120 boxes drawn · 48 remaining</span>' +
        "</div>" +
        '<div class="m2-agr__item">' +
          '<span class="m2-agr__k">Growth rebate</span>' +
          '<span class="m2-agr__v"><span id="m3-rebate-v">$3,200</span> <span class="m2-agr__accr">accruing</span></span>' +
          '<span class="m2-agr__sub" id="m3-rebate-sub">Add $180 this order to unlock the 4% tier</span>' +
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
        '<div class="m2-search"><input type="search" id="m3-search" class="slds-input" ' +
          'placeholder="Search part #, spec or description (e.g. “servo”, “bearing”, “PLC”)…" aria-label="Search catalog"></div>' +
        '<span class="m2-count" id="m3-count" aria-live="polite">10 lines</span>' +
        '<div class="m3-menu-wrap"><button type="button" class="m2-btn m2-btn_light" id="m3-saved" aria-haspopup="true">Saved lists ▾</button></div>' +
        '<button type="button" class="m2-btn m2-btn_light" id="m3-reorder">Reorder from history</button>' +
        '<button type="button" class="m2-btn m2-btn_brand" id="m3-add">+ Add from catalog</button>' +
      "</div>"
    );
  }
  function summaryHTML() {
    return (
      '<div class="m2-sum">' +
        '<div class="m2-sum__lines">' +
          '<div class="m2-sum__row"><span>Subtotal (contract price)</span><span class="m2-sum-subtotal">$0.00</span></div>' +
          '<div class="m2-sum__row m2-sum__save"><span>Volume &amp; contract savings</span><span class="m2-sum-savings">−$0.00</span></div>' +
          '<div class="m2-sum__row"><span>Free goods earned</span><span class="m2-sum-free">None</span></div>' +
          '<div class="m2-sum__row"><span>Freight</span><span>Waived <span class="m2-badge m2-badge_ok">Agreement</span></span></div>' +
          '<div class="m2-sum__row"><span>Rebate impact (this order)</span><span class="m2-sum-rebate">$0.00 · accrues 3%</span></div>' +
          '<div class="m2-sum__row m2-sum__split"><span>Shipments</span><span class="m2-sum-ship">1</span></div>' +
          '<div class="m2-sum__row m2-sum__held"><span>On quote / held</span><span class="m2-sum-held">None</span></div>' +
        "</div>" +
        '<div class="m2-sum__foot">' +
          '<div class="m2-sum__grand"><span>Order total</span><span class="m2-sum-grand">$0.00</span></div>' +
          '<div class="m2-sum__btns"><button type="button" class="m2-btn m2-btn_light" id="m3-quote">Save as quote</button>' +
            '<button type="button" class="m2-btn m2-btn_brand" id="m3-submit">Submit order</button></div>' +
        "</div>" +
      "</div>"
    );
  }
  // Kit BOM with a real per-component Swap affordance (JTBD 5).
  function bomHTML(d) {
    var m = M();
    var rows = d.kids.map(function (c, i) {
      var back = /seal kit/i.test(c.product);
      var swapped = !!d.swaps[i];
      var name = c.product.replace(/^↳\s*/, "");
      return (
        "<tr><td>" + (swapped ? "↔ " : "") + m.esc(name) + (swapped ? " <em>(substitute)</em>" : "") + "</td>" +
        "<td>" + m.esc(c.uom) + "</td>" +
        "<td>" + m.money(m.pm(c.list) * (swapped ? 1.05 : 1)) + "</td>" +
        "<td>" + (back && !swapped
          ? '<span class="m2-atp m2-atp_warn">Backordered</span>'
          : '<span class="m2-atp m2-atp_in">In stock</span>') + "</td>" +
        '<td><button type="button" class="m2-btn m2-btn_mini m2-bom__swap" data-swap="' + i + '">' +
          (swapped ? "Undo" : "Swap") + "</button></td></tr>"
      );
    }).join("");
    var rollup = d.kids.reduce(function (s, c, i) { return s + m.pm(c.list) * (d.swaps[i] ? 1.05 : 1); }, 0);
    return (
      '<div class="m2-d-sec"><div class="m2-d-h">Kit contents (BOM)</div>' +
        '<table class="m2-bom">' + rows +
          '<tr class="m2-bom__roll"><td>Kit price (roll-up)</td><td></td><td>' + m.money(m.pm(d.row.list)) + "</td>" +
          "<td>vs " + m.money(rollup) + " as components</td><td></td></tr>" +
        "</table>" +
        '<div class="m2-d-note">Order as one kit, or swap a component (e.g. a backordered part) — the roll-up updates. Kit ships when all lines are available.</div>' +
      "</div>"
    );
  }
  // Delivery block with an editable requested date (JTBD 8).
  function deliveryHTML(d) {
    var m = M();
    return (
      '<div class="m2-d-sec"><div class="m2-d-h">Delivery &amp; availability</div>' +
        '<div class="m2-deliv"><label class="m2-deliv__req"><b>Requested</b> ' +
          '<input type="date" class="m2-date" value="' + d.reqDate + '" min="2026-09-17" aria-label="Requested delivery date"></label>' +
          "<span><b>Promised:</b> " + m.esc(d.atp.t) + "</span></div>" +
        '<div class="m2-date-warn" hidden>⚠ Requested date is earlier than the promised date — this line may split or expedite.</div>' +
        (d.atp.k === "partial" ? '<div class="m2-split">⚠ Splits into 2 shipments — 2 of 3 items now, seal kit to follow.</div>' : "") +
        (d.sub ? '<div class="m2-split">↔ Discontinued. Suggested substitute: <b>' + m.esc(d.sub) + "</b> " +
          '<button type="button" class="m2-btn m2-btn_mini" data-sub>Use substitute</button></div>' : "") +
      "</div>"
    );
  }
  function detailHTML(d) {
    var m = M();
    return (
      '<div class="m2-detail">' +
        m.ladderHTML(d.row) +
        (d.isKit ? bomHTML(d) : m.altUomHTML(d.uomKids)) +
        m.perkHTML(d.row) +
        deliveryHTML(d) +
      "</div>"
    );
  }

  /* ------------------------------ floating menu helper ------------------------------ */
  var openMenuEl = null;
  function closeMenu() { if (openMenuEl && openMenuEl.parentNode) openMenuEl.parentNode.removeChild(openMenuEl); openMenuEl = null; }
  document.addEventListener("click", function (e) {
    if (openMenuEl && !openMenuEl.contains(e.target) && !e.target.closest("[data-menu-anchor]")) closeMenu();
  });
  function openMenu(anchor, items) {
    closeMenu();
    var menu = el("div", "m3-menu");
    items.forEach(function (it) {
      var b = el("button", "m3-menu__item" + (it.danger ? " m3-menu__item_danger" : ""));
      b.type = "button"; b.textContent = it.label;
      b.addEventListener("click", function () { closeMenu(); it.onClick(); });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.top = (window.scrollY + r.bottom + 4) + "px";
    menu.style.left = (window.scrollX + Math.min(r.left, window.innerWidth - 220)) + "px";
    openMenuEl = menu;
  }

  function toast(card, msg) {
    var t = card.querySelector(".m3-toast") || el("div", "m3-toast");
    t.className = "m3-toast";
    t.textContent = msg;
    if (!t.parentNode) card.appendChild(t);
    // force reflow so the transition re-fires
    void t.offsetWidth;
    t.classList.add("m3-toast_show");
    setTimeout(function () { t.classList.remove("m3-toast_show"); }, 2600);
  }

  /* ------------------------------ renderers ------------------------------ */
  function ExpandRenderer() {}
  ExpandRenderer.prototype.init = function (p) {
    this.p = p;
    this.btn = el("button", "m2-exp"); this.btn.type = "button";
    this.btn.setAttribute("aria-label", "Expand line detail");
    this.sync();
    this.btn.addEventListener("click", function () { p.context.host.toggleRow(p.node); });
  };
  ExpandRenderer.prototype.sync = function () { this.btn.textContent = this.p.data && this.p.data._open ? "▾" : "▸"; };
  ExpandRenderer.prototype.getGui = function () { return this.btn; };
  ExpandRenderer.prototype.refresh = function (p) { this.p = p; this.sync(); return true; };

  function ProductRenderer() {}
  ProductRenderer.prototype.init = function (p) {
    var m = M(), d = p.data, wrap = el("div", "m2-prod");
    wrap.innerHTML =
      '<div class="m2-prod__name">' + m.esc(d.product) + "</div>" +
      '<div class="m2-prod__meta">' + m.esc(d.brand) + " · " + m.esc(d.category) + "</div>" +
      '<div class="m2-chips">' + m.chipsHTML(d.row, d.a, d.isKit) + "</div>";
    this.eGui = wrap;
  };
  ProductRenderer.prototype.getGui = function () { return this.eGui; };
  ProductRenderer.prototype.refresh = function () { return false; };

  function UomRenderer() {}
  UomRenderer.prototype.init = function (p) {
    var d = p.data, sel = el("select", "m2-uom-select");
    sel.setAttribute("aria-label", "Unit of measure");
    d.uomOpts.forEach(function (o, i) {
      var opt = document.createElement("option");
      opt.value = String(i); opt.textContent = o.uom;
      if (o.uom === d.uom) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () { p.context.host.changeUom(p.node, parseInt(sel.value, 10)); });
    this.eGui = sel;
  };
  UomRenderer.prototype.getGui = function () { return this.eGui; };
  UomRenderer.prototype.refresh = function () { return false; };

  function QtyRenderer() {}
  QtyRenderer.prototype.init = function (p) {
    var d = p.data, host = p.context.host;
    var wrap = el("div", "m2-qty-cell");
    wrap.innerHTML =
      '<div class="m2-stepper">' +
        '<button type="button" class="m2-step" data-d="-1" aria-label="Decrease">−</button>' +
        '<input class="m2-qty" type="text" inputmode="numeric" aria-label="Order quantity">' +
        '<button type="button" class="m2-step" data-d="1" aria-label="Increase">+</button>' +
      "</div><div class=\"m2-qty-hint\">Min " + d.min + " · in " + d.mult + "s</div>";
    var input = wrap.querySelector(".m2-qty");
    var hint = wrap.querySelector(".m2-qty-hint");
    input.value = String(d.qty || 0);
    var commit = function (v) { host.setQty(p.node, v, hint); };
    wrap.querySelectorAll(".m2-step").forEach(function (b) {
      b.addEventListener("click", function () {
        commit((p.node.data.qty || 0) + parseInt(b.getAttribute("data-d"), 10) * d.mult);
      });
    });
    input.addEventListener("change", function () { commit(input.value); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commit(input.value); } });
    this.input = input; this.eGui = wrap;
  };
  QtyRenderer.prototype.getGui = function () { return this.eGui; };
  QtyRenderer.prototype.refresh = function (p) { if (this.input) this.input.value = String(p.data.qty || 0); return true; };

  function PriceRenderer() {}
  PriceRenderer.prototype.init = function (p) {
    var m = M(), d = p.data, wrap = el("div", "m2-price");
    var pr = priceFor(d);
    var html = (pr.pct > 0 ? '<span class="m2-price__list">' + m.money(d.listUnit) + "</span>" : "") +
      '<span class="m2-price__now">' + m.money(pr.unit) + "</span>";
    // Active-price badge (visibility of status): show the basis that actually WON.
    // A volume tier only "wins" when its discount beats the standing contract %.
    var volumeWins = pr.applied && !isContractTier(pr.applied.label) && pr.applied.pct > (d.contractPct || 0);
    var hasContract = (d.contractPct || 0) > 0 || (d.tiers || []).some(function (t) { return isContractTier(t.label); });
    var hasTiers = (d.tiers || []).length > 0;
    if (volumeWins) {
      html += '<span class="m2-price__badge m2-price__badge_vol">Volume ' + Math.round(pr.applied.pct * 100) + "%</span>";
    } else if (pr.pct > 0) {
      html += '<span class="m2-price__badge m2-price__badge_con">Contract</span>';
    }
    // Info button — honest label: contract when a contract applies, else the break ladder.
    if (hasContract) {
      html += '<button type="button" class="m2-why" title="Contract SA-4471 — list ' + m.money(d.listUnit) + '. Click for the full price-break ladder.">Contract ⓘ</button>';
    } else if (hasTiers) {
      html += '<button type="button" class="m2-why" title="List ' + m.money(d.listUnit) + '. Click for volume price breaks.">Breaks ⓘ</button>';
    }
    // Next-break nudge (recognition over recall): how many more to reach the next tier.
    if (pr.next) {
      var add = pr.next.q - (d.qty || 0);
      html += '<span class="m2-nudge">＋' + add + " → " + m.esc(pr.next.label) + "</span>";
    }
    wrap.innerHTML = html;
    var why = wrap.querySelector(".m2-why");
    if (why) why.addEventListener("click", function () { p.context.host.toggleRow(p.node, true); });
    this.eGui = wrap;
  };
  PriceRenderer.prototype.getGui = function () { return this.eGui; };
  PriceRenderer.prototype.refresh = function () { return false; };

  function AtpRenderer() {}
  AtpRenderer.prototype.init = function (p) {
    var m = M(), a = p.data.atp || {};
    var span = el("span", "m2-atp " + (m.ATP_CLASS[a.k] || ""));
    span.textContent = a.t || "";
    this.eGui = span;
  };
  AtpRenderer.prototype.getGui = function () { return this.eGui; };
  AtpRenderer.prototype.refresh = function () { return false; };

  function KebabRenderer() {}
  KebabRenderer.prototype.init = function (p) {
    var host = p.context.host;
    this.btn = el("button", "m2-kebab");
    this.btn.type = "button"; this.btn.textContent = "⋯";
    this.btn.setAttribute("aria-label", "Line actions");
    this.btn.setAttribute("data-menu-anchor", "");
    this.btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openMenu(e.currentTarget, [
        { label: "Duplicate line", onClick: function () { host.duplicateRow(p.node); } },
        { label: "Reset quantity", onClick: function () { host.setQty(p.node, 0); } },
        { label: "Remove line", danger: true, onClick: function () { host.removeRow(p.node); } }
      ]);
    });
  };
  KebabRenderer.prototype.getGui = function () { return this.btn; };
  KebabRenderer.prototype.refresh = function () { return false; };

  function DetailRenderer() {}
  DetailRenderer.prototype.init = function (p) {
    var m = M(), d = p.data.parent, host = p.context.host, root = el("div", "m2-detail-host");
    root.innerHTML = detailHTML(d);
    // Discontinued-line substitute
    var sub = root.querySelector("[data-sub]");
    if (sub) sub.addEventListener("click", function () { sub.textContent = "Substituted ✓"; sub.disabled = true; });
    // Kit component swap (JTBD 5) — reprice the kit roll-up in place
    root.querySelectorAll(".m2-bom__swap").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.getAttribute("data-swap"), 10);
        d.swaps[i] = !d.swaps[i];
        host.redrawDetail(d);
      });
    });
    // Editable requested date (JTBD 8)
    var date = root.querySelector(".m2-date");
    var warn = root.querySelector(".m2-date-warn");
    if (date && warn) {
      date.addEventListener("change", function () {
        d.reqDate = date.value;
        // If requested is earlier than a lead-time line's promise, flag a split/expedite.
        var leadish = d.atp && (d.atp.k === "lead" || d.atp.k === "cto" || d.atp.k === "partial");
        warn.hidden = !(leadish && date.value < "2026-09-25");
      });
    }
    m.markTiersIn(root, d.qty || 0);
    this.eGui = root;
  };
  DetailRenderer.prototype.getGui = function () { return this.eGui; };
  DetailRenderer.prototype.refresh = function () { return false; };

  /* --------------------------------- host -------------------------------- */
  function makeHost(card) {
    var m = M();
    var host = {
      api: null,
      query: "",
      columnDefs: [
        { headerName: "", field: "_exp", width: 46, cellRenderer: ExpandRenderer, resizable: false, cellClass: "m2-c-exp" },
        { headerName: "#", field: "num", width: 54, cellClass: "m2-c-num" },
        { headerName: "Product", field: "product", flex: 2, minWidth: 240, cellRenderer: ProductRenderer, wrapText: true, autoHeight: true },
        { headerName: "Unit of measure", field: "uom", width: 170, cellRenderer: UomRenderer },
        { headerName: "Order qty", field: "qty", width: 150, cellRenderer: QtyRenderer },
        { headerName: "Unit price", field: "unit", width: 178, cellRenderer: PriceRenderer, autoHeight: true },
        { headerName: "Availability", field: "avail", width: 220, cellRenderer: AtpRenderer, valueGetter: function (p) { return p.data.atp && p.data.atp.t; } },
        {
          headerName: "Line total", field: "lineTotal", width: 130, type: "rightAligned",
          valueGetter: function (p) { return p.data._detail ? null : (p.data.qty || 0) * (p.data.unit || 0); },
          valueFormatter: function (p) { return p.value ? m.money(p.value) + (p.data.held ? " *" : "") : "—"; },
          cellClass: "m2-c-total"
        },
        { headerName: "", field: "_act", width: 52, resizable: false, cellRenderer: KebabRenderer, cellClass: "m2-c-act" }
      ],

      toggleRow: function (node, forceOpen) {
        var d = node.data;
        if (d._detail) return;
        d._open = forceOpen ? true : !d._open;
        var existing = this.api.getRowNode("d-" + d.id);
        if (d._open && !existing) {
          this.api.applyTransaction({ add: [{ id: d.id, _detail: true, parent: d }], addIndex: node.rowIndex + 1 });
        } else if (!d._open && existing) {
          this.api.applyTransaction({ remove: [{ id: d.id, _detail: true }] });
        }
        this.api.refreshCells({ rowNodes: [node], columns: ["_exp"], force: true });
      },
      redrawDetail: function (d) {
        var det = this.api.getRowNode("d-" + d.id);
        if (det) this.api.redrawRows({ rowNodes: [det] });
      },

      changeUom: function (node, idx) {
        var d = node.data, opt = d.uomOpts[idx] || d.uomOpts[0];
        if (!opt) return;
        d.uom = opt.uom; d.listUnit = opt.unit;
        this.recompute();
      },

      setQty: function (node, raw, hintEl) {
        var d = node.data;
        var requested = m.pm(raw);
        var val = m.enforce(requested, d.min, d.mult);
        if (hintEl && val !== requested) {
          hintEl.classList.add("m2-qty-hint_flash");
          setTimeout(function () { hintEl.classList.remove("m2-qty-hint_flash"); }, 900);
        }
        d.qty = val;
        this.recompute();
        this.redrawDetail(d); // update ladder highlight
      },

      duplicateRow: function (node) {
        var d = node.data;
        var copy = {};
        Object.keys(d).forEach(function (k) { copy[k] = d[k]; });
        copy.id = "c" + Date.now();
        copy._detail = false; copy._open = false; copy.swaps = {};
        this.api.applyTransaction({ add: [copy], addIndex: node.rowIndex + 1 });
        this.recompute();
        toast(card, "Line duplicated");
      },
      removeRow: function (node) {
        var d = node.data;
        var det = this.api.getRowNode("d-" + d.id);
        var rm = [d];
        if (det) rm.push({ id: d.id, _detail: true });
        this.api.applyTransaction({ remove: rm });
        this.recompute();
        toast(card, "Line removed");
      },
      addFromCatalog: function () {
        var self = this, added = 0;
        CATALOG.forEach(function (cat) {
          if (self.api.getRowNode("r-" + cat.num)) return;
          if (added >= 1) return; // add one at a time so the effect is visible
          var aug = { min: 1, mult: 1, atp: { k: "in", t: "In stock · ships Thu Sep 24" }, pct: 0.05 };
          self.api.applyTransaction({ add: [toRow(cat, aug)] });
          added++;
        });
        this.recompute();
        toast(card, added ? "Added from catalog" : "All sample catalog items already on the order");
      },
      reorderHistory: function () {
        var self = this, touched = 0;
        this.api.forEachNode(function (n) {
          var d = n.data; if (!d || d._detail) return;
          var sug = m.pm(d.row && d.row.suggested);
          if (sug > 0) { d.qty = m.enforce(sug, d.min, d.mult); touched++; }
        });
        this.recompute();
        toast(card, touched + " lines set to last-order quantities");
      },

      applyQuery: function (q) {
        this.query = String(q || "").trim().toLowerCase();
        // collapse open details so filtered parents don't leave orphan detail rows
        var self = this, toRemove = [];
        this.api.forEachNode(function (n) {
          if (n.data && n.data._detail) toRemove.push(n.data);
          else if (n.data) n.data._open = false;
        });
        if (toRemove.length) this.api.applyTransaction({ remove: toRemove });
        this.api.onFilterChanged();
        this.updateCount();
      },
      updateCount: function () {
        var total = 0, shown = 0;
        this.api.forEachNode(function (n) { if (n.data && !n.data._detail) total++; });
        shown = this.api.getDisplayedRowCount();
        // displayed count excludes filtered rows; detail rows were collapsed during filter
        var elc = card.querySelector("#m3-count");
        if (elc) elc.textContent = this.query ? ("Showing " + shown + " of " + total + " lines") : (total + " lines");
      },

      recompute: function () {
        if (!this.api) return;
        var sub = 0, sav = 0, free = 0, held = 0, ships = 1;
        var drawBoxes = 0, priceNodes = [];
        this.api.forEachNode(function (n) {
          var d = n.data; if (!d || d._detail) return;
          var pr = priceFor(d);
          d.unit = pr.unit; d.pct = pr.pct;
          priceNodes.push(n);
          if (d.qty > 0) {
            if (d.held) { held++; }
            else { sub += d.qty * d.unit; sav += d.qty * (d.listUnit - d.unit); }
            if (pr.freeUnits) free += pr.freeUnits;
            if (d.atp && d.atp.k === "partial") ships++;
            if (d.num === 1 && /box/i.test(d.uom)) drawBoxes += d.qty;
          }
        });
        this.api.refreshCells({ rowNodes: priceNodes, columns: ["unit", "lineTotal"], force: true });

        var set = function (sel, txt) { var e = card.querySelector(sel); if (e) e.textContent = txt; };
        set(".m2-sum-subtotal", m.money(sub));
        set(".m2-sum-savings", "−" + m.money(sav));
        set(".m2-sum-grand", m.money(sub));
        set(".m2-sum-free", free ? (free + " free unit" + (free > 1 ? "s" : "") + " earned") : "None");
        set(".m2-sum-ship", ships + (ships > 1 ? "  (split)" : ""));
        set(".m2-sum-held", held ? (held + " line" + (held > 1 ? "s" : "") + " — pending approval") : "None");

        // JTBD 4 — rebate accrues live from this order's subtotal (3% base)
        var rebate = sub * 0.03;
        var unlockAt = 25000; // order subtotal that flips the customer to the 4% growth tier
        var remain = Math.max(0, unlockAt - sub);
        set("#m3-rebate-v", m.money(3200 + rebate));
        var rsub = card.querySelector("#m3-rebate-sub");
        if (rsub) rsub.textContent = remain > 0
          ? "Add " + m.money(remain) + " this order to unlock the 4% tier"
          : "4% growth tier unlocked on this order ✓";
        set(".m2-sum-rebate", m.money(rebate) + (remain > 0 ? " · accrues 3%" : " · 4% tier ✓"));

        // JTBD 3 — bearings draw-down recomputes from line 1's box qty
        var base = 72, commit = 120, drawn = base + drawBoxes;
        var pct = Math.min(100, Math.round((drawn / commit) * 100));
        var fill = card.querySelector("#m3-draw-fill");
        if (fill) { fill.style.width = pct + "%"; fill.classList.toggle("m2-meter__fill_over", drawn > commit); }
        var dsub = card.querySelector("#m3-draw-sub");
        if (dsub) dsub.textContent = drawn > commit
          ? (drawn + " of " + commit + " boxes · " + (drawn - commit) + " over commitment")
          : (drawn + " of " + commit + " boxes drawn · " + (commit - drawn) + " remaining");
      }
    };
    return host;
  }

  /* -------------------------------- mount -------------------------------- */
  window.setupM2AG = function (card) {
    if (!card || !window.M2) return;
    var m = M();
    card.classList.add("mfg-m2", "mfg-m3");

    var title = card.querySelector(".mfg-card-title");
    if (title) title.textContent = "Order Lines";
    var subt = card.querySelector(".mfg-selected-count");
    if (subt) subt.textContent = "Kettleworth Foods  ·  Order ON-00000101  ·  Rep: Chantelle  ·  AG Grid";

    var actions = card.querySelector(".mfg-assortment-header__actions");
    if (actions) {
      Array.prototype.slice.call(actions.querySelectorAll(".mfg-toggle, .mfg-template"))
        .forEach(function (elm) { elm.parentNode.removeChild(elm); });
    }

    var filterRow = card.querySelector(".mfg-filter-row");
    if (filterRow) { filterRow.classList.add("m2-context-wrap"); filterRow.innerHTML = agrBarHTML() + toolbarHTML(); }

    var summary = card.querySelector(".mfg-order-summary");
    if (summary) { summary.classList.add("m2-summary"); summary.innerHTML = summaryHTML(); }

    var layout = card.querySelector(".mfg-grid-layout");
    if (!layout) return;
    layout.innerHTML = '<div class="m2-grid-wrap"><div class="ag-theme-quartz m2-grid-theme"></div></div>';
    var mount = layout.querySelector(".m2-grid-theme");

    if (!window.agGrid || !window.agGrid.createGrid) {
      mount.textContent = "AG Grid failed to load from the CDN — check your network.";
      return;
    }

    var host = makeHost(card);
    host.api = window.agGrid.createGrid(mount, {
      theme: "legacy",
      domLayout: "autoHeight",
      columnDefs: host.columnDefs,
      defaultColDef: { resizable: true, sortable: false, suppressMovable: true },
      rowData: buildRows(),
      context: { host: host },
      getRowId: function (p) { return (p.data._detail ? "d-" : "r-") + p.data.id; },
      isFullWidthRow: function (p) { return !!(p.rowNode.data && p.rowNode.data._detail); },
      fullWidthCellRenderer: DetailRenderer,
      getRowHeight: function (p) { return p.data && p.data._detail ? detailHeight(p.data.parent) : undefined; },
      suppressCellFocus: true,
      // JTBD 6 — external quick filter across part #, product, brand, category
      isExternalFilterPresent: function () { return host.query.length > 0; },
      doesExternalFilterPass: function (node) {
        var d = node.data;
        if (!d || d._detail) return true;
        return (d.num + " " + d.product + " " + d.brand + " " + d.category).toLowerCase().indexOf(host.query) >= 0;
      },
      overlayNoRowsTemplate: '<div class="m3-empty">No lines match “<span id="m3-empty-q"></span>”.<br>Try a part number, product name, brand or category.</div>',
      onGridReady: function (p) { host.api = p.api; host.recompute(); host.updateCount(); }
    });

    /* ---- toolbar / summary wiring (JTBD 6 + heuristics) ---- */
    var search = card.querySelector("#m3-search");
    if (search) search.addEventListener("input", function () {
      host.applyQuery(search.value);
      var eq = document.getElementById("m3-empty-q"); if (eq) eq.textContent = search.value;
    });

    var saved = card.querySelector("#m3-saved");
    if (saved) saved.addEventListener("click", function (e) {
      e.stopPropagation();
      openMenu(saved, [
        { label: "Bearings restock", onClick: function () { search.value = "bearing"; host.applyQuery("bearing"); } },
        { label: "PLC / assembly build", onClick: function () { search.value = "PLC"; host.applyQuery("PLC"); } },
        { label: "Raw material & fasteners", onClick: function () { search.value = "steel"; host.applyQuery("steel"); } },
        { label: "Show all lines", onClick: function () { search.value = ""; host.applyQuery(""); } }
      ]);
    });
    saved && saved.setAttribute("data-menu-anchor", "");

    var reorder = card.querySelector("#m3-reorder");
    if (reorder) reorder.addEventListener("click", function () { host.reorderHistory(); });
    var add = card.querySelector("#m3-add");
    if (add) add.addEventListener("click", function () { host.addFromCatalog(); });

    var submit = card.querySelector("#m3-submit");
    if (submit) submit.addEventListener("click", function () {
      // Error prevention (H5): credit hold blocks release; confirm the save-and-hold path.
      var ok = window.confirm("Credit is on hold (invoice #4471-07 past due).\n\nThe order will be SAVED and will ship automatically when the hold is released. Submit now?");
      if (ok) toast(card, "Order ON-00000101 saved — will ship on credit release");
    });
    var quote = card.querySelector("#m3-quote");
    if (quote) quote.addEventListener("click", function () { toast(card, "Saved as quote — sent for 3% approval"); });
  };
})();
