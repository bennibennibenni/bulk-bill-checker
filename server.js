const express = require("express");
const cors = require("cors");
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");
const {
  PDAM_REGIONS,
  processBulkInquiry,
  formatRupiah,
} = require("./services/billerService");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Konfigurasi Multer (in-memory storage untuk parsing cepat)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
});

// 1. Endpoint daftar wilayah PDAM
app.get("/api/pdam-list", (req, res) => {
  res.json({
    success: true,
    data: PDAM_REGIONS,
  });
});

// 2. Endpoint proses inquiry massal
app.post("/api/inquiry/bulk", async (req, res) => {
  try {
    const { items, concurrency = 5 } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Daftar ID Pelanggan tidak boleh kosong.",
      });
    }

    if (items.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Maksimal 500 baris dalam satu kali pengecekan bulk.",
      });
    }

    const results = await processBulkInquiry(items, concurrency);

    // Hitung ringkasan statistik
    // Urutkan (sort) results by tipe: PLN -> PDAM -> INDIHOME -> BPJS
    const typeOrder = { PLN: 1, PDAM: 2, INDIHOME: 3, BPJS: 4, BPJS_KESEHATAN: 4 };
    results.sort((a, b) => {
      const orderA = typeOrder[a.type] || 99;
      const orderB = typeOrder[b.type] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.note || "").localeCompare(b.note || "");
    });

    const totalItems = results.length;
    const successfulItems = results.filter((r) => r.success);
    const failedItems = results.filter((r) => !r.success);
    const unpaidItems = successfulItems.filter((r) => r.status === "UNPAID");
    const paidItems = successfulItems.filter((r) => r.status === "PAID");

    const totalUnpaidAmount = unpaidItems.reduce(
      (sum, r) => sum + (r.totalAmount || 0),
      0
    );

    const breakdown = {
      pln: {
        count: successfulItems.filter((r) => r.type === "PLN").length,
        unpaidAmount: unpaidItems
          .filter((r) => r.type === "PLN")
          .reduce((sum, r) => sum + (r.totalAmount || 0), 0),
      },
      pdam: {
        count: successfulItems.filter((r) => r.type === "PDAM").length,
        unpaidAmount: unpaidItems
          .filter((r) => r.type === "PDAM")
          .reduce((sum, r) => sum + (r.totalAmount || 0), 0),
      },
      indihome: {
        count: successfulItems.filter((r) => r.type === "INDIHOME").length,
        unpaidAmount: unpaidItems
          .filter((r) => r.type === "INDIHOME")
          .reduce((sum, r) => sum + (r.totalAmount || 0), 0),
      },
      bpjs: {
        count: successfulItems.filter((r) => r.type === "BPJS" || r.type === "BPJS_KESEHATAN").length,
        unpaidAmount: unpaidItems
          .filter((r) => r.type === "BPJS" || r.type === "BPJS_KESEHATAN")
          .reduce((sum, r) => sum + (r.totalAmount || 0), 0),
      },
    };

    res.json({
      success: true,
      summary: {
        totalItems,
        successCount: successfulItems.length,
        failedCount: failedItems.length,
        unpaidCount: unpaidItems.length,
        paidCount: paidItems.length,
        totalUnpaidAmount,
        formattedTotalUnpaid: formatRupiah(totalUnpaidAmount),
        breakdown: {
          pln: { ...breakdown.pln, formatted: formatRupiah(breakdown.pln.unpaidAmount) },
          pdam: { ...breakdown.pdam, formatted: formatRupiah(breakdown.pdam.unpaidAmount) },
          indihome: { ...breakdown.indihome, formatted: formatRupiah(breakdown.indihome.unpaidAmount) },
          bpjs: { ...breakdown.bpjs, formatted: formatRupiah(breakdown.bpjs.unpaidAmount) },
        },
      },
      results,
    });
  } catch (err) {
    console.error("Bulk inquiry error:", err);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server saat memproses inquiry.",
      error: err.message,
    });
  }
});

