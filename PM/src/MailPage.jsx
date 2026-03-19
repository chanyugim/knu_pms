import { useState, useEffect } from 'react';
import DesktopTableView from './DesktopTableView';
import MobileCardView from './MobileCardView';
import RegisteredMail from './RegisteredMail'; // 🌟 새로 분리된 등기 컴포넌트 임포트

const expandSearchTerm = (keyword, currentAliasMap) => {
  let terms = [keyword];
  if (currentAliasMap[keyword]) terms = [...terms, ...currentAliasMap[keyword]];
  const match = keyword.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num >= 100) terms.push(`${Math.floor(num / 100)}층`);
  }
  return terms;
};

export default function MailPage({ isAdminMode, setIsAdminMode, setIsGlobalScanning, chatNickname, setActivePage }) {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [aliasMap, setAliasMap] = useState({});
  const [editableData, setEditableData] = useState([]); 
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const [activeTab, setActiveTab] = useState('search');
  const [isScanningSearch, setIsScanningSearch] = useState(false);
  const [dots, setDots] = useState('');

  useEffect(() => {
    let interval;
    if (isScanningSearch) {
      interval = setInterval(() => {
        setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
      }, 500); 
    } else {
      setDots('');
    }
    return () => clearInterval(interval);
  }, [isScanningSearch]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/employees`).then(res => res.json()),
      fetch(`/api/aliases`).then(res => res.json())
    ]).then(([employeesData, aliasesData]) => {
      setEmployees(employeesData);
      setEditableData(employeesData);
      setAliasMap(aliasesData); 
    }).catch(err => console.error("데이터 로드 실패:", err));
  }, []);

  const handleEditChange = (id, field, value) => {
    setEditableData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDelete = (id) => {
    if (window.confirm("이 항목을 정말 삭제하시겠습니까?")) {
      setEditableData(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleAdd = () => {
    const newId = editableData.length > 0 ? Math.max(...editableData.map(d => d.id || 0)) + 1 : 1;
    setEditableData([{ id: newId, department: '', room: '', name: '', phone: '', tags: '' }, ...editableData]);
  };

  const handleSaveChanges = async () => {
    if (!window.confirm("데이터를 서버에 덮어쓰시겠습니까?")) return;
    try {
      const response = await fetch('/api/employees/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editableData),
      });
      if (response.ok) {
        alert("데이터가 업데이트되었습니다.");
        setEmployees(editableData); 
        setIsAdminMode(false); 
      }
    } catch (error) {
      alert("통신 오류 발생");
    }
  };

  const handleSearchImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanningSearch(true);
    if(setIsGlobalScanning) setIsGlobalScanning(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/ocr', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        setSearchTerm(data.text); 
      } else {
        alert("글자 인식 실패");
      }
    } catch (error) {
      alert("서버 통신 오류");
    } finally {
      setIsScanningSearch(false);
      if(setIsGlobalScanning) setIsGlobalScanning(false);
      e.target.value = ''; 
    }
  };

  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm.trim()) return false;
    const searchKeywords = searchTerm.trim().split(/\s+/);
    const empTags = [emp.name, emp.department, emp.room, emp.phone, emp.tags || ""].join(" ");
    return searchKeywords.every(keyword => {
      const expandedTerms = expandSearchTerm(keyword, aliasMap);
      return expandedTerms.some(term => empTags.includes(term));
    });
  });

  if (isAdminMode) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '20px', width: '100%', gap: '5px' }}>
          <div style={{ justifySelf: 'start' }}>
            <button onClick={() => setIsAdminMode(false)} style={{ padding: '8px 12px', fontSize: '14px', whiteSpace: 'nowrap', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333', cursor: 'pointer' }}>돌아가기</button>
          </div>
          <h2 style={{ margin: 0, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 'clamp(16px, 4vw, 22px)' }}>수신자 데이터 관리</h2>
          <div style={{ justifySelf: 'end' }}>
            <button onClick={handleSaveChanges} style={{ backgroundColor: '#ff4757', color: 'white', fontWeight: 'bold', padding: '8px 12px', fontSize: '14px', whiteSpace: 'nowrap', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>저장</button>
          </div>
        </div>
        
        <button onClick={handleAdd} style={{ width: '100%', padding: '15px', marginBottom: '20px', backgroundColor: '#2ed573', color: 'white', fontSize: '16px', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>+ 새 데이터 추가</button>
        
        <div style={{ flex: 1, overflowY: 'auto', borderRadius: '8px', paddingBottom: '20px' }}>
          {editableData.map((item) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', border: '1px solid #eee' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={item.department || ''} placeholder="부서 (예: 컴퓨터공학)" onChange={(e) => handleEditChange(item.id, 'department', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none', backgroundColor: '#fff', color: '#333' }} />
                <input type="text" value={item.room || ''} placeholder="호실 (예: 6공학관 4층)" onChange={(e) => handleEditChange(item.id, 'room', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none', backgroundColor: '#fff', color: '#333' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={item.name || ''} placeholder="이름/직책" onChange={(e) => handleEditChange(item.id, 'name', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none', backgroundColor: '#fff', color: '#333' }} />
                <input type="text" value={item.phone || ''} placeholder="내선번호 (예: 1234)" onChange={(e) => handleEditChange(item.id, 'phone', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none', backgroundColor: '#fff', color: '#333' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="text" value={item.tags || ''} placeholder="추가 검색태그 (예: 학과장님)" onChange={(e) => handleEditChange(item.id, 'tags', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none', backgroundColor: '#fff', color: '#333' }} />
                <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#ff6b81', color: 'white', whiteSpace: 'nowrap', padding: '10px 15px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      
      <style>
        {`
          .pulse-placeholder::placeholder {
            animation: pulse-opacity 1.5s infinite ease-in-out;
            color: #1e90ff;
          }
          @keyframes pulse-opacity {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}
      </style>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 20px 0' }}>
        <div style={{ position: 'relative', display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '25px', padding: '4px', width: '300px' }}>
          <div style={{
            position: 'absolute', top: '4px', bottom: '4px', left: '4px', width: 'calc(50% - 4px)',
            backgroundColor: '#fff', borderRadius: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            transform: activeTab === 'search' ? 'translateX(0)' : 'translateX(100%)', zIndex: 0
          }} />
          <button 
            onClick={() => { if (!isScanningSearch) {
              setActiveTab('search');
              setActivePage('search');
            }}}
            disabled={isScanningSearch}
            style={{ 
              flex: 1, padding: '10px 0', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', 
              backgroundColor: 'transparent', color: activeTab === 'search' ? '#1e90ff' : '#64748b', transition: 'color 0.3s ease', position: 'relative', zIndex: 1,
              cursor: isScanningSearch ? 'not-allowed' : 'pointer',
              opacity: isScanningSearch && activeTab !== 'search' ? 0.5 : 1
            }}
          >
            🔍 수신자 검색
          </button>
          <button 
            onClick={() => { if (!isScanningSearch) {
              setActiveTab('registered');
              setActivePage('registered');
            }}}
            disabled={isScanningSearch}
            style={{ 
              flex: 1, padding: '10px 0', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', 
              backgroundColor: 'transparent', color: activeTab === 'registered' ? '#2ed573' : '#64748b', transition: 'color 0.3s ease', position: 'relative', zIndex: 1,
              cursor: isScanningSearch ? 'not-allowed' : 'pointer',
              opacity: isScanningSearch && activeTab !== 'registered' ? 0.5 : 1
            }}
          >
            📦 등기 대장
          </button>
        </div>
      </div>

      {activeTab === 'search' && (
        <>
          <div style={{ margin: '20px 20px 0 20px', padding: '10px 20px 20px 20px', borderBottom: '1px solid #ddd' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 15px 0', color: '#333' }}>우편물 수신자 검색</h2>
            <div style={{ 
              display: 'flex', alignItems: 'stretch', border: '2px solid #1e90ff', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden',
              opacity: isScanningSearch ? 0.7 : 1
            }}>
              <input 
                type="text" 
                className={isScanningSearch ? "pulse-placeholder" : ""}
                placeholder={isScanningSearch ? "이미지 분석 중입니다" : "이름, 호실 입력..."} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isScanningSearch}
                style={{ flex: 1, padding: '15px', fontSize: '16px', border: 'none', color: '#333', outline: 'none', backgroundColor: 'transparent', cursor: isScanningSearch ? 'not-allowed' : 'text' }}
              />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e90ff', color: 'white', padding: '0 20px', fontWeight: 'bold', whiteSpace: 'nowrap', cursor: isScanningSearch ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                {isScanningSearch ? <span>⏳ 분석 중{dots}</span> : '📷 스캔'}
                <input type="file" accept="image/*" onChange={handleSearchImageUpload} disabled={isScanningSearch} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: isScanningSearch ? 'not-allowed' : 'pointer' }} />
              </div>
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            {searchTerm.trim() !== '' && filteredEmployees.length > 0 ? (
              isMobile ? <MobileCardView data={filteredEmployees} /> : <DesktopTableView data={filteredEmployees} />
            ) : (
              <div style={{ textAlign: 'center', marginTop: '50px', color: '#888', fontSize: '16px' }}>
                {searchTerm ? '검색 결과가 없습니다.' : '이름, 호실을 입력하거나 송장을 스캔해주세요.'}
              </div>
            )}
          </div>
        </>
      )}

      {/* 🌟 분리된 등기 컴포넌트 렌더링 */}
      {activeTab === 'registered' && (
        <RegisteredMail 
          isMobile={isMobile} 
          setIsGlobalScanning={setIsGlobalScanning} 
          chatNickname={chatNickname} 
        />
      )}

    </div>
  );
}