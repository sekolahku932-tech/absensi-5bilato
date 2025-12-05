
import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { Save, Cloud, RefreshCw, CheckCircle, Copy, Download, AlertTriangle } from 'lucide-react';
import { DEFAULT_SCRIPT_URL } from '../constants';

const Settings: React.FC = () => {
  const { googleScriptUrl, setGoogleScriptUrl, syncToCloud, syncFromCloud, isSyncing, lastSync } = useApp();
  const [urlInput, setUrlInput] = useState(googleScriptUrl || DEFAULT_SCRIPT_URL);
  const [statusMsg, setStatusMsg] = useState('');

  // Update input if store changes (e.g., initial load)
  useEffect(() => {
    if (googleScriptUrl) setUrlInput(googleScriptUrl);
  }, [googleScriptUrl]);

  const handleSave = () => {
    setGoogleScriptUrl(urlInput);
    setStatusMsg('URL berhasil disimpan.');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleTestSync = async () => {
    if (!urlInput) {
      setStatusMsg('Masukkan URL terlebih dahulu.');
      return;
    }
    // Save URL first just in case
    setGoogleScriptUrl(urlInput);
    
    const success = await syncToCloud();
    if (success) {
      setStatusMsg('Koneksi berhasil! Data tersimpan di Spreadsheet.');
    } else {
      setStatusMsg('Koneksi gagal. Pastikan anda terhubung internet dan URL benar.');
    }
  };

  const googleAppsScriptCode = `
/**
 * ABSENSI SISWA SD NEGERI 5 BILATO - GOOGLE APPS SCRIPT
 * 
 * INSTRUKSI INSTALASI:
 * 1. Buat Spreadsheet baru di Google Sheets (https://sheets.google.com).
 * 2. Pergi ke menu: Extensions > Apps Script.
 * 3. Hapus semua kode yang ada di editor (biasanya myFunction).
 * 4. Salin dan tempel SELURUH kode di bawah ini.
 * 5. Klik tombol "Deploy" (Warna Biru) > "New Deployment".
 * 6. Klik ikon Roda Gigi (Select type) > Pilih "Web App".
 * 7. Isi konfigurasi:
 *    - Description: Absensi API v1
 *    - Execute as: Me (Saya)
 *    - Who has access: Anyone (Siapa saja)  <-- PENTING!
 * 8. Klik "Deploy".
 * 9. Salin "Web App URL" yang muncul (akhiran /exec).
 * 10. Paste URL tersebut di menu Pengaturan aplikasi Absensi Siswa.
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // Lock untuk mencegah konflik data saat banyak request bersamaan
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // Tunggu antrian maksimal 30 detik

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var action = e.parameter.action;
    var requestData = null;

    // Parsing data POST (untuk write)
    if (e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
        if (!action && requestData.action) action = requestData.action;
      } catch (err) {
        // Abaikan jika bukan JSON valid
      }
    }

    // === ACTION: READ (Ambil Data ke Aplikasi) ===
    if (action == 'read') {
      var result = {};
      var sheetNames = ['Students', 'Teachers', 'Attendance', 'Alumni', 'Holidays', 'AcademicYears'];
      
      sheetNames.forEach(function(name) {
        var sheet = doc.getSheetByName(name);
        if (!sheet) {
          result[name] = [];
        } else {
          var range = sheet.getDataRange();
          var values = range.getValues();
          if (values.length > 1) {
            var headers = values[0];
            var rows = values.slice(1);
            result[name] = rows.map(function(row) {
              var obj = {};
              headers.forEach(function(header, index) {
                if(header) {
                   var val = row[index];
                   // Coba parse JSON jika string terlihat seperti array/object
                   try {
                     if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                       val = JSON.parse(val);
                     }
                   } catch(e) {}
                   obj[header] = val;
                }
              });
              return obj;
            });
          } else {
            result[name] = [];
          }
        }
      });
      
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // === ACTION: WRITE (Simpan Data dari Aplikasi) ===
    if (action == 'write') {
      if (!requestData || !requestData.data) {
        throw new Error("Data tidak ditemukan dalam request");
      }
      var data = requestData.data;
      
      Object.keys(data).forEach(function(sheetName) {
        var sheet = doc.getSheetByName(sheetName);
        if (!sheet) { 
          sheet = doc.insertSheet(sheetName); 
        } else {
          sheet.clear(); // Hapus data lama (Full Sync)
        }
        
        var rowsData = data[sheetName];
        if (rowsData && rowsData.length > 0) {
          // 1. Kumpulkan semua header unik dari seluruh object (untuk handle field opsional)
          var headerSet = {};
          rowsData.forEach(function(row) {
            Object.keys(row).forEach(function(k) { headerSet[k] = true; });
          });
          var headers = Object.keys(headerSet);
          
          // 2. Tulis Header
          sheet.appendRow(headers);
          
          // 3. Tulis Baris Data
          var values = rowsData.map(function(item) {
            return headers.map(function(header) {
              var val = item[header];
              // Ubah undefined/null jadi string kosong
              if (val === undefined || val === null) return "";
              // Stringify object/array agar masuk ke 1 sel
              if (typeof val === 'object') return JSON.stringify(val);
              return val;
            });
          });
          
          if (values.length > 0) {
             // Tulis dalam batch agar cepat
             sheet.getRange(2, 1, values.length, headers.length).setValues(values);
          }
        }
      });
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', message: 'Data berhasil disimpan'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Action tidak dikenal'}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: e.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`;

  const copyCode = () => {
    navigator.clipboard.writeText(googleAppsScriptCode.trim());
    alert('Kode berhasil disalin!');
  };

  const downloadCode = () => {
    const blob = new Blob([googleAppsScriptCode.trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Integrasi Spreadsheet</h1>
        <p className="text-gray-500">Hubungkan aplikasi dengan Google Sheets untuk backup database.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Config */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
            <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Cloud size={20} className="text-blue-600" />
              1. Konfigurasi URL
            </h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4 border border-blue-100">
                <p><strong>URL Script Default telah diatur:</strong></p>
                <p className="text-xs mt-1 text-blue-600 break-all">{DEFAULT_SCRIPT_URL}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Web App URL (Editable)</label>
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono text-gray-600"
                />
              </div>
              
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleSave}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save size={18} /> Simpan URL
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleTestSync}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    Upload (Backup)
                  </button>
                  <button 
                    onClick={() => syncFromCloud()}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm"
                  >
                    <Cloud size={16} /> Ambil (Restore)
                  </button>
                </div>
              </div>

              {statusMsg && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-pulse ${statusMsg.includes('gagal') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {statusMsg.includes('gagal') ? <AlertTriangle size={16}/> : <CheckCircle size={16} />} 
                  {statusMsg}
                </div>
              )}

              {lastSync && (
                <div className="text-xs text-gray-400 text-center mt-2 pt-4 border-t">
                  Terakhir sinkronisasi: <br/><span className="font-medium text-gray-600">{lastSync}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Code & Guide */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-700">2. Kode Script (Jika perlu deploy ulang)</h2>
            <div className="flex gap-2">
              <button onClick={downloadCode} className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1.5 rounded transition-colors" title="Download file .gs">
                <Download size={14} />
              </button>
              <button onClick={copyCode} className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded font-medium transition-colors">
                <Copy size={14} /> Salin Kode
              </button>
            </div>
          </div>
          
          <div className="flex-1 relative border rounded-lg bg-gray-900 overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 right-0 bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
              <span className="text-xs text-gray-400 font-mono">Code.gs</span>
            </div>
            <pre className="flex-1 p-4 pt-10 text-[10px] md:text-xs text-green-400 overflow-auto font-mono leading-relaxed h-64 md:h-auto custom-scrollbar">
              {googleAppsScriptCode.trim()}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
