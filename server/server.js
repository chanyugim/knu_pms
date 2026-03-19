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
// 기존 prompts.js 임포트는 삭제되었습니다.

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

// 🌟 신규: 프롬프트 관리를 위한 JSON 파일 초기화
const promptsPath = path.join(__dirname, 'prompts.json');
if (!fs.existsSync(promptsPath)) {
    fs.writeFileSync(promptsPath, JSON.stringify({ searchPrompt: "우편물 수신자 이름과 호실을 추출해줘.", registerdPrompt: "등기 우편 정보를 JSON으로 추출해줘." }), 'utf8');
}

const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + safeName);
    }
});
const chatUpload = multer({ 
    storage: chatStorage,
    limits: { fileSize: 500 * 1024 * 1024 }
});

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

// 🌟 신규: AI 스캔 프롬프트 조회 API
app.get('/api/prompts', (req, res) => {
    if (!fs.existsSync(promptsPath)) return res.json({ searchPrompt: "", registerdPrompt: "" });
    fs.readFile(promptsPath, 'utf8', (err, data) => {
        if (err) return res.json({ searchPrompt: "", registerdPrompt: "" });
        try { res.json(JSON.parse(data)); } catch (e) { res.json({ searchPrompt: "", registerdPrompt: "" }); }
    });
});

// 🌟 신규: AI 스캔 프롬프트 수정(저장) API
app.post('/api/prompts/update', (req, res) => {
    fs.writeFile(promptsPath, JSON.stringify(req.body, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: "프롬프트 저장 실패" });
        res.json({ message: "프롬프트 업데이트 성공" });
    });
});

app.get('/api/employees', (req, res) => {
    const dataPath = path.join(__dirname, 'data.json');
    if (!fs.existsSync(dataPath)) return res.json([]); 
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) return res.json([]);
        try { res.json(JSON.parse(data)); } catch (e) { res.json([]); }
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
        try { res.json(JSON.parse(data)); } catch (e) { res.json({}); }
    });
});

app.get('/api/security', (req, res) => {
    const securityPath = path.join(__dirname, 'security.json');
    if (!fs.existsSync(securityPath)) return res.json([]);
    fs.readFile(securityPath, 'utf8', (err, data) => {
        if (err) return res.json([]);
        try { res.json(JSON.parse(data)); } catch (e) { res.json([]); }
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
        
        // 🌟 수정: 하드코딩 대신 파일에서 동적으로 프롬프트를 불러옵니다.
        const promptsData = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
        const currentSearchPrompt = promptsData.searchPrompt || "우편물 수신자 이름과 호실을 추출해줘.";

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

        const imageParts = [{
            inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype }
        }];

        const result = await model.generateContent([currentSearchPrompt, ...imageParts]);
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
        
        // 🌟 수정: 등기 프롬프트 동적 불러오기
        const promptsData = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
        const currentRegisteredPrompt = promptsData.registerdPrompt || "등기 우편 정보를 JSON으로 추출해줘.";

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

        const imageParts = [{
            inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype }
        }];
        const result = await model.generateContent([currentRegisteredPrompt, ...imageParts]);
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

app.post('/api/chat/upload', (req, res) => {
    chatUpload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: "파일 크기는 500MB를 초과할 수 없습니다." });
        } else if (err) {
            return res.status(500).json({ error: "파일 업로드 중 서버 에러가 발생했습니다." });
        }
        if (!req.file) return res.status(400).json({ error: "파일 업로드 실패" });
        res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size });
    });
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
            if (err) return res.status(500).json({ error: "파일 삭제 중 오류가 발생했습니다." });
            res.json({ message: "이모티콘이 성공적으로 삭제되었습니다." });
        });
    } else {
        res.json({ message: "이미 삭제된 파일입니다." });
    }
});

const noticePath = path.join(__dirname, 'notice.json');
const chatPath = path.join(__dirname, 'chat.json');
let chatNotice = "행정실 채팅방에 오신 것을 환영합니다.";

const activitiesPath = path.join(__dirname, 'activities.json');
let activitiesList = [];
if (fs.existsSync(activitiesPath)) {
    try { activitiesList = JSON.parse(fs.readFileSync(activitiesPath, 'utf8')); } catch(e) { activitiesList = []; }
} else {
    fs.writeFileSync(activitiesPath, JSON.stringify(activitiesList), 'utf8');
}

