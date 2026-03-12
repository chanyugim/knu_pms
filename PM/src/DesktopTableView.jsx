export default function DesktopTableView({ data }) {
  if (data.length === 0) return <p style={{ textAlign: 'center' }}>검색 결과가 없습니다.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <thead>
        <tr style={{borderBottom: '2px solid #dee2e6' }}>
          <th style={{ padding: '15px', textAlign: 'left' }}>이름</th>
          <th style={{ padding: '15px', textAlign: 'left' }}>학과</th>
          <th style={{ padding: '15px', textAlign: 'left' }}>호실</th>
          <th style={{ padding: '15px', textAlign: 'left' }}>학과내선번호</th>
        </tr>
      </thead>
      <tbody>
        {data.map(emp => (
          <tr key={emp.id} style={{ borderBottom: '1px solid #dee2e6', transition: 'background-color 0.2s' }}>
            <td style={{ padding: '15px', fontWeight: 'bold' }}>{emp.name}</td>
            <td style={{ padding: '15px' }}>{emp.department}</td>
            <td style={{ padding: '15px', fontWeight: 'bold' }}>{emp.room}</td>
            <td style={{ padding: '15px' }}>{emp.phone}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}