# Website Top Up Manual — Tanpa PHP

Aplikasi ini menggunakan **Node.js + HTML + CSS + JavaScript + database JSON**. Tidak ada file PHP, MySQL, bot Telegram, API Digiflazz, domain bawaan, atau URL toko pihak ketiga.

## Fitur
- `public/index.html` sebagai halaman utama.
- Kategori: pulsa, paket data, token PLN, e-wallet, voucher game, PPOB.
- Registrasi dengan username Telegram (tanpa `@`), email Google/Gmail, username, dan password.
- Login username + password.
- Checkout, riwayat pesanan, detail/invoice, dan status transaksi.
- Pembayaran manual: instruksi transfer bank / QRIS yang admin isi sendiri.
- Upload bukti bayar JPG/PNG/WEBP, maksimal 5 MB.
- Panel admin: kelola produk, pesanan dan status, pelanggan, voucher diskon, pengaturan toko/pembayaran.
- Penyimpanan data pada `data/database.json`.

## Persyaratan
- Node.js 18 atau lebih baru.
- Hosting/VPS yang dapat menjalankan proses Node.js.

## Menjalankan di komputer / VPS
1. Ekstrak ZIP.
2. Jalankan `npm start` atau `node server.js` dari folder proyek.
3. Buka `http://localhost:3000` di browser.
4. Pada instalasi pertama, halaman setup meminta pembuatan akun admin.
5. Setelah admin dibuat, masuk menggunakan username dan password.
6. Tambahkan produk melalui Admin → Produk.
7. Isi instruksi pembayaran dan detail rekening/QRIS di Admin → Pengaturan.

## Domain
Tidak ada domain yang dipilih atau ditanam di dalam aplikasi. Kamu tentukan domain sendiri, arahkan DNS ke hosting/VPS, lalu atur reverse proxy dan HTTPS sesuai penyedia hosting. Kolom domain/base URL di pengaturan hanya opsional dan tidak memaksa redirect ke domain tertentu.

## Catatan email Google
Pendaftaran menerima alamat Google/Gmail, tetapi Google OAuth dan pengiriman email verifikasi otomatis belum diaktifkan. Login website tetap memakai username dan password. Integrasi Google OAuth memerlukan kredensial Google Cloud milik pemilik website.

## Keamanan sebelum online
- Jalankan di belakang HTTPS.
- Gunakan reverse proxy (misalnya konfigurasi hosting Node.js) dan batasi akses port aplikasi.
- Lindungi folder `data/` dan `uploads/` agar tidak dapat diunduh langsung melalui web server. Server hanya menyediakan endpoint untuk file bukti yang tersimpan.
- Buat backup rutin `data/database.json` dan `uploads/`.
- Ganti password admin jika kredensial pernah dibagikan.
- Untuk pemakaian ramai/multi-server, tambahkan database transaksional dan penyimpanan file terkelola. Database JSON cocok untuk instalasi kecil/satu proses server.

## Struktur
- `server.js` — backend Node.js dan API.
- `public/index.html` — halaman website.
- `public/app.js` — logika frontend.
- `public/style.css` — tampilan responsif.
- `data/database.json` — database JSON.
- `uploads/` — bukti pembayaran.
