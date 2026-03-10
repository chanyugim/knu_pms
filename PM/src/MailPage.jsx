import { useState, useEffect } from 'react';
import DesktopTableView from './DesktopTableView';
import MobileCardView from './MobileCardView';
import { io } from 'socket.io-client'; 

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

export default function MailPage({ isAdminMode, setIsAdminMode, setIsGlobalScanning, chatNickname }) {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [aliasMap, setAliasMap] = useState({});
  const [editableData, setEditableData] = useState([]); 
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const [activeTab, setActiveTab] = useState('search');

  const [isScanningSearch, setIsScanningSearch] = useState(false);
  const [isScanningReg, setIsScanningReg] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  
  const [registeredMails, setRegisteredMails] = useState([]);
  const [manualTracking, setManualTracking] = useState('');
  const [manualRecipient, setManualRecipient] = useState('');

  const isAnyScanning = isScanningSearch || isScanningReg;

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

  const handleRegisteredImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsScanningReg(true);
    if(setIsGlobalScanning) setIsGlobalScanning(true);
    setScanProgress({ current: 1, total: files.length });

    for (let i = 0; i < files.length; i++) {
      setScanProgress({ current: i + 1, total: files.length });
      
      const formData = new FormData();
      formData.append('image', files[i]);

      try {
        const response = await fetch('/api/ocr/registered', { method: 'POST', body: formData });
        if (response.ok) {
          const data = await response.json();
          setRegisteredMails(prev => [
            {
              id: Date.now() + i, 
              time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              trackingNumber: data.trackingNumber || '미인식',
              recipient: data.recipient || '미인식'
            },
            ...prev
          ]);
        }
      } catch (error) {
        console.error("인식 오류:", error);
      }
    }

    setIsScanningReg(false);
    if(setIsGlobalScanning) setIsGlobalScanning(false);
    setScanProgress({ current: 0, total: 0 });
    e.target.value = ''; 
  };

  const handleAddManualRegistered = () => {
    if (!manualTracking.trim() && !manualRecipient.trim()) {
      alert("등기 번호나 수신자를 입력해주세요.");
      return;
    }
    setRegisteredMails(prev => [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        trackingNumber: manualTracking.trim() || '미입력',
        recipient: manualRecipient.trim() || '미입력'
      }, ...prev
    ]);
    setManualTracking('');
    setManualRecipient('');
  };

  const handleDeleteRegistered = (id) => {
    setRegisteredMails(prev => prev.filter(item => item.id !== id));
  };

  const handleExportExcel = () => {
    if (registeredMails.length === 0) return alert('내보낼 데이터가 없습니다.');

    let csvContent = "\uFEFF스캔 시간,등기 번호,수신자\n";
    registeredMails.forEach(mail => {
      csvContent += `"${mail.time}","${mail.trackingNumber}","${mail.recipient}"\n`;
    });

    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const fileName = `${month}월-${day}일 등기.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendToChat = async () => {
    if (registeredMails.length === 0) return alert('전송할 데이터가 없습니다.');

    let csvContent = "\uFEFF스캔 시간,등기 번호,수신자\n";
    registeredMails.forEach(mail => {
      csvContent += `"${mail.time}","${mail.trackingNumber}","${mail.recipient}"\n`;
    });
    
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const fileName = `${month}월-${day}일 등기.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const file = new File([blob], fileName, { type: 'text/csv' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/chat/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        
        const tempSocket = io(); 
        const senderName = chatNickname && chatNickname.trim() !== '' ? chatNickname : "익명";
        
        const messageData = {
          sender: senderName,
          fileUrl: data.url,
          fileName: fileName,
          type: 'file',
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };
        
        tempSocket.emit('sendMessage', messageData);
        alert('채팅방으로 파일이 전송되었습니다! 다른 기기의 채팅방에서 확인해주세요.');
        
        setTimeout(() => tempSocket.disconnect(), 1000); 
      } else {
        alert("파일 업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("채팅방 전송 오류:", error);
      alert("서버 통신 오류로 전송하지 못했습니다.");
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
            <button onClick={() => setIsAdminMode(false)} style={{ padding: '8px 12px', fontSize: '14px', whiteSpace: 'nowrap', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', color: '#333' }}>돌아가기</button>
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
                <input type="text" value={item.department || ''} placeholder="부서 (예: 컴퓨터공학)" onChange={(e) => handleEditChange(item.id, 'department', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none' }} />
                <input type="text" value={item.room || ''} placeholder="호실 (예: 6공학관 4층)" onChange={(e) => handleEditChange(item.id, 'room', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={item.name || ''} placeholder="이름/직책" onChange={(e) => handleEditChange(item.id, 'name', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none' }} />
                <input type="text" value={item.phone || ''} placeholder="내선번호 (예: 1234)" onChange={(e) => handleEditChange(item.id, 'phone', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="text" value={item.tags || ''} placeholder="추가 검색태그 (예: 학과장님)" onChange={(e) => handleEditChange(item.id, 'tags', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none' }} />
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
      
      {/* 🌟 순수 CSS 기반 멈추지 않는 점(...) 애니메이션 삽입 */}
      <style>
        {`
          .loading-dots::after {
            content: '';
            display: inline-block;
            width: 1em;
            text-align: left;
            animation: dot-keyframes 1.5s infinite step-start;
          }
          @keyframes dot-keyframes {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
            100% { content: ''; }
          }
          /* placeholder 텍스트용 임시 애니메이션 효과 (입력창 투명도 깜빡임) */
          @keyframes pulse-opacity {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
          .pulse-placeholder::placeholder {
            animation: pulse-opacity 1.5s infinite ease-in-out;
            color: #1e90ff;
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
            onClick={() => { if (!isAnyScanning) setActiveTab('search'); }}
            disabled={isAnyScanning}
            style={{ 
              flex: 1, padding: '10px 0', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', 
              backgroundColor: 'transparent', color: activeTab === 'search' ? '#1e90ff' : '#64748b', transition: 'color 0.3s ease', position: 'relative', zIndex: 1,
              cursor: isAnyScanning ? 'not-allowed' : 'pointer',
              opacity: isAnyScanning && activeTab !== 'search' ? 0.5 : 1
            }}
          >
            🔍 수신자 검색
          </button>
          <button 
            onClick={() => { if (!isAnyScanning) setActiveTab('registered'); }}
            disabled={isAnyScanning}
            style={{ 
              flex: 1, padding: '10px 0', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', 
              backgroundColor: 'transparent', color: activeTab === 'registered' ? '#2ed573' : '#64748b', transition: 'color 0.3s ease', position: 'relative', zIndex: 1,
              cursor: isAnyScanning ? 'not-allowed' : 'pointer',
              opacity: isAnyScanning && activeTab !== 'registered' ? 0.5 : 1
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
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e90ff', color: 'white', padding: '0 20px', fontWeight: 'bold', whiteSpace: 'nowrap', cursor: isScanningSearch ? 'not-allowed' : 'pointer' }}>
                {/* CSS 클래스 연동 */}
                {isScanningSearch ? <span className="loading-dots">⏳ 분석 중</span> : '📷 스캔'}
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

      {activeTab === 'registered' && (
        <div style={{ margin: '20px', padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, color: '#333', fontSize: '18px' }}>📦 등기 대장 기록</h2>
            <div style={{ 
              position: 'relative', backgroundColor: '#2ed573', color: 'white', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px',
              cursor: isScanningReg ? 'not-allowed' : 'pointer',
              opacity: isScanningReg ? 0.7 : 1
            }}>
              {/* CSS 클래스 연동 */}
              {isScanningReg ? (
                <span><span className="loading-dots">⏳ 분석 중</span> ({scanProgress.current}/{scanProgress.total})</span>
              ) : '📷 송장 스캔'}
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleRegisteredImageUpload} 
                disabled={isScanningReg} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: isScanningReg ? 'not-allowed' : 'pointer' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', opacity: isScanningReg ? 0.5 : 1 }}>
            <input type="text" placeholder="등기 번호 입력" value={manualTracking} onChange={(e) => setManualTracking(e.target.value)} disabled={isScanningReg} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none', cursor: isScanningReg ? 'not-allowed' : 'text' }} />
            <input type="text" placeholder="수신자" value={manualRecipient} onChange={(e) => setManualRecipient(e.target.value)} disabled={isScanningReg} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none', cursor: isScanningReg ? 'not-allowed' : 'text' }} />
            <button onClick={handleAddManualRegistered} disabled={isScanningReg} style={{ padding: '0 15px', backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', whiteSpace: 'nowrap', cursor: isScanningReg ? 'not-allowed' : 'pointer' }}>추가</button>
          </div>

          {registeredMails.length > 0 ? (
            <>
              <div style={{ borderTop: '1px solid #eee', paddingTop: '10px', marginBottom: '15px', maxHeight: '300px', overflowY: 'auto' }}>
                {registeredMails.map((mail) => (
                  <div key={mail.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f1f2f6', fontSize: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 'bold', color: '#2f3542' }}>{mail.trackingNumber}</span>
                      <span style={{ color: '#57606f' }}>{mail.recipient} <span style={{ fontSize: '12px', color: '#a4b0be', marginLeft: '5px' }}>({mail.time})</span></span>
                    </div>
                    <button onClick={() => handleDeleteRegistered(mail.id)} disabled={isScanningReg} style={{ background: 'none', border: 'none', color: '#ff4757', fontWeight: 'bold', padding: '5px', cursor: isScanningReg ? 'not-allowed' : 'pointer', opacity: isScanningReg ? 0.5 : 1 }}>삭제</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleExportExcel} disabled={isScanningReg} style={{ flex: 1, padding: '12px', backgroundColor: '#f1f2f6', color: '#2f3542', borderRadius: '8px', border: '1px solid #ddd', fontWeight: 'bold', cursor: isScanningReg ? 'not-allowed' : 'pointer', opacity: isScanningReg ? 0.5 : 1 }}>
                  기기에 저장 (.csv)
                </button>
                <button onClick={handleSendToChat} disabled={isScanningReg} style={{ flex: 1, padding: '12px', backgroundColor: '#1e90ff', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: isScanningReg ? 'not-allowed' : 'pointer', opacity: isScanningReg ? 0.5 : 1 }}>
                  채팅방으로 전송 (.csv)
                </button>
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', color: '#888', margin: '40px 0', fontSize: '14px' }}>등록된 등기 우편물이 없습니다.</p>
          )}
        </div>
      )}

    </div>
  );
}