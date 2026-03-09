import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io();
const EMOTICONS = [
  '/d.ico', 
  '/symbol.png',
];

export default function ChatPage({ nickname, setNickname, isJoined, setIsJoined, isAdminMode, setIsAdminMode }) {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [editNoticeText, setEditNoticeText] = useState('');
  const [showEmoticons, setShowEmoticons] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isNoticeFolded, setIsNoticeFolded] = useState(false);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(isBottom);
    }
  };

  useEffect(() => {
    socket.on('loadHistory', (historyData) => setMessages(historyData));
    socket.on('receiveMessage', (messageData) => setMessages((prev) => [...prev, messageData]));
    

    socket.on('receiveNotice', (newNotice) => {
      setNotice(newNotice);
      setEditNoticeText(newNotice);
    });

    socket.emit('requestHistory');

    return () => {
      socket.off('loadHistory');
      socket.off('receiveMessage');
      socket.off('receiveNotice');
    };
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (nickname.trim()) setIsJoined(true);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const messageData = {
      sender: nickname,
      text: currentMessage,
      type: 'text',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit('sendMessage', messageData);
    setCurrentMessage('');
    setShowEmoticons(false); // 전송 시 이모티콘 창 닫기
    setIsAtBottom(true);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleSendEmoticon = (emoticonUrl) => {
    const messageData = {
      sender: nickname,
      fileUrl: emoticonUrl,
      type: 'emoticon',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
    socket.emit('sendMessage', messageData);
    setShowEmoticons(false); // 전송 후 창 닫기
    setIsAtBottom(true);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/chat/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        const messageData = {
          sender: nickname,
          fileUrl: data.url,
          fileName: data.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };
        socket.emit('sendMessage', messageData);
        setIsAtBottom(true);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else {
        alert('파일 업로드 실패');
      }
    } catch (error) {
      alert('서버 통신 오류');
    } finally {
      e.target.value = '';
    }
  };

  // 🌟 공지사항 저장 함수 (관리자 전용)
  const handleSaveNotice = () => {
    socket.emit('updateNotice', editNoticeText);
    setIsEditingNotice(false);
  };

  if (!isJoined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', paddingBottom: '15vh' }}>
        <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '20px', color: '#333' }}>행정실 실시간 채팅 💬</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>채팅방에서 사용할 이름을 입력해주세요.</p>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="예: 홍길동 조교" value={nickname} onChange={(e) => setNickname(e.target.value)} autoFocus style={{ flex: 1, padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }} />
            <button type="submit" style={{ backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '8px', padding: '0 20px', fontWeight: 'bold', cursor: 'pointer' }}>입장</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f5f6fa', position: 'relative' }}>
      <div style={{ padding: '15px 20px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdminMode && (
            <button onClick={() => setIsAdminMode(false)} style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer' }}>일반 모드</button>
          )}
        </div>
        <span style={{ fontSize: '14px', color: '#666', backgroundColor: '#eee', padding: '5px 10px', borderRadius: '20px' }}>내 닉네임: {nickname}</span>
      </div>

      <div style={{ backgroundColor: '#fff3cd', padding: '12px 20px', borderBottom: '1px solid #ffeeba', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', zIndex: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }} 
            onClick={() => setIsNoticeFolded(!isNoticeFolded)}
          >
            <span style={{ fontSize: '18px' }}>📢</span>
            {isNoticeFolded && (
              <span style={{ fontSize: '14px', color: '#856404', fontWeight: 'bold' }}>공지사항 보기...</span>
            )}
          </div>

          <button 
            onClick={() => setIsNoticeFolded(!isNoticeFolded)} 
            style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', color: '#856404', padding: '5px' }}
          >
            {isNoticeFolded ? '▼ 펼치기' : '▲ 접기'}
          </button>
        </div>

        {!isNoticeFolded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            {isEditingNotice ? (
              <input 
                type="text" 
                value={editNoticeText} 
                onChange={(e) => setEditNoticeText(e.target.value)} 
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} 
                autoFocus
              />
            ) : (
              <span style={{ fontSize: '14px', color: '#856404', fontWeight: 'bold', wordBreak: 'keep-all', flex: 1 }}>
                {notice || "등록된 공지사항이 없습니다."}
              </span>
            )}
            
            {isAdminMode && (
              <div style={{ marginLeft: '10px' }}>
                {isEditingNotice ? (
                  <button onClick={handleSaveNotice} style={{ padding: '6px 12px', backgroundColor: '#2ed573', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>저장</button>
                ) : (
                  <button onClick={() => setIsEditingNotice(true)} style={{ padding: '6px 12px', backgroundColor: '#ff4757', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>수정</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div ref={chatContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {messages.map((msg, index) => {
          const isMe = msg.sender === nickname;
          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {!isMe && <span style={{ fontSize: '12px', color: '#666', marginBottom: '4px', marginLeft: '5px' }}>{msg.sender}</span>}
              
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div style={{ 
                  maxWidth: '70vw', padding: '10px 15px', borderRadius: '15px', wordBreak: 'break-word', color: '#333',
                  backgroundColor: isMe ? '#ffeaa7' : '#fff', border: isMe ? 'none' : '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  {msg.type === 'text' && <span>{msg.text}</span>}
                  {msg.type === 'image' && <img src={msg.fileUrl} alt="업로드 이미지" style={{ maxWidth: '100%', borderRadius: '8px' }} />}
                  {msg.type === 'file' && <a href={msg.fileUrl} download={msg.fileName} style={{ color: '#1e90ff', textDecoration: 'none', fontWeight: 'bold' }}>📎 {msg.fileName}</a>}
                  {msg.type === 'emoticon' && <img src={msg.fileUrl} alt="이모티콘" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />}
                </div>
                <span style={{ fontSize: '11px', color: '#999' }}>{msg.time}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {showEmoticons && (
        <div style={{ 
          position: 'absolute', bottom: '70px', left: '15px', backgroundColor: '#fff', border: '1px solid #ddd', 
          borderRadius: '12px', padding: '10px', display: 'flex', gap: '10px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 10
        }}>
          {EMOTICONS.map((url, i) => (
            <img 
              key={i} src={url} alt="이모티콘 선택" 
              onClick={() => handleSendEmoticon(url)}
              style={{ width: '40px', height: '40px', cursor: 'pointer', objectFit: 'contain', padding: '5px', border: '1px solid transparent' }} 
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            />
          ))}
        </div>
      )}

      {/* 입력 영역 */}
      <form onSubmit={handleSendMessage} style={{ padding: '15px', backgroundColor: '#fff', borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '10px' }}>
        
        {/* 파일 첨부 버튼 */}
        <div style={{ position: 'relative', width: '40px', height: '40px', backgroundColor: '#eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <span>📎</span>
          <input type="file" onChange={handleFileUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
        </div>
        <div 
          onClick={() => setShowEmoticons(!showEmoticons)}
          style={{ width: '40px', height: '40px', backgroundColor: '#eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: '20px' }}
        >
          😀
        </div>

        <input type="text" placeholder="메시지 입력..." value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} style={{ flex: 1, padding: '12px', fontSize: '16px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }} />
        <button type="submit" style={{ backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '20px', padding: '0 20px', height: '44px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>전송</button>
      </form>

    </div>
  );
}