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
  
  const [showActivities, setShowActivities] = useState(false);
  const [activities, setActivities] = useState([]);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityUrl, setNewActivityUrl] = useState('');
  const [newActivityIcon, setNewActivityIcon] = useState('');

  const [userCount, setUserCount] = useState(0);

  const [showActionMenu, setShowActionMenu] = useState(false);
  const renderActivityIcon = (iconStr) => {
    const str = iconStr || '🎮';
    if (str.includes('/') || str.includes('.') || str.startsWith('http')) {
      return <img src={str} alt="icon" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />;
    }
    return <span style={{ fontSize: '20px' }}>{str}</span>;
  };
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  const isInitialLoadRef = useRef(true);

  const closeAllPopups = () => {
    setShowEmoticons(false);
    setShowActivities(false);
    setShowActionMenu(false);
  };

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

  const validateFileSize = (file) => {
    const MAX_SIZE = 500 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
      alert('파일 용량은 500MB를 초과할 수 없습니다.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    socket.on('loadHistory', (historyData) => {
      setMessages(historyData);
      isInitialLoadRef.current = true;
      setTimeout(() => scrollToBottom('auto'), 50); 
      setTimeout(() => { isInitialLoadRef.current = false; }, 2000); 
    });
    
    socket.on('receiveMessage', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('receiveNotice', (loadedNotice) => setNotice(loadedNotice));
    socket.on('deleteMessage', (msgId) => setMessages(prev => prev.filter(m => String(m.id) !== String(msgId))));
    socket.on('clearHistory', () => setMessages([]));
    socket.on('userCount', (count) => setUserCount(count));
    socket.on('loadActivities', (data) => setActivities(data));

    return () => {
      socket.off('loadHistory');
      socket.off('receiveMessage');
      socket.off('receiveNotice');
      socket.off('deleteMessage');
      socket.off('clearHistory');
      socket.off('userCount');
      socket.off('loadActivities');
    };
  }, []);

  useEffect(() => {
    if (isJoined) {
      socket.emit('requestHistory'); 
      fetchEmoticons();
    }
  }, [isJoined]);

  useEffect(() => {
    if (isAtBottom) {
      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  }, [messages]);

  const handleJoin = () => {
    const trimmedName = nickname.trim();
    if (!trimmedName) return;

    socket.emit('joinRoom', trimmedName, (response) => {
      if (response.success) {
        setIsJoined(true);
      } else {
        alert('이미 접속 중인 이름입니다. 다른 닉네임을 사용해주세요.');
        setNickname(''); 
      }
    });
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

    if (!validateFileSize(file)) {
      e.target.value = ''; 
      return;
    }

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
        const errData = await response.json();
        alert(errData.error || '파일 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error("파일 업로드 에러:", error);
      alert('파일 업로드 통신 오류입니다.');
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
      const file = e.dataTransfer.files[0];
      if (!validateFileSize(file)) return;
      await uploadFile(file);
    }
  };

  const handlePaste = async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          if (!validateFileSize(file)) return;
          await uploadFile(file);
        }
      }
    }
  };

  const handleEmoticonUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!validateFileSize(file)) {
      e.target.value = '';
      return;
    }

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

  const handleAddActivity = () => {
    if (!newActivityName.trim() || !newActivityUrl.trim()) {
      alert("게임 이름과 접속 주소(URL)를 입력해주세요.");
      return;
    }
    socket.emit('addActivity', { 
      name: newActivityName.trim(), 
      url: newActivityUrl.trim(), 
      icon: newActivityIcon.trim() || '🎮' 
    });
    setNewActivityName('');
    setNewActivityUrl('');
    setNewActivityIcon('');
  };

  const handleDeleteActivity = (id) => {
    if (window.confirm('이 활동을 목록에서 삭제하시겠습니까?')) {
      socket.emit('deleteActivity', id);
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
    if (!window.confirm("이 이모티콘을 완전히 삭제하시겠습니까?")) return;
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

      <div onClick={closeAllPopups} style={{ padding: '15px 20px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
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

      <div onClick={closeAllPopups} style={{ padding: '10px 20px', backgroundColor: '#fffbe8', borderBottom: '1px solid #f6e58d', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📢</span>
            {isEditingNotice ? (
              <input type="text" value={editNoticeText} onChange={(e) => setEditNoticeText(e.target.value)} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: '#fff', color: '#333' }} />
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

      <div ref={chatContainerRef} onClick={closeAllPopups} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                        onLoad={() => {
                          if (isInitialLoadRef.current) scrollToBottom('auto');
                          else if (isAtBottom) scrollToBottom('smooth');
                        }}
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

                  {(msg.type === 'emoticon' || msg.type === 'emoji') && (
                    <img 
                      src={msg.emoticonUrl || msg.fileUrl || msg.url} 
                      alt="이모티콘" 
                      onLoad={() => {
                        if (isInitialLoadRef.current) scrollToBottom('auto');
                        else if (isAtBottom) scrollToBottom('smooth');
                      }}
                      onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23f1f2f6" rx="8"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%23ff4757"%3E삭제됨%3C/text%3E%3C/svg%3E';
                      }}
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
          <div style={{ position: 'absolute', bottom: '70px', left: '50px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap', maxWidth: '300px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
            {emoticons.map((emo, idx) => {
              const isDefault = ['/d.ico', '/symbol.png'].includes(emo);
              return (
                <div key={idx} style={{ position: 'relative' }}>
                  <img src={emo} alt="이모티콘" onClick={() => sendEmoticon(emo)} onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"%3E%3Crect width="50" height="50" fill="%23f1f2f6" rx="8"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="%23ff4757"%3E깨짐%3C/text%3E%3C/svg%3E'; }} style={{ width: '50px', height: '50px', cursor: 'pointer', objectFit: 'contain' }} />
                  {isAdminMode && !isDefault && (
                    <button onClick={() => handleDeleteEmoticon(emo)} style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ff4757', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} title="이모티콘 삭제">X</button>
                  )}
                </div>
              );
            })}
            {isAdminMode && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', border: '2px dashed #ccc', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#f8f9fa' }} title="새 이모티콘 추가">
                <span style={{ fontSize: '24px', color: '#888', fontWeight: 'bold' }}>+</span>
                <input type="file" accept="image/*" onChange={handleEmoticonUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
              </div>
            )}
          </div>
        )}

        {showActivities && (
          <div style={{ position: 'absolute', bottom: '70px', left: '50px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', width: '280px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
            <h4 style={{ margin: 0, color: '#333', fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>🚀 활동 및 미니게임</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
              {activities.length === 0 && <div style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '10px 0' }}>등록된 활동이 없습니다.</div>}
              {activities.map((act) => (
                // 🌟 신규: url에 http가 없으면 자동으로 붙여주는 예외 처리 로직!
                <div key={act.id} onClick={() => {
                  let finalUrl = act.url.trim();
                  if (!finalUrl.startsWith('/') && !finalUrl.startsWith('http')) {
                    finalUrl = 'http://' + finalUrl;
                  }
                  window.open(finalUrl, '_blank');
                }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', cursor: 'pointer', border: '1px solid #eee', transition: 'background 0.2s' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {renderActivityIcon(act.icon)}
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#2f3542' }}>{act.name}</span>
                  </div>

                  {isAdminMode && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteActivity(act.id); }} style={{ background: '#ff4757', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      X
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isAdminMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', borderTop: '1px dashed #ccc', paddingTop: '12px', width: '100%' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>관리자: 새 활동 추가</span>
                <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                  <input 
                    type="text" 
                    placeholder="이모지/URL" 
                    value={newActivityIcon} 
                    onChange={e => setNewActivityIcon(e.target.value)} 
                    style={{ width: '100px', flexShrink: 0, padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'center', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333' }} 
                  />
                  <input 
                    type="text" 
                    placeholder="게임 이름" 
                    value={newActivityName} 
                    onChange={e => setNewActivityName(e.target.value)} 
                    style={{ flex: 1, minWidth: 0, padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333' }} 
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="URL 경로 (예: /tetris.html)" 
                  value={newActivityUrl} 
                  onChange={e => setNewActivityUrl(e.target.value)} 
                  style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#fff', color: '#333' }} 
                />
                <button 
                  onClick={handleAddActivity} 
                  style={{ width: '100%', padding: '8px', backgroundColor: '#2ed573', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  등록하기
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div 
              onClick={() => { 
                setShowActionMenu(!showActionMenu); 
                if(!showActionMenu) { setShowEmoticons(false); setShowActivities(false); }
              }} 
              style={{ width: '36px', height: '36px', backgroundColor: '#eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: '22px', fontWeight: '300', color: '#555', transition: 'transform 0.2s', transform: showActionMenu ? 'rotate(45deg)' : 'none' }}
            >
              +
            </div>

            {showActionMenu && (
              <div style={{ position: 'absolute', bottom: '45px', left: '0', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '25px', padding: '10px 5px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 20 }}>
                
                <div style={{ position: 'relative', width: '36px', height: '36px', backgroundColor: '#f1f2f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="파일 첨부">
                  <span style={{ fontSize: '16px' }}>📎</span>
                  <input type="file" onChange={(e) => { handleFileUpload(e); setShowActionMenu(false); }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </div>
                
                <div onClick={() => { setShowEmoticons(!showEmoticons); setShowActivities(false); setShowActionMenu(false); }} style={{ width: '36px', height: '36px', backgroundColor: '#f1f2f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="이모티콘">
                  😀
                </div>

                <div onClick={() => { setShowActivities(!showActivities); setShowEmoticons(false); setShowActionMenu(false); }} style={{ width: '36px', height: '36px', backgroundColor: '#f1f2f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="활동 및 미니게임">
                  🚀
                </div>

              </div>
            )}
          </div>

          <input 
            type="text" 
            placeholder="메시지, 붙여넣기, 파일 드래그" 
            value={currentMessage} 
            onClick={closeAllPopups}
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