// src/App.jsx
import { useState } from 'react';
import './App.css';
import mainLogo from '/symbol.png';

// 3개의 페이지 컴포넌트를 모두 불러옵니다.
import MailPage from './MailPage';
import SecurityPage from './SecurityPage';
import ChatPage from './ChatPage'; // 🌟 새로 추가된 채팅 페이지

function App() {
  // 상태가 3개로 늘어났습니다: 'mail' | 'security' | 'chat'
  const [currentMenu, setCurrentMenu] = useState('mail'); 
  const [clickCount, setClickCount] = useState(0);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [chatNickname, setChatNickname] = useState('');
  const [isChatJoined, setIsChatJoined] = useState(false);

  // 로고 10번 클릭 시 관리자 모드 켜기 (기존과 동일)
  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount === 10) {
      setIsAdminMode(true);
      setClickCount(0); // 횟수 초기화
      alert('관리자 모드가 활성화되었습니다');
    }
  };

  // 🌟 메뉴 탭을 눌렀을 때 실행되는 함수
  const handleMenuChange = (menuName) => {
    setCurrentMenu(menuName);
    setIsAdminMode(false); // 다른 탭으로 이동하면 관리자 모드는 자동으로 꺼짐
  };

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100dvh', 
      boxSizing: 'border-box', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' 
    }}>
      
      {/* 상단 헤더 영역 (버튼을 빼고 로고와 타이틀만 중앙/좌측 정렬로 깔끔하게 배치) */}
      <div style={{ 
        display: 'flex', justifyContent: 'center', alignItems: 'center', 
        padding: '15px 20px', 
        backgroundColor: '#242424', /* 짙고 고급스러운 네이비색 */
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)', /* 아래로 살짝 떨어지는 그림자 */
        zIndex: 10 /* 그림자가 탭 위로 올라오도록 층 올리기 */
      }}>
        <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-start', /* 🌟 핵심: 내용물을 모두 왼쪽으로 밀착! */
        alignItems: 'center', 
        width: '100%', 
        height: '70px', 
        padding: '0 20px', /* 좌우 여백 20px 확보 */
        boxSizing: 'border-box', /* 패딩 때문에 박스가 화면 밖으로 삐져나가는 것 방지 */
        backgroundColor: '#242424', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)', 
        zIndex: 10 
      }}>
        
        {/* 1. 좌측 로고 (공중부양 해제, 자연스럽게 흐름에 합류) */}
        <img 
          src={mainLogo} 
          className="logo" 
          alt="main logo" 
          onClick={handleLogoClick} 
          style={{ 
            cursor: 'pointer', 
            height: '45px', 
            padding: 0,
            marginRight: '15px', /* 🌟 로고와 글자 사이의 간격 띄우기 */
            filter: 'drop-shadow(0px 0px 4px rgba(255, 255, 255, 0.3))' 
          }} 
        />
        
        {/* 2. 로고 바로 옆에 예쁘게 붙는 타이틀 */}
        <h1 style={{ 
          margin: 0, 
          fontSize: '1.7em', 
          color: '#ffffff', 
          letterSpacing: '2px', 
          fontWeight: '800'
        }}>
          행정실
        </h1>
        
      </div>
      </div>

      {/* 🌟 새로운 3단 탭 네비게이션 바 */}
      <div style={{ display: 'flex', borderBottom: '2px solid #eee', borderTop: '1px solid #eee' }}>
        <button 
          onClick={() => handleMenuChange('mail')} 
          style={{ 
            flex: 1, padding: '15px 0', fontSize: '15px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s',
            backgroundColor: currentMenu === 'mail' ? '#1e90ff' : '#f8f9fa', 
            color: currentMenu === 'mail' ? 'white' : '#666'
          }}
        >
          📮 우편물
        </button>
        <button 
          onClick={() => handleMenuChange('security')} 
          style={{ 
            flex: 1, padding: '15px 0', fontSize: '15px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s',
            borderLeft: '1px solid #ddd', borderRight: '1px solid #ddd',
            backgroundColor: currentMenu === 'security' ? '#ff7f50' : '#f8f9fa', 
            color: currentMenu === 'security' ? 'white' : '#666'
          }}
        >
          🔒 문단속
        </button>
        <button 
          onClick={() => handleMenuChange('chat')} 
          style={{ 
            flex: 1, padding: '15px 0', fontSize: '15px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s',
            backgroundColor: currentMenu === 'chat' ? '#2ed573' : '#f8f9fa', 
            color: currentMenu === 'chat' ? 'white' : '#666'
          }}
        >
          💬 채팅방
        </button>
      </div>

      {/* 선택된 메뉴에 따라 화면을 바꿔 끼워주는 영역 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {currentMenu === 'mail' && <MailPage isAdminMode={isAdminMode} setIsAdminMode={setIsAdminMode} />}
        {currentMenu === 'security' && <SecurityPage isAdminMode={isAdminMode} setIsAdminMode={setIsAdminMode} />}
        {currentMenu === 'chat' && (
          <ChatPage 
            nickname={chatNickname} 
            setNickname={setChatNickname} 
            isJoined={isChatJoined} 
            setIsJoined={setIsChatJoined}
            isAdminMode={isAdminMode} 
            setIsAdminMode={setIsAdminMode} 
          />
        )}
      </div>

    </div>
  );
}

export default App;