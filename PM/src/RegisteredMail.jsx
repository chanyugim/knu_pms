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
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      
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

  // 🌟 핵심 변경: 표 HTML을 그대로 인쇄하지 않고, 고화질 이미지로 캡처한 뒤 이미지를 인쇄합니다!
  const handleDirectPrint = async () => {
    if (registeredMails.length === 0) return alert('인쇄할 데이터가 없습니다.');
    if (!printRef.current) return;

    try {
      // 1. 사진 저장 기능과 완벽하게 동일하게 캔버스로 고화질 캡처
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imageURL = canvas.toDataURL("image/png");

      // 2. 인쇄 전용 창 열기
      const printWindow = window.open('', '_blank', 'width=900,height=800');
      
      // 3. 캡처된 이미지를 A4 용지 너비에 맞춰서 인쇄하도록 HTML 구성
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${exportFileName()}</title>
            <style>
              /* 상하좌우 10mm 여백을 주어 잘림 현상 완벽 방지 */
              @page { size: A4 portrait; margin: 10mm; }
              body { 
                margin: 0; padding: 0; 
                background-color: white; 
                display: flex; 
                justify-content: center; 
              }
              /* 캡처된 이미지를 가로 폭에 100% 맞춤 */
              img { 
                width: 100%; 
                max-width: 100%; 
                height: auto; 
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

  const todayDateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', opacity: isScanningReg ? 0.5 : 1 }}>
        <input type="text" placeholder="등기 번호" value={manualTracking} onChange={(e) => setManualTracking(e.target.value)} disabled={isScanningReg} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none' }} />
        <input type="text" placeholder="수신자" value={manualRecipient} onChange={(e) => setManualRecipient(e.target.value)} disabled={isScanningReg} style={{ flex: 1, minWidth: 0, padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none' }} />
        <button onClick={handleAddManualRegistered} disabled={isScanningReg} style={{ padding: '0 15px', backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isScanningReg ? 'not-allowed' : 'pointer' }}>추가</button>
      </div>

      {registeredMails.length > 0 && (
        <div style={{ marginBottom: '25px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666', fontWeight: 'bold' }}>최근 스캔 내역 (수정/삭제)</p>
          <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {registeredMails.map((mail) => (
              <div key={mail.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #ddd', fontSize: '13px' }}>
                <span style={{ color: '#333' }}>{mail.trackingNumber} | {mail.recipient}</span>
                <button onClick={() => handleDeleteRegistered(mail.id)} disabled={isScanningReg} style={{ background: 'none', border: 'none', color: '#ff4757', fontWeight: 'bold', cursor: 'pointer' }}>삭제</button>
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
          margin: '0 auto', fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif"
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
                    <td rowSpan={37} style={{ border: '1px solid black', fontWeight: 'bold', fontSize: '14px' }}>
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
                <td style={{ border: '1px solid black', height: '26px', fontWeight: 'bold', color: '#333' }}>
                  {registeredMails.length}
                </td>
                <td colSpan="2" style={{ border: '1px solid black', height: '26px' }}></td>
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