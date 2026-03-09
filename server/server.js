import express from 'express'
import cors from 'cors'
import  fs from 'fs'
import path from 'path'
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import http from 'http'; // 🌟 추가: Socket.IO를 얹기 위한 기본 HTTP 모듈
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const PORT = 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ipAddr = process.env.IP_ADDRESS;
const upload = multer({ storage: multer.memoryStorage() });
const server = http.createServer(app); 
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // 한글 파일명 깨짐 방지 및 중복 방지를 위해 앞에 시간을 붙임
        const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + safeName);
    }
});
const chatUpload = multer({ storage: chatStorage });
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

app.post('/api/chat/upload', chatUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "파일 업로드 실패" });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, name: req.file.originalname, size: req.file.size });
});

const noticePath = path.join(__dirname, 'notice.json');
const chatPath = path.join(__dirname, 'chat.json');
let chatNotice = "행정실 채팅방에 오신 것을 환영합니다.";

if (fs.existsSync(noticePath)) {
    // 파일이 있으면 읽어오기
    chatNotice = JSON.parse(fs.readFileSync(noticePath, 'utf8')).notice;
} else {
    // 파일이 없으면 기본값으로 새로 만들기
    fs.writeFileSync(noticePath, JSON.stringify({ notice: chatNotice }), 'utf8');
}

let chatHistory = [];
const MAX_HISTORY = 50;

if (fs.existsSync(chatPath)) {
    try {
        chatHistory = JSON.parse(fs.readFileSync(chatPath, 'utf8'));
    } catch (err) {
        console.error("채팅 기록을 읽어오는데 실패했습니다.", err);
        chatHistory = [];
    }
} else {
    // 파일이 없으면 빈 배열로 새로 만들기
    fs.writeFileSync(chatPath, JSON.stringify(chatHistory), 'utf8');
}

io.on('connection', (socket) => {
    console.log('🟢 새 사용자가 채팅에 접속했습니다:', socket.id);
    
    // 입장 시 과거 채팅 기록 50개 + 공지사항 전달
    socket.on('requestHistory', () => {
        socket.emit('loadHistory', chatHistory);
        socket.emit('receiveNotice', chatNotice);
    });

    // 🌟 4. 누군가 메시지를 보냈을 때 (배열 업데이트 + 파일 영구 저장)
    socket.on('sendMessage', (messageData) => {
        // 단기 기억(RAM) 업데이트
        chatHistory.push(messageData);
        if (chatHistory.length > MAX_HISTORY) {
            chatHistory.shift(); 
        }
        
        // 🌟 하드디스크(chat.json)에 즉시 덮어쓰기 (영구 저장)
        fs.writeFile(chatPath, JSON.stringify(chatHistory, null, 2), 'utf8', (err) => {
            if (err) console.error("채팅 기록 저장 실패:", err);
        });

        // 모두에게 새 메시지 전송
        io.emit('receiveMessage', messageData);
    });

    // 관리자가 공지를 수정했을 때
    socket.on('updateNotice', (newNotice) => {
        chatNotice = newNotice;
        fs.writeFile(noticePath, JSON.stringify({ notice: chatNotice }), 'utf8', (err) => {
            if (err) console.error("공지사항 저장 실패:", err);
        });
        io.emit('receiveNotice', chatNotice);
    });

    socket.on('disconnect', () => {
        console.log('🔴 사용자가 채팅을 떠났습니다:', socket.id);
    });
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`서버 및 실시간 채팅이 포트 ${PORT}에서 실행 중입니다.`);
});