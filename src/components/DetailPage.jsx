const LABELS = {
  dapil: 'Dapil',
  kecamatan: 'Kecamatan',
  desa: 'Desa/Kelurahan',
  tps: 'TPS',
}

export default function DetailPage() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const level = parts[1] || ''
  const id = parts[2] || ''
  const label = LABELS[level] || 'Wilayah'

  return (
    <main className="min-h-screen px-6 py-8 text-[#332e29] bg-[radial-gradient(circle_at_92%_8%,#fff9e9_0,transparent_25%),#fbf7f0]">
      <div className="max-w-[1100px] mx-auto">
        <a href="/" className="inline-flex items-center text-sm text-[#c4482a] font-bold hover:underline mb-6">
          Kembali ke peta
        </a>
        <section className="border border-[#e4d9c7] rounded-lg bg-[rgba(255,253,247,0.8)] shadow-sm p-6">
          <h1 className="m-0 font-bold text-2xl [font-family:Georgia,serif]">Detail {label}</h1>
          <p className="mt-3 mb-0 text-sm text-[#756b62]">
            Halaman detail untuk {label}{id ? ` ID ${id}` : ''} disiapkan untuk tahap pengembangan berikutnya.
          </p>
        </section>
      </div>
    </main>
  )
}
