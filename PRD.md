# Product Requirements Document (PRD) — Struktur (Tracker) Project Management Suite

---

## 1. Executive Summary & Vision

**Struktur (Tracker)** adalah aplikasi manajemen proyek, tugas hierarkis, dan pelacak waktu (*time tracking*) komprehensif yang dirancang untuk pengembang, manajer proyek, tim kreatif, dan individu dengan alur kerja terstruktur. 

Aplikasi ini menggabungkan fleksibilitas struktur tugas *infinite nesting* (pohon hierarki tugas tanpa batas), visualisasi *Kanban Board*, kalender interaktif fleksibel multi-view (*Month, Week, Day, Year*), pelacakan sesi waktu kerja (*active timer*), analitik mendalam, serta pengelolaan beban kerja tim (*Team & Workload Distribution*).

---

## 2. Target Audience & Problem Statement

### 2.1. Target Pengguna
- **Software Engineers & Tech Leads**: Membutuhkan breakdown tugas yang sangat rinci (Epic > Story > Task > Subtask) dengan estimasi vs. waktu aktual (*logged sessions*).
- **Project Managers / Scrum Masters**: Memerlukan visibilitas progres proyek secara holistik, timeline jadwal, serta distribusi beban kerja antar anggota tim.
- **Freelancers & Solopreneurs**: Membutuhkan pelacak waktu yang presisi untuk setiap tugas dan proyek, serta ekspor laporan CSV/JSON.

### 2.2. Masalah yang Diselesaikan
1. **Kehilangan konteks pada tugas yang kompleks**: Sebagian besar alat manajemen proyek membatasi kedalaman sub-task. Struktur menyediakan *infinite nesting tree* dengan *rollup calculations* otomatis (status, durasi, tanggal).
2. **Kesenjangan antara perencanaan dan pelacakan waktu nyata**: Terintegrasinya timer langsung pada tingkat tugas terdalam (*leaf nodes*) dengan sesi waktu riil.
3. **Penyusunan jadwal yang kaku**: Fleksibilitas tampilan kalender dengan filter proyek, toggle hari kerja (*show/hide weekends*), dan mode tampilan adaptif.

---

## 3. Tech Stack & Architecture

| Layer | Teknologi / Library | Keterangan |
|---|---|---|
| **Frontend Framework** | React 19 + TypeScript | Komponen fungsional modern, custom hooks, dan strict typing. |
| **Styling & Design System** | Tailwind CSS v4 | Dark mode native `#09090b` / `#121215`, aksen oranye `#f97316`, modern border hierarchy `#27272a`. |
| **Icons** | Lucide React | Ikonografi SVG konsisten dan ringan. |
| **Animations** | Motion (Framer Motion) | Transisi halus untuk modal, bar progress, dan list items. |
| **Backend & Routing** | Express.js (Node.js) + Vite | Server pengembang terintegrasi dan static fallback bundling via `esbuild`. |
| **State & Persistence** | LocalStorage + JSON sync + Server API Ready | Reaktif, otomatis tersimpan ke cache lokal secara instan dengan auto-save flag. |

---

## 4. Data Models & Schemas

### 4.1. Core Types (`src/types.ts`)

```typescript
// Status Tugas
export type ItemStatus = 'not-started' | 'in-progress' | 'review' | 'completed';

// Status Proyek
export type ProjectStatus = 'active' | 'archived';

// Anggota Tim (Person)
export interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  color?: string;
  avatar: string;
}

// Sesi Waktu Tercatat (Time Session)
export interface Session {
  id: string;
  startedAt: string;          // ISO string
  endedAt: string | null;     // ISO string saat dihentikan
  loggedSeconds: number;      // Total detik sesi
}

// Node Tugas (Hierarchical Tree Item)
export interface ItemNode {
  id: string;
  type: 'item-node';
  name: string;
  isExpanded?: boolean;
  targetDate?: string;        // Target penyelesaian (YYYY-MM-DD)
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  status: ItemStatus;
  assigneeId?: string;        // Relasi ke Person.id
  estimatedSeconds?: number;  // Estimasi pengerjaan dalam detik
  notes?: string;             // Catatan detail / deskripsi
  sessions: Session[];        // Riwayat sesi timer
  subItems: ItemNode[];       // Rekursif: daftar sub-tugas
}

// Node Proyek (Project Root)
export interface ProjectNode {
  id: string;
  type: 'project-node';
  title: string;
  status: ProjectStatus;
  color?: string;             // Hex color badge
  isExpanded?: boolean;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  items: ItemNode[];          // Daftar tugas level teratas dalam proyek
}

// Pelacak Timer Aktif
export interface ActiveTimer {
  itemId: string;
  itemPathIds: string[];      // [projectId, ...ancestorIds, itemId]
  startedAt: string;          // ISO string start
  description?: string;
}

// Log Aktivitas
export interface ActivityLog {
  id: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  action: string;
  details: string;
  itemId?: string;
  itemTitle?: string;
}

// Pengaturan Global
export interface AppSettings {
  theme: 'dark' | 'light';
  language: string;
  autoSave: boolean;
  version: string;
  auth: {
    username: string;
    passwordHash: string;
  };
  activeTimer: ActiveTimer | null;
}

// Basis Data Utama
export interface AppData {
  settings: AppSettings;
  persons: Person[];
  projects: ProjectNode[];
  activityLogs: ActivityLog[];
}
```

