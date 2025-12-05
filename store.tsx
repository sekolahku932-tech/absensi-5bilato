
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  AppState, Student, Teacher, AttendanceRecord, AcademicYear, 
  Holiday, Headmaster, UserRole, Alumni, AlumniReason 
} from './types';
import { 
  INITIAL_STUDENTS, INITIAL_TEACHERS, INITIAL_YEARS, 
  INITIAL_HOLIDAYS, INITIAL_HEADMASTER, DEFAULT_SCRIPT_URL 
} from './constants';

interface AppContextType extends AppState {
  login: (role: UserRole, data?: any) => void;
  logout: () => void;
  addStudent: (s: Student) => void;
  updateStudent: (s: Student) => void;
  deleteStudent: (id: string) => void;
  promoteStudent: (id: string, newClassId: string, newYearId: string) => void;
  moveToAlumni: (studentId: string, reason: AlumniReason, date: string) => void;
  markAttendance: (records: AttendanceRecord[]) => void;
  updateHeadmaster: (h: Headmaster) => void;
  addTeacher: (t: Teacher) => void;
  updateTeacher: (t: Teacher) => void;
  deleteTeacher: (id: string) => void;
  setAcademicYear: (id: string) => void;
  addAcademicYear: (name: string) => void;
  deleteAcademicYear: (id: string) => void;
  toggleHoliday: (h: Holiday) => void;
  deleteHoliday: (id: string) => void;
  
  // Sync
  setGoogleScriptUrl: (url: string) => void;
  syncToCloud: (silent?: boolean) => Promise<boolean>;
  syncFromCloud: () => Promise<boolean>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(INITIAL_YEARS);
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [headmaster, setHeadmaster] = useState<Headmaster>(INITIAL_HEADMASTER);
  const [currentUser, setCurrentUser] = useState<AppState['currentUser']>(null);
  
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>(DEFAULT_SCRIPT_URL);
  const [lastSync, setLastSync] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Refs for Sync to access latest state
  const stateRef = useRef({
    students, teachers, attendance, alumni, academicYears, holidays
  });

  useEffect(() => {
    stateRef.current = { students, teachers, attendance, alumni, academicYears, holidays };
  }, [students, teachers, attendance, alumni, academicYears, holidays]);

  // Real-time Persistence (Local Storage)
  useEffect(() => {
    const saved = localStorage.getItem('absensi_app_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.students) setStudents(parsed.students);
        if (parsed.teachers) setTeachers(parsed.teachers);
        if (parsed.attendance) setAttendance(parsed.attendance);
        if (parsed.alumni) setAlumni(parsed.alumni);
        if (parsed.academicYears) setAcademicYears(parsed.academicYears);
        if (parsed.holidays) setHolidays(parsed.holidays);
        if (parsed.headmaster) setHeadmaster(parsed.headmaster);
        if (parsed.googleScriptUrl) setGoogleScriptUrl(parsed.googleScriptUrl);
        if (parsed.lastSync) setLastSync(parsed.lastSync);
      } catch (e) { console.error("Failed to load data", e); }
    } else {
        setGoogleScriptUrl(DEFAULT_SCRIPT_URL);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('absensi_app_data', JSON.stringify({ 
      students, teachers, attendance, alumni, academicYears, holidays, headmaster, googleScriptUrl, lastSync
    }));
  }, [students, teachers, attendance, alumni, academicYears, holidays, headmaster, googleScriptUrl, lastSync]);

  const login = (role: UserRole, data?: any) => {
    if (role === UserRole.ADMIN) {
      setCurrentUser({ role, name: 'Administrator' });
    } else if (role === UserRole.WALI_KELAS) {
      setCurrentUser({ role, id: data.id, name: data.name, classId: data.classId });
    } else if (role === UserRole.ORANG_TUA) {
      setCurrentUser({ role, name: 'Orang Tua Siswa', id: data.nisn }); 
    }
  };

  const logout = () => setCurrentUser(null);

