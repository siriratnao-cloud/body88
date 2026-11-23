/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : แสดงสินค้า + กรองตาม mood
   - order.html   : เติมฟอร์มจาก URL + ส่งคำสั่งซื้อ
   - admin.html   : แสดงรายการสั่งซื้อจาก Google Sheet (CSV)
   ไม่ใช้ library ภายนอก
   ========================================================== */

(function () {
  "use strict";

  /* ---------- ค่าตั้งต้น ---------- */
  var APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbzpYVAxkG31Ok8V9_yO715ZM8qDSAz0haaW6G2jDXCeKAfth6nMTeR_tRUyH8j2Ko4v/exec";

  var SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWiZWUFTORRUjQ2x16-LxoLdeEZeQFCTy_RjtTJrUuFoFcSBJk-X0nE_n6PkenDM5OdlCurF75MFOo/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  /* ---------- ตัวช่วย ---------- */
  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPrice(n) {
    var num = Number(n);
    return isNaN(num) ? String(n) : num.toLocaleString("th-TH");
  }

  function moodLabel(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return MOODS[i].label;
    }
    return key;
  }

  /* ==========================================================
     1) หน้า product.html
     ========================================================== */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var validMoods = MOODS.map(function (m) { return m.key; });

    var params = new URLSearchParams(window.location.search);
    var current = (params.get("mood") || "all").toLowerCase();
    if (validMoods.indexOf(current) === -1) current = "all";

    function renderFilters() {
      filterBar.innerHTML = MOODS.map(function (m) {
        var active = m.key === current;
        var moodAttr = m.key === "all" ? "" : ' data-mood="' + m.key + '"';
        return (
          '<button type="button" class="filter-btn' + (active ? " is-active" : "") + '"' +
          ' data-filter="' + m.key + '"' + moodAttr +
          ' aria-pressed="' + active + '">' + escapeHTML(m.label) + "</button>"
        );
      }).join("");
    }

    function cardHTML(p) {
      var orderUrl =
        "order.html?item=" + encodeURIComponent(p.name) +
        "&price=" + encodeURIComponent(p.price);

      var sizeHTML = p.size
        ? '<span class="product-card__size">' + escapeHTML(p.size) + "</span>"
        : '<span class="product-card__size"></span>';

      return (
        '<article class="product-card" data-mood="' + escapeHTML(p.mood) + '">' +
          '<div class="product-card__media">' +
            '<img src="' + escapeHTML(p.image) + '" alt="' + escapeHTML(p.name) + '" loading="lazy">' +
          "</div>" +
          '<div class="product-card__mood"><span class="mood-dot"></span>' +
            escapeHTML(moodLabel(p.mood)) + "</div>" +
          '<h3 class="product-card__name">' + escapeHTML(p.name) + "</h3>" +
          '<div class="product-card__meta">' +
            sizeHTML +
            '<span class="product-card__price">' + formatPrice(p.price) + " ฿</span>" +
          "</div>" +
          '<a class="btn btn--block" href="' + orderUrl + '">สั่งซื้อ</a>' +
        "</article>"
      );
    }

    function renderProducts() {
      var shown = products.filter(function (p) {
        return current === "all" || p.mood === current;
      });
      if (!shown.length) {
        list.innerHTML = '<p class="text-muted text-center">ยังไม่มีสินค้าในหมวดนี้</p>';
        return;
      }
      list.innerHTML = shown.map(cardHTML).join("");
    }

    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      current = btn.getAttribute("data-filter");

      // อัปเดตลิงก์ให้ตรงกับตัวกรองปัจจุบัน (ไม่โหลดหน้าใหม่)
      if (window.history && history.replaceState) {
        var url = window.location.pathname + (current === "all" ? "" : "?mood=" + current);
        history.replaceState(null, "", url);
      }
      renderFilters();
      renderProducts();
    });

    renderFilters();
    list.innerHTML = '<p class="text-muted text-center">กำลังโหลดสินค้า...</p>';

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        renderProducts();
      })
      .catch(function (err) {
        console.error(err);
        list.innerHTML =
          '<p class="text-muted text-center">โหลดสินค้าไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง</p>';
      });
  }

  /* ==========================================================
     2) หน้า order.html
     ========================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsEl = document.getElementById("items");
    var totalEl = document.getElementById("total");

    // เติมค่าจาก URL parameter ทันทีที่โหลดหน้า
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");
    if (itemsEl && item) itemsEl.value = item;
    if (totalEl && price) totalEl.value = price;

    var submitting = false;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (submitting) return;
      if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

      var payload = {
        customerName: document.getElementById("customerName").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        items: document.getElementById("items").value.trim(),
        total: document.getElementById("total").value.trim(),
        note: document.getElementById("note").value.trim()
      };

      var submitBtn = form.querySelector('[type="submit"]');
      submitting = true;
      if (submitBtn) submitBtn.disabled = true;

      fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(function () {
          window.location.href = "thankyou.html";
        })
        .catch(function (error) {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          submitting = false;
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ==========================================================
     3) หน้า admin.html
     ========================================================== */

  // Parse CSV เอง: รองรับ "..." ที่มีคอมมา, "" แทนเครื่องหมายคำพูด และขึ้นบรรทัดใหม่ในช่อง
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else {
        field += c;
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }

    // ตัดแถวว่าง
    return rows.filter(function (r) {
      return r.some(function (cell) { return String(cell).trim() !== ""; });
    });
  }

  // แปลงข้อความวันเวลาเป็นตัวเลข (ใช้เรียงลำดับ) คืน NaN ถ้าอ่านไม่ได้
  function parseDateValue(str) {
    var s = String(str || "").trim();
    if (!s) return NaN;

    // รูปแบบ d/m/yyyy [hh:mm[:ss]] (ปี พ.ศ. จะถูกแปลงเป็น ค.ศ.)
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\sT,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      var year = Number(m[3]);
      if (year > 2400) year -= 543;
      return new Date(
        year, Number(m[2]) - 1, Number(m[1]),
        Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)
      ).getTime();
    }
    return Date.parse(s); // ISO และรูปแบบมาตรฐานอื่นๆ
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    var COLS = 6;

    function message(text) {
      tbody.innerHTML =
        '<tr><td colspan="' + COLS + '" class="text-center text-muted">' +
        escapeHTML(text) + "</td></tr>";
    }

    // หาตำแหน่งคอลัมน์จากหัวตาราง ถ้าไม่เจอใช้ลำดับมาตรฐาน:
    // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
    function buildColumnMap(header) {
      var defaults = { time: 0, name: 1, contact: 2, items: 3, total: 4, note: 5 };
      var patterns = {
        time: /timestamp|date|time|วัน|เวลา/i,
        name: /customer|name|ชื่อ/i,
        contact: /contact|phone|line|tel|เบอร์|ติดต่อ/i,
        items: /item|product|สินค้า|รายการ/i,
        total: /total|price|amount|ราคา|ยอด|จำนวนเงิน/i,
        note: /note|remark|comment|หมายเหตุ/i
      };
      var map = {};
      var used = {};
      Object.keys(patterns).forEach(function (key) {
        for (var i = 0; i < header.length; i++) {
          if (!used[i] && patterns[key].test(header[i])) {
            map[key] = i; used[i] = true; return;
          }
        }
      });
      // ถ้าจับคู่หัวตารางไม่ครบ ให้ใช้ลำดับมาตรฐานทั้งหมด
      return Object.keys(patterns).every(function (k) { return k in map; })
        ? map
        : defaults;
    }

    function cell(row, idx) {
      return idx < row.length ? row[idx] : "";
    }

    function render(rows) {
      if (rows.length < 2) { message("ยังไม่มีรายการสั่งซื้อ"); return; }

      var cols = buildColumnMap(rows[0]);
      var data = rows.slice(1).map(function (r, i) {
        return {
          order: i,
          time: cell(r, cols.time),
          name: cell(r, cols.name),
          contact: cell(r, cols.contact),
          items: cell(r, cols.items),
          total: cell(r, cols.total),
          note: cell(r, cols.note)
        };
      });

      // เรียงล่าสุดขึ้นก่อน: ใช้วันเวลาถ้าอ่านได้ ไม่เช่นนั้นใช้ลำดับแถว (แถวใหม่อยู่ท้ายชีต)
      data.sort(function (a, b) {
        var ta = parseDateValue(a.time);
        var tb = parseDateValue(b.time);
        if (!isNaN(ta) && !isNaN(tb) && ta !== tb) return tb - ta;
        return b.order - a.order;
      });

      tbody.innerHTML = data.map(function (d) {
        var total = d.total !== "" && !isNaN(Number(d.total))
          ? formatPrice(d.total) + " ฿"
          : d.total;
        return (
          "<tr>" +
            "<td>" + escapeHTML(d.time) + "</td>" +
            "<td>" + escapeHTML(d.name) + "</td>" +
            "<td>" + escapeHTML(d.contact) + "</td>" +
            "<td>" + escapeHTML(d.items) + "</td>" +
            "<td>" + escapeHTML(total) + "</td>" +
            "<td>" + escapeHTML(d.note) + "</td>" +
          "</tr>"
        );
      }).join("");
    }

    message("กำลังโหลดรายการสั่งซื้อ...");

    fetch(SHEET_CSV_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) { render(parseCSV(text)); })
      .catch(function (err) {
        console.error(err);
        message("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง");
      });
  }

  /* ---------- เริ่มทำงาน (แต่ละฟังก์ชันจะทำงานเฉพาะหน้าที่มี element ของตัวเอง) ---------- */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