// 3. Endpoint Upload dan Parsing File Excel / CSV
app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Harap unggah file Excel (.xlsx / .xls) atau CSV (.csv).",
      });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "File kosong atau format kolom tidak terbaca.",
      });
    }

    // Mapping header fleksibel (case-insensitive & variasi nama kolom)
    const normalizedItems = [];

    rows.forEach((row, idx) => {
      let type = "PLN";
      let customerId = "";
      let region = "";
      let note = "";

      for (const [key, val] of Object.entries(row)) {
        const k = key.toLowerCase().trim();
        const v = String(val).trim();

        if (k.includes("tipe") || k.includes("type") || k.includes("kategori") || k.includes("biller")) {
          const upper = v.toUpperCase();
          if (upper.includes("PLN")) type = "PLN";
          else if (upper.includes("PDAM") || upper.includes("AIR")) type = "PDAM";
          else if (upper.includes("INDIHOME") || upper.includes("TELKOM") || upper.includes("INTERNET")) type = "INDIHOME";
          else if (upper.includes("BPJS") || upper.includes("KESEHATAN")) type = "BPJS";
        } else if (
          k.includes("id") ||
          k.includes("pelanggan") ||
          k.includes("meter") ||
          k.includes("nomor") ||
          k.includes("customer")
        ) {
          if (!customerId && v) customerId = v;
        } else if (k.includes("wilayah") || k.includes("region") || k.includes("kota") || k.includes("pdam")) {
          if (v) region = v;
        } else if (k.includes("catatan") || k.includes("note") || k.includes("keterangan") || k.includes("unit")) {
          if (v) note = v;
        }
      }

      // Jika customerId belum terisi, coba ambil nilai dari kolom kedua jika baris ada
      if (!customerId) {
        const values = Object.values(row).map((v) => String(v).trim()).filter(Boolean);
        if (values.length >= 2) {
          customerId = values[1];
        } else if (values.length === 1) {
          customerId = values[0];
        }
      }

      if (customerId) {
        normalizedItems.push({
          rowNumber: idx + 2, // header di row 1
          type,
          customerId,
          region: region || (type === "PDAM" ? "PDAM_JKT" : ""),
          note: note || `Baris ${idx + 2}`,
        });
      }
    });

    res.json({
      success: true,
      filename: req.file.originalname,
      totalRows: normalizedItems.length,
      items: normalizedItems,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({
      success: false,
      message: "Gagal memproses file: " + err.message,
    });
  }
});

