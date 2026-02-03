// script.js - Полная логика для DropWin Mail с управлением несколькими почтами

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
const API_BASE = 'http://localhost:3000/api';
const REFRESH_INTERVAL = 3000; // 3
const STORAGE_KEY = 'dropwin_emails';

let emails = []; // Массив всех созданных почт
let currentEmail = null; // Текущая активная почта
let refreshInterval = null;

// ========== DOM ЭЛЕМЕНТЫ ==========
const createNewEmailBtn = document.getElementById('createNewEmailBtn');
const createFirstEmailBtn = document.getElementById('createFirstEmailBtn');
const noEmailSelected = document.getElementById('noEmailSelected');
const emailContent = document.getElementById('emailContent');
const emailsList = document.getElementById('emailsList');
const emailsCount = document.getElementById('emailsCount');
const currentEmailText = document.getElementById('currentEmailText');
const copyEmailBtn = document.getElementById('copyEmailBtn');
const refreshEmailBtn = document.getElementById('refreshEmailBtn');
const deleteEmailBtn = document.getElementById('deleteEmailBtn');
const copyNotification = document.getElementById('copyNotification');
const messagesCount = document.getElementById('messagesCount');
const messagesList = document.getElementById('messagesList');
const messageModal = document.getElementById('messageModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalSubject = document.getElementById('modalSubject');
const modalFrom = document.getElementById('modalFrom');
const modalDate = document.getElementById('modalDate');
const modalBody = document.getElementById('modalBody');

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    loadEmailsFromStorage();
    setupEventListeners();
    
    if (emails.length > 0) {
        renderEmailsList();
        selectEmail(emails[0]);
    } else {
        showNoEmailState();
    }
});

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
function setupEventListeners() {
    createNewEmailBtn.addEventListener('click', createNewEmail);
    createFirstEmailBtn.addEventListener('click', createNewEmail);
    copyEmailBtn.addEventListener('click', copyToClipboard);
    refreshEmailBtn.addEventListener('click', manualRefresh);
    deleteEmailBtn.addEventListener('click', deleteCurrentEmail);
    closeModalBtn.addEventListener('click', closeModal);
    
    messageModal.addEventListener('click', (e) => {
        if (e.target === messageModal || e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
}

// ========== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ==========
function loadEmailsFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            emails = JSON.parse(stored);
        }
    } catch (error) {
        console.error('Ошибка загрузки из localStorage:', error);
        emails = [];
    }
}

function saveEmailsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
    } catch (error) {
        console.error('Ошибка сохранения в localStorage:', error);
    }
}

// ========== СОЗДАНИЕ НОВОЙ ПОЧТЫ ==========
async function createNewEmail() {
    try {
        // Показываем загрузку
        showLoadingButton(createNewEmailBtn);
        
        const response = await fetch(`${API_BASE}/generate-email`);
        const data = await response.json();
        
        if (data.success) {
            const newEmail = {
                address: data.email,
                username: data.username,
                domain: data.domain,
                createdAt: new Date().toISOString(),
                messagesCount: 0
            };
            
            emails.unshift(newEmail); // Добавляем в начало массива
            saveEmailsToStorage();
            renderEmailsList();
            selectEmail(newEmail);
            
            showToast('Почта создана успешно!', 'success');
        } else {
            throw new Error(data.error || 'Не удалось создать почту');
        }
    } catch (error) {
        console.error('Ошибка создания почты:', error);
        showToast('Ошибка создания почты', 'error');
    } finally {
        restoreButton(createNewEmailBtn);
    }
}

