import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io();

export default function ChatPage({ nickname, setNickname, isJoined, setIsJoined, isAdminMode, setIsAdminMode }) {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  
  const [notice, setNotice] = useState('');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [editNoticeText, setEditNoticeText] = useState('');
  const [isNoticeFolded, setIsNoticeFolded] = useState(true);

  const [showEmoticons, setShowEmoticons] = useState(false);
  const [emoticons, setEmoticons] = useState(['/d.ico', '/symbol.png']);
  const [isDragging, setIsDragging] = useState(false);
  
  const [userCount, setUserCount] = useState(1);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 150; 
      setIsAtBottom(isBottom);
    }
  };

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  const fetchEmoticons = () => {
    fetch('/api/emoticons')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmoticons(['/d.ico', '/symbol.png', ...data]);
        }
      })
      .catch(err => console.error("이모티콘 로드 실패:", err));
  };

  useEffect(() => {
    socket.on('loadHistory', (historyData) => {
      setMessages(historyData);
      setTimeout(() => scrollToBottom('auto'), 100); 
    });
    
    socket.on('receiveMessage', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('receiveNotice', (loadedNotice) => setNotice(loadedNotice));
    
    // 🌟 핵심 수정: 프론트에서도 아이디 타입을 String으로 맞춰서 삭제 처리
    socket.on('deleteMessage', (msgId) => {
      setMessages(prev => prev.filter(m => String(m.id) !== String(msgId)));
    });
    
    socket.on('clearHistory', () => setMessages([]));
    socket.on('userCount', (count) => setUserCount(count));

    return () => {
      socket.off('loadHistory');
      socket.off('receiveMessage');
      socket.off('receiveNotice');
      socket.off('deleteMessage');
      socket.off('clearHistory');
      socket.off('userCount');
    };
  }, []);

  useEffect(() => {
    if (isJoined) {
      socket.emit('requestHistory');
      fetchEmoticons();
      setTimeout(() => scrollToBottom('auto'), 150);
    }
  }, [isJoined]);

  useEffect(() => {
    if (isAtBottom) {
      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  }, [messages]);

  const handleJoin = () => {
    if (nickname.trim()) {
      setIsJoined(true);
    }
  };

  const handleSendMessage = () => {
    if (currentMessage.trim() === '') return;
    const messageData = {
      id: Date.now(),
      sender: nickname,
      text: currentMessage,
      type: 'text',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
    socket.emit('sendMessage', messageData);
    setCurrentMessage('');
    setIsAtBottom(true);
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/chat/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        const messageData = {
          id: Date.now(),
          sender: nickname,
          fileUrl: data.url,
          fileName: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };
        socket.emit('sendMessage', messageData);
        setIsAtBottom(true);
      } else {
        alert('파일 업로드 실패');
      }
    } catch (error) {
      console.error("파일 업로드 에러:", error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) await uploadFile(file);
      }
    }
  };

  const handleEmoticonUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/emoticons/upload', { method: 'POST', body: formData });
      if (response.ok) {
        fetchEmoticons(); 
      }
    } catch (err) {
      console.error("이모티콘 업로드 에러:", err);
    }
  };

  const sendEmoticon = (emoUrl) => {
    const messageData = {
      id: Date.now(),
      sender: nickname,
      emoticonUrl: emoUrl,
      type: 'emoticon',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
    socket.emit('sendMessage', messageData);
    setShowEmoticons(false);
    setIsAtBottom(true);
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const handleDeleteMessage = (id) => {
    if (window.confirm('이 메시지를 삭제하시겠습니까?')) {
      socket.emit('deleteMessage', id);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('모든 대화 내역을 영구적으로 삭제하시겠습니까?')) {
      socket.emit('clearHistory');
    }
  };

  const handleSaveNotice = () => {
    socket.emit('updateNotice', editNoticeText);
    setIsEditingNotice(false);
  };

  const handleDeleteEmoticon = async (emoUrl) => {
    if (!window.confirm("이 이모티콘을 삭제하시겠습니까?")) return;
    setEmoticons(prev => prev.filter(emo => emo !== emoUrl));
    try {
      await fetch('/api/emoticons/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: emoUrl })
      });
    } catch (err) {}
  };

  if (!isJoined) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: '#f5f6fa', height: '100%', minHeight: 0 }}>
        <div style={{ backgroundColor: '#fff', padding: '40px 30px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '320px', boxSizing: 'border-box' }}>
          <h2 style={{ color: '#2f3542', margin: '0 0 25px 0', fontSize: '20px' }}>행정실 채팅방 입장</h2>
          {/* 🌟 글자색(color: '#333') 적용 완료 */}
          <input 
            type="text" 
            placeholder="사용할 이름을 입력하세요" 
            value={nickname} 
            onChange={(e) => setNickname(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
            style={{ width: '100%', padding: '14px', fontSize: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8f9fa', color: '#333' }} 
          />
          <button 
            onClick={handleJoin} 
            style={{ width: '100%', padding: '14px', fontSize: '16px', backgroundColor: '#2ed573', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
      style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: '#f1f2f6', 
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      {isDragging && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(30, 144, 255, 0.2)', border: '4px dashed #1e90ff', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <h2 style={{ color: '#1e90ff', fontWeight: 'bold', fontSize: '24px' }}>여기에 파일을 놓아주세요</h2>
        </div>
      )}

      <div style={{ padding: '15px 20px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', color: '#1e90ff', backgroundColor: '#f0f4ff', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #d1d8e0' }}>
          👥 접속 {userCount}명
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#2f3542' }}>
            {nickname} <span style={{ fontWeight: 'normal', color: '#747d8c', fontSize: '12px' }}>님 접속 중</span>
          </span>
          {isAdminMode && (
            <button onClick={handleClearChat} style={{ backgroundColor: '#ff4757', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              대화 내역 초기화
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 20px', backgroundColor: '#fffbe8', borderBottom: '1px solid #f6e58d', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📢</span>
            {isEditingNotice ? (
              <input type="text" value={editNoticeText} onChange={(e) => setEditNoticeText(e.target.value)} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ddd', color: '#333' }} />
            ) : (
              <span style={{ fontWeight: 'bold', color: '#e1b12c', fontSize: '14px' }}>
                {isNoticeFolded && notice.length > 20 ? notice.substring(0, 20) + '...' : notice || '등록된 공지사항이 없습니다.'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {isAdminMode && (
              isEditingNotice ? (
                <button onClick={handleSaveNotice} style={{ background: '#e1b12c', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>저장</button>
              ) : (
                <button onClick={() => { setIsEditingNotice(true); setEditNoticeText(notice); }} style={{ background: 'none', border: '1px solid #e1b12c', color: '#e1b12c', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>수정</button>
              )
            )}
            {!isEditingNotice && notice.length > 20 && (
              <button onClick={() => setIsNoticeFolded(!isNoticeFolded)} style={{ background: 'none', border: 'none', color: '#747d8c', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                {isNoticeFolded ? '▼ 펼치기' : '▲ 접기'}
              </button>
            )}
          </div>
        </div>
        {!isNoticeFolded && !isEditingNotice && notice.length > 20 && (
          <div style={{ marginTop: '10px', fontSize: '13px', color: '#57606f', whiteSpace: 'pre-wrap' }}>
            {notice}
          </div>
        )}
      </div>

      <div ref={chatContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {messages.map((msg) => {
          const isMine = msg.sender === nickname;
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: '12px', color: '#747d8c', marginBottom: '4px', marginLeft: isMine ? 0 : '4px', marginRight: isMine ? '4px' : 0 }}>
                {msg.sender}
              </span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMine ? 'row' : 'row-reverse' }}>
                <span style={{ fontSize: '10px', color: '#a4b0be' }}>{msg.time}</span>
                <div style={{ padding: '10px 14px', borderRadius: '15px', backgroundColor: isMine ? '#fff4cc' : '#fff', color: '#333', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxWidth: '100%', wordBreak: 'break-word', position: 'relative' }}>
                  {msg.type === 'text' && <span>{msg.text}</span>}
                  
                  {msg.type === 'image' && (
                    <div style={{ marginTop: '5px' }}>
                      <img 
                        src={msg.fileUrl} 
                        alt={msg.fileName || "첨부 이미지"} 
                        onClick={() => window.open(msg.fileUrl, '_blank')}
                        title="클릭하여 원본 크기로 보기"
                        onLoad={() => isAtBottom && scrollToBottom('smooth')}
                        style={{ 
                          maxWidth: '250px', 
                          maxHeight: '300px', 
                          objectFit: 'contain', 
                          borderRadius: '8px', 
                          cursor: 'pointer', 
                          border: isMine ? 'none' : '1px solid #e2e8f0',
                          backgroundColor: '#fff',
                          display: 'block'
                        }} 
                      />
                    </div>
                  )}

                  {msg.type === 'file' && (
                    <a href={msg.fileUrl} download={msg.fileName} style={{ color: '#1e90ff', textDecoration: 'underline', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      📁 {msg.fileName}
                    </a>
                  )}
                  {msg.type === 'emoticon' && (
                    <img 
                      src={msg.emoticonUrl} 
                      alt="이모티콘" 
                      onLoad={() => isAtBottom && scrollToBottom('smooth')}
                      style={{ width: '80px', height: '80px', objectFit: 'contain' }} 
                    />
                  )}
                  
                  {isAdminMode && (
                    <button onClick={() => handleDeleteMessage(msg.id)} style={{ position: 'absolute', top: '-8px', right: isMine ? 'auto' : '-8px', left: isMine ? '-8px' : 'auto', background: '#ff4757', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      X
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '15px', backgroundColor: '#fff', borderTop: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
        
        {showEmoticons && (
          <div style={{ position: 'absolute', bottom: '70px', left: '15px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap', maxWidth: '300px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
            {emoticons.map((emo, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={emo} alt="이모티콘" onClick={() => sendEmoticon(emo)} style={{ width: '50px', height: '50px', cursor: 'pointer', objectFit: 'contain' }} />
                {isAdminMode && (
                  <button 
                    onClick={() => handleDeleteEmoticon(emo)}
                    style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ff4757', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    title="이모티콘 삭제"
                  >
                    X
                  </button>
                )}
              </div>
            ))}
            
            {isAdminMode && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', border: '2px dashed #ccc', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#f8f9fa' }} title="새 이모티콘 추가">
                <span style={{ fontSize: '24px', color: '#888', fontWeight: 'bold' }}>+</span>
                <input type="file" accept="image/*" onChange={handleEmoticonUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ position: 'relative', width: '36px', height: '36px', backgroundColor: '#eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '15px' }}>📎</span>
            <input type="file" onChange={handleFileUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
          </div>
          <div onClick={() => setShowEmoticons(!showEmoticons)} style={{ width: '36px', height: '36px', backgroundColor: '#eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: '18px' }}>
            😀
          </div>
          <input 
            type="text" 
            placeholder="메시지, 붙여넣기, 파일 드래그" 
            value={currentMessage} 
            onChange={(e) => setCurrentMessage(e.target.value)} 
            onPaste={handlePaste}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', fontSize: '15px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none', color: '#333', backgroundColor: '#fff'}}
          />
          <button onClick={handleSendMessage} style={{ backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '20px', padding: '10px 15px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            전송
          </button>
        </div>
      </div>
    </div>
  );
}