---

## 5. Functional Features & Modules

### 5.1. Header & Global Navigation (`Header.tsx`)
- **View Modes Switcher**: Berpindah cepat antar tampilan:
  - `Dashboard` (Ikhtisar & Ringkasan)
  - `Projects` (Pohon Hierarki / Tree View)
  - `Tasks` (Kanban Board)
  - `Calendar` (Jadwal & Agenda)
  - `Team` (Manajemen Anggota Tim)
  - `Analytics` (Statistik & Laporan Waktu)
  - `Archived` (Arsip Proyek & Tugas)
- **Live Active Timer Bar**:
  - Menampilkan timer berjalan secara *real-time* (jam:menit:detik) dengan visual pulsing dot merah/oranye.
  - Menampilkan nama tugas dan nama proyek terkait.
  - Tombol aksi cepat: *Stop Timer* (langsung menyimpan ke riwayat sesi tugas).
- **Global Search**:
  - Pencarian instan untuk proyek, tugas, sub-tugas, catatan, dan nama anggota tim dengan modal preview hasil.
- **Quick Actions**:
  - Tombol **+ Add** cepat untuk membuat Task Baru atau Proyek Baru dari mana saja.
  - Tombol **Settings** untuk backup, ekspor, dan konfigurasi.

---

### 5.2. Dashboard View (`DashboardView.tsx`)
- **Metric Summary Cards**:
  - Total Proyek Aktif.
  - Total Tugas & Status Penyelesaian (Tingkat persentase selesai).
  - Total Waktu yang Dihabiskan (*Hours Logged*) vs. Total Estimasi.
  - Jumlah Tugas Berjalan (*In Progress* & *Overdue*).
- **Project Progress Overview**: Kartu visual setiap proyek dengan progres bar persentase, penghitung *leaf tasks*, dan estimasi waktu.
- **Recent Activity Feed**: Daftar riwayat tindakan terbaru (pembuatan task, perubahan status, timer, dan arsip).

---

### 5.3. Projects Tree View (`TreeView.tsx`)
Struktur inti hierarki proyek dengan kemampuan rekursif tanpa batas:
- **Pengelolaan Proyek**:
  - **Create / Edit Project**: Mengatur nama, warna penanda, status.
  - **Reorder Projects (Move Up & Move Down)**: Tombol panah atas/bawah untuk mengubah urutan prioritas proyek secara instan.
  - **Duplicate Project**: Opsi melalui menu dropdown dan modal proyek untuk menduplikasi seluruh hierarki proyek dan semua tugas di dalamnya dengan ID baru dan status segar (*Copy*).
  - **Archive / Delete Project**: Mengarsipkan atau menghapus proyek dengan aman.
- **Pengelolaan Tugas & Sub-Tugas (Hierarchical Node)**:
  - **Infinite Nesting**: Menambahkan sub-task di level mana pun secara tak terbatas.
  - **Rollup Calculations**: Status dan progres parent node dihitung secara otomatis berdasarkan status semua anak tugas di bawahnya.
  - **Inline Timer Trigger**: Menjalankan/menghentikan timer langsung dari baris tugas.
  - **Reorder Tasks (Move Up / Down)**: Mengubah posisi urutan sub-task di bawah parent yang sama.
  - **Duplicate Task**: Menduplikasi tugas berserta seluruh sub-tugasnya.
  - **Inline Status Switcher**: Mengubah status (*Not Started*, *In Progress*, *Review*, *Completed*) secara langsung.
  - **Expand / Collapse All**: Membuka atau menutup seluruh cabang tugas sekaligus.

