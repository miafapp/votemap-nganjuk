# Vote Map Nganjuk - Development Phases

Dokumen ini mencatat baseline workflow pengembangan yang disepakati untuk penyelesaian proyek secara bertahap.

## Aturan kerja

1. Setiap fase dikerjakan pada branch terpisah.
2. Setiap fase harus dapat diuji secara mandiri.
3. Setelah acceptance test fase terpenuhi, dibuat Pull Request ke `main`.
4. PR tidak di-merge oleh developer perubahan. Pemilik repository melakukan merge setelah uji coba langsung.
5. Jika hasil uji menemukan masalah, perbaikan tetap dilakukan pada fase yang sama sampai dinyatakan selesai.
6. Fase berikutnya baru dimulai setelah pemilik repository menyatakan fase aktif selesai.

## Fase

- Phase 00: Baseline dan persiapan.
- Phase 01: Database materialized summary dan API.
- Phase 02: State hierarki dan sinkronisasi filter/peta.
- Phase 03: Peta Leaflet dan layer hierarki.
- Phase 04: Panel infografis.
- Phase 05: Tabel rekap wilayah.
- Phase 06: Detail perolehan suara.
- Phase 07: Optimasi dan QA.

## Baseline saat Phase 00

- Default branch: `main`.
- Frontend: React + Vite.
- Peta: Leaflet + React Leaflet.
- Lint: Oxlint.
- API client: `src/lib/api.js`.
- Komponen utama berada di `src/components/`.
- GeoJSON berada di `public/geojson/`.
- Mockup berada di `public/images/mockup.png`.
- Environment lokal menggunakan `.env`; file tersebut sudah tercatat di repository pada baseline dan tidak dibaca atau dicetak dalam dokumen ini.
- API existing dipertahankan.
- Materialized summary menjadi pendekatan utama untuk optimasi agregasi dashboard.
- Breadcrumb tidak termasuk scope.
- Pemilihan wilayah melalui peta harus menyinkronkan selected option pada panel filter.

## Quality gate

Setiap fase minimal harus melalui:

- pemeriksaan fungsi pada environment lokal;
- validasi terhadap data/API pada sampel yang relevan;
- pemeriksaan regresi pada fitur fase sebelumnya;
- Pull Request ke `main`;
- uji langsung oleh pemilik repository setelah merge.

Fase tidak dianggap selesai hanya karena kode sudah dibuat. Fase selesai setelah hasil uji dinyatakan sesuai.