if (fs.existsSync(noticePath)) {
    try { chatNotice = JSON.parse(fs.readFileSync(noticePath, 'utf8')).notice; } catch(e){}
} else {
    fs.writeFileSync(noticePath, JSON.stringify({ notice: chatNotice }), 'utf8');
}

let chatHistory = [];
const MAX_HISTORY = 200;

if (fs.existsSync(chatPath)) {
    try { chatHistory = JSON.parse(fs.readFileSync(chatPath, 'utf8')); } catch(e) { chatHistory = []; }
} else {
    fs.writeFileSync(chatPath, JSON.stringify(chatHistory), 'utf8');
}

const activeUsers = new Map();

const deleteAttachedFile = (msg) => {
    if (msg && (msg.type === 'image' || msg.type === 'file') && msg.fileUrl && msg.fileUrl.startsWith('/uploads/')) {
        const fileName = path.basename(msg.fileUrl);
        const filePath = path.join(uploadDir, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error(`파일 자동 삭제 실패: ${fileName}`, err);
            });
        }
    }
};

io.on('connection', (socket) => {
    console.log('🟢 소켓 접속:', socket.id);
    
    io.emit('userCount', io.engine.clientsCount);

    socket.on('joinRoom', (nickname, callback) => {
        let isDuplicate = false;
        for (let [id, name] of activeUsers.entries()) {
            if (name === nickname && id !== socket.id) {
                isDuplicate = true;
                break;
            }
        }
        if (isDuplicate) {
            callback({ success: false }); 
        } else {
            activeUsers.set(socket.id, nickname); 
            callback({ success: true });
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 소켓 종료:', socket.id);
        if (activeUsers.has(socket.id)) activeUsers.delete(socket.id); 
        io.emit('userCount', io.engine.clientsCount);
    });
    
    socket.on('requestHistory', () => {
        socket.emit('loadHistory', Array.isArray(chatHistory) ? chatHistory : []);
        socket.emit('receiveNotice', chatNotice);
        socket.emit('userCount', io.engine.clientsCount);
        socket.emit('loadActivities', activitiesList);
    });

    socket.on('sendMessage', (messageData) => {
        if (!Array.isArray(chatHistory)) chatHistory = [];
        chatHistory.push(messageData);
        
        while (chatHistory.length > MAX_HISTORY) {
            const oldestMsg = chatHistory.shift(); 
            deleteAttachedFile(oldestMsg); 
        }
        
        fs.writeFile(chatPath, JSON.stringify(chatHistory, null, 2), 'utf8', () => {});
        io.emit('receiveMessage', messageData);
    });

    socket.on('updateNotice', (newNotice) => {
        chatNotice = newNotice;
        fs.writeFile(noticePath, JSON.stringify({ notice: chatNotice }), 'utf8', () => {});
        io.emit('receiveNotice', chatNotice);
    });

    socket.on('addActivity', (activity) => {
        activity.id = Date.now();
        activitiesList.push(activity);
        fs.writeFile(activitiesPath, JSON.stringify(activitiesList, null, 2), 'utf8', () => {});
        io.emit('loadActivities', activitiesList);
    });

    socket.on('deleteActivity', (id) => {
        activitiesList = activitiesList.filter(a => String(a.id) !== String(id));
        fs.writeFile(activitiesPath, JSON.stringify(activitiesList, null, 2), 'utf8', () => {});
        io.emit('loadActivities', activitiesList); 
    });

    socket.on('deleteMessage', (msgId) => {
        const msgToDelete = chatHistory.find(msg => String(msg.id) === String(msgId));
        if (msgToDelete) deleteAttachedFile(msgToDelete);

        chatHistory = chatHistory.filter(msg => String(msg.id) !== String(msgId));
        fs.writeFile(chatPath, JSON.stringify(chatHistory, null, 2), 'utf8', () => {});
        io.emit('deleteMessage', msgId); 
    });

    socket.on('clearHistory', () => {
        chatHistory.forEach(msg => deleteAttachedFile(msg));
        chatHistory = [];
        fs.writeFile(chatPath, JSON.stringify(chatHistory), 'utf8', () => {});
        io.emit('clearHistory'); 
    });
});

app.use(express.static(path.join(__dirname, './public')));
app.use((req, res) => res.sendFile(path.join(__dirname, './public', 'index.html')));

server.listen(PORT, '0.0.0.0', () => {
    console.log(`서버 및 실시간 채팅이 포트 ${PORT}에서 실행 중입니다.`);
});