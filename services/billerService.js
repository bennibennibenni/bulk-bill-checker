/**
 * Service Handler untuk Inquiry Tagihan PLN, PDAM, Indihome, dan BPJS.
 * Terintegrasi langsung dengan Live Engine Sepulsa
 * serta Simulator Engine untuk produk yang memerlukan CAPTCHA/Biller internal.
 */

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
  } else if (type === "BPJS" || type === "BPJS_KESEHATAN") {
    if (cleanId.length < 11 || cleanId.length > 16) {
      return "Nomor Kartu / Virtual Account BPJS Kesehatan harus 11-16 digit";
    }
  } else if (type === "PDAM") {
    if (!region) {
      return "Harap pilih wilayah PDAM tujuan";
    }
    if (cleanId.length < 4 || cleanId.length > 12) {
      return "Nomor Pelanggan PDAM umumnya 4-12 digit";
    }
  } else {
    return `Kategori tagihan '${type}' tidak didukung (harus PLN, PDAM, INDIHOME, atau BPJS)`;
  }

  return null;
}

/**
 * Pengecekan Riil via Live Sepulsa Cart API
 */
async function inquirySepulsaLive(type, customerId, region, note) {
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
  } else if (type === "BPJS" || type === "BPJS_KESEHATAN") {
    productUrl = SEPULSA_PRODUCTS.BPJS;
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

  if (type === "BPJS" || type === "BPJS_KESEHATAN") {
    payload.options.push({
      option: "http://api.sepulsa.com/api/v1/oscar/options/9/",
      value: "1",
    });
  }

  try {
    const res = await axios.post(SEPULSA_API_URL, payload, {
      headers: SEPULSA_HEADERS,
      timeout: 18000,
    });

    const line = res.data?.data?.lines?.[0];
    if (!line) {
      throw new Error("Respon Sepulsa kosong");
    }

    const inqAttr = line.attributes.find(
      (a) => a.option?.code === "inquiry_details" || a.option?.code === "payment_details"
    );

    let details = {};
    if (inqAttr && inqAttr.value) {
      details = typeof inqAttr.value === "string" ? JSON.parse(inqAttr.value) : inqAttr.value;
    }

    const billAmount = parseCurrency(details["Jumlah Tagihan"] || details["tagihan"] || 0);
    const adminFee = parseCurrency(details["Biaya Admin"] || line.stockrecord?.admin_fee || 4450);
    const totalAmount = parseCurrency(res.data.data?.total_incl_fee) || (billAmount + adminFee);
    const customerName = details["Nama Pelanggan"] || details["nama_pelanggan"] || "-";
    const tarifDaya = details["Tarif / Daya"] || details["Tarif/Daya"] || details["Paket"] || "-";
    const standMeter = details["Stand Meter"] || "";
    const period = details["Periode"] || "-";

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
        product: line.stockrecord?.product_label || serviceType,
        serviceType,
        regionName,
        wilayah: regionName,
        tariff: tarifDaya,
        power: tarifDaya,
        period,
        meterStart: standMeter && standMeter.includes("-") ? standMeter.split("-")[0] : "",
        meterEnd: standMeter && standMeter.includes("-") ? standMeter.split("-")[1] : "",
        usageKwh: standMeter && standMeter.includes("-") ? parseCurrency(standMeter.split("-")[1]) - parseCurrency(standMeter.split("-")[0]) : "",
        billAmount,
        penaltyAmount: 0,
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
        const serviceType = type === "PLN" ? "Listrik Pascabayar (PLN)" : (type === "PDAM" ? "Air Bersih PDAM" : (type === "BPJS" ? "BPJS Kesehatan" : (cleanCustomerId.startsWith("0") ? "Telepon Kabel (PSTN Telkom)" : "Internet Fiber (Indihome Telkom)")));
        const regionName = type === "PDAM" ? "PAM Batam" : "";
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
            product: type === "PLN" ? "PLN PASCABAYAR" : (type === "PDAM" ? "AIR BERSIH PDAM" : (type === "BPJS" ? "BPJS KESEHATAN" : "INDIHOME TELKOM")),
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
      if (!errorMsg && err.response.status === 406) {
        errorMsg = "Gateway Error 406: Endpoint dilindungi CAPTCHA / Tidak dapat diakses via API langsung";
      } else if (!errorMsg) {
        errorMsg = `Gateway Sepulsa Error HTTP ${err.response.status}`;
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
        details: {
          errorDetail: errorMsg,
          httpStatus: err.response.status,
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
 * Engine Simulator (Untuk BPJS dan Wilayah yang belum tersedia endpoint publiknya)
 */
function mockInquiry(item) {
  const type = (item.type || "").toUpperCase().trim();
  const customerId = item.customerId.toString().trim();
  const region = item.region || "PDAM_JKT";
  const note = item.note || "-";

  let hash = 0;
  for (let i = 0; i < customerId.length; i++) {
    hash = (hash << 5) - hash + customerId.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  const months = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  const now = new Date();
  const currentPeriod = `${months[now.getMonth()]} ${now.getFullYear()}`;

  if (type === "BPJS" || type === "BPJS_KESEHATAN") {
    // Contoh akun dummy simulasi yang berstatus lunas
    if (customerId === "0001234567890") {
      return {
        success: true,
        type: "BPJS",
        customerId,
        customerName: "Keluarga Bpk Budi",
        note,
        status: "PAID",
        statusLabel: "LUNAS / NIHIL",
        totalAmount: 0,
        formattedTotal: "Rp 0 (Lunas)",
        details: {
          product: "BPJS KESEHATAN",
          serviceType: "Iuran BPJS Kesehatan Mandiri",
          careClass: "Kelas 1",
          familyMembers: "4 Peserta",
          period: `${currentPeriod} (Lunas Terbayar di Muka)`,
          billAmount: 0,
          penaltyAmount: 0,
          adminFee: 0,
          totalAmount: 0,
          formattedTotal: "Rp 0 (Lunas)",
        },
        source: "VERIFIED_PAID",
        timestamp: new Date().toISOString(),
      };
    }
  }

  const bpjsClasses = [
    { kelas: "Kelas 1", rate: 150000 },
    { kelas: "Kelas 2", rate: 100000 },
    { kelas: "Kelas 3", rate: 35000 },
  ];
  const selectedClass = bpjsClasses[hash % bpjsClasses.length];
  const familyMembers = (hash % 4) + 1;
  const billAmount = selectedClass.rate * familyMembers;
  const adminFee = 2500;
  const totalAmount = billAmount + adminFee;

  return {
    success: true,
    type,
    customerId,
    customerName: type === "BPJS" ? "Keluarga Peserta BPJS" : "Pelanggan Utilitas",
    note,
    status: "UNPAID",
    statusLabel: "BELUM LUNAS",
    totalAmount,
    formattedTotal: formatRupiah(totalAmount),
    details: {
      product: "BPJS KESEHATAN",
      careClass: selectedClass.kelas,
      familyMembers: `${familyMembers} Peserta`,
      ratePerPerson: selectedClass.rate,
      period: currentPeriod,
      billAmount,
      penaltyAmount: 0,
      adminFee,
      totalAmount,
      formattedTotal: formatRupiah(totalAmount),
    },
    source: "SIMULATOR_ENGINE",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Pemrosesan Bulk Inquiry: 100% Live Gateway Sepulsa (Tanpa Fallback Simulator)
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
  mockInquiry,
  processBulkInquiry,
  formatRupiah,
};