  const addStudent = (s: Student) => setStudents([...students, s]);
  const updateStudent = (s: Student) => setStudents(students.map(st => st.id === s.id ? s : st));
  const deleteStudent = (id: string) => setStudents(students.filter(s => s.id !== id));

  const moveToAlumni = (studentId: string, reason: AlumniReason, date: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const activeYear = academicYears.find(y => y.isActive)?.name || 'Unknown';
    const newAlumni: Alumni = {
      ...student,
      reason,
      dateLeft: date,
      lastClassId: student.classId,
      academicYear: activeYear
    };
    
    setAlumni([...alumni, newAlumni]);
    setStudents(students.filter(s => s.id !== studentId));
  };

  const promoteStudent = (id: string, newClassId: string, newYearId: string) => {
     setStudents(prev => prev.map(s => s.id === id ? { ...s, classId: newClassId } : s));
  };

  const markAttendance = (records: AttendanceRecord[]) => {
    setAttendance(prev => {
      const filtered = prev.filter(p => !records.some(r => r.studentId === p.studentId && r.date === p.date));
      return [...filtered, ...records];
    });
  };

  const updateHeadmaster = (h: Headmaster) => setHeadmaster(h);
  
  const addTeacher = (t: Teacher) => setTeachers([...teachers, t]);
  const updateTeacher = (t: Teacher) => setTeachers(teachers.map(x => x.id === t.id ? t : x));
  const deleteTeacher = (id: string) => setTeachers(teachers.filter(x => x.id !== id));

  const setAcademicYear = (id: string) => {
    setAcademicYears(academicYears.map(y => ({ ...y, isActive: y.id === id })));
  };

  const addAcademicYear = (name: string) => {
    setAcademicYears([...academicYears, { id: Date.now().toString(), name, isActive: false }]);
  };

  const deleteAcademicYear = (id: string) => {
    setAcademicYears(academicYears.filter(y => y.id !== id));
  };

  const toggleHoliday = (h: Holiday) => setHolidays([...holidays, h]);
  const deleteHoliday = (id: string) => setHolidays(holidays.filter(h => h.id !== id));

  // --- SYNC LOGIC ---

  const syncToCloud = async (silent = false) => {
    if (!googleScriptUrl) return false;
    setIsSyncing(true);
    try {
      const payload = {
        action: 'write',
        data: {
          Students: stateRef.current.students,
          Teachers: stateRef.current.teachers,
          Attendance: stateRef.current.attendance,
          Alumni: stateRef.current.alumni,
          Holidays: stateRef.current.holidays,
          AcademicYears: stateRef.current.academicYears
        }
      };

      await fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const now = new Date().toLocaleString();
      setLastSync(now);
      return true;
    } catch (e) {
      if (!silent) console.error("Sync Error", e);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncFromCloud = async () => {
    if (!googleScriptUrl) return false;
    setIsSyncing(true);
    try {
      const response = await fetch(googleScriptUrl, {
        method: 'POST', 
        body: JSON.stringify({ action: 'read' })
      });
      
      const data = await response.json();
      
      if (data) {
        if (data.Students) setStudents(data.Students);
        if (data.Teachers) setTeachers(data.Teachers);
        if (data.Attendance) setAttendance(data.Attendance);
        if (data.Alumni) setAlumni(data.Alumni);
        if (data.Holidays) setHolidays(data.Holidays);
        if (data.AcademicYears) setAcademicYears(data.AcademicYears);
        
        const now = new Date().toLocaleString();
        setLastSync(now);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Sync Error", e);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <AppContext.Provider value={{
      students, teachers, attendance, academicYears, holidays, headmaster, currentUser, alumni,
      googleScriptUrl, lastSync, isSyncing,
      login, logout, addStudent, updateStudent, deleteStudent, promoteStudent, moveToAlumni,
      markAttendance, updateHeadmaster, addTeacher, updateTeacher, deleteTeacher,
      setAcademicYear, addAcademicYear, deleteAcademicYear, toggleHoliday, deleteHoliday,
      setGoogleScriptUrl, syncToCloud, syncFromCloud
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