---

### 5.4. Kanban Board View (`KanbanView.tsx`)
- **Kolom Status Alur Kerja**:
  - 🔘 *Not Started* / Backlog
  - 🟡 *In Progress* / Sedang Dikerjakan
  - 🔵 *In Review* / Menunggu Peninjauan
  - 🟢 *Completed* / Selesai
- **Filter Interaktif**:
  - Filter berdasarkan Proyek tertentu.
  - Filter berdasarkan Anggota Tim (*Assignee*).
  - Pencarian cepat nama tugas di dalam board.
- **Kartu Tugas Kanban**:
  - Menampilkan badge proyek, avatar assignee, target tanggal (dengan indikator merah jika *overdue*), total subtask, dan waktu terpakai vs estimasi.
  - Aksi cepat: Mulai timer, ubah status, edit detail modal.

---

### 5.5. Calendar & Schedule View (`GoogleCalendarView.tsx` / `CalendarView.tsx`)
- **4 Mode Tampilan Interaktif**:
  1. **Month View**: Kalender grid bulanan dengan indikator tugas di tiap tanggal, visual pergeseran bulan, dan status hari ini.
  2. **Week View**: Tampilan jadwal 7 hari atau 5 hari kerja dengan slot jam 24-jam vertikal dan baris *all-day events*.
  3. **Day View**: Tampilan jadwal fokus harian dengan rincian slot waktu presisi.
  4. **Year View**: Tampilan ikhtisar 12 mini-kalender dalam 1 tahun dengan heatmap kepadatan tugas.
- **Opsi Kustomisasi**:
  - **Show / Hide Weekends**: Tombol sakelar untuk menampilkan atau menyembunyikan hari Sabtu dan Minggu (otomatis beralih antara 7 kolom dan 5 kolom kerja Senin–Jumat pada mode Month, Week, dan Year).
  - **Show / Hide Completed Tasks**: Menyaring tugas yang sudah selesai dari kalender.
  - **Project Filter**: Menampilkan tugas dari proyek tertentu atau seluruh proyek.
  - **Interactive Task Modal**: Klik pada tanggal atau entri tugas untuk langsung melihat/mengedit detail atau menambahkan tugas baru pada tanggal tersebut.

---

### 5.6. Team & Workload Management (`TeamView.tsx`)
- **Daftar Anggota Tim**: Profil, email, role/jabatan, warna aksen, dan avatar.
- **Workload & Allocation Analysis**:
  - Jumlah tugas aktif yang ditugaskan ke setiap individu.
  - Total jam yang telah di-log dan estimasi beban kerja tersisa.
  - Distribusi status tugas per anggota tim.
- **Smart Task Reassignment**:
  - Fitur untuk memindahkan/mengalihkan seluruh tugas dari satu anggota tim ke anggota tim lain secara massal (misal saat rotasi atau cuti).

---

### 5.7. Analytics & Time Reporting (`AnalyticsView.tsx`)
- **Time Tracking Breakdown**:
  - Perbandingan antara Waktu Terestimasi (*Estimated Hours*) vs. Waktu Aktual (*Logged Hours*).
  - Metrik efisiensi pengerjaan (*Velocity & Estimation Accuracy*).
- **Status Distribution**: Diagram proporsi status tugas (*Not Started, In Progress, Review, Completed*).
- **Member Contribution**: Total waktu kerja yang dicatat oleh masing-masing personil.
- **Time Filter**: Analisis berdasarkan periode waktu tertentu.

---

### 5.8. Archived & Data Recovery (`ArchivedView.tsx`)
- **Arsip Terpisah**: Menjaga kebersihan antarmuka utama tanpa menghilangkan histori lama.
- **Restore / Pulihkan**: Mengembalikan proyek atau tugas yang diarsipkan kembali ke daftar aktif dalam satu klik.
- **Permanent Delete**: Pembersihan permanen proyek atau tugas dari penyimpanan lokal.

---

