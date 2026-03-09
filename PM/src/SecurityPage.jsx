import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';

export default function SecurityPage({ isAdminMode, setIsAdminMode }) {
  const [securityData, setSecurityData] = useState([]);
  const [editableData, setEditableData] = useState([]);
  const captureRef = useRef(null);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const todayIndex = new Date().getDay();
  const initialDay = (todayIndex === 0 || todayIndex === 6) ? '월' : days[todayIndex]; 
  
  const [selectedDay, setSelectedDay] = useState(initialDay);

  useEffect(() => {
    fetch('/api/security')
      .then(res => res.json())
      .then(data => {
        setSecurityData(data);
        setEditableData(JSON.parse(JSON.stringify(data))); 
      })
      .catch(err => console.error("문단속 데이터 통신 에러:", err));
  }, []);

  const handleDownloadImage = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        backgroundColor: '#f5f6fa'
      });
      
      const imageURL = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imageURL;
      link.download = `문단속_체크리스트_${selectedDay}요일.png`;
      link.click();
    } catch (error) {
      console.error("이미지 저장 실패:", error);
      alert("이미지 저장에 실패했습니다.");
    }
  };

  const handleAddBuilding = () => {
    const newId = editableData.length > 0 ? Math.max(...editableData.map(d => d.id || 0)) + 1 : 1;
    setEditableData([...editableData, {
      id: newId,
      building: '새 공학관',
      defaultRooms: [],
      exceptions: { "월": [], "화": [], "수": [], "목": [], "금": [] }
    }]);
  };

  const handleDeleteBuilding = (id) => {
    if (window.confirm("이 건물의 문단속 데이터를 삭제하시겠습니까?")) {
      setEditableData(prev => prev.filter(item => item.id !== id));
    }
  };

  const moveUp = (index) => {
    if (index === 0) return; // 이미 맨 위면 무시
    const newData = [...editableData];
    const temp = newData[index - 1];
    newData[index - 1] = newData[index];
    newData[index] = temp;
    setEditableData(newData);
  };

  const moveDown = (index) => {
    if (index === editableData.length - 1) return; // 이미 맨 아래면 무시
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
    if (!window.confirm("문단속 데이터를 서버에 덮어쓰시겠습니까?")) return;

    const finalDataToSave = editableData.map(bldg => ({
      ...bldg,
      defaultRooms: textToArray(bldg.defaultRooms),
      exceptions: {
        "월": textToArray(bldg.exceptions["월"]),
        "화": textToArray(bldg.exceptions["화"]),
        "수": textToArray(bldg.exceptions["수"]),
        "목": textToArray(bldg.exceptions["목"]),
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
        alert("문단속 데이터가 성공적으로 저장되었습니다!");
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
    
      if (numStr.length >= 3) {
        floorNum = numStr.slice(0, -2);
      }
      return (isBasement ? '지하 ' : '') + floorNum + '층';
    }
    return '기타'; // 숫자가 없는 호실명 (예: 멀티프라자)
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
            <button onClick={() => setIsAdminMode(false)} style={{ 
              padding: '8px 12px', 
              fontSize: '14px', 
              whiteSpace: 'nowrap', /* 강제 줄바꿈 방지 */
              borderRadius: '6px',
              border: '1px solid #ccc'
            }}>
              돌아가기
            </button>
          </div>
          <h2 style={{ margin: 0, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 'clamp(16px, 4vw, 22px)' }}>
            🔑 문단속 데이터
          </h2>
          
          <div style={{ justifySelf: 'end' }}>
            <button onClick={handleSaveChanges} style={{ 
              backgroundColor: '#ff4757', color: 'white', fontWeight: 'bold', 
              padding: '8px 12px', fontSize: '14px', whiteSpace: 'nowrap', borderRadius: '6px', border: 'none'
            }}>
              💾 저장
            </button>
          </div>
        </div>
        <button onClick={handleAddBuilding} style={{ 
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
        }}>
          + 새 공학관 추가
        </button>

        <div style={{ 
          flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '10px',
          overscrollBehaviorY: 'contain'
        }}>
          <p style={{ fontSize: '14px', color: '#666', marginTop: 0 }}>💡 공학관 하나에 여러 층의 호실을 적어주세요. (쉼표, 띄어쓰기 자유)</p>
          
          {editableData.map((bldg, index) => (
            <div key={bldg.id} style={{ 
              padding: '15px', borderBottom: '1px solid #ccc', marginBottom: '10px', backgroundColor: 'rgba(255,255,255,0.05)',
              touchAction: 'pan-y'
            }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <button onClick={() => moveUp(index)} style={{ padding: '6px 10px', fontSize: '10px', border: 'none', borderRadius: '4px', backgroundColor: '#dcdde1', color: '#2f3542' }}>▲</button>
                  <button onClick={() => moveDown(index)} style={{ padding: '6px 10px', fontSize: '10px', border: 'none', borderRadius: '4px', backgroundColor: '#dcdde1', color: '#2f3542' }}>▼</button>
                </div>

                <input 
                  type="text" 
                  value={bldg.building} 
                  onChange={(e) => {
                    const newData = [...editableData];
                    newData[index] = { ...newData[index], building: e.target.value };
                    setEditableData(newData);
                  }}
                  placeholder="예: 6공학관"
                  style={{ 
                    flex: 1, /* 남는 가로 공간을 모두 차지함 */
                    fontSize: '16px',
                    fontWeight: 'bold', padding: '10px', minWidth: '50px', borderRadius: '6px', border: '1px solid #ccc' 
                  }}
                />

                <button onClick={() => handleDeleteBuilding(bldg.id)} style={{ padding: '10px 12px', backgroundColor: '#ff6b81', color: 'white', border: 'none', borderRadius: '6px', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                  삭제
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                <strong style={{ whiteSpace: 'nowrap', color: '#ccc', fontSize: '14px' }}>기본 호실:</strong>
                <input 
                  type="text" 
                  value={Array.isArray(bldg.defaultRooms) ? bldg.defaultRooms.join(', ') : bldg.defaultRooms} 
                  onChange={(e) => {
                    const newData = [...editableData];
                    newData[index] = { ...newData[index], defaultRooms: e.target.value };
                    setEditableData(newData);
                  }}
                  placeholder="예: 401, 402, 501, B101"
                  style={{ flex: 1, padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }} /* 🌟 fontSize: 16px 고정 */
                />
              </div>

              {['월', '화', '수', '목', '금'].map(day => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                  <span style={{ width: '60px', color: '#ff7f50', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>{day} 제외:</span>
                  <input 
                    type="text" 
                    value={Array.isArray(bldg.exceptions[day]) ? bldg.exceptions[day].join(', ') : bldg.exceptions[day]} 
                    onChange={(e) => {
                      const newData = [...editableData];
                      newData[index] = { 
                        ...newData[index], 
                        exceptions: { ...newData[index].exceptions, [day]: e.target.value } 
                      };
                      setEditableData(newData);
                    }}
                    placeholder={`안 잠그는 호실`}
                    style={{ flex: 1, padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }} /* 🌟 fontSize: 16px 고정 */
                  />
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
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
        {['월', '화', '수', '목', '금'].map(day => (
          <button 
            key={day} 
            onClick={() => setSelectedDay(day)}
            style={{ 
              padding: '8px 12px',
              fontSize: '15px',
              fontWeight: 'bold',
              backgroundColor: selectedDay === day ? '#ff7f50' : '#f1f2f6',
              color: selectedDay === day ? 'white' : '#2f3542',
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {day}요일
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>
          <span style={{ color: '#ff7f50' }}>{selectedDay}요일</span> 문단속 대상
        </h2>
        
        {/* 🌟 4. 이미지 다운로드 버튼 추가! */}
        <button onClick={handleDownloadImage} style={{
          backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '8px',
          padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
        }}>
          📸 이미지로 저장
        </button>
      </div>
      <div ref={captureRef} style={{ flex: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#f5f6fa' }}>
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
            <div key={bldg.id} style={{ 
              backgroundColor: 'white', padding: '20px', borderRadius: '12px', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '15px', color: '#333'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#2f3542', borderBottom: '2px solid #ff7f50', paddingBottom: '10px', fontSize: '20px' }}>
                🏢 {bldg.building}
              </h3>
              
              {roomsToCheck.length > 0 ? (
                <div>
                  {Object.keys(groupedRooms).sort(sortFloors).map(floor => (
                    <div key={floor} style={{ marginBottom: '15px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#57606f', fontSize: '16px' }}>{floor}</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {groupedRooms[floor].map((room, idx) => (
                          <span key={idx} style={{ 
                            backgroundColor: '#ffeaa7', padding: '8px 15px', 
                            borderRadius: '20px', fontWeight: 'bold', fontSize: '16px'
                          }}>
                            {room}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#747d8c', margin: 0 }}>오늘 이 공학관은 문단속할 호실이 없습니다</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}