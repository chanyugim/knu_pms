export default function MobileCardView({ data }) {
  if (data.length === 0) return <p style={{ textAlign: 'center' }}>검색 결과가 없습니다.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {data.map(emp => (
        <div 
          key={emp.id} 
          style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            border: '1px solid #eaeaea'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#333' }}>{emp.name}</h3>
            <span style={{ backgroundColor: '#e6f2ff', color: '#007bff', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px' }}>
              {emp.room}
            </span>
          </div>
          <div style={{ textAlign: 'left', color: '#666', fontSize: '15px', lineHeight: '1.6' }}>
            <p style={{ margin: '4px 0' }}>🏢 <strong>학과:</strong> {emp.department}</p>
            <p style={{ margin: '4px 0' }}>📞 <strong>학과내선:</strong> {emp.phone}</p>
          </div>
        </div>
      ))}
    </div>
  );
}