// ========== ОТОБРАЖЕНИЕ СПИСКА ПОЧТ ==========
function renderEmailsList() {
    emailsCount.textContent = emails.length;
    
    if (emails.length === 0) {
        emailsList.innerHTML = `
            <div class="empty-emails-state">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                    <path d="M24 16V24M24 28V28.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>Нет созданных почт</p>
                <span>Создайте первую почту</span>
            </div>
        `;
        return;
    }
    
    const html = emails.map(email => `
        <div class="email-item ${currentEmail && currentEmail.address === email.address ? 'active' : ''}" 
             data-email="${escapeHtml(email.address)}">
            <div class="email-item-text">${escapeHtml(email.address)}</div>
            <div class="email-item-info">
                <span>${formatRelativeTime(email.createdAt)}</span>
                ${email.messagesCount > 0 ? `<span class="email-item-badge">${email.messagesCount}</span>` : ''}
            </div>
        </div>
    `).join('');
    
    emailsList.innerHTML = html;
    
    // Добавляем обработчики клика
    document.querySelectorAll('.email-item').forEach(item => {
        item.addEventListener('click', () => {
            const emailAddress = item.getAttribute('data-email');
            const email = emails.find(e => e.address === emailAddress);
            if (email) {
                selectEmail(email);
            }
        });
    });
}

// ========== ВЫБОР АКТИВНОЙ ПОЧТЫ ==========
function selectEmail(email) {
    currentEmail = email;
    
    // Обновляем UI
    noEmailSelected.classList.add('hidden');
    emailContent.classList.remove('hidden');
    currentEmailText.textContent = email.address;
    
    // Обновляем список почт
    renderEmailsList();
    
    // Останавливаем предыдущее автообновление
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Загружаем письма
    fetchMessages();
    
    // Запускаем автообновление
    refreshInterval = setInterval(() => {
        fetchMessages();
    }, REFRESH_INTERVAL);
}

// ========== СОСТОЯНИЕ "НЕТ ПОЧТЫ" ==========
function showNoEmailState() {
    noEmailSelected.classList.remove('hidden');
    emailContent.classList.add('hidden');
    currentEmail = null;
    
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// ========== ПОЛУЧЕНИЕ ПИСЕМ ==========
async function fetchMessages() {
    if (!currentEmail) return;
    
    try {
        const response = await fetch(
            `${API_BASE}/get-messages?email=${encodeURIComponent(currentEmail.address)}`
        );
        const data = await response.json();
        
        if (data.success) {
            const messages = data.messages || [];
            
            // Обновляем счетчик писем
            currentEmail.messagesCount = messages.length;
            saveEmailsToStorage();
            renderEmailsList();
            
            messagesCount.textContent = `${messages.length} ${getMessageWord(messages.length)}`;
            
            displayMessages(messages);
        }
    } catch (error) {
        console.error('Ошибка получения писем:', error);
    }
}

// ========== ОТОБРАЖЕНИЕ ПИСЕМ ==========
function displayMessages(messages) {
    if (!messages || messages.length === 0) {
        messagesList.innerHTML = `
            <div class="empty-messages-state">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="2" opacity="0.2"/>
                    <path d="M20 28L32 36L44 28" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.3"/>
                    <rect x="18" y="24" width="28" height="20" rx="2" stroke="currentColor" stroke-width="2.5" opacity="0.3"/>
                </svg>
                <p>Нет входящих писем</p>
                <span>Отправьте письмо на этот адрес, и оно появится здесь автоматически</span>
            </div>
        `;
        return;
    }
    
    // Сортируем по дате (новые сверху)
    messages.sort((a, b) => b.id - a.id);
    
    const html = messages.map(msg => `
        <div class="message-item" data-id="${msg.id}">
            <div class="message-header">
                <div class="message-subject">${escapeHtml(msg.subject || '(Без темы)')}</div>
                <div class="message-date">${formatDate(msg.date)}</div>
            </div>
            <div class="message-from">От: ${escapeHtml(msg.from)}</div>
        </div>
    `).join('');
    
    messagesList.innerHTML = html;
    
    // Добавляем обработчики
    document.querySelectorAll('.message-item').forEach(item => {
        item.addEventListener('click', () => {
            const messageId = item.getAttribute('data-id');
            openMessage(messageId);
        });
    });
}

// ========== ОТКРЫТИЕ ПИСЬМА ==========
async function openMessage(messageId) {
    try {
        const response = await fetch(
            `${API_BASE}/read-message?email=${encodeURIComponent(currentEmail.address)}&id=${messageId}`
        );
        const data = await response.json();
        
        if (data.success && data.message) {
            const msg = data.message;
            
            modalSubject.textContent = msg.subject || '(Без темы)';
            modalFrom.textContent = msg.from;
            modalDate.textContent = formatDate(msg.date);
            
            if (msg.htmlBody) {
                modalBody.innerHTML = msg.htmlBody;
            } else if (msg.textBody) {
                modalBody.textContent = msg.textBody;
            } else {
                modalBody.textContent = '(Пустое письмо)';
            }
            
            messageModal.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Ошибка открытия письма:', error);
        showToast('Не удалось открыть письмо', 'error');
    }
}

// ========== ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА ==========
function closeModal() {
    messageModal.classList.add('hidden');
}

// ========== КОПИРОВАНИЕ В БУФЕР ОБМЕНА ==========
async function copyToClipboard() {
    if (!currentEmail) return;
    
    try {
        await navigator.clipboard.writeText(currentEmail.address);
        showToast('Email скопирован!', 'success');
    } catch (error) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = currentEmail.address;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast('Email скопирован!', 'success');
        } catch (err) {
            showToast('Ошибка копирования', 'error');
        }
        
        document.body.removeChild(textArea);
    }
}

