import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';

export default function SecurityPage({ isAdminMode, setIsAdminMode }) {
  const [securityData, setSecurityData] = useState([]);
  const [editableData, setEditableData] = useState([]);
  
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const todayIndex = new Date().getDay();
  const initialDay = (todayIndex === 0 || todayIndex === 6) ? '월' : days[todayIndex]; 
  const [selectedDay, setSelectedDay] = useState(initialDay);

  const [showIosModal, setShowIosModal] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  useEffect(() => {
    fetch('/api/security')
      .then(res => res.json())
      .then(data => {
        setSecurityData(data);
        setEditableData(JSON.parse(JSON.stringify(data))); 
      })
      .catch(err => console.error("데이터 로드 실패:", err));
  }, []);

  const handleCaptureBuilding = async (buildingId, buildingName) => {
    const element = document.getElementById(`building-${buildingId}`);
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
      const imageURL = canvas.toDataURL("image/png");

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS) {
        setPreviewImage(imageURL);
        setShowIosModal(true);
      } else {
        const link = document.createElement("a");
        link.href = imageURL;
        link.download = `문단속_${buildingName}_${selectedDay}요일.png`;
        link.click();
      }
    } catch (error) {
      alert("이미지 저장 실패");
    }
  };

  const handleAddBuilding = () => {
    const newId = editableData.length > 0 ? Math.max(...editableData.map(d => d.id || 0)) + 1 : 1;
    setEditableData([...editableData, { id: newId, building: '새 공학관', defaultRooms: [], exceptions: { "월": [], "화": [], "수": [], "목": [], "금": [] } }]);
  };

  const handleDeleteBuilding = (id) => {
    if (window.confirm("항목을 삭제하시겠습니까?")) {
      setEditableData(prev => prev.filter(item => item.id !== id));
    }
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const newData = [...editableData];
    const temp = newData[index - 1];
    newData[index - 1] = newData[index];
    newData[index] = temp;
    setEditableData(newData);
  };

  const moveDown = (index) => {
    if (index === editableData.length - 1) return;
    const newData = [...editableData];
    const temp = newData[index + 1];
    newData[index + 1] = newData[index];
    newData[index] = temp;
    setEditableData(newData);
  };

  const textToArray = (text) => {
    if (!text) return [];
    if (Array.isArray(text)) return text;
    return text.split(',').map(s => s.trim()).filter(s => s !== '');
  };

  const handleSaveChanges = async () => {
    if (!window.confirm("데이터를 저장하시겠습니까?")) return;

    const finalDataToSave = editableData.map(bldg => ({
      ...bldg,
      defaultRooms: textToArray(bldg.defaultRooms),
      exceptions: {
        "월": textToArray(bldg.exceptions["월"]), "화": textToArray(bldg.exceptions["화"]),
        "수": textToArray(bldg.exceptions["수"]), "목": textToArray(bldg.exceptions["목"]),
        "금": textToArray(bldg.exceptions["금"]),
      }
    }));

    try {
      const response = await fetch('/api/security/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalDataToSave),
      });
      if (response.ok) {
        alert("저장되었습니다.");
        setSecurityData(finalDataToSave);
        setEditableData(JSON.parse(JSON.stringify(finalDataToSave)));
        setIsAdminMode(false);
      }
    } catch (error) {
      alert("통신 오류가 발생했습니다.");
    }
  };

  const getFloorName = (room) => {
    const match = room.match(/(?:지하|B)?(\d+)/i);
    if (match) {
      const numStr = match[1];
      const isBasement = /지하|B/i.test(room);
      let floorNum = numStr;
      if (numStr.length >= 3) floorNum = numStr.slice(0, -2);
      return (isBasement ? '지하 ' : '') + floorNum + '층';
    }
    return '기타'; 
  };

  const sortFloors = (a, b) => {
    if (a === '기타') return 1;
    if (b === '기타') return -1;
    const parseFloor = (floorStr) => {
      const isBasement = floorStr.includes('지하');
      const num = parseInt(floorStr.replace(/[^0-9]/g, ''), 10);
      return isBasement ? -num : num;
    };
    return parseFloor(a) - parseFloor(b);
  };

  if (isAdminMode) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '20px', width: '100%', gap: '5px' }}>
          <div style={{ justifySelf: 'start' }}>
            <button onClick={() => setIsAdminMode(false)} style={{ padding: '8px 12px', fontSize: '14px', whiteSpace: 'nowrap', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}>돌아가기</button>
          </div>
          <h2 style={{ margin: 0, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 'clamp(16px, 4vw, 22px)' }}>🔑 문단속 데이터</h2>
          <div style={{ justifySelf: 'end' }}>
            <button onClick={handleSaveChanges} style={{ backgroundColor: '#ff4757', color: 'white', fontWeight: 'bold', padding: '8px 12px', fontSize: '14px', whiteSpace: 'nowrap', borderRadius: '6px', border: 'none' }}>💾 저장</button>
          </div>
        </div>
        <button onClick={handleAddBuilding} style={{ width: '100%', padding: '15px', marginBottom: '20px', backgroundColor: '#2ed573', color: 'white', fontSize: '16px', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>+ 🏢 구역 추가</button>
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }}>
          {editableData.map((bldg, index) => (
            <div key={bldg.id} style={{ padding: '15px', borderBottom: '1px solid #ccc', marginBottom: '10px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <button onClick={() => moveUp(index)} style={{ padding: '6px 10px', fontSize: '10px', border: 'none', borderRadius: '4px', backgroundColor: '#dcdde1' }}>▲</button>
                  <button onClick={() => moveDown(index)} style={{ padding: '6px 10px', fontSize: '10px', border: 'none', borderRadius: '4px', backgroundColor: '#dcdde1' }}>▼</button>
                </div>
                <input type="text" value={bldg.building} onChange={(e) => { const newData = [...editableData]; newData[index] = { ...newData[index], building: e.target.value }; setEditableData(newData); }} style={{ flex: 1, fontSize: '16px', fontWeight: 'bold', padding: '10px', minWidth: '50px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }} />
                <button onClick={() => handleDeleteBuilding(bldg.id)} style={{ padding: '10px 12px', backgroundColor: '#ff6b81', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>삭제</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                <strong style={{ whiteSpace: 'nowrap', color: '#ccc', fontSize: '14px' }}>기본 호실:</strong>
                <input type="text" value={Array.isArray(bldg.defaultRooms) ? bldg.defaultRooms.join(', ') : bldg.defaultRooms} placeholder="예: 301, 302, 303, 402, 507..." onChange={(e) => { const newData = [...editableData]; newData[index] = { ...newData[index], defaultRooms: e.target.value }; setEditableData(newData); }} style={{ flex: 1, padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }} />
              </div>
              {['월', '화', '수', '목', '금'].map(day => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                  <span style={{ width: '60px', color: '#ff7f50', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>{day} 제외:</span>
                  <input type="text" value={Array.isArray(bldg.exceptions[day]) ? bldg.exceptions[day].join(', ') : bldg.exceptions[day]} placeholder="호실 입력" onChange={(e) => { const newData = [...editableData]; newData[index] = { ...newData[index], exceptions: { ...newData[index].exceptions, [day]: e.target.value } }; setEditableData(newData); }} style={{ flex: 1, padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
      
      {showIosModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <p style={{ color: 'white', marginBottom: '15px', textAlign: 'center', lineHeight: '1.6', fontSize: '16px' }}>
            <span style={{ color: '#ff7f50', fontWeight: 'bold', fontSize: '18px' }}>iOS 저장 안내</span><br/>
            이미지를 길게 누른 후<br/>'사진 앱에 저장'을 선택해 주세요.
          </p>
          <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }} alt="문단속 캡처" />
          <button onClick={() => setShowIosModal(false)} style={{ marginTop: '20px', padding: '12px 30px', backgroundColor: '#ff4757', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>닫기</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
        {['월', '화', '수', '목', '금'].map(day => (
          <button 
            key={day} onClick={() => setSelectedDay(day)}
            style={{ 
              padding: '8px 16px', /* 좌우 여백을 늘려 터치하기 편하게 */
              fontSize: '15px', 
              fontWeight: 'bold', 
              borderRadius: '20px', /* 기존 네모에서 트렌디한 알약 모양으로 변경 */
              cursor: 'pointer', 
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease-in-out', /* 부드러운 색상 전환 효과 */
              
              // 선택된 요일 (기존 포인트 컬러 + 은은한 그림자 발광 효과)
              ...(selectedDay === day ? {
                backgroundColor: '#ff7f50', 
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 10px rgba(255, 127, 80, 0.3)'
              } 
              // 선택되지 않은 요일 (완전 흰색 배경 + 연한 회색 테두리 + 미세한 그림자)
              : {
                backgroundColor: '#ffffff', 
                color: '#57606f',
                border: '1px solid #dfe4ea',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              })
            }}
          >
            {day}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}><span style={{ color: '#ff7f50' }}>{selectedDay}요일</span> 문단속 대상</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#f5f6fa' }}>
        {securityData.map(bldg => {
          const exceptionRooms = bldg.exceptions[selectedDay] || [];
          const roomsToCheck = bldg.defaultRooms.filter(room => !exceptionRooms.includes(room));
          const groupedRooms = {};
          roomsToCheck.forEach(room => {
            const floor = getFloorName(room);
            if (!groupedRooms[floor]) groupedRooms[floor] = [];
            groupedRooms[floor].push(room);
          });

          return (
            <div id={`building-${bldg.id}`} key={bldg.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '15px', color: '#333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ff7f50', paddingBottom: '10px', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#2f3542', fontSize: '20px' }}>{bldg.building}</h3>
                <button 
                  onClick={() => handleCaptureBuilding(bldg.id, bldg.building)} 
                  style={{ backgroundColor: '#1e90ff', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                >
                  📸 이 구역만 저장
                </button>
              </div>
              
              {roomsToCheck.length > 0 ? (
                <div>
                  {Object.keys(groupedRooms).sort(sortFloors).map(floor => (
                    <div key={floor} style={{ marginBottom: '15px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#57606f', fontSize: '16px' }}>{floor}</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {groupedRooms[floor].map((room, idx) => (
                          <span key={idx} style={{ backgroundColor: '#ffeaa7', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                            {room}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#747d8c', margin: 0 }}>해당 요일 문단속 대상 없음</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}