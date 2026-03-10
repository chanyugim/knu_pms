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

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

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

    fetch('/api/emoticons')
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) setEmoticons(prev => [...prev, ...data]);
      })
      .catch(err => console.error("이모티콘 로드 에러:", err));

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
      sender: nickname, text: currentMessage, type: 'text',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit('sendMessage', messageData);
    setCurrentMessage('');
    setShowEmoticons(false);
    setIsAtBottom(true);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const processFileUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/chat/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        const messageData = {
          sender: nickname, fileUrl: data.url, fileName: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };
        socket.emit('sendMessage', messageData);
        setIsAtBottom(true);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch (error) {
      alert('파일 전송 실패');
    }
  };

  const handleFileUpload = (e) => {
    processFileUpload(e.target.files[0]);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData.items;
    let imageFile = null;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (imageFile) {
      e.preventDefault();
      processFileUpload(imageFile);
      return;
    }

    const pastedText = e.clipboardData.getData('text');
    if (pastedText && /\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(pastedText)) {
      e.preventDefault();
      const messageData = {
        sender: nickname, fileUrl: pastedText, type: 'image',
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      };
      socket.emit('sendMessage', messageData);
      setIsAtBottom(true);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const handleSendEmoticon = (emoticonUrl) => {
    const messageData = {
      sender: nickname, fileUrl: emoticonUrl, type: 'emoticon',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
    socket.emit('sendMessage', messageData);
    setShowEmoticons(false);
    setIsAtBottom(true);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleEmoticonUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/emoticons/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        setEmoticons(prev => [...prev, data.url]); 
        alert("이모티콘이 추가되었습니다.");
      }
    } catch (error) {
      alert("업로드 오류가 발생했습니다.");
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveNotice = () => {
    socket.emit('updateNotice', editNoticeText);
    setIsEditingNotice(false);
  };

  if (!isJoined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', paddingBottom: '15vh' }}>
        <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '20px', color: '#333' }}>💬 행정실 메신저</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>채팅방에서 사용할 이름을 입력해주세요.</p>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="이름 입력" value={nickname} onChange={(e) => setNickname(e.target.value)} autoFocus style={{ flex: 1, padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }} />
            <button type="submit" style={{ backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '8px', padding: '0 20px', fontWeight: 'bold', cursor: 'pointer' }}>입장</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div 
      style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f5f6fa', position: 'relative' }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
    >
      {isDragging && (
        <div 
          onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30, 144, 255, 0.1)', border: '4px dashed #1e90ff', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <h2 style={{ color: '#1e90ff', pointerEvents: 'none' }}>여기에 파일을 놓아 전송하세요</h2>
        </div>
      )}

      {/* 헤더 슬림화: 패딩(여백)과 글자 크기를 확 줄였습니다 */}
      <div style={{ padding: '8px 15px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: '35px' }}>
        {isAdminMode && (
          <button onClick={() => { setIsAdminMode(false); setIsEditingNotice(false); }} style={{ color: '#333', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer', backgroundColor: '#f8f9fa', marginRight: 'auto' }}>
            일반 모드
          </button>
        )}
        <span style={{ fontSize: '12px', color: '#666', backgroundColor: '#eee', padding: '4px 10px', borderRadius: '15px' }}>접속자: {nickname}</span>
      </div>

      <div style={{ backgroundColor: '#fff3cd', padding: '12px 20px', borderBottom: '1px solid #ffeeba', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', zIndex: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }} onClick={() => setIsNoticeFolded(!isNoticeFolded)}>
            <span style={{ fontSize: '18px' }}>📢</span>
            {isNoticeFolded && <span style={{ fontSize: '14px', color: '#856404', fontWeight: 'bold' }}>펼쳐서 보기...</span>}
          </div>
          <button onClick={() => setIsNoticeFolded(!isNoticeFolded)} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', color: '#856404', padding: '5px' }}>
            {isNoticeFolded ? '▼' : '▲'}
          </button>
        </div>

        {!isNoticeFolded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            {isEditingNotice ? (
              <input type="text" value={editNoticeText} onChange={(e) => setEditNoticeText(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} autoFocus />
            ) : (
              <span style={{ fontSize: '14px', color: '#856404', fontWeight: 'bold', wordBreak: 'keep-all', flex: 1 }}>{notice || "등록된 공지사항이 없습니다."}</span>
            )}
            {isAdminMode && (
              <div style={{ marginLeft: '10px' }}>
                {isEditingNotice ? (
                  <button onClick={handleSaveNotice} style={{ padding: '6px 12px', backgroundColor: '#2ed573', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>저장</button>
                ) : (
                  <button onClick={() => setIsEditingNotice(true)} style={{ padding: '6px 12px', backgroundColor: '#ff4757', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>수정</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={chatContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                  {msg.type === 'image' && <img src={msg.fileUrl} alt="첨부 이미지" style={{ maxWidth: '100%', borderRadius: '8px' }} />}
                  {msg.type === 'file' && <a href={msg.fileUrl} download={msg.fileName} style={{ color: '#1e90ff', textDecoration: 'none', fontWeight: 'bold' }}>{msg.fileName} 다운로드</a>}
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
          position: 'absolute', bottom: '65px', left: '10px', backgroundColor: '#fff', border: '1px solid #ddd', 
          borderRadius: '12px', padding: '10px', display: 'flex', gap: '10px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 10, flexWrap: 'wrap', maxWidth: '300px'
        }}>
          {emoticons.map((url, i) => (
            <img 
              key={i} src={url} alt="이모티콘" onClick={() => handleSendEmoticon(url)}
              style={{ width: '40px', height: '40px', cursor: 'pointer', objectFit: 'contain', padding: '5px', border: '1px solid transparent' }} 
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            />
          ))}
          {isAdminMode && (
            <div style={{ position: 'relative', width: '40px', height: '40px', backgroundColor: '#f8f9fa', border: '1px dashed #ccc', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '5px' }}>
              <span style={{ fontSize: '20px', color: '#888' }}>➕</span>
              <input type="file" accept="image/*" onChange={handleEmoticonUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </div>
          )}
        </div>
      )}

      {/* 입력창 잘림 해결: boxSizing 추가, padding/gap/button 크기 미세 조정 */}
      <form onSubmit={handleSendMessage} style={{ padding: '10px', backgroundColor: '#fff', borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
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
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', fontSize: '15px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }} 
        />
        <button type="submit" style={{ backgroundColor: '#1e90ff', color: 'white', border: 'none', borderRadius: '20px', padding: '0 16px', height: '40px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>전송</button>
      </form>
    </div>
  );
}