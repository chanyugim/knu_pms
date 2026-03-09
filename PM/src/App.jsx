// src/App.jsx
import { useState } from 'react';
import './App.css';
import mainLogo from '/symbol.png';

// 방금 만든 두 개의 페이지 컴포넌트를 불러옵니다.
import MailPage from './MailPage';
import SecurityPage from './SecurityPage';

function App() {
  const [currentMenu, setCurrentMenu] = useState('mail'); // 'mail' | 'security'
  const [clickCount, setClickCount] = useState(0);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount === 10) {
      setIsAdminMode(true);
      setClickCount(0); // 횟수 초기화
      alert('관리자 모드가 활성화되었습니다');
    }
  };

  // 메뉴 전환 버튼 클릭 시
  const toggleMenu = () => {
    setCurrentMenu(currentMenu === 'mail' ? 'security' : 'mail');
    setIsAdminMode(false);
  };

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100dvh', 
      boxSizing: 'border-box', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' 
    }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', borderBottom: '2px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px'}}>
          <img src={mainLogo} className="logo" alt="main logo" onClick={handleLogoClick} style={{ cursor: 'pointer', height: '60px', padding: 0 }} />
          <h1 style={{ margin: 0, fontSize: '2em' }}>행정실</h1>
        </div>

        <button onClick={toggleMenu} style={{ 
          padding: '12px 20px', backgroundColor: currentMenu === 'mail' ? '#1e90ff' : '#ff7f50',
          color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' 
        }}>
          {currentMenu === 'mail' ? '문단속 하러가기' : '우편물 검색하기'}
        </button>
      </div>

      {currentMenu === 'mail' ? (
        <MailPage isAdminMode={isAdminMode} setIsAdminMode={setIsAdminMode} />
      ) : (
        <SecurityPage isAdminMode={isAdminMode} setIsAdminMode={setIsAdminMode} />
      )}

    </div>
  );
}

export default App;