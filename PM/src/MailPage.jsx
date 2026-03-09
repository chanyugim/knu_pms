// src/MailPage.jsx
import { useState, useEffect } from 'react';
import DesktopTableView from './DesktopTableView';
import MobileCardView from './MobileCardView';
import miniLogo from '/d.ico';

// 검색어 확장 함수
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

export default function MailPage({ isAdminMode, setIsAdminMode }) {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [aliasMap, setAliasMap] = useState({});
  const [editableData, setEditableData] = useState([]); 
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isScanning, setIsScanning] = useState(false);

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
    }).catch(err => console.error("데이터 통신 에러:", err));
  }, []);

  // 관리자 기능 함수들
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
        alert("데이터가 성공적으로 업데이트되었습니다!");
        setEmployees(editableData); 
        setIsAdminMode(false); 
      }
    } catch (error) {
      alert("통신 오류가 발생했습니다.");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      // 우리가 방금 만든 백엔드 OCR 주소로 전송
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        
        // 🌟 네이버가 읽어온 텍스트(예: "충남 천안시 동남구 ... 홍길동")를 검색창에 쏙 넣어줌
        // 사용자가 불필요한 주소를 지우고 이름만 남기기 편하게 세팅
        setSearchTerm(data.text); 
      } else {
        alert("글자 인식에 실패했습니다.");
      }
    } catch (error) {
      alert("서버 통신 오류가 발생했습니다.");
    } finally {
      setIsScanning(false);
      e.target.value = ''; // 다음 스캔을 위해 인풋 초기화
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
            <button onClick={() => setIsAdminMode(false)} style={{ 
              padding: '8px 12px', 
              fontSize: '14px', 
              whiteSpace: 'nowrap', /* 강제 줄바꿈 방지 */
              borderRadius: '6px',
              border: '1px solid #ccc'
            }}>돌아가기</button>
          </div>
          <h2 style={{ margin: 0, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 'clamp(16px, 4vw, 22px)' }}>우편물 데이터 관리</h2>
          <div style={{ justifySelf: 'end' }}>
            <button onClick={handleSaveChanges} style={{ 
              backgroundColor: '#ff4757', color: 'white', fontWeight: 'bold', 
              padding: '8px 12px', fontSize: '14px', whiteSpace: 'nowrap', borderRadius: '6px', border: 'none'
            }}>
              💾 저장
            </button>
          </div>
        </div>
        <button onClick={handleAdd} style={{ 
          width: '100%', /* 화면 가로를 꽉 채움 */
          padding: '15px', /* 상하 두께를 두툼하게 (터치 영역 확보) */
          marginBottom: '20px', 
          backgroundColor: '#2ed573', 
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '10px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(46, 213, 115, 0.2)' /* 살짝 그림자를 주어 버튼처럼 보이게 함 */
        }}>+ 새 데이터 추가</button>
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }}>
          {editableData.map((item) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '15px', borderBottom: '1px solid #ccc', marginBottom: '10px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={item.department || ''} placeholder="부서 (예: 컴퓨터공학과)" onChange={(e) => handleEditChange(item.id, 'department', e.target.value)} style={{ flex: 1, padding: '8px' }} />
                <input type="text" value={item.room || ''} placeholder="호실 (예: 6공학관 4층)" onChange={(e) => handleEditChange(item.id, 'room', e.target.value)} style={{ flex: 1, padding: '8px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={item.name || ''} placeholder="이름/직책" onChange={(e) => handleEditChange(item.id, 'name', e.target.value)} style={{ flex: 1, padding: '8px' }} />
                <input type="text" value={item.phone || ''} placeholder="내선번호 (예: 1234)" onChange={(e) => handleEditChange(item.id, 'phone', e.target.value)} style={{ flex: 1, padding: '8px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={item.tags || ''} placeholder="추가 검색태그 (예: 학과장님)" onChange={(e) => handleEditChange(item.id, 'tags', e.target.value)} style={{ flex: 1, padding: '8px' }} />
                <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#ff6b81', color: 'white', whiteSpace: 'nowrap', padding: '8px 15px', borderRadius: '6px', border: 'none' }}>
                  삭제
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ margin: '20px 20px 0 20px', padding: '10px 20px 20px 20px', borderBottom: '1px solid #ddd' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 15px 0' }}>우편물 수신자 검색</h2>
        <div style={{ 
          display: 'flex', 
          alignItems: 'stretch',
          border: '2px solid #1e90ff',
          borderRadius: '12px',
          backgroundColor: '#fff',
          overflow: 'hidden',
          boxShadow: '0 4px 6px rgba(30, 144, 255, 0.1)'
        }}>
          <input 
            type="text" 
            placeholder={isScanning ? "이미지 분석 중입니다..." : "이름, 호실 입력..."} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isScanning}
            style={{ 
              flex: 1, 
              padding: '15px', 
              fontSize: '16px', 
              border: 'none',
              color: '#333',
              outline: 'none',
              backgroundColor: 'transparent'
            }}
          />
          <div style={{
            position: 'relative', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#1e90ff',
            color: 'white', 
            padding: '0 20px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            whiteSpace: 'nowrap', 
            opacity: isScanning ? 0.6 : 1
          }}>
            {isScanning ? '⏳' : '📷 스캔'}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              disabled={isScanning}
              style={{ 
                position: 'absolute', 
                top: 0, left: 0, 
                width: '100%', height: '100%', 
                opacity: 0, 
                cursor: 'pointer' 
              }} 
            />
          </div>
        </div>
      </div>
      <div style={{ padding: '20px' }}>
        {filteredEmployees.length > 0 ? (
          isMobile ? (
            <MobileCardView data={filteredEmployees} />
          ) : (
            <DesktopTableView data={filteredEmployees} />
          )
        ) : (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#888', fontSize: '16px' }}>
            {searchTerm ? '검색 결과가 없습니다.' : '이름, 호실을 입력하거나 송장을 스캔해주세요.'}
          </div>
        )}
      </div>
    </>
  );
}