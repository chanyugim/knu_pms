import fs from 'fs';

// 🌟 핵심: 쉼표가 따옴표 안에 있는지 밖에 있는지 판단해서 쪼개는 똑똑한 함수
function parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            inQuotes = !inQuotes; // 큰따옴표를 만나면 상태를 뒤집음 (안<->밖)
        } else if (char === ',' && !inQuotes) {
            // 따옴표 '밖'에서 쉼표를 만나면 지금까지 읽은 글자를 저장하고 초기화
            result.push(current.trim());
            current = '';
        } else {
            // 일반 글자는 그냥 이어붙임
            current += char;
        }
    }
    result.push(current.trim()); // 줄의 마지막 데이터 추가
    
    // 엑셀이 씌워둔 겉부분의 불필요한 큰따옴표 제거
    return result.map(val => val.replace(/^"|"$/g, '').trim());
}

try {
    // 1. CSV 파일 읽어오기
    const csv = fs.readFileSync('data.csv', 'utf8');

    // 2. 텍스트를 줄바꿈(엔터) 기준으로 나누기 (Mac, Windows 환경 모두 대응)
    const rows = csv.split(/\r?\n/).filter(row => row.trim() !== '');

    // 3. 첫 번째 줄에서 헤더 추출하기 (업그레이드된 함수 사용)
    const headers = parseCSVRow(rows[0]);

    // 4. 두 번째 줄부터 JSON으로 조립하기
    const jsonData = rows.slice(1).map(row => {
        const values = parseCSVRow(row); // 업그레이드된 함수로 데이터 쪼개기
        const obj = {};
        
        headers.forEach((header, index) => {
            let value = values[index] ? values[index] : '';
            // id는 숫자로, 나머지는 문자열로 저장
            obj[header] = header === 'id' ? Number(value) : value;
        });
        return obj;
    });

    // 5. data.json 파일로 저장
    fs.writeFileSync('data.json', JSON.stringify(jsonData, null, 2), 'utf8');
    
    console.log('✅ 괄호 안의 쉼표(,)가 포함된 데이터도 완벽하게 변환되었습니다!');
    
} catch (error) {
    console.error('❌ 변환 중 오류 발생:', error.message);
}