### 5.9. Settings, Import/Export & Data Persistence (`SettingsModal.tsx`)
- **Export Data**:
  - **Export JSON**: Unduh seluruh snapshot database (`AppData`) untuk backup cadangan.
  - **Export CSV**: Ekspor seluruh daftar tugas ke format tabel CSV (berisi kolom Nama, Proyek, Status, Assignee, Estimasi, Waktu Terpakai, Target Tanggal).
- **Import Data**: Mengunggah file backup JSON untuk me-restore seluruh state aplikasi.
- **Reset to Sample Data**: Opsi untuk memulihkan ke data demo bawaan.
- **Activity Logs Viewer**: Pemeriksaan riwayat audit lengkap seluruh tindakan sistem.

---

## 6. Non-Functional Requirements & Design System

### 6.1. Desain UI & Estetika Visual
- **Palet Warna "Dark Luxe Obsidian"**:
  - Latar Utama: `#09090b` (Zinc 950)
  - Card / Panel: `#121215` & `#18181b` (Zinc 900)
  - Border & Pembatas: `#27272a` (Zinc 800)
  - Warna Aksen Primer: `#f97316` (Orange 500)
  - Teks: `#f4f4f5` (High Contrast White) & `#a1a1aa` (Subtle Gray)
- **Responsivitas**: Tampilan adaptif penuh untuk desktop lebar (*1440px+*), laptop (*1024px*), tablet (*768px*), dan mobile (*375px+*).

### 6.2. Kinerja & Keandalan
- **Perhitungan Rekursif Cepat**: Utilitas pohon (`treeUtils.ts`) dioptimalkan untuk memproses ribuan node tugas secara instan tanpa lag.
- **Keamanan Data**: Semua penyimpanan timer dan struktur tersimpan secara atomik di `localStorage` dengan penanganan *error boundary* dan fallback yang aman.

---

## 7. File Structure Overview

```
├── metadata.json                    # Metadata aplikasi & permission
├── package.json                     # Konfigurasi dependensi & scripts
├── PRD.md                           # Dokumen Product Requirements (Dokumen ini)
├── server.ts                        # Express server entry point
├── src/
│   ├── main.tsx                     # React root mount
│   ├── App.tsx                      # Main app controller, view router, global state
│   ├── index.css                    # Tailwind CSS imports & global styles
│   ├── types.ts                     # TypeScript data interfaces & types
│   ├── defaultData.ts               # Sample / seed data starter
│   ├── components/
│   │   ├── Header.tsx               # Navigasi atas, Active Timer bar, Quick Add
│   │   ├── DashboardView.tsx        # Ringkasan KPI, progres, dan aktivitas
│   │   ├── TreeView.tsx             # Manajemen hierarki proyek & tugas (Infinite nesting)
│   │   ├── KanbanView.tsx           # Board status alur kerja tugas
│   │   ├── GoogleCalendarView.tsx   # Kalender multi-view (Month/Week/Day/Year/Weekends)
│   │   ├── CalendarView.tsx         # Kalender alternatif / Legacy view
│   │   ├── TeamView.tsx             # Manajemen anggota tim & beban kerja
│   │   ├── AnalyticsView.tsx        # Laporan waktu, akurasi estimasi & grafik
│   │   ├── ArchivedView.tsx         # Manajemen item yang diarsipkan
│   │   ├── ItemModal.tsx            # Form dialog tambah/edit tugas
│   │   ├── ProjectModal.tsx         # Form dialog tambah/edit/duplikasi proyek
│   │   └── SettingsModal.tsx        # Backup, Export CSV/JSON, & Audit Logs
│   └── utils/
│       ├── dateUtils.ts             # Utilitas pemformatan tanggal & jam
│       └── treeUtils.ts             # Logika rekursif pohon tugas, rollup, kalkulasi waktu
```

---

## 8. Summary of Recent Improvements
1. **Perbaikan Toggle "Show Weekends" pada Kalender**: Menghubungkan kontrol kalender dengan rendering dinamis 5 hari kerja (Senin–Jumat) di mode Month, Week, dan Year.
2. **Move Up & Move Down Projects**: Kemudahan memindahkan posisi urutan proyek naik atau turun secara instan.
3. **Duplicate Project Feature**: Kemampuan menduplikasi seluruh struktur proyek beserta seluruh anak sub-tugasnya dengan penomoran ID baru.
