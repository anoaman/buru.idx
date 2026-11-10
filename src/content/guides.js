// "Cara kerja" and "Metodologi" pages. Shared by the React guide page and the
// Worker's crawler HTML. Numbers here describe live product logic (backend
// src/stock-read.js, radar scout conditions, broker-intelligence methodology);
// change them only together with that logic.

export const GUIDES = [
  {
    path: '/cara-kerja',
    title: 'Cara kerja Bandarlab',
    description: 'Bandarlab adalah alat riset saham BEI yang hanya membaca data: screener, analisis saham dan broker flow dari data akhir hari. Bukan ajakan jual/beli.',
    lead: 'Bandarlab adalah alat riset saham Bursa Efek Indonesia yang hanya membaca data. Bandarlab membantu melihat apa yang terjadi di pasar dan di balik transaksi broker, tanpa memberi rekomendasi beli atau jual.',
    sections: [
      {
        heading: 'Empat halaman, satu alur',
        items: [
          ['Home', 'Membaca kondisi pasar di sesi terakhir: IHSG, breadth, aliran asing, saham yang sedang diakumulasi, rotasi sektor dan saham penggerak.'],
          ['Screener', 'Menyaring saham BEI berdasarkan harga, likuiditas, pola harga dan akumulasi broker. Saham yang hampir lolos ikut ditampilkan, lengkap dengan filter yang menggugurkannya.'],
          ['Stock Analysis', 'Membaca satu saham: grafik harga, indikator, broker utama dan ringkasan dalam bahasa sederhana. Setiap label menyebut alasannya dan apa yang bisa mengubahnya.'],
          ['Broker Flow', 'Melacak broker yang mengakumulasi atau mendistribusi sebuah saham, dari 1 hari hingga beberapa bulan, lengkap dengan persistensi dan estimasi inventori.'],
        ],
      },
      {
        heading: 'Dari mana datanya',
        paragraphs: [
          'Bandarlab memakai data akhir hari dari bursa: harga, volume, nilai transaksi dan broker summary. Datanya tertunda, bukan real-time. Harga diperbarui sore hari setelah pasar tutup, sedangkan broker summary diperbarui malam hari.',
          'Setiap halaman menampilkan tanggal sesi yang dipakai, supaya jelas data hari apa yang sedang dibaca.',
        ],
      },
      {
        heading: 'Yang tidak dilakukan Bandarlab',
        paragraphs: [
          'Bandarlab tidak memberi sinyal beli atau jual, target harga, atau rencana trading. Label seperti Accumulation atau Breakout menggambarkan pola di data, bukan saran. Keputusan dan risikonya tetap di tangan masing-masing.',
        ],
      },
      {
        heading: 'Mulai dari mana',
        paragraphs: [
          'Buka Home untuk gambaran pasar, lalu pakai Screener untuk mencari saham dengan pola yang ingin dipelajari. Klik ticker mana pun untuk membuka Stock Analysis, dan lihat Broker Flow untuk mengecek siapa yang membeli dan menjual. Istilah yang asing bisa dicek di Glossary.',
        ],
      },
    ],
  },
  {
    path: '/metodologi',
    title: 'Metodologi dan batasan Bandarlab',
    description: 'Bagaimana Bandarlab menghitung broker flow, label analisis, filter screener dan proyeksi rentang harga, beserta batasan datanya.',
    lead: 'Halaman ini menjelaskan bagaimana angka di Bandarlab dihitung dan apa batasannya. Semua label di Bandarlab menggambarkan data, bukan rekomendasi.',
    sections: [
      {
        heading: 'Data',
        items: [
          ['Harga dan volume', 'Data harian akhir sesi dari Bursa Efek Indonesia, diperbarui setelah pasar tutup.'],
          ['Broker summary', 'Transaksi pasar reguler dengan semua tipe investor digabung, hingga 25 pembeli dan 25 penjual teratas per saham per hari. Diperbarui sekitar pukul 18.30 WIB.'],
          ['Status FCA', 'Mengikuti notasi X terbaru.'],
          ['Kesegaran data', 'Setiap halaman menampilkan tanggal sesi yang dipakai. Kalau datanya lebih tua dari satu sesi, halaman memberi peringatan.'],
        ],
      },
      {
        heading: 'Broker flow',
        items: [
          ['Nilai net', 'Nilai beli dikurangi nilai jual per broker dalam periode yang dipilih. Akumulasi diurutkan dari net buy terbesar, distribusi dari net sell terbesar.'],
          ['Persistensi', 'Jumlah hari di sisi dominan (beli atau jual) dibagi jumlah hari saham itu tercatat dalam periode.'],
          ['Estimasi inventori', 'Jumlah kumulatif net lot sejak awal periode. Dimulai dari nol, jadi bukan kepemilikan sebenarnya.'],
          ['Harga rata-rata', 'Perkiraan dari transaksi yang tercatat dalam periode, bukan harga modal sebenarnya.'],
          ['Rotasi broker', 'Pemimpin net buy di paruh pertama periode berbeda dengan paruh kedua, masing-masing memegang minimal 40% aliran beli di paruhnya, broker lama berhenti net buy dan broker baru sebelumnya tidak net buy.'],
        ],
      },
      {
        heading: 'Label di Stock Analysis',
        paragraphs: ['Label diperiksa berurutan. Label pertama yang cocok dipakai, beserta alasannya.'],
        items: [
          ['Breakdown', 'Harga turun dan ditutup di bawah harga terendah 20 hari sebelumnya.'],
          ['Breakout', 'Harga ditutup di atas harga tertinggi 20 hari sebelumnya dengan volume minimal 1,5 kali rata-ratanya.'],
          ['Brokers split', 'Pembeli dominan dan penjual dominan sama-sama kuat.'],
          ['Distribution', 'Penjual dominan net sell secara konsisten dan lebih kuat dari pembeli dominan.'],
          ['Retail-led buying', 'Pembeli dominan net buy di minimal 80% hari tanpa tren turun, tapi rata-rata transaksinya di bawah 0,8 kali rata-rata transaksi saham itu.'],
          ['Accumulation', 'Pembeli dominan net buy di minimal 80% hari, tanpa tren turun, dengan ukuran transaksi minimal 0,8 kali rata-rata. Menjadi Accumulation at support kalau harga paling jauh 6% di atas support.'],
          ['Pullback in uptrend', 'Tren naik, dan harga kembali ke dalam 3% dari MA20 atau dari support.'],
          ['Tight range', 'Rentang harga 10 hari terakhir 8% atau kurang.'],
        ],
      },
      {
        heading: 'Proyeksi rentang harga',
        paragraphs: [
          'Rentang harga ke depan disimulasikan dari 1.000 jalur acak yang disusun ulang dari pergerakan 120 sesi terakhir saham itu, tanpa asumsi arah, dan dibatasi ARA serta ARB. Horizonnya 5, 10 atau 20 sesi.',
          'Dalam pengujian data historis, sekitar 80% harga aktual berada di dalam rentang yang diproyeksikan. Setiap label juga menampilkan rekam jejaknya dari pengujian yang sama.',
        ],
      },
      {
        heading: 'Filter Screener',
        items: [
          ['Liquidity floor', 'Nilai transaksi harian rata-rata minimal. Bawaannya Rp500 juta.'],
          ['Exclude FCA', 'Saham di Papan Pemantauan Khusus dikecualikan secara bawaan.'],
          ['Near Support', 'Harga paling jauh 6% di atas support yang diuji berulang kali, dan belum jebol lebih dari 3% di bawahnya.'],
          ['Tight Base', 'Konsolidasi dalam rentang yang kredibel, paling lebar 12%.'],
          ['Price has broken resistance', 'Harga penutupan terakhir di atas harga tertinggi 20 sesi sebelumnya.'],
          ['Volume Breakout', 'Volume terakhir minimal 1,5 kali rata-rata MA5, MA10 atau MA20.'],
          ['Relative Strength vs IHSG', 'Saham mengungguli IHSG dalam 20 sesi terakhir yang datanya lengkap untuk keduanya.'],
          ['Broker Accumulation', 'Akumulasi yang luas dan persisten, dipimpin pembeli yang cukup dominan.'],
        ],
      },
      {
        heading: 'Batasan',
        items: [
          ['Kode broker bukan identitas', 'Satu kode broker berisi banyak nasabah yang tidak saling terkait. Pola broker adalah aliran yang teramati, bukan bukti adanya satu bandar.'],
          ['Data tidak lengkap', 'Broker di luar 25 teratas per hari tidak tercatat. Tidak muncul bukan berarti tidak bertransaksi.'],
          ['Data bisa keliru', 'Data bisa terlambat, tidak lengkap atau salah. Cocokkan dengan sumber resmi sebelum mengambil keputusan.'],
          ['Masa lalu bukan jaminan', 'Hasil pengujian data historis tidak menjamin hasil di masa depan.'],
        ],
      },
      {
        heading: 'Bukan ajakan jual/beli',
        paragraphs: [
          'Bandarlab adalah alat riset yang hanya membaca data. Isinya bukan rekomendasi investasi, bukan ajakan untuk membeli atau menjual efek apa pun, dan tidak disusun oleh penasihat investasi berizin. Investasi saham mengandung risiko, termasuk kehilangan modal. Keputusan dan risikonya sepenuhnya milik pengguna.',
        ],
      },
    ],
  },
];

export const GUIDE_BY_PATH = new Map(GUIDES.map((guide) => [guide.path, guide]));
