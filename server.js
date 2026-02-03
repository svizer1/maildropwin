// server.js - Backend сервер для временной почты DropWin с РЕАЛЬНЫМИ почтами
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API 1secmail.com - РЕАЛЬНЫЕ временные почты
const SECMAIL_API = 'https://www.1secmail.com/api/v1/';

// Доступные домены
const DOMAINS = [
    '1secmail.com',
    '1secmail.org',
    '1secmail.net',
    'kzccv.com',
    'qiott.com',
    'wuuvo.com',
    'icznn.com'
];

/**
 * Генерация случайного имени пользователя (красивого)
 */
function generateUsername() {
    const prefixes = ['drop', 'temp', 'quick', 'fast', 'safe', 'anon', 'win', 'mail', 'box', 'secure'];
    const suffixes = ['mail', 'post', 'box', 'drop', 'win', 'safe', 'fast', 'temp', 'user', 'test'];
    const numbers = Math.floor(Math.random() * 9000) + 1000;

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    // Создаем красивое имя типа: quickmail4582, dropwin7823
    return `${prefix}${suffix}${numbers}`.toLowerCase();
}

/**
 * Эндпоинт: Создание новой временной почты
 */
app.get('/api/generate-email', async (req, res) => {
    try {
        console.log('🔄 Создание новой временной почты...');

        const username = generateUsername();
        const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
        const email = `${username}@${domain}`;

        console.log(`✅ Создана реальная почта: ${email}`);

        res.json({
            success: true,
            email: email,
            username: username,
            domain: domain,
            api: '1secmail',
            message: 'Реальная временная почта! Отправляйте письма и они придут сюда.',
            isReal: true
        });

    } catch (error) {
        console.error('❌ Ошибка создания почты:', error.message);

        // Fallback: генерируем адрес даже при ошибке
        const username = generateUsername();
        const domain = DOMAINS[0];
        const email = `${username}@${domain}`;

        res.json({
            success: true,
            email: email,
            username: username,
            domain: domain,
            api: '1secmail',
            message: 'Реальная временная почта!',
            isReal: true
        });
    }
});

/**
 * Получение писем из 1secmail API
 */
app.get('/api/get-messages', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email адрес не указан'
            });
        }

        // Разбиваем email на username и domain
        const [username, domain] = email.split('@');

        if (!username || !domain) {
            return res.status(400).json({
                success: false,
                error: 'Неверный формат email'
            });
        }

        console.log(`📬 Проверка писем для: ${email}`);

        // Запрос к 1secmail API
        const response = await axios.get(SECMAIL_API, {
            params: {
                action: 'getMessages',
                login: username,
                domain: domain
            },
            timeout: 10000
        });

        const messages = response.data || [];

        console.log(`📩 Найдено писем: ${messages.length}`);

        // Форматируем сообщения
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            from: msg.from,
            subject: msg.subject || '(Без темы)',
            date: msg.date,
            body: msg.textBody || msg.body || '',
            textBody: msg.textBody || msg.body || ''
        }));

        res.json({
            success: true,
            messages: formattedMessages,
            count: formattedMessages.length,
            isReal: true
        });

    } catch (error) {
        console.error('❌ Ошибка получения писем:', error.message);
        
        // Возвращаем пустой массив вместо ошибки
        res.json({
            success: true,
            messages: [],
            count: 0,
            error: 'Не удалось получить письма. Попробуйте позже.'
        });
    }
});

/**
 * Чтение конкретного письма
 */
app.get('/api/read-message', async (req, res) => {
    try {
        const { email, id } = req.query;

        if (!email || !id) {
            return res.status(400).json({
                success: false,
                error: 'Email или ID письма не указаны'
            });
        }

        // Разбиваем email на username и domain
        const [username, domain] = email.split('@');

        console.log(`📖 Чтение письма ID ${id} для: ${email}`);

        // Запрос к 1secmail API
        const response = await axios.get(SECMAIL_API, {
            params: {
                action: 'readMessage',
                login: username,
                domain: domain,
                id: id
            },
            timeout: 10000
        });

        const message = response.data;

        if (!message) {
            throw new Error('Письмо не найдено');
        }

        // Форматируем сообщение
        const formattedMessage = {
            id: message.id,
            from: message.from,
            subject: message.subject || '(Без темы)',
            date: message.date,
            htmlBody: message.htmlBody || `<pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${escapeHtml(message.textBody || message.body || '')}</pre>`,
            textBody: message.textBody || message.body || '',
            attachments: message.attachments || []
        };

        res.json({
            success: true,
            message: formattedMessage,
            isReal: true
        });

    } catch (error) {
        console.error('❌ Ошибка чтения письма:', error.message);
        res.status(500).json({
            success: false,
            error: 'Не удалось прочитать письмо'
        });
    }
});

/**
 * Тестовый эндпоинт
 */
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ DropWin Mail Server работает!',
        timestamp: new Date().toISOString(),
        version: '2.1.0',
        info: 'Используется реальный API 1secmail.com',
        api: '1secmail'
    });
});

/**
 * Получение списка доступных доменов
 */
app.get('/api/get-domains', (req, res) => {
    res.json({
        success: true,
        domains: DOMAINS
    });
});

// Корневой маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           🚀 DROPWIN MAIL SERVER v2.1 ЗАПУЩЕН!            ║
║                                                            ║
║     📡 URL: http://localhost:${PORT}                        ║
║     🌐 API: http://localhost:${PORT}/api                    ║
║                                                            ║
║     ✅ РЕАЛЬНЫЕ ВРЕМЕННЫЕ ПОЧТЫ РАБОТАЮТ!                 ║
║     📧 API: 1secmail.com                                  ║
║     🔄 Автообновление каждые 3 секунды                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📝 КАК ИСПОЛЬЗОВАТЬ:
   1. Откройте http://localhost:${PORT} в браузере
   2. Нажмите кнопку "+" для создания новой почты
   3. Скопируйте созданный email адрес
   4. Отправьте письмо с Gmail/Outlook/Yahoo
   5. Письмо появится через 10-30 секунд!

💡 СОВЕТ:
   Отправьте тестовое письмо на созданный адрес!
   Например: quickmail4582@1secmail.com

⚡ СЕРВЕР ГОТОВ К РАБОТЕ!
`);
});
