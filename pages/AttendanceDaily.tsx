
import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { UserRole, AttendanceStatus, AttendanceRecord, Student } from '../types';
import { Save, MessageCircle, AlertCircle, Share2, Send, X, CheckCircle, Smartphone, CalendarOff, Upload } from 'lucide-react';

const AttendanceDaily: React.FC = () => {
  const { students, attendance, holidays, markAttendance, currentUser, academicYears, triggerSave } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState(currentUser?.classId || '1');
  const [localAttendance, setLocalAttendance] = useState<Record<string, AttendanceStatus>>({});
  
  // Bulk Send Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [sentStatus, setSentStatus] = useState<Record<string, boolean>>({});

  // Import Excel State
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const activeYear = academicYears.find(y => y.isActive);

  // Helper untuk cek weekend menggunakan waktu lokal agar akurat
  const isWeekend = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const day = date.getDay();
    return day === 0 || day === 6; // 0=Sunday, 6=Saturday
  };

  // Helper untuk mencari data hari libur (Strict String Comparison)
  const getHoliday = (dateStr: string) => {
    return holidays.find(h => h.date.trim() === dateStr.trim());
  };

  // Logika penentu apakah hari ini libur (Sabtu, Minggu, atau Tanggal Merah)
  const holidayData = getHoliday(selectedDate);
  const isWeekendDay = isWeekend(selectedDate);
  const isDayOff = isWeekendDay || !!holidayData;

  // SORTING: Sort by Name Alphabetically
  const filteredStudents = students
    .filter(s => s.classId === selectedClass && s.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    // Load existing data
    const existing: Record<string, AttendanceStatus> = {};
    filteredStudents.forEach(s => {
      const record = attendance.find(a => a.studentId === s.id && a.date === selectedDate);
      existing[s.id] = record ? record.status : AttendanceStatus.NONE;
    });
    setLocalAttendance(existing);
    setSentStatus({}); // Reset sent status on date/class change
  }, [selectedDate, selectedClass, attendance, students]); 

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (isDayOff) {
      alert("Tidak dapat mengubah absensi pada Hari Libur / Akhir Pekan.");
      return; 
    }
    setLocalAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = () => {
    if (!activeYear) return alert("Pilih tahun pelajaran aktif di dashboard");
    
    // Prevent saving on holidays/weekends
    if (isDayOff) {
      const msg = holidayData ? `Hari Libur: ${holidayData.description}` : "Akhir Pekan (Sabtu/Minggu)";
      return alert(`GAGAL MENYIMPAN.\nHari ini adalah ${msg}.\nAbsensi tidak dapat dilakukan.`);
    }
    
    const records: AttendanceRecord[] = Object.entries(localAttendance)
      .filter(([_, status]) => status !== AttendanceStatus.NONE)
      .map(([studentId, status]) => ({
        id: `${studentId}-${selectedDate}`,
        studentId,
        date: selectedDate,
        status: status as AttendanceStatus,
        academicYear: activeYear.name
      }));
    
    markAttendance(records);
    triggerSave(); 
    alert('Data absensi berhasil disimpan dan sedang dikirim ke Spreadsheet...');
  };

  // --- LOGIKA IMPORT EXCEL ---
  const handleImport = () => {
    // Security check: Only Admin can import
    if (currentUser?.role !== UserRole.ADMIN) {
      return alert("Akses Ditolak. Fitur ini hanya untuk Admin.");
    }

    if (isDayOff) return alert("Tidak dapat menginput data pada hari libur.");

    const lines = importText.trim().split(/\r?\n/);
    let successCount = 0;
    const newLocalAttendance = { ...localAttendance };

    lines.forEach(line => {
      const parts = line.split('\t');
      // Harapan: Kolom 1 = NISN atau Nama, Kolom 2 = Status (H/S/I/A)
      if (parts.length >= 2) {
        const key = parts[0].trim(); // Bisa NISN atau Nama
        const statusRaw = parts[1].trim().toUpperCase();

        // Cari siswa di kelas yang sedang dipilih
        // Prioritas cari by NISN, jika tidak ketemu cari by Nama (Case insensitive)
        const student = filteredStudents.find(s => 
          s.nisn === key || s.name.toLowerCase() === key.toLowerCase()
        );

        if (student) {
          // Mapping status
          let status: AttendanceStatus = AttendanceStatus.NONE;
          if (['H', 'HADIR', 'PRESENT'].includes(statusRaw)) status = AttendanceStatus.HADIR;
          else if (['S', 'SAKIT', 'SICK'].includes(statusRaw)) status = AttendanceStatus.SAKIT;
          else if (['I', 'IZIN', 'PERMIT'].includes(statusRaw)) status = AttendanceStatus.IZIN;
          else if (['A', 'ALPA', 'ABSENT'].includes(statusRaw)) status = AttendanceStatus.ALPA;

          if (status !== AttendanceStatus.NONE) {
            newLocalAttendance[student.id] = status;
            successCount++;
          }
        }
      }
    });

    if (successCount > 0) {
      setLocalAttendance(newLocalAttendance);
      alert(`Berhasil membaca ${successCount} data absensi dari text. Silakan cek tabel lalu tekan tombol 'Simpan Absensi'.`);
      setImportText('');
      setShowImport(false);
    } else {
      alert("Tidak ada data yang cocok. Pastikan format: [NISN/Nama] [Tab] [Status H/S/I/A]");
    }
  };

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return '';
    let p = phone.replace(/\D/g, ''); // remove non-digits
    if (p.startsWith('0')) p = '62' + p.slice(1);
    else if (p.startsWith('8')) p = '62' + p;
    return p;
  };

  const sendWhatsApp = (student: Student) => {
    const status = localAttendance[student.id];
    if (!status || status === AttendanceStatus.NONE) return alert("Pilih status kehadiran dulu");
    
    const phone = formatPhone(student.parentPhone);
    if (!phone) return alert(`Nomor WA Orang Tua untuk ${student.name} belum diisi di Data Siswa.`);

    let statusText = '';
    let emoji = '';
    
    switch (status) {
      case AttendanceStatus.HADIR: statusText = 'HADIR'; emoji = '✅'; break;
      case AttendanceStatus.SAKIT: statusText = 'SAKIT'; emoji = '😷'; break;
      case AttendanceStatus.IZIN: statusText = 'IZIN'; emoji = '📩'; break;
      case AttendanceStatus.ALPA: statusText = 'ALPA (Tanpa Keterangan)'; emoji = '❌'; break;
    }

    let message = `Yth. Wali Murid ananda *${student.name}*,\n\n`;
    message += `Diberitahukan bahwa pada hari ini ${new Date(selectedDate).toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}, siswa tersebut tercatat: *${statusText} ${emoji}*.\n\n`;
    message += `Terima kasih.\n_Absensi SD Negeri 5 Bilato_`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    
    // Mark as sent locally
    setSentStatus(prev => ({...prev, [student.id]: true}));
  };

  const handleRecapWhatsApp = () => {
    const sList = filteredStudents.filter(st => localAttendance[st.id] === AttendanceStatus.SAKIT);
    const iList = filteredStudents.filter(st => localAttendance[st.id] === AttendanceStatus.IZIN);
    const aList = filteredStudents.filter(st => localAttendance[st.id] === AttendanceStatus.ALPA);
    const hCount = filteredStudents.filter(st => localAttendance[st.id] === AttendanceStatus.HADIR).length;
    
    const dateFormatted = new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let text = `*LAPORAN ABSENSI KELAS ${selectedClass}*\n`;
    text += `${dateFormatted}\n`;
    text += `--------------------------------\n`;

    if (sList.length > 0) {
      text += `*😷 SAKIT:*\n`;
      sList.forEach((st, idx) => text += `${idx + 1}. ${st.name}\n`);
      text += `\n`;
    }

    if (iList.length > 0) {
      text += `*📩 IZIN:*\n`;
      iList.forEach((st, idx) => text += `${idx + 1}. ${st.name}\n`);
      text += `\n`;
    }

    if (aList.length > 0) {
      text += `*❌ ALPA:*\n`;
      aList.forEach((st, idx) => text += `${idx + 1}. ${st.name}\n`);
      text += `\n`;
    }

    text += `✅ Hadir: ${hCount} Siswa\n`;
    
    const totalFilled = hCount + sList.length + iList.length + aList.length;
    const notFilled = filteredStudents.length - totalFilled;
    if (notFilled > 0) text += `⚠️ Belum Absen: ${notFilled} Siswa\n`;

    text += `--------------------------------\n`;
    text += `_SD Negeri 5 Bilato_`;

    navigator.clipboard.writeText(text).then(() => {
        alert("Rekap berhasil disalin! Mengarahkan ke WhatsApp...");
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });
  };

  const StatusButton = ({ sId, type, label, color }: any) => (
    <button
      onClick={() => handleStatusChange(sId, type)}
      disabled={isDayOff} // DISABLE BUTTON SECARA HARDCODE
      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
        localAttendance[sId] === type 
          ? `bg-${color}-600 text-white shadow-md` 
          : `bg-gray-100 text-gray-500 hover:bg-${color}-50 hover:text-${color}-600`
      } ${isDayOff ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
    >
      {label}
    </button>
  );

  const absentStudents = filteredStudents.filter(s => {
    const status = localAttendance[s.id];
    return status === AttendanceStatus.SAKIT || status === AttendanceStatus.IZIN || status === AttendanceStatus.ALPA;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Absensi Harian</h1>
          <p className="text-sm text-gray-500">Isi kehadiran siswa & kirim notifikasi</p>
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border p-2 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {currentUser?.role === UserRole.ADMIN && (
             <div className="flex gap-2">
                <select 
                  value={selectedClass} 
                  onChange={e => setSelectedClass(e.target.value)}
                  className="border p-2 rounded-lg text-gray-700 bg-white"
                >
                  {['1','2','3','4','5','6'].map(c => <option key={c} value={c}>Kelas {c}</option>)}
                </select>
                <button 
                  onClick={() => setShowImport(true)}
                  className="flex items-center space-x-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 shadow-sm"
                  title="Copy Paste dari Excel"
                >
                  <Upload size={18} />
                  <span className="hidden md:inline">Import</span>
                </button>
             </div>
          )}
        </div>
      </div>

      {isDayOff ? (
        <div className="bg-red-50 border-2 border-red-200 p-10 rounded-xl flex flex-col items-center justify-center space-y-4 text-center">
          <CalendarOff size={64} className="text-red-500" />
          <div>
            <h3 className="text-2xl font-bold text-red-700">Tidak Ada Absensi</h3>
            <p className="text-red-600 font-medium text-lg mt-2">
              {holidayData ? `Hari Libur: ${holidayData.description}` : "Akhir Pekan (Sabtu / Minggu)"}
            </p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-red-100 text-red-500 text-sm shadow-sm">
             Sistem dikunci. Anda tidak dapat mengisi atau menyimpan absen pada tanggal ini.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="p-4 w-10">No</th>
                  <th className="p-4">Nama Siswa</th>
                  <th className="p-4 text-center">Kehadiran</th>
                  <th className="p-4 text-center">Notifikasi WA</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-500">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.nisn}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center space-x-2">
                        <StatusButton sId={s.id} type={AttendanceStatus.HADIR} label="H" color="green" />
                        <StatusButton sId={s.id} type={AttendanceStatus.SAKIT} label="S" color="yellow" />
                        <StatusButton sId={s.id} type={AttendanceStatus.IZIN} label="I" color="blue" />
                        <StatusButton sId={s.id} type={AttendanceStatus.ALPA} label="A" color="red" />
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {localAttendance[s.id] && localAttendance[s.id] !== AttendanceStatus.NONE && (
                        <button 
                          onClick={() => sendWhatsApp(s)}
                          className={`p-2 rounded-full transition-colors flex items-center justify-center mx-auto ${
                            sentStatus[s.id] 
                              ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                              : !s.parentPhone 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-green-600 hover:bg-green-100 bg-green-50'
                          }`}
                          title={s.parentPhone ? "Kirim WA ke Orang Tua" : "No. WA Tidak Tersedia"}
                          disabled={!s.parentPhone}
                        >
                          {sentStatus[s.id] ? <CheckCircle size={18} /> : <MessageCircle size={18} />}
                          <span className="text-xs ml-1 font-medium hidden md:inline">
                            {sentStatus[s.id] ? 'Terkirim' : 'Kirim'}
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">Belum ada siswa di kelas ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-500 italic">
               *Pastikan nomor WA orang tua sudah terisi di menu Data Siswa.
            </div>
            <div className="flex gap-2">
               <button 
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center space-x-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 shadow-md transition-colors"
                  disabled={absentStudents.length === 0}
                >
                  <Send size={18} />
                  <span>Notifikasi Absen ({absentStudents.length})</span>
                </button>
               <button 
                  onClick={handleRecapWhatsApp}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-md transition-colors"
                >
                  <Share2 size={18} />
                  <span>Rekap Grup WA</span>
                </button>
                <button 
                  onClick={handleSave}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 shadow-md transition-colors"
                >
                  <Save size={18} />
                  <span>Simpan Absensi</span>
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Send Assistant Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Smartphone className="text-orange-500" />
                Asisten Notifikasi WA
              </h3>
              <button onClick={() => setShowBulkModal(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Kirim pesan ke orang tua siswa yang tidak hadir secara berurutan.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {absentStudents.length > 0 ? absentStudents.map((s, idx) => {
                 const st = localAttendance[s.id];
                 const color = st === 'S' ? 'bg-yellow-100 text-yellow-700' : st === 'I' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700';
                 
                 return (
                  <div key={s.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                       <span className="text-sm font-mono text-gray-400 w-6">{idx+1}.</span>
                       <div>
                         <p className="font-bold text-gray-800">{s.name}</p>
                         <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${color}`}>
                           {st === 'S' ? 'Sakit' : st === 'I' ? 'Izin' : 'Alpa'}
                         </span>
                       </div>
                    </div>
                    
                    <button 
                      onClick={() => sendWhatsApp(s)}
                      disabled={!s.parentPhone}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                         sentStatus[s.id] 
                         ? 'bg-gray-100 text-gray-500 border border-gray-200' 
                         : !s.parentPhone 
                           ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                           : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                      }`}
                    >
                      {sentStatus[s.id] ? <CheckCircle size={14} /> : <MessageCircle size={14} />}
                      {sentStatus[s.id] ? 'Terkirim' : 'Kirim WA'}
                    </button>
                  </div>
                 );
              }) : (
                <div className="text-center py-8 text-gray-500">
                  Semua siswa hadir atau belum absen.
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t flex justify-end">
               <button onClick={() => setShowBulkModal(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
                 Tutup
               </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL MODAL */}
      {showImport && currentUser?.role === UserRole.ADMIN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Upload className="text-green-600" />
                Import Absensi (Copy-Paste)
              </h3>
              <button onClick={() => setShowImport(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-4 border border-blue-100">
              <p className="font-bold mb-1">Panduan Format Excel:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Kolom 1: <strong>NISN</strong> atau <strong>Nama Siswa</strong></li>
                <li>Kolom 2: <strong>Status</strong> (H, S, I, A)</li>
                <li>Contoh: <code className="bg-white px-1 rounded">0012345678  S</code></li>
              </ul>
            </div>

            <textarea 
              className="w-full h-40 border p-3 rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none resize-none" 
              placeholder={"0012345678\tS\nBudi Santoso\tI\n..."}
              value={importText}
              onChange={e => setImportText(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-4">
               <button onClick={() => setShowImport(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
               <button onClick={handleImport} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg shadow-green-500/30">
                 Proses Input
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceDaily;
