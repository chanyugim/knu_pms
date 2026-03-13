import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http'; 
import { Server } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchPrompt, registerdPrompt } from './prompts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT_NUM || 8080;
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
        const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + safeName);
    }
});
const chatUpload = multer({ storage: chatStorage });

app.use(cors());
app.use(express.json());

const checkLocalIP = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    if (!clientIP) return next();
    if (clientIP.includes(ipAddr) || clientIP.includes('::1') || clientIP.includes('192.168.') || clientIP.includes('10.')) {
        next();
    } else {
        res.status(403).json({ error: "외부 네트워크에서는 접근할 수 없습니다." });
    }
};

app.get('/api/employees', (req, res) => {
    const dataPath = path.join(__dirname, 'data.json');
    if (!fs.existsSync(dataPath)) return res.json([]); 
    
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) return res.json([]);
        try {
            res.json(JSON.parse(data)); 
        } catch (e) {
            res.json([]);
        }
    });
});

app.post('/api/employees/update', (req, res) => {
    const updatedData = req.body; 
    const dataPath = path.join(__dirname, 'data.json');
    fs.writeFile(dataPath, JSON.stringify(updatedData, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: "데이터 저장 실패" });
        res.json({ message: "업데이트 성공" });
    });
});

app.get('/api/aliases', (req, res) => {
    const aliasPath = path.join(__dirname, 'alias.json');
    if (!fs.existsSync(aliasPath)) return res.json({});
    
    fs.readFile(aliasPath, 'utf8', (err, data) => {
        if (err) return res.json({});
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            res.json({});
        }
    });
});

app.get('/api/security', (req, res) => {
    const securityPath = path.join(__dirname, 'security.json');
    if (!fs.existsSync(securityPath)) return res.json([]);
    
    fs.readFile(securityPath, 'utf8', (err, data) => {
        if (err) return res.json([]);
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            res.json([]);
        }
    });
});

app.post('/api/security/update', (req, res) => {
    const updatedData = req.body;
    const securityPath = path.join(__dirname, 'security.json');
    fs.writeFile(securityPath, JSON.stringify(updatedData, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: "문단속 저장 실패" });
        res.json({ message: "업데이트 성공" });
    });
});

app.post('/api/ocr', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "이미지가 없습니다." });
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

        const imageParts = [{
            inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype }
        }];

        const result = await model.generateContent([searchPrompt, ...imageParts]);
        const response = await result.response;
        const text = response.text().trim();

        res.json({ text: text });
    } catch (error) {
        console.error("Gemini API 에러:", error);
        res.status(500).json({ error: "글자 인식 실패" });
    }
});

app.post('/api/ocr/registered', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "이미지가 없습니다." });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

        const imageParts = [{
            inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype }
        }];
        const result = await model.generateContent([registerdPrompt, ...imageParts]);
        const response = await result.response;
        let text = response.text().trim();
        
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsedData = JSON.parse(text); 
        res.json(parsedData);
    } catch (error) {
        console.error("등기 스캔 에러:", error);
        res.status(500).json({ error: "등기 정보 추출에 실패했습니다." });
    }
});

app.post('/api/chat/upload', chatUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "파일 업로드 실패" });
    res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size });
});

const emoticonDir = path.join(__dirname, 'public', 'emoticons');
if (!fs.existsSync(emoticonDir)) fs.mkdirSync(emoticonDir, { recursive: true });

const emoticonStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, emoticonDir),
    filename: (req, file, cb) => {
        const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + safeName);
    }
});
const emoticonUpload = multer({ storage: emoticonStorage });

app.get('/api/emoticons', (req, res) => {
    fs.readdir(emoticonDir, (err, files) => {
        if (err) return res.json([]);
        const urls = files.map(file => `/emoticons/${file}`);
        res.json(urls);
    });
});

app.post('/api/emoticons/upload', emoticonUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "업로드 실패" });
    res.json({ url: `/emoticons/${req.file.filename}` });
});

app.post('/api/emoticons/delete', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL 정보가 없습니다." });

    const fileName = path.basename(url);
    const filePath = path.join(emoticonDir, fileName);

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error("이모티콘 삭제 실패:", err);
                return res.status(500).json({ error: "파일 삭제 중 오류가 발생했습니다." });
            }
            res.json({ message: "이모티콘이 성공적으로 삭제되었습니다." });
        });
    } else {
        res.json({ message: "이미 삭제된 파일입니다." });
    }
});

const noticePath = path.join(__dirname, 'notice.json');
const chatPath = path.join(__dirname, 'chat.json');
let chatNotice = "행정실 채팅방에 오신 것을 환영합니다.";

if (fs.existsSync(noticePath)) {
    try { chatNotice = JSON.parse(fs.readFileSync(noticePath, 'utf8')).notice; } catch(e){}
} else {
    fs.writeFileSync(noticePath, JSON.stringify({ notice: chatNotice }), 'utf8');
}

let chatHistory = [];
const MAX_HISTORY = 50;

if (fs.existsSync(chatPath)) {
    try { chatHistory = JSON.parse(fs.readFileSync(chatPath, 'utf8')); } catch(e) { chatHistory = []; }
} else {
    fs.writeFileSync(chatPath, JSON.stringify(chatHistory), 'utf8');
}

io.on('connection', (socket) => {
    console.log('🟢 접속 완료:', socket.id);
    
    io.emit('userCount', io.engine.clientsCount);

    socket.on('disconnect', () => {
        console.log('🔴 접속 종료:', socket.id);
        io.emit('userCount', io.engine.clientsCount);
    });
    
    socket.on('requestHistory', () => {
        socket.emit('loadHistory', Array.isArray(chatHistory) ? chatHistory : []);
        socket.emit('receiveNotice', chatNotice);
    });

    socket.on('sendMessage', (messageData) => {
        if (!Array.isArray(chatHistory)) chatHistory = [];
        chatHistory.push(messageData);
        if (chatHistory.length > MAX_HISTORY) chatHistory.shift(); 
        fs.writeFile(chatPath, JSON.stringify(chatHistory, null, 2), 'utf8', () => {});
        io.emit('receiveMessage', messageData);
    });

    socket.on('updateNotice', (newNotice) => {
        chatNotice = newNotice;
        fs.writeFile(noticePath, JSON.stringify({ notice: chatNotice }), 'utf8', () => {});
        io.emit('receiveNotice', chatNotice);
    });

    // 🌟 핵심 수정: 파일에 저장되었던 과거 기록 삭제를 위해 String 변환 후 비교
    socket.on('deleteMessage', (msgId) => {
        chatHistory = chatHistory.filter(msg => String(msg.id) !== String(msgId));
        fs.writeFile(chatPath, JSON.stringify(chatHistory, null, 2), 'utf8', () => {});
        io.emit('deleteMessage', msgId); 
    });

    socket.on('clearHistory', () => {
        chatHistory = [];
        fs.writeFile(chatPath, JSON.stringify(chatHistory), 'utf8', () => {});
        io.emit('clearHistory'); 
    });
});

app.use(express.static(path.join(__dirname, './public')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, './public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`서버 및 실시간 채팅이 포트 ${PORT}에서 실행 중입니다.`);
    console.log(process.env.DM);
});