import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import html2canvas from 'html2canvas';

export default function RegisteredMail({ isMobile, setIsGlobalScanning, chatNickname }) {
  const [isScanningReg, setIsScanningReg] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [dots, setDots] = useState('');
  
  const [registeredMails, setRegisteredMails] = useState([]);
  const [manualTracking, setManualTracking] = useState('');
  const [manualRecipient, setManualRecipient] = useState('');

  const printRef = useRef(null);

  useEffect(() => {
    let interval;
    if (isScanningReg) {
      interval = setInterval(() => {
        setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
      }, 500); 
    } else {
      setDots('');
    }
    return () => clearInterval(interval);
  }, [isScanningReg]);

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

  // 🌟 신규: 스캔된 목록의 데이터 수정 로직
  const handleEditRegistered = (id, field, value) => {
    setRegisteredMails(prev => prev.map(mail => 
      mail.id === id ? { ...mail, [field]: value } : mail
    ));
  };

  const getTableRows = () => {
    const orderedMails = [...registeredMails].reverse();
    const MAX_ROWS = 36;
    const rows = [];

    for (let i = 0; i < MAX_ROWS; i++) {
      const mail = orderedMails[i];
      rows.push({
        no: i + 1,
        tracking: mail ? mail.trackingNumber : '',
        recipient: mail ? mail.recipient : '',
        id: mail ? mail.id : `empty-${i}`
      });
    }
    return rows;
  };

  const exportFileName = () => {
    const today = new Date();
    return `${String(today.getMonth() + 1).padStart(2, '0')}월-${String(today.getDate()).padStart(2, '0')}일 등기`;
  };

  const handleExportImage = async () => {
    if (registeredMails.length === 0) return alert('스캔된 데이터가 없습니다.');
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imageURL = canvas.toDataURL("image/png");
      
      const link = document.createElement("a");
      link.href = imageURL;
      link.download = `${exportFileName()}.png`;
      link.click();
    } catch (error) {
      alert("이미지 저장에 실패했습니다.");
    }
  };

  const handleSendToChat = async () => {
    if (registeredMails.length === 0) return alert('전송할 데이터가 없습니다.');
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, { scale: 4, backgroundColor: '#ffffff' });
      
      canvas.toBlob(async (blob) => {
        const fileName = `${exportFileName()}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/chat/upload', { method: 'POST', body: formData });
        if (response.ok) {
          const data = await response.json();
          const tempSocket = io(); 
          const senderName = chatNickname && chatNickname.trim() !== '' ? chatNickname : "익명";
          
          tempSocket.emit('sendMessage', {
            sender: senderName,
            fileUrl: data.url,
            fileName: fileName,
            type: 'image',
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          });
          alert('채팅방으로 대장 이미지가 전송되었습니다!');
          setTimeout(() => tempSocket.disconnect(), 1000); 
        } else {
          alert("업로드 실패");
        }
      }, "image/png");

    } catch (error) {
      alert("통신 오류로 전송하지 못했습니다.");
    }
  };

  const handleDirectPrint = async () => {
    if (registeredMails.length === 0) return alert('인쇄할 데이터가 없습니다.');
    if (!printRef.current) return;

    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imageURL = canvas.toDataURL("image/png");

      const printWindow = window.open('', '_blank', 'width=900,height=800');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${exportFileName()}</title>
            <style>
              @page { size: A4 portrait; margin: 0; }
              body, html { 
                margin: 0; padding: 0; 
                width: 100%; height: 100%;
                background-color: white; 
                display: flex; 
                justify-content: center;
                align-items: flex-start;
              }
              img { 
                width: 100vw; 
                height: 100vh;
                object-fit: contain; 
                object-position: top center;
                display: block; 
              }
            </style>
          </head>
          <body>
            <img src="${imageURL}" onload="setTimeout(function() { window.print(); window.close(); }, 250);" />
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      alert("인쇄 화면을 준비하는 중 오류가 발생했습니다.");
    }
  };

  const todayDateStr = `${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}`;

  return (
    <div style={{ margin: '20px', padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0, color: '#333', fontSize: '18px' }}>📦 등기 대장 기록</h2>
        <div style={{ 
          position: 'relative', backgroundColor: '#2ed573', color: 'white', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px',
          cursor: isScanningReg ? 'not-allowed' : 'pointer', opacity: isScanningReg ? 0.7 : 1
        }}>
          {isScanningReg ? <span>⏳ 분석 중{dots} ({scanProgress.current}/{scanProgress.total})</span> : '📷 송장 스캔'}
          <input type="file" multiple accept="image/*" onChange={handleRegisteredImageUpload} disabled={isScanningReg} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: isScanningReg ? 'not-allowed' : 'pointer' }} />
        </div>
      </div>

      {/* 입력창 배경색 밝게, 글자색 진하게 설정 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', opacity: isScanningReg ? 0.5 : 1 }}>
        <input 
          type="text" 
          placeholder="등기 번호 입력" 
          value={manualTracking} 
          onChange={(e) => setManualTracking(e.target.value)} 
          disabled={isScanningReg} 
          style={{ flex: 1, minWidth: 0, padding: '12px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', backgroundColor: '#fff', color: '#333' }} 
        />
        <input 
          type="text" 
          placeholder="수신자 이름" 
          value={manualRecipient} 
          onChange={(e) => setManualRecipient(e.target.value)} 
          disabled={isScanningReg} 
          style={{ flex: 1, minWidth: 0, padding: '12px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', backgroundColor: '#fff', color: '#333' }} 
        />
        <button onClick={handleAddManualRegistered} disabled={isScanningReg} style={{ padding: '0 15px', backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isScanningReg ? 'not-allowed' : 'pointer' }}>추가</button>
      </div>

      {registeredMails.length > 0 && (
        <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eaeaea' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333', fontWeight: 'bold' }}>최근 스캔 내역 (직접 수정 가능)</p>
          <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
            {registeredMails.map((mail) => (
              <div key={mail.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                {/* 🌟 기존 텍스트를 인풋창으로 변경하여 즉시 수정 가능하게 만듦 */}
                <input 
                  type="text" 
                  value={mail.trackingNumber} 
                  onChange={(e) => handleEditRegistered(mail.id, 'trackingNumber', e.target.value)}
                  style={{ flex: 1.5, padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: '#fff', color: '#333', outline: 'none' }}
                />
                <input 
                  type="text" 
                  value={mail.recipient} 
                  onChange={(e) => handleEditRegistered(mail.id, 'recipient', e.target.value)}
                  style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: '#fff', color: '#333', outline: 'none' }}
                />
                <button onClick={() => handleDeleteRegistered(mail.id)} disabled={isScanningReg} style={{ background: '#ff4757', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '15px', color: '#333', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '15px' }}>출력 미리보기 (A4 양식)</h3>
      <div style={{ 
        width: '100%', overflowX: 'auto', backgroundColor: '#e5e7eb', padding: '20px', borderRadius: '8px', marginBottom: '20px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div ref={printRef} style={{ 
          minWidth: '800px', backgroundColor: 'white', padding: '60px 40px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          margin: '0 auto', fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif", color: '#000000'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black', padding: '8px', backgroundColor: '#f2f2f2', width: '12%' }}>월/일</th>
                <th style={{ border: '1px solid black', padding: '8px', backgroundColor: '#f2f2f2', width: '8%' }}>연번</th>
                <th style={{ border: '1px solid black', padding: '8px', backgroundColor: '#f2f2f2', width: '25%' }}>등기번호</th>
                <th style={{ border: '1px solid black', padding: '8px', backgroundColor: '#f2f2f2', width: '25%' }}>받는사람</th>
                <th style={{ border: '1px solid black', padding: '8px', backgroundColor: '#f2f2f2', width: '15%' }}>인수자<br/>이름</th>
                <th style={{ border: '1px solid black', padding: '8px', backgroundColor: '#f2f2f2', width: '15%' }}>싸인</th>
              </tr>
            </thead>
            <tbody>
              {getTableRows().map((row, idx) => (
                <tr key={row.id}>
                  {idx === 0 && (
                    <td rowSpan={37} style={{ border: '1px solid black', fontWeight: 'bold', fontSize: '20px' }}>
                      {todayDateStr}
                    </td>
                  )}
                  <td style={{ border: '1px solid black', height: '26px' }}>{row.no}</td>
                  <td style={{ border: '1px solid black', height: '26px' }}>{row.tracking}</td>
                  <td style={{ border: '1px solid black', height: '26px' }}>{row.recipient}</td>
                  <td style={{ border: '1px solid black', height: '26px' }}></td>
                  <td style={{ border: '1px solid black', height: '26px' }}></td>
                </tr>
              ))}
              <tr>
                <td style={{ border: '1px solid black', height: '26px', fontWeight: 'bold' }}>우체국</td>
                <td style={{ border: '1px solid black', height: '26px' }}></td>
                {/* 카운트 숫자 색상을 검정색으로 변경 */}
                <td style={{ border: '1px solid black', height: '26px', fontWeight: 'bold', color: 'black' }}>
                  {registeredMails.length}
                </td>
                {/* 6열을 꽉 채우기 위해 colSpan=3으로 보정 */}
                <td colSpan="3" style={{ border: '1px solid black', height: '26px' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleExportImage} disabled={isScanningReg} style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#f1f2f6', color: '#2f3542', borderRadius: '8px', border: '1px solid #ddd', fontWeight: 'bold', cursor: isScanningReg ? 'not-allowed' : 'pointer', opacity: isScanningReg ? 0.5 : 1 }}>
          기기에 표 이미지 저장
        </button>
        <button onClick={handleSendToChat} disabled={isScanningReg} style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#1e90ff', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: isScanningReg ? 'not-allowed' : 'pointer', opacity: isScanningReg ? 0.5 : 1 }}>
          표 이미지를 채팅방 전송
        </button>
        <button onClick={handleDirectPrint} disabled={isScanningReg} style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#2ed573', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: isScanningReg ? 'not-allowed' : 'pointer', opacity: isScanningReg ? 0.5 : 1 }}>
          바로 인쇄하기
        </button>
      </div>

    </div>
  );
}