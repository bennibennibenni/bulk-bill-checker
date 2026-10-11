/**
 * Service Handler untuk Inquiry Tagihan PLN, PDAM, Indihome, dan BPJS.
 * Terintegrasi langsung dengan Live Engine Sepulsa.
 */

require("dotenv").config();
const axios = require("axios");

const SEPULSA_API_URL = "https://api.sepulsa.com/api/v1/carts/add/";
const SEPULSA_OPTION_URL = "https://api.sepulsa.com/api/v1/oscar/options/1/";

const SEPULSA_PRODUCTS = {
  PLN: "http://api.sepulsa.com/api/v1/oscar/products/14/",
  INDIHOME: "http://api.sepulsa.com/api/v1/oscar/products/34/",
  PDAM_BATAM: "http://api.sepulsa.com/api/v1/oscar/products/920/",
  PDAM_PADANG: "http://api.sepulsa.com/api/v1/oscar/products/988/",
  BPJS: "http://api.sepulsa.com/api/v1/oscar/products/15/",
};

const SEPULSA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Content-Type": "application/json",
  "Origin": "https://www.sepulsa.com",
  "Referer": "https://www.sepulsa.com/",
  "x-chital-api-key": "qQFAFT8d.6Yt44sZWZdkd1P4jFwAv4E5UyEp9QYNw",
  "x-chital-order-source": "web",
  "x-chital-requester": "https://www.sepulsa.com",
};

const PDAM_REGIONS = [
  { code: "PDAM_JKT", name: "DKI Jakarta (PAM Jaya)", province: "DKI Jakarta" },
  { code: "PDAM_SBY", name: "Kota Surabaya (Surya Sembada)", province: "Jawa Timur" },
  { code: "PDAM_BDG", name: "Kota Bandung (Tirtawening)", province: "Jawa Barat" },
  { code: "PDAM_KAB_BDG", name: "Kab. Bandung (Tirta Raharja)", province: "Jawa Barat" },
  { code: "PDAM_SMG", name: "Kota Semarang (Tirta Moedal)", province: "Jawa Tengah" },
  { code: "PDAM_MDN", name: "Kota Medan (Tirtanadi)", province: "Sumatera Utara" },
  { code: "PDAM_PDG", name: "Kota Padang", province: "Sumatera Barat" },
  { code: "PDAM_MKS", name: "Kota Makassar", province: "Sulawesi Selatan" },
  { code: "PDAM_TNG", name: "Kota Tangerang (Tirta Benteng)", province: "Banten" },
  { code: "PDAM_BKS", name: "Kota Bekasi (Tirta Patriot)", province: "Jawa Barat" },
  { code: "PDAM_BGR", name: "Kab. Bogor (Tirta Kahuripan)", province: "Jawa Barat" },
  { code: "PDAM_DPS", name: "Kota Denpasar", province: "Bali" },
  { code: "PDAM_MLG", name: "Kota Malang (Tugu Tirta)", province: "Jawa Timur" },
  { code: "PDAM_SLM", name: "Kab. Sleman (Tirta Marta)", province: "DI Yogyakarta" },
  { code: "PDAM_PLB", name: "Kota Palembang (Tirta Musi)", province: "Sumatera Selatan" },
  { code: "PDAM_BPN", name: "Kota Balikpapan", province: "Kalimantan Timur" },
];

function parseCurrency(val) {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^\d]/g, "");
  return parseInt(cleaned, 10) || 0;
}