// ========== РУЧНОЕ ОБНОВЛЕНИЕ ==========
async function manualRefresh() {
    if (!currentEmail) return;
    
    showLoadingButton(refreshEmailBtn, true);
    await fetchMessages();
    
    setTimeout(() => {
        restoreButton(refreshEmailBtn, true);
    }, 500);
}

// ========== УДАЛЕНИЕ ПОЧТЫ ==========
function deleteCurrentEmail() {
    if (!currentEmail) return;
    
    if (!confirm(`Удалить почту ${currentEmail.address}?`)) {
        return;
    }
    
    // Удаляем из массива
    emails = emails.filter(e => e.address !== currentEmail.address);
    saveEmailsToStorage();
    
    // Обновляем UI
    if (emails.length > 0) {
        renderEmailsList();
        selectEmail(emails[0]);
    } else {
        renderEmailsList();
        showNoEmailState();
    }
    
    showToast('Почта удалена', 'success');
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function showToast(message, type = 'success') {
    copyNotification.textContent = message;
    copyNotification.style.background = type === 'success' ? 'var(--success)' : 'var(--error)';
    copyNotification.classList.remove('hidden');
    
    setTimeout(() => {
        copyNotification.classList.add('hidden');
    }, 2000);
}

function showLoadingButton(button, icon = false) {
    if (icon) {
        button.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="animation: spin 1s linear infinite;">
                <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
                <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
        `;
    } else {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="animation: spin 1s linear infinite;">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
                <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
            Создание...
        `;
    }
}

function restoreButton(button, icon = false) {
    if (icon) {
        button.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2.25 9C2.25 5.27208 5.27208 2.25 9 2.25C11.0597 2.25 12.9084 3.16479 14.1562 4.59375M15.75 9C15.75 12.7279 12.7279 15.75 9 15.75C6.94034 15.75 5.09158 14.8352 3.84375 13.4062" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M14.25 2.25V4.875H11.625" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3.75 15.75V13.125H6.375" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    } else {
        button.disabled = false;
        button.style.opacity = '1';
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Вчера, ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} д. назад`;
    
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function getMessageWord(count) {
    const cases = [2, 0, 1, 1, 1, 2];
    const words = ['письмо', 'письма', 'писем'];
    return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Добавляем CSS для анимации вращения
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
