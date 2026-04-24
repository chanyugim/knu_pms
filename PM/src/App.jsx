import { act, useState } from 'react';
import './App.css';
import mainLogo from '/symbol.png';

import MailPage from './MailPage';
import SecurityPage from './SecurityPage';
import ChatPage from './ChatPage';

function App() {
  const randomTitle = Math.floor(Math.random()*100) < 2 ? "행정실 꼼수 사이트" : "행정실";
  const [currentMenu, setCurrentMenu] = useState('mail');
  const [activePage, setActivePage] = useState('search');
  const [clickCount, setClickCount] = useState(0);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [chatNickname, setChatNickname] = useState('');
  const [isChatJoined, setIsChatJoined] = useState(false);
  
  const [isGlobalScanning, setIsGlobalScanning] = useState(false);

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount === 10) {
      setIsAdminMode(true);
      setClickCount(0);
      alert('관리자 모드가 활성화되었습니다');
    }
  };

  const handleMenuChange = (menuName) => {
    if (isGlobalScanning) return;
    setCurrentMenu(menuName);
    setIsAdminMode(false); 
  };

  return (
    <div className="app-container" style={{ 
      display: 'flex', flexDirection: 'column', height: '100dvh', 
      boxSizing: 'border-box', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' 
    }}>
      <style>
        {`
          button:focus, button:focus-visible, button:active {
            outline: none !important;
            box-shadow: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          body {
            margin: 0;
            background-color: #e5e7eb; 
          }
          .app-container {
            background-color: #fff;
            box-shadow: 0 0 20px rgba(0,0,0,0.05);
          }
          @media (min-width: 1024px) {
            .app-container {
              margin-top: 2vh !important;
              margin-bottom: 2vh !important;
              height: 96vh !important;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            }
          }
        `}
      </style>

      <div style={{ 
        display: 'flex', justifyContent: 'flex-start', alignItems: 'center', 
        width: '100%', height: '70px', padding: '0 20px', boxSizing: 'border-box', 
        backgroundColor: '#242424', zIndex: 10 
      }}>
        <img 
          src={mainLogo} className="logo" alt="main logo" onClick={handleLogoClick} 
          style={{ cursor: 'pointer', height: '45px', padding: 0, marginRight: '15px', filter: 'drop-shadow(0px 0px 4px rgba(255, 255, 255, 0.3))' }} 
        />
        <h1 style={{ margin: 0, fontSize: '1.7em', color: '#ffffff', letterSpacing: '2px', fontWeight: '800' }}>
          {randomTitle}
        </h1>
      </div>

      <div style={{ display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #ddd', zIndex: 5 }}>
        <button 
          onClick={() => handleMenuChange('mail')} 
          disabled={isGlobalScanning}
          style={{ 
            flex: 1, padding: '16px 0', fontSize: '15px', fontWeight: 'bold', border: 'none', 
            transition: 'all 0.2s ease-in-out', backgroundColor: 'transparent',
            cursor: isGlobalScanning ? 'not-allowed' : 'pointer',
            opacity: isGlobalScanning && currentMenu !== 'mail' ? 0.4 : 1,
            pointerEvents: isGlobalScanning ? 'none' : 'auto',
            color: currentMenu === 'mail' ? '#1e90ff' : '#888',
            borderBottom: currentMenu === 'mail' ? '3px solid #1e90ff' : '3px solid transparent'
          }}
        >
          📮 우편물
        </button>
        <button 
          onClick={() => {handleMenuChange('security'); setActivePage('search');}} 
          disabled={isGlobalScanning}
          style={{ 
            flex: 1, padding: '16px 0', fontSize: '15px', fontWeight: 'bold', border: 'none', 
            transition: 'all 0.2s ease-in-out', backgroundColor: 'transparent',
            cursor: isGlobalScanning ? 'not-allowed' : 'pointer',
            opacity: isGlobalScanning && currentMenu !== 'security' ? 0.4 : 1,
            pointerEvents: isGlobalScanning ? 'none' : 'auto',
            color: currentMenu === 'security' ? '#ff7f50' : '#888',
            borderBottom: currentMenu === 'security' ? '3px solid #ff7f50' : '3px solid transparent'
          }}
        >
          🔒 문단속
        </button>
        <button 
          onClick={() => handleMenuChange('chat')} 
          disabled={isGlobalScanning}
          style={{ 
            flex: 1, padding: '16px 0', fontSize: '15px', fontWeight: 'bold', border: 'none', 
            transition: 'all 0.2s ease-in-out', backgroundColor: 'transparent',
            cursor: isGlobalScanning ? 'not-allowed' : 'pointer',
            opacity: isGlobalScanning && currentMenu !== 'chat' ? 0.4 : 1,
            pointerEvents: isGlobalScanning ? 'none' : 'auto',
            color: currentMenu === 'chat' ? '#2ed573' : '#888',
            borderBottom: currentMenu === 'chat' ? '3px solid #2ed573' : '3px solid transparent'
          }}
        >
          💬 채팅방
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f6fa' }}>
        {currentMenu === 'mail' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <MailPage 
              isAdminMode={isAdminMode} 
              setIsAdminMode={setIsAdminMode} 
              setIsGlobalScanning={setIsGlobalScanning}
              chatNickname={chatNickname} 
              setActivePage={setActivePage}
            />
          </div>
        )}
        {currentMenu === 'security' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <SecurityPage isAdminMode={isAdminMode} setIsAdminMode={setIsAdminMode} />
          </div>
        )}
        {currentMenu === 'chat' && (
          <ChatPage 
            nickname={chatNickname} setNickname={setChatNickname} 
            isJoined={isChatJoined} setIsJoined={setIsChatJoined}
            isAdminMode={isAdminMode} setIsAdminMode={setIsAdminMode} 
          />
        )}
      </div>

      {(currentMenu !== 'chat' && currentMenu !== 'security' && activePage !== 'registered' && isAdminMode !== true) && (
        <div style={{ 
          backgroundColor: '#f8f9fa', padding: '12px 20px', borderTop: '1px solid #ddd', 
          display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#555', zIndex: 4
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>📱</span>
            <span style={{ lineHeight: '1.4' }}><strong>아이폰 사용자:</strong> Safari 하단 메뉴에서 <strong>'홈 화면에 추가'</strong>를 하시면 앱처럼 접속할 수 있습니다.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🔒</span>
            <span style={{ lineHeight: '1.4' }}><strong>접속 안내:</strong> 본 시스템은 <strong>교내 네트워크</strong> 환경에서만 접속이 가능합니다.</span>
          </div>
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <a 
              href="/manual.pdf" 
              download="행정실_사이트_사용_설명서.pdf"
              style={{
                display: 'inline-block',
                padding: '6px 12px',
                fontSize: '12px',
                color: '#4b4b4b',
                backgroundColor: '#f1f2f6',
                border: '1px solid #d1d8e0',
                borderRadius: '6px',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              사이트 사용 설명서 다운로드
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;