function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function validateCustomerInput(type, customerId, region) {
  if (!customerId || customerId.toString().trim() === "") {
    return "ID Pelanggan tidak boleh kosong";
  }

  const cleanId = customerId.toString().trim().replace(/\D/g, "");

  if (type === "PLN") {
    if (cleanId.length < 11 || cleanId.length > 13) {
      return "ID Pelanggan PLN / No Meter harus 11-12 digit";
    }
  } else if (type === "INDIHOME") {
    if (cleanId.length < 9 || cleanId.length > 14) {
      return "Nomor Telepon / Internet Indihome harus 9-14 digit";
    }
  } else if (type === "PDAM") {
    if (!region) {
      return "Harap pilih wilayah PDAM tujuan";
    }
    if (cleanId.length < 4 || cleanId.length > 12) {
      return "Nomor Pelanggan PDAM umumnya 4-12 digit";
    }
  } else if (type === "BPJS" || type === "BPJS_KESEHATAN") {
    if (cleanId.length < 11 || cleanId.length > 16) {
      return "Nomor Kartu / Virtual Account BPJS Kesehatan harus 11-16 digit";
    }
  } else {
    return `Kategori tagihan '${type}' tidak didukung (harus PLN, PDAM, INDIHOME, atau BPJS)`;
  }

  return null;
}

/**
 * Pengecekan Riil via Live Sepulsa Cart API
 * Semua produk (PLN, PDAM, INDIHOME, BPJS) diproses langsung ke Sepulsa.
 */
async function inquirySepulsaLive(type, customerId, region, note) {
  const isBpjs = type === "BPJS" || type === "BPJS_KESEHATAN";

  // Khusus BPJS: Tidak perlu hit API karena proteksi CAPTCHA Sepulsa, langsung arahkan ke link resmi
  if (isBpjs) {
    const cleanId = customerId.toString().trim();
    const sepulsaUrl = "https://www.sepulsa.com/transaction/bpjs-kesehatan";
    return {
      success: true,
      type: "BPJS",
      customerId: cleanId,
      customerName: "Portal Sepulsa BPJS",
      note,
      status: "REDIRECT",
      statusLabel: "CEK DI SEPULSA ↗",
      totalAmount: 0,
      formattedTotal: "Klik Tautan ↗",
      redirectUrl: sepulsaUrl,
      details: {
        product: "BPJS KESEHATAN",
        serviceType: "Iuran BPJS Kesehatan Mandiri",
        regionName: "BPJS Kesehatan RI",
        period: "Bulan Berjalan",
        billAmount: 0,
        adminFee: 0,
        totalAmount: 0,
        formattedTotal: "-",
        redirectUrl: sepulsaUrl,
        actionNote: "Pengecekan BPJS membutuhkan verifikasi CAPTCHA di web resmi Sepulsa.",
      },
      source: "SEPULSA_REDIRECT",
      timestamp: new Date().toISOString(),
    };
  }

  let productUrl = SEPULSA_PRODUCTS.PLN;
  if (type === "INDIHOME") {
    productUrl = SEPULSA_PRODUCTS.INDIHOME;
  } else if (type === "PDAM") {
    const regUpper = (region || "").toUpperCase();
    if (regUpper.includes("PDG") || regUpper.includes("PADANG")) {
      productUrl = SEPULSA_PRODUCTS.PDAM_PADANG;
    } else {
      productUrl = SEPULSA_PRODUCTS.PDAM_BATAM; // PAM Batam
    }
  }

  const payload = {
    url: productUrl,
    quantity: 1,
    options: [
      {
        option: SEPULSA_OPTION_URL,
        value: customerId.toString().trim(),
      },
    ],
  };

  let requestUrl = SEPULSA_API_URL;
  let requestHeaders = { ...SEPULSA_HEADERS };
  let requestParams = undefined;
  try {
    let res;
    try {
      res = await axios({
        method: "POST",
        url: requestUrl,
        params: requestParams,
        headers: requestHeaders,
        data: payload,
        timeout: 18000,
      });
    } catch (requestErr) {
throw requestErr;
    }

    const line = res.data?.data?.lines?.[0];
    if (!line) {
      throw new Error("Respon Sepulsa kosong");
    }

    const inqAttr = line.attributes?.find(
      (a) => a.option?.code === "inquiry_details" || a.option?.code === "payment_details"
    );

    let details = {};
    if (inqAttr && inqAttr.value) {
      details = typeof inqAttr.value === "string" ? JSON.parse(inqAttr.value) : inqAttr.value;
    }

    const billAmount = parseCurrency(details["Jumlah Tagihan"] || details["tagihan"] || details["Tagihan"] || 0);
    const adminFee = parseCurrency(details["Biaya Admin"] || details["admin"] || line.stockrecord?.admin_fee || (isBpjs ? 2500 : 4450));
    const totalAmount = parseCurrency(res.data?.data?.total_incl_fee) || (billAmount + adminFee);
    const customerName = details["Nama Pelanggan"] || details["nama_pelanggan"] || details["Nama Peserta"] || "-";
    const tarifDaya = details["Tarif / Daya"] || details["Tarif/Daya"] || details["Paket"] || details["Kelas"] || "-";
    const standMeter = details["Stand Meter"] || "";
    const period = details["Periode"] || details["Jumlah Bulan"] || "-";
    const familyMembers = details["Jumlah Peserta"] || details["Jumlah Anggota"] || details["Anggota Keluarga"] || "";

    const cleanCustomerId = customerId.toString().trim();
    let serviceType = "";
    let regionName = "";
    if (type === "PLN") {
      serviceType = "Listrik Pascabayar (PLN)";
    } else if (type === "PDAM") {
      serviceType = "Sambungan Air Bersih PDAM";
      regionName = details["Wilayah"] || (region === "PDAM_PDG" ? "PDAM Kota Padang" : "PAM Batam (Air Batam Hilir)");
    } else if (type === "INDIHOME") {
      serviceType = cleanCustomerId.startsWith("0") ? "Telepon Rumah / Kantor (PSTN Telkom)" : "Internet Fiber & TV (Indihome)";
      regionName = "Telkom Regional";
    } else if (isBpjs) {
      serviceType = "Iuran BPJS Kesehatan Mandiri";
      regionName = "BPJS Kesehatan RI";
    }

    return {
      success: true,
      type,
      customerId,
      customerName,
      note,
      status: "UNPAID",
      statusLabel: "BELUM LUNAS",
      totalAmount,
      formattedTotal: formatRupiah(totalAmount),
      details: {
        product: line.stockrecord?.product_label || (isBpjs ? "BPJS KESEHATAN" : serviceType),
        serviceType,
        regionName,
        wilayah: regionName,
        tariff: tarifDaya,
        power: tarifDaya,
        careClass: details["Kelas"] || tarifDaya,
        familyMembers: familyMembers,
        period,
        meterStart: standMeter && standMeter.includes("-") ? standMeter.split("-")[0] : "",
        meterEnd: standMeter && standMeter.includes("-") ? standMeter.split("-")[1] : "",
        usageKwh: standMeter && standMeter.includes("-") ? parseCurrency(standMeter.split("-")[1]) - parseCurrency(standMeter.split("-")[0]) : "",
        billAmount,
        penaltyAmount: parseCurrency(details["Denda"] || 0),
        adminFee,
        totalAmount,
        formattedTotal: formatRupiah(totalAmount),
      },
      source: "LIVE_SEPULSA",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const errData = err.response.data || {};
      const errors = errData.errors || [];
      const firstErr = errors[0] || {};
      const detail = (firstErr.detail || "").toLowerCase();

      // Kasus tagihan sudah lunas / nihil
      if (
        detail.includes("already paid") ||
        detail.includes("not available") ||
        detail.includes("lunas") ||
        firstErr.code === "50"
      ) {
        const cleanCustomerId = customerId.toString().trim();
        const serviceType = type === "PLN" ? "Listrik Pascabayar (PLN)" : (type === "PDAM" ? "Air Bersih PDAM" : (isBpjs ? "Iuran BPJS Kesehatan" : (cleanCustomerId.startsWith("0") ? "Telepon Kabel (PSTN Telkom)" : "Internet Fiber (Indihome Telkom)")));
        const regionName = type === "PDAM" ? "PAM Batam" : (isBpjs ? "BPJS Kesehatan" : "");
        return {
          success: true,
          type,
          customerId,
          customerName: "-",
          note,
          status: "PAID",
          statusLabel: "LUNAS / NIHIL",
          totalAmount: 0,
          formattedTotal: "Rp 0 (Lunas)",
          details: {
            product: type === "PLN" ? "PLN PASCABAYAR" : (type === "PDAM" ? "AIR BERSIH PDAM" : (isBpjs ? "BPJS KESEHATAN" : "INDIHOME TELKOM")),
            serviceType,
            regionName,
            period: "Bulan Berjalan",
            billAmount: 0,
            penaltyAmount: 0,
            adminFee: 0,
            totalAmount: 0,
            formattedTotal: "Rp 0 (Lunas)",
          },
          source: "LIVE_SEPULSA",
          timestamp: new Date().toISOString(),
        };
      }

      // Pesan error spesifik dari Gateway Sepulsa
      let errorMsg = firstErr.detail || (typeof errData.message === "string" ? errData.message : null);

      if (err.response.status === 406 || (errorMsg && errorMsg.toLowerCase().includes("not acceptable"))) {
        errorMsg = isBpjs
          ? "Endpoint BPJS dilindungi CAPTCHA Sepulsa. Silakan klik tombol untuk membuka halaman Sepulsa."
          : "Gateway Error 406: Endpoint dilindungi CAPTCHA / Tidak dapat diakses via API langsung";
      } else if (!errorMsg) {
        errorMsg = `Gateway Error HTTP ${err.response.status}`;
      }

      return {
        success: false,
        type,
        customerId,
        customerName: "-",
        note,
        status: "FAILED",
        statusLabel: "GAGAL",
        errorMessage: errorMsg,
        totalAmount: 0,
        formattedTotal: "Rp 0",
        redirectUrl: isBpjs ? "https://www.sepulsa.com/transaction/bpjs-kesehatan" : null,
        details: {
          errorDetail: errorMsg,
          httpStatus: err.response.status,
          redirectUrl: isBpjs ? "https://www.sepulsa.com/transaction/bpjs-kesehatan" : null,
        },
        source: "LIVE_SEPULSA",
        timestamp: new Date().toISOString(),
      };
    }

    // Network timeout atau connection error
    return {
      success: false,
      type,
      customerId,
      customerName: "-",
      note,
      status: "FAILED",
      statusLabel: "GAGAL",
      errorMessage: `Gateway Live Connection Error: ${err.message}`,
      totalAmount: 0,
      formattedTotal: "Rp 0",
      source: "LIVE_SEPULSA",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Pemrosesan Bulk Inquiry: 100% Live Gateway Sepulsa
 * Semua produk (PLN, PDAM, INDIHOME) diproses langsung ke Sepulsa.
 * Jika gateway error, langsung laporkan status FAILED dengan pesan error asli.
 */
async function processBulkInquiry(items, concurrency = 3, delayMs = 250) {
  const results = [];
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const current = queue.shift();
      const type = (current.type || "PLN").toUpperCase().trim();
      const customerId = (current.customerId || "").toString().trim();
      const region = current.region || (type === "PDAM" ? "PDAM_JKT" : null);
      const note = current.note || "-";

      const valError = validateCustomerInput(type, customerId, region);
      if (valError) {
        results.push({
          success: false,
          type,
          customerId,
          customerName: "-",
          region,
          note,
          status: "INVALID",
          statusLabel: "INVALID",
          errorMessage: valError,
          totalAmount: 0,
          formattedTotal: "Rp 0",
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Semua permintaan diproses LANGSUNG ke Live Gateway Sepulsa
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      const liveResult = await inquirySepulsaLive(type, customerId, region, note);
      results.push(liveResult);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

module.exports = {
  PDAM_REGIONS,
  validateCustomerInput,
  inquirySepulsaLive,
  processBulkInquiry,
  formatRupiah,
};
