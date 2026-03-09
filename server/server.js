import express from 'express'
import cors from 'cors'
import  fs from 'fs'
import path from 'path'
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config();

const app = express();
const PORT = 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ipAddr = process.env.IP_ADDRESS;
const upload = multer({ storage: multer.memoryStorage() });
app.use(cors());
app.use(express.json());

// 사내망 IP 대역만 허용하는 보안 미들웨어
const checkLocalIP = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    // IPv4, IPv6 로컬 주소 및 사설 IP 대역 확인 (192.168.x.x, 10.x.x.x 등)
    if (clientIP.includes(ipAddr) || clientIP.includes('::1') || clientIP.includes('192.168.') || clientIP.includes('10.')) {
        next();
    } else {
        res.status(403).json({ error: "외부 네트워크에서는 접근할 수 없습니다." });
    }
};

// 우편 수신자 검색 API
app.get('/api/employees', (req, res) => {
    const dataPath = path.join(__dirname, 'data.json');
    
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: "데이터를 불러오는 중 오류가 발생했습니다." });
        }
        res.json(JSON.parse(data));
    });
});

app.post('/api/employees/update', (req, res) => {
    const updatedData = req.body; 
    const dataPath = path.join(__dirname, 'data.json');
    
    //(들여쓰기 2칸 적용)
    fs.writeFile(dataPath, JSON.stringify(updatedData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("데이터 저장 실패:", err);
            return res.status(500).json({ error: "데이터를 저장하는 중 오류가 발생했습니다." });
        }
        res.json({ message: "데이터가 성공적으로 업데이트되었습니다!" });
    });
});

app.post('/api/ocr', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "이미지가 없습니다." });
        }
        const ocrApiUrl = process.env.NAVER_OCR_URL;
        const ocrSecretKey = process.env.NAVER_OCR_SECRET;

        const message = {
            images: [
                {
                    format: req.file.mimetype.split('/')[1], 
                    name: "mail_scan_image"
                }
            ],
            requestId: `req-${Date.now()}`,
            version: "V2",
            timestamp: Date.now()
        };

        const formData = new FormData();
        formData.append('message', JSON.stringify(message));
        formData.append('file', req.file.buffer, { filename: req.file.originalname });

        const response = await axios.post(ocrApiUrl, formData, {
            headers: {
                'X-OCR-SECRET': ocrSecretKey,
                ...formData.getHeaders()
            }
        });

        const textResults = response.data.images[0].fields.map(field => field.inferText);
        const fullText = textResults.join(' ');

        let filteredText = fullText;
        
        filteredText = filteredText.replace(/충청남도|충남|천안시|천안|동남구|서북구|공주대학교|공주대|국립공주대학교|천안공대|천안공과대학|천안캠퍼스|공주대공과대학|[가-힣]+(로|길)\s?\d+(-\d+)?/g, ' ');
        
        filteredText = filteredText.replace(/[가-힣]+(학과|학부|전공)/g, ' ');

        filteredText = filteredText.replace(/받는사람|받는분|수신자|귀하|담당자|연락처|고객님|우편번호|배송지|주소|전화번호|HP/g, ' ');
        filteredText = filteredText.replace(/(박사|교수|연구원|선생|조교|소장|센터장|팀장|처장)(님)?/g, ' ');
        
        filteredText = filteredText.replace(/(0\d{1,3})[- .\s]*\d{3,4}[- .\s]*\d{4}/g, ' ');
        
        filteredText = filteredText.replace(/1[568]\d{2}[- .\s]*\d{4}/g, ' ');
        
        filteredText = filteredText.replace(/\b\d{5}\b/g, ' '); 

        const words = filteredText.split(/\s+/).filter(word => {
            return word.length > 1 && /[가-힣0-9a-zA-Z]/.test(word);
        });

        const finalSearchTerm = words.join(' ');

        res.json({ text: finalSearchTerm });

    } catch (error) {
        console.error("OCR 통신 에러 상세:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "글자를 인식하는 데 실패했습니다." });
    }
});

app.get('/api/security', (req, res) => {
    const securityPath = path.join(__dirname, 'security.json');
    fs.readFile(securityPath, 'utf8', (err, data) => {
        if (err) {
            // 파일이 없으면 빈 배열을 반환합니다.
            return res.json([]); 
        }
        res.json(JSON.parse(data));
    });
});

app.post('/api/security/update', (req, res) => {
    const updatedData = req.body;
    const securityPath = path.join(__dirname, 'security.json');
    
    fs.writeFile(securityPath, JSON.stringify(updatedData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("문단속 데이터 저장 실패:", err);
            return res.status(500).json({ error: "데이터를 저장하는 중 오류가 발생했습니다." });
        }
        res.json({ message: "문단속 데이터가 성공적으로 업데이트되었습니다!" });
    });
});

app.get('/api/aliases', (req, res) => {
    const aliasPath = path.join(__dirname, 'alias.json');
    
    fs.readFile(aliasPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: "유의어 사전을 불러오는 중 오류가 발생했습니다." });
        }
        res.json(JSON.parse(data));
    });
});

app.use(express.static(path.join(__dirname, './public')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, './public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});