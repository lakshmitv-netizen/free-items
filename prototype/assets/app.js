/* Interactivity for the MFG Orders & Pricing prototype:
   - renders the tree-grid rows from MFG_ROWS
   - tree expand / collapse
   - row + select-all checkboxes update the "N line selected" count
   - editable Order Qty cell with a contextual popover that shows:
       * how much more to order to unlock the next promotion
       * UoM rounding guidance (round-up / round-down badge + rounded value)
   - docked Order Summary collapse
   - lightweight tab switching (visual only) */
(function () {
  "use strict";

  var UTIL = "assets/icons/utility-sprite/svg/symbols.svg";

  // --- helpers ---------------------------------------------------------------
  function icon(sprite, name, cls) {
    return '<svg class="' + (cls || "") + '" aria-hidden="true"><use xlink:href="' + sprite + "#" + name + '"></use></svg>';
  }
  function esc(s) { return String(s == null ? "" : s).replace(/"/g, "&quot;"); }
  function parseMoney(s) { return parseFloat(String(s).replace(/[^0-9.\-]/g, "")) || 0; }
  function fmtMoney(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtNum(n) { return n.toLocaleString("en-US"); }

  // Sales-tax rate applied to the order's net value for the summary totals.
  var TAX_RATE = 0.08;
  // Recompute the Order Summary footer totals from the grid's live Net Total
  // column — Total Price (sum of every line), Total Tax Amount, and Total Price
  // With Tax — so they track order-qty edits in real time.
  // The Net Total figure lives in a .mfg-nettotal-value span so a sibling badge
  // (variant E's "+N free items") can share the cell without being wiped by qty
  // edits or counted into the order total. Writes go through here; reads below
  // pull from the span, ignoring any badge text.
  function setNetTotal(netEl, html) {
    if (!netEl) return;
    var v = netEl.querySelector(".mfg-nettotal-value");
    if (!v) {
      v = document.createElement("span");
      v.className = "mfg-nettotal-value";
      netEl.insertBefore(v, netEl.firstChild);
    }
    v.innerHTML = html;
  }

  function updateOrderTotals(card) {
    if (!card) return;
    var totalsBox = card.querySelector(".mfg-order-summary__totals");
    if (!totalsBox) return;
    var net = 0;
    card.querySelectorAll(".mfg-grid-body .mfg-nettotal-cell").forEach(function (td) {
      var v = td.querySelector(".mfg-nettotal-value");
      net += parseMoney(v ? v.textContent : td.textContent);
    });
    var tax = net * TAX_RATE;
    var vals = totalsBox.querySelectorAll(".mfg-total__value");
    if (vals[0]) vals[0].textContent = fmtMoney(net);          // Total Price
    if (vals[1]) vals[1].textContent = fmtMoney(tax);          // Total Tax Amount
    if (vals[2]) vals[2].textContent = fmtMoney(net + tax);    // Total Price With Tax
  }
  function uomSize(uom) { var m = String(uom || "").match(/(\d+)/); return m ? parseInt(m[1], 10) : 1; }

  function computeRounding(qty, size) {
    if (size <= 1 || qty % size === 0) return { aligned: true, value: qty };
    var lower = Math.floor(qty / size) * size;
    var upper = Math.ceil(qty / size) * size;
    var down = qty - lower, up = upper - qty;
    if (up <= down) return { aligned: false, dir: "up", value: upper, delta: up };
    return { aligned: false, dir: "down", value: lower, delta: down };
  }

  // Promotion templates that populate the hover popover. A row's badge number is
  // the count of active promotions; promoDetailsFor() slices this pool to that
  // count, so the popover always lists exactly `promo` promotions. The first two
  // mirror the Figma "Popover/Default" node (node-id 49:285417) verbatim.
  var PROMO_TEMPLATES = [
    {
      name: "Monsoon Mania 10% OFF",
      tags: [{ label: "Auto Applied", kind: "info" }, { label: "Expiring Soon", kind: "warn" }],
      desc: "Skip the humidity and scoop up exclusive essentials at breezy prices. Shop now to stay cool and save big all season long.",
      exp: "7/31/2026"
    },
    {
      name: "$50 Off on Order above $1000",
      tags: [{ label: "Auto Applied", kind: "info" }, { label: "Conditional", kind: "warn" }, { label: "Expiring Soon", kind: "warn" }],
      desc: "$50 Off on Order Value of $1000 on this product",
      exp: "7/31/2026"
    },
    {
      name: "Volume Rebate 5%",
      tags: [{ label: "Auto Applied", kind: "info" }],
      desc: "Earn a 5% rebate at invoice when you order this product in full cases.",
      exp: "9/30/2026"
    },
    {
      name: "Free Freight over 20 cases",
      tags: [{ label: "Conditional", kind: "warn" }],
      desc: "Waived freight charges on orders of 20 cases or more of this product.",
      exp: "8/31/2026"
    },
    {
      name: "New Buyer Welcome 8% OFF",
      tags: [{ label: "Auto Applied", kind: "info" }, { label: "Expiring Soon", kind: "warn" }],
      desc: "First-time buyers save 8% on this product for a limited introductory window.",
      exp: "7/15/2026"
    }
  ];

  function promoDetailsFor(r) {
    var n = (r && typeof r === "object") ? (r.promo || 0) : (r || 0);
    var out = [];
    for (var i = 0; i < n; i++) out.push(PROMO_TEMPLATES[i % PROMO_TEMPLATES.length]);
    return out;
  }

  function promoCell(r) {
    var promo = (r && typeof r === "object") ? r.promo : r;
    if (!promo) return "";
    var product = (r && typeof r === "object" && r.product) ? r.product : "";
    var uom = (r && typeof r === "object" && r.uom) ? r.uom : "";
    var forWhat = product ? " for " + product + (uom ? " (" + uom + ")" : "") : "";
    var promos = promoDetailsFor(r);
    return '<span class="mfg-promo-badge" tabindex="0" role="button" aria-haspopup="dialog" aria-label="' +
      esc(promo + " promotion" + (promo !== 1 ? "s" : "") + forWhat + ", view details") + '"' +
      ' data-product="' + esc(product) + '"' +
      ' data-promos="' + encodeURIComponent(JSON.stringify(promos)) + '">' +
      icon(UTIL, "promotions", "mfg-promo-glyph") + promo + "</span>";
  }
  // --- promotion hover popover ----------------------------------------------
  var promoPop = null, promoPopBadge = null, promoPopHideTimer = null, promoPopPinned = false;

  function promoItemHTML(p) {
    // role="listitem" + a real heading per promotion so AT/automation can
    // enumerate and navigate the offers (they render as plain divs — the roles
    // are invisible and add no styling). Title is the promotion's heading.
    return '<div class="mfg-promo-pop__item" role="listitem">' +
      '<div class="mfg-promo-pop__title" role="heading" aria-level="3">' + esc(p.name) + "</div>" +
      '<div class="mfg-promo-pop__desc">' + esc(p.desc) + "</div>" +
      '<div class="mfg-promo-pop__exp">Expiration: <strong>' + esc(p.exp) + "</strong></div>" +
      '<a class="mfg-promo-pop__terms" href="#" tabindex="-1">' + icon(UTIL, "chevronright") + "Terms &amp; Conditions</a>" +
      "</div>";
  }
  function ensurePromoPop() {
    if (promoPop) return promoPop;
    promoPop = document.createElement("div");
    promoPop.className = "mfg-promo-pop";
    promoPop.setAttribute("role", "dialog");
    promoPop.setAttribute("aria-label", "Promotions");
    // Focusable container so focus can land on the dialog itself (AT then
    // announces the dialog name + reads its contents, rather than "Close button").
    promoPop.setAttribute("tabindex", "-1");
    promoPop.style.display = "none";
    document.body.appendChild(promoPop);
    promoPop.addEventListener("mouseenter", function () { clearTimeout(promoPopHideTimer); });
    promoPop.addEventListener("mouseleave", hidePromoPop);
    promoPop.addEventListener("click", function (e) {
      if (e.target.closest(".mfg-promo-pop__close")) { hidePromoPopNow(); return; }
      if (e.target.closest(".mfg-promo-pop__terms")) e.preventDefault();
    });
    return promoPop;
  }
  function positionPromoPop(pop, badge) {
    var r = badge.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 10, edge = 8;
    var vw = window.innerWidth, vh = window.innerHeight;
    var left = r.right + gap, flipped = false;
    if (left + pw > vw - edge) { left = r.left - gap - pw; flipped = true; }
    if (left < edge) left = edge;
    var top = r.top - edge;
    if (top + ph > vh - edge) top = vh - edge - ph;
    if (top < edge) top = edge;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    var nub = pop.querySelector(".mfg-promo-pop__nubbin");
    if (nub) {
      nub.classList.toggle("mfg-promo-pop__nubbin_right", flipped);
      var ny = Math.max(6, Math.min(ph - 18, (r.top + r.height / 2) - top - 6));
      nub.style.top = ny + "px";
    }
  }
  function showPromoPop(badge, pin) {
    var promos = [];
    try { promos = JSON.parse(decodeURIComponent(badge.getAttribute("data-promos") || "[]")); } catch (e) { promos = []; }
    if (!promos.length) return;
    clearTimeout(promoPopHideTimer);
    if (pin) promoPopPinned = true;
    var pop = ensurePromoPop();
    if (promoPopBadge === badge && pop.style.display === "block") return;
    promoPopBadge = badge;
    pop.setAttribute("aria-label", "Promotions for " + (badge.getAttribute("data-product") || "product"));
    pop.innerHTML =
      '<div class="mfg-promo-pop__nubbin"></div>' +
      '<button type="button" class="mfg-promo-pop__close" aria-label="Close">' + icon(UTIL, "close") + "</button>" +
      '<div class="mfg-promo-pop__header" role="heading" aria-level="2">' + esc(badge.getAttribute("data-product") || "") + "</div>" +
      '<div class="mfg-promo-pop__body" tabindex="0" role="list" aria-label="' +
        esc(promos.length + " promotion" + (promos.length !== 1 ? "s" : "")) + '">' +
        promos.map(promoItemHTML).join("") + "</div>";
    pop.style.display = "block";
    // Show only two promotions at a time; cap the scroll body to the height of
    // the first two items so the rest reveal on scroll (robust to variable
    // description lengths). ≤2 promos fall back to the CSS max-height.
    var popBody = pop.querySelector(".mfg-promo-pop__body");
    var items = popBody ? popBody.querySelectorAll(".mfg-promo-pop__item") : [];
    if (popBody && items.length > 2) {
      popBody.style.maxHeight = (items[0].offsetHeight + items[1].offsetHeight) + "px";
      popBody.style.overflowY = "auto";
    } else if (popBody) {
      popBody.style.maxHeight = "";
      popBody.style.overflowY = "";
    }
    positionPromoPop(pop, badge);
  }
  function hidePromoPopNow() {
    if (promoPop) { promoPop.style.display = "none"; promoPop.removeAttribute("aria-modal"); }
    promoPopBadge = null;
    promoPopPinned = false;
  }
  function hidePromoPop() {
    // A click-pinned popover ignores hover/focus-out auto-hide; it closes only
    // via the close button, Escape, another badge, or an outside click.
    if (promoPopPinned) return;
    clearTimeout(promoPopHideTimer);
    promoPopHideTimer = setTimeout(hidePromoPopNow, 140);
  }
  document.addEventListener("mouseover", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-promo-badge");
    if (badge) showPromoPop(badge);
  });
  document.addEventListener("mouseout", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-promo-badge");
    if (!badge) return;
    var to = e.relatedTarget;
    if (to && (to.closest(".mfg-promo-badge") === badge || to.closest(".mfg-promo-pop"))) return;
    hidePromoPop();
  });
  document.addEventListener("focusin", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-promo-badge");
    if (badge) showPromoPop(badge);
  });
  document.addEventListener("focusout", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-promo-badge");
    if (badge) hidePromoPop();
  });
  document.addEventListener("click", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-promo-badge");
    if (badge) {
      e.preventDefault();
      // Toggle: a second click on the pinned badge closes it.
      if (promoPopBadge === badge && promoPop && promoPop.style.display === "block" && promoPopPinned) {
        hidePromoPopNow();
      } else {
        showPromoPop(badge, true);
        // Pull focus into the dialog so keyboard/AT/automation land inside it
        // (the grid's a11y tree is large; a body-appended popover is otherwise
        // easy to miss). aria-modal marks it as the active surface.
        if (promoPop) {
          promoPop.setAttribute("aria-modal", "true");
          // Focus the dialog container itself (not the Close button) so AT
          // announces "Promotions for … , dialog" and reads the offer list.
          promoPop.focus();
        }
      }
      return;
    }
    // Click outside a pinned popover dismisses it.
    if (promoPopPinned && promoPop && promoPop.style.display === "block" &&
        !(e.target.closest && e.target.closest(".mfg-promo-pop"))) {
      hidePromoPopNow();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && promoPop && promoPop.style.display === "block") hidePromoPopNow();
  });

  // --- free-items badge hover/click popover ---------------------------------
  // The green "+N free items" badge (mfg-freecount-badge_on) on a Product Name
  // cell opens a popover listing that row's UNLOCKED free items. Same content /
  // computation as updateProductBadges (freeItemsFor filtered by live qty), so
  // the list always matches the badge's count. Mirrors the promo popover's
  // hover-open / click-to-pin behaviour.
  var freePop = null, freePopBadge = null, freePopHideTimer = null, freePopPinned = false;

  // Read the badge's row and return its product name + unlocked free items.
  function freePopDataFor(badge) {
    var tr = badge.closest && badge.closest("tr");
    if (!tr) return { product: "", items: [] };
    var cell = tr.querySelector(".mfg-qty-cell");
    var link = tr.querySelector(".mfg-product-link");
    var qty = parseInt((tr.querySelector(".mfg-qty-value") || {}).textContent, 10) || 0;
    var tiers = [], uom = "";
    if (cell) {
      uom = cell.getAttribute("data-uom") || "";
      try { tiers = JSON.parse(decodeURIComponent(cell.getAttribute("data-tiers") || "[]")); } catch (e) { tiers = []; }
    }
    var net = cell ? (parseFloat(cell.getAttribute("data-net")) || 0) : 0;
    var items = freeItemsFor(tiers, uom)
      .filter(function (it) { return qty >= it.unlockAt; })
      .map(function (it) { return { label: it.label, uom: it.uom, note: it.note, units: it.units, value: it.freeUnits * net }; });
    return { product: link ? link.textContent : "This product", items: items };
  }

  function freePopItemHTML(it) {
    return (
      '<li class="mfg-free-pop__item" role="listitem">' +
        '<div class="mfg-free-pop__item-body">' +
          '<div class="mfg-free-pop__item-name">' + esc(it.label) + "</div>" +
          '<div class="mfg-free-pop__item-meta">' + fmtNum(it.units) + " &times; " + esc(it.uom || "Each") +
            (it.value ? ' &middot; <span class="mfg-free-pop__item-value">' + fmtMoney(it.value) + " value</span>" : "") +
          "</div>" +
        "</div>" +
      "</li>"
    );
  }

  function ensureFreePop() {
    if (freePop) return freePop;
    freePop = document.createElement("div");
    freePop.className = "mfg-free-pop mfg-promo-pop";
    freePop.setAttribute("role", "dialog");
    freePop.setAttribute("aria-label", "Free items");
    freePop.setAttribute("tabindex", "-1");
    freePop.style.display = "none";
    document.body.appendChild(freePop);
    freePop.addEventListener("mouseenter", function () { clearTimeout(freePopHideTimer); });
    freePop.addEventListener("mouseleave", hideFreePop);
    freePop.addEventListener("click", function (e) {
      if (e.target.closest(".mfg-promo-pop__close")) hideFreePopNow();
    });
    return freePop;
  }
  function positionFreePop(pop, badge) {
    var r = badge.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 10, edge = 8;
    var vw = window.innerWidth, vh = window.innerHeight;
    var left = r.right + gap, flipped = false;
    if (left + pw > vw - edge) { left = r.left - gap - pw; flipped = true; }
    if (left < edge) left = edge;
    var top = r.top - edge;
    if (top + ph > vh - edge) top = vh - edge - ph;
    if (top < edge) top = edge;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    var nub = pop.querySelector(".mfg-promo-pop__nubbin");
    if (nub) {
      nub.classList.toggle("mfg-promo-pop__nubbin_right", flipped);
      var ny = Math.max(6, Math.min(ph - 18, (r.top + r.height / 2) - top - 6));
      nub.style.top = ny + "px";
    }
  }
  function showFreePop(badge, pin) {
    var data = freePopDataFor(badge);
    if (!data.items.length) return;
    clearTimeout(freePopHideTimer);
    if (pin) freePopPinned = true;
    var pop = ensureFreePop();
    if (freePopBadge === badge && pop.style.display === "block") return;
    freePopBadge = badge;
    pop.setAttribute("aria-label", "Free items for " + data.product);
    pop.innerHTML =
      '<div class="mfg-promo-pop__nubbin"></div>' +
      '<button type="button" class="mfg-promo-pop__close" aria-label="Close">' + icon(UTIL, "close") + "</button>" +
      '<div class="mfg-promo-pop__header" role="heading" aria-level="2">' +
        esc(data.product) +
        '<span class="mfg-free-pop__count">' + data.items.length + " free item" + (data.items.length !== 1 ? "s" : "") + " unlocked</span>" +
      "</div>" +
      '<ul class="mfg-promo-pop__body mfg-free-pop__body" tabindex="0" role="list">' +
        data.items.map(freePopItemHTML).join("") +
      "</ul>";
    pop.style.display = "block";
    positionFreePop(pop, badge);
  }
  function hideFreePopNow() {
    if (freePop) { freePop.style.display = "none"; freePop.removeAttribute("aria-modal"); }
    freePopBadge = null;
    freePopPinned = false;
  }
  function hideFreePop() {
    if (freePopPinned) return;
    clearTimeout(freePopHideTimer);
    freePopHideTimer = setTimeout(hideFreePopNow, 140);
  }
  document.addEventListener("mouseover", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-freecount-badge_on");
    if (badge) showFreePop(badge);
  });
  document.addEventListener("mouseout", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-freecount-badge_on");
    if (!badge) return;
    var to = e.relatedTarget;
    if (to && (to.closest(".mfg-freecount-badge_on") === badge || to.closest(".mfg-free-pop"))) return;
    hideFreePop();
  });
  document.addEventListener("focusin", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-freecount-badge_on");
    if (badge) showFreePop(badge);
  });
  document.addEventListener("focusout", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-freecount-badge_on");
    if (badge) hideFreePop();
  });
  document.addEventListener("click", function (e) {
    var badge = e.target.closest && e.target.closest(".mfg-freecount-badge_on");
    if (badge) {
      e.preventDefault();
      e.stopPropagation();
      if (freePopBadge === badge && freePop && freePop.style.display === "block" && freePopPinned) {
        hideFreePopNow();
      } else {
        showFreePop(badge, true);
        if (freePop) { freePop.setAttribute("aria-modal", "true"); freePop.focus(); }
      }
      return;
    }
    if (freePopPinned && freePop && freePop.style.display === "block" &&
        !(e.target.closest && e.target.closest(".mfg-free-pop"))) {
      hideFreePopNow();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && freePop && freePop.style.display === "block") { hideFreePopNow(); return; }
    // Enter / Space on a focused badge pins the popover (button semantics).
    if (e.key === "Enter" || e.key === " ") {
      var badge = e.target.closest && e.target.closest(".mfg-freecount-badge_on");
      if (badge) {
        e.preventDefault();
        if (freePopBadge === badge && freePop && freePop.style.display === "block" && freePopPinned) hideFreePopNow();
        else { showFreePop(badge, true); if (freePop) { freePop.setAttribute("aria-modal", "true"); freePop.focus(); } }
      }
    }
  });

  // --- Row-actions menu ------------------------------------------------------
  // The ▾ button on each line opens a small menu with line-level actions. The
  // key job it enables: "Remove line" (sets Order Qty to 0) — the removal path
  // an edge-case rep needs when a SKU was added by mistake.
  var rowMenu = null, rowMenuBtn = null;
  function ensureRowMenu() {
    if (rowMenu) return rowMenu;
    rowMenu = document.createElement("div");
    rowMenu.className = "mfg-rowmenu";
    rowMenu.setAttribute("role", "menu");
    rowMenu.style.display = "none";
    document.body.appendChild(rowMenu);
    return rowMenu;
  }
  function hideRowMenu() {
    if (rowMenu) rowMenu.style.display = "none";
    if (rowMenuBtn) { rowMenuBtn.setAttribute("aria-expanded", "false"); }
    rowMenuBtn = null;
  }
  function showRowMenu(btn) {
    var tr = btn.closest("tr");
    var qtyCell = tr && tr.querySelector(".mfg-qty-cell");
    if (!qtyCell) return;
    var product = (tr.querySelector(".mfg-product-link") || {}).textContent || "this line";
    var suggestedCell = qtyCell.previousElementSibling;
    var suggested = suggestedCell ? (parseInt(suggestedCell.textContent, 10) || 0) : 0;
    var menu = ensureRowMenu();
    rowMenuBtn = btn;
    btn.setAttribute("aria-expanded", "true");
    menu.innerHTML =
      '<button type="button" role="menuitem" class="mfg-rowmenu__item" data-act="suggested">' +
        icon(UTIL, "add", "mfg-rowmenu__icon") + "Set to suggested quantity (" + suggested + ")</button>" +
      '<button type="button" role="menuitem" class="mfg-rowmenu__item mfg-rowmenu__item_danger" data-act="remove">' +
        icon(UTIL, "delete", "mfg-rowmenu__icon") + "Remove line (set quantity to 0)</button>";
    menu._qtyCell = qtyCell;
    menu._suggested = suggested;
    menu._product = product;
    menu.style.display = "block";
    var r = btn.getBoundingClientRect();
    var mw = menu.offsetWidth;
    var left = Math.max(8, r.right - mw);
    var top = r.bottom + 4;
    if (top + menu.offsetHeight > window.innerHeight - 8) top = r.top - menu.offsetHeight - 4;
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    var first = menu.querySelector(".mfg-rowmenu__item");
    if (first) first.focus();
  }
  document.addEventListener("click", function (e) {
    var item = e.target.closest && e.target.closest(".mfg-rowmenu__item");
    if (item && rowMenu) {
      var cell = rowMenu._qtyCell;
      if (item.getAttribute("data-act") === "remove") setLineQty(cell, 0);
      else if (item.getAttribute("data-act") === "suggested") setLineQty(cell, rowMenu._suggested);
      var focusCell = cell;
      hideRowMenu();
      if (focusCell) focusCell.focus();
      return;
    }
    var btn = e.target.closest && e.target.closest(".mfg-row-action");
    if (btn) {
      e.preventDefault();
      if (rowMenuBtn === btn && rowMenu && rowMenu.style.display === "block") hideRowMenu();
      else showRowMenu(btn);
      return;
    }
    if (rowMenu && rowMenu.style.display === "block" && !(e.target.closest && e.target.closest(".mfg-rowmenu"))) {
      hideRowMenu();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && rowMenu && rowMenu.style.display === "block") {
      var b = rowMenuBtn;
      hideRowMenu();
      if (b) b.focus();
    }
  });

  function valueCell(v) { return '<span class="mfg-value-link">' + v + "</span>"; }

  function rowCells(r, variant) {
    // Shared data-* payload the qty-edit logic reads regardless of presentation.
    var qtyData =
      ' data-uom="' + esc(r.uom) + '"' +
      ' data-category="' + esc(r.category || "") + '"' +
      ' data-net="' + parseMoney(r.netUnit) + '"' +
      " data-promofree=\"" + encodeURIComponent(JSON.stringify(r.promoFree || null)) + "\"" +
      " data-tiers=\"" + encodeURIComponent(JSON.stringify(r.promoTiers || [])) + "\"";
    // ---- editable Order Qty cell (click/Enter to edit) ----
    var qtyCellTd =
      '<td class="mfg-num-col mfg-qty-cell" tabindex="0" role="button" aria-label="' +
        esc("Edit Order Qty: " + r.product + " (" + r.uom + "), current " + r.qty) + '"' +
        qtyData + ">" +
        '<span class="mfg-qty-value">' + r.qty + "</span>" +
        '<span class="mfg-qty-pencil">' + icon(UTIL, "edit") + "</span>" +
      "</td>";
    return (
      '<td class="mfg-col-product"><a href="#" class="mfg-product-link">' + r.product + "</a></td>" +
      "<td>" + r.category + "</td>" +
      "<td>" + promoCell(r) + "</td>" +
      "<td>" + r.uom + "</td>" +
      // Money columns render as plain default-black text (they are NOT links);
      // only Net Unit Price keeps the blue value-link treatment below.
      '<td class="mfg-num-col">' + r.list + "</td>" +
      '<td class="mfg-num-col">' + r.suggested + "</td>" +
      qtyCellTd +
      '<td class="mfg-num-col">' + r.discount + "</td>" +
      '<td class="mfg-num-col">' + valueCell(r.netUnit) + "</td>" +
      '<td class="mfg-num-col">' + r.spPrice + "</td>" +
      '<td class="mfg-num-col mfg-nettotal-cell"><span class="mfg-nettotal-value">' + r.netTotal + "</span></td>" +
      '<td class="mfg-col-rowaction"><button class="mfg-row-action" title="Row actions" aria-haspopup="menu" aria-label="' +
        esc("Row actions for " + r.product + " (" + r.uom + ")") + '">' + icon(UTIL, "down") + "</button></td>"
    );
  }

  function checkboxCell(id) {
    return (
      '<td class="mfg-col-check"><span class="slds-checkbox">' +
      '<input type="checkbox" class="mfg-row-check" id="' + id + '" />' +
      '<label class="slds-checkbox__label" for="' + id + '">' +
      '<span class="slds-checkbox_faux"></span>' +
      '<span class="slds-assistive-text">Select row</span></label></span></td>'
    );
  }

  function renderInto(body, prefix, rows) {
    // Derive the variant from the owning card so rowCells can pick the qty-cell
    // presentation (variant E uses a persistent, labeled input). Detached
    // tbodies (e.g. the cart clone) have no card ancestor → legacy button cell.
    var ownerCard = body.closest && body.closest(".mfg-assortment-card");
    var variant = ownerCard ? ownerCard.getAttribute("data-variant") : null;
    var html = "";
    (rows || window.MFG_ROWS).forEach(function (r, i) {
      var hasChildren = r.children && r.children.length;
      var expanded = !!r.expanded;
      html += '<tr class="mfg-parent-row" data-row="' + i + '"><td class="mfg-col-expand">';
      if (hasChildren) {
        html += '<button class="mfg-expand-btn" aria-expanded="' + expanded + '" data-toggle="' + i + '" title="Expand">' + icon(UTIL, "chevronright") + "</button>";
      }
      html += "</td>";
      html += '<td class="mfg-col-num">' + r.num + "</td>";
      html += checkboxCell(prefix + "-r-" + i);
      html += rowCells(r, variant);
      html += "</tr>";

      if (hasChildren) {
        r.children.forEach(function (c, j) {
          html += '<tr class="mfg-child-row' + (expanded ? "" : " mfg-hidden") + '" data-parent="' + i + '">';
          html += '<td class="mfg-col-expand"></td><td class="mfg-col-num"></td>';
          html += checkboxCell(prefix + "-r-" + i + "-" + j);
          html += rowCells(c, variant);
          html += "</tr>";
        });
      }
    });
    body.innerHTML = html;
  }

  function updateCountFor(body, countEl) {
    var checked = body.querySelectorAll(".mfg-row-check:checked").length;
    if (countEl) countEl.textContent = checked + " line" + (checked !== 1 ? "s" : "") + " selected";
  }

  // --- Cart ------------------------------------------------------------------
  // The Cart tab shows the SAME assortment UI (grid + template dropdown + order
  // summary) populated with just the subset of line items the buyer gave an
  // Order Qty (> 0). It is a second .mfg-assortment-card, built by cloning the
  // main one and fed from window.MFG_CART instead of the full catalogs.
  window.MFG_CART = { standard: [], free: [] };
  // Shared references so the Add-to-Cart handler (wired early) and the cart
  // build (wired late) can find each other regardless of source order.
  var CART_STATE = { assortCard: null, cartCard: null };

  // A card's grid-id prefix: the cart card keeps data-variant="b" (for CSS +
  // behaviour) but uses a distinct id prefix so its checkbox ids never collide
  // with the main grid's.
  function gridPrefixOf(card) {
    return card.getAttribute("data-id-prefix") || card.getAttribute("data-variant") || "x";
  }
  // Row data a card should render for a given mode. The cart card draws from the
  // captured subset; every other card from the full catalogs.
  function rowsFor(card, freeMode) {
    if (card && card._isCart) return window.MFG_CART[freeMode ? "free" : "standard"] || [];
    // Variant M carries its own manufacturing dataset; every other card shares
    // the default beverage catalog.
    if (card && card.getAttribute("data-variant") === "m") {
      return freeMode ? (window.MFG_FREE_ITEM_ROWS_M || window.MFG_FREE_ITEM_ROWS) : (window.MFG_ROWS_M || window.MFG_ROWS);
    }
    return freeMode ? window.MFG_FREE_ITEM_ROWS : window.MFG_ROWS;
  }
  // Both catalog bodies for a card: the mounted grid for the current mode, and a
  // detached copy of the other mode's last snapshot (so all free-item sources
  // resolve even though only one catalog is mounted at a time).
  function catalogSources(card) {
    var cache = card._catalogCache || {};
    var body = card.querySelector(".mfg-grid-body");
    function detached(html) { var tb = document.createElement("tbody"); tb.innerHTML = html || ""; return tb; }
    if (card.classList.contains("mfg-mode-free")) return { std: detached(cache.standard), free: body };
    return { std: body, free: detached(cache.free) };
  }

  function qtyOfRow(tr) {
    var el = tr.querySelector(".mfg-qty-value");
    return el ? (parseInt(el.textContent, 10) || 0) : 0;
  }
  // Shallow-copy a data row, stamping the ordered qty and recomputing Net Total.
  function cloneRowData(src, qty) {
    var o = {};
    for (var k in src) { if (src.hasOwnProperty(k)) o[k] = src[k]; }
    o.qty = String(qty);
    o.netTotal = fmtMoney(qty * parseMoney(src.netUnit));
    return o;
  }
  // Read a rendered catalog body and return the data rows (parents / children)
  // that carry an Order Qty > 0 — the cart subset for that catalog.
  function subsetFromBody(body, rows) {
    if (!body || !rows) return [];
    var out = [];
    body.querySelectorAll("tr.mfg-parent-row").forEach(function (tr) {
      var idx = parseInt(tr.getAttribute("data-row"), 10);
      var src = rows[idx];
      if (!src) return;
      var pQty = qtyOfRow(tr);
      var childRows = body.querySelectorAll('tr.mfg-child-row[data-parent="' + idx + '"]');
      var kids = [];
      (src.children || []).forEach(function (c, j) {
        var cTr = childRows[j];
        var cQty = cTr ? qtyOfRow(cTr) : 0;
        if (cQty > 0) kids.push(cloneRowData(c, cQty));
      });
      if (pQty > 0 || kids.length) {
        var pc = cloneRowData(src, pQty);
        pc.children = kids;
        pc.expanded = kids.length > 0;
        out.push(pc);
      }
    });
    return out;
  }
  // Snapshot both catalogs of a card into a fresh { standard, free } cart.
  function subsetFromCard(card) {
    var src = catalogSources(card);
    return {
      standard: subsetFromBody(src.std, rowsFor(card, false)),
      free: subsetFromBody(src.free, rowsFor(card, true))
    };
  }

  // --- Order Qty editing + popover ------------------------------------------
  var edit = null; // { cell, input, popover, netEl }
  var POPOVER_STYLE = "bar"; // "bar" = promo progress + rounding | "rounding" = rounding only

  // Keyboard-focus-to-edit: when a qty cell is reached by Tab, open its editor so
  // keyboard/AT users get a real <input> without a separate click. The flag is
  // set on a Tab keydown and consumed by the very next focusin — so arrow-key
  // column navigation and the post-commit programmatic refocus (neither preceded
  // by Tab) do NOT auto-open the editor. Mouse users are unaffected.
  var qtyTabViaKeyboard = false;
  document.addEventListener("keydown", function (e) {
    if (e.key === "Tab") qtyTabViaKeyboard = true;
  }, true);
  document.addEventListener("focusin", function (e) {
    var wasTab = qtyTabViaKeyboard;
    qtyTabViaKeyboard = false; // consume on any focus move, so it never goes stale
    if (!wasTab) return;
    var qtyCell = e.target.closest && e.target.closest(".mfg-qty-cell");
    if (!qtyCell || e.target !== qtyCell) return; // focus landed on the cell itself
    if (qtyCell.classList.contains("mfg-qty-editing")) return;
    startEdit(qtyCell);
  });

  function nextTier(qty, tiers) {
    for (var i = 0; i < tiers.length; i++) { if (qty < tiers[i].q) return tiers[i]; }
    return null;
  }

  // Caption: how much more to the next unlock (shared by both variations).
  function captionHTML(qty, tiers) {
    var n = nextTier(qty, tiers);
    if (!n) {
      return '<div class="mfg-gg-cap mfg-gg-cap_done">' +
        icon(UTIL, "favorite", "mfg-gg-cap-icon") + "<span>All rewards unlocked</span></div>";
    }
    return '<div class="mfg-gg-cap">' +
      icon(UTIL, "promotions", "mfg-gg-cap-icon") +
      "<span><strong>" + (n.q - qty) + " more</strong> to unlock " +
      '<span class="mfg-gg-reward">' + esc(n.label) + "</span></span></div>";
  }

  // Variation A — gamified milestone progress bar.
  function progressBlock(qty, tiers) {
    if (!tiers || !tiers.length) return "";
    var max = tiers[tiers.length - 1].q;
    var next = nextTier(qty, tiers);
    var fillPct = Math.max(0, Math.min(100, (qty / max) * 100));

    // milestone markers positioned along the track
    var markers = "";
    tiers.forEach(function (t) {
      var pct = (t.q / max) * 100;
      var state = qty >= t.q ? "is-unlocked" : (next && t.q === next.q ? "is-next" : "is-locked");
      var mIcon = qty >= t.q ? "success" : (state === "is-next" ? "promotions" : "lock");
      markers +=
        '<div class="mfg-gg-marker ' + state + '" data-q="' + t.q + '" style="left:' + pct + '%">' +
          '<span class="mfg-gg-dot">' + icon(UTIL, mIcon, "mfg-gg-dot-icon") + "</span>" +
          '<span class="mfg-gg-mq">' + t.q + "</span>" +
          '<span class="mfg-gg-ml">' + esc(t.label) + "</span>" +
        "</div>";
    });

    return (
      '<div class="mfg-gg">' +
        '<div class="mfg-gg-track">' +
          '<div class="mfg-gg-bar"><div class="mfg-gg-fill" style="width:' + fillPct + '%"></div></div>' +
          '<div class="mfg-gg-knob" style="left:' + fillPct + '%"></div>' +
          markers +
        "</div>" +
      "</div>"
    );
  }

  // Variant G: make the milestone progress bar an INTERACTIVE control. The user
  // can drag along the track (or the knob), or click a milestone dot, to set the
  // Order Qty toward the next promotion — the cell input also still accepts
  // typing. Handlers are delegated on the popover element so they survive the
  // innerHTML rebuilds refreshPopover() does on every value change. Setting the
  // value is a live PREVIEW; it commits on Enter / blur like any qty edit.
  function wireGamifiedSlider(ed) {
    var pop = ed.popover;
    if (!pop || !ed.tiers.length) return;
    var max = ed.tiers[ed.tiers.length - 1].q;
    if (!max) return;
    function setQty(q) {
      q = Math.max(0, Math.min(max, Math.round(q)));
      if ((parseInt(ed.input.value, 10) || 0) === q) return;
      ed.input.value = q;
      refreshPopover();
    }
    // Click a milestone dot/label → jump exactly to that threshold.
    pop.addEventListener("click", function (e) {
      var m = e.target.closest(".mfg-gg-marker");
      if (!m) return;
      var q = parseInt(m.getAttribute("data-q"), 10);
      if (!isNaN(q)) { setQty(q); ed.input.focus(); }
    });
    // Drag / click along the track → set qty proportional to pointer position.
    var rect = null;
    function fromX(clientX) { return (clientX - rect.left) / rect.width * max; }
    function onMove(e) { if (rect) setQty(fromX(e.clientX)); }
    function onUp() {
      rect = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    pop.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".mfg-gg-marker")) return; // markers = exact jumps
      var track = pop.querySelector(".mfg-gg-track");
      if (!track || !track.contains(e.target)) return;
      e.preventDefault();
      rect = track.getBoundingClientRect();
      setQty(fromX(e.clientX));
      ed.input.focus();
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  // inline cancel / confirm segmented actions; data-value carries the value ✓ commits.
  function roundActionsHTML(value) {
    return (
      '<div class="mfg-rnd-actions" role="group" aria-label="Confirm quantity change">' +
        '<button class="mfg-rnd-btn mfg-rnd-cancel" title="Cancel" aria-label="Cancel">' +
          icon(UTIL, "close", "mfg-rnd-btn-icon") + "</button>" +
        '<button class="mfg-rnd-btn mfg-rnd-confirm" title="Confirm" aria-label="Confirm" data-value="' + value + '">' +
          icon(UTIL, "check", "mfg-rnd-btn-icon") + "</button>" +
      "</div>"
    );
  }

  // Compact confirm popover for the rounding-only variant:
  //   entered value → rounded value (delta), round up/down badge, inline cancel/confirm.
  function roundingPopoverHTML(typed, size, uom) {
    var round = computeRounding(typed, size);

    if (round.aligned) {
      // entered value already lands on a pack multiple — nothing to round
      return (
        '<div class="mfg-rnd">' +
          '<div class="mfg-rnd-top">' +
            '<div class="mfg-rnd-vals"><span class="mfg-rnd-new">' + fmtNum(typed) + "</span></div>" +
            roundActionsHTML(typed) +
          "</div>" +
          '<span class="mfg-rnd-note">' + icon(UTIL, "check", "mfg-rnd-note-icon") +
            "Multiple of <strong>" + size + "</strong> (" + esc(uom) + ")</span>" +
        "</div>"
      );
    }

    var delta = round.value - typed; // rounded − entered
    var deltaStr = (delta >= 0 ? "+" : "-") + fmtNum(Math.abs(delta));
    var badgeCls = round.dir === "up" ? "mfg-badge-roundup" : "mfg-badge-rounddown";
    var badgeIcon = round.dir === "up" ? "arrowup" : "arrowdown";
    var badgeText = round.dir === "up" ? "Round up" : "Round down";

    return (
      '<div class="mfg-rnd">' +
        '<div class="mfg-rnd-top">' +
          '<div class="mfg-rnd-vals">' +
            '<span class="mfg-rnd-field"><span class="mfg-rnd-label">Entered</span>' +
              '<span class="mfg-rnd-old">' + fmtNum(typed) + "</span></span>" +
            '<span class="mfg-rnd-arrow" aria-hidden="true">→</span>' +
            '<span class="mfg-rnd-field"><span class="mfg-rnd-label">Rounded</span>' +
              '<span class="mfg-rnd-new">' + fmtNum(round.value) + "</span></span>" +
            '<span class="mfg-rnd-delta">(' + deltaStr + ")</span>" +
          "</div>" +
          roundActionsHTML(round.value) +
        "</div>" +
        '<span class="slds-badge ' + badgeCls + ' mfg-rnd-badge">' +
          icon(UTIL, badgeIcon, "mfg-badge-icon") + badgeText +
          " to multiple of " + size + "</span>" +
      "</div>"
    );
  }

  // Stat-pair rounding header shown above the promotion progress:
  //   ENTERED value | ROUNDED value (+delta), Pack-of-N subline.
  // Renders nothing when the entered qty already lands on a pack multiple.
  function roundingStatHeader(typed, size, uom) {
    var round = computeRounding(typed, size);
    if (round.aligned) return "";
    var dirCls = round.dir === "up" ? "mfg-pop-stat__val_up" : "mfg-pop-stat__val_down";
    var delta = (round.dir === "up" ? "+" : "−") + round.delta;
    return (
      '<div class="mfg-pop-stat">' +
        '<div class="mfg-pop-stat__col">' +
          '<span class="mfg-pop-stat__label">Entered</span>' +
          '<span class="mfg-pop-stat__val">' + fmtNum(typed) + "</span>" +
        "</div>" +
        '<span class="mfg-pop-stat__sep" aria-hidden="true">→</span>' +
        '<div class="mfg-pop-stat__col">' +
          '<span class="mfg-pop-stat__label">Rounded</span>' +
          '<span class="mfg-pop-stat__val ' + dirCls + '">' +
            fmtNum(round.value) +
            ' <span class="mfg-pop-stat__delta">(' + delta + ")</span>" +
            ' <span class="mfg-pop-stat__sub">' + esc(uom) + "</span>" +
          "</span>" +
        "</div>" +
      "</div>"
    );
  }

  // hideStats: variant G (gamified) shows only the milestone progress — the
  // Entered → Rounded stat header is suppressed there (kept for Variant A).
  function popoverHTML(orig, qty, size, uom, tiers, hideStats) {
    var showPromo = tiers && tiers.length && POPOVER_STYLE === "bar";
    if (!showPromo) return roundingPopoverHTML(qty, size, uom);

    var promoSection = captionHTML(qty, tiers) + progressBlock(qty, tiers);
    return (
      '<button class="slds-button slds-button_icon slds-popover__close mfg-pop-close" title="Close">' +
        icon(UTIL, "close", "slds-button__icon") + '<span class="slds-assistive-text">Close</span>' +
      "</button>" +
      (hideStats ? "" : roundingStatHeader(qty, size, uom)) +
      '<div class="slds-popover__body mfg-pop-body">' + promoSection + "</div>"
    );
  }

  function refreshPopover() {
    if (!edit) return;
    var qty = parseInt(edit.input.value, 10) || 0;
    edit.popover.innerHTML = popoverHTML(edit.orig, qty, edit.size, edit.uom, edit.tiers, edit.gamified);
    updateFreePanel(qty);
  }

  function positionPopover() {
    var rect = edit.cell.getBoundingClientRect();
    var pop = edit.popover;
    pop.style.top = (rect.bottom + window.scrollY + 10) + "px";
    var left = rect.left + window.scrollX + rect.width / 2 - pop.offsetWidth / 2;
    left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8));
    pop.style.left = left + "px";
  }

  // --- contextual free-items side panel -------------------------------------
  var freePanelExpanded = false; // user choice; collapsed by default

  // Free items are the "Free …" promotion tiers — units come from the reward
  // text ("… (N units)") when given, else the pack size (or 6 for singles).
  // Actual free products granted per reward tier (the abstract tier label maps
  // to a concrete SKU the buyer receives). A tier can override with its own
  // `free` field in the data.
  var FREE_PRODUCTS = {
    "Free case":   "Lay's Classic 52g",
    "Free cooler": "Branded Cooler",
    "Free pallet": "Pepsi Cola 0.33L Can",
    "Free pack":   "Doritos Nacho 45g",
    "Free crate":  "7UP 0.33L Can",
    "Free tray":   "Cheetos Crunchy 40g"
  };
  // Unit of measure for the free item, shown in its own column. Derived from the
  // reward/label wording; appends the pack size when the reward names one.
  function deriveUom(text, count) {
    var r = (text || "").toLowerCase();
    var kind = /pallet/.test(r) ? "Pallet"
             : /crate/.test(r) ? "Crate"
             : /case/.test(r) ? "Case"
             : /pack/.test(r) ? "Pack"
             : null;
    if (kind) return count ? kind + " of " + count : kind;
    return "Each";
  }

  function freeItemsFor(tiers, uom) {
    return (tiers || []).filter(function (t) { return /free/i.test(t.label); }).map(function (t) {
      // Free-item qty = how many of the reward you get (the leading count in
      // "1 case free", "2 crates free"), a small number — not the units inside.
      var lead = /^\s*(\d+)/.exec(t.reward || "");
      var units = lead ? parseInt(lead[1], 10) : 1;
      // freeUnits = number of product units the reward actually contains
      // (the parenthetical "(6 units)"), used to value the freebie.
      var inner = /(\d+)\s*units?/i.exec(t.reward || "");
      var freeUnits = inner ? parseInt(inner[1], 10) : units;
      var product = t.free || FREE_PRODUCTS[t.label] || t.label;
      var itemUom = t.uom || deriveUom(t.reward || t.label, inner ? parseInt(inner[1], 10) : null);
      // Per-tier promotion override: a tier may name its own campaign, or set an
      // empty string to explicitly show "no promotion". Absent → inherit the
      // product's promotion (resolved by the caller). null signals "not set".
      var tierPromo = t.hasOwnProperty("promo") ? t.promo : null;
      return { label: product, uom: itemUom, note: t.reward || "", units: units, freeUnits: freeUnits, unlockAt: t.q, promo: tierPromo };
    });
  }

  // full (expanded) content — header + list or empty state
  function freePanelBody(product, tiers, uom, qty) {
    var items = freeItemsFor(tiers, uom);
    var head =
      '<div class="mfg-free-panel__head">' +
        '<div class="mfg-free-panel__eyebrow">' + icon(UTIL, "discounts", "mfg-free-panel__eyebrow-icon") + "Free items" + "</div>" +
        '<div class="mfg-free-panel__product">' + esc(product) + "</div>" +
      "</div>";

    if (!items.length) {
      return head +
        '<div class="mfg-free-panel__empty">' +
          icon(UTIL, "info", "mfg-free-panel__empty-icon") +
          "<span>No free items available for this product.</span>" +
        "</div>";
    }

    var list = items.map(function (it) {
      var unlocked = qty >= it.unlockAt;
      var remaining = it.unlockAt - qty;
      var stateCls = unlocked ? "is-unlocked" : "is-locked";
      var status = unlocked
        ? '<span class="mfg-free-item__status mfg-free-item__status_on">' + icon(UTIL, "success", "mfg-free-item__status-icon") + "Unlocked</span>"
        : '<span class="mfg-free-item__status">' + icon(UTIL, "lock", "mfg-free-item__status-icon") + fmtNum(remaining) + " more to unlock</span>";
      return (
        '<li class="mfg-free-item ' + stateCls + '">' +
          '<span class="mfg-free-item__qty">' + fmtNum(it.units) + "</span>" +
          '<div class="mfg-free-item__body">' +
            '<div class="mfg-free-item__name">' + esc(it.label) + "</div>" +
            (it.note ? '<div class="mfg-free-item__note">' + esc(it.note) + "</div>" : "") +
            '<div class="mfg-free-item__meta">at ' + fmtNum(it.unlockAt) + " units</div>" +
            status +
          "</div>" +
        "</li>"
      );
    }).join("");

    return head + '<ul class="mfg-free-panel__list">' + list + "</ul>";
  }

  function renderFreePanel(product, tiers, uom, qty) {
    var count = freeItemsFor(tiers, uom).length;
    // collapsed rail — click to expand
    var badge = count ? '<span class="mfg-free-panel__count">' + count + "</span>" : "";
    var rail =
      '<button type="button" class="mfg-free-panel__rail" aria-label="Show free items">' +
        icon(UTIL, "chevronleft", "mfg-free-panel__rail-chevron") +
        icon(UTIL, "discounts", "mfg-free-panel__rail-icon") +
        badge +
        '<span class="mfg-free-panel__rail-label">Free items</span>' +
      "</button>";
    // expanded view — collapse control + full body
    var full =
      '<div class="mfg-free-panel__full">' +
        '<button type="button" class="mfg-free-panel__collapse" aria-label="Hide free items">' +
          icon(UTIL, "chevronright", "mfg-free-panel__collapse-icon") +
        "</button>" +
        freePanelBody(product, tiers, uom, qty) +
      "</div>";
    return rail + full;
  }

  function applyFreePanelState(panel) {
    if (!panel) return;
    panel.classList.toggle("is-collapsed", !freePanelExpanded);
  }

  function showFreePanel(product, tiers, uom, qty) {
    var panel = edit && edit.freePanel;
    if (!panel) return;
    panel.innerHTML = renderFreePanel(product, tiers, uom, qty);
    applyFreePanelState(panel);
    panel.hidden = false;
  }
  function updateFreePanel(qty) {
    var panel = edit && edit.freePanel;
    if (!panel || panel.hidden) return;
    panel.innerHTML = renderFreePanel(edit.product, edit.tiers, edit.uom, qty);
    applyFreePanelState(panel);
  }
  function hideFreePanel() {
    var panel = edit && edit.freePanel;
    if (!panel) return;
    panel.hidden = true;
    panel.innerHTML = "";
  }

  // expand / collapse toggle — delegated so it works for any block's panel
  // (user choice persists across edits and cards)
  document.addEventListener("click", function (e) {
    var rail = e.target.closest(".mfg-free-panel__rail");
    var collapse = e.target.closest(".mfg-free-panel__collapse");
    if (!rail && !collapse) return;
    var panel = (rail || collapse).closest(".mfg-free-panel");
    freePanelExpanded = !!rail;
    applyFreePanelState(panel);
  });

  // --- Variant B: free-items rolled up into the Order Summary ---------------
  // Read the live grid (current qty per product) and derive each product's free
  // items + how many are currently unlocked.
  function collectFreeItems(body) {
    var products = [];
    body.querySelectorAll("tr").forEach(function (tr) {
      var link = tr.querySelector(".mfg-product-link");
      var qtyEl = tr.querySelector(".mfg-qty-value");
      var cell = tr.querySelector(".mfg-qty-cell");
      if (!link || !qtyEl || !cell) return;
      var qty = parseInt(qtyEl.textContent, 10) || 0;
      var net = parseFloat(cell.getAttribute("data-net")) || 0;
      var tiers = [];
      try { tiers = JSON.parse(decodeURIComponent(cell.getAttribute("data-tiers") || "[]")); } catch (e) { tiers = []; }
      var prodUom = cell.getAttribute("data-uom") || "";
      // Promotion carrying this product's rewards — surfaced in the free-items
      // modal's Promotions column. Read from the row's promoFree; falls back to a
      // generic label when the product has no named campaign.
      var prodPromo = "";
      try { var pfp = JSON.parse(decodeURIComponent(cell.getAttribute("data-promofree") || "null")); prodPromo = (pfp && pfp.promo) || ""; } catch (e) { prodPromo = ""; }
      var items = freeItemsFor(tiers, prodUom).map(function (it) {
        // Reward keeps its own promo when the tier set one (including "" for none);
        // otherwise it inherits the product's campaign, and shows blank if neither.
        var rowPromo = (it.promo === null || it.promo === undefined) ? (prodPromo || "") : it.promo;
        return { label: it.label, uom: it.uom, note: it.note, units: it.units, unlockAt: it.unlockAt, value: it.freeUnits * net, unlocked: qty >= it.unlockAt, promo: rowPromo };
      });
      // Key by product + UoM so each UoM line of a product forms its own clubbed
      // group (a product sold as Pack of 6 vs Single Bottle unlocks different
      // rewards, shown as separate rowgroups).
      if (items.length) products.push({
        product: link.textContent, productUom: prodUom,
        prodKey: link.textContent + "␟" + prodUom,
        qty: qty, items: items
      });
    });
    return products;
  }

  // Variant B: decorate each Product Name cell with a right-aligned badge
  // showing how many of that product's free items are unlocked. Products with
  // no free items get a neutral grey badge.
  function updateProductBadges(body) {
    body.querySelectorAll("tr").forEach(function (tr) {
      var link = tr.querySelector(".mfg-product-link");
      var cell = tr.querySelector(".mfg-qty-cell");
      if (!link) return;
      // The unlock badge decorates the Product Name cell (the frozen first column
      // for variants B and E), pinned to the right of the product name.
      var td = link.parentElement;
      td.classList.add("mfg-product-cell");
      var existing = td.querySelector(".mfg-freecount-badge");
      var qty = 0, tiers = [], uom = "";
      var qtyEl = tr.querySelector(".mfg-qty-value");
      if (qtyEl) qty = parseInt(qtyEl.textContent, 10) || 0;
      if (cell) {
        uom = cell.getAttribute("data-uom");
        try { tiers = JSON.parse(decodeURIComponent(cell.getAttribute("data-tiers") || "[]")); } catch (e) { tiers = []; }
      }
      var items = freeItemsFor(tiers, uom);
      var unlocked = items.filter(function (it) { return qty >= it.unlockAt; }).length;
      // Only show the green badge once a free item is actually unlocked. No free
      // items — or none unlocked yet — means no badge at all.
      if (!unlocked) {
        if (existing) existing.remove();
        return;
      }
      var badge = existing;
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "mfg-freecount-badge";
        td.appendChild(badge);
      }
      badge.className = "mfg-freecount-badge mfg-freecount-badge_on";
      badge.textContent = "+" + unlocked + " free item" + (unlocked !== 1 ? "s" : "");
      // Interactive: hover / click / keyboard opens the free-items popover.
      badge.setAttribute("role", "button");
      badge.setAttribute("tabindex", "0");
      badge.setAttribute("aria-haspopup", "dialog");
      badge.title = "View " + unlocked + " unlocked free item" + (unlocked !== 1 ? "s" : "");
    });
  }

  // Variant F only: inject a dedicated "Free Items" column header immediately to
  // the right of "Order Qty". The per-row chips are (re)rendered by
  // updateFreeColumn on every qty edit; both reuse the shared free-items popover.
  function setupFreeColumn(card) {
    var thead = card.querySelector(".mfg-grid thead tr");
    if (!thead) return;
    // Find the "Order Qty" header cell and drop the Free Items column right after it.
    var qtyTh = null;
    thead.querySelectorAll("th").forEach(function (th) {
      var lbl = th.querySelector("[title]");
      if (lbl && lbl.getAttribute("title") === "Order Qty") qtyTh = th;
    });
    if (!qtyTh) return;
    if (!thead.querySelector(".mfg-col-freeitems")) {
      var th = document.createElement("th");
      th.className = "mfg-col-freeitems";
      th.setAttribute("scope", "col");
      th.innerHTML = '<div class="slds-truncate" title="Free Items">Free Items</div>';
      qtyTh.parentNode.insertBefore(th, qtyTh.nextSibling);
    }
    card._freeColReady = true;
    if (card._refreshFreeSummary) card._refreshFreeSummary();
  }

  // Variant F only: render each row's unlocked-free-items chip in the dedicated
  // Free Items column (inserted just after the Order Qty cell). Rows with none
  // show an em-dash placeholder so the column stays aligned.
  function updateFreeColumn(body) {
    var card = body.closest && body.closest(".mfg-assortment-card");
    if (!card || !card._freeColReady) return;
    body.querySelectorAll("tr").forEach(function (tr) {
      var cell = tr.querySelector(".mfg-qty-cell");
      if (!cell) return;
      // Find (or create) the free-items <td> immediately after the qty cell.
      var td = tr.querySelector(".mfg-col-freeitems");
      if (!td) {
        td = document.createElement("td");
        td.className = "mfg-col-freeitems";
        cell.parentNode.insertBefore(td, cell.nextSibling);
      }
      var qty = 0, tiers = [], uom = "";
      var qtyEl = tr.querySelector(".mfg-qty-value");
      if (qtyEl) qty = parseInt(qtyEl.textContent, 10) || 0;
      uom = cell.getAttribute("data-uom") || "";
      try { tiers = JSON.parse(decodeURIComponent(cell.getAttribute("data-tiers") || "[]")); } catch (e) { tiers = []; }
      var unlocked = freeItemsFor(tiers, uom).filter(function (it) { return qty >= it.unlockAt; }).length;
      if (!unlocked) {
        td.innerHTML = '<span class="mfg-freeitems-empty" aria-hidden="true">&mdash;</span>';
        return;
      }
      td.innerHTML =
        '<span class="mfg-freecount-badge mfg-freecount-badge_on" role="button" tabindex="0" ' +
          'aria-haspopup="dialog" title="View ' + unlocked + ' unlocked free item' + (unlocked !== 1 ? "s" : "") + '">' +
          "+" + unlocked + " free item" + (unlocked !== 1 ? "s" : "") +
        "</span>";
    });
  }

  // Free items can be earned three ways, each shown in its own accordion:
  //   • Promotion-related — granted for adding a product that carries a promotion
  //     (unlocks as soon as the line is ordered). Source: each row's promoFree.
  //   • Product-related    — order-quantity milestones on the product's promo tiers
  //     (unlock by reaching a qty threshold). Source: collectFreeItems().
  //   • Custom free items — free items the buyer orders from the free-items grid
  //     (loaded when the Order Item Template dropdown is set to "Free Items").
  //     Source: collectDirectFree(), which reads the grid rows in free mode.
  var FREE_SUMMARY_REFRESH = []; // refresh callbacks for every wired free-summary
  function refreshAllFreeSummaries() { FREE_SUMMARY_REFRESH.forEach(function (fn) { fn(); }); }

  // Cart-level example offers: unlike product rewards, these aren't tied to a
  // single line — they apply to the order as a whole (a festival campaign, a
  // cart-value threshold, …). Shown as illustrative examples once anything is
  // ordered, so the Offers section demonstrates more than product-bundle offers.
  var CART_LEVEL_OFFERS = [
    { promo: "Diwali offer", label: "Festive gift hamper", note: "Seasonal festival campaign", units: 1, uom: "Each", value: 55.0 },
    { promo: "Cart level offer", label: "Assorted snack pack", note: "Unlocked on qualifying cart value", units: 1, uom: "Case of 6", value: 35.0 }
  ];

  // Promotion-related free items: rows whose promoFree is set, unlocked once the
  // line is ordered (live qty > 0). Cart-level offers are appended afterwards.
  function collectPromoFree(body) {
    var groups = [];
    var anyOrdered = false;
    body.querySelectorAll("tr").forEach(function (tr) {
      var link = tr.querySelector(".mfg-product-link");
      var cell = tr.querySelector(".mfg-qty-cell");
      var qtyEl = tr.querySelector(".mfg-qty-value");
      if (!link || !cell || !qtyEl) return;
      var pf = null;
      try { pf = JSON.parse(decodeURIComponent(cell.getAttribute("data-promofree") || "null")); } catch (e) { pf = null; }
      var qty = parseInt(qtyEl.textContent, 10) || 0;
      if (qty > 0) anyOrdered = true;
      if (!pf) return;
      groups.push({ product: link.textContent, promo: pf.promo || "Offer", items: [
        { label: pf.label, note: pf.note, units: pf.units || 1, uom: pf.uom || "Each", value: pf.value || 0, unlocked: qty > 0, promo: pf.promo || "Offer" }
      ] });
    });
    // Order-wide example offers — keyed by the offer name so each stays its own
    // row. They unlock as soon as the order has at least one ordered line.
    CART_LEVEL_OFFERS.forEach(function (o) {
      groups.push({ product: o.promo, promo: o.promo, items: [
        { label: o.label, note: o.note, units: o.units || 1, uom: o.uom || "Each", value: o.value || 0, unlocked: anyOrdered, promo: o.promo }
      ] });
    });
    return groups;
  }

  // Custom free items: when the Order Item Template is "Free Items", the grid
  // shows a free-items assortment (window.MFG_FREE_ITEM_ROWS). Whatever the buyer
  // orders there (qty > 0) is collected here, grouped by category, for the
  // "Custom Free items" section of the Order Summary. Outside free mode there are
  // none. Each grouped entry carries `category` (LEAD_CATEGORY reads it).
  // Collects every ordered (qty > 0) row from the FREE-items catalog body it is
  // handed. Callers pass the free-catalog source explicitly (the live grid when
  // in free mode, or the persisted free-catalog snapshot otherwise), so custom
  // free items survive switching the template back to Standard Products.
  function collectDirectFree(body) {
    if (!body) return [];
    var order = [], map = {};
    body.querySelectorAll("tr").forEach(function (tr) {
      var link = tr.querySelector(".mfg-product-link");
      var cell = tr.querySelector(".mfg-qty-cell");
      var qtyEl = tr.querySelector(".mfg-qty-value");
      if (!link || !cell || !qtyEl) return;
      var qty = parseInt(qtyEl.textContent, 10) || 0;
      if (qty <= 0) return;
      var cat = cell.getAttribute("data-category") || "Free items";
      if (!map[cat]) { map[cat] = []; order.push(cat); }
      map[cat].push({
        label: link.textContent,
        uom: cell.getAttribute("data-uom") || "Each",
        units: qty,
        value: parseFloat(cell.getAttribute("data-net")) || 0,
        unlocked: true
      });
    });
    return order.map(function (c) { return { category: c, items: map[c] }; });
  }

  // Keep only the earned (unlocked) items in each group; drop emptied groups.
  // Preserves any extra group fields (e.g. promo name) alongside product/items.
  function earnedGroups(groups) {
    return groups.map(function (p) {
      var out = {}; for (var k in p) { if (p.hasOwnProperty(k)) out[k] = p[k]; }
      out.items = p.items.filter(function (it) { return it.unlocked; });
      return out;
    }).filter(function (p) { return p.items.length; });
  }

  // A single product can appear as several grid rows (different UoM/pack lines) and
  // each row unlocks its own free items. Coalesce groups that share the same `key`
  // (e.g. product name) into one so the lead cell spans ALL its free items via
  // rowspan, instead of repeating the product name on every row.
  function mergeGroups(groups, key) {
    var order = [], map = {};
    groups.forEach(function (g) {
      var k = g[key];
      if (!map[k]) {
        var out = {}; for (var f in g) { if (g.hasOwnProperty(f)) out[f] = f === "items" ? [] : g[f]; }
        map[k] = out; order.push(k);
      }
      map[k].items = map[k].items.concat(g.items);
    });
    return order.map(function (k) { return map[k]; });
  }

  // Render one grouped free-items table. `lead` configures the first (rowgroup)
  // column — its header text and how to derive each group's main + sub line —
  // so a promotion-scoped table can lead with the promotion instead of a product.
  function freeTableHTML(groups, lead) {
    // lead === null → a plain flat list (no rowgroup lead column). Custom Free
    // items use this: they're not clubbed by category, so the table starts
    // straight at the Free item column.
    if (!lead) {
      var flatRows = [];
      groups.forEach(function (p) { p.items.forEach(function (it) { flatRows.push(it); }); });
      var flatBody = flatRows.map(function (it) {
        return (
          '<tr class="mfg-free-table__row is-unlocked">' +
            '<td class="mfg-free-table__item">' +
              '<span class="mfg-free-item__name">' + esc(it.label) + "</span>" +
            "</td>" +
            '<td class="mfg-free-table__uom">' + esc(it.uom || "") + "</td>" +
            '<td class="mfg-free-table__qty">' + fmtNum(it.units) + "</td>" +
            '<td class="mfg-free-table__promo">' + esc(it.promo || "—") + "</td>" +
            '<td class="mfg-free-table__value">' +
              '<span class="mfg-free-table__list-price">' + fmtMoney(it.value) + "</span> " +
              '<span class="mfg-free-table__free-price">' + fmtMoney(0) + "</span>" +
            "</td>" +
          "</tr>"
        );
      }).join("");
      return (
        '<table class="mfg-free-table">' +
          "<thead><tr>" +
            '<th scope="col">Free item</th>' +
            '<th scope="col" class="mfg-free-table__uom">UoM</th>' +
            '<th scope="col" class="mfg-free-table__qty">Qty</th>' +
            '<th scope="col" class="mfg-free-table__promo">Promotions</th>' +
            '<th scope="col" class="mfg-free-table__value">Price</th>' +
          "</tr></thead>" +
          "<tbody>" + flatBody + "</tbody>" +
        "</table>"
      );
    }
    var body = groups.map(function (p) {
      var main = lead.main(p), sub = lead.sub(p);
      return p.items.map(function (it, i) {
        var leadCell = i === 0
          ? '<th scope="rowgroup" class="mfg-free-table__prod" rowspan="' + p.items.length + '">' +
              '<span class="mfg-free-table__prod-name">' + esc(main) + "</span>" +
              (sub ? '<span class="mfg-free-table__prod-count">' + esc(sub) + "</span>" : "") +
            "</th>"
          : "";
        return (
          '<tr class="mfg-free-table__row is-unlocked' + (i === 0 ? " is-group-start" : "") + '">' +
            leadCell +
            '<td class="mfg-free-table__item">' +
              '<span class="mfg-free-item__name">' + esc(it.label) + "</span>" +
            "</td>" +
            '<td class="mfg-free-table__uom">' + esc(it.uom || "") + "</td>" +
            '<td class="mfg-free-table__qty">' + fmtNum(it.units) + "</td>" +
            '<td class="mfg-free-table__promo">' + esc(it.promo || "—") + "</td>" +
            '<td class="mfg-free-table__value">' +
              '<span class="mfg-free-table__list-price">' + fmtMoney(it.value) + "</span> " +
              '<span class="mfg-free-table__free-price">' + fmtMoney(0) + "</span>" +
            "</td>" +
          "</tr>"
        );
      }).join("");
    }).join("");
    return (
      '<table class="mfg-free-table">' +
        "<thead><tr>" +
          '<th scope="col">' + esc(lead.header) + "</th>" +
          '<th scope="col">Free item</th>' +
          '<th scope="col" class="mfg-free-table__uom">UoM</th>' +
          '<th scope="col" class="mfg-free-table__qty">Qty</th>' +
          '<th scope="col" class="mfg-free-table__promo">Promotions</th>' +
          '<th scope="col" class="mfg-free-table__value">Price</th>' +
        "</tr></thead>" +
        "<tbody>" + body + "</tbody>" +
      "</table>"
    );
  }

  // Lead-column configs per accordion. Promotion offers lead with the promotion
  // (product shown as sub-line); product/direct tables lead with the product.
  // Only worth showing a count when a group has more than one item — a lone "1 item"
  // just wastes a line, so it's suppressed.
  function itemCountSub(p) { return p.items.length > 1 ? p.items.length + " items" : ""; }
  // Product rewards are clubbed per product + UoM, so the lead cell's sub-line
  // shows just the UoM (e.g. "Pack of 6") — the free-item count is dropped.
  function productUomSub(p) {
    return p.productUom || "";
  }
  var LEAD_PROMO = { header: "Offer", main: function (p) { return p.promo || "Offer"; }, sub: function () { return ""; } };
  var LEAD_PRODUCT = { header: "Product", main: function (p) { return p.product; }, sub: productUomSub };
  // Custom free items club by category (Snacks, Beverages, …) instead of product.
  var LEAD_CATEGORY = { header: "Category", main: function (p) { return p.category; }, sub: itemCountSub };

  // One collapsible accordion section wrapping a free-items table (or empty state).
  function freeAccordion(title, subtitle, groups, emptyMsg, lead) {
    var count = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    var open = false; // all sections start collapsed; the buyer expands what they want
    var inner = count
      ? freeTableHTML(groups, lead)
      : '<div class="mfg-free-drawer__empty">' + icon(UTIL, "info", "mfg-free-drawer__empty-icon") + "<span>" + esc(emptyMsg) + "</span></div>";
    return (
      '<div class="mfg-free-acc' + (open ? "" : " is-collapsed") + '">' +
        '<button type="button" class="mfg-free-acc__head" aria-expanded="' + open + '">' +
          icon(UTIL, "chevrondown", "mfg-free-acc__chevron") +
          '<span class="mfg-free-acc__titles">' +
            '<span class="mfg-free-acc__title">' + esc(title) + "</span>" +
            (subtitle ? '<span class="mfg-free-acc__sub">' + esc(subtitle) + "</span>" : "") +
          "</span>" +
        "</button>" +
        '<div class="mfg-free-acc__body">' + inner + "</div>" +
      "</div>"
    );
  }

  // Variant D: merge all three sources into ONE table (no accordion sections),
  // but keep the rowspan "clubbing" — the reward type clubs across its whole
  // block, and the product/promotion lead cell clubs across its group's rows.
  function freeFlatTableHTML(promo, product, direct) {
    var blocks = [
      { type: "Offer", mod: "promo", lead: LEAD_PROMO, groups: promo },
      { type: "Product reward", mod: "product", lead: LEAD_PRODUCT, groups: product },
      { type: "Custom free item", mod: "cart", lead: LEAD_CATEGORY, groups: direct }
    ].filter(function (b) { return b.groups.length; });

    if (!blocks.length) {
      return '<div class="mfg-free-drawer__empty">' + icon(UTIL, "info", "mfg-free-drawer__empty-icon") +
        "<span>No free items unlocked yet — increase quantities or add a promoted product.</span></div>";
    }

    var body = blocks.map(function (blk) {
      var typeCount = blk.groups.reduce(function (n, g) { return n + g.items.length; }, 0);
      var typeEmitted = false;
      return blk.groups.map(function (p) {
        var main = blk.lead.main(p), sub = blk.lead.sub(p);
        return p.items.map(function (it, i) {
          var lead = "";
          if (!typeEmitted) {
            lead += '<th scope="rowgroup" class="mfg-free-flat__type-cell is-type-start" rowspan="' + typeCount + '">' +
              '<span class="mfg-free-flat__badge mfg-free-flat__badge_' + blk.mod + '">' + esc(blk.type) + "</span></th>";
            typeEmitted = true;
          }
          if (i === 0) {
            lead += '<th scope="rowgroup" class="mfg-free-table__prod" rowspan="' + p.items.length + '">' +
              '<span class="mfg-free-table__prod-name">' + esc(main) + "</span>" +
              (sub ? '<span class="mfg-free-table__prod-count">' + esc(sub) + "</span>" : "") +
            "</th>";
          }
          return (
            '<tr class="mfg-free-table__row is-unlocked' + (i === 0 ? " is-group-start" : "") + '">' +
              lead +
              '<td class="mfg-free-table__item"><span class="mfg-free-item__name">' + esc(it.label) + "</span></td>" +
              '<td class="mfg-free-table__uom">' + esc(it.uom || "") + "</td>" +
              '<td class="mfg-free-table__qty">' + fmtNum(it.units) + "</td>" +
              '<td class="mfg-free-table__value">' +
                '<span class="mfg-free-table__list-price">' + fmtMoney(it.value) + "</span> " +
                '<span class="mfg-free-table__free-price">' + fmtMoney(0) + "</span>" +
              "</td>" +
            "</tr>"
          );
        }).join("");
      }).join("");
    }).join("");

    return (
      '<table class="mfg-free-table mfg-free-table_flat">' +
        "<thead><tr>" +
          '<th scope="col">Reward type</th>' +
          '<th scope="col">Product / Promotion</th>' +
          '<th scope="col">Free item</th>' +
          '<th scope="col" class="mfg-free-table__uom">UoM</th>' +
          '<th scope="col" class="mfg-free-table__qty">Qty</th>' +
          '<th scope="col" class="mfg-free-table__value">Price</th>' +
        "</tr></thead>" +
        "<tbody>" + body + "</tbody>" +
      "</table>"
    );
  }

  function freeDrawerHTML(stdBody, freeBody, flat) {
    var promo = earnedGroups(collectPromoFree(stdBody));
    // Club all free items a product unlocks under one (row-spanned) product cell.
    var product = mergeGroups(earnedGroups(collectFreeItems(stdBody)), "prodKey");
    var direct = earnedGroups(collectDirectFree(freeBody));
    if (flat) {
      return '<div class="mfg-free-drawer__scroll mfg-free-drawer__flat">' + freeFlatTableHTML(promo, product, direct) + "</div>";
    }
    var sections =
      freeAccordion("Header Rewards", "",
        promo, "No offers yet — add a product that has an offer.", null) +
      freeAccordion("Product rewards", "",
        product, "No product rewards yet — increase order quantities to unlock rewards.", LEAD_PRODUCT) +
      freeAccordion("Manually added free items", "",
        direct, 'No custom free items yet — choose "Free Items" in Order Item Template, then order the items you want.', null);
    return '<div class="mfg-free-drawer__scroll mfg-free-drawer__acc">' + sections + "</div>";
  }

  function setupFreeSummary(card, body) {
    var summary = card.querySelector(".mfg-order-summary");
    if (!summary) return;
    var toggle = summary.querySelector(".mfg-order-summary__toggle");

    var strip = document.createElement("div");
    strip.className = "mfg-free-summary";
    var drawer = document.createElement("div");
    drawer.className = "mfg-free-drawer";
    drawer.hidden = true;

    // Both the indicator (strip) and its free-items table (drawer) live INSIDE
    // the summary, directly under the header: [toggle][strip][drawer][totals].
    // The strip's green pill comes first; the table expands right below it.
    if (toggle && toggle.nextSibling) {
      summary.insertBefore(strip, toggle.nextSibling);
      summary.insertBefore(drawer, strip.nextSibling);
    } else {
      summary.appendChild(strip);
      summary.appendChild(drawer);
    }
    // Drag handle at the summary's top edge — lets the user resize the drawer's
    // height (and collapse it) by dragging, in addition to the chevron/CTA.
    var resizer = document.createElement("div");
    resizer.className = "mfg-summary-resizer";
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "horizontal");
    resizer.setAttribute("aria-label", "Resize order summary");
    resizer.setAttribute("tabindex", "0");
    resizer.innerHTML = '<span class="mfg-summary-resizer__grip"></span>';
    summary.insertBefore(resizer, summary.firstChild);

    if (toggle) toggle.setAttribute("aria-expanded", "false"); // collapsed by default

    // The summary is docked to the card bottom (see CSS). Reserve space below
    // the grid equal to the COLLAPSED bar height so it doesn't cover rows; when
    // expanded, the extra height grows upward over the grid instead.
    var layout = card.querySelector(".mfg-grid-layout");
    function reserveSpace() {
      if (!layout) return;
      // A card inside a hidden tab panel (display:none) has no client rects —
      // skip it so it can't publish a bogus (0px) collapsed-bar height.
      if (!card.getClientRects().length) return;
      if (document.body.classList.contains("mfg-single")) {
        // Card footers are in-flow but sticky (see CSS): the table Cancel/Save
        // bar sticks just above the Order Summary. Publish the COLLAPSED summary
        // height so the edit footer's sticky offset lands right on top of it.
        // The summary sits in-flow at the card bottom, so no grid padding needed.
        if (drawer.hidden) {
          document.body.style.setProperty("--mfg-summary-bar-h", summary.offsetHeight + "px");
        }
        layout.style.paddingBottom = "0px";
      } else if (drawer.hidden) {
        // Showcase: summary is docked to the card bottom → reserve inside the card.
        layout.style.paddingBottom = summary.offsetHeight + "px";
      }
    }

    var flat = card.getAttribute("data-variant") === "d";
    // Promotion offers + Product rewards come from the STANDARD-products catalog;
    // Custom free items from the FREE-items catalog. Only one catalog is mounted
    // in the live grid at a time, so the other is read from the snapshot captured
    // on the last template switch (card._catalogCache) — this lets all three
    // sections coexist instead of the hidden catalog reading as empty.
    function detachedBody(html) {
      var tb = document.createElement("tbody");
      tb.innerHTML = html || "";
      return tb;
    }
    function sources() {
      var cache = card._catalogCache || {};
      if (card.classList.contains("mfg-mode-free")) {
        return { std: detachedBody(cache.standard), free: body };
      }
      return { std: body, free: detachedBody(cache.free) };
    }
    function fillDrawer() {
      var src = sources();
      drawer.innerHTML = freeDrawerHTML(src.std, src.free, flat);
      if (flat) setupFlatTypeResizer(card, drawer);
    }

    function refresh() {
      // Count across all three sources: promotion offers, product rewards, and
      // directly-added items (directly-added are always unlocked once added).
      // Per-aspect unlocked count + value, so the notification can break down
      // where the free value comes from and total it.
      function summarize(groups) {
        var n = 0, val = 0;
        groups.forEach(function (p) {
          p.items.forEach(function (it) {
            if (it.unlocked) { n += 1; val += (it.value || 0); }
          });
        });
        return { n: n, val: val };
      }
      var src = sources();
      var promo = summarize(collectPromoFree(src.std));
      var product = summarize(collectFreeItems(src.std));
      var direct = summarize(collectDirectFree(src.free));
      var unlocked = promo.n + product.n + direct.n;
      var grand = promo.val + product.val + direct.val;
      // Publish live totals so the free-items modal header can total the value
      // AND break it down per source (promotion offers / product rewards / custom).
      card._freeTotals = {
        count: unlocked, value: grand,
        parts: [
          { label: "Offers", n: promo.n, val: promo.val },
          { label: "Product rewards", n: product.n, val: product.val },
          { label: "Manually added free items", n: direct.n, val: direct.val }
        ]
      };
      if (card._updateFreeModalTotal) card._updateFreeModalTotal();
      // Variant E: no free-items figure in the Order Summary (it shows only the
      // three priced totals). Free items surface via the blue scoped notification
      // above the grid, which opens the free-items modal. No top strip.
      var variantId = card.getAttribute("data-variant");
      if (variantId === "e" || variantId === "f" || variantId === "m") {
        if (strip) strip.style.display = "none";
        // Blue scoped notification above the grid: visible only while at least
        // one free item is unlocked (built in setupFreeModal).
        if (card._unlockNotif) card._unlockNotif.hidden = unlocked === 0;
        // Showing/hiding the notification changes the grid's top offset — re-fit
        // the grid so it (and the summary below it) still fit without page scroll.
        if (card._fitGrid) card._fitGrid();
        if (unlocked === 0 && !drawer.hidden) setOpen(false); // close modal if nothing left
        // Both E and F keep the "+N free items" badge on the product-name cell.
        // Variant F additionally opens a per-line detail side panel on click.
        updateProductBadges(body);
        reserveSpace();
        return;
      }
      // Hide the whole indicator (notification + "Learn more") until at least one
      // free item is actually unlocked. Inline display beats the .mfg-free-summary
      // display:flex rule, which an [hidden] attribute would not.
      if (unlocked === 0) {
        if (!drawer.hidden) setOpen(false); // collapse any open drawer
        strip.innerHTML = "";
        strip.style.display = "none";
        updateProductBadges(body);
        reserveSpace();
        return;
      }
      function aspect(label, s) {
        return '<span class="mfg-free-notif__aspect">' + label +
          '<span class="mfg-free-notif__aspect-val">' + fmtMoney(s.val) + "</span></span>";
      }
      strip.style.display = "";
      strip.innerHTML =
        '<div class="mfg-free-notif slds-scoped-notification slds-media slds-media_center" role="status">' +
          '<div class="slds-media__figure mfg-free-notif__figure">' + icon(UTIL, "discounts", "mfg-free-notif__icon") + "</div>" +
          '<div class="slds-media__body mfg-free-notif__body">' +
            '<span class="mfg-free-notif__title">Free items on this order &middot; <strong>' + fmtMoney(grand) + "</strong> total value</span>" +
            '<span class="mfg-free-notif__breakdown">' +
              aspect("Offers", promo) +
              aspect("Product rewards", product) +
              aspect("Manually added free items", direct) +
            "</span>" +
            '<button type="button" class="mfg-free-summary__cta">' +
              (card.getAttribute("data-variant") === "e"
                ? "View free items"
                : (drawer.hidden ? "Learn more" : "Hide details")) +
            "</button>" +
          "</div>" +
        "</div>";
      updateProductBadges(body);
      if (!drawer.hidden) fillDrawer();
      // The notification strip changes the collapsed bar height, so re-measure
      // (updates --mfg-summary-bar-h → the fixed footer re-docks above the bar).
      reserveSpace();
    }

    // Single source of truth: header chevron and the CTA both drive this.
    function setOpen(open) {
      // Variant E: free items are shown in a modal (opened from the scoped
      // notification's "View free items" link), not an inline drawer. Fill the
      // relocated drawer and toggle the modal; skip all the bottom-tray plumbing.
      var sv = card.getAttribute("data-variant");
      if (sv === "e" || sv === "f" || sv === "m") {
        if (open) fillDrawer();
        drawer.hidden = !open;
        if (card._toggleFreeModal) card._toggleFreeModal(open);
        return;
      }
      if (open) fillDrawer();
      drawer.hidden = !open;
      summary.classList.toggle("mfg-summary--open", open);
      if (toggle) toggle.setAttribute("aria-expanded", String(open));
      var cta = strip.querySelector(".mfg-free-summary__cta");
      if (cta) cta.textContent = open ? "Hide details" : "Learn more";
      // Single view: while expanded, lock page scroll so only the summary's own
      // drawer scrolls; collapsing restores normal page scroll.
      // Variant E's summary is a docked side rail with its own scroll, so it must
      // NOT lock page scroll the way the bottom-drawer variants (B/D) do.
      if (document.body.classList.contains("mfg-single") && card.getAttribute("data-variant") !== "e" && card.getAttribute("data-variant") !== "f" && card.getAttribute("data-variant") !== "m") {
        document.documentElement.classList.toggle("mfg-summary-locked", open);
      }
      if (!open) reserveSpace(); // re-measure the collapsed bar
    }

    strip.addEventListener("click", function (e) {
      if (!e.target.closest(".mfg-free-summary__cta")) return;
      setOpen(drawer.hidden);
    });
    // Variant E's summary chevron keeps the default totals-collapse behaviour
    // (wired in initCard); only the notification link opens the free-items modal.
    if (toggle && card.getAttribute("data-variant") !== "e" && card.getAttribute("data-variant") !== "f" && card.getAttribute("data-variant") !== "m") {
      toggle.addEventListener("click", function () { setOpen(drawer.hidden); });
    }

    // Drag / keyboard resize of the drawer height (see .mfg-summary-resizer CSS).
    // Dragging up grows the drawer, down shrinks it, past the minimum collapses.
    (function setupSummaryResize() {
      var MIN = 48; // below this the drawer collapses
      function scrollEl() { return drawer.querySelector(".mfg-free-drawer__scroll"); }
      function currentHeight() {
        // Variant D resizes the single flat scroll region; Variant B resizes the
        // shared per-section scroll height (read its current max-height).
        if (flat) {
          var el = scrollEl();
          return el ? el.getBoundingClientRect().height : 0;
        }
        var acc = drawer.querySelector(".mfg-free-acc__body");
        if (!acc) return 0;
        var mh = parseFloat(getComputedStyle(acc).maxHeight);
        return isNaN(mh) ? acc.getBoundingClientRect().height : mh;
      }
      function maxHeight() {
        var totals = summary.querySelector(".mfg-order-summary__totals");
        var cap = document.body.classList.contains("mfg-single")
          ? window.innerHeight * 0.75
          : (card.offsetHeight || window.innerHeight * 0.75);
        var chrome = (toggle ? toggle.offsetHeight : 0) + strip.offsetHeight +
          (totals ? totals.offsetHeight : 0) + resizer.offsetHeight + 24;
        var avail = Math.max(MIN, cap - chrome);
        if (flat) return avail;
        // Variant B: cap each section's own scroll window generously (so the
        // drag can grow it past the 260px default) while each section still
        // scrolls within itself — never one scroll for the whole drawer.
        return Math.min(avail, 480);
      }
      function applyHeight(h) {
        card.classList.add("mfg-summary-resized");
        card.style.setProperty(flat ? "--mfg-free-drawer-h" : "--mfg-free-acc-body-h", Math.round(h) + "px");
      }
      var startY = 0, startH = 0;
      function onMove(e) {
        var next = startH + (startY - e.clientY); // drag up = taller
        if (next <= MIN) { end(); setOpen(false); return; }
        applyHeight(Math.min(next, maxHeight()));
      }
      function end() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", end);
        document.body.classList.remove("mfg-row-resizing");
      }
      resizer.addEventListener("mousedown", function (e) {
        if (drawer.hidden) return;
        e.preventDefault();
        startY = e.clientY; startH = currentHeight();
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", end);
        document.body.classList.add("mfg-row-resizing");
      });
      resizer.addEventListener("keydown", function (e) {
        if (drawer.hidden) return;
        var step = e.shiftKey ? 60 : 24, delta = 0;
        if (e.key === "ArrowUp") delta = step;
        else if (e.key === "ArrowDown") delta = -step;
        else return;
        e.preventDefault();
        var next = currentHeight() + delta;
        if (next <= MIN) { setOpen(false); return; }
        applyHeight(Math.min(next, maxHeight()));
      });
    })();
    // Collapse / expand an individual accordion section inside the drawer.
    drawer.addEventListener("click", function (e) {
      var head = e.target.closest(".mfg-free-acc__head");
      if (!head) return;
      var acc = head.closest(".mfg-free-acc");
      var collapsed = acc.classList.toggle("is-collapsed");
      head.setAttribute("aria-expanded", String(!collapsed));
    });
    window.addEventListener("resize", reserveSpace);

    FREE_SUMMARY_REFRESH.push(function () { refresh(); if (!drawer.hidden) fillDrawer(); });
    card._refreshFreeSummary = refresh;
    card._reserveSpace = reserveSpace;
    card._setSummaryOpen = setOpen; // variant E's modal open/close reuses this
    refresh();
    reserveSpace();
    window.requestAnimationFrame(reserveSpace);
  }

  // --- Variant E (inspection feedback): scoped notification → free-items modal --
  // Same data + counting as the Variant B summary (setupFreeSummary already ran),
  // but reshaped per the UX inspection: the notification strip becomes a
  // PERSISTENT top banner whose "View free items" link opens a MODAL listing every
  // free item. No right-side panel, no inline drawer, no in-grid unlock badges.
  function setupFreeModal(card) {
    var layout = card.querySelector(".mfg-grid-layout");
    var summary = card.querySelector(".mfg-order-summary");
    var strip = summary && summary.querySelector(".mfg-free-summary");
    var drawer = summary && summary.querySelector(".mfg-free-drawer");
    if (!layout || !summary || !drawer) return;

    // 1) No top strip — the free-items figure lives inside the Order Summary.
    //    (Applies to every card, including the hidden Cart-tab clone, so its
    //    Order Summary reads the same — this part is purely local, no shared ids.)
    if (strip) strip.style.display = "none";

    // Order Summary is always expanded (and not collapsible) for this variant:
    // keep the chevron down and the totals row permanently visible.
    var toggle = summary.querySelector(".mfg-order-summary__toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    var totals = summary.querySelector(".mfg-order-summary__totals");
    if (totals) totals.classList.remove("mfg-hidden");

    // 0) Blue scoped notification, docked JUST ABOVE the grid. It appears only
    //    once at least one free item is unlocked (e.g. an order-qty bump crosses
    //    a reward threshold) and its "View free items" link opens the free-items
    //    modal. refresh() (variant-E branch) toggles [hidden]. Built for BOTH the
    //    primary assortment card and the cloned Cart-tab grid (card._isCart) so
    //    the Cart screen carries the same banner; the clone reuses the assortment
    //    card's single page-level modal (see the _isCart bail below) rather than
    //    building a duplicate, so its CTA drives that card's _setSummaryOpen.
    if (!card._unlockNotif) {
      var notif = document.createElement("div");
      notif.className = "mfg-unlock-notif slds-scoped-notification slds-media slds-media_center";
      notif.setAttribute("role", "status");
      notif.hidden = true;
      notif.innerHTML =
        '<div class="slds-media__figure mfg-unlock-notif__figure">' +
          icon(UTIL, "info", "mfg-unlock-notif__icon") +
        "</div>" +
        '<div class="slds-media__body mfg-unlock-notif__body">' +
          '<span class="mfg-unlock-notif__title">You have unlocked some free items</span>' +
        "</div>" +
        '<button type="button" class="mfg-unlock-notif__cta">View free items</button>';
      layout.parentNode.insertBefore(notif, layout);
      notif.querySelector(".mfg-unlock-notif__cta").addEventListener("click", function () {
        // The Cart-tab clone has no modal of its own — open the assortment
        // card's shared, page-level modal instead.
        var owner = card._isCart ? CART_STATE.assortCard : card;
        if (owner && owner._setSummaryOpen) owner._setSummaryOpen(true);
      });
      card._unlockNotif = notif;
    }

    // The body-level free-items modal is a PAGE-LEVEL singleton carrying fixed
    // ids (mfg-free-modal-heading / -total). Only the primary assortment card
    // owns it. The cloned Cart-tab grid (card._isCart) must NOT build a second
    // copy — doing so duplicated those ids, added a second modal <h1> (breaking
    // heading hierarchy), and stacked a duplicate document-level Escape listener.
    // Its notification (built above) reuses the assortment card's modal, so bail
    // out here before the modal build.
    if (card._isCart) return;

    // 2) Build the modal shell and move the free-items drawer into its body. The
    //    Order Summary footer is left as the default in-flow totals bar.
    var modal = document.createElement("section");
    modal.className = "slds-modal slds-modal_large mfg-free-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("tabindex", "-1");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-labelledby", "mfg-free-modal-heading");
    modal.innerHTML =
      '<div class="slds-modal__container">' +
        '<div class="slds-modal__header">' +
          '<button type="button" class="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse mfg-free-modal__close" title="Close">' +
            icon(UTIL, "close", "mfg-free-modal__close-icon") +
            '<span class="slds-assistive-text">Close</span>' +
          "</button>" +
          '<h2 id="mfg-free-modal-heading" class="slds-modal__title slds-hyphenate">Free items on this order</h2>' +
        "</div>" +
        '<div class="slds-modal__content slds-var-p-around_medium mfg-free-modal__content"></div>' +
        '<div class="slds-modal__footer">' +
          '<button type="button" class="slds-button slds-button_neutral mfg-free-modal__done">Close</button>' +
        "</div>" +
      "</div>";
    var backdrop = document.createElement("div");
    backdrop.className = "slds-backdrop mfg-free-modal-backdrop";

    // Total line lives at the top of the modal body — below the header, above the
    // expandable sections — summing the full free-items value across all sources.
    var content = modal.querySelector(".mfg-free-modal__content");
    var totalBar = document.createElement("p");
    totalBar.className = "mfg-free-modal__total";
    totalBar.id = "mfg-free-modal-total";
    content.appendChild(totalBar);
    content.appendChild(drawer);
    drawer.hidden = true;
    document.body.appendChild(modal);
    document.body.appendChild(backdrop);

    // 3) Open/close plumbing. setOpen(true/false) (driven by the notification link)
    //    calls this to reveal/hide the modal + backdrop.
    // Header line totalling the full free-items value across all three sources.
    var totalEl = modal.querySelector(".mfg-free-modal__total");
    card._updateFreeModalTotal = function () {
      var t = card._freeTotals || { count: 0, value: 0, parts: [] };
      // Left: a per-source breakdown across all three sources ("Promotion offers
      // worth $45.00 · Product rewards worth $471.50 · Custom free items worth
      // $0.00"). Right: the labelled grand total.
      var parts = t.parts || [];
      // Two-line layout matching Figma node 120:446727:
      //   Line 1 (semibold, 16px): "You've unlocked $X worth of free items"
      //   Line 2 (regular, 14px):  bullet-separated per-source breakdown
      //     "$45.00 from promotion offers • $471.50 from product rewards • …".
      var frags = parts.filter(function (p) { return p.val > 0; }).map(function (p) {
        return fmtMoney(p.val) + " from " + esc(p.label).toLowerCase();
      });
      totalEl.innerHTML = frags.length
        ? '<span class="mfg-free-modal__total-head">You&rsquo;ve unlocked ' + fmtMoney(t.value) + " worth of free items</span>" +
          '<span class="mfg-free-modal__total-list">' + frags.join(" &bull; ") + ".</span>"
        : '<span class="mfg-free-modal__total-head">You haven&rsquo;t unlocked any free items yet.</span>';
    };
    card._updateFreeModalTotal();
    // Collect the modal's currently-visible focusable elements (order matters for
    // Tab wrapping). Used by the focus trap and to place initial focus.
    function focusables() {
      var sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.prototype.filter.call(modal.querySelectorAll(sel), function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      });
    }
    card._toggleFreeModal = function (open) {
      if (open && card._updateFreeModalTotal) card._updateFreeModalTotal();
      modal.classList.toggle("slds-fade-in-open", open);
      backdrop.classList.toggle("slds-backdrop_open", open);
      modal.setAttribute("aria-hidden", String(!open));
      if (open) {
        // Remember what to return focus to, then move focus into the dialog.
        card._modalReturnFocus = document.activeElement;
        modal.focus();
      } else if (card._modalReturnFocus && typeof card._modalReturnFocus.focus === "function") {
        // Restore focus to the control that opened the dialog (the notification
        // "View free items" CTA), so keyboard/SR users aren't dropped at the top.
        card._modalReturnFocus.focus();
        card._modalReturnFocus = null;
      }
    };
    function close() { if (card._setSummaryOpen) card._setSummaryOpen(false); }
    modal.querySelector(".mfg-free-modal__close").addEventListener("click", close);
    modal.querySelector(".mfg-free-modal__done").addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("slds-fade-in-open")) close();
    });
    // Focus trap: while the dialog is open, keep Tab / Shift+Tab cycling inside it
    // instead of leaking to the page behind the backdrop (WCAG 2.4.3 / 2.1.2).
    modal.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !modal.classList.contains("slds-fade-in-open")) return;
      var list = focusables();
      if (!list.length) { e.preventDefault(); modal.focus(); return; }
      var first = list[0], last = list[list.length - 1];
      var active = document.activeElement;
      if (e.shiftKey && (active === first || active === modal)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    });

    // The free-items metric block now exists — refresh so it shows live count/value.
    if (card._refreshFreeSummary) card._refreshFreeSummary();
  }

  // --- Variant E: move the vertical scroll from the page to the grid body -----
  // The 2000+ row grid otherwise pushes the scoped "unlocked free items"
  // notification (and the permanently-expanded Order Summary) off-screen, which
  // was the #1 blocker: neither is visible on load. Instead of the whole page
  // scrolling, we cap the grid-wrapper's height to the space between its top and
  // the viewport bottom (reserving room for whatever sits below it in the card —
  // the Order Summary + footer), so only the grid body scrolls. The header,
  // filter row, notification and summary stay pinned. Sticky <thead> (CSS) keeps
  // the column labels visible during that internal scroll. Recomputed on resize.
  function setupGridScroll(card) {
    // Only on the full-screen single-variant page; the 3-variant showcase and the
    // hidden cart clone keep normal page flow.
    if (card._isCart || !document.body.classList.contains("mfg-single")) return;
    var wrap = card.querySelector(".mfg-grid-wrapper");
    if (!wrap) return;
    function belowHeight() {
      // Sum the heights of the card-body children that follow the grid layout
      // (the Order Summary, any footer) so they remain visible below the grid.
      var layout = card.querySelector(".mfg-grid-layout") || wrap;
      var below = 0;
      for (var el = layout.nextElementSibling; el; el = el.nextElementSibling) {
        if (el.offsetParent !== null) below += el.getBoundingClientRect().height;
      }
      // The docked "unsaved changes" edit footer is a page-level bar (not a grid
      // sibling) that appears on the first edit and sits above the summary —
      // reserve its height too so the grid shrinks to keep the page unscrolled.
      var ef = document.getElementById("edit-footer");
      if (ef && !ef.hidden && ef.offsetParent !== null) {
        below += ef.getBoundingClientRect().height;
      }
      return below;
    }
    function fit() {
      // rect.top is stable once the page no longer scrolls (scrollY stays 0),
      // which is exactly the state this produces.
      var top = wrap.getBoundingClientRect().top + window.scrollY;
      var reserve = belowHeight() + 24; // 24px breathing room / card padding
      var max = Math.max(96, window.innerHeight - top - reserve);
      card.style.setProperty("--mfg-grid-scroll-max", max + "px");
      // Second pass, self-correcting in BOTH directions: make the Order Summary
      // sit flush at the viewport bottom. Reading a rect here forces a reflow,
      // so the summary's post-set position is accurate. delta > 0 means there's
      // an empty gap below the summary (the static reserve over-counted — e.g.
      // the docked footer doesn't occupy flow space at this height) → grow the
      // grid to fill it; delta < 0 means it overflows → shrink. Either way the
      // grid ends exactly filling the space between its top and the summary.
      var anchor = card.querySelector(".mfg-order-summary") || wrap;
      var delta = window.innerHeight - anchor.getBoundingClientRect().bottom;
      if (Math.abs(delta) > 1) {
        card.style.setProperty(
          "--mfg-grid-scroll-max",
          Math.max(96, max + delta) + "px"
        );
      }
    }
    // Expose so the free-items unlock toggle (which shows/hides the notification
    // above the grid, changing wrap.top) can re-fit the grid. Run once now and
    // again on the next frame, since the notification's height isn't laid out at
    // the synchronous moment its [hidden] attribute is toggled.
    card._fitGrid = function () { fit(); requestAnimationFrame(fit); };
    fit();
    // Re-run after first paint in case web fonts / late layout shifted metrics.
    requestAnimationFrame(fit);
    var raf = null;
    window.addEventListener("resize", function () {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
  }

  // --- Variant C: click a product name to open a tabbed detail side panel ----
  // Reads the row's live data (reflects any qty edits) for the three tabs.
  function rowData(tr) {
    var link = tr.querySelector(".mfg-product-link");
    var cell = tr.querySelector(".mfg-qty-cell");
    var tds = tr.children;
    var txt = function (i) { return tds[i] ? tds[i].textContent.trim() : ""; };
    var tiers = [];
    try { tiers = JSON.parse(decodeURIComponent(cell.getAttribute("data-tiers") || "[]")); } catch (e) { tiers = []; }
    var qty = parseInt((tr.querySelector(".mfg-qty-value") || {}).textContent, 10) || 0;
    // column order: 3 product, 4 category, 5 promo, 6 uom, 7 list,
    // 8 suggested, 9 qty, 10 discount, 11 net unit, 12 sp price, 13 net total
    return {
      product: link ? link.textContent : "This product",
      category: txt(4), promo: txt(5),
      uom: cell.getAttribute("data-uom") || txt(6),
      list: txt(7), suggested: txt(8), qty: qty,
      discount: txt(10), netUnit: txt(11), spPrice: txt(12), netTotal: txt(13),
      tiers: tiers
    };
  }

  // One read-only field (label above value) in the 2-column section grids.
  function detailField(label, value) {
    return (
      '<div class="mfg-detail-field">' +
        '<div class="mfg-detail-field__label">' + esc(label) + "</div>" +
        '<div class="mfg-detail-field__value">' + esc(value || "—") + "</div>" +
      "</div>"
    );
  }

  // Collapsible section: grey rounded header (chevron + title) over a 2-col grid.
  // Native <details>/<summary> so the toggle needs no extra JS and stays a11y-sound.
  function detailSection(title, open, gridHTML) {
    return (
      '<details class="mfg-detail-section"' + (open ? " open" : "") + ">" +
        '<summary class="mfg-detail-section__header">' +
          icon(UTIL, "chevronright", "mfg-detail-section__chevron") +
          '<span class="mfg-detail-section__title">' + esc(title) + "</span>" +
        "</summary>" +
        '<div class="mfg-detail-section__grid">' + gridHTML + "</div>" +
      "</details>"
    );
  }

  // Details tab modeled on Figma node 44:110544: a Product Description block,
  // then collapsible "Product Details" and "Pricing Details" sections of
  // read-only fields. (The design's thumbnail image is intentionally omitted.)
  function detailsTabHTML(d) {
    var desc = d.category
      ? d.category + " product" + (d.uom ? ", ordered as " + d.uom + "." : ".")
      : "Product available in this assortment.";
    var productDetails =
      detailField("Category", d.category) +
      detailField("Unit of measure", d.uom) +
      detailField("Suggested qty", d.suggested) +
      detailField("Order qty", fmtNum(d.qty)) +
      detailField("Product name", d.product);
    var pricingDetails =
      detailField("List price", d.list) +
      detailField("Discount", d.discount) +
      detailField("Net unit price", d.netUnit) +
      detailField("Sp. price", d.spPrice) +
      detailField("Net total", d.netTotal);
    return (
      '<div class="mfg-detail-desc">' +
        '<div class="mfg-detail-desc__label">Product Description</div>' +
        '<p class="mfg-detail-desc__text">' + esc(desc) + "</p>" +
      "</div>" +
      detailSection("Product Details", true, productDetails) +
      detailSection("Pricing Details", false, pricingDetails)
    );
  }

  // Promotions tab reuses the promotion popover's own item markup + classes, so
  // the side panel and the in-grid badge popover read identically (title,
  // description, expiration, Terms & Conditions).
  function promotionsTabHTML(d) {
    var promos = promoDetailsFor({ promo: parseInt(d.promo, 10) || 0 });
    if (!promos.length) {
      return '<div class="mfg-detail-empty">' + icon(UTIL, "info", "mfg-detail-empty__icon") + "<span>No promotions on this product.</span></div>";
    }
    return '<div class="mfg-promo-pop__body mfg-detail-promos">' + promos.map(promoItemHTML).join("") + "</div>";
  }

  var freePct = function (n, of) { return Math.max(0, Math.min(100, (n / Math.max(1, of)) * 100)); };
  // Sorted reward list for a row (fixed thresholds), reused by render + live sync.
  function freeGoals(d) {
    return freeItemsFor(d.tiers, d.uom).slice().sort(function (a, b) { return a.unlockAt - b.unlockAt; });
  }

  // Free-items tab: an order-quantity control (number field + draggable slider)
  // drives an unlock-progress view. The single milestone track doubles as the
  // slider; per-reward rows each carry their own progress bar toward unlocking.
  function freeTabHTML(d) {
    var items = freeGoals(d);
    if (!items.length) {
      return '<div class="mfg-detail-empty">' + icon(UTIL, "info", "mfg-detail-empty__icon") + "<span>No free items available for this product.</span></div>";
    }
    var qty = d.qty;
    var maxAt = items[items.length - 1].unlockAt || 1;
    var unlocked = items.filter(function (it) { return qty >= it.unlockAt; }).length;
    var nextLocked = null;
    for (var i = 0; i < items.length; i++) { if (qty < items[i].unlockAt) { nextLocked = items[i]; break; } }

    // Milestone markers positioned along the 0 → highest-threshold track.
    var markers = items.map(function (it) {
      var on = qty >= it.unlockAt;
      return '<span class="mfg-free-track__marker' + (on ? " is-on" : "") + '" style="left:' + freePct(it.unlockAt, maxAt) + '%" ' +
        'title="' + esc(it.label) + " at " + fmtNum(it.unlockAt) + ' units"></span>';
    }).join("");
    var nextNote = nextLocked
      ? "Add <strong>" + fmtNum(nextLocked.unlockAt - qty) + "</strong> more units to unlock " + esc(nextLocked.label)
      : "All free items unlocked 🎉";

    var qtyField =
      '<div class="mfg-free-qtyset">' +
        '<label class="mfg-free-qtyset__label" for="mfg-free-qty">Order quantity</label>' +
        '<div class="mfg-free-qtyset__row">' +
          '<input type="number" id="mfg-free-qty" class="slds-input mfg-free-qty-input" min="0" step="1" inputmode="numeric" value="' + qty + '" />' +
          (d.uom ? '<span class="mfg-free-qtyset__uom">' + esc(d.uom) + "</span>" : "") +
        "</div>" +
        '<p class="mfg-free-qtyset__hint">Enter or drag the slider to set the quantity — free items unlock as it grows.</p>' +
      "</div>";

    var track =
      '<div class="mfg-free-progress">' +
        '<div class="mfg-free-progress__caption"><strong>' + unlocked + "</strong> of " + items.length +
          " free item" + (items.length !== 1 ? "s" : "") + " unlocked</div>" +
        '<div class="mfg-free-slider-wrap">' +
          '<div class="mfg-free-track" aria-hidden="true">' +
            '<div class="mfg-free-track__fill" style="width:' + freePct(qty, maxAt) + '%"></div>' +
            markers +
          "</div>" +
          '<input type="range" class="mfg-free-slider" min="0" max="' + maxAt + '" step="1" value="' +
            Math.min(qty, maxAt) + '" aria-label="Order quantity" />' +
        "</div>" +
        '<div class="mfg-free-track__scale">' +
          '<span class="mfg-free-track__tick is-first" style="left:0">0</span>' +
          items.map(function (it, idx) {
            var last = idx === items.length - 1;
            return '<span class="mfg-free-track__tick' + (last ? " is-last" : "") + (qty >= it.unlockAt ? " is-on" : "") +
              '" style="' + (last ? "right:0" : "left:" + freePct(it.unlockAt, maxAt) + "%") + '">' +
              fmtNum(it.unlockAt) + (last ? " units" : "") + "</span>";
          }).join("") +
        "</div>" +
        '<div class="mfg-free-progress__next">' + nextNote + "</div>" +
      "</div>";

    // Per-reward progress rows.
    var rows = items.map(function (it) {
      var on = qty >= it.unlockAt;
      var status = on
        ? '<span class="mfg-free-item__status mfg-free-item__status_on">' + icon(UTIL, "success", "mfg-free-item__status-icon") + "Unlocked</span>"
        : '<span class="mfg-free-item__status">' + icon(UTIL, "lock", "mfg-free-item__status-icon") + fmtNum(it.unlockAt - qty) + " more to unlock</span>";
      return (
        '<li class="mfg-free-goal ' + (on ? "is-unlocked" : "is-locked") + '" data-unlock-at="' + it.unlockAt + '">' +
          '<div class="mfg-free-goal__top">' +
            '<span class="mfg-free-goal__name">' + fmtNum(it.units) + " × " + esc(it.label) + "</span>" +
            status +
          "</div>" +
          (it.note ? '<div class="mfg-free-goal__note">' + esc(it.note) + "</div>" : "") +
          '<div class="mfg-free-goal__bar"><div class="mfg-free-goal__bar-fill" style="width:' + freePct(qty, it.unlockAt) + '%"></div></div>' +
          '<div class="mfg-free-goal__meta">' +
            "<span>" + fmtNum(Math.min(qty, it.unlockAt)) + " / " + fmtNum(it.unlockAt) + " units</span>" +
          "</div>" +
        "</li>"
      );
    }).join("");

    return qtyField + track + '<ul class="mfg-free-goals">' + rows + "</ul>";
  }

  // Repaint the free tab's live bits for a given qty without rebuilding the DOM
  // (so the slider keeps its drag). `skip` names the control the user is driving,
  // which must not be written back mid-interaction ("slider" or "number").
  function syncFreeTab(panelBody, d, qty, skip) {
    var items = freeGoals(d);
    if (!items.length) return;
    var maxAt = items[items.length - 1].unlockAt || 1;
    var unlocked = items.filter(function (it) { return qty >= it.unlockAt; }).length;
    var nextLocked = null;
    for (var i = 0; i < items.length; i++) { if (qty < items[i].unlockAt) { nextLocked = items[i]; break; } }

    var numEl = panelBody.querySelector(".mfg-free-qty-input");
    if (numEl && skip !== "number") numEl.value = qty;
    var slider = panelBody.querySelector(".mfg-free-slider");
    if (slider && skip !== "slider") slider.value = Math.min(qty, maxAt);

    var fill = panelBody.querySelector(".mfg-free-track__fill");
    if (fill) fill.style.width = freePct(qty, maxAt) + "%";
    var markerEls = panelBody.querySelectorAll(".mfg-free-track__marker");
    var tickEls = panelBody.querySelectorAll(".mfg-free-track__tick:not(.is-first)");
    items.forEach(function (it, idx) {
      if (markerEls[idx]) markerEls[idx].classList.toggle("is-on", qty >= it.unlockAt);
      if (tickEls[idx]) tickEls[idx].classList.toggle("is-on", qty >= it.unlockAt);
    });
    var cap = panelBody.querySelector(".mfg-free-progress__caption");
    if (cap) cap.innerHTML = "<strong>" + unlocked + "</strong> of " + items.length +
      " free item" + (items.length !== 1 ? "s" : "") + " unlocked";
    var next = panelBody.querySelector(".mfg-free-progress__next");
    if (next) next.innerHTML = nextLocked
      ? "Add <strong>" + fmtNum(nextLocked.unlockAt - qty) + "</strong> more units to unlock " + esc(nextLocked.label)
      : "All free items unlocked 🎉";

    var goalEls = panelBody.querySelectorAll(".mfg-free-goal");
    items.forEach(function (it, idx) {
      var el = goalEls[idx];
      if (!el) return;
      var on = qty >= it.unlockAt;
      el.classList.toggle("is-unlocked", on);
      el.classList.toggle("is-locked", !on);
      var status = el.querySelector(".mfg-free-item__status");
      if (status) {
        status.className = "mfg-free-item__status" + (on ? " mfg-free-item__status_on" : "");
        status.innerHTML = on
          ? icon(UTIL, "success", "mfg-free-item__status-icon") + "Unlocked"
          : icon(UTIL, "lock", "mfg-free-item__status-icon") + fmtNum(it.unlockAt - qty) + " more to unlock";
      }
      var bar = el.querySelector(".mfg-free-goal__bar-fill");
      if (bar) bar.style.width = freePct(qty, it.unlockAt) + "%";
      var meta = el.querySelector(".mfg-free-goal__meta span");
      if (meta) meta.textContent = fmtNum(Math.min(qty, it.unlockAt)) + " / " + fmtNum(it.unlockAt) + " units";
    });
  }

  var DETAIL_TABS = [
    { id: "details", label: "Details", body: detailsTabHTML },
    { id: "promotions", label: "Promotions", body: promotionsTabHTML },
    { id: "free", label: "Free items", body: freeTabHTML }
  ];

  function setupDetailPanel(card, body) {
    var layout = card.querySelector(".mfg-grid-layout");
    if (!layout) return;
    var panel = document.createElement("aside");
    panel.className = "mfg-detail-panel";
    panel.setAttribute("aria-label", "Product details");
    panel.hidden = true;
    layout.appendChild(panel);

    var active = "details";
    var current = null; // last row's data
    var currentTr = null; // the row the panel is showing (for live qty edits)
    var trigger = null; // product link that opened the panel (for focus return)

    function render() {
      if (!current) return;
      // Roving tabindex + aria-controls/labelledby so the panel is a proper
      // tab/tabpanel pair for screen readers.
      var tabsHTML = DETAIL_TABS.map(function (t) {
        var on = t.id === active;
        return '<button type="button" class="mfg-detail-tab' + (on ? " is-active" : "") +
          '" data-tab="' + t.id + '" id="mfg-dtab-' + t.id + '" role="tab"' +
          ' aria-selected="' + on + '" tabindex="' + (on ? "0" : "-1") + '"' +
          ' aria-controls="mfg-dpanel">' + t.label + "</button>";
      }).join("");
      var tab = DETAIL_TABS.filter(function (t) { return t.id === active; })[0] || DETAIL_TABS[0];
      panel.innerHTML =
        '<div class="mfg-detail-panel__head">' +
          '<div class="mfg-detail-panel__title">' + esc(current.product) + "</div>" +
          '<button type="button" class="mfg-detail-panel__close" aria-label="Close panel">' + icon(UTIL, "close", "mfg-detail-panel__close-icon") + "</button>" +
        "</div>" +
        '<div class="mfg-detail-panel__tabs" role="tablist" aria-label="Product detail sections">' + tabsHTML + "</div>" +
        '<div class="mfg-detail-panel__body" id="mfg-dpanel" role="tabpanel" tabindex="0" aria-labelledby="mfg-dtab-' + active + '">' + tab.body(current) + "</div>";
    }

    function open(tr, triggerEl) {
      current = rowData(tr);
      currentTr = tr;
      active = "details";
      trigger = triggerEl || null;
      render();
      panel.hidden = false;
      var closeBtn = panel.querySelector(".mfg-detail-panel__close");
      if (closeBtn) closeBtn.focus(); // move focus into the newly opened panel
    }
    function close() {
      panel.hidden = true;
      if (trigger) { trigger.focus(); trigger = null; } // return focus to the opener
    }

    // click a product name → open the panel for that row
    body.addEventListener("click", function (e) {
      var link = e.target.closest(".mfg-product-link");
      if (!link) return;
      e.preventDefault();
      open(link.closest("tr"), link);
    });

    // tab switching + close
    panel.addEventListener("click", function (e) {
      if (e.target.closest(".mfg-detail-panel__close")) { close(); return; }
      if (e.target.closest(".mfg-promo-pop__terms")) { e.preventDefault(); return; }
      var tabBtn = e.target.closest(".mfg-detail-tab");
      if (tabBtn) { active = tabBtn.getAttribute("data-tab"); render(); panel.querySelector(".mfg-detail-tab.is-active").focus(); }
    });

    // Free-items tab: the qty field + slider both drive the order quantity.
    // Dragging/typing gives a live preview; the release/blur (change) commits the
    // new quantity to the actual order line so real free items unlock.
    panel.addEventListener("input", function (e) {
      var src = e.target.closest(".mfg-free-slider") ? "slider"
        : e.target.closest(".mfg-free-qty-input") ? "number" : null;
      if (!src || !current) return;
      var qty = Math.max(0, parseInt(e.target.value, 10) || 0);
      syncFreeTab(panel.querySelector(".mfg-detail-panel__body"), current, qty, src);
    });
    panel.addEventListener("change", function (e) {
      var isSlider = !!e.target.closest(".mfg-free-slider");
      if (!isSlider && !e.target.closest(".mfg-free-qty-input")) return;
      if (!currentTr) return;
      var qty = Math.max(0, parseInt(e.target.value, 10) || 0);
      var cell = currentTr.querySelector(".mfg-qty-cell");
      if (cell) setLineQty(cell, qty); // updates order qty, totals, free summary
      current = rowData(currentTr);
      syncFreeTab(panel.querySelector(".mfg-detail-panel__body"), current, current.qty);
    });

    // keyboard: Arrow keys rove tabs; Escape closes the panel
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { close(); return; }
      var tabBtn = e.target.closest(".mfg-detail-tab");
      if (!tabBtn) return;
      var idx = DETAIL_TABS.findIndex(function (t) { return t.id === active; });
      var next;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = DETAIL_TABS[(idx + 1) % DETAIL_TABS.length];
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = DETAIL_TABS[(idx - 1 + DETAIL_TABS.length) % DETAIL_TABS.length];
      else if (e.key === "Home") next = DETAIL_TABS[0];
      else if (e.key === "End") next = DETAIL_TABS[DETAIL_TABS.length - 1];
      if (next) { e.preventDefault(); active = next.id; render(); panel.querySelector(".mfg-detail-tab.is-active").focus(); }
    });
  }

  function startEdit(cell) {
    if (edit) commitEdit();
    var valueSpan = cell.querySelector(".mfg-qty-value");
    var qty = parseInt(valueSpan.textContent, 10) || 0;
    var size = uomSize(cell.getAttribute("data-uom"));

    var tiers = [];
    try { tiers = JSON.parse(decodeURIComponent(cell.getAttribute("data-tiers") || "[]")); } catch (e) { tiers = []; }

    var card = cell.closest(".mfg-assortment-card");
    var variant = card ? card.getAttribute("data-variant") : null;
    // Dual-identity variant "g" (data-variant="e" + mfg-ux-gamified): re-enable
    // Variant A's gamified qty-edit popover on top of the E base. It carries a
    // base variant of "e" (normally a plain, popover-free flow), so this flag
    // opts it back into the during-edit progress-bar popover.
    var gamified = !!(card && card.classList.contains("mfg-ux-gamified"));
    // Variant B explores a popover-free flow: plain inline edit, no rounding
    // popover and no during-edit side rail — free items live in the summary.
    var plain = !gamified && (variant === "b" || variant === "d" || variant === "e" || variant === "f" || variant === "m");
    // The qty-edit free-items side panel is retired: Variant A dropped it,
    // Variant B rolls free items into the summary, and Variant C shows them in
    // a click-to-open tabbed detail panel instead. The gamified variant shows
    // the popover's progress bar (no side panel), matching Variant A.
    var noPanel = plain || variant === "a" || variant === "c" || gamified;

    cell.classList.add("mfg-qty-editing");
    // While editing, the cell is no longer a "button" — the inner spinbutton is
    // the real control. Drop the wrapping button role/tabindex AND the cell's own
    // aria-label ("Edit Order Qty: …") so AT, keyboard, and automation target the
    // labeled <input> cleanly. The resting label is deliberately worded "Edit
    // Order Qty:" (not "…order quantity for…") so it does NOT substring-collide
    // with the input's name "Order quantity for <product> (<uom>)" — a loose
    // name lookup for the field can no longer resolve to the non-fillable cell.
    // The SLDS editable-cell pattern keeps the field's accessible name on the
    // active editor only. commitEdit restores role/tabindex/aria-label on end.
    cell.removeAttribute("role");
    cell.removeAttribute("tabindex");
    cell.removeAttribute("aria-label");
    cell.innerHTML = '<input type="number" min="0" step="1" class="slds-input mfg-qty-input" value="' + qty + '" aria-label="Order quantity" />';
    var input = cell.querySelector(".mfg-qty-input");

    var pop = null;
    if (!plain) {
      pop = document.createElement("section");
      pop.className = "slds-popover slds-popover_small slds-nubbin_top mfg-qty-popover" + (tiers.length ? " mfg-qty-popover_promo" : "") + (gamified && tiers.length ? " mfg-qty-popover_interactive" : "");
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "Order quantity options");
      document.body.appendChild(pop);
    }

    var productEl = cell.parentElement.querySelector(".mfg-product-link");
    edit = {
      cell: cell, input: input, popover: pop, size: size, orig: qty,
      uom: cell.getAttribute("data-uom"),
      tiers: tiers,
      product: productEl ? productEl.textContent : "This product",
      card: card, variant: variant, plain: plain, gamified: gamified,
      freePanel: (card && !noPanel) ? card.querySelector(".mfg-free-panel") : null,
      net: parseFloat(cell.getAttribute("data-net")) || 0,
      netEl: cell.parentElement.querySelector(".mfg-nettotal-cell")
    };
    input.setAttribute("aria-label", "Order quantity for " + edit.product + " (" + edit.uom + ")");
    if (!noPanel) {
      showFreePanel(edit.product, edit.tiers, edit.uom, qty);
    }
    if (!plain) {
      refreshPopover();
      positionPopover();
      input.addEventListener("input", refreshPopover);
      if (gamified) wireGamifiedSlider(edit);
    }
    input.focus();
    input.select();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commitActive(); }
      else if (e.key === "Escape") { e.preventDefault(); commitEdit(edit.orig, null, false); }
    });
  }

  // Commit the active edit respecting the variant: plain value for B, otherwise
  // snap to the pack multiple. Variant G (gamified) also commits the exact value:
  // its interactive slider/milestones set the qty directly, and since it hides
  // the Entered→Rounded explainer, a silent pack-snap would move a clicked
  // milestone off its threshold — so the value the user set is the value kept.
  function commitActive() {
    if (!edit) return;
    if (edit.plain || edit.gamified) { commitEdit(parseInt(edit.input.value, 10) || 0, null, true); }
    else commitRounded();
  }

  function qtyCellHTML(qty, roundDir) {
    var mark = "";
    if (roundDir) {
      var markIcon = roundDir === "up" ? "arrowup" : "arrowdown";
      mark = '<span class="mfg-qty-rounded mfg-qty-rounded_' + roundDir + '"' +
        ' title="Rounded ' + roundDir + ' to a pack multiple">' +
        icon(UTIL, markIcon, "mfg-qty-rounded-icon") + "</span>";
    }
    return mark + '<span class="mfg-qty-value">' + qty + "</span>" +
      '<span class="mfg-qty-pencil">' + icon(UTIL, "edit") + "</span>";
  }

  // commit the entered value rounded to the pack multiple (used by Enter / blur)
  function commitRounded() {
    if (!edit) return;
    var typed = parseInt(edit.input.value, 10) || 0;
    var round = computeRounding(typed, edit.size);
    if (round.aligned) commitEdit(typed, null, true);
    else commitEdit(round.value, round.dir, true);
  }

  // overrideValue: committed qty (defaults to the typed value)
  // roundDir:  "up" | "down" when a rounding was applied — adds a marker to the saved cell
  // edited:    true when this is a real edit (Enter / blur / confirm) — flags the cell dirty
  function commitEdit(overrideValue, roundDir, edited) {
    if (!edit) return;
    var qty = overrideValue != null ? overrideValue : (parseInt(edit.input.value, 10) || 0);
    var cell = edit.cell, netEl = edit.netEl, net = edit.net, orig = edit.orig, card = edit.card;
    // If focus is still inside the editor (keyboard commit via Enter/Escape),
    // return it to the qty cell so keyboard users don't get dropped to <body>.
    var refocus = cell.contains(document.activeElement) || (edit.popover && edit.popover.contains(document.activeElement));
    edit.input.removeEventListener("input", refreshPopover);
    if (edit.popover && edit.popover.parentNode) edit.popover.parentNode.removeChild(edit.popover);

    cell.classList.remove("mfg-qty-editing");
    // Restore the read-state button semantics dropped in startEdit and refresh
    // the accessible name so it announces the committed quantity.
    cell.setAttribute("role", "button");
    cell.setAttribute("tabindex", "0");
    cell.setAttribute("aria-label", "Edit Order Qty: " + edit.product + " (" + edit.uom + "), current " + qty);
    cell.innerHTML = qtyCellHTML(qty, roundDir);
    if (netEl) setNetTotal(netEl, fmtMoney(qty * net)); // Net Total is plain black, not a link
    hideFreePanel();
    edit = null;
    if (refocus) cell.focus();

    if (edited) markEdited(cell, netEl, net, orig);
    // keep the free-items summary (variant B) in sync with the new qty
    if (card && card._refreshFreeSummary) card._refreshFreeSummary();
    updateOrderTotals(card); // live Order Summary totals track the qty change
    syncCartFromGrid(card);  // persist entered qty into the cart immediately
  }

  // Programmatically set a line's Order Qty (used by the Row-actions menu, e.g.
  // "Remove line" → 0, "Set to suggested"). Mirrors commitEdit's read-state
  // rebuild + totals refresh without going through an active inline edit.
  function setLineQty(cell, qty) {
    if (!cell) return;
    if (cell.classList.contains("mfg-qty-editing")) commitEdit(qty, null, true);
    var net = parseFloat(cell.getAttribute("data-net")) || 0;
    var netEl = cell.parentElement.querySelector(".mfg-nettotal-cell");
    var productEl = cell.parentElement.querySelector(".mfg-product-link");
    var product = productEl ? productEl.textContent : "This product";
    var uom = cell.getAttribute("data-uom") || "";
    var orig = parseInt((cell.querySelector(".mfg-qty-value") || {}).textContent, 10) || 0;
    if (orig === qty) return;
    cell.setAttribute("aria-label", "Edit Order Qty: " + product + " (" + uom + "), current " + qty);
    cell.innerHTML = qtyCellHTML(qty, null);
    if (netEl) setNetTotal(netEl, fmtMoney(qty * net));
    var card = cell.closest(".mfg-assortment-card");
    markEdited(cell, netEl, net, orig);
    if (card && card._refreshFreeSummary) card._refreshFreeSummary();
    updateOrderTotals(card);
    syncCartFromGrid(card);  // persist entered qty into the cart immediately
  }

  // --- inline-edit dirty tracking + docked save bar -------------------------
  var dirty = [];            // { cell, netEl, net, origQty } snapshots for revert
  var editFooter = document.getElementById("edit-footer");

  function isDirty(cell) {
    for (var i = 0; i < dirty.length; i++) { if (dirty[i].cell === cell) return true; }
    return false;
  }

  function markEdited(cell, netEl, net, origQty) {
    cell.classList.add("mfg-is-edited");
    if (!isDirty(cell)) dirty.push({ cell: cell, netEl: netEl, net: net, origQty: origQty });
    updateEditFooter();
  }

  function updateEditFooter() {
    if (!editFooter) return;
    editFooter.hidden = dirty.length === 0;
    // The footer is fixed above the summary in single view; re-reserve page space
    // below the grid so its last rows can still scroll clear of the footer. With a
    // Cart tab there are two [data-variant="b"] cards — reserve on the visible one.
    if (document.body.classList.contains("mfg-single")) {
      var sc = Array.prototype.filter.call(
        document.querySelectorAll('.mfg-assortment-card[data-variant="b"]'),
        function (c) { return c.getClientRects().length; }
      )[0];
      if (sc && sc._reserveSpace) sc._reserveSpace();
    }
  }

  function saveEdits() {
    dirty.forEach(function (d) { d.cell.classList.remove("mfg-is-edited"); });
    dirty = [];
    updateEditFooter();
  }

  function cancelEdits() {
    var cards = [];
    dirty.forEach(function (d) {
      d.cell.classList.remove("mfg-is-edited");
      d.cell.innerHTML = qtyCellHTML(d.origQty, null);
      if (d.netEl) setNetTotal(d.netEl, '<span class="mfg-value-link">' + fmtMoney(d.origQty * d.net) + "</span>");
      var card = d.cell.closest(".mfg-assortment-card");
      if (card && cards.indexOf(card) === -1) cards.push(card);
    });
    dirty = [];
    updateEditFooter();
    // Reverting changes the Net Totals back, so recompute the summary totals
    // (and free-items summary) for every card that had edits.
    cards.forEach(function (card) {
      if (card._refreshFreeSummary) card._refreshFreeSummary();
      updateOrderTotals(card);
    });
  }

  // --- per-block wiring ------------------------------------------------------
  // Each assortment card ("block") is an independent grid so the same UI can be
  // explored three different ways. All grid-local behavior is scoped to its card.
  function initCard(card) {
    var body = card.querySelector(".mfg-grid-body");
    if (!body) return;
    var countEl = card.querySelector(".mfg-selected-count");
    var selectAll = card.querySelector(".mfg-select-all");
    var variant = card.getAttribute("data-variant") || "x";
    var prefix = gridPrefixOf(card);

    // Variant M2 is a purpose-built manufacturing grid rendered by its own
    // self-contained module (assets/m2.js). It replaces the CPG grid markup
    // wholesale, so skip every generic wiring path below.
    if (variant === "m2") { if (window.setupM2) window.setupM2(card); return; }
    // Variant M3 — same purpose-built manufacturing UX as M2, but the grid is
    // rendered by AG Grid Community (assets/m2ag.js) instead of a hand table.
    if (variant === "m3") { if (window.setupM2AG) window.setupM2AG(card); return; }

    renderInto(body, prefix, rowsFor(card, card.classList.contains("mfg-mode-free")));
    if (card._isCart) applyCartEmptyState(card);
    updateCountFor(body, countEl);
    updateOrderTotals(card); // seed the Order Summary totals from the initial grid

    body.addEventListener("click", function (e) {
      var toggle = e.target.closest("[data-toggle]");
      if (toggle) {
        var idx = toggle.getAttribute("data-toggle");
        var open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!open));
        body.querySelectorAll('.mfg-child-row[data-parent="' + idx + '"]').forEach(function (row) {
          row.classList.toggle("mfg-hidden", open);
        });
        return;
      }
      var qtyCell = e.target.closest(".mfg-qty-cell");
      if (qtyCell && !qtyCell.classList.contains("mfg-qty-editing")) {
        e.preventDefault();
        startEdit(qtyCell);
      }
    });

    body.addEventListener("keydown", function (e) {
      var qtyCell = e.target.closest(".mfg-qty-cell");
      if (!qtyCell || qtyCell.classList.contains("mfg-qty-editing")) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startEdit(qtyCell);
        return;
      }

      // Arrow-key navigation up/down the Order Qty column. Only visible cells
      // (collapsed child rows are skipped) participate; Home/End jump to ends.
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
        var cells = Array.prototype.filter.call(
          body.querySelectorAll(".mfg-qty-cell"),
          function (c) { return c.offsetParent !== null; } // visible only
        );
        var idx = cells.indexOf(qtyCell);
        if (idx === -1) return;
        var next;
        if (e.key === "ArrowDown") next = cells[idx + 1];
        else if (e.key === "ArrowUp") next = cells[idx - 1];
        else if (e.key === "Home") next = cells[0];
        else next = cells[cells.length - 1];
        if (next) {
          e.preventDefault();
          next.focus();
        }
      }
    });

    body.addEventListener("change", function (e) {
      if (e.target.classList.contains("mfg-row-check")) updateCountFor(body, countEl);
    });

    if (selectAll) {
      selectAll.addEventListener("change", function () {
        body.querySelectorAll(".mfg-row-check").forEach(function (cb) { cb.checked = selectAll.checked; });
        updateCountFor(body, countEl);
      });
    }

    // per-block order-summary collapse (Variant B's chevron instead drives the
    // free-items section — wired in setupFreeSummary)
    var summaryToggle = card.querySelector(".mfg-order-summary__toggle");
    var summaryTotals = card.querySelector(".mfg-order-summary__totals");
    if (summaryToggle && variant !== "b" && variant !== "d" && variant !== "e" && variant !== "f" && variant !== "m") {
      summaryToggle.addEventListener("click", function () {
        var open = summaryToggle.getAttribute("aria-expanded") === "true";
        summaryToggle.setAttribute("aria-expanded", String(!open));
        if (summaryTotals) summaryTotals.classList.toggle("mfg-hidden", open);
      });
    }

    // Variant B: free-items indicator + expandable drawer in the summary
    if (variant === "b" || variant === "d") { setupFreeSummary(card, body); setupFrozenProductColumn(card); }
    // Variant E (inspection feedback): reuse the free-items summary, but relocate
    // it into a persistent top notification + a right-side Order Summary panel.
    // Variant M (manufacturing) reuses the exact Inspection-feedback wiring —
    // proving the interaction model is data-agnostic — plus a detail side panel
    // so bundle/kit BOM components and specs can be inspected per line.
    else if (variant === "e" || variant === "m") { setupFreeSummary(card, body); setupFreeModal(card); if (variant === "e") setupGridScroll(card); }
    // Variant F: same as E (notification + free-items modal), but instead of a
    // dedicated column, clicking a line item opens a tabbed detail side panel
    // (Details / Promotions / Free items with an unlock-progress view).
    else if (variant === "f") { setupFreeSummary(card, body); setupFreeModal(card); }
    // Variants C & F: click a product name to open a tabbed detail side panel
    if (variant === "c" || variant === "f" || variant === "m") setupDetailPanel(card, body);
    // Dual-identity variant "g" (mfg-ux-gamified): the E base plus Variant A's
    // gamified qty-edit progress-bar popover — wired directly in startEdit (no
    // per-card setup needed), so nothing extra is initialised here.
  }

  // Cart grid empty state: a single centred placeholder row when the cart has no
  // items for the current mode. Removed automatically once real rows render.
  function applyCartEmptyState(card) {
    var body = card.querySelector(".mfg-grid-body");
    if (!body || body.querySelector(".mfg-parent-row")) return;
    var mode = card.classList.contains("mfg-mode-free") ? "free items" : "products";
    body.innerHTML =
      '<tr class="mfg-cart-empty"><td colspan="15">' +
        "No " + mode + " in your cart yet — set an Order Qty on the Assortment Products tab, then choose Add to Cart." +
      "</td></tr>";
  }

  // Variant B: the Product Name column (and the leading columns) are frozen to
  // the left (see CSS); here we add a drag handle so the column is resizable.
  // The width lives in a CSS custom property on the card, shared by th + td.
  function setupFrozenProductColumn(card) {
    var th = card.querySelector("thead th.mfg-col-product");
    if (!th) return;
    th.classList.add("mfg-col-resizable");
    var resizer = document.createElement("span");
    resizer.className = "mfg-col-resizer";
    resizer.title = "Drag to resize";
    // Keyboard-operable separator: focusable, labeled, resizable with arrows.
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "vertical");
    resizer.setAttribute("aria-label", "Resize Product Name column");
    resizer.setAttribute("tabindex", "0");
    th.appendChild(resizer);

    function clampW(w) { return Math.max(140, Math.min(560, w)); }
    var startX = 0, startW = 0;
    function onMove(e) {
      card.style.setProperty("--mfg-product-col-w", clampW(startW + (e.clientX - startX)) + "px");
    }
    resizer.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 40 : 10;
      var delta = 0;
      if (e.key === "ArrowRight") delta = step;
      else if (e.key === "ArrowLeft") delta = -step;
      else return;
      e.preventDefault();
      var cur = th.getBoundingClientRect().width;
      card.style.setProperty("--mfg-product-col-w", clampW(cur + delta) + "px");
    });
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("mfg-col-resizing");
    }
    resizer.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startW = th.getBoundingClientRect().width;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.classList.add("mfg-col-resizing");
    });
  }

  // Variant D: make the flattened table's first column (Reward type) resizable.
  // The width lives in --mfg-free-type-col-w on the card, shared by header +
  // the clubbed rowgroup cells (see CSS). The flat table is re-rendered on every
  // drawer open, so this re-attaches the handle after each fill.
  function setupFlatTypeResizer(card, drawer) {
    var th = drawer.querySelector(".mfg-free-table_flat thead th:first-child");
    if (!th || th.querySelector(".mfg-col-resizer")) return;
    th.classList.add("mfg-col-resizable");
    var resizer = document.createElement("span");
    resizer.className = "mfg-col-resizer";
    resizer.title = "Drag to resize";
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "vertical");
    resizer.setAttribute("aria-label", "Resize Reward type column");
    resizer.setAttribute("tabindex", "0");
    th.appendChild(resizer);

    function clampW(w) { return Math.max(120, Math.min(420, w)); }
    var startX = 0, startW = 0;
    function onMove(e) {
      card.style.setProperty("--mfg-free-type-col-w", clampW(startW + (e.clientX - startX)) + "px");
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("mfg-col-resizing");
    }
    resizer.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startW = th.getBoundingClientRect().width;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.classList.add("mfg-col-resizing");
    });
    resizer.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 40 : 10, delta = 0;
      if (e.key === "ArrowRight") delta = step;
      else if (e.key === "ArrowLeft") delta = -step;
      else return;
      e.preventDefault();
      card.style.setProperty("--mfg-free-type-col-w", clampW(th.getBoundingClientRect().width + delta) + "px");
    });
  }

  // popover buttons (Apply / Close / Confirm / Cancel)
  document.addEventListener("click", function (e) {
    if (!edit) return;
    var confirm = e.target.closest(".mfg-rnd-confirm");
    if (confirm) {
      var val = parseInt(confirm.getAttribute("data-value"), 10) || 0;
      var entered = parseInt(edit.input.value, 10) || 0;
      var dir = val > entered ? "up" : (val < entered ? "down" : "");
      commitEdit(val, dir, true);
      return;
    }
    if (e.target.closest(".mfg-rnd-cancel")) { commitEdit(edit.orig, null, false); return; }
    var apply = e.target.closest(".mfg-pop-apply");
    if (apply) {
      edit.input.value = apply.getAttribute("data-value");
      refreshPopover();
      positionPopover();
      edit.input.focus();
      return;
    }
    if (e.target.closest(".mfg-pop-close")) { commitEdit(); return; }
  });

  // click outside cell + popover commits
  document.addEventListener("mousedown", function (e) {
    if (!edit) return;
    if (edit.cell.contains(e.target)) return;
    if (edit.popover && edit.popover.contains(e.target)) return;
    if (edit.freePanel && edit.freePanel.contains(e.target)) return;
    commitActive();
  });

  // --- success toast ---------------------------------------------------------
  var toastRegion = null;
  function showToast(message) {
    if (!toastRegion) {
      toastRegion = document.createElement("div");
      toastRegion.className = "mfg-toast-region";
      document.body.appendChild(toastRegion);
    }
    var wrap = document.createElement("div");
    wrap.className = "slds-notify_container slds-is-relative";
    wrap.innerHTML =
      '<div class="slds-notify slds-notify_toast slds-theme_success mfg-toast" role="status">' +
        '<span class="slds-assistive-text">Success</span>' +
        '<span class="slds-icon_container slds-icon-utility-success slds-m-right_small slds-no-flex slds-align-top">' +
          icon(UTIL, "success", "slds-icon slds-icon_small") +
        "</span>" +
        '<div class="slds-notify__content"><h2 class="slds-text-heading_small">' + esc(message) + "</h2></div>" +
        '<div class="slds-notify__close">' +
          '<button class="slds-button slds-button_icon slds-button_icon-inverse mfg-toast__close" title="Close">' +
            icon(UTIL, "close", "slds-button__icon") + '<span class="slds-assistive-text">Close</span>' +
          "</button>" +
        "</div>" +
      "</div>";
    toastRegion.appendChild(wrap);
    var timer = setTimeout(dismiss, 3400);
    function dismiss() {
      clearTimeout(timer);
      wrap.classList.add("mfg-toast_out");
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 220);
    }
    var closeBtn = wrap.querySelector(".mfg-toast__close");
    if (closeBtn) closeBtn.addEventListener("click", dismiss);
  }

  // --- cart population --------------------------------------------------------
  // Whichever assortment card is currently on screen (main grid, or the cart
  // grid itself when the buyer trims quantities there) is the source of truth.
  function activeAssortmentCard() {
    var cartStack = document.getElementById("cart-stack");
    if (cartStack && !cartStack.hidden && CART_STATE.cartCard) return CART_STATE.cartCard;
    return CART_STATE.assortCard;
  }
  function cartLineCount() {
    function n(arr) {
      return (arr || []).reduce(function (s, r) { return s + 1 + ((r.children && r.children.length) || 0); }, 0);
    }
    return n(window.MFG_CART.standard) + n(window.MFG_CART.free);
  }
  function updateCartTabCount() {
    var link = document.querySelector('.mfg-tabs .slds-tabs_default__link[data-tab="cart"]');
    if (link) link.textContent = "Cart (" + cartLineCount() + ")";
  }
  function renderRowsToHTML(prefix, rows) {
    var tb = document.createElement("tbody");
    renderInto(tb, prefix, rows || []);
    return tb.innerHTML;
  }
  // Re-render the cart card from window.MFG_CART, priming BOTH catalog snapshots
  // so promotion offers, product rewards and custom free items all resolve in the
  // cart's own Order Summary regardless of which mode is mounted.
  function renderCartCard() {
    var cc = CART_STATE.cartCard;
    if (!cc) return;
    var body = cc.querySelector(".mfg-grid-body");
    if (!body) return;
    var prefix = gridPrefixOf(cc);
    cc._catalogCache = {
      standard: renderRowsToHTML(prefix, window.MFG_CART.standard),
      free: renderRowsToHTML(prefix, window.MFG_CART.free)
    };
    var freeMode = cc.classList.contains("mfg-mode-free");
    body.innerHTML = cc._catalogCache[freeMode ? "free" : "standard"];
    applyCartEmptyState(cc);
    updateCountFor(body, cc.querySelector(".mfg-selected-count"));
    if (cc._refreshFreeSummary) cc._refreshFreeSummary();
    updateOrderTotals(cc);
  }
  function addToCart() {
    if (CART_STATE.cartCard) {
      var snap = subsetFromCard(activeAssortmentCard());
      window.MFG_CART.standard = snap.standard;
      window.MFG_CART.free = snap.free;
      renderCartCard();
      updateCartTabCount();
    }
    showToast("Added to cart");
  }

  // Live cart persistence: mirror the main grid's entered quantities into the
  // cart on every qty commit, so the Cart tab always reflects what's in the grid
  // (no manual Add-to-Cart step) and the order carries across tab navigation.
  // Only the main assortment card seeds the cart — edits made inside the cart
  // card update its own totals in place; re-snapshotting there would drop a
  // just-zeroed line mid-edit and steal focus.
  function syncCartFromGrid(card) {
    if (!CART_STATE.cartCard || !card || card._isCart) return;
    var snap = subsetFromCard(card);
    window.MFG_CART.standard = snap.standard;
    window.MFG_CART.free = snap.free;
    renderCartCard();
    updateCartTabCount();
  }

  // docked save-bar actions
  if (editFooter) {
    editFooter.addEventListener("click", function (e) {
      if (e.target.closest(".mfg-edit-save")) { if (edit) commitActive(); saveEdits(); addToCart(); }
      else if (e.target.closest(".mfg-edit-cancel")) { if (edit) commitEdit(edit.orig, null, false); cancelEdits(); }
    });
  }
  window.addEventListener("resize", function () { if (edit && edit.popover) positionPopover(); });

  // popover-style toggle (top-right of the page)
  var styleSwitch = document.querySelector(".mfg-style-switch");
  if (styleSwitch) {
    styleSwitch.addEventListener("click", function (e) {
      var btn = e.target.closest(".mfg-style-switch__btn");
      if (!btn) return;
      POPOVER_STYLE = btn.getAttribute("data-style");
      styleSwitch.querySelectorAll(".mfg-style-switch__btn").forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      if (edit) { refreshPopover(); positionPopover(); }
    });
  }

  // --- tab switching (visual only) ------------------------------------------
  // Visual class + full ARIA tab state so the selected tab is announced and the
  // tablist follows the APG roving-tabindex + Arrow-key pattern.
  var TAB_LINKS = Array.prototype.slice.call(document.querySelectorAll(".mfg-tabs .slds-tabs_default__link"));
  function activateTab(link, focus) {
    TAB_LINKS.forEach(function (l) {
      var active = l === link;
      var li = l.closest(".slds-tabs_default__item");
      if (li) li.classList.toggle("slds-is-active", active);
      l.setAttribute("aria-selected", String(active));
      l.setAttribute("tabindex", active ? "0" : "-1");
    });
    switchPanel(link.getAttribute("data-tab"));
    if (focus) link.focus();
  }

  // Single-view content routing: the Cart tab shows the cart card, every other
  // tab shows the assortment card. The one edit/Add-to-Cart footer is re-docked
  // into whichever card is on screen. (No-op until the cart card is built.)
  function dockFooterInto(card) {
    var ef = document.getElementById("edit-footer");
    if (!ef || !card) return;
    var cardFooter = card.querySelector(".mfg-order-summary");
    if (cardFooter && cardFooter.parentNode === card) card.insertBefore(ef, cardFooter);
  }
  function switchPanel(tab) {
    var cartStack = document.getElementById("cart-stack");
    if (!cartStack || !CART_STATE.cartCard) return; // only when a cart exists (single view)
    var assortStack = document.getElementById("variant-stack");
    var showCart = tab === "cart";
    if (edit) commitActive(); // close any open editor before moving the shared footer
    if (assortStack) assortStack.hidden = showCart;
    cartStack.hidden = !showCart;
    var target = showCart ? CART_STATE.cartCard : CART_STATE.assortCard;
    dockFooterInto(target);
    if (target._refreshFreeSummary) target._refreshFreeSummary();
    if (target._reserveSpace) { target._reserveSpace(); window.requestAnimationFrame(target._reserveSpace); }
  }
  TAB_LINKS.forEach(function (link, i) {
    link.addEventListener("click", function (e) { e.preventDefault(); activateTab(link); });
    link.addEventListener("keydown", function (e) {
      var next;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = TAB_LINKS[(i + 1) % TAB_LINKS.length];
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = TAB_LINKS[(i - 1 + TAB_LINKS.length) % TAB_LINKS.length];
      else if (e.key === "Home") next = TAB_LINKS[0];
      else if (e.key === "End") next = TAB_LINKS[TAB_LINKS.length - 1];
      if (next) { e.preventDefault(); activateTab(next, true); }
    });
  });

  // --- build the three explorable blocks ------------------------------------
  // One card lives in index.html as the template; clone it into A/B/C so each
  // block can host a different UI treatment. IDs are made unique per clone.
  var VARIANTS = [
    { id: "a", label: "Variant A", desc: "Gamified rounding popover + free-items side rail" },
    { id: "b", label: "Variant B", desc: "Free items rolled up into the Order Summary drawer" },
    { id: "e", label: "Inspection feedback", desc: "Free-items metric in Order Summary + per-row Net Total badges + free-items modal" },
    { id: "g", base: "e", label: "Inspection feedback + gamified unlock", desc: "Everything in Inspection feedback, plus Variant A's gamified progress-bar popover on the Order Qty cell: while you edit a line's quantity, a milestone track shows how much more to order to unlock the next free item ('12 more to unlock Lay's Classic'), with a marker per promotion tier that flips from locked to unlocked as the bar fills." },
    { id: "f", label: "Variant F", desc: "Same as Inspection feedback, plus a click-to-open detail side panel (Details / Promotions / Free items with unlock progress)" },
    { id: "m", label: "Variant M — Manufacturing", desc: "Inspection-feedback UX re-skinned for a manufacturing order: volume price breaks, bundle/kit BOM expansion, contracted-price line, industrial UoMs. Same grid + modal, manufacturing data." },
    { id: "m2", label: "Variant M2 — Manufacturing (purpose-built)", desc: "If Manufacturing Cloud designed the grid from scratch: agreement context bar (contract price, draw-down, rebate, credit), per-line UoM selector, enforced min/order-multiple qty stepper, contract vs list price, ATP/availability, and one expandable detail row that carries the price-break ladder, kit BOM, alternate UoMs, agreement perks and delivery/split. Rich order summary." },
    { id: "m3", label: "Variant M3 — Manufacturing (AG Grid)", desc: "Identical UX to M2 — same agreement bar, UoM selector, enforced qty stepper, contract pricing, ATP, expandable detail and rich summary — but the order grid is rendered by AG Grid Community (the same build as the mfgOrderGrid LWC), using custom cell renderers and full-width rows for the expandable detail." }
  ];

  function uniquifyIds(root, suffix) {
    root.querySelectorAll("[id]").forEach(function (el) {
      var old = el.id, neu = old + "-" + suffix;
      root.querySelectorAll('[for="' + old + '"]').forEach(function (l) { l.setAttribute("for", neu); });
      el.id = neu;
    });
  }

  function labelCard(card, v) {
    // Dual-identity variants (v.base set, e.g. "g" built on "e"): the DOM element
    // carries data-variant = the BASE id, so every existing base-variant CSS rule
    // and JS branch applies verbatim (pixel-identical, zero-risk copy). The
    // routing/label identity (v.id) is kept on data-variant-key, and a distinct
    // id-prefix keeps grid element ids unique. An extra class flags the UX layer
    // (mfg-ux-gamified → startEdit shows Variant A's progress-bar popover).
    if (v.base) {
      card.setAttribute("data-variant", v.base);
      card.setAttribute("data-variant-key", v.id);
      card.setAttribute("data-id-prefix", v.id);
      card.classList.add("mfg-ux-gamified");
    } else {
      card.setAttribute("data-variant", v.id);
    }
  }

  // "?variant=b" renders that single variant full-screen on its own page.
  var ONLY = new URLSearchParams(window.location.search).get("variant");

  // wrap a card in its own labeled section container. On the full-screen
  // single-variant page the showcase chrome (label chip + description + shaded
  // frame) is dropped so the card reads as clean tab content, matching Figma.
  function sectionFor(v, single) {
    var section = document.createElement("section");
    section.className = "mfg-variant-section" + (single ? " mfg-variant-section_bare" : "");
    section.setAttribute("data-variant-section", v.id);
    if (!single) {
      var head = document.createElement("div");
      head.className = "mfg-variant-section__head";
      head.innerHTML =
        '<span class="mfg-variant-section__label">' + esc(v.label) + "</span>" +
        (v.desc ? '<span class="mfg-variant-section__desc">' + esc(v.desc) + "</span>" : "");
      section.appendChild(head);
    }
    return section;
  }

  // On the multi-variant page, add a prominent "Go to prototype" button at the
  // top-right of Variant B's card that opens the full-screen single-variant page.
  function addGotoPrototype(card, v) {
    var actions = card.querySelector(".mfg-assortment-header__actions");
    if (!actions) return;
    var a = document.createElement("a");
    a.className = "slds-button slds-button_brand mfg-goto-proto";
    a.href = "?variant=" + v.id;
    a.innerHTML = icon(UTIL, "new_window", "mfg-goto-proto__icon") + "Go to prototype";
    actions.appendChild(a);
  }

  // Breadcrumb shown on a single-variant page, linking back to the 3-variant page.
  function breadcrumbFor(v) {
    var nav = document.createElement("nav");
    nav.className = "mfg-breadcrumb";
    nav.setAttribute("aria-label", "Breadcrumb");
    nav.innerHTML =
      '<a class="mfg-breadcrumb__back" href="index.html">' +
        icon(UTIL, "chevronleft", "mfg-breadcrumb__icon") + "Assortment prototypes" +
      "</a>" +
      '<span class="mfg-breadcrumb__sep" aria-hidden="true">/</span>' +
      '<span class="mfg-breadcrumb__current">' + esc(v.label) + "</span>";
    return nav;
  }

  function buildVariants() {
    var stack = document.getElementById("variant-stack");
    var template = (stack || document).querySelector(".mfg-assortment-card");
    if (!template) return [];

    var list = VARIANTS;
    var single = false;
    if (ONLY) {
      var match = VARIANTS.filter(function (v) { return v.id === ONLY; });
      if (match.length) { list = match; single = true; }
    }

    // Clone every copy from the pristine template FIRST, before any labeling or
    // id-rewriting mutates it — otherwise later clones inherit A's ids.
    var cards = list.map(function (v, idx) {
      return idx === 0 ? template : template.cloneNode(true);
    });
    if (single && stack) {
      stack.classList.add("mfg-variant-stack_single");
      // flag the whole page so the dev-only style switch can be hidden
      document.body.classList.add("mfg-single");
      // Place the back-nav breadcrumb in the page header (top-left, beside the
      // Orders title) rather than above the card.
      var crumbSlot = document.getElementById("mfg-breadcrumb-slot");
      (crumbSlot || stack).appendChild(breadcrumbFor(list[0]));
    }
    cards.forEach(function (card, idx) {
      var v = list[idx];
      labelCard(card, v);
      uniquifyIds(card, v.id);
      var section = sectionFor(v, single);
      if (stack) stack.appendChild(section); // moves template card too when appended
      section.appendChild(card);
      if (!single && (v.id === "b" || v.id === "d" || v.id === "e" || v.id === "g" || v.id === "f" || v.id === "m" || v.id === "m2" || v.id === "m3")) addGotoPrototype(card, v);
    });
    return cards;
  }

  // Mount the Cart tab's grid in its own (initially hidden) stack inside the
  // record tab panel, as a sibling of the assortment stack.
  function mountCartCard(card) {
    var content = document.querySelector(".slds-tabs_default__content");
    if (!content) return;
    var stack = document.createElement("div");
    stack.id = "cart-stack";
    stack.className = "mfg-variant-stack mfg-variant-stack_single mfg-cart-stack";
    stack.hidden = true;
    var section = document.createElement("section");
    section.className = "mfg-variant-section mfg-variant-section_bare";
    section.setAttribute("data-variant-section", "cart");
    section.appendChild(card);
    stack.appendChild(section);
    content.appendChild(stack);
  }

  var builtCards = buildVariants();
  CART_STATE.assortCard = builtCards[0] || null;
  // Single view only: clone a clean copy of the assortment card (before initCard
  // injects the free-summary drawer or docks the footer) to serve as the Cart
  // grid. Re-id it so its checkboxes never collide with the main grid's.
  var cartCard = null;
  if (ONLY && document.body.classList.contains("mfg-single") && builtCards[0]) {
    cartCard = builtCards[0].cloneNode(true);
    uniquifyIds(cartCard, "cart");
    cartCard.setAttribute("data-id-prefix", "cart");
    cartCard._isCart = true;
    mountCartCard(cartCard);
    CART_STATE.cartCard = cartCard;
  }
  builtCards.forEach(initCard);
  if (cartCard) initCard(cartCard);
  updateCartTabCount();

  // Single-variant (full-screen) page: the whole assortment section is one
  // self-contained, viewport-tall card. Move the Save/Cancel bar INTO that card,
  // directly above the Order Summary — so it reads as the TABLE's footer while
  // the Order Summary is the CARD's footer. Both are in-flow flex children that
  // stay in view while the table scrolls between them (see CSS).
  (function dockFootersIntoSingleCard() {
    if (!ONLY) return;
    // In single mode builtCards[0] IS the rendered variant card. Use it directly
    // rather than a data-variant lookup, which fails for dual-identity variants
    // (e.g. "g" renders with data-variant="e").
    var card = builtCards[0] || document.querySelector('.mfg-assortment-card[data-variant="' + ONLY + '"]');
    if (!card) return;
    var ef = document.getElementById("edit-footer");
    var cardFooter = card.querySelector(".mfg-order-summary");
    if (ef && cardFooter && cardFooter.parentNode === card) {
      card.insertBefore(ef, cardFooter);
    }
    if (card._reserveSpace) {
      card._reserveSpace();
      window.requestAnimationFrame(card._reserveSpace);
    }
  })();

  // Order Item Template dropdown: switching to "Free Items" loads the free-items
  // assortment into the grid (window.MFG_FREE_ITEM_ROWS) so the buyer can order
  // free items, which flow into the "Custom Free items" section of the Order
  // Summary; "Standard Products" restores the normal assortment.
  var COMBO_SEQ = 0;
  function setupTemplateDropdowns() {
    var OPTIONS = ["Standard Products", "Free Items"];
    document.querySelectorAll(".mfg-template .slds-combobox").forEach(function (combobox) {
      var input = combobox.querySelector(".slds-combobox__input");
      if (!input) return;
      var uid = "mfg-combo-" + (++COMBO_SEQ);
      var listbox = document.createElement("div");
      listbox.className = "slds-dropdown slds-dropdown_length-5 slds-dropdown_fluid mfg-template__menu";
      listbox.setAttribute("role", "listbox");
      listbox.id = uid + "-listbox";
      listbox.hidden = true;
      listbox.innerHTML = OPTIONS.map(function (opt, i) {
        var sel = opt === input.value;
        return '<div class="slds-listbox__item mfg-template__option' + (sel ? " is-selected" : "") +
          '" role="option" id="' + uid + "-opt-" + i + '" aria-selected="' + sel + '" data-value="' + esc(opt) + '">' + esc(opt) + "</div>";
      }).join("");
      combobox.appendChild(listbox);

      // APG combobox wiring on the (readonly) input.
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-haspopup", "listbox");
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-controls", listbox.id);

      var options = Array.prototype.slice.call(listbox.querySelectorAll(".mfg-template__option"));
      var active = -1; // highlighted option index while open

      function setActive(i) {
        active = i;
        options.forEach(function (o, k) { o.classList.toggle("is-active", k === i); });
        input.setAttribute("aria-activedescendant", i >= 0 ? options[i].id : "");
        if (i >= 0) options[i].scrollIntoView({ block: "nearest" });
      }
      function isOpen() { return !listbox.hidden; }
      function open() {
        listbox.hidden = false;
        combobox.classList.add("slds-is-open");
        input.setAttribute("aria-expanded", "true");
        var selIdx = options.findIndex(function (o) { return o.classList.contains("is-selected"); });
        setActive(selIdx >= 0 ? selIdx : 0);
      }
      function close() {
        listbox.hidden = true;
        combobox.classList.remove("slds-is-open");
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        setActive(-1);
      }
      function selectOption(opt) {
        var value = opt.getAttribute("data-value");
        input.value = value;
        options.forEach(function (o) {
          var on = o === opt;
          o.classList.toggle("is-selected", on);
          o.setAttribute("aria-selected", String(on));
        });
        // Swap the grid's dataset: "Free Items" loads the free-items assortment
        // (window.MFG_FREE_ITEM_ROWS) and marks the card free-mode so the ordered
        // items flow into the "Custom Free items" summary section; "Standard
        // Products" restores the normal assortment.
        var card = combobox.closest(".mfg-assortment-card");
        if (card) {
          var gridBody = card.querySelector(".mfg-grid-body");
          var freeMode = value === "Free Items";
          var wasFree = card.classList.contains("mfg-mode-free");
          if (gridBody) {
            // Snapshot the catalog we're leaving so BOTH its quantities and the
            // free-item summary it feeds survive the switch, then restore the
            // catalog we're entering (fresh-render only the first time it loads).
            card._catalogCache = card._catalogCache || {};
            card._catalogCache[wasFree ? "free" : "standard"] = gridBody.innerHTML;
            card.classList.toggle("mfg-mode-free", freeMode);
            var cacheKey = freeMode ? "free" : "standard";
            if (card._catalogCache[cacheKey] != null) {
              gridBody.innerHTML = card._catalogCache[cacheKey];
            } else {
              renderInto(gridBody, gridPrefixOf(card), rowsFor(card, freeMode));
            }
            if (card._isCart) applyCartEmptyState(card);
            updateCountFor(gridBody, card.querySelector(".mfg-selected-count"));
          } else {
            card.classList.toggle("mfg-mode-free", freeMode);
          }
          if (card._refreshFreeSummary) card._refreshFreeSummary();
          updateOrderTotals(card);
        }
        refreshAllFreeSummaries();
        close();
      }

      var trigger = combobox.querySelector(".slds-combobox__form-element") || input;
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        if (isOpen()) close(); else open();
      });
      input.addEventListener("keydown", function (e) {
        switch (e.key) {
          case "ArrowDown": e.preventDefault(); if (!isOpen()) { open(); } else { setActive((active + 1) % options.length); } break;
          case "ArrowUp": e.preventDefault(); if (!isOpen()) { open(); } else { setActive((active - 1 + options.length) % options.length); } break;
          case "Home": if (isOpen()) { e.preventDefault(); setActive(0); } break;
          case "End": if (isOpen()) { e.preventDefault(); setActive(options.length - 1); } break;
          case "Enter":
          case " ": if (isOpen() && active >= 0) { e.preventDefault(); selectOption(options[active]); } else if (!isOpen()) { e.preventDefault(); open(); } break;
          case "Escape": if (isOpen()) { e.preventDefault(); close(); } break;
          case "Tab": if (isOpen()) close(); break;
        }
      });
      listbox.addEventListener("click", function (e) {
        e.stopPropagation();
        var opt = e.target.closest(".mfg-template__option");
        if (opt) selectOption(opt);
      });
      combobox._closeMenu = close;
    });
    document.addEventListener("click", function () {
      document.querySelectorAll(".mfg-template .slds-combobox").forEach(function (c) {
        if (c._closeMenu) c._closeMenu();
      });
    });
  }
  setupTemplateDropdowns();
})();