// 4. Download Template Excel
app.get("/api/template/excel", (req, res) => {
  try {
    const templateData = [
      {
        "Tipe Tagihan (PLN/PDAM/INDIHOME)": "PLN",
        "ID Pelanggan / No Meter": "531234567890",
        "Kode Wilayah PDAM (Khusus PDAM)": "",
        "Catatan / Nama Unit": "Rumah Utama Lt. 1",
      },
      {
        "Tipe Tagihan (PLN/PDAM/INDIHOME)": "PLN",
        "ID Pelanggan / No Meter": "531234567891",
        "Kode Wilayah PDAM (Khusus PDAM)": "",
        "Catatan / Nama Unit": "Kamar Kost 101",
      },
      {
        "Tipe Tagihan (PLN/PDAM/INDIHOME)": "PDAM",
        "ID Pelanggan / No Meter": "1029384",
        "Kode Wilayah PDAM (Khusus PDAM)": "PDAM_JKT",
        "Catatan / Nama Unit": "Kantor Jakarta",
      },
      {
        "Tipe Tagihan (PLN/PDAM/INDIHOME)": "PDAM",
        "ID Pelanggan / No Meter": "2039485",
        "Kode Wilayah PDAM (Khusus PDAM)": "PDAM_SBY",
        "Catatan / Nama Unit": "Gudang Surabaya",
      },
      {
        "Tipe Tagihan (PLN/PDAM/INDIHOME/BPJS)": "INDIHOME",
        "ID Pelanggan / No Meter": "122333444455",
        "Kode Wilayah PDAM (Khusus PDAM)": "",
        "Catatan / Nama Unit": "Internet Wifi Kantor",
      },
      {
        "Tipe Tagihan (PLN/PDAM/INDIHOME/BPJS)": "BPJS",
        "ID Pelanggan / No Meter": "0001234567890",
        "Kode Wilayah PDAM (Khusus PDAM)": "",
        "Catatan / Nama Unit": "BPJS Keluarga Bpk Budi",
      },
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(templateData);

    // Set lebar kolom otomatis
    ws["!cols"] = [{ wch: 35 }, { wch: 25 }, { wch: 32 }, { wch: 28 }];
    xlsx.utils.book_append_sheet(wb, ws, "Daftar Tagihan");

    // Sheet bantuan kode wilayah PDAM
    const pdamSheetData = PDAM_REGIONS.map((r) => ({
      "Kode Wilayah": r.code,
      "Nama Wilayah / PDAM": r.name,
      Provinsi: r.province,
    }));
    const wsPdam = xlsx.utils.json_to_sheet(pdamSheetData);
    wsPdam["!cols"] = [{ wch: 18 }, { wch: 35 }, { wch: 20 }];
    xlsx.utils.book_append_sheet(wb, wsPdam, "Kode Wilayah PDAM");

    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Template_Bulk_Tagihan_PLN_PDAM_Indihome_BPJS.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buf);
  } catch (err) {
    res.status(500).send("Gagal membuat template Excel: " + err.message);
  }
});

// 5. Download Template CSV
app.get("/api/template/csv", (req, res) => {
  const csvContent =
    "Tipe,ID_Pelanggan,Wilayah_PDAM,Catatan\n" +
    "PLN,531234567890,,Rumah Utama\n" +
    "PLN,531234567891,,Kost Kamar 01\n" +
    "PDAM,1029384,PDAM_JKT,Kantor Jakarta\n" +
    "PDAM,2039485,PDAM_SBY,Gudang Surabaya\n" +
    "INDIHOME,122333444455,,Wifi Lt 2\n" +
    "BPJS,0001234567890,,BPJS Keluarga Utama\n";

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="Template_Bulk_Tagihan.csv"'
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.send(csvContent);
});

// 6. Export Hasil ke Excel
app.post("/api/export/excel", (req, res) => {
  try {
    const { results } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ success: false, message: "Tidak ada data untuk diexport" });
    }

    const exportRows = results.map((r, i) => {
      const d = r.details || {};
      return {
        No: i + 1,
        "Kategori Layanan": r.type,
        "ID Pelanggan": r.customerId,
        "Nama Pelanggan": r.customerName || "-",
        Catatan: r.note || "-",
        "Produk / Paket / Tarif": d.product || d.packageName || d.tariff || "-",
        Periode: d.period || "-",
        "Tagihan Pokok (Rp)": d.billAmount !== undefined ? d.billAmount : 0,
        "Denda (Rp)": d.penaltyAmount !== undefined ? d.penaltyAmount : 0,
        "Admin Bank (Rp)": d.adminFee !== undefined ? d.adminFee : 0,
        "Total Bayar (Rp)": r.totalAmount !== undefined ? r.totalAmount : 0,
        "Status Pembayaran": r.status === "PAID" ? "LUNAS" : r.status === "UNPAID" ? "BELUM LUNAS" : "GAGAL",
        Keterangan: r.errorMessage || (r.status === "PAID" ? "Tagihan sudah lunas" : "Belum terbayar"),
      };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 20 },
      { wch: 25 },
      { wch: 20 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 35 },
    ];
    xlsx.utils.book_append_sheet(wb, ws, "Rekap Tagihan");

    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="BulkBillChecker_${Date.now()}.xlsx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buf);
  } catch (err) {
    res.status(500).json({ success: false, message: "Gagal export Excel: " + err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 BulkBillChecker Web App running at:`);
    console.log(`   👉